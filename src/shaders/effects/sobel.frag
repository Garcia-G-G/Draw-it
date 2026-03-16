#version 300 es
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_threshold;
uniform vec3 u_edgeColor;
in vec2 vUV;
out vec4 fragColor;

void main() {
  vec2 px = 1.0 / u_resolution;
  float tl = dot(texture(u_texture, vUV + vec2(-1, 1) * px).rgb, vec3(0.299, 0.587, 0.114));
  float t  = dot(texture(u_texture, vUV + vec2( 0, 1) * px).rgb, vec3(0.299, 0.587, 0.114));
  float tr = dot(texture(u_texture, vUV + vec2( 1, 1) * px).rgb, vec3(0.299, 0.587, 0.114));
  float l  = dot(texture(u_texture, vUV + vec2(-1, 0) * px).rgb, vec3(0.299, 0.587, 0.114));
  float r  = dot(texture(u_texture, vUV + vec2( 1, 0) * px).rgb, vec3(0.299, 0.587, 0.114));
  float bl = dot(texture(u_texture, vUV + vec2(-1,-1) * px).rgb, vec3(0.299, 0.587, 0.114));
  float b  = dot(texture(u_texture, vUV + vec2( 0,-1) * px).rgb, vec3(0.299, 0.587, 0.114));
  float br = dot(texture(u_texture, vUV + vec2( 1,-1) * px).rgb, vec3(0.299, 0.587, 0.114));
  float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
  float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
  float edge = sqrt(gx*gx + gy*gy);
  vec3 base = texture(u_texture, vUV).rgb;
  float mask = smoothstep(u_threshold, u_threshold + 0.05, edge);
  fragColor = vec4(mix(base, u_edgeColor, mask), 1.0);
}
