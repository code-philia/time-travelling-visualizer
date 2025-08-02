import styled from 'styled-components';
import { List, Tag, Checkbox, Form } from 'antd';
import { useEffect, useState } from 'react';
import { FunctionalBlock } from './custom/basic-components';
import { useDefaultStore } from '../state/state.rightView';
import { notifyTrainingEventClicked } from '../communication/viewMessage';

const predColor = (isCorrect: boolean) => (isCorrect ? '#52c41a' : '#ff4d4f');
const confArrow = (change: number) =>
    change > 0 ? <span style={{ color: '#52c41a', fontSize: '16px', fontWeight: '1000',marginLeft: 4 }}>↑</span> : <span style={{ color: '#ff4d4f', fontSize: '16px', fontWeight: '1000',marginLeft: 4 }}>↓</span>;

function softmax(probabilities: number[]): number[] {
    const maxProb = Math.max(...probabilities);
    const expProbs = probabilities.map((p) => Math.exp(p - maxProb));
    const sumExpProbs = expProbs.reduce((sum, p) => sum + p, 0);
    return expProbs.map((p) => p / sumExpProbs);
}

const ScrollableListWrapper = styled.div`
    max-height: 500px;
    overflow-y: auto;
    /* 隐藏滚动条，兼容主流浏览器 */
    scrollbar-width: thin;
    scrollbar-color: #e0e0e0 transparent;
    &::-webkit-scrollbar {
        width: 6px;
        background: transparent;
    }
    &::-webkit-scrollbar-thumb {
        background: #e0e0e0;
        border-radius: 3px;
    }
`;

const StyledForm = styled(Form)`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-bottom: 1em;
    padding: 1em;
    border: 1px solid #d9d9d9;
    border-radius: 8px;
    background-color: #fafafa;
`;

const StyledCheckboxGroup = styled(Checkbox.Group)`
    display: flex;
    flex-wrap: wrap;
    gap: 1em;

    .ant-checkbox-wrapper {
        display: flex;
        align-items: center;
        padding: 2px 5px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
        &:hover {
            box-shadow: 0 0 6px rgba(0, 0, 0, 0.2);
        }
    }
`;

const ResponsiveScrollableListWrapper = styled(ScrollableListWrapper)`
    border: 1px solid #d9d9d9;
    border-radius: 8px;
    padding: 0.5em;
    background-color: #ffffff;
    height: 90%
`;

const StyledListItem = styled.div`
    display: flex;
    align-items: center;
    padding: 0.5em;
    border-radius: 8px;
    transition: background-color 0.3s ease, box-shadow 0.3s ease, transform 0.2s ease;
    cursor: pointer;

    &:hover {
        background-color: rgba(0, 0, 0, 0.05);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        transform: translateY(-2px);
    }

    &:active {
        background-color: rgba(0, 0, 0, 0.1);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        transform: translateY(0);
    }
`;

export function TrainingEventPanel() {
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [predictionFlips, setPredictionFlips] = useState<any[]>([]);
    const [confidenceChanges, setConfidenceChanges] = useState<any[]>([]);
    const { epoch, availableEpochs, allEpochData, labels, labelDict } = useDefaultStore([
        "epoch",
        "availableEpochs",
        "allEpochData",
        "labels",
        "labelDict",
    ]);

    const handleCheckboxChange = (checkedValues: unknown[]) => {
        const newSelectedTypes = checkedValues as string[];
        setSelectedTypes(newSelectedTypes);

        // Calculate predictionFlips only when PredictionFlip is selected
        if (newSelectedTypes.includes('PredictionFlip') && !selectedTypes.includes('PredictionFlip')) {
            const currentEpochIndex = availableEpochs.indexOf(epoch);
            if (currentEpochIndex > 0) {
                const prevEpoch = availableEpochs[currentEpochIndex - 1];
                const flips = labels
                    .map((label, index) => {
                        const prevPred = allEpochData[prevEpoch]?.prediction[index];
                        const currPred = allEpochData[epoch]?.prediction[index];
                        if (prevPred !== undefined && currPred !== undefined && prevPred !== currPred) {
                            const prevCorrect = prevPred === label;
                            const currCorrect = currPred === label;
                            return {
                                index,
                                prevPred: labelDict.get(prevPred) || prevPred.toString(),
                                currPred: labelDict.get(currPred) || currPred.toString(),
                                prevCorrect,
                                currCorrect,
                                type: 'PredictionFlip',
                            };
                        }
                        return null;
                    })
                    .filter(Boolean);
                setPredictionFlips(flips);
            }
        }

        // Calculate confidenceChanges only when ConfidenceChange is selected
        if (newSelectedTypes.includes('ConfidenceChange') && !selectedTypes.includes('ConfidenceChange')) {
            const currentEpochIndex = availableEpochs.indexOf(epoch);
            if (currentEpochIndex > 0) {
                const prevEpoch = availableEpochs[currentEpochIndex - 1];
                const changes = labels
                    .map((label, index) => {
                        const prevProbs = allEpochData[prevEpoch]?.probability[index];
                        const currProbs = allEpochData[epoch]?.probability[index];
                        if (prevProbs && currProbs) {
                            const prevSoftmax = softmax(prevProbs);
                            const currSoftmax = softmax(currProbs);
                            const prevProb = prevSoftmax[label];
                            const currProb = currSoftmax[label];
                            if (Math.abs(currProb - prevProb) > 0.3) {
                                return {
                                    index,
                                    label: labelDict.get(label) || label.toString(),
                                    prevConf: prevProb,
                                    currConf: currProb,
                                    change: currProb - prevProb,
                                    type: 'ConfidenceChange',
                                };
                            }
                        }
                        return null;
                    })
                    .filter(Boolean);
                setConfidenceChanges(changes);
            }
        }
    };

    useEffect(() => {
        // Call handleCheckboxChange manually when epoch changes
        handleCheckboxChange(selectedTypes);
    }, [epoch]);

    const combinedData = [
        ...(selectedTypes.includes('ConfidenceChange') ? confidenceChanges : []),
        ...(selectedTypes.includes('SignificantMovement') ? mockSignificantMovements.map(item => ({ ...item, type: 'SignificantMovement' })) : []),
        ...(selectedTypes.includes('AbnormalDistanceChange') ? mockAbnormalDistanceChanges.map(item => ({ ...item, type: 'AbnormalDistanceChange' })) : []),
        ...(selectedTypes.includes('PredictionFlip') ? predictionFlips : []),
    ];

    const handleItemClick = (item: any) => {
        console.log('Item clicked:', item);
        notifyTrainingEventClicked(item, epoch);
    };

    return (
        <div className="info-column">
            <FunctionalBlock label="Training Events">
                <StyledForm>
                    <Form.Item style={{ marginBottom: 0 }}>
                        <StyledCheckboxGroup
                            options={[
                                { label: 'Prediction Flip', value: 'PredictionFlip' },
                                { label: 'Confidence Change', value: 'ConfidenceChange' },
                                { label: 'Significant Movement', value: 'SignificantMovement' },
                                { label: 'Abnormal Distance Change', value: 'AbnormalDistanceChange' },
                            ]}
                            onChange={handleCheckboxChange}
                            className="custom-checkbox-group"
                        />
                    </Form.Item>
                </StyledForm>
                <ResponsiveScrollableListWrapper>
                    <List
                        size="small"
                        dataSource={combinedData}
                        renderItem={(item) => (
                            <StyledListItem
                                onClick={() => handleItemClick(item)}
                                style={{
                                    backgroundColor:
                                        item.type === 'PredictionFlip'
                                            ? '#e6f7ff'
                                            : item.type === 'ConfidenceChange'
                                            ? '#fffbe6'
                                            : item.type === 'SignificantMovement'
                                            ? '#fff1f0'
                                            : '#f6ffed',
                                }}
                            >
                                <Tag
                                    color={
                                        item.type === 'PredictionFlip'
                                            ? 'blue'
                                            : item.type === 'ConfidenceChange'
                                            ? 'purple'
                                            : item.type === 'SignificantMovement'
                                            ? 'orange'
                                            : 'red'
                                    }
                                    style={{ minWidth: 36, textAlign: 'center' }}
                                >
                                    #{item.index}
                                </Tag>
                                <span style={{ marginLeft: 8 }}>
                                    {item.type === 'PredictionFlip' && (
                                        <>
                                            <span style={{ color: '#888' }}>Prediction:</span>
                                            <span
                                                style={{
                                                    color: predColor(item.prevCorrect),
                                                    fontWeight: 600,
                                                    marginLeft: 6,
                                                }}
                                            >
                                                {item.prevPred}
                                            </span>
                                            <span style={{ margin: '0 6px', color: '#888' }}>→</span>
                                            <span
                                                style={{
                                                    color: predColor(item.currCorrect),
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {item.currPred}
                                            </span>
                                        </>
                                    )}
                                    {item.type === 'ConfidenceChange' && (
                                        <>
                                            <span style={{ color: '#888' }}>Label:</span>
                                            <span style={{ marginLeft: 6, fontWeight: 600 }}>
                                                {item.label}
                                            </span>
                                            <span style={{ color: '#000', marginLeft: 6 }}>
                                                {item.prevConf.toFixed(2)}
                                            </span>
                                            <span style={{ margin: '0 6px', color: '#888' }}>→</span>
                                            <span style={{ color: '#000' }}>
                                                {item.currConf.toFixed(2)}
                                            </span>
                                            {confArrow(item.change)}
                                        </>
                                    )}
                                    {item.type === 'SignificantMovement' && (
                                        <>
                                            <span style={{ color: '#888' }}>Movement:</span>
                                            <span style={{ color: '#fa541c', fontWeight: 600, marginLeft: 6 }}>
                                                {item.movement}
                                            </span>
                                        </>
                                    )}
                                    {item.type === 'AbnormalDistanceChange' && (
                                        <>
                                            <span style={{ color: '#888' }}>Distance:</span>
                                            <span style={{ color: '#d4380d', fontWeight: 600, marginLeft: 6 }}>
                                                {item.prevDist}
                                            </span>
                                            <span style={{ margin: '0 6px', color: '#888' }}>→</span>
                                            <span style={{ color: '#52c41a', fontWeight: 600 }}>
                                                {item.currDist}
                                            </span>
                                        </>
                                    )}
                                </span>
                            </StyledListItem>
                        )}
                        locale={{
                            emptyText: <span style={{ color: '#888' }}>No item detected</span>,
                        }}
                    />
                </ResponsiveScrollableListWrapper>
            </FunctionalBlock>
        </div>
    );
}

export default TrainingEventPanel;



const mockPredictionFlips = [
    {
        index: 3,
        prevPred: 1,
        currPred: 0,
        prevCorrect: false,
        currCorrect: true,
    },
    {
        index: 7,
        prevPred: 0,
        currPred: 2,
        prevCorrect: true,
        currCorrect: false,
    },
    {
        index: 12,
        prevPred: 2,
        currPred: 1,
        prevCorrect: false,
        currCorrect: false,
    },
    {
        index: 15,
        prevPred: 1,
        currPred: 1,
        prevCorrect: false,
        currCorrect: true,
    },
    {
        index: 21,
        prevPred: 0,
        currPred: 1,
        prevCorrect: true,
        currCorrect: true,
    },
    {
        index: 3,
        prevPred: 1,
        currPred: 0,
        prevCorrect: false,
        currCorrect: true,
    },
    {
        index: 7,
        prevPred: 0,
        currPred: 2,
        prevCorrect: true,
        currCorrect: false,
    },
    {
        index: 12,
        prevPred: 2,
        currPred: 1,
        prevCorrect: false,
        currCorrect: false,
    },
    {
        index: 15,
        prevPred: 1,
        currPred: 1,
        prevCorrect: false,
        currCorrect: true,
    },
    {
        index: 21,
        prevPred: 0,
        currPred: 1,
        prevCorrect: true,
        currCorrect: true,
    },
    {
        index: 3,
        prevPred: 1,
        currPred: 0,
        prevCorrect: false,
        currCorrect: true,
    },
    {
        index: 7,
        prevPred: 0,
        currPred: 2,
        prevCorrect: true,
        currCorrect: false,
    },
    {
        index: 12,
        prevPred: 2,
        currPred: 1,
        prevCorrect: false,
        currCorrect: false,
    },
    {
        index: 15,
        prevPred: 1,
        currPred: 1,
        prevCorrect: false,
        currCorrect: true,
    },
    {
        index: 21,
        prevPred: 0,
        currPred: 1,
        prevCorrect: true,
        currCorrect: true,
    },
    {
        index: 3,
        prevPred: 1,
        currPred: 0,
        prevCorrect: false,
        currCorrect: true,
    },
    {
        index: 7,
        prevPred: 0,
        currPred: 2,
        prevCorrect: true,
        currCorrect: false,
    },
    {
        index: 12,
        prevPred: 2,
        currPred: 1,
        prevCorrect: false,
        currCorrect: false,
    },
    {
        index: 15,
        prevPred: 1,
        currPred: 1,
        prevCorrect: false,
        currCorrect: true,
    },
    {
        index: 21,
        prevPred: 0,
        currPred: 1,
        prevCorrect: true,
        currCorrect: true,
    }
];

const mockConfidenceChanges = [
    { index: 2, prevConf: 0.45, currConf: 0.91 },
    { index: 8, prevConf: 0.88, currConf: 0.51 },
    { index: 13, prevConf: 0.32, currConf: 0.77 }
];

const mockSignificantMovements = [
    { index: 5, movement: 12.3 },
    { index: 9, movement: 15.8 }
];

const mockAbnormalDistanceChanges = [
    { index: 4, prevDist: 2.1, currDist: 8.7 },
    { index: 11, prevDist: 7.2, currDist: 1.3 }
];

