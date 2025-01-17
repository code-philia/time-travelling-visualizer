// ChartComponent.tsx
import { memo, useEffect, useRef } from 'react';
import VChart from '@visactor/vchart';
import { VChartData } from './types';
import { useDefaultStore } from "../../state/store";

const PADDING = 1;


export const ChartComponent = memo(({ vchartData }: { vchartData: VChartData | null }) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const vchartRef = useRef<VChart | null>(null);

    // Here are data from useStore
    const { labelDict, colorDict } = useDefaultStore(["labelDict", "colorDict"]);
    const { filterValue, filterType } = useDefaultStore(["filterValue", "filterType"]);
    const { filterState } = useDefaultStore(["filterState"]);
    const { showBgimg } = useDefaultStore(["showBgimg"]);
    const { showNumber, showText, textData } = useDefaultStore(["showNumber", "showText", "textData"])
    console.log('vchart', filterValue, filterType, filterState);

    // When vchartData changes, update chart
    useEffect(() => {
        if (!chartRef.current) {
            return;
        }

        // create data
        let samples: { index: number, x: number; y: number; label: number; pred: number; label_desc: string; pred_desc: string; confidence: number; textSample: string }[] = []
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
                index: i,
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
            type: 'scatter', // chart type
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
                }
            ],
            xField: 'x',
            yField: 'y',
            seriesField: 'label',

            // ================= background =================
            background: {
                image: bgimg,
            },

            // ================= points =================
            point: {
                state: {
                    hover: {
                        scaleX: 2,
                        scaleY: 2
                    }
                },
                style: {
                    size: 8,
                    fill: (datum: { label: number; }) => {
                        const color = colorDict.get(datum.label) ?? [0, 0, 0];
                        return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                    },
                    fillOpacity: (datum: { confidence: number; }) => {
                        return datum.confidence;
                    }
                }
            },

            // ================= label on canvas =================
            label: [
                {
                    visible: true,
                    style: {
                        visible: () => {
                            return showNumber || showText;
                        },
                        type: 'text',
                        fontFamily: 'Console',
                        // fontStyle: 'italic',
                        // fontWeight: 'bold',
                        text: (datum: { index: any; textSample: string; label: number; }) => {
                            if (showText && showNumber) {
                                return `${datum.index}.${datum.textSample == '' ? labelDict.get(datum.label) : datum.textSample}`;
                            }
                            else if (showText) {
                                return datum.textSample == '' ? labelDict.get(datum.label) : datum.textSample;
                            }
                            else if (showNumber) {
                                return `${datum.index}`;
                            }
                        },

                        fill: (datum: { label: number; }) => {
                            const color = colorDict.get(datum.label) ?? [0, 0, 0];
                            return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                        },
                        fillOpacity: 0.6
                    }
                }
            ],

            // ================= axes =================
            axes: [
                {
                    orient: 'left',
                    min: y_max,
                    max: y_min,
                    type: 'linear',
                    grid: { visible: false }
                },
                {
                    orient: 'bottom',
                    min: x_min,
                    max: x_max,
                    type: 'linear',
                    grid: { visible: false }
                }
            ],

            // ================= zoom =================
            dataZoom: [
                {
                    visible: true,
                    orient: 'left',
                    filterMode: 'axis',

                    // style
                    showBackgroundChart: false,
                    startHandler: {
                        style: {
                            size: 13,
                        }
                    },
                    endHandler: {
                        style: {
                            size: 13,
                        }
                    },
                    background: {
                        size: 15,
                        style: {
                            cornerRadius: 20
                        }
                    },
                    selectedBackground: {
                        style: {
                            fill: 'rgb(22,119,255)',
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

                    // style
                    showBackgroundChart: false,
                    startHandler: {
                        style: {
                            size: 13,
                        }
                    },
                    endHandler: {
                        style: {
                            size: 13,
                        }
                    },
                    background: {
                        size: 15,
                        style: {
                            cornerRadius: 20
                        }
                    },
                    selectedBackground: {
                        style: {
                            fill: 'rgb(22,119,255)',
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
                }
            ],

            // brush: {
            //     visible: true,
            //     brushType: 'rect',
            //     inBrush: {
            //         colorAlpha: 1
            //     },
            //     outOfBrush: {
            //         colorAlpha: 0.2
            //     },
            //     // 开启后默认关联所有axis/dataZoom
            //     zoomAfterBrush: true
            // },
            // ================= tooltip =================
            tooltip: {
                lockAfterClick: false,
                dimension: {
                    visible: false
                },
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

            // customMark: {
            //     type: 'image',
            //     style: {
            //         image: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/Monday-icon-vchart-demo.svg',
            //         width: 20,
            //         height: 20,
            //         x: 0,
            //         y: 0,
            //         opacity: 0.2
            //     }
            // },

            // ================= legend =================
            legends: [
                {
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

            direction: 'horizontal'
        };

        // create or update vchart
        if (!vchartRef.current) {
            const vchart = new VChart(spec, { dom: chartRef.current });
            vchartRef.current = vchart;
        }
        else {
            vchartRef.current.updateSpec(spec);
        }

        vchartRef.current.renderSync();
    }, [vchartData, filterState, showBgimg, showNumber, showText]);

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