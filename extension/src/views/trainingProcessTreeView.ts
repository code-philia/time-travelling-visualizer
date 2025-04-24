import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getOpenedFolderPath, loadVisualizationThroughTreeItem, startVisualizingThroughTreeItem } from '../control';

class TreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly iconName: string,
        public children?: TreeItem[],
        public readonly description?: string,
        public readonly options?: {
            command?: vscode.Command,
            resourceUri?: vscode.Uri,
            tooltip?: string,
        },
        public parent?: TreeItem // Add parent property
    ) {
        const collapsible = children && children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;

        super(label, collapsible);

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
class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
    public _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    private updateVisualizeTreeItem(visualizeItem: TreeItem, processPath: string): void {
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

    private resolveRootItems(): TreeItem[] {
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

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (!element) {
            return Promise.resolve(this.resolveRootItems());
        }
        return Promise.resolve(element.children ?? []); // Ensure children are returned
    }
}

export class TrainingProcessTreeView implements vscode.Disposable {
    private treeDataProvider: TreeDataProvider;
    private registration: vscode.Disposable;
    private fileWatcher!: vscode.FileSystemWatcher; // Add file watcher

    constructor() {
        this.treeDataProvider = new TreeDataProvider();
        this.registration = vscode.window.registerTreeDataProvider('training-process-tree-view', this.treeDataProvider);

        // Register commands for context menu actions
        vscode.commands.registerCommand('trainingProcess.info', this.showInfo);
        vscode.commands.registerCommand('trainingProcess.loadResult', this.loadResult);
        vscode.commands.registerCommand('trainingProcess.startVisualizing', this.startVisualizing);

        // Initialize file watcher
        const workspacePath = getOpenedFolderPath();
        if (workspacePath) {
            this.fileWatcher = vscode.workspace.createFileSystemWatcher(`${workspacePath}/**`, false, false, false);

            // Listen to file creation, change, and deletion events
            this.fileWatcher.onDidCreate(() => this.refreshTreeView());
            this.fileWatcher.onDidChange(() => this.refreshTreeView());
            this.fileWatcher.onDidDelete(() => this.refreshTreeView());
        }
    }

    private refreshTreeView(): void {
        this.treeDataProvider._onDidChangeTreeData.fire(); // Trigger tree view refresh
    }

    private showInfo(item: TreeItem): void {
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

    private loadResult(item: TreeItem): void {
        // Get the parent node (training process)
        const parentProcess = item.parent?.parent?.label;
        // Get the item's name (e.g., DVI_1)
        const itemName = item.label;
        if (!parentProcess || !itemName) {
            vscode.window.showErrorMessage('Unable to retrieve parent process or item name.');
            return;
        }
        loadVisualizationThroughTreeItem(parentProcess, itemName);
    }

    private startVisualizing(item: TreeItem): void{
        const itemName = item.label;
        if (!itemName) {
            vscode.window.showErrorMessage('Unable to retrieve item name.');
            return;
        }
        startVisualizingThroughTreeItem(itemName);
    }

    dispose() {
        this.registration.dispose();
        if (this.fileWatcher) {
            this.fileWatcher.dispose(); // Dispose file watcher
        }
    }
}