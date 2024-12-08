import os
import logging
import argparse
from visualizer import Visualizer
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
    parser.add_argument('--preprocess', '-pre', type=bool, default=False, 
                       help='whether to get representation first')
    return parser.parse_args()

def init_visualize_component(config):
    dataProvider = DataProvider(config)
    
    if config.VIS_METHOD == "DVI":
        projector = DVIProjector(config)
        visualizer = Visualizer(config, dataProvider, projector)
        strategy = DeepVisualInsight(config)
    elif config.VIS_METHOD == "TimeVis":
        projector = TimeVisProjector(config)
        visualizer = Visualizer(config, dataProvider, projector)
        strategy = TimeVis(config)
    else:
        raise NotImplementedError
    
    return dataProvider, visualizer, strategy


def run(args):
    # step 0: initialize config
    config = VisConfig(os.path.join(args.content_path, 'config.json'))
    dataProvider, visualizer, strategy = init_visualize_component(config)
    
    if args.preprocess:
        # step 1: generate high dimention representation
        dataProvider.generate_representation()
        logging.info("Representation generation finished")
    else:
        logging.info("Already has representation generation")
    
    # # step 2: train visualize model
    strategy.train_vis_model()
    strategy.check_vis_model()
    logging.info("Visualize model training finished")
    
    # step 3: use visualize model to get 2-D embedding
    visualizer.visualize_all_epoch()
    logging.info("Visualization finished")
    

if __name__ == "__main__":
    args = parse_args()
    run(args)