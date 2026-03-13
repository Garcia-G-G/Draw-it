import React, { useCallback, useState } from 'react';
import { useAppStore } from '../../store';
import { useGeneration } from '../../hooks';
import type { Tool } from '../../types';

const TOOL_ICONS: Record<Tool, React.ReactNode> = {
  pencil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
    </svg>
  ),
  eraser: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" />
    </svg>
  ),
  line: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
      <line x1="5" y1="19" x2="19" y2="5" />
    </svg>
  ),
  rectangle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  ),
  circle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  fill: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" /><path d="m5 2 5 5" /><path d="M2 13h15" /><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" />
    </svg>
  ),
};

const TOOL_LABELS: Record<Tool, string> = {
  pencil: 'Pencil (B)', eraser: 'Eraser (E)', line: 'Line (L)',
  rectangle: 'Rectangle (R)', circle: 'Circle (C)', fill: 'Fill (G)',
};

const TOOL_ORDER: Tool[] = ['pencil', 'eraser', 'line', 'rectangle', 'circle', 'fill'];

const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899', '#92400E', '#6B7280',
];

const Toolbar: React.FC = () => {
  const activeTool = useAppStore((s) => s.activeTool);
  const brushSize = useAppStore((s) => s.brushSize);
  const brushColor = useAppStore((s) => s.brushColor);
  const canUndo = useAppStore((s) => s.historyIndex > 0);
  const canRedo = useAppStore((s) => s.historyIndex < s.snapshots.length - 1);
  const setActiveTool = useAppStore((s) => s.setActiveTool);
  const setBrushSize = useAppStore((s) => s.setBrushSize);
  const setBrushColor = useAppStore((s) => s.setBrushColor);
  const isGenerating = useAppStore((s) => s.isGenerating);
  const { generate } = useGeneration();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleBrushSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBrushSize(Number(e.target.value));
  }, [setBrushSize]);

  const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBrushColor(e.target.value);
  }, [setBrushColor]);

  const handleClearClick = useCallback(() => {
    if (showClearConfirm) {
      window.dispatchEvent(new CustomEvent('canvas:clear'));
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  }, [showClearConfirm]);

  const handleUndo = useCallback(() => { window.dispatchEvent(new CustomEvent('canvas:undo')); }, []);
  const handleRedo = useCallback(() => { window.dispatchEvent(new CustomEvent('canvas:redo')); }, []);
  const handleGenerate = useCallback(() => { generate(); }, [generate]);

  return (
    <div className="flex w-[64px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-gray-200 bg-gray-50 px-1.5 py-2 dark:border-gray-700 dark:bg-gray-800 md:w-[72px] md:py-3">
      {/* Tools */}
      <div className="flex flex-col gap-1">
        {TOOL_ORDER.map((tool) => (
          <button
            key={tool}
            onClick={() => setActiveTool(tool)}
            title={TOOL_LABELS[tool]}
            aria-label={TOOL_LABELS[tool]}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all md:h-9 md:w-9 ${
              activeTool === tool
                ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400 dark:bg-indigo-900/50 dark:text-indigo-300 dark:ring-indigo-500'
                : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {TOOL_ICONS[tool]}
          </button>
        ))}
      </div>

      <div className="my-1 h-px w-full bg-gray-200 dark:bg-gray-700" />

      {/* Brush size */}
      <div className="flex flex-col items-center gap-1">
        <div
          className="rounded-full bg-gray-800 dark:bg-gray-200"
          style={{ width: `${Math.max(4, Math.min(brushSize, 24))}px`, height: `${Math.max(4, Math.min(brushSize, 24))}px` }}
          aria-hidden="true"
        />
        <input
          type="range" min="1" max="50" value={brushSize}
          onChange={handleBrushSizeChange}
          className="h-14 w-1 appearance-none [writing-mode:vertical-lr] accent-indigo-600 md:h-16"
          aria-label={`Brush size: ${brushSize}px`} title={`${brushSize}px`}
        />
        <span className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">{brushSize}px</span>
      </div>

      <div className="my-1 h-px w-full bg-gray-200 dark:bg-gray-700" />

      {/* Current color */}
      <div className="h-6 w-6 rounded-md border-2 border-gray-300 shadow-sm dark:border-gray-600" style={{ backgroundColor: brushColor }} aria-label={`Current color: ${brushColor}`} />

      {/* Color palette */}
      <div className="grid grid-cols-3 gap-0.5">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => setBrushColor(color)}
            aria-label={`Color ${color}`}
            className={`h-5 w-5 rounded-sm border transition-transform hover:scale-110 ${
              brushColor === color ? 'border-indigo-500 ring-1 ring-indigo-400' : 'border-gray-300 dark:border-gray-600'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <label className="relative mt-0.5 cursor-pointer" aria-label="Custom color picker">
        <div className="flex h-5 w-full items-center justify-center rounded-sm border border-gray-300 bg-gradient-to-r from-red-500 via-green-500 to-blue-500 dark:border-gray-600">
          <span className="text-[8px] font-bold text-white drop-shadow">+</span>
        </div>
        <input type="color" value={brushColor} onChange={handleColorChange} className="absolute inset-0 h-0 w-0 opacity-0" />
      </label>

      <div className="my-1 h-px w-full bg-gray-200 dark:bg-gray-700" />

      {/* Actions */}
      <div className="flex flex-col gap-1">
        <button onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo"
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
        </button>
        <button onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
        </button>
        <button onClick={handleClearClick} title={showClearConfirm ? 'Click again to confirm' : 'Clear Canvas'} aria-label="Clear Canvas"
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            showClearConfirm ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' : 'text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
        </button>
      </div>

      <div className="mt-auto" />

      {/* Generate button */}
      <button onClick={handleGenerate} disabled={isGenerating}
        title={isGenerating ? 'Generating...' : 'Generate AI Image'} aria-label="Generate"
        className={`flex h-9 w-9 items-center justify-center rounded-lg shadow-sm transition-all ${
          isGenerating ? 'cursor-not-allowed bg-indigo-400 text-white/70' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:bg-indigo-800'
        }`}>
        {isGenerating ? (
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default React.memo(Toolbar);
