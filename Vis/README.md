# Training dynamic Visualization 

Our training dynamic visualization model now support both classification and non-classification tasks, after obtaining your own training dynamics, you can follow the tutorial to visualize it.

# Classification Training Dynamics

1. Modify model.py

For a classification task, your classification model can be divided into two parts: feature funtion and prediction funtion. The prediction funtion will be the last layer, and the feature function will include the first several layers of the model, you can refer to the following example to construct your own functions.
```
    def forward(self, x):
        x = self.conv1(x)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)

        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)

        x = self.avgpool(x)
        x = x.reshape(x.size(0), -1)
        x = self.fc(x)

        return x

    def feature(self, x):
        x = self.conv1(x)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)

        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)

        x = self.avgpool(x)
        x = x.reshape(x.size(0), -1)
        return x
    
    def prediction(self, x):
        x = self.fc(x)
        return x
```

2. Evaluate Subject Model
```
$ (visualizer) python subject_model_eval.py
$ (visualizer) ......

$ (visualizer) Successfully evaluated the subject model, and the results are saved in "your model path"/subject_model_eval.json
```

The trainig dynamic performance(testing accuracy and training accuracy) will be store in /training_dynamic/Model/subject_model_eval.json

3. Dataset Format

For information on the structure of the training dynamics directory, you can refer to the the [dataset's readme document](../training_dynamic/README.md), you need to store the model checkpoints and training sample index into the Model/Epoch_i directories, and move your modified model.py into the Model directory. Also, you can store your original data and label information into Training_data and Testing_data directories.

4. Configuration

For information on the structure of the config file format, refer to the the [dataset's readme document](./training_dynamic/README.md).

5. Train Your Training Dynamic Visualizer

- visualize the training process
```
$ cd Vis
$ conda activate visualizer
$ (visualizer) python trustvis_tempo.py --start "epoch start number" --end "epoch end number" --content_path "your dataset path"
```
the vis result will be store in /training_dynamic/trustvis_tempo/***.png
the evaluation result wiil be store in "your model path"/trustvis_tempo_eval.json

# Non-Classification Training Dynamics

1. Extract Data Features (high-dimensional representation)

For a non-classification task, the output of your training model will be the high-dimensional representations. For example, for the encoder-only model CodeBert, you can use the output of the encoder as your data's high-dimensional representation.

You need to extract the representations both for training data and testing data for every saved checkpoints of your training dynamic, and store them as Model/Epoch_i/train_data.npy and Model/Epoch_i/test_data.npy, respectively. Also, you need to generate index lists for training and testing data, and save them in Model/Epoch_i/index.json and Model/Epoch_i/test_index.json.

2. Dataset Format

For information on the structure of the training dynamics directory, you can refer to the the [dataset's readme document](../training_dynamic/README.md), you need to store the model checkpoints into the Model/Epoch_i directories. And you can store the text format label for every sample into Model/Epoch_i/labels directory. Also, you can store your original label information into Training_data and Testing_data directories.

3. Configuration

For information on the structure of the config file format, refer to the the [dataset's readme document](./training_dynamic/README.md).

4. Train Your Training Dynamic Visualizer

- visualize the training process
```
$ cd Vis
$ conda activate visualizer
$ (visualizer) python dvi_base_text.py --start "epoch start number" --end "epoch end number" --content_path "your dataset path"
```
It will generate the neccessary files for the visualization tool, and you can use our tool to observe your training dynamics in low dimension.
