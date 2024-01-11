

interface ComparatorState  {
          currentFocus: any,
          hiddenBackground: boolean | false,
          DVIDataList: any,
          lineGeomertryList: any,
          iteration: number,
          last_iteration: number,
          properties: any,
          highlightedPointIndices: any,
          contraVisHighlightIndices: any,
          predChangeIndices: any,
          confChangeIndices: any,
          isFilter: boolean | false,
          customSelection: any,
          checkboxDom: any,
          isAdjustingSel: boolean | false,
          scene: any,
          renderer: any,
          suggestionIndicates: any,
      
          unLabelData: any,
          testingData: any,
          labeledData: any,
      
          nowShowIndicates: any,
          sceneBackgroundImg: any,
          customMetadata: any,
      
          queryResPointIndices: any,
          alQueryResPointIndices: any,
          previousIndecates: any,
          previousAnormalIndecates: any,
          queryResAnormalIndecates: any,
          queryResAnormalCleanIndecates: any,
          alSuggestionIndicates: any,
          alSuggestLabelList: any,
          alSuggestScoreList: any,
          previousHover: number,
      
          allResPositions: any,
          modelMath: string,
          tSNETotalIter: number,
          taskType: string,
          selectedStack: any,
          ipAddress: string,
   
          treejson: any,
      
          rejectIndicates: any,
          acceptIndicates: any,
      
          acceptInputList: any,
          rejectInputList: any,
          flagindecatesList: any,
          selectedTotalEpoch: number,
          backgroundMesh: any,
          selectedList: any,

          worldSpacePointPositions: any,
          isAnimatating: boolean | false
          
}


// Extend the Window interface to include the comparator state
declare global {
    interface Window {
        comparatorState: { [instanceId: number]: ComparatorState };
        d3:any
    }
}

// Initialize the global state object if it doesn't exist
if (!window.comparatorState) {
    window.comparatorState = {};
}

export function getDVIDataList(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].DVIDataList;
}

export function getAcceptIndicates(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].acceptIndicates;
}

export function getAcceptInputList(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].acceptInputList;
}

export function getAlQueryResPointIndices(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].alQueryResPointIndices;
}

export function getAlSuggestLabelList(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].alSuggestLabelList;
}

export function getAlSuggestScoreList(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].alSuggestScoreList;
}

export function getAlSuggestionIndicates(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].alSuggestionIndicates;
}

export function getAllResPositions(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].allResPositions;
}

export function getBackGroundMesh(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].backgroundMesh;
}

export function getCheckBoxDom(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].checkboxDom;
}

export function getConfChangeIndices(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].confChangeIndices;
}

export function getCurrentFocus(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].currentFocus;
}

export function getCustomMetaData(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].customMetadata;
}

export function getCustomSelection(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].customSelection;
}

// export function getD3(instanceId: number): any {
//     if (!window.comparatorState[instanceId]) {
//         // Initialize with default state if not present
//         window.comparatorState[instanceId] = {} as ComparatorState;
//         console.log("fff")


//     }
//     // console.log("258258")
//     // console.log(instanceId, window.comparatorState[instanceId])
//     return window.comparatorState[instanceId].d3;
// }


export function getFlagindecatesList(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].flagindecatesList;
}

export function getHiddenBackground(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].hiddenBackground;
}

export function getHighlightedPointIndices(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].highlightedPointIndices;
}

export function getIsAdjustingSel(instanceId: number): boolean {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].isAdjustingSel;
}

export function getIsAnimating(instanceId: number): boolean {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].isAnimatating;
}

export function getIsFilter(instanceId: number): boolean {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].isFilter;
}

export function getIteration(instanceId: number): number {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].iteration;
}

export function getLabeledData(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].labeledData;
}

export function getLastIteration(instanceId: number): number {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].last_iteration;
}

export function getLineGeomertryList(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].lineGeomertryList;
}

export function getModelMath(instanceId: number): string {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].modelMath;
}

export function getNowShowIndicates(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].nowShowIndicates;
}

export function getPredChangeIndices(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].predChangeIndices;
}

export function getPreviousAnormalIndecates(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].previousAnormalIndecates;
}

export function getPreviousHover(instanceId: number): number {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].previousHover;
}

export function getProperties(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].properties;
}

export function getPreviousIndecates(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].previousIndecates;
}


export function getQueryResAnormalCleanIndecates(instanceId: number):any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].queryResAnormalCleanIndecates;
}


export function getQueryResAnormalIndecates(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].queryResAnormalIndecates;
}


export function getQueryResPointIndices(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].queryResPointIndices;
}


export function getRejectIndicates(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].rejectIndicates;
}

export function getRejectInputList(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].rejectInputList;
}


export function getRenderer(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].renderer;
}

export function getScene(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].scene;
}

export function getSceneBackgroundImg(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].sceneBackgroundImg;
}

export function getSelectedList(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].selectedList;
}

export function getSelectedStack(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].selectedStack;
}

export function getSelectedTotalEpoch(instanceId: number): number {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].selectedTotalEpoch;
}

export function getSuggestionIndicates(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].suggestionIndicates;
}

export function getTSNETotalIter(instanceId: number): number {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].tSNETotalIter;
}

export function getTaskType(instanceId: number): string {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].taskType;
}

export function getTestingData(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].testingData;
}

export function getTreeJson(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].treejson;
}

export function getUnLabelData(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].unLabelData;
}

export function getWorldSpacePointPositions(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].worldSpacePointPositions;
}

export function getIpAddress(instanceId: number): string {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
        console.log("fff")


    }
    // console.log("258258")
    // console.log(instanceId, window.comparatorState[instanceId])
    return window.comparatorState[instanceId].ipAddress;
}

export function getcontraVisHighlightIndices(instanceId: number): any {
    if (!window.comparatorState[instanceId]) {
        // Initialize with default state if not present
        window.comparatorState[instanceId] = {} as ComparatorState;
    }
    return window.comparatorState[instanceId].contraVisHighlightIndices;
}
// // Define a custom event name
// export const STATE_UPDATED_EVENT = 'stateUpdated';

export function updateStateForInstance(instanceId: number, newState: Partial<ComparatorState>): void {
    if (!window.comparatorState[instanceId]) {
        window.comparatorState[instanceId] = {} as ComparatorState;
    }

    // console.log(`Updating state for instance ${instanceId}`, newState);

    // Merge new state with existing state
    window.comparatorState[instanceId] = { ...window.comparatorState[instanceId], ...newState };

    // console.log(`New state for instance ${instanceId}`, window.comparatorState[instanceId]);

    // // Emit a custom event whenever the state is updated
    // window.dispatchEvent(new CustomEvent(STATE_UPDATED_EVENT, { detail: { instanceId, newState } }));
}

// Function to get the complete session states from sessionStorage
export function getCompleteSessionStates() {
    const storedData = window.sessionStorage.getItem('sessionStates');
    return storedData ? JSON.parse(storedData) : {};
}

// Function to get the current state for a specific instance from sessionStorage
export function getCurrentSessionState(instanceId:number) {
    const sessionStates = getCompleteSessionStates();
    return sessionStates[instanceId] || {};
}

// Function to update the state for a specific instance
export function updateSessionStateForInstance(instanceId:number, newState:any) {
    // Get the complete session states or initialize it if it doesn't exist
    const sessionStates = getCompleteSessionStates();

    // Update the state for the specific instance
    sessionStates[instanceId] = { ...sessionStates[instanceId], ...newState };

    // Serialize and store the updated states back in sessionStorage
    window.sessionStorage.setItem('sessionStates', JSON.stringify(sessionStates));
}