import styled from 'styled-components';
import { Button, List } from 'antd';
import { memo, useRef, useState } from 'react';
import { useDefaultStore } from '../state/state.analysisView';
import { notifySelectedIndicesSwitch } from '../communication/viewMessage';
import VChart from '@visactor/vchart';
import { useEffect } from 'react';

export function VisAnalysisPanel() {
    const { selectedIndices, setSelectedIndices} = useDefaultStore(["selectedIndices", "setSelectedIndices"]);
    const [abnormalSamples, setAbnormalSamples] = useState<{ index: number; isHighDimensional: boolean }[]>([]);

    // TODO: replace with real data
    const computeAbnormalSamples = () => {
        const mockData = Array.from({ length: 10 }, () => ({
            index: Math.floor(Math.random() * 100),
            isHighDimensional: Math.random() > 0.5,
        }));
        setAbnormalSamples(mockData);
    };

    const toggleSelection = (index: number) => {
        const newSelectedIndices = selectedIndices.includes(index)
            ? selectedIndices.filter(i => i !== index)
            : [...selectedIndices, index];

        setSelectedIndices(newSelectedIndices);
        notifySelectedIndicesSwitch(newSelectedIndices);
    };

    return (
        <VisAnalysisContainer>
            <Section>
                <SectionTitle>Metrics Overview</SectionTitle>
                {/* <Radar {...radarConfig} /> */}
                <RadarComponent />
                <MetricsDescription>
                    <MetricExplanation><strong>Neighbor Trustworthiness:</strong> Measures how well the neighbors in the high-dimensional space are preserved in the 2D space.</MetricExplanation>
                    <MetricExplanation><strong>Neighbor Continuity:</strong> Measures how well the neighbors in the 2D space match the high-dimensional space.</MetricExplanation>
                    <MetricExplanation><strong>Re-construction Precision:</strong> Measures the accuracy of reconstructing the original data from the 2D projection.</MetricExplanation>
                    <MetricExplanation><strong>Abnormal Movements Ratio (2D):</strong> Proportion of samples with unexpected movements in the 2D space.</MetricExplanation>
                    <MetricExplanation><strong>Movement Consistency:</strong> Measures the consistency of movements between high-dimensional and 2D spaces.</MetricExplanation>
                </MetricsDescription>
            </Section>
            <Section>
                <SectionTitle>Suspicious Samples</SectionTitle>
                <SubSection>
                    <SubSectionTitle>Abnormal Movements in 2D Space</SubSectionTitle>
                    <Button onClick={computeAbnormalSamples} style={{ marginBottom: '10px' }}>
                        Compute
                    </Button>
                    <AbnormalList
                        bordered
                        dataSource={abnormalSamples}
                        renderItem={(item: any) => (
                            <List.Item onClick={() => toggleSelection(item.index)} style={{ cursor: 'pointer' }}>
                                <span>Index: {item.index}</span>
                                <AbnormalStatus>
                                    <StatusLabel>Consistent:</StatusLabel>
                                    <StatusValue $isHighDimensional={item.isHighDimensional}>
                                        {item.isHighDimensional ? 'T' : 'F'}
                                    </StatusValue>
                                </AbnormalStatus>
                            </List.Item>
                        )}
                    />
                </SubSection>
            </Section>
        </VisAnalysisContainer>
    );
}

export default VisAnalysisPanel;


const RadarComponent = memo(() => {
    const chartRef = useRef<HTMLDivElement>(null);
    const radarRef = useRef<VChart | null>(null);

    useEffect(() => {
        if (!chartRef.current) {
            return;
        }
        const spec = {
            type: 'radar',
            data: [
                {
                    id: 'radarData',
                    values: [
                        { metric: 'Neighbor Trustworthiness', value: 0.35 },
                        { metric: 'Neighbor Continuity', value: 0.25 },
                        { metric: 'Re-construction Precision', value: 0.85 },
                        { metric: 'Abnormal Movements Ratio', value: 0.2 },
                        { metric: 'Movement Consistency', value: 0.5 },
                    ]
                }
            ],
            categoryField: 'metric',
            valueField: 'value',
            point: {
                visible: false // disable point
            },
            area: {
                visible: true, // display area
                state: {
                    hover: {
                        fillOpacity: 0.5
                    }
                }
            },
            line: {
                style: {
                    lineWidth: 2
                }
            },
            axes: [
                {
                    orient: 'radius', // radius axis
                    zIndex: 100,
                    min: 0,
                    max: 1,
                    domainLine: {
                        visible: false
                    },
                    label: {
                        visible: true,
                        space: 0,
                        style: {
                            textAlign: 'center',
                            stroke: '#fff',
                            lineWidth: 4
                        }
                    },
                    grid: {
                        smooth: false,
                        style: {
                            lineDash: [0]
                        }
                    }
                },
                {
                    orient: 'angle', // angle axis
                    zIndex: 50,
                    tick: {
                        visible: false
                    },
                    domainLine: {
                        visible: false
                    },
                    label: {
                        space: 20
                    },
                    grid: {
                        style: {
                            lineDash: [0]
                        }
                    }
                }
            ]
        };

        if (!radarRef.current) {
            const vchart = new VChart(spec, { dom: chartRef.current });
            radarRef.current = vchart;
        }
        else {
            radarRef.current.updateSpec(spec);
        }
        radarRef.current.renderSync();
    }, []);

    return <div
        ref={chartRef}
        id='radar'
        style={{
            width: '60%',
            height: '60%'
        }}>
    </div>;
});


const VisAnalysisContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 10px;
    background-color: white;
    height: 100%;
    width: 100%;
`;

const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const SectionTitle = styled.h3`
    font-size: 16px;
    color: #595959;
    margin: 0;
`;


const MetricsDescription = styled.div`
    gap: 5px;
    margin-top: 10px;
    font-size: 12px;
    color: #595959;
    line-height: 1.5;
`;

const MetricExplanation = styled.div`
    margin-bottom: 5px;
`;

const SubSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%; /* Make width adapt to the parent component */
`;

const SubSectionTitle = styled.h4`
    font-size: 14px;
    color: #595959;
    margin: 0;
`;

const AbnormalList = styled(List)`
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #d9d9d9;
    border-radius: 8px;
    width: 100%; /* Make width adapt to the parent component */
    background-color: #fafafa;

    /* Custom scrollbar styling */
    &::-webkit-scrollbar {
        width: 8px;
    }
    &::-webkit-scrollbar-thumb {
        background-color: #d0d0d0;
        border-radius: 4px;
    }
    &::-webkit-scrollbar-thumb:hover {
        background-color: #b0b0b0;
    }
    &::-webkit-scrollbar-track {
        background-color: #f0f0f0;
    }

    .ant-list-item {
        padding: 6px 10px; /* Reduce padding for smaller height */
        border-radius: 8px; /* Rounded corners */
        font-family: 'Consolas', monospace; /* Use Consolas font */
        background-color: #fafafa; /* Light background for better visibility */
        transition: background-color 0.3s;

        &:hover {
            background-color: #f5f5f5; /* Slightly darker background on hover */
        }
    }
`;

const AbnormalStatus = styled.div`
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px; /* Reduce the gap between StatusLabel and StatusValue */
    justify-content: flex-end; /* Align both elements to the right */
`;

const StatusLabel = styled.span`
    font-size: 12px;
    color: #8c8c8c;
`;

const StatusValue = styled.span<{ $isHighDimensional: boolean }>`
    font-weight: bold;
    color: ${(props) => (props.$isHighDimensional ? '#52c41a' : '#ff4d4f')};
`;
