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
            "TaskType": taskType
        }),
        headers: headers,
        mode: 'cors'
    })
    .then(response => response.json())
    .then(res => {
        // unblocking known error messages
        // set error message info 
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

  function getOriginalData(content_path,index, dataType, flag){
    if(index != null){
        let specifiedCurrEpoch = makeSpecifiedVariableName('currEpoch', flag)
        fetch(`${window.location.href}/sprite${dataType}?index=${index}&path=${content_path}&username=admin&iteration=${window.vueApp[specifiedCurrEpoch]}`, {
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
    fetch(`${window.location.href}/updateProjection`, {
        method: 'POST',
        body: JSON.stringify({
            "path": content_path, 
            "iteration": iteration,
            "resolution": 200,
            "vis_method": window.vueApp[specifiedVisMethod],
            'setting': 'normal',
            "content_path": content_path,
            "predicates": {},
            "TaskType": taskType
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
        // set error message info 
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
            message: `Backend error`
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
                "vis_method": 'Trustvis',
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

                window.vueApp.highlightAttributesRef.allHighlightedSet = new Set(data.contraVisChangeIndicesLeft)

                window.vueApp.highlightAttributesTar.highlightedPointsYellow = {}
                window.vueApp.highlightAttributesTar.highlightedPointsBlue = data.contraVisChangeIndicesRight
                window.vueApp.highlightAttributesTar.highlightedPointsGreen = {}
                window.vueApp.highlightAttributesTar.allHighlightedSet = new Set(data.contraVisChangeIndicesRight)

                console.log("blue", window.vueApp.highlightAttributesTar.highlightedPointsBlue)
        
        
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
                window.vueApp.highlightAttributesRef.allHighlightedSet = new Set(leftRight.concat(leftLeft, greenLeft))

                window.vueApp.highlightAttributesTar.highlightedPointsYellow = rightRight
                window.vueApp.highlightAttributesTar.highlightedPointsBlue = rightLeft
                window.vueApp.highlightAttributesTar.highlightedPointsGreen = greenRight
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
                console.log("boldleft", window.vueApp.highlightAttributesRef.boldIndices)
                console.log("boldright", window.vueApp.highlightAttributesTar.boldIndices)
        
              } else {

                window.vueApp.highlightAttributesRef.highlightedPointsYellow = {}
                window.vueApp.highlightAttributesRef.highlightedPointsBlue = {}
                window.vueApp.highlightAttributesRef.highlightedPointsGreen = {}
                window.vueApp.highlightAttributesTar.highlightedPointsYellow = {}
                window.vueApp.highlightAttributesTar.highlightedPointsBlue = {}
                window.vueApp.highlightAttributesTar.highlightedPointsGreen = {}
                window.vueApp.highlightAttributesRef.allHighlightedSet = new Set()
                window.vueApp.highlightAttributesTar.allHighlightedSet = new Set()

                window.vueApp.highlightAttributesRef.boldIndices = []
                window.vueApp.highlightAttributesTar.boldIndices = []
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
                "vis_method": 'Trustvis',
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
                window.vueApp.highlightAttributesRef.allHighlightedSet = new Set(data.contraVisChangeIndices)
                window.vueApp.highlightAttributesTar.allHighlightedSet = new Set(data.contraVisChangeIndices)

                console.log("requestRef", window.vueApp.highlightAttributesRef.allHighlightedSet)
                console.log("requestTar", window.vueApp.highlightAttributesTar.allHighlightedSet)        
            })
            .catch(error => {
              console.error('Error during highlightCriticalChange fetch:', error);
             
            });
          

    } else if (task == 'visError') {
      var specifiedContentPath = makeSpecifiedVariableName('contentPath', flag)
      var specifiedCurrEpoch = makeSpecifiedVariableName('currEpoch', flag)

      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          "iteration": window.vueApp[specifiedCurrEpoch],
          "method": window.vueApp.taskType,
          "vis_method": 'Trustvis',
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
          var specifiedHighlightAttributes = makeSpecifiedVariableName('highlightAttributes', flag)

          
          window.vueApp[specifiedHighlightAttributes].visualizationError = new Set(data.visualizationError)

          console.log("viserror",  window.vueApp[specifiedHighlightAttributes].visualizationError)
  
      })
      .catch(error => {
        console.error('Error during highlightCriticalChange fetch:', error);
       
      });
    } else {
        console.log("error")
    }
}

function getPredictionFlipIndices(flag) {
//   @app.route('/highlightCriticalChange', methods=["POST", "GET"])
// @cross_origin()
// def highlight_critical_change():
//     res = request.get_json()
//     CONTENT_PATH = os.path.normpath(res['path'])
//     VIS_METHOD = res['vis_method']
//     SETTING = res["setting"]
//     curr_iteration = int(res['iteration'])
//     next_iteration = int(res['next_iteration'])

//     context = initialize_backend(CONTENT_PATH, VIS_METHOD, SETTING)
  
//     predChangeIndices = getCriticalChangeIndices(context, curr_iteration, next_iteration)
    
//     return make_response(jsonify({
//                                   "predChangeIndices": predChangeIndices.tolist()
//                                   }), 200)

  var specifiedContentPath = makeSpecifiedVariableName('contentPath', flag)
  
  var specifiedCurrEpoch = makeSpecifiedVariableName('currEpoch', flag)


  const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      "iteration": window.vueApp[specifiedCurrEpoch],
      "next_iteration":  `${+window.vueApp[specifiedCurrEpoch] + 1}`,
      "vis_method": 'Trustvis',
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
      var specifiedPredictionFlipIndices = makeSpecifiedVariableName('predictionFlipIndices', flag)
      window.vueApp[specifiedPredictionFlipIndices] = new Set(data.predChangeIndices)
      console.log("predChanges",   window.vueApp[specifiedPredictionFlipIndices])
  })
  .catch(error => {
    console.error('Error during highlightCriticalChange fetch:', error);
  });
}

