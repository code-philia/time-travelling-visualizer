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

import { RenderContext } from './renderContext';
import { ScatterPlotVisualizer } from './scatterPlotVisualizer';
import * as util from './util';
const RGB_NUM_ELEMENTS = 3;
const XYZ_NUM_ELEMENTS = 3;
import {
  DataSet,
  DistanceFunction,
  Projection,
  State,
  ProjectionComponents3D,
} from './data';

declare global {
  interface Window {
    selectedList: any,
    scene: any,
    worldSpacePointPositions: any,
    isAnimatating: boolean | false
  }
}
const FONT_SIZE = 80;
const ONE_OVER_FONT_SIZE = 1 / FONT_SIZE;
const LABEL_SCALE = 2.2; // at 1:1 texel/pixel ratio
const LABEL_COLOR = 'black';
const LABEL_BACKGROUND = 'white';
const MAX_CANVAS_DIMENSION = 8192;
const NUM_GLYPHS = 256;
const RGB_ELEMENTS_PER_ENTRY = 3;
const XYZ_ELEMENTS_PER_ENTRY = 3;
const UV_ELEMENTS_PER_ENTRY = 2;
const VERTICES_PER_GLYPH = 2 * 3; // 2 triangles, 3 verts per triangle
const SCATTER_PLOT_CUBE_LENGTH = 2;
/**
 * Each label is made up of triangles (two per letter.) Each vertex, then, is
 * the corner of one of these triangles (and thus the corner of a letter
 * rectangle.)
 * Each has the following attributes:
 *    posObj: The (x, y) position of the vertex within the label, where the
 *            bottom center of the word is positioned at (0, 0);
 *    position: The position of the label in worldspace.
 *    vUv: The (u, v) coordinates that index into the glyphs sheet (range 0, 1.)
 *    color: The color of the label (matches the corresponding point's color.)
 *    wordShown: Boolean. Whether or not the label is visible.
 */
const VERTEX_SHADER = `
    attribute vec2 posObj;
    attribute vec3 color;
    varying vec2 vUv;
    varying vec3 vColor;

    void main() {
      vUv = uv;
      vColor = color;

      // Rotate label to face camera.

      vec4 vRight = vec4(
        modelViewMatrix[0][0], modelViewMatrix[1][0], modelViewMatrix[2][0], 0);

      vec4 vUp = vec4(
        modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1], 0);

      vec4 vAt = -vec4(
        modelViewMatrix[0][2], modelViewMatrix[1][2], modelViewMatrix[2][2], 0);

      mat4 pointToCamera = mat4(vRight, vUp, vAt, vec4(0, 0, 0, 1));

      vec2 scaledPos = posObj * ${ONE_OVER_FONT_SIZE} * ${LABEL_SCALE};

      vec4 posRotated = pointToCamera * vec4(scaledPos, 0, 1);
      vec4 mvPosition = modelViewMatrix * (vec4(position, 0) + posRotated);
      gl_Position = projectionMatrix * mvPosition;
    }`;
const FRAGMENT_SHADER = `
    uniform sampler2D texture;
    uniform bool picking;
    varying vec2 vUv;
    varying vec3 vColor;

    void main() {
      if (picking) {
        gl_FragColor = vec4(vColor, 1.0);
      } else {
        vec4 fromTexture = texture2D(texture, vUv);
        gl_FragColor = vec4(vColor, 1.0) * fromTexture;
      }
    }`;
type GlyphTexture = {
  texture: THREE.Texture;
  lengths: Float32Array;
  offsets: Float32Array;
};
/**
 * Renders the text labels as 3d geometry in the world.
 */
export class scatterPlotVisualizerTraceLine implements ScatterPlotVisualizer {
  private scene: THREE.Scene;
  // private labelStrings: string[];
  private geometry: THREE.BufferGeometry;
  private linegeometry: THREE.BufferGeometry;
  private linesContainer: any;
  private worldSpacePointPositions: Float32Array;
  private pickingColors: Float32Array;
  private renderColors: Float32Array;
  private material: THREE.ShaderMaterial;
  private uniforms: any;
  private pointsMesh: THREE.Mesh;
  private positions: THREE.BufferAttribute;
  private totalVertexCount: number;
  private labelVertexMap: number[][];
  private glyphTexture: GlyphTexture;
  private selectedIndexList: number[]
  private epoches: number[]


  private polylines: THREE.Line[];
  private polylinePositionBuffer: {
    [polylineIndex: number]: THREE.BufferAttribute;
  } = {};
  private polylineColorBuffer: {
    [polylineIndex: number]: THREE.BufferAttribute;
  } = {};

  private polylinegemo: {
    [polylineIndex: number]: THREE.Geometry;
  } = {};


  private createGlyphTexture(): GlyphTexture {
    let canvas = document.createElement('canvas');
    canvas.width = MAX_CANVAS_DIMENSION;
    canvas.height = FONT_SIZE;
    let ctx = canvas.getContext('2d');
    ctx.font = 'bold ' + FONT_SIZE * 0.75 + 'px roboto';
    ctx.textBaseline = 'top';
    ctx.fillStyle = LABEL_BACKGROUND;
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fill();
    ctx.fillStyle = LABEL_COLOR;
    let spaceOffset = ctx.measureText(' ').width;
    // For each letter, store length, position at the encoded index.
    let glyphLengths = new Float32Array(NUM_GLYPHS);
    let glyphOffset = new Float32Array(NUM_GLYPHS);
    let leftCoord = 0;
    for (let i = 0; i < NUM_GLYPHS; i++) {
      let text = ' ' + String.fromCharCode(i);
      let textLength = ctx.measureText(text).width;
      glyphLengths[i] = textLength - spaceOffset;
      glyphOffset[i] = leftCoord;
      ctx.fillText(text, leftCoord - spaceOffset, 0);
      leftCoord += textLength;
    }
    const tex = util.createTexture(canvas);
    return { texture: tex, lengths: glyphLengths, offsets: glyphOffset };
  }
  private processLabelVerts(pointCount: number) {
    let numTotalLetters = 0;
    this.labelVertexMap = [];
    for (let i = 0; i < pointCount; i++) {
      const label = '13';
      let vertsArray: number[] = [];
      for (let j = 0; j < label.length; j++) {
        for (let k = 0; k < VERTICES_PER_GLYPH; k++) {
          vertsArray.push(numTotalLetters * VERTICES_PER_GLYPH + k);
        }
        numTotalLetters++;
      }
      this.labelVertexMap.push(vertsArray);
    }
    this.totalVertexCount = numTotalLetters * VERTICES_PER_GLYPH;
  }
  private createColorBuffers(pointCount: number) {
    this.pickingColors = new Float32Array(
      this.totalVertexCount * RGB_ELEMENTS_PER_ENTRY
    );
    this.renderColors = new Float32Array(
      this.totalVertexCount * RGB_ELEMENTS_PER_ENTRY
    );
    for (let i = 0; i < pointCount; i++) {
      let color = new THREE.Color(i);
      this.labelVertexMap[i].forEach((j) => {
        this.pickingColors[RGB_ELEMENTS_PER_ENTRY * j] = color.r;
        this.pickingColors[RGB_ELEMENTS_PER_ENTRY * j + 1] = color.g;
        this.pickingColors[RGB_ELEMENTS_PER_ENTRY * j + 2] = color.b;
        this.renderColors[RGB_ELEMENTS_PER_ENTRY * j] = 1;
        this.renderColors[RGB_ELEMENTS_PER_ENTRY * j + 1] = 1;
        this.renderColors[RGB_ELEMENTS_PER_ENTRY * j + 2] = 1;
      });
    }
  }
  getPosition(points, epoch) {
    const ds = new DataSet(points)
    // projection == null ? null : this.projection.projectionComponents;
    const newPositions = this.generatePointPositionArray(
      ds, epoch
    );
    return newPositions
  }
  generatePointPositionArray(
    ds: DataSet,
    epoch: number
  ): Float32Array {
    if (ds == null) {
      return null;
    }
    const xScaler = d3.scaleLinear();
    const yScaler = d3.scaleLinear();
    let zScaler = null;
    {
      // Determine max and min of each axis of our data.
      const xExtent = d3.extent(
        ds.points,
        (p, i) => ds.points[i].DVI_projections[epoch][0]
      );
      const yExtent = d3.extent(
        ds.points,
        (p, i) => ds.points[i].DVI_projections[epoch][1]
      );
      const range = [
        -SCATTER_PLOT_CUBE_LENGTH / 2,
        SCATTER_PLOT_CUBE_LENGTH / 2,
      ];
      xScaler.domain(xExtent).range(range);
      yScaler.domain(yExtent).range(range);
      // if (projectionComponents[2] != null) {
      const zExtent = d3.extent(
        ds.points,
        (p, i) => ds.points[i].projections['tsne-2']
      );
      zScaler = d3.scaleLinear();
      zScaler.domain(zExtent).range(range);
      // }
      // }
      const positions = new Float32Array(ds.points.length * 3);
      let dst = 0;
      ds.points.forEach((d, i) => {
        positions[dst++] = xScaler(
          ds.points[i].DVI_projections[epoch][0]
        );
        positions[dst++] = yScaler(
          ds.points[i].DVI_projections[epoch][1]
        );
        positions[dst++] = 0;
      });
      if (zScaler) {
        dst = 2;
        ds.points.forEach((d, i) => {
          positions[dst] = zScaler(
            0
          );
          dst += 3;
        });
      }
      return positions;
    }
  }
  private createTriangles() {
    this.polylinegemo = []
    window.selectedList = this.selectedIndexList
    window.scene = this.scene

    if (this.worldSpacePointPositions == null) {
      return;
    }
    let len = this.epoches[1] - this.epoches[0]
    if (!window.worldSpacePointPositions) {
      window.worldSpacePointPositions = []
    }
    // let flag = true

    // for (let i = 1; i < window.worldSpacePointPositions.length; i++) {
    //   if (!window.worldSpacePointPositions[i]) {
    //     flag = false
    //     break
    //   }else{
    //     flag = true
    //   }
    // }
    // if (!flag) {
    window.worldSpacePointPositions[window.iteration] = this.worldSpacePointPositions
    // }
    const pointCount =
      this.worldSpacePointPositions?.length / XYZ_ELEMENTS_PER_ENTRY;
    this.glyphTexture = this.createGlyphTexture();
    this.uniforms = {
      texture: { type: 't' },
      picking: { type: 'bool' },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
    this.processLabelVerts(pointCount);
    this.createColorBuffers(pointCount);
    let positionArray = new Float32Array(
      this.totalVertexCount * XYZ_ELEMENTS_PER_ENTRY
    );
    this.positions = new THREE.BufferAttribute(
      positionArray,
      XYZ_ELEMENTS_PER_ENTRY
    );
    let posArray = new Float32Array(
      this.totalVertexCount * XYZ_ELEMENTS_PER_ENTRY
    );
    let colorsArray = new Float32Array(
      this.totalVertexCount * RGB_ELEMENTS_PER_ENTRY
    );
    let positionObject = new THREE.BufferAttribute(posArray, 2);
    let colors = new THREE.BufferAttribute(colorsArray, RGB_ELEMENTS_PER_ENTRY);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.addAttribute('posObj', positionObject);
    this.geometry.addAttribute('position', this.positions);
    this.geometry.addAttribute('color', colors);
    let lettersSoFar = 0;

    this.linegeometry = new THREE.BufferGeometry()
    this.polylines = [];
  //  if(window.worldSpacePointPositions?.length>1){
  //    // Set up the position buffer arrays for each polyline.
  //   const vertexCount = 2 * (window.worldSpacePointPositions.length);
  //   let polylinesBu = new Float32Array(vertexCount * XYZ_NUM_ELEMENTS);
  //   let colorsBu = new Float32Array(vertexCount * RGB_NUM_ELEMENTS);
  //   for (let i = 0; i < pointCount; i++) {
  //     if (this.selectedIndexList.indexOf(i) !== -1) {
  //       this.polylinePositionBuffer[i] = new THREE.BufferAttribute(
  //         polylinesBu,
  //         XYZ_NUM_ELEMENTS
  //       );

  //       this.polylineColorBuffer[i] = new THREE.BufferAttribute(
  //         colorsBu,
  //         RGB_NUM_ELEMENTS
  //       );
  //     }
  //   }
  //   console.log('this.polylinePositionBuffer', this.polylinePositionBuffer)
 
  //   for (let i = 0; i < pointCount; i++) {
  //     // for (let j = 0; j < pointCount; j++) {
  //     let src = 0;
  //     if (this.selectedIndexList.indexOf(i) !== -1) {
  //       for (let le = 1; le < window.worldSpacePointPositions.length; le++) {
  //         console.log('le', window.worldSpacePointPositions[le])
  //         if (this.selectedIndexList.indexOf(i) !== -1) {
  //           const p = util.vector3FromPackedArray(window.worldSpacePointPositions[le], i);
  //           console.log('ii,', p, this.polylinePositionBuffer[i])
  //           if (p) {
  //             this.polylinePositionBuffer[i].setXYZ(src++, p.x, p.y, p.z)
  //           }
  //           this.polylinePositionBuffer[i].needsUpdate = true;
  //         } else {
  //           //this.polylinePositionBuffer[i].setXYZ(src++, 0, 0, 0)
  //         }
  //       }
  //     }

  //   }
  //   console.log('this.polylinePositionBuffer111', this.polylinePositionBuffer)

  //   for (let i = 0; i < pointCount; i++) {
  //     if (this.selectedIndexList.indexOf(i) !== -1) {
  //       const geometry = new THREE.BufferGeometry();
  //       geometry.addAttribute('position', this.polylinePositionBuffer[i]);
  //       geometry.addAttribute('color', this.polylineColorBuffer[i]);
  //       console.log('1111',geometry)
  //       const material = new THREE.LineBasicMaterial({
  //         linewidth: 1, // unused default, overwritten by width array.
  //         opacity: 1.0, // unused default, overwritten by opacity array.
  //         transparent: true,
  //         vertexColors: THREE.VertexColors as any,
  //       });
  //       const polyline = new THREE.LineSegments(geometry, material);
  //       polyline.frustumCulled = false;
  //       this.polylines.push(polyline);
  //       this.scene.add(polyline);
  //     }
  //   }

  //  }
    //加2000个顶点，范围为-1到1
    let start = this.epoches[0]
    let end = this.epoches[1]
   
    let getPos = this.getPosition(window.DVIDataList[end], start)
    let getPos2 = this.getPosition(window.DVIDataList[end], end)
    let posArr = []
    for (let i = start; i <= end; i++) {
      let getPos = this.getPosition(window.DVIDataList[end], i)
      posArr.push(getPos)
    }
    let drawed = []
    let selectedLen
    // if (selectedLen !== this.selectedIndexList?.length ) {
    // let count = 0,des = 0
    selectedLen = this.selectedIndexList?.length
    
    for (let i = 0; i < pointCount; i++) {

      if (this.selectedIndexList?.length && this.selectedIndexList.indexOf(i) !== -1) {
        let color = window.DVIDataList[2][i].color
        var material = new THREE.LineBasicMaterial({ color: color, linewidth: 3 });
        // material.resolution.set(window.innerWidth, window.innerHeight);
        const linegeometry = new THREE.Geometry()
        let pointll = []
      
        if (window.worldSpacePointPositions && window.worldSpacePointPositions.length > 1 && window.worldSpacePointPositions[this.epoches[1]] && window.isAnimatating) {
          for (let wlen = this.epoches[0]; wlen <= posArr.length; wlen++) {
            const x = window.worldSpacePointPositions[wlen][i * 3]
            const y = window.worldSpacePointPositions[wlen][i * 3 + 1]
            pointll.push(new THREE.Vector3(x, y, 0))
            drawed.push(i)
          }
          const curve = new THREE.SplineCurve(pointll);
          let points = curve.getPoints(100)
          var line = new THREE.CatmullRomCurve3(pointll);
          // this.linesContainer.push(line
          // let points = line.getPoints(100)
          linegeometry.setFromPoints(points)
          var linen = new THREE.Line(linegeometry, material);
          if (!window.lineGeomertryList) {
            window.lineGeomertryList = []
          }
          this.polylines.push(linen);
          window.lineGeomertryList.push(linen)
          this.scene.add(linen);
        }

        // const x = getPos[i * 3] //范围在-1到1
        // const y = getPos[i * 3 + 1]
        // const z = getPos[i * 3 + 2]
        // const x2 = getPos2[i * 3]
        // const y2 = getPos2[i * 3 + 1]
        // const z2 = getPos2[i * 3 + 2]
        // const x3 = this.worldSpacePointPositions[i * 3]
        // const y3 = this.worldSpacePointPositions[i * 3 + 1]
        // let p1 = new THREE.Vector3(x, y, 0)
        // let p2 = new THREE.Vector3(x2, y2, 0)
        // let p3 = new THREE.Vector3(x3, y3, 0)
        // console.log(pointll)
        // pointll.push(p3)
        // geometry.vertices.push(p1);
        // // geometry.vertices.push(new THREE.Vector3(0, 0, 0));
        // geometry.vertices.push(p2);
        // pointsArray.push(new THREE.Vector3(x2, y2, z2))
        // console.log('p2,p1', p2, p1, p3, geometry)
        // pointsArray.push(new THREE.Vector3(x, y, z))
        // this.linegeometry.setFromPoints(pointsArray)
        // pointll.unshift(p1)
        // pointll.push(p3)
        // const curve = new THREE.SplineCurve(pointll);
        // let points = curve.getPoints(50)
        // var line = new THREE.CatmullRomCurve3(pointll);
        // // this.linesContainer.push(line
        // // let points = line.getPoints(100)
        // geometry.setFromPoints(points)
        // var linen = new THREE.Line(geometry, material);
        // if (!window.lineGeomertryList) {
        //   window.lineGeomertryList = []
        // }
        // window.lineGeomertryList.push(linen)
        // this.scene.add(linen);
        //顶点
        //geometry.vertices.push(new THREE.Vector3(x,y,z))
      }
      //用这个api传入顶点数组
    }
    // }





    for (let i = 0; i < pointCount; i++) {
      let leftOffset = 0;
      leftOffset += this.glyphTexture.lengths[105];
      // Determine length of word in pixels.
      leftOffset /= -2; // centers text horizontally around the origin
      let letterWidth = this.glyphTexture.lengths[105];
      let scale = FONT_SIZE;
      let right = (leftOffset + letterWidth) / scale;
      let triRight = (leftOffset + this.glyphTexture.lengths[115]) / scale;
      let left = leftOffset / scale;
      let top = 40 / scale;

      if (this.selectedIndexList.indexOf(Math.floor(i / 2)) === -1) {
        //矩形
        // positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 0, left, 0);
        // positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 1, right / 20, 0);
        // positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 2, left, 10 / scale);
        // positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 3, left, 10 / scale);
        // positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 4, right / 20, 0);
        // positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 5, right / 20, 10 / scale);
      } else {
        //三角形
        i === this.selectedIndexList[0]
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 0, left, 0);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 1, triRight, 20 / scale);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 2, left, top);
      }
      if (this.selectedIndexList.length == 1 && this.selectedIndexList.indexOf(Math.floor(i / 2)) !== -1) {
        console.log('reset')
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 0, left, 0);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 1, triRight * 2, 0);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 2, left, top);
      }

      lettersSoFar++;
      leftOffset += letterWidth;
    }

    for (let i = 0; i < pointCount; i++) {
      const p = util.vector3FromPackedArray(this.worldSpacePointPositions, i);
      this.labelVertexMap[i].forEach((j) => {
        this.positions.setXYZ(j, p.x, p.y, p.z);
      });
    }
    this.pointsMesh = new THREE.Mesh(this.geometry, this.material);
    this.pointsMesh.frustumCulled = false;
    console.log(this.geometry, this.pointsMesh)
    this.scene.add(this.pointsMesh);
  }
  private colorLabels(pointColors: Float32Array) {
    if (
      this.geometry == null ||
      pointColors == null
    ) {
      return;
    }
    const colors = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    (colors as any).setArray(this.renderColors);
    const n = pointColors.length / XYZ_ELEMENTS_PER_ENTRY;
    let src = 0;
    for (let i = 0; i < n; ++i) {
      const c = new THREE.Color(
        pointColors[src],
        pointColors[src + 1],
        pointColors[src + 2]
      );
      const m = this.labelVertexMap[i].length;
      for (let j = 0; j < m; ++j) {
        colors.setXYZ(this.labelVertexMap[i][j], c.r, c.g, c.b);
      }
      src += RGB_ELEMENTS_PER_ENTRY;
    }
    colors.needsUpdate = true;
  }
  setScene(scene: THREE.Scene) {
    this.scene = scene;
  }
  dispose() {
    console.log('this.polylinegemo',this.polylines)
    for (let i = 0; i < this.polylines?.length; i++) {
      this.scene.remove(this.polylines[i]);
      this.polylines[i].geometry.dispose();
    }
    if (this.pointsMesh) {
      if (this.scene) {
        this.scene.remove(this.pointsMesh);
      }
      this.pointsMesh = null;
    }
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    if (this.linesContainer) {
      // this.linesContainer.forEach((item:any) => {
      //   // item?.dispose()
      // });
    }
    if (this.linegeometry) {
      this.linegeometry.dispose();
      this.linegeometry = null;
    }
    if (this.glyphTexture != null && this.glyphTexture.texture != null) {
      this.glyphTexture.texture.dispose();
      this.glyphTexture.texture = null;
    }
  }
  onPickingRender(rc: RenderContext) {
    if (this.geometry == null) {
      this.createTriangles()
    }
    if (this.geometry == null) {
      return;
    }
    this.material.uniforms.texture.value = this.glyphTexture.texture;
    this.material.uniforms.picking.value = true;
    const colors = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    (colors as any).setArray(this.pickingColors);
    colors.needsUpdate = true;
  }
  onRender(rc: RenderContext) {
    if (this.geometry == null) {
      this.createTriangles()
    }
    if (this.geometry == null) {
      return;
    }
    this.colorLabels(rc.pointColors);
    this.material.uniforms.texture.value = this.glyphTexture.texture;
    this.material.uniforms.picking.value = false;
    const colors = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    (colors as any).setArray(this.renderColors);
    colors.needsUpdate = true;
  }
  onPointPositionsChanged(newPositions: Float32Array) {
    this.worldSpacePointPositions = newPositions;
    this.dispose();
  }
  // setLabelStrings(labelStrings: string[]) {
  //   this.labelStrings = labelStrings;
  //   this.dispose();
  // }
  setSelectedPoint(selectedIndexList: number[]) {
    this.selectedIndexList = selectedIndexList
  }
  setEpoches(epoches: number[]) {
    this.epoches = epoches
  }
  onResize(newWidth: number, newHeight: number) { }
}
