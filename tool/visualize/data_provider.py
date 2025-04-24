import json
import os
import sys
import numpy as np
import torch
from utils import *
class DataProvider():
    def __init__(self, config, device = None, selected_idxs=None):
        self.config = config
        self.selected_idxs = selected_idxs
        sys.path.append(self.config["content_path"]) # in order to locate model.py of subject model
        if device is not None:
            self.device = device
        else:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")        

    ########################################################################################################################
    #                                                       MODEL                                                          #
    ########################################################################################################################
    def load_subject_model(self, epoch):
        # definition of subject model, copied to content_path/scripts/model.py
        import scripts.model as subject_model
        model = eval("subject_model.{}()".format(self.config['model']))
        
        # state dict of subject model
        subject_model_location = os.path.join(self.config["content_path"],"epochs", f"epoch_{epoch}", "model.pth")
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
    
    # Save train and test labels together, distinguished by index
    def get_labels(self, type="all"):
        label_loc = os.path.join(self.config["content_path"], "dataset", "labels.npy")
        try:
            all_labels = np.load(label_loc, allow_pickle=True)
            if type == "all":
                return all_labels
            
            index_file_path = os.path.join(self.config["content_path"], "dataset", "index.json")
            if not os.path.exists(index_file_path):
                return all_labels
            
            with open(index_file_path, "r") as f:
                index_dict = json.load(f)
                
            if type not in index_dict.keys():
                return all_labels
            
            index = index_dict[type]
            return all_labels[index]
            
        except Exception as e:
            print("no train labels saved !")
            return None
    
    ########################################################################################################################
    #                                                       REPRESENTATION                                                 #
    ########################################################################################################################    
    # Save train and test data representation together, distinguished by index
    def get_representation(self, epoch, type="all", select_sample=None):
        if select_sample is not None:
            select_idx = select_sample
        else:
            select_idx = self.selected_idxs
        
        representation_loc = os.path.join(self.config["content_path"],"epochs",f"epoch_{epoch}","embeddings.npy")
        try:
            all_representation = np.load(representation_loc)
            
            if type == "all":
                return all_representation
            
            index_file_path = os.path.join(self.config["content_path"],"dataset","index.json")
            if not os.path.exists(index_file_path):
                return all_representation
            
            with open(index_file_path, "r") as f:
                index_dict = json.load(f)
            
            if type not in index_dict.keys():
                return all_representation
            
            index = index_dict[type]
            
            if select_idx is not None:
                index = [i for i in index if i in select_idx]
            
            return all_representation[index]
                
        except Exception as e:
            print(e)
            return None
                
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

    def get_available_epochs(self):
        return self.config["available_epochs"]