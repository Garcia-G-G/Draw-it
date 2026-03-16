#version 300 es
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_threshold;
uniform float u_intensity;
in vec2 vUV;
out vec4 fragColor;

void main() {
  vec3 base = texture(u_texture, vUV).rgb;
  vec3 bloom = vec3(0.0);
  float total = 0.0;
  vec2 px = 1.0 / u_resolution;

  for (int y = -4; y <= 4; y++) {
    for (int x = -4; x <= 4; x++) {
      vec3 s = texture(u_texture, vUV + vec2(float(x), float(y)) * px * 2.0).rgb;
      float lum = dot(s, vec3(0.299, 0.587, 0.114));
      float bright = max(0.0, lum - u_threshold);
      float w = exp(-float(x*x + y*y) / 18.0);
      bloom += s * bright * w;
      total += w;
    }
  }
  bloom /= total;
  fragColor = vec4(base + bloom * u_intensity, 1.0);
}
