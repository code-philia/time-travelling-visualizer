import { AutoComplete, Divider, Input, List, Tag, RefSelectProps, InputRef, Button, Tooltip } from 'antd';
import { useDefaultStore } from '../state/store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ComponentBlock, FunctionalBlock } from './custom/basic-components';
import { calculateSignificantPairs, transferArray2Color } from './utils';
import { DistancePair } from './canvas/types';

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

// TODO wrap this into a color object
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

export function RightSidebar() {
    // TODO this is too messy all using useStore
    const { labelDict, colorDict, setColorDict, textData } =
        useDefaultStore(["labelDict", "colorDict", "setColorDict", "textData"]);

    function changeLabelColor(i: number, newColor: [number, number, number]) {
        setColorDict(new Map([...colorDict, [i, newColor]]));
    }

    // for search
    const searchResultDemo: SampleTag[] = [
        {
            num: 1,
            title: 'code'
        },
        {
            num: 2,
            title: 'comment'
        }
    ];

    // NOTE always add state as middle dependency
    const [searchValue, setSearchValue] = useState('');
    const { textData: searchFromOptions } = useDefaultStore(['textData']);
    let { updateHighlightSig, setUpdateHighlightSig } = useDefaultStore(["updateHighlightSig", "setUpdateHighlightSig"]);

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
            if (item.title.includes(text)) {
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
                className={"search-result-sample" + (highlightContext.checkLocked(item.num) ? ' locked' : '')}
                onClick={() => { highlightContext.switchLocked(item.num); updateHighlightSig = !updateHighlightSig; setUpdateHighlightSig(updateHighlightSig); }}
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

    // TODO do not directly access result here
    const { highlightContext, epoch, allEpochsProjectionData } = useDefaultStore(["highlightContext", "epoch", "allEpochsProjectionData"]);
    const [selectedItems, setSelectedItems] = useState<SampleTag[]>([]);
    const [sid, setSid] = useState(-1);
    const [eid, setEid] = useState(-1);
    const { setStartIndex, setEndIndex } = useDefaultStore(["setStartIndex", "setEndIndex"]);

    const handleClose = (item: SampleTag) => {
        highlightContext.removeLocked(item.num);
        updateHighlightSig = !updateHighlightSig;
        setUpdateHighlightSig(updateHighlightSig);
    };

    const handleFilter = () => {
        setStartIndex(sid);
        setEndIndex(eid);
    };

    useEffect(() => {
        const listener = () => {
            if (allEpochsProjectionData[epoch] === undefined) return;

            // TODO wrap "allEpochsProjectionData" as a delayed get object
            const tokens = textData;
            setSelectedItems(Array.from(highlightContext.lockedIndices).map((num) => ({
                num,
                title: tokens[num]!
            })));
        };

        listener();
        highlightContext.addHighlightChangedListener(listener);
        return () => {
            highlightContext.removeHighlightChangedListener(listener);
        };
    }, [allEpochsProjectionData, epoch, highlightContext, labelDict, textData]);


    return (
        <div className="info-column">
            <FunctionalBlock label="Filter">
                <ComponentBlock>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Input
                            placeholder="Start"
                            value={sid === -1 ? '' : sid}
                            onChange={(e) => setSid(e.target.value ? parseInt(e.target.value) : -1)}
                            style={{ flex: 1, maxWidth: '100px' }}
                        />
                        <span style={{ color: '#888', fontSize: '14px' }}>—</span>
                        <Input
                            placeholder="End"
                            value={eid === -1 ? '' : eid}
                            onChange={(e) => setEid(e.target.value ? parseInt(e.target.value) : -1)}
                            style={{ flex: 1, maxWidth: '100px' }}
                        />
                        <Button
                            type="primary"
                            onClick={handleFilter}
                            style={{
                                padding: '0 12px',
                                height: '30px',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            Go
                        </Button>
                    </div>
                </ComponentBlock>
            </FunctionalBlock>

            <FunctionalBlock label="Search">
                <AutoComplete
                    style={{ marginTop: '3px' }}

                    ref={searchElementRef}
                    options={searchHistoryRender(searchHistoryFiltered)}
                    value={searchValue}
                    open={false}

                    onChange={(value) => { handleSearch(value) }}
                    onBlur={() => {
                        addHistory(searchValue);    // TODO only add successful history
                        setSearchHistoryOpen(false);
                    }}
                    onFocus={() => handleSearch(searchValue)}
                    onKeyDown={(e) => {
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
            <Divider></Divider>
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
            <Divider />
            <FunctionalBlock label="Selected">
                <ComponentBlock>
                    <div className="tag-list">
                        {
                            selectedItems.length
                                ?
                                selectedItems.map((item) => (
                                    <Tag className='sample-tag'
                                        closeIcon
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleClose(item);
                                        }}
                                        onClose={(e) => {
                                            e.preventDefault();
                                            handleClose(item);
                                        }}>
                                        {item.num}. {item.title}
                                    </Tag>
                                ))
                                :
                                <div className='alt-text placeholder-block'>No selected item</div>
                        }
                    </div>
                </ComponentBlock>
            </FunctionalBlock>
            <Divider />
            <SignificantChangesBlock />
        </div>
    )
}


function SignificantChangesBlock() {
    const { allEpochsProjectionData, availableEpochs, textData, epoch, colorDict, highlightContext } = useDefaultStore([
        'allEpochsProjectionData',
        'availableEpochs',
        'textData',
        'epoch',
        'colorDict',
        'highlightContext'
    ]);
    let { updateHighlightSig, setUpdateHighlightSig } = useDefaultStore([
        'updateHighlightSig',
        'setUpdateHighlightSig'
    ]);

    const [significantPairs, setSignificantPairs] = useState<DistancePair[]>([]);

    const handlePairClick = (pair: DistancePair) => {
        highlightContext.addLocked(pair.indexA);
        highlightContext.addLocked(pair.indexB);
        updateHighlightSig = !updateHighlightSig;
        setUpdateHighlightSig(updateHighlightSig);
    };


    useEffect(() => {
        if (availableEpochs.length >= 2 && Object.keys(allEpochsProjectionData).length == availableEpochs.length) {
            const pairs = calculateSignificantPairs(allEpochsProjectionData, availableEpochs);
            setSignificantPairs(pairs.slice(0, 20));
        }
    }, [allEpochsProjectionData, epoch]);

    const renderPairItem = (pair: DistancePair) => {
        const getDeltaStyle = (delta: number) => ({
            color: delta < 0 ? '#52c41a' : '#ff4d4f',
            fontWeight: 500
        });

        return (
            <List.Item
                className="significant-pair-item"
                onClick={() => handlePairClick(pair)}
            >
                <div className="pair-content">
                    <div className="pair-text">
                        <div>
                            <span
                                className="label-dot"
                                style={{ backgroundColor: transferArray2Color(colorDict.get(pair.labelA)) }}
                            />
                            <Tooltip title={textData[pair.indexA]}>
                                <span className="text-snippet">
                                    {textData[pair.indexA]?.slice(0, 30)}
                                </span>
                            </Tooltip>
                        </div>
                        <div>
                            <span
                                className="label-dot"
                                style={{ backgroundColor: transferArray2Color(colorDict.get(pair.labelB)) }}
                            />
                            <Tooltip title={textData[pair.indexB]}>
                                <span className="text-snippet">
                                    {textData[pair.indexB]?.slice(0, 30)}
                                </span>
                            </Tooltip>
                        </div>
                    </div>
                    <div className="pair-stats">
                        <span style={getDeltaStyle(pair.distanceDelta)}>
                            {pair.distanceDelta.toFixed(2)}
                            {pair.distanceDelta < 0 ? ' ↓' : ' ↑'}
                        </span>
                        <div className="secondary-text">
                            {pair.startDistance.toFixed(2)} → {pair.endDistance.toFixed(2)}
                        </div>
                    </div>
                </div>
            </List.Item>
        );
    };

    return (
        <FunctionalBlock label="Significant Changes">
            <ComponentBlock>
                <div
                    className="significant-changes-container"
                    style={{ maxHeight: '400px', overflowY: 'auto' }}
                >
                    <List
                        size="small"
                        bordered={false}
                        dataSource={significantPairs}
                        renderItem={renderPairItem}
                        locale={{ emptyText: 'No significant changes detected' }}
                    />
                </div>
            </ComponentBlock>
        </FunctionalBlock>
    );
};