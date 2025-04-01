declare const __APP_CONFIG__: string | undefined;
declare const __RUNTIME_PRESET_CONFIG__: object | undefined;

// Ensure __APP_CONFIG__ is defined, default to undefined
export const BUILD_CONSTANTS = {
    APP_CONFIG: typeof __APP_CONFIG__ !== 'undefined' ? __APP_CONFIG__ : undefined,
    RUNTIME_PRESET_CONFIG: typeof __RUNTIME_PRESET_CONFIG__ !== 'undefined' ? __RUNTIME_PRESET_CONFIG__ : undefined
};
