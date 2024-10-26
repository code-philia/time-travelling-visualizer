import { LabelList } from "./label"
import './index.css'

export function ModelInfo(labelNameDict:any, colorList:any) {
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