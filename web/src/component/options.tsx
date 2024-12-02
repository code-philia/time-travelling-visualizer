import { ControlPanel } from "./control";
import { MessageHandler } from "../user/message";


export function VisualizationOptions() {
    const useVscode = false;
    return (
        <div className="user-column">
            {/* <ConnectionStatus useVscode={useVscode} /> */}
            {useVscode ? <MessageHandler /> : <ControlPanel />}
        </div>
    );
}
