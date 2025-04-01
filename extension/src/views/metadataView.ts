import * as vscode from 'vscode';
import * as config from '../config';
import { SidebarWebviewViewProvider } from './sidebarBaseView';

export class MessageViewManager {
    // TODO do not make the provider static, because it has been changed to a general base view manager
    static provider?: SidebarWebviewViewProvider;

    static get view(): vscode.Webview | undefined {
		return this.provider?.webview;
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

    // TODO add a base view for metadata view and main plot view
    // cause they could all postMessage(msg)
    static async postMessage(msg: any): Promise<boolean> {
		if (!(this.view)) {
			return false;
		}
		return await this.view?.postMessage(msg);
	}
}
