import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MainBlock } from "../component/main-block.tsx";
import { useDefaultStore } from "../state/state.plotView.ts";
import "../index.css";
import { notifyEpochSwitch } from "../communication/viewMessage.tsx";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <AppPlotViewOnly />
    </StrictMode>
);

function AppPlotViewOnly() {
    return (
        <div style={{ width: "100%", height: "100%", display: "flex" }}>
            <MainBlock></MainBlock>
            <MessageHandler></MessageHandler>
        </div>
    );
}

function MessageHandler() {
    const { setValue } = useDefaultStore(['setValue']);

    const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        if (!message) {
            console.error("Invalid message:", message);
            return;
        }
        console.log("plot web received message:", message);
        if (message.command === 'initPlotSettings') {
            const messageData = message.data;
            setValue('showIndex', messageData.showIndex);
            setValue('showLabel', messageData.showLabel);
            setValue('showBackground', messageData.showBackground);
            setValue('showTrail', messageData.showTrail);
            setValue('revealNeighborSameType', messageData.revealNeighborSameType);
            setValue('revealNeighborCrossType', messageData.revealNeighborCrossType);
        }
        else if (message.command === 'updatePlotSettings') { 
            const messageData = message.data;
            if (messageData.showIndex !== undefined) {
                setValue('showIndex', messageData.showIndex);
            }
            if (messageData.showLabel !== undefined) {
                setValue('showLabel', messageData.showLabel);
            }
            if (messageData.showBackground !== undefined) {
                setValue('showBackground', messageData.showBackground);
            }
            if (messageData.showTrail !== undefined) {
                setValue('showTrail', messageData.showTrail);
            }
            if (messageData.revealNeighborSameType !== undefined) {
                setValue('revealNeighborSameType', messageData.revealNeighborSameType);
            }
            if (messageData.revealNeighborCrossType !== undefined) {
                setValue('revealNeighborCrossType', messageData.revealNeighborCrossType);
            }
        }
        else if (message.command === 'initTrainingInfo') {
            const messageData = message.data;
            setValue('availableEpochs', messageData.availableEpochs);

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

            setValue('textData', messageData.tokenList);
            setValue('inherentLabelData', messageData.labelList);

            notifyEpochSwitch(messageData.availableEpochs[0]);
        }
        else if(message.command === 'updateEpochData'){
            const messageData = message.data;
            setValue('projection', messageData.projection);
            setValue('inClassNeighbors', messageData.inClassNeighbors);
            setValue('outClassNeighbors', messageData.outClassNeighbors);
            setValue('prediction', messageData.prediction);
            setValue('confidence', messageData.confidence);
            setValue('predProbability', messageData.predProbability);
            setValue('background', messageData.background);
        }
        else if(message.command === 'updateBackground'){
            const messageData = message.data;
            setValue('background', messageData.background);
        }
        else if(message.command === 'updateSelectedIndices'){
            const messageData = message.data;
            setValue('selectedIndices', messageData.selectedIndices);
        }
        else if(message.command === 'updateHoveredIndex'){
            const messageData = message.data;
            setValue('hoveredIndex', messageData.hoveredIndex);
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

