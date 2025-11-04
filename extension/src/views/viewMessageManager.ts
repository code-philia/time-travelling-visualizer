import * as vscode from 'vscode';

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