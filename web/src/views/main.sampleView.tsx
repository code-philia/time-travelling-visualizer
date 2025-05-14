import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import SamplePanel from '../component/sample-panel';
import '../index.css';
import { EpochData, useDefaultStore } from '../state/state.detailView';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppSamplePanelViewOnly />
    </StrictMode>
);

function AppSamplePanelViewOnly() {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <SamplePanel></SamplePanel>
            <MessageHandler></MessageHandler>
        </div>
    );
}

function MessageHandler() {
    const { setHoveredIndex, setLabels, setAllEpochData, setEpoch, setLabelDict, setAvailableEpochs, setImageData} =
        useDefaultStore(['setHoveredIndex', 'setLabels', 'setEpoch', 'setAllEpochData', 'setLabelDict', 'setAvailableEpochs', 'setImageData'
        ]);

    const allEpochDataCopy: Record<number, EpochData> = {};
    
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
            setAvailableEpochs(message.data.availableEpochs);
        }
        else if (message.command === "updatePrediction") {
            allEpochDataCopy[message.data.epoch] = {
                prediction: message.data.prediction,
                confidence: message.data.confidence,
                probability: message.data.probability,
                originalNeighbors: message.data.originalNeighbors,
                projectionNeighbors: message.data.projectionNeighbors,
            };
            setAllEpochData(allEpochDataCopy);
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