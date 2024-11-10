import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber'

import { ProjectionProps } from '../state/types.ts';
import { updateProjection } from '../user/api'
import { useStore } from '../state/store';

import { PointsRender } from './points-render.tsx'
import { Camera } from './camera.tsx';
import { Plane } from './plane.tsx';
import { PointData } from './points-render.tsx';

const initProjectionRes: ProjectionProps = {
    result: [],
    grid_index: [],
    grid_color: '',
    label_name_dict: [],
    label_color_list: [],
    label_list: [],
    maximum_iteration: 0,
    training_data: [],
    testing_data: [],
    evaluation: 0,
    prediction_list: [],
    selectedPoints: [],
    properties: [],
    errorMessage: '',
    color_list: [],
    confidence_list: [],
}

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
    const { command, contentPath, visMethod, taskType, iteration, filterIndex } = useStore(["command", "contentPath", "visMethod", "taskType", "iteration", "filterIndex"]);
    const [frameloop, setFrameloop] = useState<'never' | 'always' | 'demand' | undefined>('never')
    const [pointData, setPointData] = useState<PointData>(initPointData)
    const [projuctionRes, setProjectionRes] = useState<ProjectionProps>(initProjectionRes)
    const [boundary, setBoundary] = useState({ x1: -150, y1: -150, x2: 150, y2: 150 });
    const [containerRect, setContainerRect] = useState({ width: 300, height: 300 });
    const [visible, setVisible] = useState(isVisible);

    useEffect(() => {
        setVisible(isVisible);
    }, [isVisible]);

    useEffect(() => {
        if (command != 'update' || !visible) return;
        const res = updateProjection(contentPath, visMethod, taskType, iteration, filterIndex);
        if (res) {
            setProjectionRes(res);
        }
    }, [contentPath, visMethod, taskType, iteration, filterIndex]);

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
        if (projuctionRes.result.length == 0 || !visible) return;
        let color = projuctionRes.label_list.map((idx) => projuctionRes.color_list[parseInt(idx)])
        setPointData({
            positions: new Float32Array(projuctionRes.result.flat()),
            colors: new Float32Array(color),
            sizes: new Float32Array(NORMAL_SIZE),
            alphas: new Float32Array(projuctionRes.confidence_list.map(() => 1)),
        })
    }, [projuctionRes.result, projuctionRes.confidence_list, projuctionRes.color_list, projuctionRes.label_list])

    useEffect(() => {
        if (projuctionRes.grid_index.length != 4 || !visible) return;
        setBoundary({
            x1: projuctionRes.grid_index[0],
            y1: projuctionRes.grid_index[1],
            x2: projuctionRes.grid_index[2],
            y2: projuctionRes.grid_index[3],
        })
    }, [projuctionRes.grid_index])

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
