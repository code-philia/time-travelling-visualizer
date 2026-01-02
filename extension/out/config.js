"use strict";
// NOTE only and always import this ES module and api.ts as an entire namespace:
// `import * as config from './config';`
// and always import other modules by each symbol:
// `import {xxx} from './yyy';`
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
exports.ViewsID = exports.CommandID = exports.ConfigurationID = exports.configurationBaseName = exports.GlobalStorageContext = exports.panelWebviewPort = exports.metadataWebviewPort = exports.controlWebviewPort = exports.editorWebviewPort = exports.isDev = void 0;
exports.getDefaultWebviewOptions = getDefaultWebviewOptions;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
exports.isDev = false;
/* Preserved ports */
exports.editorWebviewPort = 5010;
exports.controlWebviewPort = 5002;
exports.metadataWebviewPort = 5003;
exports.panelWebviewPort = 5011;
class GlobalStorageContext {
    static extensionLocation = __dirname;
    static webRootRelativePath = '../web/dist/';
    static resourceRootRelativePath = 'resources/';
    static extensionContext = undefined;
    constructor() { }
    static get webRoot() {
        return path.join(this.extensionLocation, this.webRootRelativePath);
    }
    static get resourceRoot() {
        return path.join(this.extensionLocation, this.resourceRootRelativePath);
    }
    static initExtensionLocation(root) {
        this.extensionLocation = root;
    }
    static initExtensionContext(context) {
        this.extensionContext = context;
    }
}
exports.GlobalStorageContext = GlobalStorageContext;
// TODO this should not be put in this module?
function getDefaultWebviewOptions() {
    const resourceUri = vscode.Uri.file(GlobalStorageContext.webRoot);
    // console.log(`Resource URI: ${resourceUri}`);
    return {
        "enableScripts": true,
        "localResourceRoots": [
            resourceUri
        ]
    };
}
function withBaseName(id) {
    return `${exports.configurationBaseName}.${id}`;
}
exports.configurationBaseName = 'timeTravellingVisualizer';
class ConfigurationID {
    // basic settings
    static dataType = 'loadVisualization.dataType';
    static taskType = 'loadVisualization.taskType';
    static trainingProcess = 'loadVisualization.trainingProcess';
    static visualizationMethod = 'loadVisualization.visualizationMethod';
    static visualizationID = 'loadVisualization.visualizationID';
    // pllot settings
    static showIndex = 'plotSettings.showIndex';
    static showLabel = 'plotSettings.showLabel';
    static showBackground = 'plotSettings.showBackground';
    static showTrail = 'plotSettings.showTrail';
    static revealOriginalNeighbors = 'plotSettings.revealOriginalNeighbors';
    static revealProjectionNeighbors = 'plotSettings.revealProjectionNeighbors';
    // visualize settings
    static DVIGpuId = 'DVISettings.gpu_id';
    static DVIResolution = 'DVISettings.resolution';
    static DVILambda1 = 'DVISettings.lambda1';
    static DVILambda2 = 'DVISettings.lambda2';
    static DVINNeighbors = 'DVISettings.n_neighbors';
    static DVISNEpochs = 'DVISettings.s_n_epochs';
    static DVIBNEpochs = 'DVISettings.b_n_epochs';
    static DVIPatient = 'DVISettings.patient';
    static DVIMaxEpochs = 'DVISettings.max_epochs';
    static TimeGpuId = 'TimeVisSettings.gpu_id';
    static TimeResolution = 'TimeVisSettings.resolution';
    static TimeLambda = 'TimeVisSettings.lambda';
    static TimeNNeighbors = 'TimeVisSettings.n_neighbors';
    static TimeSNEpochs = 'TimeVisSettings.s_n_epochs';
    static TimeBNEpochs = 'TimeVisSettings.b_n_epochs';
    static TimeTNEpochs = 'TimeVisSettings.t_n_epochs';
    static TimePatient = 'TimeVisSettings.patient';
    static TimeMaxEpochs = 'TimeVisSettings.max_epochs';
    static DynaVisGpuId = 'DynaVisSettings.gpu_id';
    static DynaVisResolution = 'DynaVisSettings.resolution';
    static DynaVisReconstructLossWeight = 'DynaVisSettings.reconstruct_loss_weight';
    static DynaVisTemporalLossWeight = 'DynaVisSettings.temporal_loss_weight';
    static DynaVisVelocityLossWeight = 'DynaVisSettings.velocity_loss_weight';
    static DynaVisNNeighbors = 'DynaVisSettings.n_neighbors';
    static DynaVisSNEpochs = 'DynaVisSettings.s_n_epochs';
    static DynaVisBNEpochs = 'DynaVisSettings.b_n_epochs';
    static DynaVisTNEpochs = 'DynaVisSettings.t_n_epochs';
    static DynaVisPatient = 'DynaVisSettings.patient';
    static DynaVisMaxEpochs = 'DynaVisSettings.max_epochs';
    static UmapNNeighbors = 'UmapSettings.n_neighbors';
    static UmapMinDist = 'UmapSettings.min_dist';
    static UmapMetric = 'UmapSettings.metric';
    constructor() { }
}
exports.ConfigurationID = ConfigurationID;
class CommandID {
    static loadVisualization = withBaseName('loadVisualizationResult');
    static startVisualizing = withBaseName('startVisualizing');
    static setAsDataFolderAndLoadVisualizationResult = withBaseName('setAsDataFolderAndLoadVisualizationResult');
    static setAsDataFolder = withBaseName('setAsDataFolder');
    static configureAndLoadVisualization = withBaseName('configureAndLoadVisualizationResult');
    static openPlotView = withBaseName('openPlotView');
}
exports.CommandID = CommandID;
class ViewsID {
    static metadataView = 'visualizer-metadata-view';
    static inspectView = 'visualizer-inspect-view';
    static rightView = 'visualizer-right-view';
    static influenceView = 'visualizer-influence-view';
}
exports.ViewsID = ViewsID;
//# sourceMappingURL=config.js.map