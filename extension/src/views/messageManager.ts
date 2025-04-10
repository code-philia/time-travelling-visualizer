import { DetailViewMessageManager, TokenViewMessageManager, PlotViewMessageManager } from "./viewMessageManager";

export class MessageManager { 
    private static tokenViewMessageManager: TokenViewMessageManager;
    private static detailViewMessageManager: DetailViewMessageManager;
    private static plotViewMessageManager: PlotViewMessageManager;

    static initializeView() {
        this.tokenViewMessageManager = new TokenViewMessageManager();
        this.detailViewMessageManager = new DetailViewMessageManager();
    }

    static getTokenViewMessageManager(): TokenViewMessageManager {
        return this.tokenViewMessageManager;
    }

    static getDetailViewMessageManager(): DetailViewMessageManager {
        return this.detailViewMessageManager;
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

    static sendToTokenView(msg: any): Promise<boolean> {
        if (!this.tokenViewMessageManager) {
            return Promise.resolve(false);
        }
        return this.tokenViewMessageManager.postMessage(msg);
    }

    static sendToDetailView(msg: any): Promise<boolean> {
        if (!this.detailViewMessageManager) {
            return Promise.resolve(false);
        }
        return this.detailViewMessageManager.postMessage(msg);
    }
}