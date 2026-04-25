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

const LOG_PREFIX = '[TTVisualizer]';
const BATCH_SIZE = Number(import.meta.env.VITE_BATCH_SIZE) || 5;


function logWithTimestamp(message: string): void {
    console.log(`${LOG_PREFIX}[${new Date().toISOString()}] ${message}`);
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <AppCombinedView />
    </StrictMode>
);

// MessageHandler component for handling extension communication and backend requests
function MessageHandler() {
    // State from unified store
    const { 
        setContentPath, setAvailableEpochs, setDataType, setTaskType,
        setTextData, setTokenList, setInherentLabelData,
        setColorDict, setLabelDict, setProgress, setValue
    } = useDefaultStore([
        'setContentPath', 'setAvailableEpochs', 'setDataType', 'setTaskType',
        'setTextData', 'setTokenList', 'setInherentLabelData',
        'setColorDict', 'setLabelDict', 'setProgress', 'setValue'
    ]);

    // Start visualizing process
    const handleStartVisualizing = async (
        contentPath: string,
        visualizationMethod: string,
        visualizationID: string,
        dataType: string,
        taskType: string,
        visConfig: any
    ) => {
        try {
            let startTime = Date.now();
            await BackendAPI.triggerStartVisualizing(contentPath, visualizationMethod, visualizationID, dataType, taskType, visConfig);
            setValue('visConfig', visConfig);
            logWithTimestamp(`Visualization process started in backend. timeCost=${Date.now() - startTime}ms`);
        } catch (error) {
            console.error('Error starting visualization process:', error);
            message.error('Failed to start visualization process');
        }
    }

    // Load visualization data from backend with configuration
    const handleLoadVisualization = async (config: any, visualizationID: string) => {
        try {
            const { contentPath, visualizationMethod, dataType, taskType } = config;
            
            logWithTimestamp(`Web plot view start loading visualization. config=${JSON.stringify({ contentPath, visualizationMethod, visualizationID, dataType, taskType })}`);
            
            // Set basic configuration
            setContentPath(contentPath);

            // saving visid globally so it can be used for all backend calls that require it without having to pass it around
            setValue('visId', visualizationID);
            console.log("visid ", visualizationID)
            setDataType(dataType);
            setTaskType(taskType);
            
            // Get training process info
            const processInfo = await BackendAPI.fetchTrainingProcessInfo(contentPath);
            const epochs = processInfo.available_epochs || [];
            setAvailableEpochs(epochs);
            if (!epochs.length) {
                logWithTimestamp('No epochs available from backend.');
            }

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

            // load epoch data for all available epochs in parallel batches
            let allEpochDataTemp: Record<number, any> = {};
            const totalEpochCount = epochs.length;
            const loadStartTimestamp = new Date();
            logWithTimestamp(`Starting parallel epoch loading. totalEpochs=${totalEpochCount}`);

            let globalMinX = Infinity, globalMaxX = -Infinity;
            let globalMinY = Infinity, globalMaxY = -Infinity;

            //  load all data for only one epoch
            const loadSingleEpoch = async (epochNum: number) => {
                const epochData: Record<string, any> = {};

                // send all requests for the epoch in parallel
                const requests: Promise<any>[] = [
                    BackendAPI.fetchEpochProjection(contentPath, visualizationID, epochNum),
                ];
                if (taskType === 'Classification') {
                    requests.push(
                        BackendAPI.getAttributeResource(contentPath, epochNum, 'prediction'),
                        BackendAPI.getBackground(contentPath, visualizationID, epochNum),
                    );
                }


                // wait for all requests to complete and then process results
                const results = await Promise.all(requests);
                console.log("requests worked")

                epochData['projection'] = results[0].projection || [];

                if (taskType === 'Classification') {
                    epochData['predProbability'] = results[1].prediction || [];
                    epochData['prediction'] = epochData['predProbability'].map(
                        (prob: number[]) => prob.indexOf(Math.max(...prob))
                    );
                    epochData['background'] = results[2] || '';
                }

                return { epochNum, epochData };
            };

            // process epochs in parallel batches (defined in .env for now)
            let completedCount = 0;
            for (let i = 0; i < epochs.length; i += BATCH_SIZE) {
                const batch = epochs.slice(i, i + BATCH_SIZE);
                const batchResults = await Promise.all(batch.map(loadSingleEpoch));

                for (const { epochNum, epochData } of batchResults) {
                    allEpochDataTemp[epochNum] = epochData;

                    // update global bounds
                    for (const p of epochData['projection']) {
                        if (p[0] < globalMinX) globalMinX = p[0];
                        if (p[0] > globalMaxX) globalMaxX = p[0];
                        if (p[1] < globalMinY) globalMinY = p[1];
                        if (p[1] > globalMaxY) globalMaxY = p[1];
                    }
                    completedCount++;
                }


                // update store after each batch
                setValue('globalBounds', {
                    minX: globalMinX, maxX: globalMaxX,
                    minY: globalMinY, maxY: globalMaxY
                });
                setValue('allEpochData', { ...allEpochDataTemp });
                setProgress((completedCount / epochs.length) * 100);
                logWithTimestamp(`Batch complete. loaded=${completedCount}/${totalEpochCount}`);
            }

            const loadEndTimestamp = new Date();
            logWithTimestamp(`All epochs loaded in ${loadEndTimestamp.getTime() - loadStartTimestamp.getTime()}ms for ${totalEpochCount} epoch(s).`);
            
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
            case 'startVisualizing':
                await handleStartVisualizing(data.contentPath, data.visualizationMethod, data.visualizationID, data.dataType, data.taskType, data.visConfig);
                break;
            case 'loadVisualization':
                await handleLoadVisualization(data.config, data.visualizationID);
                break;
            default:
                console.log('Unknown message command:', command);
        }
    };

    useEffect(() => {
        window.addEventListener('message', handleMessage);

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return <></>;
}

export function AppCombinedView() {
    return (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#fff" }}>
            <PanelGroup direction="vertical" style={{ flex: 1, display: "flex" }} autoSaveId="plot-view-root">
                <Panel defaultSize={76} minSize={40}>
                    <PanelGroup direction="horizontal" style={{ height: "100%", display: "flex" }} autoSaveId="plot-view-layout">
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
                </Panel>
                <PanelResizeHandle className="subtle-resize-handle-horizontal" />
                <Panel defaultSize={24} minSize={8} maxSize={50} collapsible collapsedSize={0}>
                    <div style={{ width: '100%', height: '100%', borderTop: '1px solid #ccc' }}>
                        <BottomDock />
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
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
            <Tabs
                className="function-tabs"
                activeKey={activeKey}
                onChange={(key) => setActiveKey(key as typeof activeKey)}
                size="small"
                tabBarStyle={{ marginBottom: 0 }}
                tabBarGutter={0}
                items={items}
            />
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                {activeKey === 'FunctionPanel' && <FunctionPanel />}
                {activeKey === 'TrainingEventPanel' && <TrainingEventPanel />}
            </div>
        </div>
    );
}

function BottomDock() {
    const [activeKey, setActiveKey] = useState<'Influence' | 'Tokens'>('Influence');
    const items = [
        { key: 'Influence', label: <span style={{ fontSize: 12 }}>Influence</span>, children: <InfluenceAnalysisPanel /> },
        { key: 'Tokens', label: <span style={{ fontSize: 12 }}>Tokens</span>, children: <TokenPanel /> },
    ];

    return (
        <Tabs
            className="bottom-dock-tabs"
            tabPosition="right"
            size="small"
            tabBarGutter={0}
            tabBarStyle={{ marginLeft: 0 }}
            style={{ height: '100%', backgroundColor: '#fff' }}
            items={items}
            activeKey={activeKey}
            onChange={(key) => setActiveKey(key as typeof activeKey)}
        />
    );
}

window.vscode?.postMessage({ state: 'load' }, '*');