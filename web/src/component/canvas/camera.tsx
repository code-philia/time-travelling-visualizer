import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { Euler, OrthographicCamera as OrthographicCameraImpl, Vector4, WebGLRenderer } from 'three';
import { OrthographicCamera } from '@react-three/drei';
import { ContextOnlyProps, VisualizerRenderContext } from './visualizer-render-context';
import { useFrame, useThree } from '@react-three/fiber';

// FIXME this is factually replaced by resetCamera, in functionality
function resizeCamera(camera: OrthographicCameraImpl, gl: WebGLRenderer, oldScalingFactor: number, computeOnly: boolean = false): number {
    const v4 = gl.getViewport(new Vector4());

    if (!computeOnly) {
        const w = v4.width / oldScalingFactor;
        const h = v4.height / oldScalingFactor;
        camera.left = -w / 2;
        camera.right = w / 2;
        camera.top = h / 2;
        camera.bottom = -h / 2;
        camera.updateProjectionMatrix();
    }

    // assume the viewport and camera has same aspect ratio
    // calculate factor in "pixels per unit"
    let scalingFactor = v4.width / (camera.right - camera.left);
    if (scalingFactor === 0) {
        scalingFactor = oldScalingFactor;
    }
    return scalingFactor;
}

function resetCamera(camera: OrthographicCameraImpl, initWorldWidth: number, initWorldHeight: number, centerX: number, centerY: number) {
    const w = initWorldWidth;
    const h = initWorldHeight;

    camera.left = -w / 2;
    camera.right = w / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    // camera.zoom = 1;
    camera.rotation.set(0, 0, 0);
    camera.up.set(0, 0, 1);

    // camera.position.set(centerX, centerY, 100);
    camera.lookAt(centerX, centerY, 0);
    camera.updateProjectionMatrix();
}

function addResizeObserver(camera: OrthographicCameraImpl, renderer: WebGLRenderer) {
    let oldScalingFactor = resizeCamera(camera, renderer, 1, true);

    const observer = new ResizeObserver(() => {
        oldScalingFactor = resizeCamera(camera, renderer, oldScalingFactor, false);
    });

    const divElement = renderer.domElement;
    if (divElement) {
        observer.observe(divElement);
    }

    return observer;
}

export function VisualizerDefaultCamera({ initWorldWidth, initWorldHeight, centerX, centerY, onRender, onBind }:
    { onBind?: (camera: OrthographicCameraImpl) => void, onRender?: () => void, initWorldWidth: number, initWorldHeight: number, centerX: number, centerY: number }
) {
    const [_centerX, _setCenterX] = useState(0);
    const [_centerY, _setCenterY] = useState(0);

    const gl = useThree((state) => state.gl);
    const camera = useThree((state) => state.camera);   // FIXME this assumes the camera is this component

    const zoom = useMemo(() => {
        if (centerX === _centerX) {
            return camera.zoom;
        } else {
            _setCenterX(centerX);
            return 1;
        }
    }, [centerX]);

    // const initialRotation = useRef<Euler>(new Euler());

    // const timer = useRef<number>();
    // const debounce = useRef((fn: () => void) => {
    //     if (timer.current) {
    //         window.clearTimeout(timer.current);
    //     }
    //     timer.current = window.setTimeout(fn, 20);
    // });

    useEffect(() => {
        if (camera instanceof OrthographicCameraImpl) {
            onBind?.(camera);
            // resetCamera(camera, initWorldWidth, initWorldHeight, centerX, centerY);
            // camera.rotation.copy(initialRotation.current);
            camera.updateProjectionMatrix();
        }
    });

    // TODO add test for resting the camera
    useEffect(() => {
        if (!(camera instanceof OrthographicCameraImpl)) return;

        const observer = addResizeObserver(camera, gl);

        return () => {
            observer.disconnect();
        }
    }, [gl, camera]);

    useFrame(({ gl, scene, camera }) => {
        gl.render(scene, camera);
        onRender?.();
    }, 1);

    // make map control z-axis up
    return useMemo(() => (
        <OrthographicCamera key={crypto.randomUUID()}   // FIXME force refresh will reduce performance
            top={initWorldHeight / 2}
            bottom={-initWorldHeight / 2}
            left={-initWorldWidth / 2}
            right={initWorldWidth / 2}
            zoom={zoom}
            near={1} far={1000}
            position={[centerX, centerY, 100]}
            rotation={[0, 0, 0]}
            up={[0, 0, 1]}
            makeDefault manual
        />
    ), [centerX, centerY]);
}
