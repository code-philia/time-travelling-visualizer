import numpy as np
import matplotlib.pyplot as plt


import umap.umap_ as umap
from sklearn.metrics import silhouette_score, calinski_harabasz_score
from sklearn.neighbors import NearestNeighbors, KernelDensity
from sklearn.cluster import Birch, KMeans
from pynndescent import NNDescent

# helper functions
def select_centroid(samples, n_select=3):
    kmeans = KMeans(n_clusters=n_select).fit(samples)

    nbrs = NearestNeighbors(n_neighbors=1).fit(samples)
    indices = nbrs.kneighbors(kmeans.cluster_centers_,return_distance=False)
    return indices.squeeze()

def select_closest(queries, pool):
    return select_close(queries, pool, k=1).squeeze(axis=1)

def select_close(queries, pool, k):
    if len(queries)==0:
        return np.array([])
    # index = NNDescent(pool)
    # indices, _ = index.query(queries, k=k)
    nbrs = NearestNeighbors(n_neighbors=k).fit(pool)
    indices = nbrs.kneighbors(queries, return_distance=False)
    return indices

def closest_dists(embedding, centers):
    dists = np.zeros((len(embedding), len(centers)))
    for i in range(len(embedding)):
        dists[i] = np.linalg.norm(embedding[i]-centers, axis=1)
    # # embedding_2 = np.power(embedding, 2).sum(axis=1)
    # embedding_2 = np.linalg.norm(embedding, axis=1)**2
    # # centers_2 = np.power(centers, 2).sum(axis=1)
    # centers_2 = np.linalg.norm(centers, axis=1)**2
    # ec = np.dot(embedding, centers.T)
    # dists = -2*ec+embedding_2[:, np.newaxis]+centers_2[np.newaxis,:]
    dists = dists.min(axis=1)
    return dists


class NoiseTrajectoryDetector:
    def __init__(self, embeddings_2d, labels):
        """ detect noise by 2d embeddings of samples

        Parameters
        ----------
        embeddings_2d : ndarray, shape (train_num, epoch_num, 2)
            all 2d embeddings of representations by timevis
        labels : ndarray, shape (train_num, )
            Noise labels list of training data
        """
        self.embeddings_2d = embeddings_2d
        self.labels = labels

        train_num, time_steps, repr_dim = embeddings_2d.shape
        self.train_num = train_num
        self.time_steps = time_steps
        self.repr_dim = repr_dim
        self.classes_num = np.max(self.labels)+1
        self.threshold = .4
        self.lambd = .5

        # init centers dict
        self.trajectory_embedding = dict()  # 2d embedding of trajectories
        self.trajectory_eval = dict()   # silhouette_scores and calinski_harabasz_scores

        self.clean_centers = dict()
        self.noise_centers = dict()
        self.sub_centers = dict()   
        self.sub_centers_labels = dict()
        self.sub_center_verified = dict()
        self.umap_scores = dict()
        self.umap_norm = dict()

        # self.dense = dict() # dense point for each class
        # self.u = dict()
        # self.pca_scores = dict()
        # self.pca_norm = dict()
    
    def proj_cls(self, cls_num, dim=2, period=75, repeat=2):
        """calculate the score for class cls_num

        Parameters
        ----------
        cls_num : int
            the number of class that we are working on
        period : _type_
            how many epochs' trajectory that we consider
        repeat : int, optional
            repeat umap algorithm and select a better one, by default 2
        """
        cls = np.argwhere(self.labels == cls_num).squeeze(axis=1)
        high_data = self.embeddings_2d[cls,-period:,:].reshape(len(cls), -1)
        best_s = -1.
        best_c = -1.
        best_embedding = None
        best_brc = None
        for _ in range(repeat):
            reducer = umap.UMAP(n_components=dim)
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

        if best_s > 0.5:
            print("Suspect abnormal in embedding...")

            print("Calculating umap scores...")
            # calculate umap scores
            labels = best_brc.labels_
            centroid = best_brc.subcluster_centers_
            centroid_labels = best_brc.subcluster_labels_
            # clean 0, noise 1
            bin = np.bincount(labels)
            if bin[0] < bin[1]:
                centroid_labels = np.abs(centroid_labels-1)
                labels = np.abs(labels-1)

            centroid_idxs = select_closest(centroid, embedding)
            self.sub_centers[str(cls_num)] = centroid_idxs
            self.sub_center_verified[str(cls_num)] = np.full(len(centroid), False, dtype=bool)
            # update labels
            self.sub_centers_labels[str(cls_num)] = centroid_labels

            clean_center = embedding[labels==0].mean(axis=0)
            id = select_closest([clean_center], embedding)
            self.clean_centers[str(cls_num)] = np.array(embedding[id])
            self.noise_centers[str(cls_num)] = None

            umap_scores = closest_dists(embedding, self.clean_centers[str(cls_num)])
            # self.umap_scores[str(cls_num)] = umap_scores
            self.umap_norm[str(cls_num)] = umap_scores.max()

            # # calculate pca scores
            # print("Calculating pca scores...")
            # _, _, v = np.linalg.svd(high_data)
            # pca_scores = np.abs(np.inner(v[0], high_data))
            # pca_scores = pca_scores / pca_scores.max()

            # X_plot = np.linspace(0, 1, 1000)[:, np.newaxis]
            # kde = KernelDensity(kernel='gaussian', bandwidth=0.75).fit(pca_scores.reshape(len(pca_scores), 1))
            # log_dens = kde.score_samples(X_plot)
            # i = np.argmax(np.exp(log_dens))
            # dense = X_plot[i, 0]
            # self.dense[str(cls_num)] = dense
            # self.u[str(cls_num)] = v[0]
            # self.pca_scores[str(cls_num)] = np.abs(pca_scores-dense).squeeze()
            # self.pca_norm[str(cls_num)] = self.pca_scores[str(cls_num)].max()
            # print("Finish calculating scores for class {}".format(cls_num))

            # update scores
        
        else:
            print("No anomaly detected for class {}!".format(cls_num))

    def proj_all(self, dim=2, period=75, repeat=2):
        for cls_num in range(int(self.classes_num)):
            self.proj_cls(cls_num, dim=dim, period=period, repeat=repeat)
    
    def detect_noise_cls(self, cls_num, verbose=0):
        best_s, best_c = self.trajectory_eval[str(cls_num)]
        if verbose:
            print("silhouette_score\t", best_s)
            print("calinski_harabasz_score\t", best_c)
        if best_s>=0.5:
            return True   
        return False
    
    def update_belief(self, cls_num, centroid, is_noise):
        embeddings = self.trajectory_embedding[str(cls_num)]
        centroids = embeddings[self.sub_centers[str(cls_num)]]

        # update single center, (clean 0, noise 1)
        label = 1 if is_noise else 0

        idx = np.argmin(np.linalg.norm(centroids-centroid, axis=1))
        self.sub_centers_labels[str(cls_num)][idx] = label 
        self.sub_center_verified[str(cls_num)][idx] = True

        if label==0:
            self.clean_centers[str(cls_num)] = np.concatenate((self.clean_centers[str(cls_num)], [centroid]), axis=0)

            # recalculate scores
            # umap_scores = closest_dists(embeddings, self.clean_centers[str(cls_num)])
            # umap_scores = umap_scores/umap_scores.max()
            # self.umap_scores[str(cls_num)] = umap_scores

            # # update labels of each sub centers
            # scores = self.query_noise_score(cls_num)
            # center_s = scores[self.sub_centers[str(cls_num)]]
            # labels = np.zeros(len(center_s))
            # labels[center_s>self.threshold] = 1
            # not_verified = np.logical_not(self.sub_center_verified[str(cls_num)])

            # self.sub_centers_labels[str(cls_num)][not_verified] = labels[not_verified]
        else:
            if self.noise_centers[str(cls_num)] is None:
                self.noise_centers[str(cls_num)] = np.array([centroid])
            else:
                self.noise_centers[str(cls_num)] = np.concatenate((self.noise_centers[str(cls_num)], [centroid]), axis=0)

        
    
    def query_noise_score(self, cls_num):
        # recalculate scores
        # normed = self.umap_norm[str(cls_num)]
        embeddings = self.trajectory_embedding[str(cls_num)]
        
        clean_scores = closest_dists(embeddings, self.clean_centers[str(cls_num)])
        if self.noise_centers[str(cls_num)] is None:
            noise_scores = np.array([0.]*len(embeddings))
        else:
            noise_scores = closest_dists(embeddings, self.noise_centers[str(cls_num)])
        s1 = clean_scores- noise_scores
        s1 = s1/s1.max()
        # s2 = self.pca_scores[str(cls_num)]/self.pca_norm[str(cls_num)]
        return s1
    
    def suggest_abnormal(self, cls_num, show=False):
        # check if we have abnormal
        if not self.detect_noise_cls(cls_num):
            return False

        embeddings = self.trajectory_embedding[str(cls_num)]
        centroids = embeddings[self.sub_centers[str(cls_num)]]

        scores = self.query_noise_score(cls_num)
        center_idxs = self.sub_centers[str(cls_num)]

        # vote for scores (score summary)
        c_labels = select_closest(embeddings, centroids)
        centroid_scores = np.zeros(len(centroids))
        for i in range(len(centroids)):
            centroid_scores[i] = scores[c_labels==i].mean()


        not_verified = (self.sub_center_verified[str(cls_num)] == False)
        s = np.max(centroid_scores[not_verified])
        suggest_idx = np.argwhere(centroid_scores==s)[0,0]

        if show:

            plt.scatter(
                embeddings[:, 0],
                embeddings[:, 1],
                s=.3,
                c=[1 for _ in range(len(embeddings))],
                cmap="Pastel2")

            plt.scatter(
                embeddings[center_idxs[suggest_idx]:center_idxs[suggest_idx]+1, 0],
                embeddings[center_idxs[suggest_idx]:center_idxs[suggest_idx]+1, 1],
                s=7,
                c='black' if s>self.threshold else "red" )
            plt.title('Trajectories Visualization of class {}'.format(cls_num), fontsize=24)
            plt.show()
        return suggest_idx, center_idxs[suggest_idx], s, self.trajectory_embedding[str(cls_num)][center_idxs[suggest_idx]]
    
    def batch_suggest_abnormal(self, cls_num, budget):
        # check if we have abnormal
        if not self.detect_noise_cls(cls_num):
            return False

        embeddings = self.trajectory_embedding[str(cls_num)]
        centroids = embeddings[self.sub_centers[str(cls_num)]]

        scores = self.query_noise_score(cls_num)
        center_idxs = self.sub_centers[str(cls_num)]

        # vote for scores (score summary)
        c_labels = select_closest(embeddings, centroids)
        centroid_scores = np.zeros(len(centroids))
        for i in range(len(centroids)):
            centroid_scores[i] = scores[c_labels==i].mean()

        not_verified = np.argwhere(self.sub_center_verified[str(cls_num)] == False).squeeze(axis=1)
        ranking = np.flip(np.argsort(centroid_scores[not_verified])[-budget:])

        suggest_idxs = not_verified[ranking]
        scores = centroid_scores[suggest_idxs]

        return suggest_idxs, center_idxs[suggest_idxs], scores, self.trajectory_embedding[str(cls_num)][center_idxs[suggest_idxs]]
    
    def show(self, cls_num, save_path=None):
        embedding = self.trajectory_embedding[str(cls_num)]

        centroids = embedding[self.sub_centers[str(cls_num)]]
        centroid_labels = self.sub_centers_labels[str(cls_num)]

        # show embeddings
        nbrs = NearestNeighbors(n_neighbors=1, algorithm='ball_tree').fit(centroids)
        indices = nbrs.kneighbors(embedding, return_distance=False)
        labels = centroid_labels[indices]

        plt.scatter(
            embedding[:, 0],
            embedding[:, 1],
            s=.3,
            c=labels,
            cmap="Pastel2")
        
        # show centroids
        cleans = centroids[centroid_labels==0]
        noises = centroids[centroid_labels==1]
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

        plt.title('Trajectories Visualization of class {}'.format(cls_num), fontsize=24)
        if save_path is None:
            plt.show()
        else:
            plt.savefig(save_path)
    
    def show_ground_truth(self, cls_num, clean_labels, save_path=None):
        embedding = self.trajectory_embedding[str(cls_num)]
        centroids = embedding[self.sub_centers[str(cls_num)]]
        scores = self.query_noise_score(cls_num=cls_num)

        # vote for labels and scores
        c_labels = select_closest(embedding, centroids)
        centroid_scores = np.zeros(len(centroids))
        centroid_labels = np.zeros(len(centroids))
        for i in range(len(centroids)):
            centroid_scores[i] = scores[c_labels==i].mean()
            centroid_labels[i] = np.bincount(clean_labels[c_labels==i]).argmax()

        noise_c = centroid_labels != cls_num
        benign = centroid_labels == cls_num

        plt.scatter(
            embedding[:, 0],
            embedding[:, 1],
            s=.3,
            c=clean_labels,
            cmap="tab10")
        
        plt.scatter(
            centroids[benign][:, 0],
            centroids[benign][:, 1],
            s=5,
            c='r')

        plt.scatter(
            centroids[noise_c][:, 0],
            centroids[noise_c][:, 1],
            s=5,
            c='black')
        plt.title('Trajectories Visualization of class {}'.format(cls_num), fontsize=24)
        if save_path is None:
            plt.show()
        else:
            plt.savefig(save_path)
    
    def show_verified(self, cls_num, save_path=None):
        embedding = self.trajectory_embedding[str(cls_num)]
        centroid = embedding[self.sub_centers[str(cls_num)]]
        verified = self.sub_center_verified[str(cls_num)]
        centroid_labels = self.sub_centers_labels[str(cls_num)]

        plt.scatter(
            embedding[:, 0],
            embedding[:, 1],
            s=.3,
            c=[1 for _ in range(len(embedding))],
            cmap="Pastel2")
        colors = np.array(["red","black"])
        plt.scatter(
            centroid[verified][:, 0],
            centroid[verified][:, 1],
            s=5,
            c=colors[centroid_labels[verified].astype("int")],
        )

        plt.title('Trajectories Visualization of class {}'.format(cls_num), fontsize=24)
        if save_path is None:
            plt.show()
        else:
            plt.savefig(save_path)

    
    def show_highlight(self, cls_num, highlights, save_path=None):
        embedding = self.trajectory_embedding[str(cls_num)]

        plt.scatter(
            embedding[:, 0],
            embedding[:, 1],
            s=.3,
            c=[1 for _ in range(len(embedding))],
            cmap="Pastel2")

        if len(highlights)>0:
            plt.scatter(
                highlights[:, 0],
                highlights[:, 1],
                s=7,
                c='black')
        plt.title('Trajectories Visualization of class {}'.format(cls_num), fontsize=24)
        if save_path is None:
            plt.show()
        else:
            plt.savefig(save_path)
    
    def show_centroid_scores(self, cls_num, save_path=None):
        embedding = self.trajectory_embedding[str(cls_num)]
        centroids = embedding[self.sub_centers[str(cls_num)]]
        scores = self.query_noise_score(cls_num=cls_num)

        # vote for score summary
        c_labels = select_closest(embedding, centroids)
        centroid_scores = np.zeros(len(centroids))
        for i in range(len(centroids)):
            centroid_scores[i] = scores[c_labels==i].mean()

        plt.scatter(
            embedding[:, 0],
            embedding[:, 1],
            s=.3,
            c=[1 for _ in range(len(embedding))],
            cmap="Pastel2")

        # show centroids
        plt.scatter(
            centroids[:, 0],
            centroids[:, 1],
            s=5,
            c=centroid_scores/centroid_scores.max(),
            cmap="Reds")

        plt.title('Trajectories Visualization of class {}'.format(cls_num), fontsize=24)
        if save_path is None:
            plt.show()
        else:
            plt.savefig(save_path)
    
    def show_scores(self, cls_num, save_path=None):
        embedding = self.trajectory_embedding[str(cls_num)]
        scores = self.query_noise_score(cls_num)
        scores = scores/scores.max()

        plt.scatter(
            embedding[:, 0],
            embedding[:, 1],
            s=.3,
            c=scores,
            cmap="Reds")

        plt.title('Trajectories Visualization of class {}'.format(cls_num), fontsize=24)
        if save_path is None:
            plt.show()
        else:
            plt.savefig(save_path)