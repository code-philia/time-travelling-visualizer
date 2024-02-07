########################################################################################################################
#                                                          IMPORT                                                      #
########################################################################################################################
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
from singleVis.losses import UmapLoss, ReconstructionLoss, DVILoss, DummyTemporalLoss
from singleVis.edge_dataset import VisDataHandler
from singleVis.trainer import VISTrainer
from singleVis.eval.evaluator import Evaluator
from singleVis.data import NormalDataProvider
from trustVis.sampeling import CriticalSampling
from singleVis.spatial_edge_constructor import Trustvis_SpatialEdgeConstructor, TrustvisTemporalSpatialEdgeConstructor

from singleVis.utils import _construct_fuzzy_complex

from singleVis.projector import VISProjector

import torch.nn.functional as F
########################################################################################################################
#                                                      PARAMETERS                                                   #
########################################################################################################################
"""This serve as an example of DeepVisualInsight implementation in pytorch."""
VIS_METHOD = "DVI" #

########################################################################################################################
#                                                     LOAD PARAMETERS                                                  #
########################################################################################################################


parser = argparse.ArgumentParser(description='Process hyperparameters...')

# get workspace dir
current_path = os.getcwd()

parent_path = os.path.dirname(current_path)

new_path = os.path.join(parent_path, 'training_dynamic')


parser.add_argument('--content_path', type=str)
parser.add_argument('--start', type=int,default=1)
parser.add_argument('--end', type=int,default=3)
# parser.add_argument('--epoch' , type=int)
parser.add_argument('--pred' , type=float, default=0.5)

# parser.add_argument('--epoch_end', type=int)
parser.add_argument('--epoch_period', type=int,default=1)
parser.add_argument('--preprocess', type=int,default=0)
parser.add_argument('--base',type=bool,default=False)
args = parser.parse_args()


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

EPOCH_START = args.start
EPOCH_END = args.end
# EPOCH_START = 1
# EPOCH_END = 50
EPOCH_PERIOD = args.epoch_period

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
MAX_EPOCH = VISUALIZATION_PARAMETER["MAX_EPOCH"]
VIS_MODEL_NAME = 'trustvis_tempo' ### saved_as VIS_MODEL_NAME.pth


# Define hyperparameters
GPU_ID = 0
DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")
print("device", DEVICE)           

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
        data_provider._gen_boundary(LEN // 10)    

# Define visualization models
model = VisModel(ENCODER_DIMS, DECODER_DIMS)


# Define Losses
negative_sample_rate = 5
min_dist = .1
_a, _b = find_ab_params(1.0, min_dist)

# Define Projector
projector = VISProjector(vis_model=model, content_path=CONTENT_PATH, vis_model_name=VIS_MODEL_NAME, device=DEVICE)


start_flag = 1

prev_model = VisModel(ENCODER_DIMS, DECODER_DIMS)

for iteration in range(EPOCH_START, EPOCH_END+EPOCH_PERIOD, EPOCH_PERIOD):
    temporal_k = 2
    while temporal_k != 0:
        # Define DVI Loss
        if start_flag:
            temporal_loss_fn = DummyTemporalLoss(DEVICE)
            recon_loss_fn = ReconstructionLoss(beta=1.0)
            umap_loss_fn = UmapLoss(negative_sample_rate, DEVICE, data_provider, iteration,net, 100, _a, _b,  repulsion_strength=1.0)
            criterion = DVILoss(umap_loss_fn, recon_loss_fn, temporal_loss_fn, lambd1=LAMBDA1, lambd2=0.0,device=DEVICE)
            
            t0 = time.time()
            spatial_cons = Trustvis_SpatialEdgeConstructor(data_provider, iteration, S_N_EPOCHS, B_N_EPOCHS, N_NEIGHBORS, net)
            edge_to, edge_from, probs, pred_probs, feature_vectors, attention = spatial_cons.construct()
            t1 = time.time()
            start_flag = 0
            optimizer = torch.optim.Adam(model.parameters(), lr=.01, weight_decay=1e-5)
            lr_scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=.1)
            temporal_k = 0
        else:
            recon_loss_fn = ReconstructionLoss(beta=1.0)
            umap_loss_fn = UmapLoss(negative_sample_rate, DEVICE, data_provider, iteration,net, 100, _a, _b,  repulsion_strength=1.0)
            c_sampling = CriticalSampling(projector,data_provider,iteration,DEVICE)
            ref_train_data, tar_train_data, pred_origin, pred, inv_pred_origin, inv_pred,new_pred,new_pred_origin, inv_new_pred = c_sampling.get_basic()
            if temporal_k == 2:
                critical_list, critical_data = c_sampling.get_critical(withCritical = True)
            else:
                critical_list, critical_data = c_sampling.get_critical(withCritical = False)


            similarity = F.cosine_similarity(torch.from_numpy(pred_origin).to(device=DEVICE), torch.from_numpy(new_pred_origin).to(device=DEVICE))
            # 计算要找的值的数量（百分之一长度）
            k = int(len(similarity) * 0.2)
            # 使用 topk 函数找到最大的前 k 个值及其索引
            top_values, top_indices = torch.topk(similarity, k)
            top_indices = top_indices.tolist()


            k_neighbors = 15

            knn_indices = _construct_fuzzy_complex(new_pred_origin)
            knn_indices = knn_indices[critical_list]
            knn_indices_flat = knn_indices.flatten()

            diff_list = list(set(knn_indices_flat).union(set(critical_list)))
            diff_data = tar_train_data[diff_list]
            filtered_data = [tar_train_data[i] for i in range(len(tar_train_data)) if i not in top_indices]

            final_list = list(set(diff_list).union(set(top_indices)))
            sim_data = tar_train_data[top_indices]

            t0 = time.time()
            spatial_cons = TrustvisTemporalSpatialEdgeConstructor(data_provider, iteration, S_N_EPOCHS, B_N_EPOCHS, N_NEIGHBORS, net, diff_data=diff_data, sim_data=sim_data)
            t1 = time.time()
            edge_to, edge_from, probs, pred_probs, feature_vectors, attention, knn_indices = spatial_cons.construct()

            # Define training parameters
            temporal_loss_fn = DummyTemporalLoss(DEVICE)
            recon_loss_fn = ReconstructionLoss(beta=1.0)
            # recon_loss_fn = TemporalReconstructionLoss(beta=1.0)
            criterion = DVILoss(umap_loss_fn, recon_loss_fn, temporal_loss_fn, lambd1=3*LAMBDA1, lambd2=0.0,device=DEVICE)
            optimizer = torch.optim.Adam(model.parameters(), lr=.005, weight_decay=1e-5)
            lr_scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=.1)
            temporal_k -= 1
            t_1= time.time()
            # npr = torch.tensor(find_neighbor_preserving_rate(prev_data, curr_data, N_NEIGHBORS)).to(DEVICE)
            t_2= time.time()


        print('complex-construct:', t1-t0)



        pred_list = data_provider.get_pred(iteration, feature_vectors)
        dataset = VisDataHandler(edge_to, edge_from, feature_vectors, attention, pred_probs,pred_list)
        
        n_samples = int(np.sum(S_N_EPOCHS * probs) // 1)
        # chose sampler based on the number of dataset
        if len(edge_to) > pow(2,24):
            sampler = CustomWeightedRandomSampler(pred_probs, n_samples, replacement=True)
        else:
            sampler = WeightedRandomSampler(pred_probs, n_samples, replacement=True)

        edge_loader = DataLoader(dataset, batch_size=2000, sampler=sampler, num_workers=8, prefetch_factor=10)
        

        ########################################################################################################################
        #                                                       TRAIN                                                          #
        ########################################################################################################################

        # trainer = DVITrainer(model, criterion, optimizer, lr_scheduler, edge_loader=edge_loader, DEVICE=DEVICE)
        
        trainer = VISTrainer(model,criterion, optimizer, lr_scheduler, edge_loader=edge_loader, DEVICE=DEVICE)

        t2=time.time()
        trainer.train(PATIENT, MAX_EPOCH,data_provider,iteration)
        # trainer.train(PATIENT, MAX_EPOCH)
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

########################################################################################################################
#                                                       EVALUATION                                                     #
########################################################################################################################
evaluator = Evaluator(data_provider, projector)


Evaluation_NAME = '{}_eval'.format(VIS_MODEL_NAME)
for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
    evaluator.save_epoch_eval(i, 15, temporal_k=5, file_name="{}".format(Evaluation_NAME))
