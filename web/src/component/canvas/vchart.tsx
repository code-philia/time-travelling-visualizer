// ChartComponent.tsx
import { memo, useEffect, useRef } from 'react';
import VChart from '@visactor/vchart';
import { CommonPointsGeography } from './types';
import { useStore } from "../../state/store";

const PADDING = 1;

export const ChartComponent = memo(({ rawPointsGeography }: { rawPointsGeography: CommonPointsGeography | null }) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const vchartRef = useRef<VChart | null>(null);
    const { labelDict, colorDict } = useStore(["labelDict", "colorDict"]);

    useEffect(() => {
        if (chartRef.current) {
            // create data
            let samples: { x: number; y: number; label: number; label_desc: string | undefined }[] = []
            let x_min = Infinity, y_min = Infinity, x_max = -Infinity, y_max = -Infinity;

            rawPointsGeography?.positions.map((p, i) => {
                const x = parseFloat(p[0].toFixed(3));
                const y = parseFloat(p[1].toFixed(3));
                samples.push({
                    x: x,
                    y: y,
                    label: rawPointsGeography?.labels[i],
                    label_desc: labelDict.get(rawPointsGeography?.labels[i])
                });

                if (x < x_min) x_min = x;
                if (y < y_min) y_min = y;
                if (x > x_max) x_max = x;
                if (y > y_max) y_max = y;
            });
            const data = [
                {
                    values: samples
                }
            ];

            // create spec
            const spec = {
                type: 'scatter', // chart type
                data: data,
                xField: 'x',
                yField: 'y',
                seriesField: 'label_desc',
                point: {
                    state: {
                        hover: {
                            scaleX: 2,
                            scaleY: 2
                        }
                    },
                    style: {
                        fill: (datum: { x: number; y: number; label: number; label_desc: string | undefined }) => {
                            const color = colorDict.get(datum.label);
                            if (color) {
                                return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                            }
                            return 'gray';
                        }
                    }
                },
                axes: [
                    { orient: 'left', min: y_min - PADDING, max: y_max + PADDING, type: 'linear' },
                    { orient: 'bottom', min: x_min - PADDING, max: x_max + PADDING, type: 'linear' }
                ],
                legends: [
                    {
                        visible: true,
                        orient: 'right',
                        position: 'start',
                        title: {
                            visible: true,
                            style: {
                                text: 'Class'
                            }
                        },
                        item: {
                            visible: true
                        }
                    }
                ],
                direction: 'horizontal'
            };

            if (!vchartRef.current) {
                const vchart = new VChart(spec, { dom: chartRef.current });
                vchartRef.current = vchart;
            }
            else {
                vchartRef.current.updateSpec(spec);
            }

            vchartRef.current.renderSync();
        }
    }, [rawPointsGeography]);

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