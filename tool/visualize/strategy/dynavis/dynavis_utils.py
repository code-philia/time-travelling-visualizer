import numpy as np
import torch

def get_graph_elements(graph, n_epochs):
    indices = graph.indices
    indptr = graph.indptr
    data = graph.data

    head = []
    tail = []
    weight = []
    for i in range(len(indptr) - 1):
        start = indptr[i]
        end = indptr[i+1]
        for j in range(start, end):
            head.append(i)
            tail.append(indices[j])
            weight.append(data[j])
    return indices, head, tail, np.array(weight), data

def find_ab_params(spread, min_dist):
    a = 0
    b = 0

    alpha = spread ** 2
    beta = min_dist ** 2

    a = 2.0 * beta / alpha
    b = 2.0 * beta / alpha

    return a, b

"""
def compute_cross_entropy(target, probabilities, repulsion_strength=1.0):
    attraction_loss = -torch.sum(target * torch.log(torch.clamp(probabilities, 1e-12, 1.0)), dim=-1)
    repulsion_loss = -torch.sum((1.0 - target) * torch.log(torch.clamp(1.0 - probabilities, 1e-12, 1.0)), dim=-1)
    return attraction_loss + repulsion_strength * repulsion_loss
"""

def convert_distance_to_probability(distances, a=1.0, b=1.0):
    """convert distance to student-t distribution probability in low-dimensional space"""
    return 1.0 / (1.0 + a * torch.pow(distances, 2 * b))


def compute_cross_entropy(
        probabilities_graph, probabilities_distance, EPS=1e-4, repulsion_strength=1.0
):
    """
    Compute cross entropy between low and high probability
    Parameters
    ----------
    probabilities_graph : torch.Tensor
        high dimensional probabilities
    probabilities_distance : torch.Tensor
        low dimensional probabilities
    EPS : float, optional
        offset to to ensure log is taken of a positive number, by default 1e-4
    repulsion_strength : float, optional
        strength of repulsion between negative samples, by default 1.0
    Returns
    -------
    attraction_term: torch.float
        attraction term for cross entropy loss
    repellent_term: torch.float
        repellent term for cross entropy loss
    cross_entropy: torch.float
        cross entropy umap loss
    """
    attraction_term = - probabilities_graph * torch.log(torch.clamp(probabilities_distance, min=EPS, max=1.0))
    repellent_term = (
            -(1.0 - probabilities_graph)
            * torch.log(torch.clamp(1.0 - probabilities_distance, min=EPS, max=1.0))
            * repulsion_strength
    )

    # balance the expected losses between attraction and repel
    CE = attraction_term + repellent_term
    return attraction_term, repellent_term, CE