import { Radio, Divider, Button, Input, Flex } from "antd"
import { useState } from "react"
import { useStore } from '../state/store';
import { fetchTimelineData } from "./api";



export function ControlPanel() {
    const [dataType, setDataType] = useState<string>("Image")
    const [contentPath, setContentPath] = useState<string>("/home/yuhuan/projects/cophi/visualizer-original/dev/gcb_tokens")
    const options = [{ label: 'Image', value: 'Image', }, { label: 'Text', value: 'Text', },];
    const { setValue, timelineData } = useStore(["setValue", "timelineData"]);    // TODO now this global store acts as GlobalVisualizationConfiguration

    return (
        <div id="control-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <span style={{ display: 'inline-block', marginRight: '20px' }}>Data Type:</span>
            <Flex vertical gap="middle">
                <Radio.Group
                    block
                    options={options}
                    defaultValue="Image"
                    optionType="button"
                    buttonStyle="solid"
                    onChange={(e) => setDataType(e.target.value)}
                />
            </Flex>
            <Divider />
            <div id="contentPathInput">
                Content Path:<Input onChange={(e) => setContentPath(e.target.value)} />
            </div>
            <div id="visMethodInput">
                Visualization Method:
                <Input v-model="visMethod"></Input>
            </div>
            <Divider></Divider>
            <Button id="showVisResBtn" style={{ backgroundColor: " #571792", color: "#fff", width: "100%", marginTop: "0px" }}
                onClick={
                    (_) => {
                        // TODO wrapped as update entire configuration
                        setValue("contentPath", contentPath)
                        setValue("command", "update")
                        setValue("updateUUID", Math.random().toString(36).substring(7))
                        if (timelineData === undefined) {
                            fetchTimelineData(contentPath).then((res) => {
                                setValue("timelineData", res);
                            });
                        }
                    }
                }>
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
        </div >
    )
}