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

export const template = html`
<style include="vz-projector-styles"></style>
    <style>
      :host {
        display: flex;
        width: 100%;
        height: 100%;
      }

      #container {
        display: flex;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      .hidden {
        display: none !important;
      }
      .diff-layer-checkbox{
        margin: 0 5px;
      }

      /* Main */

      #main {
        position: relative;
        flex-grow: 2;
      }

      #main .stage {
        position: relative;
        flex-grow: 2;
      }

      #scatter {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
      }

      #selector {
        display: none;
        height: 100%;
        position: absolute;
        width: 100%;
      }

      #left-pane {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-width: 312px;
        width: 312px;
        border-right: 1px solid rgba(0, 0, 0, 0.1);
        background: #fafafa;
      }

      #right-pane {
        border-left: 1px solid rgba(0, 0, 0, 0.1);
        background: #fafafa;
        display: flex;
        height: 100%;
        min-width: 300px;
        width: 360px;
      }

      .file-name {
        margin-right: 5px;
      }

      .control input[type='text']:focus {
        outline: none;
        border-bottom: 1px solid rgba(0, 0, 0, 1);
      }

      .control {
        display: inline-block;
        width: 45%;
        vertical-align: top;
        margin-right: 10px;
        overflow-x: hidden;
      }

      .control.last {
        margin-right: 0;
      }

      #notification-dialog {
        width: 400px;
        padding-bottom: 20px;
      }

      #notification-dialog paper-button {
        background: none;
        text-transform: uppercase;
      }

      #notification-dialog .progress {
        --paper-spinner-color: #880e4f;
        --paper-spinner-stroke-width: 2px;
      }

      #notify-msgs {
        text-align: center;
        display: block;
      }

      .notify-msg {
        font-weight: 500;
        margin: 0;
        padding: 0;
      }

      .notify-msg.error {
        text-align: left;
      }

      .brush .extent {
        stroke: #fff;
        fill-opacity: 0.125;
        shape-rendering: crispEdges;
      }

      .origin text {
        font-size: 12px;
        font-weight: 500;
      }

      .origin line {
        stroke: black;
        stroke-opacity: 0.2;
      }

      /* Ink Framework */

      /* - Buttons */
      .ink-button,
      ::shadow .ink-button {
        border: none;
        border-radius: 2px;
        font-size: 13px;
        padding: 10px;
        min-width: 100px;
        flex-shrink: 0;
        background: #e3e3e3;
      }

      .status-bar-panel {
        display: flex;
        align-items: center;
        visibility:hidden;
        width: 0;
      }
      .layers-checkbox{
        display: flex;
        align-items: center;
        border-left: 2px solid;
        padding-left: 6px;
      }

      .status-bar-entry {
        border-right: 1px solid rgba(0, 0, 0, 0.5);
        margin-left: 5px;
        padding-left: 5px;
        padding-right: 5px;
      }

      /* - Menubar */

      .ink-panel-menubar {
        align-items: center;
        position: relative;
        height: 60px;
        border-bottom: solid 1px #eee;
        padding: 0 24px;
        display: flex;
      }

      .ink-panel-menubar .ink-fabs {
        position: absolute;
        right: 12px;
        top: 40px;
        z-index: 1;
      }

      #bookmark-panel {
        bottom: 0;
        position: absolute;
        width: 300px;
      }
      #bookmark-panel-container {
        bottom: 60px;
        position: absolute;
      }

      .ink-fab {
        margin-left: 8px;
        border: 1px solid rgba(0, 0, 0, 0.02);
        background: white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }

      #metadata-card {
        position: absolute;
        right: 5px;
        top: 25px;
      }

      #help-3d-icon {
        position: absolute;
        top: 20px;
        left: 20px;
      }

      #help3dDialog .main {
        margin: 0;
        padding: 20px;
      }

      #help3dDialog h3 {
        margin-top: 20px;
        margin-bottom: 5px;
      }

      #help3dDialog h3:first-child {
        margin-top: 0;
      }

      #data-panel {
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        overflow-y: auto;
        min-height: 360px;
        display: none;
      }

      #toast {
        display: flex;
        align-items: center;
        --paper-toast-color: #eeff41;
      }
      .canvans-move-container{
        border-right: 1px solid rgba(0,0,0,0.5);
        border-left: 1px solid rgba(0,0,0,0.5);
        display:flex;
        padding: 0 10px 0 5px;
        margin-left: 10px;
      }
    </style>
    <paper-dialog id="notification-dialog" modal>
      <h2 id="notification-title"></h2>
      <paper-dialog-scrollable>
        <div id="notify-msgs"></div>
      </paper-dialog-scrollable>
      <div style="text-align: center;">
        <paper-spinner-lite active class="progress"></paper-spinner-lite>
      </div>
      <div class="buttons">
        <paper-button class="close-button" dialog-confirm autofocus
          >Close</paper-button
        >
      </div>
    </paper-dialog>
    <div id="container">
      <div id="left-pane" class="ink-panel">
        <vz-projector-data-panel id="data-panel"></vz-projector-data-panel>
        <vz-projector-projections-panel
          id="projections-panel"
        ></vz-projector-projections-panel>
      </div>
      <div id="main" class="ink-panel">
        <div class="ink-panel-menubar">
          <paper-icon-button
            id="selectMode"
            alt="Bounding box selection"
            toggles
            icon="image:photo-size-select-small"
          ></paper-icon-button>
          <paper-tooltip
            for="selectMode"
            position="bottom"
            animation-delay="0"
            fit-to-visible-bounds
            >Bounding box selection</paper-tooltip
          >

          <paper-icon-button
            id="editMode"
            alt="Edit current selection"
            toggles
            icon="image:exposure"
          ></paper-icon-button>
          <paper-tooltip
            for="editMode"
            position="bottom"
            animation-delay="0"
            fit-to-visible-bounds
            >Edit current selection</paper-tooltip
          >

          <paper-icon-button
            id="nightDayMode"
            alt="Enable/disable night mode"
            toggles
            icon="image:brightness-2"
          ></paper-icon-button>
          <paper-tooltip
            for="nightDayMode"
            position="bottom"
            animation-delay="0"
            fit-to-visible-bounds
            >Enable/disable night mode</paper-tooltip
          >

          <paper-icon-button
          id="hiddenBackground"
          alt="show background"
          toggles
          icon="image:texture"
          ></paper-icon-button>
          <paper-tooltip
            for="hiddenBackground"
            position="bottom"
            animation-delay="0"
            fit-to-visible-bounds
            >Hidden/Show background</paper-tooltip
          >

          <paper-icon-button
            id="labels3DMode"
            alt="Enable/disable 3D labels mode"
            toggles
            icon="font-download"
          ></paper-icon-button>
          <paper-tooltip
            for="labels3DMode"
            position="bottom"
            animation-delay="0"
            fit-to-visible-bounds
            >Enable/disable 3D labels mode</paper-tooltip
          >

          <paper-icon-button
          id="triangleMode"
          alt="Enable/disable selected triangle"
          toggles
          icon="dns"
        ></paper-icon-button>
       
        <div class="status-bar-panel">
            <div class="status-bar-entry">
              Points: <span class="numDataPoints">Loading...</span>
            </div>
            <div class="status-bar-entry">
              Dimension: <span class="dim">Loading...</span>
            </div>
            <div
              id="status-bar"
              class="status-bar-entry"
              style="display: none;"
            ></div>
          </div>
          <div class="ink-fabs">
            <paper-icon-button
              id="reset-zoom"
              class="ink-fab"
              alt="Reset zoom to fit all points"
              icon="home"
            ></paper-icon-button>
            <paper-tooltip for="reset-zoom" position="left" animation-delay="0"
              >Reset zoom to fit all points</paper-tooltip
            >
          </div>
          <div class="layers-checkbox">
          <paper-checkbox class="diff-layer-checkbox" id="label-points-toggle" checked="{{showlabeled}}">
            labeled
          </paper-checkbox>
          <paper-checkbox class="diff-layer-checkbox" id="unlabel-points-toggle" checked="{{showUnlabeled}}">
            unlabeled
          </paper-checkbox>
          </paper-checkbox>
          <paper-checkbox class="diff-layer-checkbox" id="testing-points-toggle" checked="{{showTesting}}">
            testing
          </paper-checkbox>
          </div>
        </div>
        <div class="stage">
          <div id="scatter">
            <svg id="selector"></svg>
          </div>
          <vz-projector-metadata-card
            id="metadata-card"
          ></vz-projector-metadata-card>
          <paper-icon-button
            raised
            icon="help-outline"
            id="help-3d-icon"
          ></paper-icon-button>
          <paper-tooltip animation-delay="0" for="help-3d-icon"
            >Help with interaction controls.</paper-tooltip
          >
          <paper-dialog id="help3dDialog" with-backdrop>
            <div class="main" dialog-confirm autofocus>
              <h3>Points shape intro</h3>
              <div style="display:flex; align-items:center;">
              <b>Normal data:</b><img height="30px" src="data:image/png;base64,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"/>
              </div>
              <div style="display:flex; align-items:center;">
              <b>Unlabeled data:</b><img height="30px" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACQCAYAAADurULCAAAAAXNSR0IArs4c6QAABElJREFUeF7t29Fx20oQRFEoCcehFBy5U3AcToIq2aIok4CA3W1wdnquv4FFoXF8pXK993K5XC4Lf1hAtMALoERLcszfBQAFBOkCgJLOyWGAwoB0AUBJ5+QwQGFAugCgpHNyGKAwIF0AUNI5OQxQGJAuACjpnBwGKAxIFwCUdE4OAxQGpAsASjonhwEKA9IFACWdk8MAhQHpAoCSzslhgMKAdAFASefkMEBhQLoAoKRzchigMCBdAFDSOTkMUBiQLgAo6ZwcBqgGAz9+/V7+/HxtuKPepYA6+M3fMb3/AdT3gwGqERSoAHWQzPZl1zpdr6BS21tRqAPc7kFRKUAdYLN+yRomQAFKDgpU65PyI+8balt14ncpCtVVqD1QVOpxVgq1Qe0IJkAB6nCpjoIC1f+TUqgVYi2YAAWo3Uq1ggLVbVIKdcerBxOgALVZqV5QoPo3KYX6QmsEE6AA9VCpUVCgolCfqBSYAAUoOajqqPgdalkWVZ2uOiv/91KAOgFU5UqVB6WuU/VKAerjfz7Y/efzjgsq/ugrDeqsOlWuFKA6ytNyS7VKlQV1dp2qVgpQLbnpvLZSpUqCeladKlYKUJ3Vab2tSqXKgXp2napVClCtqRm4vkKlSoGKqlOlSgFqoDg9t7pXqgyo6DpVqRSgejIzeI9zpUqAmqVOFSoFqMHa9N7uWil7ULPVyb1SgOpNjOA+x0pZg5q1Ts6VApSgNCNHuFXKFtTsdXKtFKBG8iK616lSlqCy1MmxUoASVWb0GJdK2YHKVie3SgFqNC3C+x0qZQUqa52cKgUoYWEUR2WvlA2o7HVyqRSgFFkRn5G5UhagXOrkUClAieuiOi5rpdKDcqtT9koBSpWUE87JWKnUoFzrlLlSgDqhLMojs1UqLSj3OmWtFKCUOTnprEyVAtRJCJTHAkq55spZVX7cfX31LKhSFgpQJ/+NHTg+HaiKmDL9gg6ogb+Nz741w4+9VKAq1ylLpQD17MwMPm/2SqUBRZ1uEmdGBajBYkTcDqjB1anT44CzokpRKEABarBJt9vBtD3ljJWavlCAAhR1ki2wf9BslZq6UNQJUPsLHLwCTAeHWpZlpkpNWyhAAer4AjtXgql9ylkqNWWhAAWo9gU27gBT/5QzVGq6QgEKUP0L3N0JpvEpoys1VaEABajxBT5OAJNsytB/l5qqULpJOSlqAUBFLW/6XECZftio1wJU1PKmzwWU6YeNei1ARS1v+lxAmX7YqNcCVNTyps8FlOmHjXotQEUtb/pcQJl+2KjXAlTU8qbPBZTph416LUBFLW/6XECZftio1wJU1PKmzwWU6YeNei1ARS1v+lxAmX7YqNcCVNTyps8FlOmHjXotQEUtb/pcQJl+2KjXAlTU8qbPBZTph416LUBFLW/6XECZftio1wJU1PKmzwWU6YeNei1ARS1v+lxAmX7YqNcCVNTyps8FlOmHjXqtNxGXN36aPkeyAAAAAElFTkSuQmCC"/>
              </div>
              <div style="display:flex; align-items:center;">
              <b>Testing data:</b><img height="30px" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFIAAABSCAYAAADHLIObAAAAAXNSR0IArs4c6QAAATpJREFUeF7t28ENgkAARUHpw1IszBIszFLsY0m4cd2dGEgedx4w+XBjG2OMR8eywBbksuERCNI4BokcgwxSCaBO38ggkQDKtMggkQDKtMggkQDKtMggkQDKtMggkQDKtMggkQDKtMggkQDKkEX+3l90O//JPD8vfqEgEWmQQc4L9GrP253ODDJIJIAyLTJIJIAyLTJIJIAyLTJIJIAyLTJIJIAyLTJIJIAyLTJIJIAyLTJIJIAyLTJIJIAyLTJIJIAyLTJIJIAyLTJIJIAyLTJIJIAyLTJIJIAyLTJIJIAyLTJIJIAyLTJIJIAyLTJIJIAyLTJIJIAyl10ker5bZ8ifX7cWQDcfZJBIAGVaZJBIAGVaZJBIAGVaZJBIAGVaZJBIAGVaZJBIAGVaZJBIAGVaZJBIAGVaJILcARpIyBqv977cAAAAAElFTkSuQmCC"/>
              </div>
              <b>Classes</b>
              <b>Number</b> 10<br />
              <h3>3D Label Intro</h3>
              disagreement between prediction and pseudo label : ❗<br/>
              suggest label: 👍<br/>
              custom selected: ✅<br/>
              anomaly data: ⭕️<br/>
              clean data: 🟢<br/>
              <!-- <b>Zoom</b> Mouse wheel.<br />
              <h3>Meta Card</h3>
              previous selected：☑️
              
              Holding <b>ctrl</b> reverses the mouse clicks.
              <h3>2D controls</h3>
              <b>Pan</b> Mouse left click.<br />
              <b>Zoom</b> Mouse wheel. -->
              <div class="dismiss-dialog-note">Click anywhere to dismiss.</div>
            </div>
          </paper-dialog>
        </div>
      </div>
      <div id="right-pane" class="ink-panel">
        <div class="ink-panel-content active">
          <vz-projector-inspector-panel
            id="inspector-panel"
          ></vz-projector-inspector-panel>
        </div>
        <div id="bookmark-panel-container">
          <vz-projector-bookmark-panel
            id="bookmark-panel"
          ></vz-projector-bookmark-panel>
        </div>
      </div>
    </div>
    <paper-toast id="toast" always-on-top></paper-toast>
  </template>
`;
