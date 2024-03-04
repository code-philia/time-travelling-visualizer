
const NUM_POINTS_FOG_THRESHOLD = 5000;
const MIN_POINT_SIZE = 5;
const IMAGE_SIZE = 30;
// Constants relating to the indices of buffer arrays.
const RGB_NUM_ELEMENTS = 3;
const INDEX_NUM_ELEMENTS = 1;
const XYZ_NUM_ELEMENTS = 3;


function createUniforms(){
    return {
      texture: {type: 't'},
      spritesPerRow: {type: 'f'},
      spritesPerColumn: {type: 'f'},
      fogColor: {type: 'c'},
      fogNear: {type: 'f'},
      fogFar: {type: 'f'},
      isImage: {type: 'bool'},
      sizeAttenuation: {type: 'bool'},
      pointSize: {type: 'f'},
    };
}

function createVertexShader() {
  return `
  // Index of the specific vertex (passed in as bufferAttribute), and the
  // variable that will be used to pass it to the fragment shader.
  attribute float spriteIndex;
  attribute vec3 color;
  attribute float scaleFactor;

  varying vec2 xyIndex;
  varying vec3 vColor;

  uniform bool sizeAttenuation;
  uniform float pointSize;
  uniform float spritesPerRow;
  uniform float spritesPerColumn;

  ${THREE.ShaderChunk['fog_pars_vertex']}

  void main() {
    // Pass index and color values to fragment shader.
    vColor = color;
    xyIndex = vec2(mod(spriteIndex, spritesPerRow),
              floor(spriteIndex / spritesPerColumn));

    // Transform current vertex by modelViewMatrix (model world position and
    // camera world position matrix).
    vec4 cameraSpacePos = modelViewMatrix * vec4(position, 1.0);

    // Project vertex in camera-space to screen coordinates using the camera's
    // projection matrix.
    gl_Position = projectionMatrix * cameraSpacePos;

    // Create size attenuation (if we're in 3D mode) by making the size of
    // each point inversly proportional to its distance to the camera.
    float outputPointSize = pointSize;
    if (sizeAttenuation) {
      outputPointSize = -pointSize / cameraSpacePos.z;
    } else {  // Create size attenuation (if we're in 2D mode)
      const float PI = 3.1415926535897932384626433832795;
      const float minScale = 0.1;  // minimum scaling factor
      const float outSpeed = 2.0;  // shrink speed when zooming out
      const float outNorm = (1. - minScale) / atan(outSpeed);
      const float maxScale = 15.0;  // maximum scaling factor
      const float inSpeed = 0.02;  // enlarge speed when zooming in
      const float zoomOffset = 0.3;  // offset zoom pivot
      float zoom = projectionMatrix[0][0] + zoomOffset;  // zoom pivot
      float scale = zoom < 1. ? 1. + outNorm * atan(outSpeed * (zoom - 1.)) :
                    1. + 2. / PI * (maxScale - 1.) * atan(inSpeed * (zoom - 1.));
      outputPointSize = pointSize * scale;
    }

    gl_PointSize =
      max(outputPointSize * scaleFactor, ${MIN_POINT_SIZE.toFixed(1)});
  }`;
}

const FRAGMENT_SHADER_POINT_TEST_CHUNK = `
  bool point_in_unit_circle(vec2 spriteCoord) {
    vec2 centerToP = spriteCoord - vec2(0.5, 0.5);
    return dot(centerToP, centerToP) < (0.5 * 0.5);
  }

  bool point_in_unit_equilateral_triangle(vec2 spriteCoord) {
    vec3 v0 = vec3(0, 1, 0);
    vec3 v1 = vec3(0.5, 0, 0);
    vec3 v2 = vec3(1, 1, 0);
    vec3 p = vec3(spriteCoord, 0);
    float p_in_v0_v1 = cross(v1 - v0, p - v0).z;
    float p_in_v1_v2 = cross(v2 - v1, p - v1).z;
    return (p_in_v0_v1 > 0.0) && (p_in_v1_v2 > 0.0);
  }

  bool point_in_unit_square(vec2 spriteCoord) {
    return true;
  }
`;

function createFragmentShader() {
  return `
  varying vec2 xyIndex;
  varying vec3 vColor;

  uniform sampler2D texture;
  uniform float spritesPerRow;
  uniform float spritesPerColumn;
  uniform bool isImage;

  ${THREE.ShaderChunk['common']}
  ${THREE.ShaderChunk['fog_pars_fragment']}
  ${FRAGMENT_SHADER_POINT_TEST_CHUNK}

  void main() {
    if (isImage) {
      // Coordinates of the vertex within the entire sprite image.
      vec2 coords =
        (gl_PointCoord + xyIndex) / vec2(spritesPerRow, spritesPerColumn);
      gl_FragColor = vec4(vColor, 1.0) * texture2D(texture, coords);
    } else {
      bool inside = point_in_unit_circle(gl_PointCoord);
      if (!inside) {
        discard;
      }
      gl_FragColor = vec4(vColor, 1);
    }
    ${THREE.ShaderChunk['fog_fragment']}
  }`;
}

const FRAGMENT_SHADER_PICKING = `
  varying vec2 xyIndex;
  varying vec3 vColor;
  uniform bool isImage;

  ${FRAGMENT_SHADER_POINT_TEST_CHUNK}

  void main() {
    xyIndex; // Silence 'unused variable' warning.
    if (isImage) {
      gl_FragColor = vec4(vColor, 1);
    } else {
      bool inside = point_in_unit_circle(gl_PointCoord);
      if (!inside) {
        discard;
      }
      gl_FragColor = vec4(vColor, 1);
    }
  }`;