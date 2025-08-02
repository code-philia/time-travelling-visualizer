import * as vscode from 'vscode';
import * as config from './config';
import { BrowseTreeView } from './views/browseTreeView';
import { MessageManager } from './views/messageManager';
import { TrainingProcessTreeView } from './views/trainingProcessTreeView';
import { RightViewProvider } from './views/viewProvider';

export function doViewsRegistration(): vscode.Disposable {
    // Prepare for registration of webview views
    MessageManager.initializeView();

    const inspectViewRegistration = vscode.window.registerWebviewViewProvider(
        config.ViewsID.inspectView,
        MessageManager.getTokenViewMessageManager().getWebViewProvider(),
        { webviewOptions: { retainContextWhenHidden: true } }
    );
    const rightViewRegistration = vscode.window.registerWebviewViewProvider(
        config.ViewsID.rightView,
        MessageManager.getRightViewMessageManager().getWebViewProvider(),
        { webviewOptions: { retainContextWhenHidden: true } }
    );

    const influenceViewRegistration = vscode.window.registerWebviewViewProvider(
        config.ViewsID.influenceView,
        MessageManager.getInfluenceViewMessageManager().getWebViewProvider(),
        { webviewOptions: { retainContextWhenHidden: true } }
    );

    // Prepare for registration of tree view
    // const browseTreeViewRegistration = new BrowseTreeView();
    const trainginProcessTreeViewRegistration = new TrainingProcessTreeView();

    return vscode.Disposable.from(
        inspectViewRegistration,
        rightViewRegistration,
        influenceViewRegistration,
        trainginProcessTreeViewRegistration
    );

}
