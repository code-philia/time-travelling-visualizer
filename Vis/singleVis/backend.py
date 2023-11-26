"""
backend APIs for Single Visualization model trainer
"""
# import modules
import torch
import time
import numpy as np
from scipy.special import softmax
from pynndescent import NNDescent
import scipy


def get_graph_elements(graph_, n_epochs):
    """
    gets elements of graphs, weights, and number of epochs per edge
    Parameters
    ----------
    graph_ : scipy.sparse.csr.csr_matrix
        umap graph of probabilities
    n_epochs : int
        maximum number of epochs per edge
    Returns
    -------
    graph scipy.sparse.csr.csr_matrix
        umap graph
    epochs_per_sample np.array
        number of epochs to train each sample for
    head np.array
        edge head
    tail np.array
        edge tail
    weight np.array
        edge weight
    n_vertices int
        number of verticies in graph
    """
    ### should we remove redundancies () here??
    # graph_ = remove_redundant_edges(graph_)

    graph = graph_.tocoo()
    # eliminate duplicate entries by summing them together
    graph.sum_duplicates()
    # number of vertices in dataset
    n_vertices = graph.shape[1]
    # # get the number of epochs based on the size of the dataset
    if n_epochs is None:
        # For smaller datasets we can use more epochs
        if graph.shape[0] <= 10000:
            n_epochs = 500
        else:
            n_epochs = 200
    # remove elements with very low probability
    if len(graph.data) >0:
        graph.data[graph.data < (graph.data.max() / float(n_epochs)) + 1e-3] = 0.0
        graph.eliminate_zeros()

    head = graph.row
    tail = graph.col
    #! normalization
    # weight = graph.data*n_epochs
    weight = graph.data

    return graph, head, tail, weight, n_vertices






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

# def compute_cross_entropy_tf(
#         probabilities_graph, probabilities_distance, EPS=1e-4, repulsion_strength=1.0
# ):
#     attraction_term = - probabilities_graph * tf.math.log(tf.clip_by_value(probabilities_distance, clip_value_min=EPS, clip_value_max=1.0))
#     repellent_term = (
#             -(1.0 - probabilities_graph)
#             * tf.math.log(tf.clip_by_value(1.0 - probabilities_distance, clip_value_min=EPS, clip_value_max=1.0))
#             * repulsion_strength
#     )

#     # balance the expected losses between attraction and repel
#     CE = attraction_term + repellent_term
#     return attraction_term, repellent_term, CE


def find_neighbor_preserving_rate(prev_data, train_data, n_neighbors):
    """
    neighbor preserving rate, (0, 1)
    :param prev_data: ndarray, shape(N,2) low dimensional embedding from last epoch
    :param train_data: ndarray, shape(N,2) low dimensional embedding from current epoch
    :param n_neighbors:
    :return alpha: ndarray, shape (N,)
    """
    if prev_data is None:
        return np.zeros(len(train_data))
    # number of trees in random projection forest
    n_trees = min(64, 5 + int(round((train_data.shape[0]) ** 0.5 / 20.0)))
    # max number of nearest neighbor iters to perform
    n_iters = max(5, int(round(np.log2(train_data.shape[0]))))
    # distance metric
    metric = "euclidean"

    # get nearest neighbors
    nnd = NNDescent(
        train_data,
        n_neighbors=n_neighbors,
        metric=metric,
        n_trees=n_trees,
        n_iters=n_iters,
        max_candidates=60,
        verbose=False
    )
    train_indices, _ = nnd.neighbor_graph
    prev_nnd = NNDescent(
        prev_data,
        n_neighbors=n_neighbors,
        metric="euclidean",
        n_trees=n_trees,
        n_iters=n_iters,
        max_candidates=60,
        verbose=False
    )
    prev_indices, _ = prev_nnd.neighbor_graph
    temporal_pres = np.zeros(len(train_data))
    for i in range(len(train_indices)):
        pres = np.intersect1d(train_indices[i], prev_indices[i])
        temporal_pres[i] = len(pres) / float(n_neighbors)
    return temporal_pres


def get_attention(model, data, device, temperature=.01, verbose=1):
    t0 = time.time()
    grad_list = []

    for i in range(len(data)):
        b = torch.from_numpy(data[i:i + 1]).to(device=device, dtype=torch.float)
        b.requires_grad = True
        out = model(b)
        top1 = torch.argsort(out)[0][-1]
        out[0][top1].backward()
        grad_list.append(b.grad.data.detach().cpu().numpy())
    grad_list2 = []

    for i in range(len(data)):
        b = torch.from_numpy(data[i:i + 1]).to(device=device, dtype=torch.float)
        b.requires_grad = True
        out = model(b)
        top2 = torch.argsort(out)[0][-2]
        out[0][top2].backward()
        grad_list2.append(b.grad.data.detach().cpu().numpy())
    t1 = time.time()
    grad1 = np.array(grad_list)
    grad2 = np.array(grad_list2)
    grad1 = grad1.squeeze(axis=1)
    grad2 = grad2.squeeze(axis=1)
    grad = np.abs(grad1) + np.abs(grad2)
    grad = softmax(grad/temperature, axis=1)
    t2 = time.time()
    if verbose:
        print("Gradients calculation: {:.2f} seconds\tsoftmax with temperature: {:.2f} seconds".format(round(t1-t0), round(t2-t1)))
    return grad
