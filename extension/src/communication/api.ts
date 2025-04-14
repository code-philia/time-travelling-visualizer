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
export function fetchTrainingProcessStructure(contentPath: string, options?: { host?: string }){
    return basicUnsafeGetWithJsonResponse(`/getIterationStructure?content_path=${contentPath}`, options);
}

export function fetchTrainingProcessInfo(contentPath: string, options?: { host?: string }) {
    return basicUnsafeGetWithJsonResponse(`/getTrainingProcessInfo?content_path=${contentPath}`, options);
}

export async function fetchEpochProjection(contentPath: string, visMethod: string, epoch: number, options?: { host: string }){
    const data = {
        "content_path": contentPath,
        "vis_method": visMethod,
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