import { useState, useEffect } from 'react';

export function hower() {
    const [dataType, setDataType] = useState("Image");
    const [lastHoveredIndex, setLastHoveredIndex] = useState(null);
    const [currLabel, setCurrLabel] = useState('');
    const [indexUpdateLock, setIndexUpdateLock] = useState(undefined);
    // const [isSwitchOn, setIsSwitchOn] = useState(false);
    // const [contentPath, setContentPath] = useState(' ');
    // const [customContentPath, setCustomContentPath] = useState('');
    const [filterIndex, setFilterIndex] = useState('');
    const [currPred, setCurrPred] = useState('');
    const [predictionList, setPredictionList] = useState([]);
    const [labelNameDict, setLabelNameDict] = useState({});
    const [labelList, setLabelList] = useState([]);
    const [confidenceList, setConfidenceList] = useState([]);
    const [curIndex, setCurIndex] = useState(null);
    const [imageSrc, setImageSrc] = useState("");
    const [textContent, setTextContent] = useState("");
    const [confidenceDict, setConfidenceDict] = useState([]);

    useEffect(() => {
        Cookies.set('contentPath', contentPath, { expires: 7 }); // Expires in 7 days
    }, [curIndex]);

    useEffect(() => {
        if (lastHoveredIndex != null) {
            const lock = new Promise<void>((resolve, reject) => {
                getOriginalData(contentPath, lastHoveredIndex, dataType, "", customContentPath, currLabel).then(resolve);
            });
            setIndexUpdateLock(lock);

            const updatedQuery = {
                ...query,
                key: 'index',
                value: lastHoveredIndex
            };
            setQuery(updatedQuery);

            if (isSwitchOn) {
                indexSearch(updatedQuery, isSwitchOn);
            }
        }
    }, [lastHoveredIndex]);


    useEffect(() => {
        const handleCurIndexChange = async (newVal: number | null) => {
            if (newVal === null) return;

            if (indexUpdateLock) {
                await indexUpdateLock;
                setIndexUpdateLock(undefined);
            }

            if (filterIndex !== null && filterIndex !== "" && (!Array.isArray(filterIndex) || filterIndex.length !== 0)) {
                setCurrPred(predictionList[newVal]);
            } else {
                setCurrPred(predictionList[newVal]);
            }

            setCurrLabel(labelNameDict[labelList[newVal]]);
            setConfidenceDict(confidenceList[newVal]);

            const data_point_data = {
                lastHoveredIndex: lastHoveredIndex,
                curr_pred: currPred,
                curr_label: currLabel,
                confidence_dict: confidenceDict,
                dataType: dataType,
                imageSrc: imageSrc,
                textContent: textContent
            };

            sendMessage({
                command: 'updateDataPoint',
                ...data_point_data
            });
        };
        handleCurIndexChange(curIndex);
    }, [curIndex]);

}
