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
import { CameraType } from './renderContext';
import * as util from './util';
const NUM_POINTS_FOG_THRESHOLD = 5000;
const MIN_POINT_SIZE = 5;
const IMAGE_SIZE = 30;
// Constants relating to the indices of buffer arrays.
const RGB_NUM_ELEMENTS = 3;
const INDEX_NUM_ELEMENTS = 1;
const XYZ_NUM_ELEMENTS = 3;
function createVertexShader() {
    return `
  // Index of the specific vertex (passed in as bufferAttribute), and the
  // variable that will be used to pass it to the fragment shader.
  attribute float spriteIndex;
  attribute vec3 color;
  attribute float scaleFactor;

  varying vec2 xyIndex;
  varying vec3 vColor;

  uniform bool sizeAttenuation;
  uniform float pointSize;
  uniform float spritesPerRow;
  uniform float spritesPerColumn;

  ${THREE.ShaderChunk['fog_pars_vertex']}

  void main() {
    // Pass index and color values to fragment shader.
    vColor = color;
    xyIndex = vec2(mod(spriteIndex, spritesPerRow),
              floor(spriteIndex / spritesPerColumn));

    // Transform current vertex by modelViewMatrix (model world position and
    // camera world position matrix).
    vec4 cameraSpacePos = modelViewMatrix * vec4(position, 1.0);

    // Project vertex in camera-space to screen coordinates using the camera's
    // projection matrix.
    gl_Position = projectionMatrix * cameraSpacePos;

    // Create size attenuation (if we're in 3D mode) by making the size of
    // each point inversly proportional to its distance to the camera.
    float outputPointSize = pointSize;
    if (sizeAttenuation) {
      outputPointSize = -pointSize / cameraSpacePos.z;
    } else {  // Create size attenuation (if we're in 2D mode)
      const float PI = 3.1415926535897932384626433832795;
      const float minScale = 0.1;  // minimum scaling factor
      const float outSpeed = 2.0;  // shrink speed when zooming out
      const float outNorm = (1. - minScale) / atan(outSpeed);
      const float maxScale = 15.0;  // maximum scaling factor
      const float inSpeed = 0.02;  // enlarge speed when zooming in
      const float zoomOffset = 0.3;  // offset zoom pivot
      float zoom = projectionMatrix[0][0] + zoomOffset;  // zoom pivot
      float scale = zoom < 1. ? 1. + outNorm * atan(outSpeed * (zoom - 1.)) :
                    1. + 2. / PI * (maxScale - 1.) * atan(inSpeed * (zoom - 1.));
      outputPointSize = pointSize * scale;
    }

    gl_PointSize =
      max(outputPointSize * scaleFactor, ${MIN_POINT_SIZE.toFixed(1)});
  }`;
}
const FRAGMENT_SHADER_POINT_TEST_CHUNK = `
  bool point_in_unit_circle(vec2 spriteCoord) {
    vec2 centerToP = spriteCoord - vec2(0.5, 0.5);
    return dot(centerToP, centerToP) < (0.5 * 0.5);
  }

  bool point_in_unit_equilateral_triangle(vec2 spriteCoord) {
    vec3 v0 = vec3(0, 1, 0);
    vec3 v1 = vec3(0.5, 0, 0);
    vec3 v2 = vec3(1, 1, 0);
    vec3 p = vec3(spriteCoord, 0);
    float p_in_v0_v1 = cross(v1 - v0, p - v0).z;
    float p_in_v1_v2 = cross(v2 - v1, p - v1).z;
    return (p_in_v0_v1 > 0.0) && (p_in_v1_v2 > 0.0);
  }

  bool point_in_unit_square(vec2 spriteCoord) {
    return true;
  }
`;
function createFragmentShader() {
    return `
  varying vec2 xyIndex;
  varying vec3 vColor;

  uniform sampler2D texture;
  uniform float spritesPerRow;
  uniform float spritesPerColumn;
  uniform bool isImage;

  ${THREE.ShaderChunk['common']}
  ${THREE.ShaderChunk['fog_pars_fragment']}
  ${FRAGMENT_SHADER_POINT_TEST_CHUNK}

  void main() {
    if (isImage) {
      // Coordinates of the vertex within the entire sprite image.
      vec2 coords =
        (gl_PointCoord + xyIndex) / vec2(spritesPerRow, spritesPerColumn);
      gl_FragColor = vec4(vColor, 1.0) * texture2D(texture, coords);
    } else {
      bool inside = point_in_unit_circle(gl_PointCoord);
      if (!inside) {
        discard;
      }
      gl_FragColor = vec4(vColor, 1);
    }
    ${THREE.ShaderChunk['fog_fragment']}
  }`;
}
const FRAGMENT_SHADER_PICKING = `
  varying vec2 xyIndex;
  varying vec3 vColor;
  uniform bool isImage;

  ${FRAGMENT_SHADER_POINT_TEST_CHUNK}

  void main() {
    xyIndex; // Silence 'unused variable' warning.
    if (isImage) {
      gl_FragColor = vec4(vColor, 1);
    } else {
      bool inside = point_in_unit_circle(gl_PointCoord);
      if (!inside) {
        discard;
      }
      gl_FragColor = vec4(vColor, 1);
    }
  }`;
/**
 * Uses GL point sprites to render the dataset.
 */
export class ScatterPlotVisualizerSprites {
    constructor() {
        this.VERTEX_SHADER = createVertexShader();
        this.FRAGMENT_SHADER = createFragmentShader();
        this.texture = null;
        this.standinTextureForPoints = util.createTexture(document.createElement('canvas'));
        this.renderMaterial = this.createRenderMaterial(false);
        this.pickingMaterial = this.createPickingMaterial(false);
    }
    createTextureFromSpriteAtlas(spriteAtlas, spriteDimensions, spriteIndices) {
        this.texture = util.createTexture(spriteAtlas);
        this.spritesPerRow = spriteAtlas.width / spriteDimensions[0];
        this.spritesPerColumn = spriteAtlas.height / spriteDimensions[1];
        this.spriteDimensions = spriteDimensions;
        this.spriteIndexBufferAttribute = new THREE.BufferAttribute(spriteIndices, INDEX_NUM_ELEMENTS);
        if (this.points != null) {
            this.points.geometry.addAttribute('spriteIndex', this.spriteIndexBufferAttribute);
        }
    }
    createUniforms() {
        return {
            texture: { type: 't' },
            spritesPerRow: { type: 'f' },
            spritesPerColumn: { type: 'f' },
            fogColor: { type: 'c' },
            fogNear: { type: 'f' },
            fogFar: { type: 'f' },
            isImage: { type: 'bool' },
            sizeAttenuation: { type: 'bool' },
            pointSize: { type: 'f' },
        };
    }
    createRenderMaterial(haveImage) {
        const uniforms = this.createUniforms();
        return new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: this.VERTEX_SHADER,
            fragmentShader: this.FRAGMENT_SHADER,
            transparent: !haveImage,
            depthTest: haveImage,
            depthWrite: haveImage,
            fog: true,
            blending: THREE.MultiplyBlending,
        });
    }
    createPickingMaterial(haveImage) {
        const uniforms = this.createUniforms();
        return new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: this.VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER_PICKING,
            transparent: true,
            depthTest: true,
            depthWrite: true,
            fog: false,
            blending: THREE.NormalBlending,
        });
    }
    /**
     * Create points, set their locations and actually instantiate the
     * geometry.
     */
    createPointSprites(scene, positions) {
        const pointCount = positions != null ? positions.length / XYZ_NUM_ELEMENTS : 0;
        const geometry = this.createGeometry(pointCount);
        this.fog = new THREE.Fog(16777215); // unused value, gets overwritten.
        this.points = new THREE.Points(geometry, this.renderMaterial);
        this.points.frustumCulled = false;
        if (this.spriteIndexBufferAttribute != null) {
            this.points.geometry.addAttribute('spriteIndex', this.spriteIndexBufferAttribute);
        }
        scene.add(this.points);
    }
    calculatePointSize(sceneIs3D) {
        if (this.texture != null) {
            return sceneIs3D ? IMAGE_SIZE : this.spriteDimensions[0];
        }
        const n = this.worldSpacePointPositions != null
            ? this.worldSpacePointPositions.length / XYZ_NUM_ELEMENTS
            : 1;
        const SCALE = 200;
        const LOG_BASE = 8;
        const DIVISOR = 1.5;
        // Scale point size inverse-logarithmically to the number of points.
        const pointSize = SCALE / Math.log(n) / Math.log(LOG_BASE);
        return sceneIs3D ? pointSize : pointSize / DIVISOR;
    }
    /**
     * Set up buffer attributes to be used for the points/images.
     */
    createGeometry(pointCount) {
        const n = pointCount;
        // Fill pickingColors with each point's unique id as its color.
        this.pickingColors = new Float32Array(n * RGB_NUM_ELEMENTS);
        {
            let dst = 0;
            for (let i = 0; i < n; i++) {
                const c = new THREE.Color(i);
                this.pickingColors[dst++] = c.r;
                this.pickingColors[dst++] = c.g;
                this.pickingColors[dst++] = c.b;
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(undefined, XYZ_NUM_ELEMENTS));
        geometry.addAttribute('color', new THREE.BufferAttribute(undefined, RGB_NUM_ELEMENTS));
        geometry.addAttribute('scaleFactor', new THREE.BufferAttribute(undefined, INDEX_NUM_ELEMENTS));
        return geometry;
    }
    setFogDistances(sceneIs3D, nearestPointZ, farthestPointZ) {
        if (sceneIs3D) {
            const n = this.worldSpacePointPositions.length / XYZ_NUM_ELEMENTS;
            this.fog.near = nearestPointZ;
            // If there are fewer points we want less fog. We do this
            // by making the "far" value (that is, the distance from the camera to the
            // far edge of the fog) proportional to the number of points.
            let multiplier = 2 - Math.min(n, NUM_POINTS_FOG_THRESHOLD) / NUM_POINTS_FOG_THRESHOLD;
            this.fog.far = farthestPointZ * multiplier;
        }
        else {
            this.fog.near = Infinity;
            this.fog.far = Infinity;
        }
    }
    dispose() {
        this.disposeGeometry();
        this.disposeTextureAtlas();
    }
    disposeGeometry() {
        if (this.points != null) {
            this.scene.remove(this.points);
            this.points.geometry.dispose();
            this.points = null;
            this.worldSpacePointPositions = null;
        }
    }
    disposeTextureAtlas() {
        if (this.texture != null) {
            this.texture.dispose();
        }
        this.texture = null;
        this.renderMaterial = null;
        this.pickingMaterial = null;
    }
    setScene(scene) {
        this.scene = scene;
    }
    setSpriteAtlas(spriteImage, spriteDimensions, spriteIndices) {
        this.disposeTextureAtlas();
        this.createTextureFromSpriteAtlas(spriteImage, spriteDimensions, spriteIndices);
        this.renderMaterial = this.createRenderMaterial(true);
        this.pickingMaterial = this.createPickingMaterial(true);
    }
    clearSpriteAtlas() {
        this.disposeTextureAtlas();
        this.renderMaterial = this.createRenderMaterial(false);
        this.pickingMaterial = this.createPickingMaterial(false);
    }
    onPointPositionsChanged(newPositions) {
        if (newPositions == null || newPositions.length === 0) {
            this.dispose();
            return;
        }
        if (this.points != null) {
            if (this.worldSpacePointPositions.length !== newPositions.length) {
                this.disposeGeometry();
            }
        }
        this.worldSpacePointPositions = newPositions;
        if (this.points == null) {
            this.createPointSprites(this.scene, newPositions);
        }
        const positions = this.points
            .geometry.getAttribute('position');
        positions.setArray(newPositions);
        positions.needsUpdate = true;
    }
    onPickingRender(rc) {
        if (this.points == null) {
            return;
        }
        const sceneIs3D = rc.cameraType === CameraType.Perspective;
        this.pickingMaterial.uniforms.spritesPerRow.value = this.spritesPerRow;
        this.pickingMaterial.uniforms.spritesPerRow.value = this.spritesPerColumn;
        this.pickingMaterial.uniforms.sizeAttenuation.value = sceneIs3D;
        this.pickingMaterial.uniforms.pointSize.value = this.calculatePointSize(sceneIs3D);
        this.points.material = this.pickingMaterial;
        let colors = this.points.geometry.getAttribute('color');
        colors.setArray(this.pickingColors);
        colors.needsUpdate = true;
        let scaleFactors = this.points
            .geometry.getAttribute('scaleFactor');
        scaleFactors.setArray(rc.pointScaleFactors);
        scaleFactors.needsUpdate = true;
    }
    onRender(rc) {
        if (!this.points) {
            return;
        }
        const sceneIs3D = rc.camera instanceof THREE.PerspectiveCamera;
        this.setFogDistances(sceneIs3D, rc.nearestCameraSpacePointZ, rc.farthestCameraSpacePointZ);
        this.scene.fog = this.fog;
        this.scene.fog.color = new THREE.Color(rc.backgroundColor);
        this.renderMaterial.uniforms.fogColor.value = this.scene.fog.color;
        this.renderMaterial.uniforms.fogNear.value = this.fog.near;
        this.renderMaterial.uniforms.fogFar.value = this.fog.far;
        this.renderMaterial.uniforms.spritesPerRow.value = this.spritesPerRow;
        this.renderMaterial.uniforms.spritesPerColumn.value = this.spritesPerColumn;
        this.renderMaterial.uniforms.isImage.value = this.texture != null;
        this.renderMaterial.uniforms.texture.value =
            this.texture != null ? this.texture : this.standinTextureForPoints;
        this.renderMaterial.uniforms.sizeAttenuation.value = sceneIs3D;
        this.renderMaterial.uniforms.pointSize.value = this.calculatePointSize(sceneIs3D);
        this.points.material = this.renderMaterial;
        let colors = this.points.geometry.getAttribute('color');
        this.renderColors = rc.pointColors;
        colors.setArray(this.renderColors);
        colors.needsUpdate = true;
        let scaleFactors = this.points
            .geometry.getAttribute('scaleFactor');
        scaleFactors.setArray(rc.pointScaleFactors);
        scaleFactors.needsUpdate = true;
    }
    onResize(newWidth, newHeight) { }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NhdHRlclBsb3RWaXN1YWxpemVyU3ByaXRlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3RlbnNvcmJvYXJkL3Byb2plY3Rvci9zY2F0dGVyUGxvdFZpc3VhbGl6ZXJTcHJpdGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7O2dGQWFnRjtBQUNoRixPQUFPLEtBQUssS0FBSyxNQUFNLE9BQU8sQ0FBQztBQUUvQixPQUFPLEVBQUMsVUFBVSxFQUFnQixNQUFNLGlCQUFpQixDQUFDO0FBRTFELE9BQU8sS0FBSyxJQUFJLE1BQU0sUUFBUSxDQUFDO0FBRS9CLE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxDQUFDO0FBQ3RDLE1BQU0sY0FBYyxHQUFHLENBQUMsQ0FBQztBQUN6QixNQUFNLFVBQVUsR0FBRyxFQUFFLENBQUM7QUFDdEIsc0RBQXNEO0FBQ3RELE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO0FBQzNCLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO0FBQzdCLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO0FBRTNCLFNBQVMsa0JBQWtCO0lBQ3pCLE9BQU87Ozs7Ozs7Ozs7Ozs7OztJQWVMLEtBQUssQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzsyQ0FvQ0csY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDaEUsQ0FBQztBQUNMLENBQUM7QUFFRCxNQUFNLGdDQUFnQyxHQUFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBbUJ4QyxDQUFDO0FBRUYsU0FBUyxvQkFBb0I7SUFDM0IsT0FBTzs7Ozs7Ozs7O0lBU0wsS0FBSyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUM7SUFDM0IsS0FBSyxDQUFDLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQztJQUN0QyxnQ0FBZ0M7Ozs7Ozs7Ozs7Ozs7OztNQWU5QixLQUFLLENBQUMs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QUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUM7UUFDckUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLEtBQUssR0FBRyxTQUFTLENBQUM7UUFDL0QsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQ3BFLFNBQVMsQ0FDVixDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQztRQUMzQyxJQUFJLE1BQU0sR0FBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQWlDLENBQUMsWUFBWSxDQUN0RSxPQUFPLENBQ2lCLENBQUM7UUFDM0IsSUFBSSxDQUFDLFlBQVksR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDO1FBQ2xDLE1BQWMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzVDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBQzFCLElBQUksWUFBWSxHQUFJLElBQUksQ0FBQyxNQUFNO2FBQzVCLFFBQWlDLENBQUMsWUFBWSxDQUMvQyxhQUFhLENBQ1csQ0FBQztRQUMxQixZQUFvQixDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUNyRCxZQUFZLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztJQUNsQyxDQUFDO0lBQ0QsUUFBUSxDQUFDLFFBQWdCLEVBQUUsU0FBaUIsSUFBRyxDQUFDO0NBQ2pEIiwic291cmNlc0NvbnRlbnQiOlsiLyogQ29weXJpZ2h0IDIwMTYgVGhlIFRlbnNvckZsb3cgQXV0aG9ycy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG49PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuXG5pbXBvcnQge0NhbWVyYVR5cGUsIFJlbmRlckNvbnRleHR9IGZyb20gJy4vcmVuZGVyQ29udGV4dCc7XG5pbXBvcnQge1NjYXR0ZXJQbG90VmlzdWFsaXplcn0gZnJvbSAnLi9zY2F0dGVyUGxvdFZpc3VhbGl6ZXInO1xuaW1wb3J0ICogYXMgdXRpbCBmcm9tICcuL3V0aWwnO1xuXG5jb25zdCBOVU1fUE9JTlRTX0ZPR19USFJFU0hPTEQgPSA1MDAwO1xuY29uc3QgTUlOX1BPSU5UX1NJWkUgPSA1O1xuY29uc3QgSU1BR0VfU0laRSA9IDMwO1xuLy8gQ29uc3RhbnRzIHJlbGF0aW5nIHRvIHRoZSBpbmRpY2VzIG9mIGJ1ZmZlciBhcnJheXMuXG5jb25zdCBSR0JfTlVNX0VMRU1FTlRTID0gMztcbmNvbnN0IElOREVYX05VTV9FTEVNRU5UUyA9IDE7XG5jb25zdCBYWVpfTlVNX0VMRU1FTlRTID0gMztcblxuZnVuY3Rpb24gY3JlYXRlVmVydGV4U2hhZGVyKCkge1xuICByZXR1cm4gYFxuICAvLyBJbmRleCBvZiB0aGUgc3BlY2lmaWMgdmVydGV4IChwYXNzZWQgaW4gYXMgYnVmZmVyQXR0cmlidXRlKSwgYW5kIHRoZVxuICAvLyB2YXJpYWJsZSB0aGF0IHdpbGwgYmUgdXNlZCB0byBwYXNzIGl0IHRvIHRoZSBmcmFnbWVudCBzaGFkZXIuXG4gIGF0dHJpYnV0ZSBmbG9hdCBzcHJpdGVJbmRleDtcbiAgYXR0cmlidXRlIHZlYzMgY29sb3I7XG4gIGF0dHJpYnV0ZSBmbG9hdCBzY2FsZUZhY3RvcjtcblxuICB2YXJ5aW5nIHZlYzIgeHlJbmRleDtcbiAgdmFyeWluZyB2ZWMzIHZDb2xvcjtcblxuICB1bmlmb3JtIGJvb2wgc2l6ZUF0dGVudWF0aW9uO1xuICB1bmlmb3JtIGZsb2F0IHBvaW50U2l6ZTtcbiAgdW5pZm9ybSBmbG9hdCBzcHJpdGVzUGVyUm93O1xuICB1bmlmb3JtIGZsb2F0IHNwcml0ZXNQZXJDb2x1bW47XG5cbiAgJHtUSFJFRS5TaGFkZXJDaHVua1snZm9nX3BhcnNfdmVydGV4J119XG5cbiAgdm9pZCBtYWluKCkge1xuICAgIC8vIFBhc3MgaW5kZXggYW5kIGNvbG9yIHZhbHVlcyB0byBmcmFnbWVudCBzaGFkZXIuXG4gICAgdkNvbG9yID0gY29sb3I7XG4gICAgeHlJbmRleCA9IHZlYzIobW9kKHNwcml0ZUluZGV4LCBzcHJpdGVzUGVyUm93KSxcbiAgICAgICAgICAgICAgZmxvb3Ioc3ByaXRlSW5kZXggLyBzcHJpdGVzUGVyQ29sdW1uKSk7XG5cbiAgICAvLyBUcmFuc2Zvcm0gY3VycmVudCB2ZXJ0ZXggYnkgbW9kZWxWaWV3TWF0cml4IChtb2RlbCB3b3JsZCBwb3NpdGlvbiBhbmRcbiAgICAvLyBjYW1lcmEgd29ybGQgcG9zaXRpb24gbWF0cml4KS5cbiAgICB2ZWM0IGNhbWVyYVNwYWNlUG9zID0gbW9kZWxWaWV3TWF0cml4ICogdmVjNChwb3NpdGlvbiwgMS4wKTtcblxuICAgIC8vIFByb2plY3QgdmVydGV4IGluIGNhbWVyYS1zcGFjZSB0byBzY3JlZW4gY29vcmRpbmF0ZXMgdXNpbmcgdGhlIGNhbWVyYSdzXG4gICAgLy8gcHJvamVjdGlvbiBtYXRyaXguXG4gICAgZ2xfUG9zaXRpb24gPSBwcm9qZWN0aW9uTWF0cml4ICogY2FtZXJhU3BhY2VQb3M7XG5cbiAgICAvLyBDcmVhdGUgc2l6ZSBhdHRlbnVhdGlvbiAoaWYgd2UncmUgaW4gM0QgbW9kZSkgYnkgbWFraW5nIHRoZSBzaXplIG9mXG4gICAgLy8gZWFjaCBwb2ludCBpbnZlcnNseSBwcm9wb3J0aW9uYWwgdG8gaXRzIGRpc3RhbmNlIHRvIHRoZSBjYW1lcmEuXG4gICAgZmxvYXQgb3V0cHV0UG9pbnRTaXplID0gcG9pbnRTaXplO1xuICAgIGlmIChzaXplQXR0ZW51YXRpb24pIHtcbiAgICAgIG91dHB1dFBvaW50U2l6ZSA9IC1wb2ludFNpemUgLyBjYW1lcmFTcGFjZVBvcy56O1xuICAgIH0gZWxzZSB7ICAvLyBDcmVhdGUgc2l6ZSBhdHRlbnVhdGlvbiAoaWYgd2UncmUgaW4gMkQgbW9kZSlcbiAgICAgIGNvbnN0IGZsb2F0IFBJID0gMy4xNDE1OTI2NTM1ODk3OTMyMzg0NjI2NDMzODMyNzk1O1xuICAgICAgY29uc3QgZmxvYXQgbWluU2NhbGUgPSAwLjE7ICAvLyBtaW5pbXVtIHNjYWxpbmcgZmFjdG9yXG4gICAgICBjb25zdCBmbG9hdCBvdXRTcGVlZCA9IDIuMDsgIC8vIHNocmluayBzcGVlZCB3aGVuIHpvb21pbmcgb3V0XG4gICAgICBjb25zdCBmbG9hdCBvdXROb3JtID0gKDEuIC0gbWluU2NhbGUpIC8gYXRhbihvdXRTcGVlZCk7XG4gICAgICBjb25zdCBmbG9hdCBtYXhTY2FsZSA9IDE1LjA7ICAvLyBtYXhpbXVtIHNjYWxpbmcgZmFjdG9yXG4gICAgICBjb25zdCBmbG9hdCBpblNwZWVkID0gMC4wMjsgIC8vIGVubGFyZ2Ugc3BlZWQgd2hlbiB6b29taW5nIGluXG4gICAgICBjb25zdCBmbG9hdCB6b29tT2Zmc2V0ID0gMC4zOyAgLy8gb2Zmc2V0IHpvb20gcGl2b3RcbiAgICAgIGZsb2F0IHpvb20gPSBwcm9qZWN0aW9uTWF0cml4WzBdWzBdICsgem9vbU9mZnNldDsgIC8vIHpvb20gcGl2b3RcbiAgICAgIGZsb2F0IHNjYWxlID0gem9vbSA8IDEuID8gMS4gKyBvdXROb3JtICogYXRhbihvdXRTcGVlZCAqICh6b29tIC0gMS4pKSA6XG4gICAgICAgICAgICAgICAgICAgIDEuICsgMi4gLyBQSSAqIChtYXhTY2FsZSAtIDEuKSAqIGF0YW4oaW5TcGVlZCAqICh6b29tIC0gMS4pKTtcbiAgICAgIG91dHB1dFBvaW50U2l6ZSA9IHBvaW50U2l6ZSAqIHNjYWxlO1xuICAgIH1cblxuICAgIGdsX1BvaW50U2l6ZSA9XG4gICAgICBtYXgob3V0cHV0UG9pbnRTaXplICogc2NhbGVGYWN0b3IsICR7TUlOX1BPSU5UX1NJWkUudG9GaXhlZCgxKX0pO1xuICB9YDtcbn1cblxuY29uc3QgRlJBR01FTlRfU0hBREVSX1BPSU5UX1RFU1RfQ0hVTksgPSBgXG4gIGJvb2wgcG9pbnRfaW5fdW5pdF9jaXJjbGUodmVjMiBzcHJpdGVDb29yZCkge1xuICAgIHZlYzIgY2VudGVyVG9QID0gc3ByaXRlQ29vcmQgLSB2ZWMyKDAuNSwgMC41KTtcbiAgICByZXR1cm4gZG90KGNlbnRlclRvUCwgY2VudGVyVG9QKSA8ICgwLjUgKiAwLjUpO1xuICB9XG5cbiAgYm9vbCBwb2ludF9pbl91bml0X2VxdWlsYXRlcmFsX3RyaWFuZ2xlKHZlYzIgc3ByaXRlQ29vcmQpIHtcbiAgICB2ZWMzIHYwID0gdmVjMygwLCAxLCAwKTtcbiAgICB2ZWMzIHYxID0gdmVjMygwLjUsIDAsIDApO1xuICAgIHZlYzMgdjIgPSB2ZWMzKDEsIDEsIDApO1xuICAgIHZlYzMgcCA9IHZlYzMoc3ByaXRlQ29vcmQsIDApO1xuICAgIGZsb2F0IHBfaW5fdjBfdjEgPSBjcm9zcyh2MSAtIHYwLCBwIC0gdjApLno7XG4gICAgZmxvYXQgcF9pbl92MV92MiA9IGNyb3NzKHYyIC0gdjEsIHAgLSB2MSkuejtcbiAgICByZXR1cm4gKHBfaW5fdjBfdjEgPiAwLjApICYmIChwX2luX3YxX3YyID4gMC4wKTtcbiAgfVxuXG4gIGJvb2wgcG9pbnRfaW5fdW5pdF9zcXVhcmUodmVjMiBzcHJpdGVDb29yZCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5gO1xuXG5mdW5jdGlvbiBjcmVhdGVGcmFnbWVudFNoYWRlcigpIHtcbiAgcmV0dXJuIGBcbiAgdmFyeWluZyB2ZWMyIHh5SW5kZXg7XG4gIHZhcnlpbmcgdmVjMyB2Q29sb3I7XG5cbiAgdW5pZm9ybSBzYW1wbGVyMkQgdGV4dHVyZTtcbiAgdW5pZm9ybSBmbG9hdCBzcHJpdGVzUGVyUm93O1xuICB1bmlmb3JtIGZsb2F0IHNwcml0ZXNQZXJDb2x1bW47XG4gIHVuaWZvcm0gYm9vbCBpc0ltYWdlO1xuXG4gICR7VEhSRUUuU2hhZGVyQ2h1bmtbJ2NvbW1vbiddfVxuICAke1RIUkVFLlNoYWRlckNodW5rWydmb2dfcGFyc19mcmFnbWVudCddfVxuICAke0ZSQUdNRU5UX1NIQURFUl9QT0lOVF9URVNUX0NIVU5LfVxuXG4gIHZvaWQgbWFpbigpIHtcbiAgICBpZiAoaXNJbWFnZSkge1xuICAgICAgLy8gQ29vcmRpbmF0ZXMgb2YgdGhlIHZlcnRleCB3aXRoaW4gdGhlIGVudGlyZSBzcHJpdGUgaW1hZ2UuXG4gICAgICB2ZWMyIGNvb3JkcyA9XG4gICAgICAgIChnbF9Qb2ludENvb3JkICsgeHlJbmRleCkgLyB2ZWMyKHNwcml0ZXNQZXJSb3csIHNwcml0ZXNQZXJDb2x1bW4pO1xuICAgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNCh2Q29sb3IsIDEuMCkgKiB0ZXh0dXJlMkQodGV4dHVyZSwgY29vcmRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYm9vbCBpbnNpZGUgPSBwb2ludF9pbl91bml0X2NpcmNsZShnbF9Qb2ludENvb3JkKTtcbiAgICAgIGlmICghaW5zaWRlKSB7XG4gICAgICAgIGRpc2NhcmQ7XG4gICAgICB9XG4gICAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KHZDb2xvciwgMSk7XG4gICAgfVxuICAgICR7VEhSRUUuU2hhZGVyQ2h1bmtbJ2ZvZ19mcmFnbWVudCddfVxuICB9YDtcbn1cblxuY29uc3QgRlJBR01FTlRfU0hBREVSX1BJQ0tJTkcgPSBgXG4gIHZhcnlpbmcgdmVjMiB4eUluZGV4O1xuICB2YXJ5aW5nIHZlYzMgdkNvbG9yO1xuICB1bmlmb3JtIGJvb2wgaXNJbWFnZTtcblxuICAke0ZSQUdNRU5UX1NIQURFUl9QT0lOVF9URVNUX0NIVU5LfVxuXG4gIHZvaWQgbWFpbigpIHtcbiAgICB4eUluZGV4OyAvLyBTaWxlbmNlICd1bnVzZWQgdmFyaWFibGUnIHdhcm5pbmcuXG4gICAgaWYgKGlzSW1hZ2UpIHtcbiAgICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQodkNvbG9yLCAxKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYm9vbCBpbnNpZGUgPSBwb2ludF9pbl91bml0X2NpcmNsZShnbF9Qb2ludENvb3JkKTtcbiAgICAgIGlmICghaW5zaWRlKSB7XG4gICAgICAgIGRpc2NhcmQ7XG4gICAgICB9XG4gICAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KHZDb2xvciwgMSk7XG4gICAgfVxuICB9YDtcblxuLyoqXG4gKiBVc2VzIEdMIHBvaW50IHNwcml0ZXMgdG8gcmVuZGVyIHRoZSBkYXRhc2V0LlxuICovXG5leHBvcnQgY2xhc3MgU2NhdHRlclBsb3RWaXN1YWxpemVyU3ByaXRlcyBpbXBsZW1lbnRzIFNjYXR0ZXJQbG90VmlzdWFsaXplciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgVkVSVEVYX1NIQURFUiA9IGNyZWF0ZVZlcnRleFNoYWRlcigpO1xuICBwcml2YXRlIHJlYWRvbmx5IEZSQUdNRU5UX1NIQURFUiA9IGNyZWF0ZUZyYWdtZW50U2hhZGVyKCk7XG4gIHByaXZhdGUgc2NlbmU6IFRIUkVFLlNjZW5lO1xuICBwcml2YXRlIGZvZzogVEhSRUUuRm9nO1xuICBwcml2YXRlIHRleHR1cmU6IFRIUkVFLlRleHR1cmUgPSBudWxsO1xuICBwcml2YXRlIHN0YW5kaW5UZXh0dXJlRm9yUG9pbnRzOiBUSFJFRS5UZXh0dXJlO1xuICBwcml2YXRlIHNwcml0ZXNQZXJSb3c6IG51bWJlcjtcbiAgcHJpdmF0ZSBzcHJpdGVzUGVyQ29sdW1uOiBudW1iZXI7XG4gIHByaXZhdGUgc3ByaXRlRGltZW5zaW9uczogW251bWJlciwgbnVtYmVyXTtcbiAgcHJpdmF0ZSBzcHJpdGVJbmRleEJ1ZmZlckF0dHJpYnV0ZTogVEhSRUUuQnVmZmVyQXR0cmlidXRlO1xuICBwcml2YXRlIHJlbmRlck1hdGVyaWFsOiBUSFJFRS5TaGFkZXJNYXRlcmlhbDtcbiAgcHJpdmF0ZSBwaWNraW5nTWF0ZXJpYWw6IFRIUkVFLlNoYWRlck1hdGVyaWFsO1xuICBwcml2YXRlIHBvaW50czogVEhSRUUuUG9pbnRzO1xuICBwcml2YXRlIHdvcmxkU3BhY2VQb2ludFBvc2l0aW9uczogRmxvYXQzMkFycmF5O1xuICBwcml2YXRlIHBpY2tpbmdDb2xvcnM6IEZsb2F0MzJBcnJheTtcbiAgcHJpdmF0ZSByZW5kZXJDb2xvcnM6IEZsb2F0MzJBcnJheTtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5zdGFuZGluVGV4dHVyZUZvclBvaW50cyA9IHV0aWwuY3JlYXRlVGV4dHVyZShcbiAgICAgIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpXG4gICAgKTtcbiAgICB0aGlzLnJlbmRlck1hdGVyaWFsID0gdGhpcy5jcmVhdGVSZW5kZXJNYXRlcmlhbChmYWxzZSk7XG4gICAgdGhpcy5waWNraW5nTWF0ZXJpYWwgPSB0aGlzLmNyZWF0ZVBpY2tpbmdNYXRlcmlhbChmYWxzZSk7XG4gIH1cbiAgcHJpdmF0ZSBjcmVhdGVUZXh0dXJlRnJvbVNwcml0ZUF0bGFzKFxuICAgIHNwcml0ZUF0bGFzOiBIVE1MSW1hZ2VFbGVtZW50LFxuICAgIHNwcml0ZURpbWVuc2lvbnM6IFtudW1iZXIsIG51bWJlcl0sXG4gICAgc3ByaXRlSW5kaWNlczogRmxvYXQzMkFycmF5XG4gICkge1xuICAgIHRoaXMudGV4dHVyZSA9IHV0aWwuY3JlYXRlVGV4dHVyZShzcHJpdGVBdGxhcyk7XG4gICAgdGhpcy5zcHJpdGVzUGVyUm93ID0gc3ByaXRlQXRsYXMud2lkdGggLyBzcHJpdGVEaW1lbnNpb25zWzBdO1xuICAgIHRoaXMuc3ByaXRlc1BlckNvbHVtbiA9IHNwcml0ZUF0bGFzLmhlaWdodCAvIHNwcml0ZURpbWVuc2lvbnNbMV07XG4gICAgdGhpcy5zcHJpdGVEaW1lbnNpb25zID0gc3ByaXRlRGltZW5zaW9ucztcbiAgICB0aGlzLnNwcml0ZUluZGV4QnVmZmVyQXR0cmlidXRlID0gbmV3IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZShcbiAgICAgIHNwcml0ZUluZGljZXMsXG4gICAgICBJTkRFWF9OVU1fRUxFTUVOVFNcbiAgICApO1xuICAgIGlmICh0aGlzLnBvaW50cyAhPSBudWxsKSB7XG4gICAgICAodGhpcy5wb2ludHMuZ2VvbWV0cnkgYXMgVEhSRUUuQnVmZmVyR2VvbWV0cnkpLmFkZEF0dHJpYnV0ZShcbiAgICAgICAgJ3Nwcml0ZUluZGV4JyxcbiAgICAgICAgdGhpcy5zcHJpdGVJbmRleEJ1ZmZlckF0dHJpYnV0ZVxuICAgICAgKTtcbiAgICB9XG4gIH1cbiAgcHJpdmF0ZSBjcmVhdGVVbmlmb3JtcygpOiBhbnkge1xuICAgIHJldHVybiB7XG4gICAgICB0ZXh0dXJlOiB7dHlwZTogJ3QnfSxcbiAgICAgIHNwcml0ZXNQZXJSb3c6IHt0eXBlOiAnZid9LFxuICAgICAgc3ByaXRlc1BlckNvbHVtbjoge3R5cGU6ICdmJ30sXG4gICAgICBmb2dDb2xvcjoge3R5cGU6ICdjJ30sXG4gICAgICBmb2dOZWFyOiB7dHlwZTogJ2YnfSxcbiAgICAgIGZvZ0Zhcjoge3R5cGU6ICdmJ30sXG4gICAgICBpc0ltYWdlOiB7dHlwZTogJ2Jvb2wnfSxcbiAgICAgIHNpemVBdHRlbnVhdGlvbjoge3R5cGU6ICdib29sJ30sXG4gICAgICBwb2ludFNpemU6IHt0eXBlOiAnZid9LFxuICAgIH07XG4gIH1cbiAgcHJpdmF0ZSBjcmVhdGVSZW5kZXJNYXRlcmlhbChoYXZlSW1hZ2U6IGJvb2xlYW4pOiBUSFJFRS5TaGFkZXJNYXRlcmlhbCB7XG4gICAgY29uc3QgdW5pZm9ybXMgPSB0aGlzLmNyZWF0ZVVuaWZvcm1zKCk7XG4gICAgcmV0dXJuIG5ldyBUSFJFRS5TaGFkZXJNYXRlcmlhbCh7XG4gICAgICB1bmlmb3JtczogdW5pZm9ybXMsXG4gICAgICB2ZXJ0ZXhTaGFkZXI6IHRoaXMuVkVSVEVYX1NIQURFUixcbiAgICAgIGZyYWdtZW50U2hhZGVyOiB0aGlzLkZSQUdNRU5UX1NIQURFUixcbiAgICAgIHRyYW5zcGFyZW50OiAhaGF2ZUltYWdlLFxuICAgICAgZGVwdGhUZXN0OiBoYXZlSW1hZ2UsXG4gICAgICBkZXB0aFdyaXRlOiBoYXZlSW1hZ2UsXG4gICAgICBmb2c6IHRydWUsXG4gICAgICBibGVuZGluZzogVEhSRUUuTXVsdGlwbHlCbGVuZGluZyxcbiAgICB9KTtcbiAgfVxuICBwcml2YXRlIGNyZWF0ZVBpY2tpbmdNYXRlcmlhbChoYXZlSW1hZ2U6IGJvb2xlYW4pOiBUSFJFRS5TaGFkZXJNYXRlcmlhbCB7XG4gICAgY29uc3QgdW5pZm9ybXMgPSB0aGlzLmNyZWF0ZVVuaWZvcm1zKCk7XG4gICAgcmV0dXJuIG5ldyBUSFJFRS5TaGFkZXJNYXRlcmlhbCh7XG4gICAgICB1bmlmb3JtczogdW5pZm9ybXMsXG4gICAgICB2ZXJ0ZXhTaGFkZXI6IHRoaXMuVkVSVEVYX1NIQURFUixcbiAgICAgIGZyYWdtZW50U2hhZGVyOiBGUkFHTUVOVF9TSEFERVJfUElDS0lORyxcbiAgICAgIHRyYW5zcGFyZW50OiB0cnVlLFxuICAgICAgZGVwdGhUZXN0OiB0cnVlLFxuICAgICAgZGVwdGhXcml0ZTogdHJ1ZSxcbiAgICAgIGZvZzogZmFsc2UsXG4gICAgICBibGVuZGluZzogVEhSRUUuTm9ybWFsQmxlbmRpbmcsXG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIENyZWF0ZSBwb2ludHMsIHNldCB0aGVpciBsb2NhdGlvbnMgYW5kIGFjdHVhbGx5IGluc3RhbnRpYXRlIHRoZVxuICAgKiBnZW9tZXRyeS5cbiAgICovXG4gIHByaXZhdGUgY3JlYXRlUG9pbnRTcHJpdGVzKHNjZW5lOiBUSFJFRS5TY2VuZSwgcG9zaXRpb25zOiBGbG9hdDMyQXJyYXkpIHtcbiAgICBjb25zdCBwb2ludENvdW50ID1cbiAgICAgIHBvc2l0aW9ucyAhPSBudWxsID8gcG9zaXRpb25zLmxlbmd0aCAvIFhZWl9OVU1fRUxFTUVOVFMgOiAwO1xuICAgIGNvbnN0IGdlb21ldHJ5ID0gdGhpcy5jcmVhdGVHZW9tZXRyeShwb2ludENvdW50KTtcbiAgICB0aGlzLmZvZyA9IG5ldyBUSFJFRS5Gb2coMTY3NzcyMTUpOyAvLyB1bnVzZWQgdmFsdWUsIGdldHMgb3ZlcndyaXR0ZW4uXG4gICAgdGhpcy5wb2ludHMgPSBuZXcgVEhSRUUuUG9pbnRzKGdlb21ldHJ5LCB0aGlzLnJlbmRlck1hdGVyaWFsKTtcbiAgICB0aGlzLnBvaW50cy5mcnVzdHVtQ3VsbGVkID0gZmFsc2U7XG4gICAgaWYgKHRoaXMuc3ByaXRlSW5kZXhCdWZmZXJBdHRyaWJ1dGUgIT0gbnVsbCkge1xuICAgICAgKHRoaXMucG9pbnRzLmdlb21ldHJ5IGFzIFRIUkVFLkJ1ZmZlckdlb21ldHJ5KS5hZGRBdHRyaWJ1dGUoXG4gICAgICAgICdzcHJpdGVJbmRleCcsXG4gICAgICAgIHRoaXMuc3ByaXRlSW5kZXhCdWZmZXJBdHRyaWJ1dGVcbiAgICAgICk7XG4gICAgfVxuICAgIHNjZW5lLmFkZCh0aGlzLnBvaW50cyk7XG4gIH1cbiAgcHJpdmF0ZSBjYWxjdWxhdGVQb2ludFNpemUoc2NlbmVJczNEOiBib29sZWFuKTogbnVtYmVyIHtcbiAgICBpZiAodGhpcy50ZXh0dXJlICE9IG51bGwpIHtcbiAgICAgIHJldHVybiBzY2VuZUlzM0QgPyBJTUFHRV9TSVpFIDogdGhpcy5zcHJpdGVEaW1lbnNpb25zWzBdO1xuICAgIH1cbiAgICBjb25zdCBuID1cbiAgICAgIHRoaXMud29ybGRTcGFjZVBvaW50UG9zaXRpb25zICE9IG51bGxcbiAgICAgICAgPyB0aGlzLndvcmxkU3BhY2VQb2ludFBvc2l0aW9ucy5sZW5ndGggLyBYWVpfTlVNX0VMRU1FTlRTXG4gICAgICAgIDogMTtcbiAgICBjb25zdCBTQ0FMRSA9IDIwMDtcbiAgICBjb25zdCBMT0dfQkFTRSA9IDg7XG4gICAgY29uc3QgRElWSVNPUiA9IDEuNTtcbiAgICAvLyBTY2FsZSBwb2ludCBzaXplIGludmVyc2UtbG9nYXJpdGhtaWNhbGx5IHRvIHRoZSBudW1iZXIgb2YgcG9pbnRzLlxuICAgIGNvbnN0IHBvaW50U2l6ZSA9IFNDQUxFIC8gTWF0aC5sb2cobikgLyBNYXRoLmxvZyhMT0dfQkFTRSk7XG4gICAgcmV0dXJuIHNjZW5lSXMzRCA/IHBvaW50U2l6ZSA6IHBvaW50U2l6ZSAvIERJVklTT1I7XG4gIH1cbiAgLyoqXG4gICAqIFNldCB1cCBidWZmZXIgYXR0cmlidXRlcyB0byBiZSB1c2VkIGZvciB0aGUgcG9pbnRzL2ltYWdlcy5cbiAgICovXG4gIHByaXZhdGUgY3JlYXRlR2VvbWV0cnkocG9pbnRDb3VudDogbnVtYmVyKTogVEhSRUUuQnVmZmVyR2VvbWV0cnkge1xuICAgIGNvbnN0IG4gPSBwb2ludENvdW50O1xuICAgIC8vIEZpbGwgcGlja2luZ0NvbG9ycyB3aXRoIGVhY2ggcG9pbnQncyB1bmlxdWUgaWQgYXMgaXRzIGNvbG9yLlxuICAgIHRoaXMucGlja2luZ0NvbG9ycyA9IG5ldyBGbG9hdDMyQXJyYXkobiAqIFJHQl9OVU1fRUxFTUVOVFMpO1xuICAgIHtcbiAgICAgIGxldCBkc3QgPSAwO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgY29uc3QgYyA9IG5ldyBUSFJFRS5Db2xvcihpKTtcbiAgICAgICAgdGhpcy5waWNraW5nQ29sb3JzW2RzdCsrXSA9IGMucjtcbiAgICAgICAgdGhpcy5waWNraW5nQ29sb3JzW2RzdCsrXSA9IGMuZztcbiAgICAgICAgdGhpcy5waWNraW5nQ29sb3JzW2RzdCsrXSA9IGMuYjtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgZ2VvbWV0cnkgPSBuZXcgVEhSRUUuQnVmZmVyR2VvbWV0cnkoKTtcbiAgICBnZW9tZXRyeS5hZGRBdHRyaWJ1dGUoXG4gICAgICAncG9zaXRpb24nLFxuICAgICAgbmV3IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZSh1bmRlZmluZWQsIFhZWl9OVU1fRUxFTUVOVFMpXG4gICAgKTtcbiAgICBnZW9tZXRyeS5hZGRBdHRyaWJ1dGUoXG4gICAgICAnY29sb3InLFxuICAgICAgbmV3IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZSh1bmRlZmluZWQsIFJHQl9OVU1fRUxFTUVOVFMpXG4gICAgKTtcbiAgICBnZW9tZXRyeS5hZGRBdHRyaWJ1dGUoXG4gICAgICAnc2NhbGVGYWN0b3InLFxuICAgICAgbmV3IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZSh1bmRlZmluZWQsIElOREVYX05VTV9FTEVNRU5UUylcbiAgICApO1xuICAgIHJldHVybiBnZW9tZXRyeTtcbiAgfVxuICBwcml2YXRlIHNldEZvZ0Rpc3RhbmNlcyhcbiAgICBzY2VuZUlzM0Q6IGJvb2xlYW4sXG4gICAgbmVhcmVzdFBvaW50WjogbnVtYmVyLFxuICAgIGZhcnRoZXN0UG9pbnRaOiBudW1iZXJcbiAgKSB7XG4gICAgaWYgKHNjZW5lSXMzRCkge1xuICAgICAgY29uc3QgbiA9IHRoaXMud29ybGRTcGFjZVBvaW50UG9zaXRpb25zLmxlbmd0aCAvIFhZWl9OVU1fRUxFTUVOVFM7XG4gICAgICB0aGlzLmZvZy5uZWFyID0gbmVhcmVzdFBvaW50WjtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBmZXdlciBwb2ludHMgd2Ugd2FudCBsZXNzIGZvZy4gV2UgZG8gdGhpc1xuICAgICAgLy8gYnkgbWFraW5nIHRoZSBcImZhclwiIHZhbHVlICh0aGF0IGlzLCB0aGUgZGlzdGFuY2UgZnJvbSB0aGUgY2FtZXJhIHRvIHRoZVxuICAgICAgLy8gZmFyIGVkZ2Ugb2YgdGhlIGZvZykgcHJvcG9ydGlvbmFsIHRvIHRoZSBudW1iZXIgb2YgcG9pbnRzLlxuICAgICAgbGV0IG11bHRpcGxpZXIgPVxuICAgICAgICAyIC0gTWF0aC5taW4obiwgTlVNX1BPSU5UU19GT0dfVEhSRVNIT0xEKSAvIE5VTV9QT0lOVFNfRk9HX1RIUkVTSE9MRDtcbiAgICAgIHRoaXMuZm9nLmZhciA9IGZhcnRoZXN0UG9pbnRaICogbXVsdGlwbGllcjtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5mb2cubmVhciA9IEluZmluaXR5O1xuICAgICAgdGhpcy5mb2cuZmFyID0gSW5maW5pdHk7XG4gICAgfVxuICB9XG4gIGRpc3Bvc2UoKSB7XG4gICAgdGhpcy5kaXNwb3NlR2VvbWV0cnkoKTtcbiAgICB0aGlzLmRpc3Bvc2VUZXh0dXJlQXRsYXMoKTtcbiAgfVxuICBwcml2YXRlIGRpc3Bvc2VHZW9tZXRyeSgpIHtcbiAgICBpZiAodGhpcy5wb2ludHMgIT0gbnVsbCkge1xuICAgICAgdGhpcy5zY2VuZS5yZW1vdmUodGhpcy5wb2ludHMpO1xuICAgICAgdGhpcy5wb2ludHMuZ2VvbWV0cnkuZGlzcG9zZSgpO1xuICAgICAgdGhpcy5wb2ludHMgPSBudWxsO1xuICAgICAgdGhpcy53b3JsZFNwYWNlUG9pbnRQb3NpdGlvbnMgPSBudWxsO1xuICAgIH1cbiAgfVxuICBwcml2YXRlIGRpc3Bvc2VUZXh0dXJlQXRsYXMoKSB7XG4gICAgaWYgKHRoaXMudGV4dHVyZSAhPSBudWxsKSB7XG4gICAgICB0aGlzLnRleHR1cmUuZGlzcG9zZSgpO1xuICAgIH1cbiAgICB0aGlzLnRleHR1cmUgPSBudWxsO1xuICAgIHRoaXMucmVuZGVyTWF0ZXJpYWwgPSBudWxsO1xuICAgIHRoaXMucGlja2luZ01hdGVyaWFsID0gbnVsbDtcbiAgfVxuICBzZXRTY2VuZShzY2VuZTogVEhSRUUuU2NlbmUpIHtcbiAgICB0aGlzLnNjZW5lID0gc2NlbmU7XG4gIH1cbiAgc2V0U3ByaXRlQXRsYXMoXG4gICAgc3ByaXRlSW1hZ2U6IEhUTUxJbWFnZUVsZW1lbnQsXG4gICAgc3ByaXRlRGltZW5zaW9uczogW251bWJlciwgbnVtYmVyXSxcbiAgICBzcHJpdGVJbmRpY2VzOiBGbG9hdDMyQXJyYXlcbiAgKSB7XG4gICAgdGhpcy5kaXNwb3NlVGV4dHVyZUF0bGFzKCk7XG4gICAgdGhpcy5jcmVhdGVUZXh0dXJlRnJvbVNwcml0ZUF0bGFzKFxuICAgICAgc3ByaXRlSW1hZ2UsXG4gICAgICBzcHJpdGVEaW1lbnNpb25zLFxuICAgICAgc3ByaXRlSW5kaWNlc1xuICAgICk7XG4gICAgdGhpcy5yZW5kZXJNYXRlcmlhbCA9IHRoaXMuY3JlYXRlUmVuZGVyTWF0ZXJpYWwodHJ1ZSk7XG4gICAgdGhpcy5waWNraW5nTWF0ZXJpYWwgPSB0aGlzLmNyZWF0ZVBpY2tpbmdNYXRlcmlhbCh0cnVlKTtcbiAgfVxuICBjbGVhclNwcml0ZUF0bGFzKCkge1xuICAgIHRoaXMuZGlzcG9zZVRleHR1cmVBdGxhcygpO1xuICAgIHRoaXMucmVuZGVyTWF0ZXJpYWwgPSB0aGlzLmNyZWF0ZVJlbmRlck1hdGVyaWFsKGZhbHNlKTtcbiAgICB0aGlzLnBpY2tpbmdNYXRlcmlhbCA9IHRoaXMuY3JlYXRlUGlja2luZ01hdGVyaWFsKGZhbHNlKTtcbiAgfVxuICBvblBvaW50UG9zaXRpb25zQ2hhbmdlZChuZXdQb3NpdGlvbnM6IEZsb2F0MzJBcnJheSkge1xuICAgIGlmIChuZXdQb3NpdGlvbnMgPT0gbnVsbCB8fCBuZXdQb3NpdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLmRpc3Bvc2UoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHRoaXMucG9pbnRzICE9IG51bGwpIHtcbiAgICAgIGlmICh0aGlzLndvcmxkU3BhY2VQb2ludFBvc2l0aW9ucy5sZW5ndGggIT09IG5ld1Bvc2l0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5kaXNwb3NlR2VvbWV0cnkoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy53b3JsZFNwYWNlUG9pbnRQb3NpdGlvbnMgPSBuZXdQb3NpdGlvbnM7XG4gICAgaWYgKHRoaXMucG9pbnRzID09IG51bGwpIHtcbiAgICAgIHRoaXMuY3JlYXRlUG9pbnRTcHJpdGVzKHRoaXMuc2NlbmUsIG5ld1Bvc2l0aW9ucyk7XG4gICAgfVxuICAgIGNvbnN0IHBvc2l0aW9ucyA9ICh0aGlzLnBvaW50c1xuICAgICAgLmdlb21ldHJ5IGFzIFRIUkVFLkJ1ZmZlckdlb21ldHJ5KS5nZXRBdHRyaWJ1dGUoXG4gICAgICAncG9zaXRpb24nXG4gICAgKSBhcyBUSFJFRS5CdWZmZXJBdHRyaWJ1dGU7XG4gICAgKHBvc2l0aW9ucyBhcyBhbnkpLnNldEFycmF5KG5ld1Bvc2l0aW9ucyk7XG4gICAgcG9zaXRpb25zLm5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgfVxuICBvblBpY2tpbmdSZW5kZXIocmM6IFJlbmRlckNvbnRleHQpIHtcbiAgICBpZiAodGhpcy5wb2ludHMgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBzY2VuZUlzM0Q6IGJvb2xlYW4gPSByYy5jYW1lcmFUeXBlID09PSBDYW1lcmFUeXBlLlBlcnNwZWN0aXZlO1xuICAgIHRoaXMucGlja2luZ01hdGVyaWFsLnVuaWZvcm1zLnNwcml0ZXNQZXJSb3cudmFsdWUgPSB0aGlzLnNwcml0ZXNQZXJSb3c7XG4gICAgdGhpcy5waWNraW5nTWF0ZXJpYWwudW5pZm9ybXMuc3ByaXRlc1BlclJvdy52YWx1ZSA9IHRoaXMuc3ByaXRlc1BlckNvbHVtbjtcbiAgICB0aGlzLnBpY2tpbmdNYXRlcmlhbC51bmlmb3Jtcy5zaXplQXR0ZW51YXRpb24udmFsdWUgPSBzY2VuZUlzM0Q7XG4gICAgdGhpcy5waWNraW5nTWF0ZXJpYWwudW5pZm9ybXMucG9pbnRTaXplLnZhbHVlID0gdGhpcy5jYWxjdWxhdGVQb2ludFNpemUoXG4gICAgICBzY2VuZUlzM0RcbiAgICApO1xuICAgIHRoaXMucG9pbnRzLm1hdGVyaWFsID0gdGhpcy5waWNraW5nTWF0ZXJpYWw7XG4gICAgbGV0IGNvbG9ycyA9ICh0aGlzLnBvaW50cy5nZW9tZXRyeSBhcyBUSFJFRS5CdWZmZXJHZW9tZXRyeSkuZ2V0QXR0cmlidXRlKFxuICAgICAgJ2NvbG9yJ1xuICAgICkgYXMgVEhSRUUuQnVmZmVyQXR0cmlidXRlO1xuICAgIChjb2xvcnMgYXMgYW55KS5zZXRBcnJheSh0aGlzLnBpY2tpbmdDb2xvcnMpO1xuICAgIGNvbG9ycy5uZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgbGV0IHNjYWxlRmFjdG9ycyA9ICh0aGlzLnBvaW50c1xuICAgICAgLmdlb21ldHJ5IGFzIFRIUkVFLkJ1ZmZlckdlb21ldHJ5KS5nZXRBdHRyaWJ1dGUoXG4gICAgICAnc2NhbGVGYWN0b3InXG4gICAgKSBhcyBUSFJFRS5CdWZmZXJBdHRyaWJ1dGU7XG4gICAgKHNjYWxlRmFjdG9ycyBhcyBhbnkpLnNldEFycmF5KHJjLnBvaW50U2NhbGVGYWN0b3JzKTtcbiAgICBzY2FsZUZhY3RvcnMubmVlZHNVcGRhdGUgPSB0cnVlO1xuICB9XG4gIG9uUmVuZGVyKHJjOiBSZW5kZXJDb250ZXh0KSB7XG4gICAgaWYgKCF0aGlzLnBvaW50cykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBzY2VuZUlzM0Q6IGJvb2xlYW4gPSByYy5jYW1lcmEgaW5zdGFuY2VvZiBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYTtcbiAgICB0aGlzLnNldEZvZ0Rpc3RhbmNlcyhcbiAgICAgIHNjZW5lSXMzRCxcbiAgICAgIHJjLm5lYXJlc3RDYW1lcmFTcGFjZVBvaW50WixcbiAgICAgIHJjLmZhcnRoZXN0Q2FtZXJhU3BhY2VQb2ludFpcbiAgICApO1xuICAgIHRoaXMuc2NlbmUuZm9nID0gdGhpcy5mb2c7XG4gICAgdGhpcy5zY2VuZS5mb2cuY29sb3IgPSBuZXcgVEhSRUUuQ29sb3IocmMuYmFja2dyb3VuZENvbG9yKTtcbiAgICB0aGlzLnJlbmRlck1hdGVyaWFsLnVuaWZvcm1zLmZvZ0NvbG9yLnZhbHVlID0gdGhpcy5zY2VuZS5mb2cuY29sb3I7XG4gICAgdGhpcy5yZW5kZXJNYXRlcmlhbC51bmlmb3Jtcy5mb2dOZWFyLnZhbHVlID0gdGhpcy5mb2cubmVhcjtcbiAgICB0aGlzLnJlbmRlck1hdGVyaWFsLnVuaWZvcm1zLmZvZ0Zhci52YWx1ZSA9IHRoaXMuZm9nLmZhcjtcbiAgICB0aGlzLnJlbmRlck1hdGVyaWFsLnVuaWZvcm1zLnNwcml0ZXNQZXJSb3cudmFsdWUgPSB0aGlzLnNwcml0ZXNQZXJSb3c7XG4gICAgdGhpcy5yZW5kZXJNYXRlcmlhbC51bmlmb3Jtcy5zcHJpdGVzUGVyQ29sdW1uLnZhbHVlID0gdGhpcy5zcHJpdGVzUGVyQ29sdW1uO1xuICAgIHRoaXMucmVuZGVyTWF0ZXJpYWwudW5pZm9ybXMuaXNJbWFnZS52YWx1ZSA9IHRoaXMudGV4dHVyZSAhPSBudWxsO1xuICAgIHRoaXMucmVuZGVyTWF0ZXJpYWwudW5pZm9ybXMudGV4dHVyZS52YWx1ZSA9XG4gICAgICB0aGlzLnRleHR1cmUgIT0gbnVsbCA/IHRoaXMudGV4dHVyZSA6IHRoaXMuc3RhbmRpblRleHR1cmVGb3JQb2ludHM7XG4gICAgdGhpcy5yZW5kZXJNYXRlcmlhbC51bmlmb3Jtcy5zaXplQXR0ZW51YXRpb24udmFsdWUgPSBzY2VuZUlzM0Q7XG4gICAgdGhpcy5yZW5kZXJNYXRlcmlhbC51bmlmb3Jtcy5wb2ludFNpemUudmFsdWUgPSB0aGlzLmNhbGN1bGF0ZVBvaW50U2l6ZShcbiAgICAgIHNjZW5lSXMzRFxuICAgICk7XG4gICAgdGhpcy5wb2ludHMubWF0ZXJpYWwgPSB0aGlzLnJlbmRlck1hdGVyaWFsO1xuICAgIGxldCBjb2xvcnMgPSAodGhpcy5wb2ludHMuZ2VvbWV0cnkgYXMgVEhSRUUuQnVmZmVyR2VvbWV0cnkpLmdldEF0dHJpYnV0ZShcbiAgICAgICdjb2xvcidcbiAgICApIGFzIFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZTtcbiAgICB0aGlzLnJlbmRlckNvbG9ycyA9IHJjLnBvaW50Q29sb3JzO1xuICAgIChjb2xvcnMgYXMgYW55KS5zZXRBcnJheSh0aGlzLnJlbmRlckNvbG9ycyk7XG4gICAgY29sb3JzLm5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgICBsZXQgc2NhbGVGYWN0b3JzID0gKHRoaXMucG9pbnRzXG4gICAgICAuZ2VvbWV0cnkgYXMgVEhSRUUuQnVmZmVyR2VvbWV0cnkpLmdldEF0dHJpYnV0ZShcbiAgICAgICdzY2FsZUZhY3RvcidcbiAgICApIGFzIFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZTtcbiAgICAoc2NhbGVGYWN0b3JzIGFzIGFueSkuc2V0QXJyYXkocmMucG9pbnRTY2FsZUZhY3RvcnMpO1xuICAgIHNjYWxlRmFjdG9ycy5uZWVkc1VwZGF0ZSA9IHRydWU7XG4gIH1cbiAgb25SZXNpemUobmV3V2lkdGg6IG51bWJlciwgbmV3SGVpZ2h0OiBudW1iZXIpIHt9XG59XG4iXX0=