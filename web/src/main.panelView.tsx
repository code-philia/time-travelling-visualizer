import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppPanelViewOnly } from './App.tsx'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppPanelViewOnly />
    </StrictMode>
);
