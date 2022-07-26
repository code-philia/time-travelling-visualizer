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

import { html } from '@polymer/polymer';

export const template = html`
<style include="vz-projector-styles"></style>
<style>
  :host {
    display: flex;
    flex-direction: column;
    /* Account for the bookmark pane at the bottom */
  }
  .query-content.active{
    height: 200px;
    margin-bottom: 20px;
    border-bottom: 1px solid #ccc;
  }

  .container {
    display: block;
    padding: 0px 20px;
  }

  .buttons {
    display: flex;
    height: 30px;
  }

  .button {
    margin-right: 10px;
    border: none;
    border-radius: 7px;
    font-size: 13px;
    padding: 10px;
    background: #e3e3e3;
    white-space: nowrap;
  }

  .button:last-child {
    margin-right: 0;
  }

  .search-button {
    margin-right: 10px;
    width: 258px;
    height: 40px;
    margin-top: 20px;
    background: #e3e3e3;
    line-height: 30px;
    font-size: 14px;
    border: none;
    text-align: center;
    cursor: pointer;
  }

  .search-button:hover {
    background: #550831;
    color: #fff;
  }

  button {
    cursor: pointer;
  }

  button:hover {
    background: #550831;
    color: #fff;
  }

  .boundingbox-button {
    // display: flex;
    //  margin-right: 10px;
    margin-top: 10px;
    font-size: 13px;
    border: none;
    border-radius: 2px;
    font-size: 13px;
    padding: 10px;
    min-width: 110px;
    flex-shrink: 0;
    background: #e3e3e3;
    cursor: pointer;
  }
  .bounding-selection.actived{
    background: #550831;
    color:#fff;
  }
  .bounding-selection,.train-by-selection{
    
  }


  .nn,
  .metadata-info {
    display: flex;
    flex-direction: column;
  }

  .nn>*,
  .metadata-info>* {
    padding: 0 20px;
  }

  .nn-list,
  .metadata-list {
    overflow-y: auto;
  }

  .nn-list .neighbor,
  .metadata-list .metadata {
    font-size: 12px;
    margin-bottom: 8px;
  }

  .nn-list .label-and-value,
  .metadata-list .label-and-value {
    display: flex;
    justify-content: space-between;
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    max-height: 32px;
    margin-left: 4px;
  }
  .label:hover {
    color: #560731;
    font-weight: 600;
  }
  .row-img{
    display:flex;
    margin-bottom: 8px;
    align-items: center;
    cursor: pointer;
  }

  .nn-list .value,
  .metadata-list .value {
    color: #666;
    float: right;
    font-weight: 300;
    margin-left: 8px;
  }

  .nn-list .bar,
  .metadata-list .bar {
    position: relative;
    border-top: 1px solid rgba(0, 0, 0, 0.15);
    margin: 2px 0;
  }

  .nn-list .bar .fill,
  .metadata-list .bar .fill {
    position: absolute;
    top: -1px;
    border-top: 1px solid white;
  }

  .nn-list .tick,
  .metadata-list .tick {
    position: absolute;
    top: 0px;
    height: 3px;
    border-left: 1px solid rgba(0, 0, 0, 0.15);
  }

  .nn-list .sprite-image,
  .metadata-list .sprite-image {
    width: 100%;
  }

  .nn-list.nn-img-show .sprite-image,
  .metadata-list.nn-img-show .sprite-image {
    display: block;
  }

  .nn-list .neighbor-link:hover,
  .metadata-list .metadata-link:hover {
    cursor: pointer;
  }

  .search-by {
    display: flex;
  }

  .search-container {
    // margin-bottom: 10px;
    // padding-bottom: 10px;
  }

  .search-by vz-projector-input {
    width: 100%;
  }

  .search-by paper-dropdown-menu {
    margin-left: 10px;
    width: 120px;
  }
  .statergy-by paper-dropdown-menu {
    width: 210px;
    margin-right: 10px;
  }

  .search-by button {
    margin-right: 10px;
    width: 60px;
  }

  .distance .options {
    float: right;
  }

  #query-container {}

  #query-header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #ccc;
    position: absolute;
    background: #fff;
    bottom: 0;
    z-index: 99;
    width: 340px;
    height: 60px;
  }

  #metadata-container {
    background: rgb(241 241 241);
    padding: 10px;
    position: absolute;
    bottom: 20px;
    overflow-y: scroll;
    height: 210px;
    max-height: 50vh;
    background: #f5f5f5;
    margin-left: -20px;
  }

  .neighbor-image-controls {
    display: flex;
    padding: 0.8em 0.1em;
  }

  .options a {
    color: #727272;
    font-size: 13px;
    margin-left: 12px;
    text-decoration: none;
  }

  .options a.selected {
    color: #009efe;
  }

  .neighbors {
    margin-bottom: 15px;
  }

  .neighbors-options {
    margin-top: 6px;
  }

  .neighbors-options .option-label,
  .distance .option-label {
    color: #727272;
    margin-right: 2px;
    width: auto;
  }

  .num-neighbors-container {
    display: inline-block;
  }

  .nn-slider {
    --paper-slider-input: {
      width: 64px;
    }

    --paper-input-container-input: {
      font-size: 14px;
    }
  }

  .euclidean {
    margin-right: 10px;
  }

  .matches-list {
    padding: 0px;
  }
  .matches-list-title{
    line-height: 40px;
    font-weight: 600;
  }

  .matches-list .row {
    border-bottom: 1px solid #ddd;
    cursor: pointer;
    display: flex;
    font-size: 12px;
    margin: 5px 0;
    padding: 4px 0;
  }

  .show-background {
    display: flex;
    align-items: center;
  }

  #background-toggle {
    margin-left: 20px;
  }

  .threshold-container {
    display: flex;
  }

  .flex-container {
    display: flex;
    justify-content: space-between;
    align-items:center;
  }

  .results {
    display: flex;
    flex-direction: column;
  }
  .results .list{
    max-height: calc(100vh - 420px);
    overflow: auto;
  }

  .results,
  .nn,
  .nn-list {
    flex: 1 0 100px;
  }

  [hidden] {
    display: none;
  }
</style>

<div class="container">

  <div class="ink-panel-header">
    <div class="ink-tab-group">
      <div data-tab="normal" id="normal-filter-tab" class="ink-tab projection-tab">
        Normal Query
      </div>
      <paper-tooltip for="normal-filter-tab" position="bottom" animation-delay="0" fit-to-visible-bounds>
        Normal Query
      </paper-tooltip>
      <template is="dom-if" if="[[shownormal]]">
      <div data-tab="advanced" id="al-filter-tab" class="ink-tab projection-tab">
        Active Learning
      </div>
      </template>
      <paper-tooltip for="al-filter-tab" position="bottom" animation-delay="0" fit-to-visible-bounds>
        Query By Actived Learning
      </paper-tooltip>

      <template is="dom-if" if="[[showAnomaly]]">
      <div data-tab="anomaly" id="anomaly-filter-tab" class="ink-tab projection-tab">
      Anomaly Detection
      </div>
     </template>

     <paper-tooltip for="al-filter-tab" position="bottom" animation-delay="0" fit-to-visible-bounds>
      Query By Actived Learning
     </paper-tooltip>
    </div>
  </div>


  <div data-panel="normal" class="ink-panel-content query-content">
    <div class="search-container">
      <div class="search-by">
        <vz-projector-input id="search-box" label="Search"></vz-projector-input>
        <paper-dropdown-menu no-animations label="by">
          <paper-listbox attr-for-selected="value" class="dropdown-content" selected="{{selectedMetadataField}}"
            slot="dropdown-content">
            <!--          <template is="dom-repeat" items="[[metadataFields]]">-->
            <template is="dom-repeat" items="[[searchFields]]">
              <paper-item value="[[item]]" label="[[item]]">
                [[item]]
              </paper-item>
            </template>
          </paper-listbox>
        </paper-dropdown-menu>
      </div>
      <div class="confidence-threshold">
        <div class="threshold-container">
          <paper-input value="{{confidenceThresholdFrom}}" label="confidence from:">
          </paper-input>
          <paper-input value="{{confidenceThresholdTo}}" label="confidence to:">
          </paper-input>
        </div>
      </div>
      <button style="width: 320px;" class="search-button search" style="margin-top:0px;">Query By Condition</button>
      <div>
      </div>
    </div>
  </div>

  <div data-panel="advanced" class="ink-panel-content query-content">
    <div class="statergy-by" style="display:flex">
      <paper-dropdown-menu no-animations label="Strategies">
        <paper-listbox attr-for-selected="value" class="dropdown-content" selected="{{selectedStratergy}}"
          slot="dropdown-content">
          <template is="dom-repeat" items="[[statergyList]]">
            <paper-item value="[[item]]" label="[[item]]">
              [[item]]
            </paper-item>
          </template>
        </paper-listbox>
      </paper-dropdown-menu>
      <paper-input value="{{budget}}" label="budget" style="margin-right: 10px;"></paper-input>
      <paper-tooltip position="bottom" animation-delay="0" fit-to-visible-bounds>
      query By active Learning
      </paper-tooltip>
    </div>
    <button style="width: 320px;" class="query-by-stratergy search-button search">Query By Strategy(& Selection)</button>
    <!--<div style="display:flex;">
      <paper-input style="width: 120px; margin-right:10px;" value="{{suggestKNum}}" label="k number"></paper-input>
      <button style="width: 140px;" class="query-suggestion search-button search">Query Similar</button>
      <paper-tooltip position="bottom" animation-delay="0" fit-to-visible-bounds>
      query the similar points of the Selected Points
      </paper-tooltip>
    </div>-->
    <div style="display:flex;">
    <!--<button style="width: 120px;" class="bounding-selection search-button search">Select</button>-->
    <button style="width: 180px; white-space: nowrap;" class="show-selection search-button search">Prev & Cur Selection</button>
    <button style="width: 230px;" class="train-by-selection search-button search">Train By Selections</button>
    </div>
  </div>

  <div data-panel="anomaly" class="ink-panel-content query-content">
    <div class="statergy-by" style="display:flex">

      <paper-dropdown-menu no-animations label="Classes">
      <paper-listbox attr-for-selected="value" class="dropdown-content" selected="{{selectedAnormalyClass}}"
        slot="dropdown-content">
        <template is="dom-repeat" items="[[classOptionsList]]">
          <paper-item value="[[item.value]]" label="[[item.label]]">
            [[item.label]]
          </paper-item>
        </template>
      </paper-listbox>
    </paper-dropdown-menu>
      <paper-input value="{{budget}}" label="budget" style="margin-right: 10px;"></paper-input>
      <button style="width: 100px;" class="query-anomaly search-button search">Query</button>
    </div>
    <paper-tooltip position="bottom" animation-delay="0" fit-to-visible-bounds>
    anomaly detection
    </paper-tooltip>
    <!--<div class="buttons">
    <button class="button reset-filter">Show All</button>
    <button class="button set-filter">Filter query result</button>
    <button class="button clear-selection">Clear Selection</button>
    </div>-->
    <div class="confidence-threshold">
    <!--<div class="threshold-container">
      <paper-input value="{{epochFrom}}" label="iteration from:">
      </paper-input>
      <paper-input value="{{epochTo}}" label="iteration to:">
      </paper-input>
    </div>-->
    <div class="flex-container" style="justify-content:space-around;">
      <p class="total-epoch" style="margin-top:26px;">total: {{totalEpoch}}</p>
      <p class="current-epoch" style="margin-top:26px;">iteration: {{currentPlayedEpoch}}</p>
    </div>
    <div class="flex-container">
    <button style="width: 150px;" class="boundingbox-button show-noisy-btn">play animation</button>
    <button style="width: 150px;" class="boundingbox-button stop-animation-btn">
      stop playing
    </button>
  </div>
  </div>
  </div>

  <!--<div style="display:flex;width: 280px;justify-content: space-around;margin-bottom: 10px;">
  <paper-checkbox id="label-points-toggle" checked="{{showlabeled}}">
  labeled
  </paper-checkbox>
  <paper-checkbox id="unlabel-points-toggle" checked="{{showUnlabeled}}">
  unlabeled
  </paper-checkbox>
  </paper-checkbox>
  <paper-checkbox id="testing-points-toggle" checked="{{showTesting}}">
  testing
  </paper-checkbox>
  </div>-->


  <!--<div id="query-container">
    <div id="query-header-container">
      <div id="query-header">Dynamically Selection</div>
      <paper-icon-button icon="[[collapseIcon]]" on-tap="_toggleMetadataContainer">
      </paper-icon-button>
    </div>
    <iron-collapse id="metadata-container">
      <div>Dynamic Point Setting</div>
      <div class="confidence-threshold">
        <div class="threshold-container">
          <paper-input value="{{epochFrom}}" label="iteration from:">
          </paper-input>
          <paper-input value="{{epochTo}}" label="iteration to:">
          </paper-input>
        </div>
        <div class="flex-container">
          <p class="current-epoch">epoch: {{currentPlayedEpoch}}</p>
          <paper-toggle-button id="show-trace-toggle" checked="{{showTrace}}">
            Show Trace
          </paper-toggle-button>
        </div>
        <div class="flex-container">
          <button style="width: 110px;" class="boundingbox-button show-noisy-btn">play animation</button>
          <button class="boundingbox-button stop-animation-btn">
            stop playing
          </button></div>
      </div>
    </iron-collapse>
  </div>-->
  <!--<div>
    <button class="boundingbox-button add">add</button>
    <button class="boundingbox-button reset">reset</button>
    <button class="boundingbox-button sent">sent</button>
    <button class="boundingbox-button show">show</button>
  </div> -->



  <div class="results">
    <div class="nn" style="display: none">
      <div class="neighbors">
        <div class="neighbors-options">
          <div hidden$="[[!noShow]]" class="slider num-nn">
            <span class="option-label">neighbors</span>
            <paper-icon-button icon="help" class="help-icon"></paper-icon-button>
            <paper-tooltip position="bottom" animation-delay="0" fit-to-visible-bounds>
              The number of neighbors (in the original space) to show when
              clicking on a point.
            </paper-tooltip>
            <paper-slider class="nn-slider" pin min="5" max="999" editable value="{{numNN}}" on-change="updateNumNN">
            </paper-slider>
          </div>
        </div>
        <div hidden$="[[!noShow]]" class="distance">
          <span class="option-label">distance</span>
          <div class="options">
            <a class="selected cosine" href="javascript:void(0);">COSINE</a>
            <a class="euclidean" href="javascript:void(0);">EUCLIDEAN</a>
          </div>
        </div>
        <div class="neighbor-image-controls">
          <template is="dom-if" if="[[spriteImagesAvailable]]">
            <paper-checkbox checked="{{showNeighborImages}}">
              show images
              <paper-icon-button icon="help" class="help-icon"></paper-icon-button>
              <paper-tooltip position="bottom" animation-delay="0" fit-to-visible-bounds>
                Show the original images of the point.
              </paper-tooltip>
            </paper-checkbox>
          </template>
        </div>
      </div>
      <div class="nn-list"></div>
    </div>
    <div class="metadata-info" style="display: none">
      <div class="neighbors-options">
        <div class="slider num-nn">
          <span class="option-label">neighbors</span>
          <paper-icon-button icon="help" class="help-icon"></paper-icon-button>
          <paper-tooltip position="bottom" animation-delay="0" fit-to-visible-bounds>
            The number of neighbors (in the selected space) to show when
            clicking on a point.
          </paper-tooltip>
          <paper-slider class="nn-slider" pin min="5" max="999" editable value="{{numNN}}" on-change="updateNumNN">
          </paper-slider>
        </div>
      </div>
      <p>{{metadataColumn}} labels (click to apply):</p>
      <div class="metadata-list"></div>
    </div>
    <div class="matches-list" style="display: none">
     <div class="matches-list-title">Query Result List:</div>
     <!--<div class="buttons">
     <button class="button reset-filter">Show All</button>
     <button class="button set-filter">Filter query result</button>
     <button class="button clear-selection">Clear Selection</button>
     </div>-->
     <div class="matches-list-title"> 
     <paper-checkbox id="label-points-toggle" checked="{{checkAllQueryRes}}"></paper-checkbox>
     <span>| </span><span>index｜</span><span>label｜</span><span> predict｜</span><span>result｜</span><span>score</span></div>
      <div class="list"></div>
      <div class="limit-msg">Showing only the first 100 results...</div>
    </div>
  </div>
`;
