// ChartComponent.tsx
import { memo, useEffect, useRef } from 'react';
import VChart from '@visactor/vchart';
import { Edge } from './types';
import { useDefaultStore } from "../state/state.plotView";
import { createEdges, softmax, transferArray2Color } from './utils';
import { notifyHoveredIndexSwitch, notifySelectedIndicesSwitch } from '../communication/viewMessage';
const BACKGROUND_PADDING = 0.5;

export const ChartComponent = memo(() => {
    const chartRef = useRef<HTMLDivElement>(null);
    const vchartRef = useRef<VChart | null>(null);

    // Here are data from useStore
    const { epoch, allEpochData, alignment} = useDefaultStore(["epoch", "allEpochData", "alignment"]);
    const { inherentLabelData, labelDict, colorDict } = useDefaultStore(["inherentLabelData", "labelDict", "colorDict"]);
    // const { filterValue, filterType } = useDefaultStore(["filterValue", "filterType"]);
    // const { filterState } = useDefaultStore(["filterState"]);
    const { showIndex, showLabel,showBackground, showTrail, textData } = useDefaultStore(["showIndex", "showLabel", "showBackground","showTrail","textData"])
    const { availableEpochs } = useDefaultStore(["availableEpochs"]);
    const { scope } = useDefaultStore(["scope"]);
    const { revealProjectionNeighbors, revealOriginalNeighbors } = useDefaultStore(["revealProjectionNeighbors", "revealOriginalNeighbors"]);
    const { hoveredIndex, setHoveredIndex, selectedIndices, setSelectedIndices, selectedListener } = useDefaultStore(["hoveredIndex", "setHoveredIndex", "selectedIndices", "setSelectedIndices", "selectedListener"]);
    const { shownData, highlightData, index } = useDefaultStore(["shownData", "highlightData", "index"]);

    const { isFocusMode, focusIndices } = useDefaultStore(["isFocusMode", "focusIndices"]);
    const { trainingEvents } = useDefaultStore(["trainingEvents"]);

    const samplesRef = useRef<{ pointId: number, x: number; y: number; label: number; pred: number; label_desc: string; pred_desc: string; confidence: number; textSample: string; groupColor?: string}[]>([]);
    const edgesRef = useRef<Edge[]>([]);
    const wrongRef = useRef<number[]>([]);
    const flipRef = useRef<number[]>([]);

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

    /*
        Main update logic
    */
    useEffect(() => {
        if (!chartRef.current) {
            return;
        }

        const epochData = allEpochData[epoch];
        if (!epochData) {
            return;
        }

        samplesRef.current = [];
        wrongRef.current = [];
        flipRef.current = [];
        let x_min = scope[0], y_min = scope[1], x_max = scope[2], y_max = scope[3];

        const groupColors = ["#ff595e","#1982c4","#8ac926","#ff924c","#ffca3a","#52a675","#36949d","#4267ac","#6a4c93","#b5a6c9"];

        const tokenToGroup = new Map<number, number>();
        (alignment || []).forEach((group, gIdx) => {
            group.forEach(tokenIdx => tokenToGroup.set(tokenIdx, gIdx));
        });

        epochData.projection.forEach((p, i) => {
            const x = parseFloat(p[0].toFixed(3));
            const y = parseFloat(p[1].toFixed(3));
            let confidence = 1.0;
            let pred = inherentLabelData[i];
            if (epochData.predProbability && epochData.predProbability.length > 0) {
                const softmaxValues = softmax(epochData.predProbability[i]);
                confidence = Math.max(...softmaxValues);
                pred = softmaxValues.indexOf(confidence);
            }

            const groupIdx = tokenToGroup.get(i);
            const groupColor = groupIdx !== undefined ? groupColors[groupIdx] : undefined;

            samplesRef.current.push({
                pointId: i,
                x: x,
                y: y,
                label: inherentLabelData[i],
                label_desc: labelDict.get(inherentLabelData[i]) ?? '',
                pred: pred,
                pred_desc: labelDict.get(pred) ?? labelDict.get(inherentLabelData[i]) ?? '',
                confidence,
                textSample: textData ? textData[i] ?? '' : '',
                groupColor,
            });

            if (pred !== inherentLabelData[i]) {
                wrongRef.current.push(i);
            }
            const epochId = availableEpochs.indexOf(epoch);
            if (epochId > 0 && epochData.predProbability && epochData.predProbability.length > 0) {
                const lastEpochData = allEpochData[availableEpochs[epochId - 1]];
                if (lastEpochData.prediction[i] !== pred) {
                    flipRef.current.push(i);
                }
            }
        });
        edgesRef.current = createEdges(epochData.originalNeighbors, epochData.projectionNeighbors, [], []);

        // create spec
        const spec: any = {
            // ================= meta data =================
            type: 'common', // chart type
            padding: 0,
            animation: false,
            data: [
                {
                    id: 'points',
                    values: samplesRef.current,
                    transforms: [
                        {
                            type: 'filter',
                            options: {
                                // callback: (datum: { label_desc: string; pred_desc: string; }) => {
                                //     if (filterState) {
                                //         const filterValues = filterValue.split(',').map(value => value.trim());
                                //         if (filterType === 'label') {
                                //             return filterValues.includes(datum.label_desc);
                                //         } else if (filterType === 'prediction') {
                                //             return filterValues.includes(datum.pred_desc);
                                //         }
                                //     }
                                //     return true;
                                // }
                                callback: (datum: { pointId: number; }) => {
                                    let includeByIndexFile= shownData.some((key) => index[key]?.includes(datum.pointId));
                                    let includeByFocus = isFocusMode ? focusIndices.includes(datum.pointId) : true;
                                    return includeByIndexFile && includeByFocus;
                                }
                            }
                        }
                    ]
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
                                // fontStyle: 'italic',
                                // fontWeight: 'bold',
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

            // ================= axes =================
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
        if (!vchartRef.current) {
            const vchart = new VChart(spec, { dom: chartRef.current });
            vchartRef.current = vchart;

            vchartRef.current.on('pointerover', { id: 'point-series' }, (e) => {
                setHoveredIndex(e.datum?.pointId);
                notifyHoveredIndexSwitch(e.datum?.pointId);
            });
            vchartRef.current.on('pointerout', { id: 'point-series' }, () => {
                setHoveredIndex(undefined);
                notifyHoveredIndexSwitch(undefined);
            });
            vchartRef.current.on('click', { id: 'point-series' }, (e) => {
                const pointId = e.datum?.pointId;
                selectedListener.switchSelected(pointId);
            });
        }
        else {
            vchartRef.current.updateSpec(spec);
        }
        vchartRef.current.renderSync();
    }, [epoch, allEpochData, showIndex, showLabel, showBackground, shownData, highlightData, index, availableEpochs, isFocusMode, focusIndices, alignment]);


    /*
    Highlight locked points
    */
    useEffect(() => {
        if (!vchartRef.current) {
            return;
        }

        if (selectedIndices.length === 0 && hoveredIndex === -1) {
            vchartRef.current?.updateState({
                locked: {
                    filter: () => {
                        return false;
                    }
                },
                as_neighbor: {
                    filter: () => {
                        return false;
                    }
                }
            });
            return;
        }

        const selectedNeighbors: number[] = [];
        edgesRef.current.forEach((edge, _) => {
            if (edge.from == hoveredIndex || selectedIndices.includes(edge.from)) {
                selectedNeighbors.push(edge.to);
            }
        });
        vchartRef.current?.updateState({
            as_neighbor: {
                filter: (datum) => {
                    return selectedNeighbors.includes(datum.pointId);
                }
            }
        });

        vchartRef.current?.updateState({
            locked: {
                filter: (datum) => {
                    return selectedIndices.includes(datum.pointId);
                }
            }
        });
    }, [epoch, allEpochData, hoveredIndex, selectedIndices]);

    /*
        Show neighborhood relationship
    */
    useEffect(() => {
        if (!vchartRef.current) {
            return;
        }

        const endpoints: { edgeId: number, from: number, to: number, x: number, y: number, type: string, status: string }[] = [];
        edgesRef.current.forEach((edge, index) => {
            if (edge.from === hoveredIndex) {
                if ((revealProjectionNeighbors && edge.type === 'lowDim') || (revealOriginalNeighbors && edge.type === 'highDim')) {
                    endpoints.push({ edgeId: index, from: edge.from, to: edge.to, x: samplesRef.current[edge.from].x, y: samplesRef.current[edge.from].y, type: edge.type, status: edge.status });
                    endpoints.push({ edgeId: index, from: edge.from, to: edge.to, x: samplesRef.current[edge.to].x, y: samplesRef.current[edge.to].y, type: edge.type, status: edge.status });
                }
            }
        });
        vchartRef.current?.updateDataSync('edges', endpoints);

    }, [revealProjectionNeighbors, revealOriginalNeighbors, hoveredIndex]);


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
        
        selectedListener.clearSelected();

        trainingEvents.forEach((event, index) => {
            const sampleIndex = event.index;
            if (!selectedListener.checkSelected(sampleIndex)) {
                selectedListener.switchSelected(sampleIndex);
            }
            if (event.type === 'InconsistentMovement') {
                if (!selectedListener.checkSelected(event.index1)) {
                    selectedListener.switchSelected(event.index1);
                }
            }
        });
    }, [trainingEvents, epoch, allEpochData, availableEpochs]);

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
