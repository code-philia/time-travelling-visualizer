import numpy as np
import matplotlib.pyplot as plt

import umap.umap_ as umap
from sklearn.metrics import silhouette_score, calinski_harabasz_score
from sklearn.neighbors import NearestNeighbors
from sklearn.cluster import Birch, KMeans

def select_centroid(samples, n_select=3):
    kmeans = KMeans(n_clusters=n_select).fit(samples)

    nbrs = NearestNeighbors(n_neighbors=1, algorithm='ball_tree').fit(samples)
    indices = nbrs.kneighbors(kmeans.cluster_centers_,return_distance=False)
    return indices.squeeze()

def test_abnormal(embeddings, repeat=2, show=False):
    for _ in range(repeat):
        reducer = umap.UMAP(n_components=2)
        embedding = reducer.fit_transform(embeddings)

        brc = Birch(n_clusters=2)
        brc.fit(embedding)

        s = silhouette_score(embedding, brc.labels_, metric='euclidean')
        c = calinski_harabasz_score(embedding, brc.labels_)
        if s <= 0.5:
            continue
        else:
            break
    if s <= 0.5:
        print("No abnormal trajectories detected!")
        return False
    print("silhouette_score\t", s)
    print("calinski_harabasz_score\t", c)

    labels = brc.labels_
    centroid = brc.subcluster_centers_
    centroid_labels = brc.subcluster_labels_
    # clean 1, noise 0
    bin = np.bincount(centroid_labels)
    if bin[0] > bin[1]:
        centroid_labels = np.abs(centroid_labels-1)
        labels = np.abs(labels-1)
    
    # select 3 representative clean ones
    nbrs = NearestNeighbors(n_neighbors=1, algorithm='ball_tree').fit(embedding)
    indices = nbrs.kneighbors(centroid, return_distance=False)
    centroid = embedding[indices.squeeze()]

    # calculate noise score
    clean_centroids = centroid[centroid_labels==1]
    clean_ones = embedding[labels==1]
    nbrs = NearestNeighbors(n_neighbors=1, algorithm='ball_tree').fit(clean_centroids)
    dists, _ = nbrs.kneighbors(clean_ones)
    norm_term = dists.max()

    nbrs = NearestNeighbors(n_neighbors=1, algorithm='ball_tree').fit(clean_centroids)
    dists, _ = nbrs.kneighbors(embedding)
    scores = dists/norm_term
    
    if show:
        plt.scatter(
            embedding[:, 0],
            embedding[:, 1],
            s=1,
            c=labels,
            cmap="Pastel2")

        c_idxs = select_centroid(clean_centroids)
        plt.scatter(
            clean_centroids[c_idxs][:, 0],
            clean_centroids[c_idxs][:, 1],
            s=4,
            c="black",
            )
        plt.scatter(
            centroid[centroid_labels==0][:, 0],
            centroid[centroid_labels==0][:, 1],
            s=4,
            c="red",
            )
        plt.title('Trajectories Visualization', fontsize=24)
        plt.show()

    return labels, scores, centroid, centroid_labels, embedding