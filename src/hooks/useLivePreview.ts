import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ShaderEngine } from '../engine/ShaderEngine';
import { getEffectChain } from '../engine/StylePresets';

const PREVIEW_SIZE = 512;

export function useLivePreview(
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>,
): void {
  const engineRef = useRef<ShaderEngine | null>(null);
  const rafRef = useRef(0);
  const dirtyRef = useRef(true);

  const selectedStyle = useAppStore((s) => s.selectedStyle);
  const isLivePreviewEnabled = useAppStore((s) => s.isLivePreviewEnabled);
  const previewMode = useAppStore((s) => s.previewMode);

  // Mark dirty when canvas changes
  const markDirty = useCallback(() => { dirtyRef.current = true; }, []);

  // Listen to canvas pointer events to know when drawing happens
  useEffect(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('pointerup', markDirty);
    canvas.addEventListener('pointerleave', markDirty);
    // Also catch programmatic changes (undo/redo/clear)
    const handleCustom = () => { dirtyRef.current = true; };
    window.addEventListener('canvas:undo', handleCustom);
    window.addEventListener('canvas:redo', handleCustom);
    window.addEventListener('canvas:clear', handleCustom);
    return () => {
      canvas.removeEventListener('pointerup', markDirty);
      canvas.removeEventListener('pointerleave', markDirty);
      window.removeEventListener('canvas:undo', handleCustom);
      window.removeEventListener('canvas:redo', handleCustom);
      window.removeEventListener('canvas:clear', handleCustom);
    };
  }, [sourceCanvasRef, markDirty]);

  // Style changes should re-render
  useEffect(() => { dirtyRef.current = true; }, [selectedStyle]);

  useEffect(() => {
    const source = sourceCanvasRef.current;
    const preview = previewCanvasRef.current;
    const showLive = isLivePreviewEnabled && previewMode !== 'hd';

    if (!source || !preview || !showLive) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (engineRef.current) { engineRef.current.destroy(); engineRef.current = null; }
      return;
    }

    // Init engine at preview size
    try {
      if (!engineRef.current) {
        engineRef.current = new ShaderEngine(PREVIEW_SIZE, PREVIEW_SIZE);
      }
    } catch {
      // WebGL2 not available — disable
      useAppStore.getState().setIsLivePreviewEnabled(false);
      return;
    }

    // Size the preview canvas
    preview.width = PREVIEW_SIZE;
    preview.height = PREVIEW_SIZE;

    let skipCount = 0;

    function render() {
      if (!engineRef.current || !source || !preview) return;

      if (!dirtyRef.current && skipCount < 5) {
        skipCount++;
        rafRef.current = requestAnimationFrame(render);
        return;
      }
      dirtyRef.current = false;
      skipCount = 0;

      const style = useAppStore.getState().selectedStyle;
      const chain = getEffectChain(style);

      // Downscale source canvas to PREVIEW_SIZE
      const tmp = document.createElement('canvas');
      tmp.width = PREVIEW_SIZE;
      tmp.height = PREVIEW_SIZE;
      const ctx = tmp.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
        // Fit source into square
        const sw = source.width;
        const sh = source.height;
        const scale = Math.min(PREVIEW_SIZE / sw, PREVIEW_SIZE / sh);
        const dw = sw * scale;
        const dh = sh * scale;
        const dx = (PREVIEW_SIZE - dw) / 2;
        const dy = (PREVIEW_SIZE - dh) / 2;
        ctx.drawImage(source, 0, 0, sw, sh, dx, dy, dw, dh);
      }

      engineRef.current.setInput(tmp);
      engineRef.current.applyChain(chain);
      const result = engineRef.current.getResult();

      const pctx = preview.getContext('2d');
      if (pctx) pctx.putImageData(result, 0, 0);

      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [sourceCanvasRef, previewCanvasRef, isLivePreviewEnabled, previewMode, selectedStyle]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) { engineRef.current.destroy(); engineRef.current = null; }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);
}
