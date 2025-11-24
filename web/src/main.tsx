import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import WebSideBar from './component/webSideBar';
import { AppCombinedView } from './views/plotView';
import './index.css';

function RootLayout() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PanelGroup direction="horizontal" style={{ flex: 1, display: 'flex' }} autoSaveId="root-horizontal">
        <Panel defaultSize={22} minSize={16} maxSize={35} collapsible collapsedSize={0}>
          <div style={{ width: '100%', height: '100%', borderRight: '1px solid #ccc' }}>
            <WebSideBar />
          </div>
        </Panel>
        <PanelResizeHandle className="subtle-resize-handle" hitAreaMargins={{ coarse: 12, fine: 6 }} />
        <Panel defaultSize={78} minSize={40}>
          <AppCombinedView />
        </Panel>
      </PanelGroup>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootLayout />
  </StrictMode>
);
