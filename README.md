# Training Dynamic Visualization Tool

> 🏗️ The tool is under renovation, and only part of the datasets are validated to be visualized. Introduction to the original tool and research project and could be found in [PROTOTYPE.md](PROTOTYPE.md).

## How To Start the Tool

### Prepare the Project

```bash
$ git clone <https://github.com/code-philia/time-travelling-visualizer.git>
$ cd time-travelling-visualizer
```

### Switch Git Branch

To try our latest features, switch to the following branch:

```bash
$ git checkout new-version
```

### Setup Environment

You can simply run the following commands to install our recommended environment and required dependencies. 

```bash
$ chmod +x ./setup.sh
$ export ENV_NAME="venv" 
$ ./setup.sh
```

Besides, you can also install them step by step by following the instructions below.

#### Create a virtual environment

We recommend to [create a venv](https://docs.python.org/3/library/venv.html) before installing all the dependencies, especially when your device has enough storage.

#### Install PyTorch

Refer to the [PyTorch official guide](https://pytorch.org/get-started/locally/). Installation methods vary by platform, and PyTorch versions depend on your GPU and the appropriate CUDA or ROCm version.

#### Install All Dependencies

Run the following command to install all required dependencies:

```bash
$ pip install -r requirements.all.txt
```

### Download The Sample Dataset

We recommend using this dataset to try the new feature.

- **bash/zsh:**

  ```bash
  $ wget https://harkxa.sn.files.1drv.com/y4moeyNzEN8YAThWfZ3KqdgMTMOiw8bPpfla5qSeJoEXMydGUCpFU1bcQPDMUtzlbeZnP4len61rozjPqxn30PWHMe5696VvAP0vctH7LyA11Usc8571J30qCTFJ27UOOLEo8PMhxzUPWwYtJVEqyiiYkV0MSg9pGHT33aOFi8F2_L85gltRCL_QnxB1g2D6pPagaqRi9wyC6uxsgARbA1kbQ -O gcb_tokens.zip
  unzip gcb_tokens.zip
  ```

- **PowerShell:**

  ```powershell
  Invoke-WebRequest https://harkxa.sn.files.1drv.com/y4moeyNzEN8YAThWfZ3KqdgMTMOiw8bPpfla5qSeJoEXMydGUCpFU1bcQPDMUtzlbeZnP4len61rozjPqxn30PWHMe5696VvAP0vctH7LyA11Usc8571J30qCTFJ27UOOLEo8PMhxzUPWwYtJVEqyiiYkV0MSg9pGHT33aOFi8F2_L85gltRCL_QnxB1g2D6pPagaqRi9wyC6uxsgARbA1kbQ -OutFile gcb_tokens.zip
  Expand-Archive gcb_tokens.zip -DestinationPath .
  ```

### Running the Backend Server

1. If you are using a virtual environment, be sure it is activated. Then run the following command:

```bash
~/time-travelling-visualizer$ conda activate venv
(venv) ~/time-travelling-visualizer$ cd Tool/server/
(venv) ~/time-travelling-visualizer/Tool/server$ python server.py
```

2. You should see an URL after the server is started (if you start this tool remotely, you may need to set up port forwarding in your IDE, e.g. VS Code). Visit it in your browser.
3. Fill in the **Content Path** field the absolute path to the extracted dataset and click **Load Visualization Result**. If you see any warnings, click **OK** to proceed.
4. For **Task Type** select **Umap-Neighborhood**.

You should now see the visualized charts, and the terminal will display access logs.