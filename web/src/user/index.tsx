import { ConnectionStatus } from "./connection";
import { MessageHandler } from "./message";
import { Control } from "./control";
import { Api } from "./api";
export function User() {
    const useVscode = false
    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <ConnectionStatus useVscode={useVscode} />
            <Api />
            {useVscode ? <MessageHandler /> : <Control />}
        </div>
    );
}
