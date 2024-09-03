import { readFileSync } from 'fs';
import path from 'path';
import * as vscode from 'vscode';
import { LiveServerParams, start as startServer } from 'live-server';
import * as resources from './resources';
import * as fs from 'fs';
import { CommandNames, VisualizationContentPathConfigurationName, VisualizationDataType, VisualizationDataTypeConfigurationName, VisualizationMethod, VisualizationMethodConfigurationName, VisualizationTaskType, VisualizationTaskTypeConfigurationName, VisualizerConfigurationBaseName } from './api';
import { isDirectory } from './io';

var isDev = true;
const relativeRoot = 'web/';
const editorWebviewPort = 5001;
const sideBarWebviewPort = 5002;
const panelWebviewPort = 5003;
var webRoot = path.join(__dirname, relativeRoot);

const views: { [key: string]: vscode.Webview } = {};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Cannot read args in launch.json due to
	// vscode using an extension host to manage extensions
	// Setting isDev directly here
	webRoot = path.join(context.extensionUri.fsPath, relativeRoot);

	if (isDev) {
		console.log(`Enabling dev mode locally. Webviews are using live updated elements...`);
		startDefaultDevLiveServers(context);
	}

	resources.setResourceUri(context.extensionUri);

	context.subscriptions.push(
		vscode.commands.registerCommand('timeTravellingVisualizer.start', startMainView),
		vscode.commands.registerCommand('timeTravellingVisualizer.setAsDataFolderAndLoadVisualizationResult', (file) => {
			setDataFolder(context, file, true);
		}),
		vscode.commands.registerCommand('timeTravellingVisualizer.setAsDataFolder', (file) => {
			setDataFolder(context, file, false);
		})
	);
	
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			'visualizer-metadata-view',
			new SidebarWebviewViewProvider(context, isDev ? panelWebviewPort : undefined, isDev ? '/metadata_view.html' : undefined, 'metadata_view'),
			{ webviewOptions: { retainContextWhenHidden: true } }
		)
	);

	const name = CommandNames.configureAndLoadVisualization;

	context.subscriptions.push(
		vscode.commands.registerCommand(CommandNames.loadVisualization, async () => {
			await loadVisualization();
		}),
		vscode.commands.registerCommand(CommandNames.configureAndLoadVisualization, async () => {
			await loadVisualization(true);
		})
	);
}

export function deactivate() { }

async function startMainView() {
	if (views["mainView"]) {
		return;
	}

	const panel = vscode.window.createWebviewPanel(
		'customEditor',
		'Visualizer',
		vscode.ViewColumn.One,
		{ retainContextWhenHidden: true, ...getDefaultWebviewOptions() }
	);

	panel.iconPath = vscode.Uri.file(path.join(webRoot, '..', 'resources/eye_tracking_24dp_5F6368_FILL0_wght300_GRAD0_opsz24.svg'));

	if (isDev) {
		panel.webview.html = getForwardWebviewContent(panel.webview, editorWebviewPort, true);
	} else {
		panel.webview.html = loadHomePage(
			panel.webview,
			path.join(webRoot, 'index.html'),
			'(?!http:\\/\\/|https:\\/\\/)([^"]*\\.[^"]+)',	// remember to double-back-slash here
			webRoot
		);
	}
	
	panel.onDidChangeViewState((e) => {
		console.log(`Panel view state changed: ${e.webviewPanel.active}`);
	});
	panel.onDidDispose((e) => {
		delete views["mainView"];
	});

	// TODO the iframe would not be refreshed for not receiving "update" message, which is a handicap for live preview in development
	// reload the data when the iframe is refreshed, maybe by posting a message to vscode to ask for several major arguments
	panel.webview.onDidReceiveMessage(handleGlobalMessage);

	const loaded = new Promise((resolve, reject) => {
		panel.webview.onDidReceiveMessage((msg) => {		// this will add a listener, not overwriting
			if (msg.state === 'load') {
				views["mainView"] = panel.webview;
				resolve(undefined);
			}
		});
	});
	await loaded;
}

function setDataFolder(context: vscode.ExtensionContext, file: any, loadVis: boolean = false) {
	if (!file) {
		return;
	}
	const fsPath = file.fsPath;
	if (isDirectory(fsPath)) {
		const config = vscode.workspace.getConfiguration('timeTravellingVisualizer');
		config.update('loadVisualization.contentPath', fsPath);
		if (loadVis) {
			loadVisualization();
		}
	} else {
		vscode.window.showErrorMessage("Selected file is not a directory 😮");
	}
}

async function repickConfig(
	configDescription: string,
	items: (vscode.QuickPickItem & { iconId?: string })[]
): Promise<string> {
	const quickPickitems: vscode.QuickPickItem[] = items.map(item => {
		return {
			...item,
			iconPath: item.iconId ? resources.getIconUri(item.iconId) : undefined,
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

type BasicVisualizationConfig = {
	dataType: string,
	taskType: string,
	contentPath: string,
	visualizationMethod: string,
};

function checkDefaultVisualizationConfig(): BasicVisualizationConfig | undefined {
	const config = vscode.workspace.getConfiguration(VisualizerConfigurationBaseName);
	const dataType = config.get(VisualizationDataTypeConfigurationName);
	const taskType = config.get(VisualizationTaskTypeConfigurationName);
	const contentPath = config.get(VisualizationContentPathConfigurationName);
	const visualizationMethod = config.get(VisualizationMethodConfigurationName);
	if (VisualizationDataType.is(dataType) &&
		VisualizationTaskType.is(taskType) &&
		typeof contentPath === 'string' && isDirectory(contentPath) && 
		VisualizationMethod.is(visualizationMethod)) {
		return {
			dataType: dataType,
			taskType: taskType,
			contentPath: contentPath,
			visualizationMethod: visualizationMethod,
		};
	}
	return undefined;
}

async function reconfigureVisualizationConfig(): Promise<BasicVisualizationConfig | undefined> {
	const config = vscode.workspace.getConfiguration('timeTravellingVisualizer');	// Should we call this each time?

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

	config.update('loadVisualization.dataType', dataType);
	config.update('loadVisualization.taskType', taskType);
	config.update('loadVisualization.contentPath', contentPath);
	config.update('loadVisualization.visualizationMethod', visualizationMethod);

	return {
		dataType: dataType,
		taskType: taskType,
		contentPath: contentPath,
		visualizationMethod: visualizationMethod,
	};
}

async function getConfig(forceReconfig: boolean = false): Promise<BasicVisualizationConfig | undefined> {
	var config: BasicVisualizationConfig | undefined;
	if (!forceReconfig) {
		config = checkDefaultVisualizationConfig();
		if (config) {
			return config;
		}
	}
	config = await reconfigureVisualizationConfig();
	return config;
}

async function loadVisualization(forceReconfig: boolean = false): Promise<boolean> {
	const config = await getConfig(forceReconfig);

	if (config) {
		const { dataType, taskType, contentPath, visualizationMethod } = config;
		if (!("mainView" in views)) {
			try {
				await startMainView();
			} catch(e) {
				vscode.window.showErrorMessage(`Cannot start main view: ${e}`);
				return false;
			}
		}
		return await notifyVisualizationUpdate(dataType, taskType, contentPath, visualizationMethod);
	}
	return false;
}

async function notifyVisualizationUpdate(dataType: string, taskType: string, contentPath: string, visualizationMethod: string): Promise<boolean> {
	return await views["mainView"].postMessage({
		command: 'update',
		contentPath: contentPath,
		customContentPath: '',
		taskType: taskType,
		dataType: dataType,
		forward: true		// recognized by live preview <iframe> (in dev) only
	});
}

function getDefaultWebviewOptions(): vscode.WebviewOptions {
	const resourceUri = vscode.Uri.file(webRoot);
	// console.log(`Resource URI: ${resourceUri}`);
	return {
		"enableScripts": true,
		"localResourceRoots": [
			resourceUri
		]
	};
}

function startDefaultDevLiveServers(context: vscode.ExtensionContext) {
	const htmlPath = webRoot;
	startSingleLiveServer(htmlPath, editorWebviewPort);		// different from preprocessing HTML in vscode
	// we don't need to relocate the URI in server hosted page
	startSingleLiveServer(htmlPath, sideBarWebviewPort);
	startSingleLiveServer(htmlPath, panelWebviewPort);
}

function startSingleLiveServer(htmlPath: string, port: number) {
	const params: LiveServerParams = {
		port: port,
		host: "127.0.0.1",
		root: htmlPath,
		open: false,
		wait: 100,
		logLevel: 2, // 0 = errors only, 1 = some, 2 = lots
	};
	startServer(params);
}

function loadHomePage(webview: vscode.Webview, root: string, mapSrc: string, mapDst: string) {
	const html = readFileSync(root, 'utf8');
	return replaceUri(html, webview, mapSrc, mapDst);
}

function replaceUri(html: string, webview: vscode.Webview, srcPattern: string, dst: string) {
	// replace all 'matched pattern' URI using webview.asWebviewUri,
	// which is hosted by VS Code client,
	// or it cannot be loaded
	// where the regex pattern should yield the first group as a correct relative path
	const cssFormattedHtml = html.replace(new RegExp(`(?<=href\="|src\=")${srcPattern}(?=")`, 'g'), (match, ...args) => {
		if (match) {
			// console.log(`matched: ${match}`);
			const formattedCss = webview.asWebviewUri(vscode.Uri.file(path.join(dst, args[0])));
			return formattedCss.toString();
		}
		return "";
	});

	return cssFormattedHtml;
}

// TODO split the views into different folders, otherwise updating resource of one view will refresh all
function getForwardWebviewContent(webview: vscode.Webview, localPort: number = 5000, notifyLoad: boolean = false, path: string = '/') {
	const notifyLoadScript = notifyLoad ? `
			window.addEventListener('load', () => {
				console.log('Webview loaded');
				vscode.postMessage({ state: 'load', forward: true });	// add forward to avoid bounce-back
			});
	` : '';
	
	return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Localhost</title>
			<style>
				body, html {
					height: 100%;
					padding: 0;
					margin: 0;
				}
				iframe {
					width: 100%;
					height: 100%;
					border: none;
					display: block;
				}
			</style>
        </head>
        <body>
            <iframe id="debug-iframe" sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"
				src="http://127.0.0.1:${localPort}${path}"></iframe>
        </body>
        </html>
		<script>
			const vscode = acquireVsCodeApi();
			window.addEventListener('message', e => {
				console.log('Received message raw:', e);
				const data = e['data'];
				if (e.origin.startsWith('vscode-webview')) {		// from vscode, forwarded to iframe
					const debugIframe = document.getElementById('debug-iframe');
					debugIframe.contentWindow.postMessage(data, '*');
				} else {											// from iframe, forwarded to vscode
					vscode.postMessage(data);
				}
			},false);
			${notifyLoadScript}
		</script>
    `;
}

class SidebarWebviewViewProvider implements vscode.WebviewViewProvider {
	private readonly context: vscode.ExtensionContext;
	private readonly port?: number;
	private readonly path?: string;
	private readonly id?: string;


	constructor(context: vscode.ExtensionContext, port?: number, path?: string, id?: string) {
		this.context = context;
		this.port = port;
		this.path = path;
		this.id = id;
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		token: vscode.CancellationToken
	) {
		if (this.id) {
			views[this.id] = webviewView.webview;
		}

		webviewView.webview.options = getDefaultWebviewOptions();

		if (!this.port) {
			webviewView.webview.html = this.getPlacehoderHtmlForWebview(webviewView.webview);		// FIXME: the static version (for prod) is not updated																					// to be the same as live preview version (for dev) yet
			return;
		}

		webviewView.webview.html = getForwardWebviewContent(webviewView.webview, this.port, false, this.path);
		webviewView.webview.options = {
			enableScripts: true,
		};

		webviewView.webview.onDidReceiveMessage(handleGlobalMessage);
	}

	private getPlacehoderHtmlForWebview(webview: vscode.Webview): string {
		return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>My Custom View</title>
        </head>
        <body>
            <h1>Hello from My Custom View!</h1>
        </body>
        </html>`;
	}
}

async function handleGlobalMessage(msg: any) {
	console.log("Msg Recv");
	switch (msg.command) {
		case 'update':
			{
				console.log('message: update', msg);
				if ("mainView" in views) {
					views["mainView"].postMessage(msg);
				} else {
					console.log("Cannot find mainView. Message: update not passed...");
				}
				break;
			}
		case 'updateDataPoint':
			{
				console.log('message: updateDataPoint', msg);
				if ("metadata_view" in views) {
					msg.command = 'sync';
					views["metadata_view"].postMessage(msg);
				} else {
					console.log("Cannot find metadata_view");
				}
				break;
			}
		default:
			{
				// In early design, forward it as is
				// with additional basic configuration fields
				console.log('message: other type', msg);
				if ("mainView" in views) {
					let config = checkDefaultVisualizationConfig();
					if (!config) {
						vscode.window.showWarningMessage("No valid configuration found yet. Generating a new one...");
						config = await reconfigureVisualizationConfig();
						if (!config) {
							break;
						}
					}
					msg.contentPath = config.contentPath;
					msg.customContentPath = '';
					msg.taskType = config.taskType;
					msg.dataType = config.dataType;
					views["mainView"].postMessage(msg);
				} else {
					console.log("Cannot find mainView. Message: other type not passed...");
				}
				break;
			}
	}
}
