import os
import logging
import argparse
from strategy.DVIStrategy import DeepVisualInsight
from config import VisConfig
from data_provider import DataProvider

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s',
                    filename='app.log', filemode='w')

def parse_args():
    parser = argparse.ArgumentParser(description='Time Travelling Visualizer')
    parser.add_argument('--content_path', '-p', type=str, required=True, default='',
                       help='Training dynamic path')
    parser.add_argument('--vis_method', '-v', type=str, default='DVI',
                       help='Visualization method')
    return parser.parse_args()

# ================ pipeline funcs ================
def generate_representation(config):
    dataProvider = DataProvider(config)
    dataProvider.generate_representation()
    logging.info("Representation generation finished")
    
def train_visualize_model(config):
    strategy = DeepVisualInsight(config)
    strategy.train_vis_model()
    logging.info("Visualize model training finished")

def generate_embedding(config):
    pass

def run(args):
    # step 0: initialize config
    config = VisConfig(os.path.join(args.content_path, 'config.json'))
    # step 1: generate high dimention representation
    # generate_representation(config)
    # step 2: train visualize model
    train_visualize_model(config)
    # step 3: use visualize model to get 2-D embedding
    generate_embedding(config)
    

if __name__ == "__main__":
    args = parse_args()
    run(args)