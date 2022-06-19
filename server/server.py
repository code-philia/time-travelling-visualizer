
#! Noted that
#! iteration in frontend is start+(iteration -1)*period

# TODO change to timevis format
# TODO set a base class for some trainer functions... we dont need too many hyperparameters for frontend
# TODO fix gpu_id
# TODO refactor, similar function should be in utils
# TODO tidy up
# TODO return lb and ulb property
from PIL import Image

from flask import request, Flask, jsonify, make_response
from flask_cors import CORS, cross_origin
import base64
import os
import sys
import json
import time
import torch
import pandas as pd
import numpy as np

from torch.utils.data import DataLoader
from torch.utils.data import WeightedRandomSampler

from umap.umap_ import find_ab_params

timevis_path = "../../DLVisDebugger"
sys.path.append(timevis_path)
from singleVis.SingleVisualizationModel import SingleVisualizationModel
from singleVis.data import DataProvider
from singleVis.eval.evaluator import Evaluator
from singleVis.trainer import SingleVisTrainer
from singleVis.losses import ReconstructionLoss, UmapLoss, SingleVisLoss
from singleVis.visualizer import visualizer
from singleVis.custom_weighted_random_sampler import CustomWeightedRandomSampler
from singleVis.edge_dataset import DataHandler
from singleVis.eval.evaluator import Evaluator
from singleVis.spatial_edge_constructor import SingleEpochSpatialEdgeConstructor
from BackendAdapter import TimeVisBackend
from utils import *


# flask for API server
app = Flask(__name__)
cors = CORS(app, supports_credentials=True)
app.config['CORS_HEADERS'] = 'Content-Type'


@app.route('/updateProjection', methods=["POST", "GET"])
@cross_origin()
def update_projection():
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['path'])
    EPOCH = int(res['iteration'])
    predicates = res["predicates"]

    sys.path.append(CONTENT_PATH)
    timevis = initialize_backend(CONTENT_PATH, EPOCH)

    embedding_2d, grid, decision_view, label_color_list, label_list, max_iter, training_data_index, \
    testing_data_index, eval_new, prediction_list, selected_points, properties = update_epoch_projection(timevis, EPOCH, predicates)

    sys.path.remove(CONTENT_PATH)

    return make_response(jsonify({'result': embedding_2d, 'grid_index': grid, 'grid_color': decision_view,
                                  'label_color_list': label_color_list, 'label_list': label_list,
                                  'maximum_iteration': max_iter, 
                                  'training_data': training_data_index,
                                  'testing_data': testing_data_index, 'evaluation': eval_new,
                                  'prediction_list': prediction_list,
                                  "selectedPoints":selected_points.tolist(),
                                  "properties":properties.tolist()}), 200)

@app.route('/query', methods=["POST"])
@cross_origin()
def filter():
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['content_path'])
    EPOCH = int(res['iteration'])
    predicates = res["predicates"]

    sys.path.append(CONTENT_PATH)
    timevis = initialize_backend(CONTENT_PATH, EPOCH)

    training_data_number = timevis.hyperparameters["TRAINING"]["train_num"]
    testing_data_number = timevis.hyperparameters["TRAINING"]["test_num"]

    # current_index = timevis.get_epoch_index(EPOCH)
    # selected_points = np.arange(training_data_number + testing_data_number)[current_index]
    selected_points = np.arange(training_data_number + testing_data_number)
    for key in predicates.keys():
        if key == "label":
            tmp = np.array(timevis.filter_label(predicates[key], int(EPOCH)))
        elif key == "type":
            tmp = np.array(timevis.filter_type(predicates[key], int(EPOCH)))
        elif key == "confidence":
            # TODO
            continue
        else:
            tmp = np.arange(training_data_number + testing_data_number)
        selected_points = np.intersect1d(selected_points, tmp)
    sys.path.remove(CONTENT_PATH)

    return make_response(jsonify({"selectedPoints": selected_points.tolist()}), 200)


def image_cut_save(path, left, upper, right, lower, save_path):
    """
        所截区域图片保存
    :param path: 图片路径
    :param left: 区块左上角位置的像素点离图片左边界的距离
    :param upper：区块左上角位置的像素点离图片上边界的距离
    :param right：区块右下角位置的像素点离图片左边界的距离
    :param lower：区块右下角位置的像素点离图片上边界的距离
     故需满足：lower > upper、right > left
    :param save_path: 所截图片保存位置
    """
    img = Image.open(path)  # 打开图像
    box = (left, upper, right, lower)
    roi = img.crop(box)
    # print('img_stream',img_stream)
    # 保存截取的图片
    roi.save(save_path)
    # readImg(save_path)

@app.route('/sprite', methods=["POST","GET"])
@cross_origin()
def sprite_image():
    path = request.args.get("path")
    index=request.args.get("index")

    CONTENT_PATH = os.path.normpath(path)
    print('index', index)
    idx = int(index)
    pic_save_dir_path = os.path.join(CONTENT_PATH, "sprites", "{}.png".format(idx))
    img_stream = ''
    with open(pic_save_dir_path, 'rb') as img_f:
        img_stream = img_f.read()
        img_stream = base64.b64encode(img_stream).decode()
    image_type = "image/png"
    return make_response(jsonify({"imgUrl":img_stream}), 200)

@app.route('/json', methods=["POST","GET"])
@cross_origin()
def sprite_json():
    with open('graphic.json', 'r') as f:
       config = json.load(f)
    return make_response(jsonify({"imgUrl":config}), 200)
# if this is the main thread of execution first load the model and then start the server


@app.route('/al_query', methods=["POST"])
@cross_origin()
def al_query():
    data = request.get_json()
    CONTENT_PATH = os.path.normpath(data['content_path'])
    iteration = data["iteration"]
    strategy = data["strategy"]
    budget = int(data["budget"])
    sys.path.append(CONTENT_PATH)

    timevis = initialize_backend(CONTENT_PATH, iteration)
    indices = timevis.al_query(iteration, budget, strategy).tolist()

    sys.path.remove(CONTENT_PATH)
    return make_response(jsonify({"selectedPoints": indices}), 200)

@app.route('/al_train', methods=["POST"])
@cross_origin()
def al_train():
    data = request.get_json()
    CONTENT_PATH = os.path.normpath(data['content_path'])
    new_indices = data["newIndices"]
    iteration = data["iteration"]
    sys.path.append(CONTENT_PATH)

    timevis = initialize_backend(CONTENT_PATH, iteration)
    timevis.al_train(iteration, new_indices)

    from config import config
    NEW_ITERATION = iteration + 1
    timevis.vis_train(NEW_ITERATION, **config)

    # update iteration projection
    embedding_2d, grid, decision_view, label_color_list, label_list, _, training_data_index, \
    testing_data_index, eval_new, prediction_list, selected_points, properties = update_epoch_projection(timevis, NEW_ITERATION, dict())

    sys.path.remove(CONTENT_PATH)
    return make_response(jsonify({'result': embedding_2d, 'grid_index': grid, 'grid_color': decision_view,
                                  'label_color_list': label_color_list, 'label_list': label_list,
                                  'maximum_iteration': NEW_ITERATION, 'training_data': training_data_index,
                                  'testing_data': testing_data_index, 'evaluation': eval_new,
                                  'prediction_list': prediction_list,
                                  "selectedPoints":selected_points.tolist(),
                                  "properties":properties.tolist()}), 200)

@app.route('/al_suggest_similar', methods=["POST"])
@cross_origin()
def al_suggest_similar():
    data = request.get_json()
    CONTENT_PATH = os.path.normpath(data['content_path'])
    previous_indices = data["previousIndices"]
    current_indices = data["currentIndices"]
    iteration = data["iteration"]
    k = data["k"]
    
    sys.path.append(CONTENT_PATH)
    from config import config

    timevis = initialize_backend(CONTENT_PATH, iteration)

    # nearest neighbors
    # TODO
    indices = timevis.al_find_similar(iteration, k).tolist()

    sys.path.remove(CONTENT_PATH)
    return make_response(jsonify({"similarIndices": indices}), 200)

if __name__ == "__main__":
    with open('config.json', 'r') as f:
        config = json.load(f)
        ip_adress = config["ServerIP"]
        port = config["ServerPort"]
    app.run(host=ip_adress, port=int(port))
