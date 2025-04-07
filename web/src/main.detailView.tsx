import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppDetailPanelViewOnly } from './App';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppDetailPanelViewOnly />
    </StrictMode>
);
