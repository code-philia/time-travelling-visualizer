import { useEffect, useState } from 'react';
import { Tabs, Button, TabPaneProps, TabsProps } from 'antd';
import { UpOutlined, DownOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { useDefaultStore } from '../state/store';

const BottomPanelContainer = styled.div<{ expanded: boolean }>`
    display: flex;
    border-top: 1px solid var(--layout-border-color);
    background-color: white;
    height: ${props => props.expanded ? '300px' : '0px'};
    transition: height 0.3s ease;
    z-index: 1000;
`;

const TabsContainer = styled.div<{ isExpanded: boolean }>`
    flex: 1 1 auto;
    padding: 0 1em;
    display: ${props => props.isExpanded ? 'block' : 'none'};
    overflow-y: auto;
`;

interface BottomPanelProps {
    defaultActiveTab?: string;
}

function resolveCurrentIndexAndTokenIndexInGroup(groupId: number, groupLengths: number[]) {
    if (groupId < 0 || groupId >= groupLengths.length) return undefined;

    const low = groupLengths.slice(0, groupId).reduce((a, b) => a + b, 0);
    const high = low + groupLengths[groupId];

    const remapToTokenIndex = (idx: number | null) => idx === null ? null : idx - low;
    const remapToCurrentIndex = (idx: number | null) => idx === null ? null : idx + low;
    const clampFromCurrentIndex = (idx: number) => idx >= low && idx < high ? idx : null;
    const clampFromTokenIndex = (idx: number) => idx >= 0 && idx < high - low ? idx : null;

    return {
        to: (idx: number) => remapToTokenIndex(clampFromCurrentIndex(idx)),
        from: (idx: number) => remapToCurrentIndex(clampFromTokenIndex(idx))
    };
}

interface spanInCode {
    text: string;
    active?: boolean;
    index?: number;
}

function isSpecialToken(token: string) {
    return token.startsWith('<') && token.endsWith('>');
}

function findCommentEnd(s: string, pos: number) {
    let i = pos;

    while (i < s.length && /\s/.test(s[i])) {
        i++;
    }

    if (s[i] === '#') {
        while (i < s.length && s[i] !== '\n') {
            i++;
        }
    }

    return i;
}

function extractSpans(text: string, tokens: string[]) {
    const result: spanInCode[] = [];

    let pos: number = 0;
    let tokenIndex = 0;

    const flush = (nextPos: number, length: number, tokenIndex: number) => {
        if (nextPos > pos) {
            const span = text.slice(pos, nextPos);
            result.push({ text: span });
        }
        pos = nextPos;

        if (tokenIndex >= 0) {
            const tokenInText = text.slice(pos, pos + length);
            result.push({ text: tokenInText, active: true, index: tokenIndex });

            // const labelNumber = tokenToLabel.get(tokenIndex);
            // if (labelNumber !== undefined) {
            //     span.classList.add(`label-${labelNumber}`);
            // }

            pos += length;
        }
    };

    tokens.forEach((token, i) => {
        if (!isSpecialToken(token)) {
            token = token.replace('\u0120', '');

            const commentEnd = findCommentEnd(text, pos);

            const nextPos = text.indexOf(token, commentEnd);
            if (nextPos >= 0) {
                flush(nextPos, token.length, tokenIndex);
            } else {
                return;
            }
        }

        tokenIndex += 1;
    });

    return result;
};

interface ReactiveCodePreProps {
    text: string;
    tokens: string[];
    highlightedIndex?: number | null;
    onChangeHighlightIndex?: (index: number | null) => void;
    label?: string;
    lockedIndex?: number | null;
}

function ReactiveTokensOverviewBlock({ text, tokens, highlightedIndex, onChangeHighlightIndex, label }: ReactiveCodePreProps) {
    const spans = extractSpans(text, tokens);
    const renderedSpans = spans.map((span, i) => {
        const className = span.active ? ' active' : '';
        return (
            <span
                className={'overview-token' + className + (highlightedIndex === span.index ? ' highlighted' : '')}
                key={i}
                onMouseOver={span.active ? () => onChangeHighlightIndex?.(span.index ?? null) : undefined}
                onMouseLeave={span.active ? () => onChangeHighlightIndex?.(null) : undefined}
            >
                {span.text}
            </span>
        );
    });

    return (
        <div className="tokens-overview-block">
            {label !== undefined && <div className="tokens-overview-block-title">{label}</div>}
            <pre className="tokens-overview-pre">
                <code className="tokens-overview-code">
                    {renderedSpans}
                </code>
            </pre>
        </div>
    );
}

export function BottomPanel({ defaultActiveTab = '1' }: BottomPanelProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [activeTab, setActiveTab] = useState(defaultActiveTab);

    const togglePanel = () => {
        setIsExpanded(!isExpanded);
    };

    const { highlightContext } = useDefaultStore(['highlightContext', 'textData']);
    const demoTokens = {
        "docstring": ['<s>', 'Read', 's', 'Ġexactly', 'Ġthe', 'Ġspecified', 'Ġnumber', 'Ġof', 'Ġbytes', 'Ġfrom', 'Ġthe', 'Ġsocket', '</s>'],
        "code": ['<s>', 'def', 'Ġread', '_', 'ex', 'actly', 'Ġ(', 'Ġself', 'Ġ,', 'Ġnum', '_', 'bytes', 'Ġ)', 'Ġ:', 'Ġoutput', 'Ġ=', 'Ġb', "''", 'Ġremaining', 'Ġ=', 'Ġnum', '_', 'bytes', 'Ġwhile', 'Ġremaining', 'Ġ>', 'Ġ0', 'Ġ:', 'Ġoutput', 'Ġ+=', 'Ġself', 'Ġ.', 'Ġread', 'Ġ(', 'Ġremaining', 'Ġ)', 'Ġremaining', 'Ġ=', 'Ġnum', '_', 'bytes', 'Ġ-', 'Ġlen', 'Ġ(', 'Ġoutput', 'Ġ)', 'Ġreturn', 'Ġoutput', '</s>']
    }
    const demoText = {
        "docstring": "Reads exactly the specified number of bytes from the socket",
        "code": "def read_exactly(self, num_bytes):\n    output = b''\n    remaining = num_bytes\n    while remaining > 0:\n        output += self.read(remaining)\n        remaining = num_bytes - len(output)\n    return output"
    }

    const textGroups = Array.from(Object.keys(demoTokens));
    const textGroupLengths = textGroups.map((key) => demoTokens[key as keyof typeof demoTokens].length);

    const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
    const [lockedIndex, setLockedIndex] = useState<number | null>(null);

    useEffect(() => {
        const listener = () => {
            setHighlightedIndex(highlightContext.hoveredIndex ?? null);
        };

        highlightContext.addHighlightChangedListener(listener);
        return () => {
            highlightContext.removeHighlightChangedListener(listener);
        }
    }, [highlightContext, setHighlightedIndex]);

    const tokensOverviewTab = (
        <div className='tokens-overview-container'>
            {
                textGroups.map((key, i) => {
                    const remap = resolveCurrentIndexAndTokenIndexInGroup(i, textGroupLengths);
                    if (!(remap)) return null;

                    if (!(key in demoTokens)) return null;

                    const text = demoText[key as keyof typeof demoText];
                    const tokens = demoTokens[key as keyof typeof demoText];
                    const remappedIndex = highlightedIndex === null ? null : remap.to(highlightedIndex);
                    const onChangeHighlightIndex = (index: number | null) => {
                        const remappedIndex = index === null ? null : remap.from(index);
                        highlightContext.updateHovered(remappedIndex ?? undefined);
                    };

                    return (
                        <ReactiveTokensOverviewBlock
                            key={i}
                            text={text}
                            tokens={tokens}
                            highlightedIndex={remappedIndex}
                            onChangeHighlightIndex={onChangeHighlightIndex}
                            label={key}
                        />
                    );
                })
            }
        </div>
    )

    const tabItems: TabsProps['items'] = [
        {
            key: '1',
            label: 'Tokens Overview',
            children: tokensOverviewTab
        }
    ];

    return (
        <BottomPanelContainer className="bottom-panel" expanded={isExpanded}>
            <Button
                type="text"
                icon={isExpanded ? <DownOutlined /> : <UpOutlined />}
                onClick={togglePanel}
                className={isExpanded ? "bottom-panel-collapse-button" : "bottom-panel-collapse-button expand"}
                color="primary" variant="filled"
            />
            <TabsContainer isExpanded={isExpanded}>
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={tabItems}
                />
            </TabsContainer>
        </BottomPanelContainer>
    );
};

export default BottomPanel;
