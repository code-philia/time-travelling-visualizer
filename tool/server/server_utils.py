import io
import math
from sklearn.neighbors import NearestNeighbors
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
import torchvision
import torchvision.transforms as transforms

sys.path.append('..')
from visualize.visualize_model import VisModel
from influence_function.IF import EmpiricalIF

# Func: infer available epochs files, return a list of available epochs
def infer_epoch_structure(content_path):
    epochs_dir = os.path.join(content_path, 'epochs')
    available_epochs = []
    if os.path.exists(epochs_dir) and os.path.isdir(epochs_dir):
        for folder_name in os.listdir(epochs_dir):
            if folder_name.startswith("epoch_"):
                try:
                    k = int(folder_name.split("_")[1])
                    available_epochs.append(k)
                except ValueError:
                    continue
    
    available_epochs.sort()
    return available_epochs

# Func: get coloring list
def get_coloring_list(class_num):
    # color = get_standard_classes_color(class_num) * 255
    color_map = plt.get_cmap('tab10')
    color = color_map(range(class_num))
    color_255 = (color[:, :3] * 255).astype(np.uint8)
    return color_255.tolist()

# Func: load projection of certain epoch
def load_projection(content_path, vis_id, epoch):
    projection_path = os.path.join(content_path, "visualize", vis_id, "epochs", f"epoch_{epoch}", "projection.npy")
    projection = np.load(projection_path)
    projection_list = projection.tolist()

    x_min = float(np.min(projection[:, 0]))
    y_min = float(np.min(projection[:, 1]))
    x_max = float(np.max(projection[:, 0]))
    y_max = float(np.max(projection[:, 1]))
    scope = [x_min-1, y_min-1, x_max+1, y_max+1]

    index_dict = load_or_create_index(content_path)
    all_indices = index_dict['train'] + index_dict['test']
    projection_list = [projection_list[i] for i in all_indices]

    return projection_list, scope

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
def get_all_texts(content_path):
    text_list = []
    
    parent_directory = os.path.join(content_path, 'dataset', 'text')

    files_and_folders = os.listdir(parent_directory)
    numbered_files = [f for f in files_and_folders if f.endswith('.txt') and f[-5].isdigit()]
    numbered_files.sort(key=lambda f: int(re.search(r'[0-9]+', f)[0]))

    for file_name in numbered_files:
        file_path = os.path.join(parent_directory, file_name)
        with open(file_path, 'r') as file:
            content = file.read()
            text_list.append(content)
            
    return text_list

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

def load_background(content_path, vis_id, epoch):
    file_path = os.path.join(content_path, 'visualize',vis_id,'epochs',f'epoch_{epoch}', 'background.png')
    if os.path.exists(file_path):
        return convert_to_base64(file_path)
    return ""

# Func: compute pixel color, return webp image
# FIXME: this function is not used in the current code
def paint_background_backup(content_path, vis_method, epoch, width, height, scale):
    file_path = os.path.join(content_path, 'visualize',vis_method,'epochs', f'epoch_{epoch}', 'background.png')
    if os.path.exists(file_path):
        return convert_to_base64(file_path)

    pixel_position = compute_pixel_position(width, height, scale)
    pixel_color = compute_pixel_color(content_path, vis_method, epoch, pixel_position)
    
    pixel_color = pixel_color.reshape((height, width, 3))
    
    image = Image.fromarray(pixel_color.astype('uint8'), 'RGB')
    
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    image.save(file_path, 'PNG')
    return convert_to_base64(file_path)

def convert_to_base64(image_path):
    with open(image_path, "rb") as image_file:
        base64_image = base64.b64encode(image_file.read()).decode('utf-8')
    return base64_image

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
    

def compute_pixel_color(content_path, vis_method, epoch, pixel_position):
    # define and load visualize model
    device = torch.device("cpu")
    
    # params = get_training_parameters()
    params_path = os.path.join(content_path,"params.json")
    params = read_file_as_json(params_path)
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
    subject_model_location = os.path.join(content_path, "model", f"{epoch}.pth")
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
    cmap = plt.get_cmap('tab10')
    color = cmap(mesh_classes)

    diff = diff.reshape(-1, 1)

    color = color[:, 0:3]
    color = diff * 0.5 * color + (1 - diff) * np.ones(color.shape, dtype=np.uint8)
    color_rgb = (color * 255).astype(np.uint8)
    return color_rgb

def batch_run(model, data, desc = "batch run", batch_size=512):
    """batch run, in case memory error"""
    data = data.to(dtype=torch.float)
    output = None
    n_batches = max(math.ceil(len(data) / batch_size), 1)
    for b in tqdm.tqdm(range(n_batches), desc=desc):
        r1, r2 = b * batch_size, (b + 1) * batch_size
        inputs = data[r1:r2]
        with torch.no_grad():
            pred = model(inputs).cpu().numpy()
            if output is None:
                output = pred
            else:
                output = np.concatenate((output, pred), axis=0)
    return output

def load_one_image(content_path, index):
    file_path = os.path.join(content_path, 'dataset', 'image', f'{index}.png')
    return convert_to_base64(file_path)

def load_one_text(content_path, index):
    file_path = os.path.join(content_path, 'dataset', 'text', f'{index}.txt')
    with open(file_path, 'r') as f:
        content = f.read()
    return content


def calculate_high_dimensional_neighbors(content_path, epoch, max_neighbors=10):
    featrue_list = load_single_attribute(content_path, epoch, 'representation')

    features = np.array(featrue_list)
    num_samples = len(features)
    nbrs = NearestNeighbors(n_neighbors=max_neighbors + 1, algorithm='auto').fit(features)
    distances, indices = nbrs.kneighbors(features)
    
    neighbors = [[] for _ in range(num_samples)]
    for i in range(num_samples):
        for j in range(1, max_neighbors + 1):
            neighbor_idx = indices[i][j]
            neighbors[i].append(int(neighbor_idx))
    
    return neighbors

def calculate_projection_neighbors(content_path, vis_id, epoch, max_neighbors=10):
    projection_list, _ = load_projection(content_path, vis_id, epoch)
    projection = np.array(projection_list)
    num_samples = len(projection)
    
    nbrs = NearestNeighbors(n_neighbors=max_neighbors + 1, algorithm='auto').fit(projection)
    distances, indices = nbrs.kneighbors(projection)
    
    neighbors = [[] for _ in range(num_samples)]
    for i in range(num_samples):
        for j in range(1, max_neighbors + 1):
            neighbor_idx = indices[i][j]
            neighbors[i].append(int(neighbor_idx))
    
    return neighbors


# Func: Load a single attribute from a file based on the configuration and epoch
def load_single_attribute(content_path, epoch, attribute):
    if attribute == 'label':
        file_path = os.path.join(content_path, 'dataset', 'labels.npy')
        attr_data = read_label_file(file_path)
    elif attribute == 'intra_similarity':
        file_path = os.path.join(content_path, 'epochs', f'epoch_{epoch}', 'intra_similarity.npy')
        attr_data = read_from_file(file_path)
    elif attribute == 'inter_similarity':
        file_path = os.path.join(content_path, 'epochs', f'epoch_{epoch}', 'inter_similarity.npy')
        attr_data = read_from_file(file_path)
    elif attribute == 'representation':
        file_path = os.path.join(content_path, 'epochs', f'epoch_{epoch}', 'embeddings.npy')
        attr_data = read_from_file(file_path)
    elif attribute == 'prediction':
        file_path = os.path.join(content_path, 'epochs', f'epoch_{epoch}', 'predictions.npy')
        attr_data = read_from_file(file_path)
    elif attribute == 'index':
        attr_data = load_or_create_index(content_path)
    else:
        raise NotImplementedError(f"Unknown attribute: {attribute}")
    
    index_dict = load_or_create_index(content_path)
    all_indices = index_dict['train'] + index_dict['test']
    if attribute != 'index':
        attr_data = [attr_data[i] for i in all_indices]
    
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
    elif file_extension == '.json':
        try:
            with open(file_path, 'r') as f:
                result = json.load(f)
        except Exception as e:
            raise ValueError(f"Error in reading json file from {file_path}: {e}")
    else:
        raise ValueError(f"Unsupported file extension: {file_extension}")

    return result

def read_file_as_json(file_path: str):
    if not os.path.exists(file_path):
        return None
    
    with open(file_path, "r") as f:
        return json.load(f)

def load_or_create_index(content_path):
    index_file_path = os.path.join(content_path, 'dataset', 'index.json')
    if os.path.exists(index_file_path):
        with open(index_file_path, 'r') as f:
            index_data = json.load(f)
        return index_data

    # If index.json does not exist, create it
    label = load_single_attribute(content_path, 0, 'label')
    num_samples = len(label)
    
    index_data = {
        'train': list(range(num_samples)),
        'test': []
    }
    
    # Save the index data to a file
    with open(index_file_path, 'w') as f:
        json.dump(index_data, f)

    return index_data

def get_training_parameters():
    server_path = os.path.dirname(os.path.realpath(__file__))
    tool_path = os.path.dirname(server_path)
    project_path = os.path.dirname(tool_path)
    params_path = os.path.join(project_path, "visualize","params.json")
    params = read_file_as_json(params_path)
    return params


def nearest_power_of_two(n):
    return 2 ** (n.bit_length() - 1)

def generate_dimension_array(dimension):
    encoder_dims = [dimension]
    target_length = 6
    while len(encoder_dims) < target_length - 1:
        next_dim = max(2, nearest_power_of_two(encoder_dims[-1] // 2))
        encoder_dims.append(next_dim)
    encoder_dims.append(2)
    
    decoder_dims = encoder_dims[::-1]
    return encoder_dims, decoder_dims

def calculate_visualize_metrics(content_path, vis_id, epoch):
    high_dimensional_neighbors = calculate_high_dimensional_neighbors(content_path, epoch)
    projection_neighbors = calculate_projection_neighbors(content_path, vis_id, epoch)

    # Neighbor trustworthiness and continuity
    K = min(len(high_dimensional_neighbors[0]), len(projection_neighbors[0]))
    N = len(high_dimensional_neighbors)

    trust_sum = 0.0
    cont_sum = 0.0

    for i in range(N):
        high = high_dimensional_neighbors[i][:K]
        low = projection_neighbors[i][:K]

        # 1. Trustworthiness
        u_set = set(low) - set(high)
        for j in u_set:
            try:
                rank = high_dimensional_neighbors[i].index(j) + 1  # 1-based
                trust_sum += (rank - K)
            except ValueError:
                trust_sum += (len(high_dimensional_neighbors[i]) + 1 - K)

        # 2. Continuity
        v_set = set(high) - set(low)
        for j in v_set:
            try:
                rank = projection_neighbors[i].index(j) + 1  # 1-based
                cont_sum += (rank - K)
            except ValueError:
                cont_sum += (len(projection_neighbors[i]) + 1 - K)

    normalizer = N * K * (2 * N - 3 * K - 1)

    trustworthiness = 1.0 - (2.0 / normalizer) * trust_sum
    continuity = 1.0 - (2.0 / normalizer) * cont_sum

    return {
        "neighbor_trustworthiness": trustworthiness,
        "neighbor_continuity": continuity
    }


def calculate_influence_samples(content_path, epoch, training_event, num_samples=5):
    # define and load subject model
    sys.path.append(os.path.join(content_path, "scripts"))
    import model as subject_model
    
    info = read_file_as_json(os.path.join(content_path, "dataset", "info.json"))
    model = eval("subject_model.{}()".format(info['model']))
    classes = info['classes']
    subject_model_location = os.path.join(content_path, "epochs", f"epoch_{epoch}", "model.pth")
    device = torch.device("cuda:3" if torch.cuda.is_available() else "cpu")
    model.load_state_dict(torch.load(subject_model_location, map_location=torch.device("cpu")))
    model.to(device)
    model.eval()
    
    # construct dataloader
    dataset_path = os.path.join(content_path, "dataset")
    cifar_path = os.path.join(dataset_path, 'cifar-10-batches-py')
    download = not os.path.exists(cifar_path) or not os.listdir(cifar_path)
    
    transform_train = transforms.Compose([
        transforms.RandomCrop(32, padding=4),
        transforms.RandomHorizontalFlip(),
        transforms.ToTensor(),
        transforms.Normalize((0.4914, 0.4822, 0.4465), (0.2023, 0.1994, 0.2010)),
    ])

    trainset = torchvision.datasets.CIFAR10(
        root=dataset_path, train=True, download=download, transform=transform_train)
    
    subset_indices = list(range(1000))  # 只取前1000个样本的索引
    subset_dataset = torch.utils.data.Subset(trainset, subset_indices)
    
    trainloader = torch.utils.data.DataLoader(
        subset_dataset, batch_size=128, shuffle=False, num_workers=2)
    
    IF = EmpiricalIF(dl_train=trainloader,
                               model=model,
                               param_filter_fn=lambda name, param: 'classifier' in name,
                               criterion=torch.nn.CrossEntropyLoss(reduction="none"))

    test_sample = trainloader.dataset[training_event['index']]
    test_input, _ = test_sample
    test_input = test_input.unsqueeze(0)  # Add batch dimension
    test_target = torch.tensor([classes.index(training_event['influenceTarget'])]).to(device)  # Add batch dimension
    IF_scores = IF.query_influence(test_input, test_target)
    
    # Get the indices of the top num_samples maximum and minimum scores
    max_indices = np.argsort(IF_scores)[-num_samples:][::-1]
    min_indices = np.argsort(IF_scores)[:num_samples]

    labels = load_single_attribute(content_path, epoch, 'label')

    influence_samples = []
    for index in max_indices.tolist():
        influence_samples.append({
            "index": index,
            "label": classes[labels[index]],
            "score": float(IF_scores[index]),
            "positive": True,
            "data": "data:image/png;base64,"+load_one_image(content_path, index)
        })
        
    for index in min_indices.tolist():
        influence_samples.append({
            "index": index,
            "label": classes[labels[index]],
            "score": float(IF_scores[index]),
            "positive": False,
            "data": "data:image/png;base64,"+load_one_image(content_path, index)
        })
   
    return influence_samples