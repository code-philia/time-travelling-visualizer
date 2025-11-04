import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as config from './config';

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
    const html = fs.readFileSync(root, 'utf8');
    return replaceUri(html, webview, mapSrc, mapDst);
}