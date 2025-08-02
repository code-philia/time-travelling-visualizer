#! /usr/bin/env python3
import torch
from torch import nn
import numpy as np
import torch.nn.functional as F
import math
import pickle
import torch
from torch.autograd import grad
from tqdm import tqdm
from torch.utils.data import DataLoader
from typing import List, Tuple, Union, Callable

@torch.inference_mode()
def calc_loss(model: nn.Module,
              criterion: nn.Module,
              dl: Union[DataLoader, Tuple[torch.Tensor, torch.Tensor]],
    ) -> np.ndarray:
    '''
    Compute L for each sample in the dataset

    Arguments:
        model: torch.nn.Module
        criterion: loss function (output, target) -> scalar loss
        dl: dataloader or a tuple of (input, target)
        param_filter_fn: Optional function to select subset of parameters
                         e.g. lambda name, param: 'last_layer' in name
    Returns:
        loss_all: np.ndarray – loss of selected params
    '''
    loss_all = []
    model.eval()

    if isinstance(dl, tuple) and len(dl) == 2:
        iterable = [dl]
    else:
        iterable = dl

    with torch.no_grad():
        for inputs, targets in tqdm(iterable, desc="Computing losses"):
            inputs = inputs.to(next(model.parameters()).device)
            targets = targets.to(next(model.parameters()).device)

            outputs = model(inputs)
            losses = criterion(outputs, targets)  # must be reduction='none'
            loss_all.extend(losses.detach().cpu().numpy())

    return np.array(loss_all)

def grad_loss(model: nn.Module,
              criterion: nn.Module,
              dl: Union[DataLoader, Tuple[torch.Tensor, torch.Tensor]],
              param_filter_fn: Callable[[str, nn.Parameter], bool] = None
    ) -> List[List[torch.Tensor]]:
    '''
    Compute dL/dθ for each sample in the dataset

    Arguments:
        model: torch.nn.Module
        criterion: loss function (output, target) -> scalar loss
        dl: dataloader or a tuple of (input, target)
        param_filter_fn: Optional function to select subset of parameters
                         e.g. lambda name, param: 'last_layer' in name

    Returns:
        grad_all: List[List[Tensor]] – each inner list contains gradients of selected params for one sample
    '''
    grad_all = []
    model.eval()

    # Get parameters to differentiate
    named_params = list(model.named_parameters())
    if param_filter_fn is not None:
        selected_params = [p for n, p in named_params if param_filter_fn(n, p) and p.requires_grad]
    else:
        selected_params = [p for _, p in named_params if p.requires_grad]

    # Prepare iterable: DataLoader or single (input, target) pair
    if isinstance(dl, tuple) and len(dl) == 2:
        iterable = [dl]
    else:
        iterable = dl

    for inputs, targets in tqdm(iterable, desc="Computing gradients"):
        inputs = inputs.to(next(model.parameters()).device)
        targets = targets.to(next(model.parameters()).device)

        model.zero_grad()
        with torch.set_grad_enabled(True):
            output = model(inputs)
            loss = criterion(output, targets).sum()
            grad_this = grad(loss, selected_params, create_graph=False)
            grad_all.append([g.detach().cpu() for g in grad_this])

    return grad_all

