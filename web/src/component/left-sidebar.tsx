import { OptionsPanel } from "./options/options-panel";
import { MessageHandler } from "../communication/message";


export function LeftSidebar() {
    const useVscode = false;
    return (
        <div className="user-column">
            {/* <ConnectionStatus useVscode={useVscode} /> */}
            {useVscode ? <MessageHandler /> : <OptionsPanel />}
        </div>
    );
}
