import * as vscode from 'vscode';
import * as CONFIG from '../config';
import { getLiveWebviewHtml } from '../devLiveServer';
import { loadHomePage } from './plotView';
import path from 'path';
import { MessageManager } from './messageManager';
import { getBasicConfig } from '../control';
import { calculateTrainingEvents, getAttributeResource, getImageData, getInfluenceSamples, getText } from '../communication/api';

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

export class TokenViewProvider extends BaseViewProvider {
    private readonly port?: number;
    private readonly path?: string;
    public webview?: vscode.Webview;

    constructor(port?: number, path?: string) {
        super();
        this.port = port;
        this.path = path;
    }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        this.webview = webviewView.webview;

        webviewView.webview.options = CONFIG.getDefaultWebviewOptions();

        if (CONFIG.isDev) {
            webviewView.webview.html = getLiveWebviewHtml(webviewView.webview, this.port, false, this.path);
        } else {
            webviewView.webview.html = loadHomePage(
                webviewView.webview,
                path.join(CONFIG.GlobalStorageContext.webRoot, 'configs', 'extension-token-view', 'index.html'),
                '(?!http:\\/\\/|https:\\/\\/)([^"]*\\.[^"]+)', // remember to double-back-slash here
                path.join(CONFIG.GlobalStorageContext.webRoot)
            );
        }

        if (MessageManager.getPlotViewMessageManager() !== undefined) {
            const config = getBasicConfig();
            if (config && config.taskType) {
                if (config.taskType === 'Code-Retrieval') {
                    const labelRes: any = await getAttributeResource(config.contentPath, 1, 'label');
                    const textRes: any = await getText(config.contentPath);
                    const msgToTokenView = {
                        command: 'init',
                        data: {
                            labels: labelRes['label'],
                            tokenList: textRes['text_list']
                        }
                    }
                    this.webview?.postMessage(msgToTokenView);
                }
            }
        }

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
                // TODO: manage selectedIndices in a class
                MessageManager.sendToPlotView(msgToPlotView);
                MessageManager.sendToRightView(msgToPlotView);
            }
        });
    }
}

export class RightViewProvider extends BaseViewProvider {
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

        webviewView.webview.options = CONFIG.getDefaultWebviewOptions();

        if (CONFIG.isDev) {
            webviewView.webview.html = getLiveWebviewHtml(webviewView.webview, this.port, false, this.path);
        } else {
            webviewView.webview.html = loadHomePage(
                webviewView.webview,
                path.join(CONFIG.GlobalStorageContext.webRoot, 'configs', 'extension-function-view', 'index.html'),
                '(?!http:\\/\\/|https:\\/\\/)([^"]*\\.[^"]+)', // remember to double-back-slash here
                path.join(CONFIG.GlobalStorageContext.webRoot)
            );
        }

        webviewView.webview.onDidReceiveMessage(async msg => {
            console.log("Right View received message: ", msg);
            if (msg.command === 'selectedIndicesSwitch') {
                const selectedIndices = msg.data.selectedIndices;
                const msgToPlotView = {
                    command: 'updateSelectedIndices',
                    data: {
                        selectedIndices: selectedIndices
                    }
                }
                MessageManager.sendToPlotView(msgToPlotView);
                MessageManager.sendToTokenView(msgToPlotView);
            }
            else if (msg.command === 'shownDataSwitch') {
                const shownData = msg.data.shownData;
                const msgToPlotView = {
                    command: 'updateshownData',
                    data: {
                        shownData: shownData
                    }
                }
                MessageManager.sendToPlotView(msgToPlotView);
            }
            else if (msg.command === 'highlightDataSwitch') {
                const highlightData = msg.data.highlightData;
                const msgToPlotView = {
                    command: 'updateHighlightData',
                    data: {
                        highlightData: highlightData
                    }
                }
                MessageManager.sendToPlotView(msgToPlotView);
            }
            else if (msg.command === 'focusModeSwitch') {
                const msgToPlotView = {
                    command: 'updateFocusEvents',
                    data: msg.data
                };
                MessageManager.sendToPlotView(msgToPlotView);
            }
            else if (msg.command === 'tracingInfluence') { 
                const config = getBasicConfig();
                if (!config) {
                    vscode.window.showErrorMessage("Configuration is not available.");
                    return;
                }
                const epoch = msg.epoch;
                const type = msg.data.type; // type can be 'PredictionFlip' ...
                if (type === 'PredictionFlip' || type === 'ConfidenceChange') {
                    const IFSamplesRes: any = await getInfluenceSamples(config.contentPath, epoch, msg.data);
                    const image: any = await getImageData(config.contentPath, msg.data.index);
                    
                    const msgToInfluenceView = {
                        command: 'updateInfluenceSamples',
                        data: {
                            trainingEvent: {
                                ...msg.data,
                                dataType: "image", //TODO: expand to text type
                                data: image,
                            },
                            influenceSamples: IFSamplesRes['influence_samples'],
                        }
                    };
                    MessageManager.sendToInfluenceView(msgToInfluenceView);
                }
            }
            else if (msg.command === 'trainingEventClicked') {
                const msgToPlotView = {
                    command: 'updateTrainingEvents',
                    data: {
                        trainingEvents: msg.data,
                    }
                };
                MessageManager.sendToPlotView(msgToPlotView);
            }
            else if (msg.command === 'calculateEvents') {
                const epoch = msg.data.epoch;
                const eventTypes = msg.data.eventTypes;

                const config = getBasicConfig();
                if (!config) {
                    vscode.window.showErrorMessage("Configuration is not available.");
                    return;
                }

                const trainingEventsRes: any = await calculateTrainingEvents(config.contentPath, epoch, eventTypes);
                const msgToFunctionView = {
                    command: 'updateCalculatedEvents',
                    data: {
                        trainingEvents: trainingEventsRes['training_events'],
                    }
                };
                MessageManager.sendToRightView(msgToFunctionView);
            }
        });
    }
}

export class InfluenceViewProvider extends BaseViewProvider {
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

        webviewView.webview.options = CONFIG.getDefaultWebviewOptions();

        if (CONFIG.isDev) {
            webviewView.webview.html = getLiveWebviewHtml(webviewView.webview, this.port, false, this.path);
        } else {
            webviewView.webview.html = loadHomePage(
                webviewView.webview,
                path.join(CONFIG.GlobalStorageContext.webRoot, 'configs', 'extension-influence-view', 'index.html'),
                '(?!http:\\/\\/|https:\\/\\/)([^"]*\\.[^"]+)', // remember to double-back-slash here
                path.join(CONFIG.GlobalStorageContext.webRoot)
            );
        }

        webviewView.webview.onDidReceiveMessage(async msg => {
        });
    }
}
