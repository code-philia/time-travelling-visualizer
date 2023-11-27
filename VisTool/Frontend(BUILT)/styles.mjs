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
import { registerStyleDomModule } from '../components/polymer/register_style_dom_module';
registerStyleDomModule({
    moduleName: 'vz-projector-styles',
    styleContent: `
    :host {
      --paper-input-container-label: {
        font-size: 14px;
      }
      --paper-input-container-input: {
        font-size: 14px;
      }
      /* TODO: Figure out why this doesn't work */
      --paper-dropdown-menu-input: {
        font-size: 14px;
      }
    }

    paper-button {
      background: #e3e3e3;
      margin-left: 0;
      text-transform: none;
    }

    paper-dropdown-menu paper-item {
      font-size: 13px;
    }

    paper-tooltip {
      max-width: 200px;
      --paper-tooltip: {
        font-size: 12px;
      }
    }

    paper-checkbox {
      --paper-checkbox-checked-color: #880e4f;
    }

    paper-toggle-button {
      --paper-toggle-button-checked-bar-color: #880e4f;
      --paper-toggle-button-checked-button-color: #880e4f;
      --paper-toggle-button-checked-ink-color: #880e4f;
    }

    paper-icon-button {
      border-radius: 50%;
    }

    paper-icon-button[active] {
      color: white;
      background-color: #880e4f;
    }

    .slider {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
      justify-content: space-between;
    }

    .slider span {
      width: 35px;
      text-align: right;
    }

    .slider label {
      align-items: center;
      display: flex;
    }

    .help-icon {
      height: 15px;
      left: 2px;
      min-width: 15px;
      min-height: 15px;
      margin: 0;
      padding: 0;
      top: -2px;
      width: 15px;
    }

    .ink-panel {
      display: flex;
      flex-direction: column;
      font-size: 14px;
    }

    .ink-panel h4 {
      border-bottom: 1px solid #ddd;
      font-size: 14px;
      font-weight: 500;
      margin: 0;
      margin-bottom: 10px;
      padding-bottom: 5px;
    }

    .ink-panel-header {
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      height: 50px;
    }

    .ink-panel-content {
      display: none;
      height: 100%;
    }

    .ink-panel-content.active {
      display: block;
    }

    .ink-panel-content h3 {
      font-weight: 500;
      font-size: 14px;
      margin-top: 20px;
      margin-bottom: 5px;
      // text-transform: uppercase;
    }

    .ink-panel-header h3 {
      font-weight: 500;
      font-size: 14px;
      margin: 0;
      padding: 0 24px;
      // text-transform: uppercase;
    }

    /* - Tabs */
    .ink-tab-group {
      align-items: center;
      box-sizing: border-box;
      display: flex;
      height: 100%;
      justify-content: space-around;
    }

    .ink-tab-group .projection-tab {
      color: rgba(0, 0, 0, 0.5);
      cursor: pointer;
      font-weight: 300;
      line-height: 20px;
      padding: 0 12px;
      text-align: center;
      text-transform: none;
    }

    .ink-tab-group .projection-tab:hover {
      color: black;
    }

    .ink-tab-group .projection-tab.active {
      border-bottom: 2px solid black;
      color: black;
      font-weight: 500;
    }

    h4 {
      margin: 30px 0 10px 0;
    }

    .dismiss-dialog-note {
      margin-top: 25px;
      font-size: 11px;
      text-align: right;
    }
  `,
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVuc29yYm9hcmQvcHJvamVjdG9yL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7OztnRkFhZ0Y7QUFDaEYsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0saURBQWlELENBQUM7QUFFdkYsc0JBQXNCLENBQUM7SUFDckIsVUFBVSxFQUFFLHFCQUFxQjtJQUNqQyxZQUFZLEVBQUU7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQWtLYjtDQUNGLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qIENvcHlyaWdodCAyMDE2IFRoZSBUZW5zb3JGbG93IEF1dGhvcnMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cbmltcG9ydCB7cmVnaXN0ZXJTdHlsZURvbU1vZHVsZX0gZnJvbSAnLi4vY29tcG9uZW50cy9wb2x5bWVyL3JlZ2lzdGVyX3N0eWxlX2RvbV9tb2R1bGUnO1xuXG5yZWdpc3RlclN0eWxlRG9tTW9kdWxlKHtcbiAgbW9kdWxlTmFtZTogJ3Z6LXByb2plY3Rvci1zdHlsZXMnLFxuICBzdHlsZUNvbnRlbnQ6IGBcbiAgICA6aG9zdCB7XG4gICAgICAtLXBhcGVyLWlucHV0LWNvbnRhaW5lci1sYWJlbDoge1xuICAgICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICB9XG4gICAgICAtLXBhcGVyLWlucHV0LWNvbnRhaW5lci1pbnB1dDoge1xuICAgICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICB9XG4gICAgICAvKiBUT0RPOiBGaWd1cmUgb3V0IHdoeSB0aGlzIGRvZXNuJ3Qgd29yayAqL1xuICAgICAgLS1wYXBlci1kcm9wZG93bi1tZW51LWlucHV0OiB7XG4gICAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBwYXBlci1idXR0b24ge1xuICAgICAgYmFja2dyb3VuZDogI2UzZTNlMztcbiAgICAgIG1hcmdpbi1sZWZ0OiAwO1xuICAgICAgdGV4dC10cmFuc2Zvcm06IG5vbmU7XG4gICAgfVxuXG4gICAgcGFwZXItZHJvcGRvd24tbWVudSBwYXBlci1pdGVtIHtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICB9XG5cbiAgICBwYXBlci10b29sdGlwIHtcbiAgICAgIG1heC13aWR0aDogMjAwcHg7XG4gICAgICAtLXBhcGVyLXRvb2x0aXA6IHtcbiAgICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgfVxuICAgIH1cblxuICAgIHBhcGVyLWNoZWNrYm94IHtcbiAgICAgIC0tcGFwZXItY2hlY2tib3gtY2hlY2tlZC1jb2xvcjogIzg4MGU0ZjtcbiAgICB9XG5cbiAgICBwYXBlci10b2dnbGUtYnV0dG9uIHtcbiAgICAgIC0tcGFwZXItdG9nZ2xlLWJ1dHRvbi1jaGVja2VkLWJhci1jb2xvcjogIzg4MGU0ZjtcbiAgICAgIC0tcGFwZXItdG9nZ2xlLWJ1dHRvbi1jaGVja2VkLWJ1dHRvbi1jb2xvcjogIzg4MGU0ZjtcbiAgICAgIC0tcGFwZXItdG9nZ2xlLWJ1dHRvbi1jaGVja2VkLWluay1jb2xvcjogIzg4MGU0ZjtcbiAgICB9XG5cbiAgICBwYXBlci1pY29uLWJ1dHRvbiB7XG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgfVxuXG4gICAgcGFwZXItaWNvbi1idXR0b25bYWN0aXZlXSB7XG4gICAgICBjb2xvcjogd2hpdGU7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjODgwZTRmO1xuICAgIH1cblxuICAgIC5zbGlkZXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xuICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgIH1cblxuICAgIC5zbGlkZXIgc3BhbiB7XG4gICAgICB3aWR0aDogMzVweDtcbiAgICAgIHRleHQtYWxpZ246IHJpZ2h0O1xuICAgIH1cblxuICAgIC5zbGlkZXIgbGFiZWwge1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgfVxuXG4gICAgLmhlbHAtaWNvbiB7XG4gICAgICBoZWlnaHQ6IDE1cHg7XG4gICAgICBsZWZ0OiAycHg7XG4gICAgICBtaW4td2lkdGg6IDE1cHg7XG4gICAgICBtaW4taGVpZ2h0OiAxNXB4O1xuICAgICAgbWFyZ2luOiAwO1xuICAgICAgcGFkZGluZzogMDtcbiAgICAgIHRvcDogLTJweDtcbiAgICAgIHdpZHRoOiAxNXB4O1xuICAgIH1cblxuICAgIC5pbmstcGFuZWwge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgfVxuXG4gICAgLmluay1wYW5lbCBoNCB7XG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgI2RkZDtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XG4gICAgICBtYXJnaW46IDA7XG4gICAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xuICAgICAgcGFkZGluZy1ib3R0b206IDVweDtcbiAgICB9XG5cbiAgICAuaW5rLXBhbmVsLWhlYWRlciB7XG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgwLCAwLCAwLCAwLjEpO1xuICAgICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHJnYmEoMCwgMCwgMCwgMC4xKTtcbiAgICAgIGhlaWdodDogNTBweDtcbiAgICB9XG5cbiAgICAuaW5rLXBhbmVsLWNvbnRlbnQge1xuICAgICAgZGlzcGxheTogbm9uZTtcbiAgICAgIGhlaWdodDogMTAwJTtcbiAgICB9XG5cbiAgICAuaW5rLXBhbmVsLWNvbnRlbnQuYWN0aXZlIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgIH1cblxuICAgIC5pbmstcGFuZWwtY29udGVudCBoMyB7XG4gICAgICBmb250LXdlaWdodDogNTAwO1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgbWFyZ2luLXRvcDogMjBweDtcbiAgICAgIG1hcmdpbi1ib3R0b206IDVweDtcbiAgICAgIC8vIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XG4gICAgfVxuXG4gICAgLmluay1wYW5lbC1oZWFkZXIgaDMge1xuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIG1hcmdpbjogMDtcbiAgICAgIHBhZGRpbmc6IDAgMjRweDtcbiAgICAgIC8vIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XG4gICAgfVxuXG4gICAgLyogLSBUYWJzICovXG4gICAgLmluay10YWItZ3JvdXAge1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgaGVpZ2h0OiAxMDAlO1xuICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1hcm91bmQ7XG4gICAgfVxuXG4gICAgLmluay10YWItZ3JvdXAgLnByb2plY3Rpb24tdGFiIHtcbiAgICAgIGNvbG9yOiByZ2JhKDAsIDAsIDAsIDAuNSk7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICBmb250LXdlaWdodDogMzAwO1xuICAgICAgbGluZS1oZWlnaHQ6IDIwcHg7XG4gICAgICBwYWRkaW5nOiAwIDEycHg7XG4gICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgICB0ZXh0LXRyYW5zZm9ybTogbm9uZTtcbiAgICB9XG5cbiAgICAuaW5rLXRhYi1ncm91cCAucHJvamVjdGlvbi10YWI6aG92ZXIge1xuICAgICAgY29sb3I6IGJsYWNrO1xuICAgIH1cblxuICAgIC5pbmstdGFiLWdyb3VwIC5wcm9qZWN0aW9uLXRhYi5hY3RpdmUge1xuICAgICAgYm9yZGVyLWJvdHRvbTogMnB4IHNvbGlkIGJsYWNrO1xuICAgICAgY29sb3I6IGJsYWNrO1xuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICB9XG5cbiAgICBoNCB7XG4gICAgICBtYXJnaW46IDMwcHggMCAxMHB4IDA7XG4gICAgfVxuXG4gICAgLmRpc21pc3MtZGlhbG9nLW5vdGUge1xuICAgICAgbWFyZ2luLXRvcDogMjVweDtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIHRleHQtYWxpZ246IHJpZ2h0O1xuICAgIH1cbiAgYCxcbn0pO1xuIl19