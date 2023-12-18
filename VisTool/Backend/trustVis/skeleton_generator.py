

import torch
import numpy as np
from sklearn.neighbors import NearestNeighbors

from sklearn.metrics.pairwise import euclidean_distances
import numpy as np

from sklearn.datasets import make_blobs
from sklearn.cluster import KMeans,SpectralClustering,AgglomerativeClustering
from sklearn.metrics import pairwise_distances



from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score

class SkeletonGenerator:
    """SkeletonGenerator except allows for generate skeleton"""
    def __init__(self, data_provider, epoch, interval=25,base_num_samples=10):
        """
        interval: int : layer number of the radius
        """
        self.data_provider = data_provider
        self.epoch = epoch
        self.interval = interval
        self.base_num_samples= base_num_samples
       
    def skeleton_gen(self):
        torch.manual_seed(0)  # freeze the radom seed
        torch.cuda.manual_seed_all(0)

        # Set the random seed for numpy
        np.random.seed(0)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
        train_data=self.data_provider.train_representation(epoch=self.epoch)
        train_data = torch.Tensor(train_data)
        center = train_data.mean(dim=0)
        # calculate the farest distance
        radius = ((train_data - center)**2).sum(dim=1).max().sqrt()
        # print("radius,radius",radius)

        # min_radius_log = np.log10(1e-3)
        # max_radius_log = np.log10(radius.item())
        # # *****************************************************************************************
        # # generate 100 points in log space 
        # radii_log = np.linspace(max_radius_log, min_radius_log, self.interval)
        # # convert back to linear space
        # radii = 10 ** radii_log

        # generate points in log space
        # generate points in linear space
        radii = self.create_decreasing_array(1e-3,radius.item(), self.interval)
        epsilon = 1e-2
        train_data_distances = ((train_data - center)**2).sum(dim=1).sqrt().cpu().detach().numpy()
        # calculate the number of samples for each radius

        num_samples_per_radius_l = []
        for r in radii:
            close_points_indices = np.where(np.abs(train_data_distances - r) < epsilon)[0]
            close_points = train_data[close_points_indices].cpu().detach().numpy()
            print("len()",r, len(close_points))
            # calculate the log surface area for the current radius
            # convert it back to the original scale
            # calculate the number of samples
            base_num_samples = len(close_points) + 1
            num_samples = int(base_num_samples * r // 4)
            num_samples_per_radius_l.append(num_samples)
        

        # *****************************************************************************************

        # radii = [radius*1.1, radius, radius / 2, radius / 4, radius / 10, 1e-3]  # radii at which to sample points
        # # num_samples_per_radius_l = [500, 500, 500, 500, 500, 500]  # number of samples per radius
        # aaa = 500
        # num_samples_per_radius_l = [aaa, aaa, aaa, aaa, aaa, aaa]  # number of samples per radius
        print("num_samples_per_radius_l",radii)
        print("num_samples_per_radssius_l",num_samples_per_radius_l)
        # list to store samples at all radii
        high_bom_samples = []

        for i in range(len(radii)):
            r = radii[i]

            num_samples_per_radius = num_samples_per_radius_l[i]
            # sample points on the sphere with radius r
            samples = torch.randn(num_samples_per_radius, 512)
            samples = samples / samples.norm(dim=1, keepdim=True) * r

            high_bom_samples.append(samples)

            # concatenate samples from all radii
            high_bom = torch.cat(high_bom_samples, dim=0)

            high_bom = high_bom.cpu().detach().numpy()

        print("shape", high_bom.shape)
        
        # calculate the distance of each training point to the center


        # for each radius, find the training data points close to it and add them to the high_bom
        epsilon = 1e-3  # the threshold for considering a point is close to the radius
        for r in radii:
            close_points_indices = np.where(np.abs(train_data_distances - r) < epsilon)[0]
            close_points = train_data[close_points_indices].cpu().detach().numpy()
            high_bom = np.concatenate((high_bom, close_points), axis=0)

      
        return high_bom
    
    def skeleton_gen_union(self):
        torch.manual_seed(0)  # freeze the radom seed
        torch.cuda.manual_seed_all(0)

        # Set the random seed for numpy
        np.random.seed(0)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
        train_data=self.data_provider.train_representation(epoch=self.epoch)
        # border_data = self.data_provider.border_representation(epoch=self.epoch)
        # train_data = np.concatenate((train_data,border_data),axis=0)
        kmeans = KMeans(n_clusters=1)  # 'k' 是你想要的聚类数量
        # 训练模型
        kmeans.fit(train_data)
        # 获取聚类中心
        center = kmeans.cluster_centers_[0]
        center = torch.Tensor(center)
        # calculate the farest distance
        radius = ((train_data - center)**2).sum(dim=1).max().sqrt()
        print("radius,radius",radius)

        min_radius_log = np.log10(1e-3)
        max_radius_log = np.log10(radius.item() * 1)
        # *****************************************************************************************
        # generate 100 points in log space 
        radii_log = np.linspace(max_radius_log, min_radius_log, self.interval)
        # convert back to linear space
        radii = 10 ** radii_log

    
        # calculate the number of samples for each radius
        num_samples_per_radius_l = []
        for r in radii:
            # calculate the log surface area for the current radius
            # convert it back to the original scale
            # calculate the number of samples
            num_samples = int(self.base_num_samples * r // 2)
            num_samples_per_radius_l.append(num_samples)
        

        # *****************************************************************************************
        radius = radius.item()
        # radii = [radius*1.1, radius, radius / 2, radius / 4, radius / 10, 1e-3]  # radii at which to sample points
        radii = [ radius / 4, radius / 10, 1e-3]  # radii at which to sample points
        # num_samples_per_radius_l = [500, 500, 500, 500, 500, 500]  # number of samples per radius
        aaa = 200
        num_samples_per_radius_l = [aaa, aaa, aaa, aaa, aaa, aaa]  # number of samples per radius
        print("num_samples_per_radius_l",radii)
        print("num_samples_per_radius_l",num_samples_per_radius_l)
        # list to store samples at all radii
        high_bom_samples = []

        for i in range(len(radii)):
            r = radii[i]

            num_samples_per_radius = num_samples_per_radius_l[i]
            # sample points on the sphere with radius r
            samples = torch.randn(num_samples_per_radius, 512)
            samples = samples / samples.norm(dim=1, keepdim=True) * r

            high_bom_samples.append(samples)

            # concatenate samples from all radii
            high_bom = torch.cat(high_bom_samples, dim=0)

            high_bom = high_bom.cpu().detach().numpy()

        print("shape", high_bom.shape)
        
        # calculate the distance of each training point to the center
        train_data_distances = ((train_data - center)**2).sum(dim=1).sqrt().cpu().detach().numpy()

        # for each radius, find the training data points close to it and add them to the high_bom
        epsilon = 1e-2  # the threshold for considering a point is close to the radius
        for r in radii:
            close_points_indices = np.where(np.abs(train_data_distances - r) < epsilon)[0]
            close_points = train_data[close_points_indices].cpu().detach().numpy()
            high_bom = np.concatenate((high_bom, close_points), axis=0)

      
        return high_bom
    
    def skeleton_gen_use_perturb(self, _epsilon=1e-2, _per=0.7):
        """
        find the nearest training data for each radius, 
        and then generate new proxes by this add perturbation on these nearest training data
        """
        torch.manual_seed(0)  # freeze the random seed
        torch.cuda.manual_seed_all(0)
        np.random.seed(0)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
        epsilon = _epsilon

        train_data = self.data_provider.train_representation(epoch=self.epoch)
        # border_data = self.data_provider.border_representation(epoch=self.epoch)
        # train_data = np.concatenate((train_data,border_data),axis=0)
        train_data = torch.Tensor(train_data)
        center = train_data.mean(dim=0)

        # calculate the furthest distance
        max_radius = ((train_data - center)**2).sum(dim=1).max().sqrt().item()
        min_radius = max_radius  * _per  # this is your minimum radius
     
        
        # interval = int(max_radius * 12.8) #MINNIST and CIFAR 10 
        interval = int(max_radius * 12.8)
        print("max_radius", max_radius,"interval",interval)

        # split the interval between max_radius and min_radius into 100 parts
        radii = np.linspace(max_radius, min_radius, interval)


        high_bom_samples = []
        train_data_distances = ((train_data - center)**2).sum(dim=1).sqrt().cpu().detach().numpy()
        print(train_data_distances)
  
        for r in radii:
        
            # find the training data that is close to the current radius
            close_points_indices = np.where(np.abs(train_data_distances - r) < epsilon)[0]
            close_points = train_data[close_points_indices]
    
            # calculate the unit vector from center to the points
            direction_to_center = (close_points - center) / torch.norm(close_points - center, dim=1, keepdim=True)
    
            # add a small perturbation along the direction to the center to get the proxies on the sphere with radius r
            noise = direction_to_center * (epsilon)
            # noise = direction_to_center * torch.randn_like(close_points) * epsilon
            proxies = (close_points + noise).cpu().detach().numpy()
    
            # add the proxies to the skeleton
            high_bom_samples.append(proxies)
        
        high_bom = np.concatenate(high_bom_samples, axis=0)

        return high_bom
    
    def gen_skeleton_by_center(self,):
        train_data = self.data_provider.train_representation(self.epoch)
        kmeans = KMeans(n_clusters=1)  # 'k' 是你想要的聚类数量
        # 训练模型
        kmeans.fit(train_data)
        # 获取聚类中心
        centers = kmeans.cluster_centers_
        return 

    
    def create_decreasing_array(self,min_val, max_val, levels, factor=0.8):
        # Calculate the total range
        range_val = max_val - min_val

        # Create an array with the specified number of levels
        level_indices = np.arange(levels)

        # Apply the factor to the levels
        scaled_levels = factor ** level_indices

        # Scale the values to fit within the range
        scaled_values = scaled_levels * range_val / np.max(scaled_levels)

        # Shift the values to start at the min_val
        final_values = max_val - scaled_values

        return final_values



class CenterSkeletonGenerator:
    """SkeletonGenerator except allows for generate skeleton"""
    def __init__(self, data_provider, epoch,threshold=0.5,min_cluster=500):
        """

        """
        self.data_provider = data_provider
        self.epoch = epoch
        self.threshold = threshold
        self.min_cluster = min_cluster
    
    def gen_center(self,data,k=2):
        """
        """
        kmeans = KMeans(n_clusters=k)  
        kmeans.fit(data)
        centers = kmeans.cluster_centers_
        labels = kmeans.labels_
        radii = []
        for i in range(k):
            cluster_data = data[labels == i]
            if len(cluster_data) > 0:
                # calculate each sample distance to center
                distances = np.sqrt(((cluster_data - centers[i]) ** 2).sum(axis=1))
                radii.append(np.max(distances))
            else:
                radii.append(0)
        
        return centers,labels,radii
    
    def if_need_split(self, data):
        if len(data) < self.min_cluster:
            return False

        kmeans = KMeans(n_clusters=2) 
        kmeans.fit(data)
        labels = kmeans.labels_

        dunn_index = self.dunns_index(data, labels)
        print(dunn_index)
        return dunn_index < self.threshold
    
    def dunns_index(self, X, labels):
        distance_matrix = euclidean_distances(X)

        inter_cluster_distances = []
        intra_cluster_distances = []

        unique_labels = np.unique(labels)

        # Check if we have at least two clusters
        if len(unique_labels) < 2:
            return float('inf')  # Ineligible for splitting

        # Compute maximal intra-cluster distance
        for label in unique_labels:
            members = np.where(labels == label)[0]
            if len(members) <= 1:  # Skip clusters with only one member
                continue
            pairwise_distances = distance_matrix[np.ix_(members, members)]
            intra_cluster_distances.append(np.max(pairwise_distances))

        if not intra_cluster_distances:  # No eligible clusters found
            return float('inf')

        max_intra_cluster_distance = max(intra_cluster_distances)

        # Compute minimal inter-cluster distance
        for i in range(len(unique_labels)):
            for j in range(i+1, len(unique_labels)):
                members_i = np.where(labels == unique_labels[i])[0]
                members_j = np.where(labels == unique_labels[j])[0]
                pairwise_distances = distance_matrix[np.ix_(members_i, members_j)]
                inter_cluster_distances.append(np.min(pairwise_distances))

        if not inter_cluster_distances:  # No eligible clusters found
            return float('inf')

        return min(inter_cluster_distances) / max_intra_cluster_distance

    
    # def if_need_split(self, data):
    #     if len(data) < self.min_cluster:
    #         return False
    #     kmeans = KMeans(n_clusters=1)  
    #     kmeans.fit(data)
    #     centers = kmeans.cluster_centers_
    #     center = centers[0]
    #     train_data_distances = np.sqrt(((data - center)**2).sum(axis=1))
    #     pred = self.data_provider.get_pred(self.epoch,np.concatenate((data,centers),axis=0))
    #     distance_condition = np.any(train_data_distances > self.distance_condition_val)
    #     variance_condition = np.any(np.var(pred, axis=0) > self.variance_condition_val)
    #     return distance_condition or variance_condition
    
    def recursive_clustering(self, data,k=2):
        centers, labels, radii = self.gen_center(data, k=k)
        all_centers = list(centers)  # Save intermediate centers
        all_radii = list(radii)
    
        for label in set(labels):
            cluster = data[labels == label]
            if len(cluster):
                if self.if_need_split(cluster):
                    # all_centers.extend(self.recursive_clustering(cluster, k=2))
                    sub_centers, sub_radii = self.recursive_clustering(cluster, k=2)
                    all_centers.extend(sub_centers)
                    all_radii.extend(sub_radii)
            
        return all_centers, all_radii
    
    
    def center_skeleton_genertaion(self):
        # Initial centers
        data = self.data_provider.train_representation(self.epoch)
        data = data.reshape(data.shape[0], data.shape[1])

        # pca = PCA(n_components=2)
        # data = pca.fit_transform(data)

        # pca = PCA(n_components=2)
        # data = pca.fit_transform(data)
        centers_c, _, radii_c = self.gen_center(data,k=1)
        centers_n, labels,radii_n = self.gen_center(data,k=10)
        print("finished init, start generate proxy")

        # Recursive clustering
        # Recursive clustering with initial split into 10 clusters
        all_centers = []
        all_radii = []  # 存储所有簇的最大半径
        for label in range(len(labels)):
            cluster = data[labels == label]
            if len(cluster):
                # all_centers.extend(self.recursive_clustering(cluster, k=2))
                sub_centers, sub_radii = self.recursive_clustering(cluster, k=2)
                all_centers.extend(sub_centers)
                all_radii.extend(sub_radii)
            
        all_centers = np.array(all_centers)
        all_radii = np.array(all_radii)

        centers = np.concatenate((centers_c,centers_n,all_centers))
        # centers = pca.inverse_transform(centers)

                                          
        return centers,np.concatenate((radii_c, radii_n, all_radii), axis=0)
    



class SpectralClustringProxyGenerator:
    """Use Spectral clustering generate proxies"""
    def __init__(self, data_provider, epoch,threshold=0.5,min_cluster=500):
        """

        """
        self.data_provider = data_provider
        self.epoch = epoch
        self.threshold = threshold
        self.min_cluster = min_cluster
        self.data = data_provider.train_representation(epoch = self.epoch)

        def pca_(self):
            pca = PCA(n_components=50)
            reduced_data = pca.fit_transform(self.data)


class HierarchicalClusteringProxyGenerator:

    """ Use Hierachical Clusering generate proxies"""
    def __init__(self, data_provider, epoch, threshold=0.5):
        self.data_provider = data_provider
        self.threshold = threshold
        self.epoch = epoch

    def hierarchical_clustering_analysis(self, data):
        # 执行层次聚类
        clustering = AgglomerativeClustering(n_clusters=10)
        clustering.fit(data)

        # 初始化每个数据点所属的簇
        n_samples = len(data)
        cluster_membership = {i: [i] for i in range(n_samples)}
        merges = []
        centers = []
        radiuss = []
        for merge_step, (cluster_1_idx, cluster_2_idx) in enumerate(clustering.children_):
            # 这些索引代表合并的簇
            new_cluster = cluster_membership[cluster_1_idx] + cluster_membership[cluster_2_idx]

            # 更新簇的成员
            cluster_membership[n_samples + merge_step] = new_cluster

            # 计算新簇的中心和半径
            new_cluster_data = data[new_cluster]
            center = np.mean(new_cluster_data, axis=0)
            radius = np.max(np.linalg.norm(new_cluster_data - center, axis=1))
            centers.append(center)
            radiuss.append(radius)

            # 记录合并的信息
            merges.append({
                'merge_step': merge_step,
                'merged_clusters': (cluster_1_idx, cluster_2_idx),
                'new_cluster_center': center,
                'new_cluster_radius': radius,
                'new_cluster_members': new_cluster
            })

        return centers,radiuss,merges
    
    def proxy_generation(self):

        data = self.data_provider.train_representation(self.epoch)
        data = data.reshape(data.shape[0], data.shape[1])
        sampled_data = data[np.random.choice(data.shape[0], size=1000, replace=False)]
        centers,radius,merges = self.hierarchical_clustering_analysis(sampled_data)
        return np.array(centers),radius,merges


        
        

   
    


