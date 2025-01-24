import { Edge } from "./types";

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