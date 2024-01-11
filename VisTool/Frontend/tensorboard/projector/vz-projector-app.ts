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

import {PolymerElement, html} from '@polymer/polymer';
import {customElement, property} from '@polymer/decorators';

import '../components/polymer/irons_and_papers';

import './styles';
import './vz-projector-container';
import './vz-comparator-container';


@customElement('vz-projector-app')
class VzProjectorApp extends PolymerElement {
  static readonly template = html`
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

      .icons paper-icon-button {
        margin-right: 10px; 
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
          <a
            title="Change Mode"
          >
            <paper-icon-button icon="autorenew" on-click="handleChangeMode"></paper-icon-button>
            <paper-tooltip
              position="bottom-left"
              animation-delay="0"
              fit-to-visible-bounds=""
            >
              Change Mode
            </paper-tooltip>

          </a>
        </div>
      </div>
      <template is="dom-if" if="[[isProjectorView(currentView)]]">
      <vz-projector-container
      route-prefix="[[routePrefix]]"
      serving-mode="[[servingMode]]"
      projector-config-json-path="[[projectorConfigJsonPath]]"
      page-view-logging="[[pageViewLogging]]"
      event-logging="[[eventLogging]]"
      ></vz-projector-container>
      </template>

      <template is="dom-if" if="[[isComparatorView(currentView)]]">
      <vz-comparator-container 
      route-prefix="[[routePrefix]]"
      serving-mode="[[servingMode]]"
      projector-config-json-path="[[projectorConfigJsonPath]]"
      page-view-logging="[[pageViewLogging]]"
      event-logging="[[eventLogging]]"
      ></vz-comparator-container>
      </template>

    
    </div>
  `;
  @property({type: Boolean})
  pageViewLogging: boolean = false;
  @property({type: Boolean})
  eventLogging: boolean = false;
  @property({type: String})
  projectorConfigJsonPath: string = '';
  @property({type: String})
  routePrefix: string = '';
  @property({type: String})
  servingMode: string = '';
  @property({type: String})
  documentationLink: string = '';
  @property({type: String})
  bugReportLink: string = '';
  @property({type: String})
  currentView: string = 'projector';

  @property({type: String})
  title:string = `Deep Debugger | task: ${window.sessionStorage.taskType==='active learning'?'Sample Selection':'Fault Localization'}`

  connectedCallback() {
    super.connectedCallback();
    // Check the saved state on page load and set the currentView
    const savedView = localStorage.getItem('currentView');
    if (savedView) {
      this.currentView = savedView;
    }
  }

  handleChangeMode() {
    // Save the desired view state before reloading
    const nextView = this.currentView === 'projector' ? 'comparator' : 'projector';
    localStorage.setItem('currentView', nextView);

    // Perform a full page reload
    window.location.reload();
  }
  
  isProjectorView(view : String) : boolean{
    return view === 'projector';
  }

  isComparatorView(view : String) : boolean{
    return view === 'comparator';
  }


}
