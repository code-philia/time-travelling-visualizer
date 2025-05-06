import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import DetailPanel from '../component/detail-panel';
import '../index.css';
import { PredictionData, useDefaultStore } from '../state/state.detailView';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppDetailPanelViewOnly />
    </StrictMode>
);

function AppDetailPanelViewOnly() {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <DetailPanel></DetailPanel>
            <MessageHandler></MessageHandler>
        </div>
    );
}

function MessageHandler() {
    const { setHoveredIndex, setLabels, setAllPredictionData, setEpoch, setLabelDict, setImageData } =
        useDefaultStore(['setHoveredIndex', 'setLabels', 'setEpoch', 'setAllPredictionData', 'setLabelDict', 'setImageData']);

    const allPredictionDataCopy: Record<number, PredictionData> = {};
    
    const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        if (!message) {
            console.error("Invalid message:", message);
            return;
        }
        console.log("detail web received message:", message);
        if (message.command === "init") {
            const labelTextList = message.data.labelTextList;
            const labelDict = new Map<number, string>();
            for (let i = 0; i < labelTextList.length; i++) {
                labelDict.set(i, labelTextList[i]);
            }
            setLabelDict(labelDict);
            setLabels(message.data.labels);
        }
        else if (message.command === "updatePrediction") {
            allPredictionDataCopy[message.data.epoch] = {
                prediction: message.data.prediction,
                confidence: message.data.confidence,
                probability: message.data.probability,
            };
            setAllPredictionData(allPredictionDataCopy);
        }
        else if (message.command === 'updateEpoch') {
            const messageData = message.data;
            setEpoch(messageData.epoch);
        } 
        else if (message.command === "updateHoveredIndex") {
            setHoveredIndex(message.data.hoveredIndex);
            setImageData(message.data.image);
        }
    };

    useEffect(() => {
        window.addEventListener("message", handleMessage);
        return () => {
            window.removeEventListener("message", handleMessage);
        };
    }, []);

    return <></>;
}

window.vscode?.postMessage({ state: 'load' }, '*');