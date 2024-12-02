import { Divider, Input, List, Tag } from 'antd';
import { useStore } from '../state/store';
import { useEffect, useRef, useState } from 'react';

type SampleTag = {
    num: number;
    title: string;
}

interface LabelProps {
    labelID: string;
    colorArray: number[];
    onColorChange: (newColor: [number, number, number]) => void;
}

const Label: React.FC<LabelProps> = ({ labelID, colorArray, onColorChange }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const handleChange = (newColor: [number, number, number]) => {
        onColorChange(newColor);
    };

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
            key={labelID}
            onMouseOver={(_) => setColorPickerOpacity(1)}
            onMouseLeave={(_) => setColorPickerOpacity(0)}
        >
            <span style={{ color: rgbArrToHex(colorArray) }}>
                {colorArray}
            </span>
            <input
                type="color"
                value={rgbArrToHex(colorArray)}
                onChange={(e) => handleChange(hexToRgbArray((e.target as HTMLInputElement).value))}
            />
        </div>
    )
}
function LabelList() {
    const { colorList, labelNameDict, setColorList } = useStore(['colorList', 'labelNameDict', 'setColorList']);

    const handleLabelIDChange = (oldLabelID: number, newColor: [number, number, number]) => {
        setColorList(
            colorList.map((color, idx) => {
                if (idx === oldLabelID) {
                    return newColor;
                }
                return color;
            })
        );
    };

    return (
        labelNameDict && (
            <div id="labelList">
                {Object.keys(labelNameDict).map((labelNum) => (
                    <Label
                        labelID={labelNum}
                        colorArray={colorList[parseInt(labelNum)]}
                        onColorChange={(newColor) => handleLabelIDChange(parseInt(labelNum), newColor)}
                    />
                ))}
            </div>
        )
    );
};

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

export function VisualizationInfo() {
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
    const { labelDict, colorDict,} =
        useStore(["labelDict", "colorDict"]);

    const classListRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    
    function changeLabelColor(i: number, newColor: [number, number, number]) {
        console.log(i, newColor);
    }
    
    // for search
    // const searchResult: SampleTag[] = [
    //     {
    //         num: 1,
    //         class: 'code'
    //     },
    //     {
    //         num: 2,
    //         class: 'comment'
    //     }
    // ];

    // NOTE always add state as middle dependency
    const [searchText, setSearchText] = useState('');
    const [searchResult, setSearchResult] = useState<SampleTag[]>([]);

    // TODO do not directly access result here
    const searchByToken = (e: React.ChangeEvent<HTMLInputElement>) => {
        const searchText = e.target.value;
        if (searchText.length === 0) {
            setSearchResult([]);
            return;
        }
        
        if (allEpochsProjectionData[epoch] === undefined) return;
        const tokensWithIndex = allEpochsProjectionData[epoch].tokens.entries();
        
        setSearchResult(Array.from(tokensWithIndex).filter(([idx, token]) => token.includes(searchText)).map(([num, title]) => ({ num, title })));
    };

    const clearSearch = () => {
        setSearchResult([]);
    };

    // for selection
    // const [selectedItems, setSelectedItems] = useState([
    //     {
    //         num: 1,
    //         class: 'code'
    //     },
    //     {
    //         num: 2,
    //         class: 'comment'
    //     }
    // ]);

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
            <div className="component-block">
                <div className="label">Classes</div>
                <div className="class-list">
                    {
                        Array.from(labelDict.keys()).map((labelNum) => (
                            <div
                                className="class-item"
                                key={labelNum}
                                ref={el => classListRefs.current.set(labelNum, el!)}
                                // onMouseOver={() => classListRefs.current.get(labelNum)!.style.opacity = '1'}
                                // onMouseLeave={() => classListRefs.current.get(labelNum)!.style.opacity = '0.3'}
                            >
                                <input
                                    type="color"
                                    value={rgbArrToHex(colorDict.get(labelNum)!)}
                                    onChange={(e) => changeLabelColor(labelNum, hexToRgbArray((e.target as HTMLInputElement).value))}
                                />
                                <span style={{ color: rgbArrToHex(colorDict.get(labelNum)!) }}>
                                    {labelDict.get(labelNum)}
                                </span>
                            </div>
                        ))
                    }
                </div>
            </div>
            <Divider />
            <div className="component-block">
                <div className="label">Search</div>
                <Input allowClear onInput={searchByToken} onClear={clearSearch}/>
                {<List className="margin-before search-result"
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
                />}
            </div>
            <Divider />
            <div className="component-block">
                <div className="label">Selected</div>
                <div className="tag-list">
                    {
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
                    }
                </div>
            </div>
        </div>
    )
}
