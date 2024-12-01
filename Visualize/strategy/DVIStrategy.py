import os
import numpy as np
import torch
from torch.utils.data import DataLoader
from torch.utils.data import WeightedRandomSampler

from strategy.trainer import DVITrainer
from strategy.custom_weighted_random_sampler import CustomWeightedRandomSampler
from strategy.edge_dataset import DVIDataHandler
from strategy.spatial_edge_constructor import SingleEpochSpatialEdgeConstructor
from strategy.losses import DVILoss, DummyTemporalLoss, TemporalLoss, UmapLoss, ReconstructionLoss
from strategy.visualize_model import VisModel
from strategy.strategy_abstract import StrategyAbstractClass
from data_provider import DataProvider
from umap.umap_ import find_ab_params
from utils import find_neighbor_preserving_rate

class DeepVisualInsight(StrategyAbstractClass):
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
    
    def train_vis_model(self):
        # parameters
        EPOCH_START = self.config.EPOCH_START
        EPOCH_END = self.config.EPOCH_END
        EPOCH_PERIOD = self.config.EPOCH_PERIOD
        LAMBDA1 = self.config.VISUALIZATION["LAMBDA1"]
        LAMBDA2 = self.config.VISUALIZATION["LAMBDA2"]
        N_NEIGHBORS = self.config.VISUALIZATION["N_NEIGHBORS"]
        S_N_EPOCHS = self.config.VISUALIZATION["S_N_EPOCHS"]
        B_N_EPOCHS = self.config.VISUALIZATION["BOUNDARY"]["B_N_EPOCHS"]
        PATIENT = self.config.VISUALIZATION["PATIENT"]
        MAX_EPOCH = self.config.VISUALIZATION["MAX_EPOCH"]
        
        # visualize model of last epoch
        prev_model = VisModel(self.config.VISUALIZATION['ENCODER_DIMS'], self.config.VISUALIZATION['DECODER_DIMS']).to(self.device)
        prev_model.load_state_dict(self.visualize_model.state_dict())
        for param in prev_model.parameters():
            param.requires_grad = False
        w_prev = dict(self.visualize_model.named_parameters())

        # for each epch
        start_flag = 1
        for epoch in range(EPOCH_START, EPOCH_END+EPOCH_PERIOD, EPOCH_PERIOD):
            # Define DVI Loss
            if start_flag:
                temporal_loss_fn = DummyTemporalLoss(self.device)
                criterion = DVILoss(self.umap_fn, self.recon_fn, temporal_loss_fn, lambd1=LAMBDA1, lambd2=0.0, device = self.device)
                start_flag = 0
            else:
                self.temporal_fn = TemporalLoss(w_prev,self.device)
                prev_data = self.data_provider.all_representation(epoch-EPOCH_PERIOD)
                curr_data = self.data_provider.all_representation(epoch)
                prev_data = prev_data.reshape(-1,prev_data.shape[-1])
                curr_data = curr_data.reshape(-1,curr_data.shape[-1])
                
                npr = find_neighbor_preserving_rate(prev_data, curr_data, N_NEIGHBORS)
                # criterion = DVILoss(self.umap_fn, self.recon_fn, self.temporal_fn, lambd1=LAMBDA1, lambd2=LAMBDA2*npr, device = self.device)
                criterion = DVILoss(self.umap_fn, self.recon_fn, self.temporal_fn, lambd1=LAMBDA1, lambd2=LAMBDA2*npr.mean(), device = self.device)
                
            optimizer = torch.optim.Adam(self.visualize_model.parameters(), lr=.01, weight_decay=1e-5)
            lr_scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=.1)
            # Define Edge dataset
            spatial_cons = SingleEpochSpatialEdgeConstructor(self.data_provider, epoch, S_N_EPOCHS, B_N_EPOCHS, N_NEIGHBORS)
            edge_to, edge_from, probs, feature_vectors, attention = spatial_cons.construct()

            probs = probs / (probs.max()+1e-3)
            eliminate_zeros = probs>1e-3
            edge_to = edge_to[eliminate_zeros]
            edge_from = edge_from[eliminate_zeros]
            probs = probs[eliminate_zeros]
            
            dataset = DVIDataHandler(edge_to, edge_from, feature_vectors, attention)

            n_samples = int(np.sum(S_N_EPOCHS * probs) // 1)
            # chose sampler based on the number of dataset
            if len(edge_to) > 2^24:
                sampler = CustomWeightedRandomSampler(probs, n_samples, replacement=True)
            else:
                sampler = WeightedRandomSampler(probs, n_samples, replacement=True)
            edge_loader = DataLoader(dataset, batch_size=1000, sampler=sampler)

            trainer = DVITrainer(self.visualize_model, criterion, optimizer, lr_scheduler,edge_loader=edge_loader, DEVICE=self.device)
            trainer.train(PATIENT, MAX_EPOCH)
            
            self.save_vis_model(self.visualize_model, epoch, trainer.loss, trainer.optimizer)
            # trainer.save(save_dir=os.path.join(self.config.checkpoint_path(epoch)), file_name=self.config.VIS_MODEL_NAME)

            prev_model.load_state_dict(self.visualize_model.state_dict())
            for param in prev_model.parameters():
                param.requires_grad = False
            w_prev = dict(prev_model.named_parameters())
        
    