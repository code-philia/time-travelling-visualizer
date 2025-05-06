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

const TokenSpanStyled = styled.span<{ highlighted: boolean; asNeighbor: boolean; selected: boolean; noMargin: boolean; color: string }>`
    margin: ${({ noMargin }) => (noMargin ? '0' : '0 0.2em')}; /* Two spaces equivalent */
    padding: 2px 0px;
    border-radius: 4px;
    color: inherit; /* Keep text color unchanged */
    font-weight: ${({ selected }) => (selected ? 'bold' : 'normal')}; /* Make selected tokens bold */
    background-color: ${({ selected, color, highlighted, asNeighbor }) => 
        selected ? color : highlighted ? 'rgb(200, 200, 200)' :asNeighbor? 'rgba(211, 211, 211, 0.5)': 'transparent'}; /* Change background color for selected tokens */
    cursor: pointer;
    white-space: nowrap; /* Prevent breaking within a token */
    &:hover {
        background-color:rgb(200, 200, 200);
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

interface TokenSpan {
    text: string;
    index: number;
    active: boolean;
    highlighted: boolean;
    asNeighbor: boolean;
    selected: boolean;
    color?: string;
}

function TokenBlock({ label, tokens, hoveredIndex, selectedIndices, onHover, onClick }: any) {
    return (
        <TokenBlockContainer>
            <TokenBlockTitle>{label}</TokenBlockTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap', lineHeight: '1.5' }}>
                {tokens.map((token: TokenSpan, i: number) => {
                    const isWordStart = token.text.startsWith('Ġ');
                    const displayText = isWordStart ? token.text.slice(1) : token.text;

                    return (
                        <TokenSpanStyled
                            key={i}
                            highlighted={token.highlighted}
                            asNeighbor={ token.asNeighbor}
                            selected={token.selected}
                            noMargin={!isWordStart}
                            color={token.color || 'inherit'}
                            onMouseOver={() => onHover(token.index)}
                            onMouseLeave={() => onHover(null)}
                            onClick={() => onClick(token.index)}
                        >
                            {displayText}
                        </TokenSpanStyled>
                    );
                })}
            </div>
        </TokenBlockContainer>
    );
}

export function BottomPanel() {
    const { labels, tokenList, hoveredIndex, setHoveredIndex, selectedIndices, setSelectedIndices } =
        useDefaultStore(['labels', 'tokenList', 'hoveredIndex', 'setHoveredIndex', 'selectedIndices', 'setSelectedIndices']);
    
    const { epoch, allNeighbors } = useDefaultStore(['epoch', 'allNeighbors']);

    const generateRandomColor = () => {
        const r = Math.floor(200 + Math.random() * 55);
        const g = Math.floor(200 + Math.random() * 55);
        const b = Math.floor(200 + Math.random() * 55);
        return `rgb(${r}, ${g}, ${b})`; // Light color for background
    };

    const docTokens: TokenSpan[] = [];
    const codeTokens: TokenSpan[] = [];

    tokenList.forEach((token, index) => {
        const isDoc = labels[index] === 0;
        const isSelected = selectedIndices.includes(index);
        const isHighlighted = hoveredIndex === index;
        const isNeighbor = (hoveredIndex !== null && hoveredIndex !== undefined && (allNeighbors[epoch].inClassNeighbors[hoveredIndex]?.includes(index) || allNeighbors[epoch].outClassNeighbors[hoveredIndex]?.includes(index)));

        const tokenSpan: TokenSpan = {
            text: token,
            index,
            active: true,
            highlighted: isHighlighted,
            asNeighbor: isNeighbor,
            selected: isSelected,
        };

        if (isDoc) docTokens.push(tokenSpan);
        else codeTokens.push(tokenSpan);
    });

    const handleHover = (index: number | null) => {
        console.log('Hovered index in token-view:', index);
        setHoveredIndex(index ?? undefined);
        notifyHoveredIndexSwitch(index ?? undefined);
    };

    const [selectedColors, setSelectedColors] = useState<Map<number, string>>(new Map());

    const handleClick = (index: number) => {
        console.log('Clicked index in token-view:', index);
        const newSelectedIndices = selectedIndices.includes(index)
            ? selectedIndices.filter(i => i !== index)
            : [...selectedIndices, index];

        setSelectedIndices(newSelectedIndices);

        // Assign a color only if the token is newly selected
        if (!selectedIndices.includes(index)) {
            const newColor = generateRandomColor();
            setSelectedColors(prev => {
                const updated = new Map(prev);
                updated.set(index, newColor);
                return updated;
            });
        } else {
            // Remove color if the token is deselected
            setSelectedColors(prev => {
                const updated = new Map(prev);
                updated.delete(index);
                return updated;
            });
        }

        notifySelectedIndicesSwitch(newSelectedIndices);
    };

    useEffect(() => {
        const updatedColors = new Map(selectedColors);

        // Assign colors to newly selected tokens
        selectedIndices.forEach(index => {
            if (!updatedColors.has(index)) {
                updatedColors.set(index, generateRandomColor());
            }
        });

        // Remove colors for deselected tokens
        Array.from(updatedColors.keys()).forEach(index => {
            if (!selectedIndices.includes(index)) {
                updatedColors.delete(index);
            }
        });

        setSelectedColors(updatedColors);
    }, [selectedIndices]);

    return (
        <BottomPanelContainer className="bottom-panel" $expanded={true}>
            <TokenBlockWrapper>
                <TokenBlock
                    label="Doc Tokens"
                    tokens={docTokens.map(token => ({
                        ...token,
                        color: token.selected ? selectedColors.get(token.index) || 'inherit' : 'inherit',
                    }))}
                    hoveredIndex={hoveredIndex}
                    selectedIndices={selectedIndices}
                    onHover={handleHover}
                    onClick={handleClick}
                />
                <TokenBlock
                    label="Code Tokens"
                    tokens={codeTokens.map(token => ({
                        ...token,
                        color: token.selected ? selectedColors.get(token.index) || 'inherit' : 'inherit',
                    }))}
                    hoveredIndex={hoveredIndex}
                    selectedIndices={selectedIndices}
                    onHover={handleHover}
                    onClick={handleClick}
                />
            </TokenBlockWrapper>
        </BottomPanelContainer>
    );
}

export default BottomPanel;
