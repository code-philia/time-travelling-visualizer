
import os
import json

import numpy as np
import pandas as pd
import matplotlib as mpl
import seaborn as sns


def main():
    # hyperparameters
    datasets = ["mnist", "fmnist", "cifar10"]
    EXP_NUM = 20
    selected_epochs_dict = {"mnist":[[1,2], [10,13], [16,20]],"fmnist":[[1,6],[25,30],[36,50]], "cifar10":[[1,24], [70,100],[160,200]]}
    selected_epochs_dict = {"mnist":[[2], [10], [20]],"fmnist":[[6],[25],[50]], "cifar10":[[24], [100],[200]]}
    # start
    exps = list(range(EXP_NUM))
    col = np.array(["dataset", "method", "type", "hue", "period", "eval"])
    df = pd.DataFrame({}, columns=col)
    for i in range(len(datasets)): # dataset
        dataset = datasets[i]
        data = np.array([])
        selected_epochs = selected_epochs_dict[dataset]
        
        # DeepDebugger segments
        eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/test_evaluation_hybrid.json".format(dataset)
        with open(eval_path, "r") as f:
                eval = json.load(f)
        for epoch_id in range(3):
            stage_epochs = selected_epochs[epoch_id]
            inv_acc_train_list = list()
            inv_acc_test_list = list()
            for epoch in stage_epochs:
                ppr_train = round(eval["ppr_train"][str(epoch)], 3)
                ppr_test = round(eval["ppr_test"][str(epoch)], 3)
                inv_acc_train_list.append(ppr_train)
                inv_acc_test_list.append(ppr_test)
            ppr_train = sum(inv_acc_train_list)/len(inv_acc_train_list)
            ppr_test = sum(inv_acc_test_list)/len(inv_acc_test_list)

            if len(data) == 0:
                data = np.array([[dataset, "DeepDebugger", "Train", "DeepDebugger(Train)", "{}".format(str(epoch_id)), ppr_train]])
            else:
                data = np.concatenate((data, np.array([[dataset, "DeepDebugger", "Train", "DeepDebugger(Train)",  "{}".format(str(epoch_id)), ppr_train]])), axis=0)
            data = np.concatenate((data, np.array([[dataset, "DeepDebugger", "Test", "DeepDebugger(Test)",  "{}".format(str(epoch_id)), ppr_test]])), axis=0)
        
        # DeepDebugger Random segments
        for epoch_id in range(3):
            for exp in exps:
                eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/exp_{}/test_evaluation_hybrid.json".format(dataset, str(exp))
                with open(eval_path, "r") as f:
                        eval = json.load(f)
                stage_epochs = selected_epochs[epoch_id]
                ppr_train_list = list()
                ppr_test_list = list()
                for epoch in stage_epochs:
                    nn_train = round(eval["ppr_train"][str(epoch)], 3)
                    nn_test = round(eval["ppr_test"][str(epoch)], 3)

                    ppr_train_list.append(nn_train)
                    ppr_test_list.append(nn_test)
                nn_train = sum(ppr_train_list)/len(ppr_train_list)
                nn_test = sum(ppr_test_list)/len(ppr_test_list)

                data = np.concatenate((data, np.array([[dataset, "Random", "Train", "-OS(Train)", "{}".format(str(epoch_id)), nn_train]])), axis=0)
                data = np.concatenate((data, np.array([[dataset, "Random", "Test", "-OS(Test)", "{}".format(str(epoch_id)), nn_test]])), axis=0)

        df_tmp = pd.DataFrame(data, columns=col)
        df = df.append(df_tmp, ignore_index=True)
        df[["period"]] = df[["period"]].astype(int)
        df[["eval"]] = df[["eval"]].astype(float)

    df.to_excel("./plot_results/ablation_segment_ppr.xlsx")

    pal20c = sns.color_palette('tab20c', 20)
    sns.set_theme(style="whitegrid", palette=pal20c)
    hue_dict = {
        "-OS(Train)": pal20c[0],
        "DeepDebugger(Train)": pal20c[8],

        "-OS(Test)": pal20c[3],
        "DeepDebugger(Test)": pal20c[11],
    }
    sns.palplot([hue_dict[i] for i in hue_dict.keys()])

    axes = {'labelsize': 10,
            'titlesize': 10,}
    mpl.rc('axes', **axes)
    mpl.rcParams['xtick.labelsize'] = 10


    hue_list = ["-OS(Train)", "-OS(Test)", "DeepDebugger(Train)", "DeepDebugger(Test)"]

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
        kind="box",
        palette=[hue_dict[i] for i in hue_list],
        legend=True
    )
    sns.move_legend(fg, "lower center", bbox_to_anchor=(.42, 0.92), ncol=2, title=None, frameon=False)
    mpl.pyplot.setp(fg._legend.get_texts(), fontsize='10')

    axs = fg.axes[0]
    # max_ = df_tmp["eval"].max()
    # min_ = df["eval"].min()
    # axs[0].set_ylim(0., max_*1.1)
    axs[0].set_title("MNIST")
    axs[1].set_title("FMNIST")
    axs[2].set_title("CIFAR-10")

    (fg.despine(bottom=False, right=False, left=False, top=False)
        .set_xticklabels(['Early', 'Mid', 'Late'])
        .set_axis_labels("", "")
        )
    # fg.fig.suptitle("Prediction Preserving Rate")

    fg.savefig(
        "./plot_results/ablation_segment_ppr.png",
        dpi=300,
        bbox_inches="tight",
        pad_inches=0.0,
        transparent=True,
    )


if __name__ == "__main__":
    main()

