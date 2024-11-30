import numpy as np
import torch
import tqdm
import math
import logging

# ================ other help funcs ================
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