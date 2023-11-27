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
import { __decorate, __metadata } from "tslib";
import { PolymerElement, html } from '@polymer/polymer';
import { customElement, observe, property } from '@polymer/decorators';
import { LegacyElementMixin } from '../components/polymer/legacy_element_mixin';
import './styles';
let Legend = class Legend extends LegacyElementMixin(PolymerElement) {
    _renderInfoChanged() {
        if (this.renderInfo == null) {
            return;
        }
        if (this.renderInfo.thresholds) {
            // <linearGradient> is under dom-if so we should wait for it to be
            // inserted in the dom tree using async().
            this.async(() => this.setupLinearGradient());
        }
    }
    _getLastThreshold() {
        if (this.renderInfo == null || this.renderInfo.thresholds == null) {
            return;
        }
        return this.renderInfo.thresholds[this.renderInfo.thresholds.length - 1]
            .value;
    }
    getOffset(value) {
        const min = this.renderInfo.thresholds[0].value;
        const max = this.renderInfo.thresholds[this.renderInfo.thresholds.length - 1].value;
        return ((100 * (value - min)) / (max - min)).toFixed(2) + '%';
    }
    setupLinearGradient() {
        const linearGradient = this.$$('#gradient');
        const width = this.$$('svg.gradient').clientWidth;
        // Set the svg <rect> to be the width of its <svg> parent.
        this.$$('svg.gradient rect').style.width = width + 'px';
        // Remove all <stop> children from before.
        linearGradient.textContent = '';
        // Add a <stop> child in <linearGradient> for each gradient threshold.
        this.renderInfo.thresholds.forEach((t) => {
            const stopElement = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stopElement.setAttribute('offset', this.getOffset(t.value));
            stopElement.setAttribute('stop-color', t.color);
        });
    }
};
Legend.template = html `
    <style include="vz-projector-styles"></style>
    <style>
      .item {
        display: flex;
        align-items: flex-start;
        margin-bottom: 10px;
      }

      .shape {
        width: 10px;
        height: 10px;
        margin-right: 10px;
        margin-top: 5px;
        border-radius: 50%;
      }

      .label {
        flex-grow: 1;
      }

      .gradient {
        width: 100%;
        height: 10px;
      }

      .gradient-boundaries {
        display: flex;
        justify-content: space-between;
      }
    </style>

    <template is="dom-repeat" items="[[renderInfo.items]]">
      <div class="item">
        <div class="shape" style="background-color: [[item.color]];"></div>
        <div class="label">[[item.label]]</div>
        <div class="info" style="color: [[item.color]];">[[item.count]]</div>
      </div>
    </template>

    <template is="dom-if" if="[[renderInfo.thresholds]]">
      <svg class="gradient">
        <defs>
          <linearGradient
            id="gradient"
            x1="0%"
            y1="100%"
            x2="100%"
            y2="100%"
          ></linearGradient>
        </defs>
        <rect height="10" style="fill: url('#gradient');"></rect>
      </svg>
      <div class="gradient-boundaries">
        <div>[[renderInfo.thresholds.0.value]]</div>
        <div>[[_getLastThreshold(renderInfo.thresholds)]]</div>
      </div>
    </template>
  `;
__decorate([
    property({ type: Object }),
    __metadata("design:type", Object)
], Legend.prototype, "renderInfo", void 0);
__decorate([
    observe('renderInfo'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Legend.prototype, "_renderInfoChanged", null);
Legend = __decorate([
    customElement('vz-projector-legend')
], Legend);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLWxlZ2VuZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3RlbnNvcmJvYXJkL3Byb2plY3Rvci92ei1wcm9qZWN0b3ItbGVnZW5kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7O2dGQWFnRjs7QUFFaEYsT0FBTyxFQUFDLGNBQWMsRUFBRSxJQUFJLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUN0RCxPQUFPLEVBQUMsYUFBYSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUVyRSxPQUFPLEVBQUMsa0JBQWtCLEVBQUMsTUFBTSw0Q0FBNEMsQ0FBQztBQUU5RSxPQUFPLFVBQVUsQ0FBQztBQXFCbEIsSUFBTSxNQUFNLEdBQVosTUFBTSxNQUFPLFNBQVEsa0JBQWtCLENBQUMsY0FBYyxDQUFDO0lBZ0VyRCxrQkFBa0I7UUFDaEIsSUFBSSxJQUFJLENBQUMsVUFBVSxJQUFJLElBQUksRUFBRTtZQUMzQixPQUFPO1NBQ1I7UUFDRCxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxFQUFFO1lBQzlCLGtFQUFrRTtZQUNsRSwwQ0FBMEM7WUFDMUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDO1NBQzlDO0lBQ0gsQ0FBQztJQUNELGlCQUFpQjtRQUNmLElBQUksSUFBSSxDQUFDLFVBQVUsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLElBQUksSUFBSSxFQUFFO1lBQ2pFLE9BQU87U0FDUjtRQUNELE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQzthQUNyRSxLQUFLLENBQUM7SUFDWCxDQUFDO0lBQ08sU0FBUyxDQUFDLEtBQWE7UUFDN0IsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBQ2hELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUNwQyxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUN0QyxDQUFDLEtBQUssQ0FBQztRQUNSLE9BQU8sQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztJQUNoRSxDQUFDO0lBQ08sbUJBQW1CO1FBQ3pCLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUE2QixDQUFDO1FBQ3hFLE1BQU0sS0FBSyxHQUFJLElBQUksQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFnQixDQUFDLFdBQVcsQ0FBQztRQUNsRSwwREFBMEQ7UUFDekQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBb0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUM7UUFDNUUsMENBQTBDO1FBQzFDLGNBQWMsQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO1FBQ2hDLHNFQUFzRTtRQUN0RSxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtZQUN2QyxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsZUFBZSxDQUMxQyw0QkFBNEIsRUFDNUIsTUFBTSxDQUNQLENBQUM7WUFDRixXQUFXLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQzVELFdBQVcsQ0FBQyxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNsRCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRixDQUFBO0FBeEdpQixlQUFRLEdBQUcsSUFBSSxDQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBMEQ5QixDQUFDO0FBRUY7SUFEQyxRQUFRLENBQUMsRUFBQyxJQUFJLEVBQUUsTUFBTSxFQUFDLENBQUM7OzBDQUNTO0FBR2xDO0lBREMsT0FBTyxDQUFDLFlBQVksQ0FBQzs7OztnREFVckI7QUF6RUcsTUFBTTtJQURYLGFBQWEsQ0FBQyxxQkFBcUIsQ0FBQztHQUMvQixNQUFNLENBeUdYIiwic291cmNlc0NvbnRlbnQiOlsiLyogQ29weXJpZ2h0IDIwMTYgVGhlIFRlbnNvckZsb3cgQXV0aG9ycy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG49PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuXG5pbXBvcnQge1BvbHltZXJFbGVtZW50LCBodG1sfSBmcm9tICdAcG9seW1lci9wb2x5bWVyJztcbmltcG9ydCB7Y3VzdG9tRWxlbWVudCwgb2JzZXJ2ZSwgcHJvcGVydHl9IGZyb20gJ0Bwb2x5bWVyL2RlY29yYXRvcnMnO1xuXG5pbXBvcnQge0xlZ2FjeUVsZW1lbnRNaXhpbn0gZnJvbSAnLi4vY29tcG9uZW50cy9wb2x5bWVyL2xlZ2FjeV9lbGVtZW50X21peGluJztcblxuaW1wb3J0ICcuL3N0eWxlcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29sb3JMZWdlbmRSZW5kZXJJbmZvIHtcbiAgLy8gVG8gYmUgdXNlZCBmb3IgY2F0ZWdvcmljYWwgbWFwLlxuICBpdGVtczogQ29sb3JMZWdlbmRJdGVtW107XG4gIC8vIFRvIGJlIHVzZWQgZm9yIGdyYWRpZW50IG1hcC5cbiAgdGhyZXNob2xkczogQ29sb3JMZWdlbmRUaHJlc2hvbGRbXTtcbn1cbi8qKiBBbiBpdGVtIGluIHRoZSBjYXRlZ29yaWNhbCBjb2xvciBsZWdlbmQuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbG9yTGVnZW5kSXRlbSB7XG4gIGNvbG9yOiBzdHJpbmc7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIGNvdW50OiBudW1iZXI7XG59XG4vKiogQW4gaXRlbSBpbiB0aGUgZ3JhZGllbnQgY29sb3IgbGVnZW5kLiAqL1xuZXhwb3J0IGludGVyZmFjZSBDb2xvckxlZ2VuZFRocmVzaG9sZCB7XG4gIGNvbG9yOiBzdHJpbmc7XG4gIHZhbHVlOiBudW1iZXI7XG59XG5cbkBjdXN0b21FbGVtZW50KCd2ei1wcm9qZWN0b3ItbGVnZW5kJylcbmNsYXNzIExlZ2VuZCBleHRlbmRzIExlZ2FjeUVsZW1lbnRNaXhpbihQb2x5bWVyRWxlbWVudCkge1xuICBzdGF0aWMgcmVhZG9ubHkgdGVtcGxhdGUgPSBodG1sYFxuICAgIDxzdHlsZSBpbmNsdWRlPVwidnotcHJvamVjdG9yLXN0eWxlc1wiPjwvc3R5bGU+XG4gICAgPHN0eWxlPlxuICAgICAgLml0ZW0ge1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMTBweDtcbiAgICAgIH1cblxuICAgICAgLnNoYXBlIHtcbiAgICAgICAgd2lkdGg6IDEwcHg7XG4gICAgICAgIGhlaWdodDogMTBweDtcbiAgICAgICAgbWFyZ2luLXJpZ2h0OiAxMHB4O1xuICAgICAgICBtYXJnaW4tdG9wOiA1cHg7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcbiAgICAgIH1cblxuICAgICAgLmxhYmVsIHtcbiAgICAgICAgZmxleC1ncm93OiAxO1xuICAgICAgfVxuXG4gICAgICAuZ3JhZGllbnQge1xuICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgaGVpZ2h0OiAxMHB4O1xuICAgICAgfVxuXG4gICAgICAuZ3JhZGllbnQtYm91bmRhcmllcyB7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgIH1cbiAgICA8L3N0eWxlPlxuXG4gICAgPHRlbXBsYXRlIGlzPVwiZG9tLXJlcGVhdFwiIGl0ZW1zPVwiW1tyZW5kZXJJbmZvLml0ZW1zXV1cIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJpdGVtXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJzaGFwZVwiIHN0eWxlPVwiYmFja2dyb3VuZC1jb2xvcjogW1tpdGVtLmNvbG9yXV07XCI+PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJsYWJlbFwiPltbaXRlbS5sYWJlbF1dPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJpbmZvXCIgc3R5bGU9XCJjb2xvcjogW1tpdGVtLmNvbG9yXV07XCI+W1tpdGVtLmNvdW50XV08L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvdGVtcGxhdGU+XG5cbiAgICA8dGVtcGxhdGUgaXM9XCJkb20taWZcIiBpZj1cIltbcmVuZGVySW5mby50aHJlc2hvbGRzXV1cIj5cbiAgICAgIDxzdmcgY2xhc3M9XCJncmFkaWVudFwiPlxuICAgICAgICA8ZGVmcz5cbiAgICAgICAgICA8bGluZWFyR3JhZGllbnRcbiAgICAgICAgICAgIGlkPVwiZ3JhZGllbnRcIlxuICAgICAgICAgICAgeDE9XCIwJVwiXG4gICAgICAgICAgICB5MT1cIjEwMCVcIlxuICAgICAgICAgICAgeDI9XCIxMDAlXCJcbiAgICAgICAgICAgIHkyPVwiMTAwJVwiXG4gICAgICAgICAgPjwvbGluZWFyR3JhZGllbnQ+XG4gICAgICAgIDwvZGVmcz5cbiAgICAgICAgPHJlY3QgaGVpZ2h0PVwiMTBcIiBzdHlsZT1cImZpbGw6IHVybCgnI2dyYWRpZW50Jyk7XCI+PC9yZWN0PlxuICAgICAgPC9zdmc+XG4gICAgICA8ZGl2IGNsYXNzPVwiZ3JhZGllbnQtYm91bmRhcmllc1wiPlxuICAgICAgICA8ZGl2PltbcmVuZGVySW5mby50aHJlc2hvbGRzLjAudmFsdWVdXTwvZGl2PlxuICAgICAgICA8ZGl2PltbX2dldExhc3RUaHJlc2hvbGQocmVuZGVySW5mby50aHJlc2hvbGRzKV1dPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L3RlbXBsYXRlPlxuICBgO1xuICBAcHJvcGVydHkoe3R5cGU6IE9iamVjdH0pXG4gIHJlbmRlckluZm86IENvbG9yTGVnZW5kUmVuZGVySW5mbztcblxuICBAb2JzZXJ2ZSgncmVuZGVySW5mbycpXG4gIF9yZW5kZXJJbmZvQ2hhbmdlZCgpIHtcbiAgICBpZiAodGhpcy5yZW5kZXJJbmZvID09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHRoaXMucmVuZGVySW5mby50aHJlc2hvbGRzKSB7XG4gICAgICAvLyA8bGluZWFyR3JhZGllbnQ+IGlzIHVuZGVyIGRvbS1pZiBzbyB3ZSBzaG91bGQgd2FpdCBmb3IgaXQgdG8gYmVcbiAgICAgIC8vIGluc2VydGVkIGluIHRoZSBkb20gdHJlZSB1c2luZyBhc3luYygpLlxuICAgICAgdGhpcy5hc3luYygoKSA9PiB0aGlzLnNldHVwTGluZWFyR3JhZGllbnQoKSk7XG4gICAgfVxuICB9XG4gIF9nZXRMYXN0VGhyZXNob2xkKCk6IG51bWJlciB7XG4gICAgaWYgKHRoaXMucmVuZGVySW5mbyA9PSBudWxsIHx8IHRoaXMucmVuZGVySW5mby50aHJlc2hvbGRzID09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucmVuZGVySW5mby50aHJlc2hvbGRzW3RoaXMucmVuZGVySW5mby50aHJlc2hvbGRzLmxlbmd0aCAtIDFdXG4gICAgICAudmFsdWU7XG4gIH1cbiAgcHJpdmF0ZSBnZXRPZmZzZXQodmFsdWU6IG51bWJlcik6IHN0cmluZyB7XG4gICAgY29uc3QgbWluID0gdGhpcy5yZW5kZXJJbmZvLnRocmVzaG9sZHNbMF0udmFsdWU7XG4gICAgY29uc3QgbWF4ID0gdGhpcy5yZW5kZXJJbmZvLnRocmVzaG9sZHNbXG4gICAgICB0aGlzLnJlbmRlckluZm8udGhyZXNob2xkcy5sZW5ndGggLSAxXG4gICAgXS52YWx1ZTtcbiAgICByZXR1cm4gKCgxMDAgKiAodmFsdWUgLSBtaW4pKSAvIChtYXggLSBtaW4pKS50b0ZpeGVkKDIpICsgJyUnO1xuICB9XG4gIHByaXZhdGUgc2V0dXBMaW5lYXJHcmFkaWVudCgpIHtcbiAgICBjb25zdCBsaW5lYXJHcmFkaWVudCA9IHRoaXMuJCQoJyNncmFkaWVudCcpIGFzIFNWR0xpbmVhckdyYWRpZW50RWxlbWVudDtcbiAgICBjb25zdCB3aWR0aCA9ICh0aGlzLiQkKCdzdmcuZ3JhZGllbnQnKSBhcyBTVkdFbGVtZW50KS5jbGllbnRXaWR0aDtcbiAgICAvLyBTZXQgdGhlIHN2ZyA8cmVjdD4gdG8gYmUgdGhlIHdpZHRoIG9mIGl0cyA8c3ZnPiBwYXJlbnQuXG4gICAgKHRoaXMuJCQoJ3N2Zy5ncmFkaWVudCByZWN0JykgYXMgU1ZHUmVjdEVsZW1lbnQpLnN0eWxlLndpZHRoID0gd2lkdGggKyAncHgnO1xuICAgIC8vIFJlbW92ZSBhbGwgPHN0b3A+IGNoaWxkcmVuIGZyb20gYmVmb3JlLlxuICAgIGxpbmVhckdyYWRpZW50LnRleHRDb250ZW50ID0gJyc7XG4gICAgLy8gQWRkIGEgPHN0b3A+IGNoaWxkIGluIDxsaW5lYXJHcmFkaWVudD4gZm9yIGVhY2ggZ3JhZGllbnQgdGhyZXNob2xkLlxuICAgIHRoaXMucmVuZGVySW5mby50aHJlc2hvbGRzLmZvckVhY2goKHQpID0+IHtcbiAgICAgIGNvbnN0IHN0b3BFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFxuICAgICAgICAnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLFxuICAgICAgICAnc3RvcCdcbiAgICAgICk7XG4gICAgICBzdG9wRWxlbWVudC5zZXRBdHRyaWJ1dGUoJ29mZnNldCcsIHRoaXMuZ2V0T2Zmc2V0KHQudmFsdWUpKTtcbiAgICAgIHN0b3BFbGVtZW50LnNldEF0dHJpYnV0ZSgnc3RvcC1jb2xvcicsIHQuY29sb3IpO1xuICAgIH0pO1xuICB9XG59XG4iXX0=