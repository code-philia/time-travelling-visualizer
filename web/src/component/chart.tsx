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

    const { epoch, allEpochData, globalBounds } = useDefaultStore(["epoch", "allEpochData","globalBounds"]) as any;
    const { inherentLabelData, colorDict, labelDict, textData } = useDefaultStore(["inherentLabelData", "colorDict", "labelDict", "textData"]) as any;
    const { shownData, index, isFocusMode, focusIndices } = useDefaultStore(["shownData", "index", "isFocusMode", "focusIndices"]) as any;

    const { setHoveredIndex } = useDefaultStore(["setHoveredIndex"]) as any;
    const { mode } = useDefaultStore(["mode"]) as any;
    const { pointSize } = useDefaultStore(["pointSize"]) as any;
    const { revealOriginalNeighbors, revealProjectionNeighbors } = useDefaultStore(["revealOriginalNeighbors", "revealProjectionNeighbors"]) as any;
    const { showLabel, showIndex } = useDefaultStore(["showLabel", "showIndex"]) as any;
    const { selectedIndices } = useDefaultStore(["selectedIndices"]) as any;
    const { availableEpochs } = useDefaultStore(["availableEpochs"]) as any;
    const { showTrail } = useDefaultStore(["showTrail"]) as any;
    const { setSelectedIndices } = useDefaultStore(["setSelectedIndices"]) as any;

    const epochData = allEpochData[epoch];

    // plot view helpers
    let [tooltip, setTooltip] = useState<DataPoint | null>(null);
    let [viewportState, setViewportState] = useState<ViewportState | null>(null);

    // observe container size change
    useEffect(() => {
        const node = atlasRef.current;
        if (!node) return;
        const observer = new ResizeObserver(([entry]) => {
            if (!entry) return;
            const { width, height } = entry.contentRect;
            setDimensions((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
        });
        observer.observe(node);
        return () => observer.disconnect();
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
        setViewportState({ x: centerX, y: centerY, scale });
    }, [globalBounds]);


    // filter dataIndices
    const filteredIndices = useMemo(() => {
        if (!epochData) return [] as number[];
        const totalIndices = epochData.projection.map((_: any, idx: number) => idx);
        let current = totalIndices;

        if (shownData.length > 0) {
            const shownIndexSet = new Set<number>();
            shownData.forEach((key: any) => {
                const group = index[key];
                if (Array.isArray(group)) {
                    group.forEach((value: number) => shownIndexSet.add(value));
                }
            });
            if (shownIndexSet.size > 0) {
                current = current.filter((value: number) => shownIndexSet.has(value));
            }
        }

        if (isFocusMode && focusIndices.length > 0) {
            const focusSet = new Set<number>(focusIndices);
            current = current.filter((value: number) => focusSet.has(value));
        }
        return current;
    }, [epochData, focusIndices, index, isFocusMode, shownData]);

    // convert data for embedding view
    const prepared = useMemo<PreparedEmbedding | null>(() => {
        if (!epochData || filteredIndices.length === 0) return null;
        const x = new Float32Array(filteredIndices.length);
        const y = new Float32Array(filteredIndices.length);
        const category = new Uint8Array(filteredIndices.length);
        const categoryColorList: string[] = [];
        const labelToCategoryIndex = new Map<number, number>();
        let dataPoints : DataPoint[] = []

        filteredIndices.forEach((originalIndex: number, position: number) => {
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
                fields: {} 
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

    // [Task 1 Fix] Calculate current selection for the EmbeddingView (Sync State -> Canvas)
    const currentSelection = useMemo(() => {
        if (!prepared || !selectedIndices) return [];
        return selectedIndices
            .map((id: number) => {
                const idx = posMap.get(id);
                return idx !== undefined ? prepared.dataPoints[idx] : null;
            })
            .filter((p: any) => p !== null) as DataPoint[];
    }, [prepared, selectedIndices, posMap]);


    const [trailRefresh, setTrailRefresh] = useState(0);
    useEffect(() => { setTrailRefresh((v) => v + 1); }, [selectedIndices]);

    const neighborOverlayProps = useMemo(() => {
        if (!prepared || !epochData) return { center: null, original: [], projection: [], dataX: new Float32Array(0), dataY: new Float32Array(0), pointSize, revealOriginalNeighbors, revealProjectionNeighbors } as any;
        const idsByPos = prepared.dataPoints.map((p) => p.identifier as number);
        if (!tooltip) return { center: null, original: [], projection: [], dataX: prepared.simpleData.x as Float32Array, dataY: prepared.simpleData.y as Float32Array, pointSize, revealOriginalNeighbors, revealProjectionNeighbors, idsByPos, showLabel, showIndex, labelDict, textData, inherentLabelData, viewportState, showTrail, availableEpochs, allEpochData, currentEpoch: epoch, setSelectedIndices, selectedIndices } as any;
        const hoverId = tooltip.identifier as number;
        const orig = (epochData.originalNeighbors?.[hoverId] ?? []).filter((nid: any) => posMap.has(nid));
        const proj = (epochData.projectionNeighbors?.[hoverId] ?? []).filter((nid: any) => posMap.has(nid));
        return {
            center: tooltip,
            original: orig,
            projection: proj,
            dataX: prepared.simpleData.x as Float32Array,
            dataY: prepared.simpleData.y as Float32Array,
            pointSize,
            revealOriginalNeighbors,
            revealProjectionNeighbors,
            idsByPos,
            showLabel,
            showIndex,
            labelDict,
            textData,
            inherentLabelData,
            viewportState,
            showTrail,
            availableEpochs,
            allEpochData,
            currentEpoch: epoch,
            setSelectedIndices,
            selectedIndices,
        };
    }, [prepared, epochData, tooltip, posMap, pointSize, revealOriginalNeighbors, revealProjectionNeighbors, showLabel, showIndex, labelDict, textData, inherentLabelData, viewportState, showTrail, availableEpochs, allEpochData, epoch, trailRefresh, selectedIndices]);

    class NeighborOverlay {
        private el: HTMLDivElement | null = null;
        private svg: SVGSVGElement | null = null;
        private props: any;
        private proxy: any;
        private handleClickBound: any;
        private defs: SVGDefsElement | null = null;
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
            this.svg.addEventListener('click', this.handleClickBound);
            this.defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', 'trail-arrow');
            marker.setAttribute('viewBox', '0 0 10 10');
            marker.setAttribute('markerUnits', 'userSpaceOnUse');
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '10');
            marker.setAttribute('refX', '8');
            marker.setAttribute('refY', '5');
            marker.setAttribute('orient', 'auto');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M0,0 L10,5 L0,10 Z');
            path.setAttribute('fill', '#7F8C8D');
            marker.appendChild(path);
            this.defs.appendChild(marker);
            this.svg.appendChild(this.defs);
            this.render();
        }
        clear() {
            if (this.svg) {
                const children = Array.from(this.svg.childNodes);
                for (const child of children) {
                    if ((child as Element).nodeName.toLowerCase() !== 'defs') {
                        this.svg.removeChild(child);
                    }
                }
            }
        }
        render() {
            if (!this.svg) return;
            this.clear();
            const { center, original, projection, dataX, dataY, pointSize, revealOriginalNeighbors, revealProjectionNeighbors, selectedIndices, showTrail } = this.props;
            const centerLoc = center ? this.proxy.location(center.x, center.y) : null;
            const neighborGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
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
                neighborGroup.appendChild(line);
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', String(loc.x));
                circle.setAttribute('cy', String(loc.y));
                circle.setAttribute('r', String(pointSize + 1.5));
                circle.setAttribute('fill', 'none');
                circle.setAttribute('stroke', color);
                circle.setAttribute('stroke-width', '2');
                neighborGroup.appendChild(circle);
            };
            const COLOR_ORIG = '#E74C3C';
            const COLOR_PROJ = '#2E86DE';
            
            // Draw hover connections
            if (centerLoc) {
                if (revealOriginalNeighbors) {
                    original.forEach((nid: number) => drawNeighbor(nid, COLOR_ORIG));
                }
                if (revealProjectionNeighbors) {
                    projection.forEach((nid: number) => drawNeighbor(nid, COLOR_PROJ));
                }
                this.svg.appendChild(neighborGroup);
                const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                centerCircle.setAttribute('cx', String(centerLoc.x));
                centerCircle.setAttribute('cy', String(centerLoc.y));
                centerCircle.setAttribute('r', String(pointSize + 2));
                centerCircle.setAttribute('fill', 'none');
                centerCircle.setAttribute('stroke', '#666');
                centerCircle.setAttribute('stroke-width', '2');
                this.svg.appendChild(centerCircle);
            } else {
                this.svg.appendChild(neighborGroup);
            }

            // [Task 2 Fix] Render motion trails for ALL selected points
            // HELPER: Strict check for invalid points to avoid "falling lines"
            const isValidPoint = (coord: any) => {
                if (!coord || coord.length < 2) return false;
                if (!Number.isFinite(coord[0]) || !Number.isFinite(coord[1])) return false;
                // Strict zero check (e.g. 0.000000)
                if (Math.abs(coord[0]) < 0.00001 && Math.abs(coord[1]) < 0.00001) return false;
                return true;
            };

            if (showTrail) {
                const trailGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                const epochs = this.props.availableEpochs || [];
                
                // Show FULL trajectory (all available epochs)
                const maxIdx = epochs.length - 1;
                
                const pointsToTrace = new Set<number>();
                if (selectedIndices && Array.isArray(selectedIndices)) {
                    selectedIndices.forEach((id: number) => pointsToTrace.add(id));
                }
                if (this.props.center) {
                    pointsToTrace.add(this.props.center.identifier);
                }

                pointsToTrace.forEach(centerId => {
                    const points: { x: number; y: number }[] = [];
                    // Iterate through ALL epochs
                    for (let i = 0; i <= maxIdx; i++) {
                        const ep = epochs[i];
                        const epData = this.props.allEpochData?.[ep];
                        const coord = epData?.projection?.[centerId];
                        
                        // Use strict validator
                        if (!isValidPoint(coord)) continue;

                        const locp = this.proxy.location(coord[0], coord[1]);
                        points.push({ x: locp.x, y: locp.y });
                    }
                    
                    if (points.length < 1) return;

                    // Draw dots along the trail
                    for (let i = 0; i < points.length; i++) {
                        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                        c.setAttribute('cx', String(points[i].x));
                        c.setAttribute('cy', String(points[i].y));
                        c.setAttribute('r', String(Math.max(3, pointSize + 1)));
                        c.setAttribute('fill', '#7F8C8D');
                        c.setAttribute('fill-opacity', '0.85');
                        c.setAttribute('stroke', '#7F8C8D');
                        c.setAttribute('stroke-width', '0.5');
                        trailGroup.appendChild(c);
                    }
                    // Draw lines between dots
                    for (let i = 1; i < points.length; i++) {
                        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        l.setAttribute('x1', String(points[i - 1].x));
                        l.setAttribute('y1', String(points[i - 1].y));
                        l.setAttribute('x2', String(points[i].x));
                        l.setAttribute('y2', String(points[i].y));
                        l.setAttribute('stroke', '#7F8C8D');
                        l.setAttribute('stroke-width', '2');
                        l.setAttribute('stroke-dasharray', '6 3');
                        l.setAttribute('stroke-linecap', 'round');
                        l.setAttribute('stroke-opacity', '0.9');
                        l.setAttribute('marker-end', 'url(#trail-arrow)');
                        trailGroup.appendChild(l);
                    }
                });
                
                this.svg.appendChild(trailGroup);
            }

            // Draw Labels
            if (this.props.showLabel || this.props.showIndex) {
                const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                const occupiedBoxes: { x: number, y: number, width: number, height: number }[] = [];
                const padding = 2; 
                const charWidth = 6; 
                const charHeight = 10; 

                for (let i = 0; i < this.props.dataX.length; i++) {
                    const id = this.props.idsByPos[i];
                    const x = this.props.dataX[i];
                    const y = this.props.dataY[i];
                    const loc = this.proxy.location(x, y);
                    const labelTextData = this.props.textData && this.props.textData[id] ? this.props.textData[id] : (this.props.labelDict?.get(this.props.inherentLabelData[id]) ?? '');
                    let content = '';
                    if (this.props.showLabel && this.props.showIndex) {
                        content = `${id}.${labelTextData}`;
                    } else if (this.props.showLabel) {
                        content = labelTextData;
                    } else if (this.props.showIndex) {
                        content = String(id);
                    }
                    if (!content) continue;

                    const labelX = loc.x + (pointSize + 2);
                    const labelY = loc.y - (pointSize + 2); 
                    
                    const boxX = labelX;
                    const boxY = labelY - charHeight; 
                    const boxWidth = content.length * charWidth;
                    const boxHeight = charHeight;

                    let collision = false;
                    for (const box of occupiedBoxes) {
                        if (
                            boxX < box.x + box.width + padding &&
                            boxX + boxWidth + padding > box.x &&
                            boxY < box.y + box.height + padding &&
                            boxY + boxHeight + padding > box.y
                        ) {
                            collision = true;
                            break;
                        }
                    }

                    if (!collision) {
                        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                        textEl.setAttribute('x', String(labelX));
                        textEl.setAttribute('y', String(labelY));
                        textEl.setAttribute('fill', '#000');
                        textEl.setAttribute('font-size', '10');
                        textEl.setAttribute('font-family', 'Console, monospace');
                        textEl.textContent = content;
                        textGroup.appendChild(textEl);
                        occupiedBoxes.push({ x: boxX, y: boxY, width: boxWidth, height: boxHeight });
                    }
                }
                this.svg.appendChild(textGroup);
            }
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
            if (this.svg) {
                this.svg.removeEventListener('click', this.handleClickBound);
            }
            this.defs = null;
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
            onViewportState={(v) => setViewportState(v)}
            querySelection={ querySelection }
            
            // [Task 1 Fix] Pass current selection to canvas so it highlights (Canvas <-> Panel Sync)
            selection={currentSelection}
            
            // [Task 1 Fix] Handle user clicking/selecting items on canvas (Canvas -> Panel Sync)
            onSelection={(v) => {
                if (Array.isArray(v)) {
                   // Map DataPoints back to indices
                   setSelectedIndices(v.map(p => p.identifier as number));
                } else {
                   // Handle deselection (v can be null or empty)
                   setSelectedIndices([]);
                }
            }}
            
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