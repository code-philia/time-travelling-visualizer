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
    # 2. 为不同方法提供默认的 resolution 字符串
    if 'resolution' not in config['vis_config']:
        if vis_method in ["DVI", "DynaVis"]:
            config['vis_config']['resolution'] = [200,200]
        elif vis_method == "TimeVis":
            config['vis_config']['resolution'] = [300,300]
        else:
            config['vis_config']['resolution'] = [200,200] 
            
    # vis_model dims
    if vis_method == "DVI" or vis_method == "TimeVis" or vis_method == "DynaVis":
        epoch_0 = available_epochs[0]
        embedding_path = os.path.join(content_path, 'epochs', f'epoch_{epoch_0}', 'embeddings.npy')
        embedding = np.load(embedding_path)
        encoder_dims, decoder_dims = generate_dimension_array(embedding.shape[1])
        config['vis_config']['dimension'] = embedding.shape[1]
        config['vis_config']['encoder_dims'] = encoder_dims
        config['vis_config']['decoder_dims'] = decoder_dims
        
        # resolution_str = config['vis_config']['resolution']
        # r = resolution_str.split(",")
        # config['vis_config']['resolution'] = [int(i) for i in r]
    
    return config

def init_visualize_component(config):
    import torch
    from visualize.strategy.projector import DVIProjector, TimeVisProjector, UmapProjector, DynaVisProjector
    from visualize.strategy.dvi_strategy import DeepVisualInsight
    from visualize.strategy.timevis_strategy import TimeVis
    # [修改点 1]：删除不存在的 dynavis_strategy 导入，改为导入 Runner
    from visualize.dynavis.runner import DynaVisRunner
    from visualize.data_provider import DataProvider
    from visualize.result_generator import ResultGenerator, UmapResultGenerator
    # 做一些操作
    if 'gpu_id' not in config['vis_config']:
        config['vis_config']['gpu_id'] = -1
    if  config['vis_config']['gpu_id'] == -1:    
        device = torch.device("cpu")
    else:
        device = torch.device("cuda:{}".format(config['vis_config']['gpu_id']) if torch.cuda.is_available() else "cpu")
    
    if config.get('vis_method') == "TimeVis":
        # 确保 vis_config 字典存在
        if 'vis_config' not in config:
            config['vis_config'] = {}
        
        # 补全 TimeVis 强依赖的参数
        if 'lambda' not in config['vis_config']:
            config['vis_config']['lambda'] = 1.0
            
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
        # [修改点 2]：重写 DynaVis 分支逻辑
        if 'selected_idxs' in config['vis_config']:
            selected_idxs = config['vis_config']['selected_idxs']
        else:
            # 默认值逻辑保持不变
            selected_idxs = list(range(100))
        
        # DynaVis 通常需要自己的数据提供者和投影器
        data_provider = DataProvider(config, device)   
        projector = DynaVisProjector(config)
        visualizer = ResultGenerator(config, data_provider, projector)
      
        from visualize.dynavis.runner import DynaVisRunner
        runner = DynaVisRunner( config["content_path"], config["vis_id"], config["data_type"], config["task_type"], config["vis_config"])
        strategy = runner
        
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

    visualizer, strategy = init_visualize_component(config)

    if vis_method == "DynaVis":
        runner = strategy
        runner.run()
        
    else:
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
    os.makedirs(os.path.join(content_path, 'visualize', f"{vis_method}_{vis_id}"), exist_ok=True)


    json.dump(config, open(os.path.join(content_path, 'visualize', vis_id, 'info.json'), 'w'), indent=2)
    return visualizer, strategy 
        