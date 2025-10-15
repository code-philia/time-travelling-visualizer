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
};

export type SignificantMovementEvent = {
  index: number;
  prevDist: number;
  currDist: number;
  distanceChange: number;
  movementType: 'closer' | 'farther';
  type: 'SignificantMovement';
  data?: string; // image data or text data
};

export type InconsistentMovementEvent = {
  index: number;
  index1: number;
  expectation: "Aligned" | "NotAligned";
  behavior: "Aligned" | "NotAligned";
  type: 'InconsistentMovement';
  data?: string; // image data or text data
  data1?: string; // image data or text data for index1
};

export type TrainingEvent = 
  | PredictionFlipEvent 
  | ConfidenceChangeEvent 
  | SignificantMovementEvent 
  | InconsistentMovementEvent;


/*
 Influence Sample Types
*/
export type SampleWiseInfluence = {
  index: number;
  label: string;
  score: number;
  data?: string;
};

export type PairWiseInfluence = {
  index: number;
  index1: number;
  score: number;
  type: 'positive' | 'negative';
  data?: string;
  data1?: string;
};

export type InfluenceSample = SampleWiseInfluence | PairWiseInfluence;