from abc import ABC, abstractmethod

import numpy as np
import os
import json

from sklearn.discriminant_analysis import softmax
from umap.umap_ import fuzzy_simplicial_set, make_epochs_per_sample
from pynndescent import NNDescent
from sklearn.neighbors import NearestNeighbors
from sklearn.utils import check_random_state

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
    
    def _construct_fuzzy_complex(self, train_data):
        """
        construct a vietoris-rips complex
        """
        # number of trees in random projection forest
        n_trees = min(64, 5 + int(round((train_data.shape[0]) ** 0.5 / 20.0)))
        # max number of nearest neighbor iters to perform
        n_iters = max(5, int(round(np.log2(train_data.shape[0]))))
        # distance metric
        metric = "euclidean"
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
        knn_indices, knn_dists = nnd.neighbor_graph
        random_state = check_random_state(None)
        complex, sigmas, rhos = fuzzy_simplicial_set(
            X=train_data,
            n_neighbors=self.n_neighbors,
            metric=metric,
            random_state=random_state,
            knn_indices=knn_indices,
            knn_dists=knn_dists,
        )
        return complex, sigmas, rhos, knn_indices
    
    def _construct_boundary_wise_complex(self, train_data, border_centers):
        """compute the boundary wise complex
            for each border point, we calculate its k nearest train points
            for each train data, we calculate its k nearest border points
        """
        high_neigh = NearestNeighbors(n_neighbors=self.n_neighbors, radius=0.4)
        high_neigh.fit(border_centers)
        fitting_data = np.concatenate((train_data, border_centers), axis=0)
        knn_dists, knn_indices = high_neigh.kneighbors(fitting_data, n_neighbors=self.n_neighbors, return_distance=True)
        knn_indices = knn_indices + len(train_data)

        random_state = check_random_state(None)
        bw_complex, sigmas, rhos = fuzzy_simplicial_set(
            X=fitting_data,
            n_neighbors=self.n_neighbors,
            metric="euclidean",
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
        if self.b_n_epochs == 0:
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
    def __init__(self, data_provider, iteration, s_n_epochs, b_n_epochs, n_neighbors) -> None:
        super().__init__(data_provider, 100, s_n_epochs, b_n_epochs, n_neighbors)
        self.iteration = iteration
    
    def construct(self):
        # load train data and border centers
        train_data = self.data_provider.train_representation(self.iteration)
        # KWY
        train_data = train_data.reshape(-1,train_data.shape[-1])
        print("train_data shape: ",train_data.shape)

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

    
def get_graph_elements(graph_, n_epochs):
    """
    gets elements of graphs, weights, and number of epochs per edge
    Parameters
    ----------
    graph_ : scipy.sparse.csr.csr_matrix
        umap graph of probabilities
    n_epochs : int
        maximum number of epochs per edge
    Returns
    -------
    graph scipy.sparse.csr.csr_matrix
        umap graph
    epochs_per_sample np.array
        number of epochs to train each sample for
    head np.array
        edge head
    tail np.array
        edge tail
    weight np.array
        edge weight
    n_vertices int
        number of verticies in graph
    """
    ### should we remove redundancies () here??
    # graph_ = remove_redundant_edges(graph_)

    graph = graph_.tocoo()
    # eliminate duplicate entries by summing them together
    graph.sum_duplicates()
    # number of vertices in dataset
    n_vertices = graph.shape[1]
    # # get the number of epochs based on the size of the dataset
    if n_epochs is None:
        # For smaller datasets we can use more epochs
        if graph.shape[0] <= 10000:
            n_epochs = 500
        else:
            n_epochs = 200
    # remove elements with very low probability
    if len(graph.data) >0:
        graph.data[graph.data < (graph.data.max() / float(n_epochs)) + 1e-3] = 0.0
        graph.eliminate_zeros()

    head = graph.row
    tail = graph.col
    #! normalization
    # weight = graph.data*n_epochs
    weight = graph.data

    return graph, head, tail, weight, n_vertices