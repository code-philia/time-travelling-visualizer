import { useCallback } from "react";
import { BriefProjectionResult, fetchTrainingProcessInfo, fetchTrainingProcessStructure, fetchUmapProjectionData, getAttributeResource, getBackground, getText, visualizeTrainingProcess } from "../communication/api";
import { HighlightContext } from "../component/canvas/types";
import { useDefaultStore } from "./store";

// Set up the training process
export function useSetUpTrainingProcess() {
    const { contentPath, visMethod, backendHost, taskType, setTaskType, setAvailableEpochs, setTextData, setEpoch, setHighlightContext, setColorDict, setLabelDict, setProgress } =
        useDefaultStore(['contentPath', 'visMethod', 'backendHost', 'taskType', 'setTaskType', 'setAvailableEpochs', 'setTextData', 'setEpoch', 'setHighlightContext', 'setColorDict', 'setLabelDict', 'setProgress']);

    const {
        allEpochsProjectionData, setAllEpochsProjectionData,
        allBackground, setAllBackground,
        allNeighborSameType, setAllNeighborSameType,
        allNeighborCrossType, setAllNeighborCrossType,
        allPredictionProps, setAllPredictionProps
    } = useDefaultStore([
        'allEpochsProjectionData',
        'setAllEpochsProjectionData',
        'allBackground',
        'setAllBackground',
        'allNeighborSameType',
        'setAllNeighborSameType',
        'allNeighborCrossType',
        'setAllNeighborCrossType',
        'allPredictionProps',
        'setAllPredictionProps'
    ]);

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

        const config = res1['config'];
        setTaskType(config['dataset']['taskType']);

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


        // 4. preload epochs
        // data needed to be preloaded
        const allEpochsProjectionDataCopy = { ...allEpochsProjectionData };
        const allBackgroundCopy = { ...allBackground };
        const allNeighborSameTypeCopy = { ...allNeighborSameType };
        const allNeighborCrossTypeCopy = { ...allNeighborCrossType };
        const allPredictionPropsCopy = { ...allPredictionProps };

        // preload and set data
        for (const i of res['available_epochs']) {
            await preLoadEpochProjection(
                i,
                contentPath,
                visMethod,
                backendHost,
                config['dataset']['taskType'],
                allEpochsProjectionDataCopy,
                allBackgroundCopy,
                allNeighborSameTypeCopy,
                allNeighborCrossTypeCopy,
                allPredictionPropsCopy,
                setAllNeighborSameType,
                setAllNeighborCrossType,
                setAllPredictionProps,
                setTextData,
                setAllEpochsProjectionData,
                setAllBackground
            );
            let loadedEpochs = Object.keys(allEpochsProjectionDataCopy).map(Number);
            setProgress(loadedEpochs.length);
        }

    }, [backendHost, contentPath, visMethod, taskType, setAvailableEpochs, setTextData, setEpoch, setProgress]);

    return setUpTrainingProcess;
}

// Set up certain epoch of the training process
export function useSetUpProjection() {
    // TODO avoid writing attribute twice
    const { contentPath, allEpochsProjectionData, setAllEpochsProjectionData, allBackground, setAllBackground, backendHost, visMethod, taskType,
        setHighlightContext, setTextData, allNeighborSameType, setAllNeighborSameType, allNeighborCrossType, setAllNeighborCrossType, allPredictionProps, setAllPredictionProps }
        = useDefaultStore([
            'contentPath',
            'allEpochsProjectionData',
            'setAllEpochsProjectionData',
            'allBackground',
            'setAllBackground',
            'backendHost',
            'visMethod',
            'taskType',
            'setHighlightContext',
            'setTextData',
            'setAvailableEpochs',
            'allNeighborSameType',
            'setAllNeighborSameType',
            'allNeighborCrossType',
            'setAllNeighborCrossType',
            'allPredictionProps',
            'setAllPredictionProps'
        ]);

    // FIXME this is updating too many things, even depending on too many things
    const setUpProjections = useCallback(async (epoch: number) => {
        // cache hit
        if (allEpochsProjectionData[epoch]) {
            return;
        }

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
            const allEpochsProjectionDataCopy = { ...allEpochsProjectionData };
            allEpochsProjectionDataCopy[epoch] = res; // the latest epoch may have been updated in UI, but not yet in store

            // part 2: relationship between points
            if (taskType == 'Umap-Neighborhood') {
                const allNeighborSameTypeCopy = { ...allNeighborSameType };
                const allNeighborCrossTypeCopy = { ...allNeighborCrossType };

                const sameTypeNeighbor = await getAttributeResource(contentPath, epoch, 'intra_similarity', {
                    host: backendHost
                });
                const crossTypeNeighbor = await getAttributeResource(contentPath, epoch, 'inter_similarity', {
                    host: backendHost
                });
                allNeighborSameTypeCopy[epoch] = sameTypeNeighbor['intra_similarity'];
                allNeighborCrossTypeCopy[epoch] = crossTypeNeighbor['inter_similarity'];

                if (epoch > 1 && !allNeighborSameTypeCopy[epoch - 1]) {
                    const lastSameTypeNeighbor = await getAttributeResource(contentPath, epoch - 1, 'intra_similarity', {
                        host: backendHost
                    });
                    const lastCrossTypeNeighbor = await getAttributeResource(contentPath, epoch - 1, 'inter_similarity', {
                        host: backendHost
                    });
                    allNeighborSameTypeCopy[epoch - 1] = lastSameTypeNeighbor['intra_similarity'];
                    allNeighborCrossTypeCopy[epoch - 1] = lastCrossTypeNeighbor['inter_similarity'];
                }

                setAllNeighborSameType(allNeighborSameTypeCopy);
                setAllNeighborCrossType(allNeighborCrossTypeCopy);

                // TODO KWY: avoid get text data muti-times
                const text = await getText(contentPath, {
                    host: backendHost
                });
                setTextData(text['text_list'] ?? []);
            }

            // part 3: for classification task, acquire prediction and background
            const allBackgroundCopy = { ...allBackground };
            const allPredictionPropsCopy = { ...allPredictionProps };
            if (taskType == 'classification') {
                const predRes = await getAttributeResource(contentPath, epoch, 'prediction', {
                    host: backendHost
                });
                allPredictionPropsCopy[epoch] = predRes['prediction'];

                const bgimgRes = await getBackground(contentPath, visMethod, 800, 600, res.scale, {
                    host: backendHost
                });
                allBackgroundCopy[epoch] = bgimgRes;
            }
            else {
                allPredictionPropsCopy[epoch] = [];
                allBackgroundCopy[epoch] = '';
            }

            setAllEpochsProjectionData(allEpochsProjectionDataCopy);
            setAllPredictionProps(allPredictionPropsCopy);
            setAllBackground(allBackgroundCopy);
        }
    }, [allEpochsProjectionData, backendHost, contentPath, setAllEpochsProjectionData, setHighlightContext, setAllNeighborCrossType, setAllNeighborSameType, visMethod]);

    return setUpProjections;
}

export function useSwitchEpoch() {
    // TODO avoid writing attribute twice
    const { allEpochsProjectionData, epoch, setEpoch, taskType } = useDefaultStore([
        'allEpochsProjectionData',
        'epoch',
        'setEpoch',
        'taskType'
    ]);

    const switchEpoch = useCallback(async (curEpoch: number, newEpoch: number) => {
        // already loaded
        if (allEpochsProjectionData[newEpoch]) {
            setEpoch(newEpoch);
        }
        else {
            // TODO: force load or ignore?
            return;
        }
    }, [allEpochsProjectionData, epoch, setEpoch, taskType]);

    return switchEpoch;
}

export async function preLoadEpochProjection(
    epoch: number,
    contentPath: string,
    visMethod: string,
    backendHost: string,
    taskType: string,
    allEpochsProjectionDataCopy: Record<number, BriefProjectionResult>,
    allBackgroundCopy: Record<number, string>,
    allNeighborSameTypeCopy: Record<number, number[][]>,
    allNeighborCrossTypeCopy: Record<number, number[][]>,
    allPredictionPropsCopy: Record<number, number[][]>,
    setAllNeighborSameType: (arg0: any) => void,
    setAllNeighborCrossType: (arg0: any) => void,
    setAllPredictionProps: (arg0: any) => void,
    setTextData: (arg0: any) => void,
    setAllEpochsProjectionData: (arg0: any) => void,
    setAllBackground: (arg0: any) => void
) {
    if (allEpochsProjectionDataCopy[epoch]) {
        return allEpochsProjectionDataCopy;
    }

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
        allEpochsProjectionDataCopy[epoch] = res; // the latest epoch may have been updated in UI, but not yet in store

        // part 2: relationship between points
        if (taskType == 'Umap-Neighborhood') {
            const sameTypeNeighbor = await getAttributeResource(contentPath, epoch, 'intra_similarity', {
                host: backendHost
            });
            const crossTypeNeighbor = await getAttributeResource(contentPath, epoch, 'inter_similarity', {
                host: backendHost
            });
            allNeighborSameTypeCopy[epoch] = sameTypeNeighbor['intra_similarity'];
            allNeighborCrossTypeCopy[epoch] = crossTypeNeighbor['inter_similarity'];

            if (epoch > 1 && !allNeighborSameTypeCopy[epoch - 1]) {
                const lastSameTypeNeighbor = await getAttributeResource(contentPath, epoch - 1, 'intra_similarity', {
                    host: backendHost
                });
                const lastCrossTypeNeighbor = await getAttributeResource(contentPath, epoch - 1, 'inter_similarity', {
                    host: backendHost
                });
                allNeighborSameTypeCopy[epoch - 1] = lastSameTypeNeighbor['intra_similarity'];
                allNeighborCrossTypeCopy[epoch - 1] = lastCrossTypeNeighbor['inter_similarity'];
            }

            setAllNeighborSameType(allNeighborSameTypeCopy);
            setAllNeighborCrossType(allNeighborCrossTypeCopy);

            // TODO KWY: avoid get text data muti-times
            const text = await getText(contentPath, {
                host: backendHost
            });
            setTextData(text['text_list'] ?? []);
        }

        // part 3: for classification task, acquire prediction and background
        if (taskType == 'classification') {
            const predRes = await getAttributeResource(contentPath, epoch, 'prediction', {
                host: backendHost
            });
            allPredictionPropsCopy[epoch] = predRes['prediction'];

            const bgimgRes = await getBackground(contentPath, visMethod, 800, 600, res.scale, {
                host: backendHost
            });
            allBackgroundCopy[epoch] = bgimgRes;
        }
        else {
            allPredictionPropsCopy[epoch] = [];
            allBackgroundCopy[epoch] = '';
        }

        setAllEpochsProjectionData(allEpochsProjectionDataCopy);
        setAllPredictionProps(allPredictionPropsCopy);
        setAllBackground(allBackgroundCopy);
    }
}

export function useTrainVisualizer() {
    const { contentPath, backendHost, visMethod }
        = useDefaultStore([
            'contentPath',
            'backendHost',
            'visMethod'
        ]);
    const trainVisualizer = useCallback(async () => {
        await visualizeTrainingProcess(contentPath, {
            method: visMethod,
            host: backendHost
        });
    }, [backendHost, contentPath, visMethod]);

    return trainVisualizer;
}
