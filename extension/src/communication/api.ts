import { basicUnsafeGetWithJsonResponse, basicUnsafePostWithJsonResponse } from "./connection";

/**
 * Interfaces
 */
export interface BriefProjectionResult {
    proj: number[][];
    labels: number[];
    scale: number[];
}


/**
 * Interaction with backend
 */
export function triggerStartVisualizing(contentPath: string, visMethod: string, visID: string,taskType: string,visConfig: any, options?: { host?: string }) {
    const data = {
        "content_path": contentPath,
        "vis_method": visMethod,
        "vis_id": visID,
        "task_type": taskType,
        "vis_config": visConfig
    };
    return basicUnsafePostWithJsonResponse('/startVisualizing', data, options);
}

export function fetchTrainingProcessStructure(contentPath: string, options?: { host?: string }){
    return basicUnsafeGetWithJsonResponse(`/getIterationStructure?content_path=${contentPath}`, options);
}

export function fetchTrainingProcessInfo(contentPath: string, options?: { host?: string }) {
    return basicUnsafeGetWithJsonResponse(`/getTrainingProcessInfo?content_path=${contentPath}`, options);
}

export async function fetchEpochProjection(contentPath: string, visID: string, epoch: number, options?: { host: string }){
    const data = {
        "content_path": contentPath,
        "vis_id": visID,
        "epoch": `${epoch}`,
    };
    return basicUnsafePostWithJsonResponse('/updateProjection', data, options);
}

export function getText(contentPath: string, options?: { host?: string }) {
    const data = {
        "content_path": contentPath
    };
    return basicUnsafePostWithJsonResponse('/getAllText', data, options);
}

export function getAttributeResource(contentPath: string, epoch: number, attributeName: string, options?: { host?: string }) {
    const data = {
        "content_path": contentPath,
        "epoch": `${epoch}`,
        "attributes": [attributeName]
    };

    return basicUnsafePostWithJsonResponse('/getAttributes', data, options);
}


export function getOriginalNeighbors(contentPath: string, epoch: number, options?: { host?: string }) {
    const data = {
        "content_path": contentPath,
        "epoch": epoch
    };
    return basicUnsafePostWithJsonResponse('/getOriginalNeighbors', data, options);
}

export function getProjectionNeighbors(contentPath: string, vis_id: string, epoch: number, options?: { host?: string }) {
    const data = {
        "content_path": contentPath,
        "vis_id": vis_id,
        "epoch": epoch
    };
    return basicUnsafePostWithJsonResponse('/getProjectionNeighbors', data, options);
}

export function getBackground(contentPath: string, visID: string, epoch: number | undefined, width: number, height: number, scale: number[] | undefined, options?: { host?: string }) {
    const data = {
        "content_path": contentPath,
        "vis_id": visID,
        "epoch": `${epoch}`,
        "width": width,
        "height": height,
        "scale": scale
    };
    return basicUnsafePostWithJsonResponse('/getBackground', data, options).then((response) => {
        const { background_image_base64 } = response as { background_image_base64: string };
        return `data:image/png;base64,${background_image_base64}`;
    });
}

export function getImageData(contentPath: string, index: number, options?: { host?: string }) {
    const data = {
        "content_path": contentPath,
        "index": index
    }
    return basicUnsafePostWithJsonResponse('/getImageData', data, options).then((response) => {
        const { image_base64 } = response as { image_base64: string };
        return `data:image/png;base64,${image_base64}`;
    });
}

export function getVisualizeMetrics(contentPath: string, visID: string, epoch: number, options?: { host?: string }) {
    const data = {
        "content_path": contentPath,
        "vis_id": visID,
        "epoch": `${epoch}`
    };
    return basicUnsafePostWithJsonResponse('/getVisualizeMetrics', data, options);
}