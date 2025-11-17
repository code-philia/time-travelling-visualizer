import { TrainingEvent } from "../component/types";

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

export function notifyEpochSwitch(e: number) {
    const data = { epoch: e };
    const message = {
        command: 'epochSwitch',
        data: data
    };
    window.vscode?.postMessage(message, '*');
}

export function notifyFocusModeSwitch(isFocusMode: boolean, focusIndices: number[] = []) {
    const data = {
        isFocusMode: isFocusMode,
        focusIndices: focusIndices
    };
    const message = {
        command: 'focusModeSwitch',
        data: data
    };
    window.vscode?.postMessage(message, '*');
}

export function notifyTracingInfluence(trainingEvent: TrainingEvent, epoch: number) {
    const message = {
        command: 'tracingInfluence',
        epoch: epoch,
        data: trainingEvent
    };
    window.vscode?.postMessage(message, '*');
}

export function notifyTrainingEventClicked(trainingEvents: TrainingEvent[]) {
    const data = trainingEvents;
    const message = {
        command: 'trainingEventClicked',
        data: data
    };
    window.vscode?.postMessage(message, '*');
}