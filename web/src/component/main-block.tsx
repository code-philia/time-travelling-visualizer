import { useState, useEffect, useMemo, useRef } from 'react';
import { createPlot2DCanvasContextFrom, Plot2DDataContext } from './canvas/canvas';
import { useDefaultStore } from '../state/store';
import { CommonPointsGeography, extractConnectedPoints, pointsDefaultSize, createEmptyCommonPointsGeography } from './canvas/types';
import { BriefProjectionResult } from '../communication/api';
import { useSetUpProjection, useSwitchEpoch } from '../state/state-actions';
import ChartComponent from './canvas/vchart';

function Timeline({ epoch, epochs, percent, onSwitchEpoch }: { epoch: number, epochs: number[], percent: number, onSwitchEpoch: (epoch: number) => void }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const intervalRef = useRef<any | null>(null);
    const currentEpochIndexRef = useRef<number>(epochs.indexOf(epoch));

    // Set the initial epoch from the passed epochs array
    useEffect(() => {
        if (epochs.length > 0) {
            onSwitchEpoch(epochs[0]);
            currentEpochIndexRef.current = 0;
        }
    }, [epochs]);

    useEffect(() => {
        currentEpochIndexRef.current = epochs.indexOf(epoch);
    }, [epoch]);

    const nodes = useMemo(() => {
        if (epochs.length > 0) {
            return epochs.map((epoch, index) => ({
                value: epoch,
                x: index * 40 + 40,
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
                width: maxX - minX + 40,
                height: maxY - minY,
            };
        } else {
            return {
                width: 0,
                height: 0,
            };
        }
    }, [nodes]);

    // Action for play button
    const togglePlayPause = () => {
        if (isPlaying) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        } else {
            intervalRef.current = setInterval(() => {
                const nextIndex = (currentEpochIndexRef.current + 1) % epochs.length;
                if (nextIndex === 0) {
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                    }
                    setIsPlaying(false);
                } else {
                    onSwitchEpoch(epochs[nextIndex]);
                    currentEpochIndexRef.current = nextIndex;
                }
            }, 1000);
        }
        setIsPlaying(!isPlaying);
    };

    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    return (
        <div style={{ position: 'relative' }}>
            <svg
                width={svgDimensions.width}
                height={svgDimensions.height}
                className="timeline-svg"
            >
                <g transform="translate(20, 0)">
                    {/* Links (lines between nodes) */}
                    {nodes.map((node, index) => {
                        if (index < nodes.length - 1) {
                            const nextNode = nodes[index + 1];
                            const totalLength = epochs.length * 40 + 40;
                            const nextNodeCenterX = nextNode.x + 8;
                            const nextNodeProgress = (nextNodeCenterX / totalLength) * 100;
                            const isLinkLoaded = percent >= nextNodeProgress;
                            return (
                                <line
                                    key={`link-${index}`}
                                    x1={node.x}
                                    y1={node.y}
                                    x2={nextNode.x}
                                    y2={nextNode.y}
                                    stroke={isLinkLoaded ? '#72A8F0' : '#e0e0e0'}
                                    strokeWidth="1"
                                    style={{
                                        transition: 'stroke 0.5s ease-in-out',
                                        strokeLinecap: 'round'
                                    }}
                                />
                            );
                        }
                        return null;
                    })}

                    {/* Nodes */}
                    {nodes.map((node, index) => {
                        const totalLength = epochs.length * 40 + 40;
                        const nodeCenterX = node.x + 8;
                        const nodeProgress = (nodeCenterX / totalLength) * 100;
                        const isLoaded = percent >= nodeProgress;
                        return (
                            <g key={index} transform={`translate(${node.x}, ${node.y})`}>
                                <circle
                                    r="8"
                                    fill={isLoaded ? (node.value === epoch ? '#3278F0' : '#72A8F0') : '#e0e0e0'}
                                    stroke={isLoaded ? (node.value === epoch ? '#3278F0' : '#72A8F0') : '#e0e0e0'}
                                    className="timeline-node"
                                    style={{
                                        transition: 'all 0.5s ease-in-out',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => onSwitchEpoch(node.value)}
                                />
                                <text
                                    x="0"
                                    y="-14"
                                    style={{
                                        fill: isLoaded ? (node.value === epoch ? '#3278F0' : '#72A8F0') : '#e0e0e0',
                                        transition: 'fill 0.5s ease-in-out',
                                        fontSize: '12px',
                                        userSelect: 'none'
                                    }}
                                    textAnchor="middle"
                                >
                                    {node.value}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>

            {/* Play/Pause Button */}
            <button
                onClick={togglePlayPause}
                style={{
                    position: 'absolute',
                    top: '48%',
                    transform: 'translateY(-50%)',
                    backgroundColor: '#3278F0',
                    border: 'none',
                    borderRadius: '30%',
                    width: '25px',
                    height: '25px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '10px',
                    transition: 'background-color 0.3s ease',
                    zIndex: 1,
                }}
            >
                {isPlaying ? '❚❚' : '▶'}
            </button>
        </div>
    );
};

export function MainBlock() {
    const { epoch, setEpoch, availableEpochs, progress }
        = useDefaultStore([
            "epoch",
            "setEpoch",
            "availableEpochs",
            "progress"
        ]);

    // const setUpProjections = useSetUpProjection();
    const switchEpoch = useSwitchEpoch();

    // only consider single container for now
    return (
        <div className="canvas-column">
            <div id="canvas-wrapper" style={{ height: "100%", width: "100%", display: "grid", placeItems: "center" }}>
                <ChartComponent />
            </div>
            <div id="footer">
                <div className="functional-block-title">Epochs</div>
                <div style={{ overflow: "auto" }}>
                    <Timeline epoch={epoch} epochs={availableEpochs} percent={progress} onSwitchEpoch={(epoch) => {
                        switchEpoch(epoch);
                        // setUpProjections(epoch).then(
                        //     () => setEpoch(epoch)
                        // );
                    }} />
                </div>
            </div>
        </div>
    )
}

export function MainBlockCanvas() {
    const { showNumber, showText } = useDefaultStore(['showNumber', 'showText']);

    const { epoch, setEpoch } = useDefaultStore(['epoch', 'setEpoch']);

    const { availableEpochs, allEpochsProjectionData, textData } = useDefaultStore(["contentPath", "updateUUID", "availableEpochs", "allEpochsProjectionData", "updateUUID", "textData"]);

    const setUpProjections = useSetUpProjection();

    useEffect(() => {
        if (availableEpochs.length > 0) {
            setEpoch(availableEpochs[0]);
        }
    }, [availableEpochs, setEpoch]);

    const { colorDict } = useDefaultStore(['colorDict']);

    const { highlightContext } = useDefaultStore(['highlightContext']);

    const { revealNeighborSameType, revealNeighborCrossType, neighborSameType, neighborCrossType } = useDefaultStore(['revealNeighborSameType', 'revealNeighborCrossType', 'neighborSameType', 'neighborCrossType']);

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

    const neighborhood = useMemo(() => {
        return currentEpochData ? extractConnectedPoints(currentEpochData) : undefined;
    }, [currentEpochData]);

    const plot2DCanvasContext = useMemo(() => {
        return createPlot2DCanvasContextFrom(originalPointsGeography);
    }, [originalPointsGeography]);

    const plot2DDataContext = useMemo(() => {
        return new Plot2DDataContext(finalPointsGeography, spriteData);
    }, [finalPointsGeography, spriteData]);

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
            <div id="canvas-wrapper">
                <CanvasContainer
                    plotDataContext={plot2DDataContext}
                    plotCanvasContext={plot2DCanvasContext}
                    neighborRelationship={neighborhood ?? undefined}
                    eventListeners={{ onHoverPoint, onClickPoint }}
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
