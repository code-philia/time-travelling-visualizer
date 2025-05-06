import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BottomPanel } from '../component/bottom-panel';
import '../index.css';
import { Neighborhood, useDefaultStore } from '../state/state.tokenView';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppPanelViewOnly />
    </StrictMode>
);

function AppPanelViewOnly() {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <BottomPanel></BottomPanel>
            <MessageHandler></MessageHandler>
        </div>
    );
}

function MessageHandler() {
    const { setValue } = useDefaultStore(['setValue']);
    const allNeighborsCopy: Record<number, Neighborhood> = {};

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (!message) {
                console.error('Invalid message:', message);
                return;
            }
            console.log('token web received message:', message);
            if (message.command === 'init') {
                const messageData = message.data;
                setValue('labels', messageData.labels);
                setValue('tokenList', messageData.tokenList);
            }
            else if(message.command === 'updateSelectedIndices') {
                const messageData = message.data;
                if (messageData.selectedIndices !== undefined) {
                    setValue('selectedIndices', messageData.selectedIndices);
                }
                else {
                    setValue('selectedIndices', []);
                }
            }
            else if (message.command === 'updateHoveredIndex') {
                const messageData = message.data;
                setValue('hoveredIndex', messageData.hoveredIndex);
            }
            else if (message.command === 'updateEpoch') {
                const messageData = message.data;
                setValue('epoch', messageData.epoch);
            }
            else if (message.command === 'updateNeighbors') {
                const messageData = message.data;
                allNeighborsCopy[messageData.epoch] = {
                    inClassNeighbors: messageData.inClassNeighbors,
                    outClassNeighbors: messageData.outClassNeighbors,
                };
                setValue('allNeighbors', allNeighborsCopy);
            }
        };
        
        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    return <></>
}

window.vscode?.postMessage({ state: 'load' }, '*');