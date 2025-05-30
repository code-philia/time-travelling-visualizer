import { AutoComplete, Divider, Input, List, Tag, RefSelectProps, Checkbox, Tooltip, Switch } from 'antd';
import { useDefaultStore } from '../state/state.rightView';
import { useEffect, useRef, useState } from 'react';
import { ComponentBlock, FunctionalBlock } from './custom/basic-components';
import { notifyHighlightDataSwitch, notifySelectedIndicesSwitch, notifyshownDataSwitch } from '../communication/viewMessage';

type SampleTag = {
    num: number;
    title: string;
}

interface LabelProps {
    label: string;
    colorArray: number[];
    onColorChange: (newColor: [number, number, number]) => void;
}

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
    // TODO this is too messy all using useStore
    const { tokenList, labelDict, colorDict, setColorDict, selectedIndices, setSelectedIndices, setShownData } =
        useDefaultStore(["tokenList","labelDict", "colorDict", "setColorDict", "selectedIndices", "setSelectedIndices", "setShownData"]);

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
                    notifySelectedIndicesSwitch(newSelectedIndices);
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
        notifySelectedIndicesSwitch(newSelectedIndices);
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
                    style={{ marginTop: '3px'}} // Set width to 100% for responsiveness
                    ref={searchElementRef}
                    options={searchHistoryRender(searchHistoryFiltered)}
                    value={searchValue}
                    open={false}
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
            <FunctionalBlock label="Filter">
                <Checkbox.Group
                    options={[
                        { label: 'Train Data', value: 'train' },
                        { label: 'Test Data', value: 'test' },
                    ]}
                    defaultValue={['train', 'test']}
                    onChange={(checkedValues) => {
                        console.log('Dataset filter changed:', checkedValues);
                        setShownData(checkedValues as string[]);
                        notifyshownDataSwitch(checkedValues as string[]);
                    }}
                />
            </FunctionalBlock>
            <FunctionalBlock label="Highlight">
                <HighlightOptionBlock />
            </FunctionalBlock>
            <FunctionalBlock label="Distance">
                <DistanceBlock />
            </FunctionalBlock>
            <FunctionalBlock label="">
            </FunctionalBlock>
        </div>
    )
}

export default FunctionPanel;


function HighlightOptionBlock() {
    const [highlightTypes, setHighlightTypes] = useState([
        { type: 'prediction_error', label: 'Prediction Error', enabled: false, icon: '❌', description: 'Samples with wrong prediction at current epoch.', count: 0 },
        { type: 'prediction_flip', label: 'Prediction Flip', enabled: false, icon: '🔄', description: 'Samples with different predictions between current epoch and last epoch.', count: 0 }
    ]);

    const handleToggleHighlightType = (type: string) => {
        highlightTypes.forEach(highlight => {
            if (highlight.type === type) {
                if (highlight.type === 'prediction_error') {
                    console.log('Prediction error filter changed:', !highlight.enabled);
                    // setShowSuspiciousLabel(!highlight.enabled);
                }
                else if (highlight.type === 'prediction_flip') {
                    console.log('Prediction flip filter changed:', !highlight.enabled);
                    // setShowOutliers(!highlight.enabled);
                }
                return;
            }
        });
        const updatedhighlightTypes = highlightTypes.map(highlight => highlight.type === type ? { ...highlight, enabled: !highlight.enabled } : highlight);
        setHighlightTypes(updatedhighlightTypes);

        const enabledTypes = updatedhighlightTypes
            .filter(highlight => highlight.enabled)
            .map(highlight => highlight.type);

        notifyHighlightDataSwitch(enabledTypes);
    };

    const renderHighlightTypeItem = (highlight: { type: string, label: string, enabled: boolean, icon: string, description: string, count: number }) => {
        const countColor = highlight.count === 0 ? '#52c41a' : '#ff4d4f';
        return (
            <List.Item
                className={`highlight-type-item ${highlight.enabled ? 'enabled' : 'disabled'}`}
                onClick={() => handleToggleHighlightType(highlight.type)}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    width: '100%',
                    paddingLeft: '4px', // Reduce left padding
                }}
            >
                <div
                    className="highlight-header"
                    style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className="highlight-icon" style={{ marginRight: '8px', fontSize: '14px' }}>
                            {highlight.icon}
                        </div>
                        <div className="highlight-label" >
                            {highlight.label}
                        </div>
                    </div>
                    <div className="highlight-toggle" style={{ marginRight: '12px' }}>
                        <Switch
                            size="small"
                            checked={highlight.enabled}
                            onChange={() => handleToggleHighlightType(highlight.type)}
                        />
                    </div>
                </div>
                <div
                    className="highlight-count"
                    style={{ marginTop: '4px', color: countColor, fontSize: '10px' }}
                >
                    Found: <span>{highlight.count}</span>
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


function DistanceBlock() {
    const { allEpochData, selectedIndices, availableEpochs, epoch } = useDefaultStore(['allEpochData', 'selectedIndices', 'availableEpochs', 'epoch']);
    const [distanceData, setDistanceData] = useState<{ pair: [number, number], current: { projection: number, embedding: number }, prevDiff: { projection: number, embedding: number }, firstDiff: { projection: number, embedding: number } }[]>([]);

    useEffect(() => {
        if (selectedIndices.length < 2 || availableEpochs.length === 0) {
            setDistanceData([]);
            return;
        }

        const calculateDistance = (point1: number[], point2: number[]) => {
            return Math.sqrt(point1.reduce((sum, val, idx) => sum + Math.pow(val - point2[idx], 2), 0));
        };

        const firstEpoch = availableEpochs[0];
        const epochId = availableEpochs.indexOf(epoch);
        const prevEpochId = epochId > 0 ? epochId - 1 : null;
        const prevEpoch = prevEpochId !== null ? availableEpochs[prevEpochId] : null;

        const newDistanceData : any = [];
        for (let i = 0; i < selectedIndices.length; i++) {
            for (let j = i + 1; j < selectedIndices.length; j++) {
                const index1 = selectedIndices[i];
                const index2 = selectedIndices[j];

                const currentProjectionDist = calculateDistance(
                    allEpochData[epoch].projection[index1],
                    allEpochData[epoch].projection[index2]
                );
                const currentEmbeddingDist = calculateDistance(
                    allEpochData[epoch].embedding[index1],
                    allEpochData[epoch].embedding[index2]
                );

                const prevProjectionDist = prevEpoch !== null
                    ? calculateDistance(
                        allEpochData[prevEpoch].projection[index1],
                        allEpochData[prevEpoch].projection[index2]
                    )
                    : currentProjectionDist;

                const prevEmbeddingDist = prevEpoch !== null
                    ? calculateDistance(
                        allEpochData[prevEpoch].embedding[index1],
                        allEpochData[prevEpoch].embedding[index2]
                    )
                    : currentEmbeddingDist;

                const firstProjectionDist = calculateDistance(
                    allEpochData[firstEpoch].projection[index1],
                    allEpochData[firstEpoch].projection[index2]
                );
                const firstEmbeddingDist = calculateDistance(
                    allEpochData[firstEpoch].embedding[index1],
                    allEpochData[firstEpoch].embedding[index2]
                );

                newDistanceData.push({
                    pair: [index1, index2],
                    current: { projection: currentProjectionDist, embedding: currentEmbeddingDist },
                    prevDiff: {
                        projection: currentProjectionDist - prevProjectionDist,
                        embedding: currentEmbeddingDist - prevEmbeddingDist
                    },
                    firstDiff: {
                        projection: currentProjectionDist - firstProjectionDist,
                        embedding: currentEmbeddingDist - firstEmbeddingDist
                    }
                });
            }
        }

        setDistanceData(newDistanceData);
    }, [allEpochData, selectedIndices, availableEpochs, epoch]);

    return (
        <div className="distance-block" style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
            {distanceData.length > 0 ? (
                <List
                    size="default"
                    bordered
                    dataSource={distanceData}
                    renderItem={({ pair, current, prevDiff, firstDiff }) => (
                        <List.Item style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#f9f9f9', marginBottom: '8px' }}>
                            <div style={{ width: '100%' }}>
                                <div style={{ marginBottom: '12px', fontWeight: 'bold', color: '#1890ff' }}>
                                    Pair: {pair[0]} & {pair[1]}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <div style={{ flex: '1 1 30%', marginRight: '16px', minWidth: '200px' }}>
                                        <strong style={{ color: '#595959' }}>Current:</strong>
                                        <ul style={{ paddingLeft: '16px', margin: '8px 0', listStyleType: 'circle' }}>
                                            <li>L: {current.projection.toFixed(4)}</li>
                                            <li>H: {current.embedding.toFixed(4)}</li>
                                        </ul>
                                    </div>
                                    <div style={{ flex: '1 1 30%', marginRight: '16px', minWidth: '200px' }}>
                                        <strong style={{ color: '#595959' }}>From Previous:</strong>
                                        <ul style={{ paddingLeft: '16px', margin: '8px 0', listStyleType: 'circle' }}>
                                            <li>
                                                L: {prevDiff.projection.toFixed(4)}{' '}
                                                <span style={{ color: prevDiff.projection > 0 ? '#ff4d4f' : '#52c41a' }}>
                                                    {prevDiff.projection > 0 ? '↑' : '↓'}
                                                </span>
                                            </li>
                                            <li>
                                                H: {prevDiff.embedding.toFixed(4)}{' '}
                                                <span style={{ color: prevDiff.embedding > 0 ? '#ff4d4f' : '#52c41a' }}>
                                                    {prevDiff.embedding > 0 ? '↑' : '↓'}
                                                </span>
                                            </li>
                                        </ul>
                                    </div>
                                    <div style={{ flex: '1 1 30%', minWidth: '200px' }}>
                                        <strong style={{ color: '#595959' }}>From First:</strong>
                                        <ul style={{ paddingLeft: '16px', margin: '8px 0', listStyleType: 'circle' }}>
                                            <li>
                                                L: {firstDiff.projection.toFixed(4)}{' '}
                                                <span style={{ color: firstDiff.projection > 0 ? '#ff4d4f' : '#52c41a' }}>
                                                    {firstDiff.projection > 0 ? '↑' : '↓'}
                                                </span>
                                            </li>
                                            <li>
                                                H: {firstDiff.embedding.toFixed(4)}{' '}
                                                <span style={{ color: firstDiff.embedding > 0 ? '#ff4d4f' : '#52c41a' }}>
                                                    {firstDiff.embedding > 0 ? '↑' : '↓'}
                                                </span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </List.Item>
                    )}
                />
            ) : (
                <div className="alt-text placeholder-block" style={{ textAlign: 'center', color: '#888' }}>
                    No sufficient data to calculate distances
                </div>
            )}
        </div>
    );
}