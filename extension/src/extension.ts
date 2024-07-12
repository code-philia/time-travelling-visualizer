import { readFileSync } from 'fs';
import path from 'path';
import * as vscode from 'vscode';
import { LiveServerParams, start as startServer } from 'live-server';
import * as resources from './resources';
import * as fs from 'fs';

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

	if (context.globalState.get('lastSuccess') === undefined) {		// FIXME: is checking "if last time access is ok" useful?
		context.globalState.update('lastSuccess', false);
	}
	context.subscriptions.push(
		vscode.commands.registerCommand('timeTravellingVisualizer.start', startMainView),
		vscode.commands.registerCommand('timeTravellingVisualizer.setAsDataFolderAndLoadVisualizationResult', (file) => {
			setDataFolder(context, file, true);
		}),
		vscode.commands.registerCommand('timeTravellingVisualizer.setAsDataFolder', (file) => {
			setDataFolder(context, file, false);
		})
	);
	
	
	// context.subscriptions.push(
	// 	vscode.commands.registerCommand('timeTravellingVisualizer.dialog', () => {
	// 		vscode.window.showOpenDialog();
	// 	})
	// );
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			'basic-view',
			new SidebarWebviewViewProvider(context, isDev ? sideBarWebviewPort : undefined, isDev ? '/basic_view.html' : undefined)
		),
		vscode.window.registerWebviewViewProvider(
			'advanced-view',
			new SidebarWebviewViewProvider(context, isDev ? sideBarWebviewPort : undefined, isDev ? '/advanced_view.html' : undefined)
		)
	);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			'panel-view',
			// new SidebarWebviewViewProvider(context, isDev ? panelWebviewPort : undefined, isDev ? '/quick_panel.html' : undefined)
			new SidebarWebviewViewProvider(context)
		)
	);

	// global state

	const folderPathInputBoxOptions: vscode.InputBoxOptions = {
		prompt: "Please enter the folder path where the visualization result is stored",
		placeHolder: "Folder path",
		value: vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? "",
	};


	const loadVisualizationResultCommmand = vscode.commands.registerCommand('timeTravellingVisualizer.loadVisualizationResult', async () => {
		const lastSuccess = context.globalState.get('lastSuccess') as boolean;

		const thisSuccess = loadVisualization(context, lastSuccess);
		context.globalState.update('lastSuccess', thisSuccess);
	});
}

export function deactivate() { }

async function startMainView() {
	if (views["mainView"]) {
		return;
	}

	const panel = vscode.window.createWebviewPanel(
		'customEditor',
		'My Custom Editor',
		vscode.ViewColumn.One,
		getDefaultWebviewOptions()
	);

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
	if (fs.existsSync(fsPath) && fs.statSync(fsPath).isDirectory()) {
		const config = vscode.workspace.getConfiguration('timeTravellingVisualizer');
		config.update('loadVisualization.contentPath', fsPath);
		if (loadVis) {
			loadVisualization(context, false);
		}
	} else {
		vscode.window.showErrorMessage("Selected file is not a directory 😮");
	}
}

async function repickConfig(
	context: vscode.ExtensionContext,
	configBase: vscode.WorkspaceConfiguration,
	configSection: string,
	configDescription: string,
	items: (vscode.QuickPickItem & { iconId?: string })[],
	lastSuccess: boolean,
): Promise<string> {
	if (lastSuccess) {
		const defaultConfig = configBase.get(configSection);
		if (defaultConfig && typeof defaultConfig === 'string' && items.some(item => item.label === defaultConfig)) {
			return defaultConfig;
		}
	}
	const quickPickitems: vscode.QuickPickItem[] = items.map(item => {
		return {
			...item,
			iconPath: item.iconId ? resources.getIconUri(context, item.iconId) : undefined,
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
	const config = vscode.workspace.getConfiguration('timeTravellingVisualizer');
	const dataType = config.get('loadVisualization.dataType');
	const taskType = config.get('loadVisualization.taskType');
	const contentPath = config.get('loadVisualization.contentPath');
	const visualizationMethod = config.get('loadVisualization.visualizationMethod');
	if (typeof dataType === 'string' && typeof taskType === 'string' && typeof contentPath === 'string' && typeof visualizationMethod === 'string') {
		return {
			dataType: dataType,
			taskType: taskType,
			contentPath: contentPath,
			visualizationMethod: visualizationMethod,
		};
	}
	return undefined;
}

async function reconfigureVisualizationConfig(context: vscode.ExtensionContext, lastSuccess: boolean): Promise<BasicVisualizationConfig | undefined> {
	const config = vscode.workspace.getConfiguration('timeTravellingVisualizer');	// Should we call this each time?

	const dataType = await repickConfig(
		context,
		config,
		'loadVisualization.dataType',
		"Select the type of your data",
		[
			{ iconId: "image-type", label: "Image" },
			{ iconId: "text-type", label: "Text" },
		],
		lastSuccess
	);
	if (!dataType) {
		return undefined;
	}

	const taskType = await repickConfig(
		context,
		config,
		'loadVisualization.taskType',
		"Select the type of your model task",
		[
			{ iconId: "classification-task", label: "Classification" },
			{ iconId: "non-classification-task", label: "Non-Classification" },
		],
		lastSuccess
	);
	if (!taskType) {
		return undefined;
	}

	const contentPathConfig = config.get('loadVisualization.contentPath');
	var contentPath: string = "";
	if (!(typeof contentPathConfig === 'string' && fs.existsSync(contentPathConfig))) {
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
				if (fs.existsSync(value)) {
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

		if (!fs.existsSync(contentPath)) {
			return undefined;
		}
	} else {
		contentPath = contentPathConfig;
	}

	const visualizationMethod = await repickConfig(
		context,
		config,
		'loadVisualization.visualizationMethod',
		"Select the visualization method",
		[
			{ label: "TrustVis", description: "(default)" }
		],
		lastSuccess
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

async function loadVisualization(context: vscode.ExtensionContext, lastSuccess: boolean): Promise<boolean> {
	var result = checkDefaultVisualizationConfig();
	if (!result) {
		result = await reconfigureVisualizationConfig(context, lastSuccess);
	}

	if (result) {
		const { dataType, taskType, contentPath, visualizationMethod } = result;
		if (await callVisualizationAPI(dataType, taskType, contentPath, visualizationMethod)) {
			return true;
		} 
	}
	return false;
}

async function callVisualizationAPI(dataType: string, taskType: string, contentPath: string, visualizationMethod: string): Promise<boolean> {
	// vscode.window.showInformationMessage(`Loading visualization for ${dataType} data, ${taskType} task, ${contentPath} content, and ${visualizationMethod} method...`);
	// return true;
	if (!("mainView" in views)) {
		try {
			await startMainView();
		} catch(e) {
			vscode.window.showErrorMessage(`Cannot start main view: ${e}`);
			return false;
		}
	}

	return await views["mainView"].postMessage({
		command: 'update',
		contentPath: contentPath,
		customContentPath: '',
		taskType: taskType,
		dataType: dataType,
		forward: true		// recognized by live preview <iframe> (in dev) only
	});
}

function getDefaultWebviewOptions() {
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
				src="http://localhost:${localPort}${path}"></iframe>
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
			enableScripts: true
		};

		webviewView.webview.onDidReceiveMessage(async (msg) => {
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
				default:
					{
						// In early design, forward it as is
						// with additional basic configuration fields
						console.log('message: other type', msg);
						if ("mainView" in views) {
							let config = checkDefaultVisualizationConfig();
							if (!config) {
								vscode.window.showWarningMessage("No valid configuration found yet. Generating a new one...");
								config = await reconfigureVisualizationConfig(this.context, false);
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
		});
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
