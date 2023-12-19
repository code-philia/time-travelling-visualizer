import numpy as np
import os
import torch

from pynndescent import NNDescent
from sklearn.utils import check_random_state
from umap.umap_ import find_ab_params,fuzzy_simplicial_set
from singleVis.backend import get_graph_elements, get_attention
from singleVis.utils import *
from singleVis.trainer import DVITrainer
from singleVis.SingleVisualizationModel import VisModel
from singleVis.losses import UmapLoss, ReconstructionLoss, TemporalLoss, DVILoss, DummyTemporalLoss
from singleVis.projector import DVIProjector
from singleVis.edge_dataset import DVIDataHandler
from torch.utils.data import WeightedRandomSampler
from torch.utils.data import DataLoader

from singleVis.custom_weighted_random_sampler import CustomWeightedRandomSampler

import argparse
parser = argparse.ArgumentParser(description='Process hyperparameters...')
parser.add_argument('--content_path', type=str)
parser.add_argument('--start' , type=int,default=0)
parser.add_argument('--end' , type=int,default=0)
args = parser.parse_args()
content_path = args.content_path
model_path  = os.path.join(content_path)
EPOCH_START = args.start
EPOCH_END = args.end
EPOCH_PERIOD = 1
ENCODER_DIMS= [768,512,256,256,256,256,2]
DECODER_DIMS= [2,256,256,256,256,512,768]
GPU_ID = 0
PATIENT = 5
MAX_EPOCH = 10
Epoch_name = 'ckpt_epc'
S_N_EPOCHS = 5
VIS_MODEL_NAME = 'text'
DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")


#### buld complex ####
def _construct_fuzzy_complex(train_data, n_neighbors=15,metric="euclidean"):
        # """
        # construct a vietoris-rips complex
        # """
        # number of trees in random projection forest
        n_trees = min(64, 5 + int(round((train_data.shape[0]) ** 0.5 / 20.0)))
        # max number of nearest neighbor iters to perform
        n_iters = max(5, int(round(np.log2(train_data.shape[0]))))
        # distance metric
        # # get nearest neighbors
        
        nnd = NNDescent(
            train_data,
            n_neighbors=n_neighbors,
            metric=metric,
            n_trees=n_trees,
            n_iters=n_iters,
            max_candidates=60,
            verbose=True
        )
        knn_indices, knn_dists = nnd.neighbor_graph
        random_state = check_random_state(42)
        complex, sigmas, rhos = fuzzy_simplicial_set(
            X=train_data,
            n_neighbors=n_neighbors,
            metric=metric,
            random_state=random_state,
            knn_indices=knn_indices,
            knn_dists=knn_dists
        )
        return complex, sigmas, rhos, knn_indices

def get_graph(feature_vectors, complex):
    _, head, tail, weight, _ = get_graph_elements(complex, 5)
    attention = np.zeros(feature_vectors.shape)
    return head, tail, weight, feature_vectors, attention

# Define visualization models
model = VisModel(ENCODER_DIMS, DECODER_DIMS)

# Define Losses
negative_sample_rate = 5
min_dist = .1
_a, _b = find_ab_params(1.0, min_dist)
umap_loss_fn = UmapLoss(negative_sample_rate, DEVICE, _a, _b, repulsion_strength=1.0)
recon_loss_fn = ReconstructionLoss(beta=1.0)

# Define Projector
projector = DVIProjector(vis_model=model, content_path=content_path, vis_model_name=VIS_MODEL_NAME, device=DEVICE)

# start_flag = 1

# prev_model = VisModel(ENCODER_DIMS, DECODER_DIMS)

# for Epoch in range(EPOCH_START, EPOCH_END+EPOCH_PERIOD, EPOCH_PERIOD):
#     train_representation = np.load(os.path.join(model_path, '{}{}'.format(Epoch_name,Epoch), 'train_data.npy'))
#     test_representation = np.load(os.path.join(model_path, '{}{}'.format(Epoch_name,Epoch), 'test_data.npy'))
#     if start_flag:
#         temporal_loss_fn = DummyTemporalLoss(DEVICE)
#         criterion = DVILoss(umap_loss_fn, recon_loss_fn, temporal_loss_fn, lambd1=1.0, lambd2=0.0,device=DEVICE)
#         start_flag = 0
#     else:
#         prev_data = np.load(os.path.join(model_path, '{}{}'.format(Epoch_name,Epoch-EPOCH_PERIOD), 'train_data.npy'))
#         # prev_data = prev_data.reshape(prev_data.shape[0],prev_data.shape[1])
#         curr_data = test_representation
#         # curr_data = curr_data.reshape(curr_data.shape[0],curr_data.shape[1])
#         npr = torch.tensor(find_neighbor_preserving_rate(prev_data, curr_data, 15)).to(DEVICE)
#         temporal_loss_fn = TemporalLoss(w_prev, DEVICE)
#         criterion = DVILoss(umap_loss_fn, recon_loss_fn, temporal_loss_fn, lambd1=1.0, lambd2=0.3*npr,device=DEVICE)

#     optimizer = torch.optim.Adam(model.parameters(), lr=.01, weight_decay=1e-5)
#     lr_scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=.1)

#     #### construct the spitial complex
#     complex, _,_,_ = _construct_fuzzy_complex(train_representation)
#     edge_to, edge_from, probs, feature_vectors, attention  = get_graph(train_representation, complex)

#     probs = probs / (probs.max()+1e-3)
#     eliminate_zeros = probs> 1e-3    #1e-3
#     edge_to = edge_to[eliminate_zeros]
#     edge_from = edge_from[eliminate_zeros]
#     probs = probs[eliminate_zeros]
#     labels_non_boundary = np.zeros(len(edge_to))
#     dataset = DVIDataHandler(edge_to, edge_from, feature_vectors, attention,labels_non_boundary)

#     n_samples = int(np.sum(S_N_EPOCHS * probs) // 1)
#     # chose sampler based on the number of dataset
#     if len(edge_to) > pow(2,24):
#         sampler = CustomWeightedRandomSampler(probs, n_samples, replacement=True)
#     else:
#         sampler = WeightedRandomSampler(probs, n_samples, replacement=True)
#     edge_loader = DataLoader(dataset, batch_size=2000, sampler=sampler, num_workers=8, prefetch_factor=10)

#     ########################################################################################################################
#     #                                                       TRAIN                                                          #
#     ########################################################################################################################
#     trainer = DVITrainer(model, criterion, optimizer, lr_scheduler, edge_loader=edge_loader, DEVICE=DEVICE)

#     trainer.train(PATIENT, MAX_EPOCH)
#     save_dir = model_path
#     save_dir = os.path.join(model_path, '{}{}'.format(Epoch_name,Epoch))
#     trainer.save(save_dir=save_dir, file_name="{}".format(VIS_MODEL_NAME))  
#     print("Finish epoch {}...".format(Epoch))

#     prev_model.load_state_dict(model.state_dict())
#     for param in prev_model.parameters():
#         param.requires_grad = False
#     w_prev = dict(prev_model.named_parameters())

########################################################################################################################
#                                                      VISUALIZATION                                                   #
########################################################################################################################
import matplotlib.pyplot as plt
import numpy as np
for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
    file_path = os.path.join(content_path, '{}{}'.format(Epoch_name,i), "{}.pth".format(VIS_MODEL_NAME))
    save_dir = os.path.join(content_path, 'img')
    if not os.path.exists(save_dir):
        os.mkdir(save_dir)
    train_representation = np.load(os.path.join(model_path, '{}{}'.format(Epoch_name,i), 'train_data.npy'))
    save_model = torch.load(file_path, map_location="cpu")
    model.load_state_dict(save_model["state_dict"])
    model.to(DEVICE)
    model.eval()
    emb = model.encoder(torch.from_numpy(train_representation).to(dtype=torch.float32, device=DEVICE)).cpu().detach().numpy()
    plt.scatter(emb[:, 0], emb[:, 1],marker='.',c='g')
    plt.xlabel("X")
    plt.ylabel("Y")
    plt.savefig(os.path.join(save_dir,"Epoch_{}.png".format(i) ))
    print("success saved vis result of epoch {}".format(i))



    
         
          
    