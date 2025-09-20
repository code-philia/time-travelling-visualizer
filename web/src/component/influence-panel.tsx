import React, { useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { useDefaultStore, InfluenceSample } from '../state/state.influenceView';
import { TrainingEvent } from './types';

const GlobalStyles = createGlobalStyle`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    font-size: 13px;
  }
`;

const PanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #fff;
  overflow: hidden;
  color: #333;
`;

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: 8px;
  gap: 10px;
  background: #f5f5f5;
`;

const EventPanel = styled.div`
  flex: 0 0 240px;
  background: #fff;
  border-radius: 3px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid #ddd;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  overflow-y: auto; /* 添加滚动 */
`;

const EventHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid #eaeaea;
  
  h2 {
    font-size: 11px;
    font-weight: 600;
    color: #333;
  }
`;

const EventTypeBadge = styled.span<{ $type: string }>`
  background: ${({ $type }) => 
    $type === "PredictionFlip" ? "#4a6cf7" : 
    $type === "ConfidenceChange" ? "#4caf50" :
    $type === "SignificantMovement" ? "#ff9800" :
    $type === "InconsistentMovement" ? "#9c27b0" :
    "#888"};
  color: white;
  padding: 1px 6px;
  border-radius: 2px;
  font-size: 9px;
  font-weight: 600;
`;

const EventContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const EventDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  background: #f8f8f8;
  border-radius: 3px;
  font-size: 11px;
  border: 1px solid #eaeaea;
  
  .section-title {
    font-weight: 600;
    color: #555;
    padding-bottom: 3px;
    border-bottom: 1px solid #eaeaea;
    font-size: 10px;
  }
  
  .detail-row {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px;
    padding: 1px 0;
    
    .detail-label {
      font-weight: 500;
      color: #666;
      font-size: 10px;
    }
    
    .detail-value {
      font-weight: 500;
      color: #222;
      font-size: 10px;
    }
  }
`;

const InfluencePanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 3px;
  border: 1px solid #ddd;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
`;

const InfluenceHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: #f0f0f0;
  border-bottom: 1px solid #ddd;
  
  h2 {
    font-size: 11px;
    font-weight: 600;
    color: #333;
  }
`;

const FilterBar = styled.div`
  display: flex;
  gap: 4px;
  
  button {
    padding: 3px 6px;
    border-radius: 2px;
    border: 1px solid #ccc;
    background: #f0f0f0;
    color: #333;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.1s;
    
    &:hover { background: #e0e0e0; }
    &.active { background: #3f51b5; color: white; border-color: #3f51b5; }
  }
`;

const InfluenceContent = styled.div`
  flex: 1;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
`;

const InfluenceSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  
  h3 {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    color: #333;
    padding-bottom: 3px;
    border-bottom: 1px solid #eaeaea;
    
    span {
      padding: 1px 4px;
      background: ${({ $positive }) => $positive ? '#e8f5e9' : '#ffebee'};
      color: ${({ $positive }) => $positive ? '#388e3c' : '#d32f2f'};
      border-radius: 2px;
      font-size: 9px;
    }
  }
`;

// -- 旧版图片网格 --
const InfluenceImageList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 6px;
`;

const InfluenceImageCard = styled.div<{ $positive: boolean }>`
  border-radius: 2px;
  overflow: hidden;
  background: ${({ $positive }) => $positive ? '#e8f5e9' : '#ffebee'};
  border: 1px solid ${({ $positive }) => $positive ? '#c8e6c9' : '#ffcdd2'};
  transition: all 0.1s;
  cursor: pointer;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
`;

const InfluenceImage = styled.img`
  width: 100%;
  height: 50px;
  object-fit: cover;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
`;

const InfluenceInfo = styled.div<{ $positive: boolean }>`
  padding: 3px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-size: 7px;
`;

const InfluenceTextList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const InfluenceTextRowStyled = styled.div<{ $positive: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 3px;
  background: ${({ $positive }) => $positive ? '#f1f8e9' : '#ffebee'};
  border: 1px solid ${({ $positive }) => $positive ? '#dcedc8' : '#ffcdd2'};
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: ${({ $positive }) => $positive ? '#e9f5e2' : '#ffeaef'};
  }

  .index {
    font-size: 10px;
    font-weight: 600;
    color: #555;
    min-width: 35px;
  }

  .score {
    font-size: 11px;
    font-weight: 600;
    min-width: 55px;
    text-align: right;
    color: ${({ $positive }) => $positive ? '#388e3c' : '#d32f2f'};
  }
`;

const TextDataContainer = styled.div`
  flex: 1;
  font-size: 11px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PairedTextContainer = styled.div`
  display: flex;
  flex: 1;
  gap: 6px;
  overflow: hidden;

  .text-snippet {
    flex: 1;
    border-left: 2px solid #ccc;
    padding-left: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    .label {
      font-size: 9px;
      font-weight: 600;
      color: #777;
      display: block;
    }
  }
`;

const ExpandedView = styled.div<{ $show: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: ${({ $show }) => $show ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ExpandedCard = styled.div`
  background: white;
  border-radius: 4px;
  width: 90%;
  max-width: 800px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
`;

const ExpandedHeader = styled.div`
  padding: 6px 10px;
  background: #3f51b5;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h3 { font-size: 12px; font-weight: 500; }
  button { background: none; border: none; color: white; font-size: 16px; cursor: pointer; padding: 2px; }
`;

const ExpandedContent = styled.div`
  padding: 12px;
  display: flex;
  gap: 15px;
  overflow-y: auto;
`;

const ExpandedImage = styled.img`
  width: 140px;
  height: 140px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #eaeaea;
`;

const ExpandedDetails = styled.div<{ $positive?: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 11px;
  /* ... (其余样式无修改) */
`;

const ExpandedTextContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const ExpandedPairedTextWrapper = styled.div`
  display: flex;
  gap: 10px;
  flex: 1;
`;

const ExpandedTextColumn = styled.div`
  flex: 1;
  background-color: #f8f8f8;
  border: 1px solid #eaeaea;
  border-radius: 3px;
  padding: 8px;
  overflow-y: auto;

  h4 {
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid #ddd;
  }

  pre {
    white-space: pre-wrap;
    word-wrap: break-word;
    font-size: 12px;
    line-height: 1.5;
    font-family: 'Courier New', Courier, monospace;
  }
`;

const truncateText = (text: string, maxLength = 100) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const DataContainer = styled.div`
  padding: 6px;
  background: #f8f8f8;
  border-radius: 3px;
  border: 1px solid #eaeaea;
  font-size: 11px;
  line-height: 1.4;
  max-height: 80px;
  overflow-y: auto;
  text-align: left;
  word-break: break-word;
`;

const DataImage = styled.img`
  width: 100%;
  max-width: 120px;
  height: auto;
  border-radius: 3px;
  object-fit: cover;
  border: 1px solid #eaeaea;
  background: #f8f8f8;
  align-self: center;
`;

const PairedDataContainer = styled.div`
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: flex-start;
  
  .data-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    
    .item-label {
      font-size: 10px;
      font-weight: 600;
      color: #555;
    }
  }
`;

/**
 * 可重用组件，用于根据 dataType 显示图片或文本
 */
const DataDisplay = ({ data, dataType, altText }: { data?: string; dataType?: 'image' | 'text'; altText: string; }) => {
  if (!data) return null;
  
  if (dataType === 'image') {
    return <DataImage src={data} alt={altText} />;
  }
  
  if (dataType === 'text') {
    return <DataContainer>{truncateText(data.replace(/\\n/g, '\n'), 150)}</DataContainer>;
  }
  
  return <div>Unsupported data type</div>;
};

/**
 * 组件，用于渲染训练事件的数据部分，特别处理 InconsistentMovementEvent
 */
const EventDataDisplay = ({ event }: { event: TrainingEvent }) => {
  if (event.type === 'InconsistentMovement') {
    return (
      <PairedDataContainer>
        <div className="data-item">
          <span className="item-label">Sample #{event.index}</span>
          <DataDisplay data={event.data} dataType={event.dataType} altText={`Sample ${event.index}`} />
        </div>
        <div className="data-item">
          <span className="item-label">Sample #{event.index1}</span>
          <DataDisplay data={event.data1} dataType={event.dataType1} altText={`Sample ${event.index1}`} />
        </div>
      </PairedDataContainer>
    );
  }

  // 对所有其他事件类型，显示单个数据
  return <DataDisplay data={event.data} dataType={event.dataType} altText={`Event sample ${event.index}`} />;
};

/**
 * 组件，用于根据事件类型渲染其详细信息
 */
const EventDetailsRenderer = ({ event }: { event: TrainingEvent }) => {
  const renderContent = () => {
    switch (event.type) {
      case 'PredictionFlip':
        return (
          <>
            <div className="detail-row">
              <div className="detail-label">Previous:</div>
              <div className="detail-value">
                {event.prevPred}
                <span className={event.prevCorrect ? "positive" : "highlight"}>
                  {event.prevCorrect ? " ✓" : " ✗"}
                </span>
              </div>
            </div>
            <div className="detail-row">
              <div className="detail-label">Current:</div>
              <div className="detail-value">
                {event.currPred}
                <span className={event.currCorrect ? "positive" : "highlight"}>
                  {event.currCorrect ? " ✓" : " ✗"}
                </span>
              </div>
            </div>
            <div className="detail-row">
              <div className="detail-label">Target:</div>
              <div className="detail-value">{event.influenceTarget}</div>
            </div>
          </>
        );

      case 'ConfidenceChange':
        return (
          <>
            <div className="detail-row">
              <div className="detail-label">Prev Conf:</div>
              <div className="detail-value">{event.prevConf.toFixed(4)}</div>
            </div>
            <div className="detail-row">
              <div className="detail-label">Curr Conf:</div>
              <div className="detail-value">{event.currConf.toFixed(4)}</div>
            </div>
            <div className="detail-row">
              <div className="detail-label">Change:</div>
              <div className="detail-value">
                <span className={event.change > 0 ? "positive" : "highlight"}>
                  {event.change > 0 ? '+' : ''}{event.change.toFixed(4)}
                </span>
              </div>
            </div>
            <div className="detail-row">
              <div className="detail-label">Target:</div>
              <div className="detail-value">{event.influenceTarget}</div>
            </div>
          </>
        );
      
      case 'SignificantMovement':
        return (
            <>
              <div className="detail-row">
                <div className="detail-label">Movement:</div>
                <div className="detail-value" style={{ color: event.movementType === 'closer' ? '#4caf50' : '#e53935', fontWeight: '600' }}>
                  {event.movementType === 'closer' ? 'Moved Closer' : 'Moved Farther'}
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">Prev Dist:</div>
                <div className="detail-value">{event.prevDist.toFixed(4)}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">Curr Dist:</div>
                <div className="detail-value">{event.currDist.toFixed(4)}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">Change:</div>
                <div className="detail-value">
                    <span className={event.distanceChange < 0 ? "positive" : "highlight"}>
                        {event.distanceChange.toFixed(4)}
                    </span>
                </div>
              </div>
            </>
        );

      case 'InconsistentMovement':
        const isConsistent = event.expectation === event.behavior;
        return (
            <>
                <div className="detail-row">
                  <div className="detail-label">Expectation:</div>
                  <div className="detail-value">{event.expectation}</div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">Behavior:</div>
                  <div className="detail-value">
                    {event.behavior}
                    <span className={isConsistent ? "positive" : "highlight"}>
                        {isConsistent ? " (Consistent)" : " (Inconsistent)"}
                    </span>
                  </div>
                </div>
            </>
        );

      default:
        return <div>No details available for this event type.</div>;
    }
  };

  return (
    <EventDetails>
      <div className="section-title">Event Details</div>
      {renderContent()}
    </EventDetails>
  );
};

const formatTextForDisplay = (text: string = '') => text.replace(/\\n/g, '\n');

const InfluenceTextRow = ({ sample, onClick }: { sample: InfluenceSample; onClick: () => void }) => {
  return (
    <InfluenceTextRowStyled $positive={sample.positive} onClick={onClick}>
      <span className="index">#{sample.index}</span>
      <TextDataContainer>
        {sample.docData && sample.codeData ? (
          <PairedTextContainer>
            <div className="text-snippet">
              <span className="label">DOC</span>
              {truncateText(sample.docData, 50)}
            </div>
            <div className="text-snippet">
              <span className="label">CODE</span>
              {truncateText(sample.codeData, 50)}
            </div>
          </PairedTextContainer>
        ) : (
          truncateText(sample.data || '', 120)
        )}
      </TextDataContainer>
      <span className="score">
        {sample.positive ? '+' : ''}{sample.score.toFixed(4)}
      </span>
    </InfluenceTextRowStyled>
  );
};

const InfluencePanelComponent = () => {
  const { dataType, trainingEvent, influenceSamples } = useDefaultStore(['dataType', 'trainingEvent', 'influenceSamples']);
  const [selectedInfluence, setSelectedInfluence] = useState<InfluenceSample | null>(null);
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative'>('all');
  
  const positiveSamples = influenceSamples.filter(sample => sample.positive);
  const negativeSamples = influenceSamples.filter(sample => !sample.positive);

  const hasSamples = 
    (filter === 'all' && (positiveSamples.length > 0 || negativeSamples.length > 0)) ||
    (filter === 'positive' && positiveSamples.length > 0) ||
    (filter === 'negative' && negativeSamples.length > 0);

  if (!trainingEvent) {
    return (
      <PanelContainer>
        <GlobalStyles />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100%',
          color: '#666',
          fontSize: '12px'
        }}>
          Select a training event to view influence analysis
        </div>
      </PanelContainer>
    );
  }

  const renderInfluenceList = (samples: InfluenceSample[]) => {
    // 兼容旧版：如果数据类型是 image，使用网格布局
    if (trainingEvent.dataType === 'image') {
      return (
        <InfluenceImageList>
          {samples.map((sample) => (
            <InfluenceImageCard 
              key={sample.index} 
              $positive={sample.positive}
              onClick={() => setSelectedInfluence(sample)}
            >
              <InfluenceImage src={sample.data} alt={`Sample ${sample.index}`} />
              <InfluenceInfo $positive={sample.positive}>
                <div className="influence-header">
                  <div className="index">#{sample.index}</div>
                  <div className="label">{sample.label}</div>
                </div>
                <div className="influence-value">
                  <span className="icon">{sample.positive ? '↑' : '↓'}</span>
                  <span className="score">
                    {sample.positive ? '+' : ''}{sample.score.toFixed(4)}
                  </span>
                </div>
              </InfluenceInfo>
            </InfluenceImageCard>
          ))}
        </InfluenceImageList>
      );
    }
    
    // 新版：如果数据类型是 text，使用列表行布局
    return (
      <InfluenceTextList>
        {samples.map((sample) => (
          <InfluenceTextRow 
            key={sample.index} 
            sample={sample} 
            onClick={() => setSelectedInfluence(sample)} 
          />
        ))}
      </InfluenceTextList>
    );
  };

  return (
    <PanelContainer>
      <GlobalStyles />
      <ContentContainer>
        <EventPanel>
          <EventHeader>
            <h2>Training Event</h2>
            <EventTypeBadge $type={trainingEvent.type}>{trainingEvent.type}</EventTypeBadge>
          </EventHeader>
          
          <EventContent>
            <EventDataDisplay event={trainingEvent} />
            <EventDetailsRenderer event={trainingEvent} />
          </EventContent>
        </EventPanel>
        
        <InfluencePanel>
          <InfluenceHeader>
            <h2>Influence Analysis</h2>
            <FilterBar>
                <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
                <button className={filter === 'positive' ? 'active' : ''} onClick={() => setFilter('positive')}>Positive</button>
                <button className={filter === 'negative' ? 'active' : ''} onClick={() => setFilter('negative')}>Negative</button>
            </FilterBar>
          </InfluenceHeader>
          
          <InfluenceContent>
            {(filter === 'all' || filter === 'positive') && positiveSamples.length > 0 && (
              <InfluenceSection $positive={true}>
                <h3>
                  Positive Influence
                  <span>{positiveSamples.length} samples</span>
                </h3>
                {renderInfluenceList(positiveSamples)}
              </InfluenceSection>
            )}
            
            {(filter === 'all' || filter === 'negative') && negativeSamples.length > 0 && (
              <InfluenceSection $positive={false}>
                <h3>
                  Negative Influence
                  <span>{negativeSamples.length} samples</span>
                </h3>
                {renderInfluenceList(negativeSamples)}
              </InfluenceSection>
            )}
            
            {!hasSamples && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#666', fontSize: '11px' }}>
                No influence samples found for current filter
              </div>
            )}
          </InfluenceContent>
        </InfluencePanel>
      </ContentContainer>
      
      <ExpandedView $show={!!selectedInfluence}>
        {selectedInfluence && (
          <ExpandedCard>
            <ExpandedHeader>
              <h3>Sample #{selectedInfluence.index}</h3>
              <button onClick={() => setSelectedInfluence(null)}>×</button>
            </ExpandedHeader>
            <ExpandedContent>
              {/* 根据数据类型和结构渲染不同的展开视图 */}
              {selectedInfluence.dataType === 'image' && (
                <ExpandedImage src={selectedInfluence.data} alt={`Sample ${selectedInfluence.index}`} />
              )}
              {selectedInfluence.dataType === 'text' && (
                <ExpandedTextContent>
                  {selectedInfluence.docData && selectedInfluence.codeData ? (
                    <ExpandedPairedTextWrapper>
                      <ExpandedTextColumn>
                        <h4>Document</h4>
                        <pre>{formatTextForDisplay(selectedInfluence.docData)}</pre>
                      </ExpandedTextColumn>
                      <ExpandedTextColumn>
                        <h4>Code</h4>
                        <pre>{formatTextForDisplay(selectedInfluence.codeData)}</pre>
                      </ExpandedTextColumn>
                    </ExpandedPairedTextWrapper>
                  ) : (
                    <ExpandedPairedTextWrapper>
                        <ExpandedTextColumn>
                            <h4>Text</h4>
                            <pre>{formatTextForDisplay(selectedInfluence.data)}</pre>
                        </ExpandedTextColumn>
                    </ExpandedPairedTextWrapper>
                  )}
                </ExpandedTextContent>
              )}
              <ExpandedDetails $positive={selectedInfluence.positive}>
                <div className="detail-row">
                  <div className="label">Index</div>
                  <div className="value">#{selectedInfluence.index}</div>
                </div>
                <div className="detail-row">
                  <div className="label">Label</div>
                  <div className="value">{selectedInfluence.label}</div>
                </div>
                <div className="detail-row">
                  <div className="label">Influence Type</div>
                  <div className="value">
                    {selectedInfluence.positive ? (
                      <span style={{ color: '#388e3c', fontWeight: 600 }}>Positive</span>
                    ) : (
                      <span style={{ color: '#d32f2f', fontWeight: 600 }}>Negative</span>
                    )}
                  </div>
                </div>
                <div className="detail-row">
                  <div className="label">Impact</div>
                  <div className="value">
                    {selectedInfluence.positive ? (
                      <span style={{ color: '#388e3c', fontWeight: 500 }}>
                        Contributed to the event
                      </span>
                    ) : (
                      <span style={{ color: '#d32f2f', fontWeight: 500 }}>
                        Hindered the event
                      </span>
                    )}
                  </div>
                </div>
                <div className="detail-row">
                  <div className="label">Influence Score</div>
                  <div className="value">
                    <span style={{ 
                      color: selectedInfluence.positive ? '#388e3c' : '#d32f2f', 
                      fontWeight: 600 
                    }}>
                      {selectedInfluence.positive ? '+' : ''}{selectedInfluence.score.toFixed(6)}
                    </span>
                  </div>
                </div>
              </ExpandedDetails>
            </ExpandedContent>
          </ExpandedCard>
        )}
      </ExpandedView>
    </PanelContainer>
  );
};

export default InfluencePanelComponent;