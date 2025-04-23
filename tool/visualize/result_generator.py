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
        for i in range(len(epochs)):
            # get and save projection
            all_data_representation = self.data_provider.get_representation(epochs[i])
            projection = self.projector.batch_project(epochs[i],all_data_representation)
            projection_path = os.path.join(self.config['content_path'], "visualize", self.config["vis_id"], "epochs", f"epoch_{epochs[i]}")
            if not os.path.exists(projection_path):
                os.makedirs(projection_path)
            np.save(os.path.join(projection_path, "projection.npy"), projection)

            if self.config["task_type"] == 'Classification':
                # save background image and visualization image
                self.save_background(epochs[i], self.resolution)

    def save_background(self, epoch, resolution):
        pixel_color = self.get_epoch_decision_view(epoch, resolution)
        
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
        
        return x_min-1, y_min-1, x_max+1, y_max+1
    
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

class DenseALResultGenerator(ResultGenerator):
    def __init__(self, data_provider, projector, resolution, cmap='tab10'):
        super().__init__(data_provider, projector, resolution, cmap)
    
    def get_epoch_plot_measures(self, iteration, epoch):
        """get plot measure for visualization"""
        data = self.data_provider.train_representation(iteration, epoch)
        embedded = self.projector.batch_project(iteration, epoch, data)

        ebd_min = np.min(embedded, axis=0)
        ebd_max = np.max(embedded, axis=0)
        ebd_extent = ebd_max - ebd_min

        x_min, y_min = ebd_min - 0.1 * ebd_extent
        x_max, y_max = ebd_max + 0.1 * ebd_extent

        x_min = min(x_min, y_min)
        y_min = min(x_min, y_min)
        x_max = max(x_max, y_max)
        y_max = max(x_max, y_max)

        return x_min, y_min, x_max, y_max
    
    def get_epoch_decision_view(self, iteration, epoch, resolution):
        '''
        get background classifier view
        :param epoch_id: epoch that need to be visualized
        :param resolution: background resolution
        :return:
            grid_view : numpy.ndarray, self.resolution,self.resolution, 2
            decision_view : numpy.ndarray, self.resolution,self.resolution, 3
        '''
        print('Computing decision regions ...')

        x_min, y_min, x_max, y_max = self.get_epoch_plot_measures(iteration, epoch)

        # create grid
        xs = np.linspace(x_min, x_max, resolution)
        ys = np.linspace(y_min, y_max, resolution)
        grid = np.array(np.meshgrid(xs, ys))
        grid = np.swapaxes(grid.reshape(grid.shape[0], -1), 0, 1)

        # map gridmpoint to images
        grid_samples = self.projector.batch_inverse(iteration, epoch, grid)

        mesh_preds = self.data_provider.get_pred(iteration, epoch, grid_samples)
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
        decision_view = color.reshape(resolution, resolution, 3)
        grid_view = grid.reshape(resolution, resolution, 2)
        return grid_view, decision_view
    
    def savefig(self, iteration, epoch, path="vis"):
        '''
        Shows the current plot.
        '''
        self._init_plot(only_img=True)

        x_min, y_min, x_max, y_max = self.get_epoch_plot_measures(iteration, epoch)

        _, decision_view = self.get_epoch_decision_view(iteration, epoch, self.resolution)
        self.cls_plot.set_data(decision_view)
        self.cls_plot.set_extent((x_min, x_max, y_max, y_min))
        self.ax.set_xlim((x_min, x_max))
        self.ax.set_ylim((y_min, y_max))

        # params_str = 'res: %d'
        # desc = params_str % (self.resolution)
        # self.desc.set_text(desc)

        train_data = self.data_provider.train_representation(iteration, epoch)
        train_labels = self.data_provider.train_labels(epoch)
        pred = self.data_provider.get_pred(iteration, epoch, train_data)
        pred = pred.argmax(axis=1)

        embedding = self.projector.batch_project(iteration, epoch, train_data)

        for c in range(self.class_num):
            data = embedding[np.logical_and(train_labels == c, train_labels == pred)]
            self.sample_plots[c].set_data(data.transpose())

        for c in range(self.class_num):
            data = embedding[np.logical_and(train_labels == c, train_labels != pred)]
            self.sample_plots[self.class_num+c].set_data(data.transpose())
        #
        for c in range(self.class_num):
            data = embedding[np.logical_and(pred == c, train_labels != pred)]
            self.sample_plots[2*self.class_num + c].set_data(data.transpose())

        # self.fig.canvas.draw()
        # self.fig.canvas.flush_events()

        # plt.text(-8, 8, "test", fontsize=18, style='oblique', ha='center', va='top', wrap=True)
        plt.savefig(path)
    
    def savefig_cus(self, iteration, epoch, data, pred, labels, path="vis"):
        '''
        Shows the current plot with given data
        '''
        self._init_plot(only_img=True)

        x_min, y_min, x_max, y_max = self.get_epoch_plot_measures(iteration, epoch)

        _, decision_view = self.get_epoch_decision_view(iteration, epoch, self.resolution)
        self.cls_plot.set_data(decision_view)
        self.cls_plot.set_extent((x_min, x_max, y_max, y_min))
        self.ax.set_xlim((x_min, x_max))
        self.ax.set_ylim((y_min, y_max))

        embedding = self.projector.batch_project(iteration, epoch, data)
        for c in range(self.class_num):
            data = embedding[np.logical_and(labels == c, labels == pred)]
            self.sample_plots[c].set_data(data.transpose())
        for c in range(self.class_num):
            data = embedding[np.logical_and(labels == c, labels != pred)]
            self.sample_plots[self.class_num+c].set_data(data.transpose())
        for c in range(self.class_num):
            data = embedding[np.logical_and(pred == c, labels != pred)]
            self.sample_plots[2*self.class_num + c].set_data(data.transpose())

        plt.savefig(path)
    
    def get_background(self, iteration, epoch, resolution):
        '''
        Initialises matplotlib artists and plots. from DeepView and DVI
        '''
        plt.ion()
        px = 1/plt.rcParams['figure.dpi']  # pixel in inches
        fig, ax = plt.subplots(1, 1, figsize=(200*px, 200*px))
        ax.set_axis_off()
        cls_plot = ax.imshow(np.zeros([5, 5, 3]),
            interpolation='gaussian', zorder=0, vmin=0, vmax=1)
        # self.disable_synth = False

        x_min, y_min, x_max, y_max = self.get_epoch_plot_measures(iteration, epoch)
        _, decision_view = self.get_epoch_decision_view(iteration, epoch, resolution)

        cls_plot.set_data(decision_view)
        cls_plot.set_extent((x_min, x_max, y_max, y_min))
        ax.set_xlim((x_min, x_max))
        ax.set_ylim((y_min, y_max))

        # save first and them load
        fname = "Epoch" if self.data_provider.mode == "normal" else "Iteration"
        save_path = os.path.join(self.data_provider.model_path, "{}_{}".format(fname, epoch), "bgimg.png")
        plt.savefig(save_path, format='png',bbox_inches='tight',pad_inches=0.0)
        with open(save_path, 'rb') as img_f:
            img_stream = img_f.read()
            save_file_base64 = base64.b64encode(img_stream)
    
        return x_min, y_min, x_max, y_max, save_file_base64
    