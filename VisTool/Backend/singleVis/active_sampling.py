import numpy as np

def random_sampling(n_pool, idxs_lb, acc_idxs, rej_idxs, NUM_QUERY):
    curr_selected = np.concatenate((idxs_lb, acc_idxs), axis=0)
    curr_selected = np.concatenate((curr_selected, rej_idxs), axis=0)
    idxs_ulb = np.setdiff1d(np.arange(n_pool), curr_selected)
    selected = np.random.choice(idxs_ulb, size=NUM_QUERY, replace=False)
    return selected, np.ones(selected.shape[0])

def uncerainty_sampling(n_pool, idxs_lb, acc_idxs, rej_idxs, NUM_QUERY, uncertainty):
    curr_selected = np.concatenate((idxs_lb, acc_idxs), axis=0)
    curr_selected = np.concatenate((curr_selected, rej_idxs), axis=0)
    idxs_ulb = np.setdiff1d(np.arange(n_pool), curr_selected)
    uncertainty_ulb = uncertainty[idxs_ulb]
    idxs = np.argsort(uncertainty_ulb)[-NUM_QUERY:]
    scores = uncertainty_ulb[idxs]
    selected = idxs_ulb[idxs]
    return selected, scores
    