# What is Time-Travelling Visualization?

# How to Use it?

## Pull Our Code
```
git clone https://github.com/code-philia/time-travelling-visualizer.git

```

```
The project structure looks as follow:

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

training_dynamic fold is for storing the dataset
Vis fold is for training the visualization models
visTool fold is the interactive visualization tool's backend and frontend



Note that, the training_dynamic folder stores the training process and the target dataset. 
We can download them as follows: https://huggingface.co/datasets/yvonne1123/training_dynamic


## Training Process Dataset (the training process of a model)

you can download by https://huggingface.co/datasets/yvonne1123/training_dynamic
then you can store the dataset in /training_dynamic (default path)


# Environment Configuration
```

cd Vis
conda create -n visualizer python=3.7
conda activate visualizer


```

# evaluate subject model
```
cd Vis
python subject_model_eval.py
```
The trainig dynamic performance will be store in /training_dynamic/Model/subject_model_eval.json

# Train Your Time-Travelling Visualizer


# Run Your Time-Travelling Visualizer

## Run Tool

```
# backend
cd /Tool/backend/server
python server.py

# frontend
cd /Tool/frontend
we have the built version: down load url: https://drive.google.com/file/d/1MoGPYC6cO1Kxgsz3dVxf4cvRLfhqbz7X/view?usp=sharing 
unzip and use browser open /vz-projector/standalone.html

input content_path and backend ip
click login 
```

## Run TrustVis
```
cd Vis
conda activate myvenv
# proxy only
python porxy.py --epoch num --content_path "dataset path"(default: /training_dynamic)

the vis result will be store in /training_dynamic/Proxy/***.png
the evaluation resulte wiil be store in /training_dynamic/Model/proxy_eval.json

# trustvis with AL
python active_learning.py  --epoch num --content_path "dataset path"(default: /training_dynamic)

the vis result will be store in /training_dynamic/Trust_al/***.png

the evaluation resulte wiil be store in /training_dynamic/Model/trustvis_al_eval.json

```

# Run Tool

```
# backend
cd /VisTool/Backend/server
python server.py

# frontend
cd /VisTool/frontend
we have the built version: down load url: https://drive.google.com/file/d/1MoGPYC6cO1Kxgsz3dVxf4cvRLfhqbz7X/view?usp=sharing 
unzip and use browser open /vz-projector/standalone.html

input content_path and backend ip
click login 
```
