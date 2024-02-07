# What is Trustvis?
![Alt text](overview_2.png)
# How To Use it?
## Environment Configuration
1. create conda environment
```
$ cd Vis
$ conda create -n trustvis python=3.7
$ (trustvis) conda activate visualizer
```

2. install pyTorch and CUDA
For setting up PyTorch on that conda environment, use the guidelines provided at [PyTorch's official local installation page](https://pytorch.org/get-started/locally/). This guide will help you select the appropriate configuration based on your operating system, package manager, Python version, and CUDA version.

3. install requirements
```
$ (trustvis) pip install -r requirements.txt
```


## evaluate subject model

```
$ conda activate trustvis
$(trustvis) python subject_model_eval.py
```
The trainig dynamic performance will be store in /training_dynamic/Model/subject_model_eval.json


## Run trustvis 
```
$ cd trustvis
```
### train baseline visualization model
```
$ conda activate trustvis
$(trustvis) python base.py --epoch epoch_num --content_path training_dynamic folder's path
```
- the vis model will be store in /training_dynamic/Model/Epoch_{epoch_number}/base.pth
- the vis result will be store in /training_dynamic/Base/***.png
- the evaluation resulte wiil be store in /training_dynamic/Model/base_eval.json

### train proxy only visualization model(for ablation study)
```
$(trustvis) proxy.py --epoch epoch_num --content_path training_dynamic folder's path
```
- the vis model will be store in /training_dynamic/Model/Epoch_{epoch_number}/proxy.pth
- the vis result will be store in /training_dynamic/Proxy/***.png
- the evaluation resulte wiil be store in /training_dynamic/Model/proxy_eval.json

### train active learning only visualization model(for ablation study)
⚠️ proxy only visualization model should be trained and saved
```
$(trustvis) al_base.py --epoch epoch_num --content_path training_dynamic folder's path
```
- the vis model will be store in /training_dynamic/Model/Epoch_{epoch_number}/al_base.pth
- the vis result will be store in /training_dynamic/al_base/***.png
- the evaluation resulte wiil be store in /training_dynamic/Model/al_base_eval.json
### train trustvis(proxy based + active learning)
⚠️ proxy only visualization model should be trained and saved
```
$(trustvis) al_proxy.py --epoch epoch_num --content_path training_dynamic folder's path
```
- the vis model will be store in /training_dynamic/Model/Epoch_{epoch_number}/trustvis.pth
- the vis result will be store in /training_dynamic/Trust_al/***.png
- the evaluation resulte wiil be store in /training_dynamic/Model/trustvis_al_eval.json