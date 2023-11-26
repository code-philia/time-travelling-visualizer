# TODO fix loading net, sys.append problem
from abc import ABC, abstractmethod

import torch
import tensorflow as tf
import sys
import os
import time
import numpy as np

from torch.utils.data import DataLoader
from torch.utils.data import WeightedRandomSampler
from umap.umap_ import find_ab_params

from singleVis.custom_weighted_random_sampler import CustomWeightedRandomSampler
from singleVis.SingleVisualizationModel import VisModel, tfModel
from singleVis.losses import HybridLoss, SmoothnessLoss, UmapLoss, ReconstructionLoss, TemporalLoss, DVILoss, SingleVisLoss, umap_loss, reconstruction_loss, regularize_loss
from singleVis.edge_dataset import HybridDataHandler, DVIDataHandler, DataHandler, construct_edge_dataset
from singleVis.trainer import HybridVisTrainer, DVITrainer, SingleVisTrainer
from singleVis.data import DataProviderAbstractClass, NormalDataProvider, ActiveLearningDataProvider, DenseActiveLearningDataProvider
from singleVis.spatial_edge_constructor import kcHybridSpatialEdgeConstructor, SingleEpochSpatialEdgeConstructor, kcSpatialEdgeConstructor, tfEdgeConstructor
from singleVis.temporal_edge_constructor import GlobalTemporalEdgeConstructor
from singleVis.projector import DeepDebuggerProjector, DVIProjector, ProjectorAbstractClass, TimeVisProjector, ALProjector, tfDVIProjector, tfDVIDenseALProjector, TimeVisDenseALProjector
from singleVis.segmenter import Segmenter
from singleVis.eval.evaluator import Evaluator, ALEvaluator, EvaluatorAbstractClass, DenseALEvaluator
from singleVis.visualizer import VisualizerAbstractClass, visualizer, DenseALvisualizer
from singleVis.utils import find_neighbor_preserving_rate

class StrategyAbstractClass(ABC):
    def __init__(self, CONTENT_PATH, config):
        self._config = config
        self.CONTENT_PATH = CONTENT_PATH
    
    @property
    def config(self)->dict:
        return self._config
    
    @property
    def projector(self)->ProjectorAbstractClass:
        return self._projector
    
    @projector.setter
    def projector(self, projector:ProjectorAbstractClass)->None:
        self._projector = projector
    
    @property
    def data_provider(self)->DataProviderAbstractClass:
        return self._data_provider
    
    @data_provider.setter
    def data_provider(self, data_provider:DataProviderAbstractClass)->None:
        self._data_provider = data_provider

    @property
    def evaluator(self)->EvaluatorAbstractClass:
        return self._evaluator
    
    @evaluator.setter
    def evaluator(self, evaluator:EvaluatorAbstractClass)->None:
        self._evaluator = evaluator
    
    @property
    def vis(self)->VisualizerAbstractClass:
        return self._vis
    
    @vis.setter
    def vis(self, visualizer:VisualizerAbstractClass)->None:
        self._vis = visualizer
    
    @abstractmethod
    def _init(self):
        pass

    @abstractmethod
    def _preprocess(self):
        pass

    @abstractmethod
    def _train(self):
        pass

    @abstractmethod
    def _evaluate(self):
        pass

    @abstractmethod
    def _visualize(self):
        pass

    def visualize_embedding(self):
        self._init()
        self._preprocess()
        self._train()
        self._evaluate()
        self._visualize()

class DeepVisualInsight(StrategyAbstractClass):
    def __init__(self, CONTENT_PATH, config):
        super().__init__(CONTENT_PATH, config)
        self._init()
        self.VIS_METHOD = "DVI"
    
    def _init(self):
        sys.path.append(self.CONTENT_PATH)
        # # record output information
        # now = time.strftime("%Y-%m-%d-%H_%M_%S", time.localtime(time.time())) 
        # sys.stdout = open(os.path.join(self.CONTENT_PATH, now+".txt"), "w")

        CLASSES = self.config["CLASSES"]
        GPU_ID = self.config["GPU"]
        EPOCH_START = self.config["EPOCH_START"]
        EPOCH_END = self.config["EPOCH_END"]
        EPOCH_PERIOD = self.config["EPOCH_PERIOD"]
        EPOCH_NAME = self.config["EPOCH_NAME"]

        # Training parameter (subject model)
        TRAINING_PARAMETER = self.config["TRAINING"]
        NET = TRAINING_PARAMETER["NET"]

        # Training parameter (visualization model)
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        
        ENCODER_DIMS = VISUALIZATION_PARAMETER["ENCODER_DIMS"]
        DECODER_DIMS = VISUALIZATION_PARAMETER["DECODER_DIMS"]

        VIS_MODEL_NAME = VISUALIZATION_PARAMETER["VIS_MODEL_NAME"]

        # define hyperparameters
        self.DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

        import Model.model as subject_model
        net = eval("subject_model.{}()".format(NET))

        self._data_provider = NormalDataProvider(self.CONTENT_PATH, net, EPOCH_START, EPOCH_END, EPOCH_PERIOD, device=self.DEVICE, classes=CLASSES, epoch_name=EPOCH_NAME, verbose=1)
        self.model = VisModel(ENCODER_DIMS, DECODER_DIMS)
        negative_sample_rate = 5
        min_dist = .1
        _a, _b = find_ab_params(1.0, min_dist)
        umap_loss_fn = UmapLoss(negative_sample_rate, self.DEVICE, _a, _b, repulsion_strength=1.0)
        recon_loss_fn = ReconstructionLoss(beta=1.0)
        temporal_loss_fn = TemporalLoss()
        self.umap_fn = umap_loss_fn
        self.recon_fn = recon_loss_fn
        self.temporal_fn = temporal_loss_fn
        self.projector(DVIProjector(vis_model=self.model, content_path=self.CONTENT_PATH, vis_model_name=VIS_MODEL_NAME, device=self.DEVICE))
        self.vis(visualizer(self.data_provider, self.projector, 200, "tab10"))
        self.evaluator(Evaluator(self.data_provider, self.projector))

    def _preprocess(self):
        PREPROCESS = self.config["VISUALIZATION"]["PREPROCESS"]
        # Training parameter (subject model)
        TRAINING_PARAMETER = self.config["TRAINING"]
        LEN = TRAINING_PARAMETER["train_num"]
        # Training parameter (visualization model)
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        B_N_EPOCHS = VISUALIZATION_PARAMETER["BOUNDARY"]["B_N_EPOCHS"]
        L_BOUND = VISUALIZATION_PARAMETER["BOUNDARY"]["L_BOUND"]
        if PREPROCESS:
            self.data_provider._meta_data()
            if B_N_EPOCHS >0:
                self.data_provider._estimate_boundary(LEN//10, l_bound=L_BOUND)
    
    def _train(self):
        EPOCH_START = self.config["EPOCH_START"]
        EPOCH_END = self.config["EPOCH_END"]
        EPOCH_PERIOD = self.config["EPOCH_PERIOD"]
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        LAMBDA1 = VISUALIZATION_PARAMETER["LAMBDA1"]
        LAMBDA2 = VISUALIZATION_PARAMETER["LAMBDA2"]
        ENCODER_DIMS = VISUALIZATION_PARAMETER["ENCODER_DIMS"]
        DECODER_DIMS = VISUALIZATION_PARAMETER["DECODER_DIMS"]
        B_N_EPOCHS = VISUALIZATION_PARAMETER["BOUNDARY"]["B_N_EPOCHS"]
        S_N_EPOCHS = VISUALIZATION_PARAMETER["S_N_EPOCHS"]
        N_NEIGHBORS = VISUALIZATION_PARAMETER["N_NEIGHBORS"]
        PATIENT = VISUALIZATION_PARAMETER["PATIENT"]
        MAX_EPOCH = VISUALIZATION_PARAMETER["MAX_EPOCH"]
        VIS_MODEL_NAME = VISUALIZATION_PARAMETER["VIS_MODEL_NAME"]
        
        start_flag = 1
        prev_model = VisModel(ENCODER_DIMS, DECODER_DIMS)
        prev_model.load_state_dict(self.model.state_dict())
        for param in prev_model.parameters():
            param.requires_grad = False
        w_prev = dict(self.model.named_parameters())

        for iteration in range(EPOCH_START, EPOCH_END+EPOCH_PERIOD, EPOCH_PERIOD):
            # Define DVI Loss
            if start_flag:
                criterion = DVILoss(self.umap_fn, self.recon_fn, self.temporal_fn, lambd1=LAMBDA1, lambd2=0.0)
                start_flag = 0
            else:
                # TODO AL mode, redefine train_representation
                prev_data = self.data_provider.train_representation(iteration-EPOCH_PERIOD)
                curr_data = self.data_provider.train_representation(iteration)
                npr = find_neighbor_preserving_rate(prev_data, curr_data, N_NEIGHBORS)
                criterion = DVILoss(self.umap_fn, self.recon_fn, self.temporal_fn, lambd1=LAMBDA1, lambd2=LAMBDA2*npr)
            # Define training parameters
            optimizer = torch.optim.Adam(self.model.parameters(), lr=.01, weight_decay=1e-5)
            lr_scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=.1)
            # Define Edge dataset
            t0 = time.time()
            spatial_cons = SingleEpochSpatialEdgeConstructor(self.data_provider, iteration, S_N_EPOCHS, B_N_EPOCHS, N_NEIGHBORS)
            edge_to, edge_from, probs, feature_vectors, attention = spatial_cons.construct()
            t1 = time.time()

            probs = probs / (probs.max()+1e-3)
            eliminate_zeros = probs>1e-3
            edge_to = edge_to[eliminate_zeros]
            edge_from = edge_from[eliminate_zeros]
            probs = probs[eliminate_zeros]
            
            dataset = DVIDataHandler(edge_to, edge_from, feature_vectors, attention, w_prev)

            n_samples = int(np.sum(S_N_EPOCHS * probs) // 1)
            # chose sampler based on the number of dataset
            if len(edge_to) > 2^24:
                sampler = CustomWeightedRandomSampler(probs, n_samples, replacement=True)
            else:
                sampler = WeightedRandomSampler(probs, n_samples, replacement=True)
            edge_loader = DataLoader(dataset, batch_size=1000, sampler=sampler)

            ########################################################################################################################
            #                                                       TRAIN                                                          #
            ########################################################################################################################

            trainer = DVITrainer(self.model, criterion, optimizer, lr_scheduler,edge_loader=edge_loader, DEVICE=self.DEVICE)

            t2=time.time()
            trainer.train(PATIENT, MAX_EPOCH)
            t3 = time.time()

            # save result
            save_dir = self.data_provider.model_path
            trainer.record_time(save_dir, "time_{}.json".format(VIS_MODEL_NAME), "complex_construction", str(iteration), t1-t0)
            trainer.record_time(save_dir, "time_{}.json".format(VIS_MODEL_NAME), "training", str(iteration), t3-t2)
            save_dir = os.path.join(self.data_provider.model_path, "Epoch_{}".format(iteration))
            trainer.save(save_dir=save_dir, file_name="{}".format(VIS_MODEL_NAME))

            prev_model.load_state_dict(self.model.state_dict())
            for param in prev_model.parameters():
                param.requires_grad = False
            w_prev = dict(prev_model.named_parameters())
    
    def _visualize(self):
        EPOCH_START = self.config["EPOCH_START"]
        EPOCH_END = self.config["EPOCH_END"]
        EPOCH_PERIOD = self.config["EPOCH_PERIOD"]

        save_dir = os.path.join(self.data_provider.content_path, "img")
        if not os.path.exists(save_dir):
            os.mkdir(save_dir)
        for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
            self.vis.savefig(i, path=os.path.join(save_dir, "{}_{}.png".format(self.VIS_METHOD, i)))

    def _evaluate(self):
        EPOCH_START = self.config["EPOCH_START"]
        EPOCH_END = self.config["EPOCH_END"]
        EPOCH_PERIOD = self.config["EPOCH_PERIOD"]
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        EVALUATION_NAME = VISUALIZATION_PARAMETER["EVALUATION_NAME"]
        N_NEIGHBORS = VISUALIZATION_PARAMETER["N_NEIGHBORS"]
        eval_epochs = list(range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD))
        for eval_epoch in eval_epochs:
            self.evaluator.save_epoch_eval(eval_epoch, N_NEIGHBORS, temporal_k=5, file_name="{}".format(EVALUATION_NAME))


    def visualize_embedding(self):
        self._preprocess()
        self._train()
        self._visualize()
        self._evaluate()


class tfDeepVisualInsight(StrategyAbstractClass):
    def __init__(self, CONTENT_PATH, config):
        super().__init__(CONTENT_PATH, config)
        self._init()
        self.VIS_METHOD = "tfDVI"
    
    def _init(self):
        sys.path.append(self.CONTENT_PATH)

        CLASSES = self.config["CLASSES"]
        GPU_ID = self.config["GPU"]
        EPOCH_START = self.config["EPOCH_START"]
        EPOCH_END = self.config["EPOCH_END"]
        EPOCH_PERIOD = self.config["EPOCH_PERIOD"]
        EPOCH_NAME = self.config["EPOCH_NAME"]

        # Training parameter (subject model)
        TRAINING_PARAMETER = self.config["TRAINING"]
        NET = TRAINING_PARAMETER["NET"]

        # Training parameter (visualization model)
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        B_N_EPOCHS = VISUALIZATION_PARAMETER["BOUNDARY"]["B_N_EPOCHS"]

        # define hyperparameters
        self.DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

        import Model.model as subject_model
        net = eval("subject_model.{}()".format(NET))

        self.data_provider = NormalDataProvider(self.CONTENT_PATH, net, EPOCH_START, EPOCH_END, EPOCH_PERIOD, device=self.DEVICE, classes=CLASSES, epoch_name=EPOCH_NAME, verbose=1)
        
        # Define Projector
        self.flag = "_temporal_id{}".format("_withoutB" if B_N_EPOCHS==0 else "")
        self.projector = tfDVIProjector(self.CONTENT_PATH, flag=self.flag)
        self.vis = visualizer(self.data_provider, self.projector, 200, "tab10")
        self.evaluator = Evaluator(self.data_provider, self.projector)

    def _preprocess(self):
        PREPROCESS = self.config["VISUALIZATION"]["PREPROCESS"]
        # Training parameter (subject model)
        TRAINING_PARAMETER = self.config["TRAINING"]
        LEN = TRAINING_PARAMETER["train_num"]
        # Training parameter (visualization model)
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        B_N_EPOCHS = VISUALIZATION_PARAMETER["BOUNDARY"]["B_N_EPOCHS"]
        L_BOUND = VISUALIZATION_PARAMETER["BOUNDARY"]["L_BOUND"]
        if PREPROCESS:
            self.data_provider._meta_data()
            if B_N_EPOCHS >0:
                self.data_provider._estimate_boundary(LEN//10, l_bound=L_BOUND)
    
    def _train(self):
        EPOCH_START = self.config["EPOCH_START"]
        EPOCH_END = self.config["EPOCH_END"]
        EPOCH_PERIOD = self.config["EPOCH_PERIOD"]
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        LAMBDA1 = VISUALIZATION_PARAMETER["LAMBDA1"]
        LAMBDA2 = VISUALIZATION_PARAMETER["LAMBDA2"]
        ENCODER_DIMS = VISUALIZATION_PARAMETER["ENCODER_DIMS"]
        DECODER_DIMS = VISUALIZATION_PARAMETER["DECODER_DIMS"]
        B_N_EPOCHS = VISUALIZATION_PARAMETER["BOUNDARY"]["B_N_EPOCHS"]
        S_N_EPOCHS = VISUALIZATION_PARAMETER["S_N_EPOCHS"]
        N_NEIGHBORS = VISUALIZATION_PARAMETER["N_NEIGHBORS"]
        PATIENT = VISUALIZATION_PARAMETER["PATIENT"]
        MAX_EPOCH = VISUALIZATION_PARAMETER["MAX_EPOCH"]
        BATCH_SIZE = VISUALIZATION_PARAMETER["BATCH_SIZE"]
        VIS_MODEL_NAME = VISUALIZATION_PARAMETER["VIS_MODEL_NAME"]
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
        self.model = tfModel(optimizer=optimizer, encoder_dims=ENCODER_DIMS, decoder_dims=DECODER_DIMS, loss=losses, loss_weights=loss_weights, batch_size=BATCH_SIZE, prev_trainable_variables=None)
        callbacks = [
            tf.keras.callbacks.EarlyStopping(
                monitor='loss',
                min_delta=10 ** -2,
                patience=8,
                verbose=1,
            ),
            tf.keras.callbacks.LearningRateScheduler(lambda epoch: 1e-3 if epoch < 8 else 1e-4),
            tf.keras.callbacks.LambdaCallback(on_train_end=lambda logs: weights_dict.update(
                {'prev': [tf.identity(tf.stop_gradient(x)) for x in self.model.trainable_weights]})),
        ]
        # edge constructor
        spatial_cons = tfEdgeConstructor(self.data_provider, S_N_EPOCHS, B_N_EPOCHS, N_NEIGHBORS)

        
        for iteration in range(EPOCH_START, EPOCH_END+EPOCH_PERIOD, EPOCH_PERIOD):
            self.model.compile(
                optimizer=optimizer, loss=losses, loss_weights=loss_weights,
            )
            t0 = time.time()
            edge_to, edge_from, probs, feature_vectors, attention, n_rate = spatial_cons.construct(iteration-EPOCH_PERIOD, iteration)
            t1 = time.time()
            edge_dataset = construct_edge_dataset(edge_to, edge_from, probs, feature_vectors, attention, n_rate, BATCH_SIZE)
            steps_per_epoch = int(
                len(edge_to) / BATCH_SIZE / 10
            )
            t2 = time.time()
            # create embedding
            self.model.fit(
                edge_dataset,
                epochs=200, # a large value, because we have early stop callback
                steps_per_epoch=steps_per_epoch,
                callbacks=callbacks,
                max_queue_size=100,
            )
            t3 = time.time()
            # save for later use
            self.model.prev_trainable_variables = weights_dict["prev"]
            # save
            self.model.encoder.save(os.path.join(CONTENT_PATH, "Model", "Epoch_{:d}".format(iteration), "encoder" + self.flag))
            self.model.decoder.save(os.path.join(CONTENT_PATH, "Model", "Epoch_{:d}".format(iteration), "decoder" + self.flag))
            print("save visualized model for Epoch {:d}".format(iteration))

            # save time result
            # TODO
            # save_dir = self.data_provider.model_path
            # trainer.record_time(save_dir, "time_{}.json".format(VIS_MODEL_NAME), "complex_construction", str(iteration), t1-t0)
            # trainer.record_time(save_dir, "time_{}.json".format(VIS_MODEL_NAME), "training", str(iteration), t3-t2)
    
    def _visualize(self):
        EPOCH_START = self.config["EPOCH_START"]
        EPOCH_END = self.config["EPOCH_END"]
        EPOCH_PERIOD = self.config["EPOCH_PERIOD"]

        save_dir = os.path.join(self.data_provider.content_path, "img")
        if not os.path.exists(save_dir):
            os.mkdir(save_dir)
        for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
            self.vis.savefig(i, path=os.path.join(save_dir, "{}_{}.png".format(self.VIS_METHOD, i)))

    def _evaluate(self):
        EPOCH_START = self.config["EPOCH_START"]
        EPOCH_END = self.config["EPOCH_END"]
        EPOCH_PERIOD = self.config["EPOCH_PERIOD"]
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        EVALUATION_NAME = VISUALIZATION_PARAMETER["EVALUATION_NAME"]
        N_NEIGHBORS = VISUALIZATION_PARAMETER["N_NEIGHBORS"]
        eval_epochs = list(range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD))
        for eval_epoch in eval_epochs:
            self.evaluator.save_epoch_eval(eval_epoch, N_NEIGHBORS, temporal_k=5, file_name="{}".format(EVALUATION_NAME))

    def visualize_embedding(self):
        self._preprocess()
        self._train()
        self._visualize()
        self._evaluate()

class TimeVis(StrategyAbstractClass):
    def __init__(self, CONTENT_PATH, config):
        super().__init__(CONTENT_PATH, config)
        self._init()
        self.VIS_METHOD = "TimeVis"
    
    def _init(self):
        sys.path.append(self.CONTENT_PATH)
        # record output information
        now = time.strftime("%Y-%m-%d-%H_%M_%S", time.localtime(time.time())) 
        sys.stdout = open(os.path.join(self.CONTENT_PATH, now+".txt"), "w")

        CLASSES = self.config["CLASSES"]
        GPU_ID = self.config["GPU"]
        EPOCH_START = self.config["EPOCH_START"]
        EPOCH_END = self.config["EPOCH_END"]
        EPOCH_PERIOD = self.config["EPOCH_PERIOD"]
        EPOCH_NAME = self.config["EPOCH_NAME"]

        # Training parameter (subject model)
        TRAINING_PARAMETER = self.config["TRAINING"]
        NET = TRAINING_PARAMETER["NET"]

        # Training parameter (visualization model)
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        LAMBDA = VISUALIZATION_PARAMETER["LAMBDA"]
        ENCODER_DIMS = VISUALIZATION_PARAMETER["ENCODER_DIMS"]
        DECODER_DIMS = VISUALIZATION_PARAMETER["DECODER_DIMS"]

        VIS_MODEL_NAME = VISUALIZATION_PARAMETER["VIS_MODEL_NAME"]

        # define hyperparameters
        self.DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

        import Model.model as subject_model
        net = eval("subject_model.{}()".format(NET))

        self.data_provider = NormalDataProvider(self.CONTENT_PATH, net, EPOCH_START, EPOCH_END, EPOCH_PERIOD, device=self.DEVICE, classes=CLASSES, epoch_name=EPOCH_NAME, verbose=1)
        self.model = VisModel(ENCODER_DIMS, DECODER_DIMS)
        negative_sample_rate = 5
        min_dist = .1
        _a, _b = find_ab_params(1.0, min_dist)
        umap_loss_fn = UmapLoss(negative_sample_rate, self.DEVICE, _a, _b, repulsion_strength=1.0)
        recon_loss_fn = ReconstructionLoss(beta=1.0)
        self.criterion = SingleVisLoss(umap_loss_fn, recon_loss_fn, lambd=LAMBDA)
        self.projector = TimeVisProjector(vis_model=self.model, content_path=self.CONTENT_PATH, vis_model_name=VIS_MODEL_NAME, device=self.DEVICE)
        self.vis = visualizer(self.data_provider, self.projector, 200, "tab10")
        self.evaluator = Evaluator(self.data_provider, self.projector)

    def _preprocess(self):
        PREPROCESS = self.config["VISUALIZATION"]["PREPROCESS"]
        # Training parameter (subject model)
        TRAINING_PARAMETER = self.config["TRAINING"]
        LEN = TRAINING_PARAMETER["train_num"]
        # Training parameter (visualization model)
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        B_N_EPOCHS = VISUALIZATION_PARAMETER["BOUNDARY"]["B_N_EPOCHS"]
        L_BOUND = VISUALIZATION_PARAMETER["BOUNDARY"]["L_BOUND"]
        if PREPROCESS:
            self.data_provider._meta_data()
            if B_N_EPOCHS >0:
                self.data_provider._estimate_boundary(LEN//10, l_bound=L_BOUND)
    
    def _train(self):
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        B_N_EPOCHS = VISUALIZATION_PARAMETER["BOUNDARY"]["B_N_EPOCHS"]
        S_N_EPOCHS = VISUALIZATION_PARAMETER["S_N_EPOCHS"]
        T_N_EPOCHS = VISUALIZATION_PARAMETER["T_N_EPOCHS"]
        N_NEIGHBORS = VISUALIZATION_PARAMETER["N_NEIGHBORS"]
        PATIENT = VISUALIZATION_PARAMETER["PATIENT"]
        MAX_EPOCH = VISUALIZATION_PARAMETER["MAX_EPOCH"]
        INIT_NUM = VISUALIZATION_PARAMETER["INIT_NUM"]
        ALPHA = VISUALIZATION_PARAMETER["ALPHA"]
        BETA = VISUALIZATION_PARAMETER["BETA"]
        MAX_HAUSDORFF = VISUALIZATION_PARAMETER["MAX_HAUSDORFF"]
        VIS_MODEL_NAME = VISUALIZATION_PARAMETER["VIS_MODEL_NAME"]
        
        optimizer = torch.optim.Adam(self.model.parameters(), lr=.01, weight_decay=1e-5)
        lr_scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=.1)

        t0 = time.time()
        spatial_cons = kcSpatialEdgeConstructor(data_provider=self.data_provider, init_num=INIT_NUM, s_n_epochs=S_N_EPOCHS, b_n_epochs=B_N_EPOCHS, n_neighbors=N_NEIGHBORS, MAX_HAUSDORFF=MAX_HAUSDORFF, ALPHA=ALPHA, BETA=BETA)
        s_edge_to, s_edge_from, s_probs, feature_vectors, time_step_nums, time_step_idxs_list, knn_indices, sigmas, rhos, attention = spatial_cons.construct()
        temporal_cons = GlobalTemporalEdgeConstructor(X=feature_vectors, time_step_nums=time_step_nums, sigmas=sigmas, rhos=rhos, n_neighbors=N_NEIGHBORS, n_epochs=T_N_EPOCHS)
        t_edge_to, t_edge_from, t_probs = temporal_cons.construct()
        t1 = time.time()

        edge_to = np.concatenate((s_edge_to, t_edge_to),axis=0)
        edge_from = np.concatenate((s_edge_from, t_edge_from), axis=0)
        probs = np.concatenate((s_probs, t_probs), axis=0)
        probs = probs / (probs.max()+1e-3)
        eliminate_zeros = probs>1e-3
        edge_to = edge_to[eliminate_zeros]
        edge_from = edge_from[eliminate_zeros]
        probs = probs[eliminate_zeros]

        dataset = DataHandler(edge_to, edge_from, feature_vectors, attention)
        n_samples = int(np.sum(S_N_EPOCHS * probs) // 1)
        # chose sampler based on the number of dataset
        if len(edge_to) > 2^24:
            sampler = CustomWeightedRandomSampler(probs, n_samples, replacement=True)
        else:
            sampler = WeightedRandomSampler(probs, n_samples, replacement=True)
        edge_loader = DataLoader(dataset, batch_size=1000, sampler=sampler)

        ########################################################################################################################
        #                                                       TRAIN                                                          #
        ########################################################################################################################
        trainer = SingleVisTrainer(self.model, self.criterion, optimizer, lr_scheduler, edge_loader=edge_loader, DEVICE=self.DEVICE)

        t2=time.time()
        trainer.train(PATIENT, MAX_EPOCH)
        t3 = time.time()

        save_dir = self.data_provider.model_path
        trainer.record_time(save_dir, "time_{}.json".format(VIS_MODEL_NAME), "complex_construction", t1-t0)
        trainer.record_time(save_dir, "time_{}.json".format(VIS_MODEL_NAME), "training", t3-t2)
        trainer.save(save_dir=save_dir, file_name="{}".format(VIS_MODEL_NAME))
    
    def _visualize(self):
        EPOCH_START = self.config["EPOCH_START"]
        EPOCH_END = self.config["EPOCH_END"]
        EPOCH_PERIOD = self.config["EPOCH_PERIOD"]

        self._vis = visualizer(self.data_provider, self.projector, 200, "plasma")
        save_dir = os.path.join(self.data_provider.content_path, "img")
        if not os.path.exists(save_dir):
            os.mkdir(save_dir)
        for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
            self.vis.savefig(i, path=os.path.join(save_dir, "{}_{}.png".format(self.VIS_METHOD, i)))

    def _evaluate(self):
        EPOCH_START = self.config["EPOCH_START"]
        EPOCH_END = self.config["EPOCH_END"]
        EPOCH_PERIOD = self.config["EPOCH_PERIOD"]
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        EVALUATION_NAME = VISUALIZATION_PARAMETER["EVALUATION_NAME"]
        N_NEIGHBORS = VISUALIZATION_PARAMETER["N_NEIGHBORS"]
        eval_epochs = list(range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD))
        self.evaluator = Evaluator(self.data_provider, self.projector)
        for eval_epoch in eval_epochs:
            self.evaluator.save_epoch_eval(eval_epoch, N_NEIGHBORS, temporal_k=5, file_name="{}".format(EVALUATION_NAME))


    def visualize_embedding(self):
        self._preprocess()
        self._train()
        self._visualize()
        self._evaluate()


class DeepDebugger(StrategyAbstractClass):
    def __init__(self, CONTENT_PATH, config):
        super().__init__(CONTENT_PATH, config)
        self._init()
        self.VIS_METHOD = "DeepDebugger"
    
    def _init(self):
        sys.path.append(self.CONTENT_PATH)
        # record output information
        now = time.strftime("%Y-%m-%d-%H_%M_%S", time.localtime(time.time())) 
        sys.stdout = open(os.path.join(self.CONTENT_PATH, now+".txt"), "w")

        CLASSES = self.config["CLASSES"]
        GPU_ID = self.config["GPU"]
        EPOCH_START = self.config["EPOCH_START"]
        EPOCH_END = self.config["EPOCH_END"]
        EPOCH_PERIOD = self.config["EPOCH_PERIOD"]
        EPOCH_NAME = self.config["EPOCH_NAME"]

        # Training parameter (subject model)
        TRAINING_PARAMETER = self.config["TRAINING"]
        NET = TRAINING_PARAMETER["NET"]

        # Training parameter (visualization model)
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        LAMBDA = VISUALIZATION_PARAMETER["LAMBDA"]
        S_LAMBDA = VISUALIZATION_PARAMETER["S_LAMBDA"]
        ENCODER_DIMS = VISUALIZATION_PARAMETER["ENCODER_DIMS"]
        DECODER_DIMS = VISUALIZATION_PARAMETER["DECODER_DIMS"]
        VIS_MODEL_NAME = VISUALIZATION_PARAMETER["VIS_MODEL_NAME"]

        # define hyperparameters
        self.DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

        import Model.model as subject_model
        net = eval("subject_model.{}()".format(NET))

        self.data_provider = NormalDataProvider(self.CONTENT_PATH, net, EPOCH_START, EPOCH_END, EPOCH_PERIOD, device=self.DEVICE, classes=CLASSES, epoch_name=EPOCH_NAME, verbose=1)        
        self.model = VisModel(ENCODER_DIMS, DECODER_DIMS)
        negative_sample_rate = 5
        min_dist = .1
        _a, _b = find_ab_params(1.0, min_dist)
        umap_loss_fn = UmapLoss(negative_sample_rate, self.DEVICE, _a, _b, repulsion_strength=1.0)
        recon_loss_fn = ReconstructionLoss(beta=1.0)
        smooth_loss_fn = SmoothnessLoss(margin=0.5)
        self.criterion = HybridLoss(umap_loss_fn, recon_loss_fn, smooth_loss_fn, lambd1=LAMBDA, lambd2=S_LAMBDA)
        self.segmenter = Segmenter(data_provider=self.data_provider, threshold=78.5, range_s=EPOCH_START, range_e=EPOCH_END, range_p=EPOCH_PERIOD)
        self.projector = DeepDebuggerProjector(vis_model=self.model, content_path=self.CONTENT_PATH,vis_model_name=VIS_MODEL_NAME, segments=None, device=self.DEVICE)
        self.vis = visualizer(self.data_provider, self.projector, 200, "tab10")
        self.evaluator = Evaluator(self.data_provider, self.projector)

    def _preprocess(self):
        PREPROCESS = self.config["VISUALIZATION"]["PREPROCESS"]
        # Training parameter (subject model)
        TRAINING_PARAMETER = self.config["TRAINING"]
        LEN = TRAINING_PARAMETER["train_num"]
        # Training parameter (visualization model)
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        B_N_EPOCHS = VISUALIZATION_PARAMETER["BOUNDARY"]["B_N_EPOCHS"]
        L_BOUND = VISUALIZATION_PARAMETER["BOUNDARY"]["L_BOUND"]
        if PREPROCESS:
            self.data_provider._meta_data()
            if B_N_EPOCHS >0:
                self.data_provider._estimate_boundary(LEN//10, l_bound=L_BOUND)
    
    def _segment(self):
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        VIS_MODEL_NAME = VISUALIZATION_PARAMETER["VIS_MODEL_NAME"]
        t0 = time.time()
        SEGMENTS = self.segmenter.segment()
        t1 = time.time()
        self.projector.segments = SEGMENTS
        self.segmenter.record_time(self.data_provider.model_path, "time_{}.json".format(VIS_MODEL_NAME), t1-t0)
        print("Segmentation takes {:.1f} seconds.".format(round(t1-t0, 3)))
    
    def _train(self):
        TRAINING_PARAMETER = self.config["TRAINING"]
        LEN = TRAINING_PARAMETER["train_num"]
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        SEGMENTS = self.segmenter.segments
        B_N_EPOCHS = VISUALIZATION_PARAMETER["BOUNDARY"]["B_N_EPOCHS"]
        INIT_NUM = VISUALIZATION_PARAMETER["INIT_NUM"]
        ALPHA = VISUALIZATION_PARAMETER["ALPHA"]
        BETA = VISUALIZATION_PARAMETER["BETA"]
        MAX_HAUSDORFF = VISUALIZATION_PARAMETER["MAX_HAUSDORFF"]
        S_N_EPOCHS = VISUALIZATION_PARAMETER["S_N_EPOCHS"]
        T_N_EPOCHS = VISUALIZATION_PARAMETER["T_N_EPOCHS"]
        N_NEIGHBORS = VISUALIZATION_PARAMETER["N_NEIGHBORS"]
        PATIENT = VISUALIZATION_PARAMETER["PATIENT"]
        MAX_EPOCH = VISUALIZATION_PARAMETER["MAX_EPOCH"]
        VIS_MODEL_NAME = VISUALIZATION_PARAMETER["VIS_MODEL_NAME"]
        
        prev_selected = np.random.choice(np.arange(LEN), size=INIT_NUM, replace=False)
        prev_embedding = None
        start_point = len(SEGMENTS)-1
        c0=None
        d0=None


        for seg in range(start_point,-1,-1):
            epoch_start, epoch_end = SEGMENTS[seg]
            self.data_provider.update_interval(epoch_s=epoch_start, epoch_e=epoch_end)

            optimizer = torch.optim.Adam(self.model.parameters(), lr=.01, weight_decay=1e-5)
            lr_scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=.1)

            t0 = time.time()
            spatial_cons = kcHybridSpatialEdgeConstructor(data_provider=self.data_provider, init_num=INIT_NUM, s_n_epochs=S_N_EPOCHS, b_n_epochs=B_N_EPOCHS, n_neighbors=N_NEIGHBORS, MAX_HAUSDORFF=MAX_HAUSDORFF, ALPHA=ALPHA, BETA=BETA, init_idxs=prev_selected, init_embeddings=prev_embedding, c0=c0, d0=d0)
            s_edge_to, s_edge_from, s_probs, feature_vectors, embedded, coefficient, time_step_nums, time_step_idxs_list, knn_indices, sigmas, rhos, attention, (c0,d0) = spatial_cons.construct()

            temporal_cons = GlobalTemporalEdgeConstructor(X=feature_vectors, time_step_nums=time_step_nums, sigmas=sigmas, rhos=rhos, n_neighbors=N_NEIGHBORS, n_epochs=T_N_EPOCHS)
            t_edge_to, t_edge_from, t_probs = temporal_cons.construct()
            t1 = time.time()

            edge_to = np.concatenate((s_edge_to, t_edge_to),axis=0)
            edge_from = np.concatenate((s_edge_from, t_edge_from), axis=0)
            probs = np.concatenate((s_probs, t_probs), axis=0)
            probs = probs / (probs.max()+1e-3)
            eliminate_zeros = probs>1e-3
            edge_to = edge_to[eliminate_zeros]
            edge_from = edge_from[eliminate_zeros]
            probs = probs[eliminate_zeros]

            dataset = HybridDataHandler(edge_to, edge_from, feature_vectors, attention, embedded, coefficient)
            n_samples = int(np.sum(S_N_EPOCHS * probs) // 1)
            # chose sampler based on the number of dataset
            if len(edge_to) > 2^24:
                sampler = CustomWeightedRandomSampler(probs, n_samples, replacement=True)
            else:
                sampler = WeightedRandomSampler(probs, n_samples, replacement=True)
            edge_loader = DataLoader(dataset, batch_size=1000, sampler=sampler)

            ########################################################################################################################
            #                                                       TRAIN                                                          #
            ########################################################################################################################

            trainer = HybridVisTrainer(self.model, self.criterion, optimizer, lr_scheduler, edge_loader=edge_loader, DEVICE=self.DEVICE)

            t2=time.time()
            trainer.train(PATIENT, MAX_EPOCH)
            t3 = time.time()

            file_name = "time_{}".format(VIS_MODEL_NAME)
            trainer.record_time(self.data_provider.model_path, file_name, "complex_construction", seg, t1-t0)
            trainer.record_time(self.data_provider.model_path, file_name, "training", seg, t3-t2)

            trainer.save(save_dir=self.data_provider.model_path, file_name="{}_{}".format(VIS_MODEL_NAME, seg))
            self.model = trainer.model

            # update prev_idxs and prev_embedding
            prev_selected = time_step_idxs_list[0]
            prev_data = torch.from_numpy(feature_vectors[:len(prev_selected)]).to(dtype=torch.float32, device=self.DEVICE)
            self.model = self.model.to(device=self.DEVICE)
            prev_embedding = self.model.encoder(prev_data).cpu().detach().numpy()
    

    def _evaluate(self):
        EPOCH_START = self.config["EPOCH_START"]
        EPOCH_END = self.config["EPOCH_END"]
        EPOCH_PERIOD = self.config["EPOCH_PERIOD"]
        VISUALIZATION_PARAMETER = self.config["VISUALIZATION"]
        EVALUATION_NAME = VISUALIZATION_PARAMETER["EVALUATION_NAME"]
        N_NEIGHBORS = VISUALIZATION_PARAMETER["N_NEIGHBORS"]
        eval_epochs = list(range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD))
        for eval_epoch in eval_epochs:
            self.evaluator.save_epoch_eval(eval_epoch, N_NEIGHBORS, temporal_k=5, file_name="{}".format(EVALUATION_NAME))
    
    def _visualize(self):
        EPOCH_START = self.config["EPOCH_START"]
        EPOCH_END = self.config["EPOCH_END"]
        EPOCH_PERIOD = self.config["EPOCH_PERIOD"]
        save_dir = os.path.join(self.data_provider.content_path, "img")
        os.makedirs(save_dir, exist_ok=True)
        for i in range(EPOCH_START, EPOCH_END+1, EPOCH_PERIOD):
            self.vis.savefig(i, path=os.path.join(save_dir, "{}_{}.png".format(self.VIS_METHOD, i)))

    def visualize_embedding(self):
        self._preprocess()
        self._segment()
        self._train()
        self._visualize()
        self._evaluate()

class DVIAL(StrategyAbstractClass):
    def __init__(self, CONTENT_PATH, config):
        super().__init__(CONTENT_PATH, config)
        resume_iter = config["BASE_ITERATION"]
        self.VIS_METHOD = "DVIAL"
        self._init(resume_iteration=resume_iter)
    
    def _init(self, resume_iteration=-1):
        sys.path.append(self.CONTENT_PATH)
        # record output information
        # now = time.strftime("%Y-%m-%d-%H_%M_%S", time.localtime(time.time())) 
        # sys.stdout = open(os.path.join(self.CONTENT_PATH, now+".txt"), "w")

        CLASSES = self.config["CLASSES"]
        BASE_ITERATION = self.config["BASE_ITERATION"]
        GPU_ID = self.config["GPU"]
        self.DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

        #################################################   VISUALIZATION PARAMETERS    ########################################
        ENCODER_DIMS = self.config["VISUALIZATION"]["ENCODER_DIMS"]
        DECODER_DIMS = self.config["VISUALIZATION"]["DECODER_DIMS"]
        VIS_MODEL_NAME = self.config["VISUALIZATION"]["VIS_MODEL_NAME"]

        ############################################   ACTIVE LEARNING MODEL PARAMETERS    ######################################
        TRAINING_PARAMETERS = self.config["TRAINING"]
        NET = TRAINING_PARAMETERS["NET"]

        import Model.model as subject_model
        net = eval("subject_model.{}()".format(NET))

        self.data_provider = ActiveLearningDataProvider(self.CONTENT_PATH, net, BASE_ITERATION, device=self.DEVICE, classes=CLASSES, iteration_name="Iteration", verbose=1)
        self.model = VisModel(ENCODER_DIMS, DECODER_DIMS)
        self.projector = ALProjector(vis_model=self.model, content_path=self.CONTENT_PATH, vis_model_name=VIS_MODEL_NAME, device=self.DEVICE)

        if resume_iteration > 0:
            self.projector.load(resume_iteration)
            
        self.evaluator = ALEvaluator(self.data_provider, self.projector)
        self.vis = visualizer(self.data_provider, self.projector, 200)

    def _preprocess(self, iteration):
        PREPROCESS = self.config["VISUALIZATION"]["PREPROCESS"]
        B_N_EPOCHS = self.config["VISUALIZATION"]["BOUNDARY"]["B_N_EPOCHS"]
        L_BOUND = self.config["VISUALIZATION"]["BOUNDARY"]["L_BOUND"]

        if PREPROCESS:
            self.data_provider._meta_data(iteration)
            LEN = len(self.data_provider.train_labels(iteration))
            if B_N_EPOCHS >0:
                self.data_provider._estimate_boundary(iteration, LEN//10, l_bound=L_BOUND)

    def _train(self, iteration):
        S_N_EPOCHS = self.config["VISUALIZATION"]["S_N_EPOCHS"]
        LAMBDA = self.config["VISUALIZATION"]["LAMBDA"]
        MAX_EPOCH = self.config["VISUALIZATION"]["MAX_EPOCH"]
        PATIENT = self.config["VISUALIZATION"]["PATIENT"]
        VIS_MODEL_NAME = self.config["VISUALIZATION"]["VIS_MODEL_NAME"]

        t0 = time.time()
        spatial_cons = SingleEpochSpatialEdgeConstructor(self.data_provider, iteration, 5, 0, 15)
        edge_to, edge_from, probs, feature_vectors, attention = spatial_cons.construct()
        t1 = time.time()

        probs = probs / (probs.max()+1e-3)
        eliminate_zeros = probs>1e-3
        edge_to = edge_to[eliminate_zeros]
        edge_from = edge_from[eliminate_zeros]
        probs = probs[eliminate_zeros]

        spatial_cons.record_time(self.data_provider.model_path, "time_{}".format(VIS_MODEL_NAME), "complex_construction", t1-t0)

        dataset = DataHandler(edge_to, edge_from, feature_vectors, attention)
        n_samples = int(np.sum(S_N_EPOCHS * probs) // 1)
        # chosse sampler based on the number of dataset
        if len(edge_to) > 2^24:
            sampler = CustomWeightedRandomSampler(probs, n_samples, replacement=True)
        else:
            sampler = WeightedRandomSampler(probs, n_samples, replacement=True)
        edge_loader = DataLoader(dataset, batch_size=1024, sampler=sampler)

        negative_sample_rate = 5
        min_dist = .1
        _a, _b = find_ab_params(1.0, min_dist)
        umap_loss_fn = UmapLoss(negative_sample_rate, self.DEVICE, _a, _b, repulsion_strength=1.0)
        recon_loss_fn = ReconstructionLoss(beta=1.0)
        criterion = SingleVisLoss(umap_loss_fn, recon_loss_fn, lambd=LAMBDA)

        optimizer = torch.optim.Adam(self.model.parameters(), lr=.01, weight_decay=1e-5)
        lr_scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=.1)

        trainer = SingleVisTrainer(self.model, criterion, optimizer, lr_scheduler,edge_loader=edge_loader, DEVICE=self.DEVICE)
        t2=time.time()
        trainer.train(PATIENT, MAX_EPOCH)
        t3 = time.time()

        # save result
        save_dir = os.path.join(self.data_provider.model_path, "time_{}.json".format(VIS_MODEL_NAME))
        if not os.path.exists(save_dir):
            evaluation = dict()
        else:
            f = open(save_dir, "r")
            evaluation = json.load(f)
            f.close()
        if  "training" not in evaluation.keys():
            evaluation["training"] = dict()
        evaluation["training"][str(iteration)] = round(t3-t2, 3)
        with open(save_dir, 'w') as f:
            json.dump(evaluation, f)
        save_dir = os.path.join(self.data_provider.model_path, "Iteration_{}".format(iteration))
        os.makedirs(save_dir, exist_ok=True)
        trainer.save(save_dir=save_dir, file_name=VIS_MODEL_NAME)

    def _evaluate(self, iteration):
        EVALUATION_NAME = self.config["VISUALIZATION"]["EVALUATION_NAME"]
        self.evaluator.save_epoch_eval(iteration, file_name=EVALUATION_NAME)

    def _visualize(self, iteration):
        save_dir = os.path.join(self.data_provider.content_path, "img")
        os.makedirs(save_dir, exist_ok=True)
        data = self.data_provider.train_representation(iteration)
        pred = self.data_provider.get_pred(iteration, data).argmax(1)
        labels = self.data_provider.train_labels(iteration)
        self.vis.savefig_cus(iteration, data, pred, labels, path=os.path.join(save_dir, "{}_al.png".format(iteration)))


    def visualize_embedding(self, iteration, resume_iter=-1):
        self._init(resume_iter)
        self._preprocess(iteration)
        self._train(iteration)
        self._evaluate(iteration)
        self._visualize(iteration)


class DenseAL(StrategyAbstractClass):
    def __init__(self, CONTENT_PATH, config):
        super().__init__(CONTENT_PATH, config)
        self.VIS_METHOD = "DenseAL"


class tfDVIDenseAL(DenseAL):
    def __init__(self, CONTENT_PATH, config):
        super().__init__(CONTENT_PATH, config)
        self.VIS_METHOD = "tfDVIDenseAL"
        self._init(resume_iteration=config["BASE_ITERATION"])
    
    def _init(self, resume_iteration=-1):
        sys.path.append(self.CONTENT_PATH)

        CLASSES = self.config["CLASSES"]
        BASE_ITERATION = self.config["BASE_ITERATION"]
        GPU_ID = self.config["GPU"]
        self.DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

        #################################################   VISUALIZATION PARAMETERS    ########################################
        EPOCH_NUM = self.config["TRAINING"]["total_epoch"]
        FLAG = self.config["VISUALIZATION"]["FLAG"]

        ############################################   ACTIVE LEARNING MODEL PARAMETERS    ######################################
        TRAINING_PARAMETERS = self.config["TRAINING"]
        NET = TRAINING_PARAMETERS["NET"]

        import Model.model as subject_model
        net = eval("subject_model.{}()".format(NET))

        self.data_provider = DenseActiveLearningDataProvider(self.CONTENT_PATH, net, BASE_ITERATION, EPOCH_NUM, device=self.DEVICE, classes=CLASSES, iteration_name="Iteration", epoch_name="Epoch", verbose=1)
        self.projector = tfDVIDenseALProjector(content_path=self.CONTENT_PATH, flag=FLAG)

        if resume_iteration > 0:
            self.projector.load(resume_iteration, EPOCH_NUM)
            
        self.evaluator = DenseALEvaluator(self.data_provider, self.projector)
        self.vis = DenseALvisualizer(self.data_provider, self.projector, 200)
        

    def _preprocess(self, iteration):
        PREPROCESS = self.config["VISUALIZATION"]["PREPROCESS"]
        B_N_EPOCHS = self.config["VISUALIZATION"]["BOUNDARY"]["B_N_EPOCHS"]
        L_BOUND = self.config["VISUALIZATION"]["BOUNDARY"]["L_BOUND"]

        if PREPROCESS:
            self.data_provider._meta_data(iteration)
            LEN = len(self.data_provider.train_labels(iteration))
            if B_N_EPOCHS >0:
                self.data_provider._estimate_boundary(iteration, LEN//10, l_bound=L_BOUND)

    def _train(self, iteration):
        # TODO
        pass

    def _evaluate(self, iteration):
        EVALUATION_NAME = self.config["VISUALIZATION"]["EVALUATION_NAME"]
        self.evaluator.save_epoch_eval(iteration, file_name=EVALUATION_NAME)

    def _visualize(self, iteration):
        save_dir = os.path.join(self.data_provider.content_path, "img")
        os.makedirs(save_dir, exist_ok=True)
        data = self.data_provider.train_representation(iteration)
        pred = self.data_provider.get_pred(iteration, data).argmax(1)
        labels = self.data_provider.train_labels(iteration)
        self.vis.savefig_cus(iteration, data, pred, labels, path=os.path.join(save_dir, "{}_al.png".format(iteration)))

    def visualize_embedding(self, iteration, resume_iter=-1):
        self._init(resume_iter)
        self._preprocess(iteration)
        self._train(iteration)
        self._evaluate(iteration)
        self._visualize(iteration)

class TimeVisDenseAL(DenseAL):
    def __init__(self, CONTENT_PATH, config):
        super().__init__(CONTENT_PATH, config)
        self.VIS_METHOD = "TimeVisDenseAL"
        self._init(resume_iteration=config["BASE_ITERATION"])
    
    def _init(self, resume_iteration=-1):
        sys.path.append(self.CONTENT_PATH)

        CLASSES = self.config["CLASSES"]
        BASE_ITERATION = self.config["BASE_ITERATION"]
        GPU_ID = self.config["GPU"]
        self.DEVICE = torch.device("cuda:{}".format(GPU_ID) if torch.cuda.is_available() else "cpu")

        #################################################   VISUALIZATION PARAMETERS    ########################################
        EPOCH_NUM = self.config["TRAINING"]["total_epoch"]
        ENCODER_DIMS = self.config["VISUALIZATION"]["ENCODER_DIMS"]
        DECODER_DIMS = self.config["VISUALIZATION"]["DECODER_DIMS"]
        VIS_MODEL_NAME = self.config["VISUALIZATION"]["VIS_MODEL_NAME"]

        ############################################   ACTIVE LEARNING MODEL PARAMETERS    ######################################
        TRAINING_PARAMETERS = self.config["TRAINING"]
        NET = TRAINING_PARAMETERS["NET"]

        import Model.model as subject_model
        net = eval("subject_model.{}()".format(NET))

        self.data_provider = DenseActiveLearningDataProvider(self.CONTENT_PATH, net, BASE_ITERATION, EPOCH_NUM, device=self.DEVICE, classes=CLASSES, iteration_name="Iteration", epoch_name="Epoch", verbose=1)
        self.model = VisModel(encoder_dims=ENCODER_DIMS, decoder_dims=DECODER_DIMS)
        self.projector = TimeVisDenseALProjector(vis_model=self.model, content_path=self.CONTENT_PATH, vis_model_name=VIS_MODEL_NAME, device=self.DEVICE)

        if resume_iteration > 0:
            self.projector.load(resume_iteration, EPOCH_NUM)
            
        self.evaluator = DenseALEvaluator(self.data_provider, self.projector)
        self.vis = DenseALvisualizer(self.data_provider, self.projector, 200)
        

    def _preprocess(self, iteration):
        PREPROCESS = self.config["VISUALIZATION"]["PREPROCESS"]
        B_N_EPOCHS = self.config["VISUALIZATION"]["BOUNDARY"]["B_N_EPOCHS"]
        L_BOUND = self.config["VISUALIZATION"]["BOUNDARY"]["L_BOUND"]

        if PREPROCESS:
            self.data_provider._meta_data(iteration)
            LEN = len(self.data_provider.train_labels(iteration))
            if B_N_EPOCHS >0:
                self.data_provider._estimate_boundary(iteration, LEN//10, l_bound=L_BOUND)

    def _train(self, iteration):
        # TODO
        pass

    def _evaluate(self, iteration):
        EVALUATION_NAME = self.config["VISUALIZATION"]["EVALUATION_NAME"]
        self.evaluator.save_epoch_eval(iteration, file_name=EVALUATION_NAME)

    def _visualize(self, iteration):
        save_dir = os.path.join(self.data_provider.content_path, "img")
        os.makedirs(save_dir, exist_ok=True)
        data = self.data_provider.train_representation(iteration)
        pred = self.data_provider.get_pred(iteration, data).argmax(1)
        labels = self.data_provider.train_labels(iteration)
        self.vis.savefig_cus(iteration, data, pred, labels, path=os.path.join(save_dir, "{}_al.png".format(iteration)))

    def visualize_embedding(self, iteration, resume_iter=-1):
        self._init(resume_iter)
        self._preprocess(iteration)
        self._train(iteration)
        self._evaluate(iteration)
        self._visualize(iteration)


if __name__ == "__main__":
    import json
    CONTENT_PATH = "/home/xiangling/data/speech_comment"
    with open(os.path.join(CONTENT_PATH, "config.json"), "r") as f:
        config = json.load(f)

    #------------------------DVI-----------------------------------
    VIS_METHOD = "DVI"
    dvi_config = config[VIS_METHOD]
    dvi = DeepVisualInsight(CONTENT_PATH, dvi_config)
    dvi.visualize_embedding()

    #------------------------TimeVis-------------------------------
    VIS_METHOD = "TimeVis"
    timevis_config = config[VIS_METHOD]
    timevis = TimeVis(CONTENT_PATH, timevis_config)
    timevis.visualize_embedding()

    #------------------------DeepDebugger--------------------------
    VIS_METHOD = "DeepDebugger"
    deepdebugger_config = config[VIS_METHOD]
    deepdebugger = DeepDebugger(CONTENT_PATH, deepdebugger_config)
    deepdebugger.visualize_embedding()

    #------------------------DVI for AL----------------------------
    VIS_METHOD = "DVIAL"
    dvi_al_config = config[VIS_METHOD]
    dvi_al = DVIAL(CONTENT_PATH, dvi_al_config)

    start_i = 1
    for iteration in range(1,5,1):
        resume_iter = iteration-1 if iteration > start_i else -1
        dvi_al.visualize_embedding(iteration, resume_iter)
