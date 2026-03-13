export type Tool = 'pencil' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'fill';

export type GenerationQuality = 'low' | 'medium' | 'high';

export type DrawingStyleId =
  | 'realistic'
  | 'illustration'
  | 'sketch'
  | '3d'
  | 'watercolor'
  | 'pixel-art'
  | 'minimal'
  | 'cartoon'
  | 'anime'
  | 'oil-paint'
  | 'neon'
  | 'isometric';

export interface DrawingStyle {
  id: DrawingStyleId;
  name: string;
  icon: string;
}

export interface GalleryItem {
  id: string;
  imageBase64: string;
  style: DrawingStyleId;
  timestamp: number;
  durationMs: number;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export type ThemeMode = 'light' | 'dark';

export interface CanvasConfig {
  width: number;
  height: number;
  backgroundColor: string;
}

export interface GenerationRequest {
  imageBase64: string;
  prompt: string;
  quality: string;
  size: string;
}

export interface GenerationResponse {
  imageBase64: string;
  revisedPrompt: string | null;
}

export interface ToolState {
  activeTool: Tool;
  brushSize: number;
  brushColor: string;
}

export interface CanvasState {
  dataUrl: string | null;
  isDrawing: boolean;
}

export interface AIState {
  generatedImage: string | null;
  isGenerating: boolean;
  selectedStyle: DrawingStyleId;
}

export interface HistoryState {
  snapshots: string[];
  historyIndex: number;
}
