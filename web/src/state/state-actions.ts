import { useCallback } from "react";
import { fetchTrainingProcessStructure, fetchUmapProjectionData, getAttributeResource, getText } from "../communication/api";
import { HighlightContext, randomColor } from "../component/canvas/types";
import { useDefaultStore } from "./store";

export function useSetUpTrainingProcess() {
    const { contentPath, backendHost, setAvailableEpochs, setTextData, setEpoch, setHighlightContext } =
        useDefaultStore(['contentPath', 'setAvailableEpochs', 'backendHost', 'setTextData', 'setEpoch', 'setHighlightContext']);

    const setUpTrainingProcess = useCallback(async () => {
        const res = await fetchTrainingProcessStructure(contentPath, {
            host: backendHost
        });
        setAvailableEpochs(res['available_epochs']);

        if (res['available_epochs'].length > 0) {
            setEpoch(res['available_epochs'][0]);
        }

        const text = await getText(contentPath, {
            host: backendHost
        });
        setTextData(text['text_list'] ?? []);

        setHighlightContext(new HighlightContext());

    }, [backendHost, contentPath, setAvailableEpochs, setTextData, setEpoch]);

    return setUpTrainingProcess;
}

export function useSetUpProjection() {
    // TODO avoid writing attribute twice
    const { contentPath, allEpochsProjectionData, setAllEpochsProjectionData, backendHost, visMethod, setHighlightContext, setLabelDict, setColorDict, setNeighborSameType, setNeighborCrossType }
        = useDefaultStore([
            'contentPath',
            'allEpochsProjectionData','setProjectionDataAtEpoch',
            'updateUUID',
            'backendHost',
            'visMethod',
            'setHighlightContext',
            'setTextData',
            'setLabelDict',
            'setColorDict',
            'setAvailableEpochs',
            'setNeighborSameType',
            'setNeighborCrossType',
            'setAllEpochsProjectionData'
        ]);

    // TODO add cache

    // FIXME this is updating too many things, even depending on too many things
    const setUpProjections = useCallback(async (epoch: number) => {
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

            const newData = { ...allEpochsProjectionData };
            newData[epoch] = res; // the latest epoch may have been updated in UI, but not yet in store
            setAllEpochsProjectionData(newData);

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
    }, [allEpochsProjectionData, backendHost, contentPath, setAllEpochsProjectionData, setColorDict, setHighlightContext, setLabelDict, setNeighborCrossType, setNeighborSameType, visMethod]);

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
