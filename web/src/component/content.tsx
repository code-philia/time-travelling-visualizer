import { useState, useEffect } from 'react'

import { CanvasContainer } from '../canvas/canvas'
import { useStore } from '../state/store'

export function VisualizationArea() {
    const { iteration } = useStore(['iteration']);
    const [canvasContainers, setCanvasContainers] = useState<number[]>([]);
    const [visibleCanvas, setVisibleCanvas] = useState<number | null>(null);

    useEffect(() => {
        if (!canvasContainers.includes(iteration)) {
            setCanvasContainers((prev) => {
                if (!prev.includes(iteration)) {
                    return [...prev, iteration];
                }
                return prev;
            });
        }
    }, [iteration, canvasContainers]);

    useEffect(() => {
        setVisibleCanvas(iteration);
    }, [iteration]);

    return (
        <div className="canvas-column">
            <div id="container">
                {canvasContainers.map((id) => (
                    <CanvasContainer key={id} visible={id === visibleCanvas} />
                ))}
            </div>
            <div id="footer">
                <div>Epochs</div>
                <svg id="timeLinesvg" height="0" width="0"></svg>
            </div>
        </div>
        
    )
}
