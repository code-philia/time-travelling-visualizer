import * as vscode from 'vscode';
import * as config from './config';
import { MessageViewManager } from './views/metadataView';
import { BrowseTreeView } from './views/browseTreeView';

export function doViewsRegistration(): vscode.Disposable {
    // const metadataViewRegistration = vscode.window.registerWebviewViewProvider(
    //     config.ViewsID.metadataView,
    //     MetadataViewManager.getWebViewProvider(),
    //     { webviewOptions: { retainContextWhenHidden: true } }
    // );
    const inspectViewRegistration = vscode.window.registerWebviewViewProvider(
        config.ViewsID.inspectView,
        MessageViewManager.getWebViewProvider(),
        { webviewOptions: { retainContextWhenHidden: true } }
    );
    const browseTreeViewRegistration = new BrowseTreeView();

    return vscode.Disposable.from(
        // metadataViewRegistration,
        inspectViewRegistration,
        browseTreeViewRegistration
    );
}
