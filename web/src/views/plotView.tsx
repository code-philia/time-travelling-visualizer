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
function logWithTimestamp(message: string): void {
    console.log(`${LOG_PREFIX}[${new Date().toISOString()}] ${message}`);
}

// Helper to allow the UI to paint between heavy tasks
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function MessageHandler() {
    const {
        setContentPath, setAvailableEpochs, setDataType, setTaskType,
        setTextData, setTokenList, setInherentLabelData,
        setColorDict, setLabelDict, setProgress, setValue, setLoadedEpochs, isLoading, setIsLoading
    } = useDefaultStore([
        'setContentPath', 'setAvailableEpochs', 'setDataType', 'setTaskType',
        'setTextData', 'setTokenList', 'setInherentLabelData',
        'setColorDict', 'setLabelDict', 'setProgress', 'setValue', 'setLoadedEpochs', 'isLoading', 'setIsLoading'
    ]);

    const handleStartVisualizing = async (
        contentPath: string, visualizationMethod: string, visualizationID: string,
        dataType: string, taskType: string, visConfig: any
    ) => {
        try {
            logWithTimestamp(`Start visualizing params=${JSON.stringify({ contentPath, visualizationMethod, visualizationID, dataType, taskType })}`);
            setProgress(0);
            await BackendAPI.triggerStartVisualizing(contentPath, visualizationMethod, visualizationID, dataType, taskType, visConfig);
        } catch (error) {
            console.error('Error starting visualization process:', error);
            message.error('Failed to start visualization process');
        }
    }

    const handleLoadVisualization = async (config: any, visualizationID: string) => {
        try {
            const { contentPath, dataType, taskType } = config;

            // Prevent concurrent loads
            if (isLoading) {
                message.warning('A load is already in progress');
                return;
            }
            // Set loading flag and reset loaded epochs before starting
            setProgress(0);
            setLoadedEpochs(new Set()); // Clear visible nodes immediately
            setIsLoading(true);

            setContentPath(contentPath);
            setDataType(dataType);
            setTaskType(taskType);
            
            // Allow React to render the "Cleared" state (all gray)
            await delay(0);

            // Fetch available epochs
            const processInfo = await BackendAPI.fetchTrainingProcessInfo(contentPath);
            const epochs = processInfo.available_epochs || [];
            setAvailableEpochs(epochs);
            if (!epochs.length) return message.warning('No epochs available');

            // Color and label maps
            const colorMap = new Map<number, [number, number, number]>();
            const labelMap = new Map<number, string>();
            processInfo.color_list.forEach((c: number[], i: number) => colorMap.set(i, [c[0], c[1], c[2]]));
            processInfo.label_text_list.forEach((l: string, i: number) => labelMap.set(i, l));
            setColorDict(colorMap);
            setLabelDict(labelMap);

            // Inherent labels for first epoch
            const labelsResponse = await BackendAPI.getAttributeResource(contentPath, epochs[0], 'label');
            setInherentLabelData(labelsResponse.label || []);

            // Text data if required
            if (dataType === 'Text') {
                const textResponse = await BackendAPI.getText(contentPath);
                setTextData(textResponse.text_data || []);
                setTokenList(textResponse.token_list || []);
            }

            // Temp storage for all epochs
            const allEpochDataTemp: Record<number, any> = {};
            const loadedEpochsTemp = new Set<number>();

            // Sequentially load each epoch and mark it loaded only after full data fetched
            for (let i = 0; i < epochs.length; i++) {
                const epochNum = epochs[i];

                // Fetch all epoch data in parallel
                const [projection, originalNeighbors, projectionNeighbors] = await Promise.all([
                    BackendAPI.fetchEpochProjection(contentPath, visualizationID, epochNum),
                    BackendAPI.getOriginalNeighbors(contentPath, epochNum),
                    BackendAPI.getProjectionNeighbors(contentPath, visualizationID, epochNum)
                ]);

                const epochData: any = {
                    projection: projection.projection || [],
                    originalNeighbors: originalNeighbors.neighbors || [],
                    projectionNeighbors: projectionNeighbors.neighbors || []
                };

                if (taskType === 'Classification') {
                    const [predResponse, background] = await Promise.all([
                        BackendAPI.getAttributeResource(contentPath, epochNum, 'prediction'),
                        BackendAPI.getBackground(contentPath, visualizationID, epochNum)
                    ]);
                    epochData.predProbability = predResponse.prediction || [];
                    epochData.prediction = epochData.predProbability.map((prob: number[]) => prob.indexOf(Math.max(...prob)));
                    epochData.background = background || '';
                }

                // Save epoch data
                allEpochDataTemp[epochNum] = epochData;

                // Update global store with data
                setValue('allEpochData', { ...allEpochDataTemp });

                // Mark epoch as loaded VISUALLY
                loadedEpochsTemp.add(epochNum);
                setLoadedEpochs(new Set(loadedEpochsTemp));

                // Update progress bar
                setProgress(((i + 1) / epochs.length) * 100);

                // IMPORTANT: Small delay to break React update batching
                // This ensures the UI actually paints the blue node before starting the next fetch
                await delay(10); 
            }

            message.success('Visualization loaded successfully!');
        } catch (error) {
            console.error('Error loading visualization:', error);
            message.error('Failed to load visualization');
        }
        finally {
            // Clear loading flag
            setIsLoading(false);
        }
    };

    const handleMessage = async (event: MessageEvent) => {
        const { command, data } = event.data;
        switch (command) {
            case 'startVisualizing':
                await handleStartVisualizing(
                    data.contentPath,
                    data.visualizationMethod,
                    data.visualizationID,
                    data.dataType,
                    data.taskType,
                    data.visConfig
                );
                break;
            case 'loadVisualization':
                await handleLoadVisualization(data.config, data.visualizationID);
                break;
            default:
                console.log('Unknown command:', command);
        }
    };

    useEffect(() => {
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return <></>;
}

// ... (Rest of the file remains unchanged: AppCombinedView, FunctionViewPanels, BottomDock)

export function AppCombinedView() {
    return (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
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
        { key: 'TrainingEventPanel', label: <span style={{ fontSize: 12 }}>Training Events</span> }
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
        { key: 'Tokens', label: <span style={{ fontSize: 12 }}>Tokens</span>, children: <TokenPanel /> }
    ];
    return (
        <Tabs
            className="bottom-dock-tabs"
            tabPosition="right"
            size="small"
            tabBarGutter={0}
            tabBarStyle={{ marginLeft: 0 }}
            style={{ height: '100%' }}
            items={items}
            activeKey={activeKey}
            onChange={(key) => setActiveKey(key as typeof activeKey)}
        />
    );
}