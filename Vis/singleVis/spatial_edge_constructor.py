from abc import ABC, abstractmethod

import numpy as np
import os
import time
import math
import json

from scipy.stats import rankdata

from umap.umap_ import fuzzy_simplicial_set, make_epochs_per_sample
from pynndescent import NNDescent
from sklearn.neighbors import NearestNeighbors
from sklearn.utils import check_random_state

from singleVis.kcenter_greedy import kCenterGreedy
from singleVis.intrinsic_dim import IntrinsicDim
from singleVis.backend import get_graph_elements, get_attention
from singleVis.utils import find_neighbor_preserving_rate
import torch

from singleVis.utils import *

seed_value = 0

# np.random.seed(seed_value)
torch.manual_seed(seed_value)
torch.cuda.manual_seed(seed_value)
torch.cuda.manual_seed_all(seed_value)  
torch.backends.cudnn.deterministic = True  
torch.backends.cudnn.benchmark = False  

# Set the random seed for numpy
np.random.seed(seed_value)

class SpatialEdgeConstructorAbstractClass(ABC):
    @abstractmethod
    def __init__(self, data_provider) -> None:
        pass

    @abstractmethod
    def construct(self, *args, **kwargs):
        # return head, tail, weight, feature_vectors
        pass

    @abstractmethod
    def record_time(self, save_dir, file_name, operation, t):
        pass

'''Base class for Spatial Edge Constructor'''
class SpatialEdgeConstructor(SpatialEdgeConstructorAbstractClass):
    '''Construct spatial complex
    '''
    def __init__(self, data_provider, init_num, s_n_epochs, b_n_epochs, n_neighbors) -> None:
        """Init parameters for spatial edge constructor

        Parameters
        ----------
        data_provider : data.DataProvider
             data provider
        init_num : int
            init number to calculate c
        s_n_epochs : int
            the number of epochs to fit for one iteration(epoch)
            e.g. n_epochs=5 means each edge will be sampled 5*prob times in one training epoch
        b_n_epochs : int
            the number of epochs to fit boundary samples for one iteration (epoch)
        n_neighbors: int
            local connectivity
        """
        self.data_provider = data_provider
        self.init_num = init_num
        self.s_n_epochs = s_n_epochs
        self.b_n_epochs = b_n_epochs
        self.n_neighbors = n_neighbors


    def _construct_fuzzy_complex(self, train_data, metric="euclidean"):
        # """
        # construct a vietoris-rips complex
        # """
        # number of trees in random projection forest
        n_trees = min(64, 5 + int(round((train_data.shape[0]) ** 0.5 / 20.0)))
        # max number of nearest neighbor iters to perform
        n_iters = max(5, int(round(np.log2(train_data.shape[0]))))
        # distance metric
        # # get nearest neighbors
        
        nnd = NNDescent(
            train_data,
            n_neighbors=self.n_neighbors,
            metric=metric,
            n_trees=n_trees,
            n_iters=n_iters,
            max_candidates=60,
            verbose=True
        )
        knn_indices, knn_dists = nnd.neighbor_graph
        random_state = check_random_state(42)
        complex, sigmas, rhos = fuzzy_simplicial_set(
            X=train_data,
            n_neighbors=self.n_neighbors,
            metric=metric,
            random_state=random_state,
            knn_indices=knn_indices,
            knn_dists=knn_dists
        )
        return complex, sigmas, rhos, knn_indices
    def get_pred_diff( self, data, neibour_data, knn_indices, epoch):
        pred  = self.data_provider.get_pred(epoch, data)
        pred_n  = self.data_provider.get_pred(epoch, neibour_data)
        new_l =[]
        for i in range(len(knn_indices)):
            pred_i = pred_n[knn_indices[i]]
            pred_diff = np.mean(np.abs(pred_i - pred[i]), axis=-1) #
            
            pred_diff = np.exp(pred_diff) - 1  # amplify the difference
            new_l.append(pred_diff)

        new_l = np.array(new_l)
        return new_l

    
    def _construct_fuzzy_complex_pred_Diff(self, train_data, epoch):
        print("use pred")

        train_data = self.data_provider.get_pred(epoch, train_data)
        """
        construct a vietoris-rips complex based on prediction 
        """
        # number of trees in random projection forest
        n_trees = min(64, 5 + int(round((train_data.shape[0]) ** 0.5 / 20.0)))
        # max number of nearest neighbor iters to perform
        n_iters = max(5, int(round(np.log2(train_data.shape[0]))))
        # distance metric
        metric = "cosine"
        # get nearest neighbors
        
        nnd = NNDescent(
            train_data,
            n_neighbors=self.n_neighbors,
            metric=metric,
            n_trees=n_trees,
            n_iters=n_iters,
            max_candidates=60,
            verbose=True
        )
    
        # Compute the neighbor graph
        knn_indices, knn_dists = nnd.neighbor_graph
        random_state = check_random_state(None)
        complex, sigmas, rhos = fuzzy_simplicial_set(
            X=train_data,
            n_neighbors=self.n_neighbors,
            metric=metric,
            random_state=random_state,
            knn_indices=knn_indices,
            knn_dists=knn_dists
        )
        return complex, sigmas, rhos, knn_indices
    
   
    
    def _get_perturb_neibour(self,train_data,n_perturbations=10,perturbation_scale=0.04):
        # find neibour of each point
        X = train_data
        nn = NearestNeighbors(n_neighbors=self.n_neighbors)
        nn.fit(X)
        _, indices = nn.kneighbors(X)
        # generate pertubation
       
        for i in range(X.shape[0]):
            for j in range(self.n_neighbors):
                for _ in range(n_perturbations):
                 
                    perturbation = np.random.normal(scale=perturbation_scale, size=X.shape[1])
                 
                    perturbed_point = X[indices[i, j]] + perturbation
                    X_perturbed.append(perturbed_point)
        X_perturbed = np.array(X_perturbed)
        return X_perturbed
    

    def if_border(self,data):
        mesh_preds = self.data_provider.get_pred(self.iteration, data)
        mesh_preds = mesh_preds + 1e-8

        sort_preds = np.sort(mesh_preds, axis=1)
        diff = (sort_preds[:, -1] - sort_preds[:, -2]) / (sort_preds[:, -1] - sort_preds[:, 0])
        border = np.zeros(len(diff), dtype=np.uint8) + 0.05
        border[diff < 0.15] = 1
        
        return border
    

    def _construct_boundary_wise_complex(self, train_data, border_centers,n_neighbors=15, metric="euclidean"):
        """compute the boundary wise complex
            for each border point, we calculate its k nearest train points
            for each train data, we calculate its k nearest border points
        """
        high_neigh = NearestNeighbors(n_neighbors=n_neighbors, radius=0.4)
        high_neigh.fit(border_centers)
        fitting_data = np.concatenate((train_data, border_centers), axis=0)
        knn_dists, knn_indices = high_neigh.kneighbors(train_data, n_neighbors=n_neighbors, return_distance=True)
        knn_indices = knn_indices + len(train_data)

        high_bound_neigh = NearestNeighbors(n_neighbors=n_neighbors, radius=0.4)
        high_bound_neigh.fit(train_data)
        bound_knn_dists, bound_knn_indices = high_bound_neigh.kneighbors(border_centers, n_neighbors=n_neighbors, return_distance=True)
        
        knn_dists = np.concatenate((knn_dists, bound_knn_dists), axis=0)
        knn_indices = np.concatenate((knn_indices, bound_knn_indices), axis=0)


        random_state = check_random_state(42)
        bw_complex, sigmas, rhos = fuzzy_simplicial_set(
            X=fitting_data,
            n_neighbors=n_neighbors,
            metric=metric,
            random_state=random_state,
            knn_indices=knn_indices,
            knn_dists=knn_dists,
        )
        return bw_complex, sigmas, rhos, knn_indices
    
    def _construct_proxy_wise_complex(self, proxy, sample):
        """compute the boundary wise complex
            for each proxy point, we calculate its k nearest samples
        """
        fitting_data = np.concatenate((proxy, sample), axis=0)
        # Fit NearestNeighbors model on proxy
        high_neigh = NearestNeighbors(n_neighbors=self.n_neighbors, radius=0.4)
        high_neigh.fit(sample)
        # Find k-nearest neighbors in sample for each point in proxy
        knn_dists, knn_indices = high_neigh.kneighbors(proxy, n_neighbors=self.n_neighbors, return_distance=True)
        knn_indices = knn_indices + len(proxy)

        random_state = check_random_state(42)
        bw_complex, sigmas, rhos = fuzzy_simplicial_set(
            X=fitting_data,
            n_neighbors=self.n_neighbors,
            metric="euclidean",
            random_state=random_state,
            knn_indices=knn_indices,
            knn_dists=knn_dists,
        )
        return bw_complex, sigmas, rhos, knn_indices


    def _construct_pred_wise_complex(self, train_data, border_centers, iteration):
        """compute the boundary wise complex
            for each border point, we calculate its k nearest train points
            for each train data, we calculate its k nearest border points
        """
        border_centers = self.data_provider.get_pred(iteration, border_centers)
        train_data = self.data_provider.get_pred(iteration, train_data)

        high_neigh = NearestNeighbors(n_neighbors=self.n_neighbors, radius=0.4)
        high_neigh.fit(border_centers)
        fitting_data = np.concatenate((train_data, border_centers), axis=0)
        knn_dists, knn_indices = high_neigh.kneighbors(train_data, n_neighbors=self.n_neighbors, return_distance=True)
        knn_indices = knn_indices + len(train_data)

        high_bound_neigh = NearestNeighbors(n_neighbors=self.n_neighbors, radius=0.4)
        high_bound_neigh.fit(train_data)
        bound_knn_dists, bound_knn_indices = high_bound_neigh.kneighbors(border_centers, n_neighbors=self.n_neighbors, return_distance=True)
        
        knn_dists = np.concatenate((knn_dists, bound_knn_dists), axis=0)
        knn_indices = np.concatenate((knn_indices, bound_knn_indices), axis=0)


        random_state = check_random_state(42)
        bw_complex, sigmas, rhos = fuzzy_simplicial_set(
            X=fitting_data,
            n_neighbors=self.n_neighbors,
            metric="cosine",
            random_state=random_state,
            knn_indices=knn_indices,
            knn_dists=knn_dists,
        )
        return bw_complex, sigmas, rhos, knn_indices
    

    def _construct_step_edge_dataset(self, vr_complex, bw_complex):
        """
        construct the mixed edge dataset for one time step
            connect border points and train data(both direction)
        :param vr_complex: Vietoris-Rips complex
        :param bw_complex: boundary-augmented complex
        :param n_epochs: the number of epoch that we iterate each round
        :return: edge dataset
        """
        # get data from graph
        _, vr_head, vr_tail, vr_weight, _ = get_graph_elements(vr_complex, self.s_n_epochs)

        # get data from graph
        if bw_complex == None:
            return vr_head, vr_tail, vr_weight
        else:
            _, bw_head, bw_tail, bw_weight, _ = get_graph_elements(bw_complex, self.b_n_epochs)
            head = np.concatenate((vr_head, bw_head), axis=0)
            tail = np.concatenate((vr_tail, bw_tail), axis=0)
            weight = np.concatenate((vr_weight, bw_weight), axis=0)
        return head, tail, weight

    
    def construct(self):
        return NotImplemented
    
    def record_time(self, save_dir, file_name, operation, t):
        file_path = os.path.join(save_dir, file_name+".json")
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                ti = json.load(f)
        else:
            ti = dict()
        ti[operation] = t
        with open(file_path, "w") as f:
            json.dump(ti, f)



class SingleEpochSpatialEdgeConstructor(SpatialEdgeConstructor):
    def __init__(self, data_provider, iteration, s_n_epochs, b_n_epochs, n_neighbors,model) -> None:
        super().__init__(data_provider, 100, s_n_epochs, b_n_epochs, n_neighbors)
        self.iteration = iteration
        self.model = model
    
    def construct(self):
        """"
            baseline complex constructor
        """
        train_data = self.data_provider.train_representation(self.iteration)
        train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])
        if self.b_n_epochs > 0:
            border_centers = self.data_provider.border_representation(self.iteration).squeeze()
            
            complex, _, _, _ = self._construct_fuzzy_complex(train_data)
            ## str1
            bw_complex, _, _, _ = self._construct_boundary_wise_complex(train_data, border_centers)

            edge_to, edge_from, probs = self._construct_step_edge_dataset(complex, bw_complex)
            feature_vectors = np.concatenate((train_data, border_centers ), axis=0)
            pred_model = self.data_provider.prediction_function(self.iteration)
            attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)
            # attention = np.zeros(feature_vectors.shape)
        elif self.b_n_epochs == 0:
            feature_vectors = np.copy(train_data)
            complex, _, _, _ = self._construct_fuzzy_complex(train_data)
            edge_to, edge_from, probs = self._construct_step_edge_dataset(complex, None)
            pred_model = self.data_provider.prediction_function(self.iteration)
            attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)            
            # attention = np.zeros(feature_vectors.shape)
        else: 
            raise Exception("Illegal border edges proposion!")
            
        return edge_to, edge_from, probs, feature_vectors, attention
    def record_time(self, save_dir, file_name, operation, t):
        file_path = os.path.join(save_dir, file_name+".json")
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                ti = json.load(f)
        else:
            ti = dict()
        if operation not in ti.keys():
            ti[operation] = dict()
        ti[operation][str(self.iteration)] = t
        with open(file_path, "w") as f:
            json.dump(ti, f)


'''
Strategies:
    Single: normal
    Trustvis: consider prediction sementics
    proxy: for the proxy based complex
'''

class Trustvis_SpatialEdgeConstructor(SpatialEdgeConstructor):
    def __init__(self, data_provider, iteration, s_n_epochs, b_n_epochs, n_neighbors,model) -> None:
        super().__init__(data_provider, 100, s_n_epochs, b_n_epochs, n_neighbors)
        self.iteration = iteration
        self.model = model
    
    def construct(self):
        """"
            baseline complex constructor
        """
        train_data = self.data_provider.train_representation(self.iteration)
        train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])
        if self.b_n_epochs > 0:
            border_centers = self.data_provider.border_representation(self.iteration).squeeze()
            
            complex, _, _, _ = self._construct_fuzzy_complex(train_data)
            ## str1
            bw_complex, _, _, _ = self._construct_boundary_wise_complex(train_data, border_centers)

            edge_to, edge_from, probs = self._construct_step_edge_dataset(complex, bw_complex)
            feature_vectors = np.concatenate((train_data, border_centers ), axis=0)
            pred_model = self.data_provider.prediction_function(self.iteration)
            attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)
            # attention = np.zeros(feature_vectors.shape)
            pred_probs = probs
        elif self.b_n_epochs == 0:
            feature_vectors = np.copy(train_data)
            feature_vectors_pred = self.data_provider.get_pred(self.iteration, feature_vectors)
            complex, sigmas, rhos, _ = self._construct_fuzzy_complex(train_data)
            edge_to, edge_from, probs = self._construct_step_edge_dataset(complex, None)

            probs = probs / (probs.max()+1e-3)
            eliminate_zeros = probs > 1e-3    #1e-3
            edge_to = edge_to[eliminate_zeros]
            edge_from = edge_from[eliminate_zeros]
            probs = probs[eliminate_zeros]

            edge_to_pred = feature_vectors_pred[edge_to]
            edge_from_pred = feature_vectors_pred[edge_from]
          
            pred_similarity = np.einsum('ij,ij->i', edge_to_pred, edge_from_pred) / (
                np.linalg.norm(edge_to_pred, axis=1) * np.linalg.norm(edge_from_pred, axis=1)
                )


            # # print("pred_similarity",pred_similarity)
            # # weight_pred = np.exp(pred_similarity/sigmas[edge_to])
            # # print("weight_pred",weight_pred)
            # # print("weight",weight)

            # # weight = weight * pred_similarity
            #TODO strategy 1
            # pred_probs= np.where(probs == 1, 1, probs + (1 - probs) * pred_similarity ** 2)
            #TODO strategy 2
            # step: get ranked data with evenly distributed
            rank_transformed_weights = rankdata(probs, method='average') / len(probs)
            # step: recalculate the wij
            # pred_probs= np.where(rank_transformed_weights == 1, 1, rank_transformed_weights + (1- rank_transformed_weights)* rank_transformed_weights * pred_similarity)
            #TODO strategy 3
            # step: recalculate the wij
            pred_probs = np.where(rank_transformed_weights == 1,1,np.where(pred_similarity < 0, rank_transformed_weights * (1 + pred_similarity),rank_transformed_weights + (1 - rank_transformed_weights) * rank_transformed_weights * pred_similarity))

            
            
            # weight = np.where(weight == 1, 1, np.where(weight <= 1e-3, weight, weight + (1 - weight) * pred_similarity ** 2))
  
            pred_model = self.data_provider.prediction_function(self.iteration)
            attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)            
            # attention = np.zeros(feature_vectors.shape)
        else: 
            raise Exception("Illegal border edges proposion!")
            
        return edge_to, edge_from, probs, pred_probs, feature_vectors, attention
    def record_time(self, save_dir, file_name, operation, t):
        file_path = os.path.join(save_dir, file_name+".json")
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                ti = json.load(f)
        else:
            ti = dict()
        if operation not in ti.keys():
            ti[operation] = dict()
        ti[operation][str(self.iteration)] = t
        with open(file_path, "w") as f:
            json.dump(ti, f)

from scipy.stats import rankdata
class TrustvisBorderSpatialEdgeConstructor(SpatialEdgeConstructor):
    def __init__(self, data_provider, iteration, s_n_epochs, b_n_epochs, n_neighbors,model, gen_border_data = np.array([])) -> None:
        super().__init__(data_provider, 100, s_n_epochs, b_n_epochs, n_neighbors)
        self.iteration = iteration
        self.model = model
        self.gen_border_data = gen_border_data
    
    def construct(self):
        """"
            baseline complex constructor
        """
        train_data = self.data_provider.train_representation(self.iteration)
        train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])
        if self.b_n_epochs > 0:
            border_centers = self.data_provider.border_representation(self.iteration).squeeze()
            
            complex, _, _, knn_indices = self._construct_fuzzy_complex(train_data)
            ## str1
            bw_complex, _, _, _ = self._construct_boundary_wise_complex(train_data, border_centers)

            edge_to, edge_from, probs = self._construct_step_edge_dataset(complex, bw_complex)
            feature_vectors = np.concatenate((train_data, border_centers ), axis=0)
            pred_model = self.data_provider.prediction_function(self.iteration)
            attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)
            # attention = np.zeros(feature_vectors.shape)
            pred_probs = probs
        elif self.b_n_epochs == 0:
            # feature_vectors = np.copy(train_data)
            if len(self.gen_border_data) > 0 :
                al_data = np.concatenate((train_data, self.gen_border_data), axis=0)
                feature_vectors = np.concatenate((train_data, self.gen_border_data), axis=0)
                complex_border, _, _, _ = self._construct_boundary_wise_complex(train_data, self.gen_border_data)
                border_edge_to, border_edge_from, border_probs = self.merge_complex(complex_border, al_data)
            else:
                feature_vectors = np.copy(train_data)
            feature_vectors_pred = self.data_provider.get_pred(self.iteration, feature_vectors)
            complex, sigmas, rhos, knn_indices = self._construct_fuzzy_complex(train_data)
            edge_to, edge_from, probs = self._construct_step_edge_dataset(complex, None)

            probs = probs / (probs.max()+1e-3)
            eliminate_zeros = probs > 1e-3    #1e-3
            edge_to = edge_to[eliminate_zeros]
            edge_from = edge_from[eliminate_zeros]
            probs = probs[eliminate_zeros]

            # feature_vectors = np.concatenate((train_data, self.gen_border_data), axis=0)

            # # print("pred_similarity",pred_similarity)
            # # weight_pred = np.exp(pred_similarity/sigmas[edge_to])
            # # print("weight_pred",weight_pred)
            # # print("weight",weight)

            # # weight = weight * pred_similarity      
            if len(self.gen_border_data) > 0 :
                # border_probs *= 0.1
                border_probs = border_probs / (border_probs.max()+1e-3)
                eliminate_zeros = border_probs > 1e-3
                edge_to = np.concatenate((edge_to, border_edge_to[eliminate_zeros]), axis=0)
                edge_from = np.concatenate((edge_from, border_edge_from[eliminate_zeros]), axis=0)
                probs = np.concatenate((probs, border_probs[eliminate_zeros]), axis=0)
                print("gen_border_data:", self.gen_border_data.shape)
            edge_to_pred = feature_vectors_pred[edge_to]
            edge_from_pred = feature_vectors_pred[edge_from]
          
            pred_similarity = np.einsum('ij,ij->i', edge_to_pred, edge_from_pred) / (
                np.linalg.norm(edge_to_pred, axis=1) * np.linalg.norm(edge_from_pred, axis=1)
                )
            rank_transformed_weights = rankdata(probs, method='average') / len(probs)

            pred_probs = np.where(rank_transformed_weights == 1,1,np.where(pred_similarity < 0, rank_transformed_weights * (1 + pred_similarity),rank_transformed_weights + (1 - rank_transformed_weights) * rank_transformed_weights * pred_similarity))
            # pred_probs= np.where(probs == 1, 1, probs + (1 - probs) * pred_similarity ** 2)
            # feature_vectors = np.concatenate((train_data, self.gen_border_data), axis=0)
            # weight = np.where(weight == 1, 1, np.where(weight <= 1e-3, weight, weight + (1 - weight) * pred_similarity ** 2))
  
            pred_model = self.data_provider.prediction_function(self.iteration)
            attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)            
            # attention = np.zeros(feature_vectors.shape)
        else: 
            raise Exception("Illegal border edges proposion!")
            
        return edge_to, edge_from, probs, pred_probs, feature_vectors, attention
    def record_time(self, save_dir, file_name, operation, t):
        file_path = os.path.join(save_dir, file_name+".json")
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                ti = json.load(f)
        else:
            ti = dict()
        if operation not in ti.keys():
            ti[operation] = dict()
        ti[operation][str(self.iteration)] = t
        with open(file_path, "w") as f:
            json.dump(ti, f)

    def merge_complex(self, complex1,train_data):
        edge_to_1, edge_from_1, weight_1 = self._construct_step_edge_dataset(complex1, None)

        train_data_pred =  self.data_provider.get_pred(self.iteration, train_data).argmax(axis=1)

        pred_edge_to_1 = train_data_pred[edge_to_1]
        pred_edge_from_1 = train_data_pred[edge_from_1]

        merged_edges = {}

        for i in range(len(edge_to_1)):
            if pred_edge_to_1[i] != pred_edge_from_1[i]:
                continue  # Skip this edge if pred_edge_to_1 is not equal to pred_edge_from_1
            edge = (edge_to_1[i], edge_from_1[i])
            merged_edges[edge] = weight_1[i]

        merged_edge_to, merged_edge_from, merged_weight = zip(*[
            (edge[0], edge[1], wgt) for edge, wgt in merged_edges.items()
        ])

        return np.array(merged_edge_to), np.array(merged_edge_from), np.array(merged_weight)

# class TrustvisSpatialEdgeConstructor(SpatialEdgeConstructor):
#     def __init__(self, data_provider, iteration, s_n_epochs, b_n_epochs, n_neighbors, train_data=None, gen_border_data = np.array([])) -> None:
#         super().__init__(data_provider, 100, s_n_epochs, b_n_epochs, n_neighbors)
#         self.iteration = iteration
#         self.train_data = train_data
#         self.gen_border_data = gen_border_data
#         # self.cluster_labels = cluster_labels
    
#     def construct(self):

#         """
#         Class: Complex Constructor with Prediction Semantics
    
#             This function constructs a complex by integrating train data with prediction semantics.
#             Step 1: Construct the Initial Complex
#                 - This step involves building a complex based on the audience distance between representations, using the training data. 
#                 This initial complex forms the foundational structure.
#             Step 2: Get Graph Elements
#                 - This step involves transforming the complex into a graph.
#                 - Edges that do not intersect any boundary are classified and stored in the standard edge set.
#                 - Edges that intersect boundaries are stored in a separate set, known as the boundary edge set.
#                   These edges are crucial for applying margin loss during the training process.
#             Step 3: Boundary Sample Generation and Integration
#                 - In this step, boundary samples are generated from edges that cross boundaries.
#                 - These samples are then added to the graph to enhance the boundary sensitivity.

#         """
#         if  self.train_data !=None and len(self.train_data) > 0:
#             train_data = self.train_data
#             print("train data:", train_data.shape)
#         else:
#             train_data = self.data_provider.train_representation(self.iteration)
#             train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])
#         # step 1 build spital complex
#         complex, _, _, _ = self._construct_fuzzy_complex(train_data)
   

#         if len(self.gen_border_data) > 0 :
#             print("with border")
#             # step 2 get non_boundary edge and boundary edge
#             edge_to, edge_from, weight,b_edge_to, b_edge_from, b_weight = self.get_graph_ele(complex,train_data)

#             # step 3 add border samples
#             al_data = np.concatenate((train_data, self.gen_border_data), axis=0)
#             complex_border, _, _, _ = self._construct_boundary_wise_complex(train_data, self.gen_border_data)
#             border_edge_to, border_edge_from, border_weight = self.merge_complex(complex_border, al_data)

#             border_weight *= 0.1
#             edge_to = np.concatenate((border_edge_to, edge_to), axis=0)
#             edge_from = np.concatenate((border_edge_from, edge_from), axis=0)
#             weight = np.concatenate((border_weight, weight), axis=0)
#             print("gen_border_data:", self.gen_border_data.shape)
#             feature_vectors = al_data
#         else:
#             print("without border")
#             feature_vectors = train_data
#             # step 3
#             edge_to, edge_from, weight, b_edge_to, b_edge_from, b_weight = self.merge_complexes(complex, feature_vectors)  
        
#         pred_model = self.data_provider.prediction_function(self.iteration)
#         attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)                        
#         return edge_to, edge_from, weight, feature_vectors, attention, b_edge_to, b_edge_from, b_weight

#     def get_graph_ele(self, complex1, train_data):
#         edge_to_1, edge_from_1, weight_1 = self._construct_step_edge_dataset(complex1, None)
       
#         train_data_pred_ = self.data_provider.get_pred(self.iteration, train_data)
#         train_data_pred =  train_data_pred_.argmax(axis=1)
        

#         pred_edge_to_1 = train_data_pred[edge_to_1]
#         pred_edge_from_1 = train_data_pred[edge_from_1]


#         merged_edges = {}
#         merged_boundary_edges = {}


#         for i in range(len(edge_to_1)):
#             edge = (edge_to_1[i], edge_from_1[i])
#             if pred_edge_to_1[i] != pred_edge_from_1[i]:
#                 merged_boundary_edges[edge] = weight_1[i]
#             else:
#                 merged_edges[edge] = weight_1[i]

#         merged_edge_to, merged_edge_from, merged_weight = zip(*[
#             (edge[0], edge[1], wgt) for edge, wgt in merged_edges.items()
#         ])
#         merged_boundary_edge_to, merged_boundary_edge_from, merged_boundary_weight = zip(*[
#         (edge[0], edge[1], wgt) for edge, wgt in merged_boundary_edges.items()])

#         return np.array(merged_edge_to), np.array(merged_edge_from), np.array(merged_weight),np.array(merged_boundary_edge_to), np.array(merged_boundary_edge_from), np.array(merged_boundary_weight)
#     ### for border
#     def merge_complex(self, complex1,train_data):
#         edge_to_1, edge_from_1, weight_1 = self._construct_step_edge_dataset(complex1, None)

#         train_data_pred =  self.data_provider.get_pred(self.iteration, train_data).argmax(axis=1)

#         pred_edge_to_1 = train_data_pred[edge_to_1]
#         pred_edge_from_1 = train_data_pred[edge_from_1]

#         merged_edges = {}

#         for i in range(len(edge_to_1)):
#             if pred_edge_to_1[i] != pred_edge_from_1[i]:
#                 continue  # Skip this edge if pred_edge_to_1 is not equal to pred_edge_from_1
#             edge = (edge_to_1[i], edge_from_1[i])
#             merged_edges[edge] = weight_1[i]

#         merged_edge_to, merged_edge_from, merged_weight = zip(*[
#             (edge[0], edge[1], wgt) for edge, wgt in merged_edges.items()
#         ])

#         return np.array(merged_edge_to), np.array(merged_edge_from), np.array(merged_weight)
    
#     def record_time(self, save_dir, file_name, operation, t):
#         file_path = os.path.join(save_dir, file_name+".json")
#         if os.path.exists(file_path):
#             with open(file_path, "r") as f:
#                 ti = json.load(f)
#         else:
#             ti = dict()
#         if operation not in ti.keys():
#             ti[operation] = dict()
#         ti[operation][str(self.iteration)] = t
#         with open(file_path, "w") as f:
#             json.dump(ti, f)
class TrustvisSpatialEdgeConstructor(SpatialEdgeConstructor):
    def __init__(self, data_provider, iteration, s_n_epochs, b_n_epochs, n_neighbors, train_data=None, gen_border_data = np.array([])) -> None:
        super().__init__(data_provider, 100, s_n_epochs, b_n_epochs, n_neighbors)
        self.iteration = iteration
        self.train_data = train_data
        self.gen_border_data = gen_border_data
    
    def construct(self):

        """
        Class: Complex Constructor with Prediction Semantics
    
            This function constructs a complex by integrating train data with prediction semantics.
            Step 1: Construct the Initial Complex
                - This step involves building a complex based on the audience distance between representations, using the training data. 
                This initial complex forms the foundational structure.
            Step 2: Get Graph Elements
                - This step involves transforming the complex into a graph.
                - Edges that do not intersect any boundary are classified and stored in the standard edge set.
                - Edges that intersect boundaries are stored in a separate set, known as the boundary edge set.
                  These edges are crucial for applying margin loss during the training process.
            Step 3: Boundary Sample Generation and Integration
                - In this step, boundary samples are generated from edges that cross boundaries.
                - These samples are then added to the graph to enhance the boundary sensitivity.

        """
        if  self.train_data !=None and len(self.train_data) > 0:
            train_data = self.train_data
            print("train data:", train_data.shape)
        else:
            train_data = self.data_provider.train_representation(self.iteration)
            train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])
        # step 1 build spital complex
        complex, _, _, _ = self._construct_fuzzy_complex(train_data)
   

        if len(self.gen_border_data) > 0 :
            print("with border")
            # step 2 get non_boundary edge and boundary edge
            edge_to, edge_from, weight,b_edge_to, b_edge_from, b_weight = self.get_graph_ele(complex,train_data)

            # step 3 add border samples
            al_data = np.concatenate((train_data, self.gen_border_data), axis=0)
            complex_border, _, _, _ = self._construct_boundary_wise_complex(train_data, self.gen_border_data)
            border_edge_to, border_edge_from, border_weight = self.merge_complex(complex_border, al_data)

            border_weight *= 0.1
            edge_to = np.concatenate((border_edge_to, edge_to), axis=0)
            edge_from = np.concatenate((border_edge_from, edge_from), axis=0)
            weight = np.concatenate((border_weight, weight), axis=0)
            print("gen_border_data:", self.gen_border_data.shape)
            feature_vectors = al_data
        else:
            print("without border")
            feature_vectors = train_data
            # step 3
            edge_to, edge_from, weight, b_edge_to, b_edge_from, b_weight = self.merge_complexes(complex, complex_pred, None, feature_vectors,self.alpha)  
        
        pred_model = self.data_provider.prediction_function(self.iteration)
        attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)                        
        return edge_to, edge_from, weight, feature_vectors, attention, b_edge_to, b_edge_from, b_weight

    def get_graph_ele(self, complex1, train_data):
        edge_to_1, edge_from_1, weight_1 = self._construct_step_edge_dataset(complex1, None)
       
        train_data_pred =  self.data_provider.get_pred(self.iteration, train_data).argmax(axis=1)

        pred_edge_to_1 = train_data_pred[edge_to_1]
        pred_edge_from_1 = train_data_pred[edge_from_1]


        merged_edges = {}
        merged_boundary_edges = {}

        for i in range(len(edge_to_1)):
            edge = (edge_to_1[i], edge_from_1[i])
            if pred_edge_to_1[i] != pred_edge_from_1[i]:
                merged_boundary_edges[edge] = weight_1[i]
            else:
                merged_edges[edge] = weight_1[i]

        merged_edge_to, merged_edge_from, merged_weight = zip(*[
            (edge[0], edge[1], wgt) for edge, wgt in merged_edges.items()
        ])
        merged_boundary_edge_to, merged_boundary_edge_from, merged_boundary_weight = zip(*[
        (edge[0], edge[1], wgt) for edge, wgt in merged_boundary_edges.items()])

        return np.array(merged_edge_to), np.array(merged_edge_from), np.array(merged_weight),np.array(merged_boundary_edge_to), np.array(merged_boundary_edge_from), np.array(merged_boundary_weight)
    ### for border
    def merge_complex(self, complex1,train_data):
        edge_to_1, edge_from_1, weight_1 = self._construct_step_edge_dataset(complex1, None)

        train_data_pred =  self.data_provider.get_pred(self.iteration, train_data).argmax(axis=1)

        pred_edge_to_1 = train_data_pred[edge_to_1]
        pred_edge_from_1 = train_data_pred[edge_from_1]

        merged_edges = {}

        for i in range(len(edge_to_1)):
            if pred_edge_to_1[i] != pred_edge_from_1[i]:
                continue  # Skip this edge if pred_edge_to_1 is not equal to pred_edge_from_1
            edge = (edge_to_1[i], edge_from_1[i])
            merged_edges[edge] = weight_1[i]

        merged_edge_to, merged_edge_from, merged_weight = zip(*[
            (edge[0], edge[1], wgt) for edge, wgt in merged_edges.items()
        ])

        return np.array(merged_edge_to), np.array(merged_edge_from), np.array(merged_weight)
    
    def record_time(self, save_dir, file_name, operation, t):
        file_path = os.path.join(save_dir, file_name+".json")
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                ti = json.load(f)
        else:
            ti = dict()
        if operation not in ti.keys():
            ti[operation] = dict()
        ti[operation][str(self.iteration)] = t
        with open(file_path, "w") as f:
            json.dump(ti, f)

class TrustvisProxyEdgeConstructor(SpatialEdgeConstructor):
    def __init__(self, data_provider, iteration, s_n_epochs, b_n_epochs, n_neighbors, cluster_labels, train_data=None, gen_border_data = np.array([])) -> None:
        super().__init__(data_provider, 100, s_n_epochs, b_n_epochs, n_neighbors)
        self.iteration = iteration
        self.train_data = train_data
        self.cluster_labels = cluster_labels
        self.gen_border_data = gen_border_data
    
    def construct(self):

        """
        Class: Complex Constructor with Prediction Semantics
    
            This function constructs a complex by integrating train data with prediction semantics.
            Step 1: Construct the Initial Complex
                - This step involves building a complex based on the audience distance between representations, using the training data. 
                This initial complex forms the foundational structure.
            Step 2: Get Graph Elements
                - This step involves transforming the complex into a graph.
                - Edges that do not intersect any boundary are classified and stored in the standard edge set.
                - Edges that intersect boundaries are stored in a separate set, known as the boundary edge set.
                  These edges are crucial for applying margin loss during the training process.
            Step 3: Boundary Sample Generation and Integration
                - In this step, boundary samples are generated from edges that cross boundaries.
                - These samples are then added to the graph to enhance the boundary sensitivity.

        """
        if  self.train_data !=None and len(self.train_data) > 0:
            train_data = self.train_data
            print("train data:", train_data.shape)
        else:
            train_data = self.data_provider.train_representation(self.iteration)
            train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])
        # step 1 build spital complex
        complex, _, _, _ = self._construct_fuzzy_complex(train_data)
   

        if len(self.gen_border_data) > 0 :
            print("with border")
            # step 2 get non_boundary edge and boundary edge
            edge_to, edge_from, weight,b_edge_to, b_edge_from, b_weight = self.get_graph_ele(complex,train_data)

            # step 3 add border samples
            al_data = np.concatenate((train_data, self.gen_border_data), axis=0)
            complex_border, _, _, _ = self._construct_boundary_wise_complex(train_data, self.gen_border_data)
            border_edge_to, border_edge_from, border_weight = self.merge_complex(complex_border, al_data)

            border_weight *= 0.05
            edge_to = np.concatenate((border_edge_to, edge_to), axis=0)
            edge_from = np.concatenate((border_edge_from, edge_from), axis=0)
            weight = np.concatenate((border_weight, weight), axis=0)
            print("gen_border_data:", self.gen_border_data.shape)
            feature_vectors = al_data
        else:
            print("without border")
            feature_vectors = train_data
            # step 3
            edge_to, edge_from, weight, b_edge_to, b_edge_from, b_weight = self.merge_complexes(complex, feature_vectors)  
        
        pred_model = self.data_provider.prediction_function(self.iteration)
        attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)                        
        return edge_to, edge_from, weight, feature_vectors, attention, b_edge_to, b_edge_from, b_weight

    def get_graph_ele(self, complex1, train_data):
        edge_to_1, edge_from_1, weight_1 = self._construct_step_edge_dataset(complex1, None)
       
        train_data_pred =  self.data_provider.get_pred(self.iteration, train_data).argmax(axis=1)

        pred_edge_to_1 = train_data_pred[edge_to_1]
        pred_edge_from_1 = train_data_pred[edge_from_1]


        merged_edges = {}
        merged_boundary_edges = {}

        for i in range(len(edge_to_1)):
            edge = (edge_to_1[i], edge_from_1[i])
            if pred_edge_to_1[i] != pred_edge_from_1[i]:
                merged_boundary_edges[edge] = weight_1[i]
#             elif self.cluster_labels[edge_to_1[i]] != self.cluster_labels[edge_from_1[i]]:
# #                 # merged_inner_boundary_edges[edge] = weight_1[i]
#                 merged_edges[edge] = weight_1[i] * 0.9
            else:
                merged_edges[edge] = weight_1[i]

        merged_edge_to, merged_edge_from, merged_weight = zip(*[
            (edge[0], edge[1], wgt) for edge, wgt in merged_edges.items()
        ])
        merged_boundary_edge_to, merged_boundary_edge_from, merged_boundary_weight = zip(*[
        (edge[0], edge[1], wgt) for edge, wgt in merged_boundary_edges.items()])

        return np.array(merged_edge_to), np.array(merged_edge_from), np.array(merged_weight),np.array(merged_boundary_edge_to), np.array(merged_boundary_edge_from), np.array(merged_boundary_weight)
    ### for border
    def merge_complex(self, complex1,train_data):
        edge_to_1, edge_from_1, weight_1 = self._construct_step_edge_dataset(complex1, None)

        train_data_pred =  self.data_provider.get_pred(self.iteration, train_data).argmax(axis=1)

        pred_edge_to_1 = train_data_pred[edge_to_1]
        pred_edge_from_1 = train_data_pred[edge_from_1]

        merged_edges = {}

        for i in range(len(edge_to_1)):
            if pred_edge_to_1[i] != pred_edge_from_1[i]:
                continue  # Skip this edge if pred_edge_to_1 is not equal to pred_edge_from_1
            
            edge = (edge_to_1[i], edge_from_1[i])
            merged_edges[edge] = weight_1[i]

        merged_edge_to, merged_edge_from, merged_weight = zip(*[
            (edge[0], edge[1], wgt) for edge, wgt in merged_edges.items()
        ])

        return np.array(merged_edge_to), np.array(merged_edge_from), np.array(merged_weight)
    
    def record_time(self, save_dir, file_name, operation, t):
        file_path = os.path.join(save_dir, file_name+".json")
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                ti = json.load(f)
        else:
            ti = dict()
        if operation not in ti.keys():
            ti[operation] = dict()
        ti[operation][str(self.iteration)] = t
        with open(file_path, "w") as f:
            json.dump(ti, f)




""" proxy based edge complex construction"""
# class TrustvisProxyEdgeConstructor(SpatialEdgeConstructor):
#     def __init__(self, data_provider, iteration, s_n_epochs, b_n_epochs, n_neighbors, proxy,cluster_labels,gen_border_data) -> None:
#         super().__init__(data_provider, iteration, s_n_epochs, b_n_epochs, n_neighbors)
#         self.iteration = iteration
#         self.proxy = proxy
#         self.cluster_labels = cluster_labels
#         self.gen_border_data = gen_border_data
    
#     def construct(self):
#         train_data = self.data_provider.train_representation(self.iteration)
#         train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])
#         # step 1
#         # build proxy-proxy-connection
        
     
#         # build proxy-sample-connection
#         #TODO select strategy
#         # proxy_sample_connection, _, _, _ = self._construct_proxy_wise_complex(self.proxy, train_data)
#         # ps_edge_to, ps_edge_from, ps_weight, ps_bon_edge_to, ps_bon_edge_from, ps_bon_weight,_,_,_ = self.get_graph_ele(proxy_sample_connection, np.concatenate((self.proxy, train_data),axis=0)) 

#         # build sample-sample-connection
#         sample_sample_connetction, _, _,_ = self._construct_fuzzy_complex(train_data)
#         edge_to, edge_from, weight, bon_edge_to, bon_edge_from, bon_weight,inner_from,inner_to, inner_weight= self.get_graph_ele(sample_sample_connetction, train_data,True) 
#         edge_to = edge_to 
#         edge_from = edge_from

#         complex_border, _, _, _ = self._construct_boundary_wise_complex(train_data, self.gen_border_data)
#         al_data = np.concatenate((train_data, self.gen_border_data), axis=0)
#         border_edge_to, border_edge_from, border_weight = self.merge_complex(complex_border, al_data)
#         border_weight *= 0.1
#         border_edge_to = border_edge_to 
#         border_edge_from = border_edge_from 


#         # edge_to = np.concatenate((p_edge_to, ps_edge_to, edge_to), axis=0)
#         # edge_from = np.concatenate((p_edge_from,ps_edge_from, edge_from), axis=0)
#         # weight = np.concatenate((p_weight, ps_weight, weight), axis=0)
#         edge_to = np.concatenate(( edge_to,border_edge_to), axis=0)
#         edge_from = np.concatenate((edge_from,border_edge_from), axis=0)
#         weight = np.concatenate((weight,border_weight), axis=0)

#         ###### for boundary crossing edge
#         # bon_edge_to = np.concatenate((p_bon_edge_to, ps_bon_edge_to,bon_edge_to), axis=0)
#         # bon_edge_from = np.concatenate((p_bon_edge_from, ps_bon_edge_from, bon_edge_from),axis=0)
#         # bon_weight = np.concatenate((p_bon_weight,ps_bon_weight, bon_weight),axis=0)



#         feature_vectors = np.concatenate((train_data,self.gen_border_data ), axis=0)
#         pred_model = self.data_provider.prediction_function(self.iteration)
#         attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)
#         # attention = np.zeros(feature_vectors.shape)
            
#         return edge_to, edge_from, weight, feature_vectors, attention, bon_edge_to, bon_edge_from, bon_weight, inner_to, inner_from, inner_weight
#     ### for border
#     def merge_complex(self, complex1,train_data):
#         edge_to_1, edge_from_1, weight_1 = self._construct_step_edge_dataset(complex1, None)

#         train_data_pred =  self.data_provider.get_pred(self.iteration, train_data).argmax(axis=1)

#         pred_edge_to_1 = train_data_pred[edge_to_1]
#         pred_edge_from_1 = train_data_pred[edge_from_1]

#         merged_edges = {}

#         for i in range(len(edge_to_1)):
#             if pred_edge_to_1[i] != pred_edge_from_1[i]:
#                 continue  # Skip this edge if pred_edge_to_1 is not equal to pred_edge_from_1
#             edge = (edge_to_1[i], edge_from_1[i])
#             merged_edges[edge] = weight_1[i]

#         merged_edge_to, merged_edge_from, merged_weight = zip(*[
#             (edge[0], edge[1], wgt) for edge, wgt in merged_edges.items()
#         ])

#         return np.array(merged_edge_to), np.array(merged_edge_from), np.array(merged_weight)
    
#     def merge_complexes(self, complex1, complex2, train_data,alpha=0.7):
        
#         edge_to_1, edge_from_1, weight_1 = self._construct_step_edge_dataset(complex1, None)
#         edge_to_2, edge_from_2, weight_2 = self._construct_step_edge_dataset(complex2, None)

#         pred_edge_to_1 = self.data_provider.get_pred(self.iteration, train_data[edge_to_1]).argmax(axis=1)
#         pred_edge_from_1 = self.data_provider.get_pred(self.iteration, train_data[edge_from_1]).argmax(axis=1)

#         merged_edges = {}

#         for i in range(len(edge_to_1)):
#             if pred_edge_to_1[i] != pred_edge_from_1[i]:
#                 continue  # Skip this edge if pred_edge_to_1 is not equal to pred_edge_from_1
#             edge = (edge_to_1[i], edge_from_1[i])
#             merged_edges[edge] = weight_1[i]
#         # merge the second edge and weight
#         for i in range(len(edge_to_2)):
#             edge = (edge_to_2[i], edge_from_2[i])
#             if edge in merged_edges:
#                 # if we already have the edge strong connection
#                 merged_edges[edge] = (1-alpha) * merged_edges[edge] + alpha * weight_2[i] 
#             else:
#                 # if we do not have the edge add it to 
#                 merged_edges[edge] = weight_2[i]

#         merged_edge_to, merged_edge_from, merged_weight = zip(*[
#             (edge[0], edge[1], wgt) for edge, wgt in merged_edges.items()
#         ])

#         return np.array(merged_edge_to), np.array(merged_edge_from), np.array(merged_weight)
    
#     def get_graph_ele(self, complex1, train_data,need_inner=False):
#         edge_to_1, edge_from_1, weight_1 = self._construct_step_edge_dataset(complex1, None)
       
#         train_data_pred =  self.data_provider.get_pred(self.iteration, train_data).argmax(axis=1)

#         pred_edge_to_1 = train_data_pred[edge_to_1]
#         pred_edge_from_1 = train_data_pred[edge_from_1]


#         merged_edges = {}
#         merged_boundary_edges = {}
#         merged_inner_boundary_edges = {}

#         for i in range(len(edge_to_1)):
#             edge = (edge_to_1[i], edge_from_1[i])
#             if pred_edge_to_1[i] != pred_edge_from_1[i]:
#                 merged_boundary_edges[edge] = weight_1[i]
#             elif need_inner and self.cluster_labels[edge_to_1[i]] != self.cluster_labels[edge_from_1[i]]:
#                 # merged_inner_boundary_edges[edge] = weight_1[i]
#                 merged_edges[edge] = weight_1[i]
#             else:
#                 merged_edges[edge] = weight_1[i]

#         merged_edge_to, merged_edge_from, merged_weight = zip(*[
#             (edge[0], edge[1], wgt) for edge, wgt in merged_edges.items()
#         ])
#         if need_inner and merged_inner_boundary_edges != {}:
#             merged_inner_boundary_edge_to, merged_inner_boundary_edge_from, merged_inner_boundary_weight = zip(*[
#             (edge[0], edge[1], wgt) for edge, wgt in merged_inner_boundary_edges.items()])
#         else:
#             merged_inner_boundary_edge_to = np.array([])
#             merged_inner_boundary_edge_from = np.array([])
#             merged_inner_boundary_weight = np.array([])

      
#         merged_boundary_edge_to, merged_boundary_edge_from, merged_boundary_weight = zip(*[
#         (edge[0], edge[1], wgt) for edge, wgt in merged_boundary_edges.items()])

#         return np.array(merged_edge_to), np.array(merged_edge_from), np.array(merged_weight),np.array(merged_boundary_edge_to), np.array(merged_boundary_edge_from), np.array(merged_boundary_weight),np.array(merged_inner_boundary_edge_to), np.array(merged_inner_boundary_edge_from), np.array(merged_inner_boundary_weight)

#     def record_time(self, save_dir, file_name, operation, t):
#         file_path = os.path.join(save_dir, file_name+".json")
#         if os.path.exists(file_path):
#             with open(file_path, "r") as f:
#                 ti = json.load(f)
#         else:
#             ti = dict()
#         if operation not in ti.keys():
#             ti[operation] = dict()
#         ti[operation][str(self.iteration)] = t
#         with open(file_path, "w") as f:
#             json.dump(ti, f)

        

########################################################################### for active learning #########################################################################

class ErrorALEdgeConstructor(SpatialEdgeConstructor):
    def __init__(self, data_provider, iteration, s_n_epochs, b_n_epochs, n_neighbors,train_data,error_indices) -> None:
        super().__init__(data_provider, 100, s_n_epochs, b_n_epochs, n_neighbors)
        self.iteration = iteration
        self.err_data = train_data
        self.error_indices = error_indices
    
    def construct(self):

        train_data = self.data_provider.train_representation(self.iteration)
        train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])
        train_error = train_data[self.error_indices]

        bool_indices = np.ones(len(train_data), dtype=bool)
        bool_indices[self.error_indices] = False
        train_data_acc = train_data[bool_indices]
        error_data = np.concatenate((train_error, self.err_data),axis=0)

        print("acc", len(train_data_acc),'err',len(error_data) )   

        complex, _, _, _ = self._construct_fuzzy_complex(train_data_acc)
        err_complex, _, _, _ = self._construct_boundary_wise_complex(train_data_acc, error_data)

        edge_to, edge_from, weight = self._construct_step_edge_dataset(complex, err_complex)
        feature_vectors = np.concatenate((train_data, error_data), axis=0)
        pred_model = self.data_provider.prediction_function(self.iteration)
        attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)          
        return edge_to, edge_from, weight, feature_vectors, attention

class PROXYEpochSpatialEdgeConstructor(SpatialEdgeConstructor):
    def __init__(self, data_provider, iteration, s_n_epochs, b_n_epochs, n_neighbors,train_data) -> None:
        super().__init__(data_provider, 100, s_n_epochs, b_n_epochs, n_neighbors)
        self.iteration = iteration
        self.train_data_ = train_data
    
    def construct(self):

        # train_data = self.data_provider.train_representation(self.iteration)
        # train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])
        # # load train data and border centers
        # train_data = np.concatenate((train_data,self.train_data_),axis=0)
        train_data = self.train_data_
        # train_data = train_data.cpu().numpy()

        # train_data_cpu = [x.cpu() for x in train_data if x.is_cuda]
        # train_data = [x.numpy() for x in train_data_cpu]
        print(train_data.shape)

        if self.b_n_epochs > 0:
            border_centers = self.data_provider.border_representation(self.iteration).squeeze()
            
            complex, _, _, _ = self._construct_fuzzy_complex(train_data)
            ## str1
            bw_complex, _, _, _ = self._construct_boundary_wise_complex(train_data, border_centers)

            edge_to, edge_from, weight = self._construct_step_edge_dataset(complex, bw_complex)
            feature_vectors = np.concatenate((train_data, border_centers ), axis=0)
            pred_model = self.data_provider.prediction_function(self.iteration)
            attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)
            # attention = np.zeros(feature_vectors.shape)
        elif self.b_n_epochs == 0:
            complex, _, _, _ = self._construct_fuzzy_complex(train_data)
            edge_to, edge_from, weight = self._construct_step_edge_dataset(complex, None)
            feature_vectors = np.copy(train_data)
            pred_model = self.data_provider.prediction_function(self.iteration)
            attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)            
            # attention = np.zeros(feature_vectors.shape)
        else: 
            raise Exception("Illegal border edges proposion!")
            
        return edge_to, edge_from, weight, feature_vectors, attention

    
    def record_time(self, save_dir, file_name, operation, t):
        file_path = os.path.join(save_dir, file_name+".json")
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                ti = json.load(f)
        else:
            ti = dict()
        if operation not in ti.keys():
            ti[operation] = dict()
        ti[operation][str(self.iteration)] = t
        with open(file_path, "w") as f:
            json.dump(ti, f)




class kcHybridSpatialEdgeConstructor(SpatialEdgeConstructor):
    def __init__(self, data_provider, init_num, s_n_epochs, b_n_epochs, n_neighbors, MAX_HAUSDORFF, ALPHA, BETA, init_idxs=None, init_embeddings=None, c0=None, d0=None) -> None:
        super().__init__(data_provider, init_num, s_n_epochs, b_n_epochs, n_neighbors)
        self.MAX_HAUSDORFF = MAX_HAUSDORFF
        self.ALPHA = ALPHA
        self.BETA = BETA
        self.init_idxs = init_idxs
        self.init_embeddings = init_embeddings
        self.c0 = c0
        self.d0 = d0
    
    def _get_unit(self, data, adding_num=100):
        t0 = time.time()
        l = len(data)
        idxs = np.random.choice(np.arange(l), size=self.init_num, replace=False)

        id = IntrinsicDim(data)
        d0 = id.twonn_dimension_fast()

        kc = kCenterGreedy(data)
        _ = kc.select_batch_with_budgets(idxs, adding_num)
        c0 = kc.hausdorff()
        t1 = time.time()
        return c0, d0, "{:.1f}".format(t1-t0)
    
    def construct(self):
        """construct spatio-temporal complex and get edges

        Returns
        -------
        _type_
            _description_
        """

        # dummy input
        edge_to = None
        edge_from = None
        sigmas = None
        rhos = None
        weight = None
        probs = None
        feature_vectors = None
        attention = None
        knn_indices = None
        time_step_nums = list()
        time_step_idxs_list = list()
        coefficient = None
        embedded = None

        train_num = self.data_provider.train_num
        # load init_idxs
        if self.init_idxs is None:
            selected_idxs = np.random.choice(np.arange(train_num), size=self.init_num, replace=False)
        else:
            selected_idxs = np.copy(self.init_idxs)
        
        # load c0 d0
        if self.c0 is None or self.d0 is None:
            baseline_data = self.data_provider.train_representation(self.data_provider.e)
            max_x = np.linalg.norm(baseline_data, axis=1).max()
            baseline_data = baseline_data/max_x
            c0,d0,_ = self._get_unit(baseline_data)
            save_dir = os.path.join(self.data_provider.content_path, "selected_idxs")
            os.system("mkdir -p {}".format(save_dir))
            with open(os.path.join(save_dir,"baseline.json"), "w") as f:
                json.dump([float(c0), float(d0)], f)
            print("save c0 and d0 to disk!")
            
        else:
            c0 = self.c0
            d0 = self.d0

        # each time step
        for t in range(self.data_provider.e, self.data_provider.s - 1, -self.data_provider.p):
            print("=================+++={:d}=+++================".format(t))
            # load train data and border centers
            train_data = self.data_provider.train_representation(t).squeeze()

            # normalize data by max ||x||_2
            max_x = np.linalg.norm(train_data, axis=1).max()
            train_data = train_data/max_x

            # get normalization parameters for different epochs
            c,d,_ = self._get_unit(train_data)
            c_c0 = math.pow(c/c0, self.BETA)
            d_d0 = math.pow(d/d0, self.ALPHA)
            print("Finish calculating normaling factor")

            kc = kCenterGreedy(train_data)
            _, hausd = kc.select_batch_with_cn(selected_idxs, self.MAX_HAUSDORFF, c_c0, d_d0, p=0.95, return_min=True)
            selected_idxs = kc.already_selected.astype("int")

            save_dir = os.path.join(self.data_provider.content_path, "selected_idxs")
            os.system("mkdir -p {}".format(save_dir))
            with open(os.path.join(save_dir,"selected_{}.json".format(t)), "w") as f:
                json.dump(selected_idxs.tolist(), f)
            print("select {:d} points".format(len(selected_idxs)))

            time_step_idxs_list.insert(0, selected_idxs)

            train_data = self.data_provider.train_representation(t).squeeze()
            train_data = train_data[selected_idxs]

            if self.b_n_epochs != 0:
                # select highly used border centers...
                border_centers = self.data_provider.border_representation(t).squeeze()
                t_num = len(selected_idxs)
                b_num = len(border_centers)

                complex, sigmas_t1, rhos_t1, knn_idxs_t = self._construct_fuzzy_complex(train_data)
                bw_complex, sigmas_t2, rhos_t2, _ = self._construct_boundary_wise_complex(train_data, border_centers)
                edge_to_t, edge_from_t, weight_t = self._construct_step_edge_dataset(complex, bw_complex)
                sigmas_t = np.concatenate((sigmas_t1, sigmas_t2[len(sigmas_t1):]), axis=0)
                rhos_t = np.concatenate((rhos_t1, rhos_t2[len(rhos_t1):]), axis=0)
                fitting_data = np.concatenate((train_data, border_centers), axis=0)
                pred_model = self.data_provider.prediction_function(t)
                attention_t = get_attention(pred_model, fitting_data, temperature=.01, device=self.data_provider.DEVICE, verbose=1)
            else:
                t_num = len(selected_idxs)
                b_num = 0

                complex, sigmas_t, rhos_t, knn_idxs_t = self._construct_fuzzy_complex(train_data)
                edge_to_t, edge_from_t, weight_t = self._construct_step_edge_dataset(complex, None)
                fitting_data = np.copy(train_data)
                pred_model = self.data_provider.prediction_function(t)
                attention_t = get_attention(pred_model, fitting_data, temperature=.01, device=self.data_provider.DEVICE, verbose=1)
            
            if edge_to is None:
                edge_to = edge_to_t
                edge_from = edge_from_t
                weight = weight_t
                probs = weight_t / weight_t.max()
                feature_vectors = fitting_data
                attention = attention_t
                sigmas = sigmas_t
                rhos = rhos_t
                knn_indices = knn_idxs_t
                # npr = npr_t
                time_step_nums.insert(0, (t_num, b_num))

                if self.init_embeddings is None:
                    coefficient = np.zeros(len(feature_vectors))
                    embedded = np.zeros((len(feature_vectors), 2))
                else:
                    coefficient = np.zeros(len(feature_vectors))
                    coefficient[:len(self.init_embeddings)] = 1
                    embedded = np.zeros((len(feature_vectors), 2))
                    embedded[:len(self.init_embeddings)] = self.init_embeddings

            else:
                # every round, we need to add len(data) to edge_to(as well as edge_from) index
                increase_idx = len(fitting_data)
                edge_to = np.concatenate((edge_to_t, edge_to + increase_idx), axis=0)
                edge_from = np.concatenate((edge_from_t, edge_from + increase_idx), axis=0)
                # normalize weight to be in range (0, 1)
                weight = np.concatenate((weight_t, weight), axis=0)
                probs_t = weight_t / weight_t.max()
                probs = np.concatenate((probs_t, probs), axis=0)
                sigmas = np.concatenate((sigmas_t, sigmas), axis=0)
                rhos = np.concatenate((rhos_t, rhos), axis=0)
                feature_vectors = np.concatenate((fitting_data, feature_vectors), axis=0) 
                attention = np.concatenate((attention_t, attention), axis=0)
                knn_indices = np.concatenate((knn_idxs_t, knn_indices+increase_idx), axis=0)
                # npr = np.concatenate((npr_t, npr), axis=0)
                time_step_nums.insert(0, (t_num, b_num))
                coefficient = np.concatenate((np.zeros(len(fitting_data)), coefficient), axis=0)
                embedded = np.concatenate((np.zeros((len(fitting_data), 2)), embedded), axis=0)

                

        return edge_to, edge_from, weight, feature_vectors, embedded, coefficient, time_step_nums, time_step_idxs_list, knn_indices, sigmas, rhos, attention, (c0, d0)


class kcHybridDenseALSpatialEdgeConstructor(SpatialEdgeConstructor):
    def __init__(self, data_provider, init_num, s_n_epochs, b_n_epochs, n_neighbors, MAX_HAUSDORFF, ALPHA, BETA, iteration, init_idxs=None, init_embeddings=None, c0=None, d0=None) -> None:
        super().__init__(data_provider, init_num, s_n_epochs, b_n_epochs, n_neighbors)
        self.MAX_HAUSDORFF = MAX_HAUSDORFF
        self.ALPHA = ALPHA
        self.BETA = BETA
        self.init_idxs = init_idxs
        self.init_embeddings = init_embeddings
        self.c0 = c0
        self.d0 = d0
        self.iteration = iteration
    
    def _get_unit(self, data, adding_num=100):
        t0 = time.time()
        l = len(data)
        idxs = np.random.choice(np.arange(l), size=self.init_num, replace=False)

        id = IntrinsicDim(data)
        d0 = id.twonn_dimension_fast()

        kc = kCenterGreedy(data)
        _ = kc.select_batch_with_budgets(idxs, adding_num)
        c0 = kc.hausdorff()
        t1 = time.time()
        return c0, d0, "{:.1f}".format(t1-t0)
    
    def construct(self):
        """construct spatio-temporal complex and get edges

        Returns
        -------
        _type_
            _description_
        """

        # dummy input
        edge_to = None
        edge_from = None
        sigmas = None
        rhos = None
        weight = None
        probs = None
        feature_vectors = None
        attention = None
        knn_indices = None
        time_step_nums = list()
        time_step_idxs_list = list()
        coefficient = None
        embedded = None

        train_num = self.data_provider.label_num(self.iteration)
        # load init_idxs
        if self.init_idxs is None:
            selected_idxs = np.random.choice(np.arange(train_num), size=self.init_num, replace=False)
        else:
            selected_idxs = np.copy(self.init_idxs)
        
        # load c0 d0
        if self.c0 is None or self.d0 is None:
            baseline_data = self.data_provider.train_representation_lb(self.iteration, self.data_provider.e)
            max_x = np.linalg.norm(baseline_data, axis=1).max()
            baseline_data = baseline_data/max_x
            c0,d0,_ = self._get_unit(baseline_data)
            save_dir = os.path.join(self.data_provider.content_path, "Model", "Iteration_{}".format(self.iteration), "selected_idxs")
            os.system("mkdir -p {}".format(save_dir))
            with open(os.path.join(save_dir,"baseline.json"), "w") as f:
                json.dump([float(c0), float(d0)], f)
            print("save c0 and d0 to disk!")
            
        else:
            c0 = self.c0
            d0 = self.d0

        # each time step
        for t in range(self.data_provider.e, self.data_provider.s - 1, -self.data_provider.p):
            print("=================+++={:d}=+++================".format(t))
            # load train data and border centers
            train_data = self.data_provider.train_representation_lb(self.iteration, t).squeeze()

            # normalize data by max ||x||_2
            max_x = np.linalg.norm(train_data, axis=1).max()
            train_data = train_data/max_x

            # get normalization parameters for different epochs
            c,d,_ = self._get_unit(train_data)
            c_c0 = math.pow(c/c0, self.BETA)
            d_d0 = math.pow(d/d0, self.ALPHA)
            print("Finish calculating normaling factor")

            kc = kCenterGreedy(train_data)
            _, hausd = kc.select_batch_with_cn(selected_idxs, self.MAX_HAUSDORFF, c_c0, d_d0, p=0.95, return_min=True)
            selected_idxs = kc.already_selected.astype("int")

            save_dir = os.path.join(self.data_provider.content_path, "Model", "Iteration_{}".format(self.iteration), "selected_idxs")
            os.system("mkdir -p {}".format(save_dir))
            with open(os.path.join(save_dir,"selected_{}.json".format(t)), "w") as f:
                json.dump(selected_idxs.tolist(), f)
            print("select {:d} points".format(len(selected_idxs)))

            time_step_idxs_list.insert(0, selected_idxs)

            train_data = self.data_provider.train_representation_lb(self.iteration, t).squeeze()
            train_data = train_data[selected_idxs]

            if self.b_n_epochs != 0:
                # select highly used border centers...
                border_centers = self.data_provider.border_representation(self.iteration, t).squeeze()
                t_num = len(selected_idxs)
                b_num = len(border_centers)

                complex, sigmas_t1, rhos_t1, knn_idxs_t = self._construct_fuzzy_complex(train_data)
                bw_complex, sigmas_t2, rhos_t2, _ = self._construct_boundary_wise_complex(train_data, border_centers)
                edge_to_t, edge_from_t, weight_t = self._construct_step_edge_dataset(complex, bw_complex)
                sigmas_t = np.concatenate((sigmas_t1, sigmas_t2[len(sigmas_t1):]), axis=0)
                rhos_t = np.concatenate((rhos_t1, rhos_t2[len(rhos_t1):]), axis=0)
                fitting_data = np.concatenate((train_data, border_centers), axis=0)
                pred_model = self.data_provider.prediction_function(t)
                attention_t = get_attention(pred_model, fitting_data, temperature=.01, device=self.data_provider.DEVICE, verbose=1)
            else:
                t_num = len(selected_idxs)
                b_num = 0

                complex, sigmas_t, rhos_t, knn_idxs_t = self._construct_fuzzy_complex(train_data)
                edge_to_t, edge_from_t, weight_t = self._construct_step_edge_dataset(complex, None)
                fitting_data = np.copy(train_data)
                pred_model = self.data_provider.prediction_function(self.iteration,t)
                attention_t = get_attention(pred_model, fitting_data, temperature=.01, device=self.data_provider.DEVICE, verbose=1)
            
            if edge_to is None:
                edge_to = edge_to_t
                edge_from = edge_from_t
                weight = weight_t
                probs = weight_t / weight_t.max()
                feature_vectors = fitting_data
                attention = attention_t
                sigmas = sigmas_t
                rhos = rhos_t
                knn_indices = knn_idxs_t
                # npr = npr_t
                time_step_nums.insert(0, (t_num, b_num))

                if self.init_embeddings is None:
                    coefficient = np.zeros(len(feature_vectors))
                    embedded = np.zeros((len(feature_vectors), 2))
                else:
                    coefficient = np.zeros(len(feature_vectors))
                    coefficient[:len(self.init_embeddings)] = 1
                    embedded = np.zeros((len(feature_vectors), 2))
                    embedded[:len(self.init_embeddings)] = self.init_embeddings

            else:
                # every round, we need to add len(data) to edge_to(as well as edge_from) index
                increase_idx = len(fitting_data)
                edge_to = np.concatenate((edge_to_t, edge_to + increase_idx), axis=0)
                edge_from = np.concatenate((edge_from_t, edge_from + increase_idx), axis=0)
                # normalize weight to be in range (0, 1)
                weight = np.concatenate((weight_t, weight), axis=0)
                probs_t = weight_t / weight_t.max()
                probs = np.concatenate((probs_t, probs), axis=0)
                sigmas = np.concatenate((sigmas_t, sigmas), axis=0)
                rhos = np.concatenate((rhos_t, rhos), axis=0)
                feature_vectors = np.concatenate((fitting_data, feature_vectors), axis=0) 
                attention = np.concatenate((attention_t, attention), axis=0)
                knn_indices = np.concatenate((knn_idxs_t, knn_indices+increase_idx), axis=0)
                # npr = np.concatenate((npr_t, npr), axis=0)
                time_step_nums.insert(0, (t_num, b_num))
                coefficient = np.concatenate((np.zeros(len(fitting_data)), coefficient), axis=0)
                embedded = np.concatenate((np.zeros((len(fitting_data), 2)), embedded), axis=0)

        return edge_to, edge_from, weight, feature_vectors, embedded, coefficient, time_step_nums, time_step_idxs_list, knn_indices, sigmas, rhos, attention, (c0, d0)


class tfEdgeConstructor(SpatialEdgeConstructor):
    def __init__(self, data_provider, s_n_epochs, b_n_epochs, n_neighbors) -> None:
        super().__init__(data_provider, 100, s_n_epochs, b_n_epochs, n_neighbors)
    # override
    def _construct_step_edge_dataset(self, vr_complex, bw_complex):
        """
        construct the mixed edge dataset for one time step
            connect border points and train data(both direction)
        :param vr_complex: Vietoris-Rips complex
        :param bw_complex: boundary-augmented complex
        :param n_epochs: the number of epoch that we iterate each round
        :return: edge dataset
        """
        # get data from graph
        _, vr_head, vr_tail, vr_weight, _ = get_graph_elements(vr_complex, self.s_n_epochs)
        epochs_per_sample = make_epochs_per_sample(vr_weight, 10)
        vr_head = np.repeat(vr_head, epochs_per_sample.astype("int"))
        vr_tail = np.repeat(vr_tail, epochs_per_sample.astype("int"))
        vr_weight = np.repeat(vr_weight, epochs_per_sample.astype("int"))
        
        # get data from graph
        if self.b_n_epochs == 0:
            return vr_head, vr_tail, vr_weight
        else:
            _, bw_head, bw_tail, bw_weight, _ = get_graph_elements(bw_complex, self.b_n_epochs)
            b_epochs_per_sample = make_epochs_per_sample(bw_weight, self.b_n_epochs)
            bw_head = np.repeat(bw_head, b_epochs_per_sample.astype("int"))
            bw_tail = np.repeat(bw_tail, b_epochs_per_sample.astype("int"))
            bw_weight = np.repeat(bw_weight, epochs_per_sample.astype("int"))
            head = np.concatenate((vr_head, bw_head), axis=0)
            tail = np.concatenate((vr_tail, bw_tail), axis=0)
            weight = np.concatenate((vr_weight, bw_weight), axis=0)
        return head, tail, weight
        
    def construct(self, prev_iteration, iteration):
        '''
        If prev_iteration<epoch_start, then temporal loss will be 0
        '''
        train_data = self.data_provider.train_representation(iteration)
        if prev_iteration > self.data_provider.s:
            prev_data = self.data_provider.train_representation(prev_iteration)
        else:
            prev_data = None
        n_rate = find_neighbor_preserving_rate(prev_data, train_data, self.n_neighbors)
        if self.b_n_epochs > 0:
            border_centers = self.data_provider.border_representation(iteration).squeeze()
            complex, _, _, _ = self._construct_fuzzy_complex(train_data)
            bw_complex, _, _, _ = self._construct_boundary_wise_complex(train_data, border_centers)
            edges_to_exp, edges_from_exp, weights_exp = self._construct_step_edge_dataset(complex, bw_complex)
            feature_vectors = np.concatenate((train_data, border_centers), axis=0)
            # pred_model = self.data_provider.prediction_function(self.iteration)
            # attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)
            attention = np.zeros(feature_vectors.shape)

        elif self.b_n_epochs == 0:
            complex, _, _, _ = self._construct_fuzzy_complex(train_data)
            edges_to_exp, edges_from_exp, weights_exp = self._construct_step_edge_dataset(complex, None)
            feature_vectors = np.copy(train_data)
            # pred_model = self.data_provider.prediction_function(self.iteration)
            # attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)            
            attention = np.zeros(feature_vectors.shape)
        else: 
            raise Exception("Illegal border edges proposion!")
            
        return edges_to_exp, edges_from_exp, weights_exp, feature_vectors, attention, n_rate
    
class OriginSingleEpochSpatialEdgeConstructor(SpatialEdgeConstructor):
    def __init__(self, data_provider, iteration, s_n_epochs, b_n_epochs, n_neighbors) -> None:
        super().__init__(data_provider, 100, s_n_epochs, b_n_epochs, n_neighbors)
        self.iteration = iteration
    
    def construct(self):
        # load train data and border centers
        train_data = self.data_provider.train_representation(self.iteration)
        # selected = np.random.choice(len(train_data), int(0.9*len(train_data)), replace=False)
        # train_data = train_data[selected]

        if self.b_n_epochs > 0:
      
            border_centers = self.data_provider.border_representation(self.iteration).squeeze()
            complex, _, _, _ = self._construct_fuzzy_complex(train_data)
            bw_complex, _, _, _ = self._construct_boundary_wise_complex(train_data, border_centers)
            edge_to, edge_from, weight = self._construct_step_edge_dataset(complex, bw_complex)
            feature_vectors = np.concatenate((train_data, border_centers), axis=0)
            # pred_model = self.data_provider.prediction_function(self.iteration)
            # attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)
            attention = np.zeros(feature_vectors.shape)
        elif self.b_n_epochs == 0:
            complex, _, _, _ = self._construct_fuzzy_complex(train_data)
            edge_to, edge_from, weight = self._construct_step_edge_dataset(complex, None)
            feature_vectors = np.copy(train_data)
            # pred_model = self.data_provider.prediction_function(self.iteration)
            # attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)            
            attention = np.zeros(feature_vectors.shape)
        else: 
            raise Exception("Illegal border edges proposion!")
            
        return edge_to, edge_from, weight, feature_vectors, attention
    
    def record_time(self, save_dir, file_name, operation, t):
        file_path = os.path.join(save_dir, file_name+".json")
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                ti = json.load(f)
        else:
            ti = dict()
        if operation not in ti.keys():
            ti[operation] = dict()
        ti[operation][str(self.iteration)] = t
        with open(file_path, "w") as f:
            json.dump(ti, f)


class kcSpatialEdgeConstructor(SpatialEdgeConstructor):
    def __init__(self, data_provider, init_num, s_n_epochs, b_n_epochs, n_neighbors, MAX_HAUSDORFF, ALPHA, BETA, init_idxs=None, adding_num=100) -> None:
        super().__init__(data_provider, init_num, s_n_epochs, b_n_epochs, n_neighbors)
        self.MAX_HAUSDORFF = MAX_HAUSDORFF
        self.ALPHA = ALPHA
        self.BETA = BETA
        self.init_idxs = init_idxs
        self.adding_num = adding_num
    
    def _get_unit(self, data, init_num, adding_num=100):
        # normalize
        t0 = time.time()
        l = len(data)
        idxs = np.random.choice(np.arange(l), size=init_num, replace=False)
        # _,_ = hausdorff_dist_cus(data, idxs)

        id = IntrinsicDim(data)
        d0 = id.twonn_dimension_fast()
        # d0 = twonn_dimension_fast(data)

        kc = kCenterGreedy(data)
        _ = kc.select_batch_with_budgets(idxs, adding_num)
        c0 = kc.hausdorff()
        t1 = time.time()
        return c0, d0, "{:.1f}".format(t1-t0)
    
    def construct(self):
        """construct spatio-temporal complex and get edges

        Returns
        -------
        _type_
            _description_
        """

        # dummy input
        edge_to = None
        edge_from = None
        sigmas = None
        rhos = None
        weight = None
        probs = None
        feature_vectors = None
        attention = None
        knn_indices = None
        time_step_nums = list()
        time_step_idxs_list = list()

        train_num = self.data_provider.train_num
        if self.init_idxs is None:
            selected_idxs = np.random.choice(np.arange(train_num), size=self.init_num, replace=False)
        else:
            selected_idxs = np.copy(self.init_idxs)

        baseline_data = self.data_provider.train_representation(self.data_provider.e)
        max_x = np.linalg.norm(baseline_data, axis=1).max()
        baseline_data = baseline_data/max_x
        
        c0,d0,_ = self._get_unit(baseline_data, self.init_num, self.adding_num)

        if self.MAX_HAUSDORFF is None:
            self.MAX_HAUSDORFF = c0-0.01

        # each time step
        for t in range(self.data_provider.e, self.data_provider.s - 1, -self.data_provider.p):
            print("=================+++={:d}=+++================".format(t))
            # load train data and border centers
            train_data = self.data_provider.train_representation(t)

            # normalize data by max ||x||_2
            max_x = np.linalg.norm(train_data, axis=1).max()
            train_data = train_data/max_x

            # get normalization parameters for different epochs
            c,d,_ = self._get_unit(train_data, self.init_num,self.adding_num)
            c_c0 = math.pow(c/c0, self.BETA)
            d_d0 = math.pow(d/d0, self.ALPHA)
            print("Finish calculating normaling factor")

            kc = kCenterGreedy(train_data)
            _ = kc.select_batch_with_cn(selected_idxs, self.MAX_HAUSDORFF, c_c0, d_d0, p=0.95)
            selected_idxs = kc.already_selected.astype("int")

            save_dir = os.path.join(self.data_provider.content_path, "selected_idxs")
            if not os.path.exists(save_dir):
                os.mkdir(save_dir)
            with open(os.path.join(save_dir,"selected_{}.json".format(t)), "w") as f:
                json.dump(selected_idxs.tolist(), f)
            print("select {:d} points".format(len(selected_idxs)))

            time_step_idxs_list.insert(0, np.arange(len(selected_idxs)).tolist())

            train_data = self.data_provider.train_representation(t).squeeze()
            train_data = train_data[selected_idxs]

            if self.b_n_epochs != 0:
                # select highly used border centers...
                border_centers = self.data_provider.border_representation(t)
                t_num = len(selected_idxs)
                b_num = len(border_centers)

                complex, sigmas_t1, rhos_t1, knn_idxs_t = self._construct_fuzzy_complex(train_data)
                bw_complex, sigmas_t2, rhos_t2, _ = self._construct_boundary_wise_complex(train_data, border_centers)
                edge_to_t, edge_from_t, weight_t = self._construct_step_edge_dataset(complex, bw_complex)
                sigmas_t = np.concatenate((sigmas_t1, sigmas_t2[len(sigmas_t1):]), axis=0)
                rhos_t = np.concatenate((rhos_t1, rhos_t2[len(rhos_t1):]), axis=0)
                fitting_data = np.concatenate((train_data, border_centers), axis=0)
                # pred_model = self.data_provider.prediction_function(t)
                # attention_t = get_attention(pred_model, fitting_data, temperature=.01, device=self.data_provider.DEVICE, verbose=1)
                attention_t = np.ones(fitting_data.shape)
            else:
                t_num = len(selected_idxs)
                b_num = 0

                complex, sigmas_t, rhos_t, knn_idxs_t = self._construct_fuzzy_complex(train_data)
                edge_to_t, edge_from_t, weight_t = self._construct_step_edge_dataset(complex, None)
                fitting_data = np.copy(train_data)
                # pred_model = self.data_provider.prediction_function(t)
                # attention_t = get_attention(pred_model, fitting_data, temperature=.01, device=self.data_provider.DEVICE, verbose=1)
                attention_t = np.ones(fitting_data.shape)


            if edge_to is None:
                edge_to = edge_to_t
                edge_from = edge_from_t
                weight = weight_t
                probs = weight_t / weight_t.max()
                feature_vectors = fitting_data
                attention = attention_t
                sigmas = sigmas_t
                rhos = rhos_t
                knn_indices = knn_idxs_t
                # npr = npr_t
                time_step_nums.insert(0, (t_num, b_num))
            else:
                # every round, we need to add len(data) to edge_to(as well as edge_from) index
                increase_idx = len(fitting_data)
                edge_to = np.concatenate((edge_to_t, edge_to + increase_idx), axis=0)
                edge_from = np.concatenate((edge_from_t, edge_from + increase_idx), axis=0)
                # normalize weight to be in range (0, 1)
                weight = np.concatenate((weight_t, weight), axis=0)
                probs_t = weight_t / weight_t.max()
                probs = np.concatenate((probs_t, probs), axis=0)
                sigmas = np.concatenate((sigmas_t, sigmas), axis=0)
                rhos = np.concatenate((rhos_t, rhos), axis=0)
                feature_vectors = np.concatenate((fitting_data, feature_vectors), axis=0)
                attention = np.concatenate((attention_t, attention), axis=0)
                knn_indices = np.concatenate((knn_idxs_t, knn_indices+increase_idx), axis=0)
                # npr = np.concatenate((npr_t, npr), axis=0)
                time_step_nums.insert(0, (t_num, b_num))

        return edge_to, edge_from, weight, feature_vectors, time_step_nums, time_step_idxs_list, knn_indices, sigmas, rhos, attention


class TrustvisTemporalSpatialEdgeConstructor(SpatialEdgeConstructor):
    def __init__(self, data_provider, iteration, s_n_epochs, b_n_epochs, n_neighbors,model, diff_data = np.array([]), sim_data = np.array([])) -> None:
        super().__init__(data_provider, 100, s_n_epochs, b_n_epochs, n_neighbors)
        self.iteration = iteration
        self.model = model
        self.diff_data = diff_data
        self.sim_data = sim_data
    
    def construct(self):
        """"
            baseline complex constructor
        """
        train_data = self.data_provider.train_representation(self.iteration)
        train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])

        # complex, _, _, _ = self._construct_fuzzy_complex(self.diff_data)
   

        if len(self.diff_data) > 0 :
            print("with border")
            # complex, sigmas, rhos, knn_indices = self._construct_fuzzy_complex(train_data)
            # self.n_neighbors = 5
            feature_vectors = np.copy(self.diff_data)
            # feature_vectors = np.concatenate((self.diff_data, self.sim_data), axis=0)
            complex, _, _, knn_indices = self._construct_fuzzy_complex(feature_vectors)
            # complex, _, _, knn_indices = self._construct_temporal_boundary_wise_complex(self.diff_data, train_data)
            # feature_vectors = np.copy(self.diff_data)
            # feature_vectors = np.concatenate((self.diff_data, train_data), axis=0)
            edge_to, edge_from, probs = self._construct_step_edge_dataset(complex, None)
            # edge_to, edge_from, probs = self.merge_complex(complex, feature_vectors)
            

            probs = probs / (probs.max()+1e-3)
            eliminate_zeros = probs > 1e-3    #1e-3
            edge_to = edge_to[eliminate_zeros]
            edge_from = edge_from[eliminate_zeros]
            probs = probs[eliminate_zeros]

            # feature_vectors = np.copy(self.diff_data)
            # feature_vectors = np.concatenate((train_data, self.diff_data), axis=0)
            feature_vectors_pred = self.data_provider.get_pred(self.iteration, feature_vectors)

            edge_to_pred = feature_vectors_pred[edge_to]
            edge_from_pred = feature_vectors_pred[edge_from]
          
            pred_similarity = np.einsum('ij,ij->i', edge_to_pred, edge_from_pred) / (
                np.linalg.norm(edge_to_pred, axis=1) * np.linalg.norm(edge_from_pred, axis=1)
                )

            pred_probs= np.where(probs == 1, 1, probs + (1 - probs) * pred_similarity ** 2)

  
            pred_model = self.data_provider.prediction_function(self.iteration)
            attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)  
            print("gen_border_data:", self.diff_data.shape)
            # feature_vectors = self.diff_data
        else:
            print("without border")
            feature_vectors = train_data
            # step 3
            edge_to, edge_from, weight, b_edge_to, b_edge_from, b_weight = self.merge_complexes(complex, complex_pred, None, feature_vectors,self.alpha)  
        
        # pred_model = self.data_provider.prediction_function(self.iteration)
        # attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)                        
        # return edge_to, edge_from, weight, feature_vectors, attention, b_edge_to, b_edge_from, b_weight,c_edge_to, c_edge_from, c_weight
            
        return edge_to, edge_from, probs, pred_probs, feature_vectors, attention, knn_indices
    
    def merge_complex(self, complex1,train_data):
        edge_to_1, edge_from_1, weight_1 = self._construct_step_edge_dataset(complex1, None)

        train_data_pred =  self.data_provider.get_pred(self.iteration, train_data).argmax(axis=1)

        pred_edge_to_1 = train_data_pred[edge_to_1]
        pred_edge_from_1 = train_data_pred[edge_from_1]

        merged_edges = {}

        for i in range(len(edge_to_1)):
            if pred_edge_to_1[i] != pred_edge_from_1[i]:
                continue  # Skip this edge if pred_edge_to_1 is not equal to pred_edge_from_1
            edge = (edge_to_1[i], edge_from_1[i])
            merged_edges[edge] = weight_1[i]

        merged_edge_to, merged_edge_from, merged_weight = zip(*[
            (edge[0], edge[1], wgt) for edge, wgt in merged_edges.items()
        ])

        return np.array(merged_edge_to), np.array(merged_edge_from), np.array(merged_weight)
    
    def record_time(self, save_dir, file_name, operation, t):
        file_path = os.path.join(save_dir, file_name+".json")
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                ti = json.load(f)
        else:
            ti = dict()
        if operation not in ti.keys():
            ti[operation] = dict()
        ti[operation][str(self.iteration)] = t
        with open(file_path, "w") as f:
            json.dump(ti, f)

