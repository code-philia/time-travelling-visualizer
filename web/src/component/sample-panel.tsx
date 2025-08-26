import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { softmax } from './utils';
import { useDefaultStore } from '../state/state.rightView';
import { FunctionalBlock } from './custom/basic-components';

export function SamplePanel() {
    const { availableEpochs, hoveredIndex, labels, epoch, allEpochData, labelDict, dataType, rawData, tokenList } =
        useDefaultStore(['availableEpochs', 'hoveredIndex', 'labels', 'epoch', 'allEpochData', 'labelDict', 'dataType', 'rawData', 'tokenList']);

    const [data, setData] = useState<string>('');
    const [predictions, setPredictions] = useState<{ value: number, confidence: number, correct: boolean }[]>([]);
    const [historyPrediction, setHistoryPrediction] = useState<{ epoch: number, prediction: number, confidence: number, correct: boolean }[]>([]);

    const getDisplayLabel = (index: number) =>
    tokenList ? tokenList[index] : labelDict.get(labels[index]) || 'Unknown';

    useEffect(() => {
        console.log("hoveredIndex in detail panel: ", hoveredIndex);
        if (!hoveredIndex || !labels || !allEpochData[epoch]) {
            setData('');
            setPredictions([]);
            setHistoryPrediction([]);
            return;
        }

        setData(rawData? rawData : '');

        // current epoch prediction
        if (!allEpochData[epoch].probability[hoveredIndex]) { 
            setPredictions([]);
        }
        else {
            const softmaxProps = softmax(allEpochData[epoch].probability[hoveredIndex]);
            const sortedProps = [...softmaxProps];
            sortedProps.sort((a, b) => b - a);
            const topThreeConfidences = sortedProps.slice(0, 3);
            const topThreeIndices = topThreeConfidences.map((confidence) => softmaxProps.indexOf(confidence));
            const topThreeResults = topThreeIndices.map((index, i) => ({
                value: index,
                confidence: topThreeConfidences[i],
                correct: Number(labels[hoveredIndex]) === index
            }));
            setPredictions(topThreeResults);
        }

        // history prediction
        const historyPredictionNew: {epoch: number, prediction: number, confidence: number, correct: boolean}[] = [];
        const epochId = availableEpochs.indexOf(epoch);
        for (let i = epochId - 1; i >= Math.max(0, epochId - 5); i--) {
            const e = availableEpochs[i];
            const pred = allEpochData[e].prediction[hoveredIndex];
            historyPredictionNew.push({
                epoch: e,
                prediction: pred,
                confidence: allEpochData[e].confidence[hoveredIndex],
                correct: labels[hoveredIndex] === pred
            });
        }
        setHistoryPrediction(historyPredictionNew);

    }, [hoveredIndex, rawData, epoch, allEpochData, availableEpochs]);

    return (
        <CompactInfoColumn>
            <FunctionalBlock label="Basic Information">
                <CompactInfoContainer>
                    {dataType === 'Text' ? (
                        <TextContainer>
                            {hoveredIndex === undefined || !data ? (
                                <EmptyText>No text</EmptyText>
                            ) : (
                                <CompactText>{String(data)}</CompactText>
                            )}
                        </TextContainer>
                    ) : (
                        <ImageContainer>
                            {hoveredIndex === undefined ? (
                                <EmptyImage>No image</EmptyImage>
                            ) : data ? (
                                <CompactImage src={data} alt="Sample" />
                            ) : (
                                <EmptyImage>No image</EmptyImage>
                            )}
                        </ImageContainer>
                    )}

                    {hoveredIndex !== undefined && (
                        <SampleInfo>
                            #{hoveredIndex}: {getDisplayLabel(hoveredIndex)}
                        </SampleInfo>
                    )}
                </CompactInfoContainer>
            </FunctionalBlock>

            <FunctionalBlock label="Prediction">
                <CompactSection>
                    <CompactSectionLabel>CURRENT</CompactSectionLabel>
                    <PredictionContainer>
                        {predictions.map((prediction, index) => (
                            <PredictionItem key={index}>
                                <PredictionValue>
                                    {getDisplayLabel(prediction.value)}
                                </PredictionValue>
                                <ConfidenceBar $confidence={prediction.confidence} $correct={prediction.correct} />
                                <ConfidenceValue>
                                    {(prediction.confidence * 100).toFixed(1)}%
                                </ConfidenceValue>
                            </PredictionItem>
                        ))}
                    </PredictionContainer>
                </CompactSection>

                <CompactSection>
                    <CompactSectionLabel>HISTORY</CompactSectionLabel>
                    <PredictionHistoryContainer>
                        {historyPrediction.slice(-5).map((record, index) => (
                            <PredictionHistoryItem key={index}>
                                <HistoryEpoch>{record.epoch}:</HistoryEpoch>
                                <HistoryPrediction $correct={record.correct}>{getDisplayLabel(record.prediction)}</HistoryPrediction>
                                <HistoryConfidence>{(record.confidence * 100).toFixed(1)}%</HistoryConfidence>
                            </PredictionHistoryItem>
                        ))}
                    </PredictionHistoryContainer>
                </CompactSection>
            </FunctionalBlock>

            <FunctionalBlock label="Neighbors">
                <CompactSection>
                    <CompactSectionLabel>HIGH-DIM</CompactSectionLabel>
                    <CompactNeighborList>
                        {hoveredIndex !== undefined && allEpochData[epoch]?.originalNeighbors[hoveredIndex]?.map((neighbor, index) => (
                            <HighDimNeighborItem key={index}>
                                {neighbor}.{getDisplayLabel(neighbor)}
                            </HighDimNeighborItem>
                        ))}
                    </CompactNeighborList>
                </CompactSection>

                <CompactSection>
                    <CompactSectionLabel>PROJECTION</CompactSectionLabel>
                    <CompactNeighborList>
                        {hoveredIndex !== undefined && allEpochData[epoch]?.projectionNeighbors[hoveredIndex]?.map((neighbor, index) => {
                            const isCorrect = allEpochData[epoch].originalNeighbors[hoveredIndex]?.includes(neighbor);
                            return (
                                <ProjectionNeighborItem key={index} $correct={isCorrect}>
                                    {neighbor}.{getDisplayLabel(neighbor)}
                                </ProjectionNeighborItem>
                            );
                        })}
                    </CompactNeighborList>
                </CompactSection>
            </FunctionalBlock>
        </CompactInfoColumn>
    );
};

export default SamplePanel;

// ================== 统一紧凑样式 ======================
const CompactInfoColumn = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px;
`;

const CompactInfoContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;  // 改为左对齐
    gap: 6px;
    padding: 0;  // 移除内边距
`;

const ImageContainer = styled.div`
    width: 80px;
    height: 80px;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 1px solid #e8e8e8;
    border-radius: 4px;
    background-color: #fafafa;
    overflow: hidden;
`;

const CompactImage = styled.img`
    width: 100%;  // 改为100%填充容器
    height: 100%;
    object-fit: cover;  // 改为cover以填充整个区域
`;

const EmptyImage = styled.div`
    color: #bfbfbf;
    font-size: 11px;
    text-align: center;
    width: 100%;
`;

const TextContainer = styled.div`
    width: 80px;
    height: 80px;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 1px solid #e8e8e8;
    border-radius: 4px;
    background-color: #fafafa;
    overflow: hidden;
    padding: 4px;
`;

const CompactText = styled.div`
    width: 100%;
    height: 100%;
    font-size: 10px;
    line-height: 1.2;
    color: #262626;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
`;

const EmptyText = styled.div`
    color: #bfbfbf;
    font-size: 11px;
    text-align: center;
`;

const SampleInfo = styled.div`
    font-family: 'Consolas', monospace;
    font-size: 12px;
    font-weight: 500;
    color: #262626;
    padding-left: 2px;
`;

const CompactSection = styled.div`
    margin-bottom: 10px;
`;

const CompactSectionLabel = styled.div`
    font-size: 10px;
    font-weight: 600;
    color: #595959;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
`;

const PredictionContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: fit-content;
`;

const PredictionItem = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
`;

const PredictionValue = styled.span`
    font-family: 'Consolas', monospace;
    font-size: 12px;
    color: #262626;
    width: 50px;
    flex-shrink: 0;
    overflow: hidden;
`;

const ConfidenceBar = styled.div<{ $confidence: number, $correct: boolean }>`
    height: 5px;
    width: ${(props) => props.$confidence * 80}px;
    background-color: ${props => (props.$correct ? '#52c41a' : '#ff4d4f')};
    border-radius: 3px;
    flex-shrink: 0;
`;

const ConfidenceValue = styled.span`
    font-family: 'Consolas', monospace;
    font-size: 9px;
    color: #595959;
    flex-shrink: 0;
`;

const PredictionHistoryContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 100%;
`;

const PredictionHistoryItem = styled.div`
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 5px;
    border: 1px solid #f0f0f0;
    border-radius: 3px;
    background-color: #fafafa;
    font-family: 'Consolas', monospace;
    font-size: 11px;
    color: #262626;
`;

const HistoryEpoch = styled.span`
    font-weight: 600;
    color: #595959;
    min-width: 20px;
`;

const HistoryPrediction = styled.span<{ $correct: boolean }>`
    flex: 1;
    font-weight: 500;
    color: ${props => (props.$correct ? '#52c41a' : '#ff4d4f')};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const HistoryConfidence = styled.span`
    font-weight: 500;
    color: #8c8c8c;
    min-width: 35px;
    text-align: right;
`;

const CompactNeighborList = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;  // 减小标签间距
`;

const HighDimNeighborItem = styled.span`
    padding: 3px 6px;
    border-radius: 3px;
    font-size: 11px;
    font-family: 'Consolas', monospace;
    background-color: #f0f0f0;  // 灰色表示高维邻居
    color: #595959;
    display: inline-block;
`;

const ProjectionNeighborItem = styled.span<{ $correct: boolean }>`
    padding: 3px 6px;
    border-radius: 3px;
    font-size: 11px;
    font-family: 'Consolas', monospace;
    background-color: ${props => props.$correct ? '#d9f7be' : '#ffd6d6'}; // 正确浅绿，错误浅红
    color: #262626;
    display: inline-block;
`;