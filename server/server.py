
#! Noted that
#! iteration in frontend is start+(iteration -1)*period for normal training scenarios!!

# TODO refactor, similar function should be in utils
# TODO tidy up
# TODO return lb and ulb property
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

# flask for API server
app = Flask(__name__)
cors = CORS(app, supports_credentials=True)
app.config['CORS_HEADERS'] = 'Content-Type'

@app.route('/updateProjection', methods=["POST", "GET"])
@cross_origin()
def update_projection():
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['path'])
    iteration = int(res['iteration'])
    predicates = res["predicates"]
    
    sys.path.append(CONTENT_PATH)
    timevis = initialize_backend(CONTENT_PATH)
    EPOCH = (iteration-1)*timevis.data_provider.p + timevis.data_provider.s

    embedding_2d, grid, decision_view, label_color_list, label_list, max_iter, training_data_index, \
    testing_data_index, eval_new, prediction_list, selected_points, properties = update_epoch_projection(timevis, EPOCH, predicates)

    sys.path.remove(CONTENT_PATH)

    return make_response(jsonify({'result': embedding_2d, 'grid_index': grid, 'grid_color': 'data:image/png;base64,' + decision_view,
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

    sys.path.append(CONTENT_PATH)
    timevis = initialize_backend(CONTENT_PATH)
    EPOCH = (iteration-1)*timevis.data_provider.p + timevis.data_provider.s

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


# base64
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
    # TODO dense_al parameter from frontend

    sys.path.append(CONTENT_PATH)
    timevis = initialize_backend(CONTENT_PATH, dense_al=True)
    # TODO add new sampling rule
    indices, labels, scores = timevis.al_query(iteration, budget, strategy, np.array(acc_idxs).astype(np.int64), np.array(rej_idxs).astype(np.int64))

    sys.path.remove(CONTENT_PATH)
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
    print(data)

    sys.path.append(CONTENT_PATH)

    timevis = initialize_backend(CONTENT_PATH)
    timevis.save_acc_and_rej(acc_idxs, rej_idxs)
    indices, scores, labels = timevis.suggest_abnormal(strategy, np.array(acc_idxs).astype(np.int64), np.array(rej_idxs).astype(np.int64), budget)
    clean_list,_ = timevis.suggest_normal(strategy, 1)

    sys.path.remove(CONTENT_PATH)
    return make_response(jsonify({"selectedPoints": indices.tolist(), "scores": scores.tolist(), "suggestLabels":labels.tolist(),"cleanList":clean_list.tolist()}), 200)

@app.route('/al_train', methods=["POST"])
@cross_origin()
def al_train():
    data = request.get_json()
    CONTENT_PATH = os.path.normpath(data['content_path'])
    acc_idxs = data["accIndices"]
    rej_idxs = data["rejIndices"]
    iteration = data["iteration"]
    sys.path.append(CONTENT_PATH)

    # default setting al_train is light version, we only save the last epoch
    timevis = initialize_backend(CONTENT_PATH)
    timevis.al_train(iteration, acc_idxs)

    from config import config
    NEW_ITERATION =  timevis.get_max_iter()
    timevis.save_acc_and_rej(NEW_ITERATION, acc_idxs, rej_idxs)
    timevis.vis_train(NEW_ITERATION, **config)

    # update iteration projection
    embedding_2d, grid, decision_view, label_color_list, label_list, _, training_data_index, \
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
    return make_response(jsonify({'result': embedding_2d, 'grid_index': grid, 'grid_color': 'data:image/png;base64,' + decision_view,
                                  'label_color_list': label_color_list, 'label_list': label_list,
                                  'maximum_iteration': NEW_ITERATION, 'training_data': training_data_index,
                                  'testing_data': testing_data_index, 'evaluation': eval_new,
                                  'prediction_list': prediction_list,
                                  "selectedPoints":selected_points.tolist(),
                                  "properties":properties.tolist()}), 200)

@app.route('/login', methods=["POST"])
@cross_origin()
def login():
    data = request.get_json()
    username = data["username"]
    password = data["password"]
    # Verify username and password
    # if pass return normal_content_path and anormaly_content_path
    # TODO copy datasets
    # TODO reset dataset when login
    if username == 'admin' and password == '123qwe': # mock
        # reset active learning dataset
        # return make_response(jsonify({"normal_content_path": 'D:\\datasets\\al',"unormaly_content_path":'D:\\datasets\\timevis\\toy_model\\resnet18_cifar10'}), 200) #limy
        # delete [iteration,...)
        con_paths = {"normal_content_path": '/home/xianglin/DVI_data/active_learning/random/resnet18/CIFAR10',"unormaly_content_path":'/home/xianglin/data/noisy/symmetric'}
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
        return make_response(jsonify({"normal_content_path": '/home/xianglin/DVI_data/active_learning/random/resnet18/CIFAR10',"unormaly_content_path":'/home/xianglin/data/noisy/symmetric'}), 200) #xianglin
        # return make_response(jsonify({"normal_content_path": '/Users/zhangyifan/Downloads/al',"unormaly_content_path":'/Users/zhangyifan/Downloads/toy_model/resnet18_cifar10'}), 200) #yvonne
    elif username == 'controlGroup' and password == '123qwe': # mock
        # reset active learning dataset
        CONTENT_PATH = "/home/xianglin/projects/DVI_data/noisy/symmetric/cifar10"
        sys.path.append(CONTENT_PATH)
        timevis = initialize_backend(CONTENT_PATH)
        timevis.reset(iteration=3)
        sys.path.remove(CONTENT_PATH)
        return make_response(jsonify({"normal_content_path": 'D:\\datasets\\al',"unormaly_content_path":'D:\\datasets\\timevis\\toy_model\\resnet18_cifar10',"isControl":True}), 200) #limy
    else:
        return make_response(jsonify({"message":"username or password is wrong"}), 200)
  
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
            embedding_2d, grid, _, _, _, _, _, _, _, _, _, _ = update_epoch_projection(timevis, EPOCH, predicates)
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
    return make_response(jsonify({"results":results,"bgimgList":imglist, "grid": gridlist}), 200)

@app.route('/get_itertaion_structure', methods=["POST", "GET"])
@cross_origin()
def get_tree():
    CONTENT_PATH = request.args.get("path")
    res_json_path = os.path.join(CONTENT_PATH, "iteration_structure.json")
    with open(res_json_path,encoding='utf8')as fp:
        json_data = json.load(fp)
    return make_response(jsonify({"structure":json_data}), 200)

if __name__ == "__main__":
    import socket
    hostname = socket.gethostname()
    ip_address = socket.gethostbyname(hostname)
    with open('config.json', 'r') as f:
        config = json.load(f)
        # ip_address = config["ServerIP"]
        port = config["ServerPort"]
    app.run(host=ip_address, port=int(port))
