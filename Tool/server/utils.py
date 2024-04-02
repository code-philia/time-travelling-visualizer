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
from strategy import DeepDebugger, TimeVis, tfDeepVisualInsight, DVIAL, tfDVIDenseAL, TimeVisDenseAL, Trustvis, DeepVisualInsight
from singleVis.eval.evaluate import evaluate_isAlign, evaluate_isNearestNeighbour, evaluate_isAlign_single, evaluate_isNearestNeighbour_single
from sklearn.cluster import KMeans
from scipy.special import softmax
import matplotlib.pyplot as plt
import time
"""Interface align"""

def initialize_strategy(CONTENT_PATH, VIS_METHOD, SETTING, dense=False):
    # initailize strategy (visualization method)
    with open(os.path.join(CONTENT_PATH, "config.json"), "r") as f:
        conf = json.load(f)
    # VIS_METHOD = "DVI" 
    config = conf["DVI"]
    error_message = ""
    try:
        if SETTING == "normal" or SETTING == "abnormal":
            if VIS_METHOD == "Trustvis":
                strategy = Trustvis(CONTENT_PATH, config)
            elif VIS_METHOD == "DVI":
                strategy = tfDeepVisualInsight(CONTENT_PATH, config)
            elif VIS_METHOD == "TimeVis":
                strategy = TimeVis(CONTENT_PATH, config)
            elif VIS_METHOD == "DeepDebugger":
                strategy = DeepDebugger(CONTENT_PATH, config)
            else:
                error_message += "Unsupported visualization method\n"
        elif SETTING == "active learning":
            if dense:
                if VIS_METHOD == "DVI":
                    strategy = tfDVIDenseAL(CONTENT_PATH, config)
                elif VIS_METHOD == "TimeVis":
                    strategy = TimeVisDenseAL(CONTENT_PATH, config)
                else:
                    error_message += "Unsupported visualization method\n"
            else:
                strategy = DVIAL(CONTENT_PATH, config)
        
        else:
            error_message += "Unsupported setting\n"
    except Exception as e:
        error_message += "mismatch in input vis method and current visualization model\n"
    return strategy, error_message

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
    strategy, error_message = initialize_strategy(CONTENT_PATH, VIS_METHOD, SETTING, dense)
    context = initialize_context(strategy=strategy, setting=SETTING)
    return context, error_message



def check_labels_match_alldata(labels, all_data, error_message):
    if (len(labels) != len(all_data)):
        error_message += "backend labels and data don't match!\n"
    return error_message

def get_embedding(context, all_data, EPOCH):
    embedding_path = get_embedding_path(context, EPOCH)

    if os.path.exists(embedding_path):
        embedding_2d = np.load(embedding_path, allow_pickle=True) 
    else:
        embedding_2d = context.strategy.projector.batch_project(EPOCH, all_data)
        np.save(embedding_path, embedding_2d)
    return embedding_2d

def get_embedding_path(context, EPOCH):
    embedding_path = os.path.join(context.strategy.data_provider.checkpoint_path(EPOCH), "embedding.npy")
    return embedding_path

def check_embedding_match_alldata(embedding_2d, all_data, error_message):
    if (len(embedding_2d) != len(all_data)):
        error_message += "backend embeddings and data don't match!\n"
    return error_message

def check_config_match_embedding(training_data_number, testing_data_number, embedding_2d, error_message):
    if ((training_data_number + testing_data_number) != len(embedding_2d)):
        error_message += "backend config's total data num and embedding length don't match!\n"
    return error_message

def get_grid_bfig(context, EPOCH, embedding_2d):
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
        np.save(get_embedding_path(context, EPOCH), embedding_2d)
    return grid, b_fig

def get_eval_new(context, EPOCH):
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
    return eval_new

def get_train_test_data(context, EPOCH):
    train_data = context.train_representation_data(EPOCH)
    test_data = context.test_representation_data(EPOCH)
    all_data = np.concatenate((train_data, test_data), axis=0)
    print(len(test_data))
    print(len(train_data))
    return all_data

def get_train_test_label(context, EPOCH, all_data):
    train_labels = context.train_labels(EPOCH)
    test_labels = context.test_labels(EPOCH)
    if train_labels is None:
        labels = np.zeros(len(all_data), dtype=int)
    elif test_labels is None:
        test_labels = np.zeros(len(all_data), dtype=int)
        labels = np.concatenate((train_labels, test_labels), axis=0).astype(int)
    else:
        labels = np.concatenate((train_labels, test_labels), axis=0).astype(int)
    return labels

def get_selected_points(context, predicates, EPOCH, training_data_number, testing_data_number):
    selected_points = np.arange(training_data_number + testing_data_number)
    for key in predicates.keys():
        if key == "label":
            tmp = np.array(context.filter_label(predicates[key]))
        elif key == "type":
            tmp = np.array(context.filter_type(predicates[key], int(EPOCH)))
        else:
            tmp = np.arange(training_data_number + testing_data_number)    
        selected_points = np.intersect1d(selected_points, tmp)

    return selected_points

def get_properties(context, training_data_number, testing_data_number, training_data_index, EPOCH):
    properties = np.concatenate((np.zeros(training_data_number, dtype=np.int16), 2*np.ones(testing_data_number, dtype=np.int16)), axis=0)
    lb = context.get_epoch_index(EPOCH)
    ulb = np.setdiff1d(training_data_index, lb)
    properties[ulb] = 1
    return properties

def update_epoch_projection(context, EPOCH, predicates, TaskType,indicates):
    # TODO consider active learning setting
    error_message = ""
    start = time.time()
    all_data = get_train_test_data(context, EPOCH)
    
    labels = get_train_test_label(context, EPOCH, all_data)
    if len(indicates):
        all_data = all_data[indicates]
        labels = labels[indicates]
        
    
    print('labels',labels)
    error_message = check_labels_match_alldata(labels, all_data, error_message)
    
    embedding_2d = get_embedding(context, all_data, EPOCH)
    if len(indicates):
        embedding_2d = embedding_2d[indicates]
    print('all_data',all_data.shape,'embedding_2d',embedding_2d.shape)
    error_message = check_embedding_match_alldata(embedding_2d, all_data, error_message)
    
    training_data_number = context.strategy.config["TRAINING"]["train_num"]
    testing_data_number = context.strategy.config["TRAINING"]["test_num"]
    training_data_index = list(range(training_data_number))
    testing_data_index = list(range(training_data_number, training_data_number + testing_data_number))
    error_message = check_config_match_embedding(training_data_number, testing_data_number, embedding_2d, error_message)
    end = time.time()
    print("beforeduataion", end- start)
    # return the image of background
    # read cache if exists
   
    grid, b_fig = get_grid_bfig(context, EPOCH,embedding_2d)
    # TODO fix its structure
    eval_new = get_eval_new(context, EPOCH)
    start2 = time.time()
    print("midquestion1", start2-end)
    if TaskType == "Classification":
        print('here',labels)
        color = context.strategy.vis.get_standard_classes_color() * 255
        start3 = time.time()
        print(start3-start2)
        color = color.astype(int)

        
        label_color_list = color[labels].tolist()
       
    else:
        n_clusters = 10
        kmeans = KMeans(n_clusters=n_clusters, random_state=0).fit(all_data)
        labels_kmeans = kmeans.labels_
        colormap = plt.cm.get_cmap('tab10', n_clusters)
    
        colors_rgb = (colormap(np.arange(n_clusters))[:, :3] * 255).astype(int)  
        label_color_list = [colors_rgb[label].tolist() for label in labels_kmeans]
    

    start1 =time.time()
    print("midquestion2",start1-start2)
    CLASSES = np.array(context.strategy.config["CLASSES"])
    label_list = CLASSES[labels].tolist()
    label_name_dict = dict(enumerate(CLASSES))

    prediction_list = []
    # print("all_data",all_data.shape)
    all_data = all_data.reshape(all_data.shape[0],all_data.shape[1])
    if (TaskType == 'Classification'):
        # check if there is stored prediction and load
        prediction_path = os.path.join(context.strategy.data_provider.checkpoint_path(EPOCH), "modified_ranks.json")
        if os.path.isfile(prediction_path):
            with open(prediction_path, "r") as f:
                predictions = json.load(f)

            for prediction in predictions:
                prediction_list.append(prediction)
        else:
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
    selected_points = get_selected_points(context, predicates, EPOCH, training_data_number, testing_data_number)
    
    properties = get_properties(context, training_data_number, testing_data_number, training_data_index, EPOCH)
    # highlightedPointIndices = []
    #todo highlighpoint only when called with showVis
    # if (TaskType == 'Classification'):
    #     high_pred = context.strategy.data_provider.get_pred(EPOCH, all_data).argmax(1)
    #     inv_high_dim_data = context.strategy.projector.batch_inverse(EPOCH, embedding_2d)
    #     inv_high_pred = context.strategy.data_provider.get_pred(EPOCH, inv_high_dim_data).argmax(1)
    #     highlightedPointIndices = np.where(high_pred != inv_high_pred)[0]
    #     print()
    # else:
        
    #     inv_high_dim_data = context.strategy.projector.batch_inverse(EPOCH, embedding_2d)
    #     # todo, change train data to all data
    #     squared_distances = np.sum((all_data - inv_high_dim_data) ** 2, axis=1)
    #     squared_threshold = 1 ** 2
    #     highlightedPointIndices = np.where(squared_distances > squared_threshold)[0]
    #     print()

    end1 = time.time()
    print("midduration", start1-end)
    print("endduration", end1-start1)
    print("EMBEDDINGLEN", len(embedding_2d))
    return embedding_2d.tolist(), grid, b_fig, label_name_dict, label_color_list, label_list, max_iter, training_data_index, testing_data_index, eval_new, prediction_list, selected_points, properties,error_message


def getVisError(context, EPOCH, TaskType):
    highlightedPointIndices = []
    all_data = get_train_test_data(context, EPOCH)

    train_data = context.train_representation_data(EPOCH)
    embedding_2d = get_embedding(context, all_data, EPOCH)
    if (TaskType == 'Classification'):
        high_pred = context.strategy.data_provider.get_pred(EPOCH, all_data).argmax(1)
        # project_embedding = context.strategy.projector.batch_project(EPOCH, train_data)
        # project_embedding1 = project_embedding
        # embed_difference = np.where(project_embedding != embedding_2d)[0]

        inv_high_dim_data = context.strategy.projector.batch_inverse(EPOCH, embedding_2d)
        inv_high_pred = context.strategy.data_provider.get_pred(EPOCH, inv_high_dim_data).argmax(1)
        highlightedPointIndices = np.where(high_pred != inv_high_pred)[0]
        # print(len(inv_high_dim_data))
        # print("invhighshape", inv_high_dim_data.shape)
        # print("embeddiffer", embed_difference)
        # print("embed2dlen", len(embedding_2d))
        # print("embed2dprojectlen",len(project_embedding))
        # print("invhighlen",len(inv_high_pred))

        print(high_pred)
        print(inv_high_pred)
        print(np.where(high_pred != inv_high_pred))
    elif (TaskType == 'Non-Classification'):
        inv_high_dim_data = context.strategy.projector.batch_inverse(EPOCH, embedding_2d)
        # todo, change train data to all data
        squared_distances = np.sum((all_data - inv_high_dim_data) ** 2, axis=1)
        squared_threshold = 1 ** 2
        highlightedPointIndices = np.where(squared_distances > squared_threshold)[0]
    else:
        return

    return highlightedPointIndices.tolist()

	
def getContraVisChangeIndices(context_left,context_right, iterationLeft, iterationRight, method):
   
    predChangeIndices = []
    
    train_data = context_left.train_representation_data(iterationLeft)
    test_data = context_left.test_representation_data(iterationLeft)
    all_data = np.concatenate((train_data, test_data), axis=0)
    embedding_path = os.path.join(context_left.strategy.data_provider.checkpoint_path(iterationLeft), "embedding.npy")
    if os.path.exists(embedding_path):
        embedding_2d = np.load(embedding_path)
    else:
        embedding_2d = context_left.strategy.projector.batch_project(iterationLeft, all_data)
        np.save(embedding_path, embedding_2d)
    last_train_data = context_right.train_representation_data(iterationRight)
    last_test_data = context_right.test_representation_data(iterationRight)
    last_all_data = np.concatenate((last_train_data, last_test_data), axis=0)
    last_embedding_path = os.path.join(context_right.strategy.data_provider.checkpoint_path(iterationRight), "embedding.npy")
    if os.path.exists(last_embedding_path):
        last_embedding_2d = np.load(last_embedding_path)
    else:
        last_embedding_2d = context_right.strategy.projector.batch_project(iterationRight, last_all_data)
        np.save(last_embedding_path, last_embedding_2d)
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
def getContraVisChangeIndicesSingle(context_left,context_right, iterationLeft, iterationRight, method, left_selected, right_selected):
    
    train_data = context_left.train_representation_data(iterationLeft)
    test_data = context_left.test_representation_data(iterationLeft)
    all_data = np.concatenate((train_data, test_data), axis=0)
    embedding_path = os.path.join(context_left.strategy.data_provider.checkpoint_path(iterationLeft), "embedding.npy")
    if os.path.exists(embedding_path):
        embedding_2d = np.load(embedding_path)
    else:
        embedding_2d = context_left.strategy.projector.batch_project(iterationLeft, all_data)
        np.save(embedding_path, embedding_2d)
    last_train_data = context_right.train_representation_data(iterationRight)
    last_test_data = context_right.test_representation_data(iterationRight)
    last_all_data = np.concatenate((last_train_data, last_test_data), axis=0)
    last_embedding_path = os.path.join(context_right.strategy.data_provider.checkpoint_path(iterationRight), "embedding.npy")
    if os.path.exists(last_embedding_path):
        last_embedding_2d = np.load(last_embedding_path)
    else:
        last_embedding_2d = context_right.strategy.projector.batch_project(iterationRight, last_all_data)
        np.save(last_embedding_path, last_embedding_2d)
    predChangeIndicesLeft = []
    predChangeIndicesRight = []
    predChangeIndicesLeft_Left = []
    predChangeIndicesLeft_Right = []
    predChangeIndicesRight_Left = []
    predChangeIndicesRight_Right = []
    if (method == "align"):
        predChangeIndicesLeft, predChangeIndicesRight = evaluate_isAlign_single(embedding_2d, last_embedding_2d, left_selected, right_selected)
    elif (method == "nearest neighbour"):
        predChangeIndicesLeft_Left, predChangeIndicesLeft_Right,predChangeIndicesRight_Left, predChangeIndicesRight_Right= evaluate_isNearestNeighbour_single(embedding_2d, last_embedding_2d, left_selected, right_selected)
    return predChangeIndicesLeft, predChangeIndicesRight, predChangeIndicesLeft_Left, predChangeIndicesLeft_Right, predChangeIndicesRight_Left, predChangeIndicesRight_Right

def getCriticalChangeIndices(context, curr_iteration, next_iteration):
    predChangeIndices = []
    
    all_data = get_train_test_data(context, curr_iteration)
    all_data_next = get_train_test_data(context, next_iteration)
  
    high_pred = context.strategy.data_provider.get_pred(curr_iteration, all_data).argmax(1)
    next_high_pred = context.strategy.data_provider.get_pred(next_iteration, all_data_next).argmax(1)
    predChangeIndices = np.where(high_pred != next_high_pred)[0]
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
    print("same")
    print(same_pred_indices)
    # get
    conf_diff = np.abs(high_conf[np.arange(len(high_conf)), high_pred_class] - last_high_conf[np.arange(len(last_high_conf)), last_high_pred_class])
    print("conf")
    print(conf_diff)
    significant_conf_change_indices = same_pred_indices[conf_diff[same_pred_indices] > confChangeInput]
    print("siginificant")
    print(significant_conf_change_indices)
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