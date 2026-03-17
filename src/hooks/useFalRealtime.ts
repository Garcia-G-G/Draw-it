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
const DEFAULT_STRENGTH = 0.6;

const REALTIME_STYLE_PROMPTS: Record<DrawingStyleId, string> = {
  realistic: 'photorealistic, studio lighting, high detail, 8k, cinematic',
  illustration: 'digital illustration, bold outlines, rich colors, editorial art',
  sketch: 'pencil drawing, detailed shading, cross-hatching, fine art',
  '3d': '3D render, studio lighting, PBR materials, ambient occlusion, octane',
  watercolor: 'watercolor painting, textured paper, soft color bleeds, vibrant',
  'pixel-art': 'pixel art, limited palette, sharp pixels, 16-bit game',
  minimal: 'minimalist line art, thin lines, clean, white background',
  cartoon: 'cartoon, bright colors, bold outlines, Disney quality, cel-shading',
  anime: 'anime illustration, cel-shading, vibrant colors, detailed eyes, Makoto Shinkai',
  'oil-paint': 'oil painting, visible brushstrokes, rich colors, museum quality',
  neon: 'neon glow, dark background, cyberpunk, Blade Runner, electric colors',
  isometric: 'isometric 3D, flat colors, clean edges, geometric, Monument Valley',
};

/**
 * Hook that drives real-time image generation via fal.ai WebSocket.
 * Does nothing if hasFal is false — safe to call unconditionally.
 */
export function useFalRealtime(): void {
  const canvasDataUrl = useAppStore((s) => s.canvasDataUrl);
  const selectedStyle = useAppStore((s) => s.selectedStyle);
  const isGenerating = useAppStore((s) => s.isGenerating);
  const hasFal = useAppStore((s) => s.hasFal);

  const connectedRef = useRef(false);
  const mountedRef = useRef(true);

  // Initialize WebSocket connection when hasFal becomes true
  useEffect(() => {
    mountedRef.current = true;

    if (!hasFal) return;

    const handleResult = (result: FalRealtimeResult) => {
      if (!mountedRef.current) return;

      const imageUrl = result.images?.[0]?.url;
      if (!imageUrl) return;

      // Store the URL directly — <img> handles both data URLs and http URLs
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
    };
  }, [hasFal]);

  // Send frames when canvas changes
  useEffect(() => {
    if (!hasFal || !connectedRef.current) return;
    if (!canvasDataUrl || canvasDataUrl.length < BLANK_THRESHOLD) return;
    if (isGenerating) return;

    const prompt = REALTIME_STYLE_PROMPTS[selectedStyle];

    useAppStore.getState().setIsRealtimeGenerating(true);
    sendFrame(canvasDataUrl, prompt, DEFAULT_STRENGTH);
  }, [canvasDataUrl, selectedStyle, hasFal, isGenerating]);
}
