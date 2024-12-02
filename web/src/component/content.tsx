import { useState, useEffect, useRef, useMemo } from 'react'

import { CanvasContainer, Plot2DCanvasContext, Plot2DDataContext } from '../canvas/canvas'
import { useStore } from '../state/store'
import { CommonPointsGeography, extractConnectedPoints, extractRawPointsGeography, extractSpriteData, HighlightContext, UmapPointsNeighborRelationship } from '../canvas/types';
import { SpriteData } from '../canvas/types';

function Timeline({ epoch, epochs, onSwitchEpoch }: { epoch: number, epochs: number[], onSwitchEpoch: (epoch: number) => void }) {
    const [nodes, setNodes] = useState<{ value: number, x: number, y: number }[]>([]);
    const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });

    // Set the initial epoch from the passed epochs array
    useEffect(() => {
        if (epochs.length > 0) {
            onSwitchEpoch(epochs[0]);
        }
    }, [epochs, onSwitchEpoch]);

    // Convert epochs into a list of nodes with x and y positions
    useEffect(() => {
        if (epochs.length > 0) {
            const newNodes = epochs.map((epoch, index) => ({
                value: epoch,
                x: index * 40, // Simple linear positioning (adjust as needed)
                y: 30, // All nodes on the same horizontal line
            }));
            setNodes(newNodes);

            // Calculate the bounds for all elements (nodes and links)
            const minX = Math.min(...newNodes.map(node => node.x)) - 20; // Add padding
            const maxX = Math.max(...newNodes.map(node => node.x)) + 20; // Add padding
            const minY = Math.min(...newNodes.map(node => node.y)) - 35; // Add padding
            const maxY = Math.max(...newNodes.map(node => node.y)) + 35; // Add padding

            // Set the SVG dimensions to fit all nodes
            setSvgDimensions({
                width: maxX - minX,
                height: maxY - minY,
            });
            console.log(maxX - minX, maxY - minY);
        }
    }, [epochs]);

    // Render nodes and links (simple lines between nodes)
    return (
        <svg
            width={svgDimensions.width}
            height={svgDimensions.height}
            // viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
            className="timeLinesvg"
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

export function VisualizationArea() {
    const { epoch, setEpoch, highlightContext } = useStore(['epoch', 'setEpoch', 'highlightContext']);
    const { availableEpochs, allEpochsProjectionData } = useStore(["contentPath", "updateUUID", "availableEpochs", "allEpochsProjectionData"]);
    
    const [canvasContainerTabs, setCanvasContainerTabs] = useState<number[]>([]);

    const [rawPointsGeography, setRawPointsGeography] = useState<CommonPointsGeography | null>(null);
    const [finalPointsGeography, setFinalPointsGeography] = useState<CommonPointsGeography | null>(null);
    const [spriteData, setSpriteData] = useState<SpriteData | null>(null);

    // FIXME move this to new file
    const [neighborhood, setNeighborhood] = useState<UmapPointsNeighborRelationship | null>(null);

    // TODO all shared data are using useStore now. Decouple some of them
    // const highlightContext = useRef(new HighlightContext());
    const [plot2DDataContext, setPlot2DDataContext] = useState<Plot2DDataContext>(new Plot2DDataContext());
    const [plot2DCanvasContext, setPlot2DCanvasContext] = useState<Plot2DCanvasContext>(new Plot2DCanvasContext());

    useEffect(() => {
        if (!canvasContainerTabs.includes(epoch)) {
            setCanvasContainerTabs((prev) => {
                if (!prev.includes(epoch)) {
                    return [...prev, epoch];
                }
                return prev;
            });
        }
    }, [epoch, canvasContainerTabs]);

    useEffect(() => {
        if (!allEpochsProjectionData[epoch]) return;

        const rawPointsGeo = extractRawPointsGeography(allEpochsProjectionData[epoch]);
        setRawPointsGeography(rawPointsGeo);

        const spriteData = extractSpriteData(allEpochsProjectionData[epoch]);
        setSpriteData(spriteData);

        const neighborhood = extractConnectedPoints(allEpochsProjectionData[epoch]);
        setNeighborhood(neighborhood);
      }, [allEpochsProjectionData, epoch]);

    useEffect(() => {
        setFinalPointsGeography(rawPointsGeography);
        if (rawPointsGeography !== null) {
            setPlot2DCanvasContext(new Plot2DCanvasContext(rawPointsGeography));
        }
    }, [rawPointsGeography]);

    useEffect(() => {
        if (finalPointsGeography === null) return;
        setPlot2DDataContext(new Plot2DDataContext(finalPointsGeography, spriteData ?? undefined));
    }, [finalPointsGeography, spriteData]);

    // for immediate update highlight from outside control
    useEffect(() => {
        if (rawPointsGeography === null) return;
        const listener = () => {
            const displayedPoints = highlightContext.tryUpdateHighlight(rawPointsGeography, false);     // TODO can this be moved into the HighlightContext?
            if (displayedPoints) setFinalPointsGeography(displayedPoints);
        };

        listener();
        highlightContext.addSelectedChangedListener(listener);
        return () => {
            highlightContext.removeSelectedChangedListener(listener);
        };
    }, [highlightContext, rawPointsGeography]);

    const onHoverPoint = useMemo(() =>
    ((idx: number | undefined) => {
        if (rawPointsGeography === null) return;

        highlightContext.updateHovered(idx);

        const displayedPoints = highlightContext.tryUpdateHighlight(rawPointsGeography);
        if (displayedPoints) setFinalPointsGeography(displayedPoints);
    }), [highlightContext, rawPointsGeography]);

    const onClickPoint = useMemo(() =>
    ((idx: number) => {
        if (rawPointsGeography === null) return;

        if (highlightContext.lockedIndices.has(idx)) {
            highlightContext.removeLocked(idx);
        } else {
            highlightContext.addLocked(idx);
        }

        const displayedPoints = highlightContext.tryUpdateHighlight(rawPointsGeography);     // TODO can this be moved into the HighlightContext?
        if (displayedPoints) setFinalPointsGeography(displayedPoints);
    }), [highlightContext, rawPointsGeography]);

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
                <div>Epochs</div>
                <div style={{ overflow: "auto" }}>
                    <Timeline epoch={epoch} epochs={availableEpochs} onSwitchEpoch={setEpoch} />
                </div>
            </div>
        </div>
    )
}
