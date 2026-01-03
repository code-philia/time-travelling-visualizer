import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppCombinedView } from './views/plotView'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppCombinedView />
    </StrictMode>
);
