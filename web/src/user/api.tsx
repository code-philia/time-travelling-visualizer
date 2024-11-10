import { fetch } from "./socket";

import { ProjectionProps, ItertaionStructure } from "../state/types";

export function fetchTimelineData(contentPath: string): ItertaionStructure | void {
    const data = {
        path: contentPath,
        method: 'Trustvis',
        setting: 'normal',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
    }
    fetch('get_iteration_structure', data).then(([_, res]) => res.json()).then((res) => {
        if (res.errorMessage != "") {
            alert(res.errorMessage)
        }
        return res;
    }).catch((err) => {
        console.error('Fetch error:', err);
    })
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
    fetch('updateProjection', data).then(([_, res]) => res.json()).then(res => {
        if (res.errorMessage != "") {
            alert(res.errorMessage)
        }
        return res;
    }).catch(error => {
        console.error('Error fetching data:', error);
    });
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
    fetch(`sprite${dataType}`, data).then(([_, res]) => res.json()).then(res => {
        if (res.errorMessage != "") {
            alert(res.errorMessage)
        }
        return res;
    }
    );
}
