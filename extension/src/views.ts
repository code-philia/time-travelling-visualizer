import * as vscode from 'vscode';
import * as config from './config';
import { TokenViewMessageManager, DetailViewMessageManager } from './views/messageManager';
import { BrowseTreeView } from './views/browseTreeView';

export function doViewsRegistration(): vscode.Disposable {
    // const metadataViewRegistration = vscode.window.registerWebviewViewProvider(
    //     config.ViewsID.metadataView,
    //     MetadataViewManager.getWebViewProvider(),
    //     { webviewOptions: { retainContextWhenHidden: true } }
    // );
    const tokenViewMessageManager = new TokenViewMessageManager();
    const inspectViewRegistration = vscode.window.registerWebviewViewProvider(
        config.ViewsID.inspectView,
        tokenViewMessageManager.getWebViewProvider(),
        { webviewOptions: { retainContextWhenHidden: true } }
    );
    
    const detailViewMessageManager = new DetailViewMessageManager();
    const detailViewRegistration = vscode.window.registerWebviewViewProvider(
        config.ViewsID.detailView,
        detailViewMessageManager.getWebViewProvider(),
        { webviewOptions: { retainContextWhenHidden: true } }
    );

    const browseTreeViewRegistration = new BrowseTreeView();

    return vscode.Disposable.from(
        // metadataViewRegistration,
        inspectViewRegistration,
        detailViewRegistration,
        browseTreeViewRegistration
    );
}
