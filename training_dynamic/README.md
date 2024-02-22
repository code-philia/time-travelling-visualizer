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
|   │   trustvis_tempo.py 
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

# Dataset Dir

data(input path)
│   index.json(optional, for nosiy model)
│   new_labels.json(optional, for nosiy model) 
│   old_labels.json(optional, for nosiy model)
|
└─── sprites
│    │ 0.png
│    │ 1.png
│    │ ...
│
└───Model
│   │   model.py
│   │
│   └───Epoch_1
│       │   index.json
│       │   subject_model.pth
|       |   (train_data.npy)     [after preprocess]
|       |   (test_data.npy)      [after preprocess]
|       |   (border_centers.npy) [after preprocess]
|       |   (vismodel.pth)       [after trained]
|       |   (embedding.npy)      [after visulization]
|       |   (scale.npy)          [after visulization]
|       |   (bgimg.png)          [after visulization]
│   └───Epoch_2
|       |   ...
│   
└───Training_data
|   │   training_dataset_data.pth
|   │   training_dataset_label.pth
│   
└───Testing_data
│   │   testing_dataset_data.pth
│   │   testing_dataset_label.pth

└───config.json

# config.json template
An example for : model resnet18 and dataset cifar10
```
{
    "DVI": {
        "SETTING": "normal",
        "CLASSES": ["plane", "car", "bird", "cat", "deer", "dog", "frog", "horse", "ship", "truck"], 
        "DATASET": "cifar10",
        "GPU": "0",
        "EPOCH_START": 1,
        "EPOCH_END": 200,
        "EPOCH_PERIOD": 1,
        "EPOCH_NAME":"Epoch",
        "TRAINING": {
            "NET": "resnet18",
            "loader_tr_args": {
                "batch_size": 128,
                "num_workers": 1
            },
            "loader_te_args": {
                "batch_size": 1000,
                "num_workers": 1
            },
            "optimizer_args": {
                "lr": 0.1,
                "momentum": 0.9,
                "weight_decay": 0.0005
            },
            "num_class": 10,
            "train_num": 50000,
            "test_num": 10000,
            "milestone": [
                10
            ]
        },
        "VISUALIZATION": {
            "PREPROCESS": 1,
            "BOUNDARY": {
                "B_N_EPOCHS": 1,
                "L_BOUND": 0.4
            },
            "BATCH_SIZE":1000,
            "LAMBDA1": 1.0,
            "LAMBDA2": 0.3,
       
            "ENCODER_DIMS_O": [512,256,256,256,256,2],
            "DECODER_DIMS_O": [2,256,256,256,256,512],
            "ENCODER_DIMS": [512,256,256,256,256,2],
            "DECODER_DIMS": [2,256,256,256,256,512],
            "N_NEIGHBORS": 15,
            "MAX_EPOCH": 20,
            "S_N_EPOCHS": 10,
            "PATIENT": 3,
            "RESOLUTION": 300,
            "VIS_MODEL_NAME": "dvi",
            "FLAG": "_temporal_id_withoutB",
            "EVALUATION_NAME": "evaluation_tfDVI"
        }
    }
}

```
