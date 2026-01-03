// ChartComponent.tsx
import { memo, useEffect, useRef } from 'react';
import VChart from '@visactor/vchart';
import { Edge } from './types';
import { useDefaultStore } from "../state/state.unified";
import { createEdgesWithMaps, softmaxWithMax, transferArray2Color } from './utils';
import { notifyHoveredIndexSwitch, notifySelectedIndicesSwitch } from '../communication/extension';
const BACKGROUND_PADDING = 0.5;

// Performance optimization: Pre-compute sample data structure
interface SampleData {
    pointId: number;
    x: number;
    y: number;
    label: number;
    pred: number;
    label_desc: string;
    pred_desc: string;
    confidence: number;
    textSample: string;
}

// Cached epoch data structure
interface CachedEpochData {
    samples: SampleData[];
    edges: Edge[];
    neighborCache: Map<number, number[]>;
    edgeMap: Map<string, Edge>;
    bounds: { x_min: number; x_max: number; y_min: number; y_max: number };
    wrong: number[];
    flip: number[];
}

export const ChartComponent = memo(() => {
    const chartRef = useRef<HTMLDivElement>(null);
    const vchartRef = useRef<VChart | null>(null);
    
    // Flag to track if chart is initialized
    const isChartInitialized = useRef<boolean>(false);
    // Cache for pre-computed epoch data
    const epochCacheRef = useRef<Map<number, CachedEpochData>>(new Map());
    // Track last rendered epoch for logging
    const lastRenderedEpochRef = useRef<number | null>(null);

    // Here are data from useStore
    const { epoch, availableEpochs, allEpochData} = useDefaultStore(["epoch", "availableEpochs", "allEpochData"]);
    const { inherentLabelData, labelDict, colorDict } = useDefaultStore(["inherentLabelData", "labelDict", "colorDict"]);
    const { showIndex, showLabel,showBackground, showTrail, textData } = useDefaultStore(["showIndex", "showLabel", "showBackground","showTrail","textData"])
    const { revealProjectionNeighbors, revealOriginalNeighbors } = useDefaultStore(["revealProjectionNeighbors", "revealOriginalNeighbors"]);
    const { hoveredIndex, setHoveredIndex, selectedIndices, setSelectedIndices, selectedListener } = useDefaultStore(["hoveredIndex", "setHoveredIndex", "selectedIndices", "setSelectedIndices", "selectedListener"]);
    const { shownData, highlightData, index } = useDefaultStore(["shownData", "highlightData", "index"]);

    const { isFocusMode, focusIndices } = useDefaultStore(["isFocusMode", "focusIndices"]);
    const { trainingEvents } = useDefaultStore(["trainingEvents"]);

    const samplesRef = useRef<SampleData[]>([]);
    const edgesRef = useRef<Edge[]>([]);
    const wrongRef = useRef<number[]>([]);
    const flipRef = useRef<number[]>([]);
    
    // Render time tracking
    const renderTimeRef = useRef<number>(0);
    
    // Cache for neighbor lookup to improve performance
    const neighborCacheRef = useRef<Map<number, number[]>>(new Map());
    const selectedIndicesSetRef = useRef<Set<number>>(new Set());
    // Cache for edge lookup by from->to
    const edgeMapRef = useRef<Map<string, Edge>>(new Map());
    
    // Debounce hover events to improve performance
    const hoverTimeoutRef = useRef<any>(null);
    
    // Pre-compute epoch data and cache it - optimized version
    const getOrComputeEpochCache = (epochNum: number): CachedEpochData | null => {
        // Check cache first
        if (epochCacheRef.current.has(epochNum)) {
            return epochCacheRef.current.get(epochNum)!;
        }
        
        const epochData = allEpochData[epochNum];
        if (!epochData || !epochData.projection) {
            return null;
        }
        
        const cacheStart = performance.now();
        const projectionLength = epochData.projection.length;
        
        // Pre-allocate arrays
        const samples: SampleData[] = new Array(projectionLength);
        const wrong: number[] = [];
        const flip: number[] = [];
        
        let x_min = Infinity, x_max = -Infinity, y_min = Infinity, y_max = -Infinity;
        
        const hasPredProbability = epochData.predProbability && epochData.predProbability.length > 0;
        const epochId = availableEpochs.indexOf(epochNum);
        const lastEpochData = epochId > 0 ? allEpochData[availableEpochs[epochId - 1]] : null;
        const lastPredictions = lastEpochData?.prediction;
        
        // Process all points in a single optimized loop
        const projection = epochData.projection;
        const predProb = epochData.predProbability;
        const textDataArr = textData || [];
        
        for (let i = 0; i < projectionLength; i++) {
            const p = projection[i];
            // Use bitwise operations for faster rounding
            const x = ((p[0] * 1000 + 0.5) | 0) / 1000;
            const y = ((p[1] * 1000 + 0.5) | 0) / 1000;
            
            // Inline min/max for speed
            if (x < x_min) x_min = x;
            else if (x > x_max) x_max = x;
            if (y < y_min) y_min = y;
            else if (y > y_max) y_max = y;
            
            const label = inherentLabelData[i];
            let confidence = 1.0;
            let pred = label;
            
            if (hasPredProbability) {
                const probArr = predProb[i];
                // Inline softmaxWithMax for critical path
                const len = probArr.length;
                let maxVal = probArr[0];
                for (let k = 1; k < len; k++) {
                    if (probArr[k] > maxVal) maxVal = probArr[k];
                }
                let sum = 0;
                let expMax = 0;
                let maxIndex = 0;
                for (let k = 0; k < len; k++) {
                    const exp = Math.exp(probArr[k] - maxVal);
                    sum += exp;
                    if (exp > expMax) {
                        expMax = exp;
                        maxIndex = k;
                    }
                }
                confidence = expMax / sum;
                pred = maxIndex;
                
                if (pred !== label) {
                    wrong.push(i);
                }
                
                if (lastPredictions && lastPredictions[i] !== pred) {
                    flip.push(i);
                }
            }
            
            samples[i] = {
                pointId: i,
                x,
                y,
                label,
                label_desc: labelDict.get(label) ?? '',
                pred,
                pred_desc: labelDict.get(pred) ?? labelDict.get(label) ?? '',
                confidence,
                textSample: textDataArr[i] ?? '',
            };
        }
        
        // Build edges with optimized function that returns pre-built maps
        const { edges, neighborMap, edgeMap } = createEdgesWithMaps(
            epochData.originalNeighbors || [], 
            epochData.projectionNeighbors || []
        );
        
        const cachedData: CachedEpochData = {
            samples,
            edges,
            neighborCache: neighborMap,
            edgeMap,
            bounds: { x_min, x_max, y_min, y_max },
            wrong,
            flip
        };
        
        epochCacheRef.current.set(epochNum, cachedData);
        const cacheTime = performance.now() - cacheStart;
        console.log(`[Cache Build] Epoch ${epochNum}: ${cacheTime.toFixed(0)}ms for ${projectionLength} points, ${edges.length} edges`);
        
        return cachedData;
    };

    // listen to selectedIndices change in canvas
    useEffect(() => {
        const listener = () => {
            console.log("Highlight Listener In VChart Triggered.");
            setSelectedIndices([...selectedListener.selectedIndices]);
            notifySelectedIndicesSwitch([...selectedListener.selectedIndices]);
        };
        console.log("Add Highlight Listener In VChart");
        selectedListener.addHighlightChangedListener(listener);
        return () => {
            selectedListener.removeHighlightChangedListener(listener);
        }
    }, []);

    // listen to selectedIndices change in other components
    useEffect(() => {
        selectedListener.setSelected([...selectedIndices]);
    }, [selectedIndices]);
    
    // Clear cache when data source changes (new visualization loaded)
    useEffect(() => {
        // When availableEpochs changes to a different set, clear all caches
        console.log('[Cache] Data source changed, clearing epoch cache');
        epochCacheRef.current.clear();
        lastRenderedEpochRef.current = null;
        isChartInitialized.current = false;
        
        // Also reset the chart if it exists
        if (vchartRef.current) {
            vchartRef.current.release();
            vchartRef.current = null;
        }
    }, [availableEpochs]);
    
    // Pre-compute cache for adjacent epochs when data loads
    useEffect(() => {
        if (availableEpochs.length === 0 || Object.keys(allEpochData).length === 0) {
            return;
        }
        
        // Clear old cache when data changes significantly
        if (epochCacheRef.current.size > availableEpochs.length * 2) {
            epochCacheRef.current.clear();
        }
        
        // Pre-compute cache for current and adjacent epochs
        const currentIdx = availableEpochs.indexOf(epoch);
        const epochsToCache = [
            epoch,
            ...(currentIdx > 0 ? [availableEpochs[currentIdx - 1]] : []),
            ...(currentIdx < availableEpochs.length - 1 ? [availableEpochs[currentIdx + 1]] : [])
        ];
        
        // Use requestIdleCallback or setTimeout to avoid blocking
        const precomputeCache = () => {
            for (const ep of epochsToCache) {
                if (!epochCacheRef.current.has(ep) && allEpochData[ep]) {
                    getOrComputeEpochCache(ep);
                }
            }
        };
        
        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(precomputeCache, { timeout: 1000 });
        } else {
            setTimeout(precomputeCache, 100);
        }
    }, [epoch, availableEpochs, allEpochData]);

    /*
        Main update logic - optimized with caching and incremental updates
    */
    useEffect(() => {
        if (!chartRef.current) {
            return;
        }

        const epochData = allEpochData[epoch];
        if (!epochData) {
            return;
        }

        const renderStartTime = performance.now();
        console.log('Rendering epoch:', epoch);
        
        // Get or compute cached data for this epoch
        const cachedData = getOrComputeEpochCache(epoch);
        if (!cachedData) {
            console.log('Failed to get cached data for epoch:', epoch);
            return;
        }
        
        // Update refs from cache
        samplesRef.current = cachedData.samples;
        wrongRef.current = cachedData.wrong;
        flipRef.current = cachedData.flip;
        edgesRef.current = cachedData.edges;
        neighborCacheRef.current = cachedData.neighborCache;
        edgeMapRef.current = cachedData.edgeMap;
        selectedIndicesSetRef.current = new Set(selectedIndices);
        
        const { x_min, x_max, y_min, y_max } = cachedData.bounds;
        const projectionLength = cachedData.samples.length;
        
        const cacheTime = performance.now() - renderStartTime;
        console.log(`Cache lookup/build: ${cacheTime.toFixed(0)}ms for ${projectionLength} points`);

        // create spec
        const spec: any = {
            type: 'common', // chart type
            padding: 0,
            animation: false,
            data: [
                {
                    id: 'points',
                    values: samplesRef.current,
                },
                {
                    id: 'edges',
                    values: [] // dynamically constructed
                },
                {
                     id: 'trails',
                     values: [] // dynamically constructed
                },
                {
                    id: 'events',
                    values: [] // dynamically constructed
                }
            ],

            series: [
                {
                    id: 'background-series',
                    interactive: false,
                    persent: true,
                    type: 'area',
                    data: {
                        values: [
                            { xx: x_min - BACKGROUND_PADDING, yy: y_min - BACKGROUND_PADDING },
                            { xx: x_max + BACKGROUND_PADDING, yy: y_min - BACKGROUND_PADDING },
                            { xx: x_max + BACKGROUND_PADDING, yy: y_max + BACKGROUND_PADDING },
                            { xx: x_min - BACKGROUND_PADDING, yy: y_max + BACKGROUND_PADDING },
                            { xx: x_min - BACKGROUND_PADDING, yy: y_min - BACKGROUND_PADDING },
                        ]
                    },
                    xField: 'xx',
                    yField: 'yy',
                    point: {
                        visible: false,
                    },
                    line: {
                        visible: false,
                    },
                    area: {
                        interactive: false,
                        style: {
                            background: () => {
                                return showBackground ? epochData.background : '';
                            },
                            fill: 'transparent',
                            fillOpacity: 0.5
                        }
                    },
                    hover: {
                        enable: false,
                    },
                    select: {
                        enable: false,
                    }
                },
                {
                    id: 'trails-series',
                    type: 'line',
                    dataId: 'trails',
                    seriesField: 'trailId',
                    xField: 'x',
                    yField: 'y',
                    line: {
                        intereactive: false,
                        style: {
                            stroke: 'rgb(169, 168, 168)',
                            lineWidth: 3,
                            fillOpacity: 0.5
                        }
                    },
                    point: {
                        visible: true,
                        intereactive: false,
                        style: {
                            fill: 'rgb(149, 147, 147)',
                            fillOpacity: (datum: { opacity: number }) => {
                                return Math.max(0.5, datum.opacity);
                            },
                            size: (datum: { opacity: number }) => {
                                // return Math.max(5, 7.5 * datum.opacity);
                                return 6.5;
                            },
                        }
                    },
                    hover: {
                        enable: false,
                    },
                    select: {
                        enable: false,
                    }
                },
                {
                    id: 'events-series',
                    type: 'line',
                    dataId: 'events',
                    seriesField: 'eventId',
                    xField: 'x',
                    yField: 'y',
                    line: {
                        style: {
                            stroke: 'rgb(168, 168, 168)',
                            lineWidth: 3,
                            lineDash: [4, 4],
                            boundsPadding: 10,
                        }
                    },
                    point: {
                        visible: true,
                        style: {
                            fill: (datum: any) => {
                                return datum.color;
                            },
                            size: 8
                        }
                    },
                    hover: {
                        enable: false
                    },
                    select: {
                        enable: false
                    }
                },
                {
                    id: 'edges-series',
                    type: 'line',
                    dataId: 'edges',
                    seriesField: 'edgeId',
                    xField: 'x',
                    yField: 'y',
                    line: {
                        style: {
                            stroke: (datum: { from: number, to: number, type: string; }) => {
                                return transferArray2Color(colorDict.get(samplesRef.current[datum.to].label), 0.6);
                            },
                            lineDash: (datum: { type: string; }) => {
                                if (datum.type === 'highDim') {
                                    return [3, 3];
                                } else if (datum.type === 'lowDim') {
                                    return [0, 0];
                                }
                                return [1, 1];
                            },
                            lineWidth: (datum: { type: string; }) => {
                                if (datum.type === 'highDim') {
                                    return 1.5;
                                } else if (datum.type === 'lowDim') {
                                    return 1;
                                }
                                return 0.8;
                            },
                        }
                    },
                    point: { visible: false }
                },
                {
                    id: 'point-series',
                    type: 'scatter',
                    dataId: 'points',
                    xField: 'x',
                    yField: 'y',
                    seriesField: 'label',
                    point: {
                        state: {
                            hover: {
                                scaleX: 2,
                                scaleY: 2,
                                fillOpacity: 1
                            },
                            hover_reverse: {
                                scaleX: 1,
                                scaleY: 1,
                                fillOpacity: 0.2
                            },
                            as_neighbor: {
                                scaleX: 1.6,
                                scaleY: 1.6,
                                fillOpacity: 0.5
                            },
                            locked: {
                                scaleX: 2,
                                scaleY: 2,
                                fillOpacity: 1
                            }
                        },
                        style: {
                            size: 3,
                            fill: (datum: { label: number; groupColor: string }) => {
                                if (highlightData.includes("prediction_flip")) {
                                   return datum.groupColor ?? "black";
                                }
                                else {
                                    const color = colorDict.get(datum.label) ?? [0, 0, 0];
                                    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`
                                }
                            },
                            fillOpacity: (datum: { confidence: number; }) => {
                                return datum.confidence;
                            },
                            outerBorder: (datum: { pointId: number; }) => {
                                if (highlightData.includes('prediction_error') && wrongRef.current.includes(datum.pointId)) {
                                    return {
                                        distance: 1.5,
                                        lineWidth: 1.5,
                                        stroke: 'rgba(255, 0, 0, 0.75)'
                                    }
                                }
                            },
                        }
                    },
                    label: [
                        {
                            visible: true,
                            style: {
                                visible: () => {
                                    return showIndex || showLabel;
                                },
                                type: 'text',
                                fontFamily: 'Console',
                                text: (datum: { pointId: any; textSample: string; label: number; }) => {
                                    if (showLabel && showIndex) {
                                        return `${datum.pointId}.${datum.textSample == '' ? labelDict.get(datum.label) : datum.textSample}`;
                                    }
                                    else if (showLabel) {
                                        return datum.textSample == '' ? labelDict.get(datum.label) : datum.textSample;
                                    }
                                    else if (showIndex) {
                                        return `${datum.pointId}`;
                                    }
                                },

                                fill: 'black',
                                fontSize: 12
                            }
                        }
                    ]
                }
            ],

            axes: [
                {
                    visible: false,
                    orient: 'left',
                    min: y_min-BACKGROUND_PADDING,
                    max: y_max+BACKGROUND_PADDING,
                    type: 'linear',
                    grid: { visible: false }
                },
                {
                    visible: false,
                    orient: 'bottom',
                    min: x_min-BACKGROUND_PADDING,
                    max: x_max+BACKGROUND_PADDING,
                    type: 'linear',
                    grid: { visible: false }
                }
            ],
            dataZoom: [
                {
                    visible: false,
                    orient: 'left',
                    filterMode: 'axis',
                    showDetail: false,
                    roamZoom: {
                        enable: true,
                        focus: true,
                        rate: 0.5
                    },
                    roamDrag: {
                        enable: true,
                        reverse: true,
                        rate: 0.3
                    }
                },
                {
                    visible: false,
                    orient: 'bottom',
                    filterMode: 'axis',
                    showDetail: false,
                    roamZoom: {
                        enable: true,
                        focus: true,
                        rate: 0.5
                    },
                    roamDrag: {
                        enable: true,
                        reverse: true,
                        rate: 0.3
                    },
                }
            ],
            tooltip: {visible: false},
            direction: 'horizontal'
        };

        // create or update vchart
        // Keep using updateSpec for now - updateDataSync doesn't update axes ranges
        // The caching optimization still speeds up data processing significantly
        
        if (!vchartRef.current) {
            // First time initialization
            const vchart = new VChart(spec, { dom: chartRef.current });
            vchartRef.current = vchart;
            isChartInitialized.current = true;

            // Debounced hover handler for better performance
            vchartRef.current.on('pointerover', { id: 'point-series' }, (e) => {
                const pointId = e.datum?.pointId;
                if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                }
                hoverTimeoutRef.current = setTimeout(() => {
                    setHoveredIndex(pointId);
                    notifyHoveredIndexSwitch(pointId);
                }, 30); // Reduced debounce for responsiveness
            });
            
            vchartRef.current.on('pointerout', { id: 'point-series' }, () => {
                if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                    hoverTimeoutRef.current = null;
                }
                setHoveredIndex(undefined);
                notifyHoveredIndexSwitch(undefined);
            });
            
            vchartRef.current.on('click', { id: 'point-series' }, (e) => {
                const pointId = e.datum?.pointId;
                selectedListener.switchSelected(pointId);
            });
            
            // Initial render
            const chartRenderStart = performance.now();
            vchartRef.current.renderSync();
            const chartRenderTime = performance.now() - chartRenderStart;
            console.log(`[Initial Render] ${chartRenderTime.toFixed(0)}ms for ${projectionLength} points`);
        }
        else {
            // Update spec and render
            // Use requestAnimationFrame to avoid blocking UI
            const specUpdateStart = performance.now();
            vchartRef.current.updateSpec(spec);
            vchartRef.current.renderSync();
            const specUpdateTime = performance.now() - specUpdateStart;
            console.log(`[Spec Update] ${specUpdateTime.toFixed(0)}ms for epoch ${epoch}`);
        }
        
        lastRenderedEpochRef.current = epoch;
        const totalRenderTime = performance.now() - renderStartTime;
        renderTimeRef.current = totalRenderTime;
        
        console.log(`[Performance] Total: ${totalRenderTime.toFixed(0)}ms for ${projectionLength} points`);
        
        // CRITICAL: Immediately restore selected state after renderSync()
        // renderSync() clears all chart states including 'locked', so we must restore synchronously
        // Read from selectedListener (the single source of truth) to ensure consistency across epochs
        const currentSelectedIndices = Array.from(selectedListener.selectedIndices);
        if (currentSelectedIndices.length > 0) {
            console.log('[Main Render] Restoring locked state from pool:', currentSelectedIndices);
            
            // Update cache for fast lookup
            selectedIndicesSetRef.current = new Set(currentSelectedIndices);
            
            // Calculate neighbors for selected points
            const selectedNeighbors = new Set<number>();
            currentSelectedIndices.forEach(idx => {
                const neighbors = neighborCacheRef.current.get(idx);
                if (neighbors) {
                    neighbors.forEach(n => selectedNeighbors.add(n));
                }
            });
            
            // Restore locked state synchronously (no setTimeout!)
            vchartRef.current.updateState({
                locked: {
                    filter: (datum: any) => selectedIndicesSetRef.current.has(datum.pointId)
                },
                as_neighbor: {
                    filter: (datum: any) => selectedNeighbors.has(datum.pointId)
                }
            });
            
            console.log('[Main Render] Locked state restored from pool immediately after renderSync');
        }
    }, [epoch, allEpochData, showIndex, showLabel, showBackground, shownData, highlightData, index, availableEpochs, isFocusMode, focusIndices]);


    /*
    Unified state and edge management
    Handles hover state and selected state changes (NOT epoch changes - that's in main render)
    Reads from selectedListener pool to ensure cross-epoch consistency
    Priority: hover > selected
    */
    useEffect(() => {
        if (!vchartRef.current) {
            return;
        }

        // Read from the pool (single source of truth)
        const currentSelectedIndices = Array.from(selectedListener.selectedIndices);
        console.log('[Unified Update] Hovered:', hoveredIndex, 'Selected from pool:', currentSelectedIndices);

        // Update selectedIndices Set for fast lookup
        selectedIndicesSetRef.current = new Set(currentSelectedIndices);

        // === PART 1: Update point states (locked and neighbors) ===
        
        // Case 1: No selection and no hover - clear all states
        if (currentSelectedIndices.length === 0 && (hoveredIndex === undefined || hoveredIndex === -1)) {
            console.log('[Unified Update] Clearing all states');
            vchartRef.current.updateState({
                locked: { filter: () => false },
                as_neighbor: { filter: () => false }
            });
            // Clear edges as well
            vchartRef.current.updateDataSync('edges', []);
            return;
        }

        // Prepare for state update and edge calculation
        let edgeSourceIndices: number[] = [];
        
        // Case 2: Has hover - prioritize showing hovered point's neighbors
        if (hoveredIndex !== undefined && hoveredIndex !== -1) {
            const hoveredNeighbors = neighborCacheRef.current.get(hoveredIndex) || [];
            const hoveredNeighborsSet = new Set(hoveredNeighbors);
            
            console.log('[Unified Update] Applying hover state for point:', hoveredIndex);
            vchartRef.current.updateState({
                locked: {
                    filter: (datum: any) => selectedIndicesSetRef.current.has(datum.pointId)
                },
                as_neighbor: {
                    filter: (datum: any) => hoveredNeighborsSet.has(datum.pointId)
                }
            });
            
            // Only show edges for hovered point
            edgeSourceIndices = [hoveredIndex];
        }
        // Case 3: Has selection but no hover
        else if (currentSelectedIndices.length > 0) {
            const selectedNeighbors = new Set<number>();
            currentSelectedIndices.forEach(idx => {
                const neighbors = neighborCacheRef.current.get(idx);
                if (neighbors) {
                    neighbors.forEach(n => selectedNeighbors.add(n));
                }
            });
            
            console.log('[Unified Update] Applying selected state for points from pool:', currentSelectedIndices);
            vchartRef.current.updateState({
                locked: {
                    filter: (datum: any) => selectedIndicesSetRef.current.has(datum.pointId)
                },
                as_neighbor: {
                    filter: (datum: any) => selectedNeighbors.has(datum.pointId)
                }
            });
            
            // Show edges for all selected points
            edgeSourceIndices = currentSelectedIndices;
        }

        // === PART 2: Update edges efficiently ===
        const endpoints: { edgeId: number, from: number, to: number, x: number, y: number, type: string, status: string }[] = [];
        
        // Use Set to avoid duplicate edges when multiple selected points share neighbors
        const processedEdges = new Set<string>();
        
        edgeSourceIndices.forEach(idx => {
            const neighbors = neighborCacheRef.current.get(idx);
            if (!neighbors) return;
            
            neighbors.forEach((toIdx) => {
                const key = `${idx}-${toIdx}`;
                
                // Skip if already processed (important for multiple selected points)
                if (processedEdges.has(key)) return;
                processedEdges.add(key);
                
                const edge = edgeMapRef.current.get(key);
                if (!edge) return;
                
                // Check visibility settings
                if ((revealProjectionNeighbors && edge.type === 'lowDim') || 
                    (revealOriginalNeighbors && edge.type === 'highDim')) {
                    const edgeId = endpoints.length / 2; // Each edge needs 2 endpoints
                    endpoints.push(
                        { 
                            edgeId, 
                            from: edge.from, 
                            to: edge.to, 
                            x: samplesRef.current[edge.from].x, 
                            y: samplesRef.current[edge.from].y, 
                            type: edge.type, 
                            status: edge.status 
                        },
                        { 
                            edgeId, 
                            from: edge.from, 
                            to: edge.to, 
                            x: samplesRef.current[edge.to].x, 
                            y: samplesRef.current[edge.to].y, 
                            type: edge.type, 
                            status: edge.status 
                        }
                    );
                }
            });
        });
        
        vchartRef.current.updateDataSync('edges', endpoints);
        console.log('[Unified Update] Updated', endpoints.length / 2, 'edges for', edgeSourceIndices.length, 'points');
        
    }, [hoveredIndex, selectedIndices, revealProjectionNeighbors, revealOriginalNeighbors]); // NO epoch dependency - epoch handled in separate effect below!

    /*
    Update edges when epoch changes
    Reads from selectedListener pool for consistency
    This is separate from the unified update to avoid re-applying states unnecessarily
    */
    useEffect(() => {
        if (!vchartRef.current) {
            return;
        }
        
        // Read from the pool (single source of truth)
        const currentSelectedIndices = Array.from(selectedListener.selectedIndices);
        console.log('[Epoch Edge Update] Updating edges for new epoch:', epoch, 'Selected from pool:', currentSelectedIndices);
        
        // Determine which points' edges to show
        let edgeSourceIndices: number[] = [];
        
        if (hoveredIndex !== undefined && hoveredIndex !== -1) {
            edgeSourceIndices = [hoveredIndex];
        } else if (currentSelectedIndices.length > 0) {
            edgeSourceIndices = currentSelectedIndices;
        } else {
            // No hover or selection, clear edges
            vchartRef.current.updateDataSync('edges', []);
            return;
        }
        
        // Build edges with new epoch coordinates
        const endpoints: { edgeId: number, from: number, to: number, x: number, y: number, type: string, status: string }[] = [];
        const processedEdges = new Set<string>();
        
        edgeSourceIndices.forEach(idx => {
            const neighbors = neighborCacheRef.current.get(idx);
            if (!neighbors) return;
            
            neighbors.forEach((toIdx) => {
                const key = `${idx}-${toIdx}`;
                if (processedEdges.has(key)) return;
                processedEdges.add(key);
                
                const edge = edgeMapRef.current.get(key);
                if (!edge) return;
                
                if ((revealProjectionNeighbors && edge.type === 'lowDim') || 
                    (revealOriginalNeighbors && edge.type === 'highDim')) {
                    const edgeId = endpoints.length / 2;
                    endpoints.push(
                        { 
                            edgeId, 
                            from: edge.from, 
                            to: edge.to, 
                            x: samplesRef.current[edge.from].x, 
                            y: samplesRef.current[edge.from].y, 
                            type: edge.type, 
                            status: edge.status 
                        },
                        { 
                            edgeId, 
                            from: edge.from, 
                            to: edge.to, 
                            x: samplesRef.current[edge.to].x, 
                            y: samplesRef.current[edge.to].y, 
                            type: edge.type, 
                            status: edge.status 
                        }
                    );
                }
            });
        });
        
        vchartRef.current.updateDataSync('edges', endpoints);
        console.log('[Epoch Edge Update] Updated', endpoints.length / 2, 'edges for epoch', epoch);
        
    }, [epoch, hoveredIndex, selectedIndices, revealProjectionNeighbors, revealOriginalNeighbors]);


     /*
     Update motion trail
     */
     useEffect(() => {
         if (!vchartRef.current) {
             return;
         }
         if (!showTrail || selectedIndices.length === 0) {
             vchartRef.current.updateDataSync('trails', []);
             return;
         }
         const trailpoints: { trailId: number, x: number, y: number, opacity: number }[] = [];
         const epochId = availableEpochs.indexOf(epoch);
         selectedIndices.forEach(idx => {
             let i;
             for (i = 0; i <= epochId; i += 1) {
                 let epochData = allEpochData[availableEpochs[i]];
                 trailpoints.push({ trailId: idx, x: epochData.projection[idx][0], y: epochData.projection[idx][1], opacity: (i + 1) / (epochId + 1) });
             }
             if (i !== epochId + 1) {
                 let epochData = allEpochData[epoch];
                 trailpoints.push({ trailId: idx, x: epochData.projection[idx][0], y: epochData.projection[idx][1], opacity: 1 });
             }
         });
         vchartRef.current.updateDataSync('trails', trailpoints);
     }, [showTrail, selectedIndices, epoch, availableEpochs, allEpochData]);
    
    /*  
        Update training events 
        NOTE: This should NOT clear the selected pool!
        Training events are separate from user manual selections
    */
    useEffect(() => {
        if (!vchartRef.current || !trainingEvents) {
            return;
        }
        
        const currentEpochIndex = availableEpochs.indexOf(epoch);
        if (currentEpochIndex <= 0) {
            vchartRef.current.updateDataSync('events', []);
            return;
        }
        
        // DO NOT clear selected pool - user selections should persist across epochs
        // selectedListener.clearSelected(); // REMOVED - this was causing the bug!

        // Training events visualization (if needed, handle separately)
        // trainingEvents.forEach((event, index) => {
        //     const sampleIndex = event.index;
        //     if (!selectedListener.checkSelected(sampleIndex)) {
        //         selectedListener.switchSelected(sampleIndex);
        //     }
        //     if (event.type === 'InconsistentMovement') {
        //         if (!selectedListener.checkSelected(event.index1)) {
        //             selectedListener.switchSelected(event.index1);
        //         }
        //     }
        // });
    }, [trainingEvents, epoch, allEpochData, availableEpochs]);
    
    // Cleanup hover timeout on unmount
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
        };
    }, []);

    return <div
        ref={chartRef}
        id="chart"
        style={{
            width: '100%',
            height: '100%',
            margin: 0,
            padding: 0
        }}>
    </div>;
});

export default ChartComponent;
