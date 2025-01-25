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


export function convexHull(points: number[][]): number[][] {
    points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    function cross(o: number[], a: number[], b: number[]): number {
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    }

    const lower: number[][] = [];
    for (const p of points) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }

    const upper: number[][] = [];
    for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }
    upper.pop();
    lower.pop();
    const hull = [...upper, ...lower];

    const centerX = hull.reduce((sum, p) => sum + p[0], 0) / hull.length;
    const centerY = hull.reduce((sum, p) => sum + p[1], 0) / hull.length;

    const expandedHull = hull.map(p => {
        const dx = p[0] - centerX;
        const dy = p[1] - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const scale = (distance + 0.3) / distance;
        return [centerX + dx * scale, centerY + dy * scale];
    });

    return expandedHull;
}