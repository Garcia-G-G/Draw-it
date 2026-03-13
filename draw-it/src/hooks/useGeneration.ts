import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { generateImage } from '../services/api';
import type { DrawingStyleId } from '../types';

const BASE_PROMPT =
  'I have drawn a rough sketch on a white canvas with black lines. Look carefully at EXACTLY what is drawn — the shapes, the subject, the composition, the position of every element. Your job is to transform this exact sketch into a polished version. Do NOT invent new subjects or objects. Keep the SAME subject and layout I drew.';

const STYLE_MODIFIERS: Record<DrawingStyleId, string> = {
  realistic:
    'Make it photorealistic with natural lighting, realistic textures, and lifelike details. Like a professional photograph of exactly what I sketched.',
  illustration:
    'Make it a clean digital illustration with bold outlines, flat colors, and graphic design quality. Like professional vector art of exactly what I sketched.',
  sketch:
    'Make it a refined professional pencil sketch with detailed shading, cross-hatching, and depth. Like a master artist redrew exactly what I sketched.',
  '3d':
    'Make it a 3D rendered scene with realistic materials, ambient occlusion, and studio lighting. Like a professional 3D render of exactly what I sketched.',
  watercolor:
    'Make it a watercolor painting with soft edges, color blending, and paper texture. Like a professional watercolor of exactly what I sketched.',
  'pixel-art':
    'Make it pixel art with a limited color palette, sharp pixels, and retro 16-bit aesthetic. Like classic game art of exactly what I sketched.',
  minimal:
    'Make it minimalist line art with ultra-clean thin lines, no shading, limited colors. Like elegant minimal design of exactly what I sketched.',
  cartoon:
    'Make it a fun cartoon illustration with exaggerated features, bright saturated colors, and a playful style. Like professional cartoon art of exactly what I sketched.',
  anime:
    'Make it an anime-style illustration with anime shading, vibrant colors, and expressive details. Like professional anime art of exactly what I sketched.',
  'oil-paint':
    'Make it an oil painting with visible brushstrokes, rich colors, and dramatic lighting. Like a classic oil painting of exactly what I sketched.',
  neon:
    'Make it a neon-lit scene with glowing neon edges on a dark background and cyberpunk atmosphere. Like neon art of exactly what I sketched.',
  isometric:
    'Make it an isometric 3D illustration with clean edges and subtle shadows. Like professional isometric art of exactly what I sketched.',
};

const BLANK_CANVAS_THRESHOLD = 1000;

function isCanvasBlank(dataUrl: string): boolean {
  return dataUrl.length < BLANK_CANVAS_THRESHOLD;
}

interface UseGenerationReturn {
  generate: () => Promise<void>;
  isGenerating: boolean;
  error: string | null;
  clearError: () => void;
}

export function useGeneration(): UseGenerationReturn {
  const isGenerating = useAppStore((s) => s.isGenerating);
  const error = useAppStore((s) => s.generationError);

  const generate = useCallback(async () => {
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
      const prompt = `${BASE_PROMPT} ${STYLE_MODIFIERS[state.selectedStyle]}`;

      const result = await generateImage({
        imageBase64,
        prompt,
        quality: state.selectedQuality,
        size: '1024x1024',
      });

      const durationMs = performance.now() - startTime;
      const fullDataUrl = `data:image/png;base64,${result.imageBase64}`;

      useAppStore.getState().setGeneratedImage(fullDataUrl);
      useAppStore.getState().setDetectedSubject(result.detectedSubject ?? null);
      useAppStore.getState().recordGeneration(durationMs, fullDataUrl);
      useAppStore.getState().addToast('success', 'Image generated!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate image. Please try again.';
      useAppStore.getState().setGenerationError(message);
    } finally {
      useAppStore.getState().setIsGenerating(false);
    }
  }, []);

  const clearError = useCallback(() => {
    useAppStore.getState().setGenerationError(null);
  }, []);

  return { generate, isGenerating, error, clearError };
}
