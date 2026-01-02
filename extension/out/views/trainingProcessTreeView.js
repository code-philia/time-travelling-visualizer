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
exports.TrainingProcessTreeView = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const control_1 = require("../control");
class TreeItem extends vscode.TreeItem {
    label;
    iconName;
    children;
    description;
    options;
    parent;
    constructor(label, iconName, children, description, options, parent // Add parent property
    ) {
        const collapsible = children && children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        super(label, collapsible);
        this.label = label;
        this.iconName = iconName;
        this.children = children;
        this.description = description;
        this.options = options;
        this.parent = parent;
        this.iconPath = new vscode.ThemeIcon(iconName);
        this.contextValue = 'treeItem'; // Add this line to enable context menu
        this.parent = parent; // Set parent
        if (options) {
            this.command = options.command;
            this.resourceUri = options.resourceUri;
            this.tooltip = options.tooltip;
        }
    }
}
// Tree View Provider implementation
class TreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    getTreeItem(element) {
        return element;
    }
    updateVisualizeTreeItem(visualizeItem, processPath) {
        const visualizePath = path.join(processPath, 'visualize');
        if (!fs.existsSync(visualizePath)) {
            visualizeItem.children = []; // Ensure children is set even if the directory doesn't exist
            this._onDidChangeTreeData.fire(visualizeItem);
            return;
        }
        const visualizationDirs = fs.readdirSync(visualizePath).filter((file) => {
            const fullPath = path.join(visualizePath, file);
            return fs.statSync(fullPath).isDirectory();
        });
        visualizeItem.children = visualizationDirs.map((dir) => {
            return new TreeItem(dir, 'graph-scatter', undefined, `Visualization result`, {
                resourceUri: vscode.Uri.file(path.join(visualizePath, dir)),
                tooltip: `Right-click for options`, // Tooltip remains for hover information
            }, visualizeItem); // Set parent to visualizeItem
        });
        // Add context menu options
        visualizeItem.children.forEach((child) => {
            child.contextValue = 'visualizationResult'; // Used for right-click context menu
            delete child.command; // Ensure no default left-click or hover command
        });
        // Ensure the collapsible state is set correctly
        visualizeItem.collapsibleState = visualizeItem.children.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;
        this._onDidChangeTreeData.fire(visualizeItem); // Notify the Tree View to refresh
    }
    resolveRootItems() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }
        const rootPath = workspaceFolders[0].uri.fsPath;
        const trainingProcesses = fs.readdirSync(rootPath).filter((file) => {
            const fullPath = path.join(rootPath, file);
            return fs.statSync(fullPath).isDirectory();
        });
        return trainingProcesses.map((process) => {
            const processPath = path.join(rootPath, process);
            const visualizeItem = new TreeItem('visualize', 'eye', undefined, 'All visualization results', {
                resourceUri: vscode.Uri.file(path.join(processPath, 'Visualization')),
            });
            this.updateVisualizeTreeItem(visualizeItem, processPath);
            const children = [
                new TreeItem('Dataset', 'database', undefined, 'Dataset info', {
                    resourceUri: vscode.Uri.file(path.join(processPath, 'dataset')),
                }, undefined), // Set parent later
                new TreeItem('Epochs', 'sync', undefined, 'Checkpoints and embeddings', {
                    resourceUri: vscode.Uri.file(path.join(processPath, 'epochs')),
                }, undefined), // Set parent later
                visualizeItem,
            ];
            const rootItem = new TreeItem(process, 'root-folder', children, `Training Process`, {
                resourceUri: vscode.Uri.file(processPath)
            });
            rootItem.contextValue = 'trainingProcess';
            children.forEach(child => child.parent = rootItem); // Set parent for root children
            return rootItem;
        });
    }
    getChildren(element) {
        if (!element) {
            return Promise.resolve(this.resolveRootItems());
        }
        return Promise.resolve(element.children ?? []); // Ensure children are returned
    }
}
class TrainingProcessTreeView {
    treeDataProvider;
    registration;
    fileWatcher; // Add file watcher
    constructor() {
        this.treeDataProvider = new TreeDataProvider();
        this.registration = vscode.window.registerTreeDataProvider('training-process-tree-view', this.treeDataProvider);
        // Register commands for context menu actions
        vscode.commands.registerCommand('trainingProcess.info', this.showInfo);
        vscode.commands.registerCommand('trainingProcess.loadResult', this.loadResult);
        vscode.commands.registerCommand('trainingProcess.startVisualizing', this.startVisualizing);
        // Initialize file watcher
        const workspacePath = (0, control_1.getOpenedFolderPath)();
        if (workspacePath) {
            this.fileWatcher = vscode.workspace.createFileSystemWatcher(`${workspacePath}/**`, false, false, false);
            // Listen to file creation, change, and deletion events
            this.fileWatcher.onDidCreate(() => this.refreshTreeView());
            this.fileWatcher.onDidChange(() => this.refreshTreeView());
            this.fileWatcher.onDidDelete(() => this.refreshTreeView());
        }
    }
    refreshTreeView() {
        this.treeDataProvider._onDidChangeTreeData.fire(); // Trigger tree view refresh
    }
    showInfo(item) {
        if (!item.resourceUri) {
            vscode.window.showErrorMessage('No resource URI found for this item.');
            return;
        }
        const infoFilePath = path.join(item.resourceUri.fsPath, 'info.json');
        const methodName = item.label.split('_')[0]; // Extract method name (e.g., "DVI" from "DVI_1")
        if (!fs.existsSync(infoFilePath)) {
            // Create info.json if it doesn't exist
            const defaultContent = { method: methodName };
            fs.writeFileSync(infoFilePath, JSON.stringify(defaultContent, null, 4), 'utf-8');
        }
        // Open the info.json file in the editor
        vscode.workspace.openTextDocument(infoFilePath).then((doc) => {
            vscode.window.showTextDocument(doc);
        });
    }
    loadResult(item) {
        if (!item.resourceUri) {
            vscode.window.showErrorMessage('No resource URI found for this item.');
            return;
        }
        const infoFilePath = path.join(item.resourceUri.fsPath, 'info.json');
        if (!fs.existsSync(infoFilePath)) {
            vscode.window.showErrorMessage('No visualization info found for this item.');
            return;
        }
        // Get data type and task type from info.json
        const infoContent = fs.readFileSync(infoFilePath, 'utf-8');
        let info;
        try {
            info = JSON.parse(infoContent);
        }
        catch (error) {
            vscode.window.showErrorMessage('Error parsing info.json.');
            return;
        }
        const dataType = info.data_type;
        const taskType = info.task_type;
        // Get the parent node (training process)
        const parentProcess = item.parent?.parent?.label;
        // Get the item's name (e.g., DVI_1)
        const itemName = item.label;
        if (!parentProcess || !itemName) {
            vscode.window.showErrorMessage('Unable to retrieve parent process or item name.');
            return;
        }
        (0, control_1.loadVisualizationThroughTreeItem)(dataType, taskType, parentProcess, itemName);
    }
    startVisualizing(item) {
        const itemName = item.label;
        if (!itemName) {
            vscode.window.showErrorMessage('Unable to retrieve item name.');
            return;
        }
        (0, control_1.startVisualizingThroughTreeItem)(itemName);
    }
    dispose() {
        this.registration.dispose();
        if (this.fileWatcher) {
            this.fileWatcher.dispose(); // Dispose file watcher
        }
    }
}
exports.TrainingProcessTreeView = TrainingProcessTreeView;
//# sourceMappingURL=trainingProcessTreeView.js.map