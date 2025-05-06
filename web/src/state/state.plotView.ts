import { create } from "zustand";
import { StoreApi, UseBoundStore } from "zustand";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { BUILD_CONSTANTS } from "../constants";
import { subscribeWithSelector } from "zustand/middleware";
import { SelectedListener } from "../component/canvas/types";

export type EpochData = {
    projection: number[][];
    prediction: number[];
    confidence: number[];
    predProbability: number[][];
    inClassNeighbors: number[][];
    outClassNeighbors: number[][];
    background: string;
};

export type BaseMutableGlobalStore = {
    epoch: number;
    availableEpochs: number[];
    colorDict: Map<number, [number, number, number]>;
    labelDict: Map<number, string>;

    textData: string[];
    attentionData: number[][];
    originalTextData: Record<string, string>;
    inherentLabelData: number[];
    allEpochData: Record<number, EpochData>;
    progress: number;

    // settings
    showIndex: boolean;
    showLabel: boolean;
    showTrail: boolean;
    revealNeighborSameType: boolean;
    revealNeighborCrossType: boolean;
    showBackground: boolean;

    // filter
    index: Record<string, number[]>;
    shownData: string[];
    highlightData: string[];

    // hovered
    hoveredIndex: number | undefined;
    selectedIndices: number[];
    selectedListener: SelectedListener;
}

export let initMutableGlobalStore: BaseMutableGlobalStore = {
    epoch: 1,
    availableEpochs: [],
    colorDict: new Map(),
    labelDict: new Map(),

    // FIXME we should use null for not loaded data
    textData: [],
    attentionData: [],
    originalTextData: {},
    inherentLabelData: [],
    allEpochData: {},
    progress: 0,

    // settings
    showIndex: true,
    showLabel: true,
    showTrail: false,
    revealNeighborSameType: true,
    revealNeighborCrossType: true,
    showBackground: false,

    // filter
    index: {},
    shownData: ["train", "test"],
    highlightData: [],

    // hovered
    hoveredIndex: undefined,
    selectedIndices: [],
    selectedListener: new SelectedListener(),
};

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

// FIXME does this lead to cyclic reference of type GlobalStore?
type WithDefaultValueSetter = {
    setValue: DefaultValueSetter<GlobalStore>
};

type GlobalStore = MutableGlobalStore & WithDefaultValueSetter;

const useGlobalStore = create<GlobalStore>()(subscribeWithSelector((set) => ({
    setValue: createDefaultValueSetter(set),
    ...createMutableTypes(configuredMutableGlobalStore, set)
})));    // don't use "as xxx" here so that we can check


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
