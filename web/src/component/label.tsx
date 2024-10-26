import { setColorPickerOpacity, translateCssColor, changeLabelColor, hexToRgbArray } from './utils'

export function LabelList(labelNameDict: any, colorList: any) {
    return (
        labelNameDict && (
            <div id="labelList">
                {Object.keys(labelNameDict).map((labelNum) => (
                    <div
                        key={labelNum}
                        onMouseOver={(event) => setColorPickerOpacity(event.currentTarget, labelNum, 1)}
                        onMouseLeave={(event) => setColorPickerOpacity(event.currentTarget, labelNum, 0)}
                    >
                        <span style={{ color: translateCssColor(colorList[labelNum]) }}>
                            {labelNameDict[labelNum]}
                        </span>
                        <input
                            type="color"
                            value={translateCssColor(colorList[labelNum])}
                            id={`color-picker-item-${labelNum}`}
                            onInput={(e) =>
                                changeLabelColor(parseInt(labelNum), hexToRgbArray((e.target as HTMLInputElement).value))
                            }
                        />
                    </div>
                ))}
            </div>
        )
    );
};
