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
const SELECTED_SIZE = 15
const MAX_FOV = 70;
const MIN_FOV = 1
const GRAY = [0.8,0.8,0.8]
const selectedLabel = 'fixedHoverLabel'
var baseZoomSpeed = 0.01;
var isDragging = false;
var previousMousePosition = {
    x: 0,
    y: 0
};

  function drawCanvas(res) {
    // clean storage
    cleanForEpochChange('')

    container = document.getElementById("container")

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
    window.vueApp.scene = new THREE.Scene();
    // get the boundary of the scene
    window.vueApp.sceneBoundary.x_min = res.grid_index[0]
    window.vueApp.sceneBoundary.y_min =res.grid_index[1]
    window.vueApp.sceneBoundary.x_max = res.grid_index[2]
    window.vueApp.sceneBoundary.y_max =res.grid_index[3]


    const cameraBounds = {
        minX: window.vueApp.sceneBoundary.x_min,
        maxX: window.vueApp.sceneBoundary.x_max,
        minY: window.vueApp.sceneBoundary.y_min,
        maxY: window.vueApp.sceneBoundary.y_max
    };
    var aspect = 1
    const rect = container.getBoundingClientRect();
    const target = new THREE.Vector3(
        0, 0, 0
    );
    // based on screen size set the camera view 
    var aspectRatio = rect.width / rect.height;

    window.vueApp.camera = new THREE.OrthographicCamera(
        window.vueApp.sceneBoundary.x_min * aspect,
         window.vueApp.sceneBoundary.x_max * aspect,
          window.vueApp.sceneBoundary.y_max,
          window.vueApp.sceneBoundary.y_min,
          1, 1000);

    // set current camera position, and sceneBoundary is used to restore the camera position later.
    window.vueApp.camera.position.set(0, 0, 100); // This will set 3d position of camera, it is important to ensure camera's angle of view will not distort 
    window.vueApp.camera.left = window.vueApp.sceneBoundary.x_min * aspectRatio;
    window.vueApp.camera.right =  window.vueApp.sceneBoundary.x_max * aspectRatio;
    window.vueApp.camera.top = window.vueApp.sceneBoundary.y_max;
    window.vueApp.camera.bottom = window.vueApp.sceneBoundary.y_min;
    window.vueApp.camera.fov = MAX_FOV

    window.vueApp.camera.updateProjectionMatrix();
    window.vueApp.camera.lookAt(target);
    window.vueApp.renderer = new THREE.WebGLRenderer();
    window.vueApp.renderer.setSize(rect.width, rect.height);
    window.vueApp.renderer.setClearColor(BACKGROUND_COLOR, 1);

    function onDocumentMouseWheel(event) {
        const currentZoom = window.vueApp.camera.zoom;
        var zoomSpeed = calculateZoomSpeed(currentZoom, baseZoomSpeed, MAX_ZOOM_SCALE); 
        // Apply the zoom speed to calculate the new zoom level
        var newZoom = currentZoom + event.deltaY * -zoomSpeed;
        newZoom = Math.max(MIN_ZOOM_SCALE, Math.min(newZoom, MAX_ZOOM_SCALE)); 
        window.vueApp.camera.zoom = newZoom;
        window.vueApp.camera.updateProjectionMatrix();
        // Call function to update current hover index or any other updates needed after zoom
        // updateCurrHoverIndex(event, null, true, '');
        // updateLabelPosition('', window.vueApp.selectedPointPosition, window.vueApp.selectedIndex, selectedLabel, true)
    }


    container.addEventListener('wheel', onDocumentMouseWheel, false)

    container.addEventListener('wheel', function (event) {
        event.preventDefault();
    })

    container.appendChild(window.vueApp.renderer.domElement);
    // calculate the size and the center position
    var width = window.vueApp.sceneBoundary.x_max - window.vueApp.sceneBoundary.x_min;
    var height = window.vueApp.sceneBoundary.y_max - window.vueApp.sceneBoundary.y_min;
    var centerX = window.vueApp.sceneBoundary.x_min+ width / 2;
    var centerY = window.vueApp.sceneBoundary.y_min + height / 2;

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
        texture.needsUpdate = true; // 不设置needsUpdate为true的话，可能纹理贴图不刷新
        var plane_geometry = new THREE.PlaneGeometry(width, height);
        var material = new THREE.MeshPhongMaterial({
            map: texture,
            side: THREE.DoubleSide
        });
        const newMesh = new THREE.Mesh(plane_geometry, material);
        newMesh.position.set(centerX, centerY, 0);
        window.vueApp.scene.add(newMesh);
    }

    // 创建数据点
    var dataPoints = res.result
    

    dataPoints.push()
    var color = res.label_color_list
    // console.log("originalColorsDraw",color )
    // var geometry = new THREE.BufferGeometry();
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
    console.log("datapoints", dataPoints.length)

    var geometry = new THREE.BufferGeometry();
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

    window.vueApp.pointsMesh  = new THREE.Points(geometry, shaderMaterial);

    // Save original sizes

    if (window.vueApp.pointsMesh.geometry.getAttribute('size')) {
        window.vueApp.originalSettings.originalSizes = Array.from(window.vueApp.pointsMesh.geometry.getAttribute('size').array);
    }

    // Save original colors
    if (window.vueApp.pointsMesh.geometry.getAttribute('color')) {
        window.vueApp.originalSettings.originalColors = Array.from(window.vueApp.pointsMesh.geometry.getAttribute('color').array);
    }
    


    if (window.vueApp.selectedIndex) {
        window.vueApp.pointsMesh.geometry.attributes.size.array[window.vueApp.selectedIndex] = HOVER_SIZE
        // points.geometry.attributes.color.array[window.vueApp.selectedIndex] = SELECTED_COLOR
        // update selected point position in new epoch 
        var pointPosition = new THREE.Vector3();
        pointPosition.fromBufferAttribute(window.vueApp.pointsMesh.geometry.attributes.position, window.vueApp.selectedIndex);
        window.vueApp.selectedPointPosition = pointPosition;
        window.vueApp.pointsMesh.geometry.attributes.size.needsUpdate = true
        // updateLabelPosition('', window.vueApp.selectedPointPosition, window.vueApp.selectedIndex, selectedLabel, true)
    }

    window.vueApp.scene.add(window.vueApp.pointsMesh);

    // 创建 Raycaster 和 mouse 变量
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();
    // var distance = camera.position.distanceTo(points.position); // 相机到点云中心的距离
    // var threshold = distance * 0.1; // 根据距离动态调整阈值，这里的0.01是系数，可能需要调整
    // raycaster.params.Points.threshold = threshold;

    function updateLastHoverIndexSize(lastHoveredIndex,  selectedIndex, visualizationError, nnIndices) {
        if (lastHoveredIndex != null) {
            var isNormalSize = true;
            if (selectedIndex != null) {
                if (lastHoveredIndex == selectedIndex) {
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
                window.vueApp.pointsMesh.geometry.attributes.size.array[lastHoveredIndex] = NORMAL_SIZE; 
            } else {
                window.vueApp.pointsMesh.geometry.attributes.size.array[lastHoveredIndex] = HOVER_SIZE; 
            }
            nnIndices.forEach((item, index) => {
                window.vueApp.pointsMesh.geometry.attributes.size.array[item] = NORMAL_SIZE
            });
        }
      }
      
    //  =========================  hover  start =========================================== //
    function onMouseMove(event) {
        window.vueApp.pointsMesh.geometry.attributes.size.array.fill(NORMAL_SIZE);

        window.vueApp.selectedIndex.forEach(index => {
            window.vueApp.pointsMesh.geometry.getAttribute('size').array[index] = SELECTED_SIZE;
        });
        window.vueApp.pointsMesh.geometry.getAttribute('size').needsUpdate = true; 
        raycaster.params.Points.threshold = 0.2 / window.vueApp.camera.zoom; // 根据点的屏幕大小调整
        // 转换鼠标位置到归一化设备坐标 (NDC)
        var rect = window.vueApp.renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
   
        // 通过鼠标位置更新射线
        raycaster.setFromCamera(mouse, window.vueApp.camera);
        // 检测射线与点云的相交
        var intersects = raycaster.intersectObject(window.vueApp.pointsMesh);
        let specifiedLastHoveredIndex = makeSpecifiedVariableName('lastHoveredIndex', '')
        let specifiedImageSrc = makeSpecifiedVariableName('imageSrc', '')
        let specifiedSelectedIndex = makeSpecifiedVariableName('selectedIndex', '')

        if (intersects.length > 0 && checkVisibility(window.vueApp.pointsMesh.geometry.attributes.alpha.array, intersects[0].index)) {

            // 获取最接近的交点
            var intersect = intersects[0];

            // 获取索引 - 这需要根据具体实现来确定如何获取
            var ind = intersect.index;
            window.vueApp.curIndex = ind
            if(window.vueApp.filter_index!=''){
                console.log("window.vueApp.filter_index",window.vueApp.filter_index)
                filter_index = window.vueApp.filter_index.split(',')
                index = filter_index[ind]
            }else{
                index = ind
            }

            if(window.vueApp.selectedIndex.includes(index)) {
                return
            }
           
            // 在这里处理悬停事件
            if (window.vueApp.lastHoveredIndex != index) {
                updateLastHoverIndexSize(window.vueApp[specifiedLastHoveredIndex],  window.vueApp[specifiedSelectedIndex], 
                    window.vueApp[specifiedHighlightAttributes].visualizationError, window.vueApp.nnIndices)
                container.style.cursor = 'pointer';
                window.vueApp.pointsMesh.geometry.attributes.size.array[index] = HOVER_SIZE
                window.vueApp.pointsMesh.geometry.attributes.size.needsUpdate = true;
                window.vueApp[specifiedLastHoveredIndex] = index;
                updateCurrHoverIndex(event, index, false, '')
            }
        } else {
            container.style.cursor = 'default';
            // 如果没有悬停在任何点上，也重置上一个点的大小
            if (window.vueApp.lastHoveredIndex !== null) {
                updateLastHoverIndexSize(window.vueApp[specifiedLastHoveredIndex],  window.vueApp[specifiedSelectedIndex], 
                    window.vueApp[specifiedHighlightAttributes].visualizationError, window.vueApp.nnIndices)
                window.vueApp.pointsMesh.geometry.attributes.size.needsUpdate = true;
                window.vueApp[specifiedLastHoveredIndex] = null;
                window.vueApp.nnIndices = []
                window.vueApp[specifiedImageSrc] = ""
                updateCurrHoverIndex(event, null, false, '')
            }
        }
    }
    //  =========================  hover  end =========================================== //
    var specifiedShowTesting = makeSpecifiedVariableName('showTesting', '')
    var specifiedShowTraining = makeSpecifiedVariableName('showTraining', '')
    var specifiedPredictionFlipIndices = makeSpecifiedVariableName('predictionFlipIndices', '')
    // var specifiedOriginalSettings = makeSpecifiedVariableName('originalSettings', '')

    window.vueApp.$watch(specifiedShowTesting, updateCurrentDisplay);
    window.vueApp.$watch(specifiedShowTraining, updateCurrentDisplay);
    window.vueApp.$watch(specifiedPredictionFlipIndices, updateCurrentDisplay);  
    // window.vueApp.$watch(specifiedOriginalSettings, resetToOriginalColorSize, { deep: true });

    function updateCurrentDisplay() {
        console.log("currDisplay")
        let specifiedTrainIndex = makeSpecifiedVariableName('train_index', '')
        let specifiedTestIndex = makeSpecifiedVariableName('test_index', '')

        window.vueApp.pointsMesh.geometry.attributes.alpha.array = updateShowingIndices(window.vueApp.pointsMesh.geometry.attributes.alpha.array, window.vueApp[specifiedShowTraining], window.vueApp[specifiedTrainIndex], window.vueApp[specifiedPredictionFlipIndices])
        window.vueApp.pointsMesh.geometry.attributes.alpha.array = updateShowingIndices(window.vueApp.pointsMesh.geometry.attributes.alpha.array, window.vueApp[specifiedShowTesting], window.vueApp[specifiedTestIndex], window.vueApp[specifiedPredictionFlipIndices])

        // update position z index to allow currDisplay indices show above 
        for (let i = 0; i < window.vueApp.pointsMesh.geometry.attributes.alpha.array.length; i++) {
            var zIndex = i * 3 + 2; 
            window.vueApp.pointsMesh.geometry.attributes.position.array[zIndex] = window.vueApp.pointsMesh.geometry.attributes.alpha.array[i] === 1 ? 0 : -1;
        }
        
  
        window.vueApp.pointsMesh.geometry.attributes.position.needsUpdate = true;
        window.vueApp.pointsMesh.geometry.attributes.alpha.needsUpdate = true;
    }
  
  
   
    // In the Vue instance where you want to observe changes
    let specifiedHighlightAttributes= makeSpecifiedVariableName('highlightAttributes', '')
    window.vueApp.$watch(specifiedHighlightAttributes, updateHighlights, {
        deep: true // Use this if specifiedHighlightAttributes is an object to detect nested changes
    });

    function updateHighlights() {
        console.log("updateHihglight")
        var visualizationError = window.vueApp[specifiedHighlightAttributes].visualizationError
        if (visualizationError== null) {
            visualizationError = []
        } else {
            visualizationError = Array.from(visualizationError)
        }
        resetToOriginalColorSize()

        updateColorSizeForHighlights(visualizationError)
        visualizationError = []
    }

    function updateColorSizeForHighlights(visualizationError) {
        visualizationError.forEach(index => {
            window.vueApp.pointsMesh.geometry.getAttribute('size').array[index] = HOVER_SIZE;
        });
        window.vueApp.pointsMesh.geometry.getAttribute('size').needsUpdate = true; 

        // yellow indices are triggered by right selected index
        visualizationError.forEach(index => {
            window.vueApp.pointsMesh.geometry.getAttribute('color').array[index * 3] = GRAY[0]; // R
            window.vueApp.pointsMesh.geometry.getAttribute('color').array[index * 3 + 1] = GRAY[1]; // G
            window.vueApp.pointsMesh.geometry.getAttribute('color').array[index * 3 + 2] = GRAY[2]; // B
        });

        window.vueApp.pointsMesh.geometry.getAttribute('color').needsUpdate = true; 
    }

    function resetToOriginalColorSize() {
        var specifiedSelectedIndex = makeSpecifiedVariableName('selectedIndex', '')
        window.vueApp.pointsMesh.geometry.getAttribute('size').array.set(window.vueApp.originalSettings.originalSizes);
        window.vueApp.pointsMesh.geometry.getAttribute('color').array.set(window.vueApp.originalSettings.originalColors);
        // not reset selectedIndex
        if ( window.vueApp[specifiedSelectedIndex]) {
            window.vueApp.pointsMesh.geometry.getAttribute('size').array[window.vueApp[specifiedSelectedIndex]] = HOVER_SIZE
        }
    
        // Mark as needing update
        window.vueApp.pointsMesh.geometry.getAttribute('size').needsUpdate = true;
        window.vueApp.pointsMesh.geometry.getAttribute('color').needsUpdate = true;
        // console.log("resetColor", window.vueApp.originalSettings.originalColors)
        
    }

    container.addEventListener('mousemove', onMouseMove, false);

     //  =========================  db click start =========================================== //
    container.addEventListener('dblclick', onDoubleClick);

    function onDoubleClick(event) {
        
        // Raycasting to find the intersected point
        var rect = window.vueApp.renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, window.vueApp.camera);
        var intersects = raycaster.intersectObject(window.vueApp.pointsMesh);
        
        if (intersects.length > 0 && checkVisibility(window.vueApp.pointsMesh.geometry.attributes.alpha.array, intersects[0].index)) {
            if (window.vueApp.selectedIndex != null) {
                window.vueApp.pointsMesh.geometry.attributes.size.array[window.vueApp.selectedIndex] = NORMAL_SIZE; 
                window.vueApp.pointsMesh.geometry.attributes.size.needsUpdate = true;
            }
          // Get the index and position of the double-clicked point
          var intersect = intersects[0];
          if(window.vueApp.selectedIndex.includes(intersect.index)){
            return
          }
          console.log("window.vueApp.selectedIndex",window.vueApp.selectedIndex)
          window.vueApp.selectedIndex.push(intersect.index);
          console.log("window.vueApp.selectedIndex after push",window.vueApp.selectedIndex)

          let camera = window.vueApp.camera
          let canvas = window.vueApp.renderer.domElement;
          console.log("window.vueApp.selectedInde",window.vueApp.selectedPointPos)

          let vector = intersect.point.clone().project(camera);

    
          vector.x =  Math.round((vector.x * 0.5 + 0.5) * canvas.clientWidth);
          vector.y = - Math.round((vector.y * 0.5 - 0.5) * canvas.clientHeight);
  
         let rect = canvas.getBoundingClientRect();
         vector.x += rect.left;
         vector.y += rect.top;

          window.vueApp.selectedPointPos.push({'x':vector.x,'y':vector.y})
          console.log("window.vueApp.selectedIndex after push",window.vueApp.selectedPointPos)
        //   window.vueApp.pointsMesh.geometry.attributes.size.array[window.vueApp.selectedIndex] = HOVER_SIZE; 
          window.vueApp.selectedIndex.forEach(index => {
            window.vueApp.pointsMesh.geometry.getAttribute('size').array[index] = SELECTED_SIZE;
        });
        window.vueApp.pointsMesh.geometry.getAttribute('size').needsUpdate = true; 
        //   for(i=0;i<window.vueApp.selectedPointPos;i++){
        //     let pos = window.vueApp.selectedPointPos[i]

        //     updateFixedHoverLabel(pos.x,pos.y,window.vueApp.selectedIndex[i], selectedLabel,true )
        //   }


        // updateLabelPosition('', window.vueApp.selectedPointPosition, window.vueApp.selectedIndex, selectedLabel, true)

        } else {
        // reset previous selected point to normal size 
        //   window.vueApp.pointsMesh.geometry.attributes.size.array[window.vueApp.selectedIndex] = NORMAL_SIZE; 
        //   window.vueApp.pointsMesh.geometry.attributes.size.needsUpdate = true;
        //   // If the canvas was double-clicked without hitting a point, hide the label and reset
        //   window.vueApp.selectedIndex = [];
        //   window.vueApp.selectedPointPosition = [];
        //   updateFixedHoverLabel(null, null, null, '', null, selectedLabel, false)
        }
      }

     //  =========================  db click  end =========================================== //

    //  =========================  Drag start =========================================== //
    container.addEventListener('mousedown', function (e) {
        if (window.vueApp.SelectionMode && window.vueApp.isShifting) {

        } else {
            isDragging = true;
            console.log(isDragging)
            container.style.cursor = 'move';
            previousMousePosition.x = e.clientX;
            previousMousePosition.y = e.clientY;
        }
    });

    // handel mouse move
    container.addEventListener('mousemove', function (e) {
        if (isDragging) {
            const currentZoom = window.vueApp.camera.zoom;

            let deltaX = e.clientX - previousMousePosition.x;
            let deltaY = e.clientY - previousMousePosition.y;
    
            const viewportWidth = window.vueApp.renderer.domElement.clientWidth;
            const viewportHeight = window.vueApp.renderer.domElement.clientHeight;
    
            // Scale factors
            const scaleX = (window.vueApp.camera.right - window.vueApp.camera.left) / viewportWidth;
            const scaleY = (window.vueApp.camera.top - window.vueApp.camera.bottom) / viewportHeight;
    
            // Convert pixel movement to world units
            deltaX = (deltaX * scaleX) / currentZoom;
            deltaY = (deltaY * scaleY) / currentZoom;
    
            // Update the camera position based on the scaled delta
            var newPosX = window.vueApp.camera.position.x - deltaX * 1;
            var newPosY = window.vueApp.camera.position.y + deltaY * 1;

            newPosX = Math.max(cameraBounds.minX, Math.min(newPosX, cameraBounds.maxX));
            newPosY = Math.max(cameraBounds.minY, Math.min(newPosY, cameraBounds.maxY));
      // update camera position
            window.vueApp.camera.position.x = newPosX;
            window.vueApp.camera.position.y = newPosY;
            // update previous mouse position
            previousMousePosition = {
                x: e.clientX,
                y: e.clientY
            };
            // updateLabelPosition('', window.vueApp.selectedPointPosition, window.vueApp.selectedIndex, selectedLabel, true)
            updateCurrHoverIndex(e, null, true, '')
        }
    });

    // mouse up event
    container.addEventListener('mouseup', function (e) {
        isDragging = false;
        container.style.cursor = 'default';
    });

    //  =========================  Drag  end =========================================== //
      
    // create light
    var light = new THREE.PointLight(0xffffff, 1, 500);
    light.position.set(50, 50, 50);
    var ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // The second parameter is the light intensity
    window.vueApp.scene.add(ambientLight);
    window.vueApp.scene.add(light);

    // set the camera position
    window.vueApp.camera.position.z = 30;

    // render
    function animate() {
        window.vueApp.animationFrameId = requestAnimationFrame(animate);
        window.vueApp.renderer.render(window.vueApp.scene, window.vueApp.camera);
    }
    animate();
    window.vueApp.isCanvasLoading = false
}



window.onload = function() {
    const currHover = document.getElementById('currHover');
    makeDraggable(currHover, currHover);
  };


function updateSizes() {
    // const nn = []; // 创建一个空的 sizes 列表
    window.vueApp.nnIndices.forEach((item, index) => {
        window.vueApp.pointsMesh.geometry.attributes.size.array[item] = NORMAL_SIZE
    });
    window.vueApp.pointsMesh.geometry.attributes.size.needsUpdate = true;
    window.vueApp.nnIndices = []
    Object.values(window.vueApp.query_result).forEach(item => {
        if (typeof item === 'object' && item !== null) {
            window.vueApp.nnIndices.push(item.id);
            window.vueApp.nnIndices.push(item.id);
        }
    });
    console.log(window.vueApp.nnIndices)
    window.vueApp.nnIndices.forEach((item, index) => {
        window.vueApp.pointsMesh.geometry.attributes.size.array[item] = HOVER_SIZE
    });
    window.vueApp.pointsMesh.geometry.attributes.size.needsUpdate = true;
    resultContainer = document.getElementById("resultContainer");
    resultContainer.setAttribute("style", "display:block;")
}

function clear() {
    window.vueApp.nnIndices.forEach((item, index) => {
        window.vueApp.pointsMesh.geometry.attributes.size.array[item] = NORMAL_SIZE
    });
    window.vueApp.pointsMesh.geometry.attributes.size.needsUpdate = true;
    window.vueApp.nnIndices = []
    resultContainer = document.getElementById("resultContainer");
    resultContainer.setAttribute("style", "display:none;")
}

function show_query_text() {
    resultContainer = document.getElementById("resultContainer");
    resultContainer.setAttribute("style", "display:block;")
}

function labelColor(){
    const labels = window.vueApp.label_name_dict;
    const colors = window.vueApp.color_list;

    const tableBody = document.querySelector('#labelColor tbody');
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
