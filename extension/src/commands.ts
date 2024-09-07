import * as vscode from 'vscode';
import * as config from './config';
import { setAsDataFolder, setAsDataFolderAndLoadVisualizationResult, startVisualization } from './control';

// TODO this should only be called once
// but now it has not limitation
export function doCommandsRegistration(): vscode.Disposable {
    const commandsRegistration = vscode.Disposable.from(
        vscode.commands.registerCommand(config.CommandID.setAsDataFolderAndLoadVisualizationResult, setAsDataFolderAndLoadVisualizationResult),
        vscode.commands.registerCommand(config.CommandID.setAsDataFolder, setAsDataFolder),
        vscode.commands.registerCommand(config.CommandID.loadVisualization, startVisualization),
        vscode.commands.registerCommand(config.CommandID.configureAndLoadVisualization, () => { startVisualization(true); })
    );
    return commandsRegistration;
}
