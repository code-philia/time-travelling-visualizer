import { useDefaultStore } from '../state/state-store';
import { useEffect } from 'react';
import { BaseMutableGlobalStore } from '../state/types';
import { BUILD_CONSTANTS } from '../constants';

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

const validCommands = [
    'update', 'filterByIndex', 'indexSearchHandler',
    'clearSearchHandler', 'deleteItemfromSel', 'openModal', 'setShowModalFalse', 'saveChanges'
];

export function MessageHandler() {
    const { setValue } = useDefaultStore(['setValue']);
    const { highlightContext, setHoveredIndex } = useDefaultStore(['highlightContext', 'setHoveredIndex']);

    function handleMessageData(message: any) {
        if (!message) {
            return;
        }

        console.log(`${BUILD_CONSTANTS.APP_CONFIG} message received:`, message);

        if (!validCommands.includes(message.command) && message.command != 'sync') {
            console.error('Invalid command:', message.command);
            return;
        }

        if (message.command === 'sync') {
            for (const key in message) {
                // FIXME use message.data to wrap all the keys of attributes
                if (key != 'command') {
                    syncIn(key, message[key], (key, value) => {
                        setValue(key as typeof selectedListeningProperties[number], value);
                        console.log(`ok 4 ${BUILD_CONSTANTS.APP_CONFIG}`);
                        if (key === 'hoveredIndex' && (typeof value === 'number' || typeof value === 'undefined')) {
                            console.log(`${BUILD_CONSTANTS.APP_CONFIG} hoveredIndex changed to`, value);
                            highlightContext.updateHovered(value);  // FIXME flatten highlightContext to plain states and remove it
                        } else {
                            console.log(`error 5 ${BUILD_CONSTANTS.APP_CONFIG}`);
                        }
                    });
                }
            }
        }
    };

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (!message) {
                console.error('Invalid message:', message);
                return;
            }
            handleMessageData(message);
        };
        const updateHoveredIndex = () => {
            setHoveredIndex(highlightContext.hoveredIndex);
        }

        highlightContext.addHighlightChangedListener(updateHoveredIndex);
        window.addEventListener('message', handleMessage);

        return () => {
            highlightContext.removeHighlightChangedListener(updateHoveredIndex);
            window.removeEventListener('message', handleMessage);
        };
    }, [highlightContext]);

    return <></>
}

export const selectedListeningProperties = [
    'textData',
    'attentionData',
    'originalTextData',
    'inherentLabelData',
    'hoveredIndex',
    'contentPath'
] as const satisfies ReadonlyArray<keyof BaseMutableGlobalStore>;

const cachedStates: Partial<Pick<BaseMutableGlobalStore, typeof selectedListeningProperties[number]>> = {};

export function syncIn(key: string, value: any, cb: (key: string, value: any) => void) {
    if (!(selectedListeningProperties.includes(key as any))) {
        console.log(`err 1 ${key} ${BUILD_CONSTANTS.APP_CONFIG}`);
        return;
    }

    const currentValue = cachedStates[key as typeof selectedListeningProperties[number]];
    if (JSON.stringify(currentValue) === JSON.stringify(value)) {
        console.log(`err 2 ${BUILD_CONSTANTS.APP_CONFIG}`);
        return;
    }

    console.log(`ok 3 ${BUILD_CONSTANTS.APP_CONFIG}`);
    cb(key, value);
}

export function syncOut(key: string, value: any) {
    if (!(selectedListeningProperties.includes(key as any))) {
        return;
    }

    const currentValue = cachedStates[key as typeof selectedListeningProperties[number]];
    if (JSON.stringify(currentValue) === JSON.stringify(value)) {
        return;
    }

    console.log(`store['${key}'] ->`, value);
    cachedStates[key as typeof selectedListeningProperties[number]] = value;

    window.vscode?.postMessage({ command: 'sync', [key]: value }, '*');
}

window.vscode?.postMessage({ state: 'load' }, '*');
