
import os
import json

import numpy as np
import pandas as pd
import matplotlib as mpl
import seaborn as sns


def main():
    datasets = ["mnist", "fmnist", "cifar10"]

    for i in range(len(datasets)): # dataset
        dataset = datasets[i]
        print("##############################################")
        print("  #                 [{}]                #".format(dataset))
        print("##############################################")
        
        # DeepDebugger segments
        eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/SV_time_tnn_hybrid.json".format(dataset)
        with open(eval_path, "r") as f:
            eval = json.load(f)
        seg_time = round(eval["segment"], 3)
        complex_con_time = round(sum(eval["complex_construction"].values()), 3)
        training_time = round(sum(eval["training"].values()), 3)
        print("DeepDebugger Segments:")
        print("\tsegment time:\t{:.3f}".format(seg_time))
        print("\tcomplex construction:\t{:.3f}".format(complex_con_time))
        print("\ttraining:\t{:.3f}".format(training_time))
        print("\tTotal:\t{:.3f}".format(complex_con_time+training_time))
        
        # DeepDebugger without smoothness
        eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/without_smoothness/SV_time_tnn_hybrid.json".format(dataset)
        with open(eval_path, "r") as f:
            eval = json.load(f)
        seg_time = round(eval["segment"], 3)
        complex_con_time = round(sum(eval["complex_construction"].values()), 3)
        training_time = round(sum(eval["training"].values()), 3)

        print("Without Smoothness Segments:")
        print("\tsegment time:\t{:.3f}".format(seg_time))
        print("\tcomplex construction:\t{:.3f}".format(complex_con_time))
        print("\ttraining:\t{:.3f}".format(training_time))
        print("\tTotal:\t{:.3f}".format(complex_con_time+training_time))

        # DeepDebugger without smoothness
        eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/without_tl/SV_time_tnn_hybrid.json".format(dataset)
        with open(eval_path, "r") as f:
            eval = json.load(f)
        seg_time = round(eval["segment"], 3)
        complex_con_time = round(sum(eval["complex_construction"].values()), 3)
        training_time = round(sum(eval["training"].values()), 3)

        print("Without Transfer Learning Segments:")
        print("\tsegment time:\t{:.3f}".format(seg_time))
        print("\tcomplex construction:\t{:.3f}".format(complex_con_time))
        print("\ttraining:\t{:.3f}".format(training_time))
        print("\tTotal:\t{:.3f}".format(complex_con_time+training_time))


if __name__ == "__main__":
    main()

