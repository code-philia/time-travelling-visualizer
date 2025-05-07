
import os
import torch
from torch.utils.data import DataLoader
from torch.utils.data import WeightedRandomSampler
from strategy.strategy_abstract import StrategyAbstractClass
from tool.visualize.visualize_model import SingleVisualizationModel
from tool.visualize.strategy.dynavis.dynavis_losses import UmapLoss, ReconLoss, TemporalRankingLoss, TemporalVelocityLoss, SingleVisLoss
from tool.visualize.strategy.dynavis.dynavis_utils import *
from strategy.dynavis.spatial_edge_constructor import SpatialEdgeConstructor, SimplifiedEdgeConstructor
from strategy.dynavis.temporal_edge_constructor import TemporalEdgeConstructor
from strategy.dynavis.data_handler import DataHandler
from strategy.dynavis.singlevis_trainer import SingleVisTrainer

class DynaVis(StrategyAbstractClass):
    def __init__(self, config, data_provider, selected_idxs=None):
        super().__init__(config)
        self.initialize_model()
        self.data_provider = data_provider
        self.selected_idxs = selected_idxs
        
    def initialize_model(self):
        gpu_id = self.config['vis_config']['gpu_id']
        self.device = torch.device("cuda:{}".format(self.config['vis_config']['gpu_id']) if torch.cuda.is_available() and gpu_id != -1 else "cpu")
        self.visualize_model = SingleVisualizationModel(
            input_dims = self.config['vis_config']['dimension'],
            output_dims = 2,
            units = 256,
            hidden_layer = 3,
            device = self.device
        )
        self.visualize_model.to(self.device)
        
    def train_vis_model(self):
        # parameters
        N_NEIGHBORS = self.config['vis_config']["n_neighbors"]
        S_N_EPOCHS = self.config['vis_config']["s_n_epochs"]
        B_N_EPOCHS = self.config['vis_config']['b_n_epochs']
        T_N_EPOCHS = self.config['vis_config']['t_n_epochs'] # 5
        RECO_WEIGHT = self.config['vis_config']['reconstruct_loss_weight']
        TEMP_WEIGHT = self.config['vis_config']['temporal_loss_weight']
        VELO_WEIGHT = self.config['vis_config']['velocity_loss_weight']
        PATIENT = self.config['vis_config']['patient']
        MAX_EPOCH = self.config['vis_config']['max_epochs']
        
        # edges
        if len(self.selected_idxs) <= 2:
            print("Selected indexes less than 2.")
            edge_constructor = SimplifiedEdgeConstructor(
                data_provider=self.data_provider,
                init_num=100,
                s_n_epochs=S_N_EPOCHS,
                b_n_epochs=B_N_EPOCHS,
                n_neighbors=N_NEIGHBORS,
            )
            edge_to, edge_from, probs, feature_vectors, time_step_nums, time_step_idxs_list = edge_constructor.construct()
            is_temporal = np.zeros(len(edge_to), dtype=bool)
            is_temporal[len(edge_to):] = True  # Mark temporal edges
        else :
            print("Selected indexes: ", self.selected_idxs)
            # Construct Spatial-Temporal Complex
            spatial_cons = SpatialEdgeConstructor(
                data_provider=self.data_provider,
                init_num=100,
                s_n_epochs=S_N_EPOCHS,
                b_n_epochs=B_N_EPOCHS,
                n_neighbors=N_NEIGHBORS,
            )
            print("Constructing spatial edges...")
            s_edge_to, s_edge_from, s_probs, feature_vectors, time_step_nums, time_step_idxs_list = spatial_cons.construct()

            # Construct Temporal Complex
            temporal_cons = TemporalEdgeConstructor(
                X=feature_vectors,
                time_step_nums=time_step_nums,
                n_neighbors=N_NEIGHBORS,
                n_epochs=T_N_EPOCHS
            )
            print("Constructing temporal edges...")
            t_edge_to, t_edge_from, t_probs = temporal_cons.construct()

            # Merge edges
            edge_to = np.concatenate((s_edge_to, t_edge_to), axis=0)
            edge_from = np.concatenate((s_edge_from, t_edge_from), axis=0)
            probs = np.concatenate((s_probs, t_probs), axis=0)
            probs = probs / (probs.max() + 1e-3)
            eliminate_zeros = probs > 1e-3
            edge_to = edge_to[eliminate_zeros]
            edge_from = edge_from[eliminate_zeros]
            probs = probs[eliminate_zeros]
            
            is_temporal = np.zeros(len(edge_to), dtype=bool)
            is_temporal[len(s_edge_to):] = True  # Mark temporal edges

        # losses
        a, b = find_ab_params(1.0, 0.1)
        umap_loss = UmapLoss(
            negative_sample_rate=5,
            device=self.device,
            a=a,
            b=b,
            repulsion_strength=1.0
        )
        recon_loss = ReconLoss(beta=1.0)
        if len(self.selected_idxs) <= 2:
            temporal_loss = TemporalRankingLoss(
                data_provider=self.data_provider,
                temporal_edges=(edge_to, edge_from)
            )
        else:
            temporal_loss = TemporalRankingLoss(
                data_provider=self.data_provider,
                temporal_edges=(feature_vectors[t_edge_from], feature_vectors[t_edge_to])
            )
        velocity_loss = TemporalVelocityLoss(temperature=1)

        criterion = SingleVisLoss(
            umap_loss=umap_loss,
            recon_loss=recon_loss,
            temporal_loss=temporal_loss,
            velocity_loss=velocity_loss,  # 添加velocity loss
            lambd=RECO_WEIGHT,  # reconstruction loss权重
            gamma=TEMP_WEIGHT,  # temporal ranking loss权重
            delta=VELO_WEIGHT   # velocity loss权重，可以调整
        )
        
        optimizer = torch.optim.Adam(self.visualize_model.parameters(), lr=0.01, weight_decay=1e-5)
        lr_scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=.1)

        dataset = DataHandler(edge_to, edge_from, feature_vectors, is_temporal=is_temporal)
        n_samples = int(np.sum(S_N_EPOCHS * probs) // 1)

        num_spatial_samples = int(np.sum(S_N_EPOCHS * probs[~is_temporal]) // 1)
        sampler = WeightedRandomSampler(probs, n_samples, replacement=True)

        edge_loader = DataLoader(dataset, batch_size=2000,sampler=sampler,drop_last=False)
        
        trainer = SingleVisTrainer(
            model=self.visualize_model,
            criterion=criterion,
            optimizer=optimizer,
            lr_scheduler=lr_scheduler,
            edge_loader=edge_loader
        )
        
        total_loss = trainer.train(PATIENT, MAX_EPOCH)
        self.save_vis_model(loss=total_loss, optimizer=optimizer)
        

    def save_vis_model(self, loss = None, optimizer = None):
        save_model = {
            "loss": loss,
            "state_dict": self.visualize_model.state_dict(),
            "optimizer": optimizer.state_dict()
        }
        os.makedirs(os.path.join(self.config["content_path"],"visualize", self.config["vis_id"]), exist_ok=True)
        torch.save(save_model, os.path.join(self.config["content_path"],"visualize", self.config["vis_id"], "vis_model.pth"))