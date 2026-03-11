import React, { useEffect, useRef, useState } from 'react';
import { message, Tabs } from 'antd';
import { MainBlock } from '../component/main-block';
import { FunctionPanel } from '../component/function-panel';
import { TrainingEventPanel } from '../component/training-event-panel';
import InfluenceAnalysisPanel from '../component/influence-panel';
import { TokenPanel } from '../component/token-panel';
import { useDefaultStore } from '../state/state.unified';
import * as BackendAPI from '../communication/backend';

import "../index.css";
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

const LOG_PREFIX = '[TTVisualizer]';

function logWithTimestamp(message: string): void {
    console.log(`${LOG_PREFIX}[${new Date().toISOString()}] ${message}`);
}

// // 1. 定义接口，明确告诉 TypeScript 这个组件接受什么属性
// interface FunctionViewPanelsProps {
//     onFocusModeChange: (mode: string) => Promise<void>;
// }
// 修改 Props 接口，增加 onUpdateProjection
interface FunctionViewPanelsProps {
    onUpdateProjection: () => Promise<void>;
}
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
            logWithTimestamp(`Visualization process started in backend. timeCost=${Date.now() - startTime}ms`);
        } catch (error:any) {
            console.error('Error starting visualization process:', error);
            message.error('Failed to start visualization process');
            // 这里捕获 Server 返回的 409 报错
            const serverMsg = error.response?.data?.message || "Unknown error";
            message.error(`Start Failed: ${serverMsg}`);
            }
    }

   const handleSyncSession = async (
    contentPath: string, 
    visualizationMethod: string, 
    visualizationID: string, 
    dataType: string, 
    taskType: string, 
    visConfig: any
) => {
    try {
        console.log("[TTAV] Manually syncing session with ID:", visualizationID);
        // 显示加载状态（由于不传大数据，通常很快）
        message.loading({ content: 'Syncing backend...', key: 'sync_task' });

        const fullSyncConfig = {
            content_path: contentPath,
            vis_method: visualizationMethod,
            visualizationID: visualizationID,
            data_type: dataType,
            task_type: taskType,
            vis_config: visConfig || { gpu_id: -1 }
        };

        const response = await BackendAPI.syncSession(fullSyncConfig);

        if (response.status === "success") {
            message.success({ content: 'Backend Session Resumed!', key: 'sync_task' });
            // 更新当前路径等基础状态，确保后续 Update 正常
            setContentPath(contentPath);
            setValue('visID', visualizationID);
        } else {
            throw new Error(response.message);
        }
    } catch (error: any) {
        console.error('Error syncing session:', error);
        message.error({ content: `Sync failed: ${error.message}`, key: 'sync_task' });
    }
};
    // Load visualization data from backend with configuration
    const handleLoadVisualization = async (
        contentPath: string, 
        visualizationMethod: string, 
        visualizationID: string, 
        dataType: string, 
        taskType: string, 
        visConfig: any
    ) => {
        try {
            // 每次重新 load 都要清空旧的精细化结果

            console.log("[TTAV] Loading visualization with ID:", visualizationID);
            setValue('refinedProjection', null);
            setValue('visID', visualizationID);
            logWithTimestamp(`Web plot view start loading visualization. config=${JSON.stringify({ contentPath, visualizationMethod, visualizationID, dataType, taskType })}`);
            
            // Set basic configuration
            setContentPath(contentPath);
            setDataType(dataType as 'Image' | 'Text');
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

            // Load epoch data for all available epochs
            let allEpochDataTemp: Record<number, any> = {};
            let firstEpochRequestTimestamp: Date | undefined;
            let lastEpochReceiveTimestamp: Date | undefined;
            const totalEpochCount = epochs.length;

            let globalMinX = Infinity, globalMaxX = -Infinity;
            let globalMinY = Infinity, globalMaxY = -Infinity;

            for (const epochNum of epochs) {
                const epochRequestStart = new Date();
                if (!firstEpochRequestTimestamp) {
                    firstEpochRequestTimestamp = epochRequestStart;
                    logWithTimestamp(`First epoch request sent. epoch=${epochNum} at ${epochRequestStart.toISOString()}`);
                } else {
                    logWithTimestamp(`Epoch request sent. epoch=${epochNum} at ${epochRequestStart.toISOString()}`);
                }

                allEpochDataTemp = { ...allEpochDataTemp, [epochNum]: {} };

                // Load main plot data
                const projection = await BackendAPI.fetchEpochProjection(contentPath, visualizationMethod, visualizationID, epochNum);
                allEpochDataTemp[epochNum]['projection'] = projection.projection || [];

                // Load neighbors data
                const originalNeighbors = await BackendAPI.getOriginalNeighbors(contentPath, epochNum);
                const projectionNeighbors = await BackendAPI.getProjectionNeighbors(contentPath,visualizationMethod, visualizationID, epochNum);
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
                   // console.log("Epoch",epochNum);
                    const background = await BackendAPI.getBackground(contentPath,visualizationMethod, visualizationID, epochNum);
                    allEpochDataTemp[epochNum]['background'] = background || '';
                }

                let minX = allEpochDataTemp[epochNum]['projection'].reduce((min: number, p: number[]) => p[0] < min ? p[0] : min, Infinity);
                let maxX = allEpochDataTemp[epochNum]['projection'].reduce((max: number, p: number[]) => p[0] > max ? p[0] : max, -Infinity);
                let minY = allEpochDataTemp[epochNum]['projection'].reduce((min: number, p: number[]) => p[1] < min ? p[1] : min, Infinity);
                let maxY = allEpochDataTemp[epochNum]['projection'].reduce((max: number, p: number[]) => p[1] > max ? p[1] : max, -Infinity);

                globalMinX = Math.min(globalMinX, minX);
                globalMaxX = Math.max(globalMaxX, maxX);
                globalMinY = Math.min(globalMinY, minY);
                globalMaxY = Math.max(globalMaxY, maxY);

                // Update store with new epoch data
                setValue('globalBounds', {
                    minX: globalMinX,
                    maxX: globalMaxX,
                    minY: globalMinY,
                    maxY: globalMaxY
                });
                setValue('allEpochData', { ...allEpochDataTemp });

                // Calculate progress based on the number of processed epochs
                // We use index + 1 because epochs array is 0-indexed in the loop, but we want to show progress for the current epoch
                const currentEpochIndex = epochs.indexOf(epochNum);
                setProgress(((currentEpochIndex + 1) / epochs.length) * 100);

                lastEpochReceiveTimestamp = new Date();
                const latencyMs = lastEpochReceiveTimestamp.getTime() - epochRequestStart.getTime();
                logWithTimestamp(`Epoch data received. epoch=${epochNum} at ${lastEpochReceiveTimestamp.toISOString()} duration=${latencyMs} ms`);
            }

            if (firstEpochRequestTimestamp) {
                logWithTimestamp(`First epoch request timestamp recorded at ${firstEpochRequestTimestamp.toISOString()}.`);
            }
            if (lastEpochReceiveTimestamp) {
                logWithTimestamp(`Last epoch data received at ${lastEpochReceiveTimestamp.toISOString()} after processing ${totalEpochCount} epoch(s).`);
            }

            setProgress(100);
            message.success('Visualization loaded successfully!');

            // [新增代码] 同步后端 Session，确保 active_session 被正确初始化
            try {
                console.log("[TTAV] Syncing active_session with server...");
                // 构造一个完整的配置传给后端接口
                const syncConfig = {
                    content_path: contentPath,
                    vis_method: visualizationMethod,
                    vis_id: visualizationID,
                    data_type: dataType,
                    task_type: taskType,
                    vis_config: visConfig
                };
                // 调用后端同步接口
                await BackendAPI.syncSession(syncConfig);
                console.log("[TTAV] Server session synchronized successfully.");
            } catch (syncError) {
                console.error("[TTAV] Failed to sync session with server:", syncError);
                // 这里不弹出 message.error，以免干扰正常加载，仅在控制台记录
            }

        } catch (error) {
            console.error('Error loading visualization:', error);
            message.error('Failed to load visualization');
        }
    };

    // 增加一个 Ref 锁，防止同一 ID 的任务被重复触发
    const processingMessageIds = useRef(new Set<string>());

    const handleMessage = async (event: MessageEvent) => {
        const { command, data } = event.data;
        console.log('Received message from extension:', event);

        // 如果插件没传 id，可以用 command + contentPath 组合成简单锁
        const lockKey = `${command}-${data?.contentPath}`;
        if (processingMessageIds.current.has(lockKey)) return;

        const vis_id = data.visualizationID ? data.visualizationID : 0;

        try {
            processingMessageIds.current.add(lockKey);
            switch (command) {
                case 'startVisualizing':
                    await handleStartVisualizing(data.contentPath, data.visualizationMethod, vis_id, data.dataType, data.taskType, data.visConfig);
                    break;
                case 'loadVisualization':
                    await handleLoadVisualization(data.contentPath, data.visualizationMethod, vis_id, data.dataType, data.taskType, data.visConfig);
                    break;
                case 'syncSession':
                    await handleSyncSession(data.contentPath, data.visualizationMethod, vis_id, data.dataType, data.taskType, data.visConfig);
                    break;
                default:
                    console.log('Unknown message command:', command);
            }
        }
         finally {
            // 执行完后移除锁
            processingMessageIds.current.delete(lockKey);
        }
    };

    useEffect(() => {
        window.addEventListener('message', handleMessage);

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return <></>;
}

export function AppCombinedView() {
    // [TTAV] Deconstruct required state and the generic 'setValue' from the store
    // Note: 'allEpochData' must be included here to be recognized in the function below
    const {
        contentPath,
        selectedIndices,
        visID,
        epoch,
        setValue,
        focusMode
    } = useDefaultStore([
        'contentPath',
        'selectedIndices',
        'visID',
        'epoch',
        'setValue',
        'focusMode'
    ]);
// 用于 Canvas 实时绘制的坐标（这是真正传给 Canvas 组件的数据）
    const [currentDrawingCoords, setCurrentDrawingCoords] = useState<number[][] | null>(null);
    const animationRef = useRef<number>();

    // 平滑平移函数
    const animateTransition = (startCoords: number[][], endCoords: number[][]) => {
        const duration = 800; // 动画持续 800ms
        const startTime = performance.now();

        const step = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 缓动函数 (EaseInOutQuad)
            const ease = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            // 计算每一帧的插值坐标
            const interpolated = startCoords.map((start, i) => {
                const end = endCoords[i];
                return [
                    start[0] + (end[0] - start[0]) * ease,
                    start[1] + (end[1] - start[1]) * ease
                ];
            });

            // 更新绘制用的 State
            setCurrentDrawingCoords(interpolated);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(step);
            } else {
                // 动画结束，正式同步到 Store
                setValue('refinedProjection', endCoords);
            }
        };

        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        animationRef.current = requestAnimationFrame(step);
    };
  const handleUpdate = async () => {
    // 基础校验
    if (!selectedIndices || selectedIndices.length === 0) {
        message.warning("Please select points on the canvas first.");
        return;
    }

    try {
        const hide = message.loading('Refining layout...', 0);
        
        // 1. 发起请求：此时不需要知道旧坐标
        const response = await BackendAPI.updateFocusContext(contentPath, selectedIndices, focusMode);
        hide();

        if (response && response.status === "success") {
            // 2. 直接覆盖：Store 会通知 Canvas 重新渲染
            // 因为不需要动画，这里完全没有用到 allEpochData，性能最优
            setValue('refinedProjection', response.projection);
            message.success('Projection updated!');
        }
    } catch (error) {
        console.error("Update failed:", error);
        message.error('Failed to update projection.');
    }
};
    // 1. 监听全局选点，确保 selectedIndices 响应
    useEffect(() => {
    // 只要这个打印了，说明选点通了
    console.log("Global Selection confirmed:", selectedIndices);
}, [selectedIndices]);

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
                {/* [逻辑更替]：不再监听模式改变自动触发，
                    而是将 handleUpdate 传给子组件，由子组件的 "Update" 按钮显式调用。
                */}
                <FunctionViewPanels onUpdateProjection={handleUpdate} />
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

// 2. 修改组件定义，使其接收 Props
export function FunctionViewPanels({ onUpdateProjection }: FunctionViewPanelsProps) {
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
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                {activeKey === 'FunctionPanel' && (
                    <FunctionPanel onUpdateProjection={onUpdateProjection} />
                )}
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
            style={{ height: '100%' }}
            items={items}
            activeKey={activeKey}
            onChange={(key) => setActiveKey(key as typeof activeKey)}
        />
    );
}

window.vscode?.postMessage({ state: 'load' }, '*');