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
exports.activate = activate;
exports.deactivate = deactivate;
const config = __importStar(require("./config"));
const devLiveServer_1 = require("./devLiveServer");
const commands_1 = require("./commands");
const views_1 = require("./views");
function activate(context) {
    // Cannot read args in launch.json due to
    // vscode using an extension host to manage extensions
    // Setting isDev directly here
    config.GlobalStorageContext.initExtensionLocation(context.extensionUri.fsPath);
    config.GlobalStorageContext.initExtensionContext(context);
    if (config.isDev) {
        console.log(`Enabling dev mode locally. Webviews are using live updated elements...`);
        (0, devLiveServer_1.startDefaultDevLiveServers)(context);
    }
    context.subscriptions.push((0, commands_1.doCommandsRegistration)());
    context.subscriptions.push((0, views_1.doViewsRegistration)());
}
function deactivate() { }
//# sourceMappingURL=extension.js.map