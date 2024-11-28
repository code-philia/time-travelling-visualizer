"""The DataProvider class serve as a helper module for retriving subject model data"""
from abc import ABC, abstractmethod
import os
import gc
import time
import numpy as np
import torch
import json
from visualize.evaluate import evaluate_inv_accu
from visualize.utils import *

# ---------------------
# Data processer and provider:
# 1.construct high dimension feature
# 2.provide data and data info
# 3.handle different kind data
# ---------------------
class DataProviderAbstractClass(ABC):
    
    def __init__(self, content_path, model, epoch_start, epoch_end, epoch_period):
        self.mode = "abstract"
        self.content_path = content_path
        self.subject_model = model
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
    def __init__(self, content_path, model, epoch_start, epoch_end, epoch_period, device, task_type, data_type, show_label=False,classes = None, verbose = 0):
        self.content_path = content_path
        self.subject_model = model
        self.s = epoch_start
        self.e = epoch_end
        self.p = epoch_period
        self.DEVICE = device
        self.model_path = os.path.join(self.content_path, "Model")
        self.task_type = task_type
        self.data_type = data_type
        self.show_label = show_label
        self.classes = classes
        self.verbose = verbose
    @property
    def train_num(self):
        raise NotImplementedError

    @property
    def test_num(self):
        raise NotImplementedError
    
    def _meta_data(self):
        raise NotImplementedError

    def _estimate_boundary(self):
        raise NotImplementedError


class NormalDataProvider(DataProvider):
    def __init__(self, content_path, model, epoch_start, epoch_end, epoch_period, device, task_type, data_type, show_label=False,classes = None, verbose=0):
        super().__init__(content_path, model, epoch_start, epoch_end, epoch_period, device, task_type, data_type, show_label,classes, verbose)
        self.mode = "normal"
    
    @property
    def representation_dim(self):
        train_data_loc = os.path.join(self.model_path, "Epoch_{:d}".format(self.s), "train_data.npy")
        try:
            train_data = np.load(train_data_loc)
            repr_dim = np.prod(train_data.shape[1:])
            return repr_dim
        except Exception as e:
            return None

    """
    Generate high dimension representation of data (train.npy, test.npy)
    """
    def _meta_data(self):
        time_inference = list()
        dataset_path = os.path.join(self.content_path, "Dataset")
        training_data = torch.load(os.path.join(dataset_path, "training_dataset_data.pth"),map_location="cpu")
        testing_data = torch.load(os.path.join(dataset_path, "testing_dataset_data.pth"),map_location="cpu")

        if self.show_label:
            training_label = torch.load(os.path.join(dataset_path, "training_dataset_label.pth"),map_location="cpu")
            testing_label = torch.load(os.path.join(dataset_path, "testing_dataset_label.pth"),map_location="cpu")

        for n_epoch in range(self.s, self.e + 1, self.p):
            t_s = time.time()

            # load feature func
            subject_model_location = os.path.join(self.model_path, "Epoch_{:d}".format(n_epoch), "subject_model.pth")
            self.subject_model.load_state_dict(torch.load(subject_model_location, map_location=torch.device("cpu")))
            self.subject_model = self.subject_model.to(self.DEVICE)
            self.subject_model.eval()
            reat_func = self.subject_model.feature

            if self.show_label:
                # train data
                train_data_representation = batch_run_feature_extract(reat_func, training_data, device=self.DEVICE, desc="feature_extraction: source")
                train_label_representation = batch_run_feature_extract(reat_func, training_label, device=self.DEVICE, desc="feature_extraction: target")
                if get_feature_num(train_data_representation) == 1:
                    train_representation = np.stack([train_data_representation,train_label_representation], axis=1)
                else:
                    train_representation = np.concatenate([train_data_representation,train_label_representation],axis=1) # [train_num, data_feature_num+label_feature_num, feature_dim]
                np.save(os.path.join(self.model_path, "Epoch_{:d}".format(n_epoch), "train_data_representation.npy"), train_representation)
                # test data
                test_data_representation = batch_run_feature_extract(reat_func, testing_data, device=self.DEVICE, desc="feature_extraction: source")
                test_label_representation = batch_run_feature_extract(reat_func, testing_label, device=self.DEVICE, desc="feature_extraction: target")
                if get_feature_num(test_data_representation) == 1:
                    test_representation = np.stack([test_data_representation,test_label_representation], axis=1)
                else:
                    test_representation = np.concatenate([test_data_representation,test_label_representation],axis=1)
                np.save(os.path.join(self.model_path, "Epoch_{:d}".format(n_epoch), "test_data_representation.npy"), test_representation)
            else:
                # train data
                train_data_representation = batch_run_feature_extract(reat_func, training_data, device=self.DEVICE, desc="feature_extraction")
                np.save(os.path.join(self.model_path, "Epoch_{:d}".format(n_epoch), "train_data_representation.npy"), train_data_representation)
                # test data
                test_data_representation = batch_run_feature_extract(reat_func, testing_data, device=self.DEVICE, desc="feature_extraction")
                np.save(os.path.join(self.model_path, "Epoch_{:d}".format(n_epoch), "test_data_representation.npy"), test_data_representation)
            
            t_e = time.time()
            time_inference.append(t_e-t_s)
            if self.verbose > 0:
                print("Finish extracting feature for Epoch {:d}...".format(n_epoch))

        # save feature extraction time
        print("Average time for feature extraction (time per epoch): {:.4f}".format(sum(time_inference) / len(time_inference)))
        save_dir = os.path.join(self.model_path, "time.json")
        if not os.path.exists(save_dir):
            evaluation = dict()
        else:
            f = open(save_dir, "r")
            evaluation = json.load(f)
            f.close()
        evaluation["feature_extraction"] = round(sum(time_inference) / len(time_inference), 3)
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
        
        if isinstance(training_data, torch.Tensor):
            training_data = training_data.to(self.DEVICE)
        elif isinstance(training_data, BatchEncoding):
            training_data = {key: value.to(self.DEVICE) for key, value in training_data.items()}
        else:
            raise TypeError("Unknown type of text input, not dict or tensor.")
        
        for n_epoch in range(self.s, self.e + 1, self.p):
            index_file = os.path.join(self.model_path, "index.json")
            index = load_labelled_data_index(index_file)
            training_data = training_data[index]

            repr_model = self.feature_function(n_epoch)

            t0 = time.time()
            confs = batch_run(self.subject_model, training_data, desc="predicting")
            preds = np.argmax(confs, axis=1).squeeze()
            # TODO how to choose the number of boundary points?
            num_adv_eg = num
            border_points, _, _ = get_border_points(model=self.subject_model, input_x=training_data, confs=confs, predictions=preds, device=self.DEVICE, l_bound=l_bound, num_adv_eg=num_adv_eg, lambd=0.05, verbose=0)
            t1 = time.time()
            time_borders_gen.append(round(t1 - t0, 4))

            # get gap layer data
            border_points = border_points.to(self.DEVICE)
            border_centers = batch_run(repr_model, border_points, desc="border_centers feature_extraction")
            location = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, n_epoch), "border_centers.npy")
            np.save(location, border_centers)

            location = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, n_epoch), "ori_border_centers.npy")
            np.save(location, border_points.cpu().numpy())

            num_adv_eg = num
            border_points, _, _ = get_border_points(model=self.subject_model, input_x=training_data, confs=confs, predictions=preds, device=self.DEVICE, l_bound=l_bound, num_adv_eg=num_adv_eg, lambd=0.05, verbose=0)

            # get gap layer data
            border_points = border_points.to(self.DEVICE)
            border_centers = batch_run(repr_model, border_points, desc="border_centers feature_extraction")
            location = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, n_epoch), "test_border_centers.npy")
            np.save(location, border_centers)

            location = os.path.join(self.model_path, "{}_{:d}".format(self.epoch_name, n_epoch), "test_ori_border_centers.npy")
            np.save(location, border_points.cpu().numpy())

            if self.verbose > 0:
                print("Finish generating borders for Epoch {:d}...".format(n_epoch))
        
        # save time result
        print("Average time for generate border points: {:.4f}".format(sum(time_borders_gen) / len(time_borders_gen)))
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

    """
    Func:
        Get high dimension representation of data.
    Args:
        epoch
    Returns:
        np.ndarray: load from data.npy
    """
    def train_representation(self, epoch):
        train_data_loc = os.path.join(self.model_path, "Epoch_{:d}".format(int(epoch)), "train_data_representation.npy")
        index_file = os.path.join(self.model_path, "index.json")
        try:
            train_data = np.load(train_data_loc)
            if os.path.exists(index_file):
                index = load_labelled_data_index(index_file)
                train_data = train_data[index]
        except Exception as e:
            print("no train data saved for Epoch {}".format(epoch))
            train_data = None
        return train_data
    
    def test_representation(self, epoch):
        data_loc = os.path.join(self.model_path, "Epoch_{:d}".format(int(epoch)), "test_data_representation.npy")
        index_file = os.path.join(self.model_path,  "test_index.json")
        try:
            test_data = np.load(data_loc)
            if os.path.exists(index_file):
                index = load_labelled_data_index(index_file)
                test_data = test_data[index]
        except Exception as e:
            print("no test data saved for Epoch {}".format(epoch))
            test_data = None
        return test_data
    
    def all_representation(self, epoch):
        train_data = self.train_representation(epoch)
        test_data = self.test_representation(epoch)
        all_data = np.concatenate((train_data, test_data), axis=0)
        return all_data
    
    """
    Func:
        Load labels.
    Args:
        epoch 
    Returns:
        np.ndarray: labels 
    """
    def train_labels(self):
        training_data_loc = os.path.join(self.content_path, "Dataset", "training_dataset_label.pth")
        index_file = os.path.join(self.model_path, "index.json")
        try:
            training_labels = torch.load(training_data_loc, map_location="cpu")
            training_labels = np.array(training_labels)
            if os.path.exists(index_file):
                index = load_labelled_data_index(index_file)
                training_labels = training_labels[index]
        except Exception as e:
            print("No train labels saved !")
            training_labels = None
        return training_labels
    
    def test_labels(self):
        testing_data_loc = os.path.join(self.content_path, "Dataset", "testing_dataset_label.pth")
        index_file = os.path.join(self.model_path, "test_index.json")
        try:
            testing_labels = torch.load(testing_data_loc, map_location="cpu")
            testing_labels = np.array(testing_labels)
            if os.path.exists(index_file):
                index = load_labelled_data_index(index_file)
                testing_labels = testing_labels[index]
        except Exception as e:
            print("No test labels saved !")
            testing_labels = None
        return testing_labels
    
    def all_labels(self):
        train_labels = self.train_labels()
        test_labels = self.test_labels()
        if train_labels is None or test_labels is None:
            return None
        else:
            all_labels = np.concatenate((train_labels, test_labels), axis=0)
            return all_labels

    def border_representation(self, epoch):
        border_centers_loc = os.path.join(self.model_path, "Epoch_{:d}".format(epoch),
                                          "border_centers.npy")
        try:
            border_centers = np.load(border_centers_loc)
        except Exception as e:
            print("no border points saved for Epoch {}".format(epoch))
            border_centers = np.array([])
        return border_centers
    
    def test_border_representation(self, epoch):
        border_centers_loc = os.path.join(self.model_path, "Epoch_{:d}".format(epoch),
                                          "test_border_centers.npy")
        try:
            border_centers = np.load(border_centers_loc)
        except Exception as e:
            print("no border points saved for Epoch {}".format(epoch))
            border_centers = np.array([])
        return border_centers
    
    def max_norm(self, epoch):
        train_data_loc = os.path.join(self.model_path, "Epoch_{:d}".format( epoch), "train_data_representation.npy")
        index_file = os.path.join(self.model_path, "index.json")
        try:
            train_data = np.load(train_data_loc)
            if os.path.exists(index_file):
                index = load_labelled_data_index(index_file)
                train_data = train_data[index]
            max_x = np.linalg.norm(train_data, axis=1).max()
        except Exception as e:
            print("no train data saved for Epoch {}".format(epoch))
            max_x = None
        return max_x

    def prediction_function(self, epoch):
        model_location = os.path.join(self.model_path, "Epoch_{:d}".format(epoch), "subject_model.pth")
        self.subject_model.load_state_dict(torch.load(model_location, map_location=torch.device("cpu")))
        self.subject_model.to(self.DEVICE)
        self.subject_model.eval()

        pred_fn = self.subject_model.prediction
        return pred_fn

    def feature_function(self, epoch):
        model_location = os.path.join(self.model_path, "Epoch_{:d}".format(epoch), "subject_model.pth")
        self.subject_model.load_state_dict(torch.load(model_location, map_location=torch.device("cpu")))
        self.subject_model = self.subject_model.to(self.DEVICE)
        self.subject_model.eval()

        fea_fn = self.subject_model.feature
        return fea_fn


    """
    Func:
        Given hidension data representation, return prediction using pred_func.
    """
    def get_pred(self, epoch, data):
        prediction_func = self.prediction_function(epoch)
        # data = torch.from_numpy(data)
        # data = data.to(self.DEVICE)
        pred = batch_run(prediction_func, data, device=self.DEVICE, desc="prediction_func")
        return pred

    # TODO:does this needed?
    def training_accu(self, epoch):
        data = self.train_representation(epoch)
        labels = self.train_labels(epoch)
        pred = self.get_pred(epoch, data).argmax(-1)
        val = evaluate_inv_accu(labels, pred)
        return val

    def testing_accu(self, epoch):
        data = self.test_representation(epoch)
        labels = self.test_labels(epoch)
        test_index_file = os.path.join(self.model_path, "Epoch_{}".format(epoch), "test_index.json")
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
        path = os.path.join(self.model_path, "Epoch_{}".format(epoch))
        return path