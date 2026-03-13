import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store';
import type { GenerationQuality } from '../../types';

const QUALITY_OPTIONS: { value: GenerationQuality; label: string; cost: string }[] = [
  { value: 'low', label: 'Low', cost: '~$0.02' },
  { value: 'medium', label: 'Medium', cost: '~$0.07' },
  { value: 'high', label: 'High', cost: '~$0.19' },
];

const Header: React.FC = () => {
  const autoGenerate = useAppStore((s) => s.autoGenerate);
  const generationCount = useAppStore((s) => s.generationCount);
  const estimatedCost = useAppStore((s) => s.estimatedCost);
  const selectedQuality = useAppStore((s) => s.selectedQuality);
  const theme = useAppStore((s) => s.theme);
  const setAutoGenerate = useAppStore((s) => s.setAutoGenerate);
  const setSelectedQuality = useAppStore((s) => s.setSelectedQuality);
  const setTheme = useAppStore((s) => s.setTheme);

  const [qualityOpen, setQualityOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleAutoGenerate = useCallback(() => {
    setAutoGenerate(!autoGenerate);
  }, [autoGenerate, setAutoGenerate]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  const handleQualitySelect = useCallback((q: GenerationQuality) => {
    setSelectedQuality(q);
    setQualityOpen(false);
  }, [setSelectedQuality]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!qualityOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setQualityOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [qualityOpen]);

  const currentQuality = QUALITY_OPTIONS.find((q) => q.value === selectedQuality);

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
          Draw It
        </h1>
        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
          AI
        </span>
      </div>

      {/* Auto/Manual toggle */}
      <div className="flex items-center gap-1.5">
        <span className={`text-[11px] ${!autoGenerate ? 'font-medium text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>Manual</span>
        <button
          onClick={toggleAutoGenerate}
          role="switch"
          aria-checked={autoGenerate}
          aria-label={autoGenerate ? 'Switch to manual mode' : 'Switch to auto mode'}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            autoGenerate ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              autoGenerate ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
        <span className={`text-[11px] ${autoGenerate ? 'font-medium text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>Auto</span>
      </div>

      {/* Dark mode toggle */}
      <button
        onClick={toggleTheme}
        aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
      >
        {theme === 'light' ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
      </button>

      {/* Quality dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setQualityOpen(!qualityOpen)}
          className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Quality: {currentQuality?.label}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {qualityOpen && (
          <div className="absolute top-full left-0 z-40 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-700">
            {QUALITY_OPTIONS.map((q) => (
              <button
                key={q.value}
                onClick={() => handleQualitySelect(q.value)}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-xs transition-colors ${
                  selectedQuality === q.value
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                <span>{q.label}</span>
                <span className="text-gray-400 dark:text-gray-500">{q.cost}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="ml-auto flex items-center gap-2 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
        {generationCount > 0 && (
          <>
            <span>~${estimatedCost.toFixed(2)}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>{generationCount} img{generationCount !== 1 ? 's' : ''}</span>
          </>
        )}
      </div>
    </header>
  );
};

export default React.memo(Header);
