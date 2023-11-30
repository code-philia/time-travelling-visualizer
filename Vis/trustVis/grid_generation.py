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

class GridGenerator:
    """generate the grid"""
    def __init__(self, data_provider, epoch, projector,min_distance=10, resolution=400):
        """
        interval: int : layer number of the radius
        """
        self.data_provider = data_provider
        self.projector = projector
        self.epoch = epoch
        self.resolution = resolution
        self.vis = visualizer(data_provider, projector, resolution, "tab10")
        self.min_distance = min_distance


    def gen_grids_near_to_training_data(self):
        grid_high, grid_emd, _ = self.vis.get_epoch_decision_view(self.epoch,self.resolution,None, True)
        train_data = self.data_provider.train_representation(self.epoch)
        train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])
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

  