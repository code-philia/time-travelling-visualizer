#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations
import random
from typing import Any

import numpy as np
import torch

# ===================== Global AMP / cuDNN setup =====================

torch.backends.cudnn.benchmark = True
try:
    # Allow TF32 matmul on Ampere+ GPUs
    torch.set_float32_matmul_precision("high")
except Exception:
    pass


def maybe_compile(m: torch.nn.Module) -> torch.nn.Module:
    """Wrap torch.compile if available; fallback to original module otherwise."""
    try:
        return torch.compile(m)
    except Exception:
        return m


def amp_capabilities() -> tuple[bool, bool]:
    """Check whether bf16 / fp16 AMP is available."""
    use_bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    use_fp16 = torch.cuda.is_available()
    return use_bf16, use_fp16


USE_BF16, USE_FP16 = amp_capabilities()
AMP_DTYPE = torch.bfloat16 if USE_BF16 else (torch.float16 if USE_FP16 else None)
SCALER = (
    None
    if (AMP_DTYPE is None or AMP_DTYPE == torch.bfloat16)
    else torch.cuda.amp.GradScaler()
)


def seed_all(seed: int = 42) -> None:
    """Seed Python, NumPy, and PyTorch (CPU/GPU)."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def exists(x: Any) -> bool:
    return x is not None


def l2_regularization(
    models,
    lambda_reg: float = 1e-4,
    include_bias: bool = False,
    include_norm: bool = False,
) -> torch.Tensor:
    """
    Compute L2 regularization term for a model or a list of models.

    - By default, biases and normalization layers (BN/LN etc.) are skipped,
      which is a common practice in modern architectures.
    - If no trainable parameters are found, returns a scalar zero on the
      currently available device.
    """
    if not isinstance(models, (list, tuple)):
        models = [models]

    l2_term = None  # used to determine device on first parameter
    for m in models:
        for name, p in m.named_parameters(recurse=True):
            if not p.requires_grad:
                continue
            # Skip bias parameters
            if (not include_bias) and name.endswith("bias"):
                continue
            # Skip 1-D norm parameters or names containing norm/bn/ln
            if (not include_norm) and (
                p.ndim == 1
                or "norm" in name.lower()
                or "bn" in name.lower()
                or "layernorm" in name.lower()
                or "ln" in name.lower()
            ):
                continue

            term = p.pow(2).sum()
            l2_term = term if l2_term is None else (l2_term + term)

    if l2_term is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        return torch.zeros((), device=device)

    return lambda_reg * l2_term
