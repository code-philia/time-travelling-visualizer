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
from influence_function.ContrastiveLoss import ContrastiveLossWrapper

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

@torch.inference_mode()
def calc_pair_loss(
    model: nn.Module,
    criterion: ContrastiveLossWrapper,
    data: List[Tuple[torch.Tensor, torch.Tensor]],
    is_positive: bool
) -> np.ndarray:
    loss_all = []
    model.eval()
    
    # TODO: batch processing
    with torch.no_grad():
        for doc_inputs, code_inputs in tqdm(data, desc="Computing pair losses"):
            doc_inputs = doc_inputs.to(next(model.parameters()).device)
            code_inputs = code_inputs.to(next(model.parameters()).device)
            
            doc_inputs = doc_inputs.unsqueeze(0) if doc_inputs.dim() == 1 else doc_inputs
            code_inputs = code_inputs.unsqueeze(0) if code_inputs.dim() == 1 else code_inputs
            
            losses = criterion(model, doc_inputs, code_inputs, is_positive_pair=is_positive)
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

def grad_pair_loss(
    model: nn.Module,
    criterion: ContrastiveLossWrapper,
    doc_inputs: torch.Tensor,
    code_inputs: torch.Tensor,
    is_positive: bool,
    param_filter_fn: Callable[[str, nn.Parameter], bool] = None
) -> List[torch.Tensor]:
    model.eval()

    named_params = list(model.named_parameters())
    if param_filter_fn:
        selected_params = [p for n, p in named_params if param_filter_fn(n, p) and p.requires_grad]
    else:
        selected_params = [p for _, p in named_params if p.requires_grad]

    code_inputs = code_inputs.to(next(model.parameters()).device)
    doc_inputs = doc_inputs.to(next(model.parameters()).device)
    
    model.zero_grad()
    with torch.set_grad_enabled(True):
        loss = criterion(model, doc_inputs, code_inputs, is_positive_pair=is_positive).sum()
        grad_this = grad(loss, selected_params, create_graph=False)
        
    return [g.detach().cpu() for g in grad_this]

def hvp(loss, params, v):
    """
    Computes the Hessian-vector product H·v for a given loss and parameters.
    """
    grad = torch.autograd.grad(loss, params, create_graph=True, retain_graph=True)
    return torch.autograd.grad(grad, params, grad_outputs=v, retain_graph=True)

def inverse_hessian_product(
    model,
    criterion,
    v,
    dl_tr,
    param_filter_fn=None,
    damping=0.01,
    recursion_depth=1000,
    tol=1e-8
):
    """
    Computes the inverse Hessian-vector product H⁻¹·v using the conjugate gradient algorithm.
    """
    params = [p for name, p in model.named_parameters() if (param_filter_fn is None or param_filter_fn(name, p)) and p.requires_grad]
    
    def hvp_fn(vec):
        # Compute the Hessian-vector product for the current model state
        model.zero_grad()
        
        # We need to compute the loss over the entire training set for an accurate HVP
        total_loss = 0
        num_samples = 0
        for inputs, targets in dl_tr:
            outputs = model(inputs)
            loss = criterion(outputs, targets).mean()
            total_loss += loss * inputs.size(0)
            num_samples += inputs.size(0)
        
        avg_loss = total_loss / num_samples

        hv_product = hvp(avg_loss, params, vec)
        # Apply damping
        return [p + damping * v_p for p, v_p in zip(hv_product, vec)]

    # Conjugate gradient algorithm
    x = [torch.zeros_like(p) for p in params]
    r = [v_p.clone() for v_p in v]
    p = [r_p.clone() for r_p in r]
    rs_old = sum(torch.dot(r_p.flatten(), r_p.flatten()) for r_p in r)

    for i in range(recursion_depth):
        Ap = hvp_fn(p)
        alpha = rs_old / sum(torch.dot(p_p.flatten(), Ap_p.flatten()) for p_p, Ap_p in zip(p, Ap))
        
        x = [x_p + alpha * p_p for x_p, p_p in zip(x, p)]
        r = [r_p - alpha * Ap_p for r_p, Ap_p in zip(r, Ap)]
        
        rs_new = sum(torch.dot(r_p.flatten(), r_p.flatten()) for r_p in r)
        if torch.sqrt(rs_new) < tol:
            break
            
        p = [r_p + (rs_new / rs_old) * p_p for r_p, p_p in zip(r, p)]
        rs_old = rs_new
        
    return x