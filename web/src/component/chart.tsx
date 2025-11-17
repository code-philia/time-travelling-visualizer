// ChartComponent.tsx
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { EmbeddingView, type EmbeddingViewProps, type DataPoint, type ViewportState } from 'embedding-atlas/react';
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

    const { setHoveredIndex } = useDefaultStore(["setHoveredIndex"]);
    const { mode } = useDefaultStore(["mode"]);
    const { pointSize } = useDefaultStore(["pointSize"]);
    const { revealOriginalNeighbors, revealProjectionNeighbors } = useDefaultStore(["revealOriginalNeighbors", "revealProjectionNeighbors"]);

    const epochData = allEpochData[epoch];

    // plot view helpers
    let [tooltip, setTooltip] = useState<DataPoint | null>(null);
    // selection can be added later when needed
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

    const posMap = useMemo(() => {
        const m = new Map<number, number>();
        if (prepared) {
            prepared.dataPoints.forEach((p, i) => {
                m.set(p.identifier as number, i);
            });
        }
        return m;
    }, [prepared]);

    const neighborOverlayProps = useMemo(() => {
        if (!prepared || !epochData) return { center: null, original: [], projection: [], dataX: new Float32Array(0), dataY: new Float32Array(0), pointSize, revealOriginalNeighbors, revealProjectionNeighbors } as any;
        if (!tooltip) return { center: null, original: [], projection: [], dataX: prepared.simpleData.x as Float32Array, dataY: prepared.simpleData.y as Float32Array, pointSize, revealOriginalNeighbors, revealProjectionNeighbors } as any;
        const hoverId = tooltip.identifier as number;
        const orig = (epochData.originalNeighbors?.[hoverId] ?? []).filter((nid) => posMap.has(nid));
        const proj = (epochData.projectionNeighbors?.[hoverId] ?? []).filter((nid) => posMap.has(nid));
        return {
            center: tooltip,
            original: orig,
            projection: proj,
            dataX: prepared.simpleData.x as Float32Array,
            dataY: prepared.simpleData.y as Float32Array,
            pointSize,
            revealOriginalNeighbors,
            revealProjectionNeighbors,
        };
    }, [prepared, epochData, tooltip, posMap, pointSize, revealOriginalNeighbors, revealProjectionNeighbors]);

    class NeighborOverlay {
        private el: HTMLDivElement | null = null;
        private svg: SVGSVGElement | null = null;
        private props: any;
        private proxy: any;
        constructor(target: HTMLDivElement, props: any) {
            this.el = target;
            this.props = props;
            this.proxy = props.proxy;
            this.mount();
        }
        mount() {
            if (!this.el) return;
            this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this.svg.setAttribute('width', String(this.proxy.width));
            this.svg.setAttribute('height', String(this.proxy.height));
            this.el.appendChild(this.svg);
            this.render();
        }
        clear() {
            if (this.svg) {
                while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
            }
        }
        render() {
            if (!this.svg) return;
            this.clear();
            const { center, original, projection, dataX, dataY, pointSize, revealOriginalNeighbors, revealProjectionNeighbors } = this.props;
            if (!center) return;
            const centerLoc = this.proxy.location(center.x, center.y);
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            const drawNeighbor = (nid: number, color: string) => {
                const pos = this.props.posMap.get(nid);
                if (pos == null) return;
                const x = dataX[pos];
                const y = dataY[pos];
                const loc = this.proxy.location(x, y);
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', String(centerLoc.x));
                line.setAttribute('y1', String(centerLoc.y));
                line.setAttribute('x2', String(loc.x));
                line.setAttribute('y2', String(loc.y));
                line.setAttribute('stroke', color);
                line.setAttribute('stroke-width', '1.5');
                line.setAttribute('stroke-linecap', 'round');
                group.appendChild(line);
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', String(loc.x));
                circle.setAttribute('cy', String(loc.y));
                circle.setAttribute('r', String(pointSize + 1.5));
                circle.setAttribute('fill', 'none');
                circle.setAttribute('stroke', color);
                circle.setAttribute('stroke-width', '2');
                group.appendChild(circle);
            };
            const COLOR_ORIG = '#E74C3C';
            const COLOR_PROJ = '#2E86DE';
            if (revealOriginalNeighbors) {
                original.forEach((nid: number) => drawNeighbor(nid, COLOR_ORIG));
            }
            if (revealProjectionNeighbors) {
                projection.forEach((nid: number) => drawNeighbor(nid, COLOR_PROJ));
            }
            this.svg.appendChild(group);
            const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            centerCircle.setAttribute('cx', String(centerLoc.x));
            centerCircle.setAttribute('cy', String(centerLoc.y));
            centerCircle.setAttribute('r', String(pointSize + 2));
            centerCircle.setAttribute('fill', 'none');
            centerCircle.setAttribute('stroke', '#666');
            centerCircle.setAttribute('stroke-width', '2');
            this.svg.appendChild(centerCircle);
        }
        update(nextProps: Partial<any>) {
            this.props = { ...this.props, ...nextProps };
            if (this.svg) {
                this.svg.setAttribute('width', String(this.props.proxy.width));
                this.svg.setAttribute('height', String(this.props.proxy.height));
            }
            this.render();
        }
        destroy() {
            if (this.svg && this.el) {
                this.el.removeChild(this.svg);
            }
            this.svg = null;
            this.el = null;
        }
    }

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
            config={{ mode: mode, colorScheme: 'light', pointSize: pointSize }}
            tooltip={tooltip}
            onTooltip={(v) => {
                setHoveredIndex(v ? v.identifier as number : undefined);
                setTooltip(v);
            }}
            viewportState={viewportState}
            querySelection={ querySelection }
            customOverlay={{
                class: NeighborOverlay as any,
                props: { ...neighborOverlayProps, posMap }
            }}
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
