import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useSetUpTrainingProcess } from "../state/state-actions.ts";
import { MainBlock } from "../component/main-block.tsx";
import { useDefaultStore } from "../state/state-store.ts";
import "../index.css";

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
    const { setValue } = useDefaultStore(["setValue"]);
    const setUpTrainingProcess = useSetUpTrainingProcess();

    const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        if (!message) {
            console.error("Invalid message:", message);
            return;
        }
        console.log("plot web received message:", message);
        if (message.command === "update") {
            setValue("contentPath", message.contentPath);
            setValue("visMethod", message.visMethod);
            (async () => {
                await setUpTrainingProcess();
            })();
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
