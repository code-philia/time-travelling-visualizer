import { useState, useEffect } from 'react';

export function show() {
    const [totalEpoch, setTotalEpoch] = useState(null);
    const [showVisError, setShowVisError] = useState(false);
    const [showPredictionFlips, setShowPredictionFlips] = useState(false);
    const [highlightAttributes, setHighlightAttributes] = useState({ visualizationError: null });
    const [showColorSetting, setShowColorSetting] = useState(false);
    const [predictionFlipIndices, setPredictionFlipIndices] = useState(null);

    useEffect(() => {
        if (showVisError) {
            getHighlightedPoints('visError', '');
            setTimeout(() => {
                updateProjectionHandler();
            }, 1000);
        } else {
            if (highlightAttributes.visualizationError) {
                highlightAttributes.visualizationError.clear();
            }
            setHighlightAttributes(prev => ({ ...prev, visualizationError: null }));
        }
    }, [showVisError]);
    useEffect(() => {
        if (showPredictionFlips) {
            if (currEpoch < totalEpoch) {
                getPredictionFlipIndices('');
                setTimeout(() => {
                    updateProjectionHandler();
                }, 1000);
            } else {
                setPredictionFlipIndices(null);
            }
        }
    }, [showPredictionFlips]);
    useEffect(() => {
        if (taskType === "Non-Classification") {
            setShowColorSetting(true);
        } else {
            setShowColorSetting(false);
        }
    }, [taskType]);

}