import os
import json

import numpy as np
import pandas as pd
import matplotlib as mpl
import seaborn as sns


def main():
    datasets = ["mnist","fmnist"]
    selected_epochs_dict = {"mnist":[[1], [10], [15]],"fmnist":[[1],[25],[50]], "cifar10":[[1], [100],[199]]}
    col = np.array(["dataset", "method", "type", "hue", "period", "eval"])
    df = pd.DataFrame({}, columns=col)

    for i in range(len(datasets)): # dataset
        dataset = datasets[i]
        data = np.array([])
        selected_epochs = selected_epochs_dict[dataset]
        # load data from evaluation.json
        content_path = "/home/xianglin/projects/DVI_data/resnet18_{}".format(dataset)
        for epoch_id in range(3):
            stage_epochs = selected_epochs[epoch_id]
            inv_acc_train_list = list()
            inv_acc_test_list = list()
            for epoch in stage_epochs:

                eval_path = os.path.join(content_path, "Model", "Epoch_{}".format(epoch), "evaluation_id_parametricUmap_step2.json")
                with open(eval_path, "r") as f:
                    eval = json.load(f)
                inv_acc_train = round(eval["inv_acc_train"], 3)
                inv_acc_test = round(eval["inv_acc_test"], 3)
                inv_acc_train_list.append(inv_acc_train)
                inv_acc_test_list.append(inv_acc_test)
            
            inv_acc_train = sum(inv_acc_train_list)/len(inv_acc_train_list)
            inv_acc_test = sum(inv_acc_test_list)/len(inv_acc_test_list)

            if len(data)==0:
                data = np.array([[dataset, "DVI", "Train", "DVI(Train)", "{}".format(str(epoch_id)), inv_acc_train]])
            else:
                data = np.concatenate((data, np.array([[dataset, "DVI", "Train", "DVI(Train)", "{}".format(str(epoch_id)), inv_acc_train]])), axis=0)
            data = np.concatenate((data, np.array([[dataset, "DVI", "Test", "DVI(Test)", "{}".format(str(epoch_id)), inv_acc_test]])), axis=0)
        
        # torch dvi
        eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/evaluation_singleDVI.json".format(dataset)
        with open(eval_path, "r") as f:
                eval = json.load(f)
        for epoch_id  in range(3):
            stage_epochs = selected_epochs[epoch_id]
            ppr_train_list = list()
            ppr_test_list = list()
            for epoch in stage_epochs:
                ppr_train = round(eval["ppr_train"][str(epoch)], 3)
                ppr_test = round(eval["ppr_test"][str(epoch)], 3)
                ppr_train_list.append(ppr_train)
                ppr_test_list.append(ppr_test)
            ppr_train = sum(ppr_train_list)/len(ppr_train_list)
            ppr_test = sum(ppr_test_list)/len(ppr_test_list)

            data = np.concatenate((data, np.array([[dataset, "torch-DVI", "Train", "torch-DVI(Train)",  "{}".format(str(epoch_id)), ppr_train]])), axis=0)
            data = np.concatenate((data, np.array([[dataset, "torch-DVI", "Test", "torch-DVI(Test)", "{}".format(str(epoch_id)), ppr_test]])), axis=0)
        
        eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/test_evaluation_tnn_noB.json".format(dataset)
        with open(eval_path, "r") as f:
                eval = json.load(f)
        for epoch_id  in range(3):
            stage_epochs = selected_epochs[epoch_id]
            ppr_train_list = list()
            ppr_test_list = list()
            for epoch in stage_epochs:
                ppr_train = round(eval["ppr_train"][str(epoch)], 3)
                ppr_test = round(eval["ppr_test"][str(epoch)], 3)
                ppr_train_list.append(ppr_train)
                ppr_test_list.append(ppr_test)
            ppr_train = sum(ppr_train_list)/len(ppr_train_list)
            ppr_test = sum(ppr_test_list)/len(ppr_test_list)

            data = np.concatenate((data, np.array([[dataset, "TimeVis", "Train", "TimeVis(Train)",  "{}".format(str(epoch_id)), ppr_train]])), axis=0)
            data = np.concatenate((data, np.array([[dataset, "TimeVis", "Test", "TimeVis(Test)", "{}".format(str(epoch_id)), ppr_test]])), axis=0)
        
        eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/evaluation_dd_noB.json".format(dataset)
        with open(eval_path, "r") as f:
                eval = json.load(f)
        for epoch_id  in range(3):
            stage_epochs = selected_epochs[epoch_id]
            ppr_train_list = list()
            ppr_test_list = list()
            for epoch in stage_epochs:
                ppr_train = round(eval["ppr_train"][str(epoch)], 3)
                ppr_test = round(eval["ppr_test"][str(epoch)], 3)
                ppr_train_list.append(ppr_train)
                ppr_test_list.append(ppr_test)
            ppr_train = sum(ppr_train_list)/len(ppr_train_list)
            ppr_test = sum(ppr_test_list)/len(ppr_test_list)

            data = np.concatenate((data, np.array([[dataset, "DD", "Train", "DD(Train)",  "{}".format(str(epoch_id)), ppr_train]])), axis=0)
            data = np.concatenate((data, np.array([[dataset, "DD", "Test", "DD(Test)", "{}".format(str(epoch_id)), ppr_test]])), axis=0)

        df_tmp = pd.DataFrame(data, columns=col)
        df = df.append(df_tmp, ignore_index=True)
        df[["period"]] = df[["period"]].astype(int)
        # df[["k"]] = df[["k"]].astype(int)
        df[["eval"]] = df[["eval"]].astype(float)

    df.to_excel("./plot_results/PPR.xlsx")

    pal20c = sns.color_palette('tab20', 20)
    sns.set_theme(style="whitegrid", palette=pal20c)
    hue_dict = {
        "DVI(Train)": pal20c[4],
        "torch-DVI(Train)":pal20c[10],
        "TimeVis(Train)": pal20c[6],
        "DD(Train)": pal20c[8],

        "DVI(Test)": pal20c[5],
        "torch-DVI(Test)": pal20c[11],
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
        data=df,
        kind="bar",
        palette=[hue_dict[i] for i in hue_list],
        legend=True
    )
    sns.move_legend(fg, "lower center", bbox_to_anchor=(.43, 0.92), ncol=4, title=None, frameon=False)
    mpl.pyplot.setp(fg._legend.get_texts(), fontsize='15')

    axs = fg.axes[0]
    max_ = df["eval"].max()
    # min_ = df["eval"].min()
    axs[0].set_ylim(0., max_*1.1)
    # axs[0].set_title("MNIST(20)")
    # axs[1].set_title("FMNIST(50)")
    # axs[2].set_title("CIFAR-10(200)")

    (fg.despine(bottom=False, right=False, left=False, top=False)
     .set_xticklabels(['Early', 'Mid','Late'])
     .set_axis_labels("", "")
     )
    # fg.fig.suptitle("Prediction Preserving property")

    fg.savefig(
        "./plot_results/noB_inv_accu.png",
        dpi=300,
        bbox_inches="tight",
        pad_inches=0.0,
        transparent=True,
    )



if __name__ == "__main__":
    main()

