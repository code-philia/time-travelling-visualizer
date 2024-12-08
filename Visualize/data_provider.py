import os
import sys
import numpy as np
import torch
from utils import *
class DataProvider():
    def __init__(self, config):
        self.config = config
        self.content_path = config.CONTENT_PATH
        sys.path.append(self.content_path) # in order to locate model.py of subject model
        self.device = torch.device("cuda:{}".format(self.config.GPU) if torch.cuda.is_available() else "cpu")
        self.classes = config.CLASSES
        
    def checkpoint_path(self, epoch):
        return os.path.join(self.content_path, 'Model', "Epoch_{}".format(epoch))
    
    ########################################################################################################################
    #                                                       MODEL                                                          #
    ########################################################################################################################
    
    def load_subject_model(self, epoch):
        # definition of subject model
        import Model.model as subject_model
        model = eval("subject_model.{}()".format(self.config.TRAINING['NET']))
        
        # state dict of subject model
        subject_model_location = os.path.join(self.config.checkpoint_path(epoch), "subject_model.pth")
        model.load_state_dict(torch.load(subject_model_location, map_location=torch.device("cpu")))
        model.to(self.device)
        model.eval()
        return model
    
    def load_subject_pred_func(self, epoch):
        subject_model = self.load_subject_model(epoch)
        return subject_model.prediction
    
    def load_data(self):
        dataset_path = os.path.join(self.content_path, "Dataset")
        train_data = torch.load(os.path.join(dataset_path, "training_dataset_data.pth"),map_location="cpu")
        test_data = torch.load(os.path.join(dataset_path, "testing_dataset_data.pth"),map_location="cpu")
        if self.config.SHOW_LABEL:
            train_label = torch.load(os.path.join(dataset_path, "training_dataset_label.pth"),map_location="cpu")
            test_label = torch.load(os.path.join(dataset_path, "testing_dataset_label.pth"),map_location="cpu")
            return train_data, test_data, train_label, test_label
        else:
            return train_data, test_data, None, None
    
    def train_labels(self):
        # load train data
        dataset_path = os.path.join(self.content_path, "Dataset")
        training_data_loc = os.path.join(dataset_path, "training_dataset_label.pth")
        try:
            training_labels = torch.load(training_data_loc, map_location="cpu")
            training_labels = np.array(training_labels)
        except Exception as e:
            print("no train labels saved !")
            training_labels = None
        return training_labels
    
    def test_labels(self):
        dataset_path = os.path.join(self.content_path, "Dataset")
        testing_data_loc = os.path.join(dataset_path, "testing_dataset_label.pth")
        try:
            # avoid index checking for testing data
            testing_labels = torch.load(testing_data_loc, map_location="cpu")
            testing_labels = np.array(testing_labels)
        except Exception as e:
            print("no test labels saved !")
            testing_labels = None
        return testing_labels
    
    def all_labels(self):
        training_labels = self.train_labels()
        testing_labels = self.test_labels()
        
        if training_labels is not None and testing_labels is not None:
            all_labels = np.concatenate((training_labels, testing_labels))
        elif training_labels is not None:
            all_labels = training_labels
        elif testing_labels is not None:
            all_labels = testing_labels
        else:
            all_labels = None
        
        return all_labels
    
    ########################################################################################################################
    #                                                       REPRESENTATION                                                 #
    ########################################################################################################################
    def generate_representation(self):
        training_data, testing_data, training_label, testing_label = self.load_data()
        for n_epoch in range(self.config.EPOCH_START, self.config.EPOCH_END + 1, self.config.EPOCH_PERIOD):
            # load feature function of each epoch
            model = self.load_subject_model(n_epoch)
            feat_func = model.feature
            if self.config.SHOW_LABEL:
                # train data
                train_data_representation = batch_run_feature_extract(feat_func, training_data, device=self.device, desc="feature_extraction: source")
                train_label_representation = batch_run_feature_extract(feat_func, training_label, device=self.device, desc="feature_extraction: target")
                if get_feature_num(train_data_representation) == 1:
                    train_representation = np.stack([train_data_representation,train_label_representation], axis=1)
                else:
                    train_representation = np.concatenate([train_data_representation,train_label_representation],axis=1) # [train_num, data_feature_num+label_feature_num, feature_dim]
                np.save(os.path.join(self.config.checkpoint_path(n_epoch), "train_data_representation.npy"), train_representation)
                # test data
                test_data_representation = batch_run_feature_extract(feat_func, testing_data, device=self.device, desc="feature_extraction: source")
                test_label_representation = batch_run_feature_extract(feat_func, testing_label, device=self.device, desc="feature_extraction: target")
                if get_feature_num(test_data_representation) == 1:
                    test_representation = np.stack([test_data_representation,test_label_representation], axis=1)
                else:
                    test_representation = np.concatenate([test_data_representation,test_label_representation],axis=1)
                np.save(os.path.join(self.config.checkpoint_path(n_epoch), "test_data_representation.npy"), test_representation)
            else:
                # train data
                train_data_representation = batch_run_feature_extract(feat_func, training_data, device=self.device, desc="feature_extraction")
                np.save(os.path.join(self.config.checkpoint_path(n_epoch), "train_data_representation.npy"), train_data_representation)
                # test data
                test_data_representation = batch_run_feature_extract(feat_func, testing_data, device=self.device, desc="feature_extraction")
                np.save(os.path.join(self.config.checkpoint_path(n_epoch), "test_data_representation.npy"), test_data_representation)
    
    def train_representation(self, epoch):
        train_data_loc = os.path.join(self.config.checkpoint_path(epoch), "train_data_representation.npy")
        try:
            train_data = np.load(train_data_loc)
        except Exception as e:
            print("no train data representation saved for Epoch {}".format(epoch))
            train_data = None
        return train_data
    
    def test_representation(self, epoch):
        data_loc = os.path.join(self.config.checkpoint_path(epoch), "test_data_representation.npy")
        try:
            test_data = np.load(data_loc)
        except Exception as e:
            print("no test data representation saved for Epoch {}".format(epoch))
            test_data = None
        return test_data
    
    def all_representation(self, epoch):
        train_data = self.train_representation(epoch)
        test_data = self.test_representation(epoch)
        if test_data is None:
            all_data = train_data
        else:
            all_data = np.concatenate((train_data, test_data), axis=0)
        return all_data
    
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
    
    ########################################################################################################################
    #                                                       PREDICTION                                                     #
    ########################################################################################################################
    def get_pred(self, epoch, data):
        '''
        get the prediction score for data in epoch_id
        :param data: numpy.ndarray
        :param epoch_id:
        :return: pred, numpy.ndarray
        '''
        pred_func = self.load_subject_pred_func(epoch)
        data = torch.from_numpy(data)
        data = data.to(self.device)
        pred = batch_run(pred_func, data, desc="getting prediction")
        return pred