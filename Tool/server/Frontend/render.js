/** render the canvas and timeline */
const BACKGROUND_COLOR = 0xffffff;
// Constants relating to the camera parameters.
const PERSP_CAMERA_FOV_VERTICAL = 70;
const PERSP_CAMERA_NEAR_CLIP_PLANE = 0.01;
const PERSP_CAMERA_FAR_CLIP_PLANE = 100;
const ORTHO_CAMERA_FRUSTUM_HALF_EXTENT = 1.2;
const MIN_ZOOM_SCALE = 1;
const MAX_ZOOM_SCALE = 60;
const NORMAL_SIZE = 10;
const HOVER_SIZE = 22;
const SELECTED_SIZE = 15;
const GRAY = [0.8, 0.8, 0.8];
const DEFAULT_ALPHA = 1.0;  // less than 1.0 will cause raycaster no intersection
const SELECTED_ALPHA = 1.0;
const selectedLabel = 'fixedHoverLabel';
let baseZoomSpeed = 0.01;
let isDragging = false;
let previousMousePosition = {
    x: 0,
    y: 0
};
let lockIndex = false;

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
        const rect = container.getBoundingClientRect();
        renderer.setSize(rect.width, rect.height);
        renderer.setClearColor(BACKGROUND_COLOR, 1);
        renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer = renderer;

        container.appendChild(renderer.domElement);
    }

    plotDataPoints(visData) {
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

        // A non-one aspectRatio will result in not-fitting error:
        // let aspectRatio = rect.width / rect.height;
        let aspectRatio = 1;

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

        let color = visData.label_list.map((x) => visData.color_list[x]);
        let position = [];
        let colors = [];
        let sizes = [];
        let alphas = [];

        geoData.forEach(function (point, i) {
            position.push(point[0], point[1], 0);
            colors.push(color[i][0] / 255, color[i][1] / 255, color[i][2] / 255);
            sizes.push(NORMAL_SIZE);
            alphas.push(DEFAULT_ALPHA);
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
        this.__addClassicMapNavigationControls();
        this.__addHoverRevealingControl();
        this.__addDoubleClickLockingControl();

        this.__addFilterTestTrain();
        this.__addHighlight();
    }

    __createPureColorTexture(color, callback) {
        let canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        let ctx = canvas.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        let texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        callback(texture);
    }

    __registerContainerEventListener(type, listener) {
        this.container.addEventListener(type, listener.bind(this));
        this.eventListeners.push([type, listener]);
    }

    __addClassicMapNavigationControls() {
        this.__addWheelZoomingControl();
        this.__addMouseDraggingControl();
    }

    __addWheelZoomingControl() {
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

    __addMouseDraggingControl() {
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
                // updateLabelPosition('', this.vueApp.selectedPointPosition, this.vueApp.selectedIndex, selectedLabel, true)
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
        // FIXME consider using circle
        // If would still consider use points, refer to this shader and https://threejs.org/examples/#webgl_buffergeometry_custom_attributes_particles
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
                    gl_PointSize = size; // Keep original size
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: `
                varying vec3 vColor;
                varying float vAlpha; 
            
                void main() {
                    vec2 uv = gl_PointCoord - vec2(0.5, 0.5);
                    float r = length(uv);
                    if (r > 0.5) discard;
                    gl_FragColor = vec4(vColor, 1.0); // Maintain alpha
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

    __addHoverRevealingControl() {
        let raycaster = new THREE.Raycaster();
        let mouse = new THREE.Vector2();

        const p3d = (idx, posArr) => {
            let x = posArr.getX(idx);
            let y = posArr.getY(idx);
            let z = posArr.getZ(idx);
            return { x, y, z };
        };

        const lines = [];
        let lineMaterial = new THREE.LineBasicMaterial({ color: 0xaaaaaa });
        
        const lineTwoPoints = (p1, p2) => {
            let points = [];
            points.push(new THREE.Vector3(p1.x, p1.y, p1.z));
            points.push(new THREE.Vector3(p2.x, p2.y, p2.z));
            let geometry = new THREE.BufferGeometry().setFromPoints(points);
            this.scene.hoverLine = new THREE.Line(geometry, lineMaterial);
            lines.push(this.scene.hoverLine);
            this.scene.add(this.scene.hoverLine);
        };

        const removeAllLines = () => {
            lines.forEach(line => {
                this.scene.remove(line);
                line.geometry.dispose();
            });
        }

        const setSizeAndAlpha = (index, sizeArr, alphaArr, isEmphasize = false) => {
            sizeArr[index] = HOVER_SIZE;
            if (isEmphasize) {
                alphaArr[index] = SELECTED_ALPHA;
            }
        }

        const revealNeighborPoints = (index, relArr, sizeArr, alphaArr, posArr, isEmphasize = false) => {
            relArr[index].forEach(neighbor => {
                setSizeAndAlpha(neighbor, sizeArr, alphaArr, isEmphasize);
                lineTwoPoints(p3d(index, posArr), p3d(neighbor, posArr));
            });
        };

        const revealPoint = (index, relArr, sizeArr, alphaArr, posArr, isEmphasize = false) => {
            if (index !== null && index !== undefined) {
                setSizeAndAlpha(index, sizeArr, alphaArr, isEmphasize);
                revealNeighborPoints(index, relArr, sizeArr, alphaArr, posArr, isEmphasize);
            }
        }

        const updateHoveredIndexSize = (hoveredIndex, selectedIndices, visualizationError, nnIndices) => {
            const sizeArr = this.pointsMesh.geometry.attributes.size.array;
            const posArr = this.pointsMesh.geometry.attributes.position;    // keep dimension
            const alphaArr = this.pointsMesh.geometry.attributes.alpha.array;

            // TODO Can incremental update here optimize the performance?
            for (let i = 0; i < sizeArr.length; i++) {
                sizeArr[i] = NORMAL_SIZE;
            }
            removeAllLines();

            // TODO This logic should not be put here. Just for temporary test.
            // What points are revealed should be determined in 'model' but not 'vision'.
            // Especially like locked index should be preserved somewhere else
            let top_k = undefined;
            if (this.vueApp.taskType === 'Umap-Neighborhood') {
                const top_k_attr_name =
                    this.vueApp.neighborhoodRevealType === 'Intra-Type'
                        ? 'intra_sim_top_k'
                        : this.vueApp.neighborhoodRevealType === 'Inter-Type'
                            ? 'inter_sim_top_k'
                            : undefined;
                if (top_k_attr_name) {
                    top_k = window.vueApp.epochData[top_k_attr_name];
                }
            }

            revealPoint(hoveredIndex, top_k, sizeArr, alphaArr, posArr, false);
            selectedIndices.forEach((index) => revealPoint(index, top_k, sizeArr, alphaArr, posArr, true));
        }

        function onMouseMove(event, isDown = false) {
            this.vueApp.selectedIndex.forEach(index => {
                this.pointsMesh.geometry.getAttribute('size').array[index] = SELECTED_SIZE;
            });
            this.pointsMesh.geometry.getAttribute('size').needsUpdate = true;
            // TODO consider adjusting the threshold reactive to monitor size and resolution
            raycaster.params.Points.threshold = 0.4 / this.camera.zoom; // 根据点的屏幕大小调整
            let rect = this.renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, this.camera);
            let intersects = raycaster.intersectObject(this.pointsMesh);
            let specifiedLastHoveredIndex = makeSpecifiedVariableName('lastHoveredIndex', '');
            let specifiedImageSrc = makeSpecifiedVariableName('imageSrc', '');
            let specifiedSelectedIndex = makeSpecifiedVariableName('selectedIndex', '');
            let specifiedHighlightAttributes = makeSpecifiedVariableName('highlightAttributes', '');

            let index = null;
            if (intersects.length > 0 && checkVisibility(this.pointsMesh.geometry.attributes.alpha.array, intersects[0].index)) {

                this.container.style.cursor = 'pointer';

                let intersect = intersects[0];

                index = intersect.index;

                // Map it to the original index
                if (this.vueApp.filter_index != '') {
                    console.log("this.vueApp.filter_index", this.vueApp.filter_index);
                    filter_index = this.vueApp.filter_index.split(',');
                    index = filter_index[index];
                }
                this.vueApp.curIndex = index;

                // This index is deem as hovered

            }
            // If isDown, switch lockIndex
            // lockIndex indicates whether the last one or several indices should be deem as hovered
            if (isDown) {
                // detect if locked to a new point successfully
                if (index !== null && index !== undefined) {
                    if (!this.vueApp[specifiedSelectedIndex].includes(index)) {
                        lockIndex = true;
                        this.vueApp[specifiedSelectedIndex].push(index);
                    } else {
                        this.vueApp[specifiedSelectedIndex] = this.vueApp[specifiedSelectedIndex].filter((value) => value !== index);
                    }
                }
            }
            
            this.vueApp[specifiedLastHoveredIndex] = index;
            
            const update = () => {
                updateHoveredIndexSize(this.vueApp[specifiedLastHoveredIndex], this.vueApp[specifiedSelectedIndex],
                    this.vueApp[specifiedHighlightAttributes].visualizationError, this.vueApp.nnIndices);
            }
            update();
            this.lastDoUpdateRevealing = update;

            this.pointsMesh.geometry.attributes.size.array[index] = HOVER_SIZE;
            this.pointsMesh.geometry.attributes.size.needsUpdate = true;        // TODO Is this a drawback of performance? We mark the whole array as needing update
            updateCurrHoverIndex(event, index, false, '');

            if ((index === null || index === undefined) && this.container.style.cursor !== 'move') {
                this.container.style.cursor = 'default';
            }


                // if (this.vueApp.lastHoveredIndex !== null && !lockIndex) {
                //     updateHoveredIndexSize(this.vueApp[specifiedLastHoveredIndex], this.vueApp[specifiedSelectedIndex],
                //         this.vueApp[specifiedHighlightAttributes].visualizationError, this.vueApp.nnIndices);
                //     this.pointsMesh.geometry.attributes.size.needsUpdate = true;
                //     this.vueApp.nnIndices = [];
                //     this.vueApp[specifiedLastHoveredIndex] = null;
                //     this.vueApp[specifiedImageSrc] = "";
                //     updateCurrHoverIndex(event, null, false, '');
                //     // if (this.scene.hoverLine) {
                //     //     this.scene.remove(this.scene.hoverLine);
                //     //     this.scene.hoverLine.geometry?.dispose();
                //     //     this.scene.hoverLine.material?.dispose();
                //     //     this.scene.hoverLine = undefined;
                //     // }
                // }
        }

        this.__registerContainerEventListener('mousemove', onMouseMove);
        // FIXME click-to-lock logic was mixed into the logic of mousemove
        this.__registerContainerEventListener('click', (e) => { onMouseMove.call(this, e, true); });    
    }

    __addDoubleClickLockingControl() {
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

        const currentZoom = camera.zoom;

        // left bound: minX <= x - w / 2 / scale,
        // right bound: maxX >= x + w / 2 / scale
        // so does y

        const minX = this.boundary.x_min + (camera.right - camera.left) / 2 / currentZoom;
        const maxX = this.boundary.x_max - (camera.right - camera.left) / 2 / currentZoom;
        const minY = this.boundary.y_min + (camera.top - camera.bottom) / 2 / currentZoom;
        const maxY = this.boundary.y_max - (camera.top - camera.bottom) / 2 / currentZoom;

        newPosX = Math.max(minX, Math.min(newPosX, maxX));
        newPosY = Math.max(minY, Math.min(newPosY, maxY));

        // update camera position
        camera.position.x = newPosX;
        camera.position.y = newPosY;
    }
}

function drawCanvas(res) {
    // clean storage
    cleanForEpochChange('');

    let container = document.getElementById("container");

    const plotCanvas = new PlotCanvas(window.vueApp);
    plotCanvas.bindTo(container);
    plotCanvas.plotDataPoints(res);
    plotCanvas.render();
    window.vueApp.plotCanvas = plotCanvas;
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

function labelColor() {
    const labels = window.vueApp.label_name_dict;
    const colors = window.vueApp.color_list;

    const tableBody = document.querySelector('#labelColor tbody');
    tableBody.innerHTML = '';
    const hexToRgbArray = (hex) => {
        hex = hex.replace(/^#/, '');
        let bigint = parseInt(hex, 16);
        let r = (bigint >> 16) & 255;
        let g = (bigint >> 8) & 255;
        let b = bigint & 255;
        return [r, g, b];
    };
    
    function changeLabelColor(label2Change, newColor) {
        const pointLabels = window.vueApp.label_list;
        for (let i = 0; i < pointLabels.length; i++) {
            if (pointLabels[i] === label2Change) {
                window.vueApp.res.label_color_list[i][0] = newColor[0];
                window.vueApp.res.label_color_list[i][1] = newColor[1];
                window.vueApp.res.label_color_list[i][2] = newColor[2];
            }
        }
        drawCanvas(window.vueApp.res)
    }
    
    Object.keys(labels).forEach((key, index) => {
        const row = document.createElement('tr');

        // 创建标签名单元格
        const labelCell = document.createElement('td');
        labelCell.textContent = labels[key];
        row.appendChild(labelCell);

        // 创建颜色单元格
        const colorCell = document.createElement('td');
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = `#${colors[index].map(c => c.toString(16).padStart(2, '0')).join('')}`;
        colorInput.addEventListener('input', (event) => {
                const newColor = event.target.value;
                changeLabelColor(key, hexToRgbArray(newColor));
            }
        );
        colorCell.appendChild(colorInput);
        row.appendChild(colorCell);
        // 将行添加到表格中
        tableBody.appendChild(row);
    });
}
