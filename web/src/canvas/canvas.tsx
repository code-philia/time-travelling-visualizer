import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber'
import { useStore } from '../state/store';
import { PointsRender } from './points-render.tsx'
import { Camera } from './camera.tsx';
import { Plane } from './plane.tsx';
import { PointData } from './points-render.tsx';

const initPointData: PointData = {
    positions: new Float32Array([0, 0, 0]),
    colors: new Float32Array([0, 0, 0]),
    sizes: new Float32Array(0),
    alphas: new Float32Array(0),
}

const NORMAL_SIZE = 10;

export function CanvasContainer({ isVisible }: { isVisible: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const { projectionRes } = useStore(["projectionRes"]);
    const [frameloop, setFrameloop] = useState<'never' | 'always' | 'demand' | undefined>('never')
    const [pointData, setPointData] = useState<PointData>(initPointData)
    const [boundary, setBoundary] = useState({ x1: -150, y1: -150, x2: 150, y2: 150 });
    const [containerRect, setContainerRect] = useState({ width: 300, height: 300 });
    const [visible, setVisible] = useState(isVisible);

    useEffect(() => {
        setVisible(isVisible);
    }, [isVisible]);

    useEffect(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setContainerRect({ width: rect.width, height: rect.height });
        }
        const observer = new IntersectionObserver(([{ isIntersecting }]) => {
            setFrameloop(isIntersecting ? 'always' : 'never')
        }, {})

        if (canvasRef.current) {
            observer.observe(canvasRef.current)
        }
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (projectionRes.result.length == 0 || !visible) return;
        let positions = [];
        let colors = [];
        let sizes = [];
        let alphas = [];
        projectionRes.result.forEach((point, i) => {
            positions.push(point[0], point[1], 0);
            let color = projectionRes.color_list[parseInt(projectionRes.label_list[i])];
            colors.push(color[0] / 255, color[1] / 255, color[2] / 255);
            sizes.push(NORMAL_SIZE);
            alphas.push(1.0);
        });
        const d = {
            positions: new Float32Array(positions),
            colors: new Float32Array(colors),
            sizes: new Float32Array(sizes),
            alphas: new Float32Array(alphas),
        };
        console.log(d)
        setPointData(d)
    }, [projectionRes.result, projectionRes.confidence_list, projectionRes.color_list, projectionRes.label_list])

    useEffect(() => {
        if (projectionRes.grid_index.length != 4 || !visible) return;
        setBoundary({
            x1: projectionRes.grid_index[0],
            y1: projectionRes.grid_index[1],
            x2: projectionRes.grid_index[2],
            y2: projectionRes.grid_index[3],
        })
    }, [projectionRes.grid_index])

    return (
        <div id="canvas-container"
            ref={containerRef}
            style={{
                display: visible ? 'block' : 'none',
                width: '100%',
                height: '100%'
            }}>
            <Canvas ref={canvasRef} frameloop={frameloop} >
                <ambientLight color={0xffffff} intensity={1.0} />
                <Camera container={containerRect} boundary={boundary} />
                <Plane boundary={boundary} color='white' />
                <PointsRender pointData={pointData} />
            </Canvas>
        </div>
    )
}
