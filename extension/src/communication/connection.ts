// backend server host
const host = 'http://127.0.0.1:5050';

const headers = new Headers();
headers.append('Content-Type', 'application/json');
headers.append('Accept', 'application/json');

const defaultInit: RequestInit = {
    headers: headers,
    mode: 'cors',
};

interface NetworkOptions {
    host: string;
}

const defaultNetworkOptions = {
    host: 'localhost:5050'
}

export function basicRequest(path: string, options: RequestInit = {}) {
    return fetch(path, {
        ...defaultInit,
        ...options
    });
}

export function basicUnsafeGetWithJsonResponse(path: string, networkOptions: Partial<NetworkOptions> = {}) {
    const combinedOptions = { ...defaultNetworkOptions, ...networkOptions };
    const fullPath = `http://${combinedOptions.host}${path}`;

    return basicRequest(fullPath)
        .then(response => {
            if (response === undefined) {
                throw new Error(`GET ${fullPath} failed with no response`);
            }

            if (response.ok) {
                return response.json();
            } else {
                throw new Error(`GET ${fullPath} failed with response: ${response}`);
            }
        });
}

export function basicUnsafePostWithJsonResponse(path: string, data: number | string | object, networkOptions: Partial<NetworkOptions> = {}) {
    const combinedOptions = { ...defaultNetworkOptions, ...networkOptions };
    const fullPath = `http://${combinedOptions.host}${path}`;

    return basicRequest(fullPath, {
        method: 'POST',
        body: JSON.stringify(data)
    })
        .then(response => {
            if (response === undefined) {
                throw new Error(`POST ${fullPath} failed with no response`);
            }

            if (response.ok) {
                return response.json();
            } else {
                throw new Error(`POST ${fullPath} failed with response: ${response}`);
            }
        });
}