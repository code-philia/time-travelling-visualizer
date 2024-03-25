# evaluate subject model
```
$ (visualizer) python subject_model_eval.py
$ (visualizer) ......

$ (visualizer) Successfully evaluated the subject model, and the results are saved in "your model path"/subject_model_eval.json
```

The trainig dynamic performance(testing accuracy and training accuracy) will be store in /training_dynamic/Model/subject_model_eval.json

# Train Your Time-Travelling Visualizer
- visualize the training process
```
$ cd Vis
$ conda activate visualizer
$ (visualizer) python trustvis_tempo.py --start "epoch start number" --end "epoch end number" --content_path "your dataset path"
```
the vis result will be store in /training_dynamic/trustvis_tempo/***.png
the evaluation result wiil be store in "your model path"/trustvis_tempo_eval.json

<!-- - visualization without prediction sementics
```
$ cd Vis
$ conda activate visualizer
$ (visualizer) python vis_snapshot.py--start "epoch start number" --end "epoch end number" --content_path "your dataset path"
``` -->