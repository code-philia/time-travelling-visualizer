import { useDefaultStore } from '../state/store';
import { useEffect } from 'react';

const validCommands = [
    'update', 'filterByIndex', 'indexSearchHandler',
    'clearSearchHandler', 'deleteItemfromSel', 'openModal', 'setShowModalFalse', 'saveChanges'
];

export function MessageHandler() {
    const { setValue } = useDefaultStore(['setValue']);

    function handleMessageData(message: any) {
        if (!message) {
            return;
        }
        if (!validCommands.includes(message.command) && message.command != 'sync') {
            console.error('Invalid command:', message.command);
            return;
        }
        for (const key in message) {
            if (key != 'args') {
                setValue(key, message[key]);
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
        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    return <></>
}
