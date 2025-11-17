import * as vscode from 'vscode';
import * as config from './config';
import { loadVisualization, setAsDataFolder, setAsDataFolderAndLoadVisualizationResult, startVisualizing } from './control';
import path from 'path';
import { loadHomePage } from './utils';
import { MessageManager } from './views/messageManager';
import { PlotViewMessageManager } from './views/viewMessageManager';

export function doCommandsRegistration(): vscode.Disposable {
    const commandsRegistration = vscode.Disposable.from(
        vscode.commands.registerCommand(config.CommandID.setAsDataFolderAndLoadVisualizationResult, setAsDataFolderAndLoadVisualizationResult),
        vscode.commands.registerCommand(config.CommandID.setAsDataFolder, setAsDataFolder),
        vscode.commands.registerCommand(config.CommandID.loadVisualization, loadVisualization),
        vscode.commands.registerCommand(config.CommandID.startVisualizing, startVisualizing),
        vscode.commands.registerCommand(config.CommandID.configureAndLoadVisualization, () => { loadVisualization(true); }),
        vscode.commands.registerCommand(config.CommandID.openPlotView, openPlotView),
    );
    return commandsRegistration;
}

function openPlotView() {
    const panel = vscode.window.createWebviewPanel(
        'newPlotView',
        'Visualizer',
        vscode.ViewColumn.One,
        { retainContextWhenHidden: true, ...config.getDefaultWebviewOptions() }
    );

    panel.webview.html = loadHomePage(
        panel.webview,
        path.join(config.GlobalStorageContext.webRoot, 'configs', 'plotView', 'index.html'),
        '(?!http:\\/\\/|https:\\/\\/)([^"]*\\.[^"]+)',
        path.join(config.GlobalStorageContext.webRoot)
    );

    panel.webview.onDidReceiveMessage(async (msg) => {
        console.log("[Extension] webview received message: ", msg);
    });

    MessageManager.setPlotViewMessageManager(new PlotViewMessageManager(panel));
}