import { ConnectionStatus } from "./connection";
import { MessageHandler } from "./message";
import { ControlPanel } from "./control";
import { Api } from "./api";

export function VisualizationOptions() {
    const useVscode = false
    return (
        <div className="user-column">
            <ConnectionStatus useVscode = {useVscode}/>
            <Api />
            {useVscode ? <MessageHandler /> : <ControlPanel />}
        </div>
    );
}
