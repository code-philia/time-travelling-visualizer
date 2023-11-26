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
from singleVis.SingleVisualizationModel import SingleVisualizationModel
from singleVis.losses import HybridLoss, SmoothnessLoss, UmapLoss, ReconstructionLoss
from singleVis.edge_dataset import HybridDataHandler
from singleVis.trainer import HybridVisTrainer
from singleVis.data import DenseActiveLearningDataProvider
from singleVis.spatial_edge_constructor import kcHybridDenseALSpatialEdgeConstructor
from singleVis.temporal_edge_constructor import GlobalTemporalEdgeConstructor
from singleVis.projector import DenseALProjector
from singleVis.segmenter import DenseALSegmenter
########################################################################################################################
#                                                    VISUALIZATION SETTING                                             #
########################################################################################################################
VIS_METHOD= "DeepDebugger"
########################################################################################################################
#                                                     LOAD PARAMETERS                                                  #
########################################################################################################################
parser = argparse.ArgumentParser(description='Process hyperparameters...')
parser.add_argument('--content_path', type=str)
parser.add_argument('-g', type=str)
parser.add_argument('-i', type=int)
parser.add_argument('--epoch_num', type=int)
args = parser.parse_args()

CONTENT_PATH = args.content_path
GPU_ID = args.g
epoch_num = args.epoch_num
iteration = args.i 

# record output information
now = time.strftime("%Y-%m-%d-%H_%M_%S", time.localtime(time.time())) 
sys.stdout = open(os.path.join(CONTENT_PATH, "Model", "Iteration_{}".format(iteration), now+".txt"), "w")

sys.path.append(CONTENT_PATH)
with open(os.path.join(CONTENT_PATH, "config.json"), "r") as f:
    conf = json.load(f)
config = conf[VIS_METHOD]

SETTING = config["SETTING"]
CLASSES = config["CLASSES"]
DATASET = config["DATASET"]

# Training parameter (subject model)
TRAINING_PARAMETER = config["TRAINING"]
NET = TRAINING_PARAMETER["NET"]
BASE_ITERATION =config["BASE_ITERATION"]

# Training parameter (visualization model)
VISUALIZATION_PARAMETER = config["VISUALIZATION"]
PREPROCESS = VISUALIZATION_PARAMETER["PREPROCESS"]
LAMBDA = VISUALIZATION_PARAMETER["LAMBDA"]
S_LAMBDA = VISUALIZATION_PARAMETER["S_LAMBDA"]
B_N_EPOCHS = VISUALIZATION_PARAMETER["BOUNDARY"]["B_N_EPOCHS"]
L_BOUND = VISUALIZATION_PARAMETER["BOUNDARY"]["L_BOUND"]
INIT_NUM = VISUALIZATION_PARAMETER["INIT_NUM"]
ALPHA = VISUALIZATION_PARAMETER["ALPHA"]
BETA = VISUALIZATION_PARAMETER["BETA"]
MAX_HAUSDORFF = VISUALIZATION_PARAMETER["MAX_HAUSDORFF"]
ENCODER_DIMS = VISUALIZATION_PARAMETER["ENCODER_DIMS"]
DECODER_DIMS = VISUALIZATION_PARAMETER["DECODER_DIMS"]
S_N_EPOCHS = VISUALIZATION_PARAMETER["S_N_EPOCHS"]
T_N_EPOCHS = VISUALIZATION_PARAMETER["T_N_EPOCHS"]
N_NEIGHBORS = VISUALIZATION_PARAMETER["N_NEIGHBORS"]
PATIENT = VISUALIZATION_PARAMETER["PATIENT"]
MAX_EPOCH = VISUALIZATION_PARAMETER["MAX_EPOCH"]

# define hyperparameters
DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

import Model.model as subject_model
net = eval("subject_model.{}()".format(NET))

data_provider = DenseActiveLearningDataProvider(CONTENT_PATH, net, BASE_ITERATION, epoch_num, device=DEVICE, classes=CLASSES,verbose=1)
if PREPROCESS:
    data_provider._meta_data(iteration)

model = VisModel(ENCODER_DIMS, DECODER_DIMS)
negative_sample_rate = 5
min_dist = .1
_a, _b = find_ab_params(1.0, min_dist)
umap_loss_fn = UmapLoss(negative_sample_rate, DEVICE, _a, _b, repulsion_strength=1.0)
recon_loss_fn = ReconstructionLoss(beta=1.0)
smooth_loss_fn = SmoothnessLoss(margin=0.25)
criterion = HybridLoss(umap_loss_fn, recon_loss_fn, smooth_loss_fn, lambd1=LAMBDA, lambd2=S_LAMBDA)
segmenter = DenseALSegmenter(data_provider=data_provider, threshold=78.5, epoch_num=epoch_num)


# segment epoch
t0 = time.time()
SEGMENTS = segmenter.segment(iteration)
t1 = time.time()
RESUME_SEG = len(SEGMENTS)
print(SEGMENTS)
# SEGMENTS = [(1, 2), (2, 21), (21, 52), (52, 74), (74, 95), (95, 117), (117, 200)]

segment_path = os.path.join(CONTENT_PATH, "Model", "Iteration_{}".format(iteration),"segments.json")
with open(segment_path, "w") as f:
    json.dump(SEGMENTS, f)

projector = DenseALProjector(vis_model=model, content_path=CONTENT_PATH, vis_model_name="al_hybrid", device=DEVICE)

LEN = data_provider.label_num(iteration)
prev_selected = np.random.choice(np.arange(LEN), size=INIT_NUM, replace=False)
prev_embedding = None
start_point = len(SEGMENTS)-1
c0=None
d0=None

for seg in range(start_point,-1,-1):
    epoch_start, epoch_end = SEGMENTS[seg]
    data_provider.update_interval(epoch_s=epoch_start, epoch_e=epoch_end)

    optimizer = torch.optim.Adam(model.parameters(), lr=.01, weight_decay=1e-5)
    lr_scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=.1)

    t2 = time.time()
    spatial_cons = kcHybridDenseALSpatialEdgeConstructor(data_provider=data_provider, init_num=INIT_NUM, s_n_epochs=S_N_EPOCHS, b_n_epochs=B_N_EPOCHS, n_neighbors=N_NEIGHBORS, MAX_HAUSDORFF=MAX_HAUSDORFF, ALPHA=ALPHA, BETA=BETA, iteration=iteration, init_idxs=prev_selected, init_embeddings=prev_embedding, c0=c0, d0=d0)
    s_edge_to, s_edge_from, s_probs, feature_vectors, embedded, coefficient, time_step_nums, time_step_idxs_list, knn_indices, sigmas, rhos, attention, (c0,d0) = spatial_cons.construct()

    temporal_cons = GlobalTemporalEdgeConstructor(X=feature_vectors, time_step_nums=time_step_nums, sigmas=sigmas, rhos=rhos, n_neighbors=N_NEIGHBORS, n_epochs=T_N_EPOCHS)
    t_edge_to, t_edge_from, t_probs = temporal_cons.construct()
    t3 = time.time()

    edge_to = np.concatenate((s_edge_to, t_edge_to),axis=0)
    edge_from = np.concatenate((s_edge_from, t_edge_from), axis=0)
    probs = np.concatenate((s_probs, t_probs), axis=0)
    probs = probs / (probs.max()+1e-3)
    eliminate_zeros = probs>1e-3
    edge_to = edge_to[eliminate_zeros]
    edge_from = edge_from[eliminate_zeros]
    probs = probs[eliminate_zeros]

    # save result
    save_dir = os.path.join(data_provider.model_path, "Iteration_{}".format(iteration), "SV_time_al_hybrid.json")
    if not os.path.exists(save_dir):
        evaluation = dict()
    else:
        f = open(save_dir, "r")
        evaluation = json.load(f)
        f.close()
    if "complex_construction" not in evaluation.keys():
        evaluation["complex_construction"] = dict()
    evaluation["complex_construction"][str(seg)] = round(t3-t2, 3)
    with open(save_dir, 'w') as f:
        json.dump(evaluation, f)
    print("constructing timeVis complex for {}-th segment in {:.1f} seconds.".format(seg, t3-t2))


    dataset = HybridDataHandler(edge_to, edge_from, feature_vectors, attention, embedded, coefficient)
    n_samples = int(np.sum(S_N_EPOCHS * probs) // 1)
    # chosse sampler based on the number of dataset
    if len(edge_to) > 2^24:
        sampler = CustomWeightedRandomSampler(probs, n_samples, replacement=True)
    else:
        sampler = WeightedRandomSampler(probs, n_samples, replacement=True)
    edge_loader = DataLoader(dataset, batch_size=1000, sampler=sampler)

    ########################################################################################################################
    #                                                       TRAIN                                                          #
    ########################################################################################################################

    trainer = HybridVisTrainer(model, criterion, optimizer, lr_scheduler,edge_loader=edge_loader, DEVICE=DEVICE)

    t2=time.time()
    trainer.train(PATIENT, MAX_EPOCH)
    t3 = time.time()
    # save result
    save_dir = os.path.join(data_provider.model_path, "Iteration_{}".format(iteration), "SV_time_al_hybrid.json")
    if not os.path.exists(save_dir):
        evaluation = dict()
    else:
        f = open(save_dir, "r")
        evaluation = json.load(f)
        f.close()
    
    if "training" not in evaluation.keys():
        evaluation["training"] = dict()
    evaluation["training"][str(seg)] = round(t3-t2, 3)
    with open(save_dir, 'w') as f:
        json.dump(evaluation, f)
    trainer.save(save_dir=os.path.join(data_provider.model_path, "Iteration_{}".format(iteration)), file_name="al_hybrid_{}".format(seg))
    model = trainer.model

    # update prev_idxs and prev_embedding
    prev_selected = time_step_idxs_list[0]
    prev_data = torch.from_numpy(feature_vectors[:len(prev_selected)]).to(dtype=torch.float32, device=DEVICE)
    model.to(device=DEVICE)
    prev_embedding = model.encoder(prev_data).cpu().detach().numpy()


