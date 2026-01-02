import React, { useEffect, useState } from 'react';
import { Button, message } from 'antd';
import { MainBlock } from '../component/main-block';
import { FunctionPanel } from '../component/function-panel';
import { SamplePanel } from '../component/sample-panel';
import { TrainingEventPanel } from '../component/training-event-panel';
import InfluenceAnalysisPanel from '../component/influence-panel';
import { TokenPanel } from '../component/token-panel';
import { useDefaultStore } from '../state/state.unified';
import * as BackendAPI from '../communication/backend';
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";

import "../index.css";

import FunctionIcon from '../../assets/settings_applications_24dp_5F6368_FILL0_wght300_GRAD0_opsz24.svg';
import SampleIcon from '../../assets/frame_inspect_24dp_5F6368_FILL0_wght300_GRAD0_opsz24.svg';
import VisAnalysisIcon from '../../assets/analytics_24dp_5F6368_FILL0_wght300_GRAD0_opsz24.svg';
import { acquireSettings } from '../communication/extension';

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <AppCombinedView />
    </StrictMode>
);

// MessageHandler component for handling extension communication and backend requests
function MessageHandler() {
    // State from unified store
    const { 
        setAvailableEpochs, setDataType, setTaskType,
        setTextData, setTokenList, setInherentLabelData,
        setColorDict, setLabelDict, setProgress, setValue
    } = useDefaultStore([
        'setAvailableEpochs', 'setDataType', 'setTaskType',
        'setTextData', 'setTokenList', 'setInherentLabelData',
        'setColorDict', 'setLabelDict', 'setProgress', 'setValue'
    ]);

    // Update settings in the store
    const handleUpdateSettings = (settings: any) => {
        console.log('Updating settings:', settings);
        setValue('showIndex', settings.showIndex);
        setValue('showLabel', settings.showLabel);
        setValue('showTrail', settings.showTrail);
        setValue('revealOriginalNeighbors', settings.revealOriginalNeighbors);
        setValue('revealProjectionNeighbors', settings.revealProjectionNeighbors);
        setValue('showBackground', settings.showBackground);
    }

    // Load visualization data from backend with configuration
    const handleLoadVisualization = async (config: any) => {
        try {
            const { contentPath, visualizationMethod, visualizationID, dataType, taskType} = config;
            
            console.log('Loading visualization with config:', config);
            
            // Set basic configuration
            setDataType(dataType);
            setTaskType(taskType);
            
            // Get training process info
            const processInfo = await BackendAPI.fetchTrainingProcessInfo(contentPath);
            const epochs = processInfo.available_epochs || [];
            setAvailableEpochs(epochs);

            const colorMap = new Map();
            const labelMap = new Map();
            for(let i = 0; i < processInfo.color_list.length; i++) {
                colorMap.set(i, [processInfo.color_list[i][0], processInfo.color_list[i][1], processInfo.color_list[i][2]]);
                labelMap.set(i, processInfo.label_text_list[i]);
            }
            
            setColorDict(colorMap);
            setLabelDict(labelMap);

            const labelsResponse = await BackendAPI.getAttributeResource(contentPath, epochs[0], 'label');
            setInherentLabelData(labelsResponse.label || []);
            
            // Load text data if text type
            if (dataType === 'Text') {
                const textResponse = await BackendAPI.getText(contentPath);
                setTextData(textResponse.text_data || []);
                setTokenList(textResponse.token_list || []);
            }

            // Load epoch data for all available epochs
            let allEpochDataTemp: Record<number, any> = {};

            for (let i = 0; i < epochs.length; i++) {
                const epochNum = epochs[i];
                console.log(`Loading epoch ${epochNum} (${i + 1}/${epochs.length})...`);
                
                allEpochDataTemp = { ...allEpochDataTemp, [epochNum]: {} };

                // Load main plot data
                const projection = await BackendAPI.fetchEpochProjection(contentPath, visualizationID, epochNum);
                allEpochDataTemp[epochNum]['projection'] = projection.projection || [];
                allEpochDataTemp[epochNum]['scope'] = projection.scope || [];

                // Load neighbors data
                const originalNeighbors = await BackendAPI.getOriginalNeighbors(contentPath, epochNum);
                const projectionNeighbors = await BackendAPI.getProjectionNeighbors(contentPath, visualizationID, epochNum);
                allEpochDataTemp[epochNum]['originalNeighbors'] = originalNeighbors.neighbors || [];
                allEpochDataTemp[epochNum]['projectionNeighbors'] = projectionNeighbors.neighbors || [];

                if (taskType === 'Classification') {
                    const predictionResponse = await BackendAPI.getAttributeResource(contentPath, epochNum, 'prediction');
                    allEpochDataTemp[epochNum]['predProbability'] = predictionResponse.prediction || [];

                    let predictions: number[] = [];
                    for (const prob of allEpochDataTemp[epochNum]['predProbability']) {
                        const predClass = prob.indexOf(Math.max(...prob));
                        predictions.push(predClass);
                    }
                    allEpochDataTemp[epochNum]['prediction'] = predictions;

                    const background = await BackendAPI.getBackground(contentPath, visualizationID, epochNum);
                    allEpochDataTemp[epochNum]['background'] = background || '';
                }

                setValue('allEpochData', { ...allEpochDataTemp });
                
                // Update progress to reflect the number of epochs loaded (1-based index)
                setProgress(i + 1);
                console.log(`Progress updated: ${i + 1}/${epochs.length} epochs loaded`);
            }
            
            setProgress(epochs.length);
            console.log(`All epochs loaded. Total: ${epochs.length}`);
            message.success('Visualization loaded successfully!');
            
        } catch (error) {
            console.error('Error loading visualization:', error);
            message.error('Failed to load visualization');
        }
    };

    const handleMessage = async (event: MessageEvent) => {
        const { command, data } = event.data;
        console.log('Received message from extension:', event);

        switch (command) {
            case 'updatePlotSettings':
                handleUpdateSettings(data.settings);
                break;
            case 'loadVisualization':
                await handleLoadVisualization(data.config);
                break;
            default:
                console.log('Unknown message command:', command);
        }
    };

    useEffect(() => {
        window.addEventListener('message', handleMessage);
        acquireSettings();

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return <></>;
}

function AppCombinedView() {
    return (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>            
            <div style={{ flex: 1, display: "flex" }}>
                {/* Main plot area (center) */}
                <div style={{ flex: 1, display: "flex" }}>
                    <MainBlock />
                </div>
                
                {/* Function view panels (right side) */}
                <div style={{ width: "300px", borderLeft: "1px solid #ccc" }}>
                    <FunctionViewPanels />
                </div>
            </div>
            
            {/* <div style={{ height: "200px", borderTop: "1px solid #ccc", display: "flex", justifyContent: "center" }}>
                <div style={{ width: "100%", height: "100%" }}>
                    <InfluenceAnalysisPanel />
                </div>
            </div>
            
            <div style={{ borderTop: "1px solid #ccc" }}>
                <TokenPanel />
            </div> */}
            <MessageHandler />
        </div>
    );
}

function FunctionViewPanels() {
    const [activePanel, setActivePanel] = useState<'FunctionPanel' | 'SamplePanel' | 'TrainingEventPanel'>('FunctionPanel');

    const buttonStyle = (isActive: boolean): React.CSSProperties => ({
        width: '20px',
        height: '20px',
        margin: '0 2px',
        borderRadius: '25%',
        backgroundColor: isActive ? '#9fd4fc' : '#ffffff',
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
        transform: 'translateX(-75%)',
        padding: '5px 5px',
        borderRadius: '4px',
        backgroundColor: '#333',
        color: '#fff',
        fontSize: '10px',
        whiteSpace: 'nowrap',
        opacity: 0,
        visibility: 'hidden',
        transition: 'opacity 0.3s ease, visibility 0.3s ease',
        zIndex: 9999,
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
                    { panel: 'FunctionPanel', icon: FunctionIcon, tooltip: 'Function Panel' },
                    { panel: 'SamplePanel', icon: SampleIcon, tooltip: 'Sample Panel' },
                    { panel: 'TrainingEventPanel', icon: VisAnalysisIcon, tooltip: 'Training Event Panel' },
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
                        <img src={icon} alt={`${panel} icon`} style={{ width: '20px', height: '20px' }} />
                        <div className="tooltip" style={tooltipStyle}>
                            {tooltip}
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ flex: 1, display: 'flex' }}>
                {activePanel === 'FunctionPanel' && <FunctionPanel />}
                {activePanel === 'SamplePanel' && <SamplePanel />}
                {activePanel === 'TrainingEventPanel' && <TrainingEventPanel />}
            </div>
        </div>
    );
}



window.vscode?.postMessage({ state: 'load' }, '*');