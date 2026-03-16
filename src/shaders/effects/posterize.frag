#version 300 es
precision mediump float;
uniform sampler2D u_texture;
uniform float u_levels;
in vec2 vUV;
out vec4 fragColor;

void main() {
  vec4 c = texture(u_texture, vUV);
  fragColor = vec4(floor(c.rgb * u_levels + 0.5) / u_levels, c.a);
}
