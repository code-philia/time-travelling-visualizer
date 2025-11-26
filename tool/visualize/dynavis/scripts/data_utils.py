# data_utils.py
from __future__ import annotations
from typing import Dict, Tuple, List
import os

import numpy as np
import torch
from torch.utils.data import Dataset


def finite_diff_xdot(X: np.ndarray, t: np.ndarray) -> np.ndarray:
    """
    Simple finite-difference approximation of temporal derivative.

    X: [T, N, D]
    t: [T]
    """
    T, N, D = X.shape
    Xdot = np.zeros_like(X, dtype=np.float32)
    for k in range(1, T - 1):
        dt = (t[k + 1] - t[k - 1])
        Xdot[k] = (X[k + 1] - X[k - 1]) / dt
    Xdot[0] = (X[1] - X[0]) / (t[1] - t[0])
    Xdot[-1] = (X[-1] - X[-2]) / (t[-1] - t[-2])
    return Xdot


def load_or_generate(path: str):
    """
    Load stacked embeddings from npy/npz.

    Expected:
        - npy with shape [T, N, D], or
        - npz with key "X" -> [T, N, D]
    """
    arr = np.load(path)
    X = arr.astype(np.float32) if isinstance(arr, np.ndarray) else arr["X"].astype(np.float32)
    t = np.arange(X.shape[0], dtype=np.float32)
    return X, t


def load_epoch_stack_from_dir(root_epochs_dir: str):
    """
    Load embeddings stored per-epoch:
    root_epochs_dir/epoch_k/embeddings.npy → [N,D]

    Returns:
        X: [T,N,D], t: [T]
    """
    if not os.path.isdir(root_epochs_dir):
        raise FileNotFoundError(f"Epochs dir not found: {root_epochs_dir}")
    entries: List[Tuple[int, str]] = []
    for name in os.listdir(root_epochs_dir):
        if name.startswith("epoch_"):
            try:
                k = int(name.split("epoch_")[-1])
                entries.append((k, os.path.join(root_epochs_dir, name)))
            except ValueError:
                continue
    if not entries:
        raise RuntimeError(f"No epoch_k folders under {root_epochs_dir}")
    entries.sort(key=lambda x: x[0])

    arrays: List[np.ndarray] = []
    N: int = -1
    D: int = -1
    epoch_ids: List[int] = []
    for k, p in entries:
        emb_path = os.path.join(p, "embeddings.npy")
        if not os.path.isfile(emb_path):
            raise FileNotFoundError(f"Missing embeddings.npy in {p}")
        arr = np.load(emb_path).astype(np.float32)  # [N,D]
        if arr.ndim != 2:
            raise ValueError(f"embeddings.npy must be 2D [N,D], got {arr.shape} in {p}")
        if N == -1 and D == -1:
            N, D = arr.shape
        else:
            if arr.shape != (N, D):
                raise ValueError(f"Epoch {k} shape mismatch {arr.shape} != {(N,D)}")
        arrays.append(arr)
        epoch_ids.append(k)

    X = np.stack(arrays, axis=0)  # [T,N,D]
    t = np.arange(len(arrays), dtype=np.float32)
    return X, t, np.array(epoch_ids, dtype=np.int64)


def _clip_std(std: np.ndarray, low: float, high: float) -> np.ndarray:
    """Clip std to [low, high] (if high>0)."""
    std = np.maximum(std, low)
    if high and high > 0:
        std = np.minimum(std, high)
    return std


def compute_stats_for_norm(
    X_raw: np.ndarray,
    t_raw: np.ndarray,
    mode: str = "robust",
    std_clip_low: float = 1e-8,
    std_clip_high: float = 0.0
) -> Dict[str, np.ndarray]:
    """
    Compute statistics used for normalization.

    X_raw: [T, N, D]
    t_raw: [T]
    """
    stats: Dict[str, np.ndarray | str | float] = {}
    stats["mode"] = np.array(mode)
    stats["t_min"] = np.array(float(np.min(t_raw)))
    stats["t_max"] = np.array(float(np.max(t_raw)))

    if mode == "per_epoch":
        mean_TD = X_raw.mean(axis=1)
        std_TD = _clip_std(X_raw.std(axis=1), std_clip_low, std_clip_high)
        stats["mean_per_epoch"] = mean_TD.astype(np.float32)
        stats["std_per_epoch"] = std_TD.astype(np.float32)
    elif mode == "anchor0":
        mean = X_raw[0].mean(axis=0)
        std = _clip_std(X_raw[0].std(axis=0), std_clip_low, std_clip_high)
        stats["mean"] = mean.astype(np.float32)
        stats["std"] = std.astype(np.float32)
    elif mode == "robust":
        q25 = np.percentile(X_raw, 25, axis=(0, 1))
        q75 = np.percentile(X_raw, 75, axis=(0, 1))
        median = np.median(X_raw, axis=(0, 1))
        iqr = q75 - q25
        robust_std = _clip_std(iqr / 1.349, std_clip_low, std_clip_high)
        stats["mean"] = median.astype(np.float32)
        stats["std"] = robust_std.astype(np.float32)
    elif mode == "center_only":
        mean = X_raw.mean(axis=(0, 1))
        stats["mean"] = mean.astype(np.float32)
        stats["std"] = np.ones_like(mean, dtype=np.float32)
    else:  # global
        mean = X_raw.mean(axis=(0, 1))
        std = _clip_std(X_raw.std(axis=(0, 1)), std_clip_low, std_clip_high)
        stats["mean"] = mean.astype(np.float32)
        stats["std"] = std.astype(np.float32)
    return stats


def apply_normalization_with_stats(
    X_raw: np.ndarray,
    t_raw: np.ndarray,
    stats: Dict[str, np.ndarray]
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Apply normalization using pre-computed statistics.

    Returns:
        X: normalized, float32
        t: normalized to [0, 1], float32
    """
    mode = str(stats["mode"])
    t_min = float(stats["t_min"])
    t_max = float(stats["t_max"])
    den = (t_max - t_min) if (t_max > t_min) else 1.0
    t = ((t_raw - t_min) / den).astype(np.float32)

    if mode == "per_epoch":
        mean_TD = stats["mean_per_epoch"].astype(np.float32)
        std_TD = stats["std_per_epoch"].astype(np.float32)
        X = ((X_raw - mean_TD[:, None, :]) / std_TD[:, None, :]).astype(np.float32)
    else:
        mean = stats["mean"].astype(np.float32)
        std = stats["std"].astype(np.float32)
        X = ((X_raw - mean) / std).astype(np.float32)
    return X, t


class SequenceDataset(Dataset):
    """
    Each item is a full time series for one sample n:
        X[:, n, :] with shared time vector t[:]
    """

    def __init__(self, X: np.ndarray, t: np.ndarray):
        assert X.ndim == 3 and t.ndim == 1
        self.X = X.astype(np.float32)   # [T, N, D]
        self.t = t.astype(np.float32)   # [T]
        self.T, self.N, self.D = X.shape

    def __len__(self):
        return self.N

    def __getitem__(self, n: int):
        return {
            'x_seq': torch.from_numpy(self.X[:, n, :]),  # [T, D]
            't_seq': torch.from_numpy(self.t)            # [T]
        }


def collate_sequences(batch):
    """
    Collate function: stack sequences into [B, T, D] and [B, T].
    """
    x = torch.stack([b['x_seq'] for b in batch], dim=0)  # [B, T, D]
    t = torch.stack([b['t_seq'] for b in batch], dim=0)  # [B, T]
    return {'x_seq': x, 't_seq': t}
