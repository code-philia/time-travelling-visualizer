"use strict";
// serve as visualiation API and config
// for engineering config use config.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.Types = exports.StringSelection = void 0;
class StringSelection {
    selections = new Set();
    constructor(...args) {
        args.forEach((arg) => {
            this.selections.add(arg);
        });
    }
    has(arg) {
        return this.selections.has(arg);
    }
}
exports.StringSelection = StringSelection;
class Types {
    static VisualizationDataType = new StringSelection('Image', 'Text');
    static VisualizationTaskType = new StringSelection('Classification', 'Code-Retrieval');
    static VisualizationMethod = new StringSelection('DVI', 'TimeVis', 'DynaVis', 'UMAP');
}
exports.Types = Types;
//# sourceMappingURL=api.js.map