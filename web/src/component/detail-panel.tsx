import {useEffect, useState } from 'react';
import { TagOutlined, NumberOutlined, BarChartOutlined, PictureOutlined, ArrowDownOutlined, HistoryOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { softmax } from './utils';
import { useDefaultStore } from '../state/state.detailView';
import { Divider } from 'antd';

export function DetailPanel() {
    const { hoveredIndex, labels, predProbability, labelDict , imageData} =
        useDefaultStore(['hoveredIndex', 'labels', 'predProbability', 'labelDict', 'imageData']);

    const [image, setImage] = useState<string>('');
    const [predictions, setPredictions] = useState<{ value: number, confidence: number, correct: boolean }[]>([]);
    const [lossAttribution, setLossAttribution] = useState<{ name: string, value: number }[]>([]);
    const [historyPrediction, setHistoryPrediction] = useState<{ epoch: number, prediction: number, confidence: number, correct: boolean }[]>([]);

    useEffect(() => {
        console.log("hoveredIndex in detail panel: ", hoveredIndex);
        if (!hoveredIndex || !labels || !predProbability) {
            setImage('');
            setPredictions([]);
            setHistoryPrediction([]);
            setLossAttribution([]);
            return;
        }

        setImage(imageData);

        // current epoch prediction
        if (!predProbability[hoveredIndex]) { 
            setPredictions([]);
        }
        else {
            const softmaxProps = softmax(predProbability[hoveredIndex]);
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
        const historyPrediction: {epoch: number, prediction: number, confidence: number, correct: boolean}[] = [];
        // const epochId = availableEpochs.indexOf(epoch);
        // for (let i = epochId - 1; i >= Math.max(0, epochId - 5); i--) {
        //     const e = availableEpochs[i];
        //     const pred = allPrediction[e][hoveredIndex];
        //     historyPrediction.push({
        //         epoch: e,
        //         prediction: pred,
        //         confidence: allConfidence[e][hoveredIndex],
        //         correct: labels[hoveredIndex] === pred
        //     });
        // }
        setHistoryPrediction(historyPrediction);

        // loss attribution
        const sampleLoss = [
            { name: "CrossEntropy", value: Math.random() },
            { name: "L2-Regularization", value: Math.random() },
        ];
        setLossAttribution(sampleLoss);
    }, [hoveredIndex, imageData]);


    return (
        <ImageOverviewContainer>
            <ImagePanel>
                <DataLabel>
                    <IconWrapper><PictureOutlined /></IconWrapper>
                    Original Data
                </DataLabel>
                <ImageDisplayArea $isEmpty={hoveredIndex === undefined}>
                    {hoveredIndex === undefined ? (
                        <PlaceholderText>Image Display Area</PlaceholderText>
                    ) : (
                        <StyledImage src={image} alt="Image Overview" />
                    )}
                </ImageDisplayArea>
            </ImagePanel>
            
            <Divider></Divider>
            
            <DataPanel>
                <DataItem>
                    <DataLabel>
                        <IconWrapper><NumberOutlined /></IconWrapper>
                        Index
                    </DataLabel>
                    <DataValue>{hoveredIndex === undefined ? '' : hoveredIndex}</DataValue>
                </DataItem>
                
                <Divider></Divider>

                <DataItem>
                    <DataLabel>
                        <IconWrapper><TagOutlined /></IconWrapper>
                        Label
                    </DataLabel>
                    <DataValue>{hoveredIndex === undefined ? '' :labelDict.get(labels[hoveredIndex])}</DataValue>
                </DataItem>

                <Divider></Divider>
                
                <PredictionBlock>
                    <DataLabel>
                        <IconWrapper><BarChartOutlined /></IconWrapper>
                        Prediction
                    </DataLabel>
                    <PredictionContainer>
                        {predictions.map((prediction, index) => (
                            <PredictionItem key={index}>
                                <PredictionValue>
                                    {labelDict.get(prediction.value)}
                                </PredictionValue>
                                <ConfidenceBar $confidence={prediction.confidence} $correct={prediction.correct} />
                                <ConfidenceValue>
                                    {(prediction.confidence * 100).toFixed(1)}%
                                </ConfidenceValue>
                            </PredictionItem>
                        ))}
                    </PredictionContainer>
                </PredictionBlock>
            </DataPanel>

            <Divider></Divider>
            
            <DataPanel>
                <DataLabel>
                    <IconWrapper>< HistoryOutlined /></IconWrapper>
                    Prediction History
                </DataLabel>
                <PredictionHistoryContainer>
                    {historyPrediction.slice(-5).map((record, index) => (
                        <PredictionHistoryItem key={index}>
                            <HistoryEpoch>Epoch {record.epoch}:</HistoryEpoch>
                            <HistoryPrediction $correct={record.correct}>{labelDict.get(record.prediction)}</HistoryPrediction>
                            <HistoryConfidence>{(record.confidence * 100).toFixed(1)}%</HistoryConfidence>
                        </PredictionHistoryItem>
                    ))}
                </PredictionHistoryContainer>
            </DataPanel>

            <DataPanel> 
            </DataPanel>
{/* 
            <DataPanel>
                <DataLabel>
                    <IconWrapper><ArrowDownOutlined /></IconWrapper>
                    Sample Loss
                </DataLabel>

                <FormulaContainer>
                    <MathJaxProvider>
                        <MathJaxFormula formula="$$\text{Loss} = {\text{CrossEntropy}(y, \hat{y})} + {\lambda \|\theta\|^2}$$" />
                    </MathJaxProvider>
                </FormulaContainer>

                <LossBreakdown>
                    {lossAttribution.map((component, index) => (
                        <LossComponent key={index}>
                            <LossComponentBox>
                                {component.name}
                            </LossComponentBox>
                            <LossComponentValue>
                                {component.value.toFixed(4)}
                            </LossComponentValue>
                        </LossComponent>
                    ))}
                </LossBreakdown>
            </DataPanel> */}
        </ImageOverviewContainer>
    );
};

export default DetailPanel;

const ImageOverviewContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    height: 100%;
    width: 100%;
    background-color: white;
    padding: 10px;

    flex-direction: row;
    @media (max-width: 768px) {
        flex-direction: column;
    }
`;

const DataPanel = styled.div`
    flex: 1;
    display: flex;
    height: 100%;
    flex-direction: column;
    gap: 20px;
    align-items: flex-start;
`;

const DataItem = styled.div`
    display: flex;
    align-items: center;
    gap: 20px;
`;

const DataLabel = styled.span`
    font-size: 14px;
    color: #8c8c8c;
    font-weight: 500;
    display: flex;
    align-items: flex-start;
    gap: 2px;
`;

const DataValue = styled.span`
    font-family: 'Consolas', monospace;
    font-size: 14px;
    color: #262626;
    font-weight: 600;
`;

const PredictionBlock = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
`;

const PredictionContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: fit-content;
`;

const PredictionItem = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
`;

const PredictionValue = styled.span`
    font-family: 'Consolas', monospace;
    font-size: 13px;
    color: #262626;
    min-width: 60px;
    flex-shrink: 0;
    overflow: hidden;
`;

const ConfidenceBar = styled.div<{ $confidence: number, $correct: boolean }>`
    height: 6px;
    width: ${(props) => props.$confidence * 100}px;
    background-color: ${props => (props.$correct ? '#52c41a' : '#ff4d4f')};
    border-radius: 4px;
    flex-shrink: 0;
`;

const ConfidenceValue = styled.span`
    font-family: 'Consolas', monospace;
    font-size: 10px;
    color: #595959;
    flex-shrink: 0;
`;

const IconWrapper = styled.span`
    color: #8c8c8c;
    font-size: 14px;
`;

const ImagePanel = styled.div`
    flex: 1;
    flex-direction: column;
    padding-bottom: 10px;
    height: 100%;
    width: 100%;
    display: flex;
    overflow: hidden;
    gap: 10px;
    position: relative;
`;

const ImageDisplayArea = styled.div<{ $isEmpty: boolean }>`
    width: calc(100% - 20px);
    height: 100%;
    border: 2px dashed #d9d9d9;
    border-radius: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: ${props => (props.$isEmpty ? '#fafafa' : 'transparent')};
    overflow: hidden;
    margin-right: 20px; 
    box-sizing: border-box;
`;

const PlaceholderText = styled.div`
    font-size: 16px;
    color: #bfbfbf;
    text-align: center;
`;

const StyledImage = styled.img`
    max-width: 95%;
    max-height: 95%;
    width: auto;
    height: 95%;
    object-fit: contain;
    border-radius: 4px;
`;


// ================== Prediction History ======================
const PredictionHistoryContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    max-width: 240px;
`;

const PredictionHistoryItem = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    border: 1px solid #f0f0f0;
    border-radius: 4px;
    background-color: #fafafa;
    font-family: 'Consolas', monospace;
    font-size: 12px;
    color: #262626;
`;

const HistoryEpoch = styled.span`
    font-weight: 600;
    color: #595959;
    min-width: 24px;
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
    min-width: 40px;
    text-align: right;
`;

// ================== Formula ======================
const FormulaContainer = styled.div`
    height: 50%;
    width: 100%;
    font-size: 15px;
    display: flex;
    flex-direction: column;
    align-items: center;
`;

const LossBreakdown = styled.div`
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
`;

const LossComponent = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
`;

const LossComponentBox = styled.div`
    padding: 4px 8px;
    background-color: #e6f7ff;
    border-radius: 4px;
    font-family: 'Consolas', monospace;
    font-size: 12px;
    color: #262626;
`;

const LossComponentValue = styled.span`
    font-size: 12px;
    color: #595959;
`;