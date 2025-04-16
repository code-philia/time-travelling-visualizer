import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import DetailPanel from '../component/detail-panel';
import '../index.css';
import { useDefaultStore } from '../state/state.detailView';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppDetailPanelViewOnly />
    </StrictMode>
);

function AppDetailPanelViewOnly() {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <MessageHandler></MessageHandler>
            <DetailPanel></DetailPanel>
        </div>
    );
}

function MessageHandler() {
    const { setValue } = useDefaultStore(["setValue"]);

    const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        if (!message) {
            console.error("Invalid message:", message);
            return;
        }
        console.log("detail web received message:", message);
        if (message.command === "sync") {
            setValue("hoveredIndex", message.hoveredIndex);
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