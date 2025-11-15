import styled from 'styled-components';
import { Tag, Form, Button, Collapse, Select } from 'antd';
import { useEffect, useState } from 'react';
import { FunctionalBlock } from './custom/basic-components';
import { useDefaultStore } from '../state/state.unified';
import { notifyCalculateEvents, notifyFocusModeSwitch, notifyTracingInfluence, notifyTrainingEventClicked } from '../communication/extension';
import { TrainingEvent, InconsistentMovementEvent, PredictionFlipEvent, ConfidenceChangeEvent, SignificantMovementEvent } from './types';

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

const CompactSelect = styled(Select)`
  width: 100%;

  .ant-select-selector {
    border-radius: 3px !important;
    height: 28px !important;
    display: flex;
    align-items: center;
    padding: 0 8px !important;
    font-size: 12px;
  }

  .ant-select-selection-item,
  .ant-select-selection-placeholder {
    font-size: 12px;
  }

  .ant-select-arrow {
    font-size: 10px;
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
  height: 100%;
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
  margin-bottom: 0;
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

const InconsistentRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const InconsistentPair = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: #333;
`;

const InconsistentType = styled.span<{ $positive?: boolean }>`
  font-size: 10px;
  font-weight: 600;
  color: ${props => props.$positive ? '#52c41a' : '#ff4d4f'};
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

const getTypeColor = (type: string) => {
  switch (type) {
    case 'PredictionFlip': return '#0077dd';
    case 'ConfidenceChange': return '#ff7722';
    case 'SignificantMovement': return '#00bbdd';
    case 'InconsistentMovement': return '#ff6699';
    default: return 'gray';
  }
};

const getInconsistentDescription = (event: InconsistentMovementEvent) => {
  if (event.expectation === 'Aligned' && event.behavior === 'NotAligned') {
    return 'Abnormally Far Distance';
  }
  if (event.expectation === 'NotAligned' && event.behavior === 'Aligned') {
    return 'Abnormally Close Proximity';
  }
  return 'Unexpected Movement Pattern';
};

const getInconsistentType = (event: InconsistentMovementEvent) =>
  event.expectation === 'Aligned' && event.behavior === 'NotAligned' ? 'Positive' : 'Negative';

type EventSubGroup = {
  key: string;
  title: string;
  events: TrainingEvent[];
};

const getSubGroupsForType = (type: TrainingEvent['type'] | undefined, events: TrainingEvent[]): EventSubGroup[] => {
  if (!type) {
    return [];
  }

  switch (type) {
    case 'PredictionFlip': {
      const typedEvents = events as PredictionFlipEvent[];
      return [
        {
          key: 'became-correct',
          title: 'Became Correct Predictions',
          events: typedEvents.filter(event => event.currCorrect),
        },
        {
          key: 'turned-incorrect',
          title: 'Turned Incorrect Predictions',
          events: typedEvents.filter(event => event.prevCorrect && !event.currCorrect),
        },
        {
          key: 'remained-incorrect',
          title: 'Remained Incorrect Predictions',
          events: typedEvents.filter(event => !event.prevCorrect && !event.currCorrect),
        },
      ].filter(group => group.events.length > 0);
    }
    case 'ConfidenceChange': {
      const typedEvents = events as ConfidenceChangeEvent[];
      return [
        {
          key: 'confidence-increase',
          title: 'Confidence Increased',
          events: typedEvents.filter(event => event.change > 0),
        },
        {
          key: 'confidence-decrease',
          title: 'Confidence Decreased',
          events: typedEvents.filter(event => event.change < 0),
        },
      ].filter(group => group.events.length > 0);
    }
    case 'SignificantMovement': {
      const typedEvents = events as SignificantMovementEvent[];
      return [
        {
          key: 'moved-away',
          title: 'Moved Away from Target',
          events: typedEvents.filter(event => event.distanceChange > 0),
        },
        {
          key: 'moved-toward',
          title: 'Moved Toward Target',
          events: typedEvents.filter(event => event.distanceChange < 0),
        },
      ].filter(group => group.events.length > 0);
    }
    case 'InconsistentMovement': {
      const typedEvents = events as InconsistentMovementEvent[];
      return [
        {
          key: 'abnormally-close',
          title: 'Abnormally Close Pairs',
          events: typedEvents.filter(event => event.expectation === 'NotAligned' && event.behavior === 'Aligned'),
        },
        {
          key: 'abnormally-far',
          title: 'Abnormally Far Pairs',
          events: typedEvents.filter(event => event.expectation === 'Aligned' && event.behavior === 'NotAligned'),
        },
      ].filter(group => group.events.length > 0);
    }
    default:
      return [];
  }
};

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
    event.stopPropagation(); 
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
    const itemKey = item.type === 'InconsistentMovement'
      ? `${item.type}-${item.index}-${item.index1}`
      : `${item.type}-${item.index}`;
    return (
      <CompactEventItem key={itemKey} onClick={() => handleItemClick(item)} $selected={isSelected}>
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
            <InconsistentRow>
              <InconsistentPair>Pair: ({item.index}, {item.index1})</InconsistentPair>
              <InconsistentType $positive={getInconsistentType(item) === 'Positive'}>
                {getInconsistentType(item)} Pair
              </InconsistentType>
            </InconsistentRow>
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

  const activeType = selectedTypes[0] as 'PredictionFlip' | 'ConfidenceChange' | 'SignificantMovement' | 'InconsistentMovement' | undefined;
  const activeEvents = activeType ? groupedEvents[activeType] ?? [] : [];
  const subGroups = getSubGroupsForType(activeType, activeEvents);
  const collapseDefaultKeys = subGroups.map(group => group.key);
  const eventsCount = activeType ? activeEvents.length : trainingEvents.length;

  return (
    <div className="info-column" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <FunctionalBlock label="Training Events">
        <CompactForm>
          <FormHeader>Please select training events to show</FormHeader>
          <Form.Item style={{ marginBottom: 10 }}>
            <CompactSelect
              placeholder="Select a training event type"
              options={[
                { label: 'Prediction Flip', value: 'PredictionFlip' },
                { label: 'Confidence Change', value: 'ConfidenceChange' },
                { label: 'Significant Movement', value: 'SignificantMovement' },
                { label: 'Inconsistent Movement', value: 'InconsistentMovement' },
              ]}
              allowClear
              value={tempSelectedTypes[0] ?? undefined}
              onChange={(value) => {
                if (!value) {
                  setTempSelectedTypes([]);
                  return;
                }
                setTempSelectedTypes([value as string]);
              }}
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
            <EventsCount>{eventsCount} events</EventsCount>
          </ResultHeader>
          <EventsContainer>
            {selectedTypes.length === 0 ? (
              <EmptyState>Click "Compute" to see results</EmptyState>
            ) : activeEvents.length === 0 ? (
              <EmptyState>No events detected with current filters</EmptyState>
            ) : subGroups.length === 0 ? (
              <EmptyState>No events detected with current filters</EmptyState>
            ) : (
              <Collapse
                defaultActiveKey={collapseDefaultKeys}
                bordered={false}
                style={{ background: 'transparent' }}
              >
                {subGroups.map(group => (
                  <CompactEventTypePanel
                    key={group.key}
                    header={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px' }}>
                        <span>{group.title}</span>
                        <span style={{ color: '#888' }}>({group.events.length})</span>
                      </div>
                    }
                  >
                    {group.events.map(item => renderEventItem(item))}
                  </CompactEventTypePanel>
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
