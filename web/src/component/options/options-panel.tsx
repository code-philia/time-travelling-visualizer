import { Radio, Button, Input, Flex, Select, InputRef, Divider, Checkbox } from "antd"
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

interface Option {
    label: string;
    value: string;
    disabled?: boolean;
}

function useCheckOptions<T extends string | number | Option>(options: T[] = []) {
    const [checked, setChecked] = useState<string[]>([]);
    return [options, checked, setChecked] as const;
}

// TODO put these blocks to a universal file
// TODO add resize/drag/dock-to mouse interaction

function FunctionalBlock(props: { label: string, children?: null | React.ReactNode | React.ReactNode[] }) {
    return (
        <div className="functional-block">
            <div className="functional-block-title">{props.label}</div>
            {props.children}
        </div>
    )
}

function ComponentBlock(props: { label: string, children?: null | React.ReactNode | React.ReactNode[] }) {
    return (
        <div className="component-block">
            <div className="label">{props.label}</div>
            {props.children}
        </div>
    )
}

export function OptionsPanel() {
    const [dataType, setDataType] = useState<string>("Image")
    const [contentPath, setContentPath] = useState<string>("/home/yuhuan/projects/cophi/visualizer-original/dev/gcb_tokens")

    const { setValue, timelineData } = useStore(["setValue", "timelineData"]);    // TODO now this global store acts as GlobalVisualizationConfiguration

    const dataTypeOptions = [{ label: 'Image', value: 'Image', }, { label: 'Text', value: 'Text', },];

    // display options

    const [displayNormalInfoOptions, displayNormalInfoChecked, setDisplayNormalInfoChecked] = useCheckOptions([
        { label: 'Metadata', value: 'metadata' },
    ]);
    const [displayOnPlotOptions, displayOnPlotChecked, setDisplayOnPlotChecked] = useCheckOptions([
        'number', 'text'
    ]);  // TODO this should be read from backend
    const [revealNeighborOptions, revealNeighborChecked, setRevealNeighborChecked] = useCheckOptions([
        'same-type', 'cross-type'
    ]);

    const inputRef = useRef<InputRef>(null);

    return (
        <div id="control-panel">
            <div className="functional-block">
                <div className="functional-block-title">Load Options</div>
                {/* <div className="component-block">
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
                    <div className="input label">Visualization Method</div>
                    <Select className="full-width" defaultValue="TrustVis" options={items} />
                </div> */}
                <div className="component-block">
                    <div className="label">Content Path</div>
                    <Input ref={inputRef} onChange={(e) => setContentPath(e.target.value)} />
                </div>
                {/* <div className="component-block">
                    <div className="input label">Options</div>
                    <Checkbox checked={}>Show Numbers</Checkbox>
                    <Checkbox >Show Tokens</Checkbox>
                </div> */}
                <div className="component-block">
                    <Button className="input-button" color="primary" variant="solid" style={{ width: '100%' }}
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
                        Load Visualization
                    </Button>
                </div>
            </div>
            <Divider />
            <FunctionalBlock label="Display Options">
                <ComponentBlock label="Panels">
                    <Checkbox.Group options={displayNormalInfoOptions} value={displayNormalInfoChecked} onChange={setDisplayNormalInfoChecked} />
                </ComponentBlock>
                <ComponentBlock label="On Plot">
                    <Checkbox.Group options={displayOnPlotOptions} value={displayOnPlotChecked} onChange={setDisplayOnPlotChecked} />
                </ComponentBlock>
            </FunctionalBlock>
            <Divider />
            <FunctionalBlock label="Special Options">
                <ComponentBlock label="Reveal Neighbors">
                    <Checkbox.Group options={revealNeighborOptions} value={revealNeighborChecked} onChange={setRevealNeighborChecked} />
                </ComponentBlock>
            </FunctionalBlock>
            <Divider />
        </div >
    )
}
