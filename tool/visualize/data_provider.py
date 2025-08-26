import json
import os
import sys
import numpy as np
import torch
from utils import *

def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - x.max(axis=-1, keepdims=True))
    return e / e.sum(axis=-1, keepdims=True)

class DataProvider():
    def __init__(self, config, device = None, selected_idxs=None):
        self.config = config
        self.selected_idxs = selected_idxs
        sys.path.append(self.config["content_path"]) # in order to locate model.py of subject model
        if device is not None:
            self.device = device
        else:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            
        index_file_path = os.path.join(self.config["content_path"],"dataset","index.json")
        if not os.path.exists(index_file_path):
            self.index_dict = None
        else:
            with open(index_file_path, "r") as f:
                self.index_dict = json.load(f)

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
            if self.index_dict is None:
                return all_labels
            index = []
            if type == "all":
                for key in self.index_dict.keys():
                    index.extend(self.index_dict[key])
            else:
                if type in self.index_dict.keys():
                    index = self.index_dict[type]
            return all_labels[index]
        except Exception as e:
            print("no train labels saved !")
            return None
    
    def get_label_dict(self):
        info_data = json.load(open(os.path.join(self.config["content_path"], "dataset", "info.json"), "r"))
        class_list = info_data.get("classes", [])
        label_dict = {}
        for i, cls in enumerate(class_list):
            label_dict[i] = cls
        return label_dict
    
    ########################################################################################################################
    #                                                       REPRESENTATION                                                 #
    ########################################################################################################################    
    # Save train and test data representation together, distinguished by index
    def get_representation(self, epoch, type="all"):
        representation_loc = os.path.join(self.config["content_path"],"epochs",f"epoch_{epoch}","embeddings.npy")
        try:
            all_representation = np.load(representation_loc)
            
            if self.index_dict is None:
                return all_representation
            
            index = []
            if type == "all":
                for key in self.index_dict.keys():
                    index.extend(self.index_dict[key])
            else:
                if type in self.index_dict.keys():
                    index = self.index_dict[type]
                    
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

    def _get_prediction_scores(self, epoch, type="all"):
        pred_loc = os.path.join(self.config["content_path"],"epochs",f"epoch_{epoch}","predictions.npy")
        try:
            all_pred = np.load(pred_loc)
            
            if self.index_dict is None:
                return all_pred
                
            index = []
            if type == "all":
                for key in self.index_dict.keys():
                    index.extend(self.index_dict[key])
            else:
                if type in self.index_dict.keys():
                    index = self.index_dict[type]
            return all_pred[index]
        except Exception as e:
            print(e)
            return None
            
        
    def get_probability(self, epoch, type="all"):
        prediction_scores = self._get_prediction_scores(epoch, type)
        if prediction_scores is None:
            return None
        return _softmax(prediction_scores)
    
    def get_prediction(self, epoch, type="all"):
        prediction_scores = self._get_prediction_scores(epoch, type)
        if prediction_scores is None:
            return None
        return np.argmax(prediction_scores, axis=1)

    def get_available_epochs(self):
        epochs_dir = os.path.join(self.config["content_path"], 'epochs')
        available_epochs = []
        if os.path.exists(epochs_dir) and os.path.isdir(epochs_dir):
            for folder_name in os.listdir(epochs_dir):
                if folder_name.startswith("epoch_"):
                    try:
                        k = int(folder_name.split("_")[1])
                        available_epochs.append(k)
                    except ValueError:
                        print(f"Invalid epoch folder name: {folder_name}")
        
        available_epochs.sort()
        return available_epochs
    
    def get_expected_alignment(self):
        alignment_path = os.path.join(self.config["content_path"], "dataset", "align.json")
        if os.path.exists(alignment_path):
            json_data = json.load(open(alignment_path, "r"))
            return json_data['ground_truth_pairs']
        else:
            return []