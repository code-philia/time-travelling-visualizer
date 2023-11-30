from abc import ABC, abstractmethod
import os
import time
import gc 
import json
from tqdm import tqdm
import torch
from singleVis.losses import PositionRecoverLoss
from torch.utils.data import DataLoader, WeightedRandomSampler

import copy
import numpy as np
from singleVis.custom_weighted_random_sampler import CustomWeightedRandomSampler
from singleVis.spatial_skeleton_edge_constructor import ActiveLearningEpochSpatialEdgeConstructor
from singleVis.spatial_edge_constructor import PROXYEpochSpatialEdgeConstructor
from singleVis.edge_dataset import DVIDataHandler
import sys
sys.path.append('..')
from trustVis.grid_generation import GridGenerator
from singleVis.projector import PROCESSProjector

torch.manual_seed(0)  # 使用固定的种子
torch.cuda.manual_seed_all(0)

"""
1. construct a spatio-temporal complex
2. construct an edge-dataset
3. train the network

Trainer should contains
1. train_step function
2. early stop
3. ...
"""

class TrainerAbstractClass(ABC):
    @abstractmethod
    def __init__(self, *args, **kwargs):
        pass

    @property
    @abstractmethod
    def loss(self):
        pass

    @abstractmethod
    def reset_optim(self):
        pass

    @abstractmethod
    def update_edge_loader(self):
        pass

    @abstractmethod
    def update_vis_model(self):
        pass

    @abstractmethod
    def update_optimizer(self):
        pass

    @abstractmethod
    def update_lr_scheduler(self):
        pass

    @abstractmethod
    def train_step(self):
        pass

    @abstractmethod
    def train(self):
       pass

    @abstractmethod
    def load(self):
        pass

    @abstractmethod
    def save(self):
        pass

    @abstractmethod
    def record_time(self):
        pass


class ActiveLearningEdgeLoader(DataLoader):
    def __init__(self, dataset, weights, batch_size=32, **kwargs):
        # Create a WeightedRandomSampler to select samples based on weights
        sampler = WeightedRandomSampler(weights, len(dataset))
        super().__init__(dataset, batch_size=batch_size, sampler=sampler, **kwargs)

class SingleVisTrainer(TrainerAbstractClass):
    def __init__(self, model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE):
        self.model = model
        self.criterion = criterion
        self.optimizer = optimizer
        self.lr_scheduler = lr_scheduler
        self.DEVICE = DEVICE
        self.edge_loader = edge_loader
        self._loss = 100.0

    @property
    def loss(self):
        return self._loss

    def reset_optim(self, optim, lr_s):
        self.optimizer = optim
        self.lr_scheduler = lr_s
        print("Successfully reset optimizer!")
    
    def update_edge_loader(self, edge_loader):
        del self.edge_loader
        gc.collect()
        self.edge_loader = edge_loader
    
    def update_vis_model(self, model):
        self.model.load_state_dict(model.state_dict())
    
    def update_optimizer(self, optimizer):
        self.optimizer = optimizer
    
    def update_lr_scheduler(self, lr_scheduler):
        self.lr_scheduler = lr_scheduler

    def train_step(self):
        self.model.to(device=self.DEVICE)
        self.model.train()
        all_loss = []
        umap_losses = []
        recon_losses = []

        t = tqdm(self.edge_loader, leave=True, total=len(self.edge_loader))

        # for data in self.edge_loader:
        for data in t:
            edge_to, edge_from, a_to, a_from = data

            edge_to = edge_to.to(device=self.DEVICE, dtype=torch.float32)
            edge_from = edge_from.to(device=self.DEVICE, dtype=torch.float32)
            a_to = a_to.to(device=self.DEVICE, dtype=torch.float32)
            a_from = a_from.to(device=self.DEVICE, dtype=torch.float32)

            outputs = self.model(edge_to, edge_from)
            umap_l, recon_l, loss = self.criterion(edge_to, edge_from, a_to, a_from, outputs)
            all_loss.append(loss.item())
            umap_losses.append(umap_l.item())
            recon_losses.append(recon_l.item())
            # ===================backward====================
            self.optimizer.zero_grad()
            loss.backward()
            self.optimizer.step()
        self._loss = sum(all_loss) / len(all_loss)
        self.model.eval()
        print('umap:{:.4f}\trecon_l:{:.4f}\tloss:{:.4f}'.format(sum(umap_losses) / len(umap_losses),
                                                                sum(recon_losses) / len(recon_losses),
                                                                sum(all_loss) / len(all_loss)))
        return self.loss

    def train(self, PATIENT, MAX_EPOCH_NUMS):
        patient = PATIENT
        time_start = time.time()
        for epoch in range(MAX_EPOCH_NUMS):
            print("====================\nepoch:{}\n===================".format(epoch+1))
            prev_loss = self.loss
            loss = self.train_step()
            self.lr_scheduler.step()
            # early stop, check whether converge or not
            if prev_loss - loss < 5E-3:
                if patient == 0:
                    break
                else:
                    patient -= 1
            else:
                patient = PATIENT

        time_end = time.time()
        time_spend = time_end - time_start
        print("Time spend: {:.2f} for training vis model...".format(time_spend))

    def load(self, file_path):
        """
        save all parameters...
        :param name:
        :return:
        """
        save_model = torch.load(file_path, map_location="cpu")
        self._loss = save_model["loss"]
        self.model.load_state_dict(save_model["state_dict"])
        self.model.to(self.DEVICE)
        print("Successfully load visualization model...")

    def save(self, save_dir, file_name):
        """
        save all parameters...
        :param name:
        :return:
        """
        save_model = {
            "loss": self.loss,
            "state_dict": self.model.state_dict(),
            "optimizer": self.optimizer.state_dict()}
        save_path = os.path.join(save_dir, file_name + '.pth')
        torch.save(save_model, save_path)
        print("Successfully save visualization model...")
    
    def record_time(self, save_dir, file_name, key, t):
        # save result
        save_file = os.path.join(save_dir, file_name+".json")
        if not os.path.exists(save_file):
            evaluation = dict()
        else:
            f = open(save_file, "r")
            evaluation = json.load(f)
            f.close()
        evaluation[key] = round(t, 3)
        with open(save_file, 'w') as f:
            json.dump(evaluation, f)


    



class HybridVisTrainer(SingleVisTrainer):
    def __init__(self, model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE):
        super().__init__(model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE)

    def train_step(self):
        self.model = self.model.to(device=self.DEVICE)
        self.model.train()
        all_loss = []
        umap_losses = []
        recon_losses = []
        smooth_losses = []

        t = tqdm(self.edge_loader, leave=True, total=len(self.edge_loader))
        
        for data in t:
            edge_to, edge_from, a_to, a_from, embedded_to, coeffi_to = data

            edge_to = edge_to.to(device=self.DEVICE, dtype=torch.float32)
            edge_from = edge_from.to(device=self.DEVICE, dtype=torch.float32)
            a_to = a_to.to(device=self.DEVICE, dtype=torch.float32)
            a_from = a_from.to(device=self.DEVICE, dtype=torch.float32)
            embedded_to = embedded_to.to(device=self.DEVICE, dtype=torch.float32)
            coeffi_to = coeffi_to.to(device=self.DEVICE, dtype=torch.float32)

            outputs = self.model(edge_to, edge_from)
            umap_l, recon_l, smooth_l, loss = self.criterion(edge_to, edge_from, a_to, a_from, embedded_to, coeffi_to, outputs)
            all_loss.append(loss.item())
            umap_losses.append(umap_l.item())
            recon_losses.append(recon_l.item())
            smooth_losses.append(smooth_l.item())
            # ===================backward====================
            self.optimizer.zero_grad()
            loss.backward()
            self.optimizer.step()
        self._loss = sum(all_loss) / len(all_loss)
        self.model.eval()
        print('umap:{:.4f}\trecon_l:{:.4f}\tsmooth_l:{:.4f}\tloss:{:.4f}'.format(sum(umap_losses) / len(umap_losses),
                                                                sum(recon_losses) / len(recon_losses),
                                                                sum(smooth_losses) / len(smooth_losses),
                                                                sum(all_loss) / len(all_loss)))
        return self.loss
    
    def record_time(self, save_dir, file_name, operation, seg, t):
        # save result
        save_file = os.path.join(save_dir, file_name+".json")
        if not os.path.exists(save_file):
            evaluation = dict()
        else:
            f = open(save_file, "r")
            evaluation = json.load(f)
            f.close()
        if operation not in evaluation.keys():
            evaluation[operation] = dict()
        evaluation[operation][str(seg)] = round(t, 3)
        with open(save_file, 'w') as f:
            json.dump(evaluation, f)

def disable_grad(model):
    for param in model.parameters():
        param.requires_grad = False    


# retrain with full data every RE_TRAINING_INTERVAL epochs
RE_TRAINING_INTERVAL = 10

class ActiveLearningTrainer(SingleVisTrainer):
    def __init__(self, model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE):
        self.model = model
        self.model = self.model.to(device=DEVICE)
        self.criterion = criterion
        self.optimizer = optimizer
        self.lr_scheduler = lr_scheduler
        self.DEVICE = DEVICE
        self.edge_loader = edge_loader
        self._loss = 100.0

    
     

class DVIALTrainer(SingleVisTrainer):
    def __init__(self, model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE):
        super().__init__(model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE)
        self.is_first_active_learning = True  # Add this line
        
        

    def evaluate_loss(self):
        print("evluating")
        # This method calculates the loss of each sample in the dataset.
        # It returns a list of losses and updates the edge loader with the inverse of these losses as weights.
        losses = []
        # Ensure the model is in evaluation mode
        self.model.eval()
        with torch.no_grad():
            for data in self.edge_loader:
                edge_to, edge_from, a_to, a_from = data
                edge_to = edge_to.to(device=self.DEVICE, dtype=torch.float32)
                edge_from = edge_from.to(device=self.DEVICE, dtype=torch.float32)
                a_to = a_to.to(device=self.DEVICE, dtype=torch.float32)
                a_from = a_from.to(device=self.DEVICE, dtype=torch.float32)
                outputs = self.model(edge_to, edge_from)
                _, _,_, loss = self.criterion(edge_to, edge_from, a_to, a_from, self.model, outputs)
                losses.append(loss.item())
        # We use the inverse of the loss as the weight, so the samples with higher loss will have higher chance to be selected.
        weights = 1.0 / torch.tensor(losses, dtype=torch.float32)
        # Normalize the weights so they sum to 1
        weights = weights / weights.sum()
        # Update the edge loader
        new_loader = ActiveLearningEdgeLoader(self.edge_loader.dataset, weights, batch_size=self.edge_loader.batch_size)
        return losses,new_loader
    
    def train_step(self, edge_loader ):
        self.model = self.model.to(device=self.DEVICE)

        self.model.train()
        all_loss = []
        umap_losses = []
        recon_losses = []
        temporal_losses = []


        t = tqdm(edge_loader, leave=True, total=len(edge_loader))
        
        for data in t:
            edge_to, edge_from, a_to, a_from = data

            edge_to = edge_to.to(device=self.DEVICE, dtype=torch.float32)
            edge_from = edge_from.to(device=self.DEVICE, dtype=torch.float32)
            a_to = a_to.to(device=self.DEVICE, dtype=torch.float32)
            a_from = a_from.to(device=self.DEVICE, dtype=torch.float32)

            outputs = self.model(edge_to, edge_from)
            umap_l, recon_l, temporal_l, loss = self.criterion(edge_to, edge_from, a_to, a_from, self.model, outputs)
     
              
            all_loss.append(loss.mean().item())
            umap_losses.append(umap_l.item())
            recon_losses.append(recon_l.item())
            temporal_losses.append(temporal_l.mean().item())

            # ===================backward====================
            self.optimizer.zero_grad()
            loss.mean().backward()
            self.optimizer.step()
        self._loss = sum(all_loss) / len(all_loss)
        self.model.eval()
        print('umap:{:.4f}\trecon_l:{:.4f}\ttemporal_l:{:.4f}\tloss:{:.4f}'.format(sum(umap_losses) / len(umap_losses),
                                                                sum(recon_losses) / len(recon_losses),
                                                                sum(temporal_losses) / len(temporal_losses),
                                                                sum(all_loss) / len(all_loss)))
        return self.loss
    
    def run_epoch(self, epoch, is_active_learning=False, is_full_data=False):
        print("====================\nepoch:{}\n===================".format(epoch+1))
        start_time = time.time()

        if is_active_learning and is_full_data == False:
            _, current_loader = self.evaluate_loss()
            # Adjust learning rate for active learning
            if self.is_first_active_learning:
                print("change learning rate")
                for param_group in self.optimizer.param_groups:
                    param_group['lr'] *= 0.1  # or set to any value you want
                self.is_first_active_learning = False
            
        prev_loss = self.loss

        if is_full_data:
            print("full data")
            loss = self.train_step(self.edge_loader)  # use DVITrainer's train_step
        else:
            loss = self.train_step(current_loader)  # use DVITrainer's train_step
        
        self.lr_scheduler.step()

        elapsed_time = time.time() - start_time
        print("Epoch completed in: {:.2f} seconds".format(elapsed_time))

        return prev_loss, loss
    
    def train(self, PATIENT, MAX_EPOCH_NUMS):
        print("ininin in dvi")
        patient = PATIENT
        time_start = time.time()
        # Pretraining
        for epoch in range(10):
            print("Pretraining")
            _, _ = self.run_epoch(epoch, is_active_learning=False,is_full_data=True )


        for epoch in range(MAX_EPOCH_NUMS):
            print("In active learning")
            # is_full_data = (epoch % 3 == 0)  # retrain with full data every RE_TRAINING_INTERVAL epochs
            prev_loss, loss = self.run_epoch(epoch, is_active_learning=True, is_full_data=False)
      
            # Early stop, check whether converge or not
            if abs(prev_loss - loss) < 5E-3:
                if patient == 0:
                    break
                else:
                    patient -= 1
            else:
                patient = PATIENT

        time_end = time.time()
        time_spend = time_end - time_start
        print("Time spend: {:.2f} for training vis model...".format(time_spend))   
        
    
    def record_time(self, save_dir, file_name, operation, iteration, t):
        # save result
        save_file = os.path.join(save_dir, file_name+".json")
        if not os.path.exists(save_file):
            evaluation = dict()
        else:
            f = open(save_file, "r")
            evaluation = json.load(f)
            f.close()
        if operation not in evaluation.keys():
            evaluation[operation] = dict()
        evaluation[operation][iteration] = round(t, 3)
        with open(save_file, 'w') as f:
            json.dump(evaluation, f)

class DVITrainer(SingleVisTrainer):
    def __init__(self, model, criterion, optimizer, lr_scheduler, edge_loader,DEVICE):
        super().__init__(model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE)
    
    
    def train_step(self):
        self.model = self.model.to(device=self.DEVICE)
        self.model.train()
        all_loss = []
        umap_losses = []
        recon_losses = []
        temporal_losses = []

        t = tqdm(self.edge_loader, leave=True, total=len(self.edge_loader))
        
        for data in t:
            edge_to, edge_from, a_to, a_from = data

            edge_to = edge_to.to(device=self.DEVICE, dtype=torch.float32)
            edge_from = edge_from.to(device=self.DEVICE, dtype=torch.float32)
            a_to = a_to.to(device=self.DEVICE, dtype=torch.float32)
            a_from = a_from.to(device=self.DEVICE, dtype=torch.float32)

            outputs = self.model(edge_to, edge_from)
            umap_l, recon_l, temporal_l, loss = self.criterion(edge_to, edge_from, a_to, a_from, self.model, outputs)
            # + 1 * radius_loss + orthogonal_loss

            # + distance_order_loss
            # all_loss.append(loss.item())
            # umap_losses.append(umap_l.item())
            # recon_losses.append(recon_l.item())
            # temporal_losses.append(temporal_l.item())
            all_loss.append(loss.mean().item())
            umap_losses.append(umap_l.item())
            recon_losses.append(recon_l.item())
            temporal_losses.append(temporal_l.mean().item())
            # ===================backward====================
            self.optimizer.zero_grad()
            loss.mean().backward()
            # loss_new.backward()
            self.optimizer.step()
        self._loss = sum(all_loss) / len(all_loss)
        self.model.eval()
        print('umap:{:.4f}\trecon_l:{:.4f}\ttemporal_l:{:.4f}\tloss:{:.4f}'.format(sum(umap_losses) / len(umap_losses),
                                                                sum(recon_losses) / len(recon_losses),
                                                                sum(temporal_losses) / len(temporal_losses),
                                                                sum(all_loss) / len(all_loss)))
        return self.loss
    
    # def radius_loss(self,embeddings, center, alpha=1.0):
    #     """
    #     Radius loss function.
    #     Args:
    #         embeddings: the 2D embeddings, tensor of shape (N, 2)
    #         center: the center of the circle in the 2D space, tensor of shape (2,)
    #         alpha: a coefficient for the radius loss, controlling its importance.
    #     Returns:
    #         A scalar tensor representing the radius loss.
    #     """
    #     radii = torch.norm(embeddings - center, dim=1)
    #     normalized_radii = torch.nn.functional.normalize(radii, dim=0, p=2)
    #     normalized_mean_radii = torch.mean(normalized_radii)

    #     return alpha * normalized_mean_radii
    
    def radius_loss(self, embeddings, center, alpha=1.0):
        """
        Modified radius loss function that tries to maximize the average distance.
        Args:
            embeddings: the 2D embeddings, tensor of shape (N, 2)
            center: the center of the circle in the 2D space, tensor of shape (2,)
            alpha: a coefficient for the radius loss, controlling its importance.
        Returns:
            A scalar tensor representing the radius loss.
        """
        radii = torch.norm(embeddings - center, dim=1)
        normalized_radii = torch.nn.functional.normalize(radii, dim=0, p=2)
        normalized_mean_radii = torch.mean(normalized_radii)

        return -alpha * normalized_mean_radii
    
    def orthogonal_loss(self, embeddings, beta=0.001):
        """
        Orthogonal loss function that tries to decorrelate the embeddings.
        Args:
            embeddings: the 2D embeddings, tensor of shape (N, 2)
            beta: a coefficient for the orthogonal loss, controlling its importance.
        Returns:
            A scalar tensor representing the orthogonal loss.
        """
        gram_matrix = torch.mm(embeddings, embeddings.t())
        identity = torch.eye(embeddings.shape[0]).to(embeddings.device)
        loss = torch.norm(gram_matrix - identity)
        return beta * loss

    
    def distance_order_loss(self,high_embeddings, low_embeddings, high_center, low_center, beta=0.001):
        """
        Distance order preserving loss function.
        Args:
            high_embeddings: the high-dimensional embeddings, tensor of shape (N, D)
            low_embeddings: the 2D embeddings, tensor of shape (N, 2)
            high_center: the center of the sphere in the high-dimensional space, tensor of shape (D,)
            low_center: the center of the circle in the 2D space, tensor of shape (2,)
            beta: a coefficient for the distance order loss, controlling its importance.
        Returns:
            A scalar tensor representing the distance order loss.
        """
        high_distances = torch.norm(high_embeddings - high_center, dim=1)
        low_distances = torch.norm(low_embeddings - low_center, dim=1)

        high_order = torch.argsort(high_distances)
        low_order = torch.argsort(low_distances)
        high_order = high_order.float()
        low_order = low_order.float()

        # loss = torch.norm(high_order - low_order)
        loss = torch.norm(high_order - low_order) / high_order.shape[0]
        # loss = torch.sigmoid(torch.norm(high_order - low_order) / high_order.shape[0])


        return beta * loss
    
    
    def record_time(self, save_dir, file_name, operation, iteration, t):
        # save result
        save_file = os.path.join(save_dir, file_name+".json")
        if not os.path.exists(save_file):
            evaluation = dict()
        else:
            f = open(save_file, "r")
            evaluation = json.load(f)
            f.close()
        if operation not in evaluation.keys():
            evaluation[operation] = dict()
        evaluation[operation][iteration] = round(t, 3)
        with open(save_file, 'w') as f:
            json.dump(evaluation, f)
class DVIActiveLearningTrainer(SingleVisTrainer):
    def __init__(self, model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE):
        super().__init__(model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE)


    
    def train_step(self):
        self.model = self.model.to(device=self.DEVICE)

        self.model.train()
        all_loss = []
        umap_losses = []
        recon_losses = []
        temporal_losses = []


        t = tqdm(self.edge_loader, leave=True, total=len(self.edge_loader))
        
        for data in t:
            edge_to, edge_from, a_to, a_from = data

            edge_to = edge_to.to(device=self.DEVICE, dtype=torch.float32)
            edge_from = edge_from.to(device=self.DEVICE, dtype=torch.float32)
            a_to = a_to.to(device=self.DEVICE, dtype=torch.float32)
            a_from = a_from.to(device=self.DEVICE, dtype=torch.float32)

            outputs = self.model(edge_to, edge_from)
            umap_l, recon_l, temporal_l, loss = self.criterion(edge_to, edge_from, a_to, a_from, self.model, outputs)
     
              
            all_loss.append(loss.mean().item())
            umap_losses.append(umap_l.item())
            recon_losses.append(recon_l.item())
            temporal_losses.append(temporal_l.mean().item())

            # ===================backward====================
            self.optimizer.zero_grad()
            loss.mean().backward()
            self.optimizer.step()
        self._loss = sum(all_loss) / len(all_loss)
        self.model.eval()
        print('umap:{:.4f}\trecon_l:{:.4f}\ttemporal_l:{:.4f}\tloss:{:.4f}'.format(sum(umap_losses) / len(umap_losses),
                                                                sum(recon_losses) / len(recon_losses),
                                                                sum(temporal_losses) / len(temporal_losses),
                                                                sum(all_loss) / len(all_loss)))
        return self.loss
        
    
    def record_time(self, save_dir, file_name, operation, iteration, t):
        # save result
        save_file = os.path.join(save_dir, file_name+".json")
        if not os.path.exists(save_file):
            evaluation = dict()
        else:
            f = open(save_file, "r")
            evaluation = json.load(f)
            f.close()
        if operation not in evaluation.keys():
            evaluation[operation] = dict()
        evaluation[operation][iteration] = round(t, 3)
        with open(save_file, 'w') as f:
            json.dump(evaluation, f)

class TVITrainer(SingleVisTrainer):
    def __init__(self, model, criterion, optimizer, lr_scheduler, edge_loader, adv_edge_loader, DEVICE):
        super().__init__(model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE)
        self.adv_edge_loader = adv_edge_loader  # adversarial data loader
    
    def disable_grad(self, model):
        for param in model.parameters():
            param.requires_grad = False  

    def enable_grad(self, model):
        for param in model.parameters():
            param.requires_grad = True  

    def train_step(self):
        self.model = self.model.to(device=self.DEVICE)

        self.model.train()
        all_loss = []
        umap_losses = []
        recon_losses = []
        temporal_losses = []

        t = tqdm(self.edge_loader, leave=True, total=len(self.edge_loader))
        self.enable_grad(self.model.encoder)# Freeze encoder parameters
        print("enable")
        for data in t:
            edge_to, edge_from, a_to, a_from = data

            edge_to = edge_to.to(device=self.DEVICE, dtype=torch.float32)
            edge_from = edge_from.to(device=self.DEVICE, dtype=torch.float32)
            a_to = a_to.to(device=self.DEVICE, dtype=torch.float32)
            a_from = a_from.to(device=self.DEVICE, dtype=torch.float32)

            outputs = self.model(edge_to, edge_from)
            umap_l, recon_l, temporal_l, loss = self.criterion(edge_to, edge_from, a_to, a_from, self.model, outputs)
    
            all_loss.append(loss.mean().item())
            umap_losses.append(umap_l.item())
            recon_losses.append(recon_l.item())
            temporal_losses.append(temporal_l.mean().item())

            self.optimizer.zero_grad()
            loss.mean().backward()
            self.optimizer.step()

        # Use adversarial data for decoder
        # for param in self.model.encoder.parameters():
        #     param.requires_grad = False  # Freeze encoder parameters

        # for param in self.model.decoder.parameters():
        #     param.requires_grad = True  # Unfreeze decoder parameters

        adv_t = tqdm(self.adv_edge_loader, leave=True, total=len(self.adv_edge_loader))
        # adv_t = iter(self.adv_edge_loader)
        self.disable_grad(self.model.encoder)# Freeze encoder parameters
        print("disable")
        for adv_data in adv_t:
            

            adv_edge_to, adv_edge_from, adv_a_to, adv_a_from = adv_data

            adv_edge_to = adv_edge_to.to(device=self.DEVICE, dtype=torch.float32)
            adv_edge_from = adv_edge_from.to(device=self.DEVICE, dtype=torch.float32)
            adv_a_to = adv_a_to.to(device=self.DEVICE, dtype=torch.float32)
            adv_a_from = adv_a_from.to(device=self.DEVICE, dtype=torch.float32)

            adv_outputs = self.model(adv_edge_to, adv_edge_from)
            adv_umap_l, adv_recon_l, adv_temporal_l, adv_loss = self.criterion(adv_edge_to, adv_edge_from, adv_a_to, adv_a_from, self.model, adv_outputs)

            # Only update decoder
            self.optimizer.zero_grad()
            adv_loss.mean().backward()
            self.optimizer.step()

        self._loss = sum(all_loss) / len(all_loss)
        self.model.eval()
        print('umap:{:.4f}\trecon_l:{:.4f}\ttemporal_l:{:.4f}\tloss:{:.4f}'.format(sum(umap_losses) / len(umap_losses),
                                                                sum(recon_losses) / len(recon_losses),
                                                                sum(temporal_losses) / len(temporal_losses),
                                                                sum(all_loss) / len(all_loss)))
        return self._loss
    
    def record_time(self, save_dir, file_name, operation, iteration, t):
        # save result
        save_file = os.path.join(save_dir, file_name+".json")
        if not os.path.exists(save_file):
            evaluation = dict()
        else:
            f = open(save_file, "r")
            evaluation = json.load(f)
            f.close()
        if operation not in evaluation.keys():
            evaluation[operation] = dict()
        evaluation[operation][iteration] = round(t, 3)
        with open(save_file, 'w') as f:
            json.dump(evaluation, f)

class DVIReFineTrainer(SingleVisTrainer):
    def __init__(self, model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE,data, disable_encoder_grad=False, **kwargs):
        super().__init__(model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE, **kwargs)
        self.disable_encoder_grad = disable_encoder_grad
        self.data = data
        
    def train(self, PATIENT, MAX_EPOCH_NUMS):
        patient = PATIENT
        print("patient",patient)
        time_start = time.time()
        for epoch in range(MAX_EPOCH_NUMS):
            print("====================\nepoch:{}\n===================".format(epoch+1))
            prev_loss = self.loss
            loss = self.train_step()
            self.lr_scheduler.step()
            # early stop, check whether converge or not
            if prev_loss - loss < 5E-3:
                if patient == 0:
                    break
                else:
                    patient -= 1
            else:
                patient = PATIENT

        time_end = time.time()
        time_spend = time_end - time_start
        print("Time spend: {:.2f} for training vis model...".format(time_spend))
    
    def train_step(self):
        
        self.model = self.model.to(device=self.DEVICE)
        ####### disable encoder
        if self.disable_encoder_grad == True:
            disable_grad(self.model.encoder)

        self.model.train()
        all_loss = []
        umap_losses = []
        recon_losses = []
        temporal_losses = []
        recoverposition_losses = []
        # loss_fn = PositionRecoverLoss()

        t = tqdm(self.edge_loader, leave=True, total=len(self.edge_loader))
        
        for data in t:
            edge_to, edge_from, a_to, a_from = data

            edge_to = edge_to.to(device=self.DEVICE, dtype=torch.float32)
            edge_from = edge_from.to(device=self.DEVICE, dtype=torch.float32)
            a_to = a_to.to(device=self.DEVICE, dtype=torch.float32)
            a_from = a_from.to(device=self.DEVICE, dtype=torch.float32)

            outputs = self.model(edge_to, edge_from)
            umap_l, recon_l, temporal_l, loss = self.criterion(edge_to, edge_from, a_to, a_from, self.model, outputs)
            data = torch.Tensor(self.data).to(self.DEVICE)
            new_emb = self.model.encoder(data).to(self.DEVICE)
            grid_high = self.model.decoder(torch.Tensor(new_emb).to(self.DEVICE))
           

            pos_recover_loss_fn = PositionRecoverLoss(self.DEVICE)

            pos_loss = pos_recover_loss_fn(torch.Tensor(grid_high).to(self.DEVICE), torch.Tensor(self.data).to(self.DEVICE))

            all_loss.append(loss.mean().item())
            umap_losses.append(umap_l.item())
            recon_losses.append(recon_l.item())
            temporal_losses.append(temporal_l.mean().item())
            recoverposition_losses.append(pos_loss.mean().item())
            # ===================backward====================
            recoverposition_loss = sum(recoverposition_losses) / len(recoverposition_losses)
            loss_new = loss +  1 * recoverposition_loss
            self.optimizer.zero_grad()
            loss_new.mean().backward()
            # pos_loss.mean().backward()
            self.optimizer.step()
        self._loss = sum(all_loss) / len(all_loss)
        self.model.eval()
        print('umap:{:.4f}\trecon_l:{:.4f}\ttemporal_l:{:.4f}\tloss:{:.4f}\tecoverposition_losses:{}'.format(sum(umap_losses) / len(umap_losses),
                                                                sum(recon_losses) / len(recon_losses),
                                                                sum(temporal_losses) / len(temporal_losses),
                                                                sum(all_loss) / len(all_loss), sum(recoverposition_losses) / len(all_loss)))
        return self.loss
   
    def record_time(self, save_dir, file_name, operation, iteration, t):
        # save result
        save_file = os.path.join(save_dir, file_name+".json")
        if not os.path.exists(save_file):
            evaluation = dict()
        else:
            f = open(save_file, "r")
            evaluation = json.load(f)
            f.close()
        if operation not in evaluation.keys():
            evaluation[operation] = dict()
        evaluation[operation][iteration] = round(t, 3)
        with open(save_file, 'w') as f:
            json.dump(evaluation, f)


class OriginDVITrainer(SingleVisTrainer):
    def __init__(self, model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE):
        super().__init__(model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE)
    
    def train_step(self):
        self.model = self.model.to(device=self.DEVICE)
        self.model.train()
        all_loss = []
        umap_losses = []
        recon_losses = []
        temporal_losses = []

        t = tqdm(self.edge_loader, leave=True, total=len(self.edge_loader))
        
        for data in t:
            edge_to, edge_from, a_to, a_from = data

            edge_to = edge_to.to(device=self.DEVICE, dtype=torch.float32)
            edge_from = edge_from.to(device=self.DEVICE, dtype=torch.float32)
            a_to = a_to.to(device=self.DEVICE, dtype=torch.float32)
            a_from = a_from.to(device=self.DEVICE, dtype=torch.float32)

            outputs = self.model(edge_to, edge_from)
            umap_l, recon_l, temporal_l, loss = self.criterion(edge_to, edge_from, a_to, a_from, self.model, outputs)
            all_loss.append(loss.mean().item())
            umap_losses.append(umap_l.item())
            recon_losses.append(recon_l.item())
            temporal_losses.append(temporal_l.mean().item())
            # ===================backward====================
            self.optimizer.zero_grad()
            loss.mean().backward()
            self.optimizer.step()
        self._loss = sum(all_loss) / len(all_loss)
        self.model.eval()
        print('umap:{:.4f}\trecon_l:{:.4f}\ttemporal_l:{:.4f}\tloss:{:.4f}'.format(sum(umap_losses) / len(umap_losses),
                                                                sum(recon_losses) / len(recon_losses),
                                                                sum(temporal_losses) / len(temporal_losses),
                                                                sum(all_loss) / len(all_loss)))
        return self.loss
    
    def record_time(self, save_dir, file_name, operation, iteration, t):
        # save result
        save_file = os.path.join(save_dir, file_name+".json")
        if not os.path.exists(save_file):
            evaluation = dict()
        else:
            f = open(save_file, "r")
            evaluation = json.load(f)
            f.close()
        if operation not in evaluation.keys():
            evaluation[operation] = dict()
        evaluation[operation][iteration] = round(t, 3)
        with open(save_file, 'w') as f:
            json.dump(evaluation, f)


class PROXYALMODITrainer(SingleVisTrainer):
    def __init__(self, model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE, iteration, data_provider, prev_model, S_N_EPOCHS, B_N_EPOCHS, N_NEIGHBORS, threshold, resolution, **kwargs):
        super().__init__(model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE, **kwargs)
        self.is_first_active_learning = True  # Add this line
        # self.high_bom = high_bom
        # self.high_rad = high_rad
        self.iteration = iteration
        self.data_provider = data_provider
        self.prev_model = prev_model
        self.S_N_EPOCHS = S_N_EPOCHS
        self.B_N_EPOCHS = B_N_EPOCHS
        self.N_NEIGHBORS = N_NEIGHBORS
        self.threshold = threshold
        self.resolution = resolution
        

    def al_loader(self):
        print("evluating")
        
        # This method calculates the loss of each sample in the dataset.
        # It returns a list of losses and updates the edge loader with the inverse of these losses as weights.
        losses = []
        # Ensure the model is in evaluation mode
        
        projector = PROCESSProjector(self.model,self.data_provider.content_path, '',self.DEVICE)
        grid_generator = GridGenerator(self.data_provider,self.iteration,projector, self.threshold, self.resolution)
        self.grid_high_mask = grid_generator.gen_grids_near_to_training_data()
        print("all near training data grids shape:", self.grid_high_mask.shape)
        self.model.eval()

        grid_pred = self.data_provider.get_pred(self.iteration, self.grid_high_mask).argmax(axis=1)
        self.grid_high_mask = torch.tensor(self.grid_high_mask).to(device=self.DEVICE, dtype=torch.float32)
        grid_second_high_mask = self.model(self.grid_high_mask,self.grid_high_mask)['recon'][0]
        grid_second_high_mask = grid_second_high_mask.cpu().detach().numpy()
        grid_second_pred = self.data_provider.get_pred(self.iteration, grid_second_high_mask).argmax(axis=1)

        error_indices = [i for i in range(len(grid_pred)) if grid_pred[i] != grid_second_pred[i]]
        error_grids = self.grid_high_mask.cpu().detach().numpy()[error_indices]
        print("current error grids shape:", error_grids.shape)
        
        al_spatial_cons = PROXYEpochSpatialEdgeConstructor(self.data_provider, self.iteration, self.S_N_EPOCHS, self.B_N_EPOCHS, self.N_NEIGHBORS,error_grids)

        # al_spatial_cons = ActiveLearningEpochSpatialEdgeConstructor(self.data_provider, self.iteration, self.S_N_EPOCHS, self.B_N_EPOCHS, self.N_NEIGHBORS, cluster_points, uncluster_points, self.high_bom)
        al_edge_to, al_edge_from, al_probs, al_feature_vectors, al_attention = al_spatial_cons.construct()

        al_probs = al_probs / (al_probs.max()+1e-3)
        eliminate_zeros = al_probs>5e-2    #1e-3
        al_edge_to = al_edge_to[eliminate_zeros]
        al_edge_from = al_edge_from[eliminate_zeros]
        al_probs = al_probs[eliminate_zeros]
        
        dataset = DVIDataHandler(al_edge_to, al_edge_from, al_feature_vectors, al_attention)

        n_samples = int(np.sum(self.S_N_EPOCHS * al_probs) // 1)

        # chose sampler based on the number of dataset
        if len(al_edge_to) > pow(2,24):
            sampler = CustomWeightedRandomSampler(al_probs, n_samples, replacement=True)
        else:
            sampler = WeightedRandomSampler(al_probs, n_samples, replacement=True)
        new_loader = DataLoader(dataset, batch_size=2000, sampler=sampler, num_workers=8, prefetch_factor=10)
        # new_loader = ActiveLearningEdgeLoader(current_loader.dataset, weights, batch_size=current_loader.batch_size)
        return losses, new_loader
    
    def train_step(self, edge_loader):
       
        self.model = self.model.to(device=self.DEVICE)
        self.model.train()
        all_loss = []
        umap_losses = []
        recon_losses = []
        temporal_losses = []


        t = tqdm(edge_loader, leave=True, total=len(edge_loader))
        
        for data in t:
            edge_to, edge_from, a_to, a_from = data

            edge_to = edge_to.to(device=self.DEVICE, dtype=torch.float32)
            edge_from = edge_from.to(device=self.DEVICE, dtype=torch.float32)
            a_to = a_to.to(device=self.DEVICE, dtype=torch.float32)
            a_from = a_from.to(device=self.DEVICE, dtype=torch.float32)

            outputs = self.model(edge_to, edge_from)
            umap_l, recon_l, temporal_l, loss = self.criterion(edge_to, edge_from, a_to, a_from, self.model, outputs)
     
              
            all_loss.append(loss.mean().item())
            umap_losses.append(umap_l.item())
            recon_losses.append(recon_l.item())
            temporal_losses.append(temporal_l.mean().item())

            # ===================backward====================
            self.optimizer.zero_grad()
            loss.mean().backward()
            self.optimizer.step()
        self._loss = sum(all_loss) / len(all_loss)
        self.model.eval()
        print('umap:{:.4f}\trecon_l:{:.4f}\ttemporal_l:{:.4f}\tloss:{:.4f}'.format(sum(umap_losses) / len(umap_losses),
                                                                sum(recon_losses) / len(recon_losses),
                                                                sum(temporal_losses) / len(temporal_losses),
                                                                sum(all_loss) / len(all_loss)))
        return self.loss
    
    def run_epoch(self, epoch, current_loader, is_active_learning=False, is_full_data=False):
        print("====================\nepoch:{}\n===================".format(epoch+1))
        start_time = time.time()

        if is_active_learning and is_full_data == False:
            
            _, current_loader = self.al_loader()
                ### generate grid for al


            # Adjust learning rate for active learning
            if self.is_first_active_learning:
                print("change learning rate")
                for param_group in self.optimizer.param_groups:
                    param_group['lr'] *= 0.1  # or set to any value you want
                self.is_first_active_learning = False
            
        prev_loss = self.loss

        if is_full_data:
            print("full data")
            loss = self.train_step(self.edge_loader)  # use DVITrainer's train_step
        else:
            loss = self.train_step(current_loader)  # use DVITrainer's train_step
        
        self.lr_scheduler.step()

        elapsed_time = time.time() - start_time
        print("Epoch completed in: {:.2f} seconds".format(elapsed_time))

        return prev_loss, loss, current_loader
    
    def train(self, PATIENT, MAX_EPOCH_NUMS):
        start_flag = 1
        if start_flag:
            current_loader = self.edge_loader
            start_flag = 0
        print("ininin in dvi")
        patient = PATIENT
        time_start = time.time()
        # Pretraining
        # for epoch in range(10):
        #     print("Pretraining")
        #     _, _, current_loader= self.run_epoch(epoch, current_loader, is_active_learning=False,is_full_data=True)


        for epoch in range(MAX_EPOCH_NUMS):
            print("In active learning")
            # is_full_data = (epoch % 3 == 0)  # retrain with full data every RE_TRAINING_INTERVAL epochs
            prev_loss, loss, current_loader = self.run_epoch(epoch, current_loader, is_active_learning=True, is_full_data=False)
      
            # Early stop, check whether converge or not
            if abs(prev_loss - loss) < 5E-3:
                if patient == 0:
                    break
                else:
                    patient -= 1
            else:
                patient = PATIENT

        time_end = time.time()
        time_spend = time_end - time_start
        print("Time spend: {:.2f} for training vis model...".format(time_spend))   

        self.prev_model.load_state_dict(self.model.state_dict())
        for param in self.prev_model.parameters():
            param.requires_grad = False
        w_prev = dict(self.prev_model.named_parameters())
        
    
    def record_time(self, save_dir, file_name, operation, iteration, t):
        # save result
        save_file = os.path.join(save_dir, file_name+".json")
        if not os.path.exists(save_file):
            evaluation = dict()
        else:
            f = open(save_file, "r")
            evaluation = json.load(f)
            f.close()
        if operation not in evaluation.keys():
            evaluation[operation] = dict()
        evaluation[operation][iteration] = round(t, 3)
        with open(save_file, 'w') as f:
            json.dump(evaluation, f)


class DVIALMODITrainer(SingleVisTrainer):
    def __init__(self, model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE, grid_high_mask, high_bom, high_rad, iteration, data_provider, prev_model, S_N_EPOCHS, B_N_EPOCHS, N_NEIGHBORS, **kwargs):
        super().__init__(model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE, **kwargs)
        self.is_first_active_learning = True  # Add this line
        self.grid_high_mask = grid_high_mask
        self.high_bom = high_bom
        self.high_rad = high_rad
        self.iteration = iteration
        self.data_provider = data_provider
        self.prev_model = prev_model
        self.S_N_EPOCHS = S_N_EPOCHS
        self.B_N_EPOCHS = B_N_EPOCHS
        self.N_NEIGHBORS = N_NEIGHBORS
        

    def al_loader(self):
        print("evluating")
        losses = []
        
        # Ensure the model is in evaluation mode
        self.model.eval()
        # 检查grid_high_mask的类型
        if isinstance(self.grid_high_mask, torch.Tensor):
            # 将Tensor转换为ndarray
            self.grid_high_mask = self.grid_high_mask.cpu().detach().numpy()

        grid_pred = self.data_provider.get_pred(self.iteration, self.grid_high_mask).argmax(axis=1)
        self.grid_high_mask = torch.tensor(self.grid_high_mask).to(device=self.DEVICE, dtype=torch.float32)
        grid_second_high_mask = self.model(self.grid_high_mask,self.grid_high_mask)['recon'][0]
        grid_second_high_mask = grid_second_high_mask.cpu().detach().numpy()
        grid_second_pred = self.data_provider.get_pred(self.iteration, grid_second_high_mask).argmax(axis=1)

        error_indices = [i for i in range(len(grid_pred)) if grid_pred[i] != grid_second_pred[i]]
        grid_high_error = [self.grid_high_mask[i] for i in error_indices]

        # 获取阈值
        threshold = self.high_rad[0] // 2

        # 筛选出半径小于阈值的点的索引
        filtered_indices = np.where(self.high_rad < threshold)

        # 根据索引获取对应位置的center
        filtered_centers = self.high_bom[filtered_indices]
        filtered_radius = self.high_rad[filtered_indices]

        cluster_points = []
        uncluster_points = []

        # 遍历每个点
        for point in grid_high_error:
            point = point.cpu().detach().numpy()
            # 计算点到所有center的距离
            distances = np.linalg.norm(point - filtered_centers, axis=1)
            
            # 找到最近center的索引
            closest_center_index = np.argmin(distances)
            
            # 判断最近center的距离是否小于对应center的半径
            if distances[closest_center_index] < filtered_radius[closest_center_index]:
                # 满足条件的点
                cluster_points.append(point)
            else:
                # 不满足条件的点
                uncluster_points.append(point)
        cluster_points = np.array(cluster_points)
        uncluster_points = np.array(uncluster_points)
        

        al_spatial_cons = ActiveLearningEpochSpatialEdgeConstructor(self.data_provider, self.iteration, self.S_N_EPOCHS, self.B_N_EPOCHS, self.N_NEIGHBORS, cluster_points, uncluster_points, self.high_bom)
        al_edge_to, al_edge_from, al_probs, al_feature_vectors, al_attention = al_spatial_cons.construct()

        al_probs = al_probs / (al_probs.max()+1e-3)
        eliminate_zeros = al_probs>5e-2    #1e-3
        al_edge_to = al_edge_to[eliminate_zeros]
        al_edge_from = al_edge_from[eliminate_zeros]
        al_probs = al_probs[eliminate_zeros]
        
        dataset = DVIDataHandler(al_edge_to, al_edge_from, al_feature_vectors, al_attention)

        n_samples = int(np.sum(self.S_N_EPOCHS * al_probs) // 1)

        # chose sampler based on the number of dataset
        if len(al_edge_to) > pow(2,24):
            sampler = CustomWeightedRandomSampler(al_probs, n_samples, replacement=True)
        else:
            sampler = WeightedRandomSampler(al_probs, n_samples, replacement=True)
        new_loader = DataLoader(dataset, batch_size=2000, sampler=sampler, num_workers=8, prefetch_factor=10)
        # new_loader = ActiveLearningEdgeLoader(current_loader.dataset, weights, batch_size=current_loader.batch_size)
        return losses, new_loader
    
    def train_step(self, edge_loader):
       
        self.model = self.model.to(device=self.DEVICE)
        self.model.train()
        all_loss = []
        umap_losses = []
        recon_losses = []
        temporal_losses = []


        t = tqdm(edge_loader, leave=True, total=len(edge_loader))
        
        for data in t:
            edge_to, edge_from, a_to, a_from = data

            edge_to = edge_to.to(device=self.DEVICE, dtype=torch.float32)
            edge_from = edge_from.to(device=self.DEVICE, dtype=torch.float32)
            a_to = a_to.to(device=self.DEVICE, dtype=torch.float32)
            a_from = a_from.to(device=self.DEVICE, dtype=torch.float32)

            outputs = self.model(edge_to, edge_from)
            umap_l, recon_l, temporal_l, loss = self.criterion(edge_to, edge_from, a_to, a_from, self.model, outputs)
     
              
            all_loss.append(loss.mean().item())
            umap_losses.append(umap_l.item())
            recon_losses.append(recon_l.item())
            temporal_losses.append(temporal_l.mean().item())

            # ===================backward====================
            self.optimizer.zero_grad()
            loss.mean().backward()
            self.optimizer.step()
        self._loss = sum(all_loss) / len(all_loss)
        self.model.eval()
        print('umap:{:.4f}\trecon_l:{:.4f}\ttemporal_l:{:.4f}\tloss:{:.4f}'.format(sum(umap_losses) / len(umap_losses),
                                                                sum(recon_losses) / len(recon_losses),
                                                                sum(temporal_losses) / len(temporal_losses),
                                                                sum(all_loss) / len(all_loss)))
        return self.loss
    
    def run_epoch(self, epoch, current_loader, is_active_learning=False, is_full_data=False):
        print("====================\nepoch:{}\n===================".format(epoch+1))
        start_time = time.time()

        if is_active_learning and is_full_data == False:
            _, current_loader = self.al_loader()
            # Adjust learning rate for active learning
            if self.is_first_active_learning:
                print("change learning rate")
                for param_group in self.optimizer.param_groups:
                    param_group['lr'] *= 0.1  # or set to any value you want
                self.is_first_active_learning = False
            
        prev_loss = self.loss

        if is_full_data:
            print("full data")
            loss = self.train_step(self.edge_loader)  # use DVITrainer's train_step
        else:
            loss = self.train_step(current_loader)  # use DVITrainer's train_step
        
        self.lr_scheduler.step()

        elapsed_time = time.time() - start_time
        print("Epoch completed in: {:.2f} seconds".format(elapsed_time))

        return prev_loss, loss, current_loader
    
    def train(self, PATIENT, MAX_EPOCH_NUMS):
        start_flag = 1
        if start_flag:
            current_loader = self.edge_loader
            start_flag = 0
        print("ininin in dvi")
        patient = PATIENT
        time_start = time.time()
        # Pretraining
        # for epoch in range(10):
        #     print("Pretraining")
        #     _, _, current_loader= self.run_epoch(epoch, current_loader, is_active_learning=False,is_full_data=True)


        for epoch in range(MAX_EPOCH_NUMS):
            print("In active learning")
            # is_full_data = (epoch % 3 == 0)  # retrain with full data every RE_TRAINING_INTERVAL epochs
            prev_loss, loss, current_loader = self.run_epoch(epoch, current_loader, is_active_learning=True, is_full_data=False)
      
            # Early stop, check whether converge or not
            if abs(prev_loss - loss) < 5E-3:
                if patient == 0:
                    break
                else:
                    patient -= 1
            else:
                patient = PATIENT

        time_end = time.time()
        time_spend = time_end - time_start
        print("Time spend: {:.2f} for training vis model...".format(time_spend))   

        self.prev_model.load_state_dict(self.model.state_dict())
        for param in self.prev_model.parameters():
            param.requires_grad = False
        w_prev = dict(self.prev_model.named_parameters())
        
    
    def record_time(self, save_dir, file_name, operation, iteration, t):
        # save result
        save_file = os.path.join(save_dir, file_name+".json")
        if not os.path.exists(save_file):
            evaluation = dict()
        else:
            f = open(save_file, "r")
            evaluation = json.load(f)
            f.close()
        if operation not in evaluation.keys():
            evaluation[operation] = dict()
        evaluation[operation][iteration] = round(t, 3)
        with open(save_file, 'w') as f:
            json.dump(evaluation, f)