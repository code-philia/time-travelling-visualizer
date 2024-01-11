import { Projector } from './vz-projector';
import {PolymerElement, html} from '@polymer/polymer';
import {customElement, property} from '@polymer/decorators';

import '../components/polymer/irons_and_papers';
import{ getCurrentSessionState, updateSessionStateForInstance, getIsAnimating, getTSNETotalIter, getLastIteration, getScene, getHiddenBackground, getHighlightedPointIndices, getConfChangeIndices, getNowShowIndicates, getProperties, getPreviousHover, getAlQueryResPointIndices, getAllResPositions, getCurrentFocus, getPredChangeIndices, getSelectedTotalEpoch, getIteration, getIsAdjustingSel, updateStateForInstance, getAlSuggestLabelList, getFlagindecatesList,getQueryResAnormalCleanIndecates, getLineGeomertryList, getAcceptInputList, getAlSuggestScoreList, getRejectInputList, getTaskType, getAcceptIndicates, getQueryResAnormalIndecates, getCustomSelection, getModelMath, getCheckBoxDom, getQueryResPointIndices, getRejectIndicates, getPreviousIndecates } from './globalState';
import './styles';
import './vz-comparator';

@customElement('vz-comparator-container')
class VzComparatorContainer extends PolymerElement {
  static get template() {
    return html`
    <style>
    #container {
      display: flex; /* Lay out comparators horizontally */
    }

    vz-comparator {
      display:flex;
      position:relative;
      margin: 0 px; /* Add some space between the comparators */
    }
  

    #select-container {
      display: flex;
      justify-content: center; /* Center the select box horizontally */
      margin-top: 20px; /* Add some space above the select box */
    }
    #highlightButton {
      margin-left: 10px; 
      height: 35px; 
    }
    </style>

      <!-- Embed vz-projector inside the container -->
      <div id="container">
      <vz-comparator
        is-contra-vis="[[isContraVis]]"
        route-prefix="[[routePrefix]]"
        serving-mode="[[servingMode]]"
        projector-config-json-path="[[projectorConfigJsonPath]]"
        page-view-logging="[[pageViewLogging]]"
        event-logging="[[eventLogging]]"
        contra-vis-highlight-indices="[[contraVisHighlightIndices]]"
        instance-id="[[instanceIdLeft]]">
       
      </vz-comparator>

      <vz-comparator
      is-contra-vis="[[isContraVis]]"
      route-prefix="[[routePrefix]]"
      serving-mode="[[servingMode]]"
      projector-config-json-path="[[projectorConfigJsonPath]]"
      page-view-logging="[[pageViewLogging]]"
      event-logging="[[eventLogging]]"
      contra-vis-highlight-indices="[[contraVisHighlightIndices]]"
      instance-id="[[instanceIdRight]]">
  
  
    </vz-comparator>
    

    

      </div>
      <template is="dom-if" if="[[isContraVis]]">
      <div id="select-container">
      <select id="highlightMethodInput" class="login-input" style="height: 35px; width: 210px;">
        <option value="align" selected>align</option>
        <option value="nearest neighbour">nearest neighbour</option>
        <option value="both" selected>both</option>
      </select>
      <button id="highlightButton" on-click="_highlightData">Highlight Data</button>
    </div>
      </template>
    `;
  }

  @property({ type: String })
  routePrefix: string;

  @property({ type: String })
  servingMode: string;

  @property({ type: String })
  projectorConfigJsonPath: string;

  @property({ type: Boolean })
  pageViewLogging: boolean;

  @property({ type: Boolean })
  eventLogging: boolean;

  @property({ type: Number })
  instanceIdLeft: number = 2; 

  @property({ type: Number })
  instanceIdRight: number = 3; 

  @property({ type: Boolean })
  isContraVis: boolean = false;

  @property({type: Array})
  contraVisHighlightIndices:Array<number>=[];

  _highlightData() {
    // Get the selected value from the select box
    var selectBox = this.shadowRoot.querySelector('#highlightMethodInput');
    var selectedValue = (selectBox as HTMLSelectElement).value;


    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "path": window.sessionStorage.content_path,
        "iterationLeft": getIteration(this.instanceIdLeft),
        "iterationRight": getIteration(this.instanceIdRight),
        "method": selectedValue,
        "username": window.sessionStorage.username,
        "vis_method": window.sessionStorage.vis_method,
        'setting': window.sessionStorage.selectedSetting,
        "content_path": window.sessionStorage.content_path
      }),
    };

    fetch(`http://${  window.sessionStorage.getItem('ipAddress')}/contraVisHighlight`, requestOptions)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      this.contraVisHighlightIndices = data.contraVisChangeIndices
      updateStateForInstance(this.instanceIdLeft, {contraVisHighlightIndices:data.contraVisChangeIndices})
      updateStateForInstance(this.instanceIdRight, {contraVisHighlightIndices:data.contraVisChangeIndices})

    })
    .catch(error => {
      console.error('Error during highlightCriticalChange fetch:', error);
     
    });
  }

  _checkSessionStorage() {
    const isContraVis = window.sessionStorage.getItem('isContraVis');
    this.isContraVis = isContraVis === 'true';
  }

  connectedCallback() {
    super.connectedCallback();
    this._checkSessionStorage();
    window.addEventListener('storage', (event) => {
      if (event.key === 'isContraVis') {
        this._checkSessionStorage();
      }
    });
  }


}
