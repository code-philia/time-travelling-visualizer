import os
import json
import numpy as np

from server_utils import generate_dimension_array

# logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s',
#                     filename='app.log', filemode='w')

def initialize_config(content_path, vis_method, vis_id, data_type, task_type, vis_config):
    config = {}
    config["content_path"] = content_path
    config["vis_method"] = vis_method
    config["vis_id"] = vis_id
    config["data_type"] = data_type
    config["task_type"] = task_type
    config["vis_config"] = vis_config
    
    with open(os.path.join(content_path, 'dataset', 'info.json')) as f:
        dataset_info = json.load(f)
    config["classes"] = dataset_info['classes']
    config["model"] = dataset_info['model']
    
    # available epochs
    epochs_dir = os.path.join(content_path, 'epochs')
    available_epochs = []
    if os.path.exists(epochs_dir) and os.path.isdir(epochs_dir):
        for folder_name in os.listdir(epochs_dir):
            if folder_name.startswith("epoch_"):
                try:
                    k = int(folder_name.split("_")[1])
                    available_epochs.append(k)
                except ValueError:
                    print(f"Invalid epoch folder name: {folder_name}")
    
    available_epochs.sort()
    config["available_epochs"] = available_epochs
    
    # vis_model dims
    if vis_method == "DVI" or vis_method == "TimeVis" or vis_method == "DynaVis":
        epoch_0 = available_epochs[0]
        embedding_path = os.path.join(content_path, 'epochs', f'epoch_{epoch_0}', 'embeddings.npy')
        embedding = np.load(embedding_path)
        encoder_dims, decoder_dims = generate_dimension_array(embedding.shape[1])
        config['vis_config']['dimension'] = embedding.shape[1]
        config['vis_config']['encoder_dims'] = encoder_dims
        config['vis_config']['decoder_dims'] = decoder_dims
        
        resolution_str = config['vis_config']['resolution']
        r = resolution_str.split(",")
        config['vis_config']['resolution'] = [int(i) for i in r]
    
    return config

def init_visualize_component(config):
    import torch
    from visualize.strategy.projector import DVIProjector, TimeVisProjector, UmapProjector, DynaVisProjector
    from visualize.strategy.dvi_strategy import DeepVisualInsight
    from visualize.strategy.timevis_strategy import TimeVis
    from visualize.strategy.dynavis_strategy import DynaVis
    from visualize.data_provider import DataProvider
    from visualize.result_generator import ResultGenerator, UmapResultGenerator
    
    if 'gpu_id' not in config['vis_config'] or config['vis_config']['gpu_id'] == -1:
        device = torch.device("cpu")
    else:
        device = torch.device("cuda:{}".format(config['vis_config']['gpu_id']) if torch.cuda.is_available() else "cpu")
    
    if config['vis_method'] == "DVI":
        data_provider = DataProvider(config, device)  
        projector = DVIProjector(config)
        visualizer = ResultGenerator(config, data_provider, projector)
        strategy = DeepVisualInsight(config, data_provider)
    elif config['vis_method'] == "TimeVis":
        data_provider = DataProvider(config, device)  
        projector = TimeVisProjector(config)
        visualizer = ResultGenerator(config, data_provider, projector)
        strategy = TimeVis(config, data_provider)
    elif config['vis_method'] == "DynaVis":
        if 'selected_idxs' in config['vis_config']:
            selected_idxs = config['vis_config']['selected_idxs']
        else:
            selected_idxs = list(range(100))
        data_provider = DataProvider(config, device, selected_idxs)
        data_provider = DataProvider(config, device)  
        projector = DynaVisProjector(config)
        visualizer = ResultGenerator(config, data_provider, projector)
        strategy = DynaVis(config, data_provider, selected_idxs)
    elif config['vis_method'] == "UMAP":
        data_provider = DataProvider(config, device)  
        projector = UmapProjector(config)
        visualizer = UmapResultGenerator(config, data_provider, projector)
        strategy = None
    else:
        raise NotImplementedError
    
    return visualizer, strategy

def visualize_run(content_path, vis_method, vis_id, data_type, task_type, vis_config):
    # step 1: initialize config
    config = initialize_config(content_path, vis_method, vis_id, data_type, task_type, vis_config)

    if vis_method == "DynaVis":
        from visualize.dynavis.runner import DynaVisRunner
        runner = DynaVisRunner(content_path, vis_id, data_type, task_type, vis_config)
        runner.run()
    else:
        # step 2: initialize data provider, visualizer, and strategy
        visualizer, strategy = init_visualize_component(config)
        
        # step 3: generate visualization results
        if vis_method == "DVI" or vis_method == "TimeVis":
            # now we assume that all the metries are already saved to train visualization model
            # 3.1 trian visualization model
            print("Start training visualization model...")
            strategy.train_vis_model()
            print("Train visualization model finished.")
            
        # 3.2 generate visualization results
        print("Start generating visualization results...")
        visualizer.visualize_all_epochs()
        print("Generate visualization results finished, visualization process completed successfully!")
        
        # step 4: save config
        os.makedirs(os.path.join(content_path, 'visualize', vis_id), exist_ok=True)
        
    json.dump(config, open(os.path.join(content_path, 'visualize', vis_id, 'info.json'), 'w'), indent=2)
        