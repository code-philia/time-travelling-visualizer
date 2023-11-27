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
export const template = html `
<style include="vz-projector-styles"></style>
<style>
  :host {
    display: flex;
    flex-direction: column;
    /* Account for the bookmark pane at the bottom */
  }
  .query-content.active{
    height: 130px;
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
    align-items: center;
    cursor: pointer;
    height: 36px;
    justify-content:space-around;
    border-bottom: 1px solid #bcb8b8;
  }
  .resTable{
    width:100%;
  }
  .row-img:hover {
    color: #560731;
    font-weight: 600;
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
    border-bottom: 1px solid #ccc;
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
    max-height: calc(100vh - 490px);
    overflow: auto;
  }

  .results,
  .nn,
  .nn-list {
    flex: 1 0 100px;
  }
  .queryResColumn{
    width: 60px;
  }
  .inputColumn{
    width: 26px;
    text-align: left;
  }
  .queryResColumnHeader{
    width: 60px;
    display: inline-block;
    text-align: center;
  }

  [hidden] {
    display: none;
  }
</style>

<div class="container">

  <div class="ink-panel-header">
    <div class="ink-tab-group">
      <template is="dom-if" if="[[shownormal]]">
      <div data-tab="advanced" id="al-filter-tab" class="ink-tab projection-tab">
        Sample Selection
      </div>
      </template>
      <paper-tooltip for="al-filter-tab" position="bottom" animation-delay="0" fit-to-visible-bounds>
        Query By Actived Learning
      </paper-tooltip>

      <template is="dom-if" if="[[showAnomaly]]">
      <div data-tab="anomaly" id="anomaly-filter-tab" class="ink-tab projection-tab">
      Interest Potential
      </div>
     </template>

     <paper-tooltip for="al-filter-tab" position="bottom" animation-delay="0" fit-to-visible-bounds>
      Query By Actived Learning
     </paper-tooltip>

     <div data-tab="normal" id="normal-filter-tab" class="ink-tab projection-tab">
      Normal Query
     </div>
    <paper-tooltip for="normal-filter-tab" position="bottom" animation-delay="0" fit-to-visible-bounds>
       Normal Query
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
          <button style="width: 100px; margin-top:14px;margin-left:10px;" class="search-button search">Query</button>
        </div>
      </div>
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
      <paper-input value="{{budget}}" label="recommend num" style="margin-right: 10px;"></paper-input>
      <paper-tooltip position="bottom" animation-delay="0" fit-to-visible-bounds>
      query By active Learning
      </paper-tooltip>
      <button style="width: 100px; margin-top: 14px;" class="query-by-stratergy search-button search">Recommend</button>
    </div>

    <!--<div style="display:flex;">
      <paper-input style="width: 120px; margin-right:10px;" value="{{suggestKNum}}" label="k number"></paper-input>
      <button style="width: 140px;" class="query-suggestion search-button search">Query Similar</button>
      <paper-tooltip position="bottom" animation-delay="0" fit-to-visible-bounds>
      query the similar points of the Selected Points
      </paper-tooltip>
    </div>-->
    <div style="display:flex;">
    <!--<button style="width: 120px;" class="bounding-selection search-button search">Select</button>-->
    <button style="width: 180px; white-space: nowrap;visibility: hidden;width: 0;" class="show-selection search-button search">Prev & Cur Selection</button>
    <button style="width: 220px; visibility:hidden;" class="train-by-selection search-button search" disabled="[[disabledAlExBase]]">re-Train By Selections</button>
    </div>
  </div>

  <div data-panel="anomaly" class="ink-panel-content query-content">
    <div class="statergy-by" style="display:flex;justify-content: space-between;">

      <!--<paper-dropdown-menu no-animations label="Classes" style="width:0;visibility:hidden;">
      <paper-listbox attr-for-selected="value" class="dropdown-content" selected="{{selectedAnormalyClass}}"
        slot="dropdown-content">
        <template is="dom-repeat" items="[[classOptionsList]]">
          <paper-item value="[[item.value]]" label="[[item.label]]">
            [[item.label]]
          </paper-item>
        </template>
      </paper-listbox>
    </paper-dropdown-menu>-->
      <paper-input value="{{anomalyRecNum}}" label="recommend num" style="margin-right: 10px;"></paper-input>
      <button style="width: 100px;" class="query-anomaly search-button search">Recommend</button>
    </div>

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
    <div class="flex-container" style="justify-content:space-between;height: 0px;margin-bottom: 10px;margin-top: 20px;width: 0px; visibility:hidden;">
      <p class="current-epoch" style="margin-top:26px;">iteration: {{currentPlayedEpoch}}</p>
      <button style="width: 0px; visibility:hidden; white-space: nowrap;" class="noisy-show-selection search-button search">Prev Selection</button>
    </div>
    <div class="flex-container" style="position: fixed;bottom: 200px;z-index: 9;left: 50%;margin-left: -50px;">
    <button style="width: 50px;" class="show-noisy-btn">
    <svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><g><rect fill="none" height="24" width="24"/></g><g><path d="M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10s10-4.48,10-10S17.52,2,12,2z M9.5,16.5v-9l7,4.5L9.5,16.5z"/></g></svg>
    </button>
    <button style="width: 50px;" class="stop-animation-btn">
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0z" fill="none"/><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
    </button>
  </div>
  </div>
  </div>

  <!--<div style="display:flex;width: 280px;justify-content: space-around;margin-bottom: 10px;">
  <template is="dom-if" if="[[showAnomaly]]">
  <paper-checkbox id="label-points-toggle" checked="{{showlabeled}}" id="labeledCheckbox">
  training
  </paper-checkbox>
  </template>

  <template is="dom-if" if="[[!showAnomaly]]">
  <paper-checkbox id="label-points-toggle" checked="{{showlabeled}}" id="labeledCheckbox">
  labeled
  </paper-checkbox>
  <paper-checkbox id="unlabel-points-toggle" checked="{{showUnlabeled}}">
  unlabeled
  </paper-checkbox>
  </template>
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
   
    <!--<div class="matches-list-title">[[queryResultListTitle]]</div>-->
     <template is="dom-if" if="[[showMoreRecommend]]">
     <div style="display:flex;">
     <paper-input value="{{moreRecommednNum}}" label="more recommend num:">
     </paper-input>
     <button disabled="[[disabledAlExBase]]" style="margin:10px 0;" class="button query-by-sel-btn">More Recommend</button>
     </div>
     </template>

     <!--<div class="buttons">
     <button class="button reset-filter">Show All</button>
     <button class="button set-filter">Filter query result</button>
     <button class="button clear-selection">Clear Selection</button>
     </div>-->
     <div class="matches-list-title" style="background:#eaeaea; line-height:40px;display: flex;justify-content: space-around;"> 
     <!--<template is="dom-if" if="[[showCheckAllQueryRes]]">
     <paper-checkbox style="margin: 10px -2px 0px 5px;" id="label-points-toggle" checked="{{checkAllQueryRes}}"></paper-checkbox>
     </template>-->
     <template is="dom-if" if="[[showCheckAllQueryRes]]"><span class="queryResColumnHeader" style="width:30px;line-height: 15px;" title="interest">
     <input type="radio" name="accAllOrRejAll" value="accAll" id="accAllRadio">
     <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0z" fill="none"/><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg>
     </span></template>
     <template is="dom-if" if="[[showCheckAllQueryRes]]"><span class="queryResColumnHeader" style="width:30px;line-height: 15px;" title="not interest">
     <input type="radio" name="accAllOrRejAll" value="rejAll" id="rejAllRadio">
     <svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><g><path d="M0,0h24v24H0V0z" fill="none"/></g><g><path d="M2.81,2.81L1.39,4.22l2.27,2.27C2.61,8.07,2,9.96,2,12c0,5.52,4.48,10,10,10c2.04,0,3.93-0.61,5.51-1.66l2.27,2.27 l1.41-1.41L2.81,2.81z M12,20c-4.41,0-8-3.59-8-8c0-1.48,0.41-2.86,1.12-4.06l10.94,10.94C14.86,19.59,13.48,20,12,20z M7.94,5.12 L6.49,3.66C8.07,2.61,9.96,2,12,2c5.52,0,10,4.48,10,10c0,2.04-0.61,3.93-1.66,5.51l-1.46-1.46C19.59,14.86,20,13.48,20,12 c0-4.41-3.59-8-8-8C10.52,4,9.14,4.41,7.94,5.12z"/></g></svg>
     </span></template>
     <span class="queryResColumnHeader">index</span><span class="queryResColumnHeader" id="queryResheader">predict</span>
     <template is="dom-if" if="[[showCheckAllQueryRes]]"><span class="queryResColumnHeader">score</span></template>
     </div>
      <div class="list"></div>
      <div class="limit-msg">Showing only the first 100 results...</div>
    </div>
  </div>
`;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLWluc3BlY3Rvci1wYW5lbC5odG1sLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVuc29yYm9hcmQvcHJvamVjdG9yL3Z6LXByb2plY3Rvci1pbnNwZWN0b3ItcGFuZWwuaHRtbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7OztnRkFhZ0Y7QUFFaEYsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBRXhDLE1BQU0sQ0FBQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBMG9CM0IsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qIENvcHlyaWdodCAyMDE2IFRoZSBUZW5zb3JGbG93IEF1dGhvcnMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuaW1wb3J0IHsgaHRtbCB9IGZyb20gJ0Bwb2x5bWVyL3BvbHltZXInO1xuXG5leHBvcnQgY29uc3QgdGVtcGxhdGUgPSBodG1sYFxuPHN0eWxlIGluY2x1ZGU9XCJ2ei1wcm9qZWN0b3Itc3R5bGVzXCI+PC9zdHlsZT5cbjxzdHlsZT5cbiAgOmhvc3Qge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAvKiBBY2NvdW50IGZvciB0aGUgYm9va21hcmsgcGFuZSBhdCB0aGUgYm90dG9tICovXG4gIH1cbiAgLnF1ZXJ5LWNvbnRlbnQuYWN0aXZle1xuICAgIGhlaWdodDogMTMwcHg7XG4gICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICNjY2M7XG4gIH1cblxuICAuY29udGFpbmVyIHtcbiAgICBkaXNwbGF5OiBibG9jaztcbiAgICBwYWRkaW5nOiAwcHggMjBweDtcbiAgfVxuXG4gIC5idXR0b25zIHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGhlaWdodDogMzBweDtcbiAgfVxuXG4gIC5idXR0b24ge1xuICAgIG1hcmdpbi1yaWdodDogMTBweDtcbiAgICBib3JkZXI6IG5vbmU7XG4gICAgYm9yZGVyLXJhZGl1czogN3B4O1xuICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICBwYWRkaW5nOiAxMHB4O1xuICAgIGJhY2tncm91bmQ6ICNlM2UzZTM7XG4gICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgfVxuXG4gIC5idXR0b246bGFzdC1jaGlsZCB7XG4gICAgbWFyZ2luLXJpZ2h0OiAwO1xuICB9XG5cbiAgLnNlYXJjaC1idXR0b24ge1xuICAgIG1hcmdpbi1yaWdodDogMTBweDtcbiAgICB3aWR0aDogMjU4cHg7XG4gICAgaGVpZ2h0OiA0MHB4O1xuICAgIG1hcmdpbi10b3A6IDIwcHg7XG4gICAgYmFja2dyb3VuZDogI2UzZTNlMztcbiAgICBsaW5lLWhlaWdodDogMzBweDtcbiAgICBmb250LXNpemU6IDE0cHg7XG4gICAgYm9yZGVyOiBub25lO1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICBjdXJzb3I6IHBvaW50ZXI7XG4gIH1cblxuICAuc2VhcmNoLWJ1dHRvbjpob3ZlciB7XG4gICAgYmFja2dyb3VuZDogIzU1MDgzMTtcbiAgICBjb2xvcjogI2ZmZjtcbiAgfVxuXG4gIGJ1dHRvbiB7XG4gICAgY3Vyc29yOiBwb2ludGVyO1xuICB9XG5cbiAgYnV0dG9uOmhvdmVyIHtcbiAgICBiYWNrZ3JvdW5kOiAjNTUwODMxO1xuICAgIGNvbG9yOiAjZmZmO1xuICB9XG5cbiAgLmJvdW5kaW5nYm94LWJ1dHRvbiB7XG4gICAgLy8gZGlzcGxheTogZmxleDtcbiAgICAvLyAgbWFyZ2luLXJpZ2h0OiAxMHB4O1xuICAgIG1hcmdpbi10b3A6IDEwcHg7XG4gICAgZm9udC1zaXplOiAxM3B4O1xuICAgIGJvcmRlcjogbm9uZTtcbiAgICBib3JkZXItcmFkaXVzOiAycHg7XG4gICAgZm9udC1zaXplOiAxM3B4O1xuICAgIHBhZGRpbmc6IDEwcHg7XG4gICAgbWluLXdpZHRoOiAxMTBweDtcbiAgICBmbGV4LXNocmluazogMDtcbiAgICBiYWNrZ3JvdW5kOiAjZTNlM2UzO1xuICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgfVxuICAuYm91bmRpbmctc2VsZWN0aW9uLmFjdGl2ZWR7XG4gICAgYmFja2dyb3VuZDogIzU1MDgzMTtcbiAgICBjb2xvcjojZmZmO1xuICB9XG4gIC5ib3VuZGluZy1zZWxlY3Rpb24sLnRyYWluLWJ5LXNlbGVjdGlvbntcbiAgICBcbiAgfVxuXG5cbiAgLm5uLFxuICAubWV0YWRhdGEtaW5mbyB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICB9XG5cbiAgLm5uPiosXG4gIC5tZXRhZGF0YS1pbmZvPioge1xuICAgIHBhZGRpbmc6IDAgMjBweDtcbiAgfVxuXG4gIC5ubi1saXN0LFxuICAubWV0YWRhdGEtbGlzdCB7XG4gICAgb3ZlcmZsb3cteTogYXV0bztcbiAgfVxuXG4gIC5ubi1saXN0IC5uZWlnaGJvcixcbiAgLm1ldGFkYXRhLWxpc3QgLm1ldGFkYXRhIHtcbiAgICBmb250LXNpemU6IDEycHg7XG4gICAgbWFyZ2luLWJvdHRvbTogOHB4O1xuICB9XG5cbiAgLm5uLWxpc3QgLmxhYmVsLWFuZC12YWx1ZSxcbiAgLm1ldGFkYXRhLWxpc3QgLmxhYmVsLWFuZC12YWx1ZSB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gIH1cblxuICAubGFiZWwge1xuICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gICAgbWF4LWhlaWdodDogMzJweDtcbiAgICBtYXJnaW4tbGVmdDogNHB4O1xuICB9XG4gIC5sYWJlbDpob3ZlciB7XG4gICAgY29sb3I6ICM1NjA3MzE7XG4gICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgfVxuXG4gIC5yb3ctaW1ne1xuICAgIGRpc3BsYXk6ZmxleDtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICBoZWlnaHQ6IDM2cHg7XG4gICAganVzdGlmeS1jb250ZW50OnNwYWNlLWFyb3VuZDtcbiAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgI2JjYjhiODtcbiAgfVxuICAucmVzVGFibGV7XG4gICAgd2lkdGg6MTAwJTtcbiAgfVxuICAucm93LWltZzpob3ZlciB7XG4gICAgY29sb3I6ICM1NjA3MzE7XG4gICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgfVxuXG4gIC5ubi1saXN0IC52YWx1ZSxcbiAgLm1ldGFkYXRhLWxpc3QgLnZhbHVlIHtcbiAgICBjb2xvcjogIzY2NjtcbiAgICBmbG9hdDogcmlnaHQ7XG4gICAgZm9udC13ZWlnaHQ6IDMwMDtcbiAgICBtYXJnaW4tbGVmdDogOHB4O1xuICB9XG5cbiAgLm5uLWxpc3QgLmJhcixcbiAgLm1ldGFkYXRhLWxpc3QgLmJhciB7XG4gICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCByZ2JhKDAsIDAsIDAsIDAuMTUpO1xuICAgIG1hcmdpbjogMnB4IDA7XG4gIH1cblxuICAubm4tbGlzdCAuYmFyIC5maWxsLFxuICAubWV0YWRhdGEtbGlzdCAuYmFyIC5maWxsIHtcbiAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgdG9wOiAtMXB4O1xuICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCB3aGl0ZTtcbiAgfVxuXG4gIC5ubi1saXN0IC50aWNrLFxuICAubWV0YWRhdGEtbGlzdCAudGljayB7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIHRvcDogMHB4O1xuICAgIGhlaWdodDogM3B4O1xuICAgIGJvcmRlci1sZWZ0OiAxcHggc29saWQgcmdiYSgwLCAwLCAwLCAwLjE1KTtcbiAgfVxuXG4gIC5ubi1saXN0IC5zcHJpdGUtaW1hZ2UsXG4gIC5tZXRhZGF0YS1saXN0IC5zcHJpdGUtaW1hZ2Uge1xuICAgIHdpZHRoOiAxMDAlO1xuICB9XG5cbiAgLm5uLWxpc3Qubm4taW1nLXNob3cgLnNwcml0ZS1pbWFnZSxcbiAgLm1ldGFkYXRhLWxpc3Qubm4taW1nLXNob3cgLnNwcml0ZS1pbWFnZSB7XG4gICAgZGlzcGxheTogYmxvY2s7XG4gIH1cblxuICAubm4tbGlzdCAubmVpZ2hib3ItbGluazpob3ZlcixcbiAgLm1ldGFkYXRhLWxpc3QgLm1ldGFkYXRhLWxpbms6aG92ZXIge1xuICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgfVxuXG4gIC5zZWFyY2gtYnkge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gIH1cblxuICAuc2VhcmNoLWNvbnRhaW5lciB7XG4gICAgLy8gbWFyZ2luLWJvdHRvbTogMTBweDtcbiAgICAvLyBwYWRkaW5nLWJvdHRvbTogMTBweDtcbiAgfVxuXG4gIC5zZWFyY2gtYnkgdnotcHJvamVjdG9yLWlucHV0IHtcbiAgICB3aWR0aDogMTAwJTtcbiAgfVxuXG4gIC5zZWFyY2gtYnkgcGFwZXItZHJvcGRvd24tbWVudSB7XG4gICAgbWFyZ2luLWxlZnQ6IDEwcHg7XG4gICAgd2lkdGg6IDEyMHB4O1xuICB9XG4gIC5zdGF0ZXJneS1ieSBwYXBlci1kcm9wZG93bi1tZW51IHtcbiAgICB3aWR0aDogMjEwcHg7XG4gICAgbWFyZ2luLXJpZ2h0OiAxMHB4O1xuICB9XG5cbiAgLnNlYXJjaC1ieSBidXR0b24ge1xuICAgIG1hcmdpbi1yaWdodDogMTBweDtcbiAgICB3aWR0aDogNjBweDtcbiAgfVxuXG4gIC5kaXN0YW5jZSAub3B0aW9ucyB7XG4gICAgZmxvYXQ6IHJpZ2h0O1xuICB9XG5cbiAgI3F1ZXJ5LWNvbnRhaW5lciB7fVxuXG4gICNxdWVyeS1oZWFkZXItY29udGFpbmVyIHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCAjY2NjO1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICBiYWNrZ3JvdW5kOiAjZmZmO1xuICAgIGJvdHRvbTogMDtcbiAgICB6LWluZGV4OiA5OTtcbiAgICB3aWR0aDogMzQwcHg7XG4gICAgaGVpZ2h0OiA2MHB4O1xuICB9XG5cbiAgI21ldGFkYXRhLWNvbnRhaW5lciB7XG4gICAgYmFja2dyb3VuZDogcmdiKDI0MSAyNDEgMjQxKTtcbiAgICBwYWRkaW5nOiAxMHB4O1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICBib3R0b206IDIwcHg7XG4gICAgb3ZlcmZsb3cteTogc2Nyb2xsO1xuICAgIGhlaWdodDogMjEwcHg7XG4gICAgbWF4LWhlaWdodDogNTB2aDtcbiAgICBiYWNrZ3JvdW5kOiAjZjVmNWY1O1xuICAgIG1hcmdpbi1sZWZ0OiAtMjBweDtcbiAgfVxuXG4gIC5uZWlnaGJvci1pbWFnZS1jb250cm9scyB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBwYWRkaW5nOiAwLjhlbSAwLjFlbTtcbiAgfVxuXG4gIC5vcHRpb25zIGEge1xuICAgIGNvbG9yOiAjNzI3MjcyO1xuICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICBtYXJnaW4tbGVmdDogMTJweDtcbiAgICB0ZXh0LWRlY29yYXRpb246IG5vbmU7XG4gIH1cblxuICAub3B0aW9ucyBhLnNlbGVjdGVkIHtcbiAgICBjb2xvcjogIzAwOWVmZTtcbiAgfVxuXG4gIC5uZWlnaGJvcnMge1xuICAgIG1hcmdpbi1ib3R0b206IDE1cHg7XG4gIH1cblxuICAubmVpZ2hib3JzLW9wdGlvbnMge1xuICAgIG1hcmdpbi10b3A6IDZweDtcbiAgfVxuXG4gIC5uZWlnaGJvcnMtb3B0aW9ucyAub3B0aW9uLWxhYmVsLFxuICAuZGlzdGFuY2UgLm9wdGlvbi1sYWJlbCB7XG4gICAgY29sb3I6ICM3MjcyNzI7XG4gICAgbWFyZ2luLXJpZ2h0OiAycHg7XG4gICAgd2lkdGg6IGF1dG87XG4gIH1cblxuICAubnVtLW5laWdoYm9ycy1jb250YWluZXIge1xuICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgfVxuXG4gIC5ubi1zbGlkZXIge1xuICAgIC0tcGFwZXItc2xpZGVyLWlucHV0OiB7XG4gICAgICB3aWR0aDogNjRweDtcbiAgICB9XG5cbiAgICAtLXBhcGVyLWlucHV0LWNvbnRhaW5lci1pbnB1dDoge1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgIH1cbiAgfVxuXG4gIC5ldWNsaWRlYW4ge1xuICAgIG1hcmdpbi1yaWdodDogMTBweDtcbiAgfVxuXG4gIC5tYXRjaGVzLWxpc3Qge1xuICAgIHBhZGRpbmc6IDBweDtcbiAgfVxuICAubWF0Y2hlcy1saXN0LXRpdGxle1xuICAgIGxpbmUtaGVpZ2h0OiA0MHB4O1xuICAgIGZvbnQtd2VpZ2h0OiA2MDA7XG4gICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICNjY2M7XG4gIH1cblxuICAubWF0Y2hlcy1saXN0IC5yb3cge1xuICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCAjZGRkO1xuICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICBtYXJnaW46IDVweCAwO1xuICAgIHBhZGRpbmc6IDRweCAwO1xuICB9XG5cbiAgLnNob3ctYmFja2dyb3VuZCB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICB9XG5cbiAgI2JhY2tncm91bmQtdG9nZ2xlIHtcbiAgICBtYXJnaW4tbGVmdDogMjBweDtcbiAgfVxuXG4gIC50aHJlc2hvbGQtY29udGFpbmVyIHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICB9XG5cbiAgLmZsZXgtY29udGFpbmVyIHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICBhbGlnbi1pdGVtczpjZW50ZXI7XG4gIH1cblxuICAucmVzdWx0cyB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICB9XG4gIC5yZXN1bHRzIC5saXN0e1xuICAgIG1heC1oZWlnaHQ6IGNhbGMoMTAwdmggLSA0OTBweCk7XG4gICAgb3ZlcmZsb3c6IGF1dG87XG4gIH1cblxuICAucmVzdWx0cyxcbiAgLm5uLFxuICAubm4tbGlzdCB7XG4gICAgZmxleDogMSAwIDEwMHB4O1xuICB9XG4gIC5xdWVyeVJlc0NvbHVtbntcbiAgICB3aWR0aDogNjBweDtcbiAgfVxuICAuaW5wdXRDb2x1bW57XG4gICAgd2lkdGg6IDI2cHg7XG4gICAgdGV4dC1hbGlnbjogbGVmdDtcbiAgfVxuICAucXVlcnlSZXNDb2x1bW5IZWFkZXJ7XG4gICAgd2lkdGg6IDYwcHg7XG4gICAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgfVxuXG4gIFtoaWRkZW5dIHtcbiAgICBkaXNwbGF5OiBub25lO1xuICB9XG48L3N0eWxlPlxuXG48ZGl2IGNsYXNzPVwiY29udGFpbmVyXCI+XG5cbiAgPGRpdiBjbGFzcz1cImluay1wYW5lbC1oZWFkZXJcIj5cbiAgICA8ZGl2IGNsYXNzPVwiaW5rLXRhYi1ncm91cFwiPlxuICAgICAgPHRlbXBsYXRlIGlzPVwiZG9tLWlmXCIgaWY9XCJbW3Nob3dub3JtYWxdXVwiPlxuICAgICAgPGRpdiBkYXRhLXRhYj1cImFkdmFuY2VkXCIgaWQ9XCJhbC1maWx0ZXItdGFiXCIgY2xhc3M9XCJpbmstdGFiIHByb2plY3Rpb24tdGFiXCI+XG4gICAgICAgIFNhbXBsZSBTZWxlY3Rpb25cbiAgICAgIDwvZGl2PlxuICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgIDxwYXBlci10b29sdGlwIGZvcj1cImFsLWZpbHRlci10YWJcIiBwb3NpdGlvbj1cImJvdHRvbVwiIGFuaW1hdGlvbi1kZWxheT1cIjBcIiBmaXQtdG8tdmlzaWJsZS1ib3VuZHM+XG4gICAgICAgIFF1ZXJ5IEJ5IEFjdGl2ZWQgTGVhcm5pbmdcbiAgICAgIDwvcGFwZXItdG9vbHRpcD5cblxuICAgICAgPHRlbXBsYXRlIGlzPVwiZG9tLWlmXCIgaWY9XCJbW3Nob3dBbm9tYWx5XV1cIj5cbiAgICAgIDxkaXYgZGF0YS10YWI9XCJhbm9tYWx5XCIgaWQ9XCJhbm9tYWx5LWZpbHRlci10YWJcIiBjbGFzcz1cImluay10YWIgcHJvamVjdGlvbi10YWJcIj5cbiAgICAgIEludGVyZXN0IFBvdGVudGlhbFxuICAgICAgPC9kaXY+XG4gICAgIDwvdGVtcGxhdGU+XG5cbiAgICAgPHBhcGVyLXRvb2x0aXAgZm9yPVwiYWwtZmlsdGVyLXRhYlwiIHBvc2l0aW9uPVwiYm90dG9tXCIgYW5pbWF0aW9uLWRlbGF5PVwiMFwiIGZpdC10by12aXNpYmxlLWJvdW5kcz5cbiAgICAgIFF1ZXJ5IEJ5IEFjdGl2ZWQgTGVhcm5pbmdcbiAgICAgPC9wYXBlci10b29sdGlwPlxuXG4gICAgIDxkaXYgZGF0YS10YWI9XCJub3JtYWxcIiBpZD1cIm5vcm1hbC1maWx0ZXItdGFiXCIgY2xhc3M9XCJpbmstdGFiIHByb2plY3Rpb24tdGFiXCI+XG4gICAgICBOb3JtYWwgUXVlcnlcbiAgICAgPC9kaXY+XG4gICAgPHBhcGVyLXRvb2x0aXAgZm9yPVwibm9ybWFsLWZpbHRlci10YWJcIiBwb3NpdGlvbj1cImJvdHRvbVwiIGFuaW1hdGlvbi1kZWxheT1cIjBcIiBmaXQtdG8tdmlzaWJsZS1ib3VuZHM+XG4gICAgICAgTm9ybWFsIFF1ZXJ5XG4gICAgPC9wYXBlci10b29sdGlwPlxuICAgIDwvZGl2PlxuICA8L2Rpdj5cblxuXG4gIDxkaXYgZGF0YS1wYW5lbD1cIm5vcm1hbFwiIGNsYXNzPVwiaW5rLXBhbmVsLWNvbnRlbnQgcXVlcnktY29udGVudFwiPlxuICAgIDxkaXYgY2xhc3M9XCJzZWFyY2gtY29udGFpbmVyXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwic2VhcmNoLWJ5XCI+XG4gICAgICAgIDx2ei1wcm9qZWN0b3ItaW5wdXQgaWQ9XCJzZWFyY2gtYm94XCIgbGFiZWw9XCJTZWFyY2hcIj48L3Z6LXByb2plY3Rvci1pbnB1dD5cbiAgICAgICAgPHBhcGVyLWRyb3Bkb3duLW1lbnUgbm8tYW5pbWF0aW9ucyBsYWJlbD1cImJ5XCI+XG4gICAgICAgICAgPHBhcGVyLWxpc3Rib3ggYXR0ci1mb3Itc2VsZWN0ZWQ9XCJ2YWx1ZVwiIGNsYXNzPVwiZHJvcGRvd24tY29udGVudFwiIHNlbGVjdGVkPVwie3tzZWxlY3RlZE1ldGFkYXRhRmllbGR9fVwiXG4gICAgICAgICAgICBzbG90PVwiZHJvcGRvd24tY29udGVudFwiPlxuICAgICAgICAgICAgPCEtLSAgICAgICAgICA8dGVtcGxhdGUgaXM9XCJkb20tcmVwZWF0XCIgaXRlbXM9XCJbW21ldGFkYXRhRmllbGRzXV1cIj4tLT5cbiAgICAgICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1yZXBlYXRcIiBpdGVtcz1cIltbc2VhcmNoRmllbGRzXV1cIj5cbiAgICAgICAgICAgICAgPHBhcGVyLWl0ZW0gdmFsdWU9XCJbW2l0ZW1dXVwiIGxhYmVsPVwiW1tpdGVtXV1cIj5cbiAgICAgICAgICAgICAgICBbW2l0ZW1dXVxuICAgICAgICAgICAgICA8L3BhcGVyLWl0ZW0+XG4gICAgICAgICAgICA8L3RlbXBsYXRlPlxuICAgICAgICAgIDwvcGFwZXItbGlzdGJveD5cbiAgICAgICAgPC9wYXBlci1kcm9wZG93bi1tZW51PlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiY29uZmlkZW5jZS10aHJlc2hvbGRcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRocmVzaG9sZC1jb250YWluZXJcIj5cbiAgICAgICAgICA8cGFwZXItaW5wdXQgdmFsdWU9XCJ7e2NvbmZpZGVuY2VUaHJlc2hvbGRGcm9tfX1cIiBsYWJlbD1cImNvbmZpZGVuY2UgZnJvbTpcIj5cbiAgICAgICAgICA8L3BhcGVyLWlucHV0PlxuICAgICAgICAgIDxwYXBlci1pbnB1dCB2YWx1ZT1cInt7Y29uZmlkZW5jZVRocmVzaG9sZFRvfX1cIiBsYWJlbD1cImNvbmZpZGVuY2UgdG86XCI+XG4gICAgICAgICAgPC9wYXBlci1pbnB1dD5cbiAgICAgICAgICA8YnV0dG9uIHN0eWxlPVwid2lkdGg6IDEwMHB4OyBtYXJnaW4tdG9wOjE0cHg7bWFyZ2luLWxlZnQ6MTBweDtcIiBjbGFzcz1cInNlYXJjaC1idXR0b24gc2VhcmNoXCI+UXVlcnk8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+XG5cbiAgPGRpdiBkYXRhLXBhbmVsPVwiYWR2YW5jZWRcIiBjbGFzcz1cImluay1wYW5lbC1jb250ZW50IHF1ZXJ5LWNvbnRlbnRcIj5cbiAgICA8ZGl2IGNsYXNzPVwic3RhdGVyZ3ktYnlcIiBzdHlsZT1cImRpc3BsYXk6ZmxleFwiPlxuICAgICAgPHBhcGVyLWRyb3Bkb3duLW1lbnUgbm8tYW5pbWF0aW9ucyBsYWJlbD1cIlN0cmF0ZWdpZXNcIj5cbiAgICAgICAgPHBhcGVyLWxpc3Rib3ggYXR0ci1mb3Itc2VsZWN0ZWQ9XCJ2YWx1ZVwiIGNsYXNzPVwiZHJvcGRvd24tY29udGVudFwiIHNlbGVjdGVkPVwie3tzZWxlY3RlZFN0cmF0ZXJneX19XCJcbiAgICAgICAgICBzbG90PVwiZHJvcGRvd24tY29udGVudFwiPlxuICAgICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1yZXBlYXRcIiBpdGVtcz1cIltbc3RhdGVyZ3lMaXN0XV1cIj5cbiAgICAgICAgICAgIDxwYXBlci1pdGVtIHZhbHVlPVwiW1tpdGVtXV1cIiBsYWJlbD1cIltbaXRlbV1dXCI+XG4gICAgICAgICAgICAgIFtbaXRlbV1dXG4gICAgICAgICAgICA8L3BhcGVyLWl0ZW0+XG4gICAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgICAgPC9wYXBlci1saXN0Ym94PlxuICAgICAgPC9wYXBlci1kcm9wZG93bi1tZW51PlxuICAgICAgPHBhcGVyLWlucHV0IHZhbHVlPVwie3tidWRnZXR9fVwiIGxhYmVsPVwicmVjb21tZW5kIG51bVwiIHN0eWxlPVwibWFyZ2luLXJpZ2h0OiAxMHB4O1wiPjwvcGFwZXItaW5wdXQ+XG4gICAgICA8cGFwZXItdG9vbHRpcCBwb3NpdGlvbj1cImJvdHRvbVwiIGFuaW1hdGlvbi1kZWxheT1cIjBcIiBmaXQtdG8tdmlzaWJsZS1ib3VuZHM+XG4gICAgICBxdWVyeSBCeSBhY3RpdmUgTGVhcm5pbmdcbiAgICAgIDwvcGFwZXItdG9vbHRpcD5cbiAgICAgIDxidXR0b24gc3R5bGU9XCJ3aWR0aDogMTAwcHg7IG1hcmdpbi10b3A6IDE0cHg7XCIgY2xhc3M9XCJxdWVyeS1ieS1zdHJhdGVyZ3kgc2VhcmNoLWJ1dHRvbiBzZWFyY2hcIj5SZWNvbW1lbmQ8L2J1dHRvbj5cbiAgICA8L2Rpdj5cblxuICAgIDwhLS08ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O1wiPlxuICAgICAgPHBhcGVyLWlucHV0IHN0eWxlPVwid2lkdGg6IDEyMHB4OyBtYXJnaW4tcmlnaHQ6MTBweDtcIiB2YWx1ZT1cInt7c3VnZ2VzdEtOdW19fVwiIGxhYmVsPVwiayBudW1iZXJcIj48L3BhcGVyLWlucHV0PlxuICAgICAgPGJ1dHRvbiBzdHlsZT1cIndpZHRoOiAxNDBweDtcIiBjbGFzcz1cInF1ZXJ5LXN1Z2dlc3Rpb24gc2VhcmNoLWJ1dHRvbiBzZWFyY2hcIj5RdWVyeSBTaW1pbGFyPC9idXR0b24+XG4gICAgICA8cGFwZXItdG9vbHRpcCBwb3NpdGlvbj1cImJvdHRvbVwiIGFuaW1hdGlvbi1kZWxheT1cIjBcIiBmaXQtdG8tdmlzaWJsZS1ib3VuZHM+XG4gICAgICBxdWVyeSB0aGUgc2ltaWxhciBwb2ludHMgb2YgdGhlIFNlbGVjdGVkIFBvaW50c1xuICAgICAgPC9wYXBlci10b29sdGlwPlxuICAgIDwvZGl2Pi0tPlxuICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7XCI+XG4gICAgPCEtLTxidXR0b24gc3R5bGU9XCJ3aWR0aDogMTIwcHg7XCIgY2xhc3M9XCJib3VuZGluZy1zZWxlY3Rpb24gc2VhcmNoLWJ1dHRvbiBzZWFyY2hcIj5TZWxlY3Q8L2J1dHRvbj4tLT5cbiAgICA8YnV0dG9uIHN0eWxlPVwid2lkdGg6IDE4MHB4OyB3aGl0ZS1zcGFjZTogbm93cmFwO3Zpc2liaWxpdHk6IGhpZGRlbjt3aWR0aDogMDtcIiBjbGFzcz1cInNob3ctc2VsZWN0aW9uIHNlYXJjaC1idXR0b24gc2VhcmNoXCI+UHJldiAmIEN1ciBTZWxlY3Rpb248L2J1dHRvbj5cbiAgICA8YnV0dG9uIHN0eWxlPVwid2lkdGg6IDIyMHB4OyB2aXNpYmlsaXR5OmhpZGRlbjtcIiBjbGFzcz1cInRyYWluLWJ5LXNlbGVjdGlvbiBzZWFyY2gtYnV0dG9uIHNlYXJjaFwiIGRpc2FibGVkPVwiW1tkaXNhYmxlZEFsRXhCYXNlXV1cIj5yZS1UcmFpbiBCeSBTZWxlY3Rpb25zPC9idXR0b24+XG4gICAgPC9kaXY+XG4gIDwvZGl2PlxuXG4gIDxkaXYgZGF0YS1wYW5lbD1cImFub21hbHlcIiBjbGFzcz1cImluay1wYW5lbC1jb250ZW50IHF1ZXJ5LWNvbnRlbnRcIj5cbiAgICA8ZGl2IGNsYXNzPVwic3RhdGVyZ3ktYnlcIiBzdHlsZT1cImRpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XCI+XG5cbiAgICAgIDwhLS08cGFwZXItZHJvcGRvd24tbWVudSBuby1hbmltYXRpb25zIGxhYmVsPVwiQ2xhc3Nlc1wiIHN0eWxlPVwid2lkdGg6MDt2aXNpYmlsaXR5OmhpZGRlbjtcIj5cbiAgICAgIDxwYXBlci1saXN0Ym94IGF0dHItZm9yLXNlbGVjdGVkPVwidmFsdWVcIiBjbGFzcz1cImRyb3Bkb3duLWNvbnRlbnRcIiBzZWxlY3RlZD1cInt7c2VsZWN0ZWRBbm9ybWFseUNsYXNzfX1cIlxuICAgICAgICBzbG90PVwiZHJvcGRvd24tY29udGVudFwiPlxuICAgICAgICA8dGVtcGxhdGUgaXM9XCJkb20tcmVwZWF0XCIgaXRlbXM9XCJbW2NsYXNzT3B0aW9uc0xpc3RdXVwiPlxuICAgICAgICAgIDxwYXBlci1pdGVtIHZhbHVlPVwiW1tpdGVtLnZhbHVlXV1cIiBsYWJlbD1cIltbaXRlbS5sYWJlbF1dXCI+XG4gICAgICAgICAgICBbW2l0ZW0ubGFiZWxdXVxuICAgICAgICAgIDwvcGFwZXItaXRlbT5cbiAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgIDwvcGFwZXItbGlzdGJveD5cbiAgICA8L3BhcGVyLWRyb3Bkb3duLW1lbnU+LS0+XG4gICAgICA8cGFwZXItaW5wdXQgdmFsdWU9XCJ7e2Fub21hbHlSZWNOdW19fVwiIGxhYmVsPVwicmVjb21tZW5kIG51bVwiIHN0eWxlPVwibWFyZ2luLXJpZ2h0OiAxMHB4O1wiPjwvcGFwZXItaW5wdXQ+XG4gICAgICA8YnV0dG9uIHN0eWxlPVwid2lkdGg6IDEwMHB4O1wiIGNsYXNzPVwicXVlcnktYW5vbWFseSBzZWFyY2gtYnV0dG9uIHNlYXJjaFwiPlJlY29tbWVuZDwvYnV0dG9uPlxuICAgIDwvZGl2PlxuXG4gICAgPCEtLTxkaXYgY2xhc3M9XCJidXR0b25zXCI+XG4gICAgPGJ1dHRvbiBjbGFzcz1cImJ1dHRvbiByZXNldC1maWx0ZXJcIj5TaG93IEFsbDwvYnV0dG9uPlxuICAgIDxidXR0b24gY2xhc3M9XCJidXR0b24gc2V0LWZpbHRlclwiPkZpbHRlciBxdWVyeSByZXN1bHQ8L2J1dHRvbj5cbiAgICA8YnV0dG9uIGNsYXNzPVwiYnV0dG9uIGNsZWFyLXNlbGVjdGlvblwiPkNsZWFyIFNlbGVjdGlvbjwvYnV0dG9uPlxuICAgIDwvZGl2Pi0tPlxuICAgIDxkaXYgY2xhc3M9XCJjb25maWRlbmNlLXRocmVzaG9sZFwiPlxuICAgIDwhLS08ZGl2IGNsYXNzPVwidGhyZXNob2xkLWNvbnRhaW5lclwiPlxuICAgICAgPHBhcGVyLWlucHV0IHZhbHVlPVwie3tlcG9jaEZyb219fVwiIGxhYmVsPVwiaXRlcmF0aW9uIGZyb206XCI+XG4gICAgICA8L3BhcGVyLWlucHV0PlxuICAgICAgPHBhcGVyLWlucHV0IHZhbHVlPVwie3tlcG9jaFRvfX1cIiBsYWJlbD1cIml0ZXJhdGlvbiB0bzpcIj5cbiAgICAgIDwvcGFwZXItaW5wdXQ+XG4gICAgPC9kaXY+LS0+XG4gICAgPGRpdiBjbGFzcz1cImZsZXgtY29udGFpbmVyXCIgc3R5bGU9XCJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtoZWlnaHQ6IDBweDttYXJnaW4tYm90dG9tOiAxMHB4O21hcmdpbi10b3A6IDIwcHg7d2lkdGg6IDBweDsgdmlzaWJpbGl0eTpoaWRkZW47XCI+XG4gICAgICA8cCBjbGFzcz1cImN1cnJlbnQtZXBvY2hcIiBzdHlsZT1cIm1hcmdpbi10b3A6MjZweDtcIj5pdGVyYXRpb246IHt7Y3VycmVudFBsYXllZEVwb2NofX08L3A+XG4gICAgICA8YnV0dG9uIHN0eWxlPVwid2lkdGg6IDBweDsgdmlzaWJpbGl0eTpoaWRkZW47IHdoaXRlLXNwYWNlOiBub3dyYXA7XCIgY2xhc3M9XCJub2lzeS1zaG93LXNlbGVjdGlvbiBzZWFyY2gtYnV0dG9uIHNlYXJjaFwiPlByZXYgU2VsZWN0aW9uPC9idXR0b24+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImZsZXgtY29udGFpbmVyXCIgc3R5bGU9XCJwb3NpdGlvbjogZml4ZWQ7Ym90dG9tOiAyMDBweDt6LWluZGV4OiA5O2xlZnQ6IDUwJTttYXJnaW4tbGVmdDogLTUwcHg7XCI+XG4gICAgPGJ1dHRvbiBzdHlsZT1cIndpZHRoOiA1MHB4O1wiIGNsYXNzPVwic2hvdy1ub2lzeS1idG5cIj5cbiAgICA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBlbmFibGUtYmFja2dyb3VuZD1cIm5ldyAwIDAgMjQgMjRcIiBoZWlnaHQ9XCIyNHB4XCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIHdpZHRoPVwiMjRweFwiIGZpbGw9XCIjMDAwMDAwXCI+PGc+PHJlY3QgZmlsbD1cIm5vbmVcIiBoZWlnaHQ9XCIyNFwiIHdpZHRoPVwiMjRcIi8+PC9nPjxnPjxwYXRoIGQ9XCJNMTIsMkM2LjQ4LDIsMiw2LjQ4LDIsMTJzNC40OCwxMCwxMCwxMHMxMC00LjQ4LDEwLTEwUzE3LjUyLDIsMTIsMnogTTkuNSwxNi41di05bDcsNC41TDkuNSwxNi41elwiLz48L2c+PC9zdmc+XG4gICAgPC9idXR0b24+XG4gICAgPGJ1dHRvbiBzdHlsZT1cIndpZHRoOiA1MHB4O1wiIGNsYXNzPVwic3RvcC1hbmltYXRpb24tYnRuXCI+XG4gICAgICA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBoZWlnaHQ9XCIyNHB4XCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIHdpZHRoPVwiMjRweFwiIGZpbGw9XCIjMDAwMDAwXCI+PHBhdGggZD1cIk0wIDBoMjR2MjRIMHpcIiBmaWxsPVwibm9uZVwiLz48cGF0aCBkPVwiTTYgMTloNFY1SDZ2MTR6bTgtMTR2MTRoNFY1aC00elwiLz48L3N2Zz5cbiAgICA8L2J1dHRvbj5cbiAgPC9kaXY+XG4gIDwvZGl2PlxuICA8L2Rpdj5cblxuICA8IS0tPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDt3aWR0aDogMjgwcHg7anVzdGlmeS1jb250ZW50OiBzcGFjZS1hcm91bmQ7bWFyZ2luLWJvdHRvbTogMTBweDtcIj5cbiAgPHRlbXBsYXRlIGlzPVwiZG9tLWlmXCIgaWY9XCJbW3Nob3dBbm9tYWx5XV1cIj5cbiAgPHBhcGVyLWNoZWNrYm94IGlkPVwibGFiZWwtcG9pbnRzLXRvZ2dsZVwiIGNoZWNrZWQ9XCJ7e3Nob3dsYWJlbGVkfX1cIiBpZD1cImxhYmVsZWRDaGVja2JveFwiPlxuICB0cmFpbmluZ1xuICA8L3BhcGVyLWNoZWNrYm94PlxuICA8L3RlbXBsYXRlPlxuXG4gIDx0ZW1wbGF0ZSBpcz1cImRvbS1pZlwiIGlmPVwiW1shc2hvd0Fub21hbHldXVwiPlxuICA8cGFwZXItY2hlY2tib3ggaWQ9XCJsYWJlbC1wb2ludHMtdG9nZ2xlXCIgY2hlY2tlZD1cInt7c2hvd2xhYmVsZWR9fVwiIGlkPVwibGFiZWxlZENoZWNrYm94XCI+XG4gIGxhYmVsZWRcbiAgPC9wYXBlci1jaGVja2JveD5cbiAgPHBhcGVyLWNoZWNrYm94IGlkPVwidW5sYWJlbC1wb2ludHMtdG9nZ2xlXCIgY2hlY2tlZD1cInt7c2hvd1VubGFiZWxlZH19XCI+XG4gIHVubGFiZWxlZFxuICA8L3BhcGVyLWNoZWNrYm94PlxuICA8L3RlbXBsYXRlPlxuICA8L3BhcGVyLWNoZWNrYm94PlxuICA8cGFwZXItY2hlY2tib3ggaWQ9XCJ0ZXN0aW5nLXBvaW50cy10b2dnbGVcIiBjaGVja2VkPVwie3tzaG93VGVzdGluZ319XCI+XG4gIHRlc3RpbmdcbiAgPC9wYXBlci1jaGVja2JveD5cbiAgPC9kaXY+LS0+XG5cblxuICA8IS0tPGRpdiBpZD1cInF1ZXJ5LWNvbnRhaW5lclwiPlxuICAgIDxkaXYgaWQ9XCJxdWVyeS1oZWFkZXItY29udGFpbmVyXCI+XG4gICAgICA8ZGl2IGlkPVwicXVlcnktaGVhZGVyXCI+RHluYW1pY2FsbHkgU2VsZWN0aW9uPC9kaXY+XG4gICAgICA8cGFwZXItaWNvbi1idXR0b24gaWNvbj1cIltbY29sbGFwc2VJY29uXV1cIiBvbi10YXA9XCJfdG9nZ2xlTWV0YWRhdGFDb250YWluZXJcIj5cbiAgICAgIDwvcGFwZXItaWNvbi1idXR0b24+XG4gICAgPC9kaXY+XG4gICAgPGlyb24tY29sbGFwc2UgaWQ9XCJtZXRhZGF0YS1jb250YWluZXJcIj5cbiAgICAgIDxkaXY+RHluYW1pYyBQb2ludCBTZXR0aW5nPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiY29uZmlkZW5jZS10aHJlc2hvbGRcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRocmVzaG9sZC1jb250YWluZXJcIj5cbiAgICAgICAgICA8cGFwZXItaW5wdXQgdmFsdWU9XCJ7e2Vwb2NoRnJvbX19XCIgbGFiZWw9XCJpdGVyYXRpb24gZnJvbTpcIj5cbiAgICAgICAgICA8L3BhcGVyLWlucHV0PlxuICAgICAgICAgIDxwYXBlci1pbnB1dCB2YWx1ZT1cInt7ZXBvY2hUb319XCIgbGFiZWw9XCJpdGVyYXRpb24gdG86XCI+XG4gICAgICAgICAgPC9wYXBlci1pbnB1dD5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LWNvbnRhaW5lclwiPlxuICAgICAgICAgIDxwIGNsYXNzPVwiY3VycmVudC1lcG9jaFwiPmVwb2NoOiB7e2N1cnJlbnRQbGF5ZWRFcG9jaH19PC9wPlxuICAgICAgICAgIDxwYXBlci10b2dnbGUtYnV0dG9uIGlkPVwic2hvdy10cmFjZS10b2dnbGVcIiBjaGVja2VkPVwie3tzaG93VHJhY2V9fVwiPlxuICAgICAgICAgICAgU2hvdyBUcmFjZVxuICAgICAgICAgIDwvcGFwZXItdG9nZ2xlLWJ1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LWNvbnRhaW5lclwiPlxuICAgICAgICAgIDxidXR0b24gc3R5bGU9XCJ3aWR0aDogMTEwcHg7XCIgY2xhc3M9XCJib3VuZGluZ2JveC1idXR0b24gc2hvdy1ub2lzeS1idG5cIj5wbGF5IGFuaW1hdGlvbjwvYnV0dG9uPlxuICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJib3VuZGluZ2JveC1idXR0b24gc3RvcC1hbmltYXRpb24tYnRuXCI+XG4gICAgICAgICAgICBzdG9wIHBsYXlpbmdcbiAgICAgICAgICA8L2J1dHRvbj48L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvaXJvbi1jb2xsYXBzZT5cbiAgPC9kaXY+LS0+XG4gIDwhLS08ZGl2PlxuICAgIDxidXR0b24gY2xhc3M9XCJib3VuZGluZ2JveC1idXR0b24gYWRkXCI+YWRkPC9idXR0b24+XG4gICAgPGJ1dHRvbiBjbGFzcz1cImJvdW5kaW5nYm94LWJ1dHRvbiByZXNldFwiPnJlc2V0PC9idXR0b24+XG4gICAgPGJ1dHRvbiBjbGFzcz1cImJvdW5kaW5nYm94LWJ1dHRvbiBzZW50XCI+c2VudDwvYnV0dG9uPlxuICAgIDxidXR0b24gY2xhc3M9XCJib3VuZGluZ2JveC1idXR0b24gc2hvd1wiPnNob3c8L2J1dHRvbj5cbiAgPC9kaXY+IC0tPlxuXG5cblxuICA8ZGl2IGNsYXNzPVwicmVzdWx0c1wiPlxuICAgIDxkaXYgY2xhc3M9XCJublwiIHN0eWxlPVwiZGlzcGxheTogbm9uZVwiPlxuICAgICAgPGRpdiBjbGFzcz1cIm5laWdoYm9yc1wiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwibmVpZ2hib3JzLW9wdGlvbnNcIj5cbiAgICAgICAgICA8ZGl2IGhpZGRlbiQ9XCJbWyFub1Nob3ddXVwiIGNsYXNzPVwic2xpZGVyIG51bS1ublwiPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJvcHRpb24tbGFiZWxcIj5uZWlnaGJvcnM8L3NwYW4+XG4gICAgICAgICAgICA8cGFwZXItaWNvbi1idXR0b24gaWNvbj1cImhlbHBcIiBjbGFzcz1cImhlbHAtaWNvblwiPjwvcGFwZXItaWNvbi1idXR0b24+XG4gICAgICAgICAgICA8cGFwZXItdG9vbHRpcCBwb3NpdGlvbj1cImJvdHRvbVwiIGFuaW1hdGlvbi1kZWxheT1cIjBcIiBmaXQtdG8tdmlzaWJsZS1ib3VuZHM+XG4gICAgICAgICAgICAgIFRoZSBudW1iZXIgb2YgbmVpZ2hib3JzIChpbiB0aGUgb3JpZ2luYWwgc3BhY2UpIHRvIHNob3cgd2hlblxuICAgICAgICAgICAgICBjbGlja2luZyBvbiBhIHBvaW50LlxuICAgICAgICAgICAgPC9wYXBlci10b29sdGlwPlxuICAgICAgICAgICAgPHBhcGVyLXNsaWRlciBjbGFzcz1cIm5uLXNsaWRlclwiIHBpbiBtaW49XCI1XCIgbWF4PVwiOTk5XCIgZWRpdGFibGUgdmFsdWU9XCJ7e251bU5OfX1cIiBvbi1jaGFuZ2U9XCJ1cGRhdGVOdW1OTlwiPlxuICAgICAgICAgICAgPC9wYXBlci1zbGlkZXI+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGhpZGRlbiQ9XCJbWyFub1Nob3ddXVwiIGNsYXNzPVwiZGlzdGFuY2VcIj5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cIm9wdGlvbi1sYWJlbFwiPmRpc3RhbmNlPC9zcGFuPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJvcHRpb25zXCI+XG4gICAgICAgICAgICA8YSBjbGFzcz1cInNlbGVjdGVkIGNvc2luZVwiIGhyZWY9XCJqYXZhc2NyaXB0OnZvaWQoMCk7XCI+Q09TSU5FPC9hPlxuICAgICAgICAgICAgPGEgY2xhc3M9XCJldWNsaWRlYW5cIiBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApO1wiPkVVQ0xJREVBTjwvYT5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJuZWlnaGJvci1pbWFnZS1jb250cm9sc1wiPlxuICAgICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1pZlwiIGlmPVwiW1tzcHJpdGVJbWFnZXNBdmFpbGFibGVdXVwiPlxuICAgICAgICAgICAgPHBhcGVyLWNoZWNrYm94IGNoZWNrZWQ9XCJ7e3Nob3dOZWlnaGJvckltYWdlc319XCI+XG4gICAgICAgICAgICAgIHNob3cgaW1hZ2VzXG4gICAgICAgICAgICAgIDxwYXBlci1pY29uLWJ1dHRvbiBpY29uPVwiaGVscFwiIGNsYXNzPVwiaGVscC1pY29uXCI+PC9wYXBlci1pY29uLWJ1dHRvbj5cbiAgICAgICAgICAgICAgPHBhcGVyLXRvb2x0aXAgcG9zaXRpb249XCJib3R0b21cIiBhbmltYXRpb24tZGVsYXk9XCIwXCIgZml0LXRvLXZpc2libGUtYm91bmRzPlxuICAgICAgICAgICAgICAgIFNob3cgdGhlIG9yaWdpbmFsIGltYWdlcyBvZiB0aGUgcG9pbnQuXG4gICAgICAgICAgICAgIDwvcGFwZXItdG9vbHRpcD5cbiAgICAgICAgICAgIDwvcGFwZXItY2hlY2tib3g+XG4gICAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJubi1saXN0XCI+PC9kaXY+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cIm1ldGFkYXRhLWluZm9cIiBzdHlsZT1cImRpc3BsYXk6IG5vbmVcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJuZWlnaGJvcnMtb3B0aW9uc1wiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwic2xpZGVyIG51bS1ublwiPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwib3B0aW9uLWxhYmVsXCI+bmVpZ2hib3JzPC9zcGFuPlxuICAgICAgICAgIDxwYXBlci1pY29uLWJ1dHRvbiBpY29uPVwiaGVscFwiIGNsYXNzPVwiaGVscC1pY29uXCI+PC9wYXBlci1pY29uLWJ1dHRvbj5cbiAgICAgICAgICA8cGFwZXItdG9vbHRpcCBwb3NpdGlvbj1cImJvdHRvbVwiIGFuaW1hdGlvbi1kZWxheT1cIjBcIiBmaXQtdG8tdmlzaWJsZS1ib3VuZHM+XG4gICAgICAgICAgICBUaGUgbnVtYmVyIG9mIG5laWdoYm9ycyAoaW4gdGhlIHNlbGVjdGVkIHNwYWNlKSB0byBzaG93IHdoZW5cbiAgICAgICAgICAgIGNsaWNraW5nIG9uIGEgcG9pbnQuXG4gICAgICAgICAgPC9wYXBlci10b29sdGlwPlxuICAgICAgICAgIDxwYXBlci1zbGlkZXIgY2xhc3M9XCJubi1zbGlkZXJcIiBwaW4gbWluPVwiNVwiIG1heD1cIjk5OVwiIGVkaXRhYmxlIHZhbHVlPVwie3tudW1OTn19XCIgb24tY2hhbmdlPVwidXBkYXRlTnVtTk5cIj5cbiAgICAgICAgICA8L3BhcGVyLXNsaWRlcj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxwPnt7bWV0YWRhdGFDb2x1bW59fSBsYWJlbHMgKGNsaWNrIHRvIGFwcGx5KTo8L3A+XG4gICAgICA8ZGl2IGNsYXNzPVwibWV0YWRhdGEtbGlzdFwiPjwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJtYXRjaGVzLWxpc3RcIiBzdHlsZT1cImRpc3BsYXk6IG5vbmVcIj5cbiAgIFxuICAgIDwhLS08ZGl2IGNsYXNzPVwibWF0Y2hlcy1saXN0LXRpdGxlXCI+W1txdWVyeVJlc3VsdExpc3RUaXRsZV1dPC9kaXY+LS0+XG4gICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1pZlwiIGlmPVwiW1tzaG93TW9yZVJlY29tbWVuZF1dXCI+XG4gICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7XCI+XG4gICAgIDxwYXBlci1pbnB1dCB2YWx1ZT1cInt7bW9yZVJlY29tbWVkbk51bX19XCIgbGFiZWw9XCJtb3JlIHJlY29tbWVuZCBudW06XCI+XG4gICAgIDwvcGFwZXItaW5wdXQ+XG4gICAgIDxidXR0b24gZGlzYWJsZWQ9XCJbW2Rpc2FibGVkQWxFeEJhc2VdXVwiIHN0eWxlPVwibWFyZ2luOjEwcHggMDtcIiBjbGFzcz1cImJ1dHRvbiBxdWVyeS1ieS1zZWwtYnRuXCI+TW9yZSBSZWNvbW1lbmQ8L2J1dHRvbj5cbiAgICAgPC9kaXY+XG4gICAgIDwvdGVtcGxhdGU+XG5cbiAgICAgPCEtLTxkaXYgY2xhc3M9XCJidXR0b25zXCI+XG4gICAgIDxidXR0b24gY2xhc3M9XCJidXR0b24gcmVzZXQtZmlsdGVyXCI+U2hvdyBBbGw8L2J1dHRvbj5cbiAgICAgPGJ1dHRvbiBjbGFzcz1cImJ1dHRvbiBzZXQtZmlsdGVyXCI+RmlsdGVyIHF1ZXJ5IHJlc3VsdDwvYnV0dG9uPlxuICAgICA8YnV0dG9uIGNsYXNzPVwiYnV0dG9uIGNsZWFyLXNlbGVjdGlvblwiPkNsZWFyIFNlbGVjdGlvbjwvYnV0dG9uPlxuICAgICA8L2Rpdj4tLT5cbiAgICAgPGRpdiBjbGFzcz1cIm1hdGNoZXMtbGlzdC10aXRsZVwiIHN0eWxlPVwiYmFja2dyb3VuZDojZWFlYWVhOyBsaW5lLWhlaWdodDo0MHB4O2Rpc3BsYXk6IGZsZXg7anVzdGlmeS1jb250ZW50OiBzcGFjZS1hcm91bmQ7XCI+IFxuICAgICA8IS0tPHRlbXBsYXRlIGlzPVwiZG9tLWlmXCIgaWY9XCJbW3Nob3dDaGVja0FsbFF1ZXJ5UmVzXV1cIj5cbiAgICAgPHBhcGVyLWNoZWNrYm94IHN0eWxlPVwibWFyZ2luOiAxMHB4IC0ycHggMHB4IDVweDtcIiBpZD1cImxhYmVsLXBvaW50cy10b2dnbGVcIiBjaGVja2VkPVwie3tjaGVja0FsbFF1ZXJ5UmVzfX1cIj48L3BhcGVyLWNoZWNrYm94PlxuICAgICA8L3RlbXBsYXRlPi0tPlxuICAgICA8dGVtcGxhdGUgaXM9XCJkb20taWZcIiBpZj1cIltbc2hvd0NoZWNrQWxsUXVlcnlSZXNdXVwiPjxzcGFuIGNsYXNzPVwicXVlcnlSZXNDb2x1bW5IZWFkZXJcIiBzdHlsZT1cIndpZHRoOjMwcHg7bGluZS1oZWlnaHQ6IDE1cHg7XCIgdGl0bGU9XCJpbnRlcmVzdFwiPlxuICAgICA8aW5wdXQgdHlwZT1cInJhZGlvXCIgbmFtZT1cImFjY0FsbE9yUmVqQWxsXCIgdmFsdWU9XCJhY2NBbGxcIiBpZD1cImFjY0FsbFJhZGlvXCI+XG4gICAgIDxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIGhlaWdodD1cIjI0cHhcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgd2lkdGg9XCIyNHB4XCIgZmlsbD1cIiMwMDAwMDBcIj48cGF0aCBkPVwiTTAgMGgyNHYyNEgwelwiIGZpbGw9XCJub25lXCIvPjxwYXRoIGQ9XCJNMTYuNSAzYy0xLjc0IDAtMy40MS44MS00LjUgMi4wOUMxMC45MSAzLjgxIDkuMjQgMyA3LjUgMyA0LjQyIDMgMiA1LjQyIDIgOC41YzAgMy43OCAzLjQgNi44NiA4LjU1IDExLjU0TDEyIDIxLjM1bDEuNDUtMS4zMkMxOC42IDE1LjM2IDIyIDEyLjI4IDIyIDguNSAyMiA1LjQyIDE5LjU4IDMgMTYuNSAzem0tNC40IDE1LjU1bC0uMS4xLS4xLS4xQzcuMTQgMTQuMjQgNCAxMS4zOSA0IDguNSA0IDYuNSA1LjUgNSA3LjUgNWMxLjU0IDAgMy4wNC45OSAzLjU3IDIuMzZoMS44N0MxMy40NiA1Ljk5IDE0Ljk2IDUgMTYuNSA1YzIgMCAzLjUgMS41IDMuNSAzLjUgMCAyLjg5LTMuMTQgNS43NC03LjkgMTAuMDV6XCIvPjwvc3ZnPlxuICAgICA8L3NwYW4+PC90ZW1wbGF0ZT5cbiAgICAgPHRlbXBsYXRlIGlzPVwiZG9tLWlmXCIgaWY9XCJbW3Nob3dDaGVja0FsbFF1ZXJ5UmVzXV1cIj48c3BhbiBjbGFzcz1cInF1ZXJ5UmVzQ29sdW1uSGVhZGVyXCIgc3R5bGU9XCJ3aWR0aDozMHB4O2xpbmUtaGVpZ2h0OiAxNXB4O1wiIHRpdGxlPVwibm90IGludGVyZXN0XCI+XG4gICAgIDxpbnB1dCB0eXBlPVwicmFkaW9cIiBuYW1lPVwiYWNjQWxsT3JSZWpBbGxcIiB2YWx1ZT1cInJlakFsbFwiIGlkPVwicmVqQWxsUmFkaW9cIj5cbiAgICAgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgZW5hYmxlLWJhY2tncm91bmQ9XCJuZXcgMCAwIDI0IDI0XCIgaGVpZ2h0PVwiMjRweFwiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiB3aWR0aD1cIjI0cHhcIiBmaWxsPVwiIzAwMDAwMFwiPjxnPjxwYXRoIGQ9XCJNMCwwaDI0djI0SDBWMHpcIiBmaWxsPVwibm9uZVwiLz48L2c+PGc+PHBhdGggZD1cIk0yLjgxLDIuODFMMS4zOSw0LjIybDIuMjcsMi4yN0MyLjYxLDguMDcsMiw5Ljk2LDIsMTJjMCw1LjUyLDQuNDgsMTAsMTAsMTBjMi4wNCwwLDMuOTMtMC42MSw1LjUxLTEuNjZsMi4yNywyLjI3IGwxLjQxLTEuNDFMMi44MSwyLjgxeiBNMTIsMjBjLTQuNDEsMC04LTMuNTktOC04YzAtMS40OCwwLjQxLTIuODYsMS4xMi00LjA2bDEwLjk0LDEwLjk0QzE0Ljg2LDE5LjU5LDEzLjQ4LDIwLDEyLDIweiBNNy45NCw1LjEyIEw2LjQ5LDMuNjZDOC4wNywyLjYxLDkuOTYsMiwxMiwyYzUuNTIsMCwxMCw0LjQ4LDEwLDEwYzAsMi4wNC0wLjYxLDMuOTMtMS42Niw1LjUxbC0xLjQ2LTEuNDZDMTkuNTksMTQuODYsMjAsMTMuNDgsMjAsMTIgYzAtNC40MS0zLjU5LTgtOC04QzEwLjUyLDQsOS4xNCw0LjQxLDcuOTQsNS4xMnpcIi8+PC9nPjwvc3ZnPlxuICAgICA8L3NwYW4+PC90ZW1wbGF0ZT5cbiAgICAgPHNwYW4gY2xhc3M9XCJxdWVyeVJlc0NvbHVtbkhlYWRlclwiPmluZGV4PC9zcGFuPjxzcGFuIGNsYXNzPVwicXVlcnlSZXNDb2x1bW5IZWFkZXJcIiBpZD1cInF1ZXJ5UmVzaGVhZGVyXCI+cHJlZGljdDwvc3Bhbj5cbiAgICAgPHRlbXBsYXRlIGlzPVwiZG9tLWlmXCIgaWY9XCJbW3Nob3dDaGVja0FsbFF1ZXJ5UmVzXV1cIj48c3BhbiBjbGFzcz1cInF1ZXJ5UmVzQ29sdW1uSGVhZGVyXCI+c2NvcmU8L3NwYW4+PC90ZW1wbGF0ZT5cbiAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwibGlzdFwiPjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImxpbWl0LW1zZ1wiPlNob3dpbmcgb25seSB0aGUgZmlyc3QgMTAwIHJlc3VsdHMuLi48L2Rpdj5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+XG5gO1xuIl19