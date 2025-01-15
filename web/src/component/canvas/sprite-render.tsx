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

    // Store label positions for collision detection
    const occupiedAreas: Array<{ x: number, y: number, width: number, height: number }> = [];

    // FIXME the length of projection data and text could be different
    const validLength = Math.min(
        rawPointsData.positions.length,
        rawPointsData.alphas.length,
        rawPointsData.colors.length,
        rawPointsData.sizes.length,
        spriteData.labels.length
    );

    const idxSortedByAlpha = new Array(validLength).fill(0).map((_, i) => i)
        .sort((a, b) => rawPointsData.colors[b][0] - rawPointsData.colors[a][0] === 0
            ? rawPointsData.alphas[b] - rawPointsData.alphas[a]
            : rawPointsData.colors[b][0] - rawPointsData.colors[a][0]
        );

    // FIXME should check pixel rate with device
    const pixelRate = 2;

    idxSortedByAlpha.forEach((i) => {
        const label = spriteData.labels[i];
        if (label === undefined) return;

        const pos = rawPointsData.positions[i];
        const [x, y] = pos;
        const [sx, sy] = worldPositionToScreenPosition(
            [x, y],
            camera,
            canvasElement.getBoundingClientRect()
        );

        const rotationTries = 1;    // Adjust this can use rotation tries
        for (let j = 0; j < rotationTries; j++) {
            const offset = (initFontSize / 2 + pointsDefaultSize * scale) / 2;

            const labelWidth = ctx.measureText(label).width;
            const labelHeight = initFontSize;

            const angle = Math.PI / rotationTries * j;
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            const a = offset + labelWidth / 2;
            const b = offset + labelHeight / 2;

            const r = a * b / Math.sqrt(a * a * sin * sin + b * b * cos * cos);
            const cx = r * cos;
            const cy = r * sin;

            const labelX = sx * pixelRate + cx - labelWidth / 2;
            const labelY = sy * pixelRate - cy + labelHeight / 2;

            const labelRect = {
                x: labelX,
                y: labelY - labelHeight,
                width: labelWidth,
                height: labelHeight
            };

            const hasCollision = occupiedAreas.some(area =>
                !(labelRect.x + labelRect.width < area.x ||
                    labelRect.x > area.x + area.width ||
                    labelRect.y + labelRect.height < area.y ||
                    labelRect.y > area.y + area.height)
            );

            if (!hasCollision) {
                ctx.fillStyle = `rgba(0, 0, 0, ${rawPointsData.alphas[i]})`;
                ctx.fillText(label, labelX, labelY);
                occupiedAreas.push(labelRect);
                return;
            }
        }
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
