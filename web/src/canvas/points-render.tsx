import * as THREE from 'three'
import { useRef, useEffect } from 'react'
import { Float32BufferAttribute, PointsMaterial, BufferGeometry } from 'three';
import { ThreeEvent } from '@react-three/fiber';

export interface PointData {
    positions: Float32Array;
    colors: Float32Array;
    sizes: Float32Array;
    alphas: Float32Array;
}

export function PointsRender({ pointData }: { pointData: PointData }) {
    const pts: { geometry: BufferGeometry } = { geometry: new BufferGeometry() };
    const ptsMat: PointsMaterial = new PointsMaterial();
    const pointsRef = useRef(pts);
    const materialRef = useRef<THREE.PointsMaterial>(ptsMat);

    function useAttributes(attribute: string, array: THREE.TypedArray, itemSize: number) {
        const geometry = pointsRef.current.geometry;
        useEffect(() => {
            if (!geometry) return;
            let attr = geometry.getAttribute(attribute);
            if (attr) {
                geometry.deleteAttribute(attribute);
            }
            attr = new Float32BufferAttribute(array, itemSize);
            geometry.setAttribute(attribute, attr);        
        }, [geometry, attribute, array, itemSize]);
    }
    useAttributes('position', pointData.positions, 3);
    useAttributes('color', pointData.colors, 3);
    useAttributes('size', pointData.sizes, 1);
    useAttributes('alpha', pointData.alphas, 1);

    const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
        console.log('Pointer moved:', event.clientX, event.clientY);
        // todo
    };
    const handleClick = (event: ThreeEvent<MouseEvent>) => {
        console.log('Pointer clicked:', event.clientX, event.clientY);
        // todo
    }
    return (
        <points ref={pointsRef as any} onPointerMove={handlePointerMove} onClick={handleClick}>
            <bufferGeometry attach={'geometry'}>
                <bufferAttribute attach="attributes-position" count={pointData.positions.length / 3} array={pointData.positions} itemSize={3} />
                <bufferAttribute attach="attributes-color" count={pointData.colors.length / 3} array={pointData.colors} itemSize={3} />
                <bufferAttribute attach="attributes-size" count={pointData.sizes.length} array={pointData.sizes} itemSize={1} />
                <bufferAttribute attach="attributes-alpha" count={pointData.alphas.length} array={pointData.alphas} itemSize={1} />
            </bufferGeometry>
            <pointsMaterial ref={materialRef} attach="material" opacity={1} size={0.05} sizeAttenuation={true} />
        </points>
    )
}

