import React, { useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { useDefaultStore, InfluenceSample } from '../state/state.influenceView';

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
    $type === "ConfidenceChange" ? "#4caf50" : "#888"};
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

const EventImage = styled.img`
  width: 70px;
  height: 70px;
  border-radius: 3px;
  object-fit: cover;
  border: 1px solid #eaeaea;
  background: #f8f8f8;
  align-self: center;
`;

const EventInfo = styled.div`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px;
  padding: 6px;
  background: #f8f8f8;
  border-radius: 3px;
  font-size: 11px;
  
  .label {
    font-weight: 600;
    color: #555;
    text-align: right;
  }
  
  .value {
    font-weight: 500;
    color: #222;
  }
  
  .highlight {
    color: #e53935;
    font-weight: 600;
  }
  
  .positive {
    color: #4caf50;
    font-weight: 600;
  }
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
    
    &:hover {
      background: #e0e0e0;
    }
    
    &.active {
      background: #3f51b5;
      color: white;
      border-color: #3f51b5;
    }
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

const InfluenceList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 6px;
`;

const InfluenceCard = styled.div<{ $positive: boolean }>`
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
  
  .influence-header {
    display: flex;
    justify-content: space-between;
    
    .index {
      font-weight: 600;
      color: #333;
    }
    
    .label {
      background: ${({ $positive }) => $positive ? '#388e3c' : '#d32f2f'};
      color: white;
      padding: 1px 3px;
      border-radius: 2px;
      max-width: 35px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  
  .influence-value {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1px;
    font-weight: 500;
    
    .score {
      color: ${({ $positive }) => $positive ? '#388e3c' : '#d32f2f'};
      font-weight: 600;
    }
    
    .icon {
      color: ${({ $positive }) => $positive ? '#388e3c' : '#d32f2f'};
      font-weight: bold;
      font-size: 9px;
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
  max-width: 650px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ExpandedHeader = styled.div`
  padding: 6px 10px;
  background: #3f51b5;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h3 {
    font-size: 12px;
    font-weight: 500;
  }
  
  button {
    background: none;
    border: none;
    color: white;
    font-size: 16px;
    cursor: pointer;
    padding: 2px;
  }
`;

const ExpandedContent = styled.div`
  padding: 12px;
  display: flex;
  gap: 15px;
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
  
  .detail-row {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 6px;
    padding: 3px 0;
    
    .label {
      font-weight: 600;
      color: #555;
      font-size: 10px;
    }
    
    .value {
      font-weight: 500;
      color: #222;
      font-size: 10px;
    }
  }
  
  .influence-score {
    margin-top: 8px;
    padding: 10px;
    border-radius: 3px;
    background: #f5f5f5;
    display: flex;
    flex-direction: column;
    gap: 3px;
    border: 1px solid #eaeaea;
    
    .score-value {
      font-size: 18px;
      font-weight: 700;
      text-align: center;
      color: ${({ $positive }) => $positive ? '#4caf50' : '#e53935'};
    }
    
    .score-label {
      text-align: center;
      font-weight: 600;
      color: #555;
      font-size: 10px;
    }
  }
`;

const InfluencePanelComponent = () => {
  const { trainingEvent, influenceSamples } = useDefaultStore(['trainingEvent', 'influenceSamples']);
  const [selectedInfluence, setSelectedInfluence] = useState<InfluenceSample | null>(null);
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative'>('all');
  
  const positiveSamples = influenceSamples.filter(sample => sample.positive);
  const negativeSamples = influenceSamples.filter(sample => !sample.positive);

  const hasSamples = 
    (filter === 'all' && (positiveSamples.length > 0 || negativeSamples.length > 0)) ||
    (filter === 'positive' && positiveSamples.length > 0) ||
    (filter === 'negative' && negativeSamples.length > 0);

  const renderEventDetails = () => {
    if (!trainingEvent) return null;
    
    return (
      <>
        <EventInfo>
          <div className="label">Index:</div>
          <div className="value">#{trainingEvent.index}</div>
          
          <div className="label">Label:</div>
          <div className="value">{trainingEvent.label}</div>
          
          <div className="label">Type:</div>
          <div className="value">
            <EventTypeBadge $type={trainingEvent.type}>{trainingEvent.type}</EventTypeBadge>
          </div>
        </EventInfo>
        
        <EventDetails>
          <div className="section-title">Event Details</div>
          
          {trainingEvent.type === 'PredictionFlip' && (
            <>
              <div className="detail-row">
                <div className="detail-label">Previous:</div>
                <div className="detail-value">
                  {trainingEvent.prevPred}
                  <span className={trainingEvent.prevCorrect ? "positive" : "highlight"}>
                    {trainingEvent.prevCorrect ? " ✓" : " ✗"}
                  </span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">Current:</div>
                <div className="detail-value">
                  {trainingEvent.currPred}
                  <span className={trainingEvent.currCorrect ? "positive" : "highlight"}>
                    {trainingEvent.currCorrect ? " ✓" : " ✗"}
                  </span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">Target:</div>
                <div className="detail-value">{trainingEvent.influenceTarget}</div>
              </div>
            </>
          )}
          
          {trainingEvent.type === 'ConfidenceChange' && (
            <>
              <div className="detail-row">
                <div className="detail-label">Prev Conf:</div>
                <div className="detail-value">{trainingEvent.prevConf.toFixed(4)}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">Curr Conf:</div>
                <div className="detail-value">{trainingEvent.currConf.toFixed(4)}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">Change:</div>
                <div className="detail-value">
                  <span className={trainingEvent.change > 0 ? "positive" : "highlight"}>
                    {trainingEvent.change > 0 ? '+' : ''}{trainingEvent.change.toFixed(4)}
                  </span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">Target:</div>
                <div className="detail-value">{trainingEvent.influenceTarget}</div>
              </div>
            </>
          )}
        </EventDetails>
      </>
    );
  };

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
            {trainingEvent.dataType === 'image' ? (
              <EventImage src={trainingEvent.data} alt="Training event" />
            ) : (
              <div style={{ 
                padding: '10px',
                height: '70px',
                background: '#f8f8f8', 
                borderRadius: '3px',
                fontSize: '11px',
                overflow: 'auto',
                border: '1px solid #eaeaea',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {trainingEvent.data}
              </div>
            )}
            
            {renderEventDetails()}
          </EventContent>
        </EventPanel>
        
        <InfluencePanel>
          <InfluenceHeader>
            <h2>Influence Analysis</h2>
            <FilterBar>
              <button 
                className={filter === 'all' ? 'active' : ''} 
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button 
                className={filter === 'positive' ? 'active' : ''} 
                onClick={() => setFilter('positive')}
              >
                Positive
              </button>
              <button 
                className={filter === 'negative' ? 'active' : ''} 
                onClick={() => setFilter('negative')}
              >
                Negative
              </button>
            </FilterBar>
          </InfluenceHeader>
          
          <InfluenceContent>
            {(filter === 'all' || filter === 'positive') && positiveSamples.length > 0 && (
              <InfluenceSection $positive={true}>
                <h3>
                  Positive Influence
                  <span>{positiveSamples.length} samples</span>
                </h3>
                <InfluenceList>
                  {positiveSamples.map((sample) => (
                    <InfluenceCard 
                      key={sample.index} 
                      $positive={true}
                      onClick={() => setSelectedInfluence(sample)}
                    >
                      {trainingEvent.dataType === 'image' ? (
                        <InfluenceImage src={sample.data} alt={`Sample ${sample.index}`} />
                      ) : (
                        <div style={{ 
                          height: '50px',
                          background: '#e8f5e9', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: '#388e3c',
                          fontWeight: 500,
                          fontSize: '9px',
                          padding: '6px',
                          textAlign: 'center',
                          borderBottom: '1px solid #c8e6c9'
                        }}>
                          {sample.data}
                        </div>
                      )}
                      <InfluenceInfo $positive={true}>
                        <div className="influence-header">
                          <div className="index">#{sample.index}</div>
                          <div className="label">{sample.label}</div>
                        </div>
                        <div className="influence-value">
                          <span className="icon">↑</span>
                          <span className="score">+{sample.score.toFixed(4)}</span>
                        </div>
                      </InfluenceInfo>
                    </InfluenceCard>
                  ))}
                </InfluenceList>
              </InfluenceSection>
            )}
            
            {(filter === 'all' || filter === 'negative') && negativeSamples.length > 0 && (
              <InfluenceSection $positive={false}>
                <h3>
                  Negative Influence
                  <span>{negativeSamples.length} samples</span>
                </h3>
                <InfluenceList>
                  {negativeSamples.map((sample) => (
                    <InfluenceCard 
                      key={sample.index} 
                      $positive={false}
                      onClick={() => setSelectedInfluence(sample)}
                    >
                      {trainingEvent.dataType === 'image' ? (
                        <InfluenceImage src={sample.data} alt={`Sample ${sample.index}`} />
                      ) : (
                        <div style={{ 
                          height: '50px', 
                          background: '#ffebee', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: '#d32f2f',
                          fontWeight: 500,
                          fontSize: '9px',
                          padding: '6px',
                          textAlign: 'center',
                          borderBottom: '1px solid #ffcdd2'
                        }}>
                          {sample.data}
                        </div>
                      )}
                      <InfluenceInfo $positive={false}>
                        <div className="influence-header">
                          <div className="index">#{sample.index}</div>
                          <div className="label">{sample.label}</div>
                        </div>
                        <div className="influence-value">
                          <span className="icon">↓</span>
                          <span className="score">{sample.score.toFixed(4)}</span>
                        </div>
                      </InfluenceInfo>
                    </InfluenceCard>
                  ))}
                </InfluenceList>
              </InfluenceSection>
            )}
            
            {!hasSamples && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                color: '#666',
                fontSize: '11px'
              }}>
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
              {trainingEvent.dataType === 'image' ? (
                <ExpandedImage src={selectedInfluence.data} alt={`Sample ${selectedInfluence.index}`} />
              ) : (
                <div style={{ 
                  width: '140px', 
                  height: '140px',
                  background: selectedInfluence.positive ? '#e8f5e9' : '#ffebee', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: selectedInfluence.positive ? '#388e3c' : '#d32f2f',
                  fontWeight: 500,
                  borderRadius: '4px',
                  border: '1px solid #eaeaea',
                  padding: '8px',
                  fontSize: '11px',
                  textAlign: 'center'
                }}>
                  {selectedInfluence.data}
                </div>
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