import os, sys
# sys.path.append("..")

import torch
import numpy as np
from umap.umap_ import find_ab_params
import pickle
import gc
from .backend_adapter import TimeVisBackend, ActiveLearningTimeVisBackend, AnormalyTimeVisBackend

timevis_path = "../../DLVisDebugger"
sys.path.append(timevis_path)
from singleVis.SingleVisualizationModel import SingleVisualizationModel
from singleVis.losses import SingleVisLoss, UmapLoss, ReconstructionLoss
from singleVis.trainer import SingleVisTrainer
from singleVis.data import NormalDataProvider, ActiveLearningDataProvider
from singleVis.eval.evaluator import Evaluator
from singleVis.visualizer import visualizer
from singleVis.projector import Projector, ALProjector

def initialize_backend(CONTENT_PATH):

    from config import config

    # load hyperparameters
    CLASSES = config["CLASSES"]
    DATASET = config["DATASET"]
    GPU_ID = config["GPU"]
    DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")
    #################################################   VISUALIZATION PARAMETERS    ########################################
    PREPROCESS = config["VISUALIZATION"]["PREPROCESS"]
    B_N_EPOCHS = config["VISUALIZATION"]["BOUNDARY"]["B_N_EPOCHS"]
    L_BOUND = config["VISUALIZATION"]["BOUNDARY"]["L_BOUND"]
    LAMBDA = config["VISUALIZATION"]["LAMBDA"]
    HIDDEN_LAYER = config["VISUALIZATION"]["HIDDEN_LAYER"]
    N_NEIGHBORS = config["VISUALIZATION"]["N_NEIGHBORS"]
    MAX_EPOCH = config["VISUALIZATION"]["MAX_EPOCH"]
    S_N_EPOCHS = config["VISUALIZATION"]["S_N_EPOCHS"]
    PATIENT = config["VISUALIZATION"]["PATIENT"]
    VIS_MODEL_NAME = config["VISUALIZATION"]["VIS_MODEL_NAME"]
    RESOLUTION = config["VISUALIZATION"]["RESOLUTION"]
    EVALUATION_NAME = config["VISUALIZATION"]["EVALUATION_NAME"]
    NET = config["TRAINING"]["NET"]
    

    SETTING = config["SETTING"] # active learning
    if SETTING == "normal" or SETTING == "abnormal":
        EPOCH_START = config["EPOCH_START"]
        EPOCH_END = config["EPOCH_END"]
        EPOCH_PERIOD = config["EPOCH_PERIOD"]

        INIT_NUM = config["VISUALIZATION"]["INIT_NUM"]
        ALPHA = config["VISUALIZATION"]["ALPHA"]
        BETA = config["VISUALIZATION"]["BETA"]
        MAX_HAUSDORFF = config["VISUALIZATION"]["MAX_HAUSDORFF"]
        T_N_EPOCHS = config["VISUALIZATION"]["T_N_EPOCHS"]
    elif SETTING == "active learning":
        BASE_ITERATION = config["BASE_ITERATION"]

    import Model.model as subject_model
    net = eval("subject_model.{}()".format(NET))

    # ########################################################################################################################
    #                                                      TRAINING SETTING                                                  #
    # ########################################################################################################################

    model = SingleVisualizationModel(input_dims=512, output_dims=2, units=256, hidden_layer=HIDDEN_LAYER)

    if SETTING == "normal" or SETTING == "abnormal":
        data_provider = NormalDataProvider(CONTENT_PATH, net, EPOCH_START, EPOCH_END, EPOCH_PERIOD, split=-1, device=DEVICE, classes=CLASSES, verbose=1)
        SEGMENTS = config["VISUALIZATION"]["SEGMENTS"]
        projector = Projector(vis_model=model, content_path=CONTENT_PATH, segments=SEGMENTS, device=DEVICE)
    elif SETTING == "active learning":
        data_provider = ActiveLearningDataProvider(CONTENT_PATH, net, BASE_ITERATION, split=-1, device=DEVICE, classes=CLASSES, verbose=1)
        projector = ALProjector(vis_model=model, content_path=CONTENT_PATH, vis_model_name=VIS_MODEL_NAME, device=DEVICE)
        
    # ########################################################################################################################
    # #                                                       TRAIN                                                          #
    # ########################################################################################################################
    
    if SETTING == "active learning":
        negative_sample_rate = 5
        min_dist = .1
        _a, _b = find_ab_params(1.0, min_dist)
        umap_loss_fn = UmapLoss(negative_sample_rate, DEVICE, _a, _b, repulsion_strength=1.0)
        recon_loss_fn = ReconstructionLoss(beta=1.0)
        criterion = SingleVisLoss(umap_loss_fn, recon_loss_fn, lambd=LAMBDA)

        optimizer = torch.optim.Adam(model.parameters(), lr=.01, weight_decay=1e-5)
        lr_scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=.1)

        trainer = SingleVisTrainer(model, criterion, optimizer, lr_scheduler,edge_loader=None, DEVICE=DEVICE)
        # trainer.load(file_path=os.path.join(data_provider.model_path, "Iteration_{}".format(EPOCH), VIS_MODEL_NAME))
    
    # ########################################################################################################################
    # #                                                       EVALUATION                                                     #
    # ########################################################################################################################

    vis = visualizer(data_provider, projector, RESOLUTION)
    evaluator = Evaluator(data_provider, projector)

    if SETTING == "normal":
        timevis = TimeVisBackend(data_provider, projector, vis, evaluator, **config)
    elif SETTING == "abnormal":
        timevis = AnormalyTimeVisBackend(data_provider, projector, vis, evaluator, period=75, **config)
    elif SETTING == "active learning":
        timevis = ActiveLearningTimeVisBackend(data_provider, projector, trainer, vis, evaluator, **config)
    
    del config
    gc.collect()
    return timevis


def update_epoch_projection(timevis, EPOCH, predicates):
    # TODO, preprocess
    train_data = timevis.data_provider.train_representation(EPOCH)
    test_data = timevis.data_provider.test_representation(EPOCH)
    all_data = np.concatenate((train_data, test_data), axis=0)

    embedding_2d = timevis.projector.batch_project(EPOCH, all_data)

    train_labels = timevis.data_provider.train_labels(EPOCH)
    test_labels = timevis.data_provider.test_labels(EPOCH)
    labels = np.concatenate((train_labels, test_labels), axis=0).tolist()

    training_data_number = timevis.hyperparameters["TRAINING"]["train_num"]
    testing_data_number = timevis.hyperparameters["TRAINING"]["test_num"]
    training_data_index = list(range(training_data_number))
    testing_data_index = list(range(training_data_number, training_data_number + testing_data_number))

    # return the image of background
    x_min, y_min, x_max, y_max, b_fig = timevis.vis.get_background(EPOCH, timevis.hyperparameters["VISUALIZATION"]["RESOLUTION"])
    grid = [x_min, y_min, x_max, y_max]
    # formating
    grid = [float(i) for i in grid]
    b_fig = str(b_fig, encoding='utf-8')

    # save results, grid and decision_view
    save_path = timevis.data_provider.model_path
    iteration_name = "Epoch" if timevis.data_provider.mode == "normal" or timevis.data_provider.mode == "abnormal" else "Iteration"
    save_path = os.path.join(save_path, "{}_{}".format(iteration_name, EPOCH))
    print(save_path)
    with open(os.path.join(save_path, "grid.pkl"), "wb") as f:
        pickle.dump(grid, f)
    np.save(os.path.join(save_path, "embedding.npy"), embedding_2d)
    
    color = timevis.vis.get_standard_classes_color() * 255
    color = color.astype(int).tolist()

    # TODO fix its structure
    file_name = timevis.hyperparameters["VISUALIZATION"]["EVALUATION_NAME"]
    # evaluation = timevis.evaluator.get_eval(file_name=file_name)
    eval_new = dict()
    # eval_new["nn_train_15"] = evaluation["15"]['nn_train'][str(EPOCH)]
    # eval_new['nn_test_15'] = evaluation["15"]['nn_test'][str(EPOCH)]
    # eval_new['bound_train_15'] = evaluation["15"]['b_train'][str(EPOCH)]
    # eval_new['bound_test_15'] = evaluation["15"]['b_test'][str(EPOCH)]
    # eval_new['ppr_train'] = evaluation["ppr_train"][str(EPOCH)]
    # eval_new['ppr_test'] = evaluation["ppr_test"][str(EPOCH)]
    eval_new["nn_train_15"] = 1
    eval_new['nn_test_15'] = 1
    eval_new['bound_train_15'] = 1
    eval_new['bound_test_15'] = 1
    eval_new['ppr_train'] = 1
    eval_new['ppr_test'] = 1

    label_color_list = []
    label_list = []
    for label in labels:
        label_color_list.append(color[int(label)])
        label_list.append(timevis.hyperparameters["CLASSES"][int(label)])

    prediction_list = []
    prediction = timevis.data_provider.get_pred(EPOCH, all_data).argmax(1)

    for i in range(len(prediction)):
        prediction_list.append(timevis.hyperparameters["CLASSES"][prediction[i]])
    
    if timevis.hyperparameters["SETTING"] == "normal" or timevis.hyperparameters["SETTING"] == "abnormal":
        max_iter = (timevis.hyperparameters["EPOCH_END"] - timevis.hyperparameters["EPOCH_START"]) // timevis.hyperparameters["EPOCH_PERIOD"] + 1
    elif timevis.hyperparameters["SETTING"] == "active learning":
        # TODO fix this, could be larger than EPOCH
        max_iter = timevis.get_max_iter()
        # max_iter = max(timevis.hyperparameters["BASE_ITERATION"], EPOCH)

    # current_index = timevis.get_epoch_index(EPOCH)
    # selected_points = np.arange(training_data_number + testing_data_number)[current_index]
    selected_points = np.arange(training_data_number + testing_data_number)
    for key in predicates.keys():
        if key == "label":
            tmp = np.array(timevis.filter_label(predicates[key]))
        elif key == "type":
            tmp = np.array(timevis.filter_type(predicates[key], int(EPOCH)))
        else:
            tmp = np.arange(training_data_number + testing_data_number)
        selected_points = np.intersect1d(selected_points, tmp)
    
    properties = np.concatenate((np.zeros(training_data_number, dtype=np.int16), 2*np.ones(testing_data_number, dtype=np.int16)), axis=0)
    lb = timevis.get_epoch_index(EPOCH)
    ulb = np.setdiff1d(training_data_index, lb)
    properties[ulb] = 1
    
    return embedding_2d.tolist(), grid, b_fig, label_color_list, label_list, max_iter, training_data_index, testing_data_index, eval_new, prediction_list, selected_points, properties
