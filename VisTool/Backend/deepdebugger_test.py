import torch
import sys, os
import json

import argparse


from singleVis.SingleVisualizationModel import VisModel
from singleVis.data import NormalDataProvider
from singleVis.eval.evaluator import Evaluator
from singleVis.projector import DeepDebuggerProjector

########################################################################################################################
#                                                     LOAD PARAMETERS                                                  #
########################################################################################################################
VIS_METHOD= "DeepDebugger"

parser = argparse.ArgumentParser(description='Process hyperparameters...')
parser.add_argument('--content_path', type=str)
args = parser.parse_args()

CONTENT_PATH = args.content_path
sys.path.append(CONTENT_PATH)
with open(os.path.join(CONTENT_PATH, "config.json"), "r") as f:
    conf = json.load(f)
config = conf[VIS_METHOD]

# record output information
# now = time.strftime("%Y-%m-%d-%H_%M_%S", time.localtime(time.time())) 
# sys.stdout = open(os.path.join(CONTENT_PATH, now+".txt"), "w")

SETTING = config["SETTING"]
CLASSES = config["CLASSES"]
DATASET = config["DATASET"]
PREPROCESS = config["VISUALIZATION"]["PREPROCESS"]
GPU_ID = config["GPU"]
GPU_ID = "0"
EPOCH_START = config["EPOCH_START"]
EPOCH_END = config["EPOCH_END"]
EPOCH_PERIOD = config["EPOCH_PERIOD"]

# Training parameter (subject model)
TRAINING_PARAMETER = config["TRAINING"]
NET = TRAINING_PARAMETER["NET"]
LEN = TRAINING_PARAMETER["train_num"]

# Training parameter (visualization model)
VISUALIZATION_PARAMETER = config["VISUALIZATION"]
LAMBDA = VISUALIZATION_PARAMETER["LAMBDA"]
S_LAMBDA = VISUALIZATION_PARAMETER["S_LAMBDA"]
B_N_EPOCHS = VISUALIZATION_PARAMETER["BOUNDARY"]["B_N_EPOCHS"]
L_BOUND = VISUALIZATION_PARAMETER["BOUNDARY"]["L_BOUND"]
INIT_NUM = VISUALIZATION_PARAMETER["INIT_NUM"]
ALPHA = VISUALIZATION_PARAMETER["ALPHA"]
BETA = VISUALIZATION_PARAMETER["BETA"]
MAX_HAUSDORFF = VISUALIZATION_PARAMETER["MAX_HAUSDORFF"]
ENCODER_DIMS = VISUALIZATION_PARAMETER["ENCODER_DIMS"]
DECODER_DIMS = VISUALIZATION_PARAMETER["DECODER_DIMS"]
S_N_EPOCHS = VISUALIZATION_PARAMETER["S_N_EPOCHS"]
T_N_EPOCHS = VISUALIZATION_PARAMETER["T_N_EPOCHS"]
N_NEIGHBORS = VISUALIZATION_PARAMETER["N_NEIGHBORS"]
PATIENT = VISUALIZATION_PARAMETER["PATIENT"]
MAX_EPOCH = VISUALIZATION_PARAMETER["MAX_EPOCH"]

VIS_MODEL_NAME = VISUALIZATION_PARAMETER["VIS_MODEL_NAME"]
EVALUATION_NAME = VISUALIZATION_PARAMETER["EVALUATION_NAME"]

# define hyperparameters
DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")
import Model.model as subject_model
# net = resnet18()
net = eval("subject_model.{}()".format(NET))
classes = ("airplane", "car", "bird", "cat", "deer", "dog", "frog", "horse", "ship", "truck")


########################################################################################################################
#                                                    TRAINING SETTING                                                  #
########################################################################################################################
data_provider = NormalDataProvider(CONTENT_PATH, net, EPOCH_START, EPOCH_END, EPOCH_PERIOD,  device=DEVICE, classes=CLASSES,verbose=1)
if PREPROCESS:
    data_provider._meta_data()
    if B_N_EPOCHS >0:
        data_provider._estimate_boundary(LEN//10, l_bound=L_BOUND)

model = VisModel(ENCODER_DIMS, DECODER_DIMS)
SEGMENTS = VISUALIZATION_PARAMETER["SEGMENTS"]
RESUME_SEG = VISUALIZATION_PARAMETER["RESUME_SEG"]

projector = DeepDebuggerProjector(vis_model=model, content_path=CONTENT_PATH, vis_model_name=VIS_MODEL_NAME, segments=SEGMENTS, device=DEVICE)

########################################################################################################################
#                                                      VISUALIZATION                                                   #
########################################################################################################################
# from singleVis.visualizer import visualizer
# vis = visualizer(data_provider, projector, 200)
# save_dir = os.path.join(data_provider.content_path, "img")
# os.makedirs(save_dir, exist_ok=True)

# noise_label = os.path.join(data_provider.content_path, "noisy_label.json")
# with open(noise_label, "r") as f:
#     noise_labels = json.load(f)

# for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
# for i in [20]:
    # vis.savefig(i, path=os.path.join(save_dir, "{}_{}_{}.png".format(DATASET, i)))
    # data = data_provider.train_representation(i)
    # labels = data_provider.train_labels(i)
    # selected = labels != np.array(noise_labels)
    # data = data[selected]
    # labels = np.array(noise_labels)[selected]
    # vis.savefig_cus(i, data, labels, labels, path=os.path.join(save_dir, "{}_{}_tnn.png".format(DATASET, i)))
# from singleVis.visualizer import visualizer
# vis = visualizer(data_provider, projector, 200)
# save_dir = os.path.join(data_provider.content_path, "img")
# os.makedirs(save_dir, exist_ok=True)

# for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
#     vis.savefig(i, path=os.path.join(save_dir, "{}_{}_{}.png".format(DATASET, i, VIS_METHOD)))
########################################################################################################################
#                                                       EVALUATION                                                     #
########################################################################################################################
EVAL_EPOCH_DICT = {
    "mnist":[1,10,15],
    "fmnist":[1,25,50],
    "cifar10":[1,100,199]
}
eval_epochs = EVAL_EPOCH_DICT[DATASET]

evaluator = Evaluator(data_provider, projector)
for eval_epoch in eval_epochs:
    # evaluator.save_epoch_eval(eval_epoch, 10, temporal_k=3, file_name=EVALUATION_NAME)
    evaluator.save_epoch_eval(eval_epoch, 15, temporal_k=5, file_name=EVALUATION_NAME)
    # evaluator.save_epoch_eval(eval_epoch, 20, temporal_k=7,file_name=EVALUATION_NAME)
