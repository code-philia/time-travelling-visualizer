/*
this file define the apis
*/

// defined headers
let headers = new Headers();
headers.append('Content-Type', 'application/json');
headers.append('Accept', 'application/json');

// updateProjection
function updateProjection() {
    fetch(`${window.location.href}/updateProjection`, {
        method: 'POST',
        body: JSON.stringify({
            "path": '/home/yifan/0ExpMinist/Dropout/0.5/01', 
            "iteration": 1,
            "resolution": 200,
            "vis_method": 'Trustvis',
            'setting': 'normal',
            "content_path": '/home/yifan/0ExpMinist/Dropout/0.5/01',
            "predicates": {}
        }),
        headers: headers,
        mode: 'cors'
    })
    .then(response => response.json())
    .then(res => {
        drawCanvas(res);
    })
    .catch(error => {
        console.error('Error fetching data:', error);
    });
}


