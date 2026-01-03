"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageManager = void 0;
class MessageManager {
    static plotViewMessageManager;
    static getPlotViewMessageManager() {
        return this.plotViewMessageManager;
    }
    static setPlotViewMessageManager(_plotViewMessageManager) {
        this.plotViewMessageManager = _plotViewMessageManager;
    }
    static sendToPlotView(msg) {
        if (!this.plotViewMessageManager) {
            return Promise.resolve(false);
        }
        return this.plotViewMessageManager.postMessage(msg);
    }
}
exports.MessageManager = MessageManager;
//# sourceMappingURL=messageManager.js.map