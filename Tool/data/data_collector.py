from abc import ABC

import os
import torch
import json
from torchvision import transforms
from torch.utils.data import Dataset, DataLoader
from transformers.tokenization_utils_base import BatchEncoding

class DataCollectorAbstractClass(ABC):
    """DataCollector entries directly to event files in the content_path to be
    consumed by TensorBoard.

    The `DataCollector` class provides a high-level API to create an event file
    in a given directory and add summaries and events to it. The class updates the
    file contents asynchronously. This allows a training program to call methods
    to add data to the file directly from the training loop, without slowing down
    training.
    """
    def __init__(self, content_path):
        """Creates a `DataCollector` that will write out events and summaries
        to the event file.

        Args:
            content_path (string): Save directory location.
        """
        os.makedirs(content_path, exist_ok=True)
        os.makedirs(os.path.join(content_path,'Model'),exist_ok=True)
        os.makedirs(os.path.join(content_path,'Dataset'),exist_ok=True)
        os.makedirs(os.path.join(content_path,'Visualization'),exist_ok=True)
        content_path = str(content_path)
        self.content_path = content_path
    
    def get_content_path(self):
        """Returns the directory where event file will be written."""
        return self.content_path
    

class DataCollector(DataCollectorAbstractClass):
    def __init__(self, content_path):
        super().__init__(content_path)
        self.to_pil_image = transforms.ToPILImage()

    # Func: data can be a list ([source_ids, source_masks]) or a tensor ([source_ids])
    def write_dataset(self, data, is_train = True,is_label=False):
        if isinstance(data, list):
            data = torch.stack(data,dim = 1) # [[source_id1,source_mask1],[source_id2,source_mask2],......]
        pre_fix = 'training' if is_train else 'testing'
        post_fix = 'data' if is_label else 'label'
        torch.save(data, os.path.join(self.content_path, f"{pre_fix}_dataset_{post_fix}.pth"))
    
    def write_checkpoint(self, model, epoch):
        model_to_save = model.module if hasattr(model, 'module') else model
        os.makedirs(os.path.join(self.content_path,'Model','Epoch_{}'.format(epoch)),exist_ok=True)
        torch.save(model_to_save.state_dict(), os.path.join(self.content_path,'Model','Epoch_{}'.format(epoch),'subject_model.pth'))
    
    
    # My summary writer
    def write_data(self, train_dataset, test_dataset, data_type = "text", collate_func = None, train_index = None, test_index = None):
        print('Writing data (index.json, data.pth, labels.pth, sprites)...')
        # index
        self.train_num = len(train_dataset)
        self.test_num = len(test_dataset)
        
        if train_index == None:
            train_index = list(range(self.train_num))
        self._write_index_file(train_index, train=True)

        if test_index == None:
            test_index = list(range(self.test_num))
        self._write_index_file(test_index, train=False)

        # sprites
        print('Writing sprites...')
        self._write_sprites(train_dataset, True, data_type)
        self._write_sprites(test_dataset, False, data_type)

        # data and labels
        print('Writing data and label...')
        if data_type == 'image':
            self._write_data_label_image(train_dataset, True)
            self._write_data_label_image(test_dataset, False)
        else:
            self._write_data_label_text(train_dataset, True, collate_func)
            self._write_data_label_text(test_dataset, False, collate_func)

        print('Finish writing all data !')

    
    # every epoch
    def write_checkpoint(self, state_dict, epoch, prev_epoch):
        self._write_checkpoint_data(state_dict,epoch)
        self._write_iteration_structure(epoch,prev_epoch)

    # ------------------------------------------------------------------------------------------------------------
    def _write_index_file(self, index, train = True):
        checkpoints_path = os.path.join(self.content_path, "Model")
        os.makedirs(checkpoints_path, exist_ok=True)
        if train:
            prefix = 'train'
        else:
            prefix = 'test'

        with open(os.path.join(checkpoints_path, f"{prefix}_index.json"), "w") as f:
            json.dump(index, f)
            f.close()


    def _write_sprites(self, dataset, train = True, data_type = 'text'):
        for idx, example in enumerate(dataset):
            if train:
                filename = idx
            else:
                filename = idx+self.train_num

            if data_type == 'image':
                input, _ = example
                img = self.to_pil_image(input)
                img_path = os.path.join(self.content_path,'sprites', f'{filename}.png')
                img.save(img_path)

            elif data_type == 'text':
                # assume that input is list of tokens
                input, _ = example
                txt = ' '.join(input)
                txt_path = os.path.join(self.content_path,'sprites', f'{filename}.txt')
                with open(txt_path,'w') as f:
                    f.write(txt)

                # TODO: other types of text input

    def _write_data_label_image(self, dataset, train = True):
        data_list = []
        label_list = []
        for example in dataset:
            input, label = example
            data_list.append(input)
            label_list.append(torch.tensor(label))
        
        data_tensor = torch.stack(data_list)
        label_tensor = torch.stack(label_list)

        if train == True:
            folder_prefix = 'Training'
            file_prefix = 'training'
        else:
            folder_prefix = 'Testing'
            file_prefix = 'testing'
    
        save_path = os.path.join(self.content_path, f"{folder_prefix}_data")
        os.makedirs(save_path, exist_ok=True)
        torch.save(data_tensor, os.path.join(save_path, f"{file_prefix}_dataset_data.pth"))
        torch.save(label_tensor, os.path.join(save_path, f"{file_prefix}_dataset_label.pth"))

    def _write_data_label_text(self, dataset, train = True, collate_func = None):
        dataloader = DataLoader(dataset, batch_size=64, shuffle=False, num_workers=2,
                            collate_fn=collate_func, pin_memory=True)
        # for inputs, labels in dataloader:
        all_input = None
        label_tensor = torch.empty(0)

        for inputs, labels in dataloader:
            if isinstance(inputs, BatchEncoding):
                if all_input == None:
                    all_input = inputs
                else:
                    for k in all_input.keys():
                        all_input[k] = torch.cat((all_input[k], inputs[k]),0)

            elif isinstance(inputs, torch.Tensor):
                if all_input == None:
                    all_input = inputs
                else:
                    all_input = torch.cat((all_input, inputs),0)

            else:
                print("inputs:",inputs)
                print("type:", type(inputs))
                raise TypeError("Unknown type of text input, not dict or tensor.")

            label_tensor = torch.cat((label_tensor,labels))
        

        if train == True:
            folder_prefix = 'Training'
            file_prefix = 'training'
        else:
            folder_prefix = 'Testing'
            file_prefix = 'testing'
    
        save_path = os.path.join(self.content_path, f"{folder_prefix}_data")
        os.makedirs(save_path, exist_ok=True)
        torch.save(all_input, os.path.join(save_path, f"{file_prefix}_dataset_data.pth"))
        torch.save(label_tensor, os.path.join(save_path, f"{file_prefix}_dataset_label.pth"))

    def _write_checkpoint_data(self, state_dict, epoch):
        checkpoints_path = os.path.join(self.content_path, "Model")
        checkpoint_path = os.path.join(checkpoints_path, "Epoch_{}".format(epoch))
        os.makedirs(checkpoint_path, exist_ok=True)
        torch.save(state_dict, os.path.join(checkpoint_path, "subject_model.pth"))

    def _write_iteration_structure(self, epoch, prev_epoch):
        iteration_structure_path = os.path.join(self.content_path, "iteration_structure.json")
        if prev_epoch < 1:
            iter_s = [{"value": epoch, "name": "Epoch", "pid": ""}]
            with open(iteration_structure_path, "w") as f:
                json.dump(iter_s, f)
                f.close()
        else:
            with open(iteration_structure_path,encoding='utf8')as fp:
                json_data = json.load(fp)
                json_data.append({'value': epoch, 'name': 'Epoch', 'pid': "{}".format(prev_epoch)})
                fp.close()
            with open(iteration_structure_path,'w') as f:
                json.dump(json_data, f)
                f.close()

    
