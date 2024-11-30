import { create } from "zustand";
import { StoreApi, UseBoundStore } from "zustand";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { ProjectionProps } from "../state/types";

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
    iteration: number;
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
    updateUUID: string ;  // FIXME should use a global configure object to manage this
}

// TODO make a reflection, so we do not define T
export const GlobalStore = create<T>((set) => ({
    command: '',
    contentPath: "",
    visMethod: 'Trustvis',
    taskType: 'Classification',
    colorType: 'noColoring',
    iteration: 1,
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
}));

export const useStore = <K extends keyof T>(keys: K[]) => {
    return useShallow(GlobalStore, keys);
};
