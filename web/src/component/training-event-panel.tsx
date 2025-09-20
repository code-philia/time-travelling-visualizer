import styled from 'styled-components';
import { Tag, Checkbox, Form, Button, Collapse } from 'antd';
import { useEffect, useState } from 'react';
import { FunctionalBlock } from './custom/basic-components';
import { useDefaultStore } from '../state/state.rightView';
import { notifyCalculateEvents, notifyFocusModeSwitch, notifyTracingInfluence, notifyTrainingEventClicked } from '../communication/viewMessage';
import { TrainingEvent } from './types';

const { Panel } = Collapse;

const predColor = (isCorrect: boolean) => (isCorrect ? '#52c41a' : '#ff4d4f');
const confArrow = (change: number) =>
  change > 0 ? <span style={{ color: '#52c41a', fontSize: '12px', fontWeight: '800', marginLeft: 2 }}>↑</span> : <span style={{ color: '#ff4d4f', fontSize: '12px', fontWeight: '800', marginLeft: 2 }}>↓</span>;

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
  width: 80px;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: #40a9ff;
    color: #40a9ff;
  }

  &:active {
    background-color: #096dd9;
    transform: scale(0.98); /* 轻微的点击效果 */
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

const CompactEventItem = styled.div<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-radius: 3px;
  transition: all 0.3s ease;
  cursor: pointer;
  font-size: 11px;
  margin-bottom: 2px;
  background-color: ${props => props.$selected ? '#e6f7ff' : '#ffffff'};
  border: 1px solid ${props => props.$selected ? '#1890ff' : '#f0f0f0'};
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
  position: relative;

  &:hover {
    background-color: ${props => props.$selected ? '#e6f7ff' : '#f5f5f5'};
    border-color: ${props => props.$selected ? '#1890ff' : '#d9d9d9'};
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

const TracingButton = styled(Button)`
  background-color: #1890ff;
  color: #ffffff;
  border: none;
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  height: 20px;
  width: 35px;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: #40a9ff;
    color: #40a9ff;
  }

  &:active {
    background-color: #096dd9;
    transform: scale(0.98); /* 轻微的点击效果 */
  }
`;

export function TrainingEventPanel() {
  const [tempSelectedTypes, setTempSelectedTypes] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedTrainingEvents, setSelectedTrainingEvents] = useState<TrainingEvent[]>([]);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [groupedEvents, setGroupedEvents] = useState<Record<string, TrainingEvent[]>>({});

  const { epoch, trainingEvents } = useDefaultStore(["epoch", "trainingEvents"]);

  const handleFormSubmit = () => {
    const newTypes = tempSelectedTypes.filter(type => !selectedTypes.includes(type));
    setSelectedTypes(tempSelectedTypes);
    if (newTypes.length > 0) {
      notifyCalculateEvents(epoch, newTypes);
    }
  };

  useEffect(() => {
    // Group events by type whenever trainingEvents change
    const grouped: Record<string, TrainingEvent[]> = {};
    trainingEvents.forEach(event => {
      if (!grouped[event.type]) {
        grouped[event.type] = [];
      }
      grouped[event.type].push(event);
    });
    setGroupedEvents(grouped);
  }, [trainingEvents]);

  const toggleFocusMode = () => {
    setIsFocusMode(!isFocusMode);
  };

  useEffect(() => {
    if (isFocusMode) {
      const focusIndices = trainingEvents.map(event => event.index);
      for(const event of trainingEvents) {
        if(event.type === "InconsistentMovement" && event.index1 !== undefined) {
          focusIndices.push(event.index1);
        }
      }
      notifyFocusModeSwitch(true, focusIndices);
    }
    else {
      notifyFocusModeSwitch(false);
    }
  }, [isFocusMode, trainingEvents]);

  useEffect(() => {
    // Re-compute events when epoch changes
    if (selectedTypes.length > 0) {
      notifyCalculateEvents(epoch, selectedTypes);
    }
    // Reset selected training events when epoch changes
    setSelectedTrainingEvents([]);
    notifyTrainingEventClicked([]);
  }, [epoch]);

  const handleTracingClick = (event: React.MouseEvent, item: TrainingEvent) => {
    event.stopPropagation(); // 阻止事件冒泡，避免触发 item 的点击事件
    notifyTracingInfluence(item, epoch);
  };

  const handleItemClick = (item: TrainingEvent) => {
    const newSelectedEvents = selectedTrainingEvents.includes(item)
      ? selectedTrainingEvents.filter(event => event !== item)
      : [...selectedTrainingEvents, item];
    
    setSelectedTrainingEvents(newSelectedEvents);
    notifyTrainingEventClicked(newSelectedEvents);
  };

  // Function to render events by type
  const renderEventItem = (item: TrainingEvent) => {
    const isSelected = selectedTrainingEvents.some(
      selectedEvent => {
        if (selectedEvent.type === item.type && selectedEvent.index === item.index) {
          if (item.type === "InconsistentMovement" && selectedEvent.type === "InconsistentMovement") {
            return selectedEvent.index1 === item.index1;
          }
          return true;
        }
        return false;
      }
    );
    return (
      <CompactEventItem key={`${item.type}-${item.index}`} onClick={() => handleItemClick(item)} $selected={isSelected}>
        { item.type !== 'InconsistentMovement' && (<CompactEventIndex color={getTypeColor(item.type)}>#{item.index}</CompactEventIndex>)}
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
                {item.distanceChange.toFixed(2)}
                <span style={{ color: item.distanceChange > 0 ? '#ff4d4f' : '#52c41a', fontSize: '14px', marginLeft: 4 }}>
                  {item.distanceChange > 0 ? '↑' : '↓'}
                </span>
              </CompactEventValue>
            </>
          )}
          {item.type === 'InconsistentMovement' && (
            <>
              <CompactEventValue>
                #{item.index} vs #{item.index1}
              </CompactEventValue>
              <CompactEventLabel>Expected:</CompactEventLabel>
              <CompactEventValue $color={item.expectation === 'Aligned' ? '#52c41a' : '#ff4d4f'}>
                {item.expectation}
              </CompactEventValue>
            </>
          )}
        </EventContent>
        <TracingButton 
          onClick={(e) => handleTracingClick(e, item)}
        >
          Trace
        </TracingButton>
      </CompactEventItem>
    );
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PredictionFlip': return '#0077dd';
      case 'ConfidenceChange': return '#ff7722';
      case 'SignificantMovement': return '#00bbdd';
      case 'InconsistentMovement': return '#ff6699';
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <CompactButton onClick={handleFormSubmit}>Compute</CompactButton>
            <CompactButton 
              onClick={toggleFocusMode}
            >
              {isFocusMode ? 'Show All' : 'Show Selected'}
            </CompactButton>
          </div>
        </CompactForm>
        
        <ResultContainer>
          <ResultHeader>
            Detected Training Events
            <EventsCount>{trainingEvents.length} events</EventsCount>
          </ResultHeader>
          <EventsContainer>
            {selectedTypes.length === 0 ? (
              <EmptyState>Click "Compute" to see results</EmptyState>
            ) : trainingEvents.length === 0 ? (
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
