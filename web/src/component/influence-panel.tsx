import styled from 'styled-components';
import { useDefaultStore } from '../state/state.influenceView';

// Mock 数据
const cifar10Labels = [
    'airplane', 'automobile', 'bird', 'cat', 'deer',
    'dog', 'frog', 'horse', 'ship', 'truck'
];

function getRandomLabel() {
    return cifar10Labels[Math.floor(Math.random() * cifar10Labels.length)];
}

function getRandomImageUrl() {
    // 使用随机图片占位符
    return `https://picsum.photos/seed/${Math.floor(Math.random() * 10000)}/64/64`;
}

const mockTarget = {
    index: 123,
    label: getRandomLabel(),
    predBefore: 0.32,
    predAfter: 0.67,
    imageUrl: getRandomImageUrl(),
};

const mockInfluences = Array.from({ length: 10 }).map((_, i) => ({
    index: 200 + i,
    label: getRandomLabel(),
    imageUrl: getRandomImageUrl(),
    influence: (Math.random() - 0.5) * 0.2 + 0.1, // -0.1 ~ 0.1
}));

const sortedInfluences = [...mockInfluences].sort((a, b) => b.influence - a.influence);
const top5 = sortedInfluences.slice(0, 5);
const bottom5 = sortedInfluences.slice(-5).reverse();

const PanelContainer = styled.div`
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%; // 高度自适应父组件
    border-bottom: 1px solid var(--layout-border-color);
    background: #fff;
    box-sizing: border-box;
    padding: 12px 0;
    font-family: inherit;
`;

const TargetContainer = styled.div`
    flex: 0 0 260px;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-right: 1px solid var(--layout-border-color);
    padding: 0 18px;
    justify-content: center;
    height: 100%; // 高度自适应
`;

const TargetImage = styled.img`
    width: 64px;
    height: 64px;
    border-radius: 8px;
    border: 1px solid #eee;
    margin-bottom: 8px;
    object-fit: cover;
    background: #fafafa;
`;

const TargetInfo = styled.div`
    font-size: 1.1em;
    color: #333;
    margin-bottom: 2px;
    text-align: center;
    line-height: 1.5;
`;

const InfluenceListContainer = styled.div`
    flex: 1;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    padding: 0 18px;
    gap: 24px;
    height: 100%; // 高度自适应
`;

const InfluenceColumn = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
`;

const InfluenceTitle = styled.div`
    font-size: 1.2em;
    font-weight: bold;
    color: #222;
    margin-bottom: 10px;
    border-bottom: 2px solid #ddd;
    padding-bottom: 4px;
    text-align: center;
`;

const InfluenceList = styled.div`
    display: flex;
    flex-direction: row;
    gap: 10px;
    overflow-x: auto;
`;

const InfluenceItem = styled.div<{ $positive: boolean }>`
    display: flex;
    flex-direction: column;
    align-items: center;
    background: ${({ $positive }) => $positive ? 'rgba(0,180,80,0.08)' : 'rgba(220,0,0,0.07)'};
    border: 1px solid ${({ $positive }) => $positive ? 'rgba(0,180,80,0.18)' : 'rgba(220,0,0,0.15)'};
    border-radius: 7px;
    padding: 6px 8px;
    min-width: 70px;
    max-width: 80px;
`;

const InfluenceImage = styled.img`
    width: 38px;
    height: 38px;
    border-radius: 5px;
    border: 1px solid #eee;
    margin-bottom: 4px;
    object-fit: cover;
    background: #fafafa;
`;

const InfluenceInfo = styled.div`
    font-size: 1em;
    color: #444;
    text-align: center;
    margin-bottom: 4px;
    font-weight: 500;
`;

const InfluenceValue = styled.div<{ $positive: boolean }>`
    font-size: 1.1em;
    font-weight: bold;
    color: ${({ $positive }) => $positive ? '#009e4b' : '#d12c2c'};
    text-align: center;
`;

export function InfluencePanel() {
    const { index, prevPred, currPred, prevCorrect, currCorrect, type, maxInfluence, minInfluence } = useDefaultStore([
        'index', 'prevPred', 'currPred', 'prevCorrect', 'currCorrect', 'type', 'maxInfluence', 'minInfluence'
    ]);

    return (
        <PanelContainer>
            <TargetContainer>
                <InfluenceTitle>Training Event: <b>{type || 'N/A'}</b></InfluenceTitle>
                <TargetImage src={getRandomImageUrl()} alt="target" />
                <TargetInfo>
                    <div><b>Index:</b> {index !== null ? index : 'N/A'}</div>
                    <div><b>Prediction:</b> 
                        <span style={{ color: prevCorrect ? '#009e4b' : '#d12c2c', fontWeight: 'bold' }}>{prevPred || 'N/A'}</span>
                        <span style={{ margin: '0 6px', color: '#aaa', fontWeight: 'bold' }}>→</span>
                        <span style={{ color: currCorrect ? '#009e4b' : '#d12c2c', fontWeight: 'bold' }}>{currPred || 'N/A'}</span>
                    </div>
                </TargetInfo>
            </TargetContainer>
            <InfluenceListContainer>
                <InfluenceColumn>
                    <InfluenceTitle>These Samples Contributed to This Event</InfluenceTitle>
                    <InfluenceList>
                        {maxInfluence.map(([idx, score], i) => (
                            <InfluenceItem key={`max-${i}`} $positive={true}>
                                <InfluenceImage src={getRandomImageUrl()} alt="influencer" />
                                <InfluenceInfo>
                                    <b>#{idx}</b><br />
                                    Influence: {score.toFixed(6)}
                                </InfluenceInfo>
                            </InfluenceItem>
                        ))}
                        {minInfluence.map(([idx, score], i) => (
                            <InfluenceItem key={`min-${i}`} $positive={false}>
                                <InfluenceImage src={getRandomImageUrl()} alt="influencer" />
                                <InfluenceInfo>
                                    <b>#{idx}</b><br />
                                    Influence: {score.toFixed(6)}
                                </InfluenceInfo>
                            </InfluenceItem>
                        ))}
                    </InfluenceList>
                </InfluenceColumn>
            </InfluenceListContainer>
        </PanelContainer>
    );
}

export default InfluencePanel;
