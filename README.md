# training-visualizer

This is a project to visualizer our XAI techniques for debugging the model training process. Please check our CoPhi profile for latest update: https://github.com/code-philia/training-visualizer


# download frontend and backend repos
$ cd git_space
## timevis
$ git clone https://github.com/xianglinyang/DLVisDebugger.git
## active learning related
$ git clone https://github.com/xianglinyang/ActiveLearning.git
## frontend
$ git clone https://github.com/llmhyy/training-visualizer.git


# download bazel （build frontend）
1. install Bazel for mac： [reference](https://docs.bazel.build/versions/main/install-os-x.html). 

2. install Bazel for windows:[reference](https://docs.bazel.build/versions/main/install-windows.html) <br/>
   (1)[Install the prerequisites](https://www.microsoft.com/en-us/download/details.aspx?id=48145) (If it prompts that other versions have been installed during the installation process, there is no need to repeat the installation)<br/>
   (2)download the Bazel binary: [releases](https://github.com/bazelbuild/bazel/releases) | [bazel-3.2.0-windows-x86_64.exe](https://github.com/bazelbuild/bazel/releases/download/3.2.0/bazel-3.2.0-windows-x86_64.exe)<br/>
   (3) Installing compilers: download: [MSYS2 x86_64](https://www.msys2.org/)<br/>
       MSYS2 is a software distro and building platform for Windows. It contains Bash and common Unix tools (like grep, tar, 
       git).(In fact, it is to create a linux-like environment for bazel under windows.)
      [why MSYS2](https://docs.bazel.build/versions/main/install-windows.html)

      You will likely need these to build and run targets that depend on Bash. MSYS2 does not install these tools by default, so 
      you need to install them manually. Projects that depend on Bash tools in PATH need this step (for example TensorFlow).
      Open the MSYS2 terminal and run this command:
      ```console
      pacman -S zip unzip patch diffutils git
      ```
      Optional: If you want to use Bazel from CMD or Powershell and still be able to use Bash tools, make sure to add 
      <MSYS2_INSTALL_PATH>/usr/bin to your PATH environment variable.
      
  (4) add environment variable: <br/>
      BAZEL_SH =C:\msys64\usr\bin\bash.exe<br/>
      Rename the previously downloaded bazel-3.2.0-windows-x86_64.exe to bazel.exe and put it in C:\msys64
      Administrator runs cmd to verify   
```console
> bazel version
```

**tips:**
  1.use the branch "withoutBackend"<br/>
  2.[Using Bazel on Windows](https://docs.bazel.build/versions/main/windows.html#best-practices)  

3. install Bazel for linux

example: ubuntu
```console
$ sudo apt install apt-transport-https curl gnupg
$ curl -fsSL https://bazel.build/bazel-release.pub.gpg | gpg --dearmor > bazel.gpg
$ sudo mv bazel.gpg /etc/apt/trusted.gpg.d/
$ echo "deb [arch=amd64] https://storage.googleapis.com/bazel-apt stable jdk1.8" | sudo tee /etc/apt/sources.list.d/bazel.list
$ sudo apt update && sudo apt install bazel
```
to specify the version of bazel use ```sudo apt install bazel-5.2.0```. 

check whether installation successful
```console
$ bazel --version
```

#  config （backend）
> We need to release timevis and active learning backend as python lib in the future. After that only download and import those lib would be enough.  

> 3.1 modify BackendAdapter.py line 17 and line 31, put your local path of **DLVisDebugger** and **Activelearning** there
```console
$ vim git_space/training-visualization-frontend/server/timevis_backend/backend_adapter.py
```


#  Requirements to run backend are in ```requirements.txt``` under backend repo. （backend）

conda downloading instruction from [here](https://docs.anaconda.com/anaconda/install/linux/). One simple instruction here:
```console
$ wget https://repo.anaconda.com/miniconda/Miniconda3-py39_4.12.0-Linux-x86_64.sh
$ bash Miniconda3-py39_4.12.0-Linux-x86_64.sh
```

```console
$ conda create -n timevis python=3.7
$ conda activate timevis
$ cd path/to/DLVisDebugger
$ pip install -r requirements.txt
```
User should customize the version of pytorch according to their machine. The default version of pytorch is 1.10.0+cu113. 
```console
$ conda install pytorch torchvision torchaudio cudatoolkit=11.3 -c pytorch
```
Check which pytorch version to select from [here](https://pytorch.org/get-started/locally/)

#  download toy dataset to play with

```console
$ pip install gdown # for downloading large file from google drive
$ cd path/to/data_folder
$ gdown https://drive.google.com/u/1/uc?id=1vpavoxajCMr5bLNs5SmXV__pL4i37b6d
$ unzip toy_model.zip
$ rm toy_model.zip # (optional)in case low drive storage
$ cd resnet18_cifar10
$ sh run.sh
```
You can specify which gpu to use in config.py. If none, set ```"GPU"=None```. The default is ```"GPU"="0"```

# start

1. start backend
```console
$(base) conda activate timevis
$(timevis) cd training-visualization-frontend/server
$(timevis) python server.py
```
2. start frontend
> no need of specified environment
```console
$(timevis) cd training-visualization-frontend/tensorboard
$(timevis) bazel run tensorboard/plugins/projector/vz_projector:standalone
```
3. Open `http://localhost:6006/standalone.html`.  
  （windows sometimes may use 6007）
> *Noted that https will report error, replace with http*


