import { useState, useEffect } from 'react';

const host = 'http://127.0.0.1:5001';

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
    host: 'localhost:5000'
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

// obsolete and not tested
export function Fetch(input: string, init: any) {
    return fetch(`${host}/${input}`, init)
        .then(res => res.json())
        .then(res => {
            if (res.errorMessage != "") {
                alert(res.errorMessage)
            }
            return res;
        })
        .catch(error => {
            console.error('Fetch error:', error);
        });
}

export function ConnectionStatus({useVscode}:{useVscode:boolean}) {
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const pingServer = async () => {
            try {
                const response = await fetch('/ping');
                if (response.ok) {
                    setIsConnected(true);
                    console.log('Connected to server');
                } else {
                    setIsConnected(false);
                    console.log('Disconnected from server');
                }
            } catch (error) {
                setIsConnected(false);
                console.log('Disconnected from server');
            }
        };

        const intervalId = setInterval(pingServer, 5000);
        pingServer();
        return () => clearInterval(intervalId);
    }, []);

    return (
        !useVscode && <>{isConnected ? '✅ Online' : '❌ Disconnected'}</>
    );
}
