import { create } from "zustand";
import { StoreApi, UseBoundStore } from "zustand";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { CommonPointsGeography, ProjectionProps } from "../state/types";
import { BriefProjectionResult } from "../communication/api";
import { HighlightContext } from "../component/canvas/types";

const initProjectionRes: ProjectionProps = {
    result: [],
    grid_index: [],
    grid_color: '',
    label_name_dict: [],
    label_color_list: [],
    label_list: [],
    maximum_iteration: 0,
    training_data: [],
    testing_data: [],
    evaluation: 0,
    prediction_list: [],
    selectedPoints: [],
    properties: [],
    errorMessage: '',
    color_list: [],
    confidence_list: [],
}

// Not used to ensure all original types are uncapitalized for now
// type EnsureUncapitalizedAttr<T> = {
//     [K in keyof T as Uncapitalize<string & K>]: T[K] | { setK: (value: T[K]) => void };
// }

type SetFunction<T> = (setState: (state: T) => T | Partial<T>) => void;

type SettersOnAttr<T> = {
    [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

// use a flatten-setter type for this
type WithSettersOnAttr<T> = T & SettersOnAttr<T>;

// this can not only be used to the setter of zustand create
function createMutableTypes<T>(initialState: T, set: SetFunction<object>): WithSettersOnAttr<T> {
    // Don't know how to pre declare a type for this
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

type BaseMutableGlobalStore = {
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
    availableEpochs: number[];
    colorDict: Map<number, [number, number, number]>;
    labelDict: Map<number, string>;
    highlightContext: HighlightContext;
    rawPointsGeography: CommonPointsGeography | null;
    textData: string[];

    // cached epoch data
    allEpochsProjectionData: Record<number, BriefProjectionResult>;
    allBackground: Record<number, string>;
    allNeighborSameType: Record<number, number[][]>;
    allNeighborCrossType: Record<number, number[][]>;
    allPredictionProps: Record<number, number[][]>;

    // settings
    backendHost: string;
    showNumber: boolean;
    showText: boolean;
    revealNeighborSameType: boolean;
    revealNeighborCrossType: boolean;
    showMetadata: boolean;
    showBgimg: boolean;

    // filter
    startIndex: number,
    endIndex: number,

    // hovered
    hoveredIndex: number,
    updateHighlightSig: boolean,

    progress: number
}

const initMutableGlobalStore: BaseMutableGlobalStore = {
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
    availableEpochs: [],
    // FIXME should use an object to apply user settings (like color) to original data, computing final point geography, and setting cache
    colorDict: new Map(),
    labelDict: new Map(),
    highlightContext: new HighlightContext(),
    rawPointsGeography: null,
    textData: [],

    // cached epoch data
    allEpochsProjectionData: {},
    allBackground: {},
    allNeighborSameType: {},
    allNeighborCrossType: {},
    allPredictionProps: {},

    // settings
    backendHost: 'localhost:5010',
    showNumber: true,
    showText: true,
    revealNeighborSameType: false,
    revealNeighborCrossType: false,
    showMetadata: false,
    showBgimg: false,

    // filter
    startIndex: -1,
    endIndex: -1,

    // hovered
    hoveredIndex: -1,
    updateHighlightSig: false,

    progress: 0
};

type MutableGlobalStore = WithSettersOnAttr<BaseMutableGlobalStore>;

type CustomGlobalStore = {
    setProjectionDataAtEpoch: (epoch: number, data: BriefProjectionResult) => void;
}
function createCustomGlobalStore(set: SetFunction<GlobalStore>): CustomGlobalStore {
    return {
        setProjectionDataAtEpoch: (epoch: number, data: BriefProjectionResult) => set((state) => ({
            allEpochsProjectionData: {
                ...state.allEpochsProjectionData,
                [epoch]: data,
            },
        }))
    };
}

type DefaultValueSetter<T> = <K extends keyof T>(key: K, value: T[K]) => void;
function createDefaultValueSetter(set: SetFunction<GlobalStore>): DefaultValueSetter<GlobalStore> {
    return (key, value) => set(() => ({ [key]: value }));
}

// FIXME does this lead to cyclic reference of type GlobalStore?
type WithDefaultValueSetter = {
    setValue: DefaultValueSetter<GlobalStore>
};

type GlobalStore = MutableGlobalStore & CustomGlobalStore & WithDefaultValueSetter;

const useGlobalStore = create<GlobalStore>((set) => ({
    setValue: createDefaultValueSetter(set),
    ...createMutableTypes(initMutableGlobalStore, set),
    ...createCustomGlobalStore(set)
}));    // don't use "as xxx" here so that we can check

// comparison-based update
export function useShallow<T, K extends keyof T>(
    store: UseBoundStore<StoreApi<T>>,
    keys: K[]
): Pick<T, K> {
    return useStoreWithEqualityFn(
        store,
        (state) =>
            keys.reduce(
                (prev, curr) => {
                    prev[curr] = state[curr];
                    return prev;
                },
                {} as Pick<T, K>
            ),
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
    const selector = (state: T) =>
        keys.reduce(
            (prev, curr) => {
                prev[curr] = state[curr];
                return prev;
            },
            {} as Pick<T, K>
        );

    return store(selector);
}

export const useDefaultStore = <K extends keyof GlobalStore>(keys: K[]) => {
    return useShallow(useGlobalStore, keys);
};

export const useDefaultStoreAll = () => {
    return useShallowAll(useGlobalStore);
}
