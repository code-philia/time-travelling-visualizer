"""The Sampeling class serve as a helper module for retriving subject model data"""
from abc import ABC, abstractmethod

import os
import gc
import time

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from singleVis.utils import *
# from sklearn.neighbors import NearestNeighbors
# from scipy.special import gamma
# import math
# from pynndescent import NNDescent
# from sklearn.cluster import KMeans

from scipy.special import softmax
import torch
from torch import nn
from torch.nn import functional as F

class VAE(nn.Module):
    def __init__(self, input_dim, hidden_dim, latent_dim):
        super(VAE, self).__init__()
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.fc21 = nn.Linear(hidden_dim, latent_dim)
        self.fc22 = nn.Linear(hidden_dim, latent_dim)
        self.fc3 = nn.Linear(latent_dim, hidden_dim)
        self.fc4 = nn.Linear(hidden_dim, input_dim)

    def encode(self, x):
        h1 = F.relu(self.fc1(x))
        return self.fc21(h1), self.fc22(h1)

    def reparameterize(self, mu, logvar):
        std = torch.exp(0.5*logvar)
        eps = torch.randn_like(std)
        return mu + eps*std

    def decode(self, z):
        h3 = F.relu(self.fc3(z))
        return torch.sigmoid(self.fc4(h3))

    def forward(self, x):
        mu, logvar = self.encode(x.view(-1, 512))
        z = self.reparameterize(mu, logvar)
        return self.decode(z), mu, logvar


"""
DataContainder module
1. calculate information entropy for singel sample and subset
2. sample informative subset
"""
class DataGenerationAbstractClass(ABC):
    
    def __init__(self, data_provider, epoch):
        self.mode = "abstract"
        self.data_provider = data_provider
        # self.model = model
        self.epoch = epoch
        
    # @abstractmethod
    # def info_calculator(self):
    #     pass

class DataGeneration(DataGenerationAbstractClass):
    def __init__(self, model, data_provider, epoch, device):
        self.data_provider = data_provider
        self.model = model
        # self.model = model
        self.epoch = epoch
        self.DEVICE = device
    
    def generate_adversarial_example(self,input_data, target,epsilon):
        self.model.to(self.DEVICE)
        self.model.eval()
        # 对输入数据进行梯度追踪
        input_data.requires_grad = True

        target = target.to(self.DEVICE)

        # 正向传播计算模型的输出
        output = self.model(input_data)
        loss_function = nn.CrossEntropyLoss()

        target = target.expand(input_data.size(0))
        loss = loss_function(output, target)


        """calculate the input data's  graint of the loss function """
        self.model.zero_grad()
        loss.backward()
        gradient = input_data.grad.data

        # generate adv samples
        adversarial_example = input_data + epsilon * gradient.sign()

        return adversarial_example

    def gen(self,epsilon=0.2,sample_ratio=0.1):
        labels = self.data_provider.train_labels(self.epoch)
        # training_data = self.data_provider.train_representation(self.epoch)

        training_data_path = os.path.join(self.data_provider.content_path, "Training_data")
        training_data = torch.load(os.path.join(training_data_path, "training_dataset_data.pth"),
                                        map_location="cpu")
        training_data = training_data.to(self.DEVICE)

        sample_ratio = sample_ratio
        adversarial_samples = []
        epsilon = epsilon  # perturbration

        for label in range(10):
            indices = np.where(labels == label)[0]  # indices of data in the current cluster
            sample_size = int(len(indices) * sample_ratio)  # number of samples to select
            sampled_indices = np.random.choice(indices, size=sample_size, replace=False)  # select samples without replacement
            sampled_data = torch.Tensor(training_data[sampled_indices])
            print("sampeled data:{}".format(len(sampled_data)))
            for i in range(10):
                if i == label:
                    continue
                target_label = i
                
                target = torch.tensor([target_label])  # target label
                adversarial_example = self.generate_adversarial_example(sampled_data, target, epsilon)
                print("generating class {} 's adversary sampes for target{}, num of adv{}".format(label,i,len(adversarial_example)))
                adversarial_samples.extend(adversarial_example)
        
        repr_model = self.feature_function(self.epoch)
        adversarial_samples_torch = torch.stack(adversarial_samples)
        print("adversarial_samples_torch", adversarial_samples_torch.shape)
        data_representation = batch_run(repr_model,adversarial_samples_torch)

        np.save(os.path.join(self.data_provider.content_path, "Model", "Epoch_{}".format(self.epoch), "adv_representation.npy"),data_representation )

        return adversarial_samples,data_representation
    
    def gen_specific_class_adv(self,epsilon=0.2,sample_ratio=0.1,from_label=1,target_label=2):
        labels = self.data_provider.train_labels(self.epoch)
        # training_data = self.data_provider.train_representation(self.epoch)

        training_data_path = os.path.join(self.data_provider.content_path, "Training_data")
        training_data = torch.load(os.path.join(training_data_path, "training_dataset_data.pth"),
                                        map_location="cpu")
        training_data = training_data.to(self.DEVICE)

        sample_ratio = sample_ratio
        adversarial_samples = []
        epsilon = epsilon  # perturbration

 
        indices = np.where(labels == from_label)[0]  # indices of data in the current cluster
        sample_size = int(len(indices) * sample_ratio)  # number of samples to select
        sampled_indices = np.random.choice(indices, size=sample_size, replace=False)  # select samples without replacement
        sampled_data = torch.Tensor(training_data[sampled_indices])
        print("sampeled data:{}".format(len(sampled_data)))
     
        target_label = target_label
        
        target = torch.tensor([target_label])  # target label
        adversarial_example = self.generate_adversarial_example(sampled_data, target, epsilon)
        print("generating class {} 's adversary sampes for target{}, num of adv{}".format(from_label,target_label,len(adversarial_example)))
        adversarial_samples.extend(adversarial_example)
        
        repr_model = self.feature_function(self.epoch)
        adversarial_samples_torch = torch.stack(adversarial_samples)
        print("adversarial_samples_torch", adversarial_samples_torch.shape)
        data_representation = batch_run(repr_model,adversarial_samples_torch)

        return adversarial_samples,data_representation
    
    
    def feature_function(self, epoch):
        model_path = os.path.join(self.data_provider.content_path, "Model")
        model_location = os.path.join(model_path, "{}_{:d}".format('Epoch', epoch), "subject_model.pth")
        self.model.load_state_dict(torch.load(model_location, map_location=torch.device("cpu")))
        self.model = self.model.to(self.DEVICE)
        self.model.eval()

        fea_fn = self.model.feature
        return fea_fn

    def vae_loss(self,recon_x, x, mu, logvar):
        BCE = F.binary_cross_entropy(recon_x, x.view(-1, 512), reduction='sum')
        KLD = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp())
        return BCE + KLD
    
    def generate_by_VAE(self):
        train_data = self.data_provider.train_representation(self.epoch)
        data_loader = torch.utils.data.DataLoader(train_data, batch_size=32, shuffle=True)
        vae = VAE(512, 256, 2).to(self.data_provider.DEVICE)  # Example dimensions
        optimizer = optim.Adam(vae.parameters())
       

        vae.train()
        num_epochs = 20  # Example

        for epoch in range(num_epochs):
            for i, data in enumerate(data_loader):

                data = data.to(self.data_provider.DEVICE)
                optimizer.zero_grad()

                recon_batch, mu, logvar = vae(data)

                loss = self.vae_loss(recon_batch, data, mu, logvar)

                loss.backward()
                optimizer.step()

            print(f'Epoch {epoch}, Loss: {loss.item()}')
        

        with torch.no_grad():
            mu, _ = vae.encode(torch.Tensor(train_data).to(self.data_provider.DEVICE))
            mu = mu.cpu().numpy()  # Convert to numpy array for easier manipulation

        ebd_min = np.min(mu, axis=0)
        ebd_max = np.max(mu, axis=0)
        ebd_extent = ebd_max - ebd_min
        x_min, y_min = ebd_min - 0.02 * ebd_extent
        x_max, y_max = ebd_max + 0.02 * ebd_extent
        x_min = min(x_min, y_min)
        y_min = min(x_min, y_min)
        x_max = max(x_max, y_max)
        y_max = max(x_max, y_max)

        num_points =100  # for example
        x_values = np.linspace(x_min, x_max, num_points)
        y_values = np.linspace(y_min, y_max, num_points)
        x_grid, y_grid = np.meshgrid(x_values, y_values)
        z_grid = np.column_stack([x_grid.flat, y_grid.flat])  # Make a 2D array of shape (num_points**2, 2)



        with torch.no_grad():
            z = torch.tensor(z_grid).to(self.data_provider.DEVICE).float()
            samples = vae.decode(z)

        # np.save(os.path.join(self.data_provider.content_path, "Model", "Epoch_{}".format(20),"VAE_GEN.npy"), samples)   
        return samples

    ### ===================================================interpolate_samples ===========================
    def interpolate_samples(self, sample1, sample2, t):
        return t * sample1 + (1 - t) * sample2

    def select_samples_from_different_classes(self, X, labels):
        classes = np.unique(labels)
        selected_samples = []
        for i in range(len(classes)-1):
            for j in range(i+1, len(classes)):
                samples_class_i = X[labels == classes[i]]
                samples_class_j = X[labels == classes[j]]
                sample1 = samples_class_i[np.random.choice(samples_class_i.shape[0])]
                sample2 = samples_class_j[np.random.choice(samples_class_j.shape[0])]
                selected_samples.append((sample1, sample2))
        return selected_samples
    def get_conf(self, epoch, interpolated_X):
        predctions = self.data_provider.get_pred(epoch, interpolated_X)
        scores = np.amax(softmax(predctions, axis=1), axis=1)
        return scores

    def generate_interpolated_samples(self, X, labels, get_conf, num_interpolations_per_bin):
        selected_samples = self.select_samples_from_different_classes(X, labels)

        # confidence_bins = np.linspace(0, 1, 11)[1:-1]  # 置信度区间
        confidence_bins = np.linspace(0.5, 1, 6)[1:-1]  # 置信度区间
    
        interpolated_X = {bin: [] for bin in confidence_bins}  # 储存插值样本的字典，键是置信度区间，值是插值样本

        # 执行循环，直到每个置信度区间都有足够的插值样本
        while min([len(samples) for samples in interpolated_X.values()]) < num_interpolations_per_bin:
            batch_samples = []
            for _ in range(100):
                # 选择两个样本并生成插值样本
                sample1, sample2 = selected_samples[np.random.choice(len(selected_samples))]
                t = np.random.rand()  # 随机选择插值参数t
                interpolated_sample = self.interpolate_samples(sample1, sample2, t)
                batch_samples.append(interpolated_sample)

            # 计算插值样本的置信度并根据置信度将其分配到相应的区间
            confidences = get_conf(self.iteration, np.array(batch_samples))
            for i, confidence in enumerate(confidences):
                for bin in confidence_bins:
                    if confidence < bin:
                        interpolated_X[bin].append(batch_samples[i])
                        # print("interpolated_X",len(interpolated_X[0.6]),len(interpolated_X[0.7]))
                        break

        return interpolated_X
    
    def inter_gen(self,num_pairs=2000):
        train_data = self.data_provider.train_representation
        labels = self.data_provider.train_labels
        num_pairs =  num_pairs
        interpolated_X_div = self.generate_interpolated_samples(train_data,labels,self.get_conf,num_pairs)
        confidence_bins = np.linspace(0.5, 1, 6)[1:-1]  # 置信度区间
        interpolated_X = np.concatenate([np.array(interpolated_X_div[bin]) for bin in confidence_bins])

        np.save(os.path.join(self.data_provider.content_path, "Model", "Epoch_{}".format(self.iteration),"interpolated_X.npy"), interpolated_X)
        return interpolated_X
    

    ###### 
    def gen_more_boundary_mixed_up(self,l_bound=0.6,num_adv_eg=6000,name='border_centers_1.npy'):

        training_data_path = os.path.join(self.data_provider.content_path, "Training_data")
        training_data = torch.load(os.path.join(training_data_path, "training_dataset_data.pth"),
                                        map_location="cpu")
        training_data = training_data.to(self.DEVICE)

        self.model = self.model.to(self.DEVICE)
        confs = batch_run(self.model, training_data)
        preds = np.argmax(confs, axis=1).squeeze()

        repr_model = self.feature_function(self.epoch)
        print("border_points generating...")
        
        border_points, _, _ = get_border_points(model=self.model, input_x=training_data, confs=confs, predictions=preds, device=self.DEVICE, l_bound=l_bound, num_adv_eg=num_adv_eg, lambd=0.05, verbose=0)

        # get gap layer data
        border_points = border_points.to(self.DEVICE)
        border_centers = batch_run(repr_model, border_points)
        model_path = os.path.join(self.data_provider.content_path, "Model")
        location = os.path.join(model_path, "Epoch_{:d}".format(self.epoch), name)
        print("border_points saving...")
        np.save(location, border_centers)

        return border_centers
    
    def get_near_epoch_border(self,n_epoch):

        model_path = os.path.join(self.data_provider.content_path, "Model")
        location = os.path.join(model_path, "Epoch_{:d}".format(n_epoch), "ori_border_centers.npy")
        border_points = np.load(location)
        border_points = torch.Tensor(border_points)
        border_points = border_points.to(self.DEVICE)
        repr_model = self.feature_function(self.epoch)
        border_centers = batch_run(repr_model, border_points)
        
        return border_centers

    







       

