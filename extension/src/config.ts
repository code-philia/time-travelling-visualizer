// NOTE only and always import this ES module and api.ts as an entire namespace:
// `import * as config from './config';`
// and always import other modules by each symbol:
// `import {xxx} from './yyy';`

import * as vscode from 'vscode';
import * as path from 'path';

export let isDev = false;

/* Preserved ports */

export const editorWebviewPort = 5010;
export const controlWebviewPort = 5002;
export const metadataWebviewPort = 5003;
export const panelWebviewPort = 5011;

export class GlobalStorageContext {
	private static extensionLocation: string = __dirname;
	private static readonly webRootRelativePath = '../web/dist/';
	private static readonly resourceRootRelativePath = 'resources/';
	public static extensionContext: vscode.ExtensionContext | undefined = undefined;

	private constructor() { }

	static get webRoot(): string {
		return path.join(this.extensionLocation, this.webRootRelativePath);
	}

	static get resourceRoot(): string {
		return path.join(this.extensionLocation, this.resourceRootRelativePath);
	}

	static initExtensionLocation(root: string): void {
		this.extensionLocation = root;
	}

	static initExtensionContext(context: vscode.ExtensionContext): void {
		this.extensionContext = context;
	}
}

// TODO this should not be put in this module?
export function getDefaultWebviewOptions(): vscode.WebviewOptions {
	const resourceUri = vscode.Uri.file(GlobalStorageContext.webRoot);
	// console.log(`Resource URI: ${resourceUri}`);
	return {
		"enableScripts": true,
		"localResourceRoots": [
			resourceUri
		]
	};
}

function withBaseName(id: string): string {
    return `${configurationBaseName}.${id}`;
}

export const configurationBaseName = 'timeTravellingVisualizer';

export class ConfigurationID {
	// basic settings
    static readonly dataType = 'loadVisualization.dataType';
    static readonly taskType = 'loadVisualization.taskType';
	static readonly trainingProcess = 'loadVisualization.trainingProcess';
	static readonly visualizationMethod = 'loadVisualization.visualizationMethod';
	static readonly visualizationID = 'loadVisualization.visualizationID';
	
	// pllot settings
	static readonly showIndex = 'plotSettings.showIndex';
	static readonly showLabel = 'plotSettings.showLabel';
	static readonly showBackground = 'plotSettings.showBackground';
	static readonly showTrail = 'plotSettings.showTrail';
	static readonly revealOriginalNeighbors = 'plotSettings.revealOriginalNeighbors';
	static readonly revealProjectionNeighbors = 'plotSettings.revealProjectionNeighbors';

	// visualize settings
	static readonly DVIGpuId = 'DVISettings.gpu_id';
	static readonly DVIResolution = 'DVISettings.resolution';
	static readonly DVILambda1 = 'DVISettings.lambda1';
	static readonly DVILambda2 = 'DVISettings.lambda2';
	static readonly DVINNeighbors = 'DVISettings.n_neighbors';
	static readonly DVISNEpochs = 'DVISettings.s_n_epochs';
	static readonly DVIBNEpochs = 'DVISettings.b_n_epochs';
	static readonly DVIPatient = 'DVISettings.patient';
	static readonly DVIMaxEpochs = 'DVISettings.max_epochs';

	static readonly TimeGpuId = 'TimeVisSettings.gpu_id';
	static readonly TimeResolution = 'TimeVisSettings.resolution';
	static readonly TimeLambda = 'TimeVisSettings.lambda';
	static readonly TimeNNeighbors = 'TimeVisSettings.n_neighbors';
	static readonly TimeSNEpochs = 'TimeVisSettings.s_n_epochs';
	static readonly TimeBNEpochs = 'TimeVisSettings.b_n_epochs';
	static readonly TimeTNEpochs = 'TimeVisSettings.t_n_epochs';
	static readonly TimePatient = 'TimeVisSettings.patient';
	static readonly TimeMaxEpochs = 'TimeVisSettings.max_epochs';

	static readonly DynaVisGpuId = 'DynaVisSettings.gpu_id';
	static readonly DynaVisResolution = 'DynaVisSettings.resolution';
	static readonly DynaVisReconstructLossWeight = 'DynaVisSettings.reconstruct_loss_weight';
	static readonly DynaVisTemporalLossWeight = 'DynaVisSettings.temporal_loss_weight';
	static readonly DynaVisVelocityLossWeight = 'DynaVisSettings.velocity_loss_weight';
	static readonly DynaVisNNeighbors = 'DynaVisSettings.n_neighbors';
	static readonly DynaVisSNEpochs = 'DynaVisSettings.s_n_epochs';
	static readonly DynaVisBNEpochs = 'DynaVisSettings.b_n_epochs';
	static readonly DynaVisTNEpochs = 'DynaVisSettings.t_n_epochs';
	static readonly DynaVisPatient = 'DynaVisSettings.patient';
	static readonly DynaVisMaxEpochs = 'DynaVisSettings.max_epochs';

	static readonly UmapNNeighbors = 'UmapSettings.n_neighbors';
	static readonly UmapMinDist = 'UmapSettings.min_dist';
	static readonly UmapMetric = 'UmapSettings.metric';

    private constructor() {}
}

export class CommandID {
    static readonly loadVisualization = withBaseName('loadVisualizationResult');
    static readonly startVisualizing = withBaseName('startVisualizing');
    static readonly setAsDataFolderAndLoadVisualizationResult = withBaseName('setAsDataFolderAndLoadVisualizationResult');
    static readonly setAsDataFolder = withBaseName('setAsDataFolder');
    static readonly configureAndLoadVisualization = withBaseName('configureAndLoadVisualizationResult');
}

export class ViewsID {
    static readonly metadataView = 'visualizer-metadata-view';
	static readonly inspectView = 'visualizer-inspect-view';
	static readonly detailView = 'visualizer-detail-view';
	static readonly rightView = 'visualizer-right-view';
	static readonly visAnalysisView = 'visualizer-analysis-view';
}
