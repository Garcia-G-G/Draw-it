#version 300 es
precision mediump float;
out vec2 vUV;
void main() {
  float x = float((gl_VertexID & 1) << 2);
  float y = float((gl_VertexID & 2) << 1);
  gl_Position = vec4(x - 1.0, y - 1.0, 0.0, 1.0);
  vUV = vec2(x, y) * 0.5;
}
