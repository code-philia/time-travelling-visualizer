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
import './styles';
export const template = html `
<style include="vz-projector-styles"></style>
<style>
  :host {
    transition: height 0.2s;
  }

  .ink-button {
    border: none;
    border-radius: 2px;
    font-size: 13px;
    padding: 10px;
    min-width: 100px;
    flex-shrink: 0;
    background: #e3e3e3;
  }

  .ink-panel-buttons {
    margin-bottom: 10px;
  }

  .two-way-toggle {
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  .two-way-toggle span {
    padding-right: 15px;
  }

  .has-border {
    border: 1px solid rgba(0, 0, 0, 0.1);
  }

  .toggle {
    min-width: 0px;
    font-size: 12px;
    width: 17px;
    min-height: 0px;
    height: 21px;
    padding: 0;
    margin: 0px;
  }

  .toggle[active] {
    background-color: #880e4f;
    color: white;
  }

  .two-columns {
    display: flex;
    justify-content: space-between;
  }

  .two-columns> :first-child {
    margin-right: 15px;
  }

  .two-columns>div {
    width: 50%;
  }

  .two-rows {
    display: flex;
    justify-content: space-between;
    flex-direction: column;
  }

  .row {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
  }

  .jump-dvi {
    height: 36px;
    margin-top: 16px;
  }

  .dropdown-item {
    justify-content: space-between;
    min-height: 35px;
  }

  .tsne-supervise-factor {
    margin-bottom: -8px;
  }

  .colorlabel-container {
    display: flex;
    height: 0;
    visibility: hidden;
  }

  #labelby {
    width: 100px;
    margin-right: 10px;
  }

  #colorby {
    width: calc(100% - 110px);
  }

  #z-container {
    display: flex;
    align-items: center;
    width: 50%;
  }

  #z-checkbox {
    margin: 27px 0 0 5px;
    width: 18px;
  }

  #z-dropdown {
    flex-grow: 1;
  }

  .notice {
    color: #880e4f;
  }

  .container {
    padding: 20px;
    padding-top: 0;
    overflow: auto;
  }

  .book-icon {
    height: 20px;
    color: rgba(0, 0, 0, 0.7);
  }

  .item-details {
    color: gray;
    font-size: 12px;
    margin-left: 5px;
  }

  .pca-dropdown {
    width: 100%;
  }

  .pca-dropdown paper-listbox {
    width: 135px;
  }

  .dropdown-item.header {
    border-bottom: 1px solid #aaa;
    color: #333;
    font-weight: bold;
  }

  #total-variance {
    color: rgba(0, 0, 0, 0.7);
  }

  table {
    width: 276px;
  }

  table,
  th,
  td {
    border: 1px solid black;
    padding: 8px;
    border-collapse: collapse;
  }

  button {
    cursor: pointer;
  }

  button:hover {
    background: #550831;
    color: #fff;
  }

  .filter-content {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    margin-top: -20px;
  }
</style>
<div id="main">
  <div class="ink-panel-header" style="height:0">
    <div class="ink-tab-group" style="visibility:hidden;">

      <div data-tab="tsne" id="tsne-tab" class="ink-tab projection-tab">
        DVI
      </div>
      <paper-tooltip for="tsne-tab" position="bottom" animation-delay="0" fit-to-visible-bounds>
        Deep Visual Insight
      </paper-tooltip>

    </div>
  </div>
  <div class="container">
    <div class="colorlabel-container">
      <!-- Label by -->
      <paper-dropdown-menu id="labelby" no-animations label="Label by">
        <paper-listbox attr-for-selected="value" class="dropdown-content" selected="{{selectedLabelOption}}"
          slot="dropdown-content">
          <template is="dom-repeat" items="[[labelOptions]]">
            <paper-item value="[[item]]" label="[[item]]">
              [[item]]
            </paper-item>
          </template>
        </paper-listbox>
      </paper-dropdown-menu>
      <!-- Color by -->
      <paper-dropdown-menu id="colorby" no-animations label="Color by">
        <paper-listbox attr-for-selected="value" class="dropdown-content" selected="{{selectedColorOptionName}}"
          slot="dropdown-content">
          <template is="dom-repeat" items="[[colorOptions]]">
            <paper-item class$="[[getSeparatorClass(item.isSeparator)]]" value="[[item.name]]" label="[[item.name]]"
              disabled="[[item.isSeparator]]">
              [[item.name]]
              <span class="item-details">[[item.desc]]</span>
            </paper-item>
          </template>
        </paper-listbox>
      </paper-dropdown-menu>
    </div>
    <!-- UMAP Controls -->
    <div data-panel="umap" class="ink-panel-content">
      <div class="slider">
        <label>Dimension</label>
        <div class="two-way-toggle">
        </div>
      </div>
      <p>
        <button id="run-umap" class="ink-button" title="Run UMAP" on-tap="runUmap">
          Run
        </button>
      </p>
      <p id="umap-sampling" class="notice">
        For faster results, the data will be sampled down to
        [[getUmapSampleSizeText()]] points.
      </p>
      <p>
        <iron-icon icon="book" class="book-icon"></iron-icon>
        <a target="_blank" rel="noopener" href="https://umap-learn.readthedocs.io/en/latest/how_umap_works.html">
          Learn more about UMAP.
        </a>
      </p>
    </div>
    <!-- TSNE Controls -->
    <div data-panel="tsne" class="ink-panel-content">
      <!-- Subject Model Path -->
      <div class="subject-model-path-editor" style="visibility:hidden;height:0;">
        <paper-input value="{{subjectModelPathEditorInput}}" label="Model Path"
          on-input="subjectModelPathEditorInputChange">
        </paper-input>
      </div>
      <!-- Misc Setting -->
      <!-- <div class="misc-setting-editor">
    </paper-input>
    <paper-input
      value="{{resolutionEditorInput}}"
      label="Resolution"
      on-input="resolutionEditorInputChange"
    >
    </paper-input>
</div>-->
      <!--<div class="slider">
        <label>Status</label>
        <div class="two-way-toggle">
          <span>Indices</span>
          <paper-toggle-button id="DVI-toggle" checked="{{temporalStatus}}">
              Search Predicates
          </paper-toggle-button>
        </div>
      </div>-->
      <!--
       <div class="two-rows">
          <div class="row">
            <button class="run-tsne ink-button" title="Re-run DVI">
              Run
            </button>
            <button class="pause-tsne ink-button" title="Pause DVI">
              Pause
            </button>
          </div> 
          <div class="row">
             <button class="previous-dvi ink-button" title="Previous DVI">
               Previous
             </button>
             <button class="next-dvi ink-button" title="Next DVI">
               Next
             </button>
          </div>
      </div> -->
      <div class="row" style="visibility:hidden;height:0;">
        <button class="previous-dvi ink-button" title="Previous DVI">
          Previous
        </button>
        <button class="next-dvi ink-button" title="Next DVI">
          Next
        </button>
      </div>
      <div class="row"> </div>

      <div class="row" style="height: 0px;visibility: hidden;">
        <div class="iteration-editor">
          <paper-input value="{{iterationEditorInput}}" label="Iteration" on-input="iterationEditorInputChange">
          </paper-input>
        </div>
        <button class="jump-dvi ink-button" title="Jump DVI">Jump</button>
      </div>
      <div style="display:flex;justify-content: space-between; flex-direction:column;">
        <p style="font-weight: 600;">Iteration: <span class="run-tsne-iter">0</span></p>
        <p>Total Iteration: <span class="dvi-total-iter">0</span></p>
      </div>

      <div style="border-bottom:1px solid #666; height:0; visibility:hidden;">
        <table>
          <caption style="margin-bottom: 10px;">Visualization Confidence</caption>
          <tr>
            <td></td>
            <td>train</td>
            <td>test</td>
          </tr>
          <tr>
            <td>nn</td>
            <td><span class="nn_train_15">NA</span> </td>
            <td><span class="nn_test_15">NA</span></td>
          </tr>
          <tr>
            <td>boundary</td>
            <td><span class="bound_train_15">NA</span></td>
            <td><span class="bound_test_15">NA</span></td>
          </tr>
          <tr>
            <td>PPR</td>
            <td><span class="inv_acc_train">NA</span> </td>
            <td> <span class="inv_acc_test">NA</span></td>
          </tr>
          <!--<tr>
              <td>CCR</td>
              <td><span class="inv_conf_train">NA</span></td>
              <td><span class="inv_conf_test">NA</span></td>
            </tr>-->
        </table>
        <p>Accuracy:</p>
        <p>train: <span class="acc_train">NA</span> test: <span class="acc_test">NA</span></p>
      </div>
      <p id="tsne-sampling" class="notice">
      </p>
      <!--          <p>Projection nn perseverance knn: (train,15): <span class="nn_train_15">NA</span> (test,15): <span class="nn_test_15">NA</span></p>-->
      <!--          <p>Projection boundary perserverance knn: (train,15): <span class="bound_train_15">NA</span> (test,15): <span class="bound_test_15">NA</span></p>-->
      <!--          <p>PPR: train: <span class="inv_acc_train">NA</span> test: <span class="inv_acc_test">NA</span></p>-->
      <!--          <p>CCR: train: <span class="inv_conf_train">NA</span> test: <span class="inv_conf_test">NA</span></p>-->
      <template is="dom-if" if="[[_showFilter]]">
       
        <div class="filter-content" style="visibility:hidden;height:0px">
          <paper-dropdown-menu style="width: 120px" no-animations label="Architecture">
            <paper-listbox attr-for-selected="value" class="dropdown-content" selected="{{selectedArchitecture}}"
              slot="dropdown-content">
              <template is="dom-repeat" items="[[architectureList]]">
                <paper-item value="[[item]]" label="[[item]]">
                  [[item]]
                </paper-item>
              </template>
            </paper-listbox>
          </paper-dropdown-menu>
          <paper-dropdown-menu style="width: 120px" no-animations label="Learning Rate">
            <paper-listbox attr-for-selected="value" class="dropdown-content" selected="{{selectedLr}}"
              slot="dropdown-content">
              <template is="dom-repeat" items="[[learningRateList]]">
                <paper-item value="[[item]]" label="[[item]]">
                  [[item]]
                </paper-item>
              </template>
            </paper-listbox>
          </paper-dropdown-menu>
          <paper-dropdown-menu style="width: 120px" no-animations label="Total Epoch">
            <paper-listbox attr-for-selected="value" class="dropdown-content" selected="{{selectedTotalEpoch}}"
              slot="dropdown-content">
              <template is="dom-repeat" items="[[totalEpochList]]">
                <paper-item value="[[item]]" label="[[item]]">
                  [[item]]
                </paper-item>
              </template>
            </paper-listbox>
          </paper-dropdown-menu>
        </div>

      </template>
      <table style="width:164px">
        <caption style="margin-bottom: 10px; font-weight: 600;">
        <h2>Task Model Accuracy</h2>
        </caption>
        <tr>
          <td>Train Acc</td>
          <td>Test Acc</td>
        </tr>
        <tr>
          <td><span class="total_acc_train">NA</span></td>
          <td><span class="total_acc_test">NA</span></td>
        </tr>



      </table>
      <!--<p style="font-weight: 600;">Task Model Accuracy:</p>
      <p style="font-size:20px;">train: <span class="total_acc_train">NA</span> test: <span
          class="total_acc_test">NA</span></p>-->
    </div>
    <p id="tsne-sampling" class="notice">
    </p>
  </div>
  <!-- PCA Controls -->
  <div data-panel="pca" class="ink-panel-content">
    <div class="two-columns">
      <div>
        <!-- Left column -->
        <paper-dropdown-menu class="pca-dropdown" vertical-align="bottom" no-animations label="X">
          <paper-listbox attr-for-selected="value" class="dropdown-content" selected="{{pcaX}}" slot="dropdown-content">
            <paper-item disabled class="dropdown-item header">
              <div>#</div>
              <div>Variance (%)</div>
            </paper-item>
            <template is="dom-repeat" items="[[pcaComponents]]">
              <paper-item class="dropdown-item" value="[[item.id]]" label="Component #[[item.componentNumber]]">
                <div>[[item.componentNumber]]</div>
                <div class="item-details">[[item.percVariance]]</div>
              </paper-item>
            </template>
          </paper-listbox>
        </paper-dropdown-menu>
        <paper-dropdown-menu class="pca-dropdown" no-animations vertical-align="bottom" label="Z"
          disabled="[[!hasPcaZ]]" id="z-dropdown">
          <paper-listbox attr-for-selected="value" class="dropdown-content" selected="{{pcaZ}}" slot="dropdown-content">
            <paper-item disabled class="dropdown-item header">
              <div>#</div>
              <div>Variance (%)</div>
            </paper-item>
            <template is="dom-repeat" items="[[pcaComponents]]">
              <paper-item class="dropdown-item" value="[[item.id]]" label="Component #[[item.componentNumber]]">
                <div>[[item.componentNumber]]</div>
                <div class="item-details">[[item.percVariance]]</div>
              </paper-item>
            </template>
          </paper-listbox>
        </paper-dropdown-menu>
      </div>
      <div>
        <!-- Right column -->
        <paper-dropdown-menu class="pca-dropdown" vertical-align="bottom" no-animations label="Y">
          <paper-listbox attr-for-selected="value" class="dropdown-content" selected="{{pcaY}}" slot="dropdown-content">
            <paper-item disabled class="dropdown-item header">
              <div>#</div>
              <div>Variance (%)</div>
            </paper-item>
            <template is="dom-repeat" items="[[pcaComponents]]">
              <paper-item class="dropdown-item" value="[[item.id]]" label="Component #[[item.componentNumber]]">
                <div>[[item.componentNumber]]</div>
                <div class="item-details">[[item.percVariance]]</div>
              </paper-item>
            </template>
          </paper-listbox>
        </paper-dropdown-menu>
      </div>
    </div>
    <p id="pca-sampling" class="notice">
      PCA is approximate.
      <paper-icon-button icon="help" class="help-icon"></paper-icon-button>
    </p>
    <div id="total-variance">Total variance</div>
    <paper-tooltip for="pca-sampling" position="top" animation-delay="0" fit-to-visible-bounds>
      For fast results, the data was sampled to [[getPcaSampleSizeText()]]
      points and randomly projected down to [[getPcaSampledDimText()]]
      dimensions.
    </paper-tooltip>
  </div>
  <!-- Custom Controls -->
  <div data-panel="custom" class="ink-panel-content">
    <paper-dropdown-menu style="width: 100%" no-animations label="Search by">
      <paper-listbox attr-for-selected="value" class="dropdown-content"
        selected="{{customSelectedSearchByMetadataOption}}" slot="dropdown-content">
        <template is="dom-repeat" items="[[searchByMetadataOptions]]">
          <paper-item class="dropdown-item" value="[[item]]" label="[[item]]">
            [[item]]
          </paper-item>
        </template>
      </paper-listbox>
    </paper-dropdown-menu>
    <div class="two-columns">
      <vz-projector-input id="xLeft" label="Left"></vz-projector-input>
      <vz-projector-input id="xRight" label="Right"></vz-projector-input>
    </div>
    <div class="two-columns">
      <vz-projector-input id="yUp" label="Up"></vz-projector-input>
      <vz-projector-input id="yDown" label="Down"></vz-projector-input>
    </div>
  </div>
</div>
</div>
</template>
<script src="vz-projector-projections-panel.js"></script>
</dom-module>
`;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLXByb2plY3Rpb25zLXBhbmVsLmh0bWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi90ZW5zb3Jib2FyZC9wcm9qZWN0b3IvdnotcHJvamVjdG9yLXByb2plY3Rpb25zLXBhbmVsLmh0bWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Z0ZBYWdGO0FBRWhGLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUV4QyxPQUFPLFVBQVUsQ0FBQztBQUVsQixNQUFNLENBQUMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBeWYzQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyogQ29weXJpZ2h0IDIwMTYgVGhlIFRlbnNvckZsb3cgQXV0aG9ycy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG49PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuXG5pbXBvcnQgeyBodG1sIH0gZnJvbSAnQHBvbHltZXIvcG9seW1lcic7XG5cbmltcG9ydCAnLi9zdHlsZXMnO1xuXG5leHBvcnQgY29uc3QgdGVtcGxhdGUgPSBodG1sYFxuPHN0eWxlIGluY2x1ZGU9XCJ2ei1wcm9qZWN0b3Itc3R5bGVzXCI+PC9zdHlsZT5cbjxzdHlsZT5cbiAgOmhvc3Qge1xuICAgIHRyYW5zaXRpb246IGhlaWdodCAwLjJzO1xuICB9XG5cbiAgLmluay1idXR0b24ge1xuICAgIGJvcmRlcjogbm9uZTtcbiAgICBib3JkZXItcmFkaXVzOiAycHg7XG4gICAgZm9udC1zaXplOiAxM3B4O1xuICAgIHBhZGRpbmc6IDEwcHg7XG4gICAgbWluLXdpZHRoOiAxMDBweDtcbiAgICBmbGV4LXNocmluazogMDtcbiAgICBiYWNrZ3JvdW5kOiAjZTNlM2UzO1xuICB9XG5cbiAgLmluay1wYW5lbC1idXR0b25zIHtcbiAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xuICB9XG5cbiAgLnR3by13YXktdG9nZ2xlIHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgfVxuXG4gIC50d28td2F5LXRvZ2dsZSBzcGFuIHtcbiAgICBwYWRkaW5nLXJpZ2h0OiAxNXB4O1xuICB9XG5cbiAgLmhhcy1ib3JkZXIge1xuICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMCwgMCwgMCwgMC4xKTtcbiAgfVxuXG4gIC50b2dnbGUge1xuICAgIG1pbi13aWR0aDogMHB4O1xuICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICB3aWR0aDogMTdweDtcbiAgICBtaW4taGVpZ2h0OiAwcHg7XG4gICAgaGVpZ2h0OiAyMXB4O1xuICAgIHBhZGRpbmc6IDA7XG4gICAgbWFyZ2luOiAwcHg7XG4gIH1cblxuICAudG9nZ2xlW2FjdGl2ZV0ge1xuICAgIGJhY2tncm91bmQtY29sb3I6ICM4ODBlNGY7XG4gICAgY29sb3I6IHdoaXRlO1xuICB9XG5cbiAgLnR3by1jb2x1bW5zIHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgfVxuXG4gIC50d28tY29sdW1ucz4gOmZpcnN0LWNoaWxkIHtcbiAgICBtYXJnaW4tcmlnaHQ6IDE1cHg7XG4gIH1cblxuICAudHdvLWNvbHVtbnM+ZGl2IHtcbiAgICB3aWR0aDogNTAlO1xuICB9XG5cbiAgLnR3by1yb3dzIHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICB9XG5cbiAgLnJvdyB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgbWFyZ2luLXRvcDogMTBweDtcbiAgfVxuXG4gIC5qdW1wLWR2aSB7XG4gICAgaGVpZ2h0OiAzNnB4O1xuICAgIG1hcmdpbi10b3A6IDE2cHg7XG4gIH1cblxuICAuZHJvcGRvd24taXRlbSB7XG4gICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgIG1pbi1oZWlnaHQ6IDM1cHg7XG4gIH1cblxuICAudHNuZS1zdXBlcnZpc2UtZmFjdG9yIHtcbiAgICBtYXJnaW4tYm90dG9tOiAtOHB4O1xuICB9XG5cbiAgLmNvbG9ybGFiZWwtY29udGFpbmVyIHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGhlaWdodDogMDtcbiAgICB2aXNpYmlsaXR5OiBoaWRkZW47XG4gIH1cblxuICAjbGFiZWxieSB7XG4gICAgd2lkdGg6IDEwMHB4O1xuICAgIG1hcmdpbi1yaWdodDogMTBweDtcbiAgfVxuXG4gICNjb2xvcmJ5IHtcbiAgICB3aWR0aDogY2FsYygxMDAlIC0gMTEwcHgpO1xuICB9XG5cbiAgI3otY29udGFpbmVyIHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgd2lkdGg6IDUwJTtcbiAgfVxuXG4gICN6LWNoZWNrYm94IHtcbiAgICBtYXJnaW46IDI3cHggMCAwIDVweDtcbiAgICB3aWR0aDogMThweDtcbiAgfVxuXG4gICN6LWRyb3Bkb3duIHtcbiAgICBmbGV4LWdyb3c6IDE7XG4gIH1cblxuICAubm90aWNlIHtcbiAgICBjb2xvcjogIzg4MGU0ZjtcbiAgfVxuXG4gIC5jb250YWluZXIge1xuICAgIHBhZGRpbmc6IDIwcHg7XG4gICAgcGFkZGluZy10b3A6IDA7XG4gICAgb3ZlcmZsb3c6IGF1dG87XG4gIH1cblxuICAuYm9vay1pY29uIHtcbiAgICBoZWlnaHQ6IDIwcHg7XG4gICAgY29sb3I6IHJnYmEoMCwgMCwgMCwgMC43KTtcbiAgfVxuXG4gIC5pdGVtLWRldGFpbHMge1xuICAgIGNvbG9yOiBncmF5O1xuICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICBtYXJnaW4tbGVmdDogNXB4O1xuICB9XG5cbiAgLnBjYS1kcm9wZG93biB7XG4gICAgd2lkdGg6IDEwMCU7XG4gIH1cblxuICAucGNhLWRyb3Bkb3duIHBhcGVyLWxpc3Rib3gge1xuICAgIHdpZHRoOiAxMzVweDtcbiAgfVxuXG4gIC5kcm9wZG93bi1pdGVtLmhlYWRlciB7XG4gICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICNhYWE7XG4gICAgY29sb3I6ICMzMzM7XG4gICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gIH1cblxuICAjdG90YWwtdmFyaWFuY2Uge1xuICAgIGNvbG9yOiByZ2JhKDAsIDAsIDAsIDAuNyk7XG4gIH1cblxuICB0YWJsZSB7XG4gICAgd2lkdGg6IDI3NnB4O1xuICB9XG5cbiAgdGFibGUsXG4gIHRoLFxuICB0ZCB7XG4gICAgYm9yZGVyOiAxcHggc29saWQgYmxhY2s7XG4gICAgcGFkZGluZzogOHB4O1xuICAgIGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7XG4gIH1cblxuICBidXR0b24ge1xuICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgfVxuXG4gIGJ1dHRvbjpob3ZlciB7XG4gICAgYmFja2dyb3VuZDogIzU1MDgzMTtcbiAgICBjb2xvcjogI2ZmZjtcbiAgfVxuXG4gIC5maWx0ZXItY29udGVudCB7XG4gICAgd2lkdGg6IDEwMCU7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgIG1hcmdpbi10b3A6IC0yMHB4O1xuICB9XG48L3N0eWxlPlxuPGRpdiBpZD1cIm1haW5cIj5cbiAgPGRpdiBjbGFzcz1cImluay1wYW5lbC1oZWFkZXJcIiBzdHlsZT1cImhlaWdodDowXCI+XG4gICAgPGRpdiBjbGFzcz1cImluay10YWItZ3JvdXBcIiBzdHlsZT1cInZpc2liaWxpdHk6aGlkZGVuO1wiPlxuXG4gICAgICA8ZGl2IGRhdGEtdGFiPVwidHNuZVwiIGlkPVwidHNuZS10YWJcIiBjbGFzcz1cImluay10YWIgcHJvamVjdGlvbi10YWJcIj5cbiAgICAgICAgRFZJXG4gICAgICA8L2Rpdj5cbiAgICAgIDxwYXBlci10b29sdGlwIGZvcj1cInRzbmUtdGFiXCIgcG9zaXRpb249XCJib3R0b21cIiBhbmltYXRpb24tZGVsYXk9XCIwXCIgZml0LXRvLXZpc2libGUtYm91bmRzPlxuICAgICAgICBEZWVwIFZpc3VhbCBJbnNpZ2h0XG4gICAgICA8L3BhcGVyLXRvb2x0aXA+XG5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+XG4gIDxkaXYgY2xhc3M9XCJjb250YWluZXJcIj5cbiAgICA8ZGl2IGNsYXNzPVwiY29sb3JsYWJlbC1jb250YWluZXJcIj5cbiAgICAgIDwhLS0gTGFiZWwgYnkgLS0+XG4gICAgICA8cGFwZXItZHJvcGRvd24tbWVudSBpZD1cImxhYmVsYnlcIiBuby1hbmltYXRpb25zIGxhYmVsPVwiTGFiZWwgYnlcIj5cbiAgICAgICAgPHBhcGVyLWxpc3Rib3ggYXR0ci1mb3Itc2VsZWN0ZWQ9XCJ2YWx1ZVwiIGNsYXNzPVwiZHJvcGRvd24tY29udGVudFwiIHNlbGVjdGVkPVwie3tzZWxlY3RlZExhYmVsT3B0aW9ufX1cIlxuICAgICAgICAgIHNsb3Q9XCJkcm9wZG93bi1jb250ZW50XCI+XG4gICAgICAgICAgPHRlbXBsYXRlIGlzPVwiZG9tLXJlcGVhdFwiIGl0ZW1zPVwiW1tsYWJlbE9wdGlvbnNdXVwiPlxuICAgICAgICAgICAgPHBhcGVyLWl0ZW0gdmFsdWU9XCJbW2l0ZW1dXVwiIGxhYmVsPVwiW1tpdGVtXV1cIj5cbiAgICAgICAgICAgICAgW1tpdGVtXV1cbiAgICAgICAgICAgIDwvcGFwZXItaXRlbT5cbiAgICAgICAgICA8L3RlbXBsYXRlPlxuICAgICAgICA8L3BhcGVyLWxpc3Rib3g+XG4gICAgICA8L3BhcGVyLWRyb3Bkb3duLW1lbnU+XG4gICAgICA8IS0tIENvbG9yIGJ5IC0tPlxuICAgICAgPHBhcGVyLWRyb3Bkb3duLW1lbnUgaWQ9XCJjb2xvcmJ5XCIgbm8tYW5pbWF0aW9ucyBsYWJlbD1cIkNvbG9yIGJ5XCI+XG4gICAgICAgIDxwYXBlci1saXN0Ym94IGF0dHItZm9yLXNlbGVjdGVkPVwidmFsdWVcIiBjbGFzcz1cImRyb3Bkb3duLWNvbnRlbnRcIiBzZWxlY3RlZD1cInt7c2VsZWN0ZWRDb2xvck9wdGlvbk5hbWV9fVwiXG4gICAgICAgICAgc2xvdD1cImRyb3Bkb3duLWNvbnRlbnRcIj5cbiAgICAgICAgICA8dGVtcGxhdGUgaXM9XCJkb20tcmVwZWF0XCIgaXRlbXM9XCJbW2NvbG9yT3B0aW9uc11dXCI+XG4gICAgICAgICAgICA8cGFwZXItaXRlbSBjbGFzcyQ9XCJbW2dldFNlcGFyYXRvckNsYXNzKGl0ZW0uaXNTZXBhcmF0b3IpXV1cIiB2YWx1ZT1cIltbaXRlbS5uYW1lXV1cIiBsYWJlbD1cIltbaXRlbS5uYW1lXV1cIlxuICAgICAgICAgICAgICBkaXNhYmxlZD1cIltbaXRlbS5pc1NlcGFyYXRvcl1dXCI+XG4gICAgICAgICAgICAgIFtbaXRlbS5uYW1lXV1cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJpdGVtLWRldGFpbHNcIj5bW2l0ZW0uZGVzY11dPC9zcGFuPlxuICAgICAgICAgICAgPC9wYXBlci1pdGVtPlxuICAgICAgICAgIDwvdGVtcGxhdGU+XG4gICAgICAgIDwvcGFwZXItbGlzdGJveD5cbiAgICAgIDwvcGFwZXItZHJvcGRvd24tbWVudT5cbiAgICA8L2Rpdj5cbiAgICA8IS0tIFVNQVAgQ29udHJvbHMgLS0+XG4gICAgPGRpdiBkYXRhLXBhbmVsPVwidW1hcFwiIGNsYXNzPVwiaW5rLXBhbmVsLWNvbnRlbnRcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJzbGlkZXJcIj5cbiAgICAgICAgPGxhYmVsPkRpbWVuc2lvbjwvbGFiZWw+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0d28td2F5LXRvZ2dsZVwiPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgPHA+XG4gICAgICAgIDxidXR0b24gaWQ9XCJydW4tdW1hcFwiIGNsYXNzPVwiaW5rLWJ1dHRvblwiIHRpdGxlPVwiUnVuIFVNQVBcIiBvbi10YXA9XCJydW5VbWFwXCI+XG4gICAgICAgICAgUnVuXG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9wPlxuICAgICAgPHAgaWQ9XCJ1bWFwLXNhbXBsaW5nXCIgY2xhc3M9XCJub3RpY2VcIj5cbiAgICAgICAgRm9yIGZhc3RlciByZXN1bHRzLCB0aGUgZGF0YSB3aWxsIGJlIHNhbXBsZWQgZG93biB0b1xuICAgICAgICBbW2dldFVtYXBTYW1wbGVTaXplVGV4dCgpXV0gcG9pbnRzLlxuICAgICAgPC9wPlxuICAgICAgPHA+XG4gICAgICAgIDxpcm9uLWljb24gaWNvbj1cImJvb2tcIiBjbGFzcz1cImJvb2staWNvblwiPjwvaXJvbi1pY29uPlxuICAgICAgICA8YSB0YXJnZXQ9XCJfYmxhbmtcIiByZWw9XCJub29wZW5lclwiIGhyZWY9XCJodHRwczovL3VtYXAtbGVhcm4ucmVhZHRoZWRvY3MuaW8vZW4vbGF0ZXN0L2hvd191bWFwX3dvcmtzLmh0bWxcIj5cbiAgICAgICAgICBMZWFybiBtb3JlIGFib3V0IFVNQVAuXG4gICAgICAgIDwvYT5cbiAgICAgIDwvcD5cbiAgICA8L2Rpdj5cbiAgICA8IS0tIFRTTkUgQ29udHJvbHMgLS0+XG4gICAgPGRpdiBkYXRhLXBhbmVsPVwidHNuZVwiIGNsYXNzPVwiaW5rLXBhbmVsLWNvbnRlbnRcIj5cbiAgICAgIDwhLS0gU3ViamVjdCBNb2RlbCBQYXRoIC0tPlxuICAgICAgPGRpdiBjbGFzcz1cInN1YmplY3QtbW9kZWwtcGF0aC1lZGl0b3JcIiBzdHlsZT1cInZpc2liaWxpdHk6aGlkZGVuO2hlaWdodDowO1wiPlxuICAgICAgICA8cGFwZXItaW5wdXQgdmFsdWU9XCJ7e3N1YmplY3RNb2RlbFBhdGhFZGl0b3JJbnB1dH19XCIgbGFiZWw9XCJNb2RlbCBQYXRoXCJcbiAgICAgICAgICBvbi1pbnB1dD1cInN1YmplY3RNb2RlbFBhdGhFZGl0b3JJbnB1dENoYW5nZVwiPlxuICAgICAgICA8L3BhcGVyLWlucHV0PlxuICAgICAgPC9kaXY+XG4gICAgICA8IS0tIE1pc2MgU2V0dGluZyAtLT5cbiAgICAgIDwhLS0gPGRpdiBjbGFzcz1cIm1pc2Mtc2V0dGluZy1lZGl0b3JcIj5cbiAgICA8L3BhcGVyLWlucHV0PlxuICAgIDxwYXBlci1pbnB1dFxuICAgICAgdmFsdWU9XCJ7e3Jlc29sdXRpb25FZGl0b3JJbnB1dH19XCJcbiAgICAgIGxhYmVsPVwiUmVzb2x1dGlvblwiXG4gICAgICBvbi1pbnB1dD1cInJlc29sdXRpb25FZGl0b3JJbnB1dENoYW5nZVwiXG4gICAgPlxuICAgIDwvcGFwZXItaW5wdXQ+XG48L2Rpdj4tLT5cbiAgICAgIDwhLS08ZGl2IGNsYXNzPVwic2xpZGVyXCI+XG4gICAgICAgIDxsYWJlbD5TdGF0dXM8L2xhYmVsPlxuICAgICAgICA8ZGl2IGNsYXNzPVwidHdvLXdheS10b2dnbGVcIj5cbiAgICAgICAgICA8c3Bhbj5JbmRpY2VzPC9zcGFuPlxuICAgICAgICAgIDxwYXBlci10b2dnbGUtYnV0dG9uIGlkPVwiRFZJLXRvZ2dsZVwiIGNoZWNrZWQ9XCJ7e3RlbXBvcmFsU3RhdHVzfX1cIj5cbiAgICAgICAgICAgICAgU2VhcmNoIFByZWRpY2F0ZXNcbiAgICAgICAgICA8L3BhcGVyLXRvZ2dsZS1idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+LS0+XG4gICAgICA8IS0tXG4gICAgICAgPGRpdiBjbGFzcz1cInR3by1yb3dzXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInJvd1wiPlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cInJ1bi10c25lIGluay1idXR0b25cIiB0aXRsZT1cIlJlLXJ1biBEVklcIj5cbiAgICAgICAgICAgICAgUnVuXG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJwYXVzZS10c25lIGluay1idXR0b25cIiB0aXRsZT1cIlBhdXNlIERWSVwiPlxuICAgICAgICAgICAgICBQYXVzZVxuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPC9kaXY+IFxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJyb3dcIj5cbiAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwicHJldmlvdXMtZHZpIGluay1idXR0b25cIiB0aXRsZT1cIlByZXZpb3VzIERWSVwiPlxuICAgICAgICAgICAgICAgUHJldmlvdXNcbiAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwibmV4dC1kdmkgaW5rLWJ1dHRvblwiIHRpdGxlPVwiTmV4dCBEVklcIj5cbiAgICAgICAgICAgICAgIE5leHRcbiAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PiAtLT5cbiAgICAgIDxkaXYgY2xhc3M9XCJyb3dcIiBzdHlsZT1cInZpc2liaWxpdHk6aGlkZGVuO2hlaWdodDowO1wiPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwicHJldmlvdXMtZHZpIGluay1idXR0b25cIiB0aXRsZT1cIlByZXZpb3VzIERWSVwiPlxuICAgICAgICAgIFByZXZpb3VzXG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwibmV4dC1kdmkgaW5rLWJ1dHRvblwiIHRpdGxlPVwiTmV4dCBEVklcIj5cbiAgICAgICAgICBOZXh0XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwicm93XCI+IDwvZGl2PlxuXG4gICAgICA8ZGl2IGNsYXNzPVwicm93XCIgc3R5bGU9XCJoZWlnaHQ6IDBweDt2aXNpYmlsaXR5OiBoaWRkZW47XCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJpdGVyYXRpb24tZWRpdG9yXCI+XG4gICAgICAgICAgPHBhcGVyLWlucHV0IHZhbHVlPVwie3tpdGVyYXRpb25FZGl0b3JJbnB1dH19XCIgbGFiZWw9XCJJdGVyYXRpb25cIiBvbi1pbnB1dD1cIml0ZXJhdGlvbkVkaXRvcklucHV0Q2hhbmdlXCI+XG4gICAgICAgICAgPC9wYXBlci1pbnB1dD5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJqdW1wLWR2aSBpbmstYnV0dG9uXCIgdGl0bGU9XCJKdW1wIERWSVwiPkp1bXA8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47IGZsZXgtZGlyZWN0aW9uOmNvbHVtbjtcIj5cbiAgICAgICAgPHAgc3R5bGU9XCJmb250LXdlaWdodDogNjAwO1wiPkl0ZXJhdGlvbjogPHNwYW4gY2xhc3M9XCJydW4tdHNuZS1pdGVyXCI+MDwvc3Bhbj48L3A+XG4gICAgICAgIDxwPlRvdGFsIEl0ZXJhdGlvbjogPHNwYW4gY2xhc3M9XCJkdmktdG90YWwtaXRlclwiPjA8L3NwYW4+PC9wPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXYgc3R5bGU9XCJib3JkZXItYm90dG9tOjFweCBzb2xpZCAjNjY2OyBoZWlnaHQ6MDsgdmlzaWJpbGl0eTpoaWRkZW47XCI+XG4gICAgICAgIDx0YWJsZT5cbiAgICAgICAgICA8Y2FwdGlvbiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDEwcHg7XCI+VmlzdWFsaXphdGlvbiBDb25maWRlbmNlPC9jYXB0aW9uPlxuICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgIDx0ZD48L3RkPlxuICAgICAgICAgICAgPHRkPnRyYWluPC90ZD5cbiAgICAgICAgICAgIDx0ZD50ZXN0PC90ZD5cbiAgICAgICAgICA8L3RyPlxuICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgIDx0ZD5ubjwvdGQ+XG4gICAgICAgICAgICA8dGQ+PHNwYW4gY2xhc3M9XCJubl90cmFpbl8xNVwiPk5BPC9zcGFuPiA8L3RkPlxuICAgICAgICAgICAgPHRkPjxzcGFuIGNsYXNzPVwibm5fdGVzdF8xNVwiPk5BPC9zcGFuPjwvdGQ+XG4gICAgICAgICAgPC90cj5cbiAgICAgICAgICA8dHI+XG4gICAgICAgICAgICA8dGQ+Ym91bmRhcnk8L3RkPlxuICAgICAgICAgICAgPHRkPjxzcGFuIGNsYXNzPVwiYm91bmRfdHJhaW5fMTVcIj5OQTwvc3Bhbj48L3RkPlxuICAgICAgICAgICAgPHRkPjxzcGFuIGNsYXNzPVwiYm91bmRfdGVzdF8xNVwiPk5BPC9zcGFuPjwvdGQ+XG4gICAgICAgICAgPC90cj5cbiAgICAgICAgICA8dHI+XG4gICAgICAgICAgICA8dGQ+UFBSPC90ZD5cbiAgICAgICAgICAgIDx0ZD48c3BhbiBjbGFzcz1cImludl9hY2NfdHJhaW5cIj5OQTwvc3Bhbj4gPC90ZD5cbiAgICAgICAgICAgIDx0ZD4gPHNwYW4gY2xhc3M9XCJpbnZfYWNjX3Rlc3RcIj5OQTwvc3Bhbj48L3RkPlxuICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgPCEtLTx0cj5cbiAgICAgICAgICAgICAgPHRkPkNDUjwvdGQ+XG4gICAgICAgICAgICAgIDx0ZD48c3BhbiBjbGFzcz1cImludl9jb25mX3RyYWluXCI+TkE8L3NwYW4+PC90ZD5cbiAgICAgICAgICAgICAgPHRkPjxzcGFuIGNsYXNzPVwiaW52X2NvbmZfdGVzdFwiPk5BPC9zcGFuPjwvdGQ+XG4gICAgICAgICAgICA8L3RyPi0tPlxuICAgICAgICA8L3RhYmxlPlxuICAgICAgICA8cD5BY2N1cmFjeTo8L3A+XG4gICAgICAgIDxwPnRyYWluOiA8c3BhbiBjbGFzcz1cImFjY190cmFpblwiPk5BPC9zcGFuPiB0ZXN0OiA8c3BhbiBjbGFzcz1cImFjY190ZXN0XCI+TkE8L3NwYW4+PC9wPlxuICAgICAgPC9kaXY+XG4gICAgICA8cCBpZD1cInRzbmUtc2FtcGxpbmdcIiBjbGFzcz1cIm5vdGljZVwiPlxuICAgICAgPC9wPlxuICAgICAgPCEtLSAgICAgICAgICA8cD5Qcm9qZWN0aW9uIG5uIHBlcnNldmVyYW5jZSBrbm46ICh0cmFpbiwxNSk6IDxzcGFuIGNsYXNzPVwibm5fdHJhaW5fMTVcIj5OQTwvc3Bhbj4gKHRlc3QsMTUpOiA8c3BhbiBjbGFzcz1cIm5uX3Rlc3RfMTVcIj5OQTwvc3Bhbj48L3A+LS0+XG4gICAgICA8IS0tICAgICAgICAgIDxwPlByb2plY3Rpb24gYm91bmRhcnkgcGVyc2VydmVyYW5jZSBrbm46ICh0cmFpbiwxNSk6IDxzcGFuIGNsYXNzPVwiYm91bmRfdHJhaW5fMTVcIj5OQTwvc3Bhbj4gKHRlc3QsMTUpOiA8c3BhbiBjbGFzcz1cImJvdW5kX3Rlc3RfMTVcIj5OQTwvc3Bhbj48L3A+LS0+XG4gICAgICA8IS0tICAgICAgICAgIDxwPlBQUjogdHJhaW46IDxzcGFuIGNsYXNzPVwiaW52X2FjY190cmFpblwiPk5BPC9zcGFuPiB0ZXN0OiA8c3BhbiBjbGFzcz1cImludl9hY2NfdGVzdFwiPk5BPC9zcGFuPjwvcD4tLT5cbiAgICAgIDwhLS0gICAgICAgICAgPHA+Q0NSOiB0cmFpbjogPHNwYW4gY2xhc3M9XCJpbnZfY29uZl90cmFpblwiPk5BPC9zcGFuPiB0ZXN0OiA8c3BhbiBjbGFzcz1cImludl9jb25mX3Rlc3RcIj5OQTwvc3Bhbj48L3A+LS0+XG4gICAgICA8dGVtcGxhdGUgaXM9XCJkb20taWZcIiBpZj1cIltbX3Nob3dGaWx0ZXJdXVwiPlxuICAgICAgIFxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmlsdGVyLWNvbnRlbnRcIiBzdHlsZT1cInZpc2liaWxpdHk6aGlkZGVuO2hlaWdodDowcHhcIj5cbiAgICAgICAgICA8cGFwZXItZHJvcGRvd24tbWVudSBzdHlsZT1cIndpZHRoOiAxMjBweFwiIG5vLWFuaW1hdGlvbnMgbGFiZWw9XCJBcmNoaXRlY3R1cmVcIj5cbiAgICAgICAgICAgIDxwYXBlci1saXN0Ym94IGF0dHItZm9yLXNlbGVjdGVkPVwidmFsdWVcIiBjbGFzcz1cImRyb3Bkb3duLWNvbnRlbnRcIiBzZWxlY3RlZD1cInt7c2VsZWN0ZWRBcmNoaXRlY3R1cmV9fVwiXG4gICAgICAgICAgICAgIHNsb3Q9XCJkcm9wZG93bi1jb250ZW50XCI+XG4gICAgICAgICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1yZXBlYXRcIiBpdGVtcz1cIltbYXJjaGl0ZWN0dXJlTGlzdF1dXCI+XG4gICAgICAgICAgICAgICAgPHBhcGVyLWl0ZW0gdmFsdWU9XCJbW2l0ZW1dXVwiIGxhYmVsPVwiW1tpdGVtXV1cIj5cbiAgICAgICAgICAgICAgICAgIFtbaXRlbV1dXG4gICAgICAgICAgICAgICAgPC9wYXBlci1pdGVtPlxuICAgICAgICAgICAgICA8L3RlbXBsYXRlPlxuICAgICAgICAgICAgPC9wYXBlci1saXN0Ym94PlxuICAgICAgICAgIDwvcGFwZXItZHJvcGRvd24tbWVudT5cbiAgICAgICAgICA8cGFwZXItZHJvcGRvd24tbWVudSBzdHlsZT1cIndpZHRoOiAxMjBweFwiIG5vLWFuaW1hdGlvbnMgbGFiZWw9XCJMZWFybmluZyBSYXRlXCI+XG4gICAgICAgICAgICA8cGFwZXItbGlzdGJveCBhdHRyLWZvci1zZWxlY3RlZD1cInZhbHVlXCIgY2xhc3M9XCJkcm9wZG93bi1jb250ZW50XCIgc2VsZWN0ZWQ9XCJ7e3NlbGVjdGVkTHJ9fVwiXG4gICAgICAgICAgICAgIHNsb3Q9XCJkcm9wZG93bi1jb250ZW50XCI+XG4gICAgICAgICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1yZXBlYXRcIiBpdGVtcz1cIltbbGVhcm5pbmdSYXRlTGlzdF1dXCI+XG4gICAgICAgICAgICAgICAgPHBhcGVyLWl0ZW0gdmFsdWU9XCJbW2l0ZW1dXVwiIGxhYmVsPVwiW1tpdGVtXV1cIj5cbiAgICAgICAgICAgICAgICAgIFtbaXRlbV1dXG4gICAgICAgICAgICAgICAgPC9wYXBlci1pdGVtPlxuICAgICAgICAgICAgICA8L3RlbXBsYXRlPlxuICAgICAgICAgICAgPC9wYXBlci1saXN0Ym94PlxuICAgICAgICAgIDwvcGFwZXItZHJvcGRvd24tbWVudT5cbiAgICAgICAgICA8cGFwZXItZHJvcGRvd24tbWVudSBzdHlsZT1cIndpZHRoOiAxMjBweFwiIG5vLWFuaW1hdGlvbnMgbGFiZWw9XCJUb3RhbCBFcG9jaFwiPlxuICAgICAgICAgICAgPHBhcGVyLWxpc3Rib3ggYXR0ci1mb3Itc2VsZWN0ZWQ9XCJ2YWx1ZVwiIGNsYXNzPVwiZHJvcGRvd24tY29udGVudFwiIHNlbGVjdGVkPVwie3tzZWxlY3RlZFRvdGFsRXBvY2h9fVwiXG4gICAgICAgICAgICAgIHNsb3Q9XCJkcm9wZG93bi1jb250ZW50XCI+XG4gICAgICAgICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1yZXBlYXRcIiBpdGVtcz1cIltbdG90YWxFcG9jaExpc3RdXVwiPlxuICAgICAgICAgICAgICAgIDxwYXBlci1pdGVtIHZhbHVlPVwiW1tpdGVtXV1cIiBsYWJlbD1cIltbaXRlbV1dXCI+XG4gICAgICAgICAgICAgICAgICBbW2l0ZW1dXVxuICAgICAgICAgICAgICAgIDwvcGFwZXItaXRlbT5cbiAgICAgICAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgICAgICAgIDwvcGFwZXItbGlzdGJveD5cbiAgICAgICAgICA8L3BhcGVyLWRyb3Bkb3duLW1lbnU+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICA8L3RlbXBsYXRlPlxuICAgICAgPHRhYmxlIHN0eWxlPVwid2lkdGg6MTY0cHhcIj5cbiAgICAgICAgPGNhcHRpb24gc3R5bGU9XCJtYXJnaW4tYm90dG9tOiAxMHB4OyBmb250LXdlaWdodDogNjAwO1wiPlxuICAgICAgICA8aDI+VGFzayBNb2RlbCBBY2N1cmFjeTwvaDI+XG4gICAgICAgIDwvY2FwdGlvbj5cbiAgICAgICAgPHRyPlxuICAgICAgICAgIDx0ZD5UcmFpbiBBY2M8L3RkPlxuICAgICAgICAgIDx0ZD5UZXN0IEFjYzwvdGQ+XG4gICAgICAgIDwvdHI+XG4gICAgICAgIDx0cj5cbiAgICAgICAgICA8dGQ+PHNwYW4gY2xhc3M9XCJ0b3RhbF9hY2NfdHJhaW5cIj5OQTwvc3Bhbj48L3RkPlxuICAgICAgICAgIDx0ZD48c3BhbiBjbGFzcz1cInRvdGFsX2FjY190ZXN0XCI+TkE8L3NwYW4+PC90ZD5cbiAgICAgICAgPC90cj5cblxuXG5cbiAgICAgIDwvdGFibGU+XG4gICAgICA8IS0tPHAgc3R5bGU9XCJmb250LXdlaWdodDogNjAwO1wiPlRhc2sgTW9kZWwgQWNjdXJhY3k6PC9wPlxuICAgICAgPHAgc3R5bGU9XCJmb250LXNpemU6MjBweDtcIj50cmFpbjogPHNwYW4gY2xhc3M9XCJ0b3RhbF9hY2NfdHJhaW5cIj5OQTwvc3Bhbj4gdGVzdDogPHNwYW5cbiAgICAgICAgICBjbGFzcz1cInRvdGFsX2FjY190ZXN0XCI+TkE8L3NwYW4+PC9wPi0tPlxuICAgIDwvZGl2PlxuICAgIDxwIGlkPVwidHNuZS1zYW1wbGluZ1wiIGNsYXNzPVwibm90aWNlXCI+XG4gICAgPC9wPlxuICA8L2Rpdj5cbiAgPCEtLSBQQ0EgQ29udHJvbHMgLS0+XG4gIDxkaXYgZGF0YS1wYW5lbD1cInBjYVwiIGNsYXNzPVwiaW5rLXBhbmVsLWNvbnRlbnRcIj5cbiAgICA8ZGl2IGNsYXNzPVwidHdvLWNvbHVtbnNcIj5cbiAgICAgIDxkaXY+XG4gICAgICAgIDwhLS0gTGVmdCBjb2x1bW4gLS0+XG4gICAgICAgIDxwYXBlci1kcm9wZG93bi1tZW51IGNsYXNzPVwicGNhLWRyb3Bkb3duXCIgdmVydGljYWwtYWxpZ249XCJib3R0b21cIiBuby1hbmltYXRpb25zIGxhYmVsPVwiWFwiPlxuICAgICAgICAgIDxwYXBlci1saXN0Ym94IGF0dHItZm9yLXNlbGVjdGVkPVwidmFsdWVcIiBjbGFzcz1cImRyb3Bkb3duLWNvbnRlbnRcIiBzZWxlY3RlZD1cInt7cGNhWH19XCIgc2xvdD1cImRyb3Bkb3duLWNvbnRlbnRcIj5cbiAgICAgICAgICAgIDxwYXBlci1pdGVtIGRpc2FibGVkIGNsYXNzPVwiZHJvcGRvd24taXRlbSBoZWFkZXJcIj5cbiAgICAgICAgICAgICAgPGRpdj4jPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXY+VmFyaWFuY2UgKCUpPC9kaXY+XG4gICAgICAgICAgICA8L3BhcGVyLWl0ZW0+XG4gICAgICAgICAgICA8dGVtcGxhdGUgaXM9XCJkb20tcmVwZWF0XCIgaXRlbXM9XCJbW3BjYUNvbXBvbmVudHNdXVwiPlxuICAgICAgICAgICAgICA8cGFwZXItaXRlbSBjbGFzcz1cImRyb3Bkb3duLWl0ZW1cIiB2YWx1ZT1cIltbaXRlbS5pZF1dXCIgbGFiZWw9XCJDb21wb25lbnQgI1tbaXRlbS5jb21wb25lbnROdW1iZXJdXVwiPlxuICAgICAgICAgICAgICAgIDxkaXY+W1tpdGVtLmNvbXBvbmVudE51bWJlcl1dPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIml0ZW0tZGV0YWlsc1wiPltbaXRlbS5wZXJjVmFyaWFuY2VdXTwvZGl2PlxuICAgICAgICAgICAgICA8L3BhcGVyLWl0ZW0+XG4gICAgICAgICAgICA8L3RlbXBsYXRlPlxuICAgICAgICAgIDwvcGFwZXItbGlzdGJveD5cbiAgICAgICAgPC9wYXBlci1kcm9wZG93bi1tZW51PlxuICAgICAgICA8cGFwZXItZHJvcGRvd24tbWVudSBjbGFzcz1cInBjYS1kcm9wZG93blwiIG5vLWFuaW1hdGlvbnMgdmVydGljYWwtYWxpZ249XCJib3R0b21cIiBsYWJlbD1cIlpcIlxuICAgICAgICAgIGRpc2FibGVkPVwiW1shaGFzUGNhWl1dXCIgaWQ9XCJ6LWRyb3Bkb3duXCI+XG4gICAgICAgICAgPHBhcGVyLWxpc3Rib3ggYXR0ci1mb3Itc2VsZWN0ZWQ9XCJ2YWx1ZVwiIGNsYXNzPVwiZHJvcGRvd24tY29udGVudFwiIHNlbGVjdGVkPVwie3twY2FafX1cIiBzbG90PVwiZHJvcGRvd24tY29udGVudFwiPlxuICAgICAgICAgICAgPHBhcGVyLWl0ZW0gZGlzYWJsZWQgY2xhc3M9XCJkcm9wZG93bi1pdGVtIGhlYWRlclwiPlxuICAgICAgICAgICAgICA8ZGl2PiM8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdj5WYXJpYW5jZSAoJSk8L2Rpdj5cbiAgICAgICAgICAgIDwvcGFwZXItaXRlbT5cbiAgICAgICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1yZXBlYXRcIiBpdGVtcz1cIltbcGNhQ29tcG9uZW50c11dXCI+XG4gICAgICAgICAgICAgIDxwYXBlci1pdGVtIGNsYXNzPVwiZHJvcGRvd24taXRlbVwiIHZhbHVlPVwiW1tpdGVtLmlkXV1cIiBsYWJlbD1cIkNvbXBvbmVudCAjW1tpdGVtLmNvbXBvbmVudE51bWJlcl1dXCI+XG4gICAgICAgICAgICAgICAgPGRpdj5bW2l0ZW0uY29tcG9uZW50TnVtYmVyXV08L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaXRlbS1kZXRhaWxzXCI+W1tpdGVtLnBlcmNWYXJpYW5jZV1dPC9kaXY+XG4gICAgICAgICAgICAgIDwvcGFwZXItaXRlbT5cbiAgICAgICAgICAgIDwvdGVtcGxhdGU+XG4gICAgICAgICAgPC9wYXBlci1saXN0Ym94PlxuICAgICAgICA8L3BhcGVyLWRyb3Bkb3duLW1lbnU+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXY+XG4gICAgICAgIDwhLS0gUmlnaHQgY29sdW1uIC0tPlxuICAgICAgICA8cGFwZXItZHJvcGRvd24tbWVudSBjbGFzcz1cInBjYS1kcm9wZG93blwiIHZlcnRpY2FsLWFsaWduPVwiYm90dG9tXCIgbm8tYW5pbWF0aW9ucyBsYWJlbD1cIllcIj5cbiAgICAgICAgICA8cGFwZXItbGlzdGJveCBhdHRyLWZvci1zZWxlY3RlZD1cInZhbHVlXCIgY2xhc3M9XCJkcm9wZG93bi1jb250ZW50XCIgc2VsZWN0ZWQ9XCJ7e3BjYVl9fVwiIHNsb3Q9XCJkcm9wZG93bi1jb250ZW50XCI+XG4gICAgICAgICAgICA8cGFwZXItaXRlbSBkaXNhYmxlZCBjbGFzcz1cImRyb3Bkb3duLWl0ZW0gaGVhZGVyXCI+XG4gICAgICAgICAgICAgIDxkaXY+IzwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2PlZhcmlhbmNlICglKTwvZGl2PlxuICAgICAgICAgICAgPC9wYXBlci1pdGVtPlxuICAgICAgICAgICAgPHRlbXBsYXRlIGlzPVwiZG9tLXJlcGVhdFwiIGl0ZW1zPVwiW1twY2FDb21wb25lbnRzXV1cIj5cbiAgICAgICAgICAgICAgPHBhcGVyLWl0ZW0gY2xhc3M9XCJkcm9wZG93bi1pdGVtXCIgdmFsdWU9XCJbW2l0ZW0uaWRdXVwiIGxhYmVsPVwiQ29tcG9uZW50ICNbW2l0ZW0uY29tcG9uZW50TnVtYmVyXV1cIj5cbiAgICAgICAgICAgICAgICA8ZGl2PltbaXRlbS5jb21wb25lbnROdW1iZXJdXTwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJpdGVtLWRldGFpbHNcIj5bW2l0ZW0ucGVyY1ZhcmlhbmNlXV08L2Rpdj5cbiAgICAgICAgICAgICAgPC9wYXBlci1pdGVtPlxuICAgICAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgICAgICA8L3BhcGVyLWxpc3Rib3g+XG4gICAgICAgIDwvcGFwZXItZHJvcGRvd24tbWVudT5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxwIGlkPVwicGNhLXNhbXBsaW5nXCIgY2xhc3M9XCJub3RpY2VcIj5cbiAgICAgIFBDQSBpcyBhcHByb3hpbWF0ZS5cbiAgICAgIDxwYXBlci1pY29uLWJ1dHRvbiBpY29uPVwiaGVscFwiIGNsYXNzPVwiaGVscC1pY29uXCI+PC9wYXBlci1pY29uLWJ1dHRvbj5cbiAgICA8L3A+XG4gICAgPGRpdiBpZD1cInRvdGFsLXZhcmlhbmNlXCI+VG90YWwgdmFyaWFuY2U8L2Rpdj5cbiAgICA8cGFwZXItdG9vbHRpcCBmb3I9XCJwY2Etc2FtcGxpbmdcIiBwb3NpdGlvbj1cInRvcFwiIGFuaW1hdGlvbi1kZWxheT1cIjBcIiBmaXQtdG8tdmlzaWJsZS1ib3VuZHM+XG4gICAgICBGb3IgZmFzdCByZXN1bHRzLCB0aGUgZGF0YSB3YXMgc2FtcGxlZCB0byBbW2dldFBjYVNhbXBsZVNpemVUZXh0KCldXVxuICAgICAgcG9pbnRzIGFuZCByYW5kb21seSBwcm9qZWN0ZWQgZG93biB0byBbW2dldFBjYVNhbXBsZWREaW1UZXh0KCldXVxuICAgICAgZGltZW5zaW9ucy5cbiAgICA8L3BhcGVyLXRvb2x0aXA+XG4gIDwvZGl2PlxuICA8IS0tIEN1c3RvbSBDb250cm9scyAtLT5cbiAgPGRpdiBkYXRhLXBhbmVsPVwiY3VzdG9tXCIgY2xhc3M9XCJpbmstcGFuZWwtY29udGVudFwiPlxuICAgIDxwYXBlci1kcm9wZG93bi1tZW51IHN0eWxlPVwid2lkdGg6IDEwMCVcIiBuby1hbmltYXRpb25zIGxhYmVsPVwiU2VhcmNoIGJ5XCI+XG4gICAgICA8cGFwZXItbGlzdGJveCBhdHRyLWZvci1zZWxlY3RlZD1cInZhbHVlXCIgY2xhc3M9XCJkcm9wZG93bi1jb250ZW50XCJcbiAgICAgICAgc2VsZWN0ZWQ9XCJ7e2N1c3RvbVNlbGVjdGVkU2VhcmNoQnlNZXRhZGF0YU9wdGlvbn19XCIgc2xvdD1cImRyb3Bkb3duLWNvbnRlbnRcIj5cbiAgICAgICAgPHRlbXBsYXRlIGlzPVwiZG9tLXJlcGVhdFwiIGl0ZW1zPVwiW1tzZWFyY2hCeU1ldGFkYXRhT3B0aW9uc11dXCI+XG4gICAgICAgICAgPHBhcGVyLWl0ZW0gY2xhc3M9XCJkcm9wZG93bi1pdGVtXCIgdmFsdWU9XCJbW2l0ZW1dXVwiIGxhYmVsPVwiW1tpdGVtXV1cIj5cbiAgICAgICAgICAgIFtbaXRlbV1dXG4gICAgICAgICAgPC9wYXBlci1pdGVtPlxuICAgICAgICA8L3RlbXBsYXRlPlxuICAgICAgPC9wYXBlci1saXN0Ym94PlxuICAgIDwvcGFwZXItZHJvcGRvd24tbWVudT5cbiAgICA8ZGl2IGNsYXNzPVwidHdvLWNvbHVtbnNcIj5cbiAgICAgIDx2ei1wcm9qZWN0b3ItaW5wdXQgaWQ9XCJ4TGVmdFwiIGxhYmVsPVwiTGVmdFwiPjwvdnotcHJvamVjdG9yLWlucHV0PlxuICAgICAgPHZ6LXByb2plY3Rvci1pbnB1dCBpZD1cInhSaWdodFwiIGxhYmVsPVwiUmlnaHRcIj48L3Z6LXByb2plY3Rvci1pbnB1dD5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwidHdvLWNvbHVtbnNcIj5cbiAgICAgIDx2ei1wcm9qZWN0b3ItaW5wdXQgaWQ9XCJ5VXBcIiBsYWJlbD1cIlVwXCI+PC92ei1wcm9qZWN0b3ItaW5wdXQ+XG4gICAgICA8dnotcHJvamVjdG9yLWlucHV0IGlkPVwieURvd25cIiBsYWJlbD1cIkRvd25cIj48L3Z6LXByb2plY3Rvci1pbnB1dD5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+XG48L2Rpdj5cbjwvZGl2PlxuPC90ZW1wbGF0ZT5cbjxzY3JpcHQgc3JjPVwidnotcHJvamVjdG9yLXByb2plY3Rpb25zLXBhbmVsLmpzXCI+PC9zY3JpcHQ+XG48L2RvbS1tb2R1bGU+XG5gO1xuIl19