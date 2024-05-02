/*
this file define the apis
*/

// defined headers
let headers = new Headers();
headers.append('Content-Type', 'application/json');
headers.append('Accept', 'application/json');

// updateProjection

function updateProjection(content_path, iteration, taskType) {

    console.log(content_path,iteration)
    fetch(`${window.location.href}updateProjection`, {
        method: 'POST',
        body: JSON.stringify({
            "path": content_path, 
            "iteration": iteration,
            "resolution": 200,
            "vis_method": window.vueApp.visMethod,
            'setting': 'normal',
            "content_path": content_path,
            "predicates": {},
            "TaskType": taskType,
            "selectedPoints":window.vueApp.filter_index,
        }),
        headers: headers,
        mode: 'cors'
    })
    .then(response => response.json())
    .then(res => {
        if (res.errorMessage != "") {
          if (window.vueApp.errorMessage) {
            window.vueApp.errorMessage =  res.errorMessage
          } else {
            alert(res.errorMessage)
            window.vueApp.errorMessage =  res.errorMessage
          }
        }
       
        drawCanvas(res);
        window.vueApp.prediction_list = res.prediction_list
        window.vueApp.label_list = res.label_list
        window.vueApp.label_name_dict = res.label_name_dict
        window.vueApp.color_list = res.color_list
        window.vueApp.evaluation = res.evaluation
        window.vueApp.currEpoch = iteration
        window.vueApp.test_index = res.testing_data
        window.vueApp.train_index = res.training_data
        window.vueApp.confidence_list = res.confidence_list
        labelColor();
    })
    .catch(error => {
        console.error('Error fetching data:', error);
        window.vueApp.isCanvasLoading = false
        window.vueApp.$message({
            type: 'error',
            message: `Unknown Backend Error`
          });
    });
}
  function fetchTimelineData(content_path, flag){
    fetch(`${window.location.href}/get_itertaion_structure?path=${content_path}&method=Trustvis&setting=normal`, {
        method: 'POST',
        headers: headers,
        mode: 'cors'
      })
      .then(response => response.json())
        .then(res => {
            var specifiedTotalEpoch = makeSpecifiedVariableName('totalEpoch', flag)
            window.vueApp[specifiedTotalEpoch] = res.structure.length
            drawTimeline(res, flag)
        })
}

  function getOriginalData(content_path,index, dataType, flag, custom_path){
    if(index != null){
        let specifiedCurrEpoch = makeSpecifiedVariableName('currEpoch', flag)
        fetch(`${window.location.href}/sprite${dataType}?index=${index}&path=${content_path}&cus_path=${custom_path}&username=admin&iteration=${window.vueApp[specifiedCurrEpoch]}&`, {
            method: 'GET',
            mode: 'cors'
          }).then(response => response.json()).then(data => {
            if (dataType == "Image") {
                src = data.imgUrl
                let specifiedImageSrc = makeSpecifiedVariableName('imageSrc', flag)
                if (src && src.length) {
                    window.vueApp[specifiedImageSrc] = src
                } else {
                    window.vueApp[specifiedImageSrc] = ""
                }
            } else if (dataType == "Text") {
                text = data.texts
                let specifiedTextContent = makeSpecifiedVariableName('textContent', flag)
                if (text?.length) {
                    window.vueApp[specifiedTextContent] = text
                  } else {
                    window.vueApp[specifiedTextContent] = ""
                }
            }
          }).catch(error => {
            console.log("error", error);
          });
    }
   
}

function updateContraProjection(content_path, iteration, taskType, flag) {
    console.log('contrast',content_path,iteration)
    let specifiedVisMethod = makeSpecifiedVariableName('visMethod', flag)
    let specifiedFilterIndex = makeSpecifiedVariableName('filter_index', flag)
    fetch(`${window.location.href}/updateProjection`, {
        method: 'POST',
        body: JSON.stringify({
            "path": content_path, 
            "iteration": iteration,
            "resolution": 200,
            "vis_method":  window.vueApp[specifiedVisMethod],
            'setting': 'normal',
            "content_path": content_path,
            "predicates": {},
            "TaskType": taskType,
            "selectedPoints":window.vueApp[specifiedFilterIndex]
        }),
        headers: headers,
        mode: 'cors'
    })
    .then(response => response.json())
    .then(res => {
        currId = 'container_tar'    
        alert_prefix = "right:\n"  
        if (flag == 'ref') {
            currId = 'container_ref'
            alert_prefix = "left:\n" 
        } 
        if (res.errorMessage != "") {
          let specifiedErrorMessage = makeSpecifiedVariableName('errorMessage', flag)
          if (window.vueApp[specifiedErrorMessage]) {
            window.vueApp[specifiedErrorMessage] = alert_prefix + res.errorMessage
          } else {
            alert(alert_prefix + res.errorMessage)
            window.vueApp[specifiedErrorMessage] = alert_prefix + res.errorMessage
          }
        }
       
        drawCanvas(res, currId,flag);
        let specifiedPredictionlist = makeSpecifiedVariableName('prediction_list', flag)
        let specifiedLabelList = makeSpecifiedVariableName('label_list', flag)
        let specifiedLabelNameDict = makeSpecifiedVariableName('label_name_dict', flag)
        let specifiedColorList = makeSpecifiedVariableName('color_list', flag)
        let specifiedConfidenceList = makeSpecifiedVariableName('confidence_list', flag)
        let specifiedEvaluation = makeSpecifiedVariableName('evaluation', flag)
        let specifiedCurrEpoch = makeSpecifiedVariableName('currEpoch', flag)
        let specifiedTrainingIndex = makeSpecifiedVariableName('train_index', flag)
        let specifiedTestingIndex = makeSpecifiedVariableName('test_index', flag)

        window.vueApp[specifiedPredictionlist] = res.prediction_list
        window.vueApp[specifiedLabelList] = res.label_list
        window.vueApp[specifiedLabelNameDict] = res.label_name_dict
        window.vueApp[specifiedColorList] = res.color_list
        window.vueApp[specifiedEvaluation] = res.evaluation
        window.vueApp[specifiedCurrEpoch] = iteration
        window.vueApp[specifiedTestingIndex] = res.testing_data
        window.vueApp[specifiedTrainingIndex] = res.training_data
        window.vueApp[specifiedConfidenceList] = res.confidence_list
        labelColorRef();
        labelColorTar();
    })
    .catch(error => {
        console.error('Error fetching data:', error);
        window.vueApp.isCanvasLoading = false
        window.vueApp.$message({
            type: 'error',
            message: `Unknown Backend Error`
          });

    });
}

function getHighlightedPoints(task, flag) {
    if (task == "single") {
            var selectedValue = window.vueApp.singleOption
            var selected_left = window.vueApp.selectedIndexRef == null? -1: window.vueApp.selectedIndexRef
            var selected_right = window.vueApp.selectedIndexTar == null? -1: window.vueApp.selectedIndexTar
            console.log("selectedLeft",selected_left)
            console.log("slectedRefindex" ,window.vueApp.selectedIndexRef)
            const requestOptions = {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                "iterationLeft": window.vueApp.currEpochRef,
                "iterationRight": window.vueApp.currEpochTar,
                "method": selectedValue,
                "vis_method_left": window.vueApp.visMethodRef,
                "vis_method_right": window.vueApp.visMethodTar,
                'setting': 'normal',
                "content_path_left": window.vueApp.contentPathRef,
                "content_path_right": window.vueApp.contentPathTar,
                "selectedPointLeft":selected_left,
                "selectedPointRight":selected_right
              }),
            };
        
            fetch(`${window.location.href}/contraVisHighlightSingle`, requestOptions)
            .then(responses => {

              if (!responses.ok) {
                throw new Error(`Server responded with status: ${responses.status}`);
              }
             return responses.json()
            })
            .then(data => {
              if (selectedValue == "align") {

                window.vueApp.highlightAttributesRef.highlightedPointsYellow = data.contraVisChangeIndicesLeft
                window.vueApp.highlightAttributesRef.highlightedPointsBlue = {}
                window.vueApp.highlightAttributesRef.highlightedPointsGreen = {}

                if ( window.vueApp.highlightAttributesRef.allHighlightedSet ) {
                  window.vueApp.highlightAttributesRef.allHighlightedSet.clear()
                }
                window.vueApp.highlightAttributesRef.allHighlightedSet = new Set(data.contraVisChangeIndicesLeft)

                window.vueApp.highlightAttributesTar.highlightedPointsYellow = {}
                window.vueApp.highlightAttributesTar.highlightedPointsBlue = data.contraVisChangeIndicesRight
                window.vueApp.highlightAttributesTar.highlightedPointsGreen = {}
                if ( window.vueApp.highlightAttributesTar.allHighlightedSet ) {
                  window.vueApp.highlightAttributesTar.allHighlightedSet.clear()
                }
                window.vueApp.highlightAttributesTar.allHighlightedSet = new Set(data.contraVisChangeIndicesRight)

                // console.log("blue", window.vueApp.highlightAttributesTar.highlightedPointsBlue)
        
        
                if (selected_left != -1 && selected_right != -1) {
                  
                  window.vueApp.highlightAttributesRef.boldIndices = [selected_left].concat([selected_right])
                  window.vueApp.highlightAttributesTar.boldIndices = [selected_right].concat([selected_left])
                } else if (selected_left != -1 && selected_right == -1) {
        
                  window.vueApp.highlightAttributesRef.boldIndices = [selected_left]
                  window.vueApp.highlightAttributesTar.boldIndices = [selected_left]
              
                } else if (selected_right != -1 && selected_left == -1) {

                  window.vueApp.highlightAttributesRef.boldIndices = [selected_right]
                  window.vueApp.highlightAttributesTar.boldIndices = [selected_right]
                } else {
                  window.vueApp.highlightAttributesRef.boldIndices = []
                  window.vueApp.highlightAttributesTar.boldIndices = []
                }
        
           
              } else if (selectedValue == "nearest neighbour") {
        
                var leftLeft = data.contraVisChangeIndicesLeftLeft;
                var leftRight = data.contraVisChangeIndicesLeftRight;
                var rightLeft = data.contraVisChangeIndicesRightLeft;
                var rightRight = data.contraVisChangeIndicesRightRight;
        
                if (!leftLeft) {
                  leftLeft = []
                }
                if (!leftRight) {
                  leftRight = []
                }
                if (!rightLeft) {
                  rightLeft = []
                }
                if (!rightRight) {
                  rightRight = []
                }
                const greenLeft = setIntersection([
                  new Set(leftRight),
                  new Set(leftLeft),
                ]);
                const greenRight = setIntersection([
                  new Set(rightRight),
                  new Set(rightLeft),
                ]);

                window.vueApp.highlightAttributesRef.highlightedPointsYellow = leftRight
                window.vueApp.highlightAttributesRef.highlightedPointsBlue = leftLeft
                window.vueApp.highlightAttributesRef.highlightedPointsGreen = greenLeft
                if ( window.vueApp.highlightAttributesRef.allHighlightedSet ) {
                  window.vueApp.highlightAttributesRef.allHighlightedSet.clear()
                }
                window.vueApp.highlightAttributesRef.allHighlightedSet = new Set(leftRight.concat(leftLeft, greenLeft))

                window.vueApp.highlightAttributesTar.highlightedPointsYellow = rightRight
                window.vueApp.highlightAttributesTar.highlightedPointsBlue = rightLeft
                window.vueApp.highlightAttributesTar.highlightedPointsGreen = greenRight
                if ( window.vueApp.highlightAttributesTar.allHighlightedSet ) {
                  window.vueApp.highlightAttributesTar.allHighlightedSet.clear()
                }
                window.vueApp.highlightAttributesTar.allHighlightedSet = new Set(rightRight.concat(rightLeft, greenRight))
        
        
                var boldRight = []
                var boldLeft = []
                if (selected_left != -1) {
                  boldLeft = [window.vueApp.selectedIndexRef]
                }
                if (selected_right != -1) {
                  boldRight = [window.vueApp.selectedIndexTar]
                }


                window.vueApp.highlightAttributesRef.boldIndices = boldLeft.concat(boldRight)
                window.vueApp.highlightAttributesTar.boldIndices = window.vueApp.highlightAttributesRef.boldIndices
                // console.log("boldleft", window.vueApp.highlightAttributesRef.boldIndices)
                // console.log("boldright", window.vueApp.highlightAttributesTar.boldIndices)
        
              } else {
                resetHighlightAttributes()
              }
            })
            .catch(error => {
              console.error('Error during highlightCriticalChange fetch:', error);
             
            });
          
    } else if (task == "multi") {
            const requestOptions = {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                "iterationLeft": window.vueApp.currEpochRef,
                "iterationRight": window.vueApp.currEpochTar,
                "method": window.vueApp.multiOption,
                "vis_method_left": window.vueApp.visMethodRef,
                "vis_method_right": window.vueApp.visMethodTar,
                'setting': 'normal',
                "content_path_left": window.vueApp.contentPathRef,
                "content_path_right": window.vueApp.contentPathTar,
              }),
            };
        
            fetch(`${window.location.href}/contraVisHighlight`, requestOptions)
            .then(response => {
              if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
              }
              return response.json();
            })
            .then(data => {
                window.vueApp.highlightAttributesRef.highlightedPointsYellow = {}
                window.vueApp.highlightAttributesRef.highlightedPointsBlue = data.contraVisChangeIndices
                window.vueApp.highlightAttributesRef.highlightedPointsGreen = {}
                window.vueApp.highlightAttributesTar.highlightedPointsYellow = {}
                window.vueApp.highlightAttributesTar.highlightedPointsBlue = data.contraVisChangeIndices
                window.vueApp.highlightAttributesTar.highlightedPointsGreen = {}
                if ( window.vueApp.highlightAttributesRef.allHighlightedSet ) {
                  window.vueApp.highlightAttributesRef.allHighlightedSet.clear()
                }
                if ( window.vueApp.highlightAttributesTar.allHighlightedSet ) {
                  window.vueApp.highlightAttributesTar.allHighlightedSet.clear()
                }
                window.vueApp.highlightAttributesRef.allHighlightedSet = new Set(data.contraVisChangeIndices)
                window.vueApp.highlightAttributesTar.allHighlightedSet = new Set(data.contraVisChangeIndices)

                // console.log("requestRef", window.vueApp.highlightAttributesRef.allHighlightedSet)
                // console.log("requestTar", window.vueApp.highlightAttributesTar.allHighlightedSet)        
            })
            .catch(error => {
              console.error('Error during highlightCriticalChange fetch:', error);

            });
    } else if (task == 'visError') {
      var specifiedContentPath = makeSpecifiedVariableName('contentPath', flag)
      var specifiedCurrEpoch = makeSpecifiedVariableName('currEpoch', flag)
      var specifiedVisMethod = makeSpecifiedVariableName('visMethod', flag)
      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          "iteration": window.vueApp[specifiedCurrEpoch],
          "method": window.vueApp.taskType,
          "vis_method": window.vueApp[specifiedVisMethod],
          'setting': 'normal',
          "content_path": window.vueApp[specifiedContentPath],
        }),
      };
  
      fetch(`${window.location.href}/getVisualizationError`, requestOptions)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
          // var specifiedHighlightAttributes = makeSpecifiedVariableName('highlightAttributes', flag)
          // if (window.vueApp[specifiedHighlightAttributes].visualizationError) {
          //   window.vueApp[specifiedHighlightAttributes].visualizationError.clear()
          // }
          // window.vueApp[specifiedHighlightAttributes].visualizationError = new Set(data.visualizationError)
          // console.log("viserror",  window.vueApp[specifiedHighlightAttributes].visualizationError)
          var indicesString = data.visualizationError.join(',');
          var specifiedFilterIndex = makeSpecifiedVariableName('filter_index', flag)
          window.vueApp[specifiedFilterIndex] = indicesString
      })
      .catch(error => {
        console.error('Error during highlightCriticalChange fetch:', error);
      });
    } else {
        console.log("error")
    }
}

function getPredictionFlipIndices(flag) {
  var specifiedContentPath = makeSpecifiedVariableName('contentPath', flag)
  var specifiedCurrEpoch = makeSpecifiedVariableName('currEpoch', flag)
  var specifiedVisMethod = makeSpecifiedVariableName('visMethod', flag)
  console.log("isexecuteing")

  const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      "iteration": window.vueApp[specifiedCurrEpoch],
      "next_iteration":  `${+window.vueApp[specifiedCurrEpoch] + 1}`,
      "vis_method": window.vueApp[specifiedVisMethod],
      'setting': 'normal',
      "content_path": window.vueApp[specifiedContentPath],
    }),
  };

  fetch(`${window.location.href}/getPredictionFlipIndices`, requestOptions)
  .then(response => {
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
      // var specifiedPredictionFlipIndices = makeSpecifiedVariableName('predictionFlipIndices', flag)
      // if (window.vueApp[specifiedPredictionFlipIndices]) {
      //   window.vueApp[specifiedPredictionFlipIndices].clear()
      // }
      // window.vueApp[specifiedPredictionFlipIndices] = new Set(data.predChangeIndices)
      // console.log("predChanges",   window.vueApp[specifiedPredictionFlipIndices])
      var indicesString = data.predChangeIndices.join(',');
      var specifiedFilterIndex = makeSpecifiedVariableName('filter_index', flag)
      window.vueApp[specifiedFilterIndex] = indicesString
  })
  .catch(error => {
    console.error('Error during highlightCriticalChange fetch:', error);
  });
}


// index search
function indexSearch(query, switchOn) {
  fetch(`${window.location.href}indexSearch`, {
      method: 'POST',
      body: JSON.stringify({

          "query": {
              key: query.key,
              value: query.value,
              k: query.k
            }
      }),
      headers: headers,
      mode: 'cors'
  })
  .then(response => response.json())
  .then(res => {
      window.vueApp.query_result = res.result   
      // console.log(res.result);  
      // console.log(window.vueApp.query_result); 
      // console.log(typeof(window.vueApp.query_result)); 
      // updateSizes()
      // console.log(switchOn)
      if (switchOn) {
          updateSizes()
      } else {
          show_query_text()
      }
      window.vueApp.isCanvasLoading = false
  })
  .catch(error => {
      console.error('Error fetching data:', error);
      window.vueApp.isCanvasLoading = false
      window.vueApp.$message({
          type: 'error',
          message: `Backend error`
        });
  });
}

function reloadColor(flag) {
  var specifiedContentPath = makeSpecifiedVariableName('contentPath', flag)
  var specifiedCurrEpoch = makeSpecifiedVariableName('currEpoch', flag)
  var specifiedVisMethod = makeSpecifiedVariableName('visMethod', flag)

  const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      "iteration": window.vueApp[specifiedCurrEpoch],
      'setting': 'normal',
      "vis_method": window.vueApp[specifiedVisMethod],
      "content_path": window.vueApp[specifiedContentPath],
      "ColorType": window.vueApp.colorType
    }),
  };

  fetch(`${window.location.href}/getOriginalColors`, requestOptions)
  .then(response => {
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
      var specifiedOriginalSettings = makeSpecifiedVariableName('originalSettings', flag)
      var specifiedPointsMesh = makeSpecifiedVariableName('pointsMesh', flag)
      window.vueApp[specifiedOriginalSettings].originalColors = []

      var colors = [];
      data.label_color_list.forEach(color => {
          colors.push(color[0] / 255, color[1] / 255, color[2] / 255);
      });

      if (window.vueApp[specifiedPointsMesh].geometry) {

            // If for some reason the color attribute does not exist, add it
        window.vueApp[specifiedPointsMesh].geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
        window.vueApp[specifiedOriginalSettings].originalColors = Array.from(window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').array);
        window.vueApp[specifiedPointsMesh].geometry.getAttribute('color').needsUpdate = true; 
    }
      colors = []
      // console.log("originalColors",window.vueApp[specifiedOriginalSettings].originalColors )
      if (flag != '') {
        // reset other attributes
        resetHighlightAttributes()
      } else {
        if (window.vueApp.highlightAttributes.visualizationError) {
            window.vueApp.highlightAttributes.visualizationError.clear()
        }
        window.vueApp.highlightAttributes.visualizationError = null
      }
      data.label_color_list = []
      window.vueApp.isCanvasLoading = false
  })
  .catch(error => {
    console.error('Error during highlightCriticalChange fetch:', error);
  });
}
function contrastLoadColor(flag) {
  const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      "iterationLeft": window.vueApp.currEpochRef,
      "iterationRight":window.vueApp.currEpochTar,
      'setting': 'normal',
      "vis_method_left": window.vueApp.visMethodRef,
      "vis_method_right": window.vueApp.visMethodTar,
      "content_path_left": window.vueApp.contentPathRef,
      "content_path_right": window.vueApp.contentPathTar,
    }),
  };

  fetch(`${window.location.href}/getComparisonColors`, requestOptions)
  .then(response => {
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
      window.vueApp.originalSettingsRef.originalColors = []
      window.vueApp.originalSettingsTar.originalColors = []

      var colors = [];
      data.label_color_list.forEach(color => {
          colors.push(color[0] / 255, color[1] / 255, color[2] / 255);
      });

      if (window.vueApp.pointsMeshRef.geometry) {
            // If for some reason the color attribute does not exist, add it
          window.vueApp.pointsMeshRef.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
          window.vueApp.originalSettingsRef.originalColors = Array.from(window.vueApp.pointsMeshRef.geometry.getAttribute('color').array);
          console.log("refcolor",window.vueApp.originalSettingsRef.originalColors )
          window.vueApp.pointsMeshRef.geometry.getAttribute('color').needsUpdate = true; 
      }
      if (window.vueApp.pointsMeshTar.geometry) {
        // If for some reason the color attribute does not exist, add it
        window.vueApp.pointsMeshTar.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        window.vueApp.originalSettingsTar.originalColors = Array.from(window.vueApp.pointsMeshTar.geometry.getAttribute('color').array);
        console.log("tarcolor",   window.vueApp.originalSettingsTar.originalColors)
        window.vueApp.pointsMeshTar.geometry.getAttribute('color').needsUpdate = true; 
     }
      colors = []
      // reset other attributes
      resetHighlightAttributes()
      data.label_color_list = []
      window.vueApp.isCanvasLoading = false
  })
  .catch(error => {
    console.error('Error during highlightCriticalChange fetch:', error);
  });
}

function contrastIndexSearch(query, switchOn) {
  fetch(`contrastIndexSearch`, {
      method: 'POST',
      body: JSON.stringify({
          "query": {
              key: query.key,
              value: query.value,
              k: query.k
            }
      }),
      headers: headers,
      mode: 'cors'
  })
  .then(response => response.json())
  .then(res => {
      window.vueApp.query_result = res.result   
      // if (switchOn) {
      //   contrastUpdateSizes()
      // } else {
      //   contrast_show_query_text()
      // }
  })
  .catch(error => {
      console.error('Error fetching data:', error);
      window.vueApp.isCanvasLoading = false
      window.vueApp.$message({
          type: 'error',
          message: `Backend error`
        });
  });
}

function queryMissSearch(query,contentPathRef,currEpochRef,contentPathTar,currEpochTar) {
  fetch(`queryMissSearch`, {
      method: 'POST',
      body: JSON.stringify({
          "refpath": contentPathRef, 
          "refiteration": currEpochRef,
          "tarpath": contentPathTar, 
          "tariteration": currEpochTar,
          "query": {
              key: query.key,
              value: query.value,
              k: query.k
            }
      }),
      headers: headers,
      mode: 'cors'
  })
  .then(response => response.json())
  .then(res => {
      window.vueApp.filter_index = res.result   
  })
  .catch(error => {
      console.error('Error fetching data:', error);
      window.vueApp.isCanvasLoading = false
      window.vueApp.$message({
          type: 'error',
          message: `Backend error`
        });
  });
}

// loadVectorDB
function loadVectorDB(content_path, iteration) {
    console.log(content_path,iteration)
    fetch(`${window.location.href}loadVectorDB`, {
        method: 'POST',
        body: JSON.stringify({
            "path": content_path, 
            "iteration": iteration,
        }),
        headers: headers,
        mode: 'cors'
    })
    .then(response => response.json())
    .then(res => {
        window.vueApp.isCanvasLoading = false
    })
    .catch(error => {
        console.error('Error fetching data:', error);
        window.vueApp.isCanvasLoading = false
        window.vueApp.$message({
            type: 'error',
            message: `Backend error`
          });
    });
}

// loadVectorDB
function contrastloadVectorDBCode(content_path, iteration) {
  console.log(content_path,iteration)
  fetch(`${window.location.href}loadVectorDBCode`, {
      method: 'POST',
      body: JSON.stringify({
          "path": content_path, 
          "iteration": iteration,
      }),
      headers: headers,
      mode: 'cors'
  })
  .then(response => response.json())
  .then(res => {
      window.vueApp.isCanvasLoading = false
  })
  .catch(error => {
      console.error('Error fetching data:', error);
      window.vueApp.isCanvasLoading = false
      window.vueApp.$message({
          type: 'error',
          message: `Backend error`
        });
  });
}

// loadVectorDB
function contrastloadVectorDBNl(content_path, iteration) {
  console.log(content_path,iteration)
  fetch(`${window.location.href}loadVectorDBNl`, {
      method: 'POST',
      body: JSON.stringify({
          "path": content_path, 
          "iteration": iteration,
      }),
      headers: headers,
      mode: 'cors'
  })
  .then(response => response.json())
  .then(res => {
    window.vueApp.isCanvasLoading = false
  })
  .catch(error => {
      console.error('Error fetching data:', error);
      window.vueApp.isCanvasLoading = false
      window.vueApp.$message({
          type: 'error',
          message: `Backend error`
        });
  });
}

function updateCustomProjection(content_path, custom_path, iteration, taskType) {

  console.log(content_path,iteration)
  fetch(`${window.location.href}updateCustomProjection`, {
      method: 'POST',
      body: JSON.stringify({
          "path": content_path, 
          "cus_path": custom_path,
          "iteration": iteration,
          "resolution": 200,
          "vis_method": window.vueApp.visMethod,
          'setting': 'normal',
          "content_path": content_path,
          "predicates": {},
          "TaskType": taskType,
          "selectedPoints":window.vueApp.filter_index
      }),
      headers: headers,
      mode: 'cors'
  })
  .then(response => response.json())
  .then(res => {
      if (window.vueApp.errorMessage) {
        window.vueApp.errorMessage =  res.errorMessage
      } else {
        alert(res.errorMessage)
        window.vueApp.errorMessage =  res.errorMessage
      }
      drawCanvas(res);
      window.vueApp.prediction_list = res.prediction_list
      window.vueApp.label_list = res.label_list
      window.vueApp.label_name_dict = res.label_name_dict
      window.vueApp.evaluation = res.evaluation
      window.vueApp.currEpoch = iteration
      window.vueApp.test_index = res.testing_data
      window.vueApp.train_index = res.training_data
  })
  .catch(error => {
      console.error('Error fetching data:', error);
      window.vueApp.isCanvasLoading = false
      window.vueApp.$message({
          type: 'error',
          message: `Unknown Backend Error`
        });
  });
}

function highlightContraProjection(content_path, iteration, taskType, flag) {
  console.log('contrast',content_path,iteration)
  let specifiedVisMethod = makeSpecifiedVariableName('visMethod', flag)
  fetch(`highlightContraProjection`, {
      method: 'POST',
      body: JSON.stringify({
          "path": content_path, 
          "iteration": iteration,
          "resolution": 200,
          "vis_method":  window.vueApp[specifiedVisMethod],
          'setting': 'normal',
          "content_path": content_path,
          "predicates": {},
          "TaskType": taskType,
          "selectedPoints":window.vueApp.filter_index
      }),
      headers: headers,
      mode: 'cors'
  })
  .then(response => response.json())
  .then(res => {
      currId = 'container_tar'    
      alert_prefix = "right:\n"  
      if (flag == 'ref') {
          currId = 'container_ref'
          alert_prefix = "left:\n" 
      } 
      let specifiedErrorMessage = makeSpecifiedVariableName('errorMessage', flag)
      if (window.vueApp[specifiedErrorMessage]) {
        window.vueApp[specifiedErrorMessage] = alert_prefix + res.errorMessage
      } else {
        alert(alert_prefix + res.errorMessage)
        window.vueApp[specifiedErrorMessage] = alert_prefix + res.errorMessage
      }
      drawCanvas(res, currId,flag);
      let specifiedPredictionlist = makeSpecifiedVariableName('prediction_list', flag)
      let specifiedLabelList = makeSpecifiedVariableName('label_list', flag)
      let specifiedLabelNameDict = makeSpecifiedVariableName('label_name_dict', flag)
      let specifiedEvaluation = makeSpecifiedVariableName('evaluation', flag)
      let specifiedCurrEpoch = makeSpecifiedVariableName('currEpoch', flag)
      let specifiedTrainingIndex = makeSpecifiedVariableName('train_index', flag)
      let specifiedTestingIndex = makeSpecifiedVariableName('test_index', flag)

      window.vueApp[specifiedPredictionlist] = res.prediction_list
      window.vueApp[specifiedLabelList] = res.label_list
      window.vueApp[specifiedLabelNameDict] = res.label_name_dict
      window.vueApp[specifiedEvaluation] = res.evaluation
      window.vueApp[specifiedCurrEpoch] = iteration
      window.vueApp[specifiedTestingIndex] = res.testing_data
      window.vueApp[specifiedTrainingIndex] = res.training_data
  })
  .catch(error => {
      console.error('Error fetching data:', error);
      window.vueApp.isCanvasLoading = false
      window.vueApp.$message({
          type: 'error',
          message: `Unknown Backend Error`
        });

  });
}

function addNewLbel(labeling,contentPathRef,currEpochRef,contentPathTar,currEpochTar) {
  fetch(`addNewLbel`, {
      method: 'POST',
      body: JSON.stringify({
          "refpath": contentPathRef, 
          "refiteration": currEpochRef,
          "tarpath": contentPathTar, 
          "tariteration": currEpochTar,
          "labeling": {
              value: labeling.value,
              label: labeling.label
            }
      }),
      headers: headers,
      mode: 'cors'
  })
  .then(response => response.json())
  .then(res => {
      // 处理后端返回的结果
      if (res.success) {
        window.vueApp.$message({
          type: 'success',
          message: 'labelling successful'
        });
      } else {
        window.vueApp.$message({
          type: 'error',
          message: 'labelling failed'
        });
      }
  })
  .catch(error => {
      console.error('Error fetching data:', error);
      window.vueApp.isCanvasLoading = false
      window.vueApp.$message({
          type: 'error',
          message: `Backend error`
        });
  });
}

function updateCustomProjection(content_path, custom_path, iteration, taskType) {

  console.log(content_path,iteration)
  fetch(`${window.location.href}updateCustomProjection`, {
      method: 'POST',
      body: JSON.stringify({
          "path": content_path, 
          "cus_path": custom_path,
          "iteration": iteration,
          "resolution": 200,
          "vis_method": window.vueApp.visMethod,
          'setting': 'normal',
          "content_path": content_path,
          "predicates": {},
          "TaskType": taskType,
          "selectedPoints":window.vueApp.filter_index
      }),
      headers: headers,
      mode: 'cors'
  })
  .then(response => response.json())
  .then(res => {
      if (window.vueApp.errorMessage) {
        window.vueApp.errorMessage =  res.errorMessage
      } else {
        alert(res.errorMessage)
        window.vueApp.errorMessage =  res.errorMessage
      }
      drawCanvas(res);
      window.vueApp.prediction_list = res.prediction_list
      window.vueApp.label_list = res.label_list
      window.vueApp.label_name_dict = res.label_name_dict
      window.vueApp.evaluation = res.evaluation
      window.vueApp.currEpoch = iteration
      window.vueApp.test_index = res.testing_data
      window.vueApp.train_index = res.training_data
  })
  .catch(error => {
      console.error('Error fetching data:', error);
      window.vueApp.isCanvasLoading = false
      window.vueApp.$message({
          type: 'error',
          message: `Unknown Backend Error`
        });
  });
}

function highlightContraProjection(content_path, iteration, taskType, flag) {
  console.log('contrast',content_path,iteration)
  let specifiedVisMethod = makeSpecifiedVariableName('visMethod', flag)
  fetch(`highlightContraProjection`, {
      method: 'POST',
      body: JSON.stringify({
          "path": content_path, 
          "iteration": iteration,
          "resolution": 200,
          "vis_method":  window.vueApp[specifiedVisMethod],
          'setting': 'normal',
          "content_path": content_path,
          "predicates": {},
          "TaskType": taskType,
          "selectedPoints":window.vueApp.filter_index
      }),
      headers: headers,
      mode: 'cors'
  })
  .then(response => response.json())
  .then(res => {
      currId = 'container_tar'    
      alert_prefix = "right:\n"  
      if (flag == 'ref') {
          currId = 'container_ref'
          alert_prefix = "left:\n" 
      } 
      let specifiedErrorMessage = makeSpecifiedVariableName('errorMessage', flag)
      if (window.vueApp[specifiedErrorMessage]) {
        window.vueApp[specifiedErrorMessage] = alert_prefix + res.errorMessage
      } else {
        alert(alert_prefix + res.errorMessage)
        window.vueApp[specifiedErrorMessage] = alert_prefix + res.errorMessage
      }
      drawCanvas(res, currId,flag);
      let specifiedPredictionlist = makeSpecifiedVariableName('prediction_list', flag)
      let specifiedLabelList = makeSpecifiedVariableName('label_list', flag)
      let specifiedLabelNameDict = makeSpecifiedVariableName('label_name_dict', flag)
      let specifiedEvaluation = makeSpecifiedVariableName('evaluation', flag)
      let specifiedCurrEpoch = makeSpecifiedVariableName('currEpoch', flag)
      let specifiedTrainingIndex = makeSpecifiedVariableName('train_index', flag)
      let specifiedTestingIndex = makeSpecifiedVariableName('test_index', flag)

      window.vueApp[specifiedPredictionlist] = res.prediction_list
      window.vueApp[specifiedLabelList] = res.label_list
      window.vueApp[specifiedLabelNameDict] = res.label_name_dict
      window.vueApp[specifiedEvaluation] = res.evaluation
      window.vueApp[specifiedCurrEpoch] = iteration
      window.vueApp[specifiedTestingIndex] = res.testing_data
      window.vueApp[specifiedTrainingIndex] = res.training_data
  })
  .catch(error => {
      console.error('Error fetching data:', error);
      window.vueApp.isCanvasLoading = false
      window.vueApp.$message({
          type: 'error',
          message: `Unknown Backend Error`
        });

  });
}

function addNewLbel(labeling,contentPathRef,currEpochRef,contentPathTar,currEpochTar) {
  fetch(`addNewLbel`, {
      method: 'POST',
      body: JSON.stringify({
          "refpath": contentPathRef, 
          "refiteration": currEpochRef,
          "tarpath": contentPathTar, 
          "tariteration": currEpochTar,
          "labeling": {
              value: labeling.value,
              label: labeling.label
            }
      }),
      headers: headers,
      mode: 'cors'
  })
  .then(response => response.json())
  .then(res => {
      // 处理后端返回的结果
      if (res.success) {
        window.vueApp.$message({
          type: 'success',
          message: 'labelling successful'
        });
      } else {
        window.vueApp.$message({
          type: 'error',
          message: 'labelling failed'
        });
      }
  })
  .catch(error => {
      console.error('Error fetching data:', error);
      window.vueApp.isCanvasLoading = false
      window.vueApp.$message({
          type: 'error',
          message: `Backend error`
        });
  });
}