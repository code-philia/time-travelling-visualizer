import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import DetailPanel from '../component/detail-panel';
import { MessageHandler } from '../communication/message';
import '../index.css';

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
