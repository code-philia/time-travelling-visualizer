import { Edge } from "./types";

// Fast argmax - O(n) single pass, no array allocation
export function argmax(arr: number[]): number {
    const len = arr.length;
    if (len === 0) return 0;
    let maxIdx = 0;
    let maxVal = arr[0];
    for (let i = 1; i < len; i++) {
        if (arr[i] > maxVal) {
            maxVal = arr[i];
            maxIdx = i;
        }
    }
    return maxIdx;
}

// Optimized softmax: avoid creating intermediate arrays
export function softmax(arr: number[]): number[] {
    const len = arr.length;
    if (len === 0) return [];
    
    // Find max for numerical stability
    let maxVal = arr[0];
    for (let i = 1; i < len; i++) {
        if (arr[i] > maxVal) maxVal = arr[i];
    }
    
    // Compute exp and sum in one pass
    const result = new Array(len);
    let sum = 0;
    for (let i = 0; i < len; i++) {
        result[i] = Math.exp(arr[i] - maxVal); // Subtract max for stability
        sum += result[i];
    }
    
    // Normalize
    const invSum = 1 / sum;
    for (let i = 0; i < len; i++) {
        result[i] *= invSum;
    }
    
    return result;
}

// Fast softmax that returns max value and its index directly
export function softmaxWithMax(arr: number[]): { maxValue: number; maxIndex: number } {
    const len = arr.length;
    if (len === 0) return { maxValue: 1, maxIndex: 0 };
    
    // Find max for numerical stability
    let maxVal = arr[0];
    for (let i = 1; i < len; i++) {
        if (arr[i] > maxVal) maxVal = arr[i];
    }
    
    // Compute exp and sum, track max
    let sum = 0;
    let expMax = 0;
    let maxIndex = 0;
    
    for (let i = 0; i < len; i++) {
        const exp = Math.exp(arr[i] - maxVal);
        sum += exp;
        if (exp > expMax) {
            expMax = exp;
            maxIndex = i;
        }
    }
    
    return { maxValue: expMax / sum, maxIndex };
}

// Optimized createEdges: Use typed arrays and minimal allocations
// Returns edges array and pre-built neighbor map for O(1) lookups
export function createEdgesWithMaps(
    currentSameType: number[][],
    currentCrossType: number[][]
): { 
    edges: Edge[]; 
    neighborMap: Map<number, number[]>; 
    edgeMap: Map<string, Edge>;
} {
    // Estimate capacity to avoid resizing
    let totalEdges = 0;
    for (let i = 0; i < currentSameType.length; i++) {
        if (currentSameType[i]) totalEdges += currentSameType[i].length;
    }
    for (let i = 0; i < currentCrossType.length; i++) {
        if (currentCrossType[i]) totalEdges += currentCrossType[i].length;
    }
    
    const edges: Edge[] = new Array(totalEdges);
    const neighborMap = new Map<number, number[]>();
    const edgeMap = new Map<string, Edge>();
    let edgeIdx = 0;
    
    // Process highDim edges (original space neighbors)
    const len1 = currentSameType.length;
    for (let node = 0; node < len1; node++) {
        const neighbors = currentSameType[node];
        if (!neighbors || neighbors.length === 0) continue;
        
        // Build neighbor list for this node
        let nodeNeighbors = neighborMap.get(node);
        if (!nodeNeighbors) {
            nodeNeighbors = [];
            neighborMap.set(node, nodeNeighbors);
        }
        
        for (let j = 0; j < neighbors.length; j++) {
            const neighbor = neighbors[j];
            if (node === neighbor) continue;
            
            const edge: Edge = { from: node, to: neighbor, type: 'highDim', status: 'connect' };
            edges[edgeIdx++] = edge;
            edgeMap.set(`${node}-${neighbor}`, edge);
            nodeNeighbors.push(neighbor);
        }
    }
    
    // Process lowDim edges (projection space neighbors)
    const len2 = currentCrossType.length;
    for (let node = 0; node < len2; node++) {
        const neighbors = currentCrossType[node];
        if (!neighbors || neighbors.length === 0) continue;
        
        let nodeNeighbors = neighborMap.get(node);
        if (!nodeNeighbors) {
            nodeNeighbors = [];
            neighborMap.set(node, nodeNeighbors);
        }
        
        for (let j = 0; j < neighbors.length; j++) {
            const neighbor = neighbors[j];
            if (node === neighbor) continue;
            
            const edge: Edge = { from: node, to: neighbor, type: 'lowDim', status: 'connect' };
            edges[edgeIdx++] = edge;
            edgeMap.set(`${node}-${neighbor}`, edge);
            nodeNeighbors.push(neighbor);
        }
    }
    
    // Trim to actual size
    edges.length = edgeIdx;
    
    return { edges, neighborMap, edgeMap };
}

// Legacy function for backward compatibility
export function createEdges(
    currentSameType: number[][],
    currentCrossType: number[][],
    previousSameType: number[][],
    previousCrossType: number[][]
): Edge[] {
    return createEdgesWithMaps(currentSameType, currentCrossType).edges;
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

export function transferArray2Color(colorArray: [number, number, number] | undefined, alpha = 1): string {
    if (!colorArray) {
        return 'rgba(116, 116, 116,1)';
    }
    const [r, g, b] = colorArray;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}