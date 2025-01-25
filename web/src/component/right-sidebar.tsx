import { AutoComplete, Divider, Input, List, Tag, RefSelectProps } from 'antd';
import { useDefaultStore } from '../state/store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ComponentBlock, FunctionalBlock } from './custom/basic-components';

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
                onChange={ (e) => onColorChange(hexToRgbArray((e.target as HTMLInputElement).value)) }
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

function hexToRgbArray(hex: string): [number, number, number]  {
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
        useDefaultStore(["labelDict", "colorDict", "setColorDict", "textData" ]);

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
                className={"search-result-sample" + (highlightContext.checkLocked(item.num) ? ' locked' : '')}
                onClick={() => { highlightContext.switchLocked(item.num) }}
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

    const handleClose = (item: SampleTag) => {
        highlightContext.removeLocked(item.num);
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
                    }}/>
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
                <ComponentBlock label="Classes">
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
        </div>
    )
}
