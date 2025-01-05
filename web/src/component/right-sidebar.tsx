import { AutoComplete, Divider, Input, List, Tag } from 'antd';
import { useStore } from '../state/store';
import { useEffect, useRef, useState } from 'react';
import { Option } from 'antd/es/mentions';
import { DefaultOptionType } from 'antd/es/select';

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
    // for color
    // const labelDict: Map<number, string> = new Map([
    //     [1, 'code'],
    //     [2, 'comment'],
    // ]);
    // const colorDict: Map<number, [number, number, number]>= new Map([
    //     [1, [255, 0, 0]],
    //     [2, [0, 255, 0]],
    // ]);

    // TODO this is too messy all using useStore
    const { labelDict, colorDict, setColorDict } =
        useStore(["labelDict", "colorDict", "setColorDict"]);

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
    const [searchFromOptions, setSearchFromOptions] = useState(searchResultDemo);
    const [searchResult, setSearchResult] = useState<DefaultOptionType[]>([]);
    const [searchOpen, setSearchOpen] = useState(false);

    const handleSearch = (text: string) => {
        // prevent searching all
        if (!text) {
            setSearchResult([]);
            setSearchOpen(false);
            return;
        }

        const res = searchFromOptions.filter((item) => item.title.includes(text));
        const renderedRes = res.map(renderOption);
        setSearchResult(renderedRes);
        setSearchOpen(true);
    };
    const renderOption = (tag: SampleTag) => {
        return {
            value: `${tag.num}`,
            label: (
                <div onClick={() => {
                    highlightContext.switchLocked(tag.num);
                }}>
                    <span className="fade-num">{tag.num}.</span>
                    <span className="inline-margin-left">{tag.title}</span>
                </div>
            )
        }
    }
    const handleSelect = (value: string) => {
        highlightContext.switchLocked(parseInt(value));
    };

    // TODO do not directly access result here
    const { highlightContext, epoch, allEpochsProjectionData } = useStore(["highlightContext", "epoch", "allEpochsProjectionData"]);
    const [selectedItems, setSelectedItems] = useState<SampleTag[]>([]);

    const handleClose = (item: SampleTag) => {
        highlightContext.removeLocked(item.num);
    };

    useEffect(() => {
        const listener = () => {
            if (allEpochsProjectionData[epoch] === undefined) return;

            const tokens = allEpochsProjectionData[epoch].tokens;
            setSelectedItems(Array.from(highlightContext.lockedIndices).map((num) => ({
                num,
                title: tokens[num]!
            })));
        };

        listener();
        highlightContext.addSelectedChangedListener(listener);
        return () => {
            highlightContext.removeSelectedChangedListener(listener);
        };
    }, [allEpochsProjectionData, epoch, highlightContext, labelDict]);

    return (
        <div className="info-column">
            <div className="functional-block">
                <div className="component-block">
                    <div className="label">Search</div>
                    <AutoComplete
                        options={searchResult}
                        onChange={handleSearch}
                        onSelect={handleSelect}
                        open={searchOpen}
                        filterOption={false}
                        notFoundContent={<div className='alt-text placeholder-block'>No item found</div>}
                    >
                        <Input allowClear />
                    </AutoComplete>
                    {/* <List className="margin-before search-result"
                        size="small"
                        bordered
                        dataSource={searchResult}
                        renderItem={(item) =>
                            <List.Item
                                onClick={() => { highlightContext.switchLocked(item.num) }}
                                style={{ backgroundColor: highlightContext.checkLocked(item.num) ? 'white' : 'unset' }}
                            >
                                <span className="fade-num">{item.num}.</span><span className="inline-margin-left">{item.title}</span>
                            </List.Item>}
                    /> */}
                </div>
            </div>
            <Divider></Divider>
            <div className="functional-block">
                <div className="component-block">
                    <div className="label">Classes</div>
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
                </div>
            </div>
            <Divider />
            <div className="functional-block">
                <div className="component-block">
                    <div className="label">Selected</div>
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
                </div>
            </div>
            <Divider />
        </div>
    )
}
