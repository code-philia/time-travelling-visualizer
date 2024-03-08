/*
this file define the apis
*/

// defined headers
let headers = new Headers();
headers.append('Content-Type', 'application/json');
headers.append('Accept', 'application/json');

// updateProjection
function updateProjection(content_path, iteration) {
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
            "predicates": {}
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
function fetchTimelineData(content_path){
    fetch(`${window.location.href}/get_itertaion_structure?path=${content_path}&method=Trustvis&setting=normal`, {
        method: 'POST',
        headers: headers,
        mode: 'cors'
      })
      .then(response => response.json())
        .then(res => {
            drawTimeline(res)
        })
}

function getOriginalData(content_path,index){
    if(index != null){
        fetch(`${window.location.href}sprite?index=${index}&path=${content_path}&username=admin`, {
            method: 'GET',
            mode: 'cors'
          }).then(response => response.json()).then(data => {
            // console.log("response", data);
            src = data.imgUrl
            resultImg = document.getElementById("metaImg")
            if (src && src.length) {
                resultImg.setAttribute("style", "display:block;")
                resultImg.setAttribute('src', src)
            } else {
                resultImg.setAttribute("style", "display:none;")
            }
          }).catch(error => {
            console.log("error", error);
          });
    }
   
}


function updateContraProjection(content_path, iteration) {
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
            "predicates": {}
        }),
        headers: headers,
        mode: 'cors'
    })
    .then(response => response.json())
    .then(res => {
        drawCanvas(res,'container_ref','ref');
        drawCanvas(res,'container_tar','tar');
        window.vueApp.prediction_list = res.prediction_list
        window.vueApp.label_list = res.label_list
        window.vueApp.label_name_dict = res.label_name_dict
        window.vueApp.evaluation = res.evaluation
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


