import json
import logging
import os

import torch

from data_provider import DataProvider
from result_generator import ResultGenerator
from strategy.DVIStrategy import DeepVisualInsight
from strategy.TimeVisStrategy import TimeVis
from strategy.projector import DVIProjector, TimeVisProjector

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s',
                    filename='app.log', filemode='w')

# ---------------------
# Visualizer:
# main class of visualizer
# using subject model and representation to generate visualizations
# ---------------------
class Visualizer(object):
    def __init__(self, config, content_path, vis_method, preprocess = False):
        self.config = {}
        self.config['contentPath'] = content_path
        self.config['visMethod'] = vis_method
        self.config["taskType"] = config['dataset']['taskType']
        self.config["classes"] = config['dataset']['classes']
        
        # TODO: where to get these config
        self.config["epochStart"] = 1
        self.config["epochEnd"] = 2
        self.config["epochPeriod"] = 1
        self.config["net"] = "ResNet34"
        self.config["gpu"] = 2
        self.config["resolution"] = 300
        
        # params of training 
        with open('params.json', 'r') as f:
            all_params = json.load(f)
        self.params = all_params[vis_method]
        
        # whether need to generate high dimension representation
        self.preprocess = preprocess
        
            
    def init_visualize_component(self):
        self.device = torch.device("cuda:{}".format(self.config['gpu']) if torch.cuda.is_available() else "cpu")
        self.dataProvider = DataProvider(self.config, self.device)
        
        if self.config['visMethod'] == "DVI":
            self.projector = DVIProjector(self.config, self.params)
            self.visualizer = ResultGenerator(self.config, self.dataProvider, self.projector)
            self.strategy = DeepVisualInsight(self.config, self.params)
        elif self.config['visMethod'] == "TimeVis":
            self.projector = TimeVisProjector(self.config, self.params)
            self.visualizer = ResultGenerator(self.config, self.dataProvider, self.projector)
            self.strategy = TimeVis(self.config, self.params)
        else:
            raise NotImplementedError
    
    def visualize(self):
        self.init_visualize_component()
        
        if self.preprocess:
            # step 1: generate high dimention representation
            self.dataProvider.generate_representation()
            logging.info("Representation generation finished")
        else:
            logging.info("Already has representation generation")
        
        # # step 2: train visualize model
        logging.infoint("Training visualize model...")
        self.strategy.train_vis_model()
        logging.info("Visualize model training finished")
        
        # step 3: use visualize model to get 2-D embedding
        logging.info("Visualization...")
        self.visualizer.visualize_all_epoch()
        logging.info("Visualization finished")
        
        return 'success'
        