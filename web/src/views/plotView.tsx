import React, { useEffect, useState } from 'react';
import { message, Tabs } from 'antd';
import { MainBlock } from '../component/main-block';
import { FunctionPanel } from '../component/function-panel';
import { TrainingEventPanel } from '../component/training-event-panel';
import InfluenceAnalysisPanel from '../component/influence-panel';
import { TokenPanel } from '../component/token-panel';
import { useDefaultStore } from '../state/state.unified';
import * as BackendAPI from '../communication/backend';
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";

import "../index.css";
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';


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

            for (const epochNum of epochs) {
                setProgress((epochNum / epochs.length) * 100);

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
            }
            
            setProgress(100);
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

export function AppCombinedView() {
    return (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
            <PanelGroup direction="horizontal" style={{ flex: 1, display: "flex" }} autoSaveId="plot-view-layout">
                <Panel defaultSize={70} minSize={20}>
                    <div style={{ display: "flex", width: "100%", height: "100%" }}>
                        <MainBlock />
                    </div>
                </Panel>
                <PanelResizeHandle className="subtle-resize-handle" hitAreaMargins={{ coarse: 12, fine: 6 }} />
                <Panel defaultSize={30} minSize={8} maxSize={60} collapsible collapsedSize={0}>
                    <div style={{ width: '100%', height: '100%', borderLeft: '1px solid #ccc' }}>
                        <FunctionViewPanels />
                    </div>
                </Panel>
            </PanelGroup>
            <MessageHandler />
        </div>
    );
}

function FunctionViewPanels() {
    const [activeKey, setActiveKey] = useState<'FunctionPanel' | 'TrainingEventPanel'>('FunctionPanel');

    const items = [
        { key: 'FunctionPanel', label: <span style={{ fontSize: 12 }}>Functions</span> },
        { key: 'TrainingEventPanel', label: <span style={{ fontSize: 12 }}>Training Events</span> },
    ];

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Tabs
                className="function-tabs"
                activeKey={activeKey}
                onChange={(key) => setActiveKey(key as typeof activeKey)}
                size="small"
                tabBarStyle={{ marginBottom: 0 }}
                tabBarGutter={0}
                items={items}
            />
            <div style={{ flex: 1, display: 'flex' }}>
                {activeKey === 'FunctionPanel' && <FunctionPanel />}
                {activeKey === 'TrainingEventPanel' && <TrainingEventPanel />}
            </div>
        </div>
    );
}



window.vscode?.postMessage({ state: 'load' }, '*');