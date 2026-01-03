import { create } from "zustand";
import { StoreApi, UseBoundStore } from "zustand";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { BUILD_CONSTANTS } from "../constants";
import { subscribeWithSelector } from "zustand/middleware";
import { SelectedListener } from "../state/types";
import { TrainingEvent, InfluenceSample } from "../component/types";

// Types from plotView
export type EpochData = {
    projection: number[][];
    prediction: number[];
    predProbability: number[][];
    originalNeighbors: number[][];
    projectionNeighbors: number[][];
    background: string;
};

// Unified state interface combining all views
export type BaseMutableGlobalStore = {
    // Basic configuration
    dataType: 'Image' | 'Text';
    taskType: string;
    
    // Epoch and time-related data
    epoch: number;
    availableEpochs: number[];
    
    // Color and label mappings
    colorDict: Map<number, [number, number, number]>;
    labelDict: Map<number, string>;
    
    // Text and token data
    textData: string[];
    tokenList: string[];
    attentionData: number[][];
    originalTextData: Record<string, string>;
    inherentLabelData: number[];
    alignment: number[][];
    
    // Epoch data
    allEpochData: Record<number, EpochData>;
    progress: number;
    
    // Loading performance tracking
    loadingStats: {
        currentEpoch: number | null;
        currentBatchEpochs: number[];  // All epochs in current batch
        currentBatch: number;
        totalBatches: number;
        totalEpochs: number;
        epochLoadTimes: Record<number, { fetchTime: number; renderTime: number }>;
        totalFetchTime: number;
        totalRenderTime: number;
        isLoading: boolean;
        currentPhase: 'idle' | 'fetching' | 'rendering';
        lastBatchTime: number;
        avgEpochTime: number;
    };
    
    // Display settings
    showIndex: boolean;
    showLabel: boolean;
    showTrail: boolean;
    revealOriginalNeighbors: boolean;
    revealProjectionNeighbors: boolean;
    showBackground: boolean;
    
    // Filter and display data
    index: Record<string, number[]>;
    shownData: string[];
    highlightData: string[];
    
    // Interaction state
    hoveredIndex: number | undefined;
    selectedIndices: number[];
    selectedListener: SelectedListener;
    
    // Focus mode
    isFocusMode: boolean;
    focusIndices: number[];
    
    // Training events and influence
    trainingEvents: TrainingEvent[];
    trainingEvent: TrainingEvent | null; // Current training event for influence view
    influenceSamples: InfluenceSample[];
    
    // Raw data for detail views
    rawData: string;
    shownDoc: string;
    shownCode: string;
};

export let initMutableGlobalStore: BaseMutableGlobalStore = {
    // Basic configuration
    dataType: 'Image',
    taskType: '',
    
    // Epoch and time-related data
    epoch: 1,
    availableEpochs: [],
    
    // Color and label mappings
    colorDict: new Map(),
    labelDict: new Map(),
    
    // Text and token data
    textData: [],
    tokenList: [],
    attentionData: [],
    originalTextData: {},
    inherentLabelData: [],
    alignment: [],
    
    // Epoch data for different views
    allEpochData: {},
    progress: 0,
    
    // Loading performance tracking
    loadingStats: {
        currentEpoch: null,
        currentBatchEpochs: [],
        currentBatch: 0,
        totalBatches: 0,
        totalEpochs: 0,
        epochLoadTimes: {},
        totalFetchTime: 0,
        totalRenderTime: 0,
        isLoading: false,
        currentPhase: 'idle' as const,
        lastBatchTime: 0,
        avgEpochTime: 0,
    },
    
    // Display settings
    showIndex: true,
    showLabel: true,
    showTrail: false,
    revealOriginalNeighbors: true,
    revealProjectionNeighbors: true,
    showBackground: false,
    
    // Filter and display data
    index: {},
    shownData: ["train", "test"],
    highlightData: [],
    
    // Interaction state
    hoveredIndex: undefined,
    selectedIndices: [],
    selectedListener: new SelectedListener(),
    
    // Focus mode
    isFocusMode: false,
    focusIndices: [],
    
    // Training events and influence
    trainingEvents: [],
    trainingEvent: null,
    influenceSamples: [],
    
    // Raw data for detail views
    rawData: "",
    shownDoc: '',
    shownCode: ''
};

type SetFunction<T> = (setState: (state: T) => T | Partial<T>) => void;

type SettersOnAttr<T> = {
    [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

type WithSettersOnAttr<T> = T & SettersOnAttr<T>;

function createMutableTypes<T>(initialState: T, set: SetFunction<object>): WithSettersOnAttr<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setters: any = {};

    for (const key in initialState) {
        const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        setters[setterName] = (value: typeof key) => set(() => ({ [key]: value }));
    }
    return {
        ...initialState,
        ...setters,
    };
}

const presetConfig = BUILD_CONSTANTS.RUNTIME_PRESET_CONFIG;
if (presetConfig) {
    for (const key in presetConfig) {
        if (key in initMutableGlobalStore) {
            const value = (presetConfig as Record<string, unknown>)[key] as any;
            if (value !== undefined) {
                (initMutableGlobalStore as any)[key] = value;
            }
        }
    }
}
const configuredMutableGlobalStore = initMutableGlobalStore;

type MutableGlobalStore = WithSettersOnAttr<BaseMutableGlobalStore>;

type DefaultValueSetter<T> = <K extends keyof T>(key: K, value: T[K]) => void;
function createDefaultValueSetter(set: SetFunction<GlobalStore>): DefaultValueSetter<GlobalStore> {
    return (key, value) => set(() => ({ [key]: value }));
}

type WithDefaultValueSetter = {
    setValue: DefaultValueSetter<GlobalStore>
};

type WithClear = {
  clear: () => void;
};

type GlobalStore = MutableGlobalStore & WithDefaultValueSetter & WithClear;

const useGlobalStore = create<GlobalStore>()(subscribeWithSelector((set) => ({
    setValue: createDefaultValueSetter(set),
    ...createMutableTypes(configuredMutableGlobalStore, set),
    clear: () => {
        const newInitialState = { 
            ...initMutableGlobalStore,
            colorDict: new Map(),
            labelDict: new Map(),
            selectedListener: new SelectedListener()
        };
        set(newInitialState);
    },
})));

// Utility functions for shallow comparison
export function useShallow<T, K extends keyof T>(
    store: UseBoundStore<StoreApi<T>>,
    keys: K[]
): Pick<T, K> {
    return useStoreWithEqualityFn(
        store,
        (state) => {
            const result = {} as Pick<T, K>;
            for (const key of keys) {
                result[key] = state[key];
            }
            return result;
        },
        shallow
    );
};

export function useShallowAll<T>(store: UseBoundStore<StoreApi<T>>): T {
    return useStoreWithEqualityFn(store, (state) => state, shallow);
};

export function useOnSetOperation<T, K extends keyof T>(
    store: UseBoundStore<StoreApi<T>>,
    keys: K[]
): Pick<T, K> {
    return useStoreWithEqualityFn(
        store,
        (state) => {
            const result = {} as Pick<T, K>;
            for (const key of keys) {
                result[key] = state[key];
            }
            return result;
        },
        shallow
    );
}

export const useDefaultStore = <K extends keyof GlobalStore>(keys: K[]) => {
    return useShallow(useGlobalStore, keys);
};

export const useDefaultStoreAll = () => {
    return useShallowAll(useGlobalStore);
}