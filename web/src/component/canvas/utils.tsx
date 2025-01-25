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

// Calculate Euclidean distance between two points
function euclideanDistance(p1: number[], p2: number[]): number {
    return Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2);
}

// Calculate the centroid of the points
function calculateCentroid(points: number[][]): number[] {
    const xSum = points.reduce((sum, p) => sum + p[0], 0);
    const ySum = points.reduce((sum, p) => sum + p[1], 0);
    return [xSum / points.length, ySum / points.length];
}

export function convexHull(points: number[][]): number[][] {
    points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    // Step 1: Filter outliers
    const centroid = calculateCentroid(points);
    const distances = points.map(p => euclideanDistance(p, centroid));

    // calculate mean and standard deviation
    const mean = distances.reduce((sum, dist) => sum + dist, 0) / distances.length;
    const stdDev = Math.sqrt(distances.reduce((sum, dist) => sum + (dist - mean) ** 2, 0) / distances.length);

    // dynamic threshold: mean + 2 * standard deviation
    const threshold = mean + 2 * stdDev;
    const filteredPoints = points.filter(p => euclideanDistance(p, centroid) <= threshold);


    // Step 2: Calculate convex hull
    function cross(o: number[], a: number[], b: number[]): number {
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    }

    const lower: number[][] = [];
    for (const p of filteredPoints) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }

    const upper: number[][] = [];
    for (let i = filteredPoints.length - 1; i >= 0; i--) {
        const p = filteredPoints[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }
    upper.pop();
    lower.pop();
    const hull = [...upper, ...lower];

    // Step 3: Expand hull
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