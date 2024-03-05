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
from singleVis.losses import HybridLoss, SmoothnessLoss, UmapLoss, ReconstructionLoss
from singleVis.edge_dataset import HybridDataHandler
from singleVis.trainer import HybridVisTrainer
from singleVis.data import NormalDataProvider
from singleVis.spatial_edge_constructor import kcHybridSpatialEdgeConstructor
from singleVis.temporal_edge_constructor import GlobalTemporalEdgeConstructor
from singleVis.projector import DeepDebuggerProjector
from singleVis.segmenter import Segmenter
from singleVis.visualizer import visualizer
from singleVis.eval.evaluator import Evaluator

########################################################################################################################
#                                                    VISUALIZATION SETTING                                             #
########################################################################################################################
VIS_METHOD= "DeepDebugger"
########################################################################################################################
#                                                     LOAD PARAMETERS                                                  #
########################################################################################################################
parser = argparse.ArgumentParser(description='Process hyperparameters...')
parser.add_argument('--content_path', type=str)
args = parser.parse_args()

CONTENT_PATH = args.content_path
sys.path.append(CONTENT_PATH)
with open(os.path.join(CONTENT_PATH, "config.json"), "r") as f:
    conf = json.load(f)
config = conf[VIS_METHOD]

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

VIS_MODEL_NAME = VISUALIZATION_PARAMETER["VIS_MODEL_NAME"]
EVALUATION_NAME = VISUALIZATION_PARAMETER["EVALUATION_NAME"]

# define hyperparameters
DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

import Model.model as subject_model
net = eval("subject_model.{}()".format(NET))

########################################################################################################################
#                                                    TRAINING SETTING                                                  #
########################################################################################################################
data_provider = NormalDataProvider(CONTENT_PATH, net, EPOCH_START, EPOCH_END, EPOCH_PERIOD, device=DEVICE, classes=CLASSES,verbose=1)
if PREPROCESS:
    data_provider._meta_data()
    if B_N_EPOCHS >0:
        data_provider._estimate_boundary(LEN//10, l_bound=L_BOUND)
        
model = VisModel(ENCODER_DIMS, DECODER_DIMS)

segmenter = Segmenter(data_provider=data_provider, threshold=78.5, range_s=EPOCH_START, range_e=EPOCH_END, range_p=EPOCH_PERIOD)

# # segment epoch
t0 = time.time()
SEGMENTS = segmenter.segment()
t1 = time.time()
segmenter.record_time(data_provider.model_path, "time_{}.json".format(VIS_MODEL_NAME), t1-t0)
print("Segmentation takes {:.1f} seconds.".format(round(t1-t0, 3)))
RESUME_SEG = len(SEGMENTS)
config["VISUALIZATION"]["SEGMENTS"] = SEGMENTS
config["VISUALIZATION"]["RESUME_SEG"] = len(SEGMENTS)
# write back to config
conf[VIS_METHOD] = config
with open(os.path.join(CONTENT_PATH, "config.json"), "w") as f:
    json.dump(conf, f)

projector = DeepDebuggerProjector(vis_model=model, content_path=CONTENT_PATH, vis_model_name=VIS_MODEL_NAME, segments=SEGMENTS, device=DEVICE)
########################################################################################################################
#                                                       TRAINING                                                       #
########################################################################################################################
negative_sample_rate = 5
min_dist = .1
_a, _b = find_ab_params(1.0, min_dist)
umap_loss_fn = UmapLoss(negative_sample_rate, DEVICE, _a, _b, repulsion_strength=1.0)
recon_loss_fn = ReconstructionLoss(beta=1.0)
smooth_loss_fn = SmoothnessLoss(margin=0.5)
criterion = HybridLoss(umap_loss_fn, recon_loss_fn, smooth_loss_fn, lambd1=LAMBDA, lambd2=S_LAMBDA)

# Resume from a checkpoint
if RESUME_SEG in range(len(SEGMENTS)):
    prev_epoch = SEGMENTS[RESUME_SEG][0]
    with open(os.path.join(data_provider.content_path, "selected_idxs", "selected_{}.json".format(prev_epoch)), "r") as f:
        prev_selected = json.load(f)
    with open(os.path.join(data_provider.content_path, "selected_idxs", "baseline.json".format(prev_epoch)), "r") as f:
        c0, d0 = json.load(f)
    save_model_path = os.path.join(data_provider.model_path, "{}_{}.pth".format(VIS_MODEL_NAME, RESUME_SEG))
    save_model = torch.load(save_model_path, map_location=torch.device("cpu"))
    model.load_state_dict(save_model["state_dict"])
    prev_data = torch.from_numpy(data_provider.train_representation(prev_epoch)[prev_selected]).to(dtype=torch.float32)
    start_point = RESUME_SEG - 1
    prev_embedding = model.encoder(prev_data).detach().numpy()
    print("Resume from {}-th segment with {} points...".format(RESUME_SEG, len(prev_embedding)))
else: 
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

    t0 = time.time()
    spatial_cons = kcHybridSpatialEdgeConstructor(data_provider=data_provider, init_num=INIT_NUM, s_n_epochs=S_N_EPOCHS, b_n_epochs=B_N_EPOCHS, n_neighbors=N_NEIGHBORS, MAX_HAUSDORFF=MAX_HAUSDORFF, ALPHA=ALPHA, BETA=BETA, init_idxs=prev_selected, init_embeddings=prev_embedding, c0=c0, d0=d0)
    s_edge_to, s_edge_from, s_probs, feature_vectors, embedded, coefficient, time_step_nums, time_step_idxs_list, knn_indices, sigmas, rhos, attention, (c0,d0) = spatial_cons.construct()

    temporal_cons = GlobalTemporalEdgeConstructor(X=feature_vectors, time_step_nums=time_step_nums, sigmas=sigmas, rhos=rhos, n_neighbors=N_NEIGHBORS, n_epochs=T_N_EPOCHS)
    t_edge_to, t_edge_from, t_probs = temporal_cons.construct()
    t1 = time.time()

    edge_to = np.concatenate((s_edge_to, t_edge_to),axis=0)
    edge_from = np.concatenate((s_edge_from, t_edge_from), axis=0)
    probs = np.concatenate((s_probs, t_probs), axis=0)
    probs = probs / (probs.max()+1e-3)
    eliminate_zeros = probs>1e-3
    edge_to = edge_to[eliminate_zeros]
    edge_from = edge_from[eliminate_zeros]
    probs = probs[eliminate_zeros]

    dataset = HybridDataHandler(edge_to, edge_from, feature_vectors, attention, embedded, coefficient)
    n_samples = int(np.sum(S_N_EPOCHS * probs) // 1)
    # chose sampler based on the number of dataset
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

    save_dir = data_provider.model_path
    trainer.record_time(save_dir, "time_{}".format(VIS_MODEL_NAME), "complex_construction", seg, t1-t0)
    print("constructing timeVis complex for {}-th segment in {:.1f} seconds.".format(seg,t1-t0))
    trainer.record_time(save_dir, "time_{}".format(VIS_MODEL_NAME), "training", seg, t3-t2)

    trainer.save(save_dir=save_dir, file_name="{}_{}".format(VIS_MODEL_NAME, seg))
    model = trainer.model

    # update prev_idxs and prev_embedding
    prev_selected = time_step_idxs_list[0]
    prev_data = torch.from_numpy(feature_vectors[:len(prev_selected)]).to(dtype=torch.float32, device=DEVICE)
    model.to(device=DEVICE)
    prev_embedding = model.encoder(prev_data).cpu().detach().numpy()


########################################################################################################################
#                                                      VISUALIZATION                                                   #
########################################################################################################################
vis = visualizer(data_provider, projector, 200)
save_dir = os.path.join(data_provider.content_path, "img")
os.makedirs(save_dir, exist_ok=True)

for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
    vis.savefig(i, path=os.path.join(save_dir, "{}_{}_{}.png".format(DATASET, i, VIS_METHOD)))
########################################################################################################################
#                                                       EVALUATION                                                     #
########################################################################################################################
# eval_epochs = range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD)
EVAL_EPOCH_DICT = {
    "mnist":[1,10,15],
    "fmnist":[1,25,50],
    "cifar10":[1,100,199]
}
eval_epochs = EVAL_EPOCH_DICT[DATASET]

evaluator = Evaluator(data_provider, projector)
for eval_epoch in eval_epochs:
    evaluator.save_epoch_eval(eval_epoch, 15, temporal_k=5, file_name="{}".format(EVALUATION_NAME))
    