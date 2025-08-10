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
};

export type ConfidenceChangeEvent = {
  index: number;
  label: string;
  prevConf: number;
  currConf: number;
  change: number;
  influenceTarget: string;
  type: 'ConfidenceChange';
};

export type SignificantMovementEvent = {
  index: number;
  prevDist: number;
  currDist: number;
  distanceChange: number;
  movementType: 'closer' | 'farther';
  type: 'SignificantMovement';
};

export type InconsistentMovementEvent = {
  index: number;
  highDimChange: number;
  projectionChange: number;
  type: 'InconsistentMovement';
};

export type TrainingEvent = 
  | PredictionFlipEvent 
  | ConfidenceChangeEvent 
  | SignificantMovementEvent 
  | InconsistentMovementEvent;