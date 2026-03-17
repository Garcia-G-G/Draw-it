import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { realtimeGenerate, cancelRealtime } from '../services/realtime';
import type { DrawingStyleId } from '../types';

const THROTTLE_MS = 500;
const BLANK_THRESHOLD = 1000;

const REALTIME_STYLE_PROMPTS: Record<DrawingStyleId, string> = {
  realistic: 'Professional photorealistic artwork, studio lighting, high detail, cinematic',
  illustration: 'High-end digital illustration, bold outlines, rich flat colors, editorial quality',
  sketch: 'Professional pencil sketch, detailed shading, cross-hatching, artistic',
  '3d': 'Professional 3D render, studio lighting, PBR materials, ambient occlusion',
  watercolor: 'Fine art watercolor painting, textured paper, soft color bleeds, vibrant pigments',
  'pixel-art': 'Retro pixel art, limited palette, sharp pixels, 16-bit game aesthetic',
  minimal: 'Ultra-clean minimalist line art, thin elegant lines, no shading',
  cartoon: 'High-end cartoon illustration, bright saturated colors, expressive, Disney quality',
  anime: 'Professional anime illustration, cel-shading, vibrant colors, Studio Ghibli quality',
  'oil-paint': 'Museum-quality oil painting, visible brushstrokes, rich colors, Renaissance lighting',
  neon: 'Cyberpunk neon art, glowing neon outlines on dark background, Blade Runner aesthetic',
  isometric: 'Clean isometric 3D illustration, flat colors, no perspective distortion',
};

export function useRealtimeGeneration(): void {
  const canvasDataUrl = useAppStore((s) => s.canvasDataUrl);
  const isRealtimeEnabled = useAppStore((s) => s.isRealtimeEnabled);
  const selectedStyle = useAppStore((s) => s.selectedStyle);
  const isGenerating = useAppStore((s) => s.isGenerating);
  const hasFal = useAppStore((s) => s.hasFal);

  const lastSentRef = useRef<string | null>(null);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelRealtime();
      if (throttleRef.current) clearTimeout(throttleRef.current);
    };
  }, []);

  useEffect(() => {
    // fal.ai WebSocket handles realtime when available — yield to it
    if (hasFal) return;

    if (!isRealtimeEnabled || !canvasDataUrl || canvasDataUrl.length < BLANK_THRESHOLD) {
      return;
    }

    // Don't send if HD is currently generating (avoid visual confusion)
    if (isGenerating) return;

    // Don't re-send the same canvas
    if (canvasDataUrl === lastSentRef.current) return;

    // Throttle
    if (throttleRef.current) clearTimeout(throttleRef.current);

    throttleRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;

      lastSentRef.current = canvasDataUrl;
      const style = useAppStore.getState().selectedStyle;
      const prompt = REALTIME_STYLE_PROMPTS[style];

      useAppStore.getState().setIsRealtimeGenerating(true);

      try {
        const result = await realtimeGenerate(canvasDataUrl, prompt, 0.65);
        if (!mountedRef.current) return;

        const dataUrl = `data:image/jpeg;base64,${result.imageBase64}`;
        useAppStore.getState().setRealtimePreview(dataUrl);
        useAppStore.getState().setRealtimeLatency(result.latency);
      } catch (err) {
        // AbortError is expected when we cancel — ignore it
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Don't show error toast for realtime — it's a preview, not critical
      } finally {
        if (mountedRef.current) {
          useAppStore.getState().setIsRealtimeGenerating(false);
        }
      }
    }, THROTTLE_MS);
  }, [canvasDataUrl, isRealtimeEnabled, selectedStyle, isGenerating, hasFal]);
}
