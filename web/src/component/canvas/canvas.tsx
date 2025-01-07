import { memo, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber'

import { BoundaryProps } from '../../state/types.ts';

import { PointsRender } from './points-render.tsx'
import { CommonPointsGeography, PointsNeighborRelationship } from './types.ts';
import { VisualizerRenderContext } from './visualizer-render-context.tsx';
import { VisualizerDefaultControl } from './visualizer-default-control.tsx';
import { VisualizerDefaultCamera } from './camera.tsx';
import { SpriteRender } from './sprite-render.tsx';
import { SpriteData } from './types.ts';

class EventDispatcher {
    callback?: () => void;
    dispatch: () => void = this._dispatch.bind(this);

    private _dispatch() {
        this.callback?.();
    }
}

// class CommonDataContext {

// }

export class Plot2DDataContext {
    plotType = "plot2d" as const;
    geo?: CommonPointsGeography;
    sprite?: SpriteData;

    constructor(geo?: CommonPointsGeography, sprite?: SpriteData) {
        this.geo = geo;
        this.sprite = sprite;
    }
}

export class Plot2DCanvasContext {
    boundary?: BoundaryProps;
}

export function createPlot2DCanvasContextFrom(geo?: CommonPointsGeography): Plot2DCanvasContext {
    const ctx: Plot2DCanvasContext = {};

    if (geo) {
        const xArr = geo.positions.map(p => p[0]);
        const yArr = geo.positions.map(p => p[1]);
        ctx.boundary = {
            xMin: Math.min(...xArr),
            yMin: Math.min(...yArr),
            xMax: Math.max(...xArr),
            yMax: Math.max(...yArr),
        };
    }

    return ctx;
}

export function isEqPlot2DCanvasContext(ctx1: Plot2DCanvasContext, ctx2: Plot2DCanvasContext): boolean {
    if (ctx1.boundary === undefined && ctx2.boundary === undefined) return true;
    if (ctx1.boundary === undefined || ctx2.boundary === undefined) return false;

    return ctx1.boundary.xMin === ctx2.boundary.xMin
        && ctx1.boundary.yMin === ctx2.boundary.yMin
        && ctx1.boundary.xMax === ctx2.boundary.xMax
        && ctx1.boundary.yMax === ctx2.boundary.yMax;
}

interface CanvasEventListeners {
    onHoverPoint?: (idx: number | undefined) => void;
    onClickPoint?: (idx: number) => void;
}

export const PlotContainer = memo(({ plotDataContext, plotCanvasContext, eventListeners, neighborRelationship }: { plotDataContext: Plot2DDataContext, plotCanvasContext: Plot2DCanvasContext, eventListeners: CanvasEventListeners, neighborRelationship?: PointsNeighborRelationship }) => {
    const [rc, setRc] = useState<VisualizerRenderContext | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // for real-time subtitle update
    const spriteRenderRef = useRef<{ repaint: () => void }>(null);
    const viewUpdateEvent = useRef(new EventDispatcher());

    // one-time after mounted
    useEffect(() => {
        viewUpdateEvent.current.callback = () => {
            spriteRenderRef.current?.repaint();
        };
    }, [])

    useEffect(() => {
        const ob = new ResizeObserver(() => {
            setRc(new VisualizerRenderContext(
                plotCanvasContext.boundary!,
                'white',
                canvasRef.current!
            ));
        });

        if (canvasRef.current) {
            ob.observe(canvasRef.current);
            return () => {
                ob.disconnect();
            };
        }
    }, [plotCanvasContext.boundary]);

    useEffect(() => {
        if (plotCanvasContext.boundary === undefined) return;
        setRc(new VisualizerRenderContext(
            plotCanvasContext.boundary!,
            'white',
            canvasRef.current!
        ));
    }, [plotCanvasContext.boundary]);

    const shouldRenderPoints = rc !== null && plotDataContext.geo !== undefined;
    const shouldRenderSprites = shouldRenderPoints && plotDataContext.sprite;

    return (
        <div
            id="canvas-container"
            style={{
                width: "100%",
                height: "100%"
            }}
        >
            <Canvas ref={canvasRef} frameloop="demand" resize={{ debounce: 0 }} linear flat>
                {/* Ambient Light */}
                <ambientLight color={0xffffff} intensity={2.0} />

                {/* Points Rendering */}
                {shouldRenderPoints && (
                    <PointsRender
                        rawPointsData={plotDataContext.geo!}
                        visualizerRenderContext={rc}
                        eventListeners={{ ...eventListeners, onReload: viewUpdateEvent.current.dispatch }}
                    />
                )}

                {/* Camera and Controls */}
                {rc && (
                    <>
                        <VisualizerDefaultCamera visualizerRenderContext={rc} />
                        <VisualizerDefaultControl
                            visualizerRenderContext={rc}
                            onResize={viewUpdateEvent.current.dispatch}
                        />
                    </>
                )}
            </Canvas>

            {/* Sprite Rendering */}
            {shouldRenderSprites && (
                <SpriteRender
                    ref={spriteRenderRef}
                    rawPointsData={plotDataContext.geo!}
                    spriteData={plotDataContext.sprite!}
                    visualizerRenderContext={rc}
                />
            )}
        </div>
    );
});
