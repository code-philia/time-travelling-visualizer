import * as vscode from 'vscode';
import * as config from '../config';
import { SidebarWebviewViewProvider } from './sidebarBaseView';
import { DetailViewViewProvider } from './detailView';

export class MessageViewManager {
    // TODO do not make the provider static, because it has been changed to a general base view manager
    static provider?: SidebarWebviewViewProvider;
    static detailViewProvider?: DetailViewViewProvider;

    static get view(): vscode.Webview | undefined {
		return this.provider?.webview;
    }
    
    static get detailView(): vscode.Webview | undefined {
        return this.detailViewProvider?.webview;
    }

    private constructor() { }

    static getWebViewProvider(): vscode.WebviewViewProvider {
        if (!(this.provider)) {
            this.provider = new SidebarWebviewViewProvider(
                config.isDev ? config.panelWebviewPort : undefined,
                config.isDev ? '' : undefined
            );
        }
        return this.provider;
    }

    static getDetailViewProvider(): vscode.WebviewViewProvider {
        if (!(this.detailViewProvider)) {
            this.detailViewProvider = new DetailViewViewProvider(
                config.isDev ? config.panelWebviewPort : undefined,
                config.isDev ? '' : undefined
            );
        }
        return this.detailViewProvider;
    }

    // TODO add a base view for metadata view and main plot view
    // cause they could all postMessage(msg)
    static async postMessage(msg: any): Promise<boolean> {
		if (!(this.view)) {
			return false;
		}
		return await this.view?.postMessage(msg);
	}
}
