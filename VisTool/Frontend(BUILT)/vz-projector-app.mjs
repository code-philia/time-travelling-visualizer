/* Copyright 2020 The TensorFlow Authors. All Rights Reserved.

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
import { __decorate, __metadata } from "tslib";
import { PolymerElement, html } from '@polymer/polymer';
import { customElement, property } from '@polymer/decorators';
import '../components/polymer/irons_and_papers';
import './styles';
import './vz-projector';
let VzProjectorApp = class VzProjectorApp extends PolymerElement {
    constructor() {
        super(...arguments);
        this.pageViewLogging = false;
        this.eventLogging = false;
        this.projectorConfigJsonPath = '';
        this.routePrefix = '';
        this.servingMode = '';
        this.documentationLink = '';
        this.bugReportLink = '';
        this.title = `Deep Debugger | task: ${window.sessionStorage.taskType === 'active learning' ? 'Sample Selection' : 'Fault Localization'}`;
    }
};
VzProjectorApp.template = html `
    <style include="vz-projector-styles"></style>
    <style>
      #appbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 24px;
        height: 60px;
        color: white;
        background: #452d8a;
      }

      #appbar .logo {
        font-size: 18px;
        font-weight: 300;
      }

      .icons {
        display: flex;
      }

      .icons a {
        color: white;
      }

      vz-projector {
        height: calc(100% - 60px);
      }

      #container {
        height: 100%;
      }
    </style>

    <div id="container">
      <div id="appbar">
        <div>[[title]]</div>
        <div class="icons">
          <a
            title="Report bug"
            target="_blank"
            href="[[bugReportLink]]"
            rel="noopener noreferrer"
          >
            <paper-icon-button icon="bug-report"></paper-icon-button>
            <paper-tooltip
              position="bottom"
              animation-delay="0"
              fit-to-visible-bounds=""
            >
              Report a bug
            </paper-tooltip>
          </a>
        </div>
      </div>
      <vz-projector
        route-prefix="[[routePrefix]]"
        serving-mode="[[servingMode]]"
        projector-config-json-path="[[projectorConfigJsonPath]]"
        page-view-logging="[[pageViewLogging]]"
        event-logging="[[eventLogging]]"
      >
      </vz-projector>
    </div>
  `;
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], VzProjectorApp.prototype, "pageViewLogging", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], VzProjectorApp.prototype, "eventLogging", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], VzProjectorApp.prototype, "projectorConfigJsonPath", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], VzProjectorApp.prototype, "routePrefix", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], VzProjectorApp.prototype, "servingMode", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], VzProjectorApp.prototype, "documentationLink", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], VzProjectorApp.prototype, "bugReportLink", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], VzProjectorApp.prototype, "title", void 0);
VzProjectorApp = __decorate([
    customElement('vz-projector-app')
], VzProjectorApp);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLWFwcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3RlbnNvcmJvYXJkL3Byb2plY3Rvci92ei1wcm9qZWN0b3ItYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7O2dGQWFnRjs7QUFFaEYsT0FBTyxFQUFDLGNBQWMsRUFBRSxJQUFJLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUN0RCxPQUFPLEVBQUMsYUFBYSxFQUFFLFFBQVEsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBRTVELE9BQU8sd0NBQXdDLENBQUM7QUFFaEQsT0FBTyxVQUFVLENBQUM7QUFDbEIsT0FBTyxnQkFBZ0IsQ0FBQztBQUd4QixJQUFNLGNBQWMsR0FBcEIsTUFBTSxjQUFlLFNBQVEsY0FBYztJQUEzQzs7UUFvRUUsb0JBQWUsR0FBWSxLQUFLLENBQUM7UUFFakMsaUJBQVksR0FBWSxLQUFLLENBQUM7UUFFOUIsNEJBQXVCLEdBQVcsRUFBRSxDQUFDO1FBRXJDLGdCQUFXLEdBQVcsRUFBRSxDQUFDO1FBRXpCLGdCQUFXLEdBQVcsRUFBRSxDQUFDO1FBRXpCLHNCQUFpQixHQUFXLEVBQUUsQ0FBQztRQUUvQixrQkFBYSxHQUFXLEVBQUUsQ0FBQztRQUczQixVQUFLLEdBQVUseUJBQXlCLE1BQU0sQ0FBQyxjQUFjLENBQUMsUUFBUSxLQUFHLGlCQUFpQixDQUFBLENBQUMsQ0FBQSxrQkFBa0IsQ0FBQSxDQUFDLENBQUEsb0JBQW9CLEVBQUUsQ0FBQTtJQUV0SSxDQUFDO0NBQUEsQ0FBQTtBQXBGaUIsdUJBQVEsR0FBRyxJQUFJLENBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBaUU5QixDQUFDO0FBRUY7SUFEQyxRQUFRLENBQUMsRUFBQyxJQUFJLEVBQUUsT0FBTyxFQUFDLENBQUM7O3VEQUNPO0FBRWpDO0lBREMsUUFBUSxDQUFDLEVBQUMsSUFBSSxFQUFFLE9BQU8sRUFBQyxDQUFDOztvREFDSTtBQUU5QjtJQURDLFFBQVEsQ0FBQyxFQUFDLElBQUksRUFBRSxNQUFNLEVBQUMsQ0FBQzs7K0RBQ1k7QUFFckM7SUFEQyxRQUFRLENBQUMsRUFBQyxJQUFJLEVBQUUsTUFBTSxFQUFDLENBQUM7O21EQUNBO0FBRXpCO0lBREMsUUFBUSxDQUFDLEVBQUMsSUFBSSxFQUFFLE1BQU0sRUFBQyxDQUFDOzttREFDQTtBQUV6QjtJQURDLFFBQVEsQ0FBQyxFQUFDLElBQUksRUFBRSxNQUFNLEVBQUMsQ0FBQzs7eURBQ007QUFFL0I7SUFEQyxRQUFRLENBQUMsRUFBQyxJQUFJLEVBQUUsTUFBTSxFQUFDLENBQUM7O3FEQUNFO0FBRzNCO0lBREMsUUFBUSxDQUFDLEVBQUMsSUFBSSxFQUFFLE1BQU0sRUFBQyxDQUFDOzs2Q0FDMkc7QUFuRmhJLGNBQWM7SUFEbkIsYUFBYSxDQUFDLGtCQUFrQixDQUFDO0dBQzVCLGNBQWMsQ0FxRm5CIiwic291cmNlc0NvbnRlbnQiOlsiLyogQ29weXJpZ2h0IDIwMjAgVGhlIFRlbnNvckZsb3cgQXV0aG9ycy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG49PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuXG5pbXBvcnQge1BvbHltZXJFbGVtZW50LCBodG1sfSBmcm9tICdAcG9seW1lci9wb2x5bWVyJztcbmltcG9ydCB7Y3VzdG9tRWxlbWVudCwgcHJvcGVydHl9IGZyb20gJ0Bwb2x5bWVyL2RlY29yYXRvcnMnO1xuXG5pbXBvcnQgJy4uL2NvbXBvbmVudHMvcG9seW1lci9pcm9uc19hbmRfcGFwZXJzJztcblxuaW1wb3J0ICcuL3N0eWxlcyc7XG5pbXBvcnQgJy4vdnotcHJvamVjdG9yJztcblxuQGN1c3RvbUVsZW1lbnQoJ3Z6LXByb2plY3Rvci1hcHAnKVxuY2xhc3MgVnpQcm9qZWN0b3JBcHAgZXh0ZW5kcyBQb2x5bWVyRWxlbWVudCB7XG4gIHN0YXRpYyByZWFkb25seSB0ZW1wbGF0ZSA9IGh0bWxgXG4gICAgPHN0eWxlIGluY2x1ZGU9XCJ2ei1wcm9qZWN0b3Itc3R5bGVzXCI+PC9zdHlsZT5cbiAgICA8c3R5bGU+XG4gICAgICAjYXBwYmFyIHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICBwYWRkaW5nOiAwIDI0cHg7XG4gICAgICAgIGhlaWdodDogNjBweDtcbiAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICBiYWNrZ3JvdW5kOiAjNDUyZDhhO1xuICAgICAgfVxuXG4gICAgICAjYXBwYmFyIC5sb2dvIHtcbiAgICAgICAgZm9udC1zaXplOiAxOHB4O1xuICAgICAgICBmb250LXdlaWdodDogMzAwO1xuICAgICAgfVxuXG4gICAgICAuaWNvbnMge1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgfVxuXG4gICAgICAuaWNvbnMgYSB7XG4gICAgICAgIGNvbG9yOiB3aGl0ZTtcbiAgICAgIH1cblxuICAgICAgdnotcHJvamVjdG9yIHtcbiAgICAgICAgaGVpZ2h0OiBjYWxjKDEwMCUgLSA2MHB4KTtcbiAgICAgIH1cblxuICAgICAgI2NvbnRhaW5lciB7XG4gICAgICAgIGhlaWdodDogMTAwJTtcbiAgICAgIH1cbiAgICA8L3N0eWxlPlxuXG4gICAgPGRpdiBpZD1cImNvbnRhaW5lclwiPlxuICAgICAgPGRpdiBpZD1cImFwcGJhclwiPlxuICAgICAgICA8ZGl2PltbdGl0bGVdXTwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiaWNvbnNcIj5cbiAgICAgICAgICA8YVxuICAgICAgICAgICAgdGl0bGU9XCJSZXBvcnQgYnVnXCJcbiAgICAgICAgICAgIHRhcmdldD1cIl9ibGFua1wiXG4gICAgICAgICAgICBocmVmPVwiW1tidWdSZXBvcnRMaW5rXV1cIlxuICAgICAgICAgICAgcmVsPVwibm9vcGVuZXIgbm9yZWZlcnJlclwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAgPHBhcGVyLWljb24tYnV0dG9uIGljb249XCJidWctcmVwb3J0XCI+PC9wYXBlci1pY29uLWJ1dHRvbj5cbiAgICAgICAgICAgIDxwYXBlci10b29sdGlwXG4gICAgICAgICAgICAgIHBvc2l0aW9uPVwiYm90dG9tXCJcbiAgICAgICAgICAgICAgYW5pbWF0aW9uLWRlbGF5PVwiMFwiXG4gICAgICAgICAgICAgIGZpdC10by12aXNpYmxlLWJvdW5kcz1cIlwiXG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIFJlcG9ydCBhIGJ1Z1xuICAgICAgICAgICAgPC9wYXBlci10b29sdGlwPlxuICAgICAgICAgIDwvYT5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDx2ei1wcm9qZWN0b3JcbiAgICAgICAgcm91dGUtcHJlZml4PVwiW1tyb3V0ZVByZWZpeF1dXCJcbiAgICAgICAgc2VydmluZy1tb2RlPVwiW1tzZXJ2aW5nTW9kZV1dXCJcbiAgICAgICAgcHJvamVjdG9yLWNvbmZpZy1qc29uLXBhdGg9XCJbW3Byb2plY3RvckNvbmZpZ0pzb25QYXRoXV1cIlxuICAgICAgICBwYWdlLXZpZXctbG9nZ2luZz1cIltbcGFnZVZpZXdMb2dnaW5nXV1cIlxuICAgICAgICBldmVudC1sb2dnaW5nPVwiW1tldmVudExvZ2dpbmddXVwiXG4gICAgICA+XG4gICAgICA8L3Z6LXByb2plY3Rvcj5cbiAgICA8L2Rpdj5cbiAgYDtcbiAgQHByb3BlcnR5KHt0eXBlOiBCb29sZWFufSlcbiAgcGFnZVZpZXdMb2dnaW5nOiBib29sZWFuID0gZmFsc2U7XG4gIEBwcm9wZXJ0eSh7dHlwZTogQm9vbGVhbn0pXG4gIGV2ZW50TG9nZ2luZzogYm9vbGVhbiA9IGZhbHNlO1xuICBAcHJvcGVydHkoe3R5cGU6IFN0cmluZ30pXG4gIHByb2plY3RvckNvbmZpZ0pzb25QYXRoOiBzdHJpbmcgPSAnJztcbiAgQHByb3BlcnR5KHt0eXBlOiBTdHJpbmd9KVxuICByb3V0ZVByZWZpeDogc3RyaW5nID0gJyc7XG4gIEBwcm9wZXJ0eSh7dHlwZTogU3RyaW5nfSlcbiAgc2VydmluZ01vZGU6IHN0cmluZyA9ICcnO1xuICBAcHJvcGVydHkoe3R5cGU6IFN0cmluZ30pXG4gIGRvY3VtZW50YXRpb25MaW5rOiBzdHJpbmcgPSAnJztcbiAgQHByb3BlcnR5KHt0eXBlOiBTdHJpbmd9KVxuICBidWdSZXBvcnRMaW5rOiBzdHJpbmcgPSAnJztcblxuICBAcHJvcGVydHkoe3R5cGU6IFN0cmluZ30pXG4gIHRpdGxlOnN0cmluZyA9IGBEZWVwIERlYnVnZ2VyIHwgdGFzazogJHt3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudGFza1R5cGU9PT0nYWN0aXZlIGxlYXJuaW5nJz8nU2FtcGxlIFNlbGVjdGlvbic6J0ZhdWx0IExvY2FsaXphdGlvbid9YFxuIFxufVxuIl19