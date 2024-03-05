import numpy as np
import json


def main():
    datasets = ["mnist", "fmnist", "cifar10"]
    EXP_NUM = 20
    exps = list(range(EXP_NUM))

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
        print("\tTotal:\t{:.3f}".format(complex_con_time+training_time+seg_time))
        
        # DeepDebugger Random segments
        segments = list()
        complex_con_list = list()
        training_list = list()
        for exp in exps:
            eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/exp_{}/SV_time_tnn_hybrid.json".format(dataset, str(exp))
            with open(eval_path, "r") as f:
                eval = json.load(f)
            segments_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/exp_{}/segments.json".format(dataset, str(exp))
            with open(segments_path, "r") as f:
                segment = json.load(f)
            segments.append(len(segment))
            complex_con_list.append(sum(eval["complex_construction"].values()))
            training_list.append(sum(eval["training"].values()))
        print("Random Segments:")
        print("\tAverage segments:\t{}".format(sum(segments)/EXP_NUM))
        print("\tcomplex construction:\t{:.3f}".format(sum(complex_con_list)/EXP_NUM))
        print("\ttraining:\t{:.3f}".format(sum(training_list)/EXP_NUM))
        print("\tTotal:\t{:.3f}".format(sum(complex_con_list)/EXP_NUM+sum(training_list)/EXP_NUM))
        print("Worst Random:")
        total_time = np.array(complex_con_time)+np.array(training_list)
        id = np.argmax(total_time)
        print("\tSegments:\t{:.3f}".format(segments[id]))
        print("\tcomplex construction:\t{}".format(complex_con_list[id]))
        print("\ttraining:\t{:.3f}".format(training_list[id]))
        print("\tTotal:\t{:.3f}".format(total_time[id]))


if __name__ == "__main__":
    main()

