import { create } from "zustand";
import { StoreApi, UseBoundStore } from "zustand";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";

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
    filterIndex: number[];
    dataType: string;
    currLabel: string;
    forward: boolean;
    setContentPath: (contentPath: string) => void;
    setValue: <K extends keyof T>(key: string, value: T[K]) => void;
    colorList: number[][];
    labelNameDict: Record<number, string>;
    setColorList: (colorList: number[][]) => void;

}

export const GlobalStore = create<T>((set) => ({
    command: '',
    contentPath: "",
    visMethod: 'Trustvis',
    taskType: 'Classification',
    colorType: 'noColoring',
    iteration: 1,
    filterIndex: [],
    dataType: 'Image',
    currLabel: '',
    forward: false,
    setContentPath: (contentPath: string) => set({ contentPath }),
    setValue: (key, value) => set({ [key]: value }),

    colorList: [],
    labelNameDict: {},
    setColorList: (colorList) => set({ colorList }),
}));

export const useStore = <K extends keyof T>(keys: K[]) => {
    return useShallow(GlobalStore, keys);
};
