import json
import os
import sys
import numpy as np
import torch
from utils import *
class DataProvider():
    def __init__(self, config, device = None):
        self.config = config
        self.content_path = config['contentPath']
        sys.path.append(self.content_path) # in order to locate model.py of subject model
        if device is not None:
            self.device = device
        else:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")        
    def checkpoint_path(self, epoch):
        return os.path.join(self.content_path, 'Model', "Epoch_{}".format(epoch))
    

    ########################################################################################################################
    #                                                       MODEL                                                          #
    ########################################################################################################################
    def load_subject_model(self, epoch):
        # definition of subject model, copied to content_path/model.py
        import model as subject_model
        model = eval("subject_model.{}()".format(self.config['net']))
        
        # state dict of subject model
        subject_model_location = os.path.join(self.config["contentPath"],"model", f"{epoch}.pth")
        model.load_state_dict(torch.load(subject_model_location, map_location=torch.device("cpu")))
        model.to(self.device)
        model.eval()
        return model
    
    def load_subject_feat_func(self, epoch):
        subject_model = self.load_subject_model(epoch)
        return subject_model.feature

    def load_subject_pred_func(self, epoch):
        subject_model = self.load_subject_model(epoch)
        return subject_model.prediction
    
    # Not used, we assume the high dimension representation is already saved during training subject model
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
    
    # Save train and test labels together, distinguished by index
    def all_labels(self):
        dataset_path = os.path.join(self.content_path, "dataset")
        label_loc = os.path.join(dataset_path, "label", "labels.npy")
        try:
            labels = np.load(label_loc, allow_pickle=True)
        except Exception as e:
            print("no train labels saved !")
            labels = None
        return labels
    
    def train_labels(self):
        all_labels = self.all_labels()        
        index_file_path = os.path.join(self.config["contentPath"],"index.json")
        with open(index_file_path, "r") as f:
            index_dict = json.load(f)
        
        train_index = index_dict["train"]
        train_labels = [all_labels[i] for i in train_index]
        return train_labels
    
    def test_labels(self):
        all_labels = self.all_labels()        
        index_file_path = os.path.join(self.config["contentPath"],"index.json")
        with open(index_file_path, "r") as f:
            index_dict = json.load(f)
        
        test_index = index_dict["test"]
        test_labels = [all_labels[i] for i in test_index]
        return test_labels
    
    ########################################################################################################################
    #                                                       REPRESENTATION                                                 #
    ########################################################################################################################
    # Not used, we assume the high dimension representation is already saved during training subject model
    def generate_representation(self):
        training_data, testing_data, training_label, testing_label = self.load_data()
        for n_epoch in range(self.config["epochStart"], self.config["epochEnd"] + 1, self.config["epochPeriod"]):
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
                np.save(os.path.join(self.config["contentPath"],"Model",f"Epoch_{n_epoch}", "train_data_representation.npy"), train_representation)
                # test data
                test_data_representation = batch_run_feature_extract(feat_func, testing_data, device=self.device, desc="feature_extraction: source")
                test_label_representation = batch_run_feature_extract(feat_func, testing_label, device=self.device, desc="feature_extraction: target")
                if get_feature_num(test_data_representation) == 1:
                    test_representation = np.stack([test_data_representation,test_label_representation], axis=1)
                else:
                    test_representation = np.concatenate([test_data_representation,test_label_representation],axis=1)
                np.save(os.path.join(self.config["contentPath"],"Model",f"Epoch_{n_epoch}", "test_data_representation.npy"), test_representation)
            else:
                # train data
                train_data_representation = batch_run_feature_extract(feat_func, training_data, device=self.device, desc="feature_extraction")
                np.save(os.path.join(self.config["contentPath"],"Model",f"Epoch_{n_epoch}", "train_data_representation.npy"), train_data_representation)
                # test data
                test_data_representation = batch_run_feature_extract(feat_func, testing_data, device=self.device, desc="feature_extraction")
                np.save(os.path.join(self.config["contentPath"],"Model",f"Epoch_{n_epoch}", "test_data_representation.npy"), test_data_representation)
    
    # Save train and test data representation together, distinguished by index
    def all_representation(self, epoch):
        representation_loc = os.path.join(self.config["contentPath"],"dataset","representation",f"{epoch}.npy")
        try:
            train_data = np.load(representation_loc)
        except Exception as e:
            print("no train data representation saved for Epoch {}".format(epoch))
            train_data = None
        return train_data
    
    def train_representation(self, epoch):
        all_representation = self.all_representation(epoch)
        index_file_path = os.path.join(self.config["contentPath"],"index.json")
        with open(index_file_path, "r") as f:
            index_dict = json.load(f)
        
        train_index = index_dict["train"]
        train_representations = [all_representation[i] for i in train_index]
        return train_representations
    
    def test_representation(self, epoch):
        all_representation = self.all_representation(epoch)
        index_file_path = os.path.join(self.config["contentPath"],"index.json")
        with open(index_file_path, "r") as f:
            index_dict = json.load(f)
        
        test_index = index_dict["test"]
        test_representations = [all_representation[i] for i in test_index]        
        return test_representations
    
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
