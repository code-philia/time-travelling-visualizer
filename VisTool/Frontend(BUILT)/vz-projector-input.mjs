import { __decorate, __metadata } from "tslib";
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
import { PolymerElement, html } from '@polymer/polymer';
import { customElement, property } from '@polymer/decorators';
import { LegacyElementMixin } from '../components/polymer/legacy_element_mixin';
import '../components/polymer/irons_and_papers';
import './styles';
let ProjectorInput = class ProjectorInput extends LegacyElementMixin(PolymerElement) {
    /** Subscribe to be called everytime the input changes. */
    registerInputChangedListener(listener) {
        this.textChangedListeners.push(listener);
    }
    ready() {
        super.ready();
        this.inRegexMode = false;
        this.noShowRegex = false;
        this.textChangedListeners = [];
        this.paperInput = this.$$('paper-input');
        this.inRegexModeButton = this.$$('paper-button');
        this.paperInput.setAttribute('error-message', 'Invalid regex');
        this.paperInput.addEventListener('input', () => {
            this.onTextChanged();
        });
        this.paperInput.addEventListener('keydown', (event) => {
            event.stopPropagation();
        });
        this.inRegexModeButton.addEventListener('click', () => this.onClickRegexModeButton());
        this.updateRegexModeDisplaySlashes();
        this.onTextChanged();
    }
    onClickRegexModeButton() {
        this.inRegexMode = this.inRegexModeButton.active;
        this.updateRegexModeDisplaySlashes();
        this.onTextChanged();
    }
    notifyInputChanged(value, inRegexMode) {
        this.textChangedListeners.forEach((l) => l(value, inRegexMode));
    }
    onTextChanged() {
        try {
            if (this.inRegexMode) {
                new RegExp(this.paperInput.value);
            }
        }
        catch (invalidRegexException) {
            this.paperInput.setAttribute('invalid', 'true');
            this.message = '';
            this.notifyInputChanged(null, true);
            return;
        }
        this.paperInput.removeAttribute('invalid');
        this.notifyInputChanged(this.paperInput.value, this.inRegexMode);
    }
    updateRegexModeDisplaySlashes() {
        const slashes = this.paperInput.querySelectorAll('.slash');
        const display = this.inRegexMode ? '' : 'none';
        for (let i = 0; i < slashes.length; i++) {
            slashes[i].style.display = display;
        }
    }
    getValue() {
        return this.paperInput.value;
    }
    getInRegexMode() {
        return this.inRegexMode;
    }
    setValue(value, inRegexMode) {
        this.inRegexModeButton.active = inRegexMode;
        this.paperInput.value = value;
        this.onClickRegexModeButton();
    }
};
ProjectorInput.template = html `
    <style include="vz-projector-styles"></style>
    <style>
      .info {
        color: rgba(0, 0, 0, 0.5);
        display: block;
        font-size: 11px;
      }

      .toggle {
        font-size: 12px;
        height: 21px;
        margin: 0px;
        min-width: 0px;
        min-height: 0px;
        padding: 0;
        width: 17px;
      }

      .toggle[active] {
        background-color: #880e4f;
        color: white;
      }
      
      [hidden] {
         display: none;
      }
    </style>

    <paper-input label="[[label]]">
      <div class="slash" prefix slot="prefix">/</div>
      <div class="slash" suffix slot="suffix">/</div>
      <div hidden$="[[!noShowRegex]]" suffix slot="suffix">
        <paper-button id="regex" toggles class="toggle">.*</paper-button>
      </div>
    </paper-input>
    <paper-tooltip
      for="regex"
      position="bottom"
      animation-delay="0"
      fit-to-visible-bounds
    >
      Enable/disable regex mode.
    </paper-tooltip>
    <span class="info">[[message]]</span>
  `;
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], ProjectorInput.prototype, "label", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], ProjectorInput.prototype, "noShowRegex", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], ProjectorInput.prototype, "message", void 0);
ProjectorInput = __decorate([
    customElement('vz-projector-input')
], ProjectorInput);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLWlucHV0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVuc29yYm9hcmQvcHJvamVjdG9yL3Z6LXByb2plY3Rvci1pbnB1dC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7Z0ZBYWdGO0FBQ2hGLE9BQU8sRUFBQyxjQUFjLEVBQUUsSUFBSSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDdEQsT0FBTyxFQUFDLGFBQWEsRUFBRSxRQUFRLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUU1RCxPQUFPLEVBQUMsa0JBQWtCLEVBQUMsTUFBTSw0Q0FBNEMsQ0FBQztBQUM5RSxPQUFPLHdDQUF3QyxDQUFDO0FBRWhELE9BQU8sVUFBVSxDQUFDO0FBT2xCLElBQU0sY0FBYyxHQUFwQixNQUFNLGNBQWUsU0FBUSxrQkFBa0IsQ0FBQyxjQUFjLENBQUM7SUE4RDdELDBEQUEwRDtJQUMxRCw0QkFBNEIsQ0FBQyxRQUE4QjtRQUN6RCxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzNDLENBQUM7SUFDRCxLQUFLO1FBQ0gsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2QsSUFBSSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUM7UUFDekIsSUFBSSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUM7UUFDekIsSUFBSSxDQUFDLG9CQUFvQixHQUFHLEVBQUUsQ0FBQztRQUMvQixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFxQixDQUFDO1FBQzdELElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBc0IsQ0FBQztRQUN0RSxJQUFJLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxlQUFlLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDL0QsSUFBSSxDQUFDLFVBQVUsQ0FBQyxn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R0E2QzlCLENBQUM7QUFFRjtJQURDLFFBQVEsQ0FBQyxFQUFDLElBQUksRUFBRSxNQUFNLEVBQUMsQ0FBQzs7NkNBQ1g7QUFHZDtJQURDLFFBQVEsQ0FBQyxFQUFDLElBQUksRUFBRSxPQUFPLEVBQUMsQ0FBQzs7bURBQ0w7QUFJckI7SUFEQyxRQUFRLENBQUMsRUFBQyxJQUFJLEVBQUUsTUFBTSxFQUFDLENBQUM7OytDQUNUO0FBdkRaLGNBQWM7SUFEbkIsYUFBYSxDQUFDLG9CQUFvQixDQUFDO0dBQzlCLGNBQWMsQ0E4SG5CIiwic291cmNlc0NvbnRlbnQiOlsiLyogQ29weXJpZ2h0IDIwMTYgVGhlIFRlbnNvckZsb3cgQXV0aG9ycy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG49PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuaW1wb3J0IHtQb2x5bWVyRWxlbWVudCwgaHRtbH0gZnJvbSAnQHBvbHltZXIvcG9seW1lcic7XG5pbXBvcnQge2N1c3RvbUVsZW1lbnQsIHByb3BlcnR5fSBmcm9tICdAcG9seW1lci9kZWNvcmF0b3JzJztcblxuaW1wb3J0IHtMZWdhY3lFbGVtZW50TWl4aW59IGZyb20gJy4uL2NvbXBvbmVudHMvcG9seW1lci9sZWdhY3lfZWxlbWVudF9taXhpbic7XG5pbXBvcnQgJy4uL2NvbXBvbmVudHMvcG9seW1lci9pcm9uc19hbmRfcGFwZXJzJztcblxuaW1wb3J0ICcuL3N0eWxlcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5wdXRDaGFuZ2VkTGlzdGVuZXIge1xuICAodmFsdWU6IHN0cmluZywgaW5SZWdleE1vZGU6IGJvb2xlYW4pOiB2b2lkO1xufVxuXG5AY3VzdG9tRWxlbWVudCgndnotcHJvamVjdG9yLWlucHV0JylcbmNsYXNzIFByb2plY3RvcklucHV0IGV4dGVuZHMgTGVnYWN5RWxlbWVudE1peGluKFBvbHltZXJFbGVtZW50KSB7XG4gIHN0YXRpYyByZWFkb25seSB0ZW1wbGF0ZSA9IGh0bWxgXG4gICAgPHN0eWxlIGluY2x1ZGU9XCJ2ei1wcm9qZWN0b3Itc3R5bGVzXCI+PC9zdHlsZT5cbiAgICA8c3R5bGU+XG4gICAgICAuaW5mbyB7XG4gICAgICAgIGNvbG9yOiByZ2JhKDAsIDAsIDAsIDAuNSk7XG4gICAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICB9XG5cbiAgICAgIC50b2dnbGUge1xuICAgICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICAgIGhlaWdodDogMjFweDtcbiAgICAgICAgbWFyZ2luOiAwcHg7XG4gICAgICAgIG1pbi13aWR0aDogMHB4O1xuICAgICAgICBtaW4taGVpZ2h0OiAwcHg7XG4gICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgIHdpZHRoOiAxN3B4O1xuICAgICAgfVxuXG4gICAgICAudG9nZ2xlW2FjdGl2ZV0ge1xuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjODgwZTRmO1xuICAgICAgICBjb2xvcjogd2hpdGU7XG4gICAgICB9XG4gICAgICBcbiAgICAgIFtoaWRkZW5dIHtcbiAgICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICB9XG4gICAgPC9zdHlsZT5cblxuICAgIDxwYXBlci1pbnB1dCBsYWJlbD1cIltbbGFiZWxdXVwiPlxuICAgICAgPGRpdiBjbGFzcz1cInNsYXNoXCIgcHJlZml4IHNsb3Q9XCJwcmVmaXhcIj4vPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwic2xhc2hcIiBzdWZmaXggc2xvdD1cInN1ZmZpeFwiPi88L2Rpdj5cbiAgICAgIDxkaXYgaGlkZGVuJD1cIltbIW5vU2hvd1JlZ2V4XV1cIiBzdWZmaXggc2xvdD1cInN1ZmZpeFwiPlxuICAgICAgICA8cGFwZXItYnV0dG9uIGlkPVwicmVnZXhcIiB0b2dnbGVzIGNsYXNzPVwidG9nZ2xlXCI+Lio8L3BhcGVyLWJ1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvcGFwZXItaW5wdXQ+XG4gICAgPHBhcGVyLXRvb2x0aXBcbiAgICAgIGZvcj1cInJlZ2V4XCJcbiAgICAgIHBvc2l0aW9uPVwiYm90dG9tXCJcbiAgICAgIGFuaW1hdGlvbi1kZWxheT1cIjBcIlxuICAgICAgZml0LXRvLXZpc2libGUtYm91bmRzXG4gICAgPlxuICAgICAgRW5hYmxlL2Rpc2FibGUgcmVnZXggbW9kZS5cbiAgICA8L3BhcGVyLXRvb2x0aXA+XG4gICAgPHNwYW4gY2xhc3M9XCJpbmZvXCI+W1ttZXNzYWdlXV08L3NwYW4+XG4gIGA7XG4gIEBwcm9wZXJ0eSh7dHlwZTogU3RyaW5nfSlcbiAgbGFiZWw6IHN0cmluZztcblxuICBAcHJvcGVydHkoe3R5cGU6IEJvb2xlYW59KVxuICBub1Nob3dSZWdleDogYm9vbGVhbjtcblxuICAvKiogTWVzc2FnZSB0aGF0IHdpbGwgYmUgZGlzcGxheWVkIGF0IHRoZSBib3R0b20gb2YgdGhlIGlucHV0IGNvbnRyb2wuICovXG4gIEBwcm9wZXJ0eSh7dHlwZTogU3RyaW5nfSlcbiAgbWVzc2FnZTogc3RyaW5nO1xuXG4gIHByaXZhdGUgdGV4dENoYW5nZWRMaXN0ZW5lcnM6IElucHV0Q2hhbmdlZExpc3RlbmVyW107XG4gIHByaXZhdGUgcGFwZXJJbnB1dDogSFRNTElucHV0RWxlbWVudDtcbiAgcHJpdmF0ZSBpblJlZ2V4TW9kZUJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHByaXZhdGUgaW5SZWdleE1vZGU6IGJvb2xlYW47XG5cbiAgLyoqIFN1YnNjcmliZSB0byBiZSBjYWxsZWQgZXZlcnl0aW1lIHRoZSBpbnB1dCBjaGFuZ2VzLiAqL1xuICByZWdpc3RlcklucHV0Q2hhbmdlZExpc3RlbmVyKGxpc3RlbmVyOiBJbnB1dENoYW5nZWRMaXN0ZW5lcikge1xuICAgIHRoaXMudGV4dENoYW5nZWRMaXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG4gIH1cbiAgcmVhZHkoKSB7XG4gICAgc3VwZXIucmVhZHkoKTtcbiAgICB0aGlzLmluUmVnZXhNb2RlID0gZmFsc2U7XG4gICAgdGhpcy5ub1Nob3dSZWdleCA9IGZhbHNlO1xuICAgIHRoaXMudGV4dENoYW5nZWRMaXN0ZW5lcnMgPSBbXTtcbiAgICB0aGlzLnBhcGVySW5wdXQgPSB0aGlzLiQkKCdwYXBlci1pbnB1dCcpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgdGhpcy5pblJlZ2V4TW9kZUJ1dHRvbiA9IHRoaXMuJCQoJ3BhcGVyLWJ1dHRvbicpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuICAgIHRoaXMucGFwZXJJbnB1dC5zZXRBdHRyaWJ1dGUoJ2Vycm9yLW1lc3NhZ2UnLCAnSW52YWxpZCByZWdleCcpO1xuICAgIHRoaXMucGFwZXJJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHtcbiAgICAgIHRoaXMub25UZXh0Q2hhbmdlZCgpO1xuICAgIH0pO1xuICAgIHRoaXMucGFwZXJJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgKGV2ZW50KSA9PiB7XG4gICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB9KTtcbiAgICB0aGlzLmluUmVnZXhNb2RlQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT5cbiAgICAgIHRoaXMub25DbGlja1JlZ2V4TW9kZUJ1dHRvbigpXG4gICAgKTtcbiAgICB0aGlzLnVwZGF0ZVJlZ2V4TW9kZURpc3BsYXlTbGFzaGVzKCk7XG4gICAgdGhpcy5vblRleHRDaGFuZ2VkKCk7XG4gIH1cbiAgcHJpdmF0ZSBvbkNsaWNrUmVnZXhNb2RlQnV0dG9uKCkge1xuICAgIHRoaXMuaW5SZWdleE1vZGUgPSAodGhpcy5pblJlZ2V4TW9kZUJ1dHRvbiBhcyBhbnkpLmFjdGl2ZTtcbiAgICB0aGlzLnVwZGF0ZVJlZ2V4TW9kZURpc3BsYXlTbGFzaGVzKCk7XG4gICAgdGhpcy5vblRleHRDaGFuZ2VkKCk7XG4gIH1cbiAgcHJpdmF0ZSBub3RpZnlJbnB1dENoYW5nZWQodmFsdWU6IHN0cmluZywgaW5SZWdleE1vZGU6IGJvb2xlYW4pIHtcbiAgICB0aGlzLnRleHRDaGFuZ2VkTGlzdGVuZXJzLmZvckVhY2goKGwpID0+IGwodmFsdWUsIGluUmVnZXhNb2RlKSk7XG4gIH1cbiAgcHJpdmF0ZSBvblRleHRDaGFuZ2VkKCkge1xuICAgIHRyeSB7XG4gICAgICBpZiAodGhpcy5pblJlZ2V4TW9kZSkge1xuICAgICAgICBuZXcgUmVnRXhwKHRoaXMucGFwZXJJbnB1dC52YWx1ZSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoaW52YWxpZFJlZ2V4RXhjZXB0aW9uKSB7XG4gICAgICB0aGlzLnBhcGVySW5wdXQuc2V0QXR0cmlidXRlKCdpbnZhbGlkJywgJ3RydWUnKTtcbiAgICAgIHRoaXMubWVzc2FnZSA9ICcnO1xuICAgICAgdGhpcy5ub3RpZnlJbnB1dENoYW5nZWQobnVsbCwgdHJ1ZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMucGFwZXJJbnB1dC5yZW1vdmVBdHRyaWJ1dGUoJ2ludmFsaWQnKTtcbiAgICB0aGlzLm5vdGlmeUlucHV0Q2hhbmdlZCh0aGlzLnBhcGVySW5wdXQudmFsdWUsIHRoaXMuaW5SZWdleE1vZGUpO1xuICB9XG4gIHByaXZhdGUgdXBkYXRlUmVnZXhNb2RlRGlzcGxheVNsYXNoZXMoKSB7XG4gICAgY29uc3Qgc2xhc2hlcyA9IHRoaXMucGFwZXJJbnB1dC5xdWVyeVNlbGVjdG9yQWxsKCcuc2xhc2gnKTtcbiAgICBjb25zdCBkaXNwbGF5ID0gdGhpcy5pblJlZ2V4TW9kZSA/ICcnIDogJ25vbmUnO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2xhc2hlcy5sZW5ndGg7IGkrKykge1xuICAgICAgKHNsYXNoZXNbaV0gYXMgSFRNTERpdkVsZW1lbnQpLnN0eWxlLmRpc3BsYXkgPSBkaXNwbGF5O1xuICAgIH1cbiAgfVxuICBnZXRWYWx1ZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnBhcGVySW5wdXQudmFsdWU7XG4gIH1cbiAgZ2V0SW5SZWdleE1vZGUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuaW5SZWdleE1vZGU7XG4gIH1cbiAgc2V0VmFsdWUodmFsdWU6IHN0cmluZywgaW5SZWdleE1vZGU6IGJvb2xlYW4pIHtcbiAgICAodGhpcy5pblJlZ2V4TW9kZUJ1dHRvbiBhcyBhbnkpLmFjdGl2ZSA9IGluUmVnZXhNb2RlO1xuICAgIHRoaXMucGFwZXJJbnB1dC52YWx1ZSA9IHZhbHVlO1xuICAgIHRoaXMub25DbGlja1JlZ2V4TW9kZUJ1dHRvbigpO1xuICB9XG59XG4iXX0=