import torch
import sys
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
from singleVis.losses import SingleVisLoss, UmapLoss, ReconstructionLoss
from singleVis.edge_dataset import DataHandler
from singleVis.trainer import SingleVisTrainer
from singleVis.data import ActiveLearningDataProvider
from singleVis.eval.evaluator import ALEvaluator
from singleVis.spatial_edge_constructor import SingleEpochSpatialEdgeConstructor
from singleVis.projector import ALProjector
########################################################################################################################
#                                                     DVI PARAMETERS                                                   #
########################################################################################################################
"""This serve as an example of DeepVisualInsight implementation in pytorch."""
VIS_METHOD = "DVIAL" # DeepVisualInsight

########################################################################################################################
#                                                     LOAD PARAMETERS                                                  #
########################################################################################################################
parser = argparse.ArgumentParser(description='Process hyperparameters...')
parser.add_argument('--content_path', type=str)
parser.add_argument('-g',"--gpu_id", type=int, default=0)
parser.add_argument('-i',"--iteration", type=int)
parser.add_argument("--resume", type=int, default=-1, help="Resume from which iteration.")

args = parser.parse_args()
CONTENT_PATH = args.content_path
GPU_ID = args.gpu_id
iteration = int(args.iteration)
resume_iter = int(args.resume)

content_path = CONTENT_PATH
sys.path.append(content_path)

with open(os.path.join(CONTENT_PATH, "config.json"), "r") as f:
    config = json.load(f)
config = config[VIS_METHOD]
# from config import config

SETTING = config["SETTING"] # active learning
CLASSES = config["CLASSES"]
DATASET = config["DATASET"]
BASE_ITERATION =config["BASE_ITERATION"]
DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

#################################################   VISUALIZATION PARAMETERS    ########################################
PREPROCESS = config["VISUALIZATION"]["PREPROCESS"]
B_N_EPOCHS = config["VISUALIZATION"]["BOUNDARY"]["B_N_EPOCHS"]
L_BOUND = config["VISUALIZATION"]["BOUNDARY"]["L_BOUND"]
LAMBDA = config["VISUALIZATION"]["LAMBDA"]
ENCODER_DIMS = config["VISUALIZATION"]["ENCODER_DIMS"]
DECODER_DIMS = config["VISUALIZATION"]["DECODER_DIMS"]
N_NEIGHBORS = config["VISUALIZATION"]["N_NEIGHBORS"]
MAX_EPOCH = config["VISUALIZATION"]["MAX_EPOCH"]
S_N_EPOCHS = config["VISUALIZATION"]["S_N_EPOCHS"]
PATIENT = config["VISUALIZATION"]["PATIENT"]
VIS_MODEL_NAME = config["VISUALIZATION"]["VIS_MODEL_NAME"]
RESOLUTION = config["VISUALIZATION"]["RESOLUTION"]
EVALUATION_NAME = config["VISUALIZATION"]["EVALUATION_NAME"]

############################################   ACTIVE LEARNING MODEL PARAMETERS    ######################################
TRAINING_PARAMETERS = config["TRAINING"]
NET = TRAINING_PARAMETERS["NET"]

import Model.model as subject_model
net = eval("subject_model.{}()".format(NET))
########################################################################################################################
#                                                    TRAINING SETTING                                                  #
########################################################################################################################
data_provider = ActiveLearningDataProvider(content_path, net, BASE_ITERATION, device=DEVICE, classes=CLASSES, verbose=1)
if PREPROCESS:
    data_provider._meta_data(iteration)
    LEN = len(data_provider.train_labels(iteration))
    if B_N_EPOCHS >0:
        data_provider._estimate_boundary(iteration, LEN//10, l_bound=L_BOUND)

model = VisModel(ENCODER_DIMS, DECODER_DIMS)
projector = ALProjector(vis_model=model, content_path=CONTENT_PATH, vis_model_name=VIS_MODEL_NAME, device=DEVICE)
if resume_iter > 0:
    projector.load(resume_iter)
########################################################################################################################
#                                                    EDGE DATASET                                                      #
########################################################################################################################
t0 = time.time()
spatial_cons = SingleEpochSpatialEdgeConstructor(data_provider, iteration, 5, 0, 15)
edge_to, edge_from, probs, feature_vectors, attention = spatial_cons.construct()
t1 = time.time()

probs = probs / (probs.max()+1e-3)
eliminate_zeros = probs>1e-3
edge_to = edge_to[eliminate_zeros]
edge_from = edge_from[eliminate_zeros]
probs = probs[eliminate_zeros]

# save result
save_dir = os.path.join(data_provider.model_path, "time_al.json")
if not os.path.exists(save_dir):
    evaluation = dict()
else:
    f = open(save_dir, "r")
    evaluation = json.load(f)
    f.close()
if "complex_construction" not in evaluation.keys():
    evaluation["complex_construction"] = dict()
evaluation["complex_construction"][str(iteration)] = round(t1-t0, 3)
with open(save_dir, 'w') as f:
    json.dump(evaluation, f)
print("constructing complex in {:.1f} seconds.".format(t1-t0))


dataset = DataHandler(edge_to, edge_from, feature_vectors, attention)
n_samples = int(np.sum(S_N_EPOCHS * probs) // 1)
# chosse sampler based on the number of dataset
if len(edge_to) > pow(2,24):
    sampler = CustomWeightedRandomSampler(probs, n_samples, replacement=True)
else:
    sampler = WeightedRandomSampler(probs, n_samples, replacement=True)
edge_loader = DataLoader(dataset, batch_size=1024, sampler=sampler)

########################################################################################################################
#                                                       TRAIN                                                          #
########################################################################################################################
negative_sample_rate = 5
min_dist = .1
_a, _b = find_ab_params(1.0, min_dist)
umap_loss_fn = UmapLoss(negative_sample_rate, DEVICE, _a, _b, repulsion_strength=1.0)
recon_loss_fn = ReconstructionLoss(beta=1.0)
criterion = SingleVisLoss(umap_loss_fn, recon_loss_fn, lambd=LAMBDA)

optimizer = torch.optim.Adam(model.parameters(), lr=.01, weight_decay=1e-5)
lr_scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=.1)

trainer = SingleVisTrainer(model, criterion, optimizer, lr_scheduler,edge_loader=edge_loader, DEVICE=DEVICE)
t2=time.time()
trainer.train(PATIENT, MAX_EPOCH)
t3 = time.time()
# save result
save_dir = os.path.join(data_provider.model_path, "time_al.json")
if not os.path.exists(save_dir):
    evaluation = dict()
else:
    f = open(save_dir, "r")
    evaluation = json.load(f)
    f.close()
if  "training" not in evaluation.keys():
    evaluation["training"] = dict()
evaluation["training"][str(iteration)] = round(t3-t2, 3)
with open(save_dir, 'w') as f:
    json.dump(evaluation, f)
save_dir = os.path.join(data_provider.model_path, "Iteration_{}".format(iteration))
os.makedirs(save_dir, exist_ok=True)
trainer.save(save_dir=save_dir, file_name=VIS_MODEL_NAME)
    
########################################################################################################################
#                                                       EVALUATION                                                     #
########################################################################################################################

evaluator = ALEvaluator(data_provider, projector)
evaluator.save_epoch_eval(iteration, file_name=EVALUATION_NAME)

########################################################################################################################
#                                                      VISUALIZATION                                                   #
########################################################################################################################

# from singleVis.visualizer import visualizer
# vis = visualizer(data_provider, projector, 200)
# save_dir = os.path.join(data_provider.content_path, "img")
# os.makedirs(save_dir, exist_ok=True)
# data = data_provider.train_representation(iteration)
# pred = data_provider.get_pred(iteration, data).argmax(1)
# labels = data_provider.train_labels(iteration)
# vis.savefig_cus(iteration, data, pred, labels, path=os.path.join(save_dir, "{}_{}_al.png".format(DATASET, iteration)))
