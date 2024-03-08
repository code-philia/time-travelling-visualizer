from abc import ABC, abstractmethod
import os
import time
import gc 
import json
from tqdm import tqdm
import torch
from torch.utils.data import DataLoader, WeightedRandomSampler

import copy
import numpy as np
from singleVis.custom_weighted_random_sampler import CustomWeightedRandomSampler
from singleVis.edge_dataset import DVIDataHandler
from singleVis.eval.evaluator import Evaluator
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

class TrustTrainer(SingleVisTrainer):
    def __init__(self, model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE,combined_loader,boundary_loss):
        super().__init__(model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE)
        self.combined_loader = combined_loader
        self.boundary_loss = boundary_loss
    
    
    def train_step(self,data_provider,iteration):
        
        projector = PROCESSProjector(self.model, data_provider.content_path, '', self.DEVICE)
        evaluator = Evaluator(data_provider, projector)
        evaluator.eval_inv_train(iteration)
        evaluator.eval_inv_test(iteration)

        self.model = self.model.to(device=self.DEVICE)
        self.model.train()
        all_loss = []
        umap_losses = []
        recon_losses = []
        temporal_losses = []
        b_losses = []
        
        total_loss = 0

        ####### for conterfactural pairs

        if self.combined_loader != None:
            t2 = tqdm(self.combined_loader, leave=True, total=len(self.combined_loader))

            for data in t2:
                edge_to, edge_from, a_to, a_from, labels = data
                edge_to = edge_to.to(device=self.DEVICE, dtype=torch.float32)
                edge_from = edge_from.to(device=self.DEVICE, dtype=torch.float32)
                a_to = a_to.to(device=self.DEVICE, dtype=torch.float32)
                a_from = a_from.to(device=self.DEVICE, dtype=torch.float32)
                # outputs = self.model(edge_to, edge_from)

                non_boundary_mask = labels == 0
                boundary_mask = labels == 1
    
                # boundary crossing
                if boundary_mask.any():
                    boundary_loss = self.boundary_loss(edge_to[boundary_mask], edge_from[boundary_mask], self.model)
                    b_losses.append(boundary_loss.mean().item())
                # non-boundary crossing
                if non_boundary_mask.any():
                    umap_l, recon_l, temporal_l, loss = self.criterion(edge_to[non_boundary_mask], edge_from[non_boundary_mask], 
                                               a_to[non_boundary_mask], a_from[non_boundary_mask], 
                                               self.model)
                    all_loss.append(loss.mean().item())
                    umap_losses.append(umap_l.item())
                    recon_losses.append(recon_l.item())
                    temporal_losses.append(temporal_l.mean().item())
    

                # combine loss
                total_loss = loss.mean() + boundary_loss.mean() if boundary_mask.any() else loss.mean()
                all_loss.append(total_loss.item())
            
                self.optimizer.zero_grad()
                total_loss.backward()
                # loss_new.backward()
                self.optimizer.step()
            
            b_loss= sum(b_losses) / len(b_losses) if b_losses else 0
        
        else:
            b_loss = 0

            t = tqdm(self.edge_loader, leave=True, total=len(self.edge_loader))
        
            for data in t:
                edge_to, edge_from, a_to, a_from,_ = data

                edge_to = edge_to.to(device=self.DEVICE, dtype=torch.float32)
                edge_from = edge_from.to(device=self.DEVICE, dtype=torch.float32)
                a_to = a_to.to(device=self.DEVICE, dtype=torch.float32)
                a_from = a_from.to(device=self.DEVICE, dtype=torch.float32)

                # outputs = self.model(edge_to, edge_from)
                umap_l, recon_l, temporal_l, loss = self.criterion(edge_to, edge_from, a_to, a_from, self.model)
                # + 1 * radius_loss + orthogonal_loss

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
        
        
        print('umap:{:.4f}\trecon_l:{:.4f}\tb_loss{:.4f}\tloss:{:.4f}'.format(sum(umap_losses) / len(umap_losses),
                                                                sum(recon_losses) / len(recon_losses),
                                                                b_loss, sum(all_loss) / len(all_loss)))
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
    def train(self, PATIENT, MAX_EPOCH_NUMS, data_provider, iteration):
        patient = PATIENT
        time_start = time.time()
        for epoch in range(MAX_EPOCH_NUMS):
            print("====================\nepoch:{}\n===================".format(epoch+1))
            prev_loss = self.loss
            loss = self.train_step(data_provider, iteration)
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

