import torch
import sys
sys.path.append('..')
import os
import json
import time
import numpy as np
import argparse

from torch.utils.data import DataLoader
from torch.utils.data import WeightedRandomSampler
from umap.umap_ import find_ab_params

from singleVis.custom_weighted_random_sampler import CustomWeightedRandomSampler
from singleVis.SingleVisualizationModel import VisModel

from singleVis.data import NormalDataProvider

# from singleVis.spatial_skeleton_edge_constructor import ProxyBasedSpatialEdgeConstructor

from singleVis.projector import DVIProjector
from singleVis.utils import find_neighbor_preserving_rate

########################################################################################################################
#                                                     DVI PARAMETERS                                                   #
########################################################################################################################
"""This serve as an example of DeepVisualInsight implementation in pytorch."""
VIS_METHOD = "DVI" # DeepVisualInsight

########################################################################################################################
#                                                     LOAD PARAMETERS                                                  #
########################################################################################################################

parser = argparse.ArgumentParser(description='Process hyperparameters...')
parser.add_argument('--content_path', type=str, default='/home/yifan/datasets/CIFAR10_Clean')
parser.add_argument('--epoch' , type=int, default=3)

args = parser.parse_args()
# get workspace dir
epoch = args.epoch

CONTENT_PATH = args.content_path
sys.path.append(CONTENT_PATH)
with open(os.path.join(CONTENT_PATH, "config.json"), "r") as f:
    config = json.load(f)
config = config[VIS_METHOD]

SETTING = config["SETTING"]
CLASSES = config["CLASSES"]
DATASET = config["DATASET"]
PREPROCESS = config["VISUALIZATION"]["PREPROCESS"]
GPU_ID = config["GPU"]
EPOCH_START = config["EPOCH_START"]
EPOCH_END = config["EPOCH_END"]
EPOCH_PERIOD = config["EPOCH_PERIOD"]

EPOCH_START = epoch
EPOCH_END = epoch

# Training parameter (subject model)
TRAINING_PARAMETER = config["TRAINING"]
NET = TRAINING_PARAMETER["NET"]
LEN = TRAINING_PARAMETER["train_num"]

# Training parameter (visualization model)
VISUALIZATION_PARAMETER = config["VISUALIZATION"]
LAMBDA1 = 1
LAMBDA2 = VISUALIZATION_PARAMETER["LAMBDA2"]
B_N_EPOCHS = 0
L_BOUND = VISUALIZATION_PARAMETER["BOUNDARY"]["L_BOUND"]
ENCODER_DIMS = VISUALIZATION_PARAMETER["ENCODER_DIMS"]
DECODER_DIMS = VISUALIZATION_PARAMETER["DECODER_DIMS"]

S_N_EPOCHS = VISUALIZATION_PARAMETER["S_N_EPOCHS"]
N_NEIGHBORS = VISUALIZATION_PARAMETER["N_NEIGHBORS"]
PATIENT = VISUALIZATION_PARAMETER["PATIENT"]

VIS_MODEL_NAME = 'trustbase' ### saved_as VIS_MODEL_NAME.pth


# Define hyperparameters
GPU_ID = 0
DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")
print("device", DEVICE)

import Model.model as subject_model
net = eval("subject_model.{}()".format(NET))


data_provider = NormalDataProvider(CONTENT_PATH, net, EPOCH_START, EPOCH_END, EPOCH_PERIOD, device=DEVICE, epoch_name='Epoch',classes=CLASSES,verbose=1)


# Define visualization models
model = VisModel(ENCODER_DIMS, DECODER_DIMS)
projector = DVIProjector(vis_model=model, content_path=CONTENT_PATH, vis_model_name=VIS_MODEL_NAME, device=DEVICE)

train_data = data_provider.train_representation(epoch)

train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])

emb = projector.batch_project(epoch, train_data )
recon_data = projector.batch_inverse(epoch, emb)
pred_org = data_provider.get_pred(epoch, train_data).argmax(axis=1)
pred_recon = data_provider.get_pred(epoch, recon_data).argmax(axis=1)
error_indices = []
for i in range(len(emb)):
    if pred_org[i] != pred_recon[i]:
        error_indices.append(i)

print('error:',len(error_indices))

from pynndescent import NNDescent
n_trees = min(64, 5 + int(round((train_data.shape[0]) ** 0.5 / 20.0)))
# max number of nearest neighbor iters to perform
n_iters = max(5, int(round(np.log2(train_data.shape[0]))))
# distance metric
# # get nearest neighbors
        
nnd = NNDescent(
            train_data,
            n_neighbors=15,
            metric='euclidean',
            n_trees=n_trees,
            n_iters=n_iters,
            max_candidates=60,
            verbose=True
)
knn_indices, knn_dists = nnd.neighbor_graph

erro_knn = knn_indices[error_indices]
diff_list = []
print(erro_knn.shape)
for i in range(len(erro_knn)):
    point_index = error_indices[i]
    erro_knn_indexs = erro_knn[i]
    pred_list  = pred_org[erro_knn_indexs]
    pred_org[point_index] 
    # Count the number of differences
    num_differences_rate = sum(1 for pred in pred_list if pred != pred_org[point_index]) / 14
    diff_list.append(num_differences_rate)
print(diff_list)