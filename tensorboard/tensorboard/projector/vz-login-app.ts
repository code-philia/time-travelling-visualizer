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
import './vz-projector';

@customElement('vz-login-app')
class VzLoginApp extends PolymerElement {
  static readonly template = html`
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
  @property({type: String})
  username: string = '';
  @property({type: String})
  routePrefix: string = '';
  @property({type: String})
  servingMode: string = '';
  @property({type: String})
  documentationLink: string = '';
  @property({type: String})
  bugReportLink: string = '';
}
