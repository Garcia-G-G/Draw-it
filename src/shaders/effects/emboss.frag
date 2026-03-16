#version 300 es
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_strength;
in vec2 vUV;
out vec4 fragColor;

void main() {
  vec2 px = 1.0 / u_resolution;
  vec3 tl = texture(u_texture, vUV + vec2(-1, 1) * px).rgb;
  vec3 br = texture(u_texture, vUV + vec2( 1,-1) * px).rgb;
  vec3 emboss = (br - tl) * u_strength + 0.5;
  vec3 base = texture(u_texture, vUV).rgb;
  fragColor = vec4(mix(base, emboss, 0.6), 1.0);
}
