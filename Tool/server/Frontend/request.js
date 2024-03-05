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
    })
    .catch(error => {
        console.error('Error fetching data:', error);
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


