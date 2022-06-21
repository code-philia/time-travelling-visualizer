import numpy as np
import matplotlib.pyplot as plt

import umap.umap_ as umap
from sklearn.metrics import silhouette_score, calinski_harabasz_score
from sklearn.neighbors import NearestNeighbors
from sklearn.cluster import Birch, KMeans

# helper functions
def select_centroid(samples, n_select=3):
    kmeans = KMeans(n_clusters=n_select).fit(samples)

    nbrs = NearestNeighbors(n_neighbors=1, algorithm='ball_tree').fit(samples)
    indices = nbrs.kneighbors(kmeans.cluster_centers_,return_distance=False)
    return indices.squeeze()

def select_closest(queries, pool):
    if len(queries)==0:
        return np.array([])
    nbrs = NearestNeighbors(n_neighbors=1, algorithm='ball_tree').fit(pool)
    indices = nbrs.kneighbors(queries, return_distance=False)
    return indices.squeeze(axis=1)


class NoiseTrajectoryDetector:
    def __init__(self, embeddings_2d, labels):
        self.embeddings_2d = embeddings_2d
        self.labels = labels

        train_num, time_steps, repr_dim = embeddings_2d.shape
        self.train_num = train_num
        self.time_steps = time_steps
        self.repr_dim = repr_dim
        self.classes_num = np.max(self.labels)+1

        # init centers dict
        self.trajectory_embedding = dict()
        self.trajectory_eval = dict()
        self.trajectory_labels = dict() # noise or clean
        self.sub_centers = dict()
        self.sub_centers_labels = dict()
        self.sub_center_verified = dict()
        for cls_num in range(self.classes_num):
            self.sub_centers[str(cls_num)] = dict()
    
    def proj_cls(self, cls_num, repeat=2):
        cls = self.labels == cls_num
        high_data = self.embeddings_2d[cls,:,:].reshape(np.sum(cls), -1)
        best_s = -1.
        best_c = -1.
        best_embedding = None
        best_brc = None
        for _ in range(repeat):
            reducer = umap.UMAP(n_components=2)
            embedding = reducer.fit_transform(high_data)

            brc = Birch(n_clusters=2)
            brc.fit(embedding)

            s = silhouette_score(embedding, brc.labels_, metric='euclidean')
            c = calinski_harabasz_score(embedding, brc.labels_)
            if best_s<s:
                best_s = s
                best_c = c
                best_embedding = embedding
                best_brc = brc
            if best_s <= 0.5:
                continue
            else:
                break
        self.trajectory_embedding[str(cls_num)] = best_embedding
        self.trajectory_eval[str(cls_num)] = (best_s, best_c)

        labels = best_brc.labels_
        centroid = best_brc.subcluster_centers_
        centroid_labels = best_brc.subcluster_labels_
        # clean 1, noise 0
        bin = np.bincount(labels)
        if bin[0] > bin[1]:
            centroid_labels = np.abs(centroid_labels-1)
            labels = np.abs(labels-1)
        self.sub_centers[str(cls_num)] = centroid
        self.sub_center_verified[str(cls_num)] = np.full(len(centroid), False, dtype=bool)

        if best_s>=0.5:
            # contain noises
            current_cleans = centroid_labels==1
            nbrs = NearestNeighbors(n_neighbors=5, algorithm='ball_tree').fit(centroid[current_cleans])
            dists, _ = nbrs.kneighbors(centroid[current_cleans])
            suspicious = (dists[:, -1]/ dists[:, 1])>1.8
            
            # multi level assignment
            tmp = centroid_labels[current_cleans]
            tmp[suspicious] = 2
            centroid_labels[current_cleans] = tmp

            self.sub_centers_labels[str(cls_num)] = centroid_labels
            self.trajectory_labels[str(cls_num)] = labels
        else:
            self.sub_centers_labels[str(cls_num)] = np.full(len(centroid), 1)
            self.trajectory_labels[str(cls_num)] = np.full(len(labels), 1)

    def proj_all(self, repeat=2):
        for cls_num in range(self.classes_num):
            self.proj_cls(cls_num, repeat=repeat)
    
    def detect_noise_cls(self, cls_num):
        best_s, best_c = self.trajectory_eval[str(cls_num)]
        print("silhouette_score\t", best_s)
        print("calinski_harabasz_score\t", best_c)
        if best_s>=0.5:
            return True
        return False
    
    def update_belief(self, cls_num, centroid, is_noise):
        centroids = self.sub_centers[str(cls_num)]
        centroid_labels = self.sub_centers_labels[str(cls_num)]
        embeddings = self.trajectory_embedding[str(cls_num)]

        # update single center
        label = 0 if is_noise else 1

        idx = np.argmin(np.linalg.norm(centroids-centroid, axis=1))
        self.sub_centers_labels[str(cls_num)][idx] = label 
        self.sub_center_verified[str(cls_num)][idx] = True

        # update other embeddings
        nbrs = NearestNeighbors(n_neighbors=1, algorithm='ball_tree').fit(centroids)
        indices = nbrs.kneighbors(embeddings, return_distance=False)
        self.trajectory_labels[str(cls_num)][indices.squeeze()==idx] = label

        # recalculate suspicious
        nbrs = NearestNeighbors(n_neighbors=5, algorithm='ball_tree').fit(centroids[centroid_labels!=0])
        dists, _ = nbrs.kneighbors(centroids[centroid_labels!=0])
        suspicious = (dists[:, -1]/ dists[:, 1])>1.8

        tmp = self.sub_centers_labels[str(cls_num)][centroid_labels!=0]
        tmp[np.logical_and(suspicious, self.sub_center_verified[str(cls_num)][centroid_labels!=0]==False)] = 2
        self.sub_centers_labels[str(cls_num)][centroid_labels!=0] = tmp 
    
    def select_cls_representative(self, cls_num):
        # TODO to be verified
        # calculate noise score
        centroid = self.sub_centers[str(cls_num)]
        centroid_labels = self.sub_centers_labels[str(cls_num)]
        embeddings = self.trajectory_embedding[str(cls_num)]
        labels = self.trajectory_labels[str(cls_num)]

        # select three clean representative ones
        clean_centroids = centroid[centroid_labels==1]
        repr_centroid_idx = select_centroid(clean_centroids)
        clean_ones = embeddings[labels==1]
        clean_indices = select_closest(clean_centroids[repr_centroid_idx], clean_ones)
        repr_centroid = clean_ones[clean_indices]

        # noise ones
        if np.sum(centroid_labels==0)>0:
            noise_centroids = centroid[centroid_labels==0]
            noise_ones = embeddings[labels==0]
            noise_indices = select_closest(noise_centroids, noise_ones)
            noise_centroids = noise_ones[noise_indices]
        else:
            noise_centroids = np.array([])


        # suspicious ones
        if np.sum(centroid_labels==2)>0:
            suspicious_centroids = centroid[centroid_labels==2]
            suspicious_indices = select_closest(suspicious_centroids, clean_ones)
            suspicious_centroids = clean_ones[suspicious_indices]
        else:
            suspicious_centroids = np.array([])

        return repr_centroid, noise_centroids, suspicious_centroids

    def query_noise_score(self, cls_num, queries):
        if len(queries)==0:
            return np.array([])
        # calculate noise score
        centroid = self.sub_centers[str(cls_num)]
        centroid_labels = self.sub_centers_labels[str(cls_num)]
        embeddings = self.trajectory_embedding[str(cls_num)]
        labels = self.trajectory_labels[str(cls_num)]

        # normalize term
        clean_centroids = centroid[centroid_labels==1]
        clean_ones = embeddings[labels==1]
        nbrs = NearestNeighbors(n_neighbors=1, algorithm='ball_tree').fit(clean_centroids)
        dists, _ = nbrs.kneighbors(clean_ones)
        norm_term = dists.max()

        nbrs = NearestNeighbors(n_neighbors=1, algorithm='ball_tree').fit(clean_centroids)
        dists, _ = nbrs.kneighbors(queries)
        scores = dists/norm_term
        return scores
    
    def show(self, cls_num, save_path=None):
        embedding = self.trajectory_embedding[str(cls_num)]
        labels = self.trajectory_labels[str(cls_num)]
        centroid = self.sub_centers[str(cls_num)]
        centroid_labels = self.sub_centers_labels[str(cls_num)]

        plt.scatter(
            embedding[:, 0],
            embedding[:, 1],
            s=1,
            c=labels,
            cmap="Pastel2")

        cleans = centroid[centroid_labels==1]
        noises = centroid[centroid_labels==0]
        suspicious = centroid[centroid_labels==2]
        plt.scatter(
            cleans[:, 0],
            cleans[:, 1],
            s=5,
            c='r')
        plt.scatter(
            noises[:, 0],
            noises[:, 1],
            s=5,
            c='black')
        if len(suspicious)>0:
            plt.scatter(
                suspicious[:, 0],
                suspicious[:, 1],
                s=5,
                c='b')
        plt.title('Trajectories Visualization of class {}'.format(cls_num), fontsize=24)
        if save_path is None:
            plt.show()
        else:
            plt.savefig(save_path)
    
    def show_ground_truth(self, cls_num, clean_labels, save_path=None):
        embedding = self.trajectory_embedding[str(cls_num)]
        centroid = self.sub_centers[str(cls_num)]

        plt.scatter(
            embedding[:, 0],
            embedding[:, 1],
            s=1,
            c=clean_labels,
            cmap="tab10")
        plt.scatter(
            centroid[:, 0],
            centroid[:, 1],
            s=5,
            c='black')
        plt.title('Trajectories Visualization of class {}'.format(cls_num), fontsize=24)
        if save_path is None:
            plt.show()
        else:
            plt.savefig(save_path)
    
    def show_highlight(self, cls_num, highlights, save_path=None):
        embedding = self.trajectory_embedding[str(cls_num)]
        centroid = self.sub_centers[str(cls_num)]

        plt.scatter(
            embedding[:, 0],
            embedding[:, 1],
            s=1,
            # c=clean_labels,
            c=[2 for _ in range(len(embedding))],
            cmap="Pastel2")
        plt.scatter(
            centroid[:, 0],
            centroid[:, 1],
            s=5,
            c='r')
        if len(highlights)>0:
            plt.scatter(
                highlights[:, 0],
                highlights[:, 1],
                s=10,
                c='black')
        plt.title('Trajectories Visualization of class {}'.format(cls_num), fontsize=24)
        if save_path is None:
            plt.show()
        else:
            plt.savefig(save_path)