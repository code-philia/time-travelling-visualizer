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
from singleVis.utils import find_neighbor_preserving_rate
import torch
import torch.nn.functional as F

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
    






class CriticalSampling():
    def __init__(self, projector, data_provider, epoch, device):
        self.data_provider = data_provider
        self.epoch = epoch
        self.DEVICE = device
        self.projector = projector

    def norm(self, x):
        exp_x = np.exp(x - np.max(x, axis=1, keepdims=True))
        return exp_x / exp_x.sum(axis=1, keepdims=True)
    
    def if_border(self, data):
        """ """
        norm_preds = self.norm(data)

        sort_preds = np.sort(norm_preds, axis=1)
        diff = sort_preds[:, -1] - sort_preds[:, -2]
        border = np.zeros(len(diff), dtype=np.uint8) + 0.05
        border[diff < 0.15] = 1
        return border
        
    def critical_prediction_flip(self, ref_pred, tar_pred):
        critical_prediction_flip_list = []
        for i in range(len(ref_pred)):
            if ref_pred[i] != tar_pred[i]:
                critical_prediction_flip_list.append(i)
        return critical_prediction_flip_list
    
    def critical_border_flip(self,ref_data, tar_data):
        critical_border_flip_list = []
        ref_border_list = self.if_border(ref_data)
        tar_border_list = self.if_border(tar_data)
        for i in range(len(ref_border_list)):
            if ref_border_list[i] != tar_border_list[i]:
                critical_border_flip_list.append(i)
        return critical_border_flip_list
    
    def get_basic(self):
        ref_train_data = self.data_provider.train_representation(self.epoch-1).squeeze()
        # ref_train_data = ref_train_data.reshape(ref_train_data.shape[0],ref_train_data.shape[1])
        tar_train_data = self.data_provider.train_representation(self.epoch).squeeze()
        # tar_train_data = ref_train_data.reshape(tar_train_data.shape[0],tar_train_data.shape[1])
        
        pred_origin = self.data_provider.get_pred(self.epoch-1, ref_train_data)
        pred = pred_origin.argmax(axis=1)
        embedding_ref = self.projector.batch_project(self.epoch-1, ref_train_data)
        inv_ref_data = self.projector.batch_inverse(self.epoch-1, embedding_ref)
        inv_pred_origin = self.data_provider.get_pred(self.epoch-1, inv_ref_data)
        inv_pred = inv_pred_origin.argmax(axis=1)

        embedding_tar = self.projector.batch_project(self.epoch-1, tar_train_data)
        inv_tar_data = self.projector.batch_inverse(self.epoch-1, embedding_tar)
        new_pred_origin = self.data_provider.get_pred(self.epoch, tar_train_data)
        new_pred = new_pred_origin.argmax(axis=1)
        inv_new_pred_origin = self.data_provider.get_pred(self.epoch, inv_tar_data)
        inv_new_pred = inv_new_pred_origin.argmax(axis=1)

        return ref_train_data, tar_train_data, pred_origin, pred, inv_pred_origin, inv_pred,new_pred, new_pred_origin,inv_new_pred
    
    def find_low_k_npr(self, ref_train_data, tar_train_data,N_NEIGHBORS=15):
        npr = find_neighbor_preserving_rate(ref_train_data, tar_train_data, N_NEIGHBORS)
        k_npr = int(len(npr) * 0.005)
        npr_low_values, npr_low_indices = torch.topk(torch.from_numpy(npr).to(device=self.DEVICE), k_npr, largest=False)
        return npr_low_indices
    
    def find_low_k_sim(self, pred_origin, inv_pred_origin):
        inv_similarity = F.cosine_similarity(torch.from_numpy(pred_origin).to(device=self.DEVICE), torch.from_numpy(inv_pred_origin).to(device=self.DEVICE))
        k_err = int(len(inv_similarity) * 0.005)
        inv_low_values, inv_low_indices = torch.topk(inv_similarity, k_err, largest=False)
        return inv_low_indices
    
    def find_vis_error(self, pred, inv_pred, tar_train_data ):
        vis_error_list = []
        for i in range(len(pred)):
            if pred[i] != inv_pred[i]:
                vis_error_list.append(i)

        embedding_tar = self.projector.batch_project(self.epoch-1, tar_train_data)
        inv_tar_data = self.projector.batch_inverse(self.epoch-1, embedding_tar)
        new_pred_origin = self.data_provider.get_pred(self.epoch, tar_train_data)
        new_pred = new_pred_origin.argmax(axis=1)
        inv_new_pred_origin = self.data_provider.get_pred(self.epoch, inv_tar_data)
        inv_new_pred = inv_new_pred_origin.argmax(axis=1)

        for i in range(len(pred)):
            if new_pred[i] != inv_new_pred[i]:
                vis_error_list.append(i)
        return vis_error_list

    def get_critical(self, withCritical=True):
   
        ref_train_data, tar_train_data, pred_origin, pred, inv_pred_origin, inv_pred,new_pred,new_pred_origin, inv_new_pred = self.get_basic()

        vis_error_list = self.find_vis_error(pred, inv_pred,tar_train_data)
        
        high_dim_prediction_flip_list = self.critical_prediction_flip(pred, new_pred)
        high_dim_border_flip_list = self.critical_border_flip(pred_origin, new_pred_origin)

        if withCritical:
            critical_set = set(high_dim_prediction_flip_list).union(set(high_dim_border_flip_list))
            critical_list = list(critical_set.union(set(vis_error_list)))
        else:
            critical_list = list(set(vis_error_list))
        """ neibour change"""
        npr_low_indices = self.find_low_k_npr(ref_train_data,tar_train_data)
        """ pred flip"""
        inv_low_indices = self.find_low_k_sim(pred_origin, inv_pred_origin)

        critical_list = list(set(critical_list).union(set(npr_low_indices.tolist())))
        critical_list = list(set(critical_list).union(set(inv_low_indices.tolist())))
        critical_data = tar_train_data[critical_list]

        return critical_list, critical_data
    
    
    
    



