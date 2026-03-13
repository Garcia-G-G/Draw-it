import React, { useCallback } from 'react';
import { useAppStore } from '../../store';
import type { DrawingStyle, DrawingStyleId } from '../../types';

const STYLES: DrawingStyle[] = [
  { id: 'realistic', name: 'Realistic', icon: '\uD83D\uDCF7' },
  { id: 'illustration', name: 'Illustration', icon: '\uD83C\uDFA8' },
  { id: 'sketch', name: 'Pro Sketch', icon: '\u270F\uFE0F' },
  { id: '3d', name: '3D Render', icon: '\uD83E\uDDCA' },
  { id: 'watercolor', name: 'Watercolor', icon: '\uD83D\uDCA7' },
  { id: 'pixel-art', name: 'Pixel Art', icon: '\uD83D\uDC7E' },
  { id: 'minimal', name: 'Minimal', icon: '\u25FD' },
  { id: 'cartoon', name: 'Cartoon', icon: '\uD83C\uDFAC' },
  { id: 'anime', name: 'Anime', icon: '\u2B50' },
  { id: 'oil-paint', name: 'Oil Paint', icon: '\uD83D\uDDBC\uFE0F' },
  { id: 'neon', name: 'Neon', icon: '\uD83D\uDC9C' },
  { id: 'isometric', name: 'Isometric', icon: '\uD83D\uDCD0' },
];

const StyleSelector: React.FC = () => {
  const selectedStyle = useAppStore((s) => s.selectedStyle);
  const setSelectedStyle = useAppStore((s) => s.setSelectedStyle);

  const handleSelect = useCallback((id: DrawingStyleId) => {
    setSelectedStyle(id);
  }, [setSelectedStyle]);

  return (
    <div className="shrink-0 border-b border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
      <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-0.5">
        {STYLES.map((style) => (
          <button
            key={style.id}
            onClick={() => handleSelect(style.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              selectedStyle === style.id
                ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400 dark:bg-indigo-900/50 dark:text-indigo-300 dark:ring-indigo-500'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
            aria-label={`Style: ${style.name}`}
          >
            <span className="text-sm">{style.icon}</span>
            <span className="whitespace-nowrap">{style.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default React.memo(StyleSelector);
