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
import * as d3 from 'd3';
import { LabelRenderParams } from './renderContext';
import { ScatterPlot } from './scatterPlot';
import { ScatterPlotVisualizerSprites } from './scatterPlotVisualizerSprites';
import { ScatterPlotVisualizer3DLabels } from './scatterPlotVisualizer3DLabels';
import { scatterPlotVisualizerTriangles } from './scatterPlotVisualizerTriangles';
import { ScatterPlotVisualizerCanvasLabels } from './scatterPlotVisualizerCanvasLabels';
import { ScatterPlotVisualizerPolylines } from './scatterPlotVisualizerPolylines';
import { scatterPlotVisualizerTraceLine } from './scatterPlotVisualizerTraceLine';
import * as vector from './vector';
const LABEL_FONT_SIZE = 10;
const LABEL_SCALE_DEFAULT = 1.0;
const LABEL_SCALE_LARGE = 2;
const LABEL_FILL_COLOR_CHECKED = 65280;
const LABEL_STROKE_COLOR_CHECKED = 65280;
const LABEL_FILL_COLOR_SELECTED = 0xFF560731;
const LABEL_STROKE_COLOR_SELECTED = 0xffffff;
// const LABEL_FILL_COLOR_HOVER = 0xFF560731;
// const LABEL_STROKE_COLOR_HOVER = 0xffffff;
const LABEL_FILL_COLOR_HOVER = 16744192;
const LABEL_STROKE_COLOR_HOVER = 16744192;
const LABEL_FILL_COLOR_NEIGHBOR = 0x000000;
const LABEL_STROKE_COLOR_NEIGHBOR = 0xffffff;
const POINT_COLOR_UNSELECTED = 0xe3e3e3;
const POINT_COLOR_NO_SELECTION = 0x7575d9;
const POINT_COLOR_SELECTED = 0xfa6666;
const POINT_COLOR_UNLABELED = 16776960;
const POINT_COLOR_HOVER = 7396243;
const POINT_SCALE_DEFAULT = 1.2;
const POINT_SCALE_SELECTED = 2.0;
const POINT_SCALE_NEIGHBOR = 1.2;
const POINT_SCALE_HOVER = 2.5;
const POINT_SCALE_NEW_SELECTION = 2;
const POINT_SCALE_SELECTED_NEW_SELECTION = 2.4;
const POINT_SCALE_HOVER_NEW_SELECTION = 2.4;
const LABELS_3D_COLOR_UNSELECTED = 0xffffff;
const LABELS_3D_COLOR_NO_SELECTION = 0xffffff;
const TIR_COLOR_UNSELECTED = 0xe3e3e3;
const TIR_COLOR_SELECTED = 0xfa6666;
const SPRITE_IMAGE_COLOR_UNSELECTED = 0xffffff;
const SPRITE_IMAGE_COLOR_NO_SELECTION = 0xffffff;
const POINT_CUSTOM_SELECTED = 3329330;
const HIDDEN_BACKGROUND_COLOR = 0xffffff;
const POLYLINE_START_HUE = 60;
const POLYLINE_END_HUE = 360;
const POLYLINE_SATURATION = 1;
const POLYLINE_LIGHTNESS = 0.3;
const POLYLINE_DEFAULT_OPACITY = 0.2;
const POLYLINE_DEFAULT_LINEWIDTH = 2;
const POLYLINE_SELECTED_OPACITY = 0.9;
const POLYLINE_SELECTED_LINEWIDTH = 3;
const POLYLINE_DESELECTED_OPACITY = 0.05;
const SCATTER_PLOT_CUBE_LENGTH = 2;
/** Color scale for nearest neighbors. */
const NN_COLOR_SCALE = d3
    .scaleLinear()
    .domain([1, 0.7, 0.4])
    .range(['hsl(285, 80%, 40%)', 'hsl(0, 80%, 65%)', 'hsl(40, 70%, 60%)'])
    .clamp(true);
/**
 * Interprets projector events and assembes the arrays and commands necessary
 * to use the ScatterPlot to render the current projected data set.
 */
export class ProjectorScatterPlotAdapter {
    constructor(scatterPlotContainer, projectorEventContext) {
        this.scatterPlotContainer = scatterPlotContainer;
        this.renderLabelsIn3D = false;
        this.renderInTriangle = false;
        this.renderInTraceLine = false;
        this.scatterPlot = new ScatterPlot(scatterPlotContainer, projectorEventContext);
        projectorEventContext.registerProjectionChangedListener((projection) => {
            this.projection = projection;
            this.updateScatterPlotWithNewProjection(projection);
        });
        projectorEventContext.registerSelectionChangedListener((selectedPointIndices, neighbors) => {
            this.selectedPointIndices = selectedPointIndices;
            this.neighborsOfFirstSelectedPoint = neighbors;
            if (this.renderInTriangle) {
                if (this.triangles) {
                    this.triangles.setSelectedPoint(this.selectedPointIndices);
                    this.triangles.setUnLabeledIndex(window.unLabelData);
                }
            }
            if (this.renderInTraceLine) {
                if (this.traceLine) {
                    this.traceLine.setEpoches(this.traceLineEpoch);
                    this.traceLine.setSelectedPoint(this.selectedPointIndices);
                }
            }
            this.updateScatterPlotPositions();
            this.updateScatterPlotAttributes();
            this.scatterPlot.render();
        });
        projectorEventContext.registerHoverListener((hoverPointIndex) => {
            this.hoverPointIndex = hoverPointIndex;
            this.updateScatterPlotAttributes();
            this.scatterPlot.render();
        });
        projectorEventContext.registerDistanceMetricChangedListener((distanceMetric) => {
            this.distanceMetric = distanceMetric;
            this.updateScatterPlotAttributes();
            this.scatterPlot.render();
        });
        this.createVisualizers(false);
    }
    // notifyProjectionPositionsUpdated(newSelection?: any[]) {
    notifyProjectionPositionsUpdated() {
        // if(newSelection != undefined) {
        //   this.newSelectionIndices = newSelection;
        // }
        this.updateScatterPlotPositions();
        this.updateScatterPlotAttributes();
        this.scatterPlot.render();
    }
    updateTriangle() {
        this.triangles.createTriangles();
    }
    setDataSet(dataSet) {
        if (this.projection != null) {
            // TODO(@charlesnicholson): setDataSet needs to go away, the projection is the
            // atomic unit of update.
            this.projection.dataSet = dataSet;
        }
        if (this.polylineVisualizer != null) {
            this.polylineVisualizer.setDataSet(dataSet);
        }
        if (this.labels3DVisualizer != null) {
            this.labels3DVisualizer.setLabelStrings(this.generate3DLabelsArray(dataSet, this.labelPointAccessor));
        }
        if (this.spriteVisualizer == null) {
            return;
        }
        this.spriteVisualizer.clearSpriteAtlas();
        if (dataSet == null || dataSet.spriteAndMetadataInfo == null) {
            return;
        }
        const metadata = dataSet.spriteAndMetadataInfo;
        if (metadata.spriteImage == null || metadata.spriteMetadata == null) {
            return;
        }
        // return;
        const n = dataSet.points.length;
        const spriteIndices = new Float32Array(n);
        for (let i = 0; i < n; ++i) {
            spriteIndices[i] = dataSet.points[i].index;
        }
        this.spriteVisualizer.setSpriteAtlas(metadata.spriteImage, metadata.spriteMetadata.singleImageDim, spriteIndices);
    }
    set3DLabelMode(renderLabelsIn3D) {
        this.renderLabelsIn3D = renderLabelsIn3D;
        this.createVisualizers(renderLabelsIn3D);
        this.updateScatterPlotAttributes();
        this.scatterPlot.render();
    }
    setTriangleMode(renderTriangle) {
        this.renderInTriangle = renderTriangle;
        this.createVisualizers(false, renderTriangle);
        this.updateScatterPlotAttributes();
        this.scatterPlot.render();
    }
    setRenderInTraceLine(renderTraceLine) {
        if (!renderTraceLine) {
            console.log('none');
        }
        this.renderInTraceLine = renderTraceLine;
        window.allResPositions[0];
        this.traceLineEpoch = [window.allResPositions[0], window.allResPositions[window.allResPositions.length - 1]];
        this.createVisualizers(false, false);
        this.updateScatterPlotAttributes();
        this.scatterPlot.render();
    }
    setLegendPointColorer(legendPointColorer) {
        this.legendPointColorer = legendPointColorer;
    }
    setLabelPointAccessor(labelPointAccessor) {
        this.labelPointAccessor = labelPointAccessor;
        if (this.labels3DVisualizer != null) {
            const ds = this.projection == null ? null : this.projection.dataSet;
            this.labels3DVisualizer.setLabelStrings(this.generate3DLabelsArray(ds, labelPointAccessor));
        }
    }
    resize() {
        this.scatterPlot.resize();
    }
    populateBookmarkFromUI(state) {
        state.cameraDef = this.scatterPlot.getCameraDef();
    }
    restoreUIFromBookmark(state) {
        this.scatterPlot.setCameraParametersForNextCameraCreation(state.cameraDef, false);
    }
    updateScatterPlotPositions(dataset) {
        // let ds
        // if(dataset){
        //   ds = dataset
        //   console.log('ds',ds)
        // }else{
        const ds = this.projection == null ? null : this.projection.dataSet;
        // }
        const projectionComponents = this.projection == null ? null : this.projection.projectionComponents;
        const newPositions = this.generatePointPositionArray(ds, projectionComponents);
        this.scatterPlot.setPointPositions(newPositions, this.projection == null ? 0 : this.projection.dataSet.DVICurrentRealDataNumber);
        if (!window.worldSpacePointPositions) {
            window.worldSpacePointPositions = [];
        }
        window.worldSpacePointPositions[window.iteration] = newPositions;
    }
    updateBackground() {
        if (window.sceneBackgroundImg && window.sceneBackgroundImg[window.iteration]) {
            this.scatterPlot.addbackgroundImg(window.sceneBackgroundImg[window.iteration]);
        }
    }
    updateScatterPlotAttributes(isFilter) {
        if (this.projection == null) {
            return;
        }
        const dataSet = this.projection.dataSet;
        const selectedSet = this.selectedPointIndices;
        // const newSelectionSet = this.newSelectionIndices;
        const hoverIndex = this.hoverPointIndex;
        const neighbors = this.neighborsOfFirstSelectedPoint;
        const pointColorer = this.legendPointColorer;
        const pointColors = this.generatePointColorArray(dataSet, pointColorer, this.distanceMetric, selectedSet, neighbors, hoverIndex, this.renderLabelsIn3D, this.getSpriteImageMode(), this.renderInTriangle, this.renderInTraceLine);
        const pointScaleFactors = this.generatePointScaleFactorArray(dataSet, selectedSet, 
        // newSelectionSet,
        neighbors, hoverIndex);
        const labels = this.generateVisibleLabelRenderParams(dataSet, selectedSet, neighbors, hoverIndex);
        const polylineColors = this.generateLineSegmentColorMap(dataSet, pointColorer);
        const polylineOpacities = this.generateLineSegmentOpacityArray(dataSet, selectedSet);
        const polylineWidths = this.generateLineSegmentWidthArray(dataSet, selectedSet);
        this.scatterPlot.setPointColors(pointColors);
        this.scatterPlot.setPointScaleFactors(pointScaleFactors);
        this.scatterPlot.setLabels(labels);
        this.scatterPlot.setPolylineColors(polylineColors);
        this.scatterPlot.setPolylineOpacities(polylineOpacities);
        this.scatterPlot.setPolylineWidths(polylineWidths);
    }
    render() {
        this.scatterPlot.render();
    }
    generatePointPositionArray(ds, projectionComponents) {
        if (ds == null) {
            return null;
        }
        const xScaler = d3.scaleLinear();
        const yScaler = d3.scaleLinear();
        let zScaler = null;
        {
            // Determine max and min of each axis of our data.
            const xExtent = d3.extent(ds.points, (p, i) => ds.points[i].projections[projectionComponents[0]]);
            const yExtent = d3.extent(ds.points, (p, i) => ds.points[i].projections[projectionComponents[1]]);
            const range = [
                -SCATTER_PLOT_CUBE_LENGTH / 2,
                SCATTER_PLOT_CUBE_LENGTH / 2,
            ];
            xScaler.domain(xExtent).range(range);
            yScaler.domain(yExtent).range(range);
            if (projectionComponents[2] != null) {
                const zExtent = d3.extent(ds.points, (p, i) => ds.points[i].projections[projectionComponents[2]]);
                zScaler = d3.scaleLinear();
                zScaler.domain(zExtent).range(range);
            }
        }
        const positions = new Float32Array(ds.points.length * 3);
        let dst = 0;
        ds.points.forEach((d, i) => {
            positions[dst++] = xScaler(ds.points[i].projections[projectionComponents[0]]);
            positions[dst++] = yScaler(ds.points[i].projections[projectionComponents[1]]);
            positions[dst++] = 0;
        });
        if (zScaler) {
            dst = 2;
            ds.points.forEach((d, i) => {
                positions[dst] = zScaler(ds.points[i].projections[projectionComponents[2]]);
                dst += 3;
            });
        }
        return positions;
    }
    generateVisibleLabelRenderParams(ds, selectedPointIndices, neighborsOfFirstPoint, hoverPointIndex) {
        var _a;
        if (ds == null) {
            return null;
        }
        if (!window.customSelection) {
            window.customSelection = [];
        }
        let tempArr = [];
        const selectedPointCount = selectedPointIndices == null ? 0 : (_a = window.queryResPointIndices) === null || _a === void 0 ? void 0 : _a.length;
        for (let i = 0; i < selectedPointCount; i++) {
            let indicate = window.queryResPointIndices[i];
            if (window.customSelection.indexOf(indicate) === -1) {
                tempArr.push(indicate);
            }
        }
        const tempLength = tempArr.length;
        const customSelectionCount = window.customSelection.length;
        // const customSeletedCount = null ? 0 : window.customSelection?.length
        const neighborCount = neighborsOfFirstPoint == null ? 0 : neighborsOfFirstPoint.length;
        const n = tempLength + customSelectionCount + neighborCount + (hoverPointIndex != null ? 1 : 0);
        const visibleLabels = new Uint32Array(n);
        const scale = new Float32Array(n);
        const opacityFlags = new Int8Array(n);
        const fillColors = new Uint8Array(n * 3);
        const strokeColors = new Uint8Array(n * 3);
        const labelStrings = [];
        scale.fill(LABEL_SCALE_DEFAULT);
        opacityFlags.fill(1);
        let dst = 0;
        if (hoverPointIndex != null) {
            labelStrings.push(this.getLabelText(ds, hoverPointIndex, this.labelPointAccessor));
            visibleLabels[dst] = hoverPointIndex;
            scale[dst] = LABEL_SCALE_LARGE;
            opacityFlags[dst] = 0;
            const fillRgb = styleRgbFromHexColor(LABEL_FILL_COLOR_HOVER);
            packRgbIntoUint8Array(fillColors, dst, fillRgb[0], fillRgb[1], fillRgb[2]);
            const strokeRgb = styleRgbFromHexColor(LABEL_STROKE_COLOR_HOVER);
            packRgbIntoUint8Array(strokeColors, dst, strokeRgb[0], strokeRgb[1], strokeRgb[1]);
            ++dst;
        }
        // Selected points
        {
            const n = customSelectionCount;
            const fillRgb = styleRgbFromHexColor(LABEL_FILL_COLOR_CHECKED);
            const strokeRgb = styleRgbFromHexColor(LABEL_STROKE_COLOR_CHECKED);
            for (let i = 0; i < n; ++i) {
                const labelIndex = window.customSelection[i];
                labelStrings.push(this.getLabelText(ds, labelIndex, this.labelPointAccessor));
                visibleLabels[dst] = labelIndex;
                scale[dst] = LABEL_SCALE_LARGE;
                opacityFlags[dst] = n === 1 ? 0 : 1;
                packRgbIntoUint8Array(fillColors, dst, fillRgb[0], fillRgb[1], fillRgb[2]);
                packRgbIntoUint8Array(strokeColors, dst, strokeRgb[0], strokeRgb[1], strokeRgb[2]);
                ++dst;
            }
        }
        {
            const n = tempLength;
            const fillRgb = styleRgbFromHexColor(LABEL_FILL_COLOR_SELECTED);
            const strokeRgb = styleRgbFromHexColor(LABEL_STROKE_COLOR_SELECTED);
            for (let i = 0; i < n; ++i) {
                const labelIndex = tempArr[i];
                labelStrings.push(this.getLabelText(ds, labelIndex, this.labelPointAccessor));
                visibleLabels[dst] = labelIndex;
                scale[dst] = LABEL_SCALE_LARGE;
                opacityFlags[dst] = n === 1 ? 0 : 1;
                packRgbIntoUint8Array(fillColors, dst, fillRgb[0], fillRgb[1], fillRgb[2]);
                packRgbIntoUint8Array(strokeColors, dst, strokeRgb[0], strokeRgb[1], strokeRgb[2]);
                ++dst;
            }
        }
        // Neighbors
        {
            const n = neighborCount;
            const fillRgb = styleRgbFromHexColor(LABEL_FILL_COLOR_NEIGHBOR);
            const strokeRgb = styleRgbFromHexColor(LABEL_STROKE_COLOR_NEIGHBOR);
            for (let i = 0; i < n; ++i) {
                const labelIndex = neighborsOfFirstPoint[i].index;
                labelStrings.push(this.getLabelText(ds, labelIndex, this.labelPointAccessor));
                visibleLabels[dst] = labelIndex;
                scale[dst] = LABEL_SCALE_LARGE;
                packRgbIntoUint8Array(fillColors, dst, fillRgb[0], fillRgb[1], fillRgb[2]);
                packRgbIntoUint8Array(strokeColors, dst, strokeRgb[0], strokeRgb[1], strokeRgb[2]);
                ++dst;
            }
        }
        return new LabelRenderParams(new Float32Array(visibleLabels), labelStrings, scale, opacityFlags, LABEL_FONT_SIZE, fillColors, strokeColors);
    }
    generatePointScaleFactorArray(ds, selectedPointIndices, 
    // newSelectionIndices: any[],
    neighborsOfFirstPoint, hoverPointIndex) {
        if (ds == null) {
            return new Float32Array(0);
        }
        const scale = new Float32Array(ds.points.length);
        scale.fill(POINT_SCALE_DEFAULT);
        if (!window.customSelection) {
            window.customSelection = [];
        }
        const selectedPointCount = selectedPointIndices == null ? 0 : selectedPointIndices.length;
        const neighborCount = neighborsOfFirstPoint == null ? 0 : neighborsOfFirstPoint.length;
        // const newSelectionCount =
        //   newSelectionIndices == null ? 0 : newSelectionIndices.length;
        // const selectedNewSelectionIndices =
        //     (selectedPointIndices == null || newSelectionIndices == null) ? null :
        //         selectedPointIndices.filter(value => {newSelectionIndices.includes(value)});
        // const selectedNewSelectionCount =
        //     selectedNewSelectionIndices == null ? 0 : selectedPointIndices.length;
        // const hoverNewSelectionPointIndex =
        //     (hoverPointIndex == null || newSelectionIndices == null || newSelectionIndices.indexOf(hoverPointIndex) == -1) ?
        //         null : hoverPointIndex;
        // Scale up all selected points.
        {
            const n = selectedPointCount;
            for (let i = 0; i < n; ++i) {
                const p = selectedPointIndices[i];
                if (window.isAnimatating) {
                    scale[p] = 4.0;
                }
                else {
                    scale[p] = POINT_SCALE_SELECTED;
                }
            }
        }
        {
            const n = window.customSelection.length;
            for (let i = 0; i < n; ++i) {
                const p = window.customSelection[i];
                if (window.isAnimatating) {
                    scale[p] = 4.0;
                }
            }
        }
        // Scale up the neighbor points.
        {
            const n = neighborCount;
            for (let i = 0; i < n; ++i) {
                const p = neighborsOfFirstPoint[i].index;
                scale[p] = POINT_SCALE_NEIGHBOR;
            }
        }
        // {
        //   const n = newSelectionCount;
        //   for (let i = 0; i < n; ++i) {
        //     const p = newSelectionIndices[i];
        //     scale[p] = POINT_SCALE_NEW_SELECTION;
        //   }
        // }
        // {
        //   const n = selectedNewSelectionCount;
        //   for (let i = 0; i < n; ++i) {
        //     const p = selectedNewSelectionIndices[i];
        //     scale[p] = POINT_SCALE_SELECTED_NEW_SELECTION;
        //   }
        // }
        // Scale up the hover point.
        if (hoverPointIndex != null) {
            scale[hoverPointIndex] = POINT_SCALE_HOVER;
        }
        // if (hoverNewSelectionPointIndex != null) {
        //   scale[hoverNewSelectionPointIndex] = POINT_SCALE_HOVER_NEW_SELECTION;
        // }
        return scale;
    }
    generateLineSegmentColorMap(ds, legendPointColorer) {
        let polylineColorArrayMap = {};
        if (ds == null) {
            return polylineColorArrayMap;
        }
        for (let i = 0; i < ds.sequences.length; i++) {
            let sequence = ds.sequences[i];
            let colors = new Float32Array(2 * (sequence.pointIndices.length - 1) * 3);
            let colorIndex = 0;
            if (legendPointColorer) {
                for (let j = 0; j < sequence.pointIndices.length - 1; j++) {
                    const c1 = new THREE.Color(legendPointColorer(ds, sequence.pointIndices[j]));
                    const c2 = new THREE.Color(legendPointColorer(ds, sequence.pointIndices[j + 1]));
                    colors[colorIndex++] = c1.r;
                    colors[colorIndex++] = c1.g;
                    colors[colorIndex++] = c1.b;
                    colors[colorIndex++] = c2.r;
                    colors[colorIndex++] = c2.g;
                    colors[colorIndex++] = c2.b;
                }
            }
            else {
                for (let j = 0; j < sequence.pointIndices.length - 1; j++) {
                    const c1 = getDefaultPointInPolylineColor(j, sequence.pointIndices.length);
                    const c2 = getDefaultPointInPolylineColor(j + 1, sequence.pointIndices.length);
                    colors[colorIndex++] = c1.r;
                    colors[colorIndex++] = c1.g;
                    colors[colorIndex++] = c1.b;
                    colors[colorIndex++] = c2.r;
                    colors[colorIndex++] = c2.g;
                    colors[colorIndex++] = c2.b;
                }
            }
            polylineColorArrayMap[i] = colors;
        }
        return polylineColorArrayMap;
    }
    generateLineSegmentOpacityArray(ds, selectedPoints) {
        if (ds == null) {
            return new Float32Array(0);
        }
        const opacities = new Float32Array(ds.sequences.length);
        const selectedPointCount = selectedPoints == null ? 0 : selectedPoints.length;
        if (selectedPointCount > 0) {
            opacities.fill(POLYLINE_DESELECTED_OPACITY);
            if (ds.points[selectedPoints[0]] !== undefined) {
                const i = ds.points[selectedPoints[0]].sequenceIndex;
                opacities[i] = POLYLINE_SELECTED_OPACITY;
            }
        }
        else {
            opacities.fill(POLYLINE_DEFAULT_OPACITY);
        }
        return opacities;
    }
    generateLineSegmentWidthArray(ds, selectedPoints) {
        if (ds == null) {
            return new Float32Array(0);
        }
        const widths = new Float32Array(ds.sequences.length);
        widths.fill(POLYLINE_DEFAULT_LINEWIDTH);
        const selectedPointCount = selectedPoints == null ? 0 : selectedPoints.length;
        if (selectedPointCount > 0) {
            if (ds.points[selectedPoints[0]]) {
                const i = ds.points[selectedPoints[0]].sequenceIndex;
                widths[i] = POLYLINE_SELECTED_LINEWIDTH;
            }
        }
        return widths;
    }
    generatePointColorArray(ds, legendPointColorer, distFunc, selectedPointIndices, neighborsOfFirstPoint, hoverPointIndex, label3dMode, spriteImageMode, renderInTriangle, renderInTraceLine) {
        var _a;
        if (ds == null) {
            return new Float32Array(0);
        }
        const selectedPointCount = selectedPointIndices == null ? 0 : selectedPointIndices.length;
        const neighborCount = neighborsOfFirstPoint == null ? 0 : neighborsOfFirstPoint.length;
        const colors = new Float32Array(ds.points.length * 3);
        let unselectedColor = POINT_COLOR_UNSELECTED;
        let noSelectionColor = POINT_COLOR_NO_SELECTION;
        if (label3dMode) {
            unselectedColor = LABELS_3D_COLOR_UNSELECTED;
            noSelectionColor = LABELS_3D_COLOR_NO_SELECTION;
        }
        if (spriteImageMode) {
            unselectedColor = SPRITE_IMAGE_COLOR_UNSELECTED;
            noSelectionColor = SPRITE_IMAGE_COLOR_NO_SELECTION;
        }
        // Give all points the unselected color.
        {
            const n = ds.points.length;
            let dst = 0;
            if (selectedPointCount >= 0) {
                for (let i = 0; i < n; ++i) {
                    let point = ds.points[i];
                    let c = new THREE.Color(point.color);
                    //filter之后 只有unlabel无颜色
                    if (window.properties && window.properties[window.iteration] && window.properties[window.iteration][i] === 1) {
                        c = new THREE.Color(unselectedColor);
                    }
                    colors[dst++] = c.r;
                    colors[dst++] = c.g;
                    colors[dst++] = c.b;
                }
            }
            else {
                if (legendPointColorer != null) {
                    for (let i = 0; i < n; ++i) {
                        let c = new THREE.Color(legendPointColorer(ds, i));
                        // if (window.unLabelData?.length) {
                        //   if (window.unLabelData.indexOf(i) !== -1) {
                        //     c = new THREE.Color(POINT_COLOR_UNSELECTED);
                        //   }
                        // }
                        colors[dst++] = c.r;
                        colors[dst++] = c.g;
                        colors[dst++] = c.b;
                    }
                }
                else {
                    const c = new THREE.Color(noSelectionColor);
                    for (let i = 0; i < n; ++i) {
                        colors[dst++] = c.r;
                        colors[dst++] = c.g;
                        colors[dst++] = c.b;
                    }
                }
            }
        }
        // if (window.unLabelData?.length) {
        //   const n = ds.points.length;
        //   let c = new THREE.Color(POINT_COLOR_UNSELECTED);
        //   for (let i = 0; i < n; i++) {
        //     if (window.unLabelData.indexOf(i) >= 0) {
        //       let dst = i * 3
        //       colors[dst++] = c.r;
        //       colors[dst++] = c.g;
        //       colors[dst++] = c.b;
        //     }
        //   }
        // }
        // Color the selected points.
        {
            const n = selectedPointCount;
            const c = new THREE.Color(POINT_COLOR_SELECTED);
            if (window.isAnimatating) {
                for (let i = 0; i < n; ++i) {
                    const c = new THREE.Color(ds.points[i].color);
                    let dst = selectedPointIndices[i] * 3;
                    colors[dst++] = c.r;
                    colors[dst++] = c.g;
                    colors[dst++] = c.b;
                }
            }
            else {
                for (let i = 0; i < n; ++i) {
                    let dst = selectedPointIndices[i] * 3;
                    colors[dst++] = c.r;
                    colors[dst++] = c.g;
                    colors[dst++] = c.b;
                }
            }
        }
        // Color the neighbors.
        {
            const n = neighborCount;
            let minDist = n > 0 ? neighborsOfFirstPoint[0].dist : 0;
            for (let i = 0; i < n; ++i) {
                const c = new THREE.Color(dist2color(distFunc, neighborsOfFirstPoint[i].dist, minDist));
                let dst = neighborsOfFirstPoint[i].index * 3;
                colors[dst++] = c.r;
                colors[dst++] = c.g;
                colors[dst++] = c.b;
            }
        }
        // Color the unlabeled points.
        //     if (window.isFilter) {
        //       let dst = 0;
        //       const c = new THREE.Color(POINT_COLOR_SELECTED);
        //       const c_n = new THREE.Color(unselectedColor);
        //       const c_w = new THREE.Color(0xffffff);
        //       for (let i = 0; i < ds.points.length; ++i) {
        //         const point = ds.points[i];
        //         colors[dst++] = c.r;
        //         colors[dst++] = c.g;
        //         colors[dst++] = c.b;
        //         if (point.metadata[this.labelPointAccessor]) {
        //           let hoverText = point.metadata[this.labelPointAccessor].toString();
        //           if (hoverText == 'background') {
        //             if (window.hiddenBackground) {
        //               let dst = i * 3
        //               colors[dst++] = c_w.r;
        //               colors[dst++] = c_w.g;
        //               colors[dst++] = c_w.b;
        //             } else {
        //               let dst = i * 3
        //               colors[dst++] = c_n.r;
        //               colors[dst++] = c_n.g;
        //               colors[dst++] = c_n.b;
        //             }
        //           }
        //         }
        //       }
        //       // return colors
        //     }
        //
        // if (window.isAnimatating) {
        //   const n = ds.points.length;
        //   const c = new THREE.Color(POINT_COLOR_UNSELECTED);
        //   for (let i = 0; i < n; ++i) {
        //     if (selectedPointIndices.indexOf(i) === -1) {
        //       let dst = i * 3;
        //       colors[dst++] = c.r;
        //       colors[dst++] = c.g;
        //       colors[dst++] = c.b;
        //     } else {
        //       const c = new THREE.Color(ds.points[i].color);
        //       let dst = i * 3;
        //       colors[dst++] = c.r;
        //       colors[dst++] = c.g;
        //       colors[dst++] = c.b;
        //     }
        //   }
        // }
        if (!window.isAnimatating && ((_a = window.customSelection) === null || _a === void 0 ? void 0 : _a.length) && window.isAdjustingSel) {
            const n = ds.points.length;
            let c = new THREE.Color(POINT_CUSTOM_SELECTED);
            for (let i = 0; i < n; i++) {
                if (window.customSelection.indexOf(i) >= 0) {
                    let dst = i * 3;
                    colors[dst++] = c.r;
                    colors[dst++] = c.g;
                    colors[dst++] = c.b;
                }
            }
        }
        // Color the hover point.
        // if (hoverPointIndex != null) {
        //   let c = new THREE.Color(POINT_COLOR_HOVER);
        //   let dst = hoverPointIndex * 3;
        //   colors[dst++] = c.r;
        //   colors[dst++] = c.g;
        //   colors[dst++] = c.b;
        // }
        return colors;
    }
    generate3DLabelsArray(ds, accessor) {
        if (ds == null || accessor == null) {
            return null;
        }
        let labels = [];
        const n = ds.points.length;
        for (let i = 0; i < n; ++i) {
            labels.push(this.getLabelText(ds, i, accessor));
        }
        return labels;
    }
    getLabelText(ds, i, accessor) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        if ((_a = window.customSelection) === null || _a === void 0 ? void 0 : _a.length) {
            if (window.rejectIndicates && window.rejectIndicates.indexOf(i) >= 0) {
                return `❌ ${i}`;
            }
            if (window.acceptIndicates && window.acceptIndicates.indexOf(i) >= 0) {
                return `✅ ${i}`;
            }
        }
        if (((_b = window.queryResAnormalIndecates) === null || _b === void 0 ? void 0 : _b.length) && window.queryResAnormalIndecates.indexOf(i) >= 0) {
            if (window.isAnimatating && window.customSelection.indexOf(i) == -1) {
                return ``;
            }
            else {
                return `👍${i}`;
            }
        }
        if ((_c = window.queryResAnormalCleanIndecates) === null || _c === void 0 ? void 0 : _c.length) {
            if (window.queryResAnormalCleanIndecates.indexOf(i) >= 0) {
                return `🟢clean`;
            }
        }
        if ((_d = window.alQueryResPointIndices) === null || _d === void 0 ? void 0 : _d.length) {
            if (((_e = window.alQueryResPointIndices) === null || _e === void 0 ? void 0 : _e.indexOf(i)) !== -1) {
                return `👍 ${i}`;
            }
        }
        if ((_f = window.queryResPointIndices) === null || _f === void 0 ? void 0 : _f.length) {
            if (((_g = window.queryResPointIndices) === null || _g === void 0 ? void 0 : _g.indexOf(i)) !== -1) {
                // return ds.points[i]?.metadata[accessor] !== undefined
                //   ? (ds.points[i]?.metadata[accessor] !== "background" ? String(ds.points[i]?.metadata[accessor]) : "")
                //   : `Unknown #${i}`;
                return `${i}`;
            }
        }
        if (window.isAdjustingSel && window.sessionStorage.isControlGroup !== 'true') {
            if (((_h = ds.points[i]) === null || _h === void 0 ? void 0 : _h.metadata[accessor]) !== undefined && ((_j = ds.points[i]) === null || _j === void 0 ? void 0 : _j.current_prediction) !== ((_k = ds.points[i]) === null || _k === void 0 ? void 0 : _k.metadata[accessor])) {
                return ` ${i}`;
            }
        }
        if (window.properties && ((_l = window.properties[window.iteration]) === null || _l === void 0 ? void 0 : _l.length)) {
            if (window.properties[window.iteration][i] === 1) {
                return `#${i}`;
            }
        }
        return `${i}`;
        // return ds.points[i]?.metadata[accessor] !== undefined
        //   ? (ds.points[i]?.metadata[accessor] !== "background" ? String(ds.points[i]?.metadata[accessor]) : "")
        //   : `Unknown #${i}`;
    }
    updateScatterPlotWithNewProjection(projection) {
        if (projection == null) {
            this.createVisualizers(this.renderLabelsIn3D);
            this.scatterPlot.render();
            return;
        }
        this.setDataSet(projection.dataSet);
        this.scatterPlot.setDimensions(projection.dimensionality);
        if (projection.dataSet.projectionCanBeRendered(projection.projectionType)) {
            this.updateScatterPlotAttributes();
            this.notifyProjectionPositionsUpdated();
        }
        this.scatterPlot.setCameraParametersForNextCameraCreation(null, false);
    }
    createVisualizers(inLabels3DMode, renderInTriangle) {
        const ds = this.projection == null ? null : this.projection.dataSet;
        const scatterPlot = this.scatterPlot;
        scatterPlot.removeAllVisualizers();
        this.labels3DVisualizer = null;
        this.canvasLabelsVisualizer = null;
        this.spriteVisualizer = null;
        this.polylineVisualizer = null;
        // this.triangles = new scatterPlotVisualizerTriangles();
        // this.triangles.setSelectedPoint(this.selectedPointIndices);
        this.spriteVisualizer = new ScatterPlotVisualizerSprites();
        if (inLabels3DMode) {
            this.labels3DVisualizer = new ScatterPlotVisualizer3DLabels();
            this.labels3DVisualizer.setLabelStrings(this.generate3DLabelsArray(ds, this.labelPointAccessor));
        }
        else if (renderInTriangle) {
            scatterPlot.addVisualizer(this.spriteVisualizer);
            this.triangles = new scatterPlotVisualizerTriangles();
            this.triangles.setSelectedPoint(this.selectedPointIndices);
            this.canvasLabelsVisualizer = new ScatterPlotVisualizerCanvasLabels(this.scatterPlotContainer);
            // this.triangles.setLabelStrings(
            //   this.generate3DLabelsArray(ds, this.labelPointAccessor)
            // );
        }
        else if (this.renderInTraceLine) {
            this.traceLine = new scatterPlotVisualizerTraceLine();
            this.traceLine.setEpoches(this.traceLineEpoch);
            this.traceLine.setSelectedPoint(this.selectedPointIndices);
            this.canvasLabelsVisualizer = new ScatterPlotVisualizerCanvasLabels(this.scatterPlotContainer);
        }
        else {
            scatterPlot.addVisualizer(this.spriteVisualizer);
            this.triangles = new scatterPlotVisualizerTriangles();
            this.triangles.setSelectedPoint(this.selectedPointIndices);
            this.canvasLabelsVisualizer = new ScatterPlotVisualizerCanvasLabels(this.scatterPlotContainer);
        }
        this.polylineVisualizer = new ScatterPlotVisualizerPolylines();
        this.setDataSet(ds);
        if (this.spriteVisualizer) {
            scatterPlot.addVisualizer(this.spriteVisualizer);
        }
        if (this.labels3DVisualizer) {
            scatterPlot.addVisualizer(this.labels3DVisualizer);
        }
        if (this.renderInTriangle) {
            scatterPlot.addVisualizer(this.triangles);
        }
        if (this.renderInTraceLine) {
            scatterPlot.addVisualizer(this.traceLine);
        }
        if (this.canvasLabelsVisualizer) {
            scatterPlot.addVisualizer(this.canvasLabelsVisualizer);
        }
        scatterPlot.addVisualizer(this.polylineVisualizer);
    }
    getSpriteImageMode() {
        return false;
        if (this.projection == null) {
            return false;
        }
        const ds = this.projection.dataSet;
        if (ds == null || ds.spriteAndMetadataInfo == null) {
            return false;
        }
        return ds.spriteAndMetadataInfo.spriteImage != null;
    }
}
function packRgbIntoUint8Array(rgbArray, labelIndex, r, g, b) {
    rgbArray[labelIndex * 3] = r;
    rgbArray[labelIndex * 3 + 1] = g;
    rgbArray[labelIndex * 3 + 2] = b;
}
function styleRgbFromHexColor(hex) {
    const c = new THREE.Color(hex);
    return [(c.r * 255) | 0, (c.g * 255) | 0, (c.b * 255) | 0];
}
function getDefaultPointInPolylineColor(index, totalPoints) {
    let hue = POLYLINE_START_HUE +
        ((POLYLINE_END_HUE - POLYLINE_START_HUE) * index) / totalPoints;
    let rgb = d3.hsl(hue, POLYLINE_SATURATION, POLYLINE_LIGHTNESS).rgb();
    return new THREE.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255);
}
/**
 * Normalizes the distance so it can be visually encoded with color.
 * The normalization depends on the distance metric (cosine vs euclidean).
 */
export function normalizeDist(distFunc, d, minDist) {
    return distFunc === vector.dist ? minDist / d : 1 - d;
}
/** Normalizes and encodes the provided distance with color. */
export function dist2color(distFunc, d, minDist) {
    return NN_COLOR_SCALE(normalizeDist(distFunc, d, minDist));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVuc29yYm9hcmQvcHJvamVjdG9yL3Byb2plY3RvclNjYXR0ZXJQbG90QWRhcHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7OztnRkFhZ0Y7QUFDaEYsT0FBTyxLQUFLLEtBQUssTUFBTSxPQUFPLENBQUM7QUFDL0IsT0FBTyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFVekIsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDcEQsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUM1QyxPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUM5RSxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNoRixPQUFPLEVBQUUsOEJBQThCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQTtBQUNqRixPQUFPLEVBQUUsaUNBQWlDLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN4RixPQUFPLEVBQUUsOEJBQThCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRixPQUFPLEVBQUUsOEJBQThCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUVsRixPQUFPLEtBQUssTUFBTSxNQUFNLFVBQVUsQ0FBQztBQUVuQyxNQUFNLGVBQWUsR0FBRyxFQUFFLENBQUM7QUFDM0IsTUFBTSxtQkFBbUIsR0FBRyxHQUFHLENBQUM7QUFDaEMsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLENBQUM7QUFDNUIsTUFBTSx3QkFBd0IsR0FBRyxLQUFLLENBQUM7QUFDdkMsTUFBTSwwQkFBMEIsR0FBRyxLQUFLLENBQUM7QUFFekMsTUFBTSx5QkFBeUIsR0FBRyxVQUFVLENBQUM7QUFDN0MsTUFBTSwyQkFBMkIsR0FBRyxRQUFRLENBQUM7QUFHN0MsNkNB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UmlnaHRzIFJlc2VydmVkLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5pbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgKiBhcyBkMyBmcm9tICdkMyc7XG5cbmltcG9ydCB7XG4gIERhdGFTZXQsXG4gIERpc3RhbmNlRnVuY3Rpb24sXG4gIFByb2plY3Rpb24sXG4gIFN0YXRlLFxuICBQcm9qZWN0aW9uQ29tcG9uZW50czNELFxufSBmcm9tICcuL2RhdGEnO1xuaW1wb3J0IHsgUHJvamVjdG9yRXZlbnRDb250ZXh0IH0gZnJvbSAnLi9wcm9qZWN0b3JFdmVudENvbnRleHQnO1xuaW1wb3J0IHsgTGFiZWxSZW5kZXJQYXJhbXMgfSBmcm9tICcuL3JlbmRlckNvbnRleHQnO1xuaW1wb3J0IHsgU2NhdHRlclBsb3QgfSBmcm9tICcuL3NjYXR0ZXJQbG90JztcbmltcG9ydCB7IFNjYXR0ZXJQbG90VmlzdWFsaXplclNwcml0ZXMgfSBmcm9tICcuL3NjYXR0ZXJQbG90VmlzdWFsaXplclNwcml0ZXMnO1xuaW1wb3J0IHsgU2NhdHRlclBsb3RWaXN1YWxpemVyM0RMYWJlbHMgfSBmcm9tICcuL3NjYXR0ZXJQbG90VmlzdWFsaXplcjNETGFiZWxzJztcbmltcG9ydCB7IHNjYXR0ZXJQbG90VmlzdWFsaXplclRyaWFuZ2xlcyB9IGZyb20gJy4vc2NhdHRlclBsb3RWaXN1YWxpemVyVHJpYW5nbGVzJ1xuaW1wb3J0IHsgU2NhdHRlclBsb3RWaXN1YWxpemVyQ2FudmFzTGFiZWxzIH0gZnJvbSAnLi9zY2F0dGVyUGxvdFZpc3VhbGl6ZXJDYW52YXNMYWJlbHMnO1xuaW1wb3J0IHsgU2NhdHRlclBsb3RWaXN1YWxpemVyUG9seWxpbmVzIH0gZnJvbSAnLi9zY2F0dGVyUGxvdFZpc3VhbGl6ZXJQb2x5bGluZXMnO1xuaW1wb3J0IHsgc2NhdHRlclBsb3RWaXN1YWxpemVyVHJhY2VMaW5lIH0gZnJvbSAnLi9zY2F0dGVyUGxvdFZpc3VhbGl6ZXJUcmFjZUxpbmUnO1xuaW1wb3J0ICogYXMga25uIGZyb20gJy4va25uJztcbmltcG9ydCAqIGFzIHZlY3RvciBmcm9tICcuL3ZlY3Rvcic7XG5cbmNvbnN0IExBQkVMX0ZPTlRfU0laRSA9IDEwO1xuY29uc3QgTEFCRUxfU0NBTEVfREVGQVVMVCA9IDEuMDtcbmNvbnN0IExBQkVMX1NDQUxFX0xBUkdFID0gMjtcbmNvbnN0IExBQkVMX0ZJTExfQ09MT1JfQ0hFQ0tFRCA9IDY1MjgwO1xuY29uc3QgTEFCRUxfU1RST0tFX0NPTE9SX0NIRUNLRUQgPSA2NTI4MDtcblxuY29uc3QgTEFCRUxfRklMTF9DT0xPUl9TRUxFQ1RFRCA9IDB4RkY1NjA3MzE7XG5jb25zdCBMQUJFTF9TVFJPS0VfQ09MT1JfU0VMRUNURUQgPSAweGZmZmZmZjtcblxuXG4vLyBjb25zdCBMQUJFTF9GSUxMX0NPTE9SX0hPVkVSID0gMHhGRjU2MDczMTtcbi8vIGNvbnN0IExBQkVMX1NUUk9LRV9DT0xPUl9IT1ZFUiA9IDB4ZmZmZmZmO1xuXG5jb25zdCBMQUJFTF9GSUxMX0NPTE9SX0hPVkVSID0gMTY3NDQxOTI7XG5jb25zdCBMQUJFTF9TVFJPS0VfQ09MT1JfSE9WRVIgPSAxNjc0NDE5MjtcblxuY29uc3QgTEFCRUxfRklMTF9DT0xPUl9ORUlHSEJPUiA9IDB4MDAwMDAwO1xuXG5jb25zdCBMQUJFTF9TVFJPS0VfQ09MT1JfTkVJR0hCT1IgPSAweGZmZmZmZjtcblxuY29uc3QgUE9JTlRfQ09MT1JfVU5TRUxFQ1RFRCA9IDB4ZTNlM2UzO1xuY29uc3QgUE9JTlRfQ09MT1JfTk9fU0VMRUNUSU9OID0gMHg3NTc1ZDk7XG5jb25zdCBQT0lOVF9DT0xPUl9TRUxFQ1RFRCA9IDB4ZmE2NjY2O1xuY29uc3QgUE9JTlRfQ09MT1JfVU5MQUJFTEVEID0gMTY3NzY5NjA7XG5jb25zdCBQT0lOVF9DT0xPUl9IT1ZFUiA9IDczOTYyNDM7XG5cbmNvbnN0IFBPSU5UX1NDQUxFX0RFRkFVTFQgPSAxLjI7XG5jb25zdCBQT0lOVF9TQ0FMRV9TRUxFQ1RFRCA9IDIuMDtcbmNvbnN0IFBPSU5UX1NDQUxFX05FSUdIQk9SID0gMS4yO1xuY29uc3QgUE9JTlRfU0NBTEVfSE9WRVIgPSAyLjU7XG5jb25zdCBQT0lOVF9TQ0FMRV9ORVdfU0VMRUNUSU9OID0gMjtcbmNvbnN0IFBPSU5UX1NDQUxFX1NFTEVDVEVEX05FV19TRUxFQ1RJT04gPSAyLjQ7XG5jb25zdCBQT0lOVF9TQ0FMRV9IT1ZFUl9ORVdfU0VMRUNUSU9OID0gMi40O1xuXG5jb25zdCBMQUJFTFNfM0RfQ09MT1JfVU5TRUxFQ1RFRCA9IDB4ZmZmZmZmO1xuY29uc3QgTEFCRUxTXzNEX0NPTE9SX05PX1NFTEVDVElPTiA9IDB4ZmZmZmZmO1xuXG5jb25zdCBUSVJfQ09MT1JfVU5TRUxFQ1RFRCA9IDB4ZTNlM2UzO1xuY29uc3QgVElSX0NPTE9SX1NFTEVDVEVEID0gMHhmYTY2NjY7XG5cbmNvbnN0IFNQUklURV9JTUFHRV9DT0xPUl9VTlNFTEVDVEVEID0gMHhmZmZmZmY7XG5jb25zdCBTUFJJVEVfSU1BR0VfQ09MT1JfTk9fU0VMRUNUSU9OID0gMHhmZmZmZmY7XG5jb25zdCBQT0lOVF9DVVNUT01fU0VMRUNURUQgPSAzMzI5MzMwXG5cbmNvbnN0IEhJRERFTl9CQUNLR1JPVU5EX0NPTE9SID0gMHhmZmZmZmZcblxuY29uc3QgUE9MWUxJTkVfU1RBUlRfSFVFID0gNjA7XG5jb25zdCBQT0xZTElORV9FTkRfSFVFID0gMzYwO1xuY29uc3QgUE9MWUxJTkVfU0FUVVJBVElPTiA9IDE7XG5jb25zdCBQT0xZTElORV9MSUdIVE5FU1MgPSAwLjM7XG5cbmNvbnN0IFBPTFlMSU5FX0RFRkFVTFRfT1BBQ0lUWSA9IDAuMjtcbmNvbnN0IFBPTFlMSU5FX0RFRkFVTFRfTElORVdJRFRIID0gMjtcbmNvbnN0IFBPTFlMSU5FX1NFTEVDVEVEX09QQUNJVFkgPSAwLjk7XG5jb25zdCBQT0xZTElORV9TRUxFQ1RFRF9MSU5FV0lEVEggPSAzO1xuY29uc3QgUE9MWUxJTkVfREVTRUxFQ1RFRF9PUEFDSVRZID0gMC4wNTtcblxuY29uc3QgU0NBVFRFUl9QTE9UX0NVQkVfTEVOR1RIID0gMjtcblxuLyoqIENvbG9yIHNjYWxlIGZvciBuZWFyZXN0IG5laWdoYm9ycy4gKi9cbmNvbnN0IE5OX0NPTE9SX1NDQUxFID0gZDNcbiAgLnNjYWxlTGluZWFyPHN0cmluZywgc3RyaW5nPigpXG4gIC5kb21haW4oWzEsIDAuNywgMC40XSlcbiAgLnJhbmdlKFsnaHNsKDI4NSwgODAlLCA0MCUpJywgJ2hzbCgwLCA4MCUsIDY1JSknLCAnaHNsKDQwLCA3MCUsIDYwJSknXSlcbiAgLmNsYW1wKHRydWUpO1xuLyoqXG4gKiBJbnRlcnByZXRzIHByb2plY3RvciBldmVudHMgYW5kIGFzc2VtYmVzIHRoZSBhcnJheXMgYW5kIGNvbW1hbmRzIG5lY2Vzc2FyeVxuICogdG8gdXNlIHRoZSBTY2F0dGVyUGxvdCB0byByZW5kZXIgdGhlIGN1cnJlbnQgcHJvamVjdGVkIGRhdGEgc2V0LlxuICovXG5leHBvcnQgY2xhc3MgUHJvamVjdG9yU2NhdHRlclBsb3RBZGFwdGVyIHtcbiAgcHVibGljIHNjYXR0ZXJQbG90OiBTY2F0dGVyUGxvdDtcbiAgcHJpdmF0ZSBwcm9qZWN0aW9uOiBQcm9qZWN0aW9uO1xuICBwcml2YXRlIGhvdmVyUG9pbnRJbmRleDogbnVtYmVyO1xuICBwcml2YXRlIHNlbGVjdGVkUG9pbnRJbmRpY2VzOiBudW1iZXJbXTtcbiAgLy8gcHJpdmF0ZSBuZXdTZWxlY3Rpb25JbmRpY2VzOiBhbnlbXTtcbiAgcHJpdmF0ZSBuZWlnaGJvcnNPZkZpcnN0U2VsZWN0ZWRQb2ludDoga25uLk5lYXJlc3RFbnRyeVtdO1xuICBwcml2YXRlIHJlbmRlckxhYmVsc0luM0Q6IGJvb2xlYW4gPSBmYWxzZTtcbiAgcHJpdmF0ZSBsYWJlbFBvaW50QWNjZXNzb3I6IHN0cmluZztcbiAgcHJpdmF0ZSBsZWdlbmRQb2ludENvbG9yZXI6IChkczogRGF0YVNldCwgaW5kZXg6IG51bWJlcikgPT4gc3RyaW5nO1xuICBwcml2YXRlIGRpc3RhbmNlTWV0cmljOiBEaXN0YW5jZUZ1bmN0aW9uO1xuICBwcml2YXRlIHNwcml0ZVZpc3VhbGl6ZXI6IFNjYXR0ZXJQbG90VmlzdWFsaXplclNwcml0ZXM7XG4gIHByaXZhdGUgbGFiZWxzM0RWaXN1YWxpemVyOiBTY2F0dGVyUGxvdFZpc3VhbGl6ZXIzRExhYmVscztcbiAgcHJpdmF0ZSB0cmlhbmdsZXM6IHNjYXR0ZXJQbG90VmlzdWFsaXplclRyaWFuZ2xlcztcbiAgcHJpdmF0ZSByZW5kZXJJblRyaWFuZ2xlOiBib29sZWFuID0gZmFsc2U7XG4gIHByaXZhdGUgdHJhY2VMaW5lRXBvY2g6IGFueVxuXG4gIHByaXZhdGUgdHJhY2VMaW5lOiBzY2F0dGVyUGxvdFZpc3VhbGl6ZXJUcmFjZUxpbmU7XG4gIHByaXZhdGUgcmVuZGVySW5UcmFjZUxpbmU6IGJvb2xlYW4gPSBmYWxzZVxuXG4gIHByaXZhdGUgY2FudmFzTGFiZWxzVmlzdWFsaXplcjogU2NhdHRlclBsb3RWaXN1YWxpemVyQ2FudmFzTGFiZWxzO1xuICBwcml2YXRlIHBvbHlsaW5lVmlzdWFsaXplcjogU2NhdHRlclBsb3RWaXN1YWxpemVyUG9seWxpbmVzO1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHNjYXR0ZXJQbG90Q29udGFpbmVyOiBIVE1MRWxlbWVudCxcbiAgICBwcm9qZWN0b3JFdmVudENvbnRleHQ6IFByb2plY3RvckV2ZW50Q29udGV4dFxuICApIHtcbiAgICB0aGlzLnNjYXR0ZXJQbG90ID0gbmV3IFNjYXR0ZXJQbG90KFxuICAgICAgc2NhdHRlclBsb3RDb250YWluZXIsXG4gICAgICBwcm9qZWN0b3JFdmVudENvbnRleHRcbiAgICApO1xuICAgIHByb2plY3RvckV2ZW50Q29udGV4dC5yZWdpc3RlclByb2plY3Rpb25DaGFuZ2VkTGlzdGVuZXIoKHByb2plY3Rpb24pID0+IHtcbiAgICAgIHRoaXMucHJvamVjdGlvbiA9IHByb2plY3Rpb247XG4gICAgICB0aGlzLnVwZGF0ZVNjYXR0ZXJQbG90V2l0aE5ld1Byb2plY3Rpb24ocHJvamVjdGlvbik7XG4gICAgfSk7XG4gICAgcHJvamVjdG9yRXZlbnRDb250ZXh0LnJlZ2lzdGVyU2VsZWN0aW9uQ2hhbmdlZExpc3RlbmVyKFxuICAgICAgKHNlbGVjdGVkUG9pbnRJbmRpY2VzLCBuZWlnaGJvcnMpID0+IHtcbiAgICAgICAgdGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcyA9IHNlbGVjdGVkUG9pbnRJbmRpY2VzO1xuICAgICAgICB0aGlzLm5laWdoYm9yc09mRmlyc3RTZWxlY3RlZFBvaW50ID0gbmVpZ2hib3JzO1xuICAgICAgICBpZiAodGhpcy5yZW5kZXJJblRyaWFuZ2xlKSB7XG4gICAgICAgICAgaWYgKHRoaXMudHJpYW5nbGVzKSB7XG4gICAgICAgICAgICB0aGlzLnRyaWFuZ2xlcy5zZXRTZWxlY3RlZFBvaW50KHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMpO1xuICAgICAgICAgICAgdGhpcy50cmlhbmdsZXMuc2V0VW5MYWJlbGVkSW5kZXgod2luZG93LnVuTGFiZWxEYXRhKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMucmVuZGVySW5UcmFjZUxpbmUpIHtcbiAgICAgICAgICBpZiAodGhpcy50cmFjZUxpbmUpIHtcbiAgICAgICAgICAgIHRoaXMudHJhY2VMaW5lLnNldEVwb2NoZXModGhpcy50cmFjZUxpbmVFcG9jaClcbiAgICAgICAgICAgIHRoaXMudHJhY2VMaW5lLnNldFNlbGVjdGVkUG9pbnQodGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcylcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy51cGRhdGVTY2F0dGVyUGxvdFBvc2l0aW9ucygpO1xuICAgICAgICB0aGlzLnVwZGF0ZVNjYXR0ZXJQbG90QXR0cmlidXRlcygpO1xuICAgICAgICB0aGlzLnNjYXR0ZXJQbG90LnJlbmRlcigpO1xuICAgICAgfVxuICAgICk7XG4gICAgcHJvamVjdG9yRXZlbnRDb250ZXh0LnJlZ2lzdGVySG92ZXJMaXN0ZW5lcigoaG92ZXJQb2ludEluZGV4KSA9PiB7XG4gICAgICB0aGlzLmhvdmVyUG9pbnRJbmRleCA9IGhvdmVyUG9pbnRJbmRleDtcbiAgICAgIHRoaXMudXBkYXRlU2NhdHRlclBsb3RBdHRyaWJ1dGVzKCk7XG4gICAgICB0aGlzLnNjYXR0ZXJQbG90LnJlbmRlcigpO1xuICAgIH0pO1xuICAgIHByb2plY3RvckV2ZW50Q29udGV4dC5yZWdpc3RlckRpc3RhbmNlTWV0cmljQ2hhbmdlZExpc3RlbmVyKFxuICAgICAgKGRpc3RhbmNlTWV0cmljKSA9PiB7XG4gICAgICAgIHRoaXMuZGlzdGFuY2VNZXRyaWMgPSBkaXN0YW5jZU1ldHJpYztcbiAgICAgICAgdGhpcy51cGRhdGVTY2F0dGVyUGxvdEF0dHJpYnV0ZXMoKTtcbiAgICAgICAgdGhpcy5zY2F0dGVyUGxvdC5yZW5kZXIoKTtcbiAgICAgIH1cbiAgICApO1xuICAgIHRoaXMuY3JlYXRlVmlzdWFsaXplcnMoZmFsc2UpO1xuICB9XG4gIC8vIG5vdGlmeVByb2plY3Rpb25Qb3NpdGlvbnNVcGRhdGVkKG5ld1NlbGVjdGlvbj86IGFueVtdKSB7XG4gIG5vdGlmeVByb2plY3Rpb25Qb3NpdGlvbnNVcGRhdGVkKCkge1xuICAgIC8vIGlmKG5ld1NlbGVjdGlvbiAhPSB1bmRlZmluZWQpIHtcbiAgICAvLyAgIHRoaXMubmV3U2VsZWN0aW9uSW5kaWNlcyA9IG5ld1NlbGVjdGlvbjtcbiAgICAvLyB9XG4gICAgdGhpcy51cGRhdGVTY2F0dGVyUGxvdFBvc2l0aW9ucygpO1xuICAgIHRoaXMudXBkYXRlU2NhdHRlclBsb3RBdHRyaWJ1dGVzKCk7XG4gICAgdGhpcy5zY2F0dGVyUGxvdC5yZW5kZXIoKTtcbiAgfVxuICB1cGRhdGVUcmlhbmdsZSgpIHtcbiAgICB0aGlzLnRyaWFuZ2xlcy5jcmVhdGVUcmlhbmdsZXMoKVxuICB9XG4gIHNldERhdGFTZXQoZGF0YVNldDogRGF0YVNldCkge1xuICAgIGlmICh0aGlzLnByb2plY3Rpb24gIT0gbnVsbCkge1xuICAgICAgLy8gVE9ETyhAY2hhcmxlc25pY2hvbHNvbik6IHNldERhdGFTZXQgbmVlZHMgdG8gZ28gYXdheSwgdGhlIHByb2plY3Rpb24gaXMgdGhlXG4gICAgICAvLyBhdG9taWMgdW5pdCBvZiB1cGRhdGUuXG4gICAgICB0aGlzLnByb2plY3Rpb24uZGF0YVNldCA9IGRhdGFTZXQ7XG4gICAgfVxuICAgIGlmICh0aGlzLnBvbHlsaW5lVmlzdWFsaXplciAhPSBudWxsKSB7XG4gICAgICB0aGlzLnBvbHlsaW5lVmlzdWFsaXplci5zZXREYXRhU2V0KGRhdGFTZXQpO1xuICAgIH1cbiAgICBpZiAodGhpcy5sYWJlbHMzRFZpc3VhbGl6ZXIgIT0gbnVsbCkge1xuICAgICAgdGhpcy5sYWJlbHMzRFZpc3VhbGl6ZXIuc2V0TGFiZWxTdHJpbmdzKFxuICAgICAgICB0aGlzLmdlbmVyYXRlM0RMYWJlbHNBcnJheShkYXRhU2V0LCB0aGlzLmxhYmVsUG9pbnRBY2Nlc3NvcilcbiAgICAgICk7XG4gICAgfVxuICAgIGlmICh0aGlzLnNwcml0ZVZpc3VhbGl6ZXIgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnNwcml0ZVZpc3VhbGl6ZXIuY2xlYXJTcHJpdGVBdGxhcygpO1xuICAgIGlmIChkYXRhU2V0ID09IG51bGwgfHwgZGF0YVNldC5zcHJpdGVBbmRNZXRhZGF0YUluZm8gPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBtZXRhZGF0YSA9IGRhdGFTZXQuc3ByaXRlQW5kTWV0YWRhdGFJbmZvO1xuICAgIGlmIChtZXRhZGF0YS5zcHJpdGVJbWFnZSA9PSBudWxsIHx8IG1ldGFkYXRhLnNwcml0ZU1ldGFkYXRhID09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gcmV0dXJuO1xuICAgIGNvbnN0IG4gPSBkYXRhU2V0LnBvaW50cy5sZW5ndGg7XG4gICAgY29uc3Qgc3ByaXRlSW5kaWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkobik7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyArK2kpIHtcbiAgICAgIHNwcml0ZUluZGljZXNbaV0gPSBkYXRhU2V0LnBvaW50c1tpXS5pbmRleDtcbiAgICB9XG4gICAgdGhpcy5zcHJpdGVWaXN1YWxpemVyLnNldFNwcml0ZUF0bGFzKFxuICAgICAgbWV0YWRhdGEuc3ByaXRlSW1hZ2UsXG4gICAgICBtZXRhZGF0YS5zcHJpdGVNZXRhZGF0YS5zaW5nbGVJbWFnZURpbSxcbiAgICAgIHNwcml0ZUluZGljZXNcbiAgICApO1xuICB9XG4gIHNldDNETGFiZWxNb2RlKHJlbmRlckxhYmVsc0luM0Q6IGJvb2xlYW4pIHtcbiAgICB0aGlzLnJlbmRlckxhYmVsc0luM0QgPSByZW5kZXJMYWJlbHNJbjNEO1xuICAgIHRoaXMuY3JlYXRlVmlzdWFsaXplcnMocmVuZGVyTGFiZWxzSW4zRCk7XG4gICAgdGhpcy51cGRhdGVTY2F0dGVyUGxvdEF0dHJpYnV0ZXMoKTtcbiAgICB0aGlzLnNjYXR0ZXJQbG90LnJlbmRlcigpO1xuICB9XG5cbiAgc2V0VHJpYW5nbGVNb2RlKHJlbmRlclRyaWFuZ2xlOiBib29sZWFuKSB7XG4gICAgdGhpcy5yZW5kZXJJblRyaWFuZ2xlID0gcmVuZGVyVHJpYW5nbGVcbiAgICB0aGlzLmNyZWF0ZVZpc3VhbGl6ZXJzKGZhbHNlLCByZW5kZXJUcmlhbmdsZSk7XG4gICAgdGhpcy51cGRhdGVTY2F0dGVyUGxvdEF0dHJpYnV0ZXMoKTtcbiAgICB0aGlzLnNjYXR0ZXJQbG90LnJlbmRlcigpO1xuICB9XG5cbiAgc2V0UmVuZGVySW5UcmFjZUxpbmUocmVuZGVyVHJhY2VMaW5lOiBib29sZWFuKSB7XG4gICAgaWYgKCFyZW5kZXJUcmFjZUxpbmUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdub25lJylcbiAgICB9XG4gICAgdGhpcy5yZW5kZXJJblRyYWNlTGluZSA9IHJlbmRlclRyYWNlTGluZTtcbiAgICB3aW5kb3cuYWxsUmVzUG9zaXRpb25zWzBdXG4gICAgdGhpcy50cmFjZUxpbmVFcG9jaCA9IFt3aW5kb3cuYWxsUmVzUG9zaXRpb25zWzBdLCB3aW5kb3cuYWxsUmVzUG9zaXRpb25zW3dpbmRvdy5hbGxSZXNQb3NpdGlvbnMubGVuZ3RoIC0gMV1dXG4gICAgdGhpcy5jcmVhdGVWaXN1YWxpemVycyhmYWxzZSwgZmFsc2UpO1xuICAgIHRoaXMudXBkYXRlU2NhdHRlclBsb3RBdHRyaWJ1dGVzKCk7XG4gICAgdGhpcy5zY2F0dGVyUGxvdC5yZW5kZXIoKTtcbiAgfVxuICBzZXRMZWdlbmRQb2ludENvbG9yZXIoXG4gICAgbGVnZW5kUG9pbnRDb2xvcmVyOiAoZHM6IERhdGFTZXQsIGluZGV4OiBudW1iZXIpID0+IHN0cmluZ1xuICApIHtcbiAgICB0aGlzLmxlZ2VuZFBvaW50Q29sb3JlciA9IGxlZ2VuZFBvaW50Q29sb3JlcjtcbiAgfVxuICBzZXRMYWJlbFBvaW50QWNjZXNzb3IobGFiZWxQb2ludEFjY2Vzc29yOiBzdHJpbmcpIHtcbiAgICB0aGlzLmxhYmVsUG9pbnRBY2Nlc3NvciA9IGxhYmVsUG9pbnRBY2Nlc3NvcjtcbiAgICBpZiAodGhpcy5sYWJlbHMzRFZpc3VhbGl6ZXIgIT0gbnVsbCkge1xuICAgICAgY29uc3QgZHMgPSB0aGlzLnByb2plY3Rpb24gPT0gbnVsbCA/IG51bGwgOiB0aGlzLnByb2plY3Rpb24uZGF0YVNldDtcbiAgICAgIHRoaXMubGFiZWxzM0RWaXN1YWxpemVyLnNldExhYmVsU3RyaW5ncyhcbiAgICAgICAgdGhpcy5nZW5lcmF0ZTNETGFiZWxzQXJyYXkoZHMsIGxhYmVsUG9pbnRBY2Nlc3NvcilcbiAgICAgICk7XG4gICAgfVxuICB9XG4gIHJlc2l6ZSgpIHtcbiAgICB0aGlzLnNjYXR0ZXJQbG90LnJlc2l6ZSgpO1xuICB9XG4gIHBvcHVsYXRlQm9va21hcmtGcm9tVUkoc3RhdGU6IFN0YXRlKSB7XG4gICAgc3RhdGUuY2FtZXJhRGVmID0gdGhpcy5zY2F0dGVyUGxvdC5nZXRDYW1lcmFEZWYoKTtcbiAgfVxuICByZXN0b3JlVUlGcm9tQm9va21hcmsoc3RhdGU6IFN0YXRlKSB7XG4gICAgdGhpcy5zY2F0dGVyUGxvdC5zZXRDYW1lcmFQYXJhbWV0ZXJzRm9yTmV4dENhbWVyYUNyZWF0aW9uKFxuICAgICAgc3RhdGUuY2FtZXJhRGVmLFxuICAgICAgZmFsc2VcbiAgICApO1xuICB9XG4gIHVwZGF0ZVNjYXR0ZXJQbG90UG9zaXRpb25zKGRhdGFzZXQ/OiBhbnkpIHtcbiAgICAvLyBsZXQgZHNcbiAgICAvLyBpZihkYXRhc2V0KXtcbiAgICAvLyAgIGRzID0gZGF0YXNldFxuICAgIC8vICAgY29uc29sZS5sb2coJ2RzJyxkcylcbiAgICAvLyB9ZWxzZXtcbiAgICBjb25zdCBkcyA9IHRoaXMucHJvamVjdGlvbiA9PSBudWxsID8gbnVsbCA6IHRoaXMucHJvamVjdGlvbi5kYXRhU2V0O1xuICAgIC8vIH1cblxuICAgIGNvbnN0IHByb2plY3Rpb25Db21wb25lbnRzID1cbiAgICAgIHRoaXMucHJvamVjdGlvbiA9PSBudWxsID8gbnVsbCA6IHRoaXMucHJvamVjdGlvbi5wcm9qZWN0aW9uQ29tcG9uZW50cztcbiAgICBjb25zdCBuZXdQb3NpdGlvbnMgPSB0aGlzLmdlbmVyYXRlUG9pbnRQb3NpdGlvbkFycmF5KFxuICAgICAgZHMsXG4gICAgICBwcm9qZWN0aW9uQ29tcG9uZW50c1xuICAgICk7XG4gICAgdGhpcy5zY2F0dGVyUGxvdC5zZXRQb2ludFBvc2l0aW9ucyhuZXdQb3NpdGlvbnMsIHRoaXMucHJvamVjdGlvbiA9PSBudWxsID8gMCA6IHRoaXMucHJvamVjdGlvbi5kYXRhU2V0LkRWSUN1cnJlbnRSZWFsRGF0YU51bWJlcik7XG4gICAgaWYgKCF3aW5kb3cud29ybGRTcGFjZVBvaW50UG9zaXRpb25zKSB7XG4gICAgICB3aW5kb3cud29ybGRTcGFjZVBvaW50UG9zaXRpb25zID0gW11cbiAgICB9XG4gICAgd2luZG93LndvcmxkU3BhY2VQb2ludFBvc2l0aW9uc1t3aW5kb3cuaXRlcmF0aW9uXSA9IG5ld1Bvc2l0aW9uc1xuICB9XG4gIHVwZGF0ZUJhY2tncm91bmQoKSB7XG4gICAgaWYgKHdpbmRvdy5zY2VuZUJhY2tncm91bmRJbWcgJiYgd2luZG93LnNjZW5lQmFja2dyb3VuZEltZ1t3aW5kb3cuaXRlcmF0aW9uXSkge1xuICAgICAgdGhpcy5zY2F0dGVyUGxvdC5hZGRiYWNrZ3JvdW5kSW1nKHdpbmRvdy5zY2VuZUJhY2tncm91bmRJbWdbd2luZG93Lml0ZXJhdGlvbl0pXG4gICAgfVxuICB9XG4gIHVwZGF0ZVNjYXR0ZXJQbG90QXR0cmlidXRlcyhpc0ZpbHRlcj86IGJvb2xlYW4pIHtcbiAgICBpZiAodGhpcy5wcm9qZWN0aW9uID09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgZGF0YVNldCA9IHRoaXMucHJvamVjdGlvbi5kYXRhU2V0O1xuICAgIGNvbnN0IHNlbGVjdGVkU2V0ID0gdGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcztcbiAgICAvLyBjb25zdCBuZXdTZWxlY3Rpb25TZXQgPSB0aGlzLm5ld1NlbGVjdGlvbkluZGljZXM7XG4gICAgY29uc3QgaG92ZXJJbmRleCA9IHRoaXMuaG92ZXJQb2ludEluZGV4O1xuICAgIGNvbnN0IG5laWdoYm9ycyA9IHRoaXMubmVpZ2hib3JzT2ZGaXJzdFNlbGVjdGVkUG9pbnQ7XG4gICAgY29uc3QgcG9pbnRDb2xvcmVyID0gdGhpcy5sZWdlbmRQb2ludENvbG9yZXI7XG4gICAgY29uc3QgcG9pbnRDb2xvcnMgPSB0aGlzLmdlbmVyYXRlUG9pbnRDb2xvckFycmF5KFxuICAgICAgZGF0YVNldCxcbiAgICAgIHBvaW50Q29sb3JlcixcbiAgICAgIHRoaXMuZGlzdGFuY2VNZXRyaWMsXG4gICAgICBzZWxlY3RlZFNldCxcbiAgICAgIG5laWdoYm9ycyxcbiAgICAgIGhvdmVySW5kZXgsXG4gICAgICB0aGlzLnJlbmRlckxhYmVsc0luM0QsXG4gICAgICB0aGlzLmdldFNwcml0ZUltYWdlTW9kZSgpLFxuICAgICAgdGhpcy5yZW5kZXJJblRyaWFuZ2xlLFxuICAgICAgdGhpcy5yZW5kZXJJblRyYWNlTGluZSxcbiAgICApO1xuICAgIGNvbnN0IHBvaW50U2NhbGVGYWN0b3JzID0gdGhpcy5nZW5lcmF0ZVBvaW50U2NhbGVGYWN0b3JBcnJheShcbiAgICAgIGRhdGFTZXQsXG4gICAgICBzZWxlY3RlZFNldCxcbiAgICAgIC8vIG5ld1NlbGVjdGlvblNldCxcbiAgICAgIG5laWdoYm9ycyxcbiAgICAgIGhvdmVySW5kZXhcbiAgICApO1xuICAgIGNvbnN0IGxhYmVscyA9IHRoaXMuZ2VuZXJhdGVWaXNpYmxlTGFiZWxSZW5kZXJQYXJhbXMoXG4gICAgICBkYXRhU2V0LFxuICAgICAgc2VsZWN0ZWRTZXQsXG4gICAgICBuZWlnaGJvcnMsXG4gICAgICBob3ZlckluZGV4XG4gICAgKTtcbiAgICBjb25zdCBwb2x5bGluZUNvbG9ycyA9IHRoaXMuZ2VuZXJhdGVMaW5lU2VnbWVudENvbG9yTWFwKFxuICAgICAgZGF0YVNldCxcbiAgICAgIHBvaW50Q29sb3JlclxuICAgICk7XG4gICAgY29uc3QgcG9seWxpbmVPcGFjaXRpZXMgPSB0aGlzLmdlbmVyYXRlTGluZVNlZ21lbnRPcGFjaXR5QXJyYXkoXG4gICAgICBkYXRhU2V0LFxuICAgICAgc2VsZWN0ZWRTZXRcbiAgICApO1xuICAgIGNvbnN0IHBvbHlsaW5lV2lkdGhzID0gdGhpcy5nZW5lcmF0ZUxpbmVTZWdtZW50V2lkdGhBcnJheShcbiAgICAgIGRhdGFTZXQsXG4gICAgICBzZWxlY3RlZFNldFxuICAgICk7XG4gICAgdGhpcy5zY2F0dGVyUGxvdC5zZXRQb2ludENvbG9ycyhwb2ludENvbG9ycyk7XG4gICAgdGhpcy5zY2F0dGVyUGxvdC5zZXRQb2ludFNjYWxlRmFjdG9ycyhwb2ludFNjYWxlRmFjdG9ycyk7XG4gICAgdGhpcy5zY2F0dGVyUGxvdC5zZXRMYWJlbHMobGFiZWxzKTtcbiAgICB0aGlzLnNjYXR0ZXJQbG90LnNldFBvbHlsaW5lQ29sb3JzKHBvbHlsaW5lQ29sb3JzKTtcbiAgICB0aGlzLnNjYXR0ZXJQbG90LnNldFBvbHlsaW5lT3BhY2l0aWVzKHBvbHlsaW5lT3BhY2l0aWVzKTtcbiAgICB0aGlzLnNjYXR0ZXJQbG90LnNldFBvbHlsaW5lV2lkdGhzKHBvbHlsaW5lV2lkdGhzKTtcbiAgfVxuICByZW5kZXIoKSB7XG4gICAgdGhpcy5zY2F0dGVyUGxvdC5yZW5kZXIoKTtcbiAgfVxuXG4gIGdlbmVyYXRlUG9pbnRQb3NpdGlvbkFycmF5KFxuICAgIGRzOiBEYXRhU2V0LFxuICAgIHByb2plY3Rpb25Db21wb25lbnRzOiBQcm9qZWN0aW9uQ29tcG9uZW50czNEXG4gICk6IEZsb2F0MzJBcnJheSB7XG4gICAgaWYgKGRzID09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCB4U2NhbGVyID0gZDMuc2NhbGVMaW5lYXIoKTtcbiAgICBjb25zdCB5U2NhbGVyID0gZDMuc2NhbGVMaW5lYXIoKTtcbiAgICBsZXQgelNjYWxlciA9IG51bGw7XG4gICAge1xuICAgICAgLy8gRGV0ZXJtaW5lIG1heCBhbmQgbWluIG9mIGVhY2ggYXhpcyBvZiBvdXIgZGF0YS5cbiAgICAgIGNvbnN0IHhFeHRlbnQgPSBkMy5leHRlbnQoXG4gICAgICAgIGRzLnBvaW50cyxcbiAgICAgICAgKHAsIGkpID0+IGRzLnBvaW50c1tpXS5wcm9qZWN0aW9uc1twcm9qZWN0aW9uQ29tcG9uZW50c1swXV1cbiAgICAgICk7XG4gICAgICBjb25zdCB5RXh0ZW50ID0gZDMuZXh0ZW50KFxuICAgICAgICBkcy5wb2ludHMsXG4gICAgICAgIChwLCBpKSA9PiBkcy5wb2ludHNbaV0ucHJvamVjdGlvbnNbcHJvamVjdGlvbkNvbXBvbmVudHNbMV1dXG4gICAgICApO1xuICAgICAgY29uc3QgcmFuZ2UgPSBbXG4gICAgICAgIC1TQ0FUVEVSX1BMT1RfQ1VCRV9MRU5HVEggLyAyLFxuICAgICAgICBTQ0FUVEVSX1BMT1RfQ1VCRV9MRU5HVEggLyAyLFxuICAgICAgXTtcbiAgICAgIHhTY2FsZXIuZG9tYWluKHhFeHRlbnQpLnJhbmdlKHJhbmdlKTtcbiAgICAgIHlTY2FsZXIuZG9tYWluKHlFeHRlbnQpLnJhbmdlKHJhbmdlKTtcbiAgICAgIGlmIChwcm9qZWN0aW9uQ29tcG9uZW50c1syXSAhPSBudWxsKSB7XG4gICAgICAgIGNvbnN0IHpFeHRlbnQgPSBkMy5leHRlbnQoXG4gICAgICAgICAgZHMucG9pbnRzLFxuICAgICAgICAgIChwLCBpKSA9PiBkcy5wb2ludHNbaV0ucHJvamVjdGlvbnNbcHJvamVjdGlvbkNvbXBvbmVudHNbMl1dXG4gICAgICAgICk7XG4gICAgICAgIHpTY2FsZXIgPSBkMy5zY2FsZUxpbmVhcigpO1xuICAgICAgICB6U2NhbGVyLmRvbWFpbih6RXh0ZW50KS5yYW5nZShyYW5nZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IHBvc2l0aW9ucyA9IG5ldyBGbG9hdDMyQXJyYXkoZHMucG9pbnRzLmxlbmd0aCAqIDMpO1xuICAgIGxldCBkc3QgPSAwO1xuICAgIGRzLnBvaW50cy5mb3JFYWNoKChkLCBpKSA9PiB7XG4gICAgICBwb3NpdGlvbnNbZHN0KytdID0geFNjYWxlcihcbiAgICAgICAgZHMucG9pbnRzW2ldLnByb2plY3Rpb25zW3Byb2plY3Rpb25Db21wb25lbnRzWzBdXVxuICAgICAgKTtcbiAgICAgIHBvc2l0aW9uc1tkc3QrK10gPSB5U2NhbGVyKFxuICAgICAgICBkcy5wb2ludHNbaV0ucHJvamVjdGlvbnNbcHJvamVjdGlvbkNvbXBvbmVudHNbMV1dXG4gICAgICApO1xuICAgICAgcG9zaXRpb25zW2RzdCsrXSA9IDA7XG4gICAgfSk7XG4gICAgaWYgKHpTY2FsZXIpIHtcbiAgICAgIGRzdCA9IDI7XG4gICAgICBkcy5wb2ludHMuZm9yRWFjaCgoZCwgaSkgPT4ge1xuICAgICAgICBwb3NpdGlvbnNbZHN0XSA9IHpTY2FsZXIoXG4gICAgICAgICAgZHMucG9pbnRzW2ldLnByb2plY3Rpb25zW3Byb2plY3Rpb25Db21wb25lbnRzWzJdXVxuICAgICAgICApO1xuICAgICAgICBkc3QgKz0gMztcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcG9zaXRpb25zO1xuICB9XG4gIGdlbmVyYXRlVmlzaWJsZUxhYmVsUmVuZGVyUGFyYW1zKFxuICAgIGRzOiBEYXRhU2V0LFxuICAgIHNlbGVjdGVkUG9pbnRJbmRpY2VzOiBudW1iZXJbXSxcbiAgICBuZWlnaGJvcnNPZkZpcnN0UG9pbnQ6IGtubi5OZWFyZXN0RW50cnlbXSxcbiAgICBob3ZlclBvaW50SW5kZXg6IG51bWJlclxuICApOiBMYWJlbFJlbmRlclBhcmFtcyB7XG4gICAgaWYgKGRzID09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBpZiAoIXdpbmRvdy5jdXN0b21TZWxlY3Rpb24pIHtcbiAgICAgIHdpbmRvdy5jdXN0b21TZWxlY3Rpb24gPSBbXVxuICAgIH1cbiAgICBsZXQgdGVtcEFyciA9IFtdXG4gICAgY29uc3Qgc2VsZWN0ZWRQb2ludENvdW50ID1cbiAgICAgIHNlbGVjdGVkUG9pbnRJbmRpY2VzID09IG51bGwgPyAwIDogd2luZG93LnF1ZXJ5UmVzUG9pbnRJbmRpY2VzPy5sZW5ndGg7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWxlY3RlZFBvaW50Q291bnQ7IGkrKykge1xuICAgICAgbGV0IGluZGljYXRlID0gd2luZG93LnF1ZXJ5UmVzUG9pbnRJbmRpY2VzW2ldXG4gICAgICBpZiAod2luZG93LmN1c3RvbVNlbGVjdGlvbi5pbmRleE9mKGluZGljYXRlKSA9PT0gLTEpIHtcbiAgICAgICAgdGVtcEFyci5wdXNoKGluZGljYXRlKVxuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCB0ZW1wTGVuZ3RoID0gdGVtcEFyci5sZW5ndGhcbiAgICBjb25zdCBjdXN0b21TZWxlY3Rpb25Db3VudCA9IHdpbmRvdy5jdXN0b21TZWxlY3Rpb24ubGVuZ3RoO1xuICAgIC8vIGNvbnN0IGN1c3RvbVNlbGV0ZWRDb3VudCA9IG51bGwgPyAwIDogd2luZG93LmN1c3RvbVNlbGVjdGlvbj8ubGVuZ3RoXG4gICAgY29uc3QgbmVpZ2hib3JDb3VudCA9XG4gICAgICBuZWlnaGJvcnNPZkZpcnN0UG9pbnQgPT0gbnVsbCA/IDAgOiBuZWlnaGJvcnNPZkZpcnN0UG9pbnQubGVuZ3RoO1xuICAgIGNvbnN0IG4gPVxuICAgICAgdGVtcExlbmd0aCArIGN1c3RvbVNlbGVjdGlvbkNvdW50ICsgbmVpZ2hib3JDb3VudCArIChob3ZlclBvaW50SW5kZXggIT0gbnVsbCA/IDEgOiAwKTtcbiAgICBjb25zdCB2aXNpYmxlTGFiZWxzID0gbmV3IFVpbnQzMkFycmF5KG4pO1xuICAgIGNvbnN0IHNjYWxlID0gbmV3IEZsb2F0MzJBcnJheShuKTtcbiAgICBjb25zdCBvcGFjaXR5RmxhZ3MgPSBuZXcgSW50OEFycmF5KG4pO1xuICAgIGNvbnN0IGZpbGxDb2xvcnMgPSBuZXcgVWludDhBcnJheShuICogMyk7XG4gICAgY29uc3Qgc3Ryb2tlQ29sb3JzID0gbmV3IFVpbnQ4QXJyYXkobiAqIDMpO1xuICAgIGNvbnN0IGxhYmVsU3RyaW5nczogc3RyaW5nW10gPSBbXTtcbiAgICBzY2FsZS5maWxsKExBQkVMX1NDQUxFX0RFRkFVTFQpO1xuICAgIG9wYWNpdHlGbGFncy5maWxsKDEpO1xuICAgIGxldCBkc3QgPSAwO1xuICAgIGlmIChob3ZlclBvaW50SW5kZXggIT0gbnVsbCkge1xuICAgICAgbGFiZWxTdHJpbmdzLnB1c2goXG4gICAgICAgIHRoaXMuZ2V0TGFiZWxUZXh0KGRzLCBob3ZlclBvaW50SW5kZXgsIHRoaXMubGFiZWxQb2ludEFjY2Vzc29yKVxuICAgICAgKTtcbiAgICAgIHZpc2libGVMYWJlbHNbZHN0XSA9IGhvdmVyUG9pbnRJbmRleDtcbiAgICAgIHNjYWxlW2RzdF0gPSBMQUJFTF9TQ0FMRV9MQVJHRTtcbiAgICAgIG9wYWNpdHlGbGFnc1tkc3RdID0gMDtcbiAgICAgIGNvbnN0IGZpbGxSZ2IgPSBzdHlsZVJnYkZyb21IZXhDb2xvcihMQUJFTF9GSUxMX0NPTE9SX0hPVkVSKTtcbiAgICAgIHBhY2tSZ2JJbnRvVWludDhBcnJheShcbiAgICAgICAgZmlsbENvbG9ycyxcbiAgICAgICAgZHN0LFxuICAgICAgICBmaWxsUmdiWzBdLFxuICAgICAgICBmaWxsUmdiWzFdLFxuICAgICAgICBmaWxsUmdiWzJdXG4gICAgICApO1xuICAgICAgY29uc3Qgc3Ryb2tlUmdiID0gc3R5bGVSZ2JGcm9tSGV4Q29sb3IoTEFCRUxfU1RST0tFX0NPTE9SX0hPVkVSKTtcbiAgICAgIHBhY2tSZ2JJbnRvVWludDhBcnJheShcbiAgICAgICAgc3Ryb2tlQ29sb3JzLFxuICAgICAgICBkc3QsXG4gICAgICAgIHN0cm9rZVJnYlswXSxcbiAgICAgICAgc3Ryb2tlUmdiWzFdLFxuICAgICAgICBzdHJva2VSZ2JbMV1cbiAgICAgICk7XG4gICAgICArK2RzdDtcbiAgICB9XG4gICAgLy8gU2VsZWN0ZWQgcG9pbnRzXG4gICAge1xuICAgICAgY29uc3QgbiA9IGN1c3RvbVNlbGVjdGlvbkNvdW50O1xuICAgICAgY29uc3QgZmlsbFJnYiA9IHN0eWxlUmdiRnJvbUhleENvbG9yKExBQkVMX0ZJTExfQ09MT1JfQ0hFQ0tFRCk7XG4gICAgICBjb25zdCBzdHJva2VSZ2IgPSBzdHlsZVJnYkZyb21IZXhDb2xvcihMQUJFTF9TVFJPS0VfQ09MT1JfQ0hFQ0tFRCk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG47ICsraSkge1xuICAgICAgICBjb25zdCBsYWJlbEluZGV4ID0gd2luZG93LmN1c3RvbVNlbGVjdGlvbltpXTtcbiAgICAgICAgbGFiZWxTdHJpbmdzLnB1c2goXG4gICAgICAgICAgdGhpcy5nZXRMYWJlbFRleHQoZHMsIGxhYmVsSW5kZXgsIHRoaXMubGFiZWxQb2ludEFjY2Vzc29yKVxuICAgICAgICApO1xuICAgICAgICB2aXNpYmxlTGFiZWxzW2RzdF0gPSBsYWJlbEluZGV4O1xuICAgICAgICBzY2FsZVtkc3RdID0gTEFCRUxfU0NBTEVfTEFSR0U7XG4gICAgICAgIG9wYWNpdHlGbGFnc1tkc3RdID0gbiA9PT0gMSA/IDAgOiAxO1xuICAgICAgICBwYWNrUmdiSW50b1VpbnQ4QXJyYXkoXG4gICAgICAgICAgZmlsbENvbG9ycyxcbiAgICAgICAgICBkc3QsXG4gICAgICAgICAgZmlsbFJnYlswXSxcbiAgICAgICAgICBmaWxsUmdiWzFdLFxuICAgICAgICAgIGZpbGxSZ2JbMl1cbiAgICAgICAgKTtcbiAgICAgICAgcGFja1JnYkludG9VaW50OEFycmF5KFxuICAgICAgICAgIHN0cm9rZUNvbG9ycyxcbiAgICAgICAgICBkc3QsXG4gICAgICAgICAgc3Ryb2tlUmdiWzBdLFxuICAgICAgICAgIHN0cm9rZVJnYlsxXSxcbiAgICAgICAgICBzdHJva2VSZ2JbMl1cbiAgICAgICAgKTtcbiAgICAgICAgKytkc3Q7XG4gICAgICB9XG4gICAgfVxuICAgIHtcbiAgICAgIGNvbnN0IG4gPSB0ZW1wTGVuZ3RoO1xuICAgICAgY29uc3QgZmlsbFJnYiA9IHN0eWxlUmdiRnJvbUhleENvbG9yKExBQkVMX0ZJTExfQ09MT1JfU0VMRUNURUQpO1xuICAgICAgY29uc3Qgc3Ryb2tlUmdiID0gc3R5bGVSZ2JGcm9tSGV4Q29sb3IoTEFCRUxfU1RST0tFX0NPTE9SX1NFTEVDVEVEKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbjsgKytpKSB7XG4gICAgICAgIGNvbnN0IGxhYmVsSW5kZXggPSB0ZW1wQXJyW2ldO1xuICAgICAgICBsYWJlbFN0cmluZ3MucHVzaChcbiAgICAgICAgICB0aGlzLmdldExhYmVsVGV4dChkcywgbGFiZWxJbmRleCwgdGhpcy5sYWJlbFBvaW50QWNjZXNzb3IpXG4gICAgICAgICk7XG4gICAgICAgIHZpc2libGVMYWJlbHNbZHN0XSA9IGxhYmVsSW5kZXg7XG4gICAgICAgIHNjYWxlW2RzdF0gPSBMQUJFTF9TQ0FMRV9MQVJHRTtcbiAgICAgICAgb3BhY2l0eUZsYWdzW2RzdF0gPSBuID09PSAxID8gMCA6IDE7XG4gICAgICAgIHBhY2tSZ2JJbnRvVWludDhBcnJheShcbiAgICAgICAgICBmaWxsQ29sb3JzLFxuICAgICAgICAgIGRzdCxcbiAgICAgICAgICBmaWxsUmdiWzBdLFxuICAgICAgICAgIGZpbGxSZ2JbMV0sXG4gICAgICAgICAgZmlsbFJnYlsyXVxuICAgICAgICApO1xuICAgICAgICBwYWNrUmdiSW50b1VpbnQ4QXJyYXkoXG4gICAgICAgICAgc3Ryb2tlQ29sb3JzLFxuICAgICAgICAgIGRzdCxcbiAgICAgICAgICBzdHJva2VSZ2JbMF0sXG4gICAgICAgICAgc3Ryb2tlUmdiWzFdLFxuICAgICAgICAgIHN0cm9rZVJnYlsyXVxuICAgICAgICApO1xuICAgICAgICArK2RzdDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBOZWlnaGJvcnNcbiAgICB7XG4gICAgICBjb25zdCBuID0gbmVpZ2hib3JDb3VudDtcbiAgICAgIGNvbnN0IGZpbGxSZ2IgPSBzdHlsZVJnYkZyb21IZXhDb2xvcihMQUJFTF9GSUxMX0NPTE9SX05FSUdIQk9SKTtcbiAgICAgIGNvbnN0IHN0cm9rZVJnYiA9IHN0eWxlUmdiRnJvbUhleENvbG9yKExBQkVMX1NUUk9LRV9DT0xPUl9ORUlHSEJPUik7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG47ICsraSkge1xuICAgICAgICBjb25zdCBsYWJlbEluZGV4ID0gbmVpZ2hib3JzT2ZGaXJzdFBvaW50W2ldLmluZGV4O1xuICAgICAgICBsYWJlbFN0cmluZ3MucHVzaChcbiAgICAgICAgICB0aGlzLmdldExhYmVsVGV4dChkcywgbGFiZWxJbmRleCwgdGhpcy5sYWJlbFBvaW50QWNjZXNzb3IpXG4gICAgICAgICk7XG4gICAgICAgIHZpc2libGVMYWJlbHNbZHN0XSA9IGxhYmVsSW5kZXg7XG4gICAgICAgIHNjYWxlW2RzdF0gPSBMQUJFTF9TQ0FMRV9MQVJHRTtcbiAgICAgICAgcGFja1JnYkludG9VaW50OEFycmF5KFxuICAgICAgICAgIGZpbGxDb2xvcnMsXG4gICAgICAgICAgZHN0LFxuICAgICAgICAgIGZpbGxSZ2JbMF0sXG4gICAgICAgICAgZmlsbFJnYlsxXSxcbiAgICAgICAgICBmaWxsUmdiWzJdXG4gICAgICAgICk7XG4gICAgICAgIHBhY2tSZ2JJbnRvVWludDhBcnJheShcbiAgICAgICAgICBzdHJva2VDb2xvcnMsXG4gICAgICAgICAgZHN0LFxuICAgICAgICAgIHN0cm9rZVJnYlswXSxcbiAgICAgICAgICBzdHJva2VSZ2JbMV0sXG4gICAgICAgICAgc3Ryb2tlUmdiWzJdXG4gICAgICAgICk7XG4gICAgICAgICsrZHN0O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbmV3IExhYmVsUmVuZGVyUGFyYW1zKFxuICAgICAgbmV3IEZsb2F0MzJBcnJheSh2aXNpYmxlTGFiZWxzKSxcbiAgICAgIGxhYmVsU3RyaW5ncyxcbiAgICAgIHNjYWxlLFxuICAgICAgb3BhY2l0eUZsYWdzLFxuICAgICAgTEFCRUxfRk9OVF9TSVpFLFxuICAgICAgZmlsbENvbG9ycyxcbiAgICAgIHN0cm9rZUNvbG9yc1xuICAgICk7XG4gIH1cbiAgZ2VuZXJhdGVQb2ludFNjYWxlRmFjdG9yQXJyYXkoXG4gICAgZHM6IERhdGFTZXQsXG4gICAgc2VsZWN0ZWRQb2ludEluZGljZXM6IG51bWJlcltdLFxuICAgIC8vIG5ld1NlbGVjdGlvbkluZGljZXM6IGFueVtdLFxuICAgIG5laWdoYm9yc09mRmlyc3RQb2ludDoga25uLk5lYXJlc3RFbnRyeVtdLFxuICAgIGhvdmVyUG9pbnRJbmRleDogbnVtYmVyXG4gICk6IEZsb2F0MzJBcnJheSB7XG4gICAgaWYgKGRzID09IG51bGwpIHtcbiAgICAgIHJldHVybiBuZXcgRmxvYXQzMkFycmF5KDApO1xuICAgIH1cbiAgICBjb25zdCBzY2FsZSA9IG5ldyBGbG9hdDMyQXJyYXkoZHMucG9pbnRzLmxlbmd0aCk7XG4gICAgc2NhbGUuZmlsbChQT0lOVF9TQ0FMRV9ERUZBVUxUKTtcbiAgICBpZiAoIXdpbmRvdy5jdXN0b21TZWxlY3Rpb24pIHtcbiAgICAgIHdpbmRvdy5jdXN0b21TZWxlY3Rpb24gPSBbXVxuICAgIH1cbiAgICBjb25zdCBzZWxlY3RlZFBvaW50Q291bnQgPVxuICAgICAgc2VsZWN0ZWRQb2ludEluZGljZXMgPT0gbnVsbCA/IDAgOiBzZWxlY3RlZFBvaW50SW5kaWNlcy5sZW5ndGg7XG4gICAgY29uc3QgbmVpZ2hib3JDb3VudCA9XG4gICAgICBuZWlnaGJvcnNPZkZpcnN0UG9pbnQgPT0gbnVsbCA/IDAgOiBuZWlnaGJvcnNPZkZpcnN0UG9pbnQubGVuZ3RoO1xuICAgIC8vIGNvbnN0IG5ld1NlbGVjdGlvbkNvdW50ID1cbiAgICAvLyAgIG5ld1NlbGVjdGlvbkluZGljZXMgPT0gbnVsbCA/IDAgOiBuZXdTZWxlY3Rpb25JbmRpY2VzLmxlbmd0aDtcbiAgICAvLyBjb25zdCBzZWxlY3RlZE5ld1NlbGVjdGlvbkluZGljZXMgPVxuICAgIC8vICAgICAoc2VsZWN0ZWRQb2ludEluZGljZXMgPT0gbnVsbCB8fCBuZXdTZWxlY3Rpb25JbmRpY2VzID09IG51bGwpID8gbnVsbCA6XG4gICAgLy8gICAgICAgICBzZWxlY3RlZFBvaW50SW5kaWNlcy5maWx0ZXIodmFsdWUgPT4ge25ld1NlbGVjdGlvbkluZGljZXMuaW5jbHVkZXModmFsdWUpfSk7XG4gICAgLy8gY29uc3Qgc2VsZWN0ZWROZXdTZWxlY3Rpb25Db3VudCA9XG4gICAgLy8gICAgIHNlbGVjdGVkTmV3U2VsZWN0aW9uSW5kaWNlcyA9PSBudWxsID8gMCA6IHNlbGVjdGVkUG9pbnRJbmRpY2VzLmxlbmd0aDtcbiAgICAvLyBjb25zdCBob3Zlck5ld1NlbGVjdGlvblBvaW50SW5kZXggPVxuICAgIC8vICAgICAoaG92ZXJQb2ludEluZGV4ID09IG51bGwgfHwgbmV3U2VsZWN0aW9uSW5kaWNlcyA9PSBudWxsIHx8IG5ld1NlbGVjdGlvbkluZGljZXMuaW5kZXhPZihob3ZlclBvaW50SW5kZXgpID09IC0xKSA/XG4gICAgLy8gICAgICAgICBudWxsIDogaG92ZXJQb2ludEluZGV4O1xuICAgIC8vIFNjYWxlIHVwIGFsbCBzZWxlY3RlZCBwb2ludHMuXG4gICAge1xuICAgICAgY29uc3QgbiA9IHNlbGVjdGVkUG9pbnRDb3VudDtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbjsgKytpKSB7XG4gICAgICAgIGNvbnN0IHAgPSBzZWxlY3RlZFBvaW50SW5kaWNlc1tpXTtcbiAgICAgICAgaWYod2luZG93LmlzQW5pbWF0YXRpbmcpe1xuICAgICAgICAgIHNjYWxlW3BdID0gNC4wO1xuICAgICAgICB9IGVsc2V7XG4gICAgICAgICAgc2NhbGVbcF0gPSBQT0lOVF9TQ0FMRV9TRUxFQ1RFRDtcbiAgICAgICAgfVxuXG4gICAgICB9XG4gICAgfVxuICAgIHtcbiAgICAgIGNvbnN0IG4gPSB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uLmxlbmd0aDtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbjsgKytpKSB7XG4gICAgICAgIGNvbnN0IHAgPSB3aW5kb3cuY3VzdG9tU2VsZWN0aW9uW2ldO1xuICAgICAgICBpZih3aW5kb3cuaXNBbmltYXRhdGluZyl7XG4gICAgICAgICAgc2NhbGVbcF0gPSA0LjA7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gU2NhbGUgdXAgdGhlIG5laWdoYm9yIHBvaW50cy5cbiAgICB7XG4gICAgICBjb25zdCBuID0gbmVpZ2hib3JDb3VudDtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbjsgKytpKSB7XG4gICAgICAgIGNvbnN0IHAgPSBuZWlnaGJvcnNPZkZpcnN0UG9pbnRbaV0uaW5kZXg7XG4gICAgICAgIHNjYWxlW3BdID0gUE9JTlRfU0NBTEVfTkVJR0hCT1I7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHtcbiAgICAvLyAgIGNvbnN0IG4gPSBuZXdTZWxlY3Rpb25Db3VudDtcbiAgICAvLyAgIGZvciAobGV0IGkgPSAwOyBpIDwgbjsgKytpKSB7XG4gICAgLy8gICAgIGNvbnN0IHAgPSBuZXdTZWxlY3Rpb25JbmRpY2VzW2ldO1xuICAgIC8vICAgICBzY2FsZVtwXSA9IFBPSU5UX1NDQUxFX05FV19TRUxFQ1RJT047XG4gICAgLy8gICB9XG4gICAgLy8gfVxuICAgIC8vIHtcbiAgICAvLyAgIGNvbnN0IG4gPSBzZWxlY3RlZE5ld1NlbGVjdGlvbkNvdW50O1xuICAgIC8vICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyArK2kpIHtcbiAgICAvLyAgICAgY29uc3QgcCA9IHNlbGVjdGVkTmV3U2VsZWN0aW9uSW5kaWNlc1tpXTtcbiAgICAvLyAgICAgc2NhbGVbcF0gPSBQT0lOVF9TQ0FMRV9TRUxFQ1RFRF9ORVdfU0VMRUNUSU9OO1xuICAgIC8vICAgfVxuICAgIC8vIH1cbiAgICAvLyBTY2FsZSB1cCB0aGUgaG92ZXIgcG9pbnQuXG4gICAgaWYgKGhvdmVyUG9pbnRJbmRleCAhPSBudWxsKSB7XG4gICAgICBzY2FsZVtob3ZlclBvaW50SW5kZXhdID0gUE9JTlRfU0NBTEVfSE9WRVI7XG4gICAgfVxuICAgIC8vIGlmIChob3Zlck5ld1NlbGVjdGlvblBvaW50SW5kZXggIT0gbnVsbCkge1xuICAgIC8vICAgc2NhbGVbaG92ZXJOZXdTZWxlY3Rpb25Qb2ludEluZGV4XSA9IFBPSU5UX1NDQUxFX0hPVkVSX05FV19TRUxFQ1RJT047XG4gICAgLy8gfVxuICAgIHJldHVybiBzY2FsZTtcbiAgfVxuICBnZW5lcmF0ZUxpbmVTZWdtZW50Q29sb3JNYXAoXG4gICAgZHM6IERhdGFTZXQsXG4gICAgbGVnZW5kUG9pbnRDb2xvcmVyOiAoZHM6IERhdGFTZXQsIGluZGV4OiBudW1iZXIpID0+IHN0cmluZ1xuICApOiB7XG4gICAgW3BvbHlsaW5lSW5kZXg6IG51bWJlcl06IEZsb2F0MzJBcnJheTtcbiAgfSB7XG4gICAgbGV0IHBvbHlsaW5lQ29sb3JBcnJheU1hcDoge1xuICAgICAgW3BvbHlsaW5lSW5kZXg6IG51bWJlcl06IEZsb2F0MzJBcnJheTtcbiAgICB9ID0ge307XG4gICAgaWYgKGRzID09IG51bGwpIHtcbiAgICAgIHJldHVybiBwb2x5bGluZUNvbG9yQXJyYXlNYXA7XG4gICAgfVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHMuc2VxdWVuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgc2VxdWVuY2UgPSBkcy5zZXF1ZW5jZXNbaV07XG4gICAgICBsZXQgY29sb3JzID0gbmV3IEZsb2F0MzJBcnJheSgyICogKHNlcXVlbmNlLnBvaW50SW5kaWNlcy5sZW5ndGggLSAxKSAqIDMpO1xuICAgICAgbGV0IGNvbG9ySW5kZXggPSAwO1xuICAgICAgaWYgKGxlZ2VuZFBvaW50Q29sb3Jlcikge1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHNlcXVlbmNlLnBvaW50SW5kaWNlcy5sZW5ndGggLSAxOyBqKyspIHtcbiAgICAgICAgICBjb25zdCBjMSA9IG5ldyBUSFJFRS5Db2xvcihcbiAgICAgICAgICAgIGxlZ2VuZFBvaW50Q29sb3Jlcihkcywgc2VxdWVuY2UucG9pbnRJbmRpY2VzW2pdKVxuICAgICAgICAgICk7XG4gICAgICAgICAgY29uc3QgYzIgPSBuZXcgVEhSRUUuQ29sb3IoXG4gICAgICAgICAgICBsZWdlbmRQb2ludENvbG9yZXIoZHMsIHNlcXVlbmNlLnBvaW50SW5kaWNlc1tqICsgMV0pXG4gICAgICAgICAgKTtcbiAgICAgICAgICBjb2xvcnNbY29sb3JJbmRleCsrXSA9IGMxLnI7XG4gICAgICAgICAgY29sb3JzW2NvbG9ySW5kZXgrK10gPSBjMS5nO1xuICAgICAgICAgIGNvbG9yc1tjb2xvckluZGV4KytdID0gYzEuYjtcbiAgICAgICAgICBjb2xvcnNbY29sb3JJbmRleCsrXSA9IGMyLnI7XG4gICAgICAgICAgY29sb3JzW2NvbG9ySW5kZXgrK10gPSBjMi5nO1xuICAgICAgICAgIGNvbG9yc1tjb2xvckluZGV4KytdID0gYzIuYjtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBzZXF1ZW5jZS5wb2ludEluZGljZXMubGVuZ3RoIC0gMTsgaisrKSB7XG4gICAgICAgICAgY29uc3QgYzEgPSBnZXREZWZhdWx0UG9pbnRJblBvbHlsaW5lQ29sb3IoXG4gICAgICAgICAgICBqLFxuICAgICAgICAgICAgc2VxdWVuY2UucG9pbnRJbmRpY2VzLmxlbmd0aFxuICAgICAgICAgICk7XG4gICAgICAgICAgY29uc3QgYzIgPSBnZXREZWZhdWx0UG9pbnRJblBvbHlsaW5lQ29sb3IoXG4gICAgICAgICAgICBqICsgMSxcbiAgICAgICAgICAgIHNlcXVlbmNlLnBvaW50SW5kaWNlcy5sZW5ndGhcbiAgICAgICAgICApO1xuICAgICAgICAgIGNvbG9yc1tjb2xvckluZGV4KytdID0gYzEucjtcbiAgICAgICAgICBjb2xvcnNbY29sb3JJbmRleCsrXSA9IGMxLmc7XG4gICAgICAgICAgY29sb3JzW2NvbG9ySW5kZXgrK10gPSBjMS5iO1xuICAgICAgICAgIGNvbG9yc1tjb2xvckluZGV4KytdID0gYzIucjtcbiAgICAgICAgICBjb2xvcnNbY29sb3JJbmRleCsrXSA9IGMyLmc7XG4gICAgICAgICAgY29sb3JzW2NvbG9ySW5kZXgrK10gPSBjMi5iO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBwb2x5bGluZUNvbG9yQXJyYXlNYXBbaV0gPSBjb2xvcnM7XG4gICAgfVxuICAgIHJldHVybiBwb2x5bGluZUNvbG9yQXJyYXlNYXA7XG4gIH1cbiAgZ2VuZXJhdGVMaW5lU2VnbWVudE9wYWNpdHlBcnJheShcbiAgICBkczogRGF0YVNldCxcbiAgICBzZWxlY3RlZFBvaW50czogbnVtYmVyW11cbiAgKTogRmxvYXQzMkFycmF5IHtcbiAgICBpZiAoZHMgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG5ldyBGbG9hdDMyQXJyYXkoMCk7XG4gICAgfVxuICAgIGNvbnN0IG9wYWNpdGllcyA9IG5ldyBGbG9hdDMyQXJyYXkoZHMuc2VxdWVuY2VzLmxlbmd0aCk7XG4gICAgY29uc3Qgc2VsZWN0ZWRQb2ludENvdW50ID1cbiAgICAgIHNlbGVjdGVkUG9pbnRzID09IG51bGwgPyAwIDogc2VsZWN0ZWRQb2ludHMubGVuZ3RoO1xuICAgIGlmIChzZWxlY3RlZFBvaW50Q291bnQgPiAwKSB7XG4gICAgICBvcGFjaXRpZXMuZmlsbChQT0xZTElORV9ERVNFTEVDVEVEX09QQUNJVFkpO1xuICAgICAgaWYoZHMucG9pbnRzW3NlbGVjdGVkUG9pbnRzWzBdXSAhPT0gdW5kZWZpbmVkKXtcbiAgICAgICAgY29uc3QgaSA9IGRzLnBvaW50c1tzZWxlY3RlZFBvaW50c1swXV0uc2VxdWVuY2VJbmRleDtcbiAgICAgICAgb3BhY2l0aWVzW2ldID0gUE9MWUxJTkVfU0VMRUNURURfT1BBQ0lUWTtcbiAgICAgIH1cblxuICAgIH0gZWxzZSB7XG4gICAgICBvcGFjaXRpZXMuZmlsbChQT0xZTElORV9ERUZBVUxUX09QQUNJVFkpO1xuICAgIH1cbiAgICByZXR1cm4gb3BhY2l0aWVzO1xuICB9XG4gIGdlbmVyYXRlTGluZVNlZ21lbnRXaWR0aEFycmF5KFxuICAgIGRzOiBEYXRhU2V0LFxuICAgIHNlbGVjdGVkUG9pbnRzOiBudW1iZXJbXVxuICApOiBGbG9hdDMyQXJyYXkge1xuICAgIGlmIChkcyA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gbmV3IEZsb2F0MzJBcnJheSgwKTtcbiAgICB9XG4gICAgY29uc3Qgd2lkdGhzID0gbmV3IEZsb2F0MzJBcnJheShkcy5zZXF1ZW5jZXMubGVuZ3RoKTtcbiAgICB3aWR0aHMuZmlsbChQT0xZTElORV9ERUZBVUxUX0xJTkVXSURUSCk7XG4gICAgY29uc3Qgc2VsZWN0ZWRQb2ludENvdW50ID1cbiAgICAgIHNlbGVjdGVkUG9pbnRzID09IG51bGwgPyAwIDogc2VsZWN0ZWRQb2ludHMubGVuZ3RoO1xuICAgIGlmIChzZWxlY3RlZFBvaW50Q291bnQgPiAwKSB7XG4gICAgICBpZihkcy5wb2ludHNbc2VsZWN0ZWRQb2ludHNbMF1dKXtcbiAgICAgICAgY29uc3QgaSA9IGRzLnBvaW50c1tzZWxlY3RlZFBvaW50c1swXV0uc2VxdWVuY2VJbmRleDtcbiAgICAgICAgd2lkdGhzW2ldID0gUE9MWUxJTkVfU0VMRUNURURfTElORVdJRFRIO1xuXG4gICAgICB9XG5cbiAgICB9XG4gICAgcmV0dXJuIHdpZHRocztcbiAgfVxuICBnZW5lcmF0ZVBvaW50Q29sb3JBcnJheShcbiAgICBkczogRGF0YVNldCxcbiAgICBsZWdlbmRQb2ludENvbG9yZXI6IChkczogRGF0YVNldCwgaW5kZXg6IG51bWJlcikgPT4gc3RyaW5nLFxuICAgIGRpc3RGdW5jOiBEaXN0YW5jZUZ1bmN0aW9uLFxuICAgIHNlbGVjdGVkUG9pbnRJbmRpY2VzOiBudW1iZXJbXSxcbiAgICBuZWlnaGJvcnNPZkZpcnN0UG9pbnQ6IGtubi5OZWFyZXN0RW50cnlbXSxcbiAgICBob3ZlclBvaW50SW5kZXg6IG51bWJlcixcbiAgICBsYWJlbDNkTW9kZTogYm9vbGVhbixcbiAgICBzcHJpdGVJbWFnZU1vZGU6IGJvb2xlYW4sXG4gICAgcmVuZGVySW5UcmlhbmdsZTogYm9vbGVhbixcbiAgICByZW5kZXJJblRyYWNlTGluZTogYm9vbGVhbixcbiAgKTogRmxvYXQzMkFycmF5IHtcbiAgICBpZiAoZHMgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG5ldyBGbG9hdDMyQXJyYXkoMCk7XG4gICAgfVxuICAgIGNvbnN0IHNlbGVjdGVkUG9pbnRDb3VudCA9XG4gICAgICBzZWxlY3RlZFBvaW50SW5kaWNlcyA9PSBudWxsID8gMCA6IHNlbGVjdGVkUG9pbnRJbmRpY2VzLmxlbmd0aDtcbiAgICBjb25zdCBuZWlnaGJvckNvdW50ID1cbiAgICAgIG5laWdoYm9yc09mRmlyc3RQb2ludCA9PSBudWxsID8gMCA6IG5laWdoYm9yc09mRmlyc3RQb2ludC5sZW5ndGg7XG4gICAgY29uc3QgY29sb3JzID0gbmV3IEZsb2F0MzJBcnJheShkcy5wb2ludHMubGVuZ3RoICogMyk7XG4gICAgbGV0IHVuc2VsZWN0ZWRDb2xvciA9IFBPSU5UX0NPTE9SX1VOU0VMRUNURUQ7XG4gICAgbGV0IG5vU2VsZWN0aW9uQ29sb3IgPSBQT0lOVF9DT0xPUl9OT19TRUxFQ1RJT047XG4gICAgaWYgKGxhYmVsM2RNb2RlKSB7XG4gICAgICB1bnNlbGVjdGVkQ29sb3IgPSBMQUJFTFNfM0RfQ09MT1JfVU5TRUxFQ1RFRDtcbiAgICAgIG5vU2VsZWN0aW9uQ29sb3IgPSBMQUJFTFNfM0RfQ09MT1JfTk9fU0VMRUNUSU9OO1xuICAgIH1cbiAgICBpZiAoc3ByaXRlSW1hZ2VNb2RlKSB7XG4gICAgICB1bnNlbGVjdGVkQ29sb3IgPSBTUFJJVEVfSU1BR0VfQ09MT1JfVU5TRUxFQ1RFRDtcbiAgICAgIG5vU2VsZWN0aW9uQ29sb3IgPSBTUFJJVEVfSU1BR0VfQ09MT1JfTk9fU0VMRUNUSU9OO1xuICAgIH1cblxuICAgIC8vIEdpdmUgYWxsIHBvaW50cyB0aGUgdW5zZWxlY3RlZCBjb2xvci5cbiAgICB7XG4gICAgICBjb25zdCBuID0gZHMucG9pbnRzLmxlbmd0aDtcbiAgICAgIGxldCBkc3QgPSAwO1xuICAgICAgaWYgKHNlbGVjdGVkUG9pbnRDb3VudCA+PSAwKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbjsgKytpKSB7XG4gICAgICAgICAgbGV0IHBvaW50ID0gZHMucG9pbnRzW2ldXG4gICAgICAgICAgbGV0IGMgPSBuZXcgVEhSRUUuQ29sb3IocG9pbnQuY29sb3IpXG4gICAgICAgICAgLy9maWx0ZXLkuYvlkI4g5Y+q5pyJdW5sYWJlbOaXoOminOiJslxuICAgICAgICAgIGlmICh3aW5kb3cucHJvcGVydGllcyAmJiB3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXSAmJiB3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXVtpXSA9PT0gMSkge1xuICAgICAgICAgICAgYyA9IG5ldyBUSFJFRS5Db2xvcih1bnNlbGVjdGVkQ29sb3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb2xvcnNbZHN0KytdID0gYy5yO1xuICAgICAgICAgIGNvbG9yc1tkc3QrK10gPSBjLmc7XG4gICAgICAgICAgY29sb3JzW2RzdCsrXSA9IGMuYjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGlmIChsZWdlbmRQb2ludENvbG9yZXIgIT0gbnVsbCkge1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbjsgKytpKSB7XG4gICAgICAgICAgICBsZXQgYyA9IG5ldyBUSFJFRS5Db2xvcihsZWdlbmRQb2ludENvbG9yZXIoZHMsIGkpKTtcbiAgICAgICAgICAgIC8vIGlmICh3aW5kb3cudW5MYWJlbERhdGE/Lmxlbmd0aCkge1xuICAgICAgICAgICAgLy8gICBpZiAod2luZG93LnVuTGFiZWxEYXRhLmluZGV4T2YoaSkgIT09IC0xKSB7XG4gICAgICAgICAgICAvLyAgICAgYyA9IG5ldyBUSFJFRS5Db2xvcihQT0lOVF9DT0xPUl9VTlNFTEVDVEVEKTtcbiAgICAgICAgICAgIC8vICAgfVxuICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgY29sb3JzW2RzdCsrXSA9IGMucjtcbiAgICAgICAgICAgIGNvbG9yc1tkc3QrK10gPSBjLmc7XG4gICAgICAgICAgICBjb2xvcnNbZHN0KytdID0gYy5iO1xuICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGMgPSBuZXcgVEhSRUUuQ29sb3Iobm9TZWxlY3Rpb25Db2xvcik7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyArK2kpIHtcbiAgICAgICAgICAgIGNvbG9yc1tkc3QrK10gPSBjLnI7XG4gICAgICAgICAgICBjb2xvcnNbZHN0KytdID0gYy5nO1xuICAgICAgICAgICAgY29sb3JzW2RzdCsrXSA9IGMuYjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgKHdpbmRvdy51bkxhYmVsRGF0YT8ubGVuZ3RoKSB7XG4gICAgLy8gICBjb25zdCBuID0gZHMucG9pbnRzLmxlbmd0aDtcbiAgICAvLyAgIGxldCBjID0gbmV3IFRIUkVFLkNvbG9yKFBPSU5UX0NPTE9SX1VOU0VMRUNURUQpO1xuICAgIC8vICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyBpKyspIHtcbiAgICAvLyAgICAgaWYgKHdpbmRvdy51bkxhYmVsRGF0YS5pbmRleE9mKGkpID49IDApIHtcbiAgICAvLyAgICAgICBsZXQgZHN0ID0gaSAqIDNcbiAgICAvLyAgICAgICBjb2xvcnNbZHN0KytdID0gYy5yO1xuICAgIC8vICAgICAgIGNvbG9yc1tkc3QrK10gPSBjLmc7XG4gICAgLy8gICAgICAgY29sb3JzW2RzdCsrXSA9IGMuYjtcbiAgICAvLyAgICAgfVxuICAgIC8vICAgfVxuICAgIC8vIH1cbiAgICAvLyBDb2xvciB0aGUgc2VsZWN0ZWQgcG9pbnRzLlxuICAgIHtcbiAgICAgIGNvbnN0IG4gPSBzZWxlY3RlZFBvaW50Q291bnQ7XG4gICAgICBjb25zdCBjID0gbmV3IFRIUkVFLkNvbG9yKFBPSU5UX0NPTE9SX1NFTEVDVEVEKTtcbiAgICAgIGlmICh3aW5kb3cuaXNBbmltYXRhdGluZykge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG47ICsraSkge1xuICAgICAgICAgIGNvbnN0IGMgPSBuZXcgVEhSRUUuQ29sb3IoZHMucG9pbnRzW2ldLmNvbG9yKTtcbiAgICAgICAgICBsZXQgZHN0ID0gc2VsZWN0ZWRQb2ludEluZGljZXNbaV0gKiAzO1xuICAgICAgICAgIGNvbG9yc1tkc3QrK10gPSBjLnI7XG4gICAgICAgICAgY29sb3JzW2RzdCsrXSA9IGMuZztcbiAgICAgICAgICBjb2xvcnNbZHN0KytdID0gYy5iO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG47ICsraSkge1xuICAgICAgICAgIGxldCBkc3QgPSBzZWxlY3RlZFBvaW50SW5kaWNlc1tpXSAqIDM7XG4gICAgICAgICAgY29sb3JzW2RzdCsrXSA9IGMucjtcbiAgICAgICAgICBjb2xvcnNbZHN0KytdID0gYy5nO1xuICAgICAgICAgIGNvbG9yc1tkc3QrK10gPSBjLmI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gQ29sb3IgdGhlIG5laWdoYm9ycy5cbiAgICB7XG4gICAgICBjb25zdCBuID0gbmVpZ2hib3JDb3VudDtcbiAgICAgIGxldCBtaW5EaXN0ID0gbiA+IDAgPyBuZWlnaGJvcnNPZkZpcnN0UG9pbnRbMF0uZGlzdCA6IDA7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG47ICsraSkge1xuICAgICAgICBjb25zdCBjID0gbmV3IFRIUkVFLkNvbG9yKFxuICAgICAgICAgIGRpc3QyY29sb3IoZGlzdEZ1bmMsIG5laWdoYm9yc09mRmlyc3RQb2ludFtpXS5kaXN0LCBtaW5EaXN0KVxuICAgICAgICApO1xuICAgICAgICBsZXQgZHN0ID0gbmVpZ2hib3JzT2ZGaXJzdFBvaW50W2ldLmluZGV4ICogMztcbiAgICAgICAgY29sb3JzW2RzdCsrXSA9IGMucjtcbiAgICAgICAgY29sb3JzW2RzdCsrXSA9IGMuZztcbiAgICAgICAgY29sb3JzW2RzdCsrXSA9IGMuYjtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gQ29sb3IgdGhlIHVubGFiZWxlZCBwb2ludHMuXG5cbi8vICAgICBpZiAod2luZG93LmlzRmlsdGVyKSB7XG4vLyAgICAgICBsZXQgZHN0ID0gMDtcbi8vICAgICAgIGNvbnN0IGMgPSBuZXcgVEhSRUUuQ29sb3IoUE9JTlRfQ09MT1JfU0VMRUNURUQpO1xuLy8gICAgICAgY29uc3QgY19uID0gbmV3IFRIUkVFLkNvbG9yKHVuc2VsZWN0ZWRDb2xvcik7XG4vLyAgICAgICBjb25zdCBjX3cgPSBuZXcgVEhSRUUuQ29sb3IoMHhmZmZmZmYpO1xuLy8gICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkcy5wb2ludHMubGVuZ3RoOyArK2kpIHtcbi8vICAgICAgICAgY29uc3QgcG9pbnQgPSBkcy5wb2ludHNbaV07XG4vLyAgICAgICAgIGNvbG9yc1tkc3QrK10gPSBjLnI7XG4vLyAgICAgICAgIGNvbG9yc1tkc3QrK10gPSBjLmc7XG4vLyAgICAgICAgIGNvbG9yc1tkc3QrK10gPSBjLmI7XG4vLyAgICAgICAgIGlmIChwb2ludC5tZXRhZGF0YVt0aGlzLmxhYmVsUG9pbnRBY2Nlc3Nvcl0pIHtcbi8vICAgICAgICAgICBsZXQgaG92ZXJUZXh0ID0gcG9pbnQubWV0YWRhdGFbdGhpcy5sYWJlbFBvaW50QWNjZXNzb3JdLnRvU3RyaW5nKCk7XG4vLyAgICAgICAgICAgaWYgKGhvdmVyVGV4dCA9PSAnYmFja2dyb3VuZCcpIHtcbi8vICAgICAgICAgICAgIGlmICh3aW5kb3cuaGlkZGVuQmFja2dyb3VuZCkge1xuLy8gICAgICAgICAgICAgICBsZXQgZHN0ID0gaSAqIDNcbi8vICAgICAgICAgICAgICAgY29sb3JzW2RzdCsrXSA9IGNfdy5yO1xuLy8gICAgICAgICAgICAgICBjb2xvcnNbZHN0KytdID0gY193Lmc7XG4vLyAgICAgICAgICAgICAgIGNvbG9yc1tkc3QrK10gPSBjX3cuYjtcbi8vICAgICAgICAgICAgIH0gZWxzZSB7XG4vLyAgICAgICAgICAgICAgIGxldCBkc3QgPSBpICogM1xuLy8gICAgICAgICAgICAgICBjb2xvcnNbZHN0KytdID0gY19uLnI7XG4vLyAgICAgICAgICAgICAgIGNvbG9yc1tkc3QrK10gPSBjX24uZztcbi8vICAgICAgICAgICAgICAgY29sb3JzW2RzdCsrXSA9IGNfbi5iO1xuLy8gICAgICAgICAgICAgfVxuLy8gICAgICAgICAgIH1cbi8vICAgICAgICAgfVxuLy8gICAgICAgfVxuLy8gICAgICAgLy8gcmV0dXJuIGNvbG9yc1xuLy8gICAgIH1cbiAgICAvL1xuICAgIC8vIGlmICh3aW5kb3cuaXNBbmltYXRhdGluZykge1xuICAgIC8vICAgY29uc3QgbiA9IGRzLnBvaW50cy5sZW5ndGg7XG4gICAgLy8gICBjb25zdCBjID0gbmV3IFRIUkVFLkNvbG9yKFBPSU5UX0NPTE9SX1VOU0VMRUNURUQpO1xuICAgIC8vICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyArK2kpIHtcbiAgICAvLyAgICAgaWYgKHNlbGVjdGVkUG9pbnRJbmRpY2VzLmluZGV4T2YoaSkgPT09IC0xKSB7XG4gICAgLy8gICAgICAgbGV0IGRzdCA9IGkgKiAzO1xuICAgIC8vICAgICAgIGNvbG9yc1tkc3QrK10gPSBjLnI7XG4gICAgLy8gICAgICAgY29sb3JzW2RzdCsrXSA9IGMuZztcbiAgICAvLyAgICAgICBjb2xvcnNbZHN0KytdID0gYy5iO1xuICAgIC8vICAgICB9IGVsc2Uge1xuICAgIC8vICAgICAgIGNvbnN0IGMgPSBuZXcgVEhSRUUuQ29sb3IoZHMucG9pbnRzW2ldLmNvbG9yKTtcbiAgICAvLyAgICAgICBsZXQgZHN0ID0gaSAqIDM7XG4gICAgLy8gICAgICAgY29sb3JzW2RzdCsrXSA9IGMucjtcbiAgICAvLyAgICAgICBjb2xvcnNbZHN0KytdID0gYy5nO1xuICAgIC8vICAgICAgIGNvbG9yc1tkc3QrK10gPSBjLmI7XG4gICAgLy8gICAgIH1cbiAgICAvLyAgIH1cbiAgICAvLyB9XG5cbiAgICBpZiAoIXdpbmRvdy5pc0FuaW1hdGF0aW5nICYmIHdpbmRvdy5jdXN0b21TZWxlY3Rpb24/Lmxlbmd0aCAmJiB3aW5kb3cuaXNBZGp1c3RpbmdTZWwpIHtcbiAgICAgIGNvbnN0IG4gPSBkcy5wb2ludHMubGVuZ3RoO1xuICAgICAgbGV0IGMgPSBuZXcgVEhSRUUuQ29sb3IoUE9JTlRfQ1VTVE9NX1NFTEVDVEVEKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgIGlmICh3aW5kb3cuY3VzdG9tU2VsZWN0aW9uLmluZGV4T2YoaSkgPj0gMCkge1xuICAgICAgICAgIGxldCBkc3QgPSBpICogM1xuICAgICAgICAgIGNvbG9yc1tkc3QrK10gPSBjLnI7XG4gICAgICAgICAgY29sb3JzW2RzdCsrXSA9IGMuZztcbiAgICAgICAgICBjb2xvcnNbZHN0KytdID0gYy5iO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ29sb3IgdGhlIGhvdmVyIHBvaW50LlxuICAgIC8vIGlmIChob3ZlclBvaW50SW5kZXggIT0gbnVsbCkge1xuICAgIC8vICAgbGV0IGMgPSBuZXcgVEhSRUUuQ29sb3IoUE9JTlRfQ09MT1JfSE9WRVIpO1xuICAgIC8vICAgbGV0IGRzdCA9IGhvdmVyUG9pbnRJbmRleCAqIDM7XG4gICAgLy8gICBjb2xvcnNbZHN0KytdID0gYy5yO1xuICAgIC8vICAgY29sb3JzW2RzdCsrXSA9IGMuZztcbiAgICAvLyAgIGNvbG9yc1tkc3QrK10gPSBjLmI7XG4gICAgLy8gfVxuICAgIHJldHVybiBjb2xvcnM7XG4gIH1cbiAgZ2VuZXJhdGUzRExhYmVsc0FycmF5KGRzOiBEYXRhU2V0LCBhY2Nlc3Nvcjogc3RyaW5nKSB7XG4gICAgaWYgKGRzID09IG51bGwgfHwgYWNjZXNzb3IgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGxldCBsYWJlbHM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgbiA9IGRzLnBvaW50cy5sZW5ndGg7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyArK2kpIHtcbiAgICAgIGxhYmVscy5wdXNoKHRoaXMuZ2V0TGFiZWxUZXh0KGRzLCBpLCBhY2Nlc3NvcikpO1xuICAgIH1cbiAgICByZXR1cm4gbGFiZWxzO1xuICB9XG4gIHByaXZhdGUgZ2V0TGFiZWxUZXh0KGRzOiBEYXRhU2V0LCBpOiBudW1iZXIsIGFjY2Vzc29yOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGlmICh3aW5kb3cuY3VzdG9tU2VsZWN0aW9uPy5sZW5ndGgpIHtcbiAgICAgIGlmICh3aW5kb3cucmVqZWN0SW5kaWNhdGVzICYmIHdpbmRvdy5yZWplY3RJbmRpY2F0ZXMuaW5kZXhPZihpKSA+PSAwKSB7XG4gICAgICAgIHJldHVybiBg4p2MICR7aX1gXG4gICAgICB9XG4gICAgICBpZiAod2luZG93LmFjY2VwdEluZGljYXRlcyAmJiB3aW5kb3cuYWNjZXB0SW5kaWNhdGVzLmluZGV4T2YoaSkgPj0gMCkge1xuICAgICAgICByZXR1cm4gYOKchSAke2l9YFxuICAgICAgfVxuICAgIH1cbiAgICBpZiAod2luZG93LnF1ZXJ5UmVzQW5vcm1hbEluZGVjYXRlcz8ubGVuZ3RoICYmIHdpbmRvdy5xdWVyeVJlc0Fub3JtYWxJbmRlY2F0ZXMuaW5kZXhPZihpKSA+PSAwKSB7XG4gICAgICBpZiAod2luZG93LmlzQW5pbWF0YXRpbmcgJiYgd2luZG93LmN1c3RvbVNlbGVjdGlvbi5pbmRleE9mKGkpID09IC0xKSB7XG4gICAgICAgIHJldHVybiBgYFxuICAgICAgfWVsc2V7XG4gICAgICAgIHJldHVybiBg8J+RjSR7aX1gXG4gICAgICB9XG4gICAgfVxuICAgIGlmICh3aW5kb3cucXVlcnlSZXNBbm9ybWFsQ2xlYW5JbmRlY2F0ZXM/Lmxlbmd0aCkge1xuICAgICAgaWYgKHdpbmRvdy5xdWVyeVJlc0Fub3JtYWxDbGVhbkluZGVjYXRlcy5pbmRleE9mKGkpID49IDApIHtcbiAgICAgICAgcmV0dXJuIGDwn5+iY2xlYW5gXG4gICAgICB9XG4gICAgfVxuXG5cbiAgICBpZiAod2luZG93LmFsUXVlcnlSZXNQb2ludEluZGljZXM/Lmxlbmd0aCkge1xuICAgICAgaWYgKHdpbmRvdy5hbFF1ZXJ5UmVzUG9pbnRJbmRpY2VzPy5pbmRleE9mKGkpICE9PSAtMSkge1xuICAgICAgICByZXR1cm4gYPCfkY0gJHtpfWBcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHdpbmRvdy5xdWVyeVJlc1BvaW50SW5kaWNlcz8ubGVuZ3RoKSB7XG4gICAgICBpZiAod2luZG93LnF1ZXJ5UmVzUG9pbnRJbmRpY2VzPy5pbmRleE9mKGkpICE9PSAtMSkge1xuICAgICAgICAvLyByZXR1cm4gZHMucG9pbnRzW2ldPy5tZXRhZGF0YVthY2Nlc3Nvcl0gIT09IHVuZGVmaW5lZFxuICAgICAgICAvLyAgID8gKGRzLnBvaW50c1tpXT8ubWV0YWRhdGFbYWNjZXNzb3JdICE9PSBcImJhY2tncm91bmRcIiA/IFN0cmluZyhkcy5wb2ludHNbaV0/Lm1ldGFkYXRhW2FjY2Vzc29yXSkgOiBcIlwiKVxuICAgICAgICAvLyAgIDogYFVua25vd24gIyR7aX1gO1xuICAgICAgICByZXR1cm4gYCR7aX1gXG4gICAgICB9XG4gICAgfVxuICAgIGlmICh3aW5kb3cuaXNBZGp1c3RpbmdTZWwgJiYgd2luZG93LnNlc3Npb25TdG9yYWdlLmlzQ29udHJvbEdyb3VwICE9PSd0cnVlJykge1xuICAgICAgaWYgKGRzLnBvaW50c1tpXT8ubWV0YWRhdGFbYWNjZXNzb3JdICE9PSB1bmRlZmluZWQgJiYgZHMucG9pbnRzW2ldPy5jdXJyZW50X3ByZWRpY3Rpb24gIT09IGRzLnBvaW50c1tpXT8ubWV0YWRhdGFbYWNjZXNzb3JdKSB7XG4gICAgICAgIHJldHVybiBgICR7aX1gXG4gICAgICB9XG4gICAgfVxuICAgIGlmICh3aW5kb3cucHJvcGVydGllcyAmJiB3aW5kb3cucHJvcGVydGllc1t3aW5kb3cuaXRlcmF0aW9uXT8ubGVuZ3RoKSB7XG4gICAgICBpZiAod2luZG93LnByb3BlcnRpZXNbd2luZG93Lml0ZXJhdGlvbl1baV0gPT09IDEpIHtcbiAgICAgICAgcmV0dXJuIGAjJHtpfWBcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGAke2l9YFxuICAgIC8vIHJldHVybiBkcy5wb2ludHNbaV0/Lm1ldGFkYXRhW2FjY2Vzc29yXSAhPT0gdW5kZWZpbmVkXG4gICAgLy8gICA/IChkcy5wb2ludHNbaV0/Lm1ldGFkYXRhW2FjY2Vzc29yXSAhPT0gXCJiYWNrZ3JvdW5kXCIgPyBTdHJpbmcoZHMucG9pbnRzW2ldPy5tZXRhZGF0YVthY2Nlc3Nvcl0pIDogXCJcIilcbiAgICAvLyAgIDogYFVua25vd24gIyR7aX1gO1xuICB9XG4gIHByaXZhdGUgdXBkYXRlU2NhdHRlclBsb3RXaXRoTmV3UHJvamVjdGlvbihwcm9qZWN0aW9uOiBQcm9qZWN0aW9uKSB7XG4gICAgaWYgKHByb2plY3Rpb24gPT0gbnVsbCkge1xuICAgICAgdGhpcy5jcmVhdGVWaXN1YWxpemVycyh0aGlzLnJlbmRlckxhYmVsc0luM0QpO1xuICAgICAgdGhpcy5zY2F0dGVyUGxvdC5yZW5kZXIoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5zZXREYXRhU2V0KHByb2plY3Rpb24uZGF0YVNldCk7XG4gICAgdGhpcy5zY2F0dGVyUGxvdC5zZXREaW1lbnNpb25zKHByb2plY3Rpb24uZGltZW5zaW9uYWxpdHkpO1xuICAgIGlmIChwcm9qZWN0aW9uLmRhdGFTZXQucHJvamVjdGlvbkNhbkJlUmVuZGVyZWQocHJvamVjdGlvbi5wcm9qZWN0aW9uVHlwZSkpIHtcbiAgICAgIHRoaXMudXBkYXRlU2NhdHRlclBsb3RBdHRyaWJ1dGVzKCk7XG4gICAgICB0aGlzLm5vdGlmeVByb2plY3Rpb25Qb3NpdGlvbnNVcGRhdGVkKCk7XG4gICAgfVxuICAgIHRoaXMuc2NhdHRlclBsb3Quc2V0Q2FtZXJhUGFyYW1ldGVyc0Zvck5leHRDYW1lcmFDcmVhdGlvbihudWxsLCBmYWxzZSk7XG4gIH1cbiAgcHJpdmF0ZSBjcmVhdGVWaXN1YWxpemVycyhpbkxhYmVsczNETW9kZTogYm9vbGVhbiwgcmVuZGVySW5UcmlhbmdsZT86IGJvb2xlYW4pIHtcbiAgICBjb25zdCBkcyA9IHRoaXMucHJvamVjdGlvbiA9PSBudWxsID8gbnVsbCA6IHRoaXMucHJvamVjdGlvbi5kYXRhU2V0O1xuICAgIGNvbnN0IHNjYXR0ZXJQbG90ID0gdGhpcy5zY2F0dGVyUGxvdDtcbiAgICBzY2F0dGVyUGxvdC5yZW1vdmVBbGxWaXN1YWxpemVycygpO1xuICAgIHRoaXMubGFiZWxzM0RWaXN1YWxpemVyID0gbnVsbDtcbiAgICB0aGlzLmNhbnZhc0xhYmVsc1Zpc3VhbGl6ZXIgPSBudWxsO1xuICAgIHRoaXMuc3ByaXRlVmlzdWFsaXplciA9IG51bGw7XG4gICAgdGhpcy5wb2x5bGluZVZpc3VhbGl6ZXIgPSBudWxsO1xuICAgIC8vIHRoaXMudHJpYW5nbGVzID0gbmV3IHNjYXR0ZXJQbG90VmlzdWFsaXplclRyaWFuZ2xlcygpO1xuICAgIC8vIHRoaXMudHJpYW5nbGVzLnNldFNlbGVjdGVkUG9pbnQodGhpcy5zZWxlY3RlZFBvaW50SW5kaWNlcyk7XG4gICAgdGhpcy5zcHJpdGVWaXN1YWxpemVyID0gbmV3IFNjYXR0ZXJQbG90VmlzdWFsaXplclNwcml0ZXMoKTtcbiAgICBpZiAoaW5MYWJlbHMzRE1vZGUpIHtcbiAgICAgIHRoaXMubGFiZWxzM0RWaXN1YWxpemVyID0gbmV3IFNjYXR0ZXJQbG90VmlzdWFsaXplcjNETGFiZWxzKCk7XG4gICAgICB0aGlzLmxhYmVsczNEVmlzdWFsaXplci5zZXRMYWJlbFN0cmluZ3MoXG4gICAgICAgIHRoaXMuZ2VuZXJhdGUzRExhYmVsc0FycmF5KGRzLCB0aGlzLmxhYmVsUG9pbnRBY2Nlc3NvcilcbiAgICAgICk7XG4gICAgfSBlbHNlIGlmIChyZW5kZXJJblRyaWFuZ2xlKSB7XG5cbiAgICAgIHNjYXR0ZXJQbG90LmFkZFZpc3VhbGl6ZXIodGhpcy5zcHJpdGVWaXN1YWxpemVyKTtcbiAgICAgIHRoaXMudHJpYW5nbGVzID0gbmV3IHNjYXR0ZXJQbG90VmlzdWFsaXplclRyaWFuZ2xlcygpO1xuICAgICAgdGhpcy50cmlhbmdsZXMuc2V0U2VsZWN0ZWRQb2ludCh0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzKTtcbiAgICAgIHRoaXMuY2FudmFzTGFiZWxzVmlzdWFsaXplciA9IG5ldyBTY2F0dGVyUGxvdFZpc3VhbGl6ZXJDYW52YXNMYWJlbHMoXG4gICAgICAgIHRoaXMuc2NhdHRlclBsb3RDb250YWluZXJcbiAgICAgICk7XG4gICAgICAvLyB0aGlzLnRyaWFuZ2xlcy5zZXRMYWJlbFN0cmluZ3MoXG4gICAgICAvLyAgIHRoaXMuZ2VuZXJhdGUzRExhYmVsc0FycmF5KGRzLCB0aGlzLmxhYmVsUG9pbnRBY2Nlc3NvcilcbiAgICAgIC8vICk7XG4gICAgfSBlbHNlIGlmICh0aGlzLnJlbmRlckluVHJhY2VMaW5lKSB7XG4gICAgICB0aGlzLnRyYWNlTGluZSA9IG5ldyBzY2F0dGVyUGxvdFZpc3VhbGl6ZXJUcmFjZUxpbmUoKVxuICAgICAgdGhpcy50cmFjZUxpbmUuc2V0RXBvY2hlcyh0aGlzLnRyYWNlTGluZUVwb2NoKVxuICAgICAgdGhpcy50cmFjZUxpbmUuc2V0U2VsZWN0ZWRQb2ludCh0aGlzLnNlbGVjdGVkUG9pbnRJbmRpY2VzKTtcbiAgICAgIHRoaXMuY2FudmFzTGFiZWxzVmlzdWFsaXplciA9IG5ldyBTY2F0dGVyUGxvdFZpc3VhbGl6ZXJDYW52YXNMYWJlbHMoXG4gICAgICAgIHRoaXMuc2NhdHRlclBsb3RDb250YWluZXJcbiAgICAgICk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgc2NhdHRlclBsb3QuYWRkVmlzdWFsaXplcih0aGlzLnNwcml0ZVZpc3VhbGl6ZXIpO1xuICAgICAgdGhpcy50cmlhbmdsZXMgPSBuZXcgc2NhdHRlclBsb3RWaXN1YWxpemVyVHJpYW5nbGVzKCk7XG4gICAgICB0aGlzLnRyaWFuZ2xlcy5zZXRTZWxlY3RlZFBvaW50KHRoaXMuc2VsZWN0ZWRQb2ludEluZGljZXMpO1xuICAgICAgdGhpcy5jYW52YXNMYWJlbHNWaXN1YWxpemVyID0gbmV3IFNjYXR0ZXJQbG90VmlzdWFsaXplckNhbnZhc0xhYmVscyhcbiAgICAgICAgdGhpcy5zY2F0dGVyUGxvdENvbnRhaW5lclxuICAgICAgKTtcbiAgICB9XG4gICAgdGhpcy5wb2x5bGluZVZpc3VhbGl6ZXIgPSBuZXcgU2NhdHRlclBsb3RWaXN1YWxpemVyUG9seWxpbmVzKCk7XG4gICAgdGhpcy5zZXREYXRhU2V0KGRzKTtcbiAgICBpZiAodGhpcy5zcHJpdGVWaXN1YWxpemVyKSB7XG4gICAgICBzY2F0dGVyUGxvdC5hZGRWaXN1YWxpemVyKHRoaXMuc3ByaXRlVmlzdWFsaXplcik7XG4gICAgfVxuICAgIGlmICh0aGlzLmxhYmVsczNEVmlzdWFsaXplcikge1xuICAgICAgc2NhdHRlclBsb3QuYWRkVmlzdWFsaXplcih0aGlzLmxhYmVsczNEVmlzdWFsaXplcik7XG4gICAgfVxuICAgIGlmICh0aGlzLnJlbmRlckluVHJpYW5nbGUpIHtcbiAgICAgIHNjYXR0ZXJQbG90LmFkZFZpc3VhbGl6ZXIodGhpcy50cmlhbmdsZXMpXG4gICAgfVxuICAgIGlmICh0aGlzLnJlbmRlckluVHJhY2VMaW5lKSB7XG4gICAgICBzY2F0dGVyUGxvdC5hZGRWaXN1YWxpemVyKHRoaXMudHJhY2VMaW5lKVxuICAgIH1cbiAgICBpZiAodGhpcy5jYW52YXNMYWJlbHNWaXN1YWxpemVyKSB7XG4gICAgICBzY2F0dGVyUGxvdC5hZGRWaXN1YWxpemVyKHRoaXMuY2FudmFzTGFiZWxzVmlzdWFsaXplcik7XG4gICAgfVxuICAgIHNjYXR0ZXJQbG90LmFkZFZpc3VhbGl6ZXIodGhpcy5wb2x5bGluZVZpc3VhbGl6ZXIpO1xuICB9XG4gIHByaXZhdGUgZ2V0U3ByaXRlSW1hZ2VNb2RlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgICBpZiAodGhpcy5wcm9qZWN0aW9uID09IG51bGwpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgY29uc3QgZHMgPSB0aGlzLnByb2plY3Rpb24uZGF0YVNldDtcbiAgICBpZiAoZHMgPT0gbnVsbCB8fCBkcy5zcHJpdGVBbmRNZXRhZGF0YUluZm8gPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gZHMuc3ByaXRlQW5kTWV0YWRhdGFJbmZvLnNwcml0ZUltYWdlICE9IG51bGw7XG4gIH1cbn1cbmZ1bmN0aW9uIHBhY2tSZ2JJbnRvVWludDhBcnJheShcbiAgcmdiQXJyYXk6IFVpbnQ4QXJyYXksXG4gIGxhYmVsSW5kZXg6IG51bWJlcixcbiAgcjogbnVtYmVyLFxuICBnOiBudW1iZXIsXG4gIGI6IG51bWJlclxuKSB7XG4gIHJnYkFycmF5W2xhYmVsSW5kZXggKiAzXSA9IHI7XG4gIHJnYkFycmF5W2xhYmVsSW5kZXggKiAzICsgMV0gPSBnO1xuICByZ2JBcnJheVtsYWJlbEluZGV4ICogMyArIDJdID0gYjtcbn1cbmZ1bmN0aW9uIHN0eWxlUmdiRnJvbUhleENvbG9yKGhleDogbnVtYmVyKTogW251bWJlciwgbnVtYmVyLCBudW1iZXJdIHtcbiAgY29uc3QgYyA9IG5ldyBUSFJFRS5Db2xvcihoZXgpO1xuICByZXR1cm4gWyhjLnIgKiAyNTUpIHwgMCwgKGMuZyAqIDI1NSkgfCAwLCAoYy5iICogMjU1KSB8IDBdO1xufVxuZnVuY3Rpb24gZ2V0RGVmYXVsdFBvaW50SW5Qb2x5bGluZUNvbG9yKFxuICBpbmRleDogbnVtYmVyLFxuICB0b3RhbFBvaW50czogbnVtYmVyXG4pOiBUSFJFRS5Db2xvciB7XG4gIGxldCBodWUgPVxuICAgIFBPTFlMSU5FX1NUQVJUX0hVRSArXG4gICAgKChQT0xZTElORV9FTkRfSFVFIC0gUE9MWUxJTkVfU1RBUlRfSFVFKSAqIGluZGV4KSAvIHRvdGFsUG9pbnRzO1xuICBsZXQgcmdiID0gZDMuaHNsKGh1ZSwgUE9MWUxJTkVfU0FUVVJBVElPTiwgUE9MWUxJTkVfTElHSFRORVNTKS5yZ2IoKTtcbiAgcmV0dXJuIG5ldyBUSFJFRS5Db2xvcihyZ2IuciAvIDI1NSwgcmdiLmcgLyAyNTUsIHJnYi5iIC8gMjU1KTtcbn1cbi8qKlxuICogTm9ybWFsaXplcyB0aGUgZGlzdGFuY2Ugc28gaXQgY2FuIGJlIHZpc3VhbGx5IGVuY29kZWQgd2l0aCBjb2xvci5cbiAqIFRoZSBub3JtYWxpemF0aW9uIGRlcGVuZHMgb24gdGhlIGRpc3RhbmNlIG1ldHJpYyAoY29zaW5lIHZzIGV1Y2xpZGVhbikuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVEaXN0KFxuICBkaXN0RnVuYzogRGlzdGFuY2VGdW5jdGlvbixcbiAgZDogbnVtYmVyLFxuICBtaW5EaXN0OiBudW1iZXJcbik6IG51bWJlciB7XG4gIHJldHVybiBkaXN0RnVuYyA9PT0gdmVjdG9yLmRpc3QgPyBtaW5EaXN0IC8gZCA6IDEgLSBkO1xufVxuLyoqIE5vcm1hbGl6ZXMgYW5kIGVuY29kZXMgdGhlIHByb3ZpZGVkIGRpc3RhbmNlIHdpdGggY29sb3IuICovXG5leHBvcnQgZnVuY3Rpb24gZGlzdDJjb2xvcihcbiAgZGlzdEZ1bmM6IERpc3RhbmNlRnVuY3Rpb24sXG4gIGQ6IG51bWJlcixcbiAgbWluRGlzdDogbnVtYmVyXG4pOiBzdHJpbmcge1xuICByZXR1cm4gTk5fQ09MT1JfU0NBTEUobm9ybWFsaXplRGlzdChkaXN0RnVuYywgZCwgbWluRGlzdCkpO1xufVxuIl19