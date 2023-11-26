import numpy as np
import json
import os
from pynndescent import NNDescent

# helper function
def hausdorff_d(curr_data, prev_data):
    # number of trees in random projection forest
    n_trees = min(64, 5 + int(round((curr_data.shape[0]) ** 0.5 / 20.0)))
    # max number of nearest neighbor iters to perform
    n_iters = max(5, int(round(np.log2(curr_data.shape[0]))))
    # distance metric
    metric = "euclidean"
    # get nearest neighbors
    nnd = NNDescent(
        curr_data,
        n_neighbors=1,
        metric=metric,
        n_trees=n_trees,
        n_iters=n_iters,
        max_candidates=10,
        verbose=False
    )
    _, dists1 = nnd.query(prev_data,k=1)
    m1 = dists1.mean()
    return m1

class Segmenter:
    def __init__(self, data_provider, threshold, range_s=None, range_e=None, range_p=None):
        self.data_provider = data_provider
        self.threshold = threshold
        if range_s is None:
            self.s = data_provider.s
            self.e = data_provider.e
            self.p = data_provider.p
        else:
            self.s = range_s
            self.e = range_e
            self.p = range_p

    def _cal_interval_dists(self):
        interval_num = (self.e - self.s)// self.p

        dists = np.zeros(interval_num)
        for curr_epoch in range(self.s, self.e, self.p):
            next_data = self.data_provider.train_representation(curr_epoch+ self.p)
            curr_data = self.data_provider.train_representation(curr_epoch)
            l = next_data.shape[0]
            next_data = next_data.reshape(l, - 1)
            curr_data = curr_data.reshape(l, -1)
            # reshape representation
            dists[(curr_epoch-self.s)//self.p] = hausdorff_d(curr_data=next_data, prev_data=curr_data)
        
        # self.dists = np.copy(dists)
        return dists
    def segment(self):
        dists = self._cal_interval_dists()
        dists_segs = list()
        count = 0
        base = len(dists)-1
        for i in range(len(dists)-1, -1, -1):
            count = count + dists[i]
            if count >self.threshold:
                dists_segs.insert(0, (i+1, base))
                base = i
                count = dists[i]
        dists_segs.insert(0, (0, base))
        segs = [(self.s+i*self.p, self.s+(j+1)*self.p) for i, j in dists_segs]
        self.segments = segs
        return segs
    
    def record_time(self, save_dir, file_name, t):
        # save result
        save_file = os.path.join(save_dir, file_name+".json")
        if not os.path.exists(save_file):
            evaluation = dict()
        else:
            f = open(save_file, "r")
            evaluation = json.load(f)
            f.close()
        evaluation["segmentation"] = round(t, 3)
        with open(save_file, 'w') as f:
            json.dump(evaluation, f)


class DenseALSegmenter(Segmenter):
    def __init__(self, data_provider, threshold, epoch_num):
        super().__init__(data_provider, threshold, 1, epoch_num, 1)
    
    def _cal_interval_dists(self, iteration):
        interval_num = (self.e - self.s)// self.p

        dists = np.zeros(interval_num)
        for curr_epoch in range(self.s, self.e, self.p):
            next_data = self.data_provider.train_representation_lb(iteration, curr_epoch+ self.p)
            curr_data = self.data_provider.train_representation_lb(iteration, curr_epoch)
            dists[(curr_epoch-self.s)//self.p] = hausdorff_d(curr_data=next_data, prev_data=curr_data)
        
        # self.dists = np.copy(dists)
        return dists
    def segment(self, iteration):
        dists = self._cal_interval_dists(iteration)
        dists_segs = list()
        count = 0
        base = len(dists)-1
        for i in range(len(dists)-1, -1, -1):
            count = count + dists[i]
            if count >self.threshold:
                dists_segs.insert(0, (i+1, base))
                base = i
                count = dists[i]
        dists_segs.insert(0, (0, base))
        segs = [(self.s+i*self.p, self.s+(j+1)*self.p) for i, j in dists_segs]
        return segs


        
        


