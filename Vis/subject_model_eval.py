########################################################################################################################
#                                                          IMPORT                                                      #
########################################################################################################################
import torch
import sys
import os
import json
import time
import numpy as np
import argparse

from umap.umap_ import find_ab_params

from singleVis.SingleVisualizationModel import VisModel
from singleVis.losses import UmapLoss, ReconstructionLoss, SingleVisLoss
from singleVis.eval.evaluator import Evaluator
from singleVis.data import NormalDataProvider

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

# get workspace dir
current_path = os.getcwd()

parent_path = os.path.dirname(current_path)

new_path = os.path.join(parent_path, 'training_dynamic')

parser.add_argument('--content_path', type=str,default=new_path)
parser.add_argument('--start', type=int)
parser.add_argument('--end', type=int)
# parser.add_argument('--epoch_end', type=int)
parser.add_argument('--epoch_period', type=int,default=1)
parser.add_argument('--preprocess', type=int,default=0)
args = parser.parse_args()

CONTENT_PATH = args.content_path
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
GPU_ID = 0
EPOCH_START = config["EPOCH_START"]
EPOCH_END = config["EPOCH_END"]
EPOCH_PERIOD = config["EPOCH_PERIOD"]

EPOCH_START = args.start
EPOCH_END = args.end
EPOCH_PERIOD = args.epoch_period

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

VIS_MODEL_NAME = 'vis' ### saved_as 

EVALUATION_NAME = VISUALIZATION_PARAMETER["EVALUATION_NAME"]

# Define hyperparameters
DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

import Model.model as subject_model
net = eval("subject_model.{}()".format(NET))

########################################################################################################################
#                                                    TRAINING SETTING                                                  #
########################################################################################################################
# Define data_provider
data_provider = NormalDataProvider(CONTENT_PATH, net, EPOCH_START, EPOCH_END, EPOCH_PERIOD, device=DEVICE, epoch_name='Epoch',classes=CLASSES,verbose=1)

Evaluation_NAME = 'subject_model_eval'

def save_epoch_eval_for_subject_model (n_epoch, file_name="evaluation"):
        # save result
        save_dir = os.path.join(data_provider.model_path)
        save_file = os.path.join(save_dir, file_name + ".json")
        if not os.path.exists(save_file):
            evaluation = dict()
        else:
            f = open(save_file, "r")
            evaluation = json.load(f)
            f.close()

        if "train_acc" not in evaluation.keys():
            evaluation["train_acc"] = dict()
        if "test_acc" not in evaluation.keys():
            evaluation["test_acc"] = dict()
        
        epoch_key = str(n_epoch)
        evaluation["train_acc"][epoch_key] = train_acc(n_epoch)
        evaluation["test_acc"][epoch_key] = test_acc(n_epoch)

        with open(save_file, "w") as f:
            json.dump(evaluation, f)
        print("Successfully evaluated the subject model, and the results are saved in {}".format(save_file))

def train_acc(epoch):
        data = data_provider.train_representation(epoch)
        data = data.reshape(data.shape[0], data.shape[1])
        labels = data_provider.train_labels(epoch)
        pred = data_provider.get_pred(epoch, data).argmax(1)
        return np.sum(labels==pred)/len(labels)
    
def test_acc(epoch):
        data = data_provider.test_representation(epoch)
        data = data.reshape(data.shape[0], data.shape[1])
        labels = data_provider.test_labels(epoch)
        pred = data_provider.get_pred(epoch, data).argmax(1)
        return np.sum(labels==pred)/len(labels)

for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
    save_epoch_eval_for_subject_model(i,file_name="{}".format(Evaluation_NAME))