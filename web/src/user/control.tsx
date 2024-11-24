import { Radio, Divider, Button, Input } from "antd"


export function ControlPanel() {
    return (
        <div id="control-panel">
            <span style={{ display: 'inline-block', marginRight: '20px' }}>Data Type:</span><br />
            <div id="contentSettingData">
                <Radio v-model="dataType" >Image</Radio>
                <Radio v-model="dataType" >Text</Radio>
            </div>
            <Divider></Divider>
            <span style={{ display: 'inline-block', marginRight: '20px' }}>Task Type:</span><br />
            <div id="contentSettingTask">
                <Divider v-model="taskType" >Classification</Divider>
                <Divider v-model="taskType" >Non-Classification</Divider>
            </div>
            <Divider></Divider>
            <span style={{ display: 'inline-block', marginRight: '20px' }}>Color Points?</span><br />
            <div id="colorSettingTask" v-if="showColorSetting">
                <Divider >No Need</Divider>
                <Divider >Classification Coloring</Divider>
            </div>
            <Button id="loadColorButton" style={{ backgroundColor: '#571792', color: '#fff', width: '100%', marginTop: '0px' }}>Load Color</Button>
            <Divider v-if="showColorSetting"></Divider>
            <div id="contentPathInput">
                Content Path:
                <Input v-model="contentPath"></Input>
            </div>
            <div id="visMethodInput">
                Visualization Method:
                <Input v-model="visMethod"></Input>
            </div>
            <Divider></Divider>
            <Button id="showVisResBtn" style={{ backgroundColor: " #571792", color: "#fff", width: "100%", marginTop: "0px" }}>
                Load Visualization Result
            </Button>
            <Divider></Divider>
            <Button id="loadVDBBtn" style={{ backgroundColor: " #571792", color: "#fff", width: "100%", marginTop: "0px" }}>
                Load Vector Database
            </Button>
            <Divider></Divider>
            <table id="subjectModeEvalRes">
            </table>
            <Divider></Divider>
            <table id="labelColor">
                <thead>
                    <tr>
                        <th>Label</th>
                        <th>Color</th>
                    </tr>
                </thead>
                <tbody>

                </tbody>
            </table>
            <Divider></Divider>
        </div>
    )
}