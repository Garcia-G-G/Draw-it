import React, { useRef, useEffect } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useAppStore } from '../../store';

const DrawingCanvas: React.FC = () => {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeTool = useAppStore((s) => s.activeTool);

  const {
    onMouseDown, onMouseMove, onMouseUp, onMouseLeave,
    onTouchStart, onTouchMove, onTouchEnd,
    undo, redo, clearCanvas,
  } = useCanvas(mainCanvasRef, previewCanvasRef);

  useKeyboardShortcuts({ onUndo: undo, onRedo: redo });

  useEffect(() => {
    const handleUndo = () => undo();
    const handleRedo = () => redo();
    const handleClear = () => clearCanvas();
    window.addEventListener('canvas:undo', handleUndo);
    window.addEventListener('canvas:redo', handleRedo);
    window.addEventListener('canvas:clear', handleClear);
    return () => {
      window.removeEventListener('canvas:undo', handleUndo);
      window.removeEventListener('canvas:redo', handleRedo);
      window.removeEventListener('canvas:clear', handleClear);
    };
  }, [undo, redo, clearCanvas]);

  const cursorClass = activeTool === 'fill' ? 'cursor-crosshair' : 'cursor-default';

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-white shadow-sm dark:shadow-none dark:ring-1 dark:ring-gray-700">
      <canvas ref={mainCanvasRef} className="absolute inset-0" />
      <canvas
        ref={previewCanvasRef}
        className={`absolute inset-0 ${cursorClass}`}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      />
    </div>
  );
};

export default React.memo(DrawingCanvas);
