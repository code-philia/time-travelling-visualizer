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
python vis.py --content_path "your dataset path" --epoch "the number of the epoch"

the vis result will be store in /training_dynamic/Vis/***.png
the evaluation resulte wiil be store in /training_dynamic/Model/vis_eval.json


```