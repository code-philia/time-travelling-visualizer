import { Radio, Button, Input, Flex, Select, InputRef, Divider, Checkbox } from "antd";
import { useEffect, useRef, useState } from "react";
import { useDefaultStore } from '../../state/state-store';
import { fetchTimelineData } from "../../communication/api";
import { DefaultOptionType } from "antd/es/select";
import { FunctionalBlock, ComponentBlock } from "../custom/basic-components";
import { useCheckOptions } from "../custom/basic-hooks";
import { useSetUpDicts, useSetUpProjection, useSetUpTrainingProcess, useTrainVisualizer } from "../../state/state-actions";

const validVisMethods: DefaultOptionType['items'] = [
    {
        value: 'TrustVis',
        label: 'TrustVis',
    },
    {
        value: 'DVI',
        label: 'DVI',
    },
    {
        value: 'TimeVis',
        label: 'TimeVis',
    },
];

export function OptionsPanel() {
    const { showNumber, showText, setShowNumber, setShowText } = useDefaultStore(["showNumber", "showText", "setShowNumber", "setShowText"]);
    const { revealNeighborSameType, revealNeighborCrossType, setRevealNeighborSameType, setRevealNeighborCrossType } = useDefaultStore(["revealNeighborSameType", "revealNeighborCrossType", "setRevealNeighborSameType", "setRevealNeighborCrossType"]);

    const [ dataType, setDataType ] = useState<string>("Image");
    const { contentPath, setContentPath } = useDefaultStore(["contentPath", "setContentPath"]);

    const { setValue, timelineData } = useDefaultStore(["setValue", "timelineData"]);    // TODO now this global store acts as GlobalVisualizationConfiguration
    const { visMethod, setVisMethod } = useDefaultStore(["visMethod", "setVisMethod"]);

    const setUpTrainingProcess = useSetUpTrainingProcess();
    const setUpProjections = useSetUpProjection();
    const setUpDicts = useSetUpDicts();
    const trainVisualizer = useTrainVisualizer();

    const dataTypeOptions = [{ label: 'Image', value: 'Image', }, { label: 'Text', value: 'Text', },];
    const { setShowMetadata, setShowBgimg } = useDefaultStore(["setShowMetadata", "setShowBgimg"]);

    // display options

    const [displayNormalInfoOptions, displayNormalInfoChecked, setDisplayNormalInfoChecked] = useCheckOptions([
        { label: 'metadata', value: 'metadata' }, { label: 'background', value: 'bgimg' }
    ]);
    const [displayOnPlotOptions, displayOnPlotChecked, setDisplayOnPlotChecked] = useCheckOptions([
        'number', 'text'
    ]);  // TODO this should be read from backend
    const [revealNeighborOptions, revealNeighborChecked, setRevealNeighborChecked] = useCheckOptions([
        'same-type', 'cross-type'
    ]);

    useEffect(() => {
        const options = [];
        if (showNumber) {
            options.push('number');
        }
        if (showText) {
            options.push('text');
        }
        setDisplayOnPlotChecked(options);
    }, [setDisplayOnPlotChecked, showNumber, showText]);

    useEffect(() => {
        setShowNumber(displayOnPlotChecked.includes('number'));
        setShowText(displayOnPlotChecked.includes('text'));
    }, [displayOnPlotChecked, setShowNumber, setShowText]);

    useEffect(() => {
        setShowBgimg(displayNormalInfoChecked.includes('bgimg'));
    }, [displayNormalInfoChecked, setShowBgimg]);

    useEffect(() => {
        setShowMetadata(displayNormalInfoChecked.includes('metadata'));
    }, [displayNormalInfoChecked, setShowMetadata]);

    useEffect(() => {
        const options = [];
        if (revealNeighborSameType) {
            options.push('same-type');
        }
        if (revealNeighborCrossType) {
            options.push('cross-type');
        }
        setRevealNeighborChecked(options);
    }, [setRevealNeighborChecked, revealNeighborSameType, revealNeighborCrossType]);

    useEffect(() => {
        setRevealNeighborSameType(revealNeighborChecked.includes('same-type'));
        setRevealNeighborCrossType(revealNeighborChecked.includes('cross-type'));
    }, [revealNeighborChecked, setRevealNeighborSameType, setRevealNeighborCrossType]);

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
                </div> */}
                <div className="component-block">
                    <div className="input label">Visualization Method</div>
                    <Select className="full-width" value={visMethod} options={validVisMethods}
                        onChange={(value) => setVisMethod(value)}
                    />
                </div>
                <div className="component-block">
                    <div className="label">Content Path</div>
                    <Input ref={inputRef} value={contentPath} onChange={(e) => setContentPath(e.target.value)} />
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
                                setValue("command", "update");
                                setValue("updateUUID", Math.random().toString(36).substring(7));

                                (async () => {
                                    await setUpTrainingProcess();
                                })();
                            }
                        }>
                        Load Visualization
                    </Button>
                </div>
                <div className="component-block">
                    <Button className="input-button" color="primary" variant="solid" style={{ width: '100%' }}
                        onClick={
                            (_) => {
                                if (inputRef.current?.input) {
                                    setValue("contentPath", inputRef.current.input.value);
                                }
                                (async () => {
                                    await trainVisualizer();
                                })();
                            }
                        }>
                        Train Visualizer
                    </Button>
                </div>
            </div >
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
    );
}
