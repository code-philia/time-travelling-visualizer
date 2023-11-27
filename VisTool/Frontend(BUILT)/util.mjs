import { __awaiter } from "tslib";
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
import * as THREE from 'three';
import * as tf from '../webapp/third_party/tfjs';
import * as searchQuery from 'search-query-parser';
import * as logging from './logging';
const TASK_DELAY_MS = 200;
/** Shuffles the array in-place in O(n) time using Fisher-Yates algorithm. */
export function shuffle(array) {
    let m = array.length;
    let t;
    let i;
    // While there remain elements to shuffle.
    while (m) {
        // Pick a remaining element
        i = Math.floor(Math.random() * m--);
        // And swap it with the current element.
        t = array[m];
        array[m] = array[i];
        array[i] = t;
    }
    return array;
}
export function range(count) {
    const rangeOutput = [];
    for (let i = 0; i < count; i++) {
        rangeOutput.push(i);
    }
    return rangeOutput;
}
export function classed(element, className, enabled) {
    const classNames = element.className.split(' ');
    if (enabled) {
        if (className in classNames) {
            return;
        }
        else {
            classNames.push(className);
        }
    }
    else {
        const index = classNames.indexOf(className);
        if (index === -1) {
            return;
        }
        classNames.splice(index, 1);
    }
    element.className = classNames.join(' ');
}
/** Projects a 3d point into screen space */
export function vector3DToScreenCoords(cam, w, h, v) {
    let dpr = window.devicePixelRatio;
    let pv = new THREE.Vector3().copy(v).project(cam);
    // The screen-space origin is at the middle of the screen, with +y up.
    let coords = [
        ((pv.x + 1) / 2) * w * dpr,
        -(((pv.y - 1) / 2) * h) * dpr,
    ];
    return coords;
}
/** Loads 3 contiguous elements from a packed xyz array into a Vector3. */
export function vector3FromPackedArray(a, pointIndex) {
    const offset = pointIndex * 3;
    return new THREE.Vector3(a[offset], a[offset + 1], a[offset + 2]);
}
/**
 * Gets the camera-space z coordinates of the nearest and farthest points.
 * Ignores points that are behind the camera.
 */
export function getNearFarPoints(worldSpacePoints, cameraPos, cameraTarget) {
    let shortestDist = Infinity;
    let furthestDist = 0;
    const camToTarget = new THREE.Vector3().copy(cameraTarget).sub(cameraPos);
    const camPlaneNormal = new THREE.Vector3().copy(camToTarget).normalize();
    const n = worldSpacePoints.length / 3;
    let src = 0;
    let p = new THREE.Vector3();
    let camToPoint = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
        p.x = worldSpacePoints[src];
        p.y = worldSpacePoints[src + 1];
        p.z = worldSpacePoints[src + 2];
        src += 3;
        camToPoint.copy(p).sub(cameraPos);
        const dist = camPlaneNormal.dot(camToPoint);
        if (dist < 0) {
            continue;
        }
        furthestDist = dist > furthestDist ? dist : furthestDist;
        shortestDist = dist < shortestDist ? dist : shortestDist;
    }
    return [shortestDist, furthestDist];
}
/**
 * Generate a texture for the points/images and sets some initial params
 */
export function createTexture(image) {
    let tex = new THREE.Texture(image);
    tex.needsUpdate = true;
    // Used if the texture isn't a power of 2.
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.flipY = false;
    return tex;
}
/**
 * Assert that the condition is satisfied; if not, log user-specified message
 * to the console.
 */
export function assert(condition, message) {
    if (!condition) {
        message = message || 'Assertion failed';
        throw new Error(message);
    }
}
export function getSearchPredicate(query, inRegexMode, fieldName) {
    let predicate;
    if (inRegexMode) {
        let regExp = new RegExp(query, 'i');
        predicate = (p) => regExp.test(p.metadata[fieldName].toString());
    }
    else {
        // Doing a case insensitive substring match.
        query = query.toLowerCase();
        const active_learning_query = 'active_learning';
        const options = { keywords: ['label', 'prediction', 'is_training', 'is_correct_prediction', 'new_selection',
                active_learning_query, 'is_noisy', 'noisy_type', 'original_or_flipped'] };
        const searchQueryObj = searchQuery.parse(query, options);
        const valid_new_selection = (searchQueryObj["new_selection"] != null && !Array.isArray(searchQueryObj["new_selection"]) &&
            (searchQueryObj["new_selection"] == "true" || searchQueryObj["new_selection"] == "false"));
        const valid_active_learning = (searchQueryObj[active_learning_query] != null && !Array.isArray(searchQueryObj[active_learning_query]) &&
            (searchQueryObj[active_learning_query] == "true"));
        const valid_noisy = (searchQueryObj["is_noisy"] != null && !Array.isArray(searchQueryObj["is_noisy"]) &&
            (searchQueryObj["is_noisy"] == "true" || searchQueryObj["is_noisy"] == "false"));
        const valid_original = (searchQueryObj["noisy_type"] != null && !Array.isArray(searchQueryObj["noisy_type"]) &&
            (searchQueryObj["noisy_type"] == "original" || searchQueryObj["noisy_type"] == "flipped" ||
                searchQueryObj["noisy_type"] == "others"));
        const valid_original_or_flipped = (searchQueryObj["original_or_flipped"] != null && !Array.isArray(searchQueryObj["original_or_flipped"]) &&
            (searchQueryObj["original_or_flipped"] == "true"));
        const valid_uncertainty_ranking = (searchQueryObj["uncertainty_ranking"] != null && !Array.isArray(searchQueryObj["uncertainty_ranking"]) &&
            !isNaN(+searchQueryObj["uncertainty_ranking"]));
        const valid_uncertainty_exceed = (searchQueryObj["uncertainty_exceed"] != null && !Array.isArray(searchQueryObj["uncertainty_exceed"]) &&
            !isNaN(+searchQueryObj["uncertainty_exceed"]));
        const valid_diversity_ranking = (searchQueryObj["diversity_ranking"] != null && !Array.isArray(searchQueryObj["diversity_ranking"]) &&
            !isNaN(+searchQueryObj["diversity_ranking"]));
        const valid_diversity_exceed = (searchQueryObj["diversity_exceed"] != null && !Array.isArray(searchQueryObj["diversity_exceed"]) &&
            !isNaN(+searchQueryObj["diversity_exceed"]));
        const valid_tot_ranking = (searchQueryObj["tot_ranking"] != null && !Array.isArray(searchQueryObj["tot_ranking"]) &&
            !isNaN(+searchQueryObj["tot_ranking"]));
        const valid_tot_exceed = (searchQueryObj["tot_exceed"] != null && !Array.isArray(searchQueryObj["tot_exceed"]) &&
            !isNaN(+searchQueryObj["tot_exceed"]));
        predicate = (p) => {
            if (searchQueryObj["label"] == null && searchQueryObj["prediction"] == null &&
                !valid_new_selection && !valid_active_learning && !valid_noisy && !valid_original && !valid_original_or_flipped &&
                !valid_uncertainty_ranking && !valid_diversity_ranking && !valid_tot_ranking && !valid_uncertainty_exceed
                && !valid_diversity_exceed && !valid_tot_exceed &&
                (searchQueryObj["is_training"] == null || Array.isArray(searchQueryObj["is_training"]) ||
                    ((searchQueryObj["is_training"] != "true" && searchQueryObj["is_training"] != "false")))
                && (searchQueryObj["is_correct_prediction"] == null || Array.isArray(searchQueryObj["is_correct_prediction"]) ||
                    ((searchQueryObj["is_correct_prediction"] != "true" && searchQueryObj["is_correct_prediction"] != "false")))) {
                return false;
            }
            if (searchQueryObj["label"] != null) {
                let queryLabels = searchQueryObj["label"];
                let labelResult = false;
                const label = p.metadata["label"].toString().toLowerCase();
                if (!Array.isArray(queryLabels)) {
                    queryLabels = [queryLabels];
                }
                for (let i = 0; i < queryLabels.length; i++) {
                    const queryLabel = queryLabels[i];
                    labelResult = labelResult || label == queryLabel;
                    if (labelResult) {
                        break;
                    }
                }
                if (!labelResult) {
                    return false;
                }
            }
            if (searchQueryObj["prediction"] != null) {
                let queryPredictions = searchQueryObj["prediction"];
                let predictionResult = false;
                const prediction = p.current_prediction;
                if (!Array.isArray(queryPredictions)) {
                    queryPredictions = [queryPredictions];
                }
                for (let i = 0; i < queryPredictions.length; i++) {
                    const queryPrediction = queryPredictions[i];
                    predictionResult = predictionResult || prediction == queryPrediction;
                    if (predictionResult) {
                        break;
                    }
                }
                if (!predictionResult) {
                    return false;
                }
            }
            if (valid_new_selection) {
                let queryNewSelection = searchQueryObj["new_selection"];
                let newSelectionResult = false;
                if (queryNewSelection == "true" && p.current_new_selection) {
                    newSelectionResult = true;
                }
                if (queryNewSelection == "false" && p.current_new_selection == false) {
                    newSelectionResult = true;
                }
                if (!newSelectionResult) {
                    return false;
                }
            }
            if (valid_noisy) {
                let queryNoisy = searchQueryObj["is_noisy"];
                let noisyResult = false;
                if (queryNoisy == "true" && p.noisy) {
                    noisyResult = true;
                }
                if (queryNoisy == "false" && p.noisy == false) {
                    noisyResult = true;
                }
                if (!noisyResult) {
                    return false;
                }
            }
            if (valid_active_learning) {
                let newActiveLearningResult = false;
                if (p.current_new_selection || p.current_training) {
                    newActiveLearningResult = true;
                }
                if (!newActiveLearningResult) {
                    return false;
                }
            }
            if (valid_original) {
                let queryOriginal = searchQueryObj["noisy_type"];
                let originalResult = false;
                if (queryOriginal == "original" && p.noisy && p.original_label == p.current_prediction) {
                    originalResult = true;
                }
                if (queryOriginal == "flipped" && p.noisy && p.current_prediction == p.metadata["label"].toString().toLowerCase()) {
                    originalResult = true;
                }
                if (queryOriginal == "others" && p.noisy && p.current_prediction != p.metadata["label"].toString().toLowerCase() &&
                    p.original_label != p.current_prediction) {
                    originalResult = true;
                }
                if (!originalResult) {
                    return false;
                }
            }
            if (valid_original_or_flipped) {
                let queryOriginalOrFlipped = searchQueryObj["original_or_flipped"];
                let originalOrFlipped = false;
                if (queryOriginalOrFlipped == "true" && p.noisy && (p.original_label == p.current_prediction ||
                    p.current_prediction == p.metadata["label"].toString().toLowerCase())) {
                    originalOrFlipped = true;
                }
                if (!originalOrFlipped) {
                    return false;
                }
            }
            if (valid_uncertainty_ranking) {
                let queryRanking = +searchQuery["uncertainty_ranking"];
                if (p.current_uncertainty_ranking == undefined || p.current_uncertainty_ranking == -1 ||
                    p.current_uncertainty_ranking > queryRanking) {
                    return false;
                }
            }
            if (valid_diversity_ranking) {
                let queryRanking = +searchQuery["diversity_ranking"];
                if (p.current_diversity_ranking == undefined || p.current_diversity_ranking == -1 ||
                    p.current_diversity_ranking > queryRanking) {
                    return false;
                }
            }
            if (valid_tot_ranking) {
                let queryRanking = +searchQuery["tot_ranking"];
                if (p.current_tot_ranking == undefined || p.current_tot_ranking == -1 ||
                    p.current_tot_ranking > queryRanking) {
                    return false;
                }
            }
            if (valid_uncertainty_exceed) {
                let queryExceed = +searchQuery["uncertainty_exceed"];
                if (p.metadata["uncertainty"] == undefined || p.metadata["uncertainty"] == -1 ||
                    p.metadata["uncertainty"] < queryExceed) {
                    return false;
                }
            }
            if (valid_diversity_exceed) {
                let queryExceed = +searchQuery["diversity_exceed"];
                if (p.metadata["diversity"] == undefined || p.metadata["diversity"] == -1 ||
                    p.metadata["diversity"] < queryExceed) {
                    return false;
                }
            }
            if (valid_tot_exceed) {
                let queryExceed = +searchQuery["tot_exceed"];
                if (p.metadata["tot"] == undefined || p.metadata["tot"] == -1 ||
                    p.metadata["tot"] < queryExceed) {
                    return false;
                }
            }
            if (searchQueryObj["is_training"] != null && !Array.isArray(searchQueryObj["is_training"]) &&
                (searchQueryObj["is_training"] == "true" || searchQueryObj["is_training"] == "false")) {
                let queryTraining = searchQueryObj["is_training"];
                let trainingResult = false;
                if (queryTraining == "true" && p.current_training) {
                    trainingResult = true;
                }
                if (queryTraining == "false" && p.current_testing) {
                    trainingResult = true;
                }
                if (!trainingResult) {
                    return false;
                }
            }
            if (searchQueryObj["is_correct_prediction"] != null && !Array.isArray(searchQueryObj["is_correct_prediction"]) &&
                (searchQueryObj["is_correct_prediction"] == "true" || searchQueryObj["is_correct_prediction"] == "false")) {
                let queryCorrectPrediction = searchQueryObj["is_correct_prediction"];
                let correctPredictionResult = false;
                if (p.current_wrong_prediction == undefined) {
                    return false;
                }
                if (queryCorrectPrediction == "true" && !p.current_wrong_prediction) {
                    correctPredictionResult = true;
                }
                if (queryCorrectPrediction == "false" && p.current_wrong_prediction) {
                    correctPredictionResult = true;
                }
                if (!correctPredictionResult) {
                    return false;
                }
            }
            return true;
        };
    }
    return predicate;
}
/**
 * Runs an expensive task asynchronously with some delay
 * so that it doesn't block the UI thread immediately.
 *
 * @param message The message to display to the user.
 * @param task The expensive task to run.
 * @param msgId Optional. ID of an existing message. If provided, will overwrite
 *     an existing message and won't automatically clear the message when the
 *     task is done.
 * @return The value returned by the task.
 */
export function runAsyncTask(message, task, msgId = null, taskDelay = TASK_DELAY_MS) {
    let autoClear = msgId == null;
    msgId = logging.setModalMessage(message, msgId);
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                let result = task();
                // Clearing the old message.
                if (autoClear) {
                    logging.setModalMessage(null, msgId);
                }
                resolve(result);
            }
            catch (ex) {
                reject(ex);
            }
            return true;
        }, taskDelay);
    });
}
/**
 * Parses the URL for query parameters, e.g. ?foo=1&bar=2 will return
 *   {'foo': '1', 'bar': '2'}.
 * @param url The URL to parse.
 * @return A map of queryParam key to its value.
 */
export function getURLParams(url) {
    if (!url) {
        return {};
    }
    let queryString = url.indexOf('?') !== -1 ? url.split('?')[1] : url;
    if (queryString.indexOf('#')) {
        queryString = queryString.split('#')[0];
    }
    const queryEntries = queryString.split('&');
    let queryParams = {};
    for (let i = 0; i < queryEntries.length; i++) {
        let queryEntryComponents = queryEntries[i].split('=');
        queryParams[queryEntryComponents[0].toLowerCase()] = decodeURIComponent(queryEntryComponents[1]);
    }
    return queryParams;
}
/** List of substrings that auto generated tensors have in their name. */
const SUBSTR_GEN_TENSORS = ['/Adagrad'];
/** Returns true if the tensor was automatically generated by TF API calls. */
export function tensorIsGenerated(tensorName) {
    for (let i = 0; i < SUBSTR_GEN_TENSORS.length; i++) {
        if (tensorName.indexOf(SUBSTR_GEN_TENSORS[i]) >= 0) {
            return true;
        }
    }
    return false;
}
export function xor(cond1, cond2) {
    return (cond1 || cond2) && !(cond1 && cond2);
}
/** Checks to see if the browser supports webgl. */
export function hasWebGLSupport() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let c = document.createElement('canvas');
            let gl = c.getContext('webgl') || c.getContext('experimental-webgl');
            yield tf.ready();
            return gl != null && tf.getBackend() === 'webgl';
        }
        catch (e) {
            return false;
        }
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3RlbnNvcmJvYXJkL3Byb2plY3Rvci91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7OztnRkFhZ0Y7QUFDaEYsT0FBTyxLQUFLLEtBQUssTUFBTSxPQUFPLENBQUM7QUFDL0IsT0FBTyxLQUFLLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUNqRCxPQUFPLEtBQUssV0FBVyxNQUFNLHFCQUFxQixDQUFDO0FBSW5ELE9BQU8sS0FBSyxPQUFPLE1BQU0sV0FBVyxDQUFDO0FBRXJDLE1BQU0sYUFBYSxHQUFHLEdBQUcsQ0FBQztBQUMxQiw2RUFBNkU7QUFDN0UsTUFBTSxVQUFVLE9BQU8sQ0FBSSxLQUFVO0lBQ25DLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7SUFDckIsSUFBSSxDQUFJLENBQUM7SUFDVCxJQUFJLENBQVMsQ0FBQztJQUNkLDBDQUEwQztJQUMxQyxPQUFPLENBQUMsRUFBRTtRQUNSLDJCQUEyQjtRQUMzQixDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNwQyx3Q0FBd0M7UUFDeEMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNiLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEIsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUNkO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBQ0QsTUFBTSxVQUFVLEtBQUssQ0FBQyxLQUFhO0lBQ2pDLE1BQU0sV0FBVyxHQUFhLEVBQUUsQ0FBQztJQUNqQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFF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QUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGtCQUFrQixDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNsRCxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDbEQsT0FBTyxJQUFJLENBQUM7U0FDYjtLQUNGO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBQ0QsTUFBTSxVQUFVLEdBQUcsQ0FBQyxLQUFjLEVBQUUsS0FBYztJQUNoRCxPQUFPLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLENBQUM7QUFDL0MsQ0FBQztBQUNELG1EQUFtRDtBQUNuRCxNQUFNLFVBQWdCLGVBQWU7O1FBQ25DLElBQUk7WUFDRixJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3pDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3JFLE1BQU0sRUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2pCLE9BQU8sRUFBRSxJQUFJLElBQUksSUFBSSxFQUFFLENBQUMsVUFBVSxFQUFFLEtBQUssT0FBTyxDQUFDO1NBQ2xEO1FBQUMsT0FBTyxDQUFDLEVBQUU7WUFDVixPQUFPLEtBQUssQ0FBQztTQUNkO0lBQ0gsQ0FBQztDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLyogQ29weXJpZ2h0IDIwMTYgVGhlIFRlbnNvckZsb3cgQXV0aG9ycy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG49PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0ICogYXMgdGYgZnJvbSAnLi4vd2ViYXBwL3RoaXJkX3BhcnR5L3RmanMnO1xuaW1wb3J0ICogYXMgc2VhcmNoUXVlcnkgZnJvbSAnc2VhcmNoLXF1ZXJ5LXBhcnNlcic7XG5cbmltcG9ydCB7RGF0YVBvaW50fSBmcm9tICcuL2RhdGEnO1xuaW1wb3J0ICogYXMgdmVjdG9yIGZyb20gJy4vdmVjdG9yJztcbmltcG9ydCAqIGFzIGxvZ2dpbmcgZnJvbSAnLi9sb2dnaW5nJztcblxuY29uc3QgVEFTS19ERUxBWV9NUyA9IDIwMDtcbi8qKiBTaHVmZmxlcyB0aGUgYXJyYXkgaW4tcGxhY2UgaW4gTyhuKSB0aW1lIHVzaW5nIEZpc2hlci1ZYXRlcyBhbGdvcml0aG0uICovXG5leHBvcnQgZnVuY3Rpb24gc2h1ZmZsZTxUPihhcnJheTogVFtdKTogVFtdIHtcbiAgbGV0IG0gPSBhcnJheS5sZW5ndGg7XG4gIGxldCB0OiBUO1xuICBsZXQgaTogbnVtYmVyO1xuICAvLyBXaGlsZSB0aGVyZSByZW1haW4gZWxlbWVudHMgdG8gc2h1ZmZsZS5cbiAgd2hpbGUgKG0pIHtcbiAgICAvLyBQaWNrIGEgcmVtYWluaW5nIGVsZW1lbnRcbiAgICBpID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogbS0tKTtcbiAgICAvLyBBbmQgc3dhcCBpdCB3aXRoIHRoZSBjdXJyZW50IGVsZW1lbnQuXG4gICAgdCA9IGFycmF5W21dO1xuICAgIGFycmF5W21dID0gYXJyYXlbaV07XG4gICAgYXJyYXlbaV0gPSB0O1xuICB9XG4gIHJldHVybiBhcnJheTtcbn1cbmV4cG9ydCBmdW5jdGlvbiByYW5nZShjb3VudDogbnVtYmVyKTogbnVtYmVyW10ge1xuICBjb25zdCByYW5nZU91dHB1dDogbnVtYmVyW10gPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgcmFuZ2VPdXRwdXQucHVzaChpKTtcbiAgfVxuICByZXR1cm4gcmFuZ2VPdXRwdXQ7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xhc3NlZChcbiAgZWxlbWVudDogSFRNTEVsZW1lbnQsXG4gIGNsYXNzTmFtZTogc3RyaW5nLFxuICBlbmFibGVkOiBib29sZWFuXG4pIHtcbiAgY29uc3QgY2xhc3NOYW1lcyA9IGVsZW1lbnQuY2xhc3NOYW1lLnNwbGl0KCcgJyk7XG4gIGlmIChlbmFibGVkKSB7XG4gICAgaWYgKGNsYXNzTmFtZSBpbiBjbGFzc05hbWVzKSB7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIHtcbiAgICAgIGNsYXNzTmFtZXMucHVzaChjbGFzc05hbWUpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBjb25zdCBpbmRleCA9IGNsYXNzTmFtZXMuaW5kZXhPZihjbGFzc05hbWUpO1xuICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY2xhc3NOYW1lcy5zcGxpY2UoaW5kZXgsIDEpO1xuICB9XG4gIGVsZW1lbnQuY2xhc3NOYW1lID0gY2xhc3NOYW1lcy5qb2luKCcgJyk7XG59XG4vKiogUHJvamVjdHMgYSAzZCBwb2ludCBpbnRvIHNjcmVlbiBzcGFjZSAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZlY3RvcjNEVG9TY3JlZW5Db29yZHMoXG4gIGNhbTogVEhSRUUuQ2FtZXJhLFxuICB3OiBudW1iZXIsXG4gIGg6IG51bWJlcixcbiAgdjogVEhSRUUuVmVjdG9yM1xuKTogdmVjdG9yLlBvaW50MkQge1xuICBsZXQgZHByID0gd2luZG93LmRldmljZVBpeGVsUmF0aW87XG4gIGxldCBwdiA9IG5ldyBUSFJFRS5WZWN0b3IzKCkuY29weSh2KS5wcm9qZWN0KGNhbSk7XG4gIC8vIFRoZSBzY3JlZW4tc3BhY2Ugb3JpZ2luIGlzIGF0IHRoZSBtaWRkbGUgb2YgdGhlIHNjcmVlbiwgd2l0aCAreSB1cC5cbiAgbGV0IGNvb3JkczogdmVjdG9yLlBvaW50MkQgPSBbXG4gICAgKChwdi54ICsgMSkgLyAyKSAqIHcgKiBkcHIsXG4gICAgLSgoKHB2LnkgLSAxKSAvIDIpICogaCkgKiBkcHIsXG4gIF07XG4gIHJldHVybiBjb29yZHM7XG59XG4vKiogTG9hZHMgMyBjb250aWd1b3VzIGVsZW1lbnRzIGZyb20gYSBwYWNrZWQgeHl6IGFycmF5IGludG8gYSBWZWN0b3IzLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZlY3RvcjNGcm9tUGFja2VkQXJyYXkoXG4gIGE6IEZsb2F0MzJBcnJheSxcbiAgcG9pbnRJbmRleDogbnVtYmVyXG4pOiBUSFJFRS5WZWN0b3IzIHtcbiAgY29uc3Qgb2Zmc2V0ID0gcG9pbnRJbmRleCAqIDM7XG4gIHJldHVybiBuZXcgVEhSRUUuVmVjdG9yMyhhW29mZnNldF0sIGFbb2Zmc2V0ICsgMV0sIGFbb2Zmc2V0ICsgMl0pO1xufVxuLyoqXG4gKiBHZXRzIHRoZSBjYW1lcmEtc3BhY2UgeiBjb29yZGluYXRlcyBvZiB0aGUgbmVhcmVzdCBhbmQgZmFydGhlc3QgcG9pbnRzLlxuICogSWdub3JlcyBwb2ludHMgdGhhdCBhcmUgYmVoaW5kIHRoZSBjYW1lcmEuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXROZWFyRmFyUG9pbnRzKFxuICB3b3JsZFNwYWNlUG9pbnRzOiBGbG9hdDMyQXJyYXksXG4gIGNhbWVyYVBvczogVEhSRUUuVmVjdG9yMyxcbiAgY2FtZXJhVGFyZ2V0OiBUSFJFRS5WZWN0b3IzXG4pOiBbbnVtYmVyLCBudW1iZXJdIHtcbiAgbGV0IHNob3J0ZXN0RGlzdDogbnVtYmVyID0gSW5maW5pdHk7XG4gIGxldCBmdXJ0aGVzdERpc3Q6IG51bWJlciA9IDA7XG4gIGNvbnN0IGNhbVRvVGFyZ2V0ID0gbmV3IFRIUkVFLlZlY3RvcjMoKS5jb3B5KGNhbWVyYVRhcmdldCkuc3ViKGNhbWVyYVBvcyk7XG4gIGNvbnN0IGNhbVBsYW5lTm9ybWFsID0gbmV3IFRIUkVFLlZlY3RvcjMoKS5jb3B5KGNhbVRvVGFyZ2V0KS5ub3JtYWxpemUoKTtcbiAgY29uc3QgbiA9IHdvcmxkU3BhY2VQb2ludHMubGVuZ3RoIC8gMztcbiAgbGV0IHNyYyA9IDA7XG4gIGxldCBwID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbiAgbGV0IGNhbVRvUG9pbnQgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG47IGkrKykge1xuICAgIHAueCA9IHdvcmxkU3BhY2VQb2ludHNbc3JjXTtcbiAgICBwLnkgPSB3b3JsZFNwYWNlUG9pbnRzW3NyYyArIDFdO1xuICAgIHAueiA9IHdvcmxkU3BhY2VQb2ludHNbc3JjICsgMl07XG4gICAgc3JjICs9IDM7XG4gICAgY2FtVG9Qb2ludC5jb3B5KHApLnN1YihjYW1lcmFQb3MpO1xuICAgIGNvbnN0IGRpc3QgPSBjYW1QbGFuZU5vcm1hbC5kb3QoY2FtVG9Qb2ludCk7XG4gICAgaWYgKGRpc3QgPCAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgZnVydGhlc3REaXN0ID0gZGlzdCA+IGZ1cnRoZXN0RGlzdCA/IGRpc3QgOiBmdXJ0aGVzdERpc3Q7XG4gICAgc2hvcnRlc3REaXN0ID0gZGlzdCA8IHNob3J0ZXN0RGlzdCA/IGRpc3QgOiBzaG9ydGVzdERpc3Q7XG4gIH1cbiAgcmV0dXJuIFtzaG9ydGVzdERpc3QsIGZ1cnRoZXN0RGlzdF07XG59XG4vKipcbiAqIEdlbmVyYXRlIGEgdGV4dHVyZSBmb3IgdGhlIHBvaW50cy9pbWFnZXMgYW5kIHNldHMgc29tZSBpbml0aWFsIHBhcmFtc1xuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVGV4dHVyZShcbiAgaW1hZ2U6IEhUTUxJbWFnZUVsZW1lbnQgfCBIVE1MQ2FudmFzRWxlbWVudFxuKTogVEhSRUUuVGV4dHVyZSB7XG4gIGxldCB0ZXggPSBuZXcgVEhSRUUuVGV4dHVyZShpbWFnZSk7XG4gIHRleC5uZWVkc1VwZGF0ZSA9IHRydWU7XG4gIC8vIFVzZWQgaWYgdGhlIHRleHR1cmUgaXNuJ3QgYSBwb3dlciBvZiAyLlxuICB0ZXgubWluRmlsdGVyID0gVEhSRUUuTGluZWFyRmlsdGVyO1xuICB0ZXguZ2VuZXJhdGVNaXBtYXBzID0gZmFsc2U7XG4gIHRleC5mbGlwWSA9IGZhbHNlO1xuICByZXR1cm4gdGV4O1xufVxuLyoqXG4gKiBBc3NlcnQgdGhhdCB0aGUgY29uZGl0aW9uIGlzIHNhdGlzZmllZDsgaWYgbm90LCBsb2cgdXNlci1zcGVjaWZpZWQgbWVzc2FnZVxuICogdG8gdGhlIGNvbnNvbGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnQoY29uZGl0aW9uOiBib29sZWFuLCBtZXNzYWdlPzogc3RyaW5nKSB7XG4gIGlmICghY29uZGl0aW9uKSB7XG4gICAgbWVzc2FnZSA9IG1lc3NhZ2UgfHwgJ0Fzc2VydGlvbiBmYWlsZWQnO1xuICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgfVxufVxuZXhwb3J0IHR5cGUgU2VhcmNoUHJlZGljYXRlID0gKHA6IERhdGFQb2ludCkgPT4gYm9vbGVhbjtcbmV4cG9ydCBmdW5jdGlvbiBnZXRTZWFyY2hQcmVkaWNhdGUoXG4gIHF1ZXJ5OiBzdHJpbmcsXG4gIGluUmVnZXhNb2RlOiBib29sZWFuLFxuICBmaWVsZE5hbWU6IHN0cmluZ1xuKTogU2VhcmNoUHJlZGljYXRlIHtcbiAgbGV0IHByZWRpY2F0ZTogU2VhcmNoUHJlZGljYXRlO1xuICBpZiAoaW5SZWdleE1vZGUpIHtcbiAgICBsZXQgcmVnRXhwID0gbmV3IFJlZ0V4cChxdWVyeSwgJ2knKTtcbiAgICBwcmVkaWNhdGUgPSAocCkgPT4gcmVnRXhwLnRlc3QocC5tZXRhZGF0YVtmaWVsZE5hbWVdLnRvU3RyaW5nKCkpO1xuICB9IGVsc2Uge1xuICAgIC8vIERvaW5nIGEgY2FzZSBpbnNlbnNpdGl2ZSBzdWJzdHJpbmcgbWF0Y2guXG4gICAgcXVlcnkgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGFjdGl2ZV9sZWFybmluZ19xdWVyeSA9ICdhY3RpdmVfbGVhcm5pbmcnO1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7a2V5d29yZHM6IFsnbGFiZWwnLCAncHJlZGljdGlvbicsICdpc190cmFpbmluZycsICdpc19jb3JyZWN0X3ByZWRpY3Rpb24nLCAnbmV3X3NlbGVjdGlvbicsXG4gICAgICAgIGFjdGl2ZV9sZWFybmluZ19xdWVyeSwgJ2lzX25vaXN5JywgJ25vaXN5X3R5cGUnLCAnb3JpZ2luYWxfb3JfZmxpcHBlZCddfTtcbiAgICBjb25zdCBzZWFyY2hRdWVyeU9iaiA9IHNlYXJjaFF1ZXJ5LnBhcnNlKHF1ZXJ5LCBvcHRpb25zKTtcbiAgICBjb25zdCB2YWxpZF9uZXdfc2VsZWN0aW9uID0gKHNlYXJjaFF1ZXJ5T2JqW1wibmV3X3NlbGVjdGlvblwiXSE9bnVsbCAmJiAhQXJyYXkuaXNBcnJheShzZWFyY2hRdWVyeU9ialtcIm5ld19zZWxlY3Rpb25cIl0pICYmXG4gICAgICAgICAgKHNlYXJjaFF1ZXJ5T2JqW1wibmV3X3NlbGVjdGlvblwiXSA9PSBcInRydWVcIiB8fCBzZWFyY2hRdWVyeU9ialtcIm5ld19zZWxlY3Rpb25cIl0gPT0gXCJmYWxzZVwiKSk7XG4gICAgY29uc3QgdmFsaWRfYWN0aXZlX2xlYXJuaW5nID0gKHNlYXJjaFF1ZXJ5T2JqW2FjdGl2ZV9sZWFybmluZ19xdWVyeV0hPW51bGwgJiYgIUFycmF5LmlzQXJyYXkoc2VhcmNoUXVlcnlPYmpbYWN0aXZlX2xlYXJuaW5nX3F1ZXJ5XSkgJiZcbiAgICAgICAgICAoc2VhcmNoUXVlcnlPYmpbYWN0aXZlX2xlYXJuaW5nX3F1ZXJ5XSA9PSBcInRydWVcIikpO1xuICAgIGNvbnN0IHZhbGlkX25vaXN5ID0gKHNlYXJjaFF1ZXJ5T2JqW1wiaXNfbm9pc3lcIl0hPW51bGwgJiYgIUFycmF5LmlzQXJyYXkoc2VhcmNoUXVlcnlPYmpbXCJpc19ub2lzeVwiXSkgJiZcbiAgICAgICAgICAoc2VhcmNoUXVlcnlPYmpbXCJpc19ub2lzeVwiXSA9PSBcInRydWVcIiB8fCBzZWFyY2hRdWVyeU9ialtcImlzX25vaXN5XCJdID09IFwiZmFsc2VcIikpO1xuICAgIGNvbnN0IHZhbGlkX29yaWdpbmFsID0gKHNlYXJjaFF1ZXJ5T2JqW1wibm9pc3lfdHlwZVwiXSE9bnVsbCAmJiAhQXJyYXkuaXNBcnJheShzZWFyY2hRdWVyeU9ialtcIm5vaXN5X3R5cGVcIl0pICYmXG4gICAgICAgICAgKHNlYXJjaFF1ZXJ5T2JqW1wibm9pc3lfdHlwZVwiXSA9PSBcIm9yaWdpbmFsXCIgfHwgc2VhcmNoUXVlcnlPYmpbXCJub2lzeV90eXBlXCJdID09IFwiZmxpcHBlZFwiIHx8XG4gICAgICAgICAgICAgIHNlYXJjaFF1ZXJ5T2JqW1wibm9pc3lfdHlwZVwiXSA9PSBcIm90aGVyc1wiKSk7XG4gICAgY29uc3QgdmFsaWRfb3JpZ2luYWxfb3JfZmxpcHBlZCA9IChzZWFyY2hRdWVyeU9ialtcIm9yaWdpbmFsX29yX2ZsaXBwZWRcIl0hPW51bGwgJiYgIUFycmF5LmlzQXJyYXkoc2VhcmNoUXVlcnlPYmpbXCJvcmlnaW5hbF9vcl9mbGlwcGVkXCJdKSAmJlxuICAgICAgICAgIChzZWFyY2hRdWVyeU9ialtcIm9yaWdpbmFsX29yX2ZsaXBwZWRcIl0gPT0gXCJ0cnVlXCIpKTtcbiAgICBjb25zdCB2YWxpZF91bmNlcnRhaW50eV9yYW5raW5nID0gKHNlYXJjaFF1ZXJ5T2JqW1widW5jZXJ0YWludHlfcmFua2luZ1wiXSE9bnVsbCAmJiAhQXJyYXkuaXNBcnJheShzZWFyY2hRdWVyeU9ialtcInVuY2VydGFpbnR5X3JhbmtpbmdcIl0pICYmXG4gICAgICAgICAgIWlzTmFOKCtzZWFyY2hRdWVyeU9ialtcInVuY2VydGFpbnR5X3JhbmtpbmdcIl0pKTtcbiAgICBjb25zdCB2YWxpZF91bmNlcnRhaW50eV9leGNlZWQgPSAoc2VhcmNoUXVlcnlPYmpbXCJ1bmNlcnRhaW50eV9leGNlZWRcIl0hPW51bGwgJiYgIUFycmF5LmlzQXJyYXkoc2VhcmNoUXVlcnlPYmpbXCJ1bmNlcnRhaW50eV9leGNlZWRcIl0pICYmXG4gICAgICAgICAgIWlzTmFOKCtzZWFyY2hRdWVyeU9ialtcInVuY2VydGFpbnR5X2V4Y2VlZFwiXSkpO1xuICAgIGNvbnN0IHZhbGlkX2RpdmVyc2l0eV9yYW5raW5nID0gKHNlYXJjaFF1ZXJ5T2JqW1wiZGl2ZXJzaXR5X3JhbmtpbmdcIl0hPW51bGwgJiYgIUFycmF5LmlzQXJyYXkoc2VhcmNoUXVlcnlPYmpbXCJkaXZlcnNpdHlfcmFua2luZ1wiXSkgJiZcbiAgICAgICAgICAhaXNOYU4oK3NlYXJjaFF1ZXJ5T2JqW1wiZGl2ZXJzaXR5X3JhbmtpbmdcIl0pKTtcbiAgICBjb25zdCB2YWxpZF9kaXZlcnNpdHlfZXhjZWVkID0gKHNlYXJjaFF1ZXJ5T2JqW1wiZGl2ZXJzaXR5X2V4Y2VlZFwiXSE9bnVsbCAmJiAhQXJyYXkuaXNBcnJheShzZWFyY2hRdWVyeU9ialtcImRpdmVyc2l0eV9leGNlZWRcIl0pICYmXG4gICAgICAgICAgIWlzTmFOKCtzZWFyY2hRdWVyeU9ialtcImRpdmVyc2l0eV9leGNlZWRcIl0pKTtcbiAgICBjb25zdCB2YWxpZF90b3RfcmFua2luZyA9IChzZWFyY2hRdWVyeU9ialtcInRvdF9yYW5raW5nXCJdIT1udWxsICYmICFBcnJheS5pc0FycmF5KHNlYXJjaFF1ZXJ5T2JqW1widG90X3JhbmtpbmdcIl0pICYmXG4gICAgICAgICAgIWlzTmFOKCtzZWFyY2hRdWVyeU9ialtcInRvdF9yYW5raW5nXCJdKSk7XG4gICAgY29uc3QgdmFsaWRfdG90X2V4Y2VlZCA9IChzZWFyY2hRdWVyeU9ialtcInRvdF9leGNlZWRcIl0hPW51bGwgJiYgIUFycmF5LmlzQXJyYXkoc2VhcmNoUXVlcnlPYmpbXCJ0b3RfZXhjZWVkXCJdKSAmJlxuICAgICAgICAgICFpc05hTigrc2VhcmNoUXVlcnlPYmpbXCJ0b3RfZXhjZWVkXCJdKSk7XG4gICAgcHJlZGljYXRlID0gKHApID0+IHtcbiAgICAgIGlmKHNlYXJjaFF1ZXJ5T2JqW1wibGFiZWxcIl09PW51bGwgJiYgc2VhcmNoUXVlcnlPYmpbXCJwcmVkaWN0aW9uXCJdPT1udWxsICYmXG4gICAgICAgICAgIXZhbGlkX25ld19zZWxlY3Rpb24gJiYgIXZhbGlkX2FjdGl2ZV9sZWFybmluZyAmJiAhdmFsaWRfbm9pc3kgJiYgIXZhbGlkX29yaWdpbmFsICYmICF2YWxpZF9vcmlnaW5hbF9vcl9mbGlwcGVkICYmXG4gICAgICAgICAgIXZhbGlkX3VuY2VydGFpbnR5X3JhbmtpbmcgJiYgIXZhbGlkX2RpdmVyc2l0eV9yYW5raW5nICYmICF2YWxpZF90b3RfcmFua2luZyAmJiAhdmFsaWRfdW5jZXJ0YWludHlfZXhjZWVkXG4gICAgICAgICAgICAgICYmICF2YWxpZF9kaXZlcnNpdHlfZXhjZWVkICYmICF2YWxpZF90b3RfZXhjZWVkICYmXG4gICAgICAgICAgKHNlYXJjaFF1ZXJ5T2JqW1wiaXNfdHJhaW5pbmdcIl09PW51bGwgfHwgQXJyYXkuaXNBcnJheShzZWFyY2hRdWVyeU9ialtcImlzX3RyYWluaW5nXCJdKSB8fFxuICAgICAgICAgICAgICAoKHNlYXJjaFF1ZXJ5T2JqW1wiaXNfdHJhaW5pbmdcIl0gIT0gXCJ0cnVlXCIgJiYgc2VhcmNoUXVlcnlPYmpbXCJpc190cmFpbmluZ1wiXSAhPSBcImZhbHNlXCIpKSlcbiAgICAgICAgICAmJiAoc2VhcmNoUXVlcnlPYmpbXCJpc19jb3JyZWN0X3ByZWRpY3Rpb25cIl09PW51bGwgfHwgQXJyYXkuaXNBcnJheShzZWFyY2hRdWVyeU9ialtcImlzX2NvcnJlY3RfcHJlZGljdGlvblwiXSkgfHxcbiAgICAgICAgICAgICAgKChzZWFyY2hRdWVyeU9ialtcImlzX2NvcnJlY3RfcHJlZGljdGlvblwiXSAhPSBcInRydWVcIiAmJiBzZWFyY2hRdWVyeU9ialtcImlzX2NvcnJlY3RfcHJlZGljdGlvblwiXSAhPSBcImZhbHNlXCIpKSkgKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgaWYoc2VhcmNoUXVlcnlPYmpbXCJsYWJlbFwiXSE9bnVsbCkge1xuICAgICAgICBsZXQgcXVlcnlMYWJlbHMgPSBzZWFyY2hRdWVyeU9ialtcImxhYmVsXCJdO1xuICAgICAgICBsZXQgbGFiZWxSZXN1bHQgPSBmYWxzZTtcbiAgICAgICAgY29uc3QgbGFiZWwgPSBwLm1ldGFkYXRhW1wibGFiZWxcIl0udG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBpZighQXJyYXkuaXNBcnJheShxdWVyeUxhYmVscykpIHtcbiAgICAgICAgICBxdWVyeUxhYmVscyA9IFtxdWVyeUxhYmVsc107XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWVyeUxhYmVscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGNvbnN0IHF1ZXJ5TGFiZWwgPSBxdWVyeUxhYmVsc1tpXTtcbiAgICAgICAgICBsYWJlbFJlc3VsdCA9IGxhYmVsUmVzdWx0IHx8IGxhYmVsID09IHF1ZXJ5TGFiZWw7XG4gICAgICAgICAgaWYobGFiZWxSZXN1bHQpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZighbGFiZWxSZXN1bHQpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmKHNlYXJjaFF1ZXJ5T2JqW1wicHJlZGljdGlvblwiXSE9bnVsbCkge1xuICAgICAgICBsZXQgcXVlcnlQcmVkaWN0aW9ucyA9IHNlYXJjaFF1ZXJ5T2JqW1wicHJlZGljdGlvblwiXTtcbiAgICAgICAgbGV0IHByZWRpY3Rpb25SZXN1bHQgPSBmYWxzZTtcbiAgICAgICAgY29uc3QgcHJlZGljdGlvbiA9IHAuY3VycmVudF9wcmVkaWN0aW9uO1xuICAgICAgICBpZighQXJyYXkuaXNBcnJheShxdWVyeVByZWRpY3Rpb25zKSkge1xuICAgICAgICAgIHF1ZXJ5UHJlZGljdGlvbnMgPSBbcXVlcnlQcmVkaWN0aW9uc107XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWVyeVByZWRpY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgcXVlcnlQcmVkaWN0aW9uID0gcXVlcnlQcmVkaWN0aW9uc1tpXTtcbiAgICAgICAgICBwcmVkaWN0aW9uUmVzdWx0ID0gcHJlZGljdGlvblJlc3VsdCB8fCBwcmVkaWN0aW9uID09IHF1ZXJ5UHJlZGljdGlvbjtcbiAgICAgICAgICBpZihwcmVkaWN0aW9uUmVzdWx0KSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYoIXByZWRpY3Rpb25SZXN1bHQpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmKHZhbGlkX25ld19zZWxlY3Rpb24pIHtcbiAgICAgICAgbGV0IHF1ZXJ5TmV3U2VsZWN0aW9uID0gc2VhcmNoUXVlcnlPYmpbXCJuZXdfc2VsZWN0aW9uXCJdO1xuICAgICAgICBsZXQgbmV3U2VsZWN0aW9uUmVzdWx0ID0gZmFsc2U7XG4gICAgICAgIGlmKHF1ZXJ5TmV3U2VsZWN0aW9uID09IFwidHJ1ZVwiICYmIHAuY3VycmVudF9uZXdfc2VsZWN0aW9uKSB7XG4gICAgICAgICAgbmV3U2VsZWN0aW9uUmVzdWx0ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZihxdWVyeU5ld1NlbGVjdGlvbiA9PSBcImZhbHNlXCIgJiYgcC5jdXJyZW50X25ld19zZWxlY3Rpb24gPT0gZmFsc2UpIHtcbiAgICAgICAgICBuZXdTZWxlY3Rpb25SZXN1bHQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmKCFuZXdTZWxlY3Rpb25SZXN1bHQpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmKHZhbGlkX25vaXN5KSB7XG4gICAgICAgIGxldCBxdWVyeU5vaXN5ID0gc2VhcmNoUXVlcnlPYmpbXCJpc19ub2lzeVwiXTtcbiAgICAgICAgbGV0IG5vaXN5UmVzdWx0ID0gZmFsc2U7XG4gICAgICAgIGlmKHF1ZXJ5Tm9pc3kgPT0gXCJ0cnVlXCIgJiYgcC5ub2lzeSkge1xuICAgICAgICAgIG5vaXN5UmVzdWx0ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZihxdWVyeU5vaXN5ID09IFwiZmFsc2VcIiAmJiBwLm5vaXN5ID09IGZhbHNlKSB7XG4gICAgICAgICAgbm9pc3lSZXN1bHQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmKCFub2lzeVJlc3VsdCkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYodmFsaWRfYWN0aXZlX2xlYXJuaW5nKSB7XG4gICAgICAgIGxldCBuZXdBY3RpdmVMZWFybmluZ1Jlc3VsdCA9IGZhbHNlO1xuICAgICAgICBpZihwLmN1cnJlbnRfbmV3X3NlbGVjdGlvbiB8fCBwLmN1cnJlbnRfdHJhaW5pbmcpIHtcbiAgICAgICAgICBuZXdBY3RpdmVMZWFybmluZ1Jlc3VsdCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYoIW5ld0FjdGl2ZUxlYXJuaW5nUmVzdWx0KSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZih2YWxpZF9vcmlnaW5hbCkge1xuICAgICAgICBsZXQgcXVlcnlPcmlnaW5hbCA9IHNlYXJjaFF1ZXJ5T2JqW1wibm9pc3lfdHlwZVwiXTtcbiAgICAgICAgbGV0IG9yaWdpbmFsUmVzdWx0ID0gZmFsc2U7XG4gICAgICAgIGlmKHF1ZXJ5T3JpZ2luYWwgPT0gXCJvcmlnaW5hbFwiICYmIHAubm9pc3kgJiYgcC5vcmlnaW5hbF9sYWJlbCA9PSBwLmN1cnJlbnRfcHJlZGljdGlvbikge1xuICAgICAgICAgIG9yaWdpbmFsUmVzdWx0ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZihxdWVyeU9yaWdpbmFsID09IFwiZmxpcHBlZFwiICYmIHAubm9pc3kgJiYgcC5jdXJyZW50X3ByZWRpY3Rpb24gPT0gcC5tZXRhZGF0YVtcImxhYmVsXCJdLnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICAgIG9yaWdpbmFsUmVzdWx0ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZihxdWVyeU9yaWdpbmFsID09IFwib3RoZXJzXCIgJiYgcC5ub2lzeSAmJiBwLmN1cnJlbnRfcHJlZGljdGlvbiAhPSBwLm1ldGFkYXRhW1wibGFiZWxcIl0udG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpICYmXG4gICAgICAgICAgICBwLm9yaWdpbmFsX2xhYmVsICE9IHAuY3VycmVudF9wcmVkaWN0aW9uKSB7XG4gICAgICAgICAgb3JpZ2luYWxSZXN1bHQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmKCFvcmlnaW5hbFJlc3VsdCkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYodmFsaWRfb3JpZ2luYWxfb3JfZmxpcHBlZCkge1xuICAgICAgICBsZXQgcXVlcnlPcmlnaW5hbE9yRmxpcHBlZCA9IHNlYXJjaFF1ZXJ5T2JqW1wib3JpZ2luYWxfb3JfZmxpcHBlZFwiXTtcbiAgICAgICAgbGV0IG9yaWdpbmFsT3JGbGlwcGVkID0gZmFsc2U7XG4gICAgICAgIGlmKHF1ZXJ5T3JpZ2luYWxPckZsaXBwZWQgPT0gXCJ0cnVlXCIgJiYgcC5ub2lzeSAmJiAocC5vcmlnaW5hbF9sYWJlbCA9PSBwLmN1cnJlbnRfcHJlZGljdGlvbiB8fFxuICAgICAgICAgICAgcC5jdXJyZW50X3ByZWRpY3Rpb24gPT0gcC5tZXRhZGF0YVtcImxhYmVsXCJdLnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKSkpIHtcbiAgICAgICAgICBvcmlnaW5hbE9yRmxpcHBlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYoIW9yaWdpbmFsT3JGbGlwcGVkKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZih2YWxpZF91bmNlcnRhaW50eV9yYW5raW5nKSB7XG4gICAgICAgIGxldCBxdWVyeVJhbmtpbmcgPSArc2VhcmNoUXVlcnlbXCJ1bmNlcnRhaW50eV9yYW5raW5nXCJdO1xuICAgICAgICBpZihwLmN1cnJlbnRfdW5jZXJ0YWludHlfcmFua2luZyA9PSB1bmRlZmluZWQgfHwgcC5jdXJyZW50X3VuY2VydGFpbnR5X3JhbmtpbmcgPT0gLTEgfHxcbiAgICAgICAgICAgIHAuY3VycmVudF91bmNlcnRhaW50eV9yYW5raW5nID4gcXVlcnlSYW5raW5nKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZih2YWxpZF9kaXZlcnNpdHlfcmFua2luZykge1xuICAgICAgICBsZXQgcXVlcnlSYW5raW5nID0gK3NlYXJjaFF1ZXJ5W1wiZGl2ZXJzaXR5X3JhbmtpbmdcIl07XG4gICAgICAgIGlmKHAuY3VycmVudF9kaXZlcnNpdHlfcmFua2luZyA9PSB1bmRlZmluZWQgfHwgcC5jdXJyZW50X2RpdmVyc2l0eV9yYW5raW5nID09IC0xIHx8XG4gICAgICAgICAgICBwLmN1cnJlbnRfZGl2ZXJzaXR5X3JhbmtpbmcgPiBxdWVyeVJhbmtpbmcpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmKHZhbGlkX3RvdF9yYW5raW5nKSB7XG4gICAgICAgIGxldCBxdWVyeVJhbmtpbmcgPSArc2VhcmNoUXVlcnlbXCJ0b3RfcmFua2luZ1wiXTtcbiAgICAgICAgaWYocC5jdXJyZW50X3RvdF9yYW5raW5nID09IHVuZGVmaW5lZCB8fCBwLmN1cnJlbnRfdG90X3JhbmtpbmcgPT0gLTEgfHxcbiAgICAgICAgICAgIHAuY3VycmVudF90b3RfcmFua2luZyA+IHF1ZXJ5UmFua2luZykge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYodmFsaWRfdW5jZXJ0YWludHlfZXhjZWVkKSB7XG4gICAgICAgIGxldCBxdWVyeUV4Y2VlZCA9ICtzZWFyY2hRdWVyeVtcInVuY2VydGFpbnR5X2V4Y2VlZFwiXTtcbiAgICAgICAgaWYocC5tZXRhZGF0YVtcInVuY2VydGFpbnR5XCJdID09IHVuZGVmaW5lZCB8fCBwLm1ldGFkYXRhW1widW5jZXJ0YWludHlcIl0gPT0gLTEgfHxcbiAgICAgICAgICAgIHAubWV0YWRhdGFbXCJ1bmNlcnRhaW50eVwiXSA8IHF1ZXJ5RXhjZWVkKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZih2YWxpZF9kaXZlcnNpdHlfZXhjZWVkKSB7XG4gICAgICAgIGxldCBxdWVyeUV4Y2VlZCA9ICtzZWFyY2hRdWVyeVtcImRpdmVyc2l0eV9leGNlZWRcIl07XG4gICAgICAgIGlmKHAubWV0YWRhdGFbXCJkaXZlcnNpdHlcIl0gPT0gdW5kZWZpbmVkIHx8IHAubWV0YWRhdGFbXCJkaXZlcnNpdHlcIl0gPT0gLTEgfHxcbiAgICAgICAgICAgIHAubWV0YWRhdGFbXCJkaXZlcnNpdHlcIl0gPCBxdWVyeUV4Y2VlZCkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYodmFsaWRfdG90X2V4Y2VlZCkge1xuICAgICAgICBsZXQgcXVlcnlFeGNlZWQgPSArc2VhcmNoUXVlcnlbXCJ0b3RfZXhjZWVkXCJdO1xuICAgICAgICBpZihwLm1ldGFkYXRhW1widG90XCJdID09IHVuZGVmaW5lZCB8fCBwLm1ldGFkYXRhW1widG90XCJdID09IC0xIHx8XG4gICAgICAgICAgICBwLm1ldGFkYXRhW1widG90XCJdIDwgcXVlcnlFeGNlZWQpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmKHNlYXJjaFF1ZXJ5T2JqW1wiaXNfdHJhaW5pbmdcIl0hPW51bGwgJiYgIUFycmF5LmlzQXJyYXkoc2VhcmNoUXVlcnlPYmpbXCJpc190cmFpbmluZ1wiXSkgJiZcbiAgICAgICAgICAoc2VhcmNoUXVlcnlPYmpbXCJpc190cmFpbmluZ1wiXSA9PSBcInRydWVcIiB8fCBzZWFyY2hRdWVyeU9ialtcImlzX3RyYWluaW5nXCJdID09IFwiZmFsc2VcIikpIHtcbiAgICAgICAgbGV0IHF1ZXJ5VHJhaW5pbmcgPSBzZWFyY2hRdWVyeU9ialtcImlzX3RyYWluaW5nXCJdO1xuICAgICAgICBsZXQgdHJhaW5pbmdSZXN1bHQgPSBmYWxzZTtcbiAgICAgICAgaWYocXVlcnlUcmFpbmluZyA9PSBcInRydWVcIiAmJiBwLmN1cnJlbnRfdHJhaW5pbmcpIHtcbiAgICAgICAgICB0cmFpbmluZ1Jlc3VsdCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYocXVlcnlUcmFpbmluZyA9PSBcImZhbHNlXCIgJiYgcC5jdXJyZW50X3Rlc3RpbmcpIHtcbiAgICAgICAgICB0cmFpbmluZ1Jlc3VsdCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYoIXRyYWluaW5nUmVzdWx0KSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZihzZWFyY2hRdWVyeU9ialtcImlzX2NvcnJlY3RfcHJlZGljdGlvblwiXSE9bnVsbCAmJiAhQXJyYXkuaXNBcnJheShzZWFyY2hRdWVyeU9ialtcImlzX2NvcnJlY3RfcHJlZGljdGlvblwiXSkgJiZcbiAgICAgICAgICAoc2VhcmNoUXVlcnlPYmpbXCJpc19jb3JyZWN0X3ByZWRpY3Rpb25cIl0gPT0gXCJ0cnVlXCIgfHwgc2VhcmNoUXVlcnlPYmpbXCJpc19jb3JyZWN0X3ByZWRpY3Rpb25cIl0gPT0gXCJmYWxzZVwiKSkge1xuICAgICAgICBsZXQgcXVlcnlDb3JyZWN0UHJlZGljdGlvbiA9IHNlYXJjaFF1ZXJ5T2JqW1wiaXNfY29ycmVjdF9wcmVkaWN0aW9uXCJdO1xuICAgICAgICBsZXQgY29ycmVjdFByZWRpY3Rpb25SZXN1bHQgPSBmYWxzZTtcbiAgICAgICAgaWYocC5jdXJyZW50X3dyb25nX3ByZWRpY3Rpb24gPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmKHF1ZXJ5Q29ycmVjdFByZWRpY3Rpb24gPT0gXCJ0cnVlXCIgJiYgIXAuY3VycmVudF93cm9uZ19wcmVkaWN0aW9uKSB7XG4gICAgICAgICAgY29ycmVjdFByZWRpY3Rpb25SZXN1bHQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmKHF1ZXJ5Q29ycmVjdFByZWRpY3Rpb24gPT0gXCJmYWxzZVwiICYmIHAuY3VycmVudF93cm9uZ19wcmVkaWN0aW9uKSB7XG4gICAgICAgICAgY29ycmVjdFByZWRpY3Rpb25SZXN1bHQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmKCFjb3JyZWN0UHJlZGljdGlvblJlc3VsdCkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcblxuICB9XG4gIHJldHVybiBwcmVkaWNhdGU7XG59XG4vKipcbiAqIFJ1bnMgYW4gZXhwZW5zaXZlIHRhc2sgYXN5bmNocm9ub3VzbHkgd2l0aCBzb21lIGRlbGF5XG4gKiBzbyB0aGF0IGl0IGRvZXNuJ3QgYmxvY2sgdGhlIFVJIHRocmVhZCBpbW1lZGlhdGVseS5cbiAqXG4gKiBAcGFyYW0gbWVzc2FnZSBUaGUgbWVzc2FnZSB0byBkaXNwbGF5IHRvIHRoZSB1c2VyLlxuICogQHBhcmFtIHRhc2sgVGhlIGV4cGVuc2l2ZSB0YXNrIHRvIHJ1bi5cbiAqIEBwYXJhbSBtc2dJZCBPcHRpb25hbC4gSUQgb2YgYW4gZXhpc3RpbmcgbWVzc2FnZS4gSWYgcHJvdmlkZWQsIHdpbGwgb3ZlcndyaXRlXG4gKiAgICAgYW4gZXhpc3RpbmcgbWVzc2FnZSBhbmQgd29uJ3QgYXV0b21hdGljYWxseSBjbGVhciB0aGUgbWVzc2FnZSB3aGVuIHRoZVxuICogICAgIHRhc2sgaXMgZG9uZS5cbiAqIEByZXR1cm4gVGhlIHZhbHVlIHJldHVybmVkIGJ5IHRoZSB0YXNrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcnVuQXN5bmNUYXNrPFQ+KFxuICBtZXNzYWdlOiBzdHJpbmcsXG4gIHRhc2s6ICgpID0+IFQsXG4gIG1zZ0lkOiBzdHJpbmcgPSBudWxsLFxuICB0YXNrRGVsYXkgPSBUQVNLX0RFTEFZX01TXG4pOiBQcm9taXNlPFQ+IHtcbiAgbGV0IGF1dG9DbGVhciA9IG1zZ0lkID09IG51bGw7XG4gIG1zZ0lkID0gbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UobWVzc2FnZSwgbXNnSWQpO1xuICByZXR1cm4gbmV3IFByb21pc2U8VD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IHRhc2soKTtcbiAgICAgICAgLy8gQ2xlYXJpbmcgdGhlIG9sZCBtZXNzYWdlLlxuICAgICAgICBpZiAoYXV0b0NsZWFyKSB7XG4gICAgICAgICAgbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UobnVsbCwgbXNnSWQpO1xuICAgICAgICB9XG4gICAgICAgIHJlc29sdmUocmVzdWx0KTtcbiAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgIHJlamVjdChleCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LCB0YXNrRGVsYXkpO1xuICB9KTtcbn1cbi8qKlxuICogUGFyc2VzIHRoZSBVUkwgZm9yIHF1ZXJ5IHBhcmFtZXRlcnMsIGUuZy4gP2Zvbz0xJmJhcj0yIHdpbGwgcmV0dXJuXG4gKiAgIHsnZm9vJzogJzEnLCAnYmFyJzogJzInfS5cbiAqIEBwYXJhbSB1cmwgVGhlIFVSTCB0byBwYXJzZS5cbiAqIEByZXR1cm4gQSBtYXAgb2YgcXVlcnlQYXJhbSBrZXkgdG8gaXRzIHZhbHVlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0VVJMUGFyYW1zKFxuICB1cmw6IHN0cmluZ1xuKToge1xuICBba2V5OiBzdHJpbmddOiBzdHJpbmc7XG59IHtcbiAgaWYgKCF1cmwpIHtcbiAgICByZXR1cm4ge307XG4gIH1cbiAgbGV0IHF1ZXJ5U3RyaW5nID0gdXJsLmluZGV4T2YoJz8nKSAhPT0gLTEgPyB1cmwuc3BsaXQoJz8nKVsxXSA6IHVybDtcbiAgaWYgKHF1ZXJ5U3RyaW5nLmluZGV4T2YoJyMnKSkge1xuICAgIHF1ZXJ5U3RyaW5nID0gcXVlcnlTdHJpbmcuc3BsaXQoJyMnKVswXTtcbiAgfVxuICBjb25zdCBxdWVyeUVudHJpZXMgPSBxdWVyeVN0cmluZy5zcGxpdCgnJicpO1xuICBsZXQgcXVlcnlQYXJhbXM6IHtcbiAgICBba2V5OiBzdHJpbmddOiBzdHJpbmc7XG4gIH0gPSB7fTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWVyeUVudHJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICBsZXQgcXVlcnlFbnRyeUNvbXBvbmVudHMgPSBxdWVyeUVudHJpZXNbaV0uc3BsaXQoJz0nKTtcbiAgICBxdWVyeVBhcmFtc1txdWVyeUVudHJ5Q29tcG9uZW50c1swXS50b0xvd2VyQ2FzZSgpXSA9IGRlY29kZVVSSUNvbXBvbmVudChcbiAgICAgIHF1ZXJ5RW50cnlDb21wb25lbnRzWzFdXG4gICAgKTtcbiAgfVxuICByZXR1cm4gcXVlcnlQYXJhbXM7XG59XG4vKiogTGlzdCBvZiBzdWJzdHJpbmdzIHRoYXQgYXV0byBnZW5lcmF0ZWQgdGVuc29ycyBoYXZlIGluIHRoZWlyIG5hbWUuICovXG5jb25zdCBTVUJTVFJfR0VOX1RFTlNPUlMgPSBbJy9BZGFncmFkJ107XG4vKiogUmV0dXJucyB0cnVlIGlmIHRoZSB0ZW5zb3Igd2FzIGF1dG9tYXRpY2FsbHkgZ2VuZXJhdGVkIGJ5IFRGIEFQSSBjYWxscy4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0ZW5zb3JJc0dlbmVyYXRlZCh0ZW5zb3JOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBTVUJTVFJfR0VOX1RFTlNPUlMubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAodGVuc29yTmFtZS5pbmRleE9mKFNVQlNUUl9HRU5fVEVOU09SU1tpXSkgPj0gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cbmV4cG9ydCBmdW5jdGlvbiB4b3IoY29uZDE6IGJvb2xlYW4sIGNvbmQyOiBib29sZWFuKTogYm9vbGVhbiB7XG4gIHJldHVybiAoY29uZDEgfHwgY29uZDIpICYmICEoY29uZDEgJiYgY29uZDIpO1xufVxuLyoqIENoZWNrcyB0byBzZWUgaWYgdGhlIGJyb3dzZXIgc3VwcG9ydHMgd2ViZ2wuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFzV2ViR0xTdXBwb3J0KCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICB0cnkge1xuICAgIGxldCBjID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgbGV0IGdsID0gYy5nZXRDb250ZXh0KCd3ZWJnbCcpIHx8IGMuZ2V0Q29udGV4dCgnZXhwZXJpbWVudGFsLXdlYmdsJyk7XG4gICAgYXdhaXQgdGYucmVhZHkoKTtcbiAgICByZXR1cm4gZ2wgIT0gbnVsbCAmJiB0Zi5nZXRCYWNrZW5kKCkgPT09ICd3ZWJnbCc7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cbiJdfQ==