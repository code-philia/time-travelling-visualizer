import React, { useEffect, useState } from 'react';
import { message } from 'antd';
import { MainBlock } from '../component/main-block';
import { FunctionPanel } from '../component/function-panel';
import { SamplePanel } from '../component/sample-panel';
import { TrainingEventPanel } from '../component/training-event-panel';
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
    const {
        setAvailableEpochs,
        setDataType,
        setTaskType,
        setTextData,
        setTokenList,
        setInherentLabelData,
        setColorDict,
        setLabelDict,
        setProgress,
        setValue,
        addLoadedEpoch,
        resetLoadedEpochs,
    } = useDefaultStore([
        'setAvailableEpochs',
        'setDataType',
        'setTaskType',
        'setTextData',
        'setTokenList',
        'setInherentLabelData',
        'setColorDict',
        'setLabelDict',
        'setProgress',
        'setValue',
        'addLoadedEpoch',
        'resetLoadedEpochs',
    ]);

    const handleUpdateSettings = (settings: any) => {
        console.log('Updating settings:', settings);
        setValue('showIndex', settings.showIndex);
        setValue('showLabel', settings.showLabel);
        setValue('showTrail', settings.showTrail);
        setValue('revealOriginalNeighbors', settings.revealOriginalNeighbors);
        setValue('revealProjectionNeighbors', settings.revealProjectionNeighbors);
        setValue('showBackground', settings.showBackground);
    };

    const handleLoadVisualization = async (config: any) => {
        try {
            const { contentPath, visualizationID, dataType, taskType } = config;

            console.log('Loading visualization with config:', config);

            // reset progress and loaded-epoch state at the beginning of a new load
            setProgress(0);
            resetLoadedEpochs();

            // Set basic configuration
            setDataType(dataType);
            setTaskType(taskType);

            // Get training process info
            const processInfo = await BackendAPI.fetchTrainingProcessInfo(contentPath);
            const epochs: number[] = processInfo.available_epochs || [];
            setAvailableEpochs(epochs);

            const colorMap = new Map<number, [number, number, number]>();
            const labelMap = new Map<number, string>();
            for (let i = 0; i < processInfo.color_list.length; i++) {
                colorMap.set(i, [
                    processInfo.color_list[i][0],
                    processInfo.color_list[i][1],
                    processInfo.color_list[i][2],
                ]);
                labelMap.set(i, processInfo.label_text_list[i]);
            }

            setColorDict(colorMap);
            setLabelDict(labelMap);

            // Load labels for the first epoch
            if (epochs.length === 0) {
                message.warning('No epochs available in this training process.');
                return;
            }

            const labelsResponse = await BackendAPI.getAttributeResource(
                contentPath,
                epochs[0],
                'label'
            );
            setInherentLabelData(labelsResponse.label || []);

            // Load text data if text type
            if (dataType === 'Text') {
                const textResponse = await BackendAPI.getText(contentPath);
                setTextData(textResponse.text_data || []);
                setTokenList(textResponse.token_list || []);
            }

            // Load epoch data for all available epochs
            let allEpochDataTemp: Record<number, any> = {};
            const totalEpochs = epochs.length;

            for (let i = 0; i < totalEpochs; i++) {
                const epochNum = epochs[i];

                allEpochDataTemp = { ...allEpochDataTemp, [epochNum]: {} };

                // Load main plot data
                const projection = await BackendAPI.fetchEpochProjection(
                    contentPath,
                    visualizationID,
                    epochNum
                );
                allEpochDataTemp[epochNum]['projection'] = projection.projection || [];
                allEpochDataTemp[epochNum]['scope'] = projection.scope || [];

                // Load neighbors data
                const originalNeighbors = await BackendAPI.getOriginalNeighbors(
                    contentPath,
                    epochNum
                );
                const projectionNeighbors = await BackendAPI.getProjectionNeighbors(
                    contentPath,
                    visualizationID,
                    epochNum
                );
                allEpochDataTemp[epochNum]['originalNeighbors'] =
                    originalNeighbors.neighbors || [];
                allEpochDataTemp[epochNum]['projectionNeighbors'] =
                    projectionNeighbors.neighbors || [];

                if (taskType === 'Classification') {
                    const predictionResponse = await BackendAPI.getAttributeResource(
                        contentPath,
                        epochNum,
                        'prediction'
                    );
                    allEpochDataTemp[epochNum]['predProbability'] =
                        predictionResponse.prediction || [];

                    const predictions: number[] = [];
                    for (const prob of allEpochDataTemp[epochNum]['predProbability']) {
                        const predClass = prob.indexOf(Math.max(...prob));
                        predictions.push(predClass);
                    }
                    allEpochDataTemp[epochNum]['prediction'] = predictions;

                    const background = await BackendAPI.getBackground(
                        contentPath,
                        visualizationID,
                        epochNum
                    );
                    allEpochDataTemp[epochNum]['background'] = background || '';
                }

                // Store accumulated epoch data
                setValue('allEpochData', { ...allEpochDataTemp });

                // Mark this epoch as fully loaded
                addLoadedEpoch(epochNum);

                // Update progress as a percentage of finished epochs
                const percent = ((i + 1) / totalEpochs) * 100;
                setProgress(percent);
            }

            message.success('Visualization loaded successfully!');
        } catch (error) {
            console.error('Error loading visualization:', error);
            message.error('Failed to load visualization');
        }
    };

    const handleStartVisualizing = async (config: any) => {
        try {
            console.log('Starting visualizing with config from extension:', config);
            const { contentPath, visMethod, visID, dataType, taskType, visConfig } = config;

            await BackendAPI.triggerStartVisualizing(
                contentPath,
                visMethod,
                visID,
                dataType,
                taskType,
                visConfig
            );

            message.success('Start visualizing request sent to backend');
        } catch (error) {
            console.error('Error starting visualization:', error);
            message.error('Failed to start visualizing');
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
            case 'startVisualizing':
                await handleStartVisualizing(data.config);
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
