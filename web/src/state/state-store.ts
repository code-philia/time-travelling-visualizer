import { create } from "zustand";
import { StoreApi, UseBoundStore } from "zustand";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { BaseMutableGlobalStore, initMutableGlobalStore, CommonPointsGeography, ProjectionProps } from "./types";
import { BriefProjectionResult } from "../communication/api";
import { BUILD_CONSTANTS } from "../constants";
import { subscribeWithSelector } from "zustand/middleware";
import { selectedListeningProperties, syncOut } from "../communication/message";

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

const CookiesUtil = {
    set: function(name: string, value: string, days: number = 0) {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = `; expires=${date.toUTCString()}`;
        }
        document.cookie = `${name}=${value}${expires}; path=/`;
    },

    get: function(name: string) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for(let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0)
                return c.substring(nameEQ.length, c.length);
        }
        return null;
    },

    delete: function(name: string) {
        this.set(name, "", -1);
    }
};

function cookieSetCustom(name: string, value: string, days: number = 0) {
    const relatedCookieKey = `vis_${name}`;
    return CookiesUtil.set(relatedCookieKey, value, days);
}

function cookieGetCustom(name: string) {
    const relatedCookieKey = `vis_${name}`;
    return CookiesUtil.get(relatedCookieKey);
}

function createCookieProxyMutableTypes<T extends Record<string, string>>(initialState: T, set: SetFunction<object>): WithSettersOnAttr<T> {
    const setters: Record<string, (value: string) => void> = {};

    for (const key in initialState) {
        const relatedCookieKey = `vis_${key}`;

        const fetchedCookie = CookiesUtil.get(relatedCookieKey);
        if (fetchedCookie !== null) {
            initialState[key] = fetchedCookie as T[Extract<keyof T, string>];
        }

        const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        setters[setterName] = (value: string) => {
            set((state) => {
                document.cookie = `${relatedCookieKey}=${value}`;
                return { [key]: value };
            });
        };
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

type CustomGlobalStore = {
    setProjectionDataAtEpoch: (epoch: number, data: BriefProjectionResult) => void;
} & WithSettersOnAttr<{
    backendHost: string;
    visMethod: string;
    contentPath: string;
}>;
function createCustomGlobalStore(set: SetFunction<GlobalStore>): CustomGlobalStore {
    return {
        setProjectionDataAtEpoch: (epoch: number, data: BriefProjectionResult) => set((state) => ({
            allEpochsProjectionData: {
                ...state.allEpochsProjectionData,
                [epoch]: data,
            },
        })),
        // TODO extract these patterns of get and set
        backendHost: cookieGetCustom('backendHost') || configuredMutableGlobalStore.backendHost,
        setBackendHost: (value) => set(() => {
            cookieSetCustom('backendHost', value);
            return { backendHost: value };
        }),
        visMethod: cookieGetCustom('visMethod') || configuredMutableGlobalStore.visMethod,
        setVisMethod: (value) => set(() => {
            cookieSetCustom('visMethod', value);
            return { visMethod: value };
        }),
        contentPath: cookieGetCustom('contentPath') || configuredMutableGlobalStore.contentPath,
        setContentPath: (value) => set(() => {
            cookieSetCustom('contentPath', value);
            return { contentPath: value };
        })
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

const useGlobalStore = create<GlobalStore>()(subscribeWithSelector((set) => ({
    setValue: createDefaultValueSetter(set),
    ...createMutableTypes(configuredMutableGlobalStore, set),
    ...createCustomGlobalStore(set)
})));    // don't use "as xxx" here so that we can check

if (true || BUILD_CONSTANTS.APP_CONFIG !== 'app') {
    // For now, we subscribe each property for one time
    for (const key of selectedListeningProperties) {
        const _key = key as keyof typeof configuredMutableGlobalStore;
        useGlobalStore.subscribe(
            (state) => state[_key],
            (value) => {
                syncOut(_key, value);
            }
        );
    }
}

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
