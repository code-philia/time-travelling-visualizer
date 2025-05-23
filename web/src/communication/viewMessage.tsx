declare global {
    interface Window {
        acquireVsCodeApi(): any;
        vscode: any;
    }
}

const canConnectToVsCode = (window.acquireVsCodeApi as any !== undefined);
if (canConnectToVsCode) {
  window.vscode = window.acquireVsCodeApi();
}

/**
 * Plot View to Extension communication
 */
export function notifyEpochSwitch(e: number) {
    const data = { epoch: e };
    const message = {
        command: 'epochSwitch',
        data: data
    };
    window.vscode?.postMessage(message, '*');
}

export function notifyHoveredIndexSwitch(e: number | undefined) {
    const data = { hoveredIndex: e };
    const message = {
        command: 'hoveredIndexSwitch',
        data: data
    };
    window.vscode?.postMessage(message, '*');
}

export function notifySelectedIndicesSwitch(e: number[]) {
    const data = { selectedIndices: e };
    const message = {
        command: 'selectedIndicesSwitch',
        data: data
    };
    window.vscode?.postMessage(message, '*');
}

export function notifyshownDataSwitch(e: string[]) {
    const data = { shownData: e };
    const message = {
        command: 'shownDataSwitch',
        data: data
    };
    window.vscode?.postMessage(message, '*');
}

export function notifyHighlightDataSwitch(e: string[]) {
    const data = { highlightData: e };
    const message = {
        command: 'highlightDataSwitch',
        data: data
    };
    window.vscode?.postMessage(message, '*');
}

export function notifyComputeMetrics(epoch: number) {
    const data = { epoch: epoch };
    const message = {
        command: 'computeMetrics',
        data: data
    };
    window.vscode?.postMessage(message, '*');
}