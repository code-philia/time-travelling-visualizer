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
from utils import getVisError, update_epoch_projection, initialize_backend, add_line, getConfChangeIndices, getContraVisChangeIndices, getContraVisChangeIndicesSingle,getCriticalChangeIndices

import time
# flask for API server
app = Flask(__name__,static_folder='Frontend')
cors = CORS(app, supports_credentials=True)
app.config['CORS_HEADERS'] = 'Content-Type'

API_result_path = "./admin_API_result.csv"

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
    # sys.path.append(CONTENT_PATH)
    context = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
    # use the true one
    # EPOCH = (iteration-1)*context.strategy.data_provider.p + context.strategy.data_provider.s
    EPOCH = int(iteration)
    
    embedding_2d, grid, decision_view, label_name_dict, label_color_list, label_list, max_iter, training_data_index, \
    testing_data_index, eval_new, prediction_list, selected_points, properties, error_message = update_epoch_projection(context, EPOCH, predicates, TaskType)
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
                                  "errorMessage": error_message
                                  }), 200)

app.route('/contrast/updateProjection', methods=["POST", "GET"])(update_projection)



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
    context = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
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
    add_line(API_result_path,['SQ',username])
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
    pic_save_dir_path = os.path.join(CONTENT_PATH, "sprites", "{}.png".format(idx))
    img_stream = ''
    with open(pic_save_dir_path, 'rb') as img_f:
        img_stream = img_f.read()
        img_stream = base64.b64encode(img_stream).decode()
    add_line(API_result_path,['SI',username])
    return make_response(jsonify({"imgUrl":'data:image/png;base64,' + img_stream}), 200)

app.route('/contrast/spriteImage', methods=["POST", "GET"])(sprite_image)

@app.route('/spriteText', methods=["POST","GET"])
@cross_origin()
def sprite_text():
    path = request.args.get("path")
    index = request.args.get("index")
    iteration = request.args.get("iteration")
    
    CONTENT_PATH = os.path.normpath(path)
    idx = int(index)
    start = time.time()
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
    context = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
  
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
    VIS_METHOD = res['vis_method']
    SETTING = res["setting"]
    curr_iteration = int(res['iterationLeft'])
    last_iteration = int(res['iterationRight'])
    method = res['method']
    left_selected = res['selectedPointLeft']
    right_selected = res['selectedPointRight']
    
    context_left = initialize_backend(CONTENT_PATH_LEFT, VIS_METHOD, SETTING)
    context_right = initialize_backend(CONTENT_PATH_RIGHT, VIS_METHOD, SETTING)
  
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
    VIS_METHOD = res['vis_method']
    SETTING = res["setting"]
    curr_iteration = int(res['iterationLeft'])
    last_iteration = int(res['iterationRight'])
    method = res['method']
    CONTENT_PATH_LEFT = res['content_path_left']
    CONTENT_PATH_RIGHT = res['content_path_right']
    
    context_left = initialize_backend(CONTENT_PATH_LEFT, VIS_METHOD, SETTING)
    context_right = initialize_backend(CONTENT_PATH_RIGHT, VIS_METHOD, SETTING)
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
    context= initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)

    visualization_error = getVisError(context, curr_iteration,  method)
    end_time = time.time()
    elapsed_time = end_time - start_time
    print(elapsed_time)
    print(len(visualization_error))
    return make_response(jsonify({
                                  "visualizationError": visualization_error,       
                                  }), 200)

app.route('/contrast/getVisualizationError', methods=["POST", "GET"])(get_visualization_error)

@app.route('/highlightCriticalChange', methods=["POST", "GET"])
@cross_origin()
def highlight_critical_change():
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['path'])
    VIS_METHOD = res['vis_method']
    SETTING = res["setting"]
    curr_iteration = int(res['iteration'])
    last_iteration = int(res['last_iteration'])

    
    # sys.path.append(CONTENT_PATH)
    context = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
  
    predChangeIndices = getCriticalChangeIndices(context, curr_iteration, last_iteration)
    
    # sys.path.remove(CONTENT_PATH)
    # add_line(API_result_path,['TT',username])
    return make_response(jsonify({
                                  "predChangeIndices": predChangeIndices.tolist()
                                  }), 200)

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
    context = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING, dense=True)
    # TODO add new sampling rule
    indices, labels, scores = context.al_query(iteration, budget, strategy, np.array(acc_idxs).astype(np.int64), np.array(rej_idxs).astype(np.int64))

    sort_i = np.argsort(-scores)
    indices = indices[sort_i]
    labels = labels[sort_i]
    scores = scores[sort_i]

    sys.path.remove(CONTENT_PATH)
    if not isRecommend: 
        add_line(API_result_path,['Feedback', user_name]) 
    else:
        add_line(API_result_path,['Recommend', user_name])
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
    context = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)

    context.save_acc_and_rej(acc_idxs, rej_idxs, user_name)
    indices, scores, labels = context.suggest_abnormal(strategy, np.array(acc_idxs).astype(np.int64), np.array(rej_idxs).astype(np.int64), budget)
    clean_list,_ = context.suggest_normal(strategy, np.array(acc_idxs).astype(np.int64), np.array(rej_idxs).astype(np.int64), 1)

    sort_i = np.argsort(-scores)
    indices = indices[sort_i]
    labels = labels[sort_i]
    scores = scores[sort_i]

    sys.path.remove(CONTENT_PATH)
    if not isRecommend: 
        add_line(API_result_path,['Feedback', user_name]) 
    else:
        add_line(API_result_path,['Recommend', user_name])
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
    
    context = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
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
 
    add_line(API_result_path,['al_train', user_name])
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
    add_line(API_result_path,['boundingbox', username])  
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
    context = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
    
    EPOCH_START = context.strategy.config["EPOCH_START"]
    EPOCH_PERIOD = context.strategy.config["EPOCH_PERIOD"]
    EPOCH_END = context.strategy.config["EPOCH_END"]

    # TODO Interval to be decided
    epoch_num = (EPOCH_END - EPOCH_START)// EPOCH_PERIOD + 1

    for i in range(1, epoch_num+1, 1):
        EPOCH = (i-1)*EPOCH_PERIOD + EPOCH_START

        timevis = initialize_backend(CONTENT_PATH)

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

    add_line(API_result_path,['animation', username])  
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
    context = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
    
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
    hostname = socket.gethostname()
    ip_address = socket.gethostbyname(hostname)
    port = 5000
    while check_port_inuse(port, ip_address):
        port = port + 1
    app.run(host=ip_address, port=int(port))