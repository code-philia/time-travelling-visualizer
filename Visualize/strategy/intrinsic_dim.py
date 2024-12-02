from audioop import mul
import numpy as np
from pynndescent import NNDescent
from sklearn.linear_model import LinearRegression
from tqdm import tqdm


class IntrinsicDim:
    def __init__(self, data, metric="euclidean"):
        # normalize and if redundant
        self.data = np.unique(data.reshape(len(data), -1), axis=0)

        self.metric = metric
        self.name = "Intrinsic Dimension"


    def find_mu(self):
        # number of trees in random projection forest
        n_trees = min(64, 5 + int(round((self.data.shape[0]) ** 0.5 / 20.0)))
        # max number of nearest neighbor iters to perform
        n_iters = max(5, int(round(np.log2(self.data.shape[0]))))
        # distance metric
        # get nearest neighbors
        nnd = NNDescent(
            self.data,
            n_neighbors=3,
            metric=self.metric,
            n_trees=n_trees,
            n_iters=n_iters,
            max_candidates=10,
            verbose=False
        )
        _, knn_dists = nnd.neighbor_graph
        mu = knn_dists[:, 2] / knn_dists[:, 1]
        return mu

    def estimate_id_fast(self):
        mu = self.find_mu()
        N = self.data.shape[0]
        sort_idx = np.argsort(mu)
        Femp     = np.arange(N)/N
        lr = LinearRegression(fit_intercept=False)
        lr.fit(np.log(mu[sort_idx]).reshape(-1,1), -np.log(1-Femp).reshape(-1,1))
        d = lr.coef_[0][0] 
        return d
        
    def estimate_id(self):
        N = self.data.shape[0]
        mu = np.zeros(N)
        for i in tqdm(range(N)):
            dist = np.sort(np.sqrt(np.sum((self.data[i]-self.data)**2, axis=1)))
            r1, r2 = dist[dist>0][:2]
            mu[i]=r2/r1
        sort_idx = np.argsort(mu)
        Femp     = np.arange(N)/N
        lr = LinearRegression(fit_intercept=False)
        lr.fit(np.log(mu[sort_idx]).reshape(-1,1), -np.log(1-Femp).reshape(-1,1))
        d = lr.coef_[0][0] 

        return d

    def twonn_dimension(self, return_xy=False):
        N = len(self.data)
        mu = []
        for i in tqdm(range(N)):
            dist = np.sort(np.sqrt(np.sum((self.data[i]-self.data)**2, axis=1)))
            r1, r2 = dist[dist>0][:2]
            mu.append((i+1,r2/r1))
        sigma_i = dict(zip(range(1,len(mu)+1), np.array(sorted(mu, key=lambda x: x[1]))[:,0].astype(int)))
        mu = dict(mu)
        F_i = {}
        for i in mu:
            F_i[sigma_i[i]] = i/N
        x = np.log([mu[i] for i in sorted(mu.keys())])
        y = np.array([1-F_i[i] for i in sorted(mu.keys())])
        x = x[y>0]
        y = y[y>0]
        y = -1*np.log(y)
        d = np.linalg.lstsq(np.vstack([x, np.zeros(len(x))]).T, y, rcond=None)[0][0]
        if return_xy:
            return d, x, y
        else: 
            return d

    def twonn_dimension_fast(self):
        N = len(self.data)
        mu = self.find_mu().tolist()
        mu = list(enumerate(mu, start=1))  
        sigma_i = dict(zip(range(1,len(mu)+1), np.array(sorted(mu, key=lambda x: x[1]))[:,0].astype(int)))
        mu = dict(mu)
        F_i = {}
        for i in mu:
            F_i[sigma_i[i]] = i/N
        x = np.log([mu[i] for i in sorted(mu.keys())])
        y = np.array([1-F_i[i] for i in sorted(mu.keys())])
        x = x[y>0]
        y = y[y>0]
        y = -1*np.log(y)
        d = np.linalg.lstsq(np.vstack([x, np.zeros(len(x))]).T, y, rcond=None)[0][0]
        return d
