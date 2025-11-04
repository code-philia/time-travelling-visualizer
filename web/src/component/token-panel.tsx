import styled from 'styled-components';
import { useDefaultStore } from '../state/state.unified';
import { notifyHoveredIndexSwitch, notifySelectedIndicesSwitch } from '../communication/extension';
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
    flex: 1;
    padding: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    overflow-y: auto;
`;

const TokenBlockWrapper = styled.div`
    display: flex;
    width: 100%;
    height: 100%;
    border-left: 1px solid var(--layout-border-color);
    border-right: 1px solid var(--layout-border-color);
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

const TokenSpanStyled = styled.span<{ highlighted: boolean; asNeighbor: boolean; selected: boolean; noMargin: boolean; alignmentColor: string; }>`
    margin: ${({ noMargin }) => (noMargin ? '0' : '0 2px')};
    padding: 2px 2px;
    border-radius: 4px;
    font-weight: ${({ selected }) => (selected ? 'bold' : 'normal')};
    border: ${({ selected }) => (selected ? '1.5px solid black' : '1.5px solid transparent')};
    color: ${({ alignmentColor }) => (alignmentColor && alignmentColor !== 'transparent' ? alignmentColor : 'black')};
    background-color: ${({ highlighted, asNeighbor }) => {
        if (highlighted) return 'rgb(200, 200, 200)';
        if (asNeighbor) return 'rgba(211, 211, 211, 0.5)';
        return 'transparent';
    }};
    cursor: pointer;
    white-space: nowrap;
    &:hover {
        background-color: rgb(200, 200, 200);
    }
`;

const TokensWrapper = styled.div<{ $tokenType: 'doc' | 'code' }>`
    display: flex;
    flex-wrap: wrap;
    line-height: 1.6;
    font-size: 1.2em; 
    font-family: ${({ $tokenType }) =>
        $tokenType === 'code'
            ? `'Courier New', Courier, monospace`
            : `Georgia, 'Times New Roman', Times, serif`};
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

const FullTextBlock = styled.pre<{ $isHovered: boolean; $fontType: 'doc' | 'code' }>`
    font-family: ${({ $fontType }) =>
        $fontType === 'code'
            ? `'Courier New', Courier, monospace`
            : `Georgia, 'Times New Roman', Times, serif`};
    font-size: 1.2em;
    line-height: 1.6;
    white-space: pre-wrap; /* Respect newlines and wrap long lines */
    word-wrap: break-word;
    margin: 0;
    padding: 8px;
    border-radius: 4px;
    background-color: ${({ $isHovered }) => $isHovered ? 'rgba(173, 216, 230, 0.5)' : 'transparent'}; /* Light blue background on hover */
    transition: background-color 0.2s ease;
`;

function SimplePairDisplay({ shownDoc, shownCode, hoveredIndex }: { shownDoc: string, shownCode: string, hoveredIndex?: number | null }) {
    const isDocHovered = hoveredIndex !== null && hoveredIndex !== undefined && hoveredIndex % 2 === 0;
    const isCodeHovered = hoveredIndex !== null && hoveredIndex !== undefined && hoveredIndex % 2 === 1;
    const formattedDoc = shownDoc.replace(/\\n/g, '\n');
    const formattedCode = shownCode.replace(/\\n/g, '\n');
    return (
        <>
            <TokenBlockContainer>
                <TokenBlockTitle>Document</TokenBlockTitle>
                <FullTextBlock $isHovered={isDocHovered} $fontType="doc">
                    {formattedDoc}
                </FullTextBlock>
            </TokenBlockContainer>
            <TokenBlockContainer>
                <TokenBlockTitle>Code</TokenBlockTitle>
                <FullTextBlock $isHovered={isCodeHovered} $fontType="code">
                    {formattedCode}
                </FullTextBlock>
            </TokenBlockContainer>
        </>
    );
}

const ALIGNMENT_COLORS = [
    "#ff595e", "#1982c4", "#8ac926", "#ff924c", "#ffca3a", 
    "#52a675", "#36949d", "#4267ac", "#6a4c93", "#b5a6c9"
];

function TokenAlignmentDisplay({ labels, tokenList, hoveredIndex, selectedIndices, epoch, handleHover, handleClick }: any) {
    const [alignmentColorMap, setAlignmentColorMap] = useState<Map<number, string>>(new Map());

    const docTokens: TokenSpan[] = [];
    const codeTokens: TokenSpan[] = [];
    tokenList.forEach((token: string, index: number) => {
        const isDoc = labels[index] === 0;
        const isSelected = selectedIndices.includes(index);
        const isHighlighted = hoveredIndex === index;
        const isNeighbor = false;
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

    return (
        <>
            <TokenBlock
                label="Doc Tokens"
                tokens={docTokens}
                onHover={handleHover}
                onClick={handleClick}
                tokenType="doc"
            />
            <TokenBlock
                label="Code Tokens"
                tokens={codeTokens}
                onHover={handleHover}
                onClick={handleClick}
                tokenType="code"
            />
        </>
    );
}


export function TokenPanel() {
    const { inherentLabelData, tokenList, hoveredIndex, setHoveredIndex, selectedIndices, setSelectedIndices } =
        useDefaultStore(['inherentLabelData', 'tokenList', 'hoveredIndex', 'setHoveredIndex', 'selectedIndices', 'setSelectedIndices']);
    const { shownDoc, shownCode } = useDefaultStore(['shownDoc', 'shownCode']);
    const { epoch } = useDefaultStore(['epoch']);

    const useSimpleView = !tokenList || tokenList.length === 0;

    const handleHover = (index: number | null) => {
        setHoveredIndex(index ?? undefined);
        notifyHoveredIndexSwitch(index ?? undefined);
    };

    const handleClick = (index: number) => {
        const newSelectedIndices = selectedIndices.includes(index)
            ? selectedIndices.filter(i => i !== index)
            : [...selectedIndices, index];
        setSelectedIndices(newSelectedIndices);
        notifySelectedIndicesSwitch(newSelectedIndices);
    };

    return (
        <BottomPanelContainer className="bottom-panel" $expanded={true}>
            <TokenBlockWrapper>
                {useSimpleView ? (
                    <SimplePairDisplay
                        shownDoc={shownDoc}
                        shownCode={shownCode}
                        hoveredIndex={hoveredIndex}
                    />
                ) : (
                    <TokenAlignmentDisplay
                        labels={inherentLabelData}
                        tokenList={tokenList}
                        hoveredIndex={hoveredIndex}
                        selectedIndices={selectedIndices}
                        epoch={epoch}
                        handleHover={handleHover}
                        handleClick={handleClick}
                    />
                )}
            </TokenBlockWrapper>
        </BottomPanelContainer>
    );
}

export default TokenPanel;