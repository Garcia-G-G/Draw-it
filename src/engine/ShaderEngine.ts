import vertexSrc from '../shaders/vertex.vert';
import kuwaharaSrc from '../shaders/effects/kuwahara.frag';
import sobelSrc from '../shaders/effects/sobel.frag';
import gaussianHSrc from '../shaders/effects/gaussianH.frag';
import gaussianVSrc from '../shaders/effects/gaussianV.frag';
import posterizeSrc from '../shaders/effects/posterize.frag';
import colorGradeSrc from '../shaders/effects/colorGrade.frag';
import bloomSrc from '../shaders/effects/bloom.frag';
import embossSrc from '../shaders/effects/emboss.frag';
import pixelateSrc from '../shaders/effects/pixelate.frag';
import thresholdSrc from '../shaders/effects/threshold.frag';
import invertSrc from '../shaders/effects/invert.frag';

const SHADER_SOURCES: Record<string, string> = {
  kuwahara: kuwaharaSrc,
  sobel: sobelSrc,
  gaussianH: gaussianHSrc,
  gaussianV: gaussianVSrc,
  posterize: posterizeSrc,
  colorGrade: colorGradeSrc,
  bloom: bloomSrc,
  emboss: embossSrc,
  pixelate: pixelateSrc,
  threshold: thresholdSrc,
  invert: invertSrc,
};

export interface EffectStep {
  shader: string;
  uniforms: Record<string, number | number[]>;
}

export class ShaderEngine {
  private gl: WebGL2RenderingContext;
  private canvas: OffscreenCanvas | HTMLCanvasElement;
  private programs = new Map<string, WebGLProgram>();
  private fbos: WebGLFramebuffer[] = [];
  private fboTextures: WebGLTexture[] = [];
  private inputTexture: WebGLTexture | null = null;
  private pingPong = 0;
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : document.createElement('canvas');
    if (canvas instanceof HTMLCanvasElement) {
      canvas.width = width;
      canvas.height = height;
    }
    this.canvas = canvas;

    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    // Compile all shaders
    for (const [name, fragSrc] of Object.entries(SHADER_SOURCES)) {
      this.compileProgram(name, vertexSrc, fragSrc);
    }

    // Create ping-pong framebuffers
    for (let i = 0; i < 2; i++) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

      this.fboTextures.push(tex);
      this.fbos.push(fbo);
    }

    // Input texture
    this.inputTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.inputTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private compileProgram(name: string, vert: string, frag: string): void {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vert);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error(`[${name} vert]`, gl.getShaderInfoLog(vs));
      return;
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, frag);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error(`[${name} frag]`, gl.getShaderInfoLog(fs));
      return;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(`[${name} link]`, gl.getProgramInfoLog(prog));
      return;
    }

    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.programs.set(name, prog);
  }

  setInput(source: HTMLCanvasElement): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.inputTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.pingPong = 0;
  }

  applyChain(steps: EffectStep[]): void {
    const gl = this.gl;

    for (let i = 0; i < steps.length; i++) {
      const { shader, uniforms } = steps[i];
      const prog = this.programs.get(shader);
      if (!prog) continue;

      gl.useProgram(prog);

      // Bind source texture
      gl.activeTexture(gl.TEXTURE0);
      const srcTex = i === 0 ? this.inputTexture : this.fboTextures[this.pingPong];
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(gl.getUniformLocation(prog, 'u_texture'), 0);

      // Resolution uniform (most shaders need it)
      const resLoc = gl.getUniformLocation(prog, 'u_resolution');
      if (resLoc) gl.uniform2f(resLoc, this.width, this.height);

      // Set custom uniforms
      for (const [key, val] of Object.entries(uniforms)) {
        const loc = gl.getUniformLocation(prog, key);
        if (!loc) continue;
        if (Array.isArray(val)) {
          if (val.length === 2) gl.uniform2fv(loc, val);
          else if (val.length === 3) gl.uniform3fv(loc, val);
          else if (val.length === 4) gl.uniform4fv(loc, val);
        } else {
          gl.uniform1f(loc, val);
        }
      }

      // Render to next framebuffer (or screen for last pass)
      const isLast = i === steps.length - 1;
      const dest = isLast ? null : this.fbos[1 - this.pingPong];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dest);
      gl.viewport(0, 0, this.width, this.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (!isLast) this.pingPong = 1 - this.pingPong;
    }
  }

  getResult(): ImageData {
    const gl = this.gl;
    const pixels = new Uint8Array(this.width * this.height * 4);
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Flip Y (WebGL reads bottom-up)
    const flipped = new Uint8ClampedArray(pixels.length);
    const stride = this.width * 4;
    for (let y = 0; y < this.height; y++) {
      const src = (this.height - 1 - y) * stride;
      const dst = y * stride;
      flipped.set(pixels.subarray(src, src + stride), dst);
    }

    return new ImageData(flipped, this.width, this.height);
  }

  destroy(): void {
    const gl = this.gl;
    this.programs.forEach((p) => gl.deleteProgram(p));
    this.fbos.forEach((f) => gl.deleteFramebuffer(f));
    this.fboTextures.forEach((t) => gl.deleteTexture(t));
    if (this.inputTexture) gl.deleteTexture(this.inputTexture);
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }
}
