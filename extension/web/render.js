/** render the canvas and timeline */
const BACKGROUND_COLOR = 0xffffff;
// Constants relating to the camera parameters.
const PERSP_CAMERA_FOV_VERTICAL = 70;
const PERSP_CAMERA_NEAR_CLIP_PLANE = 0.01;
const PERSP_CAMERA_FAR_CLIP_PLANE = 100;
const ORTHO_CAMERA_FRUSTUM_HALF_EXTENT = 1.2;
const MIN_ZOOM_SCALE = 0.2;
const MAX_ZOOM_SCALE = 60;
const NORMAL_SIZE = 10;
const HOVER_SIZE = 20;
const SELECTED_SIZE = 15;
const GRAY = [0.8, 0.8, 0.8];
const selectedLabel = 'fixedHoverLabel';
let baseZoomSpeed = 0.01;
let isDragging = false;
let previousMousePosition = {
    x: 0,
    y: 0
};
let lockIndex = false;


// <https://threejs.org/manual/#en/responsive>
function __resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const pixelRatio = window.devicePixelRatio;
    const width  = Math.floor( canvas.clientWidth / 2  * pixelRatio );
    const height = Math.floor( canvas.clientHeight / 2 * pixelRatio );
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
        renderer.setSize(width, height, false);
    }
    return needResize;
}

function __resizeViewport(renderer) {
    if (__resizeRendererToDisplaySize(renderer)) {
        // keep a square viewport in the middle
        const sizeV2 = new THREE.Vector2();
        renderer.getSize(sizeV2);
        const viewportSize = Math.min(sizeV2.x, sizeV2.y);
        renderer.setViewport((sizeV2.x - viewportSize) / 2, (sizeV2.y - viewportSize) / 2, viewportSize, viewportSize);
    }
}

class PlotCanvas {
    constructor(vueApp) {
        // bind attributes to a vue app
        this.vueApp = vueApp;
        this.eventListeners = [];
    }

    // bind to a container, initiating a scene in it
    bindTo(container) {
        container.innerHTML = "";
        this.container = container;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setClearColor(BACKGROUND_COLOR, 1);
        this.renderer = renderer;
        
        container.appendChild(renderer.domElement);
        __resizeViewport(renderer);
        window.addEventListener('resize', () => {
            __resizeViewport(renderer);
        });
    }

    plotDataPoints(visData) {
        window.vueApp.res = visData;

        const boundary = {
            x_min: visData.grid_index[0],
            y_min: visData.grid_index[1],
            x_max: visData.grid_index[2],
            y_max: visData.grid_index[3]
        };

        this.__updatePlotBoundary(boundary);
        this.__initScene();
        this.__initCamera();
        this.__putPlane(visData.grid_color);
        this.__putDataPoints(visData);
        this.__addControls();
        this.__syncAttributesToVueApp();
    }

    __syncAttributesToVueApp() {
        this.vueApp.renderer = this.renderer;
        this.vueApp.scene = this.scene;
        this.vueApp.camera = this.camera;
        this.vueApp.pointsMesh = this.pointsMesh;
    }

    render() {
        const animate = () => {
            this.vueApp.animationFrameId = requestAnimationFrame(animate);
            this.renderer.render(this.scene, this.camera);
        }
        animate();
    }

    clear() {
        this.eventListeners.forEach((e) => {
            const [type, listener] = e;
            this.container?.removeEventListener(type, listener);
        })
        this.eventListeners.length = 0;
    }

    __updatePlotBoundary(boundary) {
        this.boundary = boundary;
        // Object.assign(this.sceneBoundary, boundary);
    }

    __initScene() {
        this.scene = new THREE.Scene();

        // render scene as all-white
        let ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);
    }

    __initCamera() {
        const rect = this.container.getBoundingClientRect();
        let aspectRatio = rect.width / rect.height;

        const camera = new THREE.OrthographicCamera(
            this.boundary.x_min * aspectRatio,
            this.boundary.x_max * aspectRatio,
            this.boundary.y_max,
            this.boundary.y_min,
            1, 1000);

        const init_x = (this.boundary.x_max + this.boundary.x_min) / 2;
        const init_y = (this.boundary.y_max + this.boundary.y_min) / 2;
        camera.position.set(init_x, init_y, 100);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        this.camera = camera;
    }

    __putPlane(color) {
        let width = this.boundary.x_max - this.boundary.x_min;
        let height = this.boundary.y_max - this.boundary.y_min;
        let centerX = this.boundary.x_min + width / 2;
        let centerY = this.boundary.y_min + height / 2;

        this.__createPureColorTexture(color, (texture) => {
            let material = new THREE.MeshPhongMaterial({
                map: texture,
                side: THREE.DoubleSide
            });
            let plane_geometry = new THREE.PlaneGeometry(width, height);
            let newMesh = new THREE.Mesh(plane_geometry, material);
            newMesh.position.set(centerX, centerY, 0);
            this.scene.add(newMesh);
        })
    }

    __putDataPoints(visData) {
        // FIXME label_color_list is used in rendering, so color_list does not work anymore. Should accord to which?
        const geoData = visData.result;
        this.geoData = geoData;

        let color = visData.label_list.map((x) => visData.color_list[parseInt(x)]);
        let position = [];
        let colors = [];
        let sizes = [];
        let alphas = [];

        geoData.forEach(function (point, i) {
            position.push(point[0], point[1], 0);
            colors.push(color[i][0] / 255, color[i][1] / 255, color[i][2] / 255);
            sizes.push(NORMAL_SIZE);
            alphas.push(1.0);
        });
        // console.log("datapoints", geoData.length);

        let geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
        geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));

        let shaderMaterial = this.__getDefaultPointShaderMaterial();

        this.pointsMesh = new THREE.Points(geometry, shaderMaterial);
        this.__savePointMeshSettings();
        this.__updateSelectedPoint();

        this.scene.add(this.pointsMesh);
    }

    __addControls() {
        this.__addClassicMapControl();
        this.__addHoverRevealing();
        this.__addDoubleClickLocking();

        this.__addFilterTestTrain();
        this.__addHighlight();
    }

    __createPureColorTexture(color, callback) {
        let canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        let ctx = canvas.getContext("2d");
        // load pure-color image into the canvas, then us it as a texture
        let img = new Image();
        img.src = color;   // NOTE this seems to be all black returned from backend
        img.crossOrigin = "anonymous";
        img.onload = () => {
            ctx.drawImage(img, 0, 0, 128, 128);
            let texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            callback(texture);
        };
    }

    __registerContainerEventListener(type, listener) {
        this.renderer.domElement.addEventListener(type, listener.bind(this));
        this.eventListeners.push([type, listener]);
    }

    __addClassicMapControl() {
        this.__addWheelZooming();
        this.__addMouseDragging();
    }

    __addWheelZooming() {
        const changeZoom = (event, camera) => {
            const currentZoom = camera.zoom;
            // Assume newZoom = a * b^(times + x0), then a * b^x0 = MIN_ZOOM_SCALE
            const a = 1.0;
            const b = 1.1;
            const x = Math.log(currentZoom / a) / Math.log(b);
            const g = 100;
            const new_x = x - event.deltaY / g;  // wheels down, deltaY is positive, but scaling going down
            let newZoom = a * Math.pow(b, new_x);
            newZoom = Math.max(MIN_ZOOM_SCALE, Math.min(newZoom, MAX_ZOOM_SCALE));
            camera.zoom = newZoom;
            this.__moveCameraWithinRange(camera);
            camera.updateProjectionMatrix();
        }

        this.__registerContainerEventListener('wheel', (event) => {
            changeZoom(event, this.camera);
            event.preventDefault();
        });
    }

    __addMouseDragging() {
        let isDragging = false;

        this.__registerContainerEventListener('mousedown', function (e) {
            if (this.vueApp.SelectionMode && this.vueApp.isShifting) {

            } else {
                isDragging = true;
                if (this.container.style.cursor != 'pointer') {
                    this.container.style.cursor = 'move';
                }
                previousMousePosition.x = e.clientX;
                previousMousePosition.y = e.clientY;
            }
        });

        // handel mouse move
        this.__registerContainerEventListener('mousemove', function (e) {
            if (isDragging) {
                const currentZoom = this.camera.zoom;

                const mouseDeltaX = e.clientX - previousMousePosition.x;
                const mouseDeltaY = e.clientY - previousMousePosition.y;

                const viewportWidth = this.renderer.domElement.clientWidth;
                const viewportHeight = this.renderer.domElement.clientHeight;

                // Scale factors
                const scaleX = (this.camera.right - this.camera.left) / viewportWidth;
                const scaleY = (this.camera.top - this.camera.bottom) / viewportHeight;

                // Convert pixel movement to world units
                const deltaX = (mouseDeltaX * scaleX) / currentZoom;
                const deltaY = (mouseDeltaY * scaleY) / currentZoom;

                // Update the camera position based on the scaled delta
                let newPosX = this.camera.position.x - deltaX * 1;
                let newPosY = this.camera.position.y + deltaY * 1;

                this.__moveCameraWithinRange(this.camera, newPosX, newPosY);

                // update previous mouse position
                previousMousePosition = {
                    x: e.clientX,
                    y: e.clientY
                };
                updateCurrHoverIndex(e, null, true, '');
            }
        });

        // mouse up event
        this.__registerContainerEventListener('mouseup', function (e) {
            isDragging = false;
            this.container.style.cursor = 'default';
        });
    }

    __getDefaultPointShaderMaterial() {
        return new THREE.ShaderMaterial({
            uniforms: {
                texture: { type: 't' },
                spritesPerRow: { type: 'f' },
                spritesPerColumn: { type: 'f' },
                color: { type: 'c' },
                fogNear: { type: 'f' },
                fogFar: { type: 'f' },
                isImage: { type: 'bool' },
                sizeAttenuation: { type: 'bool' },
                PointSize: { type: 'f' },
            },
            vertexShader: `
            attribute float size;
            attribute float alpha;
            varying vec3 vColor;
            varying float vAlpha; 

            void main() {
                vColor = color;
                vAlpha = alpha; 
                gl_PointSize = size;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
            fragmentShader: `
            varying vec3 vColor;
            varying float vAlpha; // Receive alpha from vertex shader

            void main() {
                float r = distance(gl_PointCoord, vec2(0.5, 0.5));
                if (r > 0.5) {
                    discard;
                }
                if (vAlpha < 0.5) discard;
                gl_FragColor = vec4(vColor, 0.6); 
            }`,
            transparent: true,
            vertexColors: true,
            depthTest: false,
            depthWrite: false,
            fog: true,
            blending: THREE.MultiplyBlending,
        });
    }

    __savePointMeshSettings() {
        if (this.pointsMesh.geometry.getAttribute('size')) {
            this.vueApp.originalSettings.originalSizes = Array.from(this.pointsMesh.geometry.getAttribute('size').array);
        }

        if (this.pointsMesh.geometry.getAttribute('color')) {
            this.vueApp.originalSettings.originalColors = Array.from(this.pointsMesh.geometry.getAttribute('color').array);
        }
    }

    __updateSelectedPoint() {
        if (this.vueApp.selectedIndex) {
            this.pointsMesh.geometry.attributes.size.array[this.vueApp.selectedIndex] = HOVER_SIZE;
            let pointPosition = new THREE.Vector3();
            pointPosition.fromBufferAttribute(this.pointsMesh.geometry.attributes.position, this.vueApp.selectedIndex);
            this.vueApp.selectedPointPosition = pointPosition;
            this.pointsMesh.geometry.attributes.size.needsUpdate = true;
        }
    }

    __addHoverRevealing() {
        let raycaster = new THREE.Raycaster();
        raycaster.params.Points.threshold = 0.1 / this.camera.zoom;

        let mouse = new THREE.Vector2();
        
        const updateLastHoverIndexSize = (lastHoveredIndex, selectedIndex, visualizationError, nnIndices) => {
            if (lastHoveredIndex != null) {
                let isNormalSize = true;
                if (selectedIndex != null) {
                    if (lastHoveredIndex == selectedIndex) {
                        isNormalSize = false;
                    }
                }
                if (visualizationError != null) {
                    let isInsideVisError = visualizationError.has(lastHoveredIndex);
                    if (isInsideVisError) {
                        isNormalSize = false;
                    }
                }
                if (isNormalSize) {
                    this.pointsMesh.geometry.attributes.size.array[lastHoveredIndex] = NORMAL_SIZE;
                } else {
                    this.pointsMesh.geometry.attributes.size.array[lastHoveredIndex] = HOVER_SIZE;
                }
                nnIndices.forEach((item, index) => {
                    this.pointsMesh.geometry.attributes.size.array[item] = NORMAL_SIZE;
                });
            }
        }

        function onMouseMove(event, isDown = false) {
            this.vueApp.selectedIndex.forEach(index => {
                this.pointsMesh.geometry.getAttribute('size').array[index] = SELECTED_SIZE;
            });
            this.pointsMesh.geometry.getAttribute('size').needsUpdate = true;
            // TODO consider adjusting the threshold according to monitor size and resolution
            
            let { left: canvasLeft, top: canvasTop } = this.renderer.domElement.getBoundingClientRect();
            let { x: offsetX, y: offsetY, z: viewportWidth, w: viewportHeight } = this.renderer.getViewport(new THREE.Vector4());
            
            const mouseX = event.clientX - canvasLeft;
            const mouseY = event.clientY - canvasTop;

            const canvasHeight = this.renderer.domElement.clientHeight;
            const viewportTopY = canvasHeight - offsetY - viewportHeight;

            const viewportMouseX = mouseX - offsetX;
            const viewportMouseY = mouseY - viewportTopY;
    
            mouse.x = (viewportMouseX / viewportWidth) * 2 - 1;
            mouse.y = - (viewportMouseY / viewportHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, this.camera);
            let intersects = raycaster.intersectObject(this.pointsMesh);
            let specifiedLastHoveredIndex = makeSpecifiedVariableName('lastHoveredIndex', '');
            let specifiedImageSrc = makeSpecifiedVariableName('imageSrc', '');
            let specifiedSelectedIndex = makeSpecifiedVariableName('selectedIndex', '');
            let specifiedHighlightAttributes = makeSpecifiedVariableName('highlightAttributes', '');

            let lockedBefore = true;
            if (isDown) {
                lockedBefore = lockIndex;
                lockIndex = false;  // unlock index, then continue mouse hover handling to lock another index unconditionally
                // note that if lockedBefore and the same point is clicked again, we will not lock it again
            }

            if (intersects.length > 0 && checkVisibility(this.pointsMesh.geometry.attributes.alpha.array, intersects[0].index)) {

                this.container.style.cursor = 'pointer';

                // 获取最接近的交点
                let intersect = intersects[0];

                // 获取索引 - 这需要根据具体实现来确定如何获取
                let ind = intersect.index;
                if (this.vueApp.curIndex != ind && !lockIndex) {
                    this.vueApp.curIndex = ind;    // curIndex is the one among what is filtered, but lastHoveredIndex is the real index among all
                }

                let index;
                if (this.vueApp.filter_index != '') {
                    console.log("this.vueApp.filter_index", this.vueApp.filter_index);
                    filter_index = this.vueApp.filter_index.split(',');
                    index = filter_index[ind];
                } else {
                    index = ind;
                }

                if (this.vueApp.selectedIndex.includes(index)) {
                    return;
                }

                // 在这里处理悬停事件
                if (this.vueApp.lastHoveredIndex != index && !lockIndex) {
                    updateLastHoverIndexSize(this.vueApp[specifiedLastHoveredIndex], this.vueApp[specifiedSelectedIndex],
                        this.vueApp[specifiedHighlightAttributes].visualizationError, this.vueApp.nnIndices);
                    this.pointsMesh.geometry.attributes.size.array[index] = HOVER_SIZE;
                    this.pointsMesh.geometry.attributes.size.needsUpdate = true;
                    this.vueApp[specifiedLastHoveredIndex] = index;
                    updateCurrHoverIndex(event, index, false, '');

                    // // TODO this is for experiment only, find another way to link code and comment pair as soon as possible
                    // // link the pair
                    // const selectPoint = (idx) => {
                    //     let positionAttribute = this.pointsMesh.geometry.attributes.position;
                    //     let x = positionAttribute.getX(idx);
                    //     let y = positionAttribute.getY(idx);
                    //     let z = positionAttribute.getZ(idx);
                    //     return { x: x, y: y, z: z };
                    // };
                    // const selectMappingIndex = (idx) => (idx + this.geoData.length / 2) % this.geoData.length;
                    // const originalPoint = selectPoint(index);
                    // const pairedPoint = selectPoint(selectMappingIndex(index));
                    // let points = [];
                    // points.push(new THREE.Vector3(originalPoint.x, originalPoint.y, originalPoint.z));
                    // points.push(new THREE.Vector3(pairedPoint.x, pairedPoint.y, pairedPoint.z)); // Adjust the end point as needed
                    // // bound to scene, or the line will disappear on switching epoch
                    // if (!this.scene.hoverLine) {
                    //     let material = new THREE.LineBasicMaterial({ color: 0xaaaaaa });
                    //     let geometry = new THREE.BufferGeometry().setFromPoints(points);
                    //     this.scene.hoverLine = new THREE.Line(geometry, material);
                    //     this.scene.add(this.scene.hoverLine);
                    // } else {
                    //     this.scene.hoverLine.geometry.setFromPoints(points);
                    // }

                    if (isDown) {
                        lockIndex = true;
                    }
                } else if (!lockedBefore) {
                    lockIndex = true;
                }
            } else {
                if (this.container.style.cursor !== 'move') {
                    this.container.style.cursor = 'default';
                }
                // 如果没有悬停在任何点上，也重置上一个点的大小
                if (this.vueApp.lastHoveredIndex !== null && !lockIndex) {
                    updateLastHoverIndexSize(this.vueApp[specifiedLastHoveredIndex], this.vueApp[specifiedSelectedIndex],
                        this.vueApp[specifiedHighlightAttributes].visualizationError, this.vueApp.nnIndices);
                    this.pointsMesh.geometry.attributes.size.needsUpdate = true;
                    this.vueApp.nnIndices = [];
                    this.vueApp[specifiedLastHoveredIndex] = null;
                    this.vueApp[specifiedImageSrc] = "";
                    updateCurrHoverIndex(event, null, false, '');
                    if (this.scene.hoverLine) {
                        this.scene.remove(this.scene.hoverLine);
                        this.scene.hoverLine.geometry?.dispose();
                        this.scene.hoverLine.material?.dispose();
                        this.scene.hoverLine = undefined;
                    }
                }
            }
        }

        this.__registerContainerEventListener('mousemove', onMouseMove);
        // FIXME click-to-lock logic was mixed into the logic of mousemove
        this.__registerContainerEventListener('click', (e) => { onMouseMove.call(this, e, true); });    
    }

    __addDoubleClickLocking() {
        function onDoubleClick(event) {
            // Raycasting to find the intersected point
            let rect = this.renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, this.camera);
            let intersects = raycaster.intersectObject(this.pointsMesh);

            if (intersects.length > 0 && checkVisibility(this.pointsMesh.geometry.attributes.alpha.array, intersects[0].index)) {
                if (this.vueApp.selectedIndex != null) {
                    this.pointsMesh.geometry.attributes.size.array[this.vueApp.selectedIndex] = NORMAL_SIZE;
                    this.pointsMesh.geometry.attributes.size.needsUpdate = true;
                }
                // Get the index and position of the double-clicked point
                let intersect = intersects[0];
                if (this.vueApp.selectedIndex.includes(intersect.index)) {
                    return;
                }
                console.log("this.vueApp.selectedIndex", this.vueApp.selectedIndex);
                this.vueApp.selectedIndex.push(intersect.index);
                console.log("this.vueApp.selectedIndex after push", this.vueApp.selectedIndex);

                let camera = this.camera;
                let canvas = this.renderer.domElement;
                console.log("this.vueApp.selectedInde", this.vueApp.selectedPointPos);

                let vector = intersect.point.clone().project(camera);


                vector.x = Math.round((vector.x * 0.5 + 0.5) * canvas.clientWidth);
                vector.y = - Math.round((vector.y * 0.5 - 0.5) * canvas.clientHeight);

                let rect = canvas.getBoundingClientRect();
                vector.x += rect.left;
                vector.y += rect.top;

                this.vueApp.selectedPointPos.push({ 'x': vector.x, 'y': vector.y });
                console.log("this.vueApp.selectedIndex after push", this.vueApp.selectedPointPos);
                //   this.pointsMesh.geometry.attributes.size.array[this.vueApp.selectedIndex] = HOVER_SIZE; 
                this.vueApp.selectedIndex.forEach(index => {
                    this.pointsMesh.geometry.getAttribute('size').array[index] = SELECTED_SIZE;
                });
                this.pointsMesh.geometry.getAttribute('size').needsUpdate = true;
            }
        }

        this.__registerContainerEventListener('dblclick', onDoubleClick);
    }

    __addFilterTestTrain() {
        let specifiedShowTesting = makeSpecifiedVariableName('showTesting', '');
        let specifiedShowTraining = makeSpecifiedVariableName('showTraining', '');
        let specifiedPredictionFlipIndices = makeSpecifiedVariableName('predictionFlipIndices', '');
        // let specifiedOriginalSettings = makeSpecifiedVariableName('originalSettings', '')

        const updateCurrentDisplay = () => {
            console.log("currDisplay");
            let specifiedTrainIndex = makeSpecifiedVariableName('train_index', '');
            let specifiedTestIndex = makeSpecifiedVariableName('test_index', '');

            this.pointsMesh.geometry.attributes.alpha.array = updateShowingIndices(this.pointsMesh.geometry.attributes.alpha.array, this.vueApp[specifiedShowTraining], this.vueApp[specifiedTrainIndex], this.vueApp[specifiedPredictionFlipIndices]);
            this.pointsMesh.geometry.attributes.alpha.array = updateShowingIndices(this.pointsMesh.geometry.attributes.alpha.array, this.vueApp[specifiedShowTesting], this.vueApp[specifiedTestIndex], this.vueApp[specifiedPredictionFlipIndices]);

            // update position z index to allow currDisplay indices show above 
            for (let i = 0; i < this.pointsMesh.geometry.attributes.alpha.array.length; i++) {
                let zIndex = i * 3 + 2;
                this.pointsMesh.geometry.attributes.position.array[zIndex] = this.pointsMesh.geometry.attributes.alpha.array[i] === 1 ? 0 : -1;
            }


            this.pointsMesh.geometry.attributes.position.needsUpdate = true;
            this.pointsMesh.geometry.attributes.alpha.needsUpdate = true;
        }

        this.vueApp.$watch(specifiedShowTesting, updateCurrentDisplay);
        this.vueApp.$watch(specifiedShowTraining, updateCurrentDisplay);
        this.vueApp.$watch(specifiedPredictionFlipIndices, updateCurrentDisplay);
        // this.vueApp.$watch(specifiedOriginalSettings, resetToOriginalColorSize, { deep: true });
    }

    __addHighlight() {
        const resetToOriginalColorSize = () => {
            let specifiedSelectedIndex = makeSpecifiedVariableName('selectedIndex', '');
            this.pointsMesh.geometry.getAttribute('size').array.set(this.vueApp.originalSettings.originalSizes);
            this.pointsMesh.geometry.getAttribute('color').array.set(this.vueApp.originalSettings.originalColors);
            // not reset selectedIndex
            if (this.vueApp[specifiedSelectedIndex]) {
                this.pointsMesh.geometry.getAttribute('size').array[this.vueApp[specifiedSelectedIndex]] = HOVER_SIZE;
            }

            // Mark as needing update
            this.pointsMesh.geometry.getAttribute('size').needsUpdate = true;
            this.pointsMesh.geometry.getAttribute('color').needsUpdate = true;
            // console.log("resetColor", this.vueApp.originalSettings.originalColors)
        }

        const updateColorSizeForHighlights = (visualizationError) => {
            visualizationError.forEach(index => {
                this.pointsMesh.geometry.getAttribute('size').array[index] = HOVER_SIZE;
            });
            this.pointsMesh.geometry.getAttribute('size').needsUpdate = true;

            // yellow indices are triggered by right selected index
            visualizationError.forEach(index => {
                this.pointsMesh.geometry.getAttribute('color').array[index * 3] = GRAY[0]; // R
                this.pointsMesh.geometry.getAttribute('color').array[index * 3 + 1] = GRAY[1]; // G
                this.pointsMesh.geometry.getAttribute('color').array[index * 3 + 2] = GRAY[2]; // B
            });

            this.pointsMesh.geometry.getAttribute('color').needsUpdate = true;
        }

        const updateHighlights = () => {
            console.log("updateHihglight");
            let visualizationError = this.vueApp[specifiedHighlightAttributes].visualizationError;
            if (visualizationError == null) {
                visualizationError = [];
            } else {
                visualizationError = Array.from(visualizationError);
            }
            resetToOriginalColorSize();

            updateColorSizeForHighlights(visualizationError);
            visualizationError = [];
        }

        // In the Vue instance where you want to observe changes
        let specifiedHighlightAttributes = makeSpecifiedVariableName('highlightAttributes', '');
        this.vueApp.$watch(specifiedHighlightAttributes, updateHighlights, {
            deep: true // Use this if specifiedHighlightAttributes is an object to detect nested changes
        });
    }

    __moveCameraWithinRange(camera, newPosX, newPosY) {
        if (newPosX === undefined || newPosY === undefined) {
            newPosX = camera.position.x;
            newPosY = camera.position.y;
        }

        // const currentZoom = camera.zoom;

        // // left bound: minX <= x - w / 2 / scale,
        // // right bound: maxX >= x + w / 2 / scale
        // // so does y

        // const minX = this.boundary.x_min + (camera.right - camera.left) / 2 / currentZoom;
        // const maxX = this.boundary.x_max - (camera.right - camera.left) / 2 / currentZoom;
        // const minY = this.boundary.y_min + (camera.top - camera.bottom) / 2 / currentZoom;
        // const maxY = this.boundary.y_max - (camera.top - camera.bottom) / 2 / currentZoom;

        // newPosX = Math.max(minX, Math.min(newPosX, maxX));
        // newPosY = Math.max(minY, Math.min(newPosY, maxY));

        // update camera position
        camera.position.x = newPosX;
        camera.position.y = newPosY;
    }

    updateColor() {
        if (!this.pointsMesh) return;

        // FIXME label_color_list is used in rendering, so color_list does not work anymore. Should accord to which?
        const visData = window.vueApp.res;
        const geoData = visData.result;

        let color = visData.label_list.map((x) => visData.color_list[parseInt(x)]);
        let colors = [];

        geoData.forEach(function (point, i) {
            colors.push(color[i][0] / 255, color[i][1] / 255, color[i][2] / 255);
        });

        const buffer = new THREE.Float32BufferAttribute(colors, 3);
        this.pointsMesh.geometry.setAttribute('color', buffer);
        this.pointsMesh.geometry.attributes.color.needsUpdate = true;
    }
}

function drawCanvas(res) {
    // clean storage
    cleanForEpochChange('');

    let container = document.getElementById("container");

    const plotCanvas = new PlotCanvas(window.vueApp);
    window.vueApp.plotCanvas = plotCanvas;
    plotCanvas.bindTo(container);
    plotCanvas.plotDataPoints(res);
    plotCanvas.render();
    window.vueApp.isCanvasLoading = false;
}

function updateSizes() {
    // const nn = []; // 创建一个空的 sizes 列表
    window.vueApp.nnIndices.forEach((item, index) => {
        window.vueApp.pointsMesh.geometry.attributes.size.array[item] = NORMAL_SIZE;
    });
    window.vueApp.pointsMesh.geometry.attributes.size.needsUpdate = true;
    window.vueApp.nnIndices = [];
    Object.values(window.vueApp.query_result).forEach(item => {
        if (typeof item === 'object' && item !== null) {
            window.vueApp.nnIndices.push(item.id);
            window.vueApp.nnIndices.push(item.id);
        }
    });
    console.log(window.vueApp.nnIndices);
    window.vueApp.nnIndices.forEach((item, index) => {
        window.vueApp.pointsMesh.geometry.attributes.size.array[item] = HOVER_SIZE;
    });
    window.vueApp.pointsMesh.geometry.attributes.size.needsUpdate = true;
    resultContainer = document.getElementById("resultContainer");
    resultContainer.setAttribute("style", "display:block;");
}

function clear() {
    window.vueApp.nnIndices.forEach((item, index) => {
        window.vueApp.pointsMesh.geometry.attributes.size.array[item] = NORMAL_SIZE;
    });
    window.vueApp.pointsMesh.geometry.attributes.size.needsUpdate = true;
    window.vueApp.nnIndices = [];
    resultContainer = document.getElementById("resultContainer");
    resultContainer.setAttribute("style", "display:none;");
}

function show_query_text() {
    resultContainer = document.getElementById("resultContainer");
    resultContainer.setAttribute("style", "display:block;");
}
