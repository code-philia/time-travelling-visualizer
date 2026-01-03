"use strict";
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
exports.loadHomePage = loadHomePage;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function replaceUri(html, webview, srcPattern, dst) {
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
function loadHomePage(webview, root, mapSrc, mapDst) {
    const html = fs.readFileSync(root, 'utf8');
    return replaceUri(html, webview, mapSrc, mapDst);
}
//# sourceMappingURL=utils.js.map