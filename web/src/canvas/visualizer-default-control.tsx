import { useThree } from '@react-three/fiber';
import { ContextOnlyProps } from './visualizer-render-context';
import { MapControls } from '@react-three/drei';
import { OrthographicCamera, Vector3, EventListener, WebGLRenderer, Vector2 } from 'three';
import { MapControls as MapControlsImpl } from 'three-stdlib';
import { useEffect, useRef } from 'react';

type ControlState = {
    target: Vector3;
    position: Vector3;
    zoom: number;
}

// for OrbitControl.d.ts does not define the events it could dispatch
type MapControlsEventMap = {
    update: void;     // this could be incorrect
};
type MapControlsEventDispatcher = { 
    addEventListener: <T extends Extract<keyof MapControlsEventMap, string>>(
        type: T,
        listener: EventListener<MapControlsEventMap[T], T, MapControlsImpl>
    ) => void;
}

export function VisualierDefaultControl({ visualizerRenderContext }: ContextOnlyProps) {
    const mapControlsRef = useRef<MapControlsImpl>(null);
    const state = useRef<ControlState | null>(null);
    let rendered = false;

    const rc = visualizerRenderContext;

    // save state externally, modified from OrbitControl definition
    function saveState(mapControls: MapControlsImpl) {
        state.current = {
            target: mapControls.target,
            position: mapControls.object.position.clone(),
            zoom: mapControls.object.zoom,
        };
    }

    function restoreState(mapControls: MapControlsImpl) {
        if (mapControls && state.current) {
            const { target, position, zoom } = state.current;
            mapControls.target.copy(target);
            mapControls.object.position.copy(position);
            mapControls.object.zoom = zoom;

            mapControls.object.updateMatrixWorld();
            mapControls.update();

            // mapControls.state = MapControlsImpl.STATE.NONE;
        }
    }
    
    function resizeRendererToDisplaySize(renderer: WebGLRenderer) {
        const canvas = renderer.domElement;
        const pixelRatio = window.devicePixelRatio;
        const width  = Math.floor( canvas.clientWidth / 2  * pixelRatio );
        const height = Math.floor( canvas.clientHeight / 2 * pixelRatio );
        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) {
            renderer.setSize(width, height, false);
        }
        return needResize;
    }
    
    function resizeViewport(renderer: WebGLRenderer) {
        if (resizeRendererToDisplaySize(renderer)) {
            // keep a square viewport in the middle
            const sizeV2 = new Vector2();
            renderer.getSize(sizeV2);
            const viewportSize = Math.min(sizeV2.x, sizeV2.y);
            renderer.setViewport((sizeV2.x - viewportSize) / 2, (sizeV2.y - viewportSize) / 2, viewportSize, viewportSize);
        }
    }

    useThree(
        ({ gl, camera }) => {
            // reset viewport
            resizeViewport(gl);

            // reset camera
            if (rendered || !(camera instanceof OrthographicCamera)) return;

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
            // console.log(`Setting centerX = ${centerX}, centerY = ${centerY}`);
        }
    );

    useEffect(() => {
        rendered = true;

        const mapControl = mapControlsRef.current;
        if (mapControl) {
            restoreState(mapControl);
            (mapControl as MapControlsEventDispatcher).addEventListener('update', () => {
                saveState(mapControl);
            });
        }
    });

    return (
        <MapControls ref={mapControlsRef}
            screenSpacePanning={true}
            enableDamping={false}
            minPolarAngle={Math.PI}
            target={[rc.centerX, rc.centerY - 0.01, 0]}
            zoomToCursor={true}
            reverseHorizontalOrbit={true}
        />
    )
}
