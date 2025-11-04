import * as vscode from 'vscode';
import { TrainingProcessTreeView } from './views/trainingProcessTreeView';

export function doViewsRegistration(): vscode.Disposable {

    const trainginProcessTreeViewRegistration = new TrainingProcessTreeView();

    return vscode.Disposable.from(
        trainginProcessTreeViewRegistration
    );
}
