import { useStore } from '../state/store';
import { useRef } from 'react';


function hexToRgbArray(hex: string): [number, number, number] {
    hex = hex.replace(/^#/, '');
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return [r, g, b];
}
function translateCssColor(rgbArray: number[]): string {
    return '#' + rgbArray.map(c => c.toString(16).padStart(2, '0')).join('');
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
            <span style={{ color: translateCssColor(colorArray) }}>
                {colorArray}
            </span>
            <input
                type="color"
                value={translateCssColor(colorArray)}
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

export function VisualizationInfo() {
    return (
        <div className="info-column">
            <div id="subject_model_info_panel">
                <div id="labelsSection">
                    <div>Labels</div>
                    <LabelList >
                    </LabelList>
                </div>
            </div>
        </div>
    )
}
