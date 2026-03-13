import { create } from 'zustand';
import type { Tool, DrawingStyleId, GenerationQuality, GalleryItem, Toast, ThemeMode } from '../types';

const MAX_HISTORY_SIZE = 50;
const MAX_GALLERY_SIZE = 50;
const COST_PER_QUALITY: Record<GenerationQuality, number> = {
  low: 0.02,
  medium: 0.07,
  high: 0.19,
};

function getInitialTheme(): ThemeMode {
  const stored = localStorage.getItem('drawit-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let toastCounter = 0;

interface AppStore {
  // Tool state
  activeTool: Tool;
  brushSize: number;
  brushColor: string;
  setActiveTool: (tool: Tool) => void;
  setBrushSize: (size: number) => void;
  setBrushColor: (color: string) => void;

  // Canvas state
  canvasDataUrl: string | null;
  isDrawing: boolean;
  setCanvasDataUrl: (dataUrl: string | null) => void;
  setIsDrawing: (isDrawing: boolean) => void;

  // AI state
  generatedImage: string | null;
  isGenerating: boolean;
  selectedStyle: DrawingStyleId;
  generationError: string | null;
  detectedSubject: string | null;
  setGeneratedImage: (image: string | null) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setSelectedStyle: (style: DrawingStyleId) => void;
  setGenerationError: (error: string | null) => void;
  setDetectedSubject: (subject: string | null) => void;

  // Auto-generate settings
  autoGenerate: boolean;
  debounceDelay: number;
  setAutoGenerate: (auto: boolean) => void;
  setDebounceDelay: (delay: number) => void;

  // Generation stats
  generationCount: number;
  estimatedCost: number;
  lastGenerationTime: number | null;
  selectedQuality: GenerationQuality;
  recordGeneration: (durationMs: number, imageBase64: string) => void;
  setSelectedQuality: (quality: GenerationQuality) => void;

  // Gallery
  gallery: GalleryItem[];
  activeGalleryId: string | null;
  setActiveGalleryId: (id: string | null) => void;

  // Theme
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  // Toast notifications
  toasts: Toast[];
  addToast: (type: Toast['type'], message: string) => void;
  removeToast: (id: string) => void;

  // Compare mode
  compareMode: boolean;
  setCompareMode: (on: boolean) => void;

  // History state (ImageData for performance)
  snapshots: ImageData[];
  historyIndex: number;
  addToHistory: (snapshot: ImageData) => void;
  undo: () => ImageData | null;
  redo: () => ImageData | null;
  clearCanvas: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Tool state defaults
  activeTool: 'pencil',
  brushSize: 3,
  brushColor: '#000000',
  setActiveTool: (tool) => set({ activeTool: tool }),
  setBrushSize: (size) => set({ brushSize: Math.max(1, Math.min(50, size)) }),
  setBrushColor: (color) => set({ brushColor: color }),

  // Canvas state defaults
  canvasDataUrl: null,
  isDrawing: false,
  setCanvasDataUrl: (dataUrl) => set({ canvasDataUrl: dataUrl }),
  setIsDrawing: (isDrawing) => set({ isDrawing }),

  // AI state defaults
  generatedImage: null,
  isGenerating: false,
  selectedStyle: 'realistic',
  generationError: null,
  detectedSubject: null,
  setGeneratedImage: (image) => set({ generatedImage: image }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setSelectedStyle: (style) => set({ selectedStyle: style }),
  setGenerationError: (error) => set({ generationError: error }),
  setDetectedSubject: (subject) => set({ detectedSubject: subject }),

  // Auto-generate defaults
  autoGenerate: false,
  debounceDelay: 2000,
  setAutoGenerate: (auto) => set({ autoGenerate: auto }),
  setDebounceDelay: (delay) => set({ debounceDelay: delay }),

  // Generation stats defaults
  generationCount: 0,
  estimatedCost: 0,
  lastGenerationTime: null,
  selectedQuality: 'low',
  recordGeneration: (durationMs, imageBase64) => {
    const { generationCount, estimatedCost, selectedQuality, selectedStyle, gallery } = get();
    const item: GalleryItem = {
      id: `gen-${Date.now()}-${generationCount}`,
      imageBase64,
      style: selectedStyle,
      timestamp: Date.now(),
      durationMs,
    };
    const newGallery = [...gallery, item];
    if (newGallery.length > MAX_GALLERY_SIZE) newGallery.shift();
    set({
      generationCount: generationCount + 1,
      estimatedCost: estimatedCost + COST_PER_QUALITY[selectedQuality],
      lastGenerationTime: durationMs,
      gallery: newGallery,
      activeGalleryId: item.id,
    });
  },
  setSelectedQuality: (quality) => set({ selectedQuality: quality }),

  // Gallery defaults
  gallery: [],
  activeGalleryId: null,
  setActiveGalleryId: (id) => {
    const { gallery } = get();
    const item = gallery.find((g) => g.id === id);
    if (item) {
      set({
        activeGalleryId: id,
        generatedImage: item.imageBase64,
      });
    }
  },

  // Theme
  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem('drawit-theme', theme);
    set({ theme });
  },

  // Toast notifications
  toasts: [],
  addToast: (type, message) => {
    const id = `toast-${++toastCounter}`;
    set({ toasts: [...get().toasts, { id, type, message }] });
    setTimeout(() => {
      const { toasts } = get();
      set({ toasts: toasts.filter((t) => t.id !== id) });
    }, 3000);
  },
  removeToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  // Compare mode
  compareMode: false,
  setCompareMode: (on) => set({ compareMode: on }),

  // History state defaults
  snapshots: [],
  historyIndex: -1,

  addToHistory: (snapshot) => {
    const { snapshots, historyIndex } = get();
    const newSnapshots = snapshots.slice(0, historyIndex + 1);
    newSnapshots.push(snapshot);
    if (newSnapshots.length > MAX_HISTORY_SIZE) newSnapshots.shift();
    set({ snapshots: newSnapshots, historyIndex: newSnapshots.length - 1 });
  },

  undo: () => {
    const { historyIndex, snapshots } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({ historyIndex: newIndex });
      return snapshots[newIndex];
    }
    return null;
  },

  redo: () => {
    const { historyIndex, snapshots } = get();
    if (historyIndex < snapshots.length - 1) {
      const newIndex = historyIndex + 1;
      set({ historyIndex: newIndex });
      return snapshots[newIndex];
    }
    return null;
  },

  clearCanvas: () => {
    set({
      snapshots: [],
      historyIndex: -1,
      canvasDataUrl: null,
      generatedImage: null,
      generationError: null,
      detectedSubject: null,
    });
  },
}));
