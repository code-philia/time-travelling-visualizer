/**
 * This is a fork of the Karpathy's TSNE.js (original license below).
 * This fork implements Barnes-Hut approximation and runs in O(NlogN)
 * time, as opposed to the Karpathy's O(N^2) version.
 *
 * Please refer to third_party/bh_tsne.LICENSE for the original license.
 *
 * @author smilkov@google.com (Daniel Smilkov)
 */
/// <amd-module name="org_tensorflow_tensorboard/tensorboard/projector/bh_tsne" />
/** Returns the square euclidean distance between two vectors. */
export declare function dist2(a: number[], b: number[]): number;
/** Returns the square euclidean distance between two 2D points. */
export declare function dist2_2D(a: number[], b: number[]): number;
/** Returns the square euclidean distance between two 3D points. */
export declare function dist2_3D(a: number[], b: number[]): number;
export interface TSNEOptions {
    /** How many dimensions. */
    dim: number;
    /** Roughly how many neighbors each point influences. */
    perplexity?: number;
    /** Learning rate. */
    epsilon?: number;
    /** A random number generator. */
    rng?: () => number;
}
export declare class TSNE {
    private perplexity;
    private epsilon;
    private superviseFactor;
    private unlabeledClass;
    private labels;
    private labelCounts;
    /** Random generator */
    private rng;
    private iter;
    private Y;
    private N;
    private P;
    private gains;
    private ystep;
    private nearest;
    private dim;
    private dist2;
    private computeForce;
    constructor(opt: TSNEOptions);
    initDataDist(nearest: {
        index: number;
        dist: number;
    }[][]): void;
    initSolution(): void;
    getDim(): number;
    getSolution(): Float64Array;
    perturb(): void;
    step(): void;
    setSupervision(superviseLabels: string[], superviseInput?: string): void;
    setSuperviseFactor(superviseFactor: number): void;
    costGrad(Y: Float64Array): number[][];
}
