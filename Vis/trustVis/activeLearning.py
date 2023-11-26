"""
explore and expliot 

"""
########################################################################################################################
#                                                          IMPORT                                                      #
########################################################################################################################
import torch
import sys
import os
import json
import numpy as np
sys.path.append('..')

from singleVis.SingleVisualizationModel import VisModel

from singleVis.data import NormalDataProvider

from singleVis.projector import DVIProjector
from singleVis.eval.evaluator import Evaluator

VIS_METHOD = "DVI" # DeepVisualInsight

########################################################################################################################
#                                                     LOAD PARAMETERS                                                  #
########################################################################################################################
import argparse
parser = argparse.ArgumentParser(description='Process hyperparameters...')

parser.add_argument('--content_path', type=str)
parser.add_argument('--epoch', type=int)
parser.add_argument('--base', type=str)

parser.add_argument('--name', type=str)



args = parser.parse_args()
epoch = args.epoch
base_model = args.base
save_name = args.name

CONTENT_PATH= args.content_path
print("CONTENT_PATH",CONTENT_PATH)


sys.path.append(CONTENT_PATH)
with open(os.path.join(CONTENT_PATH, "config.json"), "r") as f:
    config = json.load(f)
config = config[VIS_METHOD]

# record output information
# now = time.strftime("%Y-%m-%d-%H_%M_%S", time.localtime(time.time())) 
# sys.stdout = open(os.path.join(CONTENT_PATH, now+".txt"), "w")

SETTING = config["SETTING"]
CLASSES = config["CLASSES"]
DATASET = config["DATASET"]
PREPROCESS = config["VISUALIZATION"]["PREPROCESS"]
GPU_ID = config["GPU"]
EPOCH_START = config["EPOCH_START"]
EPOCH_END = config["EPOCH_END"]
EPOCH_PERIOD = config["EPOCH_PERIOD"]

# Training parameter (subject model)
TRAINING_PARAMETER = config["TRAINING"]
NET = TRAINING_PARAMETER["NET"]
LEN = TRAINING_PARAMETER["train_num"]

# Training parameter (visualization model)
VISUALIZATION_PARAMETER = config["VISUALIZATION"]
LAMBDA1 = VISUALIZATION_PARAMETER["LAMBDA1"]
LAMBDA2 = VISUALIZATION_PARAMETER["LAMBDA2"]
B_N_EPOCHS = VISUALIZATION_PARAMETER["BOUNDARY"]["B_N_EPOCHS"]
L_BOUND = VISUALIZATION_PARAMETER["BOUNDARY"]["L_BOUND"]
ENCODER_DIMS = VISUALIZATION_PARAMETER["ENCODER_DIMS"]
DECODER_DIMS = VISUALIZATION_PARAMETER["DECODER_DIMS"]
S_N_EPOCHS = VISUALIZATION_PARAMETER["S_N_EPOCHS"]
N_NEIGHBORS = VISUALIZATION_PARAMETER["N_NEIGHBORS"]
PATIENT = VISUALIZATION_PARAMETER["PATIENT"]
MAX_EPOCH = VISUALIZATION_PARAMETER["MAX_EPOCH"]

VIS_MODEL_NAME = VISUALIZATION_PARAMETER["VIS_MODEL_NAME"]
EVALUATION_NAME = VISUALIZATION_PARAMETER["EVALUATION_NAME"]



# VIS_MODEL_NAME = 'dvi_grid'

# Define hyperparameters
DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

import Model.model as subject_model
net = eval("subject_model.{}()".format(NET))

# Define data_provider
data_provider = NormalDataProvider(CONTENT_PATH, net, EPOCH_START, EPOCH_END, EPOCH_PERIOD, device=DEVICE, epoch_name='Epoch',classes=CLASSES,verbose=1)


# Define visualization models
model = VisModel(ENCODER_DIMS, DECODER_DIMS)

# Define Projector
projector = DVIProjector(vis_model=model, content_path=CONTENT_PATH, vis_model_name=VIS_MODEL_NAME, device=DEVICE)    

########################################################################################################################
#                                                      VISUALIZATION                                                   #
########################################################################################################################

from singleVis.visualizer import visualizer

vis = visualizer(data_provider, projector, 200, "tab10")
save_dir = os.path.join(data_provider.content_path, "imgptDVI")
if not os.path.exists(save_dir):
    os.mkdir(save_dir)





from singleVis.SingleVisualizationModel import VisModel
from singleVis.spatial_edge_constructor import SingleEpochSpatialEdgeConstructorForGrid

pre_model = VisModel(ENCODER_DIMS, DECODER_DIMS)
file_path = os.path.join(CONTENT_PATH, "Model", "Epoch_{}".format(epoch), "{}.pth".format(base_model))
save_model = torch.load(file_path, map_location="cpu")
pre_model.load_state_dict(save_model["state_dict"])
pre_model.to(DEVICE)

"""get high dimensional grid, 2d grid embedding and border vector"""

projector = DVIProjector(vis_model=model, content_path=CONTENT_PATH, vis_model_name=base_model, device=DEVICE)  
em1 = projector.batch_project(epoch, np.concatenate((data_provider.train_representation(epoch),data_provider.border_representation(epoch) )))

em1_rev = projector.batch_inverse(epoch, em1)

vis = visualizer(data_provider, projector, 200, "tab10")
grid_high, grid_emd ,border = vis.get_epoch_decision_view(epoch,400,None, True)
train_data_embedding = projector.batch_project(epoch, data_provider.train_representation(epoch))
from sklearn.neighbors import NearestNeighbors
import numpy as np

threshold = 2  # 阈值
# 使用 train_data_embedding 初始化 NearestNeighbors 对象
nbrs = NearestNeighbors(n_neighbors=1, algorithm='ball_tree').fit(train_data_embedding)
# 对于 grid_emd 中的每一个点，找到 train_data_embedding 中离它最近的点
distances, indices = nbrs.kneighbors(grid_emd)
mask = distances.ravel() < threshold
###### grid二维所有距离training data小于阈值的sample
selected_indices = np.arange(grid_emd.shape[0])[mask]
###### grid二维所有被放在边界的点
border_indices = np.arange(grid_emd.shape[0])[border==1]

union_indices = np.union1d(selected_indices, border_indices)


########## import skeleton

from trustVis.skeleton_generator import CenterSkeletonGenerator
skeleton_generator = CenterSkeletonGenerator(data_provider,epoch,3,3,100)
high_bom = skeleton_generator.center_skeleton_genertaion()


##########  FIND ERROR  2D:grid_emd[selected_indices] INVERSE_HIGH: grid_high[selected_indices]
# grid_emd[selected_indices], grid_high[selected_indices] 只关心离training data足够近的grid
new_grid_emd = projector.batch_project( epoch, grid_high[selected_indices])
new_inv = projector.batch_inverse( epoch, new_grid_emd)

#### error condition: 
# 1. || new_grid_emd[selected_indices] -  grid_emd[selected_indices]) > a  
# 2. || pred(grid_high[selected_indices]) - pred(new_inv) || > b
