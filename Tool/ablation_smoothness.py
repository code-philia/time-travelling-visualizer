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
from singleVis.data import NormalDataProvider
from singleVis.spatial_edge_constructor import kcHybridSpatialEdgeConstructor
from singleVis.temporal_edge_constructor import GlobalTemporalEdgeConstructor
from singleVis.projector import Projector
from singleVis.segmenter import Segmenter
########################################################################################################################
#                                                     LOAD PARAMETERS                                                  #
########################################################################################################################
VIS_METHOD = "DeepDebugger" 

parser = argparse.ArgumentParser(description='Process hyperparameters...')
parser.add_argument('--content_path', type=str)
parser.add_argument('--wt', type=int)
args = parser.parse_args()

S_LAMBDA = 0.0
setting = "without_tl" if args.wt else "without_smoothness"


CONTENT_PATH = args.content_path
sys.path.append(CONTENT_PATH)
with open(os.path.join(CONTENT_PATH, "config.json"), "r") as f:
    config = json.load(f)
config = config[VIS_METHOD]

save_dir = os.path.join(CONTENT_PATH, "Model", "{}".format(setting))
os.system("mkdir -p {}".format(save_dir))
# record output information
now = time.strftime("%Y-%m-%d-%H_%M_%S", time.localtime(time.time())) 
sys.stdout = open(os.path.join(save_dir, now+".txt"), "w")

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
LAMBDA = VISUALIZATION_PARAMETER["LAMBDA"]
B_N_EPOCHS = VISUALIZATION_PARAMETER["BOUNDARY"]["B_N_EPOCHS"]
L_BOUND = VISUALIZATION_PARAMETER["BOUNDARY"]["L_BOUND"]
INIT_NUM = VISUALIZATION_PARAMETER["INIT_NUM"]
ALPHA = VISUALIZATION_PARAMETER["ALPHA"]
BETA = VISUALIZATION_PARAMETER["BETA"]
MAX_HAUSDORFF = VISUALIZATION_PARAMETER["MAX_HAUSDORFF"]
HIDDEN_LAYER = VISUALIZATION_PARAMETER["HIDDEN_LAYER"]
S_N_EPOCHS = VISUALIZATION_PARAMETER["S_N_EPOCHS"]
T_N_EPOCHS = VISUALIZATION_PARAMETER["T_N_EPOCHS"]
N_NEIGHBORS = VISUALIZATION_PARAMETER["N_NEIGHBORS"]
PATIENT = VISUALIZATION_PARAMETER["PATIENT"]
MAX_EPOCH = VISUALIZATION_PARAMETER["MAX_EPOCH"]
# SEGMENTS = VISUALIZATION_PARAMETER["SEGMENTS"]
# RESUME_SEG = VISUALIZATION_PARAMETER["RESUME_SEG"]

# define hyperparameters
DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

import Model.model as subject_model
net = eval("subject_model.{}()".format(NET))

########################################################################################################################
#                                                    TRAINING SETTING                                                  #
########################################################################################################################
data_provider = NormalDataProvider(CONTENT_PATH, net, EPOCH_START, EPOCH_END, EPOCH_PERIOD, device=DEVICE, classes=CLASSES,verbose=1)
if PREPROCESS:
    data_provider.initialize(LEN//10, l_bound=L_BOUND)
model = SingleVisualizationModel(input_dims=512, output_dims=2, units=256, hidden_layer=HIDDEN_LAYER)
negative_sample_rate = 5
min_dist = .1
_a, _b = find_ab_params(1.0, min_dist)
umap_loss_fn = UmapLoss(negative_sample_rate, DEVICE, _a, _b, repulsion_strength=1.0)
recon_loss_fn = ReconstructionLoss(beta=1.0)
smooth_loss_fn = SmoothnessLoss(margin=0.25)
criterion = HybridLoss(umap_loss_fn, recon_loss_fn, smooth_loss_fn, lambd1=LAMBDA, lambd2=S_LAMBDA)
segmenter = Segmenter(data_provider=data_provider, threshold=78.5, range_s=EPOCH_START, range_e=EPOCH_END, range_p=EPOCH_PERIOD)


# segment epoch
t0 = time.time()
SEGMENTS = segmenter.segment()
t1 = time.time()
RESUME_SEG = len(SEGMENTS)
print(SEGMENTS)
projector = Projector(vis_model=model, content_path=CONTENT_PATH, segments=SEGMENTS, device=DEVICE)

# save time result
save_file = os.path.join(save_dir, "time_tnn_hybrid.json")
if not os.path.exists(save_file):
    evaluation = dict()
else:
    f = open(save_file, "r")
    evaluation = json.load(f)
    f.close()
evaluation["segment"] = round(t1-t0, 3)
with open(save_file, 'w') as f:
    json.dump(evaluation, f)
print("Segmentation takes {:.1f} seconds.".format(round(t1-t0, 3)))

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
    spatial_cons = kcHybridSpatialEdgeConstructor(data_provider=data_provider, init_num=INIT_NUM, s_n_epochs=S_N_EPOCHS, b_n_epochs=B_N_EPOCHS, n_neighbors=N_NEIGHBORS, MAX_HAUSDORFF=MAX_HAUSDORFF, ALPHA=ALPHA, BETA=BETA, init_idxs=prev_selected, init_embeddings=prev_embedding, c0=c0, d0=d0)
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
    save_file = os.path.join(save_dir, "time_tnn_hybrid.json")
    if not os.path.exists(save_file):
        evaluation = dict()
    else:
        f = open(save_file, "r")
        evaluation = json.load(f)
        f.close()
    if "complex_construction" not in evaluation.keys():
        evaluation["complex_construction"] = dict()
    evaluation["complex_construction"][str(seg)] = round(t3-t2, 3)
    with open(save_file, 'w') as f:
        json.dump(evaluation, f)
    print("constructing complex for {}-th segment in {:.1f} seconds.".format(seg, t3-t2))


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
    save_file = os.path.join(save_dir, "time_tnn_hybrid.json")
    if not os.path.exists(save_file):
        evaluation = dict()
    else:
        f = open(save_file, "r")
        evaluation = json.load(f)
        f.close()
    
    if "training" not in evaluation.keys():
        evaluation["training"] = dict()
    evaluation["training"][str(seg)] = round(t3-t2, 3)
    with open(save_file, 'w') as f:
        json.dump(evaluation, f)
    trainer.save(save_dir=save_dir, file_name="tnn_hybrid_{}".format(seg))
    model = trainer.model

    # update prev_idxs and prev_embedding
    prev_selected = time_step_idxs_list[0]
    prev_data = torch.from_numpy(feature_vectors[:len(prev_selected)]).to(dtype=torch.float32, device=DEVICE)

    model.to(device=DEVICE)
    prev_embedding = model.encoder(prev_data).cpu().detach().numpy()

    if args.wt:
        model = SingleVisualizationModel(input_dims=512, output_dims=2, units=256, hidden_layer=HIDDEN_LAYER)
        model.to(device=DEVICE)
    