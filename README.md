# dataset download
you can download by https://huggingface.co/yvonne1123/trustvis_with_dataset
then you can store the dataset in /training_dynamic (default path)

# Training Dynamic

demo data store in /training_dynamic
# evaluate subject model


```
conda activate myvenv
python subject_model_eval.py
```
The trainig dynamic performance will be store in /training_dynamic/Model/subject_model_eval.json


# Run trustvis 
```
cd Trustvis
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
cd /Tool/backend/server
python server.py

# frontend
cd /Tool/frontend
we have the built version: down load url: https://drive.google.com/file/d/1MoGPYC6cO1Kxgsz3dVxf4cvRLfhqbz7X/view?usp=sharing 
unzip and use browser open /vz-projector/standalone.html

input content_path and backend ip
click login 
```