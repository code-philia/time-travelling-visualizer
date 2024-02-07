"""The Projector class for visualization, serve as a helper module for evaluator and visualizer"""
from abc import ABC, abstractmethod
import os
import json
import numpy as np
import torch

class ProjectorAbstractClass(ABC):

    @abstractmethod
    def __init__(self, vis_model, content_path, *args, **kwargs):
        pass

    @abstractmethod
    def load(self, *args, **kwargs):
        pass

    @abstractmethod
    def batch_project(self, *args, **kwargs):
        pass

    @abstractmethod
    def individual_project(self, *args, **kwargs):
        pass

    @abstractmethod
    def batch_inverse(self, *args, **kwargs):
        pass

    @abstractmethod
    def individual_inverse(self, *args, **kwargs):
        pass

class Projector(ProjectorAbstractClass):
    def __init__(self, vis_model, content_path, vis_model_name, device):
        self.vis_model = vis_model
        self.content_path = content_path
        self.vis_model_name = vis_model_name
        self.DEVICE = device
    
    def load(self, iteration):
        raise NotImplementedError
    
    def batch_project(self, iteration, data):
        self.load(iteration)
        embedding = self.vis_model.encoder(torch.from_numpy(data).to(dtype=torch.float32, device=self.DEVICE)).cpu().detach().numpy()
        return embedding
    
    def individual_project(self, iteration, data):
        self.load(iteration)
        embedding = self.vis_model.encoder(torch.from_numpy(np.expand_dims(data, axis=0)).to(dtype=torch.float32, device=self.DEVICE)).cpu().detach().numpy()
        return embedding.squeeze(axis=0)
    
    def batch_inverse(self, iteration, embedding):
        self.load(iteration)
        data = self.vis_model.decoder(torch.from_numpy(embedding).to(dtype=torch.float32, device=self.DEVICE)).cpu().detach().numpy()
        return data
    
    def individual_inverse(self, iteration, embedding):
        self.load(iteration)
        data = self.vis_model.decoder(torch.from_numpy(np.expand_dims(embedding, axis=0)).to(dtype=torch.float32, device="cpu")).cpu().detach().numpy()
        return data.squeeze(axis=0)
 

class VISProjector(Projector):
    def __init__(self, vis_model, content_path, vis_model_name, device) -> None:
        super().__init__(vis_model, content_path, vis_model_name, device)

    def load(self, iteration):
        file_path = os.path.join(self.content_path, "Model", "Epoch_{}".format(iteration), "{}.pth".format(self.vis_model_name))
        save_model = torch.load(file_path, map_location="cpu")
        self.vis_model.load_state_dict(save_model["state_dict"])
        self.vis_model.to(self.DEVICE)
        self.vis_model.eval()
        print("Successfully load the DVI visualization model for iteration {}".format(iteration))

class PROCESSProjector(Projector):
    """
    for the prcessing model
    """
    def __init__(self, vis_model, content_path, vis_model_name,device) -> None:
        super().__init__(vis_model, content_path, vis_model_name, device)

    def load(self, iteration):
        self.vis_model.to(self.DEVICE)
        self.vis_model.eval()
        print("Successfully load the DVI visualization model for iteration {}".format(iteration))


class TimeVisProjector(Projector):
    def __init__(self, vis_model, content_path, vis_model_name, device, verbose=0) -> None:
        super().__init__(vis_model, content_path, vis_model_name, device)
        self.verbose = verbose

    def load(self, iteration):
        file_path = os.path.join(self.content_path, "Model", "{}.pth".format(self.vis_model_name))
        save_model = torch.load(file_path, map_location="cpu")
        self.vis_model.load_state_dict(save_model["state_dict"])
        self.vis_model.to(self.DEVICE)
        self.vis_model.eval()
        if self.verbose>0:
            print("Successfully load the TimeVis visualization model for iteration {}".format(iteration))


class TimeVisDenseALProjector(Projector):
    def __init__(self, vis_model, content_path, vis_model_name, device, verbose=0) -> None:
        super().__init__(vis_model, content_path, vis_model_name, device)
        self.verbose = verbose
        self.curr_iteration = -1

    def load(self, iteration, epoch):
        if iteration == self.curr_iteration:
            return
        file_path = os.path.join(self.content_path, "Model", f'Iteration_{iteration}', "{}.pth".format(self.vis_model_name))
        save_model = torch.load(file_path, map_location="cpu")
        self.vis_model.load_state_dict(save_model["state_dict"])
        self.vis_model.to(self.DEVICE)
        self.vis_model.eval()
        if self.verbose>0:
            print("Successfully load the TimeVis visualization model for iteration {}".format(iteration))
        self.curr_iteration = iteration
        
    
    def batch_project(self, iteration, epoch, data):
        self.load(iteration, epoch)
        embedding = self.vis_model.encoder(torch.from_numpy(data).to(dtype=torch.float32, device=self.DEVICE)).cpu().detach().numpy()
        return embedding
    
    def individual_project(self, iteration, epoch, data):
        self.load(iteration, epoch)
        embedding = self.vis_model.encoder(torch.from_numpy(np.expand_dims(data, axis=0)).to(dtype=torch.float32, device=self.DEVICE)).cpu().detach().numpy()
        return embedding.squeeze(axis=0)
    
    def batch_inverse(self, iteration, epoch, embedding):
        self.load(iteration, epoch)
        data = self.vis_model.decoder(torch.from_numpy(embedding).to(dtype=torch.float32, device=self.DEVICE)).cpu().detach().numpy()
        return data
    
    def individual_inverse(self, iteration, epoch, embedding):
        self.load(iteration, epoch)
        data = self.vis_model.decoder(torch.from_numpy(np.expand_dims(embedding, axis=0)).to(dtype=torch.float32, device=self.DEVICE)).cpu().detach().numpy()
        return data.squeeze(axis=0)

