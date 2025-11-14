import * as vscode from 'vscode';
import * as config from './config';
import {
  getPlotSettings,
  loadVisualization,
  setAsDataFolder,
  setAsDataFolderAndLoadVisualizationResult,
  startVisualizing,
} from './control';
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
        if (msg.command === 'acquireSettings') { 
            let allPlotSettings = getPlotSettings();
            panel.webview.postMessage({
                command: 'updatePlotSettings',
                data: {
                    settings: allPlotSettings
                }
            });
        }
    });

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(async (event) => {
        const settingsPrefix = 'timeTravellingVisualizer.plotSettings';
        const settingsToCheck = [
            'showIndex',
            'showLabel',
            'showBackground',
            'showTrail',
            'revealOriginalNeighbors',
            'revealProjectionNeighbors',
        ];
    
        const updatedSettings: Record<string, any> = {};
    
        for (const setting of settingsToCheck) {
            const fullSettingKey = `${settingsPrefix}.${setting}`;
            if (event.affectsConfiguration(fullSettingKey)) {
                const updatedValue = vscode.workspace.getConfiguration('timeTravellingVisualizer.plotSettings').get(setting);
                updatedSettings[setting] = updatedValue;
            }
        }
    
        if (Object.keys(updatedSettings).length > 0 && panel) {
            panel.webview.postMessage({
                command: 'updatePlotSettings',
                data: {
                    settings: updatedSettings
                }
            });
        }
    });

    MessageManager.setPlotViewMessageManager(new PlotViewMessageManager(panel));
}