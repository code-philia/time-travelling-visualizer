"""The DataProvider class serve as a helper module for retriving subject model data"""
from abc import ABC, abstractmethod

import os
import gc
import time

from singleVis.utils import *
from singleVis.eval.evaluate import evaluate_inv_accu

"""
DataContainder module
1. prepare data
2. estimate boundary
3. provide data
"""
class DataProviderAbstractClass(ABC):
    
    def __init__(self, content_path, model, epoch_start, epoch_end, epoch_period):
        self.mode = "abstract"
        self.content_path = content_path
        self.model = model
        self.s = epoch_start
        self.e = epoch_end
        self.p = epoch_period
        
    @property
    @abstractmethod
    def train_num(self):
        pass

    @property
    @abstractmethod
    def test_num(self):
        pass

    @abstractmethod
    def _meta_data(self):
        pass

    @abstractmethod
    def _estimate_boundary(self):
        pass
    
    def update_interval(self, epoch_s, epoch_e):
        self.s = epoch_s
        self.e = epoch_e

class DataProvider(DataProviderAbstractClass):
    def __init__(self, content_path, model, epoch_start, epoch_end, epoch_period, device, classes, epoch_name, verbose=1):
        self.content_path = content_path
        self.model = model
        self.s = epoch_start
        self.e = epoch_end
        self.p = epoch_period
        self.DEVICE = device
        self.classes = classes
        self.verbose = verbose
        self.epoch_name = epoch_name
        self.model_path = os.path.join(self.content_path, "Model")
        if verbose:
            print("Finish initialization...")

    @property
    def train_num(self):
        with open(os.path.join(self.content_path, "Model", "{}_{}".format(self.epoch_name, self.s), "index.json"), "r") as f:
            idxs = json.load(f)
        return len(idxs)

    @property
    def test_num(self):
        testing_data_path = os.path.join(self.content_path, "Testing_data")
        testing_data = torch.load(os.path.join(testing_data_path, "testing_dataset_data.pth"),
                                  map_location="cpu")
        test_num = len(testing_data)
        del testing_data
        gc.collect()
        return test_num
    
    def _meta_data(self):
        raise NotImplementedError

    def _estimate_boundary(self):
        raise NotImplementedError


class NormalDataProvider(DataProvider):
    def __init__(self, content_path, model, epoch_start, epoch_end, epoch_period, device, classes, epoch_name, verbose=1):
        super().__init__(content_path, model, epoch_start, epoch_end, epoch_period, device, classes, epoch_name, verbose)
        self.mode = "normal"
    
    @property
    def representation_dim(self):
        train_data_loc = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, self.s), "train_data.npy")
        try:
            train_data = np.load(train_data_loc)
            repr_dim = np.prod(train_data.shape[1:])
            return repr_dim
        except Exception as e:
            return None

    def _meta_data(self):
        time_inference = list()
        training_data_path = os.path.join(self.content_path, "Training_data")
        training_data = torch.load(os.path.join(training_data_path, "training_dataset_data.pth"),
                                        map_location="cpu")
        training_data = training_data.to(self.DEVICE)
        testing_data_path = os.path.join(self.content_path, "Testing_data")
        testing_data = torch.load(os.path.join(testing_data_path, "testing_dataset_data.pth"),
                                       map_location="cpu")
        testing_data = testing_data.to(self.DEVICE)

        for n_epoch in range(self.s, self.e + 1, self.p):
            t_s = time.time()

            # make it possible to choose a subset of testing data for testing
            test_index_file = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, n_epoch), "test_index.json")
            if os.path.exists(test_index_file):
                test_index = load_labelled_data_index(test_index_file)
            else:
                test_index = range(len(testing_data))
            testing_data = testing_data[test_index]

            model_location = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, n_epoch), "subject_model.pth")
            self.model.load_state_dict(torch.load(model_location, map_location=torch.device("cpu")))
            self.model = self.model.to(self.DEVICE)
            self.model.eval()

            repr_model = self.feature_function(n_epoch)
            # repr_model = torch.nn.Sequential(*(list(self.model.children())[:self.split]))

            # training data clustering
            data_pool_representation = batch_run(repr_model, training_data)
            location = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, n_epoch), "train_data.npy")
            np.save(location, data_pool_representation)

            # test data
            test_data_representation = batch_run(repr_model, testing_data)
            location = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, n_epoch), "test_data.npy")
            np.save(location, test_data_representation)

            t_e = time.time()
            time_inference.append(t_e-t_s)
            if self.verbose > 0:
                print("Finish inferencing data for Epoch {:d}...".format(n_epoch))
        print(
            "Average time for inferencing data: {:.4f}".format(sum(time_inference) / len(time_inference)))

        # save result
        save_dir = os.path.join(self.model_path, "time.json")
        if not os.path.exists(save_dir):
            evaluation = dict()
        else:
            f = open(save_dir, "r")
            evaluation = json.load(f)
            f.close()
        evaluation["data_inference"] = round(sum(time_inference) / len(time_inference), 3)
        with open(save_dir, 'w') as f:
            json.dump(evaluation, f)

        del training_data
        del testing_data
        gc.collect()

    def _estimate_boundary(self, num, l_bound):
        '''
        Preprocessing data. This process includes find_border_points and find_border_centers
        save data for later training
        '''

        time_borders_gen = list()
        training_data_path = os.path.join(self.content_path, "Training_data")
        training_data = torch.load(os.path.join(training_data_path, "training_dataset_data.pth"),
                                   map_location="cpu")
        training_data = training_data.to(self.DEVICE)
        for n_epoch in range(self.s, self.e + 1, self.p):
            index_file = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, n_epoch), "index.json")
            index = load_labelled_data_index(index_file)
            training_data = training_data[index]

            # model_location = os.path.join(self.model_path, "Epoch_{:d}".format(n_epoch), "subject_model.pth")
            # self.model.load_state_dict(torch.load(model_location, map_location=torch.device("cpu")))
            # self.model = self.model.to(self.DEVICE)
            # self.model.eval()
            # repr_model = torch.nn.Sequential(*(list(self.model.children())[:self.split]))
            repr_model = self.feature_function(n_epoch)

            t0 = time.time()
            confs = batch_run(self.model, training_data)
            preds = np.argmax(confs, axis=1).squeeze()
            # TODO how to choose the number of boundary points?
            num_adv_eg = num
            border_points, _, _ = get_border_points(model=self.model, input_x=training_data, confs=confs, predictions=preds, device=self.DEVICE, l_bound=l_bound, num_adv_eg=num_adv_eg, lambd=0.05, verbose=0)
            t1 = time.time()
            time_borders_gen.append(round(t1 - t0, 4))

            # get gap layer data
            border_points = border_points.to(self.DEVICE)
            border_centers = batch_run(repr_model, border_points)
            location = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, n_epoch), "border_centers.npy")
            np.save(location, border_centers)

            location = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, n_epoch), "ori_border_centers.npy")
            np.save(location, border_points.cpu().numpy())

            num_adv_eg = num
            border_points, _, _ = get_border_points(model=self.model, input_x=training_data, confs=confs, predictions=preds, device=self.DEVICE, l_bound=l_bound, num_adv_eg=num_adv_eg, lambd=0.05, verbose=0)

            # get gap layer data
            border_points = border_points.to(self.DEVICE)
            border_centers = batch_run(repr_model, border_points)
            location = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, n_epoch), "test_border_centers.npy")
            np.save(location, border_centers)

            location = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, n_epoch), "test_ori_border_centers.npy")
            np.save(location, border_points.cpu().numpy())

            if self.verbose > 0:
                print("Finish generating borders for Epoch {:d}...".format(n_epoch))
        print(
            "Average time for generate border points: {:.4f}".format(sum(time_borders_gen) / len(time_borders_gen)))

        # save result
        save_dir = os.path.join(self.model_path, "time.json")
        if not os.path.exists(save_dir):
            evaluation = dict()
        else:
            f = open(save_dir, "r")
            evaluation = json.load(f)
            f.close()
        evaluation["data_B_gene"] = round(sum(time_borders_gen) / len(time_borders_gen), 3)
        with open(save_dir, 'w') as f:
            json.dump(evaluation, f)

    def initialize(self, num, l_bound):
        self._meta_data()
        self._estimate_boundary(num, l_bound)

    def train_representation(self, epoch):
        # load train data
        train_data_loc = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, epoch), "train_data.npy")
        index_file = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, epoch), "index.json")
        index = load_labelled_data_index(index_file)
        try:
            train_data = np.load(train_data_loc)
            train_data = train_data[index]
        except Exception as e:
            print("no train data saved for Epoch {}".format(epoch))
            train_data = None
        return train_data
    
    def train_labels(self, epoch):
        # load train data
        training_data_loc = os.path.join(self.content_path, "Training_data", "training_dataset_label.pth")
        index_file = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, epoch), "index.json")
        index = load_labelled_data_index(index_file)
        try:
            training_labels = torch.load(training_data_loc, map_location="cpu")
            training_labels = training_labels[index]
        except Exception as e:
            print("no train labels saved for Epoch {}".format(epoch))
            training_labels = None
        return training_labels.numpy()

    def test_representation(self, epoch):
        data_loc = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, epoch), "test_data.npy")
        try:
            test_data = np.load(data_loc)
            index_file = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, epoch), "test_index.json")
            if os.path.exists(index_file):
                index = load_labelled_data_index(index_file)
                test_data = test_data[index]
        except Exception as e:
            print("no test data saved for Epoch {}".format(epoch))
            test_data = None
        # max_x = self.max_norm(epoch)
        return test_data
    
    def test_labels(self, epoch):
        # load train data
        testing_data_loc = os.path.join(self.content_path, "Testing_data", "testing_dataset_label.pth")
        try:
            testing_labels = torch.load(testing_data_loc).to(device="cpu")
            index_file = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, epoch), "test_index.json")
            print(index_file)
            if os.path.exists(index_file):
                idxs = load_labelled_data_index(index_file)
                testing_labels = testing_labels[idxs]
        except Exception as e:
            print("no test labels saved for Epoch {}".format(epoch))
            testing_labels = None
        return testing_labels.cpu().numpy()

    def border_representation(self, epoch):
        border_centers_loc = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, epoch),
                                          "border_centers.npy")
        try:
            border_centers = np.load(border_centers_loc)
        except Exception as e:
            print("no border points saved for Epoch {}".format(epoch))
            border_centers = np.array([])
        return border_centers
    
    def test_border_representation(self, epoch):
        border_centers_loc = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, epoch),
                                          "test_border_centers.npy")
        try:
            border_centers = np.load(border_centers_loc)
        except Exception as e:
            print("no border points saved for Epoch {}".format(epoch))
            border_centers = np.array([])
        return border_centers
    
    def max_norm(self, epoch):
        train_data_loc = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, epoch), "train_data.npy")
        index_file = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, epoch), "index.json")
        index = load_labelled_data_index(index_file)
        try:
            train_data = np.load(train_data_loc)
            train_data = train_data[index]
            max_x = np.linalg.norm(train_data, axis=1).max()
        except Exception as e:
            print("no train data saved for Epoch {}".format(epoch))
            max_x = None
        return max_x

    def prediction_function(self, epoch):
        model_location = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, epoch), "subject_model.pth")
        self.model.load_state_dict(torch.load(model_location, map_location=torch.device("cpu")),strict=False)
        self.model.to(self.DEVICE)
        self.model.eval()

        pred_fn = self.model.prediction
        return pred_fn


    def feature_function(self, epoch):
        model_location = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, epoch), "subject_model.pth")
        self.model.load_state_dict(torch.load(model_location, map_location=torch.device("cpu")),strict=False)
        self.model = self.model.to(self.DEVICE)
        self.model.eval()

        fea_fn = self.model.feature
        return fea_fn

    def get_pred(self, epoch, data):
        '''
        get the prediction score for data in epoch_id
        :param data: numpy.ndarray
        :param epoch_id:
        :return: pred, numpy.ndarray
        '''
        prediction_func = self.prediction_function(epoch)

        data = torch.from_numpy(data)
        data = data.to(self.DEVICE)
        pred = batch_run(prediction_func, data)
        return pred

    def training_accu(self, epoch):
        data = self.train_representation(epoch)
        labels = self.train_labels(epoch)
        pred = self.get_pred(epoch, data).argmax(-1)
        val = evaluate_inv_accu(labels, pred)
        return val

    def testing_accu(self, epoch):
        data = self.test_representation(epoch)
        labels = self.test_labels(epoch)
        test_index_file = os.path.join(self.model_path, "{}_{}".format(self.epoch_name, epoch), "test_index.json")
        if os.path.exists(test_index_file):
            index = load_labelled_data_index(test_index_file)
            labels = labels[index]
        pred = self.get_pred(epoch, data).argmax(-1)
        val = evaluate_inv_accu(labels, pred)
        return val
    
    def is_deltaB(self, epoch, data):
        """
        check wheter input vectors are lying on delta-boundary or not
        :param epoch_id:
        :param data: numpy.ndarray
        :return: numpy.ndarray, boolean, True stands for is_delta_boundary
        """
        preds = self.get_pred(epoch, data)
        border = is_B(preds)
        return border
    
    def checkpoint_path(self, epoch):
        path = os.path.join(self.model_path, "{}_{}".format(self.epoch_name, epoch))
        return path

    
class ActiveLearningDataProvider(DataProvider):
    def __init__(self, content_path, model, base_epoch_start, device, classes, iteration_name="Iteration",verbose=1):
        # dummy input as epoch_end and epoch_period
        super().__init__(content_path, model, base_epoch_start, base_epoch_start, 1, device, classes, iteration_name, verbose)
        self.mode = "al"
        self.iteration_name = iteration_name
    
    @property
    def pool_num(self):
        return len(self.train_labels_all())
    
    def label_num(self, iteration):
        return len(self.get_labeled_idx(iteration))

    def representation_dim(self, iteration):
        train_data_loc = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, iteration), "train_data.npy")
        try:
            train_data = np.load(train_data_loc)
            repr_dim = np.prod(train_data.shape[1:])
            return repr_dim
        except Exception as e:
            return None
    
    def get_labeled_idx(self, iteration):
        index_file = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, iteration), "index.json")
        lb_idxs = np.array(load_labelled_data_index(index_file))
        return lb_idxs

    def get_unlabeled_idx(self, pool_num, lb_idx):
        tot_idx = np.arange(pool_num)
        # !Noted that tot need to be the first arguement
        ulb_idx = np.setdiff1d(tot_idx, lb_idx)
        return ulb_idx

    def _meta_data(self, iteration):
        training_data_path = os.path.join(self.content_path, "Training_data")
        training_data = torch.load(os.path.join(training_data_path, "training_dataset_data.pth"),
                                        map_location="cpu")
        training_data = training_data.to(self.DEVICE)
        testing_data_path = os.path.join(self.content_path, "Testing_data")
        testing_data = torch.load(os.path.join(testing_data_path, "testing_dataset_data.pth"),
                                       map_location="cpu")
        testing_data = testing_data.to(self.DEVICE)

        t_s = time.time()
        repr_model = self.feature_function(iteration)

        # training data clustering
        data_pool_representation = batch_run(repr_model, training_data)
        location = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, iteration), "train_data.npy")
        np.save(location, data_pool_representation)

        # test data
        test_data_representation = batch_run(repr_model, testing_data)
        location = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, iteration), "test_data.npy")
        np.save(location, test_data_representation)

        t_e = time.time()

        if self.verbose > 0:
            print("Finish inferencing data for Iteration {:d} in {:.2f} seconds...".format(iteration, t_e-t_s))

        # save result
        save_dir = os.path.join(self.model_path, "time_al.json")
        if not os.path.exists(save_dir):
            evaluation = dict()
            
        else:
            f = open(save_dir, "r")
            evaluation = json.load(f)
            f.close()
        if "data_inference" not in evaluation.keys():
            evaluation["data_inference"] = dict()
        evaluation["data_inference"][str(iteration)] = round(t_e - t_s, 3)
        with open(save_dir, 'w') as f:
            json.dump(evaluation, f)

        del training_data
        del testing_data
        gc.collect()

    def _estimate_boundary(self, iteration, num, l_bound):
        '''
        Preprocessing data. This process includes find_border_points and find_border_centers
        save data for later training
        '''

        training_data_path = os.path.join(self.content_path, "Training_data")
        training_data = torch.load(os.path.join(training_data_path, "training_dataset_data.pth"),
                                   map_location="cpu")
        training_data = training_data.to(self.DEVICE)
        index_file = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, iteration), "index.json")
        index = load_labelled_data_index(index_file)
        training_data = training_data[index]

        repr_model = self.feature_function(iteration)

        t0 = time.time()
        confs = batch_run(self.model, training_data)
        preds = np.argmax(confs, axis=1).squeeze()
        # TODO how to choose the number of boundary points?
        num_adv_eg = num
        border_points, _, _ = get_border_points(model=self.model, input_x=training_data, confs=confs, predictions=preds, device=self.DEVICE, l_bound=l_bound, num_adv_eg=num_adv_eg, lambd=0.05, verbose=0)
        t1 = time.time()

        # get gap layer data
        border_points = border_points.to(self.DEVICE)
        border_centers = batch_run(repr_model, border_points)
        location = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, iteration), "border_centers.npy")
        np.save(location, border_centers)

        location = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, iteration), "ori_border_centers.npy")
        np.save(location, border_points.cpu().numpy())

        num_adv_eg = num
        border_points, _, _ = get_border_points(model=self.model, input_x=training_data, confs=confs, predictions=preds, device=self.DEVICE, l_bound=l_bound, num_adv_eg=num_adv_eg, lambd=0.05, verbose=0)

        # get gap layer data
        border_points = border_points.to(self.DEVICE)
        border_centers = batch_run(repr_model, border_points)
        location = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, iteration), "test_border_centers.npy")
        np.save(location, border_centers)

        location = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_nameiteration), "test_ori_border_centers.npy")
        np.save(location, border_points.cpu().numpy())

        if self.verbose > 0:
            print("Finish generating borders for Iteration {:d} in {:.2f} seconds ...".format(iteration, t1-t0))

        # save result
        save_dir = os.path.join(self.model_path, "time_al.json")
        if not os.path.exists(save_dir):
            evaluation = dict()
        else:
            f = open(save_dir, "r")
            evaluation = json.load(f)
            f.close()
        if "data_B_gene" not in evaluation.keys():
            evaluation["data_B_gene"] = dict()
        evaluation["data_B_gene"][str(iteration)] = round(t1-t0, 3)
        with open(save_dir, 'w') as f:
            json.dump(evaluation, f)

    def initialize_iteration(self, iteration, num, l_bound):
        self._meta_data(iteration)
        self._estimate_boundary(iteration, num, l_bound)

    def train_representation(self, iteration):
        # load labelled train data
        train_data_loc = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, iteration), "train_data.npy")
        try:
            idxs = self.get_labeled_idx(iteration)
            train_data = np.load(train_data_loc)[idxs]
        except Exception as e:
            print("no train data saved for Iteration {}".format(iteration))
            train_data = None
        return train_data
    
    def train_labels(self, epoch):
        # load train data
        training_data_loc = os.path.join(self.content_path, "Training_data", "training_dataset_label.pth")
        try:
            idxs = self.get_labeled_idx(epoch)
            training_labels = torch.load(training_data_loc, map_location="cpu")[idxs]
        except Exception as e:
            print("no train labels saved for Iteration {}".format(epoch))
            training_labels = None
        return training_labels.numpy()
    
    def train_representation_ulb(self, iteration):
        # load train data
        train_data_loc = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, iteration), "train_data.npy")
        lb_idxs = self.get_labeled_idx(iteration)
        try:
            train_data = np.load(train_data_loc)
            ulb_idxs = self.get_unlabeled_idx(len(train_data), lb_idxs)
            train_data = train_data[ulb_idxs]
        except Exception as e:
            print("no train data saved for Iteration {}".format(iteration))
            train_data = None
        return train_data
    
    def train_labels_ulb(self, epoch):
        # load train data
        training_data_loc = os.path.join(self.content_path, "Training_data", "training_dataset_label.pth")
        lb_idxs = self.get_labeled_idx(epoch)
        try:
            training_labels = torch.load(training_data_loc, map_location="cpu")
            ulb_idxs = self.get_unlabeled_idx(len(training_labels), lb_idxs)
            training_labels = training_labels[ulb_idxs]
        except Exception as e:
            print("no train labels saved for Iteration {}".format(epoch))
            training_labels = None
        return training_labels.numpy()
    
    def train_representation_all(self, iteration):
        # load train data
        train_data_loc = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, iteration), "train_data.npy")
        try:
            train_data = np.load(train_data_loc)
        except Exception as e:
            print("no train data saved for Iteration {}".format(iteration))
            train_data = None
        return train_data
    
    def train_labels_all(self):
        # load train data
        training_data_loc = os.path.join(self.content_path, "Training_data", "training_dataset_label.pth")
        try:
            training_labels = torch.load(training_data_loc, map_location="cpu")
        except Exception as e:
            print("no train labels saved")
            training_labels = None
        return training_labels.numpy()

    def test_representation(self, epoch):
        data_loc = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, epoch), "test_data.npy")
        try:
            test_data = np.load(data_loc)
            index_file = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, epoch), "test_index.json")
            if os.path.exists(index_file):
                index = load_labelled_data_index(index_file)
                test_data = test_data[index]
        except Exception as e:
            print("no test data saved for Iteration {}".format(epoch))
            test_data = None
        # max_x = self.max_norm(epoch)
        return test_data
    
    def test_labels(self, epoch):
        # load train data
        testing_data_loc = os.path.join(self.content_path, "Testing_data", "testing_dataset_label.pth")
        try:
            testing_labels = torch.load(testing_data_loc, map_location="cpu").numpy()
            index_file = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, epoch), "test_index.json")
            if os.path.exists(index_file):
                idxs = load_labelled_data_index(index_file)
                testing_labels = testing_labels[idxs]
        except Exception as e:
            print("no test labels saved for Iteration {}".format(epoch))
            testing_labels = None
        return testing_labels

    def border_representation(self, epoch):
        border_centers_loc = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, epoch),
                                          "border_centers.npy")
        try:
            border_centers = np.load(border_centers_loc)
        except Exception as e:
            print("no border points saved for Iteration {}".format(epoch))
            border_centers = np.array([])
        return border_centers
    
    def test_border_representation(self, epoch):
        border_centers_loc = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, epoch),
                                          "test_border_centers.npy")
        try:
            border_centers = np.load(border_centers_loc)
        except Exception as e:
            print("no border points saved for Epoch {}".format(epoch))
            border_centers = np.array([])
        return border_centers
    
    def max_norm(self, epoch):
        train_data = self.train_representation(epoch)
        max_x = np.linalg.norm(train_data, axis=1).max()
        return max_x

    def prediction_function(self, iteration):
        model_location = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, iteration), "subject_model.pth")
        self.model.load_state_dict(torch.load(model_location, map_location=torch.device("cpu")))
        self.model.to(self.DEVICE)
        self.model.eval()

        pred_fn = self.model.prediction
        return pred_fn

    def feature_function(self, epoch):
        model_location = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, epoch), "subject_model.pth")
        self.model.load_state_dict(torch.load(model_location, map_location=torch.device("cpu")))
        self.model.to(self.DEVICE)
        self.model.eval()

        fea_fn = self.model.feature
        return fea_fn

    def get_pred(self, iteration, data):
        '''
        get the prediction score for data in epoch_id
        :param data: numpy.ndarray
        :param epoch_id:
        :return: pred, numpy.ndarray
        '''
        prediction_func = self.prediction_function(iteration)

        data = torch.from_numpy(data)
        data = data.to(self.DEVICE)
        pred = batch_run(prediction_func, data)
        return pred

    def training_accu(self, epoch):
        data = self.train_representation_lb(epoch)
        labels = self.train_labels_lb(epoch)
        pred = self.get_pred(epoch, data).argmax(1)
        val = evaluate_inv_accu(labels, pred)
        return val

    def testing_accu(self, epoch):
        data = self.test_representation(epoch)
        labels = self.test_labels(epoch)
        pred = self.get_pred(epoch, data).argmax(1)
        val = evaluate_inv_accu(labels, pred)
        return val
    
    def is_deltaB(self, epoch, data):
        """
        check wheter input vectors are lying on delta-boundary or not
        :param epoch_id:
        :param data: numpy.ndarray
        :return: numpy.ndarray, boolean, True stands for is_delta_boundary
        """
        preds = self.get_pred(epoch, data)
        border = is_B(preds)
        return border
    
    def checkpoint_path(self, epoch):
        path = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, epoch))
        return path
    
class DenseActiveLearningDataProvider(ActiveLearningDataProvider):
    def __init__(self, content_path, model, base_epoch_start, epoch_num, device, classes, iteration_name="Iteration", epoch_name="Epoch", verbose=1):
        super().__init__(content_path, model, base_epoch_start, device, classes, iteration_name, verbose)
        self.mode = "dense_al"
        self.epoch_num = epoch_num
        self.s = 1
        self.p = 1
        self.e = epoch_num
        self.epoch_name = epoch_name

    def representation_dim(self):
        train_data_loc = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, self.s), "{}_{:d}".format(self.epoch_name, self.epoch_num), "train_data.npy")
        try:
            train_data = np.load(train_data_loc)
            repr_dim = np.prod(train_data.shape[1:])
            return repr_dim
        except Exception as e:
            return None

    def _meta_data(self, iteration):
        time_inference = list()
        training_data_path = os.path.join(self.content_path, "Training_data")
        training_data = torch.load(os.path.join(training_data_path, "training_dataset_data.pth"),
                                        map_location="cpu")
        training_data = training_data.to(self.DEVICE)
        testing_data_path = os.path.join(self.content_path, "Testing_data")
        testing_data = torch.load(os.path.join(testing_data_path, "testing_dataset_data.pth"),
                                       map_location="cpu")
        testing_data = testing_data.to(self.DEVICE)

        t_s = time.time()

        # make it possible to choose a subset of testing data for testing
        test_index_file = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, iteration), "test_index.json")
        if os.path.exists(test_index_file):
            test_index = load_labelled_data_index(test_index_file)
        else:
            test_index = range(len(testing_data))
        testing_data = testing_data[test_index]

        for n_epoch in range(1, self.epoch_num+1, 1):
            repr_model = self.feature_function(iteration, n_epoch)

            # training data clustering
            data_pool_representation = batch_run(repr_model, training_data)
            location = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "{}_{:d}".format(self.epoch_name, n_epoch), "train_data.npy")
            np.save(location, data_pool_representation)

            # test data
            test_data_representation = batch_run(repr_model, testing_data)
            location = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "{}_{:d}".format(self.epoch_name, n_epoch), "test_data.npy")
            np.save(location, test_data_representation)

        t_e = time.time()
        time_inference.append(t_e-t_s)
        if self.verbose > 0:
            print("Finish inferencing data for Iteration {:d}...".format(iteration))
        print(
            "Average time for inferencing data: {:.4f}...".format(sum(time_inference) / len(time_inference)))

        # save result
        save_dir = os.path.join(self.model_path, "SV_time.json")
        if not os.path.exists(save_dir):
            evaluation = dict()
        else:
            f = open(save_dir, "r")
            evaluation = json.load(f)
            f.close()
        evaluation["data_inference"] = round(sum(time_inference) / len(time_inference), 3)
        with open(save_dir, 'w') as f:
            json.dump(evaluation, f)

        del training_data
        del testing_data
        gc.collect()

    def _estimate_boundary(self, iteration, num, l_bound):
        '''
        Preprocessing data. This process includes find_border_points and find_border_centers
        save data for later training
        '''

        time_borders_gen = list()
        training_data_path = os.path.join(self.content_path, "Training_data")
        training_data = torch.load(os.path.join(training_data_path, "training_dataset_data.pth"),
                                   map_location="cpu")
        training_data = training_data.to(self.DEVICE)

        for n_epoch in range(1, self.epoch_num+1, 1):
            index_file = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "index.json")
            index = load_labelled_data_index(index_file)
            training_data = training_data[index]

            repr_model = self.feature_function(iteration, n_epoch)

            t0 = time.time()
            confs = batch_run(self.model, training_data)
            preds = np.argmax(confs, axis=1).squeeze()
            # TODO how to choose the number of boundary points?
            num_adv_eg = num
            border_points, _, _ = get_border_points(model=self.model, input_x=training_data, confs=confs, predictions=preds, device=self.DEVICE, l_bound=l_bound, num_adv_eg=num_adv_eg, lambd=0.05, verbose=0)
            t1 = time.time()
            time_borders_gen.append(round(t1 - t0, 4))

            # get gap layer data
            border_points = border_points.to(self.DEVICE)
            border_centers = batch_run(repr_model, border_points)
            location = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "{}_{:d}".format(self.epoch_name, n_epoch), "border_centers.npy")
            np.save(location, border_centers)

            location = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "{}_{:d}".format(self.epoch_name, n_epoch), "ori_border_centers.npy")
            np.save(location, border_points.cpu().numpy())

            num_adv_eg = num
            border_points, _, _ = get_border_points(model=self.model, input_x=training_data, confs=confs, predictions=preds, device=self.DEVICE, l_bound=l_bound, num_adv_eg=num_adv_eg, lambd=0.05, verbose=0)

            # get gap layer data
            border_points = border_points.to(self.DEVICE)
            border_centers = batch_run(repr_model, border_points)
            location = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "{}_{:d}".format(self.epoch_nanme, n_epoch), "test_border_centers.npy")
            np.save(location, border_centers)

            location = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "{}_{:d}".format(self.epoch_name, n_epoch), "test_ori_border_centers.npy")
            np.save(location, border_points.cpu().numpy())

            if self.verbose > 0:
                print("Finish generating borders for Epoch {:d}...".format(n_epoch))
        print(
            "Average time for generate border points for each iteration: {:.4f}".format(sum(time_borders_gen) / len(time_borders_gen)))

        # save result
        save_dir = os.path.join(self.model_path, "SV_time.json")
        if not os.path.exists(save_dir):
            evaluation = dict()
        else:
            f = open(save_dir, "r")
            evaluation = json.load(f)
            f.close()
        evaluation["data_B_gene"] = round(sum(time_borders_gen) / len(time_borders_gen), 3)
        with open(save_dir, 'w') as f:
            json.dump(evaluation, f)

    def train_representation(self, iteration, epoch):
        # load train data
        train_data_loc = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, iteration), "{}_{}".format(self.epoch_name, epoch), "train_data.npy")
        lb_idxs = self.get_labeled_idx(iteration)
        try:
            train_data = np.load(train_data_loc)[lb_idxs]
        except Exception as e:
            print("no train data saved for Iteration {}".format(iteration))
            train_data = None
        return train_data

    def train_representation_all(self, iteration, epoch):
        # load train data
        train_data_loc = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "{}_{:d}".format(self.epoch_name, epoch), "train_data.npy")
        try:
            train_data = np.load(train_data_loc)
        except Exception as e:
            print("no train data saved for Iteration {} Epoch {}".format(iteration, epoch))
            train_data = None
        return train_data
    
    def train_representation_ulb(self, iteration, epoch):
        # load train data
        train_data_loc = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, iteration), "{}_{}".format(self.epoch_name, epoch), "train_data.npy")
        lb_idxs = self.get_labeled_idx(iteration)
        try:
            train_data = np.load(train_data_loc)
            pool_num = len(train_data)
            ulb_idx = self.get_unlabeled_idx(pool_num=pool_num, lb_idx=lb_idxs)
            train_data = train_data[ulb_idx]
        except Exception as e:
            print("no train data saved for Iteration {}".format(iteration))
            train_data = None
        return train_data
    
    def train_labels_ulb(self, iteration):
        # load train data
        training_data_loc = os.path.join(self.content_path, "Training_data", "training_dataset_label.pth")
        lb_idxs = self.get_labeled_idx(iteration)
        try:
            training_labels = torch.load(training_data_loc, map_location="cpu")
            ulb_idxs = self.get_unlabeled_idx(len(training_labels), lb_idxs)
            training_labels = training_labels[ulb_idxs]
        except Exception as e:
            print("no train labels saved for Iteration {}".format(iteration))
            training_labels = None
        return training_labels.numpy()
    
    def train_labels(self, iteration):
        # load labelled train labels
        training_data_loc = os.path.join(self.content_path, "Training_data", "training_dataset_label.pth")
        index_file = os.path.join(self.model_path, "{}_{:d}".format(self.iteration_name, iteration), "index.json")
        lb_idxs = np.array(load_labelled_data_index(index_file))
        try:
            training_labels = torch.load(training_data_loc, map_location="cpu")
            training_labels = training_labels[lb_idxs]
        except Exception as e:
            print("no train labels saved for Iteration {}".format(iteration))
            training_labels = None
        return training_labels.numpy()

    def train_labels_all(self):
        # load train data
        training_data_loc = os.path.join(self.content_path, "Training_data", "training_dataset_label.pth")
        try:
            training_labels = torch.load(training_data_loc, map_location="cpu")
        except Exception as e:
            print("no train labels saved")
            training_labels = None
        return training_labels.numpy()

    def test_representation(self, iteration, epoch):
        data_loc = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "{}_{}".format(self.epoch_name, epoch), "test_data.npy")
        try:
            test_data = np.load(data_loc)
            index_file = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "test_index.json")
            if os.path.exists(index_file):
                index = load_labelled_data_index(index_file)
                test_data = test_data[index]
        except Exception as e:
            print("no test data saved for Iteration {} Epoch {}".format(iteration, epoch))
            test_data = None
        return test_data

    def border_representation(self, iteration, epoch):
        border_centers_loc = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "{}_{:d}".format(self.epoch_name, epoch),
                                          "border_centers.npy")
        try:
            border_centers = np.load(border_centers_loc)
        except Exception as e:
            print("no border points saved for Epoch {}".format(epoch))
            border_centers = np.array([])
        return border_centers
    
    def test_border_representation(self, iteration, epoch):
        border_centers_loc = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "{}_{:d}".format(self.epoch_name, epoch),
                                          "test_border_centers.npy")
        try:
            border_centers = np.load(border_centers_loc)
        except Exception as e:
            print("no border points saved for Iteration {} Epoch {}".format(iteration, epoch))
            border_centers = np.array([])
        return border_centers
    
    def max_norm(self, iteration, epoch):
        train_data_loc = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "{}_{:d}".format(self.epoch_name, epoch), "train_data.npy")
        index_file = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "index.json")
        index = load_labelled_data_index(index_file)
        try:
            train_data = np.load(train_data_loc)
            train_data = train_data[index]
            max_x = np.linalg.norm(train_data, axis=1).max()
        except Exception as e:
            print("no train data saved for Iteration {} Epoch {}".format(iteration, epoch))
            max_x = None
        return max_x

    def prediction_function(self, iteration, epoch):
        model_location = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "{}_{:d}".format(self.epoch_name, epoch), "subject_model.pth")
        self.model.load_state_dict(torch.load(model_location, map_location=torch.device("cpu")))
        self.model.to(self.DEVICE)
        self.model.eval()

        pred_fn = self.model.prediction
        return pred_fn

    def feature_function(self, iteration, epoch):
        model_location = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "{}_{:d}".format(self.epoch_name, epoch), "subject_model.pth")
        self.model.load_state_dict(torch.load(model_location, map_location=torch.device("cpu")))
        self.model = self.model.to(self.DEVICE)
        self.model.eval()

        fea_fn = self.model.feature
        return fea_fn

    def get_pred(self, iteration, epoch, data):
        '''
        get the prediction score for data in epoch_id
        :param data: numpy.ndarray
        :param epoch_id:
        :return: pred, numpy.ndarray
        '''
        prediction_func = self.prediction_function(iteration, epoch)

        data = torch.from_numpy(data)
        data = data.to(self.DEVICE)
        pred = batch_run(prediction_func, data)
        return pred

    def training_accu(self, iteration, epoch):
        data = self.train_representation_lb(iteration, epoch)
        labels = self.train_labels_lb(iteration)
        pred = self.get_pred(iteration, epoch, data).argmax(-1)
        val = evaluate_inv_accu(labels, pred)
        return val

    def testing_accu(self, iteration, epoch):
        data = self.test_representation(epoch)
        labels = self.test_labels(epoch)
        test_index_file = os.path.join(self.model_path,"{}_{}".format(self.iteration_name, iteration), "{}_{}".format(self.epoch_name, epoch), "test_index.json")
        if os.path.exists(test_index_file):
            index = load_labelled_data_index(test_index_file)
            labels = labels[index]
        pred = self.get_pred(epoch, data).argmax(-1)
        val = evaluate_inv_accu(labels, pred)
        return val
    
    def is_deltaB(self, iteration, epoch, data):
        """
        check wheter input vectors are lying on delta-boundary or not
        :param epoch_id:
        :param data: numpy.ndarray
        :return: numpy.ndarray, boolean, True stands for is_delta_boundary
        """
        preds = self.get_pred(iteration, epoch, data)
        border = is_B(preds)
        return border
    
    def single_checkpoint_path(self, iteration, epoch):
        path = os.path.join(self.model_path, "{}_{}".format(self.iteration_name, iteration), "{}_{}".format(self.epoch_name, epoch))
        return path
