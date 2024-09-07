// serve as visualiation API and config
// for engineering config use config.ts

// NOTE only and always import this ES module and api.ts as an entire namespace:
// `import * as config from './config';`
// and always import other modules by each symbol:
// `import {xxx} from './yyy';`

// TODO change this type name to 'params' or not?
export type BasicVisualizationConfig = {
    dataType: string,
	taskType: string,
	contentPath: string,
	visualizationMethod: string,
};

export class StringSelection {
    readonly selections: Set<string> = new Set<string>();
    constructor (...args: string[]) {
        args.forEach((arg) => {
            this.selections.add(arg);
        });
    }
    has(arg: any): arg is string {
        return this.selections.has(arg);
    }
}

export class Types {
    static readonly VisualizationDataType: StringSelection = new StringSelection('Image', 'Text');
    static readonly VisualizationTaskType: StringSelection = new StringSelection('Classification', 'Non-Classification');
    static readonly VisualizationMethod: StringSelection = new StringSelection('TrustVis');
}
