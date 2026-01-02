"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlotViewMessageManager = void 0;
class PlotViewMessageManager {
    static panel;
    constructor(panel) {
        PlotViewMessageManager.panel = panel;
    }
    async postMessage(msg) {
        if (!(PlotViewMessageManager.panel)) {
            return false;
        }
        return await PlotViewMessageManager.panel.webview.postMessage(msg);
    }
}
exports.PlotViewMessageManager = PlotViewMessageManager;
//# sourceMappingURL=viewMessageManager.js.map