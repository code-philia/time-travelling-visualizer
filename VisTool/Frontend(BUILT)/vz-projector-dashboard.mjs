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
let VzProjectorDashboard = class VzProjectorDashboard extends PolymerElement {
    constructor() {
        super(...arguments);
        this._routePrefix = '.';
    }
    reload() {
        // Do not reload the embedding projector. Reloading could take a long time.
    }
    connectedCallback() {
        super.connectedCallback();
        if (this._initialized) {
            return;
        }
        let xhr = new XMLHttpRequest();
        xhr.open('GET', this._routePrefix + '/runs');
        xhr.onload = () => {
            // Set this to true so we only initialize once.
            this._initialized = true;
            let runs = JSON.parse(xhr.responseText);
            this.set('dataNotFound', runs.length === 0);
        };
        xhr.onerror = () => {
            this.set('dataNotFound', false);
        };
        xhr.send();
    }
};
VzProjectorDashboard.template = html `
    <template is="dom-if" if="[[dataNotFound]]">
      <div style="max-width: 540px; margin: 80px auto 0 auto;">
        <h3>No checkpoint was found.</h3>
        <p>Probable causes:</p>
        <ul>
          <li>
            No checkpoint has been saved yet. Please refresh the page
            periodically.
          </li>

          <li>
            You are not saving any checkpoint. To save your model, create a
            <a href="https://www.tensorflow.org/api_docs/python/tf/train/Saver"
              ><code>tf.train.Saver</code></a
            >
            and save your model periodically by calling
            <code>saver.save(session, LOG_DIR/model.ckpt, step)</code>.
          </li>
        </ul>

        <p>
          If you’re new to using TensorBoard, and want to find out how to add
          data and set up your event files, check out the
          <a
            href="https://github.com/tensorflow/tensorboard/blob/master/README.md"
            >README</a
          >
          and perhaps the
          <a
            href="https://www.tensorflow.org/get_started/summaries_and_tensorboard"
            >TensorBoard tutorial</a
          >.
        </p>

        <p>
          If you think TensorBoard is configured properly, please see
          <a
            href="https://github.com/tensorflow/tensorboard/blob/master/README.md#my-tensorboard-isnt-showing-any-data-whats-wrong"
            >the section of the README devoted to missing data problems</a
          >
          and consider filing an issue on GitHub.
        </p>
      </div>
    </template>
    <template is="dom-if" if="[[!dataNotFound]]">
      <vz-projector
        id="projector"
        route-prefix="[[_routePrefix]]"
        serving-mode="server"
        page-view-logging=""
        event-logging=""
      ></vz-projector>
    </template>
  `;
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], VzProjectorDashboard.prototype, "dataNotFound", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], VzProjectorDashboard.prototype, "_routePrefix", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], VzProjectorDashboard.prototype, "_initialized", void 0);
VzProjectorDashboard = __decorate([
    customElement('vz-projector-dashboard')
], VzProjectorDashboard);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLWRhc2hib2FyZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3RlbnNvcmJvYXJkL3Byb2plY3Rvci92ei1wcm9qZWN0b3ItZGFzaGJvYXJkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7O2dGQWFnRjs7QUFFaEYsT0FBTyxFQUFDLGNBQWMsRUFBRSxJQUFJLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUN0RCxPQUFPLEVBQUMsYUFBYSxFQUFFLFFBQVEsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBRzVELElBQU0sb0JBQW9CLEdBQTFCLE1BQU0sb0JBQXFCLFNBQVEsY0FBYztJQUFqRDs7UUE0REUsaUJBQVksR0FBVyxHQUFHLENBQUM7SUE0QjdCLENBQUM7SUF2QkMsTUFBTTtRQUNKLDJFQUEyRTtJQUM3RSxDQUFDO0lBRUQsaUJBQWlCO1FBQ2YsS0FBSyxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFFMUIsSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ3JCLE9BQU87U0FDUjtRQUNELElBQUksR0FBRyxHQUFHLElBQUksY0FBYyxFQUFFLENBQUM7UUFDL0IsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVksR0FBRyxPQUFPLENBQUMsQ0FBQztRQUM3QyxHQUFHLENBQUMsTUFBTSxHQUFHLEdBQUcsRUFBRTtZQUNoQiwrQ0FBK0M7WUFDL0MsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUM7WUFDekIsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDeEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQztRQUM5QyxDQUFDLENBQUM7UUFDRixHQUFHLENBQUMsT0FBTyxHQUFHLEdBQUcsRUFBRTtZQUNqQixJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNsQyxDQUFDLENBQUM7UUFDRixHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDYixDQUFDO0NBQ0YsQ0FBQTtBQXZGaUIsNkJBQVEsR0FBRyxJQUFJLENBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXNEOUIsQ0FBQztBQUVGO0lBREMsUUFBUSxDQUFDLEVBQUMsSUFBSSxFQUFFLE9BQU8sRUFBQyxDQUFDOzswREFDSjtBQUd0QjtJQURDLFFBQVEsQ0FBQyxFQUFDLElBQUksRUFBRSxNQUFNLEVBQUMsQ0FBQzs7MERBQ0U7QUFHM0I7SUFEQyxRQUFRLENBQUMsRUFBQyxJQUFJLEVBQUUsT0FBTyxFQUFDLENBQUM7OzBEQUNKO0FBL0RsQixvQkFBb0I7SUFEekIsYUFBYSxDQUFDLHdCQUF3QixDQUFDO0dBQ2xDLG9CQUFvQixDQXdGekIiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBDb3B5cmlnaHQgMjAyMCBUaGUgVGVuc29yRmxvdyBBdXRob3JzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5cbmltcG9ydCB7UG9seW1lckVsZW1lbnQsIGh0bWx9IGZyb20gJ0Bwb2x5bWVyL3BvbHltZXInO1xuaW1wb3J0IHtjdXN0b21FbGVtZW50LCBwcm9wZXJ0eX0gZnJvbSAnQHBvbHltZXIvZGVjb3JhdG9ycyc7XG5cbkBjdXN0b21FbGVtZW50KCd2ei1wcm9qZWN0b3ItZGFzaGJvYXJkJylcbmNsYXNzIFZ6UHJvamVjdG9yRGFzaGJvYXJkIGV4dGVuZHMgUG9seW1lckVsZW1lbnQge1xuICBzdGF0aWMgcmVhZG9ubHkgdGVtcGxhdGUgPSBodG1sYFxuICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1pZlwiIGlmPVwiW1tkYXRhTm90Rm91bmRdXVwiPlxuICAgICAgPGRpdiBzdHlsZT1cIm1heC13aWR0aDogNTQwcHg7IG1hcmdpbjogODBweCBhdXRvIDAgYXV0bztcIj5cbiAgICAgICAgPGgzPk5vIGNoZWNrcG9pbnQgd2FzIGZvdW5kLjwvaDM+XG4gICAgICAgIDxwPlByb2JhYmxlIGNhdXNlczo8L3A+XG4gICAgICAgIDx1bD5cbiAgICAgICAgICA8bGk+XG4gICAgICAgICAgICBObyBjaGVja3BvaW50IGhhcyBiZWVuIHNhdmVkIHlldC4gUGxlYXNlIHJlZnJlc2ggdGhlIHBhZ2VcbiAgICAgICAgICAgIHBlcmlvZGljYWxseS5cbiAgICAgICAgICA8L2xpPlxuXG4gICAgICAgICAgPGxpPlxuICAgICAgICAgICAgWW91IGFyZSBub3Qgc2F2aW5nIGFueSBjaGVja3BvaW50LiBUbyBzYXZlIHlvdXIgbW9kZWwsIGNyZWF0ZSBhXG4gICAgICAgICAgICA8YSBocmVmPVwiaHR0cHM6Ly93d3cudGVuc29yZmxvdy5vcmcvYXBpX2RvY3MvcHl0aG9uL3RmL3RyYWluL1NhdmVyXCJcbiAgICAgICAgICAgICAgPjxjb2RlPnRmLnRyYWluLlNhdmVyPC9jb2RlPjwvYVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgYW5kIHNhdmUgeW91ciBtb2RlbCBwZXJpb2RpY2FsbHkgYnkgY2FsbGluZ1xuICAgICAgICAgICAgPGNvZGU+c2F2ZXIuc2F2ZShzZXNzaW9uLCBMT0dfRElSL21vZGVsLmNrcHQsIHN0ZXApPC9jb2RlPi5cbiAgICAgICAgICA8L2xpPlxuICAgICAgICA8L3VsPlxuXG4gICAgICAgIDxwPlxuICAgICAgICAgIElmIHlvdeKAmXJlIG5ldyB0byB1c2luZyBUZW5zb3JCb2FyZCwgYW5kIHdhbnQgdG8gZmluZCBvdXQgaG93IHRvIGFkZFxuICAgICAgICAgIGRhdGEgYW5kIHNldCB1cCB5b3VyIGV2ZW50IGZpbGVzLCBjaGVjayBvdXQgdGhlXG4gICAgICAgICAgPGFcbiAgICAgICAgICAgIGhyZWY9XCJodHRwczovL2dpdGh1Yi5jb20vdGVuc29yZmxvdy90ZW5zb3Jib2FyZC9ibG9iL21hc3Rlci9SRUFETUUubWRcIlxuICAgICAgICAgICAgPlJFQURNRTwvYVxuICAgICAgICAgID5cbiAgICAgICAgICBhbmQgcGVyaGFwcyB0aGVcbiAgICAgICAgICA8YVxuICAgICAgICAgICAgaHJlZj1cImh0dHBzOi8vd3d3LnRlbnNvcmZsb3cub3JnL2dldF9zdGFydGVkL3N1bW1hcmllc19hbmRfdGVuc29yYm9hcmRcIlxuICAgICAgICAgICAgPlRlbnNvckJvYXJkIHR1dG9yaWFsPC9hXG4gICAgICAgICAgPi5cbiAgICAgICAgPC9wPlxuXG4gICAgICAgIDxwPlxuICAgICAgICAgIElmIHlvdSB0aGluayBUZW5zb3JCb2FyZCBpcyBjb25maWd1cmVkIHByb3Blcmx5LCBwbGVhc2Ugc2VlXG4gICAgICAgICAgPGFcbiAgICAgICAgICAgIGhyZWY9XCJodHRwczovL2dpdGh1Yi5jb20vdGVuc29yZmxvdy90ZW5zb3Jib2FyZC9ibG9iL21hc3Rlci9SRUFETUUubWQjbXktdGVuc29yYm9hcmQtaXNudC1zaG93aW5nLWFueS1kYXRhLXdoYXRzLXdyb25nXCJcbiAgICAgICAgICAgID50aGUgc2VjdGlvbiBvZiB0aGUgUkVBRE1FIGRldm90ZWQgdG8gbWlzc2luZyBkYXRhIHByb2JsZW1zPC9hXG4gICAgICAgICAgPlxuICAgICAgICAgIGFuZCBjb25zaWRlciBmaWxpbmcgYW4gaXNzdWUgb24gR2l0SHViLlxuICAgICAgICA8L3A+XG4gICAgICA8L2Rpdj5cbiAgICA8L3RlbXBsYXRlPlxuICAgIDx0ZW1wbGF0ZSBpcz1cImRvbS1pZlwiIGlmPVwiW1shZGF0YU5vdEZvdW5kXV1cIj5cbiAgICAgIDx2ei1wcm9qZWN0b3JcbiAgICAgICAgaWQ9XCJwcm9qZWN0b3JcIlxuICAgICAgICByb3V0ZS1wcmVmaXg9XCJbW19yb3V0ZVByZWZpeF1dXCJcbiAgICAgICAgc2VydmluZy1tb2RlPVwic2VydmVyXCJcbiAgICAgICAgcGFnZS12aWV3LWxvZ2dpbmc9XCJcIlxuICAgICAgICBldmVudC1sb2dnaW5nPVwiXCJcbiAgICAgID48L3Z6LXByb2plY3Rvcj5cbiAgICA8L3RlbXBsYXRlPlxuICBgO1xuICBAcHJvcGVydHkoe3R5cGU6IEJvb2xlYW59KVxuICBkYXRhTm90Rm91bmQ6IGJvb2xlYW47XG5cbiAgQHByb3BlcnR5KHt0eXBlOiBTdHJpbmd9KVxuICBfcm91dGVQcmVmaXg6IHN0cmluZyA9ICcuJztcblxuICBAcHJvcGVydHkoe3R5cGU6IEJvb2xlYW59KVxuICBfaW5pdGlhbGl6ZWQ6IGJvb2xlYW47XG5cbiAgcmVsb2FkKCkge1xuICAgIC8vIERvIG5vdCByZWxvYWQgdGhlIGVtYmVkZGluZyBwcm9qZWN0b3IuIFJlbG9hZGluZyBjb3VsZCB0YWtlIGEgbG9uZyB0aW1lLlxuICB9XG5cbiAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgc3VwZXIuY29ubmVjdGVkQ2FsbGJhY2soKTtcblxuICAgIGlmICh0aGlzLl9pbml0aWFsaXplZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsZXQgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgeGhyLm9wZW4oJ0dFVCcsIHRoaXMuX3JvdXRlUHJlZml4ICsgJy9ydW5zJyk7XG4gICAgeGhyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgIC8vIFNldCB0aGlzIHRvIHRydWUgc28gd2Ugb25seSBpbml0aWFsaXplIG9uY2UuXG4gICAgICB0aGlzLl9pbml0aWFsaXplZCA9IHRydWU7XG4gICAgICBsZXQgcnVucyA9IEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICB0aGlzLnNldCgnZGF0YU5vdEZvdW5kJywgcnVucy5sZW5ndGggPT09IDApO1xuICAgIH07XG4gICAgeGhyLm9uZXJyb3IgPSAoKSA9PiB7XG4gICAgICB0aGlzLnNldCgnZGF0YU5vdEZvdW5kJywgZmFsc2UpO1xuICAgIH07XG4gICAgeGhyLnNlbmQoKTtcbiAgfVxufVxuIl19