#version 300 es
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_pixelSize;
in vec2 vUV;
out vec4 fragColor;

void main() {
  vec2 size = u_pixelSize / u_resolution;
  vec2 coord = floor(vUV / size) * size + size * 0.5;
  fragColor = texture(u_texture, coord);
}
