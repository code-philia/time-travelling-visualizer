"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.doCommandsRegistration = doCommandsRegistration;
const vscode = __importStar(require("vscode"));
const config = __importStar(require("./config"));
const control_1 = require("./control");
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
const messageManager_1 = require("./views/messageManager");
const viewMessageManager_1 = require("./views/viewMessageManager");
function doCommandsRegistration() {
    const commandsRegistration = vscode.Disposable.from(vscode.commands.registerCommand(config.CommandID.setAsDataFolderAndLoadVisualizationResult, control_1.setAsDataFolderAndLoadVisualizationResult), vscode.commands.registerCommand(config.CommandID.setAsDataFolder, control_1.setAsDataFolder), vscode.commands.registerCommand(config.CommandID.loadVisualization, control_1.loadVisualization), vscode.commands.registerCommand(config.CommandID.startVisualizing, control_1.startVisualizing), vscode.commands.registerCommand(config.CommandID.configureAndLoadVisualization, () => { (0, control_1.loadVisualization)(true); }), vscode.commands.registerCommand(config.CommandID.openPlotView, openPlotView));
    return commandsRegistration;
}
function openPlotView() {
    const panel = vscode.window.createWebviewPanel('newPlotView', 'Visualizer', vscode.ViewColumn.One, { retainContextWhenHidden: true, ...config.getDefaultWebviewOptions() });
    panel.webview.html = (0, utils_1.loadHomePage)(panel.webview, path_1.default.join(config.GlobalStorageContext.webRoot, 'configs', 'plotView', 'index.html'), '(?!http:\\/\\/|https:\\/\\/)([^"]*\\.[^"]+)', path_1.default.join(config.GlobalStorageContext.webRoot));
    panel.webview.onDidReceiveMessage(async (msg) => {
        console.log("[Extension] webview received message: ", msg);
        if (msg.command === 'acquireSettings') {
            let allPlotSettings = (0, control_1.getPlotSettings)();
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
        // Collect all changed settings
        const updatedSettings = {};
        for (const setting of settingsToCheck) {
            const fullSettingKey = `${settingsPrefix}.${setting}`;
            if (event.affectsConfiguration(fullSettingKey)) {
                const updatedValue = vscode.workspace.getConfiguration('timeTravellingVisualizer.plotSettings').get(setting);
                updatedSettings[setting] = updatedValue;
            }
        }
        // Send all updated settings in one message
        if (Object.keys(updatedSettings).length > 0 && panel) {
            panel.webview.postMessage({
                command: 'updatePlotSettings',
                data: {
                    settings: updatedSettings
                }
            });
        }
    });
    messageManager_1.MessageManager.setPlotViewMessageManager(new viewMessageManager_1.PlotViewMessageManager(panel));
}
//# sourceMappingURL=commands.js.map