from abc import ABC, abstractmethod
import os

import torch

class StrategyAbstractClass(ABC):
    def __init__(self, config):
        self.config = config
        self.initial_model()

    @abstractmethod
    def initial_model(self):
        # define your visualize model here
        # e.g. self.model = tfModel(...)
        pass

    @abstractmethod
    def train_vis_model(self):
        # train your visualize model here
        # save your model using self.save_vis_model(model, epoch) for each epoch
        # e.g.
        # for epoch in range(self.config.EPOCH_START, self.config.EPOCH_END + 1, self.config.EPOCH_PERIOD):
        #      train_model(self.model)
        #      self.save_vis_model(self.model, epoch)
        pass
    
    def save_vis_model(self, model, epoch, loss = None, optimizer = None):
        save_model = {
            "loss": loss,
            "state_dict": model.state_dict(),
            "optimizer": optimizer.state_dict()
        }
        torch.save(save_model, os.path.join(self.config.checkpoint_path(epoch), self.config.VIS_MODEL_NAME+".pth"))

    def check_vis_model(self):
        for epoch in range(self.config.EPOCH_START, self.config.EPOCH_END + 1, self.config.EPOCH_PERIOD):
            model_path = os.path.join(self.config.checkpoint_path(epoch), self.config.VIS_MODEL_NAME+".pth")
            if not os.path.isfile(model_path):
                raise FileExistsError("Visualization model not found at {}".format(model_path))