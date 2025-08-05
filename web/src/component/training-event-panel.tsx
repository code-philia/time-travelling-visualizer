import styled from 'styled-components';
import { Tag, Checkbox, Form, Button, Collapse } from 'antd';
import { useEffect, useState } from 'react';
import { FunctionalBlock } from './custom/basic-components';
import { useDefaultStore } from '../state/state.rightView';
import { notifyTrainingEventClicked } from '../communication/viewMessage';

const { Panel } = Collapse;

const predColor = (isCorrect: boolean) => (isCorrect ? '#52c41a' : '#ff4d4f');
const confArrow = (change: number) =>
  change > 0 ? <span style={{ color: '#52c41a', fontSize: '12px', fontWeight: '800', marginLeft: 2 }}>↑</span> : <span style={{ color: '#ff4d4f', fontSize: '12px', fontWeight: '800', marginLeft: 2 }}>↓</span>;

function softmax(probabilities: number[]): number[] {
  const maxProb = Math.max(...probabilities);
  const expProbs = probabilities.map((p) => Math.exp(p - maxProb));
  const sumExpProbs = expProbs.reduce((sum, p) => sum + p, 0);
  return expProbs.map((p) => p / sumExpProbs);
}

const CompactForm = styled(Form)`
  background-color: #ffffff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
`;

const FormHeader = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
`;

const CompactCheckboxGroup = styled(Checkbox.Group)`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;

  .ant-checkbox-wrapper {
    display: flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
    background-color: #ffffff;
    border: 1px solid #d9d9d9;
    
    &:hover {
      background-color: #f5f5f5;
      border-color: #1890ff;
    }
  }

  .ant-checkbox-checked .ant-checkbox-inner {
    background-color: #1890ff;
    border-color: #1890ff;
    width: 12px;
    height: 12px;
  }
  
  .ant-checkbox-inner {
    width: 12px;
    height: 12px;
  }
`;

const CompactButton = styled(Button)`
  background-color: #1890ff;
  color: #ffffff;
  border: none;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  height: 24px;
  
  &:hover {
    background-color: #40a9ff;
    color: #ffffff;
  }
`;

const ResultContainer = styled.div`
  background-color: #ffffff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  padding: 10px;
  height: 400px; /* 固定高度 */
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ResultHeader = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const EventsCount = styled.span`
  font-size: 11px;
  font-weight: normal;
  color: #888;
`;

const EventsContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  padding: 6px;
  background-color: #fafafa;
`;

const CompactEventItem = styled.div`
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-radius: 3px;
  transition: background-color 0.3s ease;
  cursor: pointer;
  font-size: 11px;
  margin-bottom: 2px;
  background-color: #ffffff;
  border: 1px solid #f0f0f0;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);

  &:hover {
    background-color: #f5f5f5;
    border-color: #d9d9d9;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  &:active {
    background-color: #e6f7ff;
  }
`;

const CompactEventIndex = styled(Tag)`
  font-size: 10px;
  font-weight: 600;
  min-width: 30px;
  text-align: center;
  margin-right: 6px;
  padding: 0 4px;
  line-height: 18px;
`;

const EventContent = styled.div`
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
`;

const CompactEventLabel = styled.span`
  color: #888;
  font-size: 10px;
`;

const CompactEventValue = styled.span<{ $color?: string }>`
  font-weight: 600;
  font-size: 11px;
  color: ${props => props.$color || '#333'};
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #bfbfbf;
  font-size: 11px;
`;

const CompactEventTypePanel = styled(Panel)`
  .ant-collapse-header {
    padding: 6px 10px !important;
    background-color: #f0f0f0;
    border-radius: 3px;
    font-weight: 600;
    font-size: 11px;
  }
  
  .ant-collapse-content-box {
    padding: 4px 0 !important;
  }
  
  .ant-collapse-expand-icon {
    font-size: 12px;
  }
`;

export function TrainingEventPanel() {
  const [tempSelectedTypes, setTempSelectedTypes] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [predictionFlips, setPredictionFlips] = useState<any[]>([]);
  const [confidenceChanges, setConfidenceChanges] = useState<any[]>([]);
  const [significantMovements, setSignificantMovements] = useState<any[]>([]);
  const [inconsistentMovements, setInconsistentMovements] = useState<any[]>([]);
  const { epoch, availableEpochs, allEpochData, labels, labelDict } = useDefaultStore([
    "epoch",
    "availableEpochs",
    "allEpochData",
    "labels",
    "labelDict",
  ]);

  const handleFormSubmit = () => {
    setSelectedTypes(tempSelectedTypes);
    calculateEvents(tempSelectedTypes);
  };

  const calculateEvents = (types: string[]) => {
    if (types.includes('PredictionFlip')) {
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
                label: labelDict.get(label) || label.toString(),
                prevPred: labelDict.get(prevPred) || prevPred.toString(),
                currPred: labelDict.get(currPred) || currPred.toString(),
                prevCorrect,
                currCorrect,
                influenceTarget: labelDict.get(currPred) || currPred.toString(),
                type: 'PredictionFlip',
              };
            }
            return null;
          })
          .filter(Boolean);
        setPredictionFlips(flips);
      }
      else {
        setPredictionFlips([]);
      }
    }

    if (types.includes('ConfidenceChange')) {
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
              if (Math.abs(currProb - prevProb) > 0.5) {
                // Find the category with the largest score increase
                let maxIncrease = -Infinity;
                let influenceTarget = '';
                currSoftmax.forEach((score, category) => {
                  const increase = score - prevSoftmax[category];
                  if (increase > maxIncrease) {
                    maxIncrease = increase;
                    influenceTarget = labelDict.get(category) || category.toString();
                  }
                });
                return {
                  index,
                  label: labelDict.get(label) || label.toString(),
                  prevConf: prevProb,
                  currConf: currProb,
                  change: currProb - prevProb,
                  influenceTarget: influenceTarget,
                  type: 'ConfidenceChange',
                };
              }
            }
            return null;
          })
          .filter(Boolean)
          .sort((a, b) => Math.abs(b.change) - Math.abs(a.change)); // Sort by absolute change
        setConfidenceChanges(changes);
      } else {
        setConfidenceChanges([]);
      }
    }

    if (types.includes('SignificantMovement')) {
        const currentEpochIndex = availableEpochs.indexOf(epoch);
        const lastEpoch = availableEpochs[availableEpochs.length - 1];
        
        if (currentEpochIndex > 0 && lastEpoch !== undefined) {
            const prevEpoch = availableEpochs[currentEpochIndex - 1];
            
            // compute distance changes
            const closerDistChanges: number[] = [];
            const fartherDistChanges: number[] = [];
            const movementData = labels.map((_, index) => {
                const prevEmbedding = allEpochData[prevEpoch]?.embedding[index];
                const currEmbedding = allEpochData[epoch]?.embedding[index];
                const lastEmbedding = allEpochData[lastEpoch]?.embedding[index];
                
                if (prevEmbedding && currEmbedding && lastEmbedding) {
                    const prevDist = Math.hypot(...prevEmbedding.map((v, i) => v - lastEmbedding[i]));
                    const currDist = Math.hypot(...currEmbedding.map((v, i) => v - lastEmbedding[i]));
                    
                    const distChange = currDist - prevDist;
                    
                    if (distChange < 0) {
                        closerDistChanges.push(Math.abs(distChange));
                    } else if (distChange > 0) {
                        fartherDistChanges.push(distChange);
                    }
                    
                    return {
                        index,
                        prevDist,
                        currDist,
                        distChange,
                    };
                }
                return null;
            }).filter(Boolean);
            
            // determine dynamic thresholds based on standard deviation
            let CLOSER_THRESHOLD = 0.5;
            let FARTHER_THRESHOLD = 0.5;
            
            if (closerDistChanges.length > 0) {
                const mean = closerDistChanges.reduce((sum, val) => sum + val, 0) / closerDistChanges.length;
                const variance = closerDistChanges.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / closerDistChanges.length;
                const stdDev = Math.sqrt(variance);
                CLOSER_THRESHOLD = mean + 2 * stdDev;
                console.log(`Closer Movement Threshold: ${CLOSER_THRESHOLD.toFixed(4)}`);
            }
            
            if (fartherDistChanges.length > 0) {
                const mean = fartherDistChanges.reduce((sum, val) => sum + val, 0) / fartherDistChanges.length;
                const variance = fartherDistChanges.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / fartherDistChanges.length;
                const stdDev = Math.sqrt(variance);
                FARTHER_THRESHOLD = mean + 2 * stdDev;
                console.log(`Farther Movement Threshold: ${FARTHER_THRESHOLD.toFixed(4)}`);
            }
            
            // select significant movements based on thresholds
            const movements = movementData
                .filter(data => 
                    (data.distChange < 0 && Math.abs(data.distChange) > CLOSER_THRESHOLD) || // 显著靠近
                    (data.distChange > 0 && data.distChange > FARTHER_THRESHOLD) // 显著远离
                )
                .map(data => ({
                    index: data.index,
                    prevDist: data.prevDist.toFixed(2),
                    currDist: data.currDist.toFixed(2),
                    distanceChange: data.distChange.toFixed(2),
                    type: data.distChange < 0 ? 'SignificantMovementCloser' : 'SignificantMovementFarther',
                }))
                .sort((a, b) => Math.abs(parseFloat(b.distanceChange)) - Math.abs(parseFloat(a.distanceChange))); // Sort by absolute distanceChange
            
            setSignificantMovements(movements);
        } else {
            setSignificantMovements([]);
        }
    }
    
    if (types.includes('InconsistentMovement')) {
      const currentEpochIndex = availableEpochs.indexOf(epoch);
      const lastEpoch = availableEpochs[availableEpochs.length - 1];
      if (currentEpochIndex > 0 && lastEpoch !== undefined) {
        const prevEpoch = availableEpochs[currentEpochIndex - 1];
        const inconsistencies = labels
          .map((_, index) => {
            const prevEmbedding = allEpochData[prevEpoch]?.embedding[index];
            const currEmbedding = allEpochData[epoch]?.embedding[index];
            const prevProjection = allEpochData[prevEpoch]?.projection[index];
            const currProjection = allEpochData[epoch]?.projection[index];
            const lastEmbedding = allEpochData[lastEpoch]?.embedding[index];
            const lastProjection = allEpochData[lastEpoch]?.projection[index];

            if (prevEmbedding && currEmbedding && prevProjection && currProjection && lastEmbedding && lastProjection) {
              const prevEmbeddingDist = Math.hypot(...prevEmbedding.map((v, i) => v - lastEmbedding[i]));
              const currEmbeddingDist = Math.hypot(...currEmbedding.map((v, i) => v - lastEmbedding[i]));
              const prevProjectionDist = Math.hypot(...prevProjection.map((v, i) => v - lastProjection[i]));
              const currProjectionDist = Math.hypot(...currProjection.map((v, i) => v - lastProjection[i]));

              const embeddingDistChange = currEmbeddingDist - prevEmbeddingDist;
              const projectionDistChange = currProjectionDist - prevProjectionDist;

              if (
                (embeddingDistChange < 0 && projectionDistChange > 0) ||
                (embeddingDistChange > 0 && projectionDistChange < 0)
              ) {
                return {
                  index,
                  highDimChange: embeddingDistChange.toFixed(2),
                  projectionChange: projectionDistChange.toFixed(2),
                  type: 'InconsistentMovement',
                };
              }
            }
            return null;
          })
          .filter(Boolean)
          .sort((a, b) => Math.abs(parseFloat(b.highDimChange)) - Math.abs(parseFloat(a.highDimChange))); // Sort by absolute highDimChange
        setInconsistentMovements(inconsistencies);
        console.log('Inconsistent Movements:', inconsistencies);
      }
      else {
        setInconsistentMovements([]);
      }
    }
  };

  useEffect(() => {
    if (selectedTypes.length > 0) {
      calculateEvents(selectedTypes);
    }
  }, [epoch]);

  const combinedData = [
    ...(selectedTypes.includes('PredictionFlip') ? predictionFlips.map(item => ({ ...item, type: 'PredictionFlip' })) : []),
    ...(selectedTypes.includes('ConfidenceChange') ? confidenceChanges.map(item => ({ ...item, type: 'ConfidenceChange' })) : []),
    ...(selectedTypes.includes('SignificantMovement') ? significantMovements.map(item => ({ ...item, type: 'SignificantMovement' })) : []),
    ...(selectedTypes.includes('InconsistentMovement') ? inconsistentMovements.map(item => ({ ...item, type: 'InconsistentMovement' })) : []),
  ];

  // Group events by type
  const groupedEvents = {
    PredictionFlip: combinedData.filter(item => item.type === 'PredictionFlip'),
    ConfidenceChange: combinedData.filter(item => item.type === 'ConfidenceChange'),
    SignificantMovement: combinedData.filter(item => item.type === 'SignificantMovement'),
    InconsistentMovement: combinedData.filter(item => item.type === 'InconsistentMovement'),
  };

  const handleItemClick = (item: any) => {
    notifyTrainingEventClicked(item, epoch);
  };

  // Function to render events by type
  const renderEventItem = (item: any) => {
    return (
      <CompactEventItem key={`${item.type}-${item.index}`} onClick={() => handleItemClick(item)}>
        <CompactEventIndex color={getTypeColor(item.type)}>#{item.index}</CompactEventIndex>
        <EventContent>
          {item.type === 'PredictionFlip' && (
            <>
              <CompactEventLabel>Pred:</CompactEventLabel>
              <CompactEventValue $color={predColor(item.prevCorrect)}>{item.prevPred}</CompactEventValue>
              <CompactEventLabel>→</CompactEventLabel>
              <CompactEventValue $color={predColor(item.currCorrect)}>{item.currPred}</CompactEventValue>
            </>
          )}
          {item.type === 'ConfidenceChange' && (
            <>
              <CompactEventLabel>Label:</CompactEventLabel>
              <CompactEventValue>{item.label}</CompactEventValue>
              <CompactEventLabel>Conf:</CompactEventLabel>
              <CompactEventValue>{item.prevConf.toFixed(2)}</CompactEventValue>
              <CompactEventLabel>→</CompactEventLabel>
              <CompactEventValue>{item.currConf.toFixed(2)}</CompactEventValue>
              {confArrow(item.change)}
            </>
          )}
          {item.type === 'SignificantMovement' && (
            <>
              <CompactEventLabel>Distance Δ:</CompactEventLabel>
              <CompactEventValue>
                {item.distanceChange}
                <span style={{ color: parseFloat(item.distanceChange) > 0 ? '#ff4d4f' : '#52c41a', fontSize: '14px', marginLeft: 4 }}>
                  {parseFloat(item.distanceChange) > 0 ? '↑' : '↓'}
                </span>
              </CompactEventValue>
            </>
          )}
          {item.type === 'InconsistentMovement' && (
            <>
              <CompactEventLabel>High Dim Δ:</CompactEventLabel>
              <CompactEventValue>
                {item.highDimChange}
                <span style={{ color: parseFloat(item.highDimChange) > 0 ? '#ff4d4f' : '#52c41a', fontSize: '14px', marginLeft: 4 }}>
                  {parseFloat(item.highDimChange) > 0 ? '↑' : '↓'}
                </span>
              </CompactEventValue>
              <CompactEventLabel>Projection Δ:</CompactEventLabel>
              <CompactEventValue>
                {item.projectionChange}
                <span style={{ color: parseFloat(item.projectionChange) > 0 ? '#ff4d4f' : '#52c41a', fontSize: '14px', marginLeft: 4 }}>
                  {parseFloat(item.projectionChange) > 0 ? '↑' : '↓'}
                </span>
              </CompactEventValue>
            </>
          )}
        </EventContent>
      </CompactEventItem>
    );
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PredictionFlip': return 'blue';
      case 'ConfidenceChange': return 'purple';
      case 'SignificantMovement': return 'orange';
      case 'InconsistentMovement': return 'red';
      default: return 'gray';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'PredictionFlip': return 'Prediction Flips';
      case 'ConfidenceChange': return 'Confidence Changes';
      case 'SignificantMovement': return 'Significant Movements';
      case 'InconsistentMovement': return 'Inconsistent Movements';
      default: return 'Events';
    }
  };

  return (
    <div className="info-column" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <FunctionalBlock label="Training Events">
        <CompactForm>
          <FormHeader>Please select training events to show</FormHeader>
          <Form.Item style={{ marginBottom: 10 }}>
            <CompactCheckboxGroup
              options={[
                { label: 'Prediction Flip', value: 'PredictionFlip' },
                { label: 'Confidence Change', value: 'ConfidenceChange' },
                { label: 'Significant Movement', value: 'SignificantMovement' },
                { label: 'Inconsistent Movement', value: 'InconsistentMovement' },
              ]}
              onChange={(checkedValues) => setTempSelectedTypes(checkedValues as string[])}
              value={tempSelectedTypes}
            />
          </Form.Item>
          <CompactButton onClick={handleFormSubmit}>Apply</CompactButton>
        </CompactForm>
        
        <ResultContainer>
          <ResultHeader>
            Detected Training Events
            <EventsCount>{combinedData.length} events</EventsCount>
          </ResultHeader>
          <EventsContainer>
            {selectedTypes.length === 0 ? (
              <EmptyState>Click "Apply" to see results</EmptyState>
            ) : combinedData.length === 0 ? (
              <EmptyState>No events detected with current filters</EmptyState>
            ) : (
              <Collapse
                defaultActiveKey={selectedTypes}
                bordered={false}
                style={{ background: 'transparent' }}
              >
                {selectedTypes.map(type => (
                  groupedEvents[type]?.length > 0 && (
                    <CompactEventTypePanel
                      key={type}
                      header={
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <Tag 
                            color={getTypeColor(type)} 
                            style={{ 
                              marginRight: 6, 
                              fontSize: '10px', 
                              lineHeight: '16px',
                              padding: '0 4px',
                              minWidth: '24px'
                            }}
                          >
                            {groupedEvents[type].length}
                          </Tag>
                          <span style={{ fontSize: '11px' }}>{getTypeLabel(type)}</span>
                        </div>
                      }
                    >
                      {groupedEvents[type].map(item => renderEventItem(item))}
                    </CompactEventTypePanel>
                  )
                ))}
              </Collapse>
            )}
          </EventsContainer>
        </ResultContainer>
      </FunctionalBlock>
    </div>
  );
}

export default TrainingEventPanel;