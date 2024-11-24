import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber'

import { ProjectionProps } from '../state/types.ts';
import { updateProjection } from '../user/api'
import { useStore } from '../state/store';

import { PointsRender } from './points-render.tsx'
import { PointData } from './points-render.tsx';
import { VisualizerRenderContext } from './visualizer-render-context.tsx';
import { VisualierDefaultControl } from './visualizer-default-control.tsx';
import { VisualizerDefaultCamera } from './camera.tsx';

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
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const { command, contentPath, visMethod, taskType, iteration, filterIndex } = useStore(["command", "contentPath", "visMethod", "taskType", "iteration", "filterIndex"]);
    const [frameloop, setFrameloop] = useState<'never' | 'always' | 'demand' | undefined>('never');
    const [pointData, setPointData] = useState<PointData>(initPointData);
    const [projectionRes, setProjectionRes] = useState<ProjectionProps>(initProjectionRes);
    const [boundary, setBoundary] = useState({ x1: -100, y1: -200, x2: 150, y2: 150 });
    const [canvasRect, setCanvasRect] = useState({ width: 300, height: 300 });
    const [visible, setVisible] = useState(isVisible);

    useEffect(() => {
        setVisible(isVisible);
    }, [isVisible]);

    useEffect(() => {
        if (command != 'update' || !visible) return;
        (async () => {
            const res = await updateProjection(contentPath, visMethod, taskType, iteration, filterIndex);
            if (res) {
                setProjectionRes(res);
            }
        })();
    }, [contentPath, visMethod, taskType, iteration, filterIndex, command, visible]);

    useEffect(() => {
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
        const positions: number[] = [];
        const colors: number[] = [];
        const sizes: number[] = [];
        const alphas: number[] = [];
        projectionRes.result.forEach((point, i) => {
            positions.push(point[0], point[1], 0);
            const color = projectionRes.color_list[parseInt(projectionRes.label_list[i])];
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
    }, [projectionRes.result, projectionRes.confidence_list, projectionRes.color_list, projectionRes.label_list, visible])

    useEffect(() => {
        if (projectionRes.grid_index.length != 4 || !visible) return;
        setBoundary({
            x1: projectionRes.grid_index[0],
            y1: projectionRes.grid_index[1],
            x2: projectionRes.grid_index[2],
            y2: projectionRes.grid_index[3],
        })
    }, [projectionRes.grid_index, visible])

    // TODO add test for resting the camera
    // const testReset = () => {
    //     setBoundary({ x1: -100, y1: -200, x2: 150, y2: 150 });
    // };

    const rc = new VisualizerRenderContext(boundary, 'white', canvasRect);

    // CSS of canvas-container must not contain "margin", or the <Canvas/> rendering will lead to a bug due to r3f (react-three-fiber)
    return (
        <div id="canvas-container"
            style={{
                display: visible ? 'block' : 'none',
                width: '100%',
                height: '100%'
            }}>
            <Canvas ref={canvasRef} frameloop={frameloop}>
                <ambientLight color={0xffffff} intensity={1.0} />       {/* set to Math.PI and set <Canvas linear flat/> to render all-white texture */}
                <PointsRender pointData={pointData} />
                <axesHelper args={[100]} />
                <VisualizerDefaultCamera visualizerRenderContext={rc} />
                <VisualierDefaultControl visualizerRenderContext={rc}/>
            </Canvas>
        </div>
    )
}
