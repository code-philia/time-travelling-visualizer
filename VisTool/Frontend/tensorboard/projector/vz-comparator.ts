
  import { PolymerElement } from '@polymer/polymer';
  import { customElement, observe, property } from '@polymer/decorators';
  import * as THREE from 'three';
  import{ getcontraVisHighlightIndices, updateSessionStateForInstance, getIsAnimating, getTSNETotalIter, getLastIteration, getScene, getHiddenBackground, getHighlightedPointIndices, getConfChangeIndices, getNowShowIndicates, getProperties, getPreviousHover, getAlQueryResPointIndices, getAllResPositions, getCurrentFocus, getPredChangeIndices, getSelectedTotalEpoch, getIteration, getIsAdjustingSel, updateStateForInstance, getAlSuggestLabelList, getFlagindecatesList,getQueryResAnormalCleanIndecates, getLineGeomertryList, getAcceptInputList, getAlSuggestScoreList, getRejectInputList, getTaskType, getAcceptIndicates, getQueryResAnormalIndecates, getCustomSelection, getModelMath, getCheckBoxDom, getQueryResPointIndices, getRejectIndicates, getPreviousIndecates, getCurrentSessionState } from './globalState';
  import { LegacyElementMixin } from '../components/polymer/legacy_element_mixin';
  import '../components/polymer/irons_and_papers';
  
  import { AnalyticsLogger } from './analyticsLogger';
  import { template } from './vz-comparator.html';
  import {
    ColorOption,
    ColumnStats,
    DistanceFunction,
    DataPoint,
    DataProto,
    DataSet,
    getProjectionComponents,
    PointMetadata,
    Projection,
    SpriteAndMetadataInfo,
    State,
    stateGetAccessorDimensions, Sequence,
  } from './data';
  import './vz-projector-metadata-card';
  import {
    ServingMode,
    DataProvider,
    analyzeMetadata,
    EmbeddingInfo, ProjectorConfig,
  } from './data-provider';
  import { DemoDataProvider } from './data-provider-demo';
  import { ProtoDataProvider } from './data-provider-proto';
  import { ServerDataProvider } from './data-provider-server';
  import './vz-projector-projections-panel';
  import './vz-projector-bookmark-panel';
  import './vz-projector-data-panel';
  import './vz-projector-inspector-panel';
  import { ProjectorScatterPlotAdapter } from './projectorScatterPlotAdapter';
  import {
    DistanceMetricChangedListener,
    HoverListener,
    ProjectionChangedListener,
    ProjectorEventContext,
    SelectionChangedListener,
  } from './projectorEventContext';
  import * as knn from './knn';
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
  
  @customElement('vz-comparator')
  class Comparator
    extends LegacyElementMixin(PolymerElement)
    implements ProjectorEventContext {
      static readonly template = template;


      @property({ type: String })
      routePrefix: string;
    
      @property({ type: String })
      dataProto: string;
    
      @property({ type: String })
      servingMode: ServingMode;
    
      // The path to the projector config JSON file for demo mode.
      @property({ type: String })
      projectorConfigJsonPath: string;
    
      @property({ type: Boolean })
      pageViewLogging: boolean;
    
      @property({ type: Boolean })
      eventLogging: boolean;
    
      @property({ type: Object })
      metadataStyle: any
    
      /**
       * DVI properties
       */
      @property({ type: String })
      DVIServer: string
    
      @property({ type: Boolean })
      showlabeled: boolean = true;
    
      @property({ type: Boolean })
      showUnlabeled: boolean = false;
    
      @property({ type: Boolean })
      showTesting: boolean = false;
    
      @property({ type: Boolean })
      showVisError: boolean = false;
    
      @property({ type: Boolean })
      fixVisError: boolean = false;
    
      @property({ type: Boolean })
      highlightChange: boolean = false;
    
      @property({ type: Boolean })
      highlightConfChange: boolean = false;
    
      @property({ type: Boolean })
      _showNotAvaliable: boolean = false
    
      @property({ type: Boolean })
      showUnlabeledCheckbox: boolean = false
    
      @property({ type: Number })
      confEditorInput: number;
    
      @property({ type: Number })
      instanceId: number;

      @property({type: Array})
      contraVisHighlightIndices: Array<number> = []; 

      @property({type: Boolean})
      isContraVis: boolean;
    
      // The working subset of the data source's original data set.
      dataSet: DataSet;
      iteration: number;
      last_iteration: number;
      private selectionChangedListeners: SelectionChangedListener[];
      private hoverListeners: HoverListener[];
      private projectionChangedListeners: ProjectionChangedListener[];
      private distanceMetricChangedListeners: DistanceMetricChangedListener[];
      private originalDataSet: DataSet;
      private dataSetBeforeFilter: DataSet;
      private projectorScatterPlotAdapter: ProjectorScatterPlotAdapter;
      private dim: number;
      private dataSetFilterIndices: number[];
      private selectedPointIndices: number[];
      private neighborsOfFirstPoint: knn.NearestEntry[];
      private hoverPointIndex: number;
      private editMode: boolean;
      private dataProvider: DataProvider;
      private selectedColorOption: ColorOption;
      private selectedLabelOption: string;
      private normalizeData: boolean;
      private projection: Projection;
      private metadataFile: string;
      /** Polymer component panels */
      private inspectorPanel: any;
      private dataPanel: any;
      private bookmarkPanel: any;
      private projectionsPanel: any;
      private metadataCard: any;
      private statusBar: HTMLDivElement;
      private analyticsLogger: AnalyticsLogger;
      private backgroundPoints: any;
      private currentIteration: number
    
      private goDownBtn: any;
      private goUpBtn: any;
      private goLeftBtn: any;
      private goRightBtn: any;
    
      private helpBtn: any;
    
      private timer: any;
    
      private intervalFlag: boolean
    
      private registered: boolean
      private showConfChangeButton: HTMLButtonElement;
      private confChangeInput: number;
    
    
      constructor() {
        super();
        console.log('projector Constructor called');
        // other constructor code
    }
    
      async ready() {
        super.ready();
        console.log('projecotr Ready method called');
        logging.setDomContainer(this as HTMLElement);
        this.analyticsLogger = new AnalyticsLogger(
          this.pageViewLogging,
          this.eventLogging
        );
        this.analyticsLogger.logPageView('embeddings');
        const hasWebGLSupport = await util.hasWebGLSupport();
        if (!hasWebGLSupport) {
          this.analyticsLogger.logWebGLDisabled();
          logging.setErrorMessage(
            'Your browser or device does not have WebGL enabled. Please enable ' +
            'hardware acceleration, or use a browser that supports WebGL.'
          );
          return;
        }
        this.selectionChangedListeners = [];
        this.hoverListeners = [];
        this.projectionChangedListeners = [];
        this.distanceMetricChangedListeners = [];
        this.selectedPointIndices = [];
        this.neighborsOfFirstPoint = [];
        this.timer = null
        this.editMode = false;
        this.dataPanel = this.$['data-panel'] as any; // DataPanel
        this.inspectorPanel = this.$['inspector-panel'] as any; // InspectorPanel
        this.projectionsPanel = this.$['projections-panel'] as any; // ProjectionsPanel
        this.bookmarkPanel = this.$['bookmark-panel'] as any; // BookmarkPanel
        this.metadataCard = this.$['metadata-card'] as any; // MetadataCard
        this.statusBar = this.$$('#status-bar') as HTMLDivElement;
        this.helpBtn = this.$$('#help-3d-icon') as HTMLElement;
        this.inspectorPanel.initialize(this, this as ProjectorEventContext);
        this.projectionsPanel.initialize(this);
        this.bookmarkPanel.initialize(this, this as ProjectorEventContext);
        if (!this.isContraVis) {
          this.showConfChangeButton = this.$$('.show-button') as HTMLButtonElement;
          this.showConfChangeButton.disabled = false;
        }

        this.setupUIControls();
        this.initializeDataProvider();
        this.d3loader()
        this.iteration = 0;
        this.last_iteration = 1;
        this.currentIteration = 0
    
        this.showlabeled = true
        this.showUnlabeled = false
        this.showTesting = false
        this.showVisError = false
        this.fixVisError = false
        this.highlightChange = false
        this.highlightConfChange = false;
        this.contraVisHighlightIndices = []
        this.registered = false
    
        this.showUnlabeledCheckbox = window.sessionStorage.taskType === 'active learning'
    
    
        this.intervalFlag = true
        this._showNotAvaliable = false
    
        this.metadataStyle = {
          left: '320px',
          top: '120px'
        }
    
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('Accept', 'application/json');
        // await fetch("standalone_projector_config.json", { method: 'GET' })
        //   .then(response => response.json())
        //   .then(data => { this.DVIServer = data.DVIServerIP + ":" + data.DVIServerPort; })
        this.DVIServer = window.sessionStorage.ipAddress
      };
      d3loader() {
        let that = this
        new Promise((resolve) => {
          let url = "https://d3js.org/d3.v5.min.js"
    
          let script = document.createElement('script')
          script.setAttribute('src', url)
    
          script.onload = () => {
            resolve(true)
            console.log("d3loader")
            that.initialTree()
          }
          document.body.append(script)
        })
      }
      
        async initialTree(only?: number, needRemove?: boolean) {
           const d3 = window.d3

          let curr_id = this.instanceId

          let svgDom: any = this.$$("#mysvg-"+curr_id);
  
          while (svgDom?.firstChild) {
            svgDom.removeChild(svgDom.lastChild);
          }
          if (needRemove) {
            return
          }
      

        let headers = new Headers();
        await fetch(`http://${window.sessionStorage.ipAddress}/get_itertaion_structure?path=${window.sessionStorage.content_path}`, {
          method: 'POST',
          headers: headers,
          mode: 'cors'
        })
          .then(response => response.json())
          .then(res => {
            if (only) {
              res.structure = [{ value: only, name: only, pid: "" }]
            }
            let total = res.structure?.length
            console.log("total", total)
            res.structure.length = getSelectedTotalEpoch(this.instanceId)
            updateStateForInstance(this.instanceId, { treejson: res.structure })
   
            let data = res.structure

    
            function tranListToTreeData(arr) {
              const newArr = []
              const map = {}

              arr.forEach(item => {
                // 为了计算方便，统一添加children
                item.children = []
                // 构建一个字典
                const key = item.value
                map[key] = item
              })
    
              // 2. 对于arr中的每一项
              arr.forEach(item => {
                const parent = map[item.pid]
                if (parent) {
                  //    如果它有父级，把当前对象添加父级元素的children中
                  parent.children.push(item)
                } else {
                  //    如果它没有父级（pid:''）,直接添加到newArr
                  newArr.push(item)
                }
              })
    
              return newArr
            }
            data = tranListToTreeData(data)[0]
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
     
    
            //create tree
            let len = total
            console.log("tsssssss", len)
            let svgWidth = len * 40
            if (window.sessionStorage.taskType === 'active learning') {
              svgWidth = 1000
            }

            svgDom.style.width = svgWidth + 200
            if (window.sessionStorage.selectedSetting !== 'active learning' && window.sessionStorage.selectedSetting !== 'dense al') {
              svgDom.style.height = 90
            }
    
    
            var tree = d3.tree()
              .size([100, svgWidth])
              .separation(function (a, b) {
                return (a.parent == b.parent ? 1 : 2) / a.depth;
              });
    
            //init
            var treeData = tree(hierarchyData)
    
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
                return 'translate(' + d.y + ',' + d.x + ')';
              });
    
            //绘制文字和节点
            if(getIteration(this.instanceId) == undefined){
              updateStateForInstance(this.instanceId, {iteration:1})
            }
            gs.append('circle')
              .attr('r', 8)
              .attr('fill', function (d, i) {
                return d.data.value == getIteration(this.instanceId) ? 'orange' : '#452d8a'
              })
              .attr('stroke-width', 1)
              .attr('stroke', function (d, i) {
                return d.data.value == getIteration(this.instanceId) ? 'orange' : '#452d8a'
              })
    
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
                } else {
                  return `${d.data.value}`;
                }
    
              })
          })
        let that = this
        setTimeout(() => {
          let list = svgDom.querySelectorAll("circle");
          for (let i = 0; i <= list.length; i++) {
            let c = list[i]
            if (c) {
              c.style.cursor = "pointer"
              if (!only) {
                c.addEventListener('click', (e: any) => {
                  if (e.target.nextSibling.innerHTML != getIteration(this.instanceId)) {
                    let value = e.target.nextSibling.innerHTML.split("|")[0]
                    that.projectionsPanel.jumpTo(Number(value))
                    updateSessionStateForInstance(this.instanceId, {acceptIndicates:""})
                    updateSessionStateForInstance(this.instanceId, {rejectIndicates:""})
                    // updateStateForInstance(this.instanceId, { acceptIndicates: "" })
                    // updateStateForInstance(this.instanceId, { rejectIndicates: "" })
                    // getAcceptIndicates(this.instanceId) = ""
                    // getRejectIndicates(this.instanceId) = ""
                    // window.sessionStorage.setItem('acceptIndicates', "")
                    // window.sessionStorage.setItem('rejectIndicates', "")
                    this.initialTree()
                  }
                })
              }
            }
          }
        }, 2000)
      }
    
      readyregis() {
        let el: any = this.$$('#metadata-card')
        if (!el) {
          return
        }
        let that = this
        this.registered = true
        el.onmousedown = function (e: any) {
          e = e || window.event;
          document.body.style.cursor = 'move'
    
          // 初始位置
          let offleft = Number(that.metadataStyle.left.replace('px', '')) || 0;
          let offTop = Number(that.metadataStyle.top.replace('px', '')) || 0;
          // 鼠标点击位置
          let startX = e.clientX;
          let startY = e.clientY;
    
          el.setCapture && el.setCapture();
    
    
          const handler = function (event: any) {
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
            if (
              lastX >
              document.documentElement.clientWidth - el.clientWidth - 20
            ) {
              lastX = document.documentElement.clientWidth - el.clientWidth - 20;
            } else if (lastX < 20) {
              lastX = 0;
            }
    
            if (
              lastY >
              document.documentElement.clientWidth - el.clientWidth - 20
            ) {
              lastY =
                document.documentElement.clientHeight - el.clientHeight - 20;
            } else if (lastY < 20) {
              lastY = 0;
            }
    
            el.style.left = lastX + "px";
            el.style.top = lastY + "px";
            that.metadataStyle = {
              left: lastX + "px",
              top: lastY + "px"
            }
          };
          document.addEventListener('mousemove', handler, false);
          document.addEventListener(
            'mouseup',
            () => {
              document.body.style.cursor = 'default'
              document.removeEventListener('mousemove', handler);
            },
            false,
          );
          //
          document.onmouseup = function () {
            document.ontouchmove = null;
            //@ts-ignore
            document.releaseCapture && document.releaseCapture();
          };
          return false;
        }
      }
      //Observe changes for all relevant properties.
      @observe('showUnlabeled', 'showlabeled', 'showTesting', 'showVisError')
      _combinedShowCheckboxChanged() {
        // Check if 'showVisError' is checked without any other box checked
        if (this.showVisError && !(this.showUnlabeled || this.showTesting || this.showlabeled)) {
          this.showVisError = false;  // Uncheck 'showVisError'
          // Display your dialog warning
          this.highlightConfChange = false;
          (this.$.showVisWarning as any).open();
          return;
        }
    
      }
    
      @observe('showUnlabeled', 'showlabeled', 'showTesting', 'fixVisError')
      _combinedFixCheckboxChanged() {
        // Check if 'showVisError' is checked without any other box checked
        if (this.fixVisError && !(this.showUnlabeled || this.showTesting || this.showlabeled)) {
          this.fixVisError = false;  // Uncheck 'showVisError'
          // Display your dialog warning
          (this.$.showFixVisWarning as any).open();
          return;
        }
    
      }
    
      @observe('showUnlabeled', 'showlabeled', 'showTesting', 'highlightChange')
      _combinedHighlightChangeCheckboxChanged() {
        // Check if 'showVisError' is checked without any other box checked
        if (this.highlightChange && !(this.showUnlabeled || this.showTesting || this.showlabeled)) {
          this.highlightChange = false;  // Uncheck 'showVisError'
          // Display your dialog warning
          this.highlightConfChange = false;
          (this.$.showHighlightChangeWarning as any).open();
          return;
        }
    
      }
    
    
      @observe('highlightChange')
      _combinedshowVisHighlightChangeCheckboxChanged() {
        // Check if 'showVisError' is checked without any other box checked
        if (this.showVisError) {
          this.highlightChange = false;  // Uncheck 'showVisError'
          // Display your dialog warning
          this.highlightConfChange = false;
          (this.$.showHighlightChangeWarning as any).open();
          return;
        }
    
      }
      @observe('showVisError')
      _combinedHighlightChangeShowVisCheckboxChanged() {
        // Check if 'showVisError' is checked without any other box checked
        if (this.highlightChange) {
          this.showVisError = false;  // Uncheck 'showVisError'
          // Display your dialog warning
          this.highlightConfChange = false;
          (this.$.showVisWarning as any).open();
          return;
        }
      }
      // @observe('highlightVisError')
      // _combinedHighlightConfChangeShowVisCheckboxChanged() {
      //   // Check if 'showVisError' is checked without any other box checked
      //   if (this.highlightConfChange) {
      //       this.showVisError = false;  // Uncheck 'showVisError'
      //       // Display your dialog warning
      //       (this.$.showVisWarning as any).open();
      //       return;  
      //   }
      // }_
      // @observe('fixVisError')
      // _fixVisChanged() {
      //   var left = this.state.currentFocus[0]
      //   var right = this.state.currentFocus[1]
      //   var bottom = this.state.currentFocus[2]
      //   var top = this.state.currentFocus[3]
      //   var allPointsPositions = this.state.worldSpacePointPositions[getIteration(this.instanceId)]
      //   let currVisErrorIndices = getHighlightedPointIndices(this.instanceId)
      //   let lens = currVisErrorIndices.length
      //   let focusPointsIndices = Array.from({ length: 2000 });
      //   let currIndex = 0
      //   // only count the number of vis error points, if exceeds 2000, throws a warning
      //   for (let j = 0; j < lens; j++) {
      //     if (currIndex >= 2000) {
      //       this.fixVisError = false;
      //       (this.$.showExceedMaxWarning as any).open();
      //       return;
      //     }
      //     let start = currVisErrorIndices[j] * 3
      //     let posX = allPointsPositions[start]
      //     let posY = allPointsPositions[start + 1]
    
      //     if (posX >= left && posX <= right && posY >= bottom && posY <= top) {
      //       focusPointsIndices[currIndex] = currVisErrorIndices[j]
      //       currIndex += 1
      //     } 
      //   }
    
      //   this.projectionsPanel.projectDVI()
      //   // this allows data points positions to be updated on canvas
      //   queryCurrentFocus(focusPointsIndices) 
      // }
    
      @observe('showlabeled', 'showVisError')
      _labeledChanged() {
        this.highlightConfChange = false;
        let indicates = []
        if (getNowShowIndicates(this.instanceId)) {
          if (this.showlabeled) {
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              let indicate = getProperties(this.instanceId)[getIteration(this.instanceId)][i]
              if (indicate === 0 || getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
            // this.projector.filterDataset(getNowShowIndicates(this.instanceId))
          } else {
            ///隐藏labeled
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              if (getProperties(this.instanceId)[getIteration(this.instanceId)][i] !== 0 && getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
          }
          let highlightedPointIndices;
    
          if (this.showVisError) {
            highlightedPointIndices = getHighlightedPointIndices(this.instanceId)[this.iteration]
            highlightedPointIndices = highlightedPointIndices.filter(value => getNowShowIndicates(this.instanceId).includes(value))
            this.filterDataset(getNowShowIndicates(this.instanceId), false, highlightedPointIndices = highlightedPointIndices, undefined, undefined,undefined)
          } else {
            this.filterDataset(getNowShowIndicates(this.instanceId))
          }
        }
      }
    
    
      @observe('showUnlabeled', 'showVisError')
      _unLabelChanged() {
        this.highlightConfChange = false;
        let indicates = []
        if (getNowShowIndicates(this.instanceId)) {
          if (this.showUnlabeled) {
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              let indicate = getProperties(this.instanceId)[getIteration(this.instanceId)][i]
              if (indicate === 1 || getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
            // this.projector.filterDataset(getNowShowIndicates(this.instanceId))
          } else {
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              if (getProperties(this.instanceId)[getIteration(this.instanceId)][i] !== 1 && getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
          }
          let highlightedPointIndices;
          if (this.showVisError) {
            highlightedPointIndices = getHighlightedPointIndices(this.instanceId)[this.iteration]
            highlightedPointIndices = highlightedPointIndices.filter(value => getNowShowIndicates(this.instanceId).includes(value))
            this.filterDataset(getNowShowIndicates(this.instanceId), false, highlightedPointIndices = highlightedPointIndices, undefined, undefined, undefined)
          } else {
            this.filterDataset(getNowShowIndicates(this.instanceId))
          }
        }
      }
    
      @observe('showTesting', 'showVisError')
      _testingChanged() {
        this.highlightConfChange = false;
        let indicates = []
        if (getNowShowIndicates(this.instanceId)) {
          if (this.showTesting) {
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              let indicate = getProperties(this.instanceId)[getIteration(this.instanceId)][i]
              if (indicate === 2 || getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
            // this.projector.filterDataset(getNowShowIndicates(this.instanceId))
          } else {
    
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              if (getProperties(this.instanceId)[getIteration(this.instanceId)][i] !== 2 && getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
          }
          let highlightedPointIndices;
          if (this.showVisError) {
            highlightedPointIndices = getHighlightedPointIndices(this.instanceId)[this.iteration]
    
            highlightedPointIndices = highlightedPointIndices.filter(value => getNowShowIndicates(this.instanceId).includes(value))
    
            this.filterDataset(getNowShowIndicates(this.instanceId), false, highlightedPointIndices = highlightedPointIndices, undefined, undefined, undefined)
          } else {
            this.filterDataset(getNowShowIndicates(this.instanceId))
          }
        }
      }
    
    
      // @observe('showVisError')
      // _visErrorChanged() {
      //   let indicates = []
      //   if (getNowShowIndicates(this.instanceId)) {
      //     if (this.showVisError) {
      //       for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
      //         let indicate = getProperties(this.instanceId)[getIteration(this.instanceId)][i]
      //         if (indicate === 3 || getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
      //           indicates.push(i)
      //         }
      //       }
      //       getNowShowIndicates(this.instanceId) = indicates
      //       //this.projector.filterDataset(getNowShowIndicates(this.instanceId))
      //     } else {
    
      //       for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
      //         if (getProperties(this.instanceId)[getIteration(this.instanceId)][i] !== 3 && getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
      //           indicates.push(i)
      //         }
      //       }
      //       getNowShowIndicates(this.instanceId) = indicates
      //     }
      //     this.filterDataset(getNowShowIndicates(this.instanceId))
      //   }
      // }
    
    
      @observe('showlabeled', 'highlightChange')
      _predLabeledChanged() {
        this.highlightConfChange = false;
        let indicates = []
        if (getNowShowIndicates(this.instanceId)) {
          if (this.showlabeled) {
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              let indicate = getProperties(this.instanceId)[getIteration(this.instanceId)][i]
              if (indicate === 0 || getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
            // this.projector.filterDataset(getNowShowIndicates(this.instanceId))
          } else {
            ///隐藏labeled
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              if (getProperties(this.instanceId)[getIteration(this.instanceId)][i] !== 0 && getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
          }
          let predChangeIndices;
    
          if (this.highlightChange) {
            this.highlightCriticalChange()
            predChangeIndices = getPredChangeIndices(this.instanceId)
            predChangeIndices = predChangeIndices.filter(value => getNowShowIndicates(this.instanceId).includes(value))
            this.filterDataset(getNowShowIndicates(this.instanceId), false, undefined, predChangeIndices = predChangeIndices, undefined, undefined)
          } else {
            this.filterDataset(getNowShowIndicates(this.instanceId))
          }
        }
      }
    
      @observe('showUnlabeled', 'highlightChange')
      _predUnLabelChanged() {
        this.highlightConfChange = false;
        let indicates = []
        if (getNowShowIndicates(this.instanceId)) {
          if (this.showUnlabeled) {
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              let indicate = getProperties(this.instanceId)[getIteration(this.instanceId)][i]
              if (indicate === 1 || getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
            // this.projector.filterDataset(getNowShowIndicates(this.instanceId))
          } else {
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              if (getProperties(this.instanceId)[getIteration(this.instanceId)][i] !== 1 && getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
          }
          let predChangeIndices;
          if (this.highlightChange) {
            this.highlightCriticalChange()
            predChangeIndices = getPredChangeIndices(this.instanceId)
            predChangeIndices = predChangeIndices.filter(value => getNowShowIndicates(this.instanceId).includes(value))
            this.filterDataset(getNowShowIndicates(this.instanceId), false, undefined, predChangeIndices = predChangeIndices, undefined, undefined)
          } else {
            this.filterDataset(getNowShowIndicates(this.instanceId))
          }
        }
      }
    
     


      @observe('showTesting', 'highlightChange')
      _predTestingChanged() {
        this.highlightConfChange = false;
        let indicates = []
        if (getNowShowIndicates(this.instanceId)) {
          if (this.showTesting) {
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              let indicate = getProperties(this.instanceId)[getIteration(this.instanceId)][i]
              if (indicate === 2 || getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
            // this.projector.filterDataset(getNowShowIndicates(this.instanceId))
          } else {
    
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              if (getProperties(this.instanceId)[getIteration(this.instanceId)][i] !== 2 && getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
          }
          let predChangeIndices;
          if (this.highlightChange) {
            this.highlightCriticalChange()
            predChangeIndices = getPredChangeIndices(this.instanceId)
    
            predChangeIndices = predChangeIndices.filter(value => getNowShowIndicates(this.instanceId).includes(value))
    
            this.filterDataset(getNowShowIndicates(this.instanceId), false, undefined, predChangeIndices = predChangeIndices, undefined, undefined)
          } else {
            this.filterDataset(getNowShowIndicates(this.instanceId))
          }
        }
      }
    

      @observe('showlabeled', 'contraVisHighlightIndices')
      _contraVisLabeledChanged() {
        // this.highlightConfChange = false;
        let indicates = []
        if (getNowShowIndicates(this.instanceId)) {
          if (this.showlabeled) {
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              let indicate = getProperties(this.instanceId)[getIteration(this.instanceId)][i]
              if (indicate === 0 || getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
            // this.projector.filterDataset(getNowShowIndicates(this.instanceId))
          } else {
            ///隐藏labeled
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              if (getProperties(this.instanceId)[getIteration(this.instanceId)][i] !== 0 && getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
          }
          let predChangeIndices;
       
          if (this.contraVisHighlightIndices.length !== 0) {
            updateStateForInstance(this.instanceId, {contraVisHighlightIndices:this.contraVisHighlightIndices})
            predChangeIndices = getcontraVisHighlightIndices(this.instanceId)
            predChangeIndices = predChangeIndices.filter(value => getNowShowIndicates(this.instanceId).includes(value))
         
            this.filterDataset(getNowShowIndicates(this.instanceId), false, undefined, undefined, undefined, this.contraVisHighlightIndices)
          } else {
            this.filterDataset(getNowShowIndicates(this.instanceId))
          }
        }
      }
    
      @observe('showUnlabeled', 'contraVisHighlightIndices')
      _contraVisUnLabelChanged() {
        // this.highlightConfChange = false;

        let indicates = []
        if (getNowShowIndicates(this.instanceId)) {
          if (this.showUnlabeled) {
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              let indicate = getProperties(this.instanceId)[getIteration(this.instanceId)][i]
              if (indicate === 1 || getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
            // this.projector.filterDataset(getNowShowIndicates(this.instanceId))
          } else {
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              if (getProperties(this.instanceId)[getIteration(this.instanceId)][i] !== 1 && getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
          }
          let predChangeIndices;
          console.log("aaaaaaaaaaaa", this.contraVisHighlightIndices.length)
          if (getcontraVisHighlightIndices(this.instanceId).length !== 0) {
            updateStateForInstance(this.instanceId, {contraVisHighlightIndices:this.contraVisHighlightIndices})
            predChangeIndices = getcontraVisHighlightIndices(this.instanceId)
            predChangeIndices = predChangeIndices.filter(value => getNowShowIndicates(this.instanceId).includes(value))
            this.filterDataset(getNowShowIndicates(this.instanceId), false, undefined, undefined,undefined, this.contraVisHighlightIndices)
          } else {
            this.filterDataset(getNowShowIndicates(this.instanceId))
          }
        }
      }
    
     


      @observe('showTesting', 'contraVisHighlightIndices')
      _contraVisTestingChanged() {
        // this.highlightConfChange = false;
        let indicates = []
        if (getNowShowIndicates(this.instanceId)) {
          if (this.showTesting) {
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              let indicate = getProperties(this.instanceId)[getIteration(this.instanceId)][i]
              if (indicate === 2 || getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
            // this.projector.filterDataset(getNowShowIndicates(this.instanceId))
          } else {
    
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              if (getProperties(this.instanceId)[getIteration(this.instanceId)][i] !== 2 && getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
          }
          console.log("aaaaaaaaaaaa", this.contraVisHighlightIndices.length)
          let predChangeIndices;
          if (this.contraVisHighlightIndices.length !== 0) {
            updateStateForInstance(this.instanceId, {contraVisHighlightIndices:this.contraVisHighlightIndices})
            predChangeIndices = getcontraVisHighlightIndices(this.instanceId)
    
            predChangeIndices = predChangeIndices.filter(value => getNowShowIndicates(this.instanceId).includes(value))
    
            this.filterDataset(getNowShowIndicates(this.instanceId), false, undefined, undefined, undefined, this.contraVisHighlightIndices)
          } else {
            this.filterDataset(getNowShowIndicates(this.instanceId))
          }
        }
      }
    
      // @observe('highlightChange')
      // _predChanged() {
      //   let indicates = []
      //   if (getNowShowIndicates(this.instanceId)) {
      //     if (this.showVisError) {
      //       for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
      //         let indicate = getProperties(this.instanceId)[getIteration(this.instanceId)][i]
      //         if (indicate === 3 || getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
      //           indicates.push(i)
      //         }
      //       }
      //       getNowShowIndicates(this.instanceId) = indicates
      //       //this.projector.filterDataset(getNowShowIndicates(this.instanceId))
      //     } else {
    
      //       for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
      //         if (getProperties(this.instanceId)[getIteration(this.instanceId)][i] !== 3 && getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
      //           indicates.push(i)
      //         }
      //       }
      //       getNowShowIndicates(this.instanceId) = indicates
      //     }
      //     this.filterDataset(getNowShowIndicates(this.instanceId))
      //   }
      // }
    
      onIterationChange(num: number) {
        updateSessionStateForInstance(this.instanceId, {iteration:String(num)})
        // updateStateForInstance(this.instanceId, {iteration:num})
        // getIteration(this.instanceId) = String(num)
        
        // window.sessionStorage.setItem('iteration', String(num))
        // window.iteration = num;
        let indicates = []
        this.iteration = num;
        if (!getIsAnimating(this.instanceId)) {
          if (this.showTesting === false) {
            for (let i = 0; i < getProperties(this.instanceId)[getIteration(this.instanceId)].length; i++) {
              if (getProperties(this.instanceId)[getIteration(this.instanceId)][i] !== 2 && getNowShowIndicates(this.instanceId).indexOf(i) !== -1) {
                indicates.push(i)
              }
            }
            updateStateForInstance(this.instanceId, { nowShowIndicates: indicates })
            // getNowShowIndicates(this.instanceId) = indicates
          }
          this.filterDataset(getNowShowIndicates(this.instanceId))
    
        }
        if (this.inspectorPanel) {
          if (window.sessionStorage.taskType === 'active learning' && getIteration(this.instanceId) !== 1) {
            this.inspectorPanel.updateDisabledStatues(true)
          } else {
            this.inspectorPanel.updateDisabledStatues(false)
          }
    
        }
        this.initialTree()
      }
    

    
      setSelectedLabelOption(labelOption: string) {
        this.selectedLabelOption = labelOption;
        this.metadataCard.setLabelOption(this.selectedLabelOption);
        this.projectorScatterPlotAdapter.setLabelPointAccessor(labelOption);
        this.projectorScatterPlotAdapter.updateScatterPlotAttributes();
        this.projectorScatterPlotAdapter.render();
      }
      setSelectedColorOption(colorOption: ColorOption) {
        this.selectedColorOption = colorOption;
        this.projectorScatterPlotAdapter.setLegendPointColorer(
          this.getLegendPointColorer(colorOption)
        );
        this.projectorScatterPlotAdapter.updateScatterPlotAttributes();
        this.projectorScatterPlotAdapter.render();
      }
      setNormalizeData(normalizeData: boolean) {
        this.normalizeData = normalizeData;
        this.setCurrentDataSet(this.originalDataSet.getSubset());
      }
      updateDataSet(
        ds: DataSet,
        spriteAndMetadata?: SpriteAndMetadataInfo,
        metadataFile?: string
      ) {
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
          } else {
            this.projectorScatterPlotAdapter.updateScatterPlotPositions();
            this.projectorScatterPlotAdapter.updateScatterPlotAttributes();
            this.projectorScatterPlotAdapter.resize();
            this.projectorScatterPlotAdapter.render();
          }
        }
        if (ds != null) {
          this.dataPanel.setNormalizeData(this.normalizeData);
          this.setCurrentDataSet(ds.getSubset());
          this.projectorScatterPlotAdapter.setLabelPointAccessor(
            this.selectedLabelOption
          );
          this.inspectorPanel.datasetChanged();
          this.inspectorPanel.metadataChanged(spriteAndMetadata);
          this.projectionsPanel.metadataChanged(spriteAndMetadata);
          this.dataPanel.metadataChanged(spriteAndMetadata, metadataFile);
          //reset
          if (getIteration(this.instanceId)) {
            this.projectionsPanel.jumpTo(Number(getIteration(this.instanceId)))
          } else {
            this.projectionsPanel.jumpTo(Number(1))
          }
          //RECALL
          //reset
         //reset
      if (getCurrentSessionState(this.instanceId).acceptIndicates) {
        // console.log("go fuck you")
        // console.log("yourmom",getAcceptIndicates(this.instanceId))
        updateStateForInstance(this.instanceId, { acceptIndicates: getCurrentSessionState(this.instanceId).acceptIndicates.split(",").map(parseFloat) })
     
        // getAcceptIndicates(this.instanceId) = getAcceptIndicates(this.instanceId).split(",").map(parseFloat)
      }
      if (getCurrentSessionState(this.instanceId).rejectIndicates) {
        updateStateForInstance(this.instanceId, { rejectIndicates: getCurrentSessionState(this.instanceId).rejectIndicates.split(",").map(parseFloat) })
        // getRejectIndicates(this.instanceId) = getRejectIndicates(this.instanceId).split(",").map(parseFloat)
      }
      if (getCurrentSessionState(this.instanceId).customSelection) {
        updateStateForInstance(this.instanceId, { customSelection: getCurrentSessionState(this.instanceId).customSelection.split(",").map(parseFloat) })
        // getCustomSelection(this.instanceId) = getCustomSelection(this.instanceId).split(",").map(parseFloat)
      }
        } else {
          this.setCurrentDataSet(null);
          // this.projectorScatterPlotAdapter
        }
      }
      metadataEdit(metadataColumn: string, metadataLabel: string) {
        this.selectedPointIndices.forEach(
          (i) => (this.dataSet.points[i].metadata[metadataColumn] = metadataLabel)
        );
        this.neighborsOfFirstPoint.forEach(
          (p) =>
            (this.dataSet.points[p.index].metadata[metadataColumn] = metadataLabel)
        );
        this.dataSet.spriteAndMetadataInfo.stats = analyzeMetadata(
          this.dataSet.spriteAndMetadataInfo.stats.map((s) => s.name),
          this.dataSet.points.map((p) => p.metadata)
        );
        this.metadataChanged(this.dataSet.spriteAndMetadataInfo);
        this.metadataEditorContext(true, metadataColumn);
      }
      metadataChanged(
        spriteAndMetadata: SpriteAndMetadataInfo,
        metadataFile?: string
      ) {
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
            this.dataSet.points[this.selectedPointIndices[0]].metadata
          );
        } else {
          // no points selected
          this.metadataCard.updateMetadata(null); // clear metadata
        }
        this.setSelectedLabelOption(this.selectedLabelOption);
      }
      metadataEditorContext(enabled: boolean, metadataColumn: string) {
        if (this.inspectorPanel) {
          this.inspectorPanel.metadataEditorContext(enabled, metadataColumn);
        }
      }
      setSelectedTensor(run: string, tensorInfo: EmbeddingInfo) {
        this.bookmarkPanel.setSelectedTensor(run, tensorInfo, this.dataProvider);
      }
      updateBackgroundImg() {
        this.projectorScatterPlotAdapter.updateBackground()
      }
      /**
       * Registers a listener to be called any time the selected point set changes.
       */
      registerSelectionChangedListener(listener: SelectionChangedListener) {
        this.selectionChangedListeners.push(listener);
      }
      filterDataset(pointIndices: number[], filter?: boolean, highlightedPointIndices?: number[], predChangeIndices?: number[], confChangeIndices?: number[],contraVisHighlightIndices?:number[]) {
        const selectionSize = this.selectedPointIndices.length;
        /*
        if (this.dataSetBeforeFilter == null) {
          this.dataSetBeforeFilter = this.dataSet;
        }*/
        //console.log('now',pointIndices.length,this.dataSet)
    
        this.dataSet.setDVIFilteredData(pointIndices);
        // this.setCurrentDataSet(this.dataSet.getSubset(pointIndices));
        this.dataSetFilterIndices = pointIndices;
        this.projectorScatterPlotAdapter.updateScatterPlotPositions();
        // console.log( predChangeIndices);
        // console.log(highlightedPointIndices)
        this.projectorScatterPlotAdapter.updateScatterPlotAttributes(filter, highlightedPointIndices, predChangeIndices, confChangeIndices, contraVisHighlightIndices);
        // this.projectorScatterPlotAdapter.updateBackground()
    
        this.projectorScatterPlotAdapter.render()
        // this.adjustSelectionAndHover(util.range(selectionSize));
    
        if (getIsAdjustingSel(this.instanceId)) {
          // this.boundingSelectionBtn.classList.add('actived')
          this.setMouseMode(MouseMode.AREA_SELECT)
        }
      }
      resetFilterDataset(num?) {
        const originalPointIndices = this.selectedPointIndices.map(
          (filteredIndex) => this.dataSet.points[filteredIndex].index
        );
    
        /*
        this.setCurrentDataSet(this.dataSetBeforeFilter);
        if (this.projection != null) {
          this.projection.dataSet = this.dataSetBeforeFilter;
        }
        this.dataSetBeforeFilter = null;*/
        // setDVIfilter all data
        let total = this.dataSet.DVIValidPointNumber[this.dataSet.tSNEIteration]
        if (num) {
          total = num
        }
    
        var indices: number[];
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
        // this.setDynamicStop()
        if (!getCustomSelection(this.instanceId)) {
          updateStateForInstance(this.instanceId, { customSelection: [] })
          // getCustomSelection(this.instanceId) = []
        }
        if (!getQueryResAnormalCleanIndecates(this.instanceId)) {
          updateStateForInstance(this.instanceId, { queryResAnormalCleanIndecates: [] })
          // getQueryResAnormalCleanIndecates(this.instanceId) = []
        }
        let indecates = getQueryResAnormalCleanIndecates(this.instanceId).concat(getCustomSelection(this.instanceId))
        if (indecates && indecates.length) {
          this.filterDataset(indecates)
        }
        // this.filterDataset(this.selectedPointIndices)
        this.currentIteration = getIteration(this.instanceId)
    
        let current = 1
        let positions = getAllResPositions(this.instanceId)?.results
        let interationList = []
        if (getAllResPositions(this.instanceId) && getAllResPositions(this.instanceId).bgimgList) {
          updateStateForInstance(this.instanceId, { sceneBackgroundImg: getAllResPositions(this.instanceId)?.bgimgList })
          // getSceneBackgroundImg(this.instanceId) = getAllResPositions(this.instanceId)?.bgimgList
        }
        for (let key of Object.keys(getAllResPositions(this.instanceId)?.results)) {
          interationList.push(Number(key))
        }
        current = Number(interationList[0])
        let count = 0
        if (this.intervalFlag) {
          this.intervalFlag = false
          this.timer = window.setInterval(() => {
    
            this.inspectorPanel.updateCurrentPlayEpoch(current)
            updateStateForInstance(this.instanceId, { iteration: current })
            // getIteration(this.instanceId) = current;
            let length = this.dataSet.points.length
            if (length === 60002) {
              let point1 = this.dataSet.points[length - 2];
              let point2 = this.dataSet.points[length - 1];
              point1.projections['tsne-0'] = getAllResPositions(this.instanceId).grid[current][0]
              point1.projections['tsne-1'] = getAllResPositions(this.instanceId).grid[current][1]
              point2.projections['tsne-0'] = getAllResPositions(this.instanceId).grid[current][2]
              point2.projections['tsne-1'] = getAllResPositions(this.instanceId).grid[current][3]
              // point.projections['tsne-0'] = 
            }
    
            for (let i = 0; i < this.dataSet.points.length; i++) {
              const point = this.dataSet.points[i];
              if (!getCustomSelection(this.instanceId) || !getCustomSelection(this.instanceId).length || getCustomSelection(this.instanceId).indexOf(i) !== -1 || getQueryResAnormalCleanIndecates(this.instanceId)?.indexOf(i) !== -1) {
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
            this.projectorScatterPlotAdapter.render()
            if (count == interationList.length - 1) {
              this.inspectorPanel.playAnimationFinished()
              this.setDynamicStop()
              current = interationList[0]
              count = 0
    
            } else {
              current = interationList[++count]
            }
          }, 1200)
        }
    
      }
    
      updatePosByIndicates(current: number) {
        let positions = getAllResPositions(this.instanceId)?.results
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
        updateStateForInstance(this.instanceId, { isAnimatating: false })
        // getIsAnimating(this.instanceId) = false
        if (this.timer && !this.intervalFlag) {
          window.clearInterval(this.timer)
          this.intervalFlag = true
          this.resetFilterDataset()
        }
        let end = setInterval(function () { }, 10000);
        for (let i = 1; i <= end; i++) {
          clearInterval(i);
        }
    
        this.iteration = this.currentIteration
        let length = this.dataSet.points.length
        if (length === 60002) {
          let point1 = this.dataSet.points[length - 2];
          let point2 = this.dataSet.points[length - 1];
          point1.projections['tsne-0'] = getAllResPositions(this.instanceId).grid[this.iteration][0]
          point1.projections['tsne-1'] = getAllResPositions(this.instanceId).grid[this.iteration][1]
          point2.projections['tsne-0'] = getAllResPositions(this.instanceId).grid[this.iteration][2]
          point2.projections['tsne-1'] = getAllResPositions(this.instanceId).grid[this.iteration][3]
          // point.projections['tsne-0'] = 
        }
        updateStateForInstance(this.instanceId, { iteration: this.currentIteration })
        // getIteration(this.instanceId) = this.currentIteration
        this.updatePosByIndicates(getIteration(this.instanceId))
      }
    
      renderInTraceLine(inTrace: boolean) {
        this.projectorScatterPlotAdapter.setRenderInTraceLine(inTrace)
      }
    
      refresh() {
        // this.projectorScatterPlotAdapter.scatterPlot.render()
        this.metadataCard.updateCustomList(this.dataSet.points, this as ProjectorEventContext)
        this.metadataCard.updateRejectList(this.dataSet.points, this as ProjectorEventContext)
        // this.projectorScatterPlotAdapter.scatterPlot.render()
        this.projectorScatterPlotAdapter.updateScatterPlotAttributes()
        this.projectorScatterPlotAdapter.render()
      }
      removecustomInMetaCard() {
        this.metadataCard.updateCustomList(this.dataSet.points, this as ProjectorEventContext)
        this.metadataCard.updateRejectList(this.dataSet.points, this as ProjectorEventContext)
        // this.inspectorPanel.refreshSearchResult()
        this.inspectorPanel.updateSessionStorage()
        this.projectorScatterPlotAdapter.updateScatterPlotAttributes()
        this.projectorScatterPlotAdapter.render()
      }
      /**
       * Used by clients to indicate that a selection has occurred.
       */
      async notifySelectionChanged(newSelectedPointIndices: number[], selectMode?: boolean, selectionType?: string) {
        console.log('notifySelectionChanged', selectionType, newSelectedPointIndices)
        if (!this.registered) {
          this.readyregis()
        }
        if (!getAcceptIndicates(this.instanceId)) {
          updateStateForInstance(this.instanceId, { acceptIndicates: [] })
          // getAcceptIndicates(this.instanceId) = []
        }
        if (!getRejectIndicates(this.instanceId)) {
          updateStateForInstance(this.instanceId, { rejectIndicates: [] })
          // getRejectIndicates(this.instanceId) = []
        }
        updateStateForInstance(this.instanceId, { customSelection: getAcceptIndicates(this.instanceId).concat(getRejectIndicates(this.instanceId)) })
        // getCustomSelection(this.instanceId) = getAcceptIndicates(this.instanceId).concat(getRejectIndicates(this.instanceId))
        if (selectionType === 'isALQuery' || selectionType === 'normal' || selectionType === 'isAnormalyQuery' || selectionType === 'boundingbox') {
          // getCustomSelection(this.instanceId) = []
          updateStateForInstance(this.instanceId, { queryResPointIndices: newSelectedPointIndices })
          // getQueryResPointIndices(this.instanceId) = newSelectedPointIndices
          if (selectionType === 'isALQuery') {
            updateStateForInstance(this.instanceId, { alQueryResPointIndices: newSelectedPointIndices })
            // this.state.alQueryResPointIndices = newSelectedPointIndices
          } else {
            updateStateForInstance(this.instanceId, { alQueryResPointIndices: [] })
            // this.state.alQueryResPointIndices = []
          }
        }
        if (selectionType === 'isShowSelected') {
          for (let i = 0; i < getPreviousIndecates(this.instanceId)?.length; i++) {
            // if(getCustomSelection(this.instanceId).indexOf(this.state.previousIndecates[i]) === -1){
            let index = getPreviousIndecates(this.instanceId)[i]
            if (getCheckBoxDom(this.instanceId)[index]) {
              console.log("333333")
              // Update the customSelection array in the state
              // Clone the checkboxDom array to avoid direct mutation
              const newCheckboxDom = getCheckBoxDom(this.instanceId);
    
              // Modify the specific checkbox's checked property
              if (newCheckboxDom[index]) {
                console.log("exist")
                getCheckBoxDom(this.instanceId)[index].checked = true;
              }
    
              // Update the state with the modified checkboxDom
              updateStateForInstance(this.instanceId, { checkboxDom: newCheckboxDom });
              // getCheckBoxDom(this.instanceId)[index].checked = true
            }
            // }
          }
          this.metadataCard.updateCustomList(this.dataSet.points, this as ProjectorEventContext)
          this.metadataCard.updateRejectList(this.dataSet.points, this as ProjectorEventContext)
          this.projectorScatterPlotAdapter.updateScatterPlotAttributes()
          this.projectorScatterPlotAdapter.render()
          return
        }
        if (selectionType === 'boundingbox') {
          let headers = new Headers();
          headers.append('Content-Type', 'application/json');
          headers.append('Accept', 'application/json');
    
          await fetch(`http://${this.DVIServer}/boundingbox_record`, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify({
              "username": window.sessionStorage.username,
            }),
            headers: headers,
          }).then(() => {
            console.log('123323')
          })
          updateStateForInstance(this.instanceId, { alSuggestLabelList: [] })
          updateStateForInstance(this.instanceId, { alSuggestScoreList: [] })
          // this.state.alSuggestLabelList = []
          // this.state.alSuggestScoreList = []
         updateStateForInstance(this.instanceId, {queryResPointIndices:newSelectedPointIndices})
          this.selectedPointIndices = newSelectedPointIndices
          updateStateForInstance(this.instanceId, { alQueryResPointIndices: [] })
          // this.state.alQueryResPointIndices = []
          this.inspectorPanel.refreshSearchResByList(newSelectedPointIndices)
          this.projectorScatterPlotAdapter.updateScatterPlotAttributes()
          this.projectorScatterPlotAdapter.render()
          this.selectionChangedListeners.forEach((l) =>
            l(this.selectedPointIndices, [])
          );
          return
        }
    
        let neighbors: knn.NearestEntry[] = [];
        if (
          this.editMode && // point selection toggle in existing selection
          newSelectedPointIndices.length > 0
        ) {
          // selection required
          if (this.selectedPointIndices.length === 1) {
            // main point with neighbors
            let main_point_vector = this.dataSet.points[
              this.selectedPointIndices[0]
            ].vector;
            neighbors = this.neighborsOfFirstPoint.filter(
              (
                n // deselect
              ) => newSelectedPointIndices.filter((p) => p == n.index).length == 0
            );
            newSelectedPointIndices.forEach((p) => {
              // add additional neighbors
              if (
                p != this.selectedPointIndices[0] && // not main point
                this.neighborsOfFirstPoint.filter((n) => n.index == p).length == 0
              ) {
                let p_vector = this.dataSet.points[p].vector;
                let n_dist = this.inspectorPanel.distFunc(
                  main_point_vector,
                  p_vector
                );
                let pos = 0; // insertion position into dist ordered neighbors
                while (
                  pos < neighbors.length &&
                  neighbors[pos].dist < n_dist // find pos
                )
                  pos = pos + 1; // move up the sorted neighbors list according to dist
                neighbors.splice(pos, 0, { index: p, dist: n_dist }); // add new neighbor
              }
            });
          } else {
            // multiple selections
            let updatedSelectedPointIndices = this.selectedPointIndices.filter(
              (n) => newSelectedPointIndices.filter((p) => p == n).length == 0
            ); // deselect
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
                this.dataSet.points[this.selectedPointIndices[0]].metadata
              );
            } else {
              // no points selected
              this.metadataCard.updateMetadata(null); // clear metadata
            }
          }
        } else if (selectMode == true) {
          // for bounding box selection
          // multiple selections
          let updatedSelectedPointIndices = this.selectedPointIndices.filter(
            (n) => newSelectedPointIndices.filter((p) => p == n).length == 0
          ); // deselect
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
                this.dataSet.points[this.selectedPointIndices[0]].metadata
              );
            } else {
              this.metadataCard.updateMetadata(null);
            }
          } else {
            // no points selected
            this.metadataCard.updateMetadata(null); // clear metadata
          }
          this.inspectorPanel.updateBoundingBoxSelection(newSelectedPointIndices);
        } else {
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
    
          } else {
            this.metadataCard.updateMetadata(null);
          }
        }
        this.selectionChangedListeners.forEach((l) =>
          l(this.selectedPointIndices, neighbors)
        );
      }
      updateMetaDataByIndices(indices: number, src: string) {
        if (indices === -1) {
          this.metadataCard.updateMetadata(null);
          return
        }
        this.metadataCard.updateMetadata(
          this.dataSet.points[indices].metadata, src, this.dataSet.points[indices]
        );
      }
    
      updateMetaByIndices(indices: number) {
        if (indices === -1) {
          this.metadataCard.updateMetadata(null);
          return
        }
        this.dataSet.getSpriteImage(indices, (imgData: any) => {
          let src = imgData.imgUrl
          this.metadataCard.updateMetadata(
            this.dataSet.points[indices].metadata, src, this.dataSet.points[indices], indices
          );
        })
      }
      /**
       * Registers a listener to be called any time the mouse hovers over a point.
       */
      registerHoverListener(listener: HoverListener) {
        this.hoverListeners.push(listener);
      }
      /**
       * Used by clients to indicate that a hover is occurring.
       */
      private timer = null
      notifyHoverOverPoint(pointIndex: number) {
        let highlightedPointIndices;
        let predChangeIndices;
        let confChangeIndices;
        let contraVisHighlightIndices;
        if (getHighlightedPointIndices(this.instanceId) && getHighlightedPointIndices(this.instanceId)[this.iteration] && this.showVisError) {
          highlightedPointIndices = getHighlightedPointIndices(this.instanceId)[this.iteration].filter(value => getNowShowIndicates(this.instanceId).includes(value))
    
        }
    
        else if (getPredChangeIndices(this.instanceId) && this.highlightChange) {
          predChangeIndices = getPredChangeIndices(this.instanceId).filter(value => getNowShowIndicates(this.instanceId).includes(value))
        }
    
        else if (getConfChangeIndices(this.instanceId) && this.highlightConfChange) {
          confChangeIndices = getConfChangeIndices(this.instanceId).filter(value => getNowShowIndicates(this.instanceId).includes(value))
        }
        else if (getcontraVisHighlightIndices(this.instanceId)) {
          contraVisHighlightIndices = getcontraVisHighlightIndices(this.instanceId).filter(value => getNowShowIndicates(this.instanceId).includes(value))
        }
        // console.log(highlightedPointIndices)
        // console.log(predChangeIndices)
        this.hoverListeners.forEach((l) => l(pointIndex, highlightedPointIndices, predChangeIndices, confChangeIndices, contraVisHighlightIndices));
    
        let timeNow = new Date().getTime()
        if (this.timer === null || timeNow - this.timer > 10) {
          if (getIteration(this.instanceId) && pointIndex !== undefined && pointIndex !== null && getPreviousHover(this.instanceId) !== pointIndex) {
            this.timer = timeNow
            this.updateMetaByIndices(pointIndex)
            updateStateForInstance(this.instanceId, { previousHover: pointIndex })
            // getPreviousHover(this.instanceId) = pointIndex
          }
        }
      }
      registerProjectionChangedListener(listener: ProjectionChangedListener) {
        this.projectionChangedListeners.push(listener);
      }
      notifyProjectionChanged(projection: Projection) {
        this.projectionChangedListeners.forEach((l) => l(projection));
      }
      registerDistanceMetricChangedListener(l: DistanceMetricChangedListener) {
        this.distanceMetricChangedListeners.push(l);
      }
      notifyDistanceMetricChanged(distMetric: DistanceFunction) {
        this.distanceMetricChangedListeners.forEach((l) => l(distMetric));
      }
    
      @observe('dataProto')
      _dataProtoChanged(dataProtoString: string) {
        let dataProto = dataProtoString
          ? (JSON.parse(dataProtoString) as DataProto)
          : null;
        this.initializeDataProvider(dataProto);
      }
      private makeDefaultPointsInfoAndStats(
        points: DataPoint[]
      ): [PointMetadata[], ColumnStats[]] {
        let pointsInfo: PointMetadata[] = [];
        points.forEach((p) => {
          let pointInfo: PointMetadata = {};
          pointInfo[INDEX_METADATA_FIELD] = p.index;
          pointsInfo.push(pointInfo);
        });
        let stats: ColumnStats[] = [
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
      private initializeDataProvider(dataProto?: DataProto) {
        console.log("initializeDataProvider")
        if (this.servingMode === 'demo') {
          let projectorConfigUrl: string;
          // Only in demo mode do we allow the config being passed via URL.
          let urlParams = util.getURLParams(initialURLQueryString);
          if ('config' in urlParams) {
            projectorConfigUrl = urlParams['config'];
          } else {
            projectorConfigUrl = this.projectorConfigJsonPath;
          }

          this.dataProvider = new DemoDataProvider(projectorConfigUrl, this.instanceId);
          
        } else if (this.servingMode === 'server') {
          if (!this.routePrefix) {
            throw 'route-prefix is a required parameter';
          }
          this.dataProvider = new ServerDataProvider(this.routePrefix, this.instanceId);
        } else if (this.servingMode === 'proto' && dataProto != null) {
       
          this.dataProvider = new ProtoDataProvider(dataProto, this.instanceId);
        } else {
          // The component is not ready yet - waiting for the dataProto field.
          return;
        }
        this.dataPanel.initialize(this, this.dataProvider, this.instanceId);
      }
      private getLegendPointColorer(
        colorOption: ColorOption
      ): (ds: DataSet, index: number) => string {
        if (colorOption == null || colorOption.map == null) {
          return null;
        }
        const colorer = (ds: DataSet, i: number) => {
          let value = ds.points[i].metadata[this.selectedColorOption.name];
          if (value == null) {
            return POINT_COLOR_MISSING;
          }
          return ds.points[i].color;
          //return colorOption.map(value);
        };
        return colorer;
      }
      private get3DLabelModeButton(): any {
        return this.$$('#labels3DMode');
      }
      private get3DLabelMode(): boolean {
        const label3DModeButton = this.get3DLabelModeButton();
        return (label3DModeButton as any).active;
      }
      adjustSelectionAndHover(selectedPointIndices: number[], hoverIndex?: number) {
        this.notifySelectionChanged(selectedPointIndices);
        this.notifyHoverOverPoint(hoverIndex);
        this.setMouseMode(MouseMode.CAMERA_AND_CLICK_SELECT);
      }
      setMouseMode(mouseMode: MouseMode) {
        let selectModeButton = this.$$('#selectMode');
        (selectModeButton as any).active = mouseMode === MouseMode.AREA_SELECT;
        this.projectorScatterPlotAdapter.scatterPlot.setMouseMode(mouseMode);
      }
      private setCurrentDataSet(ds: DataSet) {
        this.adjustSelectionAndHover([]);
        if (this.dataSet != null) {
          this.dataSet.stopTSNE();
        }
        if (ds != null && this.normalizeData) {
          ds.normalize();
        }
        this.dim = ds == null ? 0 : ds.dim[1];
        (this.$$('span.numDataPoints') as HTMLSpanElement).innerText =
          ds == null ? '0' : '' + ds.dim[0];
        (this.$$('span.dim') as HTMLSpanElement).innerText =
          ds == null ? '0' : '' + ds.dim[1];
        this.dataSet = ds;
        this.projectionsPanel.dataSetUpdated(
          this.dataSet,
          this.originalDataSet,
          this.dim
        );
        this.projectorScatterPlotAdapter.setDataSet(this.dataSet);
        this.projectorScatterPlotAdapter.scatterPlot.setCameraParametersForNextCameraCreation(
          null,
          true
        );
      }
      private setupUIControls() {
    
        {
          this.projectorScatterPlotAdapter = new ProjectorScatterPlotAdapter(
            this.getScatterContainer("left"),
            this as ProjectorEventContext,
            this.instanceId
          );
    
          this.projectorScatterPlotAdapter.setLabelPointAccessor(
            this.selectedLabelOption
          );
        }
    
        // View controls
        this.helpBtn.addEventListener('click', () => {
          (this.$.help3dDialog as any).open();
        })
        this.$$('#reset-zoom').addEventListener('click', () => {
          this.projectorScatterPlotAdapter.scatterPlot.resetZoom();
          this.projectorScatterPlotAdapter.scatterPlot.startOrbitAnimation();
        });
        let selectModeButton = this.$$('#selectMode');
        selectModeButton.addEventListener('click', (event) => {
          this.setMouseMode(
            (selectModeButton as any).active
              ? MouseMode.AREA_SELECT
              : MouseMode.CAMERA_AND_CLICK_SELECT
          );
        });
        let nightModeButton = this.$$('#nightDayMode');
        nightModeButton.addEventListener('click', () => {
          this.projectorScatterPlotAdapter.scatterPlot.setDayNightMode(
            (nightModeButton as any).active
          );
        });
        let hiddenBackground = this.$$('#hiddenBackground');
        hiddenBackground.addEventListener('click', () => {
          updateStateForInstance(this.instanceId, { hiddenBackground: (hiddenBackground as any).active })
          // getHiddenBackground(this.instanceId) = (hiddenBackground as any).active
          for (let i = 0; i < this.dataSet.points.length; i++) {
            const point = this.dataSet.points[i];
            if (point.metadata[this.selectedLabelOption]) {
              let hoverText = point.metadata[this.selectedLabelOption].toString();
              if (hoverText == 'background') {
                if ((hiddenBackground as any).active) {
                  // getScene(this.instanceId).remove(this.state.backgroundMesh)
                  point.color = '#ffffff'
                } else {
                  point.color = point.DVI_color[1]
                  // getScene(this.instanceId).add(this.state.backgroundMesh)
                }
              }
            }
          }
          // Clone the scene object
          const newScene = getScene(this.instanceId) ;
    
          // Check and update the 'visible' property for specific children
          if (newScene.children && newScene.children[2] && newScene.children[2].type === 'Mesh') {
            newScene.children = newScene.children.map((child, index) => {
              if (index >= 2) {
                return {
                  ...child,
                  visible: !getHiddenBackground(this.instanceId)
                };
              }
              return child;
            });
          }
    
          // Update the state with the modified scene
          updateStateForInstance(this.instanceId, { scene: newScene });
    
          
          // // if(getScene(this.instanceId).children)
          // if (getScene(this.instanceId).children[2] && getScene(this.instanceId).children[2].type === 'Mesh') {
          //   for (let i = 2; i < getScene(this.instanceId).children.length; i++) {
    
          //     getScene(this.instanceId).children[i].visible = !getHiddenBackground(this.instanceId)
          //   }
    
          // }
          this.projectorScatterPlotAdapter.scatterPlot.render()
          // this.projectorScatterPlotAdapter.scatterPlot.hiddenBackground(
          //   (hiddenBackground as any).active,
          // );
        })
    
        let editModeButton = this.$$('#editMode');
        editModeButton.addEventListener('click', (event) => {
          this.editMode = (editModeButton as any).active;
        });
        const labels3DModeButton = this.get3DLabelModeButton();
        labels3DModeButton.addEventListener('click', () => {
          this.projectorScatterPlotAdapter.set3DLabelMode(this.get3DLabelMode());
        });
        //
        let triangleModeBtn = this.$$("#triangleMode");
        triangleModeBtn.addEventListener('click', () => {
          this.projectorScatterPlotAdapter.setTriangleMode((triangleModeBtn as any).active)
        })
    
        window.addEventListener('resize', () => {
          this.projectorScatterPlotAdapter.resize();
        });
    
        this.projectorScatterPlotAdapter.scatterPlot.onCameraMove(
          (cameraPosition: THREE.Vector3, cameraTarget: THREE.Vector3) =>
            this.bookmarkPanel.clearStateSelection()
        );
        this.registerHoverListener((hoverIndex: number) => {
          this.onHover(hoverIndex)
        }
    
        );
        this.registerProjectionChangedListener((projection: Projection) =>
          this.onProjectionChanged(projection)
        );
        this.registerSelectionChangedListener(
          (
            selectedPointIndices: number[],
            neighborsOfFirstPoint: knn.NearestEntry[]
          ) => this.onSelectionChanged(selectedPointIndices, neighborsOfFirstPoint)
        );
    
        if (!this.isContraVis) {
          this.showConfChangeButton.addEventListener('click', () => {
    
            if (this.confChangeInput < 0 || this.confChangeInput > 1) {
              logging.setErrorMessage("Invaild Input!", null);
              this.showConfChangeButton.disabled = false;
              return;
            }
            else if (!(this.showUnlabeled || this.showTesting || this.showlabeled) || this.showVisError || this.highlightChange) {
              this.showConfChangeButton.disabled = false; // Uncheck 'showVisError'
              // Display your dialog warning
              (this.$.showConfChangeWarning as any).open();
              return;
            }
      
            this.showConfChange(this.confChangeInput)
          });
        }
       
    
      }
      private onHover(hoverIndex: number) {
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
      private getScatterContainer(pos: string): HTMLDivElement {
        if (pos == "left") {
          return this.$$('#scatter1') as HTMLDivElement;
        } else if (pos == "right") {
          return this.$$('#scatter2') as HTMLDivElement;
        } else {
          logging.setErrorMessage('wrong pos!');
        }
      }
      private onSelectionChanged(
        selectedPointIndices: number[],
        neighborsOfFirstPoint: knn.NearestEntry[]
      ) {
        this.selectedPointIndices = selectedPointIndices;
        this.neighborsOfFirstPoint = neighborsOfFirstPoint;
        this.dataPanel.onProjectorSelectionChanged(
          selectedPointIndices,
          neighborsOfFirstPoint
        );
        let totalNumPoints =
          this.selectedPointIndices.length + neighborsOfFirstPoint.length;
        this.statusBar.innerText = `Selected ${totalNumPoints} points`;
        this.statusBar.style.display = totalNumPoints > 0 ? null : 'none';
      }
      onProjectionChanged(projection?: Projection) {
        this.dataPanel.projectionChanged(projection);
        this.updateBackgroundImg()
        this.inspectorPanel.clearQueryResList();
        this.notifySelectionChanged([]);
        this.projectorScatterPlotAdapter.render();
      }
      setProjection(projection: Projection) {
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
        this.metadataCard.updateCustomList(this.dataSet.points, this as ProjectorEventContext)
        this.metadataCard.updateRejectList(this.dataSet.points, this as ProjectorEventContext)
      }
    
      hiddenOrShowScatter(type: string) {
        let dom1 = this.$$('#scatter1') as HTMLElement
        let dom2 = this.$$('#scatter2') as HTMLElement
        if (type === '') {
          this._showNotAvaliable = false
        } else {
          this._showNotAvaliable = true
        }
      }
      refreshnoisyBtn() {
        this.inspectorPanel.refreshBtnStyle()
      }
      /**
       * Gets the current view of the embedding and saves it as a State object.
       */
      getCurrentState(): State {
        const state = new State();
        // Save the individual datapoint projections.
        state.projections = [];
        for (let i = 0; i < this.dataSet.points.length; i++) {
          const point = this.dataSet.points[i];
          const projections: {
            [key: string]: number;
          } = {};
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
      loadState(state: State) {
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
        this.dataPanel.setForceCategoricalColoring(
          !!state.forceCategoricalColoring
        );
        this.selectedLabelOption = state.selectedLabelOption;
        this.projectorScatterPlotAdapter.restoreUIFromBookmark(state);
        {
          const dimensions = stateGetAccessorDimensions(state);
          const components = getProjectionComponents(
            state.selectedProjection,
            dimensions
          );
          const projection = new Projection(
            state.selectedProjection,
            components,
            dimensions.length,
            this.dataSet
          );
          this.setProjection(projection);
        }
        this.notifySelectionChanged(state.selectedPoints);
      }
    
      retrainBySelections(iteration: number, newSel: number[]) {
        this.projectionsPanel.retrainBySelections(iteration, newSel)
      }
    
    
      /**
       * query for indices in inspector panel
       */
      query(query: string, inRegexMode: boolean, fieldName: string, currPredicates: { [key: string]: any }, iteration: number, confidenceThresholdFrom: any, confidenceThresholdTo: any,
        callback: (indices: any) => void) {
    
        let confidenceThreshold = []
        var dummyCurrPredicates: { [key: string]: any } = {};
        Object.keys(currPredicates).forEach((key) => {
          dummyCurrPredicates[key] = currPredicates[key]
        });
    
        dummyCurrPredicates[fieldName] = query;
        if (confidenceThresholdFrom || confidenceThresholdTo) {
          dummyCurrPredicates['confidence'] = [Number(confidenceThresholdFrom), Number(confidenceThresholdTo)]
        }
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
          updateStateForInstance(this.instanceId, { alSuggestLabelList: [] })
          // this.state.alSuggestLabelList = []
          logging.setModalMessage(null, msgId);
          callback(indices);
        }).catch(error => {
          logging.setErrorMessage('querying for indices');
          callback(null);
        });
      }
    
    
      getAllResPosList(callback: (data: any) => void) {
        if (getAllResPositions(this.instanceId) && getAllResPositions(this.instanceId).results && getAllResPositions(this.instanceId).bgimgList) {
          callback(getAllResPositions(this.instanceId))
          return
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
          callback(data)
        }).catch(error => {
          logging.setErrorMessage('querying for indices');
    
        });
      }
    
      /**
       * query for predicates
       */
      simpleQuery(predicates: { [key: string]: any }, iteration: number) {
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
          updateStateForInstance(this.instanceId, { alSuggestLabelList: [] })
          // this.state.alSuggestLabelList = []
        }).catch(error => {
          logging.setErrorMessage('querying for indices');
        });
      }
      // active learning
      queryByAL(iteration: number, strategy: string, budget: number, acceptIndicates: number[], rejectIndicates: number[], isRecommend: boolean,
        callback: (indices: any, scores: any, labels: any) => void) {
        const msgId = logging.setModalMessage('Querying...');
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('Accept', 'application/json');
    
    
        let accIndicates = []
        if (getAcceptIndicates(this.instanceId)) {
          accIndicates = getAcceptIndicates(this.instanceId).filter((item, i, arr) => {
            //函数自身返回的是一个布尔值，只当返回值为true时，当前元素才会存入新的数组中。            
            return getProperties(this.instanceId)[getIteration(this.instanceId)][item] === 1
          })
        }
        let rejIndicates = []
        if (getRejectIndicates(this.instanceId)) {
          rejIndicates = getRejectIndicates(this.instanceId).filter((item, i, arr) => {
            //函数自身返回的是一个布尔值，只当返回值为true时，当前元素才会存入新的数组中。            
            return getProperties(this.instanceId)[getIteration(this.instanceId)][item] === 1
          })
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
          const scores = data.scores
          logging.setModalMessage(null, msgId);
    
    
          callback(indices, scores, labels);
        }).catch(error => {
          logging.setErrorMessage('querying for indices');
          callback(null, [], []);
        });
      }
      // anormaly detection
      queryAnormalyStrategy(budget: number, cls: number, currentIndices: number[], comfirm_info: any[], accIndicates: number[], rejIndicates: number[], strategy: string, isRecommend: boolean,
        callback: (indices: any, cleanIndices?: any) => void) {
        const msgId = logging.setModalMessage('Querying...');
        let headers = new Headers();
        if (!accIndicates) {
          accIndicates = []
        }
        if (!rejIndicates) {
          rejIndicates = []
        }
        let accIn = []
    
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
          const scores = data.scores
          const cleanIndices = data.cleanList
          updateStateForInstance(this.instanceId, { alSuggestScoreList: data.scores })
          updateStateForInstance(this.instanceId, { alSuggestLabelList: data.suggestLabels })
          // this.state.alSuggestScoreList = data.scores
          // this.state.alSuggestLabelList = data.suggestLabels;
          logging.setModalMessage(null, msgId);
          callback(indices, cleanIndices);
        }).catch(error => {
          logging.setErrorMessage('querying for indices');
          callback(null);
        });
      }
    
      querySuggestion(iteration: number, indices: number[], k: number,
        callback: (indices: any) => void) {
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
    
    
      saveDVISelection(indices: number[], callback: (msg: string) => void) {
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
    
    
    
      // queryCurrentFocus(iteration: number, focusIndices: number[],
      //   callback: (indices: any) => void) {
      //   const msgId = logging.setModalMessage('Querying...');
      //   let headers = new Headers();
      //   headers.append('Content-Type', 'application/json');
      //   headers.append('Accept', 'application/json');
      //   await fetch(`http://${this.DVIServer}/get_focus`, {
      //     method: 'POST',
      //     body: JSON.stringify({
      //       "iteration": iteration,
      //       "content_path": window.sessionStorage.content_path,
      //       "vis_method": window.sessionStorage.vis_method,
      //       'setting':window.sessionStorage.selectedSetting
      //     }),
      //     headers: headers,
      //     mode: 'cors'
      //   }).then(response => response.json()).then(data => {
    
      //     // update projection to use new embeddings
      //     this.data.projectDVI()
      //     logging.setModalMessage(null, msgId);
      //     callback(indices);
      //   }).catch(error => {
      //     // logging.setErrorMessage('querying for indices');
      //     callback(null);
      //   });
      // }
      highlightCriticalChange() {
        if (!getPredChangeIndices(this.instanceId)) {
          updateStateForInstance(this.instanceId, { predChangeIndices: [] })
          // getPredChangeIndices(this.instanceId) = [];
        }
        const requestOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            "path": window.sessionStorage.content_path,
            "iteration": this.iteration,
            "last_iteration": getLastIteration(this.instanceId),
            "username": window.sessionStorage.username,
            "vis_method": window.sessionStorage.vis_method,
            'setting': window.sessionStorage.selectedSetting,
            "content_path": window.sessionStorage.content_path
          }),
        };
    
        fetch(`http://${this.DVIServer}/highlightCriticalChange`, requestOptions)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Server responded with status: ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            updateStateForInstance(this.instanceId, { predChangeIndices: data.predChangeIndices })
            // getPredChangeIndices(this.instanceId) = data.predChangeIndices;
          })
          .catch(error => {
            console.error('Error during highlightCriticalChange fetch:', error);
            logging.setErrorMessage('An error occurred while highlighting critical changes.');
          });
      }
    
    
    
    
    
      showConfChange(confChangeInput: number) {
        // const msgId = logging.setModalMessage('loading...');
        this.showConfChangeButton.disabled = true;
    
        if (!getConfChangeIndices(this.instanceId)) {
          updateStateForInstance(this.instanceId, { confChangeIndices: [] })
          // getConfChangeIndices(this.instanceId) = [];
        }
        const requestOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            "path": window.sessionStorage.content_path,
            "iteration": this.iteration,
            "last_iteration": getLastIteration(this.instanceId),
            "username": window.sessionStorage.username,
            "vis_method": window.sessionStorage.vis_method,
            'setting': window.sessionStorage.selectedSetting,
            "content_path": window.sessionStorage.content_path,
            "confChangeInput": confChangeInput
          }),
        };
    
        fetch(`http://${this.DVIServer}/highlightConfChange`, requestOptions)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Server responded with status: ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            updateStateForInstance(this.instanceId, { confChangeIndices: data.confChangeIndices })
            // getConfChangeIndices(this.instanceId) = data.confChangeIndices;
            this.highlightConfChange = true;
            console.log(4477777)
            console.log(getConfChangeIndices(this.instanceId))
            console.log(5465465454)
          })
          .catch(error => {
            console.error('Error during highlightCriticalChange fetch:', error);
            logging.setErrorMessage('An error occurred while highlighting conf changes.');
          });
    
        let confChangeIndices;
    
        confChangeIndices = getConfChangeIndices(this.instanceId)
        confChangeIndices = confChangeIndices.filter(value => getNowShowIndicates(this.instanceId).includes(value))
        console.log(1154564654564654)
        this.filterDataset(getNowShowIndicates(this.instanceId), false, undefined, undefined, confChangeIndices = confChangeIndices)
        console.log(444444444444444)
        this.showConfChangeButton.disabled = false;
    
        // this.dataSet.projectDVI(iterationInput, this.projector.inspectorPanel.currentPredicate,
        //   (iteration: number | null, evaluation: any, newSelection: any[], indices: number[], totalIter?: number) => {
        //     /**
        //      * get filter index
        //      */
        //     //get search predicates or indices
        //     var filterIndices: number[];
        //     filterIndices = []
        //     if (this.temporalStatus) {
        //       //search predicate
        //       this.projector.inspectorPanel.filterIndices = indices;
        //     }
        //     //indices
        //     filterIndices = this.projector.inspectorPanel.filterIndices;
    
        //     this.projector.dataSet.setDVIFilteredData(filterIndices);
    
        //     if (iteration != null) {
        //       this.iterationLabelTsne.innerText = '' + iteration;
        //       this.totalIterationLabelDVI.innerText = '' + totalIter;
        //       this.updateEvaluationInformation(evaluation);
    
        //       this.projector.notifyProjectionPositionsUpdated();
        //       this.projector.onProjectionChanged();
        //       this.projector.onIterationChange(iteration);
        //       if (this.dataSet.tSNEIteration > 1) {
        //         this.previousDVIButton.disabled = false;
        //       }
        //       if (this.dataSet.tSNETotalIter != this.dataSet.tSNEIteration) {
        //         this.nextDVIButton.disabled = false;
        //       }
        //     } else {
        //       this.nextDVIButton.disabled = false;
        //       this.projector.onProjectionChanged();
        //     }
        //     logging.setModalMessage(null, msgId);
        //     this.jumpDVIButton.disabled = false;
        //   });
      }
      // In your component's connectedCallback or equivalent initialization method
    
    // connectedCallback() {
    //   super.connectedCallback();
    
    //   // Add an event listener for the stateUpdated event
    //   window.addEventListener(STATE_UPDATED_EVENT, this.handleStateUpdate.bind(this));
    // }
    
    // // In your component's disconnectedCallback or equivalent cleanup method
    
    // disconnectedCallback() {
    //   super.disconnectedCallback();
    
    //   // Remove the event listener when the component is removed
    //   window.removeEventListener(STATE_UPDATED_EVENT, this.handleStateUpdate.bind(this));
    // }
    
    // // Handler for the stateUpdated event
    
    // handleStateUpdate(event) {
    //   const { instanceId, newState } = event.detail;
    
    //   // Check if the updated state is for this instance
    //   if (instanceId === this.instanceId) {
    //       // Update the component's state or react to the changes as needed
    //       this.state = {...this.state, ...newState};
    //       // Update the component's view or internal data based on the new state
    //   }
    // }
    
    
    
    // }

  
    
      }