import { useEffect } from 'react';
import { useAppStore } from '../store';
import type { Tool } from '../types';

const BRUSH_SIZE_STEP = 2;

const KEY_TOOL_MAP: Record<string, Tool> = {
  b: 'pencil',
  e: 'eraser',
  l: 'line',
  r: 'rectangle',
  c: 'circle',
  g: 'fill',
};

interface UseKeyboardShortcutsOptions {
  onUndo: () => void;
  onRedo: () => void;
}

export function useKeyboardShortcuts({ onUndo, onRedo }: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const { setActiveTool, setBrushSize, brushSize } = useAppStore.getState();

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo();
        return;
      }

      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y / Cmd+Y
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
        e.preventDefault();
        onRedo();
        return;
      }

      // Don't process tool shortcuts when modifier keys are held
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Tool selection
      const tool = KEY_TOOL_MAP[e.key.toLowerCase()];
      if (tool) {
        e.preventDefault();
        setActiveTool(tool);
        return;
      }

      // Brush size
      if (e.key === '[') {
        e.preventDefault();
        setBrushSize(brushSize - BRUSH_SIZE_STEP);
      } else if (e.key === ']') {
        e.preventDefault();
        setBrushSize(brushSize + BRUSH_SIZE_STEP);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndo, onRedo]);
}
