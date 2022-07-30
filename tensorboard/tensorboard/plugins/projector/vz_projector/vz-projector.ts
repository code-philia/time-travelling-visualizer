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
declare global {
  interface Window {
    hiddenBackground: boolean | false,
    DVIDataList: any,
    lineGeomertryList: any,
    iteration: number,
    properties: any,
    isFilter: boolean | false,
    customSelection: any,
    checkboxDom: any,
    isAdjustingSel: boolean | false,
    scene: any,
    renderer: any,
    suggestionIndicates: any,

    unLabelData: any,
    testingData: any,
    labeledData: any,

    nowShowIndicates: any,
    sceneBackgroundImg: any,
    customMetadata: any,

    queryResPointIndices: any,
    alQueryResPointIndices:any,
    previousIndecates: any,
    previousAnormalIndecates: any,
    queryResAnormalIndecates: any,
    queryResAnormalCleanIndecates: any,
    alSuggestionIndicates: any,
    alSuggestLabelList: any,
    alSuggestScoreList: any,
    previousHover: number,

    allResPositions: any,
    modelMath: string,
    tSNETotalIter: number,
    taskType: string,
    selectedStack:any
  }
}

import { PolymerElement } from '@polymer/polymer';
import { customElement, observe, property } from '@polymer/decorators';
import * as THREE from 'three';

import { LegacyElementMixin } from '../../../components/polymer/legacy_element_mixin';
import '../../../components/polymer/irons_and_papers';

import { AnalyticsLogger } from './analyticsLogger';
import { template } from './vz-projector.html';
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

@customElement('vz-projector')
class Projector
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

  /**
   * DVI properties
   */
  @property({ type: String })
  DVIServer: string

  @property({ type: Boolean })
  showlabeled: boolean = true;

  @property({ type: Boolean })
  showUnlabeled: boolean = true;

  @property({ type: Boolean })
  showTesting: boolean = true;

  // The working subset of the data source's original data set.
  dataSet: DataSet;
  iteration: number;
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




  async ready() {
    super.ready();
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
    this.setupUIControls();
    this.initializeDataProvider();
    this.iteration = 0;
    this.currentIteration = 0

    this.showlabeled = true
    this.showUnlabeled = true
    this.showTesting = true

    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'application/json');
    await fetch("standalone_projector_config.json", { method: 'GET' })
      .then(response => response.json())
      .then(data => { this.DVIServer = data.DVIServerIP + ":" + data.DVIServerPort; })
  };

  @observe('showlabeled')
  _labeledChanged() {
    let indicates = []
    if (window.nowShowIndicates) {
      if (this.showlabeled) {
        for (let i = 0; i < window.properties[window.iteration].length; i++) {
          let indicate = window.properties[window.iteration][i]
          if (indicate === 0 || window.nowShowIndicates.indexOf(i) !== -1) {
            indicates.push(i)
          }
        }
        window.nowShowIndicates = indicates
        // this.projector.filterDataset(window.nowShowIndicates)
      } else {
        ///隐藏labeled
        for (let i = 0; i < window.properties[window.iteration].length; i++) {
          if (window.properties[window.iteration][i] !== 0 && window.nowShowIndicates.indexOf(i) !== -1) {
            indicates.push(i)
          }
        }
        window.nowShowIndicates = indicates
      }
      this.filterDataset(window.nowShowIndicates)
    }
  }

  @observe('showUnlabeled')
  _unLabelChanged() {
    let indicates = []
    if (window.nowShowIndicates) {
      if (this.showUnlabeled) {
        for (let i = 0; i < window.properties[window.iteration].length; i++) {
          let indicate = window.properties[window.iteration][i]
          if (indicate === 1 || window.nowShowIndicates.indexOf(i) !== -1) {
            indicates.push(i)
          }
        }
        window.nowShowIndicates = indicates
        // this.projector.filterDataset(window.nowShowIndicates)
      } else {
        for (let i = 0; i < window.properties[window.iteration].length; i++) {
          if (window.properties[window.iteration][i] !== 1 && window.nowShowIndicates.indexOf(i) !== -1) {
            indicates.push(i)
          }
        }
        window.nowShowIndicates = indicates
      }
      this.filterDataset(window.nowShowIndicates)
    }
  }

  @observe('showTesting')
  _testingChanged() {
    let indicates = []
    if (window.nowShowIndicates) {
      if (this.showTesting) {
        for (let i = 0; i < window.properties[window.iteration].length; i++) {
          let indicate = window.properties[window.iteration][i]
          if (indicate === 2 || window.nowShowIndicates.indexOf(i) !== -1) {
            indicates.push(i)
          }
        }
        window.nowShowIndicates = indicates
        // this.projector.filterDataset(window.nowShowIndicates)
      } else {
        ///隐藏labeled
        for (let i = 0; i < window.properties[window.iteration].length; i++) {
          if (window.properties[window.iteration][i] !== 2 && window.nowShowIndicates.indexOf(i) !== -1) {
            indicates.push(i)
          }
        }
        window.nowShowIndicates = indicates
      }
      this.filterDataset(window.nowShowIndicates)
    }
  }

  onIterationChange(num: number) {
    // window.iteration = num;
    this.iteration = num;
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
  filterDataset(pointIndices: number[], filter?: boolean) {
    const selectionSize = this.selectedPointIndices.length;
    /*
    if (this.dataSetBeforeFilter == null) {
      this.dataSetBeforeFilter = this.dataSet;
    }*/
    this.dataSet.setDVIFilteredData(pointIndices);
    // this.setCurrentDataSet(this.dataSet.getSubset(pointIndices));
    this.dataSetFilterIndices = pointIndices;
    this.projectorScatterPlotAdapter.updateScatterPlotPositions();
    this.projectorScatterPlotAdapter.updateScatterPlotAttributes(filter);
    this.projectorScatterPlotAdapter.updateBackground()
    this.adjustSelectionAndHover(util.range(selectionSize));
    if (window.isAdjustingSel) {
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

    this.currentIteration = window.iteration

    let current = 1
    let positions = window.allResPositions?.results
    let interationList = []
    if (window.allResPositions && window.allResPositions.bgimgList) {
      window.sceneBackgroundImg = window.allResPositions?.bgimgList
    }
    for (let key of Object.keys(window.allResPositions?.results)) {
      interationList.push(Number(key))
    }
    current = Number(interationList[0])
    let count = 0
    this.timer = window.setInterval(() => {
      this.inspectorPanel.updateCurrentPlayEpoch(current)
      window.iteration = current;
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
      // this.projectorScatterPlotAdapter.updateScatterPlotAttributes()
      this.projectorScatterPlotAdapter.render()
      if (count < interationList.length - 1) {
        current = interationList[++count]
      } else {
        current = interationList[0]
        count = 0
        this.setDynamicStop()
      }
    }, 1500)
  }

  updatePosByIndicates(current: number) {
    let positions = window.allResPositions?.results
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
    console.log('this.timer', this.timer)
    if (this.timer) {
      window.clearInterval(this.timer)
    }
    
    this.iteration = this.currentIteration
    window.iteration = this.currentIteration
    this.updatePosByIndicates(window.iteration)
  }

  renderInTraceLine(inTrace: boolean) {
    this.projectorScatterPlotAdapter.setRenderInTraceLine(inTrace)
  }

  refresh() {
    // this.projectorScatterPlotAdapter.scatterPlot.render()
    this.metadataCard.updateCustomList(this.dataSet.points)
    // this.projectorScatterPlotAdapter.scatterPlot.render()
    this.projectorScatterPlotAdapter.updateScatterPlotAttributes()
    this.projectorScatterPlotAdapter.render()
  }
  /**
   * Used by clients to indicate that a selection has occurred.
   */
  notifySelectionChanged(newSelectedPointIndices: number[], selectMode?: boolean, selectionType?: string) {
    
    if (selectionType === 'isALQuery' || selectionType === 'normal' || selectionType === 'isAnormalyQuery') {
      window.customSelection = []
      window.queryResPointIndices = newSelectedPointIndices
      if(selectionType === 'isALQuery'){
        window.alQueryResPointIndices = newSelectedPointIndices
      }else{
        window.alQueryResPointIndices = []
      }
      this.metadataCard.updateCustomList(this.dataSet.points)
    }
    if (selectionType === 'isShowSelected') {
      for (let i = 0; i < window.previousIndecates?.length; i++) {
        // if(window.customSelection.indexOf(window.previousIndecates[i]) === -1){
        let index = window.previousIndecates[i]
        if (window.checkboxDom[index]) {
          window.checkboxDom[index].checked = true
        }
        // }
      }
      this.metadataCard.updateCustomList(this.dataSet.points)
      this.projectorScatterPlotAdapter.updateScatterPlotAttributes()
      this.projectorScatterPlotAdapter.render()
      return
    }
    if (selectionType === 'boundingbox' && window.isAdjustingSel) {
      if (!window.customSelection) {
        window.customSelection = []
      }
      for (let i = 0; i < newSelectedPointIndices.length; i++) {
        let check: any = window.checkboxDom[newSelectedPointIndices[i]]
        if (window.customSelection.indexOf(newSelectedPointIndices[i]) < 0) {
          window.customSelection.push(newSelectedPointIndices[i]);

          if (check) {
            check.checked = true
          }

        } else {
          let index = window.customSelection.indexOf(newSelectedPointIndices[i])
          window.customSelection.splice(index, 1)
          if (check) {
            check.checked = false
          }
        }
      }
      this.metadataCard.updateCustomList(this.dataSet.points)
      this.projectorScatterPlotAdapter.updateScatterPlotAttributes()
      this.projectorScatterPlotAdapter.render()
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
        if (window.isAnimatating !== true) {
          // this.dataSet.getSpriteImage(this.selectedPointIndices[0], (imgData: any) => {
          //   let src = 'data:image/png;base64,' + imgData.imgUrl
          //   this.metadataCard.updateMetadata(
          //     this.dataSet.points[newSelectedPointIndices[0]].metadata, src, this.dataSet.points[newSelectedPointIndices[0]]
          //   );
          // })
        }
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
    this.hoverListeners.forEach((l) => l(pointIndex));
    let timeNow = new Date().getTime()
    if (this.timer === null || timeNow - this.timer > 100) {
      if (window.iteration && pointIndex !== undefined && pointIndex !== null && window.previousHover !== pointIndex) {
        console.log('get img')
        this.timer = timeNow
        this.updateMetaByIndices(pointIndex)
        window.previousHover = pointIndex
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
    if (this.servingMode === 'demo') {
      let projectorConfigUrl: string;
      // Only in demo mode do we allow the config being passed via URL.
      let urlParams = util.getURLParams(initialURLQueryString);
      if ('config' in urlParams) {
        projectorConfigUrl = urlParams['config'];
      } else {
        projectorConfigUrl = this.projectorConfigJsonPath;
      }
      this.dataProvider = new DemoDataProvider(projectorConfigUrl);
    } else if (this.servingMode === 'server') {
      if (!this.routePrefix) {
        throw 'route-prefix is a required parameter';
      }
      this.dataProvider = new ServerDataProvider(this.routePrefix);
    } else if (this.servingMode === 'proto' && dataProto != null) {
      this.dataProvider = new ProtoDataProvider(dataProto);
    } else {
      // The component is not ready yet - waiting for the dataProto field.
      return;
    }
    this.dataPanel.initialize(this, this.dataProvider);
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
      window.hiddenBackground = (hiddenBackground as any).active
      for (let i = 0; i < this.dataSet.points.length; i++) {
        const point = this.dataSet.points[i];
        if (point.metadata[this.selectedLabelOption]) {
          let hoverText = point.metadata[this.selectedLabelOption].toString();
          if (hoverText == 'background') {
            if ((hiddenBackground as any).active) {
              // window.scene.remove(window.backgroundMesh)
              point.color = '#ffffff'
            } else {
              point.color = point.DVI_color[1]
              // window.scene.add(window.backgroundMesh)
            }
          }
        }
      }
      // if(window.scene.children)
      if (window.scene.children[2] && window.scene.children[2].type === 'Mesh') {
        window.scene.children[2].visible = !window.hiddenBackground
      }
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
    {
      this.projectorScatterPlotAdapter = new ProjectorScatterPlotAdapter(
        this.getScatterContainer(),
        this as ProjectorEventContext
      );
      this.projectorScatterPlotAdapter.setLabelPointAccessor(
        this.selectedLabelOption
      );
    }
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
  private getScatterContainer(): HTMLDivElement {
    return this.$$('#scatter') as HTMLDivElement;
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
    this.inspectorPanel.clearQueryResList()
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
        "predicates": dummyCurrPredicates, "content_path": this.dataSet.DVIsubjectModelPath,
        "iteration": iteration
      }),
      headers: headers,
      mode: 'cors'
    }).then(response => response.json()).then(data => {
      const indices = data.selectedPoints;
      window.alSuggestLabelList = []
      logging.setModalMessage(null, msgId);
      callback(indices);
    }).catch(error => {
      logging.setErrorMessage('querying for indices');
      callback(null);
    });
  }

  getAllResPosList(callback: (data: any) => void) {
    if (window.allResPositions && window.allResPositions.results && window.allResPositions.bgimgList) {
      callback(window.allResPositions)
      return
    }
    const msgId = logging.setModalMessage('Querying...');
    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'application/json');
    fetch(`http://${this.DVIServer}/all_result_list?content_path=${this.dataSet.DVIsubjectModelPath}&iteration_start=1&iteration_end=${window.tSNETotalIter}`, {
      method: 'GET',
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
        "predicates": predicates, "content_path": this.dataSet.DVIsubjectModelPath,
        "iteration": iteration
      }),
      headers: headers,
      mode: 'cors'
    }).then(response => response.json()).then(data => {
      const indices = data.selectedPoints;
      this.inspectorPanel.filteredPoints = indices;
      window.alSuggestLabelList = []
    }).catch(error => {
      logging.setErrorMessage('querying for indices');
    });
  }
  // active learning
  queryByAL(iteration: number, strategy: string, budget: number, currentIndices: number[], previousIndices: number[],
    callback: (indices: any, scores: any, labels: any) => void) {
    const msgId = logging.setModalMessage('Querying...');
    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'application/json');
    fetch(`http://${this.DVIServer}/al_query`, {
      method: 'POST',
      body: JSON.stringify({
        "iteration": iteration,
        "strategy": strategy,
        "budget": budget,
        "content_path": this.dataSet.DVIsubjectModelPath,
        "currentIndices": currentIndices,
        "previousIndices": previousIndices
      }),
      headers: headers,
      mode: 'cors'
    }).then(response => response.json()).then(data => {
      const indices = data.selectedPoints;
      const labels = data.suggestLabels;
      const scores = data.scores
      logging.setModalMessage(null, msgId);

      for (let i = 0; i < currentIndices.length; i++) {
        if (window.previousIndecates.indexOf(currentIndices[i]) === -1) {
          window.previousIndecates.push(currentIndices[i])
        }
      }
      function func(a, b) {
        return a - b;
      }
      window.previousIndecates.sort(func)

      callback(indices, scores, labels);
    }).catch(error => {
      logging.setErrorMessage('querying for indices');
      callback(null, [], []);
    });
  }
  // anormaly detection
  queryAnormalyStrategy(strategy: string, budget: number, cls: number, currentIndices: number[], previousIndices: number[],
    callback: (indices: any, cleanIndices?: any) => void) {
    const msgId = logging.setModalMessage('Querying...');
    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'application/json');
    fetch(`http://${this.DVIServer}/anomaly_query`, {
      method: 'POST',
      body: JSON.stringify({
        "strategy": strategy,
        "budget": budget,
        "cls": cls,
        "currentIndices": currentIndices,
        "previousIndices": previousIndices,
        "content_path": this.dataSet.DVIsubjectModelPath,
      }),
      headers: headers,
      mode: 'cors'
    }).then(response => response.json()).then(data => {
      const indices = data.selectedPoints;
      const labels = data.suggestLabels;
      const scores = data.scores
      const cleanIndices = data.cleanList
      window.alSuggestScoreList = data.scores
      window.alSuggestLabelList = data.suggestLabels;
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
        "content_path": this.dataSet.DVIsubjectModelPath,
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
        "newIndices": indices, "content_path": this.dataSet.DVIsubjectModelPath,
        "iteration": this.iteration
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

}
