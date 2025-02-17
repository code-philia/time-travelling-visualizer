import * as vscode from 'vscode';

type ValidAttributeSource = string | {
    type: string;
    pattern: string;
};

// NOTE This attribute configuration is related to backend config. Need to be regulated.
interface TrainingProcessAttribute {
    name: string;
    dataType: string;
    source?: ValidAttributeSource;
    data?: object | object[];
}

interface BasicDataset {
    uuid: string;
    name: string;
    baseType: string;
    basePath: string;
    size?: string;
    samples: TrainingProcessAttribute;
    attributes?: TrainingProcessAttribute[];
}

const supportedBuiltinVisualizationMethods = ['DVI', 'TrustVis', 'TimeVis'] as const;
type SupportedBuiltinVisualizationMethod = typeof supportedBuiltinVisualizationMethods[number];

interface BuiltInVisualizationMethodDescription {
    name: SupportedBuiltinVisualizationMethod;
    desc?: string;
}

const supportedBuiltInVisualizationMethodDescriptions: BuiltInVisualizationMethodDescription[] = [
    {
        name: 'DVI',
        // desc: 'Document Visualization Interface'
    },
    {
        name: 'TrustVis',
        // desc: 'Trustworthiness Visualization'
    },
    {
        name: 'TimeVis',
        // desc: 'Time Series Visualization'
    }
];

type VisualizationMethodStatus = 'not-started' | 'model-training' | 'model-ready' | 'projection-calculating' | 'projection-cached';

interface TrainingProcessVisualizationMethodStatus {
    name: string;
    customMethodPath?: string;
    status?: VisualizationMethodStatus;
    cachedVisualizationModelPath?: string;
    cachedProjectionPath?: string;
}

interface TrainingProcessTreeData {
    trainingProcesses: {
        name: string;
        basePath: string;
        datasets: {
            train?: BasicDataset;
            validation?: BasicDataset;
        };
        epochs?: {
            checkpoint?: {
                path: string
            };
            metrics?: any[];     // TODO any cannot deduce the type
        }[];
        visualizationMethods?: TrainingProcessVisualizationMethodStatus[];
    }[];
    datasets: BasicDataset[];
    visualizationMethods: BuiltInVisualizationMethodDescription[];
}

const placeholderVisualizationMethod: TrainingProcessVisualizationMethodStatus = {
    name: 'DVI',
    status: 'not-started'
};

const placeholderSamples: TrainingProcessAttribute = {
    "name": "sample",
    "dataType": "text",
    "source": {
        "type": "folder",
        "pattern": "dataset/sample/text_${index}.txt"
    }
};

const placeholderAttributes: TrainingProcessAttribute[] = [
    {
        "name": "originalText",
        "dataType": "text",
        "source": {
            "type": "file",
            "pattern": "dataset/full_text.json"
        }
    },
    {
        "name": "attention",
        "dataType": "text",
        "source": {
            "type": "file",
            "pattern": "dataset/attention.json"
        }
    },
    {
        "name": "label",
        "dataType": "npy",
        "source": {
            "type": "file",
            "pattern": "dataset/label/labels.npy"
        }
    },
    {
        "name": "inter_similarity",
        "dataType": "npy",
        "source": {
            "type": "folder",
            "pattern": "dataset/inter_similarity/${epoch}.npy"
        }
    },
    {
        "name": "intra_similarity",
        "dataType": "npy",
        "source": {
            "type": "folder",
            "pattern": "dataset/intra_similarity/${epoch}.npy"
        }
    }
];

const placeholderDataset: BasicDataset = {
    uuid: 'Dataset 1',
    name: 'Dataset 1',
    baseType: 'text',
    basePath: '/new-version-datasets/gcb_tokens',
    samples: placeholderSamples,
    attributes: placeholderAttributes
};

const placeholderTreeData: TrainingProcessTreeData = {
    trainingProcesses: [
        {
            name: 'gcb_tokens',
            basePath: '/new-version-datasets/gcb_tokens',
            datasets: {
                validation: {
                    uuid: 'Dataset 1',
                    name: 'Dataset 1',
                    baseType: 'text',
                    basePath: '/new-version-datasets/gcb_tokens',
                    samples: placeholderSamples,
                    attributes: placeholderAttributes
                }
            },
            epochs: [
                {
                    checkpoint: {
                        path: ''
                    },
                    metrics: [
                        { loss: 0.345, accuracy: 0.89 }
                    ]
                },
                {
                    checkpoint: {
                        path: ''
                    },
                    metrics: [
                        { loss: 0.289, accuracy: 0.93 }
                    ]
                }
            ],
            visualizationMethods: [
                {
                    name: 'DVI',
                    status: 'projection-cached',
                    cachedProjectionPath: '/new-version-datasets/gcb_tokens/visualize/DVI'
                },
                {
                    name: 'TimeVis',
                    status: 'projection-cached',
                    cachedProjectionPath: '/new-version-datasets/gcb_tokens/visualize/TimeVis'
                }
            ]
        }
    ],
    datasets: [placeholderDataset],
    visualizationMethods: supportedBuiltInVisualizationMethodDescriptions
};

const demoData = ['<s>', 'Read', 's', 'Ġexactly', 'Ġthe', 'Ġspecified', 'Ġnumber', 'Ġof', 'Ġbytes', 'Ġfrom', 'Ġthe', 'Ġsocket', '</s>', '<s>', 'def', 'Ġread', '_', 'ex', 'actly', 'Ġ(', 'Ġself', 'Ġ,', 'Ġnum', '_', 'bytes', 'Ġ)', 'Ġ:', 'Ġoutput', 'Ġ=', 'Ġb', "''", 'Ġremaining', 'Ġ=', 'Ġnum', '_', 'bytes', 'Ġwhile', 'Ġremaining', 'Ġ>', 'Ġ0', 'Ġ:', 'Ġoutput', 'Ġ+=', 'Ġself', 'Ġ.', 'Ġread', 'Ġ(', 'Ġremaining', 'Ġ)', 'Ġremaining', 'Ġ=', 'Ġnum', '_', 'bytes', 'Ġ-', 'Ġlen', 'Ġ(', 'Ġoutput', 'Ġ)', 'Ġreturn', 'Ġoutput', '</s>'];

// Updated TreeItem class with path property
// TODO in order to load the children asynchronously, can we use reflection?
class TreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly iconName: string,
        public readonly children?: TreeItem[],
        public readonly description?: string
    ) {
        const collapsible = children && children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;

        super(label, collapsible);
        this.iconPath = new vscode.ThemeIcon(iconName);
    }
}

// Tree View Provider implementation
class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private data: TrainingProcessTreeData = placeholderTreeData;

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    private resolveRootItems(): TreeItem[] {
        const children = [
            new TreeItem(
                'Training Processes', 'server-process',
                this.data.trainingProcesses.map(p => this.resolveItemTrainingProcess(p)),
            ),
            new TreeItem(
                'Available Datasets', 'folder-library',
                this.data.datasets.map(d => this.resolveItemBasicDataset(d)),
            ),
            new TreeItem('Available Visualization Methods', 'symbol-misc',
                this.data.visualizationMethods.map(m => this.resolveItemBuiltInVisualizationMethodDescription(m)),    
            )
        ];

        return children;
    }

    private resolveItemTrainingProcess(process: TrainingProcessTreeData['trainingProcesses'][0]): TreeItem {
        const children: TreeItem[] = [];

        const datasetItems = Object.keys(process.datasets).map(key => {
            const _key = key as 'train' | 'validation';
            const dataset = process.datasets[_key] as BasicDataset;     // NOTE these type hints are so unnecessary but have to
            return this.resolveItemBasicDataset(dataset);
        });
        children.push(...datasetItems);

        if (process.epochs) {
            children.push(this.resolveItemEpochs(process.epochs));
        }

        if (process.visualizationMethods) {
            const visualizationMethodItems = process.visualizationMethods.map(method => this.resolveItemTrainingProcessVisualizationMethodStatus(method));
            const visualizationMethodsTreeItem = new TreeItem(
                'Visualization Methods',
                'symbol-misc',
                visualizationMethodItems
            );
            children.push(visualizationMethodsTreeItem);
        }

        return new TreeItem(
            process.name,
            'graph',
            children
        );
    }

    private resolveItemBasicDataset(dataset: BasicDataset): TreeItem {
        const getPattern = (source: ValidAttributeSource | undefined) => {
            if (typeof source === 'undefined') {
                return undefined;
            }
            if (typeof source === 'string') {
                return source;
            }
            return source.pattern;
        };

        return new TreeItem(
            dataset.name,
            'database',
            [
                new TreeItem(
                    'Directory',
                    'folder-opened',
                    [],
                    dataset.basePath
                ),
                new TreeItem(
                    'Samples',
                    'symbol-class',
                    demoData.map((sample, index) => new TreeItem(
                        `${index}`,
                        'symbol-string',
                        [],
                        sample
                    ))
                ),
                new TreeItem(
                    'Attributes',
                    'symbol-class',
                    dataset.attributes!.map(attr => this.resolveItemTrainingProcessAttribute(attr))
                )
            ],
            // dataset.basePath
        );
    }

    private resolveItemEpochs(epochs: TrainingProcessTreeData['trainingProcesses'][0]['epochs']): TreeItem {
        let children: TreeItem[] = [];

        if (epochs) {
            children = epochs.map((epoch, index) => {
                const children = [];
    
                if (epoch.checkpoint) {
                    children.push(new TreeItem(
                        'Checkpoint',
                        'save',
                        [],
                        epoch.checkpoint.path
                    ));
                }
    
                if (epoch.metrics) {
                    children.push(new TreeItem(
                        'Metrics',
                        'graph-line',
                        [], 
                    ));
                }
    
                return new TreeItem(
                    `${index + 1}`,
                    'symbol-numeric',
                    children
                );
            });
        }

        return new TreeItem(
            'Epochs',
            'graph',
            children
        );
    }

    private resolveItemTrainingProcessVisualizationMethodStatus(status: TrainingProcessVisualizationMethodStatus): TreeItem {
        const children = [];

        if (status.customMethodPath) {
            children.push(new TreeItem(
                'Custom Method',
                'symbol-method',
                [],
                status.customMethodPath
            ));
        }

        if (status.cachedProjectionPath) {
            children.push(new TreeItem(
                'Cached Projection',
                'symbol-ruler',
                [],
                status.cachedProjectionPath
            ));
        }

        if (status.cachedVisualizationModelPath) {
            children.push(new TreeItem(
                'Cached Visualization Model',
                'graph',
                [],
                status.cachedVisualizationModelPath
            ));
        }

        return new TreeItem(
            status.name,
            'symbol-misc',
            children,
            status.status === 'projection-cached' ? 'cached' : status.status
        );
    }

    private resolveItemBuiltInVisualizationMethodDescription(method: BuiltInVisualizationMethodDescription): TreeItem {
        return new TreeItem(
            method.name,
            'graph',
            [],
            method.desc
        );
    }

    private resolveItemTrainingProcessAttribute(attribute: TrainingProcessAttribute): TreeItem {
        const children = [];

        if (attribute.source) {
            children.push(new TreeItem(
                'Source',
                'symbol-file',
                [],
                typeof attribute.source === 'string' ? attribute.source : attribute.source.pattern
            ));
        }

        return new TreeItem(
            attribute.name,
            'symbol-property',
            children
        );
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (!element) {
            return Promise.resolve(this.resolveRootItems());
        }
        return Promise.resolve(element?.children ?? []);
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
