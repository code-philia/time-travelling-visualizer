#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations
from dataclasses import dataclass
from typing import Tuple

import torch


@dataclass
class HParams:
    # Basic dims
    D: int = 512        # High-dimensional embedding dim
    d: int = 2          # Low-dimensional visualization dim
    bs: int = 32        # Batch size (= number of samples, each with a full time series)

    # Learning rates & epochs
    lr_ae: float = 1e-3
    lr_joint: float = 1.5e-4
    epochs_ae: int = 20
    epochs_joint: int = 60

    # Device
    device: str = "cuda" if torch.cuda.is_available() else "cpu"

    # Loss weights (Stage 2)
    lambda_rec: float = 1.0
    lambda_dir: float = 1.5
    lambda_rank: float = 0.8

    # Direction consistency (local multi-scale)
    dir_windows: Tuple[int, ...] = (2, 4, 8)
    dir_betas: Tuple[float, ...] = (0.5, 0.5, 0.5)   # kept for signature compatibility
    dir_min_step_norm: float = 1e-4

    # Top-3 ranking margin (speed ranking)
    rank_margin_top_order: float = 0.02
    rank_margin_top_vs_rest: float = 0.01

    # Speed distribution KL (soft ranking)
    kl_weight: float = 0.5
    kl_tau_start: float = 0.7
    kl_tau_end: float = 0.25
    kl_weighted_by_p: bool = True   # whether to weight KL by target distribution p

    # Training details
    warmup_epochs: int = 16
    grad_clip: float = 0.5

    # L2 regularization toggle
    use_l2: bool = False

    # Normalization configuration
    # ['global','anchor0','robust','per_epoch','center_only']
    norm_mode: str = "robust"
    std_clip_low: float = 1e-8
    std_clip_high: float = 0.0

    # Data paths
    data_path: str = (
        "your_data_path_here"
    )
    ckpt_dir: str = (
        "your_data_path_here"
    )
