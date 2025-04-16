export function convertPropsToPredictions(props: number[][]) {
    const pred: number[] = [];
    const confidence: number[] = [];
    props.forEach((prop) => {
        let predConfidence = getPredConfidence(prop);
        pred.push(predConfidence.pred);
        confidence.push(predConfidence.confidence);
    });
    return { pred: pred, confidence: confidence };
}

export function softmax(arr: number[]): number[] {
    const expValues = arr.map(val => Math.exp(val));
    const sumExpValues = expValues.reduce((acc, val) => acc + val, 0);
    return expValues.map(val => val / sumExpValues);
}

export function getPredConfidence(props: number[]): any {
    let softmaxValues = softmax(props);
    let confidence = Math.max(...softmaxValues);
    let pred = softmaxValues.indexOf(confidence);
    return {
        pred: pred,
        confidence: confidence
    }
}