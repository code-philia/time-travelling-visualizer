import styled from 'styled-components';
import { useDefaultStore } from '../state/state.tokenView';
import { notifyHoveredIndexSwitch, notifySelectedIndicesSwitch } from '../communication/viewMessage';
import { useEffect, useState } from 'react';

const BottomPanelContainer = styled.div<{ $expanded: boolean }>`
    display: flex;
    border-top: 1px solid var(--layout-border-color);
    background-color: white;
    height: ${props => props.$expanded ? '320px' : '0px'};
    transition: height 0.3s ease;
    z-index: 1000;
`;

const TokenBlockContainer = styled.div`
    flex: 1; /* Allow the block to grow and fill available space */
    padding: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    overflow-y: auto; /* Enable scrolling if content overflows */
`;

const TokenSpanStyled = styled.span<{ highlighted: boolean; asNeighbor: boolean; selected: boolean; noMargin: boolean; alignmentColor: string; }>`
    margin: ${({ noMargin }) => (noMargin ? '0' : '0 2px')}; /* Two spaces equivalent */
    padding: 2px 2px; /* Added horizontal padding for border */
    border-radius: 4px;
    font-weight: ${({ selected }) => (selected ? 'bold' : 'normal')}; /* Make selected tokens bold */
    border: ${({ selected }) => (selected ? '1.5px solid black' : '1.5px solid transparent')};
    
    /* NEW: Use alignmentColor for font color, default to black */
    color: ${({ alignmentColor }) => (alignmentColor && alignmentColor !== 'transparent' ? alignmentColor : 'black')};

    /* NEW: Background is only for hover/neighbor, otherwise transparent */
    background-color: ${({ highlighted, asNeighbor }) => {
        if (highlighted) return 'rgb(200, 200, 200)';
        if (asNeighbor) return 'rgba(211, 211, 211, 0.5)';
        return 'transparent';
    }};

    cursor: pointer;
    white-space: nowrap; /* Prevent breaking within a token */
    &:hover {
        background-color: rgb(200, 200, 200);
    }
`;

const TokenBlockWrapper = styled.div`
    display: flex;
    width: 100%; /* Ensure it spans the full width of the parent */
    height: 100%; /* Make the wrapper take the full height of the parent */
    border-left: 1px solid var(--layout-border-color); /* Add a dividing line */
    border-right: 1px solid var(--layout-border-color); /* Add a dividing line */
`;

const TokenBlockTitle = styled.div`
    font-size: 1.0em;
    font-weight: bold;
    color: #333;
    margin-bottom: 8px;
    text-align: start;
    border-bottom: 2px solid var(--layout-border-color);
    padding-bottom: 4px;
`;

const TokensWrapper = styled.div<{ $tokenType: 'doc' | 'code' }>`
    display: flex;
    flex-wrap: wrap;
    line-height: 1.6;
    /* NEW: Further enlarged font size */
    font-size: 1.2em; 
    font-family: ${({ $tokenType }) =>
        $tokenType === 'code'
            ? `'Courier New', Courier, monospace` // Monospace for code
            : `Georgia, 'Times New Roman', Times, serif`}; // Serif for docs
`;

interface TokenSpan {
    text: string;
    index: number;
    active: boolean;
    highlighted: boolean;
    asNeighbor: boolean;
    selected: boolean;
    alignmentColor?: string;
}

function TokenBlock({ label, tokens, onHover, onClick, tokenType }: any) {
    return (
        <TokenBlockContainer>
            <TokenBlockTitle>{label}</TokenBlockTitle>
            <TokensWrapper $tokenType={tokenType}>
                {tokens.map((token: TokenSpan, i: number) => {
                    const isWordStart = token.text.startsWith('Ġ');
                    const displayText = isWordStart ? token.text.slice(1) : token.text;

                    return (
                        <TokenSpanStyled
                            key={i}
                            highlighted={token.highlighted}
                            asNeighbor={token.asNeighbor}
                            selected={token.selected}
                            noMargin={!isWordStart}
                            alignmentColor={token.alignmentColor || 'transparent'}
                            onMouseOver={() => onHover(token.index)}
                            onMouseLeave={() => onHover(null)}
                            onClick={() => onClick(token.index)}
                        >
                            {displayText}
                        </TokenSpanStyled>
                    );
                })}
            </TokensWrapper>
        </TokenBlockContainer>
    );
}

// NEW: Updated colors to be opaque for better font readability
const ALIGNMENT_COLORS = [
    "#ff595e",
    "#1982c4",
    "#8ac926",
    "#ff924c",
    "#ffca3a",
    "#52a675",
    "#36949d",
    "#4267ac",
    "#6a4c93",
    "#b5a6c9"
];

export function TokenPanel() {
    const { labels, tokenList, hoveredIndex, setHoveredIndex, selectedIndices, setSelectedIndices, alignment } =
        useDefaultStore(['labels', 'tokenList', 'hoveredIndex', 'setHoveredIndex', 'selectedIndices', 'setSelectedIndices', 'alignment']);
    
    const { epoch, allNeighbors } = useDefaultStore(['epoch', 'allNeighbors']);

    const [alignmentColorMap, setAlignmentColorMap] = useState<Map<number, string>>(new Map());

    // Effect to process alignment data and create a color map
    useEffect(() => {
        const newMap = new Map<number, string>();
        if (alignment && alignment.length > 0) {
            alignment.forEach((group: number[], groupIndex: number) => {
                const color = ALIGNMENT_COLORS[groupIndex % ALIGNMENT_COLORS.length];
                group.forEach(tokenIndex => {
                    newMap.set(tokenIndex, color);
                });
            });
        }
        setAlignmentColorMap(newMap);
    }, [alignment]);

    const docTokens: TokenSpan[] = [];
    const codeTokens: TokenSpan[] = [];
    tokenList.forEach((token, index) => {
        const isDoc = labels[index] === 0;
        const isSelected = selectedIndices.includes(index);
        const isHighlighted = hoveredIndex === index;
        const isNeighbor = (hoveredIndex !== null && hoveredIndex !== undefined && (allNeighbors[epoch].originalNeighbors[hoveredIndex]?.includes(index) || allNeighbors[epoch].projectionNeighbors[hoveredIndex]?.includes(index)));
        const alignmentColor = alignmentColorMap.get(index);

        const tokenSpan: TokenSpan = {
            text: token,
            index,
            active: true,
            highlighted: isHighlighted,
            asNeighbor: isNeighbor,
            selected: isSelected,
            alignmentColor: alignmentColor,
        };

        if (isDoc) docTokens.push(tokenSpan);
        else codeTokens.push(tokenSpan);
    });

    const handleHover = (index: number | null) => {
        console.log('Hovered index in token-view:', index);
        setHoveredIndex(index ?? undefined);
        notifyHoveredIndexSwitch(index ?? undefined);
    };

    const handleClick = (index: number) => {
        console.log('Clicked index in token-view:', index);
        const newSelectedIndices = selectedIndices.includes(index)
            ? selectedIndices.filter(i => i !== index)
            : [...selectedIndices, index];

        setSelectedIndices(newSelectedIndices);
        notifySelectedIndicesSwitch(newSelectedIndices);
    };

    return (
        <BottomPanelContainer className="bottom-panel" $expanded={true}>
            <TokenBlockWrapper>
                <TokenBlock
                    label="Doc Tokens"
                    tokens={docTokens}
                    onHover={handleHover}
                    onClick={handleClick}
                    tokenType="doc" // Pass type for styling
                />
                <TokenBlock
                    label="Code Tokens"
                    tokens={codeTokens}
                    onHover={handleHover}
                    onClick={handleClick}
                    tokenType="code" // Pass type for styling
                />
            </TokenBlockWrapper>
        </BottomPanelContainer>
    );
}

export default TokenPanel;