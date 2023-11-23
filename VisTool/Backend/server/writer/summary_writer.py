from abc import ABC, abstractmethod

import os
import torch
from torch.utils.data import DataLoader
import json


class SummaryWriterAbstractClass(ABC):
    """Writes entries directly to event files in the log_dir to be
    consumed by TensorBoard.

    The `SummaryWriter` class provides a high-level API to create an event file
    in a given directory and add summaries and events to it. The class updates the
    file contents asynchronously. This allows a training program to call methods
    to add data to the file directly from the training loop, without slowing down
    training.
    """
    def __init__(self, log_dir):
        """Creates a `SummaryWriter` that will write out events and summaries
        to the event file.

        Args:
            log_dir (string): Save directory location.
        """
        log_dir = str(log_dir)
        self.log_dir = log_dir
    
    def get_logdir(self):
        """Returns the directory where event file will be written."""
        return self.log_dir
    
    @abstractmethod
    def add_training_data(self, dataset):
        pass

    @abstractmethod
    def add_testing_data(self, dataset):
        pass

    @abstractmethod
    def add_checkpoint_data(self, relative_path, state_dict, idxs):
        pass

    # @abstractmethod
    # def add_source(self, ):
    #     pass
    # sprite images, text,...


class SummaryWriter(SummaryWriterAbstractClass):

    def __init__(self, log_dir, batch_size=1000, num_worker=2):
        super().__init__(log_dir)
        self.batch_size = batch_size
        self.num_worker = num_worker

    def add_training_data(self, dataloader):

        trainset_data = None
        trainset_label = None
        for batch_idx, (inputs, targets) in enumerate(dataloader):
            if trainset_data != None:
                # print(input_list.shape, inputs.shape)
                trainset_data = torch.cat((trainset_data, inputs), 0)
                trainset_label = torch.cat((trainset_label, targets), 0)
            else:
                trainset_data = inputs
                trainset_label = targets

        training_path = os.path.join(self.log_dir, "Training_data")
        os.makedirs(training_path, exist_ok=True)
        torch.save(trainset_data, os.path.join(training_path, "training_dataset_data.pth"))
        torch.save(trainset_label, os.path.join(training_path, "training_dataset_label.pth"))

    def add_testing_data(self, dataloader):
        testset_data = None
        testset_label = None
        for batch in dataloader:
            inputs, targets = batch
            if testset_data is not None:
                testset_data = torch.cat((testset_data, inputs), 0)
                testset_label = torch.cat((testset_label, targets), 0)
            else:
                testset_data = inputs
                testset_label = targets
        testing_path = os.path.join(self.log_dir, "Testing_data")
        os.makedirs(testing_path, exist_ok=True)
        torch.save(testset_data, os.path.join(testing_path, "testing_dataset_data.pth"))
        torch.save(testset_label, os.path.join(testing_path, "testing_dataset_label.pth"))
    
    def add_checkpoint_data(self, state_dict, idxs, id, prev_id):
        checkpoints_path = os.path.join(self.log_dir, "Model")
        os.makedirs(checkpoints_path, exist_ok=True)
        # dirs = os.listdir(checkpoints_path)
        # C = 0
        # for dir in dirs:
        #     if "C_" in dir:
        #         C = max(C, int(dir.replace("C_", "")))
        # C += 1

        checkpoint_path = os.path.join(checkpoints_path, "Epoch_{}".format(id))
        os.makedirs(checkpoint_path, exist_ok=True)
        torch.save(state_dict, os.path.join(checkpoint_path, "subject_model.pth"))
        
        with open(os.path.join(checkpoint_path, "index.json"), "w") as f:
            json.dump(idxs, f)
        
        # update iteration structure
        iteration_structure_path = os.path.join(self.log_dir, "iteration_structure.json")
        if prev_id < 1:
            iter_s = [{"value": id, "name": "Epoch", "pid": ""}]
            with open(iteration_structure_path, "w") as f:
                json.dump(iter_s, f)
        else:
            with open(iteration_structure_path,encoding='utf8')as fp:
                json_data = json.load(fp)
                json_data.append({'value': id, 'name': 'Epoch', 'pid': "{}".format(prev_id)})
            with open(iteration_structure_path,'w') as f:
                json.dump(json_data, f)
                f.close()

                    


                

            



