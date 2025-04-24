import torch
import time
from tqdm import tqdm
import os

class SingleVisTrainer:
    def __init__(self, model, criterion, optimizer, lr_scheduler, edge_loader):
        self.model = model
        self.criterion = criterion
        self.optimizer = optimizer
        self.lr_scheduler = lr_scheduler
        self.DEVICE = self.model.device
        self.edge_loader = edge_loader
        self._loss = 100.0
        self.epoch = 0

    def train_step(self):
        self.model.train()
        all_loss = []
        umap_losses = []
        recon_losses = []
        temporal_losses = []
        velocity_losses = []

        t = tqdm(self.edge_loader, leave=True, total=len(self.edge_loader))
        for data in t:
            edge_to, edge_from, is_temporal = data
            
            # 将数据移到设备上
            edge_to = edge_to.to(device=self.DEVICE, dtype=torch.float32)
            edge_from = edge_from.to(device=self.DEVICE, dtype=torch.float32)
            is_temporal = is_temporal.to(device=self.DEVICE)
            
            # 前向传播
            outputs = self.model(edge_to, edge_from)
            
            # 计算损失
            umap_l, recon_l, temporal_l, velocity_l, loss = self.criterion(
                edge_to, 
                edge_from, 
                outputs,
                is_temporal
            )
    
            # 记录损失
            all_loss.append(loss.item())
            umap_losses.append(umap_l.item())
            recon_losses.append(recon_l.item())
            temporal_losses.append(temporal_l.item())
            velocity_losses.append(velocity_l.item())
            
            # 反向传播
            self.optimizer.zero_grad()
            loss.backward()
            self.optimizer.step()

        # 更新学习率
        self.lr_scheduler.step()
        
        # 记录epoch损失
        self._loss = sum(all_loss) / len(all_loss)
        self.epoch_umap_loss = sum(umap_losses) / len(umap_losses)
        self.epoch_recon_loss = sum(recon_losses) / len(recon_losses)
        self.epoch_temporal_loss = sum(temporal_losses) / len(temporal_losses)
        self.epoch_velocity_loss = sum(velocity_losses) / len(velocity_losses)

    def train(self, PATIENT, max_epochs):
        patient = PATIENT
        best_loss = float("inf")
        time_start = time.time()

        for epoch in range(max_epochs):
            print(f"Epoch {epoch + 1}/{max_epochs}")
            prev_loss = self._loss
            self.train_step()

            print(f"UMAP Loss: {self.epoch_umap_loss:.4f}, "
                  f"Recon Loss: {self.epoch_recon_loss:.4f}, "
                  f"Temporal Loss: {self.epoch_temporal_loss:.4f}, "
                  f"Velocity Loss: {self.epoch_velocity_loss:.4f}, "
                  f"Total Loss: {self._loss:.4f}")

            if prev_loss - self._loss < 1E-2:
                if patient == 0:
                    break
                else:
                    patient -= 1
            else:
                patient = PATIENT

            self.epoch += 1

        time_end = time.time()
        time_spend = time_end - time_start
        print(f"Time spend: {time_spend:.2f} seconds for training vis model...")
        
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
            "loss": self._loss,
            "state_dict": self.model.state_dict(),
            "optimizer": self.optimizer.state_dict()}
        save_path = os.path.join(save_dir, file_name + '.pth')
        torch.save(save_model, save_path)
        print("Successfully save visualization model...")