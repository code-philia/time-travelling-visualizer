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
import * as util from './util';
const RGB_NUM_ELEMENTS = 3;
const XYZ_NUM_ELEMENTS = 3;
import { DataSet, } from './data';
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
/**
 * Renders the text labels as 3d geometry in the world.
 */
export class scatterPlotVisualizerTraceLine {
    constructor() {
        this.polylinePositionBuffer = {};
        this.polylineColorBuffer = {};
        this.polylinegemo = {};
    }
    createGlyphTexture() {
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
    processLabelVerts(pointCount) {
        let numTotalLetters = 0;
        this.labelVertexMap = [];
        for (let i = 0; i < pointCount; i++) {
            const label = '13';
            let vertsArray = [];
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
    createColorBuffers(pointCount) {
        this.pickingColors = new Float32Array(this.totalVertexCount * RGB_ELEMENTS_PER_ENTRY);
        this.renderColors = new Float32Array(this.totalVertexCount * RGB_ELEMENTS_PER_ENTRY);
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
        const ds = new DataSet(points);
        // projection == null ? null : this.projection.projectionComponents;
        const newPositions = this.generatePointPositionArray(ds, epoch);
        return newPositions;
    }
    generatePointPositionArray(ds, epoch) {
        if (ds == null) {
            return null;
        }
        const xScaler = d3.scaleLinear();
        const yScaler = d3.scaleLinear();
        let zScaler = null;
        {
            // Determine max and min of each axis of our data.
            const xExtent = d3.extent(ds.points, (p, i) => ds.points[i].DVI_projections[epoch][0]);
            const yExtent = d3.extent(ds.points, (p, i) => ds.points[i].DVI_projections[epoch][1]);
            const range = [
                -SCATTER_PLOT_CUBE_LENGTH / 2,
                SCATTER_PLOT_CUBE_LENGTH / 2,
            ];
            xScaler.domain(xExtent).range(range);
            yScaler.domain(yExtent).range(range);
            // if (projectionComponents[2] != null) {
            const zExtent = d3.extent(ds.points, (p, i) => ds.points[i].projections['tsne-2']);
            zScaler = d3.scaleLinear();
            zScaler.domain(zExtent).range(range);
            // }
            // }
            const positions = new Float32Array(ds.points.length * 3);
            let dst = 0;
            ds.points.forEach((d, i) => {
                positions[dst++] = xScaler(ds.points[i].DVI_projections[epoch][0]);
                positions[dst++] = yScaler(ds.points[i].DVI_projections[epoch][1]);
                positions[dst++] = 0;
            });
            if (zScaler) {
                dst = 2;
                ds.points.forEach((d, i) => {
                    positions[dst] = zScaler(0);
                    dst += 3;
                });
            }
            return positions;
        }
    }
    createTriangles() {
        var _a, _b, _c;
        this.polylinegemo = [];
        window.selectedList = this.selectedIndexList;
        window.scene = this.scene;
        if (this.worldSpacePointPositions == null) {
            return;
        }
        let len = this.epoches[1] - this.epoches[0];
        if (!window.worldSpacePointPositions) {
            window.worldSpacePointPositions = [];
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
        window.worldSpacePointPositions[window.iteration] = this.worldSpacePointPositions;
        // }
        const pointCount = ((_a = this.worldSpacePointPositions) === null || _a === void 0 ? void 0 : _a.length) / XYZ_ELEMENTS_PER_ENTRY;
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
        let positionArray = new Float32Array(this.totalVertexCount * XYZ_ELEMENTS_PER_ENTRY);
        this.positions = new THREE.BufferAttribute(positionArray, XYZ_ELEMENTS_PER_ENTRY);
        let posArray = new Float32Array(this.totalVertexCount * XYZ_ELEMENTS_PER_ENTRY);
        let colorsArray = new Float32Array(this.totalVertexCount * RGB_ELEMENTS_PER_ENTRY);
        let positionObject = new THREE.BufferAttribute(posArray, 2);
        let colors = new THREE.BufferAttribute(colorsArray, RGB_ELEMENTS_PER_ENTRY);
        this.geometry = new THREE.BufferGeometry();
        this.geometry.addAttribute('posObj', positionObject);
        this.geometry.addAttribute('position', this.positions);
        this.geometry.addAttribute('color', colors);
        let lettersSoFar = 0;
        this.linegeometry = new THREE.BufferGeometry();
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
        let start = this.epoches[0];
        let end = this.epoches[1];
        let getPos = this.getPosition(window.DVIDataList[end], start);
        let getPos2 = this.getPosition(window.DVIDataList[end], end);
        let posArr = [];
        for (let i = start; i <= end; i++) {
            let getPos = this.getPosition(window.DVIDataList[end], i);
            posArr.push(getPos);
        }
        let drawed = [];
        let selectedLen;
        // if (selectedLen !== this.selectedIndexList?.length ) {
        // let count = 0,des = 0
        selectedLen = (_b = this.selectedIndexList) === null || _b === void 0 ? void 0 : _b.length;
        for (let i = 0; i < pointCount; i++) {
            if (((_c = this.selectedIndexList) === null || _c === void 0 ? void 0 : _c.length) && this.selectedIndexList.indexOf(i) !== -1) {
                let color = window.DVIDataList[2][i].color;
                var material = new THREE.LineBasicMaterial({ color: color, linewidth: 3 });
                // material.resolution.set(window.innerWidth, window.innerHeight);
                const linegeometry = new THREE.Geometry();
                let pointll = [];
                if (window.worldSpacePointPositions && window.worldSpacePointPositions.length > 1 && window.worldSpacePointPositions[this.epoches[1]] && window.isAnimatating) {
                    for (let wlen = this.epoches[0]; wlen <= posArr.length; wlen++) {
                        const x = window.worldSpacePointPositions[wlen][i * 3];
                        const y = window.worldSpacePointPositions[wlen][i * 3 + 1];
                        pointll.push(new THREE.Vector3(x, y, 0));
                        drawed.push(i);
                    }
                    const curve = new THREE.SplineCurve(pointll);
                    let points = curve.getPoints(100);
                    var line = new THREE.CatmullRomCurve3(pointll);
                    // this.linesContainer.push(line
                    // let points = line.getPoints(100)
                    linegeometry.setFromPoints(points);
                    var linen = new THREE.Line(linegeometry, material);
                    if (!window.lineGeomertryList) {
                        window.lineGeomertryList = [];
                    }
                    this.polylines.push(linen);
                    window.lineGeomertryList.push(linen);
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
            }
            else {
                //三角形
                i === this.selectedIndexList[0];
                positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 0, left, 0);
                positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 1, triRight, 20 / scale);
                positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 2, left, top);
            }
            if (this.selectedIndexList.length == 1 && this.selectedIndexList.indexOf(Math.floor(i / 2)) !== -1) {
                console.log('reset');
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
        console.log(this.geometry, this.pointsMesh);
        this.scene.add(this.pointsMesh);
    }
    colorLabels(pointColors) {
        if (this.geometry == null ||
            pointColors == null) {
            return;
        }
        const colors = this.geometry.getAttribute('color');
        colors.setArray(this.renderColors);
        const n = pointColors.length / XYZ_ELEMENTS_PER_ENTRY;
        let src = 0;
        for (let i = 0; i < n; ++i) {
            const c = new THREE.Color(pointColors[src], pointColors[src + 1], pointColors[src + 2]);
            const m = this.labelVertexMap[i].length;
            for (let j = 0; j < m; ++j) {
                colors.setXYZ(this.labelVertexMap[i][j], c.r, c.g, c.b);
            }
            src += RGB_ELEMENTS_PER_ENTRY;
        }
        colors.needsUpdate = true;
    }
    setScene(scene) {
        this.scene = scene;
    }
    dispose() {
        var _a;
        console.log('this.polylinegemo', this.polylines);
        for (let i = 0; i < ((_a = this.polylines) === null || _a === void 0 ? void 0 : _a.length); i++) {
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
    onPickingRender(rc) {
        if (this.geometry == null) {
            this.createTriangles();
        }
        if (this.geometry == null) {
            return;
        }
        this.material.uniforms.texture.value = this.glyphTexture.texture;
        this.material.uniforms.picking.value = true;
        const colors = this.geometry.getAttribute('color');
        colors.setArray(this.pickingColors);
        colors.needsUpdate = true;
    }
    onRender(rc) {
        if (this.geometry == null) {
            this.createTriangles();
        }
        if (this.geometry == null) {
            return;
        }
        this.colorLabels(rc.pointColors);
        this.material.uniforms.texture.value = this.glyphTexture.texture;
        this.material.uniforms.picking.value = false;
        const colors = this.geometry.getAttribute('color');
        colors.setArray(this.renderColors);
        colors.needsUpdate = true;
    }
    onPointPositionsChanged(newPositions) {
        this.worldSpacePointPositions = newPositions;
        this.dispose();
    }
    // setLabelStrings(labelStrings: string[]) {
    //   this.labelStrings = labelStrings;
    //   this.dispose();
    // }
    setSelectedPoint(selectedIndexList) {
        this.selectedIndexList = selectedIndexList;
    }
    setEpoches(epoches) {
        this.epoches = epoches;
    }
    onResize(newWidth, newHeight) { }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NhdHRlclBsb3RWaXN1YWxpemVyVHJhY2VMaW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVuc29yYm9hcmQvcHJvamVjdG9yL3NjYXR0ZXJQbG90VmlzdWFsaXplclRyYWNlTGluZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7OztnRkFhZ0Y7QUFDaEYsT0FBTyxLQUFLLEtBQUssTUFBTSxPQUFPLENBQUM7QUFDL0IsT0FBTyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFJekIsT0FBTyxLQUFLLElBQUksTUFBTSxRQUFRLENBQUM7QUFDL0IsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7QUFDM0IsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7QUFDM0IsT0FBTyxFQUNMLE9BQU8sR0FLUixNQUFNLFFBQVEsQ0FBQztBQVVoQixNQUFNLFNBQVMsR0FBRyxFQUFFLENBQUM7QUFDckIsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLEdBQUcsU0FBUyxDQUFDO0FBQ3pDLE1BQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQyxDQUFDLDJCQUEyQjtBQUNwRCxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUM7QUFDNUIsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUM7QUFDakMsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLENBQUM7QUFDbEMsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDO0FBQ3ZCLE1BQU0sc0JBQXNCLEdBQUcsQ0FBQyxDQUFDO0FBQ2pDLE1BQU0sc0JBQXNCLEdBQUcsQ0FBQyxDQUFDO0FBQ2pDLE1BQU0scUJBQXFCLEdBQUcsQ0FBQyxDQUFDO0FBQ2hDLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLG9DQUFvQztBQUN0RSxNQUFNLHdCQUF3QixHQUFHLENBQUMsQ0FBQztBQUNuQzs7Ozs7Ozs7Ozs7R0FXRztBQUNILE1BQU0sYUFBYSxHQUFHOzs7Ozs7Ozs7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QUMsT0FBTyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQztRQUNqRSxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUM3QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQTBCLENBQUM7UUFDM0UsTUFBYyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDNUMsTUFBTSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7SUFDNUIsQ0FBQztJQUNELHVCQUF1QixDQUFDLFlBQTBCO1FBQ2hELElBQUksQ0FBQyx3QkFBd0IsR0FBRyxZQUFZLENBQUM7UUFDN0MsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2pCLENBQUM7SUFDRCw0Q0FBNEM7SUFDNUMsc0NBQXNDO0lBQ3RDLG9CQUFvQjtJQUNwQixJQUFJO0lBQ0osZ0JBQWdCLENBQUMsaUJBQTJCO1FBQzFDLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxpQkFBaUIsQ0FBQTtJQUM1QyxDQUFDO0lBQ0QsVUFBVSxDQUFDLE9BQWlCO1FBQzFCLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFBO0lBQ3hCLENBQUM7SUFDRCxRQUFRLENBQUMsUUFBZ0IsRUFBRSxTQUFpQixJQUFJLENBQUM7Q0FDbEQiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBDb3B5cmlnaHQgMjAxNiBUaGUgVGVuc29yRmxvdyBBdXRob3JzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5pbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgKiBhcyBkMyBmcm9tICdkMyc7XG5cbmltcG9ydCB7IFJlbmRlckNvbnRleHQgfSBmcm9tICcuL3JlbmRlckNvbnRleHQnO1xuaW1wb3J0IHsgU2NhdHRlclBsb3RWaXN1YWxpemVyIH0gZnJvbSAnLi9zY2F0dGVyUGxvdFZpc3VhbGl6ZXInO1xuaW1wb3J0ICogYXMgdXRpbCBmcm9tICcuL3V0aWwnO1xuY29uc3QgUkdCX05VTV9FTEVNRU5UUyA9IDM7XG5jb25zdCBYWVpfTlVNX0VMRU1FTlRTID0gMztcbmltcG9ydCB7XG4gIERhdGFTZXQsXG4gIERpc3RhbmNlRnVuY3Rpb24sXG4gIFByb2plY3Rpb24sXG4gIFN0YXRlLFxuICBQcm9qZWN0aW9uQ29tcG9uZW50czNELFxufSBmcm9tICcuL2RhdGEnO1xuXG5kZWNsYXJlIGdsb2JhbCB7XG4gIGludGVyZmFjZSBXaW5kb3cge1xuICAgIHNlbGVjdGVkTGlzdDogYW55LFxuICAgIHNjZW5lOiBhbnksXG4gICAgd29ybGRTcGFjZVBvaW50UG9zaXRpb25zOiBhbnksXG4gICAgaXNBbmltYXRhdGluZzogYm9vbGVhbiB8IGZhbHNlXG4gIH1cbn1cbmNvbnN0IEZPTlRfU0laRSA9IDgwO1xuY29uc3QgT05FX09WRVJfRk9OVF9TSVpFID0gMSAvIEZPTlRfU0laRTtcbmNvbnN0IExBQkVMX1NDQUxFID0gMi4yOyAvLyBhdCAxOjEgdGV4ZWwvcGl4ZWwgcmF0aW9cbmNvbnN0IExBQkVMX0NPTE9SID0gJ2JsYWNrJztcbmNvbnN0IExBQkVMX0JBQ0tHUk9VTkQgPSAnd2hpdGUnO1xuY29uc3QgTUFYX0NBTlZBU19ESU1FTlNJT04gPSA4MTkyO1xuY29uc3QgTlVNX0dMWVBIUyA9IDI1NjtcbmNvbnN0IFJHQl9FTEVNRU5UU19QRVJfRU5UUlkgPSAzO1xuY29uc3QgWFlaX0VMRU1FTlRTX1BFUl9FTlRSWSA9IDM7XG5jb25zdCBVVl9FTEVNRU5UU19QRVJfRU5UUlkgPSAyO1xuY29uc3QgVkVSVElDRVNfUEVSX0dMWVBIID0gMiAqIDM7IC8vIDIgdHJpYW5nbGVzLCAzIHZlcnRzIHBlciB0cmlhbmdsZVxuY29uc3QgU0NBVFRFUl9QTE9UX0NVQkVfTEVOR1RIID0gMjtcbi8qKlxuICogRWFjaCBsYWJlbCBpcyBtYWRlIHVwIG9mIHRyaWFuZ2xlcyAodHdvIHBlciBsZXR0ZXIuKSBFYWNoIHZlcnRleCwgdGhlbiwgaXNcbiAqIHRoZSBjb3JuZXIgb2Ygb25lIG9mIHRoZXNlIHRyaWFuZ2xlcyAoYW5kIHRodXMgdGhlIGNvcm5lciBvZiBhIGxldHRlclxuICogcmVjdGFuZ2xlLilcbiAqIEVhY2ggaGFzIHRoZSBmb2xsb3dpbmcgYXR0cmlidXRlczpcbiAqICAgIHBvc09iajogVGhlICh4LCB5KSBwb3NpdGlvbiBvZiB0aGUgdmVydGV4IHdpdGhpbiB0aGUgbGFiZWwsIHdoZXJlIHRoZVxuICogICAgICAgICAgICBib3R0b20gY2VudGVyIG9mIHRoZSB3b3JkIGlzIHBvc2l0aW9uZWQgYXQgKDAsIDApO1xuICogICAgcG9zaXRpb246IFRoZSBwb3NpdGlvbiBvZiB0aGUgbGFiZWwgaW4gd29ybGRzcGFjZS5cbiAqICAgIHZVdjogVGhlICh1LCB2KSBjb29yZGluYXRlcyB0aGF0IGluZGV4IGludG8gdGhlIGdseXBocyBzaGVldCAocmFuZ2UgMCwgMS4pXG4gKiAgICBjb2xvcjogVGhlIGNvbG9yIG9mIHRoZSBsYWJlbCAobWF0Y2hlcyB0aGUgY29ycmVzcG9uZGluZyBwb2ludCdzIGNvbG9yLilcbiAqICAgIHdvcmRTaG93bjogQm9vbGVhbi4gV2hldGhlciBvciBub3QgdGhlIGxhYmVsIGlzIHZpc2libGUuXG4gKi9cbmNvbnN0IFZFUlRFWF9TSEFERVIgPSBgXG4gICAgYXR0cmlidXRlIHZlYzIgcG9zT2JqO1xuICAgIGF0dHJpYnV0ZSB2ZWMzIGNvbG9yO1xuICAgIHZhcnlpbmcgdmVjMiB2VXY7XG4gICAgdmFyeWluZyB2ZWMzIHZDb2xvcjtcblxuICAgIHZvaWQgbWFpbigpIHtcbiAgICAgIHZVdiA9IHV2O1xuICAgICAgdkNvbG9yID0gY29sb3I7XG5cbiAgICAgIC8vIFJvdGF0ZSBsYWJlbCB0byBmYWNlIGNhbWVyYS5cblxuICAgICAgdmVjNCB2UmlnaHQgPSB2ZWM0KFxuICAgICAgICBtb2RlbFZpZXdNYXRyaXhbMF1bMF0sIG1vZGVsVmlld01hdHJpeFsxXVswXSwgbW9kZWxWaWV3TWF0cml4WzJdWzBdLCAwKTtcblxuICAgICAgdmVjNCB2VXAgPSB2ZWM0KFxuICAgICAgICBtb2RlbFZpZXdNYXRyaXhbMF1bMV0sIG1vZGVsVmlld01hdHJpeFsxXVsxXSwgbW9kZWxWaWV3TWF0cml4WzJdWzFdLCAwKTtcblxuICAgICAgdmVjNCB2QXQgPSAtdmVjNChcbiAgICAgICAgbW9kZWxWaWV3TWF0cml4WzBdWzJdLCBtb2RlbFZpZXdNYXRyaXhbMV1bMl0sIG1vZGVsVmlld01hdHJpeFsyXVsyXSwgMCk7XG5cbiAgICAgIG1hdDQgcG9pbnRUb0NhbWVyYSA9IG1hdDQodlJpZ2h0LCB2VXAsIHZBdCwgdmVjNCgwLCAwLCAwLCAxKSk7XG5cbiAgICAgIHZlYzIgc2NhbGVkUG9zID0gcG9zT2JqICogJHtPTkVfT1ZFUl9GT05UX1NJWkV9ICogJHtMQUJFTF9TQ0FMRX07XG5cbiAgICAgIHZlYzQgcG9zUm90YXRlZCA9IHBvaW50VG9DYW1lcmEgKiB2ZWM0KHNjYWxlZFBvcywgMCwgMSk7XG4gICAgICB2ZWM0IG12UG9zaXRpb24gPSBtb2RlbFZpZXdNYXRyaXggKiAodmVjNChwb3NpdGlvbiwgMCkgKyBwb3NSb3RhdGVkKTtcbiAgICAgIGdsX1Bvc2l0aW9uID0gcHJvamVjdGlvbk1hdHJpeCAqIG12UG9zaXRpb247XG4gICAgfWA7XG5jb25zdCBGUkFHTUVOVF9TSEFERVIgPSBgXG4gICAgdW5pZm9ybSBzYW1wbGVyMkQgdGV4dHVyZTtcbiAgICB1bmlmb3JtIGJvb2wgcGlja2luZztcbiAgICB2YXJ5aW5nIHZlYzIgdlV2O1xuICAgIHZhcnlpbmcgdmVjMyB2Q29sb3I7XG5cbiAgICB2b2lkIG1haW4oKSB7XG4gICAgICBpZiAocGlja2luZykge1xuICAgICAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KHZDb2xvciwgMS4wKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZlYzQgZnJvbVRleHR1cmUgPSB0ZXh0dXJlMkQodGV4dHVyZSwgdlV2KTtcbiAgICAgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNCh2Q29sb3IsIDEuMCkgKiBmcm9tVGV4dHVyZTtcbiAgICAgIH1cbiAgICB9YDtcbnR5cGUgR2x5cGhUZXh0dXJlID0ge1xuICB0ZXh0dXJlOiBUSFJFRS5UZXh0dXJlO1xuICBsZW5ndGhzOiBGbG9hdDMyQXJyYXk7XG4gIG9mZnNldHM6IEZsb2F0MzJBcnJheTtcbn07XG4vKipcbiAqIFJlbmRlcnMgdGhlIHRleHQgbGFiZWxzIGFzIDNkIGdlb21ldHJ5IGluIHRoZSB3b3JsZC5cbiAqL1xuZXhwb3J0IGNsYXNzIHNjYXR0ZXJQbG90VmlzdWFsaXplclRyYWNlTGluZSBpbXBsZW1lbnRzIFNjYXR0ZXJQbG90VmlzdWFsaXplciB7XG4gIHByaXZhdGUgc2NlbmU6IFRIUkVFLlNjZW5lO1xuICAvLyBwcml2YXRlIGxhYmVsU3RyaW5nczogc3RyaW5nW107XG4gIHByaXZhdGUgZ2VvbWV0cnk6IFRIUkVFLkJ1ZmZlckdlb21ldHJ5O1xuICBwcml2YXRlIGxpbmVnZW9tZXRyeTogVEhSRUUuQnVmZmVyR2VvbWV0cnk7XG4gIHByaXZhdGUgbGluZXNDb250YWluZXI6IGFueTtcbiAgcHJpdmF0ZSB3b3JsZFNwYWNlUG9pbnRQb3NpdGlvbnM6IEZsb2F0MzJBcnJheTtcbiAgcHJpdmF0ZSBwaWNraW5nQ29sb3JzOiBGbG9hdDMyQXJyYXk7XG4gIHByaXZhdGUgcmVuZGVyQ29sb3JzOiBGbG9hdDMyQXJyYXk7XG4gIHByaXZhdGUgbWF0ZXJpYWw6IFRIUkVFLlNoYWRlck1hdGVyaWFsO1xuICBwcml2YXRlIHVuaWZvcm1zOiBhbnk7XG4gIHByaXZhdGUgcG9pbnRzTWVzaDogVEhSRUUuTWVzaDtcbiAgcHJpdmF0ZSBwb3NpdGlvbnM6IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZTtcbiAgcHJpdmF0ZSB0b3RhbFZlcnRleENvdW50OiBudW1iZXI7XG4gIHByaXZhdGUgbGFiZWxWZXJ0ZXhNYXA6IG51bWJlcltdW107XG4gIHByaXZhdGUgZ2x5cGhUZXh0dXJlOiBHbHlwaFRleHR1cmU7XG4gIHByaXZhdGUgc2VsZWN0ZWRJbmRleExpc3Q6IG51bWJlcltdXG4gIHByaXZhdGUgZXBvY2hlczogbnVtYmVyW11cblxuXG4gIHByaXZhdGUgcG9seWxpbmVzOiBUSFJFRS5MaW5lW107XG4gIHByaXZhdGUgcG9seWxpbmVQb3NpdGlvbkJ1ZmZlcjoge1xuICAgIFtwb2x5bGluZUluZGV4OiBudW1iZXJdOiBUSFJFRS5CdWZmZXJBdHRyaWJ1dGU7XG4gIH0gPSB7fTtcbiAgcHJpdmF0ZSBwb2x5bGluZUNvbG9yQnVmZmVyOiB7XG4gICAgW3BvbHlsaW5lSW5kZXg6IG51bWJlcl06IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZTtcbiAgfSA9IHt9O1xuXG4gIHByaXZhdGUgcG9seWxpbmVnZW1vOiB7XG4gICAgW3BvbHlsaW5lSW5kZXg6IG51bWJlcl06IFRIUkVFLkdlb21ldHJ5O1xuICB9ID0ge307XG5cblxuICBwcml2YXRlIGNyZWF0ZUdseXBoVGV4dHVyZSgpOiBHbHlwaFRleHR1cmUge1xuICAgIGxldCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICBjYW52YXMud2lkdGggPSBNQVhfQ0FOVkFTX0RJTUVOU0lPTjtcbiAgICBjYW52YXMuaGVpZ2h0ID0gRk9OVF9TSVpFO1xuICAgIGxldCBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICBjdHguZm9udCA9ICdib2xkICcgKyBGT05UX1NJWkUgKiAwLjc1ICsgJ3B4IHJvYm90byc7XG4gICAgY3R4LnRleHRCYXNlbGluZSA9ICd0b3AnO1xuICAgIGN0eC5maWxsU3R5bGUgPSBMQUJFTF9CQUNLR1JPVU5EO1xuICAgIGN0eC5yZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgY3R4LmZpbGwoKTtcbiAgICBjdHguZmlsbFN0eWxlID0gTEFCRUxfQ09MT1I7XG4gICAgbGV0IHNwYWNlT2Zmc2V0ID0gY3R4Lm1lYXN1cmVUZXh0KCcgJykud2lkdGg7XG4gICAgLy8gRm9yIGVhY2ggbGV0dGVyLCBzdG9yZSBsZW5ndGgsIHBvc2l0aW9uIGF0IHRoZSBlbmNvZGVkIGluZGV4LlxuICAgIGxldCBnbHlwaExlbmd0aHMgPSBuZXcgRmxvYXQzMkFycmF5KE5VTV9HTFlQSFMpO1xuICAgIGxldCBnbHlwaE9mZnNldCA9IG5ldyBGbG9hdDMyQXJyYXkoTlVNX0dMWVBIUyk7XG4gICAgbGV0IGxlZnRDb29yZCA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBOVU1fR0xZUEhTOyBpKyspIHtcbiAgICAgIGxldCB0ZXh0ID0gJyAnICsgU3RyaW5nLmZyb21DaGFyQ29kZShpKTtcbiAgICAgIGxldCB0ZXh0TGVuZ3RoID0gY3R4Lm1lYXN1cmVUZXh0KHRleHQpLndpZHRoO1xuICAgICAgZ2x5cGhMZW5ndGhzW2ldID0gdGV4dExlbmd0aCAtIHNwYWNlT2Zmc2V0O1xuICAgICAgZ2x5cGhPZmZzZXRbaV0gPSBsZWZ0Q29vcmQ7XG4gICAgICBjdHguZmlsbFRleHQodGV4dCwgbGVmdENvb3JkIC0gc3BhY2VPZmZzZXQsIDApO1xuICAgICAgbGVmdENvb3JkICs9IHRleHRMZW5ndGg7XG4gICAgfVxuICAgIGNvbnN0IHRleCA9IHV0aWwuY3JlYXRlVGV4dHVyZShjYW52YXMpO1xuICAgIHJldHVybiB7IHRleHR1cmU6IHRleCwgbGVuZ3RoczogZ2x5cGhMZW5ndGhzLCBvZmZzZXRzOiBnbHlwaE9mZnNldCB9O1xuICB9XG4gIHByaXZhdGUgcHJvY2Vzc0xhYmVsVmVydHMocG9pbnRDb3VudDogbnVtYmVyKSB7XG4gICAgbGV0IG51bVRvdGFsTGV0dGVycyA9IDA7XG4gICAgdGhpcy5sYWJlbFZlcnRleE1hcCA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcG9pbnRDb3VudDsgaSsrKSB7XG4gICAgICBjb25zdCBsYWJlbCA9ICcxMyc7XG4gICAgICBsZXQgdmVydHNBcnJheTogbnVtYmVyW10gPSBbXTtcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGFiZWwubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBWRVJUSUNFU19QRVJfR0xZUEg7IGsrKykge1xuICAgICAgICAgIHZlcnRzQXJyYXkucHVzaChudW1Ub3RhbExldHRlcnMgKiBWRVJUSUNFU19QRVJfR0xZUEggKyBrKTtcbiAgICAgICAgfVxuICAgICAgICBudW1Ub3RhbExldHRlcnMrKztcbiAgICAgIH1cbiAgICAgIHRoaXMubGFiZWxWZXJ0ZXhNYXAucHVzaCh2ZXJ0c0FycmF5KTtcbiAgICB9XG4gICAgdGhpcy50b3RhbFZlcnRleENvdW50ID0gbnVtVG90YWxMZXR0ZXJzICogVkVSVElDRVNfUEVSX0dMWVBIO1xuICB9XG4gIHByaXZhdGUgY3JlYXRlQ29sb3JCdWZmZXJzKHBvaW50Q291bnQ6IG51bWJlcikge1xuICAgIHRoaXMucGlja2luZ0NvbG9ycyA9IG5ldyBGbG9hdDMyQXJyYXkoXG4gICAgICB0aGlzLnRvdGFsVmVydGV4Q291bnQgKiBSR0JfRUxFTUVOVFNfUEVSX0VOVFJZXG4gICAgKTtcbiAgICB0aGlzLnJlbmRlckNvbG9ycyA9IG5ldyBGbG9hdDMyQXJyYXkoXG4gICAgICB0aGlzLnRvdGFsVmVydGV4Q291bnQgKiBSR0JfRUxFTUVOVFNfUEVSX0VOVFJZXG4gICAgKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50Q291bnQ7IGkrKykge1xuICAgICAgbGV0IGNvbG9yID0gbmV3IFRIUkVFLkNvbG9yKGkpO1xuICAgICAgdGhpcy5sYWJlbFZlcnRleE1hcFtpXS5mb3JFYWNoKChqKSA9PiB7XG4gICAgICAgIHRoaXMucGlja2luZ0NvbG9yc1tSR0JfRUxFTUVOVFNfUEVSX0VOVFJZICogal0gPSBjb2xvci5yO1xuICAgICAgICB0aGlzLnBpY2tpbmdDb2xvcnNbUkdCX0VMRU1FTlRTX1BFUl9FTlRSWSAqIGogKyAxXSA9IGNvbG9yLmc7XG4gICAgICAgIHRoaXMucGlja2luZ0NvbG9yc1tSR0JfRUxFTUVOVFNfUEVSX0VOVFJZICogaiArIDJdID0gY29sb3IuYjtcbiAgICAgICAgdGhpcy5yZW5kZXJDb2xvcnNbUkdCX0VMRU1FTlRTX1BFUl9FTlRSWSAqIGpdID0gMTtcbiAgICAgICAgdGhpcy5yZW5kZXJDb2xvcnNbUkdCX0VMRU1FTlRTX1BFUl9FTlRSWSAqIGogKyAxXSA9IDE7XG4gICAgICAgIHRoaXMucmVuZGVyQ29sb3JzW1JHQl9FTEVNRU5UU19QRVJfRU5UUlkgKiBqICsgMl0gPSAxO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGdldFBvc2l0aW9uKHBvaW50cywgZXBvY2gpIHtcbiAgICBjb25zdCBkcyA9IG5ldyBEYXRhU2V0KHBvaW50cylcbiAgICAvLyBwcm9qZWN0aW9uID09IG51bGwgPyBudWxsIDogdGhpcy5wcm9qZWN0aW9uLnByb2plY3Rpb25Db21wb25lbnRzO1xuICAgIGNvbnN0IG5ld1Bvc2l0aW9ucyA9IHRoaXMuZ2VuZXJhdGVQb2ludFBvc2l0aW9uQXJyYXkoXG4gICAgICBkcywgZXBvY2hcbiAgICApO1xuICAgIHJldHVybiBuZXdQb3NpdGlvbnNcbiAgfVxuICBnZW5lcmF0ZVBvaW50UG9zaXRpb25BcnJheShcbiAgICBkczogRGF0YVNldCxcbiAgICBlcG9jaDogbnVtYmVyXG4gICk6IEZsb2F0MzJBcnJheSB7XG4gICAgaWYgKGRzID09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCB4U2NhbGVyID0gZDMuc2NhbGVMaW5lYXIoKTtcbiAgICBjb25zdCB5U2NhbGVyID0gZDMuc2NhbGVMaW5lYXIoKTtcbiAgICBsZXQgelNjYWxlciA9IG51bGw7XG4gICAge1xuICAgICAgLy8gRGV0ZXJtaW5lIG1heCBhbmQgbWluIG9mIGVhY2ggYXhpcyBvZiBvdXIgZGF0YS5cbiAgICAgIGNvbnN0IHhFeHRlbnQgPSBkMy5leHRlbnQoXG4gICAgICAgIGRzLnBvaW50cyxcbiAgICAgICAgKHAsIGkpID0+IGRzLnBvaW50c1tpXS5EVklfcHJvamVjdGlvbnNbZXBvY2hdWzBdXG4gICAgICApO1xuICAgICAgY29uc3QgeUV4dGVudCA9IGQzLmV4dGVudChcbiAgICAgICAgZHMucG9pbnRzLFxuICAgICAgICAocCwgaSkgPT4gZHMucG9pbnRzW2ldLkRWSV9wcm9qZWN0aW9uc1tlcG9jaF1bMV1cbiAgICAgICk7XG4gICAgICBjb25zdCByYW5nZSA9IFtcbiAgICAgICAgLVNDQVRURVJfUExPVF9DVUJFX0xFTkdUSCAvIDIsXG4gICAgICAgIFNDQVRURVJfUExPVF9DVUJFX0xFTkdUSCAvIDIsXG4gICAgICBdO1xuICAgICAgeFNjYWxlci5kb21haW4oeEV4dGVudCkucmFuZ2UocmFuZ2UpO1xuICAgICAgeVNjYWxlci5kb21haW4oeUV4dGVudCkucmFuZ2UocmFuZ2UpO1xuICAgICAgLy8gaWYgKHByb2plY3Rpb25Db21wb25lbnRzWzJdICE9IG51bGwpIHtcbiAgICAgIGNvbnN0IHpFeHRlbnQgPSBkMy5leHRlbnQoXG4gICAgICAgIGRzLnBvaW50cyxcbiAgICAgICAgKHAsIGkpID0+IGRzLnBvaW50c1tpXS5wcm9qZWN0aW9uc1sndHNuZS0yJ11cbiAgICAgICk7XG4gICAgICB6U2NhbGVyID0gZDMuc2NhbGVMaW5lYXIoKTtcbiAgICAgIHpTY2FsZXIuZG9tYWluKHpFeHRlbnQpLnJhbmdlKHJhbmdlKTtcbiAgICAgIC8vIH1cbiAgICAgIC8vIH1cbiAgICAgIGNvbnN0IHBvc2l0aW9ucyA9IG5ldyBGbG9hdDMyQXJyYXkoZHMucG9pbnRzLmxlbmd0aCAqIDMpO1xuICAgICAgbGV0IGRzdCA9IDA7XG4gICAgICBkcy5wb2ludHMuZm9yRWFjaCgoZCwgaSkgPT4ge1xuICAgICAgICBwb3NpdGlvbnNbZHN0KytdID0geFNjYWxlcihcbiAgICAgICAgICBkcy5wb2ludHNbaV0uRFZJX3Byb2plY3Rpb25zW2Vwb2NoXVswXVxuICAgICAgICApO1xuICAgICAgICBwb3NpdGlvbnNbZHN0KytdID0geVNjYWxlcihcbiAgICAgICAgICBkcy5wb2ludHNbaV0uRFZJX3Byb2plY3Rpb25zW2Vwb2NoXVsxXVxuICAgICAgICApO1xuICAgICAgICBwb3NpdGlvbnNbZHN0KytdID0gMDtcbiAgICAgIH0pO1xuICAgICAgaWYgKHpTY2FsZXIpIHtcbiAgICAgICAgZHN0ID0gMjtcbiAgICAgICAgZHMucG9pbnRzLmZvckVhY2goKGQsIGkpID0+IHtcbiAgICAgICAgICBwb3NpdGlvbnNbZHN0XSA9IHpTY2FsZXIoXG4gICAgICAgICAgICAwXG4gICAgICAgICAgKTtcbiAgICAgICAgICBkc3QgKz0gMztcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcG9zaXRpb25zO1xuICAgIH1cbiAgfVxuICBwcml2YXRlIGNyZWF0ZVRyaWFuZ2xlcygpIHtcbiAgICB0aGlzLnBvbHlsaW5lZ2VtbyA9IFtdXG4gICAgd2luZG93LnNlbGVjdGVkTGlzdCA9IHRoaXMuc2VsZWN0ZWRJbmRleExpc3RcbiAgICB3aW5kb3cuc2NlbmUgPSB0aGlzLnNjZW5lXG5cbiAgICBpZiAodGhpcy53b3JsZFNwYWNlUG9pbnRQb3NpdGlvbnMgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsZXQgbGVuID0gdGhpcy5lcG9jaGVzWzFdIC0gdGhpcy5lcG9jaGVzWzBdXG4gICAgaWYgKCF3aW5kb3cud29ybGRTcGFjZVBvaW50UG9zaXRpb25zKSB7XG4gICAgICB3aW5kb3cud29ybGRTcGFjZVBvaW50UG9zaXRpb25zID0gW11cbiAgICB9XG4gICAgLy8gbGV0IGZsYWcgPSB0cnVlXG5cbiAgICAvLyBmb3IgKGxldCBpID0gMTsgaSA8IHdpbmRvdy53b3JsZFNwYWNlUG9pbnRQb3NpdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAvLyAgIGlmICghd2luZG93LndvcmxkU3BhY2VQb2ludFBvc2l0aW9uc1tpXSkge1xuICAgIC8vICAgICBmbGFnID0gZmFsc2VcbiAgICAvLyAgICAgYnJlYWtcbiAgICAvLyAgIH1lbHNle1xuICAgIC8vICAgICBmbGFnID0gdHJ1ZVxuICAgIC8vICAgfVxuICAgIC8vIH1cbiAgICAvLyBpZiAoIWZsYWcpIHtcbiAgICB3aW5kb3cud29ybGRTcGFjZVBvaW50UG9zaXRpb25zW3dpbmRvdy5pdGVyYXRpb25dID0gdGhpcy53b3JsZFNwYWNlUG9pbnRQb3NpdGlvbnNcbiAgICAvLyB9XG4gICAgY29uc3QgcG9pbnRDb3VudCA9XG4gICAgICB0aGlzLndvcmxkU3BhY2VQb2ludFBvc2l0aW9ucz8ubGVuZ3RoIC8gWFlaX0VMRU1FTlRTX1BFUl9FTlRSWTtcbiAgICB0aGlzLmdseXBoVGV4dHVyZSA9IHRoaXMuY3JlYXRlR2x5cGhUZXh0dXJlKCk7XG4gICAgdGhpcy51bmlmb3JtcyA9IHtcbiAgICAgIHRleHR1cmU6IHsgdHlwZTogJ3QnIH0sXG4gICAgICBwaWNraW5nOiB7IHR5cGU6ICdib29sJyB9LFxuICAgIH07XG4gICAgdGhpcy5tYXRlcmlhbCA9IG5ldyBUSFJFRS5TaGFkZXJNYXRlcmlhbCh7XG4gICAgICB1bmlmb3JtczogdGhpcy51bmlmb3JtcyxcbiAgICAgIHRyYW5zcGFyZW50OiB0cnVlLFxuICAgICAgdmVydGV4U2hhZGVyOiBWRVJURVhfU0hBREVSLFxuICAgICAgZnJhZ21lbnRTaGFkZXI6IEZSQUdNRU5UX1NIQURFUixcbiAgICB9KTtcbiAgICB0aGlzLnByb2Nlc3NMYWJlbFZlcnRzKHBvaW50Q291bnQpO1xuICAgIHRoaXMuY3JlYXRlQ29sb3JCdWZmZXJzKHBvaW50Q291bnQpO1xuICAgIGxldCBwb3NpdGlvbkFycmF5ID0gbmV3IEZsb2F0MzJBcnJheShcbiAgICAgIHRoaXMudG90YWxWZXJ0ZXhDb3VudCAqIFhZWl9FTEVNRU5UU19QRVJfRU5UUllcbiAgICApO1xuICAgIHRoaXMucG9zaXRpb25zID0gbmV3IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZShcbiAgICAgIHBvc2l0aW9uQXJyYXksXG4gICAgICBYWVpfRUxFTUVOVFNfUEVSX0VOVFJZXG4gICAgKTtcbiAgICBsZXQgcG9zQXJyYXkgPSBuZXcgRmxvYXQzMkFycmF5KFxuICAgICAgdGhpcy50b3RhbFZlcnRleENvdW50ICogWFlaX0VMRU1FTlRTX1BFUl9FTlRSWVxuICAgICk7XG4gICAgbGV0IGNvbG9yc0FycmF5ID0gbmV3IEZsb2F0MzJBcnJheShcbiAgICAgIHRoaXMudG90YWxWZXJ0ZXhDb3VudCAqIFJHQl9FTEVNRU5UU19QRVJfRU5UUllcbiAgICApO1xuICAgIGxldCBwb3NpdGlvbk9iamVjdCA9IG5ldyBUSFJFRS5CdWZmZXJBdHRyaWJ1dGUocG9zQXJyYXksIDIpO1xuICAgIGxldCBjb2xvcnMgPSBuZXcgVEhSRUUuQnVmZmVyQXR0cmlidXRlKGNvbG9yc0FycmF5LCBSR0JfRUxFTUVOVFNfUEVSX0VOVFJZKTtcbiAgICB0aGlzLmdlb21ldHJ5ID0gbmV3IFRIUkVFLkJ1ZmZlckdlb21ldHJ5KCk7XG4gICAgdGhpcy5nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoJ3Bvc09iaicsIHBvc2l0aW9uT2JqZWN0KTtcbiAgICB0aGlzLmdlb21ldHJ5LmFkZEF0dHJpYnV0ZSgncG9zaXRpb24nLCB0aGlzLnBvc2l0aW9ucyk7XG4gICAgdGhpcy5nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoJ2NvbG9yJywgY29sb3JzKTtcbiAgICBsZXQgbGV0dGVyc1NvRmFyID0gMDtcblxuICAgIHRoaXMubGluZWdlb21ldHJ5ID0gbmV3IFRIUkVFLkJ1ZmZlckdlb21ldHJ5KClcbiAgICB0aGlzLnBvbHlsaW5lcyA9IFtdO1xuICAvLyAgaWYod2luZG93LndvcmxkU3BhY2VQb2ludFBvc2l0aW9ucz8ubGVuZ3RoPjEpe1xuICAvLyAgICAvLyBTZXQgdXAgdGhlIHBvc2l0aW9uIGJ1ZmZlciBhcnJheXMgZm9yIGVhY2ggcG9seWxpbmUuXG4gIC8vICAgY29uc3QgdmVydGV4Q291bnQgPSAyICogKHdpbmRvdy53b3JsZFNwYWNlUG9pbnRQb3NpdGlvbnMubGVuZ3RoKTtcbiAgLy8gICBsZXQgcG9seWxpbmVzQnUgPSBuZXcgRmxvYXQzMkFycmF5KHZlcnRleENvdW50ICogWFlaX05VTV9FTEVNRU5UUyk7XG4gIC8vICAgbGV0IGNvbG9yc0J1ID0gbmV3IEZsb2F0MzJBcnJheSh2ZXJ0ZXhDb3VudCAqIFJHQl9OVU1fRUxFTUVOVFMpO1xuICAvLyAgIGZvciAobGV0IGkgPSAwOyBpIDwgcG9pbnRDb3VudDsgaSsrKSB7XG4gIC8vICAgICBpZiAodGhpcy5zZWxlY3RlZEluZGV4TGlzdC5pbmRleE9mKGkpICE9PSAtMSkge1xuICAvLyAgICAgICB0aGlzLnBvbHlsaW5lUG9zaXRpb25CdWZmZXJbaV0gPSBuZXcgVEhSRUUuQnVmZmVyQXR0cmlidXRlKFxuICAvLyAgICAgICAgIHBvbHlsaW5lc0J1LFxuICAvLyAgICAgICAgIFhZWl9OVU1fRUxFTUVOVFNcbiAgLy8gICAgICAgKTtcblxuICAvLyAgICAgICB0aGlzLnBvbHlsaW5lQ29sb3JCdWZmZXJbaV0gPSBuZXcgVEhSRUUuQnVmZmVyQXR0cmlidXRlKFxuICAvLyAgICAgICAgIGNvbG9yc0J1LFxuICAvLyAgICAgICAgIFJHQl9OVU1fRUxFTUVOVFNcbiAgLy8gICAgICAgKTtcbiAgLy8gICAgIH1cbiAgLy8gICB9XG4gIC8vICAgY29uc29sZS5sb2coJ3RoaXMucG9seWxpbmVQb3NpdGlvbkJ1ZmZlcicsIHRoaXMucG9seWxpbmVQb3NpdGlvbkJ1ZmZlcilcbiBcbiAgLy8gICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50Q291bnQ7IGkrKykge1xuICAvLyAgICAgLy8gZm9yIChsZXQgaiA9IDA7IGogPCBwb2ludENvdW50OyBqKyspIHtcbiAgLy8gICAgIGxldCBzcmMgPSAwO1xuICAvLyAgICAgaWYgKHRoaXMuc2VsZWN0ZWRJbmRleExpc3QuaW5kZXhPZihpKSAhPT0gLTEpIHtcbiAgLy8gICAgICAgZm9yIChsZXQgbGUgPSAxOyBsZSA8IHdpbmRvdy53b3JsZFNwYWNlUG9pbnRQb3NpdGlvbnMubGVuZ3RoOyBsZSsrKSB7XG4gIC8vICAgICAgICAgY29uc29sZS5sb2coJ2xlJywgd2luZG93LndvcmxkU3BhY2VQb2ludFBvc2l0aW9uc1tsZV0pXG4gIC8vICAgICAgICAgaWYgKHRoaXMuc2VsZWN0ZWRJbmRleExpc3QuaW5kZXhPZihpKSAhPT0gLTEpIHtcbiAgLy8gICAgICAgICAgIGNvbnN0IHAgPSB1dGlsLnZlY3RvcjNGcm9tUGFja2VkQXJyYXkod2luZG93LndvcmxkU3BhY2VQb2ludFBvc2l0aW9uc1tsZV0sIGkpO1xuICAvLyAgICAgICAgICAgY29uc29sZS5sb2coJ2lpLCcsIHAsIHRoaXMucG9seWxpbmVQb3NpdGlvbkJ1ZmZlcltpXSlcbiAgLy8gICAgICAgICAgIGlmIChwKSB7XG4gIC8vICAgICAgICAgICAgIHRoaXMucG9seWxpbmVQb3NpdGlvbkJ1ZmZlcltpXS5zZXRYWVooc3JjKyssIHAueCwgcC55LCBwLnopXG4gIC8vICAgICAgICAgICB9XG4gIC8vICAgICAgICAgICB0aGlzLnBvbHlsaW5lUG9zaXRpb25CdWZmZXJbaV0ubmVlZHNVcGRhdGUgPSB0cnVlO1xuICAvLyAgICAgICAgIH0gZWxzZSB7XG4gIC8vICAgICAgICAgICAvL3RoaXMucG9seWxpbmVQb3NpdGlvbkJ1ZmZlcltpXS5zZXRYWVooc3JjKyssIDAsIDAsIDApXG4gIC8vICAgICAgICAgfVxuICAvLyAgICAgICB9XG4gIC8vICAgICB9XG5cbiAgLy8gICB9XG4gIC8vICAgY29uc29sZS5sb2coJ3RoaXMucG9seWxpbmVQb3NpdGlvbkJ1ZmZlcjExMScsIHRoaXMucG9seWxpbmVQb3NpdGlvbkJ1ZmZlcilcblxuICAvLyAgIGZvciAobGV0IGkgPSAwOyBpIDwgcG9pbnRDb3VudDsgaSsrKSB7XG4gIC8vICAgICBpZiAodGhpcy5zZWxlY3RlZEluZGV4TGlzdC5pbmRleE9mKGkpICE9PSAtMSkge1xuICAvLyAgICAgICBjb25zdCBnZW9tZXRyeSA9IG5ldyBUSFJFRS5CdWZmZXJHZW9tZXRyeSgpO1xuICAvLyAgICAgICBnZW9tZXRyeS5hZGRBdHRyaWJ1dGUoJ3Bvc2l0aW9uJywgdGhpcy5wb2x5bGluZVBvc2l0aW9uQnVmZmVyW2ldKTtcbiAgLy8gICAgICAgZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCdjb2xvcicsIHRoaXMucG9seWxpbmVDb2xvckJ1ZmZlcltpXSk7XG4gIC8vICAgICAgIGNvbnNvbGUubG9nKCcxMTExJyxnZW9tZXRyeSlcbiAgLy8gICAgICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoe1xuICAvLyAgICAgICAgIGxpbmV3aWR0aDogMSwgLy8gdW51c2VkIGRlZmF1bHQsIG92ZXJ3cml0dGVuIGJ5IHdpZHRoIGFycmF5LlxuICAvLyAgICAgICAgIG9wYWNpdHk6IDEuMCwgLy8gdW51c2VkIGRlZmF1bHQsIG92ZXJ3cml0dGVuIGJ5IG9wYWNpdHkgYXJyYXkuXG4gIC8vICAgICAgICAgdHJhbnNwYXJlbnQ6IHRydWUsXG4gIC8vICAgICAgICAgdmVydGV4Q29sb3JzOiBUSFJFRS5WZXJ0ZXhDb2xvcnMgYXMgYW55LFxuICAvLyAgICAgICB9KTtcbiAgLy8gICAgICAgY29uc3QgcG9seWxpbmUgPSBuZXcgVEhSRUUuTGluZVNlZ21lbnRzKGdlb21ldHJ5LCBtYXRlcmlhbCk7XG4gIC8vICAgICAgIHBvbHlsaW5lLmZydXN0dW1DdWxsZWQgPSBmYWxzZTtcbiAgLy8gICAgICAgdGhpcy5wb2x5bGluZXMucHVzaChwb2x5bGluZSk7XG4gIC8vICAgICAgIHRoaXMuc2NlbmUuYWRkKHBvbHlsaW5lKTtcbiAgLy8gICAgIH1cbiAgLy8gICB9XG5cbiAgLy8gIH1cbiAgICAvL+WKoDIwMDDkuKrpobbngrnvvIzojIPlm7TkuLotMeWIsDFcbiAgICBsZXQgc3RhcnQgPSB0aGlzLmVwb2NoZXNbMF1cbiAgICBsZXQgZW5kID0gdGhpcy5lcG9jaGVzWzFdXG4gICBcbiAgICBsZXQgZ2V0UG9zID0gdGhpcy5nZXRQb3NpdGlvbih3aW5kb3cuRFZJRGF0YUxpc3RbZW5kXSwgc3RhcnQpXG4gICAgbGV0IGdldFBvczIgPSB0aGlzLmdldFBvc2l0aW9uKHdpbmRvdy5EVklEYXRhTGlzdFtlbmRdLCBlbmQpXG4gICAgbGV0IHBvc0FyciA9IFtdXG4gICAgZm9yIChsZXQgaSA9IHN0YXJ0OyBpIDw9IGVuZDsgaSsrKSB7XG4gICAgICBsZXQgZ2V0UG9zID0gdGhpcy5nZXRQb3NpdGlvbih3aW5kb3cuRFZJRGF0YUxpc3RbZW5kXSwgaSlcbiAgICAgIHBvc0Fyci5wdXNoKGdldFBvcylcbiAgICB9XG4gICAgbGV0IGRyYXdlZCA9IFtdXG4gICAgbGV0IHNlbGVjdGVkTGVuXG4gICAgLy8gaWYgKHNlbGVjdGVkTGVuICE9PSB0aGlzLnNlbGVjdGVkSW5kZXhMaXN0Py5sZW5ndGggKSB7XG4gICAgLy8gbGV0IGNvdW50ID0gMCxkZXMgPSAwXG4gICAgc2VsZWN0ZWRMZW4gPSB0aGlzLnNlbGVjdGVkSW5kZXhMaXN0Py5sZW5ndGhcbiAgICBcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50Q291bnQ7IGkrKykge1xuXG4gICAgICBpZiAodGhpcy5zZWxlY3RlZEluZGV4TGlzdD8ubGVuZ3RoICYmIHRoaXMuc2VsZWN0ZWRJbmRleExpc3QuaW5kZXhPZihpKSAhPT0gLTEpIHtcbiAgICAgICAgbGV0IGNvbG9yID0gd2luZG93LkRWSURhdGFMaXN0WzJdW2ldLmNvbG9yXG4gICAgICAgIHZhciBtYXRlcmlhbCA9IG5ldyBUSFJFRS5MaW5lQmFzaWNNYXRlcmlhbCh7IGNvbG9yOiBjb2xvciwgbGluZXdpZHRoOiAzIH0pO1xuICAgICAgICAvLyBtYXRlcmlhbC5yZXNvbHV0aW9uLnNldCh3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0KTtcbiAgICAgICAgY29uc3QgbGluZWdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KClcbiAgICAgICAgbGV0IHBvaW50bGwgPSBbXVxuICAgICAgXG4gICAgICAgIGlmICh3aW5kb3cud29ybGRTcGFjZVBvaW50UG9zaXRpb25zICYmIHdpbmRvdy53b3JsZFNwYWNlUG9pbnRQb3NpdGlvbnMubGVuZ3RoID4gMSAmJiB3aW5kb3cud29ybGRTcGFjZVBvaW50UG9zaXRpb25zW3RoaXMuZXBvY2hlc1sxXV0gJiYgd2luZG93LmlzQW5pbWF0YXRpbmcpIHtcbiAgICAgICAgICBmb3IgKGxldCB3bGVuID0gdGhpcy5lcG9jaGVzWzBdOyB3bGVuIDw9IHBvc0Fyci5sZW5ndGg7IHdsZW4rKykge1xuICAgICAgICAgICAgY29uc3QgeCA9IHdpbmRvdy53b3JsZFNwYWNlUG9pbnRQb3NpdGlvbnNbd2xlbl1baSAqIDNdXG4gICAgICAgICAgICBjb25zdCB5ID0gd2luZG93LndvcmxkU3BhY2VQb2ludFBvc2l0aW9uc1t3bGVuXVtpICogMyArIDFdXG4gICAgICAgICAgICBwb2ludGxsLnB1c2gobmV3IFRIUkVFLlZlY3RvcjMoeCwgeSwgMCkpXG4gICAgICAgICAgICBkcmF3ZWQucHVzaChpKVxuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBjdXJ2ZSA9IG5ldyBUSFJFRS5TcGxpbmVDdXJ2ZShwb2ludGxsKTtcbiAgICAgICAgICBsZXQgcG9pbnRzID0gY3VydmUuZ2V0UG9pbnRzKDEwMClcbiAgICAgICAgICB2YXIgbGluZSA9IG5ldyBUSFJFRS5DYXRtdWxsUm9tQ3VydmUzKHBvaW50bGwpO1xuICAgICAgICAgIC8vIHRoaXMubGluZXNDb250YWluZXIucHVzaChsaW5lXG4gICAgICAgICAgLy8gbGV0IHBvaW50cyA9IGxpbmUuZ2V0UG9pbnRzKDEwMClcbiAgICAgICAgICBsaW5lZ2VvbWV0cnkuc2V0RnJvbVBvaW50cyhwb2ludHMpXG4gICAgICAgICAgdmFyIGxpbmVuID0gbmV3IFRIUkVFLkxpbmUobGluZWdlb21ldHJ5LCBtYXRlcmlhbCk7XG4gICAgICAgICAgaWYgKCF3aW5kb3cubGluZUdlb21lcnRyeUxpc3QpIHtcbiAgICAgICAgICAgIHdpbmRvdy5saW5lR2VvbWVydHJ5TGlzdCA9IFtdXG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMucG9seWxpbmVzLnB1c2gobGluZW4pO1xuICAgICAgICAgIHdpbmRvdy5saW5lR2VvbWVydHJ5TGlzdC5wdXNoKGxpbmVuKVxuICAgICAgICAgIHRoaXMuc2NlbmUuYWRkKGxpbmVuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNvbnN0IHggPSBnZXRQb3NbaSAqIDNdIC8v6IyD5Zu05ZyoLTHliLAxXG4gICAgICAgIC8vIGNvbnN0IHkgPSBnZXRQb3NbaSAqIDMgKyAxXVxuICAgICAgICAvLyBjb25zdCB6ID0gZ2V0UG9zW2kgKiAzICsgMl1cbiAgICAgICAgLy8gY29uc3QgeDIgPSBnZXRQb3MyW2kgKiAzXVxuICAgICAgICAvLyBjb25zdCB5MiA9IGdldFBvczJbaSAqIDMgKyAxXVxuICAgICAgICAvLyBjb25zdCB6MiA9IGdldFBvczJbaSAqIDMgKyAyXVxuICAgICAgICAvLyBjb25zdCB4MyA9IHRoaXMud29ybGRTcGFjZVBvaW50UG9zaXRpb25zW2kgKiAzXVxuICAgICAgICAvLyBjb25zdCB5MyA9IHRoaXMud29ybGRTcGFjZVBvaW50UG9zaXRpb25zW2kgKiAzICsgMV1cbiAgICAgICAgLy8gbGV0IHAxID0gbmV3IFRIUkVFLlZlY3RvcjMoeCwgeSwgMClcbiAgICAgICAgLy8gbGV0IHAyID0gbmV3IFRIUkVFLlZlY3RvcjMoeDIsIHkyLCAwKVxuICAgICAgICAvLyBsZXQgcDMgPSBuZXcgVEhSRUUuVmVjdG9yMyh4MywgeTMsIDApXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKHBvaW50bGwpXG4gICAgICAgIC8vIHBvaW50bGwucHVzaChwMylcbiAgICAgICAgLy8gZ2VvbWV0cnkudmVydGljZXMucHVzaChwMSk7XG4gICAgICAgIC8vIC8vIGdlb21ldHJ5LnZlcnRpY2VzLnB1c2gobmV3IFRIUkVFLlZlY3RvcjMoMCwgMCwgMCkpO1xuICAgICAgICAvLyBnZW9tZXRyeS52ZXJ0aWNlcy5wdXNoKHAyKTtcbiAgICAgICAgLy8gcG9pbnRzQXJyYXkucHVzaChuZXcgVEhSRUUuVmVjdG9yMyh4MiwgeTIsIHoyKSlcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ3AyLHAxJywgcDIsIHAxLCBwMywgZ2VvbWV0cnkpXG4gICAgICAgIC8vIHBvaW50c0FycmF5LnB1c2gobmV3IFRIUkVFLlZlY3RvcjMoeCwgeSwgeikpXG4gICAgICAgIC8vIHRoaXMubGluZWdlb21ldHJ5LnNldEZyb21Qb2ludHMocG9pbnRzQXJyYXkpXG4gICAgICAgIC8vIHBvaW50bGwudW5zaGlmdChwMSlcbiAgICAgICAgLy8gcG9pbnRsbC5wdXNoKHAzKVxuICAgICAgICAvLyBjb25zdCBjdXJ2ZSA9IG5ldyBUSFJFRS5TcGxpbmVDdXJ2ZShwb2ludGxsKTtcbiAgICAgICAgLy8gbGV0IHBvaW50cyA9IGN1cnZlLmdldFBvaW50cyg1MClcbiAgICAgICAgLy8gdmFyIGxpbmUgPSBuZXcgVEhSRUUuQ2F0bXVsbFJvbUN1cnZlMyhwb2ludGxsKTtcbiAgICAgICAgLy8gLy8gdGhpcy5saW5lc0NvbnRhaW5lci5wdXNoKGxpbmVcbiAgICAgICAgLy8gLy8gbGV0IHBvaW50cyA9IGxpbmUuZ2V0UG9pbnRzKDEwMClcbiAgICAgICAgLy8gZ2VvbWV0cnkuc2V0RnJvbVBvaW50cyhwb2ludHMpXG4gICAgICAgIC8vIHZhciBsaW5lbiA9IG5ldyBUSFJFRS5MaW5lKGdlb21ldHJ5LCBtYXRlcmlhbCk7XG4gICAgICAgIC8vIGlmICghd2luZG93LmxpbmVHZW9tZXJ0cnlMaXN0KSB7XG4gICAgICAgIC8vICAgd2luZG93LmxpbmVHZW9tZXJ0cnlMaXN0ID0gW11cbiAgICAgICAgLy8gfVxuICAgICAgICAvLyB3aW5kb3cubGluZUdlb21lcnRyeUxpc3QucHVzaChsaW5lbilcbiAgICAgICAgLy8gdGhpcy5zY2VuZS5hZGQobGluZW4pO1xuICAgICAgICAvL+mhtueCuVxuICAgICAgICAvL2dlb21ldHJ5LnZlcnRpY2VzLnB1c2gobmV3IFRIUkVFLlZlY3RvcjMoeCx5LHopKVxuICAgICAgfVxuICAgICAgLy/nlKjov5nkuKphcGnkvKDlhaXpobbngrnmlbDnu4RcbiAgICB9XG4gICAgLy8gfVxuXG5cblxuXG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50Q291bnQ7IGkrKykge1xuICAgICAgbGV0IGxlZnRPZmZzZXQgPSAwO1xuICAgICAgbGVmdE9mZnNldCArPSB0aGlzLmdseXBoVGV4dHVyZS5sZW5ndGhzWzEwNV07XG4gICAgICAvLyBEZXRlcm1pbmUgbGVuZ3RoIG9mIHdvcmQgaW4gcGl4ZWxzLlxuICAgICAgbGVmdE9mZnNldCAvPSAtMjsgLy8gY2VudGVycyB0ZXh0IGhvcml6b250YWxseSBhcm91bmQgdGhlIG9yaWdpblxuICAgICAgbGV0IGxldHRlcldpZHRoID0gdGhpcy5nbHlwaFRleHR1cmUubGVuZ3Roc1sxMDVdO1xuICAgICAgbGV0IHNjYWxlID0gRk9OVF9TSVpFO1xuICAgICAgbGV0IHJpZ2h0ID0gKGxlZnRPZmZzZXQgKyBsZXR0ZXJXaWR0aCkgLyBzY2FsZTtcbiAgICAgIGxldCB0cmlSaWdodCA9IChsZWZ0T2Zmc2V0ICsgdGhpcy5nbHlwaFRleHR1cmUubGVuZ3Roc1sxMTVdKSAvIHNjYWxlO1xuICAgICAgbGV0IGxlZnQgPSBsZWZ0T2Zmc2V0IC8gc2NhbGU7XG4gICAgICBsZXQgdG9wID0gNDAgLyBzY2FsZTtcblxuICAgICAgaWYgKHRoaXMuc2VsZWN0ZWRJbmRleExpc3QuaW5kZXhPZihNYXRoLmZsb29yKGkgLyAyKSkgPT09IC0xKSB7XG4gICAgICAgIC8v55+p5b2iXG4gICAgICAgIC8vIHBvc2l0aW9uT2JqZWN0LnNldFhZKGxldHRlcnNTb0ZhciAqIFZFUlRJQ0VTX1BFUl9HTFlQSCArIDAsIGxlZnQsIDApO1xuICAgICAgICAvLyBwb3NpdGlvbk9iamVjdC5zZXRYWShsZXR0ZXJzU29GYXIgKiBWRVJUSUNFU19QRVJfR0xZUEggKyAxLCByaWdodCAvIDIwLCAwKTtcbiAgICAgICAgLy8gcG9zaXRpb25PYmplY3Quc2V0WFkobGV0dGVyc1NvRmFyICogVkVSVElDRVNfUEVSX0dMWVBIICsgMiwgbGVmdCwgMTAgLyBzY2FsZSk7XG4gICAgICAgIC8vIHBvc2l0aW9uT2JqZWN0LnNldFhZKGxldHRlcnNTb0ZhciAqIFZFUlRJQ0VTX1BFUl9HTFlQSCArIDMsIGxlZnQsIDEwIC8gc2NhbGUpO1xuICAgICAgICAvLyBwb3NpdGlvbk9iamVjdC5zZXRYWShsZXR0ZXJzU29GYXIgKiBWRVJUSUNFU19QRVJfR0xZUEggKyA0LCByaWdodCAvIDIwLCAwKTtcbiAgICAgICAgLy8gcG9zaXRpb25PYmplY3Quc2V0WFkobGV0dGVyc1NvRmFyICogVkVSVElDRVNfUEVSX0dMWVBIICsgNSwgcmlnaHQgLyAyMCwgMTAgLyBzY2FsZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvL+S4ieinkuW9olxuICAgICAgICBpID09PSB0aGlzLnNlbGVjdGVkSW5kZXhMaXN0WzBdXG4gICAgICAgIHBvc2l0aW9uT2JqZWN0LnNldFhZKGxldHRlcnNTb0ZhciAqIFZFUlRJQ0VTX1BFUl9HTFlQSCArIDAsIGxlZnQsIDApO1xuICAgICAgICBwb3NpdGlvbk9iamVjdC5zZXRYWShsZXR0ZXJzU29GYXIgKiBWRVJUSUNFU19QRVJfR0xZUEggKyAxLCB0cmlSaWdodCwgMjAgLyBzY2FsZSk7XG4gICAgICAgIHBvc2l0aW9uT2JqZWN0LnNldFhZKGxldHRlcnNTb0ZhciAqIFZFUlRJQ0VTX1BFUl9HTFlQSCArIDIsIGxlZnQsIHRvcCk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5zZWxlY3RlZEluZGV4TGlzdC5sZW5ndGggPT0gMSAmJiB0aGlzLnNlbGVjdGVkSW5kZXhMaXN0LmluZGV4T2YoTWF0aC5mbG9vcihpIC8gMikpICE9PSAtMSkge1xuICAgICAgICBjb25zb2xlLmxvZygncmVzZXQnKVxuICAgICAgICBwb3NpdGlvbk9iamVjdC5zZXRYWShsZXR0ZXJzU29GYXIgKiBWRVJUSUNFU19QRVJfR0xZUEggKyAwLCBsZWZ0LCAwKTtcbiAgICAgICAgcG9zaXRpb25PYmplY3Quc2V0WFkobGV0dGVyc1NvRmFyICogVkVSVElDRVNfUEVSX0dMWVBIICsgMSwgdHJpUmlnaHQgKiAyLCAwKTtcbiAgICAgICAgcG9zaXRpb25PYmplY3Quc2V0WFkobGV0dGVyc1NvRmFyICogVkVSVElDRVNfUEVSX0dMWVBIICsgMiwgbGVmdCwgdG9wKTtcbiAgICAgIH1cblxuICAgICAgbGV0dGVyc1NvRmFyKys7XG4gICAgICBsZWZ0T2Zmc2V0ICs9IGxldHRlcldpZHRoO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcG9pbnRDb3VudDsgaSsrKSB7XG4gICAgICBjb25zdCBwID0gdXRpbC52ZWN0b3IzRnJvbVBhY2tlZEFycmF5KHRoaXMud29ybGRTcGFjZVBvaW50UG9zaXRpb25zLCBpKTtcbiAgICAgIHRoaXMubGFiZWxWZXJ0ZXhNYXBbaV0uZm9yRWFjaCgoaikgPT4ge1xuICAgICAgICB0aGlzLnBvc2l0aW9ucy5zZXRYWVooaiwgcC54LCBwLnksIHAueik7XG4gICAgICB9KTtcbiAgICB9XG4gICAgdGhpcy5wb2ludHNNZXNoID0gbmV3IFRIUkVFLk1lc2godGhpcy5nZW9tZXRyeSwgdGhpcy5tYXRlcmlhbCk7XG4gICAgdGhpcy5wb2ludHNNZXNoLmZydXN0dW1DdWxsZWQgPSBmYWxzZTtcbiAgICBjb25zb2xlLmxvZyh0aGlzLmdlb21ldHJ5LCB0aGlzLnBvaW50c01lc2gpXG4gICAgdGhpcy5zY2VuZS5hZGQodGhpcy5wb2ludHNNZXNoKTtcbiAgfVxuICBwcml2YXRlIGNvbG9yTGFiZWxzKHBvaW50Q29sb3JzOiBGbG9hdDMyQXJyYXkpIHtcbiAgICBpZiAoXG4gICAgICB0aGlzLmdlb21ldHJ5ID09IG51bGwgfHxcbiAgICAgIHBvaW50Q29sb3JzID09IG51bGxcbiAgICApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgY29sb3JzID0gdGhpcy5nZW9tZXRyeS5nZXRBdHRyaWJ1dGUoJ2NvbG9yJykgYXMgVEhSRUUuQnVmZmVyQXR0cmlidXRlO1xuICAgIChjb2xvcnMgYXMgYW55KS5zZXRBcnJheSh0aGlzLnJlbmRlckNvbG9ycyk7XG4gICAgY29uc3QgbiA9IHBvaW50Q29sb3JzLmxlbmd0aCAvIFhZWl9FTEVNRU5UU19QRVJfRU5UUlk7XG4gICAgbGV0IHNyYyA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyArK2kpIHtcbiAgICAgIGNvbnN0IGMgPSBuZXcgVEhSRUUuQ29sb3IoXG4gICAgICAgIHBvaW50Q29sb3JzW3NyY10sXG4gICAgICAgIHBvaW50Q29sb3JzW3NyYyArIDFdLFxuICAgICAgICBwb2ludENvbG9yc1tzcmMgKyAyXVxuICAgICAgKTtcbiAgICAgIGNvbnN0IG0gPSB0aGlzLmxhYmVsVmVydGV4TWFwW2ldLmxlbmd0aDtcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbTsgKytqKSB7XG4gICAgICAgIGNvbG9ycy5zZXRYWVoodGhpcy5sYWJlbFZlcnRleE1hcFtpXVtqXSwgYy5yLCBjLmcsIGMuYik7XG4gICAgICB9XG4gICAgICBzcmMgKz0gUkdCX0VMRU1FTlRTX1BFUl9FTlRSWTtcbiAgICB9XG4gICAgY29sb3JzLm5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgfVxuICBzZXRTY2VuZShzY2VuZTogVEhSRUUuU2NlbmUpIHtcbiAgICB0aGlzLnNjZW5lID0gc2NlbmU7XG4gIH1cbiAgZGlzcG9zZSgpIHtcbiAgICBjb25zb2xlLmxvZygndGhpcy5wb2x5bGluZWdlbW8nLHRoaXMucG9seWxpbmVzKVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5wb2x5bGluZXM/Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLnNjZW5lLnJlbW92ZSh0aGlzLnBvbHlsaW5lc1tpXSk7XG4gICAgICB0aGlzLnBvbHlsaW5lc1tpXS5nZW9tZXRyeS5kaXNwb3NlKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLnBvaW50c01lc2gpIHtcbiAgICAgIGlmICh0aGlzLnNjZW5lKSB7XG4gICAgICAgIHRoaXMuc2NlbmUucmVtb3ZlKHRoaXMucG9pbnRzTWVzaCk7XG4gICAgICB9XG4gICAgICB0aGlzLnBvaW50c01lc2ggPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5nZW9tZXRyeSkge1xuICAgICAgdGhpcy5nZW9tZXRyeS5kaXNwb3NlKCk7XG4gICAgICB0aGlzLmdlb21ldHJ5ID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMubGluZXNDb250YWluZXIpIHtcbiAgICAgIC8vIHRoaXMubGluZXNDb250YWluZXIuZm9yRWFjaCgoaXRlbTphbnkpID0+IHtcbiAgICAgIC8vICAgLy8gaXRlbT8uZGlzcG9zZSgpXG4gICAgICAvLyB9KTtcbiAgICB9XG4gICAgaWYgKHRoaXMubGluZWdlb21ldHJ5KSB7XG4gICAgICB0aGlzLmxpbmVnZW9tZXRyeS5kaXNwb3NlKCk7XG4gICAgICB0aGlzLmxpbmVnZW9tZXRyeSA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLmdseXBoVGV4dHVyZSAhPSBudWxsICYmIHRoaXMuZ2x5cGhUZXh0dXJlLnRleHR1cmUgIT0gbnVsbCkge1xuICAgICAgdGhpcy5nbHlwaFRleHR1cmUudGV4dHVyZS5kaXNwb3NlKCk7XG4gICAgICB0aGlzLmdseXBoVGV4dHVyZS50ZXh0dXJlID0gbnVsbDtcbiAgICB9XG4gIH1cbiAgb25QaWNraW5nUmVuZGVyKHJjOiBSZW5kZXJDb250ZXh0KSB7XG4gICAgaWYgKHRoaXMuZ2VvbWV0cnkgPT0gbnVsbCkge1xuICAgICAgdGhpcy5jcmVhdGVUcmlhbmdsZXMoKVxuICAgIH1cbiAgICBpZiAodGhpcy5nZW9tZXRyeSA9PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMubWF0ZXJpYWwudW5pZm9ybXMudGV4dHVyZS52YWx1ZSA9IHRoaXMuZ2x5cGhUZXh0dXJlLnRleHR1cmU7XG4gICAgdGhpcy5tYXRlcmlhbC51bmlmb3Jtcy5waWNraW5nLnZhbHVlID0gdHJ1ZTtcbiAgICBjb25zdCBjb2xvcnMgPSB0aGlzLmdlb21ldHJ5LmdldEF0dHJpYnV0ZSgnY29sb3InKSBhcyBUSFJFRS5CdWZmZXJBdHRyaWJ1dGU7XG4gICAgKGNvbG9ycyBhcyBhbnkpLnNldEFycmF5KHRoaXMucGlja2luZ0NvbG9ycyk7XG4gICAgY29sb3JzLm5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgfVxuICBvblJlbmRlcihyYzogUmVuZGVyQ29udGV4dCkge1xuICAgIGlmICh0aGlzLmdlb21ldHJ5ID09IG51bGwpIHtcbiAgICAgIHRoaXMuY3JlYXRlVHJpYW5nbGVzKClcbiAgICB9XG4gICAgaWYgKHRoaXMuZ2VvbWV0cnkgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmNvbG9yTGFiZWxzKHJjLnBvaW50Q29sb3JzKTtcbiAgICB0aGlzLm1hdGVyaWFsLnVuaWZvcm1zLnRleHR1cmUudmFsdWUgPSB0aGlzLmdseXBoVGV4dHVyZS50ZXh0dXJlO1xuICAgIHRoaXMubWF0ZXJpYWwudW5pZm9ybXMucGlja2luZy52YWx1ZSA9IGZhbHNlO1xuICAgIGNvbnN0IGNvbG9ycyA9IHRoaXMuZ2VvbWV0cnkuZ2V0QXR0cmlidXRlKCdjb2xvcicpIGFzIFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZTtcbiAgICAoY29sb3JzIGFzIGFueSkuc2V0QXJyYXkodGhpcy5yZW5kZXJDb2xvcnMpO1xuICAgIGNvbG9ycy5uZWVkc1VwZGF0ZSA9IHRydWU7XG4gIH1cbiAgb25Qb2ludFBvc2l0aW9uc0NoYW5nZWQobmV3UG9zaXRpb25zOiBGbG9hdDMyQXJyYXkpIHtcbiAgICB0aGlzLndvcmxkU3BhY2VQb2ludFBvc2l0aW9ucyA9IG5ld1Bvc2l0aW9ucztcbiAgICB0aGlzLmRpc3Bvc2UoKTtcbiAgfVxuICAvLyBzZXRMYWJlbFN0cmluZ3MobGFiZWxTdHJpbmdzOiBzdHJpbmdbXSkge1xuICAvLyAgIHRoaXMubGFiZWxTdHJpbmdzID0gbGFiZWxTdHJpbmdzO1xuICAvLyAgIHRoaXMuZGlzcG9zZSgpO1xuICAvLyB9XG4gIHNldFNlbGVjdGVkUG9pbnQoc2VsZWN0ZWRJbmRleExpc3Q6IG51bWJlcltdKSB7XG4gICAgdGhpcy5zZWxlY3RlZEluZGV4TGlzdCA9IHNlbGVjdGVkSW5kZXhMaXN0XG4gIH1cbiAgc2V0RXBvY2hlcyhlcG9jaGVzOiBudW1iZXJbXSkge1xuICAgIHRoaXMuZXBvY2hlcyA9IGVwb2NoZXNcbiAgfVxuICBvblJlc2l6ZShuZXdXaWR0aDogbnVtYmVyLCBuZXdIZWlnaHQ6IG51bWJlcikgeyB9XG59XG4iXX0=