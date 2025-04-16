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