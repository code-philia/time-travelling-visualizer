import { useFrame, useThree } from '@react-three/fiber';
import { ContextOnlyProps, VisualizerRenderContext } from './visualizer-render-context';
import { MapControls } from '@react-three/drei';
import { OrthographicCamera, Vector3, EventListener, WebGLRenderer, Vector4, Spherical, MOUSE } from 'three';
import React, { ComponentRef, useEffect, useRef } from 'react';

type ControlState = {
    target: Vector3;
    position: Vector3;
    zoom: number;
}

function resizeCamera(camera: OrthographicCamera, gl: WebGLRenderer, oldScalingFactor: number, computeOnly: boolean = false): number {
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
    const scalingFactor = v4.width / (camera.right - camera.left);
    return scalingFactor;
}

function resetCamera(camera: OrthographicCamera, rc: VisualizerRenderContext) {
    const w = rc.initWorldWidth;
    const h = rc.initWorldHeight;
    const centerX = rc.centerX;
    const centerY = rc.centerY;

    camera.left = -w / 2;
    camera.right = w / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.zoom = 1;
    camera.rotation.set(0, 0, 0);
    camera.up.set(0, 0, 1);

    camera.position.set(centerX, centerY, 100);
    camera.lookAt(centerX, centerY, 0);
    camera.updateProjectionMatrix();
}

function addResizeObserver(camera: OrthographicCamera, renderer: WebGLRenderer) {
    let oldScalingFactor = resizeCamera(camera, renderer, 1, true);

    const observer = new ResizeObserver(() => {
        oldScalingFactor = resizeCamera(camera, renderer, oldScalingFactor, false);
    });

    const divElement = renderer.domElement;
    if (divElement) {
        observer.observe(divElement);
    }
}

export function VisualizerDefaultControl({ visualizerRenderContext, onResize }: ContextOnlyProps & { onResize: () => void }) {
    const rc = visualizerRenderContext;

    const mapControlsRef = useRef<ComponentRef<typeof MapControls>>(null);

    const gl = useThree((state) => state.gl);
    const camera = useThree((state) => state.camera);

    // TODO add test for resting the camera
    useEffect(() => {
        if (!(camera instanceof OrthographicCamera)) return;

        addResizeObserver(camera, gl);

        resetCamera(camera, rc);
    }, [gl, camera, rc, onResize]);

    useFrame(({ gl, scene, camera }) => {
        gl.render(scene, camera);
        onResize();
    }, 1);

    return (
        <MapControls ref={mapControlsRef}
            screenSpacePanning={true}
            enableDamping={false}
            maxPolarAngle={0}
            // maxAzimuthAngle={0}
            // minAzimuthAngle={0}
            target={[rc.centerX, rc.centerY, 0]}
            zoomToCursor={true}
            reverseHorizontalOrbit={true}
            enableRotate={false}
        />
    )
}
