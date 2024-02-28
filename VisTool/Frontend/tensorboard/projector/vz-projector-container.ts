import { Projector } from './vz-projector';
import {PolymerElement, html} from '@polymer/polymer';
import {customElement, property} from '@polymer/decorators';

import '../components/polymer/irons_and_papers';

import './styles';
import './vz-projector';

@customElement('vz-projector-container')
class VzProjectorContainer extends PolymerElement {
  static get template() {
    return html`
      <!-- Embed vz-projector inside the container -->
      <div id="container">
      <vz-projector
        is-contra-vis="[[isContraVis]]"
        route-prefix="[[routePrefix]]"
        serving-mode="[[servingMode]]"
        projector-config-json-path="[[projectorConfigJsonPath]]"
        page-view-logging="[[pageViewLogging]]"
        event-logging="[[eventLogging]]"
        instance-id="[[instanceId]]">
      </vz-projector>
      </div>
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
  instanceId: number = 1; 

  @property({ type: Boolean })
  isContraVis: boolean = false;

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




