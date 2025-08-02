import { TokenViewMessageManager, PlotViewMessageManager, RightViewMessageManager, InfluenceViewMessageManager } from "./viewMessageManager";

export class MessageManager { 
    private static tokenViewMessageManager: TokenViewMessageManager;
    private static plotViewMessageManager: PlotViewMessageManager;
    private static rightViewMessageManager: RightViewMessageManager;
    private static influenceViewMessageManager: InfluenceViewMessageManager;

    static initializeView() {
        this.tokenViewMessageManager = new TokenViewMessageManager();
        this.rightViewMessageManager = new RightViewMessageManager();
        this.influenceViewMessageManager = new InfluenceViewMessageManager();
    }

    static getRightViewMessageManager(): RightViewMessageManager {
        return this.rightViewMessageManager;
    }

    static getInfluenceViewMessageManager(): InfluenceViewMessageManager {
        return this.influenceViewMessageManager;
    }

    static getTokenViewMessageManager(): TokenViewMessageManager {
        return this.tokenViewMessageManager;
    }

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

    static sendToTokenView(msg: any): Promise<boolean> {
        if (!this.tokenViewMessageManager) {
            return Promise.resolve(false);
        }
        return this.tokenViewMessageManager.postMessage(msg);
    }

    static sendToRightView(msg: any): Promise<boolean> {
        if (!this.rightViewMessageManager) {
            return Promise.resolve(false);
        }
        return this.rightViewMessageManager.postMessage(msg);
    }

    static sendToInfluenceView(msg: any): Promise<boolean> {
        if (!this.influenceViewMessageManager) {
            return Promise.resolve(false);
        }
        return this.influenceViewMessageManager.postMessage(msg);
    }
}