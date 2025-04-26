import * as vscode from 'vscode';
import * as config from '../config';
import { BaseViewProvider,TokenViewProvider, DetailViewProvider, RightViewProvider } from './viewProvider';

/**
 * This is a middle layer between the view provider/panel and message.
 */
export class ViewMessageManager {
    protected provider?: BaseViewProvider;

    get view(): vscode.Webview | undefined {
        return this.provider?.webview;
    }
    
    public getWebViewProvider(): BaseViewProvider { 
        return this.provider as BaseViewProvider;
    }

    async postMessage(msg: any): Promise<boolean> {
        if (!this.view) {
            return false;
        }
        return await this.view.postMessage(msg);
    }
}

export class TokenViewMessageManager extends ViewMessageManager {
    constructor() {
        super();
        if (!this.provider) {
            this.provider = new TokenViewProvider(
                config.isDev ? config.panelWebviewPort : undefined,
                config.isDev ? '' : undefined
            );
        }
    }

    public getWebViewProvider(): TokenViewProvider {
        return this.provider as TokenViewProvider;
    }
}

export class DetailViewMessageManager extends ViewMessageManager {
    constructor() {
        super();
        if (!this.provider) {
            this.provider = new DetailViewProvider(
                config.isDev ? config.panelWebviewPort : undefined,
                config.isDev ? '' : undefined
            );
        }
    }

    public getWebViewProvider(): DetailViewProvider {
        return this.provider as DetailViewProvider;
    }
}

export class PlotViewMessageManager{
    static panel: vscode.WebviewPanel | undefined;

    constructor(panel: vscode.WebviewPanel) {
        PlotViewMessageManager.panel = panel;
    }

    async postMessage(msg: any): Promise<boolean> {
		if (!(PlotViewMessageManager.panel)) {
			return false;
		}
		return await PlotViewMessageManager.panel.webview.postMessage(msg);
    }
}

export class RightViewMessageManager extends ViewMessageManager {
    constructor() {
        super();
        if (!this.provider) {
            this.provider = new RightViewProvider(
                config.isDev ? config.panelWebviewPort : undefined,
                config.isDev ? '' : undefined
            );
        }
    }

    public getWebViewProvider(): RightViewProvider {
        return this.provider as RightViewProvider;
    }
}