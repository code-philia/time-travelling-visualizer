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

import { LegacyElementMixin } from '../../../components/polymer/legacy_element_mixin';
import '../../../components/polymer/irons_and_papers';

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
        width: 200px;
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
        width: 230px;
        overflow-wrap: break-word;
      }

      #metadata-table {
        display: table;
        padding: 8px 12px 4px;
      }

      .metadata-row {
        display: table-row;
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
        <template is="dom-if" if="[[showImg]]">
        <div id="header">
          <div id="metadata-label">Current Hover Detail</div>
        </div>
        </template>
        <iron-collapse id="metadata-container" opened>
        <template is="dom-if" if="[[showImg]]">
          <div id="metadata-table">
            <template is="dom-repeat" items="[[metadata]]">
              <div class="metadata-row">
                <div>
                <div class="metadata-key">[[item.key]]</div>
                <div class="metadata-value">[[item.value]]</div>
                </div>
                <div>
                <div class="metadata-key">prediction</div>
                <div class="metadata-value">[[item.prediction]]</div>
                </div>
                <template is="dom-if" if="[[item.possibelWroung]]">
                <div id="tips-warn" style="position: absolute;right: 10px;top: 50px;" class="meta-tips">❗️</div>
                <paper-tooltip animation-delay="0" for="tips-warn"
                >disagreement between prediction and pseudo label
                </paper-tooltip>
                </template>
                <template is="dom-if" if="[[item.isSelected]]">
                <div id="tips-warn" style="position: absolute;right: 10px;top: 80px;" class="meta-tips">☑️selected</div>
                <paper-tooltip animation-delay="0" for="tips-warn"
                >disagreement between prediction and pseudo label
                </paper-tooltip>
                </template>
              </div>
            </template>
          </div>
          <div class="img-container" if="[[showImg]]">
          <img id="metaImg" height="100px"/>
          </div>
        </template>
          <div class="custom-list-header">custom selected list | [[selectedNum]]</div>
          <div class="metadata-row">
          <div class="metadata-key">| img |</div>
          <div class="metadata-key">index |</div>
          <div class="metadata-key">label |</div>
          <div class="metadata-key">predict |</div>
          </div>
          <div style="max-height: calc(100vh - 440px);overflow: auto; padding: 0 10px;">
          <template is="dom-repeat" items="[[customMetadata]]">
          <div class="metadata-row custom-list-Row" id=[[item.key]]>
            <img src="[[item.src]]" />
            <div class="metadata-key">[[item.key]]</div>
            <div class="metadata-value">[[item.value]]</div>
            <div class="metadata-value">[[item.prediction]]</div>
            <div class="metadata-value">[[item.flag]]</div>
          </div>
          </div>
        </template>
        </iron-collapse>
      </div>
    </template>
  `;

  @property({ type: Boolean })
  hasMetadata: boolean = false;

  @property({ type: Boolean })
  showImg: boolean = false;

  @property({ type: Number })
  selectedNum: Number = 0;

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

  @property({ type: Number })
  currentRemove: Number = null

  @property({ type: String })
  label: string;

  private labelOption: string;
  private pointMetadata: PointMetadata;
  private resultImg: HTMLElement;


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

    this.hasMetadata = pointMetadata != null || window.customSelection?.length;
    if (!window.previousIndecates) {
      window.previousIndecates = []
    }
    if (pointMetadata) {
      let metadata = [];
      for (let metadataKey in pointMetadata) {
        if (!pointMetadata.hasOwnProperty(metadataKey)) {
          continue;
        }

        metadata.push({ key: metadataKey, value: pointMetadata[metadataKey], prediction: point['current_prediction'], possibelWroung: pointMetadata[metadataKey] !== point['current_prediction'], isSelected: window.previousIndecates?.indexOf(indicate) !== -1 });
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

  async updateCustomList(points) {
    if (!window.customSelection || window.customSelection.length === 0) {
      this.customMetadata = []
    }
    this.hasMetadata = window.customSelection?.length;
    this.selectedNum = window.customSelection?.length
    let metadata = [];
    let DVIServer = '';
    let basePath = ''
    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'application/json');
    await fetch("standalone_projector_config.json", { method: 'GET' })
      .then(response => response.json())
      .then(data => { DVIServer = data.DVIServerIP + ":" + data.DVIServerPort; basePath = data.DVIsubjectModelPath })

    if (window.customSelection) {
      let msgId
      if (window.customSelection.length > 50) {
        msgId = logging.setModalMessage('Update ing...');
      }

      await fetch(`http://${DVIServer}/spriteList`, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify({
          "path": basePath, "index": window.customSelection,
        }),
        headers: headers,
      }).then(response => response.json()).then(data => {
        for (let i = 0; i < window.customSelection.length; i++) {
          let src = data.urlList[window.customSelection[i]]
          let flag = points[window.customSelection[i]]?.metadata.label === points[window.customSelection[i]]?.current_prediction ? '' : '❗️'
          metadata.push({ key: window.customSelection[i], value: points[window.customSelection[i]].metadata.label, src: src, prediction: points[window.customSelection[i]].current_prediction, flag: flag });
        }
        if (msgId) {
          logging.setModalMessage(null, msgId);
        }
      }).catch(error => {
        console.log("error", error);
        if (msgId) {
          logging.setModalMessage(null, msgId);
        }
        for (let i = 0; i < window.customSelection.length; i++) {
          let src = ''
          let flag = points[window.customSelection[i]]?.metadata.label === points[window.customSelection[i]]?.current_prediction ? '' : '❗️'
          metadata.push({ key: window.customSelection[i], value: points[window.customSelection[i]].metadata.label, src: src, prediction: points[window.customSelection[i]].current_prediction, flag: flag });
        }
      });

    }
    window.customMetadata = metadata
    this.customMetadata = metadata;

    setTimeout(() => {
      this.addBtnListener()
    }, 3000)
  }
  addBtnListener() {
    const container = this.$$('#metadata-container') as any
    let btns = container?.querySelectorAll('.custom-list-Row')
    for (let i = 0; i < btns?.length; i++) {
      let btn = btns[i];
      btn.addEventListener('hover', () => {
        console.log(btn)
      })
    }
  }
  removeCustomListItem(i: number) {
    this.customMetadata.splice(i, 1)
    window.customSelection.splice(i, 1)
    console.log('rrrr', this.customMetadata, window.customSelection)

  }
  setLabelOption(labelOption: string) {
    this.labelOption = labelOption;
    if (this.pointMetadata) {
      this.label = '' + this.pointMetadata[this.labelOption];
    }
  }
}
