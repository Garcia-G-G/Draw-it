#version 300 es
precision mediump float;
uniform sampler2D u_texture;
uniform float u_threshold;
in vec2 vUV;
out vec4 fragColor;

void main() {
  vec3 c = texture(u_texture, vUV).rgb;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float bw = step(u_threshold, lum);
  fragColor = vec4(vec3(bw), 1.0);
}
