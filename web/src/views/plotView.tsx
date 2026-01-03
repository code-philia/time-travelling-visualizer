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
        setColorDict, setLabelDict, setProgress, setValue,
        setLoadingStats, clear, setEpoch
    } = useDefaultStore([
        'setAvailableEpochs', 'setDataType', 'setTaskType',
        'setTextData', 'setTokenList', 'setInherentLabelData',
        'setColorDict', 'setLabelDict', 'setProgress', 'setValue',
        'setLoadingStats', 'clear', 'setEpoch'
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

    // Helper function to load a single epoch's data with timing
    // Uses optimized single API with fallback to legacy multiple requests
    const loadEpochData = async (
        contentPath: string, 
        visualizationID: string, 
        epochNum: number, 
        taskType: string
    ): Promise<{ data: any; fetchTime: number }> => {
        const fetchStart = performance.now();
        
        try {
            // Try optimized single API that returns all data in one request
            const response = await BackendAPI.getEpochData(
                contentPath, 
                visualizationID, 
                epochNum, 
                taskType,
                true // include background
            );
            
            // Build epoch data object - data is already in the right format
            const epochData: any = {
                projection: response.projection || [],
                scope: response.scope || [],
                originalNeighbors: response.original_neighbors || [],
                projectionNeighbors: response.projection_neighbors || [],
            };
            
            if (taskType === 'Classification') {
                const predProb = response.prediction || [];
                epochData.predProbability = predProb;
                
                // Optimized prediction calculation - inline argmax
                const predLen = predProb.length;
                const predictions = new Array(predLen);
                for (let i = 0; i < predLen; i++) {
                    const prob = predProb[i];
                    const pLen = prob.length;
                    let maxIdx = 0;
                    let maxVal = prob[0];
                    for (let j = 1; j < pLen; j++) {
                        if (prob[j] > maxVal) {
                            maxVal = prob[j];
                            maxIdx = j;
                        }
                    }
                    predictions[i] = maxIdx;
                }
                epochData.prediction = predictions;
                epochData.background = response.background || '';
            }
            
            const fetchEnd = performance.now();
            return { data: epochData, fetchTime: fetchEnd - fetchStart };
        } catch (error) {
            // Fallback: use legacy multiple API calls
            console.warn(`[getEpochData] API failed for epoch ${epochNum}, using legacy APIs:`, error);
            
            // Parallel fetch all data for this epoch using legacy APIs
            const requests: Promise<any>[] = [
                BackendAPI.fetchEpochProjection(contentPath, visualizationID, epochNum),
                BackendAPI.getOriginalNeighbors(contentPath, epochNum),
                BackendAPI.getProjectionNeighbors(contentPath, visualizationID, epochNum)
            ];
            
            if (taskType === 'Classification') {
                requests.push(BackendAPI.getAttributeResource(contentPath, epochNum, 'prediction'));
                requests.push(BackendAPI.getBackground(contentPath, visualizationID, epochNum).catch(() => ''));
            }
            
            const results = await Promise.all(requests);
            const [projection, originalNeighbors, projectionNeighbors, ...optionalData] = results;
            
            const epochData: any = {
                projection: projection.projection || [],
                scope: projection.scope || [],
                originalNeighbors: originalNeighbors.neighbors || [],
                projectionNeighbors: projectionNeighbors.neighbors || []
            };
            
            if (taskType === 'Classification' && optionalData.length >= 1) {
                const predictionResponse = optionalData[0];
                const predProb = predictionResponse.prediction || [];
                epochData.predProbability = predProb;
                
                const predLen = predProb.length;
                const predictions = new Array(predLen);
                for (let i = 0; i < predLen; i++) {
                    const prob = predProb[i];
                    const pLen = prob.length;
                    let maxIdx = 0;
                    let maxVal = prob[0];
                    for (let j = 1; j < pLen; j++) {
                        if (prob[j] > maxVal) {
                            maxVal = prob[j];
                            maxIdx = j;
                        }
                    }
                    predictions[i] = maxIdx;
                }
                epochData.prediction = predictions;
                epochData.background = optionalData[1] || '';
            }
            
            const fetchEnd = performance.now();
            return { data: epochData, fetchTime: fetchEnd - fetchStart };
        }
    };
    
    // Batch load multiple epochs using optimized batch API
    // Falls back to parallel single requests if batch API fails
    const loadBatchEpochData = async (
        contentPath: string,
        visualizationID: string,
        epochs: number[],
        taskType: string
    ): Promise<{ results: Record<number, any>; fetchTime: number }> => {
        const fetchStart = performance.now();
        
        try {
            // Try batch API first - one request for all epochs
            const response = await BackendAPI.getBatchEpochData(
                contentPath,
                visualizationID,
                epochs,
                taskType,
                false // skip background in batch for speed
            );
            
            const epochsData = response.epochs_data || {};
            const results: Record<number, any> = {};
            
            // Process each epoch's data
            for (const epochNum of epochs) {
                const rawData = epochsData[epochNum];
                if (!rawData) continue;
                
                const epochData: any = {
                    projection: rawData.projection || [],
                    scope: rawData.scope || [],
                    originalNeighbors: rawData.original_neighbors || [],
                    projectionNeighbors: rawData.projection_neighbors || [],
                };
                
                if (taskType === 'Classification') {
                    const predProb = rawData.prediction || [];
                    epochData.predProbability = predProb;
                    
                    // Inline argmax calculation
                    const predLen = predProb.length;
                    const predictions = new Array(predLen);
                    for (let i = 0; i < predLen; i++) {
                        const prob = predProb[i];
                        const pLen = prob.length;
                        let maxIdx = 0;
                        let maxVal = prob[0];
                        for (let j = 1; j < pLen; j++) {
                            if (prob[j] > maxVal) {
                                maxVal = prob[j];
                                maxIdx = j;
                            }
                        }
                        predictions[i] = maxIdx;
                    }
                    epochData.prediction = predictions;
                    epochData.background = rawData.background || '';
                }
                
                results[epochNum] = epochData;
            }
            
            const fetchEnd = performance.now();
            return { results, fetchTime: fetchEnd - fetchStart };
        } catch (error) {
            // Fallback: use parallel single-epoch requests
            console.warn('[Batch API] Failed, falling back to parallel requests:', error);
            
            const batchResults = await Promise.all(
                epochs.map((epochNum: number) => loadEpochData(contentPath, visualizationID, epochNum, taskType))
            );
            
            const results: Record<number, any> = {};
            for (let i = 0; i < epochs.length; i++) {
                results[epochs[i]] = batchResults[i].data;
            }
            
            const fetchEnd = performance.now();
            return { results, fetchTime: fetchEnd - fetchStart };
        }
    };

    // Load visualization data from backend with configuration
    const handleLoadVisualization = async (config: any) => {
        try {
            const { contentPath, visualizationMethod, visualizationID, dataType, taskType} = config;
            
            console.log('Loading visualization with config:', config);
            
            // IMPORTANT: Clear all previous state immediately before loading new data
            clear();
            setProgress(0);
            setAvailableEpochs([]);
            setValue('allEpochData', {});
            setEpoch(1);
            
            // Show loading state immediately
            setLoadingStats({
                currentEpoch: null,
                currentBatchEpochs: [],
                currentBatch: 0,
                totalBatches: 0,
                totalEpochs: 0,
                epochLoadTimes: {},
                totalFetchTime: 0,
                totalRenderTime: 0,
                isLoading: true,
                currentPhase: 'fetching' as const,
                lastBatchTime: 0,
                avgEpochTime: 0,
            });
            
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

            // Initialize loading stats
            // Use batch API for maximum efficiency - one request per batch
            const BATCH_SIZE = 10;  // 10 epochs per batch request
            const totalBatches = Math.ceil(epochs.length / BATCH_SIZE);
            const initialLoadingStats = {
                currentEpoch: null as number | null,
                currentBatchEpochs: [] as number[],
                currentBatch: 0,
                totalBatches,
                totalEpochs: epochs.length,
                epochLoadTimes: {} as Record<number, { fetchTime: number; renderTime: number }>,
                totalFetchTime: 0,
                totalRenderTime: 0,
                isLoading: true,
                currentPhase: 'fetching' as const,
                lastBatchTime: 0,
                avgEpochTime: 0,
            };
            setLoadingStats(initialLoadingStats);

            // Load epoch data using batch API for maximum efficiency
            // This reduces N*5 HTTP requests to N/BATCH_SIZE requests
            let allEpochDataTemp: Record<number, any> = {};
            let totalFetchTime = 0;

            for (let batchStart = 0; batchStart < epochs.length; batchStart += BATCH_SIZE) {
                const batchEnd = Math.min(batchStart + BATCH_SIZE, epochs.length);
                const batchEpochs = epochs.slice(batchStart, batchEnd);
                const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
                
                // Update UI immediately BEFORE starting to load this batch
                setLoadingStats({
                    ...initialLoadingStats,
                    currentBatchEpochs: batchEpochs,
                    currentBatch: batchNum,
                    currentPhase: 'fetching' as const,
                });
                
                console.log(`[Batch API] Loading epochs ${batchEpochs.join(', ')} in single request...`);
                
                // Use batch API - ONE request for all epochs in this batch
                const { results, fetchTime } = await loadBatchEpochData(
                    contentPath, visualizationID, batchEpochs, taskType
                );
                
                // Merge batch results
                for (const epochNum of batchEpochs) {
                    if (results[epochNum]) {
                        allEpochDataTemp[epochNum] = results[epochNum];
                        initialLoadingStats.epochLoadTimes[epochNum] = { fetchTime: fetchTime / batchEpochs.length, renderTime: 0 };
                    }
                }
                
                totalFetchTime += fetchTime;
                initialLoadingStats.totalFetchTime = totalFetchTime;
                initialLoadingStats.avgEpochTime = totalFetchTime / batchEnd;
                
                console.log(`[Batch API] Epochs ${batchEpochs.join(', ')} loaded in ${fetchTime.toFixed(0)}ms (${(fetchTime/batchEpochs.length).toFixed(0)}ms/epoch)`);
                
                // Update state with batch data
                setValue('allEpochData', { ...allEpochDataTemp });
                setProgress(batchEnd);
            }
            
            // Mark loading complete
            setLoadingStats({
                ...initialLoadingStats,
                currentEpoch: null,
                isLoading: false,
                currentPhase: 'idle' as const,
                totalFetchTime,
            });
            
            setProgress(epochs.length);
            console.log(`All epochs loaded. Total fetch time: ${totalFetchTime.toFixed(0)}ms`);
            message.success(`Visualization loaded! (${(totalFetchTime / 1000).toFixed(2)}s)`);
            
        } catch (error) {
            console.error('Error loading visualization:', error);
            message.error('Failed to load visualization');
            setLoadingStats({
                currentEpoch: null,
                currentBatchEpochs: [],
                currentBatch: 0,
                totalBatches: 0,
                totalEpochs: 0,
                epochLoadTimes: {},
                totalFetchTime: 0,
                totalRenderTime: 0,
                isLoading: false,
                currentPhase: 'idle' as const,
                lastBatchTime: 0,
                avgEpochTime: 0,
            });
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