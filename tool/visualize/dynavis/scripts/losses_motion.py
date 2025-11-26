# losses_motion.py
from __future__ import annotations

import torch
import torch.nn.functional as F


def ranking_speed_loss(
    X_seq: torch.Tensor,      # [B, T, D]
    Y_seq: torch.Tensor,      # [B, T, d]
    margin_top_order: float = 0.02,
    margin_top_vs_rest: float = 0.01
) -> torch.Tensor:
    """
    Scale-invariant top-3 ranking constraint on temporal speed.

    This preserves the relative ordering of the top-3 steps
    between high- and low-dimensional speeds.
    """
    eps = 1e-8
    B, T, D = X_seq.shape
    assert T >= 4, "T must be >= 4 to stably compute top-3"

    v_hi = X_seq[:, 1:, :] - X_seq[:, :-1, :]
    v_lo = Y_seq[:, 1:, :] - Y_seq[:, :-1, :]

    s_hi = v_hi.norm(dim=-1)  # [B, T-1]
    s_lo = v_lo.norm(dim=-1)  # [B, T-1]

    losses = []
    for b in range(B):
        sh = s_hi[b]
        sl = s_lo[b]
        K = sh.numel()
        if K < 3:
            continue

        order = torch.argsort(sh, descending=True)
        I = order[:3]
        i1, i2, i3 = I[0], I[1], I[2]

        mean_top3_lo = (sl[i1] + sl[i2] + sl[i3]) / 3.0
        sln = sl / (mean_top3_lo + eps)

        l1 = F.relu(margin_top_order + sln[i2] - sln[i1])
        l2 = F.relu(margin_top_order + sln[i3] - sln[i2])

        sln_min_top3 = torch.min(sln[I])
        mask_rest = torch.ones(K, dtype=torch.bool, device=sl.device)
        mask_rest[I] = False
        if mask_rest.any():
            sln_rest = sln[mask_rest]
            l3 = F.relu(margin_top_vs_rest + sln_rest - sln_min_top3).mean()
        else:
            l3 = torch.zeros((), device=sl.device)

        losses.append(l1 + l2 + l3)

    if len(losses) == 0:
        return torch.zeros((), device=X_seq.device)
    return torch.stack(losses).mean()


def distance_to_prob(distances: torch.Tensor, tau: float = 0.25):
    """
    Convert pairwise distances into a probability distribution via softmax.

    Args:
        distances: [B, N, N]
        tau: temperature
    Returns:
        prob_distances: [B, N, N]
    """
    prob_distances = torch.exp(-distances / tau)
    prob_distances = prob_distances / prob_distances.sum(dim=-1, keepdim=True)
    return prob_distances


def kl_divergence(p: torch.Tensor, q: torch.Tensor) -> torch.Tensor:
    """
    Compute KL divergence KL(p || q).

    Args:
        p: [B, N, N]
        q: [B, N, N]
    Returns:
        scalar KL loss
    """
    return (p * (torch.log(p + 1e-8) - torch.log(q + 1e-8))).sum(dim=-1).mean()


def ranking_prob_loss(X_seq: torch.Tensor, Y_seq: torch.Tensor, tau: float = 0.25) -> torch.Tensor:
    """
    Pairwise ranking loss based on distance distributions in high and low dimensions.

    Args:
        X_seq: [B, T, D]
        Y_seq: [B, T, d]
        tau: temperature
    Returns:
        scalar loss
    """
    B, T, D = X_seq.shape
    assert T >= 4, "T must be >= 4 to stably compute distributions"

    # pairwise distances in high and low dimensions
    dist_high = torch.cdist(X_seq, X_seq, p=2)  # [B, T, T]
    dist_low = torch.cdist(Y_seq, Y_seq, p=2)   # [B, T, T]

    p_high = distance_to_prob(dist_high, tau)
    p_low = distance_to_prob(dist_low, tau)

    prob_loss = kl_divergence(p_high, p_low)
    return prob_loss


def _window_direction(seq: torch.Tensor, W: int):
    """
    Compute step-wise displacements and window-aggregated reference directions.

    seq: [B, T, D]
    Returns:
        v:     [B, T-1, D]  local step displacements
        v_ref: [B, T-1, D]  aggregated direction over window W starting at each step
    """
    v = seq[:, 1:, :] - seq[:, :-1, :]            # [B, K, D], K = T-1
    B, K, D = v.shape
    if W <= 1:
        return v, v.clone()

    # prefix sum trick: sum_{k..k+W-1} v = prefix[k+W]-prefix[k]
    prefix = torch.zeros(B, K + 1, D, device=seq.device, dtype=seq.dtype)
    prefix[:, 1:, :] = torch.cumsum(v, dim=1)

    idx_r = torch.arange(K, device=seq.device).unsqueeze(0).expand(B, -1) + W
    idx_r = torch.clamp(idx_r, max=K)  # [B, K]

    arange_b = torch.arange(B, device=seq.device).unsqueeze(-1)
    right = prefix[arange_b, idx_r, :]                   # [B, K, D]
    left = prefix[arange_b, torch.arange(K, device=seq.device), :]  # [B, K, D]
    v_ref = right - left
    return v, v_ref


def direction_consistency_multiscale(
    X_seq: torch.Tensor,
    Y_seq: torch.Tensor,
    windows=(2, 4, 8),
    betas=(0.5, 0.5, 0.5),          # kept for compatibility, not used
    min_step_norm: float = 1e-4,
    gamma: float = 3.5,
    eps: float = 1e-6
):
    """
    Multi-scale local direction consistency.

    For each window W:
        - compute v_hi, v_hi_ref and v_lo, v_lo_ref
        - cos_hi = cos(v_hi, v_hi_ref), cos_lo = cos(v_lo, v_lo_ref)
        - loss is a mixture:
            L_dir_sq  = mean((cos_hi - cos_lo)^2)
            L_dir_pow = mean((1 - clamp(cos_hi * cos_lo))^3)
            L_dir_W   = 0.7 * L_dir_sq + 0.3 * L_dir_pow * (1 + gamma * |1 - cos_lo|)
        - ignore steps where reference magnitude is too small (masking noise)

    The final loss is averaged over all windows.
    """
    assert len(windows) > 0
    total = 0.0
    used = 0

    for W in windows:
        v_hi, v_hi_ref = _window_direction(X_seq, W)   # [B, K, D]
        v_lo, v_lo_ref = _window_direction(Y_seq, W)   # [B, K, d]

        mask_hi = (v_hi_ref.norm(dim=-1) > min_step_norm)
        mask_lo = (v_lo_ref.norm(dim=-1) > min_step_norm)
        mask = mask_hi & mask_lo
        if not mask.any():
            continue

        v_hi_n = F.normalize(v_hi, dim=-1, eps=eps)
        v_hi_ref_n = F.normalize(v_hi_ref, dim=-1, eps=eps)
        v_lo_n = F.normalize(v_lo, dim=-1, eps=eps)
        v_lo_ref_n = F.normalize(v_lo_ref, dim=-1, eps=eps)

        cos_hi = (v_hi_n * v_hi_ref_n).sum(dim=-1)  # [B, K]
        cos_lo = (v_lo_n * v_lo_ref_n).sum(dim=-1)  # [B, K]

        cos_hi_m = cos_hi[mask]
        cos_lo_m = cos_lo[mask]

        L_dir_sq = ((cos_hi_m - cos_lo_m) ** 2).mean()

        prod = (cos_hi_m * cos_lo_m).clamp(-1 + eps, 1 - eps)
        L_dir_pow = ((1.0 - prod) ** 3).mean()

        amp = (1.0 + gamma * (1.0 - cos_lo_m).abs()).mean()

        L_dir_W = 0.7 * L_dir_sq + 0.3 * L_dir_pow * amp
        total += L_dir_W
        used += 1

    if used == 0:
        return torch.zeros((), device=X_seq.device, dtype=X_seq.dtype)
    return total / used


def speed_distribution_kl(
    X_seq: torch.Tensor,
    Y_seq: torch.Tensor,
    tau: float = 0.25,
    weighted_by_p: bool = True,
    min_step_norm: float = 1e-8
):
    """
    Distribution-level KL divergence of temporal speed profiles.

    The speed at each step is normalized per sequence and then
    turned into a probability via softmax.
    """
    v_hi = X_seq[:, 1:, :] - X_seq[:, :-1, :]
    v_lo = Y_seq[:, 1:, :] - Y_seq[:, :-1, :]
    s_hi = v_hi.norm(dim=-1)  # [B, K]
    s_lo = v_lo.norm(dim=-1)

    mask_b = (s_hi.mean(dim=-1) > min_step_norm) & (s_lo.mean(dim=-1) > min_step_norm)
    if not mask_b.any():
        return torch.zeros((), device=X_seq.device)

    s_hi = s_hi[mask_b]
    s_lo = s_lo[mask_b]
    s_hi = s_hi / (s_hi.mean(dim=-1, keepdim=True) + 1e-8)
    s_lo = s_lo / (s_lo.mean(dim=-1, keepdim=True) + 1e-8)

    p = torch.softmax(s_hi / tau, dim=-1)   # target
    q = torch.softmax(s_lo / tau, dim=-1)   # prediction

    log_p = p.clamp_min(1e-8).log()
    log_q = q.clamp_min(1e-8).log()
    base = (p * (log_p - log_q)).sum(dim=-1)  # [B']

    if weighted_by_p:
        w = p.detach()
        base = (w * (log_p - log_q) * p).sum(dim=-1)

    return base.mean()
