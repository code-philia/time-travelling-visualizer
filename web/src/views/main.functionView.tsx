import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { FunctionPanel } from '../component/function-panel';
import { SamplePanel } from '../component/sample-panel';
import { VisAnalysisPanel } from '../component/vis-analysis-panel';

import { EpochData, Metrics, useDefaultStore } from '../state/state.rightView';


createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppFunctionViewOnly />
    </StrictMode>
);

function AppFunctionViewOnly() {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <FunctionViewPanels />
            <MessageHandler />
        </div>
    );
}

function FunctionViewPanels() {
    const [activePanel, setActivePanel] = useState<'FunctionPanel' | 'SamplePanel' | 'VisAnalysisPanel'>('FunctionPanel');

    const buttonStyle = (isActive: boolean): React.CSSProperties => ({
        width: '20px',
        height: '20px',
        margin: '0 5px',
        borderRadius: '20%',
        backgroundColor: isActive ? '#007bff' : '#ffffff',
        color: isActive ? '#ffffff' : '#007bff',
        border: `2px solid ${isActive ? '#007bff' : '#cccccc'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.3s ease',
    });

    const tooltipStyle: React.CSSProperties = {
        position: 'absolute',
        bottom: '-25px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '5px 10px',
        borderRadius: '4px',
        backgroundColor: '#333',
        color: '#fff',
        fontSize: '10px',
        whiteSpace: 'nowrap',
        opacity: 0,
        visibility: 'hidden',
        transition: 'opacity 0.3s ease, visibility 0.3s ease',
    };

    const buttonContainerStyle: React.CSSProperties = {
        position: 'absolute',
        top: '10px',
        right: '10px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
    };

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={buttonContainerStyle}>
                {[
                    { panel: 'FunctionPanel', icon: '🛠️', tooltip: 'Function Panel' },
                    { panel: 'SamplePanel', icon: '📊', tooltip: 'Sample Panel' },
                    { panel: 'VisAnalysisPanel', icon: '📈', tooltip: 'Vis Analysis Panel' },
                ].map(({ panel, icon, tooltip }) => (
                    <div
                        key={panel}
                        style={buttonStyle(activePanel === panel)}
                        onClick={() => setActivePanel(panel as typeof activePanel)}
                        onMouseEnter={(e) => {
                            const tooltipDiv = e.currentTarget.querySelector('.tooltip') as HTMLDivElement;
                            tooltipDiv.style.opacity = '1';
                            tooltipDiv.style.visibility = 'visible';
                        }}
                        onMouseLeave={(e) => {
                            const tooltipDiv = e.currentTarget.querySelector('.tooltip') as HTMLDivElement;
                            tooltipDiv.style.opacity = '0';
                            tooltipDiv.style.visibility = 'hidden';
                        }}
                    >
                        {icon}
                        <div className="tooltip" style={tooltipStyle}>
                            {tooltip}
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ flex: 1, display: 'flex' }}>
                {activePanel === 'FunctionPanel' && <FunctionPanel />}
                {activePanel === 'SamplePanel' && <SamplePanel />}
                {activePanel === 'VisAnalysisPanel' && <VisAnalysisPanel />}
            </div>
        </div>
    );
}

function MessageHandler() {
    const { setValue } = useDefaultStore(['setValue']);
    const allEpochDataCopy: Record<number, EpochData> = {};
    const allEpochMetricsCopy: Record<number, Metrics> = {};

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (!message) {
                console.error('Invalid message:', message);
                return;
            }
            console.log('Function web view received message: ', message);
            if (message.command === 'init') {
                const messageData = message.data;
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

                setValue('labels', messageData.labels);
                setValue('tokenList', messageData.tokenList);
                setValue('availableEpochs', messageData.availableEpochs);
            }
            else if(message.command === 'updateSelectedIndices') {
                const messageData = message.data;
                if (messageData.selectedIndices !== undefined) {
                    setValue('selectedIndices', messageData.selectedIndices);
                }
                else {
                    setValue('selectedIndices', []);
                }
            }
            else if (message.command === "updateHoveredIndex") {
                const messageData = message.data;
                setValue('hoveredIndex', messageData.hoveredIndex);
                setValue('imageData', messageData.image);
            }
            else if(message.command === 'updateEpochData'){
                const messageData = message.data;
                const newEpochData: EpochData = {
                    prediction: messageData.prediction,
                    confidence: messageData.confidence,
                    probability: messageData.probability,
                    originalNeighbors: messageData.originalNeighbors,
                    projectionNeighbors: messageData.projectionNeighbors,
                    projection: messageData.projection,
                    embedding: messageData.embedding,
                };
                allEpochDataCopy[messageData.epoch] = newEpochData;
                setValue('allEpochData', allEpochDataCopy);
            }
            else if (message.command === 'updateMetrics') {
                const messageData = message.data;
                const newMetrics: Metrics = {
                    neighborTrustworthiness: messageData.neighborTrustworthiness,
                    neighborContinuity: messageData.neighborContinuity,
                    reconstructionPrecision: 0,
                    abnormalMovementsRatio2D: 0,
                    movementConsistency: 0
                };
                allEpochMetricsCopy[messageData.epoch] = newMetrics;
                setValue('allEpochMetrics', allEpochMetricsCopy);
            }
            else if (message.command === 'updateEpoch') {
                const messageData = message.data;
                setValue('epoch', messageData.epoch);
            }
            else if (message.command === 'updateShownData') {
                const messageData = message.data;
                setValue('shownData', messageData.shownData);
            }
        };
        
        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    return <></>;
}

window.vscode?.postMessage({ state: 'load' }, '*');