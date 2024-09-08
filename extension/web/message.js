const canConnectToVsCode = (window.acquireVsCodeApi !== undefined);
if (canConnectToVsCode) {
  window.vscode = acquireVsCodeApi();
}

// Currently we don't specify the target view sent to
// Because we treat each command as a globally unique command
// representing a specific event in the extension
// TODO is it ok to put data as direct attributes in the message or wrap them in "data" attribute
function sendMessage(msg) {
  if (canConnectToVsCode) {
    window.vscode.postMessage(msg);
  } else {
    parent.postMessage(msg, '*');
  }
}

// window.addEventListener('message', msg => {
//   console.log('A message is received and to be processed with vue', msg);
// });

const validCommands = [
  'update', 'filterByIndex', 'indexSearchHandler',
  'clearSearchHandler', 'deleteItemfromSel', 'openModal', 'setShowModalFalse', 'saveChanges'
];
const keyKeys = ['command', 'args'];
const nonSyncKeys = [
  'pointsMesh', 'renderer', 'originalSettings',
  'scene', 'camera', 'predictionFlipIndices',
  'label_name_dict', 'label_list', 'prediction_list', 'confidence_list'
];
const nonSyncKeyPrefixes = [
  'train_index', 'test_index'
];


function getPackedData(obj) {
  const data = {};
  for (const key in obj) {
    if (!(nonSyncKeys.includes(key) || nonSyncKeyPrefixes.some(prefix => key.startsWith(prefix)))) {
      data[key] = obj[key];
    }
  }
  return data;
}

function syncData(data) {
  sendMessage({
      command: 'sync',
      ...(getPackedData(data))
  });
}

function getKeysData(obj, keys) {
    const data = {};
    for (const key of keys) {
        if (key in obj) {
            data[key] = obj[key];
        }
    }
    return data;
}

window.addEventListener('message', msg => {
    const data = msg.data;
    if (!data) {
        return;
    }
    if (validCommands.includes(data.command) || data.command === 'sync') {
        for (const key in data) {
            if (!(keyKeys.includes(key))) {
                window.vueApp[key] = data[key];
            }
        }
        if (data.command === 'sync') {
            window.vueApp.$forceUpdate();
            return;
        }
        if (data.args) {
            window.vueApp[data.command](...data.args);
        } else {
            window.vueApp[data.command]();
        }
    } else if (data.command == 'updateCssVariable') {
      for (const key in data.cssVars) {
        document.documentElement.style.setProperty(key, data.cssVars[key]);
      }
    }
});

