import { BriefProjectionResult } from "../communication/api";
import { HighlightContext } from "../component/canvas/types";

export interface ContainerProps {
    width: number;
    height: number;
}

export interface BoundaryProps {
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
}

export interface ProjectionProps {
    result: number[][];
    grid_index: number[];
    grid_color: string;
    label_name_dict: string[];
    label_color_list: string[];
    label_list: string[];
    maximum_iteration: number;
    training_data: number[];
    testing_data: number[];
    evaluation: number;
    prediction_list: string[];
    selectedPoints: number[];
    properties: number[];
    errorMessage: string;
    color_list: number[][];
    confidence_list: number[];
}

export interface IterationStructure {
    structure: {
        value: number;
        name: string;
        pid: string;
    }[];
}

export interface CommonPointsGeography {
    positions: [number, number, number][];
    labels: number[];
    colors: [number, number, number][];
    sizes: number[];
    alphas: number[];
}

export type BaseMutableGlobalStore = {
    command: string;
    contentPath: string;
    visMethod: string;
    taskType: string;
    colorType: string;
    epoch: number;
    filterIndex: number[] | string;
    dataType: string;
    colorList: number[][];
    labelNameDict: Record<number, string>;
    timelineData: number[] | undefined;
    updateUUID: string;
    allEpochsProjectionData: Record<number, BriefProjectionResult>;
    availableEpochs: number[];
    colorDict: Map<number, [number, number, number]>;
    labelDict: Map<number, string>;
    highlightContext: HighlightContext;
    rawPointsGeography: CommonPointsGeography | null;

    projection: number[][];
    textData: string[];
    attentionData: number[][];
    originalTextData: Record<string, string>;
    inherentLabelData: number[];

    // settings
    backendHost: string;
    showNumber: boolean;
    showText: boolean;
    revealNeighborSameType: boolean;
    revealNeighborCrossType: boolean;
    showMetadata: boolean;
    neighborSameType: number[][];
    neighborCrossType: number[][];
    lastNeighborSameType: number[][];
    lastNeighborCrossType: number[][];
    predictionProps: number[][];
    showBgimg: boolean;

    // filter
    filterState: boolean;
    filterType: 'label' | 'prediction';
    filterValue: string;

    // hovered
    hoveredIndex: number | undefined;

    // dummy settings
    showLossAttribution: boolean;
    showTokensWeightAsSize: boolean;
    showTokensAlignmentAsColor: boolean
}

export let initMutableGlobalStore: BaseMutableGlobalStore = {
    command: '',
    contentPath: "",
    visMethod: 'Trustvis',
    taskType: 'Classification',
    colorType: 'noColoring',
    epoch: 1,
    filterIndex: "",
    dataType: 'Image',
    colorList: [],
    labelNameDict: {},
    timelineData: undefined,
    updateUUID: '',     // FIXME should use a global configure object to manage this
    allEpochsProjectionData: {},
    availableEpochs: [],
    // FIXME should use an object to apply user settings (like color) to original data, computing final point geography, and setting cache
    colorDict: new Map(),
    labelDict: new Map(),
    highlightContext: new HighlightContext(0),
    rawPointsGeography: null,

    // FIXME we should use null for not loaded data
    projection: [],
    textData: [],
    attentionData: [],
    originalTextData: {},
    inherentLabelData: [],

    // settings
    backendHost: '127.0.0.1:5050',      // pointing to localhost could yield request stalling and not found
    showNumber: true,
    showText: true,
    revealNeighborSameType: false,
    revealNeighborCrossType: false,
    showMetadata: false,
    neighborSameType: [],
    neighborCrossType: [],
    lastNeighborCrossType: [],
    lastNeighborSameType: [],
    predictionProps: [],
    showBgimg: false,

    // filter
    filterState: false,
    filterType: 'label',
    filterValue: '',

    // hovered
    hoveredIndex: -1,

    // dummy settings
    showLossAttribution: false,
    showTokensWeightAsSize: true,
    showTokensAlignmentAsColor: true
};
