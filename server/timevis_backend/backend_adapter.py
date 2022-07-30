'''This class serves as a intermediate layer for tensorboard frontend and timeVis backend'''
import os
import sys
import json
import time
import torch
import numpy as np

# if active learning warning
# os.environ["OMP_NUM_THREADS"] = "1"

import torch.nn
import torch.optim as optim
from torch.utils.data import DataLoader, Subset
from torch.utils.data import WeightedRandomSampler
import torchvision

from scipy.special import softmax
from sklearn.neighbors import NearestNeighbors

# if:IOError: [Errno socket error] [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed (_ssl.c:727)
#import ssl
#ssl._create_default_https_context = ssl._create_unverified_context

timevis_path = "D:\\code-space\\DLVisDebugger" #limy 
# timevis_path = "../../DLVisDebugger" #xianglin#yvonne
sys.path.append(timevis_path)
from singleVis.utils import *
from singleVis.SingleVisualizationModel import SingleVisualizationModel
from singleVis.data import DataProvider
from singleVis.eval.evaluator import Evaluator
from singleVis.trainer import SingleVisTrainer
from singleVis.losses import ReconstructionLoss, UmapLoss, SingleVisLoss
from singleVis.visualizer import visualizer
from singleVis.custom_weighted_random_sampler import CustomWeightedRandomSampler
from singleVis.edge_dataset import DataHandler
from singleVis.eval.evaluator import Evaluator
from singleVis.spatial_edge_constructor import SingleEpochSpatialEdgeConstructor

active_learning_path = "D:\\code-space\\ActiveLearning"  # limy 
# active_learning_path = "../../ActiveLearning"
sys.path.append(active_learning_path)

class TimeVisBackend:
    def __init__(self, data_provider, trainer, vis, evaluator, **hyperparameters) -> None:
        self.data_provider = data_provider
        self.trainer = trainer
        self.vis = vis
        self.evaluator = evaluator
        self.hyperparameters = hyperparameters
    #################################################################################################################
    #                                                                                                               #
    #                                                data Panel                                                     #
    #                                                                                                               #
    #################################################################################################################

    def batch_project(self, data):
        embedding = self.trainer.model.encoder(torch.from_numpy(data).to(dtype=torch.float32, device=self.trainer.DEVICE)).cpu().detach().numpy()
        return embedding
    
    def individual_project(self, data):
        embedding = self.trainer.model.encoder(torch.from_numpy(np.expand_dims(data, axis=0)).to(dtype=torch.float32, device=self.trainer.DEVICE)).cpu().detach().numpy()
        return embedding.squeeze(axis=0)
    
    def batch_inverse(self, embedding):
        data = self.trainer.model.decoder(torch.from_numpy(embedding).to(dtype=torch.float32, device=self.trainer.DEVICE)).cpu().detach().numpy()
        return data
    
    def individual_inverse(self, embedding):
        data = self.trainer.model.decoder(torch.from_numpy(np.expand_dims(embedding, axis=0)).to(dtype=torch.float32, device=self.trainer.DEVICE)).cpu().detach().numpy()
        return data.squeeze(axis=0)

    def batch_inv_preserve(self, epoch, data):
        """
        get inverse confidence for a single point
        :param epoch: int
        :param data: numpy.ndarray
        :return l: boolean, whether reconstruction data have the same prediction
        :return conf_diff: float, (0, 1), confidence difference
        """
        self.trainer.model.eval()
        embedding = self.batch_project(data)
        recon = self.batch_inverse(embedding)
    
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
    
    def detect_noise(self, cls_num):
        # extract samples
        train_num = self.train_num
        repr_dim = self.representation_dim
        epoch_num = (self.e - self.s)//self.p + 1
        samples = np.zeros((epoch_num, train_num, repr_dim))
        for i in range(self.s, self.e+1, self.p):
            samples[(i-self.s)//self.p] = self.train_representation(i)
        
        # embeddings
        embeddings_2d = np.zeros((train_num, epoch_num, 2))
        for i in range(train_num):
            embedding_2d = self.trainer.model.encoder(torch.from_numpy(samples[:,i,:]).to(device=self.data_provider.DEVICE, dtype=torch.float)).cpu().detach().numpy()
            embeddings_2d[i] = embedding_2d
        
        train_labels = self.data_provider.train_labels(self.s)

        cls = np.argwhere(train_labels == cls_num).squeeze()
        high_data = embeddings_2d[cls].reshape(len(cls), -1)
        labels, scores, centroid, centroid_labels, embedding = test_abnormal(high_data)




    #################################################################################################################
    #                                                                                                               #
    #                                             Helper Functions                                                  #
    #                                                                                                               #
    #################################################################################################################

    def get_epoch_index(self, epoch_id):
        """get the training data index for an epoch"""
        index_file = os.path.join(self.data_provider.model_path, "Epoch_{:d}".format(epoch_id), "index.json")
        index = load_labelled_data_index(index_file)
        return index


class HybridTimeVisBackend(TimeVisBackend):

    def __init__(self, data_provider, trainer, vis, evaluator, **hyperparameters) -> None:
        self.data_provider = data_provider
        self.trainer = trainer
        self.trainer.model.eval()
        self.vis = vis
        self.evaluator = evaluator
        self.hyperparameters = hyperparameters
    #################################################################################################################
    #                                                                                                               #
    #                                                data Panel                                                     #
    #                                                                                                               #
    #################################################################################################################

    def batch_project(self, data):
        embedding = self.trainer.model.encoder(torch.from_numpy(data).to(dtype=torch.float32, device=self.trainer.DEVICE)).cpu().detach().numpy()
        return embedding
    
    def individual_project(self, data):
        embedding = self.trainer.model.encoder(torch.from_numpy(np.expand_dims(data, axis=0)).to(dtype=torch.float32, device=self.trainer.DEVICE)).cpu().detach().numpy()
        return embedding.squeeze(axis=0)
    
    def batch_inverse(self, embedding):
        data = self.trainer.model.decoder(torch.from_numpy(embedding).to(dtype=torch.float32, device=self.trainer.DEVICE)).cpu().detach().numpy()
        return data
    
    def individual_inverse(self, embedding):
        data = self.trainer.model.decoder(torch.from_numpy(np.expand_dims(embedding, axis=0)).to(dtype=torch.float32, device=self.trainer.DEVICE)).cpu().detach().numpy()
        return data.squeeze(axis=0)

    def batch_inv_preserve(self, epoch, data):
        """
        get inverse confidence for a single point
        :param epoch: int
        :param data: numpy.ndarray
        :return l: boolean, whether reconstruction data have the same prediction
        :return conf_diff: float, (0, 1), confidence difference
        """
        self.trainer.model.eval()
        embedding = self.batch_project(data)
        recon = self.batch_inverse(embedding)
    
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
    
    def detect_noise(self, cls_num):
        # extract samples
        train_num = self.train_num
        repr_dim = self.representation_dim
        epoch_num = (self.e - self.s)//self.p + 1
        samples = np.zeros((epoch_num, train_num, repr_dim))
        for i in range(self.s, self.e+1, self.p):
            samples[(i-self.s)//self.p] = self.train_representation(i)
        
        # embeddings
        embeddings_2d = np.zeros((train_num, epoch_num, 2))
        for i in range(train_num):
            embedding_2d = self.trainer.model.encoder(torch.from_numpy(samples[:,i,:]).to(device=self.data_provider.DEVICE, dtype=torch.float)).cpu().detach().numpy()
            embeddings_2d[i] = embedding_2d
        
        train_labels = self.data_provider.train_labels(self.s)

        cls = np.argwhere(train_labels == cls_num).squeeze()
        high_data = embeddings_2d[cls].reshape(len(cls), -1)
        labels, scores, centroid, centroid_labels, embedding = test_abnormal(high_data)




    #################################################################################################################
    #                                                                                                               #
    #                                             Helper Functions                                                  #
    #                                                                                                               #
    #################################################################################################################

    def get_epoch_index(self, epoch_id):
        """get the training data index for an epoch"""
        index_file = os.path.join(self.data_provider.model_path, "Epoch_{:d}".format(epoch_id), "index.json")
        index = load_labelled_data_index(index_file)
        return index


class ActiveLearningTimeVisBackend(TimeVisBackend):
    def __init__(self, data_provider, trainer, vis, evaluator, **hyperparameters) -> None:
        super().__init__(data_provider, trainer, vis, evaluator, **hyperparameters)
    
    def get_epoch_index(self, iteration):
        """get the training data index for an epoch"""
        index_file = os.path.join(self.data_provider.model_path, "Iteration_{:d}".format(iteration), "index.json")
        index = load_labelled_data_index(index_file)
        return index

    def al_query(self, iteration, budget, strategy, prev_idxs, curr_idxs):
    # def al_query(self, iteration, budget, strategy, idxs_lb):
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

        # for reproduce purpose
        # torch.manual_seed(1331)
        # np.random.seed(1131)

        # loading neural network
        import Model.model as subject_model
        task_model = eval("subject_model.{}()".format(NET))
        task_model_type = "pytorch"
        # start experiment
        n_pool = self.hyperparameters["TRAINING"]["train_num"]  # 50000
        n_test = self.hyperparameters["TRAINING"]['test_num']   # 10000

        resume_path = os.path.join(CONTENT_PATH, "Model", "Iteration_{}".format(iteration))

        idxs_lb = np.array(json.load(open(os.path.join(resume_path, "index.json"), "r")))
        idxs_lb = np.concatenate((idxs_lb, prev_idxs), axis=0)
        idxs_lb = np.concatenate((idxs_lb, curr_idxs), axis=0)
        
        state_dict = torch.load(os.path.join(resume_path, "subject_model.pth"))
        # if if gpu is None
        #state_dict = torch.load(os.path.join(resume_path, "subject_model.pth"),map_location=torch.device('cpu'))
        task_model.load_state_dict(state_dict)
        NUM_INIT_LB = len(idxs_lb)

        print('resume from iteration {}'.format(iteration))
        print('number of labeled pool: {}'.format(NUM_INIT_LB))
        print('number of unlabeled pool: {}'.format(n_pool - NUM_INIT_LB))
        print('number of testing pool: {}'.format(n_test))

        # here the training handlers and testing handlers are different
        complete_dataset = torchvision.datasets.CIFAR10(root="..//data//CIFAR10", download=True, train=True, transform=self.hyperparameters["TRAINING"]['transform_te'])

        if strategy == "random":
            from query_strategies.random import RandomSampling
            q_strategy = RandomSampling(task_model, task_model_type, n_pool, idxs_lb, 10, DATA_NAME, NET, gpu=GPU, **self.hyperparameters["TRAINING"])
            # print information
            print(DATA_NAME)
            print(type(strategy).__name__)
            print('================Round {:d}==============='.format(iteration+1))
            # query new samples
            t0 = time.time()
            new_indices, scores = q_strategy.query(NUM_QUERY)
            t1 = time.time()
            print("Query time is {:.2f}".format(t1-t0))
        elif strategy == "LeastConfidence":
            from query_strategies.LeastConfidence import LeastConfidenceSampling
            q_strategy = LeastConfidenceSampling(task_model, task_model_type, n_pool, idxs_lb, 10, DATA_NAME, NET, gpu=GPU, **self.hyperparameters["TRAINING"])
            # print information
            print(DATA_NAME)
            print(type(strategy).__name__)
            print('================Round {:d}==============='.format(iteration+1))
            # query new samples
            t0 = time.time()
            new_indices, scores = q_strategy.query(complete_dataset, NUM_QUERY)
            t1 = time.time()
            print("Query time is {:.2f}".format(t1-t0))
        
        elif strategy == "coreset":
            from query_strategies.coreset import CoreSetSampling
            q_strategy = CoreSetSampling(task_model, task_model_type, n_pool, 512, idxs_lb, DATA_NAME, NET, gpu=GPU, **self.hyperparameters["TRAINING"])
            print('================Round {:d}==============='.format(iteration+1))
            embedding = q_strategy.get_embedding(complete_dataset)
            # query new samples
            t0 = time.time()
            new_indices, scores = q_strategy.query(embedding, NUM_QUERY)
            t1 = time.time()
            print("Query time is {:.2f}".format(t1-t0))
        
        elif strategy == "badge":
            from query_strategies.badge import BadgeSampling
            q_strategy = BadgeSampling(task_model, task_model_type, n_pool, 512, idxs_lb, 10, DATA_NAME, NET, gpu=GPU, **self.hyperparameters["TRAINING"])
            print('================Round {:d}==============='.format(iteration+1))
            # query new samples
            t0 = time.time()
            new_indices, scores = q_strategy.query(complete_dataset, NUM_QUERY)
            t1 = time.time()
            print("Query time is {:.2f}".format(t1-t0))

        
        # TODO return the suggest labels, need to develop pesudo label generation technique in the future
        true_labels = self.data_provider.train_labels(iteration)

        return new_indices, true_labels[new_indices], scores
    
    def al_train(self, iteration, indices):
        # for reproduce purpose
        
        print("New indices:\t{}".format(len(indices)))
        self.save_human_selection(iteration, indices)
        lb_idx = self.get_epoch_index(iteration)
        train_idx = np.hstack((lb_idx, indices))
        print("Training indices:\t{}".format(len(train_idx)))
        print("Valid indices:\t{}".format(len(set(train_idx))))

        CONTENT_PATH = self.data_provider.content_path
        TOTAL_EPOCH = self.hyperparameters["TRAINING"]["total_epoch"]
        NET = self.hyperparameters["TRAINING"]["NET"]
        DEVICE = self.data_provider.DEVICE
        NEW_ITERATION = iteration + 1
        GPU = self.hyperparameters["GPU"]
        DATA_NAME = self.hyperparameters["DATASET"]
        sys.path.append(CONTENT_PATH)

        # loading neural network
        from Model.model import resnet18
        task_model = resnet18()
        resume_path = os.path.join(CONTENT_PATH, "Model", "Iteration_{}".format(iteration))
        state_dict = torch.load(os.path.join(resume_path, "subject_model.pth"))
        task_model.load_state_dict(state_dict)

        self.save_iteration_index(NEW_ITERATION, train_idx)
        task_model_type = "pytorch"
        # start experiment
        n_pool = self.hyperparameters["TRAINING"]["train_num"]  # 50000

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
        q_strategy.train(total_epoch=TOTAL_EPOCH, task_model=resnet_model, complete_dataset=train_dataset)
        t2 = time.time()
        print("Training time is {:.2f}".format(t2-t1))
        self.save_subject_model(NEW_ITERATION, q_strategy.task_model.state_dict())

        # compute accuracy at each round
        accu = q_strategy.test_accu(test_dataset)
        print('Accuracy {:.3f}'.format(100*accu))
    

    def al_find_similar(self, iteration, prev_idxs, curr_idxs, k):
        train_data = self.data_provider.train_representation(iteration)
        train_labels = self.data_provider.train_labels(iteration)

        train_num = self.data_provider.train_num
        lb_idx = self.get_epoch_index(iteration)
        ulb_idx = np.setdiff1d(np.arrange(train_num), lb_idx)
        curr_selected = np.concatenate((prev_idxs, curr_idxs), axis=0)
        ulb_idx = np.setdiff1d(ulb_idx, curr_selected)
        nbrs = NearestNeighbors(n_neighbors=k, algorithm='ball_tree').fit(train_data[ulb_idx])
        _, idxs = nbrs.kneighbors(train_data[curr_idxs])

        idxs = idxs.flatten()
        idxs = ulb_idx[idxs]
        unique_idxs, ids = np.unique(idxs, return_index=True)
        # suggest_labels = curr_labels.repeat(k)
        # suggest_labels = suggest_labels[ids]
        suggest_labels = train_labels[unique_idxs]

        return unique_idxs, suggest_labels


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
        os.system("mkdir -p {}".format(new_iteration_dir))
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
        os.system("mkdir -p {}".format(save_dir))
        self.trainer.save(save_dir=save_dir, file_name="al")
        # TODO evaluate visualization model
    

        
        
