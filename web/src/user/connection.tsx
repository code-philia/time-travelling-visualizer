import { useState, useEffect } from 'react';
import { socket } from './socket.tsx';

export function ConnectionStatus() {
    const [isConnected, setIsConnected] = useState(socket.connected);

    useEffect(() => {
        const handleConnect = () => {
            setIsConnected(true);
            console.log('Connected to server');
        };
        const handleDisconnect = () => {
            setIsConnected(false);
            console.log('Disconnected from server');
        };
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
        };
    }, []);

    return (
        <h1>{isConnected ? '✅ Online' : '❌ Disconnected'}</h1>
    );
}
