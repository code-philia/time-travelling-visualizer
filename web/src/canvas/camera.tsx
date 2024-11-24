import { useRef, useEffect } from 'react';
import { OrthographicCamera as OrthographicCameraImpl } from 'three';
import { OrthographicCamera } from '@react-three/drei';
import { ContextOnlyProps } from './visualizer-render-context';

export function VisualizerDefaultCamera({ visualizerRenderContext }: ContextOnlyProps) {
    const rc = visualizerRenderContext;

    const cameraRef = useRef<OrthographicCameraImpl>(null);
    useEffect(
        () => { cameraRef.current?.lookAt(rc.centerX, rc.centerY, 0); }
    );

    const w = rc.projectionWidth;
    const h = rc.projectionHeight;

    // make map control z-axis up
    return <OrthographicCamera
        ref={cameraRef}
        left={-w / 2} right={w / 2}
        bottom={-h / 2} top={h / 2} 
        near={1} far={1000}
        position={[rc.centerX, rc.centerY, 100]}
        makeDefault manual
    />;
}
