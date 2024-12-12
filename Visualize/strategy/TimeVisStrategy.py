import os
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
from strategy.visualize_model import VisModel
from strategy.strategy_abstract import StrategyAbstractClass
from data_provider import DataProvider
from umap.umap_ import find_ab_params

class TimeVis(StrategyAbstractClass):
    def __init__(self, config):
        super().__init__(config)
        self.initial_model()
        
    def initial_model(self):
        self.device = torch.device("cuda:{}".format(self.config.GPU) if torch.cuda.is_available() else "cpu")
        self.data_provider = DataProvider(self.config)
        self.visualize_model = VisModel(self.config.VISUALIZATION['ENCODER_DIMS'], self.config.VISUALIZATION['DECODER_DIMS']).to(self.device)
        
        # define losses
        negative_sample_rate = 5
        min_dist = 0.1
        _a, _b = find_ab_params(1.0, min_dist)
        self.umap_fn = UmapLoss(negative_sample_rate, self.device, _a, _b, repulsion_strength=1.0)
        self.recon_fn = ReconstructionLoss(beta=1.0)
        self.criterion = SingleVisLoss(self.umap_fn, self.recon_fn, lambd=self.config.VISUALIZATION['LAMBDA1'])
    
    def train_vis_model(self):
        # parameters
        N_NEIGHBORS = self.config.VISUALIZATION["N_NEIGHBORS"]
        S_N_EPOCHS = self.config.VISUALIZATION["S_N_EPOCHS"]
        B_N_EPOCHS = self.config.VISUALIZATION["BOUNDARY"]["B_N_EPOCHS"]
        PATIENT = self.config.VISUALIZATION["PATIENT"]
        MAX_EPOCH = self.config.VISUALIZATION["MAX_EPOCH"]
        
        optimizer = torch.optim.Adam(self.visualize_model.parameters(), lr=.01, weight_decay=1e-5)
        lr_scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=.1)

        # TODO: what does the constant mean ?
        INIT_NUM = 100
        MAX_HAUSDORFF = 1
        ALPHA, BETA = 1, 1
        T_N_EPOCHS = 5
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

    def save_vis_model(self, model, loss = None, optimizer = None):
        save_model = {
            "loss": loss,
            "state_dict": model.state_dict(),
            "optimizer": optimizer.state_dict()
        }
        torch.save(save_model, os.path.join(self.config.CONTENT_PATH, "Model", self.config.VIS_MODEL_NAME+".pth"))

    def check_vis_model(self):
        model_path = os.path.join(self.config.CONTENT_PATH, "Model", self.config.VIS_MODEL_NAME+".pth")
        if not os.path.isfile(model_path):
            raise FileExistsError("Visualization model not found at {}".format(model_path))