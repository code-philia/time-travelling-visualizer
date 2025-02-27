import { BriefProjectionResult } from "../communication/api";
import { Edge } from "./canvas/types";
import { DistancePair } from "./canvas/types";

export function softmax(arr: number[]): number[] {
    const expValues = arr.map(val => Math.exp(val));
    const sumExpValues = expValues.reduce((acc, val) => acc + val, 0);
    return expValues.map(val => val / sumExpValues);
}

export function createEdges(
    currentSameType: number[][],
    currentCrossType: number[][],
    previousSameType: number[][],
    previousCrossType: number[][]
): Edge[] {
    const edges: Edge[] = [];
    const allNodes = new Set<number>();

    // Collect all nodes
    [currentSameType, currentCrossType, previousSameType, previousCrossType].forEach(matrix => {
        matrix.forEach((neighbors, node) => {
            allNodes.add(node);
            neighbors.forEach(neighbor => allNodes.add(neighbor));
        });
    });

    allNodes.forEach(node => {
        const currentNeighborsSameType = new Set(currentSameType[node] || []);
        const currentNeighborsCrossType = new Set(currentCrossType[node] || []);
        const previousNeighborsSameType = new Set(previousSameType[node] || []);
        const previousNeighborsCrossType = new Set(previousCrossType[node] || []);

        // Check sameType neighbors
        currentNeighborsSameType.forEach(neighbor => {
            if (previousNeighborsSameType.has(neighbor)) {
                if (node != neighbor) {
                    edges.push({ from: node, to: neighbor, type: 'sameType', status: 'maintain' });
                }
            } else {
                if (node != neighbor) {
                    edges.push({ from: node, to: neighbor, type: 'sameType', status: 'connect' });
                }
            }
        });

        previousNeighborsSameType.forEach(neighbor => {
            if (!currentNeighborsSameType.has(neighbor)) {
                if (node != neighbor) {
                    edges.push({ from: node, to: neighbor, type: 'sameType', status: 'disconnect' });
                }
            }
        });

        // Check crossType neighbors
        currentNeighborsCrossType.forEach(neighbor => {
            if (previousNeighborsCrossType.has(neighbor)) {
                if (node != neighbor) {
                    edges.push({ from: node, to: neighbor, type: 'crossType', status: 'maintain' });
                }
            } else {
                if (node != neighbor) {
                    edges.push({ from: node, to: neighbor, type: 'crossType', status: 'connect' });
                }
            }
        });

        previousNeighborsCrossType.forEach(neighbor => {
            if (!currentNeighborsCrossType.has(neighbor)) {
                if (node != neighbor) {
                    edges.push({ from: node, to: neighbor, type: 'crossType', status: 'disconnect' });
                }
            }
        });
    });

    return edges;
}


export function calculateSignificantPairsGlobal(allEpochsProjectionData: Record<number, BriefProjectionResult>, availableEpochs: number[]) {
    if (availableEpochs.length < 2 || Object.keys(allEpochsProjectionData).length < availableEpochs.length) {
        return [];
    }
    return calculateSignificantPairs(allEpochsProjectionData, availableEpochs[0], availableEpochs[availableEpochs.length - 1]);
};

export function calculateSignificantPairs(
    allEpochsProjectionData: Record<number, BriefProjectionResult>,
    from: number,
    to: number,
    thresholdClose = 0.3,
    thresholdAway = 2
) {
    const firstEpoch = allEpochsProjectionData[from];
    const lastEpoch = allEpochsProjectionData[to];
    const pairs: DistancePair[] = [];

    const span = 1 + (Math.abs(to - from) / Object.keys(allEpochsProjectionData).length);

    for (let i = 0; i < firstEpoch.labels.length; i++) {
        for (let j = i + 1; j < firstEpoch.labels.length; j++) {
            if (i === j) continue;

            const startDist = euclideanDistance(firstEpoch.proj[i], firstEpoch.proj[j]);
            const endDist = euclideanDistance(lastEpoch.proj[i], lastEpoch.proj[j]);
            const delta = endDist - startDist;

            const relativeDelta = delta / startDist;

            let threshold;
            if (delta < 0) {
                threshold = thresholdClose * span;
            } else {
                threshold = thresholdAway * span;
            }

            if (Math.abs(relativeDelta) > threshold) {
                pairs.push({
                    indexA: i,
                    indexB: j,
                    startDistance: startDist,
                    endDistance: endDist,
                    distanceDelta: delta,
                    labelA: firstEpoch.labels[i],
                    labelB: firstEpoch.labels[j]
                });
            }
        }
    }

    return pairs.sort((a, b) => Math.abs(b.distanceDelta) - Math.abs(a.distanceDelta));
};

const euclideanDistance = (a: number[], b: number[]) => {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
};


export function transferArray2Color(colorArray: [number, number, number] | undefined): string {
    if (!colorArray) {
        return 'rgb(116, 116, 116)';
    }
    const [r, g, b] = colorArray;
    return `rgb(${r}, ${g}, ${b})`;
}