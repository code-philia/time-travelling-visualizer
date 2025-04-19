from abc import ABC, abstractmethod
import json
import os

import torch

class StrategyAbstractClass(ABC):
    def __init__(self, config):
        self.config = config

    @abstractmethod
    def initialize_model(self):
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
        os.makedirs(os.path.join(self.config["content_path"],"visualize", self.config["vis_method"], "epochs", f"epoch_{epoch}"), exist_ok=True)
        torch.save(save_model, os.path.join(self.config["content_path"],"visualize", self.config["vis_method"], "epochs", f"epoch_{epoch}", "vis_model.pth"))