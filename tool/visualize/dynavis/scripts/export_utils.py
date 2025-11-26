# export_utils.py
from __future__ import annotations
from typing import Optional, Dict

import os
import numpy as np
import torch

from .utils_amp import AMP_DTYPE
from .models import Encoder
from .data_utils import apply_normalization_with_stats, load_or_generate
from .data_utils import load_epoch_stack_from_dir


@torch.no_grad()
def export_embeddings(
    f: Encoder,
    X_raw: np.ndarray,
    t_raw: np.ndarray,
    stats: Dict[str, np.ndarray],
    device: str,
    out_npz: str,
    per_epoch_dir: Optional[str] = None,
    batch_n: int = 1024
):
    """
    Export low-dimensional embeddings for the full training set.

    Saves:
        - out_npz: npz with keys {'Y_ld': [T, N, d], 't': [T]}
        - optionally, per-epoch npy files in per_epoch_dir
    """
    f.eval()
    X, t = apply_normalization_with_stats(X_raw, t_raw, stats)
    T, N, D = X.shape
    os.makedirs(os.path.dirname(out_npz) or ".", exist_ok=True)
    if per_epoch_dir:
        os.makedirs(per_epoch_dir, exist_ok=True)

    # probe output dimension
    with torch.no_grad():
        dummy = f(torch.zeros(1, D, device=device), torch.zeros(1, device=device))
        d = int(dummy.shape[-1])
    Y = np.empty((T, N, d), dtype=np.float32)

    for k in range(T):
        t_k = np.full((N,), float(t[k]), dtype=np.float32)
        for s in range(0, N, batch_n):
            idx = slice(s, min(s + batch_n, N))
            xk = torch.from_numpy(X[k, idx, :]).to(device, non_blocking=True)
            tk = torch.from_numpy(t_k[idx]).to(device, non_blocking=True)
            if AMP_DTYPE is None:
                yk = f(xk, tk)
            else:
                with torch.amp.autocast('cuda', dtype=AMP_DTYPE):
                    yk = f(xk, tk)
            Y[k, idx, :] = yk.float().cpu().numpy()
        if per_epoch_dir:
            np.save(os.path.join(per_epoch_dir, f"epoch_{k+1}_embedding.npy"), Y[k])
    np.savez(out_npz, Y_ld=Y, t=t.astype(np.float32))
    print(f"[Saved] {out_npz}")
    if per_epoch_dir:
        print(f"[Saved] per-epoch → {per_epoch_dir}")


@torch.no_grad()
def export_2d_per_epoch(
    f: Encoder,
    X_raw: np.ndarray,
    t_raw: np.ndarray,
    stats: Dict[str, np.ndarray],
    device: str,
    out_root: str,
    batch_n: int = 2048,
    epoch_ids: np.ndarray | None = None,
):
    """
    Export 2D projection per epoch to:
      out_root/epochs/epoch_k/projection.npy → [N,2]
    """
    f.eval()
    X, t = apply_normalization_with_stats(X_raw, t_raw, stats)
    T, N, D = X.shape
    epochs_dir = os.path.join(out_root, "epochs")
    os.makedirs(epochs_dir, exist_ok=True)

    for k in range(T):
        t_k = np.full((N,), float(t[k]), dtype=np.float32)
        Y2 = np.empty((N, 2), dtype=np.float32)
        for s in range(0, N, batch_n):
            idx = slice(s, min(s + batch_n, N))
            xk = torch.from_numpy(X[k, idx, :]).to(device, non_blocking=True)
            tk = torch.from_numpy(t_k[idx]).to(device, non_blocking=True)
            if AMP_DTYPE is None:
                yk = f(xk, tk)
            else:
                with torch.amp.autocast('cuda', dtype=AMP_DTYPE):
                    yk = f(xk, tk)
            Y2[idx, :] = yk[:, :2].float().cpu().numpy()
        ek = int(epoch_ids[k]) if epoch_ids is not None else k
        epoch_out_dir = os.path.join(epochs_dir, f"epoch_{ek}")
        os.makedirs(epoch_out_dir, exist_ok=True)
        np.save(os.path.join(epoch_out_dir, "projection.npy"), Y2)
    print(f"[Saved] per-epoch 2D → {epochs_dir}")


@torch.no_grad()
def save_final_2d_points_npz(
    npz_path: str,
    out_csv: str,
    out_npy: Optional[str] = None,
    t_index: Optional[int] = None
):
    """
    Save the final 2D positions (last time step by default) to CSV/NPY.

    npz_path: contains 'Y_ld': [T, N, d]
    """
    data = np.load(npz_path)
    Y = data["Y_ld"]   # [T, N, d]
    T, N, d = Y.shape
    assert d >= 2
    k = (T - 1) if t_index is None else int(t_index)
    Yk = Y[k, :, :2]
    os.makedirs(os.path.dirname(out_csv) or ".", exist_ok=True)
    with open(out_csv, "w") as f:
        f.write("sample_id,y1,y2\n")
        for n in range(N):
            f.write(f"{n},{Yk[n,0]:.7f},{Yk[n,1]:.7f}\n")
    if out_npy is not None:
        np.save(out_npy, Yk.astype(np.float32))
    print(f"[Saved] final 2D: t={k} → {out_csv}{' & ' + out_npy if out_npy else ''}")


@torch.no_grad()
def export_test_2d_npz(
    f: Encoder,
    stats_npz_path: str,         # norm_stats_*.npz saved in ckpt_dir
    test_data_path: str,         # .npy or .npz with [T, N, D] or key "X"
    device: str,
    out_npz_path: str,           # output npz
    per_epoch_dir: Optional[str] = None,  # optional per-epoch npy dir
    batch_n: int = 2048,
    use_last_t_only: bool = False
):
    """
    Apply the trained encoder to a test set and export 2D points.

    npz content:
        - if use_last_t_only=True:
              {'Y_2d': [N,2], 't': scalar(int)}
        - else:
              {'Y_2d': [T,N,2], 't': [T]}
    """
    # 1) load normalization statistics (same as training)
    with np.load(stats_npz_path, allow_pickle=True) as z:
        stats = {k: z[k] for k in z.files}

    # 2) load test data and normalize
    X_raw, t_raw = load_or_generate(test_data_path)   # X_raw: [T,N,D]
    X, t = apply_normalization_with_stats(X_raw, t_raw, stats)
    T, N, D = X.shape

    # 3) sanity check on encoder output dimension
    f.eval()
    dummy_y = f(
        torch.zeros(1, D, device=device),
        torch.zeros(1, device=device)
    )
    d_out = int(dummy_y.shape[-1])
    if d_out < 2:
        raise ValueError(f"Encoder output dim {d_out} < 2; cannot export 2D points.")

    # 4) forward and export
    if use_last_t_only:
        k = T - 1
        t_k = np.full((N,), float(t[k]), dtype=np.float32)
        Y2 = np.empty((N, 2), dtype=np.float32)

        for s in range(0, N, batch_n):
            idx = slice(s, min(s + batch_n, N))
            xk = torch.from_numpy(X[k, idx, :]).to(device, non_blocking=True)
            tk = torch.from_numpy(t_k[idx]).to(device, non_blocking=True)
            if AMP_DTYPE is None:
                yk = f(xk, tk)
            else:
                with torch.amp.autocast('cuda', dtype=AMP_DTYPE):
                    yk = f(xk, tk)
            Y2[idx, :] = yk[:, :2].float().cpu().numpy()

        os.makedirs(os.path.dirname(out_npz_path) or ".", exist_ok=True)
        np.savez(out_npz_path, Y_2d=Y2, t=np.array(k, dtype=np.int64))
        print(f"[Saved] test 2D (last t) → {out_npz_path}  |  shape={Y2.shape}")

    else:
        Y2 = np.empty((T, N, 2), dtype=np.float32)
        if per_epoch_dir:
            os.makedirs(per_epoch_dir, exist_ok=True)

        for k in range(T):
            t_k = np.full((N,), float(t[k]), dtype=np.float32)
            for s in range(0, N, batch_n):
                idx = slice(s, min(s + batch_n, N))
                xk = torch.from_numpy(X[k, idx, :]).to(device, non_blocking=True)
                tk = torch.from_numpy(t_k[idx]).to(device, non_blocking=True)
                if AMP_DTYPE is None:
                    yk = f(xk, tk)
                else:
                    with torch.amp.autocast('cuda', dtype=AMP_DTYPE):
                        yk = f(xk, tk)
                Y2[k, idx, :] = yk[:, :2].float().cpu().numpy()
            if per_epoch_dir:
                np.save(os.path.join(per_epoch_dir, f"epoch_{k+1}_test_2d.npy"), Y2[k])
        os.makedirs(os.path.dirname(out_npz_path) or ".", exist_ok=True)
        np.savez(out_npz_path, Y_2d=Y2, t=t.astype(np.float32))
        print(f"[Saved] test 2D (full T) → {out_npz_path}  |  shape={Y2.shape}")
