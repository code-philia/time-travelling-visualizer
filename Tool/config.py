from abc import ABC
import json
import os

class Config(ABC):
    def __init__(self, config_file) -> None:
        with open(config_file, 'r') as f:
            config = json.load(f)
        # TODO:KWY check if config is complete
        
        self.__dict__.update(config) # only transformered first layer configs
                                     # use config.VISUALIZATION['BOUNDARY'] to access deeper layer
        

class VisConfig(Config):
    def __init__(self, config_file) -> None:
        super().__init__(config_file)
        self.VIS_MODEL_NAME = "{}_model".format(self.VIS_METHOD)
        self.EVALUATION_NAME = "{}_evaluation".format(self.VIS_METHOD)
        
    def checkpoint_path(self, epoch):
        return os.path.join(self.CONTENT_PATH, 'Model', "Epoch_{}".format(epoch))