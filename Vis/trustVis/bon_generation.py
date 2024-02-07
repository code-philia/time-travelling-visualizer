"""The Sampeling class serve as a helper module for retriving subject model data"""
from abc import ABC, abstractmethod

import os
import gc
import time

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from singleVis.utils import *
# from sklearn.neighbors import NearestNeighbors
# from scipy.special import gamma
# import math
# from pynndescent import NNDescent
# from sklearn.cluster import KMeans

from scipy.special import softmax
import torch
from torch import nn
from torch.nn import functional as F
from pynndescent import NNDescent
import random


"""

"""
class BondaryGenerationAbstractClass(ABC):
    
    def __init__(self, data_provider, epoch):
        self.mode = "abstract"
        self.data_provider = data_provider
        # self.model = model
        self.epoch = epoch
        
    # @abstractmethod
    # def info_calculator(self):
    #     pass

class BoundaryGeneration(BondaryGenerationAbstractClass):
    def __init__(self, data_provider, epoch, EPOCH_START, EPOCH_END,n_neighbors=15):
        self.data_provider = data_provider
        # self.model = model
        self.epoch = epoch
        self.n_neighbors = n_neighbors
        self.EPOCH_START = EPOCH_START
        self.EPOCH_END = EPOCH_END
    
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
    


    
    def if_border(self,data):
        mesh_preds = self.data_provider.get_pred(self.epoch, data)
        mesh_preds = mesh_preds + 1e-8

        sort_preds = np.sort(mesh_preds, axis=1)
        diff = (sort_preds[:, -1] - sort_preds[:, -2]) / (sort_preds[:, -1] - sort_preds[:, 0])
        border = np.zeros(len(diff), dtype=np.uint8) + 0.05
        border[diff < 0.1] = 1
        
        return border

    def get_boundary_sample(self):
        """
            Identify the k nearest neighbors for each sample. 
            If any of these neighbors have a prediction differing from the sample, 
            create a boundary sample at the midpoint between the sample and its differing neighbor.
        """
        train_data = self.data_provider.train_representation(self.epoch)
        train_data = train_data.reshape(train_data.shape[0],train_data.shape[1])
        pred_res = self.data_provider.get_pred(self.epoch, train_data).argmax(axis=1)

        # find k nearest neibour for each sample
        knn_indices, knn_dists = self.get_nearest_n_neighbors(train_data, self.n_neighbors)


        pred_dif_list = []
        pred_dif_index_list = []
        gen_border_data = np.array([])
  
        pred_origin = self.data_provider.get_pred(self.epoch, train_data)
        pred_res = pred_origin.argmax(axis=1)

        for i in range(len(knn_indices)):
            # for i in range(5000):
            neighbor_list = list(knn_indices[i])
            neighbor_data = train_data[neighbor_list]
            # neighbor_pred_origin = pred_origin[neighbor_list]
            neighbor_pred = pred_res[neighbor_list]
            for j in range(len(neighbor_pred)):
                if neighbor_pred[0] != neighbor_pred[j]:
                    if self.epoch < ((EPOCH_END - EPOCH_START)*0.3):
                        random_number = random.randint(1, 7)
                    else:
                        random_number = 1
                    if random_number == 1:
                        # gen_points = np.linspace(neighbor_data[0], neighbor_data[j], 3)[1:-1]
                        gen_points = np.array([(neighbor_data[0] + neighbor_data[j]) / 2])
                        if len(gen_border_data) > 0:
                            gen_border_data = np.concatenate((gen_border_data, gen_points), axis=0)
                        else:
                            gen_border_data = gen_points
                            print(gen_border_data.shape)

            print(gen_border_data.shape)
            sub_n = 10000
        if len(gen_border_data) > 10000:
            random_indices = np.random.choice(len(gen_border_data), sub_n, replace=False)
            # random get subsets
            fin_gen_border_data = gen_border_data[random_indices, :]
        else:
            fin_gen_border_data = gen_border_data

        # unique_pairs = set()
        # boundary_samples = []

        # for i in range(len(train_data)):
        #     pred_ = pred_res[i]
        #     k_n_indicates = knn_indices[i]
        #     k_nn_pred = pred_res[k_n_indicates]

        #     for j in range(1, len(k_n_indicates)):
        #         if pred_ != k_nn_pred[j]:
        #             # Ensure the smaller index is always first in the pair
        #             pair = (min(i, k_n_indicates[j]), max(i, k_n_indicates[j]))
        #             # pair = (i, k_n_indicates[j]) if i < k_n_indicates[j] else (k_n_indicates[j], i)

        #             # Check if the pair is unique
        #             if pair not in unique_pairs:
        #                 unique_pairs.add(pair)

        #                 sample1 = train_data[pair[0]]
        #                 sample2 = train_data[pair[1]]
        #                 # Calculate the midpoint between the two samples
        #                 midpoint = (sample1 + sample2) / 2
        #                 boundary_samples.append(midpoint)

        # boundary_samples = np.array(boundary_samples)
        # border=self.if_border(boundary_samples)
        # boundary_samples = boundary_samples[border==1]
        # print("boundary sample sizess", boundary_samples.shape)

        return fin_gen_border_data

        

        
    
    

    







       

