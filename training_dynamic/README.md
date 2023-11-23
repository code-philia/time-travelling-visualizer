# Dataset Dir

data(input path)
│   index.json(optional, for nosiy model)
│   new_labels.json(optional, for nosiy model) 
│   old_labels.json(optional, for nosiy model)
|
└───Model
│   │   model.py
│   │
│   └───Epoch_1
│       │   index.json
│       │   subject_model.pth
|       |   (train_data.npy)
|       |   (test_data.npy)
|       |   (border_centers.npy)
|       |   (encoder)
|       |   (decoder)
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
