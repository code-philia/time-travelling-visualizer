from abc import ABC, abstractmethod

class StrategyAbstractClass(ABC):
    def __init__(self, config):
        self.config = config

    @abstractmethod
    def train_vis_model(self):
        pass
