// ChartComponent.tsx
import { memo, useEffect, useRef } from 'react';
import VChart from '@visactor/vchart';
import { VChartData, Edge } from './types';
import { useDefaultStore } from "../../state/store";
const PADDING = 1;


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

    /*
        Main update logic
    */
    useEffect(() => {
        if (!chartRef.current) {
            return;
        }

        // create data
        let samples: { pointId: number, x: number; y: number; label: number; pred: number; label_desc: string; pred_desc: string; confidence: number; textSample: string }[] = []
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

            samples.push({
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

        if (Array.isArray(vchartData?.scale) && vchartData?.scale.length > 0) {
            x_min = vchartData?.scale[0];
            y_min = vchartData?.scale[1];
            x_max = vchartData?.scale[2];
            y_max = vchartData?.scale[3];
        }
        else {
            x_min = x_min - PADDING;
            y_min = y_min - PADDING;
            x_max = x_max + PADDING;
            y_max = y_max + PADDING;
        }

        const bgimg = showBgimg ? vchartData?.bgimg : 'rgb(255, 255, 255)';

        // create spec
        const spec = {
            // ================= meta data =================
            type: 'common', // chart type
            data: [
                {
                    id: 'points',
                    values: samples,
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
                            }
                        },
                        style: {
                            size: 10,
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
                }
            ],

            // ================= background =================
            // TODO
            background: {
                image: bgimg,
            },

            // ================= axes =================
            axes: [
                {
                    orient: 'left',
                    min: y_min,
                    max: y_max,
                    type: 'linear',
                    grid: { visible: true }
                },
                {
                    orient: 'bottom',
                    min: x_min,
                    max: x_max,
                    type: 'linear',
                    grid: { visible: true }
                }
            ],
            dataZoom: [
                {
                    visible: true,
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
                    visible: true,
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
                    visible: true,
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
        }
        else {
            vchartRef.current.updateSpec(spec);
        }

        vchartRef.current.renderSync();
    }, [vchartData, filterState, showBgimg, showMetadata, showNumber, showText]);

    /*
        Highlight neighbor points
        triggered by hoveredIndex changed
    */
    useEffect(() => {
        if (!vchartRef.current) {
            return;
        }

        if (hoveredIndex === -1) {
            vchartRef.current?.updateState({
                as_neighbor: {
                    filter: () => {
                        return false;
                    }
                }
            });
            return;
        }

        // create data
        let samples: { pointId: number, x: number; y: number; label: number; pred: number; label_desc: string; pred_desc: string; confidence: number; textSample: string }[] = []
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

            samples.push({
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
        });

        const edges = createEdges(neighborSameType, neighborCrossType, lastNeighborSameType, lastNeighborCrossType);
        const selectedNeighbors: number[] = [];
        edges.forEach((edge, _) => {
            if (edge.from == hoveredIndex) {
                selectedNeighbors.push(edge.to);
            }
            if (edge.to == hoveredIndex) {
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

    }, [hoveredIndex]);


    /*
        Show neighborhood relationship
        triggered by hoveredIndex and showNeighbor options changed
    */
    useEffect(() => {
        if (!vchartRef.current) {
            return;
        }

        // create data
        let samples: { pointId: number, x: number; y: number; label: number; pred: number; label_desc: string; pred_desc: string; confidence: number; textSample: string }[] = []
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

            samples.push({
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
        });

        const edges = createEdges(neighborSameType, neighborCrossType, lastNeighborSameType, lastNeighborCrossType);
        const endpoints: { edgeId: number, from: number, to: number, x: number, y: number, type: string, status: string }[] = [];
        edges.forEach((edge, index) => {
            if (edge.from === hoveredIndex || edge.to === hoveredIndex) {
                if ((revealNeighborCrossType && edge.type === 'crossType') || (revealNeighborSameType && edge.type === 'sameType')) {
                    endpoints.push({ edgeId: index, from: edge.from, to: edge.to, x: samples[edge.from].x, y: samples[edge.from].y, type: edge.type, status: edge.status });
                    endpoints.push({ edgeId: index, from: edge.from, to: edge.to, x: samples[edge.to].x, y: samples[edge.to].y, type: edge.type, status: edge.status });
                }
            }
        });
        vchartRef.current?.updateDataSync('edges', endpoints);

    }, [revealNeighborCrossType, revealNeighborSameType, hoveredIndex]);


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

function softmax(arr: number[]): number[] {
    const expValues = arr.map(val => Math.exp(val));
    const sumExpValues = expValues.reduce((acc, val) => acc + val, 0);
    return expValues.map(val => val / sumExpValues);
}

function createEdges(
    currentSameType: number[][],
    currentCrossType: number[][],
    previousSameType: number[][],
    previousCrossType: number[][]
): Edge[] {
    const edges: Edge[] = [];
    const allNodes = new Set<number>();

    // Collect all nodes
    [currentSameType, currentCrossType, previousSameType, previousCrossType].forEach(matrix => {
        matrix.forEach((neighbors, node) => {
            allNodes.add(node);
            neighbors.forEach(neighbor => allNodes.add(neighbor));
        });
    });

    allNodes.forEach(node => {
        const currentNeighborsSameType = new Set(currentSameType[node] || []);
        const currentNeighborsCrossType = new Set(currentCrossType[node] || []);
        const previousNeighborsSameType = new Set(previousSameType[node] || []);
        const previousNeighborsCrossType = new Set(previousCrossType[node] || []);

        // Check sameType neighbors
        currentNeighborsSameType.forEach(neighbor => {
            if (previousNeighborsSameType.has(neighbor)) {
                if (node != neighbor) {
                    edges.push({ from: node, to: neighbor, type: 'sameType', status: 'maintain' });
                }
            } else {
                if (node != neighbor) {
                    edges.push({ from: node, to: neighbor, type: 'sameType', status: 'connect' });
                }
            }
        });

        previousNeighborsSameType.forEach(neighbor => {
            if (!currentNeighborsSameType.has(neighbor)) {
                if (node != neighbor) {
                    edges.push({ from: node, to: neighbor, type: 'sameType', status: 'disconnect' });
                }
            }
        });

        // Check crossType neighbors
        currentNeighborsCrossType.forEach(neighbor => {
            if (previousNeighborsCrossType.has(neighbor)) {
                if (node != neighbor) {
                    edges.push({ from: node, to: neighbor, type: 'crossType', status: 'maintain' });
                }
            } else {
                if (node != neighbor) {
                    edges.push({ from: node, to: neighbor, type: 'crossType', status: 'connect' });
                }
            }
        });

        previousNeighborsCrossType.forEach(neighbor => {
            if (!currentNeighborsCrossType.has(neighbor)) {
                if (node != neighbor) {
                    edges.push({ from: node, to: neighbor, type: 'crossType', status: 'disconnect' });
                }
            }
        });
    });

    return edges;
}