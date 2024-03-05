import os, sys
import numpy as np
import torch
import json
import argparse
import pickle
import torchvision
import torchvision.transforms as transforms

from singleVis.SingleVisualizationModel import VisModel
from singleVis.data import NormalDataProvider
from singleVis.projector import Projector, tfDVIProjector, TimeVisProjector


parser = argparse.ArgumentParser()
parser.add_argument('--dataset', type=str, choices=["cifar10","mnist","fmnist"])
parser.add_argument('--noise_rate', type=int, default=5, choices=[5,10,20])
parser.add_argument("--batch_size", type=int, default=500)
parser.add_argument('--method', type=str, choices=["tfDVI", "TimeVis"])
args = parser.parse_args()

dataset = args.dataset
noise_type = "symmetric"
noise_rate = args.noise_rate
batch_size = args.batch_size
VIS_METHOD = args.method

inject_OOD = {
    "mnist":"cifar10",
    "fmnist":"mnist",
    "cifar10":"mnist"
}

# tensorflow
visible_device = "0,1,2,3"
os.environ["CUDA_VISIBLE_DEVICES"] = visible_device

CONTENT_PATH = "/home/xianglin/projects/DVI_data/noisy/{}/{}/{}/".format(noise_type, dataset, noise_rate)
sys.path.append(CONTENT_PATH)
with open(os.path.join(CONTENT_PATH, "config.json"), "r") as f:
    config = json.load(f)
config = config[VIS_METHOD]

CLASSES = config["CLASSES"]
GPU_ID = config["GPU"]
EPOCH_START = config["EPOCH_START"]
EPOCH_END = config["EPOCH_END"]
EPOCH_PERIOD = config["EPOCH_PERIOD"]

# Training parameter (subject model)
TRAINING_PARAMETER = config["TRAINING"]
NET = TRAINING_PARAMETER["NET"]
LEN = TRAINING_PARAMETER["train_num"]
test_len = TRAINING_PARAMETER["test_num"]
# Training parameter (visualization model)
VISUALIZATION_PARAMETER = config["VISUALIZATION"]
ENCODER_DIMS = VISUALIZATION_PARAMETER["ENCODER_DIMS"]
DECODER_DIMS = VISUALIZATION_PARAMETER["DECODER_DIMS"]
VIS_MODEL_NAME = VISUALIZATION_PARAMETER["VIS_MODEL_NAME"]

TOTOAL_EPOCH = (EPOCH_END-EPOCH_START)//EPOCH_PERIOD + 1

# define hyperparameters
DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

import Model.model as subject_model
# net = resnet18()
net = eval("subject_model.{}()".format(NET))

data_provider = NormalDataProvider(CONTENT_PATH, net, EPOCH_START, EPOCH_END, EPOCH_PERIOD, device=DEVICE, classes=CLASSES, epoch_name="Epoch", verbose=1)

if VIS_METHOD == "tfDVI":
    # Define Projector
    flag = "_temporal_id_withoutB"
    projector = tfDVIProjector(CONTENT_PATH, flag=flag)
elif VIS_METHOD == "TimeVis":
    model = VisModel(ENCODER_DIMS, DECODER_DIMS)
    projector = TimeVisProjector(vis_model=model, content_path=CONTENT_PATH, vis_model_name=VIS_MODEL_NAME, device=DEVICE)
elif VIS_METHOD == "DeepDebugger":
    model = VisModel(ENCODER_DIMS, DECODER_DIMS)
    SEGMENTS = VISUALIZATION_PARAMETER["SEGMENTS"]
    projector = Projector(vis_model=model, content_path=CONTENT_PATH, segments=SEGMENTS, device=DEVICE)

with open(os.path.join(CONTENT_PATH,  '{}_sample_recommender.pkl'.format(VIS_METHOD)), 'rb') as f:
    tm = pickle.load(f)

if inject_OOD[dataset] == "mnist":
    train_loader = torch.utils.data.DataLoader(
        torchvision.datasets.MNIST('experiments/data/', train=True, download=True,
                                transform=torchvision.transforms.Compose([
                                torchvision.transforms.ToTensor(),
                                torchvision.transforms.Normalize(
                                    # (0.1307,), (0.3081,))
                                    (0.5,), (0.5,))])),
        batch_size=batch_size, shuffle=True)
elif inject_OOD[dataset] == "cifar10":
    transform = transforms.Compose(
        [transforms.ToTensor(),
        transforms.Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5))])
    trainset = torchvision.datasets.CIFAR10(root='experiments/data', train=True,
                                            download=True, transform=transform)
    train_loader = torch.utils.data.DataLoader(trainset, batch_size=batch_size, shuffle=True)
elif inject_OOD[dataset] == "fmnist":
    train_loader = torch.utils.data.DataLoader(
        torchvision.datasets.FashionMNIST('expriments/data', train=True, download=True,
                                transform=torchvision.transforms.Compose([
                                    torchvision.transforms.ToTensor(),
                                    torchvision.transforms.Normalize(
                                        (0.5,), (0.5,))
                                ])),
        batch_size=batch_size, shuffle=True)

detect_anomaly = lambda scores: max(scores)>0.98

anomaly = 0
# true sample
selected = np.random.choice(test_len, batch_size, replace=False)
samples = np.zeros((TOTOAL_EPOCH, batch_size, 512))
for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
    e = (i-EPOCH_START)//EPOCH_PERIOD
    samples[e] = data_provider.test_representation(i)[selected]
embeddings_2d = np.zeros((TOTOAL_EPOCH, batch_size, 2))
for e in range(1, TOTOAL_EPOCH+1, 1):
    embeddings_2d[e-1] = projector.batch_project(e, samples[e-1])
embeddings_2d = np.transpose(embeddings_2d, [1,0,2])
for i in range(batch_size):
    scores = tm.score_new_sample(embeddings_2d[i][-tm.period:])
    anomaly = anomaly+ detect_anomaly(scores)
    print(scores, detect_anomaly(scores))
print(anomaly/batch_size)
normal_rate = anomaly/batch_size

# OOD
anomaly = 0
for img, target in train_loader:
    image = img.detach().cpu().numpy()
    if dataset == "mnist":
        image = image[:, :1, :28,:28]
    if dataset == "cifar10":
        image = np.pad(image, ((0,0),(1,1), (2, 2), (2, 2)), 'edge')
    embedding_2d = np.zeros((TOTOAL_EPOCH, batch_size, 2))
    for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
        e = int((i-EPOCH_START)/EPOCH_PERIOD)
        repr = data_provider.feature_function(i)(torch.from_numpy(image).to(DEVICE))
        embedding_2d[e] = projector.batch_project(i, repr.detach().cpu().numpy())
    embedding_2d = np.transpose(embedding_2d, [1,0,2])
    for i in range(batch_size):
        scores = tm.score_new_sample(embedding_2d[i][-tm.period:])
        anomaly = anomaly+ detect_anomaly(scores)
        print(scores, detect_anomaly(scores))
    break
print(anomaly/batch_size)
anomaly_rate = anomaly/batch_size

save_file = "/home/xianglin/projects/git_space/DLVisDebugger/anomaly_detection.txt"
line = [VIS_METHOD, dataset, str(float(normal_rate)), str(float(anomaly_rate))]
if not os.path.exists(save_file):
    with open(save_file, 'w') as f:
        for word in line:
            f.write(word)
            f.write("\t")
        f.write('\n')
else:
    with open(save_file, 'a') as f:
        for word in line:
            f.write(word)
            f.write("\t")
        f.write('\n')



    