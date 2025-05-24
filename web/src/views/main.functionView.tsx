import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { FunctionPanel } from '../component/function-panel';
import { EpochData, useDefaultStore } from '../state/state.rightView';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppFunctionPanelViewOnly />
    </StrictMode>
);

function AppFunctionPanelViewOnly() {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <FunctionPanel />
            <MessageHandler></MessageHandler>
        </div>
    );
}

function MessageHandler() {
    const { setValue } = useDefaultStore(['setValue']);
    const allEpochDataCopy: Record<number, EpochData> = {};

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
                const colorDict = new Map<number, [number, number, number]>();
                messageData.colorList.forEach((c: [number,number,number], i: number) => {
                    colorDict.set(i, c);                    
                });
                setValue('colorDict', colorDict);

                const labelDict = new Map<number, string>();
                messageData.labelTextList.forEach((l: string, i: number) => {
                    labelDict.set(i, l);
                });
                setValue('labelDict', labelDict);
                setValue('tokenList', messageData.tokenList);
                setValue('availableEpochs', messageData.availableEpochs);
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
            else if(message.command === 'updateEpochData'){
                const messageData = message.data;
                const newEpochData: EpochData = {
                    projection: messageData.projection,
                    embedding: messageData.embedding,
                };
                allEpochDataCopy[messageData.epoch] = newEpochData;
                setValue('allEpochData', allEpochDataCopy);
                setValue('epoch', messageData.epoch);
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