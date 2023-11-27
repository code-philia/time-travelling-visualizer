import os
import json
import time
import csv
import numpy as np
import sys
import pickle
import base64

vis_path = ".."
sys.path.append(vis_path)
from context import VisContext, ActiveLearningContext, AnormalyContext
from strategy import DeepDebugger, TimeVis, tfDeepVisualInsight, DVIAL, tfDVIDenseAL, TimeVisDenseAL

"""Interface align"""

def initialize_strategy(CONTENT_PATH, VIS_METHOD, SETTING, dense=False):
    # initailize strategy (visualization method)
    with open(os.path.join(CONTENT_PATH, "config.json"), "r") as f:
        conf = json.load(f)
    VIS_METHOD = "DVI" 
    config = conf[VIS_METHOD]
    
    if SETTING == "normal" or SETTING == "abnormal":
        if VIS_METHOD == "DVI":
            strategy = tfDeepVisualInsight(CONTENT_PATH, config)
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


def update_epoch_projection(context, EPOCH, predicates):
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
    # print("all_data",all_data.shape)
    all_data = all_data.reshape(all_data.shape[0],all_data.shape[1])
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

    print("eval_new",eval_new)
    
    return embedding_2d.tolist(), grid, b_fig, label_name_dict, label_color_list, label_list, max_iter, training_data_index, testing_data_index, eval_new, prediction_list, selected_points, properties


def add_line(path, data_row):
    """
    data_row: list, [API_name, username, time]
    """
    now_time = time.strftime('%Y-%m-%d-%H:%M:%S', time.localtime())
    data_row.append(now_time)
    with open(path, "a+") as f:
        csv_write = csv.writer(f)
        csv_write.writerow(data_row)