export interface ContainerProps {
    width: number;
    height: number;
}

export interface BoundaryProps {
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
}

export interface ProjectionProps {
    result: number[][];
    grid_index: number[];
    grid_color: string;
    label_name_dict: string[];
    label_color_list: string[];
    label_list: string[];
    maximum_iteration: number;
    training_data: number[];
    testing_data: number[];
    evaluation: number;
    prediction_list: string[];
    selectedPoints: number[];
    properties: number[];
    errorMessage: string;
    color_list: number[][];
    confidence_list: number[];
}

export interface IterationStructure {
    structure: {
        value: number;
        name: string;
        pid: string;
    }[];
}export interface CommonPointsGeography {
    positions: [number, number, number][];
    labels: number[];
    colors: [number, number, number][];
    sizes: number[];
    alphas: number[];
}

