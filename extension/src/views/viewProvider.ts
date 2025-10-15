import * as vscode from 'vscode';
import * as CONFIG from '../config';
import { getLiveWebviewHtml } from '../devLiveServer';
import { loadHomePage } from './plotView';
import path from 'path';
import { MessageManager } from './messageManager';
import { getBasicConfig } from '../control';
import { calculateTrainingEvents, getAttributeResource, getImageData, getInfluenceSamples, getText, getTextData } from '../communication/api';

async function runWithTimedNotification<T>(title: string, progressText: string, operation: () => Promise<T>): Promise<T> {
    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: false,
        },
        async progress => {
            const start = Date.now();
            const updateMessage = () => {
                const elapsedSeconds = Math.floor((Date.now() - start) / 1000);
                progress.report({ message: `${progressText} (${elapsedSeconds} s elapsed)` });
            };

            updateMessage();
            const interval = setInterval(updateMessage, 1000);

            try {
                const result = await operation();
                const elapsedSeconds = Math.floor((Date.now() - start) / 1000);
                progress.report({ message: `Completed after ${elapsedSeconds} s` });
                return result;
            } finally {
                clearInterval(interval);
            }
        }
    );
}

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
                try {
                    await runWithTimedNotification(
                        'Tracing influence samples',
                        'Waiting for backend response',
                        async () => {
                            const IFSamplesRes: any = await getInfluenceSamples(config.contentPath, epoch, msg.data);
                            const influenceSamples = IFSamplesRes['influence_samples'];

                            if (type === 'PredictionFlip' || type === 'ConfidenceChange') {
                                const image: any = await getImageData(config.contentPath, msg.data.index);

                                const msgToInfluenceView = {
                                    command: 'updateInfluenceSamples',
                                    data: {
                                        trainingEvent: {
                                            ...msg.data,
                                            data: image,
                                        },
                                        influenceSamples,
                                    }
                                };
                                MessageManager.sendToInfluenceView(msgToInfluenceView);
                            }
                            else if (type === 'InconsistentMovement') { 
                                const [data1, data2]: any[] = await Promise.all([
                                    getTextData(config.contentPath, msg.data.index),
                                    getTextData(config.contentPath, msg.data.index1),
                                ]);

                                const msgToInfluenceView = {
                                    command: 'updateInfluenceSamples',
                                    data: {
                                        trainingEvent: {
                                            ...msg.data,
                                            data: data1,
                                            data1: data2
                                        },
                                        influenceSamples,
                                    }
                                };
                                MessageManager.sendToInfluenceView(msgToInfluenceView);
                            }
                            else {
                                console.warn(`Unknown tracingInfluence type: ${type}`);
                            }
                        }
                    );
                } catch (error) {
                    console.error('Failed to trace influence samples', error);
                    const message = error instanceof Error ? error.message : String(error);
                    vscode.window.showErrorMessage(`Failed to trace influence samples: ${message}`);
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

                try {
                    await runWithTimedNotification(
                        'Calculating training events',
                        'Waiting for backend response',
                        async () => {
                            const trainingEventsRes: any = await calculateTrainingEvents(config.contentPath, epoch, eventTypes);
                            const msgToFunctionView = {
                                command: 'updateCalculatedEvents',
                                data: {
                                    trainingEvents: trainingEventsRes['training_events'],
                                }
                            };
                            MessageManager.sendToRightView(msgToFunctionView);
                        }
                    );
                } catch (error) {
                    console.error('Failed to calculate training events', error);
                    const message = error instanceof Error ? error.message : String(error);
                    vscode.window.showErrorMessage(`Failed to calculate training events: ${message}`);
                }
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
