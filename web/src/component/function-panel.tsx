import { AutoComplete, Input, List, Tag, RefSelectProps, Checkbox, Switch, Select, Slider } from 'antd';
import { useDefaultStore } from '../state/state.unified';
import { useEffect, useRef, useState } from 'react';
import { ComponentBlock, FunctionalBlock } from './custom/basic-components';
import { styled } from 'styled-components';

type SampleTag = {
    num: number;
    title: string;
}

interface LabelProps {
    label: string;
    colorArray: number[];
    onColorChange: (newColor: [number, number, number]) => void;
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

const ColoredClassLabel: React.FC<LabelProps> = ({ label, colorArray, onColorChange }) => {
    const inputRef = useRef<HTMLInputElement>(null);


    function setColorPickerOpacity(value: number) {
        const colorPickerItem = inputRef.current;
        if (!colorPickerItem) return;
        if (value) {
            colorPickerItem.style.opacity = '1';
            colorPickerItem.style.pointerEvents = 'auto';
        } else {
            colorPickerItem.style.opacity = '0';
            colorPickerItem.style.pointerEvents = 'none';
        }
    }

    return (
        <div
            className="class-item"
            key={label}
            onMouseOver={() => setColorPickerOpacity(1)}
            onMouseLeave={() => setColorPickerOpacity(0)}
        >
            <input
                type="color"
                value={rgbArrToHex(colorArray)}
                onChange={(e) => onColorChange(hexToRgbArray((e.target as HTMLInputElement).value))}
            />
            <span style={{ color: rgbArrToHex(colorArray) }}>
                {label}
            </span>
        </div>
    )
}

function rgbArrToHex(rgbArray: number[]) {
    return '#' + rgbArray.map(c => c.toString(16).padStart(2, '0')).join('');
}

function hexToRgbArray(hex: string): [number, number, number] {
    hex = hex.replace(/^#/, '');
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return [r, g, b];
}

export function FunctionPanel() {
    const { tokenList, labelDict, colorDict, setColorDict, selectedIndices, setSelectedIndices, setShownData, pointSize, setPointSize, mode, setMode } =
        useDefaultStore(["tokenList","labelDict", "colorDict", "setColorDict", "selectedIndices", "setSelectedIndices", "setShownData", "pointSize", "setPointSize", "mode", "setMode"]);
    const { revealOriginalNeighbors, revealProjectionNeighbors, setRevealOriginalNeighbors, setRevealProjectionNeighbors } =
        useDefaultStore(["revealOriginalNeighbors", "revealProjectionNeighbors", "setRevealOriginalNeighbors", "setRevealProjectionNeighbors"]);

    useEffect(() => {
        if (pointSize < 1) {
            setPointSize(1);
        } else if (pointSize > 3) {
            setPointSize(3);
        }
    }, [pointSize, setPointSize]);

    const pointSizeMarks: Record<number, string> = { 1: 'small', 2: 'middle', 3: 'large' };
    const pointSizeLabel = pointSizeMarks[pointSize] ?? pointSize.toString();

    function changeLabelColor(i: number, newColor: [number, number, number]) {
        setColorDict(new Map([...colorDict, [i, newColor]]));
    }

    // NOTE always add state as middle dependency
    const [searchValue, setSearchValue] = useState('');
    const { tokenList: searchFromOptions } = useDefaultStore(['tokenList']);

    const limitOfHistory = 5;
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const searchHistoryFiltered = searchHistory.filter((item) => item.includes(searchValue));
    const [searchHistoryOpen, setSearchHistoryOpen] = useState(false);
    const searchElementRef = useRef<RefSelectProps>(null);

    const [allSearchResult, setAllSearchResult] = useState<SampleTag[]>([]);

    const searchFrom = (text: string, items: SampleTag[], limit: number | null = 3) => {
        const res: SampleTag[] = [];

        let cnt = 0;

        for (const item of items) {
            if (item.title.toLowerCase().includes(text.toLowerCase())) {
                if (limit !== null && cnt >= limit) {
                    return res;
                }
                res.push(item);
                cnt++;
            }
        }

        return res;
    }

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

        const nonDuplicateHistory = searchHistory.filter((item) => item !== text);
        setSearchHistory([text, ...nonDuplicateHistory].slice(0, limitOfHistory));
    }
    const renderSearchHistoryOption = (text: string) => {
        return {
            value: text,
            label: text
        }
    }
    const searchHistoryRender = (history: string[]) => {
        return history.map(renderSearchHistoryOption);
    }

    const searchResultRender = (item: SampleTag) => {
        return (
            <List.Item
                key={item.num}
                className={"search-result-sample" + (selectedIndices.includes(item.num) ? ' locked' : '')}
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
            title: tokenList ? tokenList[num] ?? '' : ''
        })));
    }, [selectedIndices, tokenList]);

    return (
        <div className="info-column">
            <FunctionalBlock label="Search">
                <AutoComplete
                    style={{ width: '100%', paddingRight: '0.4em'}} // Set width to 100% for responsiveness
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
                {
                    (allSearchResult.length > 0 || searchValue !== '')
                    &&
                    <ComponentBlock label="Search Result">
                        {
                            allSearchResult.length > 0
                                ?
                                (
                                    <List className="search-result"
                                        size="small"
                                        bordered
                                        dataSource={allSearchResult}
                                        renderItem={searchResultRender}
                                    />
                                )
                                :
                                (searchValue && <div className='alt-text placeholder-block'>No item found</div>)
                        }
                    </ComponentBlock>
                }
            </FunctionalBlock>
            <FunctionalBlock label="Categories">
                <ComponentBlock>
                    <div className="class-list">
                        {
                            Array.from(labelDict.keys()).length
                                ?
                                Array.from(labelDict.keys()).map((labelNum) =>
                                    <ColoredClassLabel
                                        key={labelNum}
                                        label={labelDict.get(labelNum)!}
                                        colorArray={colorDict.get(labelNum)!}
                                        onColorChange={(newColor) => changeLabelColor(labelNum, newColor)}
                                    />
                                )
                                :
                                <div className='alt-text placeholder-block'>No class is determined</div>
                        }
                    </div>
                </ComponentBlock>
            </FunctionalBlock>
            <FunctionalBlock label="Selected">
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
            </FunctionalBlock>
            <FunctionalBlock label="Settings">
                <ComponentBlock>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ minWidth: 80, fontSize: 12, fontWeight: 600 }}>Point Size</span>
                            <Slider
                                min={1}
                                max={3}
                                step={1}
                                dots
                                marks={pointSizeMarks}
                                value={pointSize}
                                onChange={(v) => setPointSize(v as number)}
                                style={{ minWidth: 80, flex: 1 }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ minWidth: 80, fontSize: 12, fontWeight: 600 }}>Mode</span>
                            <Select
                                size="small"
                                style={{ minWidth: 140 }}
                                value={mode}
                                onChange={(v) => setMode(v)}
                                options={[
                                    { label: 'Points', value: 'points' },
                                    { label: 'Density', value: 'density' },
                                ]}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ minWidth: 80, fontSize: 12, fontWeight: 600 }}>Neighbors</span>
                            <Select
                                size="small"
                                style={{ minWidth: 140 }}
                                value={
                                    revealOriginalNeighbors && revealProjectionNeighbors ? 'both'
                                    : (revealOriginalNeighbors ? 'original'
                                    : (revealProjectionNeighbors ? 'projection' : 'none'))
                                }
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
                                ]}
                            />
                        </div>
                    </div>
                </ComponentBlock>
            </FunctionalBlock>
            <FunctionalBlock label="Filter">
                <ComponentBlock>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <CompactCheckboxGroup
                            options={[
                                { label: 'Train Data', value: 'train' },
                                { label: 'Test Data', value: 'test' },
                            ]}
                            defaultValue={['train', 'test']}
                            onChange={(checkedValues) => {
                                setShownData(checkedValues as string[]);
                            }}
                        />
                    </div>
                </ComponentBlock>
            </FunctionalBlock>
            <FunctionalBlock label="Highlight">
                <HighlightOptionBlock />
            </FunctionalBlock>
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

    const renderHighlightTypeItem = (highlight: { type: string, label: string, enabled: boolean, icon: string, description: string}) => {
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