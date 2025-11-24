import * as vscode from 'vscode';
import * as fs from 'fs';
import * as CONFIG from './config';
import * as api from './api';
import { isDirectory } from './ioUtils';
import { getIconUri } from './resources';
import { MessageManager } from './views/messageManager';
import path from 'path';

/**
 * Config
 */
async function repickConfig(configDescription: string, items?: (vscode.QuickPickItem & { iconId?: string })[]): Promise<string> {
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
	const quickPickitems: vscode.QuickPickItem[] = items.map(item => {
		return {
			...item,
			iconPath: item.iconId ? getIconUri(item.iconId) : undefined,
		};
	});
	const picked = await vscode.window.showQuickPick(
		quickPickitems,
		{ placeHolder: configDescription }
	);
	if (!picked) {
		return "";
	}
	return picked.label;
}

export function getOpenedFolderPath(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return workspaceFolders[0].uri.fsPath;
    }
    return "";
}

function checkDefaultVisualizationConfig(): api.BasicVisualizationConfig | undefined {
	const visConfigSet = vscode.workspace.getConfiguration(CONFIG.configurationBaseName);
	const dataType = visConfigSet.get(CONFIG.ConfigurationID.dataType);
	const taskType = visConfigSet.get(CONFIG.ConfigurationID.taskType);
	const trainingProcess = visConfigSet.get(CONFIG.ConfigurationID.trainingProcess);
	const visualizationMethod = visConfigSet.get(CONFIG.ConfigurationID.visualizationMethod);
	const workspacePath = getOpenedFolderPath();

	// TODO create a class for a configuration
	// that can both define the ID and validate the value

	if (api.Types.VisualizationDataType.has(dataType) &&
		api.Types.VisualizationTaskType.has(taskType) &&
		typeof trainingProcess === 'string' &&
		api.Types.VisualizationMethod.has(visualizationMethod)) {
		return {
			dataType: dataType,
			taskType: taskType,
			contentPath: path.join(workspacePath, trainingProcess),
			visualizationMethod: visualizationMethod
		};
	}
	return undefined;
}

async function reconfigureVisualizationConfig(): Promise<api.BasicVisualizationConfig | undefined> {
	const visConfigSet = vscode.workspace.getConfiguration('timeTravellingVisualizer');	// Should we call this each time?

	const dataType = await repickConfig(
		"Select the type of your data",
		[
			{ iconId: "image-type", label: "Image" },
			{ iconId: "text-type", label: "Text" },
		]
	);
	if (!dataType) {
		return undefined;
	}

	const taskType = await repickConfig(
		"Select the type of your model task",
		[
			{ iconId: "classification-task", label: "Classification" },
			{ iconId: "non-classification-task", label: "Code-Retrieval" },
		]
	);
	if (!taskType) {
		return undefined;
	}

	// const contentPathConfig = config.get('loadVisualization.contentPath');
	const contentPathConfig = "";
	var trainingProcess: string = "";
	if (!(typeof contentPathConfig === 'string' && isDirectory(contentPathConfig))) {
		trainingProcess = await new Promise((resolve, reject) => {
			const inputBox: vscode.InputBox = vscode.window.createInputBox();
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
			function validate(value: string): boolean {
				if (isDirectory(value)) {
					inputBox.validationMessage = "";
					return true;
				} else {
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
							inputBox.value = fs.realpathSync.native(pathResult);	// deal with uppercase of c: on windows
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
				} else {
					inputBox.hide();
					reject("invalid folder path");
				}
			});
			inputBox.onDidHide(() => {
				inputBox.dispose();
			});
			inputBox.show();
		});

		if (!isDirectory(trainingProcess)) {
			return undefined;
		}
	} else {
		trainingProcess = contentPathConfig;
	}

	const visualizationMethod = await repickConfig(
		"Select the visualization method",
		[
			{ label: "UMAP", description: "(default)" },
			{ label: "TimeVis" },
			{ label: "DVI" },
			{ label: "DynaVis" },
		]
	);
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
		contentPath: path.join(workspacePath, trainingProcess),
		visualizationMethod: visualizationMethod
	};
}

async function getConfig(forceReconfig: boolean = false): Promise<api.BasicVisualizationConfig | undefined> {
	var config: api.BasicVisualizationConfig | undefined;
	if (!forceReconfig) {
		config = checkDefaultVisualizationConfig();
		if (config) {
			return config;
		}
	}
	config = await reconfigureVisualizationConfig();
	return config;
}

export function getBasicConfig() {
	const visConfigSet = vscode.workspace.getConfiguration(CONFIG.configurationBaseName);
	const dataType = visConfigSet.get(CONFIG.ConfigurationID.dataType);
	const taskType = visConfigSet.get(CONFIG.ConfigurationID.taskType);
	const trainingProcess = visConfigSet.get(CONFIG.ConfigurationID.trainingProcess);
	const visualizationMethod = visConfigSet.get(CONFIG.ConfigurationID.visualizationMethod);
	const workspacePath = getOpenedFolderPath();

	if(typeof trainingProcess !== 'string') {
		vscode.window.showErrorMessage("Invalid training process path");
		return undefined;
	}

	return {
		dataType: dataType,
		taskType: taskType,
		contentPath: path.join(workspacePath, trainingProcess),
		visualizationMethod: visualizationMethod
	} as api.BasicVisualizationConfig | undefined;;
}

function updateBasicConfig(dataType: string, taskType: string, trainingProcess: string): Promise<void> {
    const visConfigSet = vscode.workspace.getConfiguration(CONFIG.configurationBaseName);
    return Promise.all([
        visConfigSet.update(CONFIG.ConfigurationID.dataType, dataType, vscode.ConfigurationTarget.Global), // Update user settings
        visConfigSet.update(CONFIG.ConfigurationID.taskType, taskType, vscode.ConfigurationTarget.Global), // Update user settings
        visConfigSet.update(CONFIG.ConfigurationID.trainingProcess, trainingProcess, vscode.ConfigurationTarget.Global), // Update user settings
        // visConfigSet.update(CONFIG.ConfigurationID.visualizationMethod, visualizationMethod, vscode.ConfigurationTarget.Global), // Update user settings
    ]).then(() => {
    }).catch((err) => {
        vscode.window.showErrorMessage(`Failed to update user settings: ${err}`);
    });
}

export function getVisConfig(visualizationMethod: string) { 
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

function generateVisualizationId(visualizationMethod?: string): string {
	const method = visualizationMethod ?? "Unknown";
	const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
	return `${timestamp}_${method}`;
}


/**
 * Load the visualization result
 */
export async function loadVisualization(forceReconfig: boolean = false, visualizationID: string = ""): Promise<boolean> {
	const config = await getConfig(forceReconfig);
	if (!config) {
		vscode.window.showErrorMessage("Cannot start visualization: invalid configuration");
		return false;
	}

	const msgToPlotView = {
		command: 'loadVisualization',
		data: {
			config: config,
			visualizationID: visualizationID
		}
	};

	console.log("Loading visualization with config:", config);

	MessageManager.sendToPlotView(msgToPlotView);

	return true;
}

export async function loadVisualizationThroughTreeItem(dataType: string, taskType: string, trainingProcess: string, visualizationID: string): Promise<boolean> {
    // Wait for settings to update before proceeding
    await updateBasicConfig(dataType, taskType, trainingProcess);

    // Call loadVisualization after settings are updated
    return await loadVisualization(false, visualizationID);
}

/**
 * Start visualizing
 */
export async function startVisualizing(): Promise<boolean> {
	const config = getBasicConfig();
	if (!config) {
		vscode.window.showErrorMessage("Cannot start visualization: invalid configuration");
		return false;
	}
	vscode.window.showInformationMessage("Start visualizing...");
	const visConfig = getVisConfig(config.visualizationMethod);

	const visualizationID = generateVisualizationId(config.visualizationMethod);

	const msgToPlotView = {
		command: 'startVisualizing',
		data: {
			contentPath: config.contentPath,
			visualizationMethod: config.visualizationMethod,
			visualizationID: visualizationID,
			dataType: config.dataType,
			taskType: config.taskType,
			visConfig: visConfig
		}
	};

	MessageManager.sendToPlotView(msgToPlotView);

	return true;
}

export async function startVisualizingThroughTreeItem(trainingProcess: string): Promise<boolean> {
    const dataType = await repickConfig(
        "Select the type of your data",
        [
            { iconId: "image-type", label: "Image" },
            { iconId: "text-type", label: "Text" },
        ]
    );
    const taskType = await repickConfig(
        "Select the type of your model task",
        [
            { iconId: "classification-task", label: "Classification" },
            { iconId: "non-classification-task", label: "Code-Retrieval" },
        ]
	);
	const visualizationMethod = await repickConfig(
		"Select the visualization method",
		[
			{ label: "UMAP", description: "(default)" },
			{ label: "TimeVis" },
			{ label: "DVI" },
			{ label: "DynaVis" },
		]
	);

    // Wait for settings to update before proceeding
	await updateBasicConfig(dataType, taskType, trainingProcess);
	
	vscode.window.showInformationMessage("Start visualizing...");
	const visConfig = getVisConfig(visualizationMethod);
	const visualizationID = generateVisualizationId(visualizationMethod);

	const workspacePath = getOpenedFolderPath();
	const contentPath = path.join(workspacePath, trainingProcess);

	const msgToPlotView = {
		command: 'startVisualizing',
		data: {
			contentPath: contentPath,
			visualizationMethod: visualizationMethod,
			visualizationID: visualizationID,
			dataType: dataType,
			taskType: taskType,
			visConfig: visConfig
		}
	};

	MessageManager.sendToPlotView(msgToPlotView);

	return true;
}