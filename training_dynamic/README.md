# Dataset Dir
```
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
│       │   └───labels (for non-classification task)
|       │       │ text_0.txt
|       │       │ text_1.txt
|       │       │ ...
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
```
# config.json template
An example for : model resnet18 and dataset cifar10
```
{
    "DVI": {
        "SETTING": "normal", // Defines the data setting mode
        "CLASSES": ["plane", "car", "bird", "cat", "deer", "dog", "frog", "horse", "ship", "truck"], // List of classes in the dataset
        "DATASET": "cifar10", // Name of the dataset being used
        "GPU": "0", // GPU ID for training
        "EPOCH_START": 1, // Starting epoch for training
        "EPOCH_END": 200, // Ending epoch for training
        "EPOCH_PERIOD": 1, // Interval between each epoch to log or save data
        "EPOCH_NAME":"Epoch", // Label for the epoch in logs or visualizations
        "TRAINING": { // For subject model
            "NET": "resnet18",   // Model architecture for training
            "loader_tr_args": {
                "batch_size": 128, // Batch size for training data
                "num_workers": 1 // Number of worker processes for training data loading
            },
            "loader_te_args": {
                "batch_size": 1000, // Batch size for test data
                "num_workers": 1 // Number of worker processes for test data loading
            },
            "optimizer_args": {
                "lr": 0.1, // Learning rate for the optimizer
                "momentum": 0.9, // Momentum for the optimizer
                "weight_decay": 0.0005 // Weight decay for regularization
            },
            "num_class": 10, // Number of classes in the dataset
            "train_num": 50000, // Number of training samples
            "test_num": 10000, // Number of test samples
            "milestone": [
                10 // Epochs at which to adjust the learning rate
            ]
        },
        "VISUALIZATION": { // For Visulization model
            "PREPROCESS": 1, // Indicator for preprocessing data (loading model and obtaining high-dimensional representations)
            "BOUNDARY": {
                "B_N_EPOCHS": 1, // Number of epochs to fit boundary samples per iteration
                "L_BOUND": 0.4 // Lower bound for selecting boundary samples
            },
            "BATCH_SIZE":1000, // Batch size for visualization process
            "LAMBDA1": 1.0, // Weight of reconstruction loss in the visualization model
            "LAMBDA2": 0.3, // Weight of temporal loss in the visualization model
            "ENCODER_DIMS": [512,256,256,256,256,2],  // Encoder architecture for the visualization model
            "DECODER_DIMS": [2,256,256,256,256,512],  // Decoder architecture for the visualization model
            "N_NEIGHBORS": 15, // Number of local neighbors for constructing the neighborhood graph
            "MAX_EPOCH": 20,  // Maximum number of epochs for training the visualization model
            "S_N_EPOCHS": 10, // Number of epochs for edge sampling in the complex construction process
            "PATIENT": 3, // Patience for early stopping, based on loss not improving
            "RESOLUTION": 300, // Resolution of the visualization canvas
            "VIS_MODEL_NAME": "dvi",  // Strategy name for the visualization model
            "EVALUATION_NAME": "evaluation_DVI" // File name for storing visualization model evaluations
        }
    }
}
```

```
