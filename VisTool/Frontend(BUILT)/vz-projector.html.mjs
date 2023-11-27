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
      <svg style="width="100%" height="130" id="mysvggg"></svg>
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLmh0bWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi90ZW5zb3Jib2FyZC9wcm9qZWN0b3IvdnotcHJvamVjdG9yLmh0bWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Z0ZBYWdGO0FBRWhGLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUV4QyxPQUFPLFVBQVUsQ0FBQztBQUVsQixNQUFNLENBQUMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBZ2MzQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyogQ29weXJpZ2h0IDIwMTYgVGhlIFRlbnNvckZsb3cgQXV0aG9ycy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG49PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuXG5pbXBvcnQgeyBodG1sIH0gZnJvbSAnQHBvbHltZXIvcG9seW1lcic7XG5cbmltcG9ydCAnLi9zdHlsZXMnO1xuXG5leHBvcnQgY29uc3QgdGVtcGxhdGUgPSBodG1sYFxuPHN0eWxlIGluY2x1ZGU9XCJ2ei1wcm9qZWN0b3Itc3R5bGVzXCI+PC9zdHlsZT5cbiAgICA8c3R5bGU+XG4gICAgICA6aG9zdCB7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICBoZWlnaHQ6IDEwMCU7XG4gICAgICB9XG5cbiAgICAgICNjb250YWluZXIge1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIH1cblxuICAgICAgLmhpZGRlbiB7XG4gICAgICAgIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgIH1cbiAgICAgIC5kaWZmLWxheWVyLWNoZWNrYm94e1xuICAgICAgICBtYXJnaW46IDAgNXB4O1xuICAgICAgfVxuXG4gICAgICAvKiBNYWluICovXG5cbiAgICAgICNtYWluIHtcbiAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICBmbGV4LWdyb3c6IDI7XG4gICAgICB9XG5cbiAgICAgICNtYWluIC5zdGFnZSB7XG4gICAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgICAgZmxleC1ncm93OiAyO1xuICAgICAgfVxuXG4gICAgICAjc2NhdHRlciB7XG4gICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgdG9wOiAwO1xuICAgICAgICBsZWZ0OiAwO1xuICAgICAgICByaWdodDogMDtcbiAgICAgICAgYm90dG9tOiAwO1xuICAgICAgfVxuXG4gICAgICAjc2VsZWN0b3Ige1xuICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICBoZWlnaHQ6IDEwMCU7XG4gICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICB9XG5cbiAgICAgICNsZWZ0LXBhbmUge1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgIG1pbi13aWR0aDogMjAycHg7XG4gICAgICAgIHdpZHRoOiAyMDJweDtcbiAgICAgICAgYm9yZGVyLXJpZ2h0OiAxcHggc29saWQgcmdiYSgwLCAwLCAwLCAwLjEpO1xuICAgICAgICBiYWNrZ3JvdW5kOiAjZmFmYWZhO1xuICAgICAgfVxuXG4gICAgICAjcmlnaHQtcGFuZSB7XG4gICAgICAgIGJvcmRlci1sZWZ0OiAxcHggc29saWQgcmdiYSgwLCAwLCAwLCAwLjEpO1xuICAgICAgICBiYWNrZ3JvdW5kOiAjZmFmYWZhO1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBoZWlnaHQ6IDEwMCU7XG4gICAgICAgIG1pbi13aWR0aDogMzAwcHg7XG4gICAgICAgIHdpZHRoOiAzNjBweDtcbiAgICAgIH1cblxuICAgICAgLmZpbGUtbmFtZSB7XG4gICAgICAgIG1hcmdpbi1yaWdodDogNXB4O1xuICAgICAgfVxuXG4gICAgICAuY29udHJvbCBpbnB1dFt0eXBlPSd0ZXh0J106Zm9jdXMge1xuICAgICAgICBvdXRsaW5lOiBub25lO1xuICAgICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgwLCAwLCAwLCAxKTtcbiAgICAgIH1cblxuICAgICAgLmNvbnRyb2wge1xuICAgICAgICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XG4gICAgICAgIHdpZHRoOiA0NSU7XG4gICAgICAgIHZlcnRpY2FsLWFsaWduOiB0b3A7XG4gICAgICAgIG1hcmdpbi1yaWdodDogMTBweDtcbiAgICAgICAgb3ZlcmZsb3cteDogaGlkZGVuO1xuICAgICAgfVxuXG4gICAgICAuY29udHJvbC5sYXN0IHtcbiAgICAgICAgbWFyZ2luLXJpZ2h0OiAwO1xuICAgICAgfVxuXG4gICAgICAjbm90aWZpY2F0aW9uLWRpYWxvZyB7XG4gICAgICAgIHdpZHRoOiA0MDBweDtcbiAgICAgICAgcGFkZGluZy1ib3R0b206IDIwcHg7XG4gICAgICB9XG5cbiAgICAgICNub3RpZmljYXRpb24tZGlhbG9nIHBhcGVyLWJ1dHRvbiB7XG4gICAgICAgIGJhY2tncm91bmQ6IG5vbmU7XG4gICAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XG4gICAgICB9XG5cbiAgICAgICNub3RpZmljYXRpb24tZGlhbG9nIC5wcm9ncmVzcyB7XG4gICAgICAgIC0tcGFwZXItc3Bpbm5lci1jb2xvcjogIzg4MGU0ZjtcbiAgICAgICAgLS1wYXBlci1zcGlubmVyLXN0cm9rZS13aWR0aDogMnB4O1xuICAgICAgfVxuXG4gICAgICAjbm90aWZ5LW1zZ3Mge1xuICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgfVxuXG4gICAgICAubm90aWZ5LW1zZyB7XG4gICAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XG4gICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgcGFkZGluZzogMDtcbiAgICAgIH1cblxuICAgICAgLm5vdGlmeS1tc2cuZXJyb3Ige1xuICAgICAgICB0ZXh0LWFsaWduOiBsZWZ0O1xuICAgICAgfVxuXG4gICAgICAuYnJ1c2ggLmV4dGVudCB7XG4gICAgICAgIHN0cm9rZTogI2ZmZjtcbiAgICAgICAgZmlsbC1vcGFjaXR5OiAwLjEyNTtcbiAgICAgICAgc2hhcGUtcmVuZGVyaW5nOiBjcmlzcEVkZ2VzO1xuICAgICAgfVxuXG4gICAgICAub3JpZ2luIHRleHQge1xuICAgICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XG4gICAgICB9XG5cbiAgICAgIC5vcmlnaW4gbGluZSB7XG4gICAgICAgIHN0cm9rZTogYmxhY2s7XG4gICAgICAgIHN0cm9rZS1vcGFjaXR5OiAwLjI7XG4gICAgICB9XG5cbiAgICAgIC8qIEluayBGcmFtZXdvcmsgKi9cblxuICAgICAgLyogLSBCdXR0b25zICovXG4gICAgICAuaW5rLWJ1dHRvbixcbiAgICAgIDo6c2hhZG93IC5pbmstYnV0dG9uIHtcbiAgICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgICBib3JkZXItcmFkaXVzOiAycHg7XG4gICAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICAgICAgcGFkZGluZzogMTBweDtcbiAgICAgICAgbWluLXdpZHRoOiAxMDBweDtcbiAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgIGJhY2tncm91bmQ6ICNlM2UzZTM7XG4gICAgICB9XG5cbiAgICAgIC5zdGF0dXMtYmFyLXBhbmVsIHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgdmlzaWJpbGl0eTpoaWRkZW47XG4gICAgICAgIHdpZHRoOiAwO1xuICAgICAgfVxuICAgICAgLmxheWVycy1jaGVja2JveHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgYm9yZGVyLWxlZnQ6IDJweCBzb2xpZDtcbiAgICAgICAgcGFkZGluZy1sZWZ0OiA2cHg7XG4gICAgICB9XG5cbiAgICAgIC5zdGF0dXMtYmFyLWVudHJ5IHtcbiAgICAgICAgYm9yZGVyLXJpZ2h0OiAxcHggc29saWQgcmdiYSgwLCAwLCAwLCAwLjUpO1xuICAgICAgICBtYXJnaW4tbGVmdDogNXB4O1xuICAgICAgICBwYWRkaW5nLWxlZnQ6IDVweDtcbiAgICAgICAgcGFkZGluZy1yaWdodDogNXB4O1xuICAgICAgfVxuXG4gICAgICAvKiAtIE1lbnViYXIgKi9cblxuICAgICAgLmluay1wYW5lbC1tZW51YmFyIHtcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICBoZWlnaHQ6IDYwcHg7XG4gICAgICAgIGJvcmRlci1ib3R0b206IHNvbGlkIDFweCAjZWVlO1xuICAgICAgICBwYWRkaW5nOiAwIDI0cHg7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICB9XG5cbiAgICAgIC5pbmstcGFuZWwtbWVudWJhciAuaW5rLWZhYnMge1xuICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgIHJpZ2h0OiAxMnB4O1xuICAgICAgICB0b3A6IDQwcHg7XG4gICAgICAgIHotaW5kZXg6IDE7XG4gICAgICB9XG5cbiAgICAgICNib29rbWFyay1wYW5lbCB7XG4gICAgICAgIGJvdHRvbTogMDtcbiAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICB3aWR0aDogMzAwcHg7XG4gICAgICB9XG4gICAgICAjYm9va21hcmstcGFuZWwtY29udGFpbmVyIHtcbiAgICAgICAgYm90dG9tOiA2MHB4O1xuICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB9XG5cbiAgICAgIC5pbmstZmFiIHtcbiAgICAgICAgbWFyZ2luLWxlZnQ6IDhweDtcbiAgICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgwLCAwLCAwLCAwLjAyKTtcbiAgICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICAgIGJveC1zaGFkb3c6IDAgMXB4IDNweCByZ2JhKDAsIDAsIDAsIDAuMyk7XG4gICAgICB9XG5cbiAgICAgICNtZXRhZGF0YS1jYXJkIHtcbiAgICAgICAgcG9zaXRpb246IGZpeGVkO1xuICAgICAgICBsZWZ0OiAzMjBweDtcbiAgICAgICAgdG9wOiAyNXB4O1xuICAgICAgICB6LWluZGV4Ojk5O1xuICAgICAgfVxuXG4gICAgICAjaGVscC0zZC1pY29uIHtcbiAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICB0b3A6IDIwcHg7XG4gICAgICAgIGxlZnQ6IDIwcHg7XG4gICAgICB9XG5cbiAgICAgICNoZWxwM2REaWFsb2cgLm1haW4ge1xuICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgIHBhZGRpbmc6IDIwcHg7XG4gICAgICB9XG5cbiAgICAgICNoZWxwM2REaWFsb2cgaDMge1xuICAgICAgICBtYXJnaW4tdG9wOiAyMHB4O1xuICAgICAgICBtYXJnaW4tYm90dG9tOiA1cHg7XG4gICAgICB9XG5cbiAgICAgICNoZWxwM2REaWFsb2cgaDM6Zmlyc3QtY2hpbGQge1xuICAgICAgICBtYXJnaW4tdG9wOiAwO1xuICAgICAgfVxuXG4gICAgICAjZGF0YS1wYW5lbCB7XG4gICAgICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCByZ2JhKDAsIDAsIDAsIDAuMSk7XG4gICAgICAgIG92ZXJmbG93LXk6IGF1dG87XG4gICAgICAgIG1pbi1oZWlnaHQ6IDM2MHB4O1xuICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgfVxuXG4gICAgICAjdG9hc3Qge1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAtLXBhcGVyLXRvYXN0LWNvbG9yOiAjZWVmZjQxO1xuICAgICAgfVxuICAgICAgLmNhbnZhbnMtbW92ZS1jb250YWluZXJ7XG4gICAgICAgIGJvcmRlci1yaWdodDogMXB4IHNvbGlkIHJnYmEoMCwwLDAsMC41KTtcbiAgICAgICAgYm9yZGVyLWxlZnQ6IDFweCBzb2xpZCByZ2JhKDAsMCwwLDAuNSk7XG4gICAgICAgIGRpc3BsYXk6ZmxleDtcbiAgICAgICAgcGFkZGluZzogMCAxMHB4IDAgNXB4O1xuICAgICAgICBtYXJnaW4tbGVmdDogMTBweDtcbiAgICAgIH1cbiAgICA8L3N0eWxlPlxuICAgIDxwYXBlci1kaWFsb2cgaWQ9XCJub3RpZmljYXRpb24tZGlhbG9nXCIgbW9kYWw+XG4gICAgICA8aDIgaWQ9XCJub3RpZmljYXRpb24tdGl0bGVcIj48L2gyPlxuICAgICAgPHBhcGVyLWRpYWxvZy1zY3JvbGxhYmxlPlxuICAgICAgICA8ZGl2IGlkPVwibm90aWZ5LW1zZ3NcIj48L2Rpdj5cbiAgICAgIDwvcGFwZXItZGlhbG9nLXNjcm9sbGFibGU+XG4gICAgICA8ZGl2IHN0eWxlPVwidGV4dC1hbGlnbjogY2VudGVyO1wiPlxuICAgICAgICA8cGFwZXItc3Bpbm5lci1saXRlIGFjdGl2ZSBjbGFzcz1cInByb2dyZXNzXCI+PC9wYXBlci1zcGlubmVyLWxpdGU+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJidXR0b25zXCI+XG4gICAgICAgIDxwYXBlci1idXR0b24gY2xhc3M9XCJjbG9zZS1idXR0b25cIiBkaWFsb2ctY29uZmlybSBhdXRvZm9jdXNcbiAgICAgICAgICA+Q2xvc2U8L3BhcGVyLWJ1dHRvblxuICAgICAgICA+XG4gICAgICA8L2Rpdj5cbiAgICA8L3BhcGVyLWRpYWxvZz5cbiAgICA8ZGl2IGlkPVwiY29udGFpbmVyXCIgc3R5bGU9XCJoZWlnaHQ6Y2FsYygxMDB2aCAtIDEzMHB4KVwiPlxuICAgICAgPGRpdiBzdHlsZT1cIndpZHRoOjEwMCU7IG92ZXJmbG93OmF1dG87IHBvc2l0aW9uOiBhYnNvbHV0ZTtiYWNrZ3JvdW5kOiAjZjJmMmYyO2JvdHRvbTogMDt6LWluZGV4Ojk5O1wiPlxuICAgICAgPHN2ZyBzdHlsZT1cIndpZHRoPVwiMTAwJVwiIGhlaWdodD1cIjEzMFwiIGlkPVwibXlzdmdnZ1wiPjwvc3ZnPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGlkPVwibGVmdC1wYW5lXCIgY2xhc3M9XCJpbmstcGFuZWxcIj5cbiAgICAgICAgPHZ6LXByb2plY3Rvci1kYXRhLXBhbmVsIGlkPVwiZGF0YS1wYW5lbFwiPjwvdnotcHJvamVjdG9yLWRhdGEtcGFuZWw+XG4gICAgICAgIDx2ei1wcm9qZWN0b3ItcHJvamVjdGlvbnMtcGFuZWxcbiAgICAgICAgICBpZD1cInByb2plY3Rpb25zLXBhbmVsXCJcbiAgICAgICAgPjwvdnotcHJvamVjdG9yLXByb2plY3Rpb25zLXBhbmVsPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGlkPVwibWFpblwiIGNsYXNzPVwiaW5rLXBhbmVsXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJpbmstcGFuZWwtbWVudWJhclwiPlxuICAgICAgICAgIDxwYXBlci1pY29uLWJ1dHRvblxuICAgICAgICAgICAgaWQ9XCJzZWxlY3RNb2RlXCJcbiAgICAgICAgICAgIGFsdD1cIkJvdW5kaW5nIGJveCBzZWxlY3Rpb25cIlxuICAgICAgICAgICAgdG9nZ2xlc1xuICAgICAgICAgICAgaWNvbj1cImltYWdlOnBob3RvLXNpemUtc2VsZWN0LXNtYWxsXCJcbiAgICAgICAgICA+PC9wYXBlci1pY29uLWJ1dHRvbj5cbiAgICAgICAgICA8cGFwZXItdG9vbHRpcFxuICAgICAgICAgICAgZm9yPVwic2VsZWN0TW9kZVwiXG4gICAgICAgICAgICBwb3NpdGlvbj1cImJvdHRvbVwiXG4gICAgICAgICAgICBhbmltYXRpb24tZGVsYXk9XCIwXCJcbiAgICAgICAgICAgIGZpdC10by12aXNpYmxlLWJvdW5kc1xuICAgICAgICAgICAgPkJvdW5kaW5nIGJveCBzZWxlY3Rpb248L3BhcGVyLXRvb2x0aXBcbiAgICAgICAgICA+XG5cbiAgICAgICAgICA8cGFwZXItaWNvbi1idXR0b25cbiAgICAgICAgICAgIHN0eWxlPVwid2lkdGg6IDBweDt2aXNpYmlsaXR5OiBoaWRkZW47bWFyZ2luOiAwO3BhZGRpbmc6IDA7XCJcbiAgICAgICAgICAgIGlkPVwiZWRpdE1vZGVcIlxuICAgICAgICAgICAgYWx0PVwiRWRpdCBjdXJyZW50IHNlbGVjdGlvblwiXG4gICAgICAgICAgICB0b2dnbGVzXG4gICAgICAgICAgICBpY29uPVwiaW1hZ2U6ZXhwb3N1cmVcIlxuICAgICAgICAgID48L3BhcGVyLWljb24tYnV0dG9uPlxuICAgICAgICBcblxuICAgICAgICAgIDxwYXBlci1pY29uLWJ1dHRvblxuICAgICAgICAgICAgaWQ9XCJuaWdodERheU1vZGVcIlxuICAgICAgICAgICAgc3R5bGU9XCJ3aWR0aDogMHB4O3Zpc2liaWxpdHk6IGhpZGRlbjttYXJnaW46IDA7cGFkZGluZzogMDtcIlxuICAgICAgICAgICAgYWx0PVwiRW5hYmxlL2Rpc2FibGUgbmlnaHQgbW9kZVwiXG4gICAgICAgICAgICB0b2dnbGVzXG4gICAgICAgICAgICBpY29uPVwiaW1hZ2U6YnJpZ2h0bmVzcy0yXCJcbiAgICAgICAgICA+PC9wYXBlci1pY29uLWJ1dHRvbj5cbiAgICAgICAgIFxuXG4gICAgICAgICAgPHBhcGVyLWljb24tYnV0dG9uXG4gICAgICAgICAgaWQ9XCJoaWRkZW5CYWNrZ3JvdW5kXCJcbiAgICAgICAgICBhbHQ9XCJzaG93IGJhY2tncm91bmRcIlxuICAgICAgICAgIHRvZ2dsZXNcbiAgICAgICAgICBpY29uPVwiaW1hZ2U6dGV4dHVyZVwiXG4gICAgICAgICAgc3R5bGU9XCJ2aXNpYmlsaXR5OmhpZGRlbjt3aWR0aDowcHg7XCJcbiAgICAgICAgICA+PC9wYXBlci1pY29uLWJ1dHRvbj5cbiAgICAgICAgICA8cGFwZXItdG9vbHRpcFxuICAgICAgICAgIHN0eWxlPVwidmlzaWJpbGl0eTpoaWRkZW47d2lkdGg6MHB4O21hcmdpbjogMDtwYWRkaW5nOiAwO1wiXG4gICAgICAgICAgICBmb3I9XCJoaWRkZW5CYWNrZ3JvdW5kXCJcbiAgICAgICAgICAgIHBvc2l0aW9uPVwiYm90dG9tXCJcbiAgICAgICAgICAgIGFuaW1hdGlvbi1kZWxheT1cIjBcIlxuICAgICAgICAgICAgZml0LXRvLXZpc2libGUtYm91bmRzXG4gICAgICAgICAgICA+SGlkZGVuL1Nob3cgYmFja2dyb3VuZDwvcGFwZXItdG9vbHRpcFxuICAgICAgICAgID5cblxuICAgICAgICAgIDxwYXBlci1pY29uLWJ1dHRvblxuICAgICAgICAgICAgc3R5bGU9XCJ3aWR0aDogMHB4O3Zpc2liaWxpdHk6IGhpZGRlbjttYXJnaW46IDA7cGFkZGluZzogMDtcIlxuICAgICAgICAgICAgaWQ9XCJsYWJlbHMzRE1vZGVcIlxuICAgICAgICAgICAgYWx0PVwiRW5hYmxlL2Rpc2FibGUgM0QgbGFiZWxzIG1vZGVcIlxuICAgICAgICAgICAgdG9nZ2xlc1xuICAgICAgICAgICAgaWNvbj1cImZvbnQtZG93bmxvYWRcIlxuICAgICAgICAgID48L3BhcGVyLWljb24tYnV0dG9uPlxuICAgICAgICAgXG5cbiAgICAgICAgICA8cGFwZXItaWNvbi1idXR0b25cbiAgICAgICAgICBzdHlsZT1cInZpc2liaWxpdHk6aGlkZGVuO3dpZHRoOjBweDttYXJnaW46IDA7cGFkZGluZzogMDtcIlxuICAgICAgICAgIGlkPVwidHJpYW5nbGVNb2RlXCJcbiAgICAgICAgICBhbHQ9XCJFbmFibGUvZGlzYWJsZSBzZWxlY3RlZCB0cmlhbmdsZVwiXG4gICAgICAgICAgdG9nZ2xlc1xuICAgICAgICAgIGljb249XCJkbnNcIlxuICAgICAgICA+PC9wYXBlci1pY29uLWJ1dHRvbj5cbiAgICAgICBcbiAgICAgICAgPGRpdiBjbGFzcz1cInN0YXR1cy1iYXItcGFuZWxcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzdGF0dXMtYmFyLWVudHJ5XCI+XG4gICAgICAgICAgICAgIFBvaW50czogPHNwYW4gY2xhc3M9XCJudW1EYXRhUG9pbnRzXCI+TG9hZGluZy4uLjwvc3Bhbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInN0YXR1cy1iYXItZW50cnlcIj5cbiAgICAgICAgICAgICAgRGltZW5zaW9uOiA8c3BhbiBjbGFzcz1cImRpbVwiPkxvYWRpbmcuLi48L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgaWQ9XCJzdGF0dXMtYmFyXCJcbiAgICAgICAgICAgICAgY2xhc3M9XCJzdGF0dXMtYmFyLWVudHJ5XCJcbiAgICAgICAgICAgICAgc3R5bGU9XCJkaXNwbGF5OiBub25lO1wiXG4gICAgICAgICAgICA+PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImluay1mYWJzXCI+XG4gICAgICAgICAgICA8cGFwZXItaWNvbi1idXR0b25cbiAgICAgICAgICAgICAgaWQ9XCJyZXNldC16b29tXCJcbiAgICAgICAgICAgICAgY2xhc3M9XCJpbmstZmFiXCJcbiAgICAgICAgICAgICAgYWx0PVwiUmVzZXQgem9vbSB0byBmaXQgYWxsIHBvaW50c1wiXG4gICAgICAgICAgICAgIGljb249XCJob21lXCJcbiAgICAgICAgICAgID48L3BhcGVyLWljb24tYnV0dG9uPlxuICAgICAgICAgICAgPHBhcGVyLXRvb2x0aXAgZm9yPVwicmVzZXQtem9vbVwiIHBvc2l0aW9uPVwibGVmdFwiIGFuaW1hdGlvbi1kZWxheT1cIjBcIlxuICAgICAgICAgICAgICA+UmVzZXQgem9vbSB0byBmaXQgYWxsIHBvaW50czwvcGFwZXItdG9vbHRpcFxuICAgICAgICAgICAgPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJsYXllcnMtY2hlY2tib3hcIj5cbiAgICAgICAgICA8dGVtcGxhdGUgaXM9XCJkb20taWZcIiBpZj1cIltbIXNob3dVbmxhYmVsZWRDaGVja2JveF1dXCI+XG4gICAgICAgICAgPHBhcGVyLWNoZWNrYm94IGNsYXNzPVwiZGlmZi1sYXllci1jaGVja2JveFwiIGlkPVwibGFiZWwtcG9pbnRzLXRvZ2dsZVwiIGNoZWNrZWQ9XCJ7e3Nob3dsYWJlbGVkfX1cIj5cbiAgICAgICAgICAgIHRyYWluaW5nXG4gICAgICAgICAgPC9wYXBlci1jaGVja2JveD5cbiAgICAgICAgICA8L3RlbXBsYXRlPlxuICAgICAgICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1pZlwiIGlmPVwiW1tzaG93VW5sYWJlbGVkQ2hlY2tib3hdXVwiPlxuICAgICAgICAgIDxwYXBlci1jaGVja2JveCBjbGFzcz1cImRpZmYtbGF5ZXItY2hlY2tib3hcIiBpZD1cImxhYmVsLXBvaW50cy10b2dnbGVcIiBjaGVja2VkPVwie3tzaG93bGFiZWxlZH19XCI+XG4gICAgICAgICAgICBsYWJlbGVkXG4gICAgICAgICAgPC9wYXBlci1jaGVja2JveD5cbiAgICAgICAgIFxuICAgICAgICAgIDxwYXBlci1jaGVja2JveCBjbGFzcz1cImRpZmYtbGF5ZXItY2hlY2tib3hcIiBpZD1cInVubGFiZWwtcG9pbnRzLXRvZ2dsZVwiIGNoZWNrZWQ9XCJ7e3Nob3dVbmxhYmVsZWR9fVwiPlxuICAgICAgICAgICAgdW5sYWJlbGVkXG4gICAgICAgICAgPC9wYXBlci1jaGVja2JveD5cbiAgICAgICAgICA8L3RlbXBsYXRlPlxuICAgICAgICAgIDwvcGFwZXItY2hlY2tib3g+XG4gICAgICAgICAgPHBhcGVyLWNoZWNrYm94IGNsYXNzPVwiZGlmZi1sYXllci1jaGVja2JveFwiIGlkPVwidGVzdGluZy1wb2ludHMtdG9nZ2xlXCIgY2hlY2tlZD1cInt7c2hvd1Rlc3Rpbmd9fVwiPlxuICAgICAgICAgICAgdGVzdGluZ1xuICAgICAgICAgIDwvcGFwZXItY2hlY2tib3g+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwic3RhZ2VcIj5cbiAgICAgICAgPHRlbXBsYXRlIGlzPVwiZG9tLWlmXCIgaWY9XCJbW19zaG93Tm90QXZhbGlhYmxlXV1cIj5cbiAgICAgICAgPGRpdiBzdHlsZT1cInBvc2l0aW9uOmFic29sdXRlO3RvcDogMjAlO3dpZHRoOiAxMDAlO3RleHQtYWxpZ246IGNlbnRlcjtcIj5cbiAgICAgICAgPGgxIHN0eWxlPVwiY29sb3I6cmVkO1wiPk5vdCBBdmFsaWFibGUhPC9oMT5cbiAgICAgICAgPGg0PnlvdSBjYW4gY2hvb3NlIFJlc05ldC0xOCBhbmQgbHI6IDAuMDEgdG8gc2VlIHRoZSB2aXN1YWxpemF0aW9uIDwvaDQ+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8L3RlbXBsYXRlPlxuICAgICAgICAgIDxkaXYgaWQ9XCJzY2F0dGVyXCI+XG4gIFxuICAgICAgICAgICAgPHN2ZyBpZD1cInNlbGVjdG9yXCI+PC9zdmc+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPHZ6LXByb2plY3Rvci1tZXRhZGF0YS1jYXJkXG4gICAgICAgICAgICBpZD1cIm1ldGFkYXRhLWNhcmRcIlxuICAgICAgICAgICAgc3R5bGU9XCJsZWZ0OiBbW21ldGFkYXRhU3R5bGUubGVmdF1dOyB0b3A6W1ttZXRhZGF0YVN0eWxlLnRvcF1dO1wiXG4gICAgICAgICAgPjwvdnotcHJvamVjdG9yLW1ldGFkYXRhLWNhcmQ+XG4gICAgICAgICAgPHBhcGVyLWljb24tYnV0dG9uXG4gICAgICAgICAgICByYWlzZWRcbiAgICAgICAgICAgIGljb249XCJoZWxwLW91dGxpbmVcIlxuICAgICAgICAgICAgaWQ9XCJoZWxwLTNkLWljb25cIlxuICAgICAgICAgID48L3BhcGVyLWljb24tYnV0dG9uPlxuICAgICAgICAgIDxwYXBlci10b29sdGlwIGFuaW1hdGlvbi1kZWxheT1cIjBcIiBmb3I9XCJoZWxwLTNkLWljb25cIlxuICAgICAgICAgICAgPkhlbHAgd2l0aCBpbnRlcmFjdGlvbiBjb250cm9scy48L3BhcGVyLXRvb2x0aXBcbiAgICAgICAgICA+XG4gICAgICAgICAgPHBhcGVyLWRpYWxvZyBpZD1cImhlbHAzZERpYWxvZ1wiIHdpdGgtYmFja2Ryb3A+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWFpblwiIGRpYWxvZy1jb25maXJtIGF1dG9mb2N1cz4gICAgICAgICAgXG4gICAgICAgICAgICAgIDxiPkNsYXNzZXM8L2I+XG4gICAgICAgICAgICAgIDxiPk51bWJlcjwvYj4gMTA8YnIgLz5cbiAgICAgICAgICAgICAgPGgzPjNEIExhYmVsIEludHJvPC9oMz5cbiAgICAgICAgICAgICAgcmVjb21tbmVkOiDwn5GNPGJyLz5cbiAgICAgICAgICAgICAgY3VzdG9tIGludGVyZXN0OiDinIU8YnIvPlxuICAgICAgICAgICAgICBjdXN0b20gbm90IGludGVyZXN0OiDinYw8YnIvPlxuXG4gICAgICAgICAgICAgIG1ham9yaXR5OiDwn5+iPGJyLz5cbiAgICAgICAgICAgICAgPCEtLSA8Yj5ab29tPC9iPiBNb3VzZSB3aGVlbC48YnIgLz5cbiAgICAgICAgICAgICAgPGgzPk1ldGEgQ2FyZDwvaDM+XG4gICAgICAgICAgICAgIHByZXZpb3VzIHNlbGVjdGVk77ya4piR77iPXG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBIb2xkaW5nIDxiPmN0cmw8L2I+IHJldmVyc2VzIHRoZSBtb3VzZSBjbGlja3MuXG4gICAgICAgICAgICAgIDxoMz4yRCBjb250cm9sczwvaDM+XG4gICAgICAgICAgICAgIDxiPlBhbjwvYj4gTW91c2UgbGVmdCBjbGljay48YnIgLz5cbiAgICAgICAgICAgICAgPGI+Wm9vbTwvYj4gTW91c2Ugd2hlZWwuIC0tPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZGlzbWlzcy1kaWFsb2ctbm90ZVwiPkNsaWNrIGFueXdoZXJlIHRvIGRpc21pc3MuPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L3BhcGVyLWRpYWxvZz5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgaWQ9XCJyaWdodC1wYW5lXCIgY2xhc3M9XCJpbmstcGFuZWxcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImluay1wYW5lbC1jb250ZW50IGFjdGl2ZVwiPlxuICAgICAgICAgIDx2ei1wcm9qZWN0b3ItaW5zcGVjdG9yLXBhbmVsXG4gICAgICAgICAgICBpZD1cImluc3BlY3Rvci1wYW5lbFwiXG4gICAgICAgICAgPjwvdnotcHJvamVjdG9yLWluc3BlY3Rvci1wYW5lbD5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgaWQ9XCJib29rbWFyay1wYW5lbC1jb250YWluZXJcIj5cbiAgICAgICAgICA8dnotcHJvamVjdG9yLWJvb2ttYXJrLXBhbmVsXG4gICAgICAgICAgICBpZD1cImJvb2ttYXJrLXBhbmVsXCJcbiAgICAgICAgICA+PC92ei1wcm9qZWN0b3ItYm9va21hcmstcGFuZWw+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICAgPHBhcGVyLXRvYXN0IGlkPVwidG9hc3RcIiBhbHdheXMtb24tdG9wPjwvcGFwZXItdG9hc3Q+XG4gIDwvdGVtcGxhdGU+XG5gO1xuIl19