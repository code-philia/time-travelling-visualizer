import * as vscode from 'vscode';
import * as config from '../config';
import { getLiveWebviewHtml } from '../devLiveServer';
import { handleMessageDefault } from '../control';
import { loadHomePage } from './plotView';
import path from 'path';

export class SidebarWebviewViewProvider implements vscode.WebviewViewProvider {
	private readonly port?: number;
	private readonly path?: string;
	public webview?: vscode.Webview;

	constructor(port?: number, path?: string) {
		this.port = port;
		this.path = path;
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		token: vscode.CancellationToken
	) {
		this.webview = webviewView.webview;

		webviewView.webview.options = config.getDefaultWebviewOptions();

		// if (!this.port) {
		// 	webviewView.webview.html = this.getPlaceholderHtmlForWebview(webviewView.webview);		// FIXME: the static version (for prod) is not updated																					// to be the same as live preview version (for dev) yet
		// 	return;
		// }

        if (config.isDev) {
            webviewView.webview.html = getLiveWebviewHtml(webviewView.webview, this.port, false, this.path);
        } else {
            webviewView.webview.html = loadHomePage(
                webviewView.webview,
                path.join(config.GlobalStorageContext.webRoot, 'configs', 'extension-panel-view', 'index.html'),
                '(?!http:\\/\\/|https:\\/\\/)([^"]*\\.[^"]+)',	// remember to double-back-slash here
                path.join(config.GlobalStorageContext.webRoot)
            );
        }

		webviewView.webview.onDidReceiveMessage(handleMessageDefault);
	}

	private getPlaceholderHtmlForWebview(webview: vscode.Webview): string {
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
