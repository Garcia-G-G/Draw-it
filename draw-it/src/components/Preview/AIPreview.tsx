import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../../store';
import { useGeneration, useAutoGenerate } from '../../hooks';
import Spinner from '../UI/Spinner';

function downloadImage(dataUrl: string, filename: string, format: 'png' | 'jpeg') {
  const link = document.createElement('a');
  if (format === 'jpeg') {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.download = filename;
      link.click();
    };
    img.src = dataUrl;
  } else {
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }
}

async function copyToClipboard(dataUrl: string): Promise<boolean> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

const AIPreview: React.FC = () => {
  const generatedImage = useAppStore((s) => s.generatedImage);
  const canvasDataUrl = useAppStore((s) => s.canvasDataUrl);
  const isGenerating = useAppStore((s) => s.isGenerating);
  const error = useAppStore((s) => s.generationError);
  const lastGenerationTime = useAppStore((s) => s.lastGenerationTime);
  const autoGenerate = useAppStore((s) => s.autoGenerate);
  const detectedSubject = useAppStore((s) => s.detectedSubject);
  const gallery = useAppStore((s) => s.gallery);
  const activeGalleryId = useAppStore((s) => s.activeGalleryId);
  const compareMode = useAppStore((s) => s.compareMode);
  const setActiveGalleryId = useAppStore((s) => s.setActiveGalleryId);
  const setCompareMode = useAppStore((s) => s.setCompareMode);
  const addToast = useAppStore((s) => s.addToast);

  const { generate, clearError } = useGeneration();
  const { countdown } = useAutoGenerate();

  const [imageLoaded, setImageLoaded] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [comparePos, setComparePos] = useState(50);
  const compareRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!isGenerating) { setElapsedTime(0); return; }
    const start = Date.now();
    const interval = setInterval(() => setElapsedTime(Date.now() - start), 100);
    return () => clearInterval(interval);
  }, [isGenerating]);

  useEffect(() => {
    if (generatedImage) {
      setImageLoaded(false);
      const timer = setTimeout(() => setImageLoaded(true), 50);
      return () => clearTimeout(timer);
    }
  }, [generatedImage]);

  const handleRegenerate = useCallback(() => { clearError(); generate(); }, [generate, clearError]);

  const handleDownloadPng = useCallback(() => {
    if (!generatedImage) return;
    downloadImage(generatedImage, `drawit-${Date.now()}.png`, 'png');
    addToast('success', 'PNG downloaded!');
  }, [generatedImage, addToast]);

  const handleDownloadJpg = useCallback(() => {
    if (!generatedImage) return;
    downloadImage(generatedImage, `drawit-${Date.now()}.jpg`, 'jpeg');
    addToast('success', 'JPG downloaded!');
  }, [generatedImage, addToast]);

  const handleCopy = useCallback(async () => {
    if (!generatedImage) return;
    const ok = await copyToClipboard(generatedImage);
    addToast(ok ? 'success' : 'error', ok ? 'Copied to clipboard!' : 'Failed to copy');
  }, [generatedImage, addToast]);

  const handleCompareMove = useCallback((clientX: number) => {
    if (!compareRef.current) return;
    const rect = compareRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setComparePos(pct);
  }, []);

  const handlePointerDown = useCallback(() => { draggingRef.current = true; }, []);
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingRef.current) handleCompareMove(e.clientX);
  }, [handleCompareMove]);
  const handlePointerUp = useCallback(() => { draggingRef.current = false; }, []);

  // Error state
  if (error && !isGenerating) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-lg border-2 border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 h-10 w-10 text-red-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <p className="mb-1 text-center text-sm font-medium text-red-700 dark:text-red-300">Generation Failed</p>
        <p className="mb-4 max-w-xs text-center text-xs text-red-500 dark:text-red-400">{error}</p>
        <div className="flex gap-2">
          <button onClick={handleRegenerate} className="rounded-md bg-red-100 px-4 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-800 dark:text-red-200 dark:hover:bg-red-700">Try Again</button>
          <button onClick={clearError} className="rounded-md bg-gray-100 px-4 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300">Dismiss</button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isGenerating) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-lg border-2 border-indigo-100 bg-indigo-50/50 p-6 animate-pulse-border dark:border-indigo-800 dark:bg-indigo-900/20">
        <div className="mb-4"><Spinner size="lg" /></div>
        <p className="mb-1 text-sm font-medium text-indigo-700 dark:text-indigo-300">Creating your masterpiece...</p>
        <p className="text-xs tabular-nums text-indigo-400 dark:text-indigo-500">{(elapsedTime / 1000).toFixed(1)}s elapsed</p>
      </div>
    );
  }

  // Result state
  if (generatedImage) {
    return (
      <div className="flex h-full w-full flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {/* Image area */}
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-lg bg-gray-100 dark:bg-gray-900">
          {compareMode && canvasDataUrl ? (
            <div
              ref={compareRef}
              className="relative h-full w-full select-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <img src={generatedImage} alt="AI generated" className="h-full w-full object-contain" />
              <div className="absolute inset-0 overflow-hidden" style={{ width: `${comparePos}%` }}>
                <img src={canvasDataUrl} alt="Original sketch" className="h-full w-full object-contain" style={{ minWidth: compareRef.current ? `${compareRef.current.offsetWidth}px` : '100%' }} />
              </div>
              <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `${comparePos}%` }}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-1 shadow-md">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 text-gray-500">
                    <path d="M8 3l-5 9 5 9M16 3l5 9-5 9" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <img
              src={generatedImage}
              alt="AI generated image"
              className={`h-full w-full object-contain transition-all duration-300 ${
                imageLoaded ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
              }`}
            />
          )}
          {countdown !== null && autoGenerate && (
            <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              Regenerating in {(countdown / 1000).toFixed(1)}s...
            </div>
          )}
        </div>

        {/* Detected subject */}
        {detectedSubject && (
          <div className="border-t border-gray-100 px-2 py-1 dark:border-gray-700">
            <p className="truncate text-[10px] text-gray-400 dark:text-gray-500">
              AI saw: &ldquo;{detectedSubject}&rdquo;
            </p>
          </div>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 px-2 py-1.5 dark:border-gray-700">
          <span className="mr-auto text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
            {lastGenerationTime ? `${(lastGenerationTime / 1000).toFixed(1)}s` : ''}
          </span>
          <ActionBtn onClick={handleDownloadPng} label="PNG" />
          <ActionBtn onClick={handleDownloadJpg} label="JPG" />
          <ActionBtn onClick={handleCopy} label="Copy" />
          <ActionBtn onClick={() => setCompareMode(!compareMode)} label={compareMode ? 'Exit Compare' : 'Compare'} active={compareMode} />
          <button onClick={handleRegenerate} className="rounded-md bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50">
            Regenerate
          </button>
        </div>

        {/* Gallery strip */}
        {gallery.length > 1 && (
          <div className="scrollbar-thin flex gap-1 overflow-x-auto border-t border-gray-100 px-2 py-1.5 dark:border-gray-700">
            {gallery.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveGalleryId(item.id)}
                className={`h-[52px] w-[52px] shrink-0 overflow-hidden rounded-md border-2 transition-all hover:scale-105 ${
                  activeGalleryId === item.id
                    ? 'border-indigo-500 shadow-sm'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
                title={`${item.style} \u2022 ${(item.durationMs / 1000).toFixed(1)}s`}
              >
                <img src={item.imageBase64} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Empty state
  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 dark:border-gray-600 dark:bg-gray-800/50">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
      </svg>
      <p className="mb-1 text-center text-sm font-medium text-gray-400 dark:text-gray-500">
        {autoGenerate ? 'Draw something \u2014 AI generates automatically' : 'Draw something and click Generate'}
      </p>
      <p className="max-w-[220px] text-center text-xs text-gray-300 dark:text-gray-600">
        {autoGenerate ? 'Your sketch transforms 2s after you stop drawing' : 'Click the sparkle button in the toolbar when ready'}
      </p>
      {countdown !== null && autoGenerate && (
        <div className="mt-3 flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 dark:bg-indigo-900/30">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
          <span className="text-xs font-medium tabular-nums text-indigo-600 dark:text-indigo-400">Generating in {(countdown / 1000).toFixed(1)}s...</span>
        </div>
      )}
    </div>
  );
};

const ActionBtn: React.FC<{ onClick: () => void; label: string; active?: boolean }> = React.memo(({ onClick, label, active }) => (
  <button
    onClick={onClick}
    className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
      active
        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
    }`}
  >
    {label}
  </button>
));

ActionBtn.displayName = 'ActionBtn';

export default React.memo(AIPreview);
