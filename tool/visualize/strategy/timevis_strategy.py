import os
import shutil
import numpy as np
import torch
from torch.utils.data import DataLoader
from torch.utils.data import WeightedRandomSampler

from strategy.trainer import SingleVisTrainer
from strategy.custom_weighted_random_sampler import CustomWeightedRandomSampler
from strategy.edge_dataset import DataHandler
from strategy.spatial_edge_constructor import kcSpatialEdgeConstructor
from strategy.temporal_edge_constructor import GlobalTemporalEdgeConstructor
from strategy.losses import SingleVisLoss, UmapLoss, ReconstructionLoss
from tool.visualize.visualize_model import VisModel
from strategy.strategy_abstract import StrategyAbstractClass
from data_provider import DataProvider
from umap.umap_ import find_ab_params

class TimeVis(StrategyAbstractClass):
    def __init__(self, config, data_provider):
        super().__init__(config)
        self.initialize_model()
        self.data_provider = data_provider
        
    def initialize_model(self):
        gpu_id = self.config['vis_config']['gpu_id']
        self.device = torch.device("cuda:{}".format(self.config['vis_config']['gpu_id']) if torch.cuda.is_available() and gpu_id != -1 else "cpu")
        self.visualize_model = VisModel(self.config['vis_config']['encoder_dims'], self.config['vis_config']['decoder_dims']).to(self.device)
        
        # define losses
        negative_sample_rate = 5
        min_dist = 0.1
        _a, _b = find_ab_params(1.0, min_dist)
        self.umap_fn = UmapLoss(negative_sample_rate, self.device, _a, _b, repulsion_strength=1.0)
        self.recon_fn = ReconstructionLoss(beta=1.0)
        self.criterion = SingleVisLoss(self.umap_fn, self.recon_fn, lambd=self.config['vis_config']['lambda'])
    
    def train_vis_model(self):
        # parameters
        N_NEIGHBORS = self.config['vis_config']["n_neighbors"]
        S_N_EPOCHS = self.config['vis_config']["s_n_epochs"]
        B_N_EPOCHS = self.config['vis_config']['b_n_epochs']
        T_N_EPOCHS = self.config['vis_config']['t_n_epochs'] # 5
        PATIENT = self.config['vis_config']['patient']
        MAX_EPOCH = self.config['vis_config']['max_epochs']
        
        optimizer = torch.optim.Adam(self.visualize_model.parameters(), lr=.01, weight_decay=1e-5)
        lr_scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=.1)

        INIT_NUM = 10
        ALPHA, BETA = 1, 1
        spatial_cons = kcSpatialEdgeConstructor(data_provider=self.data_provider, init_num=INIT_NUM, s_n_epochs=S_N_EPOCHS, b_n_epochs=B_N_EPOCHS, n_neighbors=N_NEIGHBORS, MAX_HAUSDORFF=None, ALPHA=ALPHA, BETA=BETA)
        s_edge_to, s_edge_from, s_probs, feature_vectors, time_step_nums, time_step_idxs_list, knn_indices, sigmas, rhos, attention = spatial_cons.construct()
        temporal_cons = GlobalTemporalEdgeConstructor(X=feature_vectors, time_step_nums=time_step_nums, sigmas=sigmas, rhos=rhos, n_neighbors=N_NEIGHBORS, n_epochs=T_N_EPOCHS)
        t_edge_to, t_edge_from, t_probs = temporal_cons.construct()

        edge_to = np.concatenate((s_edge_to, t_edge_to),axis=0)
        edge_from = np.concatenate((s_edge_from, t_edge_from), axis=0)
        probs = np.concatenate((s_probs, t_probs), axis=0)
        probs = probs / (probs.max()+1e-3)
        eliminate_zeros = probs>1e-3
        edge_to = edge_to[eliminate_zeros]
        edge_from = edge_from[eliminate_zeros]
        probs = probs[eliminate_zeros]
        
        dataset = DataHandler(edge_to, edge_from, feature_vectors, attention)
        n_samples = int(np.sum(S_N_EPOCHS * probs) // 1)
        # chose sampler based on the number of dataset
        if len(edge_to) > 2^24:
            sampler = CustomWeightedRandomSampler(probs, n_samples, replacement=True)
        else:
            sampler = WeightedRandomSampler(probs, n_samples, replacement=True)
        edge_loader = DataLoader(dataset, batch_size=1000, sampler=sampler)

        trainer = SingleVisTrainer(self.visualize_model, self.criterion, optimizer, lr_scheduler, edge_loader=edge_loader, DEVICE=self.device)
        trainer.train(PATIENT, MAX_EPOCH)

        self.save_vis_model(self.visualize_model, trainer.loss, trainer.optimizer)
        
        selected_idxs_path = os.path.join(self.config["content_path"],  "selected_idxs")
        if os.path.exists(selected_idxs_path):
            shutil.rmtree(selected_idxs_path)

    def save_vis_model(self, model, loss = None, optimizer = None):
        save_model = {
            "loss": loss,
            "state_dict": model.state_dict(),
            "optimizer": optimizer.state_dict()
        }
        os.makedirs(os.path.join(self.config["content_path"],"visualize", self.config["vis_id"]), exist_ok=True)
        torch.save(save_model, os.path.join(self.config["content_path"],"visualize", self.config["vis_id"], "vis_model.pth"))