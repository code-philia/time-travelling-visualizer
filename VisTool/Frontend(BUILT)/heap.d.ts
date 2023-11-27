/// <amd-module name="org_tensorflow_tensorboard/tensorboard/projector/heap" />
export declare type HeapItem<T> = {
    key: number;
    value: T;
};
/**
 * Min-heap data structure. Provides O(1) for peek, returning the smallest key.
 */
export declare class MinHeap<T> {
    private arr;
    /** Push an element with the provided key. */
    push(key: number, value: T): void;
    /** Pop the element with the smallest key. */
    pop(): HeapItem<T>;
    /** Returns, but doesn't remove the element with the smallest key */
    peek(): HeapItem<T>;
    /**
     * Pops the element with the smallest key and at the same time
     * adds the newly provided element. This is faster than calling
     * pop() and push() separately.
     */
    popPush(key: number, value: T): HeapItem<T>;
    /** Returns the number of elements in the heap. */
    size(): number;
    /** Returns all the items in the heap. */
    items(): HeapItem<T>[];
    private swap;
    private bubbleDown;
    private bubbleUp;
}
/** List that keeps the K elements with the smallest keys. */
export declare class KMin<T> {
    private k;
    private maxHeap;
    /** Constructs a new k-min data structure with the provided k. */
    constructor(k: number);
    /** Adds an element to the list. */
    add(key: number, value: T): void;
    /** Returns the k items with the smallest keys. */
    getMinKItems(): T[];
    /** Returns the size of the list. */
    getSize(): number;
    /** Returns the largest key in the list. */
    getLargestKey(): number | null;
}
