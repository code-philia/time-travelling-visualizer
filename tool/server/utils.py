import io
import math
import tqdm
import os
import json
import re
import numpy as np
import sys
import base64
from PIL import Image

import matplotlib.pyplot as plt
import torch
from vismodel import VisModel

"""Utils of new data schema"""
# Func: infer available epochs through projection files, return a list of available epochs
def epoch_structure_from_projection(content_path):
    visMethods = ['DVI', 'TimeVis']
    for visMethod in visMethods:
        projection_folder = os.path.join(content_path, "visualize", visMethod, "projection")
        if not os.path.exists(projection_folder):
            continue

        files = os.listdir(projection_folder)

        file_numbers = [int(file.rstrip('.npy')) for file in files if file.endswith('.npy')]
        file_numbers = sorted(file_numbers)
        if file_numbers != []:
            return file_numbers, ''

    return None, "No projection files found, can't infer epoch structure"

# Func: get coloring list
def get_coloring_list(config):
    if 'classes' in config['dataset']:
        classes = config['dataset']['classes']
        class_num = len(classes)
    else:
        class_num = 10
    # color = get_standard_classes_color(class_num) * 255
    color_map = plt.get_cmap('tab10')
    color = color_map(range(class_num))
    color_255 = (color[:, :3] * 255).astype(np.uint8)  # 获取 RGB 三个通道，并转换为整数
    return color_255.tolist()

# Func: load projection and label list (minimum requirement for 'update_projection')
def load_projection(config, content_path, vis_method, epoch):
    # here we only have one kind of projection for each vis method, so we directly locate them in 'projection' folder
    # in the future, maybe projection is also a kind of 'attribute' and need to be pointed out in the config.json
    projection_path = os.path.join(content_path, "visualize", vis_method, "projection", f"{epoch}.npy")
    projection = np.load(projection_path)
    projection_list = projection.tolist()

    # load label list for samples in projection
    attributes = config['dataset']['attributes']
    if 'label' not in attributes:
        raise NotImplementedError("label is not in attributes")

    file_path_pattern = attributes['label']['source']['pattern']
    file_path = os.path.join(content_path, file_path_pattern)
    label_list = read_label_file(file_path)
    
    # compute scale to fix canvas
    x_min = float(np.min(projection[:, 0]))
    y_min = float(np.min(projection[:, 1]))
    x_max = float(np.max(projection[:, 0]))
    y_max = float(np.max(projection[:, 1]))
    scale = [x_min-1, y_min-1, x_max+1, y_max+1]
    
    return projection_list, label_list, scale

# Func: load one sample from content_path
def load_one_sample(config, content_path, index):
    attributes = config['dataset']['attributes']
    if 'sample' not in attributes:
        raise NotImplementedError("sample is not in attributes")

    file_path_pattern = attributes['sample']['source']['pattern']
    file_path = file_path_pattern.replace('${index}', str(index))
    file_path = os.path.join(content_path, file_path)

    _, file_extension = os.path.splitext(file_path)
    if file_extension == '.txt':
        sample = ""
        single_file = attributes['sample']['source']['type']=='folder'
        if single_file: # this indicates that all the text samples are saved in one file
            with open(file_path, 'r') as f:
                all_sample = f.readlines()
                sample = all_sample[index]
        else:
            with open(file_path, 'r') as f:
                sample = f.readline()
        return 'text',sample

    elif file_extension == '.png' or file_extension == '.jpg':
        img_stream = ""
        with open(file_path, 'rb') as img_f:
            img_stream = img_f.read()
            img_stream = base64.b64encode(img_stream).decode()
        return 'image','data:image/png;base64,' + img_stream
    else:
        raise NotImplementedError("Unsupported file extension: {}".format(file_extension))


# Func: load all text samples
def get_all_texts(config, content_path):
    attributes = config['dataset']['attributes']
    if 'sample' not in attributes:
        return None, 'sample is not in attributes'

    sampleConfig = attributes['sample']
    if sampleConfig['dataType'] != 'text':
        return None, 'sample is not text'

    text_list = []
    if sampleConfig['source']['type'] == 'folder':
        # FIXME strange pattern match
        parent_directory = os.path.dirname(sampleConfig['source']['pattern'])
        parent_directory = os.path.join(content_path, parent_directory)

        files_and_folders = os.listdir(parent_directory)
        numbered_files = [f for f in files_and_folders if f.endswith('.txt') and f[-5].isdigit()]
        numbered_files.sort(key=lambda f: int(re.search(r'[0-9]+', f)[0]))

        # TODO: if we know index of samples, we can directly read the file by index
        for file_name in numbered_files:
            file_path = os.path.join(parent_directory, file_name)
            with open(file_path, 'r') as file:
                content = file.read()
                text_list.append(content)

    elif sampleConfig['source']['type'] == 'file':
        with open(sampleConfig['source']['pattern'], 'r') as f:
            text_list = f.readlines()
    else:
        return None, 'Unsupported source type: {}'.format(sampleConfig['source']['type'])

    return text_list, ''

# Func: given label file path, return python list of labels
def read_label_file(file_path):
    _, file_extension = os.path.splitext(file_path)

    if file_extension == '.npy':
        data = np.load(file_path)
        label_list = data.tolist()
    elif file_extension == '.pth':
        data = torch.load(file_path)
        if isinstance(data, torch.Tensor):
            label_list = data.tolist()
        else:
            raise ValueError(f"Unsupported data type in .pth file: {type(data)}")
    else:
        raise ValueError(f"Unsupported file extension: {file_extension}")

    return label_list


# Func: load representation of one epoch
def load_representation(config, content_path, epoch):
    attributes = config['dataset']['attributes']
    if 'representation' not in attributes:
        raise NotImplementedError("representation is not in attributes")

    file_path_pattern = attributes['representation']['source']['pattern']
    file_path = file_path_pattern.replace('${epoch}', str(epoch))
    file_path = os.path.join(content_path, file_path)

    repr = np.load(file_path)
    return repr.tolist()


"""
About other attributes (not basic attributes like representation, label, sample...)
"""
def load_single_attribute(config, content_path, epoch, attribute):
    attributes = config['dataset']['attributes']
    if attribute not in attributes:
        raise NotImplementedError("Attribute name not found in config file")

    # TODO other types of attributes?
    # how does 'dataType' and 'sourceType' work?

    file_path_pattern = attributes[attribute]['source']['pattern']
    file_path = os.path.join(content_path, file_path_pattern)
    file_path = file_path.replace('${epoch}', str(epoch))

    attr_data = read_from_file(file_path)

    return attr_data

def read_from_file(file_path):
    _, file_extension = os.path.splitext(file_path)

    if file_extension == '.npy':
        data = np.load(file_path)
        result = data.tolist()
    elif file_extension == '.pth':
        data = torch.load(file_path)
        if isinstance(data, torch.Tensor):
            result = data.tolist()
        elif isinstance(data, (dict, list)):
            result = data
        else:
            raise ValueError(f"Unsupported data type in .pth file: {type(data)}")
    else:
        raise ValueError(f"Unsupported file extension: {file_extension}")

    return result

# Func: get simple filtered indices
def get_filter_result(config, content_path, epoch, filters):
    index_file_path = os.path.join(content_path, 'index.json')
    if not os.path.exists(index_file_path):
        return None, 'index.json not found'

    indice_obj = read_file_as_json(index_file_path)

    all_indices = indice_obj['train'] + indice_obj['test']
    result = all_indices

    for filter in filters:
        filter_type = filter['filter_type']
        label_text_list = config['dataset']['classes']

        if filter_type == 'label':
            filter_data = filter['filter_data']

            attributes = config['dataset']['attributes']
            file_path_pattern = attributes['label']['source']['pattern']
            file_path = os.path.join(content_path, file_path_pattern)
            if not os.path.exists(file_path):
                return None, 'label file not found'

            label_list = read_label_file(file_path)

            filtered_indices = [index for index, label in zip(all_indices, label_list) if label_text_list[label] == filter_data]
            result = list(set(result) & set(filtered_indices))

        elif filter_type == 'prediction':
            filter_data = filter['filter_data']

            attributes = config['dataset']['attributes']
            file_path_pattern = attributes['prediction']['source']['pattern']
            file_path_pattern = file_path_pattern.replace('${epoch}', str(epoch))
            file_path = os.path.join(content_path, file_path_pattern)
            if not os.path.exists(file_path):
                return None, 'prediction file not found'

            prediction_list = read_label_file(file_path)

            filtered_indices = [index for index, label in zip(all_indices, prediction_list) if label_text_list[label] == filter_data]
            result = list(set(result) & set(filtered_indices))

        elif filter_type == 'train':
            result = list(set(result) & set(indice_obj['train']))

        elif filter_type == 'test':
            result = list(set(result) & set(indice_obj['test']))

    return result,''

# Func: compute pixel color, return webp image
def paint_background(content_path, vis_method, width, height, scale):
    pixel_position = compute_pixel_position(width, height, scale)
    pixel_color = compute_pixel_color(content_path, vis_method, pixel_position)
    
    pixel_color = pixel_color.reshape((height, width, 3))
    
    image = Image.fromarray(pixel_color.astype('uint8'), 'RGB')
    file_path = os.path.join(content_path, 'background.png')
    image.save(file_path, 'PNG')
    
    png_image = Image.open(file_path)
    
    webp_image = io.BytesIO()
    png_image.save(webp_image, format='WEBP')
    webp_image.seek(0)

    return webp_image


def compute_pixel_position(width, height, scale, pixel_size=1):
    [x_min, y_min, x_max, y_max] = scale
    pixels = []

    x_scale = (x_max - x_min) / (width / pixel_size)
    y_scale = (y_max - y_min) / (height / pixel_size)

    for j in range(int(height / pixel_size)):
        for i in range(int(width / pixel_size)):
            x = x_min + (i + pixel_size / 2) * x_scale
            y = y_min + (j + pixel_size / 2) * y_scale
            pixels.append([x, y])

    return pixels
    

def compute_pixel_color(content_path, vis_method, pixel_position):
    # define and load visualize model
    device = torch.device("cuda:{}".format(3) if torch.cuda.is_available() else "cpu")
    
    params = read_file_as_json(os.path.join(content_path, "params.json"))
    ENCODER_DIMS = params[vis_method]['ENCODER_DIMS']
    DECODER_DIMS = params[vis_method]['DECODER_DIMS']
    
    vis_model = VisModel(ENCODER_DIMS, DECODER_DIMS).to(device)
    vis_model_location = os.path.join(content_path, "visualize", vis_method, "model", f"{vis_method}.pth")
    save_model = torch.load(vis_model_location, map_location="cpu")
    vis_model.load_state_dict(save_model["state_dict"])
    vis_model.to(device)
    vis_model.eval()
    
    # get high dimensional representation
    pixel_position = np.array(pixel_position)
    embedding = vis_model.decoder(torch.from_numpy(pixel_position).to(dtype=torch.float32, device=device)).cpu().detach().numpy()
    
    # define and load subject model
    sys.path.append(content_path)
    import model as subject_model
    
    config = read_file_as_json(os.path.join(content_path, "config.json"))
    model = eval("subject_model.{}()".format(config['dataset']['net']))
    
    # state dict of subject model
    subject_model_location = os.path.join(content_path, "model", "subject_model.pth")
    model.load_state_dict(torch.load(subject_model_location, map_location=torch.device("cpu")))
    model.to(device)
    model.eval()
    
    # get prediction and color
    pred_func = model.prediction
    mesh_preds = batch_run(pred_func, torch.from_numpy(embedding).to(device), desc="getting prediction")
    color = get_decision_view(mesh_preds)

    return color

def get_decision_view(mesh_preds):
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
    cmap = plt.get_cmap('tab10')
    color = cmap(mesh_classes / mesh_max_class)

    diff = diff.reshape(-1, 1)

    color = color[:, 0:3]
    color = diff * 0.5 * color + (1 - diff) * np.ones(color.shape, dtype=np.uint8)
    color_rgb = (color * 255).astype(np.uint8)
    return color_rgb

def batch_run(model, data, desc = "batch_run", batch_size=512):
    """batch run, in case memory error"""
    data = data.to(dtype=torch.float)
    output = None
    n_batches = max(math.ceil(len(data) / batch_size), 1)
    for b in tqdm.tqdm(range(n_batches)):
        r1, r2 = b * batch_size, (b + 1) * batch_size
        inputs = data[r1:r2]
        with torch.no_grad():
            pred = model(inputs).cpu().numpy()
            if output is None:
                output = pred
            else:
                output = np.concatenate((output, pred), axis=0)
    return output


def read_file_as_json(file_path: str):
    with open(file_path, "r") as f:
        return json.load(f)