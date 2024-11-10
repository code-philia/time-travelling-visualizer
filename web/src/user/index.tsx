import { ConnectionStatus } from "./connection";
import { MessageHandler } from "./message";

export function User() {
    return (
        <>
            <ConnectionStatus />
            <MessageHandler />
        </>
    );
}
