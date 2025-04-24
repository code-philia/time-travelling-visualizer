import torch
from torch import nn
import torch.nn.functional as F
from strategy.dynavis.dynavis_utils import convert_distance_to_probability, compute_cross_entropy
import numpy as np
from tqdm import tqdm

class UmapLoss(nn.Module):
    def __init__(self, negative_sample_rate, device, a=1.0, b=1.0, repulsion_strength=1.0):
        super(UmapLoss, self).__init__()

        self._negative_sample_rate = negative_sample_rate
        self._a = a,
        self._b = b,
        self._repulsion_strength = repulsion_strength
        self.DEVICE = torch.device(device)

    @property
    def a(self):
        return self._a[0]

    @property
    def b(self):
        return self._b[0]

    def forward(self, embedding_to, embedding_from):
        batch_size = embedding_to.shape[0]
        # get negative samples
        embedding_neg_to = torch.repeat_interleave(embedding_to, self._negative_sample_rate, dim=0)
        repeat_neg = torch.repeat_interleave(embedding_from, self._negative_sample_rate, dim=0)
        randperm = torch.randperm(repeat_neg.shape[0])
        embedding_neg_from = repeat_neg[randperm]

        #  distances between samples (and negative samples)
        distance_embedding = torch.cat(
            (
                torch.norm(embedding_to - embedding_from, dim=1),
                torch.norm(embedding_neg_to - embedding_neg_from, dim=1),
            ),
            dim=0,
        )
        probabilities_distance = convert_distance_to_probability(
            distance_embedding, self.a, self.b
        )
        probabilities_distance = probabilities_distance.to(self.DEVICE)

        # set true probabilities based on negative sampling
        probabilities_graph = torch.cat(
            (torch.ones(batch_size), torch.zeros(batch_size * self._negative_sample_rate)), dim=0,
        )
        probabilities_graph = probabilities_graph.to(device=self.DEVICE)

        # compute cross entropy
        (_, _, ce_loss) = compute_cross_entropy(
            probabilities_graph,
            probabilities_distance,
            repulsion_strength=self._repulsion_strength,
        )

        return torch.mean(ce_loss)

class ReconLoss(torch.nn.Module):
    def __init__(self, beta=1.0):
        super(ReconLoss, self).__init__()
        self._beta = beta

    def forward(self, edge_to, edge_from, recon_to, recon_from):
        loss1 = torch.mean(torch.mean(torch.pow(edge_to - recon_to, 2), 1))
        loss2 = torch.mean(torch.mean(torch.pow(edge_from - recon_from, 2), 1))
        return (loss1 + loss2) / 2

class TemporalRankingLoss(nn.Module):
    def __init__(self, data_provider, temporal_edges):
        """
        :param data_provider: 数据提供者
        :param temporal_edges: (t_edge_from, t_edge_to) 所有时序边
        """
        super(TemporalRankingLoss, self).__init__()
        self.t_edge_from, self.t_edge_to = temporal_edges
        self.neighbor_ranks = self._precompute_neighbor_ranks()
        
    def _precompute_neighbor_ranks(self):
        """
        Precompute the distance rank between each point and its neighbors.
        :return: Dict[int, Dict[int, int]] 
                {from_idx: {to_idx: rank}}
        """
        neighbor_ranks = {}
        
        # Convert numpy arrays to tensors if necessary
        if isinstance(self.t_edge_from, np.ndarray):
            self.t_edge_from = torch.tensor(self.t_edge_from)
        if isinstance(self.t_edge_to, np.ndarray):
            self.t_edge_to = torch.tensor(self.t_edge_to)
        
        # For each unique 'from' feature
        unique_from = torch.unique(self.t_edge_from, dim=0)
        
        for from_feat in tqdm(unique_from, desc="Computing neighbor ranks"):
            from_key = tuple(from_feat.tolist())  # Convert tensor to a tuple for use as a dictionary key
            neighbor_ranks[from_key] = {}
            
            # Find all 'to' features corresponding to the current 'from'
            mask = (self.t_edge_from == from_feat).all(dim=1)
            curr_to_feats = self.t_edge_to[mask]
            
            # Print the number of neighbors for the current 'from'
            # num_neighbors = curr_to_feats.size(0)
            # print(f"Edge from {from_key} has {num_neighbors} neighbors.")
            
            # Compute distances to all neighbors
            D = torch.norm(curr_to_feats - from_feat.unsqueeze(0), dim=1)
            
            # Get sorted indices
            sorted_indices = torch.argsort(D)
            
            # Store the rank of each neighbor
            for rank, idx in enumerate(sorted_indices):
                to_key = tuple(curr_to_feats[idx].tolist())  # Convert tensor to a tuple for use as a dictionary key
                neighbor_ranks[from_key][to_key] = rank
        
        return neighbor_ranks
    
    def forward(self, edge_to, edge_from, embedding_to, embedding_from, is_temporal):
        """
        :param edge_to: 当前batch中的目标节点特征
        :param edge_from: 当前batch中的源节点特征
        :param embedding_to: 目标节点的低维嵌入
        :param embedding_from: 源节点的低维嵌入
        :param is_temporal: 是否为时序边的标记
        """
        if not torch.any(is_temporal):
            return torch.tensor(0.0, device=edge_from.device, requires_grad=True)
        
        # 只保留时序边
        temporal_mask = is_temporal.bool()
        edge_to = edge_to[temporal_mask]
        edge_from = edge_from[temporal_mask]
        embedding_to = embedding_to[temporal_mask]
        embedding_from = embedding_from[temporal_mask]
        
        loss = torch.tensor(0.0, device=edge_from.device, requires_grad=True)
        valid_pairs = 0
        
        # 对当前batch中的每个from节点
        unique_from = torch.unique(edge_from, dim=0)
        # Use vectorized operations to speed up the computation
        from_keys = [tuple(from_feat.tolist()) for from_feat in unique_from]
        valid_from_keys = [key for key in from_keys if key in self.neighbor_ranks]
        
        for from_key in valid_from_keys:
            precomputed_ranks = self.neighbor_ranks[from_key]
            
            # Ensure the tensor is on the same device
            from_key_tensor = torch.tensor(from_key, device=edge_from.device)
            mask = torch.all(edge_from == from_key_tensor, dim=1)
            curr_to_feats = edge_to[mask]
            curr_to_embeds = embedding_to[mask]
            curr_from_embed = embedding_from[mask][0]
            
            D_low = torch.norm(curr_to_embeds - curr_from_embed, dim=1)
            
            to_keys = [tuple(to_feat.tolist()) for to_feat in curr_to_feats]
            valid_to_keys = [key for key in to_keys if key in precomputed_ranks]
            
            high_ranks = torch.tensor([precomputed_ranks[key] for key in valid_to_keys], device=edge_from.device)
            D_low_valid = D_low[[to_keys.index(key) for key in valid_to_keys]]
            
            for i in range(len(valid_to_keys)):
                for k in range(i + 1, len(valid_to_keys)):
                    if high_ranks[i] < high_ranks[k] and D_low_valid[i] >= D_low_valid[k]:
                        # rank_diff = abs(high_ranks[i] - high_ranks[k])
                        # loss = loss + (D_low_valid[i] - D_low_valid[k]) * rank_diff
                        loss = loss + (D_low_valid[i] - D_low_valid[k])
                        valid_pairs += 1
        
        if valid_pairs == 0:
            return torch.tensor(0.0, device=edge_from.device, requires_grad=True)
        
        return loss / valid_pairs


class TemporalVelocityLoss(nn.Module):
    def __init__(self, temperature=1.0):
        """
        计算高维和低维空间中时序运动相似度的一致性损失
        
        Args:
            temperature: 控制相似度计算的温度参数
        """
        super(TemporalVelocityLoss, self).__init__()
        self.temperature = temperature
        
    def compute_normalized_similarity(self, x1, x2, batch_wise=True):
        """
        计算归一化后的相似度
        
        Args:
            x1, x2: 需要计算距离的两组向量
            batch_wise: 是否在batch内进行归一化
        """
        # 计算欧氏距离
        dist = torch.norm(x1 - x2, dim=1)
        
        if batch_wise:
            # 在batch内进行min-max归一化
            min_dist = torch.min(dist)
            max_dist = torch.max(dist)
            if max_dist - min_dist > 1e-8:  # 避免除零
                dist = (dist - min_dist) / (max_dist - min_dist)
            else:
                dist = torch.zeros_like(dist)
        
        # 将归一化后的距离转换为相似度分数 (0到1之间)
        similarity = torch.exp(-dist / self.temperature)
        return similarity, dist
        
    def forward(self, edge_to, edge_from, embedding_to, embedding_from, is_temporal):
        """
        计算高维和低维空间中运动相似度的一致性损失
        
        Args:
            edge_to: 高维空间中的目标节点特征
            edge_from: 高维空间中的源节点特征
            embedding_to: 低维空间中的目标节点嵌入
            embedding_from: 低维空间中的源节点嵌入
            is_temporal: 标识时序边的布尔张量
        """
        if not torch.any(is_temporal):
            return torch.tensor(0.0, device=edge_from.device, requires_grad=True)
            
        # 只处理时序边
        temporal_mask = is_temporal.bool()
        edge_to = edge_to[temporal_mask]
        edge_from = edge_from[temporal_mask]
        embedding_to = embedding_to[temporal_mask]
        embedding_from = embedding_from[temporal_mask]
        
        # 计算高维和低维空间中的相似度和归一化距离
        high_dim_similarity, high_dim_dist = self.compute_normalized_similarity(edge_from, edge_to)
        low_dim_similarity, low_dim_dist = self.compute_normalized_similarity(embedding_from, embedding_to)
        
        # 使用二元交叉熵损失
        similarity_loss = F.binary_cross_entropy(low_dim_similarity, high_dim_similarity)
        
        # 添加距离相关性损失
        # 使用MSE确保归一化后的距离模式相似
        distance_loss = F.mse_loss(low_dim_dist, high_dim_dist)
        
        # 总损失是相似度损失和距离损失的加权和
        total_loss = similarity_loss + distance_loss
        
        return total_loss

class SingleVisLoss(nn.Module):
    def __init__(self, umap_loss, recon_loss, temporal_loss=None, velocity_loss=None, lambd=1.0, gamma=1.0, delta=1.0):
        super(SingleVisLoss, self).__init__()
        self.umap_loss = umap_loss
        self.recon_loss = recon_loss
        self.temporal_loss = temporal_loss
        self.velocity_loss = velocity_loss  # 新添加的运动相似度损失
        self.lambd = lambd
        self.gamma = gamma
        self.delta = delta  # 运动相似度损失的权重

    def forward(self, edge_to, edge_from, outputs, is_temporal):
        """
        :param edge_to: 高维特征
        :param edge_from: 高维特征
        :param outputs: 模型输出的字典，包含umap和重构结果
        :param is_temporal: 布尔张量，标识哪些边是时序边
        """
        embedding_to, embedding_from = outputs["umap"]
        recon_to, recon_from = outputs["recon"]
        
        # UMAP loss
        umap_loss = self.umap_loss(embedding_to, embedding_from)
        
        # Reconstruction loss (disabled)
        recon_loss = torch.tensor(0.0, device=edge_from.device)
        
        # Temporal ranking loss
        temporal_loss = 0.0
        if self.temporal_loss is not None:
            temporal_loss = self.temporal_loss(
                edge_to, 
                edge_from, 
                embedding_to, 
                embedding_from,
                is_temporal
            )
            
        # Velocity consistency loss
        velocity_loss = 0.0
        if self.velocity_loss is not None:
            velocity_loss = self.velocity_loss(
                edge_to,
                edge_from,
                embedding_to,
                embedding_from,
                is_temporal
            )
        
        # Total loss
        # TODO: without reconstruction loss?
        total_loss = umap_loss + self.gamma * temporal_loss + self.delta * velocity_loss
        
        return umap_loss, recon_loss, temporal_loss, velocity_loss, total_loss
