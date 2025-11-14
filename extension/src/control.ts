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
	const visualizationID = visConfigSet.get(CONFIG.ConfigurationID.visualizationID);
	const workspacePath = getOpenedFolderPath();

	if (api.Types.VisualizationDataType.has(dataType) &&
		api.Types.VisualizationTaskType.has(taskType) &&
		typeof trainingProcess === 'string' && typeof visualizationID === 'string' &&
		api.Types.VisualizationMethod.has(visualizationMethod)) {
		return {
			dataType: dataType,
			taskType: taskType,
			contentPath: path.join(workspacePath, trainingProcess),
			visualizationMethod: visualizationMethod,
			visualizationID: visualizationID,
		};
	}
	return undefined;
}

async function reconfigureVisualizationConfig(): Promise<api.BasicVisualizationConfig | undefined> {
	const visConfigSet = vscode.workspace.getConfiguration('timeTravellingVisualizer');

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

	const contentPathConfig = "";
	let trainingProcess: string = "";
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
							inputBox.value = fs.realpathSync.native(pathResult);
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
		visualizationMethod: visualizationMethod,
		visualizationID: "",
	};
}

async function getConfig(forceReconfig: boolean = false): Promise<api.BasicVisualizationConfig | undefined> {
	let config: api.BasicVisualizationConfig | undefined;
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
	const visualizationID = visConfigSet.get(CONFIG.ConfigurationID.visualizationID);
	const workspacePath = getOpenedFolderPath();

	if (typeof trainingProcess !== 'string') {
		vscode.window.showErrorMessage("Invalid training process path");
		return undefined;
	}

	return {
		dataType: dataType,
		taskType: taskType,
		contentPath: path.join(workspacePath, trainingProcess),
		visualizationMethod: visualizationMethod,
		visualizationID: visualizationID,
	} as api.BasicVisualizationConfig | undefined;
}

function updateBasicConfig(
    dataType: string,
    taskType: string,
    trainingProcess: string,
    visualizationID: string
): Promise<void> {
    const visConfigSet = vscode.workspace.getConfiguration(CONFIG.configurationBaseName);

    return Promise
        .all([
            visConfigSet.update(CONFIG.ConfigurationID.dataType, dataType, vscode.ConfigurationTarget.Global),
            visConfigSet.update(CONFIG.ConfigurationID.taskType, taskType, vscode.ConfigurationTarget.Global),
            visConfigSet.update(CONFIG.ConfigurationID.trainingProcess, trainingProcess, vscode.ConfigurationTarget.Global),
            visConfigSet.update(CONFIG.ConfigurationID.visualizationID, visualizationID, vscode.ConfigurationTarget.Global),
        ])
        .then(() => {
            // All good, nothing to return -> Promise<void>
        })
        .catch((err) => {
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

export function getPlotSettings() {
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
export async function loadVisualization(forceReconfig: boolean = false): Promise<boolean> {
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

	MessageManager.sendToPlotView(msgToPlotView);

	return true;
}

export async function loadVisualizationThroughTreeItem(dataType: string, taskType: string, trainingProcess: string, visualizationID: string): Promise<boolean> {
	await updateBasicConfig(dataType, taskType, trainingProcess, visualizationID);
	return await loadVisualization();
}

/**
 * Start visualizing
 */
export async function startVisualizing(): Promise<boolean> {
	const basicConfig = getBasicConfig();

	if (!basicConfig) {
		vscode.window.showErrorMessage("Cannot start visualizing: invalid basic configuration");
		return false;
	}

	const { dataType, taskType, contentPath, visualizationMethod, visualizationID } = basicConfig;

	if (!visualizationMethod) {
		vscode.window.showErrorMessage("Cannot start visualizing: visualization method is not set");
		return false;
	}

	const visConfig = getVisConfig(String(visualizationMethod));

	const configForStart = {
		contentPath: contentPath,
		visMethod: visualizationMethod,
		visID: visualizationID,
		dataType: dataType,
		taskType: taskType,
		visConfig: visConfig,
	};


  
	console.log("Starting visualizing with config:", configForStart);

	const msgToPlotView = {
		command: 'startVisualizing',
		data: {
			config: configForStart,
		},
	};

	MessageManager.sendToPlotView(msgToPlotView);

	return true;
}

export async function startVisualizingThroughTreeItem(
	dataTypeOrTrainingProcess: string,
	taskType?: string,
	trainingProcess?: string,
	visualizationID?: string
): Promise<boolean> {
	// Case 1: called with 4 arguments:
	//   (dataType, taskType, trainingProcess, visualizationID)
	if (taskType && trainingProcess && typeof visualizationID === 'string') {
		// Update full basic config from tree item selection
		await updateBasicConfig(
			dataTypeOrTrainingProcess, // dataType
			taskType,
			trainingProcess,
			visualizationID
		);

		// Then trigger start visualizing with the current config
		return await startVisualizing();
	}

	// Case 2: called with a single argument:
	//   (trainingProcess)
	// This keeps compatibility with older call sites that only pass the path
	const trainingProcessPath = dataTypeOrTrainingProcess;

	// Update just the training process in the user settings
	const visConfigSet = vscode.workspace.getConfiguration(CONFIG.configurationBaseName);
	await visConfigSet.update(
		CONFIG.ConfigurationID.trainingProcess,
		trainingProcessPath,
		vscode.ConfigurationTarget.Global
	);

	// Now start visualizing using whatever dataType/taskType/etc. are already saved
	return await startVisualizing();
}

/**
 * Other commands
 */
function setDataFolder(file: vscode.Uri | undefined): boolean {
	if (!file) {
		return false;
	}
	const fsPath = file.fsPath;
	if (isDirectory(fsPath)) {
		const extensionConfig = vscode.workspace.getConfiguration('timeTravellingVisualizer');
		extensionConfig.update(CONFIG.ConfigurationID.trainingProcess, fsPath);
		return true;
	} else {
		vscode.window.showErrorMessage("Selected path is not a directory 😮");
		return false;
	}
}

export function setAsDataFolderAndLoadVisualizationResult(file: vscode.Uri | undefined): void {
	if (!(file instanceof vscode.Uri)) {
		return;
	}
	const success = setDataFolder(file);
	if (success) {
		loadVisualization();
	}
}

export function setAsDataFolder(file: vscode.Uri | undefined): void {
	if (!(file instanceof vscode.Uri)) {
		return;
	}
	setDataFolder(file);
}
