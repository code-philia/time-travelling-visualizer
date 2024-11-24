type BoundaryProps = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};

type WebElementRect = {
    width: number;
    height: number;
}

export class VisualizerRenderContext {
    boundary: BoundaryProps;
    backgroundColor: string;
    canvasRect: WebElementRect;

    // computed attributes
    aspect: number;
    projectionWidth: number;
    projectionHeight: number;
    centerX: number;
    centerY: number;

    constructor(boundary: BoundaryProps, backgroundColor: string, canvasRect: WebElementRect) {
        this.boundary = boundary;
        this.backgroundColor = backgroundColor;
        this.canvasRect = canvasRect;

        this.aspect = this.canvasRect.width / this.canvasRect.height;

        let w = 0;
        let h = 0;
        const { x1, y1, x2, y2 } = this.boundary;
        if (this.aspect > 1.0) {
            h = y2 - y1;
            w = h * this.aspect;
        } else {
            w = x2 - x1;
            h = w / this.aspect;
        }
        this.projectionWidth = w;
        this.projectionHeight = h;

        this.centerX = (x1 + x2) / 2;
        this.centerY = (y1 + y2) / 2;
    }
}

export type ContextOnlyProps = {
    visualizerRenderContext: VisualizerRenderContext;
}
