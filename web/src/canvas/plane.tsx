import { DoubleSide } from 'three';
import { VisualizerRenderContext } from './visualizer-render-context';

type PlaneProps = {
    visualizerRenderContext: VisualizerRenderContext;
};

export function Plane({ visualizerRenderContext }: PlaneProps) {
    const rc = visualizerRenderContext;

    // add a small offset to centerY to bypass rotation caused by spherical computation loss
    return (
        <mesh position={[rc.centerX, rc.centerY, 0]}>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color={rc.backgroundColor} side={DoubleSide} />
        </mesh>
    )
}
