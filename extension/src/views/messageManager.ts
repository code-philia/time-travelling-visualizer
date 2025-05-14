import { DetailViewMessageManager, TokenViewMessageManager, PlotViewMessageManager, RightViewMessageManager, VisAnalysisViewMessageManager } from "./viewMessageManager";

export class MessageManager { 
    private static tokenViewMessageManager: TokenViewMessageManager;
    private static detailViewMessageManager: DetailViewMessageManager;
    private static plotViewMessageManager: PlotViewMessageManager;
    private static rightViewMessageManager: RightViewMessageManager;
    private static visAnalysisViewMessageManager: VisAnalysisViewMessageManager;

    static initializeView() {
        this.tokenViewMessageManager = new TokenViewMessageManager();
        this.detailViewMessageManager = new DetailViewMessageManager();
        this.rightViewMessageManager = new RightViewMessageManager();
        this.visAnalysisViewMessageManager = new VisAnalysisViewMessageManager();
    }

    static getRightViewMessageManager(): RightViewMessageManager {
        return this.rightViewMessageManager;
    }

    static getTokenViewMessageManager(): TokenViewMessageManager {
        return this.tokenViewMessageManager;
    }

    static getDetailViewMessageManager(): DetailViewMessageManager {
        return this.detailViewMessageManager;
    }

    static getPlotViewMessageManager(): PlotViewMessageManager {
        return this.plotViewMessageManager;
    }

    static getVisAnalysisViewMessageManager(): VisAnalysisViewMessageManager {
        return this.visAnalysisViewMessageManager;
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

    static sendToRightView(msg: any): Promise<boolean> {
        if (!this.rightViewMessageManager) {
            return Promise.resolve(false);
        }
        return this.rightViewMessageManager.postMessage(msg);
    }

    static sendToVisAnalysisView(msg: any): Promise<boolean> {
        if (!this.visAnalysisViewMessageManager) {
            return Promise.resolve(false);
        }
        return this.visAnalysisViewMessageManager.postMessage(msg);
    }
}