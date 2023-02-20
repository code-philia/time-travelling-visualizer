from flask import request, Flask, jsonify, make_response
from flask_cors import CORS, cross_origin
import base64
import os
import sys
import json
import numpy as np
import gc
import shutil

from timevis_backend.utils import *
from timevis_backend.res_logging import add_line

# flask for API server
app = Flask(__name__)
cors = CORS(app, supports_credentials=True)
app.config['CORS_HEADERS'] = 'Content-Type'

session = 5
API_result_path = "./API_result.csv"

@app.route('/updateProjection', methods=["POST", "GET"])
@cross_origin()
def update_projection():
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['path'])
    iteration = int(res['iteration'])
    predicates = res["predicates"]
    # username = res['username']
    
    sys.path.append(CONTENT_PATH)
    timevis = initialize_backend(CONTENT_PATH)
    EPOCH = (iteration-1)*timevis.data_provider.p + timevis.data_provider.s

    embedding_2d, grid, decision_view, label_name_dict, label_color_list, label_list, max_iter, training_data_index, \
    testing_data_index, eval_new, prediction_list, selected_points, properties = update_epoch_projection(timevis, EPOCH, predicates)

    sys.path.remove(CONTENT_PATH)
    # add_line(API_result_path,['TT',username])
    return make_response(jsonify({'result': embedding_2d, 'grid_index': grid, 'grid_color': 'data:image/png;base64,' + decision_view,
                                  'label_name_dict':label_name_dict,
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
    iteration = int(res['iteration'])
    predicates = res["predicates"]
    username = res['username']

    sys.path.append(CONTENT_PATH)
    timevis = initialize_backend(CONTENT_PATH)
    EPOCH = (iteration-1)*timevis.data_provider.p + timevis.data_provider.s

    training_data_number = timevis.hyperparameters["TRAINING"]["train_num"]
    testing_data_number = timevis.hyperparameters["TRAINING"]["test_num"]

    current_index = timevis.get_epoch_index(EPOCH)
    selected_points = np.arange(training_data_number)[current_index]
    selected_points = np.concatenate((selected_points, np.arange(training_data_number, training_data_number + testing_data_number, 1)), axis=0)
    # selected_points = np.arange(training_data_number + testing_data_number)
    for key in predicates.keys():
        if key == "label":
            tmp = np.array(timevis.filter_label(predicates[key], int(EPOCH)))
        elif key == "type":
            tmp = np.array(timevis.filter_type(predicates[key], int(EPOCH)))
        elif key == "confidence":
            tmp = np.array(timevis.filter_conf(predicates[key][0],predicates[key][1],int(EPOCH)))
        else:
            tmp = np.arange(training_data_number + testing_data_number)
        selected_points = np.intersect1d(selected_points, tmp)
    sys.path.remove(CONTENT_PATH)
    add_line(API_result_path,['SQ',username])
    return make_response(jsonify({"selectedPoints": selected_points.tolist()}), 200)


# base64
@app.route('/sprite', methods=["POST","GET"])
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


@app.route('/al_query', methods=["POST"])
@cross_origin()
def al_query():
    data = request.get_json()
    CONTENT_PATH = os.path.normpath(data['content_path'])
    iteration = data["iteration"]
    strategy = data["strategy"]
    budget = int(data["budget"])
    acc_idxs = data["accIndices"]
    rej_idxs = data["rejIndices"]
    user_name = data["username"]
    isRecommend = data["isRecommend"]
    # TODO dense_al parameter from frontend

    sys.path.append(CONTENT_PATH)
    timevis = initialize_backend(CONTENT_PATH, dense_al=True)
    # TODO add new sampling rule
    indices, labels, scores = timevis.al_query(iteration, budget, strategy, np.array(acc_idxs).astype(np.int64), np.array(rej_idxs).astype(np.int64))

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
    budget = int(data["budget"])
    strategy = data["strategy"]
    acc_idxs = data["accIndices"]
    rej_idxs = data["rejIndices"]
    user_name = data["username"]
    isRecommend = data["isRecommend"]

    sys.path.append(CONTENT_PATH)

    timevis = initialize_backend(CONTENT_PATH)
    timevis.save_acc_and_rej(acc_idxs, rej_idxs, user_name)
    indices, scores, labels = timevis.suggest_abnormal(strategy, np.array(acc_idxs).astype(np.int64), np.array(rej_idxs).astype(np.int64), budget)
    clean_list,_ = timevis.suggest_normal(strategy, np.array(acc_idxs).astype(np.int64), np.array(rej_idxs).astype(np.int64), 1)

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
    acc_idxs = data["accIndices"]
    rej_idxs = data["rejIndices"]
    iteration = data["iteration"]
    user_name = data["username"]
    sys.path.append(CONTENT_PATH)

    # default setting al_train is light version, we only save the last epoch
    
    timevis = initialize_backend(CONTENT_PATH, dense_al=False)
    timevis.save_acc_and_rej(iteration, acc_idxs, rej_idxs, user_name)
    timevis.al_train(iteration, acc_idxs)

    from config import config
    NEW_ITERATION =  timevis.get_max_iter()
    timevis.vis_train(NEW_ITERATION, **config)

    # update iteration projection
    embedding_2d, grid, decision_view, label_name_dict, label_color_list, label_list, _, training_data_index, \
    testing_data_index, eval_new, prediction_list, selected_points, properties = update_epoch_projection(timevis, NEW_ITERATION, dict())
    
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


# @app.route('/login', methods=["POST"])
# @cross_origin()
# def login():
#     data = request.get_json()
#     username = data["username"]
#     password = data["password"]

#     tutorial_path = "/home/xianglin/projects/DVI_data/noisy/symmetric/mnist/10"
#     active_learning_path = '/home/xianglin/projects/DVI_data/exp_al'
#     noisy_detection_path = '/home/xianglin/projects/DVI_data/exp_anormaly'

#     # active_learning_path = 'D:\\datasets\\data\\al'
#     # noisy_detection_path = 'D:\\datasets\\data\\anormaly'

#     exp_group = ["shuning", "lucy","liuyang", "jiong","ruofan","khurshid","fangzhou","yuyang","jiaxiang","gilgamesh"]
#     control_group = ["bob", "yujie","yuhao","nimesha","pang","xinyue","yangming","yufan","tiedong","shida"]
#     with open("./user_list.json", "r") as f:
#         active_learning_path_g = json.load(f)["session_{}".format(session)]

#     add_line(API_result_path,['login', username])
#     # Verify username and password
#     # if pass return normal_content_path and anormaly_content_path
#     if username == 'admin-e' and password == '123qwe': 
#         con_paths = {"normal_content_path": active_learning_path,"unormaly_content_path":noisy_detection_path}
#         clear_cache(con_paths)
#         return make_response(jsonify({"normal_content_path": active_learning_path, "unormaly_content_path": noisy_detection_path}), 200)
#     elif username == 'admin-c' and password == '123qwe': 
#         con_paths = {"normal_content_path": active_learning_path, "unormaly_content_path": noisy_detection_path}
#         clear_cache(con_paths)
#         return make_response(jsonify({"normal_content_path": active_learning_path, "unormaly_content_path": noisy_detection_path, "isControl":True}), 200)
#     elif username == "tutorial" and password == '123qwe':
#         return make_response(jsonify({"normal_content_path": tutorial_path, "unormaly_content_path": tutorial_path}), 200)
#     elif username in active_learning_path_g.keys() and username in exp_group:
#         a_path = active_learning_path_g[username]
#         con_paths = {"normal_content_path": a_path, "unormaly_content_path": noisy_detection_path}
#         clear_cache(con_paths)
#         return make_response(jsonify(con_paths), 200)
#     elif username in active_learning_path_g.keys() and username in control_group:
#         a_path = active_learning_path_g[username]
#         con_paths = {"normal_content_path": a_path, "unormaly_content_path": noisy_detection_path}
#         clear_cache(con_paths)
#         return make_response(jsonify({"normal_content_path": a_path, "unormaly_content_path": noisy_detection_path, "isControl":True}), 200)
#     else:
#         return make_response(jsonify({"message":"username or password is wrong"}), 200)

#mock
@app.route('/login', methods=["POST"])
@cross_origin()
def login():
    data = request.get_json()
    username = data["username"]
    password = data["password"]

    tutorial_path = "/home/xianglin/projects/DVI_data/noisy/symmetric/mnist/10"
    active_learning_path = '/home/xianglin/projects/DVI_data/exp_al'
    noisy_detection_path = '/home/xianglin/projects/DVI_data/exp_anormaly'

    # Verify username and password
    # if pass return normal_content_path and anormaly_content_path
    if username == 'admin-e' and password == '123qwe': 
        con_paths = {"normal_content_path": active_learning_path,"unormaly_content_path":noisy_detection_path}
        clear_cache(con_paths)
        return make_response(jsonify({"normal_content_path": active_learning_path, "unormaly_content_path": noisy_detection_path}), 200)
    else:
        return make_response(jsonify({"message":"username or password is wrong"}), 200)

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
    # iteration_s = data["iteration_start"]
    # iteration_e = data["iteration_end"]
    predicates = dict() # placeholder

    results = dict()
    imglist = dict()
    gridlist = dict()

    sys.path.append(CONTENT_PATH)

    username = data["username"]

    from config import config
    EPOCH_START = config["EPOCH_START"]
    EPOCH_PERIOD = config["EPOCH_PERIOD"]
    EPOCH_END = config["EPOCH_END"]

    # TODO Interval to be decided
    epoch_num = (EPOCH_END - EPOCH_START)// EPOCH_PERIOD + 1

    for i in range(1, epoch_num+1, 1):
        EPOCH = (i-1)*EPOCH_PERIOD + EPOCH_START

        timevis = initialize_backend(CONTENT_PATH)

        # detect whether we have query before
        fname = "Epoch" if timevis.data_provider.mode == "normal" or timevis.data_provider.mode == "abnormal" else "Iteration"
        bgimg_path = os.path.join(timevis.data_provider.model_path, "{}_{}".format(fname, EPOCH), "bgimg.png")
        embedding_path = os.path.join(timevis.data_provider.model_path, "{}_{}".format(fname, EPOCH), "embedding.npy")
        grid_path = os.path.join(timevis.data_provider.model_path, "{}_{}".format(fname, EPOCH), "grid.pkl")
        if os.path.exists(bgimg_path) and os.path.exists(embedding_path) and os.path.exists(grid_path):
            path = os.path.join(timevis.data_provider.model_path, "{}_{}".format(fname, EPOCH))
            result_path = os.path.join(path,"embedding.npy")
            results[str(i)] = np.load(result_path).tolist()
            with open(os.path.join(path, "grid.pkl"), "rb") as f:
                grid = pickle.load(f)
            gridlist[str(i)] = grid
        else:
            embedding_2d, grid, _, _, _, _, _, _, _, _, _, _, _ = update_epoch_projection(timevis, EPOCH, predicates)
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

@app.route('/get_itertaion_structure', methods=["POST", "GET"])
@cross_origin()
def get_tree():
    CONTENT_PATH = request.args.get("path")
    # res_json_path = os.path.join(CONTENT_PATH, "iteration_structure.json")
    #mock
    res_json_path = os.path.join("./iteration_structure.json")
    with open(res_json_path,encoding='utf8')as fp:
        json_data = json.load(fp)
    return make_response(jsonify({"structure":json_data}), 200)

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

if __name__ == "__main__":
    import socket
    hostname = socket.gethostname()
    ip_address = socket.gethostbyname(hostname)
    # with open('config.json', 'r') as f:
    #     config = json.load(f)
    #     ip_address = config["ServerIP"]
    #     port = config["ServerPort"]
    port = 5000
    while check_port_inuse(port, ip_address):
        port = port + 1
    app.run(host=ip_address, port=int(port))
