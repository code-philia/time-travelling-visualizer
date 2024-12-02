import { VisualizationOptions } from "./component/options"
import { VisualizationArea } from './component/content'
import { VisualizationInfo } from './component/model-info'
import { useEffect } from "react";
import { fetchUmapProjectionData } from "./user/api";
import { useStore } from "./state/store";
import { HighlightContext, randomColor } from "./canvas/types";

function App() {
    const { contentPath, epoch, allEpochsProjectionData, setProjectionDataAtEpoch } = useStore(['contentPath', 'epoch', 'allEpochsProjectionData', 'setProjectionDataAtEpoch']);

    const { setHighlightContext } = useStore(['setHighlightContext']);
    let shouldSetHighlightContext = false;

    useEffect(() => {
        shouldSetHighlightContext = true;
    }, [contentPath]);

    // FIXME this is updating too many things
    useEffect(() => {
        (async () => {
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
    }, [allEpochsProjectionData, contentPath, epoch, setProjectionDataAtEpoch]);

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
            <VisualizationOptions />
            <VisualizationArea />
            <VisualizationInfo />
        </div>
    )
}

export default App
