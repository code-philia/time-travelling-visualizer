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
import { __decorate, __metadata } from "tslib";
import { PolymerElement } from '@polymer/polymer';
import { customElement, observe, property } from '@polymer/decorators';
import * as d3 from 'd3';
import { LegacyElementMixin } from '../components/polymer/legacy_element_mixin';
import '../components/polymer/irons_and_papers';
import { template } from './vz-projector-projections-panel.html';
import './vz-projector-input';
import { getProjectionComponents, PCA_SAMPLE_DIM, PCA_SAMPLE_SIZE, Projection, TSNE_SAMPLE_SIZE, UMAP_SAMPLE_SIZE, } from './data';
import * as vector from './vector';
import * as util from './util';
import * as logging from './logging';
const NUM_PCA_COMPONENTS = 10;
/**
 * A polymer component which handles the projection tabs in the projector.
 */
let ProjectionsPanel = class ProjectionsPanel extends LegacyElementMixin(PolymerElement) {
    constructor() {
        super(...arguments);
        this._showFilter = false;
        this.selectedArchitecture = 'ResNet-18';
        this.selectedLr = '0.01';
        this.selectedTotalEpoch = 190;
        this.tSNEis3d = false;
        this.superviseFactor = 0;
        this.pcaX = 0;
        this.pcaY = 1;
        this.pcaZ = 2;
        this.subjectModelPathEditorInput = "";
        this.keepSearchPredicate = true;
        // Decide wether to keep indices or search predicates, true represents search predicates
        this.temporalStatus = true; //true for keepSearchPredicate
    }
    initialize(projector) {
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
        this.learningRateList = ['0.1', '0.01', '0.001'];
        this.architectureList = ['ResNet-18', 'ResNet-34', 'VGG-18'];
        this.totalEpochList = [190, 200];
        this._showFilter = window.sessionStorage.taskType == 'anormaly detection' && window.sessionStorage.username !== 'tutorial';
        this.zDropdown = this.$$('#z-dropdown');
        //this.runTsneButton = this.$$('.run-tsne') as HTMLButtonElement;
        //this.runTsneButton.innerText = 'Run';
        // this.pauseTsneButton = this.$$('.pause-tsne') as HTMLButtonElement;
        //this.pauseTsneButton.disabled = true;
        //this.perturbTsneButton = this.$$('.perturb-tsne') as HTMLButtonElement;
        this.previousDVIButton = this.$$('.previous-dvi');
        this.previousDVIButton.disabled = true;
        this.nextDVIButton = this.$$('.next-dvi');
        this.jumpDVIButton = this.$$('.jump-dvi');
        this.jumpDVIButton.disabled = true;
        this.timer = null;
        //this.nextDVIButton.disabled = true;
        //this.perplexitySlider = this.$$('#perplexity-slider') as HTMLInputElement;
        /*
        this.learningRateInput = this.$$(
          '#learning-rate-slider'
        ) as HTMLInputElement;
        this.superviseFactorInput = this.$$(
          '#supervise-factor-slider'
        ) as HTMLInputElement;*/
        this.iterationLabelTsne = this.$$('.run-tsne-iter');
        this.totalIterationLabelDVI = this.$$('.dvi-total-iter');
        /*evaluation information*/
        this.nnTrain15 = this.$$('.nn_train_15');
        this.nnTest15 = this.$$('.nn_test_15');
        this.boundTrain15 = this.$$('.bound_train_15');
        this.boundTest15 = this.$$('.bound_test_15');
        this.invAccTrain = this.$$('.inv_acc_train');
        this.invAccTest = this.$$('.inv_acc_test');
        // this.invConfTrain = this.$$('.inv_conf_train') as HTMLElement;
        // this.invConfTest = this.$$('.inv_conf_test') as HTMLElement;
        this.accTrain = this.$$('.acc_train');
        this.accTest = this.$$('.acc_test');
        this.totalAccTrain = this.$$('.total_acc_train');
        this.totalAccTest = this.$$('.total_acc_test');
        if (window.sessionStorage.taskType == 'anormaly detection') {
            this.subjectModelPathEditorInput = window.sessionStorage.unormaly_content_path;
        }
        else {
            this.subjectModelPathEditorInput = window.sessionStorage.normal_content_path;
        }
        window.modelMath = this.subjectModelPathEditorInput;
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
    subjectModelPathEditorInputChange() {
        window.modelMath = this.subjectModelPathEditorInput;
        if (window.sessionStorage.taskType == 'anormaly detection') {
            window.sessionStorage.setItem('unormaly_content_path', this.subjectModelPathEditorInput);
        }
        else {
            window.sessionStorage.setItem('normal_content_path', this.subjectModelPathEditorInput);
        }
        this.dataSet.DVIsubjectModelPath = this.subjectModelPathEditorInput;
    }
    resolutionEditorInputChange() {
        this.dataSet.DVIResolution = this.resolutionEditorInput;
    }
    iterationEditorInputChange() {
        this.iterationInput = Number(this.iterationEditorInput);
        console.log(this.iterationInput);
    }
    updateEvaluationInformation(evaluation) {
        this.nnTrain15.innerText = '' + evaluation.nn_train_15;
        this.nnTest15.innerText = '' + evaluation.nn_test_15;
        this.boundTrain15.innerText = '' + evaluation.bound_train_15;
        this.boundTest15.innerText = '' + evaluation.bound_test_15;
        /*
        this.invNnTrain10.innerText = ''+evaluation.inv_nn_train_10;
        this.invNnTrain15.innerText = ''+evaluation.inv_nn_train_15;
        this.invNnTrain30.innerText = ''+evaluation.inv_nn_train_30;
        this.invNnTest10.innerText = ''+evaluation.inv_nn_test_10;
        this.invNnTest15.innerText = ''+evaluation.inv_nn_test_15;
        this.invNnTest30.innerText = ''+evaluation.inv_nn_test_30;
        */
        this.invAccTrain.innerText = '' + evaluation.ppr_train;
        this.invAccTest.innerText = '' + evaluation.ppr_test;
        //  this.invConfTrain.innerText = ''+evaluation.inv_conf_train;
        //  this.invConfTest.innerText = ''+evaluation.inv_conf_test;
        this.accTrain.innerText = '' + evaluation.acc_train;
        this.accTest.innerText = '' + evaluation.acc_test;
        this.totalAccTest.innerText = '' + Number(evaluation.test_acc * 100).toFixed(2) + '%';
        this.totalAccTrain.innerText = '' + Number(evaluation.train_acc * 100).toFixed(2) + '%';
        this.baseTrainAcc = evaluation.train_acc;
        this.baseTestAcc = evaluation.test_acc;
    }
    setupUIControls() {
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
        /*
        this.runTsneButton.addEventListener('click', () => {
          if (this.dataSet.hasTSNERun) {
            this.dataSet.stopTSNE();
          } else {
            const delay = ms => new Promise(res => setTimeout(res, ms));
    
            //console.log(this.dataSet.hasTSNERun);
            this.dataSet.tSNEShouldKill = true;
            //console.log('here1');
            let act = async () => {
               await delay(500);
               this.runTSNE();
            };
            act();
          }
        });*/
        /*
        this.pauseTsneButton.addEventListener('click', () => {
          if (this.dataSet.tSNEShouldPause) {
            this.dataSet.tSNEShouldPause = false;
            this.pauseTsneButton.innerText = 'Pause';
            this.previousDVIButton.disabled = true;
            this.nextDVIButton.disabled = true;
            this.dataSet.tSNEShouldPauseAndCheck = false;
          } else {
            this.dataSet.tSNEShouldPause = true;
            this.pauseTsneButton.innerText = 'Resume';
            this.dataSet.tSNEJustPause = true;
            if (this.dataSet.tSNEIteration != 1) {
               this.previousDVIButton.disabled = false;
            }
            if (this.dataSet.tSNEIteration != this.dataSet.tSNETotalIter) {
              this.nextDVIButton.disabled = false;
            }
          }
        });*/
        this.previousDVIButton.addEventListener('click', () => {
            const msgId = logging.setModalMessage('loading...');
            this.nextDVIButton.disabled = true;
            this.previousDVIButton.disabled = true;
            this.jumpDVIButton.disabled = true;
            if (this.dataSet.tSNEIteration <= 2) {
                this.previousDVIButton.disabled = true;
            }
            this.dataSet.projectDVI(this.dataSet.tSNEIteration - 1, this.projector.inspectorPanel.currentPredicate, (iteration, evaluation, new_selection, indices, totalIter) => {
                /**
                 * get filter index
                 */
                //get search predicates or indices
                var filterIndices;
                filterIndices = [];
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
                    this.projector.onIterationChange(iteration);
                }
                else {
                    this.projector.onProjectionChanged();
                }
                if (this.dataSet.tSNEIteration > 1) {
                    this.previousDVIButton.disabled = false;
                }
                logging.setModalMessage(null, msgId);
                this.nextDVIButton.disabled = false;
                this.jumpDVIButton.disabled = false;
            });
        });
        this.nextDVIButton.addEventListener('click', () => {
            const msgId = logging.setModalMessage('loading...');
            this.nextDVIButton.disabled = true;
            this.previousDVIButton.disabled = true;
            this.jumpDVIButton.disabled = true;
            this.dataSet.projectDVI(this.dataSet.tSNEIteration + 1, this.projector.inspectorPanel.currentPredicate, (iteration, evaluation, newSelection, indices, totalIter) => {
                /**
                 * get filter index
                 */
                //get search predicates or indices
                if (iteration == null && evaluation == null) {
                    this.nextDVIButton.disabled = false;
                    return;
                }
                var filterIndices;
                filterIndices = [];
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
                    // this.projector.notifyProjectionPositionsUpdated(newSelection);
                    this.projector.notifyProjectionPositionsUpdated();
                    this.projector.onProjectionChanged();
                    this.projector.onIterationChange(iteration);
                    if (this.dataSet.tSNEIteration > 1) {
                        this.previousDVIButton.disabled = false;
                    }
                    if (this.dataSet.tSNETotalIter != this.dataSet.tSNEIteration) {
                        this.nextDVIButton.disabled = false;
                    }
                }
                else {
                    this.nextDVIButton.disabled = false;
                    this.projector.onProjectionChanged();
                }
                logging.setModalMessage(null, msgId);
                this.jumpDVIButton.disabled = false;
            });
        });
        this.jumpDVIButton.addEventListener('click', () => {
            if (this.iterationInput > this.dataSet.tSNETotalIter || this.iterationInput < 1) {
                logging.setErrorMessage("Invaild Input!", null);
                this.jumpDVIButton.disabled = false;
                return;
            }
            else if (this.iterationInput == this.dataSet.tSNEIteration) {
                logging.setWarningMessage("current iteration!");
                this.jumpDVIButton.disabled = false;
                // logging.setModalMessage(null, msgId);
                return;
            }
            this.jumpTo(this.iterationInput);
        });
        /*
        this.nextDVIButton.addEventListener('click', () => {
          if (this.dataSet.tSNEJustPause) {
            this.dataSet.tSNEJustPause = false;
          } else {
            this.dataSet.tSNEIteration ++;
          }
          this.dataSet.tSNEShouldPauseAndCheck = true;
          if(this.dataSet.tSNEIteration == this.dataSet.tSNETotalIter) {
            this.nextDVIButton.disabled = true;
          }
          if(!this.dataSet.hasTSNERun) {
            this.runTsneButton.innerText = 'Stop';
            this.runTsneButton.disabled = false;
            this.pauseTsneButton.innerText = 'Resume';
            this.pauseTsneButton.disabled = false;
            this.dataSet.tSNEShouldStop = false;
            this.dataSet.tSNEShouldPause = true;
            this.dataSet.hasTSNERun = true;
          }
          this.previousDVIButton.disabled = false;
        });*/
        /*
        this.perturbTsneButton.addEventListener('mousedown', () => {
          if (this.dataSet && this.projector) {
            this.dataSet.perturbTsne();
            this.projector.notifyProjectionPositionsUpdated();
            this.perturbInterval = window.setInterval(() => {
              this.dataSet.perturbTsne();
              this.projector.notifyProjectionPositionsUpdated();
            }, 100);
          }
        });
        this.perturbTsneButton.addEventListener('mouseup', () => {
          clearInterval(this.perturbInterval);
        });*/
        /*
        this.perplexitySlider.value = this.perplexity.toString();
        this.perplexitySlider.addEventListener('change', () =>
          this.updateTSNEPerplexityFromSliderChange()
        );
        this.updateTSNEPerplexityFromSliderChange();
        this.learningRateInput.addEventListener('change', () =>
          this.updateTSNELearningRateFromUIChange()
        );
        this.updateTSNELearningRateFromUIChange();
        this.superviseFactorInput.addEventListener('change', () =>
          this.updateTSNESuperviseFactorFromUIChange()
        );
        this.updateTSNESuperviseFactorFromUIChange();*/
        this.setupCustomProjectionInputFields();
        // TODO: figure out why `--paper-input-container-input` css mixin didn't
        // work.
        const inputs = this.root.querySelectorAll('paper-dropdown-menu paper-input input');
        for (let i = 0; i < inputs.length; i++) {
            inputs[i].style.fontSize = '14px';
        }
    }
    jumpTo(iterationInput) {
        const msgId = logging.setModalMessage('loading...');
        this.jumpDVIButton.disabled = true;
        this.nextDVIButton.disabled = true;
        this.previousDVIButton.disabled = true;
        this.dataSet.projectDVI(iterationInput, this.projector.inspectorPanel.currentPredicate, (iteration, evaluation, newSelection, indices, totalIter) => {
            /**
             * get filter index
             */
            //get search predicates or indices
            var filterIndices;
            filterIndices = [];
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
                // this.projector.notifyProjectionPositionsUpdated(newSelection);
                this.projector.notifyProjectionPositionsUpdated();
                this.projector.onProjectionChanged();
                this.projector.onIterationChange(iteration);
                if (this.dataSet.tSNEIteration > 1) {
                    this.previousDVIButton.disabled = false;
                }
                if (this.dataSet.tSNETotalIter != this.dataSet.tSNEIteration) {
                    this.nextDVIButton.disabled = false;
                }
            }
            else {
                this.nextDVIButton.disabled = false;
                this.projector.onProjectionChanged();
            }
            logging.setModalMessage(null, msgId);
            this.jumpDVIButton.disabled = false;
        });
    }
    retrainBySelections(iteration, selections, rejections) {
        const msgId = logging.setModalMessage('training and loading...');
        // Get the tensor.
        let percent = 0;
        this.timer = window.setInterval(() => {
            percent = percent + 0.1;
            logging.setModalMessage(`training and loading... ${Number(percent.toFixed(1))}%`, msgId);
            if (percent > 98) {
                clearInterval(this.timer);
            }
        }, 250);
        // let xhr = new XMLHttpRequest();
        // xhr.open('GET', tensorsPath);
        // xhr.responseType = 'arraybuffer';
        // xhr.onprogress = (ev) => {
        // };
        this.dataSet.reTrainByDVI(iteration, selections, rejections, (iteration, evaluation, new_selection, indices, totalIter) => {
            /**
             * get filter index
             */
            //get search predicates or indices
            var filterIndices;
            filterIndices = [];
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
                this.projector.onIterationChange(iteration);
                this.projector.initialTree();
            }
            else {
                this.projector.onProjectionChanged();
            }
            if (this.dataSet.tSNEIteration > 1) {
                this.previousDVIButton.disabled = false;
            }
            logging.setModalMessage(null, msgId);
            window.clearInterval(this.timer);
            this.nextDVIButton.disabled = false;
            this.jumpDVIButton.disabled = false;
        });
    }
    restoreUIFromBookmark(bookmark) {
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
            this.customProjectionXLeftInput.set(bookmark.customXLeftText, bookmark.customXLeftRegex);
        }
        if (this.customProjectionXRightInput) {
            this.customProjectionXRightInput.set(bookmark.customXRightText, bookmark.customXRightRegex);
        }
        if (this.customProjectionYUpInput) {
            this.customProjectionYUpInput.set(bookmark.customYUpText, bookmark.customYUpRegex);
        }
        if (this.customProjectionYDownInput) {
            this.customProjectionYDownInput.set(bookmark.customYDownText, bookmark.customYDownRegex);
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
    populateBookmarkFromUI(bookmark) {
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
    dataSetUpdated(dataSet, originalDataSet, dim) {
        this.dataSet = dataSet;
        this.originalDataSet = originalDataSet;
        this.dim = dim;
        const pointCount = dataSet == null ? 0 : dataSet.points.length;
        //const perplexity = Math.max(5, Math.ceil(Math.sqrt(pointCount) / 4));
        //this.perplexitySlider.value = perplexity.toString();
        //this.updateTSNEPerplexityFromSliderChange();
        this.clearCentroids();
        this.$$('#tsne-sampling').style.display =
            pointCount > TSNE_SAMPLE_SIZE ? null : 'none';
        const wasSampled = dataSet == null
            ? false
            : dataSet.dim[0] > PCA_SAMPLE_DIM || dataSet.dim[1] > PCA_SAMPLE_DIM;
        this.$$('#pca-sampling').style.display = wasSampled
            ? null
            : 'none';
        this.showTab('tsne');
    }
    _selectedLabelOptionChanged() {
        this.projector.setSelectedLabelOption(this.selectedLabelOption);
    }
    _selectedColorOptionNameChanged() {
        let colorOption;
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
        }
        else if (colorOption.items) {
            let items = colorOption.items.map((item) => {
                return {
                    color: colorOption.map(item.label),
                    label: item.label,
                    count: item.count,
                };
            });
            this.colorLegendRenderInfo = { items, thresholds: null };
        }
        else {
            this.colorLegendRenderInfo = {
                items: null,
                thresholds: colorOption.thresholds,
            };
        }
        this.projector.setSelectedColorOption(colorOption);
    }
    _DVITemporalStatusObserver() {
    }
    // TODO
    _selectedArchitectureChanged() {
        this.updateTrainTestRessult();
    }
    _selectedTotalEpochChanged() {
        window.selectedTotalEpoch = this.selectedTotalEpoch;
        this.updateTrainTestRessult();
    }
    _selectedLrChanged() {
        // TODO
        this.updateTrainTestRessult();
    }
    updateTrainTestRessult() {
        if (this.projector) {
            if (this.selectedArchitecture == 'ResNet-18' && this.selectedLr == '0.01') {
                this.projector.hiddenOrShowScatter('');
                if (this.totalAccTrain) {
                    this.totalAccTrain.innerText = '' + Number(this.baseTrainAcc * 100).toFixed(2) + '%';
                    this.totalAccTest.innerText = '' + Number(this.baseTestAcc * 100).toFixed(2) + '%';
                }
                this.projector.initialTree();
            }
            else if (this.selectedArchitecture == 'ResNet-18' && this.selectedLr == '0.1' && this.selectedTotalEpoch == 190) {
                this.projector.hiddenOrShowScatter('hidden');
                if (this.totalAccTrain) {
                    this.totalAccTrain.innerText = '95.66%';
                    this.totalAccTest.innerText = '78.23%';
                }
                this.projector.initialTree(this.selectedTotalEpoch);
            }
            else if (this.selectedArchitecture == 'ResNet-18' && this.selectedLr == '0.001' && this.selectedTotalEpoch == 190) {
                this.projector.hiddenOrShowScatter('hidden');
                if (this.totalAccTrain) {
                    this.totalAccTrain.innerText = '94.22%';
                    this.totalAccTest.innerText = '78.26%';
                }
                this.projector.initialTree(this.selectedTotalEpoch);
            }
            else if (this.selectedArchitecture == 'ResNet-34' && this.selectedLr == '0.01' && this.selectedTotalEpoch == 190) {
                this.projector.hiddenOrShowScatter('hidden');
                if (this.totalAccTrain) {
                    this.totalAccTrain.innerText = '98.23%';
                    this.totalAccTest.innerText = '78.61%';
                }
                this.projector.initialTree(this.selectedTotalEpoch);
            }
            else if (this.selectedArchitecture == 'VGG-18' && this.selectedLr == '0.01' && this.selectedTotalEpoch == 190) {
                this.projector.hiddenOrShowScatter('hidden');
                if (this.totalAccTrain) {
                    this.totalAccTrain.innerText = '96.38%';
                    this.totalAccTest.innerText = '79.93%';
                }
                this.projector.initialTree(this.selectedTotalEpoch);
            }
            else if (this.selectedTotalEpoch == 200 && !(this.selectedArchitecture == 'ResNet-18' && this.selectedLr == '0.01')) {
                this.projector.hiddenOrShowScatter('hidden');
                this.projector.initialTree(this.selectedTotalEpoch, true);
                if (this.totalAccTrain) {
                    this.totalAccTrain.innerText = '-' + '%';
                    this.totalAccTest.innerText = '-' + '%';
                }
            }
            else {
                this.projector.hiddenOrShowScatter('hidden');
                this.projector.initialTree(this.selectedTotalEpoch, true);
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
    metadataChanged(spriteAndMetadata, metadataFile) {
        // Project by options for custom projections.
        if (metadataFile != null) {
            // this.metadataFile = metadataFile;
        }
        this.updateMetadataUI(spriteAndMetadata.stats);
        if (this.selectedColorOptionName == null ||
            this.colorOptions.filter((c) => c.name === this.selectedColorOptionName)
                .length === 0) {
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
        this.customSelectedSearchByMetadataOption = this.searchByMetadataOptions[Math.max(0, searchByMetadataIndex)];
    }
    updateMetadataUI(columnStats) {
        // Label by options.
        let labelIndex = -1;
        this.labelOptions = columnStats.map((stats, i) => {
            // Make the default label by the first non-numeric column.
            if (!stats.isNumeric && labelIndex === -1) {
                labelIndex = i;
            }
            return stats.name;
        });
        if (this.selectedLabelOption == null ||
            this.labelOptions.filter((name) => name === this.selectedLabelOption)
                .length === 0) {
            this.selectedLabelOption = this.labelOptions[Math.max(0, labelIndex)];
        }
        if (this.metadataEditorColumn == null ||
            this.labelOptions.filter((name) => name === this.metadataEditorColumn)
                .length === 0) {
            this.metadataEditorColumn = this.labelOptions[Math.max(0, labelIndex)];
        }
        //Color by options.
        const standardColorOption = [{ name: 'No color map' }];
        const metadataColorOption = columnStats
            .filter((stats) => {
            return !stats.tooManyUniqueValues || stats.isNumeric;
        })
            .map((stats) => {
            let map;
            let items;
            let thresholds;
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
            }
            else {
                thresholds = [
                    { color: '#ffffdd', value: stats.min },
                    { color: '#1f2d86', value: stats.max },
                ];
                map = d3
                    .scaleLinear()
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
    showTab(id) {
        this.currentProjection = id;
        const tab = this.$$('.ink-tab[data-tab="' + id + '"]');
        const allTabs = this.root.querySelectorAll('.ink-tab');
        for (let i = 0; i < allTabs.length; i++) {
            util.classed(allTabs[i], 'active', false);
        }
        util.classed(tab, 'active', true);
        const allTabContent = this.root.querySelectorAll('.ink-panel-content');
        for (let i = 0; i < allTabContent.length; i++) {
            util.classed(allTabContent[i], 'active', false);
        }
        util.classed(this.$$('.ink-panel-content[data-panel="' + id + '"]'), 'active', true);
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
    beginProjection(projection) {
        if (this.polymerChangesTriggerReprojection === false) {
            return;
        }
        else if (projection === 'tsne') {
            this.showTSNE();
        }
        else if (projection === 'custom') {
            if (this.dataSet != null) {
                this.dataSet.stopTSNE();
            }
            this.computeAllCentroids();
            this.reprojectCustom();
        }
    }
    showTSNE() {
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
        const projection = new Projection('tsne', accessors, dimensionality, dataSet);
        this.projector.setProjection(projection);
        if (this.dataSet.hasTSNERun) {
            this.projector.notifyProjectionPositionsUpdated();
        }
    }
    reprojectCustom() {
        if (this.centroids == null ||
            this.centroids.xLeft == null ||
            this.centroids.xRight == null ||
            this.centroids.yUp == null ||
            this.centroids.yDown == null) {
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
    clearCentroids() {
        this.centroids = { xLeft: null, xRight: null, yUp: null, yDown: null };
        this.allCentroid = null;
    }
    _customSelectedSearchByMetadataOptionChanged(newVal, oldVal) {
        if (this.polymerChangesTriggerReprojection === false) {
            return;
        }
        if (this.currentProjection === 'custom') {
            this.computeAllCentroids();
            this.reprojectCustom();
        }
    }
    setupCustomProjectionInputFields() {
        this.customProjectionXLeftInput = this.setupCustomProjectionInputField('xLeft');
        this.customProjectionXRightInput = this.setupCustomProjectionInputField('xRight');
        this.customProjectionYUpInput = this.setupCustomProjectionInputField('yUp');
        this.customProjectionYDownInput = this.setupCustomProjectionInputField('yDown');
    }
    computeAllCentroids() {
        this.computeCentroid('xLeft');
        this.computeCentroid('xRight');
        this.computeCentroid('yUp');
        this.computeCentroid('yDown');
    }
    computeCentroid(name) {
        const input = this.$$('#' + name);
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
        }
        else {
            input.message = `${result.numMatches} matches.`;
        }
        this.centroids[name] = result.centroid;
        this.centroidValues[name] = value;
    }
    setupCustomProjectionInputField(name) {
        let input = this.$$('#' + name);
        input.registerInputChangedListener((input, inRegexMode) => {
            if (this.polymerChangesTriggerReprojection) {
                this.computeCentroid(name);
                this.reprojectCustom();
            }
        });
        return input;
    }
    getCentroid(pattern, inRegexMode) {
        if (pattern == null || pattern === '') {
            return { numMatches: 0 };
        }
        // Search by the original dataset since we often want to filter and project
        // only the nearest neighbors of A onto B-C where B and C are not nearest
        // neighbors of A.
        let accessor = (i) => this.originalDataSet.points[i].vector;
        let result = this.originalDataSet.query(pattern, inRegexMode, this.customSelectedSearchByMetadataOption);
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
};
ProjectionsPanel.template = template;
__decorate([
    property({ type: String, notify: true }),
    __metadata("design:type", String)
], ProjectionsPanel.prototype, "selectedColorOptionName", void 0);
__decorate([
    property({ type: String, notify: true }),
    __metadata("design:type", String)
], ProjectionsPanel.prototype, "selectedLabelOption", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], ProjectionsPanel.prototype, "metadataEditorColumn", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], ProjectionsPanel.prototype, "showForceCategoricalColorsCheckbox", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], ProjectionsPanel.prototype, "_showFilter", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], ProjectionsPanel.prototype, "selectedArchitecture", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], ProjectionsPanel.prototype, "selectedLr", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], ProjectionsPanel.prototype, "selectedTotalEpoch", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], ProjectionsPanel.prototype, "tSNEis3d", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], ProjectionsPanel.prototype, "superviseFactor", void 0);
__decorate([
    property({ type: Array }),
    __metadata("design:type", Array)
], ProjectionsPanel.prototype, "pcaComponents", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], ProjectionsPanel.prototype, "pcaX", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], ProjectionsPanel.prototype, "pcaY", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], ProjectionsPanel.prototype, "pcaZ", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], ProjectionsPanel.prototype, "customSelectedSearchByMetadataOption", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], ProjectionsPanel.prototype, "subjectModelPathEditorInput", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", Number)
], ProjectionsPanel.prototype, "resolutionEditorInput", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], ProjectionsPanel.prototype, "iterationEditorInput", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], ProjectionsPanel.prototype, "keepSearchPredicate", void 0);
__decorate([
    observe('selectedLabelOption'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProjectionsPanel.prototype, "_selectedLabelOptionChanged", null);
__decorate([
    observe('selectedColorOptionName'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProjectionsPanel.prototype, "_selectedColorOptionNameChanged", null);
__decorate([
    observe('temporalStatus'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProjectionsPanel.prototype, "_DVITemporalStatusObserver", null);
__decorate([
    observe('selectedArchitecture'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProjectionsPanel.prototype, "_selectedArchitectureChanged", null);
__decorate([
    observe('selectedTotalEpoch'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProjectionsPanel.prototype, "_selectedTotalEpochChanged", null);
__decorate([
    observe('selectedLr'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProjectionsPanel.prototype, "_selectedLrChanged", null);
__decorate([
    observe('customSelectedSearchByMetadataOption'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ProjectionsPanel.prototype, "_customSelectedSearchByMetadataOptionChanged", null);
ProjectionsPanel = __decorate([
    customElement('vz-projector-projections-panel')
], ProjectionsPanel);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLXByb2plY3Rpb25zLXBhbmVsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVuc29yYm9hcmQvcHJvamVjdG9yL3Z6LXByb2plY3Rvci1wcm9qZWN0aW9ucy1wYW5lbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7OztnRkFhZ0Y7O0FBRWhGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUNsRCxPQUFPLEVBQUUsYUFBYSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUt2RSxPQUFPLEtBQUssRUFBRSxNQUFNLElBQUksQ0FBQztBQUN6QixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNoRixPQUFPLHdDQUF3QyxDQUFDO0FBRWhELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNqRSxPQUFPLHNCQUFzQixDQUFDO0FBQzlCLE9BQU8sRUFFTCx1QkFBdUIsRUFDdkIsY0FBYyxFQUNkLGVBQWUsRUFDZixVQUFVLEVBTVYsZ0JBQWdCLEVBQ2hCLGdCQUFnQixHQUNqQixNQUFNLFFBQVEsQ0FBQztBQUNoQixPQUFPLEtBQUssTUFBTSxNQUFNLFVBQVUsQ0FBQztBQUNuQyxPQUFPLEtBQUssSUFBSSxNQUFNLFFBQVEsQ0FBQztBQUMvQixPQUFPLEtBQUssT0FBTyxNQUFNLFdBQVcsQ0FBQztBQUVyQyxNQUFNLGtCQUFrQixHQUFHLEVBQUUsQ0FBQztBQWM5Qjs7R0FFRztBQUVILElBQU0sZ0JBQWdCLEdBQXRCLE1BQU0sZ0JBQWlCLFNBQVEsa0JBQWtCLENBQUMsY0FBYyxDQUFDO0lBQWpFOztRQWFFLGdCQUFXLEdBQVksS0FBSyxDQUFBO1FBRTVCLHlCQUFvQixHQUFXLFdBQVcsQ0FBQTtRQUUxQyxlQUFVLEdBQVcsTUFBTSxDQUFBO1FBRTNCLHVCQUFrQixHQUFX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Q0FBQzs7OzswREFJckI7QUF1UkQ7SUFEQyxPQUFPLENBQUMsc0NBQXNDLENBQUM7Ozs7b0ZBUy9DO0FBMS9CRyxnQkFBZ0I7SUFEckIsYUFBYSxDQUFDLGdDQUFnQyxDQUFDO0dBQzFDLGdCQUFnQixDQXdrQ3JCIiwic291cmNlc0NvbnRlbnQiOlsiLyogQ29weXJpZ2h0IDIwMTYgVGhlIFRlbnNvckZsb3cgQXV0aG9ycy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbnRoaXMudXBkYXRlTWV0YWRhdGFVSSh0aGlzLnNwcml0ZUFuZE1ldGFkYXRhLnN0YXRzLCB0aGlzLm1ldGFkYXRhRmlsZSk7XG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5cbmltcG9ydCB7IFBvbHltZXJFbGVtZW50IH0gZnJvbSAnQHBvbHltZXIvcG9seW1lcic7XG5pbXBvcnQgeyBjdXN0b21FbGVtZW50LCBvYnNlcnZlLCBwcm9wZXJ0eSB9IGZyb20gJ0Bwb2x5bWVyL2RlY29yYXRvcnMnO1xuaW1wb3J0IHtcbiAgQ29sb3JMZWdlbmRUaHJlc2hvbGQsXG4gIENvbG9yTGVnZW5kUmVuZGVySW5mbyxcbn0gZnJvbSAnLi92ei1wcm9qZWN0b3ItbGVnZW5kJztcbmltcG9ydCAqIGFzIGQzIGZyb20gJ2QzJztcbmltcG9ydCB7IExlZ2FjeUVsZW1lbnRNaXhpbiB9IGZyb20gJy4uL2NvbXBvbmVudHMvcG9seW1lci9sZWdhY3lfZWxlbWVudF9taXhpbic7XG5pbXBvcnQgJy4uL2NvbXBvbmVudHMvcG9seW1lci9pcm9uc19hbmRfcGFwZXJzJztcblxuaW1wb3J0IHsgdGVtcGxhdGUgfSBmcm9tICcuL3Z6LXByb2plY3Rvci1wcm9qZWN0aW9ucy1wYW5lbC5odG1sJztcbmltcG9ydCAnLi92ei1wcm9qZWN0b3ItaW5wdXQnO1xuaW1wb3J0IHtcbiAgRGF0YVNldCxcbiAgZ2V0UHJvamVjdGlvbkNvbXBvbmVudHMsXG4gIFBDQV9TQU1QTEVfRElNLFxuICBQQ0FfU0FNUExFX1NJWkUsXG4gIFByb2plY3Rpb24sXG4gIFByb2plY3Rpb25UeXBlLFxuICBTcHJpdGVBbmRNZXRhZGF0YUluZm8sXG4gIENvbG9yT3B0aW9uLFxuICBDb2x1bW5TdGF0cyxcbiAgU3RhdGUsXG4gIFRTTkVfU0FNUExFX1NJWkUsXG4gIFVNQVBfU0FNUExFX1NJWkUsXG59IGZyb20gJy4vZGF0YSc7XG5pbXBvcnQgKiBhcyB2ZWN0b3IgZnJvbSAnLi92ZWN0b3InO1xuaW1wb3J0ICogYXMgdXRpbCBmcm9tICcuL3V0aWwnO1xuaW1wb3J0ICogYXMgbG9nZ2luZyBmcm9tICcuL2xvZ2dpbmcnO1xuXG5jb25zdCBOVU1fUENBX0NPTVBPTkVOVFMgPSAxMDtcblxudHlwZSBJbnB1dENvbnRyb2xOYW1lID0gJ3hMZWZ0JyB8ICd4UmlnaHQnIHwgJ3lVcCcgfCAneURvd24nO1xudHlwZSBDZW50cm9pZFJlc3VsdCA9IHtcbiAgY2VudHJvaWQ/OiB2ZWN0b3IuVmVjdG9yO1xuICBudW1NYXRjaGVzPzogbnVtYmVyO1xufTtcbnR5cGUgQ2VudHJvaWRzID0ge1xuICBba2V5OiBzdHJpbmddOiB2ZWN0b3IuVmVjdG9yO1xuICB4TGVmdDogdmVjdG9yLlZlY3RvcjtcbiAgeFJpZ2h0OiB2ZWN0b3IuVmVjdG9yO1xuICB5VXA6IHZlY3Rvci5WZWN0b3I7XG4gIHlEb3duOiB2ZWN0b3IuVmVjdG9yO1xufTtcbi8qKlxuICogQSBwb2x5bWVyIGNvbXBvbmVudCB3aGljaCBoYW5kbGVzIHRoZSBwcm9qZWN0aW9uIHRhYnMgaW4gdGhlIHByb2plY3Rvci5cbiAqL1xuQGN1c3RvbUVsZW1lbnQoJ3Z6LXByb2plY3Rvci1wcm9qZWN0aW9ucy1wYW5lbCcpXG5jbGFzcyBQcm9qZWN0aW9uc1BhbmVsIGV4dGVuZHMgTGVnYWN5RWxlbWVudE1peGluKFBvbHltZXJFbGVtZW50KSB7XG4gIHN0YXRpYyByZWFkb25seSB0ZW1wbGF0ZSA9IHRlbXBsYXRlO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IFN0cmluZywgbm90aWZ5OiB0cnVlIH0pXG4gIHNlbGVjdGVkQ29sb3JPcHRpb25OYW1lOiBzdHJpbmc7XG4gIEBwcm9wZXJ0eSh7IHR5cGU6IFN0cmluZywgbm90aWZ5OiB0cnVlIH0pXG4gIHNlbGVjdGVkTGFiZWxPcHRpb246IHN0cmluZztcbiAgQHByb3BlcnR5KHsgdHlwZTogU3RyaW5nIH0pXG4gIG1ldGFkYXRhRWRpdG9yQ29sdW1uOiBzdHJpbmc7XG4gIEBwcm9wZXJ0eSh7IHR5cGU6IEJvb2xlYW4gfSlcbiAgc2hvd0ZvcmNlQ2F0ZWdvcmljYWxDb2xvcnNDaGVja2JveDogYm9vbGVhbjtcblxuICBAcHJvcGVydHkoeyB0eXBlOiBCb29sZWFuIH0pXG4gIF9zaG93RmlsdGVyOiBib29sZWFuID0gZmFsc2VcbiAgQHByb3BlcnR5KHsgdHlwZTogU3RyaW5nIH0pXG4gIHNlbGVjdGVkQXJjaGl0ZWN0dXJlOiBzdHJpbmcgPSAnUmVzTmV0LTE4J1xuICBAcHJvcGVydHkoeyB0eXBlOiBTdHJpbmcgfSlcbiAgc2VsZWN0ZWRMcjogc3RyaW5nID0gJzAuMDEnXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IE51bWJlciB9KVxuICBzZWxlY3RlZFRvdGFsRXBvY2g6IG51bWJlciA9IDE5MFxuXG5cblxuICBAcHJvcGVydHkoeyB0eXBlOiBCb29sZWFuIH0pXG4gIHRTTkVpczNkOiBib29sZWFuID0gZmFsc2U7XG4gIEBwcm9wZXJ0eSh7IHR5cGU6IE51bWJlciB9KVxuICBzdXBlcnZpc2VGYWN0b3I6IG51bWJlciA9IDA7XG4gIC8vIFVNQVAgcGFyYW1ldGVyc1xuXG4gIC8vIFBDQSBwcm9qZWN0aW9uLlxuICBAcHJvcGVydHkoeyB0eXBlOiBBcnJheSB9KVxuICBwY2FDb21wb25lbnRzOiBBcnJheTx7XG4gICAgaWQ6IG51bWJlcjtcbiAgICBjb21wb25lbnROdW1iZXI6IG51bWJlcjtcbiAgICBwZXJjVmFyaWFuY2U6IHN0cmluZztcbiAgfT47XG4gIEBwcm9wZXJ0eSh7IHR5cGU6IE51bWJlciB9KVxuICBwY2FYOiBudW1iZXIgPSAwO1xuICBAcHJvcGVydHkoeyB0eXBlOiBOdW1iZXIgfSlcbiAgcGNhWTogbnVtYmVyID0gMTtcbiAgQHByb3BlcnR5KHsgdHlwZTogTnVtYmVyIH0pXG4gIHBjYVo6IG51bWJlciA9IDI7XG4gIC8vIEN1c3RvbSBwcm9qZWN0aW9uLlxuICBAcHJvcGVydHkoeyB0eXBlOiBTdHJpbmcgfSlcbiAgY3VzdG9tU2VsZWN0ZWRTZWFyY2hCeU1ldGFkYXRhT3B0aW9uOiBzdHJpbmc7XG5cbiAgQHByb3BlcnR5KHsgdHlwZTogU3RyaW5nIH0pXG4gIHN1YmplY3RNb2RlbFBhdGhFZGl0b3JJbnB1dDogc3RyaW5nID0gXCJcIjtcblxuICBAcHJvcGVydHkoeyB0eXBlOiBTdHJpbmcgfSlcbiAgcmVzb2x1dGlvbkVkaXRvcklucHV0OiBudW1iZXI7XG5cbiAgQHByb3BlcnR5KHsgdHlwZTogTnVtYmVyIH0pXG4gIGl0ZXJhdGlvbkVkaXRvcklucHV0OiBudW1iZXI7XG5cbiAgQHByb3BlcnR5KHsgdHlwZTogQm9vbGVhbiB9KVxuICBrZWVwU2VhcmNoUHJlZGljYXRlOiBib29sZWFuID0gdHJ1ZTtcbiAgLy8gRGVjaWRlIHdldGhlciB0byBrZWVwIGluZGljZXMgb3Igc2VhcmNoIHByZWRpY2F0ZXMsIHRydWUgcmVwcmVzZW50cyBzZWFyY2ggcHJlZGljYXRlc1xuXG4gIHRlbXBvcmFsU3RhdHVzOiBib29sZWFuID0gdHJ1ZTsgLy90cnVlIGZvciBrZWVwU2VhcmNoUHJlZGljYXRlXG5cbiAgcHJpdmF0ZSBwcm9qZWN0b3I6IGFueTsgLy8gUHJvamVjdG9yOyB0eXBlIG9taXR0ZWQgYi9jIExlZ2FjeUVsZW1lbnRcbiAgcHJpdmF0ZSBsYWJlbE9wdGlvbnM6IHN0cmluZ1tdO1xuICBwcml2YXRlIGNvbG9yT3B0aW9uczogQ29sb3JPcHRpb25bXTtcbiAgcHJpdmF0ZSBjdXJyZW50UHJvamVjdGlvbjogUHJvamVjdGlvblR5cGU7XG4gIHByaXZhdGUgcG9seW1lckNoYW5nZXNUcmlnZ2VyUmVwcm9qZWN0aW9uOiBib29sZWFuO1xuICBwcml2YXRlIGRhdGFTZXQ6IERhdGFTZXQ7XG4gIHByaXZhdGUgb3JpZ2luYWxEYXRhU2V0OiBEYXRhU2V0O1xuICBwcml2YXRlIGRpbTogbnVtYmVyO1xuICAvKiogVC1TTkUgcGVycGxleGl0eS4gUm91Z2hseSBob3cgbWFueSBuZWlnaGJvcnMgZWFjaCBwb2ludCBpbmZsdWVuY2VzLiAqL1xuICBwcml2YXRlIHBlcnBsZXhpdHk6IG51bWJlcjtcbiAgLyoqIFQtU05FIGxlYXJuaW5nIHJhdGUuICovXG4gIHByaXZhdGUgbGVhcm5pbmdSYXRlOiBudW1iZXI7XG4gIC8qKiBULVNORSBwZXJ0dXJiIGludGVydmFsIGlkZW50aWZpZXIsIHJlcXVpcmVkIHRvIHRlcm1pbmF0ZSBwZXJ0dXJiYXRpb24uICovXG4gIHByaXZhdGUgcGVydHVyYkludGVydmFsOiBudW1iZXI7XG4gIHByaXZhdGUgc2VhcmNoQnlNZXRhZGF0YU9wdGlvbnM6IHN0cmluZ1tdO1xuICAvKiogQ2VudHJvaWRzIGZvciBjdXN0b20gcHJvamVjdGlvbnMuICovXG4gIHByaXZhdGUgY2VudHJvaWRWYWx1ZXM6IGFueTtcbiAgcHJpdmF0ZSBjZW50cm9pZHM6IENlbnRyb2lkcztcbiAgLyoqIFRoZSBjZW50cm9pZCBhY3Jvc3MgYWxsIHBvaW50cy4gKi9cbiAgcHJpdmF0ZSBhbGxDZW50cm9pZDogbnVtYmVyW107XG4gIC8qKiBQb2x5bWVyIGVsZW1lbnRzLiAqL1xuICBwcml2YXRlIHJ1blRzbmVCdXR0b246IEhUTUxCdXR0b25FbGVtZW50O1xuICBwcml2YXRlIHBhdXNlVHNuZUJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIC8vcHJpdmF0ZSBwZXJ0dXJiVHNuZUJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHByaXZhdGUgcHJldmlvdXNEVklCdXR0b246IEhUTUxCdXR0b25FbGVtZW50O1xuICBwcml2YXRlIG5leHREVklCdXR0b246IEhUTUxCdXR0b25FbGVtZW50O1xuICBwcml2YXRlIGp1bXBEVklCdXR0b246IEhUTUxCdXR0b25FbGVtZW50O1xuICAvL3ByaXZhdGUgcGVycGxleGl0eVNsaWRlcjogSFRNTElucHV0RWxlbWVudDtcbiAgLy9wcml2YXRlIGxlYXJuaW5nUmF0ZUlucHV0OiBIVE1MSW5wdXRFbGVtZW50O1xuICAvL3ByaXZhdGUgc3VwZXJ2aXNlRmFjdG9ySW5wdXQ6IEhUTUxJbnB1dEVsZW1lbnQ7XG4gIHByaXZhdGUgekRyb3Bkb3duOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBpdGVyYXRpb25MYWJlbFRzbmU6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIHRvdGFsSXRlcmF0aW9uTGFiZWxEVkk6IEhUTUxFbGVtZW50O1xuXG4gIHByaXZhdGUgY3VzdG9tUHJvamVjdGlvblhMZWZ0SW5wdXQ6IGFueTsgLy8gUHJvamVjdG9ySW5wdXQ7IHR5cGUgb21taXRlZFxuICBwcml2YXRlIGN1c3RvbVByb2plY3Rpb25YUmlnaHRJbnB1dDogYW55OyAvLyBQcm9qZWN0b3JJbnB1dDsgdHlwZSBvbW1pdGVkXG4gIHByaXZhdGUgY3VzdG9tUHJvamVjdGlvbllVcElucHV0OiBhbnk7IC8vIFByb2plY3RvcklucHV0OyB0eXBlIG9tbWl0ZWRcbiAgcHJpdmF0ZSBjdXN0b21Qcm9qZWN0aW9uWURvd25JbnB1dDogYW55OyAvLyBQcm9qZWN0b3JJbnB1dDsgdHlwZSBvbW1pdGVkXG5cblxuICBwcml2YXRlIGNvbG9yTGVnZW5kUmVuZGVySW5mbzogQ29sb3JMZWdlbmRSZW5kZXJJbmZvO1xuICAvKkV2YWx1YXRpb24gSW5mb3JtYXRpb24qL1xuICBwcml2YXRlIG5uVHJhaW4xNTogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgbm5UZXN0MTU6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGJvdW5kVHJhaW4xNTogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgYm91bmRUZXN0MTU6IEhUTUxFbGVtZW50O1xuICAvKlxuICBwcml2YXRlIGludk5uVHJhaW4xMDogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgaW52Tm5UcmFpbjE1OiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBpbnZOblRyYWluMzA6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGludk5uVGVzdDEwOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBpbnZOblRlc3QxNTogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgaW52Tm5UZXN0MzA6IEhUTUxFbGVtZW50O1xuICAqL1xuICBwcml2YXRlIGludkFjY1RyYWluOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBpbnZBY2NUZXN0OiBIVE1MRWxlbWVudDtcbiAgLy8gcHJpdmF0ZSBpbnZDb25mVHJhaW46IEhUTUxFbGVtZW50O1xuICAvLyBwcml2YXRlIGludkNvbmZUZXN0OiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBhY2NUcmFpbjogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgYWNjVGVzdDogSFRNTEVsZW1lbnQ7XG5cbiAgcHJpdmF0ZSBpdGVyYXRpb25JbnB1dDogbnVtYmVyO1xuXG4gIHByaXZhdGUgbGVhcm5pbmdSYXRlTGlzdDogc3RyaW5nW107XG4gIHByaXZhdGUgYXJjaGl0ZWN0dXJlTGlzdDogc3RyaW5nW107XG4gIHByaXZhdGUgdG90YWxFcG9jaExpc3Q6IG51bWJlcltdXG5cbiAgcHJpdmF0ZSB0b3RhbEFjY1RyYWluOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSB0b3RhbEFjY1Rlc3Q6IEhUTUxFbGVtZW50O1xuXG4gIHByaXZhdGUgYmFzZVRyYWluQWNjOiBhbnk7XG4gIHByaXZhdGUgYmFzZVRlc3RBY2M6IGFueTtcblxuICBwcml2YXRlIHRpbWVyOiBhbnk7XG5cbiAgaW5pdGlhbGl6ZShwcm9qZWN0b3I6IGFueSkge1xuICAgIHRoaXMucG9seW1lckNoYW5nZXNUcmlnZ2VyUmVwcm9qZWN0aW9uID0gdHJ1ZTtcbiAgICB0aGlzLnByb2plY3RvciA9IHByb2plY3RvcjtcbiAgICAvLyBTZXQgdXAgVFNORSBwcm9qZWN0aW9ucy5cbiAgICB0aGlzLnBlcnBsZXhpdHkgPSAzMDtcbiAgICB0aGlzLmxlYXJuaW5nUmF0ZSA9IDEwO1xuICAgIC8vIFNldHVwIEN1c3RvbSBwcm9qZWN0aW9ucy5cbiAgICB0aGlzLmNlbnRyb2lkVmFsdWVzID0geyB4TGVmdDogbnVsbCwgeFJpZ2h0OiBudWxsLCB5VXA6IG51bGwsIHlEb3duOiBudWxsIH07XG4gICAgdGhpcy5jbGVhckNlbnRyb2lkcygpO1xuICAgIHRoaXMuc2V0dXBVSUNvbnRyb2xzKCk7XG4gIH1cblxuICByZWFkeSgpIHtcbiAgICBzdXBlci5yZWFkeSgpO1xuICAgIHRoaXMubGVhcm5pbmdSYXRlTGlzdCA9IFsnMC4xJywgJzAuMDEnLCAnMC4wMDEnXVxuICAgIHRoaXMuYXJjaGl0ZWN0dXJlTGlzdCA9IFsnUmVzTmV0LTE4JywgJ1Jlc05ldC0zNCcsICdWR0ctMTgnXVxuICAgIHRoaXMudG90YWxFcG9jaExpc3QgPSBbMTkwLCAyMDBdXG4gICAgdGhpcy5fc2hvd0ZpbHRlciA9IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS50YXNrVHlwZSA9PSAnYW5vcm1hbHkgZGV0ZWN0aW9uJyAmJiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudXNlcm5hbWUgIT09ICd0dXRvcmlhbCdcbiAgICB0aGlzLnpEcm9wZG93biA9IHRoaXMuJCQoJyN6LWRyb3Bkb3duJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgLy90aGlzLnJ1blRzbmVCdXR0b24gPSB0aGlzLiQkKCcucnVuLXRzbmUnKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcbiAgICAvL3RoaXMucnVuVHNuZUJ1dHRvbi5pbm5lclRleHQgPSAnUnVuJztcbiAgICAvLyB0aGlzLnBhdXNlVHNuZUJ1dHRvbiA9IHRoaXMuJCQoJy5wYXVzZS10c25lJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gICAgLy90aGlzLnBhdXNlVHNuZUJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgLy90aGlzLnBlcnR1cmJUc25lQnV0dG9uID0gdGhpcy4kJCgnLnBlcnR1cmItdHNuZScpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuICAgIHRoaXMucHJldmlvdXNEVklCdXR0b24gPSB0aGlzLiQkKCcucHJldmlvdXMtZHZpJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gICAgdGhpcy5wcmV2aW91c0RWSUJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgdGhpcy5uZXh0RFZJQnV0dG9uID0gdGhpcy4kJCgnLm5leHQtZHZpJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gICAgdGhpcy5qdW1wRFZJQnV0dG9uID0gdGhpcy4kJCgnLmp1bXAtZHZpJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gICAgdGhpcy5qdW1wRFZJQnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcblxuICAgIHRoaXMudGltZXIgPSBudWxsXG5cbiAgICAvL3RoaXMubmV4dERWSUJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgLy90aGlzLnBlcnBsZXhpdHlTbGlkZXIgPSB0aGlzLiQkKCcjcGVycGxleGl0eS1zbGlkZXInKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xuICAgIC8qXG4gICAgdGhpcy5sZWFybmluZ1JhdGVJbnB1dCA9IHRoaXMuJCQoXG4gICAgICAnI2xlYXJuaW5nLXJhdGUtc2xpZGVyJ1xuICAgICkgYXMgSFRNTElucHV0RWxlbWVudDtcbiAgICB0aGlzLnN1cGVydmlzZUZhY3RvcklucHV0ID0gdGhpcy4kJChcbiAgICAgICcjc3VwZXJ2aXNlLWZhY3Rvci1zbGlkZXInXG4gICAgKSBhcyBIVE1MSW5wdXRFbGVtZW50OyovXG5cbiAgICB0aGlzLml0ZXJhdGlvbkxhYmVsVHNuZSA9IHRoaXMuJCQoJy5ydW4tdHNuZS1pdGVyJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgdGhpcy50b3RhbEl0ZXJhdGlvbkxhYmVsRFZJID0gdGhpcy4kJCgnLmR2aS10b3RhbC1pdGVyJykgYXMgSFRNTEVsZW1lbnQ7XG5cblxuICAgIC8qZXZhbHVhdGlvbiBpbmZvcm1hdGlvbiovXG4gICAgdGhpcy5ublRyYWluMTUgPSB0aGlzLiQkKCcubm5fdHJhaW5fMTUnKSBhcyBIVE1MRWxlbWVudDtcbiAgICB0aGlzLm5uVGVzdDE1ID0gdGhpcy4kJCgnLm5uX3Rlc3RfMTUnKSBhcyBIVE1MRWxlbWVudDtcbiAgICB0aGlzLmJvdW5kVHJhaW4xNSA9IHRoaXMuJCQoJy5ib3VuZF90cmFpbl8xNScpIGFzIEhUTUxFbGVtZW50O1xuICAgIHRoaXMuYm91bmRUZXN0MTUgPSB0aGlzLiQkKCcuYm91bmRfdGVzdF8xNScpIGFzIEhUTUxFbGVtZW50O1xuXG4gICAgdGhpcy5pbnZBY2NUcmFpbiA9IHRoaXMuJCQoJy5pbnZfYWNjX3RyYWluJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgdGhpcy5pbnZBY2NUZXN0ID0gdGhpcy4kJCgnLmludl9hY2NfdGVzdCcpIGFzIEhUTUxFbGVtZW50O1xuICAgIC8vIHRoaXMuaW52Q29uZlRyYWluID0gdGhpcy4kJCgnLmludl9jb25mX3RyYWluJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgLy8gdGhpcy5pbnZDb25mVGVzdCA9IHRoaXMuJCQoJy5pbnZfY29uZl90ZXN0JykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgdGhpcy5hY2NUcmFpbiA9IHRoaXMuJCQoJy5hY2NfdHJhaW4nKSBhcyBIVE1MRWxlbWVudDtcbiAgICB0aGlzLmFjY1Rlc3QgPSB0aGlzLiQkKCcuYWNjX3Rlc3QnKSBhcyBIVE1MRWxlbWVudDtcbiAgICB0aGlzLnRvdGFsQWNjVHJhaW4gPSB0aGlzLiQkKCcudG90YWxfYWNjX3RyYWluJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgdGhpcy50b3RhbEFjY1Rlc3QgPSB0aGlzLiQkKCcudG90YWxfYWNjX3Rlc3QnKSBhcyBIVE1MRWxlbWVudDtcbiAgICBpZiAod2luZG93LnNlc3Npb25TdG9yYWdlLnRhc2tUeXBlID09ICdhbm9ybWFseSBkZXRlY3Rpb24nKSB7XG4gICAgICB0aGlzLnN1YmplY3RNb2RlbFBhdGhFZGl0b3JJbnB1dCA9IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS51bm9ybWFseV9jb250ZW50X3BhdGhcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zdWJqZWN0TW9kZWxQYXRoRWRpdG9ySW5wdXQgPSB3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uubm9ybWFsX2NvbnRlbnRfcGF0aFxuICAgIH1cbiAgICB3aW5kb3cubW9kZWxNYXRoID0gdGhpcy5zdWJqZWN0TW9kZWxQYXRoRWRpdG9ySW5wdXRcbiAgICBpZiAodGhpcy5kYXRhU2V0KSB7XG4gICAgICB0aGlzLmRhdGFTZXQuRFZJc3ViamVjdE1vZGVsUGF0aCA9IHRoaXMuc3ViamVjdE1vZGVsUGF0aEVkaXRvcklucHV0O1xuICAgIH1cbiAgfVxuICBkaXNhYmxlUG9seW1lckNoYW5nZXNUcmlnZ2VyUmVwcm9qZWN0aW9uKCkge1xuICAgIHRoaXMucG9seW1lckNoYW5nZXNUcmlnZ2VyUmVwcm9qZWN0aW9uID0gZmFsc2U7XG4gIH1cbiAgZW5hYmxlUG9seW1lckNoYW5nZXNUcmlnZ2VyUmVwcm9qZWN0aW9uKCkge1xuICAgIHRoaXMucG9seW1lckNoYW5nZXNUcmlnZ2VyUmVwcm9qZWN0aW9uID0gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgc3ViamVjdE1vZGVsUGF0aEVkaXRvcklucHV0Q2hhbmdlKCkge1xuICAgIHdpbmRvdy5tb2RlbE1hdGggPSB0aGlzLnN1YmplY3RNb2RlbFBhdGhFZGl0b3JJbnB1dFxuICAgIGlmICh3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudGFza1R5cGUgPT0gJ2Fub3JtYWx5IGRldGVjdGlvbicpIHtcbiAgICAgIHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZXRJdGVtKCd1bm9ybWFseV9jb250ZW50X3BhdGgnLCB0aGlzLnN1YmplY3RNb2RlbFBhdGhFZGl0b3JJbnB1dClcbiAgICB9IGVsc2Uge1xuICAgICAgd2luZG93LnNlc3Npb25TdG9yYWdlLnNldEl0ZW0oJ25vcm1hbF9jb250ZW50X3BhdGgnLCB0aGlzLnN1YmplY3RNb2RlbFBhdGhFZGl0b3JJbnB1dClcbiAgICB9XG4gICAgdGhpcy5kYXRhU2V0LkRWSXN1YmplY3RNb2RlbFBhdGggPSB0aGlzLnN1YmplY3RNb2RlbFBhdGhFZGl0b3JJbnB1dDtcbiAgfVxuICBwcml2YXRlIHJlc29sdXRpb25FZGl0b3JJbnB1dENoYW5nZSgpIHtcbiAgICB0aGlzLmRhdGFTZXQuRFZJUmVzb2x1dGlvbiA9IHRoaXMucmVzb2x1dGlvbkVkaXRvcklucHV0O1xuICB9XG4gIHByaXZhdGUgaXRlcmF0aW9uRWRpdG9ySW5wdXRDaGFuZ2UoKSB7XG4gICAgdGhpcy5pdGVyYXRpb25JbnB1dCA9IE51bWJlcih0aGlzLml0ZXJhdGlvbkVkaXRvcklucHV0KTtcbiAgICBjb25zb2xlLmxvZyh0aGlzLml0ZXJhdGlvbklucHV0KTtcbiAgfVxuICBwcml2YXRlIHVwZGF0ZUV2YWx1YXRpb25JbmZvcm1hdGlvbihldmFsdWF0aW9uOiBhbnkpIHtcbiAgICB0aGlzLm5uVHJhaW4xNS5pbm5lclRleHQgPSAnJyArIGV2YWx1YXRpb24ubm5fdHJhaW5fMTU7XG4gICAgdGhpcy5ublRlc3QxNS5pbm5lclRleHQgPSAnJyArIGV2YWx1YXRpb24ubm5fdGVzdF8xNTtcbiAgICB0aGlzLmJvdW5kVHJhaW4xNS5pbm5lclRleHQgPSAnJyArIGV2YWx1YXRpb24uYm91bmRfdHJhaW5fMTU7XG4gICAgdGhpcy5ib3VuZFRlc3QxNS5pbm5lclRleHQgPSAnJyArIGV2YWx1YXRpb24uYm91bmRfdGVzdF8xNTtcbiAgICAvKlxuICAgIHRoaXMuaW52Tm5UcmFpbjEwLmlubmVyVGV4dCA9ICcnK2V2YWx1YXRpb24uaW52X25uX3RyYWluXzEwO1xuICAgIHRoaXMuaW52Tm5UcmFpbjE1LmlubmVyVGV4dCA9ICcnK2V2YWx1YXRpb24uaW52X25uX3RyYWluXzE1O1xuICAgIHRoaXMuaW52Tm5UcmFpbjMwLmlubmVyVGV4dCA9ICcnK2V2YWx1YXRpb24uaW52X25uX3RyYWluXzMwO1xuICAgIHRoaXMuaW52Tm5UZXN0MTAuaW5uZXJUZXh0ID0gJycrZXZhbHVhdGlvbi5pbnZfbm5fdGVzdF8xMDtcbiAgICB0aGlzLmludk5uVGVzdDE1LmlubmVyVGV4dCA9ICcnK2V2YWx1YXRpb24uaW52X25uX3Rlc3RfMTU7XG4gICAgdGhpcy5pbnZOblRlc3QzMC5pbm5lclRleHQgPSAnJytldmFsdWF0aW9uLmludl9ubl90ZXN0XzMwO1xuICAgICovXG4gICAgdGhpcy5pbnZBY2NUcmFpbi5pbm5lclRleHQgPSAnJyArIGV2YWx1YXRpb24ucHByX3RyYWluO1xuICAgIHRoaXMuaW52QWNjVGVzdC5pbm5lclRleHQgPSAnJyArIGV2YWx1YXRpb24ucHByX3Rlc3Q7XG4gICAgLy8gIHRoaXMuaW52Q29uZlRyYWluLmlubmVyVGV4dCA9ICcnK2V2YWx1YXRpb24uaW52X2NvbmZfdHJhaW47XG4gICAgLy8gIHRoaXMuaW52Q29uZlRlc3QuaW5uZXJUZXh0ID0gJycrZXZhbHVhdGlvbi5pbnZfY29uZl90ZXN0O1xuICAgIHRoaXMuYWNjVHJhaW4uaW5uZXJUZXh0ID0gJycgKyBldmFsdWF0aW9uLmFjY190cmFpbjtcbiAgICB0aGlzLmFjY1Rlc3QuaW5uZXJUZXh0ID0gJycgKyBldmFsdWF0aW9uLmFjY190ZXN0O1xuICAgIHRoaXMudG90YWxBY2NUZXN0LmlubmVyVGV4dCA9ICcnICsgTnVtYmVyKGV2YWx1YXRpb24udGVzdF9hY2MgKiAxMDApLnRvRml4ZWQoMikgKyAnJSc7XG4gICAgdGhpcy50b3RhbEFjY1RyYWluLmlubmVyVGV4dCA9ICcnICsgTnVtYmVyKGV2YWx1YXRpb24udHJhaW5fYWNjICogMTAwKS50b0ZpeGVkKDIpICsgJyUnO1xuICAgIHRoaXMuYmFzZVRyYWluQWNjID0gZXZhbHVhdGlvbi50cmFpbl9hY2NcbiAgICB0aGlzLmJhc2VUZXN0QWNjID0gZXZhbHVhdGlvbi50ZXN0X2FjY1xuICB9XG4gIHByaXZhdGUgc2V0dXBVSUNvbnRyb2xzKCkge1xuICAgIHtcbiAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgICAgY29uc3QgaW5rVGFicyA9IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yQWxsKCcuaW5rLXRhYicpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbmtUYWJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlua1RhYnNbaV0uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgbGV0IGlkID0gdGhpcy5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGFiJyk7XG4gICAgICAgICAgc2VsZi5zaG93VGFiKGlkKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICB0aGlzLnJ1blRzbmVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICBpZiAodGhpcy5kYXRhU2V0Lmhhc1RTTkVSdW4pIHtcbiAgICAgICAgdGhpcy5kYXRhU2V0LnN0b3BUU05FKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBkZWxheSA9IG1zID0+IG5ldyBQcm9taXNlKHJlcyA9PiBzZXRUaW1lb3V0KHJlcywgbXMpKTtcblxuICAgICAgICAvL2NvbnNvbGUubG9nKHRoaXMuZGF0YVNldC5oYXNUU05FUnVuKTtcbiAgICAgICAgdGhpcy5kYXRhU2V0LnRTTkVTaG91bGRLaWxsID0gdHJ1ZTtcbiAgICAgICAgLy9jb25zb2xlLmxvZygnaGVyZTEnKTtcbiAgICAgICAgbGV0IGFjdCA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgYXdhaXQgZGVsYXkoNTAwKTtcbiAgICAgICAgICAgdGhpcy5ydW5UU05FKCk7XG4gICAgICAgIH07XG4gICAgICAgIGFjdCgpO1xuICAgICAgfVxuICAgIH0pOyovXG4gICAgLypcbiAgICB0aGlzLnBhdXNlVHNuZUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgIGlmICh0aGlzLmRhdGFTZXQudFNORVNob3VsZFBhdXNlKSB7XG4gICAgICAgIHRoaXMuZGF0YVNldC50U05FU2hvdWxkUGF1c2UgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5wYXVzZVRzbmVCdXR0b24uaW5uZXJUZXh0ID0gJ1BhdXNlJztcbiAgICAgICAgdGhpcy5wcmV2aW91c0RWSUJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgICAgIHRoaXMubmV4dERWSUJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgICAgIHRoaXMuZGF0YVNldC50U05FU2hvdWxkUGF1c2VBbmRDaGVjayA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5kYXRhU2V0LnRTTkVTaG91bGRQYXVzZSA9IHRydWU7XG4gICAgICAgIHRoaXMucGF1c2VUc25lQnV0dG9uLmlubmVyVGV4dCA9ICdSZXN1bWUnO1xuICAgICAgICB0aGlzLmRhdGFTZXQudFNORUp1c3RQYXVzZSA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLmRhdGFTZXQudFNORUl0ZXJhdGlvbiAhPSAxKSB7XG4gICAgICAgICAgIHRoaXMucHJldmlvdXNEVklCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5kYXRhU2V0LnRTTkVJdGVyYXRpb24gIT0gdGhpcy5kYXRhU2V0LnRTTkVUb3RhbEl0ZXIpIHtcbiAgICAgICAgICB0aGlzLm5leHREVklCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pOyovXG4gICAgdGhpcy5wcmV2aW91c0RWSUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgIGNvbnN0IG1zZ0lkID0gbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UoJ2xvYWRpbmcuLi4nKTtcbiAgICAgIHRoaXMubmV4dERWSUJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgICB0aGlzLnByZXZpb3VzRFZJQnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuanVtcERWSUJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgICBpZiAodGhpcy5kYXRhU2V0LnRTTkVJdGVyYXRpb24gPD0gMikge1xuICAgICAgICB0aGlzLnByZXZpb3VzRFZJQnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5kYXRhU2V0LnByb2plY3REVkkodGhpcy5kYXRhU2V0LnRTTkVJdGVyYXRpb24gLSAxLCB0aGlzLnByb2plY3Rvci5pbnNwZWN0b3JQYW5lbC5jdXJyZW50UHJlZGljYXRlLFxuICAgICAgICAoaXRlcmF0aW9uOiBudW1iZXIgfCBudWxsLCBldmFsdWF0aW9uOiBhbnksIG5ld19zZWxlY3Rpb246IGFueVtdLCBpbmRpY2VzOiBudW1iZXJbXSwgdG90YWxJdGVyPzogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgLyoqXG4gICAgICAgICAgICogZ2V0IGZpbHRlciBpbmRleFxuICAgICAgICAgICAqL1xuICAgICAgICAgIC8vZ2V0IHNlYXJjaCBwcmVkaWNhdGVzIG9yIGluZGljZXNcbiAgICAgICAgICB2YXIgZmlsdGVySW5kaWNlczogbnVtYmVyW107XG4gICAgICAgICAgZmlsdGVySW5kaWNlcyA9IFtdXG4gICAgICAgICAgaWYgKHRoaXMudGVtcG9yYWxTdGF0dXMpIHtcbiAgICAgICAgICAgIC8vc2VhcmNoIHByZWRpY2F0ZVxuICAgICAgICAgICAgdGhpcy5wcm9qZWN0b3IuaW5zcGVjdG9yUGFuZWwuZmlsdGVySW5kaWNlcyA9IGluZGljZXM7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vaW5kaWNlc1xuICAgICAgICAgIGZpbHRlckluZGljZXMgPSB0aGlzLnByb2plY3Rvci5pbnNwZWN0b3JQYW5lbC5maWx0ZXJJbmRpY2VzO1xuICAgICAgICAgIC8vIFRPRE8gaW5pdGlsaXplIGRhdGFzZXQsIHNldCBpbnNwZWN0b3IgZmlsdGVyIGluZGljZXMgdG8gYmUgYWxsXG4gICAgICAgICAgdGhpcy5wcm9qZWN0b3IuZGF0YVNldC5zZXREVklGaWx0ZXJlZERhdGEoZmlsdGVySW5kaWNlcyk7XG4gICAgICAgICAgaWYgKGl0ZXJhdGlvbiAhPSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLml0ZXJhdGlvbkxhYmVsVHNuZS5pbm5lclRleHQgPSAnJyArIGl0ZXJhdGlvbjtcbiAgICAgICAgICAgIHRoaXMudG90YWxJdGVyYXRpb25MYWJlbERWSS5pbm5lclRleHQgPSAnJyArIHRvdGFsSXRlcjtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlRXZhbHVhdGlvbkluZm9ybWF0aW9uKGV2YWx1YXRpb24pO1xuICAgICAgICAgICAgLy8gdGhpcy5wcm9qZWN0b3Iubm90aWZ5UHJvamVjdGlvblBvc2l0aW9uc1VwZGF0ZWQobmV3X3NlbGVjdGlvbik7XG4gICAgICAgICAgICB0aGlzLnByb2plY3Rvci5ub3RpZnlQcm9qZWN0aW9uUG9zaXRpb25zVXBkYXRlZCgpO1xuICAgICAgICAgICAgdGhpcy5wcm9qZWN0b3Iub25Qcm9qZWN0aW9uQ2hhbmdlZCgpO1xuICAgICAgICAgICAgdGhpcy5wcm9qZWN0b3Iub25JdGVyYXRpb25DaGFuZ2UoaXRlcmF0aW9uKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5wcm9qZWN0b3Iub25Qcm9qZWN0aW9uQ2hhbmdlZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodGhpcy5kYXRhU2V0LnRTTkVJdGVyYXRpb24gPiAxKSB7XG4gICAgICAgICAgICB0aGlzLnByZXZpb3VzRFZJQnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIGxvZ2dpbmcuc2V0TW9kYWxNZXNzYWdlKG51bGwsIG1zZ0lkKTtcbiAgICAgICAgICB0aGlzLm5leHREVklCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICB0aGlzLmp1bXBEVklCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gICAgdGhpcy5uZXh0RFZJQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgY29uc3QgbXNnSWQgPSBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZSgnbG9hZGluZy4uLicpO1xuICAgICAgdGhpcy5uZXh0RFZJQnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJldmlvdXNEVklCdXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuICAgICAgdGhpcy5qdW1wRFZJQnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuZGF0YVNldC5wcm9qZWN0RFZJKHRoaXMuZGF0YVNldC50U05FSXRlcmF0aW9uICsgMSwgdGhpcy5wcm9qZWN0b3IuaW5zcGVjdG9yUGFuZWwuY3VycmVudFByZWRpY2F0ZSxcbiAgICAgICAgKGl0ZXJhdGlvbjogbnVtYmVyIHwgbnVsbCwgZXZhbHVhdGlvbjogYW55LCBuZXdTZWxlY3Rpb246IGFueVtdLCBpbmRpY2VzOiBudW1iZXJbXSwgdG90YWxJdGVyPzogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgLyoqXG4gICAgICAgICAgICogZ2V0IGZpbHRlciBpbmRleFxuICAgICAgICAgICAqL1xuICAgICAgICAgIC8vZ2V0IHNlYXJjaCBwcmVkaWNhdGVzIG9yIGluZGljZXNcbiAgICAgICAgICBpZiAoaXRlcmF0aW9uID09IG51bGwgJiYgZXZhbHVhdGlvbiA9PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLm5leHREVklCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgZmlsdGVySW5kaWNlczogbnVtYmVyW107XG4gICAgICAgICAgZmlsdGVySW5kaWNlcyA9IFtdXG4gICAgICAgICAgaWYgKHRoaXMudGVtcG9yYWxTdGF0dXMpIHtcbiAgICAgICAgICAgIC8vc2VhcmNoIHByZWRpY2F0ZVxuICAgICAgICAgICAgdGhpcy5wcm9qZWN0b3IuaW5zcGVjdG9yUGFuZWwuZmlsdGVySW5kaWNlcyA9IGluZGljZXM7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vaW5kaWNlc1xuICAgICAgICAgIGZpbHRlckluZGljZXMgPSB0aGlzLnByb2plY3Rvci5pbnNwZWN0b3JQYW5lbC5maWx0ZXJJbmRpY2VzO1xuXG4gICAgICAgICAgdGhpcy5wcm9qZWN0b3IuZGF0YVNldC5zZXREVklGaWx0ZXJlZERhdGEoZmlsdGVySW5kaWNlcyk7XG5cbiAgICAgICAgICBpZiAoaXRlcmF0aW9uICE9IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuaXRlcmF0aW9uTGFiZWxUc25lLmlubmVyVGV4dCA9ICcnICsgaXRlcmF0aW9uO1xuICAgICAgICAgICAgdGhpcy50b3RhbEl0ZXJhdGlvbkxhYmVsRFZJLmlubmVyVGV4dCA9ICcnICsgdG90YWxJdGVyO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVFdmFsdWF0aW9uSW5mb3JtYXRpb24oZXZhbHVhdGlvbik7XG4gICAgICAgICAgICAvLyB0aGlzLnByb2plY3Rvci5ub3RpZnlQcm9qZWN0aW9uUG9zaXRpb25zVXBkYXRlZChuZXdTZWxlY3Rpb24pO1xuICAgICAgICAgICAgdGhpcy5wcm9qZWN0b3Iubm90aWZ5UHJvamVjdGlvblBvc2l0aW9uc1VwZGF0ZWQoKTtcbiAgICAgICAgICAgIHRoaXMucHJvamVjdG9yLm9uUHJvamVjdGlvbkNoYW5nZWQoKTtcbiAgICAgICAgICAgIHRoaXMucHJvamVjdG9yLm9uSXRlcmF0aW9uQ2hhbmdlKGl0ZXJhdGlvbik7XG4gICAgICAgICAgICBpZiAodGhpcy5kYXRhU2V0LnRTTkVJdGVyYXRpb24gPiAxKSB7XG4gICAgICAgICAgICAgIHRoaXMucHJldmlvdXNEVklCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aGlzLmRhdGFTZXQudFNORVRvdGFsSXRlciAhPSB0aGlzLmRhdGFTZXQudFNORUl0ZXJhdGlvbikge1xuICAgICAgICAgICAgICB0aGlzLm5leHREVklCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5uZXh0RFZJQnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLnByb2plY3Rvci5vblByb2plY3Rpb25DaGFuZ2VkKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGxvZ2dpbmcuc2V0TW9kYWxNZXNzYWdlKG51bGwsIG1zZ0lkKTtcbiAgICAgICAgICB0aGlzLmp1bXBEVklCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gICAgdGhpcy5qdW1wRFZJQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXRlcmF0aW9uSW5wdXQgPiB0aGlzLmRhdGFTZXQudFNORVRvdGFsSXRlciB8fCB0aGlzLml0ZXJhdGlvbklucHV0IDwgMSkge1xuICAgICAgICBsb2dnaW5nLnNldEVycm9yTWVzc2FnZShcIkludmFpbGQgSW5wdXQhXCIsIG51bGwpO1xuICAgICAgICB0aGlzLmp1bXBEVklCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLml0ZXJhdGlvbklucHV0ID09IHRoaXMuZGF0YVNldC50U05FSXRlcmF0aW9uKSB7XG4gICAgICAgIGxvZ2dpbmcuc2V0V2FybmluZ01lc3NhZ2UoXCJjdXJyZW50IGl0ZXJhdGlvbiFcIik7XG4gICAgICAgIHRoaXMuanVtcERWSUJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgICAgICAvLyBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZShudWxsLCBtc2dJZCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMuanVtcFRvKHRoaXMuaXRlcmF0aW9uSW5wdXQpXG4gICAgfSk7XG5cblxuXG4gICAgLypcbiAgICB0aGlzLm5leHREVklCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICBpZiAodGhpcy5kYXRhU2V0LnRTTkVKdXN0UGF1c2UpIHtcbiAgICAgICAgdGhpcy5kYXRhU2V0LnRTTkVKdXN0UGF1c2UgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGF0YVNldC50U05FSXRlcmF0aW9uICsrO1xuICAgICAgfVxuICAgICAgdGhpcy5kYXRhU2V0LnRTTkVTaG91bGRQYXVzZUFuZENoZWNrID0gdHJ1ZTtcbiAgICAgIGlmKHRoaXMuZGF0YVNldC50U05FSXRlcmF0aW9uID09IHRoaXMuZGF0YVNldC50U05FVG90YWxJdGVyKSB7XG4gICAgICAgIHRoaXMubmV4dERWSUJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZighdGhpcy5kYXRhU2V0Lmhhc1RTTkVSdW4pIHtcbiAgICAgICAgdGhpcy5ydW5Uc25lQnV0dG9uLmlubmVyVGV4dCA9ICdTdG9wJztcbiAgICAgICAgdGhpcy5ydW5Uc25lQnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMucGF1c2VUc25lQnV0dG9uLmlubmVyVGV4dCA9ICdSZXN1bWUnO1xuICAgICAgICB0aGlzLnBhdXNlVHNuZUJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmRhdGFTZXQudFNORVNob3VsZFN0b3AgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5kYXRhU2V0LnRTTkVTaG91bGRQYXVzZSA9IHRydWU7XG4gICAgICAgIHRoaXMuZGF0YVNldC5oYXNUU05FUnVuID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRoaXMucHJldmlvdXNEVklCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICB9KTsqL1xuICAgIC8qXG4gICAgdGhpcy5wZXJ0dXJiVHNuZUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCAoKSA9PiB7XG4gICAgICBpZiAodGhpcy5kYXRhU2V0ICYmIHRoaXMucHJvamVjdG9yKSB7XG4gICAgICAgIHRoaXMuZGF0YVNldC5wZXJ0dXJiVHNuZSgpO1xuICAgICAgICB0aGlzLnByb2plY3Rvci5ub3RpZnlQcm9qZWN0aW9uUG9zaXRpb25zVXBkYXRlZCgpO1xuICAgICAgICB0aGlzLnBlcnR1cmJJbnRlcnZhbCA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5kYXRhU2V0LnBlcnR1cmJUc25lKCk7XG4gICAgICAgICAgdGhpcy5wcm9qZWN0b3Iubm90aWZ5UHJvamVjdGlvblBvc2l0aW9uc1VwZGF0ZWQoKTtcbiAgICAgICAgfSwgMTAwKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLnBlcnR1cmJUc25lQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCAoKSA9PiB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMucGVydHVyYkludGVydmFsKTtcbiAgICB9KTsqL1xuICAgIC8qXG4gICAgdGhpcy5wZXJwbGV4aXR5U2xpZGVyLnZhbHVlID0gdGhpcy5wZXJwbGV4aXR5LnRvU3RyaW5nKCk7XG4gICAgdGhpcy5wZXJwbGV4aXR5U2xpZGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+XG4gICAgICB0aGlzLnVwZGF0ZVRTTkVQZXJwbGV4aXR5RnJvbVNsaWRlckNoYW5nZSgpXG4gICAgKTtcbiAgICB0aGlzLnVwZGF0ZVRTTkVQZXJwbGV4aXR5RnJvbVNsaWRlckNoYW5nZSgpO1xuICAgIHRoaXMubGVhcm5pbmdSYXRlSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT5cbiAgICAgIHRoaXMudXBkYXRlVFNORUxlYXJuaW5nUmF0ZUZyb21VSUNoYW5nZSgpXG4gICAgKTtcbiAgICB0aGlzLnVwZGF0ZVRTTkVMZWFybmluZ1JhdGVGcm9tVUlDaGFuZ2UoKTtcbiAgICB0aGlzLnN1cGVydmlzZUZhY3RvcklucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+XG4gICAgICB0aGlzLnVwZGF0ZVRTTkVTdXBlcnZpc2VGYWN0b3JGcm9tVUlDaGFuZ2UoKVxuICAgICk7XG4gICAgdGhpcy51cGRhdGVUU05FU3VwZXJ2aXNlRmFjdG9yRnJvbVVJQ2hhbmdlKCk7Ki9cbiAgICB0aGlzLnNldHVwQ3VzdG9tUHJvamVjdGlvbklucHV0RmllbGRzKCk7XG4gICAgLy8gVE9ETzogZmlndXJlIG91dCB3aHkgYC0tcGFwZXItaW5wdXQtY29udGFpbmVyLWlucHV0YCBjc3MgbWl4aW4gZGlkbid0XG4gICAgLy8gd29yay5cbiAgICBjb25zdCBpbnB1dHMgPSB0aGlzLnJvb3QucXVlcnlTZWxlY3RvckFsbChcbiAgICAgICdwYXBlci1kcm9wZG93bi1tZW51IHBhcGVyLWlucHV0IGlucHV0J1xuICAgICk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIChpbnB1dHNbaV0gYXMgSFRNTEVsZW1lbnQpLnN0eWxlLmZvbnRTaXplID0gJzE0cHgnO1xuICAgIH1cbiAgfVxuXG4gIGp1bXBUbyhpdGVyYXRpb25JbnB1dCkge1xuICAgIGNvbnN0IG1zZ0lkID0gbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UoJ2xvYWRpbmcuLi4nKTtcbiAgICB0aGlzLmp1bXBEVklCdXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuICAgIHRoaXMubmV4dERWSUJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgdGhpcy5wcmV2aW91c0RWSUJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgdGhpcy5kYXRhU2V0LnByb2plY3REVkkoaXRlcmF0aW9uSW5wdXQsIHRoaXMucHJvamVjdG9yLmluc3BlY3RvclBhbmVsLmN1cnJlbnRQcmVkaWNhdGUsXG4gICAgICAoaXRlcmF0aW9uOiBudW1iZXIgfCBudWxsLCBldmFsdWF0aW9uOiBhbnksIG5ld1NlbGVjdGlvbjogYW55W10sIGluZGljZXM6IG51bWJlcltdLCB0b3RhbEl0ZXI/OiBudW1iZXIpID0+IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIGdldCBmaWx0ZXIgaW5kZXhcbiAgICAgICAgICovXG4gICAgICAgIC8vZ2V0IHNlYXJjaCBwcmVkaWNhdGVzIG9yIGluZGljZXNcbiAgICAgICAgdmFyIGZpbHRlckluZGljZXM6IG51bWJlcltdO1xuICAgICAgICBmaWx0ZXJJbmRpY2VzID0gW11cbiAgICAgICAgaWYgKHRoaXMudGVtcG9yYWxTdGF0dXMpIHtcbiAgICAgICAgICAvL3NlYXJjaCBwcmVkaWNhdGVcbiAgICAgICAgICB0aGlzLnByb2plY3Rvci5pbnNwZWN0b3JQYW5lbC5maWx0ZXJJbmRpY2VzID0gaW5kaWNlcztcbiAgICAgICAgfVxuICAgICAgICAvL2luZGljZXNcbiAgICAgICAgZmlsdGVySW5kaWNlcyA9IHRoaXMucHJvamVjdG9yLmluc3BlY3RvclBhbmVsLmZpbHRlckluZGljZXM7XG5cbiAgICAgICAgdGhpcy5wcm9qZWN0b3IuZGF0YVNldC5zZXREVklGaWx0ZXJlZERhdGEoZmlsdGVySW5kaWNlcyk7XG5cbiAgICAgICAgaWYgKGl0ZXJhdGlvbiAhPSBudWxsKSB7XG4gICAgICAgICAgdGhpcy5pdGVyYXRpb25MYWJlbFRzbmUuaW5uZXJUZXh0ID0gJycgKyBpdGVyYXRpb247XG4gICAgICAgICAgdGhpcy50b3RhbEl0ZXJhdGlvbkxhYmVsRFZJLmlubmVyVGV4dCA9ICcnICsgdG90YWxJdGVyO1xuICAgICAgICAgIHRoaXMudXBkYXRlRXZhbHVhdGlvbkluZm9ybWF0aW9uKGV2YWx1YXRpb24pO1xuICAgICAgICAgIC8vIHRoaXMucHJvamVjdG9yLm5vdGlmeVByb2plY3Rpb25Qb3NpdGlvbnNVcGRhdGVkKG5ld1NlbGVjdGlvbik7XG4gICAgICAgICAgdGhpcy5wcm9qZWN0b3Iubm90aWZ5UHJvamVjdGlvblBvc2l0aW9uc1VwZGF0ZWQoKTtcbiAgICAgICAgICB0aGlzLnByb2plY3Rvci5vblByb2plY3Rpb25DaGFuZ2VkKCk7XG4gICAgICAgICAgdGhpcy5wcm9qZWN0b3Iub25JdGVyYXRpb25DaGFuZ2UoaXRlcmF0aW9uKTtcbiAgICAgICAgICBpZiAodGhpcy5kYXRhU2V0LnRTTkVJdGVyYXRpb24gPiAxKSB7XG4gICAgICAgICAgICB0aGlzLnByZXZpb3VzRFZJQnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0aGlzLmRhdGFTZXQudFNORVRvdGFsSXRlciAhPSB0aGlzLmRhdGFTZXQudFNORUl0ZXJhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5uZXh0RFZJQnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMubmV4dERWSUJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgICAgICAgIHRoaXMucHJvamVjdG9yLm9uUHJvamVjdGlvbkNoYW5nZWQoKTtcbiAgICAgICAgfVxuICAgICAgICBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZShudWxsLCBtc2dJZCk7XG4gICAgICAgIHRoaXMuanVtcERWSUJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgICAgfSk7XG4gIH1cbiAgcmV0cmFpbkJ5U2VsZWN0aW9ucyhpdGVyYXRpb246IG51bWJlciwgc2VsZWN0aW9uczogbnVtYmVyW10sIHJlamVjdGlvbnM6IG51bWJlcltdKSB7XG5cbiAgICBjb25zdCBtc2dJZCA9IGxvZ2dpbmcuc2V0TW9kYWxNZXNzYWdlKCd0cmFpbmluZyBhbmQgbG9hZGluZy4uLicpXG5cbiAgICAvLyBHZXQgdGhlIHRlbnNvci5cbiAgICBsZXQgcGVyY2VudCA9IDBcbiAgICB0aGlzLnRpbWVyID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgIHBlcmNlbnQgPSBwZXJjZW50KzAuMTtcbiAgICAgIGxvZ2dpbmcuc2V0TW9kYWxNZXNzYWdlKFxuICAgICAgICBgdHJhaW5pbmcgYW5kIGxvYWRpbmcuLi4gJHtOdW1iZXIocGVyY2VudC50b0ZpeGVkKDEpKX0lYCxcbiAgICAgIG1zZ0lkKTtcbiAgICAgIGlmKHBlcmNlbnQgPiA5OCl7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcilcbiAgICAgIH1cbiAgICB9LCAyNTApXG5cbiAgICAvLyBsZXQgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgLy8geGhyLm9wZW4oJ0dFVCcsIHRlbnNvcnNQYXRoKTtcbiAgICAvLyB4aHIucmVzcG9uc2VUeXBlID0gJ2FycmF5YnVmZmVyJztcbiAgICAvLyB4aHIub25wcm9ncmVzcyA9IChldikgPT4ge1xuXG5cbiAgICAvLyB9O1xuICAgIHRoaXMuZGF0YVNldC5yZVRyYWluQnlEVkkoaXRlcmF0aW9uLCBzZWxlY3Rpb25zLCByZWplY3Rpb25zLFxuICAgICAgKGl0ZXJhdGlvbjogbnVtYmVyIHwgbnVsbCwgZXZhbHVhdGlvbjogYW55LCBuZXdfc2VsZWN0aW9uOiBhbnlbXSwgaW5kaWNlczogbnVtYmVyW10sIHRvdGFsSXRlcj86IG51bWJlcikgPT4ge1xuICAgICAgICAvKipcbiAgICAgICAgICogZ2V0IGZpbHRlciBpbmRleFxuICAgICAgICAgKi9cbiAgICAgICAgLy9nZXQgc2VhcmNoIHByZWRpY2F0ZXMgb3IgaW5kaWNlc1xuICAgICAgICB2YXIgZmlsdGVySW5kaWNlczogbnVtYmVyW107XG4gICAgICAgIGZpbHRlckluZGljZXMgPSBbXVxuICAgICAgICBpZiAodGhpcy50ZW1wb3JhbFN0YXR1cykge1xuICAgICAgICAgIC8vc2VhcmNoIHByZWRpY2F0ZVxuICAgICAgICAgIHRoaXMucHJvamVjdG9yLmluc3BlY3RvclBhbmVsLmZpbHRlckluZGljZXMgPSBpbmRpY2VzO1xuICAgICAgICB9XG4gICAgICAgIC8vaW5kaWNlc1xuICAgICAgICBmaWx0ZXJJbmRpY2VzID0gdGhpcy5wcm9qZWN0b3IuaW5zcGVjdG9yUGFuZWwuZmlsdGVySW5kaWNlcztcbiAgICAgICAgLy8gVE9ETyBpbml0aWxpemUgZGF0YXNldCwgc2V0IGluc3BlY3RvciBmaWx0ZXIgaW5kaWNlcyB0byBiZSBhbGxcbiAgICAgICAgdGhpcy5wcm9qZWN0b3IuZGF0YVNldC5zZXREVklGaWx0ZXJlZERhdGEoZmlsdGVySW5kaWNlcyk7XG4gICAgICAgIGlmIChpdGVyYXRpb24gIT0gbnVsbCkge1xuICAgICAgICAgIHRoaXMuaXRlcmF0aW9uTGFiZWxUc25lLmlubmVyVGV4dCA9ICcnICsgaXRlcmF0aW9uO1xuICAgICAgICAgIHRoaXMudG90YWxJdGVyYXRpb25MYWJlbERWSS5pbm5lclRleHQgPSAnJyArIHRvdGFsSXRlcjtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUV2YWx1YXRpb25JbmZvcm1hdGlvbihldmFsdWF0aW9uKTtcbiAgICAgICAgICAvLyB0aGlzLnByb2plY3Rvci5ub3RpZnlQcm9qZWN0aW9uUG9zaXRpb25zVXBkYXRlZChuZXdfc2VsZWN0aW9uKTtcbiAgICAgICAgICB0aGlzLnByb2plY3Rvci5ub3RpZnlQcm9qZWN0aW9uUG9zaXRpb25zVXBkYXRlZCgpO1xuICAgICAgICAgIHRoaXMucHJvamVjdG9yLm9uUHJvamVjdGlvbkNoYW5nZWQoKTtcbiAgICAgICAgICB0aGlzLnByb2plY3Rvci5vbkl0ZXJhdGlvbkNoYW5nZShpdGVyYXRpb24pO1xuICAgICAgICAgIHRoaXMucHJvamVjdG9yLmluaXRpYWxUcmVlKClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnByb2plY3Rvci5vblByb2plY3Rpb25DaGFuZ2VkKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZGF0YVNldC50U05FSXRlcmF0aW9uID4gMSkge1xuICAgICAgICAgIHRoaXMucHJldmlvdXNEVklCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZShudWxsLCBtc2dJZCk7XG4gICAgICAgIHdpbmRvdy5jbGVhckludGVydmFsKHRoaXMudGltZXIpXG4gICAgICAgIHRoaXMubmV4dERWSUJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmp1bXBEVklCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcmVzdG9yZVVJRnJvbUJvb2ttYXJrKGJvb2ttYXJrOiBTdGF0ZSkge1xuICAgIHRoaXMuZGlzYWJsZVBvbHltZXJDaGFuZ2VzVHJpZ2dlclJlcHJvamVjdGlvbigpO1xuICAgIC8vIFBDQVxuICAgIHRoaXMucGNhWCA9IGJvb2ttYXJrLnBjYUNvbXBvbmVudERpbWVuc2lvbnNbMF07XG4gICAgdGhpcy5wY2FZID0gYm9va21hcmsucGNhQ29tcG9uZW50RGltZW5zaW9uc1sxXTtcbiAgICBpZiAoYm9va21hcmsucGNhQ29tcG9uZW50RGltZW5zaW9ucy5sZW5ndGggPT09IDMpIHtcbiAgICAgIHRoaXMucGNhWiA9IGJvb2ttYXJrLnBjYUNvbXBvbmVudERpbWVuc2lvbnNbMl07XG4gICAgfVxuXG4gICAgLy8gY3VzdG9tXG4gICAgdGhpcy5jdXN0b21TZWxlY3RlZFNlYXJjaEJ5TWV0YWRhdGFPcHRpb24gPVxuICAgICAgYm9va21hcmsuY3VzdG9tU2VsZWN0ZWRTZWFyY2hCeU1ldGFkYXRhT3B0aW9uO1xuICAgIGlmICh0aGlzLmN1c3RvbVByb2plY3Rpb25YTGVmdElucHV0KSB7XG4gICAgICB0aGlzLmN1c3RvbVByb2plY3Rpb25YTGVmdElucHV0LnNldChcbiAgICAgICAgYm9va21hcmsuY3VzdG9tWExlZnRUZXh0LFxuICAgICAgICBib29rbWFyay5jdXN0b21YTGVmdFJlZ2V4XG4gICAgICApO1xuICAgIH1cbiAgICBpZiAodGhpcy5jdXN0b21Qcm9qZWN0aW9uWFJpZ2h0SW5wdXQpIHtcbiAgICAgIHRoaXMuY3VzdG9tUHJvamVjdGlvblhSaWdodElucHV0LnNldChcbiAgICAgICAgYm9va21hcmsuY3VzdG9tWFJpZ2h0VGV4dCxcbiAgICAgICAgYm9va21hcmsuY3VzdG9tWFJpZ2h0UmVnZXhcbiAgICAgICk7XG4gICAgfVxuICAgIGlmICh0aGlzLmN1c3RvbVByb2plY3Rpb25ZVXBJbnB1dCkge1xuICAgICAgdGhpcy5jdXN0b21Qcm9qZWN0aW9uWVVwSW5wdXQuc2V0KFxuICAgICAgICBib29rbWFyay5jdXN0b21ZVXBUZXh0LFxuICAgICAgICBib29rbWFyay5jdXN0b21ZVXBSZWdleFxuICAgICAgKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuY3VzdG9tUHJvamVjdGlvbllEb3duSW5wdXQpIHtcbiAgICAgIHRoaXMuY3VzdG9tUHJvamVjdGlvbllEb3duSW5wdXQuc2V0KFxuICAgICAgICBib29rbWFyay5jdXN0b21ZRG93blRleHQsXG4gICAgICAgIGJvb2ttYXJrLmN1c3RvbVlEb3duUmVnZXhcbiAgICAgICk7XG4gICAgfVxuICAgIHRoaXMuY29tcHV0ZUFsbENlbnRyb2lkcygpO1xuICBcbiAgICAvL3RoaXMudXBkYXRlVFNORVBlcnBsZXhpdHlGcm9tU2xpZGVyQ2hhbmdlKCk7XG4gICAgLy90aGlzLnVwZGF0ZVRTTkVMZWFybmluZ1JhdGVGcm9tVUlDaGFuZ2UoKTtcbiAgICBpZiAodGhpcy5pdGVyYXRpb25MYWJlbFRzbmUpIHtcbiAgICAgIHRoaXMuaXRlcmF0aW9uTGFiZWxUc25lLmlubmVyVGV4dCA9IGJvb2ttYXJrLnRTTkVJdGVyYXRpb24udG9TdHJpbmcoKTtcbiAgICB9XG4gICAgaWYgKGJvb2ttYXJrLnNlbGVjdGVkUHJvamVjdGlvbiAhPSBudWxsKSB7XG4gICAgICB0aGlzLnNob3dUYWIoYm9va21hcmsuc2VsZWN0ZWRQcm9qZWN0aW9uKTtcbiAgICB9XG4gICAgdGhpcy5lbmFibGVQb2x5bWVyQ2hhbmdlc1RyaWdnZXJSZXByb2plY3Rpb24oKTtcbiAgfVxuXG4gIHBvcHVsYXRlQm9va21hcmtGcm9tVUkoYm9va21hcms6IFN0YXRlKSB7XG4gICAgdGhpcy5kaXNhYmxlUG9seW1lckNoYW5nZXNUcmlnZ2VyUmVwcm9qZWN0aW9uKCk7XG4gICAgLy8gUENBXG4gICAgYm9va21hcmsucGNhQ29tcG9uZW50RGltZW5zaW9ucyA9IFt0aGlzLnBjYVgsIHRoaXMucGNhWV07XG5cblxuXG4gICAgLy8gY3VzdG9tXG4gICAgYm9va21hcmsuY3VzdG9tU2VsZWN0ZWRTZWFyY2hCeU1ldGFkYXRhT3B0aW9uID0gdGhpcy5jdXN0b21TZWxlY3RlZFNlYXJjaEJ5TWV0YWRhdGFPcHRpb247XG4gICAgaWYgKHRoaXMuY3VzdG9tUHJvamVjdGlvblhMZWZ0SW5wdXQgIT0gbnVsbCkge1xuICAgICAgYm9va21hcmsuY3VzdG9tWExlZnRUZXh0ID0gdGhpcy5jdXN0b21Qcm9qZWN0aW9uWExlZnRJbnB1dC5nZXRWYWx1ZSgpO1xuICAgICAgYm9va21hcmsuY3VzdG9tWExlZnRSZWdleCA9IHRoaXMuY3VzdG9tUHJvamVjdGlvblhMZWZ0SW5wdXQuZ2V0SW5SZWdleE1vZGUoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuY3VzdG9tUHJvamVjdGlvblhSaWdodElucHV0ICE9IG51bGwpIHtcbiAgICAgIGJvb2ttYXJrLmN1c3RvbVhSaWdodFRleHQgPSB0aGlzLmN1c3RvbVByb2plY3Rpb25YUmlnaHRJbnB1dC5nZXRWYWx1ZSgpO1xuICAgICAgYm9va21hcmsuY3VzdG9tWFJpZ2h0UmVnZXggPSB0aGlzLmN1c3RvbVByb2plY3Rpb25YUmlnaHRJbnB1dC5nZXRJblJlZ2V4TW9kZSgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5jdXN0b21Qcm9qZWN0aW9uWVVwSW5wdXQgIT0gbnVsbCkge1xuICAgICAgYm9va21hcmsuY3VzdG9tWVVwVGV4dCA9IHRoaXMuY3VzdG9tUHJvamVjdGlvbllVcElucHV0LmdldFZhbHVlKCk7XG4gICAgICBib29rbWFyay5jdXN0b21ZVXBSZWdleCA9IHRoaXMuY3VzdG9tUHJvamVjdGlvbllVcElucHV0LmdldEluUmVnZXhNb2RlKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLmN1c3RvbVByb2plY3Rpb25ZRG93bklucHV0ICE9IG51bGwpIHtcbiAgICAgIGJvb2ttYXJrLmN1c3RvbVlEb3duVGV4dCA9IHRoaXMuY3VzdG9tUHJvamVjdGlvbllEb3duSW5wdXQuZ2V0VmFsdWUoKTtcbiAgICAgIGJvb2ttYXJrLmN1c3RvbVlEb3duUmVnZXggPSB0aGlzLmN1c3RvbVByb2plY3Rpb25ZRG93bklucHV0LmdldEluUmVnZXhNb2RlKCk7XG4gICAgfVxuICAgIHRoaXMuZW5hYmxlUG9seW1lckNoYW5nZXNUcmlnZ2VyUmVwcm9qZWN0aW9uKCk7XG4gIH1cbiAgLy8gVGhpcyBtZXRob2QgaXMgbWFya2VkIGFzIHB1YmxpYyBhcyBpdCBpcyB1c2VkIGFzIHRoZSB2aWV3IG1ldGhvZCB0aGF0XG4gIC8vIGFic3RyYWN0cyBET00gbWFuaXB1bGF0aW9uIHNvIHdlIGNhbiBzdHViIGl0IGluIGEgdGVzdC5cbiAgLy8gVE9ETyhuc3Rob3JhdCk6IE1vdmUgdGhpcyB0byBpdHMgb3duIGNsYXNzIGFzIHRoZSBnbHVlIGJldHdlZW4gdGhpcyBjbGFzc1xuICAvLyBhbmQgdGhlIERPTS5cbiAgZGF0YVNldFVwZGF0ZWQoZGF0YVNldDogRGF0YVNldCwgb3JpZ2luYWxEYXRhU2V0OiBEYXRhU2V0LCBkaW06IG51bWJlcikge1xuICAgIHRoaXMuZGF0YVNldCA9IGRhdGFTZXQ7XG4gICAgdGhpcy5vcmlnaW5hbERhdGFTZXQgPSBvcmlnaW5hbERhdGFTZXQ7XG4gICAgdGhpcy5kaW0gPSBkaW07XG4gICAgY29uc3QgcG9pbnRDb3VudCA9IGRhdGFTZXQgPT0gbnVsbCA/IDAgOiBkYXRhU2V0LnBvaW50cy5sZW5ndGg7XG4gICAgLy9jb25zdCBwZXJwbGV4aXR5ID0gTWF0aC5tYXgoNSwgTWF0aC5jZWlsKE1hdGguc3FydChwb2ludENvdW50KSAvIDQpKTtcbiAgICAvL3RoaXMucGVycGxleGl0eVNsaWRlci52YWx1ZSA9IHBlcnBsZXhpdHkudG9TdHJpbmcoKTtcbiAgICAvL3RoaXMudXBkYXRlVFNORVBlcnBsZXhpdHlGcm9tU2xpZGVyQ2hhbmdlKCk7XG4gICAgdGhpcy5jbGVhckNlbnRyb2lkcygpO1xuICAgICh0aGlzLiQkKCcjdHNuZS1zYW1wbGluZycpIGFzIEhUTUxFbGVtZW50KS5zdHlsZS5kaXNwbGF5ID1cbiAgICAgIHBvaW50Q291bnQgPiBUU05FX1NBTVBMRV9TSVpFID8gbnVsbCA6ICdub25lJztcbiAgICBjb25zdCB3YXNTYW1wbGVkID1cbiAgICAgIGRhdGFTZXQgPT0gbnVsbFxuICAgICAgICA/IGZhbHNlXG4gICAgICAgIDogZGF0YVNldC5kaW1bMF0gPiBQQ0FfU0FNUExFX0RJTSB8fCBkYXRhU2V0LmRpbVsxXSA+IFBDQV9TQU1QTEVfRElNO1xuICAgICh0aGlzLiQkKCcjcGNhLXNhbXBsaW5nJykgYXMgSFRNTEVsZW1lbnQpLnN0eWxlLmRpc3BsYXkgPSB3YXNTYW1wbGVkXG4gICAgICA/IG51bGxcbiAgICAgIDogJ25vbmUnO1xuICAgIHRoaXMuc2hvd1RhYigndHNuZScpO1xuICB9XG4gIEBvYnNlcnZlKCdzZWxlY3RlZExhYmVsT3B0aW9uJylcbiAgX3NlbGVjdGVkTGFiZWxPcHRpb25DaGFuZ2VkKCkge1xuICAgIHRoaXMucHJvamVjdG9yLnNldFNlbGVjdGVkTGFiZWxPcHRpb24odGhpcy5zZWxlY3RlZExhYmVsT3B0aW9uKTtcbiAgfVxuICBAb2JzZXJ2ZSgnc2VsZWN0ZWRDb2xvck9wdGlvbk5hbWUnKVxuICBfc2VsZWN0ZWRDb2xvck9wdGlvbk5hbWVDaGFuZ2VkKCkge1xuICAgIGxldCBjb2xvck9wdGlvbjogQ29sb3JPcHRpb247XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNvbG9yT3B0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHRoaXMuY29sb3JPcHRpb25zW2ldLm5hbWUgPT09IHRoaXMuc2VsZWN0ZWRDb2xvck9wdGlvbk5hbWUpIHtcbiAgICAgICAgY29sb3JPcHRpb24gPSB0aGlzLmNvbG9yT3B0aW9uc1tpXTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghY29sb3JPcHRpb24pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5zaG93Rm9yY2VDYXRlZ29yaWNhbENvbG9yc0NoZWNrYm94ID0gISFjb2xvck9wdGlvbi50b29NYW55VW5pcXVlVmFsdWVzO1xuICAgIGlmIChjb2xvck9wdGlvbi5tYXAgPT0gbnVsbCkge1xuICAgICAgdGhpcy5jb2xvckxlZ2VuZFJlbmRlckluZm8gPSBudWxsO1xuICAgIH0gZWxzZSBpZiAoY29sb3JPcHRpb24uaXRlbXMpIHtcbiAgICAgIGxldCBpdGVtcyA9IGNvbG9yT3B0aW9uLml0ZW1zLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbG9yOiBjb2xvck9wdGlvbi5tYXAoaXRlbS5sYWJlbCksXG4gICAgICAgICAgbGFiZWw6IGl0ZW0ubGFiZWwsXG4gICAgICAgICAgY291bnQ6IGl0ZW0uY291bnQsXG4gICAgICAgIH07XG4gICAgICB9KTtcbiAgICAgIHRoaXMuY29sb3JMZWdlbmRSZW5kZXJJbmZvID0geyBpdGVtcywgdGhyZXNob2xkczogbnVsbCB9O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNvbG9yTGVnZW5kUmVuZGVySW5mbyA9IHtcbiAgICAgICAgaXRlbXM6IG51bGwsXG4gICAgICAgIHRocmVzaG9sZHM6IGNvbG9yT3B0aW9uLnRocmVzaG9sZHMsXG4gICAgICB9O1xuICAgIH1cbiAgICB0aGlzLnByb2plY3Rvci5zZXRTZWxlY3RlZENvbG9yT3B0aW9uKGNvbG9yT3B0aW9uKTtcbiAgfVxuXG4gIEBvYnNlcnZlKCd0ZW1wb3JhbFN0YXR1cycpXG4gIF9EVklUZW1wb3JhbFN0YXR1c09ic2VydmVyKCkge1xuXG4gIH1cbiAgQG9ic2VydmUoJ3NlbGVjdGVkQXJjaGl0ZWN0dXJlJylcbiAgLy8gVE9ET1xuICBfc2VsZWN0ZWRBcmNoaXRlY3R1cmVDaGFuZ2VkKCkge1xuICAgIHRoaXMudXBkYXRlVHJhaW5UZXN0UmVzc3VsdCgpXG4gIH1cbiAgQG9ic2VydmUoJ3NlbGVjdGVkVG90YWxFcG9jaCcpXG4gIF9zZWxlY3RlZFRvdGFsRXBvY2hDaGFuZ2VkKCkge1xuICAgIHdpbmRvdy5zZWxlY3RlZFRvdGFsRXBvY2ggPSB0aGlzLnNlbGVjdGVkVG90YWxFcG9jaFxuICAgIHRoaXMudXBkYXRlVHJhaW5UZXN0UmVzc3VsdCgpXG4gIH1cbiAgQG9ic2VydmUoJ3NlbGVjdGVkTHInKVxuICBfc2VsZWN0ZWRMckNoYW5nZWQoKSB7XG4gICAgLy8gVE9ET1xuICAgIHRoaXMudXBkYXRlVHJhaW5UZXN0UmVzc3VsdCgpXG4gIH1cblxuICB1cGRhdGVUcmFpblRlc3RSZXNzdWx0KCkge1xuICAgIGlmICh0aGlzLnByb2plY3Rvcikge1xuICAgICAgaWYgKHRoaXMuc2VsZWN0ZWRBcmNoaXRlY3R1cmUgPT0gJ1Jlc05ldC0xOCcgJiYgdGhpcy5zZWxlY3RlZExyID09ICcwLjAxJykge1xuICAgICAgICB0aGlzLnByb2plY3Rvci5oaWRkZW5PclNob3dTY2F0dGVyKCcnKVxuICAgICAgICBpZiAodGhpcy50b3RhbEFjY1RyYWluKSB7XG4gICAgICAgICAgdGhpcy50b3RhbEFjY1RyYWluLmlubmVyVGV4dCA9ICcnICsgTnVtYmVyKHRoaXMuYmFzZVRyYWluQWNjICogMTAwKS50b0ZpeGVkKDIpICsgJyUnO1xuICAgICAgICAgIHRoaXMudG90YWxBY2NUZXN0LmlubmVyVGV4dCA9ICcnICsgTnVtYmVyKHRoaXMuYmFzZVRlc3RBY2MgKiAxMDApLnRvRml4ZWQoMikgKyAnJSc7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wcm9qZWN0b3IuaW5pdGlhbFRyZWUoKVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAodGhpcy5zZWxlY3RlZEFyY2hpdGVjdHVyZSA9PSAnUmVzTmV0LTE4JyAmJiB0aGlzLnNlbGVjdGVkTHIgPT0gJzAuMScgJiYgdGhpcy5zZWxlY3RlZFRvdGFsRXBvY2ggPT0gMTkwKSB7XG4gICAgICAgIHRoaXMucHJvamVjdG9yLmhpZGRlbk9yU2hvd1NjYXR0ZXIoJ2hpZGRlbicpXG4gICAgICAgIGlmICh0aGlzLnRvdGFsQWNjVHJhaW4pIHtcbiAgICAgICAgICB0aGlzLnRvdGFsQWNjVHJhaW4uaW5uZXJUZXh0ID0gJzk1LjY2JSc7XG4gICAgICAgICAgdGhpcy50b3RhbEFjY1Rlc3QuaW5uZXJUZXh0ID0gJzc4LjIzJSc7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wcm9qZWN0b3IuaW5pdGlhbFRyZWUodGhpcy5zZWxlY3RlZFRvdGFsRXBvY2gpXG4gICAgICB9XG4gICAgICBlbHNlIGlmICh0aGlzLnNlbGVjdGVkQXJjaGl0ZWN0dXJlID09ICdSZXNOZXQtMTgnICYmIHRoaXMuc2VsZWN0ZWRMciA9PSAnMC4wMDEnICYmIHRoaXMuc2VsZWN0ZWRUb3RhbEVwb2NoID09IDE5MCkge1xuICAgICAgICB0aGlzLnByb2plY3Rvci5oaWRkZW5PclNob3dTY2F0dGVyKCdoaWRkZW4nKVxuICAgICAgICBpZiAodGhpcy50b3RhbEFjY1RyYWluKSB7XG4gICAgICAgICAgdGhpcy50b3RhbEFjY1RyYWluLmlubmVyVGV4dCA9ICc5NC4yMiUnO1xuICAgICAgICAgIHRoaXMudG90YWxBY2NUZXN0LmlubmVyVGV4dCA9ICc3OC4yNiUnO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucHJvamVjdG9yLmluaXRpYWxUcmVlKHRoaXMuc2VsZWN0ZWRUb3RhbEVwb2NoKVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAodGhpcy5zZWxlY3RlZEFyY2hpdGVjdHVyZSA9PSAnUmVzTmV0LTM0JyAmJiB0aGlzLnNlbGVjdGVkTHIgPT0gJzAuMDEnICYmIHRoaXMuc2VsZWN0ZWRUb3RhbEVwb2NoID09IDE5MCkge1xuICAgICAgICB0aGlzLnByb2plY3Rvci5oaWRkZW5PclNob3dTY2F0dGVyKCdoaWRkZW4nKVxuICAgICAgICBpZiAodGhpcy50b3RhbEFjY1RyYWluKSB7XG4gICAgICAgICAgdGhpcy50b3RhbEFjY1RyYWluLmlubmVyVGV4dCA9ICc5OC4yMyUnO1xuICAgICAgICAgIHRoaXMudG90YWxBY2NUZXN0LmlubmVyVGV4dCA9ICc3OC42MSUnO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucHJvamVjdG9yLmluaXRpYWxUcmVlKHRoaXMuc2VsZWN0ZWRUb3RhbEVwb2NoKVxuXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuc2VsZWN0ZWRBcmNoaXRlY3R1cmUgPT0gJ1ZHRy0xOCcgJiYgdGhpcy5zZWxlY3RlZExyID09ICcwLjAxJyAmJiB0aGlzLnNlbGVjdGVkVG90YWxFcG9jaCA9PSAxOTApIHtcbiAgICAgICAgdGhpcy5wcm9qZWN0b3IuaGlkZGVuT3JTaG93U2NhdHRlcignaGlkZGVuJylcbiAgICAgICAgaWYgKHRoaXMudG90YWxBY2NUcmFpbikge1xuICAgICAgICAgIHRoaXMudG90YWxBY2NUcmFpbi5pbm5lclRleHQgPSAnOTYuMzglJztcbiAgICAgICAgICB0aGlzLnRvdGFsQWNjVGVzdC5pbm5lclRleHQgPSAnNzkuOTMlJztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnByb2plY3Rvci5pbml0aWFsVHJlZSh0aGlzLnNlbGVjdGVkVG90YWxFcG9jaClcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5zZWxlY3RlZFRvdGFsRXBvY2ggPT0gMjAwICYmICEodGhpcy5zZWxlY3RlZEFyY2hpdGVjdHVyZSA9PSAnUmVzTmV0LTE4JyAmJiB0aGlzLnNlbGVjdGVkTHIgPT0gJzAuMDEnKSkge1xuICAgICAgICB0aGlzLnByb2plY3Rvci5oaWRkZW5PclNob3dTY2F0dGVyKCdoaWRkZW4nKVxuICAgICAgICB0aGlzLnByb2plY3Rvci5pbml0aWFsVHJlZSh0aGlzLnNlbGVjdGVkVG90YWxFcG9jaCwgdHJ1ZSlcbiAgICAgICAgaWYgKHRoaXMudG90YWxBY2NUcmFpbikge1xuICAgICAgICAgIHRoaXMudG90YWxBY2NUcmFpbi5pbm5lclRleHQgPSAnLScgKyAnJSc7XG4gICAgICAgICAgdGhpcy50b3RhbEFjY1Rlc3QuaW5uZXJUZXh0ID0gJy0nICsgJyUnO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnByb2plY3Rvci5oaWRkZW5PclNob3dTY2F0dGVyKCdoaWRkZW4nKVxuICAgICAgICB0aGlzLnByb2plY3Rvci5pbml0aWFsVHJlZSh0aGlzLnNlbGVjdGVkVG90YWxFcG9jaCwgdHJ1ZSlcbiAgICAgICAgaWYgKHRoaXMudG90YWxBY2NUcmFpbikge1xuICAgICAgICAgIHRoaXMudG90YWxBY2NUcmFpbi5pbm5lclRleHQgPSAnLScgKyAnJSc7XG4gICAgICAgICAgdGhpcy50b3RhbEFjY1Rlc3QuaW5uZXJUZXh0ID0gJy0nICsgJyUnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8vIEBvYnNlcnZlKCdzZWxlY3RlZFRvdGFsRXBvY2gnKVxuICAvLyBfc2VsZWN0ZWRUb3RhbENoYW5nZWQoKSB7XG4gIC8vICAgLy8gVE9ET1xuICAvLyAgIGlmICh0aGlzLnByb2plY3Rvcikge1xuICAvLyAgICAgaWYgKHRoaXMucHJvamVjdG9yKSB7XG4gIC8vICAgICAgIGlmICh0aGlzLnNlbGVjdGVkQXJjaGl0ZWN0dXJlID09ICdSZXNOZXQtMTgnICYmIHRoaXMuc2VsZWN0ZWRMciA9PSAnMC4wMScgJiYgdGhpcy5zZWxlY3RlZFRvdGFsRXBvY2ggPT0gMTkwKSB7XG5cbiAgLy8gICAgICAgICB0aGlzLnByb2plY3Rvci5oaWRkZW5PclNob3dTY2F0dGVyKCcnKVxuICAvLyAgICAgICAgIGlmICh0aGlzLnRvdGFsQWNjVHJhaW4pIHtcbiAgLy8gICAgICAgICAgIHRoaXMudG90YWxBY2NUcmFpbi5pbm5lclRleHQgPSAnJyArIE51bWJlcih0aGlzLmJhc2VUcmFpbkFjYyAqIDEwMCkudG9GaXhlZCgyKSArICclJztcbiAgLy8gICAgICAgICAgIHRoaXMudG90YWxBY2NUZXN0LmlubmVyVGV4dCA9ICcnICsgTnVtYmVyKHRoaXMuYmFzZVRlc3RBY2MgKiAxMDApLnRvRml4ZWQoMikgKyAnJSc7XG4gIC8vICAgICAgICAgfVxuXG4gIC8vICAgICAgIH0gZWxzZSB7XG4gIC8vICAgICAgICAgdGhpcy5wcm9qZWN0b3IuaGlkZGVuT3JTaG93U2NhdHRlcignaGlkZGVuJylcbiAgLy8gICAgICAgICAvLyBpZiAodGhpcy50b3RhbEFjY1RyYWluKSB7XG4gIC8vICAgICAgICAgICB0aGlzLnRvdGFsQWNjVHJhaW4uaW5uZXJUZXh0ID0gJy0nICsgTnVtYmVyKCh0aGlzLmJhc2VUcmFpbkFjYykgKiAxMDApLnRvRml4ZWQoMikgKyAnJSc7XG4gIC8vICAgICAgICAgICB0aGlzLnRvdGFsQWNjVGVzdC5pbm5lclRleHQgPSAnLScgKyBOdW1iZXIoKHRoaXMuYmFzZVRlc3RBY2MpICogMTAwKS50b0ZpeGVkKDIpICsgJyUnO1xuICAvLyAgICAgICAgIC8vIH1cbiAgLy8gICAgICAgfVxuICAvLyAgICAgfVxuICAvLyAgIH1cbiAgLy8gfVxuICBtZXRhZGF0YUNoYW5nZWQoc3ByaXRlQW5kTWV0YWRhdGE6IFNwcml0ZUFuZE1ldGFkYXRhSW5mbywgbWV0YWRhdGFGaWxlPzogc3RyaW5nKSB7XG4gICAgLy8gUHJvamVjdCBieSBvcHRpb25zIGZvciBjdXN0b20gcHJvamVjdGlvbnMuXG4gICAgaWYgKG1ldGFkYXRhRmlsZSAhPSBudWxsKSB7XG4gICAgICAvLyB0aGlzLm1ldGFkYXRhRmlsZSA9IG1ldGFkYXRhRmlsZTtcbiAgICB9XG4gICAgdGhpcy51cGRhdGVNZXRhZGF0YVVJKHNwcml0ZUFuZE1ldGFkYXRhLnN0YXRzKTtcbiAgICBpZiAoXG4gICAgICB0aGlzLnNlbGVjdGVkQ29sb3JPcHRpb25OYW1lID09IG51bGwgfHxcbiAgICAgIHRoaXMuY29sb3JPcHRpb25zLmZpbHRlcigoYykgPT4gYy5uYW1lID09PSB0aGlzLnNlbGVjdGVkQ29sb3JPcHRpb25OYW1lKVxuICAgICAgICAubGVuZ3RoID09PSAwXG4gICAgKSB7XG4gICAgICB0aGlzLnNlbGVjdGVkQ29sb3JPcHRpb25OYW1lID0gdGhpcy5jb2xvck9wdGlvbnNbMF0ubmFtZTtcbiAgICB9XG4gICAgbGV0IHNlYXJjaEJ5TWV0YWRhdGFJbmRleCA9IC0xO1xuICAgIHRoaXMuc2VhcmNoQnlNZXRhZGF0YU9wdGlvbnMgPSBzcHJpdGVBbmRNZXRhZGF0YS5zdGF0cy5tYXAoKHN0YXRzLCBpKSA9PiB7XG4gICAgICAvLyBNYWtlIHRoZSBkZWZhdWx0IGxhYmVsIGJ5IHRoZSBmaXJzdCBub24tbnVtZXJpYyBjb2x1bW4uXG4gICAgICBpZiAoIXN0YXRzLmlzTnVtZXJpYyAmJiBzZWFyY2hCeU1ldGFkYXRhSW5kZXggPT09IC0xKSB7XG4gICAgICAgIHNlYXJjaEJ5TWV0YWRhdGFJbmRleCA9IGk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3RhdHMubmFtZTtcbiAgICB9KTtcbiAgICB0aGlzLmN1c3RvbVNlbGVjdGVkU2VhcmNoQnlNZXRhZGF0YU9wdGlvbiA9IHRoaXMuc2VhcmNoQnlNZXRhZGF0YU9wdGlvbnNbXG4gICAgICBNYXRoLm1heCgwLCBzZWFyY2hCeU1ldGFkYXRhSW5kZXgpXG4gICAgXTtcbiAgfVxuICBwcml2YXRlIHVwZGF0ZU1ldGFkYXRhVUkoY29sdW1uU3RhdHM6IENvbHVtblN0YXRzW10pIHtcbiAgICAvLyBMYWJlbCBieSBvcHRpb25zLlxuICAgIGxldCBsYWJlbEluZGV4ID0gLTE7XG4gICAgdGhpcy5sYWJlbE9wdGlvbnMgPSBjb2x1bW5TdGF0cy5tYXAoKHN0YXRzLCBpKSA9PiB7XG4gICAgICAvLyBNYWtlIHRoZSBkZWZhdWx0IGxhYmVsIGJ5IHRoZSBmaXJzdCBub24tbnVtZXJpYyBjb2x1bW4uXG4gICAgICBpZiAoIXN0YXRzLmlzTnVtZXJpYyAmJiBsYWJlbEluZGV4ID09PSAtMSkge1xuICAgICAgICBsYWJlbEluZGV4ID0gaTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzdGF0cy5uYW1lO1xuICAgIH0pO1xuICAgIGlmIChcbiAgICAgIHRoaXMuc2VsZWN0ZWRMYWJlbE9wdGlvbiA9PSBudWxsIHx8XG4gICAgICB0aGlzLmxhYmVsT3B0aW9ucy5maWx0ZXIoKG5hbWUpID0+IG5hbWUgPT09IHRoaXMuc2VsZWN0ZWRMYWJlbE9wdGlvbilcbiAgICAgICAgLmxlbmd0aCA9PT0gMFxuICAgICkge1xuICAgICAgdGhpcy5zZWxlY3RlZExhYmVsT3B0aW9uID0gdGhpcy5sYWJlbE9wdGlvbnNbTWF0aC5tYXgoMCwgbGFiZWxJbmRleCldO1xuICAgIH1cbiAgICBpZiAoXG4gICAgICB0aGlzLm1ldGFkYXRhRWRpdG9yQ29sdW1uID09IG51bGwgfHxcbiAgICAgIHRoaXMubGFiZWxPcHRpb25zLmZpbHRlcigobmFtZSkgPT4gbmFtZSA9PT0gdGhpcy5tZXRhZGF0YUVkaXRvckNvbHVtbilcbiAgICAgICAgLmxlbmd0aCA9PT0gMFxuICAgICkge1xuICAgICAgdGhpcy5tZXRhZGF0YUVkaXRvckNvbHVtbiA9IHRoaXMubGFiZWxPcHRpb25zW01hdGgubWF4KDAsIGxhYmVsSW5kZXgpXTtcbiAgICB9XG4gICAgLy9Db2xvciBieSBvcHRpb25zLlxuICAgIGNvbnN0IHN0YW5kYXJkQ29sb3JPcHRpb246IENvbG9yT3B0aW9uW10gPSBbeyBuYW1lOiAnTm8gY29sb3IgbWFwJyB9XTtcbiAgICBjb25zdCBtZXRhZGF0YUNvbG9yT3B0aW9uOiBDb2xvck9wdGlvbltdID0gY29sdW1uU3RhdHNcbiAgICAgIC5maWx0ZXIoKHN0YXRzKSA9PiB7XG4gICAgICAgIHJldHVybiAhc3RhdHMudG9vTWFueVVuaXF1ZVZhbHVlcyB8fCBzdGF0cy5pc051bWVyaWM7XG4gICAgICB9KVxuICAgICAgLm1hcCgoc3RhdHMpID0+IHtcbiAgICAgICAgbGV0IG1hcDtcbiAgICAgICAgbGV0IGl0ZW1zOiB7XG4gICAgICAgICAgbGFiZWw6IHN0cmluZztcbiAgICAgICAgICBjb3VudDogbnVtYmVyO1xuICAgICAgICB9W107XG4gICAgICAgIGxldCB0aHJlc2hvbGRzOiBDb2xvckxlZ2VuZFRocmVzaG9sZFtdO1xuICAgICAgICBsZXQgaXNDYXRlZ29yaWNhbCA9ICFzdGF0cy50b29NYW55VW5pcXVlVmFsdWVzO1xuICAgICAgICBsZXQgZGVzYztcbiAgICAgICAgaWYgKGlzQ2F0ZWdvcmljYWwpIHtcbiAgICAgICAgICBjb25zdCBzY2FsZSA9IGQzLnNjYWxlT3JkaW5hbChkMy5zY2hlbWVDYXRlZ29yeTEwKTtcbiAgICAgICAgICBsZXQgcmFuZ2UgPSBzY2FsZS5yYW5nZSgpO1xuICAgICAgICAgIC8vIFJlLW9yZGVyIHRoZSByYW5nZS5cbiAgICAgICAgICBsZXQgbmV3UmFuZ2UgPSByYW5nZS5tYXAoKGNvbG9yLCBpKSA9PiB7XG4gICAgICAgICAgICBsZXQgaW5kZXggPSAoaSAqIDMpICUgcmFuZ2UubGVuZ3RoO1xuICAgICAgICAgICAgcmV0dXJuIHJhbmdlW2luZGV4XTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpdGVtcyA9IHN0YXRzLnVuaXF1ZUVudHJpZXM7XG4gICAgICAgICAgc2NhbGUucmFuZ2UobmV3UmFuZ2UpLmRvbWFpbihpdGVtcy5tYXAoKHgpID0+IHgubGFiZWwpKTtcbiAgICAgICAgICBtYXAgPSBzY2FsZTtcbiAgICAgICAgICBjb25zdCBsZW4gPSBzdGF0cy51bmlxdWVFbnRyaWVzLmxlbmd0aDtcbiAgICAgICAgICBkZXNjID1cbiAgICAgICAgICAgIGAke2xlbn0gJHtsZW4gPiByYW5nZS5sZW5ndGggPyAnIG5vbi11bmlxdWUnIDogJyd9IGAgKyBgY29sb3JzYDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJlc2hvbGRzID0gW1xuICAgICAgICAgICAgeyBjb2xvcjogJyNmZmZmZGQnLCB2YWx1ZTogc3RhdHMubWluIH0sXG4gICAgICAgICAgICB7IGNvbG9yOiAnIzFmMmQ4NicsIHZhbHVlOiBzdGF0cy5tYXggfSxcbiAgICAgICAgICBdO1xuICAgICAgICAgIG1hcCA9IGQzXG4gICAgICAgICAgICAuc2NhbGVMaW5lYXI8c3RyaW5nLCBzdHJpbmc+KClcbiAgICAgICAgICAgIC5kb21haW4odGhyZXNob2xkcy5tYXAoKHQpID0+IHQudmFsdWUpKVxuICAgICAgICAgICAgLnJhbmdlKHRocmVzaG9sZHMubWFwKCh0KSA9PiB0LmNvbG9yKSk7XG4gICAgICAgICAgZGVzYyA9ICdncmFkaWVudCc7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBuYW1lOiBzdGF0cy5uYW1lLFxuICAgICAgICAgIGRlc2M6IGRlc2MsXG4gICAgICAgICAgbWFwOiBtYXAsXG4gICAgICAgICAgaXRlbXM6IGl0ZW1zLFxuICAgICAgICAgIHRocmVzaG9sZHM6IHRocmVzaG9sZHMsXG4gICAgICAgICAgdG9vTWFueVVuaXF1ZVZhbHVlczogc3RhdHMudG9vTWFueVVuaXF1ZVZhbHVlcyxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuICAgIGlmIChtZXRhZGF0YUNvbG9yT3B0aW9uLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIEFkZCBhIHNlcGFyYXRvciBsaW5lIGJldHdlZW4gYnVpbHQtaW4gY29sb3IgbWFwc1xuICAgICAgLy8gYW5kIHRob3NlIGJhc2VkIG9uIG1ldGFkYXRhIGNvbHVtbnMuXG4gICAgICBzdGFuZGFyZENvbG9yT3B0aW9uLnB1c2goeyBuYW1lOiAnTWV0YWRhdGEnLCBpc1NlcGFyYXRvcjogdHJ1ZSB9KTtcbiAgICB9XG4gICAgdGhpcy5jb2xvck9wdGlvbnMgPSBtZXRhZGF0YUNvbG9yT3B0aW9uLmNvbmNhdChzdGFuZGFyZENvbG9yT3B0aW9uKTtcbiAgfVxuICBwdWJsaWMgc2hvd1RhYihpZDogUHJvamVjdGlvblR5cGUpIHtcbiAgICB0aGlzLmN1cnJlbnRQcm9qZWN0aW9uID0gaWQ7XG4gICAgY29uc3QgdGFiID0gdGhpcy4kJCgnLmluay10YWJbZGF0YS10YWI9XCInICsgaWQgKyAnXCJdJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgY29uc3QgYWxsVGFicyA9IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yQWxsKCcuaW5rLXRhYicpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsVGFicy5sZW5ndGg7IGkrKykge1xuICAgICAgdXRpbC5jbGFzc2VkKGFsbFRhYnNbaV0gYXMgSFRNTEVsZW1lbnQsICdhY3RpdmUnLCBmYWxzZSk7XG4gICAgfVxuICAgIHV0aWwuY2xhc3NlZCh0YWIsICdhY3RpdmUnLCB0cnVlKTtcbiAgICBjb25zdCBhbGxUYWJDb250ZW50ID0gdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoJy5pbmstcGFuZWwtY29udGVudCcpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsVGFiQ29udGVudC5sZW5ndGg7IGkrKykge1xuICAgICAgdXRpbC5jbGFzc2VkKGFsbFRhYkNvbnRlbnRbaV0gYXMgSFRNTEVsZW1lbnQsICdhY3RpdmUnLCBmYWxzZSk7XG4gICAgfVxuICAgIHV0aWwuY2xhc3NlZChcbiAgICAgIHRoaXMuJCQoJy5pbmstcGFuZWwtY29udGVudFtkYXRhLXBhbmVsPVwiJyArIGlkICsgJ1wiXScpIGFzIEhUTUxFbGVtZW50LFxuICAgICAgJ2FjdGl2ZScsXG4gICAgICB0cnVlXG4gICAgKTtcbiAgICAvLyBndWFyZCBmb3IgdW5pdCB0ZXN0cywgd2hlcmUgcG9seW1lciBpc24ndCBhdHRhY2hlZCBhbmQgJCBkb2Vzbid0IGV4aXN0LlxuICAgIGlmICh0aGlzLiQgIT0gbnVsbCkge1xuICAgICAgY29uc3QgbWFpbiA9IHRoaXMuJFsnbWFpbiddO1xuICAgICAgLy8gSW4gb3JkZXIgZm9yIHRoZSBwcm9qZWN0aW9ucyBwYW5lbCB0byBhbmltYXRlIGl0cyBoZWlnaHQsIHdlIG5lZWQgdG9cbiAgICAgIC8vIHNldCBpdCBleHBsaWNpdGx5LlxuICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICAgICAgdGhpcy5zdHlsZS5oZWlnaHQgPSBtYWluLmNsaWVudEhlaWdodCArICdweCc7XG4gICAgICB9KTtcbiAgICB9XG4gICAgY29uc29sZS5sb2coaWQpO1xuICAgIHRoaXMuYmVnaW5Qcm9qZWN0aW9uKGlkKTtcbiAgfVxuICBwcml2YXRlIGJlZ2luUHJvamVjdGlvbihwcm9qZWN0aW9uOiBQcm9qZWN0aW9uVHlwZSkge1xuICAgIGlmICh0aGlzLnBvbHltZXJDaGFuZ2VzVHJpZ2dlclJlcHJvamVjdGlvbiA9PT0gZmFsc2UpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZWxzZSBpZiAocHJvamVjdGlvbiA9PT0gJ3RzbmUnKSB7XG4gICAgICB0aGlzLnNob3dUU05FKCk7XG4gICAgfSBlbHNlIGlmIChwcm9qZWN0aW9uID09PSAnY3VzdG9tJykge1xuICAgICAgaWYgKHRoaXMuZGF0YVNldCAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMuZGF0YVNldC5zdG9wVFNORSgpO1xuICAgICAgfVxuICAgICAgdGhpcy5jb21wdXRlQWxsQ2VudHJvaWRzKCk7XG4gICAgICB0aGlzLnJlcHJvamVjdEN1c3RvbSgpO1xuICAgIH1cbiAgfVxuICBwcml2YXRlIHNob3dUU05FKCkge1xuICAgIGNvbnN0IGRhdGFTZXQgPSB0aGlzLmRhdGFTZXQ7XG4gICAgaWYgKGRhdGFTZXQgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBhY2Nlc3NvcnMgPSBnZXRQcm9qZWN0aW9uQ29tcG9uZW50cygndHNuZScsIFtcbiAgICAgIDAsXG4gICAgICAxLFxuICAgICAgdGhpcy50U05FaXMzZCA/IDIgOiBudWxsLFxuICAgIF0pO1xuICAgIGNvbnN0IGRpbWVuc2lvbmFsaXR5ID0gdGhpcy50U05FaXMzZCA/IDMgOiAyO1xuICAgIGNvbnN0IHByb2plY3Rpb24gPSBuZXcgUHJvamVjdGlvbihcbiAgICAgICd0c25lJyxcbiAgICAgIGFjY2Vzc29ycyxcbiAgICAgIGRpbWVuc2lvbmFsaXR5LFxuICAgICAgZGF0YVNldFxuICAgICk7XG4gICAgdGhpcy5wcm9qZWN0b3Iuc2V0UHJvamVjdGlvbihwcm9qZWN0aW9uKTtcbiAgICBpZiAodGhpcy5kYXRhU2V0Lmhhc1RTTkVSdW4pIHtcbiAgICAgIHRoaXMucHJvamVjdG9yLm5vdGlmeVByb2plY3Rpb25Qb3NpdGlvbnNVcGRhdGVkKCk7XG4gICAgfVxuICB9XG5cblxuXG4gIHByaXZhdGUgcmVwcm9qZWN0Q3VzdG9tKCkge1xuICAgIGlmIChcbiAgICAgIHRoaXMuY2VudHJvaWRzID09IG51bGwgfHxcbiAgICAgIHRoaXMuY2VudHJvaWRzLnhMZWZ0ID09IG51bGwgfHxcbiAgICAgIHRoaXMuY2VudHJvaWRzLnhSaWdodCA9PSBudWxsIHx8XG4gICAgICB0aGlzLmNlbnRyb2lkcy55VXAgPT0gbnVsbCB8fFxuICAgICAgdGhpcy5jZW50cm9pZHMueURvd24gPT0gbnVsbFxuICAgICkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCB4RGlyID0gdmVjdG9yLnN1Yih0aGlzLmNlbnRyb2lkcy54UmlnaHQsIHRoaXMuY2VudHJvaWRzLnhMZWZ0KTtcbiAgICB0aGlzLmRhdGFTZXQucHJvamVjdExpbmVhcih4RGlyLCAnbGluZWFyLXgnKTtcbiAgICBjb25zdCB5RGlyID0gdmVjdG9yLnN1Yih0aGlzLmNlbnRyb2lkcy55VXAsIHRoaXMuY2VudHJvaWRzLnlEb3duKTtcbiAgICB0aGlzLmRhdGFTZXQucHJvamVjdExpbmVhcih5RGlyLCAnbGluZWFyLXknKTtcbiAgICBjb25zdCBhY2Nlc3NvcnMgPSBnZXRQcm9qZWN0aW9uQ29tcG9uZW50cygnY3VzdG9tJywgWyd4JywgJ3knXSk7XG4gICAgY29uc3QgcHJvamVjdGlvbiA9IG5ldyBQcm9qZWN0aW9uKCdjdXN0b20nLCBhY2Nlc3NvcnMsIDIsIHRoaXMuZGF0YVNldCk7XG4gICAgdGhpcy5wcm9qZWN0b3Iuc2V0UHJvamVjdGlvbihwcm9qZWN0aW9uKTtcbiAgfVxuICBjbGVhckNlbnRyb2lkcygpOiB2b2lkIHtcbiAgICB0aGlzLmNlbnRyb2lkcyA9IHsgeExlZnQ6IG51bGwsIHhSaWdodDogbnVsbCwgeVVwOiBudWxsLCB5RG93bjogbnVsbCB9O1xuICAgIHRoaXMuYWxsQ2VudHJvaWQgPSBudWxsO1xuICB9XG4gIEBvYnNlcnZlKCdjdXN0b21TZWxlY3RlZFNlYXJjaEJ5TWV0YWRhdGFPcHRpb24nKVxuICBfY3VzdG9tU2VsZWN0ZWRTZWFyY2hCeU1ldGFkYXRhT3B0aW9uQ2hhbmdlZChuZXdWYWw6IHN0cmluZywgb2xkVmFsOiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5wb2x5bWVyQ2hhbmdlc1RyaWdnZXJSZXByb2plY3Rpb24gPT09IGZhbHNlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICh0aGlzLmN1cnJlbnRQcm9qZWN0aW9uID09PSAnY3VzdG9tJykge1xuICAgICAgdGhpcy5jb21wdXRlQWxsQ2VudHJvaWRzKCk7XG4gICAgICB0aGlzLnJlcHJvamVjdEN1c3RvbSgpO1xuICAgIH1cbiAgfVxuICBwcml2YXRlIHNldHVwQ3VzdG9tUHJvamVjdGlvbklucHV0RmllbGRzKCkge1xuICAgIHRoaXMuY3VzdG9tUHJvamVjdGlvblhMZWZ0SW5wdXQgPSB0aGlzLnNldHVwQ3VzdG9tUHJvamVjdGlvbklucHV0RmllbGQoXG4gICAgICAneExlZnQnXG4gICAgKTtcbiAgICB0aGlzLmN1c3RvbVByb2plY3Rpb25YUmlnaHRJbnB1dCA9IHRoaXMuc2V0dXBDdXN0b21Qcm9qZWN0aW9uSW5wdXRGaWVsZChcbiAgICAgICd4UmlnaHQnXG4gICAgKTtcbiAgICB0aGlzLmN1c3RvbVByb2plY3Rpb25ZVXBJbnB1dCA9IHRoaXMuc2V0dXBDdXN0b21Qcm9qZWN0aW9uSW5wdXRGaWVsZCgneVVwJyk7XG4gICAgdGhpcy5jdXN0b21Qcm9qZWN0aW9uWURvd25JbnB1dCA9IHRoaXMuc2V0dXBDdXN0b21Qcm9qZWN0aW9uSW5wdXRGaWVsZChcbiAgICAgICd5RG93bidcbiAgICApO1xuICB9XG4gIHByaXZhdGUgY29tcHV0ZUFsbENlbnRyb2lkcygpIHtcbiAgICB0aGlzLmNvbXB1dGVDZW50cm9pZCgneExlZnQnKTtcbiAgICB0aGlzLmNvbXB1dGVDZW50cm9pZCgneFJpZ2h0Jyk7XG4gICAgdGhpcy5jb21wdXRlQ2VudHJvaWQoJ3lVcCcpO1xuICAgIHRoaXMuY29tcHV0ZUNlbnRyb2lkKCd5RG93bicpO1xuICB9XG4gIHByaXZhdGUgY29tcHV0ZUNlbnRyb2lkKG5hbWU6IElucHV0Q29udHJvbE5hbWUpIHtcbiAgICBjb25zdCBpbnB1dCA9IHRoaXMuJCQoJyMnICsgbmFtZSkgYXMgYW55O1xuICAgIGlmIChpbnB1dCA9PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gaW5wdXQuZ2V0VmFsdWUoKTtcbiAgICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsZXQgaW5SZWdleE1vZGUgPSBpbnB1dC5nZXRJblJlZ2V4TW9kZSgpO1xuICAgIGxldCByZXN1bHQgPSB0aGlzLmdldENlbnRyb2lkKHZhbHVlLCBpblJlZ2V4TW9kZSk7XG4gICAgaWYgKHJlc3VsdC5udW1NYXRjaGVzID09PSAwKSB7XG4gICAgICBpbnB1dC5tZXNzYWdlID0gJzAgbWF0Y2hlcy4gVXNpbmcgYSByYW5kb20gdmVjdG9yLic7XG4gICAgICByZXN1bHQuY2VudHJvaWQgPSB2ZWN0b3Iucm4odGhpcy5kaW0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBpbnB1dC5tZXNzYWdlID0gYCR7cmVzdWx0Lm51bU1hdGNoZXN9IG1hdGNoZXMuYDtcbiAgICB9XG4gICAgdGhpcy5jZW50cm9pZHNbbmFtZV0gPSByZXN1bHQuY2VudHJvaWQ7XG4gICAgdGhpcy5jZW50cm9pZFZhbHVlc1tuYW1lXSA9IHZhbHVlO1xuICB9XG4gIHByaXZhdGUgc2V0dXBDdXN0b21Qcm9qZWN0aW9uSW5wdXRGaWVsZChuYW1lOiBJbnB1dENvbnRyb2xOYW1lKTogYW55IHtcbiAgICBsZXQgaW5wdXQgPSB0aGlzLiQkKCcjJyArIG5hbWUpIGFzIGFueTtcbiAgICBpbnB1dC5yZWdpc3RlcklucHV0Q2hhbmdlZExpc3RlbmVyKChpbnB1dCwgaW5SZWdleE1vZGUpID0+IHtcbiAgICAgIGlmICh0aGlzLnBvbHltZXJDaGFuZ2VzVHJpZ2dlclJlcHJvamVjdGlvbikge1xuICAgICAgICB0aGlzLmNvbXB1dGVDZW50cm9pZChuYW1lKTtcbiAgICAgICAgdGhpcy5yZXByb2plY3RDdXN0b20oKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gaW5wdXQ7XG4gIH1cbiAgcHJpdmF0ZSBnZXRDZW50cm9pZChwYXR0ZXJuOiBzdHJpbmcsIGluUmVnZXhNb2RlOiBib29sZWFuKTogQ2VudHJvaWRSZXN1bHQge1xuICAgIGlmIChwYXR0ZXJuID09IG51bGwgfHwgcGF0dGVybiA9PT0gJycpIHtcbiAgICAgIHJldHVybiB7IG51bU1hdGNoZXM6IDAgfTtcbiAgICB9XG4gICAgLy8gU2VhcmNoIGJ5IHRoZSBvcmlnaW5hbCBkYXRhc2V0IHNpbmNlIHdlIG9mdGVuIHdhbnQgdG8gZmlsdGVyIGFuZCBwcm9qZWN0XG4gICAgLy8gb25seSB0aGUgbmVhcmVzdCBuZWlnaGJvcnMgb2YgQSBvbnRvIEItQyB3aGVyZSBCIGFuZCBDIGFyZSBub3QgbmVhcmVzdFxuICAgIC8vIG5laWdoYm9ycyBvZiBBLlxuICAgIGxldCBhY2Nlc3NvciA9IChpOiBudW1iZXIpID0+IHRoaXMub3JpZ2luYWxEYXRhU2V0LnBvaW50c1tpXS52ZWN0b3I7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMub3JpZ2luYWxEYXRhU2V0LnF1ZXJ5KFxuICAgICAgcGF0dGVybixcbiAgICAgIGluUmVnZXhNb2RlLFxuICAgICAgdGhpcy5jdXN0b21TZWxlY3RlZFNlYXJjaEJ5TWV0YWRhdGFPcHRpb25cbiAgICApO1xuICAgIGxldCByID0gcmVzdWx0WzFdO1xuICAgIHJldHVybiB7IGNlbnRyb2lkOiB2ZWN0b3IuY2VudHJvaWQociwgYWNjZXNzb3IpLCBudW1NYXRjaGVzOiByLmxlbmd0aCB9O1xuICB9XG4gIGdldFBjYVNhbXBsZWREaW1UZXh0KCkge1xuICAgIHJldHVybiBQQ0FfU0FNUExFX0RJTS50b0xvY2FsZVN0cmluZygpO1xuICB9XG4gIGdldFBjYVNhbXBsZVNpemVUZXh0KCkge1xuICAgIHJldHVybiBQQ0FfU0FNUExFX1NJWkUudG9Mb2NhbGVTdHJpbmcoKTtcbiAgfVxuICBnZXRUc25lU2FtcGxlU2l6ZVRleHQoKSB7XG4gICAgcmV0dXJuIFRTTkVfU0FNUExFX1NJWkUudG9Mb2NhbGVTdHJpbmcoKTtcbiAgfVxuICBnZXRVbWFwU2FtcGxlU2l6ZVRleHQoKSB7XG4gICAgcmV0dXJuIFVNQVBfU0FNUExFX1NJWkUudG9Mb2NhbGVTdHJpbmcoKTtcbiAgfVxuXG59XG4iXX0=