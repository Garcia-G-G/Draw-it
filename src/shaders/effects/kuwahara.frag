#version 300 es
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_radius;
in vec2 vUV;
out vec4 fragColor;

void main() {
  vec2 px = 1.0 / u_resolution;
  int r = int(u_radius);
  vec3 mean[4];
  vec3 var_sum[4];
  float count[4];
  for (int i = 0; i < 4; i++) { mean[i] = vec3(0.0); var_sum[i] = vec3(0.0); count[i] = 0.0; }

  for (int j = -r; j <= r; j++) {
    for (int i = -r; i <= r; i++) {
      vec3 c = texture(u_texture, vUV + vec2(float(i), float(j)) * px).rgb;
      int idx = (i >= 0 ? 1 : 0) + (j >= 0 ? 2 : 0);
      mean[idx] += c;
      var_sum[idx] += c * c;
      count[idx] += 1.0;
    }
  }

  float minVar = 1e10;
  vec3 result = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    mean[i] /= count[i];
    var_sum[i] = var_sum[i] / count[i] - mean[i] * mean[i];
    float v = var_sum[i].r + var_sum[i].g + var_sum[i].b;
    if (v < minVar) { minVar = v; result = mean[i]; }
  }
  fragColor = vec4(result, 1.0);
}
