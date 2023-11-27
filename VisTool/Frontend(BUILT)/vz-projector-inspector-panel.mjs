import { __awaiter, __decorate, __metadata } from "tslib";
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
import { PolymerElement } from '@polymer/polymer';
import { customElement, observe, property } from '@polymer/decorators';
import { LegacyElementMixin } from '../components/polymer/legacy_element_mixin';
import '../components/polymer/irons_and_papers';
import { template } from './vz-projector-inspector-panel.html';
import './vz-projector-input';
import { dist2color, normalizeDist } from './projectorScatterPlotAdapter';
import { MouseMode } from './scatterPlot';
import * as vector from './vector';
import * as util from './util';
import * as logging from './logging';
const LIMIT_RESULTS = 10000;
const DEFAULT_NEIGHBORS = 100;
let InspectorPanel = class InspectorPanel extends LegacyElementMixin(PolymerElement) {
    constructor() {
        super(...arguments);
        this.selectedStratergy = 'Interest potential';
        this.selectedAnormalyClass = 0;
        this.numNN = DEFAULT_NEIGHBORS;
        this.showNeighborImages = true;
        this.disabledAlExBase = false;
        this.spriteImagesAvailable = true;
        this.noShow = false;
        this.isCollapsed = false;
        this.checkAllQueryRes = false;
        this.collapseIcon = 'expand-less';
        this.showAnomaly = false;
        this.isControlGroup = false;
        this.shownormal = false;
        this.queryResultListTitle = 'Query Result List';
        this.showCheckAllQueryRes = true;
        this.showMoreRecommend = true;
        this.showPlayAndStop = false;
        this.moreRecommednNum = 10;
        this.accAll = false;
        this.rejAll = false;
        this.showUnlabeledChecked = true;
    }
    ready() {
        super.ready();
        this.isAlSelecting = false;
        this.currentFilterType = 'normal';
        this.showAnomaly = window.sessionStorage.taskType == 'anormaly detection';
        this.shownormal = window.sessionStorage.taskType == 'active learning' || window.taskType == 'active learning';
        this.isControlGroup = window.sessionStorage.isControlGroup == 'true';
        // this.showUnlabeledChecked = window.sessionStorage.taskType == 'active learning' || window.taskType == 'active learning'
        // if (window.sessionStorage.taskType == 'active learning') {
        //   this.moreRecommednNum = 100
        // }
        this.queryByStrategtBtn = this.$$('.query-by-stratergy');
        this.moreRecommend = this.$$('.query-by-sel-btn');
        this.showSelectionBtn = this.$$('.show-selection');
        this.noisyshowSelectionBtn = this.$$('.noisy-show-selection');
        this.queryAnomalyBtn = this.$$('.query-anomaly');
        this.accAllRadio = this.$$('#accAllRadio');
        this.rejAllRadio = this.$$('#rejAllRadio');
        // this.boundingSelectionBtn = this.$$('.bounding-selection') as HTMLButtonElement;
        // this.resetFilterButton = this.$$('.reset-filter') as HTMLButtonElement;
        // this.setFilterButton = this.$$('.set-filter') as HTMLButtonElement;
        // this.clearSelectionButton = this.$$(
        //   '.clear-selection'
        // ) as HTMLButtonElement;
        this.noisyBtn = this.$$('.show-noisy-btn');
        this.stopBtn = this.$$('.stop-animation-btn');
        this.searchButton = this.$$('.search');
        this.addButton = this.$$('.add');
        this.resetButton = this.$$('.reset');
        this.sentButton = this.$$('.sent');
        this.showButton = this.$$('.show');
        // this.selectinMessage = this.$$('.boundingBoxSelection') as HTMLElement;
        this.trainBySelBtn = this.$$('.train-by-selection');
        this.projectionsPanel = this.$['projections-panel']; // ProjectionsPanel
        this.limitMessage = this.$$('.limit-msg');
        this.searchBox = this.$$('#search-box'); // ProjectorInput
        this.displayContexts = [];
        // show noisy points
        this.currentPredicate = {};
        this.queryIndices = [];
        this.filterIndices = [];
        this.boundingBoxSelection = [];
        this.currentBoundingBoxSelection = [];
        // this.selectinMessage.innerText = "0 seleted.";
        this.confidenceThresholdFrom = 0;
        this.confidenceThresholdTo = 1;
        this.disabledAlExBase = false;
        // this.epochFrom = 1
        // this.epochTo = 1
        this.showTrace = false;
        this.checkAllQueryRes = false;
        this.budget = 10;
        this.anomalyRecNum = 10;
        this.suggestKNum = 10;
    }
    initialize(projector, projectorEventContext) {
        var _a, _b;
        this.projector = projector;
        this.projectorEventContext = projectorEventContext;
        this.setupUI(projector);
        this.labelMap = {
            "0": "plane",
            "1": "car",
            "2": "bird",
            "3": "cat",
            "4": "deer",
            "5": "dog",
            "6": "frog",
            "7": "horse",
            "8": "ship",
            "9": "truck"
        };
        projectorEventContext.registerSelectionChangedListener((selection, neighbors) => this.updateInspectorPane(selection, neighbors));
        // TODO change them based on metadata fields
        this.searchFields = ["type", "label"];
        // active learning statergy
        this.statergyList = ["Interest potential", "Random"];
        // anormaly detection statergy
        this.anormalyStatergyList = ['anormalyStageone', 'anormalyStageTwo', 'anormalyStageThree'];
        // anormaly detcttion classes
        this.classOptionsList = [{ value: 0, label: 'airplane' }, { value: 1, label: 'car' }, { value: 2, label: 'bird' }, { value: 3, label: 'cat' }, { value: 4, label: 'deer' }, { value: 5, label: 'dog' }, { value: 6, label: 'frog' }, { value: 7, label: 'horse' }, { value: 8, label: 'ship' }, { value: 9, label: 'truck' }];
        // TODO read real points length from dataSet
        for (let i = 0; i < 70000; i++) {
            this.filterIndices.push(i);
        }
        this.noisyBtn.style.visibility = Boolean((_a = window.customSelection) === null || _a === void 0 ? void 0 : _a.length) ? '' : 'hidden';
        this.stopBtn.style.visibility = Boolean((_b = window.customSelection) === null || _b === void 0 ? void 0 : _b.length) ? '' : 'hidden';
    }
    /** Updates the nearest neighbors list in the inspector. */
    updateInspectorPane(indices, neighbors) {
        this.neighborsOfFirstPoint = neighbors;
        this.selectedPointIndices = indices;
        // this.updateFilterButtons(indices.length + neighbors.length);
        // this.updateFilterButtons(indices.length);
        this.updateNeighborsList(neighbors);
        if (neighbors.length === 0) {
            this.updateSearchResults(indices);
        }
        else {
            this.updateSearchResults([]);
        }
    }
    enableResetFilterButton(enabled) {
        // this.resetFilterButton.disabled = !enabled;
    }
    /** Handles toggle of metadata-container. */
    _toggleMetadataContainer() {
        this.$$('#metadata-container').toggle();
        this.isCollapsed = !this.isCollapsed;
        this.set('collapseIcon', this.isCollapsed ? 'expand-more' : 'expand-less');
    }
    refreshBtnStyle() {
        var _a, _b;
        this.noisyBtn.style.visibility = Boolean((_a = window.customSelection) === null || _a === void 0 ? void 0 : _a.length) ? '' : 'hidden';
        this.stopBtn.style.visibility = Boolean((_b = window.customSelection) === null || _b === void 0 ? void 0 : _b.length) ? '' : 'hidden';
    }
    restoreUIFromBookmark(bookmark) {
        this.enableResetFilterButton(bookmark.filteredPoints != null);
    }
    metadataChanged(spriteAndMetadata) {
        var _a, _b;
        let labelIndex = -1;
        this.metadataFields = spriteAndMetadata.stats.map((stats, i) => {
            if (!stats.isNumeric && labelIndex === -1) {
                labelIndex = i;
            }
            return stats.name;
        });
        if (spriteAndMetadata.spriteMetadata &&
            spriteAndMetadata.spriteMetadata.imagePath) {
            const [spriteWidth, spriteHeight,] = spriteAndMetadata.spriteMetadata.singleImageDim;
            this.spriteMeta = {
                imagePath: (_a = spriteAndMetadata.spriteImage) === null || _a === void 0 ? void 0 : _a.src,
                aspectRatio: spriteWidth / spriteHeight,
                nCols: Math.floor(((_b = spriteAndMetadata.spriteImage) === null || _b === void 0 ? void 0 : _b.width) / spriteWidth),
                singleImageDim: [spriteWidth, spriteHeight],
            };
        }
        else {
            this.spriteMeta = {};
        }
        this.spriteImagesAvailable = !!this.spriteMeta.imagePath;
        if (this.selectedMetadataField == null ||
            this.metadataFields.filter((name) => name === this.selectedMetadataField)
                .length === 0) {
            // Make the default label the first non-numeric column.
            this.selectedMetadataField = this.metadataFields[Math.max(0, labelIndex)];
        }
        this.updateInspectorPane(this.selectedPointIndices, this.neighborsOfFirstPoint);
    }
    datasetChanged() {
        this.enableResetFilterButton(false);
    }
    _refreshNeighborsList() {
        this.updateNeighborsList();
    }
    _accAllRes() {
        if (this.accAll) {
            console.log(12333);
        }
    }
    _refreshScatterplot() {
        var _a, _b;
        if (this.showTrace) {
            (_a = this.projectorEventContext) === null || _a === void 0 ? void 0 : _a.renderInTraceLine(true);
        }
        else {
            (_b = this.projectorEventContext) === null || _b === void 0 ? void 0 : _b.renderInTraceLine(false);
        }
    }
    _checkAll() {
        var _a, _b;
        if (this.checkAllQueryRes) {
            if (window.checkboxDom) {
                if (window.queryResPointIndices && window.queryResPointIndices.length) {
                    for (let i = 0; i < window.queryResPointIndices.length; i++) {
                        let index = window.queryResPointIndices[i];
                        if (window.customSelection.indexOf(index) === -1) {
                            if (window.checkboxDom[index]) {
                                window.checkboxDom[index].checked = true;
                            }
                            window.customSelection.push(index);
                        }
                    }
                    this.projectorEventContext.refresh();
                }
            }
        }
        else {
            if (window.checkboxDom) {
                if (window.queryResPointIndices && window.queryResPointIndices.length) {
                    for (let i = 0; i < window.queryResPointIndices.length; i++) {
                        let index = window.queryResPointIndices[i];
                        if (window.customSelection.indexOf(index) !== -1) {
                            let m = window.customSelection.indexOf(index);
                            if (window.checkboxDom[index]) {
                                window.checkboxDom[index].checked = false;
                            }
                            window.customSelection.splice(m, 1);
                            this.noisyBtn.style.visibility = Boolean((_a = window.customSelection) === null || _a === void 0 ? void 0 : _a.length) ? '' : 'hidden';
                            this.stopBtn.style.visibility = Boolean((_b = window.customSelection) === null || _b === void 0 ? void 0 : _b.length) ? '' : 'hidden';
                        }
                    }
                    this.projectorEventContext.refresh();
                }
            }
        }
    }
    metadataEditorContext(enabled, metadataColumn) {
        if (!this.projector || !this.projector.dataSet) {
            return;
        }
        let stat = this.projector.dataSet.spriteAndMetadataInfo.stats.filter((s) => s.name === metadataColumn);
        if (!enabled || stat.length === 0 || stat[0].tooManyUniqueValues) {
            this.removeContext('.metadata-info');
            return;
        }
        this.metadataColumn = metadataColumn;
        this.addContext('.metadata-info');
        let list = this.$$('.metadata-list');
        list.textContent = '';
        let entries = stat[0].uniqueEntries.sort((a, b) => a.count - b.count);
        let maxCount = entries[entries.length - 1].count;
        entries.forEach((e) => {
            const metadataElement = document.createElement('div');
            metadataElement.className = 'metadata';
            const metadataElementLink = document.createElement('a');
            metadataElementLink.className = 'metadata-link';
            metadataElementLink.title = e.label;
            const labelValueElement = document.createElement('div');
            labelValueElement.className = 'label-and-value';
            const labelElement = document.createElement('div');
            labelElement.className = 'label';
            labelElement.style.color = dist2color(this.distFunc, maxCount, e.count);
            labelElement.innerText = e.label;
            const valueElement = document.createElement('div');
            valueElement.className = 'value';
            valueElement.innerText = e.count.toString();
            labelValueElement.appendChild(labelElement);
            labelValueElement.appendChild(valueElement);
            const barElement = document.createElement('div');
            barElement.className = 'bar';
            const barFillElement = document.createElement('div');
            barFillElement.className = 'fill';
            barFillElement.style.borderTopColor = dist2color(this.distFunc, maxCount, e.count);
            barFillElement.style.width =
                normalizeDist(this.distFunc, maxCount, e.count) * 100 + '%';
            barElement.appendChild(barFillElement);
            for (let j = 1; j < 4; j++) {
                const tickElement = document.createElement('div');
                tickElement.className = 'tick';
                tickElement.style.left = (j * 100) / 4 + '%';
                barElement.appendChild(tickElement);
            }
            metadataElementLink.appendChild(labelValueElement);
            metadataElementLink.appendChild(barElement);
            metadataElement.appendChild(metadataElementLink);
            list.appendChild(metadataElement);
            metadataElementLink.onclick = () => {
                this.projector.metadataEdit(metadataColumn, e.label);
            };
        });
    }
    addContext(context) {
        if (this.displayContexts.indexOf(context) === -1) {
            this.displayContexts.push(context);
        }
        this.displayContexts.forEach((c) => {
            this.$$(c).style.display = 'none';
        });
        this.$$(context).style.display = null;
    }
    removeContext(context) {
        this.displayContexts = this.displayContexts.filter((c) => c !== context);
        this.$$(context).style.display = 'none';
        if (this.displayContexts.length > 0) {
            let lastContext = this.displayContexts[this.displayContexts.length - 1];
            this.$$(lastContext).style.display = null;
        }
    }
    clearQueryResList() {
        this.updateSearchResults([]);
    }
    refreshSearchResult() {
        this.updateSearchResults(this.queryIndices);
    }
    refreshSearchResByList(list) {
        this.updateSearchResults(list);
    }
    updateSearchResults(indices) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            if (((_a = this.accAllRadio) === null || _a === void 0 ? void 0 : _a.checked) || ((_b = this.rejAllRadio) === null || _b === void 0 ? void 0 : _b.checked)) {
                this.accAllRadio.checked = false;
                this.rejAllRadio.checked = false;
            }
            const container = this.$$('.matches-list');
            const list = container.querySelector('.list');
            list.textContent = '';
            if (indices.length === 0) {
                this.removeContext('.matches-list');
                return;
            }
            this.addContext('.matches-list');
            this.limitMessage.style.display =
                indices.length <= LIMIT_RESULTS ? 'none' : null;
            indices = indices.slice(0, LIMIT_RESULTS);
            this.moreRecommend = container.querySelector('.query-by-sel-btn');
            // const msgId = logging.setModalMessage('Fetching sprite image...');
            if (this.moreRecommend) {
                this.moreRecommend.onclick = () => {
                    if (!window.acceptIndicates || !window.rejectIndicates) {
                        logging.setErrorMessage('Please confirm some selection first');
                        return;
                    }
                    if (window.sessionStorage.taskType === 'active learning') {
                        // let accIndices = []
                        // let rejIndices = []
                        // if (!window.previousIndecates) {
                        //   window.previousIndecates = []
                        // }
                        // if (!window.acceptIndicates) {
                        //   window.acceptIndicates = []
                        // } else {
                        //   for (let i = 0; i < window.acceptIndicates.length; i++) {
                        //     if (window.previousIndecates.indexOf(window.customSelection[i]) == -1) {
                        //       accIndices.push(window.customSelection[i])
                        //     } else {
                        //       previoustIIndices.push(window.customSelection[i])
                        //     }
                        //   }
                        // }
                        this.queryByAl(this.projector, window.acceptIndicates, window.rejectIndicates, this.moreRecommednNum, false);
                    }
                    else if (window.sessionStorage.taskType === 'anormaly detection') {
                        let confirmInfo = [];
                        for (let i = 0; i < window.queryResAnormalIndecates.length; i++) {
                            let value = Boolean(window.customSelection.indexOf(window.queryResAnormalIndecates[i]) !== -1);
                            confirmInfo.push(value);
                            if (value && window.previousIndecates.indexOf(window.queryResAnormalIndecates[i]) === -1) {
                                window.previousIndecates.push(window.queryResAnormalIndecates[i]);
                            }
                        }
                        let AnormalyStrategy = 'Feedback';
                        // if is control group
                        if (window.sessionStorage.isControlGroup == 'true') {
                            AnormalyStrategy = 'TBSampling';
                        }
                        this.projector.queryAnormalyStrategy(Number(this.moreRecommednNum), this.selectedAnormalyClass, window.queryResAnormalIndecates, confirmInfo, window.acceptIndicates, window.rejectIndicates, AnormalyStrategy, false, (indices, cleansIndices) => {
                            if (indices != null) {
                                // this.queryIndices = indices;
                                if (this.queryIndices.length == 0) {
                                    this.searchBox.message = '0 matches.';
                                }
                                else {
                                    this.searchBox.message = `${this.queryIndices.length} matches.`;
                                }
                                window.queryResAnormalIndecates = indices;
                                window.queryResAnormalCleanIndecates = cleansIndices;
                                this.queryIndices = indices.concat(cleansIndices);
                                if (!this.isAlSelecting) {
                                    this.isAlSelecting = true;
                                    window.isAdjustingSel = true;
                                    // this.boundingSelectionBtn.classList.add('actived')
                                    this.projectorEventContext.setMouseMode(MouseMode.AREA_SELECT);
                                }
                                // this.projectorScatterPlotAdapter.scatterPlot.setMouseMode(MouseMode.AREA_SELECT);
                                this.showCheckAllQueryRes = true;
                                this.showMoreRecommend = true;
                                // if (window.sessionStorage.isControlGroup == 'true') {
                                //   this.showMoreRecommend = false
                                // } else {
                                //   this.showMoreRecommend = true
                                // }
                                this.checkAllQueryRes = false;
                                this.queryResultListTitle = 'Possible Abnormal Point List';
                                // let dom = this.$$("#queryResheader")
                                // dom.innerHTML = 'label'
                                this.projectorEventContext.notifySelectionChanged(this.queryIndices, false, 'isAnormalyQuery');
                            }
                        });
                    }
                };
            }
            let DVIServer = window.sessionStorage.ipAddress;
            let basePath = window.modelMath;
            let headers = new Headers();
            headers.append('Content-Type', 'application/json');
            headers.append('Accept', 'application/json');
            window.suggestionIndicates = [];
            window.checkboxDom = [];
            window.acceptInputList = [];
            window.rejectInputList = [];
            if (!window.acceptIndicates) {
                window.acceptIndicates = [];
            }
            if (!window.rejectIndicates) {
                window.rejectIndicates = [];
            }
            const queryListTable = document.createElement('table');
            queryListTable.className = 'resTable';
            if (this.showCheckAllQueryRes === true) {
                this.accAllRadio = this.$$('#accAllRadio');
                this.rejAllRadio = this.$$('#rejAllRadio');
                // if (this.accAllRadio && this.rejAllRadio) {
                // setTimeout(()=>{
                this.accAllRadio.addEventListener('change', (e) => {
                    var _a, _b;
                    console.log('acc e', this.accAllRadio.checked);
                    if (this.accAllRadio.checked) {
                        for (let i = 0; i < indices.length; i++) {
                            window.acceptInputList[indices[i]].checked = true;
                            window.rejectInputList[indices[i]].checked = false;
                            if (window.acceptIndicates.indexOf(indices[i]) === -1) {
                                window.acceptIndicates.push(indices[i]);
                            }
                            if (window.rejectIndicates.indexOf(indices[i]) !== -1) {
                                let index = window.rejectIndicates.indexOf(indices[i]);
                                window.rejectIndicates.splice(index, 1);
                            }
                        }
                    }
                    window.customSelection = window.rejectIndicates.concat(window.acceptIndicates);
                    this.noisyBtn.style.visibility = Boolean((_a = window.customSelection) === null || _a === void 0 ? void 0 : _a.length) ? '' : 'hidden';
                    this.stopBtn.style.visibility = Boolean((_b = window.customSelection) === null || _b === void 0 ? void 0 : _b.length) ? '' : 'hidden';
                    this.updateSessionStorage();
                    this.projectorEventContext.refresh();
                });
                this.rejAllRadio.addEventListener('change', (e) => {
                    var _a, _b;
                    console.log('rej e', this.rejAllRadio.checked);
                    for (let i = 0; i < indices.length; i++) {
                        window.acceptInputList[indices[i]].checked = false;
                        window.rejectInputList[indices[i]].checked = true;
                        if (window.rejectIndicates.indexOf(indices[i]) === -1) {
                            window.rejectIndicates.push(indices[i]);
                        }
                        if (window.acceptIndicates.indexOf(indices[i]) !== -1) {
                            let index = window.acceptIndicates.indexOf(indices[i]);
                            window.acceptIndicates.splice(index, 1);
                        }
                    }
                    window.customSelection = window.rejectIndicates.concat(window.acceptIndicates);
                    this.noisyBtn.style.visibility = Boolean((_a = window.customSelection) === null || _a === void 0 ? void 0 : _a.length) ? '' : 'hidden';
                    this.stopBtn.style.visibility = Boolean((_b = window.customSelection) === null || _b === void 0 ? void 0 : _b.length) ? '' : 'hidden';
                    this.updateSessionStorage();
                    this.projectorEventContext.refresh();
                });
                // })
                // }
            }
            if (indices.length > 2000) {
                indices.length = 2000;
            }
            for (let i = 0; i < indices.length; i++) {
                const index = indices[i];
                const row = document.createElement('th');
                row.className = 'row';
                // const rowLink = document.createElement('a');
                // rowLink.className = 'label';
                // rowLink.title = label;
                // rowLink.innerHTML = label;
                row.onmouseenter = () => {
                    this.projectorEventContext.notifyHoverOverPoint(index);
                };
                row.onmouseleave = () => {
                    this.projectorEventContext.notifyHoverOverPoint(null);
                };
                if (this.showCheckAllQueryRes === true) {
                    // let input = document.createElement('input');
                    // input.type = 'checkbox'
                    // input.setAttribute('id', `resCheckbox${indices[i]}`)
                    // if (!window.checkboxDom) {
                    //   window.checkboxDom = []
                    // }
                    // window.checkboxDom[indices[i]] = input
                    // input.addEventListener('change', (e) => {
                    //   if (!window.customSelection) {
                    //     window.customSelection = []
                    //   }
                    //   if (input.checked) {
                    //     if (window.customSelection.indexOf(indices[i]) === -1) {
                    //       window.customSelection.push(indices[i])
                    //       this.projectorEventContext.refresh()
                    //     }
                    //   } else {
                    //     let index = window.customSelection.indexOf(indices[i])
                    //     window.customSelection.splice(index, 1)
                    //     this.projectorEventContext.refresh()
                    //   }
                    //   this.projectorEventContext.notifyHoverOverPoint(indices[i]);
                    // })
                    // if (window.customSelection.indexOf(indices[i]) !== -1 && !input.checked) {
                    //   input.checked = true
                    // }
                    // let newtd = document.createElement('td')
                    // if(window.queryResAnormalCleanIndecates && window.queryResAnormalCleanIndecates.indexOf(index)!==-1){
                    //   input.disabled = true
                    //   input.style.visibility = 'hidden'
                    // }
                    // newtd.appendChild(input)
                    // newtd.className = 'inputColumn'
                    // newtd.appendChild(input)
                    // row.appendChild(newtd)
                    let newacctd = document.createElement('td');
                    let accInput = document.createElement('input');
                    accInput.setAttribute('name', `op${index}`);
                    accInput.setAttribute('id', `accept${index}`);
                    accInput.setAttribute('type', `radio`);
                    accInput.className = 'inputColumn';
                    accInput.setAttribute('value', `accept`);
                    window.acceptInputList[indices[i]] = accInput;
                    newacctd.append(accInput);
                    if (window.queryResAnormalCleanIndecates && window.queryResAnormalCleanIndecates.indexOf(index) !== -1) {
                        let span = document.createElement('span');
                        span.innerText = " ";
                        let newtd = document.createElement('td');
                        newtd.style.width = "50px";
                        newtd.append(span);
                        row.appendChild(newtd);
                    }
                    else {
                        row.appendChild(newacctd);
                    }
                    accInput.addEventListener('mouseup', (e) => {
                        if (accInput.checked) {
                            // accInput.prop("checked", false);
                            accInput.checked = false;
                            window.acceptIndicates.splice(window.acceptIndicates.indexOf(index), 1);
                        }
                        // if(newacctd.)
                    });
                    accInput.addEventListener('change', () => {
                        var _a, _b;
                        if (accInput.checked) {
                            if (window.acceptIndicates.indexOf(index) === -1) {
                                window.acceptIndicates.push(index);
                            }
                            if (window.rejectIndicates.indexOf(index) !== -1) {
                                window.rejectIndicates.splice(window.rejectIndicates.indexOf(index), 1);
                            }
                            this.accAllRadio.checked = false;
                            this.rejAllRadio.checked = false;
                        }
                        else {
                            if (window.acceptIndicates.indexOf(index) !== -1) {
                                window.acceptIndicates.splice(window.acceptIndicates.indexOf(index), 1);
                            }
                        }
                        window.customSelection = window.acceptIndicates.concat(window.rejectIndicates);
                        this.noisyBtn.style.visibility = Boolean((_a = window.customSelection) === null || _a === void 0 ? void 0 : _a.length) ? '' : 'hidden';
                        this.stopBtn.style.visibility = Boolean((_b = window.customSelection) === null || _b === void 0 ? void 0 : _b.length) ? '' : 'hidden';
                        this.updateSessionStorage();
                        this.projectorEventContext.refresh();
                    });
                    let newrejtd = document.createElement('td');
                    let rejectInput = document.createElement('input');
                    window.rejectInputList[indices[i]] = rejectInput;
                    rejectInput.setAttribute('type', `radio`);
                    rejectInput.setAttribute('name', `op${index}`);
                    accInput.setAttribute('id', `reject${index}`);
                    rejectInput.setAttribute('value', `reject`);
                    newrejtd.append(rejectInput);
                    if (window.queryResAnormalCleanIndecates && window.queryResAnormalCleanIndecates.indexOf(index) !== -1) {
                        let span = document.createElement('span');
                        span.innerText = "  ";
                        let newtd = document.createElement('td');
                        newtd.style.width = "50px";
                        newtd.append(span);
                        row.appendChild(newtd);
                    }
                    else {
                        row.appendChild(newrejtd);
                    }
                    rejectInput.addEventListener('change', () => {
                        var _a, _b;
                        if (rejectInput.checked) {
                            if (window.rejectIndicates.indexOf(index) === -1) {
                                window.rejectIndicates.push(index);
                            }
                            if (window.acceptIndicates.indexOf(index) !== -1) {
                                console.log(window.acceptIndicates.indexOf(index));
                                window.acceptIndicates.splice(window.acceptIndicates.indexOf(index), 1);
                            }
                            this.accAllRadio.checked = false;
                            this.rejAllRadio.checked = false;
                        }
                        else {
                            if (window.rejectIndicates.indexOf(index) !== -1) {
                                window.rejectIndicates.splice(window.rejectIndicates.indexOf(index), 1);
                            }
                        }
                        window.customSelection = window.acceptIndicates.concat(window.rejectIndicates);
                        this.noisyBtn.style.visibility = Boolean((_a = window.customSelection) === null || _a === void 0 ? void 0 : _a.length) ? '' : 'hidden';
                        this.stopBtn.style.visibility = Boolean((_b = window.customSelection) === null || _b === void 0 ? void 0 : _b.length) ? '' : 'hidden';
                        this.updateSessionStorage();
                        this.projectorEventContext.refresh();
                    });
                    // row.appendChild(input);
                }
                const label = this.getLabelFromIndex(index);
                let arr = label.split("|");
                for (let i = 0; i < arr.length; i++) {
                    let newtd = document.createElement('td');
                    newtd.className = 'queryResColumn';
                    newtd.innerText = arr[i];
                    row.appendChild(newtd);
                }
                row.onmouseenter = () => __awaiter(this, void 0, void 0, function* () {
                    yield fetch(`http://${DVIServer}/sprite?index=${indices[i]}&path=${basePath}&username=${window.sessionStorage.username}`, {
                        method: 'GET',
                        mode: 'cors'
                    }).then(response => response.json()).then(data => {
                        // console.log("response", data);
                        let imgsrc = data.imgUrl;
                        // this.projectorEventContext.updateMetaDataByIndices(indices[i], imgsrc)
                        this.projectorEventContext.notifyHoverOverPoint(index);
                        // logging.setModalMessage(null, msgId);
                    }).catch(error => {
                        console.log("error", error);
                    });
                });
                row.onmouseleave = () => {
                    // this.projectorEventContext.updateMetaDataByIndices(-1, '')
                    this.projectorEventContext.notifyHoverOverPoint(null);
                };
                row.className = 'row-img';
                // row.appendChild(rowLink);
                queryListTable.appendChild(row);
                list.appendChild(queryListTable);
            }
        });
    }
    updateSessionStorage() {
        console.log('update session');
        window.sessionStorage.setItem('acceptIndicates', window.acceptIndicates.join(","));
        window.sessionStorage.setItem('rejectIndicates', window.rejectIndicates.join(","));
        window.sessionStorage.setItem('customSelection', window.customSelection.join(","));
    }
    getLabelFromIndex(pointIndex) {
        var _a, _b, _c, _d, _e;
        if (!window.flagindecatesList) {
            window.flagindecatesList = [];
        }
        const metadata = (_a = this.projector.dataSet.points[pointIndex]) === null || _a === void 0 ? void 0 : _a.metadata[this.selectedMetadataField];
        let prediction = (_b = this.projector.dataSet.points[pointIndex]) === null || _b === void 0 ? void 0 : _b.current_prediction;
        if (prediction == undefined) {
            prediction = `Unknown`;
        }
        let original_label = (_c = this.projector.dataSet.points[pointIndex]) === null || _c === void 0 ? void 0 : _c.original_label;
        if (original_label == undefined) {
            original_label = `Unknown`;
        }
        let index = (_d = window.queryResPointIndices) === null || _d === void 0 ? void 0 : _d.indexOf(pointIndex);
        let suggest_label = this.labelMap[window.alSuggestLabelList[index]];
        if (original_label == undefined) {
            original_label = `Unknown`;
        }
        let score = (_e = window.alSuggestScoreList[index]) === null || _e === void 0 ? void 0 : _e.toFixed(3);
        const stringMetaData = metadata !== undefined ? String(metadata) : `Unknown #${pointIndex}`;
        const displayprediction = prediction;
        const displayStringMetaData = stringMetaData;
        const displayPointIndex = String(pointIndex);
        // return String(pointIndex) + "Label: " + stringMetaData + " Prediction: " + prediction + " Original label: " + original_label;
        let prediction_res = suggest_label === prediction || window.alSuggestLabelList.length === 0 ? ' - ' : ' ❗️ ';
        if (window.queryResAnormalCleanIndecates && window.queryResAnormalCleanIndecates.indexOf(pointIndex) !== -1) {
            return `${displayPointIndex}|${displayStringMetaData}| majority`;
        }
        if (window.queryResAnormalIndecates && window.queryResAnormalIndecates.indexOf(pointIndex) !== -1) {
            let prediction_res = suggest_label === displayStringMetaData ? ' - ' : ' ❗️ ';
            if (window.sessionStorage.isControlGroup == 'true') {
                return `${displayPointIndex}|${displayprediction}|${score !== undefined ? score : '-'}`;
            }
            else {
                if (prediction_res !== " - ") {
                    if (window.flagindecatesList.indexOf(pointIndex) === -1) {
                        window.flagindecatesList.push(pointIndex);
                    }
                }
                // return `${displayPointIndex}|${displayStringMetaData}|${prediction_res}|${score !== undefined ? score : '-'}`
                return `${displayPointIndex}|${displayprediction}|${score !== undefined ? score : '-'}`;
            }
        }
        if (this.showCheckAllQueryRes == false) {
            if (window.sessionStorage.isControlGroup == 'true') {
                return `${displayPointIndex}|${displayprediction}`;
            }
            else {
                if (prediction_res !== " - ") {
                    if (window.flagindecatesList.indexOf(pointIndex) === -1) {
                        window.flagindecatesList.push(pointIndex);
                    }
                }
                return `${displayPointIndex}|${displayprediction}`;
            }
        }
        if (window.sessionStorage.isControlGroup == 'true') {
            return `${displayPointIndex}|${displayprediction}|${score !== undefined ? score : '-'}`;
        }
        else {
            if (prediction_res !== " - ") {
                if (window.flagindecatesList.indexOf(pointIndex) === -1) {
                    window.flagindecatesList.push(pointIndex);
                }
            }
            // return `${displayPointIndex}|${displayprediction}|${prediction_res}|${score !== undefined ? score : '-'}`
            return `${displayPointIndex}|${displayprediction}|${score !== undefined ? score : '-'}`;
        }
    }
    getnnLabelFromIndex(pointIndex) {
        var _a;
        const metadata = this.projector.dataSet.points[pointIndex].metadata[this.selectedMetadataField];
        let prediction = (_a = this.projector.dataSet.points[pointIndex]) === null || _a === void 0 ? void 0 : _a.current_prediction;
        if (prediction == undefined) {
            prediction = `Unknown`;
        }
        let original_label = this.projector.dataSet.points[pointIndex].original_label;
        if (original_label == undefined) {
            original_label = `Unknown`;
        }
        if (original_label == undefined) {
            original_label = `Unknown`;
        }
        const stringMetaData = metadata !== undefined ? String(metadata) : `Unknown #${pointIndex}`;
        const displayprediction = prediction;
        const displayStringMetaData = stringMetaData;
        const displayPointIndex = String(pointIndex);
        // return String(pointIndex) + "Label: " + stringMetaData + " Prediction: " + prediction + " Original label: " + original_label;
        let prediction_res = stringMetaData === prediction ? ' - ' : ' ❗️ ';
        return `index:${displayPointIndex} | label:${displayStringMetaData}| prediction:${displayprediction} | ${prediction_res}`;
    }
    spriteImageRenderer() {
        const spriteImagePath = this.spriteMeta.imagePath;
        const { aspectRatio, nCols } = this.spriteMeta;
        const paddingBottom = 100 / aspectRatio + '%';
        const backgroundSize = `${nCols * 100}% ${nCols * 100}%`;
        const backgroundImage = `url(${CSS.escape(spriteImagePath)})`;
        return (neighbor) => {
            const spriteElementImage = document.createElement('div');
            spriteElementImage.className = 'sprite-image';
            spriteElementImage.style.backgroundImage = backgroundImage;
            spriteElementImage.style.paddingBottom = paddingBottom;
            spriteElementImage.style.backgroundSize = backgroundSize;
            const [row, col] = [
                Math.floor(neighbor.index / nCols),
                neighbor.index % nCols,
            ];
            const [top, left] = [
                (row / (nCols - 1)) * 100,
                (col / (nCols - 1)) * 100,
            ];
            spriteElementImage.style.backgroundPosition = `${left}% ${top}%`;
            return spriteElementImage;
        };
    }
    updateCurrentPlayEpoch(num) {
        this.currentPlayedEpoch = num;
    }
    updateNeighborsList(neighbors) {
        var _a, _b;
        neighbors = neighbors || this._currentNeighbors;
        this._currentNeighbors = neighbors;
        if (neighbors == null) {
            return;
        }
        const nnlist = this.$$('.nn-list');
        nnlist.textContent = '';
        if (neighbors.length === 0) {
            this.removeContext('.nn');
            return;
        }
        this.addContext('.nn');
        this.searchBox.message = '';
        const minDist = neighbors.length > 0 ? neighbors[0].dist : 0;
        if (this.spriteImagesAvailable && this.showNeighborImages) {
            var imageRenderer = this.spriteImageRenderer();
        }
        for (let i = 0; i < neighbors.length; i++) {
            const neighbor = neighbors[i];
            const neighborElement = document.createElement('div');
            neighborElement.className = 'neighbor';
            const neighborElementLink = document.createElement('a');
            neighborElementLink.className = 'neighbor-link';
            neighborElementLink.title = this.getnnLabelFromIndex(neighbor.index);
            const labelValueElement = document.createElement('div');
            labelValueElement.className = 'label-and-value';
            const labelElement = document.createElement('div');
            labelElement.className = 'label';
            labelElement.style.color = dist2color(this.distFunc, neighbor.dist, minDist);
            labelElement.innerText = this.getnnLabelFromIndex(neighbor.index);
            const valueElement = document.createElement('div');
            valueElement.className = 'value';
            valueElement.innerText = (_b = (_a = this.projector.dataSet.points[neighbor.index]) === null || _a === void 0 ? void 0 : _a.current_inv_acc) === null || _b === void 0 ? void 0 : _b.toFixed(3);
            labelValueElement.appendChild(labelElement);
            labelValueElement.appendChild(valueElement);
            const barElement = document.createElement('div');
            barElement.className = 'bar';
            const barFillElement = document.createElement('div');
            barFillElement.className = 'fill';
            barFillElement.style.borderTopColor = dist2color(this.distFunc, neighbor.dist, minDist);
            barFillElement.style.width =
                normalizeDist(this.distFunc, neighbor.dist, minDist) * 100 + '%';
            barElement.appendChild(barFillElement);
            for (let j = 1; j < 4; j++) {
                const tickElement = document.createElement('div');
                tickElement.className = 'tick';
                tickElement.style.left = (j * 100) / 4 + '%';
                barElement.appendChild(tickElement);
            }
            if (this.spriteImagesAvailable && this.showNeighborImages) {
                const neighborElementImage = imageRenderer(neighbor);
                neighborElement.appendChild(neighborElementImage);
            }
            neighborElementLink.appendChild(labelValueElement);
            neighborElementLink.appendChild(barElement);
            neighborElement.appendChild(neighborElementLink);
            nnlist.appendChild(neighborElement);
            neighborElementLink.onmouseenter = () => {
                this.projectorEventContext.notifyHoverOverPoint(neighbor.index);
            };
            neighborElementLink.onmouseleave = () => {
                this.projectorEventContext.notifyHoverOverPoint(null);
            };
            neighborElementLink.onclick = () => {
                this.projectorEventContext.notifySelectionChanged([neighbor.index]);
            };
        }
    }
    updateFilterButtons(numPoints) {
        if (numPoints) {
            this.setFilterButton.innerText = `Filter ${numPoints}`;
            if (numPoints > 1) {
                this.setFilterButton.disabled = null;
            }
            this.clearSelectionButton.disabled = null;
        }
        else {
            this.setFilterButton.innerText = `Filter selection`;
            this.setFilterButton.disabled = true;
            this.clearSelectionButton.disabled = true;
        }
    }
    setupUI(projector) {
        const self = this;
        const inkTabs = this.root.querySelectorAll('.ink-tab');
        for (let i = 0; i < inkTabs.length; i++) {
            inkTabs[i].addEventListener('click', function () {
                let id = this.getAttribute('data-tab');
                self.showTab(id);
            });
        }
        if (window)
            if (window.sessionStorage.taskType === 'anormaly detection' && window.sessionStorage.isControlGroup !== 'true') {
                self.showTab('anomaly');
            }
            else if (window.sessionStorage.taskType === 'active learning') {
                self.showTab('advanced');
            }
            else {
                self.showTab('normal');
                this.showMoreRecommend = false;
                // this.updateSearchResults([]);
            }
        this.queryByStrategtBtn.onclick = () => {
            this.queryByAl(projector, window.acceptIndicates, window.rejectIndicates, this.budget, true);
        };
        // if(this.showSelectionBtn){
        this.showSelectionBtn.onclick = () => {
            var _a;
            for (let i = 0; i < ((_a = window.previousIndecates) === null || _a === void 0 ? void 0 : _a.length); i++) {
                if (window.customSelection.indexOf(window.previousIndecates[i]) === -1) {
                    window.customSelection.push(window.previousIndecates[i]);
                }
            }
            this.projectorEventContext.notifySelectionChanged(this.queryIndices, false, 'isShowSelected');
            // this.updateSearchResults(this.queryIndices)
        };
        // }
        this.noisyshowSelectionBtn.onclick = () => {
            var _a;
            for (let i = 0; i < ((_a = window.previousIndecates) === null || _a === void 0 ? void 0 : _a.length); i++) {
                if (window.customSelection.indexOf(window.previousIndecates[i]) === -1) {
                    window.customSelection.push(window.previousIndecates[i]);
                }
            }
            this.projectorEventContext.notifySelectionChanged(this.queryIndices, false, 'isShowSelected');
            // this.updateSearchResults(this.queryIndices)
        };
        this.queryAnomalyBtn.onclick = () => {
            projector.queryAnormalyStrategy(Number(this.anomalyRecNum), this.selectedAnormalyClass, [], [], window.acceptIndicates, window.rejectIndicates, 'TBSampling', true, (indices, cleansIndices) => {
                if (indices != null) {
                    // this.queryIndices = indices;
                    if (this.queryIndices.length == 0) {
                        this.searchBox.message = '0 matches.';
                    }
                    else {
                        this.searchBox.message = `${this.queryIndices.length} matches.`;
                    }
                    window.queryResAnormalIndecates = indices;
                    window.queryResAnormalCleanIndecates = cleansIndices;
                    this.queryIndices = indices.concat(cleansIndices);
                    if (!this.isAlSelecting) {
                        this.isAlSelecting = true;
                        window.isAdjustingSel = true;
                        // this.boundingSelectionBtn.classList.add('actived')
                        this.projectorEventContext.setMouseMode(MouseMode.AREA_SELECT);
                    }
                    // this.projectorScatterPlotAdapter.scatterPlot.setMouseMode(MouseMode.AREA_SELECT);
                    this.showCheckAllQueryRes = true;
                    this.showMoreRecommend = true;
                    // if (window.sessionStorage.isControlGroup == 'true') {
                    //   this.showMoreRecommend = false
                    // } else {
                    //   this.showMoreRecommend = true
                    // }
                    this.checkAllQueryRes = false;
                    this.queryResultListTitle = 'Possible Abnormal Point List';
                    // let dom = this.$$("#queryResheader")
                    // dom.innerHTML = 'label'
                    this.projectorEventContext.notifySelectionChanged(this.queryIndices, false, 'isAnormalyQuery');
                }
            });
        };
        this.trainBySelBtn.onclick = () => {
            var _a, _b;
            if (((_a = window.acceptIndicates) === null || _a === void 0 ? void 0 : _a.length) < 500) {
                logging.setErrorMessage(`Current selected interested samples: ${(_b = window.acceptIndicates) === null || _b === void 0 ? void 0 : _b.length},
          Please Select 500 interest samples`);
                return;
            }
            this.resetStatus();
            // this.boundingSelectionBtn.classList.remove('actived')
            // this.projectorEventContext.setMouseMode(MouseMode.CAMERA_AND_CLICK_SELECT);
            // console.log(window.cus)
            let retrainList = window.previousIndecates;
            retrainList;
            for (let i = 0; i < window.customSelection.length; i++) {
                if (window.previousIndecates.indexOf(window.customSelection[i]) === -1) {
                    retrainList.push(window.customSelection[i]);
                }
            }
            function func(a, b) {
                return a - b;
            }
            retrainList.sort(func);
            this.projector.retrainBySelections(this.projector.iteration, window.acceptIndicates, window.rejectIndicates);
            //  this.projectionsPanel.reTrainBySel(this.projector.iteration,this.selectedPointIndices)
        };
        this.distFunc = vector.cosDist;
        const eucDist = this.$$('.distance a.euclidean');
        eucDist.onclick = () => {
            const links = this.root.querySelectorAll('.distance a');
            for (let i = 0; i < links.length; i++) {
                util.classed(links[i], 'selected', false);
            }
            util.classed(eucDist, 'selected', true);
            this.distFunc = vector.dist;
            this.projectorEventContext.notifyDistanceMetricChanged(this.distFunc);
            const neighbors = projector.dataSet.findNeighbors(this.selectedPointIndices[0], this.distFunc, this.numNN);
            this.updateNeighborsList(neighbors);
        };
        const cosDist = this.$$('.distance a.cosine');
        cosDist.onclick = () => {
            const links = this.root.querySelectorAll('.distance a');
            for (let i = 0; i < links.length; i++) {
                util.classed(links[i], 'selected', false);
            }
            util.classed(cosDist, 'selected', true);
            this.distFunc = vector.cosDist;
            this.projectorEventContext.notifyDistanceMetricChanged(this.distFunc);
            const neighbors = projector.dataSet.findNeighbors(this.selectedPointIndices[0], this.distFunc, this.numNN);
            this.updateNeighborsList(neighbors);
        };
        this.noisyBtn.onclick = () => {
            if (window.customSelection.length == 0) {
                alert('please confirm some points first');
                return;
            }
            window.isAnimatating = true;
            projector.getAllResPosList((data) => {
                if (data && data.results) {
                    window.allResPositions = data;
                    this.totalEpoch = Object.keys(data.results).length;
                    this.projectorEventContext.setDynamicNoisy();
                    this.noisyBtn.disabled = true;
                    this.stopBtn.disabled = false;
                }
            });
        };
        this.stopBtn.onclick = () => {
            var _a;
            window.isAnimatating = false;
            this.projectorEventContext.setDynamicStop();
            this.noisyBtn.disabled = false;
            this.stopBtn.disabled = true;
            // this.projectorEventContext.renderInTraceLine(false, 1, 1)
            if ((_a = window.lineGeomertryList) === null || _a === void 0 ? void 0 : _a.length) {
                for (let i = 0; i < window.lineGeomertryList; i++) {
                    window.lineGeomertryList[i].parent.remove(window.lineGeomertryList[i]);
                }
            }
        };
        this.enableResetFilterButton(false);
        const updateInput = (value, inRegexMode) => {
            this.searchPredicate = value;
            this.searchInRegexMode = inRegexMode;
        };
        this.searchBox.registerInputChangedListener((value, inRegexMode) => {
            updateInput(value, inRegexMode);
        });
        this.searchButton.onclick = () => {
            // read search box input and update indices
            if (this.searchPredicate == null || this.searchPredicate.trim() === '') {
                this.searchBox.message = '';
                this.projectorEventContext.notifySelectionChanged([]);
                return;
            }
            projector.query(this.searchPredicate, this.searchInRegexMode, this.selectedMetadataField, this.currentPredicate, window.iteration, this.confidenceThresholdFrom, this.confidenceThresholdTo, (indices) => {
                if (indices != null) {
                    this.queryIndices = indices;
                    if (this.queryIndices.length == 0) {
                        this.searchBox.message = '0 matches.';
                    }
                    else {
                        this.searchBox.message = `${this.queryIndices.length} matches.`;
                    }
                    this.showCheckAllQueryRes = true;
                    this.showMoreRecommend = false;
                    this.projectorEventContext.notifySelectionChanged(this.queryIndices, false, 'normal');
                    this.queryResultListTitle = 'Query Result List';
                }
            });
        };
    }
    queryByAl(projector, acceptIndicates, rejectIndicates, querNum, isRecommend) {
        let that = this;
        let num = Number(this.budget);
        let stratergy = this.selectedStratergy;
        if (this.selectedStratergy === 'Interest potential') {
            stratergy = 'TBSampling';
        }
        if (querNum) {
            num = Number(querNum);
        }
        if (isRecommend === false) {
            if (window.sessionStorage.isControlGroup == 'true') {
                stratergy = 'TBSampling';
            }
            else {
                stratergy = 'Feedback';
            }
        }
        if (!acceptIndicates) {
            acceptIndicates = [];
        }
        if (!rejectIndicates) {
            rejectIndicates = [];
        }
        projector.queryByAL(this.projector.iteration, stratergy, num, acceptIndicates, rejectIndicates, isRecommend, (indices, scores, labels) => {
            if (indices != null) {
                this.queryIndices = indices;
                if (this.queryIndices.length == 0) {
                    this.searchBox.message = '0 matches.';
                }
                else {
                    this.searchBox.message = `${this.queryIndices.length} matches.`;
                }
                window.alSuggestScoreList = scores;
                window.alSuggestLabelList = labels;
                if (!this.isAlSelecting) {
                    this.isAlSelecting = true;
                    window.isAdjustingSel = true;
                    // this.boundingSelectionBtn.classList.add('actived')
                    this.projectorEventContext.setMouseMode(MouseMode.AREA_SELECT);
                }
                this.showCheckAllQueryRes = true;
                this.showMoreRecommend = true;
                // if (window.sessionStorage.isControlGroup == 'true') {
                //   this.showMoreRecommend = false
                // } else {
                //   this.showMoreRecommend = true
                // }
                this.checkAllQueryRes = false;
                this.queryResultListTitle = 'Active Learning suggestion';
                let dom = this.$$("#queryResheader");
                dom.innerHTML = 'predict';
                this.projectorEventContext.notifySelectionChanged(this.queryIndices, false, 'isALQuery');
                // this.projectorScatterPlotAdapter.scatterPlot.setMouseMode(MouseMode.AREA_SELECT);
            }
        });
    }
    resetStatus() {
        this.isAlSelecting = false;
        window.isAdjustingSel = false;
    }
    playAnimationFinished() {
        this.noisyBtn.disabled = false;
        this.stopBtn.disabled = true;
    }
    showTab(id) {
        this.currentFilterType = id;
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
                this.style.height = (main === null || main === void 0 ? void 0 : main.clientHeight) + 'px';
            });
        }
        if (id === 'normal') {
            this.showMoreRecommend = false;
        }
        this.updateSearchResults([]);
        window.alSuggestScoreList = [];
        console.log('id', id);
    }
    updateDisabledStatues(value) {
        this.disabledAlExBase = value;
    }
    updateBoundingBoxSelection(indices) {
        var _a, _b;
        this.currentBoundingBoxSelection = indices;
        if (!window.customSelection) {
            window.customSelection = [];
        }
        for (let i = 0; i < this.currentBoundingBoxSelection.length; i++) {
            if (window.customSelection.indexOf(this.currentBoundingBoxSelection[i]) < 0) {
                window.customSelection.push(this.currentBoundingBoxSelection[i]);
            }
            else {
                let index = window.customSelection.indexOf(this.currentBoundingBoxSelection[i]);
                window.customSelection.splice(index, 1);
            }
        }
        this.noisyBtn.style.visibility = Boolean((_a = window.customSelection) === null || _a === void 0 ? void 0 : _a.length) ? '' : 'hidden';
        this.stopBtn.style.visibility = Boolean((_b = window.customSelection) === null || _b === void 0 ? void 0 : _b.length) ? '' : 'hidden';
        // window.customSelection = this.currentBoundingBoxSelection
    }
    updateNumNN() {
        if (this.selectedPointIndices != null) {
            this.projectorEventContext.notifySelectionChanged([
                this.selectedPointIndices[0],
            ]);
        }
    }
};
InspectorPanel.template = template;
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], InspectorPanel.prototype, "selectedStratergy", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], InspectorPanel.prototype, "selectedAnormalyStratergy", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], InspectorPanel.prototype, "selectedAnormalyClass", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], InspectorPanel.prototype, "budget", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], InspectorPanel.prototype, "anomalyRecNum", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], InspectorPanel.prototype, "suggestKNum", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], InspectorPanel.prototype, "selectedMetadataField", void 0);
__decorate([
    property({ type: Array }),
    __metadata("design:type", Array)
], InspectorPanel.prototype, "metadataFields", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], InspectorPanel.prototype, "metadataColumn", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], InspectorPanel.prototype, "numNN", void 0);
__decorate([
    property({ type: Object }),
    __metadata("design:type", Object)
], InspectorPanel.prototype, "spriteMeta", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], InspectorPanel.prototype, "showNeighborImages", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], InspectorPanel.prototype, "confidenceThresholdFrom", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], InspectorPanel.prototype, "confidenceThresholdTo", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], InspectorPanel.prototype, "disabledAlExBase", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], InspectorPanel.prototype, "showTrace", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], InspectorPanel.prototype, "currentPlayedEpoch", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], InspectorPanel.prototype, "totalEpoch", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], InspectorPanel.prototype, "spriteImagesAvailable", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], InspectorPanel.prototype, "noShow", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], InspectorPanel.prototype, "isCollapsed", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], InspectorPanel.prototype, "checkAllQueryRes", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], InspectorPanel.prototype, "collapseIcon", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], InspectorPanel.prototype, "showAnomaly", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], InspectorPanel.prototype, "isControlGroup", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], InspectorPanel.prototype, "shownormal", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], InspectorPanel.prototype, "queryResultListTitle", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], InspectorPanel.prototype, "showCheckAllQueryRes", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], InspectorPanel.prototype, "showMoreRecommend", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], InspectorPanel.prototype, "showPlayAndStop", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], InspectorPanel.prototype, "moreRecommednNum", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], InspectorPanel.prototype, "accAll", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], InspectorPanel.prototype, "rejAll", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], InspectorPanel.prototype, "showUnlabeledChecked", void 0);
__decorate([
    observe('showNeighborImages', 'spriteImagesAvailable'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InspectorPanel.prototype, "_refreshNeighborsList", null);
__decorate([
    observe('accAll'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InspectorPanel.prototype, "_accAllRes", null);
__decorate([
    observe('showTrace'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InspectorPanel.prototype, "_refreshScatterplot", null);
__decorate([
    observe('checkAllQueryRes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InspectorPanel.prototype, "_checkAll", null);
InspectorPanel = __decorate([
    customElement('vz-projector-inspector-panel')
], InspectorPanel);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLWluc3BlY3Rvci1wYW5lbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3RlbnNvcmJvYXJkL3Byb2plY3Rvci92ei1wcm9qZWN0b3ItaW5zcGVjdG9yLXBhbmVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7OztnRkFhZ0Y7QUFDaEYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ2xELE9BQU8sRUFBRSxhQUFhLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBRXZFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ2hGLE9BQU8sd0NBQXdDLENBQUM7QUFHaEQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQy9ELE9BQU8sc0JBQXNCLENBQUM7QUFDOUIsT0FBTyxFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUUxRSxPQUFPLEVBQWUsU0FBUyxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBTXZELE9BQU8sS0FBSyxNQUFNLE1BQU0sVUFBVSxDQUFDO0FBQ25DLE9BQU8sS0FBSyxJQUFJLE1BQU0sUUFBUSxDQUFDO0FBQy9CLE9BQU8sS0FBSyxPQUFPLE1BQU0sV0FBVyxDQUFDO0FBRXJDLE1BQU0sYUFBYSxHQUFHLEtBQUssQ0FBQztBQUM1QixNQUFNLGlCQUFpQixHQUFHLEdBQUcsQ0FBQztBQVU5QixJQUFNLGNBQWMsR0FBcEIsTUFBTSxjQUFlLFNBQVEsa0JBQWtCLENBQUMsY0FBYyxDQUFDO0lBQS9EOztRQU1FLHNCQUFpQixHQUFXLG9CQUFvQixDQUFDO1FBTWpELDBCQUFxQixHQUFXLENBQUMsQ0FBQztRQXFCbEMsVUFBSyxHQUFXLGlCQUFpQixDQUFDO1FBTWxDLHVCQUFrQixHQUFZLElBQUksQ0FBQztRQVNuQyxxQkFBZ0IsR0FBWSxLQUFLLENBQUE7UUFtQmpDLDBCQUFxQixHQUFZLElBQUksQ0FBQztRQUd0QyxXQUFNLEdBQVksS0FBSyxDQUFDO1FBR3hCLGdCQUFXLEdBQVksS0FBSyxDQUFDO1FBRzdCLHFCQUFnQixHQUFZLEtBQUssQ0FBQTtRQUdqQyxpQkFBWSxHQUFXLGFBQWEsQ0FBQztRQUdyQyxnQkFBVyxHQUFZLEtBQUssQ0FBQTtRQUc1QixtQkFBYyxHQUFZLEtBQUssQ0FBQTtRQUcvQixlQUFVLEdBQVksS0FBSyxDQUFBO1FBRzNCLHlCQUFvQixHQUFXLG1CQUFtQixDQUFBO1FBR2xELHlCQUFvQixHQUFZLElBQUksQ0FBQTtRQUdwQyxzQkFBaUIsR0FBWSxJQUFJLENBQUE7UUFJakMsb0JBQWUsR0FBWSxLQUFLLENBQUE7UUFJaEMscUJBQWdCLEdBQVcsRUFBRSxDQUFBO1FBRzdCLFdBQU0sR0FBWSxLQUFLLENBQUE7UUFHdkIsV0FBTSxHQUFZLEtBQUssQ0FBQTtRQUl2Qix5QkFBb0IsR0FBWSxJQUFJLENBQUE7SUE2MEN0QyxDQUFDO0lBN3dDQyxLQUFLO1FBQ0gsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBRWQsSUFBSSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUE7UUFFMUIsSUFBSSxDQUFDLGlCQUFpQixHQUFHLFFBQVEsQ0FBQTtRQUlqQyxJQUFJLENBQUMsV0FBVyxHQUFHLE1BQU0sQ0FBQyxjQUFjLENBQUMsUUFBUSxJQUFJLG9CQUFvQixDQUFBO1FBQ3pFLElBQUksQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLGNBQWMsQ0FBQyxRQUFRLElBQUksaUJBQWlCLElBQUksTUFBTSxDQUFDLFFBQVEsSUFBSSxpQkFBaUIsQ0FBQTtRQUM3RyxJQUFJLENBQUMsY0FBYyxHQUFHLE1BQU0sQ0FBQyxjQUFjLENBQUMsY0FBYyxJQUFJLE1BQU0sQ0FBQTtRQUVwRSwwSEFBMEg7UUFFMUgsNkRBQTZEO1FBQzdELGdDQUFnQztRQUNoQyxJQUFJO1FBQ0osSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMscUJBQXFCLENBQXNCLENBQUM7UUFDOUUsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFzQixDQUFDO1FBQ3ZFLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFzQixDQUFDO1FBQ3hFLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLHVCQUF1QixDQUFzQixDQUFBO1FBQ2xGLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBc0IsQ0FBQztRQUV0RSxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFnQixDQUFDO1FBQzFELElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQWdCLENBQUM7UUFDMUQsbUZBQW1GO1FBRW5GLDBFQUEwRTtRQUMxRSxzRUFBc0U7UUFDdEUsdUNBQXVDO1FBQ3ZDLHVCQUF1QjtRQUN2QiwwQkFBMEI7UUFDMUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFzQixDQUFBO1FBQy9ELElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBc0IsQ0FBQTtRQUVsRSxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFzQixDQUFDO1FBQzVELElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQXNCLENBQUM7UUFDdEQsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBc0IsQ0FBQztRQUMxRCxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFzQixDQUFDO1FBQ3hELElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQXNCLENBQUM7UUFDeEQsMEVBQTBFO1FBQzFFLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBc0IsQ0FBQTtRQUN4RSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxtQkFBbUIsQ0FBUSxDQUFDLENBQUMsbUJBQW1CO1FBRy9FLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQW1CLENBQUM7UUFDNUQsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBUSxDQUFDLENBQUMsaUJBQWlCO1FBQ2pFLElBQUksQ0FBQyxlQUFlLEdBQUcsRUFBRSxDQUFDO1FBQzFCLG9CQUFvQjtRQUVwQixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO1FBQzNCLElBQUksQ0FBQyxZQUFZLEdBQUcsRUFBRSxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxhQUFhLEdBQUcsRUFBRSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxFQUFFLENBQUM7UUFDL0IsSUFBSSxDQUFDLDJCQUEyQixHQUFHLEVBQUUsQ0FBQztRQUN0QyxpREFBaUQ7UUFDakQsSUFBSSxDQUFDLHVCQUF1QixHQUFHLENBQUMsQ0FBQTtRQUNoQyxJQUFJLENBQUMscUJBQXFCLEdBQUcsQ0FBQyxDQUFBO1FBRTlCLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxLQUFLLENBQUE7UUFDN0IscUJBQXFCO1FBQ3JCLG1CQUFtQjtRQUNuQixJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQTtRQUN0QixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO1FBRTdCLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFBO1FBQ2hCLElBQUksQ0FBQyxhQUFhLEdBQUcsRUFBRSxDQUFBO1FBQ3ZCLElBQUksQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFBO0lBQ3ZCLENBQUM7SUFDRCxVQUFVLENBQUMsU0FBYyxFQUFFLHFCQUE0Qzs7UUFDckUsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDM0IsSUFBSSxDQUFDLHFCQUFxQixHQUFHLHFCQUFxQixDQUFDO1FBQ25ELElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDeEIsSUFBSSxDQUFDLFFBQVEsR0FBRztZQUNkLEdBQUcsRUFBRSxPQUFPO1lBQ1osR0FBRyxFQUFFLEtBQUs7WUFDVixHQUFHLEVBQUUsTUFBTTtZQUNYLEdBQUcsRUFBRSxLQUFLO1lBQ1YsR0FBRyxFQUFFLE1BQU07WUFDWCxHQUFHLEVBQUUsS0FBSztZQUNWLEdBQUcsRUFBRSxNQUFNO1lBQ1gsR0FBRyxFQUFFLE9BQU87WUFDWixHQUFHLEVBQUUsTUFBTTtZQUNYLEdBQUcsRUFBRSxPQUFPO1NBQ2IsQ0FBQTtRQUNELHFCQUFxQixDQUFDLGdDQUFnQyxDQUNwRCxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQ3pFLENBQUM7UUFDRiw0Q0FBNEM7UUFDNUMsSUFBSSxDQUFDLFlBQVksR0FBRyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQTtRQUNyQywyQkFBMkI7UUFDM0IsSUFBSSxDQUFDLFlBQVksR0FBRyxDQUFDLG9CQUFvQixFQUFFLFFBQVEsQ0FBQyxDQUFBO1FBQ3BELDhCQUE4QjtRQUM5QixJQUFJLENBQUMsb0JBQW9CLEdBQUcsQ0FBQyxrQkFBa0IsRUFBRSxrQkFBa0IsRUFBRSxvQkFBb0IsQ0FBQyxDQUFBO1FBQzFGLDZCQUE2QjtRQUM3QixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUE7UUFDN1QsNENBQTRDO1FBQzVDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDOUIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDNUI7UUFDRCxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsT0FBTyxPQUFDLE1BQU0sQ0FBQyxlQUFlLDBDQUFFLE1BQU0sQ0FBQyxDQUFBLENBQUMsQ0FBQSxFQUFFLENBQUEsQ0FBQyxDQUFBLFFBQVEsQ0FBQTtRQUNwRixJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsT0FBTyxPQUFDLE1BQU0sQ0FBQyxlQUFlLDBDQUFFLE1BQU0sQ0FBQyxDQUFBLENBQUMsQ0FBQSxFQUFFLENBQUEsQ0FBQyxDQUFBLFFBQVEsQ0FBQTtJQUNyRixDQUFDO0lBQ0QsMkRBQTJEO0lBQ25ELG1CQUFtQixDQUN6QixPQUFpQixFQUNqQixTQUE2QjtRQUU3QixJQUFJLENBQUMscUJBQXFCLEdBQUcsU0FBUyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxPQUFPLENBQUM7UUFDcEMsK0RBQStEO1FBQy9ELDRDQUE0QztRQUM1QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDcEMsSUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUMxQixJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUM7U0FDbkM7YUFBTTtZQUNMLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLENBQUMsQ0FBQztTQUM5QjtJQUNILENBQUM7SUFDTyx1QkFBdUIsQ0FBQyxPQUFnQjtRQUM5Qyw4Q0FBOEM7SUFDaEQsQ0FBQztJQUVELDRDQUE0QztJQUM1Qyx3QkFBd0I7UUFDckIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2pELElBQUksQ0FBQyxXQUFXLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO1FBQ3JDLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDN0UsQ0FBQztJQUNELGVBQWU7O1FBQ2IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLE9BQU8sT0FBQyxNQUFNLENBQUMsZUFBZSwwQ0FBRSxNQUFNLENBQUMsQ0FBQSxDQUFDLENBQUEsRUFBRSxDQUFBLENBQUMsQ0FBQSxRQUFRLENBQUE7UUFDcEYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLE9BQU8sT0FBQyxNQUFNLENBQUMsZUFBZSwwQ0FBRSxNQUFNLENBQUMsQ0FBQSxDQUFDLENBQUEsRUFBRSxDQUFBLENBQUMsQ0FBQSxRQUFRLENBQUE7SUFDckYsQ0FBQztJQUNELHFCQUFxQixDQUFDLFFBQWU7UUFDbkMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxjQUFjLElBQUksSUFBSSxDQUFDLENBQUM7SUFDaEUsQ0FBQztJQUNELGVBQWUsQ0FBQyxpQkFBd0M7O1FBQ3RELElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3BCLElBQUksQ0FBQyxjQUFjLEdBQUcsaUJBQWlCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUM3RCxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsSUFBSSxVQUFVLEtBQUssQ0FBQyxDQUFDLEVBQUU7Z0JBQ3pDLFVBQVUsR0FBRyxDQUFDLENBQUM7YUFDaEI7WUFDRCxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUM7UUFDcEIsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUNFLGlCQUFpQixDQUFDLGNBQWM7WUFDaEMsaUJBQWlCLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFDMUM7WUFDQSxNQUFNLENBQ0osV0FBVyxFQUNYLFlBQVksRUFDYixHQUFHLGlCQUFpQixDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUM7WUFDcEQsSUFBSSxDQUFDLFVBQVUsR0FBRztnQkFDaEIsU0FBUyxRQUFFLGlCQUFpQixDQUFDLFdBQVcsMENBQUUsR0FBRztnQkFDN0MsV0FBVyxFQUFFLFdBQVcsR0FBRyxZQUFZO2dCQUN2QyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFBLGlCQUFpQixDQUFDLFdBQVcsMENBQUUsS0FBSyxJQUFHLFdBQVcsQ0FBQztnQkFDckUsY0FBYyxFQUFFLENBQUMsV0FBVyxFQUFFLFlBQVksQ0FBQzthQUM1QyxDQUFDO1NBQ0g7YUFBTTtZQUNMLElBQUksQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFDO1NBQ3RCO1FBQ0QsSUFBSSxDQUFDLHFCQUFxQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQztRQUN6RCxJQUNFLElBQUksQ0FBQyxxQkFBcUIsSUFBSSxJQUFJO1lBQ2xDLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLHFCQUFxQixDQUFDO2lCQUN0RSxNQUFNLEtBQUssQ0FBQyxFQUNmO1lBQ0EsdURBQXVEO1lBQ3ZELElBQUksQ0FBQyxxQkFBcUIsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7U0FDM0U7UUFDRCxJQUFJLENBQUMsbUJBQW1CLENBQ3RCLElBQUksQ0FBQyxvQkFBb0IsRUFDekIsSUFBSSxDQUFDLHFCQUFxQixDQUMzQixDQUFDO0lBQ0osQ0FBQztJQUNELGNBQWM7UUFDWixJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDdEMsQ0FBQztJQUdELHFCQUFxQjtRQUNuQixJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztJQUM3QixDQUFDO0lBR0QsVUFBVTtRQUNSLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNmLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUE7U0FDbkI7SUFFSCxDQUFDO0lBS0QsbUJBQW1COztRQUNqQixJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7WUFDbEIsTUFBQSxJQUFJLENBQUMscUJBQXFCLDBDQUFFLGlCQUFpQixDQUFDLElBQUksRUFBQztTQUNwRDthQUFNO1lBQ0wsTUFBQSxJQUFJLENBQUMscUJBQXFCLDBDQUFFLGlCQUFpQixDQUFDLEtBQUssRUFBQztTQUNyRDtJQUNILENBQUM7SUFFRCxTQUFTOztRQUNQLElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFO1lBQ3pCLElBQUksTUFBTSxDQUFDLFdBQVcsRUFBRTtnQkFDdEIsSUFBSSxNQUFNLENBQUMsb0JBQW9CLElBQUksTUFBTSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sRUFBRTtvQkFDckUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7d0JBQzNELElBQUksS0FBSyxHQUFHLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQTt3QkFDMUMsSUFBSSxNQUFNLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTs0QkFDaEQsSUFBSSxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxFQUFFO2dDQUM3QixNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUE7NkJBQ3pDOzRCQUNELE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFBO3lCQUNuQztxQkFDRjtvQkFDRCxJQUFJLENBQUMscUJBQXFCLENBQUMsT0FBTyxFQUFFLENBQUE7aUJBQ3JDO2FBQ0Y7U0FDRjthQUFNO1lBQ0wsSUFBSSxNQUFNLENBQUMsV0FBVyxFQUFFO2dCQUN0QixJQUFJLE1BQU0sQ0FBQyxvQkFBb0IsSUFBSSxNQUFNLENBQUMsb0JBQW9CLENBQUMsTUFBTSxFQUFFO29CQUNyRSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTt3QkFDM0QsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFBO3dCQUMxQyxJQUFJLE1BQU0sQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFOzRCQUNoRCxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQTs0QkFDN0MsSUFBSSxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxFQUFFO2dDQUM3QixNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUE7NkJBQzFDOzRCQUNELE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTs0QkFDbkMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLE9BQU8sT0FBQyxNQUFNLENBQUMsZUFBZSwwQ0FBRSxNQUFNLENBQUMsQ0FBQSxDQUFDLENBQUEsRUFBRSxDQUFBLENBQUMsQ0FBQSxRQUFRLENBQUE7NEJBQ3BGLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxPQUFPLE9BQUMsTUFBTSxDQUFDLGVBQWUsMENBQUUsTUFBTSxDQUFDLENBQUEsQ0FBQyxDQUFBLEVBQUUsQ0FBQSxDQUFDLENBQUEsUUFBUSxDQUFBO3lCQUNwRjtxQkFDRjtvQkFDRCxJQUFJLENBQUMscUJBQXFCLENBQUMsT0FBTyxFQUFFLENBQUE7aUJBQ3JDO2FBQ0Y7U0FDRjtJQUNILENBQUM7SUFFRCxxQkFBcUIsQ0FBQyxPQUFnQixFQUFFLGNBQXNCO1FBQzVELElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUU7WUFDOUMsT0FBTztTQUNSO1FBQ0QsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FDbEUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssY0FBYyxDQUNqQyxDQUFDO1FBQ0YsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsbUJBQW1CLEVBQUU7WUFDaEUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ3JDLE9BQU87U0FDUjtRQUNELElBQUksQ0FBQyxjQUFjLEdBQUcsY0FBYyxDQUFDO1FBQ3JDLElBQUksQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUNsQyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFtQixDQUFDO1FBQ3ZELElBQUksQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO1FBQ3RCLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdEUsSUFBSSxRQUFRLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBQ2pELE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtZQUNwQixNQUFNLGVBQWUsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3RELGVBQWUsQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDO1lBQ3ZDLE1BQU0sbUJBQW1CLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN4RCxtQkFBbUIsQ0FBQyxTQUFTLEdBQUcsZUFBZSxDQUFDO1lBQ2hELG1CQUFtQixDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDO1lBQ3BDLE1BQU0saUJBQWlCLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN4RCxpQkFBaUIsQ0FBQyxTQUFTLEdBQUcsaUJBQWlCLENBQUM7WUFDaEQsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNuRCxZQUFZLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQztZQUNqQyxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3hFLFlBQVksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUNqQyxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25ELFlBQVksQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDO1lBQ2pDLFlBQVksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUM1QyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDNUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQzVDLE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDakQsVUFBVSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7WUFDN0IsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNyRCxjQUFjLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQztZQUNsQyxjQUFjLENBQUMsS0FBSyxDQUFDLGNBQWMsR0FBRyxVQUFVLENBQzlDLElBQUksQ0FBQyxRQUFRLEVBQ2IsUUFBUSxFQUNSLENBQUMsQ0FBQyxLQUFLLENBQ1IsQ0FBQztZQUNGLGNBQWMsQ0FBQyxLQUFLLENBQUMsS0FBSztnQkFDeEIsYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDO1lBQzlELFVBQVUsQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDdkMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDMUIsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDbEQsV0FBVyxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUM7Z0JBQy9CLFdBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7Z0JBQzdDLFVBQVUsQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7YUFDckM7WUFDRCxtQkFBbUIsQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUNuRCxtQkFBbUIsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDNUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1lBQ2pELElBQUksQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDbEMsbUJBQW1CLENBQUMsT0FBTyxHQUFHLEdBQUcsRUFBRTtnQkFDakMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN2RCxDQUFDLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyxVQUFVLENBQUMsT0FBZTtRQUNoQyxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO1lBQ2hELElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQ3BDO1FBQ0QsSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtZQUNoQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBb0IsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQztRQUN4RCxDQUFDLENBQUMsQ0FBQztRQUNGLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFvQixDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO0lBQzVELENBQUM7SUFDTyxhQUFhLENBQUMsT0FBZTtRQUNuQyxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssT0FBTyxDQUFDLENBQUM7UUFDeEUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQW9CLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFDNUQsSUFBSSxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDbkMsSUFBSSxXQUFXLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUN2RSxJQUFJLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBb0IsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztTQUMvRDtJQUNILENBQUM7SUFDRCxpQkFBaUI7UUFDZixJQUFJLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDLENBQUE7SUFDOUIsQ0FBQztJQUNELG1CQUFtQjtRQUNqQixJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFBO0lBQzdDLENBQUM7SUFFRCxzQkFBc0IsQ0FBQyxJQUFTO1FBQzlCLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUNoQyxDQUFDO0lBQ2EsbUJBQW1CLENBQUMsT0FBaUI7OztZQUNqRCxJQUFJLE9BQUEsSUFBSSxDQUFDLFdBQVcsMENBQUUsT0FBTyxZQUFJLElBQUksQ0FBQyxXQUFXLDBDQUFFLE9BQU8sQ0FBQSxFQUFFO2dCQUMxRCxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUE7Z0JBQ2hDLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQTthQUNqQztZQUNELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFtQixDQUFDO1lBQzdELE1BQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFtQixDQUFDO1lBQ2hFLElBQUksQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO1lBQ3RCLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7Z0JBQ3hCLElBQUksQ0FBQyxhQUFhLENBQUMsZUFBZSxDQUFDLENBQUM7Z0JBQ3BDLE9BQU87YUFDUjtZQUNELElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDakMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsT0FBTztnQkFDN0IsT0FBTyxDQUFDLE1BQU0sSUFBSSxhQUFhLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ2xELE9BQU8sR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxhQUFhLENBQUMsQ0FBQztZQUMxQyxJQUFJLENBQUMsYUFBYSxHQUFHLFNBQVMsQ0FBQyxhQUFhLENBQUMsbUJBQW1CLENBQXNCLENBQUE7WUFFdEYscUVBQXFFO1lBQ3JFLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRTtnQkFFdEIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLEdBQUcsR0FBRyxFQUFFO29CQUNoQyxJQUFJLENBQUMsTUFBTSxDQUFDLGVBQWUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxlQUFlLEVBQUU7d0JBQ3RELE9BQU8sQ0FBQyxlQUFlLENBQUMscUNBQXFDLENBQUMsQ0FBQzt3QkFDL0QsT0FBTTtxQkFDUDtvQkFDRCxJQUFJLE1BQU0sQ0FBQyxjQUFjLENBQUMsUUFBUSxLQUFLLGlCQUFpQixFQUFFO3dCQUN4RCxzQkFBc0I7d0JBQ3RCLHNCQUFzQjt3QkFDdEIsbUNBQW1DO3dCQUNuQyxrQ0FBa0M7d0JBQ2xDLElBQUk7d0JBQ0osaUNBQWlDO3dCQUNqQyxnQ0FBZ0M7d0JBQ2hDLFdBQVc7d0JBQ1gsOERBQThEO3dCQUM5RCwrRUFBK0U7d0JBQy9FLG1EQUFtRDt3QkFDbkQsZUFBZTt3QkFDZiwwREFBMEQ7d0JBQzFELFFBQVE7d0JBQ1IsTUFBTTt3QkFDTixJQUFJO3dCQUNKLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxDQUFBO3FCQUM3Rzt5QkFBTSxJQUFJLE1BQU0sQ0FBQyxjQUFjLENBQUMsUUFBUSxLQUFLLG9CQUFvQixFQUFFO3dCQUNsRSxJQUFJLFdBQVcsR0FBVSxFQUFFLENBQUE7d0JBQzNCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsd0JBQXdCLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFOzRCQUMvRCxJQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTs0QkFDOUYsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQTs0QkFDdkIsSUFBSSxLQUFLLElBQUksTUFBTSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtnQ0FDeEYsTUFBTSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTs2QkFDbEU7eUJBQ0Y7d0JBQ0QsSUFBSSxnQkFBZ0IsR0FBRyxVQUFVLENBQUE7d0JBQ2pDLHNCQUFzQjt3QkFDdEIsSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLGNBQWMsSUFBSSxNQUFNLEVBQUU7NEJBQ2xELGdCQUFnQixHQUFHLFlBQVksQ0FBQTt5QkFDaEM7d0JBQ0QsSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FFbEMsTUFBTSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxNQUFNLENBQUMsd0JBQXdCLEVBQUUsV0FBVyxFQUFFLE1BQU0sQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLGVBQWUsRUFBRSxnQkFBZ0IsRUFBRSxLQUFLLEVBQ2hMLENBQUMsT0FBWSxFQUFFLGFBQWtCLEVBQUUsRUFBRTs0QkFDbkMsSUFBSSxPQUFPLElBQUksSUFBSSxFQUFFO2dDQUNuQiwrQkFBK0I7Z0NBQy9CLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO29DQUNqQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sR0FBRyxZQUFZLENBQUM7aUNBQ3ZDO3FDQUFNO29DQUNMLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLFdBQVcsQ0FBQztpQ0FDakU7Z0NBRUQsTUFBTSxDQUFDLHdCQUF3QixHQUFHLE9BQU8sQ0FBQTtnQ0FDekMsTUFBTSxDQUFDLDZCQUE2QixHQUFHLGFBQWEsQ0FBQTtnQ0FFcEQsSUFBSSxDQUFDLFlBQVksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFBO2dDQUdqRCxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRTtvQ0FDdkIsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUE7b0NBQ3pCLE1BQU0sQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFBO29DQUM1QixxREFBcUQ7b0NBQ3JELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFBO2lDQUMvRDtnQ0FDRCxvRkFBb0Y7Z0NBQ3BGLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLENBQUE7Z0NBQ2hDLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUE7Z0NBQzdCLHdEQUF3RDtnQ0FDeEQsbUNBQW1DO2dDQUNuQyxXQUFXO2dDQUNYLGtDQUFrQztnQ0FDbEMsSUFBSTtnQ0FDSixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO2dDQUM3QixJQUFJLENBQUMsb0JBQW9CLEdBQUcsOEJBQThCLENBQUE7Z0NBQzFELHVDQUF1QztnQ0FFdkMsMEJBQTBCO2dDQUMxQixJQUFJLENBQUMscUJBQXFCLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxLQUFLLEVBQUUsaUJBQWlCLENBQUMsQ0FBQzs2QkFDaEc7d0JBQ0gsQ0FBQyxDQUFDLENBQUE7cUJBRUw7Z0JBQ0gsQ0FBQyxDQUFBO2FBQ0Y7WUFDRCxJQUFJLFNBQVMsR0FBRyxNQUFNLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQztZQUNoRCxJQUFJLFFBQVEsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFBO1lBQy9CLElBQUksT0FBTyxHQUFHLElBQUksT0FBTyxFQUFFLENBQUM7WUFDNUIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUNuRCxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1lBRTdDLE1BQU0sQ0FBQyxtQkFBbUIsR0FBRyxFQUFFLENBQUE7WUFDL0IsTUFBTSxDQUFDLFdBQVcsR0FBRyxFQUFFLENBQUE7WUFDdkIsTUFBTSxDQUFDLGVBQWUsR0FBRyxFQUFFLENBQUE7WUFDM0IsTUFBTSxDQUFDLGVBQWUsR0FBRyxFQUFFLENBQUE7WUFDM0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxlQUFlLEVBQUU7Z0JBQzNCLE1BQU0sQ0FBQyxlQUFlLEdBQUcsRUFBRSxDQUFBO2FBQzVCO1lBQ0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxlQUFlLEVBQUU7Z0JBQzNCLE1BQU0sQ0FBQyxlQUFlLEdBQUcsRUFBRSxDQUFBO2FBQzVCO1lBR0QsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN2RCxjQUFjLENBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQTtZQUNyQyxJQUFJLElBQUksQ0FBQyxvQkFBb0IsS0FBSyxJQUFJLEVBQUU7Z0JBQ3RDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQVEsQ0FBQztnQkFDbEQsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBUSxDQUFDO2dCQUNsRCw4Q0FBOEM7Z0JBQzlDLG1CQUFtQjtnQkFDbkIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRTs7b0JBQ2hELE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUE7b0JBQzlDLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUU7d0JBQzVCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFOzRCQUN2QyxNQUFNLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUE7NEJBQ2pELE1BQU0sQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQTs0QkFDbEQsSUFBSSxNQUFNLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtnQ0FDckQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7NkJBQ3hDOzRCQUNELElBQUksTUFBTSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7Z0NBQ3JELElBQUksS0FBSyxHQUFHLE1BQU0sQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO2dDQUN0RCxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUE7NkJBQ3hDO3lCQUNGO3FCQUNGO29CQUVELE1BQU0sQ0FBQyxlQUFlLEdBQUcsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFBO29CQUM5RSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsT0FBTyxPQUFDLE1BQU0sQ0FBQyxlQUFlLDBDQUFFLE1BQU0sQ0FBQyxDQUFBLENBQUMsQ0FBQSxFQUFFLENBQUEsQ0FBQyxDQUFBLFFBQVEsQ0FBQTtvQkFDcEYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLE9BQU8sT0FBQyxNQUFNLENBQUMsZUFBZSwwQ0FBRSxNQUFNLENBQUMsQ0FBQSxDQUFDLENBQUEsRUFBRSxDQUFBLENBQUMsQ0FBQSxRQUFRLENBQUE7b0JBQ25GLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFBO29CQUMzQixJQUFJLENBQUMscUJBQXFCLENBQUMsT0FBTyxFQUFFLENBQUE7Z0JBQ3RDLENBQUMsQ0FBQyxDQUFBO2dCQUNGLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUU7O29CQUNoRCxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFBO29CQUM5QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTt3QkFDdkMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFBO3dCQUNsRCxNQUFNLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUE7d0JBQ2pELElBQUksTUFBTSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7NEJBQ3JELE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO3lCQUN4Qzt3QkFDRCxJQUFJLE1BQU0sQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFOzRCQUNyRCxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTs0QkFDdEQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFBO3lCQUN4QztxQkFDRjtvQkFDRCxNQUFNLENBQUMsZUFBZSxHQUFHLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQTtvQkFDOUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLE9BQU8sT0FBQyxNQUFNLENBQUMsZUFBZSwwQ0FBRSxNQUFNLENBQUMsQ0FBQSxDQUFDLENBQUEsRUFBRSxDQUFBLENBQUMsQ0FBQSxRQUFRLENBQUE7b0JBQ3BGLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxPQUFPLE9BQUMsTUFBTSxDQUFDLGVBQWUsMENBQUUsTUFBTSxDQUFDLENBQUEsQ0FBQyxDQUFBLEVBQUUsQ0FBQSxDQUFDLENBQUEsUUFBUSxDQUFBO29CQUNuRixJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQTtvQkFDM0IsSUFBSSxDQUFDLHFCQUFxQixDQUFDLE9BQU8sRUFBRSxDQUFBO2dCQUN0QyxDQUFDLENBQUMsQ0FBQTtnQkFDRixLQUFLO2dCQUVMLElBQUk7YUFDTDtZQUNELElBQUksT0FBTyxDQUFDLE1BQU0sR0FBRyxJQUFJLEVBQUU7Z0JBQ3pCLE9BQU8sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFBO2FBQ3RCO1lBQ0QsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQ3ZDLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDekIsTUFBTSxHQUFHLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDekMsR0FBRyxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7Z0JBRXRCLCtDQUErQztnQkFDL0MsK0JBQStCO2dCQUMvQix5QkFBeUI7Z0JBQ3pCLDZCQUE2QjtnQkFDN0IsR0FBRyxDQUFDLFlBQVksR0FBRyxHQUFHLEVBQUU7b0JBQ3RCLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDekQsQ0FBQyxDQUFDO2dCQUNGLEdBQUcsQ0FBQyxZQUFZLEdBQUcsR0FBRyxFQUFFO29CQUN0QixJQUFJLENBQUMscUJBQXFCLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3hELENBQUMsQ0FBQztnQkFDRixJQUFJLElBQUksQ0FBQyxvQkFBb0IsS0FBSyxJQUFJLEVBQUU7b0JBRXRDLCtDQUErQztvQkFDL0MsMEJBQTBCO29CQUMxQix1REFBdUQ7b0JBQ3ZELDZCQUE2QjtvQkFDN0IsNEJBQTRCO29CQUM1QixJQUFJO29CQUNKLHlDQUF5QztvQkFDekMsNENBQTRDO29CQUM1QyxtQ0FBbUM7b0JBQ25DLGtDQUFrQztvQkFDbEMsTUFBTTtvQkFDTix5QkFBeUI7b0JBQ3pCLCtEQUErRDtvQkFDL0QsZ0RBQWdEO29CQUNoRCw2Q0FBNkM7b0JBQzdDLFFBQVE7b0JBQ1IsYUFBYTtvQkFDYiw2REFBNkQ7b0JBQzdELDhDQUE4QztvQkFDOUMsMkNBQTJDO29CQUMzQyxNQUFNO29CQUNOLGlFQUFpRTtvQkFDakUsS0FBSztvQkFFTCw2RUFBNkU7b0JBQzdFLHlCQUF5QjtvQkFDekIsSUFBSTtvQkFDSiwyQ0FBMkM7b0JBQzNDLHdHQUF3RztvQkFDeEcsMEJBQTBCO29CQUMxQixzQ0FBc0M7b0JBQ3RDLElBQUk7b0JBQ0osMkJBQTJCO29CQUMzQixrQ0FBa0M7b0JBQ2xDLDJCQUEyQjtvQkFDM0IseUJBQXlCO29CQUV6QixJQUFJLFFBQVEsR0FBUSxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFBO29CQUNoRCxJQUFJLFFBQVEsR0FBUSxRQUFRLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUNwRCxRQUFRLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxLQUFLLEtBQUssRUFBRSxDQUFDLENBQUE7b0JBQzNDLFFBQVEsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLFNBQVMsS0FBSyxFQUFFLENBQUMsQ0FBQTtvQkFDN0MsUUFBUSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUE7b0JBQ3RDLFFBQVEsQ0FBQyxTQUFTLEdBQUcsYUFBYSxDQUFDO29CQUNuQyxRQUFRLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQTtvQkFDeEMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUE7b0JBQzdDLFFBQVEsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUE7b0JBQ3pCLElBQUksTUFBTSxDQUFDLDZCQUE2QixJQUFJLE1BQU0sQ0FBQyw2QkFBNkIsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7d0JBQ3RHLElBQUksSUFBSSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7d0JBQzFDLElBQUksQ0FBQyxTQUFTLEdBQUcsR0FBRyxDQUFBO3dCQUNwQixJQUFJLEtBQUssR0FBUSxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFBO3dCQUM3QyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUE7d0JBQzFCLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUE7d0JBRWxCLEdBQUcsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUE7cUJBQ3ZCO3lCQUFNO3dCQUNMLEdBQUcsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUE7cUJBQzFCO29CQUlELFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFNLEVBQUUsRUFBRTt3QkFDOUMsSUFBSSxRQUFRLENBQUMsT0FBTyxFQUFFOzRCQUNwQixtQ0FBbUM7NEJBQ25DLFFBQVEsQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFBOzRCQUN4QixNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTt5QkFDeEU7d0JBQ0QsZ0JBQWdCO29CQUNsQixDQUFDLENBQUMsQ0FBQTtvQkFDRixRQUFRLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxFQUFFLEdBQUcsRUFBRTs7d0JBR3ZDLElBQUksUUFBUSxDQUFDLE9BQU8sRUFBRTs0QkFDcEIsSUFBSSxNQUFNLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtnQ0FDaEQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUE7NkJBQ25DOzRCQUNELElBQUksTUFBTSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7Z0NBQ2hELE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBOzZCQUN4RTs0QkFDRCxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUE7NEJBQ2hDLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQTt5QkFFakM7NkJBQU07NEJBQ0wsSUFBSSxNQUFNLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtnQ0FDaEQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7NkJBQ3hFO3lCQUNGO3dCQUNELE1BQU0sQ0FBQyxlQUFlLEdBQUcsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFBO3dCQUM5RSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsT0FBTyxPQUFDLE1BQU0sQ0FBQyxlQUFlLDBDQUFFLE1BQU0sQ0FBQyxDQUFBLENBQUMsQ0FBQSxFQUFFLENBQUEsQ0FBQyxDQUFBLFFBQVEsQ0FBQTt3QkFDcEYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLE9BQU8sT0FBQyxNQUFNLENBQUMsZUFBZSwwQ0FBRSxNQUFNLENBQUMsQ0FBQSxDQUFDLENBQUEsRUFBRSxDQUFBLENBQUMsQ0FBQSxRQUFRLENBQUE7d0JBQ25GLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFBO3dCQUMzQixJQUFJLENBQUMscUJBQXFCLENBQUMsT0FBTyxFQUFFLENBQUE7b0JBRXRDLENBQUMsQ0FBQyxDQUFBO29CQUdGLElBQUksUUFBUSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUE7b0JBQzNDLElBQUksV0FBVyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQ2xELE1BQU0sQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFBO29CQUNoRCxXQUFXLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQTtvQkFDekMsV0FBVyxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsS0FBSyxLQUFLLEVBQUUsQ0FBQyxDQUFBO29CQUM5QyxRQUFRLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxTQUFTLEtBQUssRUFBRSxDQUFDLENBQUE7b0JBQzdDLFdBQVcsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFBO29CQUMzQyxRQUFRLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFBO29CQUM1QixJQUFJLE1BQU0sQ0FBQyw2QkFBNkIsSUFBSSxNQUFNLENBQUMsNkJBQTZCLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO3dCQUN0RyxJQUFJLElBQUksR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDO3dCQUMxQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQTt3QkFDckIsSUFBSSxLQUFLLEdBQVEsUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQTt3QkFDN0MsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFBO3dCQUMxQixLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFBO3dCQUNsQixHQUFHLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFBO3FCQUN2Qjt5QkFBTTt3QkFDTCxHQUFHLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFBO3FCQUMxQjtvQkFHRCxXQUFXLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxFQUFFLEdBQUcsRUFBRTs7d0JBQzFDLElBQUksV0FBVyxDQUFDLE9BQU8sRUFBRTs0QkFDdkIsSUFBSSxNQUFNLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtnQ0FDaEQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUE7NkJBQ25DOzRCQUNELElBQUksTUFBTSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7Z0NBQ2hELE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQTtnQ0FDbEQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7NkJBQ3hFOzRCQUNELElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQTs0QkFDaEMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFBO3lCQUVqQzs2QkFBTTs0QkFDTCxJQUFJLE1BQU0sQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO2dDQUNoRCxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTs2QkFDeEU7eUJBQ0Y7d0JBQ0QsTUFBTSxDQUFDLGVBQWUsR0FBRyxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLENBQUE7d0JBQzlFLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxPQUFPLE9BQUMsTUFBTSxDQUFDLGVBQWUsMENBQUUsTUFBTSxDQUFDLENBQUEsQ0FBQyxDQUFBLEVBQUUsQ0FBQSxDQUFDLENBQUEsUUFBUSxDQUFBO3dCQUNwRixJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsT0FBTyxPQUFDLE1BQU0sQ0FBQyxlQUFlLDBDQUFFLE1BQU0sQ0FBQyxDQUFBLENBQUMsQ0FBQSxFQUFFLENBQUEsQ0FBQyxDQUFBLFFBQVEsQ0FBQTt3QkFDbkYsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUE7d0JBQzNCLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUsQ0FBQTtvQkFDdEMsQ0FBQyxDQUFDLENBQUE7b0JBRUYsMEJBQTBCO2lCQUMzQjtnQkFDRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzVDLElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUE7Z0JBQzFCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO29CQUNuQyxJQUFJLEtBQUssR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUN6QyxLQUFLLENBQUMsU0FBUyxHQUFHLGdCQUFnQixDQUFDO29CQUNuQyxLQUFLLENBQUMsU0FBUyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtvQkFDeEIsR0FBRyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQTtpQkFDdkI7Z0JBR0QsR0FBRyxDQUFDLFlBQVksR0FBRyxHQUFTLEVBQUU7b0JBQzVCLE1BQU0sS0FBSyxDQUFDLFVBQVUsU0FBUyxpQkFBaUIsT0FBTyxDQUFDLENBQUMsQ0FBQyxTQUFTLFFBQVEsYUFBYSxNQUFNLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxFQUFFO3dCQUN4SCxNQUFNLEVBQUUsS0FBSzt3QkFDYixJQUFJLEVBQUUsTUFBTTtxQkFDYixDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO3dCQUMvQyxpQ0FBaUM7d0JBQ2pDLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7d0JBQ3pCLHlFQUF5RTt3QkFDekUsSUFBSSxDQUFDLHFCQUFxQixDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUN2RCx3Q0FBd0M7b0JBQzFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRTt3QkFDZixPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztvQkFDOUIsQ0FBQyxDQUFDLENBQUM7Z0JBRUwsQ0FBQyxDQUFBLENBQUM7Z0JBQ0YsR0FBRyxDQUFDLFlBQVksR0FBRyxHQUFHLEVBQUU7b0JBQ3RCLDZEQUE2RDtvQkFDN0QsSUFBSSxDQUFDLHFCQUFxQixDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN4RCxDQUFDLENBQUM7Z0JBRUYsR0FBRyxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7Z0JBQzFCLDRCQUE0QjtnQkFDNUIsY0FBYyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQTtnQkFDL0IsSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsQ0FBQzthQUNsQzs7S0FDRjtJQUNELG9CQUFvQjtRQUNsQixPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLENBQUE7UUFDN0IsTUFBTSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLEVBQUUsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtRQUNsRixNQUFNLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsRUFBRSxNQUFNLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBO1FBQ2xGLE1BQU0sQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUE7SUFDcEYsQ0FBQztJQUNPLGlCQUFpQixDQUFDLFVBQWtCOztRQUMxQyxJQUFJLENBQUMsTUFBTSxDQUFDLGlCQUFpQixFQUFFO1lBQzdCLE1BQU0sQ0FBQyxpQkFBaUIsR0FBRyxFQUFFLENBQUE7U0FDOUI7UUFDRCxNQUFNLFFBQVEsU0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLDBDQUFFLFFBQVEsQ0FDbEUsSUFBSSxDQUFDLHFCQUFxQixDQUMzQixDQUFDO1FBQ0YsSUFBSSxVQUFVLFNBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQywwQ0FBRSxrQkFBa0IsQ0FBQztRQUMvRSxJQUFJLFVBQVUsSUFBSSxTQUFTLEVBQUU7WUFDM0IsVUFBVSxHQUFHLFNBQVMsQ0FBQztTQUN4QjtRQUVELElBQUksY0FBYyxTQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsMENBQUUsY0FBYyxDQUFDO1FBQy9FLElBQUksY0FBYyxJQUFJLFNBQVMsRUFBRTtZQUMvQixjQUFjLEdBQUcsU0FBUyxDQUFDO1NBQzVCO1FBQ0QsSUFBSSxLQUFLLFNBQUcsTUFBTSxDQUFDLG9CQUFvQiwwQ0FBRSxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUE7UUFFNUQsSUFBSSxhQUFhLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQTtRQUduRSxJQUFJLGNBQWMsSUFBSSxTQUFTLEVBQUU7WUFDL0IsY0FBYyxHQUFHLFNBQVMsQ0FBQztTQUM1QjtRQUNELElBQUksS0FBSyxTQUFHLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsMENBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQ3hELE1BQU0sY0FBYyxHQUFHLFFBQVEsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxVQUFVLEVBQUUsQ0FBQztRQUU1RixNQUFNLGlCQUFpQixHQUFHLFVBQVUsQ0FBQTtRQUNwQyxNQUFNLHFCQUFxQixHQUFHLGNBQWMsQ0FBQTtRQUU1QyxNQUFNLGlCQUFpQixHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQTtRQUM1QyxnSUFBZ0k7UUFDaEksSUFBSSxjQUFjLEdBQUcsYUFBYSxLQUFLLFVBQVUsSUFBSSxNQUFNLENBQUMsa0JBQWtCLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUE7UUFDNUcsSUFBSSxNQUFNLENBQUMsNkJBQTZCLElBQUksTUFBTSxDQUFDLDZCQUE2QixDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtZQUMzRyxPQUFPLEdBQUcsaUJBQWlCLElBQUkscUJBQXFCLFlBQVksQ0FBQTtTQUNqRTtRQUNELElBQUksTUFBTSxDQUFDLHdCQUF3QixJQUFJLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7WUFDakcsSUFBSSxjQUFjLEdBQUcsYUFBYSxLQUFLLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQTtZQUU3RSxJQUFJLE1BQU0sQ0FBQyxjQUFjLENBQUMsY0FBYyxJQUFJLE1BQU0sRUFBRTtnQkFDbEQsT0FBTyxHQUFHLGlCQUFpQixJQUFJLGlCQUFpQixJQUFJLEtBQUssS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUE7YUFDeEY7aUJBQU07Z0JBQ0wsSUFBSSxjQUFjLEtBQUssS0FBSyxFQUFFO29CQUM1QixJQUFJLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7d0JBQ3ZELE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUE7cUJBQzFDO2lCQUNGO2dCQUNELGdIQUFnSDtnQkFDaEgsT0FBTyxHQUFHLGlCQUFpQixJQUFJLGlCQUFpQixJQUFJLEtBQUssS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUE7YUFDeEY7U0FFRjtRQUNELElBQUksSUFBSSxDQUFDLG9CQUFvQixJQUFJLEtBQUssRUFBRTtZQUN0QyxJQUFJLE1BQU0sQ0FBQyxjQUFjLENBQUMsY0FBYyxJQUFJLE1BQU0sRUFBRTtnQkFDbEQsT0FBTyxHQUFHLGlCQUFpQixJQUFJLGlCQUFpQixFQUFFLENBQUE7YUFDbkQ7aUJBQU07Z0JBQ0wsSUFBSSxjQUFjLEtBQUssS0FBSyxFQUFFO29CQUM1QixJQUFJLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7d0JBQ3ZELE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUE7cUJBQzFDO2lCQUNGO2dCQUNELE9BQU8sR0FBRyxpQkFBaUIsSUFBSSxpQkFBaUIsRUFBRSxDQUFBO2FBQ25EO1NBQ0Y7UUFDRCxJQUFJLE1BQU0sQ0FBQyxjQUFjLENBQUMsY0FBYyxJQUFJLE1BQU0sRUFBRTtZQUNsRCxPQUFPLEdBQUcsaUJBQWlCLElBQUksaUJBQWlCLElBQUksS0FBSyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQTtTQUN4RjthQUFNO1lBQ0wsSUFBSSxjQUFjLEtBQUssS0FBSyxFQUFFO2dCQUM1QixJQUFJLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7b0JBQ3ZELE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUE7aUJBQzFDO2FBQ0Y7WUFDRCw0R0FBNEc7WUFDNUcsT0FBTyxHQUFHLGlCQUFpQixJQUFJLGlCQUFpQixJQUFJLEtBQUssS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUE7U0FDeEY7SUFDSCxDQUFDO0lBQ08sbUJBQW1CLENBQUMsVUFBa0I7O1FBQzVDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxRQUFRLENBQ2pFLElBQUksQ0FBQyxxQkFBcUIsQ0FDM0IsQ0FBQztRQUNGLElBQUksVUFBVSxTQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsMENBQUUsa0JBQWtCLENBQUM7UUFDL0UsSUFBSSxVQUFVLElBQUksU0FBUyxFQUFFO1lBQzNCLFVBQVUsR0FBRyxTQUFTLENBQUM7U0FDeEI7UUFDRCxJQUFJLGNBQWMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsY0FBYyxDQUFDO1FBQzlFLElBQUksY0FBYyxJQUFJLFNBQVMsRUFBRTtZQUMvQixjQUFjLEdBQUcsU0FBUyxDQUFDO1NBQzVCO1FBQ0QsSUFBSSxjQUFjLElBQUksU0FBUyxFQUFFO1lBQy9CLGNBQWMsR0FBRyxTQUFTLENBQUM7U0FDNUI7UUFDRCxNQUFNLGNBQWMsR0FBRyxRQUFRLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksVUFBVSxFQUFFLENBQUM7UUFDNUYsTUFBTSxpQkFBaUIsR0FBRyxVQUFVLENBQUE7UUFDcEMsTUFBTSxxQkFBcUIsR0FBRyxjQUFjLENBQUE7UUFDNUMsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUE7UUFDNUMsZ0lBQWdJO1FBQ2hJLElBQUksY0FBYyxHQUFHLGNBQWMsS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFBO1FBQ25FLE9BQU8sU0FBUyxpQkFBaUIsWUFBWSxxQkFBcUIsZ0JBQWdCLGlCQUFpQixNQUFNLGNBQWMsRUFBRSxDQUFBO0lBQzNILENBQUM7SUFDTyxtQkFBbUI7UUFDekIsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUM7UUFDbEQsTUFBTSxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsR0FBRyxJQUFJLENBQUMsVUFBaUIsQ0FBQztRQUN0RCxNQUFNLGFBQWEsR0FBRyxHQUFHLEdBQUcsV0FBVyxHQUFHLEdBQUcsQ0FBQztRQUM5QyxNQUFNLGNBQWMsR0FBRyxHQUFHLEtBQUssR0FBRyxHQUFHLEtBQUssS0FBSyxHQUFHLEdBQUcsR0FBRyxDQUFDO1FBQ3pELE1BQU0sZUFBZSxHQUFHLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDO1FBQzlELE9BQU8sQ0FBQyxRQUEwQixFQUFlLEVBQUU7WUFDakQsTUFBTSxrQkFBa0IsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3pELGtCQUFrQixDQUFDLFNBQVMsR0FBRyxjQUFjLENBQUM7WUFDOUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7WUFDM0Qsa0JBQWtCLENBQUMsS0FBSyxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7WUFDdkQsa0JBQWtCLENBQUMsS0FBSyxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7WUFDekQsTUFBTSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsR0FBRztnQkFDakIsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztnQkFDbEMsUUFBUSxDQUFDLEtBQUssR0FBRyxLQUFLO2FBQ3ZCLENBQUM7WUFDRixNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHO2dCQUNsQixDQUFDLEdBQUcsR0FBRyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUc7Z0JBQ3pCLENBQUMsR0FBRyxHQUFHLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRzthQUMxQixDQUFDO1lBQ0Ysa0JBQWtCLENBQUMsS0FBSyxDQUFDLGtCQUFrQixHQUFHLEdBQUcsSUFBSSxLQUFLLEdBQUcsR0FBRyxDQUFDO1lBQ2pFLE9BQU8sa0JBQWtCLENBQUM7UUFDNUIsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUNELHNCQUFzQixDQUFDLEdBQVc7UUFDaEMsSUFBSSxDQUFDLGtCQUFrQixHQUFHLEdBQUcsQ0FBQTtJQUMvQixDQUFDO0lBQ08sbUJBQW1CLENBQUMsU0FBOEI7O1FBQ3hELFNBQVMsR0FBRyxTQUFTLElBQUksSUFBSSxDQUFDLGlCQUFpQixDQUFDO1FBQ2hELElBQUksQ0FBQyxpQkFBaUIsR0FBRyxTQUFTLENBQUM7UUFDbkMsSUFBSSxTQUFTLElBQUksSUFBSSxFQUFFO1lBQ3JCLE9BQU87U0FDUjtRQUNELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFtQixDQUFDO1FBQ3JELE1BQU0sQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO1FBQ3hCLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDMUIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUMxQixPQUFPO1NBQ1I7UUFDRCxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztRQUM1QixNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdELElBQUksSUFBSSxDQUFDLHFCQUFxQixJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtZQUN6RCxJQUFJLGFBQWEsR0FBRyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztTQUNoRDtRQUNELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3pDLE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM5QixNQUFNLGVBQWUsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3RELGVBQWUsQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDO1lBQ3ZDLE1BQU0sbUJBQW1CLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN4RCxtQkFBbUIsQ0FBQyxTQUFTLEdBQUcsZUFBZSxDQUFDO1lBQ2hELG1CQUFtQixDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3JFLE1BQU0saUJBQWlCLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN4RCxpQkFBaUIsQ0FBQyxTQUFTLEdBQUcsaUJBQWlCLENBQUM7WUFDaEQsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNuRCxZQUFZLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQztZQUNqQyxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxVQUFVLENBQ25DLElBQUksQ0FBQyxRQUFRLEVBQ2IsUUFBUSxDQUFDLElBQUksRUFDYixPQUFPLENBQ1IsQ0FBQztZQUNGLFlBQVksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNsRSxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25ELFlBQVksQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDO1lBQ2pDLFlBQVksQ0FBQyxTQUFTLGVBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsMENBQUUsZUFBZSwwQ0FBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDcEcsaUJBQWlCLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQzVDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUM1QyxNQUFNLFVBQVUsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2pELFVBQVUsQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO1lBQzdCLE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDckQsY0FBYyxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUM7WUFDbEMsY0FBYyxDQUFDLEtBQUssQ0FBQyxjQUFjLEdBQUcsVUFBVSxDQUM5QyxJQUFJLENBQUMsUUFBUSxFQUNiLFFBQVEsQ0FBQyxJQUFJLEVBQ2IsT0FBTyxDQUNSLENBQUM7WUFDRixjQUFjLENBQUMsS0FBSyxDQUFDLEtBQUs7Z0JBQ3hCLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQztZQUNuRSxVQUFVLENBQUMsV0FBVyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQ3ZDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQzFCLE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ2xELFdBQVcsQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDO2dCQUMvQixXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO2dCQUM3QyxVQUFVLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO2FBQ3JDO1lBQ0QsSUFBSSxJQUFJLENBQUMscUJBQXFCLElBQUksSUFBSSxDQUFDLGtCQUFrQixFQUFFO2dCQUN6RCxNQUFNLG9CQUFvQixHQUFHLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDckQsZUFBZSxDQUFDLFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO2FBQ25EO1lBQ0QsbUJBQW1CLENBQUMsV0FBVyxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDbkQsbUJBQW1CLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQzVDLGVBQWUsQ0FBQyxXQUFXLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUNqRCxNQUFNLENBQUMsV0FBVyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQ3BDLG1CQUFtQixDQUFDLFlBQVksR0FBRyxHQUFHLEVBQUU7Z0JBQ3RDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbEUsQ0FBQyxDQUFDO1lBQ0YsbUJBQW1CLENBQUMsWUFBWSxHQUFHLEdBQUcsRUFBRTtnQkFDdEMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3hELENBQUMsQ0FBQztZQUNGLG1CQUFtQixDQUFDLE9BQU8sR0FBRyxHQUFHLEVBQUU7Z0JBQ2pDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ3RFLENBQUMsQ0FBQztTQUNIO0lBQ0gsQ0FBQztJQUNPLG1CQUFtQixDQUFDLFNBQWlCO1FBQzNDLElBQUksU0FBUyxFQUFFO1lBQ2IsSUFBSSxDQUFDLGVBQWUsQ0FBQyxTQUFTLEdBQUcsVUFBVSxTQUFTLEVBQUUsQ0FBQztZQUN2RCxJQUFJLFNBQVMsR0FBRyxDQUFDLEVBQUU7Z0JBQ2pCLElBQUksQ0FBQyxlQUFlLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQzthQUN0QztZQUNELElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1NBQzNDO2FBQU07WUFDTCxJQUFJLENBQUMsZUFBZSxDQUFDLFNBQVMsR0FBRyxrQkFBa0IsQ0FBQztZQUNwRCxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7WUFDckMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7U0FDM0M7SUFDSCxDQUFDO0lBQ08sT0FBTyxDQUFDLFNBQWM7UUFFNUIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2xCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDdkQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDdkMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRTtnQkFDbkMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDdkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNuQixDQUFDLENBQUMsQ0FBQztTQUNKO1FBQ0QsSUFBSSxNQUFNO1lBQ1IsSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLFFBQVEsS0FBSyxvQkFBb0IsSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLGNBQWMsS0FBSyxNQUFNLEVBQzVHO2dCQUNBLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDekI7aUJBQU0sSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLFFBQVEsS0FBSyxpQkFBaUIsRUFBRTtnQkFDL0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQzthQUMxQjtpQkFDSTtnQkFDSCxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUN2QixJQUFJLENBQUMsaUJBQWlCLEdBQUcsS0FBSyxDQUFBO2dCQUM5QixnQ0FBZ0M7YUFDakM7UUFLSCxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxHQUFHLEdBQUcsRUFBRTtZQUNyQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxlQUFlLEVBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQTtRQUM3RixDQUFDLENBQUE7UUFFRCw2QkFBNkI7UUFDN0IsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sR0FBRyxHQUFHLEVBQUU7O1lBRW5DLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsVUFBRyxNQUFNLENBQUMsaUJBQWlCLDBDQUFFLE1BQU0sQ0FBQSxFQUFFLENBQUMsRUFBRSxFQUFFO2dCQUN6RCxJQUFJLE1BQU0sQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO29CQUN0RSxNQUFNLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtpQkFDekQ7YUFDRjtZQUNELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBQzlGLDhDQUE4QztRQUNoRCxDQUFDLENBQUE7UUFDRCxJQUFJO1FBQ0osSUFBSSxDQUFDLHFCQUFxQixDQUFDLE9BQU8sR0FBRyxHQUFHLEVBQUU7O1lBQ3hDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsVUFBRyxNQUFNLENBQUMsaUJBQWlCLDBDQUFFLE1BQU0sQ0FBQSxFQUFFLENBQUMsRUFBRSxFQUFFO2dCQUN6RCxJQUFJLE1BQU0sQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO29CQUN0RSxNQUFNLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtpQkFDekQ7YUFDRjtZQUNELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBQzlGLDhDQUE4QztRQUNoRCxDQUFDLENBQUE7UUFFRCxJQUFJLENBQUMsZUFBZSxDQUFDLE9BQU8sR0FBRyxHQUFHLEVBQUU7WUFDbEMsU0FBUyxDQUFDLHFCQUFxQixDQUM3QixNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLE1BQU0sQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLGVBQWUsRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUNsSSxDQUFDLE9BQVksRUFBRSxhQUFrQixFQUFFLEVBQUU7Z0JBQ25DLElBQUksT0FBTyxJQUFJLElBQUksRUFBRTtvQkFDbkIsK0JBQStCO29CQUMvQixJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTt3QkFDakMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEdBQUcsWUFBWSxDQUFDO3FCQUN2Qzt5QkFBTTt3QkFDTCxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxXQUFXLENBQUM7cUJBQ2pFO29CQUVELE1BQU0sQ0FBQyx3QkFBd0IsR0FBRyxPQUFPLENBQUE7b0JBQ3pDLE1BQU0sQ0FBQyw2QkFBNkIsR0FBRyxhQUFhLENBQUE7b0JBRXBELElBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQTtvQkFDakQsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUU7d0JBQ3ZCLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFBO3dCQUN6QixNQUFNLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQTt3QkFDNUIscURBQXFEO3dCQUNyRCxJQUFJLENBQUMscUJBQXFCLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQTtxQkFDL0Q7b0JBQ0Qsb0ZBQW9GO29CQUNwRixJQUFJLENBQUMsb0JBQW9CLEdBQUcsSUFBSSxDQUFBO29CQUNoQyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFBO29CQUM3Qix3REFBd0Q7b0JBQ3hELG1DQUFtQztvQkFDbkMsV0FBVztvQkFDWCxrQ0FBa0M7b0JBQ2xDLElBQUk7b0JBQ0osSUFBSSxDQUFDLGdCQUFnQixHQUFHLEtBQUssQ0FBQTtvQkFDN0IsSUFBSSxDQUFDLG9CQUFvQixHQUFHLDhCQUE4QixDQUFBO29CQUMxRCx1Q0FBdUM7b0JBRXZDLDBCQUEwQjtvQkFDMUIsSUFBSSxDQUFDLHFCQUFxQixDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsS0FBSyxFQUFFLGlCQUFpQixDQUFDLENBQUM7aUJBQ2hHO1lBQ0gsQ0FBQyxDQUFDLENBQUE7UUFDTixDQUFDLENBQUE7UUFHRCxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sR0FBRyxHQUFHLEVBQUU7O1lBQ2hDLElBQUksT0FBQSxNQUFNLENBQUMsZUFBZSwwQ0FBRSxNQUFNLElBQUcsR0FBRyxFQUFFO2dCQUN4QyxPQUFPLENBQUMsZUFBZSxDQUFDLHdDQUF3QyxNQUFBLE1BQU0sQ0FBQyxlQUFlLDBDQUFFLE1BQU07NkNBQ3pELENBQUMsQ0FBQztnQkFDdkMsT0FBTTthQUNQO1lBQ0QsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFBO1lBQ2xCLHdEQUF3RDtZQUN4RCw4RUFBOEU7WUFDOUUsMEJBQTBCO1lBQzFCLElBQUksV0FBVyxHQUFHLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQTtZQUMxQyxXQUFXLENBQUE7WUFDWCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQ3RELElBQUksTUFBTSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7b0JBQ3RFLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO2lCQUM1QzthQUNGO1lBQ0QsU0FBUyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ2hCLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNmLENBQUM7WUFDRCxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBO1lBQ3RCLElBQUksQ0FBQyxTQUFTLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLGVBQWUsRUFBRSxNQUFNLENBQUMsZUFBZSxDQUFDLENBQUE7WUFDNUcsMEZBQTBGO1FBQzVGLENBQUMsQ0FBQTtRQUNELElBQUksQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQztRQUMvQixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLHVCQUF1QixDQUFvQixDQUFDO1FBQ3BFLE9BQU8sQ0FBQyxPQUFPLEdBQUcsR0FBRyxFQUFFO1lBQ3JCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDeEQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQ3JDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBZ0IsRUFBRSxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUM7YUFDMUQ7WUFDRCxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQXNCLEVBQUUsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3ZELElBQUksQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztZQUM1QixJQUFJLENBQUMscUJBQXFCLENBQUMsMkJBQTJCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3RFLE1BQU0sU0FBUyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUMvQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLEVBQzVCLElBQUksQ0FBQyxRQUFRLEVBQ2IsSUFBSSxDQUFDLEtBQUssQ0FDWCxDQUFDO1lBQ0YsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3RDLENBQUMsQ0FBQztRQUNGLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQW9CLENBQUM7UUFDakUsT0FBTyxDQUFDLE9BQU8sR0FBRyxHQUFHLEVBQUU7WUFDckIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUN4RCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDckMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFnQixFQUFFLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQzthQUMxRDtZQUNELElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUN4QyxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUM7WUFDL0IsSUFBSSxDQUFDLHFCQUFxQixDQUFDLDJCQUEyQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN0RSxNQUFNLFNBQVMsR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FDL0MsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxFQUM1QixJQUFJLENBQUMsUUFBUSxFQUNiLElBQUksQ0FBQyxLQUFLLENBQ1gsQ0FBQztZQUNGLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN0QyxDQUFDLENBQUM7UUFHRixJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sR0FBRyxHQUFHLEVBQUU7WUFFM0IsSUFBSSxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7Z0JBQ3RDLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFBO2dCQUN6QyxPQUFNO2FBQ1A7WUFDRCxNQUFNLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQTtZQUMzQixTQUFTLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRTtnQkFDdkMsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtvQkFDeEIsTUFBTSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUE7b0JBQzdCLElBQUksQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFBO29CQUNsRCxJQUFJLENBQUMscUJBQXFCLENBQUMsZUFBZSxFQUFFLENBQUE7b0JBQzVDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQztvQkFDOUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO2lCQUMvQjtZQUNILENBQUMsQ0FBQyxDQUFBO1FBQ0osQ0FBQyxDQUFBO1FBR0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEdBQUcsR0FBRyxFQUFFOztZQUMxQixNQUFNLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQTtZQUM1QixJQUFJLENBQUMscUJBQXFCLENBQUMsY0FBYyxFQUFFLENBQUE7WUFDM0MsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO1lBQy9CLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQztZQUM3Qiw0REFBNEQ7WUFDNUQsVUFBSSxNQUFNLENBQUMsaUJBQWlCLDBDQUFFLE1BQU0sRUFBRTtnQkFDcEMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLEVBQUUsRUFBRTtvQkFBRSxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtpQkFBRTthQUM5SDtRQUNILENBQUMsQ0FBQTtRQUVELElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUVwQyxNQUFNLFdBQVcsR0FBRyxDQUFDLEtBQWEsRUFBRSxXQUFvQixFQUFFLEVBQUU7WUFDMUQsSUFBSSxDQUFDLGVBQWUsR0FBRyxLQUFLLENBQUM7WUFDN0IsSUFBSSxDQUFDLGlCQUFpQixHQUFHLFdBQVcsQ0FBQTtRQUN0QyxDQUFDLENBQUM7UUFDRixJQUFJLENBQUMsU0FBUyxDQUFDLDRCQUE0QixDQUFDLENBQUMsS0FBSyxFQUFFLFdBQVcsRUFBRSxFQUFFO1lBQ2pFLFdBQVcsQ0FBQyxLQUFLLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDbEMsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sR0FBRyxHQUFHLEVBQUU7WUFDL0IsMkNBQTJDO1lBRTNDLElBQUksSUFBSSxDQUFDLGVBQWUsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEVBQUU7Z0JBQ3RFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztnQkFDNUIsSUFBSSxDQUFDLHFCQUFxQixDQUFDLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUN0RCxPQUFPO2FBQ1I7WUFFRCxTQUFTLENBQUMsS0FBSyxDQUNiLElBQUksQ0FBQyxlQUFlLEVBQ3BCLElBQUksQ0FBQyxpQkFBaUIsRUFDdEIsSUFBSSxDQUFDLHFCQUFxQixFQUMxQixJQUFJLENBQUMsZ0JBQWdCLEVBQ3JCLE1BQU0sQ0FBQyxTQUFTLEVBQ2hCLElBQUksQ0FBQyx1QkFBdUIsRUFDNUIsSUFBSSxDQUFDLHFCQUFxQixFQUMxQixDQUFDLE9BQVksRUFBRSxFQUFFO2dCQUNmLElBQUksT0FBTyxJQUFJLElBQUksRUFBRTtvQkFDbkIsSUFBSSxDQUFDLFlBQVksR0FBRyxPQUFPLENBQUM7b0JBQzVCLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO3dCQUNqQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sR0FBRyxZQUFZLENBQUM7cUJBQ3ZDO3lCQUFNO3dCQUNMLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLFdBQVcsQ0FBQztxQkFDakU7b0JBQ0QsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksQ0FBQTtvQkFDaEMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLEtBQUssQ0FBQTtvQkFDOUIsSUFBSSxDQUFDLHFCQUFxQixDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUN0RixJQUFJLENBQUMsb0JBQW9CLEdBQUcsbUJBQW1CLENBQUE7aUJBQ2hEO1lBQ0gsQ0FBQyxDQUNGLENBQUM7UUFDSixDQUFDLENBQUE7SUFFSCxDQUFDO0lBSU8sU0FBUyxDQUFDLFNBQVMsRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFFLE9BQVEsRUFBRSxXQUFZO1FBQ25GLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQTtRQUNmLElBQUksR0FBRyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUE7UUFDN0IsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFBO1FBQ3RDLElBQUksSUFBSSxDQUFDLGlCQUFpQixLQUFLLG9CQUFvQixFQUFFO1lBQ25ELFNBQVMsR0FBRyxZQUFZLENBQUE7U0FDekI7UUFDRCxJQUFJLE9BQU8sRUFBRTtZQUNYLEdBQUcsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUE7U0FDdEI7UUFDRCxJQUFJLFdBQVcsS0FBSyxLQUFLLEVBQUU7WUFDekIsSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLGNBQWMsSUFBSSxNQUFNLEVBQUU7Z0JBQ2xELFNBQVMsR0FBRyxZQUFZLENBQUE7YUFDekI7aUJBQU07Z0JBQ0wsU0FBUyxHQUFHLFVBQVUsQ0FBQTthQUN2QjtTQUNGO1FBQ0QsSUFBSSxDQUFDLGVBQWUsRUFBRTtZQUNwQixlQUFlLEdBQUcsRUFBRSxDQUFBO1NBQ3JCO1FBQ0QsSUFBSSxDQUFDLGVBQWUsRUFBRTtZQUNwQixlQUFlLEdBQUcsRUFBRSxDQUFBO1NBQ3JCO1FBQ0QsU0FBUyxDQUFDLFNBQVMsQ0FDakIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQ3hCLFNBQVMsRUFDVCxHQUFHLEVBQ0gsZUFBZSxFQUNmLGVBQWUsRUFDZixXQUFXLEVBQ1gsQ0FBQyxPQUFZLEVBQUUsTUFBVyxFQUFFLE1BQVcsRUFBRSxFQUFFO1lBQ3pDLElBQUksT0FBTyxJQUFJLElBQUksRUFBRTtnQkFDbkIsSUFBSSxDQUFDLFlBQVksR0FBRyxPQUFPLENBQUM7Z0JBQzVCLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO29CQUNqQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sR0FBRyxZQUFZLENBQUM7aUJBQ3ZDO3FCQUFNO29CQUNMLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLFdBQVcsQ0FBQztpQkFDakU7Z0JBRUQsTUFBTSxDQUFDLGtCQUFrQixHQUFHLE1BQU0sQ0FBQTtnQkFDbEMsTUFBTSxDQUFDLGtCQUFrQixHQUFHLE1BQU0sQ0FBQTtnQkFFbEMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUU7b0JBQ3ZCLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFBO29CQUN6QixNQUFNLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQTtvQkFDNUIscURBQXFEO29CQUNyRCxJQUFJLENBQUMscUJBQXFCLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQTtpQkFDL0Q7Z0JBQ0QsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksQ0FBQTtnQkFDaEMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksQ0FBQTtnQkFDN0Isd0RBQXdEO2dCQUN4RCxtQ0FBbUM7Z0JBQ25DLFdBQVc7Z0JBQ1gsa0NBQWtDO2dCQUNsQyxJQUFJO2dCQUNKLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxLQUFLLENBQUE7Z0JBQzdCLElBQUksQ0FBQyxvQkFBb0IsR0FBRyw0QkFBNEIsQ0FBQTtnQkFDeEQsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFBO2dCQUNwQyxHQUFHLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQTtnQkFDekIsSUFBSSxDQUFDLHFCQUFxQixDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsS0FBSyxFQUFFLFdBQVcsQ0FBQyxDQUFDO2dCQUN6RixvRkFBb0Y7YUFFckY7UUFDSCxDQUFDLENBQ0YsQ0FBQztJQUNKLENBQUM7SUFFRCxXQUFXO1FBQ1QsSUFBSSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUE7UUFDMUIsTUFBTSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUE7SUFDL0IsQ0FBQztJQUVELHFCQUFxQjtRQUNuQixJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUM7UUFDL0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO0lBQy9CLENBQUM7SUFFTSxPQUFPLENBQUMsRUFBVTtRQUN2QixJQUFJLENBQUMsaUJBQWlCLEdBQUcsRUFBRSxDQUFDO1FBQzVCLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMscUJBQXFCLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBZ0IsQ0FBQztRQUN0RSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3ZELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3ZDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBZ0IsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDMUQ7UUFDRCxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbEMsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ3ZFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxhQUFhLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzdDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBZ0IsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDaEU7UUFDRCxJQUFJLENBQUMsT0FBTyxDQUNWLElBQUksQ0FBQyxFQUFFLENBQUMsaUNBQWlDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBZ0IsRUFDckUsUUFBUSxFQUNSLElBQUksQ0FDTCxDQUFDO1FBQ0YsMEVBQTBFO1FBQzFFLElBQUksSUFBSSxDQUFDLENBQUMsSUFBSSxJQUFJLEVBQUU7WUFDbEIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM1Qix1RUFBdUU7WUFDdkUscUJBQXFCO1lBQ3JCLHFCQUFxQixDQUFDLEdBQUcsRUFBRTtnQkFDekIsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQSxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsWUFBWSxJQUFHLElBQUksQ0FBQztZQUNoRCxDQUFDLENBQUMsQ0FBQztTQUNKO1FBQ0QsSUFBRyxFQUFFLEtBQUssUUFBUSxFQUFDO1lBQ2pCLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxLQUFLLENBQUE7U0FDL0I7UUFDRCxJQUFJLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDN0IsTUFBTSxDQUFDLGtCQUFrQixHQUFHLEVBQUUsQ0FBQTtRQUM5QixPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksRUFBQyxFQUFFLENBQUMsQ0FBQztJQUN2QixDQUFDO0lBR0QscUJBQXFCLENBQUMsS0FBYztRQUNsQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO0lBQy9CLENBQUM7SUFJRCwwQkFBMEIsQ0FBQyxPQUFpQjs7UUFDMUMsSUFBSSxDQUFDLDJCQUEyQixHQUFHLE9BQU8sQ0FBQztRQUMzQyxJQUFJLENBQUMsTUFBTSxDQUFDLGVBQWUsRUFBRTtZQUMzQixNQUFNLENBQUMsZUFBZSxHQUFHLEVBQUUsQ0FBQTtTQUM1QjtRQUVELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsMkJBQTJCLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ2hFLElBQUksTUFBTSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFO2dCQUMzRSxNQUFNLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsMkJBQTJCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNsRTtpQkFBTTtnQkFDTCxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsMkJBQTJCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtnQkFDL0UsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFBO2FBQ3hDO1NBQ0Y7UUFDRCxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsT0FBTyxPQUFDLE1BQU0sQ0FBQyxlQUFlLDBDQUFFLE1BQU0sQ0FBQyxDQUFBLENBQUMsQ0FBQSxFQUFFLENBQUEsQ0FBQyxDQUFBLFFBQVEsQ0FBQTtRQUNwRixJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsT0FBTyxPQUFDLE1BQU0sQ0FBQyxlQUFlLDBDQUFFLE1BQU0sQ0FBQyxDQUFBLENBQUMsQ0FBQSxFQUFFLENBQUEsQ0FBQyxDQUFBLFFBQVEsQ0FBQTtRQUNuRiw0REFBNEQ7SUFDOUQsQ0FBQztJQUNPLFdBQVc7UUFDakIsSUFBSSxJQUFJLENBQUMsb0JBQW9CLElBQUksSUFBSSxFQUFFO1lBQ3JDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxzQkFBc0IsQ0FBQztnQkFDaEQsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQzthQUM3QixDQUFDLENBQUM7U0FDSjtJQUNILENBQUM7Q0FDRixDQUFBO0FBLzdDaUIsdUJBQVEsR0FBRyxRQUFRLENBQUM7QUFLcEM7SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUM7O3lEQUNzQjtBQUdqRDtJQURDLFFBQVEsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQzs7aUVBQ087QUFHbEM7SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUM7OzZEQUNPO0FBR2xDO0lBREMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDOzs4Q0FDYjtBQUdkO0lBREMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDOztxREFDTjtBQUdyQjtJQURDLFFBQVEsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQzs7bURBQ1I7QUFHbkI7SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUM7OzZEQUNHO0FBRzlCO0lBREMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDOzhCQUNWLEtBQUs7c0RBQVM7QUFHOUI7SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUM7O3NEQUNKO0FBR3ZCO0lBREMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDOzs2Q0FDTztBQUdsQztJQURDLFFBQVEsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQzs7a0RBQ0E7QUFHM0I7SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUM7OzBEQUNPO0FBR25DO0lBREMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDOzsrREFDSTtBQUcvQjtJQURDLFFBQVEsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQzs7NkRBQ0U7QUFHN0I7SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUM7O3dEQUNLO0FBVWpDO0lBREMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDOztpREFDWjtBQUdoQjtJQURDLFFBQVEsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQzs7MERBQ0Q7QUFHMUI7SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUM7O2tEQUNUO0FBR2xCO0lBREMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDOzhCQUNMLE9BQU87NkRBQVE7QUFHdEM7SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUM7OEJBQ3BCLE9BQU87OENBQVM7QUFHeEI7SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUM7O21EQUNDO0FBRzdCO0lBREMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDOzt3REFDSztBQUdqQztJQURDLFFBQVEsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQzs7b0RBQ1U7QUFHckM7SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUM7O21EQUNBO0FBRzVCO0lBREMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDOztzREFDRztBQUcvQjtJQURDLFFBQVEsQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQzs7a0RBQ0Q7QUFHM0I7SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUM7OzREQUN1QjtBQUdsRDtJQURDLFFBQVEsQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQzs7NERBQ1E7QUFHcEM7SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUM7O3lEQUNLO0FBSWpDO0lBREMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDOzt1REFDSTtBQUloQztJQURDLFFBQVEsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQzs7d0RBQ0U7QUFHN0I7SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUM7OzhDQUNMO0FBR3ZCO0lBREMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDOzs4Q0FDTDtBQUl2QjtJQURDLFFBQVEsQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQzs7NERBQ1E7QUFxUHBDO0lBREMsT0FBTyxDQUFDLG9CQUFvQixFQUFFLHVCQUF1QixDQUFDOzs7OzJEQUd0RDtBQUdEO0lBREMsT0FBTyxDQUFDLFFBQVEsQ0FBQzs7OztnREFNakI7QUFLRDtJQURDLE9BQU8sQ0FBQyxXQUFXLENBQUM7Ozs7eURBT3BCO0FBRUQ7SUFEQyxPQUFPLENBQUMsa0JBQWtCLENBQUM7Ozs7K0NBb0MzQjtBQWxhRyxjQUFjO0lBRG5CLGFBQWEsQ0FBQyw4QkFBOEIsQ0FBQztHQUN4QyxjQUFjLENBZzhDbkIiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBDb3B5cmlnaHQgMjAxNiBUaGUgVGVuc29yRmxvdyBBdXRob3JzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5pbXBvcnQgeyBQb2x5bWVyRWxlbWVudCB9IGZyb20gJ0Bwb2x5bWVyL3BvbHltZXInO1xuaW1wb3J0IHsgY3VzdG9tRWxlbWVudCwgb2JzZXJ2ZSwgcHJvcGVydHkgfSBmcm9tICdAcG9seW1lci9kZWNvcmF0b3JzJztcblxuaW1wb3J0IHsgTGVnYWN5RWxlbWVudE1peGluIH0gZnJvbSAnLi4vY29tcG9uZW50cy9wb2x5bWVyL2xlZ2FjeV9lbGVtZW50X21peGluJztcbmltcG9ydCAnLi4vY29tcG9uZW50cy9wb2x5bWVyL2lyb25zX2FuZF9wYXBlcnMnO1xuXG5pbXBvcnQgeyBEaXN0YW5jZUZ1bmN0aW9uLCBTcHJpdGVBbmRNZXRhZGF0YUluZm8sIFN0YXRlLCBEYXRhU2V0IH0gZnJvbSAnLi9kYXRhJztcbmltcG9ydCB7IHRlbXBsYXRlIH0gZnJvbSAnLi92ei1wcm9qZWN0b3ItaW5zcGVjdG9yLXBhbmVsLmh0bWwnO1xuaW1wb3J0ICcuL3Z6LXByb2plY3Rvci1pbnB1dCc7XG5pbXBvcnQgeyBkaXN0MmNvbG9yLCBub3JtYWxpemVEaXN0IH0gZnJvbSAnLi9wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXInO1xuaW1wb3J0IHsgUHJvamVjdG9yRXZlbnRDb250ZXh0IH0gZnJvbSAnLi9wcm9qZWN0b3JFdmVudENvbnRleHQnO1xuaW1wb3J0IHsgU2NhdHRlclBsb3QsIE1vdXNlTW9kZSB9IGZyb20gJy4vc2NhdHRlclBsb3QnO1xuXG5cbmltcG9ydCB7IFByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlciB9IGZyb20gJy4vcHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyJztcblxuaW1wb3J0ICogYXMga25uIGZyb20gJy4va25uJztcbmltcG9ydCAqIGFzIHZlY3RvciBmcm9tICcuL3ZlY3Rvcic7XG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gJy4vdXRpbCc7XG5pbXBvcnQgKiBhcyBsb2dnaW5nIGZyb20gJy4vbG9nZ2luZyc7XG5cbmNvbnN0IExJTUlUX1JFU1VMVFMgPSAxMDAwMDtcbmNvbnN0IERFRkFVTFRfTkVJR0hCT1JTID0gMTAwO1xuXG50eXBlIFNwcml0ZU1ldGFkYXRhID0ge1xuICBpbWFnZVBhdGg/OiBzdHJpbmc7XG4gIHNpbmdsZUltYWdlRGltPzogbnVtYmVyW107XG4gIGFzcGVjdFJhdGlvPzogbnVtYmVyO1xuICBuQ29scz86IG51bWJlcjtcbn07XG5cbkBjdXN0b21FbGVtZW50KCd2ei1wcm9qZWN0b3ItaW5zcGVjdG9yLXBhbmVsJylcbmNsYXNzIEluc3BlY3RvclBhbmVsIGV4dGVuZHMgTGVnYWN5RWxlbWVudE1peGluKFBvbHltZXJFbGVtZW50KSB7XG4gIHN0YXRpYyByZWFkb25seSB0ZW1wbGF0ZSA9IHRlbXBsYXRlO1xuXG4gIGRhdGFTZXQ6IERhdGFTZXQ7XG5cbiAgQHByb3BlcnR5KHsgdHlwZTogU3RyaW5nIH0pXG4gIHNlbGVjdGVkU3RyYXRlcmd5OiBzdHJpbmcgPSAnSW50ZXJlc3QgcG90ZW50aWFsJztcblxuICBAcHJvcGVydHkoeyB0eXBlOiBTdHJpbmcgfSlcbiAgc2VsZWN0ZWRBbm9ybWFseVN0cmF0ZXJneTogc3RyaW5nO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IE51bWJlciB9KVxuICBzZWxlY3RlZEFub3JtYWx5Q2xhc3M6IG51bWJlciA9IDA7XG5cbiAgQHByb3BlcnR5KHsgdHlwZTogTnVtYmVyIH0pXG4gIGJ1ZGdldDogbnVtYmVyXG5cbiAgQHByb3BlcnR5KHsgdHlwZTogTnVtYmVyIH0pXG4gIGFub21hbHlSZWNOdW06IG51bWJlclxuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IE51bWJlciB9KVxuICBzdWdnZXN0S051bTogbnVtYmVyXG5cbiAgQHByb3BlcnR5KHsgdHlwZTogU3RyaW5nIH0pXG4gIHNlbGVjdGVkTWV0YWRhdGFGaWVsZDogc3RyaW5nO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IEFycmF5IH0pXG4gIG1ldGFkYXRhRmllbGRzOiBBcnJheTxzdHJpbmc+O1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IFN0cmluZyB9KVxuICBtZXRhZGF0YUNvbHVtbjogc3RyaW5nO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IE51bWJlciB9KVxuICBudW1OTjogbnVtYmVyID0gREVGQVVMVF9ORUlHSEJPUlM7XG5cbiAgQHByb3BlcnR5KHsgdHlwZTogT2JqZWN0IH0pXG4gIHNwcml0ZU1ldGE6IFNwcml0ZU1ldGFkYXRhO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IEJvb2xlYW4gfSlcbiAgc2hvd05laWdoYm9ySW1hZ2VzOiBib29sZWFuID0gdHJ1ZTtcblxuICBAcHJvcGVydHkoeyB0eXBlOiBOdW1iZXIgfSlcbiAgY29uZmlkZW5jZVRocmVzaG9sZEZyb206IG51bWJlclxuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IE51bWJlciB9KVxuICBjb25maWRlbmNlVGhyZXNob2xkVG86IG51bWJlclxuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IEJvb2xlYW4gfSlcbiAgZGlzYWJsZWRBbEV4QmFzZTogYm9vbGVhbiA9IGZhbHNlXG5cblxuICAvLyBAcHJvcGVydHkoeyB0eXBlOiBOdW1iZXIgfSlcbiAgLy8gZXBvY2hGcm9tOiBudW1iZXJcblxuICAvLyBAcHJvcGVydHkoeyB0eXBlOiBOdW1iZXIgfSlcbiAgLy8gZXBvY2hUbzogbnVtYmVyXG5cbiAgQHByb3BlcnR5KHsgdHlwZTogQm9vbGVhbiB9KVxuICBzaG93VHJhY2U6IGZhbHNlXG5cbiAgQHByb3BlcnR5KHsgdHlwZTogTnVtYmVyIH0pXG4gIGN1cnJlbnRQbGF5ZWRFcG9jaDogbnVtYmVyXG5cbiAgQHByb3BlcnR5KHsgdHlwZTogTnVtYmVyIH0pXG4gIHRvdGFsRXBvY2g6IG51bWJlclxuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IEJvb2xlYW4gfSlcbiAgc3ByaXRlSW1hZ2VzQXZhaWxhYmxlOiBCb29sZWFuID0gdHJ1ZTtcblxuICBAcHJvcGVydHkoeyB0eXBlOiBCb29sZWFuIH0pXG4gIG5vU2hvdzogQm9vbGVhbiA9IGZhbHNlO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IEJvb2xlYW4gfSlcbiAgaXNDb2xsYXBzZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuICBAcHJvcGVydHkoeyB0eXBlOiBCb29sZWFuIH0pXG4gIGNoZWNrQWxsUXVlcnlSZXM6IGJvb2xlYW4gPSBmYWxzZVxuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IFN0cmluZyB9KVxuICBjb2xsYXBzZUljb246IHN0cmluZyA9ICdleHBhbmQtbGVzcyc7XG5cbiAgQHByb3BlcnR5KHsgdHlwZTogQm9vbGVhbiB9KVxuICBzaG93QW5vbWFseTogYm9vbGVhbiA9IGZhbHNlXG5cbiAgQHByb3BlcnR5KHsgdHlwZTogQm9vbGVhbiB9KVxuICBpc0NvbnRyb2xHcm91cDogYm9vbGVhbiA9IGZhbHNlXG5cbiAgQHByb3BlcnR5KHsgdHlwZTogQm9vbGVhbiB9KVxuICBzaG93bm9ybWFsOiBib29sZWFuID0gZmFsc2VcblxuICBAcHJvcGVydHkoeyB0eXBlOiBTdHJpbmcgfSlcbiAgcXVlcnlSZXN1bHRMaXN0VGl0bGU6IHN0cmluZyA9ICdRdWVyeSBSZXN1bHQgTGlzdCdcblxuICBAcHJvcGVydHkoeyB0eXBlOiBCb29sZWFuIH0pXG4gIHNob3dDaGVja0FsbFF1ZXJ5UmVzOiBib29sZWFuID0gdHJ1ZVxuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IEJvb2xlYW4gfSlcbiAgc2hvd01vcmVSZWNvbW1lbmQ6IGJvb2xlYW4gPSB0cnVlXG5cblxuICBAcHJvcGVydHkoeyB0eXBlOiBCb29sZWFuIH0pXG4gIHNob3dQbGF5QW5kU3RvcDogYm9vbGVhbiA9IGZhbHNlXG4gIFxuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IE51bWJlciB9KVxuICBtb3JlUmVjb21tZWRuTnVtOiBudW1iZXIgPSAxMFxuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IEJvb2xlYW4gfSlcbiAgYWNjQWxsOiBib29sZWFuID0gZmFsc2VcblxuICBAcHJvcGVydHkoeyB0eXBlOiBCb29sZWFuIH0pXG4gIHJlakFsbDogYm9vbGVhbiA9IGZhbHNlXG5cblxuICBAcHJvcGVydHkoeyB0eXBlOiBCb29sZWFuIH0pXG4gIHNob3dVbmxhYmVsZWRDaGVja2VkOiBib29sZWFuID0gdHJ1ZVxuXG5cbiAgZGlzdEZ1bmM6IERpc3RhbmNlRnVuY3Rpb247XG5cbiAgcHVibGljIHNjYXR0ZXJQbG90OiBTY2F0dGVyUGxvdDtcbiAgcHJpdmF0ZSBwcm9qZWN0b3JFdmVudENvbnRleHQ6IFByb2plY3RvckV2ZW50Q29udGV4dDtcbiAgcHJpdmF0ZSBwcm9qZWN0aW9uc1BhbmVsOiBhbnk7XG4gIHByaXZhdGUgZGlzcGxheUNvbnRleHRzOiBzdHJpbmdbXTtcbiAgcHJpdmF0ZSBwcm9qZWN0b3I6IGFueTsgLy8gUHJvamVjdG9yOyB0eXBlIG9taXR0ZWQgYi9jIExlZ2FjeUVsZW1lbnRcbiAgcHJpdmF0ZSBzZWxlY3RlZFBvaW50SW5kaWNlczogbnVtYmVyW107XG4gIHByaXZhdGUgbmVpZ2hib3JzT2ZGaXJzdFBvaW50OiBrbm4uTmVhcmVzdEVudHJ5W107XG4gIHByaXZhdGUgc2VhcmNoQm94OiBhbnk7IC8vIFByb2plY3RvcklucHV0OyB0eXBlIG9taXR0ZWQgYi9jIExlZ2FjeUVsZW1lbnRcblxuICBwcml2YXRlIHF1ZXJ5QnlTdHJhdGVndEJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHByaXZhdGUgbW9yZVJlY29tbWVuZDogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHByaXZhdGUgcXVlcnlBbm9tYWx5QnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgcHJpdmF0ZSBzaG93U2VsZWN0aW9uQnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgcHJpdmF0ZSBub2lzeXNob3dTZWxlY3Rpb25CdG46IEhUTUxCdXR0b25FbGVtZW50O1xuXG4gIHByaXZhdGUgYm91bmRpbmdTZWxlY3Rpb25CdG46IEhUTUxCdXR0b25FbGVtZW50O1xuICBwcml2YXRlIGlzQWxTZWxlY3Rpbmc6IGJvb2xlYW47XG4gIHByaXZhdGUgdHJhaW5CeVNlbEJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cbiAgcHJpdmF0ZSByZXNldEZpbHRlckJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHByaXZhdGUgc2V0RmlsdGVyQnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgcHJpdmF0ZSBjbGVhclNlbGVjdGlvbkJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHByaXZhdGUgc2VhcmNoQnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgcHJpdmF0ZSBhZGRCdXR0b246IEhUTUxCdXR0b25FbGVtZW50O1xuICBwcml2YXRlIHJlc2V0QnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgcHJpdmF0ZSBzZW50QnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgcHJpdmF0ZSBzaG93QnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgcHJpdmF0ZSBzZWxlY3Rpbk1lc3NhZ2U6IEhUTUxFbGVtZW50O1xuXG4gIHByaXZhdGUgbm9pc3lCdG46IEhUTUxCdXR0b25FbGVtZW50O1xuICBwcml2YXRlIHN0b3BCdG46IEhUTUxCdXR0b25FbGVtZW50O1xuICBwcml2YXRlIHNjYXR0ZXJQbG90Q29udGFpbmVyOiBIVE1MRWxlbWVudDtcblxuICBwcml2YXRlIGxpbWl0TWVzc2FnZTogSFRNTERpdkVsZW1lbnQ7XG4gIHByaXZhdGUgX2N1cnJlbnROZWlnaGJvcnM6IGFueTtcbiAgLy8gc2F2ZSBjdXJyZW50IHByZWRpY2F0ZXNcbiAgcHJpdmF0ZSBjdXJyZW50UHJlZGljYXRlOiB7IFtrZXk6IHN0cmluZ106IGFueSB9OyAvLyBkaWN0aW9uYXJ5XG4gIHByaXZhdGUgcXVlcnlJbmRpY2VzOiBudW1iZXJbXTtcbiAgcHJpdmF0ZSBzZWFyY2hQcmVkaWNhdGU6IHN0cmluZztcbiAgcHJpdmF0ZSBzZWFyY2hJblJlZ2V4TW9kZTogYm9vbGVhbjtcbiAgcHJpdmF0ZSBmaWx0ZXJJbmRpY2VzOiBudW1iZXJbXTtcbiAgcHJpdmF0ZSBzZWFyY2hGaWVsZHM6IHN0cmluZ1tdO1xuICBwcml2YXRlIHN0YXRlcmd5TGlzdDogc3RyaW5nW107XG4gIHByaXZhdGUgYW5vcm1hbHlTdGF0ZXJneUxpc3Q6IHN0cmluZ1tdO1xuICBwcml2YXRlIGNsYXNzT3B0aW9uc0xpc3Q6IGFueTtcbiAgcHJpdmF0ZSBib3VuZGluZ0JveFNlbGVjdGlvbjogbnVtYmVyW107XG4gIHByaXZhdGUgY3VycmVudEJvdW5kaW5nQm94U2VsZWN0aW9uOiBudW1iZXJbXTtcbiAgcHJpdmF0ZSBwcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXI6IFByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlcjtcblxuICBwcml2YXRlIHJlakFsbFJhZGlvOiBhbnk7XG4gIHByaXZhdGUgYWNjQWxsUmFkaW86IGFueTtcblxuXG4gIHByaXZhdGUgY3VycmVudEZpbHRlclR5cGU6IHN0cmluZ1xuXG4gIHByaXZhdGUgbGFiZWxNYXA6IGFueVxuXG5cblxuICByZWFkeSgpIHtcbiAgICBzdXBlci5yZWFkeSgpO1xuXG4gICAgdGhpcy5pc0FsU2VsZWN0aW5nID0gZmFsc2VcblxuICAgIHRoaXMuY3VycmVudEZpbHRlclR5cGUgPSAnbm9ybWFsJ1xuXG5cblxuICAgIHRoaXMuc2hvd0Fub21hbHkgPSB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudGFza1R5cGUgPT0gJ2Fub3JtYWx5IGRldGVjdGlvbidcbiAgICB0aGlzLnNob3dub3JtYWwgPSB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudGFza1R5cGUgPT0gJ2FjdGl2ZSBsZWFybmluZycgfHwgd2luZG93LnRhc2tUeXBlID09ICdhY3RpdmUgbGVhcm5pbmcnXG4gICAgdGhpcy5pc0NvbnRyb2xHcm91cCA9IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5pc0NvbnRyb2xHcm91cCA9PSAndHJ1ZSdcblxuICAgIC8vIHRoaXMuc2hvd1VubGFiZWxlZENoZWNrZWQgPSB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudGFza1R5cGUgPT0gJ2FjdGl2ZSBsZWFybmluZycgfHwgd2luZG93LnRhc2tUeXBlID09ICdhY3RpdmUgbGVhcm5pbmcnXG5cbiAgICAvLyBpZiAod2luZG93LnNlc3Npb25TdG9yYWdlLnRhc2tUeXBlID09ICdhY3RpdmUgbGVhcm5pbmcnKSB7XG4gICAgLy8gICB0aGlzLm1vcmVSZWNvbW1lZG5OdW0gPSAxMDBcbiAgICAvLyB9XG4gICAgdGhpcy5xdWVyeUJ5U3RyYXRlZ3RCdG4gPSB0aGlzLiQkKCcucXVlcnktYnktc3RyYXRlcmd5JykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gICAgdGhpcy5tb3JlUmVjb21tZW5kID0gdGhpcy4kJCgnLnF1ZXJ5LWJ5LXNlbC1idG4nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcbiAgICB0aGlzLnNob3dTZWxlY3Rpb25CdG4gPSB0aGlzLiQkKCcuc2hvdy1zZWxlY3Rpb24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcbiAgICB0aGlzLm5vaXN5c2hvd1NlbGVjdGlvbkJ0biA9IHRoaXMuJCQoJy5ub2lzeS1zaG93LXNlbGVjdGlvbicpIGFzIEhUTUxCdXR0b25FbGVtZW50XG4gICAgdGhpcy5xdWVyeUFub21hbHlCdG4gPSB0aGlzLiQkKCcucXVlcnktYW5vbWFseScpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXG4gICAgdGhpcy5hY2NBbGxSYWRpbyA9IHRoaXMuJCQoJyNhY2NBbGxSYWRpbycpIGFzIEhUTUxFbGVtZW50O1xuICAgIHRoaXMucmVqQWxsUmFkaW8gPSB0aGlzLiQkKCcjcmVqQWxsUmFkaW8nKSBhcyBIVE1MRWxlbWVudDtcbiAgICAvLyB0aGlzLmJvdW5kaW5nU2VsZWN0aW9uQnRuID0gdGhpcy4kJCgnLmJvdW5kaW5nLXNlbGVjdGlvbicpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXG4gICAgLy8gdGhpcy5yZXNldEZpbHRlckJ1dHRvbiA9IHRoaXMuJCQoJy5yZXNldC1maWx0ZXInKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcbiAgICAvLyB0aGlzLnNldEZpbHRlckJ1dHRvbiA9IHRoaXMuJCQoJy5zZXQtZmlsdGVyJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gICAgLy8gdGhpcy5jbGVhclNlbGVjdGlvbkJ1dHRvbiA9IHRoaXMuJCQoXG4gICAgLy8gICAnLmNsZWFyLXNlbGVjdGlvbidcbiAgICAvLyApIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuICAgIHRoaXMubm9pc3lCdG4gPSB0aGlzLiQkKCcuc2hvdy1ub2lzeS1idG4nKSBhcyBIVE1MQnV0dG9uRWxlbWVudFxuICAgIHRoaXMuc3RvcEJ0biA9IHRoaXMuJCQoJy5zdG9wLWFuaW1hdGlvbi1idG4nKSBhcyBIVE1MQnV0dG9uRWxlbWVudFxuXG4gICAgdGhpcy5zZWFyY2hCdXR0b24gPSB0aGlzLiQkKCcuc2VhcmNoJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gICAgdGhpcy5hZGRCdXR0b24gPSB0aGlzLiQkKCcuYWRkJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gICAgdGhpcy5yZXNldEJ1dHRvbiA9IHRoaXMuJCQoJy5yZXNldCcpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuICAgIHRoaXMuc2VudEJ1dHRvbiA9IHRoaXMuJCQoJy5zZW50JykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gICAgdGhpcy5zaG93QnV0dG9uID0gdGhpcy4kJCgnLnNob3cnKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcbiAgICAvLyB0aGlzLnNlbGVjdGluTWVzc2FnZSA9IHRoaXMuJCQoJy5ib3VuZGluZ0JveFNlbGVjdGlvbicpIGFzIEhUTUxFbGVtZW50O1xuICAgIHRoaXMudHJhaW5CeVNlbEJ0biA9IHRoaXMuJCQoJy50cmFpbi1ieS1zZWxlY3Rpb24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudFxuICAgIHRoaXMucHJvamVjdGlvbnNQYW5lbCA9IHRoaXMuJFsncHJvamVjdGlvbnMtcGFuZWwnXSBhcyBhbnk7IC8vIFByb2plY3Rpb25zUGFuZWxcblxuXG4gICAgdGhpcy5saW1pdE1lc3NhZ2UgPSB0aGlzLiQkKCcubGltaXQtbXNnJykgYXMgSFRNTERpdkVsZW1lbnQ7XG4gICAgdGhpcy5zZWFyY2hCb3ggPSB0aGlzLiQkKCcjc2VhcmNoLWJveCcpIGFzIGFueTsgLy8gUHJvamVjdG9ySW5wdXRcbiAgICB0aGlzLmRpc3BsYXlDb250ZXh0cyA9IFtdO1xuICAgIC8vIHNob3cgbm9pc3kgcG9pbnRzXG5cbiAgICB0aGlzLmN1cnJlbnRQcmVkaWNhdGUgPSB7fTtcbiAgICB0aGlzLnF1ZXJ5SW5kaWNlcyA9IFtdO1xuICAgIHRoaXMuZmlsdGVySW5kaWNlcyA9IFtdO1xuICAgIHRoaXMuYm91bmRpbmdCb3hTZWxlY3Rpb24gPSBbXTtcbiAgICB0aGlzLmN1cnJlbnRCb3VuZGluZ0JveFNlbGVjdGlvbiA9IFtdO1xuICAgIC8vIHRoaXMuc2VsZWN0aW5NZXNzYWdlLmlubmVyVGV4dCA9IFwiMCBzZWxldGVkLlwiO1xuICAgIHRoaXMuY29uZmlkZW5jZVRocmVzaG9sZEZyb20gPSAwXG4gICAgdGhpcy5jb25maWRlbmNlVGhyZXNob2xkVG8gPSAxXG5cbiAgICB0aGlzLmRpc2FibGVkQWxFeEJhc2UgPSBmYWxzZVxuICAgIC8vIHRoaXMuZXBvY2hGcm9tID0gMVxuICAgIC8vIHRoaXMuZXBvY2hUbyA9IDFcbiAgICB0aGlzLnNob3dUcmFjZSA9IGZhbHNlXG4gICAgdGhpcy5jaGVja0FsbFF1ZXJ5UmVzID0gZmFsc2VcblxuICAgIHRoaXMuYnVkZ2V0ID0gMTBcbiAgICB0aGlzLmFub21hbHlSZWNOdW0gPSAxMFxuICAgIHRoaXMuc3VnZ2VzdEtOdW0gPSAxMFxuICB9XG4gIGluaXRpYWxpemUocHJvamVjdG9yOiBhbnksIHByb2plY3RvckV2ZW50Q29udGV4dDogUHJvamVjdG9yRXZlbnRDb250ZXh0KSB7XG4gICAgdGhpcy5wcm9qZWN0b3IgPSBwcm9qZWN0b3I7XG4gICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQgPSBwcm9qZWN0b3JFdmVudENvbnRleHQ7XG4gICAgdGhpcy5zZXR1cFVJKHByb2plY3Rvcik7XG4gICAgdGhpcy5sYWJlbE1hcCA9IHtcbiAgICAgIFwiMFwiOiBcInBsYW5lXCIsXG4gICAgICBcIjFcIjogXCJjYXJcIixcbiAgICAgIFwiMlwiOiBcImJpcmRcIixcbiAgICAgIFwiM1wiOiBcImNhdFwiLFxuICAgICAgXCI0XCI6IFwiZGVlclwiLFxuICAgICAgXCI1XCI6IFwiZG9nXCIsXG4gICAgICBcIjZcIjogXCJmcm9nXCIsXG4gICAgICBcIjdcIjogXCJob3JzZVwiLFxuICAgICAgXCI4XCI6IFwic2hpcFwiLFxuICAgICAgXCI5XCI6IFwidHJ1Y2tcIlxuICAgIH1cbiAgICBwcm9qZWN0b3JFdmVudENvbnRleHQucmVnaXN0ZXJTZWxlY3Rpb25DaGFuZ2VkTGlzdGVuZXIoXG4gICAgICAoc2VsZWN0aW9uLCBuZWlnaGJvcnMpID0+IHRoaXMudXBkYXRlSW5zcGVjdG9yUGFuZShzZWxlY3Rpb24sIG5laWdoYm9ycylcbiAgICApO1xuICAgIC8vIFRPRE8gY2hhbmdlIHRoZW0gYmFzZWQgb24gbWV0YWRhdGEgZmllbGRzXG4gICAgdGhpcy5zZWFyY2hGaWVsZHMgPSBbXCJ0eXBlXCIsIFwibGFiZWxcIl1cbiAgICAvLyBhY3RpdmUgbGVhcm5pbmcgc3RhdGVyZ3lcbiAgICB0aGlzLnN0YXRlcmd5TGlzdCA9IFtcIkludGVyZXN0IHBvdGVudGlhbFwiLCBcIlJhbmRvbVwiXVxuICAgIC8vIGFub3JtYWx5IGRldGVjdGlvbiBzdGF0ZXJneVxuICAgIHRoaXMuYW5vcm1hbHlTdGF0ZXJneUxpc3QgPSBbJ2Fub3JtYWx5U3RhZ2VvbmUnLCAnYW5vcm1hbHlTdGFnZVR3bycsICdhbm9ybWFseVN0YWdlVGhyZWUnXVxuICAgIC8vIGFub3JtYWx5IGRldGN0dGlvbiBjbGFzc2VzXG4gICAgdGhpcy5jbGFzc09wdGlvbnNMaXN0ID0gW3sgdmFsdWU6IDAsIGxhYmVsOiAnYWlycGxhbmUnIH0sIHsgdmFsdWU6IDEsIGxhYmVsOiAnY2FyJyB9LCB7IHZhbHVlOiAyLCBsYWJlbDogJ2JpcmQnIH0sIHsgdmFsdWU6IDMsIGxhYmVsOiAnY2F0JyB9LCB7IHZhbHVlOiA0LCBsYWJlbDogJ2RlZXInIH0sIHsgdmFsdWU6IDUsIGxhYmVsOiAnZG9nJyB9LCB7IHZhbHVlOiA2LCBsYWJlbDogJ2Zyb2cnIH0sIHsgdmFsdWU6IDcsIGxhYmVsOiAnaG9yc2UnIH0sIHsgdmFsdWU6IDgsIGxhYmVsOiAnc2hpcCcgfSwgeyB2YWx1ZTogOSwgbGFiZWw6ICd0cnVjaycgfV1cbiAgICAvLyBUT0RPIHJlYWQgcmVhbCBwb2ludHMgbGVuZ3RoIGZyb20gZGF0YVNldFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNzAwMDA7IGkrKykge1xuICAgICAgdGhpcy5maWx0ZXJJbmRpY2VzLnB1c2goaSk7XG4gICAgfVxuICAgIHRoaXMubm9pc3lCdG4uc3R5bGUudmlzaWJpbGl0eSA9IEJvb2xlYW4od2luZG93LmN1c3RvbVNlbGVjdGlvbj8ubGVuZ3RoKT8nJzonaGlkZGVuJ1xuICAgIHRoaXMuc3RvcEJ0bi5zdHlsZS52aXNpYmlsaXR5ID0gQm9vbGVhbih3aW5kb3cuY3VzdG9tU2VsZWN0aW9uPy5sZW5ndGgpPycnOidoaWRkZW4nXG4gIH1cbiAgLyoqIFVwZGF0ZXMgdGhlIG5lYXJlc3QgbmVpZ2hib3JzIGxpc3QgaW4gdGhlIGluc3BlY3Rvci4gKi9cbiAgcHJpdmF0ZSB1cGRhdGVJbnNwZWN0b3JQYW5lKFxuICAgIGluZGljZXM6IG51bWJlcltdLFxuICAgIG5laWdoYm9yczoga25uLk5lYXJlc3RFbnRyeVtdXG4gICkge1xuICAgIHRoaXMubmVpZ2hib3JzT2ZGaXJzdFBvaW50ID0gbmVpZ2hib3JzO1xuICAgIHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMgPSBpbmRpY2VzO1xuICAgIC8vIHRoaXMudXBkYXRlRmlsdGVyQnV0dG9ucyhpbmRpY2VzLmxlbmd0aCArIG5laWdoYm9ycy5sZW5ndGgpO1xuICAgIC8vIHRoaXMudXBkYXRlRmlsdGVyQnV0dG9ucyhpbmRpY2VzLmxlbmd0aCk7XG4gICAgdGhpcy51cGRhdGVOZWlnaGJvcnNMaXN0KG5laWdoYm9ycyk7XG4gICAgaWYgKG5laWdoYm9ycy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMudXBkYXRlU2VhcmNoUmVzdWx0cyhpbmRpY2VzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy51cGRhdGVTZWFyY2hSZXN1bHRzKFtdKTtcbiAgICB9XG4gIH1cbiAgcHJpdmF0ZSBlbmFibGVSZXNldEZpbHRlckJ1dHRvbihlbmFibGVkOiBib29sZWFuKSB7XG4gICAgLy8gdGhpcy5yZXNldEZpbHRlckJ1dHRvbi5kaXNhYmxlZCA9ICFlbmFibGVkO1xuICB9XG5cbiAgLyoqIEhhbmRsZXMgdG9nZ2xlIG9mIG1ldGFkYXRhLWNvbnRhaW5lci4gKi9cbiAgX3RvZ2dsZU1ldGFkYXRhQ29udGFpbmVyKCkge1xuICAgICh0aGlzLiQkKCcjbWV0YWRhdGEtY29udGFpbmVyJykgYXMgYW55KS50b2dnbGUoKTtcbiAgICB0aGlzLmlzQ29sbGFwc2VkID0gIXRoaXMuaXNDb2xsYXBzZWQ7XG4gICAgdGhpcy5zZXQoJ2NvbGxhcHNlSWNvbicsIHRoaXMuaXNDb2xsYXBzZWQgPyAnZXhwYW5kLW1vcmUnIDogJ2V4cGFuZC1sZXNzJyk7XG4gIH1cbiAgcmVmcmVzaEJ0blN0eWxlKCl7XG4gICAgdGhpcy5ub2lzeUJ0bi5zdHlsZS52aXNpYmlsaXR5ID0gQm9vbGVhbih3aW5kb3cuY3VzdG9tU2VsZWN0aW9uPy5sZW5ndGgpPycnOidoaWRkZW4nXG4gICAgdGhpcy5zdG9wQnRuLnN0eWxlLnZpc2liaWxpdHkgPSBCb29sZWFuKHdpbmRvdy5jdXN0b21TZWxlY3Rpb24/Lmxlbmd0aCk/Jyc6J2hpZGRlbidcbiAgfVxuICByZXN0b3JlVUlGcm9tQm9va21hcmsoYm9va21hcms6IFN0YXRlKSB7XG4gICAgdGhpcy5lbmFibGVSZXNldEZpbHRlckJ1dHRvbihib29rbWFyay5maWx0ZXJlZFBvaW50cyAhPSBudWxsKTtcbiAgfVxuICBtZXRhZGF0YUNoYW5nZWQoc3ByaXRlQW5kTWV0YWRhdGE6IFNwcml0ZUFuZE1ldGFkYXRhSW5mbykge1xuICAgIGxldCBsYWJlbEluZGV4ID0gLTE7XG4gICAgdGhpcy5tZXRhZGF0YUZpZWxkcyA9IHNwcml0ZUFuZE1ldGFkYXRhLnN0YXRzLm1hcCgoc3RhdHMsIGkpID0+IHtcbiAgICAgIGlmICghc3RhdHMuaXNOdW1lcmljICYmIGxhYmVsSW5kZXggPT09IC0xKSB7XG4gICAgICAgIGxhYmVsSW5kZXggPSBpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0YXRzLm5hbWU7XG4gICAgfSk7XG4gICAgaWYgKFxuICAgICAgc3ByaXRlQW5kTWV0YWRhdGEuc3ByaXRlTWV0YWRhdGEgJiZcbiAgICAgIHNwcml0ZUFuZE1ldGFkYXRhLnNwcml0ZU1ldGFkYXRhLmltYWdlUGF0aFxuICAgICkge1xuICAgICAgY29uc3QgW1xuICAgICAgICBzcHJpdGVXaWR0aCxcbiAgICAgICAgc3ByaXRlSGVpZ2h0LFxuICAgICAgXSA9IHNwcml0ZUFuZE1ldGFkYXRhLnNwcml0ZU1ldGFkYXRhLnNpbmdsZUltYWdlRGltO1xuICAgICAgdGhpcy5zcHJpdGVNZXRhID0ge1xuICAgICAgICBpbWFnZVBhdGg6IHNwcml0ZUFuZE1ldGFkYXRhLnNwcml0ZUltYWdlPy5zcmMsXG4gICAgICAgIGFzcGVjdFJhdGlvOiBzcHJpdGVXaWR0aCAvIHNwcml0ZUhlaWdodCxcbiAgICAgICAgbkNvbHM6IE1hdGguZmxvb3Ioc3ByaXRlQW5kTWV0YWRhdGEuc3ByaXRlSW1hZ2U/LndpZHRoIC8gc3ByaXRlV2lkdGgpLFxuICAgICAgICBzaW5nbGVJbWFnZURpbTogW3Nwcml0ZVdpZHRoLCBzcHJpdGVIZWlnaHRdLFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zcHJpdGVNZXRhID0ge307XG4gICAgfVxuICAgIHRoaXMuc3ByaXRlSW1hZ2VzQXZhaWxhYmxlID0gISF0aGlzLnNwcml0ZU1ldGEuaW1hZ2VQYXRoO1xuICAgIGlmIChcbiAgICAgIHRoaXMuc2VsZWN0ZWRNZXRhZGF0YUZpZWxkID09IG51bGwgfHxcbiAgICAgIHRoaXMubWV0YWRhdGFGaWVsZHMuZmlsdGVyKChuYW1lKSA9PiBuYW1lID09PSB0aGlzLnNlbGVjdGVkTWV0YWRhdGFGaWVsZClcbiAgICAgICAgLmxlbmd0aCA9PT0gMFxuICAgICkge1xuICAgICAgLy8gTWFrZSB0aGUgZGVmYXVsdCBsYWJlbCB0aGUgZmlyc3Qgbm9uLW51bWVyaWMgY29sdW1uLlxuICAgICAgdGhpcy5zZWxlY3RlZE1ldGFkYXRhRmllbGQgPSB0aGlzLm1ldGFkYXRhRmllbGRzW01hdGgubWF4KDAsIGxhYmVsSW5kZXgpXTtcbiAgICB9XG4gICAgdGhpcy51cGRhdGVJbnNwZWN0b3JQYW5lKFxuICAgICAgdGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcyxcbiAgICAgIHRoaXMubmVpZ2hib3JzT2ZGaXJzdFBvaW50XG4gICAgKTtcbiAgfVxuICBkYXRhc2V0Q2hhbmdlZCgpIHtcbiAgICB0aGlzLmVuYWJsZVJlc2V0RmlsdGVyQnV0dG9uKGZhbHNlKTtcbiAgfVxuXG4gIEBvYnNlcnZlKCdzaG93TmVpZ2hib3JJbWFnZXMnLCAnc3ByaXRlSW1hZ2VzQXZhaWxhYmxlJylcbiAgX3JlZnJlc2hOZWlnaGJvcnNMaXN0KCkge1xuICAgIHRoaXMudXBkYXRlTmVpZ2hib3JzTGlzdCgpO1xuICB9XG5cbiAgQG9ic2VydmUoJ2FjY0FsbCcpXG4gIF9hY2NBbGxSZXMoKSB7XG4gICAgaWYgKHRoaXMuYWNjQWxsKSB7XG4gICAgICBjb25zb2xlLmxvZygxMjMzMylcbiAgICB9XG5cbiAgfVxuXG5cblxuICBAb2JzZXJ2ZSgnc2hvd1RyYWNlJylcbiAgX3JlZnJlc2hTY2F0dGVycGxvdCgpIHtcbiAgICBpZiAodGhpcy5zaG93VHJhY2UpIHtcbiAgICAgIHRoaXMucHJvamVjdG9yRXZlbnRDb250ZXh0Py5yZW5kZXJJblRyYWNlTGluZSh0cnVlKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dD8ucmVuZGVySW5UcmFjZUxpbmUoZmFsc2UpXG4gICAgfVxuICB9XG4gIEBvYnNlcnZlKCdjaGVja0FsbFF1ZXJ5UmVzJylcbiAgX2NoZWNrQWxsKCkge1xuICAgIGlmICh0aGlzLmNoZWNrQWxsUXVlcnlSZXMpIHtcbiAgICAgIGlmICh3aW5kb3cuY2hlY2tib3hEb20pIHtcbiAgICAgICAgaWYgKHdpbmRvdy5xdWVyeVJlc1BvaW50SW5kaWNlcyAmJiB3aW5kb3cucXVlcnlSZXNQb2ludEluZGljZXMubGVuZ3RoKSB7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB3aW5kb3cucXVlcnlSZXNQb2ludEluZGljZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGxldCBpbmRleCA9IHdpbmRvdy5xdWVyeVJlc1BvaW50SW5kaWNlc1tpXVxuICAgICAgICAgICAgaWYgKHdpbmRvdy5jdXN0b21TZWxlY3Rpb24uaW5kZXhPZihpbmRleCkgPT09IC0xKSB7XG4gICAgICAgICAgICAgIGlmICh3aW5kb3cuY2hlY2tib3hEb21baW5kZXhdKSB7XG4gICAgICAgICAgICAgICAgd2luZG93LmNoZWNrYm94RG9tW2luZGV4XS5jaGVja2VkID0gdHJ1ZVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHdpbmRvdy5jdXN0b21TZWxlY3Rpb24ucHVzaChpbmRleClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQucmVmcmVzaCgpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHdpbmRvdy5jaGVja2JveERvbSkge1xuICAgICAgICBpZiAod2luZG93LnF1ZXJ5UmVzUG9pbnRJbmRpY2VzICYmIHdpbmRvdy5xdWVyeVJlc1BvaW50SW5kaWNlcy5sZW5ndGgpIHtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHdpbmRvdy5xdWVyeVJlc1BvaW50SW5kaWNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGV0IGluZGV4ID0gd2luZG93LnF1ZXJ5UmVzUG9pbnRJbmRpY2VzW2ldXG4gICAgICAgICAgICBpZiAod2luZG93LmN1c3RvbVNlbGVjdGlvbi5pbmRleE9mKGluZGV4KSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgbGV0IG0gPSB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uLmluZGV4T2YoaW5kZXgpXG4gICAgICAgICAgICAgIGlmICh3aW5kb3cuY2hlY2tib3hEb21baW5kZXhdKSB7XG4gICAgICAgICAgICAgICAgd2luZG93LmNoZWNrYm94RG9tW2luZGV4XS5jaGVja2VkID0gZmFsc2VcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uLnNwbGljZShtLCAxKVxuICAgICAgICAgICAgICB0aGlzLm5vaXN5QnRuLnN0eWxlLnZpc2liaWxpdHkgPSBCb29sZWFuKHdpbmRvdy5jdXN0b21TZWxlY3Rpb24/Lmxlbmd0aCk/Jyc6J2hpZGRlbidcbiAgICAgICAgICAgICAgdGhpcy5zdG9wQnRuLnN0eWxlLnZpc2liaWxpdHkgPSBCb29sZWFuKHdpbmRvdy5jdXN0b21TZWxlY3Rpb24/Lmxlbmd0aCk/Jyc6J2hpZGRlbidcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQucmVmcmVzaCgpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBtZXRhZGF0YUVkaXRvckNvbnRleHQoZW5hYmxlZDogYm9vbGVhbiwgbWV0YWRhdGFDb2x1bW46IHN0cmluZykge1xuICAgIGlmICghdGhpcy5wcm9qZWN0b3IgfHwgIXRoaXMucHJvamVjdG9yLmRhdGFTZXQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbGV0IHN0YXQgPSB0aGlzLnByb2plY3Rvci5kYXRhU2V0LnNwcml0ZUFuZE1ldGFkYXRhSW5mby5zdGF0cy5maWx0ZXIoXG4gICAgICAocykgPT4gcy5uYW1lID09PSBtZXRhZGF0YUNvbHVtblxuICAgICk7XG4gICAgaWYgKCFlbmFibGVkIHx8IHN0YXQubGVuZ3RoID09PSAwIHx8IHN0YXRbMF0udG9vTWFueVVuaXF1ZVZhbHVlcykge1xuICAgICAgdGhpcy5yZW1vdmVDb250ZXh0KCcubWV0YWRhdGEtaW5mbycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLm1ldGFkYXRhQ29sdW1uID0gbWV0YWRhdGFDb2x1bW47XG4gICAgdGhpcy5hZGRDb250ZXh0KCcubWV0YWRhdGEtaW5mbycpO1xuICAgIGxldCBsaXN0ID0gdGhpcy4kJCgnLm1ldGFkYXRhLWxpc3QnKSBhcyBIVE1MRGl2RWxlbWVudDtcbiAgICBsaXN0LnRleHRDb250ZW50ID0gJyc7XG4gICAgbGV0IGVudHJpZXMgPSBzdGF0WzBdLnVuaXF1ZUVudHJpZXMuc29ydCgoYSwgYikgPT4gYS5jb3VudCAtIGIuY291bnQpO1xuICAgIGxldCBtYXhDb3VudCA9IGVudHJpZXNbZW50cmllcy5sZW5ndGggLSAxXS5jb3VudDtcbiAgICBlbnRyaWVzLmZvckVhY2goKGUpID0+IHtcbiAgICAgIGNvbnN0IG1ldGFkYXRhRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgbWV0YWRhdGFFbGVtZW50LmNsYXNzTmFtZSA9ICdtZXRhZGF0YSc7XG4gICAgICBjb25zdCBtZXRhZGF0YUVsZW1lbnRMaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgICAgbWV0YWRhdGFFbGVtZW50TGluay5jbGFzc05hbWUgPSAnbWV0YWRhdGEtbGluayc7XG4gICAgICBtZXRhZGF0YUVsZW1lbnRMaW5rLnRpdGxlID0gZS5sYWJlbDtcbiAgICAgIGNvbnN0IGxhYmVsVmFsdWVFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICBsYWJlbFZhbHVlRWxlbWVudC5jbGFzc05hbWUgPSAnbGFiZWwtYW5kLXZhbHVlJztcbiAgICAgIGNvbnN0IGxhYmVsRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgbGFiZWxFbGVtZW50LmNsYXNzTmFtZSA9ICdsYWJlbCc7XG4gICAgICBsYWJlbEVsZW1lbnQuc3R5bGUuY29sb3IgPSBkaXN0MmNvbG9yKHRoaXMuZGlzdEZ1bmMsIG1heENvdW50LCBlLmNvdW50KTtcbiAgICAgIGxhYmVsRWxlbWVudC5pbm5lclRleHQgPSBlLmxhYmVsO1xuICAgICAgY29uc3QgdmFsdWVFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICB2YWx1ZUVsZW1lbnQuY2xhc3NOYW1lID0gJ3ZhbHVlJztcbiAgICAgIHZhbHVlRWxlbWVudC5pbm5lclRleHQgPSBlLmNvdW50LnRvU3RyaW5nKCk7XG4gICAgICBsYWJlbFZhbHVlRWxlbWVudC5hcHBlbmRDaGlsZChsYWJlbEVsZW1lbnQpO1xuICAgICAgbGFiZWxWYWx1ZUVsZW1lbnQuYXBwZW5kQ2hpbGQodmFsdWVFbGVtZW50KTtcbiAgICAgIGNvbnN0IGJhckVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIGJhckVsZW1lbnQuY2xhc3NOYW1lID0gJ2Jhcic7XG4gICAgICBjb25zdCBiYXJGaWxsRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgYmFyRmlsbEVsZW1lbnQuY2xhc3NOYW1lID0gJ2ZpbGwnO1xuICAgICAgYmFyRmlsbEVsZW1lbnQuc3R5bGUuYm9yZGVyVG9wQ29sb3IgPSBkaXN0MmNvbG9yKFxuICAgICAgICB0aGlzLmRpc3RGdW5jLFxuICAgICAgICBtYXhDb3VudCxcbiAgICAgICAgZS5jb3VudFxuICAgICAgKTtcbiAgICAgIGJhckZpbGxFbGVtZW50LnN0eWxlLndpZHRoID1cbiAgICAgICAgbm9ybWFsaXplRGlzdCh0aGlzLmRpc3RGdW5jLCBtYXhDb3VudCwgZS5jb3VudCkgKiAxMDAgKyAnJSc7XG4gICAgICBiYXJFbGVtZW50LmFwcGVuZENoaWxkKGJhckZpbGxFbGVtZW50KTtcbiAgICAgIGZvciAobGV0IGogPSAxOyBqIDwgNDsgaisrKSB7XG4gICAgICAgIGNvbnN0IHRpY2tFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIHRpY2tFbGVtZW50LmNsYXNzTmFtZSA9ICd0aWNrJztcbiAgICAgICAgdGlja0VsZW1lbnQuc3R5bGUubGVmdCA9IChqICogMTAwKSAvIDQgKyAnJSc7XG4gICAgICAgIGJhckVsZW1lbnQuYXBwZW5kQ2hpbGQodGlja0VsZW1lbnQpO1xuICAgICAgfVxuICAgICAgbWV0YWRhdGFFbGVtZW50TGluay5hcHBlbmRDaGlsZChsYWJlbFZhbHVlRWxlbWVudCk7XG4gICAgICBtZXRhZGF0YUVsZW1lbnRMaW5rLmFwcGVuZENoaWxkKGJhckVsZW1lbnQpO1xuICAgICAgbWV0YWRhdGFFbGVtZW50LmFwcGVuZENoaWxkKG1ldGFkYXRhRWxlbWVudExpbmspO1xuICAgICAgbGlzdC5hcHBlbmRDaGlsZChtZXRhZGF0YUVsZW1lbnQpO1xuICAgICAgbWV0YWRhdGFFbGVtZW50TGluay5vbmNsaWNrID0gKCkgPT4ge1xuICAgICAgICB0aGlzLnByb2plY3Rvci5tZXRhZGF0YUVkaXQobWV0YWRhdGFDb2x1bW4sIGUubGFiZWwpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYWRkQ29udGV4dChjb250ZXh0OiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5kaXNwbGF5Q29udGV4dHMuaW5kZXhPZihjb250ZXh0KSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuZGlzcGxheUNvbnRleHRzLnB1c2goY29udGV4dCk7XG4gICAgfVxuICAgIHRoaXMuZGlzcGxheUNvbnRleHRzLmZvckVhY2goKGMpID0+IHtcbiAgICAgICh0aGlzLiQkKGMpIGFzIEhUTUxEaXZFbGVtZW50KS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIH0pO1xuICAgICh0aGlzLiQkKGNvbnRleHQpIGFzIEhUTUxEaXZFbGVtZW50KS5zdHlsZS5kaXNwbGF5ID0gbnVsbDtcbiAgfVxuICBwcml2YXRlIHJlbW92ZUNvbnRleHQoY29udGV4dDogc3RyaW5nKSB7XG4gICAgdGhpcy5kaXNwbGF5Q29udGV4dHMgPSB0aGlzLmRpc3BsYXlDb250ZXh0cy5maWx0ZXIoKGMpID0+IGMgIT09IGNvbnRleHQpO1xuICAgICh0aGlzLiQkKGNvbnRleHQpIGFzIEhUTUxEaXZFbGVtZW50KS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIGlmICh0aGlzLmRpc3BsYXlDb250ZXh0cy5sZW5ndGggPiAwKSB7XG4gICAgICBsZXQgbGFzdENvbnRleHQgPSB0aGlzLmRpc3BsYXlDb250ZXh0c1t0aGlzLmRpc3BsYXlDb250ZXh0cy5sZW5ndGggLSAxXTtcbiAgICAgICh0aGlzLiQkKGxhc3RDb250ZXh0KSBhcyBIVE1MRGl2RWxlbWVudCkuc3R5bGUuZGlzcGxheSA9IG51bGw7XG4gICAgfVxuICB9XG4gIGNsZWFyUXVlcnlSZXNMaXN0KCkge1xuICAgIHRoaXMudXBkYXRlU2VhcmNoUmVzdWx0cyhbXSlcbiAgfVxuICByZWZyZXNoU2VhcmNoUmVzdWx0KCkge1xuICAgIHRoaXMudXBkYXRlU2VhcmNoUmVzdWx0cyh0aGlzLnF1ZXJ5SW5kaWNlcylcbiAgfVxuXG4gIHJlZnJlc2hTZWFyY2hSZXNCeUxpc3QobGlzdDogYW55KSB7XG4gICAgdGhpcy51cGRhdGVTZWFyY2hSZXN1bHRzKGxpc3QpXG4gIH1cbiAgcHJpdmF0ZSBhc3luYyB1cGRhdGVTZWFyY2hSZXN1bHRzKGluZGljZXM6IG51bWJlcltdKSB7XG4gICAgaWYgKHRoaXMuYWNjQWxsUmFkaW8/LmNoZWNrZWQgfHwgdGhpcy5yZWpBbGxSYWRpbz8uY2hlY2tlZCkge1xuICAgICAgdGhpcy5hY2NBbGxSYWRpby5jaGVja2VkID0gZmFsc2VcbiAgICAgIHRoaXMucmVqQWxsUmFkaW8uY2hlY2tlZCA9IGZhbHNlXG4gICAgfVxuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuJCQoJy5tYXRjaGVzLWxpc3QnKSBhcyBIVE1MRGl2RWxlbWVudDtcbiAgICBjb25zdCBsaXN0ID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5saXN0JykgYXMgSFRNTERpdkVsZW1lbnQ7XG4gICAgbGlzdC50ZXh0Q29udGVudCA9ICcnO1xuICAgIGlmIChpbmRpY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5yZW1vdmVDb250ZXh0KCcubWF0Y2hlcy1saXN0Jyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuYWRkQ29udGV4dCgnLm1hdGNoZXMtbGlzdCcpO1xuICAgIHRoaXMubGltaXRNZXNzYWdlLnN0eWxlLmRpc3BsYXkgPVxuICAgICAgaW5kaWNlcy5sZW5ndGggPD0gTElNSVRfUkVTVUxUUyA/ICdub25lJyA6IG51bGw7XG4gICAgaW5kaWNlcyA9IGluZGljZXMuc2xpY2UoMCwgTElNSVRfUkVTVUxUUyk7XG4gICAgdGhpcy5tb3JlUmVjb21tZW5kID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5xdWVyeS1ieS1zZWwtYnRuJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnRcblxuICAgIC8vIGNvbnN0IG1zZ0lkID0gbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UoJ0ZldGNoaW5nIHNwcml0ZSBpbWFnZS4uLicpO1xuICAgIGlmICh0aGlzLm1vcmVSZWNvbW1lbmQpIHtcblxuICAgICAgdGhpcy5tb3JlUmVjb21tZW5kLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICAgIGlmICghd2luZG93LmFjY2VwdEluZGljYXRlcyB8fCAhd2luZG93LnJlamVjdEluZGljYXRlcykge1xuICAgICAgICAgIGxvZ2dpbmcuc2V0RXJyb3JNZXNzYWdlKCdQbGVhc2UgY29uZmlybSBzb21lIHNlbGVjdGlvbiBmaXJzdCcpO1xuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIGlmICh3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudGFza1R5cGUgPT09ICdhY3RpdmUgbGVhcm5pbmcnKSB7XG4gICAgICAgICAgLy8gbGV0IGFjY0luZGljZXMgPSBbXVxuICAgICAgICAgIC8vIGxldCByZWpJbmRpY2VzID0gW11cbiAgICAgICAgICAvLyBpZiAoIXdpbmRvdy5wcmV2aW91c0luZGVjYXRlcykge1xuICAgICAgICAgIC8vICAgd2luZG93LnByZXZpb3VzSW5kZWNhdGVzID0gW11cbiAgICAgICAgICAvLyB9XG4gICAgICAgICAgLy8gaWYgKCF3aW5kb3cuYWNjZXB0SW5kaWNhdGVzKSB7XG4gICAgICAgICAgLy8gICB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzID0gW11cbiAgICAgICAgICAvLyB9IGVsc2Uge1xuICAgICAgICAgIC8vICAgZm9yIChsZXQgaSA9IDA7IGkgPCB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgLy8gICAgIGlmICh3aW5kb3cucHJldmlvdXNJbmRlY2F0ZXMuaW5kZXhPZih3aW5kb3cuY3VzdG9tU2VsZWN0aW9uW2ldKSA9PSAtMSkge1xuICAgICAgICAgIC8vICAgICAgIGFjY0luZGljZXMucHVzaCh3aW5kb3cuY3VzdG9tU2VsZWN0aW9uW2ldKVxuICAgICAgICAgIC8vICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vICAgICAgIHByZXZpb3VzdElJbmRpY2VzLnB1c2god2luZG93LmN1c3RvbVNlbGVjdGlvbltpXSlcbiAgICAgICAgICAvLyAgICAgfVxuICAgICAgICAgIC8vICAgfVxuICAgICAgICAgIC8vIH1cbiAgICAgICAgICB0aGlzLnF1ZXJ5QnlBbCh0aGlzLnByb2plY3Rvciwgd2luZG93LmFjY2VwdEluZGljYXRlcywgd2luZG93LnJlamVjdEluZGljYXRlcywgdGhpcy5tb3JlUmVjb21tZWRuTnVtLCBmYWxzZSlcbiAgICAgICAgfSBlbHNlIGlmICh3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudGFza1R5cGUgPT09ICdhbm9ybWFseSBkZXRlY3Rpb24nKSB7XG4gICAgICAgICAgbGV0IGNvbmZpcm1JbmZvOiBhbnlbXSA9IFtdXG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB3aW5kb3cucXVlcnlSZXNBbm9ybWFsSW5kZWNhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgdmFsdWUgPSBCb29sZWFuKHdpbmRvdy5jdXN0b21TZWxlY3Rpb24uaW5kZXhPZih3aW5kb3cucXVlcnlSZXNBbm9ybWFsSW5kZWNhdGVzW2ldKSAhPT0gLTEpXG4gICAgICAgICAgICBjb25maXJtSW5mby5wdXNoKHZhbHVlKVxuICAgICAgICAgICAgaWYgKHZhbHVlICYmIHdpbmRvdy5wcmV2aW91c0luZGVjYXRlcy5pbmRleE9mKHdpbmRvdy5xdWVyeVJlc0Fub3JtYWxJbmRlY2F0ZXNbaV0pID09PSAtMSkge1xuICAgICAgICAgICAgICB3aW5kb3cucHJldmlvdXNJbmRlY2F0ZXMucHVzaCh3aW5kb3cucXVlcnlSZXNBbm9ybWFsSW5kZWNhdGVzW2ldKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBsZXQgQW5vcm1hbHlTdHJhdGVneSA9ICdGZWVkYmFjaydcbiAgICAgICAgICAvLyBpZiBpcyBjb250cm9sIGdyb3VwXG4gICAgICAgICAgaWYgKHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5pc0NvbnRyb2xHcm91cCA9PSAndHJ1ZScpIHtcbiAgICAgICAgICAgIEFub3JtYWx5U3RyYXRlZ3kgPSAnVEJTYW1wbGluZydcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5wcm9qZWN0b3IucXVlcnlBbm9ybWFseVN0cmF0ZWd5KFxuXG4gICAgICAgICAgICBOdW1iZXIodGhpcy5tb3JlUmVjb21tZWRuTnVtKSwgdGhpcy5zZWxlY3RlZEFub3JtYWx5Q2xhc3MsIHdpbmRvdy5xdWVyeVJlc0Fub3JtYWxJbmRlY2F0ZXMsIGNvbmZpcm1JbmZvLCB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzLCB3aW5kb3cucmVqZWN0SW5kaWNhdGVzLCBBbm9ybWFseVN0cmF0ZWd5LCBmYWxzZSxcbiAgICAgICAgICAgIChpbmRpY2VzOiBhbnksIGNsZWFuc0luZGljZXM6IGFueSkgPT4ge1xuICAgICAgICAgICAgICBpZiAoaW5kaWNlcyAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgLy8gdGhpcy5xdWVyeUluZGljZXMgPSBpbmRpY2VzO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnF1ZXJ5SW5kaWNlcy5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgICAgICAgdGhpcy5zZWFyY2hCb3gubWVzc2FnZSA9ICcwIG1hdGNoZXMuJztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgdGhpcy5zZWFyY2hCb3gubWVzc2FnZSA9IGAke3RoaXMucXVlcnlJbmRpY2VzLmxlbmd0aH0gbWF0Y2hlcy5gO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHdpbmRvdy5xdWVyeVJlc0Fub3JtYWxJbmRlY2F0ZXMgPSBpbmRpY2VzXG4gICAgICAgICAgICAgICAgd2luZG93LnF1ZXJ5UmVzQW5vcm1hbENsZWFuSW5kZWNhdGVzID0gY2xlYW5zSW5kaWNlc1xuXG4gICAgICAgICAgICAgICAgdGhpcy5xdWVyeUluZGljZXMgPSBpbmRpY2VzLmNvbmNhdChjbGVhbnNJbmRpY2VzKVxuXG5cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaXNBbFNlbGVjdGluZykge1xuICAgICAgICAgICAgICAgICAgdGhpcy5pc0FsU2VsZWN0aW5nID0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgd2luZG93LmlzQWRqdXN0aW5nU2VsID0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgLy8gdGhpcy5ib3VuZGluZ1NlbGVjdGlvbkJ0bi5jbGFzc0xpc3QuYWRkKCdhY3RpdmVkJylcbiAgICAgICAgICAgICAgICAgIHRoaXMucHJvamVjdG9yRXZlbnRDb250ZXh0LnNldE1vdXNlTW9kZShNb3VzZU1vZGUuQVJFQV9TRUxFQ1QpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnNjYXR0ZXJQbG90LnNldE1vdXNlTW9kZShNb3VzZU1vZGUuQVJFQV9TRUxFQ1QpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0NoZWNrQWxsUXVlcnlSZXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgdGhpcy5zaG93TW9yZVJlY29tbWVuZCA9IHRydWVcbiAgICAgICAgICAgICAgICAvLyBpZiAod2luZG93LnNlc3Npb25TdG9yYWdlLmlzQ29udHJvbEdyb3VwID09ICd0cnVlJykge1xuICAgICAgICAgICAgICAgIC8vICAgdGhpcy5zaG93TW9yZVJlY29tbWVuZCA9IGZhbHNlXG4gICAgICAgICAgICAgICAgLy8gfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyAgIHRoaXMuc2hvd01vcmVSZWNvbW1lbmQgPSB0cnVlXG4gICAgICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgICAgIHRoaXMuY2hlY2tBbGxRdWVyeVJlcyA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5xdWVyeVJlc3VsdExpc3RUaXRsZSA9ICdQb3NzaWJsZSBBYm5vcm1hbCBQb2ludCBMaXN0J1xuICAgICAgICAgICAgICAgIC8vIGxldCBkb20gPSB0aGlzLiQkKFwiI3F1ZXJ5UmVzaGVhZGVyXCIpXG5cbiAgICAgICAgICAgICAgICAvLyBkb20uaW5uZXJIVE1MID0gJ2xhYmVsJ1xuICAgICAgICAgICAgICAgIHRoaXMucHJvamVjdG9yRXZlbnRDb250ZXh0Lm5vdGlmeVNlbGVjdGlvbkNoYW5nZWQodGhpcy5xdWVyeUluZGljZXMsIGZhbHNlLCAnaXNBbm9ybWFseVF1ZXJ5Jyk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBsZXQgRFZJU2VydmVyID0gd2luZG93LnNlc3Npb25TdG9yYWdlLmlwQWRkcmVzcztcbiAgICBsZXQgYmFzZVBhdGggPSB3aW5kb3cubW9kZWxNYXRoXG4gICAgbGV0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICAgIGhlYWRlcnMuYXBwZW5kKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIGhlYWRlcnMuYXBwZW5kKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuXG4gICAgd2luZG93LnN1Z2dlc3Rpb25JbmRpY2F0ZXMgPSBbXVxuICAgIHdpbmRvdy5jaGVja2JveERvbSA9IFtdXG4gICAgd2luZG93LmFjY2VwdElucHV0TGlzdCA9IFtdXG4gICAgd2luZG93LnJlamVjdElucHV0TGlzdCA9IFtdXG4gICAgaWYgKCF3aW5kb3cuYWNjZXB0SW5kaWNhdGVzKSB7XG4gICAgICB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzID0gW11cbiAgICB9XG4gICAgaWYgKCF3aW5kb3cucmVqZWN0SW5kaWNhdGVzKSB7XG4gICAgICB3aW5kb3cucmVqZWN0SW5kaWNhdGVzID0gW11cbiAgICB9XG5cblxuICAgIGNvbnN0IHF1ZXJ5TGlzdFRhYmxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGFibGUnKTtcbiAgICBxdWVyeUxpc3RUYWJsZS5jbGFzc05hbWUgPSAncmVzVGFibGUnXG4gICAgaWYgKHRoaXMuc2hvd0NoZWNrQWxsUXVlcnlSZXMgPT09IHRydWUpIHtcbiAgICAgIHRoaXMuYWNjQWxsUmFkaW8gPSB0aGlzLiQkKCcjYWNjQWxsUmFkaW8nKSBhcyBhbnk7XG4gICAgICB0aGlzLnJlakFsbFJhZGlvID0gdGhpcy4kJCgnI3JlakFsbFJhZGlvJykgYXMgYW55O1xuICAgICAgLy8gaWYgKHRoaXMuYWNjQWxsUmFkaW8gJiYgdGhpcy5yZWpBbGxSYWRpbykge1xuICAgICAgLy8gc2V0VGltZW91dCgoKT0+e1xuICAgICAgdGhpcy5hY2NBbGxSYWRpby5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoZSkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnYWNjIGUnLCB0aGlzLmFjY0FsbFJhZGlvLmNoZWNrZWQpXG4gICAgICAgIGlmICh0aGlzLmFjY0FsbFJhZGlvLmNoZWNrZWQpIHtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGluZGljZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHdpbmRvdy5hY2NlcHRJbnB1dExpc3RbaW5kaWNlc1tpXV0uY2hlY2tlZCA9IHRydWVcbiAgICAgICAgICAgIHdpbmRvdy5yZWplY3RJbnB1dExpc3RbaW5kaWNlc1tpXV0uY2hlY2tlZCA9IGZhbHNlXG4gICAgICAgICAgICBpZiAod2luZG93LmFjY2VwdEluZGljYXRlcy5pbmRleE9mKGluZGljZXNbaV0pID09PSAtMSkge1xuICAgICAgICAgICAgICB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzLnB1c2goaW5kaWNlc1tpXSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh3aW5kb3cucmVqZWN0SW5kaWNhdGVzLmluZGV4T2YoaW5kaWNlc1tpXSkgIT09IC0xKSB7XG4gICAgICAgICAgICAgIGxldCBpbmRleCA9IHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMuaW5kZXhPZihpbmRpY2VzW2ldKVxuICAgICAgICAgICAgICB3aW5kb3cucmVqZWN0SW5kaWNhdGVzLnNwbGljZShpbmRleCwgMSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uID0gd2luZG93LnJlamVjdEluZGljYXRlcy5jb25jYXQod2luZG93LmFjY2VwdEluZGljYXRlcylcbiAgICAgICAgdGhpcy5ub2lzeUJ0bi5zdHlsZS52aXNpYmlsaXR5ID0gQm9vbGVhbih3aW5kb3cuY3VzdG9tU2VsZWN0aW9uPy5sZW5ndGgpPycnOidoaWRkZW4nXG4gICAgICAgIHRoaXMuc3RvcEJ0bi5zdHlsZS52aXNpYmlsaXR5ID0gQm9vbGVhbih3aW5kb3cuY3VzdG9tU2VsZWN0aW9uPy5sZW5ndGgpPycnOidoaWRkZW4nXG4gICAgICAgIHRoaXMudXBkYXRlU2Vzc2lvblN0b3JhZ2UoKVxuICAgICAgICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dC5yZWZyZXNoKClcbiAgICAgIH0pXG4gICAgICB0aGlzLnJlakFsbFJhZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIChlKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdyZWogZScsIHRoaXMucmVqQWxsUmFkaW8uY2hlY2tlZClcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbmRpY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgd2luZG93LmFjY2VwdElucHV0TGlzdFtpbmRpY2VzW2ldXS5jaGVja2VkID0gZmFsc2VcbiAgICAgICAgICB3aW5kb3cucmVqZWN0SW5wdXRMaXN0W2luZGljZXNbaV1dLmNoZWNrZWQgPSB0cnVlXG4gICAgICAgICAgaWYgKHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMuaW5kZXhPZihpbmRpY2VzW2ldKSA9PT0gLTEpIHtcbiAgICAgICAgICAgIHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMucHVzaChpbmRpY2VzW2ldKVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAod2luZG93LmFjY2VwdEluZGljYXRlcy5pbmRleE9mKGluZGljZXNbaV0pICE9PSAtMSkge1xuICAgICAgICAgICAgbGV0IGluZGV4ID0gd2luZG93LmFjY2VwdEluZGljYXRlcy5pbmRleE9mKGluZGljZXNbaV0pXG4gICAgICAgICAgICB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzLnNwbGljZShpbmRleCwgMSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgd2luZG93LmN1c3RvbVNlbGVjdGlvbiA9IHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMuY29uY2F0KHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMpXG4gICAgICAgIHRoaXMubm9pc3lCdG4uc3R5bGUudmlzaWJpbGl0eSA9IEJvb2xlYW4od2luZG93LmN1c3RvbVNlbGVjdGlvbj8ubGVuZ3RoKT8nJzonaGlkZGVuJ1xuICAgICAgICB0aGlzLnN0b3BCdG4uc3R5bGUudmlzaWJpbGl0eSA9IEJvb2xlYW4od2luZG93LmN1c3RvbVNlbGVjdGlvbj8ubGVuZ3RoKT8nJzonaGlkZGVuJ1xuICAgICAgICB0aGlzLnVwZGF0ZVNlc3Npb25TdG9yYWdlKClcbiAgICAgICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQucmVmcmVzaCgpXG4gICAgICB9KVxuICAgICAgLy8gfSlcblxuICAgICAgLy8gfVxuICAgIH1cbiAgICBpZiAoaW5kaWNlcy5sZW5ndGggPiAyMDAwKSB7XG4gICAgICBpbmRpY2VzLmxlbmd0aCA9IDIwMDBcbiAgICB9XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbmRpY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpbmRleCA9IGluZGljZXNbaV07XG4gICAgICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0aCcpO1xuICAgICAgcm93LmNsYXNzTmFtZSA9ICdyb3cnO1xuXG4gICAgICAvLyBjb25zdCByb3dMaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgICAgLy8gcm93TGluay5jbGFzc05hbWUgPSAnbGFiZWwnO1xuICAgICAgLy8gcm93TGluay50aXRsZSA9IGxhYmVsO1xuICAgICAgLy8gcm93TGluay5pbm5lckhUTUwgPSBsYWJlbDtcbiAgICAgIHJvdy5vbm1vdXNlZW50ZXIgPSAoKSA9PiB7XG4gICAgICAgIHRoaXMucHJvamVjdG9yRXZlbnRDb250ZXh0Lm5vdGlmeUhvdmVyT3ZlclBvaW50KGluZGV4KTtcbiAgICAgIH07XG4gICAgICByb3cub25tb3VzZWxlYXZlID0gKCkgPT4ge1xuICAgICAgICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dC5ub3RpZnlIb3Zlck92ZXJQb2ludChudWxsKTtcbiAgICAgIH07XG4gICAgICBpZiAodGhpcy5zaG93Q2hlY2tBbGxRdWVyeVJlcyA9PT0gdHJ1ZSkge1xuXG4gICAgICAgIC8vIGxldCBpbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgICAgIC8vIGlucHV0LnR5cGUgPSAnY2hlY2tib3gnXG4gICAgICAgIC8vIGlucHV0LnNldEF0dHJpYnV0ZSgnaWQnLCBgcmVzQ2hlY2tib3gke2luZGljZXNbaV19YClcbiAgICAgICAgLy8gaWYgKCF3aW5kb3cuY2hlY2tib3hEb20pIHtcbiAgICAgICAgLy8gICB3aW5kb3cuY2hlY2tib3hEb20gPSBbXVxuICAgICAgICAvLyB9XG4gICAgICAgIC8vIHdpbmRvdy5jaGVja2JveERvbVtpbmRpY2VzW2ldXSA9IGlucHV0XG4gICAgICAgIC8vIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIChlKSA9PiB7XG4gICAgICAgIC8vICAgaWYgKCF3aW5kb3cuY3VzdG9tU2VsZWN0aW9uKSB7XG4gICAgICAgIC8vICAgICB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uID0gW11cbiAgICAgICAgLy8gICB9XG4gICAgICAgIC8vICAgaWYgKGlucHV0LmNoZWNrZWQpIHtcbiAgICAgICAgLy8gICAgIGlmICh3aW5kb3cuY3VzdG9tU2VsZWN0aW9uLmluZGV4T2YoaW5kaWNlc1tpXSkgPT09IC0xKSB7XG4gICAgICAgIC8vICAgICAgIHdpbmRvdy5jdXN0b21TZWxlY3Rpb24ucHVzaChpbmRpY2VzW2ldKVxuICAgICAgICAvLyAgICAgICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dC5yZWZyZXNoKClcbiAgICAgICAgLy8gICAgIH1cbiAgICAgICAgLy8gICB9IGVsc2Uge1xuICAgICAgICAvLyAgICAgbGV0IGluZGV4ID0gd2luZG93LmN1c3RvbVNlbGVjdGlvbi5pbmRleE9mKGluZGljZXNbaV0pXG4gICAgICAgIC8vICAgICB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uLnNwbGljZShpbmRleCwgMSlcbiAgICAgICAgLy8gICAgIHRoaXMucHJvamVjdG9yRXZlbnRDb250ZXh0LnJlZnJlc2goKVxuICAgICAgICAvLyAgIH1cbiAgICAgICAgLy8gICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dC5ub3RpZnlIb3Zlck92ZXJQb2ludChpbmRpY2VzW2ldKTtcbiAgICAgICAgLy8gfSlcblxuICAgICAgICAvLyBpZiAod2luZG93LmN1c3RvbVNlbGVjdGlvbi5pbmRleE9mKGluZGljZXNbaV0pICE9PSAtMSAmJiAhaW5wdXQuY2hlY2tlZCkge1xuICAgICAgICAvLyAgIGlucHV0LmNoZWNrZWQgPSB0cnVlXG4gICAgICAgIC8vIH1cbiAgICAgICAgLy8gbGV0IG5ld3RkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGQnKVxuICAgICAgICAvLyBpZih3aW5kb3cucXVlcnlSZXNBbm9ybWFsQ2xlYW5JbmRlY2F0ZXMgJiYgd2luZG93LnF1ZXJ5UmVzQW5vcm1hbENsZWFuSW5kZWNhdGVzLmluZGV4T2YoaW5kZXgpIT09LTEpe1xuICAgICAgICAvLyAgIGlucHV0LmRpc2FibGVkID0gdHJ1ZVxuICAgICAgICAvLyAgIGlucHV0LnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJ1xuICAgICAgICAvLyB9XG4gICAgICAgIC8vIG5ld3RkLmFwcGVuZENoaWxkKGlucHV0KVxuICAgICAgICAvLyBuZXd0ZC5jbGFzc05hbWUgPSAnaW5wdXRDb2x1bW4nXG4gICAgICAgIC8vIG5ld3RkLmFwcGVuZENoaWxkKGlucHV0KVxuICAgICAgICAvLyByb3cuYXBwZW5kQ2hpbGQobmV3dGQpXG5cbiAgICAgICAgbGV0IG5ld2FjY3RkOiBhbnkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZCcpXG4gICAgICAgIGxldCBhY2NJbnB1dDogYW55ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICAgICAgYWNjSW5wdXQuc2V0QXR0cmlidXRlKCduYW1lJywgYG9wJHtpbmRleH1gKVxuICAgICAgICBhY2NJbnB1dC5zZXRBdHRyaWJ1dGUoJ2lkJywgYGFjY2VwdCR7aW5kZXh9YClcbiAgICAgICAgYWNjSW5wdXQuc2V0QXR0cmlidXRlKCd0eXBlJywgYHJhZGlvYClcbiAgICAgICAgYWNjSW5wdXQuY2xhc3NOYW1lID0gJ2lucHV0Q29sdW1uJztcbiAgICAgICAgYWNjSW5wdXQuc2V0QXR0cmlidXRlKCd2YWx1ZScsIGBhY2NlcHRgKVxuICAgICAgICB3aW5kb3cuYWNjZXB0SW5wdXRMaXN0W2luZGljZXNbaV1dID0gYWNjSW5wdXRcbiAgICAgICAgbmV3YWNjdGQuYXBwZW5kKGFjY0lucHV0KVxuICAgICAgICBpZiAod2luZG93LnF1ZXJ5UmVzQW5vcm1hbENsZWFuSW5kZWNhdGVzICYmIHdpbmRvdy5xdWVyeVJlc0Fub3JtYWxDbGVhbkluZGVjYXRlcy5pbmRleE9mKGluZGV4KSAhPT0gLTEpIHtcbiAgICAgICAgICBsZXQgc3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgICBzcGFuLmlubmVyVGV4dCA9IFwiIFwiXG4gICAgICAgICAgbGV0IG5ld3RkOiBhbnkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZCcpXG4gICAgICAgICAgbmV3dGQuc3R5bGUud2lkdGggPSBcIjUwcHhcIlxuICAgICAgICAgIG5ld3RkLmFwcGVuZChzcGFuKVxuXG4gICAgICAgICAgcm93LmFwcGVuZENoaWxkKG5ld3RkKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJvdy5hcHBlbmRDaGlsZChuZXdhY2N0ZClcbiAgICAgICAgfVxuXG5cblxuICAgICAgICBhY2NJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgKGU6IGFueSkgPT4ge1xuICAgICAgICAgIGlmIChhY2NJbnB1dC5jaGVja2VkKSB7XG4gICAgICAgICAgICAvLyBhY2NJbnB1dC5wcm9wKFwiY2hlY2tlZFwiLCBmYWxzZSk7XG4gICAgICAgICAgICBhY2NJbnB1dC5jaGVja2VkID0gZmFsc2VcbiAgICAgICAgICAgIHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMuc3BsaWNlKHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMuaW5kZXhPZihpbmRleCksIDEpXG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGlmKG5ld2FjY3RkLilcbiAgICAgICAgfSlcbiAgICAgICAgYWNjSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuXG5cbiAgICAgICAgICBpZiAoYWNjSW5wdXQuY2hlY2tlZCkge1xuICAgICAgICAgICAgaWYgKHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMuaW5kZXhPZihpbmRleCkgPT09IC0xKSB7XG4gICAgICAgICAgICAgIHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMucHVzaChpbmRleClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh3aW5kb3cucmVqZWN0SW5kaWNhdGVzLmluZGV4T2YoaW5kZXgpICE9PSAtMSkge1xuICAgICAgICAgICAgICB3aW5kb3cucmVqZWN0SW5kaWNhdGVzLnNwbGljZSh3aW5kb3cucmVqZWN0SW5kaWNhdGVzLmluZGV4T2YoaW5kZXgpLCAxKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5hY2NBbGxSYWRpby5jaGVja2VkID0gZmFsc2VcbiAgICAgICAgICAgIHRoaXMucmVqQWxsUmFkaW8uY2hlY2tlZCA9IGZhbHNlXG5cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMuaW5kZXhPZihpbmRleCkgIT09IC0xKSB7XG4gICAgICAgICAgICAgIHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMuc3BsaWNlKHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMuaW5kZXhPZihpbmRleCksIDEpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHdpbmRvdy5jdXN0b21TZWxlY3Rpb24gPSB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzLmNvbmNhdCh3aW5kb3cucmVqZWN0SW5kaWNhdGVzKVxuICAgICAgICAgIHRoaXMubm9pc3lCdG4uc3R5bGUudmlzaWJpbGl0eSA9IEJvb2xlYW4od2luZG93LmN1c3RvbVNlbGVjdGlvbj8ubGVuZ3RoKT8nJzonaGlkZGVuJ1xuICAgICAgICAgIHRoaXMuc3RvcEJ0bi5zdHlsZS52aXNpYmlsaXR5ID0gQm9vbGVhbih3aW5kb3cuY3VzdG9tU2VsZWN0aW9uPy5sZW5ndGgpPycnOidoaWRkZW4nXG4gICAgICAgICAgdGhpcy51cGRhdGVTZXNzaW9uU3RvcmFnZSgpXG4gICAgICAgICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQucmVmcmVzaCgpXG4gIFxuICAgICAgICB9KVxuXG5cbiAgICAgICAgbGV0IG5ld3JlanRkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGQnKVxuICAgICAgICBsZXQgcmVqZWN0SW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgICAgICB3aW5kb3cucmVqZWN0SW5wdXRMaXN0W2luZGljZXNbaV1dID0gcmVqZWN0SW5wdXRcbiAgICAgICAgcmVqZWN0SW5wdXQuc2V0QXR0cmlidXRlKCd0eXBlJywgYHJhZGlvYClcbiAgICAgICAgcmVqZWN0SW5wdXQuc2V0QXR0cmlidXRlKCduYW1lJywgYG9wJHtpbmRleH1gKVxuICAgICAgICBhY2NJbnB1dC5zZXRBdHRyaWJ1dGUoJ2lkJywgYHJlamVjdCR7aW5kZXh9YClcbiAgICAgICAgcmVqZWN0SW5wdXQuc2V0QXR0cmlidXRlKCd2YWx1ZScsIGByZWplY3RgKVxuICAgICAgICBuZXdyZWp0ZC5hcHBlbmQocmVqZWN0SW5wdXQpXG4gICAgICAgIGlmICh3aW5kb3cucXVlcnlSZXNBbm9ybWFsQ2xlYW5JbmRlY2F0ZXMgJiYgd2luZG93LnF1ZXJ5UmVzQW5vcm1hbENsZWFuSW5kZWNhdGVzLmluZGV4T2YoaW5kZXgpICE9PSAtMSkge1xuICAgICAgICAgIGxldCBzcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgICAgIHNwYW4uaW5uZXJUZXh0ID0gXCIgIFwiXG4gICAgICAgICAgbGV0IG5ld3RkOiBhbnkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZCcpXG4gICAgICAgICAgbmV3dGQuc3R5bGUud2lkdGggPSBcIjUwcHhcIlxuICAgICAgICAgIG5ld3RkLmFwcGVuZChzcGFuKVxuICAgICAgICAgIHJvdy5hcHBlbmRDaGlsZChuZXd0ZClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByb3cuYXBwZW5kQ2hpbGQobmV3cmVqdGQpXG4gICAgICAgIH1cblxuXG4gICAgICAgIHJlamVjdElucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgICAgICBpZiAocmVqZWN0SW5wdXQuY2hlY2tlZCkge1xuICAgICAgICAgICAgaWYgKHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMuaW5kZXhPZihpbmRleCkgPT09IC0xKSB7XG4gICAgICAgICAgICAgIHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMucHVzaChpbmRleClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh3aW5kb3cuYWNjZXB0SW5kaWNhdGVzLmluZGV4T2YoaW5kZXgpICE9PSAtMSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyh3aW5kb3cuYWNjZXB0SW5kaWNhdGVzLmluZGV4T2YoaW5kZXgpKVxuICAgICAgICAgICAgICB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzLnNwbGljZSh3aW5kb3cuYWNjZXB0SW5kaWNhdGVzLmluZGV4T2YoaW5kZXgpLCAxKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5hY2NBbGxSYWRpby5jaGVja2VkID0gZmFsc2VcbiAgICAgICAgICAgIHRoaXMucmVqQWxsUmFkaW8uY2hlY2tlZCA9IGZhbHNlXG5cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMuaW5kZXhPZihpbmRleCkgIT09IC0xKSB7XG4gICAgICAgICAgICAgIHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMuc3BsaWNlKHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMuaW5kZXhPZihpbmRleCksIDEpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHdpbmRvdy5jdXN0b21TZWxlY3Rpb24gPSB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzLmNvbmNhdCh3aW5kb3cucmVqZWN0SW5kaWNhdGVzKVxuICAgICAgICAgIHRoaXMubm9pc3lCdG4uc3R5bGUudmlzaWJpbGl0eSA9IEJvb2xlYW4od2luZG93LmN1c3RvbVNlbGVjdGlvbj8ubGVuZ3RoKT8nJzonaGlkZGVuJ1xuICAgICAgICAgIHRoaXMuc3RvcEJ0bi5zdHlsZS52aXNpYmlsaXR5ID0gQm9vbGVhbih3aW5kb3cuY3VzdG9tU2VsZWN0aW9uPy5sZW5ndGgpPycnOidoaWRkZW4nXG4gICAgICAgICAgdGhpcy51cGRhdGVTZXNzaW9uU3RvcmFnZSgpXG4gICAgICAgICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQucmVmcmVzaCgpXG4gICAgICAgIH0pXG5cbiAgICAgICAgLy8gcm93LmFwcGVuZENoaWxkKGlucHV0KTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGxhYmVsID0gdGhpcy5nZXRMYWJlbEZyb21JbmRleChpbmRleCk7XG4gICAgICBsZXQgYXJyID0gbGFiZWwuc3BsaXQoXCJ8XCIpXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICBsZXQgbmV3dGQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZCcpO1xuICAgICAgICBuZXd0ZC5jbGFzc05hbWUgPSAncXVlcnlSZXNDb2x1bW4nO1xuICAgICAgICBuZXd0ZC5pbm5lclRleHQgPSBhcnJbaV1cbiAgICAgICAgcm93LmFwcGVuZENoaWxkKG5ld3RkKVxuICAgICAgfVxuXG5cbiAgICAgIHJvdy5vbm1vdXNlZW50ZXIgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IGZldGNoKGBodHRwOi8vJHtEVklTZXJ2ZXJ9L3Nwcml0ZT9pbmRleD0ke2luZGljZXNbaV19JnBhdGg9JHtiYXNlUGF0aH0mdXNlcm5hbWU9JHt3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudXNlcm5hbWV9YCwge1xuICAgICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgICAgbW9kZTogJ2NvcnMnXG4gICAgICAgIH0pLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKS50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwicmVzcG9uc2VcIiwgZGF0YSk7XG4gICAgICAgICAgbGV0IGltZ3NyYyA9IGRhdGEuaW1nVXJsO1xuICAgICAgICAgIC8vIHRoaXMucHJvamVjdG9yRXZlbnRDb250ZXh0LnVwZGF0ZU1ldGFEYXRhQnlJbmRpY2VzKGluZGljZXNbaV0sIGltZ3NyYylcbiAgICAgICAgICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dC5ub3RpZnlIb3Zlck92ZXJQb2ludChpbmRleCk7XG4gICAgICAgICAgLy8gbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UobnVsbCwgbXNnSWQpO1xuICAgICAgICB9KS5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJlcnJvclwiLCBlcnJvcik7XG4gICAgICAgIH0pO1xuXG4gICAgICB9O1xuICAgICAgcm93Lm9ubW91c2VsZWF2ZSA9ICgpID0+IHtcbiAgICAgICAgLy8gdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQudXBkYXRlTWV0YURhdGFCeUluZGljZXMoLTEsICcnKVxuICAgICAgICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dC5ub3RpZnlIb3Zlck92ZXJQb2ludChudWxsKTtcbiAgICAgIH07XG5cbiAgICAgIHJvdy5jbGFzc05hbWUgPSAncm93LWltZyc7XG4gICAgICAvLyByb3cuYXBwZW5kQ2hpbGQocm93TGluayk7XG4gICAgICBxdWVyeUxpc3RUYWJsZS5hcHBlbmRDaGlsZChyb3cpXG4gICAgICBsaXN0LmFwcGVuZENoaWxkKHF1ZXJ5TGlzdFRhYmxlKTtcbiAgICB9XG4gIH1cbiAgdXBkYXRlU2Vzc2lvblN0b3JhZ2UoKSB7XG4gICAgY29uc29sZS5sb2coJ3VwZGF0ZSBzZXNzaW9uJylcbiAgICB3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbSgnYWNjZXB0SW5kaWNhdGVzJywgd2luZG93LmFjY2VwdEluZGljYXRlcy5qb2luKFwiLFwiKSlcbiAgICB3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbSgncmVqZWN0SW5kaWNhdGVzJywgd2luZG93LnJlamVjdEluZGljYXRlcy5qb2luKFwiLFwiKSlcbiAgICB3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbSgnY3VzdG9tU2VsZWN0aW9uJywgd2luZG93LmN1c3RvbVNlbGVjdGlvbi5qb2luKFwiLFwiKSlcbiAgfVxuICBwcml2YXRlIGdldExhYmVsRnJvbUluZGV4KHBvaW50SW5kZXg6IG51bWJlcik6IHN0cmluZyB7XG4gICAgaWYgKCF3aW5kb3cuZmxhZ2luZGVjYXRlc0xpc3QpIHtcbiAgICAgIHdpbmRvdy5mbGFnaW5kZWNhdGVzTGlzdCA9IFtdXG4gICAgfVxuICAgIGNvbnN0IG1ldGFkYXRhID0gdGhpcy5wcm9qZWN0b3IuZGF0YVNldC5wb2ludHNbcG9pbnRJbmRleF0/Lm1ldGFkYXRhW1xuICAgICAgdGhpcy5zZWxlY3RlZE1ldGFkYXRhRmllbGRcbiAgICBdO1xuICAgIGxldCBwcmVkaWN0aW9uID0gdGhpcy5wcm9qZWN0b3IuZGF0YVNldC5wb2ludHNbcG9pbnRJbmRleF0/LmN1cnJlbnRfcHJlZGljdGlvbjtcbiAgICBpZiAocHJlZGljdGlvbiA9PSB1bmRlZmluZWQpIHtcbiAgICAgIHByZWRpY3Rpb24gPSBgVW5rbm93bmA7XG4gICAgfVxuXG4gICAgbGV0IG9yaWdpbmFsX2xhYmVsID0gdGhpcy5wcm9qZWN0b3IuZGF0YVNldC5wb2ludHNbcG9pbnRJbmRleF0/Lm9yaWdpbmFsX2xhYmVsO1xuICAgIGlmIChvcmlnaW5hbF9sYWJlbCA9PSB1bmRlZmluZWQpIHtcbiAgICAgIG9yaWdpbmFsX2xhYmVsID0gYFVua25vd25gO1xuICAgIH1cbiAgICBsZXQgaW5kZXggPSB3aW5kb3cucXVlcnlSZXNQb2ludEluZGljZXM/LmluZGV4T2YocG9pbnRJbmRleClcblxuICAgIGxldCBzdWdnZXN0X2xhYmVsID0gdGhpcy5sYWJlbE1hcFt3aW5kb3cuYWxTdWdnZXN0TGFiZWxMaXN0W2luZGV4XV1cblxuXG4gICAgaWYgKG9yaWdpbmFsX2xhYmVsID09IHVuZGVmaW5lZCkge1xuICAgICAgb3JpZ2luYWxfbGFiZWwgPSBgVW5rbm93bmA7XG4gICAgfVxuICAgIGxldCBzY29yZSA9IHdpbmRvdy5hbFN1Z2dlc3RTY29yZUxpc3RbaW5kZXhdPy50b0ZpeGVkKDMpXG4gICAgY29uc3Qgc3RyaW5nTWV0YURhdGEgPSBtZXRhZGF0YSAhPT0gdW5kZWZpbmVkID8gU3RyaW5nKG1ldGFkYXRhKSA6IGBVbmtub3duICMke3BvaW50SW5kZXh9YDtcblxuICAgIGNvbnN0IGRpc3BsYXlwcmVkaWN0aW9uID0gcHJlZGljdGlvblxuICAgIGNvbnN0IGRpc3BsYXlTdHJpbmdNZXRhRGF0YSA9IHN0cmluZ01ldGFEYXRhXG5cbiAgICBjb25zdCBkaXNwbGF5UG9pbnRJbmRleCA9IFN0cmluZyhwb2ludEluZGV4KVxuICAgIC8vIHJldHVybiBTdHJpbmcocG9pbnRJbmRleCkgKyBcIkxhYmVsOiBcIiArIHN0cmluZ01ldGFEYXRhICsgXCIgUHJlZGljdGlvbjogXCIgKyBwcmVkaWN0aW9uICsgXCIgT3JpZ2luYWwgbGFiZWw6IFwiICsgb3JpZ2luYWxfbGFiZWw7XG4gICAgbGV0IHByZWRpY3Rpb25fcmVzID0gc3VnZ2VzdF9sYWJlbCA9PT0gcHJlZGljdGlvbiB8fCB3aW5kb3cuYWxTdWdnZXN0TGFiZWxMaXN0Lmxlbmd0aCA9PT0gMCA/ICcgLSAnIDogJyDinZfvuI8gJ1xuICAgIGlmICh3aW5kb3cucXVlcnlSZXNBbm9ybWFsQ2xlYW5JbmRlY2F0ZXMgJiYgd2luZG93LnF1ZXJ5UmVzQW5vcm1hbENsZWFuSW5kZWNhdGVzLmluZGV4T2YocG9pbnRJbmRleCkgIT09IC0xKSB7XG4gICAgICByZXR1cm4gYCR7ZGlzcGxheVBvaW50SW5kZXh9fCR7ZGlzcGxheVN0cmluZ01ldGFEYXRhfXwgbWFqb3JpdHlgXG4gICAgfVxuICAgIGlmICh3aW5kb3cucXVlcnlSZXNBbm9ybWFsSW5kZWNhdGVzICYmIHdpbmRvdy5xdWVyeVJlc0Fub3JtYWxJbmRlY2F0ZXMuaW5kZXhPZihwb2ludEluZGV4KSAhPT0gLTEpIHtcbiAgICAgIGxldCBwcmVkaWN0aW9uX3JlcyA9IHN1Z2dlc3RfbGFiZWwgPT09IGRpc3BsYXlTdHJpbmdNZXRhRGF0YSA/ICcgLSAnIDogJyDinZfvuI8gJ1xuXG4gICAgICBpZiAod2luZG93LnNlc3Npb25TdG9yYWdlLmlzQ29udHJvbEdyb3VwID09ICd0cnVlJykge1xuICAgICAgICByZXR1cm4gYCR7ZGlzcGxheVBvaW50SW5kZXh9fCR7ZGlzcGxheXByZWRpY3Rpb259fCR7c2NvcmUgIT09IHVuZGVmaW5lZCA/IHNjb3JlIDogJy0nfWBcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChwcmVkaWN0aW9uX3JlcyAhPT0gXCIgLSBcIikge1xuICAgICAgICAgIGlmICh3aW5kb3cuZmxhZ2luZGVjYXRlc0xpc3QuaW5kZXhPZihwb2ludEluZGV4KSA9PT0gLTEpIHtcbiAgICAgICAgICAgIHdpbmRvdy5mbGFnaW5kZWNhdGVzTGlzdC5wdXNoKHBvaW50SW5kZXgpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIHJldHVybiBgJHtkaXNwbGF5UG9pbnRJbmRleH18JHtkaXNwbGF5U3RyaW5nTWV0YURhdGF9fCR7cHJlZGljdGlvbl9yZXN9fCR7c2NvcmUgIT09IHVuZGVmaW5lZCA/IHNjb3JlIDogJy0nfWBcbiAgICAgICAgcmV0dXJuIGAke2Rpc3BsYXlQb2ludEluZGV4fXwke2Rpc3BsYXlwcmVkaWN0aW9ufXwke3Njb3JlICE9PSB1bmRlZmluZWQgPyBzY29yZSA6ICctJ31gXG4gICAgICB9XG5cbiAgICB9XG4gICAgaWYgKHRoaXMuc2hvd0NoZWNrQWxsUXVlcnlSZXMgPT0gZmFsc2UpIHtcbiAgICAgIGlmICh3aW5kb3cuc2Vzc2lvblN0b3JhZ2UuaXNDb250cm9sR3JvdXAgPT0gJ3RydWUnKSB7XG4gICAgICAgIHJldHVybiBgJHtkaXNwbGF5UG9pbnRJbmRleH18JHtkaXNwbGF5cHJlZGljdGlvbn1gXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocHJlZGljdGlvbl9yZXMgIT09IFwiIC0gXCIpIHtcbiAgICAgICAgICBpZiAod2luZG93LmZsYWdpbmRlY2F0ZXNMaXN0LmluZGV4T2YocG9pbnRJbmRleCkgPT09IC0xKSB7XG4gICAgICAgICAgICB3aW5kb3cuZmxhZ2luZGVjYXRlc0xpc3QucHVzaChwb2ludEluZGV4KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYCR7ZGlzcGxheVBvaW50SW5kZXh9fCR7ZGlzcGxheXByZWRpY3Rpb259YFxuICAgICAgfVxuICAgIH1cbiAgICBpZiAod2luZG93LnNlc3Npb25TdG9yYWdlLmlzQ29udHJvbEdyb3VwID09ICd0cnVlJykge1xuICAgICAgcmV0dXJuIGAke2Rpc3BsYXlQb2ludEluZGV4fXwke2Rpc3BsYXlwcmVkaWN0aW9ufXwke3Njb3JlICE9PSB1bmRlZmluZWQgPyBzY29yZSA6ICctJ31gXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChwcmVkaWN0aW9uX3JlcyAhPT0gXCIgLSBcIikge1xuICAgICAgICBpZiAod2luZG93LmZsYWdpbmRlY2F0ZXNMaXN0LmluZGV4T2YocG9pbnRJbmRleCkgPT09IC0xKSB7XG4gICAgICAgICAgd2luZG93LmZsYWdpbmRlY2F0ZXNMaXN0LnB1c2gocG9pbnRJbmRleClcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gcmV0dXJuIGAke2Rpc3BsYXlQb2ludEluZGV4fXwke2Rpc3BsYXlwcmVkaWN0aW9ufXwke3ByZWRpY3Rpb25fcmVzfXwke3Njb3JlICE9PSB1bmRlZmluZWQgPyBzY29yZSA6ICctJ31gXG4gICAgICByZXR1cm4gYCR7ZGlzcGxheVBvaW50SW5kZXh9fCR7ZGlzcGxheXByZWRpY3Rpb259fCR7c2NvcmUgIT09IHVuZGVmaW5lZCA/IHNjb3JlIDogJy0nfWBcbiAgICB9XG4gIH1cbiAgcHJpdmF0ZSBnZXRubkxhYmVsRnJvbUluZGV4KHBvaW50SW5kZXg6IG51bWJlcik6IHN0cmluZyB7XG4gICAgY29uc3QgbWV0YWRhdGEgPSB0aGlzLnByb2plY3Rvci5kYXRhU2V0LnBvaW50c1twb2ludEluZGV4XS5tZXRhZGF0YVtcbiAgICAgIHRoaXMuc2VsZWN0ZWRNZXRhZGF0YUZpZWxkXG4gICAgXTtcbiAgICBsZXQgcHJlZGljdGlvbiA9IHRoaXMucHJvamVjdG9yLmRhdGFTZXQucG9pbnRzW3BvaW50SW5kZXhdPy5jdXJyZW50X3ByZWRpY3Rpb247XG4gICAgaWYgKHByZWRpY3Rpb24gPT0gdW5kZWZpbmVkKSB7XG4gICAgICBwcmVkaWN0aW9uID0gYFVua25vd25gO1xuICAgIH1cbiAgICBsZXQgb3JpZ2luYWxfbGFiZWwgPSB0aGlzLnByb2plY3Rvci5kYXRhU2V0LnBvaW50c1twb2ludEluZGV4XS5vcmlnaW5hbF9sYWJlbDtcbiAgICBpZiAob3JpZ2luYWxfbGFiZWwgPT0gdW5kZWZpbmVkKSB7XG4gICAgICBvcmlnaW5hbF9sYWJlbCA9IGBVbmtub3duYDtcbiAgICB9XG4gICAgaWYgKG9yaWdpbmFsX2xhYmVsID09IHVuZGVmaW5lZCkge1xuICAgICAgb3JpZ2luYWxfbGFiZWwgPSBgVW5rbm93bmA7XG4gICAgfVxuICAgIGNvbnN0IHN0cmluZ01ldGFEYXRhID0gbWV0YWRhdGEgIT09IHVuZGVmaW5lZCA/IFN0cmluZyhtZXRhZGF0YSkgOiBgVW5rbm93biAjJHtwb2ludEluZGV4fWA7XG4gICAgY29uc3QgZGlzcGxheXByZWRpY3Rpb24gPSBwcmVkaWN0aW9uXG4gICAgY29uc3QgZGlzcGxheVN0cmluZ01ldGFEYXRhID0gc3RyaW5nTWV0YURhdGFcbiAgICBjb25zdCBkaXNwbGF5UG9pbnRJbmRleCA9IFN0cmluZyhwb2ludEluZGV4KVxuICAgIC8vIHJldHVybiBTdHJpbmcocG9pbnRJbmRleCkgKyBcIkxhYmVsOiBcIiArIHN0cmluZ01ldGFEYXRhICsgXCIgUHJlZGljdGlvbjogXCIgKyBwcmVkaWN0aW9uICsgXCIgT3JpZ2luYWwgbGFiZWw6IFwiICsgb3JpZ2luYWxfbGFiZWw7XG4gICAgbGV0IHByZWRpY3Rpb25fcmVzID0gc3RyaW5nTWV0YURhdGEgPT09IHByZWRpY3Rpb24gPyAnIC0gJyA6ICcg4p2X77iPICdcbiAgICByZXR1cm4gYGluZGV4OiR7ZGlzcGxheVBvaW50SW5kZXh9IHwgbGFiZWw6JHtkaXNwbGF5U3RyaW5nTWV0YURhdGF9fCBwcmVkaWN0aW9uOiR7ZGlzcGxheXByZWRpY3Rpb259IHwgJHtwcmVkaWN0aW9uX3Jlc31gXG4gIH1cbiAgcHJpdmF0ZSBzcHJpdGVJbWFnZVJlbmRlcmVyKCkge1xuICAgIGNvbnN0IHNwcml0ZUltYWdlUGF0aCA9IHRoaXMuc3ByaXRlTWV0YS5pbWFnZVBhdGg7XG4gICAgY29uc3QgeyBhc3BlY3RSYXRpbywgbkNvbHMgfSA9IHRoaXMuc3ByaXRlTWV0YSBhcyBhbnk7XG4gICAgY29uc3QgcGFkZGluZ0JvdHRvbSA9IDEwMCAvIGFzcGVjdFJhdGlvICsgJyUnO1xuICAgIGNvbnN0IGJhY2tncm91bmRTaXplID0gYCR7bkNvbHMgKiAxMDB9JSAke25Db2xzICogMTAwfSVgO1xuICAgIGNvbnN0IGJhY2tncm91bmRJbWFnZSA9IGB1cmwoJHtDU1MuZXNjYXBlKHNwcml0ZUltYWdlUGF0aCl9KWA7XG4gICAgcmV0dXJuIChuZWlnaGJvcjoga25uLk5lYXJlc3RFbnRyeSk6IEhUTUxFbGVtZW50ID0+IHtcbiAgICAgIGNvbnN0IHNwcml0ZUVsZW1lbnRJbWFnZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgc3ByaXRlRWxlbWVudEltYWdlLmNsYXNzTmFtZSA9ICdzcHJpdGUtaW1hZ2UnO1xuICAgICAgc3ByaXRlRWxlbWVudEltYWdlLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9IGJhY2tncm91bmRJbWFnZTtcbiAgICAgIHNwcml0ZUVsZW1lbnRJbWFnZS5zdHlsZS5wYWRkaW5nQm90dG9tID0gcGFkZGluZ0JvdHRvbTtcbiAgICAgIHNwcml0ZUVsZW1lbnRJbWFnZS5zdHlsZS5iYWNrZ3JvdW5kU2l6ZSA9IGJhY2tncm91bmRTaXplO1xuICAgICAgY29uc3QgW3JvdywgY29sXSA9IFtcbiAgICAgICAgTWF0aC5mbG9vcihuZWlnaGJvci5pbmRleCAvIG5Db2xzKSxcbiAgICAgICAgbmVpZ2hib3IuaW5kZXggJSBuQ29scyxcbiAgICAgIF07XG4gICAgICBjb25zdCBbdG9wLCBsZWZ0XSA9IFtcbiAgICAgICAgKHJvdyAvIChuQ29scyAtIDEpKSAqIDEwMCxcbiAgICAgICAgKGNvbCAvIChuQ29scyAtIDEpKSAqIDEwMCxcbiAgICAgIF07XG4gICAgICBzcHJpdGVFbGVtZW50SW1hZ2Uuc3R5bGUuYmFja2dyb3VuZFBvc2l0aW9uID0gYCR7bGVmdH0lICR7dG9wfSVgO1xuICAgICAgcmV0dXJuIHNwcml0ZUVsZW1lbnRJbWFnZTtcbiAgICB9O1xuICB9XG4gIHVwZGF0ZUN1cnJlbnRQbGF5RXBvY2gobnVtOiBudW1iZXIpIHtcbiAgICB0aGlzLmN1cnJlbnRQbGF5ZWRFcG9jaCA9IG51bVxuICB9XG4gIHByaXZhdGUgdXBkYXRlTmVpZ2hib3JzTGlzdChuZWlnaGJvcnM/OiBrbm4uTmVhcmVzdEVudHJ5W10pIHtcbiAgICBuZWlnaGJvcnMgPSBuZWlnaGJvcnMgfHwgdGhpcy5fY3VycmVudE5laWdoYm9ycztcbiAgICB0aGlzLl9jdXJyZW50TmVpZ2hib3JzID0gbmVpZ2hib3JzO1xuICAgIGlmIChuZWlnaGJvcnMgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBubmxpc3QgPSB0aGlzLiQkKCcubm4tbGlzdCcpIGFzIEhUTUxEaXZFbGVtZW50O1xuICAgIG5ubGlzdC50ZXh0Q29udGVudCA9ICcnO1xuICAgIGlmIChuZWlnaGJvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLnJlbW92ZUNvbnRleHQoJy5ubicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmFkZENvbnRleHQoJy5ubicpO1xuICAgIHRoaXMuc2VhcmNoQm94Lm1lc3NhZ2UgPSAnJztcbiAgICBjb25zdCBtaW5EaXN0ID0gbmVpZ2hib3JzLmxlbmd0aCA+IDAgPyBuZWlnaGJvcnNbMF0uZGlzdCA6IDA7XG4gICAgaWYgKHRoaXMuc3ByaXRlSW1hZ2VzQXZhaWxhYmxlICYmIHRoaXMuc2hvd05laWdoYm9ySW1hZ2VzKSB7XG4gICAgICB2YXIgaW1hZ2VSZW5kZXJlciA9IHRoaXMuc3ByaXRlSW1hZ2VSZW5kZXJlcigpO1xuICAgIH1cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5laWdoYm9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgbmVpZ2hib3IgPSBuZWlnaGJvcnNbaV07XG4gICAgICBjb25zdCBuZWlnaGJvckVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIG5laWdoYm9yRWxlbWVudC5jbGFzc05hbWUgPSAnbmVpZ2hib3InO1xuICAgICAgY29uc3QgbmVpZ2hib3JFbGVtZW50TGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgIG5laWdoYm9yRWxlbWVudExpbmsuY2xhc3NOYW1lID0gJ25laWdoYm9yLWxpbmsnO1xuICAgICAgbmVpZ2hib3JFbGVtZW50TGluay50aXRsZSA9IHRoaXMuZ2V0bm5MYWJlbEZyb21JbmRleChuZWlnaGJvci5pbmRleCk7XG4gICAgICBjb25zdCBsYWJlbFZhbHVlRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgbGFiZWxWYWx1ZUVsZW1lbnQuY2xhc3NOYW1lID0gJ2xhYmVsLWFuZC12YWx1ZSc7XG4gICAgICBjb25zdCBsYWJlbEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIGxhYmVsRWxlbWVudC5jbGFzc05hbWUgPSAnbGFiZWwnO1xuICAgICAgbGFiZWxFbGVtZW50LnN0eWxlLmNvbG9yID0gZGlzdDJjb2xvcihcbiAgICAgICAgdGhpcy5kaXN0RnVuYyxcbiAgICAgICAgbmVpZ2hib3IuZGlzdCxcbiAgICAgICAgbWluRGlzdFxuICAgICAgKTtcbiAgICAgIGxhYmVsRWxlbWVudC5pbm5lclRleHQgPSB0aGlzLmdldG5uTGFiZWxGcm9tSW5kZXgobmVpZ2hib3IuaW5kZXgpO1xuICAgICAgY29uc3QgdmFsdWVFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICB2YWx1ZUVsZW1lbnQuY2xhc3NOYW1lID0gJ3ZhbHVlJztcbiAgICAgIHZhbHVlRWxlbWVudC5pbm5lclRleHQgPSB0aGlzLnByb2plY3Rvci5kYXRhU2V0LnBvaW50c1tuZWlnaGJvci5pbmRleF0/LmN1cnJlbnRfaW52X2FjYz8udG9GaXhlZCgzKTtcbiAgICAgIGxhYmVsVmFsdWVFbGVtZW50LmFwcGVuZENoaWxkKGxhYmVsRWxlbWVudCk7XG4gICAgICBsYWJlbFZhbHVlRWxlbWVudC5hcHBlbmRDaGlsZCh2YWx1ZUVsZW1lbnQpO1xuICAgICAgY29uc3QgYmFyRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgYmFyRWxlbWVudC5jbGFzc05hbWUgPSAnYmFyJztcbiAgICAgIGNvbnN0IGJhckZpbGxFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICBiYXJGaWxsRWxlbWVudC5jbGFzc05hbWUgPSAnZmlsbCc7XG4gICAgICBiYXJGaWxsRWxlbWVudC5zdHlsZS5ib3JkZXJUb3BDb2xvciA9IGRpc3QyY29sb3IoXG4gICAgICAgIHRoaXMuZGlzdEZ1bmMsXG4gICAgICAgIG5laWdoYm9yLmRpc3QsXG4gICAgICAgIG1pbkRpc3RcbiAgICAgICk7XG4gICAgICBiYXJGaWxsRWxlbWVudC5zdHlsZS53aWR0aCA9XG4gICAgICAgIG5vcm1hbGl6ZURpc3QodGhpcy5kaXN0RnVuYywgbmVpZ2hib3IuZGlzdCwgbWluRGlzdCkgKiAxMDAgKyAnJSc7XG4gICAgICBiYXJFbGVtZW50LmFwcGVuZENoaWxkKGJhckZpbGxFbGVtZW50KTtcbiAgICAgIGZvciAobGV0IGogPSAxOyBqIDwgNDsgaisrKSB7XG4gICAgICAgIGNvbnN0IHRpY2tFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIHRpY2tFbGVtZW50LmNsYXNzTmFtZSA9ICd0aWNrJztcbiAgICAgICAgdGlja0VsZW1lbnQuc3R5bGUubGVmdCA9IChqICogMTAwKSAvIDQgKyAnJSc7XG4gICAgICAgIGJhckVsZW1lbnQuYXBwZW5kQ2hpbGQodGlja0VsZW1lbnQpO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuc3ByaXRlSW1hZ2VzQXZhaWxhYmxlICYmIHRoaXMuc2hvd05laWdoYm9ySW1hZ2VzKSB7XG4gICAgICAgIGNvbnN0IG5laWdoYm9yRWxlbWVudEltYWdlID0gaW1hZ2VSZW5kZXJlcihuZWlnaGJvcik7XG4gICAgICAgIG5laWdoYm9yRWxlbWVudC5hcHBlbmRDaGlsZChuZWlnaGJvckVsZW1lbnRJbWFnZSk7XG4gICAgICB9XG4gICAgICBuZWlnaGJvckVsZW1lbnRMaW5rLmFwcGVuZENoaWxkKGxhYmVsVmFsdWVFbGVtZW50KTtcbiAgICAgIG5laWdoYm9yRWxlbWVudExpbmsuYXBwZW5kQ2hpbGQoYmFyRWxlbWVudCk7XG4gICAgICBuZWlnaGJvckVsZW1lbnQuYXBwZW5kQ2hpbGQobmVpZ2hib3JFbGVtZW50TGluayk7XG4gICAgICBubmxpc3QuYXBwZW5kQ2hpbGQobmVpZ2hib3JFbGVtZW50KTtcbiAgICAgIG5laWdoYm9yRWxlbWVudExpbmsub25tb3VzZWVudGVyID0gKCkgPT4ge1xuICAgICAgICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dC5ub3RpZnlIb3Zlck92ZXJQb2ludChuZWlnaGJvci5pbmRleCk7XG4gICAgICB9O1xuICAgICAgbmVpZ2hib3JFbGVtZW50TGluay5vbm1vdXNlbGVhdmUgPSAoKSA9PiB7XG4gICAgICAgIHRoaXMucHJvamVjdG9yRXZlbnRDb250ZXh0Lm5vdGlmeUhvdmVyT3ZlclBvaW50KG51bGwpO1xuICAgICAgfTtcbiAgICAgIG5laWdoYm9yRWxlbWVudExpbmsub25jbGljayA9ICgpID0+IHtcbiAgICAgICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQubm90aWZ5U2VsZWN0aW9uQ2hhbmdlZChbbmVpZ2hib3IuaW5kZXhdKTtcbiAgICAgIH07XG4gICAgfVxuICB9XG4gIHByaXZhdGUgdXBkYXRlRmlsdGVyQnV0dG9ucyhudW1Qb2ludHM6IG51bWJlcikge1xuICAgIGlmIChudW1Qb2ludHMpIHtcbiAgICAgIHRoaXMuc2V0RmlsdGVyQnV0dG9uLmlubmVyVGV4dCA9IGBGaWx0ZXIgJHtudW1Qb2ludHN9YDtcbiAgICAgIGlmIChudW1Qb2ludHMgPiAxKSB7XG4gICAgICAgIHRoaXMuc2V0RmlsdGVyQnV0dG9uLmRpc2FibGVkID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRoaXMuY2xlYXJTZWxlY3Rpb25CdXR0b24uZGlzYWJsZWQgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNldEZpbHRlckJ1dHRvbi5pbm5lclRleHQgPSBgRmlsdGVyIHNlbGVjdGlvbmA7XG4gICAgICB0aGlzLnNldEZpbHRlckJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgICB0aGlzLmNsZWFyU2VsZWN0aW9uQnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcHJpdmF0ZSBzZXR1cFVJKHByb2plY3RvcjogYW55KSB7XG5cbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCBpbmtUYWJzID0gdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoJy5pbmstdGFiJyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbmtUYWJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpbmtUYWJzW2ldLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBsZXQgaWQgPSB0aGlzLmdldEF0dHJpYnV0ZSgnZGF0YS10YWInKTtcbiAgICAgICAgc2VsZi5zaG93VGFiKGlkKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAod2luZG93KVxuICAgICAgaWYgKHdpbmRvdy5zZXNzaW9uU3RvcmFnZS50YXNrVHlwZSA9PT0gJ2Fub3JtYWx5IGRldGVjdGlvbicgJiYgd2luZG93LnNlc3Npb25TdG9yYWdlLmlzQ29udHJvbEdyb3VwICE9PSAndHJ1ZSdcbiAgICAgICkge1xuICAgICAgICBzZWxmLnNob3dUYWIoJ2Fub21hbHknKTtcbiAgICAgIH0gZWxzZSBpZiAod2luZG93LnNlc3Npb25TdG9yYWdlLnRhc2tUeXBlID09PSAnYWN0aXZlIGxlYXJuaW5nJykge1xuICAgICAgICBzZWxmLnNob3dUYWIoJ2FkdmFuY2VkJyk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgc2VsZi5zaG93VGFiKCdub3JtYWwnKTtcbiAgICAgICAgdGhpcy5zaG93TW9yZVJlY29tbWVuZCA9IGZhbHNlXG4gICAgICAgIC8vIHRoaXMudXBkYXRlU2VhcmNoUmVzdWx0cyhbXSk7XG4gICAgICB9XG5cblxuXG5cbiAgICB0aGlzLnF1ZXJ5QnlTdHJhdGVndEJ0bi5vbmNsaWNrID0gKCkgPT4ge1xuICAgICAgdGhpcy5xdWVyeUJ5QWwocHJvamVjdG9yLCB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzLCB3aW5kb3cucmVqZWN0SW5kaWNhdGVzLHRoaXMuYnVkZ2V0LCB0cnVlKVxuICAgIH1cblxuICAgIC8vIGlmKHRoaXMuc2hvd1NlbGVjdGlvbkJ0bil7XG4gICAgdGhpcy5zaG93U2VsZWN0aW9uQnRuLm9uY2xpY2sgPSAoKSA9PiB7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgd2luZG93LnByZXZpb3VzSW5kZWNhdGVzPy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAod2luZG93LmN1c3RvbVNlbGVjdGlvbi5pbmRleE9mKHdpbmRvdy5wcmV2aW91c0luZGVjYXRlc1tpXSkgPT09IC0xKSB7XG4gICAgICAgICAgd2luZG93LmN1c3RvbVNlbGVjdGlvbi5wdXNoKHdpbmRvdy5wcmV2aW91c0luZGVjYXRlc1tpXSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQubm90aWZ5U2VsZWN0aW9uQ2hhbmdlZCh0aGlzLnF1ZXJ5SW5kaWNlcywgZmFsc2UsICdpc1Nob3dTZWxlY3RlZCcpO1xuICAgICAgLy8gdGhpcy51cGRhdGVTZWFyY2hSZXN1bHRzKHRoaXMucXVlcnlJbmRpY2VzKVxuICAgIH1cbiAgICAvLyB9XG4gICAgdGhpcy5ub2lzeXNob3dTZWxlY3Rpb25CdG4ub25jbGljayA9ICgpID0+IHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgd2luZG93LnByZXZpb3VzSW5kZWNhdGVzPy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAod2luZG93LmN1c3RvbVNlbGVjdGlvbi5pbmRleE9mKHdpbmRvdy5wcmV2aW91c0luZGVjYXRlc1tpXSkgPT09IC0xKSB7XG4gICAgICAgICAgd2luZG93LmN1c3RvbVNlbGVjdGlvbi5wdXNoKHdpbmRvdy5wcmV2aW91c0luZGVjYXRlc1tpXSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQubm90aWZ5U2VsZWN0aW9uQ2hhbmdlZCh0aGlzLnF1ZXJ5SW5kaWNlcywgZmFsc2UsICdpc1Nob3dTZWxlY3RlZCcpO1xuICAgICAgLy8gdGhpcy51cGRhdGVTZWFyY2hSZXN1bHRzKHRoaXMucXVlcnlJbmRpY2VzKVxuICAgIH1cblxuICAgIHRoaXMucXVlcnlBbm9tYWx5QnRuLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICBwcm9qZWN0b3IucXVlcnlBbm9ybWFseVN0cmF0ZWd5KFxuICAgICAgICBOdW1iZXIodGhpcy5hbm9tYWx5UmVjTnVtKSwgdGhpcy5zZWxlY3RlZEFub3JtYWx5Q2xhc3MsIFtdLCBbXSwgd2luZG93LmFjY2VwdEluZGljYXRlcywgd2luZG93LnJlamVjdEluZGljYXRlcywgJ1RCU2FtcGxpbmcnLCB0cnVlLFxuICAgICAgICAoaW5kaWNlczogYW55LCBjbGVhbnNJbmRpY2VzOiBhbnkpID0+IHtcbiAgICAgICAgICBpZiAoaW5kaWNlcyAhPSBudWxsKSB7XG4gICAgICAgICAgICAvLyB0aGlzLnF1ZXJ5SW5kaWNlcyA9IGluZGljZXM7XG4gICAgICAgICAgICBpZiAodGhpcy5xdWVyeUluZGljZXMubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5zZWFyY2hCb3gubWVzc2FnZSA9ICcwIG1hdGNoZXMuJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuc2VhcmNoQm94Lm1lc3NhZ2UgPSBgJHt0aGlzLnF1ZXJ5SW5kaWNlcy5sZW5ndGh9IG1hdGNoZXMuYDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgd2luZG93LnF1ZXJ5UmVzQW5vcm1hbEluZGVjYXRlcyA9IGluZGljZXNcbiAgICAgICAgICAgIHdpbmRvdy5xdWVyeVJlc0Fub3JtYWxDbGVhbkluZGVjYXRlcyA9IGNsZWFuc0luZGljZXNcblxuICAgICAgICAgICAgdGhpcy5xdWVyeUluZGljZXMgPSBpbmRpY2VzLmNvbmNhdChjbGVhbnNJbmRpY2VzKVxuICAgICAgICAgICAgaWYgKCF0aGlzLmlzQWxTZWxlY3RpbmcpIHtcbiAgICAgICAgICAgICAgdGhpcy5pc0FsU2VsZWN0aW5nID0gdHJ1ZVxuICAgICAgICAgICAgICB3aW5kb3cuaXNBZGp1c3RpbmdTZWwgPSB0cnVlXG4gICAgICAgICAgICAgIC8vIHRoaXMuYm91bmRpbmdTZWxlY3Rpb25CdG4uY2xhc3NMaXN0LmFkZCgnYWN0aXZlZCcpXG4gICAgICAgICAgICAgIHRoaXMucHJvamVjdG9yRXZlbnRDb250ZXh0LnNldE1vdXNlTW9kZShNb3VzZU1vZGUuQVJFQV9TRUxFQ1QpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5zY2F0dGVyUGxvdC5zZXRNb3VzZU1vZGUoTW91c2VNb2RlLkFSRUFfU0VMRUNUKTtcbiAgICAgICAgICAgIHRoaXMuc2hvd0NoZWNrQWxsUXVlcnlSZXMgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLnNob3dNb3JlUmVjb21tZW5kID0gdHJ1ZVxuICAgICAgICAgICAgLy8gaWYgKHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5pc0NvbnRyb2xHcm91cCA9PSAndHJ1ZScpIHtcbiAgICAgICAgICAgIC8vICAgdGhpcy5zaG93TW9yZVJlY29tbWVuZCA9IGZhbHNlXG4gICAgICAgICAgICAvLyB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gICB0aGlzLnNob3dNb3JlUmVjb21tZW5kID0gdHJ1ZVxuICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgdGhpcy5jaGVja0FsbFF1ZXJ5UmVzID0gZmFsc2VcbiAgICAgICAgICAgIHRoaXMucXVlcnlSZXN1bHRMaXN0VGl0bGUgPSAnUG9zc2libGUgQWJub3JtYWwgUG9pbnQgTGlzdCdcbiAgICAgICAgICAgIC8vIGxldCBkb20gPSB0aGlzLiQkKFwiI3F1ZXJ5UmVzaGVhZGVyXCIpXG5cbiAgICAgICAgICAgIC8vIGRvbS5pbm5lckhUTUwgPSAnbGFiZWwnXG4gICAgICAgICAgICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dC5ub3RpZnlTZWxlY3Rpb25DaGFuZ2VkKHRoaXMucXVlcnlJbmRpY2VzLCBmYWxzZSwgJ2lzQW5vcm1hbHlRdWVyeScpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9XG5cblxuICAgIHRoaXMudHJhaW5CeVNlbEJ0bi5vbmNsaWNrID0gKCkgPT4ge1xuICAgICAgaWYgKHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXM/Lmxlbmd0aCA8IDUwMCkge1xuICAgICAgICBsb2dnaW5nLnNldEVycm9yTWVzc2FnZShgQ3VycmVudCBzZWxlY3RlZCBpbnRlcmVzdGVkIHNhbXBsZXM6ICR7d2luZG93LmFjY2VwdEluZGljYXRlcz8ubGVuZ3RofSxcbiAgICAgICAgICBQbGVhc2UgU2VsZWN0IDUwMCBpbnRlcmVzdCBzYW1wbGVzYCk7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgdGhpcy5yZXNldFN0YXR1cygpXG4gICAgICAvLyB0aGlzLmJvdW5kaW5nU2VsZWN0aW9uQnRuLmNsYXNzTGlzdC5yZW1vdmUoJ2FjdGl2ZWQnKVxuICAgICAgLy8gdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQuc2V0TW91c2VNb2RlKE1vdXNlTW9kZS5DQU1FUkFfQU5EX0NMSUNLX1NFTEVDVCk7XG4gICAgICAvLyBjb25zb2xlLmxvZyh3aW5kb3cuY3VzKVxuICAgICAgbGV0IHJldHJhaW5MaXN0ID0gd2luZG93LnByZXZpb3VzSW5kZWNhdGVzXG4gICAgICByZXRyYWluTGlzdFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmICh3aW5kb3cucHJldmlvdXNJbmRlY2F0ZXMuaW5kZXhPZih3aW5kb3cuY3VzdG9tU2VsZWN0aW9uW2ldKSA9PT0gLTEpIHtcbiAgICAgICAgICByZXRyYWluTGlzdC5wdXNoKHdpbmRvdy5jdXN0b21TZWxlY3Rpb25baV0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZ1bmN0aW9uIGZ1bmMoYSwgYikge1xuICAgICAgICByZXR1cm4gYSAtIGI7XG4gICAgICB9XG4gICAgICByZXRyYWluTGlzdC5zb3J0KGZ1bmMpXG4gICAgICB0aGlzLnByb2plY3Rvci5yZXRyYWluQnlTZWxlY3Rpb25zKHRoaXMucHJvamVjdG9yLml0ZXJhdGlvbiwgd2luZG93LmFjY2VwdEluZGljYXRlcywgd2luZG93LnJlamVjdEluZGljYXRlcylcbiAgICAgIC8vICB0aGlzLnByb2plY3Rpb25zUGFuZWwucmVUcmFpbkJ5U2VsKHRoaXMucHJvamVjdG9yLml0ZXJhdGlvbix0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzKVxuICAgIH1cbiAgICB0aGlzLmRpc3RGdW5jID0gdmVjdG9yLmNvc0Rpc3Q7XG4gICAgY29uc3QgZXVjRGlzdCA9IHRoaXMuJCQoJy5kaXN0YW5jZSBhLmV1Y2xpZGVhbicpIGFzIEhUTUxMaW5rRWxlbWVudDtcbiAgICBldWNEaXN0Lm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICBjb25zdCBsaW5rcyA9IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yQWxsKCcuZGlzdGFuY2UgYScpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5rcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB1dGlsLmNsYXNzZWQobGlua3NbaV0gYXMgSFRNTEVsZW1lbnQsICdzZWxlY3RlZCcsIGZhbHNlKTtcbiAgICAgIH1cbiAgICAgIHV0aWwuY2xhc3NlZChldWNEaXN0IGFzIEhUTUxFbGVtZW50LCAnc2VsZWN0ZWQnLCB0cnVlKTtcbiAgICAgIHRoaXMuZGlzdEZ1bmMgPSB2ZWN0b3IuZGlzdDtcbiAgICAgIHRoaXMucHJvamVjdG9yRXZlbnRDb250ZXh0Lm5vdGlmeURpc3RhbmNlTWV0cmljQ2hhbmdlZCh0aGlzLmRpc3RGdW5jKTtcbiAgICAgIGNvbnN0IG5laWdoYm9ycyA9IHByb2plY3Rvci5kYXRhU2V0LmZpbmROZWlnaGJvcnMoXG4gICAgICAgIHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXNbMF0sXG4gICAgICAgIHRoaXMuZGlzdEZ1bmMsXG4gICAgICAgIHRoaXMubnVtTk5cbiAgICAgICk7XG4gICAgICB0aGlzLnVwZGF0ZU5laWdoYm9yc0xpc3QobmVpZ2hib3JzKTtcbiAgICB9O1xuICAgIGNvbnN0IGNvc0Rpc3QgPSB0aGlzLiQkKCcuZGlzdGFuY2UgYS5jb3NpbmUnKSBhcyBIVE1MTGlua0VsZW1lbnQ7XG4gICAgY29zRGlzdC5vbmNsaWNrID0gKCkgPT4ge1xuICAgICAgY29uc3QgbGlua3MgPSB0aGlzLnJvb3QucXVlcnlTZWxlY3RvckFsbCgnLmRpc3RhbmNlIGEnKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlua3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdXRpbC5jbGFzc2VkKGxpbmtzW2ldIGFzIEhUTUxFbGVtZW50LCAnc2VsZWN0ZWQnLCBmYWxzZSk7XG4gICAgICB9XG4gICAgICB1dGlsLmNsYXNzZWQoY29zRGlzdCwgJ3NlbGVjdGVkJywgdHJ1ZSk7XG4gICAgICB0aGlzLmRpc3RGdW5jID0gdmVjdG9yLmNvc0Rpc3Q7XG4gICAgICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dC5ub3RpZnlEaXN0YW5jZU1ldHJpY0NoYW5nZWQodGhpcy5kaXN0RnVuYyk7XG4gICAgICBjb25zdCBuZWlnaGJvcnMgPSBwcm9qZWN0b3IuZGF0YVNldC5maW5kTmVpZ2hib3JzKFxuICAgICAgICB0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzWzBdLFxuICAgICAgICB0aGlzLmRpc3RGdW5jLFxuICAgICAgICB0aGlzLm51bU5OXG4gICAgICApO1xuICAgICAgdGhpcy51cGRhdGVOZWlnaGJvcnNMaXN0KG5laWdoYm9ycyk7XG4gICAgfTtcblxuXG4gICAgdGhpcy5ub2lzeUJ0bi5vbmNsaWNrID0gKCkgPT4ge1xuXG4gICAgICBpZiAod2luZG93LmN1c3RvbVNlbGVjdGlvbi5sZW5ndGggPT0gMCkge1xuICAgICAgICBhbGVydCgncGxlYXNlIGNvbmZpcm0gc29tZSBwb2ludHMgZmlyc3QnKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIHdpbmRvdy5pc0FuaW1hdGF0aW5nID0gdHJ1ZVxuICAgICAgcHJvamVjdG9yLmdldEFsbFJlc1Bvc0xpc3QoKGRhdGE6IGFueSkgPT4ge1xuICAgICAgICBpZiAoZGF0YSAmJiBkYXRhLnJlc3VsdHMpIHtcbiAgICAgICAgICB3aW5kb3cuYWxsUmVzUG9zaXRpb25zID0gZGF0YVxuICAgICAgICAgIHRoaXMudG90YWxFcG9jaCA9IE9iamVjdC5rZXlzKGRhdGEucmVzdWx0cykubGVuZ3RoXG4gICAgICAgICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQuc2V0RHluYW1pY05vaXN5KClcbiAgICAgICAgICB0aGlzLm5vaXN5QnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgICAgICAgICB0aGlzLnN0b3BCdG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG5cblxuICAgIHRoaXMuc3RvcEJ0bi5vbmNsaWNrID0gKCkgPT4ge1xuICAgICAgd2luZG93LmlzQW5pbWF0YXRpbmcgPSBmYWxzZVxuICAgICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQuc2V0RHluYW1pY1N0b3AoKVxuICAgICAgdGhpcy5ub2lzeUJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgICAgdGhpcy5zdG9wQnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgICAgIC8vIHRoaXMucHJvamVjdG9yRXZlbnRDb250ZXh0LnJlbmRlckluVHJhY2VMaW5lKGZhbHNlLCAxLCAxKVxuICAgICAgaWYgKHdpbmRvdy5saW5lR2VvbWVydHJ5TGlzdD8ubGVuZ3RoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgd2luZG93LmxpbmVHZW9tZXJ0cnlMaXN0OyBpKyspIHsgd2luZG93LmxpbmVHZW9tZXJ0cnlMaXN0W2ldLnBhcmVudC5yZW1vdmUod2luZG93LmxpbmVHZW9tZXJ0cnlMaXN0W2ldKSB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5lbmFibGVSZXNldEZpbHRlckJ1dHRvbihmYWxzZSk7XG5cbiAgICBjb25zdCB1cGRhdGVJbnB1dCA9ICh2YWx1ZTogc3RyaW5nLCBpblJlZ2V4TW9kZTogYm9vbGVhbikgPT4ge1xuICAgICAgdGhpcy5zZWFyY2hQcmVkaWNhdGUgPSB2YWx1ZTtcbiAgICAgIHRoaXMuc2VhcmNoSW5SZWdleE1vZGUgPSBpblJlZ2V4TW9kZVxuICAgIH07XG4gICAgdGhpcy5zZWFyY2hCb3gucmVnaXN0ZXJJbnB1dENoYW5nZWRMaXN0ZW5lcigodmFsdWUsIGluUmVnZXhNb2RlKSA9PiB7XG4gICAgICB1cGRhdGVJbnB1dCh2YWx1ZSwgaW5SZWdleE1vZGUpO1xuICAgIH0pO1xuICAgIHRoaXMuc2VhcmNoQnV0dG9uLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICAvLyByZWFkIHNlYXJjaCBib3ggaW5wdXQgYW5kIHVwZGF0ZSBpbmRpY2VzXG5cbiAgICAgIGlmICh0aGlzLnNlYXJjaFByZWRpY2F0ZSA9PSBudWxsIHx8IHRoaXMuc2VhcmNoUHJlZGljYXRlLnRyaW0oKSA9PT0gJycpIHtcbiAgICAgICAgdGhpcy5zZWFyY2hCb3gubWVzc2FnZSA9ICcnO1xuICAgICAgICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dC5ub3RpZnlTZWxlY3Rpb25DaGFuZ2VkKFtdKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBwcm9qZWN0b3IucXVlcnkoXG4gICAgICAgIHRoaXMuc2VhcmNoUHJlZGljYXRlLFxuICAgICAgICB0aGlzLnNlYXJjaEluUmVnZXhNb2RlLFxuICAgICAgICB0aGlzLnNlbGVjdGVkTWV0YWRhdGFGaWVsZCxcbiAgICAgICAgdGhpcy5jdXJyZW50UHJlZGljYXRlLFxuICAgICAgICB3aW5kb3cuaXRlcmF0aW9uLFxuICAgICAgICB0aGlzLmNvbmZpZGVuY2VUaHJlc2hvbGRGcm9tLFxuICAgICAgICB0aGlzLmNvbmZpZGVuY2VUaHJlc2hvbGRUbyxcbiAgICAgICAgKGluZGljZXM6IGFueSkgPT4ge1xuICAgICAgICAgIGlmIChpbmRpY2VzICE9IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMucXVlcnlJbmRpY2VzID0gaW5kaWNlcztcbiAgICAgICAgICAgIGlmICh0aGlzLnF1ZXJ5SW5kaWNlcy5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgICB0aGlzLnNlYXJjaEJveC5tZXNzYWdlID0gJzAgbWF0Y2hlcy4nO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5zZWFyY2hCb3gubWVzc2FnZSA9IGAke3RoaXMucXVlcnlJbmRpY2VzLmxlbmd0aH0gbWF0Y2hlcy5gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zaG93Q2hlY2tBbGxRdWVyeVJlcyA9IHRydWVcbiAgICAgICAgICAgIHRoaXMuc2hvd01vcmVSZWNvbW1lbmQgPSBmYWxzZVxuICAgICAgICAgICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQubm90aWZ5U2VsZWN0aW9uQ2hhbmdlZCh0aGlzLnF1ZXJ5SW5kaWNlcywgZmFsc2UsICdub3JtYWwnKTtcbiAgICAgICAgICAgIHRoaXMucXVlcnlSZXN1bHRMaXN0VGl0bGUgPSAnUXVlcnkgUmVzdWx0IExpc3QnXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cbiAgXG4gIH1cblxuXG5cbiAgcHJpdmF0ZSBxdWVyeUJ5QWwocHJvamVjdG9yLCBhY2NlcHRJbmRpY2F0ZXMsIHJlamVjdEluZGljYXRlcywgcXVlck51bT8sIGlzUmVjb21tZW5kPykge1xuICAgIGxldCB0aGF0ID0gdGhpc1xuICAgIGxldCBudW0gPSBOdW1iZXIodGhpcy5idWRnZXQpXG4gICAgbGV0IHN0cmF0ZXJneSA9IHRoaXMuc2VsZWN0ZWRTdHJhdGVyZ3lcbiAgICBpZiAodGhpcy5zZWxlY3RlZFN0cmF0ZXJneSA9PT0gJ0ludGVyZXN0IHBvdGVudGlhbCcpIHtcbiAgICAgIHN0cmF0ZXJneSA9ICdUQlNhbXBsaW5nJ1xuICAgIH1cbiAgICBpZiAocXVlck51bSkge1xuICAgICAgbnVtID0gTnVtYmVyKHF1ZXJOdW0pXG4gICAgfVxuICAgIGlmIChpc1JlY29tbWVuZCA9PT0gZmFsc2UpIHtcbiAgICAgIGlmICh3aW5kb3cuc2Vzc2lvblN0b3JhZ2UuaXNDb250cm9sR3JvdXAgPT0gJ3RydWUnKSB7XG4gICAgICAgIHN0cmF0ZXJneSA9ICdUQlNhbXBsaW5nJ1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyYXRlcmd5ID0gJ0ZlZWRiYWNrJ1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWFjY2VwdEluZGljYXRlcykge1xuICAgICAgYWNjZXB0SW5kaWNhdGVzID0gW11cbiAgICB9XG4gICAgaWYgKCFyZWplY3RJbmRpY2F0ZXMpIHtcbiAgICAgIHJlamVjdEluZGljYXRlcyA9IFtdXG4gICAgfVxuICAgIHByb2plY3Rvci5xdWVyeUJ5QUwoXG4gICAgICB0aGlzLnByb2plY3Rvci5pdGVyYXRpb24sXG4gICAgICBzdHJhdGVyZ3ksXG4gICAgICBudW0sXG4gICAgICBhY2NlcHRJbmRpY2F0ZXMsXG4gICAgICByZWplY3RJbmRpY2F0ZXMsXG4gICAgICBpc1JlY29tbWVuZCxcbiAgICAgIChpbmRpY2VzOiBhbnksIHNjb3JlczogYW55LCBsYWJlbHM6IGFueSkgPT4ge1xuICAgICAgICBpZiAoaW5kaWNlcyAhPSBudWxsKSB7XG4gICAgICAgICAgdGhpcy5xdWVyeUluZGljZXMgPSBpbmRpY2VzO1xuICAgICAgICAgIGlmICh0aGlzLnF1ZXJ5SW5kaWNlcy5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgdGhpcy5zZWFyY2hCb3gubWVzc2FnZSA9ICcwIG1hdGNoZXMuJztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zZWFyY2hCb3gubWVzc2FnZSA9IGAke3RoaXMucXVlcnlJbmRpY2VzLmxlbmd0aH0gbWF0Y2hlcy5gO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHdpbmRvdy5hbFN1Z2dlc3RTY29yZUxpc3QgPSBzY29yZXNcbiAgICAgICAgICB3aW5kb3cuYWxTdWdnZXN0TGFiZWxMaXN0ID0gbGFiZWxzXG5cbiAgICAgICAgICBpZiAoIXRoaXMuaXNBbFNlbGVjdGluZykge1xuICAgICAgICAgICAgdGhpcy5pc0FsU2VsZWN0aW5nID0gdHJ1ZVxuICAgICAgICAgICAgd2luZG93LmlzQWRqdXN0aW5nU2VsID0gdHJ1ZVxuICAgICAgICAgICAgLy8gdGhpcy5ib3VuZGluZ1NlbGVjdGlvbkJ0bi5jbGFzc0xpc3QuYWRkKCdhY3RpdmVkJylcbiAgICAgICAgICAgIHRoaXMucHJvamVjdG9yRXZlbnRDb250ZXh0LnNldE1vdXNlTW9kZShNb3VzZU1vZGUuQVJFQV9TRUxFQ1QpXG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuc2hvd0NoZWNrQWxsUXVlcnlSZXMgPSB0cnVlXG4gICAgICAgICAgdGhpcy5zaG93TW9yZVJlY29tbWVuZCA9IHRydWVcbiAgICAgICAgICAvLyBpZiAod2luZG93LnNlc3Npb25TdG9yYWdlLmlzQ29udHJvbEdyb3VwID09ICd0cnVlJykge1xuICAgICAgICAgIC8vICAgdGhpcy5zaG93TW9yZVJlY29tbWVuZCA9IGZhbHNlXG4gICAgICAgICAgLy8gfSBlbHNlIHtcbiAgICAgICAgICAvLyAgIHRoaXMuc2hvd01vcmVSZWNvbW1lbmQgPSB0cnVlXG4gICAgICAgICAgLy8gfVxuICAgICAgICAgIHRoaXMuY2hlY2tBbGxRdWVyeVJlcyA9IGZhbHNlXG4gICAgICAgICAgdGhpcy5xdWVyeVJlc3VsdExpc3RUaXRsZSA9ICdBY3RpdmUgTGVhcm5pbmcgc3VnZ2VzdGlvbidcbiAgICAgICAgICBsZXQgZG9tID0gdGhpcy4kJChcIiNxdWVyeVJlc2hlYWRlclwiKVxuICAgICAgICAgIGRvbS5pbm5lckhUTUwgPSAncHJlZGljdCdcbiAgICAgICAgICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dC5ub3RpZnlTZWxlY3Rpb25DaGFuZ2VkKHRoaXMucXVlcnlJbmRpY2VzLCBmYWxzZSwgJ2lzQUxRdWVyeScpO1xuICAgICAgICAgIC8vIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnNjYXR0ZXJQbG90LnNldE1vdXNlTW9kZShNb3VzZU1vZGUuQVJFQV9TRUxFQ1QpO1xuXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICApO1xuICB9XG5cbiAgcmVzZXRTdGF0dXMoKSB7XG4gICAgdGhpcy5pc0FsU2VsZWN0aW5nID0gZmFsc2VcbiAgICB3aW5kb3cuaXNBZGp1c3RpbmdTZWwgPSBmYWxzZVxuICB9XG5cbiAgcGxheUFuaW1hdGlvbkZpbmlzaGVkKCkge1xuICAgIHRoaXMubm9pc3lCdG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICB0aGlzLnN0b3BCdG4uZGlzYWJsZWQgPSB0cnVlO1xuICB9XG5cbiAgcHVibGljIHNob3dUYWIoaWQ6IHN0cmluZykge1xuICAgIHRoaXMuY3VycmVudEZpbHRlclR5cGUgPSBpZDtcbiAgICBjb25zdCB0YWIgPSB0aGlzLiQkKCcuaW5rLXRhYltkYXRhLXRhYj1cIicgKyBpZCArICdcIl0nKSBhcyBIVE1MRWxlbWVudDtcbiAgICBjb25zdCBhbGxUYWJzID0gdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoJy5pbmstdGFiJyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbGxUYWJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB1dGlsLmNsYXNzZWQoYWxsVGFic1tpXSBhcyBIVE1MRWxlbWVudCwgJ2FjdGl2ZScsIGZhbHNlKTtcbiAgICB9XG4gICAgdXRpbC5jbGFzc2VkKHRhYiwgJ2FjdGl2ZScsIHRydWUpO1xuICAgIGNvbnN0IGFsbFRhYkNvbnRlbnQgPSB0aGlzLnJvb3QucXVlcnlTZWxlY3RvckFsbCgnLmluay1wYW5lbC1jb250ZW50Jyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbGxUYWJDb250ZW50Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB1dGlsLmNsYXNzZWQoYWxsVGFiQ29udGVudFtpXSBhcyBIVE1MRWxlbWVudCwgJ2FjdGl2ZScsIGZhbHNlKTtcbiAgICB9XG4gICAgdXRpbC5jbGFzc2VkKFxuICAgICAgdGhpcy4kJCgnLmluay1wYW5lbC1jb250ZW50W2RhdGEtcGFuZWw9XCInICsgaWQgKyAnXCJdJykgYXMgSFRNTEVsZW1lbnQsXG4gICAgICAnYWN0aXZlJyxcbiAgICAgIHRydWVcbiAgICApO1xuICAgIC8vIGd1YXJkIGZvciB1bml0IHRlc3RzLCB3aGVyZSBwb2x5bWVyIGlzbid0IGF0dGFjaGVkIGFuZCAkIGRvZXNuJ3QgZXhpc3QuXG4gICAgaWYgKHRoaXMuJCAhPSBudWxsKSB7XG4gICAgICBjb25zdCBtYWluID0gdGhpcy4kWydtYWluJ107XG4gICAgICAvLyBJbiBvcmRlciBmb3IgdGhlIHByb2plY3Rpb25zIHBhbmVsIHRvIGFuaW1hdGUgaXRzIGhlaWdodCwgd2UgbmVlZCB0b1xuICAgICAgLy8gc2V0IGl0IGV4cGxpY2l0bHkuXG4gICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgICAgICB0aGlzLnN0eWxlLmhlaWdodCA9IG1haW4/LmNsaWVudEhlaWdodCArICdweCc7XG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYoaWQgPT09ICdub3JtYWwnKXtcbiAgICAgIHRoaXMuc2hvd01vcmVSZWNvbW1lbmQgPSBmYWxzZVxuICAgIH1cbiAgICB0aGlzLnVwZGF0ZVNlYXJjaFJlc3VsdHMoW10pO1xuICAgIHdpbmRvdy5hbFN1Z2dlc3RTY29yZUxpc3QgPSBbXVxuICAgIGNvbnNvbGUubG9nKCdpZCcsaWQpO1xuICB9XG5cblxuICB1cGRhdGVEaXNhYmxlZFN0YXR1ZXModmFsdWU6IGJvb2xlYW4pIHtcbiAgICB0aGlzLmRpc2FibGVkQWxFeEJhc2UgPSB2YWx1ZVxuICB9XG5cblxuXG4gIHVwZGF0ZUJvdW5kaW5nQm94U2VsZWN0aW9uKGluZGljZXM6IG51bWJlcltdKSB7XG4gICAgdGhpcy5jdXJyZW50Qm91bmRpbmdCb3hTZWxlY3Rpb24gPSBpbmRpY2VzO1xuICAgIGlmICghd2luZG93LmN1c3RvbVNlbGVjdGlvbikge1xuICAgICAgd2luZG93LmN1c3RvbVNlbGVjdGlvbiA9IFtdXG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmN1cnJlbnRCb3VuZGluZ0JveFNlbGVjdGlvbi5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHdpbmRvdy5jdXN0b21TZWxlY3Rpb24uaW5kZXhPZih0aGlzLmN1cnJlbnRCb3VuZGluZ0JveFNlbGVjdGlvbltpXSkgPCAwKSB7XG4gICAgICAgIHdpbmRvdy5jdXN0b21TZWxlY3Rpb24ucHVzaCh0aGlzLmN1cnJlbnRCb3VuZGluZ0JveFNlbGVjdGlvbltpXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgaW5kZXggPSB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uLmluZGV4T2YodGhpcy5jdXJyZW50Qm91bmRpbmdCb3hTZWxlY3Rpb25baV0pXG4gICAgICAgIHdpbmRvdy5jdXN0b21TZWxlY3Rpb24uc3BsaWNlKGluZGV4LCAxKVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLm5vaXN5QnRuLnN0eWxlLnZpc2liaWxpdHkgPSBCb29sZWFuKHdpbmRvdy5jdXN0b21TZWxlY3Rpb24/Lmxlbmd0aCk/Jyc6J2hpZGRlbidcbiAgICB0aGlzLnN0b3BCdG4uc3R5bGUudmlzaWJpbGl0eSA9IEJvb2xlYW4od2luZG93LmN1c3RvbVNlbGVjdGlvbj8ubGVuZ3RoKT8nJzonaGlkZGVuJ1xuICAgIC8vIHdpbmRvdy5jdXN0b21TZWxlY3Rpb24gPSB0aGlzLmN1cnJlbnRCb3VuZGluZ0JveFNlbGVjdGlvblxuICB9XG4gIHByaXZhdGUgdXBkYXRlTnVtTk4oKSB7XG4gICAgaWYgKHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMgIT0gbnVsbCkge1xuICAgICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQubm90aWZ5U2VsZWN0aW9uQ2hhbmdlZChbXG4gICAgICAgIHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXNbMF0sXG4gICAgICBdKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==