from abc import ABC, abstractmethod
import os
import time
import gc 
import json
from tqdm import tqdm
import torch


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



class SingleVisTrainer(TrainerAbstractClass):
    def __init__(self, model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE):
        self.model = model
        self.criterion = criterion
        self.optimizer = optimizer
        self.lr_scheduler = lr_scheduler
        self.DEVICE = DEVICE
        self.edge_loader = edge_loader
        self._loss = 100.0
        self.ttav_indices = []
        self.ttav_mode = "coarse"


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
        """
        Step 4 & 5: Enhanced train_step with TTAV focus-based weighting and dynamic sampling.
        This replaces the original train_step to support Balanced and Fine modes.
        """
        self.model.to(device=self.DEVICE)
        self.model.train()
        all_loss = []
        umap_losses = []
        recon_losses = []

        # [TTAV] Use tqdm for tracking, consistent with original implementation
        t = tqdm(self.edge_loader, leave=True, total=len(self.edge_loader))

        for data in t:
            # [TTAV] Destructure data from edge_dataset. 
            # Expecting: (edge_to, edge_from, a_to, a_from, idx_to, idx_from)
            # Note: Ensure edge_dataset.py __getitem__ returns these 6 elements.
            edge_to, edge_from, a_to, a_from, idx_to, idx_from = data

            # Move tensors to the configured device (GPU/CPU)
            edge_to = edge_to.to(device=self.DEVICE, dtype=torch.float32)
            edge_from = edge_from.to(device=self.DEVICE, dtype=torch.float32)
            a_to = a_to.to(device=self.DEVICE, dtype=torch.float32)
            a_from = a_from.to(device=self.DEVICE, dtype=torch.float32)
            
            # [TTAV] Step 5: Construct sample-wise importance weights for the current batch
            batch_weights = torch.ones(edge_to.shape[0]).to(device=self.DEVICE)
            
            # Only apply weighting if we are NOT in coarse mode and have selected indices
            if self.ttav_mode != "coarse" and self.ttav_indices:
                # Alpha controls the intensity of focus: 2.0 for Balanced, 5.0 for Fine
                alpha = 2.0 if self.ttav_mode == "balanced" else 5.0
                
                # Efficiently create a mask for samples within the user's selected focus area
                # We boost the loss if either end of the training edge is in the focus set
                focus_mask = torch.tensor(
                    [(i.item() in self.ttav_indices or j.item() in self.ttav_indices) 
                    for i, j in zip(idx_to, idx_from)],
                    dtype=torch.bool
                ).to(device=self.DEVICE)
                
                # Amplify the loss for focus area samples
                batch_weights[focus_mask] *= alpha

            # Forward pass through the visualization model
            outputs = self.model(edge_to, edge_from)
            
            # [TTAV] Step 5: Pass the batch_weights to the loss function (criterion)
            # Ensure your criterion.forward in losses.py supports the 'weights' argument
            umap_l, recon_l, loss = self.criterion(
                edge_to, edge_from, a_to, a_from, outputs, weights=batch_weights
            )

            all_loss.append(loss.item())
            umap_losses.append(umap_l.item())
            recon_losses.append(recon_l.item())

            # =================== backward ====================
            self.optimizer.zero_grad()
            loss.backward()
            self.optimizer.step()

        # Calculate average epoch loss
        self._loss = sum(all_loss) / len(all_loss)
        self.model.eval()
        
        # Keeping the original logging format
        print('umap:{:.4f}\trecon_l:{:.4f}\tloss:{:.4f}'.format(
            sum(umap_losses) / len(umap_losses),
            sum(recon_losses) / len(recon_losses),
            sum(all_loss) / len(all_loss)
        ))
        
        return self.loss 

         # # tool/visualize/strategy/trainer.py

    # def train(self, PATIENT, MAX_EPOCH_NUMS):
    #     patient = PATIENT
    #     time_start = time.time()
    #     for epoch in range(MAX_EPOCH_NUMS):
    #         print("====================\nepoch:{}\n===================".format(epoch+1))
    #         prev_loss = self.loss
    #         loss = self.train_step()
    #         self.lr_scheduler.step()
    #         # early stop, check whether converge or not
    #         if prev_loss - loss < 5E-3:
    #             if patient == 0:
    #                 break
    #             else:
    #                 patient -= 1
    #         else:
    #             patient = PATIENT

    #     time_end = time.time()
    #     time_spend = time_end - time_start
    #     print("Time spend: {:.2f} for training vis model...".format(time_spend))
    def train(self, epochs):
        """
        Step 6: LoRA-based local fine-tuning logic.
        """
        # 1. Inject LoRA layers if not already present (only for Fine mode)
        if self.ttav_mode == "fine" and not hasattr(self, "lora_injected"):
            from tool.visualize.visualize_model import inject_lora
            # We target the decoder as it's responsible for the final 2D layout
            inject_lora(self.model, target_layer_names=["decoder"])
            self.lora_injected = True
            
            # Re-initialize optimizer to include new LoRA parameters
            self.optimizer = torch.optim.Adam(self.model.parameters(), lr=self.lr)

        for epoch in range(epochs):
            if self.ttav_mode == "fine":
                # 2. Freeze base weights, unfreeze ONLY LoRA parameters
                for name, param in self.model.named_parameters():
                    param.requires_grad = "lora_" in name
            else:
                # Standard mode: ensure everything is trainable
                for param in self.model.parameters():
                    param.requires_grad = True

            self.train_step()

            # tool/visualize/strategy/trainer.py

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

    # tool/visualize/strategy/trainer.py

    def update_weights(self):
        """
        Step 4: 实现 CustomWeightedRandomSampler 的动态重分配算子 [cite: 33]
        """
        mode = ttav_context["focus_mode"]
        indices = ttav_context["selected_indices"]
        
        # 基础权重为 1.0
        weights = torch.ones(self.total_data_size)
        
        if mode == "balanced":
            weights[indices] *= 2.0 # Balanced 模式采样概率提升至 200% [cite: 31]
        elif mode == "fine":
            weights[indices] *= 5.0 # Fine 模式采样概率提升至 500% [cite: 32]
            
        self.sampler.weights = weights

    # def train_step(self, data, target, indices):
    #     """
    #     Step 5: Loss 策略：基于强度的局部增强 [cite: 35]
    #     """
    #     output = self.model(data)
    #     loss_elements = self.criterion(output, target) # 假设返回的是样本级 loss
        
    #     # 获取当前 Batch 的掩码
    #     batch_mask = ttav_context["mask"][indices]
        
    #     # Step 5: 对焦点区域应用 alpha 权重因子 [cite: 36, 38]
    #     alpha = 5.0 if ttav_context["focus_mode"] == "fine" else 2.0
    #     weights = torch.where(batch_mask, torch.tensor(alpha).to(device), torch.tensor(1.0).to(device))
        
    #     loss = (loss_elements * weights).mean() # 显著提升局部误差梯度强度 [cite: 38]
    #     # ... 反向传播 ...
    
    def update_ttav_context(self, indices, mode):
            """
            [TTAV] Unified entry point to update trainer state from the server.
            This method will be inherited by all specific trainers (DVI, TimeVis, etc.).
            """
            self.ttav_indices = indices
            self.ttav_mode = mode
            
            # Relate the update to the data loader's sampler
            # Most strategies use an edge_loader containing a custom sampler
            if hasattr(self, "edge_loader") and self.edge_loader is not None:
                # Check if the sampler supports dynamic weight updates
                sampler = getattr(self.edge_loader, "sampler", None)
                if sampler and hasattr(sampler, "update_weights"):
                    sampler.update_weights(indices, mode)
                    print(f"[TTAV] SingleVisTrainer: Weights updated for {len(indices)} points (Mode: {mode})")

                    
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
        

class DVITrainer(SingleVisTrainer):
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

            # outputs = self.model(edge_to, edge_from)
            umap_l, recon_l, temporal_l, loss = self.criterion(edge_to, edge_from, a_to, a_from, self.model)
            all_loss.append(loss.item())
            umap_losses.append(umap_l.item())
            recon_losses.append(recon_l.item())
            temporal_losses.append(temporal_l.item())
            # ===================backward====================
            self.optimizer.zero_grad()
            loss.backward()
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


class TrustTrainer(SingleVisTrainer):
    def __init__(self, model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE,combined_loader,boundary_loss):
        super().__init__(model, criterion, optimizer, lr_scheduler, edge_loader, DEVICE)
        self.combined_loader = combined_loader
        self.boundary_loss = boundary_loss
    
    
    def train_step(self,data_provider,iteration):
        
        # projector = PROCESSProjector(self.model, data_provider.content_path, '', self.DEVICE)
        # evaluator = Evaluator(data_provider, projector)
        # evaluator.eval_inv_train(iteration)
        # evaluator.eval_inv_test(iteration)

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
            t2 = tqdm(self.combined_loader, leave=True, total=len(self.combined_loader), desc="train_step")

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
                                               a_to[non_boundary_mask], a_from[non_boundary_mask], self.model)
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
                
            print("successful")
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
            print("====================\nepoch:{}\n====================".format(epoch+1))
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