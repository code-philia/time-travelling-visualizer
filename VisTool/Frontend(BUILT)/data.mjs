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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3RlbnNvcmJvYXJkL3Byb2plY3Rvci9kYXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUEwQkEsT0FBTyxLQUFLLEdBQUcsTUFBTSxPQUFPLENBQUM7QUFDN0IsT0FBTyxLQUFLLE1BQU0sTUFBTSxVQUFVLENBQUM7QUFDbkMsT0FBTyxLQUFLLE9BQU8sTUFBTSxXQUFXLENBQUM7QUFDckMsT0FBTyxLQUFLLElBQUksTUFBTSxRQUFRLENBQUM7QUF1SC9CLE1BQU0sVUFBVSxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM3RSxnRkFBZ0Y7QUFDaEYsTUFBTSxDQUFDLE1BQU0sZ0JBQWdCLEdBQUcsR0FBRyxDQUFDO0FBQ3BDLE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUFHLEdBQUcsQ0FBQztBQUNwQyxNQUFNLENBQUMsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDO0FBQ3JDLGlFQUFpRTtBQUNqRSxNQUFNLENBQUMsTUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDO0FBQ2xDLDJDQUEyQztBQUMzQyxNQUFNLGtCQUFrQixHQUFHLEVBQUUsQ0FBQztBQUM5QixpRUFBaUU7QUFDakUsTUFBTSxXQUFXLEdBQUcsbUJBQW1CLENBQUM7QUFDeEM7OztHQUdHO0FBQ0gsTUFBTSx1QkFBdUIsR0FBRyxDQUFDLFVBQVUsRUFBRSxjQUFjLENBQUMsQ0FBQztBQUM3RCxTQUFTLHlCQUF5QixDQUNoQyxhQUE0QjtJQUU1QixJQUFJLFlBQVksR0FBRyxJQUFJLENBQUM7SUFDeEIsS0FBSyxJQUFJLFlBQVksSUFBSSx1QkFBdUIsRUFBRTtRQUNoRCxJQUFJLFlBQVksSUFBSSxhQUFhLElBQUksYUFBYSxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUsRUFBRTtZQUN2RSxZQUFZLEdBQUcsYUFB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QyxLQUFLLEtBQUs7WUFDUixVQUFVLEdBQUcsS0FBSyxDQUFDLHNCQUFzQixDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2xELE1BQU07UUFDUixLQUFLLE1BQU07WUFDVCxVQUFVLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDcEIsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFO2dCQUNsQixVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ3BCO1lBQ0QsTUFBTTtRQUNSLEtBQUssTUFBTTtZQUNULFVBQVUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNwQixJQUFJLEtBQUssQ0FBQyxRQUFRLEVBQUU7Z0JBQ2xCLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDcEI7WUFDRCxNQUFNO1FBQ1IsS0FBSyxRQUFRO1lBQ1gsVUFBVSxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ3hCLE1BQU07UUFDUjtZQUNFLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLENBQUMsQ0FBQztLQUM3QztJQUNELE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBDb3B5cmlnaHQgMjAxNiBUaGUgVGVuc29yRmxvdyBBdXRob3JzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5pbXBvcnQgbnVtZXJpYyBmcm9tICdudW1lcmljJztcbmltcG9ydCB7IFVNQVAgfSBmcm9tICd1bWFwLWpzJztcblxuaW1wb3J0IHsgVFNORSB9IGZyb20gJy4vYmhfdHNuZSc7XG5pbXBvcnQge1xuICBEYXRhUHJvdmlkZXIsXG4gIEVtYmVkZGluZ0luZm8sXG4gIHBhcnNlVGVuc29yc0Zyb21GbG9hdDMyQXJyYXksIFByb2plY3RvckNvbmZpZyxcbiAgU3ByaXRlTWV0YWRhdGEsXG4gIFRFTlNPUlNfTVNHX0lEXG59IGZyb20gJy4vZGF0YS1wcm92aWRlcic7XG5pbXBvcnQgeyBDYW1lcmFEZWYgfSBmcm9tICcuL3NjYXR0ZXJQbG90JztcbmltcG9ydCAqIGFzIGtubiBmcm9tICcuL2tubic7XG5pbXBvcnQgKiBhcyB2ZWN0b3IgZnJvbSAnLi92ZWN0b3InO1xuaW1wb3J0ICogYXMgbG9nZ2luZyBmcm9tICcuL2xvZ2dpbmcnO1xuaW1wb3J0ICogYXMgdXRpbCBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgdHlwZSBEaXN0YW5jZUZ1bmN0aW9uID0gKGE6IHZlY3Rvci5WZWN0b3IsIGI6IHZlY3Rvci5WZWN0b3IpID0+IG51bWJlcjtcbmV4cG9ydCB0eXBlIFByb2plY3Rpb25Db21wb25lbnRzM0QgPSBbc3RyaW5nLCBzdHJpbmcsIHN0cmluZ107XG5cbmV4cG9ydCBpbnRlcmZhY2UgUG9pbnRNZXRhZGF0YSB7XG4gIFtrZXk6IHN0cmluZ106IG51bWJlciB8IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBEYXRhUHJvdG8ge1xuICBzaGFwZTogW251bWJlciwgbnVtYmVyXTtcbiAgdGVuc29yOiBudW1iZXJbXTtcbiAgbWV0YWRhdGE6IHtcbiAgICBjb2x1bW5zOiBBcnJheTx7XG4gICAgICBuYW1lOiBzdHJpbmc7XG4gICAgICBzdHJpbmdWYWx1ZXM6IHN0cmluZ1tdO1xuICAgICAgbnVtZXJpY1ZhbHVlczogbnVtYmVyW107XG4gICAgfT47XG4gICAgc3ByaXRlOiB7XG4gICAgICBpbWFnZUJhc2U2NDogc3RyaW5nO1xuICAgICAgc2luZ2xlSW1hZ2VEaW06IFtudW1iZXIsIG51bWJlcl07XG4gICAgfTtcbiAgfTtcbn1cblxuLyoqIFN0YXRpc3RpY3MgZm9yIGEgbWV0YWRhdGEgY29sdW1uLiAqL1xuZXhwb3J0IGludGVyZmFjZSBDb2x1bW5TdGF0cyB7XG4gIG5hbWU6IHN0cmluZztcbiAgaXNOdW1lcmljOiBib29sZWFuO1xuICB0b29NYW55VW5pcXVlVmFsdWVzOiBib29sZWFuO1xuICB1bmlxdWVFbnRyaWVzPzogQXJyYXk8e1xuICAgIGxhYmVsOiBzdHJpbmc7XG4gICAgY291bnQ6IG51bWJlcjtcbiAgfT47XG4gIG1pbjogbnVtYmVyO1xuICBtYXg6IG51bWJlcjtcbn1cbmV4cG9ydCBpbnRlcmZhY2UgU3ByaXRlQW5kTWV0YWRhdGFJbmZvIHtcbiAgc3RhdHM/OiBDb2x1bW5TdGF0c1tdO1xuICBwb2ludHNJbmZvPzogUG9pbnRNZXRhZGF0YVtdO1xuICBzcHJpdGVJbWFnZT86IEhUTUxJbWFnZUVsZW1lbnQ7XG4gIHNwcml0ZU1ldGFkYXRhPzogU3ByaXRlTWV0YWRhdGE7XG59XG5cbi8qKiBBIHNpbmdsZSBjb2xsZWN0aW9uIG9mIHBvaW50cyB3aGljaCBtYWtlIHVwIGEgc2VxdWVuY2UgdGhyb3VnaCBzcGFjZS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU2VxdWVuY2Uge1xuICAvKiogSW5kaWNlcyBpbnRvIHRoZSBEYXRhUG9pbnRzIGFycmF5IGluIHRoZSBEYXRhIG9iamVjdC4gKi9cbiAgcG9pbnRJbmRpY2VzOiBudW1iZXJbXTtcbn1cbmV4cG9ydCBpbnRlcmZhY2UgRGF0YVBvaW50IHtcbiAgLyoqIFRoZSBwb2ludCBpbiB0aGUgb3JpZ2luYWwgc3BhY2UuICovXG4gIHZlY3Rvcj86IEZsb2F0MzJBcnJheTtcbiAgLypcbiAgICogTWV0YWRhdGEgZm9yIGVhY2ggcG9pbnQuIEVhY2ggbWV0YWRhdGEgaXMgYSBzZXQgb2Yga2V5L3ZhbHVlIHBhaXJzXG4gICAqIHdoZXJlIHRoZSB2YWx1ZSBjYW4gYmUgYSBzdHJpbmcgb3IgYSBudW1iZXIuXG4gICAqL1xuICBvcmlnaW5hbF92ZWN0b3I/OiBGbG9hdDMyQXJyYXk7XG4gIG1pc2xhYmVsX3ZlY3Rvcj86IGJvb2xlYW47XG4gIGNvbG9yPzogc3RyaW5nO1xuICBtZXRhZGF0YTogUG9pbnRNZXRhZGF0YTtcbiAgLyoqIGluZGV4IG9mIHRoZSBzZXF1ZW5jZSwgdXNlZCBmb3IgaGlnaGxpZ2h0aW5nIG9uIGNsaWNrICovXG4gIHNlcXVlbmNlSW5kZXg/OiBudW1iZXI7XG4gIC8qKiBpbmRleCBpbiB0aGUgb3JpZ2luYWwgZGF0YSBzb3VyY2UgKi9cbiAgaW5kZXg6IG51bWJlcjtcbiAgLyoqIFRoaXMgaXMgd2hlcmUgdGhlIGNhbGN1bGF0ZWQgcHJvamVjdGlvbnMgc3BhY2UgYXJlIGNhY2hlZCAqL1xuICBwcm9qZWN0aW9uczoge1xuICAgIFtrZXk6IHN0cmluZ106IG51bWJlcjtcbiAgfTtcbiAgRFZJX3Byb2plY3Rpb25zPzoge1xuICAgIFtpdGVyYXRpb246IG51bWJlcl06IFthbnksIGFueV07XG4gIH07XG4gIERWSV9jb2xvcj86IHtcbiAgICBbaXRlcmF0aW9uOiBudW1iZXJdOiBzdHJpbmc7XG4gIH1cbiAgdHJhaW5pbmdfZGF0YT86IHtcbiAgICBbaXRlcmF0aW9uOiBudW1iZXJdOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICB9XG4gIHRlc3RpbmdfZGF0YT86IHtcbiAgICBbaXRlcmF0aW9uOiBudW1iZXJdOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICB9XG4gIG5ld19zZWxlY3Rpb24/OiB7XG4gICAgW2l0ZXJhdGlvbjogbnVtYmVyXTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcbiAgfVxuICBjdXJyZW50X3RyYWluaW5nPzogYm9vbGVhbjtcbiAgY3VycmVudF90ZXN0aW5nPzogYm9vbGVhbjtcbiAgcHJlZGljdGlvbj86IHtcbiAgICBbaXRlcmF0aW9uOiBudW1iZXJdOiBzdHJpbmc7XG4gIH07XG4gIGN1cnJlbnRfcHJlZGljdGlvbj86IHN0cmluZztcbiAgY3VycmVudF93cm9uZ19wcmVkaWN0aW9uPzogYm9vbGVhbjtcbiAgY3VycmVudF9uZXdfc2VsZWN0aW9uPzogYm9vbGVhbjtcbiAgb3JpZ2luYWxfbGFiZWw/OiBzdHJpbmc7XG4gIG5vaXN5PzogYm9vbGVhbjtcbiAgaW52X2FjYz86IHtcbiAgICBbaXRlcmF0aW9uOiBudW1iZXJdOiBudW1iZXI7XG4gIH07XG4gIGN1cnJlbnRfaW52X2FjYz86IG51bWJlcjtcbiAgdW5jZXJ0YWludHk/OiB7XG4gICAgW2l0ZXJhdGlvbjogbnVtYmVyXTogbnVtYmVyIHwgc3RyaW5nO1xuICB9O1xuICBkaXZlcnNpdHk/OiB7XG4gICAgW2l0ZXJhdGlvbjogbnVtYmVyXTogbnVtYmVyIHwgc3RyaW5nO1xuICB9O1xuICB0b3Q/OiB7XG4gICAgW2l0ZXJhdGlvbjogbnVtYmVyXTogbnVtYmVyIHwgc3RyaW5nO1xuICB9O1xuICB1bmNlcnRhaW50eV9yYW5raW5nPzoge1xuICAgIFtpdGVyYXRpb246IG51bWJlcl06IG51bWJlcjtcbiAgfTtcbiAgY3VycmVudF91bmNlcnRhaW50eV9yYW5raW5nPzogbnVtYmVyO1xuICBkaXZlcnNpdHlfcmFua2luZz86IHtcbiAgICBbaXRlcmF0aW9uOiBudW1iZXJdOiBudW1iZXI7XG4gIH07XG4gIGN1cnJlbnRfZGl2ZXJzaXR5X3Jhbmtpbmc/OiBudW1iZXI7XG4gIHRvdF9yYW5raW5nPzoge1xuICAgIFtpdGVyYXRpb246IG51bWJlcl06IG51bWJlcjtcbiAgfTtcbiAgY3VycmVudF90b3RfcmFua2luZz86IG51bWJlcjtcbn1cbmNvbnN0IElTX0ZJUkVGT1ggPSBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignZmlyZWZveCcpID49IDA7XG4vKiogQ29udHJvbHMgd2hldGhlciBuZWFyZXN0IG5laWdoYm9ycyBjb21wdXRhdGlvbiBpcyBkb25lIG9uIHRoZSBHUFUgb3IgQ1BVLiAqL1xuZXhwb3J0IGNvbnN0IFRTTkVfU0FNUExFX1NJWkUgPSA1MDA7XG5leHBvcnQgY29uc3QgVU1BUF9TQU1QTEVfU0laRSA9IDUwMDtcbmV4cG9ydCBjb25zdCBQQ0FfU0FNUExFX1NJWkUgPSA1MDAwMDtcbi8qKiBOdW1iZXIgb2YgZGltZW5zaW9ucyB0byBzYW1wbGUgd2hlbiBkb2luZyBhcHByb3hpbWF0ZSBQQ0EuICovXG5leHBvcnQgY29uc3QgUENBX1NBTVBMRV9ESU0gPSAyMDA7XG4vKiogTnVtYmVyIG9mIHBjYSBjb21wb25lbnRzIHRvIGNvbXB1dGUuICovXG5jb25zdCBOVU1fUENBX0NPTVBPTkVOVFMgPSAxMDtcbi8qKiBJZCBvZiBtZXNzYWdlIGJveCB1c2VkIGZvciB1bWFwIG9wdGltaXphdGlvbiBwcm9ncmVzcyBiYXIuICovXG5jb25zdCBVTUFQX01TR19JRCA9ICd1bWFwLW9wdGltaXphdGlvbic7XG4vKipcbiAqIFJlc2VydmVkIG1ldGFkYXRhIGF0dHJpYnV0ZXMgdXNlZCBmb3Igc2VxdWVuY2UgaW5mb3JtYXRpb25cbiAqIE5PVEU6IFVzZSBcIl9fc2VxX25leHRfX1wiIGFzIFwiX19uZXh0X19cIiBpcyBkZXByZWNhdGVkLlxuICovXG5jb25zdCBTRVFVRU5DRV9NRVRBREFUQV9BVFRSUyA9IFsnX19uZXh0X18nLCAnX19zZXFfbmV4dF9fJ107XG5mdW5jdGlvbiBnZXRTZXF1ZW5jZU5leHRQb2ludEluZGV4KFxuICBwb2ludE1ldGFkYXRhOiBQb2ludE1ldGFkYXRhXG4pOiBudW1iZXIgfCBudWxsIHtcbiAgbGV0IHNlcXVlbmNlQXR0ciA9IG51bGw7XG4gIGZvciAobGV0IG1ldGFkYXRhQXR0ciBvZiBTRVFVRU5DRV9NRVRBREFUQV9BVFRSUykge1xuICAgIGlmIChtZXRhZGF0YUF0dHIgaW4gcG9pbnRNZXRhZGF0YSAmJiBwb2ludE1ldGFkYXRhW21ldGFkYXRhQXR0cl0gIT09ICcnKSB7XG4gICAgICBzZXF1ZW5jZUF0dHIgPSBwb2ludE1ldGFkYXRhW21ldGFkYXRhQXR0cl07XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgaWYgKHNlcXVlbmNlQXR0ciA9PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgcmV0dXJuICtzZXF1ZW5jZUF0dHI7XG59XG5cbi8qKlxuICogVGVzdCBodHRwIHJlcXVlc3RcbiAqL1xuLyoqXG4gKiBEYXRhc2V0IGNvbnRhaW5zIGEgRGF0YVBvaW50cyBhcnJheSB0aGF0IHNob3VsZCBiZSB0cmVhdGVkIGFzIGltbXV0YWJsZS4gVGhpc1xuICogYWN0cyBhcyBhIHdvcmtpbmcgc3Vic2V0IG9mIHRoZSBvcmlnaW5hbCBkYXRhLCB3aXRoIGNhY2hlZCBwcm9wZXJ0aWVzXG4gKiBmcm9tIGNvbXB1dGF0aW9uYWxseSBleHBlbnNpdmUgb3BlcmF0aW9ucy4gQmVjYXVzZSBjcmVhdGluZyBhIHN1YnNldFxuICogcmVxdWlyZXMgbm9ybWFsaXppbmcgYW5kIHNoaWZ0aW5nIHRoZSB2ZWN0b3Igc3BhY2UsIHdlIG1ha2UgYSBjb3B5IG9mIHRoZVxuICogZGF0YSBzbyB3ZSBjYW4gc3RpbGwgYWx3YXlzIGNyZWF0ZSBuZXcgc3Vic2V0cyBiYXNlZCBvbiB0aGUgb3JpZ2luYWwgZGF0YS5cbiAqL1xuZXhwb3J0IGNsYXNzIERhdGFTZXQge1xuICBwb2ludHM6IERhdGFQb2ludFtdO1xuICBzZXF1ZW5jZXM6IFNlcXVlbmNlW107XG4gIHNodWZmbGVkRGF0YUluZGljZXM6IG51bWJlcltdID0gW107XG4gIC8qKlxuICAgKiBUaGlzIGtlZXBzIGEgbGlzdCBvZiBhbGwgY3VycmVudCBwcm9qZWN0aW9ucyBzbyB5b3UgY2FuIGVhc2lseSB0ZXN0IHRvIHNlZVxuICAgKiBpZiBpdCdzIGJlZW4gY2FsY3VsYXRlZCBhbHJlYWR5LlxuICAgKi9cbiAgcHJvamVjdGlvbnM6IHtcbiAgICBbcHJvamVjdGlvbjogc3RyaW5nXTogYm9vbGVhbjtcbiAgfSA9IHt9O1xuICBuZWFyZXN0OiBrbm4uTmVhcmVzdEVudHJ5W11bXTtcbiAgc3ByaXRlQW5kTWV0YWRhdGFJbmZvOiBTcHJpdGVBbmRNZXRhZGF0YUluZm87XG4gIGZyYWNWYXJpYW5jZXNFeHBsYWluZWQ6IG51bWJlcltdO1xuICB0U05FSXRlcmF0aW9uOiBudW1iZXIgPSAwO1xuICB0U05FU2hvdWxkUGF1c2VBbmRDaGVjayA9IGZhbHNlO1xuICB0U05FU2hvdWxkUGF1c2UgPSBmYWxzZTtcbiAgdFNORVNob3VsZFN0b3AgPSB0cnVlO1xuICB0U05FU2hvdWxkS2lsbCA9IGZhbHNlO1xuICB0U05FSnVzdFBhdXNlID0gZmFsc2U7XG4gIHRTTkVUb3RhbEl0ZXI6IG51bWJlciA9IDA7XG4gIC8qKlxuICAgKiBUaGlzIHBhcnQgY29udGFpbnMgaW5mb3JtYXRpb24gZm9yIERWSSB2aXN1YWxpemF0aW9uXG4gICAqL1xuICBEVklzdWJqZWN0TW9kZWxQYXRoID0gXCJcIjtcbiAgRFZJUmVzb2x1dGlvbiA9IDQwMDtcbiAgRFZJU2VydmVyID0gd2luZG93LnNlc3Npb25TdG9yYWdlLmlwQWRkcmVzcyB8fCAnbG9jYWxob3N0OjUwMDEnO1xuICBEVklWYWxpZFBvaW50TnVtYmVyOiB7XG4gICAgW2l0ZXJhdGlvbjogbnVtYmVyXTogbnVtYmVyO1xuICB9ID0gW107XG4gIERWSUN1cnJlbnRSZWFsRGF0YU51bWJlciA9IDA7XG4gIERWSVJlYWxEYXRhTnVtYmVyOiB7XG4gICAgW2l0ZXJhdGlvbjogbnVtYmVyXTogbnVtYmVyO1xuICB9ID0gW107XG4gIERWSUV2YWx1YXRpb246IHtcbiAgICBbaXRlcmF0aW9uOiBudW1iZXJdOiBhbnk7XG4gIH0gPSBbXTtcbiAgRFZJRGF0YUxpc3Q6IGFueSA9IFtdO1xuICBEVklBdmFpbGFibGVJdGVyYXRpb246IEFycmF5PG51bWJlcj4gPSBbXTtcbiAgRFZJUHJlZGljYXRlczogYW55W10gPSBbXTtcbiAgaXNfdW5jZXJ0YWludHlfZGl2ZXJzaXR5X3RvdF9leGlzdDoge1xuICAgIFtpdGVyYXRpb246IG51bWJlcl06IGJvb2xlYW47XG4gIH0gPSBbXTtcbiAgRFZJZmlsdGVySW5kaWNlczogbnVtYmVyW107XG4gIHNlbGVjdEluZGljZXM6IG51bWJlcltdO1xuXG5cbiAgc3VwZXJ2aXNlRmFjdG9yOiBudW1iZXI7XG4gIHN1cGVydmlzZUxhYmVsczogc3RyaW5nW107XG4gIHN1cGVydmlzZUlucHV0OiBzdHJpbmcgPSAnJztcbiAgZGltOiBbbnVtYmVyLCBudW1iZXJdID0gWzAsIDBdO1xuICBoYXNUU05FUnVuOiBib29sZWFuID0gZmFsc2U7XG4gIHByaXZhdGUgdHNuZTogVFNORTtcbiAgaGFzVW1hcFJ1biA9IGZhbHNlO1xuICBwcml2YXRlIHVtYXA6IFVNQVA7XG4gIC8qKiBDcmVhdGVzIGEgbmV3IERhdGFzZXQgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgcG9pbnRzOiBEYXRhUG9pbnRbXSxcbiAgICBzcHJpdGVBbmRNZXRhZGF0YUluZm8/OiBTcHJpdGVBbmRNZXRhZGF0YUluZm9cbiAgKSB7XG4gICAgdGhpcy5wb2ludHMgPSBwb2ludHM7XG4gICAgdGhpcy5zaHVmZmxlZERhdGFJbmRpY2VzID0gdXRpbC5zaHVmZmxlKHV0aWwucmFuZ2UodGhpcy5wb2ludHMubGVuZ3RoKSk7XG4gICAgdGhpcy5zZXF1ZW5jZXMgPSB0aGlzLmNvbXB1dGVTZXF1ZW5jZXMocG9pbnRzKTtcbiAgICB0aGlzLmRpbSA9IFt0aGlzLnBvaW50cy5sZW5ndGgsIHRoaXMucG9pbnRzWzBdLnZlY3Rvci5sZW5ndGhdO1xuICAgIHRoaXMuc3ByaXRlQW5kTWV0YWRhdGFJbmZvID0gc3ByaXRlQW5kTWV0YWRhdGFJbmZvO1xuICAgIHRoaXMuRFZJZmlsdGVySW5kaWNlcyA9IFtdO1xuICB9XG4gIHByaXZhdGUgY29tcHV0ZVNlcXVlbmNlcyhwb2ludHM6IERhdGFQb2ludFtdKSB7XG4gICAgLy8gS2VlcCBhIGxpc3Qgb2YgaW5kaWNlcyBzZWVuIHNvIHdlIGRvbid0IGNvbXB1dGUgc2VxdWVuY2VzIGZvciBhIGdpdmVuXG4gICAgLy8gcG9pbnQgdHdpY2UuXG4gICAgbGV0IGluZGljZXNTZWVuID0gbmV3IEludDhBcnJheShwb2ludHMubGVuZ3RoKTtcbiAgICAvLyBDb21wdXRlIHNlcXVlbmNlcy5cbiAgICBsZXQgaW5kZXhUb1NlcXVlbmNlOiB7XG4gICAgICBbaW5kZXg6IG51bWJlcl06IFNlcXVlbmNlO1xuICAgIH0gPSB7fTtcbiAgICBsZXQgc2VxdWVuY2VzOiBTZXF1ZW5jZVtdID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChpbmRpY2VzU2VlbltpXSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGluZGljZXNTZWVuW2ldID0gMTtcbiAgICAgIC8vIElnbm9yZSBwb2ludHMgd2l0aG91dCBhIHNlcXVlbmNlIGF0dHJpYnV0ZS5cbiAgICAgIGxldCBuZXh0ID0gZ2V0U2VxdWVuY2VOZXh0UG9pbnRJbmRleChwb2ludHNbaV0ubWV0YWRhdGEpO1xuICAgICAgaWYgKG5leHQgPT0gbnVsbCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmIChuZXh0IGluIGluZGV4VG9TZXF1ZW5jZSkge1xuICAgICAgICBsZXQgZXhpc3RpbmdTZXF1ZW5jZSA9IGluZGV4VG9TZXF1ZW5jZVtuZXh0XTtcbiAgICAgICAgLy8gUHVzaGluZyBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBhcnJheS5cbiAgICAgICAgZXhpc3RpbmdTZXF1ZW5jZS5wb2ludEluZGljZXMudW5zaGlmdChpKTtcbiAgICAgICAgaW5kZXhUb1NlcXVlbmNlW2ldID0gZXhpc3RpbmdTZXF1ZW5jZTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBUaGUgY3VycmVudCBwb2ludCBpcyBwb2ludGluZyB0byBhIG5ldy91bnNlZW4gc2VxdWVuY2UuXG4gICAgICBsZXQgbmV3U2VxdWVuY2U6IFNlcXVlbmNlID0geyBwb2ludEluZGljZXM6IFtdIH07XG4gICAgICBpbmRleFRvU2VxdWVuY2VbaV0gPSBuZXdTZXF1ZW5jZTtcbiAgICAgIHNlcXVlbmNlcy5wdXNoKG5ld1NlcXVlbmNlKTtcbiAgICAgIGxldCBjdXJyZW50SW5kZXggPSBpO1xuICAgICAgd2hpbGUgKHBvaW50c1tjdXJyZW50SW5kZXhdKSB7XG4gICAgICAgIG5ld1NlcXVlbmNlLnBvaW50SW5kaWNlcy5wdXNoKGN1cnJlbnRJbmRleCk7XG4gICAgICAgIGxldCBuZXh0ID0gZ2V0U2VxdWVuY2VOZXh0UG9pbnRJbmRleChwb2ludHNbY3VycmVudEluZGV4XS5tZXRhZGF0YSk7XG4gICAgICAgIGlmIChuZXh0ICE9IG51bGwpIHtcbiAgICAgICAgICBpbmRpY2VzU2VlbltuZXh0XSA9IDE7XG4gICAgICAgICAgY3VycmVudEluZGV4ID0gbmV4dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjdXJyZW50SW5kZXggPSAtMTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc2VxdWVuY2VzO1xuICB9XG4gIHByb2plY3Rpb25DYW5CZVJlbmRlcmVkKHByb2plY3Rpb246IFByb2plY3Rpb25UeXBlKTogYm9vbGVhbiB7XG4gICAgaWYgKHByb2plY3Rpb24gIT09ICd0c25lJykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnRTTkVJdGVyYXRpb24gPiAwO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgbmV3IHN1YnNldCBkYXRhc2V0IGJ5IGNvcHlpbmcgb3V0IGRhdGEuIFdlIG1ha2UgYSBjb3B5IGJlY2F1c2VcbiAgICogd2UgaGF2ZSB0byBtb2RpZnkgdGhlIHZlY3RvcnMgYnkgbm9ybWFsaXppbmcgdGhlbS5cbiAgICpcbiAgICogQHBhcmFtIHN1YnNldCBBcnJheSBvZiBpbmRpY2VzIG9mIHBvaW50cyB0aGF0IHdlIHdhbnQgaW4gdGhlIHN1YnNldC5cbiAgICpcbiAgICogQHJldHVybiBBIHN1YnNldCBvZiB0aGUgb3JpZ2luYWwgZGF0YXNldC5cbiAgICovXG4gIGdldFN1YnNldChzdWJzZXQ/OiBudW1iZXJbXSk6IERhdGFTZXQge1xuICAgIGNvbnN0IHBvaW50c1N1YnNldCA9XG4gICAgICBzdWJzZXQgIT0gbnVsbCAmJiBzdWJzZXQubGVuZ3RoID4gMFxuICAgICAgICA/IHN1YnNldC5tYXAoKGkpID0+IHRoaXMucG9pbnRzW2ldKVxuICAgICAgICA6IHRoaXMucG9pbnRzO1xuICAgIGxldCBwb2ludHMgPSBwb2ludHNTdWJzZXQubWFwKChkcCkgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbWV0YWRhdGE6IGRwLm1ldGFkYXRhLFxuICAgICAgICBpbmRleDogZHAuaW5kZXgsXG4gICAgICAgIHZlY3RvcjogZHAudmVjdG9yLnNsaWNlKCksXG4gICAgICAgIHByb2plY3Rpb25zOiB7fSBhcyB7XG4gICAgICAgICAgW2tleTogc3RyaW5nXTogbnVtYmVyO1xuICAgICAgICB9LFxuICAgICAgfTtcbiAgICB9KTtcbiAgICBjb25zdCBkcF9saXN0OiBEYXRhUG9pbnRbXSA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBkcDogRGF0YVBvaW50ID0ge1xuICAgICAgICBtZXRhZGF0YTogcG9pbnRzU3Vic2V0W2ldLm1ldGFkYXRhLFxuICAgICAgICBpbmRleDogcG9pbnRzU3Vic2V0W2ldLmluZGV4LFxuICAgICAgICB2ZWN0b3I6IHBvaW50c1tpXS52ZWN0b3IsXG4gICAgICAgIG9yaWdpbmFsX3ZlY3RvcjogcG9pbnRzU3Vic2V0W2ldLnZlY3RvcixcbiAgICAgICAgcHJvamVjdGlvbnM6IHBvaW50c1tpXS5wcm9qZWN0aW9ucyxcbiAgICAgIH07XG4gICAgICBkcF9saXN0LnB1c2goZHApO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IERhdGFTZXQoZHBfbGlzdCwgdGhpcy5zcHJpdGVBbmRNZXRhZGF0YUluZm8pO1xuICB9XG4gIC8qKlxuICAgKiBDb21wdXRlcyB0aGUgY2VudHJvaWQsIHNoaWZ0cyBhbGwgcG9pbnRzIHRvIHRoYXQgY2VudHJvaWQsXG4gICAqIHRoZW4gbWFrZXMgdGhlbSBhbGwgdW5pdCBub3JtLlxuICAgKi9cbiAgbm9ybWFsaXplKCkge1xuICAgIC8vIENvbXB1dGUgdGhlIGNlbnRyb2lkIG9mIGFsbCBkYXRhIHBvaW50cy5cbiAgICBsZXQgY2VudHJvaWQgPSB2ZWN0b3IuY2VudHJvaWQodGhpcy5wb2ludHMsIChhKSA9PiBhLnZlY3Rvcik7XG4gICAgaWYgKGNlbnRyb2lkID09IG51bGwpIHtcbiAgICAgIHRocm93IEVycm9yKCdjZW50cm9pZCBzaG91bGQgbm90IGJlIG51bGwnKTtcbiAgICB9XG4gICAgLy8gU2hpZnQgYWxsIHBvaW50cyBieSB0aGUgY2VudHJvaWQgYW5kIG1ha2UgdGhlbSB1bml0IG5vcm0uXG4gICAgZm9yIChsZXQgaWQgPSAwOyBpZCA8IHRoaXMucG9pbnRzLmxlbmd0aDsgKytpZCkge1xuICAgICAgbGV0IGRhdGFQb2ludCA9IHRoaXMucG9pbnRzW2lkXTtcbiAgICAgIGRhdGFQb2ludC52ZWN0b3IgPSB2ZWN0b3Iuc3ViKGRhdGFQb2ludC52ZWN0b3IsIGNlbnRyb2lkKTtcbiAgICAgIGlmICh2ZWN0b3Iubm9ybTIoZGF0YVBvaW50LnZlY3RvcikgPiAwKSB7XG4gICAgICAgIC8vIElmIHdlIHRha2UgdGhlIHVuaXQgbm9ybSBvZiBhIHZlY3RvciBvZiBhbGwgMHMsIHdlIGdldCBhIHZlY3RvciBvZlxuICAgICAgICAvLyBhbGwgTmFOcy4gV2UgcHJldmVudCB0aGF0IHdpdGggYSBndWFyZC5cbiAgICAgICAgdmVjdG9yLnVuaXQoZGF0YVBvaW50LnZlY3Rvcik7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8qKiBQcm9qZWN0cyB0aGUgZGF0YXNldCBvbnRvIGEgZ2l2ZW4gdmVjdG9yIGFuZCBjYWNoZXMgdGhlIHJlc3VsdC4gKi9cbiAgcHJvamVjdExpbmVhcihkaXI6IHZlY3Rvci5WZWN0b3IsIGxhYmVsOiBzdHJpbmcpIHtcbiAgICB0aGlzLnByb2plY3Rpb25zW2xhYmVsXSA9IHRydWU7XG4gICAgdGhpcy5wb2ludHMuZm9yRWFjaCgoZGF0YVBvaW50KSA9PiB7XG4gICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnNbbGFiZWxdID0gdmVjdG9yLmRvdChkYXRhUG9pbnQudmVjdG9yLCBkaXIpO1xuICAgIH0pO1xuICB9XG4gIHNldERWSUZpbHRlcmVkRGF0YShwb2ludEluZGljZXM6IG51bWJlcltdKSB7XG4gICAgLy8gcmVzZXQgZmlyc3RcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgZGF0YVBvaW50ID0gdGhpcy5wb2ludHNbaV07XG4gICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnNbJ3RzbmUtMCddID0gZGF0YVBvaW50LkRWSV9wcm9qZWN0aW9uc1t0aGlzLnRTTkVJdGVyYXRpb25dWzBdO1xuICAgICAgZGF0YVBvaW50LnByb2plY3Rpb25zWyd0c25lLTEnXSA9IGRhdGFQb2ludC5EVklfcHJvamVjdGlvbnNbdGhpcy50U05FSXRlcmF0aW9uXVsxXTtcbiAgICAgIGRhdGFQb2ludC5wcm9qZWN0aW9uc1sndHNuZS0yJ10gPSAwO1xuICAgIH1cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAocG9pbnRJbmRpY2VzPy5pbmRleE9mKGkpID09IC0xICYmIGkgPCB0aGlzLkRWSUN1cnJlbnRSZWFsRGF0YU51bWJlcikge1xuICAgICAgICBsZXQgZGF0YVBvaW50ID0gdGhpcy5wb2ludHNbaV07XG4gICAgICAgIGRhdGFQb2ludC5wcm9qZWN0aW9ucyA9IHt9O1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLkRWSWZpbHRlckluZGljZXMgPSBwb2ludEluZGljZXM7XG4gIH1cblxuICAvKiogUnVucyBEVkkgb24gdGhlIGRhdGEuICovXG4gIGFzeW5jIHByb2plY3REVkkoXG4gICAgaXRlcmF0aW9uOiBudW1iZXIsIHByZWRpY2F0ZXM6IHsgW2tleTogc3RyaW5nXTogYW55IH0sXG4gICAgc3RlcENhbGxiYWNrOiAoaXRlcjogbnVtYmVyIHwgbnVsbCwgZXZhbHVhdGlvbjogYW55LCBuZXdTZWxlY3Rpb246IGFueVtdLCBmaWx0ZXJJbmRpY2VzOiBudW1iZXJbXSwgdG90YWxJdGVyPzogbnVtYmVyKSA9PiB2b2lkXG4gICkge1xuICAgIHRoaXMucHJvamVjdGlvbnNbJ3RzbmUnXSA9IHRydWU7XG4gICAgZnVuY3Rpb24gY29tcG9uZW50VG9IZXgoYzogbnVtYmVyKSB7XG4gICAgICBjb25zdCBoZXggPSBjLnRvU3RyaW5nKDE2KTtcbiAgICAgIHJldHVybiBoZXgubGVuZ3RoID09IDEgPyBcIjBcIiArIGhleCA6IGhleDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZ2JUb0hleChyOiBudW1iZXIsIGc6IG51bWJlciwgYjogbnVtYmVyKSB7XG4gICAgICByZXR1cm4gXCIjXCIgKyBjb21wb25lbnRUb0hleChyKSArIGNvbXBvbmVudFRvSGV4KGcpICsgY29tcG9uZW50VG9IZXgoYik7XG4gICAgfVxuXG5cbiAgICB0aGlzLml0ZXJhdGlvbkNoYW5nZVJlc2V0KClcbiAgICAvLyB3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbSgnYWNjZXB0SW5kaWNhdGVzJyxcIlwiKVxuICAgIC8vIHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZXRJdGVtKCdyZWplY3RJbmRpY2F0ZXMnLFwiXCIpXG4gICAgd2luZG93LmFjY2VwdEluZGljYXRlcyA9IFtdXG4gICAgd2luZG93LnJlamVjdEluZGljYXRlcyA9IFtdXG5cbiAgICBpZiAodGhpcy5EVklBdmFpbGFibGVJdGVyYXRpb24uaW5kZXhPZihpdGVyYXRpb24pID09IC0xKSB7XG5cbiAgICAgIGxldCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgICAgIGhlYWRlcnMuYXBwZW5kKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgaGVhZGVycy5hcHBlbmQoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAvLyBhd2FpdCBmZXRjaChcInN0YW5kYWxvbmVfcHJvamVjdG9yX2NvbmZpZy5qc29uXCIsIHsgbWV0aG9kOiAnR0VUJyB9KVxuICAgICAgLy8gICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpXG4gICAgICAvLyAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgLy8gICAgIGNvbnN0IGlwX2FkZHJlc3MgPSBkYXRhLkRWSVNlcnZlcklQICsgXCI6XCIgKyBkYXRhLkRWSVNlcnZlclBvcnQ7XG4gICAgICAvLyAgICAgdGhpcy5EVklTZXJ2ZXIgPSBpcF9hZGRyZXNzO1xuXG4gICAgICBpZiAod2luZG93Lm1vZGVsTWF0aCkge1xuICAgICAgICB0aGlzLkRWSXN1YmplY3RNb2RlbFBhdGggPSB3aW5kb3cubW9kZWxNYXRoXG4gICAgICB9XG5cbiAgICAgIHdpbmRvdy5pdGVyYXRpb24gPSBpdGVyYXRpb25cbiAgICAgIGF3YWl0IGZldGNoKFwiaHR0cDovL1wiICsgdGhpcy5EVklTZXJ2ZXIgKyBcIi91cGRhdGVQcm9qZWN0aW9uXCIsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBcInBhdGhcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLmNvbnRlbnRfcGF0aCB8fCB0aGlzLkRWSXN1YmplY3RNb2RlbFBhdGgsIFwiaXRlcmF0aW9uXCI6IGl0ZXJhdGlvbixcbiAgICAgICAgICBcInJlc29sdXRpb25cIjogdGhpcy5EVklSZXNvbHV0aW9uLCBcInByZWRpY2F0ZXNcIjogcHJlZGljYXRlcyxcbiAgICAgICAgICBcInVzZXJuYW1lXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS51c2VybmFtZSxcbiAgICAgICAgICBcInZpc19tZXRob2RcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLnZpc19tZXRob2QsXG4gICAgICAgICAgJ3NldHRpbmcnOndpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZWxlY3RlZFNldHRpbmcsXG4gICAgICAgICAgXCJjb250ZW50X3BhdGhcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLmNvbnRlbnRfcGF0aCB8fCB0aGlzLkRWSXN1YmplY3RNb2RlbFBhdGgsXG4gICAgICAgIH0pLFxuICAgICAgICBoZWFkZXJzOiBoZWFkZXJzLFxuICAgICAgICBtb2RlOiAnY29ycydcbiAgICAgIH0pLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKS50aGVuKGRhdGEgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBkYXRhLnJlc3VsdDtcblxuICAgICAgICBjb25zdCBncmlkX2luZGV4ID0gW1tkYXRhLmdyaWRfaW5kZXhbMF0sIGRhdGEuZ3JpZF9pbmRleFsxXV0sIFtkYXRhLmdyaWRfaW5kZXhbMl0sIGRhdGEuZ3JpZF9pbmRleFszXV1dO1xuICAgICAgICBjb25zdCBncmlkX2NvbG9yID0gW1sxMzcsIDEyMCwgMTE3XSwgWzEzNiwgMTE5LCAxMTZdLCBbMTM2LCAxMTgsIDExNV0sIFsxMzUsIDExNywgMTE0XV07XG4gICAgICAgIGlmICghd2luZG93LnNjZW5lQmFja2dyb3VuZEltZykge1xuICAgICAgICAgIHdpbmRvdy5zY2VuZUJhY2tncm91bmRJbWcgPSBbXVxuICAgICAgICB9XG4gICAgICAgIHdpbmRvdy5zY2VuZUJhY2tncm91bmRJbWdbd2luZG93Lml0ZXJhdGlvbl0gPSBkYXRhLmdyaWRfY29sb3JcbiAgICAgICBsZXQgdGVtcF9sYWJlbF9jb2xvcl9saXN0OmFueSA9IFtdXG4gICAgICAgbGV0IHRlbXBfbGFiZWxfbGlzdDphbnkgPSBbXVxuICAgICAgIGxldCBrPTBcbiAgICAgICAgZm9yKGxldCBpID0gMCA7aSA8IHJlc3VsdC5sZW5ndGgtMTtpKyspe1xuICAgICAgICBcbiAgICAgICAgICBpZiAoZGF0YS5wcm9wZXJ0aWVzW2ldID09PSAwIHx8ICh3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2VsZWN0ZWRTZXR0aW5nICE9PSAnYWN0aXZlIGxlYXJuaW5nJyAmJiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2VsZWN0ZWRTZXR0aW5nICE9PSAnZGVuc2UgYWwnKSkge1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgY29sb3I6YW55ID0gZGF0YS5sYWJlbF9jb2xvcl9saXN0W2tdIHx8IFsyMDQsMjA0LDIwNF1cbiAgICAgICAgICAgIGxldCBsYWJlbDphbnkgPSBkYXRhLmxhYmVsX2xpc3Rba10gfHwgJ3VubGFiZWxlZCdcbiAgICAgICAgICAgIHRlbXBfbGFiZWxfY29sb3JfbGlzdC5wdXNoKGNvbG9yKVxuICAgICAgICAgICAgdGVtcF9sYWJlbF9saXN0LnB1c2gobGFiZWwpXG4gICAgICAgICAgICBrID0gaysxXG4gICAgICAgICAgfSBlbHNle1xuICAgICAgICAgICAgdGVtcF9sYWJlbF9jb2xvcl9saXN0LnB1c2goWzIwNCwyMDQsMjA0XSlcbiAgICAgICAgICAgIHRlbXBfbGFiZWxfbGlzdC5wdXNoKCd1bmxhYmVsZWQnKVxuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgfVxuICBcbiAgICAgICAgY29uc3QgbGFiZWxfY29sb3JfbGlzdCA9IHRlbXBfbGFiZWxfY29sb3JfbGlzdFxuICAgICAgICBjb25zdCBsYWJlbF9saXN0ID0gdGVtcF9sYWJlbF9saXN0O1xuXG4gICAgICAgIGNvbnN0IHByZWRpY3Rpb25fbGlzdCA9IGRhdGEucHJlZGljdGlvbl9saXN0O1xuXG4gICAgICAgIGNvbnN0IGJhY2tncm91bmRfcG9pbnRfbnVtYmVyID0gZ3JpZF9pbmRleC5sZW5ndGg7XG5cbiAgICAgICAgY29uc3QgcmVhbF9kYXRhX251bWJlciA9IGxhYmVsX2NvbG9yX2xpc3QubGVuZ3RoO1xuICAgICAgICB0aGlzLnRTTkVUb3RhbEl0ZXIgPSBkYXRhLm1heGltdW1faXRlcmF0aW9uO1xuICAgICAgICB3aW5kb3cudFNORVRvdGFsSXRlciA9IGRhdGEubWF4aW11bV9pdGVyYXRpb25cbiAgICAgICAgXG5cbiAgICAgICAgdGhpcy50U05FSXRlcmF0aW9uID0gaXRlcmF0aW9uO1xuICAgICAgICB0aGlzLkRWSVZhbGlkUG9pbnROdW1iZXJbaXRlcmF0aW9uXSA9IHJlYWxfZGF0YV9udW1iZXIgKyBiYWNrZ3JvdW5kX3BvaW50X251bWJlcjtcbiAgICAgICAgdGhpcy5EVklBdmFpbGFibGVJdGVyYXRpb24ucHVzaChpdGVyYXRpb24pO1xuICAgICAgICBjb25zdCBjdXJyZW50X2xlbmd0aCA9IHRoaXMucG9pbnRzLmxlbmd0aDtcblxuICAgICAgICBjb25zdCB0cmFpbmluZ19kYXRhID0gZGF0YS50cmFpbmluZ19kYXRhO1xuICAgICAgICBjb25zdCB0ZXN0aW5nX2RhdGEgPSBkYXRhLnRlc3RpbmdfZGF0YTtcbiAgICAgICAgY29uc3QgbmV3X3NlbGVjdGlvbiA9IGRhdGEubmV3X3NlbGVjdGlvbjtcbiAgICAgICAgY29uc3Qgbm9pc3lfZGF0YSA9IGRhdGEubm9pc3lfZGF0YTtcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxfbGFiZWxfbGlzdCA9IGRhdGEub3JpZ2luYWxfbGFiZWxfbGlzdDtcblxuICAgICAgICBjb25zdCBldmFsdWF0aW9uID0gZGF0YS5ldmFsdWF0aW9uO1xuICAgICAgICB0aGlzLkRWSUV2YWx1YXRpb25baXRlcmF0aW9uXSA9IGV2YWx1YXRpb247XG4gICAgICAgIGNvbnN0IGludl9hY2MgPSBkYXRhLmludl9hY2NfbGlzdCB8fCBbXTtcbiAgICAgICAgaWYgKCF3aW5kb3cucHJvcGVydGllcykge1xuICAgICAgICAgIHdpbmRvdy5wcm9wZXJ0aWVzID0gW11cbiAgICAgICAgfVxuICAgICAgICB3aW5kb3cucHJvcGVydGllc1tpdGVyYXRpb25dID0gZGF0YS5wcm9wZXJ0aWVzO1xuXG4gICAgICAgIHdpbmRvdy51bkxhYmVsRGF0YSA9IFtdXG4gICAgICAgIHdpbmRvdy50ZXN0aW5nRGF0YSA9IFtdXG4gICAgICAgIHdpbmRvdy5sYWJlbGVkRGF0YSA9IFtdXG5cbiAgICAgICAgaWYgKCF3aW5kb3cubm93U2hvd0luZGljYXRlcykge1xuICAgICAgICAgIHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzID0gW11cbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEucHJvcGVydGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGRhdGEucHJvcGVydGllc1tpXSA9PT0gMSkge1xuICAgICAgICAgICAgICB3aW5kb3cudW5MYWJlbERhdGEucHVzaChpKVxuICAgICAgICAgICAgfSBlbHNlIGlmIChkYXRhLnByb3BlcnRpZXNbaV0gPT09IDIpIHtcbiAgICAgICAgICAgICAgd2luZG93LnRlc3RpbmdEYXRhLnB1c2goaSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHdpbmRvdy5sYWJlbGVkRGF0YS5wdXNoKGkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aW5kb3cubm93U2hvd0luZGljYXRlcy5wdXNoKGkpXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICBjb25zdCBmaWx0ZXJJbmRpY2VzID0gZGF0YS5zZWxlY3RlZFBvaW50cztcbiAgICAgICAgY29uc29sZS5sb2coJ3JlYWxfZGF0YV9udW1iZXIgKyBiYWNrZ3JvdW5kX3BvaW50X251bWJlciAtIGN1cnJlbnRfbGVuZ3RoJyxyZWFsX2RhdGFfbnVtYmVyICsgYmFja2dyb3VuZF9wb2ludF9udW1iZXIgLSBjdXJyZW50X2xlbmd0aClcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlYWxfZGF0YV9udW1iZXIgKyBiYWNrZ3JvdW5kX3BvaW50X251bWJlciAtIGN1cnJlbnRfbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBuZXdEYXRhUG9pbnQ6IERhdGFQb2ludCA9IHtcbiAgICAgICAgICAgIG1ldGFkYXRhOiB7IGxhYmVsOiBcImJhY2tncm91bmRcIiB9LFxuICAgICAgICAgICAgaW5kZXg6IGN1cnJlbnRfbGVuZ3RoICsgaSxcbiAgICAgICAgICAgIHByb2plY3Rpb25zOiB7XG4gICAgICAgICAgICAgICd0c25lLTAnOiAwLFxuICAgICAgICAgICAgICAndHNuZS0xJzogMCxcbiAgICAgICAgICAgICAgJ3RzbmUtMic6IDBcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfTtcbiAgICAgICAgICB0aGlzLnBvaW50cy5wdXNoKG5ld0RhdGFQb2ludCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGxldCBkYXRhUG9pbnQgPSB0aGlzLnBvaW50c1tpXTtcbiAgICAgICAgICBpZiAoZGF0YVBvaW50LkRWSV9wcm9qZWN0aW9ucyA9PSB1bmRlZmluZWQgfHwgZGF0YVBvaW50LkRWSV9jb2xvciA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGRhdGFQb2ludC5EVklfcHJvamVjdGlvbnMgPSB7fTtcbiAgICAgICAgICAgIGRhdGFQb2ludC5EVklfY29sb3IgPSB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGFQb2ludC50cmFpbmluZ19kYXRhID09IHVuZGVmaW5lZCB8fCBkYXRhUG9pbnQudGVzdGluZ19kYXRhID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGF0YVBvaW50LnRyYWluaW5nX2RhdGEgPSB7fTtcbiAgICAgICAgICAgIGRhdGFQb2ludC50ZXN0aW5nX2RhdGEgPSB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGFQb2ludC5wcmVkaWN0aW9uID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGF0YVBvaW50LnByZWRpY3Rpb24gPSB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGFQb2ludC5uZXdfc2VsZWN0aW9uID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGF0YVBvaW50Lm5ld19zZWxlY3Rpb24gPSB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGFQb2ludC5pbnZfYWNjID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGF0YVBvaW50Lmludl9hY2MgPSB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGFQb2ludC51bmNlcnRhaW50eSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGRhdGFQb2ludC51bmNlcnRhaW50eSA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGF0YVBvaW50LnVuY2VydGFpbnR5X3JhbmtpbmcgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBkYXRhUG9pbnQudW5jZXJ0YWludHlfcmFua2luZyA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGF0YVBvaW50LmRpdmVyc2l0eSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGRhdGFQb2ludC5kaXZlcnNpdHkgPSB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGFQb2ludC5kaXZlcnNpdHlfcmFua2luZyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGRhdGFQb2ludC5kaXZlcnNpdHlfcmFua2luZyA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGF0YVBvaW50LnRvdCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGRhdGFQb2ludC50b3QgPSB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGFQb2ludC50b3RfcmFua2luZyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGRhdGFQb2ludC50b3RfcmFua2luZyA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVhbF9kYXRhX251bWJlcjsgaSsrKSB7XG4gICAgICAgICAgbGV0IGRhdGFQb2ludCA9IHRoaXMucG9pbnRzW2ldO1xuICAgICAgICAgIGRhdGFQb2ludC5wcm9qZWN0aW9uc1sndHNuZS0wJ10gPSByZXN1bHRbaV1bMF07XG4gICAgICAgICAgZGF0YVBvaW50LnByb2plY3Rpb25zWyd0c25lLTEnXSA9IHJlc3VsdFtpXVsxXTtcbiAgICAgICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnNbJ3RzbmUtMiddID0gMDtcbiAgICAgICAgICBpZiAod2luZG93LnVuTGFiZWxEYXRhPy5sZW5ndGggJiYgd2luZG93LnVuTGFiZWxEYXRhLmluZGV4T2YoaSkgIT09IC0xKSB7XG4gICAgICAgICAgICAvLyBsYWJlbF9jb2xvcl9saXN0W2ldID0gWzIwNCwgMjA0LCAyMDRdXG4gICAgICAgICAgICBkYXRhUG9pbnQuY29sb3IgPSByZ2JUb0hleCgyMDQsIDIwNCwgMjA0KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGF0YVBvaW50LmNvbG9yID0gcmdiVG9IZXgobGFiZWxfY29sb3JfbGlzdFtpXVswXSwgbGFiZWxfY29sb3JfbGlzdFtpXVsxXSwgbGFiZWxfY29sb3JfbGlzdFtpXVsyXSk7XG4gICAgICAgICAgfVxuXG5cbiAgICAgICAgICBkYXRhUG9pbnQuRFZJX3Byb2plY3Rpb25zW2l0ZXJhdGlvbl0gPSBbcmVzdWx0W2ldWzBdLCByZXN1bHRbaV1bMV1dO1xuICAgICAgICAgIGRhdGFQb2ludC5EVklfY29sb3JbaXRlcmF0aW9uXSA9IGRhdGFQb2ludC5jb2xvcjtcbiAgICAgICAgICBkYXRhUG9pbnQudHJhaW5pbmdfZGF0YVtpdGVyYXRpb25dID0gZmFsc2U7XG4gICAgICAgICAgZGF0YVBvaW50LnRlc3RpbmdfZGF0YVtpdGVyYXRpb25dID0gZmFsc2U7XG4gICAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfdHJhaW5pbmcgPSBmYWxzZTtcbiAgICAgICAgICBkYXRhUG9pbnQuY3VycmVudF90ZXN0aW5nID0gZmFsc2U7XG4gICAgICAgICAgZGF0YVBvaW50Lm1ldGFkYXRhWydsYWJlbCddID0gbGFiZWxfbGlzdFtpXTtcbiAgICAgICAgICBkYXRhUG9pbnQucHJlZGljdGlvbltpdGVyYXRpb25dID0gcHJlZGljdGlvbl9saXN0W2ldO1xuICAgICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3ByZWRpY3Rpb24gPSBwcmVkaWN0aW9uX2xpc3RbaV07XG4gICAgICAgICAgZGF0YVBvaW50Lmludl9hY2NbaXRlcmF0aW9uXSA9IGludl9hY2NbaV07XG4gICAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfaW52X2FjYyA9IGludl9hY2NbaV07XG4gICAgICAgICAgaWYgKHByZWRpY3Rpb25fbGlzdFtpXSA9PSBsYWJlbF9saXN0W2ldKSB7XG4gICAgICAgICAgICBkYXRhUG9pbnQuY3VycmVudF93cm9uZ19wcmVkaWN0aW9uID0gZmFsc2U7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3dyb25nX3ByZWRpY3Rpb24gPSB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBkYXRhUG9pbnQubmV3X3NlbGVjdGlvbltpdGVyYXRpb25dID0gZmFsc2U7XG4gICAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfbmV3X3NlbGVjdGlvbiA9IGZhbHNlO1xuICAgICAgICAgIGlmIChvcmlnaW5hbF9sYWJlbF9saXN0KSB7XG4gICAgICAgICAgICBkYXRhUG9pbnQub3JpZ2luYWxfbGFiZWwgPSBvcmlnaW5hbF9sYWJlbF9saXN0W2ldO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGRhdGFQb2ludC5ub2lzeSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBiYWNrZ3JvdW5kX3BvaW50X251bWJlcjsgaSsrKSB7XG4gICAgICAgICAgbGV0IGRhdGFQb2ludCA9IHRoaXMucG9pbnRzW2kgKyByZWFsX2RhdGFfbnVtYmVyXTtcbiAgICAgICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnNbJ3RzbmUtMCddID0gZ3JpZF9pbmRleFtpXVswXTtcbiAgICAgICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnNbJ3RzbmUtMSddID0gZ3JpZF9pbmRleFtpXVsxXTtcbiAgICAgICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnNbJ3RzbmUtMiddID0gMDtcbiAgICAgICAgICBkYXRhUG9pbnQuY29sb3IgPSByZ2JUb0hleChncmlkX2NvbG9yW2ldWzBdLCBncmlkX2NvbG9yW2ldWzFdLCBncmlkX2NvbG9yW2ldWzJdKTtcbiAgICAgICAgICBkYXRhUG9pbnQuRFZJX3Byb2plY3Rpb25zW2l0ZXJhdGlvbl0gPSBbZ3JpZF9pbmRleFtpXVswXSwgZ3JpZF9pbmRleFtpXVsxXV07XG4gICAgICAgICAgZGF0YVBvaW50LkRWSV9jb2xvcltpdGVyYXRpb25dID0gZGF0YVBvaW50LmNvbG9yO1xuICAgICAgICAgIGRhdGFQb2ludC50cmFpbmluZ19kYXRhW2l0ZXJhdGlvbl0gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgZGF0YVBvaW50LnRlc3RpbmdfZGF0YVtpdGVyYXRpb25dID0gdW5kZWZpbmVkO1xuICAgICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3RyYWluaW5nID0gdW5kZWZpbmVkO1xuICAgICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3Rlc3RpbmcgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgZGF0YVBvaW50LnByZWRpY3Rpb25baXRlcmF0aW9uXSA9IFwiYmFja2dyb3VuZFwiO1xuICAgICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3ByZWRpY3Rpb24gPSBcImJhY2tncm91bmRcIjtcbiAgICAgICAgICBkYXRhUG9pbnQuaW52X2FjY1tpdGVyYXRpb25dID0gMDtcbiAgICAgICAgICBkYXRhUG9pbnQuY3VycmVudF9pbnZfYWNjID0gMDtcbiAgICAgICAgICBkYXRhUG9pbnQuY3VycmVudF9uZXdfc2VsZWN0aW9uID0gdW5kZWZpbmVkO1xuICAgICAgICAgIC8vIGRhdGFQb2ludC5uZXdfc2VsZWN0aW9uW2l0ZXJhdGlvbl0gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfd3JvbmdfcHJlZGljdGlvbiA9IHVuZGVmaW5lZDtcbiAgICAgICAgICBkYXRhUG9pbnQub3JpZ2luYWxfbGFiZWwgPSBcImJhY2tncm91bmRcIjtcbiAgICAgICAgICBkYXRhUG9pbnQubm9pc3kgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gcmVhbF9kYXRhX251bWJlciArIGJhY2tncm91bmRfcG9pbnRfbnVtYmVyOyBpIDwgdGhpcy5wb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBsZXQgZGF0YVBvaW50ID0gdGhpcy5wb2ludHNbaV07XG4gICAgICAgICAgZGF0YVBvaW50LnByb2plY3Rpb25zID0ge307XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRyYWluaW5nX2RhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBkYXRhSW5kZXggPSB0cmFpbmluZ19kYXRhW2ldO1xuICAgICAgICAgIGxldCBkYXRhUG9pbnQgPSB0aGlzLnBvaW50c1tkYXRhSW5kZXhdO1xuICAgICAgICAgIGRhdGFQb2ludC50cmFpbmluZ19kYXRhW2l0ZXJhdGlvbl0gPSB0cnVlO1xuICAgICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3RyYWluaW5nID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGVzdGluZ19kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgZGF0YUluZGV4ID0gdGVzdGluZ19kYXRhW2ldO1xuICAgICAgICAgIGxldCBkYXRhUG9pbnQgPSB0aGlzLnBvaW50c1tkYXRhSW5kZXhdO1xuICAgICAgICAgIGRhdGFQb2ludC50ZXN0aW5nX2RhdGFbaXRlcmF0aW9uXSA9IHRydWU7XG4gICAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfdGVzdGluZyA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLkRWSUN1cnJlbnRSZWFsRGF0YU51bWJlciA9IHJlYWxfZGF0YV9udW1iZXI7XG4gICAgICAgIHRoaXMuRFZJUmVhbERhdGFOdW1iZXJbaXRlcmF0aW9uXSA9IHJlYWxfZGF0YV9udW1iZXI7XG4gICAgICAgIHRoaXMuRFZJZmlsdGVySW5kaWNlcyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlYWxfZGF0YV9udW1iZXIgKyBiYWNrZ3JvdW5kX3BvaW50X251bWJlcjsgaSsrKSB7XG4gICAgICAgICAgdGhpcy5EVklmaWx0ZXJJbmRpY2VzLnB1c2goaSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5EVklEYXRhTGlzdFtpdGVyYXRpb25dID0gdGhpcy5wb2ludHNcbiAgICAgICAgd2luZG93LkRWSURhdGFMaXN0ID0gdGhpcy5EVklEYXRhTGlzdFxuXG4gICAgICAgIHN0ZXBDYWxsYmFjayh0aGlzLnRTTkVJdGVyYXRpb24sIGV2YWx1YXRpb24sIG5ld19zZWxlY3Rpb24sIGZpbHRlckluZGljZXMsIHRoaXMudFNORVRvdGFsSXRlcik7XG4gICAgICB9KS5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcbiAgICAgICAgbG9nZ2luZy5zZXRFcnJvck1lc3NhZ2UoJ2Vycm9yJyk7XG4gICAgICAgIHN0ZXBDYWxsYmFjayhudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdmFsaWREYXRhTnVtYmVyID0gdGhpcy5EVklWYWxpZFBvaW50TnVtYmVyW2l0ZXJhdGlvbl07XG4gICAgICBjb25zdCBldmFsdWF0aW9uID0gdGhpcy5EVklFdmFsdWF0aW9uW2l0ZXJhdGlvbl07XG4gICAgICB0aGlzLnRTTkVJdGVyYXRpb24gPSBpdGVyYXRpb247XG5cbiAgICAgIHdpbmRvdy5pdGVyYXRpb24gPSBpdGVyYXRpb25cblxuICAgICAgY29uc3QgbmV3U2VsZWN0aW9uID0gW107XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbGlkRGF0YU51bWJlcjsgaSsrKSB7XG4gICAgICAgIGxldCBkYXRhUG9pbnQgPSB0aGlzLnBvaW50c1tpXTtcbiAgICAgICAgZGF0YVBvaW50LnByb2plY3Rpb25zWyd0c25lLTAnXSA9IGRhdGFQb2ludC5EVklfcHJvamVjdGlvbnNbaXRlcmF0aW9uXVswXTtcbiAgICAgICAgZGF0YVBvaW50LnByb2plY3Rpb25zWyd0c25lLTEnXSA9IGRhdGFQb2ludC5EVklfcHJvamVjdGlvbnNbaXRlcmF0aW9uXVsxXTtcbiAgICAgICAgZGF0YVBvaW50LnByb2plY3Rpb25zWyd0c25lLTInXSA9IDA7XG4gICAgICAgIGRhdGFQb2ludC5jb2xvciA9IGRhdGFQb2ludC5EVklfY29sb3JbaXRlcmF0aW9uXTtcbiAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfdHJhaW5pbmcgPSBkYXRhUG9pbnQudHJhaW5pbmdfZGF0YVtpdGVyYXRpb25dO1xuICAgICAgICBkYXRhUG9pbnQuY3VycmVudF90ZXN0aW5nID0gZGF0YVBvaW50LnRlc3RpbmdfZGF0YVtpdGVyYXRpb25dO1xuICAgICAgICBkYXRhUG9pbnQuY3VycmVudF9wcmVkaWN0aW9uID0gZGF0YVBvaW50LnByZWRpY3Rpb25baXRlcmF0aW9uXTtcbiAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfaW52X2FjYyA9IGRhdGFQb2ludC5pbnZfYWNjW2l0ZXJhdGlvbl07XG4gICAgICAgIGlmIChkYXRhUG9pbnQuY3VycmVudF9wcmVkaWN0aW9uID09IGRhdGFQb2ludC5tZXRhZGF0YVsnbGFiZWwnXSAmJiBkYXRhUG9pbnQubWV0YWRhdGFbJ2xhYmVsJ10gIT0gXCJiYWNrZ3JvdW5kXCIpIHtcbiAgICAgICAgICBkYXRhUG9pbnQuY3VycmVudF93cm9uZ19wcmVkaWN0aW9uID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGRhdGFQb2ludC5tZXRhZGF0YVsnbGFiZWwnXSAhPSBcImJhY2tncm91bmRcIikge1xuICAgICAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfd3JvbmdfcHJlZGljdGlvbiA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3dyb25nX3ByZWRpY3Rpb24gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIGRhdGFQb2ludC5jdXJyZW50X25ld19zZWxlY3Rpb24gPSBkYXRhUG9pbnQubmV3X3NlbGVjdGlvbltpdGVyYXRpb25dO1xuICAgICAgICAvLyBpZiAoZGF0YVBvaW50LmN1cnJlbnRfbmV3X3NlbGVjdGlvbikge1xuICAgICAgICAvLyAgIG5ld1NlbGVjdGlvbi5wdXNoKGkpO1xuICAgICAgICAvLyB9XG4gICAgICAgIC8vIGlmICh0aGlzLmlzX3VuY2VydGFpbnR5X2RpdmVyc2l0eV90b3RfZXhpc3RbaXRlcmF0aW9uXSkge1xuICAgICAgICAvLyAgIGRhdGFQb2ludC5tZXRhZGF0YVsndW5jZXJ0YWludHknXSA9IGRhdGFQb2ludC51bmNlcnRhaW50eVtpdGVyYXRpb25dO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC5tZXRhZGF0YVsnZGl2ZXJzaXR5J10gPSBkYXRhUG9pbnQuZGl2ZXJzaXR5W2l0ZXJhdGlvbl07XG4gICAgICAgIC8vICAgZGF0YVBvaW50Lm1ldGFkYXRhWyd0b3QnXSA9IGRhdGFQb2ludC50b3RbaXRlcmF0aW9uXTtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQuY3VycmVudF91bmNlcnRhaW50eV9yYW5raW5nID0gZGF0YVBvaW50LnVuY2VydGFpbnR5X3JhbmtpbmdbaXRlcmF0aW9uXTtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQuY3VycmVudF9kaXZlcnNpdHlfcmFua2luZyA9IGRhdGFQb2ludC5kaXZlcnNpdHlfcmFua2luZ1tpdGVyYXRpb25dO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC5jdXJyZW50X3RvdF9yYW5raW5nID0gZGF0YVBvaW50LnRvdF9yYW5raW5nW2l0ZXJhdGlvbl07XG4gICAgICAgIC8vIH1cbiAgICAgIH1cbiAgICAgIGZvciAobGV0IGkgPSB2YWxpZERhdGFOdW1iZXI7IGkgPCB0aGlzLnBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBsZXQgZGF0YVBvaW50ID0gdGhpcy5wb2ludHNbaV07XG4gICAgICAgIGRhdGFQb2ludC5wcm9qZWN0aW9ucyA9IHt9O1xuICAgICAgICBkYXRhUG9pbnQuY3VycmVudF90ZXN0aW5nID0gZmFsc2U7XG4gICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3RyYWluaW5nID0gZmFsc2U7XG4gICAgICB9XG4gICAgICAvLyBjb25zdCBtYXRjaGVzID0gdGhpcy5nZXRfbWF0Y2goKTtcbiAgICAgIC8vIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsaWREYXRhTnVtYmVyOyBpKyspIHtcbiAgICAgIC8vICAgbGV0IGRhdGFQb2ludCA9IHRoaXMucG9pbnRzW2ldO1xuICAgICAgLy8gICBpZiAobWF0Y2hlcy5pbmRleE9mKGkpID09IC0xICYmIGkgPCB0aGlzLkRWSUN1cnJlbnRSZWFsRGF0YU51bWJlcikge1xuICAgICAgLy8gICAgIGRhdGFQb2ludC5wcm9qZWN0aW9ucyA9IHt9XG4gICAgICAvLyAgIH1cbiAgICAgIC8vIH1cbiAgICAgIHRoaXMuRFZJQ3VycmVudFJlYWxEYXRhTnVtYmVyID0gdGhpcy5EVklSZWFsRGF0YU51bWJlcltpdGVyYXRpb25dO1xuICAgICAgdGhpcy5EVklmaWx0ZXJJbmRpY2VzID0gW107XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuRFZJQ3VycmVudFJlYWxEYXRhTnVtYmVyICsgTWF0aC5wb3codGhpcy5EVklSZXNvbHV0aW9uLCAyKTsgaSsrKSB7XG4gICAgICAgIHRoaXMuRFZJZmlsdGVySW5kaWNlcy5wdXNoKGkpO1xuICAgICAgfVxuICAgICAgbGV0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICAgICAgaGVhZGVycy5hcHBlbmQoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICBoZWFkZXJzLmFwcGVuZCgnQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgIGF3YWl0IGZldGNoKGBodHRwOi8vJHt0aGlzLkRWSVNlcnZlcn0vcXVlcnlgLCB7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgXCJwcmVkaWNhdGVzXCI6IHByZWRpY2F0ZXMsIFwiY29udGVudF9wYXRoXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5jb250ZW50X3BhdGggfHwgdGhpcy5EVklzdWJqZWN0TW9kZWxQYXRoLFxuICAgICAgICAgIFwiaXRlcmF0aW9uXCI6IGl0ZXJhdGlvbixcInVzZXJuYW1lXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS51c2VybmFtZSwgXCJ2aXNfbWV0aG9kXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS52aXNfbWV0aG9kLCdzZXR0aW5nJzp3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2VsZWN0ZWRTZXR0aW5nXG4gICAgICAgIH0pLFxuICAgICAgICBoZWFkZXJzOiBoZWFkZXJzLFxuICAgICAgICBtb2RlOiAnY29ycydcbiAgICAgIH0pLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKS50aGVuKGRhdGEgPT4ge1xuICAgICAgICBjb25zdCBpbmRpY2VzID0gZGF0YS5zZWxlY3RlZFBvaW50cztcbiAgICAgICAgc3RlcENhbGxiYWNrKHRoaXMudFNORUl0ZXJhdGlvbiwgZXZhbHVhdGlvbiwgbmV3U2VsZWN0aW9uLCBpbmRpY2VzLCB0aGlzLnRTTkVUb3RhbEl0ZXIpO1xuICAgICAgfSkuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICBsb2dnaW5nLnNldEVycm9yTWVzc2FnZSgncXVlcnlpbmcgZm9yIGluZGljZXMnKTtcbiAgICAgICAgc3RlcENhbGxiYWNrKG51bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGwpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cblxuICAvKiogUnVucyBEVkkgb24gdGhlIGRhdGEuICovXG4gIGFzeW5jIHJlVHJhaW5CeURWSShcbiAgICBpdGVyYXRpb246IG51bWJlciwgbmV3SW5kaWNlczogbnVtYmVyW10sIHJlamVjdGlvbjogbnVtYmVyW10sXG4gICAgc3RlcENhbGxiYWNrOiAoaXRlcjogbnVtYmVyIHwgbnVsbCwgZXZhbHVhdGlvbjogYW55LCBuZXdTZWxlY3Rpb246IGFueVtdLCBmaWx0ZXJJbmRpY2VzOiBudW1iZXJbXSwgdG90YWxJdGVyPzogbnVtYmVyKSA9PiB2b2lkXG4gICkge1xuICAgIHRoaXMucHJvamVjdGlvbnNbJ3RzbmUnXSA9IHRydWU7XG4gICAgZnVuY3Rpb24gY29tcG9uZW50VG9IZXgoYzogbnVtYmVyKSB7XG4gICAgICBjb25zdCBoZXggPSBjLnRvU3RyaW5nKDE2KTtcbiAgICAgIHJldHVybiBoZXgubGVuZ3RoID09IDEgPyBcIjBcIiArIGhleCA6IGhleDtcbiAgICB9XG5cblxuICAgIHRoaXMuaXRlcmF0aW9uQ2hhbmdlUmVzZXQoKVxuXG4gICAgZnVuY3Rpb24gcmdiVG9IZXgocjogbnVtYmVyLCBnOiBudW1iZXIsIGI6IG51bWJlcikge1xuICAgICAgcmV0dXJuIFwiI1wiICsgY29tcG9uZW50VG9IZXgocikgKyBjb21wb25lbnRUb0hleChnKSArIGNvbXBvbmVudFRvSGV4KGIpO1xuICAgIH1cbiAgICBsZXQgaGVhZGVycyA9IG5ldyBIZWFkZXJzKCk7XG4gICAgaGVhZGVycy5hcHBlbmQoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgaGVhZGVycy5hcHBlbmQoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgLy8gYXdhaXQgZmV0Y2goXCJzdGFuZGFsb25lX3Byb2plY3Rvcl9jb25maWcuanNvblwiLCB7IG1ldGhvZDogJ0dFVCcgfSlcbiAgICAvLyAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSlcbiAgICAvLyAgIC50aGVuKGRhdGEgPT4ge1xuICAgIC8vICAgICBjb25zdCBpcF9hZGRyZXNzID0gZGF0YS5EVklTZXJ2ZXJJUCArIFwiOlwiICsgZGF0YS5EVklTZXJ2ZXJQb3J0O1xuICAgIC8vICAgICB0aGlzLkRWSVNlcnZlciA9IGlwX2FkZHJlc3M7XG4gICAgaWYgKHdpbmRvdy5tb2RlbE1hdGgpIHtcbiAgICAgIHRoaXMuRFZJc3ViamVjdE1vZGVsUGF0aCA9IHdpbmRvdy5tb2RlbE1hdGhcbiAgICB9XG4gICAgbGV0IGluZGljZXMgPSBbXVxuICAgIGlmKHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMpe1xuICAgICAgaW5kaWNlcyA9IHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMuZmlsdGVyKChpdGVtLCBpLCBhcnIpID0+IHtcbiAgICAgICAgLy/lh73mlbDoh6rouqvov5Tlm57nmoTmmK/kuIDkuKrluIPlsJTlgLzvvIzlj6rlvZPov5Tlm57lgLzkuLp0cnVl5pe277yM5b2T5YmN5YWD57Sg5omN5Lya5a2Y5YWl5paw55qE5pWw57uE5Lit44CCICAgICAgICAgICAgXG4gICAgICAgIHJldHVybiB3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXVtpdGVtXSA9PT0gMVxuICAgICAgfSlcbiAgICB9XG4gICAgbGV0IHJlakluZGljZXMgPSBbXVxuICAgIGlmKHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMpe1xuICAgICAgcmVqSW5kaWNlcyA9IHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMuZmlsdGVyKChpdGVtLCBpLCBhcnIpID0+IHtcbiAgICAgICAgLy/lh73mlbDoh6rouqvov5Tlm57nmoTmmK/kuIDkuKrluIPlsJTlgLzvvIzlj6rlvZPov5Tlm57lgLzkuLp0cnVl5pe277yM5b2T5YmN5YWD57Sg5omN5Lya5a2Y5YWl5paw55qE5pWw57uE5Lit44CCICAgICAgICAgICAgXG4gICAgICAgIHJldHVybiB3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXVtpdGVtXSA9PT0gMVxuICAgICAgfSlcbiAgICB9XG5cbiAgICBsZXQgdGhhdCA9IHRoaXNcblxuICAgIGF3YWl0IGZldGNoKFwiaHR0cDovL1wiICsgdGhpcy5EVklTZXJ2ZXIgKyBcIi9hbF90cmFpblwiLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgXCJpdGVyYXRpb25cIjogdGhpcy50U05FSXRlcmF0aW9uLFxuICAgICAgICBcImFjY0luZGljZXNcIjogaW5kaWNlcyxcbiAgICAgICAgXCJyZWpJbmRpY2VzXCI6IHJlakluZGljZXMsXG4gICAgICAgIFwiY29udGVudF9wYXRoXCI6IHRoaXMuRFZJc3ViamVjdE1vZGVsUGF0aCxcbiAgICAgICAgXCJ1c2VybmFtZVwiOiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudXNlcm5hbWVcbiAgICAgIH0pLFxuICAgICAgaGVhZGVyczogaGVhZGVycyxcbiAgICAgIG1vZGU6ICdjb3JzJ1xuICAgIH0pLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKS50aGVuKGRhdGEgPT4ge1xuICAgICAgaXRlcmF0aW9uID0gZGF0YS5tYXhpbXVtX2l0ZXJhdGlvblxuICAgICAgd2luZG93LmFjY2VwdEluZGljYXRlcyA9IFtdXG4gICAgICB3aW5kb3cucmVqZWN0SW5kaWNhdGVzID0gW11cbiAgICAgIHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZXRJdGVtKCdhY2NlcHRJbmRpY2F0ZXMnLCBcIlwiKVxuICAgICAgd2luZG93LnNlc3Npb25TdG9yYWdlLnNldEl0ZW0oJ3JlamVjdEluZGljYXRlcycsIFwiXCIpXG5cbiAgICAgIHdpbmRvdy5pdGVyYXRpb24gPSBpdGVyYXRpb25cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGRhdGEucmVzdWx0O1xuICAgICAgY29uc3QgZ3JpZF9pbmRleCA9IFtbZGF0YS5ncmlkX2luZGV4WzBdLCBkYXRhLmdyaWRfaW5kZXhbMV1dLCBbZGF0YS5ncmlkX2luZGV4WzJdLCBkYXRhLmdyaWRfaW5kZXhbM11dXTtcbiAgICAgIGNvbnN0IGdyaWRfY29sb3IgPSBbWzEzNywgMTIwLCAxMTddLCBbMTM2LCAxMTksIDExNl0sIFsxMzYsIDExOCwgMTE1XSwgWzEzNSwgMTE3LCAxMTRdXTtcbiAgICAgIHdpbmRvdy5zY2VuZUJhY2tncm91bmRJbWdbd2luZG93Lml0ZXJhdGlvbl0gPSBkYXRhLmdyaWRfY29sb3JcbiAgICAgIGxldCBrID0gMDtcbiAgICAgIGxldCB0ZW1wX2xhYmVsX2NvbG9yX2xpc3Q6YW55ID0gW11cbiAgICAgIGxldCB0ZW1wX2xhYmVsX2xpc3Q6YW55ID0gW11cbiAgICAgIGZvcihsZXQgaSA9IDAgO2kgPCByZXN1bHQubGVuZ3RoLTE7aSsrKXtcbiAgICAgICAgXG4gICAgICAgIGlmIChkYXRhLnByb3BlcnRpZXNbaV0gPT09IDApIHtcbiAgICAgICAgICBsZXQgY29sb3I6YW55ID0gZGF0YS5sYWJlbF9jb2xvcl9saXN0W2tdIHx8IFsyMDQsMjA0LDIwNF1cbiAgICAgICAgICBsZXQgbGFiZWw6YW55ID0gZGF0YS5sYWJlbF9saXN0W2tdIHx8ICd1bmxhYmVsZWQnXG4gICAgICAgICAgdGVtcF9sYWJlbF9jb2xvcl9saXN0LnB1c2goY29sb3IpXG4gICAgICAgICAgdGVtcF9sYWJlbF9saXN0LnB1c2gobGFiZWwpXG4gICAgICAgICAgayArIGsrMVxuICAgICAgICB9IGVsc2V7XG4gICAgICAgICAgdGVtcF9sYWJlbF9jb2xvcl9saXN0LnB1c2goWzIwNCwyMDQsMjA0XSlcbiAgICAgICAgICB0ZW1wX2xhYmVsX2xpc3QucHVzaCgndW5sYWJlbGVkJylcbiAgICAgICAgfSAgXG4gICAgICAgIFxuICAgICAgfVxuXG4gICAgICBjb25zdCBsYWJlbF9jb2xvcl9saXN0ID0gdGVtcF9sYWJlbF9jb2xvcl9saXN0XG4gICAgICBjb25zdCBsYWJlbF9saXN0ID0gdGVtcF9sYWJlbF9saXN0O1xuICAgICAgY29uc29sZS5sb2coJ2xhYmVsX2NvbG9yX2xpc3QubGVuZ3RoJyxsYWJlbF9jb2xvcl9saXN0Lmxlbmd0aClcbiAgICAgIGNvbnN0IHByZWRpY3Rpb25fbGlzdCA9IGRhdGEucHJlZGljdGlvbl9saXN0O1xuXG4gICAgICBjb25zdCBiYWNrZ3JvdW5kX3BvaW50X251bWJlciA9IGdyaWRfaW5kZXgubGVuZ3RoO1xuXG4gICAgICBjb25zdCByZWFsX2RhdGFfbnVtYmVyID0gbGFiZWxfY29sb3JfbGlzdC5sZW5ndGg7XG4gICAgICB0aGlzLnRTTkVUb3RhbEl0ZXIgPSBkYXRhLm1heGltdW1faXRlcmF0aW9uO1xuICAgICAgd2luZG93LnRTTkVUb3RhbEl0ZXIgPSBkYXRhLm1heGltdW1faXRlcmF0aW9uO1xuXG4gICAgICB0aGlzLnRTTkVJdGVyYXRpb24gPSBpdGVyYXRpb247XG4gICAgICB0aGlzLkRWSVZhbGlkUG9pbnROdW1iZXJbaXRlcmF0aW9uXSA9IHJlYWxfZGF0YV9udW1iZXIgKyBiYWNrZ3JvdW5kX3BvaW50X251bWJlcjtcbiAgICAgIHRoaXMuRFZJQXZhaWxhYmxlSXRlcmF0aW9uLnB1c2goaXRlcmF0aW9uKTtcbiAgICAgIGNvbnN0IGN1cnJlbnRfbGVuZ3RoID0gdGhpcy5wb2ludHMubGVuZ3RoO1xuXG4gICAgICBjb25zdCB0cmFpbmluZ19kYXRhID0gZGF0YS50cmFpbmluZ19kYXRhO1xuICAgICAgY29uc3QgdGVzdGluZ19kYXRhID0gZGF0YS50ZXN0aW5nX2RhdGE7XG4gICAgICBjb25zdCBuZXdfc2VsZWN0aW9uID0gZGF0YS5uZXdfc2VsZWN0aW9uO1xuICAgICAgY29uc3Qgbm9pc3lfZGF0YSA9IGRhdGEubm9pc3lfZGF0YTtcbiAgICAgIGNvbnN0IG9yaWdpbmFsX2xhYmVsX2xpc3QgPSBkYXRhLm9yaWdpbmFsX2xhYmVsX2xpc3Q7XG5cbiAgICAgIGNvbnN0IGV2YWx1YXRpb24gPSBkYXRhLmV2YWx1YXRpb247XG4gICAgICB0aGlzLkRWSUV2YWx1YXRpb25baXRlcmF0aW9uXSA9IGV2YWx1YXRpb247XG4gICAgICBjb25zdCBpbnZfYWNjID0gZGF0YS5pbnZfYWNjX2xpc3QgfHwgW107XG5cbiAgICAgIGlmICghd2luZG93LnByb3BlcnRpZXMpIHtcbiAgICAgICAgd2luZG93LnByb3BlcnRpZXMgPSBbXVxuICAgICAgfVxuICAgICAgd2luZG93LnByb3BlcnRpZXNbaXRlcmF0aW9uXSA9IGRhdGEucHJvcGVydGllcztcblxuICAgICAgd2luZG93LnVuTGFiZWxEYXRhID0gW11cbiAgICAgIHdpbmRvdy50ZXN0aW5nRGF0YSA9IFtdXG4gICAgICB3aW5kb3cubGFiZWxlZERhdGEgPSBbXVxuICAgICAgaWYgKCF3aW5kb3cubm93U2hvd0luZGljYXRlcykge1xuICAgICAgICB3aW5kb3cubm93U2hvd0luZGljYXRlcyA9IFtdXG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLnByb3BlcnRpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAoZGF0YS5wcm9wZXJ0aWVzW2ldID09PSAxKSB7XG4gICAgICAgICAgICB3aW5kb3cudW5MYWJlbERhdGEucHVzaChpKVxuICAgICAgICAgIH0gZWxzZSBpZiAoZGF0YS5wcm9wZXJ0aWVzW2ldID09PSAyKSB7XG4gICAgICAgICAgICB3aW5kb3cudGVzdGluZ0RhdGEucHVzaChpKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3aW5kb3cubGFiZWxlZERhdGEucHVzaChpKVxuICAgICAgICAgIH1cbiAgICAgICAgICB3aW5kb3cubm93U2hvd0luZGljYXRlcy5wdXNoKGkpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gY29uc3QgaXNfdW5jZXJ0YWludHlfZGl2ZXJzaXR5X3RvdF9leGlzdCA9IGRhdGEudW5jZXJ0YWludHlfZGl2ZXJzaXR5X3RvdD8uaXNfZXhpc3Q7XG4gICAgICAvLyB0aGlzLmlzX3VuY2VydGFpbnR5X2RpdmVyc2l0eV90b3RfZXhpc3RbaXRlcmF0aW9uXSA9IGlzX3VuY2VydGFpbnR5X2RpdmVyc2l0eV90b3RfZXhpc3Q7XG5cbiAgICAgIGNvbnN0IGZpbHRlckluZGljZXMgPSBkYXRhLnNlbGVjdGVkUG9pbnRzO1xuXG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVhbF9kYXRhX251bWJlciArIGJhY2tncm91bmRfcG9pbnRfbnVtYmVyIC0gY3VycmVudF9sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBuZXdEYXRhUG9pbnQ6IERhdGFQb2ludCA9IHtcbiAgICAgICAgICBtZXRhZGF0YTogeyBsYWJlbDogXCJiYWNrZ3JvdW5kXCIgfSxcbiAgICAgICAgICBpbmRleDogY3VycmVudF9sZW5ndGggKyBpLFxuICAgICAgICAgIHByb2plY3Rpb25zOiB7XG4gICAgICAgICAgICAndHNuZS0wJzogMCxcbiAgICAgICAgICAgICd0c25lLTEnOiAwLFxuICAgICAgICAgICAgJ3RzbmUtMic6IDBcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgICAgICB0aGlzLnBvaW50cy5wdXNoKG5ld0RhdGFQb2ludCk7XG4gICAgICB9XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxldCBkYXRhUG9pbnQgPSB0aGlzLnBvaW50c1tpXTtcbiAgICAgICAgaWYgKGRhdGFQb2ludC5EVklfcHJvamVjdGlvbnMgPT0gdW5kZWZpbmVkIHx8IGRhdGFQb2ludC5EVklfY29sb3IgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZGF0YVBvaW50LkRWSV9wcm9qZWN0aW9ucyA9IHt9O1xuICAgICAgICAgIGRhdGFQb2ludC5EVklfY29sb3IgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YVBvaW50LnRyYWluaW5nX2RhdGEgPT0gdW5kZWZpbmVkIHx8IGRhdGFQb2ludC50ZXN0aW5nX2RhdGEgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZGF0YVBvaW50LnRyYWluaW5nX2RhdGEgPSB7fTtcbiAgICAgICAgICBkYXRhUG9pbnQudGVzdGluZ19kYXRhID0ge307XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGFQb2ludC5wcmVkaWN0aW9uID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRhdGFQb2ludC5wcmVkaWN0aW9uID0ge307XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGFQb2ludC5uZXdfc2VsZWN0aW9uID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRhdGFQb2ludC5uZXdfc2VsZWN0aW9uID0ge307XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGFQb2ludC5pbnZfYWNjID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRhdGFQb2ludC5pbnZfYWNjID0ge307XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGFQb2ludC51bmNlcnRhaW50eSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkYXRhUG9pbnQudW5jZXJ0YWludHkgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YVBvaW50LnVuY2VydGFpbnR5X3JhbmtpbmcgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZGF0YVBvaW50LnVuY2VydGFpbnR5X3JhbmtpbmcgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YVBvaW50LmRpdmVyc2l0eSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkYXRhUG9pbnQuZGl2ZXJzaXR5ID0ge307XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGFQb2ludC5kaXZlcnNpdHlfcmFua2luZyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkYXRhUG9pbnQuZGl2ZXJzaXR5X3JhbmtpbmcgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YVBvaW50LnRvdCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkYXRhUG9pbnQudG90ID0ge307XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGFQb2ludC50b3RfcmFua2luZyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkYXRhUG9pbnQudG90X3JhbmtpbmcgPSB7fTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlYWxfZGF0YV9udW1iZXI7IGkrKykge1xuICAgICAgICBsZXQgZGF0YVBvaW50ID0gdGhpcy5wb2ludHNbaV07XG4gICAgICAgIGRhdGFQb2ludC5wcm9qZWN0aW9uc1sndHNuZS0wJ10gPSByZXN1bHRbaV1bMF07XG4gICAgICAgIGRhdGFQb2ludC5wcm9qZWN0aW9uc1sndHNuZS0xJ10gPSByZXN1bHRbaV1bMV07XG4gICAgICAgIGRhdGFQb2ludC5wcm9qZWN0aW9uc1sndHNuZS0yJ10gPSAwO1xuICAgICAgICBkYXRhUG9pbnQuY29sb3IgPSByZ2JUb0hleChsYWJlbF9jb2xvcl9saXN0W2ldWzBdLCBsYWJlbF9jb2xvcl9saXN0W2ldWzFdLCBsYWJlbF9jb2xvcl9saXN0W2ldWzJdKTtcbiAgICAgICAgZGF0YVBvaW50LkRWSV9wcm9qZWN0aW9uc1tpdGVyYXRpb25dID0gW3Jlc3VsdFtpXVswXSwgcmVzdWx0W2ldWzFdXTtcbiAgICAgICAgZGF0YVBvaW50LkRWSV9jb2xvcltpdGVyYXRpb25dID0gZGF0YVBvaW50LmNvbG9yO1xuICAgICAgICBkYXRhUG9pbnQudHJhaW5pbmdfZGF0YVtpdGVyYXRpb25dID0gZmFsc2U7XG4gICAgICAgIGRhdGFQb2ludC50ZXN0aW5nX2RhdGFbaXRlcmF0aW9uXSA9IGZhbHNlO1xuICAgICAgICBkYXRhUG9pbnQuY3VycmVudF90cmFpbmluZyA9IGZhbHNlO1xuICAgICAgICBkYXRhUG9pbnQuY3VycmVudF90ZXN0aW5nID0gZmFsc2U7XG4gICAgICAgIGRhdGFQb2ludC5tZXRhZGF0YVsnbGFiZWwnXSA9IGxhYmVsX2xpc3RbaV07XG4gICAgICAgIGRhdGFQb2ludC5wcmVkaWN0aW9uW2l0ZXJhdGlvbl0gPSBwcmVkaWN0aW9uX2xpc3RbaV07XG4gICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3ByZWRpY3Rpb24gPSBwcmVkaWN0aW9uX2xpc3RbaV07XG4gICAgICAgIGRhdGFQb2ludC5pbnZfYWNjW2l0ZXJhdGlvbl0gPSBpbnZfYWNjW2ldO1xuICAgICAgICBkYXRhUG9pbnQuY3VycmVudF9pbnZfYWNjID0gaW52X2FjY1tpXTtcbiAgICAgICAgaWYgKHByZWRpY3Rpb25fbGlzdFtpXSA9PSBsYWJlbF9saXN0W2ldKSB7XG4gICAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfd3JvbmdfcHJlZGljdGlvbiA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3dyb25nX3ByZWRpY3Rpb24gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRhdGFQb2ludC5uZXdfc2VsZWN0aW9uW2l0ZXJhdGlvbl0gPSBmYWxzZTtcbiAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfbmV3X3NlbGVjdGlvbiA9IGZhbHNlO1xuICAgICAgICBpZiAob3JpZ2luYWxfbGFiZWxfbGlzdCkge1xuICAgICAgICAgIGRhdGFQb2ludC5vcmlnaW5hbF9sYWJlbCA9IG9yaWdpbmFsX2xhYmVsX2xpc3RbaV07XG4gICAgICAgIH1cbiAgICAgICAgZGF0YVBvaW50Lm5vaXN5ID0gZmFsc2U7XG4gICAgICAgIC8vIGlmIChpc191bmNlcnRhaW50eV9kaXZlcnNpdHlfdG90X2V4aXN0KSB7XG4gICAgICAgIC8vICAgZGF0YVBvaW50Lm1ldGFkYXRhWyd1bmNlcnRhaW50eSddID0gZGF0YS51bmNlcnRhaW50eV9kaXZlcnNpdHlfdG90LnVuY2VydGFpbnR5W2ldO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC51bmNlcnRhaW50eVtpdGVyYXRpb25dID0gZGF0YVBvaW50Lm1ldGFkYXRhWyd1bmNlcnRhaW50eSddO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC5tZXRhZGF0YVsnZGl2ZXJzaXR5J10gPSBkYXRhLnVuY2VydGFpbnR5X2RpdmVyc2l0eV90b3QuZGl2ZXJzaXR5W2ldO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC5kaXZlcnNpdHlbaXRlcmF0aW9uXSA9IGRhdGFQb2ludC5tZXRhZGF0YVsnZGl2ZXJzaXR5J107XG4gICAgICAgIC8vICAgZGF0YVBvaW50Lm1ldGFkYXRhWyd0b3QnXSA9IGRhdGEudW5jZXJ0YWludHlfZGl2ZXJzaXR5X3RvdC50b3RbaV07XG4gICAgICAgIC8vICAgZGF0YVBvaW50LnRvdFtpdGVyYXRpb25dID0gZGF0YVBvaW50Lm1ldGFkYXRhWyd0b3QnXTtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQudW5jZXJ0YWludHlfcmFua2luZ1tpdGVyYXRpb25dID0gZGF0YS51bmNlcnRhaW50eV9kaXZlcnNpdHlfdG90LnVuY2VydGFpbnR5X3JhbmtpbmdbaV07XG4gICAgICAgIC8vICAgZGF0YVBvaW50LmN1cnJlbnRfdW5jZXJ0YWludHlfcmFua2luZyA9IGRhdGEudW5jZXJ0YWludHlfZGl2ZXJzaXR5X3RvdC51bmNlcnRhaW50eV9yYW5raW5nW2ldO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC5kaXZlcnNpdHlfcmFua2luZ1tpdGVyYXRpb25dID0gZGF0YS51bmNlcnRhaW50eV9kaXZlcnNpdHlfdG90LmRpdmVyc2l0eV9yYW5raW5nW2ldO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC5jdXJyZW50X2RpdmVyc2l0eV9yYW5raW5nID0gZGF0YS51bmNlcnRhaW50eV9kaXZlcnNpdHlfdG90LmRpdmVyc2l0eV9yYW5raW5nW2ldO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC50b3RfcmFua2luZ1tpdGVyYXRpb25dID0gZGF0YS51bmNlcnRhaW50eV9kaXZlcnNpdHlfdG90LnRvdF9yYW5raW5nW2ldO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC5jdXJyZW50X3RvdF9yYW5raW5nID0gZGF0YS51bmNlcnRhaW50eV9kaXZlcnNpdHlfdG90LnRvdF9yYW5raW5nW2ldO1xuICAgICAgICAvLyB9XG4gICAgICB9XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYmFja2dyb3VuZF9wb2ludF9udW1iZXI7IGkrKykge1xuICAgICAgICBsZXQgZGF0YVBvaW50ID0gdGhpcy5wb2ludHNbaSArIHJlYWxfZGF0YV9udW1iZXJdO1xuICAgICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnNbJ3RzbmUtMCddID0gZ3JpZF9pbmRleFtpXVswXTtcbiAgICAgICAgZGF0YVBvaW50LnByb2plY3Rpb25zWyd0c25lLTEnXSA9IGdyaWRfaW5kZXhbaV1bMV07XG4gICAgICAgIGRhdGFQb2ludC5wcm9qZWN0aW9uc1sndHNuZS0yJ10gPSAwO1xuICAgICAgICBkYXRhUG9pbnQuY29sb3IgPSByZ2JUb0hleChncmlkX2NvbG9yW2ldWzBdLCBncmlkX2NvbG9yW2ldWzFdLCBncmlkX2NvbG9yW2ldWzJdKTtcbiAgICAgICAgZGF0YVBvaW50LkRWSV9wcm9qZWN0aW9uc1tpdGVyYXRpb25dID0gW2dyaWRfaW5kZXhbaV1bMF0sIGdyaWRfaW5kZXhbaV1bMV1dO1xuICAgICAgICBkYXRhUG9pbnQuRFZJX2NvbG9yW2l0ZXJhdGlvbl0gPSBkYXRhUG9pbnQuY29sb3I7XG4gICAgICAgIGRhdGFQb2ludC50cmFpbmluZ19kYXRhW2l0ZXJhdGlvbl0gPSB1bmRlZmluZWQ7XG4gICAgICAgIGRhdGFQb2ludC50ZXN0aW5nX2RhdGFbaXRlcmF0aW9uXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfdHJhaW5pbmcgPSB1bmRlZmluZWQ7XG4gICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3Rlc3RpbmcgPSB1bmRlZmluZWQ7XG4gICAgICAgIGRhdGFQb2ludC5wcmVkaWN0aW9uW2l0ZXJhdGlvbl0gPSBcImJhY2tncm91bmRcIjtcbiAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfcHJlZGljdGlvbiA9IFwiYmFja2dyb3VuZFwiO1xuICAgICAgICBkYXRhUG9pbnQuaW52X2FjY1tpdGVyYXRpb25dID0gMDtcbiAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfaW52X2FjYyA9IDA7XG4gICAgICAgIGRhdGFQb2ludC5jdXJyZW50X25ld19zZWxlY3Rpb24gPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGRhdGFQb2ludC5uZXdfc2VsZWN0aW9uW2l0ZXJhdGlvbl0gPSB1bmRlZmluZWQ7XG4gICAgICAgIGRhdGFQb2ludC5jdXJyZW50X3dyb25nX3ByZWRpY3Rpb24gPSB1bmRlZmluZWQ7XG4gICAgICAgIGRhdGFQb2ludC5vcmlnaW5hbF9sYWJlbCA9IFwiYmFja2dyb3VuZFwiO1xuICAgICAgICBkYXRhUG9pbnQubm9pc3kgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGlmIChpc191bmNlcnRhaW50eV9kaXZlcnNpdHlfdG90X2V4aXN0KSB7XG4gICAgICAgIC8vICAgZGF0YVBvaW50Lm1ldGFkYXRhWyd1bmNlcnRhaW50eSddID0gLTE7XG4gICAgICAgIC8vICAgZGF0YVBvaW50LnVuY2VydGFpbnR5W2l0ZXJhdGlvbl0gPSAtMTtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQubWV0YWRhdGFbJ2RpdmVyc2l0eSddID0gLTE7XG4gICAgICAgIC8vICAgZGF0YVBvaW50LmRpdmVyc2l0eVtpdGVyYXRpb25dID0gLTE7XG4gICAgICAgIC8vICAgZGF0YVBvaW50Lm1ldGFkYXRhWyd0b3QnXSA9IC0xO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC50b3RbaXRlcmF0aW9uXSA9IC0xO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC51bmNlcnRhaW50eV9yYW5raW5nW2l0ZXJhdGlvbl0gPSAtMTtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQuY3VycmVudF91bmNlcnRhaW50eV9yYW5raW5nID0gLTE7XG4gICAgICAgIC8vICAgZGF0YVBvaW50LmRpdmVyc2l0eV9yYW5raW5nW2l0ZXJhdGlvbl0gPSAtMTtcbiAgICAgICAgLy8gICBkYXRhUG9pbnQuY3VycmVudF9kaXZlcnNpdHlfcmFua2luZyA9IC0xO1xuICAgICAgICAvLyAgIGRhdGFQb2ludC50b3RfcmFua2luZ1tpdGVyYXRpb25dID0gLTE7XG4gICAgICAgIC8vICAgZGF0YVBvaW50LmN1cnJlbnRfdG90X3JhbmtpbmcgPSAtMTtcbiAgICAgICAgLy8gfVxuICAgICAgfVxuXG4gICAgICBmb3IgKGxldCBpID0gcmVhbF9kYXRhX251bWJlciArIGJhY2tncm91bmRfcG9pbnRfbnVtYmVyOyBpIDwgdGhpcy5wb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGV0IGRhdGFQb2ludCA9IHRoaXMucG9pbnRzW2ldO1xuICAgICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnMgPSB7fTtcbiAgICAgIH1cblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0cmFpbmluZ19kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGRhdGFJbmRleCA9IHRyYWluaW5nX2RhdGFbaV07XG4gICAgICAgIGxldCBkYXRhUG9pbnQgPSB0aGlzLnBvaW50c1tkYXRhSW5kZXhdO1xuICAgICAgICBkYXRhUG9pbnQudHJhaW5pbmdfZGF0YVtpdGVyYXRpb25dID0gdHJ1ZTtcbiAgICAgICAgZGF0YVBvaW50LmN1cnJlbnRfdHJhaW5pbmcgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRlc3RpbmdfZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBkYXRhSW5kZXggPSB0ZXN0aW5nX2RhdGFbaV07XG4gICAgICAgIGxldCBkYXRhUG9pbnQgPSB0aGlzLnBvaW50c1tkYXRhSW5kZXhdO1xuICAgICAgICBkYXRhUG9pbnQudGVzdGluZ19kYXRhW2l0ZXJhdGlvbl0gPSB0cnVlO1xuICAgICAgICBkYXRhUG9pbnQuY3VycmVudF90ZXN0aW5nID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gZm9yIChsZXQgaSA9IDA7IGkgPCBuZXdfc2VsZWN0aW9uLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyAgIGNvbnN0IGRhdGFJbmRleCA9IG5ld19zZWxlY3Rpb25baV07XG4gICAgICAvLyAgIGxldCBkYXRhUG9pbnQgPSB0aGlzLnBvaW50c1tkYXRhSW5kZXhdO1xuICAgICAgLy8gICBkYXRhUG9pbnQubmV3X3NlbGVjdGlvbltpdGVyYXRpb25dID0gdHJ1ZTtcbiAgICAgIC8vICAgZGF0YVBvaW50LmN1cnJlbnRfbmV3X3NlbGVjdGlvbiA9IHRydWU7XG4gICAgICAvLyB9XG5cbiAgICAgIC8vIGZvciAobGV0IGkgPSAwOyBpIDwgbm9pc3lfZGF0YT8ubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vICAgY29uc3QgZGF0YUluZGV4ID0gbm9pc3lfZGF0YVtpXTtcbiAgICAgIC8vICAgbGV0IGRhdGFQb2ludCA9IHRoaXMucG9pbnRzW2RhdGFJbmRleF07XG4gICAgICAvLyAgIGRhdGFQb2ludC5ub2lzeSA9IHRydWU7XG4gICAgICAvLyB9XG5cbiAgICAgIC8vIGNvbnN0IG1hdGNoZXMgPSB0aGlzLmdldF9tYXRjaCgpO1xuICAgICAgLy9cbiAgICAgIC8vIGZvciAobGV0IGkgPSAwOyBpIDwgcmVhbF9kYXRhX251bWJlcjsgaSsrKSB7XG4gICAgICAvLyAgIGxldCBkYXRhUG9pbnQgPSB0aGlzLnBvaW50c1tpXTtcbiAgICAgIC8vICAgaWYgKGluZGljZXMuaW5kZXhPZihpKSA9PSAtMSAmJiBpIDwgdGhpcy5EVklDdXJyZW50UmVhbERhdGFOdW1iZXIpIHtcbiAgICAgIC8vICAgICBkYXRhUG9pbnQucHJvamVjdGlvbnMgPSB7fVxuICAgICAgLy8gICB9XG4gICAgICAvLyB9XG5cbiAgICAgIHRoaXMuRFZJQ3VycmVudFJlYWxEYXRhTnVtYmVyID0gcmVhbF9kYXRhX251bWJlcjtcbiAgICAgIHRoaXMuRFZJUmVhbERhdGFOdW1iZXJbaXRlcmF0aW9uXSA9IHJlYWxfZGF0YV9udW1iZXI7XG4gICAgICB0aGlzLkRWSWZpbHRlckluZGljZXMgPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVhbF9kYXRhX251bWJlciArIGJhY2tncm91bmRfcG9pbnRfbnVtYmVyOyBpKyspIHtcbiAgICAgICAgdGhpcy5EVklmaWx0ZXJJbmRpY2VzLnB1c2goaSk7XG4gICAgICB9XG4gICAgICB0aGlzLkRWSURhdGFMaXN0W2l0ZXJhdGlvbl0gPSB0aGlzLnBvaW50c1xuICAgICAgaWYgKHRoaXMuRFZJRGF0YUxpc3RbaXRlcmF0aW9uXSAmJiB0aGlzLkRWSURhdGFMaXN0W2l0ZXJhdGlvbl0ubGVuZ3RoICYmIHRoaXMuRFZJRGF0YUxpc3QubGVuZ2h0ID4gaXRlcmF0aW9uKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSB0aGlzLkRWSURhdGFMaXN0Lmxlbmd0aCArIDE7IGkgPiBpdGVyYXRpb247IGktLSkge1xuICAgICAgICAgIHRoaXMuRFZJRGF0YUxpc3RbaV0gPSB0aGlzLkRWSURhdGFMaXN0W2kgLSAxXVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB3aW5kb3cuRFZJRGF0YUxpc3QgPSB0aGlzLkRWSURhdGFMaXN0XG4gICAgICBzdGVwQ2FsbGJhY2sodGhpcy50U05FSXRlcmF0aW9uLCBldmFsdWF0aW9uLCBuZXdfc2VsZWN0aW9uLCBmaWx0ZXJJbmRpY2VzLCB0aGlzLnRTTkVUb3RhbEl0ZXIpO1xuICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIGxvZ2dpbmcuc2V0RXJyb3JNZXNzYWdlKCdFcnJvcicpO1xuICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgICAgc3RlcENhbGxiYWNrKG51bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGwpO1xuICAgIH0pO1xuXG4gICAgLy8gfSk7XG5cbiAgfVxuXG4gIGFzeW5jIGdldFNwcml0ZUltYWdlKGlkOiBhbnksIHN0ZXBDYWxsYmFjazogKGltZ0RhdGE6IGFueSkgPT4gdm9pZCkge1xuICAgIGxldCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBpZiAod2luZG93Lm1vZGVsTWF0aCkge1xuICAgICAgdGhpcy5EVklzdWJqZWN0TW9kZWxQYXRoID0gd2luZG93Lm1vZGVsTWF0aFxuICAgIH1cbiAgICAvLyBjb25zdCBtc2dJZCA9IGxvZ2dpbmcuc2V0TW9kYWxNZXNzYWdlKCdGZXRjaGluZyBzcHJpdGUgaW1hZ2UuLi4nKTtcbiAgICAvLyBhd2FpdCBmZXRjaChcInN0YW5kYWxvbmVfcHJvamVjdG9yX2NvbmZpZy5qc29uXCIsIHsgbWV0aG9kOiAnR0VUJyB9KVxuICAgIC8vIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSlcbiAgICAvLyAudGhlbihkYXRhID0+IHsgIHRoaXMuRFZJc3ViamVjdE1vZGVsUGF0aCA9IGRhdGEuRFZJc3ViamVjdE1vZGVsUGF0aCB9KVxuXG4gICAgYXdhaXQgZmV0Y2goYGh0dHA6Ly8ke3RoaXMuRFZJU2VydmVyfS9zcHJpdGU/aW5kZXg9JHtpZH0mcGF0aD0ke3RoaXMuRFZJc3ViamVjdE1vZGVsUGF0aH0mdXNlcm5hbWU9JHt3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudXNlcm5hbWV9YCwge1xuICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgIG1vZGU6ICdjb3JzJ1xuICAgIH0pLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKS50aGVuKGRhdGEgPT4ge1xuICAgICAgLy8gbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UobnVsbCwgbXNnSWQpO1xuICAgICAgc3RlcENhbGxiYWNrKGRhdGEpO1xuICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIC8vIGxvZ2dpbmcuc2V0TW9kYWxNZXNzYWdlKG51bGwsIG1zZ0lkKTtcbiAgICAgIGNvbnNvbGUubG9nKFwiZXJyb3JcIiwgZXJyb3IpO1xuICAgIH0pO1xuICB9XG5cblxuXG4gIGl0ZXJhdGlvbkNoYW5nZVJlc2V0KCkge1xuICAgIHdpbmRvdy5hbFF1ZXJ5UmVzUG9pbnRJbmRpY2VzID0gW11cbiAgICB3aW5kb3cucXVlcnlSZXNQb2ludEluZGljZXMgPSBbXVxuICAgIHdpbmRvdy5xdWVyeVJlc1BvaW50SW5kaWNlcyA9IFtdXG4gICAgd2luZG93LnByZXZpb3VzSW5kZWNhdGVzID0gW11cblxuICAgIHdpbmRvdy5hbFN1Z2dlc3Rpb25JbmRpY2F0ZXMgPSBbXVxuICAgIHdpbmRvdy5hbFN1Z2dlc3RMYWJlbExpc3QgPSBbXVxuICAgIHdpbmRvdy5hbFN1Z2dlc3RTY29yZUxpc3QgPSBbXVxuICAgIHdpbmRvdy5jdXN0b21TZWxlY3Rpb24gPSBbXVxuICAgIHdpbmRvdy5mbGFnaW5kZWNhdGVzTGlzdCA9IFtdXG4gIH1cblxuXG5cbiAgc2V0U3VwZXJ2aXNpb24oc3VwZXJ2aXNlQ29sdW1uOiBzdHJpbmcsIHN1cGVydmlzZUlucHV0Pzogc3RyaW5nKSB7XG4gICAgaWYgKHN1cGVydmlzZUNvbHVtbiAhPSBudWxsKSB7XG4gICAgICB0aGlzLnN1cGVydmlzZUxhYmVscyA9IHRoaXMuc2h1ZmZsZWREYXRhSW5kaWNlc1xuICAgICAgICAuc2xpY2UoMCwgVFNORV9TQU1QTEVfU0laRSlcbiAgICAgICAgLm1hcCgoaW5kZXgpID0+XG4gICAgICAgICAgdGhpcy5wb2ludHNbaW5kZXhdLm1ldGFkYXRhW3N1cGVydmlzZUNvbHVtbl0gIT09IHVuZGVmaW5lZFxuICAgICAgICAgICAgPyBTdHJpbmcodGhpcy5wb2ludHNbaW5kZXhdLm1ldGFkYXRhW3N1cGVydmlzZUNvbHVtbl0pXG4gICAgICAgICAgICA6IGBVbmtub3duICMke2luZGV4fWBcbiAgICAgICAgKTtcbiAgICB9XG4gICAgaWYgKHN1cGVydmlzZUlucHV0ICE9IG51bGwpIHtcbiAgICAgIHRoaXMuc3VwZXJ2aXNlSW5wdXQgPSBzdXBlcnZpc2VJbnB1dDtcbiAgICB9XG4gICAgaWYgKHRoaXMudHNuZSkge1xuICAgICAgdGhpcy50c25lLnNldFN1cGVydmlzaW9uKHRoaXMuc3VwZXJ2aXNlTGFiZWxzLCB0aGlzLnN1cGVydmlzZUlucHV0KTtcbiAgICB9XG4gIH1cbiAgc2V0U3VwZXJ2aXNlRmFjdG9yKHN1cGVydmlzZUZhY3RvcjogbnVtYmVyKSB7XG4gICAgaWYgKHN1cGVydmlzZUZhY3RvciAhPSBudWxsKSB7XG4gICAgICB0aGlzLnN1cGVydmlzZUZhY3RvciA9IHN1cGVydmlzZUZhY3RvcjtcbiAgICAgIGlmICh0aGlzLnRzbmUpIHtcbiAgICAgICAgdGhpcy50c25lLnNldFN1cGVydmlzZUZhY3RvcihzdXBlcnZpc2VGYWN0b3IpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAvKipcbiAgICogTWVyZ2VzIG1ldGFkYXRhIHRvIHRoZSBkYXRhc2V0IGFuZCByZXR1cm5zIHdoZXRoZXIgaXQgc3VjY2VlZGVkLlxuICAgKi9cbiAgbWVyZ2VNZXRhZGF0YShtZXRhZGF0YTogU3ByaXRlQW5kTWV0YWRhdGFJbmZvKTogYm9vbGVhbiB7XG4gICAgaWYgKG1ldGFkYXRhLnBvaW50c0luZm8ubGVuZ3RoICE9PSB0aGlzLnBvaW50cy5sZW5ndGgpIHtcbiAgICAgIGxldCBlcnJvck1lc3NhZ2UgPVxuICAgICAgICBgTnVtYmVyIG9mIHRlbnNvcnMgKCR7dGhpcy5wb2ludHMubGVuZ3RofSkgZG8gbm90YCArXG4gICAgICAgIGAgbWF0Y2ggdGhlIG51bWJlciBvZiBsaW5lcyBpbiBtZXRhZGF0YWAgK1xuICAgICAgICBgICgke21ldGFkYXRhLnBvaW50c0luZm8ubGVuZ3RofSkuYDtcbiAgICAgIGlmIChcbiAgICAgICAgbWV0YWRhdGEuc3RhdHMubGVuZ3RoID09PSAxICYmXG4gICAgICAgIHRoaXMucG9pbnRzLmxlbmd0aCArIDEgPT09IG1ldGFkYXRhLnBvaW50c0luZm8ubGVuZ3RoXG4gICAgICApIHtcbiAgICAgICAgLy8gSWYgdGhlcmUgaXMgb25seSBvbmUgY29sdW1uIG9mIG1ldGFkYXRhIGFuZCB0aGUgbnVtYmVyIG9mIHBvaW50cyBpc1xuICAgICAgICAvLyBleGFjdGx5IG9uZSBsZXNzIHRoYW4gdGhlIG51bWJlciBvZiBtZXRhZGF0YSBsaW5lcywgdGhpcyBpcyBkdWUgdG8gYW5cbiAgICAgICAgLy8gdW5uZWNlc3NhcnkgaGVhZGVyIGxpbmUgaW4gdGhlIG1ldGFkYXRhIGFuZCB3ZSBjYW4gc2hvdyBhIG1lYW5pbmdmdWxcbiAgICAgICAgLy8gZXJyb3IuXG4gICAgICAgIGxvZ2dpbmcuc2V0RXJyb3JNZXNzYWdlKFxuICAgICAgICAgIGVycm9yTWVzc2FnZSArXG4gICAgICAgICAgJyBTaW5nbGUgY29sdW1uIG1ldGFkYXRhIHNob3VsZCBub3QgaGF2ZSBhIGhlYWRlciAnICtcbiAgICAgICAgICAncm93LicsXG4gICAgICAgICAgJ21lcmdpbmcgbWV0YWRhdGEnXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIG1ldGFkYXRhLnN0YXRzLmxlbmd0aCA+IDEgJiZcbiAgICAgICAgdGhpcy5wb2ludHMubGVuZ3RoIC0gMSA9PT0gbWV0YWRhdGEucG9pbnRzSW5mby5sZW5ndGhcbiAgICAgICkge1xuICAgICAgICAvLyBJZiB0aGVyZSBhcmUgbXVsdGlwbGUgY29sdW1ucyBvZiBtZXRhZGF0YSBhbmQgdGhlIG51bWJlciBvZiBwb2ludHMgaXNcbiAgICAgICAgLy8gZXhhY3RseSBvbmUgZ3JlYXRlciB0aGFuIHRoZSBudW1iZXIgb2YgbGluZXMgaW4gdGhlIG1ldGFkYXRhLCB0aGlzXG4gICAgICAgIC8vIG1lYW5zIHRoZXJlIGlzIGEgbWlzc2luZyBtZXRhZGF0YSBoZWFkZXIuXG4gICAgICAgIGxvZ2dpbmcuc2V0RXJyb3JNZXNzYWdlKFxuICAgICAgICAgIGVycm9yTWVzc2FnZSArXG4gICAgICAgICAgJyBNdWx0aS1jb2x1bW4gbWV0YWRhdGEgc2hvdWxkIGhhdmUgYSBoZWFkZXIgJyArXG4gICAgICAgICAgJ3JvdyB3aXRoIGNvbHVtbiBsYWJlbHMuJyxcbiAgICAgICAgICAnbWVyZ2luZyBtZXRhZGF0YSdcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgbG9nZ2luZy5zZXRXYXJuaW5nTWVzc2FnZShlcnJvck1lc3NhZ2UpO1xuICAgIH1cbiAgICB0aGlzLnNwcml0ZUFuZE1ldGFkYXRhSW5mbyA9IG1ldGFkYXRhO1xuICAgIG1ldGFkYXRhLnBvaW50c0luZm9cbiAgICAgIC5zbGljZSgwLCB0aGlzLnBvaW50cy5sZW5ndGgpXG4gICAgICAuZm9yRWFjaCgobSwgaSkgPT4gKHRoaXMucG9pbnRzW2ldLm1ldGFkYXRhID0gbSkpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHN0b3BUU05FKCkge1xuICAgIHRoaXMudFNORVNob3VsZFN0b3AgPSB0cnVlO1xuICB9XG4gIC8qKlxuICAgKiBGaW5kcyB0aGUgbmVhcmVzdCBuZWlnaGJvcnMgb2YgdGhlIHF1ZXJ5IHBvaW50IHVzaW5nIGFcbiAgICogdXNlci1zcGVjaWZpZWQgZGlzdGFuY2UgbWV0cmljLlxuICAgKi9cbiAgZmluZE5laWdoYm9ycyhcbiAgICBwb2ludEluZGV4OiBudW1iZXIsXG4gICAgZGlzdEZ1bmM6IERpc3RhbmNlRnVuY3Rpb24sXG4gICAgbnVtTk46IG51bWJlclxuICApOiBrbm4uTmVhcmVzdEVudHJ5W10ge1xuICAgIC8vIEZpbmQgdGhlIG5lYXJlc3QgbmVpZ2hib3JzIG9mIGEgcGFydGljdWxhciBwb2ludC5cbiAgICBsZXQgbmVpZ2hib3JzID0ga25uLmZpbmRLTk5vZlBvaW50KFxuICAgICAgdGhpcy5wb2ludHMsXG4gICAgICBwb2ludEluZGV4LFxuICAgICAgbnVtTk4sXG4gICAgICAoZCkgPT4gZC52ZWN0b3IsXG4gICAgICBkaXN0RnVuY1xuICAgICk7XG4gICAgLy8gVE9ETyhAZHNtaWxrb3YpOiBGaWd1cmUgb3V0IHdoeSB3ZSBzbGljZS5cbiAgICBsZXQgcmVzdWx0ID0gbmVpZ2hib3JzLnNsaWNlKDAsIG51bU5OKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIC8qKlxuICAgKiBTZWFyY2ggdGhlIGRhdGFzZXQgYmFzZWQgb24gYSBtZXRhZGF0YSBmaWVsZCBhbmQgc2F2ZSBhbGwgdGhlIHByZWRpY2F0ZXMuXG4gICAqL1xuICBxdWVyeShxdWVyeTogc3RyaW5nLCBpblJlZ2V4TW9kZTogYm9vbGVhbiwgZmllbGROYW1lOiBzdHJpbmcpOiBbYW55LCBudW1iZXJbXV0ge1xuICAgIGxldCBwcmVkaWNhdGUgPSB1dGlsLmdldFNlYXJjaFByZWRpY2F0ZShxdWVyeSwgaW5SZWdleE1vZGUsIGZpZWxkTmFtZSk7XG4gICAgbGV0IG1hdGNoZXM6IG51bWJlcltdID0gW107XG4gICAgdGhpcy5wb2ludHMuZm9yRWFjaCgocG9pbnQsIGlkKSA9PiB7XG4gICAgICBsZXQgcmVzdWx0ID0gdHJ1ZTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5EVklQcmVkaWNhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRfcHJlZGljYXRlID0gdGhpcy5EVklQcmVkaWNhdGVzW2ldO1xuICAgICAgICBpZiAoIWN1cnJlbnRfcHJlZGljYXRlKHBvaW50KSkge1xuICAgICAgICAgIHJlc3VsdCA9IGZhbHNlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocmVzdWx0ICYmIHByZWRpY2F0ZShwb2ludCkpIHtcbiAgICAgICAgbWF0Y2hlcy5wdXNoKGlkKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gW3ByZWRpY2F0ZSwgbWF0Y2hlc107XG4gIH1cbiAgZ2V0X21hdGNoKCkge1xuICAgIGxldCBtYXRjaGVzOiBudW1iZXJbXSA9IFtdO1xuICAgIHRoaXMucG9pbnRzLmZvckVhY2goKHBvaW50LCBpZCkgPT4ge1xuICAgICAgbGV0IHJlc3VsdCA9IHRydWU7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuRFZJUHJlZGljYXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBjdXJyZW50X3ByZWRpY2F0ZSA9IHRoaXMuRFZJUHJlZGljYXRlc1tpXTtcbiAgICAgICAgaWYgKCFjdXJyZW50X3ByZWRpY2F0ZShwb2ludCkpIHtcbiAgICAgICAgICByZXN1bHQgPSBmYWxzZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICBtYXRjaGVzLnB1c2goaWQpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBtYXRjaGVzO1xuICB9XG59XG5leHBvcnQgdHlwZSBQcm9qZWN0aW9uVHlwZSA9ICd0c25lJyB8ICd1bWFwJyB8ICdwY2EnIHwgJ2N1c3RvbSc7XG5leHBvcnQgY2xhc3MgUHJvamVjdGlvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyBwcm9qZWN0aW9uVHlwZTogUHJvamVjdGlvblR5cGUsXG4gICAgcHVibGljIHByb2plY3Rpb25Db21wb25lbnRzOiBQcm9qZWN0aW9uQ29tcG9uZW50czNELFxuICAgIHB1YmxpYyBkaW1lbnNpb25hbGl0eTogbnVtYmVyLFxuICAgIHB1YmxpYyBkYXRhU2V0OiBEYXRhU2V0XG4gICkgeyB9XG59XG5leHBvcnQgaW50ZXJmYWNlIENvbG9yT3B0aW9uIHtcbiAgbmFtZTogc3RyaW5nO1xuICBkZXNjPzogc3RyaW5nO1xuICBtYXA/OiAodmFsdWU6IHN0cmluZyB8IG51bWJlcikgPT4gc3RyaW5nO1xuICAvKiogTGlzdCBvZiBpdGVtcyBmb3IgdGhlIGNvbG9yIG1hcC4gRGVmaW5lZCBvbmx5IGZvciBjYXRlZ29yaWNhbCBtYXAuICovXG4gIGl0ZW1zPzoge1xuICAgIGxhYmVsOiBzdHJpbmc7XG4gICAgY291bnQ6IG51bWJlcjtcbiAgfVtdO1xuICAvKiogVGhyZXNob2xkIHZhbHVlcyBhbmQgdGhlaXIgY29sb3JzLiBEZWZpbmVkIGZvciBncmFkaWVudCBjb2xvciBtYXAuICovXG4gIHRocmVzaG9sZHM/OiB7XG4gICAgdmFsdWU6IG51bWJlcjtcbiAgICBjb2xvcjogc3RyaW5nO1xuICB9W107XG4gIGlzU2VwYXJhdG9yPzogYm9vbGVhbjtcbiAgdG9vTWFueVVuaXF1ZVZhbHVlcz86IGJvb2xlYW47XG59XG4vKipcbiAqIEFuIGludGVyZmFjZSB0aGF0IGhvbGRzIGFsbCB0aGUgZGF0YSBmb3Igc2VyaWFsaXppbmcgdGhlIGN1cnJlbnQgc3RhdGUgb2ZcbiAqIHRoZSB3b3JsZC5cbiAqL1xuZXhwb3J0IGNsYXNzIFN0YXRlIHtcbiAgLyoqIEEgbGFiZWwgaWRlbnRpZnlpbmcgdGhpcyBzdGF0ZS4gKi9cbiAgbGFiZWw6IHN0cmluZyA9ICcnO1xuICAvKiogV2hldGhlciB0aGlzIFN0YXRlIGlzIHNlbGVjdGVkIGluIHRoZSBib29rbWFya3MgcGFuZS4gKi9cbiAgaXNTZWxlY3RlZDogYm9vbGVhbiA9IGZhbHNlO1xuICAvKiogVGhlIHNlbGVjdGVkIHByb2plY3Rpb24gdGFiLiAqL1xuICBzZWxlY3RlZFByb2plY3Rpb246IFByb2plY3Rpb25UeXBlO1xuICAvKiogRGltZW5zaW9ucyBvZiB0aGUgRGF0YVNldC4gKi9cbiAgZGF0YVNldERpbWVuc2lvbnM6IFtudW1iZXIsIG51bWJlcl07XG4gIC8qKiB0LVNORSBwYXJhbWV0ZXJzICovXG4gIHRTTkVJdGVyYXRpb246IG51bWJlciA9IDA7XG4gIHRTTkVQZXJwbGV4aXR5OiBudW1iZXIgPSAwO1xuICB0U05FTGVhcm5pbmdSYXRlOiBudW1iZXIgPSAwO1xuICB0U05FaXMzZDogYm9vbGVhbiA9IHRydWU7XG4gIC8qKiBVTUFQIHBhcmFtZXRlcnMgKi9cbiAgdW1hcElzM2Q6IGJvb2xlYW4gPSB0cnVlO1xuICB1bWFwTmVpZ2hib3JzOiBudW1iZXIgPSAxNTtcbiAgLyoqIFBDQSBwcm9qZWN0aW9uIGNvbXBvbmVudCBkaW1lbnNpb25zICovXG4gIHBjYUNvbXBvbmVudERpbWVuc2lvbnM6IG51bWJlcltdID0gW107XG4gIC8qKiBDdXN0b20gcHJvamVjdGlvbiBwYXJhbWV0ZXJzICovXG4gIGN1c3RvbVNlbGVjdGVkU2VhcmNoQnlNZXRhZGF0YU9wdGlvbjogc3RyaW5nO1xuICBjdXN0b21YTGVmdFRleHQ6IHN0cmluZztcbiAgY3VzdG9tWExlZnRSZWdleDogYm9vbGVhbjtcbiAgY3VzdG9tWFJpZ2h0VGV4dDogc3RyaW5nO1xuICBjdXN0b21YUmlnaHRSZWdleDogYm9vbGVhbjtcbiAgY3VzdG9tWVVwVGV4dDogc3RyaW5nO1xuICBjdXN0b21ZVXBSZWdleDogYm9vbGVhbjtcbiAgY3VzdG9tWURvd25UZXh0OiBzdHJpbmc7XG4gIGN1c3RvbVlEb3duUmVnZXg6IGJvb2xlYW47XG4gIC8qKiBUaGUgY29tcHV0ZWQgcHJvamVjdGlvbnMgb2YgdGhlIHRlbnNvcnMuICovXG4gIHByb2plY3Rpb25zOiBBcnJheTx7XG4gICAgW2tleTogc3RyaW5nXTogbnVtYmVyO1xuICB9PiA9IFtdO1xuICAvKiogRmlsdGVyZWQgZGF0YXNldCBpbmRpY2VzLiAqL1xuICBmaWx0ZXJlZFBvaW50czogbnVtYmVyW107XG4gIC8qKiBUaGUgaW5kaWNlcyBvZiBzZWxlY3RlZCBwb2ludHMuICovXG4gIHNlbGVjdGVkUG9pbnRzOiBudW1iZXJbXSA9IFtdO1xuICAvKiogQ2FtZXJhIHN0YXRlICgyZC8zZCwgcG9zaXRpb24sIHRhcmdldCwgem9vbSwgZXRjKS4gKi9cbiAgY2FtZXJhRGVmOiBDYW1lcmFEZWY7XG4gIC8qKiBDb2xvciBieSBvcHRpb24uICovXG4gIHNlbGVjdGVkQ29sb3JPcHRpb25OYW1lOiBzdHJpbmc7XG4gIGZvcmNlQ2F0ZWdvcmljYWxDb2xvcmluZzogYm9vbGVhbjtcbiAgLyoqIExhYmVsIGJ5IG9wdGlvbi4gKi9cbiAgc2VsZWN0ZWRMYWJlbE9wdGlvbjogc3RyaW5nO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldFByb2plY3Rpb25Db21wb25lbnRzKFxuICBwcm9qZWN0aW9uOiBQcm9qZWN0aW9uVHlwZSxcbiAgY29tcG9uZW50czogKG51bWJlciB8IHN0cmluZylbXVxuKTogUHJvamVjdGlvbkNvbXBvbmVudHMzRCB7XG4gIGlmIChjb21wb25lbnRzLmxlbmd0aCA+IDMpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignY29tcG9uZW50cyBsZW5ndGggbXVzdCBiZSA8PSAzJyk7XG4gIH1cbiAgY29uc3QgcHJvamVjdGlvbkNvbXBvbmVudHM6IFtzdHJpbmcsIHN0cmluZywgc3RyaW5nXSA9IFtudWxsLCBudWxsLCBudWxsXTtcbiAgY29uc3QgcHJlZml4ID0gcHJvamVjdGlvbiA9PT0gJ2N1c3RvbScgPyAnbGluZWFyJyA6IHByb2plY3Rpb247XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgY29tcG9uZW50cy5sZW5ndGg7ICsraSkge1xuICAgIGlmIChjb21wb25lbnRzW2ldID09IG51bGwpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBwcm9qZWN0aW9uQ29tcG9uZW50c1tpXSA9IHByZWZpeCArICctJyArIGNvbXBvbmVudHNbaV07XG4gIH1cbiAgcmV0dXJuIHByb2plY3Rpb25Db21wb25lbnRzO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHN0YXRlR2V0QWNjZXNzb3JEaW1lbnNpb25zKFxuICBzdGF0ZTogU3RhdGVcbik6IEFycmF5PG51bWJlciB8IHN0cmluZz4ge1xuICBsZXQgZGltZW5zaW9uczogQXJyYXk8bnVtYmVyIHwgc3RyaW5nPjtcbiAgc3dpdGNoIChzdGF0ZS5zZWxlY3RlZFByb2plY3Rpb24pIHtcbiAgICBjYXNlICdwY2EnOlxuICAgICAgZGltZW5zaW9ucyA9IHN0YXRlLnBjYUNvbXBvbmVudERpbWVuc2lvbnMuc2xpY2UoKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3RzbmUnOlxuICAgICAgZGltZW5zaW9ucyA9IFswLCAxXTtcbiAgICAgIGlmIChzdGF0ZS50U05FaXMzZCkge1xuICAgICAgICBkaW1lbnNpb25zLnB1c2goMik7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICd1bWFwJzpcbiAgICAgIGRpbWVuc2lvbnMgPSBbMCwgMV07XG4gICAgICBpZiAoc3RhdGUudW1hcElzM2QpIHtcbiAgICAgICAgZGltZW5zaW9ucy5wdXNoKDIpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnY3VzdG9tJzpcbiAgICAgIGRpbWVuc2lvbnMgPSBbJ3gnLCAneSddO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBmYWxsdGhyb3VnaCcpO1xuICB9XG4gIHJldHVybiBkaW1lbnNpb25zO1xufVxuIl19