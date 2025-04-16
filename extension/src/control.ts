import * as vscode from 'vscode';
import * as fs from 'fs';
import * as CONFIG from './config';
import * as api from './api';
import { PlotViewManager } from "./views/plotView";
import { isDirectory } from './ioUtils';
import { getIconUri } from './resources';
import { MessageManager } from './views/messageManager';
import { fetchTrainingProcessInfo, fetchTrainingProcessStructure, getAttributeResource, getText } from './communication/api';
import { defaultWorkspaceState } from './state';

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

function checkDefaultVisualizationConfig(): api.BasicVisualizationConfig | undefined {
	const visConfigSet = vscode.workspace.getConfiguration(CONFIG.configurationBaseName);
	const dataType = visConfigSet.get(CONFIG.ConfigurationID.dataType);
	const taskType = visConfigSet.get(CONFIG.ConfigurationID.taskType);
	const contentPath = visConfigSet.get(CONFIG.ConfigurationID.contentPath);
	const visualizationMethod = visConfigSet.get(CONFIG.ConfigurationID.visualizationMethod);
	// TODO create a class for a configuration
	// that can both define the ID and validate the value

	if (api.Types.VisualizationDataType.has(dataType) &&
		api.Types.VisualizationTaskType.has(taskType) &&
		typeof contentPath === 'string' && isDirectory(contentPath) &&
		api.Types.VisualizationMethod.has(visualizationMethod)) {
		return {
			dataType: dataType,
			taskType: taskType,
			contentPath: contentPath,
			visualizationMethod: visualizationMethod,
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
	var contentPath: string = "";
	if (!(typeof contentPathConfig === 'string' && isDirectory(contentPathConfig))) {
		contentPath = await new Promise((resolve, reject) => {
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

		if (!isDirectory(contentPath)) {
			return undefined;
		}
	} else {
		contentPath = contentPathConfig;
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
	visConfigSet.update(CONFIG.ConfigurationID.contentPath, contentPath);
	visConfigSet.update(CONFIG.ConfigurationID.visualizationMethod, visualizationMethod);

	return {
		dataType: dataType,
		taskType: taskType,
		contentPath: contentPath,
		visualizationMethod: visualizationMethod,
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

export function getCurrentConfig() {
	var config: api.BasicVisualizationConfig | undefined;
	config = checkDefaultVisualizationConfig();
	if (!config) {
		vscode.window.showErrorMessage("Cannot start visualization: invalid configuration");
	}
	return config;
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
 * Start the visualization
 */
export async function startVisualization(forceReconfig: boolean = false): Promise<boolean> {
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
		originalText?: Record<string, string>,
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

		const originalTextRes: any = await getAttributeResource(config.contentPath, 1, 'originalText');
		data['originalText'] = originalTextRes['originalText'];
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
			tokenList: data['tokenList'],
			originalText: data['originalText'],
		}
	}
	MessageManager.sendToTokenView(msgToTokenView);
	
	return true;
}

function setDataFolder(file: vscode.Uri | undefined): boolean {
	if (!file) {
		return false;
	}
	const fsPath = file.fsPath;
	if (isDirectory(fsPath)) {
		const extensionConfig = vscode.workspace.getConfiguration('timeTravellingVisualizer');
		extensionConfig.update(CONFIG.ConfigurationID.contentPath, fsPath);
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
        startVisualization();
    }
}

export function setAsDataFolder(file: vscode.Uri | undefined): void {
    if (!(file instanceof vscode.Uri)) {
        return;
    }
    setDataFolder(file);
}
