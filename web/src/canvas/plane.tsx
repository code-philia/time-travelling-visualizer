import * as THREE from 'three';
import { BoundaryProps } from '../state/types';

interface Props {
    boundary: BoundaryProps;
    color: string;
}

export function Plane(props: Props) {
    const { boundary, color } = props;
    const width = boundary.x2 - boundary.x1;
    const height = boundary.y2 - boundary.y1;
    const centerX = boundary.x1 + width / 2;
    const centerY = boundary.y1 + height / 2;

    return (
        <mesh position={[centerX, centerY, 0]}>
            <planeGeometry args={[width, height]} />
            <meshPhongMaterial color={color} side={THREE.DoubleSide} />
        </mesh>
    )
}
