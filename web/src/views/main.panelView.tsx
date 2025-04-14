import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useSetUpTrainingProcess } from '../state/state-actions';
import BottomPanel from '../component/bottom-panel';
import { useDefaultStore } from '../state/state-store';
import '../index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppPanelViewOnly />
    </StrictMode>
);

function AppPanelViewOnly() {
    const { setValue } = useDefaultStore(['setValue']);
    const setUpTrainingProcess = useSetUpTrainingProcess();

    useEffect(() => {
        setValue("contentPath", "/home/yuhuan/projects/cophi/visualizer-refactor/dev/sample-datasets/new-version-datasets/gcb_tokens");
        setValue("visMethod", "TimeVis");

        (async () => {
            await setUpTrainingProcess();
        })();
    });

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <BottomPanel></BottomPanel>
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
            else {
                console.log('token web received message:', message);
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