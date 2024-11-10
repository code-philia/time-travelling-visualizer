import '../index.css'
import { setColorPickerOpacity, translateCssColor, changeLabelColor, hexToRgbArray } from './utils'

function LabelList(labelNameDict: any, colorList: any) {
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

export function ModelInfo(labelNameDict: any, colorList: any) {
    return (
        <div id="subject_model_info_panel">
            <div id="labelsSection">
                <div>Labels</div>
                <LabelList labelNameDict={labelNameDict} colorList={colorList}>
                </LabelList>
            </div>
        </div>
    )
}
