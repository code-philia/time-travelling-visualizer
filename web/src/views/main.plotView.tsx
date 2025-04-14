import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MainBlock } from "../component/main-block.tsx";
import { useDefaultStore } from "../state/state-store.ts";
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
            <MessageHandler></MessageHandler>
            <MainBlock></MainBlock>
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
        if (message.command === 'sync') {
            if (message.type === 'trainingInfo') {
                const messageData = message.data;
                setValue('taskType', messageData.taskType);
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
            else if(message.type === 'epochData'){
                const messageData = message.data;
                setValue('projection', messageData.projection);
                setValue('epoch', messageData.epoch);
            }
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

