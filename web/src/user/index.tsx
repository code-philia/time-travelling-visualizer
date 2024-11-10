import { ConnectionStatus } from "./connection";
import { MessageHandler } from "./message";
import { Control } from "./control";

export function User() {
    const useVscode = false
    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <ConnectionStatus useVscode = {useVscode}/>
            {useVscode ? <MessageHandler /> : <Control />}
        </div>
    );
}
