import { useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { useDefaultStore } from '../state/state.unified';
import type { TrainingEvent, InfluenceSample, SampleWiseInfluence, PairWiseInfluence } from './types';

const isPairWise = (sample: InfluenceSample): sample is PairWiseInfluence => {
  return 'index1' in sample;
};

const GlobalStyles = createGlobalStyle`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }
`;

const PanelWrapper = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  background-color: #f9fafc;
  gap: 12px;
  padding: 8px 12px;
  color: #2d2d32;
  font-size: 13px;
  line-height: 1.55;
  overflow: hidden;
`;

const Card = styled.div`
  background: #ffffff;
  border: 1px solid #d7dbe2;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
`;

const Header = styled.h2`
  font-size: 15px;
  font-weight: 600;
  padding-bottom: 12px;
  border-bottom: 1px solid #dfe3eb;
  display: flex;
  align-items: center;
  gap: 10px;
  letter-spacing: 0.01em;
  color: #1f2430;

  &::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 18px;
    background-color: #2e5aac;
    border-radius: 2px;
  }
`;

const Badge = styled.span`
  background-color: #eef1f8;
  color: #3f4a63;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border: 1px solid #d7ddec;
`;

// -- 新增：用于文本截断和提示的容器 --
const TextContainer = styled.pre`
  padding: 9px 12px;
  background-color: #f7f7fa;
  border: 1px solid #d9d9e3;
  border-radius: 4px;
  font-family: 'Source Code Pro', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 240px;
  max-width: 100%;
  min-height: calc(2 * 1.45em);
  max-height: calc(2 * 1.45em);
  margin: 0 auto;
`;

const TextExpanded = styled.pre`
  padding: 12px 14px;
  background-color: #f9f9fb;
  border: 1px solid #dedee5;
  border-radius: 4px;
  font-family: 'Source Code Pro', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-x: hidden;
  overflow-y: auto;
  max-height: 100%;
`;

// -- 新增：用于约束图片大小的容器 --
const ImageContainer = styled.div`
  width: 96px;
  height: 96px;
  border: 1px solid #d9d9e3;
  border-radius: 6px;
  overflow: hidden;
  background-color: #f7f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover; /* 保证图片不变形地填满容器 */
  }
`;

const SamplePreviewGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
  align-items: flex-start;
`;

const SamplePreviewColumn = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

const SampleCaption = styled.div`
  font-size: 12px;
  color: #586074;
  text-align: center;
`;

const DetailsGrid = styled.div`
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px;
  font-size: 13px;

  & > dt {
    font-weight: 500;
    color: #666;
  }
  
  & > dd {
    font-weight: 500;
    color: #111;
  }
`;

// ==================================================================
// Modal Component
// ==================================================================
const ModalBackdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 80%;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const FullTextDisplay = styled.pre`
  padding: 15px;
  background-color: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  font-size: 14px;
`;

const FullImageDisplay = styled.img`
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
`;


const Modal = ({ sample, dataType, onClose }: { sample: InfluenceSample, dataType: 'Image' | 'Text', onClose: () => void }) => {
  const isPair = isPairWise(sample);

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <h3>Influence Sample Details</h3>
        <DetailsGrid>
            <dt>Score</dt><dd>{sample.score.toFixed(4)}</dd>
            {isPair ? (
                <>
                    <dt>Pair</dt><dd>#{sample.index} & #{sample.index1}</dd>
                    <dt>Type</dt><dd>{sample.type}</dd>
                </>
            ) : (
                <>
                    <dt>Index</dt><dd>#{sample.index}</dd>
                    <dt>Label</dt><dd>{(sample as SampleWiseInfluence).label}</dd>
                </>
            )}
        </DetailsGrid>

        <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
            <div style={{ flex: 1 }}>
                <h4>Sample #{sample.index}</h4>
                {dataType === 'Text' ? <FullTextDisplay>{sample.data?.replace(/\\n/g, '\n')}</FullTextDisplay> : <FullImageDisplay src={sample.data} />}
            </div>
            {isPair && (
                <div style={{ flex: 1 }}>
                    <h4>Sample #{sample.index1}</h4>
                    {dataType === 'Text' ? <FullTextDisplay>{sample.data1?.replace(/\\n/g, '\n')}</FullTextDisplay> : <FullImageDisplay src={sample.data1} />}
                </div>
            )}
        </div>
      </ModalContent>
    </ModalBackdrop>
  );
};


// ==================================================================
// Data Display Components
// ==================================================================

// --- 数据显示组件 ---
const DataDisplay = ({ data, dataType, containerType }: { data?: string; dataType: 'Image' | 'Text', containerType?: 'full' | 'thumb' }) => {
  if (!data) {
    const fallbackText = <TextContainer title="No data available.">No data available.</TextContainer>;
    return containerType === 'thumb' && dataType === 'Image' ? <ImageContainer>{fallbackText}</ImageContainer> : fallbackText;
  }

  const formattedText = data.replace(/\n/g, '\n');

  if (dataType === 'Image') {
    const img = <img src={data} alt="Sample Data" />;
    return containerType === 'thumb' ? <ImageContainer>{img}</ImageContainer> : img;
  }

  if (containerType === 'thumb') {
    return <TextContainer title={formattedText}>{formattedText}</TextContainer>;
  }

  return <TextExpanded title={formattedText}>{formattedText}</TextExpanded>;
};

// --- 事件详情渲染组件 ---
const EventDetailsRenderer = ({ event }: { event: TrainingEvent }) => {
  const renderDetails = () => {
    switch (event.type) {
      case 'PredictionFlip':
        return (
          <>
            <dt>Previous Prediction</dt><dd>{event.prevPred} ({event.prevCorrect ? 'Correct' : 'Incorrect'})</dd>
            <dt>Current Prediction</dt><dd>{event.currPred} ({event.currCorrect ? 'Correct' : 'Incorrect'})</dd>
            <dt>Ground Truth</dt><dd>{event.label}</dd>
          </>
        );
      case 'ConfidenceChange':
        return (
          <>
            <dt>Confidence Change</dt><dd>{event.prevConf.toFixed(3)} → {event.currConf.toFixed(3)}</dd>
            <dt>Label</dt><dd>{event.label}</dd>
          </>
        );
      case 'SignificantMovement':
        return (
          <>
            <dt>Movement</dt><dd style={{ textTransform: 'capitalize' }}>{event.movementType}</dd>
            <dt>Distance Change</dt><dd>{event.prevDist.toFixed(3)} → {event.currDist.toFixed(3)}</dd>
          </>
        );
      case 'InconsistentMovement':
        return (
          <>
            <dt>Expectation</dt><dd>{event.expectation}</dd>
            <dt>Actual Behavior</dt><dd>{event.behavior}</dd>
          </>
        );
      default:
        return null;
    }
  };

  return <DetailsGrid>{renderDetails()}</DetailsGrid>;
};

// ==================================================================
// Panel Components
// ==================================================================

// --- 左侧事件面板 ---
const EventPanel = ({ event, dataType }: { event: TrainingEvent, dataType: 'Image' | 'Text' }) => {
  const isPairedEvent = event.type === 'InconsistentMovement';

  return (
    <Card style={{ flex: '0 0 280px', overflowY: 'auto' }}>
      <Header>
        Training Event
        <Badge>{event.type}</Badge>
      </Header>
      
      {isPairedEvent ? (
        <SamplePreviewGroup>
          <SamplePreviewColumn>
            <DataDisplay data={event.data} dataType={dataType} containerType="thumb" />
            <SampleCaption>Sample #{event.index}</SampleCaption>
          </SamplePreviewColumn>
          <SamplePreviewColumn>
            <DataDisplay data={event.data1} dataType={dataType} containerType="thumb" />
            <SampleCaption>Sample #{event.index1}</SampleCaption>
          </SamplePreviewColumn>
        </SamplePreviewGroup>
      ) : (
        <SamplePreviewColumn>
          <DataDisplay data={event.data} dataType={dataType} containerType="thumb" />
          <SampleCaption>Sample #{event.index}</SampleCaption>
        </SamplePreviewColumn>
      )}
      
      <EventDetailsRenderer event={event} />
    </Card>
  );
};

const InfluenceCard = styled.div`
  border: 1px solid #d9dfea;
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;
  background-color: #fdfdff;
  transition: box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out, transform 0.2s ease-in-out;

  &:hover {
    border-color: #2e5aac;
    box-shadow: 0 4px 14px rgba(35, 61, 100, 0.12);
    transform: translateY(-2px);
  }
`;

const InfluenceCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #3a4356;
`;

const ScoreTag = styled.span`
  font-weight: 600;
  font-size: 14px;
  color: #1f3558;
`;

const PairTypeTag = styled(Badge)<{ $type: 'positive' | 'negative' }>`
  background-color: ${props => props.$type === 'positive' ? '#e5f0e8' : '#f5e5e7'};
  color: ${props => props.$type === 'positive' ? '#2b5b32' : '#7a2830'};
  border-color: ${props => props.$type === 'positive' ? '#c7dfcf' : '#ecc8ce'};
`;

const SampleWiseDisplay = ({ sample, dataType, onDoubleClick }: { sample: SampleWiseInfluence, dataType: 'Image' | 'Text', onDoubleClick: () => void }) => (
  <InfluenceCard onDoubleClick={onDoubleClick}>
    <InfluenceCardHeader>
      <span>Sample #{sample.index} (Label: {sample.label})</span>
      <ScoreTag>Score: {sample.score.toFixed(4)}</ScoreTag>
    </InfluenceCardHeader>
    <SamplePreviewColumn>
      <DataDisplay data={sample.data} dataType={dataType} containerType="thumb" />
      <SampleCaption>Sample #{sample.index}</SampleCaption>
    </SamplePreviewColumn>
  </InfluenceCard>
);

const PairWiseDisplay = ({ sample, dataType, onDoubleClick }: { sample: PairWiseInfluence, dataType: 'Image' | 'Text', onDoubleClick: () => void }) => (
  <InfluenceCard onDoubleClick={onDoubleClick}>
    <InfluenceCardHeader>
      <span>Pair: #{sample.index} & #{sample.index1}</span>
      <PairTypeTag $type={sample.type}>{sample.type === 'positive' ? 'PULL CLOSER' : 'PUSH APART'}</PairTypeTag>
      <ScoreTag>Score: {sample.score.toFixed(4)}</ScoreTag>
    </InfluenceCardHeader>
    <SamplePreviewGroup>
      <SamplePreviewColumn>
        <DataDisplay data={sample.data} dataType={dataType} containerType="thumb" />
        <SampleCaption>Sample #{sample.index}</SampleCaption>
      </SamplePreviewColumn>
      <SamplePreviewColumn>
        <DataDisplay data={sample.data1} dataType={dataType} containerType="thumb" />
        <SampleCaption>Sample #{sample.index1}</SampleCaption>
      </SamplePreviewColumn>
    </SamplePreviewGroup>
  </InfluenceCard>
);

const InfluencePanel = ({ samples, dataType }: { samples: InfluenceSample[], dataType: 'Image' | 'Text' }) => {
  const [selectedSample, setSelectedSample] = useState<InfluenceSample | null>(null);

  return (
    <>
      <Card style={{ flex: 1, overflowY: 'auto' }}>
        <Header>Influence Analysis</Header>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {samples.length > 0 ? (
            samples.map((sample, idx) => 
              isPairWise(sample) 
                ? <PairWiseDisplay key={idx} sample={sample} dataType={dataType} onDoubleClick={() => setSelectedSample(sample)} />
                : <SampleWiseDisplay key={idx} sample={sample as SampleWiseInfluence} dataType={dataType} onDoubleClick={() => setSelectedSample(sample)} />
            )
          ) : (
            <div style={{ textAlign: 'center', color: '#888', padding: '12px' }}>
              No influential samples to display for this event.
            </div>
          )}
        </div>
      </Card>
      {selectedSample && <Modal sample={selectedSample} dataType={dataType} onClose={() => setSelectedSample(null)} />}
    </>
  );
};

// ==================================================================
// Main Component
// ==================================================================

const InfluenceAnalysisPanel = () => {
  const { dataType, trainingEvent, influenceSamples } = useDefaultStore(["dataType", "trainingEvent", "influenceSamples"]);
  
  if (!trainingEvent) {
    return (
      <PanelWrapper style={{ alignItems: 'center', justifyContent: 'center', color: '#888' }}>
        <GlobalStyles />
        Select a training event to view its influence analysis.
      </PanelWrapper>
    );
  }

  return (
    <>
      <GlobalStyles />
      <PanelWrapper>
        <EventPanel event={trainingEvent} dataType={dataType} />
        <InfluencePanel samples={influenceSamples} dataType={dataType} />
      </PanelWrapper>
    </>
  );
};

export default InfluenceAnalysisPanel;