import os, sys
import numpy as np
import torch
import json
import time
import pickle
import argparse
from scipy.special import softmax

from singleVis.SingleVisualizationModel import VisModel
from singleVis.data import ActiveLearningDataProvider
from singleVis.projector import TimeVisProjector,tfDVIProjector
from singleVis.trajectory_manager import Recommender

parser = argparse.ArgumentParser()
parser.add_argument('--dataset', type=str, choices=["CIFAR10","MNIST","FMNIST"])
parser.add_argument('--rate', type=int, choices=[30,10,20])
parser.add_argument("--method", type=str,choices=["tfDVI","TimeVis"])
parser.add_argument("-g", default="0")
args = parser.parse_args()

# tensorflow
visible_device = "1,2,3"
os.environ["CUDA_VISIBLE_DEVICES"] = visible_device

DATASET = args.dataset
RATE = args.rate
VIS_METHOD = args.method
GPU_ID = args.g

CONTENT_PATH = "/home/xianglin/projects/DVI_data/active_learning/random/resnet18/{}/{}".format(DATASET, RATE)
sys.path.append(CONTENT_PATH)
with open(os.path.join(CONTENT_PATH, "config.json"), "r") as f:
    config = json.load(f)
config = config[VIS_METHOD]

CLASSES = config["CLASSES"]
if GPU_ID is None:
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
ENCODER_DIMS = VISUALIZATION_PARAMETER["ENCODER_DIMS"]
DECODER_DIMS = VISUALIZATION_PARAMETER["DECODER_DIMS"]
VIS_MODEL_NAME = VISUALIZATION_PARAMETER["VIS_MODEL_NAME"]

# define hyperparameters
DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

import Model.model as subject_model
net = eval("subject_model.{}()".format(NET))
data_provider = ActiveLearningDataProvider(CONTENT_PATH, net, EPOCH_START,device=DEVICE, classes=CLASSES, iteration_name="Epoch")

if VIS_METHOD == "tfDVI":
    # Define Projector
    flag = "_temporal_id_withoutB"
    projector = tfDVIProjector(CONTENT_PATH, flag=flag)
elif VIS_METHOD == "TimeVis":
    model = VisModel(ENCODER_DIMS, DECODER_DIMS)
    projector = TimeVisProjector(vis_model=model, content_path=CONTENT_PATH, vis_model_name=VIS_MODEL_NAME, device=DEVICE)

# uncertainty
samples = data_provider.train_representation_all(EPOCH_END)
pred = data_provider.get_pred(EPOCH_END, samples)
confidence = np.amax(softmax(pred, axis=1), axis=1)
uncertainty = 1-confidence
print("Saving uncertainty...")

# embedding trajectories
TOTOAL_EPOCH = (EPOCH_END-EPOCH_START)//EPOCH_PERIOD + 1

samples = np.zeros((TOTOAL_EPOCH, LEN, 512))
for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
    e = (i-EPOCH_START)//EPOCH_PERIOD
    samples[e] = data_provider.train_representation_all(i)

embeddings_2d = np.zeros((TOTOAL_EPOCH, LEN, 2))
for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
    e = (i-EPOCH_START)//EPOCH_PERIOD
    embeddings_2d[e] = projector.batch_project(i, samples[e])
embeddings_2d = np.transpose(embeddings_2d, [1,0,2])
print("Saving trajectory embeddings...")

labels = data_provider.train_labels_all(EPOCH_END)

path = os.path.join(CONTENT_PATH, "Model", "{}_trajectory_embeddings.npy".format(VIS_METHOD))
np.save(path,embeddings_2d)
# path = os.path.join(CONTENT_PATH, "Model", "Iteration_{}".format(iteration),"trajectory_embeddings.npy")
# embeddings_2d = np.load(path)

# remove label data
lb_idxs = data_provider.get_labeled_idx(EPOCH_END)
ulb_idxs = data_provider.get_unlabeled_idx(LEN, lb_idxs)

ulb_uncertainty = uncertainty[ulb_idxs]
ulb_trajectory = embeddings_2d[ulb_idxs]

t_start = time.time()
tm = Recommender(ulb_uncertainty, ulb_trajectory, cls_num=30, period=int(TOTOAL_EPOCH*2/3))
tm.clustered()
t_end = time.time()
with open(os.path.join(CONTENT_PATH,  '{}_sample_recommender.pkl'.format(VIS_METHOD)), 'wb') as f:
    pickle.dump(tm, f, pickle.HIGHEST_PROTOCOL)
if os.path.exists(os.path.join(CONTENT_PATH,  'feedback.json')):
    with open(os.path.join(CONTENT_PATH,  'feedback.json'), 'r') as f:
        run_time = json.load(f)
else:
    run_time = dict()
run_time["{}".format(VIS_METHOD)] = round(t_end-t_start, 4)
with open(os.path.join(CONTENT_PATH,  'feedback.json'), 'w') as f:
    json.dump(run_time, f)

print("Active learning:\n Saving results for {}/{}/{}".format(DATASET, RATE, VIS_METHOD))
