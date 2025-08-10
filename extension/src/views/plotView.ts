import * as vscode from 'vscode';
import * as path from 'path';
import * as CONFIG from '../config';
import { readFileSync } from 'fs';
import { getBasicConfig } from '../control';
import { getLiveWebviewHtml } from '../devLiveServer';
import { MessageManager } from './messageManager';
import { PlotViewMessageManager } from './viewMessageManager';
import { getBackground, getImageData } from '../communication/api';

function replaceUri(html: string, webview: vscode.Webview, srcPattern: string, dst: string): string {
	// replace all 'matched pattern' URI using webview.asWebviewUri,
	// which is hosted by VS Code client,
	// or it cannot be loaded
	// where the regex pattern should yield the first group as a correct relative path
	const cssFormattedHtml = html.replace(new RegExp(`(?<=href\="|src\=")${srcPattern}(?=")`, 'g'), (match, ...args) => {
		if (match) {
			// console.log(`matched: ${match}`);
			const formattedCss = webview.asWebviewUri(vscode.Uri.file(path.join(dst, args[0])));
			return formattedCss.toString();
		}
		return "";
	});

	return cssFormattedHtml;
}

export function loadHomePage(webview: vscode.Webview, root: string, mapSrc: string, mapDst: string): string {
	const html = readFileSync(root, 'utf8');
	return replaceUri(html, webview, mapSrc, mapDst);
}

export class PlotViewManager {
	static panel?: vscode.WebviewPanel;

	static get view(): vscode.Webview | undefined {
		return this.panel?.webview;
	}

	private constructor() { }

	static async createPanel(): Promise<boolean> {
		const panel = vscode.window.createWebviewPanel(
			'plotView',
			'Visualizer',
			vscode.ViewColumn.One,
			{ retainContextWhenHidden: true, ...CONFIG.getDefaultWebviewOptions() }
		);

		panel.iconPath = vscode.Uri.file(path.join(CONFIG.GlobalStorageContext.resourceRoot, 'eye_tracking_24dp_5F6368_FILL0_wght300_GRAD0_opsz24.svg'));

		if (CONFIG.isDev) {
			panel.webview.html = getLiveWebviewHtml(panel.webview, CONFIG.editorWebviewPort, true);
        } else {
            /**
             * The build folder structure is:
             * - dist (the `GlobalStorageContext.webRoot`)
             *   - assets
             *   - configs
             *     - extension-plot-view
             *     - extension-panel-view
             */
			panel.webview.html = loadHomePage(
				panel.webview,
				path.join(CONFIG.GlobalStorageContext.webRoot, 'configs', 'extension-plot-view', 'index.html'),
                '(?!http:\\/\\/|https:\\/\\/)([^"]*\\.[^"]+)',	// remember to double-back-slash here
                path.join(CONFIG.GlobalStorageContext.webRoot)
			);
		}

		panel.onDidChangeViewState((e) => {
			console.log(`Panel view state changed: ${e.webviewPanel.active}`);
		});
		panel.onDidDispose((e) => {
			this.panel = undefined;
		});

		// TODO the iframe would not be refreshed for not receiving "update" message, which is a handicap for live preview in development
		// reload the data when the iframe is refreshed, maybe by posting a message to vscode to ask for several major arguments
		
		panel.webview.onDidReceiveMessage(async (msg) => {
			console.log("Plot View received message: ", msg);
			if (msg.command === 'epochSwitch') { 
				const targetEpoch: number = msg.data.epoch;
				const msgBack = {
					command: 'updateEpoch',
					data: {
						epoch: targetEpoch,
					}
				}
				MessageManager.sendToRightView(msgBack);
				MessageManager.sendToTokenView(msgBack);
			}
			else if (msg.command === 'hoveredIndexSwitch') {
				const hoveredIndex: number = msg.data.hoveredIndex;
				const config = getBasicConfig();
				if (!config) {
					return;
				}

				let image: string|null = '';
				if (config.taskType === 'Classification') { 
					image = await getImageData(config.contentPath, hoveredIndex);
				}
				const msgBack = {
					command: 'updateHoveredIndex',
					data: {
						hoveredIndex: hoveredIndex,
						image: image? image : '',
					}
				}
				MessageManager.sendToRightView(msgBack);
				
				const msgToTokenView = {
					command: 'updateHoveredIndex',
					data: {
						hoveredIndex: hoveredIndex,
					}
				}
				MessageManager.sendToTokenView(msgToTokenView);
			}
			else if (msg.command == 'selectedIndicesSwitch') {
				const selectedIndices: number[] = msg.data.selectedIndices;
				const msgToTokenView = {
					command: 'updateSelectedIndices',
					data: {
						selectedIndices: selectedIndices,
					}
				}
				MessageManager.sendToTokenView(msgToTokenView);
				MessageManager.sendToRightView(msgToTokenView);
			}
		});

	    // Listen for configuration changes
		vscode.workspace.onDidChangeConfiguration(async (event) => {
			const settingsPrefix = 'timeTravellingVisualizer.plotSettings';
			const settingsToCheck = [
				'showIndex',
				'showLabel',
				'showBackground',
				'showTrail',
				'revealOriginalNeighbors',
				'revealProjectionNeighbors',
			];
		
			// Collect all changed settings
			const updatedSettings: Record<string, any> = {};
		
			for (const setting of settingsToCheck) {
				const fullSettingKey = `${settingsPrefix}.${setting}`;
				if (event.affectsConfiguration(fullSettingKey)) {
					const updatedValue = vscode.workspace.getConfiguration('timeTravellingVisualizer.plotSettings').get(setting);
					updatedSettings[setting] = updatedValue;
		
					// Special handling for showBackground
					if (setting === 'showBackground' && updatedValue === true) {
						const extensionContext = CONFIG.GlobalStorageContext.extensionContext;
						if (!extensionContext) {
							vscode.window.showErrorMessage("Extension context is not available.");
							return;
						}
		
						const config = getBasicConfig();
						if (!config) {
							vscode.window.showErrorMessage("Configuration is not available.");
							return;
						}
		
						const targetEpoch = extensionContext.workspaceState.get('currentEpoch') as number;
						const scope = extensionContext.workspaceState.get('scope') as number[];
		
						if (targetEpoch && scope) {
							const background = await getBackground(config.contentPath,config.visualizationMethod,targetEpoch);
							extensionContext.workspaceState.update('background', background);
							if (panel) {
								panel.webview.postMessage({
									command: 'updateBackground',
									data: { background: background },
								});
							}
						}
					}
				}
			}
		
			// Send all updated settings in one message
			if (Object.keys(updatedSettings).length > 0 && panel) {
				panel.webview.postMessage({
					command: 'updatePlotSettings',
					data: updatedSettings, // Send all updated settings at once
				});
			}
		});

		const loaded: Promise<boolean> = new Promise((resolve) => {
			panel.webview.onDidReceiveMessage((msg) => {		// this will add a listener, not overwriting
				if (msg.state === 'load') {
					this.panel = panel;
					MessageManager.setPlotViewMessageManager(new PlotViewMessageManager(panel));
					resolve(true);
				}
			});
		});
		return loaded;
	}

	static async showView(): Promise<boolean> {
		if (!(PlotViewManager.panel)) {
			await PlotViewManager.createPanel();
			return true;
		}
		// TODO handle error and return false, not always return true
		return true;
	}
}
