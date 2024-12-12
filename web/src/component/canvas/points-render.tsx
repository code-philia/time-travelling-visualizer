import { ThreeEvent } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { BufferAttribute } from 'three';
import { isCircleHovered, VisualizerRenderContext } from './visualizer-render-context';
import { CommonPointsGeography } from './types';

function getDefaultVertexShader() {
    return `
        attribute float size;
        attribute float alpha;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
            vColor = color;
            vAlpha = alpha;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size;
            gl_Position = projectionMatrix * mvPosition;
        }
    `;
}

function getDefaultFragmentShader() {
    return `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
            vec2 coord = gl_PointCoord - vec2(0.5);
            float dist = length(coord);
            if (dist > 0.5) discard;
            gl_FragColor = vec4(vColor, vAlpha);
        }
    `;
}

type PlotEventListeners = {
    onHoverPoint?: (idx: number | undefined) => void;
    onClickPoint?: (idx: number) => void;
    onReload?: () => void;
}

export function PointsRender({ rawPointsData, visualizerRenderContext, eventListeners }: { rawPointsData: CommonPointsGeography, visualizerRenderContext: VisualizerRenderContext, eventListeners?: PlotEventListeners }) {
    const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
        // console.log('Pointer moved:', event.clientX, event.clientY);
        // todo
    };
    const handleClick = (event: ThreeEvent<MouseEvent>) => {
        // console.log('Pointer clicked:', event.clientX, event.clientY);
        // todo
    }

    const numPoints = rawPointsData.positions.length;

    const positions: number[] = [];
    const colors: number[] = [];

    for (let i = 0; i < numPoints; ++i) {
        const rawPos = rawPointsData.positions[i];
        const rawColor = rawPointsData.colors[i];

        positions.push(rawPos[0], rawPos[1], 0);
        colors.push(rawColor[0], rawColor[1], rawColor[2]);
    }

    const geo = {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        sizes: new Float32Array(rawPointsData.sizes),
        alphas: new Float32Array(rawPointsData.alphas),
    };

    const positionRef = useRef<BufferAttribute>(null);
    const colorRef = useRef<BufferAttribute>(null);
    const sizeRef = useRef<BufferAttribute>(null);
    const alphaRef = useRef<BufferAttribute>(null);

    useEffect(() => {
        for (const ref of [positionRef, colorRef, sizeRef, alphaRef]) {
            if (ref.current) {
                ref.current.needsUpdate = true;
            }
        }
    }, [rawPointsData]);

    useEffect(() => {
        eventListeners?.onReload?.();
    }, [eventListeners, rawPointsData]);

    // setup events

    const rc = visualizerRenderContext;

    useEffect(() => {
        const findOverPoint = (e: MouseEvent) => {
            let foundHighlighted: number | undefined = undefined;

            const { x, y } = rc.canvasElement.getBoundingClientRect();
            const cursor: [number, number] = [e.clientX - x, e.clientY - y];

            for (let i = 0; i < rawPointsData.positions.length; i++) {
                const [px, py] = rawPointsData.positions[i];
                const d = rawPointsData.sizes[i];
                if (isCircleHovered([px, py], cursor, rc, d / 4)) {
                    foundHighlighted = i;
                    break;
                }
            }

            return foundHighlighted;
        };

        const moveListener = (e: MouseEvent) => {
            const foundOverPoint = findOverPoint(e);
            eventListeners?.onHoverPoint?.(foundOverPoint);
        };
        rc.canvasElement.addEventListener('pointermove', moveListener);

        const clickListener = (e: MouseEvent) => {
            const foundOverPoint = findOverPoint(e);
            if (foundOverPoint !== undefined) eventListeners?.onClickPoint?.(foundOverPoint);
        }
        rc.canvasElement.addEventListener('click', clickListener);

        return () => {
            rc.canvasElement.removeEventListener('pointermove', moveListener);
            rc.canvasElement.removeEventListener('click', clickListener);
        };
    }, [eventListeners, rawPointsData.positions, rawPointsData.sizes, rc]);

    return (
        <points onPointerMove={handlePointerMove} onClick={handleClick} frustumCulled={false}>
            <bufferGeometry>
                <bufferAttribute ref={positionRef} attach="attributes-position" count={numPoints} array={geo.positions} itemSize={3} />
                <bufferAttribute ref={colorRef} attach="attributes-color" count={numPoints} array={geo.colors} itemSize={3} />
                <bufferAttribute ref={sizeRef} attach="attributes-size" count={numPoints} array={geo.sizes} itemSize={1} />
                <bufferAttribute ref={alphaRef} attach="attributes-alpha" count={numPoints} array={geo.alphas} itemSize={1} />
            </bufferGeometry>
            <shaderMaterial key={`${geo.sizes}`} opacity={1} transparent vertexShader={getDefaultVertexShader()} fragmentShader={getDefaultFragmentShader()} vertexColors />
        </points>
    );
}

