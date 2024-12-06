import { Fetch } from './connection';
const headers = new Headers();
headers.append('Content-Type', 'application/json');
headers.append('Accept', 'application/json');

export function updateProjection(contentPath: string, visMethod: string,
    taskType: string, iteration: number, filterIndex: number[] | string): Promise<UmapProjectionResult> {
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
    inter_sim_top_k: number[][],
    intra_sim_top_k: number[][]
}

export async function fetchTimelineData(contentPath: string){
    return fetch(`http://localhost:5000/get_itertaion_structure?path=${contentPath}&method=Trustvis&setting=normal`, {
        method: 'POST',
        headers: headers,
        mode: 'cors'
    })
        .then(response => response.json());
}


export async function fetchUmapProjectionData(contentPath: string, iteration: number): Promise<UmapProjectionResult> {
    const umapTaskType = 'Umap-Neighborhood';

    return fetch(`http://localhost:5000/updateProjection`, {
        method: 'POST',
        body: JSON.stringify({
            "path": contentPath,
            "iteration": iteration,
            "resolution": 200,
            "vis_method": 'TrustVis',
            "setting": 'normal',
            "contentPath": contentPath,
            "predicates": {},
            "taskType": umapTaskType,
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
