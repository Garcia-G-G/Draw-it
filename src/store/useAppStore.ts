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

  // AI state (HD)
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
  promptOverride: string;
  setPromptOverride: (text: string) => void;

  // Realtime preview state
  realtimePreview: string | null;
  realtimeLatency: number;
  isRealtimeEnabled: boolean;
  isRealtimeGenerating: boolean;
  previewMode: 'realtime' | 'hd';
  setRealtimePreview: (img: string | null) => void;
  setRealtimeLatency: (ms: number) => void;
  setIsRealtimeEnabled: (on: boolean) => void;
  setIsRealtimeGenerating: (on: boolean) => void;
  setPreviewMode: (mode: 'realtime' | 'hd') => void;

  // Live preview (WebGL shaders — client-side, no API)
  isLivePreviewEnabled: boolean;
  setIsLivePreviewEnabled: (on: boolean) => void;

  // Server capabilities
  hasOpenAI: boolean;
  hasFal: boolean;
  hasTogether: boolean;
  setCapabilities: (caps: { openai: boolean; fal: boolean; together: boolean }) => void;

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

  // History state
  snapshots: ImageData[];
  historyIndex: number;
  addToHistory: (snapshot: ImageData) => void;
  undo: () => ImageData | null;
  redo: () => ImageData | null;
  clearCanvas: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  activeTool: 'pencil',
  brushSize: 3,
  brushColor: '#000000',
  setActiveTool: (tool) => set({ activeTool: tool }),
  setBrushSize: (size) => set({ brushSize: Math.max(1, Math.min(50, size)) }),
  setBrushColor: (color) => set({ brushColor: color }),

  canvasDataUrl: null,
  isDrawing: false,
  setCanvasDataUrl: (dataUrl) => set({ canvasDataUrl: dataUrl }),
  setIsDrawing: (isDrawing) => set({ isDrawing }),

  generatedImage: null,
  isGenerating: false,
  selectedStyle: 'realistic',
  generationError: null,
  detectedSubject: null,
  setGeneratedImage: (image) => set({ generatedImage: image, previewMode: 'hd' }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setSelectedStyle: (style) => set({ selectedStyle: style }),
  setGenerationError: (error) => set({ generationError: error }),
  setDetectedSubject: (subject) => set({ detectedSubject: subject }),
  promptOverride: '',
  setPromptOverride: (text) => set({ promptOverride: text }),

  // Realtime state
  realtimePreview: null,
  realtimeLatency: 0,
  isRealtimeEnabled: false,
  isRealtimeGenerating: false,
  previewMode: 'realtime',
  setRealtimePreview: (img) => set({ realtimePreview: img, previewMode: img ? 'realtime' : get().previewMode }),
  setRealtimeLatency: (ms) => set({ realtimeLatency: ms }),
  setIsRealtimeEnabled: (on) => set({ isRealtimeEnabled: on }),
  setIsRealtimeGenerating: (on) => set({ isRealtimeGenerating: on }),
  setPreviewMode: (mode) => set({ previewMode: mode }),

  // Live preview (WebGL — always available, no API needed)
  isLivePreviewEnabled: true,
  setIsLivePreviewEnabled: (on) => set({ isLivePreviewEnabled: on }),

  // Capabilities (detected from /api/health)
  hasOpenAI: true,
  hasFal: false,
  hasTogether: false,
  setCapabilities: (caps: { openai: boolean; fal: boolean; together: boolean }) =>
    set({ hasOpenAI: caps.openai, hasFal: caps.fal, hasTogether: caps.together, isRealtimeEnabled: caps.together || caps.fal }),

  autoGenerate: false,
  debounceDelay: 2000,
  setAutoGenerate: (auto) => set({ autoGenerate: auto }),
  setDebounceDelay: (delay) => set({ debounceDelay: delay }),

  generationCount: 0,
  estimatedCost: 0,
  lastGenerationTime: null,
  selectedQuality: 'medium',
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

  gallery: [],
  activeGalleryId: null,
  setActiveGalleryId: (id) => {
    const { gallery } = get();
    const item = gallery.find((g) => g.id === id);
    if (item) set({ activeGalleryId: id, generatedImage: item.imageBase64, previewMode: 'hd' });
  },

  theme: getInitialTheme(),
  setTheme: (theme) => { localStorage.setItem('drawit-theme', theme); set({ theme }); },

  toasts: [],
  addToast: (type, message) => {
    const id = `toast-${++toastCounter}`;
    set({ toasts: [...get().toasts, { id, type, message }] });
    setTimeout(() => { const { toasts } = get(); set({ toasts: toasts.filter((t) => t.id !== id) }); }, 3000);
  },
  removeToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  compareMode: false,
  setCompareMode: (on) => set({ compareMode: on }),

  snapshots: [],
  historyIndex: -1,
  addToHistory: (snapshot) => {
    const { snapshots, historyIndex } = get();
    const ns = snapshots.slice(0, historyIndex + 1);
    ns.push(snapshot);
    if (ns.length > MAX_HISTORY_SIZE) ns.shift();
    set({ snapshots: ns, historyIndex: ns.length - 1 });
  },
  undo: () => {
    const { historyIndex, snapshots } = get();
    if (historyIndex > 0) { set({ historyIndex: historyIndex - 1 }); return snapshots[historyIndex - 1]; }
    return null;
  },
  redo: () => {
    const { historyIndex, snapshots } = get();
    if (historyIndex < snapshots.length - 1) { set({ historyIndex: historyIndex + 1 }); return snapshots[historyIndex + 1]; }
    return null;
  },
  clearCanvas: () => set({
    snapshots: [], historyIndex: -1, canvasDataUrl: null,
    generatedImage: null, generationError: null, detectedSubject: null,
    realtimePreview: null,
  }),
}));
