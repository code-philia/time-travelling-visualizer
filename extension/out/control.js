"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpenedFolderPath = getOpenedFolderPath;
exports.getBasicConfig = getBasicConfig;
exports.getVisConfig = getVisConfig;
exports.getPlotSettings = getPlotSettings;
exports.loadVisualization = loadVisualization;
exports.loadVisualizationThroughTreeItem = loadVisualizationThroughTreeItem;
exports.startVisualizing = startVisualizing;
exports.startVisualizingThroughTreeItem = startVisualizingThroughTreeItem;
exports.setAsDataFolderAndLoadVisualizationResult = setAsDataFolderAndLoadVisualizationResult;
exports.setAsDataFolder = setAsDataFolder;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const CONFIG = __importStar(require("./config"));
const api = __importStar(require("./api"));
const ioUtils_1 = require("./ioUtils");
const resources_1 = require("./resources");
const messageManager_1 = require("./views/messageManager");
const path_1 = __importDefault(require("path"));
/**
 * Config
 */
async function repickConfig(configDescription, items) {
    if (!items || items.length === 0) {
        const inputBox = await vscode.window.showInputBox({
            prompt: configDescription,
            placeHolder: "Enter your value",
        });
        if (!inputBox) {
            const time = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15); // Format: YYYYMMDDTHHMMSS
            return `visualization_${time}`;
        }
        return inputBox;
    }
    const quickPickitems = items.map(item => {
        return {
            ...item,
            iconPath: item.iconId ? (0, resources_1.getIconUri)(item.iconId) : undefined,
        };
    });
    const picked = await vscode.window.showQuickPick(quickPickitems, { placeHolder: configDescription });
    if (!picked) {
        return "";
    }
    return picked.label;
}
function getOpenedFolderPath() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return workspaceFolders[0].uri.fsPath;
    }
    return "";
}
function checkDefaultVisualizationConfig() {
    const visConfigSet = vscode.workspace.getConfiguration(CONFIG.configurationBaseName);
    const dataType = visConfigSet.get(CONFIG.ConfigurationID.dataType);
    const taskType = visConfigSet.get(CONFIG.ConfigurationID.taskType);
    const trainingProcess = visConfigSet.get(CONFIG.ConfigurationID.trainingProcess);
    const visualizationMethod = visConfigSet.get(CONFIG.ConfigurationID.visualizationMethod);
    const visualizationID = visConfigSet.get(CONFIG.ConfigurationID.visualizationID);
    const workspacePath = getOpenedFolderPath();
    // TODO create a class for a configuration
    // that can both define the ID and validate the value
    if (api.Types.VisualizationDataType.has(dataType) &&
        api.Types.VisualizationTaskType.has(taskType) &&
        typeof trainingProcess === 'string' && typeof visualizationID === 'string' &&
        api.Types.VisualizationMethod.has(visualizationMethod)) {
        return {
            dataType: dataType,
            taskType: taskType,
            contentPath: path_1.default.join(workspacePath, trainingProcess),
            visualizationMethod: visualizationMethod,
            visualizationID: visualizationID,
        };
    }
    return undefined;
}
async function reconfigureVisualizationConfig() {
    const visConfigSet = vscode.workspace.getConfiguration('timeTravellingVisualizer'); // Should we call this each time?
    const dataType = await repickConfig("Select the type of your data", [
        { iconId: "image-type", label: "Image" },
        { iconId: "text-type", label: "Text" },
    ]);
    if (!dataType) {
        return undefined;
    }
    const taskType = await repickConfig("Select the type of your model task", [
        { iconId: "classification-task", label: "Classification" },
        { iconId: "non-classification-task", label: "Code-Retrieval" },
    ]);
    if (!taskType) {
        return undefined;
    }
    // const contentPathConfig = config.get('loadVisualization.contentPath');
    const contentPathConfig = "";
    var trainingProcess = "";
    if (!(typeof contentPathConfig === 'string' && (0, ioUtils_1.isDirectory)(contentPathConfig))) {
        trainingProcess = await new Promise((resolve, reject) => {
            const inputBox = vscode.window.createInputBox();
            inputBox.prompt = "Please enter the folder path where the visualization should start from";
            inputBox.title = "Data Folder";
            inputBox.placeholder = "Enter the path";
            inputBox.buttons = [
                { iconPath: vscode.ThemeIcon.Folder, tooltip: "Select folder" }
            ];
            const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? "";
            if (workspacePath) {
                inputBox.value = fs.realpathSync.native(workspacePath);
            }
            inputBox.ignoreFocusOut = true;
            inputBox.valueSelection = [inputBox.value.length, inputBox.value.length];
            function validate(value) {
                if ((0, ioUtils_1.isDirectory)(value)) {
                    inputBox.validationMessage = "";
                    return true;
                }
                else {
                    inputBox.validationMessage = "folder does not exist";
                    return false;
                }
            }
            inputBox.onDidTriggerButton(async (button) => {
                if (button.tooltip === "Select folder") {
                    const folderPath = await vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        openLabel: "Select folder",
                    });
                    if (folderPath) {
                        const pathResult = folderPath[0].fsPath;
                        if (validate(pathResult)) {
                            inputBox.value = fs.realpathSync.native(pathResult); // deal with uppercase of c: on windows
                        }
                        inputBox.valueSelection = [inputBox.value.length, inputBox.value.length];
                    }
                }
            });
            inputBox.onDidChangeValue((value) => {
                validate(value);
            });
            inputBox.onDidAccept(() => {
                if (validate(inputBox.value)) {
                    resolve(inputBox.value);
                    inputBox.hide();
                }
                else {
                    inputBox.hide();
                    reject("invalid folder path");
                }
            });
            inputBox.onDidHide(() => {
                inputBox.dispose();
            });
            inputBox.show();
        });
        if (!(0, ioUtils_1.isDirectory)(trainingProcess)) {
            return undefined;
        }
    }
    else {
        trainingProcess = contentPathConfig;
    }
    const visualizationMethod = await repickConfig("Select the visualization method", [
        { label: "UMAP", description: "(default)" },
        { label: "TimeVis" },
        { label: "DVI" },
        { label: "DynaVis" },
    ]);
    if (!visualizationMethod) {
        return undefined;
    }
    visConfigSet.update(CONFIG.ConfigurationID.dataType, dataType);
    visConfigSet.update(CONFIG.ConfigurationID.taskType, taskType);
    visConfigSet.update(CONFIG.ConfigurationID.trainingProcess, trainingProcess);
    visConfigSet.update(CONFIG.ConfigurationID.visualizationMethod, visualizationMethod);
    const workspacePath = getOpenedFolderPath();
    return {
        dataType: dataType,
        taskType: taskType,
        contentPath: path_1.default.join(workspacePath, trainingProcess),
        visualizationMethod: visualizationMethod,
        visualizationID: "",
    };
}
async function getConfig(forceReconfig = false) {
    var config;
    if (!forceReconfig) {
        config = checkDefaultVisualizationConfig();
        if (config) {
            return config;
        }
    }
    config = await reconfigureVisualizationConfig();
    return config;
}
function getBasicConfig() {
    const visConfigSet = vscode.workspace.getConfiguration(CONFIG.configurationBaseName);
    const dataType = visConfigSet.get(CONFIG.ConfigurationID.dataType);
    const taskType = visConfigSet.get(CONFIG.ConfigurationID.taskType);
    const trainingProcess = visConfigSet.get(CONFIG.ConfigurationID.trainingProcess);
    const visualizationMethod = visConfigSet.get(CONFIG.ConfigurationID.visualizationMethod);
    const visualizationID = visConfigSet.get(CONFIG.ConfigurationID.visualizationID);
    const workspacePath = getOpenedFolderPath();
    if (typeof trainingProcess !== 'string') {
        vscode.window.showErrorMessage("Invalid training process path");
        return undefined;
    }
    return {
        dataType: dataType,
        taskType: taskType,
        contentPath: path_1.default.join(workspacePath, trainingProcess),
        visualizationMethod: visualizationMethod,
        visualizationID: visualizationID,
    };
    ;
}
function updateBasicConfig(dataType, taskType, trainingProcess, visualizationID) {
    const visConfigSet = vscode.workspace.getConfiguration(CONFIG.configurationBaseName);
    return Promise.all([
        visConfigSet.update(CONFIG.ConfigurationID.dataType, dataType, vscode.ConfigurationTarget.Global), // Update user settings
        visConfigSet.update(CONFIG.ConfigurationID.taskType, taskType, vscode.ConfigurationTarget.Global), // Update user settings
        visConfigSet.update(CONFIG.ConfigurationID.trainingProcess, trainingProcess, vscode.ConfigurationTarget.Global), // Update user settings
        // visConfigSet.update(CONFIG.ConfigurationID.visualizationMethod, visualizationMethod, vscode.ConfigurationTarget.Global), // Update user settings
        visConfigSet.update(CONFIG.ConfigurationID.visualizationID, visualizationID, vscode.ConfigurationTarget.Global), // Update user settings
    ]).then(() => {
    }).catch((err) => {
        vscode.window.showErrorMessage(`Failed to update user settings: ${err}`);
    });
}
function getVisConfig(visualizationMethod) {
    const visConfigSet = vscode.workspace.getConfiguration(CONFIG.configurationBaseName);
    if (visualizationMethod === "TimeVis") {
        return {
            gpu_id: visConfigSet.get(CONFIG.ConfigurationID.TimeGpuId),
            resolution: visConfigSet.get(CONFIG.ConfigurationID.TimeResolution),
            lambda: visConfigSet.get(CONFIG.ConfigurationID.TimeLambda),
            n_neighbors: visConfigSet.get(CONFIG.ConfigurationID.TimeNNeighbors),
            s_n_epochs: visConfigSet.get(CONFIG.ConfigurationID.TimeSNEpochs),
            b_n_epochs: visConfigSet.get(CONFIG.ConfigurationID.TimeBNEpochs),
            t_n_epochs: visConfigSet.get(CONFIG.ConfigurationID.TimeTNEpochs),
            patient: visConfigSet.get(CONFIG.ConfigurationID.TimePatient),
            max_epochs: visConfigSet.get(CONFIG.ConfigurationID.TimeMaxEpochs),
        };
    }
    else if (visualizationMethod === "DVI") {
        return {
            gpu_id: visConfigSet.get(CONFIG.ConfigurationID.DVIGpuId),
            resolution: visConfigSet.get(CONFIG.ConfigurationID.DVIResolution),
            lambda1: visConfigSet.get(CONFIG.ConfigurationID.DVILambda1),
            lambda2: visConfigSet.get(CONFIG.ConfigurationID.DVILambda2),
            n_neighbors: visConfigSet.get(CONFIG.ConfigurationID.DVINNeighbors),
            s_n_epochs: visConfigSet.get(CONFIG.ConfigurationID.DVISNEpochs),
            b_n_epochs: visConfigSet.get(CONFIG.ConfigurationID.DVIBNEpochs),
            patient: visConfigSet.get(CONFIG.ConfigurationID.DVIPatient),
            max_epochs: visConfigSet.get(CONFIG.ConfigurationID.DVIMaxEpochs),
        };
    }
    else if (visualizationMethod === "UMAP") {
        return {
            n_neighbors: visConfigSet.get(CONFIG.ConfigurationID.UmapNNeighbors),
            min_dist: visConfigSet.get(CONFIG.ConfigurationID.UmapMinDist),
            metric: visConfigSet.get(CONFIG.ConfigurationID.UmapMetric),
        };
    }
    else if (visualizationMethod === "DynaVis") {
        return {
            gpu_id: visConfigSet.get(CONFIG.ConfigurationID.DynaVisGpuId),
            resolution: visConfigSet.get(CONFIG.ConfigurationID.DynaVisResolution),
            reconstruct_loss_weight: visConfigSet.get(CONFIG.ConfigurationID.DynaVisReconstructLossWeight),
            temporal_loss_weight: visConfigSet.get(CONFIG.ConfigurationID.DynaVisTemporalLossWeight),
            velocity_loss_weight: visConfigSet.get(CONFIG.ConfigurationID.DynaVisVelocityLossWeight),
            n_neighbors: visConfigSet.get(CONFIG.ConfigurationID.DynaVisNNeighbors),
            s_n_epochs: visConfigSet.get(CONFIG.ConfigurationID.DynaVisSNEpochs),
            b_n_epochs: visConfigSet.get(CONFIG.ConfigurationID.DynaVisBNEpochs),
            t_n_epochs: visConfigSet.get(CONFIG.ConfigurationID.DynaVisTNEpochs),
            patient: visConfigSet.get(CONFIG.ConfigurationID.DynaVisPatient),
            max_epochs: visConfigSet.get(CONFIG.ConfigurationID.DynaVisMaxEpochs),
        };
    }
    return {};
}
function getPlotSettings() {
    const plotSettings = vscode.workspace.getConfiguration(CONFIG.configurationBaseName);
    const showIndex = plotSettings.get(CONFIG.ConfigurationID.showIndex);
    const showLabel = plotSettings.get(CONFIG.ConfigurationID.showLabel);
    const showBackground = plotSettings.get(CONFIG.ConfigurationID.showBackground);
    const showTrail = plotSettings.get(CONFIG.ConfigurationID.showTrail);
    const revealOriginalNeighbors = plotSettings.get(CONFIG.ConfigurationID.revealOriginalNeighbors);
    const revealProjectionNeighbors = plotSettings.get(CONFIG.ConfigurationID.revealProjectionNeighbors);
    return {
        showIndex: showIndex,
        showLabel: showLabel,
        showBackground: showBackground,
        showTrail: showTrail,
        revealOriginalNeighbors: revealOriginalNeighbors,
        revealProjectionNeighbors: revealProjectionNeighbors
    };
}
/**
 * Load the visualization result
 */
async function loadVisualization(forceReconfig = false) {
    const config = await getConfig(forceReconfig);
    if (!config) {
        vscode.window.showErrorMessage("Cannot start visualization: invalid configuration");
        return false;
    }
    const msgToPlotView = {
        command: 'loadVisualization',
        data: {
            config: config
        }
    };
    console.log("Loading visualization with config:", config);
    messageManager_1.MessageManager.sendToPlotView(msgToPlotView);
    return true;
}
async function loadVisualizationThroughTreeItem(dataType, taskType, trainingProcess, visualizationID) {
    // Wait for settings to update before proceeding
    await updateBasicConfig(dataType, taskType, trainingProcess, visualizationID);
    // Call loadVisualization after settings are updated
    return await loadVisualization();
}
/**
 * Start visualizing
 */
async function startVisualizing() {
    // TODO: send command to plot view to indicate starting visualization
    return true;
}
async function startVisualizingThroughTreeItem(trainingProcess) {
    // TODO: send command to plot view to indicate starting visualization
    return true;
}
/**
 * Other commands
 */
function setDataFolder(file) {
    if (!file) {
        return false;
    }
    const fsPath = file.fsPath;
    if ((0, ioUtils_1.isDirectory)(fsPath)) {
        const extensionConfig = vscode.workspace.getConfiguration('timeTravellingVisualizer');
        extensionConfig.update(CONFIG.ConfigurationID.trainingProcess, fsPath);
        return true;
    }
    else {
        vscode.window.showErrorMessage("Selected path is not a directory 😮");
        return false;
    }
}
function setAsDataFolderAndLoadVisualizationResult(file) {
    if (!(file instanceof vscode.Uri)) {
        return;
    }
    const success = setDataFolder(file);
    if (success) {
        loadVisualization();
    }
}
function setAsDataFolder(file) {
    if (!(file instanceof vscode.Uri)) {
        return;
    }
    setDataFolder(file);
}
//# sourceMappingURL=control.js.map