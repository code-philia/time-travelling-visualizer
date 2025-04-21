import * as vscode from 'vscode';
import * as fs from 'fs';
import * as CONFIG from './config';
import * as api from './api';
import { PlotViewManager } from "./views/plotView";
import { isDirectory } from './ioUtils';
import { getIconUri } from './resources';
import { MessageManager } from './views/messageManager';
import { fetchTrainingProcessInfo, fetchTrainingProcessStructure, getAttributeResource, getText, triggerStartVisualizing } from './communication/api';
import { defaultWorkspaceState } from './state';
import path from 'path';

/**
 * Config
 */
async function repickConfig( configDescription: string, items: (vscode.QuickPickItem & { iconId?: string })[]): Promise<string> {
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

	// TODO create a class for a configuration
	// that can both define the ID and validate the value

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
			{ label: "TrustVis", description: "(default)" },
			{ label: "TimeVis" },
			{ label: "DVI" },
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
	const visualizationID = visConfigSet.get(CONFIG.ConfigurationID.visualizationID);
	const workspacePath = getOpenedFolderPath();

	if(typeof trainingProcess !== 'string') {
		vscode.window.showErrorMessage("Invalid training process path");
		return undefined;
	}

	return {
		dataType: dataType,
		taskType: taskType,
		contentPath: path.join(workspacePath, trainingProcess),
		visualizationMethod: visualizationMethod,
		visualizationID: visualizationID,
	} as api.BasicVisualizationConfig | undefined;;
}

function updateBasicConfig(dataType: string, taskType: string, trainingProcess: string, visualizationMethod: string, visualizationID: string): Promise<void> {
    const visConfigSet = vscode.workspace.getConfiguration(CONFIG.configurationBaseName);
    return Promise.all([
        visConfigSet.update(CONFIG.ConfigurationID.dataType, dataType, vscode.ConfigurationTarget.Global), // Update user settings
        visConfigSet.update(CONFIG.ConfigurationID.taskType, taskType, vscode.ConfigurationTarget.Global), // Update user settings
        visConfigSet.update(CONFIG.ConfigurationID.trainingProcess, trainingProcess, vscode.ConfigurationTarget.Global), // Update user settings
        visConfigSet.update(CONFIG.ConfigurationID.visualizationMethod, visualizationMethod, vscode.ConfigurationTarget.Global), // Update user settings
        visConfigSet.update(CONFIG.ConfigurationID.visualizationID, visualizationID, vscode.ConfigurationTarget.Global), // Update user settings
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
	return {};
}

export function getPlotSettings(){
	const plotSettings = vscode.workspace.getConfiguration(CONFIG.configurationBaseName);
	const showIndex = plotSettings.get(CONFIG.ConfigurationID.showIndex);
	const showLabel = plotSettings.get(CONFIG.ConfigurationID.showLabel);
	const showBackground = plotSettings.get(CONFIG.ConfigurationID.showBackground);
	const showTrail = plotSettings.get(CONFIG.ConfigurationID.showTrail);
	const revealNeighborSameType = plotSettings.get(CONFIG.ConfigurationID.revealNeighborSameType);
	const revealNeighborCrossType = plotSettings.get(CONFIG.ConfigurationID.revealNeighborCrossType);

	return {
		showIndex: showIndex,
		showLabel: showLabel,
		showBackground: showBackground,
		showTrail: showTrail,
		revealNeighborSameType: revealNeighborSameType,
		revealNeighborCrossType: revealNeighborCrossType
	};
}

/**
 * Load the visualization result
 */
export async function loadVisualization(forceReconfig: boolean = false): Promise<boolean> {
	// 0. clear the workspace state
	const extensionContext = CONFIG.GlobalStorageContext.extensionContext;
	if(!extensionContext) {
		vscode.window.showErrorMessage("Cannot start visualization: extension context not found");
		return false;
	}
    Object.entries(defaultWorkspaceState).forEach(([key, value]) => {
        extensionContext.workspaceState.update(key, value);
    });

	// 1. create or show plot view
	if (!(PlotViewManager.view)) {
		try {
			await PlotViewManager.showView();
		} catch(e) {
			vscode.window.showErrorMessage(`Cannot start main view: ${e}`);
			return false;
		}
	}

	// 2. check the configuration
	const config = await getConfig(forceReconfig);
	if (!config) {
		vscode.window.showErrorMessage("Cannot start visualization: invalid configuration");
		return false;
	}
	
	// 3. connect with backend
	const data: {
		taskType?: string,
		availableEpochs?: number[],
		colorList?: number[][],
		labelTextList?: string[],
		tokenList?: string[],
		labelList?: number[],
	} = {};
	data['taskType'] = config.taskType;

	const availableEpochsRes: any = await fetchTrainingProcessStructure(config.contentPath);
	data['availableEpochs'] = availableEpochsRes['available_epochs'];

	const trainingInfoRes: any = await fetchTrainingProcessInfo(config.contentPath);
	data['colorList'] = trainingInfoRes['color_list'];
	if (data['colorList']) {
		const colorDict = new Map<number, [number, number, number]>();
		for (let i = 0; i < data['colorList'].length; i++) {
			colorDict.set(i, [data['colorList'][i][0], data['colorList'][i][1], data['colorList'][i][2]]);
		}
		extensionContext.workspaceState.update('colorDict', colorDict);
	}

	data['labelTextList'] = trainingInfoRes['label_text_list'];
	if (data['labelTextList']) {
		const labelDict = new Map<number, string>();
		for (let i = 0; i < data['labelTextList'].length; i++) {
			labelDict.set(i, data['labelTextList'][i]);
		}
		extensionContext.workspaceState.update('labelDict', labelDict);
	}

	const labelRes: any = await getAttributeResource(config.contentPath, 1, 'label');
	data['labelList'] = labelRes['label'];
	extensionContext.workspaceState.update('labelList', data['labelList']);

	if (config.taskType === "Code-Retrieval") {
		const textRes: any = await getText(config.contentPath);
		data['tokenList'] = textRes['text_list'];
		extensionContext.workspaceState.update('tokenList', data['tokenList']);
	}

	// 4. send message to views
	const settings = getPlotSettings();
	const msgToPlotView = {
		command: 'initPlotSettings',
		data: settings
	};
	MessageManager.sendToPlotView(msgToPlotView);

	const msgToPlotView1 = {
		command: 'initTrainingInfo',
		data: data
	};
	MessageManager.sendToPlotView(msgToPlotView1);

	const msgToDetailView = {
		command: 'init',
		data: {
			labels: data['labelList'],
			labelTextList: data['labelTextList']
		}
	}
	MessageManager.sendToDetailView(msgToDetailView);


	const msgToTokenView = {
		command: 'init',
		data: {
			labels: data['labelList'],
			tokenList: data['tokenList']
		}
	}
	MessageManager.sendToTokenView(msgToTokenView);

	return true;
}

export async function loadVisualizationThroughTreeItem(trainingProcess: string, visualizationID: string): Promise<boolean> {
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

    // Wait for settings to update before proceeding
    await updateBasicConfig(dataType, taskType, trainingProcess, visualizationID.split('_')[0], visualizationID);

    // Call loadVisualization after settings are updated
    return await loadVisualization();
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
	await triggerStartVisualizing(config.contentPath, config.visualizationMethod,config.taskType, visConfig );
	return true;
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
