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
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as util from './util';
import { CameraType, RenderContext } from './renderContext';
import { ScatterPlotRectangleSelector, } from './scatterPlotRectangleSelector';
const BACKGROUND_COLOR = 0xffffff;
/**
 * The length of the cube (diameter of the circumscribing sphere) where all the
 * points live.
 */
const CUBE_LENGTH = 2;
const MAX_ZOOM = 5 * CUBE_LENGTH;
const MIN_ZOOM = 0.025 * CUBE_LENGTH;
// Constants relating to the camera parameters.
const PERSP_CAMERA_FOV_VERTICAL = 70;
const PERSP_CAMERA_NEAR_CLIP_PLANE = 0.01;
const PERSP_CAMERA_FAR_CLIP_PLANE = 100;
const ORTHO_CAMERA_FRUSTUM_HALF_EXTENT = 1.2;
// Key presses.
const SHIFT_KEY = 16;
const CTRL_KEY = 17;
const ORBIT_MOUSE_ROTATION_SPEED = 1;
const ORBIT_ANIMATION_ROTATION_CYCLE_IN_SECONDS = 7;
/** Supported modes of interaction. */
export var MouseMode;
(function (MouseMode) {
    MouseMode[MouseMode["AREA_SELECT"] = 0] = "AREA_SELECT";
    MouseMode[MouseMode["CAMERA_AND_CLICK_SELECT"] = 1] = "CAMERA_AND_CLICK_SELECT";
})(MouseMode || (MouseMode = {}));
/** Defines a camera, suitable for serialization. */
export class CameraDef {
    constructor() {
        this.orthographic = false;
    }
}
/**
 * Maintains a three.js instantiation and context,
 * animation state, and all other logic that's
 * independent of how a 3D scatter plot is actually rendered. Also holds an
 * array of visualizers and dispatches application events to them.
 */
export class ScatterPlot {
    constructor(container, projectorEventContext) {
        this.container = container;
        this.projectorEventContext = projectorEventContext;
        this.START_CAMERA_POS_3D = new THREE.Vector3(0.45, 0.9, 1.6);
        this.START_CAMERA_TARGET_3D = new THREE.Vector3(0, 0, 0);
        this.START_CAMERA_POS_2D = new THREE.Vector3(0, 0, 4);
        this.START_CAMERA_TARGET_2D = new THREE.Vector3(0, 0, 0);
        this.visualizers = [];
        this.onCameraMoveListeners = [];
        this.backgroundColor = BACKGROUND_COLOR;
        this.dimensionality = 3;
        this.cameraDef = null;
        this.orbitAnimationOnNextCameraCreation = false;
        this.selecting = false;
        this.mouseIsDown = false;
        this.isDragSequence = false;
        this.realDataNumber = 0;
        // 1,创建场景对象
        this.scene = new THREE.Scene();
        if (!window.sceneBackgroundImg) {
            window.sceneBackgroundImg = [];
        }
        if (window.sceneBackgroundImg[window.iteration]) {
            this.addbackgroundImg(window.sceneBackgroundImg[window.iteration]);
        }
        this.getLayoutValues();
        // this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            premultipliedAlpha: false,
            antialias: false,
        });
        this.renderer.setClearColor(BACKGROUND_COLOR, 1);
        this.container.appendChild(this.renderer.domElement);
        this.light = new THREE.PointLight(0xffffff);
        this.scene.add(this.light);
        this.setDimensions(3);
        this.recreateCamera(this.makeDefaultCameraDef(this.dimensionality));
        this.renderer.render(this.scene, this.camera);
        this.rectangleSelector = new ScatterPlotRectangleSelector(this.container, (boundingBox) => this.selectBoundingBox(boundingBox));
        this.addInteractionListeners();
        window.scene = this.scene;
        window.renderer = this.renderer;
    }
    addbackgroundImg(imgUrl) {
        //移除上一个画布
        // if (window.backgroundMesh) {
        //   this.scene.remove(window.backgroundMesh)
        // }
        let temp = window.backgroundMesh;
        if (!imgUrl) {
            return;
        }
        // 2，使用canvas画图作为纹理贴图
        // 先使用canvas画图
        let canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        var ctx = canvas.getContext("2d");
        var img = new Image();
        img.src = imgUrl;
        img.crossOrigin = "anonymous";
        img.onload = () => {
            ctx.drawImage(img, 0, 0, 128, 128);
            let texture = new THREE.CanvasTexture(canvas);
            // texture.needsUpdate = true; // 不设置needsUpdate为true的话，可能纹理贴图不刷新
            var plane_geometry = new THREE.PlaneGeometry(2, 2);
            var material = new THREE.MeshPhongMaterial({
                // color:0x11ff22,
                map: texture,
                side: THREE.DoubleSide
            });
            const newMesh = new THREE.Mesh(plane_geometry, material);
            this.scene.add(newMesh);
            if (temp) {
                this.scene.remove(temp);
            }
            window.backgroundMesh = newMesh;
            window.scene = this.scene;
            this.render();
        };
    }
    addInteractionListeners() {
        this.container.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.container.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.container.addEventListener('mouseup', this.onMouseUp.bind(this));
        // this.container.addEventListener('mouseup', this.onMousewheel.bind(this));
        // this.container.addEventListener('dblclick', this.onClick.bind(this));
        window.addEventListener('keydown', this.onKeyDown.bind(this), false);
        window.addEventListener('keyup', this.onKeyUp.bind(this), false);
    }
    addCameraControlsEventListeners(cameraControls) {
        // Start is called when the user stars interacting with
        // controls.
        cameraControls.addEventListener('start', () => {
            this.stopOrbitAnimation();
            this.onCameraMoveListeners.forEach((l) => l(this.camera.position, cameraControls.target));
        });
        // Change is called everytime the user interacts with the controls.
        cameraControls.addEventListener('change', () => {
            this.render();
        });
        // End is called when the user stops interacting with the
        // controls (e.g. on mouse up, after dragging).
        cameraControls.addEventListener('end', () => { });
    }
    makeOrbitControls(camera, cameraDef, cameraIs3D) {
        if (this.orbitCameraControls != null) {
            this.orbitCameraControls.dispose();
        }
        const occ = new OrbitControls(camera, this.renderer.domElement);
        occ.target0 = new THREE.Vector3(cameraDef.target[0], cameraDef.target[1], cameraDef.target[2]);
        occ.position0 = new THREE.Vector3().copy(camera.position);
        occ.zoom0 = cameraDef.zoom;
        occ.enableRotate = cameraIs3D;
        occ.autoRotate = false;
        occ.rotateSpeed = ORBIT_MOUSE_ROTATION_SPEED;
        if (cameraIs3D) {
            occ.mouseButtons.ORBIT = THREE.MOUSE.LEFT;
            occ.mouseButtons.PAN = THREE.MOUSE.RIGHT;
        }
        else {
            occ.mouseButtons.ORBIT = null;
            occ.mouseButtons.PAN = THREE.MOUSE.LEFT;
        }
        occ.mouseButtons.LEFT = THREE.MOUSE.PAN;
        occ.mouseButtons.RIGHT = null;
        occ.reset();
        this.camera = camera;
        this.orbitCameraControls = occ;
        this.addCameraControlsEventListeners(this.orbitCameraControls);
    }
    makeCamera3D(cameraDef, w, h) {
        let camera;
        {
            const aspectRatio = w / h;
            camera = new THREE.PerspectiveCamera(PERSP_CAMERA_FOV_VERTICAL, aspectRatio, PERSP_CAMERA_NEAR_CLIP_PLANE, PERSP_CAMERA_FAR_CLIP_PLANE);
            camera.position.set(cameraDef.position[0], cameraDef.position[1], cameraDef.position[2]);
            const at = new THREE.Vector3(cameraDef.target[0], cameraDef.target[1], cameraDef.target[2]);
            camera.lookAt(at);
            camera.zoom = cameraDef.zoom;
            camera.updateProjectionMatrix();
        }
        this.camera = camera;
        this.makeOrbitControls(camera, cameraDef, true);
    }
    makeCamera2D(cameraDef, w, h) {
        let camera;
        const target = new THREE.Vector3(cameraDef.target[0], cameraDef.target[1], cameraDef.target[2]);
        {
            const aspectRatio = w / h;
            let left = -ORTHO_CAMERA_FRUSTUM_HALF_EXTENT;
            let right = ORTHO_CAMERA_FRUSTUM_HALF_EXTENT;
            let bottom = -ORTHO_CAMERA_FRUSTUM_HALF_EXTENT;
            let top = ORTHO_CAMERA_FRUSTUM_HALF_EXTENT;
            // Scale up the larger of (w, h) to match the aspect ratio.
            if (aspectRatio > 1) {
                left *= aspectRatio;
                right *= aspectRatio;
            }
            else {
                top /= aspectRatio;
                bottom /= aspectRatio;
            }
            camera = new THREE.OrthographicCamera(left, right, top, bottom, -1000, 1000);
            camera.position.set(cameraDef.position[0], cameraDef.position[1], cameraDef.position[2]);
            camera.up = new THREE.Vector3(0, 1, 0);
            camera.lookAt(target);
            camera.zoom = cameraDef.zoom;
            camera.updateProjectionMatrix();
        }
        this.camera = camera;
        this.makeOrbitControls(camera, cameraDef, false);
    }
    makeDefaultCameraDef(dimensionality) {
        const def = new CameraDef();
        def.orthographic = dimensionality === 2;
        def.zoom = 1;
        if (def.orthographic) {
            def.position = [
                this.START_CAMERA_POS_2D.x,
                this.START_CAMERA_POS_2D.y,
                this.START_CAMERA_POS_2D.z,
            ];
            def.target = [
                this.START_CAMERA_TARGET_2D.x,
                this.START_CAMERA_TARGET_2D.y,
                this.START_CAMERA_TARGET_2D.z,
            ];
        }
        else {
            def.position = [
                this.START_CAMERA_POS_3D.x,
                this.START_CAMERA_POS_3D.y,
                this.START_CAMERA_POS_3D.z,
            ];
            def.target = [
                this.START_CAMERA_TARGET_3D.x,
                this.START_CAMERA_TARGET_3D.y,
                this.START_CAMERA_TARGET_3D.z,
            ];
        }
        return def;
    }
    /** Recreate the scatter plot camera from a definition structure. */
    recreateCamera(cameraDef) {
        if (cameraDef.orthographic) {
            this.makeCamera2D(cameraDef, this.width, this.height);
        }
        else {
            this.makeCamera3D(cameraDef, this.width, this.height);
        }
        this.orbitCameraControls.minDistance = MIN_ZOOM;
        this.orbitCameraControls.maxDistance = MAX_ZOOM;
        this.orbitCameraControls.screenSpacePanning = true;
        // console.log('orbitCameraControls',this.orbitCameraControls)
        this.orbitCameraControls;
        this.orbitCameraControls.update();
        if (this.orbitAnimationOnNextCameraCreation) {
            this.startOrbitAnimation();
        }
    }
    onClick(e, notify = true) {
        if (e && this.selecting) {
            return;
        }
        // Only call event handlers if the click originated from the scatter plot.
        if (!this.isDragSequence && notify) {
            let selection = this.nearestPoint != null ? [this.nearestPoint] : [];
            if (this.nearestPoint >= this.realDataNumber) {
                selection = [];
            }
            window.selectedStack = selection;
            this.projectorEventContext.notifySelectionChanged(selection);
        }
        this.isDragSequence = false;
        this.render();
    }
    onMouseDown(e) {
        this.isDragSequence = false;
        this.mouseIsDown = true;
        // if (this.isctrling === true) {
        //   this.container.style.cursor = 'move';
        //   return
        // }
        if (this.selecting && this.isShifting) {
            this.orbitCameraControls.enabled = false;
            this.rectangleSelector.onMouseDown(e.offsetX, e.offsetY);
            this.setNearestPointToMouse(e);
        }
        else if (!e.ctrlKey &&
            this.sceneIs3D() &&
            this.orbitCameraControls.mouseButtons.ORBIT === THREE.MOUSE.RIGHT) {
            // The user happened to press the ctrl key when the tab was active,
            // unpressed the ctrl when the tab was inactive, and now he/she
            // is back to the projector tab.
            this.orbitCameraControls.mouseButtons.ORBIT = THREE.MOUSE.LEFT;
            this.orbitCameraControls.mouseButtons.PAN = THREE.MOUSE.RIGHT;
        }
        else if (e.ctrlKey &&
            this.sceneIs3D() &&
            this.orbitCameraControls.mouseButtons.ORBIT === THREE.MOUSE.LEFT) {
            // Similarly to the situation above.
            this.orbitCameraControls.mouseButtons.ORBIT = THREE.MOUSE.RIGHT;
            this.orbitCameraControls.mouseButtons.PAN = THREE.MOUSE.LEFT;
        }
        else {
            this.container.style.cursor = 'move';
            // this.onKeyDown({keyCode:CTRL_KEY})
        }
    }
    resetCamera() {
        const def = this.cameraDef || this.makeDefaultCameraDef(3);
        this.recreateCamera(def);
    }
    reset2dCamera() {
        this.resetZoom();
    }
    /** When we stop dragging/zooming, return to normal behavior. */
    onMouseUp(e) {
        // if (this.isctrling === true) {
        if (this.selecting) {
            this.container.style.cursor = 'crosshair';
        }
        else {
            this.container.style.cursor = 'default';
        }
        this.mouseIsDown = false;
        // return
        // }
        if (this.selecting && this.isShifting) {
            this.orbitCameraControls.enabled = true;
            this.rectangleSelector.onMouseUp();
            this.render();
        }
        this.mouseIsDown = false;
    }
    /**
     * When the mouse moves, find the nearest point (if any) and send it to the
     * hoverlisteners (usually called from embedding.ts)
     */
    onMouseMove(e) {
        this.isDragSequence = this.mouseIsDown;
        // Depending if we're selecting or just navigating, handle accordingly.
        if (this.selecting && this.mouseIsDown) {
            this.rectangleSelector.onMouseMove(e.offsetX, e.offsetY);
            this.render();
        }
        else if (!this.mouseIsDown) {
            this.setNearestPointToMouse(e);
            this.projectorEventContext.notifyHoverOverPoint(this.nearestPoint);
        }
    }
    debounce(func, wait) {
        let timeout;
        return function () {
            // 清空定时器
            if (timeout)
                clearTimeout(timeout);
            timeout = setTimeout(func, wait);
        };
    }
    /** For using ctrl + left click as right click, and for circle select */
    onKeyDown(e) {
        // If ctrl is pressed, use left click to orbit
        if (e.keyCode === CTRL_KEY && this.sceneIs3D) {
            this.isctrling = true;
            // this.container.style.cursor = 'move';
            this.orbitCameraControls.mouseButtons.ORBIT = THREE.MOUSE.RIGHT;
            this.orbitCameraControls.mouseButtons.PAN = THREE.MOUSE.LEFT;
        }
        var keyCode = e.keyCode || e.which || e.charCode;
        let ctrlKey = e.ctrlKey || e.metaKey;
        if (ctrlKey && keyCode == 90) {
            if (!this.selecting) {
                this.container.style.cursor = 'default';
            }
            else {
                this.container.style.cursor = 'crosshair';
            }
            if (window.selectedStack && window.selectedStack.length) {
                if (window.customSelection) {
                    this.projectorEventContext.notifySelectionChanged(window.selectedStack, true, 'boundingbox');
                    this.isctrling = false;
                    window.selectedStack = [];
                }
            }
            else {
                alert('You can only go back one step');
                this.isctrling = false;
            }
        }
        // If shift is pressed, start selecting
        if (e.keyCode === SHIFT_KEY && this.selecting) {
            this.isShifting = true;
            // this.selecting = true;
            this.container.style.cursor = 'crosshair';
        }
    }
    /** For using ctrl + left click as right click, and for circle select */
    onKeyUp(e) {
        this.isctrling = false;
        if (!(this.isShifting === true && this.mouseIsDown === true)) {
            this.isShifting = false;
        }
        else {
            setTimeout(() => {
                this.isShifting = false;
            }, 600);
        }
        if (this.selecting) {
            this.container.style.cursor = 'crosshair';
        }
        else {
            this.container.style.cursor = 'default';
        }
        if (e.keyCode === CTRL_KEY && this.sceneIs3D()) {
            this.orbitCameraControls.mouseButtons.ORBIT = THREE.MOUSE.LEFT;
            this.orbitCameraControls.mouseButtons.PAN = THREE.MOUSE.RIGHT;
        }
        // If shift is released, stop selecting
        if (e.keyCode === SHIFT_KEY) {
            this.selecting = this.getMouseMode() === MouseMode.AREA_SELECT;
            if (!this.selecting) {
                this.container.style.cursor = 'default';
            }
            this.render();
        }
    }
    /**
     * Returns a list of indices of points in a bounding box from the picking
     * texture.
     * @param boundingBox The bounding box to select from.
     */
    getPointIndicesFromPickingTexture(boundingBox) {
        var _a;
        if (this.worldSpacePointPositions == null || this.worldSpacePointPositions == undefined) {
            return null;
        }
        const pointCount = ((_a = this.worldSpacePointPositions) === null || _a === void 0 ? void 0 : _a.length) / 3;
        const dpr = window.devicePixelRatio || 1;
        const x = Math.floor(boundingBox.x * dpr);
        const y = Math.floor(boundingBox.y * dpr);
        const width = Math.floor(boundingBox.width * dpr);
        const height = Math.floor(boundingBox.height * dpr);
        // Create buffer for reading all of the pixels from the texture.
        let pixelBuffer = new Uint8Array(width * height * 4);
        // Read the pixels from the bounding box.
        this.renderer.readRenderTargetPixels(this.pickingTexture, x, this.pickingTexture.height - y, width, height, pixelBuffer);
        // Keep a flat list of each point and whether they are selected or not. This
        // approach is more efficient than using an object keyed by the index.
        let pointIndicesSelection = new Uint8Array(this.worldSpacePointPositions.length);
        for (let i = 0; i < width * height; i++) {
            const id = (pixelBuffer[i * 4] << 16) |
                (pixelBuffer[i * 4 + 1] << 8) |
                pixelBuffer[i * 4 + 2];
            if (id !== 16777215 && id < pointCount) {
                pointIndicesSelection[id] = 1;
            }
        }
        let pointIndices = [];
        for (let i = 0; i < pointIndicesSelection.length; i++) {
            if (pointIndicesSelection[i] === 1) {
                pointIndices.push(i);
            }
        }
        return pointIndices;
    }
    selectBoundingBox(boundingBox) {
        let pointIndices = this.getPointIndicesFromPickingTexture(boundingBox);
        // remove backgound
        let validIndices = [];
        let length = pointIndices.length;
        if (pointIndices.length >= 100) {
            length = 100;
            alert('You can select up to 100 points at a time, and the first 100 points are selected by default');
            this.isShifting = false;
            return;
        }
        // for (let i = 0; i < length; i++) {
        //   if (pointIndices[i] < this.realDataNumber) {
        //     validIndices.push(pointIndices[i]);
        //   }
        // }
        // console.log('validIndices',validIndices,pointIndices)
        window.selectedStack = pointIndices;
        this.projectorEventContext.notifySelectionChanged(pointIndices, true, 'boundingbox');
    }
    setNearestPointToMouse(e) {
        if (this.pickingTexture == null) {
            this.nearestPoint = null;
            return;
        }
        const boundingBox = {
            x: e.offsetX,
            y: e.offsetY,
            width: 4,
            height: 4,
        };
        const pointIndices = this.getPointIndicesFromPickingTexture(boundingBox);
        const realPointIndices = pointIndices === null || pointIndices === void 0 ? void 0 : pointIndices.filter(point => point < this.realDataNumber);
        if (!realPointIndices || (realPointIndices === null || realPointIndices === void 0 ? void 0 : realPointIndices.length) == 0) {
            this.nearestPoint = pointIndices != null ? pointIndices[0] : null;
        }
        else {
            this.nearestPoint = realPointIndices[0];
        }
    }
    getLayoutValues() {
        this.width = this.container.offsetWidth;
        this.height = Math.max(1, this.container.offsetHeight);
        return [this.width, this.height];
    }
    sceneIs3D() {
        return this.dimensionality === 3;
    }
    remove3dAxisFromScene() {
        const axes = this.scene.getObjectByName('axes');
        if (axes != null) {
            this.scene.remove(axes);
        }
        return axes;
    }
    add3dAxis() {
        const axes = new THREE.AxesHelper();
        axes.name = 'axes';
        this.scene.add(axes);
    }
    /** Set 2d vs 3d mode. */
    setDimensions(dimensionality) {
        if (dimensionality !== 2 && dimensionality !== 3) {
            throw new RangeError('dimensionality must be 2 or 3');
        }
        this.dimensionality = dimensionality;
        const def = this.cameraDef || this.makeDefaultCameraDef(dimensionality);
        this.recreateCamera(def);
        this.remove3dAxisFromScene();
        if (dimensionality === 3) {
            this.add3dAxis();
        }
    }
    /** Gets the current camera information, suitable for serialization. */
    getCameraDef() {
        const def = new CameraDef();
        const pos = this.camera.position;
        const tgt = this.orbitCameraControls.target;
        def.orthographic = !this.sceneIs3D();
        def.position = [pos.x, pos.y, pos.z];
        def.target = [tgt.x, tgt.y, tgt.z];
        def.zoom = this.camera.zoom;
        return def;
    }
    /** Sets parameters for the next camera recreation. */
    setCameraParametersForNextCameraCreation(def, orbitAnimation) {
        this.cameraDef = def;
        this.orbitAnimationOnNextCameraCreation = orbitAnimation;
    }
    /** Gets the current camera position. */
    getCameraPosition() {
        const currPos = this.camera.position;
        return [currPos.x, currPos.y, currPos.z];
    }
    /** Gets the current camera target. */
    getCameraTarget() {
        let currTarget = this.orbitCameraControls.target;
        return [currTarget.x, currTarget.y, currTarget.z];
    }
    /** Sets up the camera from given position and target coordinates. */
    setCameraPositionAndTarget(position, target) {
        this.stopOrbitAnimation();
        this.camera.position.set(position[0], position[1], position[2]);
        this.orbitCameraControls.target.set(target[0], target[1], target[2]);
        this.orbitCameraControls.update();
        this.render();
    }
    /** Starts orbiting the camera around its current lookat target. */
    startOrbitAnimation() {
        if (!this.sceneIs3D()) {
            return;
        }
        if (this.orbitAnimationId != null) {
            this.stopOrbitAnimation();
        }
        this.orbitCameraControls.autoRotate = true;
        this.orbitCameraControls.rotateSpeed = ORBIT_ANIMATION_ROTATION_CYCLE_IN_SECONDS;
        this.updateOrbitAnimation();
    }
    updateOrbitAnimation() {
        this.orbitCameraControls.update();
        this.orbitAnimationId = requestAnimationFrame(() => this.updateOrbitAnimation());
    }
    /** Stops the orbiting animation on the camera. */
    stopOrbitAnimation() {
        this.orbitCameraControls.autoRotate = false;
        this.orbitCameraControls.rotateSpeed = ORBIT_MOUSE_ROTATION_SPEED;
        if (this.orbitAnimationId != null) {
            cancelAnimationFrame(this.orbitAnimationId);
            this.orbitAnimationId = null;
        }
    }
    /** Adds a visualizer to the set, will start dispatching events to it */
    addVisualizer(visualizer) {
        if (this.scene) {
            visualizer === null || visualizer === void 0 ? void 0 : visualizer.setScene(this.scene);
        }
        visualizer.onResize(this.width, this.height);
        visualizer.onPointPositionsChanged(this.worldSpacePointPositions);
        this.visualizers.push(visualizer);
    }
    /** Removes all visualizers attached to this scatter plot. */
    removeAllVisualizers() {
        this.visualizers.forEach((v) => v.dispose());
        this.visualizers = [];
    }
    /** Update scatter plot with a new array of packed xyz point positions. */
    setPointPositions(worldSpacePointPositions, realDataNumber) {
        this.worldSpacePointPositions = worldSpacePointPositions;
        this.visualizers.forEach((v) => v.onPointPositionsChanged(worldSpacePointPositions));
        this.realDataNumber = realDataNumber;
    }
    render() {
        {
            const lightPos = this.camera.position.clone();
            lightPos.x += 1;
            lightPos.y += 1;
            this.light.position.set(lightPos.x, lightPos.y, lightPos.z);
        }
        const cameraType = this.camera instanceof THREE.PerspectiveCamera
            ? CameraType.Perspective
            : CameraType.Orthographic;
        let cameraSpacePointExtents = [0, 0];
        if (this.worldSpacePointPositions != null) {
            cameraSpacePointExtents = util.getNearFarPoints(this.worldSpacePointPositions, this.camera.position, this.orbitCameraControls.target);
        }
        const rc = new RenderContext(this.camera, cameraType, this.orbitCameraControls.target, this.width, this.height, cameraSpacePointExtents[0], cameraSpacePointExtents[1], this.backgroundColor, this.pointColors, this.pointScaleFactors, this.labels, this.polylineColors, this.polylineOpacities, this.polylineWidths);
        // Render first pass to picking target. This render fills pickingTexture
        // with colors that are actually point ids, so that sampling the texture at
        // the mouse's current x,y coordinates will reveal the data point that the
        // mouse is over.
        this.visualizers.forEach((v) => v.onPickingRender(rc));
        {
            const axes = this.remove3dAxisFromScene();
            // Render to the pickingTexture when existing.
            if (this.pickingTexture) {
                this.renderer.setRenderTarget(this.pickingTexture);
            }
            else {
                this.renderer.setRenderTarget(null);
            }
            this.renderer.render(this.scene, this.camera);
            // Set the renderTarget back to the default.
            this.renderer.setRenderTarget(null);
            if (axes != null) {
                this.scene.add(axes);
            }
        }
        // Render second pass to color buffer, to be displayed on the canvas.
        this.visualizers.forEach((v) => v.onRender(rc));
        this.renderer.render(this.scene, this.camera);
    }
    setMouseMode(mouseMode) {
        this.mouseMode = mouseMode;
        if (mouseMode === MouseMode.AREA_SELECT) {
            this.selecting = true;
            this.container.style.cursor = 'crosshair';
        }
        else {
            this.selecting = false;
            this.container.style.cursor = 'default';
        }
    }
    /** Set the colors for every data point. (RGB triplets) */
    setPointColors(colors) {
        this.pointColors = colors;
    }
    /** Set the scale factors for every data point. (scalars) */
    setPointScaleFactors(scaleFactors) {
        this.pointScaleFactors = scaleFactors;
    }
    /** Set the labels to rendered */
    setLabels(labels) {
        this.labels = labels;
    }
    /** Set the colors for every data polyline. (RGB triplets) */
    setPolylineColors(colors) {
        this.polylineColors = colors;
    }
    setPolylineOpacities(opacities) {
        this.polylineOpacities = opacities;
    }
    setPolylineWidths(widths) {
        this.polylineWidths = widths;
    }
    getMouseMode() {
        return this.mouseMode;
    }
    resetZoom() {
        this.recreateCamera(this.makeDefaultCameraDef(this.dimensionality));
        this.render();
    }
    setDayNightMode(isNight) {
        const canvases = this.container.querySelectorAll('canvas');
        const filterValue = isNight ? 'invert(100%)' : null;
        for (let i = 0; i < canvases.length; i++) {
            canvases[i].style.filter = filterValue;
        }
    }
    resize(render = true) {
        const [oldW, oldH] = [this.width, this.height];
        const [newW, newH] = this.getLayoutValues();
        if (this.dimensionality === 3) {
            const camera = this.camera;
            camera.aspect = newW / newH;
            camera.updateProjectionMatrix();
        }
        else {
            const camera = this.camera;
            // Scale the ortho frustum by however much the window changed.
            const scaleW = newW / oldW;
            const scaleH = newH / oldH;
            const newCamHalfWidth = ((camera.right - camera.left) * scaleW) / 2;
            const newCamHalfHeight = ((camera.top - camera.bottom) * scaleH) / 2;
            camera.top = newCamHalfHeight;
            camera.bottom = -newCamHalfHeight;
            camera.left = -newCamHalfWidth;
            camera.right = newCamHalfWidth;
            camera.updateProjectionMatrix();
        }
        // Accouting for retina displays.
        const dpr = window.devicePixelRatio || 1;
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(newW, newH);
        // the picking texture needs to be exactly the same as the render texture.
        {
            const renderCanvasSize = new THREE.Vector2();
            // TODO(stephanwlee): Remove casting to any after three.js typing is
            // proper.
            this.renderer.getSize(renderCanvasSize);
            const pixelRatio = this.renderer.getPixelRatio();
            this.pickingTexture = new THREE.WebGLRenderTarget(renderCanvasSize.width * pixelRatio, renderCanvasSize.height * pixelRatio);
            this.pickingTexture.texture.minFilter = THREE.LinearFilter;
        }
        this.visualizers.forEach((v) => v.onResize(newW, newH));
        if (render) {
            this.render();
        }
    }
    onCameraMove(listener) {
        this.onCameraMoveListeners.push(listener);
    }
    clickOnPoint(pointIndex) {
        this.nearestPoint = pointIndex;
        this.onClick(null, false);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NhdHRlclBsb3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi90ZW5zb3Jib2FyZC9wcm9qZWN0b3Ivc2NhdHRlclBsb3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Z0ZBYWdGO0FBRWhGLE9BQU8sS0FBSyxLQUFLLE1BQU0sT0FBTyxDQUFDO0FBQy9CLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUcxRSxPQUFPLEtBQUssSUFBSSxNQUFNLFFBQVEsQ0FBQztBQUUvQixPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBcUIsTUFBTSxpQkFBaUIsQ0FBQztBQUUvRSxPQUFPLEVBRUwsNEJBQTRCLEdBQzdCLE1BQU0sZ0NBQWdDLENBQUM7QUFDeEMsTUFBTSxnQkFBZ0IsR0FBRyxRQUFRLENBQUM7QUFRbEM7OztHQUdHO0FBQ0gsTUFBTSxXQUFXLEdBQUcsQ0FBQyxDQUFDO0FBQ3RCLE1BQU0sUUFBUSxHQUFHLENBQUMsR0FBRyxXQUFXLENBQUM7QUFDakMsTUFBTSxRQUFRLEdBQUcsS0FBSyxHQUFHLFdBQVcsQ0FBQztBQUNyQywrQ0FBK0M7QUFDL0MsTUFBTSx5QkFBeUIsR0FBRyxFQUFFLENBQUM7QUFDckMsTUFBTSw0QkFBNEIsR0FBRyxJQUFJLENBQUM7QUFDMUMsTUFBTSwyQkFBMkIsR0FBRyxHQUFHLENBQUM7QUFDeEMsTUFBTSxnQ0FBZ0MsR0FBRyxHQUFHLENBQUM7QUFDN0MsZUFBZTtBQUNmLE1BQU0sU0FBUyxHQUFHLEVBQUUsQ0FBQztBQUNyQixNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUM7QUFDcEIsTUFBTSwwQkFBMEIsR0FBRyxDQUFDLENBQUM7QUFDckMsTUFBTSx5Q0FBeUMsR0FBRyxDQUFDLENBQUM7QUFLcEQsc0NBQXNDO0FBQ3RDLE1BQU0sQ0FBTixJQUFZLFNBR1g7QUFIRCxXQUFZLFNBQVM7SUFDbkIsdURBQVcsQ0FBQTtJQUNYLCtF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LFlBQVksQ0FBQyxVQUFrQjtRQUM3QixJQUFJLENBQUMsWUFBWSxHQUFHLFVBQVUsQ0FBQztRQUMvQixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztJQUM1QixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBDb3B5cmlnaHQgMjAxNiBUaGUgVGVuc29yRmxvdyBBdXRob3JzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5cbmltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IE9yYml0Q29udHJvbHMgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vY29udHJvbHMvT3JiaXRDb250cm9scyc7XG5cbmltcG9ydCAqIGFzIHZlY3RvciBmcm9tICcuL3ZlY3Rvcic7XG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gJy4vdXRpbCc7XG5pbXBvcnQgeyBQcm9qZWN0b3JFdmVudENvbnRleHQgfSBmcm9tICcuL3Byb2plY3RvckV2ZW50Q29udGV4dCc7XG5pbXBvcnQgeyBDYW1lcmFUeXBlLCBSZW5kZXJDb250ZXh0LCBMYWJlbFJlbmRlclBhcmFtcyB9IGZyb20gJy4vcmVuZGVyQ29udGV4dCc7XG5pbXBvcnQgeyBTY2F0dGVyUGxvdFZpc3VhbGl6ZXIgfSBmcm9tICcuL3NjYXR0ZXJQbG90VmlzdWFsaXplcic7XG5pbXBvcnQge1xuICBTY2F0dGVyQm91bmRpbmdCb3gsXG4gIFNjYXR0ZXJQbG90UmVjdGFuZ2xlU2VsZWN0b3IsXG59IGZyb20gJy4vc2NhdHRlclBsb3RSZWN0YW5nbGVTZWxlY3Rvcic7XG5jb25zdCBCQUNLR1JPVU5EX0NPTE9SID0gMHhmZmZmZmY7XG5cbmRlY2xhcmUgZ2xvYmFsIHtcbiAgaW50ZXJmYWNlIFdpbmRvdyB7XG4gICAgYmFja2dyb3VuZE1lc2g6IGFueVxuICB9XG59XG5cbi8qKlxuICogVGhlIGxlbmd0aCBvZiB0aGUgY3ViZSAoZGlhbWV0ZXIgb2YgdGhlIGNpcmN1bXNjcmliaW5nIHNwaGVyZSkgd2hlcmUgYWxsIHRoZVxuICogcG9pbnRzIGxpdmUuXG4gKi9cbmNvbnN0IENVQkVfTEVOR1RIID0gMjtcbmNvbnN0IE1BWF9aT09NID0gNSAqIENVQkVfTEVOR1RIO1xuY29uc3QgTUlOX1pPT00gPSAwLjAyNSAqIENVQkVfTEVOR1RIO1xuLy8gQ29uc3RhbnRzIHJlbGF0aW5nIHRvIHRoZSBjYW1lcmEgcGFyYW1ldGVycy5cbmNvbnN0IFBFUlNQX0NBTUVSQV9GT1ZfVkVSVElDQUwgPSA3MDtcbmNvbnN0IFBFUlNQX0NBTUVSQV9ORUFSX0NMSVBfUExBTkUgPSAwLjAxO1xuY29uc3QgUEVSU1BfQ0FNRVJBX0ZBUl9DTElQX1BMQU5FID0gMTAwO1xuY29uc3QgT1JUSE9fQ0FNRVJBX0ZSVVNUVU1fSEFMRl9FWFRFTlQgPSAxLjI7XG4vLyBLZXkgcHJlc3Nlcy5cbmNvbnN0IFNISUZUX0tFWSA9IDE2O1xuY29uc3QgQ1RSTF9LRVkgPSAxNztcbmNvbnN0IE9SQklUX01PVVNFX1JPVEFUSU9OX1NQRUVEID0gMTtcbmNvbnN0IE9SQklUX0FOSU1BVElPTl9ST1RBVElPTl9DWUNMRV9JTl9TRUNPTkRTID0gNztcbmV4cG9ydCB0eXBlIE9uQ2FtZXJhTW92ZUxpc3RlbmVyID0gKFxuICBjYW1lcmFQb3NpdGlvbjogVEhSRUUuVmVjdG9yMyxcbiAgY2FtZXJhVGFyZ2V0OiBUSFJFRS5WZWN0b3IzXG4pID0+IHZvaWQ7XG4vKiogU3VwcG9ydGVkIG1vZGVzIG9mIGludGVyYWN0aW9uLiAqL1xuZXhwb3J0IGVudW0gTW91c2VNb2RlIHtcbiAgQVJFQV9TRUxFQ1QsXG4gIENBTUVSQV9BTkRfQ0xJQ0tfU0VMRUNULFxufVxuLyoqIERlZmluZXMgYSBjYW1lcmEsIHN1aXRhYmxlIGZvciBzZXJpYWxpemF0aW9uLiAqL1xuZXhwb3J0IGNsYXNzIENhbWVyYURlZiB7XG4gIG9ydGhvZ3JhcGhpYzogYm9vbGVhbiA9IGZhbHNlO1xuICBwb3NpdGlvbjogdmVjdG9yLlBvaW50M0Q7XG4gIHRhcmdldDogdmVjdG9yLlBvaW50M0Q7XG4gIHpvb206IG51bWJlcjtcbn1cbi8qKlxuICogTWFpbnRhaW5zIGEgdGhyZWUuanMgaW5zdGFudGlhdGlvbiBhbmQgY29udGV4dCxcbiAqIGFuaW1hdGlvbiBzdGF0ZSwgYW5kIGFsbCBvdGhlciBsb2dpYyB0aGF0J3NcbiAqIGluZGVwZW5kZW50IG9mIGhvdyBhIDNEIHNjYXR0ZXIgcGxvdCBpcyBhY3R1YWxseSByZW5kZXJlZC4gQWxzbyBob2xkcyBhblxuICogYXJyYXkgb2YgdmlzdWFsaXplcnMgYW5kIGRpc3BhdGNoZXMgYXBwbGljYXRpb24gZXZlbnRzIHRvIHRoZW0uXG4gKi9cbmV4cG9ydCBjbGFzcyBTY2F0dGVyUGxvdCB7XG4gIHByaXZhdGUgcmVhZG9ubHkgU1RBUlRfQ0FNRVJBX1BPU18zRCA9IG5ldyBUSFJFRS5WZWN0b3IzKDAuNDUsIDAuOSwgMS42KTtcbiAgcHJpdmF0ZSByZWFkb25seSBTVEFSVF9DQU1FUkFfVEFSR0VUXzNEID0gbmV3IFRIUkVFLlZlY3RvcjMoMCwgMCwgMCk7XG4gIHByaXZhdGUgcmVhZG9ubHkgU1RBUlRfQ0FNRVJBX1BPU18yRCA9IG5ldyBUSFJFRS5WZWN0b3IzKDAsIDAsIDQpO1xuICBwcml2YXRlIHJlYWRvbmx5IFNUQVJUX0NBTUVSQV9UQVJHRVRfMkQgPSBuZXcgVEhSRUUuVmVjdG9yMygwLCAwLCAwKTtcblxuICBwcml2YXRlIHZpc3VhbGl6ZXJzOiBTY2F0dGVyUGxvdFZpc3VhbGl6ZXJbXSA9IFtdO1xuICBwcml2YXRlIG9uQ2FtZXJhTW92ZUxpc3RlbmVyczogT25DYW1lcmFNb3ZlTGlzdGVuZXJbXSA9IFtdO1xuICBwcml2YXRlIGhlaWdodDogbnVtYmVyO1xuICBwcml2YXRlIHdpZHRoOiBudW1iZXI7XG4gIHByaXZhdGUgbW91c2VNb2RlOiBNb3VzZU1vZGU7XG4gIHByaXZhdGUgYmFja2dyb3VuZENvbG9yOiBudW1iZXIgPSBCQUNLR1JPVU5EX0NPTE9SO1xuICBwcml2YXRlIGRpbWVuc2lvbmFsaXR5OiBudW1iZXIgPSAzO1xuICBwcml2YXRlIHJlbmRlcmVyOiBUSFJFRS5XZWJHTFJlbmRlcmVyO1xuICBwcml2YXRlIHNjZW5lOiBUSFJFRS5TY2VuZTtcbiAgcHJpdmF0ZSBwaWNraW5nVGV4dHVyZTogVEhSRUUuV2ViR0xSZW5kZXJUYXJnZXQ7XG4gIHByaXZhdGUgbGlnaHQ6IFRIUkVFLlBvaW50TGlnaHQ7XG4gIHByaXZhdGUgY2FtZXJhRGVmOiBDYW1lcmFEZWYgPSBudWxsO1xuICBwcml2YXRlIGNhbWVyYTogVEhSRUUuQ2FtZXJhO1xuICBwcml2YXRlIG9yYml0QW5pbWF0aW9uT25OZXh0Q2FtZXJhQ3JlYXRpb246IGJvb2xlYW4gPSBmYWxzZTtcbiAgcHJpdmF0ZSBvcmJpdENhbWVyYUNvbnRyb2xzOiBhbnk7XG4gIHByaXZhdGUgb3JiaXRBbmltYXRpb25JZDogbnVtYmVyO1xuICBwcml2YXRlIHdvcmxkU3BhY2VQb2ludFBvc2l0aW9uczogRmxvYXQzMkFycmF5O1xuICBwcml2YXRlIHBvaW50Q29sb3JzOiBGbG9hdDMyQXJyYXk7XG4gIHByaXZhdGUgcG9pbnRTY2FsZUZhY3RvcnM6IEZsb2F0MzJBcnJheTtcbiAgcHJpdmF0ZSBsYWJlbHM6IExhYmVsUmVuZGVyUGFyYW1zO1xuICBwcml2YXRlIGlzY3RybGluZzogYm9vbGVhbjtcbiAgcHJpdmF0ZSBpc1NoaWZ0aW5nOiBib29sZWFuO1xuICBwcml2YXRlIHBvbHlsaW5lQ29sb3JzOiB7XG4gICAgW3BvbHlsaW5lSW5kZXg6IG51bWJlcl06IEZsb2F0MzJBcnJheTtcbiAgfTtcbiAgcHJpdmF0ZSBwb2x5bGluZU9wYWNpdGllczogRmxvYXQzMkFycmF5O1xuICBwcml2YXRlIHBvbHlsaW5lV2lkdGhzOiBGbG9hdDMyQXJyYXk7XG4gIHByaXZhdGUgc2VsZWN0aW5nID0gZmFsc2U7XG4gIHByaXZhdGUgbmVhcmVzdFBvaW50OiBudW1iZXI7XG4gIHByaXZhdGUgbW91c2VJc0Rvd24gPSBmYWxzZTtcbiAgcHJpdmF0ZSBpc0RyYWdTZXF1ZW5jZSA9IGZhbHNlO1xuICBwcml2YXRlIHJlY3RhbmdsZVNlbGVjdG9yOiBTY2F0dGVyUGxvdFJlY3RhbmdsZVNlbGVjdG9yO1xuICBwcml2YXRlIHJlYWxEYXRhTnVtYmVyID0gMDtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuICAgIHByaXZhdGUgcHJvamVjdG9yRXZlbnRDb250ZXh0OiBQcm9qZWN0b3JFdmVudENvbnRleHRcbiAgKSB7XG5cbiAgICAvLyAxLOWIm+W7uuWcuuaZr+WvueixoVxuICAgIHRoaXMuc2NlbmUgPSBuZXcgVEhSRUUuU2NlbmUoKTtcbiAgICBpZiAoIXdpbmRvdy5zY2VuZUJhY2tncm91bmRJbWcpIHtcbiAgICAgIHdpbmRvdy5zY2VuZUJhY2tncm91bmRJbWcgPSBbXVxuICAgIH1cbiAgICBpZiAod2luZG93LnNjZW5lQmFja2dyb3VuZEltZ1t3aW5kb3cuaXRlcmF0aW9uXSkge1xuICAgICAgdGhpcy5hZGRiYWNrZ3JvdW5kSW1nKHdpbmRvdy5zY2VuZUJhY2tncm91bmRJbWdbd2luZG93Lml0ZXJhdGlvbl0pXG4gICAgfVxuICAgIHRoaXMuZ2V0TGF5b3V0VmFsdWVzKCk7XG4gICAgLy8gdGhpcy5zY2VuZSA9IG5ldyBUSFJFRS5TY2VuZSgpO1xuICAgIHRoaXMucmVuZGVyZXIgPSBuZXcgVEhSRUUuV2ViR0xSZW5kZXJlcih7XG4gICAgICBhbHBoYTogdHJ1ZSxcbiAgICAgIHByZW11bHRpcGxpZWRBbHBoYTogZmFsc2UsXG4gICAgICBhbnRpYWxpYXM6IGZhbHNlLFxuICAgIH0pO1xuICAgIHRoaXMucmVuZGVyZXIuc2V0Q2xlYXJDb2xvcihCQUNLR1JPVU5EX0NPTE9SLCAxKTtcbiAgICB0aGlzLmNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQpO1xuXG4gICAgdGhpcy5saWdodCA9IG5ldyBUSFJFRS5Qb2ludExpZ2h0KDB4ZmZmZmZmKTtcbiAgICB0aGlzLnNjZW5lLmFkZCh0aGlzLmxpZ2h0KTtcbiAgICB0aGlzLnNldERpbWVuc2lvbnMoMyk7XG4gICAgdGhpcy5yZWNyZWF0ZUNhbWVyYSh0aGlzLm1ha2VEZWZhdWx0Q2FtZXJhRGVmKHRoaXMuZGltZW5zaW9uYWxpdHkpKTtcbiAgICB0aGlzLnJlbmRlcmVyLnJlbmRlcih0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYSk7XG4gICAgdGhpcy5yZWN0YW5nbGVTZWxlY3RvciA9IG5ldyBTY2F0dGVyUGxvdFJlY3RhbmdsZVNlbGVjdG9yKFxuICAgICAgdGhpcy5jb250YWluZXIsXG4gICAgICAoYm91bmRpbmdCb3g6IFNjYXR0ZXJCb3VuZGluZ0JveCkgPT4gdGhpcy5zZWxlY3RCb3VuZGluZ0JveChib3VuZGluZ0JveClcbiAgICApO1xuICAgIHRoaXMuYWRkSW50ZXJhY3Rpb25MaXN0ZW5lcnMoKTtcbiAgICB3aW5kb3cuc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgIHdpbmRvdy5yZW5kZXJlciA9IHRoaXMucmVuZGVyZXJcbiAgfVxuXG4gIGFkZGJhY2tncm91bmRJbWcoaW1nVXJsOiBzdHJpbmcpIHtcbiAgICAvL+enu+mZpOS4iuS4gOS4queUu+W4g1xuICAgIC8vIGlmICh3aW5kb3cuYmFja2dyb3VuZE1lc2gpIHtcbiAgICAvLyAgIHRoaXMuc2NlbmUucmVtb3ZlKHdpbmRvdy5iYWNrZ3JvdW5kTWVzaClcbiAgICAvLyB9XG4gICAgbGV0IHRlbXAgPSB3aW5kb3cuYmFja2dyb3VuZE1lc2hcbiAgICBpZiAoIWltZ1VybCkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIC8vIDLvvIzkvb/nlKhjYW52YXPnlLvlm77kvZzkuLrnurnnkIbotLTlm75cbiAgICAvLyDlhYjkvb/nlKhjYW52YXPnlLvlm75cbiAgICBsZXQgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgY2FudmFzLndpZHRoID0gMTI4O1xuICAgIGNhbnZhcy5oZWlnaHQgPSAxMjg7XG4gICAgdmFyIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XG4gICAgdmFyIGltZyA9IG5ldyBJbWFnZSgpO1xuICAgIGltZy5zcmMgPSBpbWdVcmw7XG4gICAgaW1nLmNyb3NzT3JpZ2luID0gXCJhbm9ueW1vdXNcIjtcbiAgICBpbWcub25sb2FkID0gKCkgPT4ge1xuICAgICAgY3R4LmRyYXdJbWFnZShpbWcsIDAsIDAsIDEyOCwgMTI4KTtcbiAgICAgIGxldCB0ZXh0dXJlID0gbmV3IFRIUkVFLkNhbnZhc1RleHR1cmUoY2FudmFzKTtcbiAgICAgIC8vIHRleHR1cmUubmVlZHNVcGRhdGUgPSB0cnVlOyAvLyDkuI3orr7nva5uZWVkc1VwZGF0ZeS4unRydWXnmoTor53vvIzlj6/og73nurnnkIbotLTlm77kuI3liLfmlrBcbiAgICAgIHZhciBwbGFuZV9nZW9tZXRyeSA9IG5ldyBUSFJFRS5QbGFuZUdlb21ldHJ5KDIsIDIpO1xuICAgICAgdmFyIG1hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hQaG9uZ01hdGVyaWFsKHtcbiAgICAgICAgLy8gY29sb3I6MHgxMWZmMjIsXG4gICAgICAgIG1hcDogdGV4dHVyZSxcbiAgICAgICAgc2lkZTogVEhSRUUuRG91YmxlU2lkZVxuICAgICAgfSk7XG4gICAgICBjb25zdCBuZXdNZXNoID0gbmV3IFRIUkVFLk1lc2gocGxhbmVfZ2VvbWV0cnksIG1hdGVyaWFsKTtcbiAgICAgIHRoaXMuc2NlbmUuYWRkKG5ld01lc2gpO1xuICAgICAgaWYgKHRlbXApIHtcbiAgICAgICAgdGhpcy5zY2VuZS5yZW1vdmUodGVtcClcbiAgICAgIH1cbiAgICAgIHdpbmRvdy5iYWNrZ3JvdW5kTWVzaCA9IG5ld01lc2hcbiAgICAgIHdpbmRvdy5zY2VuZSA9IHRoaXMuc2NlbmVcbiAgICAgIHRoaXMucmVuZGVyKCk7XG4gICAgfVxuICB9XG4gIHByaXZhdGUgYWRkSW50ZXJhY3Rpb25MaXN0ZW5lcnMoKSB7XG5cbiAgICB0aGlzLmNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLm9uTW91c2VNb3ZlLmJpbmQodGhpcykpO1xuXG4gICAgdGhpcy5jb250YWluZXIuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgdGhpcy5vbk1vdXNlRG93bi5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5vbk1vdXNlVXAuYmluZCh0aGlzKSk7XG4gICAgLy8gdGhpcy5jb250YWluZXIuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMub25Nb3VzZXdoZWVsLmJpbmQodGhpcykpO1xuICAgIC8vIHRoaXMuY29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoJ2RibGNsaWNrJywgdGhpcy5vbkNsaWNrLmJpbmQodGhpcykpO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5vbktleURvd24uYmluZCh0aGlzKSwgZmFsc2UpO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIHRoaXMub25LZXlVcC5iaW5kKHRoaXMpLCBmYWxzZSk7XG4gIH1cbiAgcHJpdmF0ZSBhZGRDYW1lcmFDb250cm9sc0V2ZW50TGlzdGVuZXJzKGNhbWVyYUNvbnRyb2xzOiBhbnkpIHtcbiAgICAvLyBTdGFydCBpcyBjYWxsZWQgd2hlbiB0aGUgdXNlciBzdGFycyBpbnRlcmFjdGluZyB3aXRoXG4gICAgLy8gY29udHJvbHMuXG4gICAgY2FtZXJhQ29udHJvbHMuYWRkRXZlbnRMaXN0ZW5lcignc3RhcnQnLCAoKSA9PiB7XG4gICAgICB0aGlzLnN0b3BPcmJpdEFuaW1hdGlvbigpO1xuICAgICAgdGhpcy5vbkNhbWVyYU1vdmVMaXN0ZW5lcnMuZm9yRWFjaCgobCkgPT5cbiAgICAgICAgbCh0aGlzLmNhbWVyYS5wb3NpdGlvbiwgY2FtZXJhQ29udHJvbHMudGFyZ2V0KVxuICAgICAgKTtcbiAgICB9KTtcbiAgICAvLyBDaGFuZ2UgaXMgY2FsbGVkIGV2ZXJ5dGltZSB0aGUgdXNlciBpbnRlcmFjdHMgd2l0aCB0aGUgY29udHJvbHMuXG4gICAgY2FtZXJhQ29udHJvbHMuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgdGhpcy5yZW5kZXIoKTtcbiAgICB9KTtcbiAgICAvLyBFbmQgaXMgY2FsbGVkIHdoZW4gdGhlIHVzZXIgc3RvcHMgaW50ZXJhY3Rpbmcgd2l0aCB0aGVcbiAgICAvLyBjb250cm9scyAoZS5nLiBvbiBtb3VzZSB1cCwgYWZ0ZXIgZHJhZ2dpbmcpLlxuICAgIGNhbWVyYUNvbnRyb2xzLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZCcsICgpID0+IHsgfSk7XG4gIH1cbiAgcHJpdmF0ZSBtYWtlT3JiaXRDb250cm9scyhcbiAgICBjYW1lcmE6IFRIUkVFLkNhbWVyYSxcbiAgICBjYW1lcmFEZWY6IENhbWVyYURlZixcbiAgICBjYW1lcmFJczNEOiBib29sZWFuXG4gICkge1xuICAgIGlmICh0aGlzLm9yYml0Q2FtZXJhQ29udHJvbHMgIT0gbnVsbCkge1xuICAgICAgdGhpcy5vcmJpdENhbWVyYUNvbnRyb2xzLmRpc3Bvc2UoKTtcbiAgICB9XG4gICAgY29uc3Qgb2NjID0gbmV3IE9yYml0Q29udHJvbHMoY2FtZXJhLCB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQpIGFzIGFueTtcbiAgICBvY2MudGFyZ2V0MCA9IG5ldyBUSFJFRS5WZWN0b3IzKFxuICAgICAgY2FtZXJhRGVmLnRhcmdldFswXSxcbiAgICAgIGNhbWVyYURlZi50YXJnZXRbMV0sXG4gICAgICBjYW1lcmFEZWYudGFyZ2V0WzJdXG4gICAgKTtcbiAgICBvY2MucG9zaXRpb24wID0gbmV3IFRIUkVFLlZlY3RvcjMoKS5jb3B5KGNhbWVyYS5wb3NpdGlvbik7XG4gICAgb2NjLnpvb20wID0gY2FtZXJhRGVmLnpvb207XG4gICAgb2NjLmVuYWJsZVJvdGF0ZSA9IGNhbWVyYUlzM0Q7XG4gICAgb2NjLmF1dG9Sb3RhdGUgPSBmYWxzZTtcbiAgICBvY2Mucm90YXRlU3BlZWQgPSBPUkJJVF9NT1VTRV9ST1RBVElPTl9TUEVFRDtcbiAgICBpZiAoY2FtZXJhSXMzRCkge1xuICAgICAgb2NjLm1vdXNlQnV0dG9ucy5PUkJJVCA9IFRIUkVFLk1PVVNFLkxFRlQ7XG4gICAgICBvY2MubW91c2VCdXR0b25zLlBBTiA9IFRIUkVFLk1PVVNFLlJJR0hUO1xuICAgIH0gZWxzZSB7XG4gICAgICBvY2MubW91c2VCdXR0b25zLk9SQklUID0gbnVsbDtcbiAgICAgIG9jYy5tb3VzZUJ1dHRvbnMuUEFOID0gVEhSRUUuTU9VU0UuTEVGVDtcbiAgICB9XG4gICAgb2NjLm1vdXNlQnV0dG9ucy5MRUZUID0gVEhSRUUuTU9VU0UuUEFOXG4gICAgb2NjLm1vdXNlQnV0dG9ucy5SSUdIVCA9IG51bGxcbiAgICBvY2MucmVzZXQoKTtcbiAgICB0aGlzLmNhbWVyYSA9IGNhbWVyYTtcbiAgICB0aGlzLm9yYml0Q2FtZXJhQ29udHJvbHMgPSBvY2M7XG4gICAgdGhpcy5hZGRDYW1lcmFDb250cm9sc0V2ZW50TGlzdGVuZXJzKHRoaXMub3JiaXRDYW1lcmFDb250cm9scyk7XG4gIH1cbiAgcHJpdmF0ZSBtYWtlQ2FtZXJhM0QoY2FtZXJhRGVmOiBDYW1lcmFEZWYsIHc6IG51bWJlciwgaDogbnVtYmVyKSB7XG4gICAgbGV0IGNhbWVyYTogVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmE7XG4gICAge1xuICAgICAgY29uc3QgYXNwZWN0UmF0aW8gPSB3IC8gaDtcbiAgICAgIGNhbWVyYSA9IG5ldyBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYShcbiAgICAgICAgUEVSU1BfQ0FNRVJBX0ZPVl9WRVJUSUNBTCxcbiAgICAgICAgYXNwZWN0UmF0aW8sXG4gICAgICAgIFBFUlNQX0NBTUVSQV9ORUFSX0NMSVBfUExBTkUsXG4gICAgICAgIFBFUlNQX0NBTUVSQV9GQVJfQ0xJUF9QTEFORVxuICAgICAgKTtcbiAgICAgIGNhbWVyYS5wb3NpdGlvbi5zZXQoXG4gICAgICAgIGNhbWVyYURlZi5wb3NpdGlvblswXSxcbiAgICAgICAgY2FtZXJhRGVmLnBvc2l0aW9uWzFdLFxuICAgICAgICBjYW1lcmFEZWYucG9zaXRpb25bMl1cbiAgICAgICk7XG4gICAgICBjb25zdCBhdCA9IG5ldyBUSFJFRS5WZWN0b3IzKFxuICAgICAgICBjYW1lcmFEZWYudGFyZ2V0WzBdLFxuICAgICAgICBjYW1lcmFEZWYudGFyZ2V0WzFdLFxuICAgICAgICBjYW1lcmFEZWYudGFyZ2V0WzJdXG4gICAgICApO1xuICAgICAgY2FtZXJhLmxvb2tBdChhdCk7XG4gICAgICBjYW1lcmEuem9vbSA9IGNhbWVyYURlZi56b29tO1xuICAgICAgY2FtZXJhLnVwZGF0ZVByb2plY3Rpb25NYXRyaXgoKTtcbiAgICB9XG4gICAgdGhpcy5jYW1lcmEgPSBjYW1lcmE7XG4gICAgdGhpcy5tYWtlT3JiaXRDb250cm9scyhjYW1lcmEsIGNhbWVyYURlZiwgdHJ1ZSk7XG4gIH1cbiAgcHJpdmF0ZSBtYWtlQ2FtZXJhMkQoY2FtZXJhRGVmOiBDYW1lcmFEZWYsIHc6IG51bWJlciwgaDogbnVtYmVyKSB7XG4gICAgbGV0IGNhbWVyYTogVEhSRUUuT3J0aG9ncmFwaGljQ2FtZXJhO1xuICAgIGNvbnN0IHRhcmdldCA9IG5ldyBUSFJFRS5WZWN0b3IzKFxuICAgICAgY2FtZXJhRGVmLnRhcmdldFswXSxcbiAgICAgIGNhbWVyYURlZi50YXJnZXRbMV0sXG4gICAgICBjYW1lcmFEZWYudGFyZ2V0WzJdXG4gICAgKTtcbiAgICB7XG4gICAgICBjb25zdCBhc3BlY3RSYXRpbyA9IHcgLyBoO1xuICAgICAgbGV0IGxlZnQgPSAtT1JUSE9fQ0FNRVJBX0ZSVVNUVU1fSEFMRl9FWFRFTlQ7XG4gICAgICBsZXQgcmlnaHQgPSBPUlRIT19DQU1FUkFfRlJVU1RVTV9IQUxGX0VYVEVOVDtcbiAgICAgIGxldCBib3R0b20gPSAtT1JUSE9fQ0FNRVJBX0ZSVVNUVU1fSEFMRl9FWFRFTlQ7XG4gICAgICBsZXQgdG9wID0gT1JUSE9fQ0FNRVJBX0ZSVVNUVU1fSEFMRl9FWFRFTlQ7XG4gICAgICAvLyBTY2FsZSB1cCB0aGUgbGFyZ2VyIG9mICh3LCBoKSB0byBtYXRjaCB0aGUgYXNwZWN0IHJhdGlvLlxuICAgICAgaWYgKGFzcGVjdFJhdGlvID4gMSkge1xuICAgICAgICBsZWZ0ICo9IGFzcGVjdFJhdGlvO1xuICAgICAgICByaWdodCAqPSBhc3BlY3RSYXRpbztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRvcCAvPSBhc3BlY3RSYXRpbztcbiAgICAgICAgYm90dG9tIC89IGFzcGVjdFJhdGlvO1xuICAgICAgfVxuICAgICAgY2FtZXJhID0gbmV3IFRIUkVFLk9ydGhvZ3JhcGhpY0NhbWVyYShcbiAgICAgICAgbGVmdCxcbiAgICAgICAgcmlnaHQsXG4gICAgICAgIHRvcCxcbiAgICAgICAgYm90dG9tLFxuICAgICAgICAtMTAwMCxcbiAgICAgICAgMTAwMFxuICAgICAgKTtcbiAgICAgIGNhbWVyYS5wb3NpdGlvbi5zZXQoXG4gICAgICAgIGNhbWVyYURlZi5wb3NpdGlvblswXSxcbiAgICAgICAgY2FtZXJhRGVmLnBvc2l0aW9uWzFdLFxuICAgICAgICBjYW1lcmFEZWYucG9zaXRpb25bMl1cbiAgICAgICk7XG4gICAgICBjYW1lcmEudXAgPSBuZXcgVEhSRUUuVmVjdG9yMygwLCAxLCAwKTtcbiAgICAgIGNhbWVyYS5sb29rQXQodGFyZ2V0KTtcbiAgICAgIGNhbWVyYS56b29tID0gY2FtZXJhRGVmLnpvb207XG4gICAgICBjYW1lcmEudXBkYXRlUHJvamVjdGlvbk1hdHJpeCgpO1xuICAgIH1cbiAgICB0aGlzLmNhbWVyYSA9IGNhbWVyYTtcbiAgICB0aGlzLm1ha2VPcmJpdENvbnRyb2xzKGNhbWVyYSwgY2FtZXJhRGVmLCBmYWxzZSk7XG4gIH1cbiAgcHJpdmF0ZSBtYWtlRGVmYXVsdENhbWVyYURlZihkaW1lbnNpb25hbGl0eTogbnVtYmVyKTogQ2FtZXJhRGVmIHtcbiAgICBjb25zdCBkZWYgPSBuZXcgQ2FtZXJhRGVmKCk7XG4gICAgZGVmLm9ydGhvZ3JhcGhpYyA9IGRpbWVuc2lvbmFsaXR5ID09PSAyO1xuICAgIGRlZi56b29tID0gMTtcbiAgICBpZiAoZGVmLm9ydGhvZ3JhcGhpYykge1xuICAgICAgZGVmLnBvc2l0aW9uID0gW1xuICAgICAgICB0aGlzLlNUQVJUX0NBTUVSQV9QT1NfMkQueCxcbiAgICAgICAgdGhpcy5TVEFSVF9DQU1FUkFfUE9TXzJELnksXG4gICAgICAgIHRoaXMuU1RBUlRfQ0FNRVJBX1BPU18yRC56LFxuICAgICAgXTtcbiAgICAgIGRlZi50YXJnZXQgPSBbXG4gICAgICAgIHRoaXMuU1RBUlRfQ0FNRVJBX1RBUkdFVF8yRC54LFxuICAgICAgICB0aGlzLlNUQVJUX0NBTUVSQV9UQVJHRVRfMkQueSxcbiAgICAgICAgdGhpcy5TVEFSVF9DQU1FUkFfVEFSR0VUXzJELnosXG4gICAgICBdO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWYucG9zaXRpb24gPSBbXG4gICAgICAgIHRoaXMuU1RBUlRfQ0FNRVJBX1BPU18zRC54LFxuICAgICAgICB0aGlzLlNUQVJUX0NBTUVSQV9QT1NfM0QueSxcbiAgICAgICAgdGhpcy5TVEFSVF9DQU1FUkFfUE9TXzNELnosXG4gICAgICBdO1xuICAgICAgZGVmLnRhcmdldCA9IFtcbiAgICAgICAgdGhpcy5TVEFSVF9DQU1FUkFfVEFSR0VUXzNELngsXG4gICAgICAgIHRoaXMuU1RBUlRfQ0FNRVJBX1RBUkdFVF8zRC55LFxuICAgICAgICB0aGlzLlNUQVJUX0NBTUVSQV9UQVJHRVRfM0QueixcbiAgICAgIF07XG4gICAgfVxuICAgIHJldHVybiBkZWY7XG4gIH1cbiAgLyoqIFJlY3JlYXRlIHRoZSBzY2F0dGVyIHBsb3QgY2FtZXJhIGZyb20gYSBkZWZpbml0aW9uIHN0cnVjdHVyZS4gKi9cbiAgcmVjcmVhdGVDYW1lcmEoY2FtZXJhRGVmOiBDYW1lcmFEZWYpIHtcbiAgICBpZiAoY2FtZXJhRGVmLm9ydGhvZ3JhcGhpYykge1xuICAgICAgdGhpcy5tYWtlQ2FtZXJhMkQoY2FtZXJhRGVmLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubWFrZUNhbWVyYTNEKGNhbWVyYURlZiwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuICAgIH1cbiAgICB0aGlzLm9yYml0Q2FtZXJhQ29udHJvbHMubWluRGlzdGFuY2UgPSBNSU5fWk9PTTtcbiAgICB0aGlzLm9yYml0Q2FtZXJhQ29udHJvbHMubWF4RGlzdGFuY2UgPSBNQVhfWk9PTTtcbiAgICB0aGlzLm9yYml0Q2FtZXJhQ29udHJvbHMuc2NyZWVuU3BhY2VQYW5uaW5nID0gdHJ1ZVxuICAgIC8vIGNvbnNvbGUubG9nKCdvcmJpdENhbWVyYUNvbnRyb2xzJyx0aGlzLm9yYml0Q2FtZXJhQ29udHJvbHMpXG4gICAgdGhpcy5vcmJpdENhbWVyYUNvbnRyb2xzXG4gICAgdGhpcy5vcmJpdENhbWVyYUNvbnRyb2xzLnVwZGF0ZSgpO1xuICAgIGlmICh0aGlzLm9yYml0QW5pbWF0aW9uT25OZXh0Q2FtZXJhQ3JlYXRpb24pIHtcbiAgICAgIHRoaXMuc3RhcnRPcmJpdEFuaW1hdGlvbigpO1xuICAgIH1cbiAgfVxuICBwcml2YXRlIG9uQ2xpY2soZT86IE1vdXNlRXZlbnQsIG5vdGlmeSA9IHRydWUpIHtcbiAgICBpZiAoZSAmJiB0aGlzLnNlbGVjdGluZykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBPbmx5IGNhbGwgZXZlbnQgaGFuZGxlcnMgaWYgdGhlIGNsaWNrIG9yaWdpbmF0ZWQgZnJvbSB0aGUgc2NhdHRlciBwbG90LlxuICAgIGlmICghdGhpcy5pc0RyYWdTZXF1ZW5jZSAmJiBub3RpZnkpIHtcbiAgICAgIGxldCBzZWxlY3Rpb24gPSB0aGlzLm5lYXJlc3RQb2ludCAhPSBudWxsID8gW3RoaXMubmVhcmVzdFBvaW50XSA6IFtdO1xuICAgICAgaWYgKHRoaXMubmVhcmVzdFBvaW50ID49IHRoaXMucmVhbERhdGFOdW1iZXIpIHtcbiAgICAgICAgc2VsZWN0aW9uID0gW107XG4gICAgICB9XG4gICAgICB3aW5kb3cuc2VsZWN0ZWRTdGFjayA9IHNlbGVjdGlvblxuICAgICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQubm90aWZ5U2VsZWN0aW9uQ2hhbmdlZChzZWxlY3Rpb24pO1xuICAgIH1cbiAgICB0aGlzLmlzRHJhZ1NlcXVlbmNlID0gZmFsc2U7XG4gICAgdGhpcy5yZW5kZXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgb25Nb3VzZURvd24oZTogTW91c2VFdmVudCkge1xuICAgIHRoaXMuaXNEcmFnU2VxdWVuY2UgPSBmYWxzZTtcbiAgICB0aGlzLm1vdXNlSXNEb3duID0gdHJ1ZTtcbiAgICAvLyBpZiAodGhpcy5pc2N0cmxpbmcgPT09IHRydWUpIHtcbiAgICAvLyAgIHRoaXMuY29udGFpbmVyLnN0eWxlLmN1cnNvciA9ICdtb3ZlJztcbiAgICAvLyAgIHJldHVyblxuICAgIC8vIH1cbiAgICBpZiAodGhpcy5zZWxlY3RpbmcgJiYgdGhpcy5pc1NoaWZ0aW5nKSB7XG4gICAgICB0aGlzLm9yYml0Q2FtZXJhQ29udHJvbHMuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgdGhpcy5yZWN0YW5nbGVTZWxlY3Rvci5vbk1vdXNlRG93bihlLm9mZnNldFgsIGUub2Zmc2V0WSk7XG4gICAgICB0aGlzLnNldE5lYXJlc3RQb2ludFRvTW91c2UoZSk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgICFlLmN0cmxLZXkgJiZcbiAgICAgIHRoaXMuc2NlbmVJczNEKCkgJiZcbiAgICAgIHRoaXMub3JiaXRDYW1lcmFDb250cm9scy5tb3VzZUJ1dHRvbnMuT1JCSVQgPT09IFRIUkVFLk1PVVNFLlJJR0hUXG4gICAgKSB7XG4gICAgICAvLyBUaGUgdXNlciBoYXBwZW5lZCB0byBwcmVzcyB0aGUgY3RybCBrZXkgd2hlbiB0aGUgdGFiIHdhcyBhY3RpdmUsXG4gICAgICAvLyB1bnByZXNzZWQgdGhlIGN0cmwgd2hlbiB0aGUgdGFiIHdhcyBpbmFjdGl2ZSwgYW5kIG5vdyBoZS9zaGVcbiAgICAgIC8vIGlzIGJhY2sgdG8gdGhlIHByb2plY3RvciB0YWIuXG4gICAgICB0aGlzLm9yYml0Q2FtZXJhQ29udHJvbHMubW91c2VCdXR0b25zLk9SQklUID0gVEhSRUUuTU9VU0UuTEVGVDtcbiAgICAgIHRoaXMub3JiaXRDYW1lcmFDb250cm9scy5tb3VzZUJ1dHRvbnMuUEFOID0gVEhSRUUuTU9VU0UuUklHSFQ7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIGUuY3RybEtleSAmJlxuICAgICAgdGhpcy5zY2VuZUlzM0QoKSAmJlxuICAgICAgdGhpcy5vcmJpdENhbWVyYUNvbnRyb2xzLm1vdXNlQnV0dG9ucy5PUkJJVCA9PT0gVEhSRUUuTU9VU0UuTEVGVFxuICAgICkge1xuICAgICAgLy8gU2ltaWxhcmx5IHRvIHRoZSBzaXR1YXRpb24gYWJvdmUuXG4gICAgICB0aGlzLm9yYml0Q2FtZXJhQ29udHJvbHMubW91c2VCdXR0b25zLk9SQklUID0gVEhSRUUuTU9VU0UuUklHSFQ7XG4gICAgICB0aGlzLm9yYml0Q2FtZXJhQ29udHJvbHMubW91c2VCdXR0b25zLlBBTiA9IFRIUkVFLk1PVVNFLkxFRlQ7XG4gICAgfWVsc2V7XG4gICAgICB0aGlzLmNvbnRhaW5lci5zdHlsZS5jdXJzb3IgPSAnbW92ZSc7XG4gICAgICAvLyB0aGlzLm9uS2V5RG93bih7a2V5Q29kZTpDVFJMX0tFWX0pXG4gICAgfVxuICB9XG4gIHByaXZhdGUgcmVzZXRDYW1lcmEoKSB7XG4gICAgY29uc3QgZGVmID0gdGhpcy5jYW1lcmFEZWYgfHwgdGhpcy5tYWtlRGVmYXVsdENhbWVyYURlZigzKTtcbiAgICB0aGlzLnJlY3JlYXRlQ2FtZXJhKGRlZilcbiAgfVxuICByZXNldDJkQ2FtZXJhKCkge1xuICAgIHRoaXMucmVzZXRab29tKClcbiAgfVxuICAvKiogV2hlbiB3ZSBzdG9wIGRyYWdnaW5nL3pvb21pbmcsIHJldHVybiB0byBub3JtYWwgYmVoYXZpb3IuICovXG4gIHByaXZhdGUgb25Nb3VzZVVwKGU6IGFueSkge1xuICAgIC8vIGlmICh0aGlzLmlzY3RybGluZyA9PT0gdHJ1ZSkge1xuICAgICAgaWYgKHRoaXMuc2VsZWN0aW5nKSB7XG4gICAgICAgIHRoaXMuY29udGFpbmVyLnN0eWxlLmN1cnNvciA9ICdjcm9zc2hhaXInO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jb250YWluZXIuc3R5bGUuY3Vyc29yID0gJ2RlZmF1bHQnO1xuICAgICAgfVxuICAgICAgdGhpcy5tb3VzZUlzRG93biA9IGZhbHNlO1xuICAgICAgLy8gcmV0dXJuXG4gICAgLy8gfVxuICAgIGlmICh0aGlzLnNlbGVjdGluZyAmJiB0aGlzLmlzU2hpZnRpbmcpIHtcbiAgICAgIHRoaXMub3JiaXRDYW1lcmFDb250cm9scy5lbmFibGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMucmVjdGFuZ2xlU2VsZWN0b3Iub25Nb3VzZVVwKCk7XG4gICAgICB0aGlzLnJlbmRlcigpO1xuICAgIH1cbiAgICB0aGlzLm1vdXNlSXNEb3duID0gZmFsc2U7XG4gIH1cbiAgLyoqXG4gICAqIFdoZW4gdGhlIG1vdXNlIG1vdmVzLCBmaW5kIHRoZSBuZWFyZXN0IHBvaW50IChpZiBhbnkpIGFuZCBzZW5kIGl0IHRvIHRoZVxuICAgKiBob3Zlcmxpc3RlbmVycyAodXN1YWxseSBjYWxsZWQgZnJvbSBlbWJlZGRpbmcudHMpXG4gICAqL1xuICBwcml2YXRlIG9uTW91c2VNb3ZlKGU6IE1vdXNlRXZlbnQpIHtcbiAgICB0aGlzLmlzRHJhZ1NlcXVlbmNlID0gdGhpcy5tb3VzZUlzRG93bjtcbiAgICAvLyBEZXBlbmRpbmcgaWYgd2UncmUgc2VsZWN0aW5nIG9yIGp1c3QgbmF2aWdhdGluZywgaGFuZGxlIGFjY29yZGluZ2x5LlxuICAgIGlmICh0aGlzLnNlbGVjdGluZyAmJiB0aGlzLm1vdXNlSXNEb3duKSB7XG4gICAgICB0aGlzLnJlY3RhbmdsZVNlbGVjdG9yLm9uTW91c2VNb3ZlKGUub2Zmc2V0WCwgZS5vZmZzZXRZKTtcbiAgICAgIHRoaXMucmVuZGVyKCk7XG4gICAgfSBlbHNlIGlmICghdGhpcy5tb3VzZUlzRG93bikge1xuICAgICAgdGhpcy5zZXROZWFyZXN0UG9pbnRUb01vdXNlKGUpO1xuICAgICAgdGhpcy5wcm9qZWN0b3JFdmVudENvbnRleHQubm90aWZ5SG92ZXJPdmVyUG9pbnQodGhpcy5uZWFyZXN0UG9pbnQpXG4gICAgfVxuICB9XG4gIGRlYm91bmNlKGZ1bmM6IGFueSwgd2FpdDogYW55KSB7XG4gICAgbGV0IHRpbWVvdXQ7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vIOa4heepuuWumuaXtuWZqFxuICAgICAgaWYgKHRpbWVvdXQpIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmMsIHdhaXQpXG4gICAgfVxuICB9XG5cbiAgLyoqIEZvciB1c2luZyBjdHJsICsgbGVmdCBjbGljayBhcyByaWdodCBjbGljaywgYW5kIGZvciBjaXJjbGUgc2VsZWN0ICovXG4gIHByaXZhdGUgb25LZXlEb3duKGU6IGFueSkge1xuICAgIC8vIElmIGN0cmwgaXMgcHJlc3NlZCwgdXNlIGxlZnQgY2xpY2sgdG8gb3JiaXRcbiAgICBpZiAoZS5rZXlDb2RlID09PSBDVFJMX0tFWSAmJiB0aGlzLnNjZW5lSXMzRCkge1xuICAgICAgdGhpcy5pc2N0cmxpbmcgPSB0cnVlXG4gICAgICAvLyB0aGlzLmNvbnRhaW5lci5zdHlsZS5jdXJzb3IgPSAnbW92ZSc7XG4gICAgICB0aGlzLm9yYml0Q2FtZXJhQ29udHJvbHMubW91c2VCdXR0b25zLk9SQklUID0gVEhSRUUuTU9VU0UuUklHSFQ7XG4gICAgICB0aGlzLm9yYml0Q2FtZXJhQ29udHJvbHMubW91c2VCdXR0b25zLlBBTiA9IFRIUkVFLk1PVVNFLkxFRlQ7XG4gICAgfVxuICAgIHZhciBrZXlDb2RlID0gZS5rZXlDb2RlIHx8IGUud2hpY2ggfHwgZS5jaGFyQ29kZTtcbiAgICBsZXQgY3RybEtleSA9IGUuY3RybEtleSB8fCBlLm1ldGFLZXk7XG5cbiAgICBpZiAoY3RybEtleSAmJiBrZXlDb2RlID09IDkwKSB7XG4gICAgICBpZiAoIXRoaXMuc2VsZWN0aW5nKSB7XG4gICAgICAgIHRoaXMuY29udGFpbmVyLnN0eWxlLmN1cnNvciA9ICdkZWZhdWx0JztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY29udGFpbmVyLnN0eWxlLmN1cnNvciA9ICdjcm9zc2hhaXInO1xuICAgICAgfVxuICAgICAgaWYgKHdpbmRvdy5zZWxlY3RlZFN0YWNrICYmIHdpbmRvdy5zZWxlY3RlZFN0YWNrLmxlbmd0aCkge1xuICAgICAgICBpZiAod2luZG93LmN1c3RvbVNlbGVjdGlvbikge1xuICAgICAgICAgIHRoaXMucHJvamVjdG9yRXZlbnRDb250ZXh0Lm5vdGlmeVNlbGVjdGlvbkNoYW5nZWQod2luZG93LnNlbGVjdGVkU3RhY2ssIHRydWUsICdib3VuZGluZ2JveCcpO1xuICAgICAgICAgIHRoaXMuaXNjdHJsaW5nID0gZmFsc2VcbiAgICAgICAgXG4gICAgICAgICAgd2luZG93LnNlbGVjdGVkU3RhY2sgPSBbXVxuICAgICAgICB9XG4gICAgICB9ZWxzZXtcbiAgICAgICAgYWxlcnQoJ1lvdSBjYW4gb25seSBnbyBiYWNrIG9uZSBzdGVwJyk7XG4gICAgICAgIHRoaXMuaXNjdHJsaW5nID0gZmFsc2VcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gSWYgc2hpZnQgaXMgcHJlc3NlZCwgc3RhcnQgc2VsZWN0aW5nXG4gICAgaWYgKGUua2V5Q29kZSA9PT0gU0hJRlRfS0VZICYmIHRoaXMuc2VsZWN0aW5nKSB7XG4gICAgICB0aGlzLmlzU2hpZnRpbmcgPSB0cnVlXG4gICAgICAvLyB0aGlzLnNlbGVjdGluZyA9IHRydWU7XG4gICAgICB0aGlzLmNvbnRhaW5lci5zdHlsZS5jdXJzb3IgPSAnY3Jvc3NoYWlyJztcbiAgICB9XG5cbiAgfVxuICAvKiogRm9yIHVzaW5nIGN0cmwgKyBsZWZ0IGNsaWNrIGFzIHJpZ2h0IGNsaWNrLCBhbmQgZm9yIGNpcmNsZSBzZWxlY3QgKi9cbiAgcHJpdmF0ZSBvbktleVVwKGU6IGFueSkge1xuICAgIHRoaXMuaXNjdHJsaW5nID0gZmFsc2VcbiAgICBpZighKHRoaXMuaXNTaGlmdGluZyA9PT0gdHJ1ZSAmJiB0aGlzLm1vdXNlSXNEb3duID09PSB0cnVlKSl7XG4gICAgICB0aGlzLmlzU2hpZnRpbmcgPSBmYWxzZVxuICAgIH1lbHNle1xuICAgICAgc2V0VGltZW91dCgoKT0+e1xuICAgICAgICB0aGlzLmlzU2hpZnRpbmcgPSBmYWxzZVxuICAgICAgfSwgNjAwKVxuICAgIH1cbiAgICBpZiAodGhpcy5zZWxlY3RpbmcpIHtcbiAgICAgIHRoaXMuY29udGFpbmVyLnN0eWxlLmN1cnNvciA9ICdjcm9zc2hhaXInO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNvbnRhaW5lci5zdHlsZS5jdXJzb3IgPSAnZGVmYXVsdCc7XG4gICAgfVxuICAgIGlmIChlLmtleUNvZGUgPT09IENUUkxfS0VZICYmIHRoaXMuc2NlbmVJczNEKCkpIHtcbiAgICAgIHRoaXMub3JiaXRDYW1lcmFDb250cm9scy5tb3VzZUJ1dHRvbnMuT1JCSVQgPSBUSFJFRS5NT1VTRS5MRUZUO1xuICAgICAgdGhpcy5vcmJpdENhbWVyYUNvbnRyb2xzLm1vdXNlQnV0dG9ucy5QQU4gPSBUSFJFRS5NT1VTRS5SSUdIVDtcbiAgICB9XG4gICAgLy8gSWYgc2hpZnQgaXMgcmVsZWFzZWQsIHN0b3Agc2VsZWN0aW5nXG4gICAgaWYgKGUua2V5Q29kZSA9PT0gU0hJRlRfS0VZKSB7XG4gICAgICB0aGlzLnNlbGVjdGluZyA9IHRoaXMuZ2V0TW91c2VNb2RlKCkgPT09IE1vdXNlTW9kZS5BUkVBX1NFTEVDVDtcbiAgICAgIGlmICghdGhpcy5zZWxlY3RpbmcpIHtcbiAgICAgICAgdGhpcy5jb250YWluZXIuc3R5bGUuY3Vyc29yID0gJ2RlZmF1bHQnO1xuICAgICAgfVxuICAgICAgdGhpcy5yZW5kZXIoKTtcbiAgICB9XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybnMgYSBsaXN0IG9mIGluZGljZXMgb2YgcG9pbnRzIGluIGEgYm91bmRpbmcgYm94IGZyb20gdGhlIHBpY2tpbmdcbiAgICogdGV4dHVyZS5cbiAgICogQHBhcmFtIGJvdW5kaW5nQm94IFRoZSBib3VuZGluZyBib3ggdG8gc2VsZWN0IGZyb20uXG4gICAqL1xuICBwcml2YXRlIGdldFBvaW50SW5kaWNlc0Zyb21QaWNraW5nVGV4dHVyZShcbiAgICBib3VuZGluZ0JveDogU2NhdHRlckJvdW5kaW5nQm94XG4gICk6IG51bWJlcltdIHtcbiAgICBpZiAodGhpcy53b3JsZFNwYWNlUG9pbnRQb3NpdGlvbnMgPT0gbnVsbCB8fCB0aGlzLndvcmxkU3BhY2VQb2ludFBvc2l0aW9ucyA9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBwb2ludENvdW50ID0gdGhpcy53b3JsZFNwYWNlUG9pbnRQb3NpdGlvbnM/Lmxlbmd0aCAvIDM7XG4gICAgY29uc3QgZHByID0gd2luZG93LmRldmljZVBpeGVsUmF0aW8gfHwgMTtcbiAgICBjb25zdCB4ID0gTWF0aC5mbG9vcihib3VuZGluZ0JveC54ICogZHByKTtcbiAgICBjb25zdCB5ID0gTWF0aC5mbG9vcihib3VuZGluZ0JveC55ICogZHByKTtcbiAgICBjb25zdCB3aWR0aCA9IE1hdGguZmxvb3IoYm91bmRpbmdCb3gud2lkdGggKiBkcHIpO1xuICAgIGNvbnN0IGhlaWdodCA9IE1hdGguZmxvb3IoYm91bmRpbmdCb3guaGVpZ2h0ICogZHByKTtcbiAgICAvLyBDcmVhdGUgYnVmZmVyIGZvciByZWFkaW5nIGFsbCBvZiB0aGUgcGl4ZWxzIGZyb20gdGhlIHRleHR1cmUuXG4gICAgbGV0IHBpeGVsQnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkod2lkdGggKiBoZWlnaHQgKiA0KTtcbiAgICAvLyBSZWFkIHRoZSBwaXhlbHMgZnJvbSB0aGUgYm91bmRpbmcgYm94LlxuICAgIHRoaXMucmVuZGVyZXIucmVhZFJlbmRlclRhcmdldFBpeGVscyhcbiAgICAgIHRoaXMucGlja2luZ1RleHR1cmUsXG4gICAgICB4LFxuICAgICAgdGhpcy5waWNraW5nVGV4dHVyZS5oZWlnaHQgLSB5LFxuICAgICAgd2lkdGgsXG4gICAgICBoZWlnaHQsXG4gICAgICBwaXhlbEJ1ZmZlclxuICAgICk7XG4gICAgLy8gS2VlcCBhIGZsYXQgbGlzdCBvZiBlYWNoIHBvaW50IGFuZCB3aGV0aGVyIHRoZXkgYXJlIHNlbGVjdGVkIG9yIG5vdC4gVGhpc1xuICAgIC8vIGFwcHJvYWNoIGlzIG1vcmUgZWZmaWNpZW50IHRoYW4gdXNpbmcgYW4gb2JqZWN0IGtleWVkIGJ5IHRoZSBpbmRleC5cbiAgICBsZXQgcG9pbnRJbmRpY2VzU2VsZWN0aW9uID0gbmV3IFVpbnQ4QXJyYXkoXG4gICAgICB0aGlzLndvcmxkU3BhY2VQb2ludFBvc2l0aW9ucy5sZW5ndGhcbiAgICApO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgd2lkdGggKiBoZWlnaHQ7IGkrKykge1xuICAgICAgY29uc3QgaWQgPVxuICAgICAgICAocGl4ZWxCdWZmZXJbaSAqIDRdIDw8IDE2KSB8XG4gICAgICAgIChwaXhlbEJ1ZmZlcltpICogNCArIDFdIDw8IDgpIHxcbiAgICAgICAgcGl4ZWxCdWZmZXJbaSAqIDQgKyAyXTtcbiAgICAgIGlmIChpZCAhPT0gMTY3NzcyMTUgJiYgaWQgPCBwb2ludENvdW50KSB7XG4gICAgICAgIHBvaW50SW5kaWNlc1NlbGVjdGlvbltpZF0gPSAxO1xuICAgICAgfVxuICAgIH1cbiAgICBsZXQgcG9pbnRJbmRpY2VzOiBudW1iZXJbXSA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcG9pbnRJbmRpY2VzU2VsZWN0aW9uLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAocG9pbnRJbmRpY2VzU2VsZWN0aW9uW2ldID09PSAxKSB7XG4gICAgICAgIHBvaW50SW5kaWNlcy5wdXNoKGkpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcG9pbnRJbmRpY2VzO1xuICB9XG4gIHByaXZhdGUgc2VsZWN0Qm91bmRpbmdCb3goYm91bmRpbmdCb3g6IFNjYXR0ZXJCb3VuZGluZ0JveCkge1xuICAgIGxldCBwb2ludEluZGljZXMgPSB0aGlzLmdldFBvaW50SW5kaWNlc0Zyb21QaWNraW5nVGV4dHVyZShib3VuZGluZ0JveCk7XG4gICAgLy8gcmVtb3ZlIGJhY2tnb3VuZFxuICAgIGxldCB2YWxpZEluZGljZXMgPSBbXTtcbiAgICBsZXQgbGVuZ3RoID0gcG9pbnRJbmRpY2VzLmxlbmd0aFxuICAgIGlmIChwb2ludEluZGljZXMubGVuZ3RoID49IDEwMCkge1xuICAgICAgbGVuZ3RoID0gMTAwXG4gICAgICBhbGVydCgnWW91IGNhbiBzZWxlY3QgdXAgdG8gMTAwIHBvaW50cyBhdCBhIHRpbWUsIGFuZCB0aGUgZmlyc3QgMTAwIHBvaW50cyBhcmUgc2VsZWN0ZWQgYnkgZGVmYXVsdCcpXG4gICAgICB0aGlzLmlzU2hpZnRpbmcgPSBmYWxzZVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIC8vIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAvLyAgIGlmIChwb2ludEluZGljZXNbaV0gPCB0aGlzLnJlYWxEYXRhTnVtYmVyKSB7XG4gICAgLy8gICAgIHZhbGlkSW5kaWNlcy5wdXNoKHBvaW50SW5kaWNlc1tpXSk7XG4gICAgLy8gICB9XG4gICAgLy8gfVxuICAgIC8vIGNvbnNvbGUubG9nKCd2YWxpZEluZGljZXMnLHZhbGlkSW5kaWNlcyxwb2ludEluZGljZXMpXG4gICAgd2luZG93LnNlbGVjdGVkU3RhY2sgPSBwb2ludEluZGljZXNcbiAgICB0aGlzLnByb2plY3RvckV2ZW50Q29udGV4dC5ub3RpZnlTZWxlY3Rpb25DaGFuZ2VkKHBvaW50SW5kaWNlcywgdHJ1ZSwgJ2JvdW5kaW5nYm94Jyk7XG4gIH1cbiAgcHJpdmF0ZSBzZXROZWFyZXN0UG9pbnRUb01vdXNlKGU6IE1vdXNlRXZlbnQpIHtcbiAgICBpZiAodGhpcy5waWNraW5nVGV4dHVyZSA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5lYXJlc3RQb2ludCA9IG51bGw7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGJvdW5kaW5nQm94OiBTY2F0dGVyQm91bmRpbmdCb3ggPSB7XG4gICAgICB4OiBlLm9mZnNldFgsXG4gICAgICB5OiBlLm9mZnNldFksXG4gICAgICB3aWR0aDogNCxcbiAgICAgIGhlaWdodDogNCxcbiAgICB9O1xuICAgIGNvbnN0IHBvaW50SW5kaWNlcyA9IHRoaXMuZ2V0UG9pbnRJbmRpY2VzRnJvbVBpY2tpbmdUZXh0dXJlKGJvdW5kaW5nQm94KTtcbiAgICBjb25zdCByZWFsUG9pbnRJbmRpY2VzID0gcG9pbnRJbmRpY2VzPy5maWx0ZXIocG9pbnQgPT4gcG9pbnQgPCB0aGlzLnJlYWxEYXRhTnVtYmVyKTtcbiAgICBpZiAoIXJlYWxQb2ludEluZGljZXMgfHwgcmVhbFBvaW50SW5kaWNlcz8ubGVuZ3RoID09IDApIHtcbiAgICAgIHRoaXMubmVhcmVzdFBvaW50ID0gcG9pbnRJbmRpY2VzICE9IG51bGwgPyBwb2ludEluZGljZXNbMF0gOiBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm5lYXJlc3RQb2ludCA9IHJlYWxQb2ludEluZGljZXNbMF07XG4gICAgfVxuXG4gIH1cbiAgcHJpdmF0ZSBnZXRMYXlvdXRWYWx1ZXMoKTogdmVjdG9yLlBvaW50MkQge1xuICAgIHRoaXMud2lkdGggPSB0aGlzLmNvbnRhaW5lci5vZmZzZXRXaWR0aDtcbiAgICB0aGlzLmhlaWdodCA9IE1hdGgubWF4KDEsIHRoaXMuY29udGFpbmVyLm9mZnNldEhlaWdodCk7XG4gICAgcmV0dXJuIFt0aGlzLndpZHRoLCB0aGlzLmhlaWdodF07XG4gIH1cbiAgcHJpdmF0ZSBzY2VuZUlzM0QoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuZGltZW5zaW9uYWxpdHkgPT09IDM7XG4gIH1cbiAgcHJpdmF0ZSByZW1vdmUzZEF4aXNGcm9tU2NlbmUoKTogVEhSRUUuT2JqZWN0M0Qge1xuICAgIGNvbnN0IGF4ZXMgPSB0aGlzLnNjZW5lLmdldE9iamVjdEJ5TmFtZSgnYXhlcycpO1xuICAgIGlmIChheGVzICE9IG51bGwpIHtcbiAgICAgIHRoaXMuc2NlbmUucmVtb3ZlKGF4ZXMpO1xuICAgIH1cbiAgICByZXR1cm4gYXhlcztcbiAgfVxuICBwcml2YXRlIGFkZDNkQXhpcygpIHtcbiAgICBjb25zdCBheGVzID0gbmV3IChUSFJFRSBhcyBhbnkpLkF4ZXNIZWxwZXIoKTtcbiAgICBheGVzLm5hbWUgPSAnYXhlcyc7XG4gICAgdGhpcy5zY2VuZS5hZGQoYXhlcyk7XG4gIH1cbiAgLyoqIFNldCAyZCB2cyAzZCBtb2RlLiAqL1xuICBzZXREaW1lbnNpb25zKGRpbWVuc2lvbmFsaXR5OiBudW1iZXIpIHtcbiAgICBpZiAoZGltZW5zaW9uYWxpdHkgIT09IDIgJiYgZGltZW5zaW9uYWxpdHkgIT09IDMpIHtcbiAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdkaW1lbnNpb25hbGl0eSBtdXN0IGJlIDIgb3IgMycpO1xuICAgIH1cbiAgICB0aGlzLmRpbWVuc2lvbmFsaXR5ID0gZGltZW5zaW9uYWxpdHk7XG4gICAgY29uc3QgZGVmID0gdGhpcy5jYW1lcmFEZWYgfHwgdGhpcy5tYWtlRGVmYXVsdENhbWVyYURlZihkaW1lbnNpb25hbGl0eSk7XG4gICAgdGhpcy5yZWNyZWF0ZUNhbWVyYShkZWYpO1xuICAgIHRoaXMucmVtb3ZlM2RBeGlzRnJvbVNjZW5lKCk7XG4gICAgaWYgKGRpbWVuc2lvbmFsaXR5ID09PSAzKSB7XG4gICAgICB0aGlzLmFkZDNkQXhpcygpO1xuICAgIH1cbiAgfVxuICAvKiogR2V0cyB0aGUgY3VycmVudCBjYW1lcmEgaW5mb3JtYXRpb24sIHN1aXRhYmxlIGZvciBzZXJpYWxpemF0aW9uLiAqL1xuICBnZXRDYW1lcmFEZWYoKTogQ2FtZXJhRGVmIHtcbiAgICBjb25zdCBkZWYgPSBuZXcgQ2FtZXJhRGVmKCk7XG4gICAgY29uc3QgcG9zID0gdGhpcy5jYW1lcmEucG9zaXRpb247XG4gICAgY29uc3QgdGd0ID0gdGhpcy5vcmJpdENhbWVyYUNvbnRyb2xzLnRhcmdldDtcbiAgICBkZWYub3J0aG9ncmFwaGljID0gIXRoaXMuc2NlbmVJczNEKCk7XG4gICAgZGVmLnBvc2l0aW9uID0gW3Bvcy54LCBwb3MueSwgcG9zLnpdO1xuICAgIGRlZi50YXJnZXQgPSBbdGd0LngsIHRndC55LCB0Z3Quel07XG4gICAgZGVmLnpvb20gPSAodGhpcy5jYW1lcmEgYXMgYW55KS56b29tO1xuICAgIHJldHVybiBkZWY7XG4gIH1cbiAgLyoqIFNldHMgcGFyYW1ldGVycyBmb3IgdGhlIG5leHQgY2FtZXJhIHJlY3JlYXRpb24uICovXG4gIHNldENhbWVyYVBhcmFtZXRlcnNGb3JOZXh0Q2FtZXJhQ3JlYXRpb24oXG4gICAgZGVmOiBDYW1lcmFEZWYsXG4gICAgb3JiaXRBbmltYXRpb246IGJvb2xlYW5cbiAgKSB7XG4gICAgdGhpcy5jYW1lcmFEZWYgPSBkZWY7XG4gICAgdGhpcy5vcmJpdEFuaW1hdGlvbk9uTmV4dENhbWVyYUNyZWF0aW9uID0gb3JiaXRBbmltYXRpb247XG4gIH1cbiAgLyoqIEdldHMgdGhlIGN1cnJlbnQgY2FtZXJhIHBvc2l0aW9uLiAqL1xuICBnZXRDYW1lcmFQb3NpdGlvbigpOiB2ZWN0b3IuUG9pbnQzRCB7XG4gICAgY29uc3QgY3VyclBvcyA9IHRoaXMuY2FtZXJhLnBvc2l0aW9uO1xuICAgIHJldHVybiBbY3VyclBvcy54LCBjdXJyUG9zLnksIGN1cnJQb3Muel07XG4gIH1cbiAgLyoqIEdldHMgdGhlIGN1cnJlbnQgY2FtZXJhIHRhcmdldC4gKi9cbiAgZ2V0Q2FtZXJhVGFyZ2V0KCk6IHZlY3Rvci5Qb2ludDNEIHtcbiAgICBsZXQgY3VyclRhcmdldCA9IHRoaXMub3JiaXRDYW1lcmFDb250cm9scy50YXJnZXQ7XG4gICAgcmV0dXJuIFtjdXJyVGFyZ2V0LngsIGN1cnJUYXJnZXQueSwgY3VyclRhcmdldC56XTtcbiAgfVxuICAvKiogU2V0cyB1cCB0aGUgY2FtZXJhIGZyb20gZ2l2ZW4gcG9zaXRpb24gYW5kIHRhcmdldCBjb29yZGluYXRlcy4gKi9cbiAgc2V0Q2FtZXJhUG9zaXRpb25BbmRUYXJnZXQocG9zaXRpb246IHZlY3Rvci5Qb2ludDNELCB0YXJnZXQ6IHZlY3Rvci5Qb2ludDNEKSB7XG4gICAgdGhpcy5zdG9wT3JiaXRBbmltYXRpb24oKTtcbiAgICB0aGlzLmNhbWVyYS5wb3NpdGlvbi5zZXQocG9zaXRpb25bMF0sIHBvc2l0aW9uWzFdLCBwb3NpdGlvblsyXSk7XG4gICAgdGhpcy5vcmJpdENhbWVyYUNvbnRyb2xzLnRhcmdldC5zZXQodGFyZ2V0WzBdLCB0YXJnZXRbMV0sIHRhcmdldFsyXSk7XG4gICAgdGhpcy5vcmJpdENhbWVyYUNvbnRyb2xzLnVwZGF0ZSgpO1xuICAgIHRoaXMucmVuZGVyKCk7XG4gIH1cbiAgLyoqIFN0YXJ0cyBvcmJpdGluZyB0aGUgY2FtZXJhIGFyb3VuZCBpdHMgY3VycmVudCBsb29rYXQgdGFyZ2V0LiAqL1xuICBzdGFydE9yYml0QW5pbWF0aW9uKCkge1xuICAgIGlmICghdGhpcy5zY2VuZUlzM0QoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodGhpcy5vcmJpdEFuaW1hdGlvbklkICE9IG51bGwpIHtcbiAgICAgIHRoaXMuc3RvcE9yYml0QW5pbWF0aW9uKCk7XG4gICAgfVxuICAgIHRoaXMub3JiaXRDYW1lcmFDb250cm9scy5hdXRvUm90YXRlID0gdHJ1ZTtcbiAgICB0aGlzLm9yYml0Q2FtZXJhQ29udHJvbHMucm90YXRlU3BlZWQgPSBPUkJJVF9BTklNQVRJT05fUk9UQVRJT05fQ1lDTEVfSU5fU0VDT05EUztcbiAgICB0aGlzLnVwZGF0ZU9yYml0QW5pbWF0aW9uKCk7XG4gIH1cbiAgcHJpdmF0ZSB1cGRhdGVPcmJpdEFuaW1hdGlvbigpIHtcbiAgICB0aGlzLm9yYml0Q2FtZXJhQ29udHJvbHMudXBkYXRlKCk7XG4gICAgdGhpcy5vcmJpdEFuaW1hdGlvbklkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+XG4gICAgICB0aGlzLnVwZGF0ZU9yYml0QW5pbWF0aW9uKClcbiAgICApO1xuICB9XG4gIC8qKiBTdG9wcyB0aGUgb3JiaXRpbmcgYW5pbWF0aW9uIG9uIHRoZSBjYW1lcmEuICovXG4gIHN0b3BPcmJpdEFuaW1hdGlvbigpIHtcbiAgICB0aGlzLm9yYml0Q2FtZXJhQ29udHJvbHMuYXV0b1JvdGF0ZSA9IGZhbHNlO1xuICAgIHRoaXMub3JiaXRDYW1lcmFDb250cm9scy5yb3RhdGVTcGVlZCA9IE9SQklUX01PVVNFX1JPVEFUSU9OX1NQRUVEO1xuICAgIGlmICh0aGlzLm9yYml0QW5pbWF0aW9uSWQgIT0gbnVsbCkge1xuICAgICAgY2FuY2VsQW5pbWF0aW9uRnJhbWUodGhpcy5vcmJpdEFuaW1hdGlvbklkKTtcbiAgICAgIHRoaXMub3JiaXRBbmltYXRpb25JZCA9IG51bGw7XG4gICAgfVxuICB9XG4gIC8qKiBBZGRzIGEgdmlzdWFsaXplciB0byB0aGUgc2V0LCB3aWxsIHN0YXJ0IGRpc3BhdGNoaW5nIGV2ZW50cyB0byBpdCAqL1xuICBhZGRWaXN1YWxpemVyKHZpc3VhbGl6ZXI6IFNjYXR0ZXJQbG90VmlzdWFsaXplcikge1xuICAgIGlmICh0aGlzLnNjZW5lKSB7XG4gICAgICB2aXN1YWxpemVyPy5zZXRTY2VuZSh0aGlzLnNjZW5lKTtcbiAgICB9XG4gICAgdmlzdWFsaXplci5vblJlc2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG4gICAgdmlzdWFsaXplci5vblBvaW50UG9zaXRpb25zQ2hhbmdlZCh0aGlzLndvcmxkU3BhY2VQb2ludFBvc2l0aW9ucyk7XG4gICAgdGhpcy52aXN1YWxpemVycy5wdXNoKHZpc3VhbGl6ZXIpO1xuICB9XG4gIC8qKiBSZW1vdmVzIGFsbCB2aXN1YWxpemVycyBhdHRhY2hlZCB0byB0aGlzIHNjYXR0ZXIgcGxvdC4gKi9cbiAgcmVtb3ZlQWxsVmlzdWFsaXplcnMoKSB7XG4gICAgdGhpcy52aXN1YWxpemVycy5mb3JFYWNoKCh2KSA9PiB2LmRpc3Bvc2UoKSk7XG4gICAgdGhpcy52aXN1YWxpemVycyA9IFtdO1xuICB9XG4gIC8qKiBVcGRhdGUgc2NhdHRlciBwbG90IHdpdGggYSBuZXcgYXJyYXkgb2YgcGFja2VkIHh5eiBwb2ludCBwb3NpdGlvbnMuICovXG4gIHNldFBvaW50UG9zaXRpb25zKHdvcmxkU3BhY2VQb2ludFBvc2l0aW9uczogRmxvYXQzMkFycmF5LCByZWFsRGF0YU51bWJlcjogbnVtYmVyKSB7XG4gICAgdGhpcy53b3JsZFNwYWNlUG9pbnRQb3NpdGlvbnMgPSB3b3JsZFNwYWNlUG9pbnRQb3NpdGlvbnM7XG4gICAgdGhpcy52aXN1YWxpemVycy5mb3JFYWNoKCh2KSA9PlxuICAgICAgdi5vblBvaW50UG9zaXRpb25zQ2hhbmdlZCh3b3JsZFNwYWNlUG9pbnRQb3NpdGlvbnMpXG4gICAgKTtcbiAgICB0aGlzLnJlYWxEYXRhTnVtYmVyID0gcmVhbERhdGFOdW1iZXI7XG4gIH1cbiAgcmVuZGVyKCkge1xuICAgIHtcbiAgICAgIGNvbnN0IGxpZ2h0UG9zID0gdGhpcy5jYW1lcmEucG9zaXRpb24uY2xvbmUoKTtcbiAgICAgIGxpZ2h0UG9zLnggKz0gMTtcbiAgICAgIGxpZ2h0UG9zLnkgKz0gMTtcbiAgICAgIHRoaXMubGlnaHQucG9zaXRpb24uc2V0KGxpZ2h0UG9zLngsIGxpZ2h0UG9zLnksIGxpZ2h0UG9zLnopO1xuICAgIH1cbiAgICBjb25zdCBjYW1lcmFUeXBlID1cbiAgICAgIHRoaXMuY2FtZXJhIGluc3RhbmNlb2YgVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmFcbiAgICAgICAgPyBDYW1lcmFUeXBlLlBlcnNwZWN0aXZlXG4gICAgICAgIDogQ2FtZXJhVHlwZS5PcnRob2dyYXBoaWM7XG4gICAgbGV0IGNhbWVyYVNwYWNlUG9pbnRFeHRlbnRzOiBbbnVtYmVyLCBudW1iZXJdID0gWzAsIDBdO1xuICAgIGlmICh0aGlzLndvcmxkU3BhY2VQb2ludFBvc2l0aW9ucyAhPSBudWxsKSB7XG4gICAgICBjYW1lcmFTcGFjZVBvaW50RXh0ZW50cyA9IHV0aWwuZ2V0TmVhckZhclBvaW50cyhcbiAgICAgICAgdGhpcy53b3JsZFNwYWNlUG9pbnRQb3NpdGlvbnMsXG4gICAgICAgIHRoaXMuY2FtZXJhLnBvc2l0aW9uLFxuICAgICAgICB0aGlzLm9yYml0Q2FtZXJhQ29udHJvbHMudGFyZ2V0XG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCByYyA9IG5ldyBSZW5kZXJDb250ZXh0KFxuICAgICAgdGhpcy5jYW1lcmEsXG4gICAgICBjYW1lcmFUeXBlLFxuICAgICAgdGhpcy5vcmJpdENhbWVyYUNvbnRyb2xzLnRhcmdldCxcbiAgICAgIHRoaXMud2lkdGgsXG4gICAgICB0aGlzLmhlaWdodCxcbiAgICAgIGNhbWVyYVNwYWNlUG9pbnRFeHRlbnRzWzBdLFxuICAgICAgY2FtZXJhU3BhY2VQb2ludEV4dGVudHNbMV0sXG4gICAgICB0aGlzLmJhY2tncm91bmRDb2xvcixcbiAgICAgIHRoaXMucG9pbnRDb2xvcnMsXG4gICAgICB0aGlzLnBvaW50U2NhbGVGYWN0b3JzLFxuICAgICAgdGhpcy5sYWJlbHMsXG4gICAgICB0aGlzLnBvbHlsaW5lQ29sb3JzLFxuICAgICAgdGhpcy5wb2x5bGluZU9wYWNpdGllcyxcbiAgICAgIHRoaXMucG9seWxpbmVXaWR0aHNcbiAgICApO1xuICAgIC8vIFJlbmRlciBmaXJzdCBwYXNzIHRvIHBpY2tpbmcgdGFyZ2V0LiBUaGlzIHJlbmRlciBmaWxscyBwaWNraW5nVGV4dHVyZVxuICAgIC8vIHdpdGggY29sb3JzIHRoYXQgYXJlIGFjdHVhbGx5IHBvaW50IGlkcywgc28gdGhhdCBzYW1wbGluZyB0aGUgdGV4dHVyZSBhdFxuICAgIC8vIHRoZSBtb3VzZSdzIGN1cnJlbnQgeCx5IGNvb3JkaW5hdGVzIHdpbGwgcmV2ZWFsIHRoZSBkYXRhIHBvaW50IHRoYXQgdGhlXG4gICAgLy8gbW91c2UgaXMgb3Zlci5cbiAgICB0aGlzLnZpc3VhbGl6ZXJzLmZvckVhY2goKHYpID0+IHYub25QaWNraW5nUmVuZGVyKHJjKSk7XG4gICAge1xuICAgICAgY29uc3QgYXhlcyA9IHRoaXMucmVtb3ZlM2RBeGlzRnJvbVNjZW5lKCk7XG4gICAgICAvLyBSZW5kZXIgdG8gdGhlIHBpY2tpbmdUZXh0dXJlIHdoZW4gZXhpc3RpbmcuXG4gICAgICBpZiAodGhpcy5waWNraW5nVGV4dHVyZSkge1xuICAgICAgICB0aGlzLnJlbmRlcmVyLnNldFJlbmRlclRhcmdldCh0aGlzLnBpY2tpbmdUZXh0dXJlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuc2V0UmVuZGVyVGFyZ2V0KG51bGwpO1xuICAgICAgfVxuICAgICAgdGhpcy5yZW5kZXJlci5yZW5kZXIodGhpcy5zY2VuZSwgdGhpcy5jYW1lcmEpO1xuICAgICAgLy8gU2V0IHRoZSByZW5kZXJUYXJnZXQgYmFjayB0byB0aGUgZGVmYXVsdC5cbiAgICAgIHRoaXMucmVuZGVyZXIuc2V0UmVuZGVyVGFyZ2V0KG51bGwpO1xuICAgICAgaWYgKGF4ZXMgIT0gbnVsbCkge1xuICAgICAgICB0aGlzLnNjZW5lLmFkZChheGVzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gUmVuZGVyIHNlY29uZCBwYXNzIHRvIGNvbG9yIGJ1ZmZlciwgdG8gYmUgZGlzcGxheWVkIG9uIHRoZSBjYW52YXMuXG4gICAgdGhpcy52aXN1YWxpemVycy5mb3JFYWNoKCh2KSA9PiB2Lm9uUmVuZGVyKHJjKSk7XG4gICAgdGhpcy5yZW5kZXJlci5yZW5kZXIodGhpcy5zY2VuZSwgdGhpcy5jYW1lcmEpO1xuICB9XG4gIHNldE1vdXNlTW9kZShtb3VzZU1vZGU6IE1vdXNlTW9kZSkge1xuICAgIHRoaXMubW91c2VNb2RlID0gbW91c2VNb2RlO1xuICAgIGlmIChtb3VzZU1vZGUgPT09IE1vdXNlTW9kZS5BUkVBX1NFTEVDVCkge1xuICAgICAgdGhpcy5zZWxlY3RpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5jb250YWluZXIuc3R5bGUuY3Vyc29yID0gJ2Nyb3NzaGFpcic7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2VsZWN0aW5nID0gZmFsc2U7XG4gICAgICB0aGlzLmNvbnRhaW5lci5zdHlsZS5jdXJzb3IgPSAnZGVmYXVsdCc7XG4gICAgfVxuICB9XG4gIC8qKiBTZXQgdGhlIGNvbG9ycyBmb3IgZXZlcnkgZGF0YSBwb2ludC4gKFJHQiB0cmlwbGV0cykgKi9cbiAgc2V0UG9pbnRDb2xvcnMoY29sb3JzOiBGbG9hdDMyQXJyYXkpIHtcbiAgICB0aGlzLnBvaW50Q29sb3JzID0gY29sb3JzO1xuICB9XG4gIC8qKiBTZXQgdGhlIHNjYWxlIGZhY3RvcnMgZm9yIGV2ZXJ5IGRhdGEgcG9pbnQuIChzY2FsYXJzKSAqL1xuICBzZXRQb2ludFNjYWxlRmFjdG9ycyhzY2FsZUZhY3RvcnM6IEZsb2F0MzJBcnJheSkge1xuICAgIHRoaXMucG9pbnRTY2FsZUZhY3RvcnMgPSBzY2FsZUZhY3RvcnM7XG4gIH1cbiAgLyoqIFNldCB0aGUgbGFiZWxzIHRvIHJlbmRlcmVkICovXG4gIHNldExhYmVscyhsYWJlbHM6IExhYmVsUmVuZGVyUGFyYW1zKSB7XG4gICAgdGhpcy5sYWJlbHMgPSBsYWJlbHM7XG4gIH1cbiAgLyoqIFNldCB0aGUgY29sb3JzIGZvciBldmVyeSBkYXRhIHBvbHlsaW5lLiAoUkdCIHRyaXBsZXRzKSAqL1xuICBzZXRQb2x5bGluZUNvbG9ycyhjb2xvcnM6IHsgW3BvbHlsaW5lSW5kZXg6IG51bWJlcl06IEZsb2F0MzJBcnJheSB9KSB7XG4gICAgdGhpcy5wb2x5bGluZUNvbG9ycyA9IGNvbG9ycztcbiAgfVxuICBzZXRQb2x5bGluZU9wYWNpdGllcyhvcGFjaXRpZXM6IEZsb2F0MzJBcnJheSkge1xuICAgIHRoaXMucG9seWxpbmVPcGFjaXRpZXMgPSBvcGFjaXRpZXM7XG4gIH1cbiAgc2V0UG9seWxpbmVXaWR0aHMod2lkdGhzOiBGbG9hdDMyQXJyYXkpIHtcbiAgICB0aGlzLnBvbHlsaW5lV2lkdGhzID0gd2lkdGhzO1xuICB9XG4gIGdldE1vdXNlTW9kZSgpOiBNb3VzZU1vZGUge1xuICAgIHJldHVybiB0aGlzLm1vdXNlTW9kZTtcbiAgfVxuICByZXNldFpvb20oKSB7XG4gICAgdGhpcy5yZWNyZWF0ZUNhbWVyYSh0aGlzLm1ha2VEZWZhdWx0Q2FtZXJhRGVmKHRoaXMuZGltZW5zaW9uYWxpdHkpKTtcbiAgICB0aGlzLnJlbmRlcigpO1xuICB9XG4gIHNldERheU5pZ2h0TW9kZShpc05pZ2h0OiBib29sZWFuKSB7XG4gICAgY29uc3QgY2FudmFzZXMgPSB0aGlzLmNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCdjYW52YXMnKTtcbiAgICBjb25zdCBmaWx0ZXJWYWx1ZSA9IGlzTmlnaHQgPyAnaW52ZXJ0KDEwMCUpJyA6IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjYW52YXNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgY2FudmFzZXNbaV0uc3R5bGUuZmlsdGVyID0gZmlsdGVyVmFsdWU7XG4gICAgfVxuICB9XG4gIHJlc2l6ZShyZW5kZXIgPSB0cnVlKSB7XG4gICAgY29uc3QgW29sZFcsIG9sZEhdID0gW3RoaXMud2lkdGgsIHRoaXMuaGVpZ2h0XTtcbiAgICBjb25zdCBbbmV3VywgbmV3SF0gPSB0aGlzLmdldExheW91dFZhbHVlcygpO1xuICAgIGlmICh0aGlzLmRpbWVuc2lvbmFsaXR5ID09PSAzKSB7XG4gICAgICBjb25zdCBjYW1lcmEgPSB0aGlzLmNhbWVyYSBhcyBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYTtcbiAgICAgIGNhbWVyYS5hc3BlY3QgPSBuZXdXIC8gbmV3SDtcbiAgICAgIGNhbWVyYS51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGNhbWVyYSA9IHRoaXMuY2FtZXJhIGFzIFRIUkVFLk9ydGhvZ3JhcGhpY0NhbWVyYTtcbiAgICAgIC8vIFNjYWxlIHRoZSBvcnRobyBmcnVzdHVtIGJ5IGhvd2V2ZXIgbXVjaCB0aGUgd2luZG93IGNoYW5nZWQuXG4gICAgICBjb25zdCBzY2FsZVcgPSBuZXdXIC8gb2xkVztcbiAgICAgIGNvbnN0IHNjYWxlSCA9IG5ld0ggLyBvbGRIO1xuICAgICAgY29uc3QgbmV3Q2FtSGFsZldpZHRoID0gKChjYW1lcmEucmlnaHQgLSBjYW1lcmEubGVmdCkgKiBzY2FsZVcpIC8gMjtcbiAgICAgIGNvbnN0IG5ld0NhbUhhbGZIZWlnaHQgPSAoKGNhbWVyYS50b3AgLSBjYW1lcmEuYm90dG9tKSAqIHNjYWxlSCkgLyAyO1xuICAgICAgY2FtZXJhLnRvcCA9IG5ld0NhbUhhbGZIZWlnaHQ7XG4gICAgICBjYW1lcmEuYm90dG9tID0gLW5ld0NhbUhhbGZIZWlnaHQ7XG4gICAgICBjYW1lcmEubGVmdCA9IC1uZXdDYW1IYWxmV2lkdGg7XG4gICAgICBjYW1lcmEucmlnaHQgPSBuZXdDYW1IYWxmV2lkdGg7XG4gICAgICBjYW1lcmEudXBkYXRlUHJvamVjdGlvbk1hdHJpeCgpO1xuICAgIH1cbiAgICAvLyBBY2NvdXRpbmcgZm9yIHJldGluYSBkaXNwbGF5cy5cbiAgICBjb25zdCBkcHIgPSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyB8fCAxO1xuICAgIHRoaXMucmVuZGVyZXIuc2V0UGl4ZWxSYXRpbyhkcHIpO1xuICAgIHRoaXMucmVuZGVyZXIuc2V0U2l6ZShuZXdXLCBuZXdIKTtcbiAgICAvLyB0aGUgcGlja2luZyB0ZXh0dXJlIG5lZWRzIHRvIGJlIGV4YWN0bHkgdGhlIHNhbWUgYXMgdGhlIHJlbmRlciB0ZXh0dXJlLlxuICAgIHtcbiAgICAgIGNvbnN0IHJlbmRlckNhbnZhc1NpemUgPSBuZXcgVEhSRUUuVmVjdG9yMigpO1xuICAgICAgLy8gVE9ETyhzdGVwaGFud2xlZSk6IFJlbW92ZSBjYXN0aW5nIHRvIGFueSBhZnRlciB0aHJlZS5qcyB0eXBpbmcgaXNcbiAgICAgIC8vIHByb3Blci5cbiAgICAgICh0aGlzLnJlbmRlcmVyIGFzIGFueSkuZ2V0U2l6ZShyZW5kZXJDYW52YXNTaXplKTtcbiAgICAgIGNvbnN0IHBpeGVsUmF0aW8gPSB0aGlzLnJlbmRlcmVyLmdldFBpeGVsUmF0aW8oKTtcbiAgICAgIHRoaXMucGlja2luZ1RleHR1cmUgPSBuZXcgVEhSRUUuV2ViR0xSZW5kZXJUYXJnZXQoXG4gICAgICAgIHJlbmRlckNhbnZhc1NpemUud2lkdGggKiBwaXhlbFJhdGlvLFxuICAgICAgICByZW5kZXJDYW52YXNTaXplLmhlaWdodCAqIHBpeGVsUmF0aW9cbiAgICAgICk7XG4gICAgICB0aGlzLnBpY2tpbmdUZXh0dXJlLnRleHR1cmUubWluRmlsdGVyID0gVEhSRUUuTGluZWFyRmlsdGVyO1xuICAgIH1cbiAgICB0aGlzLnZpc3VhbGl6ZXJzLmZvckVhY2goKHYpID0+IHYub25SZXNpemUobmV3VywgbmV3SCkpO1xuICAgIGlmIChyZW5kZXIpIHtcbiAgICAgIHRoaXMucmVuZGVyKCk7XG4gICAgfVxuICB9XG4gIG9uQ2FtZXJhTW92ZShsaXN0ZW5lcjogT25DYW1lcmFNb3ZlTGlzdGVuZXIpIHtcbiAgICB0aGlzLm9uQ2FtZXJhTW92ZUxpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcbiAgfVxuICBjbGlja09uUG9pbnQocG9pbnRJbmRleDogbnVtYmVyKSB7XG4gICAgdGhpcy5uZWFyZXN0UG9pbnQgPSBwb2ludEluZGV4O1xuICAgIHRoaXMub25DbGljayhudWxsLCBmYWxzZSk7XG4gIH1cbn1cbiJdfQ==