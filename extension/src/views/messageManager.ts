import { PlotViewMessageManager } from "./viewMessageManager";

export class MessageManager {
    private static plotViewMessageManager: PlotViewMessageManager;

    static getPlotViewMessageManager(): PlotViewMessageManager {
        return this.plotViewMessageManager;
    }

    static setPlotViewMessageManager(_plotViewMessageManager: PlotViewMessageManager) {
        this.plotViewMessageManager = _plotViewMessageManager;
    }

    static sendToPlotView(msg: any): Promise<boolean> {
        if (!this.plotViewMessageManager) {
            return Promise.resolve(false);
        }
        return this.plotViewMessageManager.postMessage(msg);
    }
}