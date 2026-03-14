import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { generateImage, refineImage } from '../services/api';
import type { DrawingStyleId } from '../types';

const STYLE_PROMPTS: Record<DrawingStyleId, string> = {
  realistic:
    'Photorealistic rendering shot with a high-end DSLR camera. Natural studio lighting setup with key light, fill light, and rim light creating soft, flattering shadows. Hyper-realistic textures on every surface — visible skin pores, individual hair strands, fabric weave, metal reflections with caustics. Shallow depth of field with creamy bokeh on the background. Cinematic color grading with natural, warm tones. The image must be completely indistinguishable from a professional photograph in a premium magazine.',
  illustration:
    'Premium editorial illustration worthy of a Pixar concept art book or New Yorker cover. Bold, confident outlines with purposeful line weight variation — thicker on edges, thinner for detail. Rich, carefully harmonized color palette with intentional complementary and analogous relationships. Subtle color gradients within flat areas adding dimension. Professional graphic design composition with visual hierarchy and balanced negative space. Every element polished to portfolio quality.',
  sketch:
    'Master-class pencil drawing on premium heavyweight drawing paper with visible tooth texture. Masterful use of varied pencil pressure — whisper-light construction lines alongside bold, confident contour strokes. Detailed cross-hatching building up rich tonal ranges from brilliant white to deep velvety black. Careful attention to reflected light in shadows. The quality and confidence of a Royal Academy life drawing master study. Visible eraser highlights adding luminosity.',
  '3d':
    'Professional 3D render matching Pixar or Blender Cycles quality. Three-point studio lighting — warm key light, cool fill light, and crisp rim light defining the form. Physically Based Rendering (PBR) materials with accurate roughness, metallic, and subsurface scattering properties. Subtle ambient occlusion in crevices adding realism. Clean, slightly glossy surfaces catching environment reflections. Rendered at maximum quality on a smooth neutral gradient background with soft contact shadows.',
  watercolor:
    'Gallery-exhibition fine art watercolor painted on Arches 300lb cold-press paper. Rich, transparent pigment washes with visible granulation in the paint. Beautiful wet-on-wet color bleeds where pigments mingle organically at edges. Paper grain texture showing through lighter washes. Bold, confident brushwork — NOT timid or washed-out. Intentional areas of pure white paper creating luminous highlights. The vibrant, masterful quality of a Winslow Homer or John Singer Sargent watercolor.',
  'pixel-art':
    'Premium indie game pixel art with meticulous pixel placement. Carefully curated limited color palette (16-24 colors) with intentional dithering patterns for smooth gradients. Sub-pixel animation-ready detail. Anti-aliased edges done by hand with intermediate color pixels. Each pixel placed with purpose — the art has personality, expression, and charm. The quality of Celeste, Hyper Light Drifter, or Eastward promotional art. NOT a blurry low-res image — sharp, intentional pixels.',
  minimal:
    'Ultra-sophisticated minimalist line art with the precision of a luxury brand identity. Single continuous-weight thin lines on pure white, each stroke deliberate and elegant. Masterful use of negative space creating visual tension and balance. The refined aesthetic of a Dieter Rams design, an architectural blueprint by Tadao Ando, or a high-fashion editorial sketch. Sophisticated simplicity that reveals mastery, not laziness.',
  cartoon:
    'Top-tier animation studio production art — Disney Feature Animation or Pixar quality. Bold, dynamic outlines with expressive line weight variation creating energy and movement. Bright, saturated color palette with professional color harmony and intentional lighting. Characters have appealing, exaggerated proportions with personality in every curve. Rich cel-shading with clear light source, cast shadows, and bounce light. Vibrant, alive, and full of visual storytelling.',
  anime:
    'Premium anime production quality — the caliber of Makoto Shinkai (Your Name, Suzume) or Studio Ghibli. Clean, precise cel-shading with 2-3 distinct shadow layers creating depth. Vibrant, saturated colors with atmospheric color temperature shifts. Large, detailed, luminous eyes with multiple highlight reflections. Flowing, dynamic hair with individual strand groups and wind movement. Background with stunning atmospheric depth, volumetric light rays, and painterly detail.',
  'oil-paint':
    'Museum-worthy oil painting in the tradition of the Old Masters. Rich impasto brushwork with visible three-dimensional paint texture catching light on the surface. Deep, luminous colors built up in transparent glazes over opaque underlayers. Renaissance chiaroscuro lighting — dramatic contrast between warm light and cool, transparent shadows. Warm undertones in skin and flesh. Atmospheric perspective with sfumato in the background. The technical mastery and emotional gravitas of Rembrandt, Vermeer, or John Singer Sargent.',
  neon:
    'Cyberpunk neon scene on a deep black/dark navy background. Brilliant, glowing neon outlines in electric blue (#00D4FF), hot pink (#FF1493), and vivid violet (#8B00FF) with realistic light bloom and falloff. Neon light reflects on every nearby surface — wet pavement, glass, metal — creating colorful light pools and caustic patterns. Volumetric atmospheric fog catching and scattering the neon glow. Extreme high contrast between pitch-dark shadows and blinding neon highlights. Blade Runner / Ghost in the Shell cyberpunk aesthetic.',
  isometric:
    'Premium isometric illustration with precise 30-degree projection angles and mathematical precision. Clean geometric forms with flat colors enhanced by subtle gradient shading for depth. Delightful small details — tiny windows, miniature plants, small characters — that reward close inspection. Gentle drop shadows grounding objects. The polished, charming aesthetic of Monument Valley, Crossy Road, or premium mobile game promotional art. Professional technical illustration quality.',
};

const BLANK_CANVAS_THRESHOLD = 1000;
function isCanvasBlank(dataUrl: string): boolean { return dataUrl.length < BLANK_CANVAS_THRESHOLD; }

interface UseGenerationReturn {
  generate: (overridePrompt?: string) => Promise<void>;
  refine: () => Promise<void>;
  isGenerating: boolean;
  error: string | null;
  clearError: () => void;
}

export function useGeneration(): UseGenerationReturn {
  const isGenerating = useAppStore((s) => s.isGenerating);
  const error = useAppStore((s) => s.generationError);

  const generate = useCallback(async (overridePrompt?: string) => {
    const state = useAppStore.getState();
    if (state.isGenerating) return;

    if (!state.canvasDataUrl || isCanvasBlank(state.canvasDataUrl)) {
      useAppStore.getState().setGenerationError('Draw something on the canvas first.');
      return;
    }

    useAppStore.getState().setGenerationError(null);
    useAppStore.getState().setIsGenerating(true);
    const startTime = performance.now();

    try {
      const imageBase64 = state.canvasDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const prompt = STYLE_PROMPTS[state.selectedStyle];
      const promptOverride = overridePrompt || state.promptOverride || undefined;

      const result = await generateImage({
        imageBase64,
        prompt,
        quality: state.selectedQuality,
        size: '1024x1024',
        promptOverride,
      });

      const durationMs = performance.now() - startTime;
      const fullDataUrl = `data:image/png;base64,${result.imageBase64}`;

      useAppStore.getState().setGeneratedImage(fullDataUrl);
      useAppStore.getState().setDetectedSubject(result.detectedSubject ?? null);
      useAppStore.getState().recordGeneration(durationMs, fullDataUrl);
      useAppStore.getState().addToast('success', 'HD image generated!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate image.';
      useAppStore.getState().setGenerationError(message);
    } finally {
      useAppStore.getState().setIsGenerating(false);
    }
  }, []);

  const refine = useCallback(async () => {
    const state = useAppStore.getState();
    if (state.isGenerating || !state.generatedImage) return;

    useAppStore.getState().setGenerationError(null);
    useAppStore.getState().setIsGenerating(true);
    const startTime = performance.now();

    try {
      const imageBase64 = state.generatedImage.replace(/^data:image\/\w+;base64,/, '');
      const result = await refineImage(imageBase64, 'medium');

      const durationMs = performance.now() - startTime;
      const fullDataUrl = `data:image/png;base64,${result.imageBase64}`;

      useAppStore.getState().setGeneratedImage(fullDataUrl);
      useAppStore.getState().recordGeneration(durationMs, fullDataUrl);
      useAppStore.getState().addToast('success', 'Image refined!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Refinement failed.';
      useAppStore.getState().setGenerationError(message);
    } finally {
      useAppStore.getState().setIsGenerating(false);
    }
  }, []);

  const clearError = useCallback(() => {
    useAppStore.getState().setGenerationError(null);
  }, []);

  return { generate, refine, isGenerating, error, clearError };
}
