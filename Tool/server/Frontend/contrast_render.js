/** render the canvas and timeline */
const BACKGROUND_COLOR = 0xffffff;
// Constants relating to the camera parameters.
const PERSP_CAMERA_FOV_VERTICAL = 70;
const PERSP_CAMERA_NEAR_CLIP_PLANE = 0.01;
const PERSP_CAMERA_FAR_CLIP_PLANE = 100;
const ORTHO_CAMERA_FRUSTUM_HALF_EXTENT = 1.2;
const MIN_ZOOM_SCALE = 0.8
const MAX_ZOOM_SCALE = 30
const NORMAL_SIZE = 5
const HOVER_SIZE = 10
const YELLOW = [1.0, 1.0, 0.0]; 
const BLUE = [0.0, 0.0, 1.0]; 
const GREEN = [0.0, 1.0, 0.0]; 
const ORANGE = [1.0, 0.5, 0.0]
const GRAY = [0.8,0.8,0.8]
var baseZoomSpeed = 0.01;
var isDragging = false;
var previousMousePosition = {
    x: 0,
    y: 0
};
const selectedLabel = 'fixedHoverLabel'
const boldLable = 'fixedBoldLabel'

var EventBus = new Vue();

function drawCanvas(res,id, flag='ref') {
    // reset since both of ref and tar refer to the same eventBus, we need to reset the previously bounded sender/receiver 
    EventBus.$off(referToAnotherFlag(flag) + 'update-curr-hover');

    //clean storage
    cleanForEpochChange(flag)

    // remove previous scene
    container = document.getElementById(id)

    // This part removes event listeners
    let newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);
    container = newContainer;

    // remove previous dom element
    if (container.firstChild) {
        while (container.firstChild) {
            container.removeChild(container.lastChild);
        }
    }

    // create new Three.js scene
    window.vueApp.scene[flag] = new THREE.Scene();
    // get the boundary of the scene
    window.vueApp.sceneBoundary[flag].x_min = res.grid_index[0]
    window.vueApp.sceneBoundary[flag].y_min = res.grid_index[1]
    window.vueApp.sceneBoundary[flag].x_max = res.grid_index[2]
    window.vueApp.sceneBoundary[flag].y_max = res.grid_index[3]

    const cameraBounds = {
        minX: window.vueApp.sceneBoundary[flag].x_min,
        maxX: window.vueApp.sceneBoundary[flag].x_max,
        minY: window.vueApp.sceneBoundary[flag].y_min,
        maxY: window.vueApp.sceneBoundary[flag].y_max
    };
    var aspect = 1
    const rect = container.getBoundingClientRect();

    window.vueApp.camera[flag] = new THREE.OrthographicCamera(window.vueApp.sceneBoundary[flag].x_min * aspect,
         window.vueApp.sceneBoundary[flag].x_max * aspect,
         window.vueApp.sceneBoundary[flag].y_max,
          window.vueApp.sceneBoundary[flag].y_min,
            1, 1000);
    window.vueApp.camera[flag].position.set(0, 0, 100);
    const target = new THREE.Vector3(
        0, 0, 0
    );

    // 根据容器尺寸调整相机视野
    var aspectRatio = rect.width / rect.height;
    window.vueApp.camera[flag].left = window.vueApp.sceneBoundary[flag].x_min * aspectRatio;
    window.vueApp.camera[flag].right = window.vueApp.sceneBoundary[flag].x_max * aspectRatio;
    window.vueApp.camera[flag].top =  window.vueApp.sceneBoundary[flag].y_max;
    window.vueApp.camera[flag].bottom = window.vueApp.sceneBoundary[flag].y_min;

    // 更新相机的投影矩阵
    window.vueApp.camera[flag].updateProjectionMatrix();
    window.vueApp.camera[flag].lookAt(target);
    window.vueApp.renderer[flag] = new THREE.WebGLRenderer();
    window.vueApp.renderer[flag].setSize(rect.width, rect.height);
    window.vueApp.renderer[flag].setClearColor(BACKGROUND_COLOR, 1);

    function onDocumentMouseWheel(event) {
        const currentZoom = window.vueApp.camera[flag].zoom;
        var zoomSpeed = calculateZoomSpeed(currentZoom, baseZoomSpeed, MAX_ZOOM_SCALE); 
        var newZoom = currentZoom + event.deltaY * -zoomSpeed;
        newZoom = Math.max(MIN_ZOOM_SCALE, Math.min(newZoom, MAX_ZOOM_SCALE)); 
    
        window.vueApp.camera[flag].zoom = newZoom; 
    
        window.vueApp.camera[flag].updateProjectionMatrix(); 
    
        // Call function to update current hover index or any other updates needed after zoom
        var specifiedSelectedIndex = makeSpecifiedVariableName('selectedIndex', flag)
        var specifiedSelectedPointPosition = makeSpecifiedVariableName('selectedPointPosition', flag)

        updateLabelPosition(flag, window.vueApp[specifiedSelectedPointPosition], window.vueApp[specifiedSelectedIndex], selectedLabel, true)
        var specifiedHighlightAttributes = makeSpecifiedVariableName('highlightAttributes', flag)
        if (window.vueApp[specifiedHighlightAttributes].boldIndices) {
            var lens = window.vueApp[specifiedHighlightAttributes].boldIndices.length
            for (var i = 0; i < lens; i++) {
                var pointPosition = new THREE.Vector3();
                pointPosition.fromBufferAttribute(window.vueApp[specifiedPointsMesh].geometry.attributes.position, window.vueApp[specifiedHighlightAttributes].boldIndices[i]);
                updateLabelPosition(flag, pointPosition, window.vueApp[specifiedHighlightAttributes].boldIndices[i], boldLable + i, true)
            }
        }
    }

    container.addEventListener('wheel', onDocumentMouseWheel, false)

    container.addEventListener('wheel', function (event) {
        event.preventDefault();
    })

    container.appendChild(window.vueApp.renderer[flag].domElement);
    // 计算尺寸和中心位置
    var width = window.vueApp.sceneBoundary[flag].x_max - window.vueApp.sceneBoundary[flag].x_min;
    var height = window.vueApp.sceneBoundary[flag].y_max - window.vueApp.sceneBoundary[flag].y_min;
    var centerX = window.vueApp.sceneBoundary[flag].x_min + width / 2;
    var centerY = window.vueApp.sceneBoundary[flag].y_min + height / 2;

    let canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    var ctx = canvas.getContext("2d");
    var img = new Image();
    img.src = res.grid_color;
    img.crossOrigin = "anonymous";
    img.onload = () => {
        ctx.drawImage(img, 0, 0, 128, 128);
        let texture = new THREE.CanvasTexture(canvas);
        // texture.needsUpdate = true; // 不设置needsUpdate为true的话，可能纹理贴图不刷新
        var plane_geometry = new THREE.PlaneGeometry(width, height);
        var material = new THREE.MeshPhongMaterial({
            map: texture,
            side: THREE.DoubleSide
        });
        const newMesh = new THREE.Mesh(plane_geometry, material);
        newMesh.position.set(centerX, centerY, 0);
        window.vueApp.scene[flag].add(newMesh);
    }
    // 创建数据点
    var dataPoints = res.result
    dataPoints.push()
    var color = res.label_color_list

    var geometry = new THREE.BufferGeometry();
    var position = [];
    var colors = [];
    var sizes = [];
    var alphas = [];

    dataPoints.forEach(function (point, i) {
        position.push(point[0], point[1], 0); // 添加位置
        colors.push(color[i][0] / 255, color[i][1] / 255, color[i][2] / 255); // 添加颜色
        sizes.push(NORMAL_SIZE);
        alphas.push(1.0)
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));


    // reset data points
    position = []
    colors = []
    color = []
    sizes = []
    alphas = []
    dataPoints = []

    FRAGMENT_SHADER = createFragmentShader();
    VERTEX_SHADER = createVertexShader()
    var shaderMaterial = new THREE.ShaderMaterial({
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
    var specifiedPointsMesh = makeSpecifiedVariableName('pointsMesh', flag)
    window.vueApp[specifiedPointsMesh] = new THREE.Points(geometry, shaderMaterial);
    console.log("pointsMan",window.vueApp[specifiedPointsMesh].geometry.attributes.size.array)
    var specifiedOriginalSettings = makeSpecifiedVariableName('originalSettings', flag)
    // Save original sizes
    if (window.vueApp[specifiedPointsMesh].geometry.getAttribute('size')) {
        window.vueApp[specifiedOriginalSettings].originalSizes = []
        window.vueApp[specifiedOriginalSettings].originalSizes = Array.from(window.vueApp[specifiedPointsMesh].geometry.getAttribute('size').array);
    }

    // Save original colors
    if (window.vueApp[specifiedPointsMesh].geometry.getAttribute('color')) {
        window.vueApp[specifiedOriginalSettings].originalColors = []
        window.vueApp[specifiedOriginalSettings].originalColors = Array.from(window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array);
    }

    var specifiedSelectedIndex = makeSpecifiedVariableName('selectedIndex', flag)
    var specifiedSelectedPointPosition = makeSpecifiedVariableName('selectedPointPosition', flag)
    if (window.vueApp[specifiedSelectedIndex]) {
        window.vueApp[specifiedPointsMesh].geometry.attributes.size.array[window.vueApp[specifiedSelectedIndex]] = HOVER_SIZE
        // points.geometry.attributes.color.array[window.vueApp.selectedIndex] = SELECTED_COLOR
        // update selected point position in new epoch 
        var pointPosition = new THREE.Vector3();
        pointPosition.fromBufferAttribute(window.vueApp[specifiedPointsMesh].geometry.attributes.position, window.vueApp[specifiedSelectedIndex]);
        window.vueApp[specifiedSelectedPointPosition] = pointPosition;
        window.vueApp[specifiedPointsMesh].geometry.attributes.size.needsUpdate = true
        updateLabelPosition(flag, pointPosition, window.vueApp[specifiedSelectedIndex], selectedLabel, true)
    }
  
    window.vueApp.scene[flag].add(window.vueApp[specifiedPointsMesh]);

    // 创建 Raycaster 和 mouse 变量
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();
    // var distance = camera.position.distanceTo(points.position); // 相机到点云中心的距离
    // var threshold = distance * 0.1; // 根据距离动态调整阈值，这里的0.01是系数，可能需要调整
    // raycaster.params.Points.threshold = threshold;

    //  =========================  index search start =========================================== //
    
    function contrastUpdateSizes() {
        window.vueApp.nnIndices.forEach((item, index) => {
            window.vueApp[specifiedPointsMesh].geometry.attributes.size.array[item] = NORMAL_SIZE
        });
        window.vueApp[specifiedPointsMesh].geometry.attributes.size.needsUpdate = true;
        window.vueApp.nnIndices = []
        Object.values(window.vueApp.query_result).forEach(item => {
            if (typeof item === 'object' && item !== null) {
                window.vueApp.nnIndices.push(item.id);
            }
        });
        console.log(window.vueApp.nnIndices)
        window.vueApp.nnIndices.forEach((item, index) => {
            window.vueApp[specifiedPointsMesh].geometry.attributes.size.array[item] = HOVER_SIZE
        });
        window.vueApp[specifiedPointsMesh].geometry.attributes.size.needsUpdate = true;
        resultContainer = document.getElementById("resultContainer");
        resultContainer.setAttribute("style", "display:block;")
    }

    function contrastResetSizes() {
        window.vueApp.nnIndices.forEach((item, index) => {
            window.vueApp[specifiedPointsMesh].geometry.attributes.size.array[item] = NORMAL_SIZE
        });
        window.vueApp[specifiedPointsMesh].geometry.attributes.size.needsUpdate = true;
        window.vueApp.nnIndices = []
    }
    
    function contrast_clear() {
        window.vueApp.nnIndices.forEach((item, index) => {
            window.vueApp[specifiedPointsMesh].geometry.attributes.size.array[item] = NORMAL_SIZE
        });
        window.vueApp[specifiedPointsMesh].geometry.attributes.size.needsUpdate = true;
        window.vueApp.nnIndices = []
        resultContainer = document.getElementById("resultContainer");
        resultContainer.setAttribute("style", "display:none;")
    }

    function contrast_show_query_text() {
        resultContainer = document.getElementById("resultContainer");
        resultContainer.setAttribute("style", "display:block;")
    }

    document.querySelector('#vdbquery').addEventListener('click', contrast_show_query_text);
    document.querySelector('#clearquery').addEventListener('click', contrast_clear);
    //  =========================  index search end =========================================== //
   //  =========================  db click start =========================================== //
   container.addEventListener('dblclick', onDoubleClick);

   function onDoubleClick(event) {
       // Raycasting to find the intersected point
       var rect = window.vueApp.renderer[flag].domElement.getBoundingClientRect();
       mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
       mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
       raycaster.setFromCamera(mouse, window.vueApp.camera[flag]);
     
       var intersects = raycaster.intersectObject(window.vueApp[specifiedPointsMesh]);
       let specifiedSelectedIndex = makeSpecifiedVariableName('selectedIndex', flag)
       let specifiedSelectedPointPosition = makeSpecifiedVariableName('selectedPointPosition', flag)
       var specifiedHighlightAttributes = makeSpecifiedVariableName('highlightAttributes', flag)
       if (intersects.length > 0 && checkVisibility(window.vueApp[specifiedPointsMesh].geometry.attributes.alpha.array, intersects[0].index)) {

        if (window.vueApp[specifiedSelectedIndex] != null) {
            
            updateLastIndexSize(window.vueApp[specifiedSelectedIndex], window.vueApp[specifiedHighlightAttributes].allHighlightedSet, 
                 null, window.vueApp[specifiedHighlightAttributes].boldIndices, window.vueApp[specifiedHighlightAttributes].visualizationError, flag) 
        }
       
         // Get the index and position of the double-clicked point
         var intersect = intersects[0];

         window.vueApp[specifiedSelectedIndex] = intersect.index;
         window.vueApp[specifiedSelectedPointPosition]= intersect.point;
         window.vueApp[specifiedPointsMesh].geometry.attributes.size.array[window.vueApp[specifiedSelectedIndex]] = HOVER_SIZE; 
      
         window.vueApp[specifiedPointsMesh].geometry.attributes.size.needsUpdate = true;
         // Call function to update label position and content
         updateLabelPosition(flag, window.vueApp[specifiedSelectedPointPosition], window.vueApp[specifiedSelectedIndex], selectedLabel, true)
       } else {
        if (window.vueApp[specifiedSelectedIndex] !=null) {
        // this works even if window.vueApp[specifiedSelectedIndex] is null
        updateLastIndexSize(window.vueApp[specifiedSelectedIndex], window.vueApp[specifiedHighlightAttributes].allHighlightedSet,
           null, window.vueApp[specifiedHighlightAttributes].boldIndices, window.vueApp[specifiedHighlightAttributes].visualizationError, flag)
        window.vueApp[specifiedPointsMesh].geometry.attributes.size.needsUpdate = true;
        
         // If the canvas was double-clicked without hitting a point, hide the label and reset
         window.vueApp[specifiedSelectedIndex] = null;
         window.vueApp[specifiedSelectedPointPosition]= null;
         window.vueApp.nnIndices = []
         updateFixedHoverLabel(null, null, null, flag, null, selectedLabel, false)
        }
       }
     }

    //  =========================  db click  end =========================================== //
    function updateLastIndexSize(lastHoveredIndex, highlihghtedPoints,  selectedIndex, boldIndices, visualizationError, flag, nnIndices) {
        let specifiedPointsMesh = makeSpecifiedVariableName("pointsMesh", flag)
        if (lastHoveredIndex != null) {
            var isNormalSize = true;
            if (highlihghtedPoints) {
                var isInsideHighlightedSet =highlihghtedPoints.has(lastHoveredIndex)
                if (isInsideHighlightedSet) {
                    isNormalSize = false;
                }
            } 

            if (selectedIndex != null) {
                if (lastHoveredIndex == selectedIndex) {
                   isNormalSize = false
                }
            } 
            if (boldIndices != null) {
                var isInsideBoldIndices =boldIndices.includes(lastHoveredIndex)
                if (isInsideBoldIndices) {
                    isNormalSize = false
                }
            } 
            if (visualizationError != null) {
                var isInsideVisError = visualizationError.has(lastHoveredIndex)
                if (isInsideVisError) {
                    isNormalSize = false
                }
            }       
      
            if (isNormalSize) {
                window.vueApp[specifiedPointsMesh].geometry.attributes.size.array[lastHoveredIndex] = NORMAL_SIZE; 
            } else {
                window.vueApp[specifiedPointsMesh].geometry.attributes.size.array[lastHoveredIndex] = HOVER_SIZE; 
            }
            nnIndices.forEach((item, index) => {
                window.vueApp[specifiedPointsMesh].geometry.attributes.size.array[item] = NORMAL_SIZE;
            });
        }
      }

    //  =========================  鼠标hover功能  开始 =========================================== //
    function onMouseMove(event) {
        raycaster.params.Points.threshold = 0.2 / window.vueApp.camera[flag].zoom; // 根据点的屏幕大小调整
        // 转换鼠标位置到归一化设备坐标 (NDC)
        var rect = window.vueApp.renderer[flag].domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        // 通过鼠标位置更新射线
        raycaster.setFromCamera(mouse, window.vueApp.camera[flag]);

        // 检测射线与点云的相交
        var intersects = raycaster.intersectObject(window.vueApp[specifiedPointsMesh]);
        let specifiedLastHoveredIndex = makeSpecifiedVariableName('lastHoveredIndex', flag)
        let specifiedImageSrc = makeSpecifiedVariableName('imageSrc', flag)
        let specifiedHighlightAttributes = makeSpecifiedVariableName('highlightAttributes', flag)
        let specifiedSelectedIndex = makeSpecifiedVariableName('selectedIndex', flag)
        let specifiedCurIndex = makeSpecifiedVariableName('curIndex', flag)
    
        if (intersects.length > 0 && checkVisibility(window.vueApp[specifiedPointsMesh].geometry.attributes.alpha.array, intersects[0].index)) {
            // 获取最接近的交点
            var intersect = intersects[0];
            // 获取索引 - 这需要根据具体实现来确定如何获取
            var index = intersect.index;
            // window.vueApp[specifiedCurIndex] = index
            if (window.vueApp.hoverMode == "pair") {
                EventBus.$emit(flag + 'update-curr-hover', { Index: index, flag });
            }
            // 在这里处理悬停事件
            if (window.vueApp[specifiedLastHoveredIndex] != index) {

                updateLastIndexSize(window.vueApp[specifiedLastHoveredIndex], window.vueApp[specifiedHighlightAttributes].allHighlightedSet,
                    window.vueApp[specifiedSelectedIndex], window.vueApp[specifiedHighlightAttributes].boldIndices, window.vueApp[specifiedHighlightAttributes].visualizationError, flag, window.vueApp.nnIndices)
                container.style.cursor = 'pointer';
                window.vueApp[specifiedPointsMesh].geometry.attributes.size.array[index] = HOVER_SIZE
                window.vueApp[specifiedPointsMesh].geometry.attributes.size.needsUpdate = true;
                window.vueApp[specifiedLastHoveredIndex] = index;
                var pointPosition = new THREE.Vector3();
                pointPosition.fromBufferAttribute(window.vueApp[specifiedPointsMesh].geometry.attributes.position, index);
                updateHoverIndexUsingPointPosition(pointPosition, index, false, flag, window.vueApp.camera[flag], window.vueApp.renderer[flag])
                setTimeout(function() {
                    contrastUpdateSizes()
                }, 500);
                
            }
        } else {
            if (window.vueApp.hoverMode == "pair") {
                EventBus.$emit(flag + 'update-curr-hover', { Index: null, flag });
            }
            container.style.cursor = 'default';
            // 如果没有悬停在任何点上，也重置上一个点的大小
            if (window.vueApp[specifiedLastHoveredIndex] != null) {
                updateLastIndexSize(window.vueApp[specifiedLastHoveredIndex], window.vueApp[specifiedHighlightAttributes].allHighlightedSet,
                    window.vueApp[specifiedSelectedIndex], window.vueApp[specifiedHighlightAttributes].boldIndices, window.vueApp[specifiedHighlightAttributes].visualizationError, flag, window.vueApp.nnIndices)
   
                window.vueApp[specifiedPointsMesh].geometry.attributes.size.needsUpdate = true;
                window.vueApp[specifiedLastHoveredIndex] = null;
                window.vueApp[specifiedImageSrc] = ""
                updateHoverIndexUsingPointPosition(pointPosition, null, false, flag, window.vueApp.camera[flag], window.vueApp.renderer[flag]) 
            }
        }
    }
    //  =========================  鼠标hover功能  结束 =========================================== //

    function updatePairHover(index) {
        let specifiedLastHoveredIndex = makeSpecifiedVariableName('lastHoveredIndex', flag)
        let specifiedImageSrc = makeSpecifiedVariableName('imageSrc', flag)
        let specifiedHighlightAttributes = makeSpecifiedVariableName('highlightAttributes', flag)

        if (index != null) {
            if (window.vueApp[specifiedLastHoveredIndex] != index) {
                updateLastIndexSize(window.vueApp[specifiedLastHoveredIndex], window.vueApp[specifiedHighlightAttributes].allHighlightedSet,
                    window.vueApp[specifiedSelectedIndex], window.vueApp[specifiedHighlightAttributes].boldIndices, window.vueApp[specifiedHighlightAttributes].visualizationError, flag, window.vueApp.nnIndices)
                container.style.cursor = 'pointer';
                window.vueApp[specifiedPointsMesh].geometry.attributes.size.array[index] = HOVER_SIZE
                window.vueApp[specifiedPointsMesh].geometry.attributes.size.needsUpdate = true;
                window.vueApp[specifiedLastHoveredIndex] = index;
                var pointPosition = new THREE.Vector3();
                pointPosition.fromBufferAttribute(window.vueApp[specifiedPointsMesh].geometry.attributes.position, index);
                updateHoverIndexUsingPointPosition(pointPosition, index, false, flag, window.vueApp.camera[flag], window.vueApp.renderer[flag]) 
                setTimeout(function() {
                    contrastUpdateSizes()
                }, 500);
            }
        } else {
            container.style.cursor = 'default';
            if (window.vueApp[specifiedLastHoveredIndex] != null) {
                updateLastIndexSize(window.vueApp[specifiedLastHoveredIndex], window.vueApp[specifiedHighlightAttributes].allHighlightedSet,
                    window.vueApp[specifiedSelectedIndex], window.vueApp[specifiedHighlightAttributes].boldIndices, window.vueApp[specifiedHighlightAttributes].visualizationErro, flag, window.vueApp.nnIndices)

                window.vueApp[specifiedPointsMesh].geometry.attributes.size.needsUpdate = true;
                window.vueApp[specifiedLastHoveredIndex] = null;
                window.vueApp[specifiedImageSrc] = ""
                updateHoverIndexUsingPointPosition(pointPosition, null, false, flag, window.vueApp.camera[flag], window.vueApp.renderer[flag]) 
            }
        }

    }

    EventBus.$on(referToAnotherFlag(flag) + 'update-curr-hover', (payload) => {
        if (payload.flag !== flag) { 
            // Update local variables or perform actions based on the received data
            updatePairHover(payload.Index)
        }
    });

    var specifiedShowTesting = makeSpecifiedVariableName('showTesting', flag)
    var specifiedShowTraining = makeSpecifiedVariableName('showTraining', flag)
    var specifiedPredictionFlipIndices = makeSpecifiedVariableName('predictionFlipIndices', flag)
    // var specifiedOriginalSettings = makeSpecifiedVariableName('originalSettings', flag)

    window.vueApp.$watch(specifiedShowTesting, updateCurrentDisplay);
    window.vueApp.$watch(specifiedShowTraining, updateCurrentDisplay);
    window.vueApp.$watch(specifiedPredictionFlipIndices, updateCurrentDisplay);  
    window.vueApp.$watch(specifiedShowTesting, updateCurrentDisplay);
    // window.vueApp.$watch(specifiedOriginalSettings, resetToOriginalColorSize, { deep: true });

    function updateCurrentDisplay() {
        console.log("currDisplay")
        let specifiedTrainIndex = makeSpecifiedVariableName('train_index', flag)
        let specifiedTestIndex = makeSpecifiedVariableName('test_index', flag)
      
        // this is not alphas array at the beginning
        window.vueApp[specifiedPointsMesh].geometry.attributes.alpha.array = updateShowingIndices(window.vueApp[specifiedPointsMesh].geometry.attributes.alpha.array, window.vueApp[specifiedShowTraining], window.vueApp[specifiedTrainIndex], window.vueApp[specifiedPredictionFlipIndices])
        window.vueApp[specifiedPointsMesh].geometry.attributes.alpha.array = updateShowingIndices(window.vueApp[specifiedPointsMesh].geometry.attributes.alpha.array, window.vueApp[specifiedShowTesting], window.vueApp[specifiedTestIndex], window.vueApp[specifiedPredictionFlipIndices])
        // update position z index to allow currDisplay indices show above 
      
        for (let i = 0; i < window.vueApp[specifiedPointsMesh].geometry.attributes.alpha.array.length; i++) {
            var zIndex = i * 3 + 2; 
            window.vueApp[specifiedPointsMesh].geometry.attributes.position.array[zIndex] = window.vueApp[specifiedPointsMesh].geometry.attributes.alpha.array[i] === 1 ? 0 : -1;
        }
        
  
        window.vueApp[specifiedPointsMesh].geometry.attributes.position.needsUpdate = true;
        window.vueApp[specifiedPointsMesh].geometry.attributes.alpha.needsUpdate = true;
    }
  
    // In the Vue instance where you want to observe changes
    let specifiedHighlightAttributes = makeSpecifiedVariableName('highlightAttributes', flag)
    window.vueApp.$watch(specifiedHighlightAttributes, updateHighlights, {
        deep: true // Use this if specifiedHighlightAttributes is an object to detect nested changes
    });

    function updateHighlights() {
        console.log("updateHihglight")
        var indicesToChangeYellow = window.vueApp[specifiedHighlightAttributes].highlightedPointsYellow
        var indicesToChangeBlue = window.vueApp[specifiedHighlightAttributes].highlightedPointsBlue
        var indicesToChangeGreen = window.vueApp[specifiedHighlightAttributes].highlightedPointsGreen
        var indicesAllHighlighted =  window.vueApp[specifiedHighlightAttributes].allHighlightedSet
        var visError = window.vueApp[specifiedHighlightAttributes].visualizationError
        if (indicesToChangeYellow == null) {
            indicesToChangeYellow = []
        } else {
            indicesToChangeYellow  = Array.from(indicesToChangeYellow)
        }
        if (indicesToChangeBlue == null) {
            indicesToChangeBlue = []
        } else {
            indicesToChangeBlue = Array.from(indicesToChangeBlue)
        }
        if (indicesToChangeGreen == null) {
            indicesToChangeGreen = []
        } else {
            indicesToChangeGreen = Array.from(indicesToChangeGreen)
        }
        if (indicesAllHighlighted == null) {
            indicesAllHighlighted = []
        } else {
            indicesAllHighlighted = Array.from(indicesAllHighlighted)
        }
        if (visError == null) {
            visError = []
        } else {
            visError = Array.from(visError)
        }
        
        resetToOriginalColorSize(flag)

        updateColorSizeForHighlights(indicesAllHighlighted, indicesToChangeYellow, indicesToChangeBlue, indicesToChangeGreen, visError)
        // console.log("GreenIndices", indicesToChangeGreen)
        // console.log("YELLOWndices", indicesToChangeYellow)
        // console.log("BLUEIndices", indicesToChangeBlue)
        // console.log('visError', visError)
        var boldIndices = window.vueApp[specifiedHighlightAttributes].boldIndices
        if (boldIndices == null) {
            boldIndices = []
        } else {
           boldIndices = Array.from(boldIndices)
        }
        updateColorSizeForBoldIndices(boldIndices)
        //reset variables to clear storage
        indicesToChangeYellow = null
        indicesToChangeBlue = null
        indicesToChangeGreen = null
        indicesAllHighlighted = null
        visError = null
        boldIndices = null
    }
  
    function updateColorSizeForHighlights(indicesAllHighlighted, indicesToChangeYellow, indicesToChangeBlue, indicesToChangeGreen, visError) {
        indicesAllHighlighted.forEach(index => {
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('size').array[index] = HOVER_SIZE;
        });
        visError.forEach(index => {
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('size').array[index] = HOVER_SIZE;
        });
        window.vueApp[specifiedPointsMesh].geometry.getAttribute('size').needsUpdate = true; 

        // yellow indices are triggered by right selected index

        indicesToChangeYellow.forEach(index => {
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array[index * 3] = YELLOW[0]; // R
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array[index * 3 + 1] = YELLOW[1]; // G
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array[index * 3 + 2] = YELLOW[2]; // B
        });

        // blue indices are triggered by left selected index
        indicesToChangeBlue.forEach(index => {
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array[index * 3] = BLUE[0]; // R
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array[index * 3 + 1] = BLUE[1]; // G
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array[index * 3 + 2] = BLUE[2]; // B
        });

        // green indices represent intersection of blue and yellow indices
        indicesToChangeGreen.forEach(index => {
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array[index * 3] = GREEN[0]; // R
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array[index * 3 + 1] = GREEN[1]; // G
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array[index * 3 + 2] = GREEN[2]; // B
        });

        // gray indices represent visualization errors, this will reset original colors, since it has higher pripority
        visError.forEach(index => {
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array[index * 3] = GRAY[0]; // R
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array[index * 3 + 1] = GRAY[1]; // G
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array[index * 3 + 2] = GRAY[2]; // B
        });

        window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').needsUpdate = true; 
        indicesToChangeYellow = null
        indicesToChangeBlue = null
        indicesToChangeGreen = null
        indicesAllHighlighted = null
        visError = null
    }

    function updateColorSizeForBoldIndices(boldIndices) {
        // bold indices have color orange
        boldIndices.forEach(index => {
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('size').array[index] = HOVER_SIZE;
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array[index * 3] = ORANGE[0]; // R
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array[index * 3 + 1] = ORANGE[1]; // G
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array[index * 3 + 2] = ORANGE[2]; // B
        });
        window.vueApp[specifiedPointsMesh].geometry.getAttribute('size').needsUpdate = true; 
        window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').needsUpdate = true; 
        // show Label for bold indices
        var lens = boldIndices.length
        for (var i = 0; i < lens; i++) {
            var pointPosition = new THREE.Vector3();
            // usually boldIndices has size 1
            pointPosition.fromBufferAttribute(window.vueApp[specifiedPointsMesh].geometry.attributes.position, boldIndices[i]);
            updateLabelPosition(flag, pointPosition, boldIndices[i], boldLable + i, true)
            
        }
    }

    function resetToOriginalColorSize() {
        var specifiedSelectedIndex = makeSpecifiedVariableName('selectedIndex', flag)
        var specifiedPointsMesh = makeSpecifiedVariableName('pointsMesh', flag)
        var specifiedOriginalSettings = makeSpecifiedVariableName('originalSettings', flag)
    
    
        // console.log("reset", window.vueApp[specifiedPointsMesh].geometry.getAttribute('size'))
    
        window.vueApp[specifiedPointsMesh].geometry.getAttribute('size').array.set(window.vueApp[specifiedOriginalSettings].originalSizes);
        window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array.set(window.vueApp[specifiedOriginalSettings].originalColors);
        // not reset selectedIndex
        if ( window.vueApp[specifiedSelectedIndex]) {
            window.vueApp[specifiedPointsMesh].geometry.getAttribute('size').array[window.vueApp[specifiedSelectedIndex]] = HOVER_SIZE
        }
    
        // Mark as needing update
        window.vueApp[specifiedPointsMesh].geometry.getAttribute('size').needsUpdate = true;
        window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').needsUpdate = true;
    
        // clear all bold labels
        var lens = 2
        for (var i = 0; i < lens; i++) {
            updateFixedHoverLabel(null, null, null, flag, null, boldLable + i, false)
        }
    
    }
    container.addEventListener('mousemove', onMouseMove, false);


    //  =========================  鼠标拖拽功能  开始 =========================================== //
    // 鼠标按下事件
    container.addEventListener('mousedown', function (e) {
        isDragging = true;

        container.style.cursor = 'move';
        previousMousePosition.x = e.clientX;
        previousMousePosition.y = e.clientY;
    });

    // 鼠标移动事件
    container.addEventListener('mousemove', function (e) {
        if (isDragging) {
            const currentZoom = window.vueApp.camera[flag].zoom;
        
            let deltaX = e.clientX - previousMousePosition.x;
            let deltaY = e.clientY - previousMousePosition.y;
    
            const viewportWidth = window.vueApp.renderer[flag].domElement.clientWidth;
            const viewportHeight = window.vueApp.renderer[flag].domElement.clientHeight;
    
            // Scale factors
            const scaleX = (window.vueApp.camera[flag].right - window.vueApp.camera[flag].left) / viewportWidth;
            const scaleY = (window.vueApp.camera[flag].top - window.vueApp.camera[flag].bottom) / viewportHeight;
    
            // Convert pixel movement to world units
            deltaX = (deltaX * scaleX) / currentZoom;
            deltaY = (deltaY * scaleY) / currentZoom;
    
            // Update the camera position based on the scaled delta
            var newPosX = window.vueApp.camera[flag].position.x - deltaX * 1;
            var newPosY = window.vueApp.camera[flag].position.y + deltaY * 1;

            newPosX = Math.max(cameraBounds.minX, Math.min(newPosX, cameraBounds.maxX));
            newPosY = Math.max(cameraBounds.minY, Math.min(newPosY, cameraBounds.maxY));
             // update camera position
            window.vueApp.camera[flag].position.x = newPosX;
            window.vueApp.camera[flag].position.y = newPosY;
            // update previous mouse position
            previousMousePosition = {
                x: e.clientX,
                y: e.clientY
            };
         
            var specifiedSelectedIndex = makeSpecifiedVariableName('selectedIndex', flag)
            var specifiedSelectedPointPosition = makeSpecifiedVariableName('selectedPointPosition', flag)
            updateLabelPosition(flag, window.vueApp[specifiedSelectedPointPosition], window.vueApp[specifiedSelectedIndex], selectedLabel, true)
        

            var specifiedHighlightAttributes = makeSpecifiedVariableName('highlightAttributes', flag)
            if (window.vueApp[specifiedHighlightAttributes].boldIndices) {
                var lens = window.vueApp[specifiedHighlightAttributes].boldIndices.length
                for (var i = 0; i < lens; i++) {
                    var pointPosition = new THREE.Vector3();
                    // usually boldIndices has size 1
                    pointPosition.fromBufferAttribute(window.vueApp[specifiedPointsMesh].geometry.attributes.position, window.vueApp[specifiedHighlightAttributes].boldIndices[i]);
                    updateLabelPosition(flag, pointPosition, window.vueApp[specifiedHighlightAttributes].boldIndices[i], boldLable + i, true)
                }
            }
            //todo
            updateCurrHoverIndex(e, null, true, flag)
        }
    });


    // 鼠标松开事件
    container.addEventListener('mouseup', function (e) {
        isDragging = false;
        container.style.cursor = 'default';
    });

    //  =========================  鼠标拖拽功能  结束 =========================================== //

    // 添加光源
    var light = new THREE.PointLight(0xffffff, 1, 500);
    light.position.set(50, 50, 50);
    var ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 第二个参数是光照强度
    window.vueApp.scene[flag].add(ambientLight);
    window.vueApp.scene[flag].add(light);

    // 设置相机位置
    window.vueApp.camera[flag].position.z = 30;

    // 渲染循环
    function animate() {

        window.vueApp.animationFrameId[flag] = requestAnimationFrame(animate);
        window.vueApp.renderer[flag].render(window.vueApp.scene[flag], window.vueApp.camera[flag]);

    }
    animate();
    window.vueApp.isCanvasLoading = false
}


window.onload = function() {
    let specifiedCurrHoverRef = makeSpecifiedVariableName('currHover', 'ref')
    let specifiedCurrHoverTar = makeSpecifiedVariableName('currHover', 'tar')
    const currHover1 = document.getElementById(specifiedCurrHoverRef);
    const currHover2 = document.getElementById(specifiedCurrHoverTar);

    makeDraggable(currHover1, currHover1);
    makeDraggable(currHover2, currHover2);
};

function contrast_show_query_text() {
    resultContainer = document.getElementById("resultContainer");
    resultContainer.setAttribute("style", "display:block;")
}

function labelColorRef(){
    const labels = window.vueApp.label_name_dictRef;
    const colors = window.vueApp.color_listRef;

    const tableBody = document.querySelector('#labelColorRef tbody');
    tableBody.innerHTML = '';

    Object.keys(labels).forEach((key, index) => {
        const row = document.createElement('tr');

        // 创建标签名单元格
        const labelCell = document.createElement('td');
        labelCell.textContent = labels[key];
        row.appendChild(labelCell);

        // 创建颜色单元格
        const colorCell = document.createElement('td');
        const colorDiv = document.createElement('div');
        colorDiv.style.width = '30px';
        colorDiv.style.height = '20px';
        colorDiv.style.backgroundColor = `rgb(${colors[index]})`;
        colorCell.appendChild(colorDiv);
        row.appendChild(colorCell);

        // 将行添加到表格中
        tableBody.appendChild(row);
    });
}

function labelColorTar(){
    const labels = window.vueApp.label_name_dictTar;
    const colors = window.vueApp.color_listTar;

    const tableBody = document.querySelector('#labelColorTar tbody');
    tableBody.innerHTML = '';

    Object.keys(labels).forEach((key, index) => {
        const row = document.createElement('tr');

        // 创建标签名单元格
        const labelCell = document.createElement('td');
        labelCell.textContent = labels[key];
        row.appendChild(labelCell);

        // 创建颜色单元格
        const colorCell = document.createElement('td');
        const colorDiv = document.createElement('div');
        colorDiv.style.width = '30px';
        colorDiv.style.height = '20px';
        colorDiv.style.backgroundColor = `rgb(${colors[index]})`;
        colorCell.appendChild(colorDiv);
        row.appendChild(colorCell);

        // 将行添加到表格中
        tableBody.appendChild(row);
    });
}