import { basicUnsafeGetWithJsonResponse, basicUnsafePostWithJsonResponse, Fetch } from './connection';

// TODO add check functions
export interface ProjectionAttributeSource {
    type: 'folder';
    pattern: string;
}

const supportedProjectionAttributeSuffixes = ['npy', 'png'] as const;
export type ProjectionAttributeSuffix = typeof supportedProjectionAttributeSuffixes[number];

export interface ProjectionAttribute {
    dataType: 'npy' | 'png';
    source: ProjectionAttributeSource;
}

export interface BriefProjectionResult {
    config: {
        dataset: {
            taskType: string,
            attributes?: { [keys: string]: ProjectionAttribute }
        }
    }
    proj: number[][];
    labels: string[];
    label_text_list: string[];
}

export function fetchTrainingProcessStructure(contentPath: string, options?: { host?: string }) {
    return basicUnsafeGetWithJsonResponse(`/getIterationStructure?content_path=${contentPath}`, options);
}

export function updateProjection(contentPath: string, visMethod: string,
    taskType: string, iteration: number, filterIndex: number[] | string): Promise<BriefProjectionResult> {
    const data = {
        path: contentPath,
        iteration: iteration,
        resolution: 200,
        vis_method: visMethod,
        setting: 'normal',
        content_path: contentPath,
        predicates: {},
        TaskType: taskType,
        selectedPoints: filterIndex,
    }
    return basicUnsafePostWithJsonResponse('/updateProjection', data);
}

export function isUmapProjectionResult() {

}

export async function fetchTimelineData(contentPath: string) {
    return basicUnsafePostWithJsonResponse(`/get_itertaion_structure?path=${contentPath}&method=Trustvis&setting=normal`, {});
}


export async function fetchUmapProjectionData(contentPath: string, epoch: number, options: { method?: string, host?: string }): Promise<BriefProjectionResult> {
    const defaultOptions = {
        method: '',
    };
    const combinedOptions = { ...defaultOptions, ...options };

    const data = {
        "content_path": contentPath,
        "vis_method": combinedOptions.method,
        "epoch": `${epoch}`,
    };

    return basicUnsafePostWithJsonResponse('/updateProjection', data, { host: combinedOptions.host });
}

function getOriginalData(contentPath: string, dataType: string, index: number, iteration: number) {
    if (index === null) {
        return;
    }
    const data = {
        params: {
            index: index,
            path: contentPath,
            cus_path: "",
            username: 'admin',
            iteration: iteration
        },
        method: 'GET',
        mode: 'cors'
    };
    return Fetch(`sprite${dataType}`, data);
}

export function getBgimg(contentPath: string, visMethod: string, epoch: number, options?: { host?: string }) {
    const data = {
        "content_path": contentPath,
        "vis_method": visMethod,
        "epoch": `${epoch}`
    };
    return basicUnsafePostWithJsonResponse('/getBackgroundImage', data, options);
}

export function getAttributeResource(contentPath: string, epoch: number, attributeName: string, options?: { host?: string }) {
    const data = {
        "content_path": contentPath,
        "epoch": `${epoch}`,
        "attributes": [attributeName]
    };

    return basicUnsafePostWithJsonResponse('/getAttributes', data, options);
}

// TODO this is an API sugar
export function getText(contentPath: string, options?: { host?: string }) {
    const data = {
        "content_path": contentPath
    };

    return basicUnsafePostWithJsonResponse('/getAllText', data, options);
}
