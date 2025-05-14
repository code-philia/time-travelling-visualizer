// ChartComponent.tsx
import { memo, useEffect, useRef, useState } from 'react';
import VChart from '@visactor/vchart';
import { Edge } from './types';
import { useDefaultStore } from "../../state/state.plotView";
import { createEdges, softmax, transferArray2Color } from './utils';
import { notifyHoveredIndexSwitch, notifySelectedIndicesSwitch } from '../../communication/viewMessage';
const PADDING = 1;

export const ChartComponent = memo(() => {
    const chartRef = useRef<HTMLDivElement>(null);
    const vchartRef = useRef<VChart | null>(null);

    // Here are data from useStore
    const { epoch, allEpochData} = useDefaultStore(["epoch", "allEpochData"]);
    const { inherentLabelData, labelDict, colorDict } = useDefaultStore(["inherentLabelData", "labelDict", "colorDict"]);
    // const { filterValue, filterType } = useDefaultStore(["filterValue", "filterType"]);
    // const { filterState } = useDefaultStore(["filterState"]);
    const { showIndex, showLabel,showBackground, textData } = useDefaultStore(["showIndex", "showLabel", "showBackground","textData"])
    const { availableEpochs } = useDefaultStore(["availableEpochs"]);
    const { revealProjectionNeighbors, revealOriginalNeighbors } = useDefaultStore(["revealProjectionNeighbors", "revealOriginalNeighbors"]);
    const { hoveredIndex, setHoveredIndex, selectedIndices, setSelectedIndices, selectedListener } = useDefaultStore(["hoveredIndex", "setHoveredIndex", "selectedIndices", "setSelectedIndices", "selectedListener"]);
    const { shownData, highlightData, index } = useDefaultStore(["shownData", "highlightData", "index"]);

    const samplesRef = useRef<{ pointId: number, x: number; y: number; label: number; pred: number; label_desc: string; pred_desc: string; confidence: number; textSample: string }[]>([]);
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
        // create data
        const epochData = allEpochData[epoch];
        if (!epochData) {
            return;
        }

        samplesRef.current = [];
        wrongRef.current = [];
        flipRef.current = [];
        let x_min = Infinity, y_min = Infinity, x_max = -Infinity, y_max = -Infinity;

        epochData.projection.map((p, i) => {
            const x = parseFloat(p[0].toFixed(3));
            const y = parseFloat(p[1].toFixed(3));
            let confidence = 1.0;
            let pred = inherentLabelData[i];
            if (epochData.predProbability && epochData.predProbability.length > 0) {
                let props = epochData.predProbability[i];
                let softmaxValues = softmax(props);
                confidence = Math.max(...softmaxValues);
                pred = softmaxValues.indexOf(confidence);
            }

            samplesRef.current.push({
                pointId: i,
                x: x,
                y: y,
                label: inherentLabelData[i],
                label_desc: labelDict.get(inherentLabelData[i]) ?? '',
                pred: pred,
                pred_desc: labelDict.get(pred) ?? labelDict.get(inherentLabelData[i]) ?? '',
                confidence: confidence,
                textSample: textData? textData[i] ?? '': ''
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

            if (x < x_min) x_min = x;
            if (y < y_min) y_min = y;
            if (x > x_max) x_max = x;
            if (y > y_max) y_max = y;
        });
        edgesRef.current = createEdges(epochData.originalNeighbors, epochData.projectionNeighbors, [], []);

        x_min = x_min - PADDING;
        y_min = y_min - PADDING;
        x_max = x_max + PADDING;
        y_max = y_max + PADDING;

        // create spec
        const spec: any = {
            // ================= meta data =================
            type: 'common', // chart type
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
                                    return shownData.some((key) => index[key]?.includes(datum.pointId));
                                }
                            }
                        }
                    ]
                },
                {
                    id: 'edges',
                    values: [] // dynamically set
                },
                {
                     id: 'trails',
                     values: []
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
                            { xx: x_min - 1, yy: y_min - 1 },
                            { xx: x_max + 1, yy: y_min - 1 },
                            { xx: x_max + 1, yy: y_max + 1 },
                            { xx: x_min - 1, yy: y_max + 1 },
                            { xx: x_min - 1, yy: y_min - 1 },
                        ]
                    },
                    xField: 'xx',
                    yField: 'yy',
                    point: {
                        visible: false,
                    },
                    area: {
                        interactive: false,
                        style: {
                            background: () => {
                                return showBackground ? epochData.background : '';
                            },
                            fill: 'transparent',
                            fillOpacity: 0.6
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
                            // lineDash: [2, 2],
                            lineWidth: 3,
                            fillOpacity: 0.5
                        }
                    },
                    point: {
                        visible: true,
                        intereactive: false,
                        style: {
                            fill: 'rgb(149, 147, 147)',
                            // fillOpacity: (datum: { opacity: number }) => {
                            //     return Math.max(0.7, datum.opacity);
                            // },
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
                    id: 'edges-series',
                    type: 'line',
                    dataId: 'edges',
                    seriesField: 'edgeId',
                    xField: 'x',
                    yField: 'y',
                    line: {
                        style: {
                            stroke: (datum: { from: number, to: number, type: string; }) => {
                                if (datum.type === 'sameType') {
                                    return transferArray2Color(colorDict.get(samplesRef.current[datum.from].label), 0.6);
                                }
                                else {
                                    return transferArray2Color(colorDict.get(samplesRef.current[datum.to].label), 0.6);
                                }
                            },
                            lineDash: (datum: { status: string; }) => {
                                if (datum.status == 'maintain') {
                                    return [0, 0];
                                }
                                else if (datum.status == 'connect') {
                                    return [0, 0];
                                }
                                else if (datum.status == 'disconnect') {
                                    return [2, 4];
                                }
                                return [0, 0];
                            },
                            lineWidth: (datum: { status: string; }) => {
                                if (datum.status == 'maintain') {
                                    return 0.8;
                                }
                                else if (datum.status == 'connect') {
                                    return 0.8;
                                }
                                else if (datum.status == 'disconnect') {
                                    return 0.8;
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
                            fill: (datum: { label: number; }) => {
                                const color = colorDict.get(datum.label) ?? [0, 0, 0];
                                return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
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
                                else if (highlightData.includes('prediction_flip') && flipRef.current.includes(datum.pointId)) {
                                    return {
                                        distance: 1.3,
                                        lineWidth: 1.5,
                                        stroke: 'rgba(254, 121, 61,0.75)'
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
                    min: y_min,
                    max: y_max,
                    type: 'linear',
                    grid: { visible: false }
                },
                {
                    visible: false,
                    orient: 'bottom',
                    min: x_min,
                    max: x_max,
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
    }, [epoch, allEpochData, showIndex, showLabel, showBackground, shownData, highlightData, index, availableEpochs]);


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
            if (edge.from === hoveredIndex || selectedIndices.includes(edge.from)) {
                if ((revealProjectionNeighbors && edge.type === 'lowDim') || (revealOriginalNeighbors && edge.type === 'highDim')) {
                    endpoints.push({ edgeId: index, from: edge.from, to: edge.to, x: samplesRef.current[edge.from].x, y: samplesRef.current[edge.from].y, type: edge.type, status: edge.status });
                    endpoints.push({ edgeId: index, from: edge.from, to: edge.to, x: samplesRef.current[edge.to].x, y: samplesRef.current[edge.to].y, type: edge.type, status: edge.status });
                }
            }
        });
        vchartRef.current?.updateDataSync('edges', endpoints);

    }, [revealProjectionNeighbors, revealOriginalNeighbors, hoveredIndex,selectedIndices]);


     /*
     Update motion trail
     */
     useEffect(() => {
         if (!vchartRef.current) {
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
     }, [selectedIndices, epoch, availableEpochs, allEpochData]);

    return <div
        ref={chartRef}
        id="chart"
        style={{
            width: '100%',
            height: '100%'
        }}>
    </div>;
});

export default ChartComponent;
