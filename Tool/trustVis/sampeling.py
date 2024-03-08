"""The Sampeling class serve as a helper module for retriving subject model data"""
from abc import ABC, abstractmethod

import os
import gc
import time

import numpy as np
from sklearn.neighbors import NearestNeighbors
from scipy.special import gamma
import math
from pynndescent import NNDescent
from sklearn.cluster import KMeans


"""
DataContainder module
1. calculate information entropy for singel sample and subset
2. sample informative subset
"""
class SampelingAbstractClass(ABC):
    
    def __init__(self, data_provider, epoch):
        self.mode = "abstract"
        self.data_provider = data_provider
        # self.model = model
        self.epoch = epoch
        
    @abstractmethod
    def info_calculator(self):
        pass

class Sampleing(SampelingAbstractClass):
    def __init__(self,data_provider, epoch, device):
        self.data_provider = data_provider
        # self.model = model
        self.epoch = epoch
        self.DEVICE = device
       

    def probability_density_cal(self,X,dim,k):
        """
        calculate the probability of each sample
        :param data: numpy.ndarray
        :param k: nearest neibour number
        :return: probability, numpy.ndarray
        """
        ## p(xi) = k / (n * V * σ)
        # step one: calculate volumes:  V = π^(d/2) / Γ(d/2 + 1) * r^d 
        print("start calculate the nbrs")
        # nbrs = NearestNeighbors(n_neighbors=k, algorithm='kd_tree').fit(X)
        # distances, indicates = nbrs.kneighbors(X)

        """
        construct a vietoris-rips complex
        """
        # number of trees in random projection forest
        n_trees = min(64, 5 + int(round((X.shape[0]) ** 0.5 / 20.0)))
        # max number of nearest neighbor iters to perform
        n_iters = max(5, int(round(np.log2(X.shape[0]))))
        # distance metric
        metric = "euclidean"
        # get nearest neighbors
        
        nnd = NNDescent(
            X,
            n_neighbors=k,
            metric=metric,
            n_trees=n_trees,
            n_iters=n_iters,
            max_candidates=60,
            verbose=True
        )
        indicates, distances = nnd.neighbor_graph
        print("finish calculate the nbrs")
        pred = self.data_provider.get_pred(self.epoch,X)
        d = dim  # dimensional
        volumes = []
        variances = []
        r_col = []
        print("start calculate the volumes and variances")
        for i in range(len(X)):
            r = distances[i, -1]  # farest neibour 's distance as r
            V = (math.pi**(d/2) / gamma(d/2 + 1)) * (r**d) +1e-8  # calculate the volumes
            volumes.append(V)
            r_col.append(r)
            # calculate prediction varians: σ
            neighbor_indices = indicates[i]
            neighbor_preds = pred[neighbor_indices]  # get predictions of k neighbors
            # Flatten the neighbor_preds array to a 1D array
            flatten_preds = neighbor_preds.flatten()

            # Calculate the variance for all predictions
            variance = np.var(flatten_preds)

            # variance = np.var(neighbor_preds, axis=0) # calculate variance for each class
            variances.append(variance)

        print("finsih calculate the volumes and variances")
        # step three: calculate the probability: p(xi) = k / (n * V * σ)
        n = len(X)
        probabilities = []
        for i in range(len(X)):
            # p = k / (n * volumes[i] * variances[i])
            p = k / (n * (r_col[i]) * (variances[i]))
            probabilities.append(p)
        
        return probabilities,volumes,variances,r_col


    def info_calculator(self):
        data = self.data_provider.train_representation(self.epoch)
        # data_nbrs = NearestNeighbors(n_neibour = )
    


    def clustering(self,data, n_clusters):

        kmeans = KMeans(n_clusters=n_clusters, random_state=0)
        # k-means
        kmeans.fit(data)

        # label
        labels = kmeans.labels_
        # print(labels)
        # clustering center
        centers = kmeans.cluster_centers_
        # print(centers)
        return labels,centers
    
    def space_split(self, data):
        self.pred = self.data_provider.get_pred(self.epoch, data)
        cluster_idx = 10
        print("clustering....")
        labels, centers = self.clustering(data, n_clusters=cluster_idx)
        print("clustering finfished")
   
        for i in range(10):
            subset_indices = np.where(labels == i)[0]
            subset = data[subset_indices]
            info = self.subset_info_cal(subset, centers[i])
        
        # 如果信息量大于0，继续分割
        print("info",info)
        if info > 0:
            labels, new_cluster_idx = self.split(data,subset_indices, labels, cluster_idx)
            cluster_idx = new_cluster_idx

        return labels
    
    def split(self, org_data,indices, labels, cluster_idx, m=1.5, n=1.5):
        data = org_data[indices]  # get the data subset from global data using indices
        print("data.shape",data.shape)
    
        # divide clustering
        sub_labels, centers = self.clustering(data, n_clusters=2)

        # calculate the information of the subset's  clustering
        info = []
        for i in range(2):
            subset_indices = indices[sub_labels == i]
            subset = data[sub_labels == i]
            info_i = self.subset_info_cal(subset, centers[i], m, n)
            info.append(info_i)

        # if information > 0
        for i in range(2):
            if info[i] > 0:
                subset_indices = indices[sub_labels == i]
                labels, cluster_idx = self.split(org_data, subset_indices, labels, cluster_idx+1, m, n)
            else:
                subset_indices = indices[sub_labels == i]
                labels[subset_indices] = cluster_idx
                cluster_idx += 1

        return labels, cluster_idx


    def subset_info_cal(self,data,center_data,m=1.5,n=1.5):
        """
        use infomration theroy quintify the information of each subset
        information = - log(p(d < m)) - log(p(a < n)) 
        """
        # calculat the center samples to each sample's distance
        dists = np.sqrt(np.sum((data - center_data)**2, axis=1))
        preds = self.data_provider.get_pred(self.epoch, data)
        pred_i = self.data_provider.get_pred(self.epoch, np.array([center_data]))
        # 计算预测值的误差，如果误差小于n，认为是True
        diffs = np.abs(preds - pred_i[0])

        # 计算满足条件的概率
        p_d = np.mean(dists < m) + 1e-8
        
        p_a = np.mean(diffs < n) + 1e-8
       
        print("p_d",p_d, "p_a",p_a)

        info = -np.log(p_d) - np.log(p_a)
        return info
    
    def sample_data(self, data, sample_ratio=0.2):
        all_indices = []  # store the selected indices
        labels = self.space_split(data)
        unique_labels = np.unique(labels)

        for label in unique_labels:
            indices = np.where(labels == label)[0]  # indices of data in the current cluster
            sample_size = int(len(indices) * sample_ratio)  # number of samples to select
            if sample_size == 0 and len(indices) > 0:  # in case sample_size is zero for small clusters, select at least one data point
                sample_size = len(indices)
            sampled_indices = np.random.choice(indices, size=sample_size, replace=False)  # select samples without replacement
            all_indices.append(sampled_indices)

        return np.concatenate(all_indices)  #
    









