import { useState, useEffect } from 'react';

export function content() {
    const [isSwitchOn, setIsSwitchOn] = useState(false);
    const [query, setQuery] = useState({ key: 'index', value: null, k: null });
    const [customContentPath, setCustomContentPath] = useState('');
    const [contentPath, setContentPath] = useState(' ');
    const [isCanvasLoading, setIsCanvasLoading] = useState(false);
    const [timelineFirstLoaded, setTimelineFirstLoaded] = useState(false);
    const [currEpoch, setCurrEpoch] = useState(1);
    const [taskType, setTaskType] = useState('Classification');
    function filterByIndex() {
        updateProjectionHandler()
    }
    function update() {
        setTimelineFirstLoaded(true)
        setIsCanvasLoading(true)
        console.log("taskType", taskType)
        fetchTimelineData(contentPath, "")
            .catch(error => {
                console.log(error);
            })
            .then(res => {
                if (customContentPath != '') {
                    updateCustomProjection(contentPath, customContentPath, currEpoch, taskType)
                }
                else {
                    console.log(`content: ${contentPath}`)
                    updateProjectionHandler()
                }
            })
    }
    function updateProjectionHandler() {
        if (!timelineFirstLoaded) {
            update();
        } else {
            setIsCanvasLoading(true);
            updateProjection(contentPath, currEpoch, taskType)
        }
    }
    function indexSearchHandler() {
        setIsCanvasLoading(true)
        indexSearch(query, isSwitchOn);
    }
    useEffect(() => {
        Cookies.set('contentPath', contentPath, { expires: 7 });
    }, [contentPath]);

}