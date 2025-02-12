import json
import os
import logging
import argparse

import torch
from result_generator import ResultGenerator
from strategy.projector import DVIProjector, TimeVisProjector
from strategy.DVIStrategy import DeepVisualInsight
from strategy.TimeVisStrategy import TimeVis
from config import VisConfig
from data_provider import DataProvider

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s',
                    filename='app.log', filemode='w')

def parse_args():
    parser = argparse.ArgumentParser(description='Time Travelling Visualizer')
    parser.add_argument('--content_path', '-p', type=str, required=True, default='',
                       help='Training dynamic path')
    parser.add_argument('--vis_method', '-m', type=str, required=False, default='DVI',
                       help='Visualization method')
    parser.add_argument('--preprocess', '-pre', type=bool, default=False, 
                       help='whether to get representation first')
    return parser.parse_args()

def init_visualize_component(config, params):
    device = torch.device("cuda:{}".format(config['gpu']) if torch.cuda.is_available() else "cpu")
    dataProvider = DataProvider(config, device)
    
    if config['visMethod'] == "DVI":
        projector = DVIProjector(config, params)
        visualizer = ResultGenerator(config, dataProvider, projector)
        strategy = DeepVisualInsight(config, params)
    elif config['visMethod'] == "TimeVis":
        projector = TimeVisProjector(config, params)
        visualizer = ResultGenerator(config, dataProvider, projector)
        strategy = TimeVis(config, params)
    else:
        raise NotImplementedError
    
    return dataProvider, visualizer, strategy


def run(args):
    # step 0: initialize config
    # these are the common config from frontend
    with open(os.path.join(args.content_path,'config.json'), 'r') as f:
        dataset_config = json.load(f)
    
    config = {}
    config["contentPath"] = args.content_path
    config["visMethod"] = args.vis_method
    config["taskType"] = dataset_config['dataset']['taskType']
    config["classes"] = dataset_config['dataset']['classes']
    
    # TODO: where to get these parameters ?
    config["epochStart"] = 1
    config["epochEnd"] = 1
    config["epochPeriod"] = 1
    config["net"] = "ResNet34"  # 模型定义的类，我们需要通过该名称创建原始模型实例， 如：subject_model = ResNet34()
    config["gpu"] = 2           # gpu 编号，只用一个
    config["resolution"] = 300
    
    # these are the parameters for training visualize model, read from single config file
    with open('./params.json', 'r') as f:
        all_params = json.load(f)
    params = all_params[config["visMethod"]]
    
    dataProvider, visualizer, strategy = init_visualize_component(config, params)
    
    if args.preprocess:
        # step 1: generate high dimention representation
        dataProvider.generate_representation()
        logging.info("Representation generation finished")
    else:
        logging.info("Already has representation generation")
    
    # # step 2: train visualize model
    strategy.train_vis_model()
    logging.info("Visualize model training finished")
    
    # step 3: use visualize model to get 2-D embedding
    visualizer.visualize_all_epoch()
    logging.info("Visualization finished")
    

if __name__ == "__main__":
    args = parse_args()
    run(args)