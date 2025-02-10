import * as vscode from 'vscode';

interface TreeData {
    trainingDatasets: {
        name: string;
        data: object[];
    }[];
    trainingProcesses: {
        onData: string;
        epochs?: {
            checkpoint?: {
                path: string
            };
            output?: any[];     // TODO any cannot deduce the type
            projection?: any[];
        }[]
    }[];
    visualizationModels: {
        name: string;
        path: string;
    }[];
}

const placeholderTreeData: TreeData = {
    trainingDatasets: [
        {
            name: 'Dataset 1',
            data: [
                { id: 1, name: 'Test Set 1', size: '1.2GB', type: 'csv' },
                { id: 2, name: 'Test Set 2', size: '800MB', type: 'json' },
                { id: 3, name: 'Test Set 3', size: '2.1GB', type: 'json' }
            ]
        },
        {
            name: 'Dataset 2',
            data: [
                { id: 4, name: 'Test Set', size: '500MB', type: 'csv' },
                { id: 5, name: 'Validation Set', size: '300MB', type: 'json' }
            ]
        }
    ],
    trainingProcesses: [
        {
            onData: 'Dataset 1',
            epochs: [
                {
                    checkpoint: {
                        path: '/checkpoints/epoch_1.ckpt'
                    },
                    output: [
                        { loss: 0.345, accuracy: 0.89 },
                        { loss: 0.322, accuracy: 0.91 }
                    ],
                    projection: [
                        { x: 0.1, y: 0.2, z: 0.3 },
                        { x: 0.4, y: 0.5, z: 0.6 }
                    ]
                }
            ]
        },
        {
            onData: 'Dataset 2',
            epochs: [
                {
                    checkpoint: {
                        path: '/checkpoints/epoch_2.ckpt'
                    },
                    output: [
                        { loss: 0.289, accuracy: 0.93 },
                        { loss: 0.275, accuracy: 0.94 }
                    ]
                }
            ]
        }
    ],
    visualizationModels: [
        {
            name: 'Model_v1',
            path: '/models/visualization_v1.pb'
        },
        {
            name: 'Model_v2',
            path: '/models/visualization_v2.pb'
        },
        {
            name: 'Model_v3',
            path: '/models/visualization_v3.pb'
        }
    ]
};

// Updated TreeItem class with path property
class TreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconName: string,
        public readonly path: string = label,
        public readonly description?: string
    ) {
        super(label, collapsibleState);
        this.iconPath = new vscode.ThemeIcon(iconName);
    }
}

// Tree View Provider implementation
class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (!element) {
            // Root level
            return Promise.resolve([
                new TreeItem('Training Datasets', vscode.TreeItemCollapsibleState.Collapsed, 'database', 'Training Data'),
                new TreeItem('Training Processes', vscode.TreeItemCollapsibleState.Collapsed, 'server-process', 'Training Processes'),
                new TreeItem('Visualization Model', vscode.TreeItemCollapsibleState.Collapsed, 'symbol-misc', 'Visualization Model')
            ]);
        }

        // Store the parent path to identify the level
        const parentPath = element.path || element.label;

        // Child items based on parent
        if (parentPath === 'Training Data') {
            return Promise.resolve(
                placeholderTreeData.trainingDatasets.map((dataset, index) =>
                    new TreeItem(
                        `${dataset.name}`,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'database',
                        `Training Data/Dataset ${index + 1}`
                    )
                )
            );
        }

        if (parentPath.startsWith('Training Data/Dataset ')) {
            const datasetIndex = parseInt(parentPath.split('Dataset ')[1]) - 1;
            const dataset = placeholderTreeData.trainingDatasets[datasetIndex];

            return Promise.resolve(
                dataset.data.map((item: any) =>
                    new TreeItem(
                        `${item.name}`,
                        vscode.TreeItemCollapsibleState.None,
                        'file-text',
                        `${parentPath}/${item.name}`,
                        `${item.type}, ${item.size}`
                    )
                )
            );
        }

        if (parentPath === 'Training Processes') {
            return Promise.resolve(
                placeholderTreeData.trainingProcesses.map((process, index) =>
                    new TreeItem(
                        `Process on ${process.onData}`,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'pulse',
                        `Training Processes/Process ${index + 1}`
                    )
                )
            );
        }

        if (parentPath.includes('/output')) {
            const processIndex = parseInt(parentPath.split('Process ')[1].split('/')[0]) - 1;
            const epochIndex = parseInt(parentPath.split('Epoch ')[1].split('/')[0]) - 1;
            const outputs = placeholderTreeData.trainingProcesses[processIndex].epochs![epochIndex].output!;

            return Promise.resolve(
                outputs.map((output, index) =>
                    new TreeItem(
                        `Metrics ${index + 1}`,
                        vscode.TreeItemCollapsibleState.None,
                        'symbol-numeric',
                        `${parentPath}/${index}`,
                        `loss=${output.loss}, accuracy=${output.accuracy}`
                    )
                )
            );
        }

        if (parentPath.includes('/projection')) {
            const processIndex = parseInt(parentPath.split('Process ')[1].split('/')[0]) - 1;
            const epochIndex = parseInt(parentPath.split('Epoch ')[1].split('/')[0]) - 1;
            const projections = placeholderTreeData.trainingProcesses[processIndex].epochs![epochIndex].projection!;

            return Promise.resolve(
                projections.map((proj, index) =>
                    new TreeItem(
                        // `Projection ${index + 1}: (${proj.x}, ${proj.y}, ${proj.z})`,
                        `Projection ${index + 1}`,
                        vscode.TreeItemCollapsibleState.None,
                        'symbol-ruler',
                        `${parentPath}/${index}`
                    )
                )
            );
        }

        if (parentPath.includes('/Epoch ')) {
            const processIndex = parseInt(parentPath.split('Process ')[1].split('/')[0]) - 1;
            const epochIndex = parseInt(parentPath.split('Epoch ')[1]) - 1;
            const epoch = placeholderTreeData.trainingProcesses[processIndex].epochs![epochIndex];

            const items: TreeItem[] = [];

            if (epoch.checkpoint) {
                items.push(
                    new TreeItem(
                        `Checkpoint`,
                        vscode.TreeItemCollapsibleState.None,
                        'save',
                        `${parentPath}/checkpoint`,
                        `${epoch.checkpoint.path}`
                    )
                );
            }

            if (epoch.output) {
                items.push(
                    new TreeItem(
                        'Output Metrics',
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'graph-line',
                        `${parentPath}/output`
                    )
                );
            }

            if (epoch.projection) {
                items.push(
                    new TreeItem(
                        'Projections',
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'symbol-ruler',
                        `${parentPath}/projection`
                    )
                );
            }

            return Promise.resolve(items);
        }

        // TODO use a new method to judge which layer it is at, so that we don't "if" reversely one by one
        if (parentPath.startsWith('Training Processes/Process ')) {
            const processIndex = parseInt(parentPath.split('Process ')[1]) - 1;
            const process = placeholderTreeData.trainingProcesses[processIndex];

            const epochs = process.epochs || [];
            return Promise.resolve([
                ...epochs.map((epoch, epochIndex) =>
                    new TreeItem(
                        `Epoch ${epochIndex + 1}`,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'symbol-numeric',
                        `${parentPath}/Epoch ${epochIndex + 1}`
                    )
                )
            ]);
        }

        if (parentPath === 'Visualization Model') {
            return Promise.resolve(
                placeholderTreeData.visualizationModels.map(model =>
                    new TreeItem(
                        `${model.name}`,
                        vscode.TreeItemCollapsibleState.None,
                        'graph',
                        `Visualization Model/${model.name}`,
                        `${model.path}`
                    )
                )
            );
        }

        return Promise.resolve([]);
    }
}

export class BrowseTreeView implements vscode.Disposable {
    private treeDataProvider: TreeDataProvider;
    private registration: vscode.Disposable;

    constructor() {
        this.treeDataProvider = new TreeDataProvider();
        this.registration = vscode.window.registerTreeDataProvider('browse-tree-view', this.treeDataProvider);
    }

    dispose() {
        this.registration.dispose();
    }
}
