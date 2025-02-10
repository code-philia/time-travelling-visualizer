import { MapControls } from '@react-three/drei';
import { OrthographicCamera, Vector3, EventListener, WebGLRenderer, Vector4, Spherical, MOUSE, Euler } from 'three';

type ControlState = {
    target: Vector3;
    position: Vector3;
    zoom: number;
}

export function VisualizerDefaultControl({ onChange = () => { } }: { onChange?: () => void }) {
    return <MapControls
        screenSpacePanning={true}
        enableDamping={false}
        maxPolarAngle={0}
        maxAzimuthAngle={0}
        minAzimuthAngle={0}
        zoomToCursor={true}
        reverseHorizontalOrbit={true}
        enableRotate={false}
        // onChange={() => {
        //     if (!(camera instanceof OrthographicCamera)) return;
        //     initialRotation.current.copy(camera.rotation);
        // }}
    />
}
