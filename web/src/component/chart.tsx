// ChartComponent.tsx
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { EmbeddingView, type EmbeddingViewProps } from 'embedding-atlas/react';
import { useDefaultStore } from "../state/state.unified";
import { transferArray2Color } from './utils';

type EmbeddingData = NonNullable<EmbeddingViewProps['data']>;

type PreparedEmbedding = {
    data: EmbeddingData;
    categoryColors: string[] | null;
};

export const ChartComponent = memo(() => {
    const atlasRef = useRef<HTMLDivElement | null>(null);
    const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

    const { epoch, allEpochData } = useDefaultStore(["epoch", "allEpochData"]);
    const { inherentLabelData, colorDict } = useDefaultStore(["inherentLabelData", "colorDict"]);
    const { shownData, index, isFocusMode, focusIndices } = useDefaultStore(["shownData", "index", "isFocusMode", "focusIndices"]);

    const epochData = allEpochData[epoch];

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

    const prepared = useMemo<PreparedEmbedding | null>(() => {
        if (!epochData || filteredIndices.length === 0) {
            return null;
        }

        const x = new Float32Array(filteredIndices.length);
        const y = new Float32Array(filteredIndices.length);
        const category = new Uint8Array(filteredIndices.length);
        const categoryColorList: string[] = [];
        const labelToCategoryIndex = new Map<number, number>();

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
        });

        const data = {
            x,
            y,
            category: categoryColorList.length > 0 ? category : undefined,
        } as unknown as EmbeddingData;

        return {
            data,
            categoryColors: categoryColorList.length > 0 ? categoryColorList : null,
        };
    }, [colorDict, epochData, filteredIndices, inherentLabelData]);

    const content = prepared ? (
        <EmbeddingView
            data={prepared.data}
            categoryColors={prepared.categoryColors}
            width={dimensions.width || undefined}
            height={dimensions.height || undefined}
            config={{ mode: 'points', colorScheme: 'light' }}
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
