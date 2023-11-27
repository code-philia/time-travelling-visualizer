import { __awaiter, __decorate, __metadata } from "tslib";
import { PolymerElement } from '@polymer/polymer';
import { customElement, observe, property } from '@polymer/decorators';
import { LegacyElementMixin } from '../components/polymer/legacy_element_mixin';
import '../components/polymer/irons_and_papers';
import { AnalyticsLogger } from './analyticsLogger';
import { template } from './vz-projector.html';
import { getProjectionComponents, Projection, State, stateGetAccessorDimensions, } from './data';
import './vz-projector-metadata-card';
import { analyzeMetadata, } from './data-provider';
import { DemoDataProvider } from './data-provider-demo';
import { ProtoDataProvider } from './data-provider-proto';
import { ServerDataProvider } from './data-provider-server';
import './vz-projector-projections-panel';
import './vz-projector-bookmark-panel';
import './vz-projector-data-panel';
import './vz-projector-inspector-panel';
import { ProjectorScatterPlotAdapter } from './projectorScatterPlotAdapter';
import * as logging from './logging';
import * as util from './util';
import { MouseMode } from './scatterPlot';
/**
 * The minimum number of dimensions the data should have to automatically
 * decide to normalize the data.
 */
const THRESHOLD_DIM_NORMALIZE = 50;
const POINT_COLOR_MISSING = 'black';
const INDEX_METADATA_FIELD = '__index__';
/**
 * Save the initial URL query params, before the AppRoutingEffects initialize.
 */
const initialURLQueryString = window.location.search;
let Projector = class Projector extends LegacyElementMixin(PolymerElement) {
    constructor() {
        super(...arguments);
        this.showlabeled = true;
        this.showUnlabeled = true;
        this.showTesting = false;
        this._showNotAvaliable = false;
        this.showUnlabeledCheckbox = true;
        /**
         * Used by clients to indicate that a hover is occurring.
         */
        this.timer = null;
    }
    ready() {
        const _super = Object.create(null, {
            ready: { get: () => super.ready }
        });
        return __awaiter(this, void 0, void 0, function* () {
            _super.ready.call(this);
            logging.setDomContainer(this);
            this.analyticsLogger = new AnalyticsLogger(this.pageViewLogging, this.eventLogging);
            this.analyticsLogger.logPageView('embeddings');
            const hasWebGLSupport = yield util.hasWebGLSupport();
            if (!hasWebGLSupport) {
                this.analyticsLogger.logWebGLDisabled();
                logging.setErrorMessage('Your browser or device does not have WebGL enabled. Please enable ' +
                    'hardware acceleration, or use a browser that supports WebGL.');
                return;
            }
            this.selectionChangedListeners = [];
            this.hoverListeners = [];
            this.projectionChangedListeners = [];
            this.distanceMetricChangedListeners = [];
            this.selectedPointIndices = [];
            this.neighborsOfFirstPoint = [];
            this.timer = null;
            this.editMode = false;
            this.dataPanel = this.$['data-panel']; // DataPanel
            this.inspectorPanel = this.$['inspector-panel']; // InspectorPanel
            this.projectionsPanel = this.$['projections-panel']; // ProjectionsPanel
            this.bookmarkPanel = this.$['bookmark-panel']; // BookmarkPanel
            this.metadataCard = this.$['metadata-card']; // MetadataCard
            this.statusBar = this.$$('#status-bar');
            this.helpBtn = this.$$('#help-3d-icon');
            this.inspectorPanel.initialize(this, this);
            this.projectionsPanel.initialize(this);
            this.bookmarkPanel.initialize(this, this);
            this.setupUIControls();
            this.initializeDataProvider();
            this.d3loader();
            this.iteration = 0;
            this.currentIteration = 0;
            this.showlabeled = true;
            this.showUnlabeled = true;
            this.showTesting = false;
            this.registered = false;
            this.showUnlabeledCheckbox = window.sessionStorage.taskType === 'active learning';
            this.intervalFlag = true;
            this._showNotAvaliable = false;
            this.metadataStyle = {
                left: '320px',
                top: '120px'
            };
            let headers = new Headers();
            headers.append('Content-Type', 'application/json');
            headers.append('Accept', 'application/json');
            // await fetch("standalone_projector_config.json", { method: 'GET' })
            //   .then(response => response.json())
            //   .then(data => { this.DVIServer = data.DVIServerIP + ":" + data.DVIServerPort; })
            this.DVIServer = window.sessionStorage.ipAddress;
        });
    }
    ;
    d3loader() {
        let that = this;
        new Promise((resolve) => {
            // let url = "http://172.26.191.173:81/d3.v5.min.js"
            let url = "https://d3js.org/d3.v5.min.js";
            let script = document.createElement('script');
            script.setAttribute('src', url);
            script.onload = () => {
                resolve(true);
                that.initialTree();
            };
            document.body.append(script);
        });
    }
    initialTree(only, needRemove) {
        return __awaiter(this, void 0, void 0, function* () {
            // this.d3loader()
            const d3 = window.d3;
            let svgDom = this.$$("#mysvggg");
            while (svgDom === null || svgDom === void 0 ? void 0 : svgDom.firstChild) {
                svgDom.removeChild(svgDom.lastChild);
            }
            if (needRemove) {
                return;
            }
            console.log('isOnly?', only);
            // document.body.append(svgDom)
            let headers = new Headers();
            yield fetch(`http://${window.sessionStorage.ipAddress}/get_itertaion_structure?path=${window.sessionStorage.content_path}&method=${window.sessionStorage.vis_method}&setting=${window.sessionStorage.selectedSetting}`, {
                method: 'POST',
                headers: headers,
                mode: 'cors'
            })
                .then(response => response.json())
                .then(res => {
                var _a;
                if (only) {
                    res.structure = [{ value: only, name: only, pid: "" }];
                }
                let total = (_a = res.structure) === null || _a === void 0 ? void 0 : _a.length;
                res.structure.length = window.selectedTotalEpoch;
                window.treejson = res.structure;
                let data = res.structure;
                if (only) {
                }
                function tranListToTreeData(arr) {
                    const newArr = [];
                    const map = {};
                    // {
                    //   '01': {id:"01", pid:"",   "name":"老王",children: [] },
                    //   '02': {id:"02", pid:"01", "name":"小张",children: [] },
                    // }
                    arr.forEach(item => {
                        item.children = [];
                        const key = item.value;
                        map[key] = item;
                    });
                    // 2. 对于arr中的每一项
                    arr.forEach(item => {
                        const parent = map[item.pid];
                        if (parent) {
                            //    如果它有父级，把当前对象添加父级元素的children中
                            parent.children.push(item);
                        }
                        else {
                            //    如果它没有父级（pid:''）,直接添加到newArr
                            newArr.push(item);
                        }
                    });
                    return newArr;
                }
                data = tranListToTreeData(data)[0];
                var margin = 50;
                var svg = d3.select(svgDom);
                var width = svg.attr("width");
                var height = svg.attr("height");
                //create group
                var g = svg.append("g")
                    .attr("transform", "translate(" + margin + "," + 20 + ")");
                //create layer layout
                var hierarchyData = d3.hierarchy(data)
                    .sum(function (d, i) {
                    return d.value;
                });
                //    nodes attributes:
                //        node.data - data.
                //        node.depth - root is 0.
                //        node.height -  leaf node is 0.
                //        node.parent - parent id, root is null.
                //        node.children.
                //        node.value - total value current node and descendants;
                //create tree
                let len = total;
                let svgWidth = len * 40;
                if (window.sessionStorage.taskType === 'active learning') {
                    svgWidth = 1000;
                }
                // svgWidth = 1000
                console.log('svgWid', len, svgWidth);
                svgDom.style.width = svgWidth + 200;
                if (window.sessionStorage.selectedSetting !== 'active learning' && window.sessionStorage.selectedSetting !== 'dense al') {
                    svgDom.style.height = 90;
                    // svgDom.style.width = 2000
                }
                var tree = d3.tree()
                    .size([100, svgWidth])
                    .separation(function (a, b) {
                    return (a.parent == b.parent ? 1 : 2) / a.depth;
                });
                //init
                var treeData = tree(hierarchyData);
                //line node
                var nodes = treeData.descendants();
                var links = treeData.links();
                //line
                var link = d3.linkHorizontal()
                    .x(function (d) {
                    return d.y;
                }) //linkHorizontal
                    .y(function (d) {
                    return d.x;
                });
                //path
                g.append('g')
                    .selectAll('path')
                    .data(links)
                    .enter()
                    .append('path')
                    .attr('d', function (d, i) {
                    var start = {
                        x: d.source.x,
                        y: d.source.y
                    };
                    var end = {
                        x: d.target.x,
                        y: d.target.y
                    };
                    return link({
                        source: start,
                        target: end
                    });
                })
                    .attr('stroke', '#452d8a')
                    .attr('stroke-width', 1)
                    .attr('fill', 'none');
                //创建节点与文字分组
                var gs = g.append('g')
                    .selectAll('.g')
                    .data(nodes)
                    .enter()
                    .append('g')
                    .attr('transform', function (d, i) {
                    console.log("D", d);
                    return 'translate(' + d.data.pid * 40 + ',' + d.x + ')';
                });
                //绘制文字和节点
                if (window.iteration == undefined) {
                    window.iteration = 1;
                }
                gs.append('circle')
                    .attr('r', 8)
                    .attr('fill', function (d, i) {
                    console.log("1111", d.data.value, window.iteration, d.data.value == window.iteration);
                    return d.data.value == window.iteration ? 'orange' : '#452d8a';
                })
                    .attr('stroke-width', 1)
                    .attr('stroke', function (d, i) {
                    return d.data.value == window.iteration ? 'orange' : '#452d8a';
                });
                gs.append('text')
                    .attr('x', function (d, i) {
                    return d.children ? 5 : 10;
                })
                    .attr('y', function (d, i) {
                    return d.children ? -20 : -5;
                })
                    .attr('dy', 10)
                    .text(function (d, i) {
                    if (window.sessionStorage.taskType === 'active learning') {
                        return `${d.data.value}|${d.data.name}`;
                    }
                    else {
                        return `${d.data.value}`;
                    }
                });
            });
            let that = this;
            setTimeout(() => {
                let list = svgDom.querySelectorAll("circle");
                for (let i = 0; i <= list.length; i++) {
                    let c = list[i];
                    if (c) {
                        c.style.cursor = "pointer";
                        if (!only) {
                            c.addEventListener('click', (e) => {
                                if (e.target.nextSibling.innerHTML != window.iteration) {
                                    let value = e.target.nextSibling.innerHTML.split("|")[0];
                                    that.projectionsPanel.jumpTo(Number(value));
                                    window.sessionStorage.setItem('acceptIndicates', "");
                                    window.sessionStorage.setItem('rejectIndicates', "");
                                    this.initialTree();
                                }
                            });
                        }
                    }
                }
            }, 2000);
        });
    }
    readyregis() {
        let el = this.$$('#metadata-card');
        if (!el) {
            return;
        }
        let that = this;
        this.registered = true;
        el.onmousedown = function (e) {
            e = e || window.event;
            document.body.style.cursor = 'move';
            // 初始位置
            let offleft = Number(that.metadataStyle.left.replace('px', '')) || 0;
            let offTop = Number(that.metadataStyle.top.replace('px', '')) || 0;
            // 鼠标点击位置
            let startX = e.clientX;
            let startY = e.clientY;
            el.setCapture && el.setCapture();
            const handler = function (event) {
                event = event || window.event;
                // mouse stop position
                let endX = event.clientX;
                let endY = event.clientY;
                // distance
                let moveX = endX - startX;
                let moveY = endY - startY;
                // final position
                let lastX = offleft + moveX;
                let lastY = offTop + moveY;
                //boundry
                if (lastX >
                    document.documentElement.clientWidth - el.clientWidth - 20) {
                    lastX = document.documentElement.clientWidth - el.clientWidth - 20;
                }
                else if (lastX < 20) {
                    lastX = 0;
                }
                if (lastY >
                    document.documentElement.clientWidth - el.clientWidth - 20) {
                    lastY =
                        document.documentElement.clientHeight - el.clientHeight - 20;
                }
                else if (lastY < 20) {
                    lastY = 0;
                }
                el.style.left = lastX + "px";
                el.style.top = lastY + "px";
                that.metadataStyle = {
                    left: lastX + "px",
                    top: lastY + "px"
                };
            };
            document.addEventListener('mousemove', handler, false);
            document.addEventListener('mouseup', () => {
                document.body.style.cursor = 'default';
                document.removeEventListener('mousemove', handler);
            }, false);
            //
            document.onmouseup = function () {
                document.ontouchmove = null;
                //@ts-ignore
                document.releaseCapture && document.releaseCapture();
            };
            return false;
        };
    }
    _labeledChanged() {
        let indicates = [];
        if (window.nowShowIndicates) {
            if (this.showlabeled) {
                for (let i = 0; i < window.properties[window.iteration].length; i++) {
                    let indicate = window.properties[window.iteration][i];
                    if (indicate === 0 || window.nowShowIndicates.indexOf(i) !== -1) {
                        indicates.push(i);
                    }
                }
                window.nowShowIndicates = indicates;
                // this.projector.filterDataset(window.nowShowIndicates)
            }
            else {
                ///隐藏labeled
                for (let i = 0; i < window.properties[window.iteration].length; i++) {
                    if (window.properties[window.iteration][i] !== 0 && window.nowShowIndicates.indexOf(i) !== -1) {
                        indicates.push(i);
                    }
                }
                window.nowShowIndicates = indicates;
            }
            this.filterDataset(window.nowShowIndicates);
        }
    }
    _unLabelChanged() {
        let indicates = [];
        if (window.nowShowIndicates) {
            if (this.showUnlabeled) {
                for (let i = 0; i < window.properties[window.iteration].length; i++) {
                    let indicate = window.properties[window.iteration][i];
                    if (indicate === 1 || window.nowShowIndicates.indexOf(i) !== -1) {
                        indicates.push(i);
                    }
                }
                window.nowShowIndicates = indicates;
                // this.projector.filterDataset(window.nowShowIndicates)
            }
            else {
                for (let i = 0; i < window.properties[window.iteration].length; i++) {
                    if (window.properties[window.iteration][i] !== 1 && window.nowShowIndicates.indexOf(i) !== -1) {
                        indicates.push(i);
                    }
                }
                window.nowShowIndicates = indicates;
            }
            this.filterDataset(window.nowShowIndicates);
        }
    }
    _testingChanged() {
        let indicates = [];
        if (window.nowShowIndicates) {
            if (this.showTesting) {
                for (let i = 0; i < window.properties[window.iteration].length; i++) {
                    let indicate = window.properties[window.iteration][i];
                    if (indicate === 2 || window.nowShowIndicates.indexOf(i) !== -1) {
                        indicates.push(i);
                    }
                }
                window.nowShowIndicates = indicates;
                // this.projector.filterDataset(window.nowShowIndicates)
            }
            else {
                for (let i = 0; i < window.properties[window.iteration].length; i++) {
                    if (window.properties[window.iteration][i] !== 2 && window.nowShowIndicates.indexOf(i) !== -1) {
                        indicates.push(i);
                    }
                }
                window.nowShowIndicates = indicates;
            }
            this.filterDataset(window.nowShowIndicates);
        }
    }
    onIterationChange(num) {
        window.sessionStorage.setItem('iteration', String(num));
        // window.iteration = num;
        let indicates = [];
        this.iteration = num;
        if (!window.isAnimatating) {
            if (this.showTesting === false) {
                for (let i = 0; i < window.properties[window.iteration].length; i++) {
                    if (window.properties[window.iteration][i] !== 2 && window.nowShowIndicates.indexOf(i) !== -1) {
                        indicates.push(i);
                    }
                }
                window.nowShowIndicates = indicates;
            }
            this.filterDataset(window.nowShowIndicates);
        }
        if (this.inspectorPanel) {
            if (window.sessionStorage.taskType === 'active learning' && window.iteration !== 1) {
                this.inspectorPanel.updateDisabledStatues(true);
            }
            else {
                this.inspectorPanel.updateDisabledStatues(false);
            }
        }
        this.initialTree();
    }
    setSelectedLabelOption(labelOption) {
        this.selectedLabelOption = labelOption;
        this.metadataCard.setLabelOption(this.selectedLabelOption);
        this.projectorScatterPlotAdapter.setLabelPointAccessor(labelOption);
        this.projectorScatterPlotAdapter.updateScatterPlotAttributes();
        this.projectorScatterPlotAdapter.render();
    }
    setSelectedColorOption(colorOption) {
        this.selectedColorOption = colorOption;
        this.projectorScatterPlotAdapter.setLegendPointColorer(this.getLegendPointColorer(colorOption));
        this.projectorScatterPlotAdapter.updateScatterPlotAttributes();
        this.projectorScatterPlotAdapter.render();
    }
    setNormalizeData(normalizeData) {
        this.normalizeData = normalizeData;
        this.setCurrentDataSet(this.originalDataSet.getSubset());
    }
    updateDataSet(ds, spriteAndMetadata, metadataFile) {
        this.dataSetFilterIndices = null;
        this.originalDataSet = ds;
        if (ds != null) {
            this.normalizeData =
                this.originalDataSet.dim[1] >= THRESHOLD_DIM_NORMALIZE;
            spriteAndMetadata = spriteAndMetadata || {};
            if (spriteAndMetadata.pointsInfo == null) {
                let [pointsInfo, stats] = this.makeDefaultPointsInfoAndStats(ds.points);
                spriteAndMetadata.pointsInfo = pointsInfo;
                spriteAndMetadata.stats = stats;
            }
            let metadataMergeSucceeded = ds.mergeMetadata(spriteAndMetadata);
            if (!metadataMergeSucceeded) {
                return;
            }
        }
        if (this.projectorScatterPlotAdapter != null) {
            if (ds == null) {
                this.projectorScatterPlotAdapter.setLabelPointAccessor(null);
                this.setProjection(null);
            }
            else {
                this.projectorScatterPlotAdapter.updateScatterPlotPositions();
                this.projectorScatterPlotAdapter.updateScatterPlotAttributes();
                this.projectorScatterPlotAdapter.resize();
                this.projectorScatterPlotAdapter.render();
            }
        }
        if (ds != null) {
            this.dataPanel.setNormalizeData(this.normalizeData);
            this.setCurrentDataSet(ds.getSubset());
            this.projectorScatterPlotAdapter.setLabelPointAccessor(this.selectedLabelOption);
            this.inspectorPanel.datasetChanged();
            this.inspectorPanel.metadataChanged(spriteAndMetadata);
            this.projectionsPanel.metadataChanged(spriteAndMetadata);
            this.dataPanel.metadataChanged(spriteAndMetadata, metadataFile);
            //reset
            if (window.sessionStorage.iteration) {
                this.projectionsPanel.jumpTo(Number(window.sessionStorage.iteration));
            }
            else {
                this.projectionsPanel.jumpTo(Number(1));
            }
            //reset
            if (window.sessionStorage.acceptIndicates) {
                window.acceptIndicates = window.sessionStorage.acceptIndicates.split(",").map(parseFloat);
            }
            if (window.sessionStorage.rejectIndicates) {
                window.rejectIndicates = window.sessionStorage.rejectIndicates.split(",").map(parseFloat);
            }
            if (window.sessionStorage.customSelection) {
                window.customSelection = window.sessionStorage.customSelection.split(",").map(parseFloat);
            }
        }
        else {
            this.setCurrentDataSet(null);
            // this.projectorScatterPlotAdapter
        }
    }
    metadataEdit(metadataColumn, metadataLabel) {
        this.selectedPointIndices.forEach((i) => (this.dataSet.points[i].metadata[metadataColumn] = metadataLabel));
        this.neighborsOfFirstPoint.forEach((p) => (this.dataSet.points[p.index].metadata[metadataColumn] = metadataLabel));
        this.dataSet.spriteAndMetadataInfo.stats = analyzeMetadata(this.dataSet.spriteAndMetadataInfo.stats.map((s) => s.name), this.dataSet.points.map((p) => p.metadata));
        this.metadataChanged(this.dataSet.spriteAndMetadataInfo);
        this.metadataEditorContext(true, metadataColumn);
    }
    metadataChanged(spriteAndMetadata, metadataFile) {
        if (metadataFile != null) {
            this.metadataFile = metadataFile;
        }
        this.dataSet.spriteAndMetadataInfo = spriteAndMetadata;
        this.projectionsPanel.metadataChanged(spriteAndMetadata);
        this.inspectorPanel.metadataChanged(spriteAndMetadata);
        this.dataPanel.metadataChanged(spriteAndMetadata, this.metadataFile);
        if (this.selectedPointIndices.length > 0) {
            // at least one selected point
            this.metadataCard.updateMetadata(
            // show metadata for first selected point
            this.dataSet.points[this.selectedPointIndices[0]].metadata);
        }
        else {
            // no points selected
            this.metadataCard.updateMetadata(null); // clear metadata
        }
        this.setSelectedLabelOption(this.selectedLabelOption);
    }
    metadataEditorContext(enabled, metadataColumn) {
        if (this.inspectorPanel) {
            this.inspectorPanel.metadataEditorContext(enabled, metadataColumn);
        }
    }
    setSelectedTensor(run, tensorInfo) {
        this.bookmarkPanel.setSelectedTensor(run, tensorInfo, this.dataProvider);
    }
    updateBackgroundImg() {
        this.projectorScatterPlotAdapter.updateBackground();
    }
    /**
     * Registers a listener to be called any time the selected point set changes.
     */
    registerSelectionChangedListener(listener) {
        this.selectionChangedListeners.push(listener);
    }
    filterDataset(pointIndices, filter) {
        const selectionSize = this.selectedPointIndices.length;
        /*
        if (this.dataSetBeforeFilter == null) {
          this.dataSetBeforeFilter = this.dataSet;
        }*/
        console.log('now', pointIndices.length, this.dataSet);
        this.dataSet.setDVIFilteredData(pointIndices);
        // this.setCurrentDataSet(this.dataSet.getSubset(pointIndices));
        this.dataSetFilterIndices = pointIndices;
        this.projectorScatterPlotAdapter.updateScatterPlotPositions();
        this.projectorScatterPlotAdapter.updateScatterPlotAttributes(filter);
        // this.projectorScatterPlotAdapter.updateBackground()
        this.projectorScatterPlotAdapter.render();
        // this.adjustSelectionAndHover(util.range(selectionSize));
        if (window.isAdjustingSel) {
            // this.boundingSelectionBtn.classList.add('actived')
            this.setMouseMode(MouseMode.AREA_SELECT);
        }
    }
    resetFilterDataset(num) {
        const originalPointIndices = this.selectedPointIndices.map((filteredIndex) => this.dataSet.points[filteredIndex].index);
        /*
        this.setCurrentDataSet(this.dataSetBeforeFilter);
        if (this.projection != null) {
          this.projection.dataSet = this.dataSetBeforeFilter;
        }
        this.dataSetBeforeFilter = null;*/
        // setDVIfilter all data
        let total = this.dataSet.DVIValidPointNumber[this.dataSet.tSNEIteration];
        if (num) {
            total = num;
        }
        var indices;
        indices = [];
        for (let i = 0; i < total; i++) {
            indices.push(i);
        }
        this.dataSetFilterIndices = indices;
        this.dataSet.setDVIFilteredData(indices);
        this.projectorScatterPlotAdapter.updateScatterPlotPositions();
        this.projectorScatterPlotAdapter.updateScatterPlotAttributes();
        // this.adjustSelectionAndHover(util.range(selectionSize));
    }
    ///
    setDynamicNoisy() {
        var _a, _b, _c;
        // this.setDynamicStop()
        if (!window.customSelection) {
            window.customSelection = [];
        }
        if (!window.queryResAnormalCleanIndecates) {
            window.queryResAnormalCleanIndecates = [];
        }
        let indecates = window.queryResAnormalCleanIndecates.concat(window.customSelection);
        if (indecates && indecates.length) {
            this.filterDataset(indecates);
        }
        // this.filterDataset(this.selectedPointIndices)
        this.currentIteration = window.iteration;
        let current = 1;
        let positions = (_a = window.allResPositions) === null || _a === void 0 ? void 0 : _a.results;
        let interationList = [];
        if (window.allResPositions && window.allResPositions.bgimgList) {
            window.sceneBackgroundImg = (_b = window.allResPositions) === null || _b === void 0 ? void 0 : _b.bgimgList;
        }
        for (let key of Object.keys((_c = window.allResPositions) === null || _c === void 0 ? void 0 : _c.results)) {
            interationList.push(Number(key));
        }
        current = Number(interationList[0]);
        let count = 0;
        if (this.intervalFlag) {
            this.intervalFlag = false;
            this.timer = window.setInterval(() => {
                var _a;
                this.inspectorPanel.updateCurrentPlayEpoch(current);
                window.iteration = current;
                let length = this.dataSet.points.length;
                if (length === 60002) {
                    let point1 = this.dataSet.points[length - 2];
                    let point2 = this.dataSet.points[length - 1];
                    point1.projections['tsne-0'] = window.allResPositions.grid[current][0];
                    point1.projections['tsne-1'] = window.allResPositions.grid[current][1];
                    point2.projections['tsne-0'] = window.allResPositions.grid[current][2];
                    point2.projections['tsne-1'] = window.allResPositions.grid[current][3];
                    // point.projections['tsne-0'] = 
                }
                for (let i = 0; i < this.dataSet.points.length; i++) {
                    const point = this.dataSet.points[i];
                    if (!window.customSelection || !window.customSelection.length || window.customSelection.indexOf(i) !== -1 || ((_a = window.queryResAnormalCleanIndecates) === null || _a === void 0 ? void 0 : _a.indexOf(i)) !== -1) {
                        point.projections['tsne-0'] = positions[current][i][0];
                        point.projections['tsne-1'] = positions[current][i][1];
                        point.projections['tsne-2'] = 0;
                    }
                }
                // this.dataSet.updateProjection(current)
                this.projectorScatterPlotAdapter.updateScatterPlotPositions();
                this.projectorScatterPlotAdapter.updateScatterPlotAttributes();
                this.updateBackgroundImg();
                this.onIterationChange(current);
                // this.projectorScatterPlotAdapter.updateScatterPlotAttributes()
                this.projectorScatterPlotAdapter.render();
                if (count == interationList.length - 1) {
                    this.inspectorPanel.playAnimationFinished();
                    this.setDynamicStop();
                    current = interationList[0];
                    count = 0;
                }
                else {
                    current = interationList[++count];
                }
            }, 1200);
        }
    }
    updatePosByIndicates(current) {
        var _a;
        let positions = (_a = window.allResPositions) === null || _a === void 0 ? void 0 : _a.results;
        for (let i = 0; i < this.dataSet.points.length; i++) {
            const point = this.dataSet.points[i];
            if (!this.selectedPointIndices.length || this.selectedPointIndices.indexOf(i) !== -1) {
                point.projections['tsne-0'] = positions[current][i][0];
                point.projections['tsne-1'] = positions[current][i][1];
                point.projections['tsne-2'] = 0;
            }
        }
        // this.dataSet.updateProjection(current)
        this.projectorScatterPlotAdapter.updateScatterPlotPositions();
        this.projectorScatterPlotAdapter.updateScatterPlotAttributes();
        this.updateBackgroundImg();
        this.onIterationChange(current);
    }
    setDynamicStop() {
        window.isAnimatating = false;
        if (this.timer && !this.intervalFlag) {
            window.clearInterval(this.timer);
            this.intervalFlag = true;
            this.resetFilterDataset();
        }
        let end = setInterval(function () { }, 10000);
        for (let i = 1; i <= end; i++) {
            clearInterval(i);
        }
        this.iteration = this.currentIteration;
        let length = this.dataSet.points.length;
        if (length === 60002) {
            let point1 = this.dataSet.points[length - 2];
            let point2 = this.dataSet.points[length - 1];
            point1.projections['tsne-0'] = window.allResPositions.grid[this.iteration][0];
            point1.projections['tsne-1'] = window.allResPositions.grid[this.iteration][1];
            point2.projections['tsne-0'] = window.allResPositions.grid[this.iteration][2];
            point2.projections['tsne-1'] = window.allResPositions.grid[this.iteration][3];
            // point.projections['tsne-0'] = 
        }
        window.iteration = this.currentIteration;
        this.updatePosByIndicates(window.iteration);
    }
    renderInTraceLine(inTrace) {
        this.projectorScatterPlotAdapter.setRenderInTraceLine(inTrace);
    }
    refresh() {
        console.log('rreefff');
        // this.projectorScatterPlotAdapter.scatterPlot.render()
        this.metadataCard.updateCustomList(this.dataSet.points, this);
        this.metadataCard.updateRejectList(this.dataSet.points, this);
        // this.projectorScatterPlotAdapter.scatterPlot.render()
        this.projectorScatterPlotAdapter.updateScatterPlotAttributes();
        this.projectorScatterPlotAdapter.render();
    }
    removecustomInMetaCard() {
        this.metadataCard.updateCustomList(this.dataSet.points, this);
        this.metadataCard.updateRejectList(this.dataSet.points, this);
        // this.inspectorPanel.refreshSearchResult()
        this.inspectorPanel.updateSessionStorage();
        this.projectorScatterPlotAdapter.updateScatterPlotAttributes();
        this.projectorScatterPlotAdapter.render();
    }
    /**
     * Used by clients to indicate that a selection has occurred.
     */
    notifySelectionChanged(newSelectedPointIndices, selectMode, selectionType) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            console.log('notifySelectionChanged', selectionType, newSelectedPointIndices);
            if (!this.registered) {
                this.readyregis();
            }
            if (!window.acceptIndicates) {
                window.acceptIndicates = [];
            }
            if (!window.rejectIndicates) {
                window.rejectIndicates = [];
            }
            window.customSelection = window.acceptIndicates.concat(window.rejectIndicates);
            if (selectionType === 'isALQuery' || selectionType === 'normal' || selectionType === 'isAnormalyQuery' || selectionType === 'boundingbox') {
                // window.customSelection = []
                window.queryResPointIndices = newSelectedPointIndices;
                if (selectionType === 'isALQuery') {
                    window.alQueryResPointIndices = newSelectedPointIndices;
                }
                else {
                    window.alQueryResPointIndices = [];
                }
            }
            if (selectionType === 'isShowSelected') {
                for (let i = 0; i < ((_a = window.previousIndecates) === null || _a === void 0 ? void 0 : _a.length); i++) {
                    // if(window.customSelection.indexOf(window.previousIndecates[i]) === -1){
                    let index = window.previousIndecates[i];
                    if (window.checkboxDom[index]) {
                        window.checkboxDom[index].checked = true;
                    }
                    // }
                }
                this.metadataCard.updateCustomList(this.dataSet.points, this);
                this.metadataCard.updateRejectList(this.dataSet.points, this);
                this.projectorScatterPlotAdapter.updateScatterPlotAttributes();
                this.projectorScatterPlotAdapter.render();
                return;
            }
            if (selectionType === 'boundingbox') {
                let headers = new Headers();
                headers.append('Content-Type', 'application/json');
                headers.append('Accept', 'application/json');
                yield fetch(`http://${this.DVIServer}/boundingbox_record`, {
                    method: 'POST',
                    mode: 'cors',
                    body: JSON.stringify({
                        "username": window.sessionStorage.username,
                    }),
                    headers: headers,
                }).then(() => {
                    console.log('123323');
                });
                window.alSuggestLabelList = [];
                window.alSuggestScoreList = [];
                window.queryResPointIndices = newSelectedPointIndices;
                this.selectedPointIndices = newSelectedPointIndices;
                window.alQueryResPointIndices = [];
                this.inspectorPanel.refreshSearchResByList(newSelectedPointIndices);
                this.projectorScatterPlotAdapter.updateScatterPlotAttributes();
                this.projectorScatterPlotAdapter.render();
                this.selectionChangedListeners.forEach((l) => l(this.selectedPointIndices, []));
                return;
            }
            let neighbors = [];
            if (this.editMode && // point selection toggle in existing selection
                newSelectedPointIndices.length > 0) {
                // selection required
                if (this.selectedPointIndices.length === 1) {
                    // main point with neighbors
                    let main_point_vector = this.dataSet.points[this.selectedPointIndices[0]].vector;
                    neighbors = this.neighborsOfFirstPoint.filter((n // deselect
                    ) => newSelectedPointIndices.filter((p) => p == n.index).length == 0);
                    newSelectedPointIndices.forEach((p) => {
                        // add additional neighbors
                        if (p != this.selectedPointIndices[0] && // not main point
                            this.neighborsOfFirstPoint.filter((n) => n.index == p).length == 0) {
                            let p_vector = this.dataSet.points[p].vector;
                            let n_dist = this.inspectorPanel.distFunc(main_point_vector, p_vector);
                            let pos = 0; // insertion position into dist ordered neighbors
                            while (pos < neighbors.length &&
                                neighbors[pos].dist < n_dist // find pos
                            )
                                pos = pos + 1; // move up the sorted neighbors list according to dist
                            neighbors.splice(pos, 0, { index: p, dist: n_dist }); // add new neighbor
                        }
                    });
                }
                else {
                    // multiple selections
                    let updatedSelectedPointIndices = this.selectedPointIndices.filter((n) => newSelectedPointIndices.filter((p) => p == n).length == 0); // deselect
                    newSelectedPointIndices.forEach((p) => {
                        // add additional selections
                        if (this.selectedPointIndices.filter((s) => s == p).length == 0)
                            // unselected
                            updatedSelectedPointIndices.push(p);
                    });
                    this.selectedPointIndices = updatedSelectedPointIndices; // update selection
                    if (this.selectedPointIndices.length > 0) {
                        // at least one selected point
                        this.metadataCard.updateMetadata(
                        // show metadata for first selected point
                        this.dataSet.points[this.selectedPointIndices[0]].metadata);
                    }
                    else {
                        // no points selected
                        this.metadataCard.updateMetadata(null); // clear metadata
                    }
                }
            }
            else if (selectMode == true) {
                // for bounding box selection
                // multiple selections
                let updatedSelectedPointIndices = this.selectedPointIndices.filter((n) => newSelectedPointIndices.filter((p) => p == n).length == 0); // deselect
                newSelectedPointIndices.forEach((p) => {
                    // add additional selections
                    if (this.selectedPointIndices.filter((s) => s == p).length == 0)
                        // unselected
                        updatedSelectedPointIndices.push(p);
                });
                this.selectedPointIndices = updatedSelectedPointIndices; // update selection
                if (this.selectedPointIndices.length > 0) {
                    // at least one selected point
                    if (this.selectedPointIndices.length == 1) {
                        this.metadataCard.updateMetadata(
                        // show metadata for first selected point
                        this.dataSet.points[this.selectedPointIndices[0]].metadata);
                    }
                    else {
                        this.metadataCard.updateMetadata(null);
                    }
                }
                else {
                    // no points selected
                    this.metadataCard.updateMetadata(null); // clear metadata
                }
                this.inspectorPanel.updateBoundingBoxSelection(newSelectedPointIndices);
            }
            else {
                // normal selection mode
                this.selectedPointIndices = newSelectedPointIndices;
                if (newSelectedPointIndices.length === 1 && this.dataSet.points[newSelectedPointIndices[0]].metadata.label != "background") {
                    /*
                    neighbors = this.dataSet.findNeighbors(
                      newSelectedPointIndices[0],
                      this.inspectorPanel.distFunc,
                      this.inspectorPanel.numNN
                    );*/
                    if (this.dataSet.points[newSelectedPointIndices[0]].metadata.label != "background")
                        neighbors[0] = {
                            index: newSelectedPointIndices[0],
                            dist: 0
                        };
                }
                else {
                    this.metadataCard.updateMetadata(null);
                }
            }
            this.selectionChangedListeners.forEach((l) => l(this.selectedPointIndices, neighbors));
        });
    }
    updateMetaDataByIndices(indices, src) {
        if (indices === -1) {
            this.metadataCard.updateMetadata(null);
            return;
        }
        console.log('bububububuuu here');
        this.metadataCard.updateMetadata(this.dataSet.points[indices].metadata, src, this.dataSet.points[indices]);
    }
    updateMetaByIndices(indices) {
        if (indices === -1) {
            this.metadataCard.updateMetadata(null);
            return;
        }
        this.dataSet.getSpriteImage(indices, (imgData) => {
            let src = imgData.imgUrl;
            this.metadataCard.updateMetadata(this.dataSet.points[indices].metadata, src, this.dataSet.points[indices], indices);
        });
    }
    /**
     * Registers a listener to be called any time the mouse hovers over a point.
     */
    registerHoverListener(listener) {
        this.hoverListeners.push(listener);
    }
    notifyHoverOverPoint(pointIndex) {
        this.hoverListeners.forEach((l) => l(pointIndex));
        let timeNow = new Date().getTime();
        if (this.timer === null || timeNow - this.timer > 10) {
            if (window.iteration && pointIndex !== undefined && pointIndex !== null && window.previousHover !== pointIndex) {
                this.timer = timeNow;
                this.updateMetaByIndices(pointIndex);
                window.previousHover = pointIndex;
            }
        }
    }
    registerProjectionChangedListener(listener) {
        this.projectionChangedListeners.push(listener);
    }
    notifyProjectionChanged(projection) {
        this.projectionChangedListeners.forEach((l) => l(projection));
    }
    registerDistanceMetricChangedListener(l) {
        this.distanceMetricChangedListeners.push(l);
    }
    notifyDistanceMetricChanged(distMetric) {
        this.distanceMetricChangedListeners.forEach((l) => l(distMetric));
    }
    _dataProtoChanged(dataProtoString) {
        let dataProto = dataProtoString
            ? JSON.parse(dataProtoString)
            : null;
        this.initializeDataProvider(dataProto);
    }
    makeDefaultPointsInfoAndStats(points) {
        let pointsInfo = [];
        points.forEach((p) => {
            let pointInfo = {};
            pointInfo[INDEX_METADATA_FIELD] = p.index;
            pointsInfo.push(pointInfo);
        });
        let stats = [
            {
                name: INDEX_METADATA_FIELD,
                isNumeric: false,
                tooManyUniqueValues: true,
                min: 0,
                max: pointsInfo.length - 1,
            },
        ];
        return [pointsInfo, stats];
    }
    initializeDataProvider(dataProto) {
        if (this.servingMode === 'demo') {
            let projectorConfigUrl;
            // Only in demo mode do we allow the config being passed via URL.
            let urlParams = util.getURLParams(initialURLQueryString);
            if ('config' in urlParams) {
                projectorConfigUrl = urlParams['config'];
            }
            else {
                projectorConfigUrl = this.projectorConfigJsonPath;
            }
            this.dataProvider = new DemoDataProvider(projectorConfigUrl);
        }
        else if (this.servingMode === 'server') {
            if (!this.routePrefix) {
                throw 'route-prefix is a required parameter';
            }
            this.dataProvider = new ServerDataProvider(this.routePrefix);
        }
        else if (this.servingMode === 'proto' && dataProto != null) {
            this.dataProvider = new ProtoDataProvider(dataProto);
        }
        else {
            // The component is not ready yet - waiting for the dataProto field.
            return;
        }
        this.dataPanel.initialize(this, this.dataProvider);
    }
    getLegendPointColorer(colorOption) {
        if (colorOption == null || colorOption.map == null) {
            return null;
        }
        const colorer = (ds, i) => {
            let value = ds.points[i].metadata[this.selectedColorOption.name];
            if (value == null) {
                return POINT_COLOR_MISSING;
            }
            return ds.points[i].color;
            //return colorOption.map(value);
        };
        return colorer;
    }
    get3DLabelModeButton() {
        return this.$$('#labels3DMode');
    }
    get3DLabelMode() {
        const label3DModeButton = this.get3DLabelModeButton();
        return label3DModeButton.active;
    }
    adjustSelectionAndHover(selectedPointIndices, hoverIndex) {
        this.notifySelectionChanged(selectedPointIndices);
        this.notifyHoverOverPoint(hoverIndex);
        this.setMouseMode(MouseMode.CAMERA_AND_CLICK_SELECT);
    }
    setMouseMode(mouseMode) {
        let selectModeButton = this.$$('#selectMode');
        selectModeButton.active = mouseMode === MouseMode.AREA_SELECT;
        this.projectorScatterPlotAdapter.scatterPlot.setMouseMode(mouseMode);
    }
    setCurrentDataSet(ds) {
        this.adjustSelectionAndHover([]);
        if (this.dataSet != null) {
            this.dataSet.stopTSNE();
        }
        if (ds != null && this.normalizeData) {
            ds.normalize();
        }
        this.dim = ds == null ? 0 : ds.dim[1];
        this.$$('span.numDataPoints').innerText =
            ds == null ? '0' : '' + ds.dim[0];
        this.$$('span.dim').innerText =
            ds == null ? '0' : '' + ds.dim[1];
        this.dataSet = ds;
        this.projectionsPanel.dataSetUpdated(this.dataSet, this.originalDataSet, this.dim);
        this.projectorScatterPlotAdapter.setDataSet(this.dataSet);
        this.projectorScatterPlotAdapter.scatterPlot.setCameraParametersForNextCameraCreation(null, true);
    }
    setupUIControls() {
        // View controls
        this.helpBtn.addEventListener('click', () => {
            this.$.help3dDialog.open();
        });
        this.$$('#reset-zoom').addEventListener('click', () => {
            this.projectorScatterPlotAdapter.scatterPlot.resetZoom();
            this.projectorScatterPlotAdapter.scatterPlot.startOrbitAnimation();
        });
        let selectModeButton = this.$$('#selectMode');
        selectModeButton.addEventListener('click', (event) => {
            this.setMouseMode(selectModeButton.active
                ? MouseMode.AREA_SELECT
                : MouseMode.CAMERA_AND_CLICK_SELECT);
        });
        let nightModeButton = this.$$('#nightDayMode');
        nightModeButton.addEventListener('click', () => {
            this.projectorScatterPlotAdapter.scatterPlot.setDayNightMode(nightModeButton.active);
        });
        let hiddenBackground = this.$$('#hiddenBackground');
        hiddenBackground.addEventListener('click', () => {
            window.hiddenBackground = hiddenBackground.active;
            for (let i = 0; i < this.dataSet.points.length; i++) {
                const point = this.dataSet.points[i];
                if (point.metadata[this.selectedLabelOption]) {
                    let hoverText = point.metadata[this.selectedLabelOption].toString();
                    if (hoverText == 'background') {
                        if (hiddenBackground.active) {
                            // window.scene.remove(window.backgroundMesh)
                            point.color = '#ffffff';
                        }
                        else {
                            point.color = point.DVI_color[1];
                            // window.scene.add(window.backgroundMesh)
                        }
                    }
                }
            }
            // if(window.scene.children)
            if (window.scene.children[2] && window.scene.children[2].type === 'Mesh') {
                for (let i = 2; i < window.scene.children.length; i++) {
                    window.scene.children[i].visible = !window.hiddenBackground;
                }
            }
            this.projectorScatterPlotAdapter.scatterPlot.render();
            // this.projectorScatterPlotAdapter.scatterPlot.hiddenBackground(
            //   (hiddenBackground as any).active,
            // );
        });
        let editModeButton = this.$$('#editMode');
        editModeButton.addEventListener('click', (event) => {
            this.editMode = editModeButton.active;
        });
        const labels3DModeButton = this.get3DLabelModeButton();
        labels3DModeButton.addEventListener('click', () => {
            this.projectorScatterPlotAdapter.set3DLabelMode(this.get3DLabelMode());
        });
        //
        let triangleModeBtn = this.$$("#triangleMode");
        triangleModeBtn.addEventListener('click', () => {
            this.projectorScatterPlotAdapter.setTriangleMode(triangleModeBtn.active);
        });
        window.addEventListener('resize', () => {
            this.projectorScatterPlotAdapter.resize();
        });
        {
            this.projectorScatterPlotAdapter = new ProjectorScatterPlotAdapter(this.getScatterContainer(), this);
            this.projectorScatterPlotAdapter.setLabelPointAccessor(this.selectedLabelOption);
        }
        this.projectorScatterPlotAdapter.scatterPlot.onCameraMove((cameraPosition, cameraTarget) => this.bookmarkPanel.clearStateSelection());
        this.registerHoverListener((hoverIndex) => {
            this.onHover(hoverIndex);
        });
        this.registerProjectionChangedListener((projection) => this.onProjectionChanged(projection));
        this.registerSelectionChangedListener((selectedPointIndices, neighborsOfFirstPoint) => this.onSelectionChanged(selectedPointIndices, neighborsOfFirstPoint));
    }
    onHover(hoverIndex) {
        this.hoverPointIndex = hoverIndex;
        let hoverText = null;
        if (hoverIndex != null) {
            const point = this.dataSet.points[hoverIndex];
            if (point.metadata[this.selectedLabelOption]) {
                hoverText = point.metadata[this.selectedLabelOption].toString();
            }
        }
        if (this.selectedPointIndices.length === 0) {
            this.statusBar.style.display = hoverText ? null : 'none';
            this.statusBar.innerText = hoverText;
        }
    }
    getScatterContainer() {
        return this.$$('#scatter');
    }
    onSelectionChanged(selectedPointIndices, neighborsOfFirstPoint) {
        this.selectedPointIndices = selectedPointIndices;
        this.neighborsOfFirstPoint = neighborsOfFirstPoint;
        this.dataPanel.onProjectorSelectionChanged(selectedPointIndices, neighborsOfFirstPoint);
        let totalNumPoints = this.selectedPointIndices.length + neighborsOfFirstPoint.length;
        this.statusBar.innerText = `Selected ${totalNumPoints} points`;
        this.statusBar.style.display = totalNumPoints > 0 ? null : 'none';
    }
    onProjectionChanged(projection) {
        this.dataPanel.projectionChanged(projection);
        this.updateBackgroundImg();
        this.inspectorPanel.clearQueryResList();
        this.notifySelectionChanged([]);
        this.projectorScatterPlotAdapter.render();
    }
    setProjection(projection) {
        this.projection = projection;
        if (projection != null) {
            this.analyticsLogger.logProjectionChanged(projection.projectionType);
        }
        this.notifyProjectionChanged(projection);
    }
    // notifyProjectionPositionsUpdated(newSelection?: any[]) {
    //   this.projectorScatterPlotAdapter.notifyProjectionPositionsUpdated(newSelection);
    // }
    notifyProjectionPositionsUpdated() {
        this.projectorScatterPlotAdapter.notifyProjectionPositionsUpdated();
        this.metadataCard.updateCustomList(this.dataSet.points, this);
        this.metadataCard.updateRejectList(this.dataSet.points, this);
    }
    hiddenOrShowScatter(type) {
        let dom = this.$$('#scatter');
        dom.style.visibility = type;
        if (type === '') {
            this._showNotAvaliable = false;
        }
        else {
            this._showNotAvaliable = true;
        }
    }
    refreshnoisyBtn() {
        this.inspectorPanel.refreshBtnStyle();
    }
    /**
     * Gets the current view of the embedding and saves it as a State object.
     */
    getCurrentState() {
        const state = new State();
        // Save the individual datapoint projections.
        state.projections = [];
        for (let i = 0; i < this.dataSet.points.length; i++) {
            const point = this.dataSet.points[i];
            const projections = {};
            const keys = Object.keys(point.projections);
            for (let j = 0; j < keys.length; ++j) {
                projections[keys[j]] = point.projections[keys[j]];
            }
            state.projections.push(projections);
        }
        state.selectedProjection = this.projection.projectionType;
        state.dataSetDimensions = this.dataSet.dim;
        state.tSNEIteration = this.dataSet.tSNEIteration;
        state.selectedPoints = this.selectedPointIndices;
        state.filteredPoints = this.dataSetFilterIndices;
        this.projectorScatterPlotAdapter.populateBookmarkFromUI(state);
        state.selectedColorOptionName = this.dataPanel.selectedColorOptionName;
        state.forceCategoricalColoring = this.dataPanel.forceCategoricalColoring;
        state.selectedLabelOption = this.selectedLabelOption;
        this.projectionsPanel.populateBookmarkFromUI(state);
        return state;
    }
    /** Loads a State object into the world. */
    loadState(state) {
        this.setProjection(null);
        {
            this.projectionsPanel.disablePolymerChangesTriggerReprojection();
            if (this.dataSetBeforeFilter != null) {
                this.resetFilterDataset();
            }
            if (state.filteredPoints != null) {
                this.filterDataset(state.filteredPoints);
            }
            this.projectionsPanel.enablePolymerChangesTriggerReprojection();
        }
        for (let i = 0; i < state.projections.length; i++) {
            const point = this.dataSet.points[i];
            const projection = state.projections[i];
            const keys = Object.keys(projection);
            for (let j = 0; j < keys.length; ++j) {
                point.projections[keys[j]] = projection[keys[j]];
            }
        }
        this.dataSet.hasTSNERun = state.selectedProjection === 'tsne';
        this.dataSet.tSNEIteration = state.tSNEIteration;
        this.projectionsPanel.restoreUIFromBookmark(state);
        this.inspectorPanel.restoreUIFromBookmark(state);
        this.dataPanel.selectedColorOptionName = state.selectedColorOptionName;
        this.dataPanel.setForceCategoricalColoring(!!state.forceCategoricalColoring);
        this.selectedLabelOption = state.selectedLabelOption;
        this.projectorScatterPlotAdapter.restoreUIFromBookmark(state);
        {
            const dimensions = stateGetAccessorDimensions(state);
            const components = getProjectionComponents(state.selectedProjection, dimensions);
            const projection = new Projection(state.selectedProjection, components, dimensions.length, this.dataSet);
            this.setProjection(projection);
        }
        this.notifySelectionChanged(state.selectedPoints);
    }
    retrainBySelections(iteration, newSel) {
        this.projectionsPanel.retrainBySelections(iteration, newSel);
    }
    /**
     * query for indices in inspector panel
     */
    query(query, inRegexMode, fieldName, currPredicates, iteration, confidenceThresholdFrom, confidenceThresholdTo, callback) {
        let confidenceThreshold = [];
        var dummyCurrPredicates = {};
        Object.keys(currPredicates).forEach((key) => {
            dummyCurrPredicates[key] = currPredicates[key];
        });
        dummyCurrPredicates[fieldName] = query;
        if (confidenceThresholdFrom || confidenceThresholdTo) {
            dummyCurrPredicates['confidence'] = [Number(confidenceThresholdFrom), Number(confidenceThresholdTo)];
        }
        console.log("'aaaaaa");
        const msgId = logging.setModalMessage('Querying...');
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('Accept', 'application/json');
        fetch(`http://${this.DVIServer}/query`, {
            method: 'POST',
            body: JSON.stringify({
                "predicates": dummyCurrPredicates, "content_path": window.sessionStorage.content_path || this.dataSet.DVIsubjectModelPath,
                "iteration": iteration, "username": window.sessionStorage.username,
                "vis_method": window.sessionStorage.vis_method, 'setting': window.sessionStorage.selectedSetting
            }),
            headers: headers,
            mode: 'cors'
        }).then(response => response.json()).then(data => {
            const indices = data.selectedPoints;
            window.alSuggestLabelList = [];
            logging.setModalMessage(null, msgId);
            callback(indices);
        }).catch(error => {
            logging.setErrorMessage('querying for indices');
            callback(null);
        });
    }
    getAllResPosList(callback) {
        if (window.allResPositions && window.allResPositions.results && window.allResPositions.bgimgList) {
            callback(window.allResPositions);
            return;
        }
        const msgId = logging.setModalMessage('Querying...');
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('Accept', 'application/json');
        fetch(`http://${this.DVIServer}/all_result_list`, {
            method: 'POST',
            body: JSON.stringify({
                "iteration_start": 1,
                "iteration_end": 2,
                "content_path": this.dataSet.DVIsubjectModelPath,
                "username": window.sessionStorage.username
            }),
            headers: headers,
            mode: 'cors'
        }).then(response => response.json()).then(data => {
            const indices = data.selectedPoints;
            logging.setModalMessage(null, msgId);
            callback(data);
        }).catch(error => {
            logging.setErrorMessage('querying for indices');
        });
    }
    /**
     * query for predicates
     */
    simpleQuery(predicates, iteration) {
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('Accept', 'application/json');
        fetch(`http://${this.DVIServer}/query`, {
            method: 'POST',
            body: JSON.stringify({
                "predicates": predicates, "content_path": window.sessionStorage.content_path || this.dataSet.DVIsubjectModelPath,
                "iteration": iteration, "username": window.sessionStorage.username, "vis_method": window.sessionStorage.vis_method, 'setting': window.sessionStorage.selectedSetting
            }),
            headers: headers,
            mode: 'cors'
        }).then(response => response.json()).then(data => {
            const indices = data.selectedPoints;
            this.inspectorPanel.filteredPoints = indices;
            window.alSuggestLabelList = [];
        }).catch(error => {
            logging.setErrorMessage('querying for indices');
        });
    }
    // active learning
    queryByAL(iteration, strategy, budget, acceptIndicates, rejectIndicates, isRecommend, callback) {
        const msgId = logging.setModalMessage('Querying...');
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('Accept', 'application/json');
        let accIndicates = [];
        if (window.acceptIndicates) {
            accIndicates = window.acceptIndicates.filter((item, i, arr) => {
                //函数自身返回的是一个布尔值，只当返回值为true时，当前元素才会存入新的数组中。            
                return window.properties[window.iteration][item] === 1;
            });
        }
        let rejIndicates = [];
        if (window.rejectIndicates) {
            rejIndicates = window.rejectIndicates.filter((item, i, arr) => {
                //函数自身返回的是一个布尔值，只当返回值为true时，当前元素才会存入新的数组中。            
                return window.properties[window.iteration][item] === 1;
            });
        }
        fetch(`http://${this.DVIServer}/al_query`, {
            method: 'POST',
            body: JSON.stringify({
                "iteration": iteration,
                "strategy": strategy,
                "budget": budget,
                "content_path": window.sessionStorage.content_path || this.dataSet.DVIsubjectModelPath,
                "accIndices": accIndicates,
                "rejIndices": rejIndicates,
                "isRecommend": isRecommend,
                "username": window.sessionStorage.username,
                "vis_method": window.sessionStorage.vis_method,
                'setting': window.sessionStorage.selectedSetting
            }),
            headers: headers,
            mode: 'cors'
        }).then(response => response.json()).then(data => {
            const indices = data.selectedPoints;
            const labels = data.suggestLabels;
            const scores = data.scores;
            logging.setModalMessage(null, msgId);
            // if (currentIndices && currentIndices.length) {
            //   for (let i = 0; i < currentIndices.length; i++) {
            //     if (window.previousIndecates.indexOf(currentIndices[i]) === -1) {
            //       window.previousIndecates.push(currentIndices[i])
            //     }
            //   }
            //   function func(a, b) {
            //     return a - b;
            //   }
            //   window.previousIndecates.sort(func)
            // } else {
            //   for (let i = 0; i < window.customSelection.length; i++) {
            //     if (window.previousIndecates.indexOf(window.customSelection[i]) === -1) {
            //       window.previousIndecates.push(window.customSelection[i])
            //     }
            //   }
            //   function func(a, b) {
            //     return a - b;
            //   }
            //   window.previousIndecates.sort(func)
            // }
            callback(indices, scores, labels);
        }).catch(error => {
            logging.setErrorMessage('querying for indices');
            callback(null, [], []);
        });
    }
    // anormaly detection
    queryAnormalyStrategy(budget, cls, currentIndices, comfirm_info, accIndicates, rejIndicates, strategy, isRecommend, callback) {
        const msgId = logging.setModalMessage('Querying...');
        let headers = new Headers();
        if (!accIndicates) {
            accIndicates = [];
        }
        if (!rejIndicates) {
            rejIndicates = [];
        }
        let accIn = [];
        // if(window.acceptIndicates){
        //   accIndicates = window.acceptIndicates.filter((item, i, arr) => {
        //     //函数自身返回的是一个布尔值，只当返回值为true时，当前元素才会存入新的数组中。            
        //     return window.properties[window.iteration][item] === 1
        //   })
        // }
        // let rejIn = []
        // if(window.rejectIndicates){
        //   rejIndicates = window.rejectIndicates.filter((item, i, arr) => {
        //     //函数自身返回的是一个布尔值，只当返回值为true时，当前元素才会存入新的数组中。            
        //     return window.properties[window.iteration][item] === 1
        //   })
        // }
        headers.append('Content-Type', 'application/json');
        headers.append('Accept', 'application/json');
        fetch(`http://${this.DVIServer}/anomaly_query`, {
            method: 'POST',
            body: JSON.stringify({
                "budget": budget,
                "cls": cls,
                "indices": currentIndices,
                "content_path": window.sessionStorage.content_path || this.dataSet.DVIsubjectModelPath,
                "comfirm_info": comfirm_info,
                "accIndices": accIndicates,
                "rejIndices": rejIndicates,
                "strategy": strategy,
                "username": window.sessionStorage.username,
                "isRecommend": isRecommend,
                "vis_method": window.sessionStorage.vis_method,
                'setting': window.sessionStorage.selectedSetting
            }),
            headers: headers,
            mode: 'cors'
        }).then(response => response.json()).then(data => {
            const indices = data.selectedPoints;
            const labels = data.suggestLabels;
            const scores = data.scores;
            const cleanIndices = data.cleanList;
            window.alSuggestScoreList = data.scores;
            window.alSuggestLabelList = data.suggestLabels;
            logging.setModalMessage(null, msgId);
            callback(indices, cleanIndices);
        }).catch(error => {
            logging.setErrorMessage('querying for indices');
            callback(null);
        });
    }
    querySuggestion(iteration, indices, k, callback) {
        const msgId = logging.setModalMessage('Querying...');
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('Accept', 'application/json');
        fetch(`http://${this.DVIServer}/al_suggest_similar`, {
            method: 'POST',
            body: JSON.stringify({
                "iteration": iteration,
                "selectIndices": indices,
                "k": k,
                "content_path": window.sessionStorage.content_path || this.dataSet.DVIsubjectModelPath,
                "vis_method": window.sessionStorage.vis_method,
                'setting': window.sessionStorage.selectedSetting
            }),
            headers: headers,
            mode: 'cors'
        }).then(response => response.json()).then(data => {
            const indices = data.similarIndices;
            logging.setModalMessage(null, msgId);
            callback(indices);
        }).catch(error => {
            // logging.setErrorMessage('querying for indices');
            callback(null);
        });
    }
    saveDVISelection(indices, callback) {
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('Accept', 'application/json');
        fetch(`http://${this.DVIServer}/saveDVIselections`, {
            method: 'POST',
            body: JSON.stringify({
                "newIndices": indices,
                "content_path": window.sessionStorage.content_path || this.dataSet.DVIsubjectModelPath,
                "iteration": this.iteration,
                "vis_method": window.sessionStorage.vis_method,
                'setting': window.sessionStorage.selectedSetting
            }),
            headers: headers,
            mode: 'cors'
        }).then(response => response.json()).then(data => {
            const msg = data.message;
            callback(msg);
        }).catch(error => {
            logging.setErrorMessage('saving indices');
        });
    }
};
Projector.template = template;
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], Projector.prototype, "routePrefix", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], Projector.prototype, "dataProto", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], Projector.prototype, "servingMode", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], Projector.prototype, "projectorConfigJsonPath", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], Projector.prototype, "pageViewLogging", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], Projector.prototype, "eventLogging", void 0);
__decorate([
    property({ type: Object }),
    __metadata("design:type", Object)
], Projector.prototype, "metadataStyle", void 0);
__decorate([
    property({ type: String }),
    __metadata("design:type", String)
], Projector.prototype, "DVIServer", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], Projector.prototype, "showlabeled", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], Projector.prototype, "showUnlabeled", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], Projector.prototype, "showTesting", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], Projector.prototype, "_showNotAvaliable", void 0);
__decorate([
    property({ type: Boolean }),
    __metadata("design:type", Boolean)
], Projector.prototype, "showUnlabeledCheckbox", void 0);
__decorate([
    observe('showlabeled'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Projector.prototype, "_labeledChanged", null);
__decorate([
    observe('showUnlabeled'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Projector.prototype, "_unLabelChanged", null);
__decorate([
    observe('showTesting'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Projector.prototype, "_testingChanged", null);
__decorate([
    observe('dataProto'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], Projector.prototype, "_dataProtoChanged", null);
Projector = __decorate([
    customElement('vz-projector')
], Projector);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVuc29yYm9hcmQvcHJvamVjdG9yL3Z6LXByb2plY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBbUVBLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUNsRCxPQUFPLEVBQUUsYUFBYSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUd2RSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNoRixPQUFPLHdDQUF3QyxDQUFDO0FBRWhELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDL0MsT0FBTyxFQU9MLHVCQUF1QixFQUV2QixVQUFVLEVBRVYsS0FBSyxFQUNMLDBCQUEwQixHQUMzQixNQUFNLFFBQVEsQ0FBQztBQUNoQixPQUFPLDhCQUE4QixDQUFDO0FBQ3RDLE9BQU8sRUFHTCxlQUFlLEdBRWhCLE1BQU0saUJBQWlCLENBQUM7QUFDekIsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDeEQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDMUQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDNUQsT0FBTyxrQ0FBa0MsQ0FBQztBQUMxQyxPQUFPLCtCQUErQixDQUFDO0FBQ3ZDLE9BQU8sMkJBQTJCLENBQUM7QUFDbkMsT0FBTyxnQ0FBZ0MsQ0FBQztBQUN4QyxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQVM1RSxPQUFPLEtBQUssT0FBTyxNQUFNLFdBQVcsQ0FBQztBQUNyQyxPQUFPLEtBQUssSUFBSSxNQUFNLFFBQVEsQ0FBQztBQUMvQixP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SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUM7O2dEQUNFO0FBRzlCO0lBREMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDOzs4Q0FDQztBQUU3QjtJQURDLFFBQVEsQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQzs7b0RBQ007QUFHbEM7SUFEQyxRQUFRLENBQUMsRUFBQyxJQUFJLEVBQUUsT0FBTyxFQUFDLENBQUM7O3dEQUNXO0FBNGJyQztJQURDLE9BQU8sQ0FBQyxhQUFhLENBQUM7Ozs7Z0RBd0J0QjtBQUdEO0lBREMsT0FBTyxDQUFDLGVBQWUsQ0FBQzs7OztnREF1QnhCO0FBR0Q7SUFEQyxPQUFPLENBQUMsYUFBYSxDQUFDOzs7O2dEQXdCdEI7QUEra0JEO0lBREMsT0FBTyxDQUFDLFdBQVcsQ0FBQzs7OztrREFNcEI7QUF2b0NHLFNBQVM7SUFEZCxhQUFhLENBQUMsY0FBYyxDQUFDO0dBQ3hCLFNBQVMsQ0Fpd0RkIiwic291cmNlc0NvbnRlbnQiOlsiLyogQ29weXJpZ2h0IDIwMTYgVGhlIFRlbnNvckZsb3cgQXV0aG9ycy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG49PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuZGVjbGFyZSBnbG9iYWwge1xuICBpbnRlcmZhY2UgV2luZG93IHtcbiAgICBoaWRkZW5CYWNrZ3JvdW5kOiBib29sZWFuIHwgZmFsc2UsXG4gICAgRFZJRGF0YUxpc3Q6IGFueSxcbiAgICBsaW5lR2VvbWVydHJ5TGlzdDogYW55LFxuICAgIGl0ZXJhdGlvbjogbnVtYmVyLFxuICAgIHByb3BlcnRpZXM6IGFueSxcbiAgICBpc0ZpbHRlcjogYm9vbGVhbiB8IGZhbHNlLFxuICAgIGN1c3RvbVNlbGVjdGlvbjogYW55LFxuICAgIGNoZWNrYm94RG9tOiBhbnksXG4gICAgaXNBZGp1c3RpbmdTZWw6IGJvb2xlYW4gfCBmYWxzZSxcbiAgICBzY2VuZTogYW55LFxuICAgIHJlbmRlcmVyOiBhbnksXG4gICAgc3VnZ2VzdGlvbkluZGljYXRlczogYW55LFxuXG4gICAgdW5MYWJlbERhdGE6IGFueSxcbiAgICB0ZXN0aW5nRGF0YTogYW55LFxuICAgIGxhYmVsZWREYXRhOiBhbnksXG5cbiAgICBub3dTaG93SW5kaWNhdGVzOiBhbnksXG4gICAgc2NlbmVCYWNrZ3JvdW5kSW1nOiBhbnksXG4gICAgY3VzdG9tTWV0YWRhdGE6IGFueSxcblxuICAgIHF1ZXJ5UmVzUG9pbnRJbmRpY2VzOiBhbnksXG4gICAgYWxRdWVyeVJlc1BvaW50SW5kaWNlczogYW55LFxuICAgIHByZXZpb3VzSW5kZWNhdGVzOiBhbnksXG4gICAgcHJldmlvdXNBbm9ybWFsSW5kZWNhdGVzOiBhbnksXG4gICAgcXVlcnlSZXNBbm9ybWFsSW5kZWNhdGVzOiBhbnksXG4gICAgcXVlcnlSZXNBbm9ybWFsQ2xlYW5JbmRlY2F0ZXM6IGFueSxcbiAgICBhbFN1Z2dlc3Rpb25JbmRpY2F0ZXM6IGFueSxcbiAgICBhbFN1Z2dlc3RMYWJlbExpc3Q6IGFueSxcbiAgICBhbFN1Z2dlc3RTY29yZUxpc3Q6IGFueSxcbiAgICBwcmV2aW91c0hvdmVyOiBudW1iZXIsXG5cbiAgICBhbGxSZXNQb3NpdGlvbnM6IGFueSxcbiAgICBtb2RlbE1hdGg6IHN0cmluZyxcbiAgICB0U05FVG90YWxJdGVyOiBudW1iZXIsXG4gICAgdGFza1R5cGU6IHN0cmluZyxcbiAgICBzZWxlY3RlZFN0YWNrOiBhbnksXG4gICAgaXBBZGRyZXNzOiBzdHJpbmcsXG4gICAgZDM6IGFueSxcbiAgICB0cmVlanNvbjogYW55LFxuXG4gICAgcmVqZWN0SW5kaWNhdGVzOiBhbnksXG4gICAgYWNjZXB0SW5kaWNhdGVzOiBhbnksXG5cbiAgICBhY2NlcHRJbnB1dExpc3Q6IGFueSxcbiAgICByZWplY3RJbnB1dExpc3Q6IGFueSxcbiAgICBmbGFnaW5kZWNhdGVzTGlzdDogYW55LFxuICAgIHNlbGVjdGVkVG90YWxFcG9jaDogbnVtYmVyXG4gIH1cbn1cblxuaW1wb3J0IHsgUG9seW1lckVsZW1lbnQgfSBmcm9tICdAcG9seW1lci9wb2x5bWVyJztcbmltcG9ydCB7IGN1c3RvbUVsZW1lbnQsIG9ic2VydmUsIHByb3BlcnR5IH0gZnJvbSAnQHBvbHltZXIvZGVjb3JhdG9ycyc7XG5pbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5cbmltcG9ydCB7IExlZ2FjeUVsZW1lbnRNaXhpbiB9IGZyb20gJy4uL2NvbXBvbmVudHMvcG9seW1lci9sZWdhY3lfZWxlbWVudF9taXhpbic7XG5pbXBvcnQgJy4uL2NvbXBvbmVudHMvcG9seW1lci9pcm9uc19hbmRfcGFwZXJzJztcblxuaW1wb3J0IHsgQW5hbHl0aWNzTG9nZ2VyIH0gZnJvbSAnLi9hbmFseXRpY3NMb2dnZXInO1xuaW1wb3J0IHsgdGVtcGxhdGUgfSBmcm9tICcuL3Z6LXByb2plY3Rvci5odG1sJztcbmltcG9ydCB7XG4gIENvbG9yT3B0aW9uLFxuICBDb2x1bW5TdGF0cyxcbiAgRGlzdGFuY2VGdW5jdGlvbixcbiAgRGF0YVBvaW50LFxuICBEYXRhUHJvdG8sXG4gIERhdGFTZXQsXG4gIGdldFByb2plY3Rpb25Db21wb25lbnRzLFxuICBQb2ludE1ldGFkYXRhLFxuICBQcm9qZWN0aW9uLFxuICBTcHJpdGVBbmRNZXRhZGF0YUluZm8sXG4gIFN0YXRlLFxuICBzdGF0ZUdldEFjY2Vzc29yRGltZW5zaW9ucywgU2VxdWVuY2UsXG59IGZyb20gJy4vZGF0YSc7XG5pbXBvcnQgJy4vdnotcHJvamVjdG9yLW1ldGFkYXRhLWNhcmQnO1xuaW1wb3J0IHtcbiAgU2VydmluZ01vZGUsXG4gIERhdGFQcm92aWRlcixcbiAgYW5hbHl6ZU1ldGFkYXRhLFxuICBFbWJlZGRpbmdJbmZvLCBQcm9qZWN0b3JDb25maWcsXG59IGZyb20gJy4vZGF0YS1wcm92aWRlcic7XG5pbXBvcnQgeyBEZW1vRGF0YVByb3ZpZGVyIH0gZnJvbSAnLi9kYXRhLXByb3ZpZGVyLWRlbW8nO1xuaW1wb3J0IHsgUHJvdG9EYXRhUHJvdmlkZXIgfSBmcm9tICcuL2RhdGEtcHJvdmlkZXItcHJvdG8nO1xuaW1wb3J0IHsgU2VydmVyRGF0YVByb3ZpZGVyIH0gZnJvbSAnLi9kYXRhLXByb3ZpZGVyLXNlcnZlcic7XG5pbXBvcnQgJy4vdnotcHJvamVjdG9yLXByb2plY3Rpb25zLXBhbmVsJztcbmltcG9ydCAnLi92ei1wcm9qZWN0b3ItYm9va21hcmstcGFuZWwnO1xuaW1wb3J0ICcuL3Z6LXByb2plY3Rvci1kYXRhLXBhbmVsJztcbmltcG9ydCAnLi92ei1wcm9qZWN0b3ItaW5zcGVjdG9yLXBhbmVsJztcbmltcG9ydCB7IFByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlciB9IGZyb20gJy4vcHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyJztcbmltcG9ydCB7XG4gIERpc3RhbmNlTWV0cmljQ2hhbmdlZExpc3RlbmVyLFxuICBIb3Zlckxpc3RlbmVyLFxuICBQcm9qZWN0aW9uQ2hhbmdlZExpc3RlbmVyLFxuICBQcm9qZWN0b3JFdmVudENvbnRleHQsXG4gIFNlbGVjdGlvbkNoYW5nZWRMaXN0ZW5lcixcbn0gZnJvbSAnLi9wcm9qZWN0b3JFdmVudENvbnRleHQnO1xuaW1wb3J0ICogYXMga25uIGZyb20gJy4va25uJztcbmltcG9ydCAqIGFzIGxvZ2dpbmcgZnJvbSAnLi9sb2dnaW5nJztcbmltcG9ydCAqIGFzIHV0aWwgZnJvbSAnLi91dGlsJztcbmltcG9ydCB7IE1vdXNlTW9kZSB9IGZyb20gJy4vc2NhdHRlclBsb3QnO1xuXG4vKipcbiAqIFRoZSBtaW5pbXVtIG51bWJlciBvZiBkaW1lbnNpb25zIHRoZSBkYXRhIHNob3VsZCBoYXZlIHRvIGF1dG9tYXRpY2FsbHlcbiAqIGRlY2lkZSB0byBub3JtYWxpemUgdGhlIGRhdGEuXG4gKi9cbmNvbnN0IFRIUkVTSE9MRF9ESU1fTk9STUFMSVpFID0gNTA7XG5jb25zdCBQT0lOVF9DT0xPUl9NSVNTSU5HID0gJ2JsYWNrJztcbmNvbnN0IElOREVYX01FVEFEQVRBX0ZJRUxEID0gJ19faW5kZXhfXyc7XG5cbi8qKlxuICogU2F2ZSB0aGUgaW5pdGlhbCBVUkwgcXVlcnkgcGFyYW1zLCBiZWZvcmUgdGhlIEFwcFJvdXRpbmdFZmZlY3RzIGluaXRpYWxpemUuXG4gKi9cbmNvbnN0IGluaXRpYWxVUkxRdWVyeVN0cmluZyA9IHdpbmRvdy5sb2NhdGlvbi5zZWFyY2g7XG5cbkBjdXN0b21FbGVtZW50KCd2ei1wcm9qZWN0b3InKVxuY2xhc3MgUHJvamVjdG9yXG4gIGV4dGVuZHMgTGVnYWN5RWxlbWVudE1peGluKFBvbHltZXJFbGVtZW50KVxuICBpbXBsZW1lbnRzIFByb2plY3RvckV2ZW50Q29udGV4dCB7XG4gIHN0YXRpYyByZWFkb25seSB0ZW1wbGF0ZSA9IHRlbXBsYXRlO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IFN0cmluZyB9KVxuICByb3V0ZVByZWZpeDogc3RyaW5nO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IFN0cmluZyB9KVxuICBkYXRhUHJvdG86IHN0cmluZztcblxuICBAcHJvcGVydHkoeyB0eXBlOiBTdHJpbmcgfSlcbiAgc2VydmluZ01vZGU6IFNlcnZpbmdNb2RlO1xuXG4gIC8vIFRoZSBwYXRoIHRvIHRoZSBwcm9qZWN0b3IgY29uZmlnIEpTT04gZmlsZSBmb3IgZGVtbyBtb2RlLlxuICBAcHJvcGVydHkoeyB0eXBlOiBTdHJpbmcgfSlcbiAgcHJvamVjdG9yQ29uZmlnSnNvblBhdGg6IHN0cmluZztcblxuICBAcHJvcGVydHkoeyB0eXBlOiBCb29sZWFuIH0pXG4gIHBhZ2VWaWV3TG9nZ2luZzogYm9vbGVhbjtcblxuICBAcHJvcGVydHkoeyB0eXBlOiBCb29sZWFuIH0pXG4gIGV2ZW50TG9nZ2luZzogYm9vbGVhbjtcblxuICBAcHJvcGVydHkoeyB0eXBlOiBPYmplY3QgfSlcbiAgbWV0YWRhdGFTdHlsZTogYW55XG5cbiAgLyoqXG4gICAqIERWSSBwcm9wZXJ0aWVzXG4gICAqL1xuICBAcHJvcGVydHkoeyB0eXBlOiBTdHJpbmcgfSlcbiAgRFZJU2VydmVyOiBzdHJpbmdcblxuICBAcHJvcGVydHkoeyB0eXBlOiBCb29sZWFuIH0pXG4gIHNob3dsYWJlbGVkOiBib29sZWFuID0gdHJ1ZTtcblxuICBAcHJvcGVydHkoeyB0eXBlOiBCb29sZWFuIH0pXG4gIHNob3dVbmxhYmVsZWQ6IGJvb2xlYW4gPSB0cnVlO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IEJvb2xlYW4gfSlcbiAgc2hvd1Rlc3Rpbmc6IGJvb2xlYW4gPSBmYWxzZTtcbiAgQHByb3BlcnR5KHsgdHlwZTogQm9vbGVhbiB9KVxuICBfc2hvd05vdEF2YWxpYWJsZTogYm9vbGVhbiA9IGZhbHNlXG5cbiAgQHByb3BlcnR5KHt0eXBlOiBCb29sZWFufSlcbiAgc2hvd1VubGFiZWxlZENoZWNrYm94OiBib29sZWFuID0gdHJ1ZVxuXG4gIC8vIFRoZSB3b3JraW5nIHN1YnNldCBvZiB0aGUgZGF0YSBzb3VyY2UncyBvcmlnaW5hbCBkYXRhIHNldC5cbiAgZGF0YVNldDogRGF0YVNldDtcbiAgaXRlcmF0aW9uOiBudW1iZXI7XG4gIHByaXZhdGUgc2VsZWN0aW9uQ2hhbmdlZExpc3RlbmVyczogU2VsZWN0aW9uQ2hhbmdlZExpc3RlbmVyW107XG4gIHByaXZhdGUgaG92ZXJMaXN0ZW5lcnM6IEhvdmVyTGlzdGVuZXJbXTtcbiAgcHJpdmF0ZSBwcm9qZWN0aW9uQ2hhbmdlZExpc3RlbmVyczogUHJvamVjdGlvbkNoYW5nZWRMaXN0ZW5lcltdO1xuICBwcml2YXRlIGRpc3RhbmNlTWV0cmljQ2hhbmdlZExpc3RlbmVyczogRGlzdGFuY2VNZXRyaWNDaGFuZ2VkTGlzdGVuZXJbXTtcbiAgcHJpdmF0ZSBvcmlnaW5hbERhdGFTZXQ6IERhdGFTZXQ7XG4gIHByaXZhdGUgZGF0YVNldEJlZm9yZUZpbHRlcjogRGF0YVNldDtcbiAgcHJpdmF0ZSBwcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXI6IFByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlcjtcbiAgcHJpdmF0ZSBkaW06IG51bWJlcjtcbiAgcHJpdmF0ZSBkYXRhU2V0RmlsdGVySW5kaWNlczogbnVtYmVyW107XG4gIHByaXZhdGUgc2VsZWN0ZWRQb2ludEluZGljZXM6IG51bWJlcltdO1xuICBwcml2YXRlIG5laWdoYm9yc09mRmlyc3RQb2ludDoga25uLk5lYXJlc3RFbnRyeVtdO1xuICBwcml2YXRlIGhvdmVyUG9pbnRJbmRleDogbnVtYmVyO1xuICBwcml2YXRlIGVkaXRNb2RlOiBib29sZWFuO1xuICBwcml2YXRlIGRhdGFQcm92aWRlcjogRGF0YVByb3ZpZGVyO1xuICBwcml2YXRlIHNlbGVjdGVkQ29sb3JPcHRpb246IENvbG9yT3B0aW9uO1xuICBwcml2YXRlIHNlbGVjdGVkTGFiZWxPcHRpb246IHN0cmluZztcbiAgcHJpdmF0ZSBub3JtYWxpemVEYXRhOiBib29sZWFuO1xuICBwcml2YXRlIHByb2plY3Rpb246IFByb2plY3Rpb247XG4gIHByaXZhdGUgbWV0YWRhdGFGaWxlOiBzdHJpbmc7XG4gIC8qKiBQb2x5bWVyIGNvbXBvbmVudCBwYW5lbHMgKi9cbiAgcHJpdmF0ZSBpbnNwZWN0b3JQYW5lbDogYW55O1xuICBwcml2YXRlIGRhdGFQYW5lbDogYW55O1xuICBwcml2YXRlIGJvb2ttYXJrUGFuZWw6IGFueTtcbiAgcHJpdmF0ZSBwcm9qZWN0aW9uc1BhbmVsOiBhbnk7XG4gIHByaXZhdGUgbWV0YWRhdGFDYXJkOiBhbnk7XG4gIHByaXZhdGUgc3RhdHVzQmFyOiBIVE1MRGl2RWxlbWVudDtcbiAgcHJpdmF0ZSBhbmFseXRpY3NMb2dnZXI6IEFuYWx5dGljc0xvZ2dlcjtcbiAgcHJpdmF0ZSBiYWNrZ3JvdW5kUG9pbnRzOiBhbnk7XG4gIHByaXZhdGUgY3VycmVudEl0ZXJhdGlvbjogbnVtYmVyXG5cbiAgcHJpdmF0ZSBnb0Rvd25CdG46IGFueTtcbiAgcHJpdmF0ZSBnb1VwQnRuOiBhbnk7XG4gIHByaXZhdGUgZ29MZWZ0QnRuOiBhbnk7XG4gIHByaXZhdGUgZ29SaWdodEJ0bjogYW55O1xuXG4gIHByaXZhdGUgaGVscEJ0bjogYW55O1xuXG4gIHByaXZhdGUgdGltZXI6IGFueTtcblxuICBwcml2YXRlIGludGVydmFsRmxhZzogYm9vbGVhblxuXG4gIHByaXZhdGUgcmVnaXN0ZXJlZDogYm9vbGVhblxuXG5cblxuXG5cblxuICBhc3luYyByZWFkeSgpIHtcbiAgICBzdXBlci5yZWFkeSgpO1xuICAgIGxvZ2dpbmcuc2V0RG9tQ29udGFpbmVyKHRoaXMgYXMgSFRNTEVsZW1lbnQpO1xuICAgIHRoaXMuYW5hbHl0aWNzTG9nZ2VyID0gbmV3IEFuYWx5dGljc0xvZ2dlcihcbiAgICAgIHRoaXMucGFnZVZpZXdMb2dnaW5nLFxuICAgICAgdGhpcy5ldmVudExvZ2dpbmdcbiAgICApO1xuICAgIHRoaXMuYW5hbHl0aWNzTG9nZ2VyLmxvZ1BhZ2VWaWV3KCdlbWJlZGRpbmdzJyk7XG4gICAgY29uc3QgaGFzV2ViR0xTdXBwb3J0ID0gYXdhaXQgdXRpbC5oYXNXZWJHTFN1cHBvcnQoKTtcbiAgICBpZiAoIWhhc1dlYkdMU3VwcG9ydCkge1xuICAgICAgdGhpcy5hbmFseXRpY3NMb2dnZXIubG9nV2ViR0xEaXNhYmxlZCgpO1xuICAgICAgbG9nZ2luZy5zZXRFcnJvck1lc3NhZ2UoXG4gICAgICAgICdZb3VyIGJyb3dzZXIgb3IgZGV2aWNlIGRvZXMgbm90IGhhdmUgV2ViR0wgZW5hYmxlZC4gUGxlYXNlIGVuYWJsZSAnICtcbiAgICAgICAgJ2hhcmR3YXJlIGFjY2VsZXJhdGlvbiwgb3IgdXNlIGEgYnJvd3NlciB0aGF0IHN1cHBvcnRzIFdlYkdMLidcbiAgICAgICk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuc2VsZWN0aW9uQ2hhbmdlZExpc3RlbmVycyA9IFtdO1xuICAgIHRoaXMuaG92ZXJMaXN0ZW5lcnMgPSBbXTtcbiAgICB0aGlzLnByb2plY3Rpb25DaGFuZ2VkTGlzdGVuZXJzID0gW107XG4gICAgdGhpcy5kaXN0YW5jZU1ldHJpY0NoYW5nZWRMaXN0ZW5lcnMgPSBbXTtcbiAgICB0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzID0gW107XG4gICAgdGhpcy5uZWlnaGJvcnNPZkZpcnN0UG9pbnQgPSBbXTtcbiAgICB0aGlzLnRpbWVyID0gbnVsbFxuICAgIHRoaXMuZWRpdE1vZGUgPSBmYWxzZTtcbiAgICB0aGlzLmRhdGFQYW5lbCA9IHRoaXMuJFsnZGF0YS1wYW5lbCddIGFzIGFueTsgLy8gRGF0YVBhbmVsXG4gICAgdGhpcy5pbnNwZWN0b3JQYW5lbCA9IHRoaXMuJFsnaW5zcGVjdG9yLXBhbmVsJ10gYXMgYW55OyAvLyBJbnNwZWN0b3JQYW5lbFxuICAgIHRoaXMucHJvamVjdGlvbnNQYW5lbCA9IHRoaXMuJFsncHJvamVjdGlvbnMtcGFuZWwnXSBhcyBhbnk7IC8vIFByb2plY3Rpb25zUGFuZWxcbiAgICB0aGlzLmJvb2ttYXJrUGFuZWwgPSB0aGlzLiRbJ2Jvb2ttYXJrLXBhbmVsJ10gYXMgYW55OyAvLyBCb29rbWFya1BhbmVsXG4gICAgdGhpcy5tZXRhZGF0YUNhcmQgPSB0aGlzLiRbJ21ldGFkYXRhLWNhcmQnXSBhcyBhbnk7IC8vIE1ldGFkYXRhQ2FyZFxuICAgIHRoaXMuc3RhdHVzQmFyID0gdGhpcy4kJCgnI3N0YXR1cy1iYXInKSBhcyBIVE1MRGl2RWxlbWVudDtcbiAgICB0aGlzLmhlbHBCdG4gPSB0aGlzLiQkKCcjaGVscC0zZC1pY29uJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgdGhpcy5pbnNwZWN0b3JQYW5lbC5pbml0aWFsaXplKHRoaXMsIHRoaXMgYXMgUHJvamVjdG9yRXZlbnRDb250ZXh0KTtcbiAgICB0aGlzLnByb2plY3Rpb25zUGFuZWwuaW5pdGlhbGl6ZSh0aGlzKTtcbiAgICB0aGlzLmJvb2ttYXJrUGFuZWwuaW5pdGlhbGl6ZSh0aGlzLCB0aGlzIGFzIFByb2plY3RvckV2ZW50Q29udGV4dCk7XG4gICAgdGhpcy5zZXR1cFVJQ29udHJvbHMoKTtcbiAgICB0aGlzLmluaXRpYWxpemVEYXRhUHJvdmlkZXIoKTtcbiAgICB0aGlzLmQzbG9hZGVyKClcbiAgICB0aGlzLml0ZXJhdGlvbiA9IDA7XG4gICAgdGhpcy5jdXJyZW50SXRlcmF0aW9uID0gMFxuXG4gICAgdGhpcy5zaG93bGFiZWxlZCA9IHRydWVcbiAgICB0aGlzLnNob3dVbmxhYmVsZWQgPSB0cnVlXG4gICAgdGhpcy5zaG93VGVzdGluZyA9IGZhbHNlXG5cbiAgICB0aGlzLnJlZ2lzdGVyZWQgPSBmYWxzZVxuXG4gICAgdGhpcy5zaG93VW5sYWJlbGVkQ2hlY2tib3ggPSB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudGFza1R5cGUgPT09ICdhY3RpdmUgbGVhcm5pbmcnXG5cblxuICAgIHRoaXMuaW50ZXJ2YWxGbGFnID0gdHJ1ZVxuICAgIHRoaXMuX3Nob3dOb3RBdmFsaWFibGUgPSBmYWxzZVxuXG4gICAgdGhpcy5tZXRhZGF0YVN0eWxlID0ge1xuICAgICAgbGVmdDogJzMyMHB4JyxcbiAgICAgIHRvcDogJzEyMHB4J1xuICAgIH1cblxuICAgIGxldCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAvLyBhd2FpdCBmZXRjaChcInN0YW5kYWxvbmVfcHJvamVjdG9yX2NvbmZpZy5qc29uXCIsIHsgbWV0aG9kOiAnR0VUJyB9KVxuICAgIC8vICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKVxuICAgIC8vICAgLnRoZW4oZGF0YSA9PiB7IHRoaXMuRFZJU2VydmVyID0gZGF0YS5EVklTZXJ2ZXJJUCArIFwiOlwiICsgZGF0YS5EVklTZXJ2ZXJQb3J0OyB9KVxuICAgIHRoaXMuRFZJU2VydmVyID0gd2luZG93LnNlc3Npb25TdG9yYWdlLmlwQWRkcmVzc1xuICB9O1xuICBkM2xvYWRlcigpIHtcbiAgICBsZXQgdGhhdCA9IHRoaXNcbiAgICBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgLy8gbGV0IHVybCA9IFwiaHR0cDovLzE3Mi4yNi4xOTEuMTczOjgxL2QzLnY1Lm1pbi5qc1wiXG4gICAgICBsZXQgdXJsID0gXCJodHRwczovL2QzanMub3JnL2QzLnY1Lm1pbi5qc1wiXG4gICAgICBsZXQgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0JylcbiAgICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHVybClcblxuICAgICAgc2NyaXB0Lm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZSh0cnVlKVxuICAgICAgICB0aGF0LmluaXRpYWxUcmVlKClcbiAgICAgIH1cbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kKHNjcmlwdClcbiAgICB9KVxuICB9XG5cblxuICBhc3luYyBpbml0aWFsVHJlZShvbmx5PzpudW1iZXIsbmVlZFJlbW92ZT86Ym9vbGVhbikge1xuICAgIC8vIHRoaXMuZDNsb2FkZXIoKVxuXG4gICAgY29uc3QgZDMgPSB3aW5kb3cuZDM7XG5cbiAgICBsZXQgc3ZnRG9tOiBhbnkgPSB0aGlzLiQkKFwiI215c3ZnZ2dcIilcblxuICAgIFxuXG4gICAgd2hpbGUgKHN2Z0RvbT8uZmlyc3RDaGlsZCkge1xuICAgICAgc3ZnRG9tLnJlbW92ZUNoaWxkKHN2Z0RvbS5sYXN0Q2hpbGQpO1xuICAgIH1cbiAgICBpZihuZWVkUmVtb3ZlKXtcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCdpc09ubHk/Jyxvbmx5KVxuXG4gICAgXG5cbiAgICAvLyBkb2N1bWVudC5ib2R5LmFwcGVuZChzdmdEb20pXG5cbiAgICBsZXQgaGVhZGVycyA9IG5ldyBIZWFkZXJzKCk7XG4gICAgYXdhaXQgZmV0Y2goYGh0dHA6Ly8ke3dpbmRvdy5zZXNzaW9uU3RvcmFnZS5pcEFkZHJlc3N9L2dldF9pdGVydGFpb25fc3RydWN0dXJlP3BhdGg9JHt3aW5kb3cuc2Vzc2lvblN0b3JhZ2UuY29udGVudF9wYXRofSZtZXRob2Q9JHt3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudmlzX21ldGhvZH0mc2V0dGluZz0ke3dpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZWxlY3RlZFNldHRpbmd9YCwge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBoZWFkZXJzOiBoZWFkZXJzLFxuICAgICAgbW9kZTogJ2NvcnMnXG4gICAgfSlcbiAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSlcbiAgICAgIC50aGVuKHJlcyA9PiB7XG4gICAgICAgIGlmKG9ubHkpe1xuICAgICAgICAgIHJlcy5zdHJ1Y3R1cmUgPSBbe3ZhbHVlOm9ubHksbmFtZTpvbmx5LHBpZDpcIlwifV1cbiAgICAgICAgfVxuICAgICAgICBsZXQgdG90YWwgPSByZXMuc3RydWN0dXJlPy5sZW5ndGhcbiAgICAgICAgcmVzLnN0cnVjdHVyZS5sZW5ndGggPSB3aW5kb3cuc2VsZWN0ZWRUb3RhbEVwb2NoXG4gICAgICAgIHdpbmRvdy50cmVlanNvbiA9IHJlcy5zdHJ1Y3R1cmVcblxuICAgICAgICBsZXQgZGF0YSA9IHJlcy5zdHJ1Y3R1cmVcbiAgICAgICAgXG4gICAgICAgIGlmKG9ubHkpe1xuXG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiB0cmFuTGlzdFRvVHJlZURhdGEoYXJyKSB7XG4gICAgICAgICAgY29uc3QgbmV3QXJyID0gW11cbiAgICAgICAgICBjb25zdCBtYXAgPSB7fVxuICAgICAgICAgIC8vIHtcbiAgICAgICAgICAvLyAgICcwMSc6IHtpZDpcIjAxXCIsIHBpZDpcIlwiLCAgIFwibmFtZVwiOlwi6ICB546LXCIsY2hpbGRyZW46IFtdIH0sXG4gICAgICAgICAgLy8gICAnMDInOiB7aWQ6XCIwMlwiLCBwaWQ6XCIwMVwiLCBcIm5hbWVcIjpcIuWwj+W8oFwiLGNoaWxkcmVuOiBbXSB9LFxuICAgICAgICAgIC8vIH1cbiAgICAgICAgICBhcnIuZm9yRWFjaChpdGVtID0+IHtcbiAgICAgICAgICAgIGl0ZW0uY2hpbGRyZW4gPSBbXVxuICAgICAgICAgICAgY29uc3Qga2V5ID0gaXRlbS52YWx1ZVxuICAgICAgICAgICAgbWFwW2tleV0gPSBpdGVtXG4gICAgICAgICAgfSlcblxuICAgICAgICAgIC8vIDIuIOWvueS6jmFycuS4reeahOavj+S4gOmhuVxuICAgICAgICAgIGFyci5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gbWFwW2l0ZW0ucGlkXVxuICAgICAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgICAvLyAgICDlpoLmnpzlroPmnInniLbnuqfvvIzmiorlvZPliY3lr7nosaHmt7vliqDniLbnuqflhYPntKDnmoRjaGlsZHJlbuS4rVxuICAgICAgICAgICAgICBwYXJlbnQuY2hpbGRyZW4ucHVzaChpdGVtKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gICAg5aaC5p6c5a6D5rKh5pyJ54i257qn77yIcGlkOicn77yJLOebtOaOpea3u+WKoOWIsG5ld0FyclxuICAgICAgICAgICAgICBuZXdBcnIucHVzaChpdGVtKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG5cbiAgICAgICAgICByZXR1cm4gbmV3QXJyXG4gICAgICAgIH1cbiAgICAgICAgZGF0YSA9IHRyYW5MaXN0VG9UcmVlRGF0YShkYXRhKVswXVxuICAgICAgICB2YXIgbWFyZ2luID0gNTA7XG4gICAgICAgIHZhciBzdmcgPSBkMy5zZWxlY3Qoc3ZnRG9tKTtcbiAgICAgICAgdmFyIHdpZHRoID0gc3ZnLmF0dHIoXCJ3aWR0aFwiKTtcbiAgICAgICAgdmFyIGhlaWdodCA9IHN2Zy5hdHRyKFwiaGVpZ2h0XCIpO1xuXG4gICAgICAgIC8vY3JlYXRlIGdyb3VwXG4gICAgICAgIHZhciBnID0gc3ZnLmFwcGVuZChcImdcIilcbiAgICAgICAgICAuYXR0cihcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZShcIiArIG1hcmdpbiArIFwiLFwiICsgMjAgKyBcIilcIik7XG5cblxuICAgICAgICAvL2NyZWF0ZSBsYXllciBsYXlvdXRcbiAgICAgICAgdmFyIGhpZXJhcmNoeURhdGEgPSBkMy5oaWVyYXJjaHkoZGF0YSlcbiAgICAgICAgICAuc3VtKGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAgICAgICByZXR1cm4gZC52YWx1ZTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgLy8gICAgbm9kZXMgYXR0cmlidXRlczpcbiAgICAgICAgLy8gICAgICAgIG5vZGUuZGF0YSAtIGRhdGEuXG4gICAgICAgIC8vICAgICAgICBub2RlLmRlcHRoIC0gcm9vdCBpcyAwLlxuICAgICAgICAvLyAgICAgICAgbm9kZS5oZWlnaHQgLSAgbGVhZiBub2RlIGlzIDAuXG4gICAgICAgIC8vICAgICAgICBub2RlLnBhcmVudCAtIHBhcmVudCBpZCwgcm9vdCBpcyBudWxsLlxuICAgICAgICAvLyAgICAgICAgbm9kZS5jaGlsZHJlbi5cbiAgICAgICAgLy8gICAgICAgIG5vZGUudmFsdWUgLSB0b3RhbCB2YWx1ZSBjdXJyZW50IG5vZGUgYW5kIGRlc2NlbmRhbnRzO1xuXG4gICAgICAgIC8vY3JlYXRlIHRyZWVcbiAgICAgICAgbGV0IGxlbiA9IHRvdGFsXG4gICAgICAgIFxuICAgICAgICBsZXQgc3ZnV2lkdGggPSBsZW4gKiA0MFxuICAgICAgICBpZiAod2luZG93LnNlc3Npb25TdG9yYWdlLnRhc2tUeXBlID09PSAnYWN0aXZlIGxlYXJuaW5nJykge1xuICAgICAgICAgIHN2Z1dpZHRoID0gMTAwMFxuICAgICAgICB9XG4gICAgICAgIC8vIHN2Z1dpZHRoID0gMTAwMFxuICAgICAgICBjb25zb2xlLmxvZygnc3ZnV2lkJywgbGVuLCBzdmdXaWR0aClcbiAgICAgICAgc3ZnRG9tLnN0eWxlLndpZHRoID0gc3ZnV2lkdGggKyAyMDBcbiAgICAgICAgaWYod2luZG93LnNlc3Npb25TdG9yYWdlLnNlbGVjdGVkU2V0dGluZyAhPT0gJ2FjdGl2ZSBsZWFybmluZycgJiYgd2luZG93LnNlc3Npb25TdG9yYWdlLnNlbGVjdGVkU2V0dGluZyAhPT0gJ2RlbnNlIGFsJyl7XG4gICAgICAgICAgc3ZnRG9tLnN0eWxlLmhlaWdodCA9IDkwXG4gICAgICAgICAgLy8gc3ZnRG9tLnN0eWxlLndpZHRoID0gMjAwMFxuICAgICAgICB9XG5cblxuICAgICAgICB2YXIgdHJlZSA9IGQzLnRyZWUoKVxuICAgICAgICAgIC5zaXplKFsxMDAsIHN2Z1dpZHRoXSlcbiAgICAgICAgICAuc2VwYXJhdGlvbihmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICAgICAgcmV0dXJuIChhLnBhcmVudCA9PSBiLnBhcmVudCA/IDEgOiAyKSAvIGEuZGVwdGg7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgLy9pbml0XG4gICAgICAgIHZhciB0cmVlRGF0YSA9IHRyZWUoaGllcmFyY2h5RGF0YSlcblxuICAgICAgICAvL2xpbmUgbm9kZVxuICAgICAgICB2YXIgbm9kZXMgPSB0cmVlRGF0YS5kZXNjZW5kYW50cygpO1xuICAgICAgICB2YXIgbGlua3MgPSB0cmVlRGF0YS5saW5rcygpO1xuXG4gICAgICAgIC8vbGluZVxuICAgICAgICB2YXIgbGluayA9IGQzLmxpbmtIb3Jpem9udGFsKClcbiAgICAgICAgICAueChmdW5jdGlvbiAoZCkge1xuICAgICAgICAgICAgcmV0dXJuIGQueTtcbiAgICAgICAgICB9KSAvL2xpbmtIb3Jpem9udGFsXG4gICAgICAgICAgLnkoZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgICAgIHJldHVybiBkLng7XG4gICAgICAgICAgfSk7XG5cblxuICAgICAgICAvL3BhdGhcbiAgICAgICAgZy5hcHBlbmQoJ2cnKVxuICAgICAgICAgIC5zZWxlY3RBbGwoJ3BhdGgnKVxuICAgICAgICAgIC5kYXRhKGxpbmtzKVxuICAgICAgICAgIC5lbnRlcigpXG4gICAgICAgICAgLmFwcGVuZCgncGF0aCcpXG4gICAgICAgICAgLmF0dHIoJ2QnLCBmdW5jdGlvbiAoZCwgaSkge1xuICAgICAgICAgICAgdmFyIHN0YXJ0ID0ge1xuICAgICAgICAgICAgICB4OiBkLnNvdXJjZS54LFxuICAgICAgICAgICAgICB5OiBkLnNvdXJjZS55XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIGVuZCA9IHtcbiAgICAgICAgICAgICAgeDogZC50YXJnZXQueCxcbiAgICAgICAgICAgICAgeTogZC50YXJnZXQueVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBsaW5rKHtcbiAgICAgICAgICAgICAgc291cmNlOiBzdGFydCxcbiAgICAgICAgICAgICAgdGFyZ2V0OiBlbmRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLmF0dHIoJ3N0cm9rZScsICcjNDUyZDhhJylcbiAgICAgICAgICAuYXR0cignc3Ryb2tlLXdpZHRoJywgMSlcbiAgICAgICAgICAuYXR0cignZmlsbCcsICdub25lJyk7XG5cblxuICAgICAgICAvL+WIm+W7uuiKgueCueS4juaWh+Wtl+WIhue7hFxuICAgICAgICB2YXIgZ3MgPSBnLmFwcGVuZCgnZycpXG4gICAgICAgICAgLnNlbGVjdEFsbCgnLmcnKVxuICAgICAgICAgIC5kYXRhKG5vZGVzKVxuICAgICAgICAgIC5lbnRlcigpXG4gICAgICAgICAgLmFwcGVuZCgnZycpXG4gICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIkRcIixkKVxuICAgICAgICAgICAgcmV0dXJuICd0cmFuc2xhdGUoJyArIGQuZGF0YS5waWQgKiA0MCArICcsJyArIGQueCArICcpJztcbiAgICAgICAgICB9KTtcblxuICAgICAgICAvL+e7mOWItuaWh+Wtl+WSjOiKgueCuVxuICAgICAgICBpZih3aW5kb3cuaXRlcmF0aW9uID09IHVuZGVmaW5lZCl7XG4gICAgICAgICAgd2luZG93Lml0ZXJhdGlvbiA9IDFcbiAgICAgICAgfVxuICAgICAgICBncy5hcHBlbmQoJ2NpcmNsZScpXG4gICAgICAgICAgLmF0dHIoJ3InLCA4KVxuICAgICAgICAgIC5hdHRyKCdmaWxsJywgZnVuY3Rpb24gKGQsIGkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiMTExMVwiLGQuZGF0YS52YWx1ZSwgd2luZG93Lml0ZXJhdGlvbiwgZC5kYXRhLnZhbHVlID09IHdpbmRvdy5pdGVyYXRpb24gKVxuICAgICAgICAgICAgcmV0dXJuIGQuZGF0YS52YWx1ZSA9PSB3aW5kb3cuaXRlcmF0aW9uID8gJ29yYW5nZScgOiAnIzQ1MmQ4YSdcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5hdHRyKCdzdHJva2Utd2lkdGgnLCAxKVxuICAgICAgICAgIC5hdHRyKCdzdHJva2UnLCBmdW5jdGlvbiAoZCwgaSkge1xuICAgICAgICAgICAgcmV0dXJuIGQuZGF0YS52YWx1ZSA9PSB3aW5kb3cuaXRlcmF0aW9uID8gJ29yYW5nZScgOiAnIzQ1MmQ4YSdcbiAgICAgICAgICB9KVxuXG4gICAgICAgIGdzLmFwcGVuZCgndGV4dCcpXG4gICAgICAgICAgLmF0dHIoJ3gnLCBmdW5jdGlvbiAoZCwgaSkge1xuICAgICAgICAgICAgcmV0dXJuIGQuY2hpbGRyZW4gPyA1IDogMTA7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuYXR0cigneScsIGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAgICAgICByZXR1cm4gZC5jaGlsZHJlbiA/IC0yMCA6IC01O1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLmF0dHIoJ2R5JywgMTApXG4gICAgICAgICAgLnRleHQoZnVuY3Rpb24gKGQsIGkpIHtcbiAgICAgICAgICAgIGlmICh3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudGFza1R5cGUgPT09ICdhY3RpdmUgbGVhcm5pbmcnKSB7XG4gICAgICAgICAgICAgIHJldHVybiBgJHtkLmRhdGEudmFsdWV9fCR7ZC5kYXRhLm5hbWV9YDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiBgJHtkLmRhdGEudmFsdWV9YDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgIH0pXG4gICAgICB9KVxuICAgIGxldCB0aGF0ID0gdGhpc1xuICAgIFxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgbGV0IGxpc3QgPSBzdmdEb20ucXVlcnlTZWxlY3RvckFsbChcImNpcmNsZVwiKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGV0IGMgPSBsaXN0W2ldXG4gICAgICAgIGlmIChjKSB7XG4gICAgICAgICAgYy5zdHlsZS5jdXJzb3IgPSBcInBvaW50ZXJcIlxuICAgICAgICAgIGlmKCFvbmx5KXtcbiAgICAgICAgICAgIGMuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZTogYW55KSA9PiB7XG4gICAgICAgICAgICAgIGlmIChlLnRhcmdldC5uZXh0U2libGluZy5pbm5lckhUTUwgIT0gd2luZG93Lml0ZXJhdGlvbikge1xuICAgICAgICAgICAgICAgIGxldCB2YWx1ZSA9IGUudGFyZ2V0Lm5leHRTaWJsaW5nLmlubmVySFRNTC5zcGxpdChcInxcIilbMF1cbiAgICAgICAgICAgICAgICB0aGF0LnByb2plY3Rpb25zUGFuZWwuanVtcFRvKE51bWJlcih2YWx1ZSkpXG4gICAgICAgICAgICAgICAgd2luZG93LnNlc3Npb25TdG9yYWdlLnNldEl0ZW0oJ2FjY2VwdEluZGljYXRlcycsIFwiXCIpXG4gICAgICAgICAgICAgICAgd2luZG93LnNlc3Npb25TdG9yYWdlLnNldEl0ZW0oJ3JlamVjdEluZGljYXRlcycsIFwiXCIpXG4gICAgICAgICAgICAgICAgdGhpcy5pbml0aWFsVHJlZSgpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSwyMDAwKVxuICB9XG5cbiAgcmVhZHlyZWdpcygpIHtcbiAgICBsZXQgZWw6IGFueSA9IHRoaXMuJCQoJyNtZXRhZGF0YS1jYXJkJylcbiAgICBpZiAoIWVsKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgbGV0IHRoYXQgPSB0aGlzXG4gICAgdGhpcy5yZWdpc3RlcmVkID0gdHJ1ZVxuICAgIGVsLm9ubW91c2Vkb3duID0gZnVuY3Rpb24gKGU6IGFueSkge1xuICAgICAgZSA9IGUgfHwgd2luZG93LmV2ZW50O1xuICAgICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnbW92ZSdcblxuICAgICAgLy8g5Yid5aeL5L2N572uXG4gICAgICBsZXQgb2ZmbGVmdCA9IE51bWJlcih0aGF0Lm1ldGFkYXRhU3R5bGUubGVmdC5yZXBsYWNlKCdweCcsICcnKSkgfHwgMDtcbiAgICAgIGxldCBvZmZUb3AgPSBOdW1iZXIodGhhdC5tZXRhZGF0YVN0eWxlLnRvcC5yZXBsYWNlKCdweCcsICcnKSkgfHwgMDtcbiAgICAgIC8vIOm8oOagh+eCueWHu+S9jee9rlxuICAgICAgbGV0IHN0YXJ0WCA9IGUuY2xpZW50WDtcbiAgICAgIGxldCBzdGFydFkgPSBlLmNsaWVudFk7XG5cbiAgICAgIGVsLnNldENhcHR1cmUgJiYgZWwuc2V0Q2FwdHVyZSgpO1xuXG5cbiAgICAgIGNvbnN0IGhhbmRsZXIgPSBmdW5jdGlvbiAoZXZlbnQ6IGFueSkge1xuICAgICAgICBldmVudCA9IGV2ZW50IHx8IHdpbmRvdy5ldmVudDtcblxuICAgICAgICAvLyBtb3VzZSBzdG9wIHBvc2l0aW9uXG4gICAgICAgIGxldCBlbmRYID0gZXZlbnQuY2xpZW50WDtcbiAgICAgICAgbGV0IGVuZFkgPSBldmVudC5jbGllbnRZO1xuXG4gICAgICAgIC8vIGRpc3RhbmNlXG4gICAgICAgIGxldCBtb3ZlWCA9IGVuZFggLSBzdGFydFg7XG4gICAgICAgIGxldCBtb3ZlWSA9IGVuZFkgLSBzdGFydFk7XG5cbiAgICAgICAgLy8gZmluYWwgcG9zaXRpb25cbiAgICAgICAgbGV0IGxhc3RYID0gb2ZmbGVmdCArIG1vdmVYO1xuICAgICAgICBsZXQgbGFzdFkgPSBvZmZUb3AgKyBtb3ZlWTtcblxuICAgICAgICAvL2JvdW5kcnlcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGxhc3RYID5cbiAgICAgICAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGggLSBlbC5jbGllbnRXaWR0aCAtIDIwXG4gICAgICAgICkge1xuICAgICAgICAgIGxhc3RYID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoIC0gZWwuY2xpZW50V2lkdGggLSAyMDtcbiAgICAgICAgfSBlbHNlIGlmIChsYXN0WCA8IDIwKSB7XG4gICAgICAgICAgbGFzdFggPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgIGxhc3RZID5cbiAgICAgICAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGggLSBlbC5jbGllbnRXaWR0aCAtIDIwXG4gICAgICAgICkge1xuICAgICAgICAgIGxhc3RZID1cbiAgICAgICAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQgLSBlbC5jbGllbnRIZWlnaHQgLSAyMDtcbiAgICAgICAgfSBlbHNlIGlmIChsYXN0WSA8IDIwKSB7XG4gICAgICAgICAgbGFzdFkgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgZWwuc3R5bGUubGVmdCA9IGxhc3RYICsgXCJweFwiO1xuICAgICAgICBlbC5zdHlsZS50b3AgPSBsYXN0WSArIFwicHhcIjtcbiAgICAgICAgdGhhdC5tZXRhZGF0YVN0eWxlID0ge1xuICAgICAgICAgIGxlZnQ6IGxhc3RYICsgXCJweFwiLFxuICAgICAgICAgIHRvcDogbGFzdFkgKyBcInB4XCJcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIGhhbmRsZXIsIGZhbHNlKTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICdtb3VzZXVwJyxcbiAgICAgICAgKCkgPT4ge1xuICAgICAgICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJ2RlZmF1bHQnXG4gICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgaGFuZGxlcik7XG4gICAgICAgIH0sXG4gICAgICAgIGZhbHNlLFxuICAgICAgKTtcbiAgICAgIC8vXG4gICAgICBkb2N1bWVudC5vbm1vdXNldXAgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGRvY3VtZW50Lm9udG91Y2htb3ZlID0gbnVsbDtcbiAgICAgICAgLy9AdHMtaWdub3JlXG4gICAgICAgIGRvY3VtZW50LnJlbGVhc2VDYXB0dXJlICYmIGRvY3VtZW50LnJlbGVhc2VDYXB0dXJlKCk7XG4gICAgICB9O1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIEBvYnNlcnZlKCdzaG93bGFiZWxlZCcpXG4gIF9sYWJlbGVkQ2hhbmdlZCgpIHtcbiAgICBsZXQgaW5kaWNhdGVzID0gW11cbiAgICBpZiAod2luZG93Lm5vd1Nob3dJbmRpY2F0ZXMpIHtcbiAgICAgIGlmICh0aGlzLnNob3dsYWJlbGVkKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgd2luZG93LnByb3BlcnRpZXNbd2luZG93Lml0ZXJhdGlvbl0ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBsZXQgaW5kaWNhdGUgPSB3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXVtpXVxuICAgICAgICAgIGlmIChpbmRpY2F0ZSA9PT0gMCB8fCB3aW5kb3cubm93U2hvd0luZGljYXRlcy5pbmRleE9mKGkpICE9PSAtMSkge1xuICAgICAgICAgICAgaW5kaWNhdGVzLnB1c2goaSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgd2luZG93Lm5vd1Nob3dJbmRpY2F0ZXMgPSBpbmRpY2F0ZXNcbiAgICAgICAgLy8gdGhpcy5wcm9qZWN0b3IuZmlsdGVyRGF0YXNldCh3aW5kb3cubm93U2hvd0luZGljYXRlcylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vL+makOiXj2xhYmVsZWRcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmICh3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXVtpXSAhPT0gMCAmJiB3aW5kb3cubm93U2hvd0luZGljYXRlcy5pbmRleE9mKGkpICE9PSAtMSkge1xuICAgICAgICAgICAgaW5kaWNhdGVzLnB1c2goaSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgd2luZG93Lm5vd1Nob3dJbmRpY2F0ZXMgPSBpbmRpY2F0ZXNcbiAgICAgIH1cbiAgICAgIHRoaXMuZmlsdGVyRGF0YXNldCh3aW5kb3cubm93U2hvd0luZGljYXRlcylcbiAgICB9XG4gIH1cblxuICBAb2JzZXJ2ZSgnc2hvd1VubGFiZWxlZCcpXG4gIF91bkxhYmVsQ2hhbmdlZCgpIHtcbiAgICBsZXQgaW5kaWNhdGVzID0gW11cbiAgICBpZiAod2luZG93Lm5vd1Nob3dJbmRpY2F0ZXMpIHtcbiAgICAgIGlmICh0aGlzLnNob3dVbmxhYmVsZWQpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGxldCBpbmRpY2F0ZSA9IHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dW2ldXG4gICAgICAgICAgaWYgKGluZGljYXRlID09PSAxIHx8IHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzLmluZGV4T2YoaSkgIT09IC0xKSB7XG4gICAgICAgICAgICBpbmRpY2F0ZXMucHVzaChpKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB3aW5kb3cubm93U2hvd0luZGljYXRlcyA9IGluZGljYXRlc1xuICAgICAgICAvLyB0aGlzLnByb2plY3Rvci5maWx0ZXJEYXRhc2V0KHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmICh3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXVtpXSAhPT0gMSAmJiB3aW5kb3cubm93U2hvd0luZGljYXRlcy5pbmRleE9mKGkpICE9PSAtMSkge1xuICAgICAgICAgICAgaW5kaWNhdGVzLnB1c2goaSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgd2luZG93Lm5vd1Nob3dJbmRpY2F0ZXMgPSBpbmRpY2F0ZXNcbiAgICAgIH1cbiAgICAgIHRoaXMuZmlsdGVyRGF0YXNldCh3aW5kb3cubm93U2hvd0luZGljYXRlcylcbiAgICB9XG4gIH1cblxuICBAb2JzZXJ2ZSgnc2hvd1Rlc3RpbmcnKVxuICBfdGVzdGluZ0NoYW5nZWQoKSB7XG4gICAgbGV0IGluZGljYXRlcyA9IFtdXG4gICAgaWYgKHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzKSB7XG4gICAgICBpZiAodGhpcy5zaG93VGVzdGluZykge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgbGV0IGluZGljYXRlID0gd2luZG93LnByb3BlcnRpZXNbd2luZG93Lml0ZXJhdGlvbl1baV1cbiAgICAgICAgICBpZiAoaW5kaWNhdGUgPT09IDIgfHwgd2luZG93Lm5vd1Nob3dJbmRpY2F0ZXMuaW5kZXhPZihpKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIGluZGljYXRlcy5wdXNoKGkpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzID0gaW5kaWNhdGVzXG4gICAgICAgIC8vIHRoaXMucHJvamVjdG9yLmZpbHRlckRhdGFzZXQod2luZG93Lm5vd1Nob3dJbmRpY2F0ZXMpXG4gICAgICB9IGVsc2Uge1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgd2luZG93LnByb3BlcnRpZXNbd2luZG93Lml0ZXJhdGlvbl0ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAod2luZG93LnByb3BlcnRpZXNbd2luZG93Lml0ZXJhdGlvbl1baV0gIT09IDIgJiYgd2luZG93Lm5vd1Nob3dJbmRpY2F0ZXMuaW5kZXhPZihpKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIGluZGljYXRlcy5wdXNoKGkpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzID0gaW5kaWNhdGVzXG4gICAgICB9XG4gICAgICB0aGlzLmZpbHRlckRhdGFzZXQod2luZG93Lm5vd1Nob3dJbmRpY2F0ZXMpXG4gICAgfVxuICB9XG5cbiAgb25JdGVyYXRpb25DaGFuZ2UobnVtOiBudW1iZXIpIHtcbiAgICB3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbSgnaXRlcmF0aW9uJywgU3RyaW5nKG51bSkpXG4gICAgLy8gd2luZG93Lml0ZXJhdGlvbiA9IG51bTtcbiAgICBsZXQgaW5kaWNhdGVzID0gW11cbiAgICB0aGlzLml0ZXJhdGlvbiA9IG51bTtcbiAgICBpZiAoIXdpbmRvdy5pc0FuaW1hdGF0aW5nKSB7XG4gICAgICBpZiAodGhpcy5zaG93VGVzdGluZyA9PT0gZmFsc2UpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmICh3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXVtpXSAhPT0gMiAmJiB3aW5kb3cubm93U2hvd0luZGljYXRlcy5pbmRleE9mKGkpICE9PSAtMSkge1xuICAgICAgICAgICAgaW5kaWNhdGVzLnB1c2goaSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgd2luZG93Lm5vd1Nob3dJbmRpY2F0ZXMgPSBpbmRpY2F0ZXNcbiAgICAgIH1cbiAgICAgIHRoaXMuZmlsdGVyRGF0YXNldCh3aW5kb3cubm93U2hvd0luZGljYXRlcylcblxuICAgIH1cbiAgICBpZiAodGhpcy5pbnNwZWN0b3JQYW5lbCkge1xuICAgICAgaWYgKHdpbmRvdy5zZXNzaW9uU3RvcmFnZS50YXNrVHlwZSA9PT0gJ2FjdGl2ZSBsZWFybmluZycgJiYgd2luZG93Lml0ZXJhdGlvbiAhPT0gMSkge1xuICAgICAgICB0aGlzLmluc3BlY3RvclBhbmVsLnVwZGF0ZURpc2FibGVkU3RhdHVlcyh0cnVlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5pbnNwZWN0b3JQYW5lbC51cGRhdGVEaXNhYmxlZFN0YXR1ZXMoZmFsc2UpXG4gICAgICB9XG5cbiAgICB9XG4gICAgdGhpcy5pbml0aWFsVHJlZSgpXG4gIH1cblxuICBzZXRTZWxlY3RlZExhYmVsT3B0aW9uKGxhYmVsT3B0aW9uOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNlbGVjdGVkTGFiZWxPcHRpb24gPSBsYWJlbE9wdGlvbjtcbiAgICB0aGlzLm1ldGFkYXRhQ2FyZC5zZXRMYWJlbE9wdGlvbih0aGlzLnNlbGVjdGVkTGFiZWxPcHRpb24pO1xuICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnNldExhYmVsUG9pbnRBY2Nlc3NvcihsYWJlbE9wdGlvbik7XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIudXBkYXRlU2NhdHRlclBsb3RBdHRyaWJ1dGVzKCk7XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIucmVuZGVyKCk7XG4gIH1cbiAgc2V0U2VsZWN0ZWRDb2xvck9wdGlvbihjb2xvck9wdGlvbjogQ29sb3JPcHRpb24pIHtcbiAgICB0aGlzLnNlbGVjdGVkQ29sb3JPcHRpb24gPSBjb2xvck9wdGlvbjtcbiAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5zZXRMZWdlbmRQb2ludENvbG9yZXIoXG4gICAgICB0aGlzLmdldExlZ2VuZFBvaW50Q29sb3Jlcihjb2xvck9wdGlvbilcbiAgICApO1xuICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnVwZGF0ZVNjYXR0ZXJQbG90QXR0cmlidXRlcygpO1xuICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnJlbmRlcigpO1xuICB9XG4gIHNldE5vcm1hbGl6ZURhdGEobm9ybWFsaXplRGF0YTogYm9vbGVhbikge1xuICAgIHRoaXMubm9ybWFsaXplRGF0YSA9IG5vcm1hbGl6ZURhdGE7XG4gICAgdGhpcy5zZXRDdXJyZW50RGF0YVNldCh0aGlzLm9yaWdpbmFsRGF0YVNldC5nZXRTdWJzZXQoKSk7XG4gIH1cbiAgdXBkYXRlRGF0YVNldChcbiAgICBkczogRGF0YVNldCxcbiAgICBzcHJpdGVBbmRNZXRhZGF0YT86IFNwcml0ZUFuZE1ldGFkYXRhSW5mbyxcbiAgICBtZXRhZGF0YUZpbGU/OiBzdHJpbmdcbiAgKSB7XG4gICAgdGhpcy5kYXRhU2V0RmlsdGVySW5kaWNlcyA9IG51bGw7XG4gICAgdGhpcy5vcmlnaW5hbERhdGFTZXQgPSBkcztcbiAgICBpZiAoZHMgIT0gbnVsbCkge1xuICAgICAgdGhpcy5ub3JtYWxpemVEYXRhID1cbiAgICAgICAgdGhpcy5vcmlnaW5hbERhdGFTZXQuZGltWzFdID49IFRIUkVTSE9MRF9ESU1fTk9STUFMSVpFO1xuICAgICAgc3ByaXRlQW5kTWV0YWRhdGEgPSBzcHJpdGVBbmRNZXRhZGF0YSB8fCB7fTtcbiAgICAgIGlmIChzcHJpdGVBbmRNZXRhZGF0YS5wb2ludHNJbmZvID09IG51bGwpIHtcbiAgICAgICAgbGV0IFtwb2ludHNJbmZvLCBzdGF0c10gPSB0aGlzLm1ha2VEZWZhdWx0UG9pbnRzSW5mb0FuZFN0YXRzKGRzLnBvaW50cyk7XG4gICAgICAgIHNwcml0ZUFuZE1ldGFkYXRhLnBvaW50c0luZm8gPSBwb2ludHNJbmZvO1xuICAgICAgICBzcHJpdGVBbmRNZXRhZGF0YS5zdGF0cyA9IHN0YXRzO1xuICAgICAgfVxuICAgICAgbGV0IG1ldGFkYXRhTWVyZ2VTdWNjZWVkZWQgPSBkcy5tZXJnZU1ldGFkYXRhKHNwcml0ZUFuZE1ldGFkYXRhKTtcbiAgICAgIGlmICghbWV0YWRhdGFNZXJnZVN1Y2NlZWRlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlciAhPSBudWxsKSB7XG4gICAgICBpZiAoZHMgPT0gbnVsbCkge1xuICAgICAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5zZXRMYWJlbFBvaW50QWNjZXNzb3IobnVsbCk7XG4gICAgICAgIHRoaXMuc2V0UHJvamVjdGlvbihudWxsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnVwZGF0ZVNjYXR0ZXJQbG90UG9zaXRpb25zKCk7XG4gICAgICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnVwZGF0ZVNjYXR0ZXJQbG90QXR0cmlidXRlcygpO1xuICAgICAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5yZXNpemUoKTtcbiAgICAgICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIucmVuZGVyKCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChkcyAhPSBudWxsKSB7XG4gICAgICB0aGlzLmRhdGFQYW5lbC5zZXROb3JtYWxpemVEYXRhKHRoaXMubm9ybWFsaXplRGF0YSk7XG4gICAgICB0aGlzLnNldEN1cnJlbnREYXRhU2V0KGRzLmdldFN1YnNldCgpKTtcbiAgICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnNldExhYmVsUG9pbnRBY2Nlc3NvcihcbiAgICAgICAgdGhpcy5zZWxlY3RlZExhYmVsT3B0aW9uXG4gICAgICApO1xuICAgICAgdGhpcy5pbnNwZWN0b3JQYW5lbC5kYXRhc2V0Q2hhbmdlZCgpO1xuICAgICAgdGhpcy5pbnNwZWN0b3JQYW5lbC5tZXRhZGF0YUNoYW5nZWQoc3ByaXRlQW5kTWV0YWRhdGEpO1xuICAgICAgdGhpcy5wcm9qZWN0aW9uc1BhbmVsLm1ldGFkYXRhQ2hhbmdlZChzcHJpdGVBbmRNZXRhZGF0YSk7XG4gICAgICB0aGlzLmRhdGFQYW5lbC5tZXRhZGF0YUNoYW5nZWQoc3ByaXRlQW5kTWV0YWRhdGEsIG1ldGFkYXRhRmlsZSk7XG4gICAgICAvL3Jlc2V0XG4gICAgICBpZiAod2luZG93LnNlc3Npb25TdG9yYWdlLml0ZXJhdGlvbikge1xuICAgICAgICB0aGlzLnByb2plY3Rpb25zUGFuZWwuanVtcFRvKE51bWJlcih3aW5kb3cuc2Vzc2lvblN0b3JhZ2UuaXRlcmF0aW9uKSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucHJvamVjdGlvbnNQYW5lbC5qdW1wVG8oTnVtYmVyKDEpKVxuICAgICAgfVxuICAgICAgLy9yZXNldFxuICAgICAgaWYgKHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5hY2NlcHRJbmRpY2F0ZXMpIHtcbiAgICAgICAgd2luZG93LmFjY2VwdEluZGljYXRlcyA9IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5hY2NlcHRJbmRpY2F0ZXMuc3BsaXQoXCIsXCIpLm1hcChwYXJzZUZsb2F0KVxuICAgICAgfVxuICAgICAgaWYgKHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5yZWplY3RJbmRpY2F0ZXMpIHtcbiAgICAgICAgd2luZG93LnJlamVjdEluZGljYXRlcyA9IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5yZWplY3RJbmRpY2F0ZXMuc3BsaXQoXCIsXCIpLm1hcChwYXJzZUZsb2F0KVxuICAgICAgfVxuICAgICAgaWYgKHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5jdXN0b21TZWxlY3Rpb24pIHtcbiAgICAgICAgd2luZG93LmN1c3RvbVNlbGVjdGlvbiA9IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5jdXN0b21TZWxlY3Rpb24uc3BsaXQoXCIsXCIpLm1hcChwYXJzZUZsb2F0KVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNldEN1cnJlbnREYXRhU2V0KG51bGwpO1xuICAgICAgLy8gdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXJcbiAgICB9XG4gIH1cbiAgbWV0YWRhdGFFZGl0KG1ldGFkYXRhQ29sdW1uOiBzdHJpbmcsIG1ldGFkYXRhTGFiZWw6IHN0cmluZykge1xuICAgIHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMuZm9yRWFjaChcbiAgICAgIChpKSA9PiAodGhpcy5kYXRhU2V0LnBvaW50c1tpXS5tZXRhZGF0YVttZXRhZGF0YUNvbHVtbl0gPSBtZXRhZGF0YUxhYmVsKVxuICAgICk7XG4gICAgdGhpcy5uZWlnaGJvcnNPZkZpcnN0UG9pbnQuZm9yRWFjaChcbiAgICAgIChwKSA9PlxuICAgICAgICAodGhpcy5kYXRhU2V0LnBvaW50c1twLmluZGV4XS5tZXRhZGF0YVttZXRhZGF0YUNvbHVtbl0gPSBtZXRhZGF0YUxhYmVsKVxuICAgICk7XG4gICAgdGhpcy5kYXRhU2V0LnNwcml0ZUFuZE1ldGFkYXRhSW5mby5zdGF0cyA9IGFuYWx5emVNZXRhZGF0YShcbiAgICAgIHRoaXMuZGF0YVNldC5zcHJpdGVBbmRNZXRhZGF0YUluZm8uc3RhdHMubWFwKChzKSA9PiBzLm5hbWUpLFxuICAgICAgdGhpcy5kYXRhU2V0LnBvaW50cy5tYXAoKHApID0+IHAubWV0YWRhdGEpXG4gICAgKTtcbiAgICB0aGlzLm1ldGFkYXRhQ2hhbmdlZCh0aGlzLmRhdGFTZXQuc3ByaXRlQW5kTWV0YWRhdGFJbmZvKTtcbiAgICB0aGlzLm1ldGFkYXRhRWRpdG9yQ29udGV4dCh0cnVlLCBtZXRhZGF0YUNvbHVtbik7XG4gIH1cbiAgbWV0YWRhdGFDaGFuZ2VkKFxuICAgIHNwcml0ZUFuZE1ldGFkYXRhOiBTcHJpdGVBbmRNZXRhZGF0YUluZm8sXG4gICAgbWV0YWRhdGFGaWxlPzogc3RyaW5nXG4gICkge1xuICAgIGlmIChtZXRhZGF0YUZpbGUgIT0gbnVsbCkge1xuICAgICAgdGhpcy5tZXRhZGF0YUZpbGUgPSBtZXRhZGF0YUZpbGU7XG4gICAgfVxuXG4gICAgdGhpcy5kYXRhU2V0LnNwcml0ZUFuZE1ldGFkYXRhSW5mbyA9IHNwcml0ZUFuZE1ldGFkYXRhO1xuICAgIHRoaXMucHJvamVjdGlvbnNQYW5lbC5tZXRhZGF0YUNoYW5nZWQoc3ByaXRlQW5kTWV0YWRhdGEpO1xuICAgIHRoaXMuaW5zcGVjdG9yUGFuZWwubWV0YWRhdGFDaGFuZ2VkKHNwcml0ZUFuZE1ldGFkYXRhKTtcbiAgICB0aGlzLmRhdGFQYW5lbC5tZXRhZGF0YUNoYW5nZWQoc3ByaXRlQW5kTWV0YWRhdGEsIHRoaXMubWV0YWRhdGFGaWxlKTtcbiAgICBpZiAodGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBhdCBsZWFzdCBvbmUgc2VsZWN0ZWQgcG9pbnRcbiAgICAgIHRoaXMubWV0YWRhdGFDYXJkLnVwZGF0ZU1ldGFkYXRhKFxuICAgICAgICAvLyBzaG93IG1ldGFkYXRhIGZvciBmaXJzdCBzZWxlY3RlZCBwb2ludFxuICAgICAgICB0aGlzLmRhdGFTZXQucG9pbnRzW3RoaXMuc2VsZWN0ZWRQb2ludEluZGljZXNbMF1dLm1ldGFkYXRhXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBubyBwb2ludHMgc2VsZWN0ZWRcbiAgICAgIHRoaXMubWV0YWRhdGFDYXJkLnVwZGF0ZU1ldGFkYXRhKG51bGwpOyAvLyBjbGVhciBtZXRhZGF0YVxuICAgIH1cbiAgICB0aGlzLnNldFNlbGVjdGVkTGFiZWxPcHRpb24odGhpcy5zZWxlY3RlZExhYmVsT3B0aW9uKTtcbiAgfVxuICBtZXRhZGF0YUVkaXRvckNvbnRleHQoZW5hYmxlZDogYm9vbGVhbiwgbWV0YWRhdGFDb2x1bW46IHN0cmluZykge1xuICAgIGlmICh0aGlzLmluc3BlY3RvclBhbmVsKSB7XG4gICAgICB0aGlzLmluc3BlY3RvclBhbmVsLm1ldGFkYXRhRWRpdG9yQ29udGV4dChlbmFibGVkLCBtZXRhZGF0YUNvbHVtbik7XG4gICAgfVxuICB9XG4gIHNldFNlbGVjdGVkVGVuc29yKHJ1bjogc3RyaW5nLCB0ZW5zb3JJbmZvOiBFbWJlZGRpbmdJbmZvKSB7XG4gICAgdGhpcy5ib29rbWFya1BhbmVsLnNldFNlbGVjdGVkVGVuc29yKHJ1biwgdGVuc29ySW5mbywgdGhpcy5kYXRhUHJvdmlkZXIpO1xuICB9XG4gIHVwZGF0ZUJhY2tncm91bmRJbWcoKSB7XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIudXBkYXRlQmFja2dyb3VuZCgpXG4gIH1cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBhIGxpc3RlbmVyIHRvIGJlIGNhbGxlZCBhbnkgdGltZSB0aGUgc2VsZWN0ZWQgcG9pbnQgc2V0IGNoYW5nZXMuXG4gICAqL1xuICByZWdpc3RlclNlbGVjdGlvbkNoYW5nZWRMaXN0ZW5lcihsaXN0ZW5lcjogU2VsZWN0aW9uQ2hhbmdlZExpc3RlbmVyKSB7XG4gICAgdGhpcy5zZWxlY3Rpb25DaGFuZ2VkTGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuICB9XG4gIGZpbHRlckRhdGFzZXQocG9pbnRJbmRpY2VzOiBudW1iZXJbXSwgZmlsdGVyPzogYm9vbGVhbikge1xuICAgIGNvbnN0IHNlbGVjdGlvblNpemUgPSB0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzLmxlbmd0aDtcbiAgICAvKlxuICAgIGlmICh0aGlzLmRhdGFTZXRCZWZvcmVGaWx0ZXIgPT0gbnVsbCkge1xuICAgICAgdGhpcy5kYXRhU2V0QmVmb3JlRmlsdGVyID0gdGhpcy5kYXRhU2V0O1xuICAgIH0qL1xuICAgIGNvbnNvbGUubG9nKCdub3cnLHBvaW50SW5kaWNlcy5sZW5ndGgsdGhpcy5kYXRhU2V0KVxuICAgIHRoaXMuZGF0YVNldC5zZXREVklGaWx0ZXJlZERhdGEocG9pbnRJbmRpY2VzKTtcbiAgICAvLyB0aGlzLnNldEN1cnJlbnREYXRhU2V0KHRoaXMuZGF0YVNldC5nZXRTdWJzZXQocG9pbnRJbmRpY2VzKSk7XG4gICAgdGhpcy5kYXRhU2V0RmlsdGVySW5kaWNlcyA9IHBvaW50SW5kaWNlcztcbiAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci51cGRhdGVTY2F0dGVyUGxvdFBvc2l0aW9ucygpO1xuICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnVwZGF0ZVNjYXR0ZXJQbG90QXR0cmlidXRlcyhmaWx0ZXIpO1xuICAgIC8vIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnVwZGF0ZUJhY2tncm91bmQoKVxuICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnJlbmRlcigpXG4gICAgLy8gdGhpcy5hZGp1c3RTZWxlY3Rpb25BbmRIb3Zlcih1dGlsLnJhbmdlKHNlbGVjdGlvblNpemUpKTtcblxuICAgIGlmICh3aW5kb3cuaXNBZGp1c3RpbmdTZWwpIHtcbiAgICAgIC8vIHRoaXMuYm91bmRpbmdTZWxlY3Rpb25CdG4uY2xhc3NMaXN0LmFkZCgnYWN0aXZlZCcpXG4gICAgICB0aGlzLnNldE1vdXNlTW9kZShNb3VzZU1vZGUuQVJFQV9TRUxFQ1QpXG4gICAgfVxuICB9XG4gIHJlc2V0RmlsdGVyRGF0YXNldChudW0/KSB7XG4gICAgY29uc3Qgb3JpZ2luYWxQb2ludEluZGljZXMgPSB0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzLm1hcChcbiAgICAgIChmaWx0ZXJlZEluZGV4KSA9PiB0aGlzLmRhdGFTZXQucG9pbnRzW2ZpbHRlcmVkSW5kZXhdLmluZGV4XG4gICAgKTtcbiAgICAvKlxuICAgIHRoaXMuc2V0Q3VycmVudERhdGFTZXQodGhpcy5kYXRhU2V0QmVmb3JlRmlsdGVyKTtcbiAgICBpZiAodGhpcy5wcm9qZWN0aW9uICE9IG51bGwpIHtcbiAgICAgIHRoaXMucHJvamVjdGlvbi5kYXRhU2V0ID0gdGhpcy5kYXRhU2V0QmVmb3JlRmlsdGVyO1xuICAgIH1cbiAgICB0aGlzLmRhdGFTZXRCZWZvcmVGaWx0ZXIgPSBudWxsOyovXG4gICAgLy8gc2V0RFZJZmlsdGVyIGFsbCBkYXRhXG4gICAgbGV0IHRvdGFsID0gdGhpcy5kYXRhU2V0LkRWSVZhbGlkUG9pbnROdW1iZXJbdGhpcy5kYXRhU2V0LnRTTkVJdGVyYXRpb25dXG4gICAgaWYgKG51bSkge1xuICAgICAgdG90YWwgPSBudW1cbiAgICB9XG5cbiAgICB2YXIgaW5kaWNlczogbnVtYmVyW107XG4gICAgaW5kaWNlcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdG90YWw7IGkrKykge1xuICAgICAgaW5kaWNlcy5wdXNoKGkpO1xuICAgIH1cbiAgICB0aGlzLmRhdGFTZXRGaWx0ZXJJbmRpY2VzID0gaW5kaWNlcztcbiAgICB0aGlzLmRhdGFTZXQuc2V0RFZJRmlsdGVyZWREYXRhKGluZGljZXMpO1xuICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnVwZGF0ZVNjYXR0ZXJQbG90UG9zaXRpb25zKCk7XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIudXBkYXRlU2NhdHRlclBsb3RBdHRyaWJ1dGVzKCk7XG4gICAgLy8gdGhpcy5hZGp1c3RTZWxlY3Rpb25BbmRIb3Zlcih1dGlsLnJhbmdlKHNlbGVjdGlvblNpemUpKTtcblxuICB9XG4gIC8vL1xuICBzZXREeW5hbWljTm9pc3koKSB7XG4gICAgLy8gdGhpcy5zZXREeW5hbWljU3RvcCgpXG4gICAgaWYgKCF3aW5kb3cuY3VzdG9tU2VsZWN0aW9uKSB7XG4gICAgICB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uID0gW11cbiAgICB9XG4gICAgaWYgKCF3aW5kb3cucXVlcnlSZXNBbm9ybWFsQ2xlYW5JbmRlY2F0ZXMpIHtcbiAgICAgIHdpbmRvdy5xdWVyeVJlc0Fub3JtYWxDbGVhbkluZGVjYXRlcyA9IFtdXG4gICAgfVxuICAgIGxldCBpbmRlY2F0ZXMgPSB3aW5kb3cucXVlcnlSZXNBbm9ybWFsQ2xlYW5JbmRlY2F0ZXMuY29uY2F0KHdpbmRvdy5jdXN0b21TZWxlY3Rpb24pXG4gICAgaWYgKGluZGVjYXRlcyAmJiBpbmRlY2F0ZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLmZpbHRlckRhdGFzZXQoaW5kZWNhdGVzKVxuICAgIH1cbiAgICAvLyB0aGlzLmZpbHRlckRhdGFzZXQodGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcylcbiAgICB0aGlzLmN1cnJlbnRJdGVyYXRpb24gPSB3aW5kb3cuaXRlcmF0aW9uXG5cbiAgICBsZXQgY3VycmVudCA9IDFcbiAgICBsZXQgcG9zaXRpb25zID0gd2luZG93LmFsbFJlc1Bvc2l0aW9ucz8ucmVzdWx0c1xuICAgIGxldCBpbnRlcmF0aW9uTGlzdCA9IFtdXG4gICAgaWYgKHdpbmRvdy5hbGxSZXNQb3NpdGlvbnMgJiYgd2luZG93LmFsbFJlc1Bvc2l0aW9ucy5iZ2ltZ0xpc3QpIHtcbiAgICAgIHdpbmRvdy5zY2VuZUJhY2tncm91bmRJbWcgPSB3aW5kb3cuYWxsUmVzUG9zaXRpb25zPy5iZ2ltZ0xpc3RcbiAgICB9XG4gICAgZm9yIChsZXQga2V5IG9mIE9iamVjdC5rZXlzKHdpbmRvdy5hbGxSZXNQb3NpdGlvbnM/LnJlc3VsdHMpKSB7XG4gICAgICBpbnRlcmF0aW9uTGlzdC5wdXNoKE51bWJlcihrZXkpKVxuICAgIH1cbiAgICBjdXJyZW50ID0gTnVtYmVyKGludGVyYXRpb25MaXN0WzBdKVxuICAgIGxldCBjb3VudCA9IDBcbiAgICBpZiAodGhpcy5pbnRlcnZhbEZsYWcpIHtcbiAgICAgIHRoaXMuaW50ZXJ2YWxGbGFnID0gZmFsc2VcbiAgICAgIHRoaXMudGltZXIgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXG4gICAgICAgIHRoaXMuaW5zcGVjdG9yUGFuZWwudXBkYXRlQ3VycmVudFBsYXlFcG9jaChjdXJyZW50KVxuICAgICAgICB3aW5kb3cuaXRlcmF0aW9uID0gY3VycmVudDtcbiAgICAgICAgbGV0IGxlbmd0aCA9IHRoaXMuZGF0YVNldC5wb2ludHMubGVuZ3RoXG4gICAgICAgIGlmIChsZW5ndGggPT09IDYwMDAyKSB7XG4gICAgICAgICAgbGV0IHBvaW50MSA9IHRoaXMuZGF0YVNldC5wb2ludHNbbGVuZ3RoIC0gMl07XG4gICAgICAgICAgbGV0IHBvaW50MiA9IHRoaXMuZGF0YVNldC5wb2ludHNbbGVuZ3RoIC0gMV07XG4gICAgICAgICAgcG9pbnQxLnByb2plY3Rpb25zWyd0c25lLTAnXSA9IHdpbmRvdy5hbGxSZXNQb3NpdGlvbnMuZ3JpZFtjdXJyZW50XVswXVxuICAgICAgICAgIHBvaW50MS5wcm9qZWN0aW9uc1sndHNuZS0xJ10gPSB3aW5kb3cuYWxsUmVzUG9zaXRpb25zLmdyaWRbY3VycmVudF1bMV1cbiAgICAgICAgICBwb2ludDIucHJvamVjdGlvbnNbJ3RzbmUtMCddID0gd2luZG93LmFsbFJlc1Bvc2l0aW9ucy5ncmlkW2N1cnJlbnRdWzJdXG4gICAgICAgICAgcG9pbnQyLnByb2plY3Rpb25zWyd0c25lLTEnXSA9IHdpbmRvdy5hbGxSZXNQb3NpdGlvbnMuZ3JpZFtjdXJyZW50XVszXVxuICAgICAgICAgIC8vIHBvaW50LnByb2plY3Rpb25zWyd0c25lLTAnXSA9IFxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmRhdGFTZXQucG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgcG9pbnQgPSB0aGlzLmRhdGFTZXQucG9pbnRzW2ldO1xuICAgICAgICAgIGlmICghd2luZG93LmN1c3RvbVNlbGVjdGlvbiB8fCAhd2luZG93LmN1c3RvbVNlbGVjdGlvbi5sZW5ndGggfHwgd2luZG93LmN1c3RvbVNlbGVjdGlvbi5pbmRleE9mKGkpICE9PSAtMSB8fCB3aW5kb3cucXVlcnlSZXNBbm9ybWFsQ2xlYW5JbmRlY2F0ZXM/LmluZGV4T2YoaSkgIT09IC0xKSB7XG4gICAgICAgICAgICBwb2ludC5wcm9qZWN0aW9uc1sndHNuZS0wJ10gPSBwb3NpdGlvbnNbY3VycmVudF1baV1bMF07XG4gICAgICAgICAgICBwb2ludC5wcm9qZWN0aW9uc1sndHNuZS0xJ10gPSBwb3NpdGlvbnNbY3VycmVudF1baV1bMV07XG4gICAgICAgICAgICBwb2ludC5wcm9qZWN0aW9uc1sndHNuZS0yJ10gPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyB0aGlzLmRhdGFTZXQudXBkYXRlUHJvamVjdGlvbihjdXJyZW50KVxuICAgICAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci51cGRhdGVTY2F0dGVyUGxvdFBvc2l0aW9ucygpO1xuICAgICAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci51cGRhdGVTY2F0dGVyUGxvdEF0dHJpYnV0ZXMoKTtcbiAgICAgICAgdGhpcy51cGRhdGVCYWNrZ3JvdW5kSW1nKCk7XG4gICAgICAgIHRoaXMub25JdGVyYXRpb25DaGFuZ2UoY3VycmVudCk7XG4gICAgICAgIC8vIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnVwZGF0ZVNjYXR0ZXJQbG90QXR0cmlidXRlcygpXG4gICAgICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnJlbmRlcigpXG4gICAgICAgIGlmIChjb3VudCA9PSBpbnRlcmF0aW9uTGlzdC5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgdGhpcy5pbnNwZWN0b3JQYW5lbC5wbGF5QW5pbWF0aW9uRmluaXNoZWQoKVxuICAgICAgICAgIHRoaXMuc2V0RHluYW1pY1N0b3AoKVxuICAgICAgICAgIGN1cnJlbnQgPSBpbnRlcmF0aW9uTGlzdFswXVxuICAgICAgICAgIGNvdW50ID0gMFxuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY3VycmVudCA9IGludGVyYXRpb25MaXN0WysrY291bnRdXG4gICAgICAgIH1cbiAgICAgIH0sIDEyMDApXG4gICAgfVxuXG4gIH1cblxuICB1cGRhdGVQb3NCeUluZGljYXRlcyhjdXJyZW50OiBudW1iZXIpIHtcbiAgICBsZXQgcG9zaXRpb25zID0gd2luZG93LmFsbFJlc1Bvc2l0aW9ucz8ucmVzdWx0c1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5kYXRhU2V0LnBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgcG9pbnQgPSB0aGlzLmRhdGFTZXQucG9pbnRzW2ldO1xuICAgICAgaWYgKCF0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzLmxlbmd0aCB8fCB0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzLmluZGV4T2YoaSkgIT09IC0xKSB7XG4gICAgICAgIHBvaW50LnByb2plY3Rpb25zWyd0c25lLTAnXSA9IHBvc2l0aW9uc1tjdXJyZW50XVtpXVswXTtcbiAgICAgICAgcG9pbnQucHJvamVjdGlvbnNbJ3RzbmUtMSddID0gcG9zaXRpb25zW2N1cnJlbnRdW2ldWzFdO1xuICAgICAgICBwb2ludC5wcm9qZWN0aW9uc1sndHNuZS0yJ10gPSAwO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyB0aGlzLmRhdGFTZXQudXBkYXRlUHJvamVjdGlvbihjdXJyZW50KVxuICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnVwZGF0ZVNjYXR0ZXJQbG90UG9zaXRpb25zKCk7XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIudXBkYXRlU2NhdHRlclBsb3RBdHRyaWJ1dGVzKCk7XG4gICAgdGhpcy51cGRhdGVCYWNrZ3JvdW5kSW1nKCk7XG4gICAgdGhpcy5vbkl0ZXJhdGlvbkNoYW5nZShjdXJyZW50KTtcbiAgfVxuICBzZXREeW5hbWljU3RvcCgpIHtcbiAgICB3aW5kb3cuaXNBbmltYXRhdGluZyA9IGZhbHNlXG4gICAgaWYgKHRoaXMudGltZXIgJiYgIXRoaXMuaW50ZXJ2YWxGbGFnKSB7XG4gICAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKVxuICAgICAgdGhpcy5pbnRlcnZhbEZsYWcgPSB0cnVlXG4gICAgICB0aGlzLnJlc2V0RmlsdGVyRGF0YXNldCgpXG4gICAgfVxuICAgIGxldCBlbmQgPSBzZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7IH0sIDEwMDAwKTtcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8PSBlbmQ7IGkrKykge1xuICAgICAgY2xlYXJJbnRlcnZhbChpKTtcbiAgICB9XG5cbiAgICB0aGlzLml0ZXJhdGlvbiA9IHRoaXMuY3VycmVudEl0ZXJhdGlvblxuICAgIGxldCBsZW5ndGggPSB0aGlzLmRhdGFTZXQucG9pbnRzLmxlbmd0aFxuICAgIGlmIChsZW5ndGggPT09IDYwMDAyKSB7XG4gICAgICBsZXQgcG9pbnQxID0gdGhpcy5kYXRhU2V0LnBvaW50c1tsZW5ndGggLSAyXTtcbiAgICAgIGxldCBwb2ludDIgPSB0aGlzLmRhdGFTZXQucG9pbnRzW2xlbmd0aCAtIDFdO1xuICAgICAgcG9pbnQxLnByb2plY3Rpb25zWyd0c25lLTAnXSA9IHdpbmRvdy5hbGxSZXNQb3NpdGlvbnMuZ3JpZFt0aGlzLml0ZXJhdGlvbl1bMF1cbiAgICAgIHBvaW50MS5wcm9qZWN0aW9uc1sndHNuZS0xJ10gPSB3aW5kb3cuYWxsUmVzUG9zaXRpb25zLmdyaWRbdGhpcy5pdGVyYXRpb25dWzFdXG4gICAgICBwb2ludDIucHJvamVjdGlvbnNbJ3RzbmUtMCddID0gd2luZG93LmFsbFJlc1Bvc2l0aW9ucy5ncmlkW3RoaXMuaXRlcmF0aW9uXVsyXVxuICAgICAgcG9pbnQyLnByb2plY3Rpb25zWyd0c25lLTEnXSA9IHdpbmRvdy5hbGxSZXNQb3NpdGlvbnMuZ3JpZFt0aGlzLml0ZXJhdGlvbl1bM11cbiAgICAgIC8vIHBvaW50LnByb2plY3Rpb25zWyd0c25lLTAnXSA9IFxuICAgIH1cbiAgICB3aW5kb3cuaXRlcmF0aW9uID0gdGhpcy5jdXJyZW50SXRlcmF0aW9uXG4gICAgdGhpcy51cGRhdGVQb3NCeUluZGljYXRlcyh3aW5kb3cuaXRlcmF0aW9uKVxuICB9XG5cbiAgcmVuZGVySW5UcmFjZUxpbmUoaW5UcmFjZTogYm9vbGVhbikge1xuICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnNldFJlbmRlckluVHJhY2VMaW5lKGluVHJhY2UpXG4gIH1cblxuICByZWZyZXNoKCkge1xuICAgIGNvbnNvbGUubG9nKCdycmVlZmZmJylcbiAgICAvLyB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5zY2F0dGVyUGxvdC5yZW5kZXIoKVxuICAgIHRoaXMubWV0YWRhdGFDYXJkLnVwZGF0ZUN1c3RvbUxpc3QodGhpcy5kYXRhU2V0LnBvaW50cywgdGhpcyBhcyBQcm9qZWN0b3JFdmVudENvbnRleHQpXG4gICAgdGhpcy5tZXRhZGF0YUNhcmQudXBkYXRlUmVqZWN0TGlzdCh0aGlzLmRhdGFTZXQucG9pbnRzLCB0aGlzIGFzIFByb2plY3RvckV2ZW50Q29udGV4dClcbiAgICAvLyB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5zY2F0dGVyUGxvdC5yZW5kZXIoKVxuICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnVwZGF0ZVNjYXR0ZXJQbG90QXR0cmlidXRlcygpXG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIucmVuZGVyKClcbiAgfVxuICByZW1vdmVjdXN0b21Jbk1ldGFDYXJkKCkge1xuICAgIHRoaXMubWV0YWRhdGFDYXJkLnVwZGF0ZUN1c3RvbUxpc3QodGhpcy5kYXRhU2V0LnBvaW50cywgdGhpcyBhcyBQcm9qZWN0b3JFdmVudENvbnRleHQpXG4gICAgdGhpcy5tZXRhZGF0YUNhcmQudXBkYXRlUmVqZWN0TGlzdCh0aGlzLmRhdGFTZXQucG9pbnRzLCB0aGlzIGFzIFByb2plY3RvckV2ZW50Q29udGV4dClcbiAgICAvLyB0aGlzLmluc3BlY3RvclBhbmVsLnJlZnJlc2hTZWFyY2hSZXN1bHQoKVxuICAgIHRoaXMuaW5zcGVjdG9yUGFuZWwudXBkYXRlU2Vzc2lvblN0b3JhZ2UoKVxuICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnVwZGF0ZVNjYXR0ZXJQbG90QXR0cmlidXRlcygpXG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIucmVuZGVyKClcbiAgfVxuICAvKipcbiAgICogVXNlZCBieSBjbGllbnRzIHRvIGluZGljYXRlIHRoYXQgYSBzZWxlY3Rpb24gaGFzIG9jY3VycmVkLlxuICAgKi9cbiAgYXN5bmMgbm90aWZ5U2VsZWN0aW9uQ2hhbmdlZChuZXdTZWxlY3RlZFBvaW50SW5kaWNlczogbnVtYmVyW10sIHNlbGVjdE1vZGU/OiBib29sZWFuLCBzZWxlY3Rpb25UeXBlPzogc3RyaW5nKSB7XG4gICAgY29uc29sZS5sb2coJ25vdGlmeVNlbGVjdGlvbkNoYW5nZWQnLCBzZWxlY3Rpb25UeXBlLG5ld1NlbGVjdGVkUG9pbnRJbmRpY2VzKVxuICAgIGlmICghdGhpcy5yZWdpc3RlcmVkKSB7XG4gICAgICB0aGlzLnJlYWR5cmVnaXMoKVxuICAgIH1cbiAgICBpZiAoIXdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMpIHtcbiAgICAgIHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMgPSBbXVxuICAgIH1cbiAgICBpZiAoIXdpbmRvdy5yZWplY3RJbmRpY2F0ZXMpIHtcbiAgICAgIHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMgPSBbXVxuICAgIH1cbiAgICB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uID0gd2luZG93LmFjY2VwdEluZGljYXRlcy5jb25jYXQod2luZG93LnJlamVjdEluZGljYXRlcylcbiAgICBpZiAoc2VsZWN0aW9uVHlwZSA9PT0gJ2lzQUxRdWVyeScgfHwgc2VsZWN0aW9uVHlwZSA9PT0gJ25vcm1hbCcgfHwgc2VsZWN0aW9uVHlwZSA9PT0gJ2lzQW5vcm1hbHlRdWVyeScgfHwgc2VsZWN0aW9uVHlwZSA9PT0gJ2JvdW5kaW5nYm94Jykge1xuICAgICAgLy8gd2luZG93LmN1c3RvbVNlbGVjdGlvbiA9IFtdXG4gICAgICB3aW5kb3cucXVlcnlSZXNQb2ludEluZGljZXMgPSBuZXdTZWxlY3RlZFBvaW50SW5kaWNlc1xuICAgICAgaWYgKHNlbGVjdGlvblR5cGUgPT09ICdpc0FMUXVlcnknKSB7XG4gICAgICAgIHdpbmRvdy5hbFF1ZXJ5UmVzUG9pbnRJbmRpY2VzID0gbmV3U2VsZWN0ZWRQb2ludEluZGljZXNcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHdpbmRvdy5hbFF1ZXJ5UmVzUG9pbnRJbmRpY2VzID0gW11cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHNlbGVjdGlvblR5cGUgPT09ICdpc1Nob3dTZWxlY3RlZCcpIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgd2luZG93LnByZXZpb3VzSW5kZWNhdGVzPy5sZW5ndGg7IGkrKykge1xuICAgICAgICAvLyBpZih3aW5kb3cuY3VzdG9tU2VsZWN0aW9uLmluZGV4T2Yod2luZG93LnByZXZpb3VzSW5kZWNhdGVzW2ldKSA9PT0gLTEpe1xuICAgICAgICBsZXQgaW5kZXggPSB3aW5kb3cucHJldmlvdXNJbmRlY2F0ZXNbaV1cbiAgICAgICAgaWYgKHdpbmRvdy5jaGVja2JveERvbVtpbmRleF0pIHtcbiAgICAgICAgICB3aW5kb3cuY2hlY2tib3hEb21baW5kZXhdLmNoZWNrZWQgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgICAgLy8gfVxuICAgICAgfVxuICAgICAgdGhpcy5tZXRhZGF0YUNhcmQudXBkYXRlQ3VzdG9tTGlzdCh0aGlzLmRhdGFTZXQucG9pbnRzLCB0aGlzIGFzIFByb2plY3RvckV2ZW50Q29udGV4dClcbiAgICAgIHRoaXMubWV0YWRhdGFDYXJkLnVwZGF0ZVJlamVjdExpc3QodGhpcy5kYXRhU2V0LnBvaW50cywgdGhpcyBhcyBQcm9qZWN0b3JFdmVudENvbnRleHQpXG4gICAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci51cGRhdGVTY2F0dGVyUGxvdEF0dHJpYnV0ZXMoKVxuICAgICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIucmVuZGVyKClcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBpZiAoc2VsZWN0aW9uVHlwZSA9PT0gJ2JvdW5kaW5nYm94Jykge1xuICAgICAgbGV0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICAgICAgaGVhZGVycy5hcHBlbmQoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICBoZWFkZXJzLmFwcGVuZCgnQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcblxuICAgICAgYXdhaXQgZmV0Y2goYGh0dHA6Ly8ke3RoaXMuRFZJU2VydmVyfS9ib3VuZGluZ2JveF9yZWNvcmRgLCB7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBtb2RlOiAnY29ycycsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgXCJ1c2VybmFtZVwiOiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudXNlcm5hbWUsXG4gICAgICAgIH0pLFxuICAgICAgICBoZWFkZXJzOiBoZWFkZXJzLFxuICAgICAgfSkudGhlbigoKT0+e1xuICAgICAgICAgIGNvbnNvbGUubG9nKCcxMjMzMjMnKVxuICAgICAgfSlcbiAgICAgIHdpbmRvdy5hbFN1Z2dlc3RMYWJlbExpc3QgPSBbXVxuICAgICAgd2luZG93LmFsU3VnZ2VzdFNjb3JlTGlzdCA9IFtdXG4gICAgICB3aW5kb3cucXVlcnlSZXNQb2ludEluZGljZXMgPSBuZXdTZWxlY3RlZFBvaW50SW5kaWNlc1xuICAgICAgdGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcyA9IG5ld1NlbGVjdGVkUG9pbnRJbmRpY2VzXG4gICAgICB3aW5kb3cuYWxRdWVyeVJlc1BvaW50SW5kaWNlcyA9IFtdXG4gICAgICB0aGlzLmluc3BlY3RvclBhbmVsLnJlZnJlc2hTZWFyY2hSZXNCeUxpc3QobmV3U2VsZWN0ZWRQb2ludEluZGljZXMpXG4gICAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci51cGRhdGVTY2F0dGVyUGxvdEF0dHJpYnV0ZXMoKVxuICAgICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIucmVuZGVyKClcbiAgICAgIHRoaXMuc2VsZWN0aW9uQ2hhbmdlZExpc3RlbmVycy5mb3JFYWNoKChsKSA9PlxuICAgICAgICBsKHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMsIFtdKVxuICAgICAgKTtcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGxldCBuZWlnaGJvcnM6IGtubi5OZWFyZXN0RW50cnlbXSA9IFtdO1xuICAgIGlmIChcbiAgICAgIHRoaXMuZWRpdE1vZGUgJiYgLy8gcG9pbnQgc2VsZWN0aW9uIHRvZ2dsZSBpbiBleGlzdGluZyBzZWxlY3Rpb25cbiAgICAgIG5ld1NlbGVjdGVkUG9pbnRJbmRpY2VzLmxlbmd0aCA+IDBcbiAgICApIHtcbiAgICAgIC8vIHNlbGVjdGlvbiByZXF1aXJlZFxuICAgICAgaWYgKHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIC8vIG1haW4gcG9pbnQgd2l0aCBuZWlnaGJvcnNcbiAgICAgICAgbGV0IG1haW5fcG9pbnRfdmVjdG9yID0gdGhpcy5kYXRhU2V0LnBvaW50c1tcbiAgICAgICAgICB0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzWzBdXG4gICAgICAgIF0udmVjdG9yO1xuICAgICAgICBuZWlnaGJvcnMgPSB0aGlzLm5laWdoYm9yc09mRmlyc3RQb2ludC5maWx0ZXIoXG4gICAgICAgICAgKFxuICAgICAgICAgICAgbiAvLyBkZXNlbGVjdFxuICAgICAgICAgICkgPT4gbmV3U2VsZWN0ZWRQb2ludEluZGljZXMuZmlsdGVyKChwKSA9PiBwID09IG4uaW5kZXgpLmxlbmd0aCA9PSAwXG4gICAgICAgICk7XG4gICAgICAgIG5ld1NlbGVjdGVkUG9pbnRJbmRpY2VzLmZvckVhY2goKHApID0+IHtcbiAgICAgICAgICAvLyBhZGQgYWRkaXRpb25hbCBuZWlnaGJvcnNcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBwICE9IHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXNbMF0gJiYgLy8gbm90IG1haW4gcG9pbnRcbiAgICAgICAgICAgIHRoaXMubmVpZ2hib3JzT2ZGaXJzdFBvaW50LmZpbHRlcigobikgPT4gbi5pbmRleCA9PSBwKS5sZW5ndGggPT0gMFxuICAgICAgICAgICkge1xuICAgICAgICAgICAgbGV0IHBfdmVjdG9yID0gdGhpcy5kYXRhU2V0LnBvaW50c1twXS52ZWN0b3I7XG4gICAgICAgICAgICBsZXQgbl9kaXN0ID0gdGhpcy5pbnNwZWN0b3JQYW5lbC5kaXN0RnVuYyhcbiAgICAgICAgICAgICAgbWFpbl9wb2ludF92ZWN0b3IsXG4gICAgICAgICAgICAgIHBfdmVjdG9yXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgbGV0IHBvcyA9IDA7IC8vIGluc2VydGlvbiBwb3NpdGlvbiBpbnRvIGRpc3Qgb3JkZXJlZCBuZWlnaGJvcnNcbiAgICAgICAgICAgIHdoaWxlIChcbiAgICAgICAgICAgICAgcG9zIDwgbmVpZ2hib3JzLmxlbmd0aCAmJlxuICAgICAgICAgICAgICBuZWlnaGJvcnNbcG9zXS5kaXN0IDwgbl9kaXN0IC8vIGZpbmQgcG9zXG4gICAgICAgICAgICApXG4gICAgICAgICAgICAgIHBvcyA9IHBvcyArIDE7IC8vIG1vdmUgdXAgdGhlIHNvcnRlZCBuZWlnaGJvcnMgbGlzdCBhY2NvcmRpbmcgdG8gZGlzdFxuICAgICAgICAgICAgbmVpZ2hib3JzLnNwbGljZShwb3MsIDAsIHsgaW5kZXg6IHAsIGRpc3Q6IG5fZGlzdCB9KTsgLy8gYWRkIG5ldyBuZWlnaGJvclxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBtdWx0aXBsZSBzZWxlY3Rpb25zXG4gICAgICAgIGxldCB1cGRhdGVkU2VsZWN0ZWRQb2ludEluZGljZXMgPSB0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzLmZpbHRlcihcbiAgICAgICAgICAobikgPT4gbmV3U2VsZWN0ZWRQb2ludEluZGljZXMuZmlsdGVyKChwKSA9PiBwID09IG4pLmxlbmd0aCA9PSAwXG4gICAgICAgICk7IC8vIGRlc2VsZWN0XG4gICAgICAgIG5ld1NlbGVjdGVkUG9pbnRJbmRpY2VzLmZvckVhY2goKHApID0+IHtcbiAgICAgICAgICAvLyBhZGQgYWRkaXRpb25hbCBzZWxlY3Rpb25zXG4gICAgICAgICAgaWYgKHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMuZmlsdGVyKChzKSA9PiBzID09IHApLmxlbmd0aCA9PSAwKVxuICAgICAgICAgICAgLy8gdW5zZWxlY3RlZFxuICAgICAgICAgICAgdXBkYXRlZFNlbGVjdGVkUG9pbnRJbmRpY2VzLnB1c2gocCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzID0gdXBkYXRlZFNlbGVjdGVkUG9pbnRJbmRpY2VzOyAvLyB1cGRhdGUgc2VsZWN0aW9uXG4gICAgICAgIGlmICh0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAvLyBhdCBsZWFzdCBvbmUgc2VsZWN0ZWQgcG9pbnRcbiAgICAgICAgICB0aGlzLm1ldGFkYXRhQ2FyZC51cGRhdGVNZXRhZGF0YShcbiAgICAgICAgICAgIC8vIHNob3cgbWV0YWRhdGEgZm9yIGZpcnN0IHNlbGVjdGVkIHBvaW50XG4gICAgICAgICAgICB0aGlzLmRhdGFTZXQucG9pbnRzW3RoaXMuc2VsZWN0ZWRQb2ludEluZGljZXNbMF1dLm1ldGFkYXRhXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBubyBwb2ludHMgc2VsZWN0ZWRcbiAgICAgICAgICB0aGlzLm1ldGFkYXRhQ2FyZC51cGRhdGVNZXRhZGF0YShudWxsKTsgLy8gY2xlYXIgbWV0YWRhdGFcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc2VsZWN0TW9kZSA9PSB0cnVlKSB7XG4gICAgICAvLyBmb3IgYm91bmRpbmcgYm94IHNlbGVjdGlvblxuICAgICAgLy8gbXVsdGlwbGUgc2VsZWN0aW9uc1xuICAgICAgbGV0IHVwZGF0ZWRTZWxlY3RlZFBvaW50SW5kaWNlcyA9IHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMuZmlsdGVyKFxuICAgICAgICAobikgPT4gbmV3U2VsZWN0ZWRQb2ludEluZGljZXMuZmlsdGVyKChwKSA9PiBwID09IG4pLmxlbmd0aCA9PSAwXG4gICAgICApOyAvLyBkZXNlbGVjdFxuICAgICAgbmV3U2VsZWN0ZWRQb2ludEluZGljZXMuZm9yRWFjaCgocCkgPT4ge1xuICAgICAgICAvLyBhZGQgYWRkaXRpb25hbCBzZWxlY3Rpb25zXG4gICAgICAgIGlmICh0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzLmZpbHRlcigocykgPT4gcyA9PSBwKS5sZW5ndGggPT0gMClcbiAgICAgICAgICAvLyB1bnNlbGVjdGVkXG4gICAgICAgICAgdXBkYXRlZFNlbGVjdGVkUG9pbnRJbmRpY2VzLnB1c2gocCk7XG4gICAgICB9KTtcbiAgICAgIHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMgPSB1cGRhdGVkU2VsZWN0ZWRQb2ludEluZGljZXM7IC8vIHVwZGF0ZSBzZWxlY3Rpb25cbiAgICAgIGlmICh0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgLy8gYXQgbGVhc3Qgb25lIHNlbGVjdGVkIHBvaW50XG4gICAgICAgIGlmICh0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgdGhpcy5tZXRhZGF0YUNhcmQudXBkYXRlTWV0YWRhdGEoXG4gICAgICAgICAgICAvLyBzaG93IG1ldGFkYXRhIGZvciBmaXJzdCBzZWxlY3RlZCBwb2ludFxuICAgICAgICAgICAgdGhpcy5kYXRhU2V0LnBvaW50c1t0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzWzBdXS5tZXRhZGF0YVxuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5tZXRhZGF0YUNhcmQudXBkYXRlTWV0YWRhdGEobnVsbCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG5vIHBvaW50cyBzZWxlY3RlZFxuICAgICAgICB0aGlzLm1ldGFkYXRhQ2FyZC51cGRhdGVNZXRhZGF0YShudWxsKTsgLy8gY2xlYXIgbWV0YWRhdGFcbiAgICAgIH1cbiAgICAgIHRoaXMuaW5zcGVjdG9yUGFuZWwudXBkYXRlQm91bmRpbmdCb3hTZWxlY3Rpb24obmV3U2VsZWN0ZWRQb2ludEluZGljZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBub3JtYWwgc2VsZWN0aW9uIG1vZGVcbiAgICAgIHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMgPSBuZXdTZWxlY3RlZFBvaW50SW5kaWNlcztcbiAgICAgIGlmIChuZXdTZWxlY3RlZFBvaW50SW5kaWNlcy5sZW5ndGggPT09IDEgJiYgdGhpcy5kYXRhU2V0LnBvaW50c1tuZXdTZWxlY3RlZFBvaW50SW5kaWNlc1swXV0ubWV0YWRhdGEubGFiZWwgIT0gXCJiYWNrZ3JvdW5kXCIpIHtcbiAgICAgICAgLypcbiAgICAgICAgbmVpZ2hib3JzID0gdGhpcy5kYXRhU2V0LmZpbmROZWlnaGJvcnMoXG4gICAgICAgICAgbmV3U2VsZWN0ZWRQb2ludEluZGljZXNbMF0sXG4gICAgICAgICAgdGhpcy5pbnNwZWN0b3JQYW5lbC5kaXN0RnVuYyxcbiAgICAgICAgICB0aGlzLmluc3BlY3RvclBhbmVsLm51bU5OXG4gICAgICAgICk7Ki9cbiAgICAgICAgaWYgKHRoaXMuZGF0YVNldC5wb2ludHNbbmV3U2VsZWN0ZWRQb2ludEluZGljZXNbMF1dLm1ldGFkYXRhLmxhYmVsICE9IFwiYmFja2dyb3VuZFwiKVxuICAgICAgICAgIG5laWdoYm9yc1swXSA9IHtcbiAgICAgICAgICAgIGluZGV4OiBuZXdTZWxlY3RlZFBvaW50SW5kaWNlc1swXSxcbiAgICAgICAgICAgIGRpc3Q6IDBcbiAgICAgICAgICB9O1xuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm1ldGFkYXRhQ2FyZC51cGRhdGVNZXRhZGF0YShudWxsKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5zZWxlY3Rpb25DaGFuZ2VkTGlzdGVuZXJzLmZvckVhY2goKGwpID0+XG4gICAgICBsKHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMsIG5laWdoYm9ycylcbiAgICApO1xuICB9XG4gIHVwZGF0ZU1ldGFEYXRhQnlJbmRpY2VzKGluZGljZXM6IG51bWJlciwgc3JjOiBzdHJpbmcpIHtcbiAgICBpZiAoaW5kaWNlcyA9PT0gLTEpIHtcbiAgICAgIHRoaXMubWV0YWRhdGFDYXJkLnVwZGF0ZU1ldGFkYXRhKG51bGwpO1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGNvbnNvbGUubG9nKCdidWJ1YnVidWJ1dXUgaGVyZScpXG4gICAgdGhpcy5tZXRhZGF0YUNhcmQudXBkYXRlTWV0YWRhdGEoXG4gICAgICB0aGlzLmRhdGFTZXQucG9pbnRzW2luZGljZXNdLm1ldGFkYXRhLCBzcmMsIHRoaXMuZGF0YVNldC5wb2ludHNbaW5kaWNlc11cbiAgICApO1xuICB9XG5cbiAgdXBkYXRlTWV0YUJ5SW5kaWNlcyhpbmRpY2VzOiBudW1iZXIpIHtcbiAgICBpZiAoaW5kaWNlcyA9PT0gLTEpIHtcbiAgICAgIHRoaXMubWV0YWRhdGFDYXJkLnVwZGF0ZU1ldGFkYXRhKG51bGwpO1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIHRoaXMuZGF0YVNldC5nZXRTcHJpdGVJbWFnZShpbmRpY2VzLCAoaW1nRGF0YTogYW55KSA9PiB7XG4gICAgICBsZXQgc3JjID0gaW1nRGF0YS5pbWdVcmxcbiAgICAgIHRoaXMubWV0YWRhdGFDYXJkLnVwZGF0ZU1ldGFkYXRhKFxuICAgICAgICB0aGlzLmRhdGFTZXQucG9pbnRzW2luZGljZXNdLm1ldGFkYXRhLCBzcmMsIHRoaXMuZGF0YVNldC5wb2ludHNbaW5kaWNlc10sIGluZGljZXNcbiAgICAgICk7XG4gICAgfSlcbiAgfVxuICAvKipcbiAgICogUmVnaXN0ZXJzIGEgbGlzdGVuZXIgdG8gYmUgY2FsbGVkIGFueSB0aW1lIHRoZSBtb3VzZSBob3ZlcnMgb3ZlciBhIHBvaW50LlxuICAgKi9cbiAgcmVnaXN0ZXJIb3Zlckxpc3RlbmVyKGxpc3RlbmVyOiBIb3Zlckxpc3RlbmVyKSB7XG4gICAgdGhpcy5ob3Zlckxpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcbiAgfVxuICAvKipcbiAgICogVXNlZCBieSBjbGllbnRzIHRvIGluZGljYXRlIHRoYXQgYSBob3ZlciBpcyBvY2N1cnJpbmcuXG4gICAqL1xuICBwcml2YXRlIHRpbWVyID0gbnVsbFxuICBub3RpZnlIb3Zlck92ZXJQb2ludChwb2ludEluZGV4OiBudW1iZXIpIHtcbiAgICB0aGlzLmhvdmVyTGlzdGVuZXJzLmZvckVhY2goKGwpID0+IGwocG9pbnRJbmRleCkpO1xuICAgIGxldCB0aW1lTm93ID0gbmV3IERhdGUoKS5nZXRUaW1lKClcbiAgICBpZiAodGhpcy50aW1lciA9PT0gbnVsbCB8fCB0aW1lTm93IC0gdGhpcy50aW1lciA+IDEwKSB7XG4gICAgICBpZiAod2luZG93Lml0ZXJhdGlvbiAmJiBwb2ludEluZGV4ICE9PSB1bmRlZmluZWQgJiYgcG9pbnRJbmRleCAhPT0gbnVsbCAmJiB3aW5kb3cucHJldmlvdXNIb3ZlciAhPT0gcG9pbnRJbmRleCkge1xuICAgICAgICB0aGlzLnRpbWVyID0gdGltZU5vd1xuICAgICAgICB0aGlzLnVwZGF0ZU1ldGFCeUluZGljZXMocG9pbnRJbmRleClcbiAgICAgICAgd2luZG93LnByZXZpb3VzSG92ZXIgPSBwb2ludEluZGV4XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJlZ2lzdGVyUHJvamVjdGlvbkNoYW5nZWRMaXN0ZW5lcihsaXN0ZW5lcjogUHJvamVjdGlvbkNoYW5nZWRMaXN0ZW5lcikge1xuICAgIHRoaXMucHJvamVjdGlvbkNoYW5nZWRMaXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG4gIH1cbiAgbm90aWZ5UHJvamVjdGlvbkNoYW5nZWQocHJvamVjdGlvbjogUHJvamVjdGlvbikge1xuICAgIHRoaXMucHJvamVjdGlvbkNoYW5nZWRMaXN0ZW5lcnMuZm9yRWFjaCgobCkgPT4gbChwcm9qZWN0aW9uKSk7XG4gIH1cbiAgcmVnaXN0ZXJEaXN0YW5jZU1ldHJpY0NoYW5nZWRMaXN0ZW5lcihsOiBEaXN0YW5jZU1ldHJpY0NoYW5nZWRMaXN0ZW5lcikge1xuICAgIHRoaXMuZGlzdGFuY2VNZXRyaWNDaGFuZ2VkTGlzdGVuZXJzLnB1c2gobCk7XG4gIH1cbiAgbm90aWZ5RGlzdGFuY2VNZXRyaWNDaGFuZ2VkKGRpc3RNZXRyaWM6IERpc3RhbmNlRnVuY3Rpb24pIHtcbiAgICB0aGlzLmRpc3RhbmNlTWV0cmljQ2hhbmdlZExpc3RlbmVycy5mb3JFYWNoKChsKSA9PiBsKGRpc3RNZXRyaWMpKTtcbiAgfVxuXG4gIEBvYnNlcnZlKCdkYXRhUHJvdG8nKVxuICBfZGF0YVByb3RvQ2hhbmdlZChkYXRhUHJvdG9TdHJpbmc6IHN0cmluZykge1xuICAgIGxldCBkYXRhUHJvdG8gPSBkYXRhUHJvdG9TdHJpbmdcbiAgICAgID8gKEpTT04ucGFyc2UoZGF0YVByb3RvU3RyaW5nKSBhcyBEYXRhUHJvdG8pXG4gICAgICA6IG51bGw7XG4gICAgdGhpcy5pbml0aWFsaXplRGF0YVByb3ZpZGVyKGRhdGFQcm90byk7XG4gIH1cbiAgcHJpdmF0ZSBtYWtlRGVmYXVsdFBvaW50c0luZm9BbmRTdGF0cyhcbiAgICBwb2ludHM6IERhdGFQb2ludFtdXG4gICk6IFtQb2ludE1ldGFkYXRhW10sIENvbHVtblN0YXRzW11dIHtcbiAgICBsZXQgcG9pbnRzSW5mbzogUG9pbnRNZXRhZGF0YVtdID0gW107XG4gICAgcG9pbnRzLmZvckVhY2goKHApID0+IHtcbiAgICAgIGxldCBwb2ludEluZm86IFBvaW50TWV0YWRhdGEgPSB7fTtcbiAgICAgIHBvaW50SW5mb1tJTkRFWF9NRVRBREFUQV9GSUVMRF0gPSBwLmluZGV4O1xuICAgICAgcG9pbnRzSW5mby5wdXNoKHBvaW50SW5mbyk7XG4gICAgfSk7XG4gICAgbGV0IHN0YXRzOiBDb2x1bW5TdGF0c1tdID0gW1xuICAgICAge1xuICAgICAgICBuYW1lOiBJTkRFWF9NRVRBREFUQV9GSUVMRCxcbiAgICAgICAgaXNOdW1lcmljOiBmYWxzZSxcbiAgICAgICAgdG9vTWFueVVuaXF1ZVZhbHVlczogdHJ1ZSxcbiAgICAgICAgbWluOiAwLFxuICAgICAgICBtYXg6IHBvaW50c0luZm8ubGVuZ3RoIC0gMSxcbiAgICAgIH0sXG4gICAgXTtcbiAgICByZXR1cm4gW3BvaW50c0luZm8sIHN0YXRzXTtcbiAgfVxuICBwcml2YXRlIGluaXRpYWxpemVEYXRhUHJvdmlkZXIoZGF0YVByb3RvPzogRGF0YVByb3RvKSB7XG4gICAgaWYgKHRoaXMuc2VydmluZ01vZGUgPT09ICdkZW1vJykge1xuICAgICAgbGV0IHByb2plY3RvckNvbmZpZ1VybDogc3RyaW5nO1xuICAgICAgLy8gT25seSBpbiBkZW1vIG1vZGUgZG8gd2UgYWxsb3cgdGhlIGNvbmZpZyBiZWluZyBwYXNzZWQgdmlhIFVSTC5cbiAgICAgIGxldCB1cmxQYXJhbXMgPSB1dGlsLmdldFVSTFBhcmFtcyhpbml0aWFsVVJMUXVlcnlTdHJpbmcpO1xuICAgICAgaWYgKCdjb25maWcnIGluIHVybFBhcmFtcykge1xuICAgICAgICBwcm9qZWN0b3JDb25maWdVcmwgPSB1cmxQYXJhbXNbJ2NvbmZpZyddO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHJvamVjdG9yQ29uZmlnVXJsID0gdGhpcy5wcm9qZWN0b3JDb25maWdKc29uUGF0aDtcbiAgICAgIH1cbiAgICAgIHRoaXMuZGF0YVByb3ZpZGVyID0gbmV3IERlbW9EYXRhUHJvdmlkZXIocHJvamVjdG9yQ29uZmlnVXJsKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuc2VydmluZ01vZGUgPT09ICdzZXJ2ZXInKSB7XG4gICAgICBpZiAoIXRoaXMucm91dGVQcmVmaXgpIHtcbiAgICAgICAgdGhyb3cgJ3JvdXRlLXByZWZpeCBpcyBhIHJlcXVpcmVkIHBhcmFtZXRlcic7XG4gICAgICB9XG4gICAgICB0aGlzLmRhdGFQcm92aWRlciA9IG5ldyBTZXJ2ZXJEYXRhUHJvdmlkZXIodGhpcy5yb3V0ZVByZWZpeCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLnNlcnZpbmdNb2RlID09PSAncHJvdG8nICYmIGRhdGFQcm90byAhPSBudWxsKSB7XG4gICAgICB0aGlzLmRhdGFQcm92aWRlciA9IG5ldyBQcm90b0RhdGFQcm92aWRlcihkYXRhUHJvdG8pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgY29tcG9uZW50IGlzIG5vdCByZWFkeSB5ZXQgLSB3YWl0aW5nIGZvciB0aGUgZGF0YVByb3RvIGZpZWxkLlxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmRhdGFQYW5lbC5pbml0aWFsaXplKHRoaXMsIHRoaXMuZGF0YVByb3ZpZGVyKTtcbiAgfVxuICBwcml2YXRlIGdldExlZ2VuZFBvaW50Q29sb3JlcihcbiAgICBjb2xvck9wdGlvbjogQ29sb3JPcHRpb25cbiAgKTogKGRzOiBEYXRhU2V0LCBpbmRleDogbnVtYmVyKSA9PiBzdHJpbmcge1xuICAgIGlmIChjb2xvck9wdGlvbiA9PSBudWxsIHx8IGNvbG9yT3B0aW9uLm1hcCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgY29sb3JlciA9IChkczogRGF0YVNldCwgaTogbnVtYmVyKSA9PiB7XG4gICAgICBsZXQgdmFsdWUgPSBkcy5wb2ludHNbaV0ubWV0YWRhdGFbdGhpcy5zZWxlY3RlZENvbG9yT3B0aW9uLm5hbWVdO1xuICAgICAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIFBPSU5UX0NPTE9SX01JU1NJTkc7XG4gICAgICB9XG4gICAgICByZXR1cm4gZHMucG9pbnRzW2ldLmNvbG9yO1xuICAgICAgLy9yZXR1cm4gY29sb3JPcHRpb24ubWFwKHZhbHVlKTtcbiAgICB9O1xuICAgIHJldHVybiBjb2xvcmVyO1xuICB9XG4gIHByaXZhdGUgZ2V0M0RMYWJlbE1vZGVCdXR0b24oKTogYW55IHtcbiAgICByZXR1cm4gdGhpcy4kJCgnI2xhYmVsczNETW9kZScpO1xuICB9XG4gIHByaXZhdGUgZ2V0M0RMYWJlbE1vZGUoKTogYm9vbGVhbiB7XG4gICAgY29uc3QgbGFiZWwzRE1vZGVCdXR0b24gPSB0aGlzLmdldDNETGFiZWxNb2RlQnV0dG9uKCk7XG4gICAgcmV0dXJuIChsYWJlbDNETW9kZUJ1dHRvbiBhcyBhbnkpLmFjdGl2ZTtcbiAgfVxuICBhZGp1c3RTZWxlY3Rpb25BbmRIb3ZlcihzZWxlY3RlZFBvaW50SW5kaWNlczogbnVtYmVyW10sIGhvdmVySW5kZXg/OiBudW1iZXIpIHtcbiAgICB0aGlzLm5vdGlmeVNlbGVjdGlvbkNoYW5nZWQoc2VsZWN0ZWRQb2ludEluZGljZXMpO1xuICAgIHRoaXMubm90aWZ5SG92ZXJPdmVyUG9pbnQoaG92ZXJJbmRleCk7XG4gICAgdGhpcy5zZXRNb3VzZU1vZGUoTW91c2VNb2RlLkNBTUVSQV9BTkRfQ0xJQ0tfU0VMRUNUKTtcbiAgfVxuICBzZXRNb3VzZU1vZGUobW91c2VNb2RlOiBNb3VzZU1vZGUpIHtcbiAgICBsZXQgc2VsZWN0TW9kZUJ1dHRvbiA9IHRoaXMuJCQoJyNzZWxlY3RNb2RlJyk7XG4gICAgKHNlbGVjdE1vZGVCdXR0b24gYXMgYW55KS5hY3RpdmUgPSBtb3VzZU1vZGUgPT09IE1vdXNlTW9kZS5BUkVBX1NFTEVDVDtcbiAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5zY2F0dGVyUGxvdC5zZXRNb3VzZU1vZGUobW91c2VNb2RlKTtcbiAgfVxuICBwcml2YXRlIHNldEN1cnJlbnREYXRhU2V0KGRzOiBEYXRhU2V0KSB7XG4gICAgdGhpcy5hZGp1c3RTZWxlY3Rpb25BbmRIb3ZlcihbXSk7XG4gICAgaWYgKHRoaXMuZGF0YVNldCAhPSBudWxsKSB7XG4gICAgICB0aGlzLmRhdGFTZXQuc3RvcFRTTkUoKTtcbiAgICB9XG4gICAgaWYgKGRzICE9IG51bGwgJiYgdGhpcy5ub3JtYWxpemVEYXRhKSB7XG4gICAgICBkcy5ub3JtYWxpemUoKTtcbiAgICB9XG4gICAgdGhpcy5kaW0gPSBkcyA9PSBudWxsID8gMCA6IGRzLmRpbVsxXTtcbiAgICAodGhpcy4kJCgnc3Bhbi5udW1EYXRhUG9pbnRzJykgYXMgSFRNTFNwYW5FbGVtZW50KS5pbm5lclRleHQgPVxuICAgICAgZHMgPT0gbnVsbCA/ICcwJyA6ICcnICsgZHMuZGltWzBdO1xuICAgICh0aGlzLiQkKCdzcGFuLmRpbScpIGFzIEhUTUxTcGFuRWxlbWVudCkuaW5uZXJUZXh0ID1cbiAgICAgIGRzID09IG51bGwgPyAnMCcgOiAnJyArIGRzLmRpbVsxXTtcbiAgICB0aGlzLmRhdGFTZXQgPSBkcztcbiAgICB0aGlzLnByb2plY3Rpb25zUGFuZWwuZGF0YVNldFVwZGF0ZWQoXG4gICAgICB0aGlzLmRhdGFTZXQsXG4gICAgICB0aGlzLm9yaWdpbmFsRGF0YVNldCxcbiAgICAgIHRoaXMuZGltXG4gICAgKTtcbiAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5zZXREYXRhU2V0KHRoaXMuZGF0YVNldCk7XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIuc2NhdHRlclBsb3Quc2V0Q2FtZXJhUGFyYW1ldGVyc0Zvck5leHRDYW1lcmFDcmVhdGlvbihcbiAgICAgIG51bGwsXG4gICAgICB0cnVlXG4gICAgKTtcbiAgfVxuICBwcml2YXRlIHNldHVwVUlDb250cm9scygpIHtcbiAgICAvLyBWaWV3IGNvbnRyb2xzXG4gICAgdGhpcy5oZWxwQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgKHRoaXMuJC5oZWxwM2REaWFsb2cgYXMgYW55KS5vcGVuKCk7XG4gICAgfSlcbiAgICB0aGlzLiQkKCcjcmVzZXQtem9vbScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIuc2NhdHRlclBsb3QucmVzZXRab29tKCk7XG4gICAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5zY2F0dGVyUGxvdC5zdGFydE9yYml0QW5pbWF0aW9uKCk7XG4gICAgfSk7XG4gICAgbGV0IHNlbGVjdE1vZGVCdXR0b24gPSB0aGlzLiQkKCcjc2VsZWN0TW9kZScpO1xuICAgIHNlbGVjdE1vZGVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgICAgIHRoaXMuc2V0TW91c2VNb2RlKFxuICAgICAgICAoc2VsZWN0TW9kZUJ1dHRvbiBhcyBhbnkpLmFjdGl2ZVxuICAgICAgICAgID8gTW91c2VNb2RlLkFSRUFfU0VMRUNUXG4gICAgICAgICAgOiBNb3VzZU1vZGUuQ0FNRVJBX0FORF9DTElDS19TRUxFQ1RcbiAgICAgICk7XG4gICAgfSk7XG4gICAgbGV0IG5pZ2h0TW9kZUJ1dHRvbiA9IHRoaXMuJCQoJyNuaWdodERheU1vZGUnKTtcbiAgICBuaWdodE1vZGVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5zY2F0dGVyUGxvdC5zZXREYXlOaWdodE1vZGUoXG4gICAgICAgIChuaWdodE1vZGVCdXR0b24gYXMgYW55KS5hY3RpdmVcbiAgICAgICk7XG4gICAgfSk7XG4gICAgbGV0IGhpZGRlbkJhY2tncm91bmQgPSB0aGlzLiQkKCcjaGlkZGVuQmFja2dyb3VuZCcpO1xuICAgIGhpZGRlbkJhY2tncm91bmQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICB3aW5kb3cuaGlkZGVuQmFja2dyb3VuZCA9IChoaWRkZW5CYWNrZ3JvdW5kIGFzIGFueSkuYWN0aXZlXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZGF0YVNldC5wb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgcG9pbnQgPSB0aGlzLmRhdGFTZXQucG9pbnRzW2ldO1xuICAgICAgICBpZiAocG9pbnQubWV0YWRhdGFbdGhpcy5zZWxlY3RlZExhYmVsT3B0aW9uXSkge1xuICAgICAgICAgIGxldCBob3ZlclRleHQgPSBwb2ludC5tZXRhZGF0YVt0aGlzLnNlbGVjdGVkTGFiZWxPcHRpb25dLnRvU3RyaW5nKCk7XG4gICAgICAgICAgaWYgKGhvdmVyVGV4dCA9PSAnYmFja2dyb3VuZCcpIHtcbiAgICAgICAgICAgIGlmICgoaGlkZGVuQmFja2dyb3VuZCBhcyBhbnkpLmFjdGl2ZSkge1xuICAgICAgICAgICAgICAvLyB3aW5kb3cuc2NlbmUucmVtb3ZlKHdpbmRvdy5iYWNrZ3JvdW5kTWVzaClcbiAgICAgICAgICAgICAgcG9pbnQuY29sb3IgPSAnI2ZmZmZmZidcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBvaW50LmNvbG9yID0gcG9pbnQuRFZJX2NvbG9yWzFdXG4gICAgICAgICAgICAgIC8vIHdpbmRvdy5zY2VuZS5hZGQod2luZG93LmJhY2tncm91bmRNZXNoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gaWYod2luZG93LnNjZW5lLmNoaWxkcmVuKVxuICAgICAgaWYgKHdpbmRvdy5zY2VuZS5jaGlsZHJlblsyXSAmJiB3aW5kb3cuc2NlbmUuY2hpbGRyZW5bMl0udHlwZSA9PT0gJ01lc2gnKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAyOyBpIDwgd2luZG93LnNjZW5lLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgd2luZG93LnNjZW5lLmNoaWxkcmVuW2ldLnZpc2libGUgPSAhd2luZG93LmhpZGRlbkJhY2tncm91bmRcbiAgICAgICAgfVxuXG4gICAgICB9XG4gICAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5zY2F0dGVyUGxvdC5yZW5kZXIoKVxuICAgICAgLy8gdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIuc2NhdHRlclBsb3QuaGlkZGVuQmFja2dyb3VuZChcbiAgICAgIC8vICAgKGhpZGRlbkJhY2tncm91bmQgYXMgYW55KS5hY3RpdmUsXG4gICAgICAvLyApO1xuICAgIH0pXG5cbiAgICBsZXQgZWRpdE1vZGVCdXR0b24gPSB0aGlzLiQkKCcjZWRpdE1vZGUnKTtcbiAgICBlZGl0TW9kZUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICAgICAgdGhpcy5lZGl0TW9kZSA9IChlZGl0TW9kZUJ1dHRvbiBhcyBhbnkpLmFjdGl2ZTtcbiAgICB9KTtcbiAgICBjb25zdCBsYWJlbHMzRE1vZGVCdXR0b24gPSB0aGlzLmdldDNETGFiZWxNb2RlQnV0dG9uKCk7XG4gICAgbGFiZWxzM0RNb2RlQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIuc2V0M0RMYWJlbE1vZGUodGhpcy5nZXQzRExhYmVsTW9kZSgpKTtcbiAgICB9KTtcbiAgICAvL1xuICAgIGxldCB0cmlhbmdsZU1vZGVCdG4gPSB0aGlzLiQkKFwiI3RyaWFuZ2xlTW9kZVwiKTtcbiAgICB0cmlhbmdsZU1vZGVCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5zZXRUcmlhbmdsZU1vZGUoKHRyaWFuZ2xlTW9kZUJ0biBhcyBhbnkpLmFjdGl2ZSlcbiAgICB9KVxuXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsICgpID0+IHtcbiAgICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnJlc2l6ZSgpO1xuICAgIH0pO1xuICAgIHtcbiAgICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyID0gbmV3IFByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlcihcbiAgICAgICAgdGhpcy5nZXRTY2F0dGVyQ29udGFpbmVyKCksXG4gICAgICAgIHRoaXMgYXMgUHJvamVjdG9yRXZlbnRDb250ZXh0XG4gICAgICApO1xuICAgICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIuc2V0TGFiZWxQb2ludEFjY2Vzc29yKFxuICAgICAgICB0aGlzLnNlbGVjdGVkTGFiZWxPcHRpb25cbiAgICAgICk7XG4gICAgfVxuICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnNjYXR0ZXJQbG90Lm9uQ2FtZXJhTW92ZShcbiAgICAgIChjYW1lcmFQb3NpdGlvbjogVEhSRUUuVmVjdG9yMywgY2FtZXJhVGFyZ2V0OiBUSFJFRS5WZWN0b3IzKSA9PlxuICAgICAgICB0aGlzLmJvb2ttYXJrUGFuZWwuY2xlYXJTdGF0ZVNlbGVjdGlvbigpXG4gICAgKTtcbiAgICB0aGlzLnJlZ2lzdGVySG92ZXJMaXN0ZW5lcigoaG92ZXJJbmRleDogbnVtYmVyKSA9PiB7XG4gICAgICB0aGlzLm9uSG92ZXIoaG92ZXJJbmRleClcbiAgICB9XG5cbiAgICApO1xuICAgIHRoaXMucmVnaXN0ZXJQcm9qZWN0aW9uQ2hhbmdlZExpc3RlbmVyKChwcm9qZWN0aW9uOiBQcm9qZWN0aW9uKSA9PlxuICAgICAgdGhpcy5vblByb2plY3Rpb25DaGFuZ2VkKHByb2plY3Rpb24pXG4gICAgKTtcbiAgICB0aGlzLnJlZ2lzdGVyU2VsZWN0aW9uQ2hhbmdlZExpc3RlbmVyKFxuICAgICAgKFxuICAgICAgICBzZWxlY3RlZFBvaW50SW5kaWNlczogbnVtYmVyW10sXG4gICAgICAgIG5laWdoYm9yc09mRmlyc3RQb2ludDoga25uLk5lYXJlc3RFbnRyeVtdXG4gICAgICApID0+IHRoaXMub25TZWxlY3Rpb25DaGFuZ2VkKHNlbGVjdGVkUG9pbnRJbmRpY2VzLCBuZWlnaGJvcnNPZkZpcnN0UG9pbnQpXG4gICAgKTtcbiAgfVxuICBwcml2YXRlIG9uSG92ZXIoaG92ZXJJbmRleDogbnVtYmVyKSB7XG4gICAgdGhpcy5ob3ZlclBvaW50SW5kZXggPSBob3ZlckluZGV4O1xuICAgIGxldCBob3ZlclRleHQgPSBudWxsO1xuICAgIGlmIChob3ZlckluZGV4ICE9IG51bGwpIHtcbiAgICAgIGNvbnN0IHBvaW50ID0gdGhpcy5kYXRhU2V0LnBvaW50c1tob3ZlckluZGV4XTtcbiAgICAgIGlmIChwb2ludC5tZXRhZGF0YVt0aGlzLnNlbGVjdGVkTGFiZWxPcHRpb25dKSB7XG4gICAgICAgIGhvdmVyVGV4dCA9IHBvaW50Lm1ldGFkYXRhW3RoaXMuc2VsZWN0ZWRMYWJlbE9wdGlvbl0udG9TdHJpbmcoKTtcblxuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuc3RhdHVzQmFyLnN0eWxlLmRpc3BsYXkgPSBob3ZlclRleHQgPyBudWxsIDogJ25vbmUnO1xuICAgICAgdGhpcy5zdGF0dXNCYXIuaW5uZXJUZXh0ID0gaG92ZXJUZXh0O1xuICAgIH1cbiAgfVxuICBwcml2YXRlIGdldFNjYXR0ZXJDb250YWluZXIoKTogSFRNTERpdkVsZW1lbnQge1xuICAgIHJldHVybiB0aGlzLiQkKCcjc2NhdHRlcicpIGFzIEhUTUxEaXZFbGVtZW50O1xuICB9XG4gIHByaXZhdGUgb25TZWxlY3Rpb25DaGFuZ2VkKFxuICAgIHNlbGVjdGVkUG9pbnRJbmRpY2VzOiBudW1iZXJbXSxcbiAgICBuZWlnaGJvcnNPZkZpcnN0UG9pbnQ6IGtubi5OZWFyZXN0RW50cnlbXVxuICApIHtcbiAgICB0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzID0gc2VsZWN0ZWRQb2ludEluZGljZXM7XG4gICAgdGhpcy5uZWlnaGJvcnNPZkZpcnN0UG9pbnQgPSBuZWlnaGJvcnNPZkZpcnN0UG9pbnQ7XG4gICAgdGhpcy5kYXRhUGFuZWwub25Qcm9qZWN0b3JTZWxlY3Rpb25DaGFuZ2VkKFxuICAgICAgc2VsZWN0ZWRQb2ludEluZGljZXMsXG4gICAgICBuZWlnaGJvcnNPZkZpcnN0UG9pbnRcbiAgICApO1xuICAgIGxldCB0b3RhbE51bVBvaW50cyA9XG4gICAgICB0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzLmxlbmd0aCArIG5laWdoYm9yc09mRmlyc3RQb2ludC5sZW5ndGg7XG4gICAgdGhpcy5zdGF0dXNCYXIuaW5uZXJUZXh0ID0gYFNlbGVjdGVkICR7dG90YWxOdW1Qb2ludHN9IHBvaW50c2A7XG4gICAgdGhpcy5zdGF0dXNCYXIuc3R5bGUuZGlzcGxheSA9IHRvdGFsTnVtUG9pbnRzID4gMCA/IG51bGwgOiAnbm9uZSc7XG4gIH1cbiAgb25Qcm9qZWN0aW9uQ2hhbmdlZChwcm9qZWN0aW9uPzogUHJvamVjdGlvbikge1xuICAgIHRoaXMuZGF0YVBhbmVsLnByb2plY3Rpb25DaGFuZ2VkKHByb2plY3Rpb24pO1xuICAgIHRoaXMudXBkYXRlQmFja2dyb3VuZEltZygpXG4gICAgdGhpcy5pbnNwZWN0b3JQYW5lbC5jbGVhclF1ZXJ5UmVzTGlzdCgpO1xuICAgIHRoaXMubm90aWZ5U2VsZWN0aW9uQ2hhbmdlZChbXSk7XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIucmVuZGVyKCk7XG4gIH1cbiAgc2V0UHJvamVjdGlvbihwcm9qZWN0aW9uOiBQcm9qZWN0aW9uKSB7XG4gICAgdGhpcy5wcm9qZWN0aW9uID0gcHJvamVjdGlvbjtcbiAgICBpZiAocHJvamVjdGlvbiAhPSBudWxsKSB7XG4gICAgICB0aGlzLmFuYWx5dGljc0xvZ2dlci5sb2dQcm9qZWN0aW9uQ2hhbmdlZChwcm9qZWN0aW9uLnByb2plY3Rpb25UeXBlKTtcbiAgICB9XG4gICAgdGhpcy5ub3RpZnlQcm9qZWN0aW9uQ2hhbmdlZChwcm9qZWN0aW9uKTtcbiAgfVxuICAvLyBub3RpZnlQcm9qZWN0aW9uUG9zaXRpb25zVXBkYXRlZChuZXdTZWxlY3Rpb24/OiBhbnlbXSkge1xuICAvLyAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLm5vdGlmeVByb2plY3Rpb25Qb3NpdGlvbnNVcGRhdGVkKG5ld1NlbGVjdGlvbik7XG4gIC8vIH1cbiAgbm90aWZ5UHJvamVjdGlvblBvc2l0aW9uc1VwZGF0ZWQoKSB7XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIubm90aWZ5UHJvamVjdGlvblBvc2l0aW9uc1VwZGF0ZWQoKTtcbiAgICB0aGlzLm1ldGFkYXRhQ2FyZC51cGRhdGVDdXN0b21MaXN0KHRoaXMuZGF0YVNldC5wb2ludHMsIHRoaXMgYXMgUHJvamVjdG9yRXZlbnRDb250ZXh0KVxuICAgIHRoaXMubWV0YWRhdGFDYXJkLnVwZGF0ZVJlamVjdExpc3QodGhpcy5kYXRhU2V0LnBvaW50cywgdGhpcyBhcyBQcm9qZWN0b3JFdmVudENvbnRleHQpXG4gIH1cblxuICBoaWRkZW5PclNob3dTY2F0dGVyKHR5cGU6IHN0cmluZykge1xuICAgIGxldCBkb20gPSB0aGlzLiQkKCcjc2NhdHRlcicpIGFzIEhUTUxFbGVtZW50XG4gICAgZG9tLnN0eWxlLnZpc2liaWxpdHkgPSB0eXBlXG4gICAgaWYgKHR5cGUgPT09ICcnKSB7XG4gICAgICB0aGlzLl9zaG93Tm90QXZhbGlhYmxlID0gZmFsc2VcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc2hvd05vdEF2YWxpYWJsZSA9IHRydWVcbiAgICB9XG4gIH1cbiAgcmVmcmVzaG5vaXN5QnRuKCl7XG4gICAgdGhpcy5pbnNwZWN0b3JQYW5lbC5yZWZyZXNoQnRuU3R5bGUoKVxuICB9XG4gIC8qKlxuICAgKiBHZXRzIHRoZSBjdXJyZW50IHZpZXcgb2YgdGhlIGVtYmVkZGluZyBhbmQgc2F2ZXMgaXQgYXMgYSBTdGF0ZSBvYmplY3QuXG4gICAqL1xuICBnZXRDdXJyZW50U3RhdGUoKTogU3RhdGUge1xuICAgIGNvbnN0IHN0YXRlID0gbmV3IFN0YXRlKCk7XG4gICAgLy8gU2F2ZSB0aGUgaW5kaXZpZHVhbCBkYXRhcG9pbnQgcHJvamVjdGlvbnMuXG4gICAgc3RhdGUucHJvamVjdGlvbnMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZGF0YVNldC5wb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHBvaW50ID0gdGhpcy5kYXRhU2V0LnBvaW50c1tpXTtcbiAgICAgIGNvbnN0IHByb2plY3Rpb25zOiB7XG4gICAgICAgIFtrZXk6IHN0cmluZ106IG51bWJlcjtcbiAgICAgIH0gPSB7fTtcbiAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhwb2ludC5wcm9qZWN0aW9ucyk7XG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGtleXMubGVuZ3RoOyArK2opIHtcbiAgICAgICAgcHJvamVjdGlvbnNba2V5c1tqXV0gPSBwb2ludC5wcm9qZWN0aW9uc1trZXlzW2pdXTtcbiAgICAgIH1cbiAgICAgIHN0YXRlLnByb2plY3Rpb25zLnB1c2gocHJvamVjdGlvbnMpO1xuICAgIH1cbiAgICBzdGF0ZS5zZWxlY3RlZFByb2plY3Rpb24gPSB0aGlzLnByb2plY3Rpb24ucHJvamVjdGlvblR5cGU7XG4gICAgc3RhdGUuZGF0YVNldERpbWVuc2lvbnMgPSB0aGlzLmRhdGFTZXQuZGltO1xuICAgIHN0YXRlLnRTTkVJdGVyYXRpb24gPSB0aGlzLmRhdGFTZXQudFNORUl0ZXJhdGlvbjtcbiAgICBzdGF0ZS5zZWxlY3RlZFBvaW50cyA9IHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXM7XG4gICAgc3RhdGUuZmlsdGVyZWRQb2ludHMgPSB0aGlzLmRhdGFTZXRGaWx0ZXJJbmRpY2VzO1xuICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnBvcHVsYXRlQm9va21hcmtGcm9tVUkoc3RhdGUpO1xuICAgIHN0YXRlLnNlbGVjdGVkQ29sb3JPcHRpb25OYW1lID0gdGhpcy5kYXRhUGFuZWwuc2VsZWN0ZWRDb2xvck9wdGlvbk5hbWU7XG4gICAgc3RhdGUuZm9yY2VDYXRlZ29yaWNhbENvbG9yaW5nID0gdGhpcy5kYXRhUGFuZWwuZm9yY2VDYXRlZ29yaWNhbENvbG9yaW5nO1xuICAgIHN0YXRlLnNlbGVjdGVkTGFiZWxPcHRpb24gPSB0aGlzLnNlbGVjdGVkTGFiZWxPcHRpb247XG4gICAgdGhpcy5wcm9qZWN0aW9uc1BhbmVsLnBvcHVsYXRlQm9va21hcmtGcm9tVUkoc3RhdGUpO1xuICAgIHJldHVybiBzdGF0ZTtcbiAgfVxuICAvKiogTG9hZHMgYSBTdGF0ZSBvYmplY3QgaW50byB0aGUgd29ybGQuICovXG4gIGxvYWRTdGF0ZShzdGF0ZTogU3RhdGUpIHtcbiAgICB0aGlzLnNldFByb2plY3Rpb24obnVsbCk7XG4gICAge1xuICAgICAgdGhpcy5wcm9qZWN0aW9uc1BhbmVsLmRpc2FibGVQb2x5bWVyQ2hhbmdlc1RyaWdnZXJSZXByb2plY3Rpb24oKTtcbiAgICAgIGlmICh0aGlzLmRhdGFTZXRCZWZvcmVGaWx0ZXIgIT0gbnVsbCkge1xuICAgICAgICB0aGlzLnJlc2V0RmlsdGVyRGF0YXNldCgpO1xuICAgICAgfVxuICAgICAgaWYgKHN0YXRlLmZpbHRlcmVkUG9pbnRzICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5maWx0ZXJEYXRhc2V0KHN0YXRlLmZpbHRlcmVkUG9pbnRzKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucHJvamVjdGlvbnNQYW5lbC5lbmFibGVQb2x5bWVyQ2hhbmdlc1RyaWdnZXJSZXByb2plY3Rpb24oKTtcbiAgICB9XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGF0ZS5wcm9qZWN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgcG9pbnQgPSB0aGlzLmRhdGFTZXQucG9pbnRzW2ldO1xuICAgICAgY29uc3QgcHJvamVjdGlvbiA9IHN0YXRlLnByb2plY3Rpb25zW2ldO1xuICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHByb2plY3Rpb24pO1xuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBrZXlzLmxlbmd0aDsgKytqKSB7XG4gICAgICAgIHBvaW50LnByb2plY3Rpb25zW2tleXNbal1dID0gcHJvamVjdGlvbltrZXlzW2pdXTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5kYXRhU2V0Lmhhc1RTTkVSdW4gPSBzdGF0ZS5zZWxlY3RlZFByb2plY3Rpb24gPT09ICd0c25lJztcbiAgICB0aGlzLmRhdGFTZXQudFNORUl0ZXJhdGlvbiA9IHN0YXRlLnRTTkVJdGVyYXRpb247XG4gICAgdGhpcy5wcm9qZWN0aW9uc1BhbmVsLnJlc3RvcmVVSUZyb21Cb29rbWFyayhzdGF0ZSk7XG4gICAgdGhpcy5pbnNwZWN0b3JQYW5lbC5yZXN0b3JlVUlGcm9tQm9va21hcmsoc3RhdGUpO1xuICAgIHRoaXMuZGF0YVBhbmVsLnNlbGVjdGVkQ29sb3JPcHRpb25OYW1lID0gc3RhdGUuc2VsZWN0ZWRDb2xvck9wdGlvbk5hbWU7XG4gICAgdGhpcy5kYXRhUGFuZWwuc2V0Rm9yY2VDYXRlZ29yaWNhbENvbG9yaW5nKFxuICAgICAgISFzdGF0ZS5mb3JjZUNhdGVnb3JpY2FsQ29sb3JpbmdcbiAgICApO1xuICAgIHRoaXMuc2VsZWN0ZWRMYWJlbE9wdGlvbiA9IHN0YXRlLnNlbGVjdGVkTGFiZWxPcHRpb247XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIucmVzdG9yZVVJRnJvbUJvb2ttYXJrKHN0YXRlKTtcbiAgICB7XG4gICAgICBjb25zdCBkaW1lbnNpb25zID0gc3RhdGVHZXRBY2Nlc3NvckRpbWVuc2lvbnMoc3RhdGUpO1xuICAgICAgY29uc3QgY29tcG9uZW50cyA9IGdldFByb2plY3Rpb25Db21wb25lbnRzKFxuICAgICAgICBzdGF0ZS5zZWxlY3RlZFByb2plY3Rpb24sXG4gICAgICAgIGRpbWVuc2lvbnNcbiAgICAgICk7XG4gICAgICBjb25zdCBwcm9qZWN0aW9uID0gbmV3IFByb2plY3Rpb24oXG4gICAgICAgIHN0YXRlLnNlbGVjdGVkUHJvamVjdGlvbixcbiAgICAgICAgY29tcG9uZW50cyxcbiAgICAgICAgZGltZW5zaW9ucy5sZW5ndGgsXG4gICAgICAgIHRoaXMuZGF0YVNldFxuICAgICAgKTtcbiAgICAgIHRoaXMuc2V0UHJvamVjdGlvbihwcm9qZWN0aW9uKTtcbiAgICB9XG4gICAgdGhpcy5ub3RpZnlTZWxlY3Rpb25DaGFuZ2VkKHN0YXRlLnNlbGVjdGVkUG9pbnRzKTtcbiAgfVxuXG4gIHJldHJhaW5CeVNlbGVjdGlvbnMoaXRlcmF0aW9uOiBudW1iZXIsIG5ld1NlbDogbnVtYmVyW10pIHtcbiAgICB0aGlzLnByb2plY3Rpb25zUGFuZWwucmV0cmFpbkJ5U2VsZWN0aW9ucyhpdGVyYXRpb24sIG5ld1NlbClcbiAgfVxuXG5cbiAgLyoqXG4gICAqIHF1ZXJ5IGZvciBpbmRpY2VzIGluIGluc3BlY3RvciBwYW5lbFxuICAgKi9cbiAgcXVlcnkocXVlcnk6IHN0cmluZywgaW5SZWdleE1vZGU6IGJvb2xlYW4sIGZpZWxkTmFtZTogc3RyaW5nLCBjdXJyUHJlZGljYXRlczogeyBba2V5OiBzdHJpbmddOiBhbnkgfSwgaXRlcmF0aW9uOiBudW1iZXIsIGNvbmZpZGVuY2VUaHJlc2hvbGRGcm9tOiBhbnksIGNvbmZpZGVuY2VUaHJlc2hvbGRUbzogYW55LFxuICAgIGNhbGxiYWNrOiAoaW5kaWNlczogYW55KSA9PiB2b2lkKSB7XG5cbiAgICBsZXQgY29uZmlkZW5jZVRocmVzaG9sZCA9IFtdXG4gICAgdmFyIGR1bW15Q3VyclByZWRpY2F0ZXM6IHsgW2tleTogc3RyaW5nXTogYW55IH0gPSB7fTtcbiAgICBPYmplY3Qua2V5cyhjdXJyUHJlZGljYXRlcykuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICBkdW1teUN1cnJQcmVkaWNhdGVzW2tleV0gPSBjdXJyUHJlZGljYXRlc1trZXldXG4gICAgfSk7XG5cbiAgICBkdW1teUN1cnJQcmVkaWNhdGVzW2ZpZWxkTmFtZV0gPSBxdWVyeTtcbiAgICBpZiAoY29uZmlkZW5jZVRocmVzaG9sZEZyb20gfHwgY29uZmlkZW5jZVRocmVzaG9sZFRvKSB7XG4gICAgICBkdW1teUN1cnJQcmVkaWNhdGVzWydjb25maWRlbmNlJ10gPSBbTnVtYmVyKGNvbmZpZGVuY2VUaHJlc2hvbGRGcm9tKSwgTnVtYmVyKGNvbmZpZGVuY2VUaHJlc2hvbGRUbyldXG4gICAgfVxuICAgIGNvbnNvbGUubG9nKFwiJ2FhYWFhYVwiKVxuICAgIGNvbnN0IG1zZ0lkID0gbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UoJ1F1ZXJ5aW5nLi4uJyk7XG4gICAgbGV0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICAgIGhlYWRlcnMuYXBwZW5kKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIGhlYWRlcnMuYXBwZW5kKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIGZldGNoKGBodHRwOi8vJHt0aGlzLkRWSVNlcnZlcn0vcXVlcnlgLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgXCJwcmVkaWNhdGVzXCI6IGR1bW15Q3VyclByZWRpY2F0ZXMsIFwiY29udGVudF9wYXRoXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5jb250ZW50X3BhdGggfHwgdGhpcy5kYXRhU2V0LkRWSXN1YmplY3RNb2RlbFBhdGgsXG4gICAgICAgIFwiaXRlcmF0aW9uXCI6IGl0ZXJhdGlvbixcInVzZXJuYW1lXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS51c2VybmFtZSxcbiAgICAgICAgXCJ2aXNfbWV0aG9kXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS52aXNfbWV0aG9kLCdzZXR0aW5nJzp3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2VsZWN0ZWRTZXR0aW5nXG4gICAgICB9KSxcbiAgICAgIGhlYWRlcnM6IGhlYWRlcnMsXG4gICAgICBtb2RlOiAnY29ycydcbiAgICB9KS50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSkudGhlbihkYXRhID0+IHtcbiAgICAgIGNvbnN0IGluZGljZXMgPSBkYXRhLnNlbGVjdGVkUG9pbnRzO1xuICAgICAgd2luZG93LmFsU3VnZ2VzdExhYmVsTGlzdCA9IFtdXG4gICAgICBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZShudWxsLCBtc2dJZCk7XG4gICAgICBjYWxsYmFjayhpbmRpY2VzKTtcbiAgICB9KS5jYXRjaChlcnJvciA9PiB7XG4gICAgICBsb2dnaW5nLnNldEVycm9yTWVzc2FnZSgncXVlcnlpbmcgZm9yIGluZGljZXMnKTtcbiAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0QWxsUmVzUG9zTGlzdChjYWxsYmFjazogKGRhdGE6IGFueSkgPT4gdm9pZCkge1xuICAgIGlmICh3aW5kb3cuYWxsUmVzUG9zaXRpb25zICYmIHdpbmRvdy5hbGxSZXNQb3NpdGlvbnMucmVzdWx0cyAmJiB3aW5kb3cuYWxsUmVzUG9zaXRpb25zLmJnaW1nTGlzdCkge1xuICAgICAgY2FsbGJhY2sod2luZG93LmFsbFJlc1Bvc2l0aW9ucylcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBjb25zdCBtc2dJZCA9IGxvZ2dpbmcuc2V0TW9kYWxNZXNzYWdlKCdRdWVyeWluZy4uLicpO1xuICAgIGxldCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBmZXRjaChgaHR0cDovLyR7dGhpcy5EVklTZXJ2ZXJ9L2FsbF9yZXN1bHRfbGlzdGAsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBcIml0ZXJhdGlvbl9zdGFydFwiOiAxLFxuICAgICAgICBcIml0ZXJhdGlvbl9lbmRcIjogMixcbiAgICAgICAgXCJjb250ZW50X3BhdGhcIjogdGhpcy5kYXRhU2V0LkRWSXN1YmplY3RNb2RlbFBhdGgsXG4gICAgICAgIFwidXNlcm5hbWVcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLnVzZXJuYW1lXG4gICAgICB9KSxcbiAgICAgIGhlYWRlcnM6IGhlYWRlcnMsXG4gICAgICBtb2RlOiAnY29ycydcbiAgICB9KS50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSkudGhlbihkYXRhID0+IHtcbiAgICAgIGNvbnN0IGluZGljZXMgPSBkYXRhLnNlbGVjdGVkUG9pbnRzO1xuICAgICAgbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UobnVsbCwgbXNnSWQpO1xuICAgICAgY2FsbGJhY2soZGF0YSlcbiAgICB9KS5jYXRjaChlcnJvciA9PiB7XG4gICAgICBsb2dnaW5nLnNldEVycm9yTWVzc2FnZSgncXVlcnlpbmcgZm9yIGluZGljZXMnKTtcblxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIHF1ZXJ5IGZvciBwcmVkaWNhdGVzXG4gICAqL1xuICBzaW1wbGVRdWVyeShwcmVkaWNhdGVzOiB7IFtrZXk6IHN0cmluZ106IGFueSB9LCBpdGVyYXRpb246IG51bWJlcikge1xuICAgIGxldCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBmZXRjaChgaHR0cDovLyR7dGhpcy5EVklTZXJ2ZXJ9L3F1ZXJ5YCwge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIFwicHJlZGljYXRlc1wiOiBwcmVkaWNhdGVzLCBcImNvbnRlbnRfcGF0aFwiOiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UuY29udGVudF9wYXRoIHx8IHRoaXMuZGF0YVNldC5EVklzdWJqZWN0TW9kZWxQYXRoLFxuICAgICAgICBcIml0ZXJhdGlvblwiOiBpdGVyYXRpb24sIFwidXNlcm5hbWVcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLnVzZXJuYW1lLFwidmlzX21ldGhvZFwiOiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudmlzX21ldGhvZCwnc2V0dGluZyc6d2luZG93LnNlc3Npb25TdG9yYWdlLnNlbGVjdGVkU2V0dGluZ1xuICAgICAgfSksXG4gICAgICBoZWFkZXJzOiBoZWFkZXJzLFxuICAgICAgbW9kZTogJ2NvcnMnXG4gICAgfSkudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpLnRoZW4oZGF0YSA9PiB7XG4gICAgICBjb25zdCBpbmRpY2VzID0gZGF0YS5zZWxlY3RlZFBvaW50cztcbiAgICAgIHRoaXMuaW5zcGVjdG9yUGFuZWwuZmlsdGVyZWRQb2ludHMgPSBpbmRpY2VzO1xuICAgICAgd2luZG93LmFsU3VnZ2VzdExhYmVsTGlzdCA9IFtdXG4gICAgfSkuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgbG9nZ2luZy5zZXRFcnJvck1lc3NhZ2UoJ3F1ZXJ5aW5nIGZvciBpbmRpY2VzJyk7XG4gICAgfSk7XG4gIH1cbiAgLy8gYWN0aXZlIGxlYXJuaW5nXG4gIHF1ZXJ5QnlBTChpdGVyYXRpb246IG51bWJlciwgc3RyYXRlZ3k6IHN0cmluZywgYnVkZ2V0OiBudW1iZXIsIGFjY2VwdEluZGljYXRlczogbnVtYmVyW10sIHJlamVjdEluZGljYXRlczogbnVtYmVyW10saXNSZWNvbW1lbmQ6Ym9vbGVhbixcbiAgICBjYWxsYmFjazogKGluZGljZXM6IGFueSwgc2NvcmVzOiBhbnksIGxhYmVsczogYW55KSA9PiB2b2lkKSB7XG4gICAgY29uc3QgbXNnSWQgPSBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZSgnUXVlcnlpbmcuLi4nKTtcbiAgICBsZXQgaGVhZGVycyA9IG5ldyBIZWFkZXJzKCk7XG4gICAgaGVhZGVycy5hcHBlbmQoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgaGVhZGVycy5hcHBlbmQoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICBcbiAgIFxuICAgIGxldCBhY2NJbmRpY2F0ZXMgPSBbXVxuICAgIGlmKHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMpe1xuICAgICAgYWNjSW5kaWNhdGVzID0gd2luZG93LmFjY2VwdEluZGljYXRlcy5maWx0ZXIoKGl0ZW0sIGksIGFycikgPT4ge1xuICAgICAgICAvL+WHveaVsOiHqui6q+i/lOWbnueahOaYr+S4gOS4quW4g+WwlOWAvO+8jOWPquW9k+i/lOWbnuWAvOS4unRydWXml7bvvIzlvZPliY3lhYPntKDmiY3kvJrlrZjlhaXmlrDnmoTmlbDnu4TkuK3jgIIgICAgICAgICAgICBcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dW2l0ZW1dID09PSAxXG4gICAgICB9KVxuICAgIH1cbiAgICBsZXQgcmVqSW5kaWNhdGVzID0gW11cbiAgICBpZih3aW5kb3cucmVqZWN0SW5kaWNhdGVzKXtcbiAgICAgIHJlakluZGljYXRlcyA9IHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMuZmlsdGVyKChpdGVtLCBpLCBhcnIpID0+IHtcbiAgICAgICAgLy/lh73mlbDoh6rouqvov5Tlm57nmoTmmK/kuIDkuKrluIPlsJTlgLzvvIzlj6rlvZPov5Tlm57lgLzkuLp0cnVl5pe277yM5b2T5YmN5YWD57Sg5omN5Lya5a2Y5YWl5paw55qE5pWw57uE5Lit44CCICAgICAgICAgICAgXG4gICAgICAgIHJldHVybiB3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXVtpdGVtXSA9PT0gMVxuICAgICAgfSlcbiAgICB9XG5cbiAgICBmZXRjaChgaHR0cDovLyR7dGhpcy5EVklTZXJ2ZXJ9L2FsX3F1ZXJ5YCwge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIFwiaXRlcmF0aW9uXCI6IGl0ZXJhdGlvbixcbiAgICAgICAgXCJzdHJhdGVneVwiOiBzdHJhdGVneSxcbiAgICAgICAgXCJidWRnZXRcIjogYnVkZ2V0LFxuICAgICAgICBcImNvbnRlbnRfcGF0aFwiOiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UuY29udGVudF9wYXRoIHx8IHRoaXMuZGF0YVNldC5EVklzdWJqZWN0TW9kZWxQYXRoLFxuICAgICAgICBcImFjY0luZGljZXNcIjogYWNjSW5kaWNhdGVzLFxuICAgICAgICBcInJlakluZGljZXNcIjogcmVqSW5kaWNhdGVzLFxuICAgICAgICBcImlzUmVjb21tZW5kXCI6aXNSZWNvbW1lbmQsXG4gICAgICAgIFwidXNlcm5hbWVcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLnVzZXJuYW1lLFxuICAgICAgICBcInZpc19tZXRob2RcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLnZpc19tZXRob2QsXG4gICAgICAgICdzZXR0aW5nJzp3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2VsZWN0ZWRTZXR0aW5nXG4gICAgICB9KSxcbiAgICAgIGhlYWRlcnM6IGhlYWRlcnMsXG4gICAgICBtb2RlOiAnY29ycydcbiAgICB9KS50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSkudGhlbihkYXRhID0+IHtcbiAgICAgIGNvbnN0IGluZGljZXMgPSBkYXRhLnNlbGVjdGVkUG9pbnRzO1xuICAgICAgY29uc3QgbGFiZWxzID0gZGF0YS5zdWdnZXN0TGFiZWxzO1xuICAgICAgY29uc3Qgc2NvcmVzID0gZGF0YS5zY29yZXNcbiAgICAgIGxvZ2dpbmcuc2V0TW9kYWxNZXNzYWdlKG51bGwsIG1zZ0lkKTtcblxuICAgICAgLy8gaWYgKGN1cnJlbnRJbmRpY2VzICYmIGN1cnJlbnRJbmRpY2VzLmxlbmd0aCkge1xuICAgICAgLy8gICBmb3IgKGxldCBpID0gMDsgaSA8IGN1cnJlbnRJbmRpY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyAgICAgaWYgKHdpbmRvdy5wcmV2aW91c0luZGVjYXRlcy5pbmRleE9mKGN1cnJlbnRJbmRpY2VzW2ldKSA9PT0gLTEpIHtcbiAgICAgIC8vICAgICAgIHdpbmRvdy5wcmV2aW91c0luZGVjYXRlcy5wdXNoKGN1cnJlbnRJbmRpY2VzW2ldKVxuICAgICAgLy8gICAgIH1cbiAgICAgIC8vICAgfVxuICAgICAgLy8gICBmdW5jdGlvbiBmdW5jKGEsIGIpIHtcbiAgICAgIC8vICAgICByZXR1cm4gYSAtIGI7XG4gICAgICAvLyAgIH1cbiAgICAgIC8vICAgd2luZG93LnByZXZpb3VzSW5kZWNhdGVzLnNvcnQoZnVuYylcbiAgICAgIC8vIH0gZWxzZSB7XG4gICAgICAvLyAgIGZvciAobGV0IGkgPSAwOyBpIDwgd2luZG93LmN1c3RvbVNlbGVjdGlvbi5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gICAgIGlmICh3aW5kb3cucHJldmlvdXNJbmRlY2F0ZXMuaW5kZXhPZih3aW5kb3cuY3VzdG9tU2VsZWN0aW9uW2ldKSA9PT0gLTEpIHtcbiAgICAgIC8vICAgICAgIHdpbmRvdy5wcmV2aW91c0luZGVjYXRlcy5wdXNoKHdpbmRvdy5jdXN0b21TZWxlY3Rpb25baV0pXG4gICAgICAvLyAgICAgfVxuICAgICAgLy8gICB9XG4gICAgICAvLyAgIGZ1bmN0aW9uIGZ1bmMoYSwgYikge1xuICAgICAgLy8gICAgIHJldHVybiBhIC0gYjtcbiAgICAgIC8vICAgfVxuICAgICAgLy8gICB3aW5kb3cucHJldmlvdXNJbmRlY2F0ZXMuc29ydChmdW5jKVxuICAgICAgLy8gfVxuXG5cblxuICAgICAgY2FsbGJhY2soaW5kaWNlcywgc2NvcmVzLCBsYWJlbHMpO1xuICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIGxvZ2dpbmcuc2V0RXJyb3JNZXNzYWdlKCdxdWVyeWluZyBmb3IgaW5kaWNlcycpO1xuICAgICAgY2FsbGJhY2sobnVsbCwgW10sIFtdKTtcbiAgICB9KTtcbiAgfVxuICAvLyBhbm9ybWFseSBkZXRlY3Rpb25cbiAgcXVlcnlBbm9ybWFseVN0cmF0ZWd5KGJ1ZGdldDogbnVtYmVyLCBjbHM6IG51bWJlciwgY3VycmVudEluZGljZXM6IG51bWJlcltdLCBjb21maXJtX2luZm86IGFueVtdLCBhY2NJbmRpY2F0ZXM6IG51bWJlcltdLCByZWpJbmRpY2F0ZXM6IG51bWJlcltdLCBzdHJhdGVneTogc3RyaW5nLGlzUmVjb21tZW5kOmJvb2xlYW4sXG4gICAgY2FsbGJhY2s6IChpbmRpY2VzOiBhbnksIGNsZWFuSW5kaWNlcz86IGFueSkgPT4gdm9pZCkge1xuICAgIGNvbnN0IG1zZ0lkID0gbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UoJ1F1ZXJ5aW5nLi4uJyk7XG4gICAgbGV0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICAgIGlmICghYWNjSW5kaWNhdGVzKSB7XG4gICAgICBhY2NJbmRpY2F0ZXMgPSBbXVxuICAgIH1cbiAgICBpZiAoIXJlakluZGljYXRlcykge1xuICAgICAgcmVqSW5kaWNhdGVzID0gW11cbiAgICB9XG4gICAgbGV0IGFjY0luID0gW11cbiAgICAvLyBpZih3aW5kb3cuYWNjZXB0SW5kaWNhdGVzKXtcbiAgICAvLyAgIGFjY0luZGljYXRlcyA9IHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMuZmlsdGVyKChpdGVtLCBpLCBhcnIpID0+IHtcbiAgICAvLyAgICAgLy/lh73mlbDoh6rouqvov5Tlm57nmoTmmK/kuIDkuKrluIPlsJTlgLzvvIzlj6rlvZPov5Tlm57lgLzkuLp0cnVl5pe277yM5b2T5YmN5YWD57Sg5omN5Lya5a2Y5YWl5paw55qE5pWw57uE5Lit44CCICAgICAgICAgICAgXG4gICAgLy8gICAgIHJldHVybiB3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXVtpdGVtXSA9PT0gMVxuICAgIC8vICAgfSlcbiAgICAvLyB9XG4gICAgLy8gbGV0IHJlakluID0gW11cbiAgICAvLyBpZih3aW5kb3cucmVqZWN0SW5kaWNhdGVzKXtcbiAgICAvLyAgIHJlakluZGljYXRlcyA9IHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMuZmlsdGVyKChpdGVtLCBpLCBhcnIpID0+IHtcbiAgICAvLyAgICAgLy/lh73mlbDoh6rouqvov5Tlm57nmoTmmK/kuIDkuKrluIPlsJTlgLzvvIzlj6rlvZPov5Tlm57lgLzkuLp0cnVl5pe277yM5b2T5YmN5YWD57Sg5omN5Lya5a2Y5YWl5paw55qE5pWw57uE5Lit44CCICAgICAgICAgICAgXG4gICAgLy8gICAgIHJldHVybiB3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXVtpdGVtXSA9PT0gMVxuICAgIC8vICAgfSlcbiAgICAvLyB9XG4gICAgaGVhZGVycy5hcHBlbmQoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgaGVhZGVycy5hcHBlbmQoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgZmV0Y2goYGh0dHA6Ly8ke3RoaXMuRFZJU2VydmVyfS9hbm9tYWx5X3F1ZXJ5YCwge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIFwiYnVkZ2V0XCI6IGJ1ZGdldCxcbiAgICAgICAgXCJjbHNcIjogY2xzLFxuICAgICAgICBcImluZGljZXNcIjogY3VycmVudEluZGljZXMsXG4gICAgICAgIFwiY29udGVudF9wYXRoXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5jb250ZW50X3BhdGggfHwgdGhpcy5kYXRhU2V0LkRWSXN1YmplY3RNb2RlbFBhdGgsXG4gICAgICAgIFwiY29tZmlybV9pbmZvXCI6IGNvbWZpcm1faW5mbyxcbiAgICAgICAgXCJhY2NJbmRpY2VzXCI6IGFjY0luZGljYXRlcyxcbiAgICAgICAgXCJyZWpJbmRpY2VzXCI6IHJlakluZGljYXRlcyxcbiAgICAgICAgXCJzdHJhdGVneVwiOiBzdHJhdGVneSxcbiAgICAgICAgXCJ1c2VybmFtZVwiOiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudXNlcm5hbWUsXG4gICAgICAgIFwiaXNSZWNvbW1lbmRcIjppc1JlY29tbWVuZCxcbiAgICAgICAgXCJ2aXNfbWV0aG9kXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS52aXNfbWV0aG9kLFxuICAgICAgICAnc2V0dGluZyc6d2luZG93LnNlc3Npb25TdG9yYWdlLnNlbGVjdGVkU2V0dGluZ1xuICAgICAgfSksXG4gICAgICBoZWFkZXJzOiBoZWFkZXJzLFxuICAgICAgbW9kZTogJ2NvcnMnXG4gICAgfSkudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpLnRoZW4oZGF0YSA9PiB7XG4gICAgICBjb25zdCBpbmRpY2VzID0gZGF0YS5zZWxlY3RlZFBvaW50cztcbiAgICAgIGNvbnN0IGxhYmVscyA9IGRhdGEuc3VnZ2VzdExhYmVscztcbiAgICAgIGNvbnN0IHNjb3JlcyA9IGRhdGEuc2NvcmVzXG4gICAgICBjb25zdCBjbGVhbkluZGljZXMgPSBkYXRhLmNsZWFuTGlzdFxuICAgICAgd2luZG93LmFsU3VnZ2VzdFNjb3JlTGlzdCA9IGRhdGEuc2NvcmVzXG4gICAgICB3aW5kb3cuYWxTdWdnZXN0TGFiZWxMaXN0ID0gZGF0YS5zdWdnZXN0TGFiZWxzO1xuICAgICAgbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UobnVsbCwgbXNnSWQpO1xuICAgICAgY2FsbGJhY2soaW5kaWNlcywgY2xlYW5JbmRpY2VzKTtcbiAgICB9KS5jYXRjaChlcnJvciA9PiB7XG4gICAgICBsb2dnaW5nLnNldEVycm9yTWVzc2FnZSgncXVlcnlpbmcgZm9yIGluZGljZXMnKTtcbiAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgIH0pO1xuICB9XG5cbiAgcXVlcnlTdWdnZXN0aW9uKGl0ZXJhdGlvbjogbnVtYmVyLCBpbmRpY2VzOiBudW1iZXJbXSwgazogbnVtYmVyLFxuICAgIGNhbGxiYWNrOiAoaW5kaWNlczogYW55KSA9PiB2b2lkKSB7XG4gICAgY29uc3QgbXNnSWQgPSBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZSgnUXVlcnlpbmcuLi4nKTtcbiAgICBsZXQgaGVhZGVycyA9IG5ldyBIZWFkZXJzKCk7XG4gICAgaGVhZGVycy5hcHBlbmQoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgaGVhZGVycy5hcHBlbmQoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgZmV0Y2goYGh0dHA6Ly8ke3RoaXMuRFZJU2VydmVyfS9hbF9zdWdnZXN0X3NpbWlsYXJgLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgXCJpdGVyYXRpb25cIjogaXRlcmF0aW9uLFxuICAgICAgICBcInNlbGVjdEluZGljZXNcIjogaW5kaWNlcyxcbiAgICAgICAgXCJrXCI6IGssXG4gICAgICAgIFwiY29udGVudF9wYXRoXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5jb250ZW50X3BhdGggfHwgdGhpcy5kYXRhU2V0LkRWSXN1YmplY3RNb2RlbFBhdGgsXG4gICAgICAgIFwidmlzX21ldGhvZFwiOiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudmlzX21ldGhvZCxcbiAgICAgICAgJ3NldHRpbmcnOndpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZWxlY3RlZFNldHRpbmdcbiAgICAgIH0pLFxuICAgICAgaGVhZGVyczogaGVhZGVycyxcbiAgICAgIG1vZGU6ICdjb3JzJ1xuICAgIH0pLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKS50aGVuKGRhdGEgPT4ge1xuICAgICAgY29uc3QgaW5kaWNlcyA9IGRhdGEuc2ltaWxhckluZGljZXM7XG4gICAgICBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZShudWxsLCBtc2dJZCk7XG4gICAgICBjYWxsYmFjayhpbmRpY2VzKTtcbiAgICB9KS5jYXRjaChlcnJvciA9PiB7XG4gICAgICAvLyBsb2dnaW5nLnNldEVycm9yTWVzc2FnZSgncXVlcnlpbmcgZm9yIGluZGljZXMnKTtcbiAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgIH0pO1xuICB9XG5cblxuICBzYXZlRFZJU2VsZWN0aW9uKGluZGljZXM6IG51bWJlcltdLCBjYWxsYmFjazogKG1zZzogc3RyaW5nKSA9PiB2b2lkKSB7XG4gICAgbGV0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICAgIGhlYWRlcnMuYXBwZW5kKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIGhlYWRlcnMuYXBwZW5kKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIGZldGNoKGBodHRwOi8vJHt0aGlzLkRWSVNlcnZlcn0vc2F2ZURWSXNlbGVjdGlvbnNgLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgXCJuZXdJbmRpY2VzXCI6IGluZGljZXMsIFxuICAgICAgICBcImNvbnRlbnRfcGF0aFwiOiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UuY29udGVudF9wYXRoIHx8IHRoaXMuZGF0YVNldC5EVklzdWJqZWN0TW9kZWxQYXRoLFxuICAgICAgICBcIml0ZXJhdGlvblwiOiB0aGlzLml0ZXJhdGlvbixcbiAgICAgICAgXCJ2aXNfbWV0aG9kXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS52aXNfbWV0aG9kLFxuICAgICAgICAnc2V0dGluZyc6d2luZG93LnNlc3Npb25TdG9yYWdlLnNlbGVjdGVkU2V0dGluZ1xuICAgICAgfSksXG4gICAgICBoZWFkZXJzOiBoZWFkZXJzLFxuICAgICAgbW9kZTogJ2NvcnMnXG4gICAgfSkudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpLnRoZW4oZGF0YSA9PiB7XG4gICAgICBjb25zdCBtc2cgPSBkYXRhLm1lc3NhZ2U7XG4gICAgICBjYWxsYmFjayhtc2cpO1xuICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIGxvZ2dpbmcuc2V0RXJyb3JNZXNzYWdlKCdzYXZpbmcgaW5kaWNlcycpO1xuICAgIH0pO1xuICB9XG5cbn1cbiJdfQ==