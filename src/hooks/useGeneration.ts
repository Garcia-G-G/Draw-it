import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { generateImage, refineImage } from '../services/api';
import type { DrawingStyleId } from '../types';

// Concise style tags (15-25 words each). The model knows what these mean.
const STYLE_PROMPTS: Record<DrawingStyleId, string> = {
  realistic: 'Photorealistic DSLR photograph with studio lighting, shallow depth of field, cinematic color grading',
  illustration: 'Premium editorial illustration, bold outlines, rich harmonized colors, Pixar concept art quality',
  sketch: 'Master pencil drawing on textured paper, varied pressure, detailed cross-hatching, fine art quality',
  '3d': 'Professional Pixar-quality 3D render, PBR materials, three-point studio lighting, ambient occlusion',
  watercolor: 'Fine art watercolor on cold-press paper, transparent washes, visible paper grain, gallery quality',
  'pixel-art': 'Premium indie game pixel art, curated 16-color palette, anti-aliased edges, Celeste quality',
  minimal: 'Ultra-clean minimalist line art, single-weight thin lines on white, luxury brand aesthetic',
  cartoon: 'Disney/Pixar animation quality, bold dynamic outlines, bright saturated colors, expressive cel-shading',
  anime: 'Makoto Shinkai anime quality, clean cel-shading, luminous detailed eyes, atmospheric depth, vibrant colors',
  'oil-paint': 'Museum-quality oil painting, visible impasto brushwork, rich glazed colors, Rembrandt chiaroscuro lighting',
  neon: 'Glowing neon on dark background, electric blue and hot pink, realistic light bloom, cyberpunk Blade Runner aesthetic',
  isometric: 'Clean isometric 3D illustration, precise 30-degree angles, flat colors with subtle gradients, Monument Valley aesthetic',
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
      useAppStore.getState().addToast('success', 'Image generated!');
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
