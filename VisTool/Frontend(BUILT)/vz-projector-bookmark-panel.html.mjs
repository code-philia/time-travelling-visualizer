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
import '../components/polymer/irons_and_papers';
import './styles';
export const template = html `
  <style include="vz-projector-styles"></style>
  <style>
    #title {
      background-color: #fafafa;
      color: black;
      font-weight: 500;
      left: 0;
      line-height: 60px;
      padding-left: 24px;
      position: absolute;
      width: 276px;
    }
    #bookmark-container {
      background-color: #fafafa;
      display:none;
    }
    #icon-container {
      line-height: 60px;
      position: absolute;
      right: 0;
    }
    #header {
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      position: relative;
    }
    #panel {
      background-color: #fafafa;
      position: relative;
      overflow-y: scroll;
      top: 60px;
      max-height: 50vh;
    }

    #save-container {
      text-align: center;
    }

    .state-radio {
      display: table-cell;
      vertical-align: middle;
      padding-top: 16px;
    }

    .state-label {
      display: table-cell;
      vertical-align: middle;
      top: 14px;
    }

    .state-label-input {
      width: 194px;
    }

    .state-clear {
      display: table-cell;
      vertical-align: middle;
      padding-top: 20px;
    }
    #state-file {
      display: none;
    }
    #no-bookmarks {
      padding: 0 24px;
    }
    #action-buttons-container .add-icon-button {
      background-color: #03a9f4;
      color: white;
      margin: 0 4px 4px auto;
      right: 7px;
      top: -4px;
    }
    .upload-download-icon-button {
      padding: 0;
    }
    #action-buttons-container {
      display: flex;
      margin-left: 34px;
      margin-top: 6px;
    }
    .ink-fab {
      border-radius: 50%;
      background: white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
    paper-textarea {
      --paper-input-container-input: {
        font-size: 12px;
      }
      --paper-font-caption: {
        display: none;
      }
    }
  </style>

  <!-- Bookmarking controls -->
  <div id="bookmark-container">
    <div id="header">
      <div id="title">
        BOOKMARKS ([[savedStates.length]])
        <paper-icon-button icon="help" class="help-icon"></paper-icon-button>
        <paper-tooltip animation-delay="0" position="top" offset="0">
          Open this drawer to save a set of views of the projection, including
          selected points. A file containing the bookmarks can then be saved and
          later loaded to view them.
        </paper-tooltip>
      </div>
      <div id="icon-container">
        <!-- Icons and event handlers are inverted because the tray expands upwards. -->
        <paper-icon-button
          id="expand-more"
          icon="expand-less"
          on-tap="_expandMore"
        ></paper-icon-button>
        <paper-icon-button
          id="expand-less"
          style="display: none"
          icon="expand-more"
          on-tap="_expandLess"
        ></paper-icon-button>
      </div>
    </div>
    <iron-collapse id="panel">
      <!-- Saving state section -->
      <div id="state-section">
        <template is="dom-if" if="[[!savedStates.length]]">
          <p id="no-bookmarks">
            No bookmarks yet, upload a bookmarks file or add a new bookmark by
            clicking the "+" below.
          </p>
        </template>

        <template is="dom-repeat" items="{{savedStates}}">
          <div class="state-row">
            <div class="state-radio">
              <template is="dom-if" if="{{item.isSelected}}">
                <paper-icon-button
                  icon="radio-button-checked"
                ></paper-icon-button>
              </template>
              <template is="dom-if" if="{{!item.isSelected}}">
                <paper-icon-button
                  icon="radio-button-unchecked"
                  data-index$="{{index}}"
                  on-tap="_radioButtonHandler"
                ></paper-icon-button>
              </template>
            </div>
            <div class="state-label">
              <paper-textarea
                value="[[item.label]]"
                class="state-label-input"
                on-keyup="_labelChange"
                data-index$="[[index]]"
                autoresizing
              ></paper-textarea>
            </div>
            <div class="state-clear">
              <paper-icon-button
                icon="clear"
                data-index$="{{index}}"
                on-tap="_clearButtonHandler"
              ></paper-icon-button>
            </div>
          </div>
        </template>

        <div id="action-buttons-container">
          <paper-icon-button
            class="upload-download-icon-button"
            icon="save"
            title="Save bookmarks"
            disabled="[[!hasStates]]"
            on-tap="_downloadFile"
          ></paper-icon-button>
          <paper-icon-button
            class="upload-download-icon-button"
            icon="file-upload"
            title="Load bookmarks"
            on-tap="_uploadFile"
          ></paper-icon-button>
          <paper-icon-button
            class="add-icon-button ink-fab"
            icon="add"
            title="Add bookmark"
            on-tap="_addBookmark"
          ></paper-icon-button>
          <input type="file" id="state-file" name="state-file" />
        </div>
      </div>
    </iron-collapse>
  </div>
`;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLWJvb2ttYXJrLXBhbmVsLmh0bWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi90ZW5zb3Jib2FyZC9wcm9qZWN0b3IvdnotcHJvamVjdG9yLWJvb2ttYXJrLXBhbmVsLmh0bWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Z0ZBYWdGO0FBRWhGLE9BQU8sRUFBQyxJQUFJLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUV0QyxPQUFPLHdDQUF3QyxDQUFDO0FBRWhELE9BQU8sVUFBVSxDQUFDO0FBRWxCLE1BQU0sQ0FBQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQWdNM0IsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qIENvcHlyaWdodCAyMDE2IFRoZSBUZW5zb3JGbG93IEF1dGhvcnMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuaW1wb3J0IHtodG1sfSBmcm9tICdAcG9seW1lci9wb2x5bWVyJztcblxuaW1wb3J0ICcuLi9jb21wb25lbnRzL3BvbHltZXIvaXJvbnNfYW5kX3BhcGVycyc7XG5cbmltcG9ydCAnLi9zdHlsZXMnO1xuXG5leHBvcnQgY29uc3QgdGVtcGxhdGUgPSBodG1sYFxuICA8c3R5bGUgaW5jbHVkZT1cInZ6LXByb2plY3Rvci1zdHlsZXNcIj48L3N0eWxlPlxuICA8c3R5bGU+XG4gICAgI3RpdGxlIHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICNmYWZhZmE7XG4gICAgICBjb2xvcjogYmxhY2s7XG4gICAgICBmb250LXdlaWdodDogNTAwO1xuICAgICAgbGVmdDogMDtcbiAgICAgIGxpbmUtaGVpZ2h0OiA2MHB4O1xuICAgICAgcGFkZGluZy1sZWZ0OiAyNHB4O1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgd2lkdGg6IDI3NnB4O1xuICAgIH1cbiAgICAjYm9va21hcmstY29udGFpbmVyIHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICNmYWZhZmE7XG4gICAgICBkaXNwbGF5Om5vbmU7XG4gICAgfVxuICAgICNpY29uLWNvbnRhaW5lciB7XG4gICAgICBsaW5lLWhlaWdodDogNjBweDtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHJpZ2h0OiAwO1xuICAgIH1cbiAgICAjaGVhZGVyIHtcbiAgICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCByZ2JhKDAsIDAsIDAsIDAuMSk7XG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgfVxuICAgICNwYW5lbCB7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjZmFmYWZhO1xuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgb3ZlcmZsb3cteTogc2Nyb2xsO1xuICAgICAgdG9wOiA2MHB4O1xuICAgICAgbWF4LWhlaWdodDogNTB2aDtcbiAgICB9XG5cbiAgICAjc2F2ZS1jb250YWluZXIge1xuICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgIH1cblxuICAgIC5zdGF0ZS1yYWRpbyB7XG4gICAgICBkaXNwbGF5OiB0YWJsZS1jZWxsO1xuICAgICAgdmVydGljYWwtYWxpZ246IG1pZGRsZTtcbiAgICAgIHBhZGRpbmctdG9wOiAxNnB4O1xuICAgIH1cblxuICAgIC5zdGF0ZS1sYWJlbCB7XG4gICAgICBkaXNwbGF5OiB0YWJsZS1jZWxsO1xuICAgICAgdmVydGljYWwtYWxpZ246IG1pZGRsZTtcbiAgICAgIHRvcDogMTRweDtcbiAgICB9XG5cbiAgICAuc3RhdGUtbGFiZWwtaW5wdXQge1xuICAgICAgd2lkdGg6IDE5NHB4O1xuICAgIH1cblxuICAgIC5zdGF0ZS1jbGVhciB7XG4gICAgICBkaXNwbGF5OiB0YWJsZS1jZWxsO1xuICAgICAgdmVydGljYWwtYWxpZ246IG1pZGRsZTtcbiAgICAgIHBhZGRpbmctdG9wOiAyMHB4O1xuICAgIH1cbiAgICAjc3RhdGUtZmlsZSB7XG4gICAgICBkaXNwbGF5OiBub25lO1xuICAgIH1cbiAgICAjbm8tYm9va21hcmtzIHtcbiAgICAgIHBhZGRpbmc6IDAgMjRweDtcbiAgICB9XG4gICAgI2FjdGlvbi1idXR0b25zLWNvbnRhaW5lciAuYWRkLWljb24tYnV0dG9uIHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICMwM2E5ZjQ7XG4gICAgICBjb2xvcjogd2hpdGU7XG4gICAgICBtYXJnaW46IDAgNHB4IDRweCBhdXRvO1xuICAgICAgcmlnaHQ6IDdweDtcbiAgICAgIHRvcDogLTRweDtcbiAgICB9XG4gICAgLnVwbG9hZC1kb3dubG9hZC1pY29uLWJ1dHRvbiB7XG4gICAgICBwYWRkaW5nOiAwO1xuICAgIH1cbiAgICAjYWN0aW9uLWJ1dHRvbnMtY29udGFpbmVyIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBtYXJnaW4tbGVmdDogMzRweDtcbiAgICAgIG1hcmdpbi10b3A6IDZweDtcbiAgICB9XG4gICAgLmluay1mYWIge1xuICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xuICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICBib3gtc2hhZG93OiAwIDFweCAzcHggcmdiYSgwLCAwLCAwLCAwLjMpO1xuICAgIH1cbiAgICBwYXBlci10ZXh0YXJlYSB7XG4gICAgICAtLXBhcGVyLWlucHV0LWNvbnRhaW5lci1pbnB1dDoge1xuICAgICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICB9XG4gICAgICAtLXBhcGVyLWZvbnQtY2FwdGlvbjoge1xuICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgfVxuICAgIH1cbiAgPC9zdHlsZT5cblxuICA8IS0tIEJvb2ttYXJraW5nIGNvbnRyb2xzIC0tPlxuICA8ZGl2IGlkPVwiYm9va21hcmstY29udGFpbmVyXCI+XG4gICAgPGRpdiBpZD1cImhlYWRlclwiPlxuICAgICAgPGRpdiBpZD1cInRpdGxlXCI+XG4gICAgICAgIEJPT0tNQVJLUyAoW1tzYXZlZFN0YXRlcy5sZW5ndGhdXSlcbiAgICAgICAgPHBhcGVyLWljb24tYnV0dG9uIGljb249XCJoZWxwXCIgY2xhc3M9XCJoZWxwLWljb25cIj48L3BhcGVyLWljb24tYnV0dG9uPlxuICAgICAgICA8cGFwZXItdG9vbHRpcCBhbmltYXRpb24tZGVsYXk9XCIwXCIgcG9zaXRpb249XCJ0b3BcIiBvZmZzZXQ9XCIwXCI+XG4gICAgICAgICAgT3BlbiB0aGlzIGRyYXdlciB0byBzYXZlIGEgc2V0IG9mIHZpZXdzIG9mIHRoZSBwcm9qZWN0aW9uLCBpbmNsdWRpbmdcbiAgICAgICAgICBzZWxlY3RlZCBwb2ludHMuIEEgZmlsZSBjb250YWluaW5nIHRoZSBib29rbWFya3MgY2FuIHRoZW4gYmUgc2F2ZWQgYW5kXG4gICAgICAgICAgbGF0ZXIgbG9hZGVkIHRvIHZpZXcgdGhlbS5cbiAgICAgICAgPC9wYXBlci10b29sdGlwPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGlkPVwiaWNvbi1jb250YWluZXJcIj5cbiAgICAgICAgPCEtLSBJY29ucyBhbmQgZXZlbnQgaGFuZGxlcnMgYXJlIGludmVydGVkIGJlY2F1c2UgdGhlIHRyYXkgZXhwYW5kcyB1cHdhcmRzLiAtLT5cbiAgICAgICAgPHBhcGVyLWljb24tYnV0dG9uXG4gICAgICAgICAgaWQ9XCJleHBhbmQtbW9yZVwiXG4gICAgICAgICAgaWNvbj1cImV4cGFuZC1sZXNzXCJcbiAgICAgICAgICBvbi10YXA9XCJfZXhwYW5kTW9yZVwiXG4gICAgICAgID48L3BhcGVyLWljb24tYnV0dG9uPlxuICAgICAgICA8cGFwZXItaWNvbi1idXR0b25cbiAgICAgICAgICBpZD1cImV4cGFuZC1sZXNzXCJcbiAgICAgICAgICBzdHlsZT1cImRpc3BsYXk6IG5vbmVcIlxuICAgICAgICAgIGljb249XCJleHBhbmQtbW9yZVwiXG4gICAgICAgICAgb24tdGFwPVwiX2V4cGFuZExlc3NcIlxuICAgICAgICA+PC9wYXBlci1pY29uLWJ1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxpcm9uLWNvbGxhcHNlIGlkPVwicGFuZWxcIj5cbiAgICAgIDwhLS0gU2F2aW5nIHN0YXRlIHNlY3Rpb24gLS0+XG4gICAgICA8ZGl2IGlkPVwic3RhdGUtc2VjdGlvblwiPlxuICAgICAgICA8dGVtcGxhdGUgaXM9XCJkb20taWZcIiBpZj1cIltbIXNhdmVkU3RhdGVzLmxlbmd0aF1dXCI+XG4gICAgICAgICAgPHAgaWQ9XCJuby1ib29rbWFya3NcIj5cbiAgICAgICAgICAgIE5vIGJvb2ttYXJrcyB5ZXQsIHVwbG9hZCBhIGJvb2ttYXJrcyBmaWxlIG9yIGFkZCBhIG5ldyBib29rbWFyayBieVxuICAgICAgICAgICAgY2xpY2tpbmcgdGhlIFwiK1wiIGJlbG93LlxuICAgICAgICAgIDwvcD5cbiAgICAgICAgPC90ZW1wbGF0ZT5cblxuICAgICAgICA8dGVtcGxhdGUgaXM9XCJkb20tcmVwZWF0XCIgaXRlbXM9XCJ7e3NhdmVkU3RhdGVzfX1cIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwic3RhdGUtcm93XCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3RhdGUtcmFkaW9cIj5cbiAgICAgICAgICAgICAgPHRlbXBsYXRlIGlzPVwiZG9tLWlmXCIgaWY9XCJ7e2l0ZW0uaXNTZWxlY3RlZH19XCI+XG4gICAgICAgICAgICAgICAgPHBhcGVyLWljb24tYnV0dG9uXG4gICAgICAgICAgICAgICAgICBpY29uPVwicmFkaW8tYnV0dG9uLWNoZWNrZWRcIlxuICAgICAgICAgICAgICAgID48L3BhcGVyLWljb24tYnV0dG9uPlxuICAgICAgICAgICAgICA8L3RlbXBsYXRlPlxuICAgICAgICAgICAgICA8dGVtcGxhdGUgaXM9XCJkb20taWZcIiBpZj1cInt7IWl0ZW0uaXNTZWxlY3RlZH19XCI+XG4gICAgICAgICAgICAgICAgPHBhcGVyLWljb24tYnV0dG9uXG4gICAgICAgICAgICAgICAgICBpY29uPVwicmFkaW8tYnV0dG9uLXVuY2hlY2tlZFwiXG4gICAgICAgICAgICAgICAgICBkYXRhLWluZGV4JD1cInt7aW5kZXh9fVwiXG4gICAgICAgICAgICAgICAgICBvbi10YXA9XCJfcmFkaW9CdXR0b25IYW5kbGVyXCJcbiAgICAgICAgICAgICAgICA+PC9wYXBlci1pY29uLWJ1dHRvbj5cbiAgICAgICAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInN0YXRlLWxhYmVsXCI+XG4gICAgICAgICAgICAgIDxwYXBlci10ZXh0YXJlYVxuICAgICAgICAgICAgICAgIHZhbHVlPVwiW1tpdGVtLmxhYmVsXV1cIlxuICAgICAgICAgICAgICAgIGNsYXNzPVwic3RhdGUtbGFiZWwtaW5wdXRcIlxuICAgICAgICAgICAgICAgIG9uLWtleXVwPVwiX2xhYmVsQ2hhbmdlXCJcbiAgICAgICAgICAgICAgICBkYXRhLWluZGV4JD1cIltbaW5kZXhdXVwiXG4gICAgICAgICAgICAgICAgYXV0b3Jlc2l6aW5nXG4gICAgICAgICAgICAgID48L3BhcGVyLXRleHRhcmVhPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3RhdGUtY2xlYXJcIj5cbiAgICAgICAgICAgICAgPHBhcGVyLWljb24tYnV0dG9uXG4gICAgICAgICAgICAgICAgaWNvbj1cImNsZWFyXCJcbiAgICAgICAgICAgICAgICBkYXRhLWluZGV4JD1cInt7aW5kZXh9fVwiXG4gICAgICAgICAgICAgICAgb24tdGFwPVwiX2NsZWFyQnV0dG9uSGFuZGxlclwiXG4gICAgICAgICAgICAgID48L3BhcGVyLWljb24tYnV0dG9uPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvdGVtcGxhdGU+XG5cbiAgICAgICAgPGRpdiBpZD1cImFjdGlvbi1idXR0b25zLWNvbnRhaW5lclwiPlxuICAgICAgICAgIDxwYXBlci1pY29uLWJ1dHRvblxuICAgICAgICAgICAgY2xhc3M9XCJ1cGxvYWQtZG93bmxvYWQtaWNvbi1idXR0b25cIlxuICAgICAgICAgICAgaWNvbj1cInNhdmVcIlxuICAgICAgICAgICAgdGl0bGU9XCJTYXZlIGJvb2ttYXJrc1wiXG4gICAgICAgICAgICBkaXNhYmxlZD1cIltbIWhhc1N0YXRlc11dXCJcbiAgICAgICAgICAgIG9uLXRhcD1cIl9kb3dubG9hZEZpbGVcIlxuICAgICAgICAgID48L3BhcGVyLWljb24tYnV0dG9uPlxuICAgICAgICAgIDxwYXBlci1pY29uLWJ1dHRvblxuICAgICAgICAgICAgY2xhc3M9XCJ1cGxvYWQtZG93bmxvYWQtaWNvbi1idXR0b25cIlxuICAgICAgICAgICAgaWNvbj1cImZpbGUtdXBsb2FkXCJcbiAgICAgICAgICAgIHRpdGxlPVwiTG9hZCBib29rbWFya3NcIlxuICAgICAgICAgICAgb24tdGFwPVwiX3VwbG9hZEZpbGVcIlxuICAgICAgICAgID48L3BhcGVyLWljb24tYnV0dG9uPlxuICAgICAgICAgIDxwYXBlci1pY29uLWJ1dHRvblxuICAgICAgICAgICAgY2xhc3M9XCJhZGQtaWNvbi1idXR0b24gaW5rLWZhYlwiXG4gICAgICAgICAgICBpY29uPVwiYWRkXCJcbiAgICAgICAgICAgIHRpdGxlPVwiQWRkIGJvb2ttYXJrXCJcbiAgICAgICAgICAgIG9uLXRhcD1cIl9hZGRCb29rbWFya1wiXG4gICAgICAgICAgPjwvcGFwZXItaWNvbi1idXR0b24+XG4gICAgICAgICAgPGlucHV0IHR5cGU9XCJmaWxlXCIgaWQ9XCJzdGF0ZS1maWxlXCIgbmFtZT1cInN0YXRlLWZpbGVcIiAvPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvaXJvbi1jb2xsYXBzZT5cbiAgPC9kaXY+XG5gO1xuIl19