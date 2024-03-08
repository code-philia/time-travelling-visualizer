
import os
import json

import numpy as np
import pandas as pd
import matplotlib as mpl
import seaborn as sns


def main():

    # hyperparameters
    dataset = "cifar10"
    EXP_NUM = 20
    selected_epochs=[24, 100,200]
    k=15
    exps = list(range(EXP_NUM))
    col = np.array(["metric", "method", "hue", "period", "eval"])
    data = np.array([])
    
    # NN
    metric = "NN"
    # DeepDebugger segments
    eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/test_evaluation_hybrid.json".format(dataset)
    with open(eval_path, "r") as f:
            eval = json.load(f)
    for epoch_id in range(3):
        epoch = selected_epochs[epoch_id]
        nn_train = round(eval["nn_train"][str(epoch)][str(k)], 3)
        nn_test = round(eval["nn_test"][str(epoch)][str(k)], 3)

        if len(data) == 0:
            data = np.array([[metric, "DeepDebugger",  "DeepDebugger(Train)",  "{}".format(str(epoch_id)), nn_train]])
        else:
            data = np.concatenate((data, np.array([[metric, "DeepDebugger", "DeepDebugger(Train)", "{}".format(str(epoch_id)), nn_train]])), axis=0)
        data = np.concatenate((data, np.array([[metric, "DeepDebugger", "DeepDebugger(Test)", "{}".format(str(epoch_id)), nn_test]])), axis=0)
            
    for epoch_id in range(3):
        for exp in exps:
            eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/exp_{}/test_evaluation_hybrid.json".format(dataset, str(exp))
            with open(eval_path, "r") as f:
                    eval = json.load(f)
            epoch = selected_epochs[epoch_id]
            nn_train = round(eval["nn_train"][str(epoch)][str(k)], 3)
            nn_test = round(eval["nn_test"][str(epoch)][str(k)], 3)

            data = np.concatenate((data, np.array([[metric, "-OS",  "-OS(Train)", "{}".format(str(epoch_id)), nn_train]])), axis=0)
            data = np.concatenate((data, np.array([[metric, "-OS", "-OS(Test)", "{}".format(str(epoch_id)), nn_test]])), axis=0)


    # INV
    metric = "INV"
    # DeepDebugger segments
    eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/test_evaluation_hybrid.json".format(dataset)
    with open(eval_path, "r") as f:
            eval = json.load(f)
    for epoch_id in range(3):
        epoch = selected_epochs[epoch_id]
        ppr_train = round(eval["ppr_train"][str(epoch)], 3)
        ppr_test = round(eval["ppr_test"][str(epoch)], 3)
        
        data = np.concatenate((data, np.array([[metric, "DeepDebugger",  "DeepDebugger(Train)", "{}".format(str(epoch_id)), ppr_train]])), axis=0)
        data = np.concatenate((data, np.array([[metric, "DeepDebugger", "DeepDebugger(Test)", "{}".format(str(epoch_id)), ppr_test]])), axis=0)
        
    # DeepDebugger Random segments
    for epoch_id in range(3):
        for exp in exps:
            eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/exp_{}/test_evaluation_hybrid.json".format(dataset, str(exp))
            with open(eval_path, "r") as f:
                    eval = json.load(f)
            epoch = selected_epochs[epoch_id]
            nn_train = round(eval["ppr_train"][str(epoch)], 3)
            nn_test = round(eval["ppr_test"][str(epoch)], 3)

            data = np.concatenate((data, np.array([[metric, "-OS", "-OS(Train)", "{}".format(str(epoch_id)), nn_train]])), axis=0)
            data = np.concatenate((data, np.array([[metric, "-OS", "-OS(Test)",  "{}".format(str(epoch_id)), nn_test]])), axis=0)

    # TLR
    metric= "TLR"
    # DeepDebugger segments
    eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/test_evaluation_hybrid.json".format(dataset)
    with open(eval_path, "r") as f:
            eval = json.load(f)
    for epoch_id in range(3):
        epoch = selected_epochs[epoch_id]
        nn_train = round(eval["tlr_train"][str(epoch)], 3)
        nn_test = round(eval["tlr_test"][str(epoch)], 3)
        data = np.concatenate((data, np.array([[metric, "DeepDebugger",  "DeepDebugger(Train)","{}".format(str(epoch_id)), nn_train]])), axis=0)
        data = np.concatenate((data, np.array([[metric, "DeepDebugger", "DeepDebugger(Test)", "{}".format(str(epoch_id)), nn_test]])), axis=0)
    
    # DeepDebugger Random segments
    for epoch_id in range(3):
        for exp in exps:
            eval_path = "/home/xianglin/projects/DVI_data/resnet18_{}/Model/exp_{}/test_evaluation_hybrid.json".format(dataset, str(exp))
            with open(eval_path, "r") as f:
                    eval = json.load(f)
            epoch = selected_epochs[epoch_id]
            nn_train = round(eval["tlr_train"][str(epoch)], 3)
            nn_test = round(eval["tlr_test"][str(epoch)], 3)
        
            data = np.concatenate((data, np.array([[metric, "-OS", "-OS(Train)","{}".format(str(epoch_id)), nn_train]])), axis=0)
            data = np.concatenate((data, np.array([[metric, "-OS", "-OS(Test)", "{}".format(str(epoch_id)), nn_test]])), axis=0)


    df = pd.DataFrame(data, columns=col)
    df[["period"]] = df[["period"]].astype(int)
    df[["eval"]] = df[["eval"]].astype(float)

    # df.to_excel("./plot_results/cifar10_segment.xlsx")

    pal20c = sns.color_palette('tab20c', 20)
    sns.set_theme(style="whitegrid", palette=pal20c)
    hue_dict = {
        "-OS(Train)": pal20c[0],
        "DeepDebugger(Train)": pal20c[8],

        "-OS(Test)": pal20c[3],
        "DeepDebugger(Test)": pal20c[11],
    }
    sns.palplot([hue_dict[i] for i in hue_dict.keys()])

    axes = {'labelsize': 15,
            'titlesize': 15,}
    mpl.rc('axes', **axes)
    mpl.rcParams['xtick.labelsize'] = 15

    hue_list = ["-OS(Train)", "-OS(Test)", "DeepDebugger(Train)", "DeepDebugger(Test)"]

    fg = sns.catplot(
        x="period",
        y="eval",
        hue="hue",
        hue_order=hue_list,
        # order = [1, 2, 3, 4, 5],
        # row="method",
        col="metric",
        ci=0.001,
        height=2.5, #2.65,
        aspect=1.0,#3,
        data=df,
        sharey=False,
        kind="box",
        palette=[hue_dict[i] for i in hue_list],
        legend=True
    )
    sns.move_legend(fg, "lower center", bbox_to_anchor=(.42, 0.92), ncol=2, title=None, frameon=False)
    mpl.pyplot.setp(fg._legend.get_texts(), fontsize='15')

    axs = fg.axes[0]
    # max_ = df_tmp["eval"].max()
    # min_ = df["eval"].min()
    # axs[0].set_ylim(0., max_*1.1)
    axs[0].set_title("NN")
    axs[1].set_title("INV")
    axs[2].set_title("Temporal")

    (fg.despine(bottom=False, right=False, left=False, top=False)
        .set_xticklabels(['Early', 'Mid', 'Late'])
        .set_axis_labels("", "")
        )
    # fg.fig.suptitle("NN preserving property")

    fg.savefig(
        "./plot_results/cifar10_segment.png",
        dpi=300,
        bbox_inches="tight",
        pad_inches=0.0,
        transparent=True,
    )


if __name__ == "__main__":
    main()

