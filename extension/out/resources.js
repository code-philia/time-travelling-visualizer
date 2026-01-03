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
exports.iconPaths = void 0;
exports.getIconUri = getIconUri;
const vscode = __importStar(require("vscode"));
const config = __importStar(require("./config"));
exports.iconPaths = {
    "image-type": "imagesmode_24dp_5F6368_FILL0_wght400_GRAD0_opsz24.svg",
    "text-type": "title_24dp_5F6368_FILL0_wght400_GRAD0_opsz24.svg",
    "classification-task": "category_24dp_5F6368_FILL0_wght300_GRAD0_opsz24.svg",
    "non-classification-task": "circle_24dp_5F6368_FILL0_wght300_GRAD0_opsz24.svg"
};
function getIconUri(iconName) {
    const relativeIconPath = exports.iconPaths[iconName];
    if (relativeIconPath === undefined) {
        throw new Error(`Icon name ${iconName} not found`);
    }
    const resourceRootUri = vscode.Uri.file(config.GlobalStorageContext.resourceRoot);
    return vscode.Uri.joinPath(resourceRootUri, relativeIconPath);
}
//# sourceMappingURL=resources.js.map