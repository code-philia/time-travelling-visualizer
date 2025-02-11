---
title: Setup & Quickstart
permalink: /docs/home/
redirect_from: /docs/index.html
---

#### Prepare the Project

```bash
$ git clone <https://github.com/code-philia/time-travelling-visualizer.git>
$ cd time-travelling-visualizer
```

To try our latest features, switch to the following branch:

```bash
$ git checkout feat/visactor
```

#### Setup the Environment

**1. Create a virtual environment**

We recommend to [create a venv](https://docs.python.org/3/library/venv.html) with **pyhont 3.10** before installing all the dependencies, especially when your device has enough storage.

**2. Install PyTorch**

Refer to the [PyTorch official guide](https://pytorch.org/get-started/locally/). Installation methods vary by platform, and PyTorch versions depend on your GPU and the appropriate CUDA or ROCm version.

**3. Install All Dependencies**

Run the following command to install all required dependencies:

```bash
$ pip install -r requirements.all.txt
```
and
```bash
$ cd web
$ npm run install
```

#### Download The Sample Dataset

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

#### Run the Tool

**1. Start the backend server**

If you are using a virtual environment, be sure it is activated. Then run the following command:

```bash
~/time-travelling-visualizer$ conda activate venv
(venv) ~/time-travelling-visualizer$ cd tool/server/
(venv) ~/time-travelling-visualizer/tool/server$ python server.py
```
Observe if the server starts on port 5010 (usually it does). If not, modify it in the next step.
```bash
WARNING: This is a development server. Do not use it in a production deployment. Use a production MSGT server instead.
* Running on all addresses (0,0,0,0)
* Running on http://127.0.0.1[5010]
* Running on http://192.168.98.170:5010
Press CTRLHC to quit
```

**2. Start the frontend interface**

If the server did not start on port 5010 in the previous step, modify line 125 in the `web/src/state/store.tsx` file:
```
124 // settings
125 backendHost: 'localhost:5010', // modify here
```
Change the port after localhost to the corresponding port (e.g., 5011, 5012). After modification, execute the following in the project root directory:
```bash
(venv) ~/time-travelling-visualizer$ cd web
(venv) ~/time-travelling-visualizer/web$ npm run dev
```
This will start a frontend server. Open the following URL like `http://localhost:5175/` in your browser.
```
  ➜  Local:   http://localhost:5175/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**3. Use the tool**

Fill in the **Content Path** field the absolute path to the extracted dataset and click **Load Visualization Result**. For **Visualization Method** select **DVI** of **TimeVis**.

You should now see the visualized charts, and the terminal will display access logs.