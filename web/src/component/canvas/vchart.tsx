// ChartComponent.tsx
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import VChart from '@visactor/vchart';
import { Edge } from './types';
import { useDefaultStore } from "../../state/store";
import { createEdges, softmax } from './utils';
import { BriefProjectionResult } from '../../communication/api';
const CANVAS_HEIGHT = 600;
const CANVAS_WIDTH = 800;

type SampleTag = {
    num: number;
    title: string;
}

export const ChartComponent = memo(() => {
    const chartRef = useRef<HTMLDivElement>(null);
    const vchartRef = useRef<VChart | null>(null);

    // data
    const { epoch, allEpochsProjectionData } = useDefaultStore(["epoch", "allEpochsProjectionData"]);
    const { labelDict, colorDict, textData } = useDefaultStore(["labelDict", "colorDict", "textData"]);
    const { filterValue, filterType } = useDefaultStore(["filterValue", "filterType"]);
    const { neighborSameType, neighborCrossType, lastNeighborSameType, lastNeighborCrossType } = useDefaultStore(["neighborSameType", "neighborCrossType", "lastNeighborSameType", "lastNeighborCrossType"]);
    const { hoveredIndex, setHoveredIndex } = useDefaultStore(["hoveredIndex", "setHoveredIndex"]);
    const { highlightContext, setHighlightContext } = useDefaultStore(["highlightContext", "setHighlightContext"]);
    const { allBackground, predictionProps } = useDefaultStore(["allBackground", "predictionProps"]);

    // settings
    const { showMetadata, showBgimg } = useDefaultStore(["showMetadata", "showBgimg"]);
    const { showNumber, showText } = useDefaultStore(["showNumber", "showText"])
    const { filterState } = useDefaultStore(["filterState"]);
    const { revealNeighborCrossType, revealNeighborSameType } = useDefaultStore(["revealNeighborCrossType", "revealNeighborSameType"]);

    const [selectedItems, setSelectedItems] = useState<SampleTag[]>([]);

    // temp data
    const samplesRef = useRef<{ pointId: number, x: number; y: number; label: number; pred: number; label_desc: string; pred_desc: string; confidence: number; textSample: string }[]>([]);
    const edgesRef = useRef<Edge[]>([]);
    const bgimgRef = useRef<String>();
    const currentEpochData = useMemo(() => allEpochsProjectionData[epoch] as BriefProjectionResult | undefined, [allEpochsProjectionData, epoch]);

    const positions: [number, number][] = [];
    const labels: number[] = [];
    const colors: [number, number, number][] = [];
    const background = allBackground[epoch] ?? "";
    if (currentEpochData) {
        const labelsAsNumber = currentEpochData.labels.map((label) => parseInt(label));
        currentEpochData.proj.forEach((point, i) => {
            positions.push([point[0], point[1]]);
            labels.push(labelsAsNumber[i]);
            const color = colorDict.get(labelsAsNumber[i]);
            if (color === undefined) {
                colors[i] = ([0, 0, 0]);
            }
            else {
                colors[i] = ([color[0] / 255, color[1] / 255, color[2] / 255]);
            }
        });
    }
    let [x_min, y_min, x_max, y_max] = currentEpochData?.scale ?? [-10, -10, 10, 10];

    useEffect(() => {
        const listener = () => {
            const tokens = textData;
            setSelectedItems(Array.from(highlightContext.lockedIndices).map((num) => ({
                num,
                title: tokens[num]!
            })));
        };

        listener();
        highlightContext.addHighlightChangedListener(listener);
        return () => {
            highlightContext.removeHighlightChangedListener(listener);
        };
    }, [currentEpochData]);

    /*
        Main update logic
    */
    useEffect(() => {
        if (!chartRef.current) {
            return;
        }

        // create data
        samplesRef.current = [];

        positions.map((p, i) => {
            const x = parseFloat(p[0].toFixed(3));
            const y = parseFloat(p[1].toFixed(3));
            let confidence = 1.0;
            let pred = labels[i];
            if (predictionProps && predictionProps.length > 0) {
                let props = predictionProps[i];
                let softmaxValues = softmax(props);
                confidence = Math.max(...softmaxValues);
                pred = softmaxValues.indexOf(confidence);
            }

            samplesRef.current.push({
                pointId: i,
                x: x,
                y: y,
                label: labels[i],
                label_desc: labelDict.get(labels[i]) ?? '',
                pred: pred,
                pred_desc: labelDict.get(pred) ?? labelDict.get(labels[i]) ?? '',
                confidence: confidence,
                textSample: textData[i] ?? ''
            });
        });
        edgesRef.current = createEdges(neighborSameType, neighborCrossType, lastNeighborSameType, lastNeighborCrossType);

        if (!showBgimg) {
            bgimgRef.current = '<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg" version="1.1"> <rect width="800" height="600" fill="white" /></svg>';
        }
        else {
            bgimgRef.current = background;
        }

        // create spec
        const spec = {
            // ================= meta data =================
            type: 'common', // chart type
            animation: false,

            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,

            padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            },

            data: [
                {
                    id: 'points',
                    values: samplesRef.current,
                    transforms: [
                        {
                            type: 'filter',
                            options: {
                                callback: (datum: { label_desc: string; pred_desc: string; }) => {
                                    if (filterState) {
                                        const filterValues = filterValue.split(',').map(value => value.trim());
                                        if (filterType === 'label') {
                                            return filterValues.includes(datum.label_desc);
                                        } else if (filterType === 'prediction') {
                                            return filterValues.includes(datum.pred_desc);
                                        }
                                    }
                                    return true;
                                }
                            }
                        }
                    ]
                },
                {
                    id: 'edges',
                    values: edgesRef.current
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
                            { xx: x_min, yy: y_min },
                            { xx: x_max, yy: y_min },
                            { xx: x_max, yy: y_max },
                            { xx: x_min, yy: y_max },
                            { xx: x_min, yy: y_min },
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
                            background: bgimgRef.current,
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
                    id: 'edges-series',
                    type: 'line',
                    dataId: 'edges',
                    seriesField: 'edgeId',
                    xField: 'x',
                    yField: 'y',
                    line: {
                        style: {
                            stroke: (datum: { status: string; }) => {
                                if (datum.status == 'maintain') {
                                    return 'rgb(175, 173, 173)';
                                }
                                else if (datum.status == 'connect') {
                                    return 'rgb(47, 250, 84)';
                                }
                                else if (datum.status == 'disconnect') {
                                    return 'rgb(250, 58, 58)';
                                }
                                return 'rgb(175, 173, 173)';
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
                                    return 0.5;
                                }
                                else if (datum.status == 'connect') {
                                    return 1.5;
                                }
                                else if (datum.status == 'disconnect') {
                                    return 1.5;
                                }
                                return 1;
                            },
                            fillOpacity: 0.4
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
                            }
                        }
                    },
                    label: [
                        {
                            visible: true,
                            style: {
                                visible: () => {
                                    return showNumber || showText;
                                },
                                type: 'text',
                                fontFamily: 'Console',
                                fontStyle: 'italic',
                                // fontWeight: 'bold',
                                text: (datum: { pointId: any; textSample: string; label: number; }) => {
                                    if (showText && showNumber) {
                                        return `${datum.pointId}.${datum.textSample == '' ? labelDict.get(datum.label) : datum.textSample}`;
                                    }
                                    else if (showText) {
                                        return datum.textSample == '' ? labelDict.get(datum.label) : datum.textSample;
                                    }
                                    else if (showNumber) {
                                        return `${datum.pointId}`;
                                    }
                                },
                                fill: 'black',
                                // fill: (datum: { label: number; }) => {
                                //     const color = colorDict.get(datum.label) ?? [0, 0, 0];
                                //     return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                                // },
                                fillOpacity: 0.6
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

                    // style
                    showBackgroundChart: false,
                    startHandler: {
                        style: {
                            fill: 'rgb(22,119,255)',
                            symbolType: 'diamond',
                            size: 5,
                        }
                    },
                    endHandler: {
                        style: {
                            fill: 'rgb(22,119,255)',
                            symbolType: 'diamond',
                            size: 5,
                        }
                    },
                    background: {
                        size: 1,
                        style: {
                            cornerRadius: 20
                        }
                    },
                    selectedBackground: {
                        style: {
                            fill: 'rgb(215, 217, 220)',
                            fillOpacity: 0.5
                        }
                    },

                    // func
                    roamZoom: {
                        enable: true,
                        focus: true,
                        rate: 5
                    },
                    roamDrag: {
                        enable: true,
                        reverse: true,
                        rate: 1
                    }
                },
                {
                    visible: false,
                    orient: 'bottom',
                    filterMode: 'axis',
                    showDetail: false,

                    // style
                    showBackgroundChart: false,
                    startHandler: {
                        style: {
                            fill: 'rgb(22,119,255)',
                            symbolType: 'diamond',
                            size: 5,
                        }
                    },
                    endHandler: {
                        style: {
                            fill: 'rgb(22,119,255)',
                            symbolType: 'diamond',
                            size: 5,
                        }
                    },
                    background: {
                        size: 1,
                        style: {
                            cornerRadius: 20
                        }
                    },
                    selectedBackground: {
                        style: {
                            fill: 'rgb(215, 217, 220)',
                            fillOpacity: 0.5
                        }
                    },

                    // func
                    roamZoom: {
                        enable: true,
                        focus: true,
                        rate: 5
                    },
                    roamDrag: {
                        enable: true,
                        reverse: true,
                        rate: 1
                    },
                }
            ],
            legends: [
                {
                    seriesId: 'point-series',
                    visible: false,
                    orient: 'right',
                    position: 'start',
                    data: (items: any[]) => {
                        return items.map(item => {
                            item.shape.outerBorder = {
                                stroke: item.shape.fill,
                                distance: 2,
                                lineWidth: 1
                            };
                            item.value = labelDict.get(item.label);
                            return item;
                        });
                    },
                    title: {
                        visible: true,
                        align: 'left',
                        textStyle: {
                            text: 'Classes',
                            fontFamily: 'SimHei',
                            fontSize: 18,
                            fontWeight: 'bold'
                        }
                    },
                    item: {
                        visible: true,
                        width: '8%',
                        value: {
                            alignRight: true,
                            style: {
                                fill: '#000',
                                fillOpacity: 1,
                                fontSize: 12
                            },
                            state: {
                                unselected: {
                                    fill: '#d8d8d8'
                                }
                            }
                        }
                    }
                }
            ],

            tooltip: {
                seriesId: 'point-series',
                lockAfterClick: false,
                visible: showMetadata,
                activeType: 'mark',
                trigger: 'hover',
                mark: {
                    title: {
                        visiable: true,
                        value: 'Info'
                    },
                    content: [
                        {
                            key: 'Label',
                            value: (datum: { label_desc: string; }) => datum.label_desc,
                            shapeType: 'circle',
                            shapeSize: 8
                        },
                        {
                            key: 'Prediction',
                            value: (datum: { pred_desc: string }) => datum.pred_desc,
                            shapeType: 'circle',
                            shapeSize: 8,
                            shapeFill: (datum: { pred: number }) => {
                                const color = colorDict.get(datum.pred) ?? [0, 0, 0];
                                return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                            }
                        },
                        {
                            key: 'Confidance',
                            value: (datum: { confidence: number }) => `${datum.confidence.toFixed(2)}`,
                            shapeType: 'square',
                            shapeSize: 8,
                            shapeHollow: false,
                            shapeFill: (datum: { label: number, pred: number }) => {
                                if (datum.label == datum.pred) {
                                    return 'rgb(20, 227, 58)';
                                }
                                else {
                                    return 'rgb(255, 0, 0)';
                                }
                            }
                        }
                    ]
                },
                style: {
                    fillOpacity: () => {
                        if (showMetadata) {
                            return 1;
                        }
                        else {
                            return 0;
                        }
                    },
                    panel: {
                        padding: {
                            top: 10,
                            bottom: 15,
                            left: 10,
                            right: 10
                        },
                        backgroundColor: '#fff',
                        border: {
                            color: '#eee',
                            width: 1,
                            radius: 10
                        },
                        shadow: {
                            x: 0,
                            y: 0,
                            blur: 10,
                            spread: 5,
                            color: '#eee'
                        }
                    },
                    titleLabel: {
                        fontSize: 20,
                        fontFamily: 'Times New Roman',
                        fill: 'brown',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        lineHeight: 24
                    },
                    keyLabel: {
                        fontSize: 16,
                        fontFamily: 'Times New Roman',
                        fill: 'black',
                        textAlign: 'center',
                        lineHeight: 15,
                        spacing: 10
                    },
                    valueLabel: {
                        fontSize: 14,
                        fill: 'black',
                        textAlign: 'center',
                        lineHeight: 15,
                        spacing: 10
                    }
                }
            },
            direction: 'horizontal'
        };

        // create or update vchart
        if (!vchartRef.current) {
            const vchart = new VChart(spec, { dom: chartRef.current });
            vchartRef.current = vchart;

            vchartRef.current.on('pointerover', { id: 'point-series' }, e => {
                setHoveredIndex(e.datum?.pointId);
            });
            vchartRef.current.on('pointerout', { id: 'point-series' }, e => {
                setHoveredIndex(-1);
            });

            // TODO handle click event to lock
            vchartRef.current.on('click', { id: 'point-series' }, e => {
                console.log('Clicked: ', e.datum?.pointId);
                if (highlightContext.lockedIndices.has(e.datum?.pointId)) {
                    highlightContext.removeLocked(e.datum?.pointId);
                } else {
                    highlightContext.addLocked(e.datum?.pointId);
                }
                setHighlightContext(highlightContext);
            });
        }
        else {
            vchartRef.current.updateSpec(spec);
        }

        vchartRef.current.renderSync();
    }, [currentEpochData, filterState, showMetadata, showBgimg, showNumber, showText]);


    /*
    Highlight locked points
    */
    useEffect(() => {
        if (!vchartRef.current) {
            return;
        }
        updateHighlight();
    }, [highlightContext, hoveredIndex]);

    function updateHighlight() {
        if (highlightContext.lockedIndices.size === 0 && hoveredIndex === -1) {
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
            if (edge.from == hoveredIndex || highlightContext.lockedIndices.has(edge.from)) {
                selectedNeighbors.push(edge.to);
            }
            if (edge.to == hoveredIndex || highlightContext.lockedIndices.has(edge.to)) {
                selectedNeighbors.push(edge.from);
            }
        });
        vchartRef.current?.updateState({
            as_neighbor: {
                filter: datum => {
                    return selectedNeighbors.includes(datum.pointId);
                }
            }
        });

        vchartRef.current?.updateState({
            locked: {
                filter: datum => {
                    return highlightContext.lockedIndices.has(datum.pointId);
                }
            }
        });
    }

    /*
        Show neighborhood relationship
    */
    useEffect(() => {
        if (!vchartRef.current) {
            return;
        }

        const endpoints: { edgeId: number, from: number, to: number, x: number, y: number, type: string, status: string }[] = [];
        edgesRef.current.forEach((edge, index) => {
            if (edge.from === hoveredIndex || edge.to === hoveredIndex || highlightContext.lockedIndices.has(edge.from) || highlightContext.lockedIndices.has(edge.to)) {
                if ((revealNeighborCrossType && edge.type === 'crossType') || (revealNeighborSameType && edge.type === 'sameType')) {
                    endpoints.push({ edgeId: index, from: edge.from, to: edge.to, x: samplesRef.current[edge.from].x, y: samplesRef.current[edge.from].y, type: edge.type, status: edge.status });
                    endpoints.push({ edgeId: index, from: edge.from, to: edge.to, x: samplesRef.current[edge.to].x, y: samplesRef.current[edge.to].y, type: edge.type, status: edge.status });
                }
            }
        });
        vchartRef.current?.updateDataSync('edges', endpoints);

    }, [revealNeighborCrossType, revealNeighborSameType, hoveredIndex, highlightContext]);

    return <div
        ref={chartRef}
        id="chart"
        style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT
        }}>
    </div>;
});

export default ChartComponent;
