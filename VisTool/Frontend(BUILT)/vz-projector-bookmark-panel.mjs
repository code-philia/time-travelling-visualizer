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
import { PolymerElement } from '@polymer/polymer';
import { customElement, property } from '@polymer/decorators';
import '../components/polymer/irons_and_papers';
import { LegacyElementMixin } from '../components/polymer/legacy_element_mixin';
import { template } from './vz-projector-bookmark-panel.html';
import * as logging from './logging';
let BookmarkPanel = class BookmarkPanel extends LegacyElementMixin(PolymerElement) {
    constructor() {
        super(...arguments);
        // Keep a separate polymer property because the savedStates doesn't change
        // when adding and removing states.
        this.hasStates = false;
    }
    ready() {
        super.ready();
        this.savedStates = [];
        this.setupUploadButton();
        this.ignoreNextProjectionEvent = false;
        this.expandLessButton = this.$$('#expand-less');
        this.expandMoreButton = this.$$('#expand-more');
    }
    initialize(projector, projectorEventContext) {
        this.projector = projector;
        projectorEventContext.registerProjectionChangedListener(() => {
            if (this.ignoreNextProjectionEvent) {
                this.ignoreNextProjectionEvent = false;
            }
            else {
                this.clearStateSelection();
            }
        });
    }
    setSelectedTensor(run, tensorInfo, dataProvider) {
        // Clear any existing bookmarks.
        this.addStates(null);
        if (tensorInfo && tensorInfo.bookmarksPath) {
            // Get any bookmarks that may come when the projector starts up.
            dataProvider.getBookmarks(run, tensorInfo.tensorName, (bookmarks) => {
                this.addStates(bookmarks);
                this._expandMore();
            });
        }
        else {
            this._expandLess();
        }
    }
    /** Handles a click on show bookmarks tray button. */
    _expandMore() {
        this.$.panel.show();
        this.expandMoreButton.style.display = 'none';
        this.expandLessButton.style.display = '';
    }
    /** Handles a click on hide bookmarks tray button. */
    _expandLess() {
        this.$.panel.hide();
        this.expandMoreButton.style.display = '';
        this.expandLessButton.style.display = 'none';
    }
    /** Handles a click on the add bookmark button. */
    _addBookmark() {
        let currentState = this.projector.getCurrentState();
        currentState.label = 'State ' + this.savedStates.length;
        currentState.isSelected = true;
        this.selectedState = this.savedStates.length;
        for (let i = 0; i < this.savedStates.length; i++) {
            this.savedStates[i].isSelected = false;
            // We have to call notifyPath so that polymer knows this element was
            // updated.
            this.notifyPath('savedStates.' + i + '.isSelected', false);
        }
        this.push('savedStates', currentState);
        this.updateHasStates();
    }
    /** Handles a click on the download bookmarks button. */
    _downloadFile() {
        let serializedState = this.serializeAllSavedStates();
        let blob = new Blob([serializedState], { type: 'text/plain' });
        // TODO(b/162788443): Undo conformance workaround.
        let textFile = window.URL['createObjectURL'](blob);
        // Force a download.
        let a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        // TODO(b/162788443): Undo conformance workaround.
        Object.assign(a, { href: textFile });
        a.download = 'state';
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(textFile);
    }
    /** Handles a click on the upload bookmarks button. */
    _uploadFile() {
        let fileInput = this.$$('#state-file');
        fileInput.click();
    }
    setupUploadButton() {
        // Show and setup the load view button.
        const fileInput = this.$$('#state-file');
        fileInput.onchange = () => {
            const file = fileInput.files[0];
            // Clear out the value of the file chooser. This ensures that if the user
            // selects the same file, we'll re-read it.
            fileInput.value = '';
            const fileReader = new FileReader();
            fileReader.onload = (evt) => {
                const str = fileReader.result;
                const savedStates = JSON.parse(str);
                // Verify the bookmarks match.
                if (this.savedStatesValid(savedStates)) {
                    this.addStates(savedStates);
                    this.loadSavedState(0);
                }
                else {
                    logging.setWarningMessage(`Unable to load bookmarks: wrong dataset, expected dataset ` +
                        `with shape (${savedStates[0].dataSetDimensions}).`);
                }
            };
            fileReader.readAsText(file);
        };
    }
    addStates(savedStates) {
        if (savedStates == null) {
            this.savedStates = [];
        }
        else {
            for (let i = 0; i < savedStates.length; i++) {
                savedStates[i].isSelected = false;
                this.push('savedStates', savedStates[i]);
            }
        }
        this.updateHasStates();
    }
    /** Deselects any selected state selection. */
    clearStateSelection() {
        for (let i = 0; i < this.savedStates.length; i++) {
            this.setSelectionState(i, false);
        }
    }
    /** Handles a radio button click on a saved state. */
    _radioButtonHandler(evt) {
        const index = this.getParentDataIndex(evt);
        this.loadSavedState(index);
        this.setSelectionState(index, true);
    }
    loadSavedState(index) {
        for (let i = 0; i < this.savedStates.length; i++) {
            if (this.savedStates[i].isSelected) {
                this.setSelectionState(i, false);
            }
            else if (index === i) {
                this.setSelectionState(i, true);
                this.ignoreNextProjectionEvent = true;
                this.projector.loadState(this.savedStates[i]);
            }
        }
    }
    setSelectionState(stateIndex, selected) {
        this.savedStates[stateIndex].isSelected = selected;
        const path = 'savedStates.' + stateIndex + '.isSelected';
        this.notifyPath(path, selected);
    }
    /**
     * Crawls up the DOM to find an ancestor with a data-index attribute. This is
     * used to match events to their bookmark index.
     */
    getParentDataIndex(evt) {
        for (let i = 0; i < evt.path.length; i++) {
            let elem = evt.path[i];
            if (elem instanceof HTMLElement) {
                let dataIndex = elem.getAttribute('data-index');
                if (dataIndex != null) {
                    return +dataIndex;
                }
            }
        }
        return -1;
    }
    /** Handles a clear button click on a bookmark. */
    _clearButtonHandler(evt) {
        let index = this.getParentDataIndex(evt);
        this.splice('savedStates', index, 1);
        this.updateHasStates();
    }
    /** Handles a label change event on a bookmark. */
    _labelChange(evt) {
        let index = this.getParentDataIndex(evt);
        this.savedStates[index].label = evt.target.value;
    }
    /**
     * Used to determine whether to select the radio button for a given bookmark.
     */
    _isSelectedState(index) {
        return index === this.selectedState;
    }
    _isNotSelectedState(index) {
        return index !== this.selectedState;
    }
    /**
     * Gets all of the saved states as a serialized string.
     */
    serializeAllSavedStates() {
        return JSON.stringify(this.savedStates);
    }
    /**
     * Loads all of the serialized states and shows them in the list of
     * viewable states.
     */
    loadSavedStates(serializedStates) {
        this.savedStates = JSON.parse(serializedStates);
        this.updateHasStates();
    }
    /**
     * Updates the hasState polymer property.
     */
    updateHasStates() {
        this.hasStates = this.savedStates.length !== 0;
    }
    /** Sanity checks a State array to ensure it matches the current dataset. */
    savedStatesValid(states) {
        for (let i = 0; i < states.length; i++) {
            if (states[i].dataSetDimensions[0] !== this.projector.dataSet.dim[0] ||
                states[i].dataSetDimensions[1] !== this.projector.dataSet.dim[1]) {
                return false;
            }
        }
        return true;
    }
};
BookmarkPanel.template = template;
__decorate([
    property({ type: Object }),
    __metadata("design:type", Array)
], BookmarkPanel.prototype, "savedStates", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], BookmarkPanel.prototype, "hasStates", void 0);
__decorate([
    property({ type: Number }),
    __metadata("design:type", Number)
], BookmarkPanel.prototype, "selectedState", void 0);
BookmarkPanel = __decorate([
    customElement('vz-projector-bookmark-panel')
], BookmarkPanel);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLWJvb2ttYXJrLXBhbmVsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVuc29yYm9hcmQvcHJvamVjdG9yL3Z6LXByb2plY3Rvci1ib29rbWFyay1wYW5lbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7Z0ZBYWdGO0FBQ2hGLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNoRCxPQUFPLEVBQUMsYUFBYSxFQUFFLFFBQVEsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBRTVELE9BQU8sd0NBQXdDLENBQUM7QUFDaEQsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sNENBQTRDLENBQUM7QUFFOUUsT0FBTyxFQUFDLFFBQVEsRUFBQyxNQUFNLG9DQUFvQyxDQUFDO0FBSTVELE9BQU8sS0FBSyxPQUFPLE1BQU0sV0FBVyxDQUFDO0FBR3JDLElBQU0sYUFBYSxHQUFuQixNQUFNLGFBQWMsU0FBUSxrQkFBa0IsQ0FBQyxjQUFjLENBQUM7SUFBOUQ7O1FBS0UsMEVBQTBFO1FBQzFFLG1DQUFtQztRQUVuQyxjQUFTLEdBQVksS0FBSyxDQUFDO0lBa083QixDQUFDO0lBek5DLEtBQUs7UUFDSCxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDZCxJQUFJLENBQUMsV0FBVyxHQUFHLEVBQUUsQ0FBQztRQUN0QixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUN6QixJQUFJLENBQUMseUJBQXlCLEdBQUcsS0FBSyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBc0IsQ0FBQztRQUNyRSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQXNCLENBQUM7SUFDdkUsQ0FBQztJQUNELFVBQVUsQ0FBQyxTQUFjLEVBQUUscUJBQTRDO1FBQ3JFLElBQUks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QUFRLENBQUMsRUFBQyxJQUFJLEVBQUUsT0FBTyxFQUFDLENBQUM7O2dEQUNDO0FBRTNCO0lBREMsUUFBUSxDQUFDLEVBQUMsSUFBSSxFQUFFLE1BQU0sRUFBQyxDQUFDOztvREFDSDtBQVZsQixhQUFhO0lBRGxCLGFBQWEsQ0FBQyw2QkFBNkIsQ0FBQztHQUN2QyxhQUFhLENBME9sQiIsInNvdXJjZXNDb250ZW50IjpbIi8qIENvcHlyaWdodCAyMDE2IFRoZSBUZW5zb3JGbG93IEF1dGhvcnMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cbmltcG9ydCB7UG9seW1lckVsZW1lbnR9IGZyb20gJ0Bwb2x5bWVyL3BvbHltZXInO1xuaW1wb3J0IHtjdXN0b21FbGVtZW50LCBwcm9wZXJ0eX0gZnJvbSAnQHBvbHltZXIvZGVjb3JhdG9ycyc7XG5cbmltcG9ydCAnLi4vY29tcG9uZW50cy9wb2x5bWVyL2lyb25zX2FuZF9wYXBlcnMnO1xuaW1wb3J0IHtMZWdhY3lFbGVtZW50TWl4aW59IGZyb20gJy4uL2NvbXBvbmVudHMvcG9seW1lci9sZWdhY3lfZWxlbWVudF9taXhpbic7XG5cbmltcG9ydCB7dGVtcGxhdGV9IGZyb20gJy4vdnotcHJvamVjdG9yLWJvb2ttYXJrLXBhbmVsLmh0bWwnO1xuaW1wb3J0IHtTdGF0ZX0gZnJvbSAnLi9kYXRhJztcbmltcG9ydCB7UHJvamVjdG9yRXZlbnRDb250ZXh0fSBmcm9tICcuL3Byb2plY3RvckV2ZW50Q29udGV4dCc7XG5pbXBvcnQge0RhdGFQcm92aWRlciwgRW1iZWRkaW5nSW5mb30gZnJvbSAnLi9kYXRhLXByb3ZpZGVyJztcbmltcG9ydCAqIGFzIGxvZ2dpbmcgZnJvbSAnLi9sb2dnaW5nJztcblxuQGN1c3RvbUVsZW1lbnQoJ3Z6LXByb2plY3Rvci1ib29rbWFyay1wYW5lbCcpXG5jbGFzcyBCb29rbWFya1BhbmVsIGV4dGVuZHMgTGVnYWN5RWxlbWVudE1peGluKFBvbHltZXJFbGVtZW50KSB7XG4gIHN0YXRpYyByZWFkb25seSB0ZW1wbGF0ZSA9IHRlbXBsYXRlO1xuXG4gIEBwcm9wZXJ0eSh7dHlwZTogT2JqZWN0fSlcbiAgc2F2ZWRTdGF0ZXM6IEFycmF5PGFueT47XG4gIC8vIEtlZXAgYSBzZXBhcmF0ZSBwb2x5bWVyIHByb3BlcnR5IGJlY2F1c2UgdGhlIHNhdmVkU3RhdGVzIGRvZXNuJ3QgY2hhbmdlXG4gIC8vIHdoZW4gYWRkaW5nIGFuZCByZW1vdmluZyBzdGF0ZXMuXG4gIEBwcm9wZXJ0eSh7dHlwZTogQm9vbGVhbn0pXG4gIGhhc1N0YXRlczogYm9vbGVhbiA9IGZhbHNlO1xuICBAcHJvcGVydHkoe3R5cGU6IE51bWJlcn0pXG4gIHNlbGVjdGVkU3RhdGU6IG51bWJlcjtcblxuICBwcml2YXRlIHByb2plY3RvcjogYW55O1xuICBwcml2YXRlIGlnbm9yZU5leHRQcm9qZWN0aW9uRXZlbnQ6IGJvb2xlYW47XG4gIHByaXZhdGUgZXhwYW5kTGVzc0J1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHByaXZhdGUgZXhwYW5kTW9yZUJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cbiAgcmVhZHkoKSB7XG4gICAgc3VwZXIucmVhZHkoKTtcbiAgICB0aGlzLnNhdmVkU3RhdGVzID0gW107XG4gICAgdGhpcy5zZXR1cFVwbG9hZEJ1dHRvbigpO1xuICAgIHRoaXMuaWdub3JlTmV4dFByb2plY3Rpb25FdmVudCA9IGZhbHNlO1xuICAgIHRoaXMuZXhwYW5kTGVzc0J1dHRvbiA9IHRoaXMuJCQoJyNleHBhbmQtbGVzcycpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuICAgIHRoaXMuZXhwYW5kTW9yZUJ1dHRvbiA9IHRoaXMuJCQoJyNleHBhbmQtbW9yZScpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuICB9XG4gIGluaXRpYWxpemUocHJvamVjdG9yOiBhbnksIHByb2plY3RvckV2ZW50Q29udGV4dDogUHJvamVjdG9yRXZlbnRDb250ZXh0KSB7XG4gICAgdGhpcy5wcm9qZWN0b3IgPSBwcm9qZWN0b3I7XG4gICAgcHJvamVjdG9yRXZlbnRDb250ZXh0LnJlZ2lzdGVyUHJvamVjdGlvbkNoYW5nZWRMaXN0ZW5lcigoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pZ25vcmVOZXh0UHJvamVjdGlvbkV2ZW50KSB7XG4gICAgICAgIHRoaXMuaWdub3JlTmV4dFByb2plY3Rpb25FdmVudCA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jbGVhclN0YXRlU2VsZWN0aW9uKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgc2V0U2VsZWN0ZWRUZW5zb3IoXG4gICAgcnVuOiBzdHJpbmcsXG4gICAgdGVuc29ySW5mbzogRW1iZWRkaW5nSW5mbyxcbiAgICBkYXRhUHJvdmlkZXI6IERhdGFQcm92aWRlclxuICApIHtcbiAgICAvLyBDbGVhciBhbnkgZXhpc3RpbmcgYm9va21hcmtzLlxuICAgIHRoaXMuYWRkU3RhdGVzKG51bGwpO1xuICAgIGlmICh0ZW5zb3JJbmZvICYmIHRlbnNvckluZm8uYm9va21hcmtzUGF0aCkge1xuICAgICAgLy8gR2V0IGFueSBib29rbWFya3MgdGhhdCBtYXkgY29tZSB3aGVuIHRoZSBwcm9qZWN0b3Igc3RhcnRzIHVwLlxuICAgICAgZGF0YVByb3ZpZGVyLmdldEJvb2ttYXJrcyhydW4sIHRlbnNvckluZm8udGVuc29yTmFtZSwgKGJvb2ttYXJrcykgPT4ge1xuICAgICAgICB0aGlzLmFkZFN0YXRlcyhib29rbWFya3MpO1xuICAgICAgICB0aGlzLl9leHBhbmRNb3JlKCk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fZXhwYW5kTGVzcygpO1xuICAgIH1cbiAgfVxuICAvKiogSGFuZGxlcyBhIGNsaWNrIG9uIHNob3cgYm9va21hcmtzIHRyYXkgYnV0dG9uLiAqL1xuICBfZXhwYW5kTW9yZSgpIHtcbiAgICAodGhpcy4kLnBhbmVsIGFzIGFueSkuc2hvdygpO1xuICAgIHRoaXMuZXhwYW5kTW9yZUJ1dHRvbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIHRoaXMuZXhwYW5kTGVzc0J1dHRvbi5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gIH1cbiAgLyoqIEhhbmRsZXMgYSBjbGljayBvbiBoaWRlIGJvb2ttYXJrcyB0cmF5IGJ1dHRvbi4gKi9cbiAgX2V4cGFuZExlc3MoKSB7XG4gICAgKHRoaXMuJC5wYW5lbCBhcyBhbnkpLmhpZGUoKTtcbiAgICB0aGlzLmV4cGFuZE1vcmVCdXR0b24uc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgIHRoaXMuZXhwYW5kTGVzc0J1dHRvbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICB9XG4gIC8qKiBIYW5kbGVzIGEgY2xpY2sgb24gdGhlIGFkZCBib29rbWFyayBidXR0b24uICovXG4gIF9hZGRCb29rbWFyaygpIHtcbiAgICBsZXQgY3VycmVudFN0YXRlID0gdGhpcy5wcm9qZWN0b3IuZ2V0Q3VycmVudFN0YXRlKCk7XG4gICAgY3VycmVudFN0YXRlLmxhYmVsID0gJ1N0YXRlICcgKyB0aGlzLnNhdmVkU3RhdGVzLmxlbmd0aDtcbiAgICBjdXJyZW50U3RhdGUuaXNTZWxlY3RlZCA9IHRydWU7XG4gICAgdGhpcy5zZWxlY3RlZFN0YXRlID0gdGhpcy5zYXZlZFN0YXRlcy5sZW5ndGg7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNhdmVkU3RhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLnNhdmVkU3RhdGVzW2ldLmlzU2VsZWN0ZWQgPSBmYWxzZTtcbiAgICAgIC8vIFdlIGhhdmUgdG8gY2FsbCBub3RpZnlQYXRoIHNvIHRoYXQgcG9seW1lciBrbm93cyB0aGlzIGVsZW1lbnQgd2FzXG4gICAgICAvLyB1cGRhdGVkLlxuICAgICAgdGhpcy5ub3RpZnlQYXRoKCdzYXZlZFN0YXRlcy4nICsgaSArICcuaXNTZWxlY3RlZCcsIGZhbHNlKTtcbiAgICB9XG4gICAgdGhpcy5wdXNoKCdzYXZlZFN0YXRlcycsIGN1cnJlbnRTdGF0ZSBhcyBhbnkpO1xuICAgIHRoaXMudXBkYXRlSGFzU3RhdGVzKCk7XG4gIH1cbiAgLyoqIEhhbmRsZXMgYSBjbGljayBvbiB0aGUgZG93bmxvYWQgYm9va21hcmtzIGJ1dHRvbi4gKi9cbiAgX2Rvd25sb2FkRmlsZSgpIHtcbiAgICBsZXQgc2VyaWFsaXplZFN0YXRlID0gdGhpcy5zZXJpYWxpemVBbGxTYXZlZFN0YXRlcygpO1xuICAgIGxldCBibG9iID0gbmV3IEJsb2IoW3NlcmlhbGl6ZWRTdGF0ZV0sIHt0eXBlOiAndGV4dC9wbGFpbid9KTtcbiAgICAvLyBUT0RPKGIvMTYyNzg4NDQzKTogVW5kbyBjb25mb3JtYW5jZSB3b3JrYXJvdW5kLlxuICAgIGxldCB0ZXh0RmlsZSA9IHdpbmRvdy5VUkxbJ2NyZWF0ZU9iamVjdFVSTCddKGJsb2IpO1xuICAgIC8vIEZvcmNlIGEgZG93bmxvYWQuXG4gICAgbGV0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTtcbiAgICBhLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgLy8gVE9ETyhiLzE2Mjc4ODQ0Myk6IFVuZG8gY29uZm9ybWFuY2Ugd29ya2Fyb3VuZC5cbiAgICBPYmplY3QuYXNzaWduKGEsIHtocmVmOiB0ZXh0RmlsZX0pO1xuICAgIChhIGFzIGFueSkuZG93bmxvYWQgPSAnc3RhdGUnO1xuICAgIGEuY2xpY2soKTtcbiAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGEpO1xuICAgIHdpbmRvdy5VUkwucmV2b2tlT2JqZWN0VVJMKHRleHRGaWxlKTtcbiAgfVxuICAvKiogSGFuZGxlcyBhIGNsaWNrIG9uIHRoZSB1cGxvYWQgYm9va21hcmtzIGJ1dHRvbi4gKi9cbiAgX3VwbG9hZEZpbGUoKSB7XG4gICAgbGV0IGZpbGVJbnB1dCA9IHRoaXMuJCQoJyNzdGF0ZS1maWxlJyk7XG4gICAgKGZpbGVJbnB1dCBhcyBIVE1MSW5wdXRFbGVtZW50KS5jbGljaygpO1xuICB9XG4gIHByaXZhdGUgc2V0dXBVcGxvYWRCdXR0b24oKSB7XG4gICAgLy8gU2hvdyBhbmQgc2V0dXAgdGhlIGxvYWQgdmlldyBidXR0b24uXG4gICAgY29uc3QgZmlsZUlucHV0ID0gdGhpcy4kJCgnI3N0YXRlLWZpbGUnKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xuICAgIGZpbGVJbnB1dC5vbmNoYW5nZSA9ICgpID0+IHtcbiAgICAgIGNvbnN0IGZpbGU6IEZpbGUgPSBmaWxlSW5wdXQuZmlsZXNbMF07XG4gICAgICAvLyBDbGVhciBvdXQgdGhlIHZhbHVlIG9mIHRoZSBmaWxlIGNob29zZXIuIFRoaXMgZW5zdXJlcyB0aGF0IGlmIHRoZSB1c2VyXG4gICAgICAvLyBzZWxlY3RzIHRoZSBzYW1lIGZpbGUsIHdlJ2xsIHJlLXJlYWQgaXQuXG4gICAgICBmaWxlSW5wdXQudmFsdWUgPSAnJztcbiAgICAgIGNvbnN0IGZpbGVSZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgZmlsZVJlYWRlci5vbmxvYWQgPSAoZXZ0KSA9PiB7XG4gICAgICAgIGNvbnN0IHN0cjogc3RyaW5nID0gZmlsZVJlYWRlci5yZXN1bHQgYXMgc3RyaW5nO1xuICAgICAgICBjb25zdCBzYXZlZFN0YXRlcyA9IEpTT04ucGFyc2Uoc3RyKTtcbiAgICAgICAgLy8gVmVyaWZ5IHRoZSBib29rbWFya3MgbWF0Y2guXG4gICAgICAgIGlmICh0aGlzLnNhdmVkU3RhdGVzVmFsaWQoc2F2ZWRTdGF0ZXMpKSB7XG4gICAgICAgICAgdGhpcy5hZGRTdGF0ZXMoc2F2ZWRTdGF0ZXMpO1xuICAgICAgICAgIHRoaXMubG9hZFNhdmVkU3RhdGUoMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbG9nZ2luZy5zZXRXYXJuaW5nTWVzc2FnZShcbiAgICAgICAgICAgIGBVbmFibGUgdG8gbG9hZCBib29rbWFya3M6IHdyb25nIGRhdGFzZXQsIGV4cGVjdGVkIGRhdGFzZXQgYCArXG4gICAgICAgICAgICAgIGB3aXRoIHNoYXBlICgke3NhdmVkU3RhdGVzWzBdLmRhdGFTZXREaW1lbnNpb25zfSkuYFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBmaWxlUmVhZGVyLnJlYWRBc1RleHQoZmlsZSk7XG4gICAgfTtcbiAgfVxuICBhZGRTdGF0ZXMoc2F2ZWRTdGF0ZXM/OiBTdGF0ZVtdKSB7XG4gICAgaWYgKHNhdmVkU3RhdGVzID09IG51bGwpIHtcbiAgICAgIHRoaXMuc2F2ZWRTdGF0ZXMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzYXZlZFN0YXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBzYXZlZFN0YXRlc1tpXS5pc1NlbGVjdGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMucHVzaCgnc2F2ZWRTdGF0ZXMnLCBzYXZlZFN0YXRlc1tpXSBhcyBhbnkpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnVwZGF0ZUhhc1N0YXRlcygpO1xuICB9XG4gIC8qKiBEZXNlbGVjdHMgYW55IHNlbGVjdGVkIHN0YXRlIHNlbGVjdGlvbi4gKi9cbiAgY2xlYXJTdGF0ZVNlbGVjdGlvbigpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuc2F2ZWRTdGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMuc2V0U2VsZWN0aW9uU3RhdGUoaSwgZmFsc2UpO1xuICAgIH1cbiAgfVxuICAvKiogSGFuZGxlcyBhIHJhZGlvIGJ1dHRvbiBjbGljayBvbiBhIHNhdmVkIHN0YXRlLiAqL1xuICBfcmFkaW9CdXR0b25IYW5kbGVyKGV2dDogRXZlbnQpIHtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMuZ2V0UGFyZW50RGF0YUluZGV4KGV2dCk7XG4gICAgdGhpcy5sb2FkU2F2ZWRTdGF0ZShpbmRleCk7XG4gICAgdGhpcy5zZXRTZWxlY3Rpb25TdGF0ZShpbmRleCwgdHJ1ZSk7XG4gIH1cbiAgbG9hZFNhdmVkU3RhdGUoaW5kZXg6IG51bWJlcikge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zYXZlZFN0YXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHRoaXMuc2F2ZWRTdGF0ZXNbaV0uaXNTZWxlY3RlZCkge1xuICAgICAgICB0aGlzLnNldFNlbGVjdGlvblN0YXRlKGksIGZhbHNlKTtcbiAgICAgIH0gZWxzZSBpZiAoaW5kZXggPT09IGkpIHtcbiAgICAgICAgdGhpcy5zZXRTZWxlY3Rpb25TdGF0ZShpLCB0cnVlKTtcbiAgICAgICAgdGhpcy5pZ25vcmVOZXh0UHJvamVjdGlvbkV2ZW50ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5wcm9qZWN0b3IubG9hZFN0YXRlKHRoaXMuc2F2ZWRTdGF0ZXNbaV0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBwcml2YXRlIHNldFNlbGVjdGlvblN0YXRlKHN0YXRlSW5kZXg6IG51bWJlciwgc2VsZWN0ZWQ6IGJvb2xlYW4pIHtcbiAgICB0aGlzLnNhdmVkU3RhdGVzW3N0YXRlSW5kZXhdLmlzU2VsZWN0ZWQgPSBzZWxlY3RlZDtcbiAgICBjb25zdCBwYXRoID0gJ3NhdmVkU3RhdGVzLicgKyBzdGF0ZUluZGV4ICsgJy5pc1NlbGVjdGVkJztcbiAgICB0aGlzLm5vdGlmeVBhdGgocGF0aCwgc2VsZWN0ZWQpO1xuICB9XG4gIC8qKlxuICAgKiBDcmF3bHMgdXAgdGhlIERPTSB0byBmaW5kIGFuIGFuY2VzdG9yIHdpdGggYSBkYXRhLWluZGV4IGF0dHJpYnV0ZS4gVGhpcyBpc1xuICAgKiB1c2VkIHRvIG1hdGNoIGV2ZW50cyB0byB0aGVpciBib29rbWFyayBpbmRleC5cbiAgICovXG4gIHByaXZhdGUgZ2V0UGFyZW50RGF0YUluZGV4KGV2dDogRXZlbnQpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IChldnQgYXMgYW55KS5wYXRoLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgZWxlbSA9IChldnQgYXMgYW55KS5wYXRoW2ldO1xuICAgICAgaWYgKGVsZW0gaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgICAgICBsZXQgZGF0YUluZGV4ID0gZWxlbS5nZXRBdHRyaWJ1dGUoJ2RhdGEtaW5kZXgnKTtcbiAgICAgICAgaWYgKGRhdGFJbmRleCAhPSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuICtkYXRhSW5kZXg7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9XG4gIC8qKiBIYW5kbGVzIGEgY2xlYXIgYnV0dG9uIGNsaWNrIG9uIGEgYm9va21hcmsuICovXG4gIF9jbGVhckJ1dHRvbkhhbmRsZXIoZXZ0OiBFdmVudCkge1xuICAgIGxldCBpbmRleCA9IHRoaXMuZ2V0UGFyZW50RGF0YUluZGV4KGV2dCk7XG4gICAgdGhpcy5zcGxpY2UoJ3NhdmVkU3RhdGVzJywgaW5kZXgsIDEpO1xuICAgIHRoaXMudXBkYXRlSGFzU3RhdGVzKCk7XG4gIH1cbiAgLyoqIEhhbmRsZXMgYSBsYWJlbCBjaGFuZ2UgZXZlbnQgb24gYSBib29rbWFyay4gKi9cbiAgX2xhYmVsQ2hhbmdlKGV2dDogRXZlbnQpIHtcbiAgICBsZXQgaW5kZXggPSB0aGlzLmdldFBhcmVudERhdGFJbmRleChldnQpO1xuICAgIHRoaXMuc2F2ZWRTdGF0ZXNbaW5kZXhdLmxhYmVsID0gKGV2dC50YXJnZXQgYXMgYW55KS52YWx1ZTtcbiAgfVxuICAvKipcbiAgICogVXNlZCB0byBkZXRlcm1pbmUgd2hldGhlciB0byBzZWxlY3QgdGhlIHJhZGlvIGJ1dHRvbiBmb3IgYSBnaXZlbiBib29rbWFyay5cbiAgICovXG4gIF9pc1NlbGVjdGVkU3RhdGUoaW5kZXg6IG51bWJlcikge1xuICAgIHJldHVybiBpbmRleCA9PT0gdGhpcy5zZWxlY3RlZFN0YXRlO1xuICB9XG4gIF9pc05vdFNlbGVjdGVkU3RhdGUoaW5kZXg6IG51bWJlcikge1xuICAgIHJldHVybiBpbmRleCAhPT0gdGhpcy5zZWxlY3RlZFN0YXRlO1xuICB9XG4gIC8qKlxuICAgKiBHZXRzIGFsbCBvZiB0aGUgc2F2ZWQgc3RhdGVzIGFzIGEgc2VyaWFsaXplZCBzdHJpbmcuXG4gICAqL1xuICBzZXJpYWxpemVBbGxTYXZlZFN0YXRlcygpOiBzdHJpbmcge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzLnNhdmVkU3RhdGVzKTtcbiAgfVxuICAvKipcbiAgICogTG9hZHMgYWxsIG9mIHRoZSBzZXJpYWxpemVkIHN0YXRlcyBhbmQgc2hvd3MgdGhlbSBpbiB0aGUgbGlzdCBvZlxuICAgKiB2aWV3YWJsZSBzdGF0ZXMuXG4gICAqL1xuICBsb2FkU2F2ZWRTdGF0ZXMoc2VyaWFsaXplZFN0YXRlczogc3RyaW5nKSB7XG4gICAgdGhpcy5zYXZlZFN0YXRlcyA9IEpTT04ucGFyc2Uoc2VyaWFsaXplZFN0YXRlcyk7XG4gICAgdGhpcy51cGRhdGVIYXNTdGF0ZXMoKTtcbiAgfVxuICAvKipcbiAgICogVXBkYXRlcyB0aGUgaGFzU3RhdGUgcG9seW1lciBwcm9wZXJ0eS5cbiAgICovXG4gIHByaXZhdGUgdXBkYXRlSGFzU3RhdGVzKCkge1xuICAgIHRoaXMuaGFzU3RhdGVzID0gdGhpcy5zYXZlZFN0YXRlcy5sZW5ndGggIT09IDA7XG4gIH1cbiAgLyoqIFNhbml0eSBjaGVja3MgYSBTdGF0ZSBhcnJheSB0byBlbnN1cmUgaXQgbWF0Y2hlcyB0aGUgY3VycmVudCBkYXRhc2V0LiAqL1xuICBwcml2YXRlIHNhdmVkU3RhdGVzVmFsaWQoc3RhdGVzOiBTdGF0ZVtdKTogYm9vbGVhbiB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChcbiAgICAgICAgc3RhdGVzW2ldLmRhdGFTZXREaW1lbnNpb25zWzBdICE9PSB0aGlzLnByb2plY3Rvci5kYXRhU2V0LmRpbVswXSB8fFxuICAgICAgICBzdGF0ZXNbaV0uZGF0YVNldERpbWVuc2lvbnNbMV0gIT09IHRoaXMucHJvamVjdG9yLmRhdGFTZXQuZGltWzFdXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuIl19