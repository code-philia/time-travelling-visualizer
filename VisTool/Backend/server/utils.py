import os
import json
import time
import csv
import numpy as np
import sys
import pickle
import base64
from scipy.special import softmax
vis_path = ".."
sys.path.append(vis_path)
from context import VisContext, ActiveLearningContext, AnormalyContext
from strategy import DeepDebugger, TimeVis, tfDeepVisualInsight, DVIAL, tfDVIDenseAL, TimeVisDenseAL, TrustActiveLearningDVI,DeepVisualInsight, TrustProxyDVI
from singleVis.eval.evaluate import evaluate_isAlign, evaluate_isNearestNeighbour
"""Interface align"""

def initialize_strategy(CONTENT_PATH, VIS_METHOD, SETTING, dense=False):
    # initailize strategy (visualization method)
    with open(os.path.join(CONTENT_PATH, "config.json"), "r") as f:
        conf = json.load(f)
        
    config = conf[VIS_METHOD]

    # todo support timevis, curretnly only support dvi
    # remove unnecessary parts
    if SETTING == "normal" or SETTING == "abnormal":

        if VIS_METHOD == "TrustVisActiveLearning":
            strategy = TrustActiveLearningDVI(CONTENT_PATH, config)
        elif VIS_METHOD == "TrustVisProxy":
            strategy = TrustProxyDVI(CONTENT_PATH, config)
        elif VIS_METHOD == "DVI":
            strategy = DeepVisualInsight(CONTENT_PATH, config)
        elif VIS_METHOD == "TimeVis":
            strategy = TimeVis(CONTENT_PATH, config)
        elif VIS_METHOD == "DeepDebugger":
            strategy = DeepDebugger(CONTENT_PATH, config)
        else:
            raise NotImplementedError
    elif SETTING == "active learning":
        if dense:
            if VIS_METHOD == "DVI":
                strategy = tfDVIDenseAL(CONTENT_PATH, config)
            elif VIS_METHOD == "TimeVis":
                strategy = TimeVisDenseAL(CONTENT_PATH, config)
            else:
                raise NotImplementedError
        else:
            strategy = DVIAL(CONTENT_PATH, config)
    
    else:
        raise NotImplementedError

    return strategy

# todo remove unnecessary parts
def initialize_context(strategy, setting):
    if setting == "normal":
        context = VisContext(strategy)
    elif setting == "active learning":
        context = ActiveLearningContext(strategy)
    elif setting == "abnormal":
        context = AnormalyContext(strategy)
    else:
        raise NotImplementedError
    return context

def initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING, dense=False):
    """ initialize backend for visualization

    Args:
        CONTENT_PATH (str): the directory to training process
        VIS_METHOD (str): visualization strategy
            "DVI", "TimeVis", "DeepDebugger",...
        setting (str): context
            "normal", "active learning", "dense al", "abnormal"

    Raises:
        NotImplementedError: _description_

    Returns:
        backend: a context with a specific strategy
    """
    strategy = initialize_strategy(CONTENT_PATH, VIS_METHOD, SETTING, dense)
    context = initialize_context(strategy=strategy, setting=SETTING)
    return context

def get_train_test_data(context, EPOCH):
    
    train_data = context.train_representation_data(EPOCH)
    test_data = context.test_representation_data(EPOCH)
    all_data = np.concatenate((train_data, test_data), axis=0)
    return all_data
def get_train_test_label(context, EPOCH):
    train_labels = context.train_labels(EPOCH)
    test_labels = context.test_labels(EPOCH)
    labels = np.concatenate((train_labels, test_labels), axis=0).astype(int)
    return labels


# def get_strategy_by_setting(CONTENT_PATH, config, VIS_METHOD, SETTING, dense=False):
#     if SETTING == "normal" or SETTING == "abnormal":
#         if VIS_METHOD == "DVI":
#             strategy = tfDeepVisualInsight(CONTENT_PATH, config)
#         elif VIS_METHOD == "TimeVis":
#             strategy = TimeVis(CONTENT_PATH, config)
#         elif VIS_METHOD == "DeepDebugger":
#             strategy = DeepDebugger(CONTENT_PATH, config)
#         else:
#             raise NotImplementedError
#     elif SETTING == "active learning":
#         if dense:
#             if VIS_METHOD == "DVI":
#                 strategy = tfDVIDenseAL(CONTENT_PATH, config)
#             elif VIS_METHOD == "TimeVis":
#                 strategy = TimeVisDenseAL(CONTENT_PATH, config)
#             else:
#                 raise NotImplementedError
#         else:
#             strategy = DVIAL(CONTENT_PATH, config)
    
#     else:
#         raise NotImplementedError
#     return strategy

# def update_embeddings(new_strategy, context, EPOCH, all_data, is_focus):
 
#     embedding_path = os.path.join(context.strategy.data_provider.checkpoint_path(EPOCH), "embedding.npy")
#     if os.path.exists(embedding_path):
#             original_embedding_2d = np.load(embedding_path)
    
#         dd = TimeVis(context.contentpath,new_conf)
#         dd._preprocess()
#         dd._train()
#         embedding_2d = dd.projector.batch_project(EPOCH, all_data)
#     return embedding_2d

# def find_and_add_nearest_neighbors(data, subset_indices, num_neighbors=10):
#     dimension = len(data[0])  # Assuming all data points have the same dimension
#     t = AnnoyIndex(dimension, 'euclidean')  # 'euclidean' distance metric; you can use 'angular' as well
    
#     # Build the index with the entire data
#     for i, vector in enumerate(data):
#         t.add_item(i, vector)
    
#     t.build(10)  # Number of trees. More trees gives higher precision.
    
#     # Use a set for faster look-up and ensuring no duplicates
#     subset_indices_set = set(subset_indices)
    
#     for idx in subset_indices:
#         nearest_neighbors = t.get_nns_by_item(idx, num_neighbors)
#         # Use set union operation to merge indices without duplicates
#         subset_indices_set = subset_indices_set.union(nearest_neighbors)
#     # Convert set back to list
#     return list(subset_indices_set)

# def get_expanded_subset(context, EPOCH, subset_indices):
#     all_data = get_train_test_data(context, EPOCH)
#     expanded_subset = find_and_add_nearest_neighbors(all_data, subset_indices)
#     return expanded_subset

# def update_vis_error_points(new_strategy, context, EPOCH, is_focus):
#     embedding_path = os.path.join(context.strategy.data_provider.checkpoint_path(EPOCH), "embedding.npy")
#     if os.path.exists(embedding_path):
#         original_embedding_2d = np.load(embedding_path)
#         new_strategy._train()
#         new_strategy.projector.batch_project
#         embedding_2d = dd.projector.batch_project(EPOCH, all_data)
    
#     update_embeddings(strategy, context, EPOCH,  True)



def update_epoch_projection(context, EPOCH, predicates, isContraVis):
    # TODO consider active learning setting

    train_data = context.train_representation_data(EPOCH)
    test_data = context.test_representation_data(EPOCH)
    all_data = np.concatenate((train_data, test_data), axis=0)

    train_labels = context.train_labels(EPOCH)
    test_labels = context.test_labels(EPOCH)
    labels = np.concatenate((train_labels, test_labels), axis=0).astype(int)


    embedding_path = os.path.join(context.strategy.data_provider.checkpoint_path(EPOCH), "embedding.npy")
    if os.path.exists(embedding_path):
        embedding_2d = np.load(embedding_path)
    else:
        embedding_2d = context.strategy.projector.batch_project(EPOCH, all_data)
        np.save(embedding_path, embedding_2d)

    training_data_number = context.strategy.config["TRAINING"]["train_num"]
    testing_data_number = context.strategy.config["TRAINING"]["test_num"]
    training_data_index = list(range(training_data_number))
    testing_data_index = list(range(training_data_number, training_data_number + testing_data_number))

    # return the image of background
    # read cache if exists
    bgimg_path = os.path.join(context.strategy.data_provider.checkpoint_path(EPOCH), "bgimg.png")
    scale_path = os.path.join(context.strategy.data_provider.checkpoint_path(EPOCH), "scale.npy")
    # grid_path = os.path.join(context.strategy.data_provider.checkpoint_path(EPOCH), "grid.pkl")
    if os.path.exists(bgimg_path) and os.path.exists(scale_path):
        # with open(os.path.join(grid_path), "rb") as f:
        #     grid = pickle.load(f)
        with open(bgimg_path, 'rb') as img_f:
            img_stream = img_f.read()
        b_fig = base64.b64encode(img_stream).decode()
        grid = np.load(scale_path)
    else:
        x_min, y_min, x_max, y_max, b_fig = context.strategy.vis.get_background(EPOCH, context.strategy.config["VISUALIZATION"]["RESOLUTION"])
        grid = [x_min, y_min, x_max, y_max]
        # formating
        grid = [float(i) for i in grid]
        b_fig = str(b_fig, encoding='utf-8')
        # save results, grid and decision_view
        # with open(grid_path, "wb") as f:
        #     pickle.dump(grid, f)
        np.save(embedding_path, embedding_2d)
    
    # TODO fix its structure
    eval_new = dict()
    file_name = context.strategy.config["VISUALIZATION"]["EVALUATION_NAME"]
    save_eval_dir = os.path.join(context.strategy.data_provider.model_path, file_name + ".json")
    if os.path.exists(save_eval_dir):
        evaluation = context.strategy.evaluator.get_eval(file_name=file_name)
        eval_new["train_acc"] = evaluation["train_acc"][str(EPOCH)]
        eval_new["test_acc"] = evaluation["test_acc"][str(EPOCH)]
    else:
        eval_new["train_acc"] = 0
        eval_new["test_acc"] = 0

    color = context.strategy.vis.get_standard_classes_color() * 255
    color = color.astype(int)

    CLASSES = np.array(context.strategy.config["CLASSES"])
    label_color_list = color[labels].tolist()
    label_list = CLASSES[labels].tolist()
    label_name_dict = dict(enumerate(CLASSES))

    prediction_list = []
    if (isContraVis == 'false'):
        prediction = context.strategy.data_provider.get_pred(EPOCH, all_data).argmax(1)

        for i in range(len(prediction)):
            prediction_list.append(CLASSES[prediction[i]])
    
    EPOCH_START = context.strategy.config["EPOCH_START"]
    EPOCH_PERIOD = context.strategy.config["EPOCH_PERIOD"]
    EPOCH_END = context.strategy.config["EPOCH_END"]
    max_iter = (EPOCH_END - EPOCH_START) // EPOCH_PERIOD + 1
    # max_iter = context.get_max_iter()
    
    # current_index = timevis.get_epoch_index(EPOCH)
    # selected_points = np.arange(training_data_number + testing_data_number)[current_index]
    selected_points = np.arange(training_data_number + testing_data_number)
    for key in predicates.keys():
        if key == "label":
            tmp = np.array(context.filter_label(predicates[key]))
        elif key == "type":
            tmp = np.array(context.filter_type(predicates[key], int(EPOCH)))
        else:
            tmp = np.arange(training_data_number + testing_data_number)
        selected_points = np.intersect1d(selected_points, tmp)
    
    properties = np.concatenate((np.zeros(training_data_number, dtype=np.int16), 2*np.ones(testing_data_number, dtype=np.int16)), axis=0)
    lb = context.get_epoch_index(EPOCH)
    ulb = np.setdiff1d(training_data_index, lb)
    properties[ulb] = 1

    highlightedPointIndices = []

    if (isContraVis is 'false'):
        high_pred = context.strategy.data_provider.get_pred(EPOCH, all_data).argmax(1)
        inv_high_dim_data = context.strategy.projector.batch_inverse(EPOCH, embedding_2d)
        inv_high_pred = context.strategy.data_provider.get_pred(EPOCH, inv_high_dim_data).argmax(1)
        highlightedPointIndices = np.where(high_pred != inv_high_pred)[0]

 
 
    return embedding_2d.tolist(), grid, b_fig, label_name_dict, label_color_list, label_list, max_iter, training_data_index, testing_data_index, eval_new, prediction_list, selected_points, properties, highlightedPointIndices,




def getContraVisChangeIndices(context, iterationLeft, iterationRight, method):

    predChangeIndices = []
    
    train_data = context.train_representation_data(iterationLeft)
    test_data = context.test_representation_data(iterationLeft)
    all_data = np.concatenate((train_data, test_data), axis=0)

    embedding_path = os.path.join(context.strategy.data_provider.checkpoint_path(iterationLeft), "embedding.npy")
    if os.path.exists(embedding_path):
        embedding_2d = np.load(embedding_path)
    else:
        embedding_2d = context.strategy.projector.batch_project(iterationLeft, all_data)
        np.save(embedding_path, embedding_2d)

    last_train_data = context.train_representation_data(iterationRight)
    last_test_data = context.test_representation_data(iterationRight)
    last_all_data = np.concatenate((last_train_data, last_test_data), axis=0)

    last_embedding_path = os.path.join(context.strategy.data_provider.checkpoint_path(iterationRight), "embedding.npy")
    if os.path.exists(last_embedding_path):
        last_embedding_2d = np.load(last_embedding_path)
    else:
        last_embedding_2d = context.strategy.projector.batch_project(iterationRight, last_all_data)
        np.save(last_embedding_path, last_embedding_2d)

    print(embedding_2d.shape)
    print(last_embedding_2d.shape)
    if (method == "align"):
        predChangeIndices = evaluate_isAlign(embedding_2d, last_embedding_2d)
    elif (method == "nearest neighbour"):
        predChangeIndices = evaluate_isNearestNeighbour(embedding_2d, last_embedding_2d)
    elif (method == "both"):
        predChangeIndices_align = evaluate_isAlign(embedding_2d, last_embedding_2d)
        predChangeIndices_nearest = evaluate_isNearestNeighbour(embedding_2d, last_embedding_2d)
  
        intersection = set(predChangeIndices_align).intersection(predChangeIndices_nearest)
    
        predChangeIndices = list(intersection)

    else:
        print("wrong method")


    return predChangeIndices

def getCriticalChangeIndices(context, curr_iteration, last_iteration):

    predChangeIndices = []
    
    train_data = context.train_representation_data(curr_iteration)
    test_data = context.test_representation_data(curr_iteration)
    all_data = np.concatenate((train_data, test_data), axis=0)

    embedding_path = os.path.join(context.strategy.data_provider.checkpoint_path(curr_iteration), "embedding.npy")
    if os.path.exists(embedding_path):
        embedding_2d = np.load(embedding_path)
    else:
        embedding_2d = context.strategy.projector.batch_project(curr_iteration, all_data)
        np.save(embedding_path, embedding_2d)

    last_train_data = context.train_representation_data(last_iteration)
    last_test_data = context.test_representation_data(last_iteration)
    last_all_data = np.concatenate((last_train_data, last_test_data), axis=0)

    last_embedding_path = os.path.join(context.strategy.data_provider.checkpoint_path(last_iteration), "embedding.npy")
    if os.path.exists(last_embedding_path):
        last_embedding_2d = np.load(last_embedding_path)
    else:
        last_embedding_2d = context.strategy.projector.batch_project(last_iteration, last_all_data)
        np.save(last_embedding_path, last_embedding_2d)


    high_pred = context.strategy.data_provider.get_pred(curr_iteration, all_data).argmax(1)
    last_high_pred = context.strategy.data_provider.get_pred(last_iteration, last_all_data).argmax(1)


    predChangeIndices = np.where(high_pred != last_high_pred)[0]


    return predChangeIndices

def getConfChangeIndices(context, curr_iteration, last_iteration, confChangeInput):
    
    train_data = context.train_representation_data(curr_iteration)
    test_data = context.test_representation_data(curr_iteration)
    all_data = np.concatenate((train_data, test_data), axis=0)

    embedding_path = os.path.join(context.strategy.data_provider.checkpoint_path(curr_iteration), "embedding.npy")
    if os.path.exists(embedding_path):
        embedding_2d = np.load(embedding_path)
    else:
        embedding_2d = context.strategy.projector.batch_project(curr_iteration, all_data)
        np.save(embedding_path, embedding_2d)

    last_train_data = context.train_representation_data(last_iteration)
    last_test_data = context.test_representation_data(last_iteration)
    last_all_data = np.concatenate((last_train_data, last_test_data), axis=0)

    last_embedding_path = os.path.join(context.strategy.data_provider.checkpoint_path(last_iteration), "embedding.npy")
    if os.path.exists(last_embedding_path):
        last_embedding_2d = np.load(last_embedding_path)
    else:
        last_embedding_2d = context.strategy.projector.batch_project(last_iteration, last_all_data)
        np.save(last_embedding_path, last_embedding_2d)



    high_pred = context.strategy.data_provider.get_pred(curr_iteration, all_data)
    last_high_pred = context.strategy.data_provider.get_pred(last_iteration, last_all_data)

    high_conf = softmax(high_pred, axis=1)
    last_high_conf = softmax(last_high_pred, axis=1)

    # get class type with highest prob
    high_pred_class = high_conf.argmax(axis=1)
    last_high_pred_class = last_high_conf.argmax(axis=1)

    same_pred_indices = np.where(high_pred_class == last_high_pred_class)[0]
    # get 
    conf_diff = np.abs(high_conf[np.arange(len(high_conf)), high_pred_class] - last_high_conf[np.arange(len(last_high_conf)), last_high_pred_class])

    significant_conf_change_indices = same_pred_indices[conf_diff[same_pred_indices] > confChangeInput]

    return significant_conf_change_indices

def add_line(path, data_row):
    """
    data_row: list, [API_name, username, time]
    """
    now_time = time.strftime('%Y-%m-%d-%H:%M:%S', time.localtime())
    data_row.append(now_time)
    with open(path, "a+") as f:
        csv_write = csv.writer(f)
        csv_write.writerow(data_row)