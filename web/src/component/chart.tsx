// ChartComponent.tsx
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { EmbeddingView, type EmbeddingViewProps, type DataPoint, type Rectangle, type ViewportState } from 'embedding-atlas/react';
import { useDefaultStore } from "../state/state.unified";
import { transferArray2Color } from './utils';

type EmbeddingData = NonNullable<EmbeddingViewProps['data']>;

type PreparedEmbedding = {
    simpleData: EmbeddingData;
    dataPoints: DataPoint[];
    categoryColors: string[] | null;
};

export const ChartComponent = memo(() => {
    const atlasRef = useRef<HTMLDivElement | null>(null);
    const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

    const { epoch, allEpochData, globalBounds } = useDefaultStore(["epoch", "allEpochData","globalBounds"]);
    const { inherentLabelData, colorDict } = useDefaultStore(["inherentLabelData", "colorDict"]);
    const { shownData, index, isFocusMode, focusIndices } = useDefaultStore(["shownData", "index", "isFocusMode", "focusIndices"]);

    const { hoveredIndex, setHoveredIndex } = useDefaultStore(["hoveredIndex", "setHoveredIndex"]);

    const epochData = allEpochData[epoch];

    // plot view helpers
    let [tooltip, setTooltip] = useState<DataPoint | null>(null);
    let [selection, setSelection] = useState<DataPoint[] | null>([]);
    let [viewportState, setViewportState] = useState<ViewportState | null>(null);

    // observe container size change
    useEffect(() => {
        const node = atlasRef.current;
        if (!node) {
            return;
        }

        const observer = new ResizeObserver(([entry]) => {
            if (!entry) {
                return;
            }
            const { width, height } = entry.contentRect;
            setDimensions((prev) => (
                prev.width === width && prev.height === height
                    ? prev
                    : { width, height }
            ));
        });

        observer.observe(node);

        return () => {
            observer.disconnect();
        };
    }, []);

    // set viewport based on global bounds
    useEffect(() => {
        if (!globalBounds) return;

        const { minX, maxX, minY, maxY } = globalBounds;

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const rangeX = maxX - minX;
        const rangeY = maxY - minY;

        const safeRangeX = rangeX === 0 ? 1 : rangeX;
        const safeRangeY = rangeY === 0 ? 1 : rangeY;

        const padding = 1.5;

        const scaleX = 2 / (safeRangeX * padding);
        const scaleY = 2 / (safeRangeY * padding);

        const scale = Math.min(scaleX, scaleY);

        setViewportState({
            x: centerX,
            y: centerY,
            scale,
        });

    }, [globalBounds]);


    // filter dataIndices
    const filteredIndices = useMemo(() => {
        if (!epochData) {
            return [] as number[];
        }
        const totalIndices = epochData.projection.map((_, idx) => idx);
        let current = totalIndices;

        if (shownData.length > 0) {
            const shownIndexSet = new Set<number>();
            shownData.forEach((key) => {
                const group = index[key];
                if (Array.isArray(group)) {
                    group.forEach((value) => shownIndexSet.add(value));
                }
            });
            if (shownIndexSet.size > 0) {
                current = current.filter((value) => shownIndexSet.has(value));
            }
        }

        if (isFocusMode && focusIndices.length > 0) {
            const focusSet = new Set<number>(focusIndices);
            current = current.filter((value) => focusSet.has(value));
        }

        return current;
    }, [epochData, focusIndices, index, isFocusMode, shownData]);

    // convert data for embedding view
    const prepared = useMemo<PreparedEmbedding | null>(() => {
        if (!epochData || filteredIndices.length === 0) {
            return null;
        }

        const x = new Float32Array(filteredIndices.length);
        const y = new Float32Array(filteredIndices.length);
        const category = new Uint8Array(filteredIndices.length);
        const categoryColorList: string[] = [];
        const labelToCategoryIndex = new Map<number, number>();

        let dataPoints : DataPoint[] = []

        filteredIndices.forEach((originalIndex, position) => {
            const [px, py] = epochData.projection[originalIndex] ?? [0, 0];
            x[position] = px;
            y[position] = py;

            const label = inherentLabelData[originalIndex] ?? 0;
            const colorTuple = colorDict.get(label);
            let categoryIndex = labelToCategoryIndex.get(label);
            if (categoryIndex === undefined) {
                categoryIndex = categoryColorList.length;
                labelToCategoryIndex.set(label, categoryIndex);
                const colorString = transferArray2Color(colorTuple, 1);
                categoryColorList.push(colorString);
            }
            category[position] = categoryIndex;

            dataPoints.push({
                x: px,
                y: py,
                category: label,
                text: `Index: ${originalIndex}\nLabel: ${label}`,
                identifier: originalIndex,
                fields: {} // add more fields if needed
            })
        });

        const simpleData = {
            x,
            y,
            category: categoryColorList.length > 0 ? category : undefined,
        } as unknown as EmbeddingData;

        return {
            simpleData,
            dataPoints,
            categoryColors: categoryColorList.length > 0 ? categoryColorList : null,
        };
    }, [colorDict, epochData, filteredIndices, inherentLabelData]);

    // find selected datapoint
    async function querySelection(x: number, y: number, unitDistance: number): Promise<DataPoint | null> {
        if (!prepared) {
            return null;
        }
        let simpleData = prepared.simpleData;
        let minDistance2: number | null = null;
        let minIndex: number | null = null;
        for (let i = 0; i < simpleData.x.length; i++) {
        let d2 = (simpleData.x[i] - x) * (simpleData.x[i] - x) + (simpleData.y[i] - y) * (simpleData.y[i] - y);
        if (minDistance2 == null || d2 < minDistance2) {
            minDistance2 = d2;
            minIndex = i;
        }
        }
        if (minIndex == null || minDistance2 == null || Math.sqrt(minDistance2) > unitDistance * 10) {
            return null;
        }
        return prepared.dataPoints[minIndex];
    }

    const content = prepared ? (
        <EmbeddingView
            data={prepared.simpleData}
            categoryColors={prepared.categoryColors}
            width={dimensions.width || undefined}
            height={dimensions.height || undefined}
            config={{ mode: 'points', colorScheme: 'light', pointSize: 2 }}
            tooltip={tooltip}
            onTooltip={(v) => {
                setHoveredIndex(v ? v.identifier as number : undefined);
                setTooltip(v);
            }}
            viewportState={viewportState}
            querySelection={ querySelection }
        />
    ) : null;

    return (
        <div
            ref={atlasRef}
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
            }}
        >
            <div style={{ position: 'relative', flex: 1 }}>
                {content ?? <div style={{ width: '100%', height: '100%' }} />}
            </div>
        </div>
    );
});

export default ChartComponent;
