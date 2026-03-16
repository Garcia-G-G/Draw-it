import type { DrawingStyleId } from '../types';
import type { EffectStep } from './ShaderEngine';

export function getEffectChain(style: DrawingStyleId): EffectStep[] {
  switch (style) {
    case 'oil-paint':
      return [
        { shader: 'kuwahara', uniforms: { u_radius: 6 } },
        { shader: 'colorGrade', uniforms: { u_brightness: 0.0, u_contrast: 1.1, u_saturation: 1.3 } },
      ];
    case 'watercolor':
      return [
        { shader: 'gaussianH', uniforms: { u_radius: 3 } },
        { shader: 'gaussianV', uniforms: { u_radius: 3 } },
        { shader: 'kuwahara', uniforms: { u_radius: 3 } },
        { shader: 'sobel', uniforms: { u_threshold: 0.15, u_edgeColor: [0.2, 0.15, 0.1] } },
      ];
    case 'neon':
      return [
        { shader: 'sobel', uniforms: { u_threshold: 0.08, u_edgeColor: [0.0, 1.0, 0.85] } },
        { shader: 'bloom', uniforms: { u_threshold: 0.2, u_intensity: 2.5 } },
        { shader: 'colorGrade', uniforms: { u_brightness: -0.55, u_contrast: 1.5, u_saturation: 1.8 } },
      ];
    case 'cartoon':
      return [
        { shader: 'posterize', uniforms: { u_levels: 5 } },
        { shader: 'sobel', uniforms: { u_threshold: 0.12, u_edgeColor: [0.0, 0.0, 0.0] } },
        { shader: 'colorGrade', uniforms: { u_brightness: 0.0, u_contrast: 1.1, u_saturation: 1.5 } },
      ];
    case 'anime':
      return [
        { shader: 'posterize', uniforms: { u_levels: 6 } },
        { shader: 'sobel', uniforms: { u_threshold: 0.18, u_edgeColor: [0.15, 0.1, 0.1] } },
        { shader: 'colorGrade', uniforms: { u_brightness: 0.0, u_contrast: 1.0, u_saturation: 1.4 } },
        { shader: 'bloom', uniforms: { u_threshold: 0.5, u_intensity: 0.8 } },
      ];
    case 'sketch':
      return [
        { shader: 'colorGrade', uniforms: { u_brightness: 0.0, u_contrast: 1.0, u_saturation: 0.0 } },
        { shader: 'sobel', uniforms: { u_threshold: 0.06, u_edgeColor: [0.15, 0.12, 0.1] } },
        { shader: 'invert', uniforms: {} },
      ];
    case 'pixel-art':
      return [
        { shader: 'pixelate', uniforms: { u_pixelSize: 8 } },
        { shader: 'posterize', uniforms: { u_levels: 4 } },
        { shader: 'colorGrade', uniforms: { u_brightness: 0.0, u_contrast: 1.2, u_saturation: 1.2 } },
      ];
    case 'minimal':
      return [
        { shader: 'colorGrade', uniforms: { u_brightness: 0.0, u_contrast: 1.0, u_saturation: 0.0 } },
        { shader: 'sobel', uniforms: { u_threshold: 0.15, u_edgeColor: [0.0, 0.0, 0.0] } },
        { shader: 'threshold', uniforms: { u_threshold: 0.4 } },
        { shader: 'invert', uniforms: {} },
      ];
    case 'illustration':
      return [
        { shader: 'posterize', uniforms: { u_levels: 8 } },
        { shader: 'sobel', uniforms: { u_threshold: 0.1, u_edgeColor: [0.0, 0.0, 0.0] } },
        { shader: 'colorGrade', uniforms: { u_brightness: 0.0, u_contrast: 1.15, u_saturation: 1.3 } },
      ];
    case '3d':
      return [
        { shader: 'emboss', uniforms: { u_strength: 2.0 } },
        { shader: 'colorGrade', uniforms: { u_brightness: 0.05, u_contrast: 1.3, u_saturation: 1.0 } },
      ];
    case 'isometric':
      return [
        { shader: 'sobel', uniforms: { u_threshold: 0.1, u_edgeColor: [0.2, 0.2, 0.2] } },
        { shader: 'posterize', uniforms: { u_levels: 6 } },
        { shader: 'colorGrade', uniforms: { u_brightness: 0.0, u_contrast: 1.0, u_saturation: 0.7 } },
      ];
    case 'realistic':
    default:
      return [
        { shader: 'gaussianH', uniforms: { u_radius: 2 } },
        { shader: 'gaussianV', uniforms: { u_radius: 2 } },
        { shader: 'colorGrade', uniforms: { u_brightness: 0.02, u_contrast: 1.1, u_saturation: 1.1 } },
      ];
  }
}
