import { useCallback } from "react";
import { fetchTrainingProcessInfo, fetchTrainingProcessStructure, fetchUmapProjectionData, getAttributeResource, getBackground, getText, visualizeTrainingProcess } from "../communication/api";
import { HighlightContext } from "../component/canvas/types";
import { useDefaultStore } from "./store";

// Set up the training process
export function useSetUpTrainingProcess() {
    const { contentPath, backendHost, setAvailableEpochs, setTextData, setEpoch, setHighlightContext, setColorDict, setLabelDict } =
        useDefaultStore(['contentPath', 'setAvailableEpochs', 'backendHost', 'setTextData', 'setEpoch', 'setHighlightContext', 'setColorDict', 'setLabelDict']);

    const setUpTrainingProcess = useCallback(async () => {
        // 1. get iteration structure
        const res = await fetchTrainingProcessStructure(contentPath, {
            host: backendHost
        });
        setAvailableEpochs(res['available_epochs']);
        if (res['available_epochs'].length > 0) {
            setEpoch(res['available_epochs'][0]);
        }

        // 2. get basic info of training process
        //    - color list
        //    - label description list
        const res1 = await fetchTrainingProcessInfo(contentPath, {
            host: backendHost
        });

        const colorDict = new Map<number, [number, number, number]>();
        res1['color_list'].forEach((c: number[], i: number) => {
            colorDict.set(i, [c[0], c[1], c[2]]);
        });
        setColorDict(colorDict);

        const labelDict = new Map<number, string>();
        res1['label_text_list'].forEach((label: string, i: number) => {
            labelDict.set(i, label);
        });
        setLabelDict(labelDict);

        // 3. init highlight context
        setHighlightContext(new HighlightContext());

    }, [backendHost, contentPath, setAvailableEpochs, setTextData, setEpoch]);

    return setUpTrainingProcess;
}

// Set up certain epoch of the training process
export function useSetUpProjection() {
    // TODO avoid writing attribute twice
    const { contentPath, allEpochsProjectionData, setAllEpochsProjectionData, allBackground, setAllBackground, backendHost, visMethod,
        setHighlightContext, setTextData, setNeighborSameType, setNeighborCrossType, setLastNeighborSameType, setLastNeighborCrossType, setPredictionProps }
        = useDefaultStore([
            'contentPath',
            'allEpochsProjectionData',
            'setAllEpochsProjectionData',
            'allBackground',
            'setAllBackground',
            'backendHost',
            'visMethod',
            'setHighlightContext',
            'setTextData',
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

            // part 3: for classification task, acquire prediction and background
            const newBackground = { ...allBackground };
            if (config.dataset.taskType == 'classification') {
                const predRes = await getAttributeResource(contentPath, epoch, 'prediction', {
                    host: backendHost
                });
                setPredictionProps(predRes['prediction']);

                const bgimgRes = await getBackground(contentPath, visMethod, 800, 600, res.scale, {
                    host: backendHost
                });
                newBackground[epoch] = bgimgRes;
            }
            else {
                setPredictionProps([]);
                newBackground[epoch] = '';
            }


            setAllEpochsProjectionData(newData);
            setAllBackground(newBackground);
        }
    }, [allEpochsProjectionData, backendHost, contentPath, setAllEpochsProjectionData, setHighlightContext, setNeighborCrossType, setNeighborSameType, visMethod]);

    return setUpProjections;
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
