import { useState, useEffect } from 'react';

const host = 'http://127.0.0.1:5001';

export function Fetch(input: string, init: any) {
    fetch(`${host}/${input}`, init)
        .then(response => response.json())
        .then(res => {
            if (res.errorMessage != "") {
                alert(res.errorMessage)
            }
            return res.json();
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
