export interface ContainerProps {
    width: number;
    height: number;
}

export interface BoundaryProps {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
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

export interface ItertaionStructure {
    structure: {
        value: number;
        name: string;
        pid: string;
    }[];
}
