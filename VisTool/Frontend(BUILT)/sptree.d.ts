/// <amd-module name="org_tensorflow_tensorboard/tensorboard/projector/sptree" />
export declare type Point = number[];
export interface BBox {
    center: Point;
    halfDim: number;
}
/** A node in a space-partitioning tree. */
export interface SPNode {
    /** The children of this node. */
    children?: SPNode[];
    /** The bounding box of the region this node occupies. */
    box: BBox;
    /** One or more points this node has. */
    point: Point;
}
/**
 * A Space-partitioning tree (https://en.wikipedia.org/wiki/Space_partitioning)
 * that recursively divides the space into regions of equal sizes. This data
 * structure can act both as a Quad tree and an Octree when the data is 2 or
 * 3 dimensional respectively. One usage is in t-SNE in order to do Barnes-Hut
 * approximation.
 */
export declare class SPTree {
    root: SPNode;
    private masks;
    private dim;
    /**
     * Constructs a new tree with the provided data.
     *
     * @param data List of n-dimensional data points.
     * @param capacity Number of data points to store in a single node.
     */
    constructor(data: Point[]);
    /**
     * Visits every node in the tree. Each node can store 1 or more points,
     * depending on the node capacity provided in the constructor.
     *
     * @param accessor Method that takes the currently visited node, and the
     * low and high point of the region that this node occupies. E.g. in 2D,
     * the low and high points will be the lower-left corner and the upper-right
     * corner.
     */
    visit(accessor: (node: SPNode, lowPoint: Point, highPoint: Point) => boolean, noBox?: boolean): void;
    private visitNode;
    private insert;
    private makeChild;
}
