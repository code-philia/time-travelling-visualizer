import * as BackendAPI from "../communication/backend";
import { useGlobalStore } from "../state/state.unified";

const LOG_PREFIX = "[LazyLoader]";

function logWithTimestamp(message: string): void {
    console.log(`${LOG_PREFIX}[${new Date().toISOString()}] ${message}`);
}

export const fetchHeavyDataForEpoch = async (
    epochNum: number,
    contentPath: string,
    visualizationID: string,
) => {
    try {
        const store = useGlobalStore.getState();
        const allEpochData = store.allEpochData;

        // Guard: epoch not initialized
        if (!allEpochData[epochNum]) {
            logWithTimestamp(`Epoch ${epochNum} data not initialized yet`);
            return;
        }

        const epochData = allEpochData[epochNum];

        // Guard: already loaded
        if (
            (epochData?.originalNeighbors?.length ?? 0) > 0 ||
            (epochData?.projectionNeighbors?.length ?? 0) > 0
        ) {
            logWithTimestamp(`Epoch ${epochNum} neighbors already loaded`);
            return;
        }

        logWithTimestamp(` Lazy loading neighbors for epoch ${epochNum}...`);

        // Fetch in Parallel
        const [originalNeighbors, projectionNeighbors] = await Promise.all([
            BackendAPI.getOriginalNeighbors(contentPath, epochNum),
            BackendAPI.getProjectionNeighbors(
                contentPath,
                visualizationID,
                epochNum,
            ),
        ]);

        // Update state
        const updatedAllData = {
            ...allEpochData,
            [epochNum]: {
                ...allEpochData[epochNum],
                originalNeighbors: originalNeighbors.neighbors || [],
                projectionNeighbors: projectionNeighbors.neighbors || [],
                neighborsLoaded: true,
                neighborsLoading: false,
            },
        };

        useGlobalStore.setState({
            allEpochData: updatedAllData,
        });

        logWithTimestamp(` Epoch ${epochNum} neighbors loaded successfully`);
    } catch (error) {
        console.error(
            ` Failed to load heavy data for Epoch ${epochNum}:`,
            error,
        );
    }
};
