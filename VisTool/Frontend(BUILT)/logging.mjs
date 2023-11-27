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
const WARNING_DURATION_MS = 10000;
let dom = null;
let msgId = 0;
let numActiveMessages = 0;
export function setDomContainer(domElement) {
    dom = domElement;
}
/**
 * Updates the user message with the provided id.
 *
 * @param msg The message shown to the user. If null, the message is removed.
 * @param id The id of an existing message. If no id is provided, a unique id
 *     is assigned.
 * @param title The title of the notification.
 * @param isErrorMsg If true, the message is error and the dialog will have a
 *                   close button.
 * @return The id of the message.
 */
export function setModalMessage(msg, id = null, title = null, isErrorMsg = false) {
    if (dom == null) {
        console.warn("Can't show modal message before the dom is initialized");
        return;
    }
    if (id == null) {
        id = (msgId++).toString();
    }
    let dialog = dom.shadowRoot.querySelector('#notification-dialog');
    dialog.querySelector('.close-button').style.display = isErrorMsg
        ? null
        : 'none';
    let spinner = dialog.querySelector('.progress');
    spinner.style.display = isErrorMsg ? 'none' : null;
    spinner.active = isErrorMsg ? null : true;
    dialog.querySelector('#notification-title').textContent = title;
    let msgsContainer = dialog.querySelector('#notify-msgs');
    if (isErrorMsg) {
        msgsContainer.textContent = '';
    }
    else {
        const errors = msgsContainer.querySelectorAll('.error');
        for (let i = 0; i < errors.length; i++) {
            msgsContainer.removeChild(errors[i]);
        }
    }
    let divId = `notify-msg-${id}`;
    let msgDiv = dialog.querySelector('#' + divId);
    if (msgDiv == null) {
        msgDiv = document.createElement('div');
        msgDiv.className = 'notify-msg ' + (isErrorMsg ? 'error' : '');
        msgDiv.id = divId;
        msgsContainer.insertBefore(msgDiv, msgsContainer.firstChild);
        if (!isErrorMsg) {
            numActiveMessages++;
        }
        else {
            numActiveMessages = 0;
        }
    }
    if (msg == null) {
        numActiveMessages--;
        if (numActiveMessages === 0) {
            dialog.close();
        }
        msgDiv.remove();
    }
    else {
        msgDiv.innerText = msg;
        dialog.open();
    }
    return id;
}
export function setErrorMessage(errMsg, task) {
    setModalMessage(errMsg, null, 'Error ' + (task != null ? task : ''), true);
}
export function setWarnMessage(Msg, task) {
    setModalMessage(Msg, null, (task != null ? task : ''), true);
}
/**
 * Shows a warning message to the user for a certain amount of time.
 */
export function setWarningMessage(msg) {
    let toast = dom.shadowRoot.querySelector('#toast');
    toast.text = msg;
    toast.duration = WARNING_DURATION_MS;
    toast.open();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nZ2luZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3RlbnNvcmJvYXJkL3Byb2plY3Rvci9sb2dnaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7O2dGQWFnRjtBQUNoRixNQUFNLG1CQUFtQixHQUFHLEtBQUssQ0FBQztBQUNsQyxJQUFJLEdBQUcsR0FBZ0IsSUFBSSxDQUFDO0FBQzVCLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztBQUNkLElBQUksaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO0FBQzFCLE1BQU0sVUFBVSxlQUFlLENBQUMsVUFBdUI7SUFDckQsR0FBRyxHQUFHLFVBQVUsQ0FBQztBQUNuQixDQUFDO0FBQ0Q7Ozs7Ozs7Ozs7R0FVRztBQUNILE1BQU0sVUFBVSxlQUFlLENBQzdCLEdBQVcsRUFDWCxLQUFhLElBQUksRUFDakIsS0FBSyxHQUFHLElBQUksRUFDWixVQUFVLEdBQUcsS0FBSztJQUVsQixJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUU7UUFDZixPQUFPLENBQUMsSUFBSSxDQUFDLHdEQUF3RCxDQUFDLENBQUM7UUFDdkUsT0FBTztLQUNSO0lBQ0QsSUFBSSxFQUFFLElBQUksSUFBSSxFQUFFO1FBQ2QsRUFBRSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztLQUMzQjtJQUNELElBQUksTUFBTSxHQUFHLEdBQUcsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLHNCQUFzQixDQUFRLENBQUM7SUFDekUsTUFBTSxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLFVBQVU7UUFDOUQsQ0FBQyxDQUFDLElBQUk7UUFDTixDQUFDLENBQUMsTUFBTSxDQUFDO0lBQ1gsSUFBSSxPQUFPLEdBQUcsTUFBTSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUNoRCxPQUFPLENBQUMsS0FBSyxDQUFD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QW1CLENBQUM7SUFDckMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ2YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qIENvcHlyaWdodCAyMDE2IFRoZSBUZW5zb3JGbG93IEF1dGhvcnMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cbmNvbnN0IFdBUk5JTkdfRFVSQVRJT05fTVMgPSAxMDAwMDtcbmxldCBkb206IEhUTUxFbGVtZW50ID0gbnVsbDtcbmxldCBtc2dJZCA9IDA7XG5sZXQgbnVtQWN0aXZlTWVzc2FnZXMgPSAwO1xuZXhwb3J0IGZ1bmN0aW9uIHNldERvbUNvbnRhaW5lcihkb21FbGVtZW50OiBIVE1MRWxlbWVudCkge1xuICBkb20gPSBkb21FbGVtZW50O1xufVxuLyoqXG4gKiBVcGRhdGVzIHRoZSB1c2VyIG1lc3NhZ2Ugd2l0aCB0aGUgcHJvdmlkZWQgaWQuXG4gKlxuICogQHBhcmFtIG1zZyBUaGUgbWVzc2FnZSBzaG93biB0byB0aGUgdXNlci4gSWYgbnVsbCwgdGhlIG1lc3NhZ2UgaXMgcmVtb3ZlZC5cbiAqIEBwYXJhbSBpZCBUaGUgaWQgb2YgYW4gZXhpc3RpbmcgbWVzc2FnZS4gSWYgbm8gaWQgaXMgcHJvdmlkZWQsIGEgdW5pcXVlIGlkXG4gKiAgICAgaXMgYXNzaWduZWQuXG4gKiBAcGFyYW0gdGl0bGUgVGhlIHRpdGxlIG9mIHRoZSBub3RpZmljYXRpb24uXG4gKiBAcGFyYW0gaXNFcnJvck1zZyBJZiB0cnVlLCB0aGUgbWVzc2FnZSBpcyBlcnJvciBhbmQgdGhlIGRpYWxvZyB3aWxsIGhhdmUgYVxuICogICAgICAgICAgICAgICAgICAgY2xvc2UgYnV0dG9uLlxuICogQHJldHVybiBUaGUgaWQgb2YgdGhlIG1lc3NhZ2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXRNb2RhbE1lc3NhZ2UoXG4gIG1zZzogc3RyaW5nLFxuICBpZDogc3RyaW5nID0gbnVsbCxcbiAgdGl0bGUgPSBudWxsLFxuICBpc0Vycm9yTXNnID0gZmFsc2Vcbik6IHN0cmluZyB7XG4gIGlmIChkb20gPT0gbnVsbCkge1xuICAgIGNvbnNvbGUud2FybihcIkNhbid0IHNob3cgbW9kYWwgbWVzc2FnZSBiZWZvcmUgdGhlIGRvbSBpcyBpbml0aWFsaXplZFwiKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGlkID09IG51bGwpIHtcbiAgICBpZCA9IChtc2dJZCsrKS50b1N0cmluZygpO1xuICB9XG4gIGxldCBkaWFsb2cgPSBkb20uc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCcjbm90aWZpY2F0aW9uLWRpYWxvZycpIGFzIGFueTtcbiAgZGlhbG9nLnF1ZXJ5U2VsZWN0b3IoJy5jbG9zZS1idXR0b24nKS5zdHlsZS5kaXNwbGF5ID0gaXNFcnJvck1zZ1xuICAgID8gbnVsbFxuICAgIDogJ25vbmUnO1xuICBsZXQgc3Bpbm5lciA9IGRpYWxvZy5xdWVyeVNlbGVjdG9yKCcucHJvZ3Jlc3MnKTtcbiAgc3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gaXNFcnJvck1zZyA/ICdub25lJyA6IG51bGw7XG4gIHNwaW5uZXIuYWN0aXZlID0gaXNFcnJvck1zZyA/IG51bGwgOiB0cnVlO1xuICBkaWFsb2cucXVlcnlTZWxlY3RvcignI25vdGlmaWNhdGlvbi10aXRsZScpLnRleHRDb250ZW50ID0gdGl0bGU7XG4gIGxldCBtc2dzQ29udGFpbmVyID0gZGlhbG9nLnF1ZXJ5U2VsZWN0b3IoJyNub3RpZnktbXNncycpIGFzIEhUTUxFbGVtZW50O1xuICBpZiAoaXNFcnJvck1zZykge1xuICAgIG1zZ3NDb250YWluZXIudGV4dENvbnRlbnQgPSAnJztcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBlcnJvcnMgPSBtc2dzQ29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5lcnJvcicpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXJyb3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBtc2dzQ29udGFpbmVyLnJlbW92ZUNoaWxkKGVycm9yc1tpXSk7XG4gICAgfVxuICB9XG4gIGxldCBkaXZJZCA9IGBub3RpZnktbXNnLSR7aWR9YDtcbiAgbGV0IG1zZ0RpdiA9IGRpYWxvZy5xdWVyeVNlbGVjdG9yKCcjJyArIGRpdklkKSBhcyBIVE1MRGl2RWxlbWVudDtcbiAgaWYgKG1zZ0RpdiA9PSBudWxsKSB7XG4gICAgbXNnRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgbXNnRGl2LmNsYXNzTmFtZSA9ICdub3RpZnktbXNnICcgKyAoaXNFcnJvck1zZyA/ICdlcnJvcicgOiAnJyk7XG4gICAgbXNnRGl2LmlkID0gZGl2SWQ7XG4gICAgbXNnc0NvbnRhaW5lci5pbnNlcnRCZWZvcmUobXNnRGl2LCBtc2dzQ29udGFpbmVyLmZpcnN0Q2hpbGQpO1xuICAgIGlmICghaXNFcnJvck1zZykge1xuICAgICAgbnVtQWN0aXZlTWVzc2FnZXMrKztcbiAgICB9IGVsc2Uge1xuICAgICAgbnVtQWN0aXZlTWVzc2FnZXMgPSAwO1xuICAgIH1cbiAgfVxuICBpZiAobXNnID09IG51bGwpIHtcbiAgICBudW1BY3RpdmVNZXNzYWdlcy0tO1xuICAgIGlmIChudW1BY3RpdmVNZXNzYWdlcyA9PT0gMCkge1xuICAgICAgZGlhbG9nLmNsb3NlKCk7XG4gICAgfVxuICAgIG1zZ0Rpdi5yZW1vdmUoKTtcbiAgfSBlbHNlIHtcbiAgICBtc2dEaXYuaW5uZXJUZXh0ID0gbXNnO1xuICAgIGRpYWxvZy5vcGVuKCk7XG4gIH1cbiAgcmV0dXJuIGlkO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHNldEVycm9yTWVzc2FnZShlcnJNc2c6IHN0cmluZywgdGFzaz86IHN0cmluZykge1xuICBzZXRNb2RhbE1lc3NhZ2UoZXJyTXNnLCBudWxsLCAnRXJyb3IgJyArICh0YXNrICE9IG51bGwgPyB0YXNrIDogJycpLCB0cnVlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFdhcm5NZXNzYWdlKE1zZzogc3RyaW5nLCB0YXNrPzogc3RyaW5nKSB7XG4gIHNldE1vZGFsTWVzc2FnZShNc2csIG51bGwsICh0YXNrICE9IG51bGwgPyB0YXNrIDogJycpLCB0cnVlKTtcbn1cbi8qKlxuICogU2hvd3MgYSB3YXJuaW5nIG1lc3NhZ2UgdG8gdGhlIHVzZXIgZm9yIGEgY2VydGFpbiBhbW91bnQgb2YgdGltZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldFdhcm5pbmdNZXNzYWdlKG1zZzogc3RyaW5nKTogdm9pZCB7XG4gIGxldCB0b2FzdCA9IGRvbS5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJyN0b2FzdCcpIGFzIGFueTtcbiAgdG9hc3QudGV4dCA9IG1zZztcbiAgdG9hc3QuZHVyYXRpb24gPSBXQVJOSU5HX0RVUkFUSU9OX01TO1xuICB0b2FzdC5vcGVuKCk7XG59XG4iXX0=