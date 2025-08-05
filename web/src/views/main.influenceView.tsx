import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { useDefaultStore } from '../state/state.influenceView';
import InfluencePanel from '../component/influence-panel';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppInfluenceViewOnly />
    </StrictMode>
);

function AppInfluenceViewOnly() {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <InfluencePanel></InfluencePanel>
            <MessageHandler></MessageHandler>
        </div>
    );
}

function MessageHandler() {
    const { setValue } = useDefaultStore(['setValue']);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (!message) {
                console.error('Invalid message:', message);
                return;
            }
            console.log('Influence web view received message: ', message);
            if (message.command === 'init') {
            }
            else if(message.command === 'updateInfluenceSamples') {
                const messageData = message.data;
                setValue('influenceSamples', messageData.influenceSamples);
                setValue('trainingEvent', messageData.trainingEvent);
            }
        };
        
        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    return <></>;
}

window.vscode?.postMessage({ state: 'load' }, '*');