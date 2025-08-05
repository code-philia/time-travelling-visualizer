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
`;

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: 8px;
  gap: 8px;
  background: #f3f3f3;
`;

const EventPanel = styled.div`
  flex: 0 0 240px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid #e1e4e8;
  overflow: hidden;
`;

const EventHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eaeef5;
  
  h2 {
    font-size: 12px;
    font-weight: 600;
    color: #24292e;
  }
`;

const EventTypeBadge = styled.span<{ $type: string }>`
  background: ${({ $type }) => 
    $type === "Prediction Flip" ? "#ff6b6b" : 
    $type === "Confidence Change" ? "#4ecdc4" : 
    $type === "Significant Movement" ? "#ffd166" : "#a29bfe"};
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
`;

const EventContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const EventImage = styled.img`
  width: 100%;
  aspect-ratio: 1; // 保持正方形
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid #eaeef5;
  background: #f8f9fa;
`;

const EventInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 12px;
  
  div {
    display: flex;
    justify-content: space-between;
    
    span:first-child {
      font-weight: 600;
      color: #555;
    }
    
    span:last-child {
      font-weight: 500;
      color: #2c3e50;
    }
  }
`;

const InfluencePanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  border: 1px solid #e1e4e8;
  overflow: hidden;
`;

const InfluenceHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f6f8fa;
  border-bottom: 1px solid #e1e4e8;
  
  h2 {
    font-size: 12px;
    font-weight: 600;
    color: #24292e;
  }
`;

const FilterBar = styled.div`
  display: flex;
  gap: 6px;
  
  button {
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid #d1d5da;
    background: #f6f8fa;
    color: #24292e;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.1s;
    
    &:hover {
      background: #e9ecef;
    }
    
    &.active {
      background: #0366d6;
      color: white;
      border-color: #0366d6;
    }
  }
`;

const InfluenceContent = styled.div`
  flex: 1;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
`;

const InfluenceSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  
  h3 {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #24292e;
    padding-bottom: 4px;
    border-bottom: 1px dashed #e1e4e8;
    
    span {
      padding: 1px 6px;
      background: ${({ $positive }) => $positive ? '#e6fffa' : '#ffebeb'};
      color: ${({ $positive }) => $positive ? '#22863a' : '#cb2431'};
      border-radius: 10px;
      font-size: 10px;
    }
  }
`;

const InfluenceList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
`;

const InfluenceCard = styled.div<{ $positive: boolean }>`
  border-radius: 4px;
  overflow: hidden;
  background: ${({ $positive }) => $positive ? 'rgba(46,160,67,0.05)' : 'rgba(203,36,49,0.05)'};
  border: 1px solid ${({ $positive }) => $positive ? 'rgba(46,160,67,0.15)' : 'rgba(203,36,49,0.15)'};
  transition: all 0.1s;
  cursor: pointer;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  }
`;

const InfluenceImage = styled.img`
  width: 100%;
  aspect-ratio: 1; // 保持正方形
  object-fit: cover;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
`;

const InfluenceInfo = styled.div<{ $positive: boolean }>`
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  
  .influence-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .index {
      font-weight: 600;
      font-size: 11px;
      color: #24292e;
    }
    
    .label {
      background: ${({ $positive }) => $positive ? '#2ea043' : '#cb2431'};
      color: white;
      padding: 1px 6px;
      border-radius: 10px;
      font-size: 10px;
    }
  }
  
  .influence-value {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 500;
    
    .score {
      color: ${({ $positive }) => $positive ? '#2ea043' : '#cb2431'};
      font-weight: 600;
    }
    
    .icon {
      color: ${({ $positive }) => $positive ? '#2ea043' : '#cb2431'};
      font-weight: bold;
      font-size: 10px;
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
  border-radius: 6px;
  width: 90%;
  max-width: 600px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ExpandedHeader = styled.div`
  padding: 8px 12px;
  background: #0078d4;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h3 {
    font-size: 13px;
    font-weight: 500;
  }
  
  button {
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    padding: 2px;
  }
`;

const ExpandedContent = styled.div`
  padding: 16px;
  display: flex;
  gap: 16px;
`;

const ExpandedImage = styled.img`
  width: 120px;
  aspect-ratio: 1; // 保持正方形
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #eaeef5;
`;

const ExpandedDetails = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 12px;
  
  .detail-row {
    display: flex;
    padding-bottom: 6px;
    border-bottom: 1px solid #f0f4f8;
    
    .label {
      width: 100px;
      font-weight: 600;
      color: #555;
    }
    
    .value {
      flex: 1;
      color: #24292e;
      font-weight: 500;
    }
  }
  
  .influence-score {
    margin-top: 6px;
    padding: 10px;
    border-radius: 4px;
    background: #f0f7ff;
    display: flex;
    flex-direction: column;
    gap: 4px;
    
    .score-value {
      font-size: 18px;
      font-weight: 700;
      color: #0366d6;
      text-align: center;
    }
    
    .score-label {
      text-align: center;
      font-weight: 600;
      color: #555;
      font-size: 11px;
    }
  }
`;

const InfluencePanelComponent = () => {
  const { trainingEvent, influenceSamples } = useDefaultStore(['trainingEvent', 'influenceSamples']);
  const [selectedInfluence, setSelectedInfluence] = useState<InfluenceSample | null>(null);
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative'>('all');
  
  const positiveSamples = influenceSamples.filter(sample => sample.positive);
  const negativeSamples = influenceSamples.filter(sample => !sample.positive);
  
  const filteredSamples = filter === 'all' 
    ? influenceSamples 
    : filter === 'positive' 
      ? positiveSamples 
      : negativeSamples;
  
  if (!trainingEvent) {
    return (
      <PanelContainer>
        <GlobalStyles />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100%',
          color: '#6a737d',
          fontSize: '13px'
        }}>
          No training event selected
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
                aspectRatio: '1',
                background: '#f8f9fa', 
                borderRadius: '4px',
                fontSize: '12px',
                maxHeight: '120px',
                overflow: 'auto'
              }}>
                {trainingEvent.data}
              </div>
            )}
            
            <EventInfo>
              <div>
                <span>Sample Index:</span>
                <span>#{trainingEvent.index}</span>
              </div>
              <div>
                <span>Label:</span>
                <span>{trainingEvent.label}</span>
              </div>
              <div>
                <span>Event Type:</span>
                <span>{trainingEvent.type}</span>
              </div>
            </EventInfo>
          </EventContent>
        </EventPanel>
        
        <InfluencePanel>
          <InfluenceHeader>
            <h2>Influence Samples</h2>
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
                          height: '80px',
                          aspectRatio: '1',
                          background: '#e6fffa', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: '#22863a',
                          fontWeight: 500,
                          fontSize: '12px',
                          padding: '8px',
                          textAlign: 'center'
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
                          height: '80px', 
                          aspectRatio: '1',
                          background: '#ffebeb', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: '#cb2431',
                          fontWeight: 500,
                          fontSize: '12px',
                          padding: '8px',
                          textAlign: 'center'
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
            
            {filteredSamples.length === 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                color: '#6a737d',
                fontSize: '12px'
              }}>
                No influence samples found
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
                  width: '120px', 
                  height: '120px',
                  aspectRatio: '1',
                  background: selectedInfluence.positive ? '#e6fffa' : '#ffebeb', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: selectedInfluence.positive ? '#22863a' : '#cb2431',
                  fontWeight: 500,
                  borderRadius: '4px',
                  border: '1px solid #eaeef5',
                  padding: '10px',
                  fontSize: '12px',
                  textAlign: 'center'
                }}>
                  {selectedInfluence.data}
                </div>
              )}
              <ExpandedDetails>
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
                      <span style={{ color: '#2ea043', fontWeight: 600 }}>Positive Influence</span>
                    ) : (
                      <span style={{ color: '#cb2431', fontWeight: 600 }}>Negative Influence</span>
                    )}
                  </div>
                </div>
                <div className="detail-row">
                  <div className="label">Impact</div>
                  <div className="value">
                    {selectedInfluence.positive ? (
                      <span style={{ color: '#2ea043', fontWeight: 600 }}>
                        Contributed to the training event
                      </span>
                    ) : (
                      <span style={{ color: '#cb2431', fontWeight: 600 }}>
                        Hindered the training event
                      </span>
                    )}
                  </div>
                </div>
                <div className="influence-score">
                  <div className="score-value">
                    {selectedInfluence.positive ? '+' : ''}{selectedInfluence.score.toFixed(4)}
                  </div>
                  <div className="score-label">Influence Score</div>
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