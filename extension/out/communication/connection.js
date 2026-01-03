"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.basicRequest = basicRequest;
exports.basicUnsafeGetWithJsonResponse = basicUnsafeGetWithJsonResponse;
exports.basicUnsafePostWithJsonResponse = basicUnsafePostWithJsonResponse;
// backend server host
const host = 'http://127.0.0.1:5050';
const headers = new Headers();
headers.append('Content-Type', 'application/json');
headers.append('Accept', 'application/json');
const defaultInit = {
    headers: headers,
    mode: 'cors',
};
const defaultNetworkOptions = {
    host: 'localhost:5050'
};
function basicRequest(path, options = {}) {
    return fetch(path, {
        ...defaultInit,
        ...options
    });
}
function basicUnsafeGetWithJsonResponse(path, networkOptions = {}) {
    const combinedOptions = { ...defaultNetworkOptions, ...networkOptions };
    const fullPath = `http://${combinedOptions.host}${path}`;
    return basicRequest(fullPath)
        .then(response => {
        if (response === undefined) {
            throw new Error(`GET ${fullPath} failed with no response`);
        }
        if (response.ok) {
            return response.json();
        }
        else {
            throw new Error(`GET ${fullPath} failed with response: ${response}`);
        }
    });
}
function basicUnsafePostWithJsonResponse(path, data, networkOptions = {}) {
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
        }
        else {
            throw new Error(`POST ${fullPath} failed with response: ${response}`);
        }
    });
}
//# sourceMappingURL=connection.js.map