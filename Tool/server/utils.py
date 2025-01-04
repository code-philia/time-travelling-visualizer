import os
import json
from secrets import token_urlsafe
import time
import csv
import numpy as np
import sys
import base64

vis_path = "../.."
sys.path.append(vis_path)
# from context import VisContext, ActiveLearningContext, AnormalyContext
# from strategy import DeepDebugger, TimeVis, tfDeepVisualInsight, DVIAL, tfDVIDenseAL, TimeVisDenseAL, Trustvis, DeepVisualInsight
# from singleVis.eval.evaluate import rank_similarities_and_color, evaluate_isAlign, evaluate_isNearestNeighbour, evaluate_isAlign_single, evaluate_isNearestNeighbour_single
from sklearn.cluster import KMeans
from scipy.special import softmax
import matplotlib.pyplot as plt
import torch
from typing import List

from config import VisConfig
from Visualize.data_provider import DataProvider

"""Utils of new data schema"""
# Func: infer available epochs through projection files, return a list of available epochs
# TODO other methods to infer epoch structure
def epoch_structure_from_projection(content_path):
    visMethods = ['DVI', 'TimeVis']
    for visMethod in visMethods:
        projection_folder = os.path.join(content_path, "visualize", visMethod, "projection")
        if not os.path.exists(projection_folder):
            continue
        
        files = os.listdir(projection_folder)
        
        file_numbers = [int(file.rstrip('.npy')) for file in files if file.endswith('.npy')]
        file_numbers = sorted(file_numbers)
        if file_numbers != []:
            return file_numbers, ''
        
    return None, "No projection files found, can't infer epoch structure"

# Func: load projection and label list (minimum requirement for 'update_projection')
def load_projection(config, content_path, vis_method, epoch):
    # here we only have one kind of projection for each vis method, so we directly locate them in 'projection' folder
    # in the future, maybe projection is also a kind of 'attribute' and need to be pointed out in the config.json
    projection_path = os.path.join(content_path, "visualize", vis_method, "projection", f"{epoch}.npy")
    projection = np.load(projection_path)
    projection_list = projection.tolist()
    
    # load label list for samples in projection
    attributes = config['dataset']['attributes']
    if 'label' not in attributes:
        raise NotImplementedError("label is not in attributes")
    
    file_path_pattern = attributes['label']['source']['pattern']
    file_path = os.path.join(content_path, file_path_pattern)
    label_list = read_label_file(file_path)

    return projection_list, label_list

# Func: load background image
def load_background_image_base64(config, content_path, vis_method, epoch):
    bgimg_path = os.path.join(content_path, "visualize", vis_method, "bgimg", f"{epoch}.png")
    with open(bgimg_path, 'rb') as img_f:
        img_stream = img_f.read()
        img_stream = base64.b64encode(img_stream).decode()
    
    return 'data:image/png;base64,' + img_stream

# Func: load one sample from content_path
def load_one_sample(config, content_path, index):
    attributes = config['dataset']['attributes']
    if 'sample' not in attributes:
        raise NotImplementedError("sample is not in attributes")
    
    file_path_pattern = attributes['sample']['source']['pattern']
    file_path = file_path_pattern.replace('${index}', str(index))
    file_path = os.path.join(content_path, file_path)
    
    _, file_extension = os.path.splitext(file_path)
    if file_extension == '.txt':
        sample = ""
        single_file = attributes['sample']['source']['type']=='folder'
        if single_file: # this indicates that all the text samples are saved in one file
            with open(file_path, 'r') as f:
                all_sample = f.readlines()
                sample = all_sample[index]
        else:
            with open(file_path, 'r') as f:
                sample = f.readline()
        return 'text',sample
        
    elif file_extension == '.png' or file_extension == '.jpg':
        img_stream = ""
        with open(file_path, 'rb') as img_f:
            img_stream = img_f.read()
            img_stream = base64.b64encode(img_stream).decode()
        return 'image','data:image/png;base64,' + img_stream
    else:
        raise NotImplementedError("Unsupported file extension: {}".format(file_extension))


# Func: load all text samples
def get_all_texts(config, content_path):
    attributes = config['dataset']['attributes']
    if 'sample' not in attributes:
        return None, 'sample is not in attributes'
    
    sampleConfig = attributes['sample']
    if sampleConfig['dataType'] != 'text':
        return None, 'sample is not text'
    
    text_list = []
    if sampleConfig['source']['type'] == 'folder':
        parent_directory = os.path.dirname(sampleConfig['source']['pattern'])
        parent_directory = os.path.join(content_path, parent_directory)
        
        files_and_folders = os.listdir(parent_directory)
        numbered_files = [f for f in files_and_folders if f.endswith('.txt') and f[:-4].isdigit()]
        numbered_files.sort(key=lambda f: int(f[:-4]))
        
        # TODO: if we know index of samples, we can directly read the file by index
        for file_name in numbered_files:
            file_path = os.path.join(parent_directory, file_name)
            with open(file_path, 'r') as file:
                content = file.read()
                text_list.append(content)

    elif sampleConfig['source']['type'] == 'file':
        with open(sampleConfig['source']['pattern'], 'r') as f:
            text_list = f.readlines()
    else:
        return None, 'Unsupported source type: {}'.format(sampleConfig['source']['type'])

    return text_list, ''

# Func: given label file path, return python list of labels
def read_label_file(file_path):
    _, file_extension = os.path.splitext(file_path)
    
    if file_extension == '.npy':
        data = np.load(file_path)
        label_list = data.tolist()
    elif file_extension == '.pth':
        data = torch.load(file_path)
        if isinstance(data, torch.Tensor):
            label_list = data.tolist()
        else:
            raise ValueError(f"Unsupported data type in .pth file: {type(data)}")
    else:
        raise ValueError(f"Unsupported file extension: {file_extension}")
    
    return label_list


# Func: load representation of one epoch
def load_representation(config, content_path, epoch):
    attributes = config['dataset']['attributes']
    if 'representation' not in attributes:
        raise NotImplementedError("representation is not in attributes")
    
    file_path_pattern = attributes['representation']['source']['pattern']
    file_path = file_path_pattern.replace('${epoch}', str(epoch))
    file_path = os.path.join(content_path, file_path)
    
    repr = np.load(file_path)
    return repr.tolist()


"""
About other attributes (not basic attributes like representation, label, sample...)
"""
def load_single_attribute(config, content_path, epoch, attribute):
    attributes = config['dataset']['attributes']
    if attribute not in attributes:
        raise NotImplementedError("Attribute name not found in config file")
    
    # TODO other types of attributes?
    # how does 'dataType' and 'sourceType' work?
    
    file_path_pattern = attributes[attribute]['source']['pattern']
    file_path = os.path.join(content_path, file_path_pattern)
    file_path = file_path.replace('${epoch}', str(epoch))
    
    attr_data = read_from_file(file_path)
    
    return attr_data

def read_from_file(file_path):
    _, file_extension = os.path.splitext(file_path)
    
    if file_extension == '.npy':
        data = np.load(file_path)
        result = data.tolist()
    elif file_extension == '.pth':
        data = torch.load(file_path)
        if isinstance(data, torch.Tensor):
            result = data.tolist()
        elif isinstance(data, (dict, list)):
            result = data
        else:
            raise ValueError(f"Unsupported data type in .pth file: {type(data)}")
    else:
        raise ValueError(f"Unsupported file extension: {file_extension}")
    
    return result

# Func: get simple filtered indices
def get_filter_result(config, content_path, epoch, filters):
    index_file_path = os.path.join(content_path, 'index.json')
    if not os.path.exists(index_file_path):
        return None, 'index.json not found'
    
    indice_obj = read_file_as_json(index_file_path)
    
    all_indices = indice_obj['train'] + indice_obj['test']
    result = all_indices
    
    for filter in filters:
        filter_type = filter['filter_type']
        label_text_list = config['dataset']['classes']
        
        if filter_type == 'label':
            filter_data = filter['filter_data']
            
            attributes = config['dataset']['attributes']
            file_path_pattern = attributes['label']['source']['pattern']
            file_path = os.path.join(content_path, file_path_pattern)
            if not os.path.exists(file_path):
                return None, 'label file not found'
            
            label_list = read_label_file(file_path)
            
            filtered_indices = [index for index, label in zip(all_indices, label_list) if label_text_list[label] == filter_data]
            result = list(set(result) & set(filtered_indices))
        
        elif filter_type == 'prediction':
            filter_data = filter['filter_data']
            
            attributes = config['dataset']['attributes']
            file_path_pattern = attributes['prediction']['source']['pattern']
            file_path_pattern = file_path_pattern.replace('${epoch}', str(epoch))
            file_path = os.path.join(content_path, file_path_pattern)
            if not os.path.exists(file_path):
                return None, 'prediction file not found'
            
            prediction_list = read_label_file(file_path)
            
            filtered_indices = [index for index, label in zip(all_indices, prediction_list) if label_text_list[label] == filter_data]
            result = list(set(result) & set(filtered_indices))
        
        elif filter_type == 'train':
            result = list(set(result) & set(indice_obj['train']))
        
        elif filter_type == 'test':
            result = list(set(result) & set(indice_obj['test']))
    
    return result,''


""" ==================================================================== """
def initialize_config(config_file, setting = 'normal'):
    if setting == "normal":
        config_class = VisConfig(config_file)
    # elif setting == "active learning":
    #     context = ActiveLearningContext(strategy)
    # elif setting == "abnormal":
    #     context = AnormalyContext(strategy)
    else:
        raise NotImplementedError
    return config_class

def get_embedding(config, all_data, epoch):
    embedding_path = os.path.join(config.CONTENT_PATH,'Model',f'Epoch_{epoch}', "embedding_"+config.VIS_METHOD+".npy")
    if os.path.exists(embedding_path):
        embedding_2d = np.load(embedding_path, allow_pickle=True) 
    else:
        # TODO: get embedding using visualization model
        # embedding_2d = context.strategy.projector.batch_project(EPOCH, all_data)
        # np.save(embedding_path, embedding_2d)
        raise NotImplementedError()
    return embedding_2d

def get_embedding_path(context, EPOCH):
    embedding_path = os.path.join(context.strategy.data_provider.checkpoint_path(EPOCH), "embedding.npy")
    return embedding_path
# Func: get scale and background image
def get_grid_bfig(config, epoch):
    bgimg_path = os.path.join(config.checkpoint_path(epoch), "bgimg.png")
    scale_path = os.path.join(config.checkpoint_path(epoch), "scale.npy")
    if not (os.path.exists(bgimg_path) and os.path.exists(scale_path)):
        # if config.TASK_TYPE == "classification":
        #     context.strategy.visualizer.save_scale_bgimg(epoch, context.strategy.config["VISUALIZATION"]["RESOLUTION"])
        # else:
        #     context.strategy.visualizer.save_scale_bgimg_blank(epoch, context.strategy.config["VISUALIZATION"]["RESOLUTION"])
        # x_min, y_min, x_max, y_max, b_fig = context.strategy.vis.get_background(EPOCH, context.strategy.config["VISUALIZATION"]["RESOLUTION"])
        # grid = [x_min, y_min, x_max, y_max]
        # # formating
        # grid = [float(i) for i in grid]
        # b_fig = str(b_fig, encoding='utf-8')
        # # save results, grid and decision_view
        # with open(grid_path, "wb") as f:
        #     pickle.dump(grid, f)
        # np.save(get_embedding_path(context, EPOCH), embedding_2d)
        raise NotImplementedError() # TODO:KWY
    with open(bgimg_path, 'rb') as img_f:
        img_stream = img_f.read()
    b_fig = base64.b64encode(img_stream).decode()
    grid = np.load(scale_path)

    return grid, b_fig

# Func: get evaluation results of subject model
def get_eval_new(config, epoch):
    # TODO: not now
    # eval_new = dict()
    # file_name = "evaluation"
    # # save_eval_dir = os.path.join(context.strategy.data_provider.model_path, file_name + ".json")
    # save_eval_dir = os.path.join(config.CONTENT_PATH, 'Model', file_name + ".json")
    # if os.path.exists(save_eval_dir):
    #     evaluation = context.strategy.evaluator.get_eval(file_name=file_name)
    #     eval_new["train_acc"] = evaluation["train_acc"][str(epoch)]
    #     eval_new["test_acc"] = evaluation["test_acc"][str(epoch)]
    # else:
    #     eval_new["train_acc"] = 0
    #     eval_new["test_acc"] = 0
    eval_new = dict()
    eval_new["train_acc"] = 0
    eval_new["test_acc"] = 0
    return eval_new

def get_train_test_data(context, EPOCH):
    train_data = context.train_representation_data(EPOCH)
    test_data = context.test_representation_data(EPOCH)
    if train_data is None:
        all_data = test_data
    elif test_data is None:
        all_data = train_data
    else:
        all_data = np.concatenate((train_data, test_data), axis=0)
    # print(len(test_data))
    # print(len(train_data))
    return all_data

# Func: get all labels and return as a ndarray([0,1,2,0,1,2...])
def get_train_test_label(config):
    training_data_number = config.TRAINING["train_num"]
    testing_data_number = config.TRAINING["test_num"]
    
    if config.TASK_TYPE == "classification":
        train_labels = get_classification_label(config, True)
        test_labels = get_classification_label(config, False)
        
        if train_labels is None:
            train_labels = np.zeros(training_data_number, dtype=int)
        if test_labels is None:
            test_labels = np.zeros(testing_data_number, dtype=int)
    else:
        # for non-classification, asign different label to each feature
        feature_num = len(config.CLASSES)
        train_labels = np.zeros(training_data_number * feature_num, dtype=int)
        test_labels = np.zeros(testing_data_number * feature_num, dtype=int)
        for i in range(feature_num):
            train_labels[i::feature_num] = i
            test_labels[i::feature_num] = i
    
    labels = np.concatenate((train_labels, test_labels), axis=0).astype(int)        
    return labels

def get_classification_label(config, train = True):
    dataset_path = os.path.join(config.CONTENT_PATH, "Dataset")
    if train is True:
        label_loc = os.path.join(dataset_path, "training_dataset_label.pth")
    else:
        label_loc = os.path.join(dataset_path, "testing_dataset_label.pth")

    try:
        labels = torch.load(label_loc, map_location="cpu")
        labels = np.array(labels)
    except Exception as e:
        labels = None
    return labels


# Func get color list to select, and color for each sample according to its label
def get_coloring(config, label_list,colorType = 'classification-color'):
    label_color_list = []
    if colorType == 'no-coloring':
        color = [[0,160,255]]
    elif colorType == 'classification-color':
        class_num = len(config.CLASSES)
        color = get_standard_classes_color(class_num) * 255
        color = color.astype(int)
    else:
        raise NotImplementedError()
    
    label_color_list = color[label_list].tolist()
    color_list = color      
    return label_color_list, color_list
    
    # train_data =  context.train_representation_data(EPOCH) 
    # test_data =  context.test_representation_data(EPOCH) 
    # labels = get_train_test_label(context, EPOCH)
    # # coloring method
    # if ColorType == "noColoring":
    #     color = context.strategy.visualizer.get_standard_classes_color() * 255

    #     color = color.astype(int)      
    #     label_color_list = color[labels].tolist()
    #     color_list = color
       
    # elif ColorType == "singleColoring":
    #     n_clusters = 20
    #     save_test_label_dir = os.path.join(context.strategy.data_provider.content_path, 'Testing_data',ColorType+ "label" + str(EPOCH)+".pth")
    #     save_train_label_dir = os.path.join(context.strategy.data_provider.content_path, 'Training_data',ColorType+ "label" + str(EPOCH)+".pth")
    #     if os.path.exists(save_train_label_dir):
    #         labels_kmeans_train = torch.load(save_train_label_dir)
    #         labels_kmeans_test = torch.load(save_test_label_dir)
    #     else:
       
    #         kmeans = KMeans(n_clusters=n_clusters, random_state=0).fit(train_data)

    #         labels_kmeans_train = kmeans.labels_
    #         labels_kmeans_test = kmeans.predict(test_data)
          
    #         torch.save(torch.tensor(labels_kmeans_train), save_train_label_dir)
    #         torch.save(torch.tensor(labels_kmeans_test), save_test_label_dir)

    #     colormap = plt.cm.get_cmap('tab10', n_clusters)
    
    #     colors_rgb = (colormap(np.arange(n_clusters))[:, :3] * 255).astype(int)  
    #     label_color_list_train = [colors_rgb[label].tolist() for label in labels_kmeans_train]
    #     label_color_list_test = [colors_rgb[label].tolist() for label in labels_kmeans_test]
        
    #     label_color_list = np.concatenate((label_color_list_train, label_color_list_test), axis=0).tolist()
    #     color_list = colors_rgb

    # else:
    #     return         

    # return label_color_list, color_list


def get_standard_classes_color(class_num):
    '''
    get the RGB value for class_num classes
    return:
        color : numpy.ndarray, shape (class_num, 3)
    '''
    mesh_max_class = class_num + 1
    mesh_classes = np.arange(class_num+2)
    # apply more color
    color_map = plt.cm.get_cmap('tab20', class_num+2)
    color = color_map(mesh_classes / mesh_max_class)
    color = color[2:, 0:3]
    # color = self.cmap(mesh_classes / mesh_max_class)
    # color = color[:, 0:3]
    # color = np.concatenate((color, np.zeros((1,3))), axis=0)
    return color   

def update_epoch_projection(config, epoch, predicates, indicates=[]):
    if config.TASK_TYPE == "classification":
        return update_epoch_projection_classification(config, epoch, predicates, indicates)
    else:
        return update_epoch_projection_non_classification(config, epoch, predicates, indicates)

def update_epoch_projection_classification(config, epoch, predicates, indicates):
    error_message = ""
    
    # load data and labels
    all_labels = get_train_test_label(config)
    # error_message = check_labels_match_alldata(all_labels, all_data, error_message)
    
    # load or create embedding_2d
    embedding_2d = get_embedding(config, None, epoch)
    if len(indicates):
        indicates = [i for i in indicates if i < len(embedding_2d)]
        embedding_2d = embedding_2d[indicates]
    # error_message = check_embedding_match_alldata(embedding_2d, all_data, error_message)
    
    training_data_number = config.TRAINING["train_num"]
    testing_data_number = config.TRAINING["test_num"]
    training_data_index = list(range(training_data_number))
    testing_data_index = list(range(training_data_number, training_data_number + testing_data_number))
    # error_message = check_config_match_embedding(training_data_number, testing_data_number, embedding_2d, error_message)

    # load or create background figure
    grid, b_fig = get_grid_bfig(config, epoch)

    # load visualization evaluation result    
    eval_new = get_eval_new(config, epoch)
    
    # load color list  
    label_color_list, color_list = get_coloring(config, all_labels)
    if len(indicates):
        label_color_list = [label_color_list[i] for i in indicates]

    # load label list, precidtion list, confidance
    CLASSES = np.array(config.CLASSES)
    label_list = all_labels.tolist() # [2, 1, 9, 2...]
    label_name_dict = dict(enumerate(CLASSES))
    
    prediction_list = []
    confidence_list = []

    # check if there is stored prediction and load
    prediction_path = os.path.join(config.checkpoint_path(epoch), "modified_ranks.json")
    if os.path.isfile(prediction_path):
        with open(prediction_path, "r") as f:
            predictions = json.load(f)

        for prediction in predictions:
            prediction_list.append(prediction)
    else:
        pass
        # all_data = all_data.reshape(all_data.shape[0],all_data.shape[1])
        # prediction_origin = context.strategy.data_provider.get_pred(EPOCH, all_data)
        # prediction = prediction_origin.argmax(1)

        # for i in range(len(prediction)):
        #     prediction_list.append(CLASSES[prediction[i]])
        #     top_three_indices = np.argsort(prediction_origin[i])[-3:][::-1]
        #     conf_list = [(label_name_dict[top_three_indices[j]], round(float(prediction_origin[i][top_three_indices[j]]), 1)) for j in range(len(top_three_indices))]
        #     confidence_list.append(conf_list)
    
    max_iter = (config.EPOCH_END - config.EPOCH_START) // config.EPOCH_PERIOD + 1
    
    # selected_points = get_selected_points(context, predicates, EPOCH, training_data_number, testing_data_number)
    selected_points = np.array(indicates)
    return embedding_2d.tolist(), grid, b_fig, label_name_dict, label_color_list, label_list, max_iter, training_data_index, testing_data_index, eval_new, prediction_list, selected_points,error_message, color_list, confidence_list

def update_epoch_projection_non_classification(config, epoch, predicates, indicates):
    training_data_number = config.TRAINING["train_num"]
    testing_data_number = config.TRAINING["test_num"]

    error_message = ""
    t0 = time.time()
    
    # load data and labels
    all_data = None
    all_labels = get_train_test_label(config)

    # error_message = check_labels_match_alldata(all_labels, all_data, error_message)
    
    # load or create embedding_2d
    embedding_2d = get_embedding(config, all_data, epoch)
    if len(indicates):
        indicates = [i for i in indicates if i < len(embedding_2d)]
        embedding_2d = embedding_2d[indicates]
    # error_message = check_embedding_match_alldata(embedding_2d, all_data, error_message)
    
    training_data_index = list(range(training_data_number))
    testing_data_index = list(range(training_data_number, training_data_number + testing_data_number))
    # error_message = check_config_match_embedding(all_data, training_data_number, testing_data_number, embedding_2d, error_message)

    # load label list, precidtion list, confidance    
    label_list = all_labels.tolist() #[0,1,0,1,...]
    if len(indicates):
        label_list = [label_list[i] for i in indicates]

    # load or create background figure
    grid, b_fig = get_grid_bfig(config, epoch)

    # load visualization evaluation result    
    eval_new = get_eval_new(config, epoch)
    
    # load color list  
    label_color_list, color_list = get_coloring(config, label_list)
    label_name_dict = dict(enumerate(config.CLASSES)) #{0:"code", 1:"doc"}
    
    prediction_list = []
    confidence_list = []
    for i in range(len(indicates)):
        prediction_list.append(0)
    
    max_iter = (config.EPOCH_END - config.EPOCH_START) // config.EPOCH_PERIOD + 1
    
    # selected_points = get_selected_points(context, predicates, EPOCH, training_data_number, testing_data_number)
    selected_points = np.array(indicates)
    return embedding_2d.tolist(), grid, b_fig, label_name_dict, label_color_list, label_list, max_iter, training_data_index, testing_data_index, eval_new, prediction_list, selected_points,error_message, color_list, confidence_list

def read_tokens_by_file(dir_path: str, n: int):
    '''Read labels from text_0.txt to text_n.txt. Only the first line is recognized as a label.'''
    labels = []
    for i in range(n):
        try:
            with open(os.path.join(dir_path, "text_{}.txt".format(i)), 'r', encoding='utf-8') as f:
                labels += [next(line for line in f).strip()]
        except Exception:
            break
    return labels

def read_file_as_json(file_path: str):
    with open(file_path, "r") as f:
        return json.load(f)

# FIXME add cache when the content_path doesn't change
def get_umap_neighborhood_epoch_projection(content_path: str, epoch: int, predicates: List[int], indicates: List[int]):
    data_folder = os.path.join(content_path, 'Model')
    epoch_folder = os.path.join(data_folder, f'Epoch_{epoch}')

    # Read number of indices of all, comment and code
    # We only read the number of comment, then the rest are code
    # FIXME this is not a good specification of how to split comment and code
    all_indices_file = os.path.join(epoch_folder, 'index.json')
    comment_indices_file = os.path.join(epoch_folder, 'comment_index.json')
    all_idx_num = len(read_file_as_json(all_indices_file))
    cmt_idx_num = len(read_file_as_json(comment_indices_file))
    code_idx_num = all_idx_num - cmt_idx_num
    
    label_text_list = ['comment', 'code']
    labels = [0] * cmt_idx_num + [1] * code_idx_num

    # Assume there are `code_labels` and `comment_labels` folder: Read code tokens and comment tokens
    code_labels_folder = os.path.join(data_folder, 'code_labels')
    comment_labels_folder = os.path.join(data_folder, 'comment_labels')

    code_tokens = read_tokens_by_file(code_labels_folder, code_idx_num)
    comment_tokens = read_tokens_by_file(comment_labels_folder, cmt_idx_num)

    assert (len(code_tokens) == code_idx_num)
    assert (len(comment_tokens) == cmt_idx_num)


    # Read and return projections
    proj_file = os.path.join(epoch_folder, 'embedding_DVI.npy')

    proj = np.load(proj_file).tolist()

    # Read and return similarities, inter-type and intra-type
    inter_sim_file = os.path.join(epoch_folder, 'inter_similarity.npy')
    intra_sim_file = os.path.join(epoch_folder, 'intra_similarity.npy')
    
    inter_sim_top_k = np.load(inter_sim_file).tolist()
    intra_sim_top_k = np.load(intra_sim_file).tolist()
    
    # Read and return attention
    attention_folder = os.path.join(data_folder,'aa_possim') # gcb_tokens_temp/Model/aa_possim
    code_attention_file = os.path.join(attention_folder,'train_code_attention_aa.npy')
    nl_attention_file = os.path.join(attention_folder,'train_nl_attention_aa.npy')
    
    code_attention = np.load(code_attention_file).tolist()
    nl_attention = np.load(nl_attention_file).tolist()
    
    # Read the bounding box (TODO necessary?)
    bounding_file = os.path.join(epoch_folder, 'scale.npy')
    bounding_np_array = np.load(bounding_file)
    x_min, y_min, x_max, y_max = bounding_np_array.tolist()

    result = {
        'proj': proj,
        'labels': labels,
        'label_text_list': label_text_list,
        'tokens': comment_tokens + code_tokens,
        'inter_sim_top_k': inter_sim_top_k,
        'intra_sim_top_k': intra_sim_top_k,
        'code_attention': code_attention,
        'nl_attention': nl_attention,
        'bounding': {
            'x_min': x_min,
            'y_min': y_min,
            'x_max': x_max,
            'y_max': y_max
        }
    }

    return result