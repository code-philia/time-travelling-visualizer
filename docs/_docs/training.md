---
title: Get Training Dynamic
permalink: /docs/training/
---

In this section, we will delve into the advanced aspects of the tools, focusing on how to train visualization models tailored to your own training processes and how to utilize these tools for visualization purposes.

> This is an unfinished version that requires users to make numerous manual adjustments. A more automated version may be released in the future.

#### Preparations

Assuming the root directory of the training process is `content_path`, the following files and directory structure should be saved before training the visualization model (i.e., the visualization model does not generate these files):

1. **Subject model**
- **Location**: `content_path/model/{epoch}.pth`
- **Description**: The target model, saved in the `model` directory. The model files for different `epochs` are named as `1.pth`, `2.pth`, `3.pth`, etc.

2. **Representation**
- **Location**: `content_path/dataset/representation/{epoch}.npy`
- **Description**: A high-dimensional feature representation of the samples, saved in the `dataset/representation` directory. Files for different `epochs` are named as `1.npy`, `2.npy`, `3.npy`, etc. Each file contains a numpy array with the shape `[number of samples, feature dimensions]`.

3. **Prediction**
- **Location**: `content_path/dataset/prediction/{epoch}.npy`
- **Description**: The raw output of the samples from the original model, saved in the `dataset/prediction` directory. Files for different `epochs` are named as `1.npy`, `2.npy`, `3.npy`, etc. Each file contains a numpy array with the shape `[number of samples, number of classes]`, representing the output scores for each sample. For example, if there are 10 classes, each sample will have 10 scores.

4. **Label**
- **Location**: `content_path/dataset/label/labels.npy`
- **Description**: The correct labels of the samples, saved in the `dataset/label` directory, named as `labels.npy`. The file contains a numpy array with the shape `[number of samples]`, representing the label for each sample as a list of integers.

5. **Index** (Optional)
- **Location**: `content_path/index.json`
- **Description**: If you need to split the data into training and testing sets, create an `index.json` file in the `content_path` directory. This file can be used to define the split of training and test samples.


#### Training the Visualizer Model

After preparing the above data, clone the repository:

```bash
git clone https://github.com/code-philia/time-travelling-visualizer.git
git checkout feat/visactor
```

Navigate to the `visualize` directory and execute the main.py script, providing the arguments `content_path` and `vis_method`. Please note that some parameters within main.py may require manual adjustments:
<img src="{{ "/assets/img/image.png" | relative_url }}" alt="image" class="img-responsive">

Furthermore, depending on the high-dimensional features, the parameters of the visualization model also need to be adjusted. In the `visualize/params.json` file, at least the maximum dimensions in ENCODER_DIMS and DECODER_DIMS need to be modified. As in the example below, where it is 512, this maximum dimension corresponds to the feature's dimension, while the remaining dimensions (here both are 256) should ideally decrease smoothly, ensuring the minimum dimension is 2.
```
{
    "DVI": {
				...
        "ENCODER_DIMS": [
            512,
            256,
            256,
            256,
            256,
            2
        ],
        "DECODER_DIMS": [
            2,
            256,
            256,
            256,
            256,
            512
        ],
        ...
    },
    "TimeVis": {
        ...
        "ENCODER_DIMS": [
            512,
            256,
            256,
            256,
            256,
            2
        ],
        "DECODER_DIMS": [
            2,
            256,
            256,
            256,
            256,
            512
        ],
        ...
    }
}
```
You can also set it to `[512, 256, 256, 64, 32, 2]`.

The rest in `visualize/params.json` are visualization parameters, which can be adjusted as needed.

```bash
cd visualize
python main.py -p /home/kwy/project/time-travelling-visualizer/training_dynamic/ResNet30-Cifar10 -m DVI
```
-p: content path, root folder of the training process.
-m: visualize method, currently supports DVI and TimeVis.


#### Run the Tool and Load Visualization Results
After training the visualization model(the visualization results will also be generated), the training process folder will look like:
```
content_path
    ├─dataset
    │  ├─label
    │  ├─prediction // for classification
    │  └─representation
    ├─model         // subject model
    └─visualize
        ├─DVI
        │   ├─bgimg // for classification
        │   ├─projection
        │   └─scale // for classification
        └─TimeVis
            ├─bgimg // for classification
            ├─projection
            └─scale // for classification
```
Follow the instructions in the last section of **Setup & Quickstart** to operate the tool and load the visualization results.