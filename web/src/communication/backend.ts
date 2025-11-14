import axios, { AxiosResponse } from 'axios';

// Backend server configuration
const DEFAULT_HOST = 'http://localhost:5050';

interface NetworkOptions {
    host?: string;
}

/**
 * Interfaces
 */
export interface BriefProjectionResult {
    proj: number[][];
    labels: number[];
    scale: number[];
}

/**
 * Basic HTTP request functions using axios
 */
function getFullUrl(path: string, options?: NetworkOptions): string {
    const host = options?.host || DEFAULT_HOST;
    return `${host}${path}`;
}

async function basicGetWithJsonResponse(path: string, options?: NetworkOptions): Promise<any> {
    try {
        const response: AxiosResponse = await axios.get(getFullUrl(path, options));
        return response.data;
    } catch (error) {
        throw new Error(`GET ${getFullUrl(path, options)} failed: ${error}`);
    }
}

async function basicPostWithJsonResponse(path: string, data: any, options?: NetworkOptions): Promise<any> {
    try {
        const response: AxiosResponse = await axios.post(getFullUrl(path, options), data, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        throw new Error(`POST ${getFullUrl(path, options)} failed: ${error}`);
    }
}

/**
 * Backend API functions
 */
export function triggerStartVisualizing(
    contentPath: string, 
    visMethod: string, 
    visID: string, 
    dataType: string, 
    taskType: string,
    visConfig: any, 
    options?: NetworkOptions
) {
    const data = {
        "content_path": contentPath,
        "vis_method": visMethod,
        "vis_id": visID,
        "data_type": dataType,
        "task_type": taskType,
        "vis_config": visConfig
    };
    return basicPostWithJsonResponse('/startVisualizing', data, options);
}

export function fetchTrainingProcessInfo(contentPath: string, options?: NetworkOptions) {
    return basicGetWithJsonResponse(`/getTrainingProcessInfo?content_path=${contentPath}`, options);
}

export async function fetchEpochProjection(
    contentPath: string, 
    visID: string, 
    epoch: number, 
    options?: NetworkOptions
) {
    const data = {
        "content_path": contentPath,
        "vis_id": visID,
        "epoch": `${epoch}`,
    };
    return basicPostWithJsonResponse('/updateProjection', data, options);
}

export function getText(contentPath: string, options?: NetworkOptions) {
    const data = {
        "content_path": contentPath
    };
    return basicPostWithJsonResponse('/getAllText', data, options);
}

export function getAlignment(contentPath: string, options?: NetworkOptions) {
    const data = {
        "content_path": contentPath
    };
    return basicPostWithJsonResponse('/getAlignment', data, options);
}

export function getAttributeResource(
    contentPath: string, 
    epoch: number, 
    attributeName: string, 
    options?: NetworkOptions
) {
    const data = {
        "content_path": contentPath,
        "epoch": `${epoch}`,
        "attributes": [attributeName]
    };
    return basicPostWithJsonResponse('/getAttributes', data, options);
}

export function getOriginalNeighbors(contentPath: string, epoch: number, options?: NetworkOptions) {
    const data = {
        "content_path": contentPath,
        "epoch": epoch
    };
    return basicPostWithJsonResponse('/getOriginalNeighbors', data, options);
}

export function getProjectionNeighbors(
    contentPath: string, 
    vis_id: string, 
    epoch: number, 
    options?: NetworkOptions
) {
    const data = {
        "content_path": contentPath,
        "vis_id": vis_id,
        "epoch": epoch
    };
    return basicPostWithJsonResponse('/getProjectionNeighbors', data, options);
}

export function getBackground(
    contentPath: string, 
    visID: string, 
    epoch: number | undefined, 
    options?: NetworkOptions
) {
    const data = {
        "content_path": contentPath,
        "vis_id": visID,
        "epoch": `${epoch}`
    };
    return basicPostWithJsonResponse('/getBackground', data, options).then((response) => {
        const { background_image_base64 } = response as { background_image_base64: string };
        return `data:image/png;base64,${background_image_base64}`;
    });
}

export function getImageData(contentPath: string, index: number, options?: NetworkOptions) {
    const data = {
        "content_path": contentPath,
        "index": index
    };
    return basicPostWithJsonResponse('/getImageData', data, options).then((response) => {
        const { image_base64 } = response as { image_base64: string };
        return `data:image/png;base64,${image_base64}`;
    });
}

export function getTextData(contentPath: string, index: number, options?: NetworkOptions) {
    const data = {
        "content_path": contentPath,
        "index": index
    };
    return basicPostWithJsonResponse('/getTextData', data, options).then((response) => {
        const { text } = response as { text: string };
        return text;
    });
}

export function getVisualizeMetrics(
    contentPath: string, 
    visID: string, 
    epoch: number, 
    options?: NetworkOptions
) {
    const data = {
        "content_path": contentPath,
        "vis_id": visID,
        "epoch": `${epoch}`
    };
    return basicPostWithJsonResponse('/getVisualizeMetrics', data, options);
}

export function getInfluenceSamples(
    contentPath: string,  
    epoch: number, 
    trainingEvent: any, 
    options?: NetworkOptions
) {
    const data = {
        "content_path": contentPath,
        "epoch": `${epoch}`,
        "training_event": trainingEvent,
        "num_samples": 10 // Default number of samples to fetch
    };
    return basicPostWithJsonResponse('/getInfluenceSamples', data, options);
}

export function calculateTrainingEvents(
    contentPath: string, 
    epoch: number, 
    eventTypes: string[], 
    options?: NetworkOptions
) {
    const data = {
        "content_path": contentPath,
        "epoch": `${epoch}`,
        "event_types": eventTypes
    };
    return basicPostWithJsonResponse('/calculateTrainingEvents', data, options);
}

// Test connection function
export function testConnection(message: string, options?: NetworkOptions) {
    const data = { message };
    return basicPostWithJsonResponse('/testConnection', data, options);
}
