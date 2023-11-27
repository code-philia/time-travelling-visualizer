import { __awaiter } from "tslib";
import * as knn from './knn';
import * as vector from './vector';
import * as logging from './logging';
import * as util from './util';
const IS_FIREFOX = navigator.userAgent.toLowerCase().indexOf('firefox') >= 0;
/** Controls whether nearest neighbors computation is done on the GPU or CPU. */
export const TSNE_SAMPLE_SIZE = 500;
export const UMAP_SAMPLE_SIZE = 500;
export const PCA_SAMPLE_SIZE = 50000;
/** Number of dimensions to sample when doing approximate PCA. */
export const PCA_SAMPLE_DIM = 200;
/** Number of pca components to compute. */
const NUM_PCA_COMPONENTS = 10;
/** Id of message box used for umap optimization progress bar. */
const UMAP_MSG_ID = 'umap-optimization';
/**
 * Reserved metadata attributes used for sequence information
 * NOTE: Use "__seq_next__" as "__next__" is deprecated.
 */
const SEQUENCE_METADATA_ATTRS = ['__next__', '__seq_next__'];
function getSequenceNextPointIndex(pointMetadata) {
    let sequenceAttr = null;
    for (let metadataAttr of SEQUENCE_METADATA_ATTRS) {
        if (metadataAttr in pointMetadata && pointMetadata[metadataAttr] !== '') {
            sequenceAttr = pointMetadata[metadataAttr];
            break;
        }
    }
    if (sequenceAttr == null) {
        return null;
    }
    return +sequenceAttr;
}
/**
 * Test http request
 */
/**
 * Dataset contains a DataPoints array that should be treated as immutable. This
 * acts as a working subset of the original data, with cached properties
 * from computationally expensive operations. Because creating a subset
 * requires normalizing and shifting the vector space, we make a copy of the
 * data so we can still always create new subsets based on the original data.
 */
export class DataSet {
    /** Creates a new Dataset */
    constructor(points, spriteAndMetadataInfo) {
        this.shuffledDataIndices = [];
        /**
         * This keeps a list of all current projections so you can easily test to see
         * if it's been calculated already.
         */
        this.projections = {};
        this.tSNEIteration = 0;
        this.tSNEShouldPauseAndCheck = false;
        this.tSNEShouldPause = false;
        this.tSNEShouldStop = true;
        this.tSNEShouldKill = false;
        this.tSNEJustPause = false;
        this.tSNETotalIter = 0;
        /**
         * This part contains information for DVI visualization
         */
        this.DVIsubjectModelPath = "";
        this.DVIResolution = 400;
        this.DVIServer = window.sessionStorage.ipAddress || 'localhost:5001';
        this.DVIValidPointNumber = [];
        this.DVICurrentRealDataNumber = 0;
        this.DVIRealDataNumber = [];
        this.DVIEvaluation = [];
        this.DVIDataList = [];
        this.DVIAvailableIteration = [];
        this.DVIPredicates = [];
        this.is_uncertainty_diversity_tot_exist = [];
        this.superviseInput = '';
        this.dim = [0, 0];
        this.hasTSNERun = false;
        this.hasUmapRun = false;
        this.points = points;
        this.shuffledDataIndices = util.shuffle(util.range(this.points.length));
        this.sequences = this.computeSequences(points);
        this.dim = [this.points.length, this.points[0].vector.length];
        this.spriteAndMetadataInfo = spriteAndMetadataInfo;
        this.DVIfilterIndices = [];
    }
    computeSequences(points) {
        // Keep a list of indices seen so we don't compute sequences for a given
        // point twice.
        let indicesSeen = new Int8Array(points.length);
        // Compute sequences.
        let indexToSequence = {};
        let sequences = [];
        for (let i = 0; i < points.length; i++) {
            if (indicesSeen[i]) {
                continue;
            }
            indicesSeen[i] = 1;
            // Ignore points without a sequence attribute.
            let next = getSequenceNextPointIndex(points[i].metadata);
            if (next == null) {
                continue;
            }
            if (next in indexToSequence) {
                let existingSequence = indexToSequence[next];
                // Pushing at the beginning of the array.
                existingSequence.pointIndices.unshift(i);
                indexToSequence[i] = existingSequence;
                continue;
            }
            // The current point is pointing to a new/unseen sequence.
            let newSequence = { pointIndices: [] };
            indexToSequence[i] = newSequence;
            sequences.push(newSequence);
            let currentIndex = i;
            while (points[currentIndex]) {
                newSequence.pointIndices.push(currentIndex);
                let next = getSequenceNextPointIndex(points[currentIndex].metadata);
                if (next != null) {
                    indicesSeen[next] = 1;
                    currentIndex = next;
                }
                else {
                    currentIndex = -1;
                }
            }
        }
        return sequences;
    }
    projectionCanBeRendered(projection) {
        if (projection !== 'tsne') {
            return true;
        }
        return this.tSNEIteration > 0;
    }
    /**
     * Returns a new subset dataset by copying out data. We make a copy because
     * we have to modify the vectors by normalizing them.
     *
     * @param subset Array of indices of points that we want in the subset.
     *
     * @return A subset of the original dataset.
     */
    getSubset(subset) {
        const pointsSubset = subset != null && subset.length > 0
            ? subset.map((i) => this.points[i])
            : this.points;
        let points = pointsSubset.map((dp) => {
            return {
                metadata: dp.metadata,
                index: dp.index,
                vector: dp.vector.slice(),
                projections: {},
            };
        });
        const dp_list = [];
        for (let i = 0; i < points.length; i++) {
            const dp = {
                metadata: pointsSubset[i].metadata,
                index: pointsSubset[i].index,
                vector: points[i].vector,
                original_vector: pointsSubset[i].vector,
                projections: points[i].projections,
            };
            dp_list.push(dp);
        }
        return new DataSet(dp_list, this.spriteAndMetadataInfo);
    }
    /**
     * Computes the centroid, shifts all points to that centroid,
     * then makes them all unit norm.
     */
    normalize() {
        // Compute the centroid of all data points.
        let centroid = vector.centroid(this.points, (a) => a.vector);
        if (centroid == null) {
            throw Error('centroid should not be null');
        }
        // Shift all points by the centroid and make them unit norm.
        for (let id = 0; id < this.points.length; ++id) {
            let dataPoint = this.points[id];
            dataPoint.vector = vector.sub(dataPoint.vector, centroid);
            if (vector.norm2(dataPoint.vector) > 0) {
                // If we take the unit norm of a vector of all 0s, we get a vector of
                // all NaNs. We prevent that with a guard.
                vector.unit(dataPoint.vector);
            }
        }
    }
    /** Projects the dataset onto a given vector and caches the result. */
    projectLinear(dir, label) {
        this.projections[label] = true;
        this.points.forEach((dataPoint) => {
            dataPoint.projections[label] = vector.dot(dataPoint.vector, dir);
        });
    }
    setDVIFilteredData(pointIndices) {
        // reset first
        for (let i = 0; i < this.points.length; i++) {
            let dataPoint = this.points[i];
            dataPoint.projections['tsne-0'] = dataPoint.DVI_projections[this.tSNEIteration][0];
            dataPoint.projections['tsne-1'] = dataPoint.DVI_projections[this.tSNEIteration][1];
            dataPoint.projections['tsne-2'] = 0;
        }
        for (let i = 0; i < this.points.length; i++) {
            if ((pointIndices === null || pointIndices === void 0 ? void 0 : pointIndices.indexOf(i)) == -1 && i < this.DVICurrentRealDataNumber) {
                let dataPoint = this.points[i];
                dataPoint.projections = {};
            }
        }
        this.DVIfilterIndices = pointIndices;
    }
    /** Runs DVI on the data. */
    projectDVI(iteration, predicates, stepCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            this.projections['tsne'] = true;
            function componentToHex(c) {
                const hex = c.toString(16);
                return hex.length == 1 ? "0" + hex : hex;
            }
            function rgbToHex(r, g, b) {
                return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
            }
            this.iterationChangeReset();
            // window.sessionStorage.setItem('acceptIndicates',"")
            // window.sessionStorage.setItem('rejectIndicates',"")
            window.acceptIndicates = [];
            window.rejectIndicates = [];
            if (this.DVIAvailableIteration.indexOf(iteration) == -1) {
                let headers = new Headers();
                headers.append('Content-Type', 'application/json');
                headers.append('Accept', 'application/json');
                // await fetch("standalone_projector_config.json", { method: 'GET' })
                //   .then(response => response.json())
                //   .then(data => {
                //     const ip_address = data.DVIServerIP + ":" + data.DVIServerPort;
                //     this.DVIServer = ip_address;
                if (window.modelMath) {
                    this.DVIsubjectModelPath = window.modelMath;
                }
                window.iteration = iteration;
                yield fetch("http://" + this.DVIServer + "/updateProjection", {
                    method: 'POST',
                    body: JSON.stringify({
                        "path": window.sessionStorage.content_path || this.DVIsubjectModelPath, "iteration": iteration,
                        "resolution": this.DVIResolution, "predicates": predicates,
                        "username": window.sessionStorage.username,
                        "vis_method": window.sessionStorage.vis_method,
                        'setting': window.sessionStorage.selectedSetting,
                        "content_path": window.sessionStorage.content_path || this.DVIsubjectModelPath,
                    }),
                    headers: headers,
                    mode: 'cors'
                }).then(response => response.json()).then(data => {
                    var _a;
                    const result = data.result;
                    const grid_index = [[data.grid_index[0], data.grid_index[1]], [data.grid_index[2], data.grid_index[3]]];
                    const grid_color = [[137, 120, 117], [136, 119, 116], [136, 118, 115], [135, 117, 114]];
                    if (!window.sceneBackgroundImg) {
                        window.sceneBackgroundImg = [];
                    }
                    window.sceneBackgroundImg[window.iteration] = data.grid_color;
                    let temp_label_color_list = [];
                    let temp_label_list = [];
                    let k = 0;
                    for (let i = 0; i < result.length - 1; i++) {
                        if (data.properties[i] === 0 || (window.sessionStorage.selectedSetting !== 'active learning' && window.sessionStorage.selectedSetting !== 'dense al')) {
                            let color = data.label_color_list[k] || [204, 204, 204];
                            let label = data.label_list[k] || 'unlabeled';
                            temp_label_color_list.push(color);
                            temp_label_list.push(label);
                            k = k + 1;
                        }
                        else {
                            temp_label_color_list.push([204, 204, 204]);
                            temp_label_list.push('unlabeled');
                        }
                    }
                    const label_color_list = temp_label_color_list;
                    const label_list = temp_label_list;
                    const prediction_list = data.prediction_list;
                    const background_point_number = grid_index.length;
                    const real_data_number = label_color_list.length;
                    this.tSNETotalIter = data.maximum_iteration;
                    window.tSNETotalIter = data.maximum_iteration;
                    this.tSNEIteration = iteration;
                    this.DVIValidPointNumber[iteration] = real_data_number + background_point_number;
                    this.DVIAvailableIteration.push(iteration);
                    const current_length = this.points.length;
                    const training_data = data.training_data;
                    const testing_data = data.testing_data;
                    const new_selection = data.new_selection;
                    const noisy_data = data.noisy_data;
                    const original_label_list = data.original_label_list;
                    const evaluation = data.evaluation;
                    this.DVIEvaluation[iteration] = evaluation;
                    const inv_acc = data.inv_acc_list || [];
                    if (!window.properties) {
                        window.properties = [];
                    }
                    window.properties[iteration] = data.properties;
                    window.unLabelData = [];
                    window.testingData = [];
                    window.labeledData = [];
                    if (!window.nowShowIndicates) {
                        window.nowShowIndicates = [];
                        for (let i = 0; i < data.properties.length; i++) {
                            if (data.properties[i] === 1) {
                                window.unLabelData.push(i);
                            }
                            else if (data.properties[i] === 2) {
                                window.testingData.push(i);
                            }
                            else {
                                window.labeledData.push(i);
                            }
                            window.nowShowIndicates.push(i);
                        }
                    }
                    const filterIndices = data.selectedPoints;
                    console.log('real_data_number + background_point_number - current_length', real_data_number + background_point_number - current_length);
                    for (let i = 0; i < real_data_number + background_point_number - current_length; i++) {
                        const newDataPoint = {
                            metadata: { label: "background" },
                            index: current_length + i,
                            projections: {
                                'tsne-0': 0,
                                'tsne-1': 0,
                                'tsne-2': 0
                            },
                        };
                        this.points.push(newDataPoint);
                    }
                    for (let i = 0; i < this.points.length; i++) {
                        let dataPoint = this.points[i];
                        if (dataPoint.DVI_projections == undefined || dataPoint.DVI_color == undefined) {
                            dataPoint.DVI_projections = {};
                            dataPoint.DVI_color = {};
                        }
                        if (dataPoint.training_data == undefined || dataPoint.testing_data == undefined) {
                            dataPoint.training_data = {};
                            dataPoint.testing_data = {};
                        }
                        if (dataPoint.prediction == undefined) {
                            dataPoint.prediction = {};
                        }
                        if (dataPoint.new_selection == undefined) {
                            dataPoint.new_selection = {};
                        }
                        if (dataPoint.inv_acc == undefined) {
                            dataPoint.inv_acc = {};
                        }
                        if (dataPoint.uncertainty == undefined) {
                            dataPoint.uncertainty = {};
                        }
                        if (dataPoint.uncertainty_ranking == undefined) {
                            dataPoint.uncertainty_ranking = {};
                        }
                        if (dataPoint.diversity == undefined) {
                            dataPoint.diversity = {};
                        }
                        if (dataPoint.diversity_ranking == undefined) {
                            dataPoint.diversity_ranking = {};
                        }
                        if (dataPoint.tot == undefined) {
                            dataPoint.tot = {};
                        }
                        if (dataPoint.tot_ranking == undefined) {
                            dataPoint.tot_ranking = {};
                        }
                    }
                    for (let i = 0; i < real_data_number; i++) {
                        let dataPoint = this.points[i];
                        dataPoint.projections['tsne-0'] = result[i][0];
                        dataPoint.projections['tsne-1'] = result[i][1];
                        dataPoint.projections['tsne-2'] = 0;
                        if (((_a = window.unLabelData) === null || _a === void 0 ? void 0 : _a.length) && window.unLabelData.indexOf(i) !== -1) {
                            // label_color_list[i] = [204, 204, 204]
                            dataPoint.color = rgbToHex(204, 204, 204);
                        }
                        else {
                            dataPoint.color = rgbToHex(label_color_list[i][0], label_color_list[i][1], label_color_list[i][2]);
                        }
                        dataPoint.DVI_projections[iteration] = [result[i][0], result[i][1]];
                        dataPoint.DVI_color[iteration] = dataPoint.color;
                        dataPoint.training_data[iteration] = false;
                        dataPoint.testing_data[iteration] = false;
                        dataPoint.current_training = false;
                        dataPoint.current_testing = false;
                        dataPoint.metadata['label'] = label_list[i];
                        dataPoint.prediction[iteration] = prediction_list[i];
                        dataPoint.current_prediction = prediction_list[i];
                        dataPoint.inv_acc[iteration] = inv_acc[i];
                        dataPoint.current_inv_acc = inv_acc[i];
                        if (prediction_list[i] == label_list[i]) {
                            dataPoint.current_wrong_prediction = false;
                        }
                        else {
                            dataPoint.current_wrong_prediction = true;
                        }
                        // dataPoint.new_selection[iteration] = false;
                        dataPoint.current_new_selection = false;
                        if (original_label_list) {
                            dataPoint.original_label = original_label_list[i];
                        }
                        dataPoint.noisy = false;
                    }
                    for (let i = 0; i < background_point_number; i++) {
                        let dataPoint = this.points[i + real_data_number];
                        dataPoint.projections['tsne-0'] = grid_index[i][0];
                        dataPoint.projections['tsne-1'] = grid_index[i][1];
                        dataPoint.projections['tsne-2'] = 0;
                        dataPoint.color = rgbToHex(grid_color[i][0], grid_color[i][1], grid_color[i][2]);
                        dataPoint.DVI_projections[iteration] = [grid_index[i][0], grid_index[i][1]];
                        dataPoint.DVI_color[iteration] = dataPoint.color;
                        dataPoint.training_data[iteration] = undefined;
                        dataPoint.testing_data[iteration] = undefined;
                        dataPoint.current_training = undefined;
                        dataPoint.current_testing = undefined;
                        dataPoint.prediction[iteration] = "background";
                        dataPoint.current_prediction = "background";
                        dataPoint.inv_acc[iteration] = 0;
                        dataPoint.current_inv_acc = 0;
                        dataPoint.current_new_selection = undefined;
                        // dataPoint.new_selection[iteration] = undefined;
                        dataPoint.current_wrong_prediction = undefined;
                        dataPoint.original_label = "background";
                        dataPoint.noisy = undefined;
                    }
                    for (let i = real_data_number + background_point_number; i < this.points.length; i++) {
                        let dataPoint = this.points[i];
                        dataPoint.projections = {};
                    }
                    for (let i = 0; i < training_data.length; i++) {
                        const dataIndex = training_data[i];
                        let dataPoint = this.points[dataIndex];
                        dataPoint.training_data[iteration] = true;
                        dataPoint.current_training = true;
                    }
                    for (let i = 0; i < testing_data.length; i++) {
                        const dataIndex = testing_data[i];
                        let dataPoint = this.points[dataIndex];
                        dataPoint.testing_data[iteration] = true;
                        dataPoint.current_testing = true;
                    }
                    this.DVICurrentRealDataNumber = real_data_number;
                    this.DVIRealDataNumber[iteration] = real_data_number;
                    this.DVIfilterIndices = [];
                    for (let i = 0; i < real_data_number + background_point_number; i++) {
                        this.DVIfilterIndices.push(i);
                    }
                    this.DVIDataList[iteration] = this.points;
                    window.DVIDataList = this.DVIDataList;
                    stepCallback(this.tSNEIteration, evaluation, new_selection, filterIndices, this.tSNETotalIter);
                }).catch(error => {
                    console.log(error);
                    logging.setErrorMessage('error');
                    stepCallback(null, null, null, null, null);
                });
                // });
            }
            else {
                const validDataNumber = this.DVIValidPointNumber[iteration];
                const evaluation = this.DVIEvaluation[iteration];
                this.tSNEIteration = iteration;
                window.iteration = iteration;
                const newSelection = [];
                for (let i = 0; i < validDataNumber; i++) {
                    let dataPoint = this.points[i];
                    dataPoint.projections['tsne-0'] = dataPoint.DVI_projections[iteration][0];
                    dataPoint.projections['tsne-1'] = dataPoint.DVI_projections[iteration][1];
                    dataPoint.projections['tsne-2'] = 0;
                    dataPoint.color = dataPoint.DVI_color[iteration];
                    dataPoint.current_training = dataPoint.training_data[iteration];
                    dataPoint.current_testing = dataPoint.testing_data[iteration];
                    dataPoint.current_prediction = dataPoint.prediction[iteration];
                    dataPoint.current_inv_acc = dataPoint.inv_acc[iteration];
                    if (dataPoint.current_prediction == dataPoint.metadata['label'] && dataPoint.metadata['label'] != "background") {
                        dataPoint.current_wrong_prediction = false;
                    }
                    else {
                        if (dataPoint.metadata['label'] != "background") {
                            dataPoint.current_wrong_prediction = true;
                        }
                        else {
                            dataPoint.current_wrong_prediction = undefined;
                        }
                    }
                    // dataPoint.current_new_selection = dataPoint.new_selection[iteration];
                    // if (dataPoint.current_new_selection) {
                    //   newSelection.push(i);
                    // }
                    // if (this.is_uncertainty_diversity_tot_exist[iteration]) {
                    //   dataPoint.metadata['uncertainty'] = dataPoint.uncertainty[iteration];
                    //   dataPoint.metadata['diversity'] = dataPoint.diversity[iteration];
                    //   dataPoint.metadata['tot'] = dataPoint.tot[iteration];
                    //   dataPoint.current_uncertainty_ranking = dataPoint.uncertainty_ranking[iteration];
                    //   dataPoint.current_diversity_ranking = dataPoint.diversity_ranking[iteration];
                    //   dataPoint.current_tot_ranking = dataPoint.tot_ranking[iteration];
                    // }
                }
                for (let i = validDataNumber; i < this.points.length; i++) {
                    let dataPoint = this.points[i];
                    dataPoint.projections = {};
                    dataPoint.current_testing = false;
                    dataPoint.current_training = false;
                }
                // const matches = this.get_match();
                // for (let i = 0; i < validDataNumber; i++) {
                //   let dataPoint = this.points[i];
                //   if (matches.indexOf(i) == -1 && i < this.DVICurrentRealDataNumber) {
                //     dataPoint.projections = {}
                //   }
                // }
                this.DVICurrentRealDataNumber = this.DVIRealDataNumber[iteration];
                this.DVIfilterIndices = [];
                for (let i = 0; i < this.DVICurrentRealDataNumber + Math.pow(this.DVIResolution, 2); i++) {
                    this.DVIfilterIndices.push(i);
                }
                let headers = new Headers();
                headers.append('Content-Type', 'application/json');
                headers.append('Accept', 'application/json');
                yield fetch(`http://${this.DVIServer}/query`, {
                    method: 'POST',
                    body: JSON.stringify({
                        "predicates": predicates, "content_path": window.sessionStorage.content_path || this.DVIsubjectModelPath,
                        "iteration": iteration, "username": window.sessionStorage.username, "vis_method": window.sessionStorage.vis_method, 'setting': window.sessionStorage.selectedSetting
                    }),
                    headers: headers,
                    mode: 'cors'
                }).then(response => response.json()).then(data => {
                    const indices = data.selectedPoints;
                    stepCallback(this.tSNEIteration, evaluation, newSelection, indices, this.tSNETotalIter);
                }).catch(error => {
                    logging.setErrorMessage('querying for indices');
                    stepCallback(null, null, null, null, null);
                });
            }
        });
    }
    /** Runs DVI on the data. */
    reTrainByDVI(iteration, newIndices, rejection, stepCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            this.projections['tsne'] = true;
            function componentToHex(c) {
                const hex = c.toString(16);
                return hex.length == 1 ? "0" + hex : hex;
            }
            this.iterationChangeReset();
            function rgbToHex(r, g, b) {
                return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
            }
            let headers = new Headers();
            headers.append('Content-Type', 'application/json');
            headers.append('Accept', 'application/json');
            // await fetch("standalone_projector_config.json", { method: 'GET' })
            //   .then(response => response.json())
            //   .then(data => {
            //     const ip_address = data.DVIServerIP + ":" + data.DVIServerPort;
            //     this.DVIServer = ip_address;
            if (window.modelMath) {
                this.DVIsubjectModelPath = window.modelMath;
            }
            let indices = [];
            if (window.acceptIndicates) {
                indices = window.acceptIndicates.filter((item, i, arr) => {
                    //函数自身返回的是一个布尔值，只当返回值为true时，当前元素才会存入新的数组中。            
                    return window.properties[window.iteration][item] === 1;
                });
            }
            let rejIndices = [];
            if (window.rejectIndicates) {
                rejIndices = window.rejectIndicates.filter((item, i, arr) => {
                    //函数自身返回的是一个布尔值，只当返回值为true时，当前元素才会存入新的数组中。            
                    return window.properties[window.iteration][item] === 1;
                });
            }
            let that = this;
            yield fetch("http://" + this.DVIServer + "/al_train", {
                method: 'POST',
                body: JSON.stringify({
                    "iteration": this.tSNEIteration,
                    "accIndices": indices,
                    "rejIndices": rejIndices,
                    "content_path": this.DVIsubjectModelPath,
                    "username": window.sessionStorage.username
                }),
                headers: headers,
                mode: 'cors'
            }).then(response => response.json()).then(data => {
                iteration = data.maximum_iteration;
                window.acceptIndicates = [];
                window.rejectIndicates = [];
                window.sessionStorage.setItem('acceptIndicates', "");
                window.sessionStorage.setItem('rejectIndicates', "");
                window.iteration = iteration;
                const result = data.result;
                const grid_index = [[data.grid_index[0], data.grid_index[1]], [data.grid_index[2], data.grid_index[3]]];
                const grid_color = [[137, 120, 117], [136, 119, 116], [136, 118, 115], [135, 117, 114]];
                window.sceneBackgroundImg[window.iteration] = data.grid_color;
                let k = 0;
                let temp_label_color_list = [];
                let temp_label_list = [];
                for (let i = 0; i < result.length - 1; i++) {
                    if (data.properties[i] === 0) {
                        let color = data.label_color_list[k] || [204, 204, 204];
                        let label = data.label_list[k] || 'unlabeled';
                        temp_label_color_list.push(color);
                        temp_label_list.push(label);
                        k + k + 1;
                    }
                    else {
                        temp_label_color_list.push([204, 204, 204]);
                        temp_label_list.push('unlabeled');
                    }
                }
                const label_color_list = temp_label_color_list;
                const label_list = temp_label_list;
                console.log('label_color_list.length', label_color_list.length);
                const prediction_list = data.prediction_list;
                const background_point_number = grid_index.length;
                const real_data_number = label_color_list.length;
                this.tSNETotalIter = data.maximum_iteration;
                window.tSNETotalIter = data.maximum_iteration;
                this.tSNEIteration = iteration;
                this.DVIValidPointNumber[iteration] = real_data_number + background_point_number;
                this.DVIAvailableIteration.push(iteration);
                const current_length = this.points.length;
                const training_data = data.training_data;
                const testing_data = data.testing_data;
                const new_selection = data.new_selection;
                const noisy_data = data.noisy_data;
                const original_label_list = data.original_label_list;
                const evaluation = data.evaluation;
                this.DVIEvaluation[iteration] = evaluation;
                const inv_acc = data.inv_acc_list || [];
                if (!window.properties) {
                    window.properties = [];
                }
                window.properties[iteration] = data.properties;
                window.unLabelData = [];
                window.testingData = [];
                window.labeledData = [];
                if (!window.nowShowIndicates) {
                    window.nowShowIndicates = [];
                    for (let i = 0; i < data.properties.length; i++) {
                        if (data.properties[i] === 1) {
                            window.unLabelData.push(i);
                        }
                        else if (data.properties[i] === 2) {
                            window.testingData.push(i);
                        }
                        else {
                            window.labeledData.push(i);
                        }
                        window.nowShowIndicates.push(i);
                    }
                }
                // const is_uncertainty_diversity_tot_exist = data.uncertainty_diversity_tot?.is_exist;
                // this.is_uncertainty_diversity_tot_exist[iteration] = is_uncertainty_diversity_tot_exist;
                const filterIndices = data.selectedPoints;
                for (let i = 0; i < real_data_number + background_point_number - current_length; i++) {
                    const newDataPoint = {
                        metadata: { label: "background" },
                        index: current_length + i,
                        projections: {
                            'tsne-0': 0,
                            'tsne-1': 0,
                            'tsne-2': 0
                        },
                    };
                    this.points.push(newDataPoint);
                }
                for (let i = 0; i < this.points.length; i++) {
                    let dataPoint = this.points[i];
                    if (dataPoint.DVI_projections == undefined || dataPoint.DVI_color == undefined) {
                        dataPoint.DVI_projections = {};
                        dataPoint.DVI_color = {};
                    }
                    if (dataPoint.training_data == undefined || dataPoint.testing_data == undefined) {
                        dataPoint.training_data = {};
                        dataPoint.testing_data = {};
                    }
                    if (dataPoint.prediction == undefined) {
                        dataPoint.prediction = {};
                    }
                    if (dataPoint.new_selection == undefined) {
                        dataPoint.new_selection = {};
                    }
                    if (dataPoint.inv_acc == undefined) {
                        dataPoint.inv_acc = {};
                    }
                    if (dataPoint.uncertainty == undefined) {
                        dataPoint.uncertainty = {};
                    }
                    if (dataPoint.uncertainty_ranking == undefined) {
                        dataPoint.uncertainty_ranking = {};
                    }
                    if (dataPoint.diversity == undefined) {
                        dataPoint.diversity = {};
                    }
                    if (dataPoint.diversity_ranking == undefined) {
                        dataPoint.diversity_ranking = {};
                    }
                    if (dataPoint.tot == undefined) {
                        dataPoint.tot = {};
                    }
                    if (dataPoint.tot_ranking == undefined) {
                        dataPoint.tot_ranking = {};
                    }
                }
                for (let i = 0; i < real_data_number; i++) {
                    let dataPoint = this.points[i];
                    dataPoint.projections['tsne-0'] = result[i][0];
                    dataPoint.projections['tsne-1'] = result[i][1];
                    dataPoint.projections['tsne-2'] = 0;
                    dataPoint.color = rgbToHex(label_color_list[i][0], label_color_list[i][1], label_color_list[i][2]);
                    dataPoint.DVI_projections[iteration] = [result[i][0], result[i][1]];
                    dataPoint.DVI_color[iteration] = dataPoint.color;
                    dataPoint.training_data[iteration] = false;
                    dataPoint.testing_data[iteration] = false;
                    dataPoint.current_training = false;
                    dataPoint.current_testing = false;
                    dataPoint.metadata['label'] = label_list[i];
                    dataPoint.prediction[iteration] = prediction_list[i];
                    dataPoint.current_prediction = prediction_list[i];
                    dataPoint.inv_acc[iteration] = inv_acc[i];
                    dataPoint.current_inv_acc = inv_acc[i];
                    if (prediction_list[i] == label_list[i]) {
                        dataPoint.current_wrong_prediction = false;
                    }
                    else {
                        dataPoint.current_wrong_prediction = true;
                    }
                    // dataPoint.new_selection[iteration] = false;
                    dataPoint.current_new_selection = false;
                    if (original_label_list) {
                        dataPoint.original_label = original_label_list[i];
                    }
                    dataPoint.noisy = false;
                    // if (is_uncertainty_diversity_tot_exist) {
                    //   dataPoint.metadata['uncertainty'] = data.uncertainty_diversity_tot.uncertainty[i];
                    //   dataPoint.uncertainty[iteration] = dataPoint.metadata['uncertainty'];
                    //   dataPoint.metadata['diversity'] = data.uncertainty_diversity_tot.diversity[i];
                    //   dataPoint.diversity[iteration] = dataPoint.metadata['diversity'];
                    //   dataPoint.metadata['tot'] = data.uncertainty_diversity_tot.tot[i];
                    //   dataPoint.tot[iteration] = dataPoint.metadata['tot'];
                    //   dataPoint.uncertainty_ranking[iteration] = data.uncertainty_diversity_tot.uncertainty_ranking[i];
                    //   dataPoint.current_uncertainty_ranking = data.uncertainty_diversity_tot.uncertainty_ranking[i];
                    //   dataPoint.diversity_ranking[iteration] = data.uncertainty_diversity_tot.diversity_ranking[i];
                    //   dataPoint.current_diversity_ranking = data.uncertainty_diversity_tot.diversity_ranking[i];
                    //   dataPoint.tot_ranking[iteration] = data.uncertainty_diversity_tot.tot_ranking[i];
                    //   dataPoint.current_tot_ranking = data.uncertainty_diversity_tot.tot_ranking[i];
                    // }
                }
                for (let i = 0; i < background_point_number; i++) {
                    let dataPoint = this.points[i + real_data_number];
                    dataPoint.projections['tsne-0'] = grid_index[i][0];
                    dataPoint.projections['tsne-1'] = grid_index[i][1];
                    dataPoint.projections['tsne-2'] = 0;
                    dataPoint.color = rgbToHex(grid_color[i][0], grid_color[i][1], grid_color[i][2]);
                    dataPoint.DVI_projections[iteration] = [grid_index[i][0], grid_index[i][1]];
                    dataPoint.DVI_color[iteration] = dataPoint.color;
                    dataPoint.training_data[iteration] = undefined;
                    dataPoint.testing_data[iteration] = undefined;
                    dataPoint.current_training = undefined;
                    dataPoint.current_testing = undefined;
                    dataPoint.prediction[iteration] = "background";
                    dataPoint.current_prediction = "background";
                    dataPoint.inv_acc[iteration] = 0;
                    dataPoint.current_inv_acc = 0;
                    dataPoint.current_new_selection = undefined;
                    // dataPoint.new_selection[iteration] = undefined;
                    dataPoint.current_wrong_prediction = undefined;
                    dataPoint.original_label = "background";
                    dataPoint.noisy = undefined;
                    // if (is_uncertainty_diversity_tot_exist) {
                    //   dataPoint.metadata['uncertainty'] = -1;
                    //   dataPoint.uncertainty[iteration] = -1;
                    //   dataPoint.metadata['diversity'] = -1;
                    //   dataPoint.diversity[iteration] = -1;
                    //   dataPoint.metadata['tot'] = -1;
                    //   dataPoint.tot[iteration] = -1;
                    //   dataPoint.uncertainty_ranking[iteration] = -1;
                    //   dataPoint.current_uncertainty_ranking = -1;
                    //   dataPoint.diversity_ranking[iteration] = -1;
                    //   dataPoint.current_diversity_ranking = -1;
                    //   dataPoint.tot_ranking[iteration] = -1;
                    //   dataPoint.current_tot_ranking = -1;
                    // }
                }
                for (let i = real_data_number + background_point_number; i < this.points.length; i++) {
                    let dataPoint = this.points[i];
                    dataPoint.projections = {};
                }
                for (let i = 0; i < training_data.length; i++) {
                    const dataIndex = training_data[i];
                    let dataPoint = this.points[dataIndex];
                    dataPoint.training_data[iteration] = true;
                    dataPoint.current_training = true;
                }
                for (let i = 0; i < testing_data.length; i++) {
                    const dataIndex = testing_data[i];
                    let dataPoint = this.points[dataIndex];
                    dataPoint.testing_data[iteration] = true;
                    dataPoint.current_testing = true;
                }
                // for (let i = 0; i < new_selection.length; i++) {
                //   const dataIndex = new_selection[i];
                //   let dataPoint = this.points[dataIndex];
                //   dataPoint.new_selection[iteration] = true;
                //   dataPoint.current_new_selection = true;
                // }
                // for (let i = 0; i < noisy_data?.length; i++) {
                //   const dataIndex = noisy_data[i];
                //   let dataPoint = this.points[dataIndex];
                //   dataPoint.noisy = true;
                // }
                // const matches = this.get_match();
                //
                // for (let i = 0; i < real_data_number; i++) {
                //   let dataPoint = this.points[i];
                //   if (indices.indexOf(i) == -1 && i < this.DVICurrentRealDataNumber) {
                //     dataPoint.projections = {}
                //   }
                // }
                this.DVICurrentRealDataNumber = real_data_number;
                this.DVIRealDataNumber[iteration] = real_data_number;
                this.DVIfilterIndices = [];
                for (let i = 0; i < real_data_number + background_point_number; i++) {
                    this.DVIfilterIndices.push(i);
                }
                this.DVIDataList[iteration] = this.points;
                if (this.DVIDataList[iteration] && this.DVIDataList[iteration].length && this.DVIDataList.lenght > iteration) {
                    for (let i = this.DVIDataList.length + 1; i > iteration; i--) {
                        this.DVIDataList[i] = this.DVIDataList[i - 1];
                    }
                }
                window.DVIDataList = this.DVIDataList;
                stepCallback(this.tSNEIteration, evaluation, new_selection, filterIndices, this.tSNETotalIter);
            }).catch(error => {
                logging.setErrorMessage('Error');
                console.log(error);
                stepCallback(null, null, null, null, null);
            });
            // });
        });
    }
    getSpriteImage(id, stepCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            let headers = new Headers();
            headers.append('Content-Type', 'application/json');
            headers.append('Accept', 'application/json');
            if (window.modelMath) {
                this.DVIsubjectModelPath = window.modelMath;
            }
            // const msgId = logging.setModalMessage('Fetching sprite image...');
            // await fetch("standalone_projector_config.json", { method: 'GET' })
            // .then(response => response.json())
            // .then(data => {  this.DVIsubjectModelPath = data.DVIsubjectModelPath })
            yield fetch(`http://${this.DVIServer}/sprite?index=${id}&path=${this.DVIsubjectModelPath}&username=${window.sessionStorage.username}`, {
                method: 'GET',
                mode: 'cors'
            }).then(response => response.json()).then(data => {
                // logging.setModalMessage(null, msgId);
                stepCallback(data);
            }).catch(error => {
                // logging.setModalMessage(null, msgId);
                console.log("error", error);
            });
        });
    }
    iterationChangeReset() {
        window.alQueryResPointIndices = [];
        window.queryResPointIndices = [];
        window.queryResPointIndices = [];
        window.previousIndecates = [];
        window.alSuggestionIndicates = [];
        window.alSuggestLabelList = [];
        window.alSuggestScoreList = [];
        window.customSelection = [];
        window.flagindecatesList = [];
    }
    setSupervision(superviseColumn, superviseInput) {
        if (superviseColumn != null) {
            this.superviseLabels = this.shuffledDataIndices
                .slice(0, TSNE_SAMPLE_SIZE)
                .map((index) => this.points[index].metadata[superviseColumn] !== undefined
                ? String(this.points[index].metadata[superviseColumn])
                : `Unknown #${index}`);
        }
        if (superviseInput != null) {
            this.superviseInput = superviseInput;
        }
        if (this.tsne) {
            this.tsne.setSupervision(this.superviseLabels, this.superviseInput);
        }
    }
    setSuperviseFactor(superviseFactor) {
        if (superviseFactor != null) {
            this.superviseFactor = superviseFactor;
            if (this.tsne) {
                this.tsne.setSuperviseFactor(superviseFactor);
            }
        }
    }
    /**
     * Merges metadata to the dataset and returns whether it succeeded.
     */
    mergeMetadata(metadata) {
        if (metadata.pointsInfo.length !== this.points.length) {
            let errorMessage = `Number of tensors (${this.points.length}) do not` +
                ` match the number of lines in metadata` +
                ` (${metadata.pointsInfo.length}).`;
            if (metadata.stats.length === 1 &&
                this.points.length + 1 === metadata.pointsInfo.length) {
                // If there is only one column of metadata and the number of points is
                // exactly one less than the number of metadata lines, this is due to an
                // unnecessary header line in the metadata and we can show a meaningful
                // error.
                logging.setErrorMessage(errorMessage +
                    ' Single column metadata should not have a header ' +
                    'row.', 'merging metadata');
                return false;
            }
            else if (metadata.stats.length > 1 &&
                this.points.length - 1 === metadata.pointsInfo.length) {
                // If there are multiple columns of metadata and the number of points is
                // exactly one greater than the number of lines in the metadata, this
                // means there is a missing metadata header.
                logging.setErrorMessage(errorMessage +
                    ' Multi-column metadata should have a header ' +
                    'row with column labels.', 'merging metadata');
                return false;
            }
            logging.setWarningMessage(errorMessage);
        }
        this.spriteAndMetadataInfo = metadata;
        metadata.pointsInfo
            .slice(0, this.points.length)
            .forEach((m, i) => (this.points[i].metadata = m));
        return true;
    }
    stopTSNE() {
        this.tSNEShouldStop = true;
    }
    /**
     * Finds the nearest neighbors of the query point using a
     * user-specified distance metric.
     */
    findNeighbors(pointIndex, distFunc, numNN) {
        // Find the nearest neighbors of a particular point.
        let neighbors = knn.findKNNofPoint(this.points, pointIndex, numNN, (d) => d.vector, distFunc);
        // TODO(@dsmilkov): Figure out why we slice.
        let result = neighbors.slice(0, numNN);
        return result;
    }
    /**
     * Search the dataset based on a metadata field and save all the predicates.
     */
    query(query, inRegexMode, fieldName) {
        let predicate = util.getSearchPredicate(query, inRegexMode, fieldName);
        let matches = [];
        this.points.forEach((point, id) => {
            let result = true;
            for (let i = 0; i < this.DVIPredicates.length; i++) {
                const current_predicate = this.DVIPredicates[i];
                if (!current_predicate(point)) {
                    result = false;
                    break;
                }
            }
            if (result && predicate(point)) {
                matches.push(id);
            }
        });
        return [predicate, matches];
    }
    get_match() {
        let matches = [];
        this.points.forEach((point, id) => {
            let result = true;
            for (let i = 0; i < this.DVIPredicates.length; i++) {
                const current_predicate = this.DVIPredicates[i];
                if (!current_predicate(point)) {
                    result = false;
                    break;
                }
            }
            if (result) {
                matches.push(id);
            }
        });
        return matches;
    }
}
export class Projection {
    constructor(projectionType, projectionComponents, dimensionality, dataSet) {
        this.projectionType = projectionType;
        this.projectionComponents = projectionComponents;
        this.dimensionality = dimensionality;
        this.dataSet = dataSet;
    }
}
/**
 * An interface that holds all the data for serializing the current state of
 * the world.
 */
export class State {
    constructor() {
        /** A label identifying this state. */
        this.label = '';
        /** Whether this State is selected in the bookmarks pane. */
        this.isSelected = false;
        /** t-SNE parameters */
        this.tSNEIteration = 0;
        this.tSNEPerplexity = 0;
        this.tSNELearningRate = 0;
        this.tSNEis3d = true;
        /** UMAP parameters */
        this.umapIs3d = true;
        this.umapNeighbors = 15;
        /** PCA projection component dimensions */
        this.pcaComponentDimensions = [];
        /** The computed projections of the tensors. */
        this.projections = [];
        /** The indices of selected points. */
        this.selectedPoints = [];
    }
}
export function getProjectionComponents(projection, components) {
    if (components.length > 3) {
        throw new RangeError('components length must be <= 3');
    }
    const projectionComponents = [null, null, null];
    const prefix = projection === 'custom' ? 'linear' : projection;
    for (let i = 0; i < components.length; ++i) {
        if (components[i] == null) {
            continue;
        }
        projectionComponents[i] = prefix + '-' + components[i];
    }
    return projectionComponents;
}
export function stateGetAccessorDimensions(state) {
    let dimensions;
    switch (state.selectedProjection) {
        case 'pca':
            dimensions = state.pcaComponentDimensions.slice();
            break;
        case 'tsne':
            dimensions = [0, 1];
            if (state.tSNEis3d) {
                dimensions.push(2);
            }
            break;
        case 'umap':
            dimensions = [0, 1];
            if (state.umapIs3d) {
                dimensions.push(2);
            }
            break;
        case 'custom':
            dimensions = ['x', 'y'];
            break;
        default:
            throw new Error('Unexpected fallthrough');
    }
    return dimensions;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3RlbnNvcmJvYXJkL3Byb2plY3Rvci9kYXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUEwQkEsT0FBTyxLQUFLLEdBQUcsTUFBTSxPQUFPLENBQUM7QUFDN0IsT0FBTyxLQUFLLE1BQU0sTUFBTSxVQUFVLENBQUM7QUFDbkMsT0FBTyxLQUFLLE9BQU8sTUFBTSxXQUFXLENBQUM7QUFDckMsT0FBTyxLQUFLLElBQUksTUFBTSxRQUFRLENBQUM7QUF1SC9CLE1BQU0sVUFBVSxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM3RSxnRkFBZ0Y7QUFDaEYsTUFBTSxDQUFDLE1BQU0sZ0JBQWdCLEdBQUcsR0FBRyxDQUFDO0FBQ3BDLE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUFHLEdBQUcsQ0FBQztBQUNwQyxNQUFNLENBQUMsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDO0FBQ3JDLGlFQUFpRTtBQUNqRSxNQUFNLENBQUMsTUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDO0FBQ2xDLDJDQUEyQztBQUMzQyxNQUFNLGtCQUFrQixHQUFHLEVBQUUsQ0FBQztBQUM5QixpRUFBaUU7QUFDakUsTUFBTSxXQUFXLEdBQUcsbUJBQW1CLENBQUM7QUFDeEM7OztHQUdHO0FBQ0gsTUFBTSx1QkFBdUIsR0FBRyxDQUFDLFVBQVUsRUFBRSxjQUFjLENBQUMsQ0FBQztBQUM3RCxTQUFTLHlCQUF5QixDQUNoQyxhQUE0QjtJQUU1QixJQUFJLFlBQVksR0FBRyxJQUFJLENBQUM7SUFDeEIsS0FBSyxJQUFJLFlBQVksSUFBSSx1QkFBdUIsRUFBRTtRQUNoRCxJQUFJLFlBQVksSUFBSSxhQUFhLElBQUksYUFBYSxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUsRUFBRTtZQUN2RSxZQUFZLEdBQUcsYUFB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QyxLQUFLLEtBQUs7WUFDUixVQUFVLEdBQUcsS0FBSyxDQUFDLHNCQUFzQixDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2xELE1BQU07UUFDUixLQUFLLE1BQU07WUFDVCxVQUFVLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDcEIsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFO2dCQUNsQixVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ3BCO1lBQ0QsTUFBTTtRQUNSLEtBQUssTUFBTTtZQUNULFVBQVUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNwQixJQUFJLEtBQUssQ0FBQyxRQUFRLEVBQUU7Z0JBQ2xCLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDcEI7WUFDRCxNQUFNO1FBQ1IsS0FBSyxRQUFRO1lBQ1gsVUFBVSxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ3hCLE1BQU07UUFDUjtZQUNFLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLENBQUMsQ0FBQztLQUM3QztJQUNELE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBDb3B5cmlnaHQgMjAxNiBUaGUgVGVuc29yRmxvdyBBdXRob3JzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5pbXBvcnQgbnVtZXJpYyBmcm9tICdudW1lcmljJztcbmltcG9ydCB7IFVNQVAgfSBmcm9tICd1bWFwLWpzJztcblxuaW1wb3J0IHsgVFNORSB9IGZyb20gJy4vYmhfdHNuZSc7XG5pbXBvcnQge1xuICBEYXRhUHJvdmlkZXIsXG4gIEVtYmVkZGluZ0luZm8sXG4gIHBhcnNlVGVuc29yc0Zyb21GbG9hdDMyQXJyYXksIFByb2plY3RvckNvbmZpZyxcbiAgU3ByaXRlTWV0YWRhdGEsXG4gIFRFTlNPUlNfTVNHX0lEXG59IGZyb20gJy4vZGF0YS1wcm92aWRlcic7XG5pbXBvcnQgeyBDYW1lcmFEZWYgfSBmcm9tICcuL3NjYXR0ZXJQbG90JztcbmltcG9ydCAqIGFzIGtubiBmcm9tICcuL2tubic7XG5pbXBvcnQgKiBhcyB2ZWN0b3IgZnJvbSAnLi92ZWN0b3InO1xuaW1wb3J0ICogYXMgbG9nZ2luZyBmcm9tICcuL2xvZ2dpbmcnO1xuaW1wb3J0ICogYXMgdXRpbCBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgdHlwZSBEaXN0YW5jZUZ1bmN0aW9uID0gKGE6IHZlY3Rvci5WZWN0b3IsIGI6IHZlY3Rvci5WZWN0b3IpID0+IG51bWJlcjtcbmV4cG9ydCB0eXBlIFByb2plY3Rpb25Db21wb25lbnRzM0QgPSBbc3RyaW5nLCBzdHJpbmcsIHN0cmluZ107XG5cbmV4cG9ydCBpbnRlcmZhY2UgUG9pbnRNZXRhZGF0YSB7XG4gIFtrZXk6IHN0cmluZ106IG51bWJlciB8IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBEYXRhUHJvdG8ge1xuICBzaGFwZTogW251bWJlciwgbnVtYmVyXTtcbiAgdGVuc29yOiBudW1iZXJbXTtcbiAgbWV0YWRhdGE6IHtcbiAgICBjb2x1bW5zOiBBcnJheTx7XG4gICAgICBuYW1lOiBzdHJpbmc7XG4gICAgICBzdHJpbmdWYWx1ZXM6IHN0cmluZ1tdO1xuICAgICAgbnVtZXJpY1ZhbHVlczogbnVtYmVyW107XG4gICAgfT47XG4gICAgc3ByaXRlOiB7XG4gICAgICBpbWFnZUJhc2U2NDogc3RyaW5nO1xuICAgICAgc2luZ2xlSW1hZ2VEaW06IFtudW1iZXIsIG51bWJlcl07XG4gICAgfTtcbiAgfTtcbn1cblxuLyoqIFN0YXRpc3RpY3MgZm9yIGEgbWV0YWRhdGEgY29sdW1uLiAqL1xuZXhwb3J0IGludGVyZmFjZSBDb2x1bW5TdGF0cyB7XG4gIG5hbWU6IHN0cmluZztcbiAgaXNOdW1lcmljOiBib29sZWFuO1xuICB0b29NYW55VW5pcXVlVmFsdWVzOiBib29sZWFuO1xuICB1bmlxdWVFbnRyaWVzPzogQXJyYXk8e1xuICAgIGxhYmVsOiBzdHJpbmc7XG4gICAgY291bnQ6IG51bWJlcjtcbiAgfT47XG4gIG1pbjogbnVtYmVyO1xuICBtYXg6IG51bWJlcjtcbn1cbmV4cG9ydCBpbnRlcmZhY2UgU3ByaXRlQW5kTWV0YWRhdGFJbmZvIHtcbiAgc3RhdHM/OiBDb2x1bW5TdGF0c1tdO1xuICBwb2ludHNJbmZvPzogUG9pbnRNZXRhZGF0YVtdO1xuICBzcHJpdGVJbWFnZT86IEhUTUxJbWFnZUVsZW1lbnQ7XG4gIHNwcml0ZU1ldGFkYXRhPzogU3ByaXRlTWV0YWRhdGE7XG59XG5cbi8qKiBBIHNpbmdsZSBjb2xsZWN0aW9uIG9mIHBvaW50cyB3aGljaCBtYWtlIHVwIGEgc2VxdWVuY2UgdGhyb3VnaCBzcGFjZS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU2VxdWVuY2Uge1xuICAvKiogSW5kaWNlcyBpbnRvIHRoZSBEYXRhUG9pbnRzIGFycmF5IGluIHRoZSBEYXRhIG9iamVjdC4gKi9cbiAgcG9pbnRJbmRpY2VzOiBudW1iZXJbXTtcbn1cbmV4cG9ydCBpbnRlcmZhY2UgRGF0YVBvaW50IHtcbiAgLyoqIFRoZSBwb2ludCBpbiB0aGUgb3JpZ2luYWwgc3BhY2UuICovXG4gIHZlY3Rvcj86IEZsb2F0MzJBcnJheTtcbiAgLypcbiAgICogTWV0YWRhdGEgZm9yIGVhY2ggcG9pbnQuIEVhY2ggbWV0YWRhdGEgaXMgYSBzZXQgb2Yga2V5L3ZhbHVlIHBhaXJzXG4gICAqIHdoZXJlIHRoZSB2YWx1ZSBjYW4gYmUgYSBzdHJpbmcgb3IgYSBudW1iZXIuXG4gICAqL1xuICBvcmlnaW5hbF92ZWN0b3I/OiBGbG9hdDMyQXJyYXk7XG4gIG1pc2xhYmVsX3ZlY3Rvcj86IGJvb2xlYW47XG4gIGNvbG9yPzogc3RyaW5nO1xuICBtZXRhZGF0YTogUG9pbnRNZXRhZGF0YTtcbiAgLyoqIGluZGV4IG9mIHRoZSBzZXF1ZW5jZSwgdXNlZCBmb3IgaGlnaGxpZ2h0aW5nIG9uIGNsaWNrICovXG4gIHNlcXVlbmNlSW5kZXg/OiBudW1iZXI7XG4gIC8qKiBpbmRleCBpbiB0aGUgb3JpZ2luYWwgZGF0YSBzb3VyY2UgKi9cbiAgaW5kZXg6IG51bWJlcjtcbiAgLyoqIFRoaXMgaXMgd2hlcmUgdGhlIGNhbGN1bGF0ZWQgcHJvamVjdGlvbnMgc3BhY2UgYXJlIGNhY2hlZCAqL1xuICBwcm9qZWN0aW9uczoge1xuICAgIFtrZXk6IHN0cmluZ106IG51bWJlcjtcbiAgfTtcbiAgRFZJX3Byb2plY3Rpb25zPzoge1xuICAgIFtpdGVyYXRpb246IG51bWJlcl06IFthbnksIGFueV07XG4gIH07XG4gIERWSV9jb2xvcj86IHtcbiAgICBbaXRlcmF0aW9uOiBudW1iZXJdOiBzdHJpbmc7XG4gIH1cbiAgdHJhaW5pbmdfZGF0YT86IHtcbiAgICBbaXRlcmF0aW9uOiBudW1iZXJdOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICB9XG4gIHRlc3RpbmdfZGF0YT86IHtcbiAgICBbaXRlcmF0aW9uOiBudW1iZXJdOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICB9XG4gIG5ld19zZWxlY3Rpb24/OiB7XG4gICAgW2l0ZXJhdGlvbjogbnVtYmVyXTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcbiAgfVxuICBjdXJyZW50X3RyYWluaW5nPzogYm9vbGVhbjtcbiAgY3VycmVudF90ZXN0aW5nPzogYm9vbGVhbjtcbiAgcHJlZGljdGlvbj86IHtcbiAgICBbaXRlcmF0aW9uOiBudW1iZXJdOiBzdHJpbmc7XG4gIH07XG4gIGN1cnJlbnRfcHJlZGljdGlvbj86IHN0cmluZztcbiAgY3VycmVudF93cm9uZ19wcmVkaWN0aW9uPzogYm9vbGVhbjtcbiAgY3VycmVudF9uZXdfc2VsZWN0aW9uPzogYm9vbGVhbjtcbiAgb3JpZ2luYWxfbGFiZWw/OiBzdHJpbmc7XG4gIG5vaXN5PzogYm9vbGVhbjtcbiAgaW52X2FjYz86IHtcbiAgICBbaXRlcmF0aW9uOiBudW1iZXJdOiBudW1iZXI7XG4gIH07XG4gIGN1cnJlbnRfaW52X2FjYz86IG51bWJlcjtcbiAgdW5jZXJ0YWludHk/OiB7XG4gICAgW2l0ZXJhdGlvbjogbnVtYmVyXTogbnVtYmVyIHwgc3RyaW5nO1xuICB9O1xuICBkaXZlcnNpdHk/OiB7XG4gICAgW2l0ZXJhdGlvbjogbnVtYmVyXTogbnVtYmVyIHwgc3RyaW5nO1xuICB9O1xuICB0b3Q/OiB7XG4gICAgW2l0ZXJhdGlvbjogbnVtYmVyXTogbnVtYmVyIHwgc3RyaW5nO1xuICB9O1xuICB1bmNlcnRhaW50eV9yYW5raW5nPzoge1xuICAgIFtpdGVyYXRpb246IG51bWJlcl06IG51bWJlcjtcbiAgfTtcbiAgY3VycmVudF91bmNlcnRhaW50eV9yYW5raW5nPzogbnVtYmVyO1xuICBkaXZlcnNpdHlfcmFua2luZz86IHtcbiAgICBbaXRlcmF0aW9uOiBudW1iZXJdOiBudW1iZXI7XG4gIH07XG4gIGN1cnJlbnRfZGl2ZXJzaXR5X3Jhbmtpbmc/OiBudW1iZXI7XG4gIHRvdF9yYW5raW5nPzoge1xuICAgIFtpdGVyYXRpb246IG51bWJlcl06IG51bWJlcjtcbiAgfTtcbiAgY3VycmVudF90b3RfcmFua2luZz86IG51bWJlcjtcbn1cbmNvbnN0IElTX0ZJUkVGT1ggPSBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignZmlyZWZveCcpID49IDA7XG4vKiogQ29udHJvbHMgd2hldGhlciBuZWFyZXN0IG5laWdoYm9ycyBjb21wdXRhdGlvbiBpcyBkb25lIG9uIHRoZSBHUFUgb3IgQ1BVLiAqL1xuZXhwb3J0IGNvbnN0IFRTTkVfU0FNUExFX1NJWkUgPSA1MDA7XG5leHBvcnQgY29uc3QgVU1BUF9TQU1QTEVfU0laRSA9IDUwMDtcbmV4cG9ydCBjb25zdCBQQ0FfU0FNUExFX1NJWkUgPSA1MDAwMDtcbi8qKiBOdW1iZXIgb2YgZGltZW5zaW9ucyB0byBzYW1wbGUgd2hlbiBkb2luZyBhcHByb3hpbWF0ZSBQQ0EuICovXG5leHBvcnQgY29uc3QgUENBX1NBTVBMRV9ESU0gPSAyMDA7XG4vKiogTnVtYmVyIG9mIHBjYSBjb21wb25lbnRzIHRvIGNvbXB1dGUuICovXG5jb25zdCBOVU1fUENBX0NPTVBPTkVOVFMgPSAxMDtcbi8qKiBJZCBvZiBtZXNzYWdlIGJveCB1c2VkIGZvciB1bWFwIG9wdGltaXphdGlvbiBwcm9ncmVzcyBiYXIuICovXG5jb25zdCBVTUFQX01TR19JRCA9ICd1bWFwLW9wdGltaXphdGlvbic7XG4vKipcbiAqIFJlc2VydmVkIG1ldGFkYXRhIGF0dHJpYnV0ZXMgdXNlZCBmb3Igc2VxdWVuY2UgaW5mb3JtYXRpb25cbiAqIE5PVEU6IFVzZSBcIl9fc2VxX25leHRfX1wiIGFzIFwiX19uZXh0X19cIiBpcyBkZXByZWNhdGVkLlxuICovXG5jb25zdCBTRVFVRU5DRV9NRVRBREFUQV9BVFRSUyA9IFsnX19uZXh0X18nLCAnX19zZXFfbmV4dF9fJ107XG5mdW5jdGlvbiBnZXRTZXF1ZW5jZU5leHRQb2ludEluZGV4KFxuICBwb2ludE1ldGFkYXRhOiBQb2ludE1ldGFkYXRhXG4pOiBudW1iZXIgfCBudWxsIHtcbiAgbGV0IHNlcXVlbmNlQXR0ciA9IG51bGw7XG4gIGZvciAobGV0IG1ldGFkYXRhQXR0ciBvZiBTRVFVRU5DRV9NRVRBREFUQV9BVFRSUykge1xuICAgIGlmIChtZXRhZGF0YUF0dHIgaW4gcG9pbnRNZXRhZGF0YSAmJiBwb2ludE1ldGFkYXRhW21ldGFkYXRhQXR0cl0gIT09ICcnKSB7XG4gICAgICBzZXF1ZW5jZUF0dHIgPSBwb2ludE1ldGFkYXRhW21ldGFkYXRhQXR0cl07XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgaWYgKHNlcXVlbmNlQXR0ciA9PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgcmV0dXJuICtzZXF1ZW5jZUF0dHI7XG59XG5cbi8qKlxuICogVGVzdCBodHRwIHJlcXVlc3RcbiAqL1xuLyoqXG4gKiBEYXRhc2V0IGNvbnRhaW5zIGEgRGF0YVBvaW50cyBhcnJheSB0aGF0IHNob3VsZCBiZSB0cmVhdGVkIGFzIGltbXV0YWJsZS4gVGhpc1xuICogYWN0cyBhcyBhIHdvcmtpbmcgc3Vic2V0IG9mIHRoZSBvcmlnaW5hbCBkYXRhLCB3aXRoIGNhY2hlZCBwcm9wZXJ0aWVzXG4gKiBmcm9tIGNvbXB1dGF0aW9uYWxseSBleHBlbnNpdmUgb3BlcmF0aW9ucy4gQmVjYXVzZSBjcmVhdGluZyBhIHN1YnNldFxuICogcmVxdWlyZXMgbm9ybWFsaXppbmcgYW5kIHNoaWZ0aW5nIHRoZSB2ZWN0b3Igc3BhY2UsIHdlIG1ha2UgYSBjb3B5IG9mIHRoZVxuICogZGF0YSBzbyB3ZSBjYW4gc3RpbGwgYWx3YXlzIGNyZWF0ZSBuZXcgc3Vic2V0cyBiYXNlZCBvbiB0aGUgb3JpZ2luYWwgZGF0YS5cbiAqL1xuZXhwb3J0IGNsYXNzIERhdGFTZXQge1xuICBwb2ludHM6IERhdGFQb2ludFtdO1xuICBzZXF1ZW5jZXM6IFNlcXVlbmNlW107XG4gIHNodWZmbGVkRGF0YUluZGljZXM6IG51bWJlcltdID0gW107XG4gIC8qKlxuICAgKiBUaGlzIGtlZXBzIGEgbGlzdCBvZiBhbGwgY3VycmVudCBwcm9qZWN0aW9ucyBzbyB5b3UgY2FuIGVhc2lseSB0ZXN0IHRvIHNlZVxuICAgKiBpZiBpdCdzIGJlZW4gY2FsY3VsYXRlZCBhbHJlYWR5LlxuICAgKi9cbiAgcHJvamVjdGlvbnM6IHtcbiAgICBbcHJvamVjdGlvbjogc3RyaW5nXTogYm9vbGVhbjtcbiAgfSA9IHt9O1xuICBuZWFyZXN0OiBrbm4uTmVhcmVzdEVudHJ5W11bXTtcbiAgc3ByaXRlQW5kTWV0YWRhdGFJbmZvOiBTcHJpdGVBbmRNZXRhZGF0YUluZm87XG4gIGZyYWNWYXJpYW5jZXNFeHBsYWluZWQ6IG51bWJlcltdO1xuICB0U05FSXRlcmF0aW9uOiBudW1iZXIgPSAwO1xuICB0U05FU2hvdWxkUGF1c2VBbmRDaGVjayA9IGZhbHNlO1xuICB0U05FU2hvdWxkUGF1c2UgPSBmYWxzZTtcbiAgdFNORVNob3VsZFN0b3AgPSB0cnVlO1xuICB0U05FU2hvdWxkS2lsbCA9IGZhbHNlO1xuICB0U05FSnVzdFBhdXNlID0gZmFsc2U7XG4gIHRTTkVUb3RhbEl0ZXI6IG51bWJlciA9IDA7XG4gIC8qKlxuICAgKiBUaGlzIHBhcnQgY29udGFpbnMgaW5mb3JtYXRpb24gZm9yIERWSSB2aXN1YWxpemF0aW9uXG4gICAqL1xuICBEVklzdWJqZWN0TW9kZWxQYXRoID0gXCJcIjtcbiAgRFZJUmVzb2x1dGlvbiA9IDQwMDtcbiAgRFZJU2VydmVyID0gd2luZG93LnNlc3Npb25TdG9yYWdlLmlwQWRkcmVzcyB8fCAnbG9jYWxob3N0OjUwMDEnO1xuICBEVklWYWxpZFBvaW50TnVtYmVyOiB7XG4gICAgW2l0ZXJhdGlvbjogbnVtYmVyXTogbnVtYmVyO1xuICB9ID0gW107XG4gIERWSUN1cnJlbnRSZWFsRGF0YU51bWJlciA9IDA7XG4gIERWSVJlYWxEYXRhTnVtYmVyOiB7XG4gICAgW2l0ZXJhdGlvbjogbnVtYmVyXTogbnVtYmVyO1xuICB9ID0gW107XG4gIERWSUV2YWx1YXRpb246IHtcbiAgICBbaXRlcmF0aW9uOiBudW1iZXJdOiBhbnk7XG4gIH0gPSBbXTtcbiAgRFZJRGF0YUxpc3Q6IGFueSA9IFtdO1xuICBEVklBdmFpbGFibGVJdGVyYXRpb246IEFycmF5PG51bWJlcj4gPSBbXTtcbiAgRFZJUHJlZGljYXRlczogYW55W10gPSBbXTtcbiAgaXNfdW5jZXJ0YWludHlfZGl2ZXJzaXR5X3RvdF9leGlzdDoge1xuICAgIFtpdGVyYXRpb246IG51bWJlcl06IGJvb2xlYW47XG4gIH0gPSBbXTtcbiAgRFZJZmlsdGVySW5kaWNlczogbnVtYmVyW107XG4gIHNlbGVjdEluZGljZXM6IG51bWJlcltdO1xuXG5cbiAgc3VwZXJ2aXNlRmFjdG9yOiBudW1iZXI7XG4gIHN1cGVydmlzZUxhYmVsczogc3RyaW5nW107XG4gIHN1cGVydmlzZUlucHV0OiBzdHJpbmcgPSAnJztcbiAgZGltOiBbbnVtYmVyLCBudW1iZXJdID0gWzAsIDBdO1xuICBoYXNUU05FUnVuOiBib29sZWFuID0gZmFsc2U7XG4gIHByaXZhdGUgdHNuZTogVFNORTtcbiAgaGFzVW1hcFJ1biA9IGZhbHNlO1xuICBwcml2YXRlIHVtYXA6IFVNQVA7XG4gIC8qKiBDcmVhdGVzIGEgbmV3IERhdGFzZXQgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgcG9pbnRzOiBEYXRhUG9pbnRbXSxcbiAgICBzcHJpdGVBbmRNZXRhZGF0YUluZm8/OiBTcHJpdGVBbmRNZXRhZGF0YUluZm9cbiAgKSB7XG4gICAgdGhpcy5wb2ludHMgPSBwb2ludHM7XG4gICAgdGhpcy5zaHVmZmxlZERhdGFJbmRpY2VzID0gdXRpbC5zaHVmZmxlKHV0aWwucmFuZ2UodGhpcy5wb2ludHMubGVuZ3RoKSk7XG4gICAgdGhpcy5zZXF1ZW5jZXMgPSB0aGlzLmNvbXB1dGVTZXF1ZW5jZXMocG9pbnRzKTtcbiAgICB0aGlzLmRpbSA9IFt0aGlzLnBvaW50cy5sZW5ndGgsIHRoaXMucG9pbnRzWzBdLnZlY3Rvci5sZW5ndGhdO1xuICAgIHRoaXMuc3ByaXRlQW5kTWV0YWRhdGFJbmZvID0gc3ByaXRlQW5kTWV0YWRhdGFJbmZvO1xuICAgIHRoaXMuRFZJZmlsdGVySW5kaWNlcyA9IFtdO1xuICB9XG4gIHByaXZhdGUgY29tcHV0ZVNlcXVlbmNlcyhwb2ludHM6IERhdGFQb2ludFtdKSB7XG4gICAgLy8gS2VlcCBhIGxpc3Qgb2YgaW5kaWNlcyBzZWVuIHNvIHdlIGRvbid0IGNvbXB1dGUgc2VxdWVuY2VzIGZvciBhIGdpdmVuXG4gICAgLy8gcG9pbnQgdHdpY2UuXG4gICAgbGV0IGluZGljZXNTZWVuID0gbmV3IEludDhBcnJheShwb2ludHMubGVuZ3RoKTtcbiAgICAvLyBDb21wdXRlIHNlcXVlbmNlcy5cbiAgICBsZXQgaW5kZXhUb1NlcXVlbmNlOiB7XG4gICAgICBbaW5kZXg6IG51bWJlcl06IFNlcXVlbmNlO1xuICAgIH0gPSB7fTtcbiAgICBsZXQgc2VxdWVuY2VzOiBTZXF1ZW5jZVtdID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChpbmRpY2VzU2VlbltpXSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGluZGljZXNTZWVuW2ldID0gMTtcbiAgICAgIC8vIElnbm9yZSBwb2ludHMgd2l0aG91dCBhIHNlcXVlbmNlIGF0dHJpYnV0ZS5cbiAgICAgIGxldCBuZXh0ID0gZ2V0U2VxdWVuY2VOZXh0UG9pbnRJbmRleChwb2ludHNbaV0ubWV0YWRhdGEpO1xuICAgICAgaWYgKG5leHQgPT0gbnVsbCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmIChuZXh0IGluIGluZGV4VG9TZXF1ZW5jZSkge1xuICAgICAgICBsZXQgZXhpc3RpbmdTZXF1ZW5jZSA9IGluZGV4VG9TZXF1ZW5jZVtuZXh0XTtcbiAgICAgICAgLy8gUHVzaGluZyBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBhcnJheS5cbiAgICAgICAgZXhpc3RpbmdTZXF1ZW5jZS5wb2ludEluZGljZXMudW5zaGlmdChpKTtcbiAgICAgICAgaW5kZXhUb1NlcXVlbmNlW2ldID0gZXhpc3RpbmdTZXF1ZW5jZTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBUaGUgY3VycmVudCBwb2ludCBpcyBwb2ludGluZyB0byBhIG5ldy91bnNlZW4gc2VxdWVuY2UuXG4gICAgICBsZXQgbmV3U2VxdWVuY2U6IFNlcXVlbmNlID0geyBwb2ludEluZGljZXM6IFtdIH07XG4gICAgICBpbmRleFRvU2VxdWVuY2VbaV0gPSBuZXdTZXF1ZW5jZTtcbiAgICAgIHNlcXVlbmNlcy5wdXNoKG5ld1NlcXVlbmNlKTtcbiAgICAgIGxldCBjdXJyZW50SW5kZXggPSBpO1xuICAgICAgd2hpbGUgKHBvaW50c1tjdXJyZW50SW5kZXhdKSB7XG4gICAgICAgIG5ld1NlcXVlbmNlLnBvaW50SW5kaWNlcy5wdXNoKGN1cnJlbnRJbmRleCk7XG4gICAgICAgIGxldCBuZXh0ID0gZ2V0U2VxdWVuY2VOZXh0UG9pbnRJbmRleChwb2ludHNbY3VycmVudEluZGV4XS5tZXRhZGF0YSk7XG4gICAgICAgIGlmIChuZXh0ICE9IG51bGwpIHtcbiAgICAgICAgICBpbmRpY2VzU2VlbltuZXh0XSA9IDE7XG4gICAgICAgICAgY3VycmVudEluZGV4ID0gbmV4dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjdXJyZW50SW5kZXggPSAtMTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc2VxdWVuY2VzO1xuICB9XG4gIHByb2plY3Rpb25DYW5CZVJlbmRlcmVkKHByb2plY3Rpb246IFByb2plY3Rpb25UeXBlKTogYm9vbGVhbiB7XG4gICAgaWYgKHByb2plY3Rpb24gIT09ICd0c25lJykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnRTTkVJdGVyYXRpb24gPiAwO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgbmV3IHN1YnNldCBkYXRhc2V0IGJ5IGNvcHlpbmcgb3V0IGRhdGEuIFdlIG1ha2UgYSBjb3B5IGJlY2F1c2VcbiAgICogd2UgaGF2ZSB0byBtb2RpZnkgdGhlIHZlY3RvcnMgYnkgbm9ybWFsaXppbmcgdGhlbS5cbiAgICpcbiAgICogQHBhcmFtIHN1YnNldCBBcnJheSBvZiBpbmRpY2VzIG9mIHBvaW50cyB0aGF0IHdlIHdhbnQgaW4gdGhlIHN1YnNldC5cbiAgICpcbiAgICogQHJldHVybiBBIHN1YnNldCBvZiB0aGUgb3JpZ2luYWwgZGF0YXNldC5cbiAgICovXG4gIGdldFN1YnNldChzdWJzZXQ/OiBudW1iZXJbXSk6IERhdGFTZXQge1xuICAgIGNvbnN0IHBvaW50c1N1YnNldCA9XG4gICAgICBzdWJzZXQgIT0gbnVsbCAmJiBzdWJzZXQubGVuZ3RoID4gMFxuICAgICAgICA/IHN1YnNldC5tYXAoKGkpID0+IHRoaXMucG9pbnRzW2ldKVxuICAgICAgICA6IHRoaXMucG9pbnRzO1xuICAgIGxldCBwb2ludHMgPSBwb2ludHNTdWJzZXQubWFwKChkcCkgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbWV0YWRhdGE6IGRwLm1ldGFkYXRhLFxuICAgICAgICBpbmRleDogZHAuaW5kZXgsXG4gICAgICAgIHZlY3RvcjogZHAudmVjdG9yLnNsaWNlKCksXG4gICAgICAgIHByb2plY3Rpb25zOiB7fSBhcyB7XG4gICAgICAgICAgW2tleTogc3RyaW5nXTogbnVtYmVyO1xuICAgICAgICB9LFxuICAgICAgfTtcbiAgICB9KTtcbiAgICBjb25zdCBkcF9saXN0OiBEYXRhUG9pbnRbXSA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBkcDogRGF0YVBvaW50ID0ge1xuICAgICAgICBtZXRhZGF0YTogcG9pbnRzU3Vic2V0W2ldLm1ldGFkYXRhLFxuICAgICAgICBpbmRleDogcG9pbnRzU3Vic2V0W2ldLmluZGV4LFxuICAgICAgICB2ZWN0b3I6IHBvaW50c1tpXS52ZWN0b3IsXG4gICAgICAgIG9yaWdpbmFsX3ZlY3RvcjogcG9pbnRzU3Vic2V0W2ldLnZlY3RvcixcbiAgICAgICAgcHJvamVjdGlvbnM6IHBvaW50c1tpXS5wcm9qZWN0aW9ucyxcbiAgICAgIH07XG4gICAgICBkcF9saXN0LnB1c2goZHApO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IERhdGFTZXQoZHBfbGlzdCwgdGhpcy5zcHJpdGVBbmRNZXRhZGF0YUluZm8pO1xuICB9XG4gIC8qKlxuICAgKiBDb21wdXRlcyB0aGUgY2VudHJvaWQsIHNoaWZ0cyBhbGwgcG9pbnRzIHRvIHRoYXQgY2VudHJvaWQsXG4gICAqIHRoZW4gbWFrZXMgdGhlbSBhbGwgdW5pdCBub3JtLlxuICAgKi9cbiAgbm9ybWFsaXplKCkge1xuICAgIC8vIENvbXB1dGUgdGhlIGNlbnRyb2lkIG9mIGFsbCBkYXRhIHBvaW50cy5cbiAgICBsZXQgY2VudHJvaWQgPSB2ZWN0b3IuY2VudHJvaWQodGhpcy5wb2ludHMsIChhKSA9PiBhLnZlY3Rvcik7XG4gICAgaWYgKGNlbnRyb2lkID09IG51bGwpIHtcbiAgICAgIHRocm93IEVycm9yKCdjZW50cm9pZCBzaG91bGQgbm90IGJlIG51bGwnKTtcbiAgICB9XG4gICAgLy8gU2hpZnQgYWxsIHBvaW50cyBieSB0aGUgY2VudHJvaWQgYW5kIG1ha2UgdGhlbSB1bml0IG5vcm0uXG4gICAgZm9yIChsZXQgaWQgPSAwOyBpZCA8IHRoaXMucG9pbnRzLmxlbmd0aDsgKytpZCkge1xuICAgICAgbGV0IGRhdGFQb2ludCA9IHRoaXMucG9pbnRzW2lkXTtcbiAgICAgIGRhdGFQb2ludC52ZWN0b3IgPSB2ZWN0b3Iuc3ViKGRhdGFQb2ludC52ZWN0b3IsIGNlbnRyb2lkKTtcbiAgICAgIGlmICh2ZWN0b3Iubm9ybTIoZGF0YVBvaW50LnZlY3RvcikgPiAwKSB7XG4gICAgICAgIC8vIElmIHdlIHRha2UgdGhlIHVuaXQgbm9ybSBvZiBhIHZlY3RvciBvZiBhbGwgMHMsIHdlIGdldCBhIHZlY3RvciBvZlxuICAgICAgICAvLyBhbGwgTmFOcy4gV2UgcHJldmVudCB0aGF0IHdpdGggYSBndWFyZC5cbiAgICAgICAgdmVjdG9yLnVuaXQoZGF0YVBvaW50LnZlY3Rvcik7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8qKiBQcm9qZWN0cyB0aGUgZGF0YXNldCBvbnRvIGEgZ2l2ZW4gdmVjdG9yIGFuZCBjYWNoZXMgdGhlIHJlc3VsdC4gKi9cbiAgcHJvamVjdExpbmVhcihkaXI6IHZlY3Rvci5WZWN0b3IsIGxhYmVsOiBzdHJpbmcpIHtcbiAgICB0aGlzLnByb2plY3Rpb25zW2xhYmVsXSA9IHRydWU7XG4gICAgdGhpcy5wb2ludHMuZm9yRWFjaCgoZGF0YVBvaW50KSA9PiB7XG4gICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnNbbGFiZWxdID0gdmVjdG9yLmRvdChkYXRhUG9pbnQudmVjdG9yLCBkaXIpO1xuICAgIH0pO1xuICB9XG4gIHNldERWSUZpbHRlcmVkRGF0YShwb2ludEluZGljZXM6IG51bWJlcltdKSB7XG4gICAgLy8gcmVzZXQgZmlyc3RcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgZGF0YVBvaW50ID0gdGhpcy5wb2ludHNbaV07XG4gICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnNbJ3RzbmUtMCddID0gZGF0YVBvaW50LkRWSV9wcm9qZWN0aW9uc1t0aGlzLnRTTkVJdGVyYXRpb25dWzBdO1xuICAgICAgZGF0YVBvaW50LnByb2plY3Rpb25zWyd0c25lLTEnXSA9IGRhdGFQb2ludC5EVklfcHJvamVjdGlvbnNbdGhpcy50U05FSXRlcmF0aW9uXVsxXTtcbiAgICAgIGRhdGFQb2ludC5wcm9qZWN0aW9uc1sndHNuZS0yJ10gPSAwO1xuICAgIH1cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAocG9pbnRJbmRpY2VzPy5pbmRleE9mKGkpID09IC0xICYmIGkgPCB0aGlzLkRWSUN1cnJlbnRSZWFsRGF0YU51bWJlcikge1xuICAgICAgICBsZXQgZGF0YVBvaW50ID0gdGhpcy5wb2ludHNbaV07XG4gICAgICAgIGRhdGFQb2ludC5wcm9qZWN0aW9ucyA9IHt9O1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLkRWSWZpbHRlckluZGljZXMgPSBwb2ludEluZGljZXM7XG4gIH1cblxuICAvKiogUnVucyBEVkkgb24gdGhlIGRhdGEuICovXG4gIGFzeW5jIHByb2plY3REVkkoXG4gICAgaXRlcmF0aW9uOiBudW1iZXIsIHByZWRpY2F0ZXM6IHsgW2tleTogc3RyaW5nXTogYW55IH0sXG4gICAgc3RlcENhbGxiYWNrOiAoaXRlcjogbnVtYmVyIHwgbnVsbCwgZXZhbHVhdGlvbjogYW55LCBuZXdTZWxlY3Rpb246IGFueVtdLCBmaWx0ZXJJbmRpY2VzOiBudW1iZXJbXSwgdG90YWxJdGVyPzogbnVtYmVyKSA9PiB2b2lkXG4gICkge1xuICAgIHRoaXMucHJvamVjdGlvbnNbJ3RzbmUnXSA9IHRydWU7XG4gICAgZnVuY3Rpb24gY29tcG9uZW50VG9IZXgoYzogbnVtYmVyKSB7XG4gICAgICBjb25zdCBoZXggPSBjLnRvU3RyaW5nKDE2KTtcbiAgICAgIHJldHVybiBoZXgubGVuZ3RoID09IDEgPyBcIjBcIiArIGhleCA6IGhleDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZ2JUb0hleChyOiBudW1iZXIsIGc6IG51bWJlciwgYjogbnVtYmVyKSB7XG4gICAgICByZXR1cm4gXCIjXCIgKyBjb21wb25lbnRUb0hleChyKSArIGNvbXBvbmVudFRvSGV4KGcpICsgY29tcG9uZW50VG9IZXgoYik7XG4gICAgfVxuXG5cbiAgICB0aGlzLml0ZXJhdGlvbkNoYW5nZVJlc2V0KClcbiAgICAvLyB3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbSgnYWNjZXB0SW5kaWNhdGVzJyxcIlwiKVxuICAgIC8vIHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZXRJdGVtKCdyZWplY3RJbmRpY2F0ZXMnLFwiXCIpXG4gICAgd2luZG93LmFjY2VwdEluZGljYXRlcyA9IFtdXG4gICAgd2luZG93LnJlamVjdEluZGljYXRlcyA9IFtdXG5cbiAgICBpZiAodGhpcy5EVklBdmFpbGFibGVJdGVyYXRpb24uaW5kZXhPZihpdGVyYXRpb24pID09IC0xKSB7XG5cbiAgICAgIGxldCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgICAgIGhlYWRlcnMuYXBwZW5kKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgaGVhZGVycy5hcHBlbmQoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAvLyBhd2FpdCBmZXRjaChcInN0YW5kYWxvbmVfcHJvamVjdG9yX2NvbmZpZy5qc29uXCIsIHsgbWV0aG9kOiAnR0VUJyB9KVxuICAgICAgLy8gICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpXG4gICAgICAvLyAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgLy8gICAgIGNvbnN0IGlwX2FkZHJlc3MgPSBkYXRhLkRWSVNlcnZlcklQICsgXCI6XCIgKyBkYXRhLkRWSVNlcnZlclBvcnQ7XG4gICAgICAvLyAgICAgdGhpcy5EVklTZXJ2ZXIgPSBpcF9hZGRyZXNzO1xuXG4gICAgICBpZiAod2luZG93Lm1vZGVsTWF0aCkge1xuICAgICAgICB0aGlzLkRWSXN1YmplY3RNb2RlbFBhdGggPSB3aW5kb3cubW9kZWxNYXRoXG4gICAgICB9XG5cbiAgICAgIHdpbmRvdy5pdGVyYXRpb24gPSBpdGVyYXRpb25cbiAgICAgIGF3YWl0IGZldGNoKFwiaHR0cDovL1wiICsgdGhpcy5EVklTZXJ2ZXIgKyBcIi91cGRhdGVQcm9qZWN0aW9uXCIsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBcInBhdGhcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLmNvbnRlbnRfcGF0aCB8fCB0aGlzLkRWSXN1YmplY3RNb2RlbFBhdGgsIFwiaXRlcmF0aW9uXCI6IGl0ZXJhdGlvbixcbiAgICAgICAgICBcInJlc29sdXRpb25cIjogdGhpcy5EVklSZXNvbHV0aW9uLCBcInByZWRpY2F0ZXNcIjogcHJlZGljYXRlcyxcbiAgICAgICAgICBcInVzZXJuYW1lXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS51c2VybmFtZSxcbiAgICAgICAgICBcInZpc19tZXRob2RcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLnZpc19tZXRob2QsXG4gICAgICAgICAgJ3NldHRpbmcnOndpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZWxlY3RlZFNldHRpbmcsXG4gICAgICAgICAgXCJjb250ZW50X3BhdGhcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLmNvbnRlbnRfcGF0aCB8fCB0aGlzLkRWSXN1YmplY3RNb2RlbFBhdGgsXG4gICAgICAgIH0pLFxuICAgICAgICBoZWFkZXJzOiBoZWFkZXJzLFxuICAgICAgICBtb2RlOiAnY29ycydcbiAgICAgIH0pLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKS50aGVuKGRhdGEgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBkYXRhLnJlc3VsdDtcblxuICAgICAgICBjb25zdCBncmlkX2luZGV4ID0gW1tkYXRhLmdyaWRfaW5kZXhbMF0sIGRhdGEuZ3JpZF9pbmRleFsxXV0sIFtkYXRhLmdyaWRfaW5kZXhbMl0sIGRhdGEuZ3JpZF9pbmRleFszXV1dO1xuICAgICAgICBjb25zdCBncmlkX2NvbG9yID0gW1sxMzcsIDEyMCwgMTE3XSwgWzEzNiwgMTE5LCAxMTZdLCBbMTM2LCAxMTgsIDExNV0sIFsxMzUsIDExNywgMTE0XV07XG4gICAgICAgIGlmICghd2luZG93LnNjZW5lQmFja2dyb3VuZEltZykge1xuICAgICAgICAgIHdpbmRvdy5zY2VuZUJhY2tncm91bmRJbWcgPSBbXVxuICAgICAgICB9XG4gICAgICAgIHdpbmRvdy5zY2VuZUJhY2tncm91bmRJbWdbd2luZG93Lml0ZXJhdGlvbl0gPSBkYXRhLmdyaWRfY29sb3JcbiAgICAgICBsZXQgdGVtcF9sYWJlbF9jb2xvcl9saXN0OmFueSA9IFtdXG4gICAgICAgbGV0IHRlbXBfbGFiZWxfbGlzdDphbnkgPSBbXVxuICAgICAgIGxldCBrPTBcbiAgICAgICAgZm9yKGxldCBpID0gMCA7aSA8IHJlc3VsdC5sZW5ndGgtMTtpKyspe1xuICAgICAgICBcbiAgICAgICAgICBpZiAoZGF0YS5wcm9wZXJ0aWVzW2ldID09PSAwIHx8ICh3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2VsZWN0ZWRTZXR0aW5nICE9PSAnYWN0aXZlIGxlYXJuaW5nJyAmJiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2VsZWN0ZWRTZXR0aW5nICE9PSAnZGVuc2UgYWwnKSkge1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgY29sb3I6YW55ID0gZGF0YS5sYWJlbF9jb2xvcl9saXN0W2tdIHx8IFsyMDQsMjA0LDIwNF1cbiAgICAgICAgICAgIGxldCBsYWJlbDphbnkgPSBkYXRhLmxhYmVsX2xpc3Rba10gfHwgJ3VubGFiZWxlZCdcbiAgICAgICAgICAgIHRlbXBfbGFiZWxfY29sb3JfbGlzdC5wdXNoKGNvbG9yKVxuICAgICAgICAgICAgdGVtcF9sYWJlbF9saXN0LnB1c2gobGFiZWwpXG4gICAgICAgICAgICBrID0gaysxXG4gICAgICAgICAgfSBlbHNle1xuICAgICAgICAgICAgdGVtcF9sYWJlbF9jb2xvcl9saXN0LnB1c2goWzIwNCwyMDQsMjA0XSlcbiAgICAgICAgICAgIHRlbXBfbGFiZWxfbGlzdC5wdXNoKCd1bmxhYmVsZWQnKVxuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgfVxuICBcbiAgICAgICAgY29uc3QgbGFiZWxfY29sb3JfbGlzdCA9IHRlbXBfbGFiZWxfY29sb3JfbGlzdFxuICAgICAgICBjb25zdCBsYWJlbF9saXN0ID0gdGVtcF9sYWJlbF9saXN0O1xuXG4gICAgICAgIGNvbnN0IHByZWRpY3Rpb25fbGlzdCA9IGRhdGEucHJlZGljdGlvbl9saXN0O1xuXG4gICAgICAgIGNvbnN0IGJhY2tncm91bmRfcG9pbnRfbnVtYmVyID0gZ3JpZF9pbmRleC5sZW5ndGg7XG5cbiAgICAgICAgY29uc3QgcmVhbF9kYXRhX251bWJlciA9IGxhYmVsX2NvbG9yX2xpc3QubGVuZ3RoO1xuICAgICAgICB0aGlzLnRTTkVUb3RhbEl0ZXIgPSBkYXRhLm1heGltdW1faXRlcmF0aW9uO1xuICAgICAgICB3aW5kb3cudFNORVRvdGFsSXRlciA9IGRhdGEubWF4aW11bV9pdGVyYXRpb25cblxuICAgICAgICB0aGlzLnRTTkVJdGVyYXRpb24gPSBpdGVyYXRpb247XG4gICAgICAgIHRoaXMuRFZJVmFsaWRQb2ludE51bWJlcltpdGVyYXRpb25dID0gcmVhbF9kYXRhX251bWJlciArIGJhY2tncm91bmRfcG9pbnRfbnVtYmVyO1xuICAgICAgICB0aGlzLkRWSUF2YWlsYWJsZUl0ZXJhdGlvbi5wdXNoKGl0ZXJhdGlvbik7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRfbGVuZ3RoID0gdGhpcy5wb2ludHMubGVuZ3RoO1xuXG4gICAgICAgIGNvbnN0IHRyYWluaW5nX2RhdGEgPSBkYXRhLnRyYWluaW5nX2RhdGE7XG4gICAgICAgIGNvbnN0IHRlc3RpbmdfZGF0YSA9IGRhdGEudGVzdGluZ19kYXRhO1xuICAgICAgICBjb25zdCBuZXdfc2VsZWN0aW9uID0gZGF0YS5uZXdfc2VsZWN0aW9uO1xuICAgICAgICBjb25zdCBub2lzeV9kYXRhID0gZGF0YS5ub2lzeV9kYXRhO1xuICAgICAgICBjb25zdCBvcmlnaW5hbF9sYWJlbF9saXN0ID0gZGF0YS5vcmlnaW5hbF9sYWJlbF9saXN0O1xuXG4gICAgICAgIGNvbnN0IGV2YWx1YXRpb24gPSBkYXRhLmV2YWx1YXRpb247XG4gICAgICAgIHRoaXMuRFZJRXZhbHVhdGlvbltpdGVyYXRpb25dID0gZXZhbHVhdGlvbjtcbiAgICAgICAgY29uc3QgaW52X2FjYyA9IGRhdGEuaW52X2FjY19saXN0IHx8IFtdO1xuICAgICAgICBpZiAoIXdpbmRvdy5wcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgd2luZG93LnByb3BlcnRpZXMgPSBbXVxuICAgICAgICB9XG4gICAgICAgIHdpbmRvdy5wcm9wZXJ0aWVzW2l0ZXJhdGlvbl0gPSBkYXRhLnByb3BlcnRpZXM7XG5cbiAgICAgICAgd2luZG93LnVuTGFiZWxEYXRhID0gW11cbiAgICAgICAgd2luZG93LnRlc3RpbmdEYXRhID0gW11cbiAgICAgICAgd2luZG93LmxhYmVsZWREYXRhID0gW11cblxuICAgICAgICBpZiAoIXdpbmRvdy5ub3dTaG93SW5kaWNhdGVzKSB7XG4gICAgICAgICAgd2luZG93Lm5vd1Nob3dJbmRpY2F0ZXMgPSBbXVxuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5wcm9wZXJ0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5wcm9wZXJ0aWVzW2ldID09PSAxKSB7XG4gICAgICAgICAgICAgIHdpbmRvdy51bkxhYmVsRGF0YS5wdXNoKGkpXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRhdGEucHJvcGVydGllc1tpXSA9PT0gMikge1xuICAgICAgICAgICAgICB3aW5kb3cudGVzdGluZ0RhdGEucHVzaChpKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgd2luZG93LmxhYmVsZWREYXRhLnB1c2goaSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzLnB1c2goaSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuXG4gICAgICAgIGNvbnN0IGZpbHRlckluZGljZXMgPSBkYXRhLnNlbGVjdGVkUG9pbnRzO1xuICAgICAgICBjb25zb2xlLmxvZygncmVhbF9kYXRhX251bWJlciArIGJhY2tncm91bmRfcG9pbnRfbnVtYmVyIC0gY3VycmVudF9sZW5ndGgnLHJlYWxfZGF0YV9udW1iZXIgKyBiYWNrZ3JvdW5kX3BvaW50X251bWJlciAtIGN1cnJlbnRfbGVuZ3RoKVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVhbF9kYXRhX251bWJlciArIGJhY2tncm91bmRfcG9pbnRfbnVtYmVyIC0gY3VycmVudF9sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGNvbnN0IG5ld0RhdGFQb2ludDogRGF0YVBvaW50ID0ge1xuICAgICAgICAgICAgbWV0YWRhdGE6IHsgbGFiZWw6IFwiYmFja2dyb3VuZFwiIH0sXG4gICAgICAgICAgICBpbmRleDogY3VycmVudF9sZW5ndGggKyBpLFxuICAgICAgICAgICAgcHJvamVjdGlvbnM6IHtcbiAgICAgICAgICAgICAgJ3RzbmUtMCc6IDAsXG4gICAgICAgICAgICAgICd0c25lLTEnOiAwLFxuICAgICAgICAgICAgICAndHNuZS0yJzogMFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9O1xuICAgICAgICAgIHRoaXMucG9pbnRzLnB1c2gobmV3RGF0YVBvaW50KTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgbGV0IGRhdGFQb2ludCA9IHRoaXMucG9pbnRzW2ldO1xuICAgICAgICAgIGlmIChkYXRhUG9pbnQuRFZJX3Byb2plY3Rpb25zID09IHVuZGVmaW5lZCB8fCBkYXRhUG9pbnQuRFZJX2NvbG9yID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGF0YVBvaW50LkRWSV9wcm9qZWN0aW9ucyA9IHt9O1xuICAgICAgICAgICAgZGF0YVBvaW50LkRWSV9jb2xvciA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGF0YVBvaW50LnRyYWluaW5nX2RhdGEgPT0gdW5kZWZpbmVkIHx8IGRhdGFQb2ludC50ZXN0aW5nX2RhdGEgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBkYXRhUG9pbnQudHJhaW5pbmdfZGF0YSA9IHt9O1xuICAgICAgICAgICAgZGF0YVBvaW50LnRlc3RpbmdfZGF0YSA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGF0YVBvaW50LnByZWRpY3Rpb24gPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBkYXRhUG9pbnQucHJlZGljdGlvbiA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGF0YVBvaW50Lm5ld19zZWxlY3Rpb24gPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBkYXRhUG9pbnQubmV3X3NlbGVjdGlvbiA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGF0YVBvaW50Lmludl9hY2MgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBkYXRhUG9pbnQuaW52X2FjYyA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGF0YVBvaW50LnVuY2VydGFpbnR5ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGF0YVBvaW50LnVuY2VydGFpbnR5ID0ge307XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChkYXRhUG9pbnQudW5jZXJ0YWludHlfcmFua2luZyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGRhdGFQb2ludC51bmNlcnRhaW50eV9yYW5raW5nID0ge307XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChkYXRhUG9pbnQuZGl2ZXJzaXR5ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGF0YVBvaW50LmRpdmVyc2l0eSA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGF0YVBvaW50LmRpdmVyc2l0eV9yYW5raW5nID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGF0YVBvaW50LmRpdmVyc2l0eV9yYW5raW5nID0ge307XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChkYXRhUG9pbnQudG90ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGF0YVBvaW50LnRvdCA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGF0YVBvaW50LnRvdF9yYW5raW5nID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGF0YVBvaW50LnRvdF9yYW5raW5nID0ge307XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZWFsX2RhdGFfbnVtYmVyOyBpKyspIHtcbiAgICAgICAgICBsZXQgZGF0YVBvaW50ID0gdGhpcy5wb2ludHNbaV07XG4gICAgICAgICAgZGF0YVBvaW50LnByb2plY3Rpb25zWyd0c25lLTAnXSA9IHJlc3VsdFtpXVswXTtcbiAgICAgICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnNbJ3RzbmUtMSddID0gcmVzdWx0W2ldWzFdO1xuICAgICAgICAgIGRhdGFQb2ludC5wcm9qZWN0aW9uc1sndHNuZS0yJ10gPSAwO1xuICAgICAgICAgIGlmICh3aW5kb3cudW5MYWJlbERhdGE/Lmxlbmd0aCAmJiB3aW5kb3cudW5MYWJlbERhdGEuaW5kZXhPZihpKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIC8vIGxhYmVsX2NvbG9yX2xpc3RbaV0gPSBbMjA0LCAyMDQsIDIwNF1cbiAgICAgICAgICAgIGRhdGFQb2ludC5jb2xvciA9IHJnYlRvSGV4KDIwNCwgMjA0LCAyMDQpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkYXRhUG9pbnQuY29sb3IgPSByZ2JUb0hleChsYWJlbF9jb2xvcl9saXN0W2ldWzBdLCBsYWJlbF9jb2xvcl9saXN0W2ldWzFdLCBsYWJlbF9jb2xvcl9saXN0W2ldWzJdKTtcbiAgICAgICAgICB9XG5cblxuICAgICAgICAgIGRhdGFQb2ludC5EVklfcHJvamVjdGlvbnNbaXRlcmF0aW9uXSA9IFtyZXN1bHRbaV1bMF0sIHJlc3VsdFtpXVsxXV07XG4gICAgICAgICAgZGF0YVBvaW50LkRWSV9jb2xvcltpdGVyYXRpb25dID0gZGF0YVBvaW50LmNvbG9yO1xuICAgICAgICAgIGRhdGFQb2ludC50cmFpbmluZ19kYXRhW2l0ZXJhdGlvbl0gPSBmYWxzZTtcbiAgICAgICAgICBkYXRhUG9pbnQudGVzdGluZ19kYXRhW2l0ZXJhdGlvbl0gPSBmYWxzZTtcbiAgICAgICAgICBkYXRhUG9pbnQuY3VycmVudF90cmFpbmluZyA9IGZhbHNlO1xuICAgICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3Rlc3RpbmcgPSBmYWxzZTtcbiAgICAgICAgICBkYXRhUG9pbnQubWV0YWRhdGFbJ2xhYmVsJ10gPSBsYWJlbF9saXN0W2ldO1xuICAgICAgICAgIGRhdGFQb2ludC5wcmVkaWN0aW9uW2l0ZXJhdGlvbl0gPSBwcmVkaWN0aW9uX2xpc3RbaV07XG4gICAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfcHJlZGljdGlvbiA9IHByZWRpY3Rpb25fbGlzdFtpXTtcbiAgICAgICAgICBkYXRhUG9pbnQuaW52X2FjY1tpdGVyYXRpb25dID0gaW52X2FjY1tpXTtcbiAgICAgICAgICBkYXRhUG9pbnQuY3VycmVudF9pbnZfYWNjID0gaW52X2FjY1tpXTtcbiAgICAgICAgICBpZiAocHJlZGljdGlvbl9saXN0W2ldID09IGxhYmVsX2xpc3RbaV0pIHtcbiAgICAgICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3dyb25nX3ByZWRpY3Rpb24gPSBmYWxzZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfd3JvbmdfcHJlZGljdGlvbiA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGRhdGFQb2ludC5uZXdfc2VsZWN0aW9uW2l0ZXJhdGlvbl0gPSBmYWxzZTtcbiAgICAgICAgICBkYXRhUG9pbnQuY3VycmVudF9uZXdfc2VsZWN0aW9uID0gZmFsc2U7XG4gICAgICAgICAgaWYgKG9yaWdpbmFsX2xhYmVsX2xpc3QpIHtcbiAgICAgICAgICAgIGRhdGFQb2ludC5vcmlnaW5hbF9sYWJlbCA9IG9yaWdpbmFsX2xhYmVsX2xpc3RbaV07XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZGF0YVBvaW50Lm5vaXN5ID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJhY2tncm91bmRfcG9pbnRfbnVtYmVyOyBpKyspIHtcbiAgICAgICAgICBsZXQgZGF0YVBvaW50ID0gdGhpcy5wb2ludHNbaSArIHJlYWxfZGF0YV9udW1iZXJdO1xuICAgICAgICAgIGRhdGFQb2ludC5wcm9qZWN0aW9uc1sndHNuZS0wJ10gPSBncmlkX2luZGV4W2ldWzBdO1xuICAgICAgICAgIGRhdGFQb2ludC5wcm9qZWN0aW9uc1sndHNuZS0xJ10gPSBncmlkX2luZGV4W2ldWzFdO1xuICAgICAgICAgIGRhdGFQb2ludC5wcm9qZWN0aW9uc1sndHNuZS0yJ10gPSAwO1xuICAgICAgICAgIGRhdGFQb2ludC5jb2xvciA9IHJnYlRvSGV4KGdyaWRfY29sb3JbaV1bMF0sIGdyaWRfY29sb3JbaV1bMV0sIGdyaWRfY29sb3JbaV1bMl0pO1xuICAgICAgICAgIGRhdGFQb2ludC5EVklfcHJvamVjdGlvbnNbaXRlcmF0aW9uXSA9IFtncmlkX2luZGV4W2ldWzBdLCBncmlkX2luZGV4W2ldWzFdXTtcbiAgICAgICAgICBkYXRhUG9pbnQuRFZJX2NvbG9yW2l0ZXJhdGlvbl0gPSBkYXRhUG9pbnQuY29sb3I7XG4gICAgICAgICAgZGF0YVBvaW50LnRyYWluaW5nX2RhdGFbaXRlcmF0aW9uXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICBkYXRhUG9pbnQudGVzdGluZ19kYXRhW2l0ZXJhdGlvbl0gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfdHJhaW5pbmcgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfdGVzdGluZyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICBkYXRhUG9pbnQucHJlZGljdGlvbltpdGVyYXRpb25dID0gXCJiYWNrZ3JvdW5kXCI7XG4gICAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfcHJlZGljdGlvbiA9IFwiYmFja2dyb3VuZFwiO1xuICAgICAgICAgIGRhdGFQb2ludC5pbnZfYWNjW2l0ZXJhdGlvbl0gPSAwO1xuICAgICAgICAgIGRhdGFQb2ludC5jdXJyZW50X2ludl9hY2MgPSAwO1xuICAgICAgICAgIGRhdGFQb2ludC5jdXJyZW50X25ld19zZWxlY3Rpb24gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgLy8gZGF0YVBvaW50Lm5ld19zZWxlY3Rpb25baXRlcmF0aW9uXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICBkYXRhUG9pbnQuY3VycmVudF93cm9uZ19wcmVkaWN0aW9uID0gdW5kZWZpbmVkO1xuICAgICAgICAgIGRhdGFQb2ludC5vcmlnaW5hbF9sYWJlbCA9IFwiYmFja2dyb3VuZFwiO1xuICAgICAgICAgIGRhdGFQb2ludC5ub2lzeSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSByZWFsX2RhdGFfbnVtYmVyICsgYmFja2dyb3VuZF9wb2ludF9udW1iZXI7IGkgPCB0aGlzLnBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGxldCBkYXRhUG9pbnQgPSB0aGlzLnBvaW50c1tpXTtcbiAgICAgICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnMgPSB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHJhaW5pbmdfZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGNvbnN0IGRhdGFJbmRleCA9IHRyYWluaW5nX2RhdGFbaV07XG4gICAgICAgICAgbGV0IGRhdGFQb2ludCA9IHRoaXMucG9pbnRzW2RhdGFJbmRleF07XG4gICAgICAgICAgZGF0YVBvaW50LnRyYWluaW5nX2RhdGFbaXRlcmF0aW9uXSA9IHRydWU7XG4gICAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfdHJhaW5pbmcgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZXN0aW5nX2RhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBkYXRhSW5kZXggPSB0ZXN0aW5nX2RhdGFbaV07XG4gICAgICAgICAgbGV0IGRhdGFQb2ludCA9IHRoaXMucG9pbnRzW2RhdGFJbmRleF07XG4gICAgICAgICAgZGF0YVBvaW50LnRlc3RpbmdfZGF0YVtpdGVyYXRpb25dID0gdHJ1ZTtcbiAgICAgICAgICBkYXRhUG9pbnQuY3VycmVudF90ZXN0aW5nID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuRFZJQ3VycmVudFJlYWxEYXRhTnVtYmVyID0gcmVhbF9kYXRhX251bWJlcjtcbiAgICAgICAgdGhpcy5EVklSZWFsRGF0YU51bWJlcltpdGVyYXRpb25dID0gcmVhbF9kYXRhX251bWJlcjtcbiAgICAgICAgdGhpcy5EVklmaWx0ZXJJbmRpY2VzID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVhbF9kYXRhX251bWJlciArIGJhY2tncm91bmRfcG9pbnRfbnVtYmVyOyBpKyspIHtcbiAgICAgICAgICB0aGlzLkRWSWZpbHRlckluZGljZXMucHVzaChpKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLkRWSURhdGFMaXN0W2l0ZXJhdGlvbl0gPSB0aGlzLnBvaW50c1xuICAgICAgICB3aW5kb3cuRFZJRGF0YUxpc3QgPSB0aGlzLkRWSURhdGFMaXN0XG5cbiAgICAgICAgc3RlcENhbGxiYWNrKHRoaXMudFNORUl0ZXJhdGlvbiwgZXZhbHVhdGlvbiwgbmV3X3NlbGVjdGlvbiwgZmlsdGVySW5kaWNlcywgdGhpcy50U05FVG90YWxJdGVyKTtcbiAgICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgICAgICBsb2dnaW5nLnNldEVycm9yTWVzc2FnZSgnZXJyb3InKTtcbiAgICAgICAgc3RlcENhbGxiYWNrKG51bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGwpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB2YWxpZERhdGFOdW1iZXIgPSB0aGlzLkRWSVZhbGlkUG9pbnROdW1iZXJbaXRlcmF0aW9uXTtcbiAgICAgIGNvbnN0IGV2YWx1YXRpb24gPSB0aGlzLkRWSUV2YWx1YXRpb25baXRlcmF0aW9uXTtcbiAgICAgIHRoaXMudFNORUl0ZXJhdGlvbiA9IGl0ZXJhdGlvbjtcblxuICAgICAgd2luZG93Lml0ZXJhdGlvbiA9IGl0ZXJhdGlvblxuXG4gICAgICBjb25zdCBuZXdTZWxlY3Rpb24gPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsaWREYXRhTnVtYmVyOyBpKyspIHtcbiAgICAgICAgbGV0IGRhdGFQb2ludCA9IHRoaXMucG9pbnRzW2ldO1xuICAgICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnNbJ3RzbmUtMCddID0gZGF0YVBvaW50LkRWSV9wcm9qZWN0aW9uc1tpdGVyYXRpb25dWzBdO1xuICAgICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnNbJ3RzbmUtMSddID0gZGF0YVBvaW50LkRWSV9wcm9qZWN0aW9uc1tpdGVyYXRpb25dWzFdO1xuICAgICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnNbJ3RzbmUtMiddID0gMDtcbiAgICAgICAgZGF0YVBvaW50LmNvbG9yID0gZGF0YVBvaW50LkRWSV9jb2xvcltpdGVyYXRpb25dO1xuICAgICAgICBkYXRhUG9pbnQuY3VycmVudF90cmFpbmluZyA9IGRhdGFQb2ludC50cmFpbmluZ19kYXRhW2l0ZXJhdGlvbl07XG4gICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3Rlc3RpbmcgPSBkYXRhUG9pbnQudGVzdGluZ19kYXRhW2l0ZXJhdGlvbl07XG4gICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3ByZWRpY3Rpb24gPSBkYXRhUG9pbnQucHJlZGljdGlvbltpdGVyYXRpb25dO1xuICAgICAgICBkYXRhUG9pbnQuY3VycmVudF9pbnZfYWNjID0gZGF0YVBvaW50Lmludl9hY2NbaXRlcmF0aW9uXTtcbiAgICAgICAgaWYgKGRhdGFQb2ludC5jdXJyZW50X3ByZWRpY3Rpb24gPT0gZGF0YVBvaW50Lm1ldGFkYXRhWydsYWJlbCddICYmIGRhdGFQb2ludC5tZXRhZGF0YVsnbGFiZWwnXSAhPSBcImJhY2tncm91bmRcIikge1xuICAgICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3dyb25nX3ByZWRpY3Rpb24gPSBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoZGF0YVBvaW50Lm1ldGFkYXRhWydsYWJlbCddICE9IFwiYmFja2dyb3VuZFwiKSB7XG4gICAgICAgICAgICBkYXRhUG9pbnQuY3VycmVudF93cm9uZ19wcmVkaWN0aW9uID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfd3JvbmdfcHJlZGljdGlvbiA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGF0YVBvaW50LmN1cnJlbnRfbmV3X3NlbGVjdGlvbiA9IGRhdGFQb2ludC5uZXdfc2VsZWN0aW9uW2l0ZXJhdGlvbl07XG4gICAgICAgIC8vIGlmIChkYXRhUG9pbnQuY3VycmVudF9uZXdfc2VsZWN0aW9uKSB7XG4gICAgICAgIC8vICAgbmV3U2VsZWN0aW9uLnB1c2goaSk7XG4gICAgICAgIC8vIH1cbiAgICAgICAgLy8gaWYgKHRoaXMuaXNfdW5jZXJ0YWludHlfZGl2ZXJzaXR5X3RvdF9leGlzdFtpdGVyYXRpb25dKSB7XG4gICAgICAgIC8vICAgZGF0YVBvaW50Lm1ldGFkYXRhWyd1bmNlcnRhaW50eSddID0gZGF0YVBvaW50LnVuY2VydGFpbnR5W2l0ZXJhdGlvbl07XG4gICAgICAgIC8vICAgZGF0YVBvaW50Lm1ldGFkYXRhWydkaXZlcnNpdHknXSA9IGRhdGFQb2ludC5kaXZlcnNpdHlbaXRlcmF0aW9uXTtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQubWV0YWRhdGFbJ3RvdCddID0gZGF0YVBvaW50LnRvdFtpdGVyYXRpb25dO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC5jdXJyZW50X3VuY2VydGFpbnR5X3JhbmtpbmcgPSBkYXRhUG9pbnQudW5jZXJ0YWludHlfcmFua2luZ1tpdGVyYXRpb25dO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC5jdXJyZW50X2RpdmVyc2l0eV9yYW5raW5nID0gZGF0YVBvaW50LmRpdmVyc2l0eV9yYW5raW5nW2l0ZXJhdGlvbl07XG4gICAgICAgIC8vICAgZGF0YVBvaW50LmN1cnJlbnRfdG90X3JhbmtpbmcgPSBkYXRhUG9pbnQudG90X3JhbmtpbmdbaXRlcmF0aW9uXTtcbiAgICAgICAgLy8gfVxuICAgICAgfVxuICAgICAgZm9yIChsZXQgaSA9IHZhbGlkRGF0YU51bWJlcjsgaSA8IHRoaXMucG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxldCBkYXRhUG9pbnQgPSB0aGlzLnBvaW50c1tpXTtcbiAgICAgICAgZGF0YVBvaW50LnByb2plY3Rpb25zID0ge307XG4gICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3Rlc3RpbmcgPSBmYWxzZTtcbiAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfdHJhaW5pbmcgPSBmYWxzZTtcbiAgICAgIH1cbiAgICAgIC8vIGNvbnN0IG1hdGNoZXMgPSB0aGlzLmdldF9tYXRjaCgpO1xuICAgICAgLy8gZm9yIChsZXQgaSA9IDA7IGkgPCB2YWxpZERhdGFOdW1iZXI7IGkrKykge1xuICAgICAgLy8gICBsZXQgZGF0YVBvaW50ID0gdGhpcy5wb2ludHNbaV07XG4gICAgICAvLyAgIGlmIChtYXRjaGVzLmluZGV4T2YoaSkgPT0gLTEgJiYgaSA8IHRoaXMuRFZJQ3VycmVudFJlYWxEYXRhTnVtYmVyKSB7XG4gICAgICAvLyAgICAgZGF0YVBvaW50LnByb2plY3Rpb25zID0ge31cbiAgICAgIC8vICAgfVxuICAgICAgLy8gfVxuICAgICAgdGhpcy5EVklDdXJyZW50UmVhbERhdGFOdW1iZXIgPSB0aGlzLkRWSVJlYWxEYXRhTnVtYmVyW2l0ZXJhdGlvbl07XG4gICAgICB0aGlzLkRWSWZpbHRlckluZGljZXMgPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5EVklDdXJyZW50UmVhbERhdGFOdW1iZXIgKyBNYXRoLnBvdyh0aGlzLkRWSVJlc29sdXRpb24sIDIpOyBpKyspIHtcbiAgICAgICAgdGhpcy5EVklmaWx0ZXJJbmRpY2VzLnB1c2goaSk7XG4gICAgICB9XG4gICAgICBsZXQgaGVhZGVycyA9IG5ldyBIZWFkZXJzKCk7XG4gICAgICBoZWFkZXJzLmFwcGVuZCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgIGhlYWRlcnMuYXBwZW5kKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgYXdhaXQgZmV0Y2goYGh0dHA6Ly8ke3RoaXMuRFZJU2VydmVyfS9xdWVyeWAsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBcInByZWRpY2F0ZXNcIjogcHJlZGljYXRlcywgXCJjb250ZW50X3BhdGhcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLmNvbnRlbnRfcGF0aCB8fCB0aGlzLkRWSXN1YmplY3RNb2RlbFBhdGgsXG4gICAgICAgICAgXCJpdGVyYXRpb25cIjogaXRlcmF0aW9uLFwidXNlcm5hbWVcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLnVzZXJuYW1lLCBcInZpc19tZXRob2RcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLnZpc19tZXRob2QsJ3NldHRpbmcnOndpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZWxlY3RlZFNldHRpbmdcbiAgICAgICAgfSksXG4gICAgICAgIGhlYWRlcnM6IGhlYWRlcnMsXG4gICAgICAgIG1vZGU6ICdjb3JzJ1xuICAgICAgfSkudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgIGNvbnN0IGluZGljZXMgPSBkYXRhLnNlbGVjdGVkUG9pbnRzO1xuICAgICAgICBzdGVwQ2FsbGJhY2sodGhpcy50U05FSXRlcmF0aW9uLCBldmFsdWF0aW9uLCBuZXdTZWxlY3Rpb24sIGluZGljZXMsIHRoaXMudFNORVRvdGFsSXRlcik7XG4gICAgICB9KS5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgIGxvZ2dpbmcuc2V0RXJyb3JNZXNzYWdlKCdxdWVyeWluZyBmb3IgaW5kaWNlcycpO1xuICAgICAgICBzdGVwQ2FsbGJhY2sobnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuXG4gIC8qKiBSdW5zIERWSSBvbiB0aGUgZGF0YS4gKi9cbiAgYXN5bmMgcmVUcmFpbkJ5RFZJKFxuICAgIGl0ZXJhdGlvbjogbnVtYmVyLCBuZXdJbmRpY2VzOiBudW1iZXJbXSwgcmVqZWN0aW9uOiBudW1iZXJbXSxcbiAgICBzdGVwQ2FsbGJhY2s6IChpdGVyOiBudW1iZXIgfCBudWxsLCBldmFsdWF0aW9uOiBhbnksIG5ld1NlbGVjdGlvbjogYW55W10sIGZpbHRlckluZGljZXM6IG51bWJlcltdLCB0b3RhbEl0ZXI/OiBudW1iZXIpID0+IHZvaWRcbiAgKSB7XG4gICAgdGhpcy5wcm9qZWN0aW9uc1sndHNuZSddID0gdHJ1ZTtcbiAgICBmdW5jdGlvbiBjb21wb25lbnRUb0hleChjOiBudW1iZXIpIHtcbiAgICAgIGNvbnN0IGhleCA9IGMudG9TdHJpbmcoMTYpO1xuICAgICAgcmV0dXJuIGhleC5sZW5ndGggPT0gMSA/IFwiMFwiICsgaGV4IDogaGV4O1xuICAgIH1cblxuXG4gICAgdGhpcy5pdGVyYXRpb25DaGFuZ2VSZXNldCgpXG5cbiAgICBmdW5jdGlvbiByZ2JUb0hleChyOiBudW1iZXIsIGc6IG51bWJlciwgYjogbnVtYmVyKSB7XG4gICAgICByZXR1cm4gXCIjXCIgKyBjb21wb25lbnRUb0hleChyKSArIGNvbXBvbmVudFRvSGV4KGcpICsgY29tcG9uZW50VG9IZXgoYik7XG4gICAgfVxuICAgIGxldCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAvLyBhd2FpdCBmZXRjaChcInN0YW5kYWxvbmVfcHJvamVjdG9yX2NvbmZpZy5qc29uXCIsIHsgbWV0aG9kOiAnR0VUJyB9KVxuICAgIC8vICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKVxuICAgIC8vICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgLy8gICAgIGNvbnN0IGlwX2FkZHJlc3MgPSBkYXRhLkRWSVNlcnZlcklQICsgXCI6XCIgKyBkYXRhLkRWSVNlcnZlclBvcnQ7XG4gICAgLy8gICAgIHRoaXMuRFZJU2VydmVyID0gaXBfYWRkcmVzcztcbiAgICBpZiAod2luZG93Lm1vZGVsTWF0aCkge1xuICAgICAgdGhpcy5EVklzdWJqZWN0TW9kZWxQYXRoID0gd2luZG93Lm1vZGVsTWF0aFxuICAgIH1cbiAgICBsZXQgaW5kaWNlcyA9IFtdXG4gICAgaWYod2luZG93LmFjY2VwdEluZGljYXRlcyl7XG4gICAgICBpbmRpY2VzID0gd2luZG93LmFjY2VwdEluZGljYXRlcy5maWx0ZXIoKGl0ZW0sIGksIGFycikgPT4ge1xuICAgICAgICAvL+WHveaVsOiHqui6q+i/lOWbnueahOaYr+S4gOS4quW4g+WwlOWAvO+8jOWPquW9k+i/lOWbnuWAvOS4unRydWXml7bvvIzlvZPliY3lhYPntKDmiY3kvJrlrZjlhaXmlrDnmoTmlbDnu4TkuK3jgIIgICAgICAgICAgICBcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dW2l0ZW1dID09PSAxXG4gICAgICB9KVxuICAgIH1cbiAgICBsZXQgcmVqSW5kaWNlcyA9IFtdXG4gICAgaWYod2luZG93LnJlamVjdEluZGljYXRlcyl7XG4gICAgICByZWpJbmRpY2VzID0gd2luZG93LnJlamVjdEluZGljYXRlcy5maWx0ZXIoKGl0ZW0sIGksIGFycikgPT4ge1xuICAgICAgICAvL+WHveaVsOiHqui6q+i/lOWbnueahOaYr+S4gOS4quW4g+WwlOWAvO+8jOWPquW9k+i/lOWbnuWAvOS4unRydWXml7bvvIzlvZPliY3lhYPntKDmiY3kvJrlrZjlhaXmlrDnmoTmlbDnu4TkuK3jgIIgICAgICAgICAgICBcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dW2l0ZW1dID09PSAxXG4gICAgICB9KVxuICAgIH1cblxuICAgIGxldCB0aGF0ID0gdGhpc1xuXG4gICAgYXdhaXQgZmV0Y2goXCJodHRwOi8vXCIgKyB0aGlzLkRWSVNlcnZlciArIFwiL2FsX3RyYWluXCIsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBcIml0ZXJhdGlvblwiOiB0aGlzLnRTTkVJdGVyYXRpb24sXG4gICAgICAgIFwiYWNjSW5kaWNlc1wiOiBpbmRpY2VzLFxuICAgICAgICBcInJlakluZGljZXNcIjogcmVqSW5kaWNlcyxcbiAgICAgICAgXCJjb250ZW50X3BhdGhcIjogdGhpcy5EVklzdWJqZWN0TW9kZWxQYXRoLFxuICAgICAgICBcInVzZXJuYW1lXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS51c2VybmFtZVxuICAgICAgfSksXG4gICAgICBoZWFkZXJzOiBoZWFkZXJzLFxuICAgICAgbW9kZTogJ2NvcnMnXG4gICAgfSkudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpLnRoZW4oZGF0YSA9PiB7XG4gICAgICBpdGVyYXRpb24gPSBkYXRhLm1heGltdW1faXRlcmF0aW9uXG4gICAgICB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzID0gW11cbiAgICAgIHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMgPSBbXVxuICAgICAgd2luZG93LnNlc3Npb25TdG9yYWdlLnNldEl0ZW0oJ2FjY2VwdEluZGljYXRlcycsIFwiXCIpXG4gICAgICB3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbSgncmVqZWN0SW5kaWNhdGVzJywgXCJcIilcblxuICAgICAgd2luZG93Lml0ZXJhdGlvbiA9IGl0ZXJhdGlvblxuICAgICAgY29uc3QgcmVzdWx0ID0gZGF0YS5yZXN1bHQ7XG4gICAgICBjb25zdCBncmlkX2luZGV4ID0gW1tkYXRhLmdyaWRfaW5kZXhbMF0sIGRhdGEuZ3JpZF9pbmRleFsxXV0sIFtkYXRhLmdyaWRfaW5kZXhbMl0sIGRhdGEuZ3JpZF9pbmRleFszXV1dO1xuICAgICAgY29uc3QgZ3JpZF9jb2xvciA9IFtbMTM3LCAxMjAsIDExN10sIFsxMzYsIDExOSwgMTE2XSwgWzEzNiwgMTE4LCAxMTVdLCBbMTM1LCAxMTcsIDExNF1dO1xuICAgICAgd2luZG93LnNjZW5lQmFja2dyb3VuZEltZ1t3aW5kb3cuaXRlcmF0aW9uXSA9IGRhdGEuZ3JpZF9jb2xvclxuICAgICAgbGV0IGsgPSAwO1xuICAgICAgbGV0IHRlbXBfbGFiZWxfY29sb3JfbGlzdDphbnkgPSBbXVxuICAgICAgbGV0IHRlbXBfbGFiZWxfbGlzdDphbnkgPSBbXVxuICAgICAgZm9yKGxldCBpID0gMCA7aSA8IHJlc3VsdC5sZW5ndGgtMTtpKyspe1xuICAgICAgICBcbiAgICAgICAgaWYgKGRhdGEucHJvcGVydGllc1tpXSA9PT0gMCkge1xuICAgICAgICAgIGxldCBjb2xvcjphbnkgPSBkYXRhLmxhYmVsX2NvbG9yX2xpc3Rba10gfHwgWzIwNCwyMDQsMjA0XVxuICAgICAgICAgIGxldCBsYWJlbDphbnkgPSBkYXRhLmxhYmVsX2xpc3Rba10gfHwgJ3VubGFiZWxlZCdcbiAgICAgICAgICB0ZW1wX2xhYmVsX2NvbG9yX2xpc3QucHVzaChjb2xvcilcbiAgICAgICAgICB0ZW1wX2xhYmVsX2xpc3QucHVzaChsYWJlbClcbiAgICAgICAgICBrICsgaysxXG4gICAgICAgIH0gZWxzZXtcbiAgICAgICAgICB0ZW1wX2xhYmVsX2NvbG9yX2xpc3QucHVzaChbMjA0LDIwNCwyMDRdKVxuICAgICAgICAgIHRlbXBfbGFiZWxfbGlzdC5wdXNoKCd1bmxhYmVsZWQnKVxuICAgICAgICB9ICBcbiAgICAgICAgXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGxhYmVsX2NvbG9yX2xpc3QgPSB0ZW1wX2xhYmVsX2NvbG9yX2xpc3RcbiAgICAgIGNvbnN0IGxhYmVsX2xpc3QgPSB0ZW1wX2xhYmVsX2xpc3Q7XG4gICAgICBjb25zb2xlLmxvZygnbGFiZWxfY29sb3JfbGlzdC5sZW5ndGgnLGxhYmVsX2NvbG9yX2xpc3QubGVuZ3RoKVxuICAgICAgY29uc3QgcHJlZGljdGlvbl9saXN0ID0gZGF0YS5wcmVkaWN0aW9uX2xpc3Q7XG5cbiAgICAgIGNvbnN0IGJhY2tncm91bmRfcG9pbnRfbnVtYmVyID0gZ3JpZF9pbmRleC5sZW5ndGg7XG5cbiAgICAgIGNvbnN0IHJlYWxfZGF0YV9udW1iZXIgPSBsYWJlbF9jb2xvcl9saXN0Lmxlbmd0aDtcbiAgICAgIHRoaXMudFNORVRvdGFsSXRlciA9IGRhdGEubWF4aW11bV9pdGVyYXRpb247XG4gICAgICB3aW5kb3cudFNORVRvdGFsSXRlciA9IGRhdGEubWF4aW11bV9pdGVyYXRpb247XG5cbiAgICAgIHRoaXMudFNORUl0ZXJhdGlvbiA9IGl0ZXJhdGlvbjtcbiAgICAgIHRoaXMuRFZJVmFsaWRQb2ludE51bWJlcltpdGVyYXRpb25dID0gcmVhbF9kYXRhX251bWJlciArIGJhY2tncm91bmRfcG9pbnRfbnVtYmVyO1xuICAgICAgdGhpcy5EVklBdmFpbGFibGVJdGVyYXRpb24ucHVzaChpdGVyYXRpb24pO1xuICAgICAgY29uc3QgY3VycmVudF9sZW5ndGggPSB0aGlzLnBvaW50cy5sZW5ndGg7XG5cbiAgICAgIGNvbnN0IHRyYWluaW5nX2RhdGEgPSBkYXRhLnRyYWluaW5nX2RhdGE7XG4gICAgICBjb25zdCB0ZXN0aW5nX2RhdGEgPSBkYXRhLnRlc3RpbmdfZGF0YTtcbiAgICAgIGNvbnN0IG5ld19zZWxlY3Rpb24gPSBkYXRhLm5ld19zZWxlY3Rpb247XG4gICAgICBjb25zdCBub2lzeV9kYXRhID0gZGF0YS5ub2lzeV9kYXRhO1xuICAgICAgY29uc3Qgb3JpZ2luYWxfbGFiZWxfbGlzdCA9IGRhdGEub3JpZ2luYWxfbGFiZWxfbGlzdDtcblxuICAgICAgY29uc3QgZXZhbHVhdGlvbiA9IGRhdGEuZXZhbHVhdGlvbjtcbiAgICAgIHRoaXMuRFZJRXZhbHVhdGlvbltpdGVyYXRpb25dID0gZXZhbHVhdGlvbjtcbiAgICAgIGNvbnN0IGludl9hY2MgPSBkYXRhLmludl9hY2NfbGlzdCB8fCBbXTtcblxuICAgICAgaWYgKCF3aW5kb3cucHJvcGVydGllcykge1xuICAgICAgICB3aW5kb3cucHJvcGVydGllcyA9IFtdXG4gICAgICB9XG4gICAgICB3aW5kb3cucHJvcGVydGllc1tpdGVyYXRpb25dID0gZGF0YS5wcm9wZXJ0aWVzO1xuXG4gICAgICB3aW5kb3cudW5MYWJlbERhdGEgPSBbXVxuICAgICAgd2luZG93LnRlc3RpbmdEYXRhID0gW11cbiAgICAgIHdpbmRvdy5sYWJlbGVkRGF0YSA9IFtdXG4gICAgICBpZiAoIXdpbmRvdy5ub3dTaG93SW5kaWNhdGVzKSB7XG4gICAgICAgIHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzID0gW11cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEucHJvcGVydGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmIChkYXRhLnByb3BlcnRpZXNbaV0gPT09IDEpIHtcbiAgICAgICAgICAgIHdpbmRvdy51bkxhYmVsRGF0YS5wdXNoKGkpXG4gICAgICAgICAgfSBlbHNlIGlmIChkYXRhLnByb3BlcnRpZXNbaV0gPT09IDIpIHtcbiAgICAgICAgICAgIHdpbmRvdy50ZXN0aW5nRGF0YS5wdXNoKGkpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHdpbmRvdy5sYWJlbGVkRGF0YS5wdXNoKGkpXG4gICAgICAgICAgfVxuICAgICAgICAgIHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzLnB1c2goaSlcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBjb25zdCBpc191bmNlcnRhaW50eV9kaXZlcnNpdHlfdG90X2V4aXN0ID0gZGF0YS51bmNlcnRhaW50eV9kaXZlcnNpdHlfdG90Py5pc19leGlzdDtcbiAgICAgIC8vIHRoaXMuaXNfdW5jZXJ0YWludHlfZGl2ZXJzaXR5X3RvdF9leGlzdFtpdGVyYXRpb25dID0gaXNfdW5jZXJ0YWludHlfZGl2ZXJzaXR5X3RvdF9leGlzdDtcblxuICAgICAgY29uc3QgZmlsdGVySW5kaWNlcyA9IGRhdGEuc2VsZWN0ZWRQb2ludHM7XG5cblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZWFsX2RhdGFfbnVtYmVyICsgYmFja2dyb3VuZF9wb2ludF9udW1iZXIgLSBjdXJyZW50X2xlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IG5ld0RhdGFQb2ludDogRGF0YVBvaW50ID0ge1xuICAgICAgICAgIG1ldGFkYXRhOiB7IGxhYmVsOiBcImJhY2tncm91bmRcIiB9LFxuICAgICAgICAgIGluZGV4OiBjdXJyZW50X2xlbmd0aCArIGksXG4gICAgICAgICAgcHJvamVjdGlvbnM6IHtcbiAgICAgICAgICAgICd0c25lLTAnOiAwLFxuICAgICAgICAgICAgJ3RzbmUtMSc6IDAsXG4gICAgICAgICAgICAndHNuZS0yJzogMFxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMucG9pbnRzLnB1c2gobmV3RGF0YVBvaW50KTtcbiAgICAgIH1cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5wb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGV0IGRhdGFQb2ludCA9IHRoaXMucG9pbnRzW2ldO1xuICAgICAgICBpZiAoZGF0YVBvaW50LkRWSV9wcm9qZWN0aW9ucyA9PSB1bmRlZmluZWQgfHwgZGF0YVBvaW50LkRWSV9jb2xvciA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkYXRhUG9pbnQuRFZJX3Byb2plY3Rpb25zID0ge307XG4gICAgICAgICAgZGF0YVBvaW50LkRWSV9jb2xvciA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChkYXRhUG9pbnQudHJhaW5pbmdfZGF0YSA9PSB1bmRlZmluZWQgfHwgZGF0YVBvaW50LnRlc3RpbmdfZGF0YSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkYXRhUG9pbnQudHJhaW5pbmdfZGF0YSA9IHt9O1xuICAgICAgICAgIGRhdGFQb2ludC50ZXN0aW5nX2RhdGEgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YVBvaW50LnByZWRpY3Rpb24gPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZGF0YVBvaW50LnByZWRpY3Rpb24gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YVBvaW50Lm5ld19zZWxlY3Rpb24gPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZGF0YVBvaW50Lm5ld19zZWxlY3Rpb24gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YVBvaW50Lmludl9hY2MgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZGF0YVBvaW50Lmludl9hY2MgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YVBvaW50LnVuY2VydGFpbnR5ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRhdGFQb2ludC51bmNlcnRhaW50eSA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChkYXRhUG9pbnQudW5jZXJ0YWludHlfcmFua2luZyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkYXRhUG9pbnQudW5jZXJ0YWludHlfcmFua2luZyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChkYXRhUG9pbnQuZGl2ZXJzaXR5ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRhdGFQb2ludC5kaXZlcnNpdHkgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YVBvaW50LmRpdmVyc2l0eV9yYW5raW5nID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRhdGFQb2ludC5kaXZlcnNpdHlfcmFua2luZyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChkYXRhUG9pbnQudG90ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRhdGFQb2ludC50b3QgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YVBvaW50LnRvdF9yYW5raW5nID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRhdGFQb2ludC50b3RfcmFua2luZyA9IHt9O1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVhbF9kYXRhX251bWJlcjsgaSsrKSB7XG4gICAgICAgIGxldCBkYXRhUG9pbnQgPSB0aGlzLnBvaW50c1tpXTtcbiAgICAgICAgZGF0YVBvaW50LnByb2plY3Rpb25zWyd0c25lLTAnXSA9IHJlc3VsdFtpXVswXTtcbiAgICAgICAgZGF0YVBvaW50LnByb2plY3Rpb25zWyd0c25lLTEnXSA9IHJlc3VsdFtpXVsxXTtcbiAgICAgICAgZGF0YVBvaW50LnByb2plY3Rpb25zWyd0c25lLTInXSA9IDA7XG4gICAgICAgIGRhdGFQb2ludC5jb2xvciA9IHJnYlRvSGV4KGxhYmVsX2NvbG9yX2xpc3RbaV1bMF0sIGxhYmVsX2NvbG9yX2xpc3RbaV1bMV0sIGxhYmVsX2NvbG9yX2xpc3RbaV1bMl0pO1xuICAgICAgICBkYXRhUG9pbnQuRFZJX3Byb2plY3Rpb25zW2l0ZXJhdGlvbl0gPSBbcmVzdWx0W2ldWzBdLCByZXN1bHRbaV1bMV1dO1xuICAgICAgICBkYXRhUG9pbnQuRFZJX2NvbG9yW2l0ZXJhdGlvbl0gPSBkYXRhUG9pbnQuY29sb3I7XG4gICAgICAgIGRhdGFQb2ludC50cmFpbmluZ19kYXRhW2l0ZXJhdGlvbl0gPSBmYWxzZTtcbiAgICAgICAgZGF0YVBvaW50LnRlc3RpbmdfZGF0YVtpdGVyYXRpb25dID0gZmFsc2U7XG4gICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3RyYWluaW5nID0gZmFsc2U7XG4gICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3Rlc3RpbmcgPSBmYWxzZTtcbiAgICAgICAgZGF0YVBvaW50Lm1ldGFkYXRhWydsYWJlbCddID0gbGFiZWxfbGlzdFtpXTtcbiAgICAgICAgZGF0YVBvaW50LnByZWRpY3Rpb25baXRlcmF0aW9uXSA9IHByZWRpY3Rpb25fbGlzdFtpXTtcbiAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfcHJlZGljdGlvbiA9IHByZWRpY3Rpb25fbGlzdFtpXTtcbiAgICAgICAgZGF0YVBvaW50Lmludl9hY2NbaXRlcmF0aW9uXSA9IGludl9hY2NbaV07XG4gICAgICAgIGRhdGFQb2ludC5jdXJyZW50X2ludl9hY2MgPSBpbnZfYWNjW2ldO1xuICAgICAgICBpZiAocHJlZGljdGlvbl9saXN0W2ldID09IGxhYmVsX2xpc3RbaV0pIHtcbiAgICAgICAgICBkYXRhUG9pbnQuY3VycmVudF93cm9uZ19wcmVkaWN0aW9uID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfd3JvbmdfcHJlZGljdGlvbiA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGF0YVBvaW50Lm5ld19zZWxlY3Rpb25baXRlcmF0aW9uXSA9IGZhbHNlO1xuICAgICAgICBkYXRhUG9pbnQuY3VycmVudF9uZXdfc2VsZWN0aW9uID0gZmFsc2U7XG4gICAgICAgIGlmIChvcmlnaW5hbF9sYWJlbF9saXN0KSB7XG4gICAgICAgICAgZGF0YVBvaW50Lm9yaWdpbmFsX2xhYmVsID0gb3JpZ2luYWxfbGFiZWxfbGlzdFtpXTtcbiAgICAgICAgfVxuICAgICAgICBkYXRhUG9pbnQubm9pc3kgPSBmYWxzZTtcbiAgICAgICAgLy8gaWYgKGlzX3VuY2VydGFpbnR5X2RpdmVyc2l0eV90b3RfZXhpc3QpIHtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQubWV0YWRhdGFbJ3VuY2VydGFpbnR5J10gPSBkYXRhLnVuY2VydGFpbnR5X2RpdmVyc2l0eV90b3QudW5jZXJ0YWludHlbaV07XG4gICAgICAgIC8vICAgZGF0YVBvaW50LnVuY2VydGFpbnR5W2l0ZXJhdGlvbl0gPSBkYXRhUG9pbnQubWV0YWRhdGFbJ3VuY2VydGFpbnR5J107XG4gICAgICAgIC8vICAgZGF0YVBvaW50Lm1ldGFkYXRhWydkaXZlcnNpdHknXSA9IGRhdGEudW5jZXJ0YWludHlfZGl2ZXJzaXR5X3RvdC5kaXZlcnNpdHlbaV07XG4gICAgICAgIC8vICAgZGF0YVBvaW50LmRpdmVyc2l0eVtpdGVyYXRpb25dID0gZGF0YVBvaW50Lm1ldGFkYXRhWydkaXZlcnNpdHknXTtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQubWV0YWRhdGFbJ3RvdCddID0gZGF0YS51bmNlcnRhaW50eV9kaXZlcnNpdHlfdG90LnRvdFtpXTtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQudG90W2l0ZXJhdGlvbl0gPSBkYXRhUG9pbnQubWV0YWRhdGFbJ3RvdCddO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC51bmNlcnRhaW50eV9yYW5raW5nW2l0ZXJhdGlvbl0gPSBkYXRhLnVuY2VydGFpbnR5X2RpdmVyc2l0eV90b3QudW5jZXJ0YWludHlfcmFua2luZ1tpXTtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQuY3VycmVudF91bmNlcnRhaW50eV9yYW5raW5nID0gZGF0YS51bmNlcnRhaW50eV9kaXZlcnNpdHlfdG90LnVuY2VydGFpbnR5X3JhbmtpbmdbaV07XG4gICAgICAgIC8vICAgZGF0YVBvaW50LmRpdmVyc2l0eV9yYW5raW5nW2l0ZXJhdGlvbl0gPSBkYXRhLnVuY2VydGFpbnR5X2RpdmVyc2l0eV90b3QuZGl2ZXJzaXR5X3JhbmtpbmdbaV07XG4gICAgICAgIC8vICAgZGF0YVBvaW50LmN1cnJlbnRfZGl2ZXJzaXR5X3JhbmtpbmcgPSBkYXRhLnVuY2VydGFpbnR5X2RpdmVyc2l0eV90b3QuZGl2ZXJzaXR5X3JhbmtpbmdbaV07XG4gICAgICAgIC8vICAgZGF0YVBvaW50LnRvdF9yYW5raW5nW2l0ZXJhdGlvbl0gPSBkYXRhLnVuY2VydGFpbnR5X2RpdmVyc2l0eV90b3QudG90X3JhbmtpbmdbaV07XG4gICAgICAgIC8vICAgZGF0YVBvaW50LmN1cnJlbnRfdG90X3JhbmtpbmcgPSBkYXRhLnVuY2VydGFpbnR5X2RpdmVyc2l0eV90b3QudG90X3JhbmtpbmdbaV07XG4gICAgICAgIC8vIH1cbiAgICAgIH1cblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBiYWNrZ3JvdW5kX3BvaW50X251bWJlcjsgaSsrKSB7XG4gICAgICAgIGxldCBkYXRhUG9pbnQgPSB0aGlzLnBvaW50c1tpICsgcmVhbF9kYXRhX251bWJlcl07XG4gICAgICAgIGRhdGFQb2ludC5wcm9qZWN0aW9uc1sndHNuZS0wJ10gPSBncmlkX2luZGV4W2ldWzBdO1xuICAgICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnNbJ3RzbmUtMSddID0gZ3JpZF9pbmRleFtpXVsxXTtcbiAgICAgICAgZGF0YVBvaW50LnByb2plY3Rpb25zWyd0c25lLTInXSA9IDA7XG4gICAgICAgIGRhdGFQb2ludC5jb2xvciA9IHJnYlRvSGV4KGdyaWRfY29sb3JbaV1bMF0sIGdyaWRfY29sb3JbaV1bMV0sIGdyaWRfY29sb3JbaV1bMl0pO1xuICAgICAgICBkYXRhUG9pbnQuRFZJX3Byb2plY3Rpb25zW2l0ZXJhdGlvbl0gPSBbZ3JpZF9pbmRleFtpXVswXSwgZ3JpZF9pbmRleFtpXVsxXV07XG4gICAgICAgIGRhdGFQb2ludC5EVklfY29sb3JbaXRlcmF0aW9uXSA9IGRhdGFQb2ludC5jb2xvcjtcbiAgICAgICAgZGF0YVBvaW50LnRyYWluaW5nX2RhdGFbaXRlcmF0aW9uXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgZGF0YVBvaW50LnRlc3RpbmdfZGF0YVtpdGVyYXRpb25dID0gdW5kZWZpbmVkO1xuICAgICAgICBkYXRhUG9pbnQuY3VycmVudF90cmFpbmluZyA9IHVuZGVmaW5lZDtcbiAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfdGVzdGluZyA9IHVuZGVmaW5lZDtcbiAgICAgICAgZGF0YVBvaW50LnByZWRpY3Rpb25baXRlcmF0aW9uXSA9IFwiYmFja2dyb3VuZFwiO1xuICAgICAgICBkYXRhUG9pbnQuY3VycmVudF9wcmVkaWN0aW9uID0gXCJiYWNrZ3JvdW5kXCI7XG4gICAgICAgIGRhdGFQb2ludC5pbnZfYWNjW2l0ZXJhdGlvbl0gPSAwO1xuICAgICAgICBkYXRhUG9pbnQuY3VycmVudF9pbnZfYWNjID0gMDtcbiAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfbmV3X3NlbGVjdGlvbiA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gZGF0YVBvaW50Lm5ld19zZWxlY3Rpb25baXRlcmF0aW9uXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfd3JvbmdfcHJlZGljdGlvbiA9IHVuZGVmaW5lZDtcbiAgICAgICAgZGF0YVBvaW50Lm9yaWdpbmFsX2xhYmVsID0gXCJiYWNrZ3JvdW5kXCI7XG4gICAgICAgIGRhdGFQb2ludC5ub2lzeSA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gaWYgKGlzX3VuY2VydGFpbnR5X2RpdmVyc2l0eV90b3RfZXhpc3QpIHtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQubWV0YWRhdGFbJ3VuY2VydGFpbnR5J10gPSAtMTtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQudW5jZXJ0YWludHlbaXRlcmF0aW9uXSA9IC0xO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC5tZXRhZGF0YVsnZGl2ZXJzaXR5J10gPSAtMTtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQuZGl2ZXJzaXR5W2l0ZXJhdGlvbl0gPSAtMTtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQubWV0YWRhdGFbJ3RvdCddID0gLTE7XG4gICAgICAgIC8vICAgZGF0YVBvaW50LnRvdFtpdGVyYXRpb25dID0gLTE7XG4gICAgICAgIC8vICAgZGF0YVBvaW50LnVuY2VydGFpbnR5X3JhbmtpbmdbaXRlcmF0aW9uXSA9IC0xO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC5jdXJyZW50X3VuY2VydGFpbnR5X3JhbmtpbmcgPSAtMTtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQuZGl2ZXJzaXR5X3JhbmtpbmdbaXRlcmF0aW9uXSA9IC0xO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC5jdXJyZW50X2RpdmVyc2l0eV9yYW5raW5nID0gLTE7XG4gICAgICAgIC8vICAgZGF0YVBvaW50LnRvdF9yYW5raW5nW2l0ZXJhdGlvbl0gPSAtMTtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQuY3VycmVudF90b3RfcmFua2luZyA9IC0xO1xuICAgICAgICAvLyB9XG4gICAgICB9XG5cbiAgICAgIGZvciAobGV0IGkgPSByZWFsX2RhdGFfbnVtYmVyICsgYmFja2dyb3VuZF9wb2ludF9udW1iZXI7IGkgPCB0aGlzLnBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBsZXQgZGF0YVBvaW50ID0gdGhpcy5wb2ludHNbaV07XG4gICAgICAgIGRhdGFQb2ludC5wcm9qZWN0aW9ucyA9IHt9O1xuICAgICAgfVxuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRyYWluaW5nX2RhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgZGF0YUluZGV4ID0gdHJhaW5pbmdfZGF0YVtpXTtcbiAgICAgICAgbGV0IGRhdGFQb2ludCA9IHRoaXMucG9pbnRzW2RhdGFJbmRleF07XG4gICAgICAgIGRhdGFQb2ludC50cmFpbmluZ19kYXRhW2l0ZXJhdGlvbl0gPSB0cnVlO1xuICAgICAgICBkYXRhUG9pbnQuY3VycmVudF90cmFpbmluZyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGVzdGluZ19kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGRhdGFJbmRleCA9IHRlc3RpbmdfZGF0YVtpXTtcbiAgICAgICAgbGV0IGRhdGFQb2ludCA9IHRoaXMucG9pbnRzW2RhdGFJbmRleF07XG4gICAgICAgIGRhdGFQb2ludC50ZXN0aW5nX2RhdGFbaXRlcmF0aW9uXSA9IHRydWU7XG4gICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3Rlc3RpbmcgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBmb3IgKGxldCBpID0gMDsgaSA8IG5ld19zZWxlY3Rpb24ubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vICAgY29uc3QgZGF0YUluZGV4ID0gbmV3X3NlbGVjdGlvbltpXTtcbiAgICAgIC8vICAgbGV0IGRhdGFQb2ludCA9IHRoaXMucG9pbnRzW2RhdGFJbmRleF07XG4gICAgICAvLyAgIGRhdGFQb2ludC5uZXdfc2VsZWN0aW9uW2l0ZXJhdGlvbl0gPSB0cnVlO1xuICAgICAgLy8gICBkYXRhUG9pbnQuY3VycmVudF9uZXdfc2VsZWN0aW9uID0gdHJ1ZTtcbiAgICAgIC8vIH1cblxuICAgICAgLy8gZm9yIChsZXQgaSA9IDA7IGkgPCBub2lzeV9kYXRhPy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gICBjb25zdCBkYXRhSW5kZXggPSBub2lzeV9kYXRhW2ldO1xuICAgICAgLy8gICBsZXQgZGF0YVBvaW50ID0gdGhpcy5wb2ludHNbZGF0YUluZGV4XTtcbiAgICAgIC8vICAgZGF0YVBvaW50Lm5vaXN5ID0gdHJ1ZTtcbiAgICAgIC8vIH1cblxuICAgICAgLy8gY29uc3QgbWF0Y2hlcyA9IHRoaXMuZ2V0X21hdGNoKCk7XG4gICAgICAvL1xuICAgICAgLy8gZm9yIChsZXQgaSA9IDA7IGkgPCByZWFsX2RhdGFfbnVtYmVyOyBpKyspIHtcbiAgICAgIC8vICAgbGV0IGRhdGFQb2ludCA9IHRoaXMucG9pbnRzW2ldO1xuICAgICAgLy8gICBpZiAoaW5kaWNlcy5pbmRleE9mKGkpID09IC0xICYmIGkgPCB0aGlzLkRWSUN1cnJlbnRSZWFsRGF0YU51bWJlcikge1xuICAgICAgLy8gICAgIGRhdGFQb2ludC5wcm9qZWN0aW9ucyA9IHt9XG4gICAgICAvLyAgIH1cbiAgICAgIC8vIH1cblxuICAgICAgdGhpcy5EVklDdXJyZW50UmVhbERhdGFOdW1iZXIgPSByZWFsX2RhdGFfbnVtYmVyO1xuICAgICAgdGhpcy5EVklSZWFsRGF0YU51bWJlcltpdGVyYXRpb25dID0gcmVhbF9kYXRhX251bWJlcjtcbiAgICAgIHRoaXMuRFZJZmlsdGVySW5kaWNlcyA9IFtdO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZWFsX2RhdGFfbnVtYmVyICsgYmFja2dyb3VuZF9wb2ludF9udW1iZXI7IGkrKykge1xuICAgICAgICB0aGlzLkRWSWZpbHRlckluZGljZXMucHVzaChpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuRFZJRGF0YUxpc3RbaXRlcmF0aW9uXSA9IHRoaXMucG9pbnRzXG4gICAgICBpZiAodGhpcy5EVklEYXRhTGlzdFtpdGVyYXRpb25dICYmIHRoaXMuRFZJRGF0YUxpc3RbaXRlcmF0aW9uXS5sZW5ndGggJiYgdGhpcy5EVklEYXRhTGlzdC5sZW5naHQgPiBpdGVyYXRpb24pIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHRoaXMuRFZJRGF0YUxpc3QubGVuZ3RoICsgMTsgaSA+IGl0ZXJhdGlvbjsgaS0tKSB7XG4gICAgICAgICAgdGhpcy5EVklEYXRhTGlzdFtpXSA9IHRoaXMuRFZJRGF0YUxpc3RbaSAtIDFdXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHdpbmRvdy5EVklEYXRhTGlzdCA9IHRoaXMuRFZJRGF0YUxpc3RcbiAgICAgIHN0ZXBDYWxsYmFjayh0aGlzLnRTTkVJdGVyYXRpb24sIGV2YWx1YXRpb24sIG5ld19zZWxlY3Rpb24sIGZpbHRlckluZGljZXMsIHRoaXMudFNORVRvdGFsSXRlcik7XG4gICAgfSkuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgbG9nZ2luZy5zZXRFcnJvck1lc3NhZ2UoJ0Vycm9yJyk7XG4gICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICBzdGVwQ2FsbGJhY2sobnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCk7XG4gICAgfSk7XG5cbiAgICAvLyB9KTtcblxuICB9XG5cbiAgYXN5bmMgZ2V0U3ByaXRlSW1hZ2UoaWQ6IGFueSwgc3RlcENhbGxiYWNrOiAoaW1nRGF0YTogYW55KSA9PiB2b2lkKSB7XG4gICAgbGV0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICAgIGhlYWRlcnMuYXBwZW5kKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIGhlYWRlcnMuYXBwZW5kKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIGlmICh3aW5kb3cubW9kZWxNYXRoKSB7XG4gICAgICB0aGlzLkRWSXN1YmplY3RNb2RlbFBhdGggPSB3aW5kb3cubW9kZWxNYXRoXG4gICAgfVxuICAgIC8vIGNvbnN0IG1zZ0lkID0gbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UoJ0ZldGNoaW5nIHNwcml0ZSBpbWFnZS4uLicpO1xuICAgIC8vIGF3YWl0IGZldGNoKFwic3RhbmRhbG9uZV9wcm9qZWN0b3JfY29uZmlnLmpzb25cIiwgeyBtZXRob2Q6ICdHRVQnIH0pXG4gICAgLy8gLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKVxuICAgIC8vIC50aGVuKGRhdGEgPT4geyAgdGhpcy5EVklzdWJqZWN0TW9kZWxQYXRoID0gZGF0YS5EVklzdWJqZWN0TW9kZWxQYXRoIH0pXG5cbiAgICBhd2FpdCBmZXRjaChgaHR0cDovLyR7dGhpcy5EVklTZXJ2ZXJ9L3Nwcml0ZT9pbmRleD0ke2lkfSZwYXRoPSR7dGhpcy5EVklzdWJqZWN0TW9kZWxQYXRofSZ1c2VybmFtZT0ke3dpbmRvdy5zZXNzaW9uU3RvcmFnZS51c2VybmFtZX1gLCB7XG4gICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgbW9kZTogJ2NvcnMnXG4gICAgfSkudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpLnRoZW4oZGF0YSA9PiB7XG4gICAgICAvLyBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZShudWxsLCBtc2dJZCk7XG4gICAgICBzdGVwQ2FsbGJhY2soZGF0YSk7XG4gICAgfSkuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgLy8gbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UobnVsbCwgbXNnSWQpO1xuICAgICAgY29uc29sZS5sb2coXCJlcnJvclwiLCBlcnJvcik7XG4gICAgfSk7XG4gIH1cblxuXG5cbiAgaXRlcmF0aW9uQ2hhbmdlUmVzZXQoKSB7XG4gICAgd2luZG93LmFsUXVlcnlSZXNQb2ludEluZGljZXMgPSBbXVxuICAgIHdpbmRvdy5xdWVyeVJlc1BvaW50SW5kaWNlcyA9IFtdXG4gICAgd2luZG93LnF1ZXJ5UmVzUG9pbnRJbmRpY2VzID0gW11cbiAgICB3aW5kb3cucHJldmlvdXNJbmRlY2F0ZXMgPSBbXVxuXG4gICAgd2luZG93LmFsU3VnZ2VzdGlvbkluZGljYXRlcyA9IFtdXG4gICAgd2luZG93LmFsU3VnZ2VzdExhYmVsTGlzdCA9IFtdXG4gICAgd2luZG93LmFsU3VnZ2VzdFNjb3JlTGlzdCA9IFtdXG4gICAgd2luZG93LmN1c3RvbVNlbGVjdGlvbiA9IFtdXG4gICAgd2luZG93LmZsYWdpbmRlY2F0ZXNMaXN0ID0gW11cbiAgfVxuXG5cblxuICBzZXRTdXBlcnZpc2lvbihzdXBlcnZpc2VDb2x1bW46IHN0cmluZywgc3VwZXJ2aXNlSW5wdXQ/OiBzdHJpbmcpIHtcbiAgICBpZiAoc3VwZXJ2aXNlQ29sdW1uICE9IG51bGwpIHtcbiAgICAgIHRoaXMuc3VwZXJ2aXNlTGFiZWxzID0gdGhpcy5zaHVmZmxlZERhdGFJbmRpY2VzXG4gICAgICAgIC5zbGljZSgwLCBUU05FX1NBTVBMRV9TSVpFKVxuICAgICAgICAubWFwKChpbmRleCkgPT5cbiAgICAgICAgICB0aGlzLnBvaW50c1tpbmRleF0ubWV0YWRhdGFbc3VwZXJ2aXNlQ29sdW1uXSAhPT0gdW5kZWZpbmVkXG4gICAgICAgICAgICA/IFN0cmluZyh0aGlzLnBvaW50c1tpbmRleF0ubWV0YWRhdGFbc3VwZXJ2aXNlQ29sdW1uXSlcbiAgICAgICAgICAgIDogYFVua25vd24gIyR7aW5kZXh9YFxuICAgICAgICApO1xuICAgIH1cbiAgICBpZiAoc3VwZXJ2aXNlSW5wdXQgIT0gbnVsbCkge1xuICAgICAgdGhpcy5zdXBlcnZpc2VJbnB1dCA9IHN1cGVydmlzZUlucHV0O1xuICAgIH1cbiAgICBpZiAodGhpcy50c25lKSB7XG4gICAgICB0aGlzLnRzbmUuc2V0U3VwZXJ2aXNpb24odGhpcy5zdXBlcnZpc2VMYWJlbHMsIHRoaXMuc3VwZXJ2aXNlSW5wdXQpO1xuICAgIH1cbiAgfVxuICBzZXRTdXBlcnZpc2VGYWN0b3Ioc3VwZXJ2aXNlRmFjdG9yOiBudW1iZXIpIHtcbiAgICBpZiAoc3VwZXJ2aXNlRmFjdG9yICE9IG51bGwpIHtcbiAgICAgIHRoaXMuc3VwZXJ2aXNlRmFjdG9yID0gc3VwZXJ2aXNlRmFjdG9yO1xuICAgICAgaWYgKHRoaXMudHNuZSkge1xuICAgICAgICB0aGlzLnRzbmUuc2V0U3VwZXJ2aXNlRmFjdG9yKHN1cGVydmlzZUZhY3Rvcik7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8qKlxuICAgKiBNZXJnZXMgbWV0YWRhdGEgdG8gdGhlIGRhdGFzZXQgYW5kIHJldHVybnMgd2hldGhlciBpdCBzdWNjZWVkZWQuXG4gICAqL1xuICBtZXJnZU1ldGFkYXRhKG1ldGFkYXRhOiBTcHJpdGVBbmRNZXRhZGF0YUluZm8pOiBib29sZWFuIHtcbiAgICBpZiAobWV0YWRhdGEucG9pbnRzSW5mby5sZW5ndGggIT09IHRoaXMucG9pbnRzLmxlbmd0aCkge1xuICAgICAgbGV0IGVycm9yTWVzc2FnZSA9XG4gICAgICAgIGBOdW1iZXIgb2YgdGVuc29ycyAoJHt0aGlzLnBvaW50cy5sZW5ndGh9KSBkbyBub3RgICtcbiAgICAgICAgYCBtYXRjaCB0aGUgbnVtYmVyIG9mIGxpbmVzIGluIG1ldGFkYXRhYCArXG4gICAgICAgIGAgKCR7bWV0YWRhdGEucG9pbnRzSW5mby5sZW5ndGh9KS5gO1xuICAgICAgaWYgKFxuICAgICAgICBtZXRhZGF0YS5zdGF0cy5sZW5ndGggPT09IDEgJiZcbiAgICAgICAgdGhpcy5wb2ludHMubGVuZ3RoICsgMSA9PT0gbWV0YWRhdGEucG9pbnRzSW5mby5sZW5ndGhcbiAgICAgICkge1xuICAgICAgICAvLyBJZiB0aGVyZSBpcyBvbmx5IG9uZSBjb2x1bW4gb2YgbWV0YWRhdGEgYW5kIHRoZSBudW1iZXIgb2YgcG9pbnRzIGlzXG4gICAgICAgIC8vIGV4YWN0bHkgb25lIGxlc3MgdGhhbiB0aGUgbnVtYmVyIG9mIG1ldGFkYXRhIGxpbmVzLCB0aGlzIGlzIGR1ZSB0byBhblxuICAgICAgICAvLyB1bm5lY2Vzc2FyeSBoZWFkZXIgbGluZSBpbiB0aGUgbWV0YWRhdGEgYW5kIHdlIGNhbiBzaG93IGEgbWVhbmluZ2Z1bFxuICAgICAgICAvLyBlcnJvci5cbiAgICAgICAgbG9nZ2luZy5zZXRFcnJvck1lc3NhZ2UoXG4gICAgICAgICAgZXJyb3JNZXNzYWdlICtcbiAgICAgICAgICAnIFNpbmdsZSBjb2x1bW4gbWV0YWRhdGEgc2hvdWxkIG5vdCBoYXZlIGEgaGVhZGVyICcgK1xuICAgICAgICAgICdyb3cuJyxcbiAgICAgICAgICAnbWVyZ2luZyBtZXRhZGF0YSdcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgbWV0YWRhdGEuc3RhdHMubGVuZ3RoID4gMSAmJlxuICAgICAgICB0aGlzLnBvaW50cy5sZW5ndGggLSAxID09PSBtZXRhZGF0YS5wb2ludHNJbmZvLmxlbmd0aFxuICAgICAgKSB7XG4gICAgICAgIC8vIElmIHRoZXJlIGFyZSBtdWx0aXBsZSBjb2x1bW5zIG9mIG1ldGFkYXRhIGFuZCB0aGUgbnVtYmVyIG9mIHBvaW50cyBpc1xuICAgICAgICAvLyBleGFjdGx5IG9uZSBncmVhdGVyIHRoYW4gdGhlIG51bWJlciBvZiBsaW5lcyBpbiB0aGUgbWV0YWRhdGEsIHRoaXNcbiAgICAgICAgLy8gbWVhbnMgdGhlcmUgaXMgYSBtaXNzaW5nIG1ldGFkYXRhIGhlYWRlci5cbiAgICAgICAgbG9nZ2luZy5zZXRFcnJvck1lc3NhZ2UoXG4gICAgICAgICAgZXJyb3JNZXNzYWdlICtcbiAgICAgICAgICAnIE11bHRpLWNvbHVtbiBtZXRhZGF0YSBzaG91bGQgaGF2ZSBhIGhlYWRlciAnICtcbiAgICAgICAgICAncm93IHdpdGggY29sdW1uIGxhYmVscy4nLFxuICAgICAgICAgICdtZXJnaW5nIG1ldGFkYXRhJ1xuICAgICAgICApO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBsb2dnaW5nLnNldFdhcm5pbmdNZXNzYWdlKGVycm9yTWVzc2FnZSk7XG4gICAgfVxuICAgIHRoaXMuc3ByaXRlQW5kTWV0YWRhdGFJbmZvID0gbWV0YWRhdGE7XG4gICAgbWV0YWRhdGEucG9pbnRzSW5mb1xuICAgICAgLnNsaWNlKDAsIHRoaXMucG9pbnRzLmxlbmd0aClcbiAgICAgIC5mb3JFYWNoKChtLCBpKSA9PiAodGhpcy5wb2ludHNbaV0ubWV0YWRhdGEgPSBtKSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgc3RvcFRTTkUoKSB7XG4gICAgdGhpcy50U05FU2hvdWxkU3RvcCA9IHRydWU7XG4gIH1cbiAgLyoqXG4gICAqIEZpbmRzIHRoZSBuZWFyZXN0IG5laWdoYm9ycyBvZiB0aGUgcXVlcnkgcG9pbnQgdXNpbmcgYVxuICAgKiB1c2VyLXNwZWNpZmllZCBkaXN0YW5jZSBtZXRyaWMuXG4gICAqL1xuICBmaW5kTmVpZ2hib3JzKFxuICAgIHBvaW50SW5kZXg6IG51bWJlcixcbiAgICBkaXN0RnVuYzogRGlzdGFuY2VGdW5jdGlvbixcbiAgICBudW1OTjogbnVtYmVyXG4gICk6IGtubi5OZWFyZXN0RW50cnlbXSB7XG4gICAgLy8gRmluZCB0aGUgbmVhcmVzdCBuZWlnaGJvcnMgb2YgYSBwYXJ0aWN1bGFyIHBvaW50LlxuICAgIGxldCBuZWlnaGJvcnMgPSBrbm4uZmluZEtOTm9mUG9pbnQoXG4gICAgICB0aGlzLnBvaW50cyxcbiAgICAgIHBvaW50SW5kZXgsXG4gICAgICBudW1OTixcbiAgICAgIChkKSA9PiBkLnZlY3RvcixcbiAgICAgIGRpc3RGdW5jXG4gICAgKTtcbiAgICAvLyBUT0RPKEBkc21pbGtvdik6IEZpZ3VyZSBvdXQgd2h5IHdlIHNsaWNlLlxuICAgIGxldCByZXN1bHQgPSBuZWlnaGJvcnMuc2xpY2UoMCwgbnVtTk4pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgLyoqXG4gICAqIFNlYXJjaCB0aGUgZGF0YXNldCBiYXNlZCBvbiBhIG1ldGFkYXRhIGZpZWxkIGFuZCBzYXZlIGFsbCB0aGUgcHJlZGljYXRlcy5cbiAgICovXG4gIHF1ZXJ5KHF1ZXJ5OiBzdHJpbmcsIGluUmVnZXhNb2RlOiBib29sZWFuLCBmaWVsZE5hbWU6IHN0cmluZyk6IFthbnksIG51bWJlcltdXSB7XG4gICAgbGV0IHByZWRpY2F0ZSA9IHV0aWwuZ2V0U2VhcmNoUHJlZGljYXRlKHF1ZXJ5LCBpblJlZ2V4TW9kZSwgZmllbGROYW1lKTtcbiAgICBsZXQgbWF0Y2hlczogbnVtYmVyW10gPSBbXTtcbiAgICB0aGlzLnBvaW50cy5mb3JFYWNoKChwb2ludCwgaWQpID0+IHtcbiAgICAgIGxldCByZXN1bHQgPSB0cnVlO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLkRWSVByZWRpY2F0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgY3VycmVudF9wcmVkaWNhdGUgPSB0aGlzLkRWSVByZWRpY2F0ZXNbaV07XG4gICAgICAgIGlmICghY3VycmVudF9wcmVkaWNhdGUocG9pbnQpKSB7XG4gICAgICAgICAgcmVzdWx0ID0gZmFsc2U7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChyZXN1bHQgJiYgcHJlZGljYXRlKHBvaW50KSkge1xuICAgICAgICBtYXRjaGVzLnB1c2goaWQpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBbcHJlZGljYXRlLCBtYXRjaGVzXTtcbiAgfVxuICBnZXRfbWF0Y2goKSB7XG4gICAgbGV0IG1hdGNoZXM6IG51bWJlcltdID0gW107XG4gICAgdGhpcy5wb2ludHMuZm9yRWFjaCgocG9pbnQsIGlkKSA9PiB7XG4gICAgICBsZXQgcmVzdWx0ID0gdHJ1ZTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5EVklQcmVkaWNhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRfcHJlZGljYXRlID0gdGhpcy5EVklQcmVkaWNhdGVzW2ldO1xuICAgICAgICBpZiAoIWN1cnJlbnRfcHJlZGljYXRlKHBvaW50KSkge1xuICAgICAgICAgIHJlc3VsdCA9IGZhbHNlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIG1hdGNoZXMucHVzaChpZCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG1hdGNoZXM7XG4gIH1cbn1cbmV4cG9ydCB0eXBlIFByb2plY3Rpb25UeXBlID0gJ3RzbmUnIHwgJ3VtYXAnIHwgJ3BjYScgfCAnY3VzdG9tJztcbmV4cG9ydCBjbGFzcyBQcm9qZWN0aW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIHByb2plY3Rpb25UeXBlOiBQcm9qZWN0aW9uVHlwZSxcbiAgICBwdWJsaWMgcHJvamVjdGlvbkNvbXBvbmVudHM6IFByb2plY3Rpb25Db21wb25lbnRzM0QsXG4gICAgcHVibGljIGRpbWVuc2lvbmFsaXR5OiBudW1iZXIsXG4gICAgcHVibGljIGRhdGFTZXQ6IERhdGFTZXRcbiAgKSB7IH1cbn1cbmV4cG9ydCBpbnRlcmZhY2UgQ29sb3JPcHRpb24ge1xuICBuYW1lOiBzdHJpbmc7XG4gIGRlc2M/OiBzdHJpbmc7XG4gIG1hcD86ICh2YWx1ZTogc3RyaW5nIHwgbnVtYmVyKSA9PiBzdHJpbmc7XG4gIC8qKiBMaXN0IG9mIGl0ZW1zIGZvciB0aGUgY29sb3IgbWFwLiBEZWZpbmVkIG9ubHkgZm9yIGNhdGVnb3JpY2FsIG1hcC4gKi9cbiAgaXRlbXM/OiB7XG4gICAgbGFiZWw6IHN0cmluZztcbiAgICBjb3VudDogbnVtYmVyO1xuICB9W107XG4gIC8qKiBUaHJlc2hvbGQgdmFsdWVzIGFuZCB0aGVpciBjb2xvcnMuIERlZmluZWQgZm9yIGdyYWRpZW50IGNvbG9yIG1hcC4gKi9cbiAgdGhyZXNob2xkcz86IHtcbiAgICB2YWx1ZTogbnVtYmVyO1xuICAgIGNvbG9yOiBzdHJpbmc7XG4gIH1bXTtcbiAgaXNTZXBhcmF0b3I/OiBib29sZWFuO1xuICB0b29NYW55VW5pcXVlVmFsdWVzPzogYm9vbGVhbjtcbn1cbi8qKlxuICogQW4gaW50ZXJmYWNlIHRoYXQgaG9sZHMgYWxsIHRoZSBkYXRhIGZvciBzZXJpYWxpemluZyB0aGUgY3VycmVudCBzdGF0ZSBvZlxuICogdGhlIHdvcmxkLlxuICovXG5leHBvcnQgY2xhc3MgU3RhdGUge1xuICAvKiogQSBsYWJlbCBpZGVudGlmeWluZyB0aGlzIHN0YXRlLiAqL1xuICBsYWJlbDogc3RyaW5nID0gJyc7XG4gIC8qKiBXaGV0aGVyIHRoaXMgU3RhdGUgaXMgc2VsZWN0ZWQgaW4gdGhlIGJvb2ttYXJrcyBwYW5lLiAqL1xuICBpc1NlbGVjdGVkOiBib29sZWFuID0gZmFsc2U7XG4gIC8qKiBUaGUgc2VsZWN0ZWQgcHJvamVjdGlvbiB0YWIuICovXG4gIHNlbGVjdGVkUHJvamVjdGlvbjogUHJvamVjdGlvblR5cGU7XG4gIC8qKiBEaW1lbnNpb25zIG9mIHRoZSBEYXRhU2V0LiAqL1xuICBkYXRhU2V0RGltZW5zaW9uczogW251bWJlciwgbnVtYmVyXTtcbiAgLyoqIHQtU05FIHBhcmFtZXRlcnMgKi9cbiAgdFNORUl0ZXJhdGlvbjogbnVtYmVyID0gMDtcbiAgdFNORVBlcnBsZXhpdHk6IG51bWJlciA9IDA7XG4gIHRTTkVMZWFybmluZ1JhdGU6IG51bWJlciA9IDA7XG4gIHRTTkVpczNkOiBib29sZWFuID0gdHJ1ZTtcbiAgLyoqIFVNQVAgcGFyYW1ldGVycyAqL1xuICB1bWFwSXMzZDogYm9vbGVhbiA9IHRydWU7XG4gIHVtYXBOZWlnaGJvcnM6IG51bWJlciA9IDE1O1xuICAvKiogUENBIHByb2plY3Rpb24gY29tcG9uZW50IGRpbWVuc2lvbnMgKi9cbiAgcGNhQ29tcG9uZW50RGltZW5zaW9uczogbnVtYmVyW10gPSBbXTtcbiAgLyoqIEN1c3RvbSBwcm9qZWN0aW9uIHBhcmFtZXRlcnMgKi9cbiAgY3VzdG9tU2VsZWN0ZWRTZWFyY2hCeU1ldGFkYXRhT3B0aW9uOiBzdHJpbmc7XG4gIGN1c3RvbVhMZWZ0VGV4dDogc3RyaW5nO1xuICBjdXN0b21YTGVmdFJlZ2V4OiBib29sZWFuO1xuICBjdXN0b21YUmlnaHRUZXh0OiBzdHJpbmc7XG4gIGN1c3RvbVhSaWdodFJlZ2V4OiBib29sZWFuO1xuICBjdXN0b21ZVXBUZXh0OiBzdHJpbmc7XG4gIGN1c3RvbVlVcFJlZ2V4OiBib29sZWFuO1xuICBjdXN0b21ZRG93blRleHQ6IHN0cmluZztcbiAgY3VzdG9tWURvd25SZWdleDogYm9vbGVhbjtcbiAgLyoqIFRoZSBjb21wdXRlZCBwcm9qZWN0aW9ucyBvZiB0aGUgdGVuc29ycy4gKi9cbiAgcHJvamVjdGlvbnM6IEFycmF5PHtcbiAgICBba2V5OiBzdHJpbmddOiBudW1iZXI7XG4gIH0+ID0gW107XG4gIC8qKiBGaWx0ZXJlZCBkYXRhc2V0IGluZGljZXMuICovXG4gIGZpbHRlcmVkUG9pbnRzOiBudW1iZXJbXTtcbiAgLyoqIFRoZSBpbmRpY2VzIG9mIHNlbGVjdGVkIHBvaW50cy4gKi9cbiAgc2VsZWN0ZWRQb2ludHM6IG51bWJlcltdID0gW107XG4gIC8qKiBDYW1lcmEgc3RhdGUgKDJkLzNkLCBwb3NpdGlvbiwgdGFyZ2V0LCB6b29tLCBldGMpLiAqL1xuICBjYW1lcmFEZWY6IENhbWVyYURlZjtcbiAgLyoqIENvbG9yIGJ5IG9wdGlvbi4gKi9cbiAgc2VsZWN0ZWRDb2xvck9wdGlvbk5hbWU6IHN0cmluZztcbiAgZm9yY2VDYXRlZ29yaWNhbENvbG9yaW5nOiBib29sZWFuO1xuICAvKiogTGFiZWwgYnkgb3B0aW9uLiAqL1xuICBzZWxlY3RlZExhYmVsT3B0aW9uOiBzdHJpbmc7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0UHJvamVjdGlvbkNvbXBvbmVudHMoXG4gIHByb2plY3Rpb246IFByb2plY3Rpb25UeXBlLFxuICBjb21wb25lbnRzOiAobnVtYmVyIHwgc3RyaW5nKVtdXG4pOiBQcm9qZWN0aW9uQ29tcG9uZW50czNEIHtcbiAgaWYgKGNvbXBvbmVudHMubGVuZ3RoID4gMykge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdjb21wb25lbnRzIGxlbmd0aCBtdXN0IGJlIDw9IDMnKTtcbiAgfVxuICBjb25zdCBwcm9qZWN0aW9uQ29tcG9uZW50czogW3N0cmluZywgc3RyaW5nLCBzdHJpbmddID0gW251bGwsIG51bGwsIG51bGxdO1xuICBjb25zdCBwcmVmaXggPSBwcm9qZWN0aW9uID09PSAnY3VzdG9tJyA/ICdsaW5lYXInIDogcHJvamVjdGlvbjtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb21wb25lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKGNvbXBvbmVudHNbaV0gPT0gbnVsbCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHByb2plY3Rpb25Db21wb25lbnRzW2ldID0gcHJlZml4ICsgJy0nICsgY29tcG9uZW50c1tpXTtcbiAgfVxuICByZXR1cm4gcHJvamVjdGlvbkNvbXBvbmVudHM7XG59XG5leHBvcnQgZnVuY3Rpb24gc3RhdGVHZXRBY2Nlc3NvckRpbWVuc2lvbnMoXG4gIHN0YXRlOiBTdGF0ZVxuKTogQXJyYXk8bnVtYmVyIHwgc3RyaW5nPiB7XG4gIGxldCBkaW1lbnNpb25zOiBBcnJheTxudW1iZXIgfCBzdHJpbmc+O1xuICBzd2l0Y2ggKHN0YXRlLnNlbGVjdGVkUHJvamVjdGlvbikge1xuICAgIGNhc2UgJ3BjYSc6XG4gICAgICBkaW1lbnNpb25zID0gc3RhdGUucGNhQ29tcG9uZW50RGltZW5zaW9ucy5zbGljZSgpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAndHNuZSc6XG4gICAgICBkaW1lbnNpb25zID0gWzAsIDFdO1xuICAgICAgaWYgKHN0YXRlLnRTTkVpczNkKSB7XG4gICAgICAgIGRpbWVuc2lvbnMucHVzaCgyKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3VtYXAnOlxuICAgICAgZGltZW5zaW9ucyA9IFswLCAxXTtcbiAgICAgIGlmIChzdGF0ZS51bWFwSXMzZCkge1xuICAgICAgICBkaW1lbnNpb25zLnB1c2goMik7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdjdXN0b20nOlxuICAgICAgZGltZW5zaW9ucyA9IFsneCcsICd5J107XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGZhbGx0aHJvdWdoJyk7XG4gIH1cbiAgcmV0dXJuIGRpbWVuc2lvbnM7XG59XG4iXX0=