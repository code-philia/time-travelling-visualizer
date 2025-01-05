import { Radio, Button, Input, Flex, Select, InputRef, Divider } from "antd"
import { useRef, useState } from "react"
import { useStore } from '../../state/store';
import { fetchTimelineData } from "../../communication/api";
import { DefaultOptionType } from "antd/es/select";

const items: DefaultOptionType['items'] = [
    {
        value: 'TrustVis',
        label: 'TrustVis',
        key: '1'
    },
];


export function OptionsPanel() {
    const [dataType, setDataType] = useState<string>("Image")
    const [contentPath, setContentPath] = useState<string>("/home/yuhuan/projects/cophi/visualizer-original/dev/gcb_tokens")

    const { setValue, timelineData } = useStore(["setValue", "timelineData"]);    // TODO now this global store acts as GlobalVisualizationConfiguration

    const dataTypeOptions = [{ label: 'Image', value: 'Image', }, { label: 'Text', value: 'Text', },];

    const inputRef = useRef<InputRef>(null);

    return (
        <div id="control-panel">
            <div className="functional-block">
                <div className="component-block">
                    <div className="input label">Data Type</div>
                    <Flex vertical gap="middle">
                        <Radio.Group
                            block
                            options={dataTypeOptions}
                            defaultValue="Image"
                            optionType="button"
                            buttonStyle="solid"
                            onChange={(e) => setDataType(e.target.value)}
                        />
                    </Flex>
                </div>
                <div className="component-block">
                    <div className="input label">Content Path</div>
                    <Input ref={inputRef} onChange={(e) => setContentPath(e.target.value)} />
                </div>
                <div className="component-block">
                    <div className="input label">Visualization Method</div>
                    <Select className="full-width" defaultValue="TrustVis" options={items} />
                </div>
                {/* <div className="component-block">
                    <div className="input label">Options</div>
                    <Checkbox checked={}>Show Numbers</Checkbox>
                    <Checkbox >Show Tokens</Checkbox>
                </div> */}
            </div>
            <Divider></Divider>
            <div className="functional-block">
                <Button className="input-button" color="primary" variant="solid"
                    onClick={
                        (_) => {
                            // TODO wrapped as update entire configuration
                            if (inputRef.current?.input) {
                                setValue("contentPath", inputRef.current.input.value);
                            }
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
            </div>
            <table id="subjectModeEvalRes">
            </table>
        </div >
    )
}
