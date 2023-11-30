from abc import ABC, abstractmethod

import numpy as np
import os
import time
import math
import json

from umap.umap_ import fuzzy_simplicial_set, make_epochs_per_sample
from pynndescent import NNDescent
from sklearn.neighbors import NearestNeighbors
from sklearn.utils import check_random_state

from singleVis.kcenter_greedy import kCenterGreedy
from singleVis.intrinsic_dim import IntrinsicDim
from singleVis.backend import get_graph_elements, get_attention
from singleVis.utils import find_neighbor_preserving_rate
from kmapper import KeplerMapper
from sklearn.cluster import DBSCAN
from scipy.spatial import distance
from scipy.sparse import csr_matrix
import networkx as nx
from itertools import combinations
import torch
from scipy.stats import entropy
from umap import UMAP
from scipy.special import softmax
from trustVis.sampeling import Sampleing
from trustVis.data_generation import DataGeneration
from sklearn.neighbors import KernelDensity
from singleVis.utils import *
from scipy.sparse import coo_matrix

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


    
    def get_pred_diff(self, data, neibour_data, knn_indices, epoch):
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

    def _construct_fuzzy_complex(self, train_data):

        print(train_data.shape)
        # """
        # construct a vietoris-rips complex
        # """
        # number of trees in random projection forest
        n_trees = min(64, 5 + int(round((train_data.shape[0]) ** 0.5 / 20.0)))
        # max number of nearest neighbor iters to perform
        n_iters = max(5, int(round(np.log2(train_data.shape[0]))))
        # distance metric
        metric = "euclidean"
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

        # step1, find neibour for each sample
        X = train_data
        nn = NearestNeighbors(n_neighbors=self.n_neighbors)
        nn.fit(X)
        _, indices = nn.kneighbors(X)
        # 步骤2、3、4：对每个数据点和它的每个邻居生成扰动，然后将扰动应用到邻居上
       
        for i in range(X.shape[0]):
            for j in range(self.n_neighbors):
                for _ in range(n_perturbations):
                    # random perturbation
                    perturbation = np.random.normal(scale=perturbation_scale, size=X.shape[1])
                    # perturbation on neibour
                    perturbed_point = X[indices[i, j]] + perturbation
                    X_perturbed.append(perturbed_point)

        X_perturbed = np.array(X_perturbed)
    
    def _construct_sample_fuzzy_complex(self, train_data):

        n_neighbors = 2
        # """
        # construct a vietoris-rips complex
        # """
        # number of trees in random projection forest
        n_trees = min(64, 5 + int(round((train_data.shape[0]) ** 0.5 / 20.0)))
        # max number of nearest neighbor iters to perform
        n_iters = max(5, int(round(np.log2(train_data.shape[0]))))
        # distance metric
        metric = "euclidean"
        # # get nearest neighbors
        
        nnd = NNDescent(
            train_data,
            n_neighbors=n_neighbors,
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
            n_neighbors=n_neighbors,
            metric=metric,
            random_state=random_state,
            knn_indices=knn_indices,
            knn_dists=knn_dists
        )
        return complex, sigmas, rhos, knn_indices
    
    
    def _construct_boundary_wise_complex(self, train_data, border_centers):
        """compute the boundary wise complex
            for each border point, we calculate its k nearest train points
            for each train data, we calculate its k nearest border points
        """
        print("rrrrr",train_data.shape,border_centers.shape)
        high_neigh = NearestNeighbors(n_neighbors=self.n_neighbors, radius=0.4)
        high_neigh.fit(border_centers)
        fitting_data = np.concatenate((train_data, border_centers), axis=0)
        knn_dists, knn_indices = high_neigh.kneighbors(fitting_data, n_neighbors=self.n_neighbors, return_distance=True)
        knn_indices = knn_indices + len(train_data)

        random_state = check_random_state(42)
        bw_complex, sigmas, rhos = fuzzy_simplicial_set(
            X=fitting_data,
            n_neighbors=self.n_neighbors,
            metric="euclidean",
            random_state=random_state,
            knn_indices=knn_indices,
            knn_dists=knn_dists
        )
        return bw_complex, sigmas, rhos, knn_indices

    
    def _construct_boundary_wise_complex_skeleton(self, train_data, border_centers):
        """compute the boundary wise complex
            for each skeleton point, we calculate its k nearest train points
            for each train data, we calculate its k nearest skeleton points
        """
        print("train data:",train_data.shape, "skeleton data:",border_centers.shape)
        high_neigh = NearestNeighbors(n_neighbors=self.n_neighbors, radius=0.4)
        high_neigh.fit(border_centers)
        fitting_data = np.concatenate((train_data, border_centers), axis=0)
        knn_dists, knn_indices = high_neigh.kneighbors(fitting_data, n_neighbors=self.n_neighbors, return_distance=True)
        knn_indices = knn_indices + len(train_data)

        random_state = check_random_state(42)
        sk_complex, sigmas, rhos = fuzzy_simplicial_set(
            X=fitting_data,
            n_neighbors=self.n_neighbors,
            metric="euclidean",
            random_state=random_state,
            knn_indices=knn_indices,
            knn_dists=knn_dists
        )
        return sk_complex, sigmas, rhos, knn_indices
    
    
    def _construct_proxy_based_edge_dataset(self, proxy_complex, sample_sample, proxy_training_complex):
        """
        construct the mixed edge dataset for one time step
            connect border points and train data(both direction)
        :param vr_complex: Vietoris-Rips complex
        :param bw_complex: boundary-augmented complex
        :param n_epochs: the number of epoch that we iterate each round
        :return: edge dataset
        """
        # get data from graph
        _, pv_head, pv_tail, pv_weight, _ = get_graph_elements(proxy_complex, self.s_n_epochs)

        _, pt_head, pt_tail, pt_weight, _ = get_graph_elements(proxy_training_complex, self.s_n_epochs)

        head = np.concatenate((pv_head, pt_head), axis=0)
        tail = np.concatenate((pv_tail, pt_tail), axis=0)
        weight = np.concatenate((pv_weight, pt_weight), axis=0)
        if sample_sample != None:
            _, s_head, s_tail, s_weight, _ = get_graph_elements(sample_sample, self.s_n_epochs)
            head = np.concatenate((pv_head, pt_head,s_head), axis=0)
            tail = np.concatenate((pv_tail, pt_tail,s_tail), axis=0)
            weight = np.concatenate((pv_weight, pt_weight,s_weight), axis=0)
        return head, tail, weight


    def _construct_active_learning_step_edge_dataset(self, vr_complex, bw_complex, al_complex):
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

        _, al_head, al_tail, al_weight, _ = get_graph_elements(al_complex, self.s_n_epochs)


        # get data from graph
        if self.b_n_epochs == 0:
            return vr_head, vr_tail, vr_weight
        else:
            _, bw_head, bw_tail, bw_weight, _ = get_graph_elements(bw_complex, self.b_n_epochs)
            # bw_weight = 1.5 * bw_weight
            head = np.concatenate((vr_head, bw_head, al_head), axis=0)
            tail = np.concatenate((vr_tail, bw_tail, al_tail), axis=0)
            weight = np.concatenate((vr_weight, bw_weight, al_weight), axis=0)
        return head, tail, weight

    def _construct_step_edge_dataset(self, vr_complex, bw_complex):
        """
        construct the mixed edge dataset for one time step
            connect border points and train data(both direction)
        :param vr_complex: Vietoris-Rips complex
        :param bw_complex: augmented complex
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
        


class ProxyBasedSpatialEdgeConstructor(SpatialEdgeConstructor):
    def __init__(self, data_provider, iteration, s_n_epochs, b_n_epochs, n_neighbors,model,proxy) -> None:
        super().__init__(data_provider, 100, s_n_epochs, b_n_epochs, n_neighbors)
        self.iteration = iteration
        self.model = model
        self.proxy = proxy
    def construct(self):

        print("Trustvis")
        # load train data and border centers
        train_data = self.data_provider.train_representation(self.iteration)
        train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])
        # build proxy-proxy-connection
        proxy_proxy_complex, _, _, _ = self._construct_fuzzy_complex(self.proxy)
        # build proxy-sample-connection
        
        proxy_sample_complex, _, _, _ = self._construct_boundary_wise_complex(self.proxy, train_data)
        sample_complex, _, _, _ = self._construct_sample_fuzzy_complex(train_data)
        edge_to, edge_from, weight = self._construct_proxy_based_edge_dataset(proxy_proxy_complex, sample_complex, proxy_sample_complex)
        #### enhance the connection between the sample and its nearest proxy
        #### find nearest skeleton for each training data
        # nearest_proxy_distances, nearest_proxy_indices = self._find_nearest_proxy(train_data, self.proxy)
        # #### add nearest skeleton to edge
        # train_data_indices = np.arange(len(train_data))
        # added_edge_from = train_data_indices + len(self.proxy)
        # added_edge_to = nearest_proxy_indices.squeeze()
        # # use inverse as weight
        # added_weight = 1.0 / (nearest_proxy_distances.squeeze() + 1e-5)
        # # add new edge
        # edge_to = np.concatenate((edge_to, added_edge_to), axis=0)
        # edge_from = np.concatenate((edge_from, added_edge_from), axis=0)
        # weight = np.concatenate((weight, added_weight), axis=0)
    
        feature_vectors = np.concatenate((self.proxy, train_data ), axis=0)
        pred_model = self.data_provider.prediction_function(self.iteration)
        attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)
        # attention = np.zeros(feature_vectors.shape)
            
        return edge_to, edge_from, weight, feature_vectors, attention
    
    def _find_nearest_proxy(self, train_data, proxy):
        nearest_neighbor = NearestNeighbors(n_neighbors=1).fit(proxy)
        # find nearest skeleton for each training data
        distances, indices = nearest_neighbor.kneighbors(train_data)
        return distances, indices
    
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



class OriginSingleEpochSpatialEdgeConstructor(SpatialEdgeConstructor):
    def __init__(self, data_provider, iteration, s_n_epochs, b_n_epochs, n_neighbors) -> None:
        super().__init__(data_provider, 100, s_n_epochs, b_n_epochs, n_neighbors)
        self.iteration = iteration
    
    def construct(self):
        # load train data and border centers
        train_data = self.data_provider.train_representation(self.iteration)
        train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])
        # selected = np.random.choice(len(train_data), int(0.9*len(train_data)), replace=False)
        # train_data = train_data[selected]

        complex, _, _, _ = self._construct_fuzzy_complex(train_data)
        edge_to, edge_from, weight = self._construct_step_edge_dataset(complex, None)
        feature_vectors = np.copy(train_data)
        pred_model = self.data_provider.prediction_function(self.iteration)
        attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1) 
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

class PredDistSingleEpochSpatialEdgeConstructor(SpatialEdgeConstructor):
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
            complex, _, _, _ = self._construct_fuzzy_complex(train_data, self.iteration)
            bw_complex, _, _, _ = self._construct_boundary_wise_complex(train_data, border_centers, self.iteration)
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

class ActiveLearningEpochSpatialEdgeConstructor(SpatialEdgeConstructor):
    def __init__(self, data_provider, iteration, s_n_epochs, b_n_epochs, n_neighbors, cluster_points, uncluster_points) -> None:
        super().__init__(data_provider, 100, s_n_epochs, b_n_epochs, n_neighbors)
        self.iteration = iteration
        self.cluster_points = cluster_points
        self.uncluster_points = uncluster_points
    
    def construct(self):
        # load train data and border centers
        train_data = self.data_provider.train_representation(self.iteration)
        # selected = np.random.choice(len(train_data), int(0.9*len(train_data)), replace=False)
        # train_data = train_data[selected]
        cluster_data = np.concatenate((train_data, self.cluster_points), axis=0)

        if self.b_n_epochs > 0:
            border_centers = self.data_provider.border_representation(self.iteration).squeeze()
            complex, _, _, _ = self._construct_fuzzy_complex(cluster_data)
            bw_complex, _, _, _ = self._construct_boundary_wise_complex(cluster_data, border_centers)
            if self.uncluster_points.shape[0] != 0:
                al_complex, _, _, _ = self._construct_fuzzy_complex(self.uncluster_points)
                edge_to, edge_from, weight = self._construct_active_learning_step_edge_dataset(complex, bw_complex, al_complex)
            else:
                edge_to, edge_from, weight = self._construct_active_learning_step_edge_dataset(complex, bw_complex, None)
            feature_vectors = np.concatenate((cluster_data, border_centers), axis=0)
            # pred_model = self.data_provider.prediction_function(self.iteration)
            # attention = get_attention(pred_model, feature_vectors, temperature=.01, device=self.data_provider.DEVICE, verbose=1)
            attention = np.zeros(feature_vectors.shape)
        elif self.b_n_epochs == 0:
            complex, _, _, _ = self._construct_fuzzy_complex(cluster_data)
            if self.uncluster_points.shape[0] != 0:
                al_complex, _, _, _ = self._construct_fuzzy_complex(self.uncluster_points)
                edge_to, edge_from, weight = self._construct_active_learning_step_edge_dataset(complex, bw_complex, al_complex)
            else:
                edge_to, edge_from, weight = self._construct_active_learning_step_edge_dataset(complex, None, None)
            feature_vectors = np.copy(cluster_data)
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