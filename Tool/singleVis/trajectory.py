import matplotlib.pyplot as plt
import numpy as np

def draw_trajectory(embeddings, save_path=None, x_min=None, x_max=None, y_min=None, y_max=None):
    fig = plt.figure()
    plt.quiver(embeddings[:-1, 0], embeddings[:-1, 1], embeddings[1:, 0]-embeddings[:-1, 0], embeddings[1:, 1]-embeddings[:-1, 1],scale_units='xy', angles='xy', scale=1)  
    if x_min is None:
        x_min = embeddings[:, 0].min()
        x_max = embeddings[:, 0].max()
        y_min = embeddings[:, 1].min()
        y_max = embeddings[:, 1].max()

    plt.xlim((x_min-0.1*(x_max-x_min), x_max+0.1*(x_max-x_min)))
    plt.ylim((y_min-0.1*(y_max-y_min), y_max+0.1*(y_max-y_min)))
    plt.scatter(embeddings[0,0], embeddings[0,1],marker='^')
    plt.scatter(embeddings[-1,0],embeddings[-1,1],marker='o')
    # plt.legend()
    print(embeddings[0])


    if save_path is not None:
        plt.savefig(save_path)

def draw_two_trajectories(embeddings1, embeddings2, save_path=None, save_in_one=True):

    x_min = min(embeddings1[:, 0].min(),embeddings2[:, 0].min())
    x_max = max(embeddings1[:, 0].max(), embeddings2[:, 0].max())
    y_min = min(embeddings1[:, 1].min(), embeddings2[:, 1].min())
    y_max = max(embeddings1[:, 1].max(), embeddings2[:, 1].max())
    if save_in_one:
        fig = plt.figure()
        fig, ax = plt.subplots(1, 1, figsize=(8, 8))

        plot1 = ax.quiver(embeddings1[:-1, 0], embeddings1[:-1, 1], embeddings1[1:, 0]-embeddings1[:-1, 0], embeddings1[1:, 1]-embeddings1[:-1, 1],scale_units='xy', angles='xy', scale=1, color='r')  
        plot2 = ax.quiver(embeddings2[:-1, 0], embeddings2[:-1, 1], embeddings2[1:, 0]-embeddings2[:-1, 0], embeddings2[1:, 1]-embeddings2[:-1, 1],scale_units='xy', angles='xy', scale=1, color='b')  

        ax.set_xlim((x_min-0.1*(x_max-x_min), x_max+0.1*(x_max-x_min)))
        ax.set_ylim((y_min-0.1*(y_max-y_min), y_max+0.1*(y_max-y_min)))
        ax.set_title("DVI vs DVI-T trajectory visualization")
        ax.legend([plot1, plot2], ["DVI", "DVI-T"])

    else:
        fig = plt.figure()
        ax = fig.add_subplot(121)
        ax.quiver(embeddings1[:-1, 0], embeddings1[:-1, 1], embeddings1[1:, 0]-embeddings1[:-1, 0], embeddings1[1:, 1]-embeddings1[:-1, 1],scale_units='xy', angles='xy', scale=1)  

        ax.set_xlim((x_min-0.1*(x_max-x_min), x_max+0.1*(x_max-x_min)))
        ax.set_ylim((y_min-0.1*(y_max-y_min), y_max+0.1*(y_max-y_min)))
        ax.set_title("DVI")

        ax = fig.add_subplot(122)
        ax.quiver(embeddings2[:-1, 0], embeddings2[:-1, 1], embeddings2[1:, 0]-embeddings2[:-1, 0], embeddings2[1:, 1]-embeddings2[:-1, 1],scale_units='xy', angles='xy', scale=1)  

        ax.set_xlim((x_min-0.1*(x_max-x_min), x_max+0.1*(x_max-x_min)))
        ax.set_ylim((y_min-0.1*(y_max-y_min), y_max+0.1*(y_max-y_min)))
        ax.set_title("DVI-T")
    if save_path is not None:
        plt.savefig(save_path)


if __name__ == "__main__":
    # toy example
    embeddings_x = np.arange(5)
    embeddings_y = np.arange(2,7,1)
    embeddings_z = np.arange(-2, -7, -1)
    embeddings1 = np.concatenate((embeddings_x[None,], embeddings_y[None,]), axis=0)
    embeddings1 = embeddings1.transpose()
    embeddings2 = np.concatenate((embeddings_x[None,], embeddings_z[None,]), axis=0)
    embeddings2 = embeddings2.transpose()
    draw_trajectory(embeddings1)
    draw_two_trajectories(embeddings1, embeddings2)
    


