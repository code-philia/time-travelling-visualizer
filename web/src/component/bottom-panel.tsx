import { HTMLAttributes, useEffect, useState } from 'react';
import { Tabs, Button, TabPaneProps, TabsProps } from 'antd';
import { UpOutlined, DownOutlined, SyncOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { useDefaultStore } from '../state/state-store';

declare const __APP_CONFIG__: string | undefined;

const BottomPanelContainer = styled.div<{ $expanded: boolean }>`
    display: flex;
    border-top: 1px solid var(--layout-border-color);
    background-color: white;
    height: ${props => props.$expanded ? '320px' : '0px'};
    transition: height 0.3s ease;
    z-index: 1000;
`;

const TabsContainer = styled.div<{ $expanded: boolean }>`
    flex: 1 1 auto;
    padding: 0 1em;
    display: ${props => props.$expanded ? 'block' : 'none'};
    overflow-y: hidden;
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
    label?: string;
    text: string;
    tokens: string[];
    hoveredIndex?: number | null;
    onHoverIndex?: (index: number | null) => void;
    lockedIndices?: number[];
    onChangeLockedIndices?: (indices: number[]) => void;
    affiliatedIndices?: number[];
    weights?: number[] | null;
    alignments?: number[] | null;
}

function ReactiveTokensOverviewBlock({ text, tokens, hoveredIndex, onHoverIndex, label, lockedIndices = [], affiliatedIndices = [], onChangeLockedIndices, weights, alignments }: ReactiveCodePreProps) {
    const spans = extractSpans(text, tokens);

    // hoveredIndex !== null && hoveredIndex !== undefined && console.log(`In-block hovered index: ${hoveredIndex}`);

    let regularizedWeights: number[] | null = null;
    const ub = 1.0;
    const lb = 0.2;
    const logistic = (v: number) => 1 / (1 + Math.exp(-v));
    const norm = (v: number) => lb + v * (ub - lb);
    if (weights) {
        const _ub = logistic(Math.max(...weights));
        const _lb = logistic(Math.min(...weights));

        regularizedWeights = [];
        for (let i = 0; i < spans.length; ++i) {
            const index = spans[i].index;
            if (index !== undefined && index < weights.length) {
                const l = logistic(weights[i]);
                const y = (l - _lb) / (_ub - _lb);
                const w = norm(y);
                regularizedWeights.push(w);
            } else {
                regularizedWeights.push(1);
            }
        }
        for (let i = weights.length; i < spans.length; ++i) {
            regularizedWeights.push(1);
        }
    }

    let assignedColors: string[] | null = null;
    const increaseSaturation = (r: number, g: number, b: number) => {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        if (delta === 0) return `rgb(${r}, ${g}, ${b})`;

        const saturation = delta / max;
        const increaseFactor = 1.2; // Increase saturation by 20%
        const newSaturation = Math.min(saturation * increaseFactor, 1);

        const newR = r + (r - max) * (newSaturation - saturation);
        const newG = g + (g - max) * (newSaturation - saturation);
        const newB = b + (b - max) * (newSaturation - saturation);

        return `rgb(${Math.round(newR)}, ${Math.round(newG)}, ${Math.round(newB)})`;
    };
    const generateColor = (num: number) => {
        const r = (num * 137) % 255;
        const g = (num * 149) % 255;
        const b = (num * 163) % 255;

        return increaseSaturation(r, g, b);
    };
    if (alignments) {
        assignedColors = [];
        for (let i = 0; i < spans.length; ++i) {
            const index = spans[i].index;
            if (index !== undefined && index < alignments.length) {
                assignedColors.push(generateColor(alignments[index]));
            } else {
                assignedColors.push('black');
            }
        }
    }

    const lockedIndicesSet = new Set<number | undefined>(lockedIndices);
    const affiliatedIndicesSet = new Set<number | undefined>(affiliatedIndices);

    const spanClassList = spans.map((span) => {
        const classList = ['overview-token'];
        if (span.active) {
            classList.push('active');
        }
        if (hoveredIndex === span.index) {
            classList.push('highlighted');
        }
        if (lockedIndicesSet.has(span.index)) {
            classList.push('locked');
        }
        if (affiliatedIndicesSet.has(span.index)) {
            classList.push('affiliated');
        }
        return classList;
    });

    // const hl = highlightedIndex ?? -1;
    // if (hl >= 0 && hl < spans.length) {
    //     for (let i = 0; i < spans.length; i++) {
    //         if (spans[i].index === hl) {
    //             spanClassList[i].push('highlighted');
    //         }
    // }
    // for (const i of lockedIndices) {
    //     spanClassList[i].push('locked');
    // }
    // for (const i of affiliatedIndices) {
    //     spanClassList[i].push('affiliated');
    // }

    const renderedSpans = spans.map((span, i) => {
        const spanColorStyle = assignedColors ? { color: assignedColors[i] } : undefined;
        const spanSizeStyle = regularizedWeights && regularizedWeights[i] !== 1
            ? { color: `color-mix(in srgb, currentColor ${ Math.pow(regularizedWeights[i], 2) * 100 }%, transparent);` }
            : undefined;
        const spanStyle = spanSizeStyle || spanColorStyle
            ? { ...spanSizeStyle, ...spanColorStyle }
            : undefined;

        return (
            <span
                className={spanClassList[i].join(' ')}
                key={i}
                onMouseOver={span.active ? () => onHoverIndex?.(span.index ?? null) : undefined}
                onMouseLeave={span.active ? () => onHoverIndex?.(null) : undefined}
                onMouseDown={span.active ? () => {
                    if (span.index === undefined) return;

                    if (lockedIndicesSet.has(span.index)) {
                        onChangeLockedIndices?.(lockedIndices.filter((idx) => idx !== span.index));
                    } else {
                        onChangeLockedIndices?.([...lockedIndices, span.index]);
                    }
                } : undefined}
                style={spanStyle}
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

function ChangeIndicator({ value, ...attr }: { value: number } & HTMLAttributes<HTMLDivElement>) {
    const barLength = Math.min(1, Math.abs(value) / 3) * 75;
    const valueSign = value < 0 ? '' : '+';
    const valueText = valueSign + value.toFixed(2);

    return (
        <div className="change-indicator" {...attr}>
            {value < 0 && <div className="change-indicator-bar decrease" style={{ width: barLength + 'px' }}></div>}
            <div className="change-indicator-base-line"></div>
            {value > 0 && <div className="change-indicator-bar increase" style={{ width: barLength + 'px' }}></div>}
            <div
                className="change-indicator-value-text"
                style={
                    value < 0
                        ? { right: `calc(50% + ${(barLength + 5) + 'px'})` }
                        : value > 0
                            ? { left: `calc(50% + ${(barLength + 5) + 'px'})` }
                            : { left: `calc(50% + 2px)` }
                }
            >{ valueText }</div>
        </div>
    )
}

function SampleChangeIndicator({ tag, value }: { tag?: string, value: number }) {
    return (
        <div className="sample-change-indicator">
            <div className="sample-change-indicator-left-section">
                {tag && <span className="loss-attribution-sample-tag indicated">{tag}</span>}
            </div>
            <ChangeIndicator value={value}></ChangeIndicator>
        </div>
    )
}

export function BottomPanel({ defaultActiveTab = '1' }: BottomPanelProps) {
    const appConfig = typeof __APP_CONFIG__ !== 'undefined' ? __APP_CONFIG__ : undefined;

    const defaultExpanded = appConfig === 'extension-panel-view' ? true : false;

    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [activeTab, setActiveTab] = useState(defaultActiveTab);

    const togglePanel = () => {
        setIsExpanded(!isExpanded);
    };

    const { highlightContext } = useDefaultStore(['highlightContext', 'textData']);

    const defaultGroupNames = ['docstring', 'code'] as const;

    // assemble tokens
    const { textData, inherentLabelData } = useDefaultStore(['textData', 'inherentLabelData']);
    const groupedTokens: Record<string, string[]> = {};
    defaultGroupNames.forEach((groupName, i) => {
        groupedTokens[groupName] = [];
        inherentLabelData.forEach((groupId, j) => {
            if (groupId === i) {
                groupedTokens[groupName].push(textData[j]);
            }
        });
    });

    const { originalTextData: originalText } = useDefaultStore(['originalTextData']);

    const textGroups = Array.from(Object.keys(groupedTokens));
    const textGroupLengths = textGroups.map((key) => groupedTokens[key as keyof typeof groupedTokens].length);

    // const { hoveredIndex, setHoveredIndex } = useDefaultStore(['hoveredIndex', 'setHoveredIndex']);

    const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

    // useEffect(() => {
    //     if (hoveredIndex !== highlightedIndex) {
    //         setHighlightedIndex(hoveredIndex ?? null);
    //     }
    // }, [hoveredIndex]);

    // useEffect(() => {
    //     if (highlightedIndex !== hoveredIndex) {
    //         setHoveredIndex(highlightedIndex ?? undefined);
    //     }
    // }, [highlightedIndex, setHoveredIndex]);

    const [lockedIndices, setLockedIndices] = useState<number[]>([]);
    const [affilatedIndices, setAffiliatedIndices] = useState<number[]>([]);

    // const {hoveredIndex, setHoveredIndex} = useDefaultStore(['hoveredIndex', 'setHoveredIndex'])

    // attention and alignment
    const {
        showLossAttribution,
        showTokensWeightAsSize,
        showTokensAlignmentAsColor
    } = useDefaultStore([
        'showLossAttribution',
        'showTokensWeightAsSize',
        'showTokensAlignmentAsColor'
    ])

    // connect to highlight context
    useEffect(() => {
        const listener = () => {
            console.log(`highlight changed in bottom view ${highlightContext.hoveredIndex}  ${highlightContext.lockedIndices}`);

            setHighlightedIndex(highlightContext.hoveredIndex ?? null);
            setLockedIndices([...highlightContext.lockedIndices]);
        };

        highlightContext.addHighlightChangedListener(listener);
        return () => {
            highlightContext.removeHighlightChangedListener(listener);
        }
    }, [highlightContext, setHighlightedIndex]);

    const tokensOverviewTab = (
        <div className='vertical-overflow-container'>
            <div className='tokens-overview-container'>
                {
                    textGroups.map((key, i) => {
                        const remap = resolveCurrentIndexAndTokenIndexInGroup(i, textGroupLengths);
                        if (!(remap)) return null;

                        if (!(key in groupedTokens)) return null;

                        const text = originalText[key as typeof defaultGroupNames[number]];
                        const tokens = groupedTokens[key as typeof defaultGroupNames[number]];

                        const remappedHighlightedIndex = highlightedIndex === null ? null : remap.to(highlightedIndex);
                        const onChangeHighlightIndex = (index: number | null) => {
                            const remappedIndex = index === null ? null : remap.from(index);
                            highlightContext.updateHovered(remappedIndex ?? undefined);
                        };

                        const remappedLockedIndices = lockedIndices.map(remap.to).filter((idx) => idx !== null) as number[];
                        const onChangeLockedIndices = (indices: number[]) => {
                            const remappedIndices = indices.map(remap.from).filter((idx) => idx !== null) as number[];
                            highlightContext.setAllLocked(remappedIndices);
                        };

                        const generateWeights = (length: number, seed: number) => {
                            const random = (s: number) => {
                                const x = Math.sin(s) * 10000;
                                return x - Math.floor(x);
                            };

                            const weights = [];
                            for (let i = 0; i < length; i++) {
                                weights.push(0.5 + random(seed + i) * 2.5);
                            }
                            return weights;
                        };

                        const weights = generateWeights(tokens.length, 42);

                        const docstringAlignments = Array(20).fill(0);
                        const codeAlignments = Array(50).fill(0);

                        // DEBUG PURPOSE
                        docstringAlignments[1] = 7;
                        docstringAlignments[6] = 6;
                        docstringAlignments[7] = 6;
                        docstringAlignments[8] = 6;

                        codeAlignments[3] = 7;
                        codeAlignments[33] = 7;
                        codeAlignments[10] = 6;
                        codeAlignments[11] = 6;
                        codeAlignments[12] = 6;
                        codeAlignments[21] = 6;
                        codeAlignments[22] = 6;
                        codeAlignments[23] = 6;
                        codeAlignments[39] = 6;
                        codeAlignments[40] = 6;
                        codeAlignments[41] = 6;

                        return (
                            <ReactiveTokensOverviewBlock
                                label={key}
                                key={i}
                                text={text}
                                tokens={tokens}
                                hoveredIndex={remappedHighlightedIndex}
                                onHoverIndex={onChangeHighlightIndex}
                                lockedIndices={remappedLockedIndices}
                                onChangeLockedIndices={onChangeLockedIndices}
                                weights={showTokensWeightAsSize ? weights : null}
                                alignments={i == 0 ? docstringAlignments : codeAlignments}
                            />
                        );
                    })
                }
                {
                    showLossAttribution &&
                    <div>
                        <div className='loss-attribution-block'>
                            <div className="loss-attribution-block-title">
                                <span className="loss-attribution-block-title-text">Loss Attribution</span>
                                <Button color="primary" variant="text" className="loss-attribution-block-title-button">
                                    <SyncOutlined style={{ fontSize: '10px' }}></SyncOutlined>
                                    <span style={{ transform: 'translateY(-1px)' }}>compute</span>
                                </Button>
                            </div>
                            <div className="loss-attribution-block-content">
                                <div>
                                    Compared to last epoch, the loss between
                                    <span className="loss-attribution-sample-tag highlighted">1. Read</span>
                                    and
                                    <span className="loss-attribution-sample-tag highlighted">15. Ġread</span>
                                    has changed:
                                </div>
                                <div>
                                    <SampleChangeIndicator value={-0.43}></SampleChangeIndicator>
                                </div>
                                <div>
                                    The loss is changed most significantly with:
                                </div>
                                <div>
                                    <SampleChangeIndicator tag={'8. Ġbytes'} value={-1.57}></SampleChangeIndicator>
                                    <SampleChangeIndicator tag={'45. Ġread'} value={-0.86}></SampleChangeIndicator>
                                    <SampleChangeIndicator tag={'22. num'} value={+0.5}></SampleChangeIndicator>
                                    <SampleChangeIndicator tag={'37. Ġwhile'} value={+1.32}></SampleChangeIndicator>
                                </div>
                            </div>
                        </div>
                    </div>
                }

            </div>
        </div>
    )

    const tabItems: TabsProps['items'] = [
        {
            key: '1',
            label: (
                <div>
                    Tokens Overview
                </div>
            ),
            children: tokensOverviewTab
        }
    ];

    return (
        <BottomPanelContainer className="bottom-panel" $expanded={isExpanded}>
            {
                !defaultExpanded &&
                <Button
                    type="text"
                    icon={isExpanded ? <DownOutlined /> : <UpOutlined />}
                    onClick={togglePanel}
                    className={isExpanded ? "bottom-panel-collapse-button" : "bottom-panel-collapse-button expand"}
                    color="primary" variant="filled"
                />
            }
            <TabsContainer $expanded={isExpanded}>
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
