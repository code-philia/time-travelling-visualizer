/* Copyright 2016 The TensorFlow Authors. All Rights Reserved.
this.updateMetadataUI(this.spriteAndMetadata.stats, this.metadataFile);
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
import {  updateStateForInstance } from './globalState';
import { PolymerElement } from '@polymer/polymer';
import { customElement, observe, property } from '@polymer/decorators';
import {
  ColorLegendThreshold,
  ColorLegendRenderInfo,
} from './vz-projector-legend';
import * as d3 from 'd3';
import { LegacyElementMixin } from '../components/polymer/legacy_element_mixin';
import '../components/polymer/irons_and_papers';

import { template } from './vz-projector-projections-panel.html';
import './vz-projector-input';
import {
  DataSet,
  getProjectionComponents,
  PCA_SAMPLE_DIM,
  PCA_SAMPLE_SIZE,
  Projection,
  ProjectionType,
  SpriteAndMetadataInfo,
  ColorOption,
  ColumnStats,
  State,
  TSNE_SAMPLE_SIZE,
  UMAP_SAMPLE_SIZE,
} from './data';
import * as vector from './vector';
import * as util from './util';
import * as logging from './logging';

const NUM_PCA_COMPONENTS = 10;

type InputControlName = 'xLeft' | 'xRight' | 'yUp' | 'yDown';
type CentroidResult = {
  centroid?: vector.Vector;
  numMatches?: number;
};
type Centroids = {
  [key: string]: vector.Vector;
  xLeft: vector.Vector;
  xRight: vector.Vector;
  yUp: vector.Vector;
  yDown: vector.Vector;
};
/**
 * A polymer component which handles the projection tabs in the projector.
 */
@customElement('vz-projector-projections-panel')
class ProjectionsPanel extends LegacyElementMixin(PolymerElement) {
  static readonly template = template;

  @property({ type: String, notify: true })
  selectedColorOptionName: string;
  @property({ type: String, notify: true })
  selectedLabelOption: string;
  @property({ type: String })
  metadataEditorColumn: string;
  @property({ type: Boolean })
  showForceCategoricalColorsCheckbox: boolean;

  @property({ type: Boolean })
  _showFilter: boolean = false
  @property({ type: String })
  selectedArchitecture: string = 'ResNet-18'
  @property({ type: String })
  selectedLr: string = '0.01'
  @property({ type: Number })
  selectedTotalEpoch: number = 190



  @property({ type: Boolean })
  tSNEis3d: boolean = false;
  @property({ type: Number })
  superviseFactor: number = 0;
  // UMAP parameters

  // PCA projection.
  @property({ type: Array })
  pcaComponents: Array<{
    id: number;
    componentNumber: number;
    percVariance: string;
  }>;
  @property({ type: Number })
  pcaX: number = 0;
  @property({ type: Number })
  pcaY: number = 1;
  @property({ type: Number })
  pcaZ: number = 2;
  // Custom projection.
  @property({ type: String })
  customSelectedSearchByMetadataOption: string;

  @property({ type: String })
  subjectModelPathEditorInput: string = "";

  @property({ type: String })
  resolutionEditorInput: number;

  @property({ type: Number })
  iterationEditorInput: number;

  @property({ type: Boolean })
  keepSearchPredicate: boolean = true;
  // Decide wether to keep indices or search predicates, true represents search predicates

  @property({ type: Number })
  instanceId: number;

  temporalStatus: boolean = true; //true for keepSearchPredicate

  private projector: any; // Projector; type omitted b/c LegacyElement
  private labelOptions: string[];
  private colorOptions: ColorOption[];
  private currentProjection: ProjectionType;
  private polymerChangesTriggerReprojection: boolean;
  private dataSet: DataSet;
  private originalDataSet: DataSet;
  private dim: number;
  /** T-SNE perplexity. Roughly how many neighbors each point influences. */
  private perplexity: number;
  /** T-SNE learning rate. */
  private learningRate: number;
  /** T-SNE perturb interval identifier, required to terminate perturbation. */
  private perturbInterval: number;
  private searchByMetadataOptions: string[];
  /** Centroids for custom projections. */
  private centroidValues: any;
  private centroids: Centroids;
  /** The centroid across all points. */
  private allCentroid: number[];
  /** Polymer elements. */
  private runTsneButton: HTMLButtonElement;
  private pauseTsneButton: HTMLButtonElement;
  //private perturbTsneButton: HTMLButtonElement;
  private previousDVIButton: HTMLButtonElement;
  private nextDVIButton: HTMLButtonElement;
  private jumpDVIButton: HTMLButtonElement;
  private refreshDVIButton: HTMLButtonElement;
  //private perplexitySlider: HTMLInputElement;
  //private learningRateInput: HTMLInputElement;
  //private superviseFactorInput: HTMLInputElement;
  private zDropdown: HTMLElement;
  private iterationLabelTsne: HTMLElement;
  private totalIterationLabelDVI: HTMLElement;

  private customProjectionXLeftInput: any; // ProjectorInput; type ommited
  private customProjectionXRightInput: any; // ProjectorInput; type ommited
  private customProjectionYUpInput: any; // ProjectorInput; type ommited
  private customProjectionYDownInput: any; // ProjectorInput; type ommited


  private colorLegendRenderInfo: ColorLegendRenderInfo;
  /*Evaluation Information*/
  private nnTrain15: HTMLElement;
  private nnTest15: HTMLElement;
  private boundTrain15: HTMLElement;
  private boundTest15: HTMLElement;
  /*
  private invNnTrain10: HTMLElement;
  private invNnTrain15: HTMLElement;
  private invNnTrain30: HTMLElement;
  private invNnTest10: HTMLElement;
  private invNnTest15: HTMLElement;
  private invNnTest30: HTMLElement;
  */
  private invAccTrain: HTMLElement;
  private invAccTest: HTMLElement;
  // private invConfTrain: HTMLElement;
  // private invConfTest: HTMLElement;
  private accTrain: HTMLElement;
  private accTest: HTMLElement;

  private iterationInput: number;

  private learningRateList: string[];
  private architectureList: string[];
  private totalEpochList: number[]

  private totalAccTrain: HTMLElement;
  private totalAccTest: HTMLElement;

  private baseTrainAcc: any;
  private baseTestAcc: any;

  
  private timer: any;
  

  initialize(projector: any) {
   

    this.polymerChangesTriggerReprojection = true;
    this.projector = projector;
    // Set up TSNE projections.
    this.perplexity = 30;
    this.learningRate = 10;
    // Setup Custom projections.
    this.centroidValues = { xLeft: null, xRight: null, yUp: null, yDown: null };
    this.clearCentroids();
    this.setupUIControls();
  }

  ready() {
    super.ready();
    console.log('[projeciton] method called');
    this.learningRateList = ['0.1', '0.01', '0.001']
    this.architectureList = ['ResNet-18', 'ResNet-34', 'VGG-18']
    this.totalEpochList = [190, 200]
    this._showFilter = window.sessionStorage.taskType == 'anormaly detection' && window.sessionStorage.username !== 'tutorial'
    this.zDropdown = this.$$('#z-dropdown') as HTMLElement;
    //this.runTsneButton = this.$$('.run-tsne') as HTMLButtonElement;
    //this.runTsneButton.innerText = 'Run';
    // this.pauseTsneButton = this.$$('.pause-tsne') as HTMLButtonElement;
    //this.pauseTsneButton.disabled = true;
    //this.perturbTsneButton = this.$$('.perturb-tsne') as HTMLButtonElement;
    this.previousDVIButton = this.$$('.previous-dvi') as HTMLButtonElement;

    
    this.previousDVIButton.disabled = true;
    this.nextDVIButton = this.$$('.next-dvi') as HTMLButtonElement;
    this.jumpDVIButton = this.$$('.jump-dvi') as HTMLButtonElement;
    this.refreshDVIButton = this.$$('.refresh-dvi') as HTMLButtonElement;
    this.jumpDVIButton.disabled = true;
    // this.vis_method = this.$$('[name="vis_method_projector"]');

    // this.vis_method_projector = this.$$('.')
    // let vis_method = document.getElementsByName("vis_method");
    // let setting = document.getElementsByName("setting");
    this.timer = null

    //this.nextDVIButton.disabled = true;
    //this.perplexitySlider = this.$$('#perplexity-slider') as HTMLInputElement;
    /*
    this.learningRateInput = this.$$(
      '#learning-rate-slider'
    ) as HTMLInputElement;
    this.superviseFactorInput = this.$$(
      '#supervise-factor-slider'
    ) as HTMLInputElement;*/

    this.iterationLabelTsne = this.$$('.run-tsne-iter') as HTMLElement;
    this.totalIterationLabelDVI = this.$$('.dvi-total-iter') as HTMLElement;


    /*evaluation information*/
    this.nnTrain15 = this.$$('.nn_train_15') as HTMLElement;
    this.nnTest15 = this.$$('.nn_test_15') as HTMLElement;
    this.boundTrain15 = this.$$('.bound_train_15') as HTMLElement;
    this.boundTest15 = this.$$('.bound_test_15') as HTMLElement;

    this.invAccTrain = this.$$('.inv_acc_train') as HTMLElement;
    this.invAccTest = this.$$('.inv_acc_test') as HTMLElement;
    // this.invConfTrain = this.$$('.inv_conf_train') as HTMLElement;
    // this.invConfTest = this.$$('.inv_conf_test') as HTMLElement;
    this.accTrain = this.$$('.acc_train') as HTMLElement;
    this.accTest = this.$$('.acc_test') as HTMLElement;
    this.totalAccTrain = this.$$('.total_acc_train') as HTMLElement;
    this.totalAccTest = this.$$('.total_acc_test') as HTMLElement;
    if (window.sessionStorage.taskType == 'anormaly detection') {
      this.subjectModelPathEditorInput = window.sessionStorage.unormaly_content_path
    } else {
      this.subjectModelPathEditorInput = window.sessionStorage.normal_content_path
    }
    updateStateForInstance(this.instanceId, {modelMath:this.subjectModelPathEditorInput})
    // this.state.modelMath = this.subjectModelPathEditorInput
    if (this.dataSet) {
      this.dataSet.DVIsubjectModelPath = this.subjectModelPathEditorInput;
    }
  }
  disablePolymerChangesTriggerReprojection() {
    this.polymerChangesTriggerReprojection = false;
  }
  enablePolymerChangesTriggerReprojection() {
    this.polymerChangesTriggerReprojection = true;
  }

  private subjectModelPathEditorInputChange() {
    updateStateForInstance(this.instanceId, {modelMath:this.subjectModelPathEditorInput})
    // this.state.modelMath = this.subjectModelPathEditorInput
    if (window.sessionStorage.taskType == 'anormaly detection') {
      window.sessionStorage.setItem('unormaly_content_path', this.subjectModelPathEditorInput)
    } else {
      window.sessionStorage.setItem('normal_content_path', this.subjectModelPathEditorInput)
    }
    this.dataSet.DVIsubjectModelPath = this.subjectModelPathEditorInput;
  }
  private resolutionEditorInputChange() {
    this.dataSet.DVIResolution = this.resolutionEditorInput;
  }
  private iterationEditorInputChange() {
    this.iterationInput = Number(this.iterationEditorInput);
    console.log(this.iterationInput);
  }
  private updateEvaluationInformation(evaluation: any) {
    this.nnTrain15.innerText = '' + evaluation.nn_train_15;
    this.nnTest15.innerText = '' + evaluation.nn_test_15;
    this.boundTrain15.innerText = '' + evaluation.bound_train_15;
    this.boundTest15.innerText = '' + evaluation.bound_test_15;

    this.invAccTrain.innerText = '' + evaluation.ppr_train;
    this.invAccTest.innerText = '' + evaluation.ppr_test;

    this.accTrain.innerText = '' + evaluation.acc_train;
    this.accTest.innerText = '' + evaluation.acc_test;
    this.totalAccTest.innerText = '' + Number(evaluation.test_acc * 100).toFixed(2) + '%';
    this.totalAccTrain.innerText = '' + Number(evaluation.train_acc * 100).toFixed(2) + '%';
    this.baseTrainAcc = evaluation.train_acc
    this.baseTestAcc = evaluation.test_acc
  }

  private reRenderVzProjectorApp(): void {
    const parentContainer: HTMLElement | null = document.getElementById('bodyContent')?.parentNode as HTMLElement;

    if (!parentContainer) {
        console.error("Parent container not found");
        return;
    }

    // Remove the existing vz-projector-app component
    const oldElement: HTMLElement | null = document.getElementById('bodyContent');
    if (oldElement) {
        parentContainer.removeChild(oldElement);
    }

    // Create a new vz-projector-app component
    const newElement: HTMLElement = document.createElement('vz-projector-app');
    newElement.id = 'bodyContent';
    newElement.setAttribute('documentation-link', 'https://www.tensorflow.org/get_started/embedding_viz');
    newElement.setAttribute('bug-report-link', 'https://github.com/tensorflow/tensorboard/issues');
    newElement.setAttribute('serving-mode', 'demo');
    newElement.setAttribute('projector-config-json-path', 'standalone_projector_config.json');


    // Append the new vz-projector-app to the parent container
    parentContainer.appendChild(newElement);

    setTimeout(() => {
        newElement.style.visibility = 'visible';
    }, 5000); // example: 5 seconds timeout, adjust as needed
}


  private setupUIControls() {
    {
      const self = this;
      const inkTabs = this.root.querySelectorAll('.ink-tab');
      for (let i = 0; i < inkTabs.length; i++) {
        inkTabs[i].addEventListener('click', function () {
          let id = this.getAttribute('data-tab');
          self.showTab(id);
        });
      }
    }
    
    this.refreshDVIButton.addEventListener('click', async () => {
     
      try {

          const vis_method_element = this.shadowRoot.getElementById("vis_method_projector") as HTMLSelectElement
          const vis_method =  vis_method_element.value
          window.sessionStorage.setItem('vis_method', vis_method)
          const setting_element = this.shadowRoot.getElementById("setting_projector") as HTMLSelectElement
          const setting = setting_element.value

          window.sessionStorage.setItem('selectedSetting', setting)
          window.sessionStorage.selectedSetting = setting
        
          if (window.sessionStorage.selectedSetting == 'normal') {
            window.sessionStorage.setItem('taskType', 'anomaly detection');
            console.log("normal")

        } else {
            window.sessionStorage.setItem('taskType', 'active learning');
            console.log("activate learning")
        }

          const content_path_element = this.shadowRoot.getElementById("contentPathInput_projector") as HTMLSelectElement;


          const content_path = content_path_element.value;
  
          const DVIServer_element = this.shadowRoot.getElementById("ipAddressInput_projector") as HTMLSelectElement;
      
          const DVIServer = DVIServer_element.value;
  
          window.sessionStorage.setItem('content_path', content_path);
          window.sessionStorage.setItem('ipAddress', DVIServer);
  
          let headers = new Headers();
          headers.append('Content-Type', 'application/json');
          headers.append('Accept', 'application/json');
  
          const response = await fetch(`http://${DVIServer}/login`, {
              method: 'POST',
              body: JSON.stringify({ "content_path": content_path }),
              headers: headers,
              mode: 'cors'
          });
  
          const data = await response.json();
          console.log('data', data);
  
          if (data.normal_content_path && data.unormaly_content_path) {
              this.reRenderVzProjectorApp();
              window.sessionStorage.setItem('normal_content_path', data.normal_content_path);
              window.sessionStorage.setItem('unormaly_content_path', data.unormaly_content_path);
              window.sessionStorage.setItem('isControlGroup', data.isControl ? data.isControl : false);
              setTimeout(() => {
                  location.reload();
              }, 1);
          } else {
              alert(data.message);
          }
  
      } catch (error) {
          console.error(error);
          //stepCallback(null, null, null, null, null);
      }
  });
  

    this.previousDVIButton.addEventListener('click', () => {
      const msgId = logging.setModalMessage('loading...');
      this.nextDVIButton.disabled = true;
      this.previousDVIButton.disabled = true;
      this.jumpDVIButton.disabled = true;
      this.refreshDVIButton.disabled = true;
      if (this.dataSet.tSNEIteration <= 2) {
        this.previousDVIButton.disabled = true;
      }

      this.dataSet.projectDVI(this.dataSet.tSNEIteration - 1, this.projector.inspectorPanel.currentPredicate,
        (iteration: number | null, evaluation: any, new_selection: any[], indices: number[], totalIter?: number) => {
          /**
           * get filter index
           */
          //get search predicates or indices
          var filterIndices: number[];
          filterIndices = []
          if (this.temporalStatus) {
            //search predicate
            this.projector.inspectorPanel.filterIndices = indices;
          }
          //indices
          filterIndices = this.projector.inspectorPanel.filterIndices;
       
          this.projector.dataSet.setDVIFilteredData(filterIndices);
          if (iteration != null) {
            this.iterationLabelTsne.innerText = '' + iteration;
            this.totalIterationLabelDVI.innerText = '' + totalIter;
            this.updateEvaluationInformation(evaluation);
            this.projector.notifyProjectionPositionsUpdated();
            this.projector.onProjectionChanged();
            console.log("checkClickPrev")
            this.projector.onIterationChange(iteration);
          } else {
            this.projector.onProjectionChanged();
          }
          if (this.dataSet.tSNEIteration > 1) {
            this.previousDVIButton.disabled = false;
          }
          logging.setModalMessage(null, msgId);
          this.nextDVIButton.disabled = false;
          this.jumpDVIButton.disabled = false;
          this.refreshDVIButton.disabled = false;
        });
    });
    this.nextDVIButton.addEventListener('click', () => {
      const msgId = logging.setModalMessage('loading...');
      this.nextDVIButton.disabled = true;
      this.previousDVIButton.disabled = true;
      this.jumpDVIButton.disabled = true;
      this.refreshDVIButton.disabled = true;
      this.dataSet.projectDVI(this.dataSet.tSNEIteration + 1, this.projector.inspectorPanel.currentPredicate,
        (iteration: number | null, evaluation: any, newSelection: any[], indices: number[], totalIter?: number) => {
          /**
           * get filter index
           */
          //get search predicates or indices
          if (iteration == null && evaluation == null) {
            this.nextDVIButton.disabled = false;
            return
          }
          var filterIndices: number[];
          filterIndices = []
          if (this.temporalStatus) {
            //search predicate
            this.projector.inspectorPanel.filterIndices = indices;
          }
          //indices
          filterIndices = this.projector.inspectorPanel.filterIndices;

          this.projector.dataSet.setDVIFilteredData(filterIndices);

          if (iteration != null) {
            this.iterationLabelTsne.innerText = '' + iteration;
            this.totalIterationLabelDVI.innerText = '' + totalIter;
            this.updateEvaluationInformation(evaluation);

            this.projector.notifyProjectionPositionsUpdated();
            this.projector.onProjectionChanged();
            console.log("checkClickNExt")
            this.projector.onIterationChange(iteration);
            if (this.dataSet.tSNEIteration > 1) {
              this.previousDVIButton.disabled = false;
            }
            if (this.dataSet.tSNETotalIter != this.dataSet.tSNEIteration) {
              this.nextDVIButton.disabled = false;
            }
          } else {
            this.nextDVIButton.disabled = false;
            this.projector.onProjectionChanged();
          }
          logging.setModalMessage(null, msgId);
          this.jumpDVIButton.disabled = false;
          this.refreshDVIButton.disabled = false;
        });
    });
    this.jumpDVIButton.addEventListener('click', () => {
      if (this.iterationInput > this.dataSet.tSNETotalIter || this.iterationInput < 1) {
        logging.setErrorMessage("Invaild Input!", null);
        this.jumpDVIButton.disabled = false;
        return;
      } else if (this.iterationInput == this.dataSet.tSNEIteration) {
        logging.setWarningMessage("current iteration!");
        this.jumpDVIButton.disabled = false;
        // logging.setModalMessage(null, msgId);
        return;
      }
      this.jumpTo(this.iterationInput)
    });

    this.setupCustomProjectionInputFields();
    // TODO: figure out why `--paper-input-container-input` css mixin didn't
    // work.
    const inputs = this.root.querySelectorAll(
      'paper-dropdown-menu paper-input input'
    );
    for (let i = 0; i < inputs.length; i++) {
      (inputs[i] as HTMLElement).style.fontSize = '14px';
    }
  }

  
  jumpTo(iterationInput) {
    const msgId = logging.setModalMessage('loading...');
    this.jumpDVIButton.disabled = true;
    this.nextDVIButton.disabled = true;
    this.previousDVIButton.disabled = true;
    this.dataSet.projectDVI(iterationInput, this.projector.inspectorPanel.currentPredicate,
      (iteration: number | null, evaluation: any, newSelection: any[], indices: number[], totalIter?: number) => {
        /**
         * get filter index
         */
        //get search predicates or indices
        var filterIndices: number[];
        filterIndices = []
        if (this.temporalStatus) {
          //search predicate
          this.projector.inspectorPanel.filterIndices = indices;
        }
        //indices
        filterIndices = this.projector.inspectorPanel.filterIndices;

        this.projector.dataSet.setDVIFilteredData(filterIndices);

        if (iteration != null) {
          this.iterationLabelTsne.innerText = '' + iteration;
          this.totalIterationLabelDVI.innerText = '' + totalIter;
          this.updateEvaluationInformation(evaluation);
  
          this.projector.notifyProjectionPositionsUpdated();
          this.projector.onProjectionChanged();
          console.log("it",iteration)
          console.log("checkClickJump")
          this.projector.onIterationChange(iteration);
          if (this.dataSet.tSNEIteration > 1) {
            this.previousDVIButton.disabled = false;
          }
          if (this.dataSet.tSNETotalIter != this.dataSet.tSNEIteration) {
            this.nextDVIButton.disabled = false;
          }
        } else {
          this.nextDVIButton.disabled = false;
          this.projector.onProjectionChanged();
        }
        logging.setModalMessage(null, msgId);
        this.jumpDVIButton.disabled = false;
      });
  }
  retrainBySelections(iteration: number, selections: number[], rejections: number[]) {

    const msgId = logging.setModalMessage('training and loading...')

    // Get the tensor.
    let percent = 0
    this.timer = window.setInterval(() => {
      percent = percent+0.1;
      logging.setModalMessage(
        `training and loading... ${Number(percent.toFixed(1))}%`,
      msgId);
      if(percent > 98){
        clearInterval(this.timer)
      }
    }, 250)

    // let xhr = new XMLHttpRequest();
    // xhr.open('GET', tensorsPath);
    // xhr.responseType = 'arraybuffer';
    // xhr.onprogress = (ev) => {


    // };
    this.dataSet.reTrainByDVI(iteration, selections, rejections,
      (iteration: number | null, evaluation: any, new_selection: any[], indices: number[], totalIter?: number) => {
        /**
         * get filter index
         */
        //get search predicates or indices
        var filterIndices: number[];
        filterIndices = []
        if (this.temporalStatus) {
          //search predicate
          this.projector.inspectorPanel.filterIndices = indices;
        }
        //indices
        filterIndices = this.projector.inspectorPanel.filterIndices;
        // TODO initilize dataset, set inspector filter indices to be all
        this.projector.dataSet.setDVIFilteredData(filterIndices);
        if (iteration != null) {
          this.iterationLabelTsne.innerText = '' + iteration;
          this.totalIterationLabelDVI.innerText = '' + totalIter;
          this.updateEvaluationInformation(evaluation);
          // this.projector.notifyProjectionPositionsUpdated(new_selection);
          this.projector.notifyProjectionPositionsUpdated();
          this.projector.onProjectionChanged();
          console.log("checkClickREtrain")
          this.projector.onIterationChange(iteration);
          this.projector.initialTree()
        } else {
          this.projector.onProjectionChanged();
        }
        if (this.dataSet.tSNEIteration > 1) {
          this.previousDVIButton.disabled = false;
        }
        logging.setModalMessage(null, msgId);
        window.clearInterval(this.timer)
        this.nextDVIButton.disabled = false;
        this.jumpDVIButton.disabled = false;
      });
  }

  restoreUIFromBookmark(bookmark: State) {
    this.disablePolymerChangesTriggerReprojection();
    // PCA
    this.pcaX = bookmark.pcaComponentDimensions[0];
    this.pcaY = bookmark.pcaComponentDimensions[1];
    if (bookmark.pcaComponentDimensions.length === 3) {
      this.pcaZ = bookmark.pcaComponentDimensions[2];
    }

    // custom
    this.customSelectedSearchByMetadataOption =
      bookmark.customSelectedSearchByMetadataOption;
    if (this.customProjectionXLeftInput) {
      this.customProjectionXLeftInput.set(
        bookmark.customXLeftText,
        bookmark.customXLeftRegex
      );
    }
    if (this.customProjectionXRightInput) {
      this.customProjectionXRightInput.set(
        bookmark.customXRightText,
        bookmark.customXRightRegex
      );
    }
    if (this.customProjectionYUpInput) {
      this.customProjectionYUpInput.set(
        bookmark.customYUpText,
        bookmark.customYUpRegex
      );
    }
    if (this.customProjectionYDownInput) {
      this.customProjectionYDownInput.set(
        bookmark.customYDownText,
        bookmark.customYDownRegex
      );
    }
    this.computeAllCentroids();
  
    //this.updateTSNEPerplexityFromSliderChange();
    //this.updateTSNELearningRateFromUIChange();
    if (this.iterationLabelTsne) {
      this.iterationLabelTsne.innerText = bookmark.tSNEIteration.toString();
    }
    if (bookmark.selectedProjection != null) {
      this.showTab(bookmark.selectedProjection);
    }
    this.enablePolymerChangesTriggerReprojection();
  }

  populateBookmarkFromUI(bookmark: State) {
    this.disablePolymerChangesTriggerReprojection();
    // PCA
    bookmark.pcaComponentDimensions = [this.pcaX, this.pcaY];



    // custom
    bookmark.customSelectedSearchByMetadataOption = this.customSelectedSearchByMetadataOption;
    if (this.customProjectionXLeftInput != null) {
      bookmark.customXLeftText = this.customProjectionXLeftInput.getValue();
      bookmark.customXLeftRegex = this.customProjectionXLeftInput.getInRegexMode();
    }
    if (this.customProjectionXRightInput != null) {
      bookmark.customXRightText = this.customProjectionXRightInput.getValue();
      bookmark.customXRightRegex = this.customProjectionXRightInput.getInRegexMode();
    }
    if (this.customProjectionYUpInput != null) {
      bookmark.customYUpText = this.customProjectionYUpInput.getValue();
      bookmark.customYUpRegex = this.customProjectionYUpInput.getInRegexMode();
    }
    if (this.customProjectionYDownInput != null) {
      bookmark.customYDownText = this.customProjectionYDownInput.getValue();
      bookmark.customYDownRegex = this.customProjectionYDownInput.getInRegexMode();
    }
    this.enablePolymerChangesTriggerReprojection();
  }
  // This method is marked as public as it is used as the view method that
  // abstracts DOM manipulation so we can stub it in a test.
  // TODO(nsthorat): Move this to its own class as the glue between this class
  // and the DOM.
  dataSetUpdated(dataSet: DataSet, originalDataSet: DataSet, dim: number) {
    this.dataSet = dataSet;
    this.originalDataSet = originalDataSet;
    this.dim = dim;
    const pointCount = dataSet == null ? 0 : dataSet.points.length;
    //const perplexity = Math.max(5, Math.ceil(Math.sqrt(pointCount) / 4));
    //this.perplexitySlider.value = perplexity.toString();
    //this.updateTSNEPerplexityFromSliderChange();
    this.clearCentroids();
    (this.$$('#tsne-sampling') as HTMLElement).style.display =
      pointCount > TSNE_SAMPLE_SIZE ? null : 'none';
    const wasSampled =
      dataSet == null
        ? false
        : dataSet.dim[0] > PCA_SAMPLE_DIM || dataSet.dim[1] > PCA_SAMPLE_DIM;
    (this.$$('#pca-sampling') as HTMLElement).style.display = wasSampled
      ? null
      : 'none';
    this.showTab('tsne');
  }
  @observe('selectedLabelOption')
  _selectedLabelOptionChanged() {
    this.projector.setSelectedLabelOption(this.selectedLabelOption);
  }
  @observe('selectedColorOptionName')
  _selectedColorOptionNameChanged() {
    let colorOption: ColorOption;
    for (let i = 0; i < this.colorOptions.length; i++) {
      if (this.colorOptions[i].name === this.selectedColorOptionName) {
        colorOption = this.colorOptions[i];
        break;
      }
    }
    if (!colorOption) {
      return;
    }
    this.showForceCategoricalColorsCheckbox = !!colorOption.tooManyUniqueValues;
    if (colorOption.map == null) {
      this.colorLegendRenderInfo = null;
    } else if (colorOption.items) {
      let items = colorOption.items.map((item) => {
        return {
          color: colorOption.map(item.label),
          label: item.label,
          count: item.count,
        };
      });
      this.colorLegendRenderInfo = { items, thresholds: null };
    } else {
      this.colorLegendRenderInfo = {
        items: null,
        thresholds: colorOption.thresholds,
      };
    }
    this.projector.setSelectedColorOption(colorOption);
  }

  @observe('temporalStatus')
  _DVITemporalStatusObserver() {

  }
  @observe('selectedArchitecture')
  // TODO
  _selectedArchitectureChanged() {
    this.updateTrainTestRessult()
  }
  @observe('selectedTotalEpoch')
  _selectedTotalEpochChanged() {
    updateStateForInstance(this.instanceId, {selectedTotalEpoch:this.selectedTotalEpoch})
    // this.state.selectedTotalEpoch = this.selectedTotalEpoch
    this.updateTrainTestRessult()
  }
  @observe('selectedLr')
  _selectedLrChanged() {
    // TODO
    this.updateTrainTestRessult()
  }

  updateTrainTestRessult() {
    if (this.projector) {
      if (this.selectedArchitecture == 'ResNet-18' && this.selectedLr == '0.01') {
        this.projector.hiddenOrShowScatter('')
        if (this.totalAccTrain) {
          this.totalAccTrain.innerText = '' + Number(this.baseTrainAcc * 100).toFixed(2) + '%';
          this.totalAccTest.innerText = '' + Number(this.baseTestAcc * 100).toFixed(2) + '%';
        }
        this.projector.initialTree()
      }
      else if (this.selectedArchitecture == 'ResNet-18' && this.selectedLr == '0.1' && this.selectedTotalEpoch == 190) {
        this.projector.hiddenOrShowScatter('hidden')
        if (this.totalAccTrain) {
          this.totalAccTrain.innerText = '95.66%';
          this.totalAccTest.innerText = '78.23%';
        }
        this.projector.initialTree(this.selectedTotalEpoch)
      }
      else if (this.selectedArchitecture == 'ResNet-18' && this.selectedLr == '0.001' && this.selectedTotalEpoch == 190) {
        this.projector.hiddenOrShowScatter('hidden')
        if (this.totalAccTrain) {
          this.totalAccTrain.innerText = '94.22%';
          this.totalAccTest.innerText = '78.26%';
        }
        this.projector.initialTree(this.selectedTotalEpoch)
      }
      else if (this.selectedArchitecture == 'ResNet-34' && this.selectedLr == '0.01' && this.selectedTotalEpoch == 190) {
        this.projector.hiddenOrShowScatter('hidden')
        if (this.totalAccTrain) {
          this.totalAccTrain.innerText = '98.23%';
          this.totalAccTest.innerText = '78.61%';
        }
        this.projector.initialTree(this.selectedTotalEpoch)

      } else if (this.selectedArchitecture == 'VGG-18' && this.selectedLr == '0.01' && this.selectedTotalEpoch == 190) {
        this.projector.hiddenOrShowScatter('hidden')
        if (this.totalAccTrain) {
          this.totalAccTrain.innerText = '96.38%';
          this.totalAccTest.innerText = '79.93%';
        }
        this.projector.initialTree(this.selectedTotalEpoch)
      } else if (this.selectedTotalEpoch == 200 && !(this.selectedArchitecture == 'ResNet-18' && this.selectedLr == '0.01')) {
        this.projector.hiddenOrShowScatter('hidden')
        this.projector.initialTree(this.selectedTotalEpoch, true)
        if (this.totalAccTrain) {
          this.totalAccTrain.innerText = '-' + '%';
          this.totalAccTest.innerText = '-' + '%';
        }
      } else {
        this.projector.hiddenOrShowScatter('hidden')
        this.projector.initialTree(this.selectedTotalEpoch, true)
        if (this.totalAccTrain) {
          this.totalAccTrain.innerText = '-' + '%';
          this.totalAccTest.innerText = '-' + '%';
        }
      }
    }
  }
  // @observe('selectedTotalEpoch')
  // _selectedTotalChanged() {
  //   // TODO
  //   if (this.projector) {
  //     if (this.projector) {
  //       if (this.selectedArchitecture == 'ResNet-18' && this.selectedLr == '0.01' && this.selectedTotalEpoch == 190) {

  //         this.projector.hiddenOrShowScatter('')
  //         if (this.totalAccTrain) {
  //           this.totalAccTrain.innerText = '' + Number(this.baseTrainAcc * 100).toFixed(2) + '%';
  //           this.totalAccTest.innerText = '' + Number(this.baseTestAcc * 100).toFixed(2) + '%';
  //         }

  //       } else {
  //         this.projector.hiddenOrShowScatter('hidden')
  //         // if (this.totalAccTrain) {
  //           this.totalAccTrain.innerText = '-' + Number((this.baseTrainAcc) * 100).toFixed(2) + '%';
  //           this.totalAccTest.innerText = '-' + Number((this.baseTestAcc) * 100).toFixed(2) + '%';
  //         // }
  //       }
  //     }
  //   }
  // }
  metadataChanged(spriteAndMetadata: SpriteAndMetadataInfo, metadataFile?: string) {
    // Project by options for custom projections.
    if (metadataFile != null) {
      // this.metadataFile = metadataFile;
    }
    this.updateMetadataUI(spriteAndMetadata.stats);
    if (
      this.selectedColorOptionName == null ||
      this.colorOptions.filter((c) => c.name === this.selectedColorOptionName)
        .length === 0
    ) {
      this.selectedColorOptionName = this.colorOptions[0].name;
    }
    let searchByMetadataIndex = -1;
    this.searchByMetadataOptions = spriteAndMetadata.stats.map((stats, i) => {
      // Make the default label by the first non-numeric column.
      if (!stats.isNumeric && searchByMetadataIndex === -1) {
        searchByMetadataIndex = i;
      }
      return stats.name;
    });
    this.customSelectedSearchByMetadataOption = this.searchByMetadataOptions[
      Math.max(0, searchByMetadataIndex)
    ];
  }
  private updateMetadataUI(columnStats: ColumnStats[]) {
    // Label by options.
    let labelIndex = -1;
    this.labelOptions = columnStats.map((stats, i) => {
      // Make the default label by the first non-numeric column.
      if (!stats.isNumeric && labelIndex === -1) {
        labelIndex = i;
      }
      return stats.name;
    });
    if (
      this.selectedLabelOption == null ||
      this.labelOptions.filter((name) => name === this.selectedLabelOption)
        .length === 0
    ) {
      this.selectedLabelOption = this.labelOptions[Math.max(0, labelIndex)];
    }
    if (
      this.metadataEditorColumn == null ||
      this.labelOptions.filter((name) => name === this.metadataEditorColumn)
        .length === 0
    ) {
      this.metadataEditorColumn = this.labelOptions[Math.max(0, labelIndex)];
    }
    //Color by options.
    const standardColorOption: ColorOption[] = [{ name: 'No color map' }];
    const metadataColorOption: ColorOption[] = columnStats
      .filter((stats) => {
        return !stats.tooManyUniqueValues || stats.isNumeric;
      })
      .map((stats) => {
        let map;
        let items: {
          label: string;
          count: number;
        }[];
        let thresholds: ColorLegendThreshold[];
        let isCategorical = !stats.tooManyUniqueValues;
        let desc;
        if (isCategorical) {
          const scale = d3.scaleOrdinal(d3.schemeCategory10);
          let range = scale.range();
          // Re-order the range.
          let newRange = range.map((color, i) => {
            let index = (i * 3) % range.length;
            return range[index];
          });
          items = stats.uniqueEntries;
          scale.range(newRange).domain(items.map((x) => x.label));
          map = scale;
          const len = stats.uniqueEntries.length;
          desc =
            `${len} ${len > range.length ? ' non-unique' : ''} ` + `colors`;
        } else {
          thresholds = [
            { color: '#ffffdd', value: stats.min },
            { color: '#1f2d86', value: stats.max },
          ];
          map = d3
            .scaleLinear<string, string>()
            .domain(thresholds.map((t) => t.value))
            .range(thresholds.map((t) => t.color));
          desc = 'gradient';
        }
        return {
          name: stats.name,
          desc: desc,
          map: map,
          items: items,
          thresholds: thresholds,
          tooManyUniqueValues: stats.tooManyUniqueValues,
        };
      });
    if (metadataColorOption.length > 0) {
      // Add a separator line between built-in color maps
      // and those based on metadata columns.
      standardColorOption.push({ name: 'Metadata', isSeparator: true });
    }
    this.colorOptions = metadataColorOption.concat(standardColorOption);
  }
  public showTab(id: ProjectionType) {
    this.currentProjection = id;
    const tab = this.$$('.ink-tab[data-tab="' + id + '"]') as HTMLElement;
    const allTabs = this.root.querySelectorAll('.ink-tab');
    for (let i = 0; i < allTabs.length; i++) {
      util.classed(allTabs[i] as HTMLElement, 'active', false);
    }
    util.classed(tab, 'active', true);
    const allTabContent = this.root.querySelectorAll('.ink-panel-content');
    for (let i = 0; i < allTabContent.length; i++) {
      util.classed(allTabContent[i] as HTMLElement, 'active', false);
    }
    util.classed(
      this.$$('.ink-panel-content[data-panel="' + id + '"]') as HTMLElement,
      'active',
      true
    );
    // guard for unit tests, where polymer isn't attached and $ doesn't exist.
    if (this.$ != null) {
      const main = this.$['main'];
      // In order for the projections panel to animate its height, we need to
      // set it explicitly.
      requestAnimationFrame(() => {
        this.style.height = main.clientHeight + 'px';
      });
    }
    console.log(id);
    this.beginProjection(id);
  }
  private beginProjection(projection: ProjectionType) {
    if (this.polymerChangesTriggerReprojection === false) {
      return;
    }
    else if (projection === 'tsne') {
      this.showTSNE();
    } else if (projection === 'custom') {
      if (this.dataSet != null) {
        this.dataSet.stopTSNE();
      }
      this.computeAllCentroids();
      this.reprojectCustom();
    }
  }
  private showTSNE() {
    const dataSet = this.dataSet;
    if (dataSet == null) {
      return;
    }
    const accessors = getProjectionComponents('tsne', [
      0,
      1,
      this.tSNEis3d ? 2 : null,
    ]);
    const dimensionality = this.tSNEis3d ? 3 : 2;
    const projection = new Projection(
      'tsne',
      accessors,
      dimensionality,
      dataSet
    );
    this.projector.setProjection(projection);
    if (this.dataSet.hasTSNERun) {
      this.projector.notifyProjectionPositionsUpdated();
    }
  }



  private reprojectCustom() {
    if (
      this.centroids == null ||
      this.centroids.xLeft == null ||
      this.centroids.xRight == null ||
      this.centroids.yUp == null ||
      this.centroids.yDown == null
    ) {
      return;
    }
    const xDir = vector.sub(this.centroids.xRight, this.centroids.xLeft);
    this.dataSet.projectLinear(xDir, 'linear-x');
    const yDir = vector.sub(this.centroids.yUp, this.centroids.yDown);
    this.dataSet.projectLinear(yDir, 'linear-y');
    const accessors = getProjectionComponents('custom', ['x', 'y']);
    const projection = new Projection('custom', accessors, 2, this.dataSet);
    this.projector.setProjection(projection);
  }
  clearCentroids(): void {
    this.centroids = { xLeft: null, xRight: null, yUp: null, yDown: null };
    this.allCentroid = null;
  }
  @observe('customSelectedSearchByMetadataOption')
  _customSelectedSearchByMetadataOptionChanged(newVal: string, oldVal: string) {
    if (this.polymerChangesTriggerReprojection === false) {
      return;
    }
    if (this.currentProjection === 'custom') {
      this.computeAllCentroids();
      this.reprojectCustom();
    }
  }
  private setupCustomProjectionInputFields() {
    this.customProjectionXLeftInput = this.setupCustomProjectionInputField(
      'xLeft'
    );
    this.customProjectionXRightInput = this.setupCustomProjectionInputField(
      'xRight'
    );
    this.customProjectionYUpInput = this.setupCustomProjectionInputField('yUp');
    this.customProjectionYDownInput = this.setupCustomProjectionInputField(
      'yDown'
    );
  }
  private computeAllCentroids() {
    this.computeCentroid('xLeft');
    this.computeCentroid('xRight');
    this.computeCentroid('yUp');
    this.computeCentroid('yDown');
  }
  private computeCentroid(name: InputControlName) {
    const input = this.$$('#' + name) as any;
    if (input == null) {
      return;
    }
    const value = input.getValue();
    if (value == null) {
      return;
    }
    let inRegexMode = input.getInRegexMode();
    let result = this.getCentroid(value, inRegexMode);
    if (result.numMatches === 0) {
      input.message = '0 matches. Using a random vector.';
      result.centroid = vector.rn(this.dim);
    } else {
      input.message = `${result.numMatches} matches.`;
    }
    this.centroids[name] = result.centroid;
    this.centroidValues[name] = value;
  }
  private setupCustomProjectionInputField(name: InputControlName): any {
    let input = this.$$('#' + name) as any;
    input.registerInputChangedListener((input, inRegexMode) => {
      if (this.polymerChangesTriggerReprojection) {
        this.computeCentroid(name);
        this.reprojectCustom();
      }
    });
    return input;
  }
  private getCentroid(pattern: string, inRegexMode: boolean): CentroidResult {
    if (pattern == null || pattern === '') {
      return { numMatches: 0 };
    }
    // Search by the original dataset since we often want to filter and project
    // only the nearest neighbors of A onto B-C where B and C are not nearest
    // neighbors of A.
    let accessor = (i: number) => this.originalDataSet.points[i].vector;
    let result = this.originalDataSet.query(
      pattern,
      inRegexMode,
      this.customSelectedSearchByMetadataOption
    );
    let r = result[1];
    return { centroid: vector.centroid(r, accessor), numMatches: r.length };
  }
  getPcaSampledDimText() {
    return PCA_SAMPLE_DIM.toLocaleString();
  }
  getPcaSampleSizeText() {
    return PCA_SAMPLE_SIZE.toLocaleString();
  }
  getTsneSampleSizeText() {
    return TSNE_SAMPLE_SIZE.toLocaleString();
  }
  getUmapSampleSizeText() {
    return UMAP_SAMPLE_SIZE.toLocaleString();
  }
}
