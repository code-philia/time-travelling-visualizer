// As application layer

import { useDefaultStoreAll } from "./state-store";

class AppContext {
    // async fetch() {
    //     const { contentPath, epoch, allEpochsProjectionData, setProjectionDataAtEpoch, updateUUID, backendHost, visMethod }
    //         = useStoreAll(['contentPath', 'epoch', 'allEpochsProjectionData', 'setProjectionDataAtEpoch', 'updateUUID', 'backendHost', 'visMethod']);

    //     if (isInitialState(contentPath)) return;

    //     if (allEpochsProjectionData[epoch]) return;

    //     const res = await fetchUmapProjectionData(contentPath, epoch, {
    //         method: visMethod,
    //         host: backendHost
    //     });
    //     if (res) {
    //         setProjectionDataAtEpoch(epoch, res);
    //         // TODO judge before then do setting highlight context later, does this really work normally?
    //         if (shouldSetHighlightContext) {
    //             setHighlightContext(new HighlightContext());
    //         }
    //     }
    // }
}

export const appContext = new AppContext();
