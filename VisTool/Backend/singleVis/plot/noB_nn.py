
import argparse
import os
import json

import numpy as np
import pandas as pd
import matplotlib as mpl
import seaborn as sns


def main():
    datasets = ["mnist","fmnist","cifar10"]
    datasets = ["mnist","fmnist"]
    selected_epochs_dict = {"mnist":[[1], [10], [15]],"fmnist":[[1],[25],[50]], "cifar10":[[1], [100],[199]]}
    k_neighbors = [15]
    col = np.array(["dataset", "method", "type", "hue", "k", "period", "eval"])
    df = pd.DataFrame({}, columns=col)

    for k in k_neighbors: # k neighbors
        for i in range(len(datasets)): # dataset
            dataset = datasets[i]
            data = np.array([])
            selected_epochs = selected_epochs_dict[dataset]
            # load data from evaluation.json
            # DVI
            content_path = "/home/xianglin/projects/DVI_data/resnet18_{}".format(dataset)
            for epoch_id in range(3):
                stage_epochs = selected_epochs[epoch_id]
                nn_train_list = list()
                nn_test_list = list()
                for epoch in stage_epochs:
                    eval_path = os.path.join(content_path, "Model", "Epoch_{}".format(epoch), "evaluation_id_parametricUmap_step2.json")
                    with open(eval_path, "r") as f:
                        eval = json.load(f)
                    nn_train = round(eval["nn_train_{}".format(k)], 3)
                    nn_test = round(eval["nn_test_{}".format(k)], 3)

                    nn_train_list.append(nn_train)
                    nn_test_list.append(nn_test)
                
                nn_train = sum(nn_train_list)/len(nn_train_list)
                nn_test = sum(nn_test_list)/len(nn_test_list)

                if len(data) == 0:
                    data = np.array([[dataset, "DVI", "Train", "DVI(Train)", "{}".format(k), "{}".format(str(epoch_id)), nn_train]])
                else:
                    data = np.concatenate((data, np.array([[dataset, "DVI", "Train", "DVI(Train)", "{}".format(k), "{}".format(str(epoch_id)), nn_train]])), axis=0)
                data = np.concatenate((data, np.array([[dataset, "DVI", "Test", "DVI(Test)", "{}".format(k), "{}".format(str(epoch_id)), nn_test]])), axis=0)
            

            # pytorch DVI
            eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/evaluation_singleDVI.json".format(dataset)
            with open(eval_path, "r") as f:
                    eval = json.load(f)
            for epoch_id in range(3):
                stage_epochs = selected_epochs[epoch_id]
                nn_train_list = list()
                nn_test_list = list()
                for epoch in stage_epochs:
                    nn_train = round(eval["nn_train"][str(epoch)][str(k)], 3)
                    nn_test = round(eval["nn_test"][str(epoch)][str(k)], 3)

                    nn_train_list.append(nn_train)
                    nn_test_list.append(nn_test)
                
                nn_train = sum(nn_train_list)/len(nn_train_list)
                nn_test = sum(nn_test_list)/len(nn_test_list)

                data = np.concatenate((data, np.array([[dataset, "torch-DVI", "Train", "torch-DVI(Train)", "{}".format(k), "{}".format(str(epoch_id)), nn_train]])), axis=0)
                data = np.concatenate((data, np.array([[dataset, "torch-DVI", "Test", "torch-DVI(Test)", "{}".format(k), "{}".format(str(epoch_id)), nn_test]])), axis=0)


            eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/test_evaluation_tnn_noB.json".format(dataset)
            with open(eval_path, "r") as f:
                    eval = json.load(f)
            for epoch_id  in range(3):
                stage_epochs = selected_epochs[epoch_id]
                nn_train_list = list()
                nn_test_list = list()
                for epoch in stage_epochs:
                    nn_train = round(eval[str(k)]["nn_train"][str(epoch)], 3)
                    nn_test = round(eval[str(k)]["nn_test"][str(epoch)], 3)

                    nn_train_list.append(nn_train)
                    nn_test_list.append(nn_test)
                
                nn_train = sum(nn_train_list)/len(nn_train_list)
                nn_test = sum(nn_test_list)/len(nn_test_list)

                data = np.concatenate((data, np.array([[dataset, "TimeVis", "Train", "TimeVis(Train)", "{}".format(k), "{}".format(str(epoch_id)), nn_train]])), axis=0)
                data = np.concatenate((data, np.array([[dataset, "TimeVis", "Test", "TimeVis(Test)", "{}".format(k), "{}".format(str(epoch_id)), nn_test]])), axis=0)
            
            eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/evaluation_dd_noB.json".format(dataset)
            with open(eval_path, "r") as f:
                    eval = json.load(f)
            for epoch_id  in range(3):
                stage_epochs = selected_epochs[epoch_id]
                nn_train_list = list()
                nn_test_list = list()
                for epoch in stage_epochs:
                    nn_train = round(eval["nn_train"][str(epoch)][str(k)], 3)
                    nn_test = round(eval["nn_test"][str(epoch)][str(k)], 3)

                    nn_train_list.append(nn_train)
                    nn_test_list.append(nn_test)
                
                nn_train = sum(nn_train_list)/len(nn_train_list)
                nn_test = sum(nn_test_list)/len(nn_test_list)

                data = np.concatenate((data, np.array([[dataset, "DD", "Train", "DD(Train)", "{}".format(k), "{}".format(str(epoch_id)), nn_train]])), axis=0)
                data = np.concatenate((data, np.array([[dataset, "DD", "Test", "DD(Test)", "{}".format(k), "{}".format(str(epoch_id)), nn_test]])), axis=0)


            df_tmp = pd.DataFrame(data, columns=col)
            df = df.append(df_tmp, ignore_index=True)
            df[["period"]] = df[["period"]].astype(int)
            df[["k"]] = df[["k"]].astype(int)
            df[["eval"]] = df[["eval"]].astype(float)

    df.to_excel("./plot_results/nn.xlsx")

    for k in k_neighbors:
        df_tmp = df[df["k"] == k]
        pal20c = sns.color_palette('tab20', 20)
        sns.set_theme(style="whitegrid", palette=pal20c)
        hue_dict = {
            "DVI(Train)": pal20c[4],
            "torch-DVI(Train)": pal20c[10],
            "TimeVis(Train)": pal20c[6],
            "DD(Train)": pal20c[8],

            "DVI(Test)": pal20c[5],
            "torch-DVI(Test)":pal20c[11],
            "TimeVis(Test)": pal20c[7],
            "DD(Test)": pal20c[9],
        }
        sns.palplot([hue_dict[i] for i in hue_dict.keys()])

        axes = {'labelsize': 15,
                'titlesize': 15,}
        mpl.rc('axes', **axes)
        mpl.rcParams['xtick.labelsize'] = 15

        hue_list = ["DVI(Train)", "DVI(Test)", "torch-DVI(Train)", "torch-DVI(Test)", "TimeVis(Train)", "TimeVis(Test)", "DD(Train)", "DD(Test)"]

        fg = sns.catplot(
            x="period",
            y="eval",
            hue="hue",
            hue_order=hue_list,
            # order = [1, 2, 3, 4, 5],
            # row="method",
            col="dataset",
            ci=0.001,
            height=2.5, #2.65,
            aspect=1.0,#3,
            data=df_tmp,
            kind="bar",
            palette=[hue_dict[i] for i in hue_list],
            legend=True
        )
        sns.move_legend(fg, "lower center", bbox_to_anchor=(.42, 0.92), ncol=4, title=None, frameon=False)
        mpl.pyplot.setp(fg._legend.get_texts(), fontsize='15')

        axs = fg.axes[0]
        # max_ = df_tmp["eval"].max()
        # min_ = df["eval"].min()
        # axs[0].set_ylim(0., max_*1.1)
        # axs[0].set_title("MNIST(20)")
        # axs[1].set_title("FMNIST(50)")
        # axs[2].set_title("CIFAR-10(200)")

        (fg.despine(bottom=False, right=False, left=False, top=False)
         .set_xticklabels(['Early', 'Mid', 'Late'])
         .set_axis_labels("", "")
         )
        # fg.fig.suptitle("NN preserving property")
        fg.savefig(
            "./plot_results/noB_nn_{}.png".format(k),
            dpi=300,
            bbox_inches="tight",
            pad_inches=0.0,
            transparent=True,
        )


if __name__ == "__main__":
    main()

