########################################################################################################################
#                                                          IMPORT                                                      #
########################################################################################################################
import torch
import tensorflow as tf
import sys
import os
import json
import argparse
from umap.umap_ import find_ab_params

from singleVis.SingleVisualizationModel import tfModel
from singleVis.losses import umap_loss, reconstruction_loss, regularize_loss
from singleVis.edge_dataset import construct_edge_dataset
from singleVis.data import NormalDataProvider
from singleVis.spatial_edge_constructor import tfEdgeConstructor
from singleVis.projector import tfDVIProjector
from singleVis.eval.evaluator import Evaluator
########################################################################################################################
#                                                     DVI PARAMETERS                                                   #
########################################################################################################################
"""This serve as an example of DeepVisualInsight implementation in tensorflow."""
VIS_METHOD = "tfDVI" # DeepVisualInsight

########################################################################################################################
#                                                     LOAD PARAMETERS                                                  #
########################################################################################################################import os
os.environ["CUDA_DEVICE_ORDER"]="PCI_BUS_ID"   # see issue #152
os.environ["CUDA_VISIBLE_DEVICES"]="0,1,2"

parser = argparse.ArgumentParser(description='Process hyperparameters...')
parser.add_argument('--content_path', type=str)
args = parser.parse_args()

CONTENT_PATH = args.content_path
sys.path.append(CONTENT_PATH)
with open(os.path.join(CONTENT_PATH, "config.json"), "r") as f:
    config = json.load(f)
config = config[VIS_METHOD]

# record output information
# now = time.strftime("%Y-%m-%d-%H_%M_%S", time.localtime(time.time())) 
# sys.stdout = open(os.path.join(CONTENT_PATH, now+".txt"), "w")

SETTING = config["SETTING"]
CLASSES = config["CLASSES"]
DATASET = config["DATASET"]
PREPROCESS = config["VISUALIZATION"]["PREPROCESS"]
GPU_ID = config["GPU"]
EPOCH_START = config["EPOCH_START"]
EPOCH_END = config["EPOCH_END"]
EPOCH_PERIOD = config["EPOCH_PERIOD"]

# Training parameter (subject model)
TRAINING_PARAMETER = config["TRAINING"]
NET = TRAINING_PARAMETER["NET"]
LEN = TRAINING_PARAMETER["train_num"]

# Training parameter (visualization model)
VISUALIZATION_PARAMETER = config["VISUALIZATION"]
LAMBDA1 = VISUALIZATION_PARAMETER["LAMBDA1"]
LAMBDA2 = VISUALIZATION_PARAMETER["LAMBDA2"]
B_N_EPOCHS = VISUALIZATION_PARAMETER["BOUNDARY"]["B_N_EPOCHS"]
L_BOUND = VISUALIZATION_PARAMETER["BOUNDARY"]["L_BOUND"]
ENCODER_DIMS = VISUALIZATION_PARAMETER["ENCODER_DIMS"]
DECODER_DIMS = VISUALIZATION_PARAMETER["DECODER_DIMS"]
S_N_EPOCHS = VISUALIZATION_PARAMETER["S_N_EPOCHS"]
N_NEIGHBORS = VISUALIZATION_PARAMETER["N_NEIGHBORS"]
PATIENT = VISUALIZATION_PARAMETER["PATIENT"]
MAX_EPOCH = VISUALIZATION_PARAMETER["MAX_EPOCH"]
BATCH_SIZE = VISUALIZATION_PARAMETER["BATCH_SIZE"]

VIS_MODEL_NAME = VISUALIZATION_PARAMETER["VIS_MODEL_NAME"]
EVALUATION_NAME = VISUALIZATION_PARAMETER["EVALUATION_NAME"]

# Define hyperparameters
DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

import Model.model as subject_model
net = eval("subject_model.{}()".format(NET))

########################################################################################################################
#                                                    TRAINING SETTING                                                  #
########################################################################################################################
# Define data_provider
data_provider = NormalDataProvider(CONTENT_PATH, net, EPOCH_START, EPOCH_END, EPOCH_PERIOD, device=DEVICE, classes=CLASSES, epoch_name="Epoch", verbose=1)
if PREPROCESS:
    data_provider._meta_data()
    if B_N_EPOCHS >0:
        data_provider._estimate_boundary(LEN//10, l_bound=L_BOUND)

# Define Losses
losses = {}
loss_weights = {}

negative_sample_rate = 5
min_dist = .1
_a, _b = find_ab_params(1.0, min_dist)
# umap loss
umap_loss_fn = umap_loss(
    BATCH_SIZE,
    negative_sample_rate,
    _a,
    _b,
)
losses["umap"] = umap_loss_fn
loss_weights["umap"] = 1.0

recon_loss_fn = reconstruction_loss(beta=1)
losses["reconstruction"] = recon_loss_fn
loss_weights["reconstruction"] = LAMBDA1

regularize_loss_fn = regularize_loss()
losses["regularization"] = regularize_loss_fn
loss_weights["regularization"] = LAMBDA2  # TODO: change this weight

# define training
optimizer = tf.keras.optimizers.Adam()

# Define visualization models
weights_dict = {}
model = tfModel(optimizer=optimizer, encoder_dims=ENCODER_DIMS, decoder_dims=DECODER_DIMS, loss=losses, loss_weights=loss_weights, batch_size=BATCH_SIZE, prev_trainable_variables=None)
callbacks = [
    tf.keras.callbacks.EarlyStopping(
        monitor='loss',
        min_delta=10 ** -2,
        patience=8,
        verbose=1,
    ),
    tf.keras.callbacks.LearningRateScheduler(lambda epoch: 1e-3 if epoch < 8 else 1e-4),
    tf.keras.callbacks.LambdaCallback(on_train_end=lambda logs: weights_dict.update(
        {'prev': [tf.identity(tf.stop_gradient(x)) for x in model.trainable_weights]})),
]
# edge constructor
spatial_cons = tfEdgeConstructor(data_provider, S_N_EPOCHS, B_N_EPOCHS, N_NEIGHBORS)
# Define Projector
flag = "_temporal_id{}".format("_withoutB" if B_N_EPOCHS==0 else "")

projector = tfDVIProjector(CONTENT_PATH, flag=flag)

for iteration in range(EPOCH_START, EPOCH_END+EPOCH_PERIOD, EPOCH_PERIOD):
    model.compile(
        optimizer=optimizer, loss=losses, loss_weights=loss_weights,
    )
    edge_to, edge_from, probs, feature_vectors, attention, n_rate = spatial_cons.construct(iteration-EPOCH_PERIOD, iteration)
    edge_dataset = construct_edge_dataset(edge_to, edge_from, probs, feature_vectors, attention, n_rate, BATCH_SIZE)
    steps_per_epoch = int(
        len(edge_to) / BATCH_SIZE / 10
    )
    # create embedding
    model.fit(
        edge_dataset,
        epochs=200, # a large value, because we have early stop callback
        steps_per_epoch=steps_per_epoch,
        callbacks=callbacks,
        max_queue_size=100,
    )
    # save for later use
    model.prev_trainable_variables = weights_dict["prev"]
    # save
    model.encoder.save(os.path.join(CONTENT_PATH, "Model", "Epoch_{:d}".format(iteration), "encoder" + flag))
    model.decoder.save(os.path.join(CONTENT_PATH, "Model", "Epoch_{:d}".format(iteration), "decoder" + flag))
    print("save visualized model for Epoch {:d}".format(iteration))

########################################################################################################################
#                                                      VISUALIZATION                                                   #
########################################################################################################################

from singleVis.visualizer import visualizer

vis = visualizer(data_provider, projector, 200, "tab10")
save_dir = os.path.join(data_provider.content_path, "img")
if not os.path.exists(save_dir):
    os.mkdir(save_dir)
for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
    vis.savefig(i, path=os.path.join(save_dir, "{}_{}_{}.png".format(DATASET, i, VIS_METHOD)))

    
########################################################################################################################
#                                                       EVALUATION                                                     #
########################################################################################################################
eval_epochs = range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD)
EVAL_EPOCH_DICT = {
    "mnist":[1,10,15],
    "fmnist":[1,25,50],
    "cifar10":[1,100,199]
}
eval_epochs = EVAL_EPOCH_DICT[DATASET]
evaluator = Evaluator(data_provider, projector)

for eval_epoch in eval_epochs:
    evaluator.save_epoch_eval(eval_epoch, 15, temporal_k=5, file_name="{}".format(EVALUATION_NAME))
