"use strict";
// wrap any view as a live preview for development convenience
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDefaultDevLiveServers = startDefaultDevLiveServers;
exports.getLiveWebviewHtml = getLiveWebviewHtml;
const config = __importStar(require("./config"));
const live_server_1 = require("live-server");
function startSingleLiveServer(distPath, port) {
    const params = {
        port: port,
        host: "127.0.0.1",
        root: distPath,
        open: false,
        wait: 100,
        logLevel: 2,
    };
    (0, live_server_1.start)(params);
}
function startDefaultDevLiveServers(context) {
    const distPath = config.GlobalStorageContext.webRoot;
    // different from preprocessing HTML in vscode
    // we don't need to relocate the URI in server hosted page
    startSingleLiveServer(distPath + 'extension-plot-view', config.editorWebviewPort);
    // startSingleLiveServer(htmlPath, config.controlWebviewPort);
    // startSingleLiveServer(distPath, config.metadataWebviewPort);
    startSingleLiveServer(distPath + 'extension-panel-view', config.panelWebviewPort);
}
// TODO split the views into different folders, otherwise updating resource of one view will refresh all
function getLiveWebviewHtml(webview, localPort = 5000, notifyLoad = false, path = '/') {
    const passVSCodeCssVariablesScript = `       const iframeWindow = document.getElementById('debug-iframe').contentWindow;
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
//# sourceMappingURL=devLiveServer.js.map