from abc import ABC, abstractmethod

import os
from PIL import Image

import matplotlib.pyplot as plt
import matplotlib as mpl
import numpy as np
import base64
from utils import convert_to_base64

# ---------------------
# ResultGenerator:
# use projector to get and save background image
# ---------------------
class ResultGeneratorAbstractClass(ABC):
    @abstractmethod
    def __init__(self, data_provider, projector, * args, **kawargs):
        pass

    @abstractmethod
    def get_epoch_plot_measures(self, *args, **kwargs):
        pass

    @abstractmethod
    def get_epoch_decision_view(self, *args, **kwargs):
        pass

    @abstractmethod
    def save_background(self, *args, **kwargs):
        pass

class ResultGenerator(ResultGeneratorAbstractClass):
    def __init__(self, config, data_provider, projector, cmap='tab10'):
        self.config = config
        self.data_provider = data_provider
        self.projector = projector
        self.cmap = plt.get_cmap(cmap)
        self.classes = config["classes"]
        self.class_num = len(self.classes)
        self.resolution = config['vis_config']['resolution']

    def visualize_all_epochs(self):
        epochs = self.config['available_epochs']
        
        # initialize xy limit
        x_min, y_min, x_max, y_max = np.inf, np.inf, -np.inf, -np.inf
        
        partial_epoch_num = len(epochs)//3
        
        for i in range(len(epochs)):
            # get and save projection
            all_data_representation = self.data_provider.get_representation(epochs[i])
            projection = self.projector.batch_project(epochs[i],all_data_representation)
            projection_path = os.path.join(self.config['content_path'], "visualize", self.config["vis_id"], "epochs", f"epoch_{epochs[i]}")
            if not os.path.exists(projection_path):
                os.makedirs(projection_path)
            np.save(os.path.join(projection_path, "projection.npy"), projection)
            
            # update xy limit
            if i >= partial_epoch_num:
                ebd_min = np.min(projection, axis=0)
                ebd_max = np.max(projection, axis=0)
                x_min = min(x_min, ebd_min[0])
                y_min = min(y_min, ebd_min[1])
                x_max = max(x_max, ebd_max[0])
                y_max = max(y_max, ebd_max[1])

        xy_limit = [x_min, y_min, x_max, y_max]
        
        if self.config["task_type"] == 'Classification':
            # save background image for each epoch using the same xy limit
            for i in range(len(epochs)):
                self.save_background(epochs[i], self.resolution, xy_limit)
        
        return xy_limit

    def save_background(self, epoch, resolution, xy_limit=None):
        pixel_color = self.get_epoch_decision_view(epoch, resolution, xy_limit)
        
        pixel_color = pixel_color.reshape((resolution[1], resolution[0], 3))

        image = Image.fromarray(pixel_color.astype('uint8'), 'RGB')
        
        file_path = os.path.join(self.config['content_path'], 'visualize',self.config['vis_id'],'epochs', f'epoch_{epoch}','background.png')
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        image.save(file_path, 'PNG')
        
        return convert_to_base64(file_path)
    
    def get_epoch_plot_measures(self, epoch):
        """get plot measure for visualization"""
        projection_path = os.path.join(self.config['content_path'], "visualize", self.config["vis_id"], "epochs", f"epoch_{epoch}", "projection.npy")
        projection = np.load(projection_path, allow_pickle=True)

        x_min = float(np.min(projection[:, 0]))
        y_min = float(np.min(projection[:, 1]))
        x_max = float(np.max(projection[:, 0]))
        y_max = float(np.max(projection[:, 1]))
        
        return x_min, y_min, x_max, y_max
    
    def get_epoch_decision_view(self, epoch, resolution, xy_limit=None, pixel_size=1):
        '''
        get background classifier view
        :param epoch_id: epoch that need to be visualized
        :param resolution: background resolution, resolution[0]: width, resolution[1]: height
        :return:
            grid_view : numpy.ndarray, self.resolution,self.resolution, 2
            decision_view : numpy.ndarray, self.resolution,self.resolution, 3
        '''
        if xy_limit is None:
            x_min, y_min, x_max, y_max = self.get_epoch_plot_measures(epoch)
        else:
            x_min, y_min, x_max, y_max = xy_limit

        # create grid
        width = resolution[0]
        height = resolution[1]
        pixels = []
        x_scale = (x_max - x_min) / (width / pixel_size)
        y_scale = (y_max - y_min) / (height / pixel_size)

        for j in range(int(height / pixel_size)):
            for i in range(int(width / pixel_size)):
                x = x_min + (i + pixel_size / 2) * x_scale
                y = y_min + (j + pixel_size / 2) * y_scale
                pixels.append([x, y])

        # map gridmpoint to images
        pixels = np.array(pixels)
        grid_samples = self.projector.batch_inverse(epoch, pixels)

        mesh_preds = self.data_provider.get_pred(epoch, grid_samples)
        mesh_preds = mesh_preds + 1e-8

        sort_preds = np.sort(mesh_preds, axis=1)
        diff = (sort_preds[:, -1] - sort_preds[:, -2]) / (sort_preds[:, -1] - sort_preds[:, 0])
        border = np.zeros(len(diff), dtype=np.uint8) + 0.05
        border[diff < 0.15] = 1
        diff[border == 1] = 0.

        diff = diff/(diff.max()+1e-8)
        diff = diff*0.9

        mesh_classes = mesh_preds.argmax(axis=1)
        mesh_max_class = max(mesh_classes)
        color = self.cmap(mesh_classes / mesh_max_class)

        diff = diff.reshape(-1, 1)

        color = color[:, 0:3]
        color = diff * 0.5 * color + (1 - diff) * np.ones(color.shape, dtype=np.uint8)
        color_rgb = (color * 255).astype(np.uint8)
        return color_rgb

class UmapResultGenerator():
    def __init__(self, config, data_provider, projector):
        self.config = config
        self.data_provider = data_provider
        self.projector = projector
        
    def visualize_all_epochs(self):
        epochs = self.config['available_epochs']
        # initialize xy limit
        x_min, y_min, x_max, y_max = np.inf, np.inf, -np.inf, -np.inf
        partial_epoch_num = len(epochs)//3
        
        for i in range(len(epochs)):
            # get and save projection
            all_data_representation = self.data_provider.get_representation(epochs[i])
            projection = self.projector.batch_project(all_data_representation)
            projection_path = os.path.join(self.config['content_path'], "visualize", self.config["vis_id"], "epochs", f"epoch_{epochs[i]}")
            if not os.path.exists(projection_path):
                os.makedirs(projection_path)
            np.save(os.path.join(projection_path, "projection.npy"), projection)
            # update xy limit
            if i >= partial_epoch_num:
                ebd_min = np.min(projection, axis=0)
                ebd_max = np.max(projection, axis=0)
                x_min = min(x_min, ebd_min[0])
                y_min = min(y_min, ebd_min[1])
                x_max = max(x_max, ebd_max[0])
                y_max = max(y_max, ebd_max[1])
        
        xy_limit = [x_min, y_min, x_max, y_max]
        return xy_limit
        