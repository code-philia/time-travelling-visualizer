
import numpy as np
def if_border(data):
    norm_preds = norm(data)

    sort_preds = np.sort(norm_preds, axis=1)
    diff = sort_preds[:, -1] - sort_preds[:, -2]
    border = np.zeros(len(diff), dtype=np.uint8) + 0.05
    border[diff < 0.15] = 1
        
    return border

def critical_prediction_flip(ref_pred, tar_pred):
    critical_prediction_flip_list = []
    for i in range(len(ref_pred)):
        if ref_pred[i] != tar_pred[i]:
            critical_prediction_flip_list.append(i)
    return critical_prediction_flip_list
            
def critical_border_flip(ref_data, tar_data):
    critical_border_flip_list = []
    ref_border_list = if_border(ref_data)
    tar_border_list = if_border(tar_data)
    for i in range(len(ref_border_list)):
        if ref_border_list[i] != tar_border_list[i]:
            critical_border_flip_list.append(i)
    return critical_border_flip_list

def norm(x):
    exp_x = np.exp(x - np.max(x, axis=1, keepdims=True))
    return exp_x / exp_x.sum(axis=1, keepdims=True)