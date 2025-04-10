import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useSetUpTrainingProcess } from '../state/state-actions.ts';
import { MainBlock } from '../component/main-block.tsx';
import { MessageHandler } from '../communication/message.tsx';
import { useDefaultStore } from '../state/state-store.ts';
import '../index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppPlotViewOnly />
    </StrictMode>
);

function AppPlotViewOnly() {
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
        <div style={{ width: '100%', height: '100%', display: 'flex' }}>
            <MainBlock></MainBlock>
            <MessageHandler></MessageHandler>
        </div>
    );
}