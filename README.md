# What is Time-Travelling Visualization?
Time-Travelling Visualization, a technique designed to visualize high-dimensional representations during the deep learning training process. In other words, our method is designed to transform the model training dynamics into an animation of canvas with colorful dots and territories.


![ The results of our visualization technique for the image classifier training process from epoch10 to epoch200](image.png)
# How to Use it?

## Pull Our Code
```
git clone https://github.com/code-philia/time-travelling-visualizer.git
```

The project structure looks as follow:
```
time-travelling-visualizer
│   README.md
|
└───training_dynamic
│   │   README.md
    
│   
└───Vis
|   │   singleVis | ...
|   │   trustvis  | ...
|   │   subject_model_eval.py
|   │   proxy.py
|   │   active_learning.py
|   │   requirements.txt
|   
│   
└───VisTool
│   │   Backend
│   |   |    ...
│   |   |    server
│   |   |    |   server.py
│   |   |    ...
│   │   Frontend
│   |   |    ...
│   |   |    tensorboard
│   |   |    |   projector | ...
│   |   |    ...
└───
```

- training_dynamic fold is for storing the dataset
- Vis fold is for training the visualization models
- visTool fold is the interactive visualization tool's backend and frontend



⚠️ Note that, the training_dynamic folder stores the training process and the target dataset. 
We can download them as follows: https://huggingface.co/datasets/yvonne1123/training_dynamic


## Training Process Dataset (the training process of a model)

you can download by https://huggingface.co/datasets/yvonne1123/training_dynamic
then you can store the dataset in /training_dynamic (default path)


# Environment Configuration
```

$ cd Vis
$ conda create -n visualizer python=3.7
$ (visualizer) conda activate visualizer
$ (visualizer) pip install -r requirements.txt

```

# evaluate subject model
```
$ (visualizer) pip install -r requirements.txt
$ (visualizer) python subject_model_eval.py
```
The trainig dynamic performance(testing accuracy and training accuracy) will be store in /training_dynamic/Model/subject_model_eval.json

# Train Your Time-Travelling Visualizer
```
$ cd Vis
$ conda activate visualizer
# proxy only
$ (visualizer) python porxy.py --epoch epoch_number(default 3) --content_path "dataset path"(default: /training_dynamic)

# the vis result will be store in /training_dynamic/Proxy/***.png
# the evaluation resulte wiil be store in /training_dynamic/Model/proxy_eval.json

# trustvis with AL
$ (visualizer)  python active_learning.py  --epoch num --content_path "dataset path"(default: /training_dynamic)

# the vis result will be store in /training_dynamic/Trust_al/***.png
# the evaluation resulte wiil be store in /training_dynamic/Model/trustvis_al_eval.json

```

# Run Your interactive Visualizer Tool
![Interactive Visualizer Tool](screenshot.png)
## backend
```
cd /VisTool/backend/server
python server.py
```


## frontend (Option1: download built package)
we have the built version: 
1. download url: https://drive.google.com/file/d/1MoGPYC6cO1Kxgsz3dVxf4cvRLfhqbz7X/view?usp=sharing 
2. unzip and use browser open /vz-projector/standalone.html
3. input content_path(training dynamic dataset path) and backend ip:port(default:localhost:5000)
4. click login 


## frontend (Option2: build frontend by yourself)

1. download bazel:https://bazel.build/install  (recommend version 3.2.0)
2. check whether installation successful
```
> bazel version
3.2.0
```
3. run frontend
```
cd /VisTool/Frontend
bazel run tensorboard/projector:standalone

```
4. open http://localhost:6006/standalone.html

