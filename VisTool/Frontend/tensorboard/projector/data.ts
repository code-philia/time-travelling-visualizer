/* Copyright 2016 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/
import { UMAP } from 'umap-js';

import { TSNE } from './bh_tsne';

import {
  DataProvider,
  EmbeddingInfo,
  parseTensorsFromFloat32Array, ProjectorConfig,
  SpriteMetadata,
  TENSORS_MSG_ID
} from './data-provider';
import { CameraDef } from './scatterPlot';
import * as knn from './knn';
import * as vector from './vector';
import * as logging from './logging';
import * as util from './util';
import { getAcceptIndicates, getHighlightedPointIndices, getIteration, getLabeledData, getModelMath, getNowShowIndicates, getProperties, getRejectIndicates, getSceneBackgroundImg, getTestingData, getUnLabelData, updateSessionStateForInstance, updateStateForInstance } from './globalState';


export type DistanceFunction = (a: vector.Vector, b: vector.Vector) => number;
export type ProjectionComponents3D = [string, string, string];

export interface PointMetadata {
  [key: string]: number | string;
}

export interface DataProto {
  shape: [number, number];
  tensor: number[];
  metadata: {
    columns: Array<{
      name: string;
      stringValues: string[];
      numericValues: number[];
    }>;
    sprite: {
      imageBase64: string;
      singleImageDim: [number, number];
    };
  };
}

/** Statistics for a metadata column. */
export interface ColumnStats {
  name: string;
  isNumeric: boolean;
  tooManyUniqueValues: boolean;
  uniqueEntries?: Array<{
    label: string;
    count: number;
  }>;
  min: number;
  max: number;
}
export interface SpriteAndMetadataInfo {
  stats?: ColumnStats[];
  pointsInfo?: PointMetadata[];
  spriteImage?: HTMLImageElement;
  spriteMetadata?: SpriteMetadata;
}

/** A single collection of points which make up a sequence through space. */
export interface Sequence {
  /** Indices into the DataPoints array in the Data object. */
  pointIndices: number[];
}
export interface DataPoint {
  /** The point in the original space. */
  vector?: Float32Array;
  /*
   * Metadata for each point. Each metadata is a set of key/value pairs
   * where the value can be a string or a number.
   */
  original_vector?: Float32Array;
  mislabel_vector?: boolean;
  color?: string;
  metadata: PointMetadata;
  /** index of the sequence, used for highlighting on click */
  sequenceIndex?: number;
  /** index in the original data source */
  index: number;
  /** This is where the calculated projections space are cached */
  projections: {
    [key: string]: number;
  };
  DVI_projections?: {
    [iteration: number]: [any, any];
  };
  DVI_color?: {
    [iteration: number]: string;
  }
  training_data?: {
    [iteration: number]: boolean | undefined;
  }
  testing_data?: {
    [iteration: number]: boolean | undefined;
  }
  new_selection?: {
    [iteration: number]: boolean | undefined;
  }
  current_training?: boolean;
  current_testing?: boolean;
  prediction?: {
    [iteration: number]: string;
  };
  current_prediction?: string;
  current_wrong_prediction?: boolean;
  current_new_selection?: boolean;
  original_label?: string;
  noisy?: boolean;
  inv_acc?: {
    [iteration: number]: number;
  };
  current_inv_acc?: number;
  uncertainty?: {
    [iteration: number]: number | string;
  };
  diversity?: {
    [iteration: number]: number | string;
  };
  tot?: {
    [iteration: number]: number | string;
  };
  uncertainty_ranking?: {
    [iteration: number]: number;
  };
  current_uncertainty_ranking?: number;
  diversity_ranking?: {
    [iteration: number]: number;
  };
  current_diversity_ranking?: number;
  tot_ranking?: {
    [iteration: number]: number;
  };
  current_tot_ranking?: number;
}
const IS_FIREFOX = navigator.userAgent.toLowerCase().indexOf('firefox') >= 0;
/** Controls whether nearest neighbors computation is done on the GPU or CPU. */
export const TSNE_SAMPLE_SIZE = 500;
export const UMAP_SAMPLE_SIZE = 500;
export const PCA_SAMPLE_SIZE = 50000;
/** Number of dimensions to sample when doing approximate PCA. */
export const PCA_SAMPLE_DIM = 200;
/** Number of pca components to compute. */
const NUM_PCA_COMPONENTS = 10;
/** Id of message box used for umap optimization progress bar. */
const UMAP_MSG_ID = 'umap-optimization';
/**
 * Reserved metadata attributes used for sequence information
 * NOTE: Use "__seq_next__" as "__next__" is deprecated.
 */
const SEQUENCE_METADATA_ATTRS = ['__next__', '__seq_next__'];
function getSequenceNextPointIndex(
  pointMetadata: PointMetadata
): number | null {
  let sequenceAttr = null;
  for (let metadataAttr of SEQUENCE_METADATA_ATTRS) {
    if (metadataAttr in pointMetadata && pointMetadata[metadataAttr] !== '') {
      sequenceAttr = pointMetadata[metadataAttr];
      break;
    }
  }
  if (sequenceAttr == null) {
    return null;
  }
  return +sequenceAttr;
}

/**
 * Test http request
 */
/**
 * Dataset contains a DataPoints array that should be treated as immutable. This
 * acts as a working subset of the original data, with cached properties
 * from computationally expensive operations. Because creating a subset
 * requires normalizing and shifting the vector space, we make a copy of the
 * data so we can still always create new subsets based on the original data.
 */
export class DataSet {
  points: DataPoint[];
  sequences: Sequence[];
  shuffledDataIndices: number[] = [];
  /**
   * This keeps a list of all current projections so you can easily test to see
   * if it's been calculated already.
   */
  projections: {
    [projection: string]: boolean;
  } = {};
  nearest: knn.NearestEntry[][];
  spriteAndMetadataInfo: SpriteAndMetadataInfo;
  fracVariancesExplained: number[];
  tSNEIteration: number = 0;
  tSNEShouldPauseAndCheck = false;
  tSNEShouldPause = false;
  tSNEShouldStop = true;
  tSNEShouldKill = false;
  tSNEJustPause = false;
  tSNETotalIter: number = 0;
  /**
   * This part contains information for DVI visualization
   */
  DVIsubjectModelPath = "";
  DVIResolution = 400;
  DVIServer = window.sessionStorage.ipAddress || 'localhost:5001';
  DVIValidPointNumber: {
    [iteration: number]: number;
  } = [];
  DVICurrentRealDataNumber = 0;
  DVIRealDataNumber: {
    [iteration: number]: number;
  } = [];
  DVIEvaluation: {
    [iteration: number]: any;
  } = [];
  DVIDataList: any = [];
  DVIAvailableIteration: Array<number> = [];
  DVIPredicates: any[] = [];
  is_uncertainty_diversity_tot_exist: {
    [iteration: number]: boolean;
  } = [];
  DVIfilterIndices: number[];
  selectIndices: number[];


  superviseFactor: number;
  superviseLabels: string[];
  superviseInput: string = '';
  dim: [number, number] = [0, 0];
  hasTSNERun: boolean = false;
  private tsne: TSNE;
  hasUmapRun = false;
  private umap: UMAP;
  private instanceId: number;
  private state: any;
  /** Creates a new Dataset */
  constructor(
    points: DataPoint[],
    instanceId: number,
    spriteAndMetadataInfo?: SpriteAndMetadataInfo,

  ) {
    
    this.instanceId = instanceId;
  
    console.log("data.ts", this.instanceId)
    this.points = points;
    this.shuffledDataIndices = util.shuffle(util.range(this.points.length));
    this.sequences = this.computeSequences(points);
    this.dim = [this.points.length, this.points[0].vector.length];
    this.spriteAndMetadataInfo = spriteAndMetadataInfo;
    this.DVIfilterIndices = [];
  }
  private computeSequences(points: DataPoint[]) {
    // Keep a list of indices seen so we don't compute sequences for a given
    // point twice.
    let indicesSeen = new Int8Array(points.length);
    // Compute sequences.
    let indexToSequence: {
      [index: number]: Sequence;
    } = {};
    let sequences: Sequence[] = [];
    for (let i = 0; i < points.length; i++) {
      if (indicesSeen[i]) {
        continue;
      }
      indicesSeen[i] = 1;
      // Ignore points without a sequence attribute.
      let next = getSequenceNextPointIndex(points[i].metadata);
      if (next == null) {
        continue;
      }
      if (next in indexToSequence) {
        let existingSequence = indexToSequence[next];
        // Pushing at the beginning of the array.
        existingSequence.pointIndices.unshift(i);
        indexToSequence[i] = existingSequence;
        continue;
      }
      // The current point is pointing to a new/unseen sequence.
      let newSequence: Sequence = { pointIndices: [] };
      indexToSequence[i] = newSequence;
      sequences.push(newSequence);
      let currentIndex = i;
      while (points[currentIndex]) {
        newSequence.pointIndices.push(currentIndex);
        let next = getSequenceNextPointIndex(points[currentIndex].metadata);
        if (next != null) {
          indicesSeen[next] = 1;
          currentIndex = next;
        } else {
          currentIndex = -1;
        }
      }
    }
    return sequences;
  }
  projectionCanBeRendered(projection: ProjectionType): boolean {
    if (projection !== 'tsne') {
      return true;
    }
    return this.tSNEIteration > 0;
  }
  /**
   * Returns a new subset dataset by copying out data. We make a copy because
   * we have to modify the vectors by normalizing them.
   *
   * @param subset Array of indices of points that we want in the subset.
   *
   * @return A subset of the original dataset.
   */
  getSubset(subset?: number[]): DataSet {
    const pointsSubset =
      subset != null && subset.length > 0
        ? subset.map((i) => this.points[i])
        : this.points;
    let points = pointsSubset.map((dp) => {
      return {
        metadata: dp.metadata,
        index: dp.index,
        vector: dp.vector.slice(),
        projections: {} as {
          [key: string]: number;
        },
      };
    });
    const dp_list: DataPoint[] = [];
    for (let i = 0; i < points.length; i++) {
      const dp: DataPoint = {
        metadata: pointsSubset[i].metadata,
        index: pointsSubset[i].index,
        vector: points[i].vector,
        original_vector: pointsSubset[i].vector,
        projections: points[i].projections,
      };
      dp_list.push(dp);
    }
    return new DataSet(dp_list,this.instanceId,  this.spriteAndMetadataInfo);
  }
  /**
   * Computes the centroid, shifts all points to that centroid,
   * then makes them all unit norm.
   */
  normalize() {
    // Compute the centroid of all data points.
    let centroid = vector.centroid(this.points, (a) => a.vector);
    if (centroid == null) {
      throw Error('centroid should not be null');
    }
    // Shift all points by the centroid and make them unit norm.
    for (let id = 0; id < this.points.length; ++id) {
      let dataPoint = this.points[id];
      dataPoint.vector = vector.sub(dataPoint.vector, centroid);
      if (vector.norm2(dataPoint.vector) > 0) {
        // If we take the unit norm of a vector of all 0s, we get a vector of
        // all NaNs. We prevent that with a guard.
        vector.unit(dataPoint.vector);
      }
    }
  }
  /** Projects the dataset onto a given vector and caches the result. */
  projectLinear(dir: vector.Vector, label: string) {
    this.projections[label] = true;
    this.points.forEach((dataPoint) => {
      dataPoint.projections[label] = vector.dot(dataPoint.vector, dir);
    });
  }
  setDVIFilteredData(pointIndices: number[]) {
    // reset first
    for (let i = 0; i < this.points.length; i++) {
      let dataPoint = this.points[i];
      dataPoint.projections['tsne-0'] = dataPoint.DVI_projections[this.tSNEIteration][0];
      dataPoint.projections['tsne-1'] = dataPoint.DVI_projections[this.tSNEIteration][1];
      dataPoint.projections['tsne-2'] = 0;
    }
    for (let i = 0; i < this.points.length; i++) {
      if (pointIndices?.indexOf(i) == -1 && i < this.DVICurrentRealDataNumber) {
        let dataPoint = this.points[i];
        dataPoint.projections = {};
      }
    }
    this.DVIfilterIndices = pointIndices;
  }




  /** Runs DVI on the data. */
  async projectDVI(
    iteration: number, predicates: { [key: string]: any },
    stepCallback: (iter: number | null, evaluation: any, newSelection: any[], filterIndices: number[], totalIter?: number) => void
  ) {
    // min-x, max-x, min-y, max-y

    // Assuming instanceId is a string that uniquely identifies your Comparator instance

// Update the isAdjustingSel property for this specific instance
    // updateStateForInstance(this.instanceId, { currentFocus: [-1, 1, -1, 1] });

    // window.currentFocus = [-1, 1, -1, 1]
    
    this.projections['tsne'] = true;
    function componentToHex(c: number) {
      const hex = c.toString(16);
      return hex.length == 1 ? "0" + hex : hex;
    }

    function rgbToHex(r: number, g: number, b: number) {
      return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
    }


    this.iterationChangeReset()
    // window.sessionStorage.setItem('acceptIndicates',"")
    // window.sessionStorage.setItem('rejectIndicates',"")
    // updateSessionStateForInstance(this.instanceId, {acceptIndicates:""})
    // updateSessionStateForInstance(this.instanceId, {rejectIndicates:""})
    updateStateForInstance(this.instanceId, {acceptIndicates:[]})
    updateStateForInstance(this.instanceId, {rejectIndicates:[]})


    if (this.DVIAvailableIteration.indexOf(iteration) == -1) {

      let headers = new Headers();
      headers.append('Content-Type', 'application/json');
      headers.append('Accept', 'application/json');
      // await fetch("standalone_projector_config.json", { method: 'GET' })
      //   .then(response => response.json())
      //   .then(data => {
      //     const ip_address = data.DVIServerIP + ":" + data.DVIServerPort;
      //     this.DVIServer = ip_address;

      if (getModelMath(this.instanceId)) {
        this.DVIsubjectModelPath = getModelMath(this.instanceId)
      }
      if (getIteration(this.instanceId)) {
        updateStateForInstance(this.instanceId, {last_iteration: getIteration(this.instanceId)})
        //state.last_iteration = state.iteration
      } else {
        updateStateForInstance(this.instanceId, {last_iteration: 1})
        //state.last_iteration = 1
      }
      updateStateForInstance(this.instanceId, {iteration: iteration})
      //getIteration(this.instanceId) = iteration

      await fetch("http://" + this.DVIServer + "/updateProjection", {
        method: 'POST',
        body: JSON.stringify({
          "path": window.sessionStorage.content_path || this.DVIsubjectModelPath, "iteration": iteration,
          "resolution": this.DVIResolution, "predicates": predicates,
          "username": window.sessionStorage.username,
          "vis_method": window.sessionStorage.vis_method,
          'setting':window.sessionStorage.selectedSetting,
          "content_path": window.sessionStorage.content_path || this.DVIsubjectModelPath,
          "isContraVis": window.sessionStorage.isContraVis,
        }),
        headers: headers,
        mode: 'cors'
      }).then(response => response.json()).then(data => {
        const result = data.result;

        const grid_index = [[data.grid_index[0], data.grid_index[1]], [data.grid_index[2], data.grid_index[3]]];
        const grid_color = [[137, 120, 117], [136, 119, 116], [136, 118, 115], [135, 117, 114]];

        if (!getSceneBackgroundImg(this.instanceId)) {
          updateStateForInstance(this.instanceId, {sceneBackgroundImg:[]})
          // getSceneBackgroundImg(this.instanceId) = []
        }
        

        const newCustomSelection = getSceneBackgroundImg(this.instanceId);

        // Perform the splice operation on the new array
        newCustomSelection[getIteration(this.instanceId)] = data.grid_color
  
        // Update the state with the modified array
        updateStateForInstance(this.instanceId, { sceneBackgroundImg: newCustomSelection });
        // getSceneBackgroundImg(this.instanceId)[getIteration(this.instanceId)] = data.grid_color
       let temp_label_color_list:any = []
       let temp_label_list:any = []
       let k=0
        for(let i = 0 ;i < result.length-1;i++){
        
          if (data.properties[i] === 0 || (window.sessionStorage.selectedSetting !== 'active learning' && window.sessionStorage.selectedSetting !== 'dense al')) {
            
            let color:any = data.label_color_list[k] || [204,204,204]
            let label:any = data.label_list[k] || 'unlabeled'
            temp_label_color_list.push(color)
            temp_label_list.push(label)
            k = k+1
          } else{
            temp_label_color_list.push([204,204,204])
            temp_label_list.push('unlabeled')
          }
          
        }
  
        const label_color_list = temp_label_color_list
        const label_list = temp_label_list;

        const prediction_list = data.prediction_list;

        const background_point_number = grid_index.length;

        const real_data_number = label_color_list.length;
        this.tSNETotalIter = data.maximum_iteration;
        updateStateForInstance(this.instanceId, {tSNETotalIter:data.maximum_iteration})
        // this.state.tSNETotalIter = data.maximum_iteration

        this.tSNEIteration = iteration;
        this.DVIValidPointNumber[iteration] = real_data_number + background_point_number;
        this.DVIAvailableIteration.push(iteration);
        const current_length = this.points.length;

        const training_data = data.training_data;
        const testing_data = data.testing_data;
        const new_selection = data.new_selection;
        const noisy_data = data.noisy_data;
        const original_label_list = data.original_label_list;

        const evaluation = data.evaluation;
        this.DVIEvaluation[iteration] = evaluation;
        const inv_acc = data.inv_acc_list || [];
        if (!getProperties(this.instanceId)) {
          console.log("update")
          updateStateForInstance(this.instanceId, {properties:[]})
          // getProperties(this.instanceId) = []
        }
        const newProperties = getProperties(this.instanceId);

        // Perform the splice operation on the new array
        newProperties[iteration] = data.properties
  
        // Update the state with the modified array
        updateStateForInstance(this.instanceId, { properties: newProperties });

        // getProperties(this.instanceId)[iteration] = data.properties;

        if (!getHighlightedPointIndices(this.instanceId)) {
          updateStateForInstance(this.instanceId, {highlightedPointIndices:[]})
          // getHighlightedPointIndices(this.instanceId) = []
        }
        const newHighlight = getHighlightedPointIndices(this.instanceId);

        // Perform the splice operation on the new array
        newHighlight[iteration] = data.highlightedPointIndices
  
        // Update the state with the modified array
        updateStateForInstance(this.instanceId, { highlightedPointIndices: newHighlight });

        // getHighlightedPointIndices(this.instanceId)[iteration] = data.highlightedPointIndices


        updateStateForInstance(this.instanceId, {unLabelData:[]})
        updateStateForInstance(this.instanceId, {testingData:[]})
        updateStateForInstance(this.instanceId, {labeledData:[]})


        if (!getNowShowIndicates(this.instanceId)) {
          updateStateForInstance(this.instanceId, {nowShowIndicates:[]})
          // getNowShowIndicates(this.instanceId) = []
          for (let i = 0; i < data.properties.length; i++) {
            if (data.properties[i] === 1) {
              const newUn = getUnLabelData(this.instanceId);

              // Perform the splice operation on the new array
              newUn.push(i)
        
              // Update the state with the modified array
              updateStateForInstance(this.instanceId, { unLabelData: newUn });

              // getUnLabelData(this.instanceId).push(i)
            } else if (data.properties[i] === 2) {
              const newUn = getTestingData(this.instanceId);

              // Perform the splice operation on the new array
              newUn.push(i)
        
              // Update the state with the modified array
              updateStateForInstance(this.instanceId, { testingData: newUn });
              // getTestingData(this.instanceId).push(i)
            } else {
              const newUn = getLabeledData(this.instanceId);

              // Perform the splice operation on the new array
              newUn.push(i)
        
              // Update the state with the modified array
              updateStateForInstance(this.instanceId, { labeledData: newUn });
              // this.state.labeledData.push(i)
            }
            const newNow = getNowShowIndicates(this.instanceId);

            // Perform the splice operation on the new array
            newNow.push(i)
      
            // Update the state with the modified array
            updateStateForInstance(this.instanceId, { nowShowIndicates: newNow });

            // getNowShowIndicates(this.instanceId).push(i)
          }
        }


        const filterIndices = data.selectedPoints;
        console.log('real_data_number + background_point_number - current_length',real_data_number + background_point_number - current_length)

        for (let i = 0; i < real_data_number + background_point_number - current_length; i++) {
          const newDataPoint: DataPoint = {
            metadata: { label: "background" },
            index: current_length + i,
            projections: {
              'tsne-0': 0,
              'tsne-1': 0,
              'tsne-2': 0
            },
          };
          this.points.push(newDataPoint);
        }
        for (let i = 0; i < this.points.length; i++) {
          let dataPoint = this.points[i];
          if (dataPoint.DVI_projections == undefined || dataPoint.DVI_color == undefined) {
            dataPoint.DVI_projections = {};
            dataPoint.DVI_color = {};
          }
          if (dataPoint.training_data == undefined || dataPoint.testing_data == undefined) {
            dataPoint.training_data = {};
            dataPoint.testing_data = {};
          }
          if (dataPoint.prediction == undefined) {
            dataPoint.prediction = {};
          }
          if (dataPoint.new_selection == undefined) {
            dataPoint.new_selection = {};
          }
          if (dataPoint.inv_acc == undefined) {
            dataPoint.inv_acc = {};
          }
          if (dataPoint.uncertainty == undefined) {
            dataPoint.uncertainty = {};
          }
          if (dataPoint.uncertainty_ranking == undefined) {
            dataPoint.uncertainty_ranking = {};
          }
          if (dataPoint.diversity == undefined) {
            dataPoint.diversity = {};
          }
          if (dataPoint.diversity_ranking == undefined) {
            dataPoint.diversity_ranking = {};
          }
          if (dataPoint.tot == undefined) {
            dataPoint.tot = {};
          }
          if (dataPoint.tot_ranking == undefined) {
            dataPoint.tot_ranking = {};
          }
        }

        for (let i = 0; i < real_data_number; i++) {
          let dataPoint = this.points[i];
          dataPoint.projections['tsne-0'] = result[i][0];
          dataPoint.projections['tsne-1'] = result[i][1];
          dataPoint.projections['tsne-2'] = 0;
          if (getUnLabelData(this.instanceId)?.length && getUnLabelData(this.instanceId).indexOf(i) !== -1) {
            // label_color_list[i] = [204, 204, 204]
            dataPoint.color = rgbToHex(204, 204, 204);
          } else {
            dataPoint.color = rgbToHex(label_color_list[i][0], label_color_list[i][1], label_color_list[i][2]);
          }


          dataPoint.DVI_projections[iteration] = [result[i][0], result[i][1]];
          dataPoint.DVI_color[iteration] = dataPoint.color;
          dataPoint.training_data[iteration] = false;
          dataPoint.testing_data[iteration] = false;
          dataPoint.current_training = false;
          dataPoint.current_testing = false;
          dataPoint.metadata['label'] = label_list[i];
          dataPoint.prediction[iteration] = prediction_list[i];
          dataPoint.current_prediction = prediction_list[i];
          dataPoint.inv_acc[iteration] = inv_acc[i];
          dataPoint.current_inv_acc = inv_acc[i];
          if (prediction_list[i] == label_list[i]) {
            dataPoint.current_wrong_prediction = false;
          } else {
            dataPoint.current_wrong_prediction = true;
          }
          // dataPoint.new_selection[iteration] = false;
          dataPoint.current_new_selection = false;
          if (original_label_list) {
            dataPoint.original_label = original_label_list[i];
          }

          dataPoint.noisy = false;
        }

        for (let i = 0; i < background_point_number; i++) {
          let dataPoint = this.points[i + real_data_number];
          dataPoint.projections['tsne-0'] = grid_index[i][0];
          dataPoint.projections['tsne-1'] = grid_index[i][1];
          dataPoint.projections['tsne-2'] = 0;
          dataPoint.color = rgbToHex(grid_color[i][0], grid_color[i][1], grid_color[i][2]);
          dataPoint.DVI_projections[iteration] = [grid_index[i][0], grid_index[i][1]];
          dataPoint.DVI_color[iteration] = dataPoint.color;
          dataPoint.training_data[iteration] = undefined;
          dataPoint.testing_data[iteration] = undefined;
          dataPoint.current_training = undefined;
          dataPoint.current_testing = undefined;
          dataPoint.prediction[iteration] = "background";
          dataPoint.current_prediction = "background";
          dataPoint.inv_acc[iteration] = 0;
          dataPoint.current_inv_acc = 0;
          dataPoint.current_new_selection = undefined;
          // dataPoint.new_selection[iteration] = undefined;
          dataPoint.current_wrong_prediction = undefined;
          dataPoint.original_label = "background";
          dataPoint.noisy = undefined;
        }

        for (let i = real_data_number + background_point_number; i < this.points.length; i++) {
          let dataPoint = this.points[i];
          dataPoint.projections = {};
        }

        for (let i = 0; i < training_data.length; i++) {
          const dataIndex = training_data[i];
          let dataPoint = this.points[dataIndex];
          dataPoint.training_data[iteration] = true;
          dataPoint.current_training = true;
        }

        for (let i = 0; i < testing_data.length; i++) {
          const dataIndex = testing_data[i];
          let dataPoint = this.points[dataIndex];
          dataPoint.testing_data[iteration] = true;
          dataPoint.current_testing = true;
        }

        this.DVICurrentRealDataNumber = real_data_number;
        this.DVIRealDataNumber[iteration] = real_data_number;
        this.DVIfilterIndices = [];
        for (let i = 0; i < real_data_number + background_point_number; i++) {
          this.DVIfilterIndices.push(i);
        }
        this.DVIDataList[iteration] = this.points
        updateStateForInstance(this.instanceId, {DVIDataList:this.DVIDataList})
        // this.state.DVIDataList = this.DVIDataList

        stepCallback(this.tSNEIteration, evaluation, new_selection, filterIndices, this.tSNETotalIter);
      }).catch(error => {
        console.log(error);
        logging.setErrorMessage('error');
        stepCallback(null, null, null, null, null);
      });

      // });
    } else {
      const validDataNumber = this.DVIValidPointNumber[iteration];
      const evaluation = this.DVIEvaluation[iteration];
      this.tSNEIteration = iteration;

      updateStateForInstance(this.instanceId, {last_iteration:getIteration(this.instanceId)})
      updateStateForInstance(this.instanceId, {iteration:iteration})
      // this.state.last_iteration = getIteration(this.instanceId)
      // getIteration(this.instanceId) = iteration

      const newSelection = [];
      for (let i = 0; i < validDataNumber; i++) {
        let dataPoint = this.points[i];
        dataPoint.projections['tsne-0'] = dataPoint.DVI_projections[iteration][0];
        dataPoint.projections['tsne-1'] = dataPoint.DVI_projections[iteration][1];
        dataPoint.projections['tsne-2'] = 0;
        dataPoint.color = dataPoint.DVI_color[iteration];
        dataPoint.current_training = dataPoint.training_data[iteration];
        dataPoint.current_testing = dataPoint.testing_data[iteration];
        dataPoint.current_prediction = dataPoint.prediction[iteration];
        dataPoint.current_inv_acc = dataPoint.inv_acc[iteration];
        if (dataPoint.current_prediction == dataPoint.metadata['label'] && dataPoint.metadata['label'] != "background") {
          dataPoint.current_wrong_prediction = false;
        } else {
          if (dataPoint.metadata['label'] != "background") {
            dataPoint.current_wrong_prediction = true;
          } else {
            dataPoint.current_wrong_prediction = undefined;
          }
        }
        // dataPoint.current_new_selection = dataPoint.new_selection[iteration];
        // if (dataPoint.current_new_selection) {
        //   newSelection.push(i);
        // }
        // if (this.is_uncertainty_diversity_tot_exist[iteration]) {
        //   dataPoint.metadata['uncertainty'] = dataPoint.uncertainty[iteration];
        //   dataPoint.metadata['diversity'] = dataPoint.diversity[iteration];
        //   dataPoint.metadata['tot'] = dataPoint.tot[iteration];
        //   dataPoint.current_uncertainty_ranking = dataPoint.uncertainty_ranking[iteration];
        //   dataPoint.current_diversity_ranking = dataPoint.diversity_ranking[iteration];
        //   dataPoint.current_tot_ranking = dataPoint.tot_ranking[iteration];
        // }
      }
      for (let i = validDataNumber; i < this.points.length; i++) {
        let dataPoint = this.points[i];
        dataPoint.projections = {};
        dataPoint.current_testing = false;
        dataPoint.current_training = false;
      }
      // const matches = this.get_match();
      // for (let i = 0; i < validDataNumber; i++) {
      //   let dataPoint = this.points[i];
      //   if (matches.indexOf(i) == -1 && i < this.DVICurrentRealDataNumber) {
      //     dataPoint.projections = {}
      //   }
      // }
      this.DVICurrentRealDataNumber = this.DVIRealDataNumber[iteration];
      this.DVIfilterIndices = [];
      for (let i = 0; i < this.DVICurrentRealDataNumber + Math.pow(this.DVIResolution, 2); i++) {
        this.DVIfilterIndices.push(i);
      }
      let headers = new Headers();
      headers.append('Content-Type', 'application/json');
      headers.append('Accept', 'application/json');
      await fetch(`http://${this.DVIServer}/query`, {
        method: 'POST',
        body: JSON.stringify({
          "predicates": predicates, "content_path": window.sessionStorage.content_path || this.DVIsubjectModelPath,
          "iteration": iteration,"username": window.sessionStorage.username, "vis_method": window.sessionStorage.vis_method,'setting':window.sessionStorage.selectedSetting
        }),
        headers: headers,
        mode: 'cors'
      }).then(response => response.json()).then(data => {
        const indices = data.selectedPoints;
        stepCallback(this.tSNEIteration, evaluation, newSelection, indices, this.tSNETotalIter);
      }).catch(error => {
        logging.setErrorMessage('querying for indices');
        stepCallback(null, null, null, null, null);
      });
    }
  }


  /** Runs DVI on the data. */
  async reTrainByDVI(
    iteration: number, newIndices: number[], rejection: number[],
    stepCallback: (iter: number | null, evaluation: any, newSelection: any[], filterIndices: number[], totalIter?: number) => void
  ) {
    this.projections['tsne'] = true;
    function componentToHex(c: number) {
      const hex = c.toString(16);
      return hex.length == 1 ? "0" + hex : hex;
    }


    this.iterationChangeReset()

    function rgbToHex(r: number, g: number, b: number) {
      return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
    }
    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'application/json');
    // await fetch("standalone_projector_config.json", { method: 'GET' })
    //   .then(response => response.json())
    //   .then(data => {
    //     const ip_address = data.DVIServerIP + ":" + data.DVIServerPort;
    //     this.DVIServer = ip_address;
    if (getModelMath(this.instanceId)) {
      this.DVIsubjectModelPath = getModelMath(this.instanceId)
    }
    let indices = []
    if(getAcceptIndicates(this.instanceId)){
      indices = getAcceptIndicates(this.instanceId).filter((item, i, arr) => {
        //函数自身返回的是一个布尔值，只当返回值为true时，当前元素才会存入新的数组中。            
        return getProperties(this.instanceId)[getIteration(this.instanceId)][item] === 1
      })
    }
    let rejIndices = []
    if(getRejectIndicates(this.instanceId)){
      rejIndices = getRejectIndicates(this.instanceId).filter((item, i, arr) => {
        //函数自身返回的是一个布尔值，只当返回值为true时，当前元素才会存入新的数组中。            
        return getProperties(this.instanceId)[getIteration(this.instanceId)][item] === 1
      })
    }

    let that = this

    await fetch("http://" + this.DVIServer + "/al_train", {
      method: 'POST',
      body: JSON.stringify({
        "iteration": this.tSNEIteration,
        "accIndices": indices,
        "rejIndices": rejIndices,
        "content_path": this.DVIsubjectModelPath,
        "username": window.sessionStorage.username
      }),
      headers: headers,
      mode: 'cors'
    }).then(response => response.json()).then(data => {
      iteration = data.maximum_iteration
      updateStateForInstance(this.instanceId, {acceptIndicates:[]})
      updateStateForInstance(this.instanceId, {rejectIndicates:[]})
      updateSessionStateForInstance(this.instanceId, {acceptIndicates:""})
     
      updateSessionStateForInstance(this.instanceId, {rejectIndicates:""})
   
      // this.state.acceptIndicates = []
      // this.state.rejectIndicates = []
      // window.sessionStorage.setItem('acceptIndicates', "")
      // window.sessionStorage.setItem('rejectIndicates', "")
  
      updateStateForInstance(this.instanceId, {last_iteration:iteration})
      updateStateForInstance(this.instanceId, {iteration:iteration})
      // this.state.last_iteration = getIteration(this.instanceId)
      // getIteration(this.instanceId) = iteration
      const result = data.result;
      const grid_index = [[data.grid_index[0], data.grid_index[1]], [data.grid_index[2], data.grid_index[3]]];
      const grid_color = [[137, 120, 117], [136, 119, 116], [136, 118, 115], [135, 117, 114]];
      const newUn = getSceneBackgroundImg(this.instanceId);

      // Perform the splice operation on the new array
      newUn[getIteration(this.instanceId)] = data.grid_color

      // Update the state with the modified array
      updateStateForInstance(this.instanceId, { sceneBackgroundImg: newUn });
      // getSceneBackgroundImg(this.instanceId)[getIteration(this.instanceId)] = data.grid_color
      let k = 0;
      let temp_label_color_list:any = []
      let temp_label_list:any = []
      for(let i = 0 ;i < result.length-1;i++){
        
        if (data.properties[i] === 0) {
          let color:any = data.label_color_list[k] || [204,204,204]
          let label:any = data.label_list[k] || 'unlabeled'
          temp_label_color_list.push(color)
          temp_label_list.push(label)
          k + k+1
        } else{
          temp_label_color_list.push([204,204,204])
          temp_label_list.push('unlabeled')
        }  
        
      }

      const label_color_list = temp_label_color_list
      const label_list = temp_label_list;
      console.log('label_color_list.length',label_color_list.length)
      const prediction_list = data.prediction_list;

      const background_point_number = grid_index.length;

      const real_data_number = label_color_list.length;
      this.tSNETotalIter = data.maximum_iteration;
      updateStateForInstance(this.instanceId, {tSNETotalIter:data.maximum_iteration})
      // this.state.tSNETotalIter = data.maximum_iteration;

      this.tSNEIteration = iteration;
      this.DVIValidPointNumber[iteration] = real_data_number + background_point_number;
      this.DVIAvailableIteration.push(iteration);
      const current_length = this.points.length;

      const training_data = data.training_data;
      const testing_data = data.testing_data;
      const new_selection = data.new_selection;
      const noisy_data = data.noisy_data;
      const original_label_list = data.original_label_list;

      const evaluation = data.evaluation;
      this.DVIEvaluation[iteration] = evaluation;
      const inv_acc = data.inv_acc_list || [];

      if (!getProperties(this.instanceId)) {
        updateStateForInstance(this.instanceId, {properties:[]})
        // getProperties(this.instanceId) = []
      }
      const newPro = getProperties(this.instanceId);

      // Perform the splice operation on the new array
      newPro[iteration] = data.properties

      // Update the state with the modified array
      updateStateForInstance(this.instanceId, { properties: newPro });

      // getProperties(this.instanceId)[iteration] = data.properties;
      updateStateForInstance(this.instanceId, {unLabelData:[]})
      updateStateForInstance(this.instanceId, {testingData:[]})
      updateStateForInstance(this.instanceId, {labeledData:[]})
      // getUnLabelData(this.instanceId) = []
      // getTestingData(this.instanceId) = []
      // this.state.labeledData = []
      if (!getNowShowIndicates(this.instanceId)) {
        updateStateForInstance(this.instanceId, {nowShowIndicates:[]})
        // getNowShowIndicates(this.instanceId) = []

        for (let i = 0; i < data.properties.length; i++) {
          if (data.properties[i] === 1) {
            const newUn = getUnLabelData(this.instanceId);

            // Perform the splice operation on the new array
            newUn.push(i)
      
            // Update the state with the modified array
            updateStateForInstance(this.instanceId, { unLabelData: newUn });
            // getUnLabelData(this.instanceId).push(i)
          } else if (data.properties[i] === 2) {
            const newUn = getTestingData(this.instanceId);

            // Perform the splice operation on the new array
            newUn.push(i)
      
            // Update the state with the modified array
            updateStateForInstance(this.instanceId, { testingData: newUn });
            // getTestingData(this.instanceId).push(i)
          } else {
            const newUn = getLabeledData(this.instanceId);

            // Perform the splice operation on the new array
            newUn.push(i)
      
            // Update the state with the modified array
            updateStateForInstance(this.instanceId, { labeledData: newUn });
            // this.state.labeledData.push(i)
          }
          const newNow = getNowShowIndicates(this.instanceId);

          // Perform the splice operation on the new array
          newNow.push(i)
    
          // Update the state with the modified array
          updateStateForInstance(this.instanceId, { nowShowIndicates: newNow });
          // getNowShowIndicates(this.instanceId).push(i)
        }
      }

      // const is_uncertainty_diversity_tot_exist = data.uncertainty_diversity_tot?.is_exist;
      // this.is_uncertainty_diversity_tot_exist[iteration] = is_uncertainty_diversity_tot_exist;

      const filterIndices = data.selectedPoints;


      for (let i = 0; i < real_data_number + background_point_number - current_length; i++) {
        const newDataPoint: DataPoint = {
          metadata: { label: "background" },
          index: current_length + i,
          projections: {
            'tsne-0': 0,
            'tsne-1': 0,
            'tsne-2': 0
          },
        };
        this.points.push(newDataPoint);
      }
      for (let i = 0; i < this.points.length; i++) {
        let dataPoint = this.points[i];
        if (dataPoint.DVI_projections == undefined || dataPoint.DVI_color == undefined) {
          dataPoint.DVI_projections = {};
          dataPoint.DVI_color = {};
        }
        if (dataPoint.training_data == undefined || dataPoint.testing_data == undefined) {
          dataPoint.training_data = {};
          dataPoint.testing_data = {};
        }
        if (dataPoint.prediction == undefined) {
          dataPoint.prediction = {};
        }
        if (dataPoint.new_selection == undefined) {
          dataPoint.new_selection = {};
        }
        if (dataPoint.inv_acc == undefined) {
          dataPoint.inv_acc = {};
        }
        if (dataPoint.uncertainty == undefined) {
          dataPoint.uncertainty = {};
        }
        if (dataPoint.uncertainty_ranking == undefined) {
          dataPoint.uncertainty_ranking = {};
        }
        if (dataPoint.diversity == undefined) {
          dataPoint.diversity = {};
        }
        if (dataPoint.diversity_ranking == undefined) {
          dataPoint.diversity_ranking = {};
        }
        if (dataPoint.tot == undefined) {
          dataPoint.tot = {};
        }
        if (dataPoint.tot_ranking == undefined) {
          dataPoint.tot_ranking = {};
        }
      }

      for (let i = 0; i < real_data_number; i++) {
        let dataPoint = this.points[i];
        dataPoint.projections['tsne-0'] = result[i][0];
        dataPoint.projections['tsne-1'] = result[i][1];
        dataPoint.projections['tsne-2'] = 0;
        dataPoint.color = rgbToHex(label_color_list[i][0], label_color_list[i][1], label_color_list[i][2]);
        dataPoint.DVI_projections[iteration] = [result[i][0], result[i][1]];
        dataPoint.DVI_color[iteration] = dataPoint.color;
        dataPoint.training_data[iteration] = false;
        dataPoint.testing_data[iteration] = false;
        dataPoint.current_training = false;
        dataPoint.current_testing = false;
        dataPoint.metadata['label'] = label_list[i];
        dataPoint.prediction[iteration] = prediction_list[i];
        dataPoint.current_prediction = prediction_list[i];
        dataPoint.inv_acc[iteration] = inv_acc[i];
        dataPoint.current_inv_acc = inv_acc[i];
        if (prediction_list[i] == label_list[i]) {
          dataPoint.current_wrong_prediction = false;
        } else {
          dataPoint.current_wrong_prediction = true;
        }
        // dataPoint.new_selection[iteration] = false;
        dataPoint.current_new_selection = false;
        if (original_label_list) {
          dataPoint.original_label = original_label_list[i];
        }
        dataPoint.noisy = false;
        // if (is_uncertainty_diversity_tot_exist) {
        //   dataPoint.metadata['uncertainty'] = data.uncertainty_diversity_tot.uncertainty[i];
        //   dataPoint.uncertainty[iteration] = dataPoint.metadata['uncertainty'];
        //   dataPoint.metadata['diversity'] = data.uncertainty_diversity_tot.diversity[i];
        //   dataPoint.diversity[iteration] = dataPoint.metadata['diversity'];
        //   dataPoint.metadata['tot'] = data.uncertainty_diversity_tot.tot[i];
        //   dataPoint.tot[iteration] = dataPoint.metadata['tot'];
        //   dataPoint.uncertainty_ranking[iteration] = data.uncertainty_diversity_tot.uncertainty_ranking[i];
        //   dataPoint.current_uncertainty_ranking = data.uncertainty_diversity_tot.uncertainty_ranking[i];
        //   dataPoint.diversity_ranking[iteration] = data.uncertainty_diversity_tot.diversity_ranking[i];
        //   dataPoint.current_diversity_ranking = data.uncertainty_diversity_tot.diversity_ranking[i];
        //   dataPoint.tot_ranking[iteration] = data.uncertainty_diversity_tot.tot_ranking[i];
        //   dataPoint.current_tot_ranking = data.uncertainty_diversity_tot.tot_ranking[i];
        // }
      }

      for (let i = 0; i < background_point_number; i++) {
        let dataPoint = this.points[i + real_data_number];
        dataPoint.projections['tsne-0'] = grid_index[i][0];
        dataPoint.projections['tsne-1'] = grid_index[i][1];
        dataPoint.projections['tsne-2'] = 0;
        dataPoint.color = rgbToHex(grid_color[i][0], grid_color[i][1], grid_color[i][2]);
        dataPoint.DVI_projections[iteration] = [grid_index[i][0], grid_index[i][1]];
        dataPoint.DVI_color[iteration] = dataPoint.color;
        dataPoint.training_data[iteration] = undefined;
        dataPoint.testing_data[iteration] = undefined;
        dataPoint.current_training = undefined;
        dataPoint.current_testing = undefined;
        dataPoint.prediction[iteration] = "background";
        dataPoint.current_prediction = "background";
        dataPoint.inv_acc[iteration] = 0;
        dataPoint.current_inv_acc = 0;
        dataPoint.current_new_selection = undefined;
        // dataPoint.new_selection[iteration] = undefined;
        dataPoint.current_wrong_prediction = undefined;
        dataPoint.original_label = "background";
        dataPoint.noisy = undefined;
        // if (is_uncertainty_diversity_tot_exist) {
        //   dataPoint.metadata['uncertainty'] = -1;
        //   dataPoint.uncertainty[iteration] = -1;
        //   dataPoint.metadata['diversity'] = -1;
        //   dataPoint.diversity[iteration] = -1;
        //   dataPoint.metadata['tot'] = -1;
        //   dataPoint.tot[iteration] = -1;
        //   dataPoint.uncertainty_ranking[iteration] = -1;
        //   dataPoint.current_uncertainty_ranking = -1;
        //   dataPoint.diversity_ranking[iteration] = -1;
        //   dataPoint.current_diversity_ranking = -1;
        //   dataPoint.tot_ranking[iteration] = -1;
        //   dataPoint.current_tot_ranking = -1;
        // }
      }

      for (let i = real_data_number + background_point_number; i < this.points.length; i++) {
        let dataPoint = this.points[i];
        dataPoint.projections = {};
      }

      for (let i = 0; i < training_data.length; i++) {
        const dataIndex = training_data[i];
        let dataPoint = this.points[dataIndex];
        dataPoint.training_data[iteration] = true;
        dataPoint.current_training = true;
      }

      for (let i = 0; i < testing_data.length; i++) {
        const dataIndex = testing_data[i];
        let dataPoint = this.points[dataIndex];
        dataPoint.testing_data[iteration] = true;
        dataPoint.current_testing = true;
      }

      // for (let i = 0; i < new_selection.length; i++) {
      //   const dataIndex = new_selection[i];
      //   let dataPoint = this.points[dataIndex];
      //   dataPoint.new_selection[iteration] = true;
      //   dataPoint.current_new_selection = true;
      // }

      // for (let i = 0; i < noisy_data?.length; i++) {
      //   const dataIndex = noisy_data[i];
      //   let dataPoint = this.points[dataIndex];
      //   dataPoint.noisy = true;
      // }

      // const matches = this.get_match();
      //
      // for (let i = 0; i < real_data_number; i++) {
      //   let dataPoint = this.points[i];
      //   if (indices.indexOf(i) == -1 && i < this.DVICurrentRealDataNumber) {
      //     dataPoint.projections = {}
      //   }
      // }

      this.DVICurrentRealDataNumber = real_data_number;
      this.DVIRealDataNumber[iteration] = real_data_number;
      this.DVIfilterIndices = [];
      for (let i = 0; i < real_data_number + background_point_number; i++) {
        this.DVIfilterIndices.push(i);
      }
      this.DVIDataList[iteration] = this.points
      if (this.DVIDataList[iteration] && this.DVIDataList[iteration].length && this.DVIDataList.lenght > iteration) {
        for (let i = this.DVIDataList.length + 1; i > iteration; i--) {
          this.DVIDataList[i] = this.DVIDataList[i - 1]
        }
      }
      updateStateForInstance(this.instanceId, {DVIDataList:this.DVIDataList})
      // this.state.DVIDataList = this.DVIDataList
      stepCallback(this.tSNEIteration, evaluation, new_selection, filterIndices, this.tSNETotalIter);
    }).catch(error => {
      logging.setErrorMessage('Error');
      console.log(error);
      stepCallback(null, null, null, null, null);
    });

    // });

  }

  async getSpriteImage(id: any, stepCallback: (imgData: any) => void) {
    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'application/json');
    if (getModelMath(this.instanceId)) {
      this.DVIsubjectModelPath = getModelMath(this.instanceId)
    }
    // const msgId = logging.setModalMessage('Fetching sprite image...');
    // await fetch("standalone_projector_config.json", { method: 'GET' })
    // .then(response => response.json())
    // .then(data => {  this.DVIsubjectModelPath = data.DVIsubjectModelPath })

    await fetch(`http://${this.DVIServer}/sprite?index=${id}&path=${this.DVIsubjectModelPath}&username=${window.sessionStorage.username}`, {
      method: 'GET',
      mode: 'cors'
    }).then(response => response.json()).then(data => {
      // logging.setModalMessage(null, msgId);
      stepCallback(data);
    }).catch(error => {
      // logging.setModalMessage(null, msgId);
      console.log("error", error);
    });
  }



  iterationChangeReset() {
    updateStateForInstance(this.instanceId,{alQueryResPointIndices:[]})
    updateStateForInstance(this.instanceId,{queryResPointIndices:[]})

    updateStateForInstance(this.instanceId,{previousIndecates:[]})
    updateStateForInstance(this.instanceId,{alSuggestionIndicates:[]})
    updateStateForInstance(this.instanceId,{alSuggestLabelList:[]})
    updateStateForInstance(this.instanceId,{alSuggestScoreList:[]})
    updateStateForInstance(this.instanceId,{customSelection:[]})
    updateStateForInstance(this.instanceId,{flagindecatesList:[]})
    // this.state.alQueryResPointIndices = []
    // this.state.queryResPointIndices = []
    // this.state.previousIndecates = []

    // this.state.alSuggestionIndicates = []
    // this.state.alSuggestLabelList = []
    // this.state.alSuggestScoreList = []
    // this.state.customSelection = []
    // this.state.flagindecatesList = []
  }



  setSupervision(superviseColumn: string, superviseInput?: string) {
    if (superviseColumn != null) {
      this.superviseLabels = this.shuffledDataIndices
        .slice(0, TSNE_SAMPLE_SIZE)
        .map((index) =>
          this.points[index].metadata[superviseColumn] !== undefined
            ? String(this.points[index].metadata[superviseColumn])
            : `Unknown #${index}`
        );
    }
    if (superviseInput != null) {
      this.superviseInput = superviseInput;
    }
    if (this.tsne) {
      this.tsne.setSupervision(this.superviseLabels, this.superviseInput);
    }
  }
  setSuperviseFactor(superviseFactor: number) {
    if (superviseFactor != null) {
      this.superviseFactor = superviseFactor;
      if (this.tsne) {
        this.tsne.setSuperviseFactor(superviseFactor);
      }
    }
  }
  /**
   * Merges metadata to the dataset and returns whether it succeeded.
   */
  mergeMetadata(metadata: SpriteAndMetadataInfo): boolean {
    if (metadata.pointsInfo.length !== this.points.length) {
      let errorMessage =
        `Number of tensors (${this.points.length}) do not` +
        ` match the number of lines in metadata` +
        ` (${metadata.pointsInfo.length}).`;
      if (
        metadata.stats.length === 1 &&
        this.points.length + 1 === metadata.pointsInfo.length
      ) {
        // If there is only one column of metadata and the number of points is
        // exactly one less than the number of metadata lines, this is due to an
        // unnecessary header line in the metadata and we can show a meaningful
        // error.
        logging.setErrorMessage(
          errorMessage +
          ' Single column metadata should not have a header ' +
          'row.',
          'merging metadata'
        );
        return false;
      } else if (
        metadata.stats.length > 1 &&
        this.points.length - 1 === metadata.pointsInfo.length
      ) {
        // If there are multiple columns of metadata and the number of points is
        // exactly one greater than the number of lines in the metadata, this
        // means there is a missing metadata header.
        logging.setErrorMessage(
          errorMessage +
          ' Multi-column metadata should have a header ' +
          'row with column labels.',
          'merging metadata'
        );
        return false;
      }
      logging.setWarningMessage(errorMessage);
    }
    this.spriteAndMetadataInfo = metadata;
    metadata.pointsInfo
      .slice(0, this.points.length)
      .forEach((m, i) => (this.points[i].metadata = m));
    return true;
  }
  stopTSNE() {
    this.tSNEShouldStop = true;
  }
  /**
   * Finds the nearest neighbors of the query point using a
   * user-specified distance metric.
   */
  findNeighbors(
    pointIndex: number,
    distFunc: DistanceFunction,
    numNN: number
  ): knn.NearestEntry[] {
    // Find the nearest neighbors of a particular point.
    let neighbors = knn.findKNNofPoint(
      this.points,
      pointIndex,
      numNN,
      (d) => d.vector,
      distFunc
    );
    // TODO(@dsmilkov): Figure out why we slice.
    let result = neighbors.slice(0, numNN);
    return result;
  }
  /**
   * Search the dataset based on a metadata field and save all the predicates.
   */
  query(query: string, inRegexMode: boolean, fieldName: string): [any, number[]] {
    let predicate = util.getSearchPredicate(query, inRegexMode, fieldName);
    let matches: number[] = [];
    this.points.forEach((point, id) => {
      let result = true;
      for (let i = 0; i < this.DVIPredicates.length; i++) {
        const current_predicate = this.DVIPredicates[i];
        if (!current_predicate(point)) {
          result = false;
          break;
        }
      }
      if (result && predicate(point)) {
        matches.push(id);
      }
    });
    return [predicate, matches];
  }
  get_match() {
    let matches: number[] = [];
    this.points.forEach((point, id) => {
      let result = true;
      for (let i = 0; i < this.DVIPredicates.length; i++) {
        const current_predicate = this.DVIPredicates[i];
        if (!current_predicate(point)) {
          result = false;
          break;
        }
      }
      if (result) {
        matches.push(id);
      }
    });
    return matches;
  }
}
export type ProjectionType = 'tsne' | 'umap' | 'pca' | 'custom';
export class Projection {
  constructor(
    public projectionType: ProjectionType,
    public projectionComponents: ProjectionComponents3D,
    public dimensionality: number,
    public dataSet: DataSet
  ) { }
}
export interface ColorOption {
  name: string;
  desc?: string;
  map?: (value: string | number) => string;
  /** List of items for the color map. Defined only for categorical map. */
  items?: {
    label: string;
    count: number;
  }[];
  /** Threshold values and their colors. Defined for gradient color map. */
  thresholds?: {
    value: number;
    color: string;
  }[];
  isSeparator?: boolean;
  tooManyUniqueValues?: boolean;
}
/**
 * An interface that holds all the data for serializing the current state of
 * the world.
 */
export class State {
  /** A label identifying this state. */
  label: string = '';
  /** Whether this State is selected in the bookmarks pane. */
  isSelected: boolean = false;
  /** The selected projection tab. */
  selectedProjection: ProjectionType;
  /** Dimensions of the DataSet. */
  dataSetDimensions: [number, number];
  /** t-SNE parameters */
  tSNEIteration: number = 0;
  tSNEPerplexity: number = 0;
  tSNELearningRate: number = 0;
  tSNEis3d: boolean = true;
  /** UMAP parameters */
  umapIs3d: boolean = true;
  umapNeighbors: number = 15;
  /** PCA projection component dimensions */
  pcaComponentDimensions: number[] = [];
  /** Custom projection parameters */
  customSelectedSearchByMetadataOption: string;
  customXLeftText: string;
  customXLeftRegex: boolean;
  customXRightText: string;
  customXRightRegex: boolean;
  customYUpText: string;
  customYUpRegex: boolean;
  customYDownText: string;
  customYDownRegex: boolean;
  /** The computed projections of the tensors. */
  projections: Array<{
    [key: string]: number;
  }> = [];
  /** Filtered dataset indices. */
  filteredPoints: number[];
  /** The indices of selected points. */
  selectedPoints: number[] = [];
  /** Camera state (2d/3d, position, target, zoom, etc). */
  cameraDef: CameraDef;
  /** Color by option. */
  selectedColorOptionName: string;
  forceCategoricalColoring: boolean;
  /** Label by option. */
  selectedLabelOption: string;
}
export function getProjectionComponents(
  projection: ProjectionType,
  components: (number | string)[]
): ProjectionComponents3D {
  if (components.length > 3) {
    throw new RangeError('components length must be <= 3');
  }
  const projectionComponents: [string, string, string] = [null, null, null];
  const prefix = projection === 'custom' ? 'linear' : projection;
  for (let i = 0; i < components.length; ++i) {
    if (components[i] == null) {
      continue;
    }
    projectionComponents[i] = prefix + '-' + components[i];
  }
  return projectionComponents;
}
export function stateGetAccessorDimensions(
  state: State
): Array<number | string> {
  let dimensions: Array<number | string>;
  switch (state.selectedProjection) {
    case 'pca':
      dimensions = state.pcaComponentDimensions.slice();
      break;
    case 'tsne':
      dimensions = [0, 1];
      if (state.tSNEis3d) {
        dimensions.push(2);
      }
      break;
    case 'umap':
      dimensions = [0, 1];
      if (state.umapIs3d) {
        dimensions.push(2);
      }
      break;
    case 'custom':
      dimensions = ['x', 'y'];
      break;
    default:
      throw new Error('Unexpected fallthrough');
  }
  return dimensions;
}
