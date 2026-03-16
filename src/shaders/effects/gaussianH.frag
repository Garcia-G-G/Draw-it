#version 300 es
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_radius;
in vec2 vUV;
out vec4 fragColor;

void main() {
  vec2 px = vec2(1.0 / u_resolution.x, 0.0);
  int r = int(u_radius);
  float sigma = u_radius * 0.5;
  vec4 sum = vec4(0.0);
  float wSum = 0.0;
  for (int i = -r; i <= r; i++) {
    float w = exp(-float(i*i) / (2.0 * sigma * sigma));
    sum += texture(u_texture, vUV + float(i) * px) * w;
    wSum += w;
  }
  fragColor = sum / wSum;
}
