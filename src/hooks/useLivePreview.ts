import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ShaderEngine } from '../engine/ShaderEngine';
import { getEffectChain } from '../engine/StylePresets';

const PREVIEW_SIZE = 512;

export function useLivePreview(
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>,
): void {
  const engineRef = useRef<ShaderEngine | null>(null);
  const tmpCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const canvasDataUrl = useAppStore((s) => s.canvasDataUrl);
  const selectedStyle = useAppStore((s) => s.selectedStyle);
  const isLivePreviewEnabled = useAppStore((s) => s.isLivePreviewEnabled);
  const previewMode = useAppStore((s) => s.previewMode);

  useEffect(() => {
    const preview = previewCanvasRef.current;
    const showLive = isLivePreviewEnabled && previewMode !== 'hd';

    if (!preview || !showLive || !canvasDataUrl) {
      return;
    }

    // Lazy init engine
    if (!engineRef.current) {
      try {
        engineRef.current = new ShaderEngine(PREVIEW_SIZE, PREVIEW_SIZE);
      } catch {
        useAppStore.getState().setIsLivePreviewEnabled(false);
        return;
      }
    }

    // Lazy init reusable tmp canvas
    if (!tmpCanvasRef.current) {
      tmpCanvasRef.current = document.createElement('canvas');
      tmpCanvasRef.current.width = PREVIEW_SIZE;
      tmpCanvasRef.current.height = PREVIEW_SIZE;
    }

    // Size the preview canvas
    if (preview.width !== PREVIEW_SIZE) {
      preview.width = PREVIEW_SIZE;
      preview.height = PREVIEW_SIZE;
    }

    // Load the canvas data URL into an image, then process
    const img = new Image();
    img.onload = () => {
      if (!engineRef.current || !tmpCanvasRef.current) return;

      const ctx = tmpCanvasRef.current.getContext('2d');
      if (!ctx) return;

      // White background + fit source
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
      const scale = Math.min(PREVIEW_SIZE / img.width, PREVIEW_SIZE / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (PREVIEW_SIZE - dw) / 2, (PREVIEW_SIZE - dh) / 2, dw, dh);

      // Run shader chain
      const chain = getEffectChain(selectedStyle);
      engineRef.current.setInput(tmpCanvasRef.current);
      engineRef.current.applyChain(chain);
      const result = engineRef.current.getResult();

      // Draw to preview
      const pctx = preview.getContext('2d');
      if (pctx) pctx.putImageData(result, 0, 0);
    };
    img.src = canvasDataUrl;
  }, [canvasDataUrl, selectedStyle, isLivePreviewEnabled, previewMode, previewCanvasRef]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);
}
