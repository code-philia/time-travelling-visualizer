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

conda activate deepdebugger
# proxy only
python proxy.py --epoch 1/2/3 (default 3)

the vis result will be store in /training_dynamic/Proxy/***.png
the evaluation resulte wiil be store in /training_dynamic/Model/proxy_eval.json

# trustvis with AL
python active_learning.py  --epoch 1/2/3 (default 3)

the vis result will be store in /training_dynamic/Trust_al/***.png

the evaluation resulte wiil be store in /training_dynamic/Model/trustvis_al_eval.json

```