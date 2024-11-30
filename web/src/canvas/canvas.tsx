import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber'

import { BoundaryProps } from '../state/types.ts';
import { fetchUmapProjectionData, UmapProjectionResult } from '../user/api'
import { useStore } from '../state/store';

import { PointsRender } from './points-render.tsx'
import { RawPointsData } from './points-render.tsx';
import { VisualizerRenderContext } from './visualizer-render-context.tsx';
import { VisualierDefaultControl } from './visualizer-default-control.tsx';
import { VisualizerDefaultCamera } from './camera.tsx';
import { SpriteData, SpriteRender } from './sprite-render.tsx';

const pointsDefaultScaleFactor = 20;

function extractRawPointsData(res: UmapProjectionResult): RawPointsData {
    const tempColorForLabels = [[21, 171, 250], [252, 144, 5]];
    const labelsAsNumber = res.labels.map((label) => parseInt(label));

    const positions: [number, number, number][] = [];
    const colors: [number, number, number][] = [];
    const sizes: number[] = [];
    const alphas: number[] = [];
    res.proj.forEach((point, i) => {
        positions.push([point[0], point[1], 0]);
        const color = tempColorForLabels[labelsAsNumber[i]];
        colors.push([color[0] / 255, color[1] / 255, color[2] / 255]);
        sizes.push(pointsDefaultScaleFactor);
        alphas.push(1.0);
    });

    const data = {
        positions, colors, sizes, alphas
    };
    return data;
}

function extractSpriteData(res: UmapProjectionResult): SpriteData {
    return {
        labels: res.tokens
    };
}

function extractBoundary(res: UmapProjectionResult): BoundaryProps {
    return {
        x1: res.bounding.x_min,
        y1: res.bounding.y_min,
        x2: res.bounding.x_max,
        y2: res.bounding.y_max,
    };
}

class HighlightContext {
    hoveredIndex: number | undefined = undefined;
    lockedIndices: Set<number> = new Set();

    lastHighlightedPoints: number[] = [];
    lastPlotPoints: RawPointsData | undefined = undefined;

    updateHovered(idx: number | undefined) {
        this.hoveredIndex = idx;
    }

    addLocked(idx: number) {
        this.lockedIndices.add(idx);
    }

    removeLocked(idx: number) {
        this.lockedIndices.delete(idx);
    }

    removeAllLocked() {
        this.lockedIndices.clear();
    }
    
    computeHighlightedPoints() {
        const highlightedPoints = Array.from(this.lockedIndices);
        if (this.hoveredIndex !== undefined) {
            highlightedPoints.push(this.hoveredIndex);
        }
        return highlightedPoints;
    }

    doHighlight(originalPointsData: RawPointsData): [boolean, RawPointsData] {
        const highlightedPoints = this.computeHighlightedPoints();

        if (highlightedPoints.length === this.lastHighlightedPoints.length &&
            highlightedPoints.every((value, index) => value === this.lastHighlightedPoints[index]) && this.lastPlotPoints) {
            return [false, this.lastPlotPoints];
        }
    
        const positions = originalPointsData.positions.slice();
        const colors = originalPointsData.colors.slice();
        const sizes = originalPointsData.sizes.slice();
        const alphas = originalPointsData.alphas.slice();
        highlightedPoints.forEach((i) => {
            sizes[i] = pointsDefaultScaleFactor * 2;
        });
    
        this.lastHighlightedPoints = highlightedPoints;
        this.lastPlotPoints = {
            positions, colors, sizes, alphas
        };
    
        return [true, this.lastPlotPoints];
    }

    tryUpdateHighlight(originalPointsData: RawPointsData): RawPointsData | undefined {
        const [changed, newPointsData] = this.doHighlight(originalPointsData);
        return changed ? newPointsData : undefined;
    }
}

class EventDispatcher {
    callback?: () => void;
    dispatch: () => void = this._dispatch.bind(this);

    private _dispatch() {
        this.callback?.();        
    }
}

export function CanvasContainer({ visible }: { visible: boolean }) {
    const { command, contentPath, visMethod, taskType, iteration, filterIndex, updateUUID } = useStore(["command", "contentPath", "visMethod", "taskType", "iteration", "filterIndex", "updateUUID"]);
    const [rawPointsData, setRawPointsData] = useState<RawPointsData | null>(null);
    const [pointsData, setPointsData] = useState<RawPointsData | null>(null);
    const [spriteData, setSpriteData] = useState<SpriteData | null>(null);
    const [rc, SetRc] = useState<VisualizerRenderContext | null>(null);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const spriteRenderRef = useRef<{ repaint: () => void }>(null);
    const highlightContext = useRef(new HighlightContext());
    const viewUpdateEvent = useRef(new EventDispatcher());

    // Triggering use an ID, is obsolete, cause this way will lead to a lagging in sprites update (when moving the camera)
    // const [resizeTrigger, setResizeTrigger] = useState<string>(new Date().toISOString());

    // one-time after mounted
    useEffect(() => {
        viewUpdateEvent.current.callback = () => {
            spriteRenderRef.current?.repaint();
        };
    }, [])

    // every time after mounted
    useEffect(() => {
        if (command != 'update' || !visible) return;
        (async () => {
            const res = await fetchUmapProjectionData(contentPath, iteration);
            if (res !== undefined && canvasRef.current) {
                SetRc(new VisualizerRenderContext(extractBoundary(res), 'white', canvasRef.current));
                
                const rawPointsData = extractRawPointsData(res);
                setRawPointsData(rawPointsData);
                setPointsData(rawPointsData);

                const spriteData = extractSpriteData(res);
                setSpriteData(spriteData);
            }
        })();
    }, [contentPath, visMethod, taskType, iteration, filterIndex, command, visible, updateUUID]);

    // TODO add test for resting the camera
    // const testReset = () => {
    //     setBoundary({ x1: -100, y1: -200, x2: 150, y2: 150 });
    // };

    const onHoverPoint = (idx: number | undefined) => {
        if (rawPointsData === null) return;
        
        highlightContext.current.updateHovered(idx);
        const displayedPoints = highlightContext.current.tryUpdateHighlight(rawPointsData);
        if (displayedPoints) setPointsData(displayedPoints);
    }
    
    const onClickPoint = (idx: number) => {
        if (rawPointsData === null) return;

        if (highlightContext.current.lockedIndices.has(idx)) {
            highlightContext.current.removeLocked(idx);
        } else {
            highlightContext.current.addLocked(idx);
        }

        const displayedPoints = highlightContext.current.tryUpdateHighlight(rawPointsData);     // TODO can this be moved into the HighlightContext?
        if (displayedPoints) setPointsData(displayedPoints);
    }

    // CSS of canvas-container must not contain "margin", or the <Canvas/> rendering will lead to a bug due to r3f (react-three-fiber)
    return (
        <div id="canvas-container"
            style={{
                display: visible ? 'block' : 'none',
                width: '100%',
                height: '100%'
            }}>
            <Canvas ref={canvasRef} frameloop={'demand'} resize={{ debounce: 0 }} linear flat>
                <ambientLight color={0xffffff} intensity={2.0} />       {/* set to Math.PI and set <Canvas linear flat/> to render all-white texture */}
                {rc !== null && pointsData !== null && <PointsRender rawPointsData={pointsData} visualizerRenderContext={rc} eventListeners={{ onHoverPoint, onClickPoint }} />}
                {/* <axesHelper args={[100]} /> */}
                {rc !== null &&
                    (<>
                        <VisualizerDefaultCamera visualizerRenderContext={rc} />
                        <VisualierDefaultControl visualizerRenderContext={rc} onResize={viewUpdateEvent.current.dispatch} />
                    </>)
                }
            </Canvas>
            {rc !== null && pointsData !== null && spriteData !== null && <SpriteRender ref={spriteRenderRef} rawPointsData={pointsData} spriteData={spriteData} visualizerRenderContext={rc} />}
        </div>
    )
}
