import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import VisAnalysisPanel from '../component/vis-analysis-panel';
import '../index.css';
import { Metrics, useDefaultStore } from '../state/state.analysisView';

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
    const { setEpoch, setAllEpochMetrics } = useDefaultStore(['setEpoch', 'setAllEpochMetrics']);
    const allEpochMetricsCopy: Record<number, Metrics> = {};

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (!message) {
                console.error('Invalid message:', message);
                return;
            }
            console.log('vis analysis web received message:', message);
            if (message.command === 'updateEpoch') {
                setEpoch(message.data.epoch);
            }
            else if (message.command === 'updateMetrics') {
                const messageData = message.data;
                const newMetrics: Metrics = {
                    neighborTrustworthiness: messageData.neighborTrustworthiness,
                    neighborContinuity: messageData.neighborContinuity,
                    reconstructionPrecision: 0,
                    abnormalMovementsRatio2D: 0,
                    movementConsistency: 0
                };
                allEpochMetricsCopy[messageData.epoch] = newMetrics;
                setAllEpochMetrics(allEpochMetricsCopy);
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