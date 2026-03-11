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


  const loadSingleEpoch = async (contentPath: string, method: string, visID: string, epochNum: number, taskType: string) => {
        // 1. 获取投影坐标 (最核心)
        const projection = await BackendAPI.fetchEpochProjection(contentPath, method, visID, epochNum);
        
        // 2. 获取邻居数据 (用于对比微调前后的流形保持)
        const originalNeighbors = await BackendAPI.getOriginalNeighbors(contentPath, epochNum);
        const projectionNeighbors = await BackendAPI.getProjectionNeighbors(contentPath, method, visID, epochNum);

        const data: any = {
            projection: projection.projection || [],
            originalNeighbors: originalNeighbors.neighbors || [],
            projectionNeighbors: projectionNeighbors.neighbors || [],
        };

        // 3. 分类任务额外数据
        if (taskType === 'Classification') {
            const predictionResponse = await BackendAPI.getAttributeResource(contentPath, epochNum, 'prediction');
            const prob = predictionResponse.prediction || [];
            data['predProbability'] = prob;
            data['prediction'] = prob.map((p: number[]) => p.indexOf(Math.max(...p)));
            
            const background = await BackendAPI.getBackground(contentPath, method, visID, epochNum);
            data['background'] = background || '';
        }
        return data;
    };

const initStaticContext = async (contentPath: string, dataType: string) => {
    // 1. 获取训练进程的基础信息
    const processInfo = await BackendAPI.fetchTrainingProcessInfo(contentPath);
    
    // 2. 构造颜色和标签字典 (用于点的着色)
    const colorMap = new Map();
    const labelMap = new Map();
    if (processInfo.color_list) {
        processInfo.color_list.forEach((color: number[], i: number) => {
            colorMap.set(i, [color[0], color[1], color[2]]);
            labelMap.set(i, processInfo.label_text_list[i]);
        });
    }

    // 3. 【关键修复】加载点的固有类别标签 (Inherent Labels)
    const labelsResponse = await BackendAPI.getAttributeResource(contentPath, processInfo.available_epochs[0], 'label');
    const inherentLabelData = labelsResponse.label || [];

    // 4. 【关键修复】加载文本数据和 Token (不能传空！)
    let textData: any[] = [];
    let tokenList: any[] = [];
    if (dataType === 'Text') {
        console.log("[TTAV] Fetching full text data and tokens...");
        const textResponse = await BackendAPI.getText(contentPath);
        textData = textResponse.text_data || [];
        tokenList = textResponse.token_list || [];
    }

    return { 
        processInfo, 
        colorMap, 
        labelMap, 
        inherentLabelData,
        textInfo: { 
            data: textData, 
            tokens: tokenList 
        } 
    };
};
// MessageHandler component for handling extension communication and backend requests
function MessageHandler() {
    // State from unified store
    const {
        setContentPath, setAvailableEpochs, setDataType, setTaskType,
        setTextData, setTokenList, setInherentLabelData,
        setColorDict, setLabelDict, setProgress, setValue,
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
            setValue('vis_method', visualizationMethod);
        } else {
            throw new Error(response.message);
        }
    } catch (error: any) {
        console.error('Error syncing session:', error);
        message.error({ content: `Sync failed: ${error.message}`, key: 'sync_task' });
    }
};
    const handleLoadVisualization = async (
        contentPath: string, 
        visualizationMethod: string, 
        visualizationID: string, 
        dataType: string, 
        taskType: string, 
        visConfig: any
    ) => {
        try {
            logWithTimestamp(`[TTAV] Start loading visualization: ${visualizationID}`);
            
            const staticCtx = await initStaticContext(contentPath, dataType);

            // 同步所有静态上下文
            setColorDict(staticCtx.colorMap);
            setLabelDict(staticCtx.labelMap);
            setInherentLabelData(staticCtx.inherentLabelData); // 修复颜色变色
            setTextData(staticCtx.textInfo.data);              // 修复文本丢失
            setTokenList(staticCtx.textInfo.tokens);            // 修复 Token 丢失
            
            const epochs = staticCtx.processInfo.available_epochs || [];
            setAvailableEpochs(epochs);
           
            // 2. 准备状态容器
            let allEpochDataTemp: Record<number, any> = {};
            let gMinX = Infinity, gMaxX = -Infinity, gMinY = Infinity, gMaxY = -Infinity;

            // 3. 循环加载 Epoch 数据 (可以指定范围或全量)
            for (const epochNum of epochs) {
                const epochData = await loadSingleEpoch(contentPath, visualizationMethod, visualizationID, epochNum, taskType);
                
                // 更新全局边界 (Bounds)
                const curP = epochData.projection;
                const minX = Math.min(...curP.map((p: any) => p[0])), maxX = Math.max(...curP.map((p: any) => p[0]));
                const minY = Math.min(...curP.map((p: any) => p[1])), maxY = Math.max(...curP.map((p: any) => p[1]));
                
                gMinX = Math.min(gMinX, minX); gMaxX = Math.max(gMaxX, maxX);
                gMinY = Math.min(gMinY, minY); gMaxY = Math.max(gMaxY, maxY);

                allEpochDataTemp[epochNum] = epochData;
                
                // 更新进度条和 Store
                setProgress(((epochs.indexOf(epochNum) + 1) / epochs.length) * 100);
                setValue('allEpochData', { ...allEpochDataTemp });
                setValue('globalBounds', { minX: gMinX, maxX: gMaxX, minY: gMinY, maxY: gMaxY });
            }

            // 4. 同步后端 Session
            await BackendAPI.syncSession({
                content_path: contentPath, vis_method: visualizationMethod, vis_id: visualizationID,
                data_type: dataType, task_type: taskType, vis_config: visConfig
            });

            message.success('Visualization loaded successfully!');
        } catch (error) {
            console.error('Error:', error);
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
        focusMode,
    } = useDefaultStore([
        'contentPath',
        'selectedIndices',
        'visID',
        'epoch',
        'setValue',
        'focusMode'
    ]);
    const { 
        epoch: targetEpoch, 
        vis_method, 
        taskType, 
        visID: currentVisID 
    } = useDefaultStore(["epoch", "vis_method", "taskType", "visID"]);
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
        if (!selectedIndices || selectedIndices.length === 0) {
            message.warning("Please select points on the canvas first.");
            return;
        }

        try {
            const hide = message.loading('Refining layout...', 0);
            
            // 1. 发起请求：后端执行 train_refined
            const response = await BackendAPI.updateFocusContext(contentPath, selectedIndices, focusMode);
            hide();

            if (response && response.status === "success") {
                
                // 2. 确定新的 visID：优先使用后端返回的，否则使用当前 Store 里的
                const newVisID = response.new_vis_id || currentVisID;
                // setValue('visID', newVisID);

                console.log(`[TTAV] Refine success. Fetching new projection for epoch ${targetEpoch}...`);

                // 3. 调用原子加载函数
                // 此时所有参数类型（string, string, string, number, string）均已正确匹配
                const epochData = await loadSingleEpoch(
                    contentPath,
                    vis_method,
                    newVisID, 
                    targetEpoch,
                    taskType 
                );

                // 4. 覆盖 allEpochData，触发原有的 Canvas 渲染逻辑
                // 注意：prevAllData 依然需要从 react-hook-form 的 getValues 获取最新的内存状态
                // const prevAllData = getValues('allEpochData') || {};
                // setValue('allEpochData', {
                //     ...prevAllData,
                //     [targetEpoch]: epochData
                // });
                setValue('allEpochData', { ...epochData });

                // 备份微调结果
                setValue('refinedProjection', response.projection);

                message.success('Projection refined and reloaded!');
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