import * as vscode from 'vscode';
import * as config from './config';
import { BrowseTreeView } from './views/browseTreeView';
import { MessageManager } from './views/messageManager';
import { TrainingProcessTreeView } from './views/trainingProcessTreeView';

export function doViewsRegistration(): vscode.Disposable {
    // Prepare for registration of webview views
    MessageManager.initializeView();

    const inspectViewRegistration = vscode.window.registerWebviewViewProvider(
        config.ViewsID.inspectView,
        MessageManager.getTokenViewMessageManager().getWebViewProvider(),
        { webviewOptions: { retainContextWhenHidden: true } }
    );
    const detailViewRegistration = vscode.window.registerWebviewViewProvider(
        config.ViewsID.detailView,
        MessageManager.getDetailViewMessageManager().getWebViewProvider(),
        { webviewOptions: { retainContextWhenHidden: true } }
    );

    // Prepare for registration of tree view
    // const browseTreeViewRegistration = new BrowseTreeView();
    const trainginProcessTreeViewRegistration = new TrainingProcessTreeView();

    return vscode.Disposable.from(
        inspectViewRegistration,
        detailViewRegistration,
        // browseTreeViewRegistration,
        trainginProcessTreeViewRegistration
    );

}
