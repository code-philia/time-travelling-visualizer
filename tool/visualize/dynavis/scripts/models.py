# models.py
from __future__ import annotations
import math

import torch
import torch.nn as nn
import torch.nn.functional as F


def time_embed(t: torch.Tensor, dim: int = 32) -> torch.Tensor:
    """
    Sinusoidal time embedding.

    Args:
        t: [...], time steps
        dim: embedding dimension
    """
    device = t.device
    half = dim // 2
    freqs = torch.exp(torch.linspace(math.log(1e-4), math.log(1.0), steps=half, device=device))
    ang = t[..., None] * freqs[None, :] * 2 * math.pi
    emb = torch.cat([torch.sin(ang), torch.cos(ang)], dim=-1)
    if dim % 2 == 1:
        emb = F.pad(emb, (0, 1))
    return emb


def make_mlp(in_dim: int, out_dim: int, hidden: int = 256, depth: int = 3, act: str = 'silu') -> nn.Sequential:
    """Simple MLP builder."""
    Act = {'relu': nn.ReLU, 'gelu': nn.GELU, 'silu': nn.SiLU, 'tanh': nn.Tanh}[act]
    layers = []
    d = in_dim
    for _ in range(depth):
        layers += [nn.Linear(d, hidden), Act()]
        d = hidden
    layers += [nn.Linear(d, out_dim)]
    return nn.Sequential(*layers)


class Encoder(nn.Module):
    def __init__(self, dim_x: int, dim_y: int, t_dim: int = 32, hidden: int = 256, depth: int = 3):
        super().__init__()
        self.net = make_mlp(dim_x + t_dim, dim_y, hidden=hidden, depth=depth)
        self.t_dim = t_dim

    def forward(self, x: torch.Tensor, t: torch.Tensor) -> torch.Tensor:
        te = time_embed(t, self.t_dim)
        return self.net(torch.cat([x, te], dim=-1))


class Decoder(nn.Module):
    def __init__(self, dim_y: int, dim_x: int, t_dim: int = 32, hidden: int = 256, depth: int = 3):
        super().__init__()
        self.net = make_mlp(dim_y + t_dim, dim_x, hidden=hidden, depth=depth)
        self.t_dim = t_dim

    def forward(self, y: torch.Tensor, t: torch.Tensor) -> torch.Tensor:
        te = time_embed(t, self.t_dim)
        return self.net(torch.cat([y, te], dim=-1))
