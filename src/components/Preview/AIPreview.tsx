import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../../store';
import { useGeneration, useAutoGenerate } from '../../hooks';
import Spinner from '../UI/Spinner';

function downloadImage(dataUrl: string, filename: string, format: 'png' | 'jpeg') {
  const link = document.createElement('a');
  if (format === 'jpeg') {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#FFF'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      link.href = c.toDataURL('image/jpeg', 0.9); link.download = filename; link.click();
    };
    img.src = dataUrl;
  } else { link.href = dataUrl; link.download = filename; link.click(); }
}

async function copyToClipboard(dataUrl: string): Promise<boolean> {
  try {
    const res = await fetch(dataUrl); const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch { return false; }
}

interface AIPreviewProps {
  livePreviewCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

const AIPreview: React.FC<AIPreviewProps> = ({ livePreviewCanvasRef }) => {
  const generatedImage = useAppStore((s) => s.generatedImage);
  const isLivePreviewEnabled = useAppStore((s) => s.isLivePreviewEnabled);
  const realtimePreview = useAppStore((s) => s.realtimePreview);
  const realtimeLatency = useAppStore((s) => s.realtimeLatency);
  const isRealtimeGenerating = useAppStore((s) => s.isRealtimeGenerating);
  const isRealtimeEnabled = useAppStore((s) => s.isRealtimeEnabled);
  const previewMode = useAppStore((s) => s.previewMode);
  const canvasDataUrl = useAppStore((s) => s.canvasDataUrl);
  const isGenerating = useAppStore((s) => s.isGenerating);
  const error = useAppStore((s) => s.generationError);
  const lastGenerationTime = useAppStore((s) => s.lastGenerationTime);
  const autoGenerate = useAppStore((s) => s.autoGenerate);
  const detectedSubject = useAppStore((s) => s.detectedSubject);
  const promptOverride = useAppStore((s) => s.promptOverride);
  const gallery = useAppStore((s) => s.gallery);
  const activeGalleryId = useAppStore((s) => s.activeGalleryId);
  const compareMode = useAppStore((s) => s.compareMode);
  const hasOpenAI = useAppStore((s) => s.hasOpenAI);
  const setActiveGalleryId = useAppStore((s) => s.setActiveGalleryId);
  const setCompareMode = useAppStore((s) => s.setCompareMode);
  const setPromptOverride = useAppStore((s) => s.setPromptOverride);
  const addToast = useAppStore((s) => s.addToast);

  const { generate, refine, clearError } = useGeneration();
  const { countdown } = useAutoGenerate();

  const [imageLoaded, setImageLoaded] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [comparePos, setComparePos] = useState(50);
  const compareRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const displayImage = previewMode === 'hd' && generatedImage ? generatedImage : realtimePreview;
  const isHD = previewMode === 'hd' && generatedImage !== null;

  useEffect(() => {
    if (!isGenerating) { setElapsedTime(0); return; }
    const start = Date.now();
    const iv = setInterval(() => setElapsedTime(Date.now() - start), 100);
    return () => clearInterval(iv);
  }, [isGenerating]);

  useEffect(() => {
    if (generatedImage) { setImageLoaded(false); const t = setTimeout(() => setImageLoaded(true), 50); return () => clearTimeout(t); }
  }, [generatedImage]);

  const handleRegenerate = useCallback(() => { clearError(); generate(); }, [generate, clearError]);
  const handleHDUpgrade = useCallback(() => { generate(); }, [generate]);
  const handleRefine = useCallback(() => { refine(); }, [refine]);
  const handleOverrideGenerate = useCallback(() => {
    if (promptOverride.trim()) generate(promptOverride.trim());
  }, [generate, promptOverride]);

  const handleDownloadPng = useCallback(() => {
    if (!displayImage) return;
    downloadImage(displayImage, `drawit-${Date.now()}.png`, 'png');
    addToast('success', 'PNG downloaded!');
  }, [displayImage, addToast]);
  const handleDownloadJpg = useCallback(() => {
    if (!displayImage) return;
    downloadImage(displayImage, `drawit-${Date.now()}.jpg`, 'jpeg');
    addToast('success', 'JPG downloaded!');
  }, [displayImage, addToast]);
  const handleCopy = useCallback(async () => {
    if (!displayImage) return;
    const ok = await copyToClipboard(displayImage);
    addToast(ok ? 'success' : 'error', ok ? 'Copied to clipboard!' : 'Failed to copy');
  }, [displayImage, addToast]);

  const handleCompareMove = useCallback((x: number) => {
    if (!compareRef.current) return;
    const r = compareRef.current.getBoundingClientRect();
    setComparePos(Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100)));
  }, []);
  const handlePointerDown = useCallback(() => { draggingRef.current = true; }, []);
  const handlePointerMove = useCallback((e: React.PointerEvent) => { if (draggingRef.current) handleCompareMove(e.clientX); }, [handleCompareMove]);
  const handlePointerUp = useCallback(() => { draggingRef.current = false; }, []);

  // Error state
  if (error && !isGenerating) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-lg border-2 border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 h-10 w-10 text-red-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <p className="mb-1 text-sm font-medium text-red-700 dark:text-red-300">Generation Failed</p>
        <p className="mb-4 max-w-xs text-center text-xs text-red-500 dark:text-red-400">{error}</p>
        <div className="flex gap-2">
          <button onClick={handleRegenerate} className="rounded-md bg-red-100 px-4 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-800 dark:text-red-200">Try Again</button>
          <button onClick={clearError} className="rounded-md bg-gray-100 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300">Dismiss</button>
        </div>
      </div>
    );
  }

  // Shimmer loading overlay
  const loadingOverlay = isGenerating && (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
      {/* If we have a canvas image, show it blurred as skeleton */}
      {canvasDataUrl && !displayImage && (
        <img src={canvasDataUrl} alt="" className="absolute inset-0 h-full w-full object-contain opacity-30 blur-sm" />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 animate-pulse" />
      <div className="relative z-10 flex flex-col items-center">
        <Spinner size="lg" />
        <p className="mt-3 text-sm font-medium text-white drop-shadow-lg">Generating HD artwork...</p>
        <p className="text-xs tabular-nums text-white/70 drop-shadow">{(elapsedTime / 1000).toFixed(1)}s</p>
      </div>
    </div>
  );

  // Has any image to show
  if (displayImage || isGenerating) {
    return (
      <div className="flex h-full w-full flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {/* Image area */}
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-lg bg-gray-100 dark:bg-gray-900">
          {compareMode && canvasDataUrl && displayImage ? (
            <div ref={compareRef} className="relative h-full w-full select-none"
              onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
              <img src={displayImage} alt="Generated" className="h-full w-full object-contain" />
              <div className="absolute inset-0 overflow-hidden" style={{ width: `${comparePos}%` }}>
                <img src={canvasDataUrl} alt="Sketch" className="h-full w-full object-contain"
                  style={{ minWidth: compareRef.current ? `${compareRef.current.offsetWidth}px` : '100%' }} />
              </div>
              <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `${comparePos}%` }}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-1 shadow-md">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 text-gray-500"><path d="M8 3l-5 9 5 9M16 3l5 9-5 9" /></svg>
                </div>
              </div>
            </div>
          ) : displayImage ? (
            <img src={displayImage} alt="AI generated"
              className={`h-full w-full object-contain transition-all duration-300 ${
                isHD ? (imageLoaded ? 'scale-100 opacity-100' : 'scale-95 opacity-0') : 'opacity-100'
              }`} />
          ) : null}

          {loadingOverlay}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex gap-1.5">
            {isHD && !isGenerating && (
              <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">HD</span>
            )}
            {!isHD && realtimePreview && !isGenerating && (
              <span className="rounded bg-indigo-500/80 px-1.5 py-0.5 text-[10px] font-medium text-white shadow backdrop-blur-sm">
                Live {realtimeLatency > 0 ? `~${(realtimeLatency / 1000).toFixed(1)}s` : ''}
              </span>
            )}
            {isRealtimeGenerating && !isGenerating && (
              <span className="h-2 w-2 animate-pulse self-center rounded-full bg-green-400 shadow" />
            )}
          </div>

          {countdown !== null && autoGenerate && !isGenerating && (
            <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              HD in {(countdown / 1000).toFixed(1)}s...
            </div>
          )}
        </div>

        {/* AI interpretation + prompt override */}
        {(detectedSubject || isHD) && !isGenerating && (
          <div className="border-t border-gray-100 px-2 py-1.5 dark:border-gray-700">
            {detectedSubject && (
              <p className="mb-1 text-[11px] text-gray-500 dark:text-gray-400">
                <span className="font-medium">AI saw:</span> {detectedSubject}
              </p>
            )}
            <div className="flex gap-1">
              <input
                type="text"
                value={promptOverride}
                onChange={(e) => setPromptOverride(e.target.value)}
                placeholder="Wrong? Type what you drew..."
                className="flex-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder:text-gray-500"
              />
              {promptOverride.trim() && (
                <button onClick={handleOverrideGenerate}
                  className="shrink-0 rounded bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700">
                  Redo
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 px-2 py-1.5 dark:border-gray-700">
          <span className="mr-auto text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
            {isHD && lastGenerationTime ? `HD ${(lastGenerationTime / 1000).toFixed(1)}s` : realtimeLatency > 0 ? `Live ~${(realtimeLatency / 1000).toFixed(1)}s` : ''}
          </span>
          {displayImage && !isGenerating && (
            <>
              <ActionBtn onClick={handleDownloadPng} label="PNG" />
              <ActionBtn onClick={handleDownloadJpg} label="JPG" />
              <ActionBtn onClick={handleCopy} label="Copy" />
              <ActionBtn onClick={() => setCompareMode(!compareMode)} label={compareMode ? 'Exit' : 'Compare'} active={compareMode} />
            </>
          )}
          {hasOpenAI && isHD && !isGenerating && (
            <button onClick={handleRefine}
              className="rounded-md bg-purple-50 px-2.5 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300">
              Refine
            </button>
          )}
          {hasOpenAI && !isGenerating && (
            <button onClick={isHD ? handleRegenerate : handleHDUpgrade}
              className="rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300">
              {isHD ? 'Regenerate HD' : '\u2728 HD Upgrade'}
            </button>
          )}
        </div>

        {/* Gallery strip */}
        {gallery.length > 1 && (
          <div className="scrollbar-thin flex gap-1 overflow-x-auto border-t border-gray-100 px-2 py-1.5 dark:border-gray-700">
            {gallery.map((item) => (
              <button key={item.id} onClick={() => setActiveGalleryId(item.id)}
                className={`h-[52px] w-[52px] shrink-0 overflow-hidden rounded-md border-2 transition-all hover:scale-105 ${
                  activeGalleryId === item.id ? 'border-indigo-500 shadow-sm' : 'border-transparent opacity-70 hover:opacity-100'
                }`} title={`${item.style} \u2022 ${(item.durationMs / 1000).toFixed(1)}s`}>
                <img src={item.imageBase64} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Live preview (WebGL shader) or empty state
  if (isLivePreviewEnabled && livePreviewCanvasRef) {
    return (
      <div className="flex h-full w-full flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-lg bg-gray-100 dark:bg-gray-900">
          <canvas
            ref={livePreviewCanvasRef}
            className="h-full w-full object-contain"
            style={{ imageRendering: 'auto' }}
          />
          <div className="absolute top-2 left-2">
            <span className="flex items-center gap-1 rounded bg-green-500/80 px-1.5 py-0.5 text-[10px] font-medium text-white shadow backdrop-blur-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              LIVE
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 border-t border-gray-100 px-2 py-1.5 dark:border-gray-700">
          <span className="mr-auto text-[10px] text-gray-400 dark:text-gray-500">Shader preview (60fps)</span>
          {hasOpenAI && (
            <button onClick={handleHDUpgrade} disabled={isGenerating}
              className="rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300">
              \u2728 Generate HD
            </button>
          )}
        </div>
      </div>
    );
  }

  // Empty state (no live preview, no generated image)
  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 dark:border-gray-600 dark:bg-gray-800/50">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
      </svg>
      <p className="mb-1 text-center text-sm font-medium text-gray-400 dark:text-gray-500">
        {autoGenerate ? 'Draw something \u2014 AI generates automatically' : 'Draw something and click Generate'}
      </p>
      <p className="max-w-[220px] text-center text-xs text-gray-300 dark:text-gray-600">
        Click the sparkle button in the toolbar
      </p>
    </div>
  );
};

const ActionBtn: React.FC<{ onClick: () => void; label: string; active?: boolean }> = React.memo(({ onClick, label, active }) => (
  <button onClick={onClick}
    className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
      active ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
    }`}>{label}</button>
));
ActionBtn.displayName = 'ActionBtn';

export default React.memo(AIPreview);
