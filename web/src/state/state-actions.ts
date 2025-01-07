import { useCallback } from "react";
import { fetchTrainingProcessStructure, fetchUmapProjectionData, getAttributeResource, getText } from "../communication/api";
import { HighlightContext, randomColor } from "../component/canvas/types";
import { useDefaultStore } from "./store";

export function useSetUpTrainingProcess() {
    const { contentPath, setAvailableEpochs, backendHost, setTextData } = useDefaultStore(['contentPath', 'setAvailableEpochs', 'backendHost', 'setTextData']);

    const setUpTrainingProcess = useCallback(async () => {
        const res = await fetchTrainingProcessStructure(contentPath, {
            host: backendHost
        });
        setAvailableEpochs(res['available_epochs']);

        const text = await getText(contentPath, {
            host: backendHost
        });
        setTextData(text['text_list'] ?? []);

    }, [backendHost, contentPath, setAvailableEpochs, setTextData]);

    return setUpTrainingProcess;
}

export function useSetUpProjections() {
    // TODO avoid writing attribute twice
    const { contentPath, epoch, setProjectionDataAtEpoch, backendHost, visMethod, setHighlightContext, setLabelDict, setColorDict, setNeighborSameType, setNeighborCrossType }
        = useDefaultStore(['contentPath', 'epoch', 'setProjectionDataAtEpoch', 'updateUUID', 'backendHost', 'visMethod', 'setHighlightContext', 'setTextData', 'setLabelDict', 'setColorDict', 'setAvailableEpochs', 'setNeighborSameType', 'setNeighborCrossType']);

    // FIXME this is updating too many things
    const setUpProjections = useCallback(async () => {
        let res = undefined;
        try {
            res = await fetchUmapProjectionData(contentPath, epoch, {
                method: visMethod,
                host: backendHost
            });
        } catch (e) {
            console.warn(e);
        }
        if (res) {
            setProjectionDataAtEpoch(epoch, res);

            setHighlightContext(new HighlightContext());

            const sameTypeNeighbor = await getAttributeResource(contentPath, epoch, 'intra_similarity', {
                host: backendHost
            });
            const crossTypeNeighbor = await getAttributeResource(contentPath, epoch, 'inter_similarity', {
                host: backendHost
            });

            // console.log(sameTypeNeighbor);
            // console.log(crossTypeNeighbor);

            // FIXME add validation of number[][]
            setNeighborSameType(sameTypeNeighbor['intra_similarity']);
            setNeighborCrossType(crossTypeNeighbor['inter_similarity']);

            // TODO Do an immediate setup dict. Don't know how to fix it because outer setDict cannot see the updated projection data
            const labelDict = new Map<number, string>();
            const colorDict = new Map<number, [number, number, number]>();

            const validLabels = Array.from(new Set(res.labels));

            validLabels.forEach((classLabel, i) => {
                labelDict.set(i, classLabel);
                colorDict.set(i, randomColor(i));
            });

            // TODO backend should provide this
            labelDict.set(0, 'comment');
            labelDict.set(1, 'code');

            setLabelDict(labelDict);
            setColorDict(colorDict);
        }
    }, [backendHost, contentPath, epoch, setColorDict, setHighlightContext, setLabelDict, setNeighborCrossType, setNeighborSameType, setProjectionDataAtEpoch, visMethod]);

    return setUpProjections;
}

export function useSetUpDicts() {
    const { epoch, allEpochsProjectionData, setLabelDict, setColorDict }
        = useDefaultStore(['epoch', 'allEpochsProjectionData', 'setLabelDict', 'setColorDict']);

    const setUpDicts = useCallback(() => {
        // TODO extract this currentEpochData to a useStore
        const currentEpochData = allEpochsProjectionData[epoch];
        if (!currentEpochData) return;
    }, [allEpochsProjectionData, epoch]);

    return setUpDicts;
}
