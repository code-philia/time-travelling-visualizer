export function notifyEpochSwitch(e: number) {
    const data = { epoch: e };
    const message = {
        command: 'epochSwitch',
        data: data
    };
    window.vscode?.postMessage(message, '*');
}