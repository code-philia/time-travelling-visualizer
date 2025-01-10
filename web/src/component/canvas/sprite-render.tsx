import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { CommonPointsGeography, pointsDefaultSize, SpriteData } from './types';
import { VisualizerRenderContext, worldPositionToScreenPosition } from './visualizer-render-context';

function repaintSprite(canvas: HTMLCanvasElement, rawPointsData: CommonPointsGeography, spriteData: SpriteData, rc: VisualizerRenderContext) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { camera, canvasElement } = rc;
    if (!camera) return;

    // Set canvas dimensions
    canvas.width = canvasElement.width;
    canvas.height = canvasElement.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = Math.max(1.0, Math.min(rc.camera?.zoom ?? 1.0, 2.0));     // NOTE scaling need another algorithm
    const initFontSize = 18;

    // Set text styles
    ctx.fillStyle = 'black';
    ctx.font = `${scale * initFontSize}px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`;

    rawPointsData.positions.forEach((pos, i) => {
        const label = spriteData.labels[i];
        if (label === undefined) return;

        const [x, y] = pos;
        const [sx, sy] = worldPositionToScreenPosition(
            [x, y],
            camera,
            canvasElement.getBoundingClientRect()
        );

        const pixelRate = 2;
        const offsetRight = (initFontSize / 2 + pointsDefaultSize) / 2;
        const offsetDown = (pointsDefaultSize) / 2;

        ctx.fillStyle = `rgba(0, 0, 0, ${rawPointsData.alphas[i]})`;
        ctx.fillText(label, sx * pixelRate + offsetRight * scale, sy * pixelRate + offsetDown * scale);
    });
}

export const SpriteRender = forwardRef(function SpriteRender({ rawPointsData, visualizerRenderContext, spriteData }: { rawPointsData: CommonPointsGeography, spriteData: SpriteData, visualizerRenderContext: VisualizerRenderContext },
    ref: React.Ref<{ repaint: () => void }>) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const tryRepaintSprite = useCallback(() => {
        if (!canvasRef.current) return;

        repaintSprite(canvasRef.current, rawPointsData, spriteData, visualizerRenderContext);
    }, [canvasRef, rawPointsData, spriteData, visualizerRenderContext]);

    useImperativeHandle(ref, () => {
        return {
            repaint() {
                tryRepaintSprite();
            }
        };
    }, [tryRepaintSprite]);

    useEffect(() => {
        tryRepaintSprite();
    }, [tryRepaintSprite]);

    return <canvas className="sprite-canvas" ref={canvasRef} />;
});
