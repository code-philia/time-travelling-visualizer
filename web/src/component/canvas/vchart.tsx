// ChartComponent.tsx
import { memo, useEffect, useRef, useState } from 'react';
import VChart from '@visactor/vchart';
import { Edge, VChartData } from './types';
import { useDefaultStore } from "../../state/state-store";
import { convexHull, createEdges, softmax } from './utils';
const PADDING = 1;
const THRESHOLD = 0.9;

type SampleTag = {
    num: number;
    title: string;
}

export const ChartComponent = memo(({ vchartData }: { vchartData: VChartData | null }) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const vchartRef = useRef<VChart | null>(null);

    // Here are data from useStore
    const { labelDict, colorDict } = useDefaultStore(["labelDict", "colorDict"]);
    const { filterValue, filterType } = useDefaultStore(["filterValue", "filterType"]);
    const { filterState } = useDefaultStore(["filterState"]);
    const { showMetadata, showBgimg } = useDefaultStore(["showMetadata", "showBgimg"]);
    const { showNumber, showText, textData } = useDefaultStore(["showNumber", "showText", "textData"])
    const { neighborSameType, neighborCrossType, lastNeighborSameType, lastNeighborCrossType } = useDefaultStore(["neighborSameType", "neighborCrossType", "lastNeighborSameType", "lastNeighborCrossType"]);
    const { revealNeighborCrossType, revealNeighborSameType } = useDefaultStore(["revealNeighborCrossType", "revealNeighborSameType"]);
    const { hoveredIndex, setHoveredIndex } = useDefaultStore(["hoveredIndex", "setHoveredIndex"]);
    const { highlightContext, setHighlightContext } = useDefaultStore(["highlightContext", "setHighlightContext"]);

    const samplesRef = useRef<{ pointId: number, x: number; y: number; label: number; pred: number; label_desc: string; pred_desc: string; confidence: number; textSample: string }[]>([]);
    const edgesRef = useRef<Edge[]>([]);

    const [selectedItems, setSelectedItems] = useState<SampleTag[]>([]);


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
    }, [vchartData]);


    /*
        Main update logic
    */
    useEffect(() => {
        if (!chartRef.current) {
            return;
        }

        // create data
        samplesRef.current = [];
        let x_min = Infinity, y_min = Infinity, x_max = -Infinity, y_max = -Infinity;

        vchartData?.positions.map((p, i) => {
            const x = parseFloat(p[0].toFixed(3));
            const y = parseFloat(p[1].toFixed(3));
            let confidence = 1.0;
            let pred = vchartData?.labels[i];
            if (vchartData?.predictionProps && vchartData.predictionProps.length > 0) {
                let props = vchartData.predictionProps[i];
                let softmaxValues = softmax(props);
                confidence = Math.max(...softmaxValues);
                pred = softmaxValues.indexOf(confidence);
            }

            samplesRef.current.push({
                pointId: i,
                x: x,
                y: y,
                label: vchartData?.labels[i],
                label_desc: labelDict.get(vchartData?.labels[i]) ?? '',
                pred: pred,
                pred_desc: labelDict.get(pred) ?? labelDict.get(vchartData?.labels[i]) ?? '',
                confidence: confidence,
                textSample: textData[i] ?? ''
            });

            if (x < x_min) x_min = x;
            if (y < y_min) y_min = y;
            if (x > x_max) x_max = x;
            if (y > y_max) y_max = y;
        });
        edgesRef.current = createEdges(neighborSameType, neighborCrossType, lastNeighborSameType, lastNeighborCrossType);

        x_min = x_min - PADDING;
        y_min = y_min - PADDING;
        x_max = x_max + PADDING;
        y_max = y_max + PADDING;

        // create spec
        const spec = {
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
                    values: [] // dynamically set
                },
                {
                    id: 'regions',
                    values: [] // dynamically set
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
                            fill: 'white',
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
                    id: 'regions-series',
                    interactive: false,
                    stack: false,
                    type: 'area',
                    dataId: 'regions',
                    xField: 'xx',
                    yField: 'yy',
                    seriesField: 'class',
                    point: {
                        visible: false,
                    },
                    line: {
                        interactive: false,
                        visible: false,
                        style: {
                            curveType: 'catmullRomClosed',
                        }
                    },
                    area: {
                        interactive: false,
                        style: {
                            fill: (datum: { class: number }) => {
                                const color = colorDict.get(datum.class) ?? [0, 0, 0];
                                return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
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
                            stroke: (datum: { status: string; }) => {
                                if (datum.status == 'maintain') {
                                    return 'rgb(113, 113, 113)';
                                }
                                else if (datum.status == 'connect') {
                                    return 'rgb(94, 242, 121)';
                                }
                                else if (datum.status == 'disconnect') {
                                    return 'rgb(242, 129, 129)';
                                }
                                return 'rgb(113, 113, 113)';
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
                                    return 1;
                                }
                                else if (datum.status == 'connect') {
                                    return 1;
                                }
                                else if (datum.status == 'disconnect') {
                                    return 1;
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
                            size: 5,
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

                                fill: (datum: { label: number; }) => {
                                    const color = colorDict.get(datum.label) ?? [0, 0, 0];
                                    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                                },
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
            vchartRef.current.on('click', { id: 'point-series' }, e => {
                console.log('Clicked: ', e.datum?.pointId);
                if (highlightContext.lockedIndices.has(e.datum?.pointId)) {
                    highlightContext.removeLocked(e.datum?.pointId);
                } else {
                    highlightContext.addLocked(e.datum?.pointId);
                }
                // setHighlightContext(highlightContext);
            });
        }
        else {
            vchartRef.current.updateSpec(spec);
        }

        vchartRef.current.renderSync();
    }, [vchartData, filterState, showMetadata, showNumber, showText]);


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
    Highlight locked points
    */
    useEffect(() => {
        if (!vchartRef.current) {
            return;
        }
        console.log('Locked: ', highlightContext.lockedIndices);
        updateHighlight();
    }, [vchartData, highlightContext, hoveredIndex]);

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

    }, [revealNeighborCrossType, revealNeighborSameType, hoveredIndex, highlightContext, vchartData]);

    /*
        Show classification border
        triggered by showBgimg
    */
    useEffect(() => {
        if (!vchartRef.current) {
            return;
        }
        if (!showBgimg) {
            vchartRef.current?.updateDataSync('regions', []);
            return;
        }

        let filteredPoints: { [key: number]: number[][] } = {};
        vchartData?.positions.map((p, i) => {
            const x = parseFloat(p[0].toFixed(3));
            const y = parseFloat(p[1].toFixed(3));
            let confidence = 1.0;
            let pred = vchartData?.labels[i];
            if (vchartData?.predictionProps && vchartData.predictionProps.length > 0) {
                let props = vchartData.predictionProps[i];
                let softmaxValues = softmax(props);
                confidence = Math.max(...softmaxValues);
                pred = softmaxValues.indexOf(confidence);
            }
            if (confidence >= THRESHOLD) {
                if (!filteredPoints[pred]) {
                    filteredPoints[pred] = [];
                }
                filteredPoints[pred].push([x, y]);
            }
        });

        let convexHulls: { [key: number]: number[][] } = {};
        for (const key in filteredPoints) {
            if (filteredPoints.hasOwnProperty(key)) {
                convexHulls[key] = convexHull(filteredPoints[key]);
            }
        }

        let region: { xx: number, yy: number, class: number }[] = [];
        for (const key in convexHulls) {
            if (convexHulls.hasOwnProperty(key)) {
                convexHulls[key].forEach((point, _) => {
                    region.push({ xx: point[0], yy: point[1], class: parseInt(key) });
                });
            }
        }
        vchartRef.current.updateData('regions', region);

    }, [showBgimg, filterState, showMetadata, showNumber, showText, vchartData]);


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
