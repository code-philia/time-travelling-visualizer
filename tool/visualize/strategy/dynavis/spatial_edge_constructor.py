from umap.umap_ import fuzzy_simplicial_set
from pynndescent import NNDescent
from sklearn.neighbors import NearestNeighbors
from sklearn.utils import check_random_state
import numpy as np
from strategy.dynavis.dynavis_utils import get_graph_elements

class SpatialEdgeConstructor:
    def __init__(self, data_provider, init_num, s_n_epochs, b_n_epochs, n_neighbors):
        self.config = data_provider.config
        self.data_provider = data_provider
        self.init_num = init_num
        self.s_n_epochs = s_n_epochs
        self.b_n_epochs = b_n_epochs
        self.n_neighbors = n_neighbors

    def _construct_fuzzy_complex(self, train_data):
        n_trees = min(64, 5 + int(round(train_data.shape[0] ** 0.5 / 20.0)))
        n_iters = max(5, int(round(np.log2(train_data.shape[0]))))
        nnd = NNDescent(
            train_data,
            n_neighbors=self.n_neighbors,
            metric="euclidean",
            n_trees=n_trees,
            n_iters=n_iters,
            max_candidates=60,
            verbose=False
        )
        knn_indices, knn_dists = nnd.neighbor_graph
        
        random_state = check_random_state(None)
        complex, sigmas, rhos = fuzzy_simplicial_set(
            X=train_data,
            n_neighbors=self.n_neighbors,
            metric="euclidean",
            random_state=random_state,
            knn_indices=knn_indices,
            knn_dists=knn_dists,
        )
        return complex, sigmas, rhos, knn_indices
    
    def _construct_step_edge_dataset(self, vr_complex):
        if vr_complex is None:
            return None, None, None
        
        _, vr_head, vr_tail, vr_weight, _ = get_graph_elements(vr_complex, self.s_n_epochs)
        return vr_head, vr_tail, vr_weight

    def construct(self):
        edge_to = []
        edge_from = []
        feature_vectors = []
        time_step_nums = []
        time_step_idxs_list = []
        all_probs = []
        
        available_epochs = self.config['available_epochs']
        for t in available_epochs:
            train_data = self.data_provider.get_representation(t,type='train')
            
            if train_data is None:
                continue
            
            complex, sigmas, rhos, knn_indices = self._construct_fuzzy_complex(train_data)
            head, tail, weight = self._construct_step_edge_dataset(complex)
            
            edge_to.append(head)
            edge_from.append(tail)
            feature_vectors.append(train_data)
            
            probs = np.ones_like(weight) / len(weight)  
            all_probs.append(probs)
            
            time_step_nums.append((train_data.shape[0], 0))
            time_step_idxs_list.append(np.arange(train_data.shape[0]).tolist())
        
        edge_to = np.concatenate(edge_to, axis=0)
        edge_from = np.concatenate(edge_from, axis=0)
        feature_vectors = np.vstack(feature_vectors)
        time_step_nums = np.array(time_step_nums)
        all_probs = np.concatenate(all_probs, axis=0)
        
        probs = all_probs / all_probs.max()
        
        return edge_to, edge_from, probs, feature_vectors, time_step_nums, time_step_idxs_list

class IncrSpatialEdgeConstructor:
    def __init__(self, data_provider, init_num, s_n_epochs, b_n_epochs, n_neighbors):
        self.data_provider = data_provider
        self.init_num = init_num
        self.s_n_epochs = s_n_epochs
        self.b_n_epochs = b_n_epochs
        self.n_neighbors = n_neighbors

    def _construct_fuzzy_complex(self, train_data):
        n_trees = min(64, 5 + int(round(train_data.shape[0] ** 0.5 / 20.0)))
        n_iters = max(5, int(round(np.log2(train_data.shape[0]))))
        nnd = NNDescent(
            train_data,
            n_neighbors=self.n_neighbors,
            metric="euclidean",
            n_trees=n_trees,
            n_iters=n_iters,
            max_candidates=60,
            verbose=False
        )
        knn_indices, knn_dists = nnd.neighbor_graph
        
        random_state = check_random_state(None)
        complex, sigmas, rhos = fuzzy_simplicial_set(
            X=train_data,
            n_neighbors=self.n_neighbors,
            metric="euclidean",
            random_state=random_state,
            knn_indices=knn_indices,
            knn_dists=knn_dists,
        )
        return complex, sigmas, rhos, knn_indices
    
    def _construct_step_edge_dataset(self, vr_complex):
        if vr_complex is None:
            return None, None, None
        
        _, vr_head, vr_tail, vr_weight, _ = get_graph_elements(vr_complex, self.s_n_epochs)
        return vr_head, vr_tail, vr_weight

    def construct(self):
        edge_to = []
        edge_from = []
        feature_vectors = []
        groups_list = []
        time_step_nums = []
        time_step_idxs_list = []
        all_probs = []
        
        for t in range(self.data_provider.s, self.data_provider.e + 1, self.data_provider.p):
            train_data, groups = self.data_provider.train_representation(t)
            if train_data is None:
                continue
            
            complex, sigmas, rhos, knn_indices = self._construct_fuzzy_complex(train_data)
            head, tail, weight = self._construct_step_edge_dataset(complex)
            
            edge_to.append(head)
            edge_from.append(tail)
            feature_vectors.append(train_data)
            groups_list.append(groups)
            
            probs = np.ones_like(weight) / len(weight)  
            all_probs.append(probs)
            
            time_step_nums.append((train_data.shape[0], 0))
            time_step_idxs_list.append(np.arange(train_data.shape[0]).tolist())
        
        edge_to = np.concatenate(edge_to, axis=0)
        edge_from = np.concatenate(edge_from, axis=0)
        feature_vectors = np.vstack(feature_vectors)
        groups_list = np.concatenate(groups_list)
        time_step_nums = np.array(time_step_nums)
        all_probs = np.concatenate(all_probs, axis=0)
        
        probs = all_probs / all_probs.max()
        
        return edge_to, edge_from, probs, feature_vectors, time_step_nums, time_step_idxs_list, groups_list

class SimplifiedEdgeConstructor:
    def __init__(self, data_provider, init_num, s_n_epochs, b_n_epochs, n_neighbors):
        self.data_provider = data_provider
        self.init_num = init_num
        self.s_n_epochs = s_n_epochs
        self.b_n_epochs = b_n_epochs
        self.n_neighbors = n_neighbors

    def construct(self):
        """构建时间序列数据的边
        
        对于每个点，连接到时间维度上最近的n_neighbors个点
        使用与原始SpatialEdgeConstructor相同的权重计算方法
        
        Returns:
            edge_to: 边的目标节点索引
            edge_from: 边的源节点索引
            probs: 边的概率权重
            feature_vectors: 所有时间步的特征向量
            time_step_nums: 每个时间步的节点数量
            time_step_idxs_list: 每个时间步的节点索引列表
        """
        feature_vectors = []
        time_step_nums = []
        time_step_idxs_list = []
        epochs = []
        
        for t in range(self.data_provider.s, self.data_provider.e + 1, self.data_provider.p):
            data = self.data_provider.train_representation(t)
            
            feature_vectors.append(data)
            epochs.append(t)
            time_step_nums.append((1, 0)) 
            time_step_idxs_list.append([0])
        
        if len(feature_vectors) == 0:
            return None, None, None, None, None, None
            
        
        feature_vectors = np.vstack(feature_vectors)
        time_step_nums = np.array(time_step_nums)
    
        if len(feature_vectors) >= self.n_neighbors + 1:
            nn = NearestNeighbors(n_neighbors=min(self.n_neighbors + 1, len(feature_vectors)))
            nn.fit(feature_vectors)
            knn_dists, knn_indices = nn.kneighbors(feature_vectors)
            
            n_samples = feature_vectors.shape[0]
            rows = []
            cols = []
            vals = []
            
            for i in range(n_samples):
                for j, dist in zip(knn_indices[i][1:], knn_dists[i][1:]):  # 跳过第一个，因为是自己
                    # 计算UMAP权重：1.0 / (1.0 + a * dist ** (2 * b))
                    # 这里简化使用 1.0 / (1.0 + dist)
                    weight = 1.0 / (1.0 + dist)
                    rows.append(i)
                    cols.append(j)
                    vals.append(weight)
            
            from scipy.sparse import coo_matrix
            graph = coo_matrix((vals, (rows, cols)), shape=(n_samples, n_samples))
            
            transpose = graph.transpose()
            prod_matrix = graph.multiply(transpose)
            
            set_op_mix_ratio = 1.0
            result = (
                set_op_mix_ratio * (graph + transpose - prod_matrix)
                + (1.0 - set_op_mix_ratio) * prod_matrix
            )
            result.eliminate_zeros()
            
            _, edge_to, edge_from, weights, _ = get_graph_elements(result, n_epochs=self.s_n_epochs)
            probs = np.ones_like(weights) / len(weights)
            
            return edge_to, edge_from, probs, feature_vectors, time_step_nums, time_step_idxs_list
        else:
            edge_from = []
            edge_to = []
            weights = []
            
            for i in range(len(feature_vectors)):
                for j in range(len(feature_vectors)):
                    if i != j:  # 避免自环
                        edge_from.append(i)
                        edge_to.append(j)
                        dist = np.linalg.norm(feature_vectors[i] - feature_vectors[j])
                        weight = 1.0 / (1.0 + dist)
                        weights.append(weight)
            
            edge_from = np.array(edge_from)
            edge_to = np.array(edge_to)
            weights = np.array(weights)
            probs = np.ones_like(weights) / len(weights)
            
            return edge_to, edge_from, probs, feature_vectors, time_step_nums, time_step_idxs_list