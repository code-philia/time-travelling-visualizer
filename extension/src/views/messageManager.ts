import * as vscode from 'vscode';
import * as config from '../config';
import { BaseViewProvider,TokenViewProvider, DetailViewProvider } from './viewProvider';

export class MessageManager {
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

export class TokenViewMessageManager extends MessageManager {
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

export class DetailViewMessageManager extends MessageManager {
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
