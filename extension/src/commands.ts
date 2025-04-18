import * as vscode from 'vscode';
import * as config from './config';
import { loadVisualization, setAsDataFolder, setAsDataFolderAndLoadVisualizationResult, startVisualizing } from './control';

// TODO this should only be called once
// but now it has not limitation
export function doCommandsRegistration(): vscode.Disposable {
    const commandsRegistration = vscode.Disposable.from(
        vscode.commands.registerCommand(config.CommandID.setAsDataFolderAndLoadVisualizationResult, setAsDataFolderAndLoadVisualizationResult),
        vscode.commands.registerCommand(config.CommandID.setAsDataFolder, setAsDataFolder),
        vscode.commands.registerCommand(config.CommandID.loadVisualization, loadVisualization),
        vscode.commands.registerCommand(config.CommandID.startVisualizing, startVisualizing),
        vscode.commands.registerCommand(config.CommandID.configureAndLoadVisualization, () => { loadVisualization(true); })
    );
    return commandsRegistration;
}
