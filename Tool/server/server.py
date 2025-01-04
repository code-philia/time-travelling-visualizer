from attr import dataclass
from flask import request, Flask, jsonify, make_response,render_template,send_from_directory
from flask_cors import CORS, cross_origin
import os
import gc
import sys
import json
import time
import pickle
import shutil
import base64
import numpy as np
from utils import *

sys.path.append('..')
sys.path.append('.')

# flask for API server
app = Flask(__name__, static_url_path='/static', static_folder='../Frontend')
cors = CORS(app, supports_credentials=True)
app.config['CORS_HEADERS'] = 'Content-Type'

# TODO:from where to get config path?
config_file ='/path/to/config.json'

# Check for "--dev" argument
is_dev_mode = "--dev" in sys.argv

@dataclass
class TempConfig:
    TASK_TYPE: str | None = None
    CONTENT_PATH: str | None = None
    EPOCH_START: int = 0
    EPOCH_END: int = 30
    EPOCH_PERIOD: int = 1

@app.route("/", methods=["GET", "POST"])
def GUI():
    return send_from_directory('../Frontend', 'index.html')

"""
Api: get epoch structure of one training process

Request:
    content_path (str)
    vis_method (str)
Response:
    structure (list[dict]): list of {epoch, previous_epoch}
"""
@app.route('/getIterationStructure', methods=["GET"])
@cross_origin()
def get_epoch_structure():
    content_path = request.args.get('content_path')
    available_epochs, error_message = epoch_structure_from_projection(content_path)

    if available_epochs is None:
        return make_response(jsonify({'error_message': error_message}), 400)

    result = jsonify({
        'available_epochs': available_epochs
    })
    return make_response(result, 200)


"""
Api: get minimum info of one epoch

Request:
    content_path (str)
    vis_method (str)
    epoch (str): epoch number
Response:
    config (dict)
    project (list)
    label_list (list): label list of samples in projection
"""
@app.route('/updateProjection', methods = ["POST"])
@cross_origin()
def update_projection():
    req = request.get_json()
    content_path = req['content_path']
    vis_method = req['vis_method']
    epoch = int(req['epoch'])

    config = read_file_as_json(os.path.join(content_path, 'config.json'))

    try:
        projection, label_list = load_projection(config, content_path, vis_method, epoch)
    except Exception as e:
        return make_response(jsonify({'error_message': 'Error in loading projection'}), 400)

    result = jsonify({
        'config': config,
        'proj': projection[:min(100,len(projection))],
        'labels': label_list[:min(100,len(label_list))],
        'label_text_list': config['dataset']['classes']
    })
    return make_response(result, 200)

"""
Api: get background image of one epoch

Request:
    content_path (str)
    vis_method (str)
    epoch (str)
Response:
    bgimg (str): base64 encoded image
"""
@app.route('/getBackgroundImage', methods = ["POST"])
@cross_origin()
def get_background_image():
    req = request.get_json()
    content_path = req['content_path']
    vis_method = req['vis_method']
    epoch = int(req['epoch'])

    config = read_file_as_json(os.path.join(content_path, 'config.json'))

    try:
        bgimg = load_background_image_base64(config, content_path, vis_method, epoch)
    except Exception as e:
        return make_response(jsonify({'error_message': 'Error in loading background image'}), 400)
    
    result = jsonify({
        'bgimg': bgimg # 'data:image/png;base64,' + img_stream
    })
    return make_response(result, 200)


"""
Api: get original data of one sample

Request:
    content_path (str)
    index (str): sample index
Response:
    type (str): data type (image, text, ...)
    sample (str): base64 encoded image or plain text
"""
@app.route('/getSample', methods = ["POST"])
def get_sample():
    req = request.get_json()
    content_path = req['content_path']
    index = int(req['index'])

    config = read_file_as_json(os.path.join(content_path, 'config.json'))

    try:
        data_type, data = load_one_sample(config, content_path, index)
    except Exception as e:
        return make_response(jsonify({'error_message': 'Error in loading sample'}), 400)

    result = jsonify({
        'type': data_type,
        'sample': data
    })
    return make_response(result, 200)


"""
Api: get text data of all samples

Request:
    content_path (str)
Response:
    text_list (lsit of str)
"""
@app.route('/getAllText', methods = ["POST"])
def get_all_text():
    req = request.get_json()
    content_path = req['content_path']

    config = read_file_as_json(os.path.join(content_path, 'config.json'))

    text_list, error_message = get_all_texts(config, content_path)

    if text_list is None:
        return make_response(jsonify({'error_message': error_message}), 400)

    result = jsonify({
        'text_list': text_list
    })
    return make_response(result, 200)


"""
Api: get all representation of one epoch

Request:
    content_path (str)
    epoch (str)
Response:
    representation (list)
"""
@app.route('/getRepresentation', methods = ["POST"])
@cross_origin()
def get_representation_at_epoch():
    req = request.get_json()
    content_path = req['content_path']
    epoch = int(req['epoch'])

    config = read_file_as_json(os.path.join(content_path, 'config.json'))

    try:
        repr = load_representation(config, content_path, epoch)
    except Exception as e:
        return make_response(jsonify({'error_message': 'Error in loading representation'}), 400)
    
    result = jsonify({
        'representation': repr
    })
    return make_response(result, 200)



"""
Api: get selected attributes of the dataset

Request:
    content_path (str)
    epoch (str): epoch number
    attributes (list): selected attributes
Response:
    attribute1 (object)
    attribute2 (object)
    ...
"""
@app.route('/getAttributes', methods = ["POST"])
@cross_origin()
def get_attributes():
    req = request.get_json()
    content_path = req['content_path']
    epoch = req['epoch']
    attributes = req['attributes']

    config = read_file_as_json(os.path.join(content_path, 'config.json'))

    result = {}
    for attribute in attributes:
        result[attribute] = load_single_attribute(config, content_path, epoch, attribute)

    result = jsonify(result)
    return make_response(result, 200)


"""
Api: get simple filter result

Request:
    content_path (str)
    epoch (str)
    filter_type (str): "label", "prediction", "train", "test"
    filter_data (str): label name
Response:
    indices (list of int): indeices of samples that satisfy the filter
"""
@app.route('/getSimpleFilterResult', methods = ["POST"])
@cross_origin()
def get_simple_filter_result():
    req = request.get_json()
    content_path = req['content_path']
    epoch = int(req['epoch'])
    filters = req['filters']

    config = read_file_as_json(os.path.join(content_path, 'config.json'))
    indices, error_message = get_filter_result(config, content_path, epoch, filters)

    if indices is None:
        return make_response(jsonify({'error_message': error_message}), 400)

    result = jsonify({
        'indices': indices
    })
    return make_response(result, 200)



""" ===================================================================== """
# Func: get iteration structure
def get_tree():
    # config = TempConfig()
    config = initialize_config(config_file)

    json_data = []
    previous_epoch = ""
    for epoch in range(config.EPOCH_START, config.EPOCH_END + 1, config.EPOCH_PERIOD):
        json_data.append({
            "value": epoch,
            "name": 'Epoch',
            "pid": previous_epoch if previous_epoch else ""
        })
        previous_epoch = epoch
    return make_response(jsonify({"structure":json_data}), 200)

# Func: load projection result of one epoch
def update_projection_old():
    # search filter
    req = request.get_json()
    iteration = int(req['iteration'])
    predicates = req['predicates']
    indicates = list(range(100)) # we now don't use req['selectedPoints'] to filter in backend

    # load config from config_file
    # config = TempConfig(req['taskType'], req['contentPath'])
    config = initialize_config(config_file)

    # load visualization result of one epoch
    if config.TASK_TYPE == 'classification' or config.TASK_TYPE == 'non-classification':

        embedding_2d, grid, decision_view, label_name_dict, label_color_list, label_list, max_iter, training_data_index, \
        testing_data_index, eval_new, prediction_list, selected_points, error_message_projection, color_list, \
            confidence_list = update_epoch_projection(config, iteration, predicates, indicates)

        # make response and return
        grid = np.array(grid)
        color_list = color_list.tolist()
        return make_response(jsonify({'result': embedding_2d,
                                    'grid_index': grid.tolist(),
                                    'grid_color': 'data:image/png;base64,' + decision_view,
                                    'label_name_dict':label_name_dict,
                                    'label_color_list': label_color_list,
                                    'label_list': label_list,
                                    'maximum_iteration': max_iter,
                                    'training_data': training_data_index,
                                    'testing_data': testing_data_index,
                                    'evaluation': eval_new,
                                    'prediction_list': prediction_list,
                                    "selectedPoints":selected_points.tolist(),
                                    "errorMessage": error_message_projection,
                                    "color_list": color_list,
                                    "confidence_list": confidence_list
                                    }), 200)
    elif config.TASK_TYPE == 'Umap-Neighborhood':
        result = get_umap_neighborhood_epoch_projection(config.CONTENT_PATH, iteration, predicates, indicates)
        return make_response(jsonify(result), 200)
    else:
        return make_response(jsonify({'error': 'TaskType not found'}), 400)

# Func: get sprite or text of one sample
@app.route('/spriteImage', methods = ["GET"])
@cross_origin()
def sprite_image():
    index = int(request.args.get("index"))

    # load config from config_file
    config = initialize_config(config_file)
    if config.DATA_TYPE == "image":
        pic_save_dir_path = os.path.join(config.CONTENT_PATH, "Dataset","sprites", "{}.png".format(index))
        img_stream = ""
        with open(pic_save_dir_path, 'rb') as img_f:
            img_stream = img_f.read()
            img_stream = base64.b64encode(img_stream).decode()
        return make_response(jsonify({"imgUrl":'data:image/png;base64,' + img_stream}), 200)
    elif config.DATA_TYPE == "text":
        if config.SHOW_LABEL:
            if index % 2 == 0: # source
                text_save_dir_path = os.path.join(config.CONTENT_PATH, "Dataset","source", "{}.txt".format(int(index/2)))
            else: # target
                text_save_dir_path = os.path.join(config.CONTENT_PATH, "Dataset","target", "{}.txt".format(int(index/2)))
        else:
            text_save_dir_path = os.path.join(config.CONTENT_PATH, "Dataset","source", "{}.txt".format(index))

        sprite_texts = ''
        with open(text_save_dir_path, 'r') as text_f:
            sprite_texts = text_f.read()
        return make_response(jsonify({"texts": sprite_texts}), 200)
    else:
        raise ValueError("Invalid data type in config")

@app.route('/spriteText', methods = ["GET"])
@cross_origin()
def sprite_text():
    index = int(request.args.get("index"))

    # load config from config_file
    config = initialize_config(config_file)

    if config.SHOW_LABEL:
        if index % 2 == 0: # source
            text_save_dir_path = os.path.join(config.CONTENT_PATH, "Dataset","source", "{}.txt".format(int(index/2)))
        else: # target
            text_save_dir_path = os.path.join(config.CONTENT_PATH, "Dataset","target", "{}.txt".format(int(index/2)))
    else:
        text_save_dir_path = os.path.join(config.CONTENT_PATH, "Dataset","source", "{}.txt".format(index))

    sprite_texts = ''
    if os.path.exists(text_save_dir_path):
        with open(text_save_dir_path, 'r') as text_f:
            sprite_texts = text_f.read()
    else:
        print("File does not exist:", text_save_dir_path)

    response_data = {
        "texts": sprite_texts
    }
    return make_response(jsonify(response_data), 200)

def check_port_inuse(port, host):
    import socket

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1)
        s.connect((host, port))
        return True
    except socket.error:
        return False
    finally:
        if s:
            s.close()

# for contrast
if __name__ == "__main__":
    host = '0.0.0.0'
    port = 5010
    while check_port_inuse(port, host):
        port = port + 1

    if not is_dev_mode:
        app.run(host=host, port=port)
    else:
        from livereload import Server
        from flask_debugtoolbar import DebugToolbarExtension

        app.debug = True
        app.config['SECRET_KEY'] = 'a-random-secret-key'
        toolbar = DebugToolbarExtension(app)

        server = Server(app.wsgi_app)

        server.watch('../Frontend/**/*.css')
        server.watch('../Frontend/**/*.html')
        server.watch('../Frontend/**/*.js')
        server.serve(host=host, port=port)
