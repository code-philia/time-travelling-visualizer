import * as vscode from 'vscode';
import * as config from '../config';
import { getLiveWebviewHtml } from '../devLiveServer';
import { loadHomePage } from './plotView';
import path from 'path';
import { MessageManager } from './messageManager';

export abstract class BaseViewProvider implements vscode.WebviewViewProvider {
    public abstract webview?: vscode.Webview;

    abstract resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): void;

    protected getPlaceholderHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Placeholder View</title>
        </head>
        <body>
            <h1>This is a placeholder view!</h1>
        </body>
        </html>`;
    }
}

export class DetailViewProvider extends BaseViewProvider {
    private readonly port?: number;
    private readonly path?: string;
    public webview?: vscode.Webview;

    constructor(port?: number, path?: string) {
        super();
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

        if (config.isDev) {
            webviewView.webview.html = getLiveWebviewHtml(webviewView.webview, this.port, false, this.path);
        } else {
            webviewView.webview.html = loadHomePage(
                webviewView.webview,
                path.join(config.GlobalStorageContext.webRoot, 'configs', 'extension-detail-view', 'index.html'),
                '(?!http:\\/\\/|https:\\/\\/)([^"]*\\.[^"]+)', // remember to double-back-slash here
                path.join(config.GlobalStorageContext.webRoot)
            );
        }

        // webviewView.webview.onDidReceiveMessage(handleMessageDefault);
        webviewView.webview.onDidReceiveMessage(msg => {
            console.log("Detail View received message: ", msg);
        });
    }
}

export class TokenViewProvider extends BaseViewProvider {
    private readonly port?: number;
    private readonly path?: string;
    public webview?: vscode.Webview;

    constructor(port?: number, path?: string) {
        super();
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

        if (config.isDev) {
            webviewView.webview.html = getLiveWebviewHtml(webviewView.webview, this.port, false, this.path);
        } else {
            webviewView.webview.html = loadHomePage(
                webviewView.webview,
                path.join(config.GlobalStorageContext.webRoot, 'configs', 'extension-panel-view', 'index.html'),
                '(?!http:\\/\\/|https:\\/\\/)([^"]*\\.[^"]+)', // remember to double-back-slash here
                path.join(config.GlobalStorageContext.webRoot)
            );
        }

        // webviewView.webview.onDidReceiveMessage(handleMessageDefault);
        webviewView.webview.onDidReceiveMessage(msg => {
            console.log("Token View received message: ", msg);
            if(msg.command === 'hoveredIndexSwitch') {
                const hoveredIndex = msg.data.hoveredIndex;
                const msgToPlotView = {
                    command: 'updateHoveredIndex',
                    data: {
                        hoveredIndex: hoveredIndex
                    }
                }
                MessageManager.sendToPlotView(msgToPlotView);
            }
            else if(msg.command === 'selectedIndicesSwitch') {
                const selectedIndices = msg.data.selectedIndices;
                const msgToPlotView = {
                    command: 'updateSelectedIndices',
                    data: {
                        selectedIndices: selectedIndices
                    }
                }
                MessageManager.sendToPlotView(msgToPlotView);
            }
        });
    }
}
