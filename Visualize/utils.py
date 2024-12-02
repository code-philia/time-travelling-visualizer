import numpy as np
import torch
import tqdm
import math
import logging

# ================ help funcs ================
def get_feature_num(data):
    if len(data.shape) == 2:
        return 1
    else:
        return data.shape[1]
    

def batch_run_feature_extract(feat_func, data, device = None, batch_size=64, desc="feature_extraction"):
    """
    Func: batch run for feature extraction, using feature function, get high dimension features

    Notice:
        num of input may be more than 1
        num of feature may be more than 1

    Args:
        data: [num_train, num_inputs, input_length]
            or[num_train, input_length]
        
    Returns:
        np.ndarray: high dimension features
    """
    if len(data.shape) == 2:
        data.unsqueeze_(1)
        
    num_inputs = data.shape[1]

    print("data shape:",data.shape)

    if device!=None:
        data = data.to(device)
    output = None
    n_batches = max(math.ceil(len(data) / batch_size), 1)

    for b in tqdm.tqdm(range(n_batches),desc=desc, leave=True):
        r1, r2 = b * batch_size, (b + 1) * batch_size
        batch_data = data[r1:r2]
        batch_inputs = [batch_data[:,j,:] for j in range(num_inputs)]
        with torch.no_grad():
            pred = feat_func(*batch_inputs)
            
            if isinstance(pred, tuple):
                #(code_feature, nl_feature)
                pred = np.stack([feat.cpu().numpy() for feat in pred], axis = 1)
            else:
                #(feature)
                pred = pred.cpu().numpy()

        if output is None:
            output = pred
        else:
            output = np.concatenate((output, pred), axis=0)
    return output


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
    from pynndescent import NNDescent
    # get nearest neighbors
    nnd = NNDescent(
        train_data,
        n_neighbors=n_neighbors,
        metric="euclidean",
        n_trees=n_trees,
        n_iters=n_iters,
        max_candidates=60,
        verbose=True
    )
    train_indices, _ = nnd.neighbor_graph
    prev_nnd = NNDescent(
        prev_data,
        n_neighbors=n_neighbors,
        metric="euclidean",
        n_trees=n_trees,
        n_iters=n_iters,
        max_candidates=60,
        verbose=True
    )
    prev_indices, _ = prev_nnd.neighbor_graph
    temporal_pres = np.zeros(len(train_data))
    for i in range(len(train_indices)):
        pres = np.intersect1d(train_indices[i], prev_indices[i])
        temporal_pres[i] = len(pres) / float(n_neighbors)
    return temporal_pres