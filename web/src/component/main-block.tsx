import { useState, useEffect, useMemo } from 'react'
import { PlotContainer, Plot2DCanvasContext, Plot2DDataContext, createPlot2DCanvasContextFrom } from './canvas/canvas'
import { useDefaultStore } from '../state/store'
import { CommonPointsGeography, extractConnectedPoints, pointsDefaultSize, createEmptyCommonPointsGeography } from './canvas/types';
import { BriefProjectionResult } from '../communication/api';
import { useSetUpProjection } from '../state/state-actions';
import ChartComponent from './canvas/vchart';

function Timeline({ epoch, epochs, onSwitchEpoch }: { epoch: number, epochs: number[], onSwitchEpoch: (epoch: number) => void }) {
    // Set the initial epoch from the passed epochs array
    useEffect(() => {
        if (epochs.length > 0) {
            onSwitchEpoch(epochs[0]);
        }
    }, [epochs]);

    const nodes = useMemo(() => {
        if (epochs.length > 0) {
            return epochs.map((epoch, index) => ({
                value: epoch,
                x: index * 40,
                y: 30,
            }));
        }
        return [];
    }, [epochs]);

    // Convert epochs into a list of nodes with x and y positions
    const svgDimensions = useMemo(() => {
        if (nodes.length > 0) {
            // Calculate the bounds for all elements (nodes and links) with padding
            const minX = Math.min(...nodes.map(node => node.x)) - 20;
            const maxX = Math.max(...nodes.map(node => node.x)) + 20;
            const minY = Math.min(...nodes.map(node => node.y)) - 35;
            const maxY = Math.max(...nodes.map(node => node.y)) + 35;

            // Set the SVG dimensions to fit all nodes
            return {
                width: maxX - minX,
                height: maxY - minY,
            }
        } else {
            return {
                width: 0,
                height: 0,
            }
        }
    }, [nodes]);

    // Render nodes and links (simple lines between nodes)
    return (
        <svg
            width={svgDimensions.width}
            height={svgDimensions.height}
            // viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
            className="timeline-svg"
        >
            <g transform="translate(20, 0)">
                {/* Links (lines between nodes) */}
                {nodes.map((node, index) => {
                    if (index < nodes.length - 1) {
                        const nextNode = nodes[index + 1];
                        return (
                            <line
                                key={`link-${index}`}
                                x1={node.x}
                                y1={node.y}
                                x2={nextNode.x}
                                y2={nextNode.y}
                                stroke="#72A8F0"
                                strokeWidth="1"
                            />
                        );
                    }
                    return null;
                })}

                {/* Nodes */}
                {nodes.map((node, index) => (
                    <g key={index} transform={`translate(${node.x}, ${node.y})`}>
                        <circle
                            r="8"
                            fill={node.value === epoch ? '#3278F0' : '#72A8F0'}
                            strokeWidth="1"
                            stroke={node.value === epoch ? '#3278F0' : '#72A8F0'}
                            className="timeline-node"
                            onClick={() => onSwitchEpoch(node.value)}
                        />
                        <text
                            x="0"
                            y="-14"
                            textAnchor="middle"
                            style={{ fill: node.value === epoch ? '#3278F0' : '#72A8F0' }}
                        >
                            {node.value}
                        </text>
                    </g>
                ))}
            </g>
        </svg>
    );
};

export function MainBlock() {
    const { showNumber, showText } = useDefaultStore(['showNumber', 'showText']);

    const { epoch, setEpoch } = useDefaultStore(['epoch', 'setEpoch']);

    const { availableEpochs, allEpochsProjectionData, textData } = useDefaultStore(["contentPath", "updateUUID", "availableEpochs", "allEpochsProjectionData", "updateUUID", "textData"]);

    const setUpProjections = useSetUpProjection();

    useEffect(() => {
        if (availableEpochs.length > 0) {
            setEpoch(availableEpochs[0]);
        }
    }, [availableEpochs, setEpoch]);

    const { colorDict, labelDict } = useDefaultStore(['colorDict', 'labelDict']);

    const { highlightContext } = useDefaultStore(['highlightContext']);

    const { revealNeighborSameType, revealNeighborCrossType, neighborSameType, neighborCrossType } = useDefaultStore(['revealNeighborSameType', 'revealNeighborCrossType', 'neighborSameType', 'neighborCrossType']);

    const { predictionProps, allBackground } = useDefaultStore(['predictionProps', 'allBackground']);

    // TODO all shared data are using useStore now. Decouple some of them
    // const highlightContext = useRef(new HighlightContext());

    // only set a finally computed attribute as state
    const [finalPointsGeography, setFinalPointsGeography] = useState<CommonPointsGeography>(createEmptyCommonPointsGeography());
    const currentEpochData = useMemo(() => allEpochsProjectionData[epoch] as BriefProjectionResult | undefined, [allEpochsProjectionData, epoch]);
    const originalPointsGeography = useMemo(() => {
        const positions: [number, number, number][] = [];
        const labels: number[] = [];
        const sizes: number[] = [];
        const alphas: number[] = [];
        const data = {
            positions, labels, sizes, alphas
        };

        if (!currentEpochData) return data;

        const labelsAsNumber = currentEpochData.labels.map((label) => parseInt(label));
        currentEpochData.proj.forEach((point, i) => {
            positions.push([point[0], point[1], 0]);
            labels.push(labelsAsNumber[i]);
            sizes.push(pointsDefaultSize);
            alphas.push(1.0);
        });

        return data;
    }, [currentEpochData]);

    const appliedColorPointsGeography = useMemo(() => {
        const { positions, labels, sizes, alphas } = originalPointsGeography;
        const colors: [number, number, number][] = [];

        const data = {
            positions, labels, sizes, alphas, colors
        };

        if (!currentEpochData) return data;

        const labelsAsNumber = currentEpochData.labels.map((label) => parseInt(label));
        currentEpochData.proj.forEach((point, i) => {
            const color = colorDict.get(labelsAsNumber[i]);
            if (color === undefined) return;

            colors[i] = ([color[0] / 255, color[1] / 255, color[2] / 255]);
        });

        return data;
    }, [originalPointsGeography, currentEpochData, colorDict]);

    // construct data for vchart
    const vchartData = useMemo(() => {
        const positions: [number, number, number][] = [];
        const labels: number[] = [];
        const colors: [number, number, number][] = [];
        const scale: number[] = [];
        const background: string = allBackground[epoch] ?? "";

        const data = {
            positions, labels, colors, scale, background, neighborSameType, neighborCrossType, predictionProps
        };

        if (!currentEpochData) return data;

        const labelsAsNumber = currentEpochData.labels.map((label) => parseInt(label));
        currentEpochData.proj.forEach((point, i) => {
            positions.push([point[0], point[1], 0]);
            labels.push(labelsAsNumber[i]);
            const color = colorDict.get(labelsAsNumber[i]);
            if (color === undefined) return;
            colors[i] = ([color[0] / 255, color[1] / 255, color[2] / 255]);
        });

        currentEpochData.scale.forEach((v, i) => {
            scale.push(v);
        });

        return data;
    }, [currentEpochData]);

    const spriteData = useMemo(() => {
        const renderedTextData: string[] = [];

        if (showNumber || showText) {
            textData.forEach((text, i) => {
                let renderedText = "";
                if (showNumber) {
                    renderedText += `${i}. `;
                }
                if (showText) {
                    renderedText += text;
                }
                renderedTextData.push(renderedText);
            });
        }

        return {
            labels: renderedTextData
        }
    }, [showNumber, showText, textData]);

    // const neighborhood = useMemo(() => {
    //     return currentEpochData ? extractConnectedPoints(currentEpochData) : undefined;
    // }, [currentEpochData]);

    // const plot2DCanvasContext = useMemo(() => {
    //     return createPlot2DCanvasContextFrom(originalPointsGeography);
    // }, [originalPointsGeography]);

    // const plot2DDataContext = useMemo(() => {
    //     return new Plot2DDataContext(finalPointsGeography, spriteData);
    // }, [finalPointsGeography, spriteData]);

    useEffect(() => {
        // TODO this is data processing (or business) fair, move it to another module, and should be done immediately together with some atomic update operation
        const neighborPoints: number[][][] = [];
        if (revealNeighborSameType) {
            neighborPoints.push(neighborSameType);
        }
        if (revealNeighborCrossType) {
            neighborPoints.push(neighborCrossType);
        }

        const mergedNeighborPoints = neighborPoints.reduce((a, b) => {
            const base = a.length >= b.length ? a : b;
            const guest = a.length >= b.length ? b : a;
            return base.map((v, i) => {
                return [...v, ...(guest[i] ?? [])];
            });
        }, []);

        highlightContext.setNeighborPoints(mergedNeighborPoints);
    }, [revealNeighborSameType, revealNeighborCrossType, highlightContext, neighborSameType, neighborCrossType]);

    // for immediate update highlight from outside control
    useEffect(() => {
        const listener = () => {
            const displayedPoints = highlightContext.tryUpdateHighlight(appliedColorPointsGeography, false);     // TODO can this be moved into the HighlightContext?
            if (displayedPoints) setFinalPointsGeography(displayedPoints);
        };

        listener();
        highlightContext.addHighlightChangedListener(listener);
        return () => {
            highlightContext.removeHighlightChangedListener(listener);
        };
    }, [highlightContext, appliedColorPointsGeography]);

    const onHoverPoint = (idx: number | undefined) => highlightContext.updateHovered(idx);

    const onClickPoint = (idx: number) => {
        if (highlightContext.lockedIndices.has(idx)) {
            highlightContext.removeLocked(idx);
        } else {
            highlightContext.addLocked(idx);
        }
    };

    // only consider single container for now
    return (
        <div className="canvas-column">
            <div id="canvas-wrapper" style={{ height: "100%", width: "100%", display: "grid", placeItems: "center" }}>
                <ChartComponent
                    vchartData={vchartData}
                />
            </div>
            <div id="footer">
                <div className="functional-block-title">Epochs</div>
                <div style={{ overflow: "auto" }}>
                    <Timeline epoch={epoch} epochs={availableEpochs} onSwitchEpoch={(epoch) => {
                        setUpProjections(epoch).then(
                            () => setEpoch(epoch)
                        );
                    }} />
                </div>
            </div>
        </div >
    )
}
