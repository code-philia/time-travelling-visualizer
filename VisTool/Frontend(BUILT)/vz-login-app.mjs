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
let VzLoginApp = class VzLoginApp extends PolymerElement {
    constructor() {
        super(...arguments);
        this.username = '';
        this.routePrefix = '';
        this.servingMode = '';
        this.documentationLink = '';
        this.bugReportLink = '';
    }
};
VzLoginApp.template = html `
    <style include="vz-login-styles"></style>
    <style>
      #loginContainer{

      }
    </style>
    <div id="loginContainer">
      <paper-input
      value="{{username}}"
      label="User Name"
      on-input="subjectModelPathEditorInputChange"
       >
      </paper-input>
      密码<input/>
      <button id="loginBtn">登陆</button>
    </div>
    </div>
  `;
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], VzLoginApp.prototype, "username", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], VzLoginApp.prototype, "routePrefix", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], VzLoginApp.prototype, "servingMode", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], VzLoginApp.prototype, "documentationLink", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], VzLoginApp.prototype, "bugReportLink", void 0);
VzLoginApp = __decorate([
    customElement('vz-login-app')
], VzLoginApp);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotbG9naW4tYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVuc29yYm9hcmQvcHJvamVjdG9yL3Z6LWxvZ2luLWFwcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7OztnRkFhZ0Y7O0FBRWhGLE9BQU8sRUFBQyxjQUFjLEVBQUUsSUFBSSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDdEQsT0FBTyxFQUFDLGFBQWEsRUFBRSxRQUFRLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUU1RCxPQUFPLHdDQUF3QyxDQUFDO0FBRWhELE9BQU8sVUFBVSxDQUFDO0FBQ2xCLE9BQU8sZ0JBQWdCLENBQUM7QUFHeEIsSUFBTSxVQUFVLEdBQWhCLE1BQU0sVUFBVyxTQUFRLGNBQWM7SUFBdkM7O1FBcUJFLGFBQVEsR0FBVyxFQUFFLENBQUM7UUFFdEIsZ0JBQVcsR0FBVyxFQUFFLENBQUM7UUFFekIsZ0JBQVcsR0FBVyxFQUFFLENBQUM7UUFFekIsc0JBQWlCLEdBQVcsRUFBRSxDQUFDO1FBRS9CLGtCQUFhLEdBQVcsRUFBRSxDQUFDO0lBQzdCLENBQUM7Q0FBQSxDQUFBO0FBN0JpQixtQkFBUSxHQUFHLElBQUksQ0FBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBa0I5QixDQUFDO0FBRUY7SUFEQyxRQUFRLENBQUMsRUFBQyxJQUFJLEVBQUUsTUFBTSxFQUFDLENBQUM7OzRDQUNIO0FBRXRCO0lBREMsUUFBUSxDQUFDLEVBQUMsSUFBSSxFQUFFLE1BQU0sRUFBQyxDQUFDOzsrQ0FDQTtBQUV6QjtJQURDLFFBQVEsQ0FBQyxFQUFDLElBQUksRUFBRSxNQUFNLEVBQUMsQ0FBQzs7K0NBQ0E7QUFFekI7SUFEQyxRQUFRLENBQUMsRUFBQyxJQUFJLEVBQUUsTUFBTSxFQUFDLENBQUM7O3FEQUNNO0FBRS9CO0lBREMsUUFBUSxDQUFDLEVBQUMsSUFBSSxFQUFFLE1BQU0sRUFBQyxDQUFDOztpREFDRTtBQTdCdkIsVUFBVTtJQURmLGFBQWEsQ0FBQyxjQUFjLENBQUM7R0FDeEIsVUFBVSxDQThCZiIsInNvdXJjZXNDb250ZW50IjpbIi8qIENvcHlyaWdodCAyMDIwIFRoZSBUZW5zb3JGbG93IEF1dGhvcnMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuaW1wb3J0IHtQb2x5bWVyRWxlbWVudCwgaHRtbH0gZnJvbSAnQHBvbHltZXIvcG9seW1lcic7XG5pbXBvcnQge2N1c3RvbUVsZW1lbnQsIHByb3BlcnR5fSBmcm9tICdAcG9seW1lci9kZWNvcmF0b3JzJztcblxuaW1wb3J0ICcuLi9jb21wb25lbnRzL3BvbHltZXIvaXJvbnNfYW5kX3BhcGVycyc7XG5cbmltcG9ydCAnLi9zdHlsZXMnO1xuaW1wb3J0ICcuL3Z6LXByb2plY3Rvcic7XG5cbkBjdXN0b21FbGVtZW50KCd2ei1sb2dpbi1hcHAnKVxuY2xhc3MgVnpMb2dpbkFwcCBleHRlbmRzIFBvbHltZXJFbGVtZW50IHtcbiAgc3RhdGljIHJlYWRvbmx5IHRlbXBsYXRlID0gaHRtbGBcbiAgICA8c3R5bGUgaW5jbHVkZT1cInZ6LWxvZ2luLXN0eWxlc1wiPjwvc3R5bGU+XG4gICAgPHN0eWxlPlxuICAgICAgI2xvZ2luQ29udGFpbmVye1xuXG4gICAgICB9XG4gICAgPC9zdHlsZT5cbiAgICA8ZGl2IGlkPVwibG9naW5Db250YWluZXJcIj5cbiAgICAgIDxwYXBlci1pbnB1dFxuICAgICAgdmFsdWU9XCJ7e3VzZXJuYW1lfX1cIlxuICAgICAgbGFiZWw9XCJVc2VyIE5hbWVcIlxuICAgICAgb24taW5wdXQ9XCJzdWJqZWN0TW9kZWxQYXRoRWRpdG9ySW5wdXRDaGFuZ2VcIlxuICAgICAgID5cbiAgICAgIDwvcGFwZXItaW5wdXQ+XG4gICAgICDlr4bnoIE8aW5wdXQvPlxuICAgICAgPGJ1dHRvbiBpZD1cImxvZ2luQnRuXCI+55m76ZmGPC9idXR0b24+XG4gICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gIGA7XG4gIEBwcm9wZXJ0eSh7dHlwZTogU3RyaW5nfSlcbiAgdXNlcm5hbWU6IHN0cmluZyA9ICcnO1xuICBAcHJvcGVydHkoe3R5cGU6IFN0cmluZ30pXG4gIHJvdXRlUHJlZml4OiBzdHJpbmcgPSAnJztcbiAgQHByb3BlcnR5KHt0eXBlOiBTdHJpbmd9KVxuICBzZXJ2aW5nTW9kZTogc3RyaW5nID0gJyc7XG4gIEBwcm9wZXJ0eSh7dHlwZTogU3RyaW5nfSlcbiAgZG9jdW1lbnRhdGlvbkxpbms6IHN0cmluZyA9ICcnO1xuICBAcHJvcGVydHkoe3R5cGU6IFN0cmluZ30pXG4gIGJ1Z1JlcG9ydExpbms6IHN0cmluZyA9ICcnO1xufVxuIl19