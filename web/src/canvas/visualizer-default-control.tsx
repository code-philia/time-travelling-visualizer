import { useThree } from '@react-three/fiber';
import { ContextOnlyProps } from './visualizer-render-context';
import { MapControls } from '@react-three/drei';
import { OrthographicCamera } from 'three';

export function VisualierDefaultControl({ visualizerRenderContext }: ContextOnlyProps) {
    const rc = visualizerRenderContext;

    useThree(
        ({ camera }) => {
            if (!(camera instanceof OrthographicCamera)) return;

            const w = rc.projectionWidth;
            const h = rc.projectionHeight;
            const centerX = rc.centerX;
            const centerY = rc.centerY;

            camera.left = -w / 2;
            camera.right = w / 2;
            camera.top = h / 2;
            camera.bottom = -h / 2;
            camera.updateProjectionMatrix();
            
            camera.position.set(centerX, centerY, 100);
            camera.lookAt(centerX, centerY, 0);
            camera.up.set(0, 0, -1);     // make map control z-axis up
            console.log(`Setting centerX = ${centerX}, centerY = ${centerY}`);
        }
    );

    return (
        <MapControls
            screenSpacePanning={true}
            enableDamping={false}
            minPolarAngle={Math.PI}
            target={[rc.centerX, rc.centerY - 0.01, 0]}
            zoomToCursor={true}
            reverseHorizontalOrbit={true}
        />
    )
}
