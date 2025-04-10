import * as vscode from 'vscode';
import * as config from './config';
import { BrowseTreeView } from './views/browseTreeView';
import { ViewMessageManager } from './views/viewMessageManager';

export function doViewsRegistration(): vscode.Disposable {
    // Prepare for registration of webview views
    ViewMessageManager.initializeView();

    const inspectViewRegistration = vscode.window.registerWebviewViewProvider(
        config.ViewsID.inspectView,
        ViewMessageManager.getTokenViewMessageManager().getWebViewProvider(),
        { webviewOptions: { retainContextWhenHidden: true } }
    );
    const detailViewRegistration = vscode.window.registerWebviewViewProvider(
        config.ViewsID.detailView,
        ViewMessageManager.getDetailViewMessageManager().getWebViewProvider(),
        { webviewOptions: { retainContextWhenHidden: true } }
    );

    // Prepare for registration of tree view
    const browseTreeViewRegistration = new BrowseTreeView();

    return vscode.Disposable.from(
        inspectViewRegistration,
        detailViewRegistration,
        browseTreeViewRegistration
    );
}
