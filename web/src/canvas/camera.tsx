import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrthographicCamera } from '@react-three/drei';
import { ContainerProps, BoundaryProps } from '../state/types';
import { ThreeEvent } from '@react-three/fiber';

interface Props {
    container: ContainerProps;
    boundary: BoundaryProps;
}

export function Camera(props: Props) {
    const { container, boundary } = props;
    const { width, height } = container;
    const { x1, y1, x2, y2 } = boundary;
    const aspect = width / height;
    const cameraRef = useRef<THREE.OrthographicCamera>(null);

    function onWheelZoom(event: ThreeEvent<WheelEvent>) {
        if (cameraRef.current) {
            cameraRef.current.position.z += event.deltaY * 0.01;
        }
    }

    useEffect(() => {
        if (cameraRef.current) {
            cameraRef.current.position.set((x1 + x2) / 2, (y1 + y2) / 2, 100);
            cameraRef.current.lookAt(new THREE.Vector3(0, 0, 0));
        }
    }, []);

    return <OrthographicCamera ref={cameraRef} left={x1 * aspect}
        right={x2 * aspect} top={y2} bottom={y1} near={1} far={1000}
        onWheel={onWheelZoom} />;
}
