import { __decorate, __metadata } from "tslib";
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
import { customElement, property, observe } from '@polymer/decorators';
import * as d3 from 'd3';
import { LegacyElementMixin } from '../components/polymer/legacy_element_mixin';
import '../components/polymer/irons_and_papers';
import { template } from './vz-projector-data-panel.html';
import './vz-projector-legend';
import { parseRawMetadata, parseRawTensors, } from './data-provider';
import * as util from './util';
let DataPanel = class DataPanel extends LegacyElementMixin(PolymerElement) {
    constructor() {
        super(...arguments);
        this.metadataEditorInputLabel = 'Tag selection as';
        this.superviseInputLabel = 'Ignored label';
        this.showSuperviseSettings = false;
        this.showEditSettings = false;
        this.showDVISettings = false;
        this._wordDelimiter = '[/=_,-]';
        this.forceCategoricalColoring = false;
    }
    ready() {
        super.ready();
        this.normalizeData = true;
        this.superviseInputSelected = '';
    }
    initialize(projector, dp) {
        this.projector = projector;
        this.dataProvider = dp;
        this.setupUploadButtons();
        // Tell the projector whenever the data normalization changes.
        // Unknown why, but the polymer checkbox button stops working as soon as
        // you do d3.select() on it.
        this.$$('#normalize-data-checkbox').addEventListener('change', () => {
            this.projector.setNormalizeData(this.normalizeData);
        });
        let forceCategoricalColoringCheckbox = this.$$('#force-categorical-checkbox');
        forceCategoricalColoringCheckbox.addEventListener('change', () => {
            this.setForceCategoricalColoring(forceCategoricalColoringCheckbox.checked);
        });
        // Get all the runs.
        this.dataProvider.retrieveRuns((runs) => {
            this.runNames = runs;
            // Choose the first run by default.
            if (this.runNames.length > 0) {
                if (this.selectedRun != runs[0]) {
                    // This set operation will automatically trigger the observer.
                    this.selectedRun = runs[0];
                }
                else {
                    // Explicitly load the projector config. We explicitly load because
                    // the run name stays the same, which means that the observer won't
                    // actually be triggered by setting the selected run.
                    this._generateUiForNewCheckpointForRun(this.selectedRun);
                }
            }
        });
    }
    setForceCategoricalColoring(forceCategoricalColoring) {
        this.forceCategoricalColoring = forceCategoricalColoring;
        this.$$('#force-categorical-checkbox').checked = this.forceCategoricalColoring;
        this.updateMetadataUI(this.spriteAndMetadata.stats, this.metadataFile);
        // The selected color option name doesn't change when we switch to using
        // categorical coloring for stats with too many unique values, so we
        // manually call this polymer observer so that we update the UI.
        this._selectedColorOptionNameChanged();
    }
    getSeparatorClass(isSeparator) {
        return isSeparator ? 'separator' : null;
    }
    metadataChanged(spriteAndMetadata, metadataFile) {
        this.spriteAndMetadata = spriteAndMetadata;
        if (metadataFile != null) {
            this.metadataFile = metadataFile;
        }
        this.updateMetadataUI(this.spriteAndMetadata.stats, this.metadataFile);
        if (this.selectedColorOptionName == null ||
            this.colorOptions.filter((c) => c.name === this.selectedColorOptionName)
                .length === 0) {
            this.selectedColorOptionName = this.colorOptions[0].name;
        }
        let labelIndex = -1;
        this.metadataFields = spriteAndMetadata.stats.map((stats, i) => {
            if (!stats.isNumeric && labelIndex === -1) {
                labelIndex = i;
            }
            return stats.name;
        });
        if (this.metadataEditorColumn == null ||
            this.metadataFields.filter((name) => name === this.metadataEditorColumn)
                .length === 0) {
            // Make the default label the first non-numeric column.
            this.metadataEditorColumn = this.metadataFields[Math.max(0, labelIndex)];
        }
        if (this.superviseColumn == null ||
            this.metadataFields.filter((name) => name === this.superviseColumn)
                .length === 0) {
            // Make the default supervise class the first non-numeric column.
            this.superviseColumn = this.metadataFields[Math.max(0, labelIndex)];
            this.superviseInput = '';
        }
        this.superviseInputChange();
    }
    projectionChanged(projection) {
        if (projection) {
            switch (projection.projectionType) {
                case 'tsne':
                    this.set('showSuperviseSettings', false);
                    this.set('showDVISettings', true);
                    break;
                default:
                    this.set('showSuperviseSettings', false);
            }
        }
    }
    onProjectorSelectionChanged(selectedPointIndices, neighborsOfFirstPoint) {
        this.selectedPointIndices = selectedPointIndices;
        this.neighborsOfFirstPoint = neighborsOfFirstPoint;
        this.metadataEditorInputChange();
    }
    updateMetadataUI(columnStats, metadataFile) {
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
        // Color by options.
        const standardColorOption = [{ name: 'No color map' }];
        const metadataColorOption = columnStats
            .filter((stats) => {
            return !stats.tooManyUniqueValues || stats.isNumeric;
        })
            .map((stats) => {
            let map;
            let items;
            let thresholds;
            let isCategorical = this.forceCategoricalColoring || !stats.tooManyUniqueValues;
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
        this.colorOptions = standardColorOption.concat(metadataColorOption);
    }
    metadataEditorContext(enabled) {
        this.metadataEditorButtonDisabled = !enabled;
        if (this.projector) {
            this.projector.metadataEditorContext(enabled, this.metadataEditorColumn);
        }
    }
    metadataEditorInputChange() {
        let col = this.metadataEditorColumn;
        let value = this.metadataEditorInput;
        let selectionSize = this.selectedPointIndices.length + this.neighborsOfFirstPoint.length;
        if (selectionSize > 0) {
            if (value != null && value.trim() !== '') {
                if (this.spriteAndMetadata.stats.filter((s) => s.name === col)[0]
                    .isNumeric &&
                    isNaN(+value)) {
                    this.metadataEditorInputLabel = `Label must be numeric`;
                    this.metadataEditorContext(false);
                }
                else {
                    let numMatches = this.projector.dataSet.points.filter((p) => p.metadata[col].toString() === value.trim()).length;
                    if (numMatches === 0) {
                        this.metadataEditorInputLabel = `Tag ${selectionSize} with new label`;
                    }
                    else {
                        this.metadataEditorInputLabel = `Tag ${selectionSize} points as`;
                    }
                    this.metadataEditorContext(true);
                }
            }
            else {
                this.metadataEditorInputLabel = 'Tag selection as';
                this.metadataEditorContext(false);
            }
        }
        else {
            this.metadataEditorContext(false);
            if (value != null && value.trim() !== '') {
                this.metadataEditorInputLabel = 'Select points to tag';
            }
            else {
                this.metadataEditorInputLabel = 'Tag selection as';
            }
        }
    }
    metadataEditorInputKeydown(e) {
        // Check if 'Enter' was pressed
        if (e.keyCode === 13) {
            this.metadataEditorButtonClicked();
        }
        e.stopPropagation();
    }
    metadataEditorColumnChange() {
        this.metadataEditorInputChange();
    }
    metadataEditorButtonClicked() {
        if (!this.metadataEditorButtonDisabled) {
            let value = this.metadataEditorInput.trim();
            let selectionSize = this.selectedPointIndices.length + this.neighborsOfFirstPoint.length;
            this.projector.metadataEdit(this.metadataEditorColumn, value);
            this.projector.metadataEditorContext(true, this.metadataEditorColumn);
            this.metadataEditorInputLabel = `${selectionSize} labeled as '${value}'`;
        }
    }
    downloadMetadataClicked() {
        if (this.projector &&
            this.projector.dataSet &&
            this.projector.dataSet.spriteAndMetadataInfo) {
            let tsvFile = this.projector.dataSet.spriteAndMetadataInfo.stats
                .map((s) => s.name)
                .join('\t');
            this.projector.dataSet.spriteAndMetadataInfo.pointsInfo.forEach((p) => {
                let vals = [];
                for (const column in p) {
                    vals.push(p[column]);
                }
                tsvFile += '\n' + vals.join('\t');
            });
            const textBlob = new Blob([tsvFile], { type: 'text/plain' });
            const anyDownloadMetadataLink = this.$.downloadMetadataLink;
            anyDownloadMetadataLink.download = 'metadata-edited.tsv';
            // TODO(b/162788443): Undo conformance workaround.
            Object.assign(anyDownloadMetadataLink, {
                href: window.URL['createObjectURL'](textBlob),
            });
            anyDownloadMetadataLink.click();
        }
    }
    superviseInputTyping() {
        let value = this.superviseInput.trim();
        if (value == null || value.trim() === '') {
            if (this.superviseInputSelected === '') {
                this.superviseInputLabel = 'No ignored label';
            }
            else {
                this.superviseInputLabel = `Supervising without '${this.superviseInputSelected}'`;
            }
            return;
        }
        if (this.projector && this.projector.dataSet) {
            let numMatches = this.projector.dataSet.points.filter((p) => p.metadata[this.superviseColumn].toString().trim() === value).length;
            if (numMatches === 0) {
                this.superviseInputLabel = 'Label not found';
            }
            else {
                if (this.projector.dataSet.superviseInput != value) {
                    this.superviseInputLabel = `Supervise without '${value}' [${numMatches} points]`;
                }
            }
        }
    }
    superviseInputChange() {
        let value = this.superviseInput.trim();
        if (value == null || value.trim() === '') {
            this.superviseInputSelected = '';
            this.superviseInputLabel = 'No ignored label';
            this.setSupervision(this.superviseColumn, '');
            return;
        }
        if (this.projector && this.projector.dataSet) {
            let numMatches = this.projector.dataSet.points.filter((p) => p.metadata[this.superviseColumn].toString().trim() === value).length;
            if (numMatches === 0) {
                this.superviseInputLabel = `Supervising without '${this.superviseInputSelected}'`;
            }
            else {
                this.superviseInputSelected = value;
                this.superviseInputLabel = `Supervising without '${value}' [${numMatches} points]`;
                this.setSupervision(this.superviseColumn, value);
            }
        }
    }
    superviseColumnChanged() {
        this.superviseInput = '';
        this.superviseInputChange();
    }
    setSupervision(superviseColumn, superviseInput) {
        if (this.projector && this.projector.dataSet) {
            this.projector.dataSet.setSupervision(superviseColumn, superviseInput);
        }
    }
    setNormalizeData(normalizeData) {
        this.normalizeData = normalizeData;
    }
    _selectedTensorChanged() {
        this.projector.updateDataSet(null, null, null);
        if (this.selectedTensor == null) {
            return;
        }
        this.dataProvider.retrieveTensor(this.selectedRun, this.selectedTensor, (ds) => {
            let metadataFile = this.getEmbeddingInfoByName(this.selectedTensor)
                .metadataPath;
            this.dataProvider.retrieveSpriteAndMetadata(this.selectedRun, this.selectedTensor, (metadata) => {
                this.projector.updateDataSet(ds, metadata, metadataFile);
            });
        });
        this.projector.setSelectedTensor(this.selectedRun, this.getEmbeddingInfoByName(this.selectedTensor));
    }
    _generateUiForNewCheckpointForRun(selectedRun) {
        this.dataProvider.retrieveProjectorConfig(selectedRun, (info) => {
            this.projectorConfig = info;
            let names = this.projectorConfig.embeddings
                .map((e) => e.tensorName)
                .filter((name) => {
                let shape = this.getEmbeddingInfoByName(name).tensorShape;
                return shape.length === 2 && shape[0] > 1 && shape[1] > 1;
            })
                .sort((a, b) => {
                let embA = this.getEmbeddingInfoByName(a);
                let embB = this.getEmbeddingInfoByName(b);
                // Prefer tensors with metadata.
                if (util.xor(!!embA.metadataPath, !!embB.metadataPath)) {
                    return embA.metadataPath ? -1 : 1;
                }
                // Prefer non-generated tensors.
                let isGenA = util.tensorIsGenerated(a);
                let isGenB = util.tensorIsGenerated(b);
                if (util.xor(isGenA, isGenB)) {
                    return isGenB ? -1 : 1;
                }
                // Prefer bigger tensors.
                let sizeA = embA.tensorShape[0];
                let sizeB = embB.tensorShape[0];
                if (sizeA !== sizeB) {
                    return sizeB - sizeA;
                }
                // Sort alphabetically by tensor name.
                return a <= b ? -1 : 1;
            });
            this.tensorNames = names.map((name) => {
                return { name, shape: this.getEmbeddingInfoByName(name).tensorShape };
            });
            // If in demo mode, let the order decide which tensor to load by default.
            const defaultTensor = this.projector.servingMode === 'demo'
                ? this.projectorConfig.embeddings[0].tensorName
                : names[0];
            if (this.selectedTensor === defaultTensor) {
                // Explicitly call the observer. Polymer won't call it if the previous
                // string matches the current string.
                this._selectedTensorChanged();
            }
            else {
                this.selectedTensor = defaultTensor;
            }
        });
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
        // this.projector.setSelectedColorOption(colorOption);
    }
    tensorWasReadFromFile(rawContents, fileName) {
        parseRawTensors(rawContents, (ds) => {
            const checkpointFile = this.$$('#checkpoint-file');
            checkpointFile.innerText = fileName;
            checkpointFile.title = fileName;
            this.projector.updateDataSet(ds);
        });
    }
    metadataWasReadFromFile(rawContents, fileName) {
        parseRawMetadata(rawContents, (metadata) => {
            this.projector.updateDataSet(this.projector.dataSet, metadata, fileName);
        });
    }
    getEmbeddingInfoByName(tensorName) {
        for (let i = 0; i < this.projectorConfig.embeddings.length; i++) {
            const e = this.projectorConfig.embeddings[i];
            if (e.tensorName === tensorName) {
                return e;
            }
        }
    }
    setupUploadButtons() {
        // Show and setup the upload button.
        const fileInput = this.$$('#file');
        fileInput.onchange = () => {
            const file = fileInput.files[0];
            // Clear out the value of the file chooser. This ensures that if the user
            // selects the same file, we'll re-read it.
            fileInput.value = '';
            const fileReader = new FileReader();
            fileReader.onload = (evt) => {
                const content = fileReader.result;
                this.tensorWasReadFromFile(content, file.name);
            };
            fileReader.readAsArrayBuffer(file);
        };
        const uploadButton = this.$$('#upload-tensors');
        uploadButton.onclick = () => {
            fileInput.click();
        };
        // Show and setup the upload metadata button.
        const fileMetadataInput = this.$$('#file-metadata');
        fileMetadataInput.onchange = () => {
            const file = fileMetadataInput.files[0];
            // Clear out the value of the file chooser. This ensures that if the user
            // selects the same file, we'll re-read it.
            fileMetadataInput.value = '';
            const fileReader = new FileReader();
            fileReader.onload = (evt) => {
                const contents = fileReader.result;
                this.metadataWasReadFromFile(contents, file.name);
            };
            fileReader.readAsArrayBuffer(file);
        };
        const uploadMetadataButton = this.$$('#upload-metadata');
        uploadMetadataButton.onclick = () => {
            fileMetadataInput.click();
        };
        if (this.projector.servingMode !== 'demo') {
            this.$$('#publish-container').style.display = 'none';
            this.$$('#upload-tensors-step-container').style.display =
                'none';
            this.$$('#upload-metadata-label').style.display = 'none';
        }
        this.$$('#demo-data-buttons-container').style.display =
            'flex';
        // Fill out the projector config.
        const projectorConfigTemplate = this.$$('#projector-config-template');
        const projectorConfigTemplateJson = {
            embeddings: [
                {
                    tensorName: 'My tensor',
                    tensorShape: [1000, 50],
                    tensorPath: 'https://raw.githubusercontent.com/.../tensors.tsv',
                    metadataPath: 'https://raw.githubusercontent.com/.../optional.metadata.tsv',
                },
            ],
        };
        this.setProjectorConfigTemplateJson(projectorConfigTemplate, projectorConfigTemplateJson);
        // Set up optional field checkboxes.
        const spriteFieldCheckbox = this.$$('#config-sprite-checkbox');
        spriteFieldCheckbox.onchange = () => {
            if (spriteFieldCheckbox.checked) {
                projectorConfigTemplateJson.embeddings[0].sprite = {
                    imagePath: 'https://github.com/.../optional.sprite.png',
                    singleImageDim: [32, 32],
                };
            }
            else {
                delete projectorConfigTemplateJson.embeddings[0].sprite;
            }
            this.setProjectorConfigTemplateJson(projectorConfigTemplate, projectorConfigTemplateJson);
        };
        const bookmarksFieldCheckbox = this.$$('#config-bookmarks-checkbox');
        bookmarksFieldCheckbox.onchange = () => {
            if (bookmarksFieldCheckbox.checked) {
                projectorConfigTemplateJson.embeddings[0].bookmarksPath =
                    'https://raw.githubusercontent.com/.../bookmarks.txt';
            }
            else {
                delete projectorConfigTemplateJson.embeddings[0].bookmarksPath;
            }
            this.setProjectorConfigTemplateJson(projectorConfigTemplate, projectorConfigTemplateJson);
        };
        const metadataFieldCheckbox = this.$$('#config-metadata-checkbox');
        metadataFieldCheckbox.onchange = () => {
            if (metadataFieldCheckbox.checked) {
                projectorConfigTemplateJson.embeddings[0].metadataPath =
                    'https://raw.githubusercontent.com/.../optional.metadata.tsv';
            }
            else {
                delete projectorConfigTemplateJson.embeddings[0].metadataPath;
            }
            this.setProjectorConfigTemplateJson(projectorConfigTemplate, projectorConfigTemplateJson);
        };
        // Update the link and the readonly shareable URL.
        const projectorConfigUrlInput = this.$$('#projector-config-url');
        const projectorConfigDemoUrlInput = this.$$('#projector-share-url');
        const projectorConfigDemoUrlLink = this.$$('#projector-share-url-link');
        projectorConfigUrlInput.onchange = () => {
            let projectorDemoUrl = location.protocol +
                '//' +
                location.host +
                location.pathname +
                '?config=' +
                projectorConfigUrlInput.value;
            projectorConfigDemoUrlInput.value = projectorDemoUrl;
            // TODO(b/162788443): Undo conformance workaround.
            Object.assign(projectorConfigDemoUrlLink, {
                href: projectorDemoUrl,
            });
        };
    }
    setProjectorConfigTemplateJson(projectorConfigTemplate, config) {
        projectorConfigTemplate.value = JSON.stringify(config, null, 
        /** replacer */ 2 /** white space */);
    }
    _getNumTensorsLabel() {
        return this.tensorNames.length === 1
            ? '1 tensor'
            : this.tensorNames.length + ' tensors';
    }
    _getNumRunsLabel() {
        return this.runNames.length === 1
            ? '1 run'
            : this.runNames.length + ' runs';
    }
    _hasChoice(choices) {
        return choices.length > 0;
    }
    _hasChoices(choices) {
        return choices.length > 1;
    }
    _openDataDialog() {
        this.$.dataDialog.open();
    }
    _openConfigDialog() {
        this.$.projectorConfigDialog.open();
    }
};
DataPanel.template = template;
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], DataPanel.prototype, "selectedTensor", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], DataPanel.prototype, "selectedRun", void 0);
__decorate([
    property({ type: String, notify: true }),
    __metadata("design:type", String)
], DataPanel.prototype, "selectedColorOptionName", void 0);
__decorate([
    property({ type: String, notify: true }),
    __metadata("design:type", String)
], DataPanel.prototype, "selectedLabelOption", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], DataPanel.prototype, "normalizeData", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], DataPanel.prototype, "showForceCategoricalColorsCheckbox", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], DataPanel.prototype, "metadataEditorInput", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], DataPanel.prototype, "metadataEditorInputLabel", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], DataPanel.prototype, "metadataEditorColumn", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], DataPanel.prototype, "metadataEditorButtonDisabled", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], DataPanel.prototype, "superviseInput", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], DataPanel.prototype, "superviseInputLabel", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], DataPanel.prototype, "superviseColumn", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], DataPanel.prototype, "showSuperviseSettings", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], DataPanel.prototype, "showEditSettings", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], DataPanel.prototype, "showDVISettings", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", Object)
], DataPanel.prototype, "_wordDelimiter", void 0);
__decorate([
    observe('selectedTensor'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DataPanel.prototype, "_selectedTensorChanged", null);
__decorate([
    observe('selectedRun'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DataPanel.prototype, "_generateUiForNewCheckpointForRun", null);
__decorate([
    observe('selectedLabelOption'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DataPanel.prototype, "_selectedLabelOptionChanged", null);
__decorate([
    observe('selectedColorOptionName'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DataPanel.prototype, "_selectedColorOptionNameChanged", null);
DataPanel = __decorate([
    customElement('vz-projector-data-panel')
], DataPanel);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLWRhdGEtcGFuZWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi90ZW5zb3Jib2FyZC9wcm9qZWN0b3IvdnotcHJvamVjdG9yLWRhdGEtcGFuZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7O2dGQWFnRjtBQUNoRixPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDaEQsT0FBTyxFQUFDLGFBQWEsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDckUsT0FBTyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFFekIsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sNENBQTRDLENBQUM7QUFDOUUsT0FBTyx3Q0FBd0MsQ0FBQztBQUVoRCxPQUFPLEVBQUMsUUFBUSxFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFLeEQsT0FBTyx1QkFBdUIsQ0FBQztBQU8vQixPQUFPLEVBSUwsZ0JBQWdCLEVBQ2hCLGVBQWUsR0FDaEIsTUFBTSxpQkFBaUIsQ0FBQztBQUV6QixPQUFPLEtBQUssSUFBSSxNQUFNLFFBQVEsQ0FBQztBQUcvQixJQUFNLFNBQVMsR0FBZixNQUFNLFNBQVUsU0FBUSxrQkFBa0IsQ0FBQyxjQUFjLENBQUM7SUFBMUQ7O1FBa0JFLDZCQUF3QixHQUFXLGtCQUFrQixDQUFDO1FBUXRELHdCQUFtQixHQUFXLGVBQWUsQ0FBQztRQUk5QywwQkFBcUIsR0FBWSxLQUFLLENBQUM7UUFFdkMscUJBQWdCLEdBQVksS0FBSyxDQUFDO1FBRWxDLG9CQUFlLEdBQVksS0FBSyxDQUFDO1FBR3hCLG1CQUFjLEdBQUcsU0FBUyxDQUFDO1FBSXBDLDZCQUF3QixHQUFZLEtBQUssQ0FBQztJQXFwQjVDLENBQUM7SUFwb0JDLEtBQUs7UUFDSCxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDZCxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztRQUMxQixJQUFJLENBQUMsc0JBQXNCLEdBQUcsRUFBRSxDQUFDO0lBQ25DLENBQUM7SUFDRCxVQUFVLENBQUMsU0FBYyxFQUFFLEVBQWdCO1FBQ3pDLElBQUksQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO1FBQzNCLElBQUksQ0FBQyxZQUFZLEdBQUcsRUFBRSxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBQzFCLDhEQUE4RDtRQUM5RCx3RUFBd0U7UUFDeEUsNEJBQTRCO1FBQzVCLElBQUksQ0FBQyxFQUFFLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFO1lBQ2xFLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ3RELENBQUMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxnQ0FBZ0MsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUM1Qyw2QkFBNkIsQ0FDOUIsQ0FBQztRQUNGLGdDQUFnQyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUU7WUFDL0QsSUFBSSxDQUFDLDJCQUEyQixDQUM3QixnQ0FBcUQsQ0FBQyxPQUFPLENBQy9ELENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztRQUNILG9CQUFvQjtRQUNwQixJQUFJLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFO1lBQ3RDLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1lBQ3JCLG1DQUFtQztZQUNuQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtnQkFDNUIsSUFBSSxJQUFJLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRTtvQkFDL0IsOERBQThEO29CQUM5RCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztpQkFDNUI7cUJBQU07b0JBQ0wsbUVBQW1FO29CQUNuRSxtRUFBbUU7b0JBQ25FLHFEQUFxRDtvQkFDckQsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztpQkFDMUQ7YUFDRjtRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUNELDJCQUEyQixDQUFDLHdCQUFpQztRQUMzRCxJQUFJLENBQUMsd0JBQXdCLEdBQUcsd0JBQXdCLENBQUM7UUFDeEQsSUFBSSxDQUFDLEVBQUUsQ0FDTiw2QkFBNkIsQ0FDVCxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUM7UUFDL0QsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3ZFLHdFQUF3RTtRQUN4RSxvRUFBb0U7UUFDcEUsZ0VBQWdFO1FBQ2hFLElBQUksQ0FBQywrQkFBK0IsRUFBRSxDQUFDO0lBQ3pDLENBQUM7SUFDRCxpQkFBaUIsQ0FBQyxXQUFvQjtRQUNwQyxPQUFPLFdBQVcsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDMUMsQ0FBQztJQUNELGVBQWUsQ0FDYixpQkFBd0MsRUFDeEMsWUFBcUI7UUFFckIsSUFBSSxDQUFDLGlCQUFpQixHQUFHLGlCQUFpQixDQUFDO1FBQzNDLElBQUksWUFBWSxJQUFJLElBQUksRUFBRTtZQUN4QixJQUFJLENBQUMsWUFBWSxHQUFHLFlBQVksQ0FBQztTQUNsQztRQUNELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUN2RSxJQUNFLElBQUksQ0FBQyx1QkFBdUIsSUFBSSxJQUFJO1lBQ3BDLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyx1QkFBdUIsQ0FBQztpQkFDckUsTUFBTSxLQUFLLENBQUMsRUFDZjtZQUNBLElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztTQUMxRDtRQUNELElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3BCLElBQUksQ0FBQyxjQUFjLEdBQUcsaUJBQWlCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUM3RCxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsSUFBSSxVQUFVLEtBQUssQ0FBQyxDQUFDLEVBQUU7Z0JBQ3pDLFVBQVUsR0FBRyxDQUFDLENBQUM7YUFDaEI7WUFDRCxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUM7UUFDcEIsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUNFLElBQUksQ0FBQyxvQkFBb0IsSUFBSSxJQUFJO1lBQ2pDLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLG9CQUFvQixDQUFDO2lCQUNyRSxNQUFNLEtBQUssQ0FBQyxFQUNmO1lBQ0EsdURBQXVEO1lBQ3ZELElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7U0FDMUU7UUFDRCxJQUNFLElBQUksQ0FBQyxlQUFlLElBQUksSUFBSTtZQUM1QixJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxlQUFlLENBQUM7aUJBQ2hFLE1BQU0sS0FBSyxDQUFDLEVBQ2Y7WUFDQSxpRUFBaUU7WUFDakUsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDcEUsSUFBSSxDQUFDLGNBQWMsR0FBRyxFQUFFLENBQUM7U0FDMUI7UUFDRCxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztJQUM5QixDQUFDO0lBQ0QsaUJBQWlCLENBQUMsVUFBc0I7UUFDdEMsSUFBSSxVQUFVLEVBQUU7WUFDZCxRQUFRLFVBQVUsQ0FBQyxjQUFjLEVBQUU7Z0JBQ2pDLEtBQUssTUFBTTtvQkFDVCxJQUFJLENBQUMsR0FBRyxDQUFDLHVCQUF1QixFQUFFLEtBQUssQ0FBQyxDQUFDO29CQUN6QyxJQUFJLENBQUMsR0FBRyxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxDQUFDO29CQUNsQyxNQUFNO2dCQUNSO29CQUNFLElBQUksQ0FBQyxHQUFHLENBQUMsdUJBQXVCLEVBQUUsS0FBSyxDQUFDLENBQUM7YUFDNUM7U0FDRjtJQUNILENBQUM7SUFDRCwyQkFBMkIsQ0FDekIsb0JBQThCLEVBQzlCLHFCQUF5QztRQUV6QyxJQUFJLENBQUMsb0JBQW9CLEdBQUcsb0JBQW9CLENBQUM7UUFDakQsSUFBSSxDQUFDLHFCQUFxQixHQUFHLHFCQUFxQixDQUFDO1FBQ25ELElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO0lBQ25DLENBQUM7SUFDTyxnQkFBZ0IsQ0FBQyxXQUEwQixFQUFFLFlBQW9CO1FBQ3ZFLG9CQUFvQjtRQUNwQixJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNwQixJQUFJLENBQUMsWUFBWSxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDL0MsMERBQTBEO1lBQzFELElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxJQUFJLFVBQVUsS0FBSyxDQUFDLENBQUMsRUFBRTtnQkFDekMsVUFBVSxHQUFHLENBQUMsQ0FBQzthQUNoQjtZQUNELE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQztRQUNwQixDQUFDLENBQUMsQ0FBQztRQUNILElBQ0UsSUFBSSxDQUFDLG1CQUFtQixJQUFJLElBQUk7WUFDaEMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsbUJBQW1CLENBQUM7aUJBQ2xFLE1BQU0sS0FBSyxDQUFDLEVBQ2Y7WUFDQSxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO1NBQ3ZFO1FBQ0QsSUFDRSxJQUFJLENBQUMsb0JBQW9CLElBQUksSUFBSTtZQUNqQyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztpQkFDbkUsTUFBTSxLQUFLLENBQUMsRUFDZjtZQUNBLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7U0FDeEU7UUFDRCxvQkFBb0I7UUFDcEIsTUFBTSxtQkFBbUIsR0FBa0IsQ0FBQyxFQUFDLElBQUksRUFBRSxjQUFjLEVBQUMsQ0FBQyxDQUFDO1FBQ3BFLE1BQU0sbUJBQW1CLEdBQWtCLFdBQVc7YUFDbkQsTUFBTSxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7WUFDaEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDO1FBQ3ZELENBQUMsQ0FBQzthQUNELEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO1lBQ2IsSUFBSSxHQUFHLENBQUM7WUFDUixJQUFJLEtBR0QsQ0FBQztZQUNKLElBQUksVUFBa0MsQ0FBQztZQUN2QyxJQUFJLGFBQWEsR0FDZixJQUFJLENBQUMsd0JBQXdCLElBQUksQ0FBQyxLQUFLLENBQUMsbUJBQW1CLENBQUM7WUFDOUQsSUFBSSxJQUFJLENBQUM7WUFDVCxJQUFJLGFBQWEsRUFBRTtnQkFDakIsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztnQkFDbkQsSUFBSSxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUMxQixzQkFBc0I7Z0JBQ3RCLElBQUksUUFBUSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxFQUFFLEVBQUU7b0JBQ3BDLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7b0JBQ25DLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUN0QixDQUFDLENBQUMsQ0FBQztnQkFDSCxLQUFLLEdBQUcsS0FBSyxDQUFDLGFBQWEsQ0FBQztnQkFDNUIsS0FBSyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ3hELEdBQUcsR0FBRyxLQUFLLENBQUM7Z0JBQ1osTUFBTSxHQUFHLEdBQUcsS0FBSyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUM7Z0JBQ3ZDLElBQUk7b0JBQ0YsR0FBRyxHQUFHLElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLEdBQUcsUUFBUSxDQUFDO2FBQ25FO2lCQUFNO2dCQUNMLFVBQVUsR0FBRztvQkFDWCxFQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxHQUFHLEVBQUM7b0JBQ3BDLEVBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLEdBQUcsRUFBQztpQkFDckMsQ0FBQztnQkFDRixHQUFHLEdBQUcsRUFBRTtxQkFDTCxXQUFXLEVBQWtCO3FCQUM3QixNQUFNLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO3FCQUN0QyxLQUFLLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ3pDLElBQUksR0FBRyxVQUFVLENBQUM7YUFDbkI7WUFDRCxPQUFPO2dCQUNMLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTtnQkFDaEIsSUFBSSxFQUFFLElBQUk7Z0JBQ1YsR0FBRyxFQUFFLEdBQUc7Z0JBQ1IsS0FBSyxFQUFFLEtBQUs7Z0JBQ1osVUFBVSxFQUFFLFVBQVU7Z0JBQ3RCLG1CQUFtQixFQUFFLEtBQUssQ0FBQyxtQkFBbUI7YUFDL0MsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO1FBQ0wsSUFBSSxtQkFBbUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQ2xDLG1EQUFtRDtZQUNuRCx1Q0FBdUM7WUFDdkMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLEVBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQztTQUNqRTtRQUNELElBQUksQ0FBQyxZQUFZLEdBQUcsbUJBQW1CLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFDdEUsQ0FBQztJQUNPLHFCQUFxQixDQUFDLE9BQWdCO1FBQzVDLElBQUksQ0FBQyw0QkFBNEIsR0FBRyxDQUFDLE9BQU8sQ0FBQztRQUM3QyxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7WUFDbEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7U0FDMUU7SUFDSCxDQUFDO0lBQ08seUJBQXlCO1FBQy9CLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztRQUNwQyxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUM7UUFDckMsSUFBSSxhQUFhLEdBQ2YsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDO1FBQ3ZFLElBQUksYUFBYSxHQUFHLENBQUMsRUFBRTtZQUNyQixJQUFJLEtBQUssSUFBSSxJQUFJLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsRUFBRTtnQkFDeEMsSUFDRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7cUJBQzFELFNBQVM7b0JBQ1osS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQ2I7b0JBQ0EsSUFBSSxDQUFDLHdCQUF3QixHQUFHLHVCQUF1QixDQUFDO29CQUN4RCxJQUFJLENBQUMscUJBQXFCLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQ25DO3FCQUFNO29CQUNMLElBQUksVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQ25ELENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxLQUFLLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FDbkQsQ0FBQyxNQUFNLENBQUM7b0JBQ1QsSUFBSSxVQUFVLEtBQUssQ0FBQyxFQUFFO3dCQUNwQixJQUFJLENBQUMsd0JBQXdCLEdBQUcsT0FBTyxhQUFhLGlCQUFpQixDQUFDO3FCQUN2RTt5QkFBTTt3QkFDTCxJQUFJLENBQUMsd0JBQXdCLEdBQUcsT0FBTyxhQUFhLFlBQVksQ0FBQztxQkFDbEU7b0JBQ0QsSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUNsQzthQUNGO2lCQUFNO2dCQUNMLElBQUksQ0FBQyx3QkFBd0IsR0FBRyxrQkFBa0IsQ0FBQztnQkFDbkQsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQ25DO1NBQ0Y7YUFBTTtZQUNMLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNsQyxJQUFJLEtBQUssSUFBSSxJQUFJLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsRUFBRTtnQkFDeEMsSUFBSSxDQUFDLHdCQUF3QixHQUFHLHNCQUFzQixDQUFDO2FBQ3hEO2lCQUFNO2dCQUNMLElBQUksQ0FBQyx3QkFBd0IsR0FBRyxrQkFBa0IsQ0FBQzthQUNwRDtTQUNGO0lBQ0gsQ0FBQztJQUNPLDBCQUEwQixDQUFDLENBQUM7UUFDbEMsK0JBQStCO1FBQy9CLElBQUksQ0FBQyxDQUFDLE9BQU8sS0FBSyxFQUFFLEVBQUU7WUFDcEIsSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUM7U0FDcEM7UUFDRCxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUM7SUFDdEIsQ0FBQztJQUNPLDBCQUEwQjtRQUNoQyxJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztJQUNuQyxDQUFDO0lBQ08sMkJBQTJCO1FBQ2pDLElBQUksQ0FBQyxJQUFJLENBQUMsNEJBQTRCLEVBQUU7WUFDdEMsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxDQUFDO1lBQzVDLElBQUksYUFBYSxHQUNmLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQztZQUN2RSxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDOUQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7WUFDdEUsSUFBSSxDQUFDLHdCQUF3QixHQUFHLEdBQUcsYUFBYSxnQkFBZ0IsS0FBSyxHQUFHLENBQUM7U0FDMUU7SUFDSCxDQUFDO0lBQ08sdUJBQXVCO1FBQzdCLElBQ0UsSUFBSSxDQUFDLFNBQVM7WUFDZCxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU87WUFDdEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMscUJBQXFCLEVBQzVDO1lBQ0EsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUMsS0FBSztpQkFDN0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO2lCQUNsQixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDZCxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7Z0JBQ3BFLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQztnQkFDZCxLQUFLLE1BQU0sTUFBTSxJQUFJLENBQUMsRUFBRTtvQkFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztpQkFDdEI7Z0JBQ0QsT0FBTyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3BDLENBQUMsQ0FBQyxDQUFDO1lBQ0gsTUFBTSxRQUFRLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFDLElBQUksRUFBRSxZQUFZLEVBQUMsQ0FBQyxDQUFDO1lBQzNELE1BQU0sdUJBQXVCLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxvQkFBMkIsQ0FBQztZQUNuRSx1QkFBdUIsQ0FBQyxRQUFRLEdBQUcscUJBQXFCLENBQUM7WUFDekQsa0RBQWtEO1lBQ2xELE1BQU0sQ0FBQyxNQUFNLENBQUMsdUJBQXVCLEVBQUU7Z0JBQ3JDLElBQUksRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUMsUUFBUSxDQUFDO2FBQzlDLENBQUMsQ0FBQztZQUNILHVCQUF1QixDQUFDLEtBQUssRUFBRSxDQUFDO1NBQ2pDO0lBQ0gsQ0FBQztJQUNPLG9CQUFvQjtRQUMxQixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3ZDLElBQUksS0FBSyxJQUFJLElBQUksSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQ3hDLElBQUksSUFBSSxDQUFDLHNCQUFzQixLQUFLLEVBQUUsRUFBRTtnQkFDdEMsSUFBSSxDQUFDLG1CQUFtQixHQUFHLGtCQUFrQixDQUFDO2FBQy9DO2lCQUFNO2dCQUNMLElBQUksQ0FBQyxtQkFBbUIsR0FBRyx3QkFBd0IsSUFBSSxDQUFDLHNCQUFzQixHQUFHLENBQUM7YUFDbkY7WUFDRCxPQUFPO1NBQ1I7UUFDRCxJQUFJLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUU7WUFDNUMsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FDbkQsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxLQUFLLEtBQUssQ0FDcEUsQ0FBQyxNQUFNLENBQUM7WUFDVCxJQUFJLFVBQVUsS0FBSyxDQUFDLEVBQUU7Z0JBQ3BCLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxpQkFBaUIsQ0FBQzthQUM5QztpQkFBTTtnQkFDTCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLGNBQWMsSUFBSSxLQUFLLEVBQUU7b0JBQ2xELElBQUksQ0FBQyxtQkFBbUIsR0FBRyxzQkFBc0IsS0FBSyxNQUFNLFVBQVUsVUFBVSxDQUFDO2lCQUNsRjthQUNGO1NBQ0Y7SUFDSCxDQUFDO0lBQ08sb0JBQW9CO1FBQzFCLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDdkMsSUFBSSxLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEVBQUU7WUFDeEMsSUFBSSxDQUFDLHNCQUFzQixHQUFHLEVBQUUsQ0FBQztZQUNqQyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsa0JBQWtCLENBQUM7WUFDOUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzlDLE9BQU87U0FDUjtRQUNELElBQUksSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRTtZQUM1QyxJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUNuRCxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEtBQUssS0FBSyxDQUNwRSxDQUFDLE1BQU0sQ0FBQztZQUNULElBQUksVUFBVSxLQUFLLENBQUMsRUFBRTtnQkFDcEIsSUFBSSxDQUFDLG1CQUFtQixHQUFHLHdCQUF3QixJQUFJLENBQUMsc0JBQXNCLEdBQUcsQ0FBQzthQUNuRjtpQkFBTTtnQkFDTCxJQUFJLENBQUMsc0JBQXNCLEdBQUcsS0FBSyxDQUFDO2dCQUNwQyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsd0JBQXdCLEtBQUssTUFBTSxVQUFVLFVBQVUsQ0FBQztnQkFDbkYsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLEtBQUssQ0FBQyxDQUFDO2FBQ2xEO1NBQ0Y7SUFDSCxDQUFDO0lBQ08sc0JBQXNCO1FBQzVCLElBQUksQ0FBQyxjQUFjLEdBQUcsRUFBRSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO0lBQzlCLENBQUM7SUFDTyxjQUFjLENBQUMsZUFBdUIsRUFBRSxjQUFzQjtRQUNwRSxJQUFJLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUU7WUFDNUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLGVBQWUsRUFBRSxjQUFjLENBQUMsQ0FBQztTQUN4RTtJQUNILENBQUM7SUFDRCxnQkFBZ0IsQ0FBQyxhQUFzQjtRQUNyQyxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztJQUNyQyxDQUFDO0lBRUQsc0JBQXNCO1FBQ3BCLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDL0MsSUFBSSxJQUFJLENBQUMsY0FBYyxJQUFJLElBQUksRUFBRTtZQUMvQixPQUFPO1NBQ1I7UUFDRCxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FDOUIsSUFBSSxDQUFDLFdBQVcsRUFDaEIsSUFBSSxDQUFDLGNBQWMsRUFDbkIsQ0FBQyxFQUFFLEVBQUUsRUFBRTtZQUNMLElBQUksWUFBWSxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDO2lCQUNoRSxZQUFZLENBQUM7WUFDaEIsSUFBSSxDQUFDLFlBQVksQ0FBQyx5QkFBeUIsQ0FDekMsSUFBSSxDQUFDLFdBQVcsRUFDaEIsSUFBSSxDQUFDLGNBQWMsRUFDbkIsQ0FBQyxRQUFRLEVBQUUsRUFBRTtnQkFDWCxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxFQUFFLEVBQUUsUUFBUSxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQzNELENBQUMsQ0FDRixDQUFDO1FBQ0osQ0FBQyxDQUNGLENBQUM7UUFDRixJQUFJLENBQUMsU0FBUyxDQUFDLGlCQUFpQixDQUM5QixJQUFJLENBQUMsV0FBVyxFQUNoQixJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUNqRCxDQUFDO0lBQ0osQ0FBQztJQUVELGlDQUFpQyxDQUFDLFdBQVc7UUFDM0MsSUFBSSxDQUFDLFlBQVksQ0FBQyx1QkFBdUIsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUM5RCxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQztZQUM1QixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFVBQVU7aUJBQ3hDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQztpQkFDeEIsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUU7Z0JBQ2YsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQztnQkFDMUQsT0FBTyxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDNUQsQ0FBQyxDQUFDO2lCQUNELElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDYixJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzFDLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDMUMsZ0NBQWdDO2dCQUNoQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRTtvQkFDdEQsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUNuQztnQkFDRCxnQ0FBZ0M7Z0JBQ2hDLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdkMsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN2QyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxFQUFFO29CQUM1QixPQUFPLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztpQkFDeEI7Z0JBQ0QseUJBQXlCO2dCQUN6QixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNoQyxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNoQyxJQUFJLEtBQUssS0FBSyxLQUFLLEVBQUU7b0JBQ25CLE9BQU8sS0FBSyxHQUFHLEtBQUssQ0FBQztpQkFDdEI7Z0JBQ0Qsc0NBQXNDO2dCQUN0QyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDekIsQ0FBQyxDQUFDLENBQUM7WUFDTCxJQUFJLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtnQkFDcEMsT0FBTyxFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBQyxDQUFDO1lBQ3RFLENBQUMsQ0FBQyxDQUFDO1lBRUgseUVBQXlFO1lBQ3pFLE1BQU0sYUFBYSxHQUNqQixJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsS0FBSyxNQUFNO2dCQUNuQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVTtnQkFDL0MsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNmLElBQUksSUFBSSxDQUFDLGNBQWMsS0FBSyxhQUFhLEVBQUU7Z0JBQ3pDLHNFQUFzRTtnQkFDdEUscUNBQXFDO2dCQUNyQyxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQzthQUMvQjtpQkFBTTtnQkFDTCxJQUFJLENBQUMsY0FBYyxHQUFHLGFBQWEsQ0FBQzthQUNyQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUdELDJCQUEyQjtRQUN6QixJQUFJLENBQUMsU0FBUyxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO0lBQ2xFLENBQUM7SUFFRCwrQkFBK0I7UUFDN0IsSUFBSSxXQUF3QixDQUFDO1FBQzdCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUNqRCxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyx1QkFBdUIsRUFBRTtnQkFDOUQsV0FBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ25DLE1BQU07YUFDUDtTQUNGO1FBQ0QsSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUNoQixPQUFPO1NBQ1I7UUFDRCxJQUFJLENBQUMsa0NBQWtDLEdBQUcsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQztRQUM1RSxJQUFJLFdBQVcsQ0FBQyxHQUFHLElBQUksSUFBSSxFQUFFO1lBQzNCLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxJQUFJLENBQUM7U0FDbkM7YUFBTSxJQUFJLFdBQVcsQ0FBQyxLQUFLLEVBQUU7WUFDNUIsSUFBSSxLQUFLLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtnQkFDekMsT0FBTztvQkFDTCxLQUFLLEVBQUUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO29CQUNsQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7b0JBQ2pCLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSztpQkFDbEIsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDO1lBQ0gsSUFBSSxDQUFDLHFCQUFxQixHQUFHLEVBQUMsS0FBSyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztTQUN4RDthQUFNO1lBQ0wsSUFBSSxDQUFDLHFCQUFxQixHQUFHO2dCQUMzQixLQUFLLEVBQUUsSUFBSTtnQkFDWCxVQUFVLEVBQUUsV0FBVyxDQUFDLFVBQVU7YUFDbkMsQ0FBQztTQUNIO1FBQ0Qsc0RBQXNEO0lBQ3hELENBQUM7SUFDTyxxQkFBcUIsQ0FBQyxXQUF3QixFQUFFLFFBQWdCO1FBQ3RFLGVBQWUsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRTtZQUNsQyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLGtCQUFrQixDQUFvQixDQUFDO1lBQ3RFLGNBQWMsQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDO1lBQ3BDLGNBQWMsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDO1lBQ2hDLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ25DLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUNPLHVCQUF1QixDQUFDLFdBQXdCLEVBQUUsUUFBZ0I7UUFDeEUsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxFQUFFLEVBQUU7WUFDekMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzNFLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUNPLHNCQUFzQixDQUFDLFVBQWtCO1FBQy9DLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDL0QsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLENBQUMsVUFBVSxLQUFLLFVBQVUsRUFBRTtnQkFDL0IsT0FBTyxDQUFDLENBQUM7YUFDVjtTQUNGO0lBQ0gsQ0FBQztJQUNPLGtCQUFrQjtRQUN4QixvQ0FBb0M7UUFDcEMsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQXFCLENBQUM7UUFDdkQsU0FBUyxDQUFDLFFBQVEsR0FBRyxHQUFHLEVBQUU7WUFDeEIsTUFBTSxJQUFJLEdBQVMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN0Qyx5RUFBeUU7WUFDekUsMkNBQTJDO1lBQzNDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO1lBQ3JCLE1BQU0sVUFBVSxHQUFHLElBQUksVUFBVSxFQUFFLENBQUM7WUFDcEMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLEdBQUcsRUFBRSxFQUFFO2dCQUMxQixNQUFNLE9BQU8sR0FBZ0IsVUFBVSxDQUFDLE1BQXFCLENBQUM7Z0JBQzlELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2pELENBQUMsQ0FBQztZQUNGLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQyxDQUFDLENBQUM7UUFDRixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFzQixDQUFDO1FBQ3JFLFlBQVksQ0FBQyxPQUFPLEdBQUcsR0FBRyxFQUFFO1lBQzFCLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNwQixDQUFDLENBQUM7UUFDRiw2Q0FBNkM7UUFDN0MsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFxQixDQUFDO1FBQ3hFLGlCQUFpQixDQUFDLFFBQVEsR0FBRyxHQUFHLEVBQUU7WUFDaEMsTUFBTSxJQUFJLEdBQVMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzlDLHlFQUF5RTtZQUN6RSwyQ0FBMkM7WUFDM0MsaUJBQWlCLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQztZQUM3QixNQUFNLFVBQVUsR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ3BDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQkFDMUIsTUFBTSxRQUFRLEdBQWdCLFVBQVUsQ0FBQyxNQUFxQixDQUFDO2dCQUMvRCxJQUFJLENBQUMsdUJBQXVCLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNwRCxDQUFDLENBQUM7WUFDRixVQUFVLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckMsQ0FBQyxDQUFDO1FBQ0YsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUNsQyxrQkFBa0IsQ0FDRSxDQUFDO1FBQ3ZCLG9CQUFvQixDQUFDLE9BQU8sR0FBRyxHQUFHLEVBQUU7WUFDbEMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDNUIsQ0FBQyxDQUFDO1FBQ0YsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsS0FBSyxNQUFNLEVBQUU7WUFDeEMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBaUIsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQztZQUNyRSxJQUFJLENBQUMsRUFBRSxDQUFDLGdDQUFnQyxDQUFpQixDQUFDLEtBQUssQ0FBQyxPQUFPO2dCQUN0RSxNQUFNLENBQUM7WUFDUixJQUFJLENBQUMsRUFBRSxDQUFDLHdCQUF3QixDQUFpQixDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDO1NBQzNFO1FBQ0EsSUFBSSxDQUFDLEVBQUUsQ0FBQyw4QkFBOEIsQ0FBaUIsQ0FBQyxLQUFLLENBQUMsT0FBTztZQUNwRSxNQUFNLENBQUM7UUFDVCxpQ0FBaUM7UUFDakMsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUNyQyw0QkFBNEIsQ0FDTixDQUFDO1FBQ3pCLE1BQU0sMkJBQTJCLEdBQW9CO1lBQ25ELFVBQVUsRUFBRTtnQkFDVjtvQkFDRSxVQUFVLEVBQUUsV0FBVztvQkFDdkIsV0FBVyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztvQkFDdkIsVUFBVSxFQUFFLG1EQUFtRDtvQkFDL0QsWUFBWSxFQUNWLDZEQUE2RDtpQkFDaEU7YUFDRjtTQUNGLENBQUM7UUFDRixJQUFJLENBQUMsOEJBQThCLENBQ2pDLHVCQUF1QixFQUN2QiwyQkFBMkIsQ0FDNUIsQ0FBQztRQUNGLG9DQUFvQztRQUNwQyxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxFQUFFLENBQ2pDLHlCQUF5QixDQUNOLENBQUM7UUFDdEIsbUJBQW1CLENBQUMsUUFBUSxHQUFHLEdBQUcsRUFBRTtZQUNsQyxJQUFLLG1CQUEyQixDQUFDLE9BQU8sRUFBRTtnQkFDeEMsMkJBQTJCLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBRztvQkFDakQsU0FBUyxFQUFFLDRDQUE0QztvQkFDdkQsY0FBYyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQztpQkFDekIsQ0FBQzthQUNIO2lCQUFNO2dCQUNMLE9BQU8sMkJBQTJCLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQzthQUN6RDtZQUNELElBQUksQ0FBQyw4QkFBOEIsQ0FDakMsdUJBQXVCLEVBQ3ZCLDJCQUEyQixDQUM1QixDQUFDO1FBQ0osQ0FBQyxDQUFDO1FBQ0YsTUFBTSxzQkFBc0IsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUNwQyw0QkFBNEIsQ0FDVCxDQUFDO1FBQ3RCLHNCQUFzQixDQUFDLFFBQVEsR0FBRyxHQUFHLEVBQUU7WUFDckMsSUFBSyxzQkFBOEIsQ0FBQyxPQUFPLEVBQUU7Z0JBQzNDLDJCQUEyQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhO29CQUNyRCxxREFBcUQsQ0FBQzthQUN6RDtpQkFBTTtnQkFDTCxPQUFPLDJCQUEyQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUM7YUFDaEU7WUFDRCxJQUFJLENBQUMsOEJBQThCLENBQ2pDLHVCQUF1QixFQUN2QiwyQkFBMkIsQ0FDNUIsQ0FBQztRQUNKLENBQUMsQ0FBQztRQUNGLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FDbkMsMkJBQTJCLENBQ1IsQ0FBQztRQUN0QixxQkFBcUIsQ0FBQyxRQUFRLEdBQUcsR0FBRyxFQUFFO1lBQ3BDLElBQUsscUJBQTBDLENBQUMsT0FBTyxFQUFFO2dCQUN2RCwyQkFBMkIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWTtvQkFDcEQsNkRBQTZELENBQUM7YUFDakU7aUJBQU07Z0JBQ0wsT0FBTywyQkFBMkIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDO2FBQy9EO1lBQ0QsSUFBSSxDQUFDLDhCQUE4QixDQUNqQyx1QkFBdUIsRUFDdkIsMkJBQTJCLENBQzVCLENBQUM7UUFDSixDQUFDLENBQUM7UUFDRixrREFBa0Q7UUFDbEQsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUNyQyx1QkFBdUIsQ0FDSixDQUFDO1FBQ3RCLE1BQU0sMkJBQTJCLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3BFLE1BQU0sMEJBQTBCLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO1FBQ3hFLHVCQUF1QixDQUFDLFFBQVEsR0FBRyxHQUFHLEVBQUU7WUFDdEMsSUFBSSxnQkFBZ0IsR0FDbEIsUUFBUSxDQUFDLFFBQVE7Z0JBQ2pCLElBQUk7Z0JBQ0osUUFBUSxDQUFDLElBQUk7Z0JBQ2IsUUFBUSxDQUFDLFFBQVE7Z0JBQ2pCLFVBQVU7Z0JBQ1QsdUJBQTRDLENBQUMsS0FBSyxDQUFDO1lBQ3JELDJCQUFnRCxDQUFDLEtBQUssR0FBRyxnQkFBZ0IsQ0FBQztZQUMzRSxrREFBa0Q7WUFDbEQsTUFBTSxDQUFDLE1BQU0sQ0FBQywwQkFBNkMsRUFBRTtnQkFDM0QsSUFBSSxFQUFFLGdCQUFnQjthQUN2QixDQUFDLENBQUM7UUFDTCxDQUFDLENBQUM7SUFDSixDQUFDO0lBQ08sOEJBQThCLENBQ3BDLHVCQUE0QyxFQUM1QyxNQUF1QjtRQUV2Qix1QkFBdUIsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FDNUMsTUFBTSxFQUNOLElBQUk7UUFDSixlQUFlLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixDQUNyQyxDQUFDO0lBQ0osQ0FBQztJQUNELG1CQUFtQjtRQUNqQixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxLQUFLLENBQUM7WUFDbEMsQ0FBQyxDQUFDLFVBQVU7WUFDWixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDO0lBQzNDLENBQUM7SUFDRCxnQkFBZ0I7UUFDZCxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUM7WUFDL0IsQ0FBQyxDQUFDLE9BQU87WUFDVCxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDO0lBQ3JDLENBQUM7SUFDRCxVQUFVLENBQUMsT0FBYztRQUN2QixPQUFPLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQzVCLENBQUM7SUFDRCxXQUFXLENBQUMsT0FBYztRQUN4QixPQUFPLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQzVCLENBQUM7SUFDRCxlQUFlO1FBQ1osSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFrQixDQUFDLElBQUksRUFBRSxDQUFDO0lBQ3BDLENBQUM7SUFDRCxpQkFBaUI7UUFDZCxJQUFJLENBQUMsQ0FBQyxDQUFDLHFCQUE2QixDQUFDLElBQUksRUFBRSxDQUFDO0lBQy9DLENBQUM7Q0FDRixDQUFBO0FBN3JCaUIsa0JBQVEsR0FBRyxRQUFRLENBQUM7QUFHcEM7SUFEQyxRQUFRLENBQUMsRUFBQyxJQUFJLEVBQUUsTUFBTSxFQUFDLENBQUM7O2lEQUNGO0FBRXZCO0lBREMsUUFBUSxDQUFDLEVBQUMsSUFBSSxFQUFFLE1BQU0sRUFBQyxDQUFDOzs4Q0FDTDtBQUVwQjtJQURDLFFBQVEsQ0FBQyxFQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBQyxDQUFDOzswREFDUDtBQUVoQztJQURDLFFBQVEsQ0FBQyxFQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBQyxDQUFDOztzREFDWDtBQUU1QjtJQURDLFFBQVEsQ0FBQyxFQUFDLElBQUksRUFBRSxPQUFPLEVBQUMsQ0FBQzs7Z0RBQ0g7QUFFdkI7SUFEQyxRQUFRLENBQUMsRUFBQyxJQUFJLEVBQUUsT0FBTyxFQUFDLENBQUM7O3FFQUNrQjtBQUU1QztJQURDLFFBQVEsQ0FBQyxFQUFDLElBQUksRUFBRSxNQUFNLEVBQUMsQ0FBQzs7c0RBQ0c7QUFFNUI7SUFEQyxRQUFRLENBQUMsRUFBQyxJQUFJLEVBQUUsTUFBTSxFQUFDLENBQUM7OzJEQUM2QjtBQUV0RDtJQURDLFFBQVEsQ0FBQyxFQUFDLElBQUksRUFBRSxNQUFNLEVBQUMsQ0FBQzs7dURBQ0k7QUFFN0I7SUFEQyxRQUFRLENBQUMsRUFBQyxJQUFJLEVBQUUsT0FBTyxFQUFDLENBQUM7OytEQUNZO0FBRXRDO0lBREMsUUFBUSxDQUFDLEVBQUMsSUFBSSxFQUFFLE1BQU0sRUFBQyxDQUFDOztpREFDRjtBQUV2QjtJQURDLFFBQVEsQ0FBQyxFQUFDLElBQUksRUFBRSxNQUFNLEVBQUMsQ0FBQzs7c0RBQ3FCO0FBRTlDO0lBREMsUUFBUSxDQUFDLEVBQUMsSUFBSSxFQUFFLE1BQU0sRUFBQyxDQUFDOztrREFDRDtBQUV4QjtJQURDLFFBQVEsQ0FBQyxFQUFDLElBQUksRUFBRSxPQUFPLEVBQUMsQ0FBQzs7d0RBQ2E7QUFFdkM7SUFEQyxRQUFRLENBQUMsRUFBQyxJQUFJLEVBQUUsT0FBTyxFQUFDLENBQUM7O21EQUNRO0FBRWxDO0lBREMsUUFBUSxDQUFDLEVBQUMsSUFBSSxFQUFFLE9BQU8sRUFBQyxDQUFDOztrREFDTztBQUdqQztJQURDLFFBQVEsQ0FBQyxFQUFDLElBQUksRUFBRSxNQUFNLEVBQUMsQ0FBQzs7aURBQ1c7QUE2V3BDO0lBREMsT0FBTyxDQUFDLGdCQUFnQixDQUFDOzs7O3VEQXlCekI7QUFFRDtJQURDLE9BQU8sQ0FBQyxhQUFhLENBQUM7Ozs7a0VBaUR0QjtBQUdEO0lBREMsT0FBTyxDQUFDLHFCQUFxQixDQUFDOzs7OzREQUc5QjtBQUVEO0lBREMsT0FBTyxDQUFDLHlCQUF5QixDQUFDOzs7O2dFQStCbEM7QUFqZ0JHLFNBQVM7SUFEZCxhQUFhLENBQUMseUJBQXlCLENBQUM7R0FDbkMsU0FBUyxDQThyQmQiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBDb3B5cmlnaHQgMjAxNiBUaGUgVGVuc29yRmxvdyBBdXRob3JzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5pbXBvcnQge1BvbHltZXJFbGVtZW50fSBmcm9tICdAcG9seW1lci9wb2x5bWVyJztcbmltcG9ydCB7Y3VzdG9tRWxlbWVudCwgcHJvcGVydHksIG9ic2VydmV9IGZyb20gJ0Bwb2x5bWVyL2RlY29yYXRvcnMnO1xuaW1wb3J0ICogYXMgZDMgZnJvbSAnZDMnO1xuXG5pbXBvcnQge0xlZ2FjeUVsZW1lbnRNaXhpbn0gZnJvbSAnLi4vY29tcG9uZW50cy9wb2x5bWVyL2xlZ2FjeV9lbGVtZW50X21peGluJztcbmltcG9ydCAnLi4vY29tcG9uZW50cy9wb2x5bWVyL2lyb25zX2FuZF9wYXBlcnMnO1xuXG5pbXBvcnQge3RlbXBsYXRlfSBmcm9tICcuL3Z6LXByb2plY3Rvci1kYXRhLXBhbmVsLmh0bWwnO1xuaW1wb3J0IHtcbiAgQ29sb3JMZWdlbmRUaHJlc2hvbGQsXG4gIENvbG9yTGVnZW5kUmVuZGVySW5mbyxcbn0gZnJvbSAnLi92ei1wcm9qZWN0b3ItbGVnZW5kJztcbmltcG9ydCAnLi92ei1wcm9qZWN0b3ItbGVnZW5kJztcbmltcG9ydCB7XG4gIENvbHVtblN0YXRzLFxuICBDb2xvck9wdGlvbixcbiAgU3ByaXRlQW5kTWV0YWRhdGFJbmZvLFxuICBQcm9qZWN0aW9uLFxufSBmcm9tICcuL2RhdGEnO1xuaW1wb3J0IHtcbiAgRGF0YVByb3ZpZGVyLFxuICBFbWJlZGRpbmdJbmZvLFxuICBQcm9qZWN0b3JDb25maWcsXG4gIHBhcnNlUmF3TWV0YWRhdGEsXG4gIHBhcnNlUmF3VGVuc29ycyxcbn0gZnJvbSAnLi9kYXRhLXByb3ZpZGVyJztcbmltcG9ydCAqIGFzIGtubiBmcm9tICcuL2tubic7XG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gJy4vdXRpbCc7XG5cbkBjdXN0b21FbGVtZW50KCd2ei1wcm9qZWN0b3ItZGF0YS1wYW5lbCcpXG5jbGFzcyBEYXRhUGFuZWwgZXh0ZW5kcyBMZWdhY3lFbGVtZW50TWl4aW4oUG9seW1lckVsZW1lbnQpIHtcbiAgc3RhdGljIHJlYWRvbmx5IHRlbXBsYXRlID0gdGVtcGxhdGU7XG5cbiAgQHByb3BlcnR5KHt0eXBlOiBTdHJpbmd9KVxuICBzZWxlY3RlZFRlbnNvcjogc3RyaW5nO1xuICBAcHJvcGVydHkoe3R5cGU6IFN0cmluZ30pXG4gIHNlbGVjdGVkUnVuOiBzdHJpbmc7XG4gIEBwcm9wZXJ0eSh7dHlwZTogU3RyaW5nLCBub3RpZnk6IHRydWV9KVxuICBzZWxlY3RlZENvbG9yT3B0aW9uTmFtZTogc3RyaW5nO1xuICBAcHJvcGVydHkoe3R5cGU6IFN0cmluZywgbm90aWZ5OiB0cnVlfSlcbiAgc2VsZWN0ZWRMYWJlbE9wdGlvbjogc3RyaW5nO1xuICBAcHJvcGVydHkoe3R5cGU6IEJvb2xlYW59KVxuICBub3JtYWxpemVEYXRhOiBib29sZWFuO1xuICBAcHJvcGVydHkoe3R5cGU6IEJvb2xlYW59KVxuICBzaG93Rm9yY2VDYXRlZ29yaWNhbENvbG9yc0NoZWNrYm94OiBib29sZWFuO1xuICBAcHJvcGVydHkoe3R5cGU6IFN0cmluZ30pXG4gIG1ldGFkYXRhRWRpdG9ySW5wdXQ6IHN0cmluZztcbiAgQHByb3BlcnR5KHt0eXBlOiBTdHJpbmd9KVxuICBtZXRhZGF0YUVkaXRvcklucHV0TGFiZWw6IHN0cmluZyA9ICdUYWcgc2VsZWN0aW9uIGFzJztcbiAgQHByb3BlcnR5KHt0eXBlOiBTdHJpbmd9KVxuICBtZXRhZGF0YUVkaXRvckNvbHVtbjogc3RyaW5nO1xuICBAcHJvcGVydHkoe3R5cGU6IEJvb2xlYW59KVxuICBtZXRhZGF0YUVkaXRvckJ1dHRvbkRpc2FibGVkOiBib29sZWFuO1xuICBAcHJvcGVydHkoe3R5cGU6IFN0cmluZ30pXG4gIHN1cGVydmlzZUlucHV0OiBzdHJpbmc7XG4gIEBwcm9wZXJ0eSh7dHlwZTogU3RyaW5nfSlcbiAgc3VwZXJ2aXNlSW5wdXRMYWJlbDogc3RyaW5nID0gJ0lnbm9yZWQgbGFiZWwnO1xuICBAcHJvcGVydHkoe3R5cGU6IFN0cmluZ30pXG4gIHN1cGVydmlzZUNvbHVtbjogc3RyaW5nO1xuICBAcHJvcGVydHkoe3R5cGU6IEJvb2xlYW59KVxuICBzaG93U3VwZXJ2aXNlU2V0dGluZ3M6IGJvb2xlYW4gPSBmYWxzZTtcbiAgQHByb3BlcnR5KHt0eXBlOiBCb29sZWFufSlcbiAgc2hvd0VkaXRTZXR0aW5nczogYm9vbGVhbiA9IGZhbHNlO1xuICBAcHJvcGVydHkoe3R5cGU6IEJvb2xlYW59KVxuICBzaG93RFZJU2V0dGluZ3M6IGJvb2xlYW4gPSBmYWxzZTtcblxuICBAcHJvcGVydHkoe3R5cGU6IFN0cmluZ30pXG4gIHJlYWRvbmx5IF93b3JkRGVsaW1pdGVyID0gJ1svPV8sLV0nO1xuXG4gIHByaXZhdGUgbGFiZWxPcHRpb25zOiBzdHJpbmdbXTtcbiAgcHJpdmF0ZSBjb2xvck9wdGlvbnM6IENvbG9yT3B0aW9uW107XG4gIGZvcmNlQ2F0ZWdvcmljYWxDb2xvcmluZzogYm9vbGVhbiA9IGZhbHNlO1xuICBwcml2YXRlIHN1cGVydmlzZUlucHV0U2VsZWN0ZWQ6IHN0cmluZztcbiAgcHJpdmF0ZSBzZWxlY3RlZFBvaW50SW5kaWNlczogbnVtYmVyW107XG4gIHByaXZhdGUgbmVpZ2hib3JzT2ZGaXJzdFBvaW50OiBrbm4uTmVhcmVzdEVudHJ5W107XG4gIHByaXZhdGUgZGF0YVByb3ZpZGVyOiBEYXRhUHJvdmlkZXI7XG4gIHByaXZhdGUgdGVuc29yTmFtZXM6IHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgc2hhcGU6IG51bWJlcltdO1xuICB9W107XG4gIHByaXZhdGUgcnVuTmFtZXM6IHN0cmluZ1tdO1xuICBwcml2YXRlIHByb2plY3RvcjogYW55OyAvLyBQcm9qZWN0b3I7IHR5cGUgb21pdHRlZCBiL2MgTGVnYWN5RWxlbWVudFxuICBwcml2YXRlIHByb2plY3RvckNvbmZpZzogUHJvamVjdG9yQ29uZmlnO1xuICBwcml2YXRlIGNvbG9yTGVnZW5kUmVuZGVySW5mbzogQ29sb3JMZWdlbmRSZW5kZXJJbmZvO1xuICBwcml2YXRlIHNwcml0ZUFuZE1ldGFkYXRhOiBTcHJpdGVBbmRNZXRhZGF0YUluZm87XG4gIHByaXZhdGUgbWV0YWRhdGFGaWxlOiBzdHJpbmc7XG4gIHByaXZhdGUgbWV0YWRhdGFGaWVsZHM6IHN0cmluZ1tdO1xuXG4gIHJlYWR5KCkge1xuICAgIHN1cGVyLnJlYWR5KCk7XG4gICAgdGhpcy5ub3JtYWxpemVEYXRhID0gdHJ1ZTtcbiAgICB0aGlzLnN1cGVydmlzZUlucHV0U2VsZWN0ZWQgPSAnJztcbiAgfVxuICBpbml0aWFsaXplKHByb2plY3RvcjogYW55LCBkcDogRGF0YVByb3ZpZGVyKSB7XG4gICAgdGhpcy5wcm9qZWN0b3IgPSBwcm9qZWN0b3I7XG4gICAgdGhpcy5kYXRhUHJvdmlkZXIgPSBkcDtcbiAgICB0aGlzLnNldHVwVXBsb2FkQnV0dG9ucygpO1xuICAgIC8vIFRlbGwgdGhlIHByb2plY3RvciB3aGVuZXZlciB0aGUgZGF0YSBub3JtYWxpemF0aW9uIGNoYW5nZXMuXG4gICAgLy8gVW5rbm93biB3aHksIGJ1dCB0aGUgcG9seW1lciBjaGVja2JveCBidXR0b24gc3RvcHMgd29ya2luZyBhcyBzb29uIGFzXG4gICAgLy8geW91IGRvIGQzLnNlbGVjdCgpIG9uIGl0LlxuICAgIHRoaXMuJCQoJyNub3JtYWxpemUtZGF0YS1jaGVja2JveCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgIHRoaXMucHJvamVjdG9yLnNldE5vcm1hbGl6ZURhdGEodGhpcy5ub3JtYWxpemVEYXRhKTtcbiAgICB9KTtcbiAgICBsZXQgZm9yY2VDYXRlZ29yaWNhbENvbG9yaW5nQ2hlY2tib3ggPSB0aGlzLiQkKFxuICAgICAgJyNmb3JjZS1jYXRlZ29yaWNhbC1jaGVja2JveCdcbiAgICApO1xuICAgIGZvcmNlQ2F0ZWdvcmljYWxDb2xvcmluZ0NoZWNrYm94LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgIHRoaXMuc2V0Rm9yY2VDYXRlZ29yaWNhbENvbG9yaW5nKFxuICAgICAgICAoZm9yY2VDYXRlZ29yaWNhbENvbG9yaW5nQ2hlY2tib3ggYXMgSFRNTElucHV0RWxlbWVudCkuY2hlY2tlZFxuICAgICAgKTtcbiAgICB9KTtcbiAgICAvLyBHZXQgYWxsIHRoZSBydW5zLlxuICAgIHRoaXMuZGF0YVByb3ZpZGVyLnJldHJpZXZlUnVucygocnVucykgPT4ge1xuICAgICAgdGhpcy5ydW5OYW1lcyA9IHJ1bnM7XG4gICAgICAvLyBDaG9vc2UgdGhlIGZpcnN0IHJ1biBieSBkZWZhdWx0LlxuICAgICAgaWYgKHRoaXMucnVuTmFtZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBpZiAodGhpcy5zZWxlY3RlZFJ1biAhPSBydW5zWzBdKSB7XG4gICAgICAgICAgLy8gVGhpcyBzZXQgb3BlcmF0aW9uIHdpbGwgYXV0b21hdGljYWxseSB0cmlnZ2VyIHRoZSBvYnNlcnZlci5cbiAgICAgICAgICB0aGlzLnNlbGVjdGVkUnVuID0gcnVuc1swXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBFeHBsaWNpdGx5IGxvYWQgdGhlIHByb2plY3RvciBjb25maWcuIFdlIGV4cGxpY2l0bHkgbG9hZCBiZWNhdXNlXG4gICAgICAgICAgLy8gdGhlIHJ1biBuYW1lIHN0YXlzIHRoZSBzYW1lLCB3aGljaCBtZWFucyB0aGF0IHRoZSBvYnNlcnZlciB3b24ndFxuICAgICAgICAgIC8vIGFjdHVhbGx5IGJlIHRyaWdnZXJlZCBieSBzZXR0aW5nIHRoZSBzZWxlY3RlZCBydW4uXG4gICAgICAgICAgdGhpcy5fZ2VuZXJhdGVVaUZvck5ld0NoZWNrcG9pbnRGb3JSdW4odGhpcy5zZWxlY3RlZFJ1bik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICBzZXRGb3JjZUNhdGVnb3JpY2FsQ29sb3JpbmcoZm9yY2VDYXRlZ29yaWNhbENvbG9yaW5nOiBib29sZWFuKSB7XG4gICAgdGhpcy5mb3JjZUNhdGVnb3JpY2FsQ29sb3JpbmcgPSBmb3JjZUNhdGVnb3JpY2FsQ29sb3Jpbmc7XG4gICAgKHRoaXMuJCQoXG4gICAgICAnI2ZvcmNlLWNhdGVnb3JpY2FsLWNoZWNrYm94J1xuICAgICkgYXMgSFRNTElucHV0RWxlbWVudCkuY2hlY2tlZCA9IHRoaXMuZm9yY2VDYXRlZ29yaWNhbENvbG9yaW5nO1xuICAgIHRoaXMudXBkYXRlTWV0YWRhdGFVSSh0aGlzLnNwcml0ZUFuZE1ldGFkYXRhLnN0YXRzLCB0aGlzLm1ldGFkYXRhRmlsZSk7XG4gICAgLy8gVGhlIHNlbGVjdGVkIGNvbG9yIG9wdGlvbiBuYW1lIGRvZXNuJ3QgY2hhbmdlIHdoZW4gd2Ugc3dpdGNoIHRvIHVzaW5nXG4gICAgLy8gY2F0ZWdvcmljYWwgY29sb3JpbmcgZm9yIHN0YXRzIHdpdGggdG9vIG1hbnkgdW5pcXVlIHZhbHVlcywgc28gd2VcbiAgICAvLyBtYW51YWxseSBjYWxsIHRoaXMgcG9seW1lciBvYnNlcnZlciBzbyB0aGF0IHdlIHVwZGF0ZSB0aGUgVUkuXG4gICAgdGhpcy5fc2VsZWN0ZWRDb2xvck9wdGlvbk5hbWVDaGFuZ2VkKCk7XG4gIH1cbiAgZ2V0U2VwYXJhdG9yQ2xhc3MoaXNTZXBhcmF0b3I6IGJvb2xlYW4pOiBzdHJpbmcge1xuICAgIHJldHVybiBpc1NlcGFyYXRvciA/ICdzZXBhcmF0b3InIDogbnVsbDtcbiAgfVxuICBtZXRhZGF0YUNoYW5nZWQoXG4gICAgc3ByaXRlQW5kTWV0YWRhdGE6IFNwcml0ZUFuZE1ldGFkYXRhSW5mbyxcbiAgICBtZXRhZGF0YUZpbGU/OiBzdHJpbmdcbiAgKSB7XG4gICAgdGhpcy5zcHJpdGVBbmRNZXRhZGF0YSA9IHNwcml0ZUFuZE1ldGFkYXRhO1xuICAgIGlmIChtZXRhZGF0YUZpbGUgIT0gbnVsbCkge1xuICAgICAgdGhpcy5tZXRhZGF0YUZpbGUgPSBtZXRhZGF0YUZpbGU7XG4gICAgfVxuICAgIHRoaXMudXBkYXRlTWV0YWRhdGFVSSh0aGlzLnNwcml0ZUFuZE1ldGFkYXRhLnN0YXRzLCB0aGlzLm1ldGFkYXRhRmlsZSk7XG4gICAgaWYgKFxuICAgICAgdGhpcy5zZWxlY3RlZENvbG9yT3B0aW9uTmFtZSA9PSBudWxsIHx8XG4gICAgICB0aGlzLmNvbG9yT3B0aW9ucy5maWx0ZXIoKGMpID0+IGMubmFtZSA9PT0gdGhpcy5zZWxlY3RlZENvbG9yT3B0aW9uTmFtZSlcbiAgICAgICAgLmxlbmd0aCA9PT0gMFxuICAgICkge1xuICAgICAgdGhpcy5zZWxlY3RlZENvbG9yT3B0aW9uTmFtZSA9IHRoaXMuY29sb3JPcHRpb25zWzBdLm5hbWU7XG4gICAgfVxuICAgIGxldCBsYWJlbEluZGV4ID0gLTE7XG4gICAgdGhpcy5tZXRhZGF0YUZpZWxkcyA9IHNwcml0ZUFuZE1ldGFkYXRhLnN0YXRzLm1hcCgoc3RhdHMsIGkpID0+IHtcbiAgICAgIGlmICghc3RhdHMuaXNOdW1lcmljICYmIGxhYmVsSW5kZXggPT09IC0xKSB7XG4gICAgICAgIGxhYmVsSW5kZXggPSBpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0YXRzLm5hbWU7XG4gICAgfSk7XG4gICAgaWYgKFxuICAgICAgdGhpcy5tZXRhZGF0YUVkaXRvckNvbHVtbiA9PSBudWxsIHx8XG4gICAgICB0aGlzLm1ldGFkYXRhRmllbGRzLmZpbHRlcigobmFtZSkgPT4gbmFtZSA9PT0gdGhpcy5tZXRhZGF0YUVkaXRvckNvbHVtbilcbiAgICAgICAgLmxlbmd0aCA9PT0gMFxuICAgICkge1xuICAgICAgLy8gTWFrZSB0aGUgZGVmYXVsdCBsYWJlbCB0aGUgZmlyc3Qgbm9uLW51bWVyaWMgY29sdW1uLlxuICAgICAgdGhpcy5tZXRhZGF0YUVkaXRvckNvbHVtbiA9IHRoaXMubWV0YWRhdGFGaWVsZHNbTWF0aC5tYXgoMCwgbGFiZWxJbmRleCldO1xuICAgIH1cbiAgICBpZiAoXG4gICAgICB0aGlzLnN1cGVydmlzZUNvbHVtbiA9PSBudWxsIHx8XG4gICAgICB0aGlzLm1ldGFkYXRhRmllbGRzLmZpbHRlcigobmFtZSkgPT4gbmFtZSA9PT0gdGhpcy5zdXBlcnZpc2VDb2x1bW4pXG4gICAgICAgIC5sZW5ndGggPT09IDBcbiAgICApIHtcbiAgICAgIC8vIE1ha2UgdGhlIGRlZmF1bHQgc3VwZXJ2aXNlIGNsYXNzIHRoZSBmaXJzdCBub24tbnVtZXJpYyBjb2x1bW4uXG4gICAgICB0aGlzLnN1cGVydmlzZUNvbHVtbiA9IHRoaXMubWV0YWRhdGFGaWVsZHNbTWF0aC5tYXgoMCwgbGFiZWxJbmRleCldO1xuICAgICAgdGhpcy5zdXBlcnZpc2VJbnB1dCA9ICcnO1xuICAgIH1cbiAgICB0aGlzLnN1cGVydmlzZUlucHV0Q2hhbmdlKCk7XG4gIH1cbiAgcHJvamVjdGlvbkNoYW5nZWQocHJvamVjdGlvbjogUHJvamVjdGlvbikge1xuICAgIGlmIChwcm9qZWN0aW9uKSB7XG4gICAgICBzd2l0Y2ggKHByb2plY3Rpb24ucHJvamVjdGlvblR5cGUpIHtcbiAgICAgICAgY2FzZSAndHNuZSc6XG4gICAgICAgICAgdGhpcy5zZXQoJ3Nob3dTdXBlcnZpc2VTZXR0aW5ncycsIGZhbHNlKTtcbiAgICAgICAgICB0aGlzLnNldCgnc2hvd0RWSVNldHRpbmdzJywgdHJ1ZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhpcy5zZXQoJ3Nob3dTdXBlcnZpc2VTZXR0aW5ncycsIGZhbHNlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgb25Qcm9qZWN0b3JTZWxlY3Rpb25DaGFuZ2VkKFxuICAgIHNlbGVjdGVkUG9pbnRJbmRpY2VzOiBudW1iZXJbXSxcbiAgICBuZWlnaGJvcnNPZkZpcnN0UG9pbnQ6IGtubi5OZWFyZXN0RW50cnlbXVxuICApIHtcbiAgICB0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzID0gc2VsZWN0ZWRQb2ludEluZGljZXM7XG4gICAgdGhpcy5uZWlnaGJvcnNPZkZpcnN0UG9pbnQgPSBuZWlnaGJvcnNPZkZpcnN0UG9pbnQ7XG4gICAgdGhpcy5tZXRhZGF0YUVkaXRvcklucHV0Q2hhbmdlKCk7XG4gIH1cbiAgcHJpdmF0ZSB1cGRhdGVNZXRhZGF0YVVJKGNvbHVtblN0YXRzOiBDb2x1bW5TdGF0c1tdLCBtZXRhZGF0YUZpbGU6IHN0cmluZykge1xuICAgIC8vIExhYmVsIGJ5IG9wdGlvbnMuXG4gICAgbGV0IGxhYmVsSW5kZXggPSAtMTtcbiAgICB0aGlzLmxhYmVsT3B0aW9ucyA9IGNvbHVtblN0YXRzLm1hcCgoc3RhdHMsIGkpID0+IHtcbiAgICAgIC8vIE1ha2UgdGhlIGRlZmF1bHQgbGFiZWwgYnkgdGhlIGZpcnN0IG5vbi1udW1lcmljIGNvbHVtbi5cbiAgICAgIGlmICghc3RhdHMuaXNOdW1lcmljICYmIGxhYmVsSW5kZXggPT09IC0xKSB7XG4gICAgICAgIGxhYmVsSW5kZXggPSBpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0YXRzLm5hbWU7XG4gICAgfSk7XG4gICAgaWYgKFxuICAgICAgdGhpcy5zZWxlY3RlZExhYmVsT3B0aW9uID09IG51bGwgfHxcbiAgICAgIHRoaXMubGFiZWxPcHRpb25zLmZpbHRlcigobmFtZSkgPT4gbmFtZSA9PT0gdGhpcy5zZWxlY3RlZExhYmVsT3B0aW9uKVxuICAgICAgICAubGVuZ3RoID09PSAwXG4gICAgKSB7XG4gICAgICB0aGlzLnNlbGVjdGVkTGFiZWxPcHRpb24gPSB0aGlzLmxhYmVsT3B0aW9uc1tNYXRoLm1heCgwLCBsYWJlbEluZGV4KV07XG4gICAgfVxuICAgIGlmIChcbiAgICAgIHRoaXMubWV0YWRhdGFFZGl0b3JDb2x1bW4gPT0gbnVsbCB8fFxuICAgICAgdGhpcy5sYWJlbE9wdGlvbnMuZmlsdGVyKChuYW1lKSA9PiBuYW1lID09PSB0aGlzLm1ldGFkYXRhRWRpdG9yQ29sdW1uKVxuICAgICAgICAubGVuZ3RoID09PSAwXG4gICAgKSB7XG4gICAgICB0aGlzLm1ldGFkYXRhRWRpdG9yQ29sdW1uID0gdGhpcy5sYWJlbE9wdGlvbnNbTWF0aC5tYXgoMCwgbGFiZWxJbmRleCldO1xuICAgIH1cbiAgICAvLyBDb2xvciBieSBvcHRpb25zLlxuICAgIGNvbnN0IHN0YW5kYXJkQ29sb3JPcHRpb246IENvbG9yT3B0aW9uW10gPSBbe25hbWU6ICdObyBjb2xvciBtYXAnfV07XG4gICAgY29uc3QgbWV0YWRhdGFDb2xvck9wdGlvbjogQ29sb3JPcHRpb25bXSA9IGNvbHVtblN0YXRzXG4gICAgICAuZmlsdGVyKChzdGF0cykgPT4ge1xuICAgICAgICByZXR1cm4gIXN0YXRzLnRvb01hbnlVbmlxdWVWYWx1ZXMgfHwgc3RhdHMuaXNOdW1lcmljO1xuICAgICAgfSlcbiAgICAgIC5tYXAoKHN0YXRzKSA9PiB7XG4gICAgICAgIGxldCBtYXA7XG4gICAgICAgIGxldCBpdGVtczoge1xuICAgICAgICAgIGxhYmVsOiBzdHJpbmc7XG4gICAgICAgICAgY291bnQ6IG51bWJlcjtcbiAgICAgICAgfVtdO1xuICAgICAgICBsZXQgdGhyZXNob2xkczogQ29sb3JMZWdlbmRUaHJlc2hvbGRbXTtcbiAgICAgICAgbGV0IGlzQ2F0ZWdvcmljYWwgPVxuICAgICAgICAgIHRoaXMuZm9yY2VDYXRlZ29yaWNhbENvbG9yaW5nIHx8ICFzdGF0cy50b29NYW55VW5pcXVlVmFsdWVzO1xuICAgICAgICBsZXQgZGVzYztcbiAgICAgICAgaWYgKGlzQ2F0ZWdvcmljYWwpIHtcbiAgICAgICAgICBjb25zdCBzY2FsZSA9IGQzLnNjYWxlT3JkaW5hbChkMy5zY2hlbWVDYXRlZ29yeTEwKTtcbiAgICAgICAgICBsZXQgcmFuZ2UgPSBzY2FsZS5yYW5nZSgpO1xuICAgICAgICAgIC8vIFJlLW9yZGVyIHRoZSByYW5nZS5cbiAgICAgICAgICBsZXQgbmV3UmFuZ2UgPSByYW5nZS5tYXAoKGNvbG9yLCBpKSA9PiB7XG4gICAgICAgICAgICBsZXQgaW5kZXggPSAoaSAqIDMpICUgcmFuZ2UubGVuZ3RoO1xuICAgICAgICAgICAgcmV0dXJuIHJhbmdlW2luZGV4XTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpdGVtcyA9IHN0YXRzLnVuaXF1ZUVudHJpZXM7XG4gICAgICAgICAgc2NhbGUucmFuZ2UobmV3UmFuZ2UpLmRvbWFpbihpdGVtcy5tYXAoKHgpID0+IHgubGFiZWwpKTtcbiAgICAgICAgICBtYXAgPSBzY2FsZTtcbiAgICAgICAgICBjb25zdCBsZW4gPSBzdGF0cy51bmlxdWVFbnRyaWVzLmxlbmd0aDtcbiAgICAgICAgICBkZXNjID1cbiAgICAgICAgICAgIGAke2xlbn0gJHtsZW4gPiByYW5nZS5sZW5ndGggPyAnIG5vbi11bmlxdWUnIDogJyd9IGAgKyBgY29sb3JzYDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJlc2hvbGRzID0gW1xuICAgICAgICAgICAge2NvbG9yOiAnI2ZmZmZkZCcsIHZhbHVlOiBzdGF0cy5taW59LFxuICAgICAgICAgICAge2NvbG9yOiAnIzFmMmQ4NicsIHZhbHVlOiBzdGF0cy5tYXh9LFxuICAgICAgICAgIF07XG4gICAgICAgICAgbWFwID0gZDNcbiAgICAgICAgICAgIC5zY2FsZUxpbmVhcjxzdHJpbmcsIHN0cmluZz4oKVxuICAgICAgICAgICAgLmRvbWFpbih0aHJlc2hvbGRzLm1hcCgodCkgPT4gdC52YWx1ZSkpXG4gICAgICAgICAgICAucmFuZ2UodGhyZXNob2xkcy5tYXAoKHQpID0+IHQuY29sb3IpKTtcbiAgICAgICAgICBkZXNjID0gJ2dyYWRpZW50JztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG5hbWU6IHN0YXRzLm5hbWUsXG4gICAgICAgICAgZGVzYzogZGVzYyxcbiAgICAgICAgICBtYXA6IG1hcCxcbiAgICAgICAgICBpdGVtczogaXRlbXMsXG4gICAgICAgICAgdGhyZXNob2xkczogdGhyZXNob2xkcyxcbiAgICAgICAgICB0b29NYW55VW5pcXVlVmFsdWVzOiBzdGF0cy50b29NYW55VW5pcXVlVmFsdWVzLFxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgaWYgKG1ldGFkYXRhQ29sb3JPcHRpb24ubGVuZ3RoID4gMCkge1xuICAgICAgLy8gQWRkIGEgc2VwYXJhdG9yIGxpbmUgYmV0d2VlbiBidWlsdC1pbiBjb2xvciBtYXBzXG4gICAgICAvLyBhbmQgdGhvc2UgYmFzZWQgb24gbWV0YWRhdGEgY29sdW1ucy5cbiAgICAgIHN0YW5kYXJkQ29sb3JPcHRpb24ucHVzaCh7bmFtZTogJ01ldGFkYXRhJywgaXNTZXBhcmF0b3I6IHRydWV9KTtcbiAgICB9XG4gICAgdGhpcy5jb2xvck9wdGlvbnMgPSBzdGFuZGFyZENvbG9yT3B0aW9uLmNvbmNhdChtZXRhZGF0YUNvbG9yT3B0aW9uKTtcbiAgfVxuICBwcml2YXRlIG1ldGFkYXRhRWRpdG9yQ29udGV4dChlbmFibGVkOiBib29sZWFuKSB7XG4gICAgdGhpcy5tZXRhZGF0YUVkaXRvckJ1dHRvbkRpc2FibGVkID0gIWVuYWJsZWQ7XG4gICAgaWYgKHRoaXMucHJvamVjdG9yKSB7XG4gICAgICB0aGlzLnByb2plY3Rvci5tZXRhZGF0YUVkaXRvckNvbnRleHQoZW5hYmxlZCwgdGhpcy5tZXRhZGF0YUVkaXRvckNvbHVtbik7XG4gICAgfVxuICB9XG4gIHByaXZhdGUgbWV0YWRhdGFFZGl0b3JJbnB1dENoYW5nZSgpIHtcbiAgICBsZXQgY29sID0gdGhpcy5tZXRhZGF0YUVkaXRvckNvbHVtbjtcbiAgICBsZXQgdmFsdWUgPSB0aGlzLm1ldGFkYXRhRWRpdG9ySW5wdXQ7XG4gICAgbGV0IHNlbGVjdGlvblNpemUgPVxuICAgICAgdGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcy5sZW5ndGggKyB0aGlzLm5laWdoYm9yc09mRmlyc3RQb2ludC5sZW5ndGg7XG4gICAgaWYgKHNlbGVjdGlvblNpemUgPiAwKSB7XG4gICAgICBpZiAodmFsdWUgIT0gbnVsbCAmJiB2YWx1ZS50cmltKCkgIT09ICcnKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICB0aGlzLnNwcml0ZUFuZE1ldGFkYXRhLnN0YXRzLmZpbHRlcigocykgPT4gcy5uYW1lID09PSBjb2wpWzBdXG4gICAgICAgICAgICAuaXNOdW1lcmljICYmXG4gICAgICAgICAgaXNOYU4oK3ZhbHVlKVxuICAgICAgICApIHtcbiAgICAgICAgICB0aGlzLm1ldGFkYXRhRWRpdG9ySW5wdXRMYWJlbCA9IGBMYWJlbCBtdXN0IGJlIG51bWVyaWNgO1xuICAgICAgICAgIHRoaXMubWV0YWRhdGFFZGl0b3JDb250ZXh0KGZhbHNlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgbnVtTWF0Y2hlcyA9IHRoaXMucHJvamVjdG9yLmRhdGFTZXQucG9pbnRzLmZpbHRlcihcbiAgICAgICAgICAgIChwKSA9PiBwLm1ldGFkYXRhW2NvbF0udG9TdHJpbmcoKSA9PT0gdmFsdWUudHJpbSgpXG4gICAgICAgICAgKS5sZW5ndGg7XG4gICAgICAgICAgaWYgKG51bU1hdGNoZXMgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMubWV0YWRhdGFFZGl0b3JJbnB1dExhYmVsID0gYFRhZyAke3NlbGVjdGlvblNpemV9IHdpdGggbmV3IGxhYmVsYDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5tZXRhZGF0YUVkaXRvcklucHV0TGFiZWwgPSBgVGFnICR7c2VsZWN0aW9uU2l6ZX0gcG9pbnRzIGFzYDtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5tZXRhZGF0YUVkaXRvckNvbnRleHQodHJ1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubWV0YWRhdGFFZGl0b3JJbnB1dExhYmVsID0gJ1RhZyBzZWxlY3Rpb24gYXMnO1xuICAgICAgICB0aGlzLm1ldGFkYXRhRWRpdG9yQ29udGV4dChmYWxzZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubWV0YWRhdGFFZGl0b3JDb250ZXh0KGZhbHNlKTtcbiAgICAgIGlmICh2YWx1ZSAhPSBudWxsICYmIHZhbHVlLnRyaW0oKSAhPT0gJycpIHtcbiAgICAgICAgdGhpcy5tZXRhZGF0YUVkaXRvcklucHV0TGFiZWwgPSAnU2VsZWN0IHBvaW50cyB0byB0YWcnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5tZXRhZGF0YUVkaXRvcklucHV0TGFiZWwgPSAnVGFnIHNlbGVjdGlvbiBhcyc7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHByaXZhdGUgbWV0YWRhdGFFZGl0b3JJbnB1dEtleWRvd24oZSkge1xuICAgIC8vIENoZWNrIGlmICdFbnRlcicgd2FzIHByZXNzZWRcbiAgICBpZiAoZS5rZXlDb2RlID09PSAxMykge1xuICAgICAgdGhpcy5tZXRhZGF0YUVkaXRvckJ1dHRvbkNsaWNrZWQoKTtcbiAgICB9XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgfVxuICBwcml2YXRlIG1ldGFkYXRhRWRpdG9yQ29sdW1uQ2hhbmdlKCkge1xuICAgIHRoaXMubWV0YWRhdGFFZGl0b3JJbnB1dENoYW5nZSgpO1xuICB9XG4gIHByaXZhdGUgbWV0YWRhdGFFZGl0b3JCdXR0b25DbGlja2VkKCkge1xuICAgIGlmICghdGhpcy5tZXRhZGF0YUVkaXRvckJ1dHRvbkRpc2FibGVkKSB7XG4gICAgICBsZXQgdmFsdWUgPSB0aGlzLm1ldGFkYXRhRWRpdG9ySW5wdXQudHJpbSgpO1xuICAgICAgbGV0IHNlbGVjdGlvblNpemUgPVxuICAgICAgICB0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzLmxlbmd0aCArIHRoaXMubmVpZ2hib3JzT2ZGaXJzdFBvaW50Lmxlbmd0aDtcbiAgICAgIHRoaXMucHJvamVjdG9yLm1ldGFkYXRhRWRpdCh0aGlzLm1ldGFkYXRhRWRpdG9yQ29sdW1uLCB2YWx1ZSk7XG4gICAgICB0aGlzLnByb2plY3Rvci5tZXRhZGF0YUVkaXRvckNvbnRleHQodHJ1ZSwgdGhpcy5tZXRhZGF0YUVkaXRvckNvbHVtbik7XG4gICAgICB0aGlzLm1ldGFkYXRhRWRpdG9ySW5wdXRMYWJlbCA9IGAke3NlbGVjdGlvblNpemV9IGxhYmVsZWQgYXMgJyR7dmFsdWV9J2A7XG4gICAgfVxuICB9XG4gIHByaXZhdGUgZG93bmxvYWRNZXRhZGF0YUNsaWNrZWQoKSB7XG4gICAgaWYgKFxuICAgICAgdGhpcy5wcm9qZWN0b3IgJiZcbiAgICAgIHRoaXMucHJvamVjdG9yLmRhdGFTZXQgJiZcbiAgICAgIHRoaXMucHJvamVjdG9yLmRhdGFTZXQuc3ByaXRlQW5kTWV0YWRhdGFJbmZvXG4gICAgKSB7XG4gICAgICBsZXQgdHN2RmlsZSA9IHRoaXMucHJvamVjdG9yLmRhdGFTZXQuc3ByaXRlQW5kTWV0YWRhdGFJbmZvLnN0YXRzXG4gICAgICAgIC5tYXAoKHMpID0+IHMubmFtZSlcbiAgICAgICAgLmpvaW4oJ1xcdCcpO1xuICAgICAgdGhpcy5wcm9qZWN0b3IuZGF0YVNldC5zcHJpdGVBbmRNZXRhZGF0YUluZm8ucG9pbnRzSW5mby5mb3JFYWNoKChwKSA9PiB7XG4gICAgICAgIGxldCB2YWxzID0gW107XG4gICAgICAgIGZvciAoY29uc3QgY29sdW1uIGluIHApIHtcbiAgICAgICAgICB2YWxzLnB1c2gocFtjb2x1bW5dKTtcbiAgICAgICAgfVxuICAgICAgICB0c3ZGaWxlICs9ICdcXG4nICsgdmFscy5qb2luKCdcXHQnKTtcbiAgICAgIH0pO1xuICAgICAgY29uc3QgdGV4dEJsb2IgPSBuZXcgQmxvYihbdHN2RmlsZV0sIHt0eXBlOiAndGV4dC9wbGFpbid9KTtcbiAgICAgIGNvbnN0IGFueURvd25sb2FkTWV0YWRhdGFMaW5rID0gdGhpcy4kLmRvd25sb2FkTWV0YWRhdGFMaW5rIGFzIGFueTtcbiAgICAgIGFueURvd25sb2FkTWV0YWRhdGFMaW5rLmRvd25sb2FkID0gJ21ldGFkYXRhLWVkaXRlZC50c3YnO1xuICAgICAgLy8gVE9ETyhiLzE2Mjc4ODQ0Myk6IFVuZG8gY29uZm9ybWFuY2Ugd29ya2Fyb3VuZC5cbiAgICAgIE9iamVjdC5hc3NpZ24oYW55RG93bmxvYWRNZXRhZGF0YUxpbmssIHtcbiAgICAgICAgaHJlZjogd2luZG93LlVSTFsnY3JlYXRlT2JqZWN0VVJMJ10odGV4dEJsb2IpLFxuICAgICAgfSk7XG4gICAgICBhbnlEb3dubG9hZE1ldGFkYXRhTGluay5jbGljaygpO1xuICAgIH1cbiAgfVxuICBwcml2YXRlIHN1cGVydmlzZUlucHV0VHlwaW5nKCkge1xuICAgIGxldCB2YWx1ZSA9IHRoaXMuc3VwZXJ2aXNlSW5wdXQudHJpbSgpO1xuICAgIGlmICh2YWx1ZSA9PSBudWxsIHx8IHZhbHVlLnRyaW0oKSA9PT0gJycpIHtcbiAgICAgIGlmICh0aGlzLnN1cGVydmlzZUlucHV0U2VsZWN0ZWQgPT09ICcnKSB7XG4gICAgICAgIHRoaXMuc3VwZXJ2aXNlSW5wdXRMYWJlbCA9ICdObyBpZ25vcmVkIGxhYmVsJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3VwZXJ2aXNlSW5wdXRMYWJlbCA9IGBTdXBlcnZpc2luZyB3aXRob3V0ICcke3RoaXMuc3VwZXJ2aXNlSW5wdXRTZWxlY3RlZH0nYDtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHRoaXMucHJvamVjdG9yICYmIHRoaXMucHJvamVjdG9yLmRhdGFTZXQpIHtcbiAgICAgIGxldCBudW1NYXRjaGVzID0gdGhpcy5wcm9qZWN0b3IuZGF0YVNldC5wb2ludHMuZmlsdGVyKFxuICAgICAgICAocCkgPT4gcC5tZXRhZGF0YVt0aGlzLnN1cGVydmlzZUNvbHVtbl0udG9TdHJpbmcoKS50cmltKCkgPT09IHZhbHVlXG4gICAgICApLmxlbmd0aDtcbiAgICAgIGlmIChudW1NYXRjaGVzID09PSAwKSB7XG4gICAgICAgIHRoaXMuc3VwZXJ2aXNlSW5wdXRMYWJlbCA9ICdMYWJlbCBub3QgZm91bmQnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHRoaXMucHJvamVjdG9yLmRhdGFTZXQuc3VwZXJ2aXNlSW5wdXQgIT0gdmFsdWUpIHtcbiAgICAgICAgICB0aGlzLnN1cGVydmlzZUlucHV0TGFiZWwgPSBgU3VwZXJ2aXNlIHdpdGhvdXQgJyR7dmFsdWV9JyBbJHtudW1NYXRjaGVzfSBwb2ludHNdYDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBwcml2YXRlIHN1cGVydmlzZUlucHV0Q2hhbmdlKCkge1xuICAgIGxldCB2YWx1ZSA9IHRoaXMuc3VwZXJ2aXNlSW5wdXQudHJpbSgpO1xuICAgIGlmICh2YWx1ZSA9PSBudWxsIHx8IHZhbHVlLnRyaW0oKSA9PT0gJycpIHtcbiAgICAgIHRoaXMuc3VwZXJ2aXNlSW5wdXRTZWxlY3RlZCA9ICcnO1xuICAgICAgdGhpcy5zdXBlcnZpc2VJbnB1dExhYmVsID0gJ05vIGlnbm9yZWQgbGFiZWwnO1xuICAgICAgdGhpcy5zZXRTdXBlcnZpc2lvbih0aGlzLnN1cGVydmlzZUNvbHVtbiwgJycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodGhpcy5wcm9qZWN0b3IgJiYgdGhpcy5wcm9qZWN0b3IuZGF0YVNldCkge1xuICAgICAgbGV0IG51bU1hdGNoZXMgPSB0aGlzLnByb2plY3Rvci5kYXRhU2V0LnBvaW50cy5maWx0ZXIoXG4gICAgICAgIChwKSA9PiBwLm1ldGFkYXRhW3RoaXMuc3VwZXJ2aXNlQ29sdW1uXS50b1N0cmluZygpLnRyaW0oKSA9PT0gdmFsdWVcbiAgICAgICkubGVuZ3RoO1xuICAgICAgaWYgKG51bU1hdGNoZXMgPT09IDApIHtcbiAgICAgICAgdGhpcy5zdXBlcnZpc2VJbnB1dExhYmVsID0gYFN1cGVydmlzaW5nIHdpdGhvdXQgJyR7dGhpcy5zdXBlcnZpc2VJbnB1dFNlbGVjdGVkfSdgO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zdXBlcnZpc2VJbnB1dFNlbGVjdGVkID0gdmFsdWU7XG4gICAgICAgIHRoaXMuc3VwZXJ2aXNlSW5wdXRMYWJlbCA9IGBTdXBlcnZpc2luZyB3aXRob3V0ICcke3ZhbHVlfScgWyR7bnVtTWF0Y2hlc30gcG9pbnRzXWA7XG4gICAgICAgIHRoaXMuc2V0U3VwZXJ2aXNpb24odGhpcy5zdXBlcnZpc2VDb2x1bW4sIHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcHJpdmF0ZSBzdXBlcnZpc2VDb2x1bW5DaGFuZ2VkKCkge1xuICAgIHRoaXMuc3VwZXJ2aXNlSW5wdXQgPSAnJztcbiAgICB0aGlzLnN1cGVydmlzZUlucHV0Q2hhbmdlKCk7XG4gIH1cbiAgcHJpdmF0ZSBzZXRTdXBlcnZpc2lvbihzdXBlcnZpc2VDb2x1bW46IHN0cmluZywgc3VwZXJ2aXNlSW5wdXQ6IHN0cmluZykge1xuICAgIGlmICh0aGlzLnByb2plY3RvciAmJiB0aGlzLnByb2plY3Rvci5kYXRhU2V0KSB7XG4gICAgICB0aGlzLnByb2plY3Rvci5kYXRhU2V0LnNldFN1cGVydmlzaW9uKHN1cGVydmlzZUNvbHVtbiwgc3VwZXJ2aXNlSW5wdXQpO1xuICAgIH1cbiAgfVxuICBzZXROb3JtYWxpemVEYXRhKG5vcm1hbGl6ZURhdGE6IGJvb2xlYW4pIHtcbiAgICB0aGlzLm5vcm1hbGl6ZURhdGEgPSBub3JtYWxpemVEYXRhO1xuICB9XG4gIEBvYnNlcnZlKCdzZWxlY3RlZFRlbnNvcicpXG4gIF9zZWxlY3RlZFRlbnNvckNoYW5nZWQoKSB7XG4gICAgdGhpcy5wcm9qZWN0b3IudXBkYXRlRGF0YVNldChudWxsLCBudWxsLCBudWxsKTtcbiAgICBpZiAodGhpcy5zZWxlY3RlZFRlbnNvciA9PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuZGF0YVByb3ZpZGVyLnJldHJpZXZlVGVuc29yKFxuICAgICAgdGhpcy5zZWxlY3RlZFJ1bixcbiAgICAgIHRoaXMuc2VsZWN0ZWRUZW5zb3IsXG4gICAgICAoZHMpID0+IHtcbiAgICAgICAgbGV0IG1ldGFkYXRhRmlsZSA9IHRoaXMuZ2V0RW1iZWRkaW5nSW5mb0J5TmFtZSh0aGlzLnNlbGVjdGVkVGVuc29yKVxuICAgICAgICAgIC5tZXRhZGF0YVBhdGg7XG4gICAgICAgIHRoaXMuZGF0YVByb3ZpZGVyLnJldHJpZXZlU3ByaXRlQW5kTWV0YWRhdGEoXG4gICAgICAgICAgdGhpcy5zZWxlY3RlZFJ1bixcbiAgICAgICAgICB0aGlzLnNlbGVjdGVkVGVuc29yLFxuICAgICAgICAgIChtZXRhZGF0YSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wcm9qZWN0b3IudXBkYXRlRGF0YVNldChkcywgbWV0YWRhdGEsIG1ldGFkYXRhRmlsZSk7XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgfVxuICAgICk7XG4gICAgdGhpcy5wcm9qZWN0b3Iuc2V0U2VsZWN0ZWRUZW5zb3IoXG4gICAgICB0aGlzLnNlbGVjdGVkUnVuLFxuICAgICAgdGhpcy5nZXRFbWJlZGRpbmdJbmZvQnlOYW1lKHRoaXMuc2VsZWN0ZWRUZW5zb3IpXG4gICAgKTtcbiAgfVxuICBAb2JzZXJ2ZSgnc2VsZWN0ZWRSdW4nKVxuICBfZ2VuZXJhdGVVaUZvck5ld0NoZWNrcG9pbnRGb3JSdW4oc2VsZWN0ZWRSdW4pIHtcbiAgICB0aGlzLmRhdGFQcm92aWRlci5yZXRyaWV2ZVByb2plY3RvckNvbmZpZyhzZWxlY3RlZFJ1biwgKGluZm8pID0+IHtcbiAgICAgIHRoaXMucHJvamVjdG9yQ29uZmlnID0gaW5mbztcbiAgICAgIGxldCBuYW1lcyA9IHRoaXMucHJvamVjdG9yQ29uZmlnLmVtYmVkZGluZ3NcbiAgICAgICAgLm1hcCgoZSkgPT4gZS50ZW5zb3JOYW1lKVxuICAgICAgICAuZmlsdGVyKChuYW1lKSA9PiB7XG4gICAgICAgICAgbGV0IHNoYXBlID0gdGhpcy5nZXRFbWJlZGRpbmdJbmZvQnlOYW1lKG5hbWUpLnRlbnNvclNoYXBlO1xuICAgICAgICAgIHJldHVybiBzaGFwZS5sZW5ndGggPT09IDIgJiYgc2hhcGVbMF0gPiAxICYmIHNoYXBlWzFdID4gMTtcbiAgICAgICAgfSlcbiAgICAgICAgLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICBsZXQgZW1iQSA9IHRoaXMuZ2V0RW1iZWRkaW5nSW5mb0J5TmFtZShhKTtcbiAgICAgICAgICBsZXQgZW1iQiA9IHRoaXMuZ2V0RW1iZWRkaW5nSW5mb0J5TmFtZShiKTtcbiAgICAgICAgICAvLyBQcmVmZXIgdGVuc29ycyB3aXRoIG1ldGFkYXRhLlxuICAgICAgICAgIGlmICh1dGlsLnhvcighIWVtYkEubWV0YWRhdGFQYXRoLCAhIWVtYkIubWV0YWRhdGFQYXRoKSkge1xuICAgICAgICAgICAgcmV0dXJuIGVtYkEubWV0YWRhdGFQYXRoID8gLTEgOiAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBQcmVmZXIgbm9uLWdlbmVyYXRlZCB0ZW5zb3JzLlxuICAgICAgICAgIGxldCBpc0dlbkEgPSB1dGlsLnRlbnNvcklzR2VuZXJhdGVkKGEpO1xuICAgICAgICAgIGxldCBpc0dlbkIgPSB1dGlsLnRlbnNvcklzR2VuZXJhdGVkKGIpO1xuICAgICAgICAgIGlmICh1dGlsLnhvcihpc0dlbkEsIGlzR2VuQikpIHtcbiAgICAgICAgICAgIHJldHVybiBpc0dlbkIgPyAtMSA6IDE7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFByZWZlciBiaWdnZXIgdGVuc29ycy5cbiAgICAgICAgICBsZXQgc2l6ZUEgPSBlbWJBLnRlbnNvclNoYXBlWzBdO1xuICAgICAgICAgIGxldCBzaXplQiA9IGVtYkIudGVuc29yU2hhcGVbMF07XG4gICAgICAgICAgaWYgKHNpemVBICE9PSBzaXplQikge1xuICAgICAgICAgICAgcmV0dXJuIHNpemVCIC0gc2l6ZUE7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFNvcnQgYWxwaGFiZXRpY2FsbHkgYnkgdGVuc29yIG5hbWUuXG4gICAgICAgICAgcmV0dXJuIGEgPD0gYiA/IC0xIDogMTtcbiAgICAgICAgfSk7XG4gICAgICB0aGlzLnRlbnNvck5hbWVzID0gbmFtZXMubWFwKChuYW1lKSA9PiB7XG4gICAgICAgIHJldHVybiB7bmFtZSwgc2hhcGU6IHRoaXMuZ2V0RW1iZWRkaW5nSW5mb0J5TmFtZShuYW1lKS50ZW5zb3JTaGFwZX07XG4gICAgICB9KTtcblxuICAgICAgLy8gSWYgaW4gZGVtbyBtb2RlLCBsZXQgdGhlIG9yZGVyIGRlY2lkZSB3aGljaCB0ZW5zb3IgdG8gbG9hZCBieSBkZWZhdWx0LlxuICAgICAgY29uc3QgZGVmYXVsdFRlbnNvciA9XG4gICAgICAgIHRoaXMucHJvamVjdG9yLnNlcnZpbmdNb2RlID09PSAnZGVtbydcbiAgICAgICAgICA/IHRoaXMucHJvamVjdG9yQ29uZmlnLmVtYmVkZGluZ3NbMF0udGVuc29yTmFtZVxuICAgICAgICAgIDogbmFtZXNbMF07XG4gICAgICBpZiAodGhpcy5zZWxlY3RlZFRlbnNvciA9PT0gZGVmYXVsdFRlbnNvcikge1xuICAgICAgICAvLyBFeHBsaWNpdGx5IGNhbGwgdGhlIG9ic2VydmVyLiBQb2x5bWVyIHdvbid0IGNhbGwgaXQgaWYgdGhlIHByZXZpb3VzXG4gICAgICAgIC8vIHN0cmluZyBtYXRjaGVzIHRoZSBjdXJyZW50IHN0cmluZy5cbiAgICAgICAgdGhpcy5fc2VsZWN0ZWRUZW5zb3JDaGFuZ2VkKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnNlbGVjdGVkVGVuc29yID0gZGVmYXVsdFRlbnNvcjtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIEBvYnNlcnZlKCdzZWxlY3RlZExhYmVsT3B0aW9uJylcbiAgX3NlbGVjdGVkTGFiZWxPcHRpb25DaGFuZ2VkKCkge1xuICAgIHRoaXMucHJvamVjdG9yLnNldFNlbGVjdGVkTGFiZWxPcHRpb24odGhpcy5zZWxlY3RlZExhYmVsT3B0aW9uKTtcbiAgfVxuICBAb2JzZXJ2ZSgnc2VsZWN0ZWRDb2xvck9wdGlvbk5hbWUnKVxuICBfc2VsZWN0ZWRDb2xvck9wdGlvbk5hbWVDaGFuZ2VkKCkge1xuICAgIGxldCBjb2xvck9wdGlvbjogQ29sb3JPcHRpb247XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNvbG9yT3B0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHRoaXMuY29sb3JPcHRpb25zW2ldLm5hbWUgPT09IHRoaXMuc2VsZWN0ZWRDb2xvck9wdGlvbk5hbWUpIHtcbiAgICAgICAgY29sb3JPcHRpb24gPSB0aGlzLmNvbG9yT3B0aW9uc1tpXTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghY29sb3JPcHRpb24pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5zaG93Rm9yY2VDYXRlZ29yaWNhbENvbG9yc0NoZWNrYm94ID0gISFjb2xvck9wdGlvbi50b29NYW55VW5pcXVlVmFsdWVzO1xuICAgIGlmIChjb2xvck9wdGlvbi5tYXAgPT0gbnVsbCkge1xuICAgICAgdGhpcy5jb2xvckxlZ2VuZFJlbmRlckluZm8gPSBudWxsO1xuICAgIH0gZWxzZSBpZiAoY29sb3JPcHRpb24uaXRlbXMpIHtcbiAgICAgIGxldCBpdGVtcyA9IGNvbG9yT3B0aW9uLml0ZW1zLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbG9yOiBjb2xvck9wdGlvbi5tYXAoaXRlbS5sYWJlbCksXG4gICAgICAgICAgbGFiZWw6IGl0ZW0ubGFiZWwsXG4gICAgICAgICAgY291bnQ6IGl0ZW0uY291bnQsXG4gICAgICAgIH07XG4gICAgICB9KTtcbiAgICAgIHRoaXMuY29sb3JMZWdlbmRSZW5kZXJJbmZvID0ge2l0ZW1zLCB0aHJlc2hvbGRzOiBudWxsfTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jb2xvckxlZ2VuZFJlbmRlckluZm8gPSB7XG4gICAgICAgIGl0ZW1zOiBudWxsLFxuICAgICAgICB0aHJlc2hvbGRzOiBjb2xvck9wdGlvbi50aHJlc2hvbGRzLFxuICAgICAgfTtcbiAgICB9XG4gICAgLy8gdGhpcy5wcm9qZWN0b3Iuc2V0U2VsZWN0ZWRDb2xvck9wdGlvbihjb2xvck9wdGlvbik7XG4gIH1cbiAgcHJpdmF0ZSB0ZW5zb3JXYXNSZWFkRnJvbUZpbGUocmF3Q29udGVudHM6IEFycmF5QnVmZmVyLCBmaWxlTmFtZTogc3RyaW5nKSB7XG4gICAgcGFyc2VSYXdUZW5zb3JzKHJhd0NvbnRlbnRzLCAoZHMpID0+IHtcbiAgICAgIGNvbnN0IGNoZWNrcG9pbnRGaWxlID0gdGhpcy4kJCgnI2NoZWNrcG9pbnQtZmlsZScpIGFzIEhUTUxTcGFuRWxlbWVudDtcbiAgICAgIGNoZWNrcG9pbnRGaWxlLmlubmVyVGV4dCA9IGZpbGVOYW1lO1xuICAgICAgY2hlY2twb2ludEZpbGUudGl0bGUgPSBmaWxlTmFtZTtcbiAgICAgIHRoaXMucHJvamVjdG9yLnVwZGF0ZURhdGFTZXQoZHMpO1xuICAgIH0pO1xuICB9XG4gIHByaXZhdGUgbWV0YWRhdGFXYXNSZWFkRnJvbUZpbGUocmF3Q29udGVudHM6IEFycmF5QnVmZmVyLCBmaWxlTmFtZTogc3RyaW5nKSB7XG4gICAgcGFyc2VSYXdNZXRhZGF0YShyYXdDb250ZW50cywgKG1ldGFkYXRhKSA9PiB7XG4gICAgICB0aGlzLnByb2plY3Rvci51cGRhdGVEYXRhU2V0KHRoaXMucHJvamVjdG9yLmRhdGFTZXQsIG1ldGFkYXRhLCBmaWxlTmFtZSk7XG4gICAgfSk7XG4gIH1cbiAgcHJpdmF0ZSBnZXRFbWJlZGRpbmdJbmZvQnlOYW1lKHRlbnNvck5hbWU6IHN0cmluZyk6IEVtYmVkZGluZ0luZm8ge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5wcm9qZWN0b3JDb25maWcuZW1iZWRkaW5ncy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZSA9IHRoaXMucHJvamVjdG9yQ29uZmlnLmVtYmVkZGluZ3NbaV07XG4gICAgICBpZiAoZS50ZW5zb3JOYW1lID09PSB0ZW5zb3JOYW1lKSB7XG4gICAgICAgIHJldHVybiBlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBwcml2YXRlIHNldHVwVXBsb2FkQnV0dG9ucygpIHtcbiAgICAvLyBTaG93IGFuZCBzZXR1cCB0aGUgdXBsb2FkIGJ1dHRvbi5cbiAgICBjb25zdCBmaWxlSW5wdXQgPSB0aGlzLiQkKCcjZmlsZScpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgZmlsZUlucHV0Lm9uY2hhbmdlID0gKCkgPT4ge1xuICAgICAgY29uc3QgZmlsZTogRmlsZSA9IGZpbGVJbnB1dC5maWxlc1swXTtcbiAgICAgIC8vIENsZWFyIG91dCB0aGUgdmFsdWUgb2YgdGhlIGZpbGUgY2hvb3Nlci4gVGhpcyBlbnN1cmVzIHRoYXQgaWYgdGhlIHVzZXJcbiAgICAgIC8vIHNlbGVjdHMgdGhlIHNhbWUgZmlsZSwgd2UnbGwgcmUtcmVhZCBpdC5cbiAgICAgIGZpbGVJbnB1dC52YWx1ZSA9ICcnO1xuICAgICAgY29uc3QgZmlsZVJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICBmaWxlUmVhZGVyLm9ubG9hZCA9IChldnQpID0+IHtcbiAgICAgICAgY29uc3QgY29udGVudDogQXJyYXlCdWZmZXIgPSBmaWxlUmVhZGVyLnJlc3VsdCBhcyBBcnJheUJ1ZmZlcjtcbiAgICAgICAgdGhpcy50ZW5zb3JXYXNSZWFkRnJvbUZpbGUoY29udGVudCwgZmlsZS5uYW1lKTtcbiAgICAgIH07XG4gICAgICBmaWxlUmVhZGVyLnJlYWRBc0FycmF5QnVmZmVyKGZpbGUpO1xuICAgIH07XG4gICAgY29uc3QgdXBsb2FkQnV0dG9uID0gdGhpcy4kJCgnI3VwbG9hZC10ZW5zb3JzJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gICAgdXBsb2FkQnV0dG9uLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICBmaWxlSW5wdXQuY2xpY2soKTtcbiAgICB9O1xuICAgIC8vIFNob3cgYW5kIHNldHVwIHRoZSB1cGxvYWQgbWV0YWRhdGEgYnV0dG9uLlxuICAgIGNvbnN0IGZpbGVNZXRhZGF0YUlucHV0ID0gdGhpcy4kJCgnI2ZpbGUtbWV0YWRhdGEnKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xuICAgIGZpbGVNZXRhZGF0YUlucHV0Lm9uY2hhbmdlID0gKCkgPT4ge1xuICAgICAgY29uc3QgZmlsZTogRmlsZSA9IGZpbGVNZXRhZGF0YUlucHV0LmZpbGVzWzBdO1xuICAgICAgLy8gQ2xlYXIgb3V0IHRoZSB2YWx1ZSBvZiB0aGUgZmlsZSBjaG9vc2VyLiBUaGlzIGVuc3VyZXMgdGhhdCBpZiB0aGUgdXNlclxuICAgICAgLy8gc2VsZWN0cyB0aGUgc2FtZSBmaWxlLCB3ZSdsbCByZS1yZWFkIGl0LlxuICAgICAgZmlsZU1ldGFkYXRhSW5wdXQudmFsdWUgPSAnJztcbiAgICAgIGNvbnN0IGZpbGVSZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgZmlsZVJlYWRlci5vbmxvYWQgPSAoZXZ0KSA9PiB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnRzOiBBcnJheUJ1ZmZlciA9IGZpbGVSZWFkZXIucmVzdWx0IGFzIEFycmF5QnVmZmVyO1xuICAgICAgICB0aGlzLm1ldGFkYXRhV2FzUmVhZEZyb21GaWxlKGNvbnRlbnRzLCBmaWxlLm5hbWUpO1xuICAgICAgfTtcbiAgICAgIGZpbGVSZWFkZXIucmVhZEFzQXJyYXlCdWZmZXIoZmlsZSk7XG4gICAgfTtcbiAgICBjb25zdCB1cGxvYWRNZXRhZGF0YUJ1dHRvbiA9IHRoaXMuJCQoXG4gICAgICAnI3VwbG9hZC1tZXRhZGF0YSdcbiAgICApIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuICAgIHVwbG9hZE1ldGFkYXRhQnV0dG9uLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICBmaWxlTWV0YWRhdGFJbnB1dC5jbGljaygpO1xuICAgIH07XG4gICAgaWYgKHRoaXMucHJvamVjdG9yLnNlcnZpbmdNb2RlICE9PSAnZGVtbycpIHtcbiAgICAgICh0aGlzLiQkKCcjcHVibGlzaC1jb250YWluZXInKSBhcyBIVE1MRWxlbWVudCkuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICh0aGlzLiQkKCcjdXBsb2FkLXRlbnNvcnMtc3RlcC1jb250YWluZXInKSBhcyBIVE1MRWxlbWVudCkuc3R5bGUuZGlzcGxheSA9XG4gICAgICAgICdub25lJztcbiAgICAgICh0aGlzLiQkKCcjdXBsb2FkLW1ldGFkYXRhLWxhYmVsJykgYXMgSFRNTEVsZW1lbnQpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgfVxuICAgICh0aGlzLiQkKCcjZGVtby1kYXRhLWJ1dHRvbnMtY29udGFpbmVyJykgYXMgSFRNTEVsZW1lbnQpLnN0eWxlLmRpc3BsYXkgPVxuICAgICAgJ2ZsZXgnO1xuICAgIC8vIEZpbGwgb3V0IHRoZSBwcm9qZWN0b3IgY29uZmlnLlxuICAgIGNvbnN0IHByb2plY3RvckNvbmZpZ1RlbXBsYXRlID0gdGhpcy4kJChcbiAgICAgICcjcHJvamVjdG9yLWNvbmZpZy10ZW1wbGF0ZSdcbiAgICApIGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQ7XG4gICAgY29uc3QgcHJvamVjdG9yQ29uZmlnVGVtcGxhdGVKc29uOiBQcm9qZWN0b3JDb25maWcgPSB7XG4gICAgICBlbWJlZGRpbmdzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICB0ZW5zb3JOYW1lOiAnTXkgdGVuc29yJyxcbiAgICAgICAgICB0ZW5zb3JTaGFwZTogWzEwMDAsIDUwXSxcbiAgICAgICAgICB0ZW5zb3JQYXRoOiAnaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tLy4uLi90ZW5zb3JzLnRzdicsXG4gICAgICAgICAgbWV0YWRhdGFQYXRoOlxuICAgICAgICAgICAgJ2h0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS8uLi4vb3B0aW9uYWwubWV0YWRhdGEudHN2JyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfTtcbiAgICB0aGlzLnNldFByb2plY3RvckNvbmZpZ1RlbXBsYXRlSnNvbihcbiAgICAgIHByb2plY3RvckNvbmZpZ1RlbXBsYXRlLFxuICAgICAgcHJvamVjdG9yQ29uZmlnVGVtcGxhdGVKc29uXG4gICAgKTtcbiAgICAvLyBTZXQgdXAgb3B0aW9uYWwgZmllbGQgY2hlY2tib3hlcy5cbiAgICBjb25zdCBzcHJpdGVGaWVsZENoZWNrYm94ID0gdGhpcy4kJChcbiAgICAgICcjY29uZmlnLXNwcml0ZS1jaGVja2JveCdcbiAgICApIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgc3ByaXRlRmllbGRDaGVja2JveC5vbmNoYW5nZSA9ICgpID0+IHtcbiAgICAgIGlmICgoc3ByaXRlRmllbGRDaGVja2JveCBhcyBhbnkpLmNoZWNrZWQpIHtcbiAgICAgICAgcHJvamVjdG9yQ29uZmlnVGVtcGxhdGVKc29uLmVtYmVkZGluZ3NbMF0uc3ByaXRlID0ge1xuICAgICAgICAgIGltYWdlUGF0aDogJ2h0dHBzOi8vZ2l0aHViLmNvbS8uLi4vb3B0aW9uYWwuc3ByaXRlLnBuZycsXG4gICAgICAgICAgc2luZ2xlSW1hZ2VEaW06IFszMiwgMzJdLFxuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVsZXRlIHByb2plY3RvckNvbmZpZ1RlbXBsYXRlSnNvbi5lbWJlZGRpbmdzWzBdLnNwcml0ZTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc2V0UHJvamVjdG9yQ29uZmlnVGVtcGxhdGVKc29uKFxuICAgICAgICBwcm9qZWN0b3JDb25maWdUZW1wbGF0ZSxcbiAgICAgICAgcHJvamVjdG9yQ29uZmlnVGVtcGxhdGVKc29uXG4gICAgICApO1xuICAgIH07XG4gICAgY29uc3QgYm9va21hcmtzRmllbGRDaGVja2JveCA9IHRoaXMuJCQoXG4gICAgICAnI2NvbmZpZy1ib29rbWFya3MtY2hlY2tib3gnXG4gICAgKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xuICAgIGJvb2ttYXJrc0ZpZWxkQ2hlY2tib3gub25jaGFuZ2UgPSAoKSA9PiB7XG4gICAgICBpZiAoKGJvb2ttYXJrc0ZpZWxkQ2hlY2tib3ggYXMgYW55KS5jaGVja2VkKSB7XG4gICAgICAgIHByb2plY3RvckNvbmZpZ1RlbXBsYXRlSnNvbi5lbWJlZGRpbmdzWzBdLmJvb2ttYXJrc1BhdGggPVxuICAgICAgICAgICdodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vLi4uL2Jvb2ttYXJrcy50eHQnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVsZXRlIHByb2plY3RvckNvbmZpZ1RlbXBsYXRlSnNvbi5lbWJlZGRpbmdzWzBdLmJvb2ttYXJrc1BhdGg7XG4gICAgICB9XG4gICAgICB0aGlzLnNldFByb2plY3RvckNvbmZpZ1RlbXBsYXRlSnNvbihcbiAgICAgICAgcHJvamVjdG9yQ29uZmlnVGVtcGxhdGUsXG4gICAgICAgIHByb2plY3RvckNvbmZpZ1RlbXBsYXRlSnNvblxuICAgICAgKTtcbiAgICB9O1xuICAgIGNvbnN0IG1ldGFkYXRhRmllbGRDaGVja2JveCA9IHRoaXMuJCQoXG4gICAgICAnI2NvbmZpZy1tZXRhZGF0YS1jaGVja2JveCdcbiAgICApIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgbWV0YWRhdGFGaWVsZENoZWNrYm94Lm9uY2hhbmdlID0gKCkgPT4ge1xuICAgICAgaWYgKChtZXRhZGF0YUZpZWxkQ2hlY2tib3ggYXMgSFRNTElucHV0RWxlbWVudCkuY2hlY2tlZCkge1xuICAgICAgICBwcm9qZWN0b3JDb25maWdUZW1wbGF0ZUpzb24uZW1iZWRkaW5nc1swXS5tZXRhZGF0YVBhdGggPVxuICAgICAgICAgICdodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vLi4uL29wdGlvbmFsLm1ldGFkYXRhLnRzdic7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWxldGUgcHJvamVjdG9yQ29uZmlnVGVtcGxhdGVKc29uLmVtYmVkZGluZ3NbMF0ubWV0YWRhdGFQYXRoO1xuICAgICAgfVxuICAgICAgdGhpcy5zZXRQcm9qZWN0b3JDb25maWdUZW1wbGF0ZUpzb24oXG4gICAgICAgIHByb2plY3RvckNvbmZpZ1RlbXBsYXRlLFxuICAgICAgICBwcm9qZWN0b3JDb25maWdUZW1wbGF0ZUpzb25cbiAgICAgICk7XG4gICAgfTtcbiAgICAvLyBVcGRhdGUgdGhlIGxpbmsgYW5kIHRoZSByZWFkb25seSBzaGFyZWFibGUgVVJMLlxuICAgIGNvbnN0IHByb2plY3RvckNvbmZpZ1VybElucHV0ID0gdGhpcy4kJChcbiAgICAgICcjcHJvamVjdG9yLWNvbmZpZy11cmwnXG4gICAgKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xuICAgIGNvbnN0IHByb2plY3RvckNvbmZpZ0RlbW9VcmxJbnB1dCA9IHRoaXMuJCQoJyNwcm9qZWN0b3Itc2hhcmUtdXJsJyk7XG4gICAgY29uc3QgcHJvamVjdG9yQ29uZmlnRGVtb1VybExpbmsgPSB0aGlzLiQkKCcjcHJvamVjdG9yLXNoYXJlLXVybC1saW5rJyk7XG4gICAgcHJvamVjdG9yQ29uZmlnVXJsSW5wdXQub25jaGFuZ2UgPSAoKSA9PiB7XG4gICAgICBsZXQgcHJvamVjdG9yRGVtb1VybCA9XG4gICAgICAgIGxvY2F0aW9uLnByb3RvY29sICtcbiAgICAgICAgJy8vJyArXG4gICAgICAgIGxvY2F0aW9uLmhvc3QgK1xuICAgICAgICBsb2NhdGlvbi5wYXRobmFtZSArXG4gICAgICAgICc/Y29uZmlnPScgK1xuICAgICAgICAocHJvamVjdG9yQ29uZmlnVXJsSW5wdXQgYXMgSFRNTElucHV0RWxlbWVudCkudmFsdWU7XG4gICAgICAocHJvamVjdG9yQ29uZmlnRGVtb1VybElucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlID0gcHJvamVjdG9yRGVtb1VybDtcbiAgICAgIC8vIFRPRE8oYi8xNjI3ODg0NDMpOiBVbmRvIGNvbmZvcm1hbmNlIHdvcmthcm91bmQuXG4gICAgICBPYmplY3QuYXNzaWduKHByb2plY3RvckNvbmZpZ0RlbW9VcmxMaW5rIGFzIEhUTUxMaW5rRWxlbWVudCwge1xuICAgICAgICBocmVmOiBwcm9qZWN0b3JEZW1vVXJsLFxuICAgICAgfSk7XG4gICAgfTtcbiAgfVxuICBwcml2YXRlIHNldFByb2plY3RvckNvbmZpZ1RlbXBsYXRlSnNvbihcbiAgICBwcm9qZWN0b3JDb25maWdUZW1wbGF0ZTogSFRNTFRleHRBcmVhRWxlbWVudCxcbiAgICBjb25maWc6IFByb2plY3RvckNvbmZpZ1xuICApIHtcbiAgICBwcm9qZWN0b3JDb25maWdUZW1wbGF0ZS52YWx1ZSA9IEpTT04uc3RyaW5naWZ5KFxuICAgICAgY29uZmlnLFxuICAgICAgbnVsbCxcbiAgICAgIC8qKiByZXBsYWNlciAqLyAyIC8qKiB3aGl0ZSBzcGFjZSAqL1xuICAgICk7XG4gIH1cbiAgX2dldE51bVRlbnNvcnNMYWJlbCgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnRlbnNvck5hbWVzLmxlbmd0aCA9PT0gMVxuICAgICAgPyAnMSB0ZW5zb3InXG4gICAgICA6IHRoaXMudGVuc29yTmFtZXMubGVuZ3RoICsgJyB0ZW5zb3JzJztcbiAgfVxuICBfZ2V0TnVtUnVuc0xhYmVsKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMucnVuTmFtZXMubGVuZ3RoID09PSAxXG4gICAgICA/ICcxIHJ1bidcbiAgICAgIDogdGhpcy5ydW5OYW1lcy5sZW5ndGggKyAnIHJ1bnMnO1xuICB9XG4gIF9oYXNDaG9pY2UoY2hvaWNlczogYW55W10pOiBib29sZWFuIHtcbiAgICByZXR1cm4gY2hvaWNlcy5sZW5ndGggPiAwO1xuICB9XG4gIF9oYXNDaG9pY2VzKGNob2ljZXM6IGFueVtdKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGNob2ljZXMubGVuZ3RoID4gMTtcbiAgfVxuICBfb3BlbkRhdGFEaWFsb2coKTogdm9pZCB7XG4gICAgKHRoaXMuJC5kYXRhRGlhbG9nIGFzIGFueSkub3BlbigpO1xuICB9XG4gIF9vcGVuQ29uZmlnRGlhbG9nKCk6IHZvaWQge1xuICAgICh0aGlzLiQucHJvamVjdG9yQ29uZmlnRGlhbG9nIGFzIGFueSkub3BlbigpO1xuICB9XG59XG4iXX0=