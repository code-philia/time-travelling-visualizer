'''This class serves as a intermediate layer for tensorboard frontend and timeVis backend'''
import os
import sys
import json
import time
import torch
import numpy as np
import pickle
import shutil

import torch.nn
from torch.utils.data import DataLoader
from torch.utils.data import WeightedRandomSampler
import torchvision

from scipy.special import softmax

# timevis_path = "D:\\code-space\\DLVisDebugger" #limy 
timevis_path = "../../DLVisDebugger" #xianglin#yvonne
sys.path.append(timevis_path)
from singleVis.utils import *
from singleVis.custom_weighted_random_sampler import CustomWeightedRandomSampler
from singleVis.edge_dataset import DataHandler
from singleVis.spatial_edge_constructor import SingleEpochSpatialEdgeConstructor
from singleVis.trajectory_manager import Recommender

# active_learning_path = "D:\\code-space\\ActiveLearning"  # limy 
active_learning_path = "../../ActiveLearning"
sys.path.append(active_learning_path)

class TimeVisBackend:
    def __init__(self, data_provider, projector, vis, evaluator, **hyperparameters) -> None:
        self.data_provider = data_provider
        self.projector = projector
        self.vis = vis
        self.evaluator = evaluator
        self.hyperparameters = hyperparameters
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
        embedding = self.projector.batch_project(epoch, data)
        recon = self.projector.batch_inverse(epoch, embedding)
    
        ori_pred = self.data_provider.get_pred(epoch, data)
        new_pred = self.data_provider.get_pred(epoch, recon)
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
            index = self.data_provider.classes.index(label)
        except:
            index = -1
        train_labels = self.data_provider.train_labels(epoch_id)
        test_labels = self.data_provider.test_labels(epoch_id)
        labels = np.concatenate((train_labels, test_labels), 0)
        idxs = np.argwhere(labels == index)
        idxs = np.squeeze(idxs)
        return idxs

    def filter_type(self, type, epoch_id):
        if type == "train":
            res = self.get_epoch_index(epoch_id)
        elif type == "test":
            train_num = self.data_provider.train_num
            test_num = self.data_provider.test_num
            res = list(range(train_num, test_num, 1))
        elif type == "unlabel":
            labeled = np.array(self.get_epoch_index(epoch_id))
            train_num = self.data_provider.train_num
            all_data = np.arange(train_num)
            unlabeled = np.setdiff1d(all_data, labeled)
            res = unlabeled.tolist()
        else:
            # all data
            train_num = self.data_provider.train_num
            test_num = self.data_provider.test_num
            res = list(range(0, train_num + test_num, 1))
        return res


    #################################################################################################################
    #                                                                                                               #
    #                                             Helper Functions                                                  #
    #                                                                                                               #
    #################################################################################################################

    def save_acc_and_rej(self, acc_idxs, rej_idxs):
        d = {
            "acc_idxs": acc_idxs,
            "rej_idxs": rej_idxs
        }
        path = os.path.join(self.data_provider.content_path, "acc_rej.json")
        with open(path, "w") as f:
            json.dump(d, f)
        print("Successfully save the acc and rej idxs selected by user...")

    def get_epoch_index(self, epoch_id):
        """get the training data index for an epoch"""
        index_file = os.path.join(self.data_provider.model_path, "Epoch_{:d}".format(epoch_id), "index.json")
        index = load_labelled_data_index(index_file)
        return index
    
    def reset(self):
        return


class ActiveLearningTimeVisBackend(TimeVisBackend):
    def __init__(self, data_provider, projector, trainer, vis, evaluator, dense, **hyperparameters) -> None:
        super().__init__(data_provider, projector, vis, evaluator, **hyperparameters)
        self.trainer = trainer
        self.dense = dense
    
    def save_acc_and_rej(self, iteration, acc_idxs, rej_idxs):
        d = {
            "acc_idxs": acc_idxs,
            "rej_idxs": rej_idxs
        }
        path = os.path.join(self.data_provider.content_path, "Model", "Iteration_{}".format(iteration), "acc_rej.json")
        with open(path, "w") as f:
            json.dump(d, f)
        print("Successfully save the acc and rej idxs selected by user at Iteration {}...".format(iteration))
    
    def reset(self, iteration):
        # delete [iteration,...)
        max_i = self.get_max_iter()
        for i in range(iteration, max_i+1, 1):
            path = os.path.join(self.data_provider.content_path, "Model", "Iteration_{}".format(i))
            shutil.rmtree(path)
        iter_structure_path = os.path.join(self.data_provider.content_path, "iteration_structure.json")
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
        index_file = os.path.join(self.data_provider.model_path, "Iteration_{:d}".format(iteration), "index.json")
        index = load_labelled_data_index(index_file)
        return index

    def al_query(self, iteration, budget, strategy, acc_idxs, rej_idxs):
        """get the index of new selection from different strategies"""
        CONTENT_PATH = self.data_provider.content_path
        NUM_QUERY = budget
        GPU = self.hyperparameters["GPU"]
        NET = self.hyperparameters["TRAINING"]["NET"]
        DATA_NAME = self.hyperparameters["DATASET"]
        sys.path.append(CONTENT_PATH)

        # record output information
        now = time.strftime("%Y-%m-%d-%H_%M_%S", time.localtime(time.time())) 
        sys.stdout = open(os.path.join(CONTENT_PATH, now+".txt"), "w")

        # loading neural network
        import Model.model as subject_model
        task_model = eval("subject_model.{}()".format(NET))
        task_model_type = "pytorch"
        # start experiment
        n_pool = self.hyperparameters["TRAINING"]["train_num"]  # 50000
        n_test = self.hyperparameters["TRAINING"]['test_num']   # 10000

        resume_path = os.path.join(CONTENT_PATH, "Model", "Iteration_{}".format(iteration))

        idxs_lb = np.array(json.load(open(os.path.join(resume_path, "index.json"), "r")))
        
        state_dict = torch.load(os.path.join(resume_path, "subject_model.pth"), map_location=torch.device('cpu'))
        task_model.load_state_dict(state_dict)
        NUM_INIT_LB = len(idxs_lb)

        print('resume from iteration {}'.format(iteration))
        print('number of labeled pool: {}'.format(NUM_INIT_LB))
        print('number of unlabeled pool: {}'.format(n_pool - NUM_INIT_LB))
        print('number of testing pool: {}'.format(n_test))

        # here the training handlers and testing handlers are different
        complete_dataset = torchvision.datasets.CIFAR10(root="..//data//CIFAR10", download=True, train=True, transform=self.hyperparameters["TRAINING"]['transform_te'])

        if strategy == "Random":
            from query_strategies.random import RandomSampling
            idxs_selected = np.concatenate((acc_idxs.astype(np.int64), rej_idxs.astype(np.int64)), axis=0)
            curr_lb = np.concatenate((idxs_lb, idxs_selected), axis=0)
            q_strategy = RandomSampling(task_model, task_model_type, n_pool, curr_lb, 10, DATA_NAME, NET, gpu=GPU, **self.hyperparameters["TRAINING"])
            # print information
            print(DATA_NAME)
            print(type(q_strategy).__name__)
            print('================Round {:d}==============='.format(iteration+1))
            # query new samples
            t0 = time.time()
            new_indices, scores = q_strategy.query(NUM_QUERY)
            t1 = time.time()
            print("Query time is {:.2f}".format(t1-t0))
        elif strategy == "Uncertainty":
            from query_strategies.LeastConfidence import LeastConfidenceSampling
            idxs_selected = np.concatenate((acc_idxs.astype(np.int64), rej_idxs.astype(np.int64)), axis=0)
            curr_lb = np.concatenate((idxs_lb, idxs_selected), axis=0)
            q_strategy = LeastConfidenceSampling(task_model, task_model_type, n_pool, curr_lb, 10, DATA_NAME, NET, gpu=GPU, **self.hyperparameters["TRAINING"])
            # print information
            print(DATA_NAME)
            print(type(q_strategy).__name__)
            print('================Round {:d}==============='.format(iteration+1))
            # query new samples
            t0 = time.time()
            new_indices, scores = q_strategy.query(complete_dataset, NUM_QUERY, idxs_selected)
            t1 = time.time()
            print("Query time is {:.2f}".format(t1-t0))
        # elif strategy == "Diversity":
        #     from query_strategies.coreset import CoreSetSampling
        #     q_strategy = CoreSetSampling(task_model, task_model_type, n_pool, 512, idxs_lb, DATA_NAME, NET, gpu=GPU, **self.hyperparameters["TRAINING"])
        #     # print information
        #     print(DATA_NAME)
        #     print(type(q_strategy).__name__)
        #     print('================Round {:d}==============='.format(iteration+1))
        #     embedding = q_strategy.get_embedding(complete_dataset)
        #     # query new samples
        #     t0 = time.time()
        #     new_indices, scores = q_strategy.query(embedding, NUM_QUERY)
        #     t1 = time.time()
        #     print("Query time is {:.2f}".format(t1-t0))
        
        # elif strategy == "Hybrid":
        #     from query_strategies.badge import BadgeSampling
        #     q_strategy = BadgeSampling(task_model, task_model_type, n_pool, 512, idxs_lb, 10, DATA_NAME, NET, gpu=GPU, **self.hyperparameters["TRAINING"])
        #     # print information
        #     print(DATA_NAME)
        #     print(type(q_strategy).__name__)
        #     print('================Round {:d}==============='.format(iteration+1))
        #     # query new samples
        #     t0 = time.time()
        #     new_indices, scores = q_strategy.query(complete_dataset, NUM_QUERY)
        #     t1 = time.time()
        #     print("Query time is {:.2f}".format(t1-t0))
        elif strategy == "TBSampling":
            # TODO hard coded parameters...
            period = 80
            print(DATA_NAME)
            print("TBSampling")
            print('================Round {:d}==============='.format(iteration+1))
            t0 = time.time()
            new_indices, scores = self._suggest_abnormal(strategy, iteration, acc_idxs, rej_idxs, budget, period)
            t1 = time.time()
            print("Query time is {:.2f}".format(t1-t0))
        
        elif strategy == "Feedback":
            # TODO hard coded parameters...suggest_abnormal
            period = 80
            print(DATA_NAME)
            print("Feedback")
            print('================Round {:d}==============='.format(iteration+1))
            t0 = time.time()
            new_indices, scores = self._suggest_abnormal(strategy, iteration, acc_idxs, rej_idxs, budget, period)
            t1 = time.time()
            print("Query time is {:.2f}".format(t1-t0))
        else:
            raise NotImplementedError
            
        # TODO return the suggest labels, need to develop pesudo label generation technique in the future
        true_labels = self.data_provider.train_labels(iteration)

        return new_indices, true_labels[new_indices], scores
    
    def al_train(self, iteration, indices):
        CONTENT_PATH = self.data_provider.content_path
        # record output information
        now = time.strftime("%Y-%m-%d-%H_%M_%S", time.localtime(time.time())) 
        sys.stdout = open(os.path.join(CONTENT_PATH, now+".txt"), "w")

        # for reproduce purpose
        print("New indices:\t{}".format(len(indices)))
        self.save_human_selection(iteration, indices)
        lb_idx = self.get_epoch_index(iteration)
        train_idx = np.hstack((lb_idx, indices))
        print("Training indices:\t{}".format(len(train_idx)))
        print("Valid indices:\t{}".format(len(set(train_idx))))

        TOTAL_EPOCH = self.hyperparameters["TRAINING"]["total_epoch"]
        NET = self.hyperparameters["TRAINING"]["NET"]
        DEVICE = self.data_provider.DEVICE
        NEW_ITERATION = self.get_max_iter() + 1
        GPU = self.hyperparameters["GPU"]
        DATA_NAME = self.hyperparameters["DATASET"]
        sys.path.append(CONTENT_PATH)

        # loading neural network
        from Model.model import resnet18
        task_model = resnet18()
        resume_path = os.path.join(CONTENT_PATH, "Model", "Iteration_{}".format(iteration))
        state_dict = torch.load(os.path.join(resume_path, "subject_model.pth"), map_location=torch.device("cpu"))
        task_model.load_state_dict(state_dict)

        self.save_iteration_index(NEW_ITERATION, train_idx)
        task_model_type = "pytorch"
        # start experiment
        n_pool = self.hyperparameters["TRAINING"]["train_num"]  # 50000
        save_path = os.path.join(CONTENT_PATH, "Model", "Iteration_{}".format(NEW_ITERATION))
        os.makedirs(save_path, exist_ok=True)

        from query_strategies.random import RandomSampling
        q_strategy = RandomSampling(task_model, task_model_type, n_pool, lb_idx, 10, DATA_NAME, NET, gpu=GPU, **self.hyperparameters["TRAINING"])
        # print information
        print('================Round {:d}==============='.format(NEW_ITERATION))
        # update
        q_strategy.update_lb_idxs(train_idx)
        resnet_model = resnet18()
        train_dataset = torchvision.datasets.CIFAR10(root="..//data//CIFAR10", download=True, train=True, transform=self.hyperparameters["TRAINING"]['transform_tr'])
        test_dataset = torchvision.datasets.CIFAR10(root="..//data//CIFAR10", download=True, train=False, transform=self.hyperparameters["TRAINING"]['transform_te'])
        t1 = time.time()
        q_strategy.train(total_epoch=TOTAL_EPOCH, task_model=resnet_model, complete_dataset=train_dataset,save_path=save_path)
        t2 = time.time()
        print("Training time is {:.2f}".format(t2-t1))
        self.save_subject_model(NEW_ITERATION, q_strategy.task_model.state_dict())

        # compute accuracy at each round
        accu = q_strategy.test_accu(test_dataset)
        print('Accuracy {:.3f}'.format(100*accu))
    
    
    def get_max_iter(self):
        path  = os.path.join(self.data_provider.content_path, "Model")
        dir_list = os.listdir(path)
        max_iter = -1
        for dir in dir_list:
            if "Iteration_" in dir:
                i = int(dir.replace("Iteration_",""))
                max_iter = max(max_iter, i)
        return max_iter

    def save_human_selection(self, iteration, indices):
        """
        save the selected index message from DVI frontend
        :param epoch_id:
        :param indices: list, selected indices
        :return:
        """
        save_location = os.path.join(self.data_provider.model_path, "Iteration_{}".format(iteration), "human_select.json")
        with open(save_location, "w") as f:
            json.dump(indices, f)
    
    def save_iteration_index(self, iteration, idxs):
        new_iteration_dir = os.path.join(self.data_provider.content_path, "Model", "Iteration_{}".format(iteration))
        os.makedirs(new_iteration_dir, exist_ok=True)
        save_location = os.path.join(new_iteration_dir, "index.json")
        with open(save_location, "w") as f:
            json.dump(idxs.tolist(), f)
    
    def save_subject_model(self, iteration, state_dict):
        new_iteration_dir = os.path.join(self.data_provider.content_path, "Model", "Iteration_{}".format(iteration))
        model_path = os.path.join(new_iteration_dir, "subject_model.pth")
        torch.save(state_dict, model_path)

    
    def vis_train(self, iteration, **config):
        # preprocess
        PREPROCESS = config["VISUALIZATION"]["PREPROCESS"]
        B_N_EPOCHS = config["VISUALIZATION"]["BOUNDARY"]["B_N_EPOCHS"]
        L_BOUND = config["VISUALIZATION"]["BOUNDARY"]["L_BOUND"]
        if PREPROCESS:
            self.data_provider._meta_data(iteration)
            if B_N_EPOCHS != 0:
                LEN = len(self.data_provider.train_labels(iteration))
                self.data_provider._estimate_boundary(iteration, LEN//10, l_bound=L_BOUND)

        # train visualization model
        CLASSES = config["CLASSES"]
        DATASET = config["DATASET"]
        # DEVICE = torch.device("cuda:{:}".format(GPU_ID) if torch.cuda.is_available() else "cpu")
        #################################################   VISUALIZATION PARAMETERS    ########################################
        PREPROCESS = config["VISUALIZATION"]["PREPROCESS"]
        B_N_EPOCHS = config["VISUALIZATION"]["BOUNDARY"]["B_N_EPOCHS"]
        L_BOUND = config["VISUALIZATION"]["BOUNDARY"]["L_BOUND"]
        LAMBDA = config["VISUALIZATION"]["LAMBDA"]
        HIDDEN_LAYER = config["VISUALIZATION"]["HIDDEN_LAYER"]
        N_NEIGHBORS = config["VISUALIZATION"]["N_NEIGHBORS"]
        MAX_EPOCH = config["VISUALIZATION"]["MAX_EPOCH"]
        S_N_EPOCHS = config["VISUALIZATION"]["S_N_EPOCHS"]
        PATIENT = config["VISUALIZATION"]["PATIENT"]
        VIS_MODEL_NAME = config["VISUALIZATION"]["VIS_MODEL_NAME"]
        RESOLUTION = config["VISUALIZATION"]["RESOLUTION"]
        EVALUATION_NAME = config["VISUALIZATION"]["EVALUATION_NAME"]
        NET = config["TRAINING"]["NET"]

        if self.dense:
            raise NotImplementedError
        else:
            t0 = time.time()
            spatial_cons = SingleEpochSpatialEdgeConstructor(self.data_provider, iteration, S_N_EPOCHS, B_N_EPOCHS, 15)
            edge_to, edge_from, probs, feature_vectors, attention = spatial_cons.construct()
            t1 = time.time()

            probs = probs / (probs.max()+1e-3)
            eliminate_zeros = probs>1e-3
            edge_to = edge_to[eliminate_zeros]
            edge_from = edge_from[eliminate_zeros]
            probs = probs[eliminate_zeros]

            # save result
            save_dir = os.path.join(self.data_provider.model_path, "SV_time_al.json")
            if not os.path.exists(save_dir):
                evaluation = dict()
            else:
                f = open(save_dir, "r")
                evaluation = json.load(f)
                f.close()
            if "complex_construction" not in evaluation.keys():
                evaluation["complex_construction"] = dict()
            evaluation["complex_construction"][str(iteration)] = round(t1-t0, 3)
            with open(save_dir, 'w') as f:
                json.dump(evaluation, f)
            print("constructing timeVis complex in {:.1f} seconds.".format(t1-t0))

            dataset = DataHandler(edge_to, edge_from, feature_vectors, attention)
            n_samples = int(np.sum(S_N_EPOCHS * probs) // 1)
            # chosse sampler based on the number of dataset
            if len(edge_to) > 2^24:
                sampler = CustomWeightedRandomSampler(probs, n_samples, replacement=True)
            else:
                sampler = WeightedRandomSampler(probs, n_samples, replacement=True)
            edge_loader = DataLoader(dataset, batch_size=512, sampler=sampler)
            self.trainer.update_edge_loader(edge_loader)

            t2=time.time()
            self.trainer.train(PATIENT, MAX_EPOCH)
            t3 = time.time()
            # save result
            save_dir = os.path.join(self.data_provider.model_path, "SV_time_al.json")
            if not os.path.exists(save_dir):
                evaluation = dict()
            else:
                f = open(save_dir, "r")
                evaluation = json.load(f)
                f.close()
            if  "training" not in evaluation.keys():
                evaluation["training"] = dict()
            evaluation["training"][str(iteration)] = round(t3-t2, 3)
            with open(save_dir, 'w') as f:
                json.dump(evaluation, f)
            save_dir = os.path.join(self.data_provider.model_path, "Iteration_{}".format(iteration))
            os.makedirs(save_dir, exist_ok=True)
            self.trainer.save(save_dir=save_dir, file_name="al")
            # TODO evaluate visualization model, train and test
    
    #################################################################################################################
    #                                                                                                               #
    #                                            Sample Selection                                                  #
    #                                                                                                               #
    #################################################################################################################
    def _save(self, iteration, ftm):
        with open(os.path.join(self.data_provider.content_path, "Model","Iteration_{}".format(iteration), 'sample_recommender.pkl'), 'wb') as f:
            pickle.dump(ftm, f, pickle.HIGHEST_PROTOCOL)

    def _init_detection(self, iteration, period=80):
        # prepare trajectory
        embedding_path = os.path.join(self.data_provider.content_path,"Model", "Iteration_{}".format(iteration),'trajectory_embeddings.npy')
        if os.path.exists(embedding_path):
            trajectories = np.load(embedding_path)
            print("Load trajectories from cache!")
        else:
            # extract samples
            train_num = self.data_provider.train_num
            # change epoch_NUM
            epoch_num = (self.data_provider.e - self.data_provider.s)//self.data_provider.p + 1
            embeddings_2d = np.zeros((epoch_num, train_num, 2))
            for i in range(self.data_provider.s, self.data_provider.e+1, self.data_provider.p):
            # for i in range(self.data_provider.e - self.data_provider.p*(self.period-1), self.data_provider.e+1, self.data_provider.p):
                # id = (i-(self.data_provider.e - (self.data_provider.p-1)*self.period))//self.data_provider.p
                id = (i - self.data_provider.s)//self.data_provider.p
                embeddings_2d[id] = self.projector.batch_project(iteration, i, self.data_provider.train_representation(iteration, i))
            trajectories = np.transpose(embeddings_2d, [1,0,2])
            np.save(embedding_path, trajectories)
        # prepare uncertainty
        uncertainty_path = os.path.join(self.data_provider.content_path, "Model","Iteration_{}".format(iteration), 'uncertainties.npy')
        if os.path.exists(uncertainty_path):
            uncertainty = np.load(uncertainty_path)
        else:
            samples = self.data_provider.train_representation(iteration, epoch_num)
            pred = self.data_provider.get_pred(iteration, epoch_num, samples)
            uncertainty = 1 - np.amax(softmax(pred, axis=1), axis=1)
            np.save(uncertainty_path, uncertainty)
        
        # prepare sampling manager
        ntd_path = os.path.join(self.data_provider.content_path, "Model","Iteration_{}".format(iteration), 'sample_recommender.pkl')
        if os.path.exists(ntd_path):
            with open(ntd_path, 'rb') as f:
                ntd = pickle.load(f)
        else:
            ntd = Recommender(uncertainty, trajectories, 30, period=period,metric="a")
            print("Detecting abnormal....")
            ntd.clustered()
            print("Finish detection!")
            self._save(iteration, ntd)
        return ntd
        
    def _suggest_abnormal(self, strategy, iteration, acc_idxs, rej_idxs, budget, period):
        ntd = self._init_detection(iteration, period)
        if strategy == "TBSampling":
            suggest_idxs, scores = ntd.sample_batch_init(acc_idxs, rej_idxs, budget)
        elif strategy == "Feedback":
            suggest_idxs, scores = ntd.sample_batch(acc_idxs, rej_idxs, budget)
        else:
            raise NotImplementedError
        return suggest_idxs, scores
    
    def _suggest_normal(self, strategy, iteration, acc_idxs, rej_idxs, budget, period):
        ntd = self._init_detection(iteration, period)
        if strategy == "TBSampling":
            suggest_idxs, _ = ntd.sample_batch_normal_init(acc_idxs, rej_idxs, budget)
        elif strategy == "Feedback":
            suggest_idxs, _ = ntd.sample_batch_normal(acc_idxs, rej_idxs, budget)
        else:
            raise NotImplementedError
        return suggest_idxs


class AnormalyTimeVisBackend(TimeVisBackend):

    def __init__(self, data_provider, projector, vis, evaluator, period, **hyperparameters) -> None:
        super().__init__(data_provider, projector, vis, evaluator, **hyperparameters)
        self.period = period
        file_path = os.path.join(self.data_provider.content_path, 'clean_label.json')
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
        with open(os.path.join(self.data_provider.content_path, 'sample_recommender.pkl'), 'wb') as f:
            pickle.dump(ntd, f, pickle.HIGHEST_PROTOCOL)

    def _init_detection(self):
        # prepare trajectories
        embedding_path = os.path.join(self.data_provider.content_path, 'trajectory_embeddings.npy')
        if os.path.exists(embedding_path):
            trajectories = np.load(embedding_path)
        else:
            # extract samples
            train_num = self.data_provider.train_num
            # change epoch_NUM
            epoch_num = (self.data_provider.e - self.data_provider.s)//self.data_provider.p + 1
            embeddings_2d = np.zeros((epoch_num, train_num, 2))
            for i in range(self.data_provider.s, self.data_provider.e+1, self.data_provider.p):
            # for i in range(self.data_provider.e - self.data_provider.p*(self.period-1), self.data_provider.e+1, self.data_provider.p):
                # id = (i-(self.data_provider.e - (self.data_provider.p-1)*self.period))//self.data_provider.p
                id = (i - self.data_provider.s)//self.data_provider.p
                embeddings_2d[id] = self.projector.batch_project(i, self.data_provider.train_representation(i))
            trajectories = np.transpose(embeddings_2d, [1,0,2])
            np.save(embedding_path, trajectories)
        # prepare uncertainty scores
        uncertainty_path = os.path.join(self.data_provider.content_path, 'uncertainties.npy')
        if os.path.exists(uncertainty_path):
            uncertainty = np.load(uncertainty_path)
        else:
            epoch_num = (self.data_provider.e - self.data_provider.s)//self.data_provider.p + 1
            samples = self.data_provider.train_representation(epoch_num)
            pred = self.data_provider.get_pred(epoch_num, samples)
            uncertainty = 1 - np.amax(softmax(pred, axis=1), axis=1)
            np.save(uncertainty_path, uncertainty)
        
        # prepare sampling manager
        ntd_path = os.path.join(self.data_provider.content_path, 'sample_recommender.pkl')
        if os.path.exists(ntd_path):
            with open(ntd_path, 'rb') as f:
                ntd = pickle.load(f)
        else:
            ntd = Recommender(uncertainty, trajectories, 30,period=self.period,metric="a")
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
        
        
