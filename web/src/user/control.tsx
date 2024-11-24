import { Radio, Divider, Button, Input, Flex } from "antd"
import { useState } from "react"
import { useStore } from '../state/store';

export function ControlPanel() {
    const [dataType, setDataType] = useState<string>("Image")
    const [contentPath, setContentPath] = useState<string>("")
    const options = [{ label: 'Image', value: 'Image', }, { label: 'Text', value: 'Text', },];
    const { setValue } = useStore(["setValue"]);
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
                        setValue("contentPath", contentPath)
                        setValue("command", "update")
                        console.log(contentPath)
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