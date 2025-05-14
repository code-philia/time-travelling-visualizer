import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import VisAnalysisPanel from '../component/vis-analysis-panel';
import '../index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppVisAnalysisViewOnly />
    </StrictMode>
);

function AppVisAnalysisViewOnly() {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <VisAnalysisPanel />
            <MessageHandler></MessageHandler>
        </div>
    );
}

function MessageHandler() {
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (!message) {
                console.error('Invalid message:', message);
                return;
            }
            console.log('vis analysis web received message:', message);

        };
        
        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    return <></>
}

window.vscode?.postMessage({ state: 'load' }, '*');