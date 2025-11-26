import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDefaultStore } from '../state/state.unified';
import ChartComponent from './chart';
import { notifyEpochSwitch } from '../communication/extension';

function deepCompareEquals(a: number[], b: number[]) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

function useDeepCompareMemoize(value: number[]) {
    const ref = useRef<number[]>([]);
    if (!deepCompareEquals(value, ref.current)) ref.current = value;
    return ref.current;
}

function Timeline({
    epoch,
    epochs,
    loadedEpochs,
    isLoading,
    onSwitchEpoch
}: {
    epoch: number;
    epochs: number[];
    loadedEpochs: Set<number>;
    isLoading: boolean;
    onSwitchEpoch: (epoch: number) => void;
}) {
    epochs = useDeepCompareMemoize(epochs);

    const [isPlaying, setIsPlaying] = useState(false);
    const intervalRef = useRef<any | null>(null);
    const currentEpochIndexRef = useRef<number>(epochs.indexOf(epoch));

    const nodeOffset = 40;
    const NODE_LINE_HEIGHT = 60;
    const NODE_CENTER_Y = NODE_LINE_HEIGHT / 2;

    useEffect(() => {
        currentEpochIndexRef.current = epochs.indexOf(epoch);
    }, [epochs, epoch]);

    const togglePlayPause = () => {
        // Do not allow playing while loading
        if (isLoading) return;

        if (isPlaying) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
        } else {
            intervalRef.current = setInterval(() => {
                // stop if loading starts
                if (isLoading) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    intervalRef.current = null;
                    setIsPlaying(false);
                    return;
                }

                const nextIndex = (currentEpochIndexRef.current + 1) % epochs.length;
                if (nextIndex === 0) {
                    clearInterval(intervalRef.current!);
                    setIsPlaying(false);
                } else {
                    onSwitchEpoch(epochs[nextIndex]);
                    currentEpochIndexRef.current = nextIndex;
                }
            }, 1000);
        }
        setIsPlaying(!isPlaying);
    };

    const nodes = useMemo(() => epochs.map((e, i) => ({
        value: e,
        x: i * nodeOffset,
        y: NODE_CENTER_Y
    })), [epochs]);

    const svgDimensions = useMemo(() => {
        if (nodes.length === 0) return { width: 0, height: NODE_LINE_HEIGHT };
        const minX = Math.min(...nodes.map(n => n.x)) - 20;
        const maxX = Math.max(...nodes.map(n => n.x)) + 20;
        return { width: maxX - minX + nodeOffset, height: NODE_LINE_HEIGHT };
    }, [nodes]);

    useEffect(() => {
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); }
    }, []);

    return (
        <div style={{ position: 'relative' }}>
            <svg width={svgDimensions.width} height={svgDimensions.height} className="timeline-svg">
                <g transform="translate(20,0)">
                    {/* Links */}
                    {nodes.map((node, index) => {
                        if (index < nodes.length - 1) {
                            const nextNode = nodes[index + 1];
                            const isLinkLoaded = loadedEpochs.has(nextNode.value);
                            return (
                                <line
                                    key={`link-${index}`}
                                    x1={node.x} y1={node.y}
                                    x2={nextNode.x} y2={nextNode.y}
                                    stroke={isLinkLoaded ? '#72A8F0' : '#e0e0e0'}
                                    strokeWidth={1}
                                    style={{ transition: 'stroke 0.3s ease-in-out', strokeLinecap: 'round' }}
                                />
                            );
                        }
                        return null;
                    })}

                    {/* Nodes */}
                    {nodes.map((node, index) => {
                        const isLoaded = loadedEpochs.has(node.value);
                        const isCurrent = node.value === epoch;
                        return (
                            <g key={index} transform={`translate(${node.x}, ${node.y})`}>
                                <circle
                                            r={8}
                                            fill={isLoaded ? (isCurrent ? '#3278F0' : '#72A8F0') : '#e0e0e0'}
                                            stroke={isLoaded ? (isCurrent ? '#3278F0' : '#72A8F0') : '#e0e0e0'}
                                            style={{ transition: 'all 0.3s ease-in-out', cursor: isLoading ? 'not-allowed' : 'pointer' }}
                                            onClick={() => { if (!isLoading) onSwitchEpoch(node.value); }}
                                        />
                                <text
                                    x={0}
                                    y={-14}
                                    textAnchor="middle"
                                    style={{
                                        fill: isLoaded ? (isCurrent ? '#3278F0' : '#72A8F0') : '#e0e0e0',
                                        fontSize: 12,
                                        userSelect: 'none',
                                        transition: 'fill 0.3s ease-in-out'
                                    }}
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
                    width: 25,
                    height: 25,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 10,
                    zIndex: 1
                }}
            >
                {isPlaying ? '❚❚' : '▶'}
            </button>
        </div>
    );
}

export function MainBlock() {
    const { epoch, setEpoch } = useDefaultStore(['epoch', 'setEpoch']);
    const { availableEpochs } = useDefaultStore(['availableEpochs']);
    const { loadedEpochs, isLoading } = useDefaultStore(['loadedEpochs', 'isLoading']);

    return (
        <div className="canvas-column">
            <ChartComponent />
            <div id="footer" style={{ display: 'flex', alignItems: 'center', width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
                <div style={{ position: 'relative' }}>
                    <Timeline
                        epoch={epoch}
                        epochs={availableEpochs}
                        loadedEpochs={loadedEpochs}
                        isLoading={isLoading}
                        onSwitchEpoch={(e) => {
                            setEpoch(e);
                            notifyEpochSwitch(e);
                        }}
                    />
                    {isLoading && (
                        <div style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(255,255,255,0.6)',
                            pointerEvents: 'none'
                        }}>
                            <div style={{ padding: 8, borderRadius: 4, background: 'rgba(50,120,240,0.08)', color: '#3278F0', fontWeight: 600 }}>
                                Loading visualization...
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
