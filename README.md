# Training Dynamic Visualization Tool

> 🏗️ The tool is under renovation, and only part of the datasets are validated to be visualized. Introduction to the original tool and research project and could be found in [PROTOTYPE.md](PROTOTYPE.md). Old experiment scripts were run in Python 3.7, using `requirements.old.txt`.

## How To Start the Tool

We recommend using **Python 3.10** to run and contribute to this tool, since no other versions were tested. 

### Prepare the Project

```bash
git clone https://github.com/code-philia/time-travelling-visualizer.git
cd time-travelling-visualizer
```

### Switch Git Branch

To try our lastest features, switch to the following branch:

```bash
git checkout dev
```

### Set up Backend/Model

At the beginning of this step, we recommend creating [venv](https://docs.python.org/3/library/venv.html) or using [conda](https://docs.conda.io/projects/conda/en/24.9.x/user-guide/install/index.html) to isolate the running envirionment before installing all the dependencies, especially when your device has enough storage.

> [!NOTE] 
> Ignore it if you have encounter any error from pip dependency resolver, which has no impact on running the tool and will be fixed later.

#### Option 1: Create Python venv

Use an installed Python 3.10 executable to create the venv, then it would start from that Python version:

```bash
python --version    # make sure the output is Python 3.10.*, or you should install and use python3.10
python -m venv .venv

# On Linux or MacOS run
source .venv/bin/activate
# On Windows run
.venv\Scripts\activate

pip install -r requirements.txt
```

Remember to activate the venv each time before you run the tool.

#### Option 2: Use conda

First sure you have [conda](https://docs.conda.io/projects/conda/en/24.9.x/user-guide/install/index.html) installed on your system, then run:

```bash
conda create -n visualizer-venv python=3.10 -y
conda activate visualizer-venv
pip install -r requirements.txt
```

Rememeber to `conda activate visualizer-venv` each time you run the tool.

#### Option 3: Directly Install PyTorch and Other Dependencies

If you haven't got in touch with PyTorch, please refer to the [PyTorch official guide](https://pytorch.org/get-started/locally/) to install it. Installation methods may vary by platform, and the available PyTorch version depend on your GPU and the appropriate CUDA or ROCm version.

Then, run the following command to install all required dependencies:

```bash
pip install -r requirements.txt
```

### Download The Demo Dataset

We recommend using this dataset `gcb_tokens` to try the new option `Umap-Neighborhood` .

- **bash/zsh:**

    ```bash
    wget https://huggingface.co/datasets/code-philia/mtpnet/resolve/main/gcb_tokens.zip?download=true -O gcb_tokens.zip
    unzip gcb_tokens.zip
    ```

- **PowerShell:**

    ```powershell
    Invoke-WebRequest https://huggingface.co/datasets/code-philia/mtpnet/resolve/main/gcb_tokens.zip?download=true -OutFile gcb_tokens.zip
    Expand-Archive gcb_tokens.zip -DestinationPath .
    ```

#### Recommended Demo Datasets

There are other demo datasets you can try. This table is a summary:

| Dataset Name | Download Address | Data Type | Task Type |
| --- | --- | --- | --- |
| gcb_tokens | https://huggingface.co/datasets/code-philia/mtpnet/resolve/main/gcb_tokens.zip?download=true | Text | Umap-Neighborhood |
| csn_python_code | https://huggingface.co/datasets/code-philia/mtpnet/resolve/main/case_study_mnist_backdoor.zip?download=true | Text | Non-Classification |
| case_study_mnist_backdoor | https://huggingface.co/datasets/code-philia/mtpnet/resolve/main/case_study_mnist_backdoor.zip?download=true | Image | Classification |

### Run the Backend Server

1. If you are using a virtual environment, **be sure it is activated.** Then run:

```bash
cd Tool/server/
python server.py
```

2. You should see an URL after the server is started (if you start this tool remotely, you may need to set up port forwarding in your IDE, e.g. VS Code). Visit it in your browser.
3. Fill in the **Content Path** field the absolute path to the extracted dataset.
4. Choose the correct options, the data type **Image/Text** and the task type **Classification/Non-Classification/Umap-Neighborhood**, according to the table above.
5. Click **Load Visualization Result**. If you see any warnings, click **OK** to proceed.

You should now see the visualization plot, and the console will show access log.
