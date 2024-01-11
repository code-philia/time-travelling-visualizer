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
import {getRejectInputList, getAcceptInputList, updateStateForInstance, getAcceptIndicates, getRejectIndicates, getModelMath, getPreviousIndecates, getIteration, getProperties, getCustomMetaData, getCustomSelection } from './globalState';
import * as logging from './logging';

import { LegacyElementMixin } from '../components/polymer/legacy_element_mixin';
import '../components/polymer/irons_and_papers';

import { PointMetadata } from './data';
import { ProjectorEventContext } from './projectorEventContext';

@customElement('vz-projector-metadata-card')
class MetadataCard extends LegacyElementMixin(PolymerElement) {
  static readonly template = html`
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

  @property({ type: Boolean })
  hasMetadata: boolean = true;

  @property({ type: Boolean })
  showImg: boolean = false;

  @property({ type: Number })
  selectedNum: Number = 0;

  @property({ type: Number})
  interestNum: Number = 0;

  @property({ type: Number})
  notInterestNum: Number = 0

  @property({ type: Boolean })
  isCollapsed: boolean = false;

  @property({ type: String })
  collapseIcon: string = 'expand-less';

  @property({ type: Array })
  metadata: Array<{
    key: string;
    value: string;
  }>;
  @property({ type: Array })
  customMetadata: Array<{
    key: string;
    value: string;
    src?: string;
  }>;

  @property({ type: Array })
  rejectMetadata: Array<{
    key: string;
    value: string;
    src?: string;
  }>;

  @property({ type: Number })
  currentRemove: Number = null

  @property({ type: String })
  label: string;

  @property({ type: Number })
  instanceId: number;

  private labelOption: string;
  private pointMetadata: PointMetadata;
  private resultImg: HTMLElement;
  private points: any
  private projectorEventContext: ProjectorEventContext


  /** Handles toggle of metadata-container. */
  _toggleMetadataContainer() {
    (this.$$('#metadata-container') as any).toggle();
    this.isCollapsed = !this.isCollapsed;
    this.set('collapseIcon', this.isCollapsed ? 'expand-more' : 'expand-less');
  }

  @observe('currentRemove')
  _remove() {
    console.log('111', this.currentRemove)
  }



  updateMetadata(pointMetadata?: PointMetadata, src?: string, point?: any, indicate?: number) {
    this.pointMetadata = pointMetadata;
    this.showImg = pointMetadata != null

    this.hasMetadata = true

    if (!getPreviousIndecates(this.instanceId)) {
      updateStateForInstance(this.instanceId, {previousIndecates:[]})
      // state.previousIndecates = []
    }
    if (pointMetadata) {
      let metadata = [];
      for (let metadataKey in pointMetadata) {
        if (!pointMetadata.hasOwnProperty(metadataKey)) {
          continue;
        }

        let value = pointMetadata[metadataKey]
        if (getProperties(this.instanceId)[getIteration(this.instanceId)] && indicate !== undefined) {
          if (getProperties(this.instanceId)[getIteration(this.instanceId)][indicate] === 1) {
            value = 'unlabeled'
          }
        }
        metadata.push({ index:indicate, key: metadataKey, value: value, prediction: point['current_prediction'], possibelWroung: value !== point['current_prediction'], isSelected: getPreviousIndecates(this.instanceId)?.indexOf(indicate) !== -1 });
      }
      this.metadata = metadata;
      this.label = '' + this.pointMetadata[this.labelOption];
      //img
      setTimeout(() => {
        this.resultImg = this.$$('#metaImg') as HTMLAnchorElement;
        if (src?.length) {
          this.resultImg?.setAttribute("style", "display:block;")
          this.resultImg?.setAttribute('src', src)
        } else {
          this.resultImg?.setAttribute("style", "display:none;")
        }
      }, 100)
    }
  }

  async updateCustomList(points: any, projectorEventContext?: ProjectorEventContext) {
    this.projectorEventContext = projectorEventContext
    if (points) {
      this.points = points
    }


    if (!getAcceptIndicates(this.instanceId) || getAcceptIndicates(this.instanceId).length === 0) {
      this.customMetadata = []
    }
    this.hasMetadata = true;
    this.selectedNum = getAcceptIndicates(this.instanceId)?.length + getRejectIndicates(this.instanceId)?.length
    this.interestNum = getAcceptIndicates(this.instanceId)?.length
    this.notInterestNum = getRejectIndicates(this.instanceId)?.length
    let metadata = [];
    let DVIServer = window.sessionStorage.ipAddress;
    let basePath = getModelMath(this.instanceId)
    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'application/json');
    if (getAcceptIndicates(this.instanceId)) {
      let msgId
      if (getAcceptIndicates(this.instanceId).length > 1000) {
        msgId = logging.setModalMessage('Update ing...');
      }

      await fetch(`http://${DVIServer}/spriteList`, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify({
          "path": basePath, "index": getAcceptIndicates(this.instanceId),
        }),
        headers: headers,
      }).then(response => response.json()).then(data => {
        for (let i = 0; i < getAcceptIndicates(this.instanceId).length; i++) {
          let src = data.urlList[getAcceptIndicates(this.instanceId)[i]]
          // let flag = points[getAcceptIndicates(this.instanceId)[i]]?.metadata.label === points[getAcceptIndicates(this.instanceId)[i]]?.current_prediction ? '' : '❗️'
          let flag = ""
          // if(state.flagindecatesList?.indexOf(getAcceptIndicates(this.instanceId)[i]) !== -1){
          //   flag = '❗️'
          // }
          // if (state.sessionStorage.isControlGroup === 'true') {
          //   flag = ''
          // }
          metadata.push({ key: getAcceptIndicates(this.instanceId)[i], value: points[getAcceptIndicates(this.instanceId)[i]].metadata.label, src: src, prediction: points[getAcceptIndicates(this.instanceId)[i]].current_prediction, flag: flag });
        }
        if (msgId) {
          logging.setModalMessage(null, msgId);
        }
      }).catch(error => {
        console.log("error", error);
        if (msgId) {
          logging.setModalMessage(null, msgId);
        }
        for (let i = 0; i < getAcceptIndicates(this.instanceId).length; i++) {
          let src = ''
          // let flag = points[getAcceptIndicates(this.instanceId)[i]]?.metadata.label === points[getAcceptIndicates(this.instanceId)[i]]?.current_prediction ? '' : '❗️'
          let flag = ""
          // if(state.flagindecatesList?.indexOf(getRejectIndicates(this.instanceId)[i]) !== -1){
          //   flag = '❗️'
          // }
          metadata.push({ key: getAcceptIndicates(this.instanceId)[i], value: points[getAcceptIndicates(this.instanceId)[i]].metadata.label, src: src, prediction: points[getAcceptIndicates(this.instanceId)[i]].current_prediction, flag: flag });
        }
      });

    }
    console.log("currInstance", this.instanceId)
    updateStateForInstance(this.instanceId, {customMetadata:metadata})
    // state.customMetadata = metadata
    this.customMetadata = metadata;

    setTimeout(() => {
      this.addBtnListener()
    }, 3000)
  }

  async updateRejectList(points: any, projectorEventContext?: ProjectorEventContext) {
    this.projectorEventContext = projectorEventContext
    if (points) {
      this.points = points
    }


    if (!getRejectIndicates(this.instanceId) || getRejectIndicates(this.instanceId).length === 0) {
      this.rejectMetadata = []
    }
    this.hasMetadata = true;
    this.selectedNum = getAcceptIndicates(this.instanceId)?.length + getRejectIndicates(this.instanceId)?.length
    this.interestNum = getAcceptIndicates(this.instanceId)?.length
    this.notInterestNum = getRejectIndicates(this.instanceId)?.length
    let metadata = [];
    let DVIServer = window.sessionStorage.ipAddress;
    let basePath = getModelMath(this.instanceId)
    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'application/json');
    if (getRejectIndicates(this.instanceId)) {
      let msgId
      if (getRejectIndicates(this.instanceId).length > 1000) {
        msgId = logging.setModalMessage('Update ing...');
      }

      await fetch(`http://${DVIServer}/spriteList`, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify({
          "path": basePath, "index": getRejectIndicates(this.instanceId),
        }),
        headers: headers,
      }).then(response => response.json()).then(data => {
        for (let i = 0; i < getRejectIndicates(this.instanceId).length; i++) {
          let src = data.urlList[getRejectIndicates(this.instanceId)[i]]
          // let flag = points[getRejectIndicates(this.instanceId)[i]]?.metadata.label === points[getRejectIndicates(this.instanceId)[i]]?.current_prediction ? '' : '❗️'
          let flag = ""
          // if(state.flagindecatesList?.indexOf(getRejectIndicates(this.instanceId)[i]) !== -1){
          //   flag = '❗️'
          // }
          // if (state.sessionStorage.isControlGroup === 'true') {
          //   flag = ''
          // }
          metadata.push({ key: getRejectIndicates(this.instanceId)[i], value: points[getRejectIndicates(this.instanceId)[i]].metadata.label, src: src, prediction: points[getRejectIndicates(this.instanceId)[i]].current_prediction, flag: flag });
        }
        if (msgId) {
          logging.setModalMessage(null, msgId);
        }
      }).catch(error => {
        console.log("error", error);
        if (msgId) {
          logging.setModalMessage(null, msgId);
        }
        for (let i = 0; i < getRejectIndicates(this.instanceId).length; i++) {
          let src = ''

          // let flag = points[getRejectIndicates(this.instanceId)[i]]?.metadata.label === points[getRejectIndicates(this.instanceId)[i]]?.current_prediction ? '' : '❗️'
          // if(state.sessionStorage.taskType === 'anormaly detection'){
          //   flag = points[getRejectIndicates(this.instanceId)[i]]?.metadata.label === points[getRejectIndicates(this.instanceId)[i]]?.current_prediction ? '' : '❗️'
          // }
          let flag = ""
          // if(state.flagindecatesList?.indexOf(getRejectIndicates(this.instanceId)[i]) !== -1){
          //   flag = '❗️'
          // }
          metadata.push({ key: getRejectIndicates(this.instanceId)[i], value: points[getRejectIndicates(this.instanceId)[i]].metadata.label, src: src, prediction: points[getRejectIndicates(this.instanceId)[i]].current_prediction, flag: flag });
        }
      });

    }
    // state.customMetadata = metadata
    this.rejectMetadata = metadata;

    setTimeout(() => {
      this.addBtnListener()
    }, 100)
  }

  addBtnListener() {
    const container = this.$$('#metadata-container') as any
    let btns = container?.querySelectorAll('.custom-list-Row')
    for (let i = 0; i < btns?.length; i++) {
      let btn = btns[i];
      btn.addEventListener('mouseenter', () => {
        this.projectorEventContext?.notifyHoverOverPoint(Number(btn.id))
      })
    }
  }
  removeCustomListItem(i: number) {
    this.customMetadata.splice(i, 1)
    getCustomSelection(this.instanceId).splice(i, 1)

  }
  setLabelOption(labelOption: string) {
    this.labelOption = labelOption;
    if (this.pointMetadata) {
      this.label = '' + this.pointMetadata[this.labelOption];
    }
  }
  removeacceptSelItem(e: any) {

    let index = getAcceptIndicates(this.instanceId).indexOf(Number(e.target.id))
    // state.customSelection.indexOf(7893)
    console.log('index22',index)
    if (index >= 0) {
      getAcceptIndicates(this.instanceId).splice(index, 1)
      if(getAcceptInputList(this.instanceId) && getAcceptInputList(this.instanceId)[e.target.id]){
        getAcceptInputList(this.instanceId)[e.target.id].checked = false
      }

      this.removeFromCustomSelection(Number(e.target.id))
    }
    console.log('index22',index)
    // getAcceptInputList(this.instanceId)[e.target.id].checked = false
    this.projectorEventContext.removecustomInMetaCard()
  }
  removerejectSelItem(e: any) {

    let index = getRejectIndicates(this.instanceId).indexOf(Number(e.target.id))
    // state.customSelection.indexOf(7893)
    if (index >= 0) {
      getRejectIndicates(this.instanceId).splice(index, 1)
      if(getAcceptInputList(this.instanceId) && getRejectInputList(this.instanceId)[e.target.id]){
        getRejectInputList(this.instanceId)[e.target.id].checked = false
      }
      this.removeFromCustomSelection(Number(e.target.id))
    }
    // getRejectInputList(this.instanceId)[e.target.id].checked = false
    this.projectorEventContext.removecustomInMetaCard()
  }
  removeFromCustomSelection(indicate:number){

    let index = getCustomSelection(this.instanceId).indexOf(indicate)
    if(index !== -1){
      getCustomSelection(this.instanceId).splice(index,1)
    }
    this.projectorEventContext.refreshnoisyBtn()
  }
}

