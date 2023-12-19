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

from torch.utils.data import DataLoader,ConcatDataset
from torch.utils.data import WeightedRandomSampler
from umap.umap_ import find_ab_params

from singleVis.custom_weighted_random_sampler import CustomWeightedRandomSampler
from singleVis.SingleVisualizationModel import VisModel
from singleVis.losses import UmapLoss, ReconstructionLoss, TemporalLoss, DVILoss, DummyTemporalLoss, BoundaryAwareLoss
from singleVis.edge_dataset import DVIDataHandler
from singleVis.trainer import DVITrainer, TrustTrainer
from singleVis.eval.evaluator import Evaluator
from singleVis.data import NormalDataProvider
from singleVis.spatial_edge_constructor import TrustvisSpatialEdgeConstructor

from singleVis.projector import DVIProjector
from singleVis.utils import find_neighbor_preserving_rate

from trustVis.skeleton_generator import CenterSkeletonGenerator
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
parser.add_argument('--epoch' , type=int)
# parser.add_argument('--start' , type=int,default=0)
# parser.add_argument('--end' , type=int,default=0)
parser.add_argument('--pred' , type=float, default=0.7)
parser.add_argument('--preprocess', type=int,default=0)
args = parser.parse_args()

CONTENT_PATH = args.content_path
sys.path.append(CONTENT_PATH)
with open(os.path.join(CONTENT_PATH, "config.json"), "r") as f:
    config = json.load(f)
config = config[VIS_METHOD]

pred_lambda = args.pred

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
EPOCH_START = args.epoch
EPOCH_END = args.epoch

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

VIS_MODEL_NAME = 'vis' ### saved_as VIS_MODEL_NAME.pth

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
PREPROCESS = args.preprocess
if PREPROCESS:
    data_provider._meta_data()
    if B_N_EPOCHS >0:
        data_provider._estimate_boundary(LEN // 10, l_bound=L_BOUND)

# Define visualization models
model = VisModel(ENCODER_DIMS, DECODER_DIMS)

# Define Losses
negative_sample_rate = 5
min_dist = .1
_a, _b = find_ab_params(1.0, min_dist)
umap_loss_fn = UmapLoss(negative_sample_rate, DEVICE, _a, _b, repulsion_strength=1.0)

# Define Projector
projector = DVIProjector(vis_model=model, content_path=CONTENT_PATH, vis_model_name=VIS_MODEL_NAME, device=DEVICE)


start_flag = 1

prev_model = VisModel(ENCODER_DIMS, DECODER_DIMS)

for iteration in range(EPOCH_START, EPOCH_END+EPOCH_PERIOD, EPOCH_PERIOD):
    # Define DVI Loss
    if start_flag:
        temporal_loss_fn = DummyTemporalLoss(DEVICE)
        recon_loss_fn = ReconstructionLoss(beta=1.0)
        criterion = DVILoss(umap_loss_fn, recon_loss_fn, temporal_loss_fn, lambd1=LAMBDA1, lambd2=0.0,device=DEVICE)
        start_flag = 0
    else:
        # TODO AL mode, redefine train_representation
        prev_data = data_provider.train_representation(iteration-EPOCH_PERIOD)
        prev_data = prev_data.reshape(prev_data.shape[0],prev_data.shape[1])
        curr_data = data_provider.train_representation(iteration)
        curr_data = curr_data.reshape(curr_data.shape[0],curr_data.shape[1])
        t_1= time.time()
        npr = torch.tensor(find_neighbor_preserving_rate(prev_data, curr_data, N_NEIGHBORS)).to(DEVICE)
        t_2= time.time()
     
        temporal_loss_fn = TemporalLoss(w_prev, DEVICE)
        criterion = DVILoss(umap_loss_fn, recon_loss_fn, temporal_loss_fn, lambd1=LAMBDA1, lambd2=LAMBDA2*npr,device=DEVICE)
    # Define training parameters
    optimizer = torch.optim.Adam(model.parameters(), lr=.01, weight_decay=1e-5)
    lr_scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=.1)
    # Define Edge dataset
    
    

    t0 = time.time()
    print("pred_lambda",pred_lambda)
    ##### construct the spitial complex
    spatial_cons = TrustvisSpatialEdgeConstructor(data_provider, iteration, S_N_EPOCHS, B_N_EPOCHS, N_NEIGHBORS, pred_lambda)
    edge_to, edge_from, probs, feature_vectors, attention, b_edge_to, b_edge_from, b_probs = spatial_cons.construct()
    # non-bon be 0
    labels_non_boundary = np.zeros(len(edge_to))
    # bon be 1
    labels_boundary = np.ones(len(b_edge_to))

    t1 = time.time()
    print("length of boundary and pred_Same:",len(b_edge_to), len(edge_to))

    print('complex-construct:', t1-t0)

    probs = probs / (probs.max()+1e-3)
    eliminate_zeros = probs > 1e-3    #1e-3
    edge_to = edge_to[eliminate_zeros]
    edge_from = edge_from[eliminate_zeros]
    probs = probs[eliminate_zeros]
    dataset = DVIDataHandler(edge_to, edge_from, feature_vectors, attention, labels_non_boundary)
    
    n_samples = int(np.sum(S_N_EPOCHS * probs) // 1)
    # chose sampler based on the number of dataset
    if len(edge_to) > pow(2,24):
        sampler = CustomWeightedRandomSampler(probs, n_samples, replacement=True)
    else:
        sampler = WeightedRandomSampler(probs, n_samples, replacement=True)

    edge_loader = DataLoader(dataset, batch_size=2000, sampler=sampler, num_workers=8, prefetch_factor=10)
    
    #################################################### for border start ############################################################
    b_probs = b_probs / (b_probs.max()+1e-3)
    b_eliminate_zeros = b_probs > 1e-3    #1e-3
    b_edge_to = b_edge_to[b_eliminate_zeros]
    b_edge_from = b_edge_from[b_eliminate_zeros]
    b_probs = b_probs[b_eliminate_zeros]

    b_dataset = DVIDataHandler(b_edge_to, b_edge_from, feature_vectors, attention,labels_boundary)
    b_n_samples = int(np.sum(S_N_EPOCHS * b_probs) // 1)
    print("b_n_samples",b_n_samples, n_samples)
    if len(b_edge_to) > pow(2,24):
        b_sampler = CustomWeightedRandomSampler(b_probs, b_n_samples, replacement=True)
    else:
        b_sampler = WeightedRandomSampler(b_probs, b_n_samples, replacement=True)
    
    b_edge_loader = DataLoader(b_dataset, batch_size=2000, sampler=b_sampler, num_workers=8, prefetch_factor=10)

    boundary_loss = BoundaryAwareLoss(umap_loss=umap_loss_fn,device=DEVICE)

    #################################################### for border end  ############################################################

    
    # combined_sampler = ShuffleConcatSampler(dataset, b_dataset, probs, b_probs, n_samples, b_n_samples)
    combined_dataset = ConcatDataset([dataset, b_dataset])
  
    combine_sampler = WeightedRandomSampler(np.concatenate((probs,b_probs),axis=0), n_samples+b_n_samples, replacement=True)
    combined_loader = DataLoader(combined_dataset, batch_size=2000, sampler=combine_sampler, num_workers=8)
    

    ########################################################################################################################
    #                                                       TRAIN                                                          #
    ########################################################################################################################    
    trainer = TrustTrainer(model,criterion, optimizer, lr_scheduler, edge_loader=edge_loader, combined_loader=combined_loader, boundary_loss=boundary_loss, DEVICE=DEVICE)

    t2=time.time()
    trainer.train(PATIENT, MAX_EPOCH, data_provider,iteration)
    t3 = time.time()
    print('training:', t3-t2)
    # save result
    save_dir = data_provider.model_path
    trainer.record_time(save_dir, "time_{}".format(VIS_MODEL_NAME), "complex_construction", str(iteration), t1-t0)
    trainer.record_time(save_dir, "time_{}".format(VIS_MODEL_NAME), "training", str(iteration), t3-t2)
    save_dir = os.path.join(data_provider.model_path, "Epoch_{}".format(iteration))
    trainer.save(save_dir=save_dir, file_name="{}".format(VIS_MODEL_NAME))

    print("Finish epoch {}...".format(iteration))

    prev_model.load_state_dict(model.state_dict())
    for param in prev_model.parameters():
        param.requires_grad = False
    w_prev = dict(prev_model.named_parameters())
    

########################################################################################################################
#                                                      VISUALIZATION                                                   #
########################################################################################################################

from singleVis.visualizer import visualizer
now = time.strftime("%Y-%m-%d-%H_%M_%S", time.localtime(time.time())) 
vis = visualizer(data_provider, projector, 200, "tab10")
save_dir = os.path.join(data_provider.content_path, VIS_MODEL_NAME)

if not os.path.exists(save_dir):
    os.mkdir(save_dir)
for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
    vis.savefig(i, path=os.path.join(save_dir, "{}_{}_{}_{}.png".format(DATASET, i, VIS_METHOD,now)))
    train_data = data_provider.train_representation(i)
    train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])

    test_data = data_provider.test_representation(i)
    test_data = test_data.reshape(test_data.shape[0],test_data.shape[1])
    
    data = np.concatenate((train_data,test_data),axis=0)
    ##### save embeddings and background for visualization
    emb = projector.batch_project(i,data)
    np.save(os.path.join(CONTENT_PATH, 'Model', 'Epoch_{}'.format(i), 'embedding.npy'), emb)
    vis.get_background(i,200)


    
########################################################################################################################
#                                                       EVALUATION                                                     #
########################################################################################################################

evaluator = Evaluator(data_provider, projector)

Evaluation_NAME = '{}_eval'.format(VIS_MODEL_NAME)
for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
    evaluator.save_epoch_eval(i, 15, temporal_k=5, file_name="{}".format(Evaluation_NAME))
