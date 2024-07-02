import { readFileSync } from 'fs';
import path from 'path';
import * as vscode from 'vscode';
import { LiveServerParams, start as startServer } from 'live-server';
import * as fs from 'fs';

var isDev = true;
const relativeRoot = 'web/';
const editorWebviewPort = 5001;
const sideBarWebviewPort = 5002;
const panelWebviewPort = 5003;
var webRoot = path.join(__dirname, relativeRoot);

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

	context.subscriptions.push(
		vscode.commands.registerCommand('myExtension.start', () => {
			const panel = vscode.window.createWebviewPanel(
				'customEditor',
				'My Custom Editor',
				vscode.ViewColumn.One,
				getDefaultWebviewOptions()
			);

			if (isDev) {
				panel.webview.html = getForwardWebviewContent(panel.webview, editorWebviewPort);
			} else {
				panel.webview.html = loadHomePage(
					panel.webview,
					path.join(webRoot, 'index.html'),
					'Frontend',
					webRoot
				);
			}
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('myExtension.dialog', () => {
			vscode.window.showOpenDialog();
		})
	);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			'myView',
			new MySideBarWebviewViewProvider(context, isDev ? sideBarWebviewPort : undefined)
		)
	);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			'myPanelView',
			new MySideBarWebviewViewProvider(context, isDev ? panelWebviewPort : undefined)
		)
	);
}

export function deactivate() { }

function getDefaultWebviewOptions() {
	const resourceUri = vscode.Uri.file(webRoot);
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
		wait: 1000,
		logLevel: 2, // 0 = errors only, 1 = some, 2 = lots
	};
	startServer(params);
}

function loadHomePage(webview: vscode.Webview, root: string, mapSrc: string, mapDst: string) {
	const html = readFileSync(root, 'utf8');
	return replaceUri(html, webview, mapSrc, mapDst);
}

function replaceUri(html: string, webview: vscode.Webview, src: string, dst: string) {
	// replace all 'scr="Frontend/..."' URI using webview.asWebviewUri,
	// which is hosted by VS Code client,
	// or it cannot be loaded
	const cssFormattedHtml = html.replace(new RegExp(`(?<=href\="|src\=")(?:\/?${src}\/)([^"]*)(?=")`, 'g'), (match, p1) => {
		if (match) {
			// console.log(`matched: ${match}`);
			const formattedCss = webview.asWebviewUri(vscode.Uri.file(path.join(dst, p1)));
			return formattedCss.toString();
		}
		return "";
	});

	return cssFormattedHtml;
}

function getDemoWebviewContent() {
	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Custom Editor</title>
	</head>
	<body>
		<h1>Hello, Custom Editor!</h1>
	</body>
	</html>`;
}

function getForwardWebviewContent(webview: vscode.Webview, localPort: number = 5000) {
	return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Localhost</title>
        </head>
        <body>
            <iframe src="http://localhost:${localPort}" width="100%" height="100%" style="border:none;"></iframe>
        </body>
        </html>
    `;
}

class MySideBarWebviewViewProvider implements vscode.WebviewViewProvider {
	private readonly context: vscode.ExtensionContext;
	private readonly port?: number;

	constructor(context: vscode.ExtensionContext, port?: number) {
		this.context = context;
		this.port = port;
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		token: vscode.CancellationToken
	) {
		if (this.port) {
			webviewView.webview.html = getForwardWebviewContent(webviewView.webview, this.port);
			return;
		}

		webviewView.webview.options = getDefaultWebviewOptions();

		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'colorSelected':
					{
						vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
						break;
					}
				default:
					{
						break;
					}
			}
		});
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
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
