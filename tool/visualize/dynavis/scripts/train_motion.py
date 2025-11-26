#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations
import os

import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader
from tqdm import tqdm

from .hparams import HParams
from .utils_amp import (
    AMP_DTYPE,
    SCALER,
    maybe_compile,
    seed_all,
    l2_regularization,
)
from .data_utils import (
    load_or_generate,
    compute_stats_for_norm,
    apply_normalization_with_stats,
    SequenceDataset,
    collate_sequences,
    load_epoch_stack_from_dir,
)
from .models import Encoder, Decoder
from .losses_motion import ranking_prob_loss, direction_consistency_multiscale
from .export_utils import export_embeddings, export_2d_per_epoch


# ===================== Training loops =====================

def stage1_autoencoder(
    f: Encoder,
    g: Decoder,
    dl: DataLoader,
    device: str,
    epochs: int = 8,
    lr: float = 1e-3,
    lambda_reg: float = 1e-4,
    use_l2: bool = False,
) -> None:
    """
    Stage 1: pure reconstruction-based autoencoder training.

    If use_l2=True, L2 regularization is applied to both encoder and decoder.
    """
    f = maybe_compile(f)
    g = maybe_compile(g)
    opt = torch.optim.AdamW(
        [
            {"params": f.parameters(), "lr": lr},
            {"params": g.parameters(), "lr": lr * 2.0},
        ],
        weight_decay=0.0,
        fused=torch.cuda.is_available(),
    )

    f.train()
    g.train()
    for epoch in range(1, epochs + 1):
        acc = 0.0
        nstep = 0
        pbar = tqdm(dl, desc=f"[AE] epoch {epoch}/{epochs}")
        for batch in pbar:
            x_seq = batch["x_seq"].to(device, non_blocking=True)  # [B, T, D]
            t_seq = batch["t_seq"].to(device, non_blocking=True)  # [B, T]

            if AMP_DTYPE is None:
                y = f(x_seq, t_seq)
                x_rec = g(y, t_seq)
                L_rec = F.mse_loss(x_rec, x_seq)

                if use_l2:
                    l2_loss = l2_regularization([f, g], lambda_reg)
                else:
                    l2_loss = torch.zeros((), device=x_seq.device)

                loss = L_rec + l2_loss

                opt.zero_grad(set_to_none=True)
                loss.backward()
                opt.step()
            else:
                with torch.amp.autocast("cuda", dtype=AMP_DTYPE):
                    y = f(x_seq, t_seq)
                    x_rec = g(y, t_seq)
                    L_rec = F.mse_loss(x_rec, x_seq)

                if use_l2:
                    l2_loss = l2_regularization([f, g], lambda_reg)
                else:
                    l2_loss = torch.zeros((), device=x_seq.device)

                loss = L_rec + l2_loss

                opt.zero_grad(set_to_none=True)
                if SCALER is None:
                    loss.backward()
                    opt.step()
                else:
                    SCALER.scale(loss).backward()
                    SCALER.step(opt)
                    SCALER.update()

            acc += L_rec.item()
            nstep += 1
            pbar.set_postfix(rec=acc / nstep)
        print(f"[AE] epoch {epoch}/{epochs}  L_rec={acc / max(1, nstep):.6f}")


def stage2_joint(
    f: Encoder,
    g: Decoder,
    dl: DataLoader,
    device: str,
    h: HParams,
    lambda_reg: float = 1e-4,
) -> None:
    """
    Stage 2: joint training with reconstruction, direction consistency and
    pairwise ranking loss. L2 regularization is applied if h.use_l2=True.
    """
    # Ensure both encoder and decoder are trainable
    for p in g.parameters():
        p.requires_grad = True
    for p in f.parameters():
        p.requires_grad = True

    f = maybe_compile(f)
    opt = torch.optim.AdamW(
        [{"params": f.parameters(), "lr": h.lr_joint}],
        weight_decay=0.0,
        fused=torch.cuda.is_available(),
    )

    # Cosine annealing over the joint stage
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        opt, T_max=h.epochs_joint, eta_min=h.lr_joint * 0.1
    )

    f.train()
    g.train()

    for epoch in range(1, h.epochs_joint + 1):
        # Linear warmup for auxiliary losses
        scale = min(1.0, epoch / max(1, h.warmup_epochs))
        lam_dir = h.lambda_dir * scale
        lam_rank = h.lambda_rank * scale
        lam_rec = h.lambda_rec

        # Temperature annealing for ranking-based distribution
        tau = (
            h.kl_tau_start
            + (h.kl_tau_end - h.kl_tau_start)
            * (epoch - 1)
            / max(1, h.epochs_joint - 1)
        )

        meters = {"rec": 0.0, "dir": 0.0, "rank_top3": 0.0}
        nstep = 0
        pbar = tqdm(dl, desc=f"[Joint] epoch {epoch}/{h.epochs_joint}")

        for batch in pbar:
            x_seq = batch["x_seq"].to(device, non_blocking=True)  # [B, T, D]
            t_seq = batch["t_seq"].to(device, non_blocking=True)  # [B, T]

            if AMP_DTYPE is None:
                y_seq = f(x_seq, t_seq)
                x_rec = g(y_seq, t_seq)
                L_rec = F.mse_loss(x_rec, x_seq)

                # Pairwise ranking loss via distance distributions
                prob_loss = ranking_prob_loss(x_seq, y_seq, tau)

                # Multi-scale directional consistency
                L_dir = direction_consistency_multiscale(
                    x_seq,
                    y_seq,
                    windows=h.dir_windows,
                    betas=h.dir_betas,        # kept but ignored
                    min_step_norm=h.dir_min_step_norm,
                    gamma=3.5,
                    eps=1e-6,
                )

                if h.use_l2:
                    l2_loss = l2_regularization([f, g], lambda_reg)
                else:
                    l2_loss = torch.zeros((), device=x_seq.device)

                loss = (
                    lam_rec * L_rec
                    + lam_dir * L_dir
                    + lam_rank * prob_loss
                    + l2_loss
                )

                opt.zero_grad(set_to_none=True)
                loss.backward()
                if h.grad_clip is not None:
                    torch.nn.utils.clip_grad_norm_(f.parameters(), h.grad_clip)
                opt.step()
            else:
                with torch.amp.autocast("cuda", dtype=AMP_DTYPE):
                    y_seq = f(x_seq, t_seq)
                    x_rec = g(y_seq, t_seq)
                    L_rec = F.mse_loss(x_rec, x_seq)

                    prob_loss = ranking_prob_loss(x_seq, y_seq, tau)

                    L_dir = direction_consistency_multiscale(
                        x_seq,
                        y_seq,
                        windows=h.dir_windows,
                        betas=h.dir_betas,
                        min_step_norm=h.dir_min_step_norm,
                    )

                if h.use_l2:
                    l2_loss = l2_regularization([f, g], lambda_reg)
                else:
                    l2_loss = torch.zeros((), device=x_seq.device)

                loss = (
                    lam_rec * L_rec
                    + lam_dir * L_dir
                    + lam_rank * prob_loss
                    + l2_loss
                )

                opt.zero_grad(set_to_none=True)
                if SCALER is None:
                    loss.backward()
                    if h.grad_clip is not None:
                        torch.nn.utils.clip_grad_norm_(f.parameters(), h.grad_clip)
                    opt.step()
                else:
                    SCALER.scale(loss).backward()
                    if h.grad_clip is not None:
                        SCALER.unscale_(opt)
                        torch.nn.utils.clip_grad_norm_(f.parameters(), h.grad_clip)
                    SCALER.step(opt)
                    SCALER.update()

            meters["rec"] += L_rec.item()
            meters["dir"] += L_dir.item()
            meters["rank_top3"] += prob_loss.item()
            nstep += 1
            pbar.set_postfix(
                rec=meters["rec"] / nstep,
                dir=meters["dir"] / nstep,
                rank=meters["rank_top3"] / nstep,
            )

        scheduler.step()
        print(
            f"[Joint] epoch {epoch}/{h.epochs_joint} | "
            f"λ_rec={lam_rec:.2f} λ_dir={lam_dir:.2f} λ_rank={lam_rank:.2f} | "
            f"tau={tau:.3f} lr={scheduler.get_last_lr()[0]:.2e} | "
            f"L_rec={meters['rec'] / max(1, nstep):.6f} "
            f"L_dir={meters['dir'] / max(1, nstep):.6f} "
            f"L_rank_top3={meters['rank_top3'] / max(1, nstep):.6f}"
        )


# ===================== High-level pipeline =====================

def main(h: HParams) -> None:
    """
    Full training pipeline:
      1) Load data and compute normalization stats
      2) Build DataLoader
      3) Train Stage 1 (AE only)
      4) Train Stage 2 (joint)
      5) Export low-dimensional embeddings
    """
    seed_all(0)
    os.makedirs(h.ckpt_dir, exist_ok=True)

    # 1) Load and normalize raw training embeddings (per-epoch dir)
    X_raw, t_raw, epoch_ids = load_epoch_stack_from_dir(h.data_path)  # h.data_path points to content_path/epochs
    stats = compute_stats_for_norm(
        X_raw,
        t_raw,
        mode=h.norm_mode,
        std_clip_low=h.std_clip_low,
        std_clip_high=h.std_clip_high,
    )
    np.savez(os.path.join(h.ckpt_dir, f"norm_stats_{h.norm_mode}.npz"), **stats)
    X, t = apply_normalization_with_stats(X_raw, t_raw, stats)
    
    # 2) Dataloader over “full time series per sample”
    num_workers = max(2, os.cpu_count() // 2) if torch.cuda.is_available() else 0
    ds = SequenceDataset(X, t)
    dl = DataLoader(
        ds,
        batch_size=h.bs,
        shuffle=True,
        drop_last=False,
        num_workers=num_workers,
        pin_memory=True,
        persistent_workers=(num_workers > 0),
        prefetch_factor=(4 if num_workers > 0 else None),
        collate_fn=collate_sequences,
    )
    
    # 3) Models
    f = Encoder(h.D, h.d).to(h.device)
    g = Decoder(h.d, h.D).to(h.device)

    # 4) Stage 1: reconstruction only (with optional L2)
    stage1_autoencoder(
        f=f,
        g=g,
        dl=dl,
        device=h.device,
        epochs=h.epochs_ae,
        lr=h.lr_ae,
        lambda_reg=1e-4,
        use_l2=h.use_l2,
    )

    # 5) Stage 2: reconstruction + direction + ranking (with optional L2)
    stage2_joint(
        f=f,
        g=g,
        dl=dl,
        device=h.device,
        h=h,
        lambda_reg=1e-4,
    )
    
    # 6) Export per-epoch 2D projections to content_path/visualize/{vis_id}/epochs
    export_2d_per_epoch(
        f=f,
        X_raw=X_raw,
        t_raw=t_raw,
        stats=stats,
        device=h.device,
        out_root=h.ckpt_dir,
        batch_n=2048,
        epoch_ids=epoch_ids,
    )
