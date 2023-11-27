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
import { PolymerElement, html } from '@polymer/polymer';
import { customElement, observe, property } from '@polymer/decorators';
import * as logging from './logging';
import { LegacyElementMixin } from '../components/polymer/legacy_element_mixin';
import '../components/polymer/irons_and_papers';
let MetadataCard = class MetadataCard extends LegacyElementMixin(PolymerElement) {
    constructor() {
        super(...arguments);
        this.hasMetadata = true;
        this.showImg = false;
        this.selectedNum = 0;
        this.interestNum = 0;
        this.notInterestNum = 0;
        this.isCollapsed = false;
        this.collapseIcon = 'expand-less';
        this.currentRemove = null;
    }
    /** Handles toggle of metadata-container. */
    _toggleMetadataContainer() {
        this.$$('#metadata-container').toggle();
        this.isCollapsed = !this.isCollapsed;
        this.set('collapseIcon', this.isCollapsed ? 'expand-more' : 'expand-less');
    }
    _remove() {
        console.log('111', this.currentRemove);
    }
    updateMetadata(pointMetadata, src, point, indicate) {
        var _a;
        this.pointMetadata = pointMetadata;
        this.showImg = pointMetadata != null;
        this.hasMetadata = true;
        if (!window.previousIndecates) {
            window.previousIndecates = [];
        }
        if (pointMetadata) {
            let metadata = [];
            for (let metadataKey in pointMetadata) {
                if (!pointMetadata.hasOwnProperty(metadataKey)) {
                    continue;
                }
                let value = pointMetadata[metadataKey];
                if (window.properties[window.iteration] && indicate !== undefined) {
                    if (window.properties[window.iteration][indicate] === 1) {
                        value = 'unlabeled';
                    }
                }
                metadata.push({ index: indicate, key: metadataKey, value: value, prediction: point['current_prediction'], possibelWroung: value !== point['current_prediction'], isSelected: ((_a = window.previousIndecates) === null || _a === void 0 ? void 0 : _a.indexOf(indicate)) !== -1 });
            }
            this.metadata = metadata;
            this.label = '' + this.pointMetadata[this.labelOption];
            //img
            setTimeout(() => {
                var _a, _b, _c;
                this.resultImg = this.$$('#metaImg');
                if (src === null || src === void 0 ? void 0 : src.length) {
                    (_a = this.resultImg) === null || _a === void 0 ? void 0 : _a.setAttribute("style", "display:block;");
                    (_b = this.resultImg) === null || _b === void 0 ? void 0 : _b.setAttribute('src', src);
                }
                else {
                    (_c = this.resultImg) === null || _c === void 0 ? void 0 : _c.setAttribute("style", "display:none;");
                }
            }, 100);
        }
    }
    updateCustomList(points, projectorEventContext) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            this.projectorEventContext = projectorEventContext;
            if (points) {
                this.points = points;
            }
            if (!window.acceptIndicates || window.acceptIndicates.length === 0) {
                this.customMetadata = [];
            }
            this.hasMetadata = true;
            this.selectedNum = ((_a = window.acceptIndicates) === null || _a === void 0 ? void 0 : _a.length) + ((_b = window.rejectIndicates) === null || _b === void 0 ? void 0 : _b.length);
            this.interestNum = (_c = window.acceptIndicates) === null || _c === void 0 ? void 0 : _c.length;
            this.notInterestNum = (_d = window.rejectIndicates) === null || _d === void 0 ? void 0 : _d.length;
            let metadata = [];
            let DVIServer = window.sessionStorage.ipAddress;
            let basePath = window.modelMath;
            let headers = new Headers();
            headers.append('Content-Type', 'application/json');
            headers.append('Accept', 'application/json');
            if (window.acceptIndicates) {
                let msgId;
                if (window.acceptIndicates.length > 1000) {
                    msgId = logging.setModalMessage('Update ing...');
                }
                yield fetch(`http://${DVIServer}/spriteList`, {
                    method: 'POST',
                    mode: 'cors',
                    body: JSON.stringify({
                        "path": basePath, "index": window.acceptIndicates,
                    }),
                    headers: headers,
                }).then(response => response.json()).then(data => {
                    for (let i = 0; i < window.acceptIndicates.length; i++) {
                        let src = data.urlList[window.acceptIndicates[i]];
                        // let flag = points[window.acceptIndicates[i]]?.metadata.label === points[window.acceptIndicates[i]]?.current_prediction ? '' : '❗️'
                        let flag = "";
                        // if(window.flagindecatesList?.indexOf(window.acceptIndicates[i]) !== -1){
                        //   flag = '❗️'
                        // }
                        // if (window.sessionStorage.isControlGroup === 'true') {
                        //   flag = ''
                        // }
                        metadata.push({ key: window.acceptIndicates[i], value: points[window.acceptIndicates[i]].metadata.label, src: src, prediction: points[window.acceptIndicates[i]].current_prediction, flag: flag });
                    }
                    if (msgId) {
                        logging.setModalMessage(null, msgId);
                    }
                }).catch(error => {
                    console.log("error", error);
                    if (msgId) {
                        logging.setModalMessage(null, msgId);
                    }
                    for (let i = 0; i < window.acceptIndicates.length; i++) {
                        let src = '';
                        // let flag = points[window.acceptIndicates[i]]?.metadata.label === points[window.acceptIndicates[i]]?.current_prediction ? '' : '❗️'
                        let flag = "";
                        // if(window.flagindecatesList?.indexOf(window.rejectIndicates[i]) !== -1){
                        //   flag = '❗️'
                        // }
                        metadata.push({ key: window.acceptIndicates[i], value: points[window.acceptIndicates[i]].metadata.label, src: src, prediction: points[window.acceptIndicates[i]].current_prediction, flag: flag });
                    }
                });
            }
            window.customMetadata = metadata;
            this.customMetadata = metadata;
            setTimeout(() => {
                this.addBtnListener();
            }, 3000);
        });
    }
    updateRejectList(points, projectorEventContext) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            this.projectorEventContext = projectorEventContext;
            if (points) {
                this.points = points;
            }
            if (!window.rejectIndicates || window.rejectIndicates.length === 0) {
                this.rejectMetadata = [];
            }
            this.hasMetadata = true;
            this.selectedNum = ((_a = window.acceptIndicates) === null || _a === void 0 ? void 0 : _a.length) + ((_b = window.rejectIndicates) === null || _b === void 0 ? void 0 : _b.length);
            this.interestNum = (_c = window.acceptIndicates) === null || _c === void 0 ? void 0 : _c.length;
            this.notInterestNum = (_d = window.rejectIndicates) === null || _d === void 0 ? void 0 : _d.length;
            let metadata = [];
            let DVIServer = window.sessionStorage.ipAddress;
            let basePath = window.modelMath;
            let headers = new Headers();
            headers.append('Content-Type', 'application/json');
            headers.append('Accept', 'application/json');
            if (window.rejectIndicates) {
                let msgId;
                if (window.rejectIndicates.length > 1000) {
                    msgId = logging.setModalMessage('Update ing...');
                }
                yield fetch(`http://${DVIServer}/spriteList`, {
                    method: 'POST',
                    mode: 'cors',
                    body: JSON.stringify({
                        "path": basePath, "index": window.rejectIndicates,
                    }),
                    headers: headers,
                }).then(response => response.json()).then(data => {
                    for (let i = 0; i < window.rejectIndicates.length; i++) {
                        let src = data.urlList[window.rejectIndicates[i]];
                        // let flag = points[window.rejectIndicates[i]]?.metadata.label === points[window.rejectIndicates[i]]?.current_prediction ? '' : '❗️'
                        let flag = "";
                        // if(window.flagindecatesList?.indexOf(window.rejectIndicates[i]) !== -1){
                        //   flag = '❗️'
                        // }
                        // if (window.sessionStorage.isControlGroup === 'true') {
                        //   flag = ''
                        // }
                        metadata.push({ key: window.rejectIndicates[i], value: points[window.rejectIndicates[i]].metadata.label, src: src, prediction: points[window.rejectIndicates[i]].current_prediction, flag: flag });
                    }
                    if (msgId) {
                        logging.setModalMessage(null, msgId);
                    }
                }).catch(error => {
                    console.log("error", error);
                    if (msgId) {
                        logging.setModalMessage(null, msgId);
                    }
                    for (let i = 0; i < window.rejectIndicates.length; i++) {
                        let src = '';
                        // let flag = points[window.rejectIndicates[i]]?.metadata.label === points[window.rejectIndicates[i]]?.current_prediction ? '' : '❗️'
                        // if(window.sessionStorage.taskType === 'anormaly detection'){
                        //   flag = points[window.rejectIndicates[i]]?.metadata.label === points[window.rejectIndicates[i]]?.current_prediction ? '' : '❗️'
                        // }
                        let flag = "";
                        // if(window.flagindecatesList?.indexOf(window.rejectIndicates[i]) !== -1){
                        //   flag = '❗️'
                        // }
                        metadata.push({ key: window.rejectIndicates[i], value: points[window.rejectIndicates[i]].metadata.label, src: src, prediction: points[window.rejectIndicates[i]].current_prediction, flag: flag });
                    }
                });
            }
            // window.customMetadata = metadata
            this.rejectMetadata = metadata;
            setTimeout(() => {
                this.addBtnListener();
            }, 100);
        });
    }
    addBtnListener() {
        const container = this.$$('#metadata-container');
        let btns = container === null || container === void 0 ? void 0 : container.querySelectorAll('.custom-list-Row');
        for (let i = 0; i < (btns === null || btns === void 0 ? void 0 : btns.length); i++) {
            let btn = btns[i];
            btn.addEventListener('mouseenter', () => {
                var _a;
                // console.log('enter',btn)
                (_a = this.projectorEventContext) === null || _a === void 0 ? void 0 : _a.notifyHoverOverPoint(Number(btn.id));
            });
        }
    }
    removeCustomListItem(i) {
        this.customMetadata.splice(i, 1);
        window.customSelection.splice(i, 1);
    }
    setLabelOption(labelOption) {
        this.labelOption = labelOption;
        if (this.pointMetadata) {
            this.label = '' + this.pointMetadata[this.labelOption];
        }
    }
    removeacceptSelItem(e) {
        let index = window.acceptIndicates.indexOf(Number(e.target.id));
        // window.customSelection.indexOf(7893)
        console.log('index22', index);
        if (index >= 0) {
            window.acceptIndicates.splice(index, 1);
            if (window.acceptInputList && window.acceptInputList[e.target.id]) {
                window.acceptInputList[e.target.id].checked = false;
            }
            this.removeFromCustomSelection(Number(e.target.id));
        }
        console.log('index22', index);
        // window.acceptInputList[e.target.id].checked = false
        this.projectorEventContext.removecustomInMetaCard();
    }
    removerejectSelItem(e) {
        let index = window.rejectIndicates.indexOf(Number(e.target.id));
        // window.customSelection.indexOf(7893)
        if (index >= 0) {
            window.rejectIndicates.splice(index, 1);
            if (window.acceptInputList && window.rejectInputList[e.target.id]) {
                window.rejectInputList[e.target.id].checked = false;
            }
            this.removeFromCustomSelection(Number(e.target.id));
        }
        // window.rejectInputList[e.target.id].checked = false
        this.projectorEventContext.removecustomInMetaCard();
    }
    removeFromCustomSelection(indicate) {
        let index = window.customSelection.indexOf(indicate);
        if (index !== -1) {
            window.customSelection.splice(index, 1);
        }
        this.projectorEventContext.refreshnoisyBtn();
    }
};
MetadataCard.template = html `
    <style>
      #metadata-card {
        background-color: rgba(255, 255, 255, 0.9);
        box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.14),
          0 1px 5px 0 rgba(0, 0, 0, 0.12), 0 3px 1px -2px rgba(0, 0, 0, 0.2);
        width: 330px;
      }

      #header {
        background: #e9e9e9;
      }

      #icon-container {
        position: absolute;
        right: 0;
        top: 4px;
      }

      #metadata-label {
        font-weight: 400;
        font-size: 14px;
        line-height: 24px;
        padding: 12px 12px 8px;
        width: 330px;
        overflow-wrap: break-word;
      }

      #metadata-table {
        display: table;
        padding: 8px 12px 4px;
      }

      .metadata-row {
        display: table-row;
        position: relative;
      }

      .metadata-key {
        font-weight: bold;
      }

      .metadata-key,
      .metadata-value {
        display: table-cell;
        font-size: 12px;
        padding: 3px 3px;
      }
      .img-container{
        margin-left: 10px;
        padding-bottom: 10px;
      }
      .custom-list-header{
        line-height: 30px;
        font-weight: 600;
        margin-bottom: 10px;
        background: #e9e9e9;
        padding: 8px;
      }
      .remove-btn{

      
        border-radius: 50%;
        width: 24px;
        height: 24px;
        text-align: center;
        padding: 0;
        border: 1px solid #ddd;
        cursor:pointer;
      }

      .metadata-value {
        word-wrap: anywhere; /* Firefox only -- word-wrap DNE in Chrome. anywhere DNE in Chrome */
        word-break: break-word; /* break-word DNE in Firefox */
      }
    </style>

    <template is="dom-if" if="[[hasMetadata]]">
      <div id="metadata-card">
        <div id="icon-container">
          <paper-icon-button
            icon="[[collapseIcon]]"
            on-tap="_toggleMetadataContainer"
          >
          </paper-icon-button>
        </div>
        <div id="header">
          <div id="metadata-label">Current Hover Detail</div>
        </div>
        <iron-collapse id="metadata-container" opened>
        <template is="dom-if" if="[[!showImg]]">No Hover Data</template>
        <template is="dom-if" if="[[showImg]]">
          <div id="metadata-table">
            <template is="dom-repeat" items="[[metadata]]">
              <div class="metadata-row">
                <div>
                <div class="metadata-key">index</div>
                <div class="metadata-value">[[item.index]]</div>
                </div>
                <div>
                <div class="metadata-key">[[item.key]]</div>
                <div class="metadata-value">[[item.value]]</div>
                </div>
                <div>
                <div class="metadata-key">prediction</div>
                <div class="metadata-value">[[item.prediction]]</div>
                </div>
                <!--<template is="dom-if" if="[[item.possibelWroung]]">
                <div id="tips-warn" style="position: absolute;right: 10px;top: 50px;" class="meta-tips">❗️</div>
                <paper-tooltip animation-delay="0" for="tips-warn"
                >disagreement between prediction and pseudo label
                </paper-tooltip>
                </template>-->
                <template is="dom-if" if="[[item.isSelected]]">
                <div id="tips-warn" style="position: absolute;right: 10px;top: 80px;" class="meta-tips">☑️selected</div>
                <paper-tooltip animation-delay="0" for="tips-warn"
                >disagreement between prediction and pseudo label
                </paper-tooltip>
                </template>
              </div>
            </template>
          </div>
          <template is="dom-if" if="[[showImg]]">
          <div class="img-container">
          <img id="metaImg" height="100px"/>
          </div>
          </template>
        </template>
          <div class="custom-list-header">selected list | [[selectedNum]]<br/>
          <span style="display:inline-block;width:150px;">Interest([[interestNum]])</span><span>Not Interest([[notInterestNum]])</span>
          </div>
          <!--<div class="metadata-row">
          <div class="metadata-key" style="padding-left: 15px;">| img |</div>
          <div class="metadata-key">index |</div>
          <div class="metadata-key" style="width: 40px;text-align: right;">label |</div>
          <div class="metadata-key">predict |</div>
          <div class="metadata-key">operation |</div>
          </div>-->
          <div style="max-height: calc(100vh - 440px);overflow: auto; padding: 0 15px;">
          <div style="display:flex;">
          <div style="width:150px;">
         Interest
          <template is="dom-repeat" items="[[customMetadata]]">
          <div class="metadata-row custom-list-Row" id=[[item.key]]>
            <div style="text-align: center;display: inline-block;position: absolute;left: -16px;" class="metadata-value">[[item.flag]]</div>
            <img src="[[item.src]]" />
            <div class="metadata-key" style="width:40px;">[[item.key]]</div>
            <!--<div class="metadata-value" style="width:40px;">[[item.value]]</div>-->
            <div class="metadata-value">[[item.prediction]]</div>
            <button class="remove-btn" id="[[item.key]]" on-click="removeacceptSelItem">✖️</button>
          </div>
          </div>
        </template>
        </div>
        <div style="width:150px;">
        Not Interest
        <template is="dom-repeat" items="[[rejectMetadata]]">
        <div class="metadata-row custom-list-Row" id=[[item.key]]>
          <div style="text-align: center;display: inline-block;position: absolute;left: -16px;" class="metadata-value">[[item.flag]]</div>
          <img src="[[item.src]]" />
          <div class="metadata-key" style="width:40px;">[[item.key]]</div>
          <!--<div class="metadata-value" style="width:40px;">[[item.value]]</div>-->
          <div class="metadata-value">[[item.prediction]]</div>
          <button class="remove-btn" id="[[item.key]]" on-click="removerejectSelItem">✖️</button>
        </div>
        </div>
      </template>
      </div>
      </div>
        </iron-collapse>
      </div>
    </template>
  `;
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], MetadataCard.prototype, "hasMetadata", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], MetadataCard.prototype, "showImg", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], MetadataCard.prototype, "selectedNum", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], MetadataCard.prototype, "interestNum", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], MetadataCard.prototype, "notInterestNum", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], MetadataCard.prototype, "isCollapsed", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], MetadataCard.prototype, "collapseIcon", void 0);
__decorate([
    property({ type: Array }),
    __metadata("design:type", Array)
], MetadataCard.prototype, "metadata", void 0);
__decorate([
    property({ type: Array }),
    __metadata("design:type", Array)
], MetadataCard.prototype, "customMetadata", void 0);
__decorate([
    property({ type: Array }),
    __metadata("design:type", Array)
], MetadataCard.prototype, "rejectMetadata", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], MetadataCard.prototype, "currentRemove", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], MetadataCard.prototype, "label", void 0);
__decorate([
    observe('currentRemove'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MetadataCard.prototype, "_remove", null);
MetadataCard = __decorate([
    customElement('vz-projector-metadata-card')
], MetadataCard);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLW1ldGFkYXRhLWNhcmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi90ZW5zb3Jib2FyZC9wcm9qZWN0b3IvdnotcHJvamVjdG9yLW1ldGFkYXRhLWNhcmQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7O2dGQWFnRjtBQUNoRixPQUFPLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxhQUFhLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQ3ZFLE9BQU8sS0FBSyxPQUFPLE1BQU0sV0FBVyxDQUFDO0FBRXJDLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ2hGLE9BQU8sd0NBQXdDLENBQUM7QUFNaEQsSUFBTSxZQUFZLEdBQWxCLE1BQU0sWUFBYSxTQUFRLGtCQUFrQixDQUFDLGNBQWMsQ0FBQztJQUE3RDs7UUFnTEUsZ0JBQVcsR0FBWSxJQUFJLENBQUM7UUFHNUIsWUFBTyxHQUFZLEtBQUssQ0FBQztRQUd6QixnQkFBVyxHQUFXLENBQUMsQ0FBQztRQUd4QixnQkFBVyxHQUFXLENBQUMsQ0FBQztRQUd4QixtQkFBYyxHQUFXLENBQUMsQ0FBQTtRQUcxQixnQkFBVyxHQUFZLEtBQUssQ0FBQztRQUc3QixpQkFBWSxHQUFXLGFBQWEsQ0FBQztRQXNCckMsa0JBQWEsR0FBVyxJQUFJLENBQUE7SUFrUjlCLENBQUM7SUF0UUMsNENBQTRDO0lBQzVDLHdCQUF3QjtRQUNyQixJQUFJLENBQUMsRUFBRSxDQUFDLHFCQUFxQixDQUFTLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDakQsSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7UUFDckMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FB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LE1BQU0sRUFBQyxDQUFDOzhCQUNWLE1BQU07b0RBQUk7QUFHMUI7SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUM7O2lEQUNDO0FBRzdCO0lBREMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDOztrREFDVTtBQUdyQztJQURDLFFBQVEsQ0FBQyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQzs4QkFDaEIsS0FBSzs4Q0FHWjtBQUVIO0lBREMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDOzhCQUNWLEtBQUs7b0RBSWxCO0FBR0g7SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUM7OEJBQ1YsS0FBSztvREFJbEI7QUFHSDtJQURDLFFBQVEsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQzs4QkFDWixNQUFNO21EQUFPO0FBRzVCO0lBREMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDOzsyQ0FDYjtBQWlCZDtJQURDLE9BQU8sQ0FBQyxlQUFlLENBQUM7Ozs7MkNBR3hCO0FBOU9HLFlBQVk7SUFEakIsYUFBYSxDQUFDLDRCQUE0QixDQUFDO0dBQ3RDLFlBQVksQ0EwZWpCIiwic291cmNlc0NvbnRlbnQiOlsiLyogQ29weXJpZ2h0IDIwMTYgVGhlIFRlbnNvckZsb3cgQXV0aG9ycy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG49PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuaW1wb3J0IHsgUG9seW1lckVsZW1lbnQsIGh0bWwgfSBmcm9tICdAcG9seW1lci9wb2x5bWVyJztcbmltcG9ydCB7IGN1c3RvbUVsZW1lbnQsIG9ic2VydmUsIHByb3BlcnR5IH0gZnJvbSAnQHBvbHltZXIvZGVjb3JhdG9ycyc7XG5pbXBvcnQgKiBhcyBsb2dnaW5nIGZyb20gJy4vbG9nZ2luZyc7XG5cbmltcG9ydCB7IExlZ2FjeUVsZW1lbnRNaXhpbiB9IGZyb20gJy4uL2NvbXBvbmVudHMvcG9seW1lci9sZWdhY3lfZWxlbWVudF9taXhpbic7XG5pbXBvcnQgJy4uL2NvbXBvbmVudHMvcG9seW1lci9pcm9uc19hbmRfcGFwZXJzJztcblxuaW1wb3J0IHsgUG9pbnRNZXRhZGF0YSB9IGZyb20gJy4vZGF0YSc7XG5pbXBvcnQgeyBQcm9qZWN0b3JFdmVudENvbnRleHQgfSBmcm9tICcuL3Byb2plY3RvckV2ZW50Q29udGV4dCc7XG5cbkBjdXN0b21FbGVtZW50KCd2ei1wcm9qZWN0b3ItbWV0YWRhdGEtY2FyZCcpXG5jbGFzcyBNZXRhZGF0YUNhcmQgZXh0ZW5kcyBMZWdhY3lFbGVtZW50TWl4aW4oUG9seW1lckVsZW1lbnQpIHtcbiAgc3RhdGljIHJlYWRvbmx5IHRlbXBsYXRlID0gaHRtbGBcbiAgICA8c3R5bGU+XG4gICAgICAjbWV0YWRhdGEtY2FyZCB7XG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC45KTtcbiAgICAgICAgYm94LXNoYWRvdzogMCAycHggMnB4IDAgcmdiYSgwLCAwLCAwLCAwLjE0KSxcbiAgICAgICAgICAwIDFweCA1cHggMCByZ2JhKDAsIDAsIDAsIDAuMTIpLCAwIDNweCAxcHggLTJweCByZ2JhKDAsIDAsIDAsIDAuMik7XG4gICAgICAgIHdpZHRoOiAzMzBweDtcbiAgICAgIH1cblxuICAgICAgI2hlYWRlciB7XG4gICAgICAgIGJhY2tncm91bmQ6ICNlOWU5ZTk7XG4gICAgICB9XG5cbiAgICAgICNpY29uLWNvbnRhaW5lciB7XG4gICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgcmlnaHQ6IDA7XG4gICAgICAgIHRvcDogNHB4O1xuICAgICAgfVxuXG4gICAgICAjbWV0YWRhdGEtbGFiZWwge1xuICAgICAgICBmb250LXdlaWdodDogNDAwO1xuICAgICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICAgIGxpbmUtaGVpZ2h0OiAyNHB4O1xuICAgICAgICBwYWRkaW5nOiAxMnB4IDEycHggOHB4O1xuICAgICAgICB3aWR0aDogMzMwcHg7XG4gICAgICAgIG92ZXJmbG93LXdyYXA6IGJyZWFrLXdvcmQ7XG4gICAgICB9XG5cbiAgICAgICNtZXRhZGF0YS10YWJsZSB7XG4gICAgICAgIGRpc3BsYXk6IHRhYmxlO1xuICAgICAgICBwYWRkaW5nOiA4cHggMTJweCA0cHg7XG4gICAgICB9XG5cbiAgICAgIC5tZXRhZGF0YS1yb3cge1xuICAgICAgICBkaXNwbGF5OiB0YWJsZS1yb3c7XG4gICAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgIH1cblxuICAgICAgLm1ldGFkYXRhLWtleSB7XG4gICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgfVxuXG4gICAgICAubWV0YWRhdGEta2V5LFxuICAgICAgLm1ldGFkYXRhLXZhbHVlIHtcbiAgICAgICAgZGlzcGxheTogdGFibGUtY2VsbDtcbiAgICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgICBwYWRkaW5nOiAzcHggM3B4O1xuICAgICAgfVxuICAgICAgLmltZy1jb250YWluZXJ7XG4gICAgICAgIG1hcmdpbi1sZWZ0OiAxMHB4O1xuICAgICAgICBwYWRkaW5nLWJvdHRvbTogMTBweDtcbiAgICAgIH1cbiAgICAgIC5jdXN0b20tbGlzdC1oZWFkZXJ7XG4gICAgICAgIGxpbmUtaGVpZ2h0OiAzMHB4O1xuICAgICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xuICAgICAgICBiYWNrZ3JvdW5kOiAjZTllOWU5O1xuICAgICAgICBwYWRkaW5nOiA4cHg7XG4gICAgICB9XG4gICAgICAucmVtb3ZlLWJ0bntcblxuICAgICAgXG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcbiAgICAgICAgd2lkdGg6IDI0cHg7XG4gICAgICAgIGhlaWdodDogMjRweDtcbiAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCAjZGRkO1xuICAgICAgICBjdXJzb3I6cG9pbnRlcjtcbiAgICAgIH1cblxuICAgICAgLm1ldGFkYXRhLXZhbHVlIHtcbiAgICAgICAgd29yZC13cmFwOiBhbnl3aGVyZTsgLyogRmlyZWZveCBvbmx5IC0tIHdvcmQtd3JhcCBETkUgaW4gQ2hyb21lLiBhbnl3aGVyZSBETkUgaW4gQ2hyb21lICovXG4gICAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7IC8qIGJyZWFrLXdvcmQgRE5FIGluIEZpcmVmb3ggKi9cbiAgICAgIH1cbiAgICA8L3N0eWxlPlxuXG4gICAgPHRlbXBsYXRlIGlzPVwiZG9tLWlmXCIgaWY9XCJbW2hhc01ldGFkYXRhXV1cIj5cbiAgICAgIDxkaXYgaWQ9XCJtZXRhZGF0YS1jYXJkXCI+XG4gICAgICAgIDxkaXYgaWQ9XCJpY29uLWNvbnRhaW5lclwiPlxuICAgICAgICAgIDxwYXBlci1pY29uLWJ1dHRvblxuICAgICAgICAgICAgaWNvbj1cIltbY29sbGFwc2VJY29uXV1cIlxuICAgICAgICAgICAgb24tdGFwPVwiX3RvZ2dsZU1ldGFkYXRhQ29udGFpbmVyXCJcbiAgICAgICAgICA+XG4gICAgICAgICAgPC9wYXBlci1pY29uLWJ1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgaWQ9XCJoZWFkZXJcIj5cbiAgICAgICAgICA8ZGl2IGlkPVwibWV0YWRhdGEtbGFiZWxcIj5DdXJyZW50IEhvdmVyIERldGFpbDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGlyb24tY29sbGFwc2UgaWQ9XCJtZXRhZGF0YS1jb250YWluZXJcIiBvcGVuZWQ+XG4gICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1pZlwiIGlmPVwiW1shc2hvd0ltZ11dXCI+Tm8gSG92ZXIgRGF0YTwvdGVtcGxhdGU+XG4gICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1pZlwiIGlmPVwiW1tzaG93SW1nXV1cIj5cbiAgICAgICAgICA8ZGl2IGlkPVwibWV0YWRhdGEtdGFibGVcIj5cbiAgICAgICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1yZXBlYXRcIiBpdGVtcz1cIltbbWV0YWRhdGFdXVwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWV0YWRhdGEtcm93XCI+XG4gICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWV0YWRhdGEta2V5XCI+aW5kZXg8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWV0YWRhdGEtdmFsdWVcIj5bW2l0ZW0uaW5kZXhdXTwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1ldGFkYXRhLWtleVwiPltbaXRlbS5rZXldXTwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXRhZGF0YS12YWx1ZVwiPltbaXRlbS52YWx1ZV1dPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWV0YWRhdGEta2V5XCI+cHJlZGljdGlvbjwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXRhZGF0YS12YWx1ZVwiPltbaXRlbS5wcmVkaWN0aW9uXV08L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8IS0tPHRlbXBsYXRlIGlzPVwiZG9tLWlmXCIgaWY9XCJbW2l0ZW0ucG9zc2liZWxXcm91bmddXVwiPlxuICAgICAgICAgICAgICAgIDxkaXYgaWQ9XCJ0aXBzLXdhcm5cIiBzdHlsZT1cInBvc2l0aW9uOiBhYnNvbHV0ZTtyaWdodDogMTBweDt0b3A6IDUwcHg7XCIgY2xhc3M9XCJtZXRhLXRpcHNcIj7inZfvuI88L2Rpdj5cbiAgICAgICAgICAgICAgICA8cGFwZXItdG9vbHRpcCBhbmltYXRpb24tZGVsYXk9XCIwXCIgZm9yPVwidGlwcy13YXJuXCJcbiAgICAgICAgICAgICAgICA+ZGlzYWdyZWVtZW50IGJldHdlZW4gcHJlZGljdGlvbiBhbmQgcHNldWRvIGxhYmVsXG4gICAgICAgICAgICAgICAgPC9wYXBlci10b29sdGlwPlxuICAgICAgICAgICAgICAgIDwvdGVtcGxhdGU+LS0+XG4gICAgICAgICAgICAgICAgPHRlbXBsYXRlIGlzPVwiZG9tLWlmXCIgaWY9XCJbW2l0ZW0uaXNTZWxlY3RlZF1dXCI+XG4gICAgICAgICAgICAgICAgPGRpdiBpZD1cInRpcHMtd2FyblwiIHN0eWxlPVwicG9zaXRpb246IGFic29sdXRlO3JpZ2h0OiAxMHB4O3RvcDogODBweDtcIiBjbGFzcz1cIm1ldGEtdGlwc1wiPuKYke+4j3NlbGVjdGVkPC9kaXY+XG4gICAgICAgICAgICAgICAgPHBhcGVyLXRvb2x0aXAgYW5pbWF0aW9uLWRlbGF5PVwiMFwiIGZvcj1cInRpcHMtd2FyblwiXG4gICAgICAgICAgICAgICAgPmRpc2FncmVlbWVudCBiZXR3ZWVuIHByZWRpY3Rpb24gYW5kIHBzZXVkbyBsYWJlbFxuICAgICAgICAgICAgICAgIDwvcGFwZXItdG9vbHRpcD5cbiAgICAgICAgICAgICAgICA8L3RlbXBsYXRlPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvdGVtcGxhdGU+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPHRlbXBsYXRlIGlzPVwiZG9tLWlmXCIgaWY9XCJbW3Nob3dJbWddXVwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJpbWctY29udGFpbmVyXCI+XG4gICAgICAgICAgPGltZyBpZD1cIm1ldGFJbWdcIiBoZWlnaHQ9XCIxMDBweFwiLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L3RlbXBsYXRlPlxuICAgICAgICA8L3RlbXBsYXRlPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjdXN0b20tbGlzdC1oZWFkZXJcIj5zZWxlY3RlZCBsaXN0IHwgW1tzZWxlY3RlZE51bV1dPGJyLz5cbiAgICAgICAgICA8c3BhbiBzdHlsZT1cImRpc3BsYXk6aW5saW5lLWJsb2NrO3dpZHRoOjE1MHB4O1wiPkludGVyZXN0KFtbaW50ZXJlc3ROdW1dXSk8L3NwYW4+PHNwYW4+Tm90IEludGVyZXN0KFtbbm90SW50ZXJlc3ROdW1dXSk8L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPCEtLTxkaXYgY2xhc3M9XCJtZXRhZGF0YS1yb3dcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwibWV0YWRhdGEta2V5XCIgc3R5bGU9XCJwYWRkaW5nLWxlZnQ6IDE1cHg7XCI+fCBpbWcgfDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXRhZGF0YS1rZXlcIj5pbmRleCB8PC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIm1ldGFkYXRhLWtleVwiIHN0eWxlPVwid2lkdGg6IDQwcHg7dGV4dC1hbGlnbjogcmlnaHQ7XCI+bGFiZWwgfDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXRhZGF0YS1rZXlcIj5wcmVkaWN0IHw8L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwibWV0YWRhdGEta2V5XCI+b3BlcmF0aW9uIHw8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj4tLT5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwibWF4LWhlaWdodDogY2FsYygxMDB2aCAtIDQ0MHB4KTtvdmVyZmxvdzogYXV0bzsgcGFkZGluZzogMCAxNXB4O1wiPlxuICAgICAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7XCI+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cIndpZHRoOjE1MHB4O1wiPlxuICAgICAgICAgSW50ZXJlc3RcbiAgICAgICAgICA8dGVtcGxhdGUgaXM9XCJkb20tcmVwZWF0XCIgaXRlbXM9XCJbW2N1c3RvbU1ldGFkYXRhXV1cIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwibWV0YWRhdGEtcm93IGN1c3RvbS1saXN0LVJvd1wiIGlkPVtbaXRlbS5rZXldXT5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJ0ZXh0LWFsaWduOiBjZW50ZXI7ZGlzcGxheTogaW5saW5lLWJsb2NrO3Bvc2l0aW9uOiBhYnNvbHV0ZTtsZWZ0OiAtMTZweDtcIiBjbGFzcz1cIm1ldGFkYXRhLXZhbHVlXCI+W1tpdGVtLmZsYWddXTwvZGl2PlxuICAgICAgICAgICAgPGltZyBzcmM9XCJbW2l0ZW0uc3JjXV1cIiAvPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1ldGFkYXRhLWtleVwiIHN0eWxlPVwid2lkdGg6NDBweDtcIj5bW2l0ZW0ua2V5XV08L2Rpdj5cbiAgICAgICAgICAgIDwhLS08ZGl2IGNsYXNzPVwibWV0YWRhdGEtdmFsdWVcIiBzdHlsZT1cIndpZHRoOjQwcHg7XCI+W1tpdGVtLnZhbHVlXV08L2Rpdj4tLT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXRhZGF0YS12YWx1ZVwiPltbaXRlbS5wcmVkaWN0aW9uXV08L2Rpdj5cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJyZW1vdmUtYnRuXCIgaWQ9XCJbW2l0ZW0ua2V5XV1cIiBvbi1jbGljaz1cInJlbW92ZWFjY2VwdFNlbEl0ZW1cIj7inJbvuI88L2J1dHRvbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJ3aWR0aDoxNTBweDtcIj5cbiAgICAgICAgTm90IEludGVyZXN0XG4gICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1yZXBlYXRcIiBpdGVtcz1cIltbcmVqZWN0TWV0YWRhdGFdXVwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwibWV0YWRhdGEtcm93IGN1c3RvbS1saXN0LVJvd1wiIGlkPVtbaXRlbS5rZXldXT5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwidGV4dC1hbGlnbjogY2VudGVyO2Rpc3BsYXk6IGlubGluZS1ibG9jaztwb3NpdGlvbjogYWJzb2x1dGU7bGVmdDogLTE2cHg7XCIgY2xhc3M9XCJtZXRhZGF0YS12YWx1ZVwiPltbaXRlbS5mbGFnXV08L2Rpdj5cbiAgICAgICAgICA8aW1nIHNyYz1cIltbaXRlbS5zcmNdXVwiIC8+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIm1ldGFkYXRhLWtleVwiIHN0eWxlPVwid2lkdGg6NDBweDtcIj5bW2l0ZW0ua2V5XV08L2Rpdj5cbiAgICAgICAgICA8IS0tPGRpdiBjbGFzcz1cIm1ldGFkYXRhLXZhbHVlXCIgc3R5bGU9XCJ3aWR0aDo0MHB4O1wiPltbaXRlbS52YWx1ZV1dPC9kaXY+LS0+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIm1ldGFkYXRhLXZhbHVlXCI+W1tpdGVtLnByZWRpY3Rpb25dXTwvZGl2PlxuICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJyZW1vdmUtYnRuXCIgaWQ9XCJbW2l0ZW0ua2V5XV1cIiBvbi1jbGljaz1cInJlbW92ZXJlamVjdFNlbEl0ZW1cIj7inJbvuI88L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICAgIDwvaXJvbi1jb2xsYXBzZT5cbiAgICAgIDwvZGl2PlxuICAgIDwvdGVtcGxhdGU+XG4gIGA7XG5cbiAgQHByb3BlcnR5KHsgdHlwZTogQm9vbGVhbiB9KVxuICBoYXNNZXRhZGF0YTogYm9vbGVhbiA9IHRydWU7XG5cbiAgQHByb3BlcnR5KHsgdHlwZTogQm9vbGVhbiB9KVxuICBzaG93SW1nOiBib29sZWFuID0gZmFsc2U7XG5cbiAgQHByb3BlcnR5KHsgdHlwZTogTnVtYmVyIH0pXG4gIHNlbGVjdGVkTnVtOiBOdW1iZXIgPSAwO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IE51bWJlcn0pXG4gIGludGVyZXN0TnVtOiBOdW1iZXIgPSAwO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IE51bWJlcn0pXG4gIG5vdEludGVyZXN0TnVtOiBOdW1iZXIgPSAwXG5cbiAgQHByb3BlcnR5KHsgdHlwZTogQm9vbGVhbiB9KVxuICBpc0NvbGxhcHNlZDogYm9vbGVhbiA9IGZhbHNlO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IFN0cmluZyB9KVxuICBjb2xsYXBzZUljb246IHN0cmluZyA9ICdleHBhbmQtbGVzcyc7XG5cbiAgQHByb3BlcnR5KHsgdHlwZTogQXJyYXkgfSlcbiAgbWV0YWRhdGE6IEFycmF5PHtcbiAgICBrZXk6IHN0cmluZztcbiAgICB2YWx1ZTogc3RyaW5nO1xuICB9PjtcbiAgQHByb3BlcnR5KHsgdHlwZTogQXJyYXkgfSlcbiAgY3VzdG9tTWV0YWRhdGE6IEFycmF5PHtcbiAgICBrZXk6IHN0cmluZztcbiAgICB2YWx1ZTogc3RyaW5nO1xuICAgIHNyYz86IHN0cmluZztcbiAgfT47XG5cbiAgQHByb3BlcnR5KHsgdHlwZTogQXJyYXkgfSlcbiAgcmVqZWN0TWV0YWRhdGE6IEFycmF5PHtcbiAgICBrZXk6IHN0cmluZztcbiAgICB2YWx1ZTogc3RyaW5nO1xuICAgIHNyYz86IHN0cmluZztcbiAgfT47XG5cbiAgQHByb3BlcnR5KHsgdHlwZTogTnVtYmVyIH0pXG4gIGN1cnJlbnRSZW1vdmU6IE51bWJlciA9IG51bGxcblxuICBAcHJvcGVydHkoeyB0eXBlOiBTdHJpbmcgfSlcbiAgbGFiZWw6IHN0cmluZztcblxuICBwcml2YXRlIGxhYmVsT3B0aW9uOiBzdHJpbmc7XG4gIHByaXZhdGUgcG9pbnRNZXRhZGF0YTogUG9pbnRNZXRhZGF0YTtcbiAgcHJpdmF0ZSByZXN1bHRJbWc6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIHBvaW50czogYW55XG4gIHByaXZhdGUgcHJvamVjdG9yRXZlbnRDb250ZXh0OiBQcm9qZWN0b3JFdmVudENvbnRleHRcblxuXG4gIC8qKiBIYW5kbGVzIHRvZ2dsZSBvZiBtZXRhZGF0YS1jb250YWluZXIuICovXG4gIF90b2dnbGVNZXRhZGF0YUNvbnRhaW5lcigpIHtcbiAgICAodGhpcy4kJCgnI21ldGFkYXRhLWNvbnRhaW5lcicpIGFzIGFueSkudG9nZ2xlKCk7XG4gICAgdGhpcy5pc0NvbGxhcHNlZCA9ICF0aGlzLmlzQ29sbGFwc2VkO1xuICAgIHRoaXMuc2V0KCdjb2xsYXBzZUljb24nLCB0aGlzLmlzQ29sbGFwc2VkID8gJ2V4cGFuZC1tb3JlJyA6ICdleHBhbmQtbGVzcycpO1xuICB9XG5cbiAgQG9ic2VydmUoJ2N1cnJlbnRSZW1vdmUnKVxuICBfcmVtb3ZlKCkge1xuICAgIGNvbnNvbGUubG9nKCcxMTEnLCB0aGlzLmN1cnJlbnRSZW1vdmUpXG4gIH1cblxuXG5cbiAgdXBkYXRlTWV0YWRhdGEocG9pbnRNZXRhZGF0YT86IFBvaW50TWV0YWRhdGEsIHNyYz86IHN0cmluZywgcG9pbnQ/OiBhbnksIGluZGljYXRlPzogbnVtYmVyKSB7XG4gICAgdGhpcy5wb2ludE1ldGFkYXRhID0gcG9pbnRNZXRhZGF0YTtcbiAgICB0aGlzLnNob3dJbWcgPSBwb2ludE1ldGFkYXRhICE9IG51bGxcblxuICAgIHRoaXMuaGFzTWV0YWRhdGEgPSB0cnVlXG4gICAgaWYgKCF3aW5kb3cucHJldmlvdXNJbmRlY2F0ZXMpIHtcbiAgICAgIHdpbmRvdy5wcmV2aW91c0luZGVjYXRlcyA9IFtdXG4gICAgfVxuICAgIGlmIChwb2ludE1ldGFkYXRhKSB7XG4gICAgICBsZXQgbWV0YWRhdGEgPSBbXTtcbiAgICAgIGZvciAobGV0IG1ldGFkYXRhS2V5IGluIHBvaW50TWV0YWRhdGEpIHtcbiAgICAgICAgaWYgKCFwb2ludE1ldGFkYXRhLmhhc093blByb3BlcnR5KG1ldGFkYXRhS2V5KSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHZhbHVlID0gcG9pbnRNZXRhZGF0YVttZXRhZGF0YUtleV1cbiAgICAgICAgaWYgKHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dICYmIGluZGljYXRlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpZiAod2luZG93LnByb3BlcnRpZXNbd2luZG93Lml0ZXJhdGlvbl1baW5kaWNhdGVdID09PSAxKSB7XG4gICAgICAgICAgICB2YWx1ZSA9ICd1bmxhYmVsZWQnXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG1ldGFkYXRhLnB1c2goeyBpbmRleDppbmRpY2F0ZSwga2V5OiBtZXRhZGF0YUtleSwgdmFsdWU6IHZhbHVlLCBwcmVkaWN0aW9uOiBwb2ludFsnY3VycmVudF9wcmVkaWN0aW9uJ10sIHBvc3NpYmVsV3JvdW5nOiB2YWx1ZSAhPT0gcG9pbnRbJ2N1cnJlbnRfcHJlZGljdGlvbiddLCBpc1NlbGVjdGVkOiB3aW5kb3cucHJldmlvdXNJbmRlY2F0ZXM/LmluZGV4T2YoaW5kaWNhdGUpICE9PSAtMSB9KTtcbiAgICAgIH1cbiAgICAgIHRoaXMubWV0YWRhdGEgPSBtZXRhZGF0YTtcbiAgICAgIHRoaXMubGFiZWwgPSAnJyArIHRoaXMucG9pbnRNZXRhZGF0YVt0aGlzLmxhYmVsT3B0aW9uXTtcbiAgICAgIC8vaW1nXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5yZXN1bHRJbWcgPSB0aGlzLiQkKCcjbWV0YUltZycpIGFzIEhUTUxBbmNob3JFbGVtZW50O1xuICAgICAgICBpZiAoc3JjPy5sZW5ndGgpIHtcbiAgICAgICAgICB0aGlzLnJlc3VsdEltZz8uc2V0QXR0cmlidXRlKFwic3R5bGVcIiwgXCJkaXNwbGF5OmJsb2NrO1wiKVxuICAgICAgICAgIHRoaXMucmVzdWx0SW1nPy5zZXRBdHRyaWJ1dGUoJ3NyYycsIHNyYylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJlc3VsdEltZz8uc2V0QXR0cmlidXRlKFwic3R5bGVcIiwgXCJkaXNwbGF5Om5vbmU7XCIpXG4gICAgICAgIH1cbiAgICAgIH0sIDEwMClcbiAgICB9XG4gIH1cblxuICBhc3luYyB1cGRhdGVDdXN0b21MaXN0KHBvaW50czogYW55LCBwcm9qZWN0b3JFdmVudENvbnRleHQ/OiBQcm9qZWN0b3JFdmVudENvbnRleHQpIHtcbiAgICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dCA9IHByb2plY3RvckV2ZW50Q29udGV4dFxuICAgIGlmIChwb2ludHMpIHtcbiAgICAgIHRoaXMucG9pbnRzID0gcG9pbnRzXG4gICAgfVxuXG5cbiAgICBpZiAoIXdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMgfHwgd2luZG93LmFjY2VwdEluZGljYXRlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuY3VzdG9tTWV0YWRhdGEgPSBbXVxuICAgIH1cbiAgICB0aGlzLmhhc01ldGFkYXRhID0gdHJ1ZTtcbiAgICB0aGlzLnNlbGVjdGVkTnVtID0gd2luZG93LmFjY2VwdEluZGljYXRlcz8ubGVuZ3RoICsgd2luZG93LnJlamVjdEluZGljYXRlcz8ubGVuZ3RoXG4gICAgdGhpcy5pbnRlcmVzdE51bSA9IHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXM/Lmxlbmd0aFxuICAgIHRoaXMubm90SW50ZXJlc3ROdW0gPSB3aW5kb3cucmVqZWN0SW5kaWNhdGVzPy5sZW5ndGhcbiAgICBsZXQgbWV0YWRhdGEgPSBbXTtcbiAgICBsZXQgRFZJU2VydmVyID0gd2luZG93LnNlc3Npb25TdG9yYWdlLmlwQWRkcmVzcztcbiAgICBsZXQgYmFzZVBhdGggPSB3aW5kb3cubW9kZWxNYXRoXG4gICAgbGV0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICAgIGhlYWRlcnMuYXBwZW5kKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIGhlYWRlcnMuYXBwZW5kKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIGlmICh3aW5kb3cuYWNjZXB0SW5kaWNhdGVzKSB7XG4gICAgICBsZXQgbXNnSWRcbiAgICAgIGlmICh3aW5kb3cuYWNjZXB0SW5kaWNhdGVzLmxlbmd0aCA+IDEwMDApIHtcbiAgICAgICAgbXNnSWQgPSBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZSgnVXBkYXRlIGluZy4uLicpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCBmZXRjaChgaHR0cDovLyR7RFZJU2VydmVyfS9zcHJpdGVMaXN0YCwge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgbW9kZTogJ2NvcnMnLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgXCJwYXRoXCI6IGJhc2VQYXRoLCBcImluZGV4XCI6IHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMsXG4gICAgICAgIH0pLFxuICAgICAgICBoZWFkZXJzOiBoZWFkZXJzLFxuICAgICAgfSkudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgd2luZG93LmFjY2VwdEluZGljYXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGxldCBzcmMgPSBkYXRhLnVybExpc3Rbd2luZG93LmFjY2VwdEluZGljYXRlc1tpXV1cbiAgICAgICAgICAvLyBsZXQgZmxhZyA9IHBvaW50c1t3aW5kb3cuYWNjZXB0SW5kaWNhdGVzW2ldXT8ubWV0YWRhdGEubGFiZWwgPT09IHBvaW50c1t3aW5kb3cuYWNjZXB0SW5kaWNhdGVzW2ldXT8uY3VycmVudF9wcmVkaWN0aW9uID8gJycgOiAn4p2X77iPJ1xuICAgICAgICAgIGxldCBmbGFnID0gXCJcIlxuICAgICAgICAgIC8vIGlmKHdpbmRvdy5mbGFnaW5kZWNhdGVzTGlzdD8uaW5kZXhPZih3aW5kb3cuYWNjZXB0SW5kaWNhdGVzW2ldKSAhPT0gLTEpe1xuICAgICAgICAgIC8vICAgZmxhZyA9ICfinZfvuI8nXG4gICAgICAgICAgLy8gfVxuICAgICAgICAgIC8vIGlmICh3aW5kb3cuc2Vzc2lvblN0b3JhZ2UuaXNDb250cm9sR3JvdXAgPT09ICd0cnVlJykge1xuICAgICAgICAgIC8vICAgZmxhZyA9ICcnXG4gICAgICAgICAgLy8gfVxuICAgICAgICAgIG1ldGFkYXRhLnB1c2goeyBrZXk6IHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXNbaV0sIHZhbHVlOiBwb2ludHNbd2luZG93LmFjY2VwdEluZGljYXRlc1tpXV0ubWV0YWRhdGEubGFiZWwsIHNyYzogc3JjLCBwcmVkaWN0aW9uOiBwb2ludHNbd2luZG93LmFjY2VwdEluZGljYXRlc1tpXV0uY3VycmVudF9wcmVkaWN0aW9uLCBmbGFnOiBmbGFnIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtc2dJZCkge1xuICAgICAgICAgIGxvZ2dpbmcuc2V0TW9kYWxNZXNzYWdlKG51bGwsIG1zZ0lkKTtcbiAgICAgICAgfVxuICAgICAgfSkuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcImVycm9yXCIsIGVycm9yKTtcbiAgICAgICAgaWYgKG1zZ0lkKSB7XG4gICAgICAgICAgbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UobnVsbCwgbXNnSWQpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgd2luZG93LmFjY2VwdEluZGljYXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGxldCBzcmMgPSAnJ1xuICAgICAgICAgIC8vIGxldCBmbGFnID0gcG9pbnRzW3dpbmRvdy5hY2NlcHRJbmRpY2F0ZXNbaV1dPy5tZXRhZGF0YS5sYWJlbCA9PT0gcG9pbnRzW3dpbmRvdy5hY2NlcHRJbmRpY2F0ZXNbaV1dPy5jdXJyZW50X3ByZWRpY3Rpb24gPyAnJyA6ICfinZfvuI8nXG4gICAgICAgICAgbGV0IGZsYWcgPSBcIlwiXG4gICAgICAgICAgLy8gaWYod2luZG93LmZsYWdpbmRlY2F0ZXNMaXN0Py5pbmRleE9mKHdpbmRvdy5yZWplY3RJbmRpY2F0ZXNbaV0pICE9PSAtMSl7XG4gICAgICAgICAgLy8gICBmbGFnID0gJ+Kdl++4jydcbiAgICAgICAgICAvLyB9XG4gICAgICAgICAgbWV0YWRhdGEucHVzaCh7IGtleTogd2luZG93LmFjY2VwdEluZGljYXRlc1tpXSwgdmFsdWU6IHBvaW50c1t3aW5kb3cuYWNjZXB0SW5kaWNhdGVzW2ldXS5tZXRhZGF0YS5sYWJlbCwgc3JjOiBzcmMsIHByZWRpY3Rpb246IHBvaW50c1t3aW5kb3cuYWNjZXB0SW5kaWNhdGVzW2ldXS5jdXJyZW50X3ByZWRpY3Rpb24sIGZsYWc6IGZsYWcgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgfVxuICAgIHdpbmRvdy5jdXN0b21NZXRhZGF0YSA9IG1ldGFkYXRhXG4gICAgdGhpcy5jdXN0b21NZXRhZGF0YSA9IG1ldGFkYXRhO1xuXG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLmFkZEJ0bkxpc3RlbmVyKClcbiAgICB9LCAzMDAwKVxuICB9XG5cbiAgYXN5bmMgdXBkYXRlUmVqZWN0TGlzdChwb2ludHM6IGFueSwgcHJvamVjdG9yRXZlbnRDb250ZXh0PzogUHJvamVjdG9yRXZlbnRDb250ZXh0KSB7XG4gICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQgPSBwcm9qZWN0b3JFdmVudENvbnRleHRcbiAgICBpZiAocG9pbnRzKSB7XG4gICAgICB0aGlzLnBvaW50cyA9IHBvaW50c1xuICAgIH1cblxuXG4gICAgaWYgKCF3aW5kb3cucmVqZWN0SW5kaWNhdGVzIHx8IHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLnJlamVjdE1ldGFkYXRhID0gW11cbiAgICB9XG4gICAgdGhpcy5oYXNNZXRhZGF0YSA9IHRydWU7XG4gICAgdGhpcy5zZWxlY3RlZE51bSA9IHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXM/Lmxlbmd0aCArIHdpbmRvdy5yZWplY3RJbmRpY2F0ZXM/Lmxlbmd0aFxuICAgIHRoaXMuaW50ZXJlc3ROdW0gPSB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzPy5sZW5ndGhcbiAgICB0aGlzLm5vdEludGVyZXN0TnVtID0gd2luZG93LnJlamVjdEluZGljYXRlcz8ubGVuZ3RoXG4gICAgbGV0IG1ldGFkYXRhID0gW107XG4gICAgbGV0IERWSVNlcnZlciA9IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5pcEFkZHJlc3M7XG4gICAgbGV0IGJhc2VQYXRoID0gd2luZG93Lm1vZGVsTWF0aFxuICAgIGxldCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBpZiAod2luZG93LnJlamVjdEluZGljYXRlcykge1xuICAgICAgbGV0IG1zZ0lkXG4gICAgICBpZiAod2luZG93LnJlamVjdEluZGljYXRlcy5sZW5ndGggPiAxMDAwKSB7XG4gICAgICAgIG1zZ0lkID0gbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UoJ1VwZGF0ZSBpbmcuLi4nKTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgZmV0Y2goYGh0dHA6Ly8ke0RWSVNlcnZlcn0vc3ByaXRlTGlzdGAsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIG1vZGU6ICdjb3JzJyxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIFwicGF0aFwiOiBiYXNlUGF0aCwgXCJpbmRleFwiOiB3aW5kb3cucmVqZWN0SW5kaWNhdGVzLFxuICAgICAgICB9KSxcbiAgICAgICAgaGVhZGVyczogaGVhZGVycyxcbiAgICAgIH0pLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKS50aGVuKGRhdGEgPT4ge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBsZXQgc3JjID0gZGF0YS51cmxMaXN0W3dpbmRvdy5yZWplY3RJbmRpY2F0ZXNbaV1dXG4gICAgICAgICAgLy8gbGV0IGZsYWcgPSBwb2ludHNbd2luZG93LnJlamVjdEluZGljYXRlc1tpXV0/Lm1ldGFkYXRhLmxhYmVsID09PSBwb2ludHNbd2luZG93LnJlamVjdEluZGljYXRlc1tpXV0/LmN1cnJlbnRfcHJlZGljdGlvbiA/ICcnIDogJ+Kdl++4jydcbiAgICAgICAgICBsZXQgZmxhZyA9IFwiXCJcbiAgICAgICAgICAvLyBpZih3aW5kb3cuZmxhZ2luZGVjYXRlc0xpc3Q/LmluZGV4T2Yod2luZG93LnJlamVjdEluZGljYXRlc1tpXSkgIT09IC0xKXtcbiAgICAgICAgICAvLyAgIGZsYWcgPSAn4p2X77iPJ1xuICAgICAgICAgIC8vIH1cbiAgICAgICAgICAvLyBpZiAod2luZG93LnNlc3Npb25TdG9yYWdlLmlzQ29udHJvbEdyb3VwID09PSAndHJ1ZScpIHtcbiAgICAgICAgICAvLyAgIGZsYWcgPSAnJ1xuICAgICAgICAgIC8vIH1cbiAgICAgICAgICBtZXRhZGF0YS5wdXNoKHsga2V5OiB3aW5kb3cucmVqZWN0SW5kaWNhdGVzW2ldLCB2YWx1ZTogcG9pbnRzW3dpbmRvdy5yZWplY3RJbmRpY2F0ZXNbaV1dLm1ldGFkYXRhLmxhYmVsLCBzcmM6IHNyYywgcHJlZGljdGlvbjogcG9pbnRzW3dpbmRvdy5yZWplY3RJbmRpY2F0ZXNbaV1dLmN1cnJlbnRfcHJlZGljdGlvbiwgZmxhZzogZmxhZyB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobXNnSWQpIHtcbiAgICAgICAgICBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZShudWxsLCBtc2dJZCk7XG4gICAgICAgIH1cbiAgICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJlcnJvclwiLCBlcnJvcik7XG4gICAgICAgIGlmIChtc2dJZCkge1xuICAgICAgICAgIGxvZ2dpbmcuc2V0TW9kYWxNZXNzYWdlKG51bGwsIG1zZ0lkKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBsZXQgc3JjID0gJydcblxuICAgICAgICAgIC8vIGxldCBmbGFnID0gcG9pbnRzW3dpbmRvdy5yZWplY3RJbmRpY2F0ZXNbaV1dPy5tZXRhZGF0YS5sYWJlbCA9PT0gcG9pbnRzW3dpbmRvdy5yZWplY3RJbmRpY2F0ZXNbaV1dPy5jdXJyZW50X3ByZWRpY3Rpb24gPyAnJyA6ICfinZfvuI8nXG4gICAgICAgICAgLy8gaWYod2luZG93LnNlc3Npb25TdG9yYWdlLnRhc2tUeXBlID09PSAnYW5vcm1hbHkgZGV0ZWN0aW9uJyl7XG4gICAgICAgICAgLy8gICBmbGFnID0gcG9pbnRzW3dpbmRvdy5yZWplY3RJbmRpY2F0ZXNbaV1dPy5tZXRhZGF0YS5sYWJlbCA9PT0gcG9pbnRzW3dpbmRvdy5yZWplY3RJbmRpY2F0ZXNbaV1dPy5jdXJyZW50X3ByZWRpY3Rpb24gPyAnJyA6ICfinZfvuI8nXG4gICAgICAgICAgLy8gfVxuICAgICAgICAgIGxldCBmbGFnID0gXCJcIlxuICAgICAgICAgIC8vIGlmKHdpbmRvdy5mbGFnaW5kZWNhdGVzTGlzdD8uaW5kZXhPZih3aW5kb3cucmVqZWN0SW5kaWNhdGVzW2ldKSAhPT0gLTEpe1xuICAgICAgICAgIC8vICAgZmxhZyA9ICfinZfvuI8nXG4gICAgICAgICAgLy8gfVxuICAgICAgICAgIG1ldGFkYXRhLnB1c2goeyBrZXk6IHdpbmRvdy5yZWplY3RJbmRpY2F0ZXNbaV0sIHZhbHVlOiBwb2ludHNbd2luZG93LnJlamVjdEluZGljYXRlc1tpXV0ubWV0YWRhdGEubGFiZWwsIHNyYzogc3JjLCBwcmVkaWN0aW9uOiBwb2ludHNbd2luZG93LnJlamVjdEluZGljYXRlc1tpXV0uY3VycmVudF9wcmVkaWN0aW9uLCBmbGFnOiBmbGFnIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgIH1cbiAgICAvLyB3aW5kb3cuY3VzdG9tTWV0YWRhdGEgPSBtZXRhZGF0YVxuICAgIHRoaXMucmVqZWN0TWV0YWRhdGEgPSBtZXRhZGF0YTtcblxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5hZGRCdG5MaXN0ZW5lcigpXG4gICAgfSwgMTAwKVxuICB9XG5cbiAgYWRkQnRuTGlzdGVuZXIoKSB7XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy4kJCgnI21ldGFkYXRhLWNvbnRhaW5lcicpIGFzIGFueVxuICAgIGxldCBidG5zID0gY29udGFpbmVyPy5xdWVyeVNlbGVjdG9yQWxsKCcuY3VzdG9tLWxpc3QtUm93JylcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJ0bnM/Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgYnRuID0gYnRuc1tpXTtcbiAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWVudGVyJywgKCkgPT4ge1xuICAgICAgICAvLyBjb25zb2xlLmxvZygnZW50ZXInLGJ0bilcbiAgICAgICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQ/Lm5vdGlmeUhvdmVyT3ZlclBvaW50KE51bWJlcihidG4uaWQpKVxuICAgICAgfSlcbiAgICB9XG4gIH1cbiAgcmVtb3ZlQ3VzdG9tTGlzdEl0ZW0oaTogbnVtYmVyKSB7XG4gICAgdGhpcy5jdXN0b21NZXRhZGF0YS5zcGxpY2UoaSwgMSlcbiAgICB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uLnNwbGljZShpLCAxKVxuXG4gIH1cbiAgc2V0TGFiZWxPcHRpb24obGFiZWxPcHRpb246IHN0cmluZykge1xuICAgIHRoaXMubGFiZWxPcHRpb24gPSBsYWJlbE9wdGlvbjtcbiAgICBpZiAodGhpcy5wb2ludE1ldGFkYXRhKSB7XG4gICAgICB0aGlzLmxhYmVsID0gJycgKyB0aGlzLnBvaW50TWV0YWRhdGFbdGhpcy5sYWJlbE9wdGlvbl07XG4gICAgfVxuICB9XG4gIHJlbW92ZWFjY2VwdFNlbEl0ZW0oZTogYW55KSB7XG4gICAgbGV0IGluZGV4ID0gd2luZG93LmFjY2VwdEluZGljYXRlcy5pbmRleE9mKE51bWJlcihlLnRhcmdldC5pZCkpXG4gICAgLy8gd2luZG93LmN1c3RvbVNlbGVjdGlvbi5pbmRleE9mKDc4OTMpXG4gICAgY29uc29sZS5sb2coJ2luZGV4MjInLGluZGV4KVxuICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzLnNwbGljZShpbmRleCwgMSlcbiAgICAgIGlmKHdpbmRvdy5hY2NlcHRJbnB1dExpc3QgJiYgd2luZG93LmFjY2VwdElucHV0TGlzdFtlLnRhcmdldC5pZF0pe1xuICAgICAgICB3aW5kb3cuYWNjZXB0SW5wdXRMaXN0W2UudGFyZ2V0LmlkXS5jaGVja2VkID0gZmFsc2VcbiAgICAgIH1cblxuICAgICAgdGhpcy5yZW1vdmVGcm9tQ3VzdG9tU2VsZWN0aW9uKE51bWJlcihlLnRhcmdldC5pZCkpXG4gICAgfVxuICAgIGNvbnNvbGUubG9nKCdpbmRleDIyJyxpbmRleClcbiAgICAvLyB3aW5kb3cuYWNjZXB0SW5wdXRMaXN0W2UudGFyZ2V0LmlkXS5jaGVja2VkID0gZmFsc2VcbiAgICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dC5yZW1vdmVjdXN0b21Jbk1ldGFDYXJkKClcbiAgfVxuICByZW1vdmVyZWplY3RTZWxJdGVtKGU6IGFueSkge1xuICAgIGxldCBpbmRleCA9IHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMuaW5kZXhPZihOdW1iZXIoZS50YXJnZXQuaWQpKVxuICAgIC8vIHdpbmRvdy5jdXN0b21TZWxlY3Rpb24uaW5kZXhPZig3ODkzKVxuICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICB3aW5kb3cucmVqZWN0SW5kaWNhdGVzLnNwbGljZShpbmRleCwgMSlcbiAgICAgIGlmKHdpbmRvdy5hY2NlcHRJbnB1dExpc3QgJiYgd2luZG93LnJlamVjdElucHV0TGlzdFtlLnRhcmdldC5pZF0pe1xuICAgICAgICB3aW5kb3cucmVqZWN0SW5wdXRMaXN0W2UudGFyZ2V0LmlkXS5jaGVja2VkID0gZmFsc2VcbiAgICAgIH1cbiAgICAgIHRoaXMucmVtb3ZlRnJvbUN1c3RvbVNlbGVjdGlvbihOdW1iZXIoZS50YXJnZXQuaWQpKVxuICAgIH1cbiAgICAvLyB3aW5kb3cucmVqZWN0SW5wdXRMaXN0W2UudGFyZ2V0LmlkXS5jaGVja2VkID0gZmFsc2VcbiAgICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dC5yZW1vdmVjdXN0b21Jbk1ldGFDYXJkKClcbiAgfVxuICByZW1vdmVGcm9tQ3VzdG9tU2VsZWN0aW9uKGluZGljYXRlOm51bWJlcil7XG4gICAgbGV0IGluZGV4ID0gd2luZG93LmN1c3RvbVNlbGVjdGlvbi5pbmRleE9mKGluZGljYXRlKVxuICAgIGlmKGluZGV4ICE9PSAtMSl7XG4gICAgICB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uLnNwbGljZShpbmRleCwxKVxuICAgIH1cbiAgICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dC5yZWZyZXNobm9pc3lCdG4oKVxuICB9XG59XG4iXX0=