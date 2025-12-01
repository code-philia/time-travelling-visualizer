import { useEffect, useMemo, useRef, useState } from 'react'
import { useDefaultStore } from '../state/state.unified';
import ChartComponent from './chart';
import { notifyEpochSwitch } from '../communication/extension';

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

function Timeline({ epoch, epochs, progress, onSwitchEpoch }: { epoch: number, epochs: number[], progress: number,  onSwitchEpoch: (epoch: number) => void }) {
    epochs = useDeepCompareMemoize(epochs);
    const [isPlaying, setIsPlaying] = useState(false);
    const intervalRef = useRef<any | null>(null);
    const currentEpochIndexRef = useRef<number>(epochs.indexOf(epoch));
    const nodeOffset = 40;
    const NODE_LINE_HEIGHT = 60;
    const NODE_CENTER_Y = NODE_LINE_HEIGHT / 2;

    // Set the initial epoch from the passed epochs array
    useEffect(() => {
        if (epochs.length > 0) {
            onSwitchEpoch( epochs[0]);
            currentEpochIndexRef.current = 0;
        }
    }, [epochs]);

    useEffect(() => {
        currentEpochIndexRef.current = epochs.indexOf(epoch);
    }, [epochs, epoch]);

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

    const nodes = useMemo(() => {
        if (epochs.length > 0) {
            return epochs.map((epoch, index) => ({
                value: epoch,
                x: index * 40 + nodeOffset,
                y: NODE_CENTER_Y,
            }));
        }
        return [];
    }, [epochs]);

    // Convert epochs into a list of nodes with x and y positions
    const svgDimensions = useMemo(() => {
        if (nodes.length > 0) {
            const minX = Math.min(...nodes.map(node => node.x)) - 20;
            const maxX = Math.max(...nodes.map(node => node.x)) + 20;
            return {
                width: maxX - minX + nodeOffset,
                height: NODE_LINE_HEIGHT,
            }
        } else {
            return {
                width: 0,
                height: NODE_LINE_HEIGHT,
            }
        }
    }, [nodes]);

    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    // Render nodes and links (simple lines between nodes)
    return (
        <div style={{ position: 'relative' }}>
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
                        // progress is 0-100, so we map it to the number of nodes
                        const loadedNodeCount = (progress / 100) * nodes.length;
                        const nextNodeIndex = index + 1;
                        const isLinkLoaded = loadedNodeCount >= (nextNodeIndex + 1);
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
                    // progress is 0-100, so we map it to the number of nodes
                    const loadedNodeCount = (progress / 100) * nodes.length;
                    const isLoaded = loadedNodeCount >= (index + 1);

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
                    top: '50%',
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
    const { epoch, setEpoch } = useDefaultStore(['epoch', 'setEpoch']);
    const { availableEpochs } = useDefaultStore(['availableEpochs']);
    const { progress } = useDefaultStore(['progress']);

    // only consider single container for now
    return (
        <div className="canvas-column">
            <ChartComponent/>
            <div id="footer">
                <div style={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
                    <Timeline epoch={epoch} epochs={availableEpochs} progress={ progress} onSwitchEpoch={(e) => {
                        setEpoch(e);
                        notifyEpochSwitch(e);
                    }} />
                </div>
            </div>
        </div >
    )
}
