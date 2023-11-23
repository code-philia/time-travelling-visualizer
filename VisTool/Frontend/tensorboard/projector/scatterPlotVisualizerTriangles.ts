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

import { CameraType,RenderContext,LabelRenderParams } from './renderContext';

import { ScatterPlotVisualizer } from './scatterPlotVisualizer';
import * as util from './util';

declare global {
  interface Window {
    selectedList: any,
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
export class scatterPlotVisualizerTriangles implements ScatterPlotVisualizer {
  private scene: THREE.Scene;
  // private labelStrings: string[];
  private geometry: THREE.BufferGeometry;
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
  private unLabelDataIndexList: number[]
  private labels: LabelRenderParams;
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
  addbackgroundImg(imgUrl: string) {
    //移除上一个画布
    if (window.backgroundMesh) {
      this.scene.remove(window.backgroundMesh)
    }
    if (!imgUrl) {
      return
    }
    // 2，使用canvas画图作为纹理贴图
    // 先使用canvas画图
    let canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    var ctx = canvas.getContext("2d");
    var img = new Image();
    img.src = imgUrl;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 200, 200);
      let texture = new THREE.CanvasTexture(canvas);
      // texture.needsUpdate = true; // 不设置needsUpdate为true的话，可能纹理贴图不刷新
      var plane_geometry = new THREE.PlaneGeometry(2, 2);
      var material = new THREE.MeshPhongMaterial({
        // color:0x11ff22,
        map: texture,
        side: THREE.DoubleSide
      });
      window.backgroundMesh = new THREE.Mesh(plane_geometry, material);
      this.scene.add(window.backgroundMesh);
    }
  }
  createTriangles() {
    // if (window.sceneBackgroundImg[window.iteration]) {
    //   this.addbackgroundImg('data:image/png;base64,' + window.sceneBackgroundImg[window.iteration])
    // }
    // this.addbackgroundImg('data:image/png;base64,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')

    if (!window.customSelection) {
      window.customSelection = []
    } else {

      function func(a, b) {
        return a - b;
      }
      window.customSelection.sort(func)
      console.log('cuscus', window.customSelection);
    }
    if (!this.unLabelDataIndexList) {
      this.unLabelDataIndexList = []
    }
    window.selectedList = this.selectedIndexList
    if (this.worldSpacePointPositions == null) {
      return;
    }
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
    console.log('selectedIndexList', this.selectedIndexList, this.glyphTexture)
    for (let i = 0; i < pointCount * 2; i++) {
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
      if (window.unLabelData.indexOf(Math.floor(i / 2)) !== -1) {
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 0, left, left);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 1, -left, left);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 2, 0, top / 4);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 0, left, left);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 1, -left, left);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 2, 0, top / 4);
      } else if (window.testingData.indexOf(Math.floor(i / 2)) !== -1) {
        //juxing
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 0, left / 2, left / 2);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 1, -left / 2, left / 2);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 2, left / 2, -left / 2);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 3, left / 2, -left / 2);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 4, -left / 2, left / 2);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 5, -left / 2, -left / 2);
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
  /** Set the labels to rendered */
  setLabels(labels: LabelRenderParams) {
    this.labels = labels;
  }
  dispose() {
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
  setUnLabeledIndex(list: number[]) {
    this.unLabelDataIndexList = list
  }
  onResize(newWidth: number, newHeight: number) { }
}
