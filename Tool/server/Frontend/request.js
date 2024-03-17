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
            "vis_method": 'Trustvis',
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
 
        drawCanvas(res);
        window.vueApp.prediction_list = res.prediction_list
        window.vueApp.label_list = res.label_list
        window.vueApp.label_name_dict = res.label_name_dict
        window.vueApp.evaluation = res.evaluation
        window.vueApp.curEpoch = iteration
       
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
  function fetchTimelineData(content_path, flag){
    fetch(`${window.location.href}/get_itertaion_structure?path=${content_path}&method=Trustvis&setting=normal`, {
        method: 'POST',
        headers: headers,
        mode: 'cors'
      })
      .then(response => response.json())
        .then(res => {
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
            // console.log("response", data);
            if (dataType == "Image") {
                src = data.imgUrl
                // resultImg = document.getElementById("imageInfo")
                let specifiedImageSrc = makeSpecifiedVariableName('imageSrc', flag)
                if (src && src.length) {
                    window.vueApp[specifiedImageSrc] = src
                    // resultImg.setAttribute("style", "display:block;")
                    // resultImg.setAttribute('src', src)
                } else {
                    // resultImg.setAttribute("style", "display:none;")
                    window.vueApp[specifiedImageSrc] = ""
                }
            } else if (dataType == "Text") {
                text = data.texts
                let specifiedTextContent = makeSpecifiedVariableName('textContent', flag)
                // resultText = document.getElementById("textInfo")
                if (text?.length) {
                    // this.resultText?.setAttribute("style", "display:block;"); 
                    // this.resultText.textContent = text;
                    window.vueApp[specifiedTextContent] = text
                  } else {
                    // this.resultText?.setAttribute("style", "display:none;"); 
                    window.vueApp[specifiedTextContent] = ""
                }
        
            }
           
        //   <template is="dom-if" if="[[showText]]">
        //   <div class="text-container" style="max-height: 300px; overflow-y: auto;">
        //   <p id="metaText">text...</p>
        //   </div>
        //   </template>

    //   if (this.showText) {
    //       this.resultText = this.$$('#metaText') as HTMLAnchorElement;
        

          }).catch(error => {
            console.log("error", error);
          });
    }
   
}



function updateContraProjection(content_path, iteration, taskType, flag) {
    console.log('contrast',content_path,iteration)
    
    fetch(`${window.location.href}/updateProjection`, {
        method: 'POST',
        body: JSON.stringify({
            "path": content_path, 
            "iteration": iteration,
            "resolution": 200,
            "vis_method": 'Trustvis',
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
        if (flag == 'ref') {
            currId = 'container_ref'
        } 
        drawCanvas(res, currId,flag);
        let specifiedPredictionlist = makeSpecifiedVariableName('prediction_list', flag)
        let specifiedLabelList = makeSpecifiedVariableName('label_list', flag)
        let specifiedLabelNameDict = makeSpecifiedVariableName('label_name_dict', flag)
        let specifiedEvaluation = makeSpecifiedVariableName('evaluation', flag)
        let specifiedCurrEpoch = makeSpecifiedVariableName('currEpoch', flag)
        window.vueApp[specifiedPredictionlist] = res.prediction_list
        window.vueApp[specifiedLabelList] = res.label_list
        window.vueApp[specifiedLabelNameDict] = res.label_name_dict
        window.vueApp[specifiedEvaluation] = res.evaluation
        window.vueApp[specifiedCurrEpoch] = iteration
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

function getHighlightedPoints(task) {
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
        
            // performance.mark('startRequest');
            fetch(`${window.location.href}/contraVisHighlightSingle`, requestOptions)
            .then(responses => {
            //   performance.mark('endRequest');
        
              // Measure the duration of the request
            //   performance.measure('requestDuration', 'startRequest', 'endRequest');
              
            //   const measure = performance.getEntriesByName('requestDuration')[0];
            //   console.log(`The transmission time was ${measure.duration} milliseconds.`);
              if (!responses.ok) {
                throw new Error(`Server responded with status: ${responses.status}`);
              }
             return responses.json()
            })
            .then(data => {
            //   performance.mark('startProcessing');
            //   console.log("startProcessing")
              if (selectedValue == "align") {
        
        // updateStateForInstance(this.instanceIdLeft, {contraVisHighlightIndicesYellow:data.contraVisChangeIndicesLeft})
        // updateStateForInstance(this.instanceIdLeft, {contraVisHighlightIndicesBlue:{}})
        // updateStateForInstance(this.instanceIdLeft, {contraVisHighlightIndicesGreen:{}})
        // updateStateForInstance(this.instanceIdRight, {contraVisHighlightIndicesBlue: data.contraVisChangeIndicesRight})
        // updateStateForInstance(this.instanceIdRight, {contraVisHighlightIndicesYellow:{}})
        // updateStateForInstance(this.instanceIdRight, {contraVisHighlightIndicesGreen:{}})
                window.vueApp.highlightAttributesRef.highlightedPointsYellow = data.contraVisChangeIndicesLeft
                window.vueApp.highlightAttributesRef.highlightedPointsBlue = {}
                window.vueApp.highlightAttributesRef.highlightedPointsGreen = {}

                window.vueApp.highlightAttributesRef.allHighlightedSet = new Set(data.contraVisChangeIndicesLeft)

                window.vueApp.highlightAttributesTar.highlightedPointsYellow = {}
                window.vueApp.highlightAttributesTar.highlightedPointsBlue = data.contraVisChangeIndicesRight
                window.vueApp.highlightAttributesTar.highlightedPointsGreen = {}
                window.vueApp.highlightAttributesTar.allHighlightedSet = new Set(data.contraVisChangeIndicesRight)
                // performance.mark('startProcessing1');
        // this.contraVisHighlightIndicesLeft = data.contraVisChangeIndicesLeft;
        // this.contraVisHighlightIndicesRight = data.contraVisChangeIndicesRight;
        // console.log("alginleft", this.contraVisHighlightIndicesLeft)
        // console.log("alignright", this.contraVisHighlightIndicesRight)
                console.log("blue", window.vueApp.highlightAttributesTar.highlightedPointsBlue)
        
        
                if (selected_left != -1 && selected_right != -1) {
                //   this.contraVisBoldIndicesLeft = getSelectedStack(this.instanceIdLeft).concat(getSelectedStack(this.instanceIdRight))
                //   this.contraVisBoldIndicesRight = getSelectedStack(this.instanceIdRight).concat(getSelectedStack(this.instanceIdLeft))
                  
                  window.vueApp.highlightAttributesRef.boldIndices = [selected_left].concat([selected_right])
                  window.vueApp.highlightAttributesTar.boldIndices = [selected_right].concat([selected_left])
                } else if (selected_left != -1 && selected_right == -1) {
        
                //   this.contraVisBoldIndicesLeft = getSelectedStack(this.instanceIdLeft)
                //   this.contraVisBoldIndicesRight = getSelectedStack(this.instanceIdLeft)
                  window.vueApp.highlightAttributesRef.boldIndices = [selected_left]
                  window.vueApp.highlightAttributesTar.boldIndices = [selected_left]
              
                } else if (selected_right != -1 && selected_left == -1) {
                //   this.contraVisBoldIndicesLeft = getSelectedStack(this.instanceIdRight)
                //   this.contraVisBoldIndicesRight = getSelectedStack(this.instanceIdRight)
                  window.vueApp.highlightAttributesRef.boldIndices = [selected_right]
                  window.vueApp.highlightAttributesTar.boldIndices = [selected_right]
                } else {
                //   this.contraVisBoldIndicesRight = []
                //   this.contraVisBoldIndicesLeft = []
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
                // updateStateForInstance(this.instanceIdLeft, {contraVisHighlightIndicesYellow:leftRight})
                // updateStateForInstance(this.instanceIdLeft, {contraVisHighlightIndicesBlue:leftLeft})
                // updateStateForInstance(this.instanceIdLeft, {contraVisHighlightIndicesGreen:greenLeft})
        
                // updateStateForInstance(this.instanceIdRight, {contraVisHighlightIndicesYellow:rightRight})
                // updateStateForInstance(this.instanceIdRight, {contraVisHighlightIndicesBlue:rightLeft})
                // updateStateForInstance(this.instanceIdRight, {contraVisHighlightIndicesGreen:greenRight})
        
                window.vueApp.highlightAttributesRef.highlightedPointsYellow = leftRight
                window.vueApp.highlightAttributesRef.highlightedPointsBlue = leftLeft
                window.vueApp.highlightAttributesRef.highlightedPointsGreen = greenLeft
                window.vueApp.highlightAttributesRef.allHighlightedSet = new Set(leftRight.concat(leftLeft, greenLeft))

                window.vueApp.highlightAttributesTar.highlightedPointsYellow = rightRight
                window.vueApp.highlightAttributesTar.highlightedPointsBlue = rightLeft
                window.vueApp.highlightAttributesTar.highlightedPointsGreen = greenRight
                window.vueApp.highlightAttributesTar.allHighlightedSet = new Set(rightRight.concat(rightLeft, greenRight))

                // this.contraVisHighlightIndicesLeft =  leftLeft.concat(leftRight);
        
                // this.contraVisHighlightIndicesRight = rightLeft.concat(rightRight);
        
        
                var boldRight = []
                var boldLeft = []
                if (selected_left != -1) {
                //   boldLeft = getSelectedStack(this.instanceIdLeft)
                  boldLeft = [window.vueApp.selectedIndexRef]
                }
                if (selected_right != -1) {
                //   boldRight = getSelectedStack(this.instanceIdRight)
                  boldRight = [window.vueApp.selectedIndexTar]
                }

                // this.contraVisBoldIndicesLeft = boldLeft.concat(boldRight)
                // this.contraVisBoldIndicesRight =  this.contraVisBoldIndicesLeft

                window.vueApp.highlightAttributesRef.boldIndices = boldLeft.concat(boldRight)
                window.vueApp.highlightAttributesTar.boldIndices = window.vueApp.highlightAttributesRef.boldIndices
                console.log("boldleft", window.vueApp.highlightAttributesRef.boldIndices)
                console.log("boldright", window.vueApp.highlightAttributesTar.boldIndices)
        
              } else {
                // updateStateForInstance(this.instanceIdLeft, {contraVisHighlightIndicesYellow:{}})
                // updateStateForInstance(this.instanceIdLeft, {contraVisHighlightIndicesBlue:{}})
                // updateStateForInstance(this.instanceIdLeft, {contraVisHighlightIndicesGreen:{}})
                // updateStateForInstance(this.instanceIdRight, {contraVisHighlightIndicesYellow:{}})
                // updateStateForInstance(this.instanceIdRight, {contraVisHighlightIndicesBlue:{}})
                // updateStateForInstance(this.instanceIdRight, {contraVisHighlightIndicesGreen:{}})
                // updateStateForInstance(this.instanceIdLeft, {selectedStack:null})
                // updateStateForInstance(this.instanceIdRight, {selectedStack:null})
                // this.contraVisHighlightIndicesLeft = []
                // this.contraVisHighlightIndicesRight = []
                // this.contraVisBoldIndicesLeft = []
                // this.contraVisBoldIndicesRight = []

                window.vueApp.highlightAttributesRef.highlightedPointsYellow = {}
                window.vueApp.highlightAttributesRef.highlightedPointsBlue = {}
                window.vueApp.highlightAttributesRef.highlightedPointsGreen = {}
                window.vueApp.highlightAttributesTar.highlightedPointsYellow = {}
                window.vueApp.highlightAttributesTar.highlightedPointsBlue = {}
                window.vueApp.highlightAttributesTar.highlightedPointsGreen = {}
                window.vueApp.highlightAttributesRef.allHighlightedSet = new Set()
                window.vueApp.highlightAttributesTar.allHighlightedSet = new Set()

                window.vueApp.highlightAttributesRef.boldIndices = {}
                window.vueApp.highlightAttributesTar.boldIndices = {}
                window.vueApp.selectedIndexRef = -1
                window.vueApp.selectedIndexTar = -1

              }
        
            //   updateStateForInstance(this.instanceIdLeft, {contraVisHighlightIndices:this.contraVisHighlightIndicesLeft})
            //   updateStateForInstance(this.instanceIdRight, {contraVisHighlightIndices:this.contraVisHighlightIndicesRight})
            //   updateStateForInstance(this.instanceIdLeft, {contraVisBoldIndices:this.contraVisBoldIndicesLeft})
            //   updateStateForInstance(this.instanceIdRight, {contraVisBoldIndices:this.contraVisBoldIndicesRight})


            //   console.log("vleft", this.contraVisHighlightIndicesLeft)
            //   console.log("vright", this.contraVisHighlightIndicesRight)
            //   performance.mark('endProcessing');
            //   performance.measure('ProcessingDuration', 'startProcessing', 'endProcessing');
              
            //   const measure = performance.getEntriesByName('ProcessingDuration')[0];
            //   console.log(`The Processing time was ${measure.duration} milliseconds.`);
            })
            .catch(error => {
              console.error('Error during highlightCriticalChange fetch:', error);
             
            });
          
    } else if (task == "multi") {
            // Get the selected value from the select box
 
        
        
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
            //   updateStateForInstance(this.instanceIdLeft, {contraVisHighlightIndices:data.contraVisChangeIndices})
            //   updateStateForInstance(this.instanceIdRight, {contraVisHighlightIndices:data.contraVisChangeIndices})
            //   updateStateForInstance(this.instanceIdLeft, {contraVisHighlightIndicesBlue:data.contraVisChangeIndices})
            //   updateStateForInstance(this.instanceIdRight, {contraVisHighlightIndicesBlue:data.contraVisChangeIndices})
            //   updateStateForInstance(this.instanceIdLeft, {contraVisHighlightIndicesYellow:{}})
            //   updateStateForInstance(this.instanceIdRight, {contraVisHighlightIndicesYellow:{}})
            //   updateStateForInstance(this.instanceIdLeft, {contraVisHighlightIndicesGreen:{}})
            //   updateStateForInstance(this.instanceIdRight, {contraVisHighlightIndicesGreen:{}})
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
          

    } else {
        console.log("error")
    }
}

