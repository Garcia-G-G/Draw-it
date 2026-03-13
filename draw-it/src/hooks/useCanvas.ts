import { useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { floodFill } from '../utils/floodFill';
import { canvasToBase64WithWhiteBg } from '../utils/canvas';
import type { Tool } from '../types';

interface Point {
  x: number;
  y: number;
}

const SHAPE_TOOLS: Tool[] = ['rectangle', 'circle', 'line'];

export function useCanvas(
  mainCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>,
) {
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<Point>({ x: 0, y: 0 });
  const lastPointRef = useRef<Point>({ x: 0, y: 0 });
  const prevMidRef = useRef<Point>({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  // Subscribe to individual values to minimize re-renders
  const activeTool = useAppStore((s) => s.activeTool);
  const brushSize = useAppStore((s) => s.brushSize);
  const brushColor = useAppStore((s) => s.brushColor);

  // Stable action references via getState — no re-render overhead
  const setCanvasDataUrl = useCallback((url: string | null) => useAppStore.getState().setCanvasDataUrl(url), []);
  const setIsDrawing = useCallback((v: boolean) => useAppStore.getState().setIsDrawing(v), []);
  const addToHistory = useCallback((d: ImageData) => useAppStore.getState().addToHistory(d), []);

  // Refs to avoid stale closures in event handlers
  const activeToolRef = useRef(activeTool);
  const brushSizeRef = useRef(brushSize);
  const brushColorRef = useRef(brushColor);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);
  useEffect(() => { brushColorRef.current = brushColor; }, [brushColor]);

  const getCtx = useCallback((canvas: HTMLCanvasElement | null) => {
    return canvas?.getContext('2d', { willReadFrequently: true }) ?? null;
  }, []);

  const getCanvasPoint = useCallback((canvas: HTMLCanvasElement, e: { clientX: number; clientY: number }): Point => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const saveSnapshot = useCallback(() => {
    const canvas = mainCanvasRef.current;
    const ctx = getCtx(canvas);
    if (!canvas || !ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    addToHistory(imageData);
    // Export with white background so OpenAI can clearly see the sketch
    setCanvasDataUrl(canvasToBase64WithWhiteBg(canvas));
  }, [mainCanvasRef, getCtx, addToHistory, setCanvasDataUrl]);

  const configureCtx = useCallback((ctx: CanvasRenderingContext2D, tool: Tool) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSizeRef.current;

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brushColorRef.current;
      ctx.fillStyle = brushColorRef.current;
    }
  }, []);

  const clearPreview = useCallback(() => {
    const preview = previewCanvasRef.current;
    const ctx = getCtx(preview);
    if (!preview || !ctx) return;
    ctx.clearRect(0, 0, preview.width, preview.height);
  }, [previewCanvasRef, getCtx]);

  const drawShapeOnCtx = useCallback((
    ctx: CanvasRenderingContext2D,
    tool: Tool,
    start: Point,
    end: Point,
  ) => {
    ctx.beginPath();
    ctx.lineWidth = brushSizeRef.current;
    ctx.strokeStyle = brushColorRef.current;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';

    switch (tool) {
      case 'line':
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        break;
      case 'rectangle': {
        const w = end.x - start.x;
        const h = end.y - start.y;
        ctx.rect(start.x, start.y, w, h);
        break;
      }
      case 'circle': {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
        break;
      }
    }
    ctx.stroke();
  }, []);

  // --- Event handlers ---

  const handlePointerDown = useCallback((point: Point) => {
    const tool = activeToolRef.current;
    const canvas = mainCanvasRef.current;
    const ctx = getCtx(canvas);
    if (!canvas || !ctx) return;

    isDrawingRef.current = true;
    startPointRef.current = point;
    lastPointRef.current = point;
    prevMidRef.current = point;
    setIsDrawing(true);

    if (tool === 'fill') {
      floodFill(ctx, point.x, point.y, brushColorRef.current);
      isDrawingRef.current = false;
      setIsDrawing(false);
      saveSnapshot();
      return;
    }

    if (tool === 'pencil' || tool === 'eraser') {
      // Draw a dot immediately so single clicks produce visible marks
      configureCtx(ctx, tool);
      ctx.beginPath();
      ctx.arc(point.x, point.y, brushSizeRef.current / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [mainCanvasRef, getCtx, setIsDrawing, saveSnapshot, configureCtx]);

  const handlePointerMove = useCallback((point: Point) => {
    if (!isDrawingRef.current) return;

    const tool = activeToolRef.current;

    if (tool === 'pencil' || tool === 'eraser') {
      const canvas = mainCanvasRef.current;
      const ctx = getCtx(canvas);
      if (!ctx) return;

      // Smooth bezier: draw from prevMid to currentMid, using last point as control
      const last = lastPointRef.current;
      const currentMid: Point = {
        x: (last.x + point.x) / 2,
        y: (last.y + point.y) / 2,
      };
      const prevMid = prevMidRef.current;

      configureCtx(ctx, tool);
      ctx.beginPath();
      ctx.moveTo(prevMid.x, prevMid.y);
      ctx.quadraticCurveTo(last.x, last.y, currentMid.x, currentMid.y);
      ctx.stroke();

      prevMidRef.current = currentMid;
      lastPointRef.current = point;
    } else if (SHAPE_TOOLS.includes(tool)) {
      // Shape preview
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const preview = previewCanvasRef.current;
        const ctx = getCtx(preview);
        if (!preview || !ctx) return;

        ctx.clearRect(0, 0, preview.width, preview.height);
        drawShapeOnCtx(ctx, tool, startPointRef.current, point);
      });
    }
  }, [mainCanvasRef, previewCanvasRef, getCtx, configureCtx, drawShapeOnCtx]);

  const handlePointerUp = useCallback((point: Point) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setIsDrawing(false);

    const tool = activeToolRef.current;
    const canvas = mainCanvasRef.current;
    const ctx = getCtx(canvas);
    if (!canvas || !ctx) return;

    if (tool === 'pencil' || tool === 'eraser') {
      ctx.globalCompositeOperation = 'source-over';
    } else if (SHAPE_TOOLS.includes(tool)) {
      clearPreview();
      drawShapeOnCtx(ctx, tool, startPointRef.current, point);
    }

    saveSnapshot();
  }, [mainCanvasRef, getCtx, setIsDrawing, clearPreview, drawShapeOnCtx, saveSnapshot]);

  // --- Mouse events ---

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current ?? mainCanvasRef.current;
    if (!canvas) return;
    handlePointerDown(getCanvasPoint(canvas, e.nativeEvent));
  }, [mainCanvasRef, previewCanvasRef, getCanvasPoint, handlePointerDown]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current ?? mainCanvasRef.current;
    if (!canvas) return;
    handlePointerMove(getCanvasPoint(canvas, e.nativeEvent));
  }, [mainCanvasRef, previewCanvasRef, getCanvasPoint, handlePointerMove]);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current ?? mainCanvasRef.current;
    if (!canvas) return;
    handlePointerUp(getCanvasPoint(canvas, e.nativeEvent));
  }, [mainCanvasRef, previewCanvasRef, getCanvasPoint, handlePointerUp]);

  const onMouseLeave = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = previewCanvasRef.current ?? mainCanvasRef.current;
    if (!canvas) return;
    handlePointerUp(getCanvasPoint(canvas, e.nativeEvent));
  }, [mainCanvasRef, previewCanvasRef, getCanvasPoint, handlePointerUp]);

  // --- Touch events ---

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const canvas = previewCanvasRef.current ?? mainCanvasRef.current;
    if (!canvas) return;
    handlePointerDown(getCanvasPoint(canvas, e.touches[0]));
  }, [mainCanvasRef, previewCanvasRef, getCanvasPoint, handlePointerDown]);

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const canvas = previewCanvasRef.current ?? mainCanvasRef.current;
    if (!canvas) return;
    handlePointerMove(getCanvasPoint(canvas, e.touches[0]));
  }, [mainCanvasRef, previewCanvasRef, getCanvasPoint, handlePointerMove]);

  const onTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = previewCanvasRef.current ?? mainCanvasRef.current;
    if (!canvas) return;
    // Use last known point for touch end
    handlePointerUp(lastPointRef.current);
  }, [mainCanvasRef, previewCanvasRef, handlePointerUp]);

  // --- Undo / Redo ---

  const undo = useCallback(() => {
    const imageData = useAppStore.getState().undo();
    if (!imageData) return;
    const ctx = getCtx(mainCanvasRef.current);
    if (!ctx) return;
    ctx.putImageData(imageData, 0, 0);
    setCanvasDataUrl(mainCanvasRef.current!.toDataURL('image/png'));
  }, [mainCanvasRef, getCtx, setCanvasDataUrl]);

  const redo = useCallback(() => {
    const imageData = useAppStore.getState().redo();
    if (!imageData) return;
    const ctx = getCtx(mainCanvasRef.current);
    if (!ctx) return;
    ctx.putImageData(imageData, 0, 0);
    setCanvasDataUrl(mainCanvasRef.current!.toDataURL('image/png'));
  }, [mainCanvasRef, getCtx, setCanvasDataUrl]);

  const clearCanvas = useCallback(() => {
    const canvas = mainCanvasRef.current;
    const ctx = getCtx(canvas);
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    clearPreview();
    useAppStore.getState().clearCanvas();
  }, [mainCanvasRef, getCtx, clearPreview]);

  // --- Resize handling ---

  const resizeCanvas = useCallback(() => {
    const canvas = mainCanvasRef.current;
    const preview = previewCanvasRef.current;
    if (!canvas || !preview) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const { clientWidth, clientHeight } = parent;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(clientWidth * dpr);
    const h = Math.floor(clientHeight * dpr);

    // Skip if dimensions haven't changed
    if (canvas.width === w && canvas.height === h) return;

    const ctx = getCtx(canvas);
    if (!ctx) return;

    // Save current content
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${clientWidth}px`;
    canvas.style.height = `${clientHeight}px`;

    preview.width = w;
    preview.height = h;
    preview.style.width = `${clientWidth}px`;
    preview.style.height = `${clientHeight}px`;

    // Restore content
    ctx.putImageData(imageData, 0, 0);
  }, [mainCanvasRef, previewCanvasRef, getCtx]);

  // --- Init ---

  const initCanvas = useCallback(() => {
    resizeCanvas();
    // Save initial blank state
    const canvas = mainCanvasRef.current;
    const ctx = getCtx(canvas);
    if (!canvas || !ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    addToHistory(imageData);
    setCanvasDataUrl(canvas.toDataURL('image/png'));
  }, [resizeCanvas, mainCanvasRef, getCtx, addToHistory, setCanvasDataUrl]);

  useEffect(() => {
    initCanvas();

    const handleResize = () => resizeCanvas();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [initCanvas, resizeCanvas]);

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    undo,
    redo,
    clearCanvas,
  };
}
