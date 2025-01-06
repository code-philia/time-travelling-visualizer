import { BoundaryProps } from "../../state/types";
import { UmapProjectionResult } from "../../communication/api";

export const pointsDefaultSize = 20;

export interface CommonPointsGeography {
    positions: [number, number, number][];
    colors: [number, number, number][];
    sizes: number[];
    alphas: number[];
}

export function createEmptyCommonPointsGeography(): CommonPointsGeography {
    return {
        positions: [],
        colors: [],
        sizes: [],
        alphas: []
    };
}

export interface PointsNeighborRelationship {
    interNeighbors: number[][];
    intraNeighbors: number[][];
}

// TODO backend not providing color yet, do random generation
const seed = 12345;
function seededRandom(seed: number) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

export function randomColor(i: number): [number, number, number] {
    return [
        Math.floor(seededRandom(seed + i) * 256),
        Math.floor(seededRandom(seed + i + 1) * 256),
        Math.floor(seededRandom(seed + i + 2) * 256)
    ];
}

// TODO these functions should be put into utils
export function extractConnectedPoints(res: UmapProjectionResult): PointsNeighborRelationship {
    return { interNeighbors: res.inter_sim_top_k, intraNeighbors: res.intra_sim_top_k };
}

export function extractSpriteData(res: UmapProjectionResult): SpriteData {
    return {
        labels: res.tokens
    };
}

export function extractBoundary(res: UmapProjectionResult): BoundaryProps {
    return {
        xMin: res.bounding.x_min,
        yMin: res.bounding.y_min,
        xMax: res.bounding.x_max,
        yMax: res.bounding.y_max,
    };
}

export class HighlightContext {
    hoveredIndex: number | undefined = undefined;
    lockedIndices: Set<number> = new Set();

    highlightedPoints: number[] = [];
    plotPoints: CommonPointsGeography | undefined = undefined;

    private highlightChangedListeners: (() => void)[] = [];

    // Operations

    updateHovered(idx: number | undefined) {
        this.hoveredIndex = idx;
        this.notifyHighlightChanged();
    }

    addLocked(idx: number) {
        this.lockedIndices.add(idx);
        this.notifyHighlightChanged();
    }

    removeLocked(idx: number) {
        this.lockedIndices.delete(idx);
        this.notifyHighlightChanged();
    }

    switchLocked(idx: number) {
        if (this.lockedIndices.has(idx)) {
            this.lockedIndices.delete(idx);
        } else {
            this.lockedIndices.add(idx);
        }
        this.notifyHighlightChanged();
    }

    removeAllLocked() {
        this.lockedIndices.clear();
        this.notifyHighlightChanged();
    }

    // Computations

    checkLocked(idx: number) {
        return this.lockedIndices.has(idx);
    }

    computeHighlightedPoints() {
        const highlightedPoints = Array.from(this.lockedIndices);
        if (this.hoveredIndex !== undefined) {
            highlightedPoints.push(this.hoveredIndex);
        }
        return highlightedPoints;
    }

    doHighlight(originalPointsData: CommonPointsGeography, useCache = true): [boolean, CommonPointsGeography] {
        const highlightedPoints = this.computeHighlightedPoints();

        // NOTE don't do check here, do check later, or when the points geography is refreshed itself outside somewhere, this function will not update it
        // if (highlightedPoints.length === this.lastHighlightedPoints.length &&
        //     highlightedPoints.every((value, index) => value === this.lastHighlightedPoints[index]) && this.lastPlotPoints) {
        //     return [false, { ...this.lastPlotPoints }];
        // }

        if (useCache && highlightedPoints.length === this.highlightedPoints.length &&
            highlightedPoints.every((value, index) => value === this.highlightedPoints[index]) && this.plotPoints) {
            return [false, { ...this.plotPoints }];
        }

        const positions = originalPointsData.positions.slice();
        const colors = originalPointsData.colors.slice();
        const sizes = originalPointsData.sizes.slice();
        const alphas = originalPointsData.alphas.slice();

        if (highlightedPoints.length > 0) {
            alphas.forEach((_, i) => {
                alphas[i] = 0.2;
            });
            highlightedPoints.forEach((i) => {
                sizes[i] = pointsDefaultSize * 1.5;
                alphas[i] = 1.0;
            });
        }

        this.highlightedPoints = highlightedPoints;
        const nextPlotPoints = {
            positions, colors, sizes, alphas
        };

        // // do check here
        // if (this.lastPlotPoints && this.lastPlotPoints.positions.length === nextPlotPoints.positions.length &&
        //     this.lastPlotPoints.positions.every((value, index) => value === nextPlotPoints.positions[index]) &&
        //     this.lastPlotPoints.colors.every((value, index) => value === nextPlotPoints.colors[index]) &&
        //     this.lastPlotPoints.sizes.every((value, index) => value === nextPlotPoints.sizes[index]) &&
        //     this.lastPlotPoints.alphas.every((value, index) => value === nextPlotPoints.alphas[index])) {
        //     return [false, { ...this.lastPlotPoints }];
        // }

        this.plotPoints = nextPlotPoints;

        return [true, { ...this.plotPoints }];
    }

    tryUpdateHighlight(originalPointsData: CommonPointsGeography, useCache = false): CommonPointsGeography | undefined {
        const [changed, newPointsData] = this.doHighlight(originalPointsData, useCache);
        return changed ? newPointsData : undefined;
    }

    addHighlightChangedListener(listener: () => void) {
        this.highlightChangedListeners.push(listener);
    }

    removeHighlightChangedListener(listener: () => void) {
        this.highlightChangedListeners = this.highlightChangedListeners.filter((l) => l !== listener);
    }

    private notifyHighlightChanged() {
        this.highlightChangedListeners.forEach((listener) => listener());
    }
}
export type SpriteData = {
    labels: string[];
};

