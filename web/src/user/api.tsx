import { Fetch } from './connection';
import { useStore } from '../state/store';
import { useEffect } from 'react';
const headers = new Headers();
headers.append('Content-Type', 'application/json');
headers.append('Accept', 'application/json');

// function fetchTimelineData(contentPath: string): Promise<any> {
//     const data = {
//         path: contentPath,
//         method: 'Trustvis',
//         setting: 'normal',
//         headers: { 'Content-Type': 'application/json' },
//         mode: 'cors',
//     }
//     return Fetch('get_iteration_structure', data)
// }

export function updateProjection(contentPath: string, visMethod: string,
    taskType: string, iteration: number, filterIndex: number[] | string): Promise<any> {
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
    return Fetch('updateProjection', {
        method: 'POST',
        headers: headers,
        mode: 'cors',
        body: JSON.stringify(data)
    })
}

export type UmapProjectionResult = {
    proj: number[][];
    labels: string[];
    label_text_list: string[];
    bounding: {
        x_min: number;
        y_min: number;
        x_max: number;
        y_max: number;
    };
    structure: {
        value: number;
        name: string;
        pid: string;
    }[];
    tokens: string[];
}

export async function fetchTimelineData(contentPath: string){
    return fetch(`http://localhost:5001/get_itertaion_structure?path=${contentPath}&method=Trustvis&setting=normal`, {
        method: 'POST',
        headers: headers,
        mode: 'cors'
    })
        .then(response => response.json());
}


export async function fetchUmapProjectionData(contentPath: string, iteration: number): Promise<UmapProjectionResult> {
    const umapTaskType = 'Umap-Neighborhood';

    return fetch(`http://localhost:5001/updateProjection`, {
        method: 'POST',
        body: JSON.stringify({
            "path": contentPath,
            "iteration": iteration,
            "resolution": 200,
            "vis_method": 'TrustVis',
            "setting": 'normal',
            "content_path": contentPath,
            "predicates": {},
            "TaskType": umapTaskType,
            "selectedPoints": ''
        }),
        headers: headers,
        mode: 'cors'
    })
        .then(response => response.json());
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

export function Api() {
    const { command, contentPath, visMethod, taskType, iteration, filterIndex, setValue } = useStore(["command", "contentPath", "visMethod", "taskType", "iteration", "filterIndex", "setValue"]);

    useEffect(() => {
        if (command != 'update') return;
        setValue('command', '')
        updateProjection(contentPath, visMethod, taskType, iteration, filterIndex)
            .then(res => { console.log(res); setValue('projectionRes', res) })
    }, [command]);
    return (
        <></>
    )
}