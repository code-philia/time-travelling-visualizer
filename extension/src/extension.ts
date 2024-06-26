import { readFileSync } from 'fs';
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('myExtension.start', () => {
			const resourceUri = vscode.Uri.joinPath(context.extensionUri, "../Tool/server/Frontend"); // not server/Frontend because the paths of css includes Frontend in index.html
			const panel = vscode.window.createWebviewPanel(
				'customEditor',
				'My Custom Editor',
				vscode.ViewColumn.One,
				{
					"enableScripts": true,
					"localResourceRoots": [
						// vscode.Uri.file(toolPath + "/server") // not server/Frontend because the paths of css includes Frontend in index.html
						resourceUri
				]
			}
		  );
		  
		  panel.webview.html = loadHomePage(panel.webview, context);
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('myExtension.dialog', () => {
			vscode.window.showOpenDialog();
		})
	);
	context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'myView',
            new MySideBarWebviewViewProvider(context)
        )
	);
	context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'myPanelView',
            new MySideBarWebviewViewProvider(context)
        )
    );
}

export function deactivate() {}

function loadHomePage(webview: vscode.Webview, context: vscode.ExtensionContext) {
	const html = readFileSync(context.extensionUri.fsPath + '/../Tool/server/Frontend/index.html', 'utf8');

	// replace all "Frontend/..." URI using webview.asWebviewUri,
	// which is hosted by VS Code client,
	// or it cannot be loaded
	const cssFormattedHtml = html.replace(/(href="|src=")(Frontend\/[^"]*)"/g, (match, p1, p2) => {
		if (match) {
			const formattedCss = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, '../Tool/server/', p2));
			return p1 + formattedCss.toString()  + '"';
		}
		return "";
	});

	return cssFormattedHtml;
}

function getWebviewContent() {
	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Custom Editor</title>
	</head>
	<body>
		<h1>Hello, Custom Editor!</h1>
	</body>
	</html>`;
}

class MySideBarWebviewViewProvider implements vscode.WebviewViewProvider {
    private readonly context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        webviewView.webview.options = {
            enableScripts: true
        };
        
		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
		
		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'colorSelected':
					{
						vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
						break;
					}
				default:
					{
						break;
					}
			}
		});
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>My Custom View</title>
        </head>
        <body>
            <h1>Hello from My Custom View!</h1>
        </body>
        </html>`;
    }
}
