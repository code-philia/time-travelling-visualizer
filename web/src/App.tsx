import { useEffect } from "react";
import { LeftSidebar } from "./component/left-sidebar"
import { MainBlock } from './component/main-block'
import { RightSidebar } from './component/right-sidebar'
import { fetchUmapProjectionData } from "./communication/api";
import { useStore } from "./state/store";
import { HighlightContext, randomColor } from "./component/canvas/types";
import { Button } from "antd";
import { SettingOutlined, SettingTwoTone } from "@ant-design/icons";

function isInitialState(contentPath: string): boolean {
    return contentPath.trim() === "";
}

function App() {
    const { contentPath, epoch, allEpochsProjectionData, setProjectionDataAtEpoch, updateUUID } = useStore(['contentPath', 'epoch', 'allEpochsProjectionData', 'setProjectionDataAtEpoch', 'updateUUID']);

    const { setHighlightContext } = useStore(['setHighlightContext']);
    let shouldSetHighlightContext = false;

    useEffect(() => {
        shouldSetHighlightContext = true;
    }, [contentPath]);

    // FIXME this is updating too many things
    useEffect(() => {
        (async () => {
            if (isInitialState(contentPath)) return;

            if (allEpochsProjectionData[epoch]) return;

            const res = await fetchUmapProjectionData(contentPath, epoch);
            if (res) {
                setProjectionDataAtEpoch(epoch, res);
                // TODO judge before then do setting highlight context later, does this really work normally?
                if (shouldSetHighlightContext) {
                    setHighlightContext(new HighlightContext());
                }
            }
        })();
    }, [allEpochsProjectionData, contentPath, epoch, setHighlightContext, setProjectionDataAtEpoch, shouldSetHighlightContext, updateUUID]);

    const { setLabelDict, setColorDict } = useStore(["setLabelDict", "setColorDict"]);


    useEffect(() => {
        // TODO extract this currentEpochData to a useStore
        const currentEpochData = allEpochsProjectionData[epoch];
        if (!currentEpochData) return;

        const labelDict = new Map<number, string>();
        const colorDict = new Map<number, [number, number, number]>();

        const validLabels = Array.from(new Set(currentEpochData.labels));

        validLabels.forEach((classLabel, i) => {
            labelDict.set(i, classLabel);
            colorDict.set(i, randomColor(i));
        });

        // TODO backend should provide this
        labelDict.set(0, 'comment');
        labelDict.set(1, 'code');

        setLabelDict(labelDict);
        setColorDict(colorDict);
    }, [allEpochsProjectionData, epoch, setColorDict, setLabelDict])

    return (
        <div id='app'>
            <header className='app-header natural-diffuse-shadow strong-down-shadow'>
                <h1 style={{ fontSize: '18px', padding: 0, margin: '6px 0' }}>
                    <div className='dm-serif-text-regular' style={{ fontSize: '10px', lineHeight: '1' }}>Time Traveling</div>
                    <div className='dm-serif-text-regular' style={{ fontSize: '18px', lineHeight: '0.8' }}>Visualizer</div>
                </h1>
                <h1 style={{ fontSize: '12px', marginLeft: '12px' }}>
                    <div className="playwrite-ie-guides-regular">WEB TOOL</div>
                </h1>
                <div className='flex-space'></div>
                <div className='header-button-group'>
                    <Button color="default" variant="text" className="header-button" style={{ color: 'white' }}>
                        <SettingOutlined className="header-button-icon"></SettingOutlined>
                    </Button>
                </div>
            </header>
            <div className='app-body'>
                <LeftSidebar />
                <MainBlock />
                <RightSidebar />
            </div>
        </div>
    )
}

export default App
