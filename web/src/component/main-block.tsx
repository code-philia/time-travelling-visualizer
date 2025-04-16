import { useEffect, useMemo, useRef } from 'react'
import { useDefaultStore } from '../state/state.plotView';
import ChartComponent from './canvas/vchart';
import { notifyEpochSwitch } from '../communication/viewMessage';

// https://stackoverflow.com/questions/54095994/react-useeffect-comparing-objects
// FIXME use a library for all object/array nested comparison
function deepCompareEquals(a: Array<number>, b: Array<number>){
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }

    return true;
}

function useDeepCompareMemoize(value: Array<number>) {
    const ref = useRef<Array<number>>([]);
    // it can be done by using useMemo as well
    // but useRef is rather cleaner and easier

    if (!deepCompareEquals(value, ref.current)) {
        ref.current = value;
    }

    return ref.current
}

function Timeline({ epoch, epochs, onSwitchEpoch }: { epoch: number, epochs: number[], onSwitchEpoch: (epoch: number) => void }) {
    epochs = useDeepCompareMemoize(epochs);

    // Set the initial epoch from the passed epochs array
    useEffect(() => {
        if (epochs.length > 0) {
            onSwitchEpoch(epochs[0]);
        }
    }, [epochs]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const currentIndex = epochs.indexOf(epoch);
            if (event.key === 'ArrowRight' && currentIndex < epochs.length - 1) {
                onSwitchEpoch(epochs[currentIndex + 1]);
            } else if (event.key === 'ArrowLeft' && currentIndex > 0) {
                onSwitchEpoch(epochs[currentIndex - 1]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [epochs, epoch]);

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
    const { epoch, setEpoch } = useDefaultStore(['epoch', 'setEpoch']);
    const { availableEpochs } = useDefaultStore(['availableEpochs']);

    // only consider single container for now
    return (
        <div className="canvas-column">
            <div id="canvas-wrapper" style={{ height: "100%", width: "100%" }}>
                <ChartComponent/>
            </div>
            <div id="footer">
                <div className="functional-block-title">Epochs</div>
                <div style={{ overflow: "auto" }}>
                    <Timeline epoch={epoch} epochs={availableEpochs} onSwitchEpoch={(e) => {
                        setEpoch(e);
                        notifyEpochSwitch(e);
                    }} />
                </div>
            </div>
        </div >
    )
}
