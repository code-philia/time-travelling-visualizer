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
        display: flex;
        width: 100%;
        height: 100%;
      }

      #container {
        display: flex;
        width: 100%;
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
        min-width: 202px;
        width: 202px;
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
        position: fixed;
        left: 320px;
        top: 25px;
        z-index:99;
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
    <div id="container" style="height:calc(100vh - 130px)">
      <div style="width:100%; overflow:auto; position: absolute;background: #f2f2f2;bottom: 0;z-index:99;">
      <div style="overflow-x: auto;">
      <svg id="mysvggg"></svg>
      </div>
      </div>
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
            style="width: 0px;visibility: hidden;margin: 0;padding: 0;"
            id="editMode"
            alt="Edit current selection"
            toggles
            icon="image:exposure"
          ></paper-icon-button>
        

          <paper-icon-button
            id="nightDayMode"
            style="width: 0px;visibility: hidden;margin: 0;padding: 0;"
            alt="Enable/disable night mode"
            toggles
            icon="image:brightness-2"
          ></paper-icon-button>
         

          <paper-icon-button
          id="hiddenBackground"
          alt="show background"
          toggles
          icon="image:texture"
          style="visibility:hidden;width:0px;"
          ></paper-icon-button>
          <paper-tooltip
          style="visibility:hidden;width:0px;margin: 0;padding: 0;"
            for="hiddenBackground"
            position="bottom"
            animation-delay="0"
            fit-to-visible-bounds
            >Hidden/Show background</paper-tooltip
          >

          <paper-icon-button
            style="width: 0px;visibility: hidden;margin: 0;padding: 0;"
            id="labels3DMode"
            alt="Enable/disable 3D labels mode"
            toggles
            icon="font-download"
          ></paper-icon-button>
         

          <paper-icon-button
          style="visibility:hidden;width:0px;margin: 0;padding: 0;"
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
          <template is="dom-if" if="[[!showUnlabeledCheckbox]]">
          <paper-checkbox class="diff-layer-checkbox" id="label-points-toggle" checked="{{showlabeled}}">
            training
          </paper-checkbox>
          </template>
          <template is="dom-if" if="[[showUnlabeledCheckbox]]">
          <paper-checkbox class="diff-layer-checkbox" id="label-points-toggle" checked="{{showlabeled}}">
            labeled
          </paper-checkbox>
         
          <paper-checkbox class="diff-layer-checkbox" id="unlabel-points-toggle" checked="{{showUnlabeled}}">
            unlabeled
          </paper-checkbox>
          </template>
          </paper-checkbox>
          <paper-checkbox class="diff-layer-checkbox" id="testing-points-toggle" checked="{{showTesting}}">
            testing
          </paper-checkbox>
          </div>
        </div>
        <div class="stage">
        <template is="dom-if" if="[[_showNotAvaliable]]">
        <div style="position:absolute;top: 20%;width: 100%;text-align: center;">
        <h1 style="color:red;">Not Avaliable!</h1>
        <h4>you can choose ResNet-18 and lr: 0.01 to see the visualization </h4>
        </div>
        </template>
          <div id="scatter">
  
            <svg id="selector"></svg>
          </div>
          <vz-projector-metadata-card
            id="metadata-card"
            style="left: [[metadataStyle.left]]; top:[[metadataStyle.top]];"
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
              <b>Classes</b>
              <b>Number</b> 10<br />
              <h3>3D Label Intro</h3>
              recommned: 👍<br/>
              custom interest: ✅<br/>
              custom not interest: ❌<br/>

              majority: 🟢<br/>
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLmh0bWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi90ZW5zb3Jib2FyZC9wcm9qZWN0b3IvdnotcHJvamVjdG9yLmh0bWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Z0ZBYWdGO0FBRWhGLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUV4QyxPQUFPLFVBQVUsQ0FBQztBQUVsQixNQUFNLENBQUMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FrYzNCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBDb3B5cmlnaHQgMjAxNiBUaGUgVGVuc29yRmxvdyBBdXRob3JzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5cbmltcG9ydCB7IGh0bWwgfSBmcm9tICdAcG9seW1lci9wb2x5bWVyJztcblxuaW1wb3J0ICcuL3N0eWxlcyc7XG5cbmV4cG9ydCBjb25zdCB0ZW1wbGF0ZSA9IGh0bWxgXG48c3R5bGUgaW5jbHVkZT1cInZ6LXByb2plY3Rvci1zdHlsZXNcIj48L3N0eWxlPlxuICAgIDxzdHlsZT5cbiAgICAgIDpob3N0IHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgIGhlaWdodDogMTAwJTtcbiAgICAgIH1cblxuICAgICAgI2NvbnRhaW5lciB7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgfVxuXG4gICAgICAuaGlkZGVuIHtcbiAgICAgICAgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgfVxuICAgICAgLmRpZmYtbGF5ZXItY2hlY2tib3h7XG4gICAgICAgIG1hcmdpbjogMCA1cHg7XG4gICAgICB9XG5cbiAgICAgIC8qIE1haW4gKi9cblxuICAgICAgI21haW4ge1xuICAgICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgICAgIGZsZXgtZ3JvdzogMjtcbiAgICAgIH1cblxuICAgICAgI21haW4gLnN0YWdlIHtcbiAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICBmbGV4LWdyb3c6IDI7XG4gICAgICB9XG5cbiAgICAgICNzY2F0dGVyIHtcbiAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICB0b3A6IDA7XG4gICAgICAgIGxlZnQ6IDA7XG4gICAgICAgIHJpZ2h0OiAwO1xuICAgICAgICBib3R0b206IDA7XG4gICAgICB9XG5cbiAgICAgICNzZWxlY3RvciB7XG4gICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICAgIGhlaWdodDogMTAwJTtcbiAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgIH1cblxuICAgICAgI2xlZnQtcGFuZSB7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgICAgbWluLXdpZHRoOiAyMDJweDtcbiAgICAgICAgd2lkdGg6IDIwMnB4O1xuICAgICAgICBib3JkZXItcmlnaHQ6IDFweCBzb2xpZCByZ2JhKDAsIDAsIDAsIDAuMSk7XG4gICAgICAgIGJhY2tncm91bmQ6ICNmYWZhZmE7XG4gICAgICB9XG5cbiAgICAgICNyaWdodC1wYW5lIHtcbiAgICAgICAgYm9yZGVyLWxlZnQ6IDFweCBzb2xpZCByZ2JhKDAsIDAsIDAsIDAuMSk7XG4gICAgICAgIGJhY2tncm91bmQ6ICNmYWZhZmE7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGhlaWdodDogMTAwJTtcbiAgICAgICAgbWluLXdpZHRoOiAzMDBweDtcbiAgICAgICAgd2lkdGg6IDM2MHB4O1xuICAgICAgfVxuXG4gICAgICAuZmlsZS1uYW1lIHtcbiAgICAgICAgbWFyZ2luLXJpZ2h0OiA1cHg7XG4gICAgICB9XG5cbiAgICAgIC5jb250cm9sIGlucHV0W3R5cGU9J3RleHQnXTpmb2N1cyB7XG4gICAgICAgIG91dGxpbmU6IG5vbmU7XG4gICAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDAsIDAsIDAsIDEpO1xuICAgICAgfVxuXG4gICAgICAuY29udHJvbCB7XG4gICAgICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgICAgICAgd2lkdGg6IDQ1JTtcbiAgICAgICAgdmVydGljYWwtYWxpZ246IHRvcDtcbiAgICAgICAgbWFyZ2luLXJpZ2h0OiAxMHB4O1xuICAgICAgICBvdmVyZmxvdy14OiBoaWRkZW47XG4gICAgICB9XG5cbiAgICAgIC5jb250cm9sLmxhc3Qge1xuICAgICAgICBtYXJnaW4tcmlnaHQ6IDA7XG4gICAgICB9XG5cbiAgICAgICNub3RpZmljYXRpb24tZGlhbG9nIHtcbiAgICAgICAgd2lkdGg6IDQwMHB4O1xuICAgICAgICBwYWRkaW5nLWJvdHRvbTogMjBweDtcbiAgICAgIH1cblxuICAgICAgI25vdGlmaWNhdGlvbi1kaWFsb2cgcGFwZXItYnV0dG9uIHtcbiAgICAgICAgYmFja2dyb3VuZDogbm9uZTtcbiAgICAgICAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTtcbiAgICAgIH1cblxuICAgICAgI25vdGlmaWNhdGlvbi1kaWFsb2cgLnByb2dyZXNzIHtcbiAgICAgICAgLS1wYXBlci1zcGlubmVyLWNvbG9yOiAjODgwZTRmO1xuICAgICAgICAtLXBhcGVyLXNwaW5uZXItc3Ryb2tlLXdpZHRoOiAycHg7XG4gICAgICB9XG5cbiAgICAgICNub3RpZnktbXNncyB7XG4gICAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICB9XG5cbiAgICAgIC5ub3RpZnktbXNnIHtcbiAgICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICAgICAgbWFyZ2luOiAwO1xuICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgfVxuXG4gICAgICAubm90aWZ5LW1zZy5lcnJvciB7XG4gICAgICAgIHRleHQtYWxpZ246IGxlZnQ7XG4gICAgICB9XG5cbiAgICAgIC5icnVzaCAuZXh0ZW50IHtcbiAgICAgICAgc3Ryb2tlOiAjZmZmO1xuICAgICAgICBmaWxsLW9wYWNpdHk6IDAuMTI1O1xuICAgICAgICBzaGFwZS1yZW5kZXJpbmc6IGNyaXNwRWRnZXM7XG4gICAgICB9XG5cbiAgICAgIC5vcmlnaW4gdGV4dCB7XG4gICAgICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICAgIH1cblxuICAgICAgLm9yaWdpbiBsaW5lIHtcbiAgICAgICAgc3Ryb2tlOiBibGFjaztcbiAgICAgICAgc3Ryb2tlLW9wYWNpdHk6IDAuMjtcbiAgICAgIH1cblxuICAgICAgLyogSW5rIEZyYW1ld29yayAqL1xuXG4gICAgICAvKiAtIEJ1dHRvbnMgKi9cbiAgICAgIC5pbmstYnV0dG9uLFxuICAgICAgOjpzaGFkb3cgLmluay1idXR0b24ge1xuICAgICAgICBib3JkZXI6IG5vbmU7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDJweDtcbiAgICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgICBwYWRkaW5nOiAxMHB4O1xuICAgICAgICBtaW4td2lkdGg6IDEwMHB4O1xuICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgYmFja2dyb3VuZDogI2UzZTNlMztcbiAgICAgIH1cblxuICAgICAgLnN0YXR1cy1iYXItcGFuZWwge1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICB2aXNpYmlsaXR5OmhpZGRlbjtcbiAgICAgICAgd2lkdGg6IDA7XG4gICAgICB9XG4gICAgICAubGF5ZXJzLWNoZWNrYm94e1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICBib3JkZXItbGVmdDogMnB4IHNvbGlkO1xuICAgICAgICBwYWRkaW5nLWxlZnQ6IDZweDtcbiAgICAgIH1cblxuICAgICAgLnN0YXR1cy1iYXItZW50cnkge1xuICAgICAgICBib3JkZXItcmlnaHQ6IDFweCBzb2xpZCByZ2JhKDAsIDAsIDAsIDAuNSk7XG4gICAgICAgIG1hcmdpbi1sZWZ0OiA1cHg7XG4gICAgICAgIHBhZGRpbmctbGVmdDogNXB4O1xuICAgICAgICBwYWRkaW5nLXJpZ2h0OiA1cHg7XG4gICAgICB9XG5cbiAgICAgIC8qIC0gTWVudWJhciAqL1xuXG4gICAgICAuaW5rLXBhbmVsLW1lbnViYXIge1xuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgICAgIGhlaWdodDogNjBweDtcbiAgICAgICAgYm9yZGVyLWJvdHRvbTogc29saWQgMXB4ICNlZWU7XG4gICAgICAgIHBhZGRpbmc6IDAgMjRweDtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIH1cblxuICAgICAgLmluay1wYW5lbC1tZW51YmFyIC5pbmstZmFicyB7XG4gICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgcmlnaHQ6IDEycHg7XG4gICAgICAgIHRvcDogNDBweDtcbiAgICAgICAgei1pbmRleDogMTtcbiAgICAgIH1cblxuICAgICAgI2Jvb2ttYXJrLXBhbmVsIHtcbiAgICAgICAgYm90dG9tOiAwO1xuICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgIHdpZHRoOiAzMDBweDtcbiAgICAgIH1cbiAgICAgICNib29rbWFyay1wYW5lbC1jb250YWluZXIge1xuICAgICAgICBib3R0b206IDYwcHg7XG4gICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIH1cblxuICAgICAgLmluay1mYWIge1xuICAgICAgICBtYXJnaW4tbGVmdDogOHB4O1xuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDAsIDAsIDAsIDAuMDIpO1xuICAgICAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICAgICAgYm94LXNoYWRvdzogMCAxcHggM3B4IHJnYmEoMCwgMCwgMCwgMC4zKTtcbiAgICAgIH1cblxuICAgICAgI21ldGFkYXRhLWNhcmQge1xuICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICAgIGxlZnQ6IDMyMHB4O1xuICAgICAgICB0b3A6IDI1cHg7XG4gICAgICAgIHotaW5kZXg6OTk7XG4gICAgICB9XG5cbiAgICAgICNoZWxwLTNkLWljb24ge1xuICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgIHRvcDogMjBweDtcbiAgICAgICAgbGVmdDogMjBweDtcbiAgICAgIH1cblxuICAgICAgI2hlbHAzZERpYWxvZyAubWFpbiB7XG4gICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgIH1cblxuICAgICAgI2hlbHAzZERpYWxvZyBoMyB7XG4gICAgICAgIG1hcmdpbi10b3A6IDIwcHg7XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDVweDtcbiAgICAgIH1cblxuICAgICAgI2hlbHAzZERpYWxvZyBoMzpmaXJzdC1jaGlsZCB7XG4gICAgICAgIG1hcmdpbi10b3A6IDA7XG4gICAgICB9XG5cbiAgICAgICNkYXRhLXBhbmVsIHtcbiAgICAgICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHJnYmEoMCwgMCwgMCwgMC4xKTtcbiAgICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgICAgbWluLWhlaWdodDogMzYwcHg7XG4gICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICB9XG5cbiAgICAgICN0b2FzdCB7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgIC0tcGFwZXItdG9hc3QtY29sb3I6ICNlZWZmNDE7XG4gICAgICB9XG4gICAgICAuY2FudmFucy1tb3ZlLWNvbnRhaW5lcntcbiAgICAgICAgYm9yZGVyLXJpZ2h0OiAxcHggc29saWQgcmdiYSgwLDAsMCwwLjUpO1xuICAgICAgICBib3JkZXItbGVmdDogMXB4IHNvbGlkIHJnYmEoMCwwLDAsMC41KTtcbiAgICAgICAgZGlzcGxheTpmbGV4O1xuICAgICAgICBwYWRkaW5nOiAwIDEwcHggMCA1cHg7XG4gICAgICAgIG1hcmdpbi1sZWZ0OiAxMHB4O1xuICAgICAgfVxuICAgIDwvc3R5bGU+XG4gICAgPHBhcGVyLWRpYWxvZyBpZD1cIm5vdGlmaWNhdGlvbi1kaWFsb2dcIiBtb2RhbD5cbiAgICAgIDxoMiBpZD1cIm5vdGlmaWNhdGlvbi10aXRsZVwiPjwvaDI+XG4gICAgICA8cGFwZXItZGlhbG9nLXNjcm9sbGFibGU+XG4gICAgICAgIDxkaXYgaWQ9XCJub3RpZnktbXNnc1wiPjwvZGl2PlxuICAgICAgPC9wYXBlci1kaWFsb2ctc2Nyb2xsYWJsZT5cbiAgICAgIDxkaXYgc3R5bGU9XCJ0ZXh0LWFsaWduOiBjZW50ZXI7XCI+XG4gICAgICAgIDxwYXBlci1zcGlubmVyLWxpdGUgYWN0aXZlIGNsYXNzPVwicHJvZ3Jlc3NcIj48L3BhcGVyLXNwaW5uZXItbGl0ZT5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImJ1dHRvbnNcIj5cbiAgICAgICAgPHBhcGVyLWJ1dHRvbiBjbGFzcz1cImNsb3NlLWJ1dHRvblwiIGRpYWxvZy1jb25maXJtIGF1dG9mb2N1c1xuICAgICAgICAgID5DbG9zZTwvcGFwZXItYnV0dG9uXG4gICAgICAgID5cbiAgICAgIDwvZGl2PlxuICAgIDwvcGFwZXItZGlhbG9nPlxuICAgIDxkaXYgaWQ9XCJjb250YWluZXJcIiBzdHlsZT1cImhlaWdodDpjYWxjKDEwMHZoIC0gMTMwcHgpXCI+XG4gICAgICA8ZGl2IHN0eWxlPVwid2lkdGg6MTAwJTsgb3ZlcmZsb3c6YXV0bzsgcG9zaXRpb246IGFic29sdXRlO2JhY2tncm91bmQ6ICNmMmYyZjI7Ym90dG9tOiAwO3otaW5kZXg6OTk7XCI+XG4gICAgICA8ZGl2IHN0eWxlPVwib3ZlcmZsb3cteDogYXV0bztcIj5cbiAgICAgIDxzdmcgaWQ9XCJteXN2Z2dnXCI+PC9zdmc+XG4gICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBpZD1cImxlZnQtcGFuZVwiIGNsYXNzPVwiaW5rLXBhbmVsXCI+XG4gICAgICAgIDx2ei1wcm9qZWN0b3ItZGF0YS1wYW5lbCBpZD1cImRhdGEtcGFuZWxcIj48L3Z6LXByb2plY3Rvci1kYXRhLXBhbmVsPlxuICAgICAgICA8dnotcHJvamVjdG9yLXByb2plY3Rpb25zLXBhbmVsXG4gICAgICAgICAgaWQ9XCJwcm9qZWN0aW9ucy1wYW5lbFwiXG4gICAgICAgID48L3Z6LXByb2plY3Rvci1wcm9qZWN0aW9ucy1wYW5lbD5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBpZD1cIm1haW5cIiBjbGFzcz1cImluay1wYW5lbFwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiaW5rLXBhbmVsLW1lbnViYXJcIj5cbiAgICAgICAgICA8cGFwZXItaWNvbi1idXR0b25cbiAgICAgICAgICAgIGlkPVwic2VsZWN0TW9kZVwiXG4gICAgICAgICAgICBhbHQ9XCJCb3VuZGluZyBib3ggc2VsZWN0aW9uXCJcbiAgICAgICAgICAgIHRvZ2dsZXNcbiAgICAgICAgICAgIGljb249XCJpbWFnZTpwaG90by1zaXplLXNlbGVjdC1zbWFsbFwiXG4gICAgICAgICAgPjwvcGFwZXItaWNvbi1idXR0b24+XG4gICAgICAgICAgPHBhcGVyLXRvb2x0aXBcbiAgICAgICAgICAgIGZvcj1cInNlbGVjdE1vZGVcIlxuICAgICAgICAgICAgcG9zaXRpb249XCJib3R0b21cIlxuICAgICAgICAgICAgYW5pbWF0aW9uLWRlbGF5PVwiMFwiXG4gICAgICAgICAgICBmaXQtdG8tdmlzaWJsZS1ib3VuZHNcbiAgICAgICAgICAgID5Cb3VuZGluZyBib3ggc2VsZWN0aW9uPC9wYXBlci10b29sdGlwXG4gICAgICAgICAgPlxuXG4gICAgICAgICAgPHBhcGVyLWljb24tYnV0dG9uXG4gICAgICAgICAgICBzdHlsZT1cIndpZHRoOiAwcHg7dmlzaWJpbGl0eTogaGlkZGVuO21hcmdpbjogMDtwYWRkaW5nOiAwO1wiXG4gICAgICAgICAgICBpZD1cImVkaXRNb2RlXCJcbiAgICAgICAgICAgIGFsdD1cIkVkaXQgY3VycmVudCBzZWxlY3Rpb25cIlxuICAgICAgICAgICAgdG9nZ2xlc1xuICAgICAgICAgICAgaWNvbj1cImltYWdlOmV4cG9zdXJlXCJcbiAgICAgICAgICA+PC9wYXBlci1pY29uLWJ1dHRvbj5cbiAgICAgICAgXG5cbiAgICAgICAgICA8cGFwZXItaWNvbi1idXR0b25cbiAgICAgICAgICAgIGlkPVwibmlnaHREYXlNb2RlXCJcbiAgICAgICAgICAgIHN0eWxlPVwid2lkdGg6IDBweDt2aXNpYmlsaXR5OiBoaWRkZW47bWFyZ2luOiAwO3BhZGRpbmc6IDA7XCJcbiAgICAgICAgICAgIGFsdD1cIkVuYWJsZS9kaXNhYmxlIG5pZ2h0IG1vZGVcIlxuICAgICAgICAgICAgdG9nZ2xlc1xuICAgICAgICAgICAgaWNvbj1cImltYWdlOmJyaWdodG5lc3MtMlwiXG4gICAgICAgICAgPjwvcGFwZXItaWNvbi1idXR0b24+XG4gICAgICAgICBcblxuICAgICAgICAgIDxwYXBlci1pY29uLWJ1dHRvblxuICAgICAgICAgIGlkPVwiaGlkZGVuQmFja2dyb3VuZFwiXG4gICAgICAgICAgYWx0PVwic2hvdyBiYWNrZ3JvdW5kXCJcbiAgICAgICAgICB0b2dnbGVzXG4gICAgICAgICAgaWNvbj1cImltYWdlOnRleHR1cmVcIlxuICAgICAgICAgIHN0eWxlPVwidmlzaWJpbGl0eTpoaWRkZW47d2lkdGg6MHB4O1wiXG4gICAgICAgICAgPjwvcGFwZXItaWNvbi1idXR0b24+XG4gICAgICAgICAgPHBhcGVyLXRvb2x0aXBcbiAgICAgICAgICBzdHlsZT1cInZpc2liaWxpdHk6aGlkZGVuO3dpZHRoOjBweDttYXJnaW46IDA7cGFkZGluZzogMDtcIlxuICAgICAgICAgICAgZm9yPVwiaGlkZGVuQmFja2dyb3VuZFwiXG4gICAgICAgICAgICBwb3NpdGlvbj1cImJvdHRvbVwiXG4gICAgICAgICAgICBhbmltYXRpb24tZGVsYXk9XCIwXCJcbiAgICAgICAgICAgIGZpdC10by12aXNpYmxlLWJvdW5kc1xuICAgICAgICAgICAgPkhpZGRlbi9TaG93IGJhY2tncm91bmQ8L3BhcGVyLXRvb2x0aXBcbiAgICAgICAgICA+XG5cbiAgICAgICAgICA8cGFwZXItaWNvbi1idXR0b25cbiAgICAgICAgICAgIHN0eWxlPVwid2lkdGg6IDBweDt2aXNpYmlsaXR5OiBoaWRkZW47bWFyZ2luOiAwO3BhZGRpbmc6IDA7XCJcbiAgICAgICAgICAgIGlkPVwibGFiZWxzM0RNb2RlXCJcbiAgICAgICAgICAgIGFsdD1cIkVuYWJsZS9kaXNhYmxlIDNEIGxhYmVscyBtb2RlXCJcbiAgICAgICAgICAgIHRvZ2dsZXNcbiAgICAgICAgICAgIGljb249XCJmb250LWRvd25sb2FkXCJcbiAgICAgICAgICA+PC9wYXBlci1pY29uLWJ1dHRvbj5cbiAgICAgICAgIFxuXG4gICAgICAgICAgPHBhcGVyLWljb24tYnV0dG9uXG4gICAgICAgICAgc3R5bGU9XCJ2aXNpYmlsaXR5OmhpZGRlbjt3aWR0aDowcHg7bWFyZ2luOiAwO3BhZGRpbmc6IDA7XCJcbiAgICAgICAgICBpZD1cInRyaWFuZ2xlTW9kZVwiXG4gICAgICAgICAgYWx0PVwiRW5hYmxlL2Rpc2FibGUgc2VsZWN0ZWQgdHJpYW5nbGVcIlxuICAgICAgICAgIHRvZ2dsZXNcbiAgICAgICAgICBpY29uPVwiZG5zXCJcbiAgICAgICAgPjwvcGFwZXItaWNvbi1idXR0b24+XG4gICAgICAgXG4gICAgICAgIDxkaXYgY2xhc3M9XCJzdGF0dXMtYmFyLXBhbmVsXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3RhdHVzLWJhci1lbnRyeVwiPlxuICAgICAgICAgICAgICBQb2ludHM6IDxzcGFuIGNsYXNzPVwibnVtRGF0YVBvaW50c1wiPkxvYWRpbmcuLi48L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzdGF0dXMtYmFyLWVudHJ5XCI+XG4gICAgICAgICAgICAgIERpbWVuc2lvbjogPHNwYW4gY2xhc3M9XCJkaW1cIj5Mb2FkaW5nLi4uPC9zcGFuPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgIGlkPVwic3RhdHVzLWJhclwiXG4gICAgICAgICAgICAgIGNsYXNzPVwic3RhdHVzLWJhci1lbnRyeVwiXG4gICAgICAgICAgICAgIHN0eWxlPVwiZGlzcGxheTogbm9uZTtcIlxuICAgICAgICAgICAgPjwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJpbmstZmFic1wiPlxuICAgICAgICAgICAgPHBhcGVyLWljb24tYnV0dG9uXG4gICAgICAgICAgICAgIGlkPVwicmVzZXQtem9vbVwiXG4gICAgICAgICAgICAgIGNsYXNzPVwiaW5rLWZhYlwiXG4gICAgICAgICAgICAgIGFsdD1cIlJlc2V0IHpvb20gdG8gZml0IGFsbCBwb2ludHNcIlxuICAgICAgICAgICAgICBpY29uPVwiaG9tZVwiXG4gICAgICAgICAgICA+PC9wYXBlci1pY29uLWJ1dHRvbj5cbiAgICAgICAgICAgIDxwYXBlci10b29sdGlwIGZvcj1cInJlc2V0LXpvb21cIiBwb3NpdGlvbj1cImxlZnRcIiBhbmltYXRpb24tZGVsYXk9XCIwXCJcbiAgICAgICAgICAgICAgPlJlc2V0IHpvb20gdG8gZml0IGFsbCBwb2ludHM8L3BhcGVyLXRvb2x0aXBcbiAgICAgICAgICAgID5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwibGF5ZXJzLWNoZWNrYm94XCI+XG4gICAgICAgICAgPHRlbXBsYXRlIGlzPVwiZG9tLWlmXCIgaWY9XCJbWyFzaG93VW5sYWJlbGVkQ2hlY2tib3hdXVwiPlxuICAgICAgICAgIDxwYXBlci1jaGVja2JveCBjbGFzcz1cImRpZmYtbGF5ZXItY2hlY2tib3hcIiBpZD1cImxhYmVsLXBvaW50cy10b2dnbGVcIiBjaGVja2VkPVwie3tzaG93bGFiZWxlZH19XCI+XG4gICAgICAgICAgICB0cmFpbmluZ1xuICAgICAgICAgIDwvcGFwZXItY2hlY2tib3g+XG4gICAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgICAgICA8dGVtcGxhdGUgaXM9XCJkb20taWZcIiBpZj1cIltbc2hvd1VubGFiZWxlZENoZWNrYm94XV1cIj5cbiAgICAgICAgICA8cGFwZXItY2hlY2tib3ggY2xhc3M9XCJkaWZmLWxheWVyLWNoZWNrYm94XCIgaWQ9XCJsYWJlbC1wb2ludHMtdG9nZ2xlXCIgY2hlY2tlZD1cInt7c2hvd2xhYmVsZWR9fVwiPlxuICAgICAgICAgICAgbGFiZWxlZFxuICAgICAgICAgIDwvcGFwZXItY2hlY2tib3g+XG4gICAgICAgICBcbiAgICAgICAgICA8cGFwZXItY2hlY2tib3ggY2xhc3M9XCJkaWZmLWxheWVyLWNoZWNrYm94XCIgaWQ9XCJ1bmxhYmVsLXBvaW50cy10b2dnbGVcIiBjaGVja2VkPVwie3tzaG93VW5sYWJlbGVkfX1cIj5cbiAgICAgICAgICAgIHVubGFiZWxlZFxuICAgICAgICAgIDwvcGFwZXItY2hlY2tib3g+XG4gICAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgICAgICA8L3BhcGVyLWNoZWNrYm94PlxuICAgICAgICAgIDxwYXBlci1jaGVja2JveCBjbGFzcz1cImRpZmYtbGF5ZXItY2hlY2tib3hcIiBpZD1cInRlc3RpbmctcG9pbnRzLXRvZ2dsZVwiIGNoZWNrZWQ9XCJ7e3Nob3dUZXN0aW5nfX1cIj5cbiAgICAgICAgICAgIHRlc3RpbmdcbiAgICAgICAgICA8L3BhcGVyLWNoZWNrYm94PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInN0YWdlXCI+XG4gICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1pZlwiIGlmPVwiW1tfc2hvd05vdEF2YWxpYWJsZV1dXCI+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJwb3NpdGlvbjphYnNvbHV0ZTt0b3A6IDIwJTt3aWR0aDogMTAwJTt0ZXh0LWFsaWduOiBjZW50ZXI7XCI+XG4gICAgICAgIDxoMSBzdHlsZT1cImNvbG9yOnJlZDtcIj5Ob3QgQXZhbGlhYmxlITwvaDE+XG4gICAgICAgIDxoND55b3UgY2FuIGNob29zZSBSZXNOZXQtMTggYW5kIGxyOiAwLjAxIHRvIHNlZSB0aGUgdmlzdWFsaXphdGlvbiA8L2g0PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgICAgICA8ZGl2IGlkPVwic2NhdHRlclwiPlxuICBcbiAgICAgICAgICAgIDxzdmcgaWQ9XCJzZWxlY3RvclwiPjwvc3ZnPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDx2ei1wcm9qZWN0b3ItbWV0YWRhdGEtY2FyZFxuICAgICAgICAgICAgaWQ9XCJtZXRhZGF0YS1jYXJkXCJcbiAgICAgICAgICAgIHN0eWxlPVwibGVmdDogW1ttZXRhZGF0YVN0eWxlLmxlZnRdXTsgdG9wOltbbWV0YWRhdGFTdHlsZS50b3BdXTtcIlxuICAgICAgICAgID48L3Z6LXByb2plY3Rvci1tZXRhZGF0YS1jYXJkPlxuICAgICAgICAgIDxwYXBlci1pY29uLWJ1dHRvblxuICAgICAgICAgICAgcmFpc2VkXG4gICAgICAgICAgICBpY29uPVwiaGVscC1vdXRsaW5lXCJcbiAgICAgICAgICAgIGlkPVwiaGVscC0zZC1pY29uXCJcbiAgICAgICAgICA+PC9wYXBlci1pY29uLWJ1dHRvbj5cbiAgICAgICAgICA8cGFwZXItdG9vbHRpcCBhbmltYXRpb24tZGVsYXk9XCIwXCIgZm9yPVwiaGVscC0zZC1pY29uXCJcbiAgICAgICAgICAgID5IZWxwIHdpdGggaW50ZXJhY3Rpb24gY29udHJvbHMuPC9wYXBlci10b29sdGlwXG4gICAgICAgICAgPlxuICAgICAgICAgIDxwYXBlci1kaWFsb2cgaWQ9XCJoZWxwM2REaWFsb2dcIiB3aXRoLWJhY2tkcm9wPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1haW5cIiBkaWFsb2ctY29uZmlybSBhdXRvZm9jdXM+ICAgICAgICAgIFxuICAgICAgICAgICAgICA8Yj5DbGFzc2VzPC9iPlxuICAgICAgICAgICAgICA8Yj5OdW1iZXI8L2I+IDEwPGJyIC8+XG4gICAgICAgICAgICAgIDxoMz4zRCBMYWJlbCBJbnRybzwvaDM+XG4gICAgICAgICAgICAgIHJlY29tbW5lZDog8J+RjTxici8+XG4gICAgICAgICAgICAgIGN1c3RvbSBpbnRlcmVzdDog4pyFPGJyLz5cbiAgICAgICAgICAgICAgY3VzdG9tIG5vdCBpbnRlcmVzdDog4p2MPGJyLz5cblxuICAgICAgICAgICAgICBtYWpvcml0eTog8J+fojxici8+XG4gICAgICAgICAgICAgIDwhLS0gPGI+Wm9vbTwvYj4gTW91c2Ugd2hlZWwuPGJyIC8+XG4gICAgICAgICAgICAgIDxoMz5NZXRhIENhcmQ8L2gzPlxuICAgICAgICAgICAgICBwcmV2aW91cyBzZWxlY3RlZO+8muKYke+4j1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgSG9sZGluZyA8Yj5jdHJsPC9iPiByZXZlcnNlcyB0aGUgbW91c2UgY2xpY2tzLlxuICAgICAgICAgICAgICA8aDM+MkQgY29udHJvbHM8L2gzPlxuICAgICAgICAgICAgICA8Yj5QYW48L2I+IE1vdXNlIGxlZnQgY2xpY2suPGJyIC8+XG4gICAgICAgICAgICAgIDxiPlpvb208L2I+IE1vdXNlIHdoZWVsLiAtLT5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImRpc21pc3MtZGlhbG9nLW5vdGVcIj5DbGljayBhbnl3aGVyZSB0byBkaXNtaXNzLjwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9wYXBlci1kaWFsb2c+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGlkPVwicmlnaHQtcGFuZVwiIGNsYXNzPVwiaW5rLXBhbmVsXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJpbmstcGFuZWwtY29udGVudCBhY3RpdmVcIj5cbiAgICAgICAgICA8dnotcHJvamVjdG9yLWluc3BlY3Rvci1wYW5lbFxuICAgICAgICAgICAgaWQ9XCJpbnNwZWN0b3ItcGFuZWxcIlxuICAgICAgICAgID48L3Z6LXByb2plY3Rvci1pbnNwZWN0b3ItcGFuZWw+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGlkPVwiYm9va21hcmstcGFuZWwtY29udGFpbmVyXCI+XG4gICAgICAgICAgPHZ6LXByb2plY3Rvci1ib29rbWFyay1wYW5lbFxuICAgICAgICAgICAgaWQ9XCJib29rbWFyay1wYW5lbFwiXG4gICAgICAgICAgPjwvdnotcHJvamVjdG9yLWJvb2ttYXJrLXBhbmVsPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxwYXBlci10b2FzdCBpZD1cInRvYXN0XCIgYWx3YXlzLW9uLXRvcD48L3BhcGVyLXRvYXN0PlxuICA8L3RlbXBsYXRlPlxuYDtcbiJdfQ==