'''This class serves as a intermediate layer for tensorboard frontend and DeepDebugger backend'''
from abc import ABC, abstractmethod
import os
import sys
import json
import time
import torch
import numpy as np
import pickle
import shutil

import torch.nn

from scipy.special import softmax

from strategy import StrategyAbstractClass

from singleVis.utils import *
from singleVis.trajectory_manager import Recommender
from singleVis.active_sampling import random_sampling, uncerainty_sampling

# active_learning_path = "../../ActiveLearning"
# sys.path.append(active_learning_path)

'''the context for different dataset setting'''
class Context(ABC):
    """
    The Context defines the interface of interest to users of our visualization method.
    """
    def __init__(self, strategy: StrategyAbstractClass) -> None:
        """
        Usually, the Context accepts a visualization strategy through the constructor, but
        also provides a setter to change it at runtime.
        """
        self._strategy = strategy

    @property
    def strategy(self) -> StrategyAbstractClass:
        return self._strategy

    @strategy.setter
    def strategy(self, strategy: StrategyAbstractClass) -> None:
        self._strategy = strategy

class VisContext(Context):
    '''Normal setting'''
    #################################################################################################################
    #                                                                                                               #
    #                                                  Adapter                                                      #
    #                                                                                                               #
    #################################################################################################################

    def train_representation_data(self, EPOCH):
        return self.strategy.data_provider.train_representation(EPOCH)
    
    def test_representation_data(self, EPOCH):
        return self.strategy.data_provider.test_representation(EPOCH)
    
    def train_labels(self, EPOCH):
        return self.strategy.data_provider.train_labels(EPOCH)

    def test_labels(self, EPOCH):
        return self.strategy.data_provider.test_labels(EPOCH)
    
    def suggest_abnormal(self, strategy, acc_idxs, rej_idxs, budget):
        ntd = self._init_detection()
        if strategy == "TBSampling":
            suggest_idxs, scores = ntd.sample_batch_init(acc_idxs, rej_idxs, budget)
        elif strategy == "Feedback":
            suggest_idxs, scores = ntd.sample_batch(acc_idxs, rej_idxs, budget)
        else:
            raise NotImplementedError
        suggest_labels = self.clean_labels[suggest_idxs]
        return suggest_idxs, scores, suggest_labels
    

    #################################################################################################################
    #                                                                                                               #
    #                                                data Panel                                                     #
    #                                                                                                               #
    #################################################################################################################

    def batch_inv_preserve(self, epoch, data):
        """
        get inverse confidence for a single point
        :param epoch: int
        :param data: numpy.ndarray
        :return l: boolean, whether reconstruction data have the same prediction
        :return conf_diff: float, (0, 1), confidence difference
        """
        embedding = self.strategy.projector.batch_project(epoch, data)
        recon = self.strategy.projector.batch_inverse(epoch, embedding)
    
        ori_pred = self.strategy.data_provider.get_pred(epoch, data)
        new_pred = self.strategy.data_provider.get_pred(epoch, recon)
        ori_pred = softmax(ori_pred, axis=1)
        new_pred = softmax(new_pred, axis=1)

        old_label = ori_pred.argmax(-1)
        new_label = new_pred.argmax(-1)
        l = old_label == new_label

        old_conf = [ori_pred[i, old_label[i]] for i in range(len(old_label))]
        new_conf = [new_pred[i, old_label[i]] for i in range(len(old_label))]
        old_conf = np.array(old_conf)
        new_conf = np.array(new_conf)

        conf_diff = old_conf - new_conf
        return l, conf_diff
    
    #################################################################################################################
    #                                                                                                               #
    #                                                Search Panel                                                   #
    #                                                                                                               #
    #################################################################################################################

    # TODO: fix bugs accroding to new api
    # customized features
    def filter_label(self, label, epoch_id):
        try:
            index = self.strategy.data_provider.classes.index(label)
        except:
            index = -1
        train_labels = self.strategy.data_provider.train_labels(epoch_id)
        test_labels = self.strategy.data_provider.test_labels(epoch_id)
        labels = np.concatenate((train_labels, test_labels), 0)
        idxs = np.argwhere(labels == index)
        idxs = np.squeeze(idxs)
        return idxs

    def filter_type(self, type, epoch_id):
        if type == "train":
            res = self.get_epoch_index(epoch_id)
        elif type == "test":
            train_num = self.strategy.data_provider.train_num
            test_num = self.strategy.data_provider.test_num
            res = list(range(train_num, train_num+ test_num, 1))
        elif type == "unlabel":
            labeled = np.array(self.get_epoch_index(epoch_id))
            train_num = self.strategy.data_provider.train_num
            all_data = np.arange(train_num)
            unlabeled = np.setdiff1d(all_data, labeled)
            res = unlabeled.tolist()
        else:
            # all data
            train_num = self.strategy.data_provider.train_num
            test_num = self.strategy.data_provider.test_num
            res = list(range(0, train_num + test_num, 1))
        return res
    
    def filter_conf(self, conf_min, conf_max, epoch_id):
        train_data = self.strategy.data_provider.train_representation(epoch_id)
        test_data =self.strategy.data_provider.test_representation(epoch_id)
        data = np.concatenate((train_data, test_data), axis=0)
        pred = self.strategy.data_provider.get_pred(epoch_id, data)
        scores = np.amax(softmax(pred, axis=1), axis=1)
        res = np.argwhere(np.logical_and(scores<=conf_max, scores>=conf_min)).squeeze().tolist()
        return res


    #################################################################################################################
    #                                                                                                               #
    #                                             Helper Functions                                                  #
    #                                                                                                               #
    #################################################################################################################

    def save_acc_and_rej(self, acc_idxs, rej_idxs, file_name):
        d = {
            "acc_idxs": acc_idxs,
            "rej_idxs": rej_idxs
        }
        path = os.path.join(self.strategy.data_provider.content_path, "{}_acc_rej.json".format(file_name))
        with open(path, "w") as f:
            json.dump(d, f)
        print("Successfully save the acc and rej idxs selected by user...")

    def get_epoch_index(self, epoch_id):
        """get the training data index for an epoch"""
        index_file = os.path.join(self.strategy.data_provider.model_path, "Epoch_{:d}".format(epoch_id), "index.json")
        index = load_labelled_data_index(index_file)
        return index
    
    def get_max_iter(self):
        EPOCH_START = self.strategy.config["EPOCH_START"]
        EPOCH_END = self.strategy.config["EPOCH_END"]
        EPOCH_PERIOD = self.strategy.config["EPOCH_PERIOD"]
        return int((EPOCH_END-EPOCH_START)/EPOCH_PERIOD)+1
    
    def reset(self):
        return


class ActiveLearningContext(VisContext):
    '''Active learning dataset'''
    def __init__(self, strategy) -> None:
        super().__init__(strategy)

    '''Active learning setting'''
    #################################################################################################################
    #                                                                                                               #
    #                                                  Adapter                                                      #
    #                                                                                                               #
    #################################################################################################################

    def train_representation_data(self, iteration):
        return self.strategy.data_provider.train_representation_all(iteration)
    
    def train_labels(self, iteration):
        labels = self.strategy.data_provider.train_labels_all()
        return labels

    
    def save_acc_and_rej(self, iteration, acc_idxs, rej_idxs, file_name):
        d = {
            "acc_idxs": acc_idxs,
            "rej_idxs": rej_idxs
        }
        path = os.path.join(self.strategy.data_provider.checkpoint_path(iteration), "{}_acc_rej.json".format(file_name))
        with open(path, "w") as f:
            json.dump(d, f)
        print("Successfully save the acc and rej idxs selected by user at Iteration {}...".format(iteration))
    
    def reset(self, iteration):
        # delete [iteration,...)
        max_i = self.get_max_iter()
        for i in range(iteration, max_i+1, 1):
            path = self.strategy.data_provider.checkpoint_path(iteration)
            shutil.rmtree(path)
        iter_structure_path = os.path.join(self.strategy.data_provider.content_path, "iteration_structure.json")
        with open(iter_structure_path, "r") as f:
            i_s = json.load(f)
        new_is = list()
        for item in i_s:
            value = item["value"]
            if value < iteration:
                new_is.append(item)
        with open(iter_structure_path, "w") as f:
            json.dump(new_is, f)
        print("Successfully remove cache data!")

    def get_epoch_index(self, iteration):
        """get the training data index for an epoch"""
        index_file = os.path.join(self.strategy.data_provider.checkpoint_path(iteration), "index.json")
        index = load_labelled_data_index(index_file)
        return index

    def al_query(self, iteration, budget, strategy, acc_idxs, rej_idxs):
        """get the index of new selection from different strategies"""
        CONTENT_PATH = self.strategy.data_provider.content_path
        NUM_QUERY = budget
        NET = self.strategy.config["TRAINING"]["NET"]
        DATA_NAME = self.strategy.config["DATASET"]
        TOTAL_EPOCH = self.strategy.config["TRAINING"]["total_epoch"]
        sys.path.append(CONTENT_PATH)

        # record output information
        # now = time.strftime("%Y-%m-%d-%H_%M_%S", time.localtime(time.time())) 
        # sys.stdout = open(os.path.join(CONTENT_PATH, now+".txt"), "w")

        # loading neural network
        import Model.model as subject_model
        task_model = eval("subject_model.{}()".format(NET))
        # start experiment
        n_pool = self.strategy.config["TRAINING"]["train_num"]  # 50000
        n_test = self.strategy.config["TRAINING"]['test_num']   # 10000

        resume_path = self.strategy.data_provider.checkpoint_path(iteration)

        idxs_lb = np.array(json.load(open(os.path.join(resume_path, "index.json"), "r")))
        
        state_dict = torch.load(os.path.join(resume_path, "subject_model.pth"), map_location=torch.device('cpu'))
        task_model.load_state_dict(state_dict)
        NUM_INIT_LB = len(idxs_lb)

        print('resume from iteration {}'.format(iteration))
        print('number of labeled pool: {}'.format(NUM_INIT_LB))
        print('number of unlabeled pool: {}'.format(n_pool - NUM_INIT_LB))
        print('number of testing pool: {}'.format(n_test))

        if strategy == "Random":
            print(DATA_NAME)
            print(strategy)
            print('================Round {:d}==============='.format(iteration+1))
            # query new samples
            t0 = time.time()
            # TODO implement active learning
            new_indices, scores = random_sampling(n_pool, idxs_lb, acc_idxs, rej_idxs, NUM_QUERY)
            t1 = time.time()
            print("Query time is {:.2f}".format(t1-t0))
        
        elif strategy == "Uncertainty":
            print(DATA_NAME)
            print(strategy)
            print('================Round {:d}==============='.format(iteration+1))
            samples = self.strategy.data_provider.train_representation(iteration)
            pred = self.strategy.data_provider.get_pred(iteration, samples)
            confidence = np.amax(softmax(pred, axis=1), axis=1)
            uncertainty = 1-confidence
            # query new samples
            t0 = time.time()
            new_indices, scores = uncerainty_sampling(n_pool, idxs_lb, acc_idxs, rej_idxs, NUM_QUERY, uncertainty=uncertainty)
            t1 = time.time()
            print("Query time is {:.2f}".format(t1-t0))
        
        elif strategy == "TBSampling":
            period = int(2/3*TOTAL_EPOCH)
            print(DATA_NAME)
            print("TBSampling")
            print('================Round {:d}==============='.format(iteration+1))
            t0 = time.time()
            new_indices, scores = self._suggest_abnormal(strategy, iteration, idxs_lb, acc_idxs, rej_idxs, budget, period)
            t1 = time.time()
            print("Query time is {:.2f}".format(t1-t0))
        
        elif strategy == "Feedback":
            period = int(2/3*TOTAL_EPOCH)
            print(DATA_NAME)
            print("Feedback")
            print('================Round {:d}==============='.format(iteration+1))
            t0 = time.time()
            new_indices, scores = self._suggest_abnormal(strategy, iteration, idxs_lb, acc_idxs, rej_idxs, budget, period)
            t1 = time.time()
            print("Query time is {:.2f}".format(t1-t0))
        else:
            raise NotImplementedError
            
        true_labels = self.train_labels(iteration)

        return new_indices, true_labels[new_indices], scores
    
    def al_train(self, iteration, indices):
        # TODO fix
        raise NotImplementedError
        # # customize ....
        # CONTENT_PATH = self.strategy.data_provider.content_path
        # # record output information
        # now = time.strftime("%Y-%m-%d-%H_%M_%S", time.localtime(time.time())) 
        # sys.stdout = open(os.path.join(CONTENT_PATH, now+".txt"), "w")

        # # for reproduce purpose
        # print("New indices:\t{}".format(len(indices)))
        # self.save_human_selection(iteration, indices)
        # lb_idx = self.get_epoch_index(iteration)
        # train_idx = np.hstack((lb_idx, indices))
        # print("Training indices:\t{}".format(len(train_idx)))
        # print("Valid indices:\t{}".format(len(set(train_idx))))

        # TOTAL_EPOCH = self.strategy.config["TRAINING"]["total_epoch"]
        # NET = self.strategy.config["TRAINING"]["NET"]
        # DEVICE = self.strategy.data_provider.DEVICE
        # NEW_ITERATION = self.get_max_iter() + 1
        # GPU = self.strategy.config["GPU"]
        # DATA_NAME = self.strategy.config["DATASET"]
        # sys.path.append(CONTENT_PATH)

        # # loading neural network
        # from Model.model import resnet18
        # task_model = resnet18()
        # resume_path = self.strategy.data_provider.checkpoint_path(iteration)
        # state_dict = torch.load(os.path.join(resume_path, "subject_model.pth"), map_location=torch.device("cpu"))
        # task_model.load_state_dict(state_dict)

        # self.save_iteration_index(NEW_ITERATION, train_idx)
        # task_model_type = "pytorch"
        # # start experiment
        # n_pool = self.strategy.config["TRAINING"]["train_num"]  # 50000
        # save_path = self.strategy.data_provider.checkpoint_path(NEW_ITERATION)
        # os.makedirs(save_path, exist_ok=True)

        # from query_strategies.random import RandomSampling
        # q_strategy = RandomSampling(task_model, task_model_type, n_pool, lb_idx, 10, DATA_NAME, NET, gpu=GPU, **self.hyperparameters["TRAINING"])
        # # print information
        # print('================Round {:d}==============='.format(NEW_ITERATION))
        # # update
        # q_strategy.update_lb_idxs(train_idx)
        # resnet_model = resnet18()
        # train_dataset = torchvision.datasets.CIFAR10(root="..//data//CIFAR10", download=True, train=True, transform=self.hyperparameters["TRAINING"]['transform_tr'])
        # test_dataset = torchvision.datasets.CIFAR10(root="..//data//CIFAR10", download=True, train=False, transform=self.hyperparameters["TRAINING"]['transform_te'])
        # t1 = time.time()
        # q_strategy.train(total_epoch=TOTAL_EPOCH, task_model=resnet_model, complete_dataset=train_dataset,save_path=None)
        # t2 = time.time()
        # print("Training time is {:.2f}".format(t2-t1))
        # self.save_subject_model(NEW_ITERATION, q_strategy.task_model.state_dict())

        # # compute accuracy at each round
        # accu = q_strategy.test_accu(test_dataset)
        # print('Accuracy {:.3f}'.format(100*accu))
    
    
    def get_max_iter(self):
        path  = os.path.join(self.strategy.data_provider.content_path, "Model")
        dir_list = os.listdir(path)
        iteration_name = self.strategy.data_provider.iteration_name
        max_iter = -1
        for dir in dir_list:
            if "{}_".format(iteration_name) in dir:
                i = int(dir.replace("{}_".format(iteration_name),""))
                max_iter = max(max_iter, i)
        return max_iter

    def save_human_selection(self, iteration, indices):
        """
        save the selected index message from DVI frontend
        :param epoch_id:
        :param indices: list, selected indices
        :return:
        """
        save_location = os.path.join(self.strategy.data_provider.checkpoint_path(iteration), "human_select.json")
        with open(save_location, "w") as f:
            json.dump(indices, f)
    
    def save_iteration_index(self, iteration, idxs):
        new_iteration_dir = self.strategy.data_provider.checkpoint_path(iteration)
        os.makedirs(new_iteration_dir, exist_ok=True)
        save_location = os.path.join(new_iteration_dir, "index.json")
        with open(save_location, "w") as f:
            json.dump(idxs.tolist(), f)
    
    def save_subject_model(self, iteration, state_dict):
        new_iteration_dir = self.strategy.data_provider.checkpoint_path(iteration)
        model_path = os.path.join(new_iteration_dir, "subject_model.pth")
        torch.save(state_dict, model_path)

    
    def vis_train(self, iteration, resume_iter):
        self.strategy.visualize_embedding(iteration, resume_iter)
    
    #################################################################################################################
    #                                                                                                               #
    #                                            Sample Selection                                                  #
    #                                                                                                               #
    #################################################################################################################
    def _save(self, iteration, ftm):
        with open(os.path.join(self.strategy.data_provider.checkpoint_path(iteration), '{}_sample_recommender.pkl'.format(self.strategy.VIS_METHOD)), 'wb') as f:
            pickle.dump(ftm, f, pickle.HIGHEST_PROTOCOL)

    def _init_detection(self, iteration, lb_idxs, period=80):
        # must be in the dense setting
        assert "Dense" in self.strategy.VIS_METHOD
        
        # prepare high dimensional trajectory
        embedding_path = os.path.join(self.strategy.data_provider.checkpoint_path(iteration),'trajectory_embeddings.npy')
        if os.path.exists(embedding_path):
            trajectories = np.load(embedding_path)
            print("Load trajectories from cache!")
        else:
            # extract samples
            TOTAL_EPOCH = self.strategy.config["TRAINING"]["total_epoch"]
            EPOCH_START = self.strategy.config["TRAINING"]["epoch_start"]
            EPOCH_END = self.strategy.config["TRAINING"]["epoch_end"]
            EPOCH_PERIOD = self.strategy.config["TRAINING"]["epoch_period"]
            train_num = len(self.train_labels(None))
            # change epoch_NUM
            embeddings_2d = np.zeros((TOTAL_EPOCH, train_num, 2))
            for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
                id = (i - EPOCH_START)//EPOCH_PERIOD
                embeddings_2d[id] = self.strategy.projector.batch_project(iteration, i, self.strategy.data_provider.train_representation_all(iteration, i))
            trajectories = np.transpose(embeddings_2d, [1,0,2])
            np.save(embedding_path, trajectories)
        # prepare uncertainty
        uncertainty_path = os.path.join(self.strategy.data_provider.checkpoint_path(iteration), 'uncertainties.npy')
        if os.path.exists(uncertainty_path):
            uncertainty = np.load(uncertainty_path)
        else:
            TOTAL_EPOCH = self.strategy.config["TRAINING"]["total_epoch"]
            EPOCH_START = self.strategy.config["TRAINING"]["epoch_start"]
            EPOCH_END = self.strategy.config["TRAINING"]["epoch_end"]
            EPOCH_PERIOD = self.strategy.config["TRAINING"]["epoch_period"]
            train_num = len(self.train_labels(None))

            samples = self.strategy.data_provider.train_representation_all(iteration, EPOCH_END)
            pred = self.strategy.data_provider.get_pred(iteration, EPOCH_END, samples)
            uncertainty = 1 - np.amax(softmax(pred, axis=1), axis=1)
            np.save(uncertainty_path, uncertainty)
        ulb_idxs = self.strategy.data_provider.get_unlabeled_idx(len(uncertainty), lb_idxs)
        # prepare sampling manager
        ntd_path = os.path.join(self.strategy.data_provider.checkpoint_path(iteration), '{}_sample_recommender.pkl'.format(self.strategy.VIS_METHOD))
        if os.path.exists(ntd_path):
            with open(ntd_path, 'rb') as f:
                ntd = pickle.load(f)
        else:
            ntd = Recommender(uncertainty[ulb_idxs], trajectories[ulb_idxs], 30, period=period)
            print("Detecting abnormal....")
            ntd.clustered()
            print("Finish detection!")
            self._save(iteration, ntd)
        return ntd, ulb_idxs
        
    def _suggest_abnormal(self, strategy, iteration, lb_idxs, acc_idxs, rej_idxs, budget, period):
        ntd,ulb_idxs = self._init_detection(iteration, lb_idxs, period)
        map_ulb = ulb_idxs.tolist()
        map_acc_idxs = np.array([map_ulb.index(i) for i in acc_idxs]).astype(np.int32)
        map_rej_idxs = np.array([map_ulb.index(i) for i in rej_idxs]).astype(np.int32)
        if strategy == "TBSampling":
            suggest_idxs, scores = ntd.sample_batch_init(map_acc_idxs, map_rej_idxs, budget)
        elif strategy == "Feedback":
            suggest_idxs, scores = ntd.sample_batch(map_acc_idxs, map_rej_idxs, budget)
        else:
            raise NotImplementedError
        return ulb_idxs[suggest_idxs], scores
    
    def _suggest_normal(self, strategy, iteration, lb_idxs, acc_idxs, rej_idxs, budget, period):
        ntd, ulb_idxs = self._init_detection(iteration, lb_idxs, period)
        map_ulb = ulb_idxs.tolist()
        map_acc_idxs = np.array([map_ulb.index(i) for i in acc_idxs]).astype(np.int32)
        map_rej_idxs = np.array([map_ulb.index(i) for i in rej_idxs]).astype(np.int32)
        if strategy == "TBSampling":
            suggest_idxs, _ = ntd.sample_batch_normal_init(map_acc_idxs, map_rej_idxs, budget)
        elif strategy == "Feedback":
            suggest_idxs, _ = ntd.sample_batch_normal(map_acc_idxs, map_rej_idxs, budget)
        else:
            raise NotImplementedError
        return ulb_idxs[suggest_idxs]


class AnormalyContext(VisContext):

    def __init__(self, strategy) -> None:
        super().__init__(strategy)
        EPOCH_START = self.strategy.config["EPOCH_START"]
        EPOCH_END = self.strategy.config["EPOCH_END"]
        EPOCH_PERIOD = self.strategy.config["EPOCH_PERIOD"]
        self.period = int(2/3*((EPOCH_END-EPOCH_START)/EPOCH_PERIOD+1))
        file_path = os.path.join(self.strategy.data_provider.content_path, 'clean_label.json')
        with open(file_path, "r") as f:
            self.clean_labels = np.array(json.load(f))
    
    def reset(self):
        return

    #################################################################################################################
    #                                                                                                               #
    #                                            Anormaly Detection                                                 #
    #                                                                                                               #
    #################################################################################################################

    def _save(self, ntd):
        with open(os.path.join(self.strategy.data_provider.content_path, '{}_sample_recommender.pkl'.format(self.strategy.VIS_METHOD)), 'wb') as f:
            pickle.dump(ntd, f, pickle.HIGHEST_PROTOCOL)

    def _init_detection(self):
        # prepare trajectories
        embedding_path = os.path.join(self.strategy.data_provider.content_path, 'trajectory_embeddings.npy')
        if os.path.exists(embedding_path):
            trajectories = np.load(embedding_path)
        else:
            # extract samples
            train_num = self.strategy.data_provider.train_num
            # change epoch_NUM
            epoch_num = (self.strategy.data_provider.e - self.strategy.data_provider.s)//self.strategy.data_provider.p + 1
            embeddings_2d = np.zeros((epoch_num, train_num, 2))
            for i in range(self.strategy.data_provider.s, self.strategy.data_provider.e+1, self.strategy.data_provider.p):
                id = (i - self.strategy.data_provider.s)//self.strategy.data_provider.p
                embeddings_2d[id] = self.strategy.projector.batch_project(i, self.strategy.data_provider.train_representation(i))
            trajectories = np.transpose(embeddings_2d, [1,0,2])
            np.save(embedding_path, trajectories)
        # prepare uncertainty scores
        uncertainty_path = os.path.join(self.strategy.data_provider.content_path, 'uncertainties.npy')
        if os.path.exists(uncertainty_path):
            uncertainty = np.load(uncertainty_path)
        else:
            epoch_num = (self.strategy.data_provider.e - self.strategy.data_provider.s)//self.strategy.data_provider.p + 1
            samples = self.strategy.data_provider.train_representation(epoch_num)
            pred = self.strategy.data_provider.get_pred(epoch_num, samples)
            uncertainty = 1 - np.amax(softmax(pred, axis=1), axis=1)
            np.save(uncertainty_path, uncertainty)
        
        # prepare sampling manager
        ntd_path = os.path.join(self.strategy.data_provider.content_path, '{}_sample_recommender.pkl'.format(self.strategy.VIS_METHOD))
        if os.path.exists(ntd_path):
            with open(ntd_path, 'rb') as f:
                ntd = pickle.load(f)
        else:
            ntd = Recommender(uncertainty, trajectories, 30, self.period)
            print("Detecting abnormal....")
            ntd.clustered()
            print("Finish detection!")
            self._save(ntd)
        return ntd
        
    def suggest_abnormal(self, strategy, acc_idxs, rej_idxs, budget):
        ntd = self._init_detection()
        if strategy == "TBSampling":
            suggest_idxs, scores = ntd.sample_batch_init(acc_idxs, rej_idxs, budget)
        elif strategy == "Feedback":
            suggest_idxs, scores = ntd.sample_batch(acc_idxs, rej_idxs, budget)
        else:
            raise NotImplementedError
        suggest_labels = self.clean_labels[suggest_idxs]
        return suggest_idxs, scores, suggest_labels
    
    def suggest_normal(self, strategy, acc_idxs, rej_idxs, budget):
        ntd = self._init_detection()
        if strategy == "TBSampling":
            suggest_idxs, _ = ntd.sample_batch_normal_init(acc_idxs, rej_idxs, budget)
        elif strategy == "Feedback":
            suggest_idxs, _ = ntd.sample_batch_normal(acc_idxs, rej_idxs, budget)
        else:
            raise NotImplementedError
        suggest_labels = self.clean_labels[suggest_idxs]
        return suggest_idxs, suggest_labels
        
        