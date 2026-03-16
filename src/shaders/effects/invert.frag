#version 300 es
precision mediump float;
uniform sampler2D u_texture;
in vec2 vUV;
out vec4 fragColor;

void main() {
  vec4 c = texture(u_texture, vUV);
  fragColor = vec4(1.0 - c.rgb, c.a);
}
