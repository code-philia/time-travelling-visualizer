interface WorkspaceState {
    currentEpoch: number;
    colorDict: Map<number, [number, number, number]>;
    labelDict: Map<number, string>;
    labelList: number[];
    availableEpochs: number[];
    projection: number[][];
    scope: number[];
    inClassNeighbors: number[];
    outClassNeighbors: number[];
    tokenList?: string[];
    background?: string;
    predProbability?: number[];
    prediction?: number[];
    confidence?: number[];
}

export const defaultWorkspaceState: WorkspaceState = {
    currentEpoch: 0,
    colorDict: new Map<number, [number, number, number]>(),
    labelDict: new Map<number, string>(),
    labelList: [],
    availableEpochs: [],
    projection: [],
    scope: [],
    inClassNeighbors: [],
    outClassNeighbors: [],
    tokenList: undefined,
    background: undefined,
    predProbability: undefined,
    prediction: undefined,
    confidence: undefined,
};