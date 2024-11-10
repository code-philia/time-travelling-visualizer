import { socket } from './socket';
import { useStore } from '../state/store';

const validCommands = [
    'update', 'filterByIndex', 'indexSearchHandler',
    'clearSearchHandler', 'deleteItemfromSel', 'openModal', 'setShowModalFalse', 'saveChanges'
];

export function MessageHandler() {
    const { setValue } = useStore(['setValue']);
    socket.on('message', (message: any) => {
        console.log('Received message:', message);
        if (!message) {
            return;
        }
        if (!validCommands.includes(message.command) && message.command != 'sync') {
            console.error('Invalid command:', message.command);
            return;
        }
        for (const key in message) {
            if (key!='args') {
                setValue(key, message[key]);
            }
        }
    });
    return <></>
}