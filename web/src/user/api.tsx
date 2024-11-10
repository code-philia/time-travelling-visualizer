import { Fetch } from './connection';

import { ProjectionProps, ItertaionStructure } from "../state/types";

export function fetchTimelineData(contentPath: string): ItertaionStructure | void {
    const data = {
        path: contentPath,
        method: 'Trustvis',
        setting: 'normal',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
    }
    return Fetch('get_iteration_structure', data)
}

export function updateProjection(contentPath: string, visMethod: string,
    taskType: string, iteration: number, filterIndex: number[]): ProjectionProps | void {
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
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
    }
    return Fetch('updateProjection', data)
}

export function getOriginalData(contentPath: string, dataType: string, index: number, iteration: number) {
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
