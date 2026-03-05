import { AutoComplete, Input, List, Tag, RefSelectProps, Checkbox, Switch, Select, Slider, Collapse } from "antd";
import { useDefaultStore } from "../state/state.unified";
import { useEffect, useRef, useState } from "react";
import { ComponentBlock, FunctionalBlock } from "./custom/basic-components";
import { styled } from "styled-components";

type SampleTag = {
    num: number;
    title: string;
}

const CompactCheckboxGroup = styled(Checkbox.Group)`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;

  .ant-checkbox-wrapper {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s ease;
    background-color: #ffffff;
    border: 1px solid #d9d9d9;
    
    &:hover {
      background-color: #f5f5f5;
      border-color: #3278F0;
    }
  }

  .ant-checkbox-checked .ant-checkbox-inner {
    background-color: #3278F0;
    border-color: #3278F0;
    width: 14px;
    height: 14px;
  }
  
  .ant-checkbox-inner {
    width: 14px;
    height: 14px;
  }
`;

function rgbArrToHex(rgbArray: number[]) {
    return "#" + rgbArray.map(c => c.toString(16).padStart(2, "0")).join("");
}

export function FunctionPanel() {
    const { tokenList, labelDict, colorDict, selectedIndices, setSelectedIndices, setShownData, pointSize, setPointSize, mode, setMode } =
        useDefaultStore(["tokenList", "labelDict", "colorDict", "selectedIndices", "setSelectedIndices", "setShownData", "pointSize", "setPointSize", "mode", "setMode"]);
    const { revealOriginalNeighbors, revealProjectionNeighbors, setRevealOriginalNeighbors, setRevealProjectionNeighbors } =
        useDefaultStore(["revealOriginalNeighbors", "revealProjectionNeighbors", "setRevealOriginalNeighbors", "setRevealProjectionNeighbors"]);
    const { showIndex, showLabel, showBackground, showTrail, setShowIndex, setShowLabel, setShowBackground, setShowTrail } =
        useDefaultStore(["showIndex", "showLabel", "showBackground", "showTrail", "setShowIndex", "setShowLabel", "setShowBackground", "setShowTrail"]);
    const { inherentLabelData } = useDefaultStore(["inherentLabelData"]);

    useEffect(() => {
        if (pointSize < 1) {
            setPointSize(1);
        } else if (pointSize > 5) {
            setPointSize(5);
        }
    }, [pointSize, setPointSize]);

    const pointSizeMarks: Record<number, string> = { 1: "1", 2: "2", 3: "3", 4: "4", 5: "5" };

    const [searchValue, setSearchValue] = useState("");
    const { tokenList: searchFromOptions } = useDefaultStore(["tokenList"]);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const searchHistoryFiltered = searchHistory.filter((item) => item.includes(searchValue));
    const [searchHistoryOpen, setSearchHistoryOpen] = useState(false);
    const searchElementRef = useRef<RefSelectProps>(null);
    const [allSearchResult, setAllSearchResult] = useState<SampleTag[]>([]);

    const searchFrom = (text: string, items: SampleTag[], limit: number | null = 3) => {
        const lower = text.toLowerCase();
        const results: SampleTag[] = [];
        for (const item of items) {
            if (item.title.toLowerCase().includes(lower)) {
                results.push(item);
                if (limit !== null && results.length >= limit) break;
            }
        }
        return results;
    };

    const handleSearch = (text: string, byEnter: boolean = false) => {
        if (text === searchValue) return;
        setSearchValue(text);

        // prevent searching all
        if (!text) {
            setAllSearchResult([]);
            setSearchHistoryOpen(false);
            return;
        }

        setSearchHistoryOpen(true);

        const res = searchFrom(text, searchFromOptions.map((v, i) => {
            return {
                num: i,
                title: v
            }
        }), null);
        setAllSearchResult(res);

        if (byEnter) {
            addHistory(text);
        }
    };
    const addHistory = (text: string) => {
        if (!text) return;
        setSearchHistory([text, ...searchHistory.filter((h) => h !== text)].slice(0, 5));
    };
    const searchHistoryRender = (history: string[]) => history.map((text) => ({ value: text, label: text }));

    const searchResultRender = (item: SampleTag) => {
        return (
            <List.Item
                key={item.num}
                className={"search-result-sample" + (selectedIndices.includes(item.num) ? " locked" : "")}
                onClick={() => {
                    const newSelectedIndices = selectedIndices.includes(item.num)
                        ? selectedIndices.filter(i => i !== item.num)
                        : [...selectedIndices, item.num];

                    setSelectedIndices(newSelectedIndices);
                }}
            >
                <div className="search-result-sample-field">
                    <span className="field-tag tag-1">index</span>
                    <span className="field-value">{item.num}</span>
                </div>
                <div className="search-result-sample-field">
                    <span className="field-tag tag-2">text</span>
                    <span className="field-value">{item.title}</span>
                </div>
            </List.Item>
        )
    }

    const [selectedItems, setSelectedItems] = useState<SampleTag[]>([]);

    const handleClose = (item: SampleTag) => {
        const newSelectedIndices = selectedIndices.filter(i => i !== item.num);
        setSelectedIndices(newSelectedIndices);
    };

    useEffect(() => {
        setSelectedItems(Array.from(selectedIndices).map((num) => ({
            num,
            title: tokenList ? tokenList[num] ?? "" : ""
        })));
    }, [selectedIndices, tokenList]);

    return (
        <div className="info-column">
            <DraggableBlockList
                searchBlock={
                    <>
                        <AutoComplete
                            style={{ width: '100%', paddingRight: '0.4em' }} // Set width to 100% for responsiveness
                            ref={searchElementRef}
                            options={searchHistoryRender(searchHistoryFiltered)}
                            value={searchValue}
                            open={searchHistoryOpen}
                            onChange={(value: string) => { handleSearch(value) }}
                            onBlur={() => {
                                addHistory(searchValue);    // TODO only add successful history
                                setSearchHistoryOpen(false);
                            }}
                            onFocus={() => handleSearch(searchValue)}
                            onKeyDown={(e: { key: string; }) => {
                                if (e.key === 'Enter') {
                                    handleSearch(searchValue, true);
                                    setSearchHistoryOpen(false);
                                } else if (e.key === 'Escape') {
                                    searchElementRef.current?.blur();
                                }
                            }}
                            onSelect={() => {
                                searchElementRef.current?.blur();
                            }}
                            onClear={() => {
                                setSearchHistoryOpen(false);
                            }}
                            defaultActiveFirstOption={false}
                            notFoundContent={<div className='alt-text placeholder-block'>No item found</div>}
                            allowClear
                        >
                            <Input onClick={() => {
                                setSearchHistoryOpen(true);
                            }} />
                        </AutoComplete>
                        {(allSearchResult.length > 0 || searchValue !== "")
                            &&
                            <ComponentBlock label="Search Result">
                                {
                                    allSearchResult.length > 0
                                        ?
                                        <List
                                            className="search-result"
                                            size="small"
                                            bordered
                                            dataSource={allSearchResult}
                                            renderItem={searchResultRender}
                                        />
                                        :
                                        (
                                            searchValue && <div className="alt-text placeholder-block">No item found</div>)
                                }
                            </ComponentBlock>
                        }
                    </>
                }
                selectedBlock={
                    <ComponentBlock>
                        <div className="tag-list">
                            {
                                selectedItems.length
                                    ?
                                    selectedItems.map((item) => (
                                        <Tag className='sample-tag'
                                            closeIcon
                                            onClick={(e: { preventDefault: () => void; }) => {
                                                e.preventDefault();
                                                handleClose(item);
                                            }}
                                            onClose={(e: { preventDefault: () => void; }) => {
                                                e.preventDefault();
                                                handleClose(item);
                                            }}
                                            key={item.num}
                                        >
                                            {item.num}. {item.title}
                                        </Tag>
                                    ))
                                    :
                                    <div className='alt-text placeholder-block'>No selected item</div>
                            }
                        </div>
                    </ComponentBlock>
                }
                legendBlock={
                    <ColorLegendPanel colorDict={colorDict} labelDict={labelDict} inherentLabelData={inherentLabelData} />
                }
                settingsBlock={
                    <ComponentBlock>
                        <div className="settings-rows">
                            <div className="settings-row">
                                <span className="settings-label">Point Size</span>
                                <Slider
                                    min={1} max={5}
                                    step={1}
                                    dots
                                    marks={pointSizeMarks}
                                    value={pointSize}
                                    onChange={(v) => setPointSize(v as number)}
                                    style={{ minWidth: 80, flex: 1 }} />
                            </div>
                            <div className="settings-row">
                                <span className="settings-label">Mode</span>
                                <Select
                                    size="small"
                                    style={{ width: 240 }}
                                    value={mode}
                                    onChange={(v) => setMode(v)}
                                    options={[{ label: "Points", value: "points" }, { label: "Density", value: "density" }]} />
                            </div>
                            <div className="settings-row">
                                <span className="settings-label">Neighbors</span>
                                <Select
                                    size="small"
                                    style={{ width: 240 }}
                                    value={revealOriginalNeighbors && revealProjectionNeighbors ? "both"
                                        : (revealOriginalNeighbors ? "original"
                                            : (revealProjectionNeighbors ? "projection"
                                                : "none"))}
                                    onChange={(v) => {
                                        if (v === 'none') {
                                            setRevealOriginalNeighbors(false);
                                            setRevealProjectionNeighbors(false);
                                        } else if (v === 'original') {
                                            setRevealOriginalNeighbors(true);
                                            setRevealProjectionNeighbors(false);
                                        } else if (v === 'projection') {
                                            setRevealOriginalNeighbors(false);
                                            setRevealProjectionNeighbors(true);
                                        } else if (v === 'both') {
                                            setRevealOriginalNeighbors(true);
                                            setRevealProjectionNeighbors(true);
                                        }
                                    }}
                                    options={[
                                        { label: 'None', value: 'none' },
                                        { label: 'Original', value: 'original' },
                                        { label: 'Projection', value: 'projection' },
                                        { label: 'Both', value: 'both' },
                                    ]} />
                            </div>
                            <div className="settings-row" style={{ alignItems: "flex-start" }}>
                                <span className="settings-label">Display</span>
                                <div style={{ border: "1px solid #d9d9d9", borderRadius: 6, padding: 8, background: "#fff", width: 240 }}>
                                    <div className="settings-rows">
                                        <div className="settings-row-between">
                                            <span style={{ fontSize: 12 }}>Show Label</span>
                                            <Switch size="small" checked={showLabel} onChange={(v) => setShowLabel(v)} />
                                        </div>
                                        <div className="settings-row-between">
                                            <span style={{ fontSize: 12 }}>Show Index</span>
                                            <Switch size="small" checked={showIndex} onChange={(v) => setShowIndex(v)} />
                                        </div>
                                        <div className="settings-row-between">
                                            <span style={{ fontSize: 12 }}>Show Trail</span>
                                            <Switch size="small" checked={showTrail} onChange={(v) => setShowTrail(v)} />
                                        </div>
                                        <div className="settings-row-between">
                                            <span style={{ fontSize: 12 }}>Show Background</span>
                                            <Switch size="small" checked={showBackground} onChange={(v) => setShowBackground(v)} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ComponentBlock>
                }
                filterBlock={
                    <ComponentBlock>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <CompactCheckboxGroup
                                options={[
                                    { label: 'Train Data', value: 'train' },
                                    { label: 'Test Data', value: 'test' },
                                ]}
                                defaultValue={["train", "test"]}
                                onChange={(checkedValues) => { setShownData(checkedValues as string[]); }}
                            />
                        </div>
                    </ComponentBlock>
                }
                highlightBlock={<HighlightOptionBlock />}
            />
        </div>
    )
}

export default FunctionPanel;


function HighlightOptionBlock() {
    const { highlightData, setHighlightData } = useDefaultStore(["highlightData", "setHighlightData"]);

    const [highlightTypes, setHighlightTypes] = useState([
        { type: 'prediction_error', label: 'Prediction Error', enabled: false, icon: '❌', description: 'Samples with wrong prediction at current epoch.' },
        { type: 'prediction_flip', label: 'Prediction Flip', enabled: false, icon: '🔄', description: 'Samples with prediction flip at current epoch.' }
    ]);

    const handleToggleHighlightType = (type: string) => {
        const updatedhighlightTypes = highlightTypes.map(highlight => highlight.type === type ? { ...highlight, enabled: !highlight.enabled } : highlight);
        setHighlightTypes(updatedhighlightTypes);

        const enabledTypes = updatedhighlightTypes
            .filter(highlight => highlight.enabled)
            .map(highlight => highlight.type);

        setHighlightData(enabledTypes);
    };

    const renderHighlightTypeItem = (highlight: { type: string, label: string, enabled: boolean, icon: string, description: string }) => {
        return (
            <List.Item
                className={`highlight-type-item ${highlight.enabled ? 'enabled' : 'disabled'}`}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    width: '100%',
                    paddingLeft: '4px',
                }}
            >
                <div
                    className="highlight-header"
                    style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className="highlight-icon" style={{ marginRight: '8px', fontSize: '12px' }}>
                            {highlight.icon}
                        </div>
                        <div className="highlight-label" style={{ fontSize: '12px' }} >
                            {highlight.label}
                        </div>
                    </div>
                    <div className="highlight-toggle" style={{ marginRight: '10px' }}>
                        <Switch
                            size="small"
                            checked={highlight.enabled}
                            onChange={() => handleToggleHighlightType(highlight.type)}
                        />
                    </div>
                </div>
            </List.Item>
        );
    };

    return (
        <div
            className="highlight-detection-container"
        >
            <List
                size="small"
                bordered={false}
                dataSource={highlightTypes}
                renderItem={renderHighlightTypeItem}
                locale={{ emptyText: 'No highlight types configured' }}
            />
        </div>
    );
}
function ColorLegendPanel({ colorDict, labelDict, inherentLabelData }: {
    colorDict: Map<number, [number, number, number]>,
    labelDict: Map<number, string>,
    inherentLabelData: number[]
}) {
    const classCounts: Record<number, number> = {}
    inherentLabelData.forEach((label) => {
        classCounts[label] = (classCounts[label] || 0) + 1
    });

    if (labelDict.size === 0) {
        return null
    }

    return (
        <div className="color-legend-panel">
            <Collapse size="small" defaultActiveKey={["legend"]} items={[{
                key: "legend",
                label: <span style={{ fontSize: 12, fontWeight: 600 }}>Color Legend</span>,
                children: (
                    <div className="color-legend-content">
                        {Array.from(labelDict.entries()).map(([labelNum, labelName]) => {
                            const color = colorDict.get(labelNum);
                            const colorHex = color ? rgbArrToHex(color) : "#888888";
                            return (
                                <div key={labelNum} className="legend-item" title={`${labelName}: ${classCounts[labelNum] || 0} samples`}>
                                    <div className="legend-color-dot" style={{ backgroundColor: colorHex }} />
                                    <span className="legend-label">{labelName}</span>
                                    <span className="legend-count">({classCounts[labelNum] || 0})</span>
                                </div>
                            );
                        })}
                    </div>
                )
            }]} />
        </div>
    );
}

type BlockId = "search" | "selected" | "legend" | "settings" | "filter" | "highlight"

function DraggableBlockList(props: {
    searchBlock: React.ReactNode
    selectedBlock: React.ReactNode
    legendBlock: React.ReactNode
    settingsBlock: React.ReactNode
    filterBlock: React.ReactNode
    highlightBlock: React.ReactNode
}) {
    const [order, setOrder] = useState<BlockId[]>(["search", "selected", "legend", "settings", "filter", "highlight"]);
    const dragItem = useRef<BlockId | null>(null)
    const dragOverItem = useRef<BlockId | null>(null)

    const blocks: Record<BlockId, { label: string; content: React.ReactNode }> = {
        search: { label: "Search", content: props.searchBlock },
        selected: { label: "Selected", content: props.selectedBlock },
        legend: { label: "Color Legend", content: props.legendBlock },
        settings: { label: "Settings", content: props.settingsBlock },
        filter: { label: "Filter", content: props.filterBlock },
        highlight: { label: "Highlight", content: props.highlightBlock },
    };

    const onDragEnd = () => {
        const from = dragItem.current
        const to = dragOverItem.current
        if (!from || !to || from === to) return
        const next = [...order]
        next.splice(next.indexOf(from), 1)
        next.splice(next.indexOf(to), 0, from)
        setOrder(next)
        dragItem.current = null
        dragOverItem.current = null
    };

    return (
        <>
            {order.map((id) => (
                <div
                    key={id}
                    draggable
                    onDragStart={() => { dragItem.current = id }}
                    onDragEnter={() => { dragOverItem.current = id }}
                    onDragEnd={onDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                >
                    {id === "legend"
                        ? props.legendBlock
                        : (
                            <FunctionalBlock label={blocks[id].label} dragHandleProps={{ onMouseDown: (e) => e.stopPropagation() }}>
                                {blocks[id].content}
                            </FunctionalBlock>
                        )
                    }
                </div>
            ))}
        </>
    );
}