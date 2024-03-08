
from abc import ABC, abstractmethod

from time import time
import numpy as np
import scipy

from umap.umap_ import compute_membership_strengths

from singleVis.backend import get_graph_elements

# helper functions
def knn_dists(X, indices, knn_indices):
    data = X[indices][:,None,:]
    knn_data = X[knn_indices]
    knn_dists = np.linalg.norm(data-knn_data, axis=2)
    return knn_dists

class TemporalEdgeConstructorAbstractClass(ABC):
    @abstractmethod
    def __init__(self) -> None:
        pass

    @abstractmethod
    def construct(self, *args, **kwargs):
        # return head, tail, weight, feature_vectors
        pass


'''Base class for complex edges constructor'''
class TemporalEdgeConstructor(TemporalEdgeConstructorAbstractClass):
  
    def __init__(self, X, time_step_nums, sigmas, rhos, n_neighbors, n_epochs) -> None:
        """Init Parameters for Temporal Edge Constructor

        Parameters
        ----------
        X : ndarray, shape (N, feature_dim)
            feature vectors for complex construction
        time_step_nums : list, [(t_num, b_num)]
            the number of training points and boundary points of all time steps
        sigmas : ndarray, shape (N_T+N_B,)
            the sigmas of all feature vector
        rhos : ndarray, shape (N_T+N_B,)
            the rhos of all feature vectors
        n_neighbors : int
            locally connectivity
        n_epochs: int
        """
        self.features = X
        self.time_step_nums = time_step_nums
        self.time_steps = len(time_step_nums)
        self.sigmas = sigmas
        self.rhos = rhos
        self.n_neighbors = n_neighbors
        self.n_epochs = n_epochs
    
    def temporal_simplicial_set(
        self,
        rows,
        cols,
        vals,
        n_vertice,
        set_op_mix_ratio=1.0,
        apply_set_operations=True):
        """
        Given the edges and edge weights, compute the simplicial set
        (here represented as a fuzzy graph in the form of a sparse matrix)
        associated to the data.
        This is done by locally approximating geodesic distance at each point,
        creating a fuzzy simplicial set for each such point,
        and then combining all the local fuzzy simplicial sets into a global one via a fuzzy union.

        Parameters
        ----------
        rows: list
            index list of edge_to
        cols: list
            index list of edge_from
        vals: list
            list of edge weights
        n_vertice: int
            the number of vertices
        set_op_mix_ratio: float (optional, default 1.0)
            Interpolate between (fuzzy) union and intersection as the set operation
            used to combine local fuzzy simplicial sets to obtain a global fuzzy
            simplicial sets. Both fuzzy set operations use the product t-norm.
            The value of this parameter should be between 0.0 and 1.0; a value of
            1.0 will use a pure fuzzy union, while 0.0 will use a pure fuzzy
            intersection.
        local_connectivity: int (optional, default 1)
            The local connectivity required -- i.e. the number of nearest
            neighbors that should be assumed to be connected at a local level.
            The higher this value the more connected the manifold becomes
            locally. In practice this should be not more than the local intrinsic
            dimension of the manifold.
        apply_set_operations:

        Returns:
        ----------
        coo_matrix
            A fuzzy simplicial set represented as a sparse matrix. The (i,
            j) entry of the matrix represents the membership strength of the
            1-simplex between the ith and jth sample points.
        """
        result = scipy.sparse.coo_matrix(
            (vals, (rows, cols)), shape=(n_vertice, n_vertice)
        )
        result.eliminate_zeros()

        if apply_set_operations:
            transpose = result.transpose()
            prod_matrix = result.multiply(transpose)
            result = (
                    set_op_mix_ratio * (result + transpose - prod_matrix)
                    + (1.0 - set_op_mix_ratio) * prod_matrix
            )
        result.eliminate_zeros()
        return result
        
    def construct(self):
        return NotImplemented


"""
Strategies:
    Local strategy:
        connect each sample to its nearby epochs
    Global strategy:
        connect each sample to its k temporal neighbors
    GlobalParallel strategy:
        connect each sample to its k temporal neighbors
"""

class LocalTemporalEdgeConstructor(TemporalEdgeConstructor):
    def __init__(self, X, time_step_nums, sigmas, rhos, n_neighbors, n_epochs, persistent, time_step_idxs_list, knn_indices) -> None:
        """
        construct temporal edges based on same data
        link data to its next epoch

        Parameters
        ----------
        X : ndarray, shape (N, feature_dim)
            feature vectors for complex construction
        time_step_nums : list, [(t_num, b_num)]
            the number of training points and boundary points of all time steps
        sigmas : ndarray, shape (N_T+N_B,)
            the sigmas of all feature vector
        rhos : ndarray, shape (N_T+N_B,)
            the rhos of all feature vectors
        n_neighbors : int
            locally connectivity
        persistent : int
            the sliding window size
        time_step_idxs_list : list
            the index list connect each time step to its next time step
        knn_indices : ndarray, shape (N, n_neighbors)
            the knn indices of samples in each time step
        """
        super().__init__(X, time_step_nums, sigmas, rhos, n_neighbors, n_epochs)
        self.persistence = persistent
        self.time_step_idxs_list = time_step_idxs_list
        self.knn_indices = knn_indices
    
    def construct(self):
        """construct temporal edges

        Returns
        -------
        time_complex: scipy matrix
            the temporal complex containing temporal edges
        """
        rows = np.zeros(1, dtype=np.int32)
        cols = np.zeros(1, dtype=np.int32)
        vals = np.zeros(1, dtype=np.float32)

        n_all = 0
        time_step_num = list()
        for i in self.time_step_nums:
            time_step_num.append(n_all)
            n_all = n_all + i[0]
        n_all = 0
        all_step_num = list()
        for i in self.time_step_nums:
            all_step_num.append(n_all)
            n_all = n_all + i[0] + i[1]
        
        # forward
        for window in range(1, self.persistent + 1, 1):
            for step in range(0, self.time_steps - window, 1):
                knn_indices_in = - np.ones((n_all, self.n_neighbors))
                knn_dist = np.zeros((n_all, self.n_neighbors))

                next_knn = self.knn_indices[time_step_num[step+window]:time_step_num[step+window] + self.time_step_nums[step + window][0]]

                # knn_indices_in[all_step_num[step]: all_step_num[step] + time_step_nums[step + window][0]] = next_knn
                increase_idx = all_step_num[step]
                assert len(next_knn) == len(self.time_step_idxs_list[step+window])
                for i in range(len(self.time_step_idxs_list[step+window])):
                    knn_indices_in[increase_idx + self.time_step_idxs_list[step+window][i]]=next_knn[i]
                knn_indices_in = knn_indices_in.astype('int')

                indices = np.arange(all_step_num[step], all_step_num[step] + self.time_step_nums[step][0], 1)[self.time_step_idxs_list[step+window]]
                knn_dists_t = knn_dists(self.features, indices, next_knn)

                # knn_dist[all_step_num[step]:all_step_num[step] + time_step_nums[step + window][0]] = knn_dists_t
                assert len(knn_dists_t) == len(self.time_step_idxs_list[step+window])
                for i in range(len(self.time_step_idxs_list[step+window])):
                    knn_dist[increase_idx + self.time_step_idxs_list[step+window][i]]=knn_dists_t[i]
                knn_dist = knn_dist.astype('float32')

                rows_t, cols_t, vals_t, _ = compute_membership_strengths(knn_indices_in, knn_dist, self.sigmas, self.rhos, return_dists=False)
                idxs = vals_t > 0
                rows = np.concatenate((rows, rows_t[idxs]), axis=0)
                cols = np.concatenate((cols, cols_t[idxs]), axis=0)
                vals = np.concatenate((vals, vals_t[idxs]), axis=0)
        # backward
        for window in range(1, self.persistent + 1, 1):
            for step in range(self.time_steps-1, 0 + window, -1):
                knn_indices_in = - np.ones((n_all, self.n_neighbors))
                knn_dist = np.zeros((n_all, self.n_neighbors))

                prev_knn = self.knn_indices[time_step_num[step-window]:time_step_num[step-window] + self.time_step_nums[step-window][0]]

                knn_indices_in[all_step_num[step]: all_step_num[step] + self.time_step_nums[step][0]] = prev_knn[self.time_step_idxs_list[step]]
                knn_indices_in = knn_indices_in.astype('int')

                indices = np.arange(all_step_num[step], all_step_num[step] + self.time_step_nums[step][0], 1)
                knn_dists_t = knn_dists(self.features, indices, prev_knn[self.time_step_idxs_list[step]])

                knn_dist[all_step_num[step]:all_step_num[step] + self.time_step_nums[step][0]] = knn_dists_t
                knn_dist = knn_dist.astype('float32')

                rows_t, cols_t, vals_t, _ = compute_membership_strengths(knn_indices_in, knn_dist, self.sigmas, self.rhos, return_dists=False)
                idxs = vals_t > 0
                rows = np.concatenate((rows, rows_t[idxs]), axis=0)
                cols = np.concatenate((cols, cols_t[idxs]), axis=0)
                vals = np.concatenate((vals, vals_t[idxs]), axis=0)
        time_complex = self.temporal_simplicial_set(rows=rows, cols=cols, vals=vals, n_vertice=len(self.features))

        # normalize for symmetry reason
        _, heads, tails, weights, _ = get_graph_elements(time_complex, n_epochs=self.n_epochs)
        
        return heads, tails, weights




class GlobalTemporalEdgeConstructor(TemporalEdgeConstructor):
    def __init__(self, X, time_step_nums, sigmas, rhos, n_neighbors, n_epochs) -> None:
        super().__init__(X, time_step_nums, sigmas, rhos, n_neighbors, n_epochs)
    
    def construct(self):
        rows = np.zeros(1, dtype=np.int32)
        cols = np.zeros(1, dtype=np.int32)
        vals = np.zeros(1, dtype=np.float32)

        # base_idx denote the starting point of each time step (including borders)
        base_idx = 0
        base_idx_list = list()
        for i in self.time_step_nums:
            base_idx_list.append(base_idx)
            base_idx = base_idx + i[0] + i[1]
        base_idx_list = np.array(base_idx_list, dtype=int)

        # denote the training data idxs range at each time step
        valid_idx_list = list()
        for i in range(len(self.time_step_nums)):
            valid_idx_list.append(base_idx_list[i]+self.time_step_nums[i][0])
        valid_idx_list = np.array(valid_idx_list, dtype=int)
        
        num = len(self.features)

        # placeholder for knn_indices and knn_dists
        indices = - np.ones((num, self.n_neighbors), dtype=int)
        dists = np.zeros((num, self.n_neighbors), dtype=np.float32)

        for time_step in range(self.time_steps):
            start_idx = base_idx_list[time_step]
            end_idx = start_idx + self.time_step_nums[time_step][0] - 1
            move_positions = base_idx_list - start_idx
            for train_sample_idx in range(start_idx, end_idx + 1, 1):
                candidate_idxs = train_sample_idx + move_positions
                candidate_idxs = candidate_idxs[np.logical_and(candidate_idxs>=base_idx_list, candidate_idxs<valid_idx_list)]
                nn_dist = knn_dists(self.features, [train_sample_idx], candidate_idxs).squeeze(axis=0)
                # find top k
                order = np.argsort(nn_dist)
                # deal with if len(candidate_idxs)<n_neighbors situation
                top_k_idxs = candidate_idxs[order<self.n_neighbors]
                top_k_idxs = np.pad(top_k_idxs, (0, self.n_neighbors-len(top_k_idxs)), 'constant', constant_values=-1).astype('int')
                top_k_dists = nn_dist[order<self.n_neighbors]
                top_k_dists = np.pad(top_k_dists, (0, self.n_neighbors-len(top_k_dists)), 'constant', constant_values=0.).astype(np.float32)

                indices[train_sample_idx] = top_k_idxs
                dists[train_sample_idx] = top_k_dists

        rows, cols, vals, _ = compute_membership_strengths(indices, dists, self.sigmas, self.rhos, return_dists=False)
        # build time complex
        time_complex = self.temporal_simplicial_set(rows=rows, cols=cols, vals=vals, n_vertice=num)
        # normalize for symmetry reason
        _, heads, tails, weights, _ = get_graph_elements(time_complex, n_epochs=self.n_epochs)

        return heads, tails, weights


class GlobalParallelTemporalEdgeConstructor(TemporalEdgeConstructor):
    def __init__(self, X, time_step_nums, sigmas, rhos, n_neighbors, n_epochs, selected_idxs_lists) -> None:
        super().__init__(X, time_step_nums, sigmas, rhos, n_neighbors, n_epochs)
        self.selected_idxs = selected_idxs_lists
    
    def construct(self):
        # base index denote the starting point of each epoch (including border points)
        base_idx = 0
        base_idx_list = list()
        for i in self.time_step_nums:
            base_idx_list.append(base_idx)
            base_idx = base_idx + i[0] + i[1]
        base_idx_list = np.array(base_idx_list, dtype=int)

        num = len(self.features)

        # placeholder for knn_indices and knn_dists
        indices = - np.ones((num, self.n_neighbors), dtype=int)
        dists = np.zeros((num, self.n_neighbors), dtype=np.float32)

        for time_step in range(self.time_steps):
            for point_idx in range(len(self.selected_idxs[time_step])):
                true_idx = self.selected_idxs[time_step][point_idx]

                identical_self = list()
                for e in range(self.time_steps):
                    arg = np.argwhere(self.selected_idxs[e]==true_idx)
                    if arg.shape[0]:
                        target_idx = arg[0][0]
                        identical_self.append(base_idx_list[e]+target_idx)
                    
                if len(identical_self) >0:
                    # identical self number exceeds n_neighbors, need to select top n_neighbors
                    curr_idx = base_idx_list[time_step]+point_idx
                    candidate_idxs = np.array(identical_self)
                    nn_dist = knn_dists(self.features, [curr_idx], candidate_idxs).squeeze(axis=0)
                    # find top k
                    order = np.argsort(nn_dist)
                    # deal with if len(candidate_idxs)<n_neighbors situation
                    top_k_idxs = candidate_idxs[order<self.n_neighbors]
                    top_k_idxs = np.pad(top_k_idxs, (0, self.n_neighbors-len(top_k_idxs)), 'constant', constant_values=-1).astype('int')
                    top_k_dists = nn_dist[order<self.n_neighbors]
                    top_k_dists = np.pad(top_k_dists, (0, self.n_neighbors-len(top_k_dists)), 'constant', constant_values=0.).astype(np.float32)

                    indices[curr_idx] = top_k_idxs
                    dists[curr_idx] = top_k_dists

        rows, cols, vals, _ = compute_membership_strengths(indices, dists, self.sigmas, self.rhos, return_dists=False)
        if len(rows)>0:
            # build time complex
            time_complex = self.temporal_simplicial_set(rows=rows, cols=cols, vals=vals, n_vertice=num)
            # normalize for symmetry reason
            _, heads, tails, weights, _ = get_graph_elements(time_complex, n_epochs=self.n_epochs)

            return heads, tails, weights
        else:
            rows = np.zeros(1, dtype=np.int32)
            cols = np.zeros(1, dtype=np.int32)
            vals = np.zeros(1, dtype=np.float32)
            return rows, cols, vals