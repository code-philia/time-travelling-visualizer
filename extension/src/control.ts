import * as vscode from 'vscode';
import * as fs from 'fs';
import * as config from './config';
import * as api from './api';
import { PlotViewManager } from "./views/plotView";
import { isDirectory } from './ioUtils';
import { getIconUri } from './resources';
import { MessageViewManager } from './views/metadataView';

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
	const visConfigSet = vscode.workspace.getConfiguration(config.configurationBaseName);
	const dataType = visConfigSet.get(config.ConfigurationID.dataType);
	const taskType = visConfigSet.get(config.ConfigurationID.taskType);
	const contentPath = visConfigSet.get(config.ConfigurationID.contentPath);
	const visualizationMethod = visConfigSet.get(config.ConfigurationID.visualizationMethod);
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
			{ iconId: "non-classification-task", label: "Non-Classification" },
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
			{ label: "TrustVis", description: "(default)" }
		]
	);
	if (!visualizationMethod) {
		return undefined;
	}

	visConfigSet.update(config.ConfigurationID.dataType, dataType);
	visConfigSet.update(config.ConfigurationID.taskType, taskType);
	visConfigSet.update(config.ConfigurationID.contentPath, contentPath);
	visConfigSet.update(config.ConfigurationID.visualizationMethod, visualizationMethod);

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

export async function startVisualization(forceReconfig: boolean = false): Promise<boolean> {
	if (!(PlotViewManager.view)) {
		try {
			await PlotViewManager.showView();
		} catch(e) {
			vscode.window.showErrorMessage(`Cannot start main view: ${e}`);
			return false;
		}
	}
	return await loadVisualizationPlot(forceReconfig);
}

// TODO does passing forceReconfig twice seem silly?
async function loadVisualizationPlot(forceReconfig: boolean = false): Promise<boolean> {
	const config = await getConfig(forceReconfig);

	if (config) {
		const { dataType, taskType, contentPath, visualizationMethod } = config;
		return await notifyVisualizationUpdate(dataType, taskType, contentPath, visualizationMethod);
	}
	return false;
}

async function notifyVisualizationUpdate(dataType: string, taskType: string, contentPath: string, visualizationMethod: string): Promise<boolean> {
	const msg = {
		command: 'update',
		contentPath: contentPath,
		customContentPath: '',
		taskType: taskType,
		dataType: dataType,
		forward: true		// recognized by live preview <iframe> (in dev) only
	};
	return await PlotViewManager.postMessage(msg);
}

class GeneralMessageHandler {
	static handlers: Map<string, (msg: any) => any> = new Map();
	static defaultHandler: (msg: any) => any = (msg) => {};

	static {
		this.initGlobalMessageHandlers();
	}

	static initGlobalMessageHandlers(): void {
		this.addHandler('update', (msg) => {
			console.log('message: update', msg);
			if (PlotViewManager.view) {
				PlotViewManager.postMessage(msg);
			} else {
				console.log("Cannot find mainView. Message: update not passed...");
			}
		});
		this.addHandler('updateDataPoint', (msg) => {
			console.log('message: updateDataPoint', msg);
			if (MessageViewManager.view) {
                msg.command = 'sync';
                // TODO should use MetadataViewManager.view.postMessage
                // for consistency?
				MessageViewManager.postMessage(msg);
			} else {
				console.log("Cannot find metadata_view");
			}
		});
		this.setDefaultHandler(async (msg) => {
			// In early design, forward it as is to the main view
			// with additional basic configuration fields
			console.log('message: other type', msg);
			if (PlotViewManager.panel) {
				let config = checkDefaultVisualizationConfig();
				if (!config) {
					vscode.window.showWarningMessage("No valid configuration found yet. Generating a new one...");
					config = await reconfigureVisualizationConfig();
					if (!config) {
						return;
					}
				}
				msg.contentPath = config.contentPath;
				msg.customContentPath = '';
				msg.taskType = config.taskType;
				msg.dataType = config.dataType;
				PlotViewManager.panel.webview.postMessage(msg);
			} else {
				console.log("Cannot find mainView. Message: other type not passed...");
            }

            MessageViewManager.postMessage(msg);
		});
	}

	static addHandler(command: string, handler: (msg: any) => void): void {
		this.handlers.set(command, handler);
	}

	static setDefaultHandler(handler: (msg: any) => void): void {
		this.defaultHandler = handler;
	}

	// NOTE don't use this static method as an outside handler directly
	// cause `this` is not bound
	static handleMessage(msg: any): boolean {
		// Returns true if there is a command handler for it
		const handler = this.handlers.get(msg.command);
		if (handler) {
			handler(msg);
			return true;
		} else {
			this.defaultHandler(msg);
			return false;
		}
	}

	private constructor() { }
}

export function handleMessageDefault(msg: any): boolean {
	return GeneralMessageHandler.handleMessage(msg);
}

function setDataFolder(file: vscode.Uri | undefined): boolean {
	if (!file) {
		return false;
	}
	const fsPath = file.fsPath;
	if (isDirectory(fsPath)) {
		const extensionConfig = vscode.workspace.getConfiguration('timeTravellingVisualizer');
		extensionConfig.update(config.ConfigurationID.contentPath, fsPath);
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
