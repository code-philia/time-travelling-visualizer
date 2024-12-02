import { create } from "zustand";
import { StoreApi, UseBoundStore } from "zustand";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { ProjectionProps } from "../state/types";
import { UmapProjectionResult } from "../user/api";
import { HighlightContext } from "../canvas/types";

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

export const useShallow = <T, K extends keyof T>(
    store: UseBoundStore<StoreApi<T>>,
    keys: K[]
): Pick<T, K> => {
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

interface T {
    command: string;
    contentPath: string;
    visMethod: string;
    taskType: string;
    colorType: string;
    epoch: number;
    setEpoch: (epoch: number) => void;
    filterIndex: number[] | string;
    dataType: string;
    currLabel: string;
    forward: boolean;
    setContentPath: (contentPath: string) => void;
    setValue: <K extends keyof T>(key: string, value: T[K]) => void;
    colorList: number[][];
    labelNameDict: Record<number, string>;
    setColorList: (colorList: number[][]) => void;
    projectionRes: ProjectionProps;
    timelineData: object | undefined;
    updateUUID: string;  // FIXME should use a global configure object to manage this
    allEpochsProjectionData: Record<number, UmapProjectionResult>;
    setProjectionDataAtEpoch: (epoch: number, data: UmapProjectionResult) => void;
    availableEpochs: number[];

    colorDict: Map<number, [number, number, number]>;
    labelDict: Map<number, string>;
    setColorDict: (labelDict: Map<number, [number, number, number]>) => void;
    setLabelDict: (colorDict: Map<number, string>) => void;

    highlightContext: HighlightContext;
    setHighlightContext: (highlightContext: HighlightContext) => void;
}

// TODO make a reflection, so we do not define T
export const GlobalStore = create<T>((set) => ({
    command: '',
    contentPath: "",
    visMethod: 'Trustvis',
    taskType: 'Classification',
    colorType: 'noColoring',
    epoch: 1,
    setEpoch: (epoch: number) => set({ epoch }),
    filterIndex: "",
    dataType: 'Image',
    currLabel: '',
    forward: false,
    setContentPath: (contentPath: string) => set({ contentPath }),
    setValue: (key, value) => set({ [key]: value }),
    projectionRes: initProjectionRes,
    colorList: [],
    labelNameDict: {},
    setColorList: (colorList) => set({ colorList }),
    timelineData: undefined,
    updateUUID: '',
    allEpochsProjectionData: {},  // TODO add cache and lazy-load for this
    setProjectionDataAtEpoch: (epoch: number, data: UmapProjectionResult) => set((state) => ({
        allEpochsProjectionData: {
            ...state.allEpochsProjectionData,
            [epoch]: data,
        },
    })),
    availableEpochs: new Array(30).fill(0).map((_, i) => i + 1),
    
    colorDict: new Map(),
    labelDict: new Map(),
    setColorDict: (colorDict) => set({ colorDict }),
    setLabelDict: (labelDict) => set({ labelDict }),

    highlightContext: new HighlightContext(),
    setHighlightContext: (highlightContext) => set({ highlightContext })
}));

export const useStore = <K extends keyof T>(keys: K[]) => {
    return useShallow(GlobalStore, keys);
};
