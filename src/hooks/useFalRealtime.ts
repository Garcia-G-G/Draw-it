import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  initFalRealtime,
  sendFrame,
  closeFalRealtime,
  type FalRealtimeResult,
} from '../services/falRealtime';
import type { DrawingStyleId } from '../types';

const BLANK_THRESHOLD = 1000;

// SDXL Lightning strength — 0.75 is the sweet spot:
// High enough to add rich detail/style, low enough to preserve
// the sketch's composition and shapes. SDXL understands structure
// much better than SD1.5 LCM at the same strength level.
const DEFAULT_STRENGTH = 0.75;

// Throttle between HTTP requests (ms)
const THROTTLE_MS = 400;

// Prompts tuned for SDXL Lightning img2img — these tell the model
// to treat the input as a sketch/drawing and create a styled version
// that preserves the composition.
const REALTIME_STYLE_PROMPTS: Record<DrawingStyleId, string> = {
  realistic: 'professional photograph based on this sketch, photorealistic, studio lighting, high detail, sharp focus, cinematic color grading, 8k',
  illustration: 'digital illustration based on this drawing, bold outlines, rich saturated colors, editorial art style, detailed, vibrant composition',
  sketch: 'refined pencil drawing based on this sketch, detailed shading, cross-hatching, fine art, dramatic contrast, on textured paper',
  '3d': '3D render based on this sketch, studio lighting, PBR materials, ambient occlusion, octane render, clean geometry, vivid colors',
  watercolor: 'watercolor painting based on this drawing, textured paper, vivid color bleeds, saturated pigments, artistic soft edges',
  'pixel-art': 'pixel art based on this sketch, limited color palette, sharp pixels, 16-bit game style, colorful detailed sprites',
  minimal: 'clean minimalist line art based on this drawing, thin elegant lines, white background, professional graphic design',
  cartoon: 'cartoon illustration based on this sketch, bright vivid colors, bold outlines, Disney Pixar quality, cel-shading, fun and expressive',
  anime: 'anime illustration based on this drawing, cel-shading, vibrant colors, detailed expressive eyes, Makoto Shinkai style, colorful scene',
  'oil-paint': 'oil painting based on this sketch, visible thick brushstrokes, rich saturated colors, museum quality, dramatic Rembrandt lighting',
  neon: 'neon cyberpunk art based on this drawing, glowing neon outlines, dark background, Blade Runner aesthetic, electric vivid colors',
  isometric: 'isometric 3D illustration based on this sketch, vivid flat colors, clean edges, geometric shapes, Monument Valley style',
};

/**
 * Hook that drives real-time image generation via fal.ai.
 * Uses SDXL Lightning (4-step) which preserves sketch composition
 * far better than SD1.5 LCM.
 */
export function useFalRealtime(): void {
  const canvasDataUrl = useAppStore((s) => s.canvasDataUrl);
  const selectedStyle = useAppStore((s) => s.selectedStyle);
  const isGenerating = useAppStore((s) => s.isGenerating);
  const hasFal = useAppStore((s) => s.hasFal);

  const connectedRef = useRef(false);
  const mountedRef = useRef(true);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize when hasFal becomes true
  useEffect(() => {
    mountedRef.current = true;

    if (!hasFal) return;

    const handleResult = (result: FalRealtimeResult) => {
      if (!mountedRef.current) return;

      const imageUrl = result.images?.[0]?.url;
      if (!imageUrl) return;

      useAppStore.getState().setRealtimePreview(imageUrl);
      useAppStore.getState().setIsRealtimeGenerating(false);
    };

    const handleError = () => {
      if (mountedRef.current) {
        useAppStore.getState().setIsRealtimeGenerating(false);
      }
    };

    initFalRealtime(handleResult, handleError);
    connectedRef.current = true;

    return () => {
      mountedRef.current = false;
      closeFalRealtime();
      connectedRef.current = false;
      if (throttleRef.current) clearTimeout(throttleRef.current);
    };
  }, [hasFal]);

  // Send frames when canvas changes (throttled for HTTP)
  useEffect(() => {
    if (!hasFal || !connectedRef.current) return;
    if (!canvasDataUrl || canvasDataUrl.length < BLANK_THRESHOLD) return;
    if (isGenerating) return;

    if (throttleRef.current) clearTimeout(throttleRef.current);

    throttleRef.current = setTimeout(() => {
      if (!mountedRef.current) return;

      const prompt = REALTIME_STYLE_PROMPTS[selectedStyle];
      useAppStore.getState().setIsRealtimeGenerating(true);

      sendFrame(canvasDataUrl, prompt, DEFAULT_STRENGTH);
    }, THROTTLE_MS);
  }, [canvasDataUrl, selectedStyle, hasFal, isGenerating]);
}
