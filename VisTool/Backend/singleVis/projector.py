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
    
class DeepDebuggerProjector(Projector):
    def __init__(self, vis_model, content_path, vis_model_name, segments, device):
        super().__init__(vis_model, content_path, vis_model_name, device)
        self.segments = segments
        self.segments = segments    #[(1,6),(6, 15),(15,42),(42,200)]
        self.current_range = (-1,-1)

    def load(self, iteration):
        # [s,e)
        init_e = self.segments[-1][1]
        if (iteration >= self.current_range[0] and iteration <self.current_range[1]) or (iteration == init_e and self.current_range[1] == init_e):
            print("Same range as current visualization model...")
            return 
        # else
        for i in range(len(self.segments)):
            s = self.segments[i][0]
            e = self.segments[i][1]
            # range [s,e)
            if (iteration >= s and iteration < e) or (iteration == init_e and e == init_e):
                idx = i
                break
        # TODO vis model name as a hyperparameter
        file_path = os.path.join(self.content_path, "Model", "{}_{}.pth".format(self.vis_model_name, idx))
        save_model = torch.load(file_path, map_location="cpu")
        self.vis_model.load_state_dict(save_model["state_dict"])
        self.vis_model.to(self.DEVICE)
        self.vis_model.eval()
        self.current_range = (s, e)
        print("Successfully load the visualization model for range ({},{})...".format(s,e))


class ALProjector(Projector):
    def __init__(self, vis_model, content_path, vis_model_name, device) -> None:
        super().__init__(vis_model, content_path,vis_model_name, device)
        self.current_range = None

    def load(self, iteration):
        file_path=os.path.join(self.content_path, "Model", "Iteration_{}".format(iteration), self.vis_model_name+".pth")

        save_model = torch.load(file_path, map_location=torch.device("cpu"))
        self.vis_model.load_state_dict(save_model["state_dict"])
        self.vis_model.to(self.DEVICE)
        self.vis_model.eval()
        print("Successfully load the visualization model for Iteration {}...".format(iteration))


class DenseALProjector(DeepDebuggerProjector):
    def __init__(self, vis_model, content_path, vis_model_name, device) -> None:
        super().__init__(vis_model, content_path, vis_model_name, None, device)
        self.current_range = [-1,-1,-1] # iteration, e_s, e_e

    def load(self, iteration, epoch):
        # [s,e)
        curr_iteration, curr_s, curr_e = self.current_range
        segment_path = os.path.join(self.content_path, "Model", "Iteration_{}".format(iteration), "segments.json")
        with open(segment_path, "r") as f:
            segments = json.load(f)
        init_e = segments[-1][1]
        # [s,e)
        if iteration == curr_iteration:
            if (curr_e==init_e and epoch == curr_e) or (epoch >= curr_s and epoch < curr_e):
                print("Same range as current visualization model...")
                return
        
        for i in range(len(segments)):
            s = segments[i][0]
            e = segments[i][1]
            # range [s, e)
            if (epoch >= s and epoch < e) or (e == init_e and epoch == e):
                idx = i
                break
        file_path = os.path.join(self.content_path, "Model", "Iteration_{}".format(iteration), "{}_{}.pth".format(self.vis_model_name, idx))
        save_model = torch.load(file_path, map_location=self.DEVICE)
        self.vis_model.load_state_dict(save_model["state_dict"])
        self.vis_model.to(self.DEVICE)
        self.vis_model.eval()
        self.current_range = (iteration, s, e)
        print("Successfully load the visualization model in iteration {} for range ({},{}]...".format(iteration, s,e))
    
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


class EvalProjector(DeepDebuggerProjector):
    def __init__(self, vis_model, content_path, vis_model_name, device, exp) -> None:
        super().__init__(vis_model, content_path, vis_model_name, None, device)
        self.exp = exp
        file_path = os.path.join(content_path, "Model", "{}".format(exp), "segments.json")
        with open(file_path, "r") as f:
            self.segments = json.load(f)
    
    def load(self, iteration):
        # (s, e]
        # (s,e]
        init_s = self.segments[0][0]
        if (iteration > self.current_range[0] and iteration <=self.current_range[1]) or (iteration == init_s and self.current_range[0] == init_s):
            print("Same range as current visualization model...")
            return 
        # else
        for i in range(len(self.segments)):
            s = self.segments[i][0]
            e = self.segments[i][1]
            # range (s,e]
            if (iteration > s and iteration <= e) or (iteration == init_s and s == init_s):
                idx = i
                break
        file_path = os.path.join(self.content_path, "Model", "{}".format(self.exp), "tnn_hybrid_{}.pth".format(idx))
        save_model = torch.load(file_path, map_location="cpu")
        self.vis_model.load_state_dict(save_model["state_dict"])
        self.vis_model.to(self.DEVICE)
        self.vis_model.eval()
        self.current_range = (s, e)
        print("Successfully load the visualization model for range ({},{})...".format(s,e))
        

class DVIProjector(Projector):
    def __init__(self, vis_model, content_path, vis_model_name, device) -> None:
        super().__init__(vis_model, content_path, vis_model_name, device)

    def load(self, iteration):
        file_path = os.path.join(self.content_path, "Model", "Epoch_{}".format(iteration), "{}.pth".format(self.vis_model_name))
        save_model = torch.load(file_path, map_location="cpu")
        self.vis_model.load_state_dict(save_model["state_dict"])
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


import tensorflow as tf
class tfDVIProjector(ProjectorAbstractClass):
    def __init__(self, content_path, flag, verbose=0):
        self.content_path = content_path
        self.model_path = os.path.join(self.content_path, "Model")
        self.flag = flag
        self.curr_iteration = -1
        self.encoder = None
        self.decoder = None
        self.verbose = verbose

    def load(self, epoch):
        if self.curr_iteration == epoch:
            print("Current autocoder model loaded from Epoch {}".format(epoch))
            return
        encoder_location = os.path.join(self.model_path, "Epoch_{:d}".format(epoch),"encoder" + self.flag)
        decoder_location = os.path.join(self.model_path, "Epoch_{:d}".format(epoch),"decoder" + self.flag)
        try:
            self.encoder = tf.keras.models.load_model(encoder_location)
            self.decoder = tf.keras.models.load_model(decoder_location)
            if self.verbose>0:
                print("Keras autocoder model loaded from Epoch {}".format(epoch))
            self.curr_iteration = epoch
        except FileNotFoundError:
            print("Error! Projection function has not been initialized! Pls first visualize all.")

    def batch_project(self, epoch, data):
        '''
        batch project data to 2D space
        :param data: numpy.ndarray
        :param epoch: int
        :return: embedding numpy.ndarray
        '''
        self.load(epoch)
        embedding = self.encoder(data).cpu().numpy()
        return embedding

    def individual_project(self, epoch, data):
        '''
        project a data to 2D space
        :param data: numpy.ndarray
        :param epoch: int
        :return: embedding numpy.ndarray
        '''
        self.load(epoch)
        data = np.expand_dims(data, axis=0)
        embedding = self.encoder(data).cpu().numpy()
        return embedding.squeeze(0)

    def batch_inverse(self, epoch, data):
        """
        map 2D points back into high dimensional space
        :param data: ndarray, (n, 2)
        :param epoch: num of epoch
        :return: high dim representation, numpy.ndarray
        """
        self.load(epoch)
        representation_data = self.decoder(data).cpu().numpy()
        return representation_data

    def individual_inverse(self, epoch, data):
        """
        map a 2D point back into high dimensional space
        :param data: ndarray, (1, 2)
        :param epoch: num of epoch
        :return: high dim representation, numpy.ndarray
        """
        self.load(epoch)
        data = np.expand_dims(data, axis=0)
        representation_data = self.decoder(data).cpu().numpy()
        return representation_data.squeeze(0)


class tfDVIDenseALProjector(ProjectorAbstractClass):
    def __init__(self, content_path, flag, verbose=0):
        self.content_path = content_path
        self.model_path = os.path.join(self.content_path, "Model")
        self.flag = flag
        self.curr_iteration = -1
        self.curr_epoch = -1
        self.encoder = None
        self.decoder = None
        self.verbose = verbose

    def load(self, iteration, epoch):
        if self.curr_iteration == iteration and self.curr_epoch == epoch:
            print("Current autocoder model loaded from Iteration {}/Epoch {}".format(iteration, epoch))
            return
        encoder_location = os.path.join(self.model_path, "Iteration_{:d}".format(iteration), "Epoch_{:d}".format(epoch),"encoder" + self.flag)
        decoder_location = os.path.join(self.model_path, "Iteration_{:d}".format(iteration), "Epoch_{:d}".format(epoch),"decoder" + self.flag)
        try:
            self.encoder = tf.keras.models.load_model(encoder_location)
            self.decoder = tf.keras.models.load_model(decoder_location)
            if self.verbose>0:
                print("Keras autocoder model loaded from Epoch {}".format(epoch))
            self.curr_iteration = iteration
            self.curr_epoch = epoch
        except FileNotFoundError:
            print("Error! Projection function has not been initialized! Pls first visualize all.")

    def batch_project(self, iteration, epoch, data):
        '''
        batch project data to 2D space
        :param data: numpy.ndarray
        :param epoch: int
        :return: embedding numpy.ndarray
        '''
        self.load(iteration, epoch)
        embedding = self.encoder(data).cpu().numpy()
        return embedding

    def individual_project(self, iteration, epoch, data):
        '''
        project a data to 2D space
        :param data: numpy.ndarray
        :param epoch: int
        :return: embedding numpy.ndarray
        '''
        self.load(iteration, epoch)
        data = np.expand_dims(data, axis=0)
        embedding = self.encoder(data).cpu().numpy()
        return embedding.squeeze(0)

    def batch_inverse(self, iteration, epoch, data):
        """
        map 2D points back into high dimensional space
        :param data: ndarray, (n, 2)
        :param epoch: num of epoch
        :return: high dim representation, numpy.ndarray
        """
        self.load(iteration, epoch)
        representation_data = self.decoder(data).cpu().numpy()
        return representation_data

    def individual_inverse(self, iteration, epoch, data):
        """
        map a 2D point back into high dimensional space
        :param data: ndarray, (1, 2)
        :param epoch: num of epoch
        :return: high dim representation, numpy.ndarray
        """
        self.load(iteration, epoch)
        data = np.expand_dims(data, axis=0)
        representation_data = self.decoder(data).cpu().numpy()
        return representation_data.squeeze(0)