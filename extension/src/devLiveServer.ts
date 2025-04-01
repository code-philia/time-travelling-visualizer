// wrap any view as a live preview for development convenience

import * as vscode from 'vscode';
import * as config from './config';
import { LiveServerParams, start as startServer } from 'live-server';

function startSingleLiveServer(distPath: string, port: number): void {
	const params: LiveServerParams = {
		port: port,
		host: "127.0.0.1",
		root: distPath,
		open: false,
		wait: 100,
		logLevel: 2,
	};
	startServer(params);
}

export function startDefaultDevLiveServers(context: vscode.ExtensionContext): void {
	const distPath = config.GlobalStorageContext.webRoot;

	// different from preprocessing HTML in vscode
	// we don't need to relocate the URI in server hosted page
	startSingleLiveServer(distPath + 'extension-plot-view', config.editorWebviewPort);
	// startSingleLiveServer(htmlPath, config.controlWebviewPort);
	// startSingleLiveServer(distPath, config.metadataWebviewPort);
	startSingleLiveServer(distPath + 'extension-panel-view', config.panelWebviewPort);
}

// TODO split the views into different folders, otherwise updating resource of one view will refresh all
export function getLiveWebviewHtml(webview: vscode.Webview, localPort: number = 5000, notifyLoad: boolean = false, path: string = '/'): string {
    const passVSCodeCssVariablesScript =
`       const iframeWindow = document.getElementById('debug-iframe').contentWindow;
        const vscodeFontFamilyId = '--vscode-editor-font-family';
        const vscodeEditorBackgroundColor = '--vscode-editor-background';
        const fontFamily = document.documentElement.style.getPropertyValue(vscodeFontFamilyId);
        const editorBackgroundColor = document.documentElement.style.getPropertyValue(vscodeEditorBackgroundColor);
`;

	// FIXME should not pass targetOrigin to '*', see <https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage>
	// FIXME consider not using live server but using file watch for live update, because it is so nontransparent in vscode
	return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Localhost</title>
			<style>
				body, html {
					height: 100%;
					padding: 0;
					margin: 0;
				}
				iframe {
					width: 100%;
					height: 100%;
					border: none;
					display: block;
				}
			</style>
        </head>
        <body>
            <iframe id="debug-iframe" sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"
				src="http://127.0.0.1:${localPort}${path}"></iframe>
        </body>
        </html>
		<script>
			${passVSCodeCssVariablesScript}
			const vscode = acquireVsCodeApi();
			window.addEventListener('message', e => {
				console.log('Received message raw:', e);
				const data = e['data'];
				const debugIframe = document.getElementById('debug-iframe');
				if (e.origin.startsWith('vscode-webview')) {		// from vscode, forwarded to iframe
					debugIframe.contentWindow.postMessage(data, '*');
				} else {											// from iframe, forwarded to vscode
					if (data.state === 'load') {
						debugIframe.contentWindow.postMessage({
							command: 'updateCssVariable',
							cssVars: {
								[\`\${vscodeFontFamilyId}\`]: \`\${fontFamily}\`,
								[\`\${vscodeEditorBackgroundColor}\`]: \`\${editorBackgroundColor}\`
							}
						}, '*');
					}
					vscode.postMessage(data);
				}
			},false);
		</script>
    `;
}
