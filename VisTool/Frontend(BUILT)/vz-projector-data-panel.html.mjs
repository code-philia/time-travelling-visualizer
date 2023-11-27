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
import '../components/tf_wbr_string/tf-wbr-string';
export const template = html `
  <style include="vz-projector-styles"></style>
  <style>
    .container {
      padding: 5px 20px 20px 20px;
    }

    input[type='file'] {
      display: none;
    }

    .file-name {
      margin-right: 10px;
    }

    .dirs {
      color: rgba(0, 0, 0, 0.7);
      font-size: 12px;
    }

    .dirs table tr {
      vertical-align: top;
    }

    .dirs table tr td {
      padding-bottom: 10px;
    }
    

    paper-item {
      --paper-item-disabled: {
        border-bottom: 1px solid black;
        justify-content: center;
        font-size: 12px;
        line-height: normal;
        min-height: 0px;
      }
    }

    .item-details {
      margin-left: 5px;
      color: gray;
      font-size: 12px;
    }

    paper-input {
      font-size: 15px;
      --paper-input-container: {
        padding: 5px 0;
      }
      --paper-input-container-label-floating: {
        white-space: normal;
        line-height: normal;
      }
    }

    paper-dropdown-menu {
      width: 100%;
      --paper-input-container: {
        padding: 5px 0;
      }
      --paper-input-container-input: {
        font-size: 15px;
      }
      --paper-input-container-label-floating: {
        white-space: normal;
        line-height: normal;
      }
    }

    paper-dropdown-menu paper-item {
      justify-content: space-between;
    }

    .title {
      align-items: center;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      color: black;
      display: flex;
      font-weight: 500;
      height: 59px;
      padding-left: 20px;
    }

    #normalize-data-checkbox {
      margin: 10px 0;
    }

    #projector-config-template {
      --paper-input-container-input: {
        line-height: 13px;
        font-family: monospace;
        font-size: 12px;
      }
    }

    #generate-share-url {
      padding: 16px;
      margin-left: 24px;
    }

    #projector-share-button-container {
      margin: 10px 0;
    }

    .metadata-editor,
    .supervise-settings,
    .colorlabel-container,
    .subject-model-path-editor,
    .iteration-setting-editor,
    .misc-setting-editor {
      display: flex;
    }
    
    .iteration-setting-editor,
    .misc-setting-editor {
      justify-content: space-between;
    }
    
    #labelby {
      width: 100px;
      margin-right: 10px;
    }

    #colorby {
      width: calc(100% - 110px);
    }

    [hidden] {
      display: none;
    }

    .supervise-settings paper-dropdown-menu {
      width: 100px;
      margin-right: 10px;
    }

    .supervise-settings paper-input {
      width: calc(100% - 110px);
    }

    .metadata-editor paper-dropdown-menu {
      width: 100px;
      margin-right: 10px;
    }

    .metadata-editor paper-input {
      width: calc(100% - 110px);
    }
    
    .subject-model-path-editor paper-input {
       width: 100%;
    }
    
    .iteration-setting-editor paper-input {
       width: 45%;
    }
    
    .misc-setting-editor paper-input {
       width: 45%;
    }

    .config-checkbox {
      display: inline-block;
      font-size: 11px;
      margin-left: 10px;
    }

    .projector-config-options {
      margin-top: 12px;
    }

    .projector-config-dialog-container {
      padding: 24px;
    }

    .code {
      background-color: #f7f7f7;
      display: table;
      font-family: monospace;
      margin-top: 7px;
      padding: 15px;
    }

    .delimiter {
      color: #b71c1c;
    }

    .button-container {
      flex: 1 100%;
      margin-right: 5px;
    }

    .button-container paper-button {
      min-width: 50px;
      width: 100%;
    }

    #label-button {
      margin-right: 0px;
    }

    .upload-step {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .upload-step paper-button {
      margin-left: 30px;
    }

    .step-label {
      color: rgb(38, 180, 226);
    }

    .scrollable-container {
      margin-top: 0;
      min-width: 400px;
    }

    #projectorConfigDialog p {
      margin: 8px 0 8px;
    }

    .data-step {
      margin-top: 40px;
    }

    .data-step-contents {
      display: table;
      width: 100%;
    }

    .data-step-contents-contents {
      display: table-cell;
      margin-top: 6px;
    }

    .data-step-contents-upload {
      display: table-cell;
      text-align: right;
      vertical-align: bottom;
    }

    #demo-data-buttons-container {
      display: none;
      margin-top: 10px;
    }
  </style>
  <div class="title">DATA</div>
  <div class="container">
    <!-- List of runs -->
    <template is="dom-if" if="[[_hasChoices(runNames)]]">
      <paper-dropdown-menu
        no-animations
        label="[[_getNumRunsLabel(runNames)]] found"
      >
        <paper-listbox
          attr-for-selected="value"
          class="dropdown-content"
          selected="{{selectedRun}}"
          slot="dropdown-content"
        >
          <template is="dom-repeat" items="[[runNames]]">
            <paper-item value="[[item]]" label="[[item]]">
              [[item]]
            </paper-item>
          </template>
        </paper-listbox>
      </paper-dropdown-menu>
    </template>

    <template is="dom-if" if="[[tensorNames]]">
      <!-- List of tensors in checkpoint -->
      <paper-dropdown-menu
        no-animations
        label="[[_getNumTensorsLabel(tensorNames)]] found"
      >
        <paper-listbox
          attr-for-selected="value"
          class="dropdown-content"
          selected="{{selectedTensor}}"
          slot="dropdown-content"
        >
          <template is="dom-repeat" items="[[tensorNames]]">
            <paper-item value="[[item.name]]" label="[[item.name]]">
              [[item.name]]
              <span class="item-details">
                [[item.shape.0]]x[[item.shape.1]]
              </span>
            </paper-item>
          </template>
        </paper-listbox>
      </paper-dropdown-menu>
    </template>

    <div hidden$="[[!_hasChoices(colorOptions)]]">
      <div class="colorlabel-container">
        <!-- Label by -->
        <paper-dropdown-menu id="labelby" no-animations label="Label by">
          <paper-listbox
            attr-for-selected="value"
            class="dropdown-content"
            selected="{{selectedLabelOption}}"
            slot="dropdown-content"
          >
            <template is="dom-repeat" items="[[labelOptions]]">
              <paper-item value="[[item]]" label="[[item]]">
                [[item]]
              </paper-item>
            </template>
          </paper-listbox>
        </paper-dropdown-menu>
        <!-- Color by -->
        <paper-dropdown-menu id="colorby" no-animations label="Color by">
          <paper-listbox
            attr-for-selected="value"
            class="dropdown-content"
            selected="{{selectedColorOptionName}}"
            slot="dropdown-content"
          >
            <template is="dom-repeat" items="[[colorOptions]]">
              <paper-item
                class$="[[getSeparatorClass(item.isSeparator)]]"
                value="[[item.name]]"
                label="[[item.name]]"
                disabled="[[item.isSeparator]]"
              >
                [[item.name]]
                <span class="item-details">[[item.desc]]</span>
              </paper-item>
            </template>
          </paper-listbox>
        </paper-dropdown-menu>
      </div>
      <div hidden$="[[!showForceCategoricalColorsCheckbox]]">
        <paper-checkbox id="force-categorical-checkbox"
          >Use categorical coloring</paper-checkbox
        >
        <paper-icon-button icon="help" class="help-icon"></paper-icon-button>
        <paper-tooltip
          position="bottom"
          animation-delay="0"
          fit-to-visible-bounds
        >
          For metadata fields that have many unique values we use a gradient
          color map by default. This checkbox allows you to force categorical
          coloring by a given metadata field.
        </paper-tooltip>
      </div>
      <template dom-if="[[colorLegendRenderInfo]]">
        <vz-projector-legend
          render-info="[[colorLegendRenderInfo]]"
        ></vz-projector-legend>
      </template>
    </div>
    <template is="dom-if" if="[[_hasChoice(labelOptions)]]">
      <!-- Supervise by -->
      <div hidden$="[[!showSuperviseSettings]]" class="supervise-settings">
        <paper-dropdown-menu no-animations label="Supervise with">
          <paper-listbox
            attr-for-selected="value"
            class="dropdown-content"
            on-selected-item-changed="superviseColumnChanged"
            selected="{{superviseColumn}}"
            slot="dropdown-content"
          >
            <template is="dom-repeat" items="[[metadataFields]]">
              <paper-item value="[[item]]" label="[[item]]">
                [[item]]
              </paper-item>
            </template>
          </paper-listbox>
        </paper-dropdown-menu>
        <paper-input
          value="{{superviseInput}}"
          label="{{superviseInputLabel}}"
          on-change="superviseInputChange"
          on-input="superviseInputTyping"
        >
        </paper-input>
      </div>
      <!-- Edit by -->
      <div hidden$="[[!showEditSettings]]" class="metadata-editor">
        <paper-dropdown-menu no-animations label="Edit by">
          <paper-listbox
            attr-for-selected="value"
            class="dropdown-content"
            slot="dropdown-content"
            on-selected-item-changed="metadataEditorColumnChange"
            selected="{{metadataEditorColumn}}"
          >
            <template is="dom-repeat" items="[[metadataFields]]">
              <paper-item value="[[item]]" label="[[item]]">
                [[item]]
              </paper-item>
            </template>
          </paper-listbox>
        </paper-dropdown-menu>
        <paper-input
          value="{{metadataEditorInput}}"
          label="{{metadataEditorInputLabel}}"
          on-input="metadataEditorInputChange"
          on-keydown="metadataEditorInputKeydown"
        >
        </paper-input>
      </div>
    </template>
    <div id="demo-data-buttons-container">
      <span class="button-container">
        <paper-tooltip
          position="bottom"
          animation-delay="0"
          fit-to-visible-bounds
        >
          Load data from your computer
        </paper-tooltip>
        <paper-button id="upload" class="ink-button" on-tap="_openDataDialog"
          >Load</paper-button
        >
      </span>
    </div>
    <div>
      <paper-dialog id="dataDialog" with-backdrop>
        <h2>Load data from your computer</h2>
        <paper-dialog-scrollable class="scrollable-container">
          <div class="data-step" id="upload-tensors-step-container">
            <div class="upload-step">
              <div>
                <b
                  ><span class="step-label">Step 1:</span> Load a TSV file of
                  vectors.</b
                >
              </div>
            </div>
            <div class="data-step-contents">
              <div class="data-step-contents-contents">
                Example of 3 vectors with dimension 4:
                <div class="code">
                  0.1<span class="delimiter"> </span>0.2<span class="delimiter">
                  </span
                  >0.5<span class="delimiter"> </span>0.9<br />
                  0.2<span class="delimiter"> </span>0.1<span class="delimiter">
                  </span
                  >5.0<span class="delimiter"> </span>0.2<br />
                  0.4<span class="delimiter"> </span>0.1<span class="delimiter">
                  </span
                  >7.0<span class="delimiter"> </span>0.8
                </div>
              </div>
              <div class="data-step-contents-upload">
                <paper-button
                  id="upload-tensors"
                  title="Choose a TSV tensor file"
                  >Choose file</paper-button
                >
                <input type="file" id="file" name="file" />
              </div>
            </div>
          </div>
          <div class="data-step">
            <div class="upload-step">
              <div>
                <span class="step-label" id="upload-metadata-label"
                  ><b>Step 2</b> (optional):</span
                >
                <b>Load a TSV file of metadata.</b>
              </div>
            </div>
            <div class="data-step-contents">
              <div class="data-step-contents-contents">
                Example of 3 data points and 2 columns.<br />
                <i
                  >Note: If there is more than one column, the first row will be
                  parsed as column labels.</i
                >
                <div class="code">
                  <b>Pokémon<span class="delimiter"> </span>Species</b><br />
                  Wartortle<span class="delimiter"> </span>Turtle<br />
                  Venusaur<span class="delimiter"> </span>Seed<br />
                  Charmeleon<span class="delimiter"> </span>Flame
                </div>
              </div>
              <div class="data-step-contents-upload">
                <paper-button
                  id="upload-metadata"
                  title="Choose a TSV metadata file"
                  class="ink-button"
                  >Choose file</paper-button
                >
                <input type="file" id="file-metadata" name="file-metadata" />
              </div>
            </div>
          </div>
        </paper-dialog-scrollable>
        <div class="dismiss-dialog-note">Click outside to dismiss.</div>
      </paper-dialog>
      <paper-dialog id="projectorConfigDialog" with-backdrop>
        <h2>Publish your embedding visualization and data</h2>
        <paper-dialog-scrollable class="scrollable-container">
          <div>
            <p>
              If you'd like to share your visualization with the world, follow
              these simple steps. See
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://www.tensorflow.org/get_started/embedding_viz"
                >this tutorial</a
              >
              for more.
            </p>
            <h4><span class="step-label">Step 1:</span> Make data public</h4>
            <p>
              Host tensors, metadata, sprite image, and bookmarks TSV files
              <i>publicly</i> on the web.
            </p>
            <p>
              One option is using a
              <a
                target="_blank"
                href="https://gist.github.com/"
                rel="noopener noreferrer"
                >github gist</a
              >. If you choose this approach, make sure to link directly to the
              raw file.
            </p>
          </div>
          <div>
            <h4><span class="step-label">Step 2:</span> Projector config</h4>
            <div class="projector-config-options">
              <i>Optional:</i>
              <div class="config-checkbox">
                <paper-checkbox id="config-metadata-checkbox" checked
                  >Metadata</paper-checkbox
                >
              </div>
              <div class="config-checkbox">
                <paper-checkbox id="config-sprite-checkbox"
                  >Sprite</paper-checkbox
                >
              </div>
              <div class="config-checkbox">
                <paper-checkbox id="config-bookmarks-checkbox"
                  >Bookmarks</paper-checkbox
                >
              </div>
            </div>
          </div>
          <paper-textarea
            id="projector-config-template"
            label="template_projector_config.json"
          ></paper-textarea>
          <div>
            <h4>
              <span class="step-label">Step 3:</span> Host projector config
            </h4>
            After you have hosted the projector config JSON file you built
            above, paste the URL to the config below.
          </div>
          <paper-input
            id="projector-config-url"
            label="Path to projector config"
          ></paper-input>
          <paper-input
            id="projector-share-url"
            label="Your shareable URL"
            readonly
          ></paper-input>
          <div id="projector-share-button-container">
            <a
              target="_blank"
              id="projector-share-url-link"
              rel="noopener noreferrer"
            >
              <paper-button title="Test your shareable URL" class="ink-button"
                >Test your shareable URL</paper-button
              >
            </a>
          </div>
        </paper-dialog-scrollable>
        <div class="dismiss-dialog-note">Click outside to dismiss.</div>
      </paper-dialog>
    </div>
    <paper-checkbox id="normalize-data-checkbox" hidden$="[[!showNormalizeDataCheckbox]]" checked="{{normalizeData}}">
      Sphereize data
      <paper-icon-button icon="help" class="help-icon"></paper-icon-button>
      <paper-tooltip
        position="bottom"
        animation-delay="0"
        fit-to-visible-bounds
      >
        The data is normalized by shifting each point by the centroid and making
        it unit norm.
      </paper-tooltip>
    </paper-checkbox>
    <div class="dirs">
      <table>
        <tr>
          <td>Checkpoint:</td>
          <td>
            <span id="checkpoint-file">
              <tf-wbr-string
                title="[[projectorConfig.modelCheckpointPath]]"
                delimiter-pattern="[[_wordDelimiter]]"
                value="[[projectorConfig.modelCheckpointPath]]"
              ></tf-wbr-string>
            </span>
          </td>
        </tr>
        <tr>
          <td>Metadata:</td>
          <td>
            <span id="metadata-file">
              <tf-wbr-string
                title="[[metadataFile]]"
                delimiter-pattern="[[_wordDelimiter]]"
                value="[[metadataFile]]"
              ></tf-wbr-string>
            </span>
          </td>
        </tr>
      </table>
    </div>
  </div>
`;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLWRhdGEtcGFuZWwuaHRtbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3RlbnNvcmJvYXJkL3Byb2plY3Rvci92ei1wcm9qZWN0b3ItZGF0YS1wYW5lbC5odG1sLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7O2dGQWFnRjtBQUVoRixPQUFPLEVBQUMsSUFBSSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFFdEMsT0FBTyxVQUFVLENBQUM7QUFDbEIsT0FBTywyQ0FBMkMsQ0FBQztBQUVuRCxNQUFNLENBQUMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQWtuQjNCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBDb3B5cmlnaHQgMjAxNiBUaGUgVGVuc29yRmxvdyBBdXRob3JzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5cbmltcG9ydCB7aHRtbH0gZnJvbSAnQHBvbHltZXIvcG9seW1lcic7XG5cbmltcG9ydCAnLi9zdHlsZXMnO1xuaW1wb3J0ICcuLi9jb21wb25lbnRzL3RmX3dicl9zdHJpbmcvdGYtd2JyLXN0cmluZyc7XG5cbmV4cG9ydCBjb25zdCB0ZW1wbGF0ZSA9IGh0bWxgXG4gIDxzdHlsZSBpbmNsdWRlPVwidnotcHJvamVjdG9yLXN0eWxlc1wiPjwvc3R5bGU+XG4gIDxzdHlsZT5cbiAgICAuY29udGFpbmVyIHtcbiAgICAgIHBhZGRpbmc6IDVweCAyMHB4IDIwcHggMjBweDtcbiAgICB9XG5cbiAgICBpbnB1dFt0eXBlPSdmaWxlJ10ge1xuICAgICAgZGlzcGxheTogbm9uZTtcbiAgICB9XG5cbiAgICAuZmlsZS1uYW1lIHtcbiAgICAgIG1hcmdpbi1yaWdodDogMTBweDtcbiAgICB9XG5cbiAgICAuZGlycyB7XG4gICAgICBjb2xvcjogcmdiYSgwLCAwLCAwLCAwLjcpO1xuICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgIH1cblxuICAgIC5kaXJzIHRhYmxlIHRyIHtcbiAgICAgIHZlcnRpY2FsLWFsaWduOiB0b3A7XG4gICAgfVxuXG4gICAgLmRpcnMgdGFibGUgdHIgdGQge1xuICAgICAgcGFkZGluZy1ib3R0b206IDEwcHg7XG4gICAgfVxuICAgIFxuXG4gICAgcGFwZXItaXRlbSB7XG4gICAgICAtLXBhcGVyLWl0ZW0tZGlzYWJsZWQ6IHtcbiAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIGJsYWNrO1xuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgICBsaW5lLWhlaWdodDogbm9ybWFsO1xuICAgICAgICBtaW4taGVpZ2h0OiAwcHg7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLml0ZW0tZGV0YWlscyB7XG4gICAgICBtYXJnaW4tbGVmdDogNXB4O1xuICAgICAgY29sb3I6IGdyYXk7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgfVxuXG4gICAgcGFwZXItaW5wdXQge1xuICAgICAgZm9udC1zaXplOiAxNXB4O1xuICAgICAgLS1wYXBlci1pbnB1dC1jb250YWluZXI6IHtcbiAgICAgICAgcGFkZGluZzogNXB4IDA7XG4gICAgICB9XG4gICAgICAtLXBhcGVyLWlucHV0LWNvbnRhaW5lci1sYWJlbC1mbG9hdGluZzoge1xuICAgICAgICB3aGl0ZS1zcGFjZTogbm9ybWFsO1xuICAgICAgICBsaW5lLWhlaWdodDogbm9ybWFsO1xuICAgICAgfVxuICAgIH1cblxuICAgIHBhcGVyLWRyb3Bkb3duLW1lbnUge1xuICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAtLXBhcGVyLWlucHV0LWNvbnRhaW5lcjoge1xuICAgICAgICBwYWRkaW5nOiA1cHggMDtcbiAgICAgIH1cbiAgICAgIC0tcGFwZXItaW5wdXQtY29udGFpbmVyLWlucHV0OiB7XG4gICAgICAgIGZvbnQtc2l6ZTogMTVweDtcbiAgICAgIH1cbiAgICAgIC0tcGFwZXItaW5wdXQtY29udGFpbmVyLWxhYmVsLWZsb2F0aW5nOiB7XG4gICAgICAgIHdoaXRlLXNwYWNlOiBub3JtYWw7XG4gICAgICAgIGxpbmUtaGVpZ2h0OiBub3JtYWw7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcGFwZXItZHJvcGRvd24tbWVudSBwYXBlci1pdGVtIHtcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICB9XG5cbiAgICAudGl0bGUge1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDAsIDAsIDAsIDAuMSk7XG4gICAgICBjb2xvcjogYmxhY2s7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICAgIGhlaWdodDogNTlweDtcbiAgICAgIHBhZGRpbmctbGVmdDogMjBweDtcbiAgICB9XG5cbiAgICAjbm9ybWFsaXplLWRhdGEtY2hlY2tib3gge1xuICAgICAgbWFyZ2luOiAxMHB4IDA7XG4gICAgfVxuXG4gICAgI3Byb2plY3Rvci1jb25maWctdGVtcGxhdGUge1xuICAgICAgLS1wYXBlci1pbnB1dC1jb250YWluZXItaW5wdXQ6IHtcbiAgICAgICAgbGluZS1oZWlnaHQ6IDEzcHg7XG4gICAgICAgIGZvbnQtZmFtaWx5OiBtb25vc3BhY2U7XG4gICAgICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAjZ2VuZXJhdGUtc2hhcmUtdXJsIHtcbiAgICAgIHBhZGRpbmc6IDE2cHg7XG4gICAgICBtYXJnaW4tbGVmdDogMjRweDtcbiAgICB9XG5cbiAgICAjcHJvamVjdG9yLXNoYXJlLWJ1dHRvbi1jb250YWluZXIge1xuICAgICAgbWFyZ2luOiAxMHB4IDA7XG4gICAgfVxuXG4gICAgLm1ldGFkYXRhLWVkaXRvcixcbiAgICAuc3VwZXJ2aXNlLXNldHRpbmdzLFxuICAgIC5jb2xvcmxhYmVsLWNvbnRhaW5lcixcbiAgICAuc3ViamVjdC1tb2RlbC1wYXRoLWVkaXRvcixcbiAgICAuaXRlcmF0aW9uLXNldHRpbmctZWRpdG9yLFxuICAgIC5taXNjLXNldHRpbmctZWRpdG9yIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgfVxuICAgIFxuICAgIC5pdGVyYXRpb24tc2V0dGluZy1lZGl0b3IsXG4gICAgLm1pc2Mtc2V0dGluZy1lZGl0b3Ige1xuICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgIH1cbiAgICBcbiAgICAjbGFiZWxieSB7XG4gICAgICB3aWR0aDogMTAwcHg7XG4gICAgICBtYXJnaW4tcmlnaHQ6IDEwcHg7XG4gICAgfVxuXG4gICAgI2NvbG9yYnkge1xuICAgICAgd2lkdGg6IGNhbGMoMTAwJSAtIDExMHB4KTtcbiAgICB9XG5cbiAgICBbaGlkZGVuXSB7XG4gICAgICBkaXNwbGF5OiBub25lO1xuICAgIH1cblxuICAgIC5zdXBlcnZpc2Utc2V0dGluZ3MgcGFwZXItZHJvcGRvd24tbWVudSB7XG4gICAgICB3aWR0aDogMTAwcHg7XG4gICAgICBtYXJnaW4tcmlnaHQ6IDEwcHg7XG4gICAgfVxuXG4gICAgLnN1cGVydmlzZS1zZXR0aW5ncyBwYXBlci1pbnB1dCB7XG4gICAgICB3aWR0aDogY2FsYygxMDAlIC0gMTEwcHgpO1xuICAgIH1cblxuICAgIC5tZXRhZGF0YS1lZGl0b3IgcGFwZXItZHJvcGRvd24tbWVudSB7XG4gICAgICB3aWR0aDogMTAwcHg7XG4gICAgICBtYXJnaW4tcmlnaHQ6IDEwcHg7XG4gICAgfVxuXG4gICAgLm1ldGFkYXRhLWVkaXRvciBwYXBlci1pbnB1dCB7XG4gICAgICB3aWR0aDogY2FsYygxMDAlIC0gMTEwcHgpO1xuICAgIH1cbiAgICBcbiAgICAuc3ViamVjdC1tb2RlbC1wYXRoLWVkaXRvciBwYXBlci1pbnB1dCB7XG4gICAgICAgd2lkdGg6IDEwMCU7XG4gICAgfVxuICAgIFxuICAgIC5pdGVyYXRpb24tc2V0dGluZy1lZGl0b3IgcGFwZXItaW5wdXQge1xuICAgICAgIHdpZHRoOiA0NSU7XG4gICAgfVxuICAgIFxuICAgIC5taXNjLXNldHRpbmctZWRpdG9yIHBhcGVyLWlucHV0IHtcbiAgICAgICB3aWR0aDogNDUlO1xuICAgIH1cblxuICAgIC5jb25maWctY2hlY2tib3gge1xuICAgICAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgbWFyZ2luLWxlZnQ6IDEwcHg7XG4gICAgfVxuXG4gICAgLnByb2plY3Rvci1jb25maWctb3B0aW9ucyB7XG4gICAgICBtYXJnaW4tdG9wOiAxMnB4O1xuICAgIH1cblxuICAgIC5wcm9qZWN0b3ItY29uZmlnLWRpYWxvZy1jb250YWluZXIge1xuICAgICAgcGFkZGluZzogMjRweDtcbiAgICB9XG5cbiAgICAuY29kZSB7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjZjdmN2Y3O1xuICAgICAgZGlzcGxheTogdGFibGU7XG4gICAgICBmb250LWZhbWlseTogbW9ub3NwYWNlO1xuICAgICAgbWFyZ2luLXRvcDogN3B4O1xuICAgICAgcGFkZGluZzogMTVweDtcbiAgICB9XG5cbiAgICAuZGVsaW1pdGVyIHtcbiAgICAgIGNvbG9yOiAjYjcxYzFjO1xuICAgIH1cblxuICAgIC5idXR0b24tY29udGFpbmVyIHtcbiAgICAgIGZsZXg6IDEgMTAwJTtcbiAgICAgIG1hcmdpbi1yaWdodDogNXB4O1xuICAgIH1cblxuICAgIC5idXR0b24tY29udGFpbmVyIHBhcGVyLWJ1dHRvbiB7XG4gICAgICBtaW4td2lkdGg6IDUwcHg7XG4gICAgICB3aWR0aDogMTAwJTtcbiAgICB9XG5cbiAgICAjbGFiZWwtYnV0dG9uIHtcbiAgICAgIG1hcmdpbi1yaWdodDogMHB4O1xuICAgIH1cblxuICAgIC51cGxvYWQtc3RlcCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgbWFyZ2luLWJvdHRvbTogNnB4O1xuICAgIH1cblxuICAgIC51cGxvYWQtc3RlcCBwYXBlci1idXR0b24ge1xuICAgICAgbWFyZ2luLWxlZnQ6IDMwcHg7XG4gICAgfVxuXG4gICAgLnN0ZXAtbGFiZWwge1xuICAgICAgY29sb3I6IHJnYigzOCwgMTgwLCAyMjYpO1xuICAgIH1cblxuICAgIC5zY3JvbGxhYmxlLWNvbnRhaW5lciB7XG4gICAgICBtYXJnaW4tdG9wOiAwO1xuICAgICAgbWluLXdpZHRoOiA0MDBweDtcbiAgICB9XG5cbiAgICAjcHJvamVjdG9yQ29uZmlnRGlhbG9nIHAge1xuICAgICAgbWFyZ2luOiA4cHggMCA4cHg7XG4gICAgfVxuXG4gICAgLmRhdGEtc3RlcCB7XG4gICAgICBtYXJnaW4tdG9wOiA0MHB4O1xuICAgIH1cblxuICAgIC5kYXRhLXN0ZXAtY29udGVudHMge1xuICAgICAgZGlzcGxheTogdGFibGU7XG4gICAgICB3aWR0aDogMTAwJTtcbiAgICB9XG5cbiAgICAuZGF0YS1zdGVwLWNvbnRlbnRzLWNvbnRlbnRzIHtcbiAgICAgIGRpc3BsYXk6IHRhYmxlLWNlbGw7XG4gICAgICBtYXJnaW4tdG9wOiA2cHg7XG4gICAgfVxuXG4gICAgLmRhdGEtc3RlcC1jb250ZW50cy11cGxvYWQge1xuICAgICAgZGlzcGxheTogdGFibGUtY2VsbDtcbiAgICAgIHRleHQtYWxpZ246IHJpZ2h0O1xuICAgICAgdmVydGljYWwtYWxpZ246IGJvdHRvbTtcbiAgICB9XG5cbiAgICAjZGVtby1kYXRhLWJ1dHRvbnMtY29udGFpbmVyIHtcbiAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICBtYXJnaW4tdG9wOiAxMHB4O1xuICAgIH1cbiAgPC9zdHlsZT5cbiAgPGRpdiBjbGFzcz1cInRpdGxlXCI+REFUQTwvZGl2PlxuICA8ZGl2IGNsYXNzPVwiY29udGFpbmVyXCI+XG4gICAgPCEtLSBMaXN0IG9mIHJ1bnMgLS0+XG4gICAgPHRlbXBsYXRlIGlzPVwiZG9tLWlmXCIgaWY9XCJbW19oYXNDaG9pY2VzKHJ1bk5hbWVzKV1dXCI+XG4gICAgICA8cGFwZXItZHJvcGRvd24tbWVudVxuICAgICAgICBuby1hbmltYXRpb25zXG4gICAgICAgIGxhYmVsPVwiW1tfZ2V0TnVtUnVuc0xhYmVsKHJ1bk5hbWVzKV1dIGZvdW5kXCJcbiAgICAgID5cbiAgICAgICAgPHBhcGVyLWxpc3Rib3hcbiAgICAgICAgICBhdHRyLWZvci1zZWxlY3RlZD1cInZhbHVlXCJcbiAgICAgICAgICBjbGFzcz1cImRyb3Bkb3duLWNvbnRlbnRcIlxuICAgICAgICAgIHNlbGVjdGVkPVwie3tzZWxlY3RlZFJ1bn19XCJcbiAgICAgICAgICBzbG90PVwiZHJvcGRvd24tY29udGVudFwiXG4gICAgICAgID5cbiAgICAgICAgICA8dGVtcGxhdGUgaXM9XCJkb20tcmVwZWF0XCIgaXRlbXM9XCJbW3J1bk5hbWVzXV1cIj5cbiAgICAgICAgICAgIDxwYXBlci1pdGVtIHZhbHVlPVwiW1tpdGVtXV1cIiBsYWJlbD1cIltbaXRlbV1dXCI+XG4gICAgICAgICAgICAgIFtbaXRlbV1dXG4gICAgICAgICAgICA8L3BhcGVyLWl0ZW0+XG4gICAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgICAgPC9wYXBlci1saXN0Ym94PlxuICAgICAgPC9wYXBlci1kcm9wZG93bi1tZW51PlxuICAgIDwvdGVtcGxhdGU+XG5cbiAgICA8dGVtcGxhdGUgaXM9XCJkb20taWZcIiBpZj1cIltbdGVuc29yTmFtZXNdXVwiPlxuICAgICAgPCEtLSBMaXN0IG9mIHRlbnNvcnMgaW4gY2hlY2twb2ludCAtLT5cbiAgICAgIDxwYXBlci1kcm9wZG93bi1tZW51XG4gICAgICAgIG5vLWFuaW1hdGlvbnNcbiAgICAgICAgbGFiZWw9XCJbW19nZXROdW1UZW5zb3JzTGFiZWwodGVuc29yTmFtZXMpXV0gZm91bmRcIlxuICAgICAgPlxuICAgICAgICA8cGFwZXItbGlzdGJveFxuICAgICAgICAgIGF0dHItZm9yLXNlbGVjdGVkPVwidmFsdWVcIlxuICAgICAgICAgIGNsYXNzPVwiZHJvcGRvd24tY29udGVudFwiXG4gICAgICAgICAgc2VsZWN0ZWQ9XCJ7e3NlbGVjdGVkVGVuc29yfX1cIlxuICAgICAgICAgIHNsb3Q9XCJkcm9wZG93bi1jb250ZW50XCJcbiAgICAgICAgPlxuICAgICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1yZXBlYXRcIiBpdGVtcz1cIltbdGVuc29yTmFtZXNdXVwiPlxuICAgICAgICAgICAgPHBhcGVyLWl0ZW0gdmFsdWU9XCJbW2l0ZW0ubmFtZV1dXCIgbGFiZWw9XCJbW2l0ZW0ubmFtZV1dXCI+XG4gICAgICAgICAgICAgIFtbaXRlbS5uYW1lXV1cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJpdGVtLWRldGFpbHNcIj5cbiAgICAgICAgICAgICAgICBbW2l0ZW0uc2hhcGUuMF1deFtbaXRlbS5zaGFwZS4xXV1cbiAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgPC9wYXBlci1pdGVtPlxuICAgICAgICAgIDwvdGVtcGxhdGU+XG4gICAgICAgIDwvcGFwZXItbGlzdGJveD5cbiAgICAgIDwvcGFwZXItZHJvcGRvd24tbWVudT5cbiAgICA8L3RlbXBsYXRlPlxuXG4gICAgPGRpdiBoaWRkZW4kPVwiW1shX2hhc0Nob2ljZXMoY29sb3JPcHRpb25zKV1dXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiY29sb3JsYWJlbC1jb250YWluZXJcIj5cbiAgICAgICAgPCEtLSBMYWJlbCBieSAtLT5cbiAgICAgICAgPHBhcGVyLWRyb3Bkb3duLW1lbnUgaWQ9XCJsYWJlbGJ5XCIgbm8tYW5pbWF0aW9ucyBsYWJlbD1cIkxhYmVsIGJ5XCI+XG4gICAgICAgICAgPHBhcGVyLWxpc3Rib3hcbiAgICAgICAgICAgIGF0dHItZm9yLXNlbGVjdGVkPVwidmFsdWVcIlxuICAgICAgICAgICAgY2xhc3M9XCJkcm9wZG93bi1jb250ZW50XCJcbiAgICAgICAgICAgIHNlbGVjdGVkPVwie3tzZWxlY3RlZExhYmVsT3B0aW9ufX1cIlxuICAgICAgICAgICAgc2xvdD1cImRyb3Bkb3duLWNvbnRlbnRcIlxuICAgICAgICAgID5cbiAgICAgICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1yZXBlYXRcIiBpdGVtcz1cIltbbGFiZWxPcHRpb25zXV1cIj5cbiAgICAgICAgICAgICAgPHBhcGVyLWl0ZW0gdmFsdWU9XCJbW2l0ZW1dXVwiIGxhYmVsPVwiW1tpdGVtXV1cIj5cbiAgICAgICAgICAgICAgICBbW2l0ZW1dXVxuICAgICAgICAgICAgICA8L3BhcGVyLWl0ZW0+XG4gICAgICAgICAgICA8L3RlbXBsYXRlPlxuICAgICAgICAgIDwvcGFwZXItbGlzdGJveD5cbiAgICAgICAgPC9wYXBlci1kcm9wZG93bi1tZW51PlxuICAgICAgICA8IS0tIENvbG9yIGJ5IC0tPlxuICAgICAgICA8cGFwZXItZHJvcGRvd24tbWVudSBpZD1cImNvbG9yYnlcIiBuby1hbmltYXRpb25zIGxhYmVsPVwiQ29sb3IgYnlcIj5cbiAgICAgICAgICA8cGFwZXItbGlzdGJveFxuICAgICAgICAgICAgYXR0ci1mb3Itc2VsZWN0ZWQ9XCJ2YWx1ZVwiXG4gICAgICAgICAgICBjbGFzcz1cImRyb3Bkb3duLWNvbnRlbnRcIlxuICAgICAgICAgICAgc2VsZWN0ZWQ9XCJ7e3NlbGVjdGVkQ29sb3JPcHRpb25OYW1lfX1cIlxuICAgICAgICAgICAgc2xvdD1cImRyb3Bkb3duLWNvbnRlbnRcIlxuICAgICAgICAgID5cbiAgICAgICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1yZXBlYXRcIiBpdGVtcz1cIltbY29sb3JPcHRpb25zXV1cIj5cbiAgICAgICAgICAgICAgPHBhcGVyLWl0ZW1cbiAgICAgICAgICAgICAgICBjbGFzcyQ9XCJbW2dldFNlcGFyYXRvckNsYXNzKGl0ZW0uaXNTZXBhcmF0b3IpXV1cIlxuICAgICAgICAgICAgICAgIHZhbHVlPVwiW1tpdGVtLm5hbWVdXVwiXG4gICAgICAgICAgICAgICAgbGFiZWw9XCJbW2l0ZW0ubmFtZV1dXCJcbiAgICAgICAgICAgICAgICBkaXNhYmxlZD1cIltbaXRlbS5pc1NlcGFyYXRvcl1dXCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIFtbaXRlbS5uYW1lXV1cbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIml0ZW0tZGV0YWlsc1wiPltbaXRlbS5kZXNjXV08L3NwYW4+XG4gICAgICAgICAgICAgIDwvcGFwZXItaXRlbT5cbiAgICAgICAgICAgIDwvdGVtcGxhdGU+XG4gICAgICAgICAgPC9wYXBlci1saXN0Ym94PlxuICAgICAgICA8L3BhcGVyLWRyb3Bkb3duLW1lbnU+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgaGlkZGVuJD1cIltbIXNob3dGb3JjZUNhdGVnb3JpY2FsQ29sb3JzQ2hlY2tib3hdXVwiPlxuICAgICAgICA8cGFwZXItY2hlY2tib3ggaWQ9XCJmb3JjZS1jYXRlZ29yaWNhbC1jaGVja2JveFwiXG4gICAgICAgICAgPlVzZSBjYXRlZ29yaWNhbCBjb2xvcmluZzwvcGFwZXItY2hlY2tib3hcbiAgICAgICAgPlxuICAgICAgICA8cGFwZXItaWNvbi1idXR0b24gaWNvbj1cImhlbHBcIiBjbGFzcz1cImhlbHAtaWNvblwiPjwvcGFwZXItaWNvbi1idXR0b24+XG4gICAgICAgIDxwYXBlci10b29sdGlwXG4gICAgICAgICAgcG9zaXRpb249XCJib3R0b21cIlxuICAgICAgICAgIGFuaW1hdGlvbi1kZWxheT1cIjBcIlxuICAgICAgICAgIGZpdC10by12aXNpYmxlLWJvdW5kc1xuICAgICAgICA+XG4gICAgICAgICAgRm9yIG1ldGFkYXRhIGZpZWxkcyB0aGF0IGhhdmUgbWFueSB1bmlxdWUgdmFsdWVzIHdlIHVzZSBhIGdyYWRpZW50XG4gICAgICAgICAgY29sb3IgbWFwIGJ5IGRlZmF1bHQuIFRoaXMgY2hlY2tib3ggYWxsb3dzIHlvdSB0byBmb3JjZSBjYXRlZ29yaWNhbFxuICAgICAgICAgIGNvbG9yaW5nIGJ5IGEgZ2l2ZW4gbWV0YWRhdGEgZmllbGQuXG4gICAgICAgIDwvcGFwZXItdG9vbHRpcD5cbiAgICAgIDwvZGl2PlxuICAgICAgPHRlbXBsYXRlIGRvbS1pZj1cIltbY29sb3JMZWdlbmRSZW5kZXJJbmZvXV1cIj5cbiAgICAgICAgPHZ6LXByb2plY3Rvci1sZWdlbmRcbiAgICAgICAgICByZW5kZXItaW5mbz1cIltbY29sb3JMZWdlbmRSZW5kZXJJbmZvXV1cIlxuICAgICAgICA+PC92ei1wcm9qZWN0b3ItbGVnZW5kPlxuICAgICAgPC90ZW1wbGF0ZT5cbiAgICA8L2Rpdj5cbiAgICA8dGVtcGxhdGUgaXM9XCJkb20taWZcIiBpZj1cIltbX2hhc0Nob2ljZShsYWJlbE9wdGlvbnMpXV1cIj5cbiAgICAgIDwhLS0gU3VwZXJ2aXNlIGJ5IC0tPlxuICAgICAgPGRpdiBoaWRkZW4kPVwiW1shc2hvd1N1cGVydmlzZVNldHRpbmdzXV1cIiBjbGFzcz1cInN1cGVydmlzZS1zZXR0aW5nc1wiPlxuICAgICAgICA8cGFwZXItZHJvcGRvd24tbWVudSBuby1hbmltYXRpb25zIGxhYmVsPVwiU3VwZXJ2aXNlIHdpdGhcIj5cbiAgICAgICAgICA8cGFwZXItbGlzdGJveFxuICAgICAgICAgICAgYXR0ci1mb3Itc2VsZWN0ZWQ9XCJ2YWx1ZVwiXG4gICAgICAgICAgICBjbGFzcz1cImRyb3Bkb3duLWNvbnRlbnRcIlxuICAgICAgICAgICAgb24tc2VsZWN0ZWQtaXRlbS1jaGFuZ2VkPVwic3VwZXJ2aXNlQ29sdW1uQ2hhbmdlZFwiXG4gICAgICAgICAgICBzZWxlY3RlZD1cInt7c3VwZXJ2aXNlQ29sdW1ufX1cIlxuICAgICAgICAgICAgc2xvdD1cImRyb3Bkb3duLWNvbnRlbnRcIlxuICAgICAgICAgID5cbiAgICAgICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1yZXBlYXRcIiBpdGVtcz1cIltbbWV0YWRhdGFGaWVsZHNdXVwiPlxuICAgICAgICAgICAgICA8cGFwZXItaXRlbSB2YWx1ZT1cIltbaXRlbV1dXCIgbGFiZWw9XCJbW2l0ZW1dXVwiPlxuICAgICAgICAgICAgICAgIFtbaXRlbV1dXG4gICAgICAgICAgICAgIDwvcGFwZXItaXRlbT5cbiAgICAgICAgICAgIDwvdGVtcGxhdGU+XG4gICAgICAgICAgPC9wYXBlci1saXN0Ym94PlxuICAgICAgICA8L3BhcGVyLWRyb3Bkb3duLW1lbnU+XG4gICAgICAgIDxwYXBlci1pbnB1dFxuICAgICAgICAgIHZhbHVlPVwie3tzdXBlcnZpc2VJbnB1dH19XCJcbiAgICAgICAgICBsYWJlbD1cInt7c3VwZXJ2aXNlSW5wdXRMYWJlbH19XCJcbiAgICAgICAgICBvbi1jaGFuZ2U9XCJzdXBlcnZpc2VJbnB1dENoYW5nZVwiXG4gICAgICAgICAgb24taW5wdXQ9XCJzdXBlcnZpc2VJbnB1dFR5cGluZ1wiXG4gICAgICAgID5cbiAgICAgICAgPC9wYXBlci1pbnB1dD5cbiAgICAgIDwvZGl2PlxuICAgICAgPCEtLSBFZGl0IGJ5IC0tPlxuICAgICAgPGRpdiBoaWRkZW4kPVwiW1shc2hvd0VkaXRTZXR0aW5nc11dXCIgY2xhc3M9XCJtZXRhZGF0YS1lZGl0b3JcIj5cbiAgICAgICAgPHBhcGVyLWRyb3Bkb3duLW1lbnUgbm8tYW5pbWF0aW9ucyBsYWJlbD1cIkVkaXQgYnlcIj5cbiAgICAgICAgICA8cGFwZXItbGlzdGJveFxuICAgICAgICAgICAgYXR0ci1mb3Itc2VsZWN0ZWQ9XCJ2YWx1ZVwiXG4gICAgICAgICAgICBjbGFzcz1cImRyb3Bkb3duLWNvbnRlbnRcIlxuICAgICAgICAgICAgc2xvdD1cImRyb3Bkb3duLWNvbnRlbnRcIlxuICAgICAgICAgICAgb24tc2VsZWN0ZWQtaXRlbS1jaGFuZ2VkPVwibWV0YWRhdGFFZGl0b3JDb2x1bW5DaGFuZ2VcIlxuICAgICAgICAgICAgc2VsZWN0ZWQ9XCJ7e21ldGFkYXRhRWRpdG9yQ29sdW1ufX1cIlxuICAgICAgICAgID5cbiAgICAgICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1yZXBlYXRcIiBpdGVtcz1cIltbbWV0YWRhdGFGaWVsZHNdXVwiPlxuICAgICAgICAgICAgICA8cGFwZXItaXRlbSB2YWx1ZT1cIltbaXRlbV1dXCIgbGFiZWw9XCJbW2l0ZW1dXVwiPlxuICAgICAgICAgICAgICAgIFtbaXRlbV1dXG4gICAgICAgICAgICAgIDwvcGFwZXItaXRlbT5cbiAgICAgICAgICAgIDwvdGVtcGxhdGU+XG4gICAgICAgICAgPC9wYXBlci1saXN0Ym94PlxuICAgICAgICA8L3BhcGVyLWRyb3Bkb3duLW1lbnU+XG4gICAgICAgIDxwYXBlci1pbnB1dFxuICAgICAgICAgIHZhbHVlPVwie3ttZXRhZGF0YUVkaXRvcklucHV0fX1cIlxuICAgICAgICAgIGxhYmVsPVwie3ttZXRhZGF0YUVkaXRvcklucHV0TGFiZWx9fVwiXG4gICAgICAgICAgb24taW5wdXQ9XCJtZXRhZGF0YUVkaXRvcklucHV0Q2hhbmdlXCJcbiAgICAgICAgICBvbi1rZXlkb3duPVwibWV0YWRhdGFFZGl0b3JJbnB1dEtleWRvd25cIlxuICAgICAgICA+XG4gICAgICAgIDwvcGFwZXItaW5wdXQ+XG4gICAgICA8L2Rpdj5cbiAgICA8L3RlbXBsYXRlPlxuICAgIDxkaXYgaWQ9XCJkZW1vLWRhdGEtYnV0dG9ucy1jb250YWluZXJcIj5cbiAgICAgIDxzcGFuIGNsYXNzPVwiYnV0dG9uLWNvbnRhaW5lclwiPlxuICAgICAgICA8cGFwZXItdG9vbHRpcFxuICAgICAgICAgIHBvc2l0aW9uPVwiYm90dG9tXCJcbiAgICAgICAgICBhbmltYXRpb24tZGVsYXk9XCIwXCJcbiAgICAgICAgICBmaXQtdG8tdmlzaWJsZS1ib3VuZHNcbiAgICAgICAgPlxuICAgICAgICAgIExvYWQgZGF0YSBmcm9tIHlvdXIgY29tcHV0ZXJcbiAgICAgICAgPC9wYXBlci10b29sdGlwPlxuICAgICAgICA8cGFwZXItYnV0dG9uIGlkPVwidXBsb2FkXCIgY2xhc3M9XCJpbmstYnV0dG9uXCIgb24tdGFwPVwiX29wZW5EYXRhRGlhbG9nXCJcbiAgICAgICAgICA+TG9hZDwvcGFwZXItYnV0dG9uXG4gICAgICAgID5cbiAgICAgIDwvc3Bhbj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2PlxuICAgICAgPHBhcGVyLWRpYWxvZyBpZD1cImRhdGFEaWFsb2dcIiB3aXRoLWJhY2tkcm9wPlxuICAgICAgICA8aDI+TG9hZCBkYXRhIGZyb20geW91ciBjb21wdXRlcjwvaDI+XG4gICAgICAgIDxwYXBlci1kaWFsb2ctc2Nyb2xsYWJsZSBjbGFzcz1cInNjcm9sbGFibGUtY29udGFpbmVyXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImRhdGEtc3RlcFwiIGlkPVwidXBsb2FkLXRlbnNvcnMtc3RlcC1jb250YWluZXJcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ1cGxvYWQtc3RlcFwiPlxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxiXG4gICAgICAgICAgICAgICAgICA+PHNwYW4gY2xhc3M9XCJzdGVwLWxhYmVsXCI+U3RlcCAxOjwvc3Bhbj4gTG9hZCBhIFRTViBmaWxlIG9mXG4gICAgICAgICAgICAgICAgICB2ZWN0b3JzLjwvYlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJkYXRhLXN0ZXAtY29udGVudHNcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImRhdGEtc3RlcC1jb250ZW50cy1jb250ZW50c1wiPlxuICAgICAgICAgICAgICAgIEV4YW1wbGUgb2YgMyB2ZWN0b3JzIHdpdGggZGltZW5zaW9uIDQ6XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvZGVcIj5cbiAgICAgICAgICAgICAgICAgIDAuMTxzcGFuIGNsYXNzPVwiZGVsaW1pdGVyXCI+IDwvc3Bhbj4wLjI8c3BhbiBjbGFzcz1cImRlbGltaXRlclwiPlxuICAgICAgICAgICAgICAgICAgPC9zcGFuXG4gICAgICAgICAgICAgICAgICA+MC41PHNwYW4gY2xhc3M9XCJkZWxpbWl0ZXJcIj4gPC9zcGFuPjAuOTxiciAvPlxuICAgICAgICAgICAgICAgICAgMC4yPHNwYW4gY2xhc3M9XCJkZWxpbWl0ZXJcIj4gPC9zcGFuPjAuMTxzcGFuIGNsYXNzPVwiZGVsaW1pdGVyXCI+XG4gICAgICAgICAgICAgICAgICA8L3NwYW5cbiAgICAgICAgICAgICAgICAgID41LjA8c3BhbiBjbGFzcz1cImRlbGltaXRlclwiPiA8L3NwYW4+MC4yPGJyIC8+XG4gICAgICAgICAgICAgICAgICAwLjQ8c3BhbiBjbGFzcz1cImRlbGltaXRlclwiPiA8L3NwYW4+MC4xPHNwYW4gY2xhc3M9XCJkZWxpbWl0ZXJcIj5cbiAgICAgICAgICAgICAgICAgIDwvc3BhblxuICAgICAgICAgICAgICAgICAgPjcuMDxzcGFuIGNsYXNzPVwiZGVsaW1pdGVyXCI+IDwvc3Bhbj4wLjhcbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJkYXRhLXN0ZXAtY29udGVudHMtdXBsb2FkXCI+XG4gICAgICAgICAgICAgICAgPHBhcGVyLWJ1dHRvblxuICAgICAgICAgICAgICAgICAgaWQ9XCJ1cGxvYWQtdGVuc29yc1wiXG4gICAgICAgICAgICAgICAgICB0aXRsZT1cIkNob29zZSBhIFRTViB0ZW5zb3IgZmlsZVwiXG4gICAgICAgICAgICAgICAgICA+Q2hvb3NlIGZpbGU8L3BhcGVyLWJ1dHRvblxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cImZpbGVcIiBpZD1cImZpbGVcIiBuYW1lPVwiZmlsZVwiIC8+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImRhdGEtc3RlcFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInVwbG9hZC1zdGVwXCI+XG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJzdGVwLWxhYmVsXCIgaWQ9XCJ1cGxvYWQtbWV0YWRhdGEtbGFiZWxcIlxuICAgICAgICAgICAgICAgICAgPjxiPlN0ZXAgMjwvYj4gKG9wdGlvbmFsKTo8L3NwYW5cbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPGI+TG9hZCBhIFRTViBmaWxlIG9mIG1ldGFkYXRhLjwvYj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJkYXRhLXN0ZXAtY29udGVudHNcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImRhdGEtc3RlcC1jb250ZW50cy1jb250ZW50c1wiPlxuICAgICAgICAgICAgICAgIEV4YW1wbGUgb2YgMyBkYXRhIHBvaW50cyBhbmQgMiBjb2x1bW5zLjxiciAvPlxuICAgICAgICAgICAgICAgIDxpXG4gICAgICAgICAgICAgICAgICA+Tm90ZTogSWYgdGhlcmUgaXMgbW9yZSB0aGFuIG9uZSBjb2x1bW4sIHRoZSBmaXJzdCByb3cgd2lsbCBiZVxuICAgICAgICAgICAgICAgICAgcGFyc2VkIGFzIGNvbHVtbiBsYWJlbHMuPC9pXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb2RlXCI+XG4gICAgICAgICAgICAgICAgICA8Yj5Qb2vDqW1vbjxzcGFuIGNsYXNzPVwiZGVsaW1pdGVyXCI+IDwvc3Bhbj5TcGVjaWVzPC9iPjxiciAvPlxuICAgICAgICAgICAgICAgICAgV2FydG9ydGxlPHNwYW4gY2xhc3M9XCJkZWxpbWl0ZXJcIj4gPC9zcGFuPlR1cnRsZTxiciAvPlxuICAgICAgICAgICAgICAgICAgVmVudXNhdXI8c3BhbiBjbGFzcz1cImRlbGltaXRlclwiPiA8L3NwYW4+U2VlZDxiciAvPlxuICAgICAgICAgICAgICAgICAgQ2hhcm1lbGVvbjxzcGFuIGNsYXNzPVwiZGVsaW1pdGVyXCI+IDwvc3Bhbj5GbGFtZVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImRhdGEtc3RlcC1jb250ZW50cy11cGxvYWRcIj5cbiAgICAgICAgICAgICAgICA8cGFwZXItYnV0dG9uXG4gICAgICAgICAgICAgICAgICBpZD1cInVwbG9hZC1tZXRhZGF0YVwiXG4gICAgICAgICAgICAgICAgICB0aXRsZT1cIkNob29zZSBhIFRTViBtZXRhZGF0YSBmaWxlXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwiaW5rLWJ1dHRvblwiXG4gICAgICAgICAgICAgICAgICA+Q2hvb3NlIGZpbGU8L3BhcGVyLWJ1dHRvblxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cImZpbGVcIiBpZD1cImZpbGUtbWV0YWRhdGFcIiBuYW1lPVwiZmlsZS1tZXRhZGF0YVwiIC8+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvcGFwZXItZGlhbG9nLXNjcm9sbGFibGU+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJkaXNtaXNzLWRpYWxvZy1ub3RlXCI+Q2xpY2sgb3V0c2lkZSB0byBkaXNtaXNzLjwvZGl2PlxuICAgICAgPC9wYXBlci1kaWFsb2c+XG4gICAgICA8cGFwZXItZGlhbG9nIGlkPVwicHJvamVjdG9yQ29uZmlnRGlhbG9nXCIgd2l0aC1iYWNrZHJvcD5cbiAgICAgICAgPGgyPlB1Ymxpc2ggeW91ciBlbWJlZGRpbmcgdmlzdWFsaXphdGlvbiBhbmQgZGF0YTwvaDI+XG4gICAgICAgIDxwYXBlci1kaWFsb2ctc2Nyb2xsYWJsZSBjbGFzcz1cInNjcm9sbGFibGUtY29udGFpbmVyXCI+XG4gICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgIDxwPlxuICAgICAgICAgICAgICBJZiB5b3UnZCBsaWtlIHRvIHNoYXJlIHlvdXIgdmlzdWFsaXphdGlvbiB3aXRoIHRoZSB3b3JsZCwgZm9sbG93XG4gICAgICAgICAgICAgIHRoZXNlIHNpbXBsZSBzdGVwcy4gU2VlXG4gICAgICAgICAgICAgIDxhXG4gICAgICAgICAgICAgICAgdGFyZ2V0PVwiX2JsYW5rXCJcbiAgICAgICAgICAgICAgICByZWw9XCJub29wZW5lciBub3JlZmVycmVyXCJcbiAgICAgICAgICAgICAgICBocmVmPVwiaHR0cHM6Ly93d3cudGVuc29yZmxvdy5vcmcvZ2V0X3N0YXJ0ZWQvZW1iZWRkaW5nX3ZpelwiXG4gICAgICAgICAgICAgICAgPnRoaXMgdHV0b3JpYWw8L2FcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICBmb3IgbW9yZS5cbiAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgIDxoND48c3BhbiBjbGFzcz1cInN0ZXAtbGFiZWxcIj5TdGVwIDE6PC9zcGFuPiBNYWtlIGRhdGEgcHVibGljPC9oND5cbiAgICAgICAgICAgIDxwPlxuICAgICAgICAgICAgICBIb3N0IHRlbnNvcnMsIG1ldGFkYXRhLCBzcHJpdGUgaW1hZ2UsIGFuZCBib29rbWFya3MgVFNWIGZpbGVzXG4gICAgICAgICAgICAgIDxpPnB1YmxpY2x5PC9pPiBvbiB0aGUgd2ViLlxuICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgPHA+XG4gICAgICAgICAgICAgIE9uZSBvcHRpb24gaXMgdXNpbmcgYVxuICAgICAgICAgICAgICA8YVxuICAgICAgICAgICAgICAgIHRhcmdldD1cIl9ibGFua1wiXG4gICAgICAgICAgICAgICAgaHJlZj1cImh0dHBzOi8vZ2lzdC5naXRodWIuY29tL1wiXG4gICAgICAgICAgICAgICAgcmVsPVwibm9vcGVuZXIgbm9yZWZlcnJlclwiXG4gICAgICAgICAgICAgICAgPmdpdGh1YiBnaXN0PC9hXG4gICAgICAgICAgICAgID4uIElmIHlvdSBjaG9vc2UgdGhpcyBhcHByb2FjaCwgbWFrZSBzdXJlIHRvIGxpbmsgZGlyZWN0bHkgdG8gdGhlXG4gICAgICAgICAgICAgIHJhdyBmaWxlLlxuICAgICAgICAgICAgPC9wPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICA8aDQ+PHNwYW4gY2xhc3M9XCJzdGVwLWxhYmVsXCI+U3RlcCAyOjwvc3Bhbj4gUHJvamVjdG9yIGNvbmZpZzwvaDQ+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwicHJvamVjdG9yLWNvbmZpZy1vcHRpb25zXCI+XG4gICAgICAgICAgICAgIDxpPk9wdGlvbmFsOjwvaT5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbmZpZy1jaGVja2JveFwiPlxuICAgICAgICAgICAgICAgIDxwYXBlci1jaGVja2JveCBpZD1cImNvbmZpZy1tZXRhZGF0YS1jaGVja2JveFwiIGNoZWNrZWRcbiAgICAgICAgICAgICAgICAgID5NZXRhZGF0YTwvcGFwZXItY2hlY2tib3hcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29uZmlnLWNoZWNrYm94XCI+XG4gICAgICAgICAgICAgICAgPHBhcGVyLWNoZWNrYm94IGlkPVwiY29uZmlnLXNwcml0ZS1jaGVja2JveFwiXG4gICAgICAgICAgICAgICAgICA+U3ByaXRlPC9wYXBlci1jaGVja2JveFxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb25maWctY2hlY2tib3hcIj5cbiAgICAgICAgICAgICAgICA8cGFwZXItY2hlY2tib3ggaWQ9XCJjb25maWctYm9va21hcmtzLWNoZWNrYm94XCJcbiAgICAgICAgICAgICAgICAgID5Cb29rbWFya3M8L3BhcGVyLWNoZWNrYm94XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxwYXBlci10ZXh0YXJlYVxuICAgICAgICAgICAgaWQ9XCJwcm9qZWN0b3ItY29uZmlnLXRlbXBsYXRlXCJcbiAgICAgICAgICAgIGxhYmVsPVwidGVtcGxhdGVfcHJvamVjdG9yX2NvbmZpZy5qc29uXCJcbiAgICAgICAgICA+PC9wYXBlci10ZXh0YXJlYT5cbiAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgPGg0PlxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInN0ZXAtbGFiZWxcIj5TdGVwIDM6PC9zcGFuPiBIb3N0IHByb2plY3RvciBjb25maWdcbiAgICAgICAgICAgIDwvaDQ+XG4gICAgICAgICAgICBBZnRlciB5b3UgaGF2ZSBob3N0ZWQgdGhlIHByb2plY3RvciBjb25maWcgSlNPTiBmaWxlIHlvdSBidWlsdFxuICAgICAgICAgICAgYWJvdmUsIHBhc3RlIHRoZSBVUkwgdG8gdGhlIGNvbmZpZyBiZWxvdy5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8cGFwZXItaW5wdXRcbiAgICAgICAgICAgIGlkPVwicHJvamVjdG9yLWNvbmZpZy11cmxcIlxuICAgICAgICAgICAgbGFiZWw9XCJQYXRoIHRvIHByb2plY3RvciBjb25maWdcIlxuICAgICAgICAgID48L3BhcGVyLWlucHV0PlxuICAgICAgICAgIDxwYXBlci1pbnB1dFxuICAgICAgICAgICAgaWQ9XCJwcm9qZWN0b3Itc2hhcmUtdXJsXCJcbiAgICAgICAgICAgIGxhYmVsPVwiWW91ciBzaGFyZWFibGUgVVJMXCJcbiAgICAgICAgICAgIHJlYWRvbmx5XG4gICAgICAgICAgPjwvcGFwZXItaW5wdXQ+XG4gICAgICAgICAgPGRpdiBpZD1cInByb2plY3Rvci1zaGFyZS1idXR0b24tY29udGFpbmVyXCI+XG4gICAgICAgICAgICA8YVxuICAgICAgICAgICAgICB0YXJnZXQ9XCJfYmxhbmtcIlxuICAgICAgICAgICAgICBpZD1cInByb2plY3Rvci1zaGFyZS11cmwtbGlua1wiXG4gICAgICAgICAgICAgIHJlbD1cIm5vb3BlbmVyIG5vcmVmZXJyZXJcIlxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICA8cGFwZXItYnV0dG9uIHRpdGxlPVwiVGVzdCB5b3VyIHNoYXJlYWJsZSBVUkxcIiBjbGFzcz1cImluay1idXR0b25cIlxuICAgICAgICAgICAgICAgID5UZXN0IHlvdXIgc2hhcmVhYmxlIFVSTDwvcGFwZXItYnV0dG9uXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgIDwvYT5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9wYXBlci1kaWFsb2ctc2Nyb2xsYWJsZT5cbiAgICAgICAgPGRpdiBjbGFzcz1cImRpc21pc3MtZGlhbG9nLW5vdGVcIj5DbGljayBvdXRzaWRlIHRvIGRpc21pc3MuPC9kaXY+XG4gICAgICA8L3BhcGVyLWRpYWxvZz5cbiAgICA8L2Rpdj5cbiAgICA8cGFwZXItY2hlY2tib3ggaWQ9XCJub3JtYWxpemUtZGF0YS1jaGVja2JveFwiIGhpZGRlbiQ9XCJbWyFzaG93Tm9ybWFsaXplRGF0YUNoZWNrYm94XV1cIiBjaGVja2VkPVwie3tub3JtYWxpemVEYXRhfX1cIj5cbiAgICAgIFNwaGVyZWl6ZSBkYXRhXG4gICAgICA8cGFwZXItaWNvbi1idXR0b24gaWNvbj1cImhlbHBcIiBjbGFzcz1cImhlbHAtaWNvblwiPjwvcGFwZXItaWNvbi1idXR0b24+XG4gICAgICA8cGFwZXItdG9vbHRpcFxuICAgICAgICBwb3NpdGlvbj1cImJvdHRvbVwiXG4gICAgICAgIGFuaW1hdGlvbi1kZWxheT1cIjBcIlxuICAgICAgICBmaXQtdG8tdmlzaWJsZS1ib3VuZHNcbiAgICAgID5cbiAgICAgICAgVGhlIGRhdGEgaXMgbm9ybWFsaXplZCBieSBzaGlmdGluZyBlYWNoIHBvaW50IGJ5IHRoZSBjZW50cm9pZCBhbmQgbWFraW5nXG4gICAgICAgIGl0IHVuaXQgbm9ybS5cbiAgICAgIDwvcGFwZXItdG9vbHRpcD5cbiAgICA8L3BhcGVyLWNoZWNrYm94PlxuICAgIDxkaXYgY2xhc3M9XCJkaXJzXCI+XG4gICAgICA8dGFibGU+XG4gICAgICAgIDx0cj5cbiAgICAgICAgICA8dGQ+Q2hlY2twb2ludDo8L3RkPlxuICAgICAgICAgIDx0ZD5cbiAgICAgICAgICAgIDxzcGFuIGlkPVwiY2hlY2twb2ludC1maWxlXCI+XG4gICAgICAgICAgICAgIDx0Zi13YnItc3RyaW5nXG4gICAgICAgICAgICAgICAgdGl0bGU9XCJbW3Byb2plY3RvckNvbmZpZy5tb2RlbENoZWNrcG9pbnRQYXRoXV1cIlxuICAgICAgICAgICAgICAgIGRlbGltaXRlci1wYXR0ZXJuPVwiW1tfd29yZERlbGltaXRlcl1dXCJcbiAgICAgICAgICAgICAgICB2YWx1ZT1cIltbcHJvamVjdG9yQ29uZmlnLm1vZGVsQ2hlY2twb2ludFBhdGhdXVwiXG4gICAgICAgICAgICAgID48L3RmLXdici1zdHJpbmc+XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgPC90ZD5cbiAgICAgICAgPC90cj5cbiAgICAgICAgPHRyPlxuICAgICAgICAgIDx0ZD5NZXRhZGF0YTo8L3RkPlxuICAgICAgICAgIDx0ZD5cbiAgICAgICAgICAgIDxzcGFuIGlkPVwibWV0YWRhdGEtZmlsZVwiPlxuICAgICAgICAgICAgICA8dGYtd2JyLXN0cmluZ1xuICAgICAgICAgICAgICAgIHRpdGxlPVwiW1ttZXRhZGF0YUZpbGVdXVwiXG4gICAgICAgICAgICAgICAgZGVsaW1pdGVyLXBhdHRlcm49XCJbW193b3JkRGVsaW1pdGVyXV1cIlxuICAgICAgICAgICAgICAgIHZhbHVlPVwiW1ttZXRhZGF0YUZpbGVdXVwiXG4gICAgICAgICAgICAgID48L3RmLXdici1zdHJpbmc+XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgPC90ZD5cbiAgICAgICAgPC90cj5cbiAgICAgIDwvdGFibGU+XG4gICAgPC9kaXY+XG4gIDwvZGl2PlxuYDtcbiJdfQ==