import { Fetch } from './connection';
const headers = new Headers();
headers.append('Content-Type', 'application/json');
headers.append('Accept', 'application/json');

interface NetworkOptions {
    host: string;
}

const defaultNetworkOptions = {
    host: 'localhost:5000'
}

function basicUnsafePost(path: string, data: number | string | object, networkOptions: NetworkOptions = defaultNetworkOptions) {
    const combinedOptions = { ...defaultNetworkOptions, ...networkOptions };
    const fullPath = `http://${combinedOptions.host}${path}`;

    return Fetch(fullPath, {
        method: 'POST',
        headers: headers,
        mode: 'cors',
        body: JSON.stringify(data)
    }).then(response => {
        if (response.ok) {
            return response.json();
        } else {
            console.error(`POST failed with response`, response);
            throw new Error(`POST failed with response`);
        }
    });
}

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


export async function fetchUmapProjectionData(contentPath: string, epoch: number, options: { method?: string, host?: string}): Promise<UmapProjectionResult> {
    const defaultOptions = {
        method: '',
        host: 'localhost:5000'
    };
    const combinedOptions = {...defaultOptions, ...options};

    const data = {
        "content_path": contentPath,
        "vis_method": combinedOptions.method,
        "epoch": `${epoch}`,
    };

    return basicUnsafePost('/updateProjection', data, { host: combinedOptions.host })
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
