import os
import sys
from llm_agent import call_llm_agent
from run_visualization import visualize_run

from flask import request, Flask, jsonify, make_response, send_file,send_from_directory
from flask_cors import CORS, cross_origin

sys.path.append('.')
sys.path.append('..')
sys.path.append('../..')
sys.path.append('../visualize')

from server_utils import *

# flask for API server
app = Flask(__name__)
cors = CORS(app, supports_credentials=True)
app.config['CORS_HEADERS'] = 'Content-Type'

# Check for "--dev" argument
is_dev_mode = "--dev" in sys.argv

@app.route("/", methods=["GET", "POST"])
def GUI():
    return send_from_directory('../frontend', 'index.html')

"""
Api: get epoch structure of one training process

Request:
    content_path (str)
    vis_method (str)
Response:
    structure (list[dict]): list of {epoch, previous_epoch}
"""
@app.route('/getIterationStructure', methods=["GET"])
@cross_origin()
def get_epoch_structure():
    content_path = request.args.get('content_path')
    available_epochs, error_message = epoch_structure_from_projection(content_path)

    if available_epochs is None:
        return make_response(jsonify({'error_message': error_message}), 400)

    result = jsonify({
        'available_epochs': available_epochs
    })
    return make_response(result, 200)

"""
Api: get training process info

Request:
    content_path (str)
    vis_method (str)
Response:
    color_list (list): list of colors
    label_text_list (list): list of label text
"""
@app.route('/getTrainingProcessInfo', methods=["GET"])
@cross_origin()
def get_training_process_info():
    content_path = request.args.get('content_path')
    config = read_file_as_json(os.path.join(content_path, 'config.json'))
    # 1. color list
    color_list  = get_coloring_list(config)
    # 2. label text list
    label_text_list = config['dataset']['classes']
    
    result = jsonify({
        'color_list': color_list,
        'label_text_list': label_text_list,
    })
    return make_response(result, 200)


"""
Api: get minimum info of one epoch

Request:
    content_path (str)
    vis_method (str)
    epoch (str): epoch number
Response:
    config (dict)
    project (list)
    label_list (list): label list of samples in projection
"""
@app.route('/updateProjection', methods = ["POST"])
@cross_origin()
def update_projection():
    req = request.get_json()
    content_path = req['content_path']
    vis_method = req['vis_method']
    epoch = int(req['epoch'])

    # NOTE dont't hide exception to backend output
    projection, scope = load_projection(content_path, vis_method, epoch)

    result = jsonify({
        'projection': projection,
        'scope': scope
    })
    return make_response(result, 200)

@app.route('/startVisualizing', methods = ["POST"])
def start_visualizing():
    req = request.get_json()
    content_path = req['content_path']
    vis_method = req['vis_method']
    task_type = req['task_type']
    vis_config = req['vis_config']

    print('start visualizing')
    print("vis config:", vis_config)
    
    visualize_run(content_path, vis_method, task_type, vis_config)
    
    return make_response({}, 200)


"""
Api: get original data of one sample

Request:
    content_path (str)
    index (str): sample index
Response:
    type (str): data type (image, text, ...)
    sample (str): base64 encoded image or plain text
"""
@app.route('/getSample', methods = ["POST"])
def get_sample():
    req = request.get_json()
    content_path = req['content_path']
    index = int(req['index'])

    config = read_file_as_json(os.path.join(content_path, 'config.json'))

    try:
        data_type, data = load_one_sample(config, content_path, index)
    except Exception as e:
        return make_response(jsonify({'error_message': 'Error in loading sample'}), 400)

    result = jsonify({
        'type': data_type,
        'sample': data
    })
    return make_response(result, 200)


"""
Api: get text data of all samples

Request:
    content_path (str)
Response:
    text_list (lsit of str)
"""
@app.route('/getAllText', methods = ["POST"])
def get_all_text():
    req = request.get_json()
    content_path = req['content_path']

    config = read_file_as_json(os.path.join(content_path, 'config.json'))

    text_list, error_message = get_all_texts(config, content_path)

    if text_list is None:
        return make_response(jsonify({'error_message': error_message}), 400)

    result = jsonify({
        'text_list': text_list
    })
    return make_response(result, 200)


"""
Api: get all representation of one epoch

Request:
    content_path (str)
    epoch (str)
Response:
    representation (list)
"""
@app.route('/getRepresentation', methods = ["POST"])
@cross_origin()
def get_representation_at_epoch():
    req = request.get_json()
    content_path = req['content_path']
    epoch = int(req['epoch'])

    config = read_file_as_json(os.path.join(content_path, 'config.json'))

    try:
        repr = load_representation(config, content_path, epoch)
    except Exception as e:
        return make_response(jsonify({'error_message': 'Error in loading representation'}), 400)

    result = jsonify({
        'representation': repr
    })
    return make_response(result, 200)



"""
Api: get selected attributes of the dataset

Request:
    content_path (str)
    epoch (str): epoch number
    attributes (list): selected attributes
Response:
    attribute1 (object)
    attribute2 (object)
    ...
"""
@app.route('/getAttributes', methods = ["POST"])
@cross_origin()
def get_attributes():
    req = request.get_json()
    content_path = req['content_path']
    epoch = req['epoch']
    attributes = req['attributes']

    config = read_file_as_json(os.path.join(content_path, 'config.json'))

    result = {}
    for attribute in attributes:
        result[attribute] = load_single_attribute(config, content_path, epoch, attribute)

    result = jsonify(result)
    return make_response(result, 200)


"""
Api: get simple filter result

Request:
    content_path (str)
    epoch (str)
    filter_type (str): "label", "prediction", "train", "test"
    filter_data (str): label name
Response:
    indices (list of int): indeices of samples that satisfy the filter
"""
@app.route('/getSimpleFilterResult', methods = ["POST"])
@cross_origin()
def get_simple_filter_result():
    req = request.get_json()
    content_path = req['content_path']
    epoch = int(req['epoch'])
    filters = req['filters']

    config = read_file_as_json(os.path.join(content_path, 'config.json'))
    indices, error_message = get_filter_result(config, content_path, epoch, filters)

    if indices is None:
        return make_response(jsonify({'error_message': error_message}), 400)

    result = jsonify({
        'indices': indices
    })
    return make_response(result, 200)


"""
Api: get background image

Request:
    content_path (str)
    vis_method (str)
    width (int)
    height (int)
    scale (list of float)
Response:
    background_image_base64 (str): base64 encoded im
"""    
@app.route('/getBackground', methods = ["POST"])
@cross_origin()
def get_background():
    req = request.get_json()
    content_path = req['content_path']
    vis_method = req['vis_method']
    width = int(req['width'])
    height = int(req['height'])
    epoch = int(req['epoch'])
    scale = req['scale']
    
    try:
        base64_image = paint_background(content_path, vis_method, epoch, width, height, scale)
        result = jsonify({
            'background_image_base64': base64_image
        })
        return make_response(result, 200)
    except Exception as e:
        return make_response(jsonify({'error_message': 'Error in loading background'}), 400)

"""
Api: get image data of one sample

Request:
    content_path (str)
    index (str): sample index
Response:
    image_base64 (str): base64 encoded image
"""
@app.route('/getImageData', methods = ["POST"])
@cross_origin()
def get_image_data():
    req = request.get_json()
    content_path = req['content_path']
    if('index' not in req):
        return make_response(jsonify({'image_base64': ''}), 200)
    
    index = req['index']

    config = read_file_as_json(os.path.join(content_path, 'config.json'))

    try:
        base64_image = load_one_image(config, content_path, index)
        result = jsonify({
            'image_base64': base64_image
        })
        return make_response(result, 200)
    except Exception as e:
        return make_response(jsonify({'error_message': 'Error in loading image'}), 400)


"""
Api: get all neighbors of one sample

Request:
    content_path (str)
    epoch (str)
Response:
    inClassNeighbors (array[][])
    outClassNeighbors (array[][])
"""
@app.route('/getAllNeighbors', methods = ["POST"])
@cross_origin()
def getAllNeighbors():
    req = request.get_json()
    content_path = req['content_path']
    epoch = int(req['epoch'])
    
    config = read_file_as_json(os.path.join(content_path, 'config.json'))
    
    try:
        inClassNeighbors, outClassNeighbors = calculateAllNeighbors(config, content_path, epoch)
        result = jsonify({
            'inClassNeighbors': inClassNeighbors,
            'outClassNeighbors': outClassNeighbors
        })
        return make_response(result, 200)
    except Exception as e:
        print(e)
        return make_response(jsonify({'error_message': 'Error in calculating neighbors'}), 400)
    

@app.route('/getLLMResponse', methods = ["POST"])
@cross_origin()
def getLLMResponse():
    req = request.get_json()
    input = req['input']
    try:
        result = call_llm_agent(input) # {"tool": "xxx", "output": "xxx"}
        return make_response(jsonify(result), 200)
    except Exception as e:
        print(e)
        return make_response(jsonify({'error_message': 'Error in calculating LLM'}), 400)


def check_port_inuse(port, host):
    import socket

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1)
        s.connect((host, port))
        return True
    except socket.error:
        return False
    finally:
        if s:
            s.close()

# for contrast
if __name__ == "__main__":
    host = '0.0.0.0'
    port = 5050
    while check_port_inuse(port, host):
        port = port + 1

    if not is_dev_mode:
        app.run(host=host, port=port)
    else:
        from livereload import Server
        from flask_debugtoolbar import DebugToolbarExtension

        app.debug = True
        app.config['SECRET_KEY'] = 'a-random-secret-key'
        toolbar = DebugToolbarExtension(app)

        server = Server(app.wsgi_app)

        server.watch('../frontend/**/*.css')
        server.watch('../frontend/**/*.html')
        server.watch('../frontend/**/*.js')
        server.serve(host=host, port=port)
