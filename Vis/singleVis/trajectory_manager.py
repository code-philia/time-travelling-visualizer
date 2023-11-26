import numpy as np
from sklearn.linear_model import Ridge
from sklearn.cluster import Birch
from pynndescent import NNDescent
from sklearn.neighbors import NearestNeighbors
# TODO random ignore

def find_cluster(trajectories, sub_labels, new_sample):
    nbrs = NearestNeighbors(n_neighbors=2, algorithm='ball_tree').fit(trajectories)
    distances, indices = nbrs.kneighbors(new_sample[np.newaxis,:])
    nearest_neighbor_idx = indices[0, 1]
    nearest_neighbor_dist = distances[0, 1]

    cls_idx = sub_labels[nearest_neighbor_idx]
    samples_in_cls = trajectories[np.argwhere(sub_labels==cls_idx).squeeze()]


    # number of trees in random projection forest
    n_trees = min(64, 5 + int(round(samples_in_cls.shape[0] ** 0.5 / 20.0)))
    # max number of nearest neighbor iters to perform
    n_iters = max(5, int(round(np.log2(samples_in_cls.shape[0]))))
    # get nearest neighbors
    nnd = NNDescent(
        samples_in_cls,
        n_neighbors=2,
        metric="euclidean",
        n_trees=n_trees,
        n_iters=n_iters,
        max_candidates=60,
        verbose=False
    )
    _, dists = nnd.neighbor_graph
    dists = dists[:, 1]
    max_dist = dists.max()
    if nearest_neighbor_dist< max_dist:
        return cls_idx, nearest_neighbor_idx
    else:
        return -1, -1

    

class TrajectoryManager:
    def __init__(self, embeddings_2d, cls_num, period=100, metric="a"):
        """ trajectory manager with no feedback
        sample abnormal samples based on trajectories
        Parameters
        ----------
        samples: ndarray, shape(train_num, repr_dim)
        embeddings_2d : ndarray, shape (train_num, epoch_num, 2)
            all 2d embeddings of representations by timevis
        cls_num: int 
            the number of classes to cluster
        period: int
            We only look at the last *period* epochs of trajectory
        """
        self.embeddings_2d = embeddings_2d
        train_num,time_steps, _ = embeddings_2d.shape
        self.train_num = train_num
        self.time_steps = time_steps
        self.period = period
        self.metric = metric
        self.cls_num = cls_num

        self.v = self.embeddings_2d[:, -period:,:][:,1:,:] - self.embeddings_2d[:, -period:,:][:,:-1,:]
        self.a = self.v[:,1:,:]-self.v[:,:-1,:]
    
    def clustered(self):
        brc = Birch(n_clusters=self.cls_num)
        if self.metric == "v":
            brc.fit(self.v.reshape(self.train_num, -1))
        elif self.metric == "a":
            brc.fit(self.a.reshape(self.train_num, -1))
        else:
            print("Not a valid metric")
        
        self.predict_sub_labels = brc.labels_
        self.suspect_clean = np.argsort(np.bincount(self.predict_sub_labels))[-3:]

        # to be updated each time
        self.sample_rate = np.ones(self.cls_num)
        self.sample_rate[self.suspect_clean] = 0.
        self.selected = np.zeros(self.train_num)
    
    def sample_batch(self, budget):
        not_selected = np.argwhere(self.selected==0).squeeze()
        s_idxs = np.random.choice(not_selected, size=budget)
        return s_idxs
        
    def sample_normal(self, budget):
        # sample class
        normal_rate = 1 - self.sample_rate
        sample_rate = normal_rate[self.predict_sub_labels]
        # check how many left
        not_selected = np.argwhere(self.selected==0).squeeze()
        # select one
        normed_rate = sample_rate[not_selected]/np.sum(sample_rate[not_selected])
        s_idxs = np.random.choice(not_selected, p=normed_rate,size=budget)
        return s_idxs
    
    def update_belief(self, idxs):
        # update parameters
        if len(idxs)>0:
            self.selected[idxs] = 1
    

class FeedbackTrajectoryManager(TrajectoryManager):
    """ trajectory manager with feedback
    sample abnormal samples based on trajectories
    """
    def __init__(self, embeddings_2d, cls_num, period=100, metric="a"):
        super().__init__(embeddings_2d, cls_num, period, metric)
    
    def clustered(self):
        super().clustered()
        # to be updated
        # self.selected
        # self.sample_rate
        self.user_acc = np.zeros(self.train_num)
        self.user_rej = np.zeros(self.train_num)
    
    def sample_batch(self, budget, return_scores=False):
        acc_idxs = np.argwhere(self.user_acc==1).squeeze()
        rej_idxs = np.argwhere(self.user_rej==1).squeeze() 

        acc_rate = np.zeros(self.train_num)
        rej_rate = np.zeros(self.train_num)
        if len(acc_idxs)>0:
            acc_rate[acc_idxs]=1.
        if len(rej_idxs)>0:
            rej_rate[rej_idxs]=1.

        if len(np.intersect1d(acc_idxs, rej_idxs))>0:
            raise Exception("Intersection between acc idxs and rej idxs!")

        exploit_rate = np.zeros(self.cls_num)
        explore_rate = np.zeros(self.cls_num)
        for cls in range(self.cls_num):
            cls_idxs = np.argwhere(self.predict_sub_labels==cls).squeeze()
            acc_num = np.sum(acc_rate[cls_idxs])
            rej_num = np.sum(rej_rate[cls_idxs])
            query_sum = acc_num + rej_num
            if query_sum > 0:
                exploit_rate[cls] = acc_num/query_sum
            explore_rate[cls] = 1 - query_sum/len(cls_idxs)
        
        # remove clean cls
        rate = (explore_rate + exploit_rate)* self.sample_rate
        sample_rate = rate[self.predict_sub_labels]
        not_selected = np.argwhere(self.selected==0).squeeze()
        norm_rate = sample_rate[not_selected]/np.sum(sample_rate[not_selected])
        s_idxs = np.random.choice(not_selected, p=norm_rate, size=budget, replace=False)

        if return_scores:
            scores = sample_rate[s_idxs]
            return s_idxs, scores
        return s_idxs
    
    def update_belief(self, acc_idxs, rej_idxs):
        if len(acc_idxs)>0:
            self.user_acc[acc_idxs]=1
            self.selected[acc_idxs] = 1
        if len(rej_idxs)>0:
            self.user_rej[rej_idxs]=1
            self.selected[rej_idxs] = 1
    

class TBSampling(TrajectoryManager):
    """with no memory, for user study"""
    def __init__(self, embeddings_2d, cls_num, period=100, metric="a"):
        super().__init__(embeddings_2d, cls_num, period, metric)

    def sample_batch(self, acc_idxs, rej_idxs, budget, return_scores=True):
        selected = np.zeros(self.train_num)
        if len(acc_idxs)>0:
            selected[acc_idxs] = 1.
        if len(rej_idxs)>0:
            selected[rej_idxs] = 1.
        if len(np.intersect1d(acc_idxs, rej_idxs))>0:
            raise Exception("Intersection between acc idxs and rej idxs!")
        
        sample_rate = self.sample_rate[self.predict_sub_labels]
        not_selected = np.argwhere(selected==0).squeeze()
        norm_rate = sample_rate[not_selected]/np.sum(sample_rate[not_selected])
        s_idxs = np.random.choice(not_selected, p=norm_rate, size=budget, replace=False)
        if return_scores:
            scores = sample_rate[s_idxs]
            return s_idxs, scores
        return s_idxs


class FeedbackSampling(TrajectoryManager):
    """with no memory, for user study"""
    def __init__(self, embeddings_2d, cls_num, period=100, metric="a"):
        super().__init__(embeddings_2d, cls_num, period, metric)

    def sample_batch(self, acc_idxs, rej_idxs, budget, return_scores=True):
        acc_rate = np.zeros(self.train_num)
        rej_rate = np.zeros(self.train_num)
        selected = np.zeros(self.train_num)
        if len(acc_idxs)>0:
            acc_rate[acc_idxs]=1.
            selected[acc_idxs] = 1.
        if len(rej_idxs)>0:
            rej_rate[rej_idxs]=1.
            selected[rej_idxs] = 1.
        if len(np.intersect1d(acc_idxs, rej_idxs))>0:
            raise Exception("Intersection between acc idxs and rej idxs!")

        exploit_rate = np.zeros(self.cls_num)
        explore_rate = np.zeros(self.cls_num)
        for cls in range(self.cls_num):
            cls_idxs = np.argwhere(self.predict_sub_labels==cls).squeeze()
            acc_num = np.sum(acc_rate[cls_idxs])
            rej_num = np.sum(rej_rate[cls_idxs])
            query_sum = acc_num + rej_num
            if query_sum > 0:
                exploit_rate[cls] = acc_num/query_sum
            explore_rate[cls] = 1 - query_sum/len(cls_idxs)
        
        # remove clean cls
        rate = (explore_rate + exploit_rate)* self.sample_rate
        sample_rate = rate[self.predict_sub_labels]
        not_selected = np.argwhere(selected==0).squeeze()
        norm_rate = sample_rate[not_selected]/np.sum(sample_rate[not_selected])
        s_idxs = np.random.choice(not_selected, p=norm_rate, size=budget, replace=False)
        if return_scores:
            scores = sample_rate[s_idxs]
            return s_idxs, scores
        return s_idxs

# TODO: extension for new features. make features a dictionary
class Recommender:
    def __init__(self, uncertainty, embeddings_2d, cls_num, period):
        """ Recommend samples based on uncertainty and embeddings
        """
        self.uncertainty = uncertainty
        self.embeddings_2d = embeddings_2d
        train_num,time_steps, _ = embeddings_2d.shape
        self.train_num = train_num
        self.time_steps = time_steps
        self.period = period
        self.cls_num = cls_num
        
        self.position = self.embeddings_2d[:, -period:,:].reshape(self.train_num, -1)
        self.v = self.embeddings_2d[:, -period:,:][:,1:,:] - self.embeddings_2d[:, -period:,:][:,:-1,:]
        self.a = (self.v[:,1:,:]-self.v[:,:-1,:]).reshape(self.train_num, -1)
        self.v = self.v.reshape(self.train_num, -1)
    
    @property
    def _sample_p_scores(self):
        return self.p_scores[self.predict_p_sub_labels]
    
    @property
    def _sample_v_scores(self):
        return self.v_scores[self.predict_v_sub_labels]
    
    @property
    def _sample_a_scores(self):
        return self.a_scores[self.predict_a_sub_labels]
    
    def clustered(self):
        brc = Birch(n_clusters=self.cls_num)
        brc.fit(self.v.reshape(self.train_num, -1))
        self.predict_v_sub_labels = brc.labels_
        self.v_scores = np.zeros(self.cls_num)
        for cls in range(self.cls_num):
            self.v_scores[cls] = 1 - np.sum(self.predict_v_sub_labels==cls)/self.train_num

        brc = Birch(n_clusters=self.cls_num)
        brc.fit(self.a.reshape(self.train_num, -1))
        self.predict_a_sub_labels = brc.labels_
        self.a_scores = np.zeros(self.cls_num)
        for cls in range(self.cls_num):
            self.a_scores[cls] = 1 - np.sum(self.predict_a_sub_labels==cls)/self.train_num

        brc = Birch(n_clusters=self.cls_num)
        brc.fit(self.position.reshape(self.train_num, -1))
        self.predict_p_sub_labels = brc.labels_
        self.p_scores = np.zeros(self.cls_num)
        for cls in range(self.cls_num):
            self.p_scores[cls] = 1 - np.sum(self.predict_p_sub_labels==cls)/self.train_num

    def sample_batch_init(self, acc_idxs, rej_idxs, budget):
        scores = (self.uncertainty + self.v_scores[self.predict_v_sub_labels]+self.a_scores[self.predict_a_sub_labels]+self.p_scores[self.predict_p_sub_labels])/4
        selected = np.zeros(self.train_num)
        if len(acc_idxs)>0:
            selected[acc_idxs] = 1.
        if len(rej_idxs)>0:
            selected[rej_idxs] = 1.
        if len(np.intersect1d(acc_idxs, rej_idxs))>0:
            raise Exception("Intersection between acc idxs and rej idxs!")
        not_selected_idxs = np.argwhere(selected==0).squeeze()
        norm_rate = scores[not_selected_idxs]/np.sum(scores[not_selected_idxs])
        s_idxs = np.random.choice(not_selected_idxs, p=norm_rate, size=budget, replace=False)
        return s_idxs, scores[s_idxs]
    
    def sample_batch(self, acc_idxs, rej_idxs, budget, return_coef=False):
        if len(np.intersect1d(acc_idxs, rej_idxs))>0:
            raise Exception("Intersection between acc idxs and rej idxs!")
            
        s1 = self.uncertainty
        s2 = self.v_scores[self.predict_v_sub_labels]
        s3 = self.a_scores[self.predict_a_sub_labels]
        s4 = self.p_scores[self.predict_p_sub_labels]
        X = np.vstack((s1,s2,s3,s4)).transpose([1,0])

        exp_idxs = np.concatenate((acc_idxs, rej_idxs), axis=0)
        target_X = X[exp_idxs]
        target_Y = np.zeros(len(exp_idxs))
        target_Y[:len(acc_idxs)] = 1
        krr = Ridge(alpha=1.0)
        krr.fit(target_X, target_Y)
        scores = krr.predict(X)

        not_selected = np.setdiff1d(np.arange(self.train_num), exp_idxs)
        remain_scores = scores[not_selected]
        args = np.argsort(remain_scores)[-budget:]
        selected_idxs = not_selected[args]
        if return_coef:
            return selected_idxs, scores[selected_idxs], krr.coef_
        return selected_idxs, scores[selected_idxs]
    
    def sample_batch_normal_init(self, acc_idxs, rej_idxs, budget):
        # scores = (self.uncertainty + self.cls_scores[self.predict_sub_labels])/2
        scores = (self.uncertainty + self.v_scores[self.predict_v_sub_labels]+self.a_scores[self.predict_a_sub_labels]+self.p_scores[self.predict_p_sub_labels])/4
        
        selected = np.zeros(self.train_num)
        if len(acc_idxs)>0:
            selected[acc_idxs] = 1.
        if len(rej_idxs)>0:
            selected[rej_idxs] = 1.
        if len(np.intersect1d(acc_idxs, rej_idxs))>0:
            raise Exception("Intersection between acc idxs and rej idxs!")
        not_selected_idxs = np.argwhere(selected==0).squeeze()

        norm_rate = (1 - scores[not_selected_idxs])/np.sum((1 - scores[not_selected_idxs]))
        s_idxs = np.random.choice(not_selected_idxs, p=norm_rate, size=budget, replace=False)
        return s_idxs, scores[s_idxs]
    
    def sample_batch_normal(self, acc_idxs, rej_idxs, budget):
        if len(np.intersect1d(acc_idxs, rej_idxs))>0:
            raise Exception("Intersection between acc idxs and rej idxs!")
            
        s1 = self.uncertainty
        s2 = self.v_scores[self.predict_v_sub_labels]
        s3 = self.a_scores[self.predict_a_sub_labels]
        s4 = self.p_scores[self.predict_p_sub_labels]
        X = np.vstack((s1,s2,s3,s4)).transpose([1,0])

        exp_idxs = np.concatenate((acc_idxs, rej_idxs), axis=0)
        target_X = X[exp_idxs]
        target_Y = np.zeros(len(exp_idxs))
        target_Y[:len(acc_idxs)] = 1
        krr = Ridge(alpha=1.0)
        krr.fit(target_X, target_Y)
        scores = krr.predict(X)

        not_selected = np.setdiff1d(np.arange(self.train_num), exp_idxs)
        remain_scores = scores[not_selected]
        args = np.argsort(remain_scores)[:budget]
        selected_idxs = not_selected[args]
        return selected_idxs, scores[selected_idxs]
    
    def score_new_sample(self, sample_trajectory, return_nearest=False):
        new_position = sample_trajectory.reshape(-1)
        new_v = sample_trajectory[1:, :] - sample_trajectory[:-1, :]
        new_a = (new_v[1:,:]-new_v[:-1,:]).reshape(-1)
        new_v = new_v.reshape(-1)

        position_cls, p_nearest_idx = find_cluster(self.position, self.predict_p_sub_labels, new_position)
        v_cls, v_nearest_idx = find_cluster(self.v, self.predict_v_sub_labels, new_v)
        a_cls, a_nearest_idx = find_cluster(self.a, self.predict_a_sub_labels, new_a)

        new_p_score = self.p_scores[position_cls] if position_cls>=0 else 1-1/self.train_num
        new_v_score = self.v_scores[v_cls] if v_cls>=0 else 1-1/self.train_num
        new_a_score = self.a_scores[a_cls] if a_cls>=0 else 1-1/self.train_num
        if return_nearest:
            return (new_p_score, new_v_score, new_a_score), (p_nearest_idx, v_nearest_idx, a_nearest_idx)
        return new_p_score, new_v_score, new_a_score

        



