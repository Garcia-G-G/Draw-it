#version 300 es
precision mediump float;
uniform sampler2D u_texture;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
in vec2 vUV;
out vec4 fragColor;

void main() {
  vec3 c = texture(u_texture, vUV).rgb;
  c += u_brightness;
  c = (c - 0.5) * u_contrast + 0.5;
  float gray = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(gray), c, u_saturation);
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
