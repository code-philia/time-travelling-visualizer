import { OrthographicCamera, Vector4 } from "three";
import { MapControls } from "three-stdlib";
import { BoundaryProps } from "../../state/types";

type WebElementRect = {
    width: number;
    height: number;
}

export class VisualizerRenderContext {
    boundary: BoundaryProps;
    backgroundColor: string;
    canvasElement: HTMLCanvasElement;
    canvasRect: WebElementRect;

    // camera and control instances
    camera?: OrthographicCamera;
    controls?: MapControls;

    // computed attributes
    aspect: number;
    initWorldWidth: number;
    initWorldHeight: number;
    centerX: number;
    centerY: number;

    constructor(boundary: BoundaryProps, backgroundColor: string, canvasElement: HTMLCanvasElement) {
        this.boundary = boundary;
        this.backgroundColor = backgroundColor;
        this.canvasElement = canvasElement;
        this.canvasRect = canvasElement.getBoundingClientRect();

        this.aspect = this.canvasRect.width / this.canvasRect.height;

        const { xMin, yMin, xMax, yMax } = this.boundary;

        let w = xMax - xMin;
        let h = yMax - yMin;
        const plotAspect = w / h;

        if (this.aspect > plotAspect) {
            h = h * 1.1;            // padding
            w = h * this.aspect;
        } else {
            w = w * 1.1;
            h = w / this.aspect;
        }
        this.initWorldWidth = w;
        this.initWorldHeight = h;

        this.centerX = (xMin + xMax) / 2;
        this.centerY = (yMin + yMax) / 2;
    }

    setCamera(camera: OrthographicCamera) {
        this.camera = camera;
        return camera;
    }

    setControls(controls: MapControls) {
        this.controls = controls;
        return controls;
    }
}

export type ContextOnlyProps = {
    visualizerRenderContext: VisualizerRenderContext;
}

function worldPositionToClipPosition(worldPosition: [number, number], camera: OrthographicCamera): [number, number] {
    // const [wx, wy] = worldPosition;
    // const [x, y] = camera.position;

    // const projectionWidth = (camera.right - camera.left) / camera.zoom;
    // const projectionHeight = (camera.top - camera.bottom) / camera.zoom;

    // const dx = wx - x;
    // const dy = wy - y;
    // return [
        //     (projectionWidth / 2 + dx) / projectionWidth,
        //     (projectionHeight / 2 - dy) / projectionHeight,
        // ];

    const [x, y] = worldPosition;
    const v4 = new Vector4(x, y, 0, 1.0);

    camera.updateMatrixWorld();     // prevent wrongly update sprites after re-clicking load visualization result

    const { x: cx, y: cy } = v4
        .applyMatrix4(camera.matrixWorldInverse)
        .applyMatrix4(camera.projectionMatrix)
        .divideScalar(v4.w);

    return [cx, cy];
}

export function worldPositionToScreenPosition(worldPosition: [number, number], camera: OrthographicCamera, canvasRect: WebElementRect): [number, number] {
    const [x, y] = worldPositionToClipPosition(worldPosition, camera);
    return [(x + 1) / 2 * canvasRect.width, (-y + 1) / 2 * canvasRect.height];
}

export function isCircleHovered(point: [number, number], cursor: [number, number], rc: VisualizerRenderContext, r: number) {
    const camera = rc.camera;
    if (camera === undefined) return false;

    const [ x1, y1 ] = worldPositionToScreenPosition(point, camera, rc.canvasElement.getBoundingClientRect());
    const [ x2, y2 ] = cursor;
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy < r * r;
}
