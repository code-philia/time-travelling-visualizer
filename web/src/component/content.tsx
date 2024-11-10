import '../index.css'
import { useState, useEffect } from 'react'

import { CanvasContainer } from '../canvas/canvas'
import { useStore } from '../state/store'

export function ContentContainer() {
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
        <div className="content_container">
            <div id="container_range">
                <div id="container">
                    {canvasContainers.map((id) => (
                        <CanvasContainer key={id} isVisible={id === visibleCanvas} />
                    ))}
                </div>
            </div>
            <div id="footer">
                <div>Epochs</div>
                <svg id="timeLinesvg" height="0" width="0"></svg>
            </div>
        </div>
        
    )
}
