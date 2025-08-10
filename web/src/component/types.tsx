export type Edge = {
    from: number;
    to: number;
    type: string; // highDim, lowDim
    status: string; // connect, disconnect, maintain
};