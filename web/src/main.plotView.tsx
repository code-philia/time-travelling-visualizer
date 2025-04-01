import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppPlotViewOnly } from './App.tsx'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppPlotViewOnly />
    </StrictMode>
);
