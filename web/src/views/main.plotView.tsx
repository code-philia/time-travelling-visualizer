import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MainBlock } from "../component/main-block.tsx";
import { EpochData, useDefaultStore } from "../state/state.plotView.ts";
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
    const allEpochDataCopy: Record<number, EpochData> = {};

    const handleMessage =(event: MessageEvent) => {
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
            setValue('revealOriginalNeighbors', messageData.revealOriginalNeighbors);
            setValue('revealProjectionNeighbors', messageData.revealProjectionNeighbors);
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
            if (messageData.revealOriginalNeighbors !== undefined) {
                setValue('revealOriginalNeighbors', messageData.revealOriginalNeighbors);
            }
            if (messageData.revealProjectionNeighbors !== undefined) {
                setValue('revealProjectionNeighbors', messageData.revealProjectionNeighbors);
            }
        }
        else if (message.command === 'initTrainingInfo') {
            const messageData = message.data;
            setValue('availableEpochs', messageData.availableEpochs);
            setValue('scope', messageData.scope);

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
            setValue('index', messageData.index);
            setValue('epoch', messageData.availableEpochs[0]);

            notifyEpochSwitch(messageData.availableEpochs[0]);
        }
        else if(message.command === 'updateEpochData'){
            const messageData = message.data;
            const newEpochData: EpochData = {
                projection: messageData.projection,
                prediction: messageData.prediction,
                confidence: messageData.confidence,
                predProbability: messageData.predProbability,
                originalNeighbors: messageData.originalNeighbors,
                projectionNeighbors: messageData.projectionNeighbors,
                background: messageData.background,
            };
            allEpochDataCopy[messageData.epoch] = newEpochData;
            setValue('allEpochData', allEpochDataCopy);

            const progress = Object.keys(allEpochDataCopy).length;
            setValue('progress', progress);
        }
        else if(message.command === 'updateSelectedIndices'){
            const messageData = message.data;
            setValue('selectedIndices', messageData.selectedIndices);
        }
        else if(message.command === 'updateHoveredIndex'){
            const messageData = message.data;
            setValue('hoveredIndex', messageData.hoveredIndex);
        }
        else if(message.command === 'updateshownData'){
            const messageData = message.data;
            setValue('shownData', messageData.shownData);
        }
        else if (message.command === 'updateHighlightData') {
            const messageData = message.data;
            setValue('highlightData', messageData.highlightData);
        }
        else if (message.command === 'updateFocusEvents') {
            const messageData = message.data;
            setValue('isFocusMode', messageData.isFocusMode);
            setValue('focusIndices', messageData.focusIndices);
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

