import { useCallback } from "react";
import { fetchTrainingProcessStructure, fetchUmapProjectionData, getAttributeResource, getBgimg, getText, visualizeTrainingProcess } from "../communication/api";
import { HighlightContext, randomColor } from "../component/canvas/types";
import { useDefaultStore } from "./state-store";
import { get } from "@visactor/vchart/esm/util";
import { BUILD_CONSTANTS } from "../constants";

export function useSetUpTrainingProcess() {
    const { contentPath, backendHost, setAvailableEpochs, setTextData, setAttentionData, setOriginalTextData, setInherentLabelData, setEpoch, setHighlightContext, allEpochsProjectionData, setAllEpochsProjectionData, visMethod } =
        useDefaultStore(
            [
                'contentPath', 'setAvailableEpochs', 'backendHost', 'setTextData', 'setAttentionData', 'setOriginalTextData', 'setInherentLabelData', 'setEpoch', 'setHighlightContext',
                'allEpochsProjectionData', 'setAllEpochsProjectionData', 'visMethod'
            ]
        );

    const setUpTrainingProcess = useCallback(async () => {
        const res = await fetchTrainingProcessStructure(contentPath, {
            host: backendHost
        });
        setAvailableEpochs(res['available_epochs']);

        if (res['available_epochs'].length > 0) {
            setEpoch(res['available_epochs'][0]);
        }

        // FIXME should this block here?
        const text = await getText(contentPath, {
            host: backendHost
        });
        setTextData(text['text_list'] ?? []);

        // FIXME extract the common pattern of getting each label, and reuse
        const attention = await getAttributeResource(contentPath, 1, 'attention', {
            host: backendHost
        });
        setAttentionData(attention['attention'] ?? []);

        const fullTextForEachLabel = await getAttributeResource(contentPath, 1, 'originalText', {
            host: backendHost
        });
        setOriginalTextData(fullTextForEachLabel['originalText'] ?? []);

        const inherentLabels = await getAttributeResource(contentPath, 1, 'label', {
            host: backendHost
        });
        setInherentLabelData(inherentLabels['label'] ?? []);

        console.log(`${BUILD_CONSTANTS.APP_CONFIG} setUpTrainingProcess: `, text['text_list'].length);
        setHighlightContext(new HighlightContext(text['text_list'].length));

        // if (res['available_epochs'].length > 0) {
        //     for (const epoch of res['available_epochs']) {
        //         const epochData = await fetchUmapProjectionData(contentPath, epoch, {
        //             method: visMethod,
        //             host: backendHost
        //         });
        //         const newData = { ...allEpochsProjectionData };
        //         newData[epoch] = epochData; // the latest epoch may have been updated in UI, but not yet in store
        //     }
        // }

    }, [backendHost, contentPath, setAvailableEpochs, setTextData, setEpoch]);

    return setUpTrainingProcess;
}

export function useSetUpProjection() {
    // TODO avoid writing attribute twice
    const { contentPath, allEpochsProjectionData, setAllEpochsProjectionData, backendHost, visMethod,
        setHighlightContext, setTextData, setLabelDict, setColorDict, setNeighborSameType, setNeighborCrossType, setLastNeighborSameType, setLastNeighborCrossType, setPredictionProps }
        = useDefaultStore([
            'contentPath',
            'allEpochsProjectionData', 'setProjectionDataAtEpoch',
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
            'setLastNeighborSameType',
            'setLastNeighborCrossType',
            'setAllEpochsProjectionData',
            'setPredictionProps'
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
            // part 1: process projection data
            const newData = { ...allEpochsProjectionData };
            newData[epoch] = res; // the latest epoch may have been updated in UI, but not yet in store
            const config = res.config;

            // part 2: relationship between points
            if (config.dataset.taskType == 'Umap-Neighborhood') {
                const sameTypeNeighbor = await getAttributeResource(contentPath, epoch, 'intra_similarity', {
                    host: backendHost
                });
                const crossTypeNeighbor = await getAttributeResource(contentPath, epoch, 'inter_similarity', {
                    host: backendHost
                });
                setNeighborSameType(sameTypeNeighbor['intra_similarity']);
                setNeighborCrossType(crossTypeNeighbor['inter_similarity']);

                if (epoch > 1) {
                    const lastSameTypeNeighbor = await getAttributeResource(contentPath, epoch - 1, 'intra_similarity', {
                        host: backendHost
                    });
                    const lastCrossTypeNeighbor = await getAttributeResource(contentPath, epoch - 1, 'inter_similarity', {
                        host: backendHost
                    });
                    setLastNeighborSameType(lastSameTypeNeighbor['intra_similarity']);
                    setLastNeighborCrossType(lastCrossTypeNeighbor['inter_similarity']);
                }

                const text = await getText(contentPath, {
                    host: backendHost
                });
                setTextData(text['text_list'] ?? []);
            }

            // part 3: for classification task, acquire prediction
            if (config.dataset.taskType == 'classification') {
                const predRes = await getAttributeResource(contentPath, epoch, 'prediction', {
                    host: backendHost
                });
                setPredictionProps(predRes['prediction']);
            }
            else {
                setPredictionProps([]);
            }

            // TODO Do an immediate setup dict. Don't know how to fix it because outer setDict cannot see the updated projection data
            const labelDict = new Map<number, string>();
            const colorDict = new Map<number, [number, number, number]>();

            // Here we construct labelDict from res.label_text_list (e.g. [comment, code])
            // and randomly asssign a color to each label !
            const label_text_list = res.label_text_list;
            label_text_list.forEach((label, i) => {
                labelDict.set(i, label);
                colorDict.set(i, randomColor(i));
            });

            // const validLabels = Array.from(new Set(res.labels));
            // validLabels.forEach((classLabel, i) => {
            //     labelDict.set(i, classLabel);
            //     colorDict.set(i, randomColor(i));
            // });

            setLabelDict(labelDict);
            setColorDict(colorDict);
            setAllEpochsProjectionData(newData);
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

export function useTrainVisualizer() {
    const { contentPath, backendHost, visMethod }
        = useDefaultStore([
            'contentPath',
            'backendHost',
            'visMethod'
        ]);
    const trainVisualizer = useCallback(async () => {
        const res = await visualizeTrainingProcess(contentPath, {
            method: visMethod,
            host: backendHost
        });
    }, [backendHost, contentPath, visMethod]);

    return trainVisualizer;
}
