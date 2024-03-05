import numpy as np
import os, sys
import time
import json
import torch
from scipy.stats import spearmanr

import pickle
import pandas as pd
import argparse

from singleVis.data import ActiveLearningDataProvider
from singleVis.utils import generate_random_trajectory, generate_random_trajectory_momentum

def add_noise(rate, acc_idxs, rej_idxs):
    if rate == 0:
        return acc_idxs, rej_idxs
    acc_noise = np.random.choice(len(acc_idxs), size=int(len(acc_idxs)*rate))
    acc_noise = acc_idxs[acc_noise]
    new_acc = np.setdiff1d(acc_idxs, acc_noise)

    rej_noise = np.random.choice(len(rej_idxs), size=int(len(rej_idxs)*rate))
    rej_noise = rej_idxs[rej_noise]
    new_rej = np.setdiff1d(rej_idxs, rej_noise)

    new_acc = np.concatenate((new_acc, rej_noise), axis=0)
    new_rej = np.concatenate((new_rej, acc_noise), axis=0)
    return new_acc, new_rej


def init_sampling(tm, method, round, budget, ulb_wrong):
    print("Feedback sampling initialization ({}):".format(method))
    rate = list()
    for _ in range(round):
        correct = np.array([]).astype(np.int32)
        wrong = np.array([]).astype(np.int32)
        
        suggest_idxs, _ = tm.sample_batch_init(correct, wrong, budget)
        suggest_idxs = ulb_idxs[suggest_idxs]
        correct = np.intersect1d(suggest_idxs, ulb_wrong)
        rate.append(len(correct)/budget)
    print("Init success Rate:\t{:.4f}".format(sum(rate)/len(rate)))
    return sum(rate)/len(rate)


def feedback_sampling(tm, method, round, budget, ulb_wrong, noise_rate=0, replace_init=None):
    print("--------------------------------------------------------")
    print("({}) with noise rate {}:\n".format(method, noise_rate))
    rate = np.zeros(round)
    correct = np.array([]).astype(np.int32)
    wrong = np.array([]).astype(np.int32)
    map_ulb =ulb_idxs.tolist()

    map_acc_idxs = np.array([map_ulb.index(i) for i in correct]).astype(np.int32)
    map_rej_idxs = np.array([map_ulb.index(i) for i in wrong]).astype(np.int32)
    suggest_idxs, _ = tm.sample_batch_init(map_acc_idxs, map_rej_idxs, budget)
    suggest_idxs = ulb_idxs[suggest_idxs]
    correct = np.intersect1d(suggest_idxs, ulb_wrong)
    wrong = np.setdiff1d(suggest_idxs, correct)
    if replace_init is None:
        rate[0] = len(correct)/budget
    else:
        rate[0] = replace_init
    # inject noise
    correct, wrong = add_noise(noise_rate, correct, wrong)
    for r in range(1, round):
        map_acc_idxs = np.array([map_ulb.index(i) for i in correct]).astype(np.int32)
        map_rej_idxs = np.array([map_ulb.index(i) for i in wrong]).astype(np.int32)
        suggest_idxs,_,coef_ = tm.sample_batch(map_acc_idxs, map_rej_idxs, budget, True)
        suggest_idxs = ulb_idxs[suggest_idxs]

        c = np.intersect1d(np.intersect1d(suggest_idxs, ulb_idxs), ulb_wrong)
        w = np.setdiff1d(suggest_idxs, c)
        rate[r] = len(c) / budget

        # inject noise
        c, w = add_noise(noise_rate, c, w)
        correct = np.concatenate((correct, c), axis=0)
        wrong = np.concatenate((wrong, w), axis=0)
    ac_rate = np.array([rate[:i].mean() for i in range(1, len(rate)+1)])
    # print("Success Rate:{:.3f}\n{}\n".format(ac_rate[-1], repr(ac_rate)))
    print("Feature Importance:\t{}\n".format(coef_))
    return ac_rate, coef_

def feedback_sampling_efficiency(tm, method, round, budget, ulb_wrong, repeat, noise_rate=0):
    print("--------------------------------------------------------")
    print("({}) with noise rate {}:\n".format(method, noise_rate))
    all_time_cost = np.zeros(round)
    for _ in range(repeat):
        time_cost = np.zeros(round)
        correct = np.array([]).astype(np.int32)
        wrong = np.array([]).astype(np.int32)
        map_ulb =ulb_idxs.tolist()

        map_acc_idxs = np.array([map_ulb.index(i) for i in correct]).astype(np.int32)
        map_rej_idxs = np.array([map_ulb.index(i) for i in wrong]).astype(np.int32)
        t0 = time.time()
        suggest_idxs, _ = tm.sample_batch_init(map_acc_idxs, map_rej_idxs, budget)
        t1 = time.time()
        suggest_idxs = ulb_idxs[suggest_idxs]
        correct = np.intersect1d(suggest_idxs, ulb_wrong)
        wrong = np.setdiff1d(suggest_idxs, correct)
        time_cost[0] = t1-t0
        # inject noise
        correct, wrong = add_noise(noise_rate, correct, wrong)
        for r in range(1, round):
            map_acc_idxs = np.array([map_ulb.index(i) for i in correct]).astype(np.int32)
            map_rej_idxs = np.array([map_ulb.index(i) for i in wrong]).astype(np.int32)
            t0 = time.time()
            suggest_idxs,_,_ = tm.sample_batch(map_acc_idxs, map_rej_idxs, budget, True)
            t1 = time.time()
            suggest_idxs = ulb_idxs[suggest_idxs]

            c = np.intersect1d(np.intersect1d(suggest_idxs, ulb_idxs), ulb_wrong)
            w = np.setdiff1d(suggest_idxs, c)
            time_cost[r] = t1-t0

            # inject noise
            c, w = add_noise(noise_rate, c, w)
            correct = np.concatenate((correct, c), axis=0)
            wrong = np.concatenate((wrong, w), axis=0)
        all_time_cost =  all_time_cost+ time_cost
    print("Time Cost:\n{}\n".format(repr(all_time_cost/repeat))) 
    return all_time_cost/repeat

def record(old_array, to_be_record, task, dataset, method, rate, tolerance):
    for i, v in enumerate(to_be_record, start=1):
        if old_array is None:
            old_array = np.array([task, dataset, method, rate, tolerance, str(i), str(v)])
        else:
            old_array = np.vstack((old_array, np.array([task, dataset, method, rate, tolerance, str(i), str(v)])))
    return old_array


parser = argparse.ArgumentParser()
parser.add_argument('--dataset', type=str, choices=["cifar10","mnist","fmnist"])
parser.add_argument('--rate', type=int, choices=[30,10,20])
parser.add_argument("--tolerance", nargs="+", type=float, help="Feedback noise")
parser.add_argument('--repeat', type=int, default=100, help="repeat x times to evaluate efficiency")
parser.add_argument("--budget", type=int, default=50)
parser.add_argument("--init_round", type=int, default=10000)
parser.add_argument("--round", type=int, default=10, help="Feedback round")
parser.add_argument("-g", default="0")
args = parser.parse_args()

# tensorflow
visible_device = "0,1,2,3"
os.environ["CUDA_VISIBLE_DEVICES"] = visible_device

# get hyperparameters
DATASET = args.dataset
RATE = args.rate
BUDGET = args.budget
TOLERANCE = args.tolerance
ROUND = args.round
INIT_ROUND = args.init_round
GPU_ID = args.g
REPEAT = args.repeat

print(DATASET, RATE)

# load meta data
CONTENT_PATH = "/home/xianglin/projects/DVI_data/active_learning/random/resnet18/{}/{}".format(DATASET.upper(), RATE)
with open(os.path.join(CONTENT_PATH, "config.json"), "r") as f:
    config = json.load(f)
config = config["tfDVI"]

CLASSES = config["CLASSES"]
if GPU_ID is None:
    GPU_ID = config["GPU"]
EPOCH_START = config["EPOCH_START"]
EPOCH_END = config["EPOCH_END"]
EPOCH_PERIOD = config["EPOCH_PERIOD"]

# Training parameter (subject model)
TRAINING_PARAMETER = config["TRAINING"]
NET = TRAINING_PARAMETER["NET"]
LEN = TRAINING_PARAMETER["train_num"]   # all

# define hyperparameters
DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

sys.path.append(CONTENT_PATH)
import Model.model as subject_model
net = eval("subject_model.{}()".format(NET))
data_provider = ActiveLearningDataProvider(CONTENT_PATH, net, EPOCH_START,device=DEVICE, classes=CLASSES, iteration_name="Epoch")

# meta info
lb_idxs = data_provider.get_labeled_idx(EPOCH_END)
ulb_idxs = data_provider.get_unlabeled_idx(LEN, lb_idxs)

data = data_provider.train_representation_all(EPOCH_END)
labels = data_provider.train_labels_all(EPOCH_END)
pred = data_provider.get_pred(EPOCH_END, data).argmax(1)
wrong_pred_idx = np.argwhere(pred!=labels).squeeze()
ulb_wrong = np.intersect1d(wrong_pred_idx, ulb_idxs)

# evaluate
with open(os.path.join(CONTENT_PATH,'tfDVI_sample_recommender.pkl'), 'rb') as f:
    dvi_tm = pickle.load(f)
with open(os.path.join(CONTENT_PATH,'TimeVis_sample_recommender.pkl'), 'rb') as f:
    timevis_tm = pickle.load(f)

# #############################################
# #               score comparing             #
# #############################################

# dvi_p_score = dvi_tm._sample_p_scores
# dvi_v_score = dvi_tm._sample_v_scores
# dvi_a_score = dvi_tm._sample_a_scores

# timevis_p_score = timevis_tm._sample_p_scores
# timevis_v_score = timevis_tm._sample_v_scores
# timevis_a_score = timevis_tm._sample_a_scores

# p_corr,_ = spearmanr(dvi_p_score, timevis_p_score)
# v_corr,_ = spearmanr(dvi_v_score, timevis_v_score)
# a_corr,_ = spearmanr(dvi_a_score, timevis_a_score)
# print("Position ranking corr:\t{:.3f}".format(p_corr))
# print("Velocity ranking corr:\t{:.3f}".format(v_corr))
# print("Accelera ranking corr:\t{:.3f}".format(a_corr))

data = None
# #############################################
# #                   init                    #
# #############################################
# # random init
# print("Random sampling init")
# random_rate = list()
# pool = np.array(ulb_idxs)
# for _ in range(INIT_ROUND):
#     s_idxs = np.random.choice(pool,size=BUDGET,replace=False)
#     random_rate.append(len(np.intersect1d(s_idxs, ulb_wrong))/BUDGET)
# print("Success Rate:\t{:.4f}".format(sum(random_rate)/len(random_rate)))
# random_init = sum(random_rate)/len(random_rate)

# # dvi init
# dvi_init = init_sampling(tm=dvi_tm, method="DVI", round=INIT_ROUND, budget=BUDGET, ulb_wrong=ulb_wrong)

# # timevis init
# timevis_init = init_sampling(tm=timevis_tm, method="TimeVis", round=INIT_ROUND, budget=BUDGET, ulb_wrong=ulb_wrong)

# #############################################
# #                 Feedback                  #
# #############################################
# # random sampling
# print("--------------------------------------------------------")
# print("Random sampling feedback:\n")
# random_rate = np.zeros(ROUND)
# pool = np.array(ulb_idxs)
# for r in range(ROUND):
#     s_idxs = np.random.choice(pool,size=BUDGET,replace=False)
#     random_rate[r] = len(np.intersect1d(s_idxs, ulb_wrong))/BUDGET
#     pool = np.setdiff1d(pool, s_idxs)
# random_rate[0] = random_init
# ac_random_rate = np.array([random_rate[:i].mean() for i in range(1, len(random_rate)+1)])
# print("Random Success Rate:{:.3f}\n{}\n".format(ac_random_rate[-1], repr(ac_random_rate)))
# data = record(data, ac_random_rate, "feedback", DATASET, "Random", RATE, 0.0)

# # dvi sampling
# ac_dvi_rate, dvi_coef_ = feedback_sampling(tm=dvi_tm, method="tfDVI", round=ROUND, budget=BUDGET, ulb_wrong=ulb_wrong ,noise_rate=0.0, replace_init=dvi_init)
# # data = record(data, ac_dvi_rate, "feedback", DATASET, "DVI", RATE, 0.0)
# data = record(data, dvi_coef_, "FI", DATASET, "DVI", RATE, 0.0)

# # timevis sampling
# ac_tv_rate, tv_coef_ = feedback_sampling(tm=timevis_tm, method="TimeVis", round=ROUND, budget=BUDGET, ulb_wrong=ulb_wrong, noise_rate=0.0, replace_init=timevis_init)
# # data = record(data, ac_tv_rate, "feedback", DATASET, "TimeVis", RATE, 0.0)
# data = record(data, tv_coef_, "FI", DATASET, "TimeVis", RATE, 0.0)

# #############################################
# #              Noise Feedback               #
# #############################################
# for tol in TOLERANCE:
#     # dvi tolerance
#     ac_dvi_rate, _ = feedback_sampling(tm=dvi_tm, method="tfDVI", round=ROUND, budget=BUDGET, ulb_wrong=ulb_wrong, noise_rate=tol, replace_init=dvi_init)
#     data = record(data, ac_dvi_rate, "feedback", DATASET, "DVI", RATE, tol)

#     # timevis tolerance
#     ac_tv_rate, _ = feedback_sampling(tm=timevis_tm, method="TimeVis", round=ROUND, budget=BUDGET, ulb_wrong=ulb_wrong, noise_rate=tol, replace_init=timevis_init)
#     data = record(data, ac_tv_rate, "feedback", DATASET, "TimeVis", RATE, tol)

# #############################################
# #           Feedback Efficiency             #
# #############################################
# # dvi time cost
# dvi_c = feedback_sampling_efficiency(tm=dvi_tm, method="tfDVI", round=ROUND, budget=BUDGET, ulb_wrong=ulb_wrong, repeat=REPEAT, noise_rate=0.0)
# data = record(data, dvi_c, "efficiency", DATASET, "DVI", RATE, 0.0)

# # timevis time cost
# timevis_c = feedback_sampling_efficiency(tm=timevis_tm, method="TimeVis", round=ROUND, budget=BUDGET, ulb_wrong=ulb_wrong, repeat=REPEAT, noise_rate=0.0)
# data = record(data, timevis_c, "efficiency", DATASET, "TimeVis", RATE, 0.0)

#############################################
#              Random Anomaly               #
#############################################
xs = dvi_tm.embeddings_2d[:, -dvi_tm.period:, 0]
ys = dvi_tm.embeddings_2d[:, -dvi_tm.period:, 1]
vx = xs[:, 1:]-xs[:, :-1]
vy = ys[:, 1:]-ys[:, :-1]

for _ in range(100):
    # new_sample = generate_random_trajectory(xs.min(), ys.min(), xs.max(), ys.max(), dvi_tm.period)
    idx = np.random.choice(len(xs), 1)[0]
    init_position = [xs[idx, 0], ys[idx, 0]]
    vx_mean = vx[idx]+1
    vy_mean = vy[idx]-1
    new_sample = generate_random_trajectory_momentum(init_position, dvi_tm.period ,1,.1, vx_mean, vy_mean)
    dvi_new_score = dvi_tm.score_new_sample(new_sample)
    # data = record(data, dvi_new_score, "RA", DATASET, "DVI", RATE, 0.0)
    data = record(data, dvi_new_score, "RA_M", DATASET, "DVI", RATE, 0.0)

xs = timevis_tm.embeddings_2d[:, -timevis_tm.period:, 0]
ys = timevis_tm.embeddings_2d[:, -timevis_tm.period:, 1]
vx = xs[:, 1:]-xs[:, :-1]
vy = ys[:, 1:]-ys[:, :-1]

for _ in range(100):
    # new_sample = generate_random_trajectory(xs.min(), ys.min(), xs.max(), ys.max(), timevis_tm.period)
    idx = np.random.choice(len(xs), 1)[0]
    init_position = [xs[idx, 0], ys[idx, 0]]
    vx_mean = vx[idx]+1
    vy_mean = vy[idx]-1
    new_sample = generate_random_trajectory_momentum(init_position, timevis_tm.period ,1,.1, vx_mean, vy_mean)
    
    tv_new_score = timevis_tm.score_new_sample(new_sample)
    # data = record(data, tv_new_score, "RA", DATASET, "TimeVis", RATE, 0.0)
    data = record(data, tv_new_score, "RA_M", DATASET, "TimeVis", RATE, 0.0)

#############################################
#                    Save                   #
#############################################
# read results
eval_path = "/home/xianglin/projects/DVI_data/active_learning/random/resnet18/feedback.xlsx"
col = np.array(["task", "dataset", "method", "rate", "tolerance", "iter", "eval"])
if os.path.exists(eval_path):
    df = pd.read_excel(eval_path, index_col=0, dtype={"task":str, "dataset":str, "method":str, "rate":int, "tolerance":float, "iter":int, "eval":float})
else:
    df = pd.DataFrame({}, columns=col)
df_curr = pd.DataFrame(data, columns=col)
df = df.append(df_curr, ignore_index=True)
df.to_excel(eval_path)