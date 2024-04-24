from flask import request, Flask, jsonify, make_response,render_template,send_from_directory
from flask_cors import CORS, cross_origin

import base64
import os
import sys
import json
import pickle
import numpy as np
import gc
import shutil
sys.path.append('..')
sys.path.append('.')
from utils import get_comparison_coloring, get_coloring, getVisError, update_epoch_projection, initialize_backend, add_line, getConfChangeIndices, getContraVisChangeIndices, getContraVisChangeIndicesSingle,getCriticalChangeIndices, update_custom_epoch_projection, highlight_epoch_projection

import time
# flask for API server
app = Flask(__name__,static_folder='Frontend')
cors = CORS(app, supports_credentials=True)
app.config['CORS_HEADERS'] = 'Content-Type'

API_result_path = "./admin_API_result.csv"


import time

import numpy as np
from pymilvus import (
    connections,
    utility,
    FieldSchema, CollectionSchema, DataType,
    Collection,
)

fmt = "\n=== {:30} ===\n"
search_latency_fmt = "search latency = {:.4f}s"
# num_entities, dim = 3000, 8
code_entities = None
code_embeddings_collection = None
nl_entities = None
nl_embeddings_collection = None
@app.route('/loadVectorDB', methods=["POST", "GET"])
@cross_origin()
def load_vectorDB():
    global code_entities
    global code_embeddings_collection
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['path'])
    
    print(CONTENT_PATH)

    iteration = int(res['iteration'])
    
    EPOCH = int(iteration)

    code_path = CONTENT_PATH + '/Model/Epoch_' + str(EPOCH) + '/train_data.npy'
    code_embeddings = np.load(code_path)
    dim = code_embeddings.shape[1]

    print(fmt.format("start connecting to Milvus"))
    connections.connect("default", host="localhost", port="19530")

    has_code_embeddings = utility.has_collection("code_embeddings")

    print(f"Does collection code_embeddings exist in Milvus: {has_code_embeddings}")

    if has_code_embeddings:
        utility.drop_collection("code_embeddings")
    # utility.drop_collection("nl_embeddings")

    # Define fields for code_embeddings collection
    code_embeddings_fields = [
        FieldSchema(name="pk", dtype=DataType.VARCHAR, is_primary=True, auto_id=False, max_length=100),
        FieldSchema(name="code_embeddings", dtype=DataType.FLOAT_VECTOR, dim=dim)
    ]
    # Create schema for code_embeddings collection and nl_embeddings collection
    code_embeddings_schema = CollectionSchema(code_embeddings_fields, "code_embeddings in Milvus")

    print(fmt.format("Create collection `code_embeddings`"))
    code_embeddings_collection = Collection("code_embeddings", code_embeddings_schema, consistency_level="Strong")

    print(fmt.format("Start inserting entities"))
    # rng = np.random.default_rng(seed=19530)

    code_entities = [
        [str(i) for i in range(len(code_embeddings))],
        code_embeddings,    # field embeddings, supports numpy.ndarray and list
    ]

    batch_size = 1000  # 调整批次大小
    num_batches = len(code_entities[0]) // batch_size

    for i in range(num_batches):
        start = i * batch_size
        end = (i + 1) * batch_size
        batch_entities = [entity[start:end] for entity in code_entities]
        code_insert_result = code_embeddings_collection.insert(batch_entities)

    remaining_entities = [entity[num_batches * batch_size:] for entity in code_entities]
    if remaining_entities and any(remaining_entities):
        code_insert_result = code_embeddings_collection.insert(remaining_entities)

    # hello_milvus.flush()
    print(f"Number of code entities in Milvus: {code_embeddings_collection.num_entities}")  # check the num_entites

    print(fmt.format("Start Creating index IVF_FLAT"))
    index = {
        "index_type": "IVF_FLAT",
        "metric_type": "L2",
        "params": {"nlist": 128},
    }

    code_embeddings_collection.create_index("code_embeddings", index)

    print(fmt.format("Start loading"))
    code_embeddings_collection.load()

    return make_response(jsonify({}), 200)

@app.route('/contrastloadVectorDBCode', methods=["POST", "GET"])
@cross_origin()
def load_vectorDB_code():
    global code_entities
    global code_embeddings_collection
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['path'])
    
    print(CONTENT_PATH)

    iteration = int(res['iteration'])
    
    EPOCH = int(iteration)

    code_path = CONTENT_PATH + '/Model/Epoch_' + str(EPOCH) + '/train_data.npy'
    code_embeddings = np.load(code_path)
    dim = code_embeddings.shape[1]

    print(fmt.format("start connecting to Milvus"))
    connections.connect("default", host="localhost", port="19530")

    has_code_embeddings = utility.has_collection("code_embeddings")

    print(f"Does collection code_embeddings exist in Milvus: {has_code_embeddings}")
    if has_code_embeddings:
        utility.drop_collection("code_embeddings")
    # utility.drop_collection("code_embeddings")
    # utility.drop_collection("nl_embeddings")

    # Define fields for code_embeddings collection
    code_embeddings_fields = [
        FieldSchema(name="pk", dtype=DataType.VARCHAR, is_primary=True, auto_id=False, max_length=100),
        FieldSchema(name="code_embeddings", dtype=DataType.FLOAT_VECTOR, dim=dim)
    ]
    # Create schema for code_embeddings collection and nl_embeddings collection
    code_embeddings_schema = CollectionSchema(code_embeddings_fields, "code_embeddings in Milvus")

    print(fmt.format("Create collection `code_embeddings`"))
    code_embeddings_collection = Collection("code_embeddings", code_embeddings_schema, consistency_level="Strong")

    print(fmt.format("Start inserting entities"))
    # rng = np.random.default_rng(seed=19530)

    code_entities = [
        [str(i) for i in range(len(code_embeddings))],
        code_embeddings,    # field embeddings, supports numpy.ndarray and list
    ]

    batch_size = 1000  # 调整批次大小
    num_batches = len(code_entities[0]) // batch_size

    for i in range(num_batches):
        start = i * batch_size
        end = (i + 1) * batch_size
        batch_entities = [entity[start:end] for entity in code_entities]
        code_insert_result = code_embeddings_collection.insert(batch_entities)

    remaining_entities = [entity[num_batches * batch_size:] for entity in code_entities]
    if remaining_entities and any(remaining_entities):
        code_insert_result = code_embeddings_collection.insert(remaining_entities)

    print(f"Number of code entities in Milvus: {code_embeddings_collection.num_entities}")  # check the num_entites

    print(fmt.format("Start Creating index IVF_FLAT"))
    index = {
        "index_type": "IVF_FLAT",
        "metric_type": "L2",
        "params": {"nlist": 128},
    }

    code_embeddings_collection.create_index("code_embeddings", index)

    print(fmt.format("Start loading"))
    code_embeddings_collection.load()

    return make_response(jsonify({}), 200)

@app.route('/contrastloadVectorDBNl', methods=["POST", "GET"])
@cross_origin()
def load_vectorDB_nl():
    global nl_entities
    global nl_embeddings_collection
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['path'])
    
    print(CONTENT_PATH)

    iteration = int(res['iteration'])
    
    EPOCH = int(iteration)

    nl_path = CONTENT_PATH + '/Model/Epoch_' + str(EPOCH) + '/train_data.npy'
    nl_embeddings = np.load(nl_path)
    dim = nl_embeddings.shape[1]

    print(fmt.format("start connecting to Milvus"))
    connections.connect("default", host="localhost", port="19530")

    has_nl_embeddings = utility.has_collection("nl_embeddings")

    print(f"Does collection nl_embeddings exist in Milvus: {has_nl_embeddings}")
    if has_nl_embeddings:
        utility.drop_collection("nl_embeddings")
    # utility.drop_collection("code_embeddings")
    # utility.drop_collection("nl_embeddings")

    # Define fields for code_embeddings collection
    nl_embeddings_fields = [
        FieldSchema(name="pk", dtype=DataType.VARCHAR, is_primary=True, auto_id=False, max_length=100),
        FieldSchema(name="nl_embeddings", dtype=DataType.FLOAT_VECTOR, dim=dim)
    ]
    # Create schema for code_embeddings collection and nl_embeddings collection
    nl_embeddings_schema = CollectionSchema(nl_embeddings_fields, "nl_embeddings in Milvus")

    print(fmt.format("Create collection `nl_embeddings`"))
    nl_embeddings_collection = Collection("nl_embeddings", nl_embeddings_schema, consistency_level="Strong")

    print(fmt.format("Start inserting entities"))
    # rng = np.random.default_rng(seed=19530)

    nl_entities = [
        [str(i) for i in range(len(nl_embeddings))],
        nl_embeddings,    # field embeddings, supports numpy.ndarray and list
    ]

    nl_batch_size = 1000  # 调整批次大小
    nl_num_batches = len(nl_entities[0]) // nl_batch_size

    for i in range(nl_num_batches):
        start = i * nl_batch_size
        end = (i + 1) * nl_batch_size
        batch_entities = [entity[start:end] for entity in nl_entities]
        nl_insert_result = nl_embeddings_collection.insert(batch_entities)

    remaining_entities = [entity[nl_num_batches * nl_batch_size:] for entity in nl_entities]
    if remaining_entities and any(remaining_entities):
        nl_insert_result = nl_embeddings_collection.insert(remaining_entities)

    # hello_milvus.flush()
    print(f"Number of nl entities in Milvus: {nl_embeddings_collection.num_entities}")  # check the num_entites

    print(fmt.format("Start Creating index IVF_FLAT"))
    index = {
        "index_type": "IVF_FLAT",
        "metric_type": "L2",
        "params": {"nlist": 128},
    }

    nl_embeddings_collection.create_index("nl_embeddings", index)

    print(fmt.format("Start loading"))
    nl_embeddings_collection.load()

    return make_response(jsonify({}), 200)


@app.route('/updateProjection', methods=["POST", "GET"])
@cross_origin()
def update_projection():
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['path'])
    VIS_METHOD = res['vis_method']
    SETTING = res["setting"]
    print(CONTENT_PATH,VIS_METHOD,SETTING)
    start = time.time()
    iteration = int(res['iteration'])
    predicates = res["predicates"]
    # username = res['username']
    TaskType = res['TaskType']
    s = res['selectedPoints']
    if s == '':
        indicates = []
    else:
        try:
            indicates = [int(item) for item in s.split(",") if item.isdigit()]
        except ValueError:
            # 处理或记录错误
            print("Some items in the string cannot be converted to integers.")
            indicates = []  # 或者根据你的需要进行其他处理
        
    # sys.path.append(CONTENT_PATH)
    context, error_message_context = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
    # use the true one
    # EPOCH = (iteration-1)*context.strategy.data_provider.p + context.strategy.data_provider.s
    EPOCH = int(iteration)
    
    embedding_2d, grid, decision_view, label_name_dict, label_color_list, label_list, max_iter, training_data_index, \
    testing_data_index, eval_new, prediction_list, selected_points, properties, error_message_projection = update_epoch_projection(context, EPOCH, predicates, TaskType,indicates)
    end = time.time()
    print("label_colorlenUpdate", len(label_color_list))
    print("duration", end-start)
    # sys.path.remove(CONTENT_PATH)
    # add_line(API_result_path,['TT',username])
    grid = np.array(grid)
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
                                  "properties":properties.tolist(),
                                  "errorMessage": error_message_context + error_message_projection
                                  }), 200)

app.route('/contrast/updateProjection', methods=["POST", "GET"])(update_projection)

@app.route('/getOriginalColors', methods=["POST", "GET"])
@cross_origin()
def get_original_colors():
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['content_path'])
    VIS_METHOD = res['vis_method']
    SETTING = res["setting"]
    iteration = int(res['iteration'])
    ColorType = res['ColorType']

    context, error_message_context = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
    EPOCH = int(iteration)
    print("colortype", ColorType)
    label_color_list = get_coloring(context, EPOCH, ColorType)
    print("label_colorlen", len(label_color_list))
    return make_response(jsonify({
                                  'label_color_list': label_color_list,        
                                  "errorMessage": error_message_context
                                  }), 200)

app.route('/contrast/getOriginalColors', methods=["POST", "GET"])(get_original_colors)

@app.route('/contrast/getComparisonColors', methods=["POST", "GET"])
@cross_origin()
def get_comparison_colors():
    res = request.get_json()
    CONTENT_PATH_LEFT = os.path.normpath(res['content_path_left'])
    CONTENT_PATH_RIGHT = os.path.normpath(res['content_path_right'])
    VIS_METHOD_LEFT = res['vis_method_left']
    VIS_METHOD_RIGHT = res['vis_method_right']
    SETTING = res["setting"]
    iteration_left = int(res['iterationLeft'])
    iteration_right = int(res['iterationRight'])

    context_left, error_message_context = initialize_backend(CONTENT_PATH_LEFT, VIS_METHOD_LEFT, SETTING)
    context_right, error_message_context = initialize_backend(CONTENT_PATH_RIGHT, VIS_METHOD_RIGHT, SETTING)
    EPOCH_LEFT = int(iteration_left)
    EPOCH_RIGHT = int(iteration_right)

    label_color_list = get_comparison_coloring(context_left, context_right, EPOCH_LEFT, EPOCH_RIGHT)
    print("label_colorlen", len(label_color_list))
    return make_response(jsonify({
                                  'label_color_list': label_color_list,        
                                  "errorMessage": error_message_context
                                  }), 200)

@app.route('/updateCustomProjection', methods=["POST", "GET"])
@cross_origin()
def update_custom_projection():
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['path'])
    CUSTOM_PATH = os.path.normpath(res['cus_path'])
    VIS_METHOD = res['vis_method']
    SETTING = res["setting"]
    print(CONTENT_PATH,VIS_METHOD,SETTING)
    start = time.time()
    iteration = int(res['iteration'])
    predicates = res["predicates"]
    # username = res['username']
    TaskType = res['TaskType']
    s = res['selectedPoints']
    if s == '':
        indicates = []
    else:
        try:
            indicates = [int(item) for item in s.split(",") if item.isdigit()]
        except ValueError:
            # 处理或记录错误
            print("Some items in the string cannot be converted to integers.")
            indicates = []  # 或者根据你的需要进行其他处理
        
    # sys.path.append(CONTENT_PATH)
    context, error_message_context = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
    # use the true one
    # EPOCH = (iteration-1)*context.strategy.data_provider.p + context.strategy.data_provider.s
    EPOCH = int(iteration)
    
    embedding_2d, grid, decision_view, label_name_dict, label_color_list, label_list, max_iter, training_data_index, \
    testing_data_index, eval_new, prediction_list, selected_points, properties, error_message_projection = update_custom_epoch_projection(context, EPOCH, predicates, TaskType,indicates, CUSTOM_PATH)
    end = time.time()
    print("duration", end-start)
    # sys.path.remove(CONTENT_PATH)
    # add_line(API_result_path,['TT',username])
    grid = np.array(grid)
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
                                  "properties":properties.tolist(),
                                  "errorMessage": error_message_context + error_message_projection
                                  }), 200)

@app.route('/highlightContraProjection', methods=["POST", "GET"])
@cross_origin()
def highlight_projection():
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['path'])
    VIS_METHOD = res['vis_method']
    SETTING = res["setting"]
    print(CONTENT_PATH,VIS_METHOD,SETTING)
    start = time.time()
    iteration = int(res['iteration'])
    predicates = res["predicates"]
    # username = res['username']
    TaskType = res['TaskType']
    s = res['selectedPoints']
    if s == '':
        indicates = []
    else:
        try:
            indicates = [int(item) for item in s.split(",") if item.isdigit()]
        except ValueError:
            # 处理或记录错误
            print("Some items in the string cannot be converted to integers.")
            indicates = []  # 或者根据你的需要进行其他处理
        
    # sys.path.append(CONTENT_PATH)
    context, error_message_context = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
    # use the true one
    # EPOCH = (iteration-1)*context.strategy.data_provider.p + context.strategy.data_provider.s
    EPOCH = int(iteration)
    
    embedding_2d, grid, decision_view, label_name_dict, label_color_list, label_list, max_iter, training_data_index, \
    testing_data_index, eval_new, prediction_list, selected_points, properties, error_message_projection = highlight_epoch_projection(context, EPOCH, predicates, TaskType,indicates)
    end = time.time()
    print("duration", end-start)
    # sys.path.remove(CONTENT_PATH)
    # add_line(API_result_path,['TT',username])
    grid = np.array(grid)
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
                                  "properties":properties.tolist(),
                                  "errorMessage": error_message_context + error_message_projection
                                  }), 200)

@app.route('/query', methods=["POST"])
@cross_origin()
def filter():
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['content_path'])
    VIS_METHOD = res['vis_method']
    SETTING = res["setting"]

    iteration = int(res['iteration'])
    predicates = res["predicates"]
    username = res['username']

    sys.path.append(CONTENT_PATH)
    context, error_message = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
    # TODO: fix when active learning
    EPOCH = iteration

    training_data_number = context.strategy.config["TRAINING"]["train_num"]
    testing_data_number = context.strategy.config["TRAINING"]["test_num"]

    current_index = context.get_epoch_index(EPOCH)
    selected_points = np.arange(training_data_number)[current_index]
    selected_points = np.concatenate((selected_points, np.arange(training_data_number, training_data_number + testing_data_number, 1)), axis=0)
    # selected_points = np.arange(training_data_number + testing_data_number)
    for key in predicates.keys():
        if key == "label":
            tmp = np.array(context.filter_label(predicates[key], int(EPOCH)))
        elif key == "type":
            tmp = np.array(context.filter_type(predicates[key], int(EPOCH)))
        elif key == "confidence":
            tmp = np.array(context.filter_conf(predicates[key][0],predicates[key][1],int(EPOCH)))
        else:
            tmp = np.arange(training_data_number + testing_data_number)
        selected_points = np.intersect1d(selected_points, tmp)
    sys.path.remove(CONTENT_PATH)
    # add_line(API_result_path,['SQ',username])
    return make_response(jsonify({"selectedPoints": selected_points.tolist()}), 200)



# base64
@app.route('/spriteImage', methods=["POST","GET"])
@cross_origin()
def sprite_image():
    path = request.args.get("path")
    index = request.args.get("index")
    username = request.args.get("username")

    CONTENT_PATH = os.path.normpath(path)
    print('index', index)
    idx = int(index)
    abnorm_idx_list = []
    abnorm_idx_path = os.path.join(CONTENT_PATH, "Model", "new_index.json")
    if os.path.isfile(abnorm_idx_path):
        with open(abnorm_idx_path, "r") as f:
            idxs = json.load(f)

        for index in idxs:
            abnorm_idx_list.append(index)

        pic_save_dir_path = os.path.join(CONTENT_PATH, "sprites", "{}.png".format(abnorm_idx_list[idx]))
    else:
        pic_save_dir_path = os.path.join(CONTENT_PATH, "sprites", "{}.png".format(idx))
    img_stream = ''
    with open(pic_save_dir_path, 'rb') as img_f:
        img_stream = img_f.read()
        img_stream = base64.b64encode(img_stream).decode()
    # add_line(API_result_path,['SI',username])
    return make_response(jsonify({"imgUrl":'data:image/png;base64,' + img_stream}), 200)

app.route('/contrast/spriteImage', methods=["POST", "GET"])(sprite_image)

@app.route('/spriteText', methods=["POST","GET"])
@cross_origin()
def sprite_text():
    path = request.args.get("path")
    index = request.args.get("index")
    iteration = request.args.get("iteration")
    cus_path = request.args.get("cus_path")
    # filter_indices = request.args.get("filter_index")
    
    CONTENT_PATH = os.path.normpath(path)
    idx = int(index)
    start = time.time()

    # if filter_indices !='':
    #     filter_index = filter_indices.split(',')
    #     idx = filter_index[int(index)]
    # else:
    #     idx = int(index)
    
    if cus_path != '':
        text_save_dir_path = os.path.join(CONTENT_PATH, f"Model/Epoch_{iteration}/custom_labels",  "text_{}.txt".format(idx))
    else:
        text_save_dir_path = os.path.join(CONTENT_PATH, f"Model/Epoch_{iteration}/labels",  "text_{}.txt".format(idx))
    sprite_texts = ''
    if os.path.exists(text_save_dir_path):
        with open(text_save_dir_path, 'r') as text_f:
            # Read the contents of the file and store it in sprite_texts
            sprite_texts = text_f.read()
    else:
        print("File does not exist:", text_save_dir_path)
  
    response_data = {
        "texts": sprite_texts
    }
    end = time.time()
    print("processTime", end-start)
    return make_response(jsonify(response_data), 200)

app.route('/contrast/spriteText', methods=["POST", "GET"])(sprite_text)

@app.route('/spriteList', methods=["POST"])
@cross_origin()
def sprite_list_image():
    data = request.get_json()
    indices = data["index"]
    path = data["path"]

    CONTENT_PATH = os.path.normpath(path)
    length = len(indices)
    urlList = {}

    for i in range(length):
        idx = indices[i]
        pic_save_dir_path = os.path.join(CONTENT_PATH, "sprites", "{}.png".format(idx))
        img_stream = ''
        with open(pic_save_dir_path, 'rb') as img_f:
            img_stream = img_f.read()
            img_stream = base64.b64encode(img_stream).decode()
            urlList[idx] = 'data:image/png;base64,' + img_stream
            # urlList.append('data:image/png;base64,' + img_stream)
    return make_response(jsonify({"urlList":urlList}), 200)

app.route('/contrast/spriteList', methods=["POST", "GET"])(sprite_list_image)

# contrast Not use spriteList?

@app.route('/highlightConfChange', methods=["POST", "GET"])
@cross_origin()
def highlight_conf_change():
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['path'])
    VIS_METHOD = res['vis_method']
    SETTING = res["setting"]
    curr_iteration = int(res['iteration'])
    last_iteration = int(res['last_iteration'])
    confChangeInput = float(res['confChangeInput'])
    print(confChangeInput)
    # sys.path.append(CONTENT_PATH)
    context, error_message = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
  
    confChangeIndices = getConfChangeIndices(context, curr_iteration, last_iteration, confChangeInput)
    print(confChangeIndices)
    # sys.path.remove(CONTENT_PATH)
    # add_line(API_result_path,['TT',username])
    return make_response(jsonify({
                                  "confChangeIndices": confChangeIndices.tolist()
                                  }), 200)

@app.route('/contrast/contraVisHighlightSingle', methods=["POST", "GET"])
@cross_origin()
def contravis_highlight_single():
    start_time = time.time()
    res = request.get_json()
    CONTENT_PATH_LEFT = res['content_path_left']
    CONTENT_PATH_RIGHT = res['content_path_right']
    VIS_METHOD_LEFT = res['vis_method_left']
    VIS_METHOD_RIGHT = res['vis_method_right']
    SETTING = res["setting"]
    curr_iteration = int(res['iterationLeft'])
    last_iteration = int(res['iterationRight'])
    method = res['method']
    left_selected = res['selectedPointLeft']
    right_selected = res['selectedPointRight']
    
    context_left, error_message = initialize_backend(CONTENT_PATH_LEFT, VIS_METHOD_LEFT, SETTING)
    context_right, error_message = initialize_backend(CONTENT_PATH_RIGHT, VIS_METHOD_RIGHT, SETTING)
  
    contraVisChangeIndicesLeft, contraVisChangeIndicesRight, contraVisChangeIndicesLeftLeft, contraVisChangeIndicesLeftRight, contraVisChangeIndicesRightLeft, contraVisChangeIndicesRightRight = getContraVisChangeIndicesSingle(context_left,context_right, curr_iteration, last_iteration, method, left_selected, right_selected)
    end_time = time.time()
    elapsed_time = end_time - start_time
    print(elapsed_time)
    return make_response(jsonify({
                                  "contraVisChangeIndicesLeft": contraVisChangeIndicesLeft,
                                  "contraVisChangeIndicesRight": contraVisChangeIndicesRight,
                                  "contraVisChangeIndicesLeftLeft": contraVisChangeIndicesLeftLeft,
                                  "contraVisChangeIndicesLeftRight": contraVisChangeIndicesLeftRight,
                                  "contraVisChangeIndicesRightLeft": contraVisChangeIndicesRightLeft,
                                  "contraVisChangeIndicesRightRight": contraVisChangeIndicesRightRight
                                  }), 200)


@app.route('/contrast/contraVisHighlight', methods=["POST", "GET"])
@cross_origin()
def contravis_highlight():
    res = request.get_json()
    VIS_METHOD_LEFT = res['vis_method_left']
    VIS_METHOD_RIGHT = res['vis_method_right']
    SETTING = res["setting"]
    curr_iteration = int(res['iterationLeft'])
    last_iteration = int(res['iterationRight'])
    method = res['method']
    CONTENT_PATH_LEFT = res['content_path_left']
    CONTENT_PATH_RIGHT = res['content_path_right']
    
    context_left, error_message = initialize_backend(CONTENT_PATH_LEFT, VIS_METHOD_LEFT, SETTING)
    context_right, error_message = initialize_backend(CONTENT_PATH_RIGHT, VIS_METHOD_RIGHT, SETTING)
    contraVisChangeIndices = getContraVisChangeIndices(context_left,context_right, curr_iteration, last_iteration, method)
    print(len(contraVisChangeIndices))
    return make_response(jsonify({
                                  "contraVisChangeIndices": contraVisChangeIndices
                                  }), 200)


@app.route('/getVisualizationError', methods=["POST", "GET"])
@cross_origin()
def get_visualization_error():
    start_time = time.time()
    res = request.get_json()
    CONTENT_PATH= res['content_path']
 
    VIS_METHOD = res['vis_method']
    SETTING = res["setting"]
    curr_iteration = int(res['iteration'])

    method = res['method']
    print("vismethod", VIS_METHOD)
    context, error_message= initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)

    visualization_error = getVisError(context, curr_iteration,  method)
    end_time = time.time()
    elapsed_time = end_time - start_time
    print(elapsed_time)
    print(len(visualization_error))
    return make_response(jsonify({
                                  "visualizationError": visualization_error,       
                                  }), 200)

app.route('/contrast/getVisualizationError', methods=["POST", "GET"])(get_visualization_error)

@app.route('/getPredictionFlipIndices', methods=["POST", "GET"])
@cross_origin()
def highlight_critical_change():
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['content_path'])
    VIS_METHOD = res['vis_method']
    SETTING = res["setting"]
    curr_iteration = int(res['iteration'])
    next_iteration = int(res['next_iteration'])

    context, error_message = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
  
    predChangeIndices = getCriticalChangeIndices(context, curr_iteration, next_iteration)
    # print("predchagenInd", predChangeIndices)
    return make_response(jsonify({
                                  "predChangeIndices": predChangeIndices.tolist()
                                  }), 200)

app.route('/contrast/getPredictionFlipIndices', methods=["POST", "GET"])(highlight_critical_change)

@app.route('/al_query', methods=["POST"])
@cross_origin()
def al_query():
    data = request.get_json()
    CONTENT_PATH = os.path.normpath(data['content_path'])
    VIS_METHOD = data['vis_method']
    SETTING = data["setting"]

    # TODO fix iteration, align with frontend
    iteration = data["iteration"]
    strategy = data["strategy"]
    budget = int(data["budget"])
    acc_idxs = data["accIndices"]
    rej_idxs = data["rejIndices"]
    user_name = data["username"]
    isRecommend = data["isRecommend"]

    sys.path.append(CONTENT_PATH)
    context, error_message = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING, dense=True)
    # TODO add new sampling rule
    indices, labels, scores = context.al_query(iteration, budget, strategy, np.array(acc_idxs).astype(np.int64), np.array(rej_idxs).astype(np.int64))

    sort_i = np.argsort(-scores)
    indices = indices[sort_i]
    labels = labels[sort_i]
    scores = scores[sort_i]

    sys.path.remove(CONTENT_PATH)
    if not isRecommend: 
       #  add_line(API_result_path,['Feedback', user_name]) 
        print()
    else:
       #  add_line(API_result_path,['Recommend', user_name])
        print()
    return make_response(jsonify({"selectedPoints": indices.tolist(), "scores": scores.tolist(), "suggestLabels":labels.tolist()}), 200)

@app.route('/anomaly_query', methods=["POST"])
@cross_origin()
def anomaly_query():
    data = request.get_json()
    CONTENT_PATH = os.path.normpath(data['content_path'])
    VIS_METHOD = data['vis_method']
    SETTING = data["setting"]

    budget = int(data["budget"])
    strategy = data["strategy"]
    acc_idxs = data["accIndices"]
    rej_idxs = data["rejIndices"]
    user_name = data["username"]
    isRecommend = data["isRecommend"]

    sys.path.append(CONTENT_PATH)
    context, error_message = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)

    context.save_acc_and_rej(acc_idxs, rej_idxs, user_name)
    indices, scores, labels = context.suggest_abnormal(strategy, np.array(acc_idxs).astype(np.int64), np.array(rej_idxs).astype(np.int64), budget)
    clean_list,_ = context.suggest_normal(strategy, np.array(acc_idxs).astype(np.int64), np.array(rej_idxs).astype(np.int64), 1)

    sort_i = np.argsort(-scores)
    indices = indices[sort_i]
    labels = labels[sort_i]
    scores = scores[sort_i]

    sys.path.remove(CONTENT_PATH)
    if not isRecommend: 
       #  add_line(API_result_path,['Feedback', user_name]) 
        print()
    else:
        # add_line(API_result_path,['Recommend', user_name])
        print()
    return make_response(jsonify({"selectedPoints": indices.tolist(), "scores": scores.tolist(), "suggestLabels":labels.tolist(),"cleanList":clean_list.tolist()}), 200)

@app.route('/al_train', methods=["POST"])
@cross_origin()
def al_train():
    data = request.get_json()
    CONTENT_PATH = os.path.normpath(data['content_path'])
    VIS_METHOD = data['vis_method']
    SETTING = data["setting"]

    acc_idxs = data["accIndices"]
    rej_idxs = data["rejIndices"]
    iteration = data["iteration"]
    user_name = data["username"]

    sys.path.append(CONTENT_PATH)
    # default setting al_train is light version, we only save the last epoch
    
    context, error_message = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
    context.save_acc_and_rej(iteration, acc_idxs, rej_idxs, user_name)
    context.al_train(iteration, acc_idxs)
    NEW_ITERATION =  context.get_max_iter()
    context.vis_train(NEW_ITERATION, iteration)

    # update iteration projection
    embedding_2d, grid, decision_view, label_name_dict, label_color_list, label_list, _, training_data_index, \
    testing_data_index, eval_new, prediction_list, selected_points, properties, _, _ = update_epoch_projection(context, NEW_ITERATION, dict(),None)
    
    # rewirte json =========
    res_json_path = os.path.join(CONTENT_PATH, "iteration_structure.json")
    with open(res_json_path,encoding='utf8')as fp:
        json_data = json.load(fp)

        json_data.append({'value': NEW_ITERATION, 'name': 'iteration', 'pid': iteration})
        print('json_data',json_data)
    with open(res_json_path,'w')as r:
      json.dump(json_data, r)
    r.close()
    # rewirte json =========

    del config
    gc.collect()

    sys.path.remove(CONTENT_PATH)
 
   # add_line(API_result_path,['al_train', user_name])
    return make_response(jsonify({'result': embedding_2d, 'grid_index': grid, 'grid_color': 'data:image/png;base64,' + decision_view,
                                  'label_name_dict': label_name_dict,
                                  'label_color_list': label_color_list, 'label_list': label_list,
                                  'maximum_iteration': NEW_ITERATION, 'training_data': training_data_index,
                                  'testing_data': testing_data_index, 'evaluation': eval_new,
                                  'prediction_list': prediction_list,
                                  "selectedPoints":selected_points.tolist(),
                                  "properties":properties.tolist()}), 200)

def clear_cache(con_paths):
    for CONTENT_PATH in con_paths.values():
        ac_flag = False
        target_path = os.path.join(CONTENT_PATH, "Model")
        dir_list = os.listdir(target_path)
        for dir in dir_list:
            if "Iteration_" in dir:
                ac_flag=True
                i = int(dir.replace("Iteration_", ""))
                if i > 2:
                    shutil.rmtree(os.path.join(target_path, dir))
        if ac_flag:
            iter_structure_path = os.path.join(CONTENT_PATH, "iteration_structure.json")
            with open(iter_structure_path, "r") as f:
                i_s = json.load(f)
            new_is = list()
            for item in i_s:
                value = item["value"]
                if value < 3:
                    new_is.append(item)
            with open(iter_structure_path, "w") as f:
                json.dump(new_is, f)
            print("Successfully remove cache data!")


@app.route('/login', methods=["POST"])
@cross_origin()
def login():
    data = request.get_json()
    # username = data["username"]
    # password = data["password"]
    content_path = data["content_path"]
    # clear_cache(con_paths)

    # Verify username and password
    return make_response(jsonify({"normal_content_path": content_path, "unormaly_content_path": content_path}), 200)

@app.route('/boundingbox_record', methods=["POST"])
@cross_origin()
def record_bb():
    data = request.get_json()
    username = data['username']
    # add_line(API_result_path,['boundingbox', username])  
    return make_response(jsonify({}), 200)
  
@app.route('/all_result_list', methods=["POST"])
@cross_origin()
def get_res():
    data = request.get_json()
    CONTENT_PATH = os.path.normpath(data['content_path'])
    VIS_METHOD = data['vis_method']
    SETTING = data["setting"]
    username = data["username"]

    predicates = dict() # placeholder

    results = dict()
    imglist = dict()
    gridlist = dict()

    sys.path.append(CONTENT_PATH)
    context, error_message = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
    
    EPOCH_START = context.strategy.config["EPOCH_START"]
    EPOCH_PERIOD = context.strategy.config["EPOCH_PERIOD"]
    EPOCH_END = context.strategy.config["EPOCH_END"]

    # TODO Interval to be decided
    epoch_num = (EPOCH_END - EPOCH_START)// EPOCH_PERIOD + 1

    for i in range(1, epoch_num+1, 1):
        EPOCH = (i-1)*EPOCH_PERIOD + EPOCH_START

        timevis , error_message= initialize_backend(CONTENT_PATH)

        # detect whether we have query before
        fname = "Epoch" if timevis.data_provider.mode == "normal" or timevis.data_provider.mode == "abnormal" else "Iteration"
        checkpoint_path = context.strategy.data_provider.checkpoint_path(EPOCH)
        bgimg_path = os.path.join(checkpoint_path, "bgimg.png")
        embedding_path = os.path.join(checkpoint_path, "embedding.npy")
        grid_path = os.path.join(checkpoint_path, "grid.pkl")
        if os.path.exists(bgimg_path) and os.path.exists(embedding_path) and os.path.exists(grid_path):
            path = os.path.join(timevis.data_provider.model_path, "{}_{}".format(fname, EPOCH))
            result_path = os.path.join(path,"embedding.npy")
            results[str(i)] = np.load(result_path).tolist()
            with open(os.path.join(path, "grid.pkl"), "rb") as f:
                grid = pickle.load(f)
            gridlist[str(i)] = grid
        else:
            embedding_2d, grid, _, _, _, _, _, _, _, _, _, _, _, _,_  = update_epoch_projection(timevis, EPOCH, predicates, None)
            results[str(i)] = embedding_2d
            gridlist[str(i)] = grid
        # read background img
        with open(bgimg_path, 'rb') as img_f:
            img_stream = img_f.read()
        img_stream = base64.b64encode(img_stream).decode()
        imglist[str(i)] = 'data:image/png;base64,' + img_stream
        # imglist[str(i)] = "http://{}{}".format(ip_adress, bgimg_path)
    sys.path.remove(CONTENT_PATH)
    
    del config
    gc.collect()  

    # add_line(API_result_path,['animation', username])  
    return make_response(jsonify({"results":results,"bgimgList":imglist, "grid": gridlist}), 200)

@app.route("/", methods=["GET", "POST"])
def GUI():
    # return render_template("SilasIndex.html")
    return send_from_directory(app.static_folder, 'index.html')

@app.route("/contrast", methods=["GET", "POST"])
def ContrastGUI():
    # return render_template("SilasIndex.html")
    return send_from_directory(app.static_folder, 'contrast_index.html')


@app.route('/get_itertaion_structure', methods=["POST", "GET"])
@cross_origin()
def get_tree():
    CONTENT_PATH = request.args.get("path")
    VIS_METHOD = request.args.get("method")
    SETTING = request.args.get("setting")

    sys.path.append(CONTENT_PATH)
    context, error_message = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
    
    EPOCH_START = context.strategy.config["EPOCH_START"]
    EPOCH_PERIOD = context.strategy.config["EPOCH_PERIOD"]
    EPOCH_END = context.strategy.config["EPOCH_END"]

    
    res_json_path = os.path.join(CONTENT_PATH, "iteration_structure.json")
    if os.path.exists(res_json_path):
        with open(res_json_path,encoding='utf8')as fp:
            json_data = json.load(fp)
    
    else:
        json_data = []
        previous_epoch = ""

        for epoch in range(EPOCH_START, EPOCH_END + 1, EPOCH_PERIOD):
            json_data.append({
                "value": epoch,
                "name": str(epoch),
                "pid": previous_epoch if previous_epoch else ""
            })
            previous_epoch = epoch

    return make_response(jsonify({"structure":json_data}), 200)

app.route('/contrast/get_itertaion_structure', methods=["POST", "GET"])(get_tree)

@app.route('/indexSearch', methods=["POST", "GET"])
@cross_origin()
def index_search():
    global code_entities
    global code_embeddings_collection
    res = request.get_json()

    query = res["query"]

    print(query)
    if query["key"] == "index":
        index = int(query["value"])
        code_vectors_to_search = [code_entities[-1][index]]
    if query["key"] == "nl":
        sys.path.append('/home/yiming/cophi/training_dynamic/code_training_dynamic/saved_models/ruby_fine_tine_5/Model')
        from run import gen_nl_vector
        string = query["value"]
        code_vectors_to_search = [gen_nl_vector(string)]

    search_params = {
        "metric_type": "L2",
        "params": {"nprobe": 10},
    }

    DEFAULT_LIMIT = 5
    k_num = int(query["k"]) if query.get("k") is not None else DEFAULT_LIMIT

    code_code_result = code_embeddings_collection.search(code_vectors_to_search, "code_embeddings", search_params, limit=k_num)

    for hits in code_code_result:
        for hit in hits:
            print(f"code_code hit: {hit}")

    hit_list = []
    for hits in code_code_result:
        for hit in hits:
            hit_dict = {
                'distance': hit.distance,
                'id': hit.id
            }
            hit_list.append(hit_dict)

    print(hit_list)
    return make_response(jsonify({'result': hit_list}), 200)


@app.route('/contrastIndexSearch', methods=["POST", "GET"])
@cross_origin()
def contrast_index_search():
    global code_entities
    global code_embeddings_collection
    global nl_entities
    global nl_embeddings_collection
    res = request.get_json()

    query = res["query"]

    print(query)
    if query["key"] == "left-index":
        index = int(query["value"])
        vectors_to_search = [code_entities[-1][index]]
    if query["key"] == "right-index":
        index = int(query["value"])
        vectors_to_search = [nl_entities[-1][index]]
    if query["key"] == "inter-index":
        index = int(query["value"])
        vectors_to_search = [nl_entities[-1][index]]
    if query["key"] == "nl":
        sys.path.append('/home/yiming/cophi/training_dynamic/code_training_dynamic/saved_models/ruby_fine_tine_5/Model')
        from run import gen_nl_vector
        string = query["value"]
        vectors_to_search = [gen_nl_vector(string)]

    search_params = {
        "metric_type": "L2",
        "params": {"nprobe": 10},
    }

    DEFAULT_LIMIT = 5
    k_num = int(query["k"]) if query.get("k") is not None else DEFAULT_LIMIT

    if query["key"] == "right-index":
        search_result = nl_embeddings_collection.search(vectors_to_search, "nl_embeddings", search_params, limit=k_num)
    else:
        search_result = code_embeddings_collection.search(vectors_to_search, "code_embeddings", search_params, limit=k_num)

    for hits in search_result:
        for hit in hits:
            print(f"code_code hit: {hit}")

    hit_list = []
    for hits in search_result:
        for hit in hits:
            hit_dict = {
                'distance': hit.distance,
                'id': hit.id
            }
            hit_list.append(hit_dict)

    print(hit_list)
    return make_response(jsonify({'result': hit_list}), 200)

@app.route('/queryMissSearch', methods=["POST", "GET"])
@cross_origin()
def query_miss_search():
    global code_entities
    global code_embeddings_collection
    global nl_entities
    global nl_embeddings_collection
    res = request.get_json()

    query = res["query"]

    search_params = {
        "metric_type": "L2",
        "params": {"nprobe": 10},
    }

    DEFAULT_LIMIT = 5
    k_num = int(query["k"]) if query.get("k") is not None else DEFAULT_LIMIT
    mis_query_indices = ''

    refpath = res["refpath"]
    refiteration = res["refiteration"]
    # tarpath = res["tarpath"]
    # tariteration = res["tariteration"]

    ref_model_path = os.path.join(refpath, "Model")
    ref_iter_path = os.path.join(ref_model_path, 'Epoch_{}'.format(refiteration))
    ref_mis_query_path = os.path.join(ref_iter_path, 'custom_pred.json')
    print("ref_mis_query_path", ref_mis_query_path)
    if os.path.exists(ref_mis_query_path):
        with open(ref_mis_query_path, 'r') as file:
            ref_mis_query_list = json.load(file)

        mis_query_indices = ','.join(str(index) for index, item in enumerate(ref_mis_query_list) if int(item) != 0)
    else:
        print("len", nl_embeddings_collection.num_entities)
        for i in range(nl_embeddings_collection.num_entities):
            miss_query_flag = True
            vectors_to_search = [nl_entities[-1][i]]
            search_result = code_embeddings_collection.search(vectors_to_search, "code_embeddings", search_params, limit=k_num)

            for hits in search_result:
                for hit in hits:
                    if int(hit.id) == i:
                        miss_query_flag = False
                        break
            if miss_query_flag: 
                if mis_query_indices == '':
                    mis_query_indices += str(i)
                else:
                    mis_query_indices += ',' + str(i)
            if i % 1000 == 0:
                print(i, mis_query_indices)

    return make_response(jsonify({'result': mis_query_indices}), 200)


@app.route('/addNewLbel', methods=["POST", "GET"])
@cross_origin()
def add_new_label():
    res = request.get_json()

    labeling = res["labeling"]
    index = int(labeling["value"])
    label = labeling["label"]

    refpath = res["refpath"]
    refiteration = res["refiteration"]
    tarpath = res["tarpath"]
    tariteration = res["tariteration"]

    ref_label_text_path = os.path.join(refpath, 'Model', 'Epoch_{}'.format(refiteration), 'labels')
    tar_label_text_path = os.path.join(tarpath, 'Model', 'Epoch_{}'.format(tariteration), 'labels')

    ref_label_path = os.path.join(refpath, 'python', 'train.jsonl')
    # tar_label_path = os.path.join(tarpath, 'python', 'train.jsonl')
    # print("tar_label_path", tar_label_path)
    output_file_path = os.path.join(refpath, 'python', 'new_train.jsonl')

    # if os.path.exists(ref_label_path) and os.path.exists(tar_label_path):
    if os.path.exists(ref_label_path):
        with open(ref_label_path, 'r') as input_file:
            lines = input_file.readlines()

        target_item = json.loads(lines[index])
        original_code = target_item['code']
        original_code_tokens = target_item['code_tokens']
        original_docstring = target_item['docstring']
        original_docstring_tokens = target_item['docstring_tokens']

        target_item['code'] = f"{label}\n{original_code}"
        original_code_tokens.insert(0, label)
        target_item['code_tokens'] = original_code_tokens

        target_item['docstring'] = f"{label}\n{original_docstring}"
        original_docstring_tokens.insert(0, label)
        target_item['docstring_tokens'] = original_docstring_tokens

        modified_line = json.dumps(target_item)
        lines[index] = modified_line + '\n'

        with open(output_file_path, 'w') as file:
            file.writelines(lines)

        ref_output_file = os.path.join(ref_label_text_path, 'text_{}.txt'.format(index))
        tar_output_file = os.path.join(tar_label_text_path, 'text_{}.txt'.format(index))
        print("ref_output_file", ref_output_file)
        print("tar_output_file", tar_output_file)
        
        with open(ref_output_file, "w") as output:
            output.write(target_item['code'])

        with open(tar_output_file, "w") as output:
            output.write(target_item['docstring'])

        success = True
    else:
        success = False
    return make_response(jsonify({'success': success}), 200)

def check_port_inuse(port, host):
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
    import socket
    # hostname = socket.gethostname()
    # ip_address = socket.gethostbyname(hostname)
    ip_address = '0.0.0.0'
    port = 5000
    while check_port_inuse(port, ip_address):
        port = port + 1

    app.run(host=ip_address, port=port)
    # app.run(host=ip_address, port=int(port))