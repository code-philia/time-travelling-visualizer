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
                if (only) {
                    res.structure = [{ value: only, name: only, pid: "" }];
                }
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
                        // 为了计算方便，统一添加children
                        item.children = [];
                        // 构建一个字典
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
                let len = window.tSNETotalIter;
                let svgWidth = len * 45;
                if (window.sessionStorage.taskType === 'active learning') {
                    svgWidth = 1000;
                }
                // svgWidth = 1000
                console.log('svgWid', len, svgWidth);
                svgDom.style.width = svgWidth + 200;
                if (window.sessionStorage.selectedSetting !== 'active learning' && window.sessionStorage.selectedSetting !== 'dense al') {
                    svgDom.style.height = 90;
                    svgDom.style.width = '100%';
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
            });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnotcHJvamVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVuc29yYm9hcmQvcHJvamVjdG9yL3Z6LXByb2plY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBbUVBLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUNsRCxPQUFPLEVBQUUsYUFBYSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUd2RSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNoRixPQUFPLHdDQUF3QyxDQUFDO0FBRWhELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDL0MsT0FBTyxFQU9MLHVCQUF1QixFQUV2QixVQUFVLEVBRVYsS0FBSyxFQUNMLDBCQUEwQixHQUMzQixNQUFNLFFBQVEsQ0FBQztBQUNoQixPQUFPLDhCQUE4QixDQUFDO0FBQ3RDLE9BQU8sRUFHTCxlQUFlLEdBRWhCLE1BQU0saUJBQWlCLENBQUM7QUFDekIsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDeEQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDMUQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDNUQsT0FBTyxrQ0FBa0MsQ0FBQztBQUMxQyxPQUFPLCtCQUErQixDQUFDO0FBQ3ZDLE9BQU8sMkJBQTJCLENBQUM7QUFDbkMsT0FBTyxnQ0FBZ0MsQ0FBQztBQUN4QyxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQVM1RSxPQUFPLEtBQUssT0FBTyxNQUFNLFdBQVcsQ0FBQztBQUNyQyxPQUFPLEtBQUssSUFBSSxNQUFNLFFBQVEsQ0FBQztBQUMvQixP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QUc1QjtJQURDLFFBQVEsQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQzs7Z0RBQ0U7QUFHOUI7SUFEQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUM7OzhDQUNDO0FBRTdCO0lBREMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDOztvREFDTTtBQUdsQztJQURDLFFBQVEsQ0FBQyxFQUFDLElBQUksRUFBRSxPQUFPLEVBQUMsQ0FBQzs7d0RBQ1c7QUEyYnJDO0lBREMsT0FBTyxDQUFDLGFBQWEsQ0FBQzs7OztnREF3QnRCO0FBR0Q7SUFEQyxPQUFPLENBQUMsZUFBZSxDQUFDOzs7O2dEQXVCeEI7QUFHRDtJQURDLE9BQU8sQ0FBQyxhQUFhLENBQUM7Ozs7Z0RBd0J0QjtBQStrQkQ7SUFEQyxPQUFPLENBQUMsV0FBVyxDQUFDOzs7O2tEQU1wQjtBQXRvQ0csU0FBUztJQURkLGFBQWEsQ0FBQyxjQUFjLENBQUM7R0FDeEIsU0FBUyxDQWd3RGQiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBDb3B5cmlnaHQgMjAxNiBUaGUgVGVuc29yRmxvdyBBdXRob3JzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5kZWNsYXJlIGdsb2JhbCB7XG4gIGludGVyZmFjZSBXaW5kb3cge1xuICAgIGhpZGRlbkJhY2tncm91bmQ6IGJvb2xlYW4gfCBmYWxzZSxcbiAgICBEVklEYXRhTGlzdDogYW55LFxuICAgIGxpbmVHZW9tZXJ0cnlMaXN0OiBhbnksXG4gICAgaXRlcmF0aW9uOiBudW1iZXIsXG4gICAgcHJvcGVydGllczogYW55LFxuICAgIGlzRmlsdGVyOiBib29sZWFuIHwgZmFsc2UsXG4gICAgY3VzdG9tU2VsZWN0aW9uOiBhbnksXG4gICAgY2hlY2tib3hEb206IGFueSxcbiAgICBpc0FkanVzdGluZ1NlbDogYm9vbGVhbiB8IGZhbHNlLFxuICAgIHNjZW5lOiBhbnksXG4gICAgcmVuZGVyZXI6IGFueSxcbiAgICBzdWdnZXN0aW9uSW5kaWNhdGVzOiBhbnksXG5cbiAgICB1bkxhYmVsRGF0YTogYW55LFxuICAgIHRlc3RpbmdEYXRhOiBhbnksXG4gICAgbGFiZWxlZERhdGE6IGFueSxcblxuICAgIG5vd1Nob3dJbmRpY2F0ZXM6IGFueSxcbiAgICBzY2VuZUJhY2tncm91bmRJbWc6IGFueSxcbiAgICBjdXN0b21NZXRhZGF0YTogYW55LFxuXG4gICAgcXVlcnlSZXNQb2ludEluZGljZXM6IGFueSxcbiAgICBhbFF1ZXJ5UmVzUG9pbnRJbmRpY2VzOiBhbnksXG4gICAgcHJldmlvdXNJbmRlY2F0ZXM6IGFueSxcbiAgICBwcmV2aW91c0Fub3JtYWxJbmRlY2F0ZXM6IGFueSxcbiAgICBxdWVyeVJlc0Fub3JtYWxJbmRlY2F0ZXM6IGFueSxcbiAgICBxdWVyeVJlc0Fub3JtYWxDbGVhbkluZGVjYXRlczogYW55LFxuICAgIGFsU3VnZ2VzdGlvbkluZGljYXRlczogYW55LFxuICAgIGFsU3VnZ2VzdExhYmVsTGlzdDogYW55LFxuICAgIGFsU3VnZ2VzdFNjb3JlTGlzdDogYW55LFxuICAgIHByZXZpb3VzSG92ZXI6IG51bWJlcixcblxuICAgIGFsbFJlc1Bvc2l0aW9uczogYW55LFxuICAgIG1vZGVsTWF0aDogc3RyaW5nLFxuICAgIHRTTkVUb3RhbEl0ZXI6IG51bWJlcixcbiAgICB0YXNrVHlwZTogc3RyaW5nLFxuICAgIHNlbGVjdGVkU3RhY2s6IGFueSxcbiAgICBpcEFkZHJlc3M6IHN0cmluZyxcbiAgICBkMzogYW55LFxuICAgIHRyZWVqc29uOiBhbnksXG5cbiAgICByZWplY3RJbmRpY2F0ZXM6IGFueSxcbiAgICBhY2NlcHRJbmRpY2F0ZXM6IGFueSxcblxuICAgIGFjY2VwdElucHV0TGlzdDogYW55LFxuICAgIHJlamVjdElucHV0TGlzdDogYW55LFxuICAgIGZsYWdpbmRlY2F0ZXNMaXN0OiBhbnksXG4gICAgc2VsZWN0ZWRUb3RhbEVwb2NoOiBudW1iZXJcbiAgfVxufVxuXG5pbXBvcnQgeyBQb2x5bWVyRWxlbWVudCB9IGZyb20gJ0Bwb2x5bWVyL3BvbHltZXInO1xuaW1wb3J0IHsgY3VzdG9tRWxlbWVudCwgb2JzZXJ2ZSwgcHJvcGVydHkgfSBmcm9tICdAcG9seW1lci9kZWNvcmF0b3JzJztcbmltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcblxuaW1wb3J0IHsgTGVnYWN5RWxlbWVudE1peGluIH0gZnJvbSAnLi4vY29tcG9uZW50cy9wb2x5bWVyL2xlZ2FjeV9lbGVtZW50X21peGluJztcbmltcG9ydCAnLi4vY29tcG9uZW50cy9wb2x5bWVyL2lyb25zX2FuZF9wYXBlcnMnO1xuXG5pbXBvcnQgeyBBbmFseXRpY3NMb2dnZXIgfSBmcm9tICcuL2FuYWx5dGljc0xvZ2dlcic7XG5pbXBvcnQgeyB0ZW1wbGF0ZSB9IGZyb20gJy4vdnotcHJvamVjdG9yLmh0bWwnO1xuaW1wb3J0IHtcbiAgQ29sb3JPcHRpb24sXG4gIENvbHVtblN0YXRzLFxuICBEaXN0YW5jZUZ1bmN0aW9uLFxuICBEYXRhUG9pbnQsXG4gIERhdGFQcm90byxcbiAgRGF0YVNldCxcbiAgZ2V0UHJvamVjdGlvbkNvbXBvbmVudHMsXG4gIFBvaW50TWV0YWRhdGEsXG4gIFByb2plY3Rpb24sXG4gIFNwcml0ZUFuZE1ldGFkYXRhSW5mbyxcbiAgU3RhdGUsXG4gIHN0YXRlR2V0QWNjZXNzb3JEaW1lbnNpb25zLCBTZXF1ZW5jZSxcbn0gZnJvbSAnLi9kYXRhJztcbmltcG9ydCAnLi92ei1wcm9qZWN0b3ItbWV0YWRhdGEtY2FyZCc7XG5pbXBvcnQge1xuICBTZXJ2aW5nTW9kZSxcbiAgRGF0YVByb3ZpZGVyLFxuICBhbmFseXplTWV0YWRhdGEsXG4gIEVtYmVkZGluZ0luZm8sIFByb2plY3RvckNvbmZpZyxcbn0gZnJvbSAnLi9kYXRhLXByb3ZpZGVyJztcbmltcG9ydCB7IERlbW9EYXRhUHJvdmlkZXIgfSBmcm9tICcuL2RhdGEtcHJvdmlkZXItZGVtbyc7XG5pbXBvcnQgeyBQcm90b0RhdGFQcm92aWRlciB9IGZyb20gJy4vZGF0YS1wcm92aWRlci1wcm90byc7XG5pbXBvcnQgeyBTZXJ2ZXJEYXRhUHJvdmlkZXIgfSBmcm9tICcuL2RhdGEtcHJvdmlkZXItc2VydmVyJztcbmltcG9ydCAnLi92ei1wcm9qZWN0b3ItcHJvamVjdGlvbnMtcGFuZWwnO1xuaW1wb3J0ICcuL3Z6LXByb2plY3Rvci1ib29rbWFyay1wYW5lbCc7XG5pbXBvcnQgJy4vdnotcHJvamVjdG9yLWRhdGEtcGFuZWwnO1xuaW1wb3J0ICcuL3Z6LXByb2plY3Rvci1pbnNwZWN0b3ItcGFuZWwnO1xuaW1wb3J0IHsgUHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyIH0gZnJvbSAnLi9wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXInO1xuaW1wb3J0IHtcbiAgRGlzdGFuY2VNZXRyaWNDaGFuZ2VkTGlzdGVuZXIsXG4gIEhvdmVyTGlzdGVuZXIsXG4gIFByb2plY3Rpb25DaGFuZ2VkTGlzdGVuZXIsXG4gIFByb2plY3RvckV2ZW50Q29udGV4dCxcbiAgU2VsZWN0aW9uQ2hhbmdlZExpc3RlbmVyLFxufSBmcm9tICcuL3Byb2plY3RvckV2ZW50Q29udGV4dCc7XG5pbXBvcnQgKiBhcyBrbm4gZnJvbSAnLi9rbm4nO1xuaW1wb3J0ICogYXMgbG9nZ2luZyBmcm9tICcuL2xvZ2dpbmcnO1xuaW1wb3J0ICogYXMgdXRpbCBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IHsgTW91c2VNb2RlIH0gZnJvbSAnLi9zY2F0dGVyUGxvdCc7XG5cbi8qKlxuICogVGhlIG1pbmltdW0gbnVtYmVyIG9mIGRpbWVuc2lvbnMgdGhlIGRhdGEgc2hvdWxkIGhhdmUgdG8gYXV0b21hdGljYWxseVxuICogZGVjaWRlIHRvIG5vcm1hbGl6ZSB0aGUgZGF0YS5cbiAqL1xuY29uc3QgVEhSRVNIT0xEX0RJTV9OT1JNQUxJWkUgPSA1MDtcbmNvbnN0IFBPSU5UX0NPTE9SX01JU1NJTkcgPSAnYmxhY2snO1xuY29uc3QgSU5ERVhfTUVUQURBVEFfRklFTEQgPSAnX19pbmRleF9fJztcblxuLyoqXG4gKiBTYXZlIHRoZSBpbml0aWFsIFVSTCBxdWVyeSBwYXJhbXMsIGJlZm9yZSB0aGUgQXBwUm91dGluZ0VmZmVjdHMgaW5pdGlhbGl6ZS5cbiAqL1xuY29uc3QgaW5pdGlhbFVSTFF1ZXJ5U3RyaW5nID0gd2luZG93LmxvY2F0aW9uLnNlYXJjaDtcblxuQGN1c3RvbUVsZW1lbnQoJ3Z6LXByb2plY3RvcicpXG5jbGFzcyBQcm9qZWN0b3JcbiAgZXh0ZW5kcyBMZWdhY3lFbGVtZW50TWl4aW4oUG9seW1lckVsZW1lbnQpXG4gIGltcGxlbWVudHMgUHJvamVjdG9yRXZlbnRDb250ZXh0IHtcbiAgc3RhdGljIHJlYWRvbmx5IHRlbXBsYXRlID0gdGVtcGxhdGU7XG5cbiAgQHByb3BlcnR5KHsgdHlwZTogU3RyaW5nIH0pXG4gIHJvdXRlUHJlZml4OiBzdHJpbmc7XG5cbiAgQHByb3BlcnR5KHsgdHlwZTogU3RyaW5nIH0pXG4gIGRhdGFQcm90bzogc3RyaW5nO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IFN0cmluZyB9KVxuICBzZXJ2aW5nTW9kZTogU2VydmluZ01vZGU7XG5cbiAgLy8gVGhlIHBhdGggdG8gdGhlIHByb2plY3RvciBjb25maWcgSlNPTiBmaWxlIGZvciBkZW1vIG1vZGUuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IFN0cmluZyB9KVxuICBwcm9qZWN0b3JDb25maWdKc29uUGF0aDogc3RyaW5nO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IEJvb2xlYW4gfSlcbiAgcGFnZVZpZXdMb2dnaW5nOiBib29sZWFuO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IEJvb2xlYW4gfSlcbiAgZXZlbnRMb2dnaW5nOiBib29sZWFuO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IE9iamVjdCB9KVxuICBtZXRhZGF0YVN0eWxlOiBhbnlcblxuICAvKipcbiAgICogRFZJIHByb3BlcnRpZXNcbiAgICovXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IFN0cmluZyB9KVxuICBEVklTZXJ2ZXI6IHN0cmluZ1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IEJvb2xlYW4gfSlcbiAgc2hvd2xhYmVsZWQ6IGJvb2xlYW4gPSB0cnVlO1xuXG4gIEBwcm9wZXJ0eSh7IHR5cGU6IEJvb2xlYW4gfSlcbiAgc2hvd1VubGFiZWxlZDogYm9vbGVhbiA9IHRydWU7XG5cbiAgQHByb3BlcnR5KHsgdHlwZTogQm9vbGVhbiB9KVxuICBzaG93VGVzdGluZzogYm9vbGVhbiA9IGZhbHNlO1xuICBAcHJvcGVydHkoeyB0eXBlOiBCb29sZWFuIH0pXG4gIF9zaG93Tm90QXZhbGlhYmxlOiBib29sZWFuID0gZmFsc2VcblxuICBAcHJvcGVydHkoe3R5cGU6IEJvb2xlYW59KVxuICBzaG93VW5sYWJlbGVkQ2hlY2tib3g6IGJvb2xlYW4gPSB0cnVlXG5cbiAgLy8gVGhlIHdvcmtpbmcgc3Vic2V0IG9mIHRoZSBkYXRhIHNvdXJjZSdzIG9yaWdpbmFsIGRhdGEgc2V0LlxuICBkYXRhU2V0OiBEYXRhU2V0O1xuICBpdGVyYXRpb246IG51bWJlcjtcbiAgcHJpdmF0ZSBzZWxlY3Rpb25DaGFuZ2VkTGlzdGVuZXJzOiBTZWxlY3Rpb25DaGFuZ2VkTGlzdGVuZXJbXTtcbiAgcHJpdmF0ZSBob3Zlckxpc3RlbmVyczogSG92ZXJMaXN0ZW5lcltdO1xuICBwcml2YXRlIHByb2plY3Rpb25DaGFuZ2VkTGlzdGVuZXJzOiBQcm9qZWN0aW9uQ2hhbmdlZExpc3RlbmVyW107XG4gIHByaXZhdGUgZGlzdGFuY2VNZXRyaWNDaGFuZ2VkTGlzdGVuZXJzOiBEaXN0YW5jZU1ldHJpY0NoYW5nZWRMaXN0ZW5lcltdO1xuICBwcml2YXRlIG9yaWdpbmFsRGF0YVNldDogRGF0YVNldDtcbiAgcHJpdmF0ZSBkYXRhU2V0QmVmb3JlRmlsdGVyOiBEYXRhU2V0O1xuICBwcml2YXRlIHByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlcjogUHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyO1xuICBwcml2YXRlIGRpbTogbnVtYmVyO1xuICBwcml2YXRlIGRhdGFTZXRGaWx0ZXJJbmRpY2VzOiBudW1iZXJbXTtcbiAgcHJpdmF0ZSBzZWxlY3RlZFBvaW50SW5kaWNlczogbnVtYmVyW107XG4gIHByaXZhdGUgbmVpZ2hib3JzT2ZGaXJzdFBvaW50OiBrbm4uTmVhcmVzdEVudHJ5W107XG4gIHByaXZhdGUgaG92ZXJQb2ludEluZGV4OiBudW1iZXI7XG4gIHByaXZhdGUgZWRpdE1vZGU6IGJvb2xlYW47XG4gIHByaXZhdGUgZGF0YVByb3ZpZGVyOiBEYXRhUHJvdmlkZXI7XG4gIHByaXZhdGUgc2VsZWN0ZWRDb2xvck9wdGlvbjogQ29sb3JPcHRpb247XG4gIHByaXZhdGUgc2VsZWN0ZWRMYWJlbE9wdGlvbjogc3RyaW5nO1xuICBwcml2YXRlIG5vcm1hbGl6ZURhdGE6IGJvb2xlYW47XG4gIHByaXZhdGUgcHJvamVjdGlvbjogUHJvamVjdGlvbjtcbiAgcHJpdmF0ZSBtZXRhZGF0YUZpbGU6IHN0cmluZztcbiAgLyoqIFBvbHltZXIgY29tcG9uZW50IHBhbmVscyAqL1xuICBwcml2YXRlIGluc3BlY3RvclBhbmVsOiBhbnk7XG4gIHByaXZhdGUgZGF0YVBhbmVsOiBhbnk7XG4gIHByaXZhdGUgYm9va21hcmtQYW5lbDogYW55O1xuICBwcml2YXRlIHByb2plY3Rpb25zUGFuZWw6IGFueTtcbiAgcHJpdmF0ZSBtZXRhZGF0YUNhcmQ6IGFueTtcbiAgcHJpdmF0ZSBzdGF0dXNCYXI6IEhUTUxEaXZFbGVtZW50O1xuICBwcml2YXRlIGFuYWx5dGljc0xvZ2dlcjogQW5hbHl0aWNzTG9nZ2VyO1xuICBwcml2YXRlIGJhY2tncm91bmRQb2ludHM6IGFueTtcbiAgcHJpdmF0ZSBjdXJyZW50SXRlcmF0aW9uOiBudW1iZXJcblxuICBwcml2YXRlIGdvRG93bkJ0bjogYW55O1xuICBwcml2YXRlIGdvVXBCdG46IGFueTtcbiAgcHJpdmF0ZSBnb0xlZnRCdG46IGFueTtcbiAgcHJpdmF0ZSBnb1JpZ2h0QnRuOiBhbnk7XG5cbiAgcHJpdmF0ZSBoZWxwQnRuOiBhbnk7XG5cbiAgcHJpdmF0ZSB0aW1lcjogYW55O1xuXG4gIHByaXZhdGUgaW50ZXJ2YWxGbGFnOiBib29sZWFuXG5cbiAgcHJpdmF0ZSByZWdpc3RlcmVkOiBib29sZWFuXG5cblxuXG5cblxuXG4gIGFzeW5jIHJlYWR5KCkge1xuICAgIHN1cGVyLnJlYWR5KCk7XG4gICAgbG9nZ2luZy5zZXREb21Db250YWluZXIodGhpcyBhcyBIVE1MRWxlbWVudCk7XG4gICAgdGhpcy5hbmFseXRpY3NMb2dnZXIgPSBuZXcgQW5hbHl0aWNzTG9nZ2VyKFxuICAgICAgdGhpcy5wYWdlVmlld0xvZ2dpbmcsXG4gICAgICB0aGlzLmV2ZW50TG9nZ2luZ1xuICAgICk7XG4gICAgdGhpcy5hbmFseXRpY3NMb2dnZXIubG9nUGFnZVZpZXcoJ2VtYmVkZGluZ3MnKTtcbiAgICBjb25zdCBoYXNXZWJHTFN1cHBvcnQgPSBhd2FpdCB1dGlsLmhhc1dlYkdMU3VwcG9ydCgpO1xuICAgIGlmICghaGFzV2ViR0xTdXBwb3J0KSB7XG4gICAgICB0aGlzLmFuYWx5dGljc0xvZ2dlci5sb2dXZWJHTERpc2FibGVkKCk7XG4gICAgICBsb2dnaW5nLnNldEVycm9yTWVzc2FnZShcbiAgICAgICAgJ1lvdXIgYnJvd3NlciBvciBkZXZpY2UgZG9lcyBub3QgaGF2ZSBXZWJHTCBlbmFibGVkLiBQbGVhc2UgZW5hYmxlICcgK1xuICAgICAgICAnaGFyZHdhcmUgYWNjZWxlcmF0aW9uLCBvciB1c2UgYSBicm93c2VyIHRoYXQgc3VwcG9ydHMgV2ViR0wuJ1xuICAgICAgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5zZWxlY3Rpb25DaGFuZ2VkTGlzdGVuZXJzID0gW107XG4gICAgdGhpcy5ob3Zlckxpc3RlbmVycyA9IFtdO1xuICAgIHRoaXMucHJvamVjdGlvbkNoYW5nZWRMaXN0ZW5lcnMgPSBbXTtcbiAgICB0aGlzLmRpc3RhbmNlTWV0cmljQ2hhbmdlZExpc3RlbmVycyA9IFtdO1xuICAgIHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMgPSBbXTtcbiAgICB0aGlzLm5laWdoYm9yc09mRmlyc3RQb2ludCA9IFtdO1xuICAgIHRoaXMudGltZXIgPSBudWxsXG4gICAgdGhpcy5lZGl0TW9kZSA9IGZhbHNlO1xuICAgIHRoaXMuZGF0YVBhbmVsID0gdGhpcy4kWydkYXRhLXBhbmVsJ10gYXMgYW55OyAvLyBEYXRhUGFuZWxcbiAgICB0aGlzLmluc3BlY3RvclBhbmVsID0gdGhpcy4kWydpbnNwZWN0b3ItcGFuZWwnXSBhcyBhbnk7IC8vIEluc3BlY3RvclBhbmVsXG4gICAgdGhpcy5wcm9qZWN0aW9uc1BhbmVsID0gdGhpcy4kWydwcm9qZWN0aW9ucy1wYW5lbCddIGFzIGFueTsgLy8gUHJvamVjdGlvbnNQYW5lbFxuICAgIHRoaXMuYm9va21hcmtQYW5lbCA9IHRoaXMuJFsnYm9va21hcmstcGFuZWwnXSBhcyBhbnk7IC8vIEJvb2ttYXJrUGFuZWxcbiAgICB0aGlzLm1ldGFkYXRhQ2FyZCA9IHRoaXMuJFsnbWV0YWRhdGEtY2FyZCddIGFzIGFueTsgLy8gTWV0YWRhdGFDYXJkXG4gICAgdGhpcy5zdGF0dXNCYXIgPSB0aGlzLiQkKCcjc3RhdHVzLWJhcicpIGFzIEhUTUxEaXZFbGVtZW50O1xuICAgIHRoaXMuaGVscEJ0biA9IHRoaXMuJCQoJyNoZWxwLTNkLWljb24nKSBhcyBIVE1MRWxlbWVudDtcbiAgICB0aGlzLmluc3BlY3RvclBhbmVsLmluaXRpYWxpemUodGhpcywgdGhpcyBhcyBQcm9qZWN0b3JFdmVudENvbnRleHQpO1xuICAgIHRoaXMucHJvamVjdGlvbnNQYW5lbC5pbml0aWFsaXplKHRoaXMpO1xuICAgIHRoaXMuYm9va21hcmtQYW5lbC5pbml0aWFsaXplKHRoaXMsIHRoaXMgYXMgUHJvamVjdG9yRXZlbnRDb250ZXh0KTtcbiAgICB0aGlzLnNldHVwVUlDb250cm9scygpO1xuICAgIHRoaXMuaW5pdGlhbGl6ZURhdGFQcm92aWRlcigpO1xuICAgIHRoaXMuZDNsb2FkZXIoKVxuICAgIHRoaXMuaXRlcmF0aW9uID0gMDtcbiAgICB0aGlzLmN1cnJlbnRJdGVyYXRpb24gPSAwXG5cbiAgICB0aGlzLnNob3dsYWJlbGVkID0gdHJ1ZVxuICAgIHRoaXMuc2hvd1VubGFiZWxlZCA9IHRydWVcbiAgICB0aGlzLnNob3dUZXN0aW5nID0gZmFsc2VcblxuICAgIHRoaXMucmVnaXN0ZXJlZCA9IGZhbHNlXG5cbiAgICB0aGlzLnNob3dVbmxhYmVsZWRDaGVja2JveCA9IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS50YXNrVHlwZSA9PT0gJ2FjdGl2ZSBsZWFybmluZydcblxuXG4gICAgdGhpcy5pbnRlcnZhbEZsYWcgPSB0cnVlXG4gICAgdGhpcy5fc2hvd05vdEF2YWxpYWJsZSA9IGZhbHNlXG5cbiAgICB0aGlzLm1ldGFkYXRhU3R5bGUgPSB7XG4gICAgICBsZWZ0OiAnMzIwcHgnLFxuICAgICAgdG9wOiAnMTIwcHgnXG4gICAgfVxuXG4gICAgbGV0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICAgIGhlYWRlcnMuYXBwZW5kKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIGhlYWRlcnMuYXBwZW5kKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIC8vIGF3YWl0IGZldGNoKFwic3RhbmRhbG9uZV9wcm9qZWN0b3JfY29uZmlnLmpzb25cIiwgeyBtZXRob2Q6ICdHRVQnIH0pXG4gICAgLy8gICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpXG4gICAgLy8gICAudGhlbihkYXRhID0+IHsgdGhpcy5EVklTZXJ2ZXIgPSBkYXRhLkRWSVNlcnZlcklQICsgXCI6XCIgKyBkYXRhLkRWSVNlcnZlclBvcnQ7IH0pXG4gICAgdGhpcy5EVklTZXJ2ZXIgPSB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UuaXBBZGRyZXNzXG4gIH07XG4gIGQzbG9hZGVyKCkge1xuICAgIGxldCB0aGF0ID0gdGhpc1xuICAgIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAvLyBsZXQgdXJsID0gXCJodHRwOi8vMTcyLjI2LjE5MS4xNzM6ODEvZDMudjUubWluLmpzXCJcbiAgICAgIGxldCB1cmwgPSBcImh0dHBzOi8vZDNqcy5vcmcvZDMudjUubWluLmpzXCJcbiAgICAgIGxldCBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKVxuICAgICAgc2NyaXB0LnNldEF0dHJpYnV0ZSgnc3JjJywgdXJsKVxuXG4gICAgICBzY3JpcHQub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHRydWUpXG4gICAgICAgIHRoYXQuaW5pdGlhbFRyZWUoKVxuICAgICAgfVxuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmQoc2NyaXB0KVxuICAgIH0pXG4gIH1cblxuXG4gIGFzeW5jIGluaXRpYWxUcmVlKG9ubHk/Om51bWJlcixuZWVkUmVtb3ZlPzpib29sZWFuKSB7XG4gICAgLy8gdGhpcy5kM2xvYWRlcigpXG5cbiAgICBjb25zdCBkMyA9IHdpbmRvdy5kMztcblxuICAgIGxldCBzdmdEb206IGFueSA9IHRoaXMuJCQoXCIjbXlzdmdnZ1wiKVxuXG4gICAgXG5cbiAgICB3aGlsZSAoc3ZnRG9tPy5maXJzdENoaWxkKSB7XG4gICAgICBzdmdEb20ucmVtb3ZlQ2hpbGQoc3ZnRG9tLmxhc3RDaGlsZCk7XG4gICAgfVxuICAgIGlmKG5lZWRSZW1vdmUpe1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ2lzT25seT8nLG9ubHkpXG5cbiAgICBcblxuICAgIC8vIGRvY3VtZW50LmJvZHkuYXBwZW5kKHN2Z0RvbSlcblxuICAgIGxldCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgICBhd2FpdCBmZXRjaChgaHR0cDovLyR7d2luZG93LnNlc3Npb25TdG9yYWdlLmlwQWRkcmVzc30vZ2V0X2l0ZXJ0YWlvbl9zdHJ1Y3R1cmU/cGF0aD0ke3dpbmRvdy5zZXNzaW9uU3RvcmFnZS5jb250ZW50X3BhdGh9Jm1ldGhvZD0ke3dpbmRvdy5zZXNzaW9uU3RvcmFnZS52aXNfbWV0aG9kfSZzZXR0aW5nPSR7d2luZG93LnNlc3Npb25TdG9yYWdlLnNlbGVjdGVkU2V0dGluZ31gLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGhlYWRlcnM6IGhlYWRlcnMsXG4gICAgICBtb2RlOiAnY29ycydcbiAgICB9KVxuICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKVxuICAgICAgLnRoZW4ocmVzID0+IHtcbiAgICAgICAgaWYob25seSl7XG4gICAgICAgICAgcmVzLnN0cnVjdHVyZSA9IFt7dmFsdWU6b25seSxuYW1lOm9ubHkscGlkOlwiXCJ9XVxuICAgICAgICB9XG4gICAgICAgIHJlcy5zdHJ1Y3R1cmUubGVuZ3RoID0gd2luZG93LnNlbGVjdGVkVG90YWxFcG9jaFxuICAgICAgICB3aW5kb3cudHJlZWpzb24gPSByZXMuc3RydWN0dXJlXG5cbiAgICAgICAgbGV0IGRhdGEgPSByZXMuc3RydWN0dXJlXG4gICAgICAgIGlmKG9ubHkpe1xuXG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiB0cmFuTGlzdFRvVHJlZURhdGEoYXJyKSB7XG4gICAgICAgICAgY29uc3QgbmV3QXJyID0gW11cbiAgICAgICAgICBjb25zdCBtYXAgPSB7fVxuICAgICAgICAgIC8vIHtcbiAgICAgICAgICAvLyAgICcwMSc6IHtpZDpcIjAxXCIsIHBpZDpcIlwiLCAgIFwibmFtZVwiOlwi6ICB546LXCIsY2hpbGRyZW46IFtdIH0sXG4gICAgICAgICAgLy8gICAnMDInOiB7aWQ6XCIwMlwiLCBwaWQ6XCIwMVwiLCBcIm5hbWVcIjpcIuWwj+W8oFwiLGNoaWxkcmVuOiBbXSB9LFxuICAgICAgICAgIC8vIH1cbiAgICAgICAgICBhcnIuZm9yRWFjaChpdGVtID0+IHtcbiAgICAgICAgICAgIC8vIOS4uuS6huiuoeeul+aWueS+v++8jOe7n+S4gOa3u+WKoGNoaWxkcmVuXG4gICAgICAgICAgICBpdGVtLmNoaWxkcmVuID0gW11cbiAgICAgICAgICAgIC8vIOaehOW7uuS4gOS4quWtl+WFuFxuICAgICAgICAgICAgY29uc3Qga2V5ID0gaXRlbS52YWx1ZVxuICAgICAgICAgICAgbWFwW2tleV0gPSBpdGVtXG4gICAgICAgICAgfSlcblxuICAgICAgICAgIC8vIDIuIOWvueS6jmFycuS4reeahOavj+S4gOmhuVxuICAgICAgICAgIGFyci5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gbWFwW2l0ZW0ucGlkXVxuICAgICAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgICAvLyAgICDlpoLmnpzlroPmnInniLbnuqfvvIzmiorlvZPliY3lr7nosaHmt7vliqDniLbnuqflhYPntKDnmoRjaGlsZHJlbuS4rVxuICAgICAgICAgICAgICBwYXJlbnQuY2hpbGRyZW4ucHVzaChpdGVtKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gICAg5aaC5p6c5a6D5rKh5pyJ54i257qn77yIcGlkOicn77yJLOebtOaOpea3u+WKoOWIsG5ld0FyclxuICAgICAgICAgICAgICBuZXdBcnIucHVzaChpdGVtKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG5cbiAgICAgICAgICByZXR1cm4gbmV3QXJyXG4gICAgICAgIH1cbiAgICAgICAgZGF0YSA9IHRyYW5MaXN0VG9UcmVlRGF0YShkYXRhKVswXVxuICAgICAgICB2YXIgbWFyZ2luID0gNTA7XG4gICAgICAgIHZhciBzdmcgPSBkMy5zZWxlY3Qoc3ZnRG9tKTtcbiAgICAgICAgdmFyIHdpZHRoID0gc3ZnLmF0dHIoXCJ3aWR0aFwiKTtcbiAgICAgICAgdmFyIGhlaWdodCA9IHN2Zy5hdHRyKFwiaGVpZ2h0XCIpO1xuXG4gICAgICAgIC8vY3JlYXRlIGdyb3VwXG4gICAgICAgIHZhciBnID0gc3ZnLmFwcGVuZChcImdcIilcbiAgICAgICAgICAuYXR0cihcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZShcIiArIG1hcmdpbiArIFwiLFwiICsgMjAgKyBcIilcIik7XG5cblxuICAgICAgICAvL2NyZWF0ZSBsYXllciBsYXlvdXRcbiAgICAgICAgdmFyIGhpZXJhcmNoeURhdGEgPSBkMy5oaWVyYXJjaHkoZGF0YSlcbiAgICAgICAgICAuc3VtKGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAgICAgICByZXR1cm4gZC52YWx1ZTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgLy8gICAgbm9kZXMgYXR0cmlidXRlczpcbiAgICAgICAgLy8gICAgICAgIG5vZGUuZGF0YSAtIGRhdGEuXG4gICAgICAgIC8vICAgICAgICBub2RlLmRlcHRoIC0gcm9vdCBpcyAwLlxuICAgICAgICAvLyAgICAgICAgbm9kZS5oZWlnaHQgLSAgbGVhZiBub2RlIGlzIDAuXG4gICAgICAgIC8vICAgICAgICBub2RlLnBhcmVudCAtIHBhcmVudCBpZCwgcm9vdCBpcyBudWxsLlxuICAgICAgICAvLyAgICAgICAgbm9kZS5jaGlsZHJlbi5cbiAgICAgICAgLy8gICAgICAgIG5vZGUudmFsdWUgLSB0b3RhbCB2YWx1ZSBjdXJyZW50IG5vZGUgYW5kIGRlc2NlbmRhbnRzO1xuXG4gICAgICAgIC8vY3JlYXRlIHRyZWVcbiAgICAgICAgbGV0IGxlbiA9IHdpbmRvdy50U05FVG90YWxJdGVyXG4gICAgICAgIGxldCBzdmdXaWR0aCA9IGxlbiAqIDQ1XG4gICAgICAgIGlmICh3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudGFza1R5cGUgPT09ICdhY3RpdmUgbGVhcm5pbmcnKSB7XG4gICAgICAgICAgc3ZnV2lkdGggPSAxMDAwXG4gICAgICAgIH1cbiAgICAgICAgLy8gc3ZnV2lkdGggPSAxMDAwXG4gICAgICAgIGNvbnNvbGUubG9nKCdzdmdXaWQnLCBsZW4sIHN2Z1dpZHRoKVxuICAgICAgICBzdmdEb20uc3R5bGUud2lkdGggPSBzdmdXaWR0aCArIDIwMFxuICAgICAgICBpZih3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2VsZWN0ZWRTZXR0aW5nICE9PSAnYWN0aXZlIGxlYXJuaW5nJyAmJiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2VsZWN0ZWRTZXR0aW5nICE9PSAnZGVuc2UgYWwnKXtcbiAgICAgICAgICBzdmdEb20uc3R5bGUuaGVpZ2h0ID0gOTBcbiAgICAgICAgICBzdmdEb20uc3R5bGUud2lkdGggPSAnMTAwJSdcbiAgICAgICAgfVxuXG5cbiAgICAgICAgdmFyIHRyZWUgPSBkMy50cmVlKClcbiAgICAgICAgICAuc2l6ZShbMTAwLCBzdmdXaWR0aF0pXG4gICAgICAgICAgLnNlcGFyYXRpb24oZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgICAgIHJldHVybiAoYS5wYXJlbnQgPT0gYi5wYXJlbnQgPyAxIDogMikgLyBhLmRlcHRoO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgIC8vaW5pdFxuICAgICAgICB2YXIgdHJlZURhdGEgPSB0cmVlKGhpZXJhcmNoeURhdGEpXG5cbiAgICAgICAgLy9saW5lIG5vZGVcbiAgICAgICAgdmFyIG5vZGVzID0gdHJlZURhdGEuZGVzY2VuZGFudHMoKTtcbiAgICAgICAgdmFyIGxpbmtzID0gdHJlZURhdGEubGlua3MoKTtcblxuICAgICAgICAvL2xpbmVcbiAgICAgICAgdmFyIGxpbmsgPSBkMy5saW5rSG9yaXpvbnRhbCgpXG4gICAgICAgICAgLngoZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgICAgIHJldHVybiBkLnk7XG4gICAgICAgICAgfSkgLy9saW5rSG9yaXpvbnRhbFxuICAgICAgICAgIC55KGZ1bmN0aW9uIChkKSB7XG4gICAgICAgICAgICByZXR1cm4gZC54O1xuICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgLy9wYXRoXG4gICAgICAgIGcuYXBwZW5kKCdnJylcbiAgICAgICAgICAuc2VsZWN0QWxsKCdwYXRoJylcbiAgICAgICAgICAuZGF0YShsaW5rcylcbiAgICAgICAgICAuZW50ZXIoKVxuICAgICAgICAgIC5hcHBlbmQoJ3BhdGgnKVxuICAgICAgICAgIC5hdHRyKCdkJywgZnVuY3Rpb24gKGQsIGkpIHtcbiAgICAgICAgICAgIHZhciBzdGFydCA9IHtcbiAgICAgICAgICAgICAgeDogZC5zb3VyY2UueCxcbiAgICAgICAgICAgICAgeTogZC5zb3VyY2UueVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHZhciBlbmQgPSB7XG4gICAgICAgICAgICAgIHg6IGQudGFyZ2V0LngsXG4gICAgICAgICAgICAgIHk6IGQudGFyZ2V0LnlcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gbGluayh7XG4gICAgICAgICAgICAgIHNvdXJjZTogc3RhcnQsXG4gICAgICAgICAgICAgIHRhcmdldDogZW5kXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5hdHRyKCdzdHJva2UnLCAnIzQ1MmQ4YScpXG4gICAgICAgICAgLmF0dHIoJ3N0cm9rZS13aWR0aCcsIDEpXG4gICAgICAgICAgLmF0dHIoJ2ZpbGwnLCAnbm9uZScpO1xuXG5cbiAgICAgICAgLy/liJvlu7roioLngrnkuI7mloflrZfliIbnu4RcbiAgICAgICAgdmFyIGdzID0gZy5hcHBlbmQoJ2cnKVxuICAgICAgICAgIC5zZWxlY3RBbGwoJy5nJylcbiAgICAgICAgICAuZGF0YShub2RlcylcbiAgICAgICAgICAuZW50ZXIoKVxuICAgICAgICAgIC5hcHBlbmQoJ2cnKVxuICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCBmdW5jdGlvbiAoZCwgaSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJEXCIsZClcbiAgICAgICAgICAgIHJldHVybiAndHJhbnNsYXRlKCcgKyBkLmRhdGEucGlkICogNDAgKyAnLCcgKyBkLnggKyAnKSc7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgLy/nu5jliLbmloflrZflkozoioLngrlcbiAgICAgICAgaWYod2luZG93Lml0ZXJhdGlvbiA9PSB1bmRlZmluZWQpe1xuICAgICAgICAgIHdpbmRvdy5pdGVyYXRpb24gPSAxXG4gICAgICAgIH1cbiAgICAgICAgZ3MuYXBwZW5kKCdjaXJjbGUnKVxuICAgICAgICAgIC5hdHRyKCdyJywgOClcbiAgICAgICAgICAuYXR0cignZmlsbCcsIGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIjExMTFcIixkLmRhdGEudmFsdWUsIHdpbmRvdy5pdGVyYXRpb24sIGQuZGF0YS52YWx1ZSA9PSB3aW5kb3cuaXRlcmF0aW9uIClcbiAgICAgICAgICAgIHJldHVybiBkLmRhdGEudmFsdWUgPT0gd2luZG93Lml0ZXJhdGlvbiA/ICdvcmFuZ2UnIDogJyM0NTJkOGEnXG4gICAgICAgICAgfSlcbiAgICAgICAgICAuYXR0cignc3Ryb2tlLXdpZHRoJywgMSlcbiAgICAgICAgICAuYXR0cignc3Ryb2tlJywgZnVuY3Rpb24gKGQsIGkpIHtcbiAgICAgICAgICAgIHJldHVybiBkLmRhdGEudmFsdWUgPT0gd2luZG93Lml0ZXJhdGlvbiA/ICdvcmFuZ2UnIDogJyM0NTJkOGEnXG4gICAgICAgICAgfSlcblxuICAgICAgICBncy5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAgIC5hdHRyKCd4JywgZnVuY3Rpb24gKGQsIGkpIHtcbiAgICAgICAgICAgIHJldHVybiBkLmNoaWxkcmVuID8gNSA6IDEwO1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLmF0dHIoJ3knLCBmdW5jdGlvbiAoZCwgaSkge1xuICAgICAgICAgICAgcmV0dXJuIGQuY2hpbGRyZW4gPyAtMjAgOiAtNTtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5hdHRyKCdkeScsIDEwKVxuICAgICAgICAgIC50ZXh0KGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAgICAgICBpZiAod2luZG93LnNlc3Npb25TdG9yYWdlLnRhc2tUeXBlID09PSAnYWN0aXZlIGxlYXJuaW5nJykge1xuICAgICAgICAgICAgICByZXR1cm4gYCR7ZC5kYXRhLnZhbHVlfXwke2QuZGF0YS5uYW1lfWA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gYCR7ZC5kYXRhLnZhbHVlfWA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICB9KVxuICAgICAgfSlcbiAgICBsZXQgdGhhdCA9IHRoaXNcbiAgICBcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGxldCBsaXN0ID0gc3ZnRG9tLnF1ZXJ5U2VsZWN0b3JBbGwoXCJjaXJjbGVcIik7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxldCBjID0gbGlzdFtpXVxuICAgICAgICBpZiAoYykge1xuICAgICAgICAgIGMuc3R5bGUuY3Vyc29yID0gXCJwb2ludGVyXCJcbiAgICAgICAgICBpZighb25seSl7XG4gICAgICAgICAgICBjLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgICBpZiAoZS50YXJnZXQubmV4dFNpYmxpbmcuaW5uZXJIVE1MICE9IHdpbmRvdy5pdGVyYXRpb24pIHtcbiAgICAgICAgICAgICAgICBsZXQgdmFsdWUgPSBlLnRhcmdldC5uZXh0U2libGluZy5pbm5lckhUTUwuc3BsaXQoXCJ8XCIpWzBdXG4gICAgICAgICAgICAgICAgdGhhdC5wcm9qZWN0aW9uc1BhbmVsLmp1bXBUbyhOdW1iZXIodmFsdWUpKVxuICAgICAgICAgICAgICAgIHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZXRJdGVtKCdhY2NlcHRJbmRpY2F0ZXMnLCBcIlwiKVxuICAgICAgICAgICAgICAgIHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZXRJdGVtKCdyZWplY3RJbmRpY2F0ZXMnLCBcIlwiKVxuICAgICAgICAgICAgICAgIHRoaXMuaW5pdGlhbFRyZWUoKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICByZWFkeXJlZ2lzKCkge1xuICAgIGxldCBlbDogYW55ID0gdGhpcy4kJCgnI21ldGFkYXRhLWNhcmQnKVxuICAgIGlmICghZWwpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBsZXQgdGhhdCA9IHRoaXNcbiAgICB0aGlzLnJlZ2lzdGVyZWQgPSB0cnVlXG4gICAgZWwub25tb3VzZWRvd24gPSBmdW5jdGlvbiAoZTogYW55KSB7XG4gICAgICBlID0gZSB8fCB3aW5kb3cuZXZlbnQ7XG4gICAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICdtb3ZlJ1xuXG4gICAgICAvLyDliJ3lp4vkvY3nva5cbiAgICAgIGxldCBvZmZsZWZ0ID0gTnVtYmVyKHRoYXQubWV0YWRhdGFTdHlsZS5sZWZ0LnJlcGxhY2UoJ3B4JywgJycpKSB8fCAwO1xuICAgICAgbGV0IG9mZlRvcCA9IE51bWJlcih0aGF0Lm1ldGFkYXRhU3R5bGUudG9wLnJlcGxhY2UoJ3B4JywgJycpKSB8fCAwO1xuICAgICAgLy8g6byg5qCH54K55Ye75L2N572uXG4gICAgICBsZXQgc3RhcnRYID0gZS5jbGllbnRYO1xuICAgICAgbGV0IHN0YXJ0WSA9IGUuY2xpZW50WTtcblxuICAgICAgZWwuc2V0Q2FwdHVyZSAmJiBlbC5zZXRDYXB0dXJlKCk7XG5cblxuICAgICAgY29uc3QgaGFuZGxlciA9IGZ1bmN0aW9uIChldmVudDogYW55KSB7XG4gICAgICAgIGV2ZW50ID0gZXZlbnQgfHwgd2luZG93LmV2ZW50O1xuXG4gICAgICAgIC8vIG1vdXNlIHN0b3AgcG9zaXRpb25cbiAgICAgICAgbGV0IGVuZFggPSBldmVudC5jbGllbnRYO1xuICAgICAgICBsZXQgZW5kWSA9IGV2ZW50LmNsaWVudFk7XG5cbiAgICAgICAgLy8gZGlzdGFuY2VcbiAgICAgICAgbGV0IG1vdmVYID0gZW5kWCAtIHN0YXJ0WDtcbiAgICAgICAgbGV0IG1vdmVZID0gZW5kWSAtIHN0YXJ0WTtcblxuICAgICAgICAvLyBmaW5hbCBwb3NpdGlvblxuICAgICAgICBsZXQgbGFzdFggPSBvZmZsZWZ0ICsgbW92ZVg7XG4gICAgICAgIGxldCBsYXN0WSA9IG9mZlRvcCArIG1vdmVZO1xuXG4gICAgICAgIC8vYm91bmRyeVxuICAgICAgICBpZiAoXG4gICAgICAgICAgbGFzdFggPlxuICAgICAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCAtIGVsLmNsaWVudFdpZHRoIC0gMjBcbiAgICAgICAgKSB7XG4gICAgICAgICAgbGFzdFggPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGggLSBlbC5jbGllbnRXaWR0aCAtIDIwO1xuICAgICAgICB9IGVsc2UgaWYgKGxhc3RYIDwgMjApIHtcbiAgICAgICAgICBsYXN0WCA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXG4gICAgICAgICAgbGFzdFkgPlxuICAgICAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCAtIGVsLmNsaWVudFdpZHRoIC0gMjBcbiAgICAgICAgKSB7XG4gICAgICAgICAgbGFzdFkgPVxuICAgICAgICAgICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudEhlaWdodCAtIGVsLmNsaWVudEhlaWdodCAtIDIwO1xuICAgICAgICB9IGVsc2UgaWYgKGxhc3RZIDwgMjApIHtcbiAgICAgICAgICBsYXN0WSA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBlbC5zdHlsZS5sZWZ0ID0gbGFzdFggKyBcInB4XCI7XG4gICAgICAgIGVsLnN0eWxlLnRvcCA9IGxhc3RZICsgXCJweFwiO1xuICAgICAgICB0aGF0Lm1ldGFkYXRhU3R5bGUgPSB7XG4gICAgICAgICAgbGVmdDogbGFzdFggKyBcInB4XCIsXG4gICAgICAgICAgdG9wOiBsYXN0WSArIFwicHhcIlxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgaGFuZGxlciwgZmFsc2UpO1xuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ21vdXNldXAnLFxuICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnZGVmYXVsdCdcbiAgICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBoYW5kbGVyKTtcbiAgICAgICAgfSxcbiAgICAgICAgZmFsc2UsXG4gICAgICApO1xuICAgICAgLy9cbiAgICAgIGRvY3VtZW50Lm9ubW91c2V1cCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZG9jdW1lbnQub250b3VjaG1vdmUgPSBudWxsO1xuICAgICAgICAvL0B0cy1pZ25vcmVcbiAgICAgICAgZG9jdW1lbnQucmVsZWFzZUNhcHR1cmUgJiYgZG9jdW1lbnQucmVsZWFzZUNhcHR1cmUoKTtcbiAgICAgIH07XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgQG9ic2VydmUoJ3Nob3dsYWJlbGVkJylcbiAgX2xhYmVsZWRDaGFuZ2VkKCkge1xuICAgIGxldCBpbmRpY2F0ZXMgPSBbXVxuICAgIGlmICh3aW5kb3cubm93U2hvd0luZGljYXRlcykge1xuICAgICAgaWYgKHRoaXMuc2hvd2xhYmVsZWQpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGxldCBpbmRpY2F0ZSA9IHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dW2ldXG4gICAgICAgICAgaWYgKGluZGljYXRlID09PSAwIHx8IHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzLmluZGV4T2YoaSkgIT09IC0xKSB7XG4gICAgICAgICAgICBpbmRpY2F0ZXMucHVzaChpKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB3aW5kb3cubm93U2hvd0luZGljYXRlcyA9IGluZGljYXRlc1xuICAgICAgICAvLyB0aGlzLnByb2plY3Rvci5maWx0ZXJEYXRhc2V0KHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8v6ZqQ6JePbGFiZWxlZFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dW2ldICE9PSAwICYmIHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzLmluZGV4T2YoaSkgIT09IC0xKSB7XG4gICAgICAgICAgICBpbmRpY2F0ZXMucHVzaChpKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB3aW5kb3cubm93U2hvd0luZGljYXRlcyA9IGluZGljYXRlc1xuICAgICAgfVxuICAgICAgdGhpcy5maWx0ZXJEYXRhc2V0KHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzKVxuICAgIH1cbiAgfVxuXG4gIEBvYnNlcnZlKCdzaG93VW5sYWJlbGVkJylcbiAgX3VuTGFiZWxDaGFuZ2VkKCkge1xuICAgIGxldCBpbmRpY2F0ZXMgPSBbXVxuICAgIGlmICh3aW5kb3cubm93U2hvd0luZGljYXRlcykge1xuICAgICAgaWYgKHRoaXMuc2hvd1VubGFiZWxlZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgbGV0IGluZGljYXRlID0gd2luZG93LnByb3BlcnRpZXNbd2luZG93Lml0ZXJhdGlvbl1baV1cbiAgICAgICAgICBpZiAoaW5kaWNhdGUgPT09IDEgfHwgd2luZG93Lm5vd1Nob3dJbmRpY2F0ZXMuaW5kZXhPZihpKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIGluZGljYXRlcy5wdXNoKGkpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzID0gaW5kaWNhdGVzXG4gICAgICAgIC8vIHRoaXMucHJvamVjdG9yLmZpbHRlckRhdGFzZXQod2luZG93Lm5vd1Nob3dJbmRpY2F0ZXMpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dW2ldICE9PSAxICYmIHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzLmluZGV4T2YoaSkgIT09IC0xKSB7XG4gICAgICAgICAgICBpbmRpY2F0ZXMucHVzaChpKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB3aW5kb3cubm93U2hvd0luZGljYXRlcyA9IGluZGljYXRlc1xuICAgICAgfVxuICAgICAgdGhpcy5maWx0ZXJEYXRhc2V0KHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzKVxuICAgIH1cbiAgfVxuXG4gIEBvYnNlcnZlKCdzaG93VGVzdGluZycpXG4gIF90ZXN0aW5nQ2hhbmdlZCgpIHtcbiAgICBsZXQgaW5kaWNhdGVzID0gW11cbiAgICBpZiAod2luZG93Lm5vd1Nob3dJbmRpY2F0ZXMpIHtcbiAgICAgIGlmICh0aGlzLnNob3dUZXN0aW5nKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgd2luZG93LnByb3BlcnRpZXNbd2luZG93Lml0ZXJhdGlvbl0ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBsZXQgaW5kaWNhdGUgPSB3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXVtpXVxuICAgICAgICAgIGlmIChpbmRpY2F0ZSA9PT0gMiB8fCB3aW5kb3cubm93U2hvd0luZGljYXRlcy5pbmRleE9mKGkpICE9PSAtMSkge1xuICAgICAgICAgICAgaW5kaWNhdGVzLnB1c2goaSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgd2luZG93Lm5vd1Nob3dJbmRpY2F0ZXMgPSBpbmRpY2F0ZXNcbiAgICAgICAgLy8gdGhpcy5wcm9qZWN0b3IuZmlsdGVyRGF0YXNldCh3aW5kb3cubm93U2hvd0luZGljYXRlcylcbiAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmICh3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXVtpXSAhPT0gMiAmJiB3aW5kb3cubm93U2hvd0luZGljYXRlcy5pbmRleE9mKGkpICE9PSAtMSkge1xuICAgICAgICAgICAgaW5kaWNhdGVzLnB1c2goaSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgd2luZG93Lm5vd1Nob3dJbmRpY2F0ZXMgPSBpbmRpY2F0ZXNcbiAgICAgIH1cbiAgICAgIHRoaXMuZmlsdGVyRGF0YXNldCh3aW5kb3cubm93U2hvd0luZGljYXRlcylcbiAgICB9XG4gIH1cblxuICBvbkl0ZXJhdGlvbkNoYW5nZShudW06IG51bWJlcikge1xuICAgIHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZXRJdGVtKCdpdGVyYXRpb24nLCBTdHJpbmcobnVtKSlcbiAgICAvLyB3aW5kb3cuaXRlcmF0aW9uID0gbnVtO1xuICAgIGxldCBpbmRpY2F0ZXMgPSBbXVxuICAgIHRoaXMuaXRlcmF0aW9uID0gbnVtO1xuICAgIGlmICghd2luZG93LmlzQW5pbWF0YXRpbmcpIHtcbiAgICAgIGlmICh0aGlzLnNob3dUZXN0aW5nID09PSBmYWxzZSkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dW2ldICE9PSAyICYmIHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzLmluZGV4T2YoaSkgIT09IC0xKSB7XG4gICAgICAgICAgICBpbmRpY2F0ZXMucHVzaChpKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB3aW5kb3cubm93U2hvd0luZGljYXRlcyA9IGluZGljYXRlc1xuICAgICAgfVxuICAgICAgdGhpcy5maWx0ZXJEYXRhc2V0KHdpbmRvdy5ub3dTaG93SW5kaWNhdGVzKVxuXG4gICAgfVxuICAgIGlmICh0aGlzLmluc3BlY3RvclBhbmVsKSB7XG4gICAgICBpZiAod2luZG93LnNlc3Npb25TdG9yYWdlLnRhc2tUeXBlID09PSAnYWN0aXZlIGxlYXJuaW5nJyAmJiB3aW5kb3cuaXRlcmF0aW9uICE9PSAxKSB7XG4gICAgICAgIHRoaXMuaW5zcGVjdG9yUGFuZWwudXBkYXRlRGlzYWJsZWRTdGF0dWVzKHRydWUpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmluc3BlY3RvclBhbmVsLnVwZGF0ZURpc2FibGVkU3RhdHVlcyhmYWxzZSlcbiAgICAgIH1cblxuICAgIH1cbiAgICB0aGlzLmluaXRpYWxUcmVlKClcbiAgfVxuXG4gIHNldFNlbGVjdGVkTGFiZWxPcHRpb24obGFiZWxPcHRpb246IHN0cmluZykge1xuICAgIHRoaXMuc2VsZWN0ZWRMYWJlbE9wdGlvbiA9IGxhYmVsT3B0aW9uO1xuICAgIHRoaXMubWV0YWRhdGFDYXJkLnNldExhYmVsT3B0aW9uKHRoaXMuc2VsZWN0ZWRMYWJlbE9wdGlvbik7XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIuc2V0TGFiZWxQb2ludEFjY2Vzc29yKGxhYmVsT3B0aW9uKTtcbiAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci51cGRhdGVTY2F0dGVyUGxvdEF0dHJpYnV0ZXMoKTtcbiAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5yZW5kZXIoKTtcbiAgfVxuICBzZXRTZWxlY3RlZENvbG9yT3B0aW9uKGNvbG9yT3B0aW9uOiBDb2xvck9wdGlvbikge1xuICAgIHRoaXMuc2VsZWN0ZWRDb2xvck9wdGlvbiA9IGNvbG9yT3B0aW9uO1xuICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnNldExlZ2VuZFBvaW50Q29sb3JlcihcbiAgICAgIHRoaXMuZ2V0TGVnZW5kUG9pbnRDb2xvcmVyKGNvbG9yT3B0aW9uKVxuICAgICk7XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIudXBkYXRlU2NhdHRlclBsb3RBdHRyaWJ1dGVzKCk7XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIucmVuZGVyKCk7XG4gIH1cbiAgc2V0Tm9ybWFsaXplRGF0YShub3JtYWxpemVEYXRhOiBib29sZWFuKSB7XG4gICAgdGhpcy5ub3JtYWxpemVEYXRhID0gbm9ybWFsaXplRGF0YTtcbiAgICB0aGlzLnNldEN1cnJlbnREYXRhU2V0KHRoaXMub3JpZ2luYWxEYXRhU2V0LmdldFN1YnNldCgpKTtcbiAgfVxuICB1cGRhdGVEYXRhU2V0KFxuICAgIGRzOiBEYXRhU2V0LFxuICAgIHNwcml0ZUFuZE1ldGFkYXRhPzogU3ByaXRlQW5kTWV0YWRhdGFJbmZvLFxuICAgIG1ldGFkYXRhRmlsZT86IHN0cmluZ1xuICApIHtcbiAgICB0aGlzLmRhdGFTZXRGaWx0ZXJJbmRpY2VzID0gbnVsbDtcbiAgICB0aGlzLm9yaWdpbmFsRGF0YVNldCA9IGRzO1xuICAgIGlmIChkcyAhPSBudWxsKSB7XG4gICAgICB0aGlzLm5vcm1hbGl6ZURhdGEgPVxuICAgICAgICB0aGlzLm9yaWdpbmFsRGF0YVNldC5kaW1bMV0gPj0gVEhSRVNIT0xEX0RJTV9OT1JNQUxJWkU7XG4gICAgICBzcHJpdGVBbmRNZXRhZGF0YSA9IHNwcml0ZUFuZE1ldGFkYXRhIHx8IHt9O1xuICAgICAgaWYgKHNwcml0ZUFuZE1ldGFkYXRhLnBvaW50c0luZm8gPT0gbnVsbCkge1xuICAgICAgICBsZXQgW3BvaW50c0luZm8sIHN0YXRzXSA9IHRoaXMubWFrZURlZmF1bHRQb2ludHNJbmZvQW5kU3RhdHMoZHMucG9pbnRzKTtcbiAgICAgICAgc3ByaXRlQW5kTWV0YWRhdGEucG9pbnRzSW5mbyA9IHBvaW50c0luZm87XG4gICAgICAgIHNwcml0ZUFuZE1ldGFkYXRhLnN0YXRzID0gc3RhdHM7XG4gICAgICB9XG4gICAgICBsZXQgbWV0YWRhdGFNZXJnZVN1Y2NlZWRlZCA9IGRzLm1lcmdlTWV0YWRhdGEoc3ByaXRlQW5kTWV0YWRhdGEpO1xuICAgICAgaWYgKCFtZXRhZGF0YU1lcmdlU3VjY2VlZGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyICE9IG51bGwpIHtcbiAgICAgIGlmIChkcyA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnNldExhYmVsUG9pbnRBY2Nlc3NvcihudWxsKTtcbiAgICAgICAgdGhpcy5zZXRQcm9qZWN0aW9uKG51bGwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIudXBkYXRlU2NhdHRlclBsb3RQb3NpdGlvbnMoKTtcbiAgICAgICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIudXBkYXRlU2NhdHRlclBsb3RBdHRyaWJ1dGVzKCk7XG4gICAgICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnJlc2l6ZSgpO1xuICAgICAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5yZW5kZXIoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGRzICE9IG51bGwpIHtcbiAgICAgIHRoaXMuZGF0YVBhbmVsLnNldE5vcm1hbGl6ZURhdGEodGhpcy5ub3JtYWxpemVEYXRhKTtcbiAgICAgIHRoaXMuc2V0Q3VycmVudERhdGFTZXQoZHMuZ2V0U3Vic2V0KCkpO1xuICAgICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIuc2V0TGFiZWxQb2ludEFjY2Vzc29yKFxuICAgICAgICB0aGlzLnNlbGVjdGVkTGFiZWxPcHRpb25cbiAgICAgICk7XG4gICAgICB0aGlzLmluc3BlY3RvclBhbmVsLmRhdGFzZXRDaGFuZ2VkKCk7XG4gICAgICB0aGlzLmluc3BlY3RvclBhbmVsLm1ldGFkYXRhQ2hhbmdlZChzcHJpdGVBbmRNZXRhZGF0YSk7XG4gICAgICB0aGlzLnByb2plY3Rpb25zUGFuZWwubWV0YWRhdGFDaGFuZ2VkKHNwcml0ZUFuZE1ldGFkYXRhKTtcbiAgICAgIHRoaXMuZGF0YVBhbmVsLm1ldGFkYXRhQ2hhbmdlZChzcHJpdGVBbmRNZXRhZGF0YSwgbWV0YWRhdGFGaWxlKTtcbiAgICAgIC8vcmVzZXRcbiAgICAgIGlmICh3aW5kb3cuc2Vzc2lvblN0b3JhZ2UuaXRlcmF0aW9uKSB7XG4gICAgICAgIHRoaXMucHJvamVjdGlvbnNQYW5lbC5qdW1wVG8oTnVtYmVyKHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5pdGVyYXRpb24pKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5wcm9qZWN0aW9uc1BhbmVsLmp1bXBUbyhOdW1iZXIoMSkpXG4gICAgICB9XG4gICAgICAvL3Jlc2V0XG4gICAgICBpZiAod2luZG93LnNlc3Npb25TdG9yYWdlLmFjY2VwdEluZGljYXRlcykge1xuICAgICAgICB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzID0gd2luZG93LnNlc3Npb25TdG9yYWdlLmFjY2VwdEluZGljYXRlcy5zcGxpdChcIixcIikubWFwKHBhcnNlRmxvYXQpXG4gICAgICB9XG4gICAgICBpZiAod2luZG93LnNlc3Npb25TdG9yYWdlLnJlamVjdEluZGljYXRlcykge1xuICAgICAgICB3aW5kb3cucmVqZWN0SW5kaWNhdGVzID0gd2luZG93LnNlc3Npb25TdG9yYWdlLnJlamVjdEluZGljYXRlcy5zcGxpdChcIixcIikubWFwKHBhcnNlRmxvYXQpXG4gICAgICB9XG4gICAgICBpZiAod2luZG93LnNlc3Npb25TdG9yYWdlLmN1c3RvbVNlbGVjdGlvbikge1xuICAgICAgICB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uID0gd2luZG93LnNlc3Npb25TdG9yYWdlLmN1c3RvbVNlbGVjdGlvbi5zcGxpdChcIixcIikubWFwKHBhcnNlRmxvYXQpXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2V0Q3VycmVudERhdGFTZXQobnVsbCk7XG4gICAgICAvLyB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlclxuICAgIH1cbiAgfVxuICBtZXRhZGF0YUVkaXQobWV0YWRhdGFDb2x1bW46IHN0cmluZywgbWV0YWRhdGFMYWJlbDogc3RyaW5nKSB7XG4gICAgdGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcy5mb3JFYWNoKFxuICAgICAgKGkpID0+ICh0aGlzLmRhdGFTZXQucG9pbnRzW2ldLm1ldGFkYXRhW21ldGFkYXRhQ29sdW1uXSA9IG1ldGFkYXRhTGFiZWwpXG4gICAgKTtcbiAgICB0aGlzLm5laWdoYm9yc09mRmlyc3RQb2ludC5mb3JFYWNoKFxuICAgICAgKHApID0+XG4gICAgICAgICh0aGlzLmRhdGFTZXQucG9pbnRzW3AuaW5kZXhdLm1ldGFkYXRhW21ldGFkYXRhQ29sdW1uXSA9IG1ldGFkYXRhTGFiZWwpXG4gICAgKTtcbiAgICB0aGlzLmRhdGFTZXQuc3ByaXRlQW5kTWV0YWRhdGFJbmZvLnN0YXRzID0gYW5hbHl6ZU1ldGFkYXRhKFxuICAgICAgdGhpcy5kYXRhU2V0LnNwcml0ZUFuZE1ldGFkYXRhSW5mby5zdGF0cy5tYXAoKHMpID0+IHMubmFtZSksXG4gICAgICB0aGlzLmRhdGFTZXQucG9pbnRzLm1hcCgocCkgPT4gcC5tZXRhZGF0YSlcbiAgICApO1xuICAgIHRoaXMubWV0YWRhdGFDaGFuZ2VkKHRoaXMuZGF0YVNldC5zcHJpdGVBbmRNZXRhZGF0YUluZm8pO1xuICAgIHRoaXMubWV0YWRhdGFFZGl0b3JDb250ZXh0KHRydWUsIG1ldGFkYXRhQ29sdW1uKTtcbiAgfVxuICBtZXRhZGF0YUNoYW5nZWQoXG4gICAgc3ByaXRlQW5kTWV0YWRhdGE6IFNwcml0ZUFuZE1ldGFkYXRhSW5mbyxcbiAgICBtZXRhZGF0YUZpbGU/OiBzdHJpbmdcbiAgKSB7XG4gICAgaWYgKG1ldGFkYXRhRmlsZSAhPSBudWxsKSB7XG4gICAgICB0aGlzLm1ldGFkYXRhRmlsZSA9IG1ldGFkYXRhRmlsZTtcbiAgICB9XG5cbiAgICB0aGlzLmRhdGFTZXQuc3ByaXRlQW5kTWV0YWRhdGFJbmZvID0gc3ByaXRlQW5kTWV0YWRhdGE7XG4gICAgdGhpcy5wcm9qZWN0aW9uc1BhbmVsLm1ldGFkYXRhQ2hhbmdlZChzcHJpdGVBbmRNZXRhZGF0YSk7XG4gICAgdGhpcy5pbnNwZWN0b3JQYW5lbC5tZXRhZGF0YUNoYW5nZWQoc3ByaXRlQW5kTWV0YWRhdGEpO1xuICAgIHRoaXMuZGF0YVBhbmVsLm1ldGFkYXRhQ2hhbmdlZChzcHJpdGVBbmRNZXRhZGF0YSwgdGhpcy5tZXRhZGF0YUZpbGUpO1xuICAgIGlmICh0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIGF0IGxlYXN0IG9uZSBzZWxlY3RlZCBwb2ludFxuICAgICAgdGhpcy5tZXRhZGF0YUNhcmQudXBkYXRlTWV0YWRhdGEoXG4gICAgICAgIC8vIHNob3cgbWV0YWRhdGEgZm9yIGZpcnN0IHNlbGVjdGVkIHBvaW50XG4gICAgICAgIHRoaXMuZGF0YVNldC5wb2ludHNbdGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlc1swXV0ubWV0YWRhdGFcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG5vIHBvaW50cyBzZWxlY3RlZFxuICAgICAgdGhpcy5tZXRhZGF0YUNhcmQudXBkYXRlTWV0YWRhdGEobnVsbCk7IC8vIGNsZWFyIG1ldGFkYXRhXG4gICAgfVxuICAgIHRoaXMuc2V0U2VsZWN0ZWRMYWJlbE9wdGlvbih0aGlzLnNlbGVjdGVkTGFiZWxPcHRpb24pO1xuICB9XG4gIG1ldGFkYXRhRWRpdG9yQ29udGV4dChlbmFibGVkOiBib29sZWFuLCBtZXRhZGF0YUNvbHVtbjogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuaW5zcGVjdG9yUGFuZWwpIHtcbiAgICAgIHRoaXMuaW5zcGVjdG9yUGFuZWwubWV0YWRhdGFFZGl0b3JDb250ZXh0KGVuYWJsZWQsIG1ldGFkYXRhQ29sdW1uKTtcbiAgICB9XG4gIH1cbiAgc2V0U2VsZWN0ZWRUZW5zb3IocnVuOiBzdHJpbmcsIHRlbnNvckluZm86IEVtYmVkZGluZ0luZm8pIHtcbiAgICB0aGlzLmJvb2ttYXJrUGFuZWwuc2V0U2VsZWN0ZWRUZW5zb3IocnVuLCB0ZW5zb3JJbmZvLCB0aGlzLmRhdGFQcm92aWRlcik7XG4gIH1cbiAgdXBkYXRlQmFja2dyb3VuZEltZygpIHtcbiAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci51cGRhdGVCYWNrZ3JvdW5kKClcbiAgfVxuICAvKipcbiAgICogUmVnaXN0ZXJzIGEgbGlzdGVuZXIgdG8gYmUgY2FsbGVkIGFueSB0aW1lIHRoZSBzZWxlY3RlZCBwb2ludCBzZXQgY2hhbmdlcy5cbiAgICovXG4gIHJlZ2lzdGVyU2VsZWN0aW9uQ2hhbmdlZExpc3RlbmVyKGxpc3RlbmVyOiBTZWxlY3Rpb25DaGFuZ2VkTGlzdGVuZXIpIHtcbiAgICB0aGlzLnNlbGVjdGlvbkNoYW5nZWRMaXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG4gIH1cbiAgZmlsdGVyRGF0YXNldChwb2ludEluZGljZXM6IG51bWJlcltdLCBmaWx0ZXI/OiBib29sZWFuKSB7XG4gICAgY29uc3Qgc2VsZWN0aW9uU2l6ZSA9IHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMubGVuZ3RoO1xuICAgIC8qXG4gICAgaWYgKHRoaXMuZGF0YVNldEJlZm9yZUZpbHRlciA9PSBudWxsKSB7XG4gICAgICB0aGlzLmRhdGFTZXRCZWZvcmVGaWx0ZXIgPSB0aGlzLmRhdGFTZXQ7XG4gICAgfSovXG4gICAgY29uc29sZS5sb2coJ25vdycscG9pbnRJbmRpY2VzLmxlbmd0aCx0aGlzLmRhdGFTZXQpXG4gICAgdGhpcy5kYXRhU2V0LnNldERWSUZpbHRlcmVkRGF0YShwb2ludEluZGljZXMpO1xuICAgIC8vIHRoaXMuc2V0Q3VycmVudERhdGFTZXQodGhpcy5kYXRhU2V0LmdldFN1YnNldChwb2ludEluZGljZXMpKTtcbiAgICB0aGlzLmRhdGFTZXRGaWx0ZXJJbmRpY2VzID0gcG9pbnRJbmRpY2VzO1xuICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnVwZGF0ZVNjYXR0ZXJQbG90UG9zaXRpb25zKCk7XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIudXBkYXRlU2NhdHRlclBsb3RBdHRyaWJ1dGVzKGZpbHRlcik7XG4gICAgLy8gdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIudXBkYXRlQmFja2dyb3VuZCgpXG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIucmVuZGVyKClcbiAgICAvLyB0aGlzLmFkanVzdFNlbGVjdGlvbkFuZEhvdmVyKHV0aWwucmFuZ2Uoc2VsZWN0aW9uU2l6ZSkpO1xuXG4gICAgaWYgKHdpbmRvdy5pc0FkanVzdGluZ1NlbCkge1xuICAgICAgLy8gdGhpcy5ib3VuZGluZ1NlbGVjdGlvbkJ0bi5jbGFzc0xpc3QuYWRkKCdhY3RpdmVkJylcbiAgICAgIHRoaXMuc2V0TW91c2VNb2RlKE1vdXNlTW9kZS5BUkVBX1NFTEVDVClcbiAgICB9XG4gIH1cbiAgcmVzZXRGaWx0ZXJEYXRhc2V0KG51bT8pIHtcbiAgICBjb25zdCBvcmlnaW5hbFBvaW50SW5kaWNlcyA9IHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMubWFwKFxuICAgICAgKGZpbHRlcmVkSW5kZXgpID0+IHRoaXMuZGF0YVNldC5wb2ludHNbZmlsdGVyZWRJbmRleF0uaW5kZXhcbiAgICApO1xuICAgIC8qXG4gICAgdGhpcy5zZXRDdXJyZW50RGF0YVNldCh0aGlzLmRhdGFTZXRCZWZvcmVGaWx0ZXIpO1xuICAgIGlmICh0aGlzLnByb2plY3Rpb24gIT0gbnVsbCkge1xuICAgICAgdGhpcy5wcm9qZWN0aW9uLmRhdGFTZXQgPSB0aGlzLmRhdGFTZXRCZWZvcmVGaWx0ZXI7XG4gICAgfVxuICAgIHRoaXMuZGF0YVNldEJlZm9yZUZpbHRlciA9IG51bGw7Ki9cbiAgICAvLyBzZXREVklmaWx0ZXIgYWxsIGRhdGFcbiAgICBsZXQgdG90YWwgPSB0aGlzLmRhdGFTZXQuRFZJVmFsaWRQb2ludE51bWJlclt0aGlzLmRhdGFTZXQudFNORUl0ZXJhdGlvbl1cbiAgICBpZiAobnVtKSB7XG4gICAgICB0b3RhbCA9IG51bVxuICAgIH1cblxuICAgIHZhciBpbmRpY2VzOiBudW1iZXJbXTtcbiAgICBpbmRpY2VzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0b3RhbDsgaSsrKSB7XG4gICAgICBpbmRpY2VzLnB1c2goaSk7XG4gICAgfVxuICAgIHRoaXMuZGF0YVNldEZpbHRlckluZGljZXMgPSBpbmRpY2VzO1xuICAgIHRoaXMuZGF0YVNldC5zZXREVklGaWx0ZXJlZERhdGEoaW5kaWNlcyk7XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIudXBkYXRlU2NhdHRlclBsb3RQb3NpdGlvbnMoKTtcbiAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci51cGRhdGVTY2F0dGVyUGxvdEF0dHJpYnV0ZXMoKTtcbiAgICAvLyB0aGlzLmFkanVzdFNlbGVjdGlvbkFuZEhvdmVyKHV0aWwucmFuZ2Uoc2VsZWN0aW9uU2l6ZSkpO1xuXG4gIH1cbiAgLy8vXG4gIHNldER5bmFtaWNOb2lzeSgpIHtcbiAgICAvLyB0aGlzLnNldER5bmFtaWNTdG9wKClcbiAgICBpZiAoIXdpbmRvdy5jdXN0b21TZWxlY3Rpb24pIHtcbiAgICAgIHdpbmRvdy5jdXN0b21TZWxlY3Rpb24gPSBbXVxuICAgIH1cbiAgICBpZiAoIXdpbmRvdy5xdWVyeVJlc0Fub3JtYWxDbGVhbkluZGVjYXRlcykge1xuICAgICAgd2luZG93LnF1ZXJ5UmVzQW5vcm1hbENsZWFuSW5kZWNhdGVzID0gW11cbiAgICB9XG4gICAgbGV0IGluZGVjYXRlcyA9IHdpbmRvdy5xdWVyeVJlc0Fub3JtYWxDbGVhbkluZGVjYXRlcy5jb25jYXQod2luZG93LmN1c3RvbVNlbGVjdGlvbilcbiAgICBpZiAoaW5kZWNhdGVzICYmIGluZGVjYXRlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuZmlsdGVyRGF0YXNldChpbmRlY2F0ZXMpXG4gICAgfVxuICAgIC8vIHRoaXMuZmlsdGVyRGF0YXNldCh0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzKVxuICAgIHRoaXMuY3VycmVudEl0ZXJhdGlvbiA9IHdpbmRvdy5pdGVyYXRpb25cblxuICAgIGxldCBjdXJyZW50ID0gMVxuICAgIGxldCBwb3NpdGlvbnMgPSB3aW5kb3cuYWxsUmVzUG9zaXRpb25zPy5yZXN1bHRzXG4gICAgbGV0IGludGVyYXRpb25MaXN0ID0gW11cbiAgICBpZiAod2luZG93LmFsbFJlc1Bvc2l0aW9ucyAmJiB3aW5kb3cuYWxsUmVzUG9zaXRpb25zLmJnaW1nTGlzdCkge1xuICAgICAgd2luZG93LnNjZW5lQmFja2dyb3VuZEltZyA9IHdpbmRvdy5hbGxSZXNQb3NpdGlvbnM/LmJnaW1nTGlzdFxuICAgIH1cbiAgICBmb3IgKGxldCBrZXkgb2YgT2JqZWN0LmtleXMod2luZG93LmFsbFJlc1Bvc2l0aW9ucz8ucmVzdWx0cykpIHtcbiAgICAgIGludGVyYXRpb25MaXN0LnB1c2goTnVtYmVyKGtleSkpXG4gICAgfVxuICAgIGN1cnJlbnQgPSBOdW1iZXIoaW50ZXJhdGlvbkxpc3RbMF0pXG4gICAgbGV0IGNvdW50ID0gMFxuICAgIGlmICh0aGlzLmludGVydmFsRmxhZykge1xuICAgICAgdGhpcy5pbnRlcnZhbEZsYWcgPSBmYWxzZVxuICAgICAgdGhpcy50aW1lciA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG5cbiAgICAgICAgdGhpcy5pbnNwZWN0b3JQYW5lbC51cGRhdGVDdXJyZW50UGxheUVwb2NoKGN1cnJlbnQpXG4gICAgICAgIHdpbmRvdy5pdGVyYXRpb24gPSBjdXJyZW50O1xuICAgICAgICBsZXQgbGVuZ3RoID0gdGhpcy5kYXRhU2V0LnBvaW50cy5sZW5ndGhcbiAgICAgICAgaWYgKGxlbmd0aCA9PT0gNjAwMDIpIHtcbiAgICAgICAgICBsZXQgcG9pbnQxID0gdGhpcy5kYXRhU2V0LnBvaW50c1tsZW5ndGggLSAyXTtcbiAgICAgICAgICBsZXQgcG9pbnQyID0gdGhpcy5kYXRhU2V0LnBvaW50c1tsZW5ndGggLSAxXTtcbiAgICAgICAgICBwb2ludDEucHJvamVjdGlvbnNbJ3RzbmUtMCddID0gd2luZG93LmFsbFJlc1Bvc2l0aW9ucy5ncmlkW2N1cnJlbnRdWzBdXG4gICAgICAgICAgcG9pbnQxLnByb2plY3Rpb25zWyd0c25lLTEnXSA9IHdpbmRvdy5hbGxSZXNQb3NpdGlvbnMuZ3JpZFtjdXJyZW50XVsxXVxuICAgICAgICAgIHBvaW50Mi5wcm9qZWN0aW9uc1sndHNuZS0wJ10gPSB3aW5kb3cuYWxsUmVzUG9zaXRpb25zLmdyaWRbY3VycmVudF1bMl1cbiAgICAgICAgICBwb2ludDIucHJvamVjdGlvbnNbJ3RzbmUtMSddID0gd2luZG93LmFsbFJlc1Bvc2l0aW9ucy5ncmlkW2N1cnJlbnRdWzNdXG4gICAgICAgICAgLy8gcG9pbnQucHJvamVjdGlvbnNbJ3RzbmUtMCddID0gXG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZGF0YVNldC5wb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBwb2ludCA9IHRoaXMuZGF0YVNldC5wb2ludHNbaV07XG4gICAgICAgICAgaWYgKCF3aW5kb3cuY3VzdG9tU2VsZWN0aW9uIHx8ICF3aW5kb3cuY3VzdG9tU2VsZWN0aW9uLmxlbmd0aCB8fCB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uLmluZGV4T2YoaSkgIT09IC0xIHx8IHdpbmRvdy5xdWVyeVJlc0Fub3JtYWxDbGVhbkluZGVjYXRlcz8uaW5kZXhPZihpKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIHBvaW50LnByb2plY3Rpb25zWyd0c25lLTAnXSA9IHBvc2l0aW9uc1tjdXJyZW50XVtpXVswXTtcbiAgICAgICAgICAgIHBvaW50LnByb2plY3Rpb25zWyd0c25lLTEnXSA9IHBvc2l0aW9uc1tjdXJyZW50XVtpXVsxXTtcbiAgICAgICAgICAgIHBvaW50LnByb2plY3Rpb25zWyd0c25lLTInXSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIHRoaXMuZGF0YVNldC51cGRhdGVQcm9qZWN0aW9uKGN1cnJlbnQpXG4gICAgICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnVwZGF0ZVNjYXR0ZXJQbG90UG9zaXRpb25zKCk7XG4gICAgICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnVwZGF0ZVNjYXR0ZXJQbG90QXR0cmlidXRlcygpO1xuICAgICAgICB0aGlzLnVwZGF0ZUJhY2tncm91bmRJbWcoKTtcbiAgICAgICAgdGhpcy5vbkl0ZXJhdGlvbkNoYW5nZShjdXJyZW50KTtcbiAgICAgICAgLy8gdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIudXBkYXRlU2NhdHRlclBsb3RBdHRyaWJ1dGVzKClcbiAgICAgICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIucmVuZGVyKClcbiAgICAgICAgaWYgKGNvdW50ID09IGludGVyYXRpb25MaXN0Lmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICB0aGlzLmluc3BlY3RvclBhbmVsLnBsYXlBbmltYXRpb25GaW5pc2hlZCgpXG4gICAgICAgICAgdGhpcy5zZXREeW5hbWljU3RvcCgpXG4gICAgICAgICAgY3VycmVudCA9IGludGVyYXRpb25MaXN0WzBdXG4gICAgICAgICAgY291bnQgPSAwXG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjdXJyZW50ID0gaW50ZXJhdGlvbkxpc3RbKytjb3VudF1cbiAgICAgICAgfVxuICAgICAgfSwgMTIwMClcbiAgICB9XG5cbiAgfVxuXG4gIHVwZGF0ZVBvc0J5SW5kaWNhdGVzKGN1cnJlbnQ6IG51bWJlcikge1xuICAgIGxldCBwb3NpdGlvbnMgPSB3aW5kb3cuYWxsUmVzUG9zaXRpb25zPy5yZXN1bHRzXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmRhdGFTZXQucG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBwb2ludCA9IHRoaXMuZGF0YVNldC5wb2ludHNbaV07XG4gICAgICBpZiAoIXRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMubGVuZ3RoIHx8IHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMuaW5kZXhPZihpKSAhPT0gLTEpIHtcbiAgICAgICAgcG9pbnQucHJvamVjdGlvbnNbJ3RzbmUtMCddID0gcG9zaXRpb25zW2N1cnJlbnRdW2ldWzBdO1xuICAgICAgICBwb2ludC5wcm9qZWN0aW9uc1sndHNuZS0xJ10gPSBwb3NpdGlvbnNbY3VycmVudF1baV1bMV07XG4gICAgICAgIHBvaW50LnByb2plY3Rpb25zWyd0c25lLTInXSA9IDA7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHRoaXMuZGF0YVNldC51cGRhdGVQcm9qZWN0aW9uKGN1cnJlbnQpXG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIudXBkYXRlU2NhdHRlclBsb3RQb3NpdGlvbnMoKTtcbiAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci51cGRhdGVTY2F0dGVyUGxvdEF0dHJpYnV0ZXMoKTtcbiAgICB0aGlzLnVwZGF0ZUJhY2tncm91bmRJbWcoKTtcbiAgICB0aGlzLm9uSXRlcmF0aW9uQ2hhbmdlKGN1cnJlbnQpO1xuICB9XG4gIHNldER5bmFtaWNTdG9wKCkge1xuICAgIHdpbmRvdy5pc0FuaW1hdGF0aW5nID0gZmFsc2VcbiAgICBpZiAodGhpcy50aW1lciAmJiAhdGhpcy5pbnRlcnZhbEZsYWcpIHtcbiAgICAgIHdpbmRvdy5jbGVhckludGVydmFsKHRoaXMudGltZXIpXG4gICAgICB0aGlzLmludGVydmFsRmxhZyA9IHRydWVcbiAgICAgIHRoaXMucmVzZXRGaWx0ZXJEYXRhc2V0KClcbiAgICB9XG4gICAgbGV0IGVuZCA9IHNldEludGVydmFsKGZ1bmN0aW9uICgpIHsgfSwgMTAwMDApO1xuICAgIGZvciAobGV0IGkgPSAxOyBpIDw9IGVuZDsgaSsrKSB7XG4gICAgICBjbGVhckludGVydmFsKGkpO1xuICAgIH1cblxuICAgIHRoaXMuaXRlcmF0aW9uID0gdGhpcy5jdXJyZW50SXRlcmF0aW9uXG4gICAgbGV0IGxlbmd0aCA9IHRoaXMuZGF0YVNldC5wb2ludHMubGVuZ3RoXG4gICAgaWYgKGxlbmd0aCA9PT0gNjAwMDIpIHtcbiAgICAgIGxldCBwb2ludDEgPSB0aGlzLmRhdGFTZXQucG9pbnRzW2xlbmd0aCAtIDJdO1xuICAgICAgbGV0IHBvaW50MiA9IHRoaXMuZGF0YVNldC5wb2ludHNbbGVuZ3RoIC0gMV07XG4gICAgICBwb2ludDEucHJvamVjdGlvbnNbJ3RzbmUtMCddID0gd2luZG93LmFsbFJlc1Bvc2l0aW9ucy5ncmlkW3RoaXMuaXRlcmF0aW9uXVswXVxuICAgICAgcG9pbnQxLnByb2plY3Rpb25zWyd0c25lLTEnXSA9IHdpbmRvdy5hbGxSZXNQb3NpdGlvbnMuZ3JpZFt0aGlzLml0ZXJhdGlvbl1bMV1cbiAgICAgIHBvaW50Mi5wcm9qZWN0aW9uc1sndHNuZS0wJ10gPSB3aW5kb3cuYWxsUmVzUG9zaXRpb25zLmdyaWRbdGhpcy5pdGVyYXRpb25dWzJdXG4gICAgICBwb2ludDIucHJvamVjdGlvbnNbJ3RzbmUtMSddID0gd2luZG93LmFsbFJlc1Bvc2l0aW9ucy5ncmlkW3RoaXMuaXRlcmF0aW9uXVszXVxuICAgICAgLy8gcG9pbnQucHJvamVjdGlvbnNbJ3RzbmUtMCddID0gXG4gICAgfVxuICAgIHdpbmRvdy5pdGVyYXRpb24gPSB0aGlzLmN1cnJlbnRJdGVyYXRpb25cbiAgICB0aGlzLnVwZGF0ZVBvc0J5SW5kaWNhdGVzKHdpbmRvdy5pdGVyYXRpb24pXG4gIH1cblxuICByZW5kZXJJblRyYWNlTGluZShpblRyYWNlOiBib29sZWFuKSB7XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIuc2V0UmVuZGVySW5UcmFjZUxpbmUoaW5UcmFjZSlcbiAgfVxuXG4gIHJlZnJlc2goKSB7XG4gICAgY29uc29sZS5sb2coJ3JyZWVmZmYnKVxuICAgIC8vIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnNjYXR0ZXJQbG90LnJlbmRlcigpXG4gICAgdGhpcy5tZXRhZGF0YUNhcmQudXBkYXRlQ3VzdG9tTGlzdCh0aGlzLmRhdGFTZXQucG9pbnRzLCB0aGlzIGFzIFByb2plY3RvckV2ZW50Q29udGV4dClcbiAgICB0aGlzLm1ldGFkYXRhQ2FyZC51cGRhdGVSZWplY3RMaXN0KHRoaXMuZGF0YVNldC5wb2ludHMsIHRoaXMgYXMgUHJvamVjdG9yRXZlbnRDb250ZXh0KVxuICAgIC8vIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnNjYXR0ZXJQbG90LnJlbmRlcigpXG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIudXBkYXRlU2NhdHRlclBsb3RBdHRyaWJ1dGVzKClcbiAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5yZW5kZXIoKVxuICB9XG4gIHJlbW92ZWN1c3RvbUluTWV0YUNhcmQoKSB7XG4gICAgdGhpcy5tZXRhZGF0YUNhcmQudXBkYXRlQ3VzdG9tTGlzdCh0aGlzLmRhdGFTZXQucG9pbnRzLCB0aGlzIGFzIFByb2plY3RvckV2ZW50Q29udGV4dClcbiAgICB0aGlzLm1ldGFkYXRhQ2FyZC51cGRhdGVSZWplY3RMaXN0KHRoaXMuZGF0YVNldC5wb2ludHMsIHRoaXMgYXMgUHJvamVjdG9yRXZlbnRDb250ZXh0KVxuICAgIC8vIHRoaXMuaW5zcGVjdG9yUGFuZWwucmVmcmVzaFNlYXJjaFJlc3VsdCgpXG4gICAgdGhpcy5pbnNwZWN0b3JQYW5lbC51cGRhdGVTZXNzaW9uU3RvcmFnZSgpXG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIudXBkYXRlU2NhdHRlclBsb3RBdHRyaWJ1dGVzKClcbiAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5yZW5kZXIoKVxuICB9XG4gIC8qKlxuICAgKiBVc2VkIGJ5IGNsaWVudHMgdG8gaW5kaWNhdGUgdGhhdCBhIHNlbGVjdGlvbiBoYXMgb2NjdXJyZWQuXG4gICAqL1xuICBhc3luYyBub3RpZnlTZWxlY3Rpb25DaGFuZ2VkKG5ld1NlbGVjdGVkUG9pbnRJbmRpY2VzOiBudW1iZXJbXSwgc2VsZWN0TW9kZT86IGJvb2xlYW4sIHNlbGVjdGlvblR5cGU/OiBzdHJpbmcpIHtcbiAgICBjb25zb2xlLmxvZygnbm90aWZ5U2VsZWN0aW9uQ2hhbmdlZCcsIHNlbGVjdGlvblR5cGUsbmV3U2VsZWN0ZWRQb2ludEluZGljZXMpXG4gICAgaWYgKCF0aGlzLnJlZ2lzdGVyZWQpIHtcbiAgICAgIHRoaXMucmVhZHlyZWdpcygpXG4gICAgfVxuICAgIGlmICghd2luZG93LmFjY2VwdEluZGljYXRlcykge1xuICAgICAgd2luZG93LmFjY2VwdEluZGljYXRlcyA9IFtdXG4gICAgfVxuICAgIGlmICghd2luZG93LnJlamVjdEluZGljYXRlcykge1xuICAgICAgd2luZG93LnJlamVjdEluZGljYXRlcyA9IFtdXG4gICAgfVxuICAgIHdpbmRvdy5jdXN0b21TZWxlY3Rpb24gPSB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzLmNvbmNhdCh3aW5kb3cucmVqZWN0SW5kaWNhdGVzKVxuICAgIGlmIChzZWxlY3Rpb25UeXBlID09PSAnaXNBTFF1ZXJ5JyB8fCBzZWxlY3Rpb25UeXBlID09PSAnbm9ybWFsJyB8fCBzZWxlY3Rpb25UeXBlID09PSAnaXNBbm9ybWFseVF1ZXJ5JyB8fCBzZWxlY3Rpb25UeXBlID09PSAnYm91bmRpbmdib3gnKSB7XG4gICAgICAvLyB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uID0gW11cbiAgICAgIHdpbmRvdy5xdWVyeVJlc1BvaW50SW5kaWNlcyA9IG5ld1NlbGVjdGVkUG9pbnRJbmRpY2VzXG4gICAgICBpZiAoc2VsZWN0aW9uVHlwZSA9PT0gJ2lzQUxRdWVyeScpIHtcbiAgICAgICAgd2luZG93LmFsUXVlcnlSZXNQb2ludEluZGljZXMgPSBuZXdTZWxlY3RlZFBvaW50SW5kaWNlc1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgd2luZG93LmFsUXVlcnlSZXNQb2ludEluZGljZXMgPSBbXVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoc2VsZWN0aW9uVHlwZSA9PT0gJ2lzU2hvd1NlbGVjdGVkJykge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB3aW5kb3cucHJldmlvdXNJbmRlY2F0ZXM/Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIC8vIGlmKHdpbmRvdy5jdXN0b21TZWxlY3Rpb24uaW5kZXhPZih3aW5kb3cucHJldmlvdXNJbmRlY2F0ZXNbaV0pID09PSAtMSl7XG4gICAgICAgIGxldCBpbmRleCA9IHdpbmRvdy5wcmV2aW91c0luZGVjYXRlc1tpXVxuICAgICAgICBpZiAod2luZG93LmNoZWNrYm94RG9tW2luZGV4XSkge1xuICAgICAgICAgIHdpbmRvdy5jaGVja2JveERvbVtpbmRleF0uY2hlY2tlZCA9IHRydWVcbiAgICAgICAgfVxuICAgICAgICAvLyB9XG4gICAgICB9XG4gICAgICB0aGlzLm1ldGFkYXRhQ2FyZC51cGRhdGVDdXN0b21MaXN0KHRoaXMuZGF0YVNldC5wb2ludHMsIHRoaXMgYXMgUHJvamVjdG9yRXZlbnRDb250ZXh0KVxuICAgICAgdGhpcy5tZXRhZGF0YUNhcmQudXBkYXRlUmVqZWN0TGlzdCh0aGlzLmRhdGFTZXQucG9pbnRzLCB0aGlzIGFzIFByb2plY3RvckV2ZW50Q29udGV4dClcbiAgICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnVwZGF0ZVNjYXR0ZXJQbG90QXR0cmlidXRlcygpXG4gICAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5yZW5kZXIoKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGlmIChzZWxlY3Rpb25UeXBlID09PSAnYm91bmRpbmdib3gnKSB7XG4gICAgICBsZXQgaGVhZGVycyA9IG5ldyBIZWFkZXJzKCk7XG4gICAgICBoZWFkZXJzLmFwcGVuZCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgIGhlYWRlcnMuYXBwZW5kKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuXG4gICAgICBhd2FpdCBmZXRjaChgaHR0cDovLyR7dGhpcy5EVklTZXJ2ZXJ9L2JvdW5kaW5nYm94X3JlY29yZGAsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIG1vZGU6ICdjb3JzJyxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICBcInVzZXJuYW1lXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS51c2VybmFtZSxcbiAgICAgICAgfSksXG4gICAgICAgIGhlYWRlcnM6IGhlYWRlcnMsXG4gICAgICB9KS50aGVuKCgpPT57XG4gICAgICAgICAgY29uc29sZS5sb2coJzEyMzMyMycpXG4gICAgICB9KVxuICAgICAgd2luZG93LmFsU3VnZ2VzdExhYmVsTGlzdCA9IFtdXG4gICAgICB3aW5kb3cuYWxTdWdnZXN0U2NvcmVMaXN0ID0gW11cbiAgICAgIHdpbmRvdy5xdWVyeVJlc1BvaW50SW5kaWNlcyA9IG5ld1NlbGVjdGVkUG9pbnRJbmRpY2VzXG4gICAgICB0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzID0gbmV3U2VsZWN0ZWRQb2ludEluZGljZXNcbiAgICAgIHdpbmRvdy5hbFF1ZXJ5UmVzUG9pbnRJbmRpY2VzID0gW11cbiAgICAgIHRoaXMuaW5zcGVjdG9yUGFuZWwucmVmcmVzaFNlYXJjaFJlc0J5TGlzdChuZXdTZWxlY3RlZFBvaW50SW5kaWNlcylcbiAgICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnVwZGF0ZVNjYXR0ZXJQbG90QXR0cmlidXRlcygpXG4gICAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5yZW5kZXIoKVxuICAgICAgdGhpcy5zZWxlY3Rpb25DaGFuZ2VkTGlzdGVuZXJzLmZvckVhY2goKGwpID0+XG4gICAgICAgIGwodGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcywgW10pXG4gICAgICApO1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgbGV0IG5laWdoYm9yczoga25uLk5lYXJlc3RFbnRyeVtdID0gW107XG4gICAgaWYgKFxuICAgICAgdGhpcy5lZGl0TW9kZSAmJiAvLyBwb2ludCBzZWxlY3Rpb24gdG9nZ2xlIGluIGV4aXN0aW5nIHNlbGVjdGlvblxuICAgICAgbmV3U2VsZWN0ZWRQb2ludEluZGljZXMubGVuZ3RoID4gMFxuICAgICkge1xuICAgICAgLy8gc2VsZWN0aW9uIHJlcXVpcmVkXG4gICAgICBpZiAodGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgLy8gbWFpbiBwb2ludCB3aXRoIG5laWdoYm9yc1xuICAgICAgICBsZXQgbWFpbl9wb2ludF92ZWN0b3IgPSB0aGlzLmRhdGFTZXQucG9pbnRzW1xuICAgICAgICAgIHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXNbMF1cbiAgICAgICAgXS52ZWN0b3I7XG4gICAgICAgIG5laWdoYm9ycyA9IHRoaXMubmVpZ2hib3JzT2ZGaXJzdFBvaW50LmZpbHRlcihcbiAgICAgICAgICAoXG4gICAgICAgICAgICBuIC8vIGRlc2VsZWN0XG4gICAgICAgICAgKSA9PiBuZXdTZWxlY3RlZFBvaW50SW5kaWNlcy5maWx0ZXIoKHApID0+IHAgPT0gbi5pbmRleCkubGVuZ3RoID09IDBcbiAgICAgICAgKTtcbiAgICAgICAgbmV3U2VsZWN0ZWRQb2ludEluZGljZXMuZm9yRWFjaCgocCkgPT4ge1xuICAgICAgICAgIC8vIGFkZCBhZGRpdGlvbmFsIG5laWdoYm9yc1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIHAgIT0gdGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlc1swXSAmJiAvLyBub3QgbWFpbiBwb2ludFxuICAgICAgICAgICAgdGhpcy5uZWlnaGJvcnNPZkZpcnN0UG9pbnQuZmlsdGVyKChuKSA9PiBuLmluZGV4ID09IHApLmxlbmd0aCA9PSAwXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBsZXQgcF92ZWN0b3IgPSB0aGlzLmRhdGFTZXQucG9pbnRzW3BdLnZlY3RvcjtcbiAgICAgICAgICAgIGxldCBuX2Rpc3QgPSB0aGlzLmluc3BlY3RvclBhbmVsLmRpc3RGdW5jKFxuICAgICAgICAgICAgICBtYWluX3BvaW50X3ZlY3RvcixcbiAgICAgICAgICAgICAgcF92ZWN0b3JcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBsZXQgcG9zID0gMDsgLy8gaW5zZXJ0aW9uIHBvc2l0aW9uIGludG8gZGlzdCBvcmRlcmVkIG5laWdoYm9yc1xuICAgICAgICAgICAgd2hpbGUgKFxuICAgICAgICAgICAgICBwb3MgPCBuZWlnaGJvcnMubGVuZ3RoICYmXG4gICAgICAgICAgICAgIG5laWdoYm9yc1twb3NdLmRpc3QgPCBuX2Rpc3QgLy8gZmluZCBwb3NcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgcG9zID0gcG9zICsgMTsgLy8gbW92ZSB1cCB0aGUgc29ydGVkIG5laWdoYm9ycyBsaXN0IGFjY29yZGluZyB0byBkaXN0XG4gICAgICAgICAgICBuZWlnaGJvcnMuc3BsaWNlKHBvcywgMCwgeyBpbmRleDogcCwgZGlzdDogbl9kaXN0IH0pOyAvLyBhZGQgbmV3IG5laWdoYm9yXG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG11bHRpcGxlIHNlbGVjdGlvbnNcbiAgICAgICAgbGV0IHVwZGF0ZWRTZWxlY3RlZFBvaW50SW5kaWNlcyA9IHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMuZmlsdGVyKFxuICAgICAgICAgIChuKSA9PiBuZXdTZWxlY3RlZFBvaW50SW5kaWNlcy5maWx0ZXIoKHApID0+IHAgPT0gbikubGVuZ3RoID09IDBcbiAgICAgICAgKTsgLy8gZGVzZWxlY3RcbiAgICAgICAgbmV3U2VsZWN0ZWRQb2ludEluZGljZXMuZm9yRWFjaCgocCkgPT4ge1xuICAgICAgICAgIC8vIGFkZCBhZGRpdGlvbmFsIHNlbGVjdGlvbnNcbiAgICAgICAgICBpZiAodGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcy5maWx0ZXIoKHMpID0+IHMgPT0gcCkubGVuZ3RoID09IDApXG4gICAgICAgICAgICAvLyB1bnNlbGVjdGVkXG4gICAgICAgICAgICB1cGRhdGVkU2VsZWN0ZWRQb2ludEluZGljZXMucHVzaChwKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMgPSB1cGRhdGVkU2VsZWN0ZWRQb2ludEluZGljZXM7IC8vIHVwZGF0ZSBzZWxlY3Rpb25cbiAgICAgICAgaWYgKHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIC8vIGF0IGxlYXN0IG9uZSBzZWxlY3RlZCBwb2ludFxuICAgICAgICAgIHRoaXMubWV0YWRhdGFDYXJkLnVwZGF0ZU1ldGFkYXRhKFxuICAgICAgICAgICAgLy8gc2hvdyBtZXRhZGF0YSBmb3IgZmlyc3Qgc2VsZWN0ZWQgcG9pbnRcbiAgICAgICAgICAgIHRoaXMuZGF0YVNldC5wb2ludHNbdGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlc1swXV0ubWV0YWRhdGFcbiAgICAgICAgICApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG5vIHBvaW50cyBzZWxlY3RlZFxuICAgICAgICAgIHRoaXMubWV0YWRhdGFDYXJkLnVwZGF0ZU1ldGFkYXRhKG51bGwpOyAvLyBjbGVhciBtZXRhZGF0YVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChzZWxlY3RNb2RlID09IHRydWUpIHtcbiAgICAgIC8vIGZvciBib3VuZGluZyBib3ggc2VsZWN0aW9uXG4gICAgICAvLyBtdWx0aXBsZSBzZWxlY3Rpb25zXG4gICAgICBsZXQgdXBkYXRlZFNlbGVjdGVkUG9pbnRJbmRpY2VzID0gdGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcy5maWx0ZXIoXG4gICAgICAgIChuKSA9PiBuZXdTZWxlY3RlZFBvaW50SW5kaWNlcy5maWx0ZXIoKHApID0+IHAgPT0gbikubGVuZ3RoID09IDBcbiAgICAgICk7IC8vIGRlc2VsZWN0XG4gICAgICBuZXdTZWxlY3RlZFBvaW50SW5kaWNlcy5mb3JFYWNoKChwKSA9PiB7XG4gICAgICAgIC8vIGFkZCBhZGRpdGlvbmFsIHNlbGVjdGlvbnNcbiAgICAgICAgaWYgKHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMuZmlsdGVyKChzKSA9PiBzID09IHApLmxlbmd0aCA9PSAwKVxuICAgICAgICAgIC8vIHVuc2VsZWN0ZWRcbiAgICAgICAgICB1cGRhdGVkU2VsZWN0ZWRQb2ludEluZGljZXMucHVzaChwKTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcyA9IHVwZGF0ZWRTZWxlY3RlZFBvaW50SW5kaWNlczsgLy8gdXBkYXRlIHNlbGVjdGlvblxuICAgICAgaWYgKHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAvLyBhdCBsZWFzdCBvbmUgc2VsZWN0ZWQgcG9pbnRcbiAgICAgICAgaWYgKHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICB0aGlzLm1ldGFkYXRhQ2FyZC51cGRhdGVNZXRhZGF0YShcbiAgICAgICAgICAgIC8vIHNob3cgbWV0YWRhdGEgZm9yIGZpcnN0IHNlbGVjdGVkIHBvaW50XG4gICAgICAgICAgICB0aGlzLmRhdGFTZXQucG9pbnRzW3RoaXMuc2VsZWN0ZWRQb2ludEluZGljZXNbMF1dLm1ldGFkYXRhXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLm1ldGFkYXRhQ2FyZC51cGRhdGVNZXRhZGF0YShudWxsKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gbm8gcG9pbnRzIHNlbGVjdGVkXG4gICAgICAgIHRoaXMubWV0YWRhdGFDYXJkLnVwZGF0ZU1ldGFkYXRhKG51bGwpOyAvLyBjbGVhciBtZXRhZGF0YVxuICAgICAgfVxuICAgICAgdGhpcy5pbnNwZWN0b3JQYW5lbC51cGRhdGVCb3VuZGluZ0JveFNlbGVjdGlvbihuZXdTZWxlY3RlZFBvaW50SW5kaWNlcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG5vcm1hbCBzZWxlY3Rpb24gbW9kZVxuICAgICAgdGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcyA9IG5ld1NlbGVjdGVkUG9pbnRJbmRpY2VzO1xuICAgICAgaWYgKG5ld1NlbGVjdGVkUG9pbnRJbmRpY2VzLmxlbmd0aCA9PT0gMSAmJiB0aGlzLmRhdGFTZXQucG9pbnRzW25ld1NlbGVjdGVkUG9pbnRJbmRpY2VzWzBdXS5tZXRhZGF0YS5sYWJlbCAhPSBcImJhY2tncm91bmRcIikge1xuICAgICAgICAvKlxuICAgICAgICBuZWlnaGJvcnMgPSB0aGlzLmRhdGFTZXQuZmluZE5laWdoYm9ycyhcbiAgICAgICAgICBuZXdTZWxlY3RlZFBvaW50SW5kaWNlc1swXSxcbiAgICAgICAgICB0aGlzLmluc3BlY3RvclBhbmVsLmRpc3RGdW5jLFxuICAgICAgICAgIHRoaXMuaW5zcGVjdG9yUGFuZWwubnVtTk5cbiAgICAgICAgKTsqL1xuICAgICAgICBpZiAodGhpcy5kYXRhU2V0LnBvaW50c1tuZXdTZWxlY3RlZFBvaW50SW5kaWNlc1swXV0ubWV0YWRhdGEubGFiZWwgIT0gXCJiYWNrZ3JvdW5kXCIpXG4gICAgICAgICAgbmVpZ2hib3JzWzBdID0ge1xuICAgICAgICAgICAgaW5kZXg6IG5ld1NlbGVjdGVkUG9pbnRJbmRpY2VzWzBdLFxuICAgICAgICAgICAgZGlzdDogMFxuICAgICAgICAgIH07XG5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubWV0YWRhdGFDYXJkLnVwZGF0ZU1ldGFkYXRhKG51bGwpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnNlbGVjdGlvbkNoYW5nZWRMaXN0ZW5lcnMuZm9yRWFjaCgobCkgPT5cbiAgICAgIGwodGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcywgbmVpZ2hib3JzKVxuICAgICk7XG4gIH1cbiAgdXBkYXRlTWV0YURhdGFCeUluZGljZXMoaW5kaWNlczogbnVtYmVyLCBzcmM6IHN0cmluZykge1xuICAgIGlmIChpbmRpY2VzID09PSAtMSkge1xuICAgICAgdGhpcy5tZXRhZGF0YUNhcmQudXBkYXRlTWV0YWRhdGEobnVsbCk7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgY29uc29sZS5sb2coJ2J1YnVidWJ1YnV1dSBoZXJlJylcbiAgICB0aGlzLm1ldGFkYXRhQ2FyZC51cGRhdGVNZXRhZGF0YShcbiAgICAgIHRoaXMuZGF0YVNldC5wb2ludHNbaW5kaWNlc10ubWV0YWRhdGEsIHNyYywgdGhpcy5kYXRhU2V0LnBvaW50c1tpbmRpY2VzXVxuICAgICk7XG4gIH1cblxuICB1cGRhdGVNZXRhQnlJbmRpY2VzKGluZGljZXM6IG51bWJlcikge1xuICAgIGlmIChpbmRpY2VzID09PSAtMSkge1xuICAgICAgdGhpcy5tZXRhZGF0YUNhcmQudXBkYXRlTWV0YWRhdGEobnVsbCk7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgdGhpcy5kYXRhU2V0LmdldFNwcml0ZUltYWdlKGluZGljZXMsIChpbWdEYXRhOiBhbnkpID0+IHtcbiAgICAgIGxldCBzcmMgPSBpbWdEYXRhLmltZ1VybFxuICAgICAgdGhpcy5tZXRhZGF0YUNhcmQudXBkYXRlTWV0YWRhdGEoXG4gICAgICAgIHRoaXMuZGF0YVNldC5wb2ludHNbaW5kaWNlc10ubWV0YWRhdGEsIHNyYywgdGhpcy5kYXRhU2V0LnBvaW50c1tpbmRpY2VzXSwgaW5kaWNlc1xuICAgICAgKTtcbiAgICB9KVxuICB9XG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgYSBsaXN0ZW5lciB0byBiZSBjYWxsZWQgYW55IHRpbWUgdGhlIG1vdXNlIGhvdmVycyBvdmVyIGEgcG9pbnQuXG4gICAqL1xuICByZWdpc3RlckhvdmVyTGlzdGVuZXIobGlzdGVuZXI6IEhvdmVyTGlzdGVuZXIpIHtcbiAgICB0aGlzLmhvdmVyTGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuICB9XG4gIC8qKlxuICAgKiBVc2VkIGJ5IGNsaWVudHMgdG8gaW5kaWNhdGUgdGhhdCBhIGhvdmVyIGlzIG9jY3VycmluZy5cbiAgICovXG4gIHByaXZhdGUgdGltZXIgPSBudWxsXG4gIG5vdGlmeUhvdmVyT3ZlclBvaW50KHBvaW50SW5kZXg6IG51bWJlcikge1xuICAgIHRoaXMuaG92ZXJMaXN0ZW5lcnMuZm9yRWFjaCgobCkgPT4gbChwb2ludEluZGV4KSk7XG4gICAgbGV0IHRpbWVOb3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuICAgIGlmICh0aGlzLnRpbWVyID09PSBudWxsIHx8IHRpbWVOb3cgLSB0aGlzLnRpbWVyID4gMTApIHtcbiAgICAgIGlmICh3aW5kb3cuaXRlcmF0aW9uICYmIHBvaW50SW5kZXggIT09IHVuZGVmaW5lZCAmJiBwb2ludEluZGV4ICE9PSBudWxsICYmIHdpbmRvdy5wcmV2aW91c0hvdmVyICE9PSBwb2ludEluZGV4KSB7XG4gICAgICAgIHRoaXMudGltZXIgPSB0aW1lTm93XG4gICAgICAgIHRoaXMudXBkYXRlTWV0YUJ5SW5kaWNlcyhwb2ludEluZGV4KVxuICAgICAgICB3aW5kb3cucHJldmlvdXNIb3ZlciA9IHBvaW50SW5kZXhcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmVnaXN0ZXJQcm9qZWN0aW9uQ2hhbmdlZExpc3RlbmVyKGxpc3RlbmVyOiBQcm9qZWN0aW9uQ2hhbmdlZExpc3RlbmVyKSB7XG4gICAgdGhpcy5wcm9qZWN0aW9uQ2hhbmdlZExpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcbiAgfVxuICBub3RpZnlQcm9qZWN0aW9uQ2hhbmdlZChwcm9qZWN0aW9uOiBQcm9qZWN0aW9uKSB7XG4gICAgdGhpcy5wcm9qZWN0aW9uQ2hhbmdlZExpc3RlbmVycy5mb3JFYWNoKChsKSA9PiBsKHByb2plY3Rpb24pKTtcbiAgfVxuICByZWdpc3RlckRpc3RhbmNlTWV0cmljQ2hhbmdlZExpc3RlbmVyKGw6IERpc3RhbmNlTWV0cmljQ2hhbmdlZExpc3RlbmVyKSB7XG4gICAgdGhpcy5kaXN0YW5jZU1ldHJpY0NoYW5nZWRMaXN0ZW5lcnMucHVzaChsKTtcbiAgfVxuICBub3RpZnlEaXN0YW5jZU1ldHJpY0NoYW5nZWQoZGlzdE1ldHJpYzogRGlzdGFuY2VGdW5jdGlvbikge1xuICAgIHRoaXMuZGlzdGFuY2VNZXRyaWNDaGFuZ2VkTGlzdGVuZXJzLmZvckVhY2goKGwpID0+IGwoZGlzdE1ldHJpYykpO1xuICB9XG5cbiAgQG9ic2VydmUoJ2RhdGFQcm90bycpXG4gIF9kYXRhUHJvdG9DaGFuZ2VkKGRhdGFQcm90b1N0cmluZzogc3RyaW5nKSB7XG4gICAgbGV0IGRhdGFQcm90byA9IGRhdGFQcm90b1N0cmluZ1xuICAgICAgPyAoSlNPTi5wYXJzZShkYXRhUHJvdG9TdHJpbmcpIGFzIERhdGFQcm90bylcbiAgICAgIDogbnVsbDtcbiAgICB0aGlzLmluaXRpYWxpemVEYXRhUHJvdmlkZXIoZGF0YVByb3RvKTtcbiAgfVxuICBwcml2YXRlIG1ha2VEZWZhdWx0UG9pbnRzSW5mb0FuZFN0YXRzKFxuICAgIHBvaW50czogRGF0YVBvaW50W11cbiAgKTogW1BvaW50TWV0YWRhdGFbXSwgQ29sdW1uU3RhdHNbXV0ge1xuICAgIGxldCBwb2ludHNJbmZvOiBQb2ludE1ldGFkYXRhW10gPSBbXTtcbiAgICBwb2ludHMuZm9yRWFjaCgocCkgPT4ge1xuICAgICAgbGV0IHBvaW50SW5mbzogUG9pbnRNZXRhZGF0YSA9IHt9O1xuICAgICAgcG9pbnRJbmZvW0lOREVYX01FVEFEQVRBX0ZJRUxEXSA9IHAuaW5kZXg7XG4gICAgICBwb2ludHNJbmZvLnB1c2gocG9pbnRJbmZvKTtcbiAgICB9KTtcbiAgICBsZXQgc3RhdHM6IENvbHVtblN0YXRzW10gPSBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6IElOREVYX01FVEFEQVRBX0ZJRUxELFxuICAgICAgICBpc051bWVyaWM6IGZhbHNlLFxuICAgICAgICB0b29NYW55VW5pcXVlVmFsdWVzOiB0cnVlLFxuICAgICAgICBtaW46IDAsXG4gICAgICAgIG1heDogcG9pbnRzSW5mby5sZW5ndGggLSAxLFxuICAgICAgfSxcbiAgICBdO1xuICAgIHJldHVybiBbcG9pbnRzSW5mbywgc3RhdHNdO1xuICB9XG4gIHByaXZhdGUgaW5pdGlhbGl6ZURhdGFQcm92aWRlcihkYXRhUHJvdG8/OiBEYXRhUHJvdG8pIHtcbiAgICBpZiAodGhpcy5zZXJ2aW5nTW9kZSA9PT0gJ2RlbW8nKSB7XG4gICAgICBsZXQgcHJvamVjdG9yQ29uZmlnVXJsOiBzdHJpbmc7XG4gICAgICAvLyBPbmx5IGluIGRlbW8gbW9kZSBkbyB3ZSBhbGxvdyB0aGUgY29uZmlnIGJlaW5nIHBhc3NlZCB2aWEgVVJMLlxuICAgICAgbGV0IHVybFBhcmFtcyA9IHV0aWwuZ2V0VVJMUGFyYW1zKGluaXRpYWxVUkxRdWVyeVN0cmluZyk7XG4gICAgICBpZiAoJ2NvbmZpZycgaW4gdXJsUGFyYW1zKSB7XG4gICAgICAgIHByb2plY3RvckNvbmZpZ1VybCA9IHVybFBhcmFtc1snY29uZmlnJ107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcm9qZWN0b3JDb25maWdVcmwgPSB0aGlzLnByb2plY3RvckNvbmZpZ0pzb25QYXRoO1xuICAgICAgfVxuICAgICAgdGhpcy5kYXRhUHJvdmlkZXIgPSBuZXcgRGVtb0RhdGFQcm92aWRlcihwcm9qZWN0b3JDb25maWdVcmwpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5zZXJ2aW5nTW9kZSA9PT0gJ3NlcnZlcicpIHtcbiAgICAgIGlmICghdGhpcy5yb3V0ZVByZWZpeCkge1xuICAgICAgICB0aHJvdyAncm91dGUtcHJlZml4IGlzIGEgcmVxdWlyZWQgcGFyYW1ldGVyJztcbiAgICAgIH1cbiAgICAgIHRoaXMuZGF0YVByb3ZpZGVyID0gbmV3IFNlcnZlckRhdGFQcm92aWRlcih0aGlzLnJvdXRlUHJlZml4KTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuc2VydmluZ01vZGUgPT09ICdwcm90bycgJiYgZGF0YVByb3RvICE9IG51bGwpIHtcbiAgICAgIHRoaXMuZGF0YVByb3ZpZGVyID0gbmV3IFByb3RvRGF0YVByb3ZpZGVyKGRhdGFQcm90byk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoZSBjb21wb25lbnQgaXMgbm90IHJlYWR5IHlldCAtIHdhaXRpbmcgZm9yIHRoZSBkYXRhUHJvdG8gZmllbGQuXG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuZGF0YVBhbmVsLmluaXRpYWxpemUodGhpcywgdGhpcy5kYXRhUHJvdmlkZXIpO1xuICB9XG4gIHByaXZhdGUgZ2V0TGVnZW5kUG9pbnRDb2xvcmVyKFxuICAgIGNvbG9yT3B0aW9uOiBDb2xvck9wdGlvblxuICApOiAoZHM6IERhdGFTZXQsIGluZGV4OiBudW1iZXIpID0+IHN0cmluZyB7XG4gICAgaWYgKGNvbG9yT3B0aW9uID09IG51bGwgfHwgY29sb3JPcHRpb24ubWFwID09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBjb2xvcmVyID0gKGRzOiBEYXRhU2V0LCBpOiBudW1iZXIpID0+IHtcbiAgICAgIGxldCB2YWx1ZSA9IGRzLnBvaW50c1tpXS5tZXRhZGF0YVt0aGlzLnNlbGVjdGVkQ29sb3JPcHRpb24ubmFtZV07XG4gICAgICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gUE9JTlRfQ09MT1JfTUlTU0lORztcbiAgICAgIH1cbiAgICAgIHJldHVybiBkcy5wb2ludHNbaV0uY29sb3I7XG4gICAgICAvL3JldHVybiBjb2xvck9wdGlvbi5tYXAodmFsdWUpO1xuICAgIH07XG4gICAgcmV0dXJuIGNvbG9yZXI7XG4gIH1cbiAgcHJpdmF0ZSBnZXQzRExhYmVsTW9kZUJ1dHRvbigpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLiQkKCcjbGFiZWxzM0RNb2RlJyk7XG4gIH1cbiAgcHJpdmF0ZSBnZXQzRExhYmVsTW9kZSgpOiBib29sZWFuIHtcbiAgICBjb25zdCBsYWJlbDNETW9kZUJ1dHRvbiA9IHRoaXMuZ2V0M0RMYWJlbE1vZGVCdXR0b24oKTtcbiAgICByZXR1cm4gKGxhYmVsM0RNb2RlQnV0dG9uIGFzIGFueSkuYWN0aXZlO1xuICB9XG4gIGFkanVzdFNlbGVjdGlvbkFuZEhvdmVyKHNlbGVjdGVkUG9pbnRJbmRpY2VzOiBudW1iZXJbXSwgaG92ZXJJbmRleD86IG51bWJlcikge1xuICAgIHRoaXMubm90aWZ5U2VsZWN0aW9uQ2hhbmdlZChzZWxlY3RlZFBvaW50SW5kaWNlcyk7XG4gICAgdGhpcy5ub3RpZnlIb3Zlck92ZXJQb2ludChob3ZlckluZGV4KTtcbiAgICB0aGlzLnNldE1vdXNlTW9kZShNb3VzZU1vZGUuQ0FNRVJBX0FORF9DTElDS19TRUxFQ1QpO1xuICB9XG4gIHNldE1vdXNlTW9kZShtb3VzZU1vZGU6IE1vdXNlTW9kZSkge1xuICAgIGxldCBzZWxlY3RNb2RlQnV0dG9uID0gdGhpcy4kJCgnI3NlbGVjdE1vZGUnKTtcbiAgICAoc2VsZWN0TW9kZUJ1dHRvbiBhcyBhbnkpLmFjdGl2ZSA9IG1vdXNlTW9kZSA9PT0gTW91c2VNb2RlLkFSRUFfU0VMRUNUO1xuICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnNjYXR0ZXJQbG90LnNldE1vdXNlTW9kZShtb3VzZU1vZGUpO1xuICB9XG4gIHByaXZhdGUgc2V0Q3VycmVudERhdGFTZXQoZHM6IERhdGFTZXQpIHtcbiAgICB0aGlzLmFkanVzdFNlbGVjdGlvbkFuZEhvdmVyKFtdKTtcbiAgICBpZiAodGhpcy5kYXRhU2V0ICE9IG51bGwpIHtcbiAgICAgIHRoaXMuZGF0YVNldC5zdG9wVFNORSgpO1xuICAgIH1cbiAgICBpZiAoZHMgIT0gbnVsbCAmJiB0aGlzLm5vcm1hbGl6ZURhdGEpIHtcbiAgICAgIGRzLm5vcm1hbGl6ZSgpO1xuICAgIH1cbiAgICB0aGlzLmRpbSA9IGRzID09IG51bGwgPyAwIDogZHMuZGltWzFdO1xuICAgICh0aGlzLiQkKCdzcGFuLm51bURhdGFQb2ludHMnKSBhcyBIVE1MU3BhbkVsZW1lbnQpLmlubmVyVGV4dCA9XG4gICAgICBkcyA9PSBudWxsID8gJzAnIDogJycgKyBkcy5kaW1bMF07XG4gICAgKHRoaXMuJCQoJ3NwYW4uZGltJykgYXMgSFRNTFNwYW5FbGVtZW50KS5pbm5lclRleHQgPVxuICAgICAgZHMgPT0gbnVsbCA/ICcwJyA6ICcnICsgZHMuZGltWzFdO1xuICAgIHRoaXMuZGF0YVNldCA9IGRzO1xuICAgIHRoaXMucHJvamVjdGlvbnNQYW5lbC5kYXRhU2V0VXBkYXRlZChcbiAgICAgIHRoaXMuZGF0YVNldCxcbiAgICAgIHRoaXMub3JpZ2luYWxEYXRhU2V0LFxuICAgICAgdGhpcy5kaW1cbiAgICApO1xuICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnNldERhdGFTZXQodGhpcy5kYXRhU2V0KTtcbiAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5zY2F0dGVyUGxvdC5zZXRDYW1lcmFQYXJhbWV0ZXJzRm9yTmV4dENhbWVyYUNyZWF0aW9uKFxuICAgICAgbnVsbCxcbiAgICAgIHRydWVcbiAgICApO1xuICB9XG4gIHByaXZhdGUgc2V0dXBVSUNvbnRyb2xzKCkge1xuICAgIC8vIFZpZXcgY29udHJvbHNcbiAgICB0aGlzLmhlbHBCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAodGhpcy4kLmhlbHAzZERpYWxvZyBhcyBhbnkpLm9wZW4oKTtcbiAgICB9KVxuICAgIHRoaXMuJCQoJyNyZXNldC16b29tJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5zY2F0dGVyUGxvdC5yZXNldFpvb20oKTtcbiAgICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnNjYXR0ZXJQbG90LnN0YXJ0T3JiaXRBbmltYXRpb24oKTtcbiAgICB9KTtcbiAgICBsZXQgc2VsZWN0TW9kZUJ1dHRvbiA9IHRoaXMuJCQoJyNzZWxlY3RNb2RlJyk7XG4gICAgc2VsZWN0TW9kZUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICAgICAgdGhpcy5zZXRNb3VzZU1vZGUoXG4gICAgICAgIChzZWxlY3RNb2RlQnV0dG9uIGFzIGFueSkuYWN0aXZlXG4gICAgICAgICAgPyBNb3VzZU1vZGUuQVJFQV9TRUxFQ1RcbiAgICAgICAgICA6IE1vdXNlTW9kZS5DQU1FUkFfQU5EX0NMSUNLX1NFTEVDVFxuICAgICAgKTtcbiAgICB9KTtcbiAgICBsZXQgbmlnaHRNb2RlQnV0dG9uID0gdGhpcy4kJCgnI25pZ2h0RGF5TW9kZScpO1xuICAgIG5pZ2h0TW9kZUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnNjYXR0ZXJQbG90LnNldERheU5pZ2h0TW9kZShcbiAgICAgICAgKG5pZ2h0TW9kZUJ1dHRvbiBhcyBhbnkpLmFjdGl2ZVxuICAgICAgKTtcbiAgICB9KTtcbiAgICBsZXQgaGlkZGVuQmFja2dyb3VuZCA9IHRoaXMuJCQoJyNoaWRkZW5CYWNrZ3JvdW5kJyk7XG4gICAgaGlkZGVuQmFja2dyb3VuZC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgIHdpbmRvdy5oaWRkZW5CYWNrZ3JvdW5kID0gKGhpZGRlbkJhY2tncm91bmQgYXMgYW55KS5hY3RpdmVcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5kYXRhU2V0LnBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBwb2ludCA9IHRoaXMuZGF0YVNldC5wb2ludHNbaV07XG4gICAgICAgIGlmIChwb2ludC5tZXRhZGF0YVt0aGlzLnNlbGVjdGVkTGFiZWxPcHRpb25dKSB7XG4gICAgICAgICAgbGV0IGhvdmVyVGV4dCA9IHBvaW50Lm1ldGFkYXRhW3RoaXMuc2VsZWN0ZWRMYWJlbE9wdGlvbl0udG9TdHJpbmcoKTtcbiAgICAgICAgICBpZiAoaG92ZXJUZXh0ID09ICdiYWNrZ3JvdW5kJykge1xuICAgICAgICAgICAgaWYgKChoaWRkZW5CYWNrZ3JvdW5kIGFzIGFueSkuYWN0aXZlKSB7XG4gICAgICAgICAgICAgIC8vIHdpbmRvdy5zY2VuZS5yZW1vdmUod2luZG93LmJhY2tncm91bmRNZXNoKVxuICAgICAgICAgICAgICBwb2ludC5jb2xvciA9ICcjZmZmZmZmJ1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcG9pbnQuY29sb3IgPSBwb2ludC5EVklfY29sb3JbMV1cbiAgICAgICAgICAgICAgLy8gd2luZG93LnNjZW5lLmFkZCh3aW5kb3cuYmFja2dyb3VuZE1lc2gpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBpZih3aW5kb3cuc2NlbmUuY2hpbGRyZW4pXG4gICAgICBpZiAod2luZG93LnNjZW5lLmNoaWxkcmVuWzJdICYmIHdpbmRvdy5zY2VuZS5jaGlsZHJlblsyXS50eXBlID09PSAnTWVzaCcpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDI7IGkgPCB3aW5kb3cuc2NlbmUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB3aW5kb3cuc2NlbmUuY2hpbGRyZW5baV0udmlzaWJsZSA9ICF3aW5kb3cuaGlkZGVuQmFja2dyb3VuZFxuICAgICAgICB9XG5cbiAgICAgIH1cbiAgICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnNjYXR0ZXJQbG90LnJlbmRlcigpXG4gICAgICAvLyB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5zY2F0dGVyUGxvdC5oaWRkZW5CYWNrZ3JvdW5kKFxuICAgICAgLy8gICAoaGlkZGVuQmFja2dyb3VuZCBhcyBhbnkpLmFjdGl2ZSxcbiAgICAgIC8vICk7XG4gICAgfSlcblxuICAgIGxldCBlZGl0TW9kZUJ1dHRvbiA9IHRoaXMuJCQoJyNlZGl0TW9kZScpO1xuICAgIGVkaXRNb2RlQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gICAgICB0aGlzLmVkaXRNb2RlID0gKGVkaXRNb2RlQnV0dG9uIGFzIGFueSkuYWN0aXZlO1xuICAgIH0pO1xuICAgIGNvbnN0IGxhYmVsczNETW9kZUJ1dHRvbiA9IHRoaXMuZ2V0M0RMYWJlbE1vZGVCdXR0b24oKTtcbiAgICBsYWJlbHMzRE1vZGVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5zZXQzRExhYmVsTW9kZSh0aGlzLmdldDNETGFiZWxNb2RlKCkpO1xuICAgIH0pO1xuICAgIC8vXG4gICAgbGV0IHRyaWFuZ2xlTW9kZUJ0biA9IHRoaXMuJCQoXCIjdHJpYW5nbGVNb2RlXCIpO1xuICAgIHRyaWFuZ2xlTW9kZUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgIHRoaXMucHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLnNldFRyaWFuZ2xlTW9kZSgodHJpYW5nbGVNb2RlQnRuIGFzIGFueSkuYWN0aXZlKVxuICAgIH0pXG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgKCkgPT4ge1xuICAgICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIucmVzaXplKCk7XG4gICAgfSk7XG4gICAge1xuICAgICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIgPSBuZXcgUHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyKFxuICAgICAgICB0aGlzLmdldFNjYXR0ZXJDb250YWluZXIoKSxcbiAgICAgICAgdGhpcyBhcyBQcm9qZWN0b3JFdmVudENvbnRleHRcbiAgICAgICk7XG4gICAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5zZXRMYWJlbFBvaW50QWNjZXNzb3IoXG4gICAgICAgIHRoaXMuc2VsZWN0ZWRMYWJlbE9wdGlvblxuICAgICAgKTtcbiAgICB9XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIuc2NhdHRlclBsb3Qub25DYW1lcmFNb3ZlKFxuICAgICAgKGNhbWVyYVBvc2l0aW9uOiBUSFJFRS5WZWN0b3IzLCBjYW1lcmFUYXJnZXQ6IFRIUkVFLlZlY3RvcjMpID0+XG4gICAgICAgIHRoaXMuYm9va21hcmtQYW5lbC5jbGVhclN0YXRlU2VsZWN0aW9uKClcbiAgICApO1xuICAgIHRoaXMucmVnaXN0ZXJIb3Zlckxpc3RlbmVyKChob3ZlckluZGV4OiBudW1iZXIpID0+IHtcbiAgICAgIHRoaXMub25Ib3Zlcihob3ZlckluZGV4KVxuICAgIH1cblxuICAgICk7XG4gICAgdGhpcy5yZWdpc3RlclByb2plY3Rpb25DaGFuZ2VkTGlzdGVuZXIoKHByb2plY3Rpb246IFByb2plY3Rpb24pID0+XG4gICAgICB0aGlzLm9uUHJvamVjdGlvbkNoYW5nZWQocHJvamVjdGlvbilcbiAgICApO1xuICAgIHRoaXMucmVnaXN0ZXJTZWxlY3Rpb25DaGFuZ2VkTGlzdGVuZXIoXG4gICAgICAoXG4gICAgICAgIHNlbGVjdGVkUG9pbnRJbmRpY2VzOiBudW1iZXJbXSxcbiAgICAgICAgbmVpZ2hib3JzT2ZGaXJzdFBvaW50OiBrbm4uTmVhcmVzdEVudHJ5W11cbiAgICAgICkgPT4gdGhpcy5vblNlbGVjdGlvbkNoYW5nZWQoc2VsZWN0ZWRQb2ludEluZGljZXMsIG5laWdoYm9yc09mRmlyc3RQb2ludClcbiAgICApO1xuICB9XG4gIHByaXZhdGUgb25Ib3Zlcihob3ZlckluZGV4OiBudW1iZXIpIHtcbiAgICB0aGlzLmhvdmVyUG9pbnRJbmRleCA9IGhvdmVySW5kZXg7XG4gICAgbGV0IGhvdmVyVGV4dCA9IG51bGw7XG4gICAgaWYgKGhvdmVySW5kZXggIT0gbnVsbCkge1xuICAgICAgY29uc3QgcG9pbnQgPSB0aGlzLmRhdGFTZXQucG9pbnRzW2hvdmVySW5kZXhdO1xuICAgICAgaWYgKHBvaW50Lm1ldGFkYXRhW3RoaXMuc2VsZWN0ZWRMYWJlbE9wdGlvbl0pIHtcbiAgICAgICAgaG92ZXJUZXh0ID0gcG9pbnQubWV0YWRhdGFbdGhpcy5zZWxlY3RlZExhYmVsT3B0aW9uXS50b1N0cmluZygpO1xuXG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5zdGF0dXNCYXIuc3R5bGUuZGlzcGxheSA9IGhvdmVyVGV4dCA/IG51bGwgOiAnbm9uZSc7XG4gICAgICB0aGlzLnN0YXR1c0Jhci5pbm5lclRleHQgPSBob3ZlclRleHQ7XG4gICAgfVxuICB9XG4gIHByaXZhdGUgZ2V0U2NhdHRlckNvbnRhaW5lcigpOiBIVE1MRGl2RWxlbWVudCB7XG4gICAgcmV0dXJuIHRoaXMuJCQoJyNzY2F0dGVyJykgYXMgSFRNTERpdkVsZW1lbnQ7XG4gIH1cbiAgcHJpdmF0ZSBvblNlbGVjdGlvbkNoYW5nZWQoXG4gICAgc2VsZWN0ZWRQb2ludEluZGljZXM6IG51bWJlcltdLFxuICAgIG5laWdoYm9yc09mRmlyc3RQb2ludDoga25uLk5lYXJlc3RFbnRyeVtdXG4gICkge1xuICAgIHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMgPSBzZWxlY3RlZFBvaW50SW5kaWNlcztcbiAgICB0aGlzLm5laWdoYm9yc09mRmlyc3RQb2ludCA9IG5laWdoYm9yc09mRmlyc3RQb2ludDtcbiAgICB0aGlzLmRhdGFQYW5lbC5vblByb2plY3RvclNlbGVjdGlvbkNoYW5nZWQoXG4gICAgICBzZWxlY3RlZFBvaW50SW5kaWNlcyxcbiAgICAgIG5laWdoYm9yc09mRmlyc3RQb2ludFxuICAgICk7XG4gICAgbGV0IHRvdGFsTnVtUG9pbnRzID1cbiAgICAgIHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMubGVuZ3RoICsgbmVpZ2hib3JzT2ZGaXJzdFBvaW50Lmxlbmd0aDtcbiAgICB0aGlzLnN0YXR1c0Jhci5pbm5lclRleHQgPSBgU2VsZWN0ZWQgJHt0b3RhbE51bVBvaW50c30gcG9pbnRzYDtcbiAgICB0aGlzLnN0YXR1c0Jhci5zdHlsZS5kaXNwbGF5ID0gdG90YWxOdW1Qb2ludHMgPiAwID8gbnVsbCA6ICdub25lJztcbiAgfVxuICBvblByb2plY3Rpb25DaGFuZ2VkKHByb2plY3Rpb24/OiBQcm9qZWN0aW9uKSB7XG4gICAgdGhpcy5kYXRhUGFuZWwucHJvamVjdGlvbkNoYW5nZWQocHJvamVjdGlvbik7XG4gICAgdGhpcy51cGRhdGVCYWNrZ3JvdW5kSW1nKClcbiAgICB0aGlzLmluc3BlY3RvclBhbmVsLmNsZWFyUXVlcnlSZXNMaXN0KCk7XG4gICAgdGhpcy5ub3RpZnlTZWxlY3Rpb25DaGFuZ2VkKFtdKTtcbiAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5yZW5kZXIoKTtcbiAgfVxuICBzZXRQcm9qZWN0aW9uKHByb2plY3Rpb246IFByb2plY3Rpb24pIHtcbiAgICB0aGlzLnByb2plY3Rpb24gPSBwcm9qZWN0aW9uO1xuICAgIGlmIChwcm9qZWN0aW9uICE9IG51bGwpIHtcbiAgICAgIHRoaXMuYW5hbHl0aWNzTG9nZ2VyLmxvZ1Byb2plY3Rpb25DaGFuZ2VkKHByb2plY3Rpb24ucHJvamVjdGlvblR5cGUpO1xuICAgIH1cbiAgICB0aGlzLm5vdGlmeVByb2plY3Rpb25DaGFuZ2VkKHByb2plY3Rpb24pO1xuICB9XG4gIC8vIG5vdGlmeVByb2plY3Rpb25Qb3NpdGlvbnNVcGRhdGVkKG5ld1NlbGVjdGlvbj86IGFueVtdKSB7XG4gIC8vICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIubm90aWZ5UHJvamVjdGlvblBvc2l0aW9uc1VwZGF0ZWQobmV3U2VsZWN0aW9uKTtcbiAgLy8gfVxuICBub3RpZnlQcm9qZWN0aW9uUG9zaXRpb25zVXBkYXRlZCgpIHtcbiAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5ub3RpZnlQcm9qZWN0aW9uUG9zaXRpb25zVXBkYXRlZCgpO1xuICAgIHRoaXMubWV0YWRhdGFDYXJkLnVwZGF0ZUN1c3RvbUxpc3QodGhpcy5kYXRhU2V0LnBvaW50cywgdGhpcyBhcyBQcm9qZWN0b3JFdmVudENvbnRleHQpXG4gICAgdGhpcy5tZXRhZGF0YUNhcmQudXBkYXRlUmVqZWN0TGlzdCh0aGlzLmRhdGFTZXQucG9pbnRzLCB0aGlzIGFzIFByb2plY3RvckV2ZW50Q29udGV4dClcbiAgfVxuXG4gIGhpZGRlbk9yU2hvd1NjYXR0ZXIodHlwZTogc3RyaW5nKSB7XG4gICAgbGV0IGRvbSA9IHRoaXMuJCQoJyNzY2F0dGVyJykgYXMgSFRNTEVsZW1lbnRcbiAgICBkb20uc3R5bGUudmlzaWJpbGl0eSA9IHR5cGVcbiAgICBpZiAodHlwZSA9PT0gJycpIHtcbiAgICAgIHRoaXMuX3Nob3dOb3RBdmFsaWFibGUgPSBmYWxzZVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zaG93Tm90QXZhbGlhYmxlID0gdHJ1ZVxuICAgIH1cbiAgfVxuICByZWZyZXNobm9pc3lCdG4oKXtcbiAgICB0aGlzLmluc3BlY3RvclBhbmVsLnJlZnJlc2hCdG5TdHlsZSgpXG4gIH1cbiAgLyoqXG4gICAqIEdldHMgdGhlIGN1cnJlbnQgdmlldyBvZiB0aGUgZW1iZWRkaW5nIGFuZCBzYXZlcyBpdCBhcyBhIFN0YXRlIG9iamVjdC5cbiAgICovXG4gIGdldEN1cnJlbnRTdGF0ZSgpOiBTdGF0ZSB7XG4gICAgY29uc3Qgc3RhdGUgPSBuZXcgU3RhdGUoKTtcbiAgICAvLyBTYXZlIHRoZSBpbmRpdmlkdWFsIGRhdGFwb2ludCBwcm9qZWN0aW9ucy5cbiAgICBzdGF0ZS5wcm9qZWN0aW9ucyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5kYXRhU2V0LnBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgcG9pbnQgPSB0aGlzLmRhdGFTZXQucG9pbnRzW2ldO1xuICAgICAgY29uc3QgcHJvamVjdGlvbnM6IHtcbiAgICAgICAgW2tleTogc3RyaW5nXTogbnVtYmVyO1xuICAgICAgfSA9IHt9O1xuICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHBvaW50LnByb2plY3Rpb25zKTtcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwga2V5cy5sZW5ndGg7ICsraikge1xuICAgICAgICBwcm9qZWN0aW9uc1trZXlzW2pdXSA9IHBvaW50LnByb2plY3Rpb25zW2tleXNbal1dO1xuICAgICAgfVxuICAgICAgc3RhdGUucHJvamVjdGlvbnMucHVzaChwcm9qZWN0aW9ucyk7XG4gICAgfVxuICAgIHN0YXRlLnNlbGVjdGVkUHJvamVjdGlvbiA9IHRoaXMucHJvamVjdGlvbi5wcm9qZWN0aW9uVHlwZTtcbiAgICBzdGF0ZS5kYXRhU2V0RGltZW5zaW9ucyA9IHRoaXMuZGF0YVNldC5kaW07XG4gICAgc3RhdGUudFNORUl0ZXJhdGlvbiA9IHRoaXMuZGF0YVNldC50U05FSXRlcmF0aW9uO1xuICAgIHN0YXRlLnNlbGVjdGVkUG9pbnRzID0gdGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcztcbiAgICBzdGF0ZS5maWx0ZXJlZFBvaW50cyA9IHRoaXMuZGF0YVNldEZpbHRlckluZGljZXM7XG4gICAgdGhpcy5wcm9qZWN0b3JTY2F0dGVyUGxvdEFkYXB0ZXIucG9wdWxhdGVCb29rbWFya0Zyb21VSShzdGF0ZSk7XG4gICAgc3RhdGUuc2VsZWN0ZWRDb2xvck9wdGlvbk5hbWUgPSB0aGlzLmRhdGFQYW5lbC5zZWxlY3RlZENvbG9yT3B0aW9uTmFtZTtcbiAgICBzdGF0ZS5mb3JjZUNhdGVnb3JpY2FsQ29sb3JpbmcgPSB0aGlzLmRhdGFQYW5lbC5mb3JjZUNhdGVnb3JpY2FsQ29sb3Jpbmc7XG4gICAgc3RhdGUuc2VsZWN0ZWRMYWJlbE9wdGlvbiA9IHRoaXMuc2VsZWN0ZWRMYWJlbE9wdGlvbjtcbiAgICB0aGlzLnByb2plY3Rpb25zUGFuZWwucG9wdWxhdGVCb29rbWFya0Zyb21VSShzdGF0ZSk7XG4gICAgcmV0dXJuIHN0YXRlO1xuICB9XG4gIC8qKiBMb2FkcyBhIFN0YXRlIG9iamVjdCBpbnRvIHRoZSB3b3JsZC4gKi9cbiAgbG9hZFN0YXRlKHN0YXRlOiBTdGF0ZSkge1xuICAgIHRoaXMuc2V0UHJvamVjdGlvbihudWxsKTtcbiAgICB7XG4gICAgICB0aGlzLnByb2plY3Rpb25zUGFuZWwuZGlzYWJsZVBvbHltZXJDaGFuZ2VzVHJpZ2dlclJlcHJvamVjdGlvbigpO1xuICAgICAgaWYgKHRoaXMuZGF0YVNldEJlZm9yZUZpbHRlciAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMucmVzZXRGaWx0ZXJEYXRhc2V0KCk7XG4gICAgICB9XG4gICAgICBpZiAoc3RhdGUuZmlsdGVyZWRQb2ludHMgIT0gbnVsbCkge1xuICAgICAgICB0aGlzLmZpbHRlckRhdGFzZXQoc3RhdGUuZmlsdGVyZWRQb2ludHMpO1xuICAgICAgfVxuICAgICAgdGhpcy5wcm9qZWN0aW9uc1BhbmVsLmVuYWJsZVBvbHltZXJDaGFuZ2VzVHJpZ2dlclJlcHJvamVjdGlvbigpO1xuICAgIH1cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRlLnByb2plY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBwb2ludCA9IHRoaXMuZGF0YVNldC5wb2ludHNbaV07XG4gICAgICBjb25zdCBwcm9qZWN0aW9uID0gc3RhdGUucHJvamVjdGlvbnNbaV07XG4gICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMocHJvamVjdGlvbik7XG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGtleXMubGVuZ3RoOyArK2opIHtcbiAgICAgICAgcG9pbnQucHJvamVjdGlvbnNba2V5c1tqXV0gPSBwcm9qZWN0aW9uW2tleXNbal1dO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmRhdGFTZXQuaGFzVFNORVJ1biA9IHN0YXRlLnNlbGVjdGVkUHJvamVjdGlvbiA9PT0gJ3RzbmUnO1xuICAgIHRoaXMuZGF0YVNldC50U05FSXRlcmF0aW9uID0gc3RhdGUudFNORUl0ZXJhdGlvbjtcbiAgICB0aGlzLnByb2plY3Rpb25zUGFuZWwucmVzdG9yZVVJRnJvbUJvb2ttYXJrKHN0YXRlKTtcbiAgICB0aGlzLmluc3BlY3RvclBhbmVsLnJlc3RvcmVVSUZyb21Cb29rbWFyayhzdGF0ZSk7XG4gICAgdGhpcy5kYXRhUGFuZWwuc2VsZWN0ZWRDb2xvck9wdGlvbk5hbWUgPSBzdGF0ZS5zZWxlY3RlZENvbG9yT3B0aW9uTmFtZTtcbiAgICB0aGlzLmRhdGFQYW5lbC5zZXRGb3JjZUNhdGVnb3JpY2FsQ29sb3JpbmcoXG4gICAgICAhIXN0YXRlLmZvcmNlQ2F0ZWdvcmljYWxDb2xvcmluZ1xuICAgICk7XG4gICAgdGhpcy5zZWxlY3RlZExhYmVsT3B0aW9uID0gc3RhdGUuc2VsZWN0ZWRMYWJlbE9wdGlvbjtcbiAgICB0aGlzLnByb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci5yZXN0b3JlVUlGcm9tQm9va21hcmsoc3RhdGUpO1xuICAgIHtcbiAgICAgIGNvbnN0IGRpbWVuc2lvbnMgPSBzdGF0ZUdldEFjY2Vzc29yRGltZW5zaW9ucyhzdGF0ZSk7XG4gICAgICBjb25zdCBjb21wb25lbnRzID0gZ2V0UHJvamVjdGlvbkNvbXBvbmVudHMoXG4gICAgICAgIHN0YXRlLnNlbGVjdGVkUHJvamVjdGlvbixcbiAgICAgICAgZGltZW5zaW9uc1xuICAgICAgKTtcbiAgICAgIGNvbnN0IHByb2plY3Rpb24gPSBuZXcgUHJvamVjdGlvbihcbiAgICAgICAgc3RhdGUuc2VsZWN0ZWRQcm9qZWN0aW9uLFxuICAgICAgICBjb21wb25lbnRzLFxuICAgICAgICBkaW1lbnNpb25zLmxlbmd0aCxcbiAgICAgICAgdGhpcy5kYXRhU2V0XG4gICAgICApO1xuICAgICAgdGhpcy5zZXRQcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuICAgIH1cbiAgICB0aGlzLm5vdGlmeVNlbGVjdGlvbkNoYW5nZWQoc3RhdGUuc2VsZWN0ZWRQb2ludHMpO1xuICB9XG5cbiAgcmV0cmFpbkJ5U2VsZWN0aW9ucyhpdGVyYXRpb246IG51bWJlciwgbmV3U2VsOiBudW1iZXJbXSkge1xuICAgIHRoaXMucHJvamVjdGlvbnNQYW5lbC5yZXRyYWluQnlTZWxlY3Rpb25zKGl0ZXJhdGlvbiwgbmV3U2VsKVxuICB9XG5cblxuICAvKipcbiAgICogcXVlcnkgZm9yIGluZGljZXMgaW4gaW5zcGVjdG9yIHBhbmVsXG4gICAqL1xuICBxdWVyeShxdWVyeTogc3RyaW5nLCBpblJlZ2V4TW9kZTogYm9vbGVhbiwgZmllbGROYW1lOiBzdHJpbmcsIGN1cnJQcmVkaWNhdGVzOiB7IFtrZXk6IHN0cmluZ106IGFueSB9LCBpdGVyYXRpb246IG51bWJlciwgY29uZmlkZW5jZVRocmVzaG9sZEZyb206IGFueSwgY29uZmlkZW5jZVRocmVzaG9sZFRvOiBhbnksXG4gICAgY2FsbGJhY2s6IChpbmRpY2VzOiBhbnkpID0+IHZvaWQpIHtcblxuICAgIGxldCBjb25maWRlbmNlVGhyZXNob2xkID0gW11cbiAgICB2YXIgZHVtbXlDdXJyUHJlZGljYXRlczogeyBba2V5OiBzdHJpbmddOiBhbnkgfSA9IHt9O1xuICAgIE9iamVjdC5rZXlzKGN1cnJQcmVkaWNhdGVzKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgIGR1bW15Q3VyclByZWRpY2F0ZXNba2V5XSA9IGN1cnJQcmVkaWNhdGVzW2tleV1cbiAgICB9KTtcblxuICAgIGR1bW15Q3VyclByZWRpY2F0ZXNbZmllbGROYW1lXSA9IHF1ZXJ5O1xuICAgIGlmIChjb25maWRlbmNlVGhyZXNob2xkRnJvbSB8fCBjb25maWRlbmNlVGhyZXNob2xkVG8pIHtcbiAgICAgIGR1bW15Q3VyclByZWRpY2F0ZXNbJ2NvbmZpZGVuY2UnXSA9IFtOdW1iZXIoY29uZmlkZW5jZVRocmVzaG9sZEZyb20pLCBOdW1iZXIoY29uZmlkZW5jZVRocmVzaG9sZFRvKV1cbiAgICB9XG4gICAgY29uc29sZS5sb2coXCInYWFhYWFhXCIpXG4gICAgY29uc3QgbXNnSWQgPSBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZSgnUXVlcnlpbmcuLi4nKTtcbiAgICBsZXQgaGVhZGVycyA9IG5ldyBIZWFkZXJzKCk7XG4gICAgaGVhZGVycy5hcHBlbmQoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgaGVhZGVycy5hcHBlbmQoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgZmV0Y2goYGh0dHA6Ly8ke3RoaXMuRFZJU2VydmVyfS9xdWVyeWAsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBcInByZWRpY2F0ZXNcIjogZHVtbXlDdXJyUHJlZGljYXRlcywgXCJjb250ZW50X3BhdGhcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLmNvbnRlbnRfcGF0aCB8fCB0aGlzLmRhdGFTZXQuRFZJc3ViamVjdE1vZGVsUGF0aCxcbiAgICAgICAgXCJpdGVyYXRpb25cIjogaXRlcmF0aW9uLFwidXNlcm5hbWVcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLnVzZXJuYW1lLFxuICAgICAgICBcInZpc19tZXRob2RcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLnZpc19tZXRob2QsJ3NldHRpbmcnOndpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZWxlY3RlZFNldHRpbmdcbiAgICAgIH0pLFxuICAgICAgaGVhZGVyczogaGVhZGVycyxcbiAgICAgIG1vZGU6ICdjb3JzJ1xuICAgIH0pLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKS50aGVuKGRhdGEgPT4ge1xuICAgICAgY29uc3QgaW5kaWNlcyA9IGRhdGEuc2VsZWN0ZWRQb2ludHM7XG4gICAgICB3aW5kb3cuYWxTdWdnZXN0TGFiZWxMaXN0ID0gW11cbiAgICAgIGxvZ2dpbmcuc2V0TW9kYWxNZXNzYWdlKG51bGwsIG1zZ0lkKTtcbiAgICAgIGNhbGxiYWNrKGluZGljZXMpO1xuICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIGxvZ2dpbmcuc2V0RXJyb3JNZXNzYWdlKCdxdWVyeWluZyBmb3IgaW5kaWNlcycpO1xuICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgfSk7XG4gIH1cblxuICBnZXRBbGxSZXNQb3NMaXN0KGNhbGxiYWNrOiAoZGF0YTogYW55KSA9PiB2b2lkKSB7XG4gICAgaWYgKHdpbmRvdy5hbGxSZXNQb3NpdGlvbnMgJiYgd2luZG93LmFsbFJlc1Bvc2l0aW9ucy5yZXN1bHRzICYmIHdpbmRvdy5hbGxSZXNQb3NpdGlvbnMuYmdpbWdMaXN0KSB7XG4gICAgICBjYWxsYmFjayh3aW5kb3cuYWxsUmVzUG9zaXRpb25zKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGNvbnN0IG1zZ0lkID0gbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UoJ1F1ZXJ5aW5nLi4uJyk7XG4gICAgbGV0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICAgIGhlYWRlcnMuYXBwZW5kKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIGhlYWRlcnMuYXBwZW5kKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIGZldGNoKGBodHRwOi8vJHt0aGlzLkRWSVNlcnZlcn0vYWxsX3Jlc3VsdF9saXN0YCwge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIFwiaXRlcmF0aW9uX3N0YXJ0XCI6IDEsXG4gICAgICAgIFwiaXRlcmF0aW9uX2VuZFwiOiAyLFxuICAgICAgICBcImNvbnRlbnRfcGF0aFwiOiB0aGlzLmRhdGFTZXQuRFZJc3ViamVjdE1vZGVsUGF0aCxcbiAgICAgICAgXCJ1c2VybmFtZVwiOiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudXNlcm5hbWVcbiAgICAgIH0pLFxuICAgICAgaGVhZGVyczogaGVhZGVycyxcbiAgICAgIG1vZGU6ICdjb3JzJ1xuICAgIH0pLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKS50aGVuKGRhdGEgPT4ge1xuICAgICAgY29uc3QgaW5kaWNlcyA9IGRhdGEuc2VsZWN0ZWRQb2ludHM7XG4gICAgICBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZShudWxsLCBtc2dJZCk7XG4gICAgICBjYWxsYmFjayhkYXRhKVxuICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIGxvZ2dpbmcuc2V0RXJyb3JNZXNzYWdlKCdxdWVyeWluZyBmb3IgaW5kaWNlcycpO1xuXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogcXVlcnkgZm9yIHByZWRpY2F0ZXNcbiAgICovXG4gIHNpbXBsZVF1ZXJ5KHByZWRpY2F0ZXM6IHsgW2tleTogc3RyaW5nXTogYW55IH0sIGl0ZXJhdGlvbjogbnVtYmVyKSB7XG4gICAgbGV0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICAgIGhlYWRlcnMuYXBwZW5kKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIGhlYWRlcnMuYXBwZW5kKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIGZldGNoKGBodHRwOi8vJHt0aGlzLkRWSVNlcnZlcn0vcXVlcnlgLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgXCJwcmVkaWNhdGVzXCI6IHByZWRpY2F0ZXMsIFwiY29udGVudF9wYXRoXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5jb250ZW50X3BhdGggfHwgdGhpcy5kYXRhU2V0LkRWSXN1YmplY3RNb2RlbFBhdGgsXG4gICAgICAgIFwiaXRlcmF0aW9uXCI6IGl0ZXJhdGlvbiwgXCJ1c2VybmFtZVwiOiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudXNlcm5hbWUsXCJ2aXNfbWV0aG9kXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS52aXNfbWV0aG9kLCdzZXR0aW5nJzp3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2VsZWN0ZWRTZXR0aW5nXG4gICAgICB9KSxcbiAgICAgIGhlYWRlcnM6IGhlYWRlcnMsXG4gICAgICBtb2RlOiAnY29ycydcbiAgICB9KS50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSkudGhlbihkYXRhID0+IHtcbiAgICAgIGNvbnN0IGluZGljZXMgPSBkYXRhLnNlbGVjdGVkUG9pbnRzO1xuICAgICAgdGhpcy5pbnNwZWN0b3JQYW5lbC5maWx0ZXJlZFBvaW50cyA9IGluZGljZXM7XG4gICAgICB3aW5kb3cuYWxTdWdnZXN0TGFiZWxMaXN0ID0gW11cbiAgICB9KS5jYXRjaChlcnJvciA9PiB7XG4gICAgICBsb2dnaW5nLnNldEVycm9yTWVzc2FnZSgncXVlcnlpbmcgZm9yIGluZGljZXMnKTtcbiAgICB9KTtcbiAgfVxuICAvLyBhY3RpdmUgbGVhcm5pbmdcbiAgcXVlcnlCeUFMKGl0ZXJhdGlvbjogbnVtYmVyLCBzdHJhdGVneTogc3RyaW5nLCBidWRnZXQ6IG51bWJlciwgYWNjZXB0SW5kaWNhdGVzOiBudW1iZXJbXSwgcmVqZWN0SW5kaWNhdGVzOiBudW1iZXJbXSxpc1JlY29tbWVuZDpib29sZWFuLFxuICAgIGNhbGxiYWNrOiAoaW5kaWNlczogYW55LCBzY29yZXM6IGFueSwgbGFiZWxzOiBhbnkpID0+IHZvaWQpIHtcbiAgICBjb25zdCBtc2dJZCA9IGxvZ2dpbmcuc2V0TW9kYWxNZXNzYWdlKCdRdWVyeWluZy4uLicpO1xuICAgIGxldCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgIFxuICAgXG4gICAgbGV0IGFjY0luZGljYXRlcyA9IFtdXG4gICAgaWYod2luZG93LmFjY2VwdEluZGljYXRlcyl7XG4gICAgICBhY2NJbmRpY2F0ZXMgPSB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzLmZpbHRlcigoaXRlbSwgaSwgYXJyKSA9PiB7XG4gICAgICAgIC8v5Ye95pWw6Ieq6Lqr6L+U5Zue55qE5piv5LiA5Liq5biD5bCU5YC877yM5Y+q5b2T6L+U5Zue5YC85Li6dHJ1ZeaXtu+8jOW9k+WJjeWFg+e0oOaJjeS8muWtmOWFpeaWsOeahOaVsOe7hOS4reOAgiAgICAgICAgICAgIFxuICAgICAgICByZXR1cm4gd2luZG93LnByb3BlcnRpZXNbd2luZG93Lml0ZXJhdGlvbl1baXRlbV0gPT09IDFcbiAgICAgIH0pXG4gICAgfVxuICAgIGxldCByZWpJbmRpY2F0ZXMgPSBbXVxuICAgIGlmKHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMpe1xuICAgICAgcmVqSW5kaWNhdGVzID0gd2luZG93LnJlamVjdEluZGljYXRlcy5maWx0ZXIoKGl0ZW0sIGksIGFycikgPT4ge1xuICAgICAgICAvL+WHveaVsOiHqui6q+i/lOWbnueahOaYr+S4gOS4quW4g+WwlOWAvO+8jOWPquW9k+i/lOWbnuWAvOS4unRydWXml7bvvIzlvZPliY3lhYPntKDmiY3kvJrlrZjlhaXmlrDnmoTmlbDnu4TkuK3jgIIgICAgICAgICAgICBcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dW2l0ZW1dID09PSAxXG4gICAgICB9KVxuICAgIH1cblxuICAgIGZldGNoKGBodHRwOi8vJHt0aGlzLkRWSVNlcnZlcn0vYWxfcXVlcnlgLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgXCJpdGVyYXRpb25cIjogaXRlcmF0aW9uLFxuICAgICAgICBcInN0cmF0ZWd5XCI6IHN0cmF0ZWd5LFxuICAgICAgICBcImJ1ZGdldFwiOiBidWRnZXQsXG4gICAgICAgIFwiY29udGVudF9wYXRoXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5jb250ZW50X3BhdGggfHwgdGhpcy5kYXRhU2V0LkRWSXN1YmplY3RNb2RlbFBhdGgsXG4gICAgICAgIFwiYWNjSW5kaWNlc1wiOiBhY2NJbmRpY2F0ZXMsXG4gICAgICAgIFwicmVqSW5kaWNlc1wiOiByZWpJbmRpY2F0ZXMsXG4gICAgICAgIFwiaXNSZWNvbW1lbmRcIjppc1JlY29tbWVuZCxcbiAgICAgICAgXCJ1c2VybmFtZVwiOiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudXNlcm5hbWUsXG4gICAgICAgIFwidmlzX21ldGhvZFwiOiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UudmlzX21ldGhvZCxcbiAgICAgICAgJ3NldHRpbmcnOndpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZWxlY3RlZFNldHRpbmdcbiAgICAgIH0pLFxuICAgICAgaGVhZGVyczogaGVhZGVycyxcbiAgICAgIG1vZGU6ICdjb3JzJ1xuICAgIH0pLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKS50aGVuKGRhdGEgPT4ge1xuICAgICAgY29uc3QgaW5kaWNlcyA9IGRhdGEuc2VsZWN0ZWRQb2ludHM7XG4gICAgICBjb25zdCBsYWJlbHMgPSBkYXRhLnN1Z2dlc3RMYWJlbHM7XG4gICAgICBjb25zdCBzY29yZXMgPSBkYXRhLnNjb3Jlc1xuICAgICAgbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UobnVsbCwgbXNnSWQpO1xuXG4gICAgICAvLyBpZiAoY3VycmVudEluZGljZXMgJiYgY3VycmVudEluZGljZXMubGVuZ3RoKSB7XG4gICAgICAvLyAgIGZvciAobGV0IGkgPSAwOyBpIDwgY3VycmVudEluZGljZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vICAgICBpZiAod2luZG93LnByZXZpb3VzSW5kZWNhdGVzLmluZGV4T2YoY3VycmVudEluZGljZXNbaV0pID09PSAtMSkge1xuICAgICAgLy8gICAgICAgd2luZG93LnByZXZpb3VzSW5kZWNhdGVzLnB1c2goY3VycmVudEluZGljZXNbaV0pXG4gICAgICAvLyAgICAgfVxuICAgICAgLy8gICB9XG4gICAgICAvLyAgIGZ1bmN0aW9uIGZ1bmMoYSwgYikge1xuICAgICAgLy8gICAgIHJldHVybiBhIC0gYjtcbiAgICAgIC8vICAgfVxuICAgICAgLy8gICB3aW5kb3cucHJldmlvdXNJbmRlY2F0ZXMuc29ydChmdW5jKVxuICAgICAgLy8gfSBlbHNlIHtcbiAgICAgIC8vICAgZm9yIChsZXQgaSA9IDA7IGkgPCB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyAgICAgaWYgKHdpbmRvdy5wcmV2aW91c0luZGVjYXRlcy5pbmRleE9mKHdpbmRvdy5jdXN0b21TZWxlY3Rpb25baV0pID09PSAtMSkge1xuICAgICAgLy8gICAgICAgd2luZG93LnByZXZpb3VzSW5kZWNhdGVzLnB1c2god2luZG93LmN1c3RvbVNlbGVjdGlvbltpXSlcbiAgICAgIC8vICAgICB9XG4gICAgICAvLyAgIH1cbiAgICAgIC8vICAgZnVuY3Rpb24gZnVuYyhhLCBiKSB7XG4gICAgICAvLyAgICAgcmV0dXJuIGEgLSBiO1xuICAgICAgLy8gICB9XG4gICAgICAvLyAgIHdpbmRvdy5wcmV2aW91c0luZGVjYXRlcy5zb3J0KGZ1bmMpXG4gICAgICAvLyB9XG5cblxuXG4gICAgICBjYWxsYmFjayhpbmRpY2VzLCBzY29yZXMsIGxhYmVscyk7XG4gICAgfSkuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgbG9nZ2luZy5zZXRFcnJvck1lc3NhZ2UoJ3F1ZXJ5aW5nIGZvciBpbmRpY2VzJyk7XG4gICAgICBjYWxsYmFjayhudWxsLCBbXSwgW10pO1xuICAgIH0pO1xuICB9XG4gIC8vIGFub3JtYWx5IGRldGVjdGlvblxuICBxdWVyeUFub3JtYWx5U3RyYXRlZ3koYnVkZ2V0OiBudW1iZXIsIGNsczogbnVtYmVyLCBjdXJyZW50SW5kaWNlczogbnVtYmVyW10sIGNvbWZpcm1faW5mbzogYW55W10sIGFjY0luZGljYXRlczogbnVtYmVyW10sIHJlakluZGljYXRlczogbnVtYmVyW10sIHN0cmF0ZWd5OiBzdHJpbmcsaXNSZWNvbW1lbmQ6Ym9vbGVhbixcbiAgICBjYWxsYmFjazogKGluZGljZXM6IGFueSwgY2xlYW5JbmRpY2VzPzogYW55KSA9PiB2b2lkKSB7XG4gICAgY29uc3QgbXNnSWQgPSBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZSgnUXVlcnlpbmcuLi4nKTtcbiAgICBsZXQgaGVhZGVycyA9IG5ldyBIZWFkZXJzKCk7XG4gICAgaWYgKCFhY2NJbmRpY2F0ZXMpIHtcbiAgICAgIGFjY0luZGljYXRlcyA9IFtdXG4gICAgfVxuICAgIGlmICghcmVqSW5kaWNhdGVzKSB7XG4gICAgICByZWpJbmRpY2F0ZXMgPSBbXVxuICAgIH1cbiAgICBsZXQgYWNjSW4gPSBbXVxuICAgIC8vIGlmKHdpbmRvdy5hY2NlcHRJbmRpY2F0ZXMpe1xuICAgIC8vICAgYWNjSW5kaWNhdGVzID0gd2luZG93LmFjY2VwdEluZGljYXRlcy5maWx0ZXIoKGl0ZW0sIGksIGFycikgPT4ge1xuICAgIC8vICAgICAvL+WHveaVsOiHqui6q+i/lOWbnueahOaYr+S4gOS4quW4g+WwlOWAvO+8jOWPquW9k+i/lOWbnuWAvOS4unRydWXml7bvvIzlvZPliY3lhYPntKDmiY3kvJrlrZjlhaXmlrDnmoTmlbDnu4TkuK3jgIIgICAgICAgICAgICBcbiAgICAvLyAgICAgcmV0dXJuIHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dW2l0ZW1dID09PSAxXG4gICAgLy8gICB9KVxuICAgIC8vIH1cbiAgICAvLyBsZXQgcmVqSW4gPSBbXVxuICAgIC8vIGlmKHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMpe1xuICAgIC8vICAgcmVqSW5kaWNhdGVzID0gd2luZG93LnJlamVjdEluZGljYXRlcy5maWx0ZXIoKGl0ZW0sIGksIGFycikgPT4ge1xuICAgIC8vICAgICAvL+WHveaVsOiHqui6q+i/lOWbnueahOaYr+S4gOS4quW4g+WwlOWAvO+8jOWPquW9k+i/lOWbnuWAvOS4unRydWXml7bvvIzlvZPliY3lhYPntKDmiY3kvJrlrZjlhaXmlrDnmoTmlbDnu4TkuK3jgIIgICAgICAgICAgICBcbiAgICAvLyAgICAgcmV0dXJuIHdpbmRvdy5wcm9wZXJ0aWVzW3dpbmRvdy5pdGVyYXRpb25dW2l0ZW1dID09PSAxXG4gICAgLy8gICB9KVxuICAgIC8vIH1cbiAgICBoZWFkZXJzLmFwcGVuZCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBmZXRjaChgaHR0cDovLyR7dGhpcy5EVklTZXJ2ZXJ9L2Fub21hbHlfcXVlcnlgLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgXCJidWRnZXRcIjogYnVkZ2V0LFxuICAgICAgICBcImNsc1wiOiBjbHMsXG4gICAgICAgIFwiaW5kaWNlc1wiOiBjdXJyZW50SW5kaWNlcyxcbiAgICAgICAgXCJjb250ZW50X3BhdGhcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLmNvbnRlbnRfcGF0aCB8fCB0aGlzLmRhdGFTZXQuRFZJc3ViamVjdE1vZGVsUGF0aCxcbiAgICAgICAgXCJjb21maXJtX2luZm9cIjogY29tZmlybV9pbmZvLFxuICAgICAgICBcImFjY0luZGljZXNcIjogYWNjSW5kaWNhdGVzLFxuICAgICAgICBcInJlakluZGljZXNcIjogcmVqSW5kaWNhdGVzLFxuICAgICAgICBcInN0cmF0ZWd5XCI6IHN0cmF0ZWd5LFxuICAgICAgICBcInVzZXJuYW1lXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS51c2VybmFtZSxcbiAgICAgICAgXCJpc1JlY29tbWVuZFwiOmlzUmVjb21tZW5kLFxuICAgICAgICBcInZpc19tZXRob2RcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLnZpc19tZXRob2QsXG4gICAgICAgICdzZXR0aW5nJzp3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2VsZWN0ZWRTZXR0aW5nXG4gICAgICB9KSxcbiAgICAgIGhlYWRlcnM6IGhlYWRlcnMsXG4gICAgICBtb2RlOiAnY29ycydcbiAgICB9KS50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSkudGhlbihkYXRhID0+IHtcbiAgICAgIGNvbnN0IGluZGljZXMgPSBkYXRhLnNlbGVjdGVkUG9pbnRzO1xuICAgICAgY29uc3QgbGFiZWxzID0gZGF0YS5zdWdnZXN0TGFiZWxzO1xuICAgICAgY29uc3Qgc2NvcmVzID0gZGF0YS5zY29yZXNcbiAgICAgIGNvbnN0IGNsZWFuSW5kaWNlcyA9IGRhdGEuY2xlYW5MaXN0XG4gICAgICB3aW5kb3cuYWxTdWdnZXN0U2NvcmVMaXN0ID0gZGF0YS5zY29yZXNcbiAgICAgIHdpbmRvdy5hbFN1Z2dlc3RMYWJlbExpc3QgPSBkYXRhLnN1Z2dlc3RMYWJlbHM7XG4gICAgICBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZShudWxsLCBtc2dJZCk7XG4gICAgICBjYWxsYmFjayhpbmRpY2VzLCBjbGVhbkluZGljZXMpO1xuICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIGxvZ2dpbmcuc2V0RXJyb3JNZXNzYWdlKCdxdWVyeWluZyBmb3IgaW5kaWNlcycpO1xuICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgfSk7XG4gIH1cblxuICBxdWVyeVN1Z2dlc3Rpb24oaXRlcmF0aW9uOiBudW1iZXIsIGluZGljZXM6IG51bWJlcltdLCBrOiBudW1iZXIsXG4gICAgY2FsbGJhY2s6IChpbmRpY2VzOiBhbnkpID0+IHZvaWQpIHtcbiAgICBjb25zdCBtc2dJZCA9IGxvZ2dpbmcuc2V0TW9kYWxNZXNzYWdlKCdRdWVyeWluZy4uLicpO1xuICAgIGxldCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBoZWFkZXJzLmFwcGVuZCgnQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBmZXRjaChgaHR0cDovLyR7dGhpcy5EVklTZXJ2ZXJ9L2FsX3N1Z2dlc3Rfc2ltaWxhcmAsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBcIml0ZXJhdGlvblwiOiBpdGVyYXRpb24sXG4gICAgICAgIFwic2VsZWN0SW5kaWNlc1wiOiBpbmRpY2VzLFxuICAgICAgICBcImtcIjogayxcbiAgICAgICAgXCJjb250ZW50X3BhdGhcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLmNvbnRlbnRfcGF0aCB8fCB0aGlzLmRhdGFTZXQuRFZJc3ViamVjdE1vZGVsUGF0aCxcbiAgICAgICAgXCJ2aXNfbWV0aG9kXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS52aXNfbWV0aG9kLFxuICAgICAgICAnc2V0dGluZyc6d2luZG93LnNlc3Npb25TdG9yYWdlLnNlbGVjdGVkU2V0dGluZ1xuICAgICAgfSksXG4gICAgICBoZWFkZXJzOiBoZWFkZXJzLFxuICAgICAgbW9kZTogJ2NvcnMnXG4gICAgfSkudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpLnRoZW4oZGF0YSA9PiB7XG4gICAgICBjb25zdCBpbmRpY2VzID0gZGF0YS5zaW1pbGFySW5kaWNlcztcbiAgICAgIGxvZ2dpbmcuc2V0TW9kYWxNZXNzYWdlKG51bGwsIG1zZ0lkKTtcbiAgICAgIGNhbGxiYWNrKGluZGljZXMpO1xuICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIC8vIGxvZ2dpbmcuc2V0RXJyb3JNZXNzYWdlKCdxdWVyeWluZyBmb3IgaW5kaWNlcycpO1xuICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgfSk7XG4gIH1cblxuXG4gIHNhdmVEVklTZWxlY3Rpb24oaW5kaWNlczogbnVtYmVyW10sIGNhbGxiYWNrOiAobXNnOiBzdHJpbmcpID0+IHZvaWQpIHtcbiAgICBsZXQgaGVhZGVycyA9IG5ldyBIZWFkZXJzKCk7XG4gICAgaGVhZGVycy5hcHBlbmQoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgaGVhZGVycy5hcHBlbmQoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgZmV0Y2goYGh0dHA6Ly8ke3RoaXMuRFZJU2VydmVyfS9zYXZlRFZJc2VsZWN0aW9uc2AsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBcIm5ld0luZGljZXNcIjogaW5kaWNlcywgXG4gICAgICAgIFwiY29udGVudF9wYXRoXCI6IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5jb250ZW50X3BhdGggfHwgdGhpcy5kYXRhU2V0LkRWSXN1YmplY3RNb2RlbFBhdGgsXG4gICAgICAgIFwiaXRlcmF0aW9uXCI6IHRoaXMuaXRlcmF0aW9uLFxuICAgICAgICBcInZpc19tZXRob2RcIjogd2luZG93LnNlc3Npb25TdG9yYWdlLnZpc19tZXRob2QsXG4gICAgICAgICdzZXR0aW5nJzp3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2VsZWN0ZWRTZXR0aW5nXG4gICAgICB9KSxcbiAgICAgIGhlYWRlcnM6IGhlYWRlcnMsXG4gICAgICBtb2RlOiAnY29ycydcbiAgICB9KS50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSkudGhlbihkYXRhID0+IHtcbiAgICAgIGNvbnN0IG1zZyA9IGRhdGEubWVzc2FnZTtcbiAgICAgIGNhbGxiYWNrKG1zZyk7XG4gICAgfSkuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgbG9nZ2luZy5zZXRFcnJvck1lc3NhZ2UoJ3NhdmluZyBpbmRpY2VzJyk7XG4gICAgfSk7XG4gIH1cblxufVxuIl19