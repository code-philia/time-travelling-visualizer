export type Edge = {
    from: number;
    to: number;
    type: string; // highDim, lowDim
    status: string; // connect, disconnect, maintain
};

export type PredictionFlipEvent = {
  index: number;
  label: string;
  prevPred: string;
  currPred: string;
  prevCorrect: boolean;
  currCorrect: boolean;
  influenceTarget: string;
  type: 'PredictionFlip';
  data?: string; // image data or text data
  dataType?: 'image' | 'text';
};

export type ConfidenceChangeEvent = {
  index: number;
  label: string;
  prevConf: number;
  currConf: number;
  change: number;
  influenceTarget: string;
  type: 'ConfidenceChange';
  data?: string; // image data or text data
  dataType?: 'image' | 'text';
};

export type SignificantMovementEvent = {
  index: number;
  prevDist: number;
  currDist: number;
  distanceChange: number;
  movementType: 'closer' | 'farther';
  type: 'SignificantMovement';
  data?: string; // image data or text data
  dataType?: 'image' | 'text';
};

export type InconsistentMovementEvent = {
  index: number;
  index1: number;
  expectation: "Aligned" | "NotAligned";
  behavior: "Aligned" | "NotAligned";
  type: 'InconsistentMovement';
  data?: string; // image data or text data
  dataType?: 'image' | 'text';
  data1?: string; // image data or text data for index1
  dataType1?: 'image' | 'text';
};

export type TrainingEvent = 
  | PredictionFlipEvent 
  | ConfidenceChangeEvent 
  | SignificantMovementEvent 
  | InconsistentMovementEvent;