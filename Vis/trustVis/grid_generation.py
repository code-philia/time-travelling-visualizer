import torch
import numpy as np
from sklearn.neighbors import NearestNeighbors

from sklearn.metrics.pairwise import euclidean_distances
import numpy as np

from sklearn.datasets import make_blobs
from sklearn.cluster import KMeans,SpectralClustering,AgglomerativeClustering
from sklearn.metrics import pairwise_distances

from singleVis.visualizer import visualizer

from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from pynndescent import NNDescent

class GridGenerator:
    """generate the grid"""
    def __init__(self, data_provider, epoch, projector,min_distance=10, resolution=400,n_neighbors=15):
        """
        interval: int : layer number of the radius
        """
        self.data_provider = data_provider
        self.projector = projector
        self.epoch = epoch
        self.resolution = resolution
        self.vis = visualizer(data_provider, projector, resolution, "tab10")
        self.min_distance = min_distance
        self.n_neighbors = n_neighbors
    
    def get_nearest_n_neighbors(self, train_data, n_neighbors,metric='euclidean'):
        n_trees = min(64, 5 + int(round((train_data.shape[0]) ** 0.5 / 20.0)))
        # max number of nearest neighbor iters to perform
        n_iters = max(5, int(round(np.log2(train_data.shape[0]))))
        # distance metric
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

        return knn_indices, knn_dists

    
    def get_train_data(self,alpha=0.5):
        train_data = self.data_provider.train_representation(self.epoch)
        train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])
        pred_res = self.data_provider.get_pred(self.epoch, train_data).argmax(axis=1)


        knn_indices, knn_dists = self.get_nearest_n_neighbors(train_data, self.n_neighbors)

        diff_rate_list = []
        refine_train_data_indicates = []

        for i in range(len(train_data)):
            pred_ = pred_res[i]
            k_n_indicates = knn_indices[i]
            pred_list  = pred_res[k_n_indicates]
            # Count the number of differences
            num_differences_rate = sum(1 for pred in pred_list if pred != pred_ ) / (self.n_neighbors - 1)
            diff_rate_list.append(num_differences_rate)
            if num_differences_rate > alpha:
                refine_train_data_indicates.append(i)
        return train_data[refine_train_data_indicates], diff_rate_list
    
    def get_neg_pair_index(self, train_data):
        pred_res = self.data_provider.get_pred(self.epoch, train_data).argmax(axis=1)
        n_trees = min(64, 5 + int(round((train_data.shape[0]) ** 0.5 / 20.0)))
        n_iters = max(5, int(round(np.log2(train_data.shape[0]))))

        nnd = NNDescent(
            train_data,
            n_neighbors=self.n_neighbors,
            metric='euclidean',
            n_trees=n_trees,
            n_iters=n_iters,
            max_candidates=60,
            verbose=True
        )
        knn_indices, knn_dists = nnd.neighbor_graph

        embedding_neg_from = []
        embedding_neg_to = []

       
        for i in range(len(train_data)):
            pred_ = pred_res[i]
            k_n_indices = knn_indices[i]
            pred_list = pred_res[k_n_indices]

            for j in range(1, len(k_n_indices)):
                if pred_ != pred_list[j]:
                    embedding_neg_from.append(i)
                    embedding_neg_to.append(k_n_indices[j])
   
        return embedding_neg_from, embedding_neg_to
    
        


    def gen_grids_near_to_training_data(self,alpha=0.5):
       
        grid_high, grid_emd, _ = self.vis.get_epoch_decision_view(self.epoch,self.resolution,None, True)
        train_data,diff_list = self.get_train_data(alpha=alpha)
        print("need al:", len(train_data))
  
        train_data_embedding = self.projector.batch_project(self.epoch, train_data)
        # use train_data_embedding initialize NearestNeighbors 
        nbrs = NearestNeighbors(n_neighbors=1, algorithm='ball_tree').fit(train_data_embedding)
        # for each grid_emd，find train_data_embedding nearest sample
        distances, _ = nbrs.kneighbors(grid_emd)
        # filter by distance
        mask = distances.ravel() < self.min_distance
        selected_indices = np.arange(grid_emd.shape[0])[mask]
        grid_high_mask = grid_high[selected_indices]
        return grid_high_mask

  