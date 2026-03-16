import React, { useRef, useEffect, useState } from 'react';
import { Toolbar } from '../Canvas';
import DrawingCanvas from '../Canvas/DrawingCanvas';
import type { DrawingCanvasHandle } from '../Canvas/DrawingCanvas';
import { AIPreview } from '../Preview';
import { useLivePreview } from '../../hooks';

const SplitView: React.FC = () => {
  const canvasHandleRef = useRef<DrawingCanvasHandle>(null);
  const livePreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [mainCanvas, setMainCanvas] = useState<HTMLCanvasElement | null>(null);

  // Get the main canvas reference after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (canvasHandleRef.current) {
        setMainCanvas(canvasHandleRef.current.getMainCanvas());
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Create a stable ref object for useLivePreview
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  sourceRef.current = mainCanvas;

  useLivePreview(sourceRef, livePreviewCanvasRef);

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <Toolbar />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 flex-1 p-2 md:w-1/2 md:flex-none md:p-3">
          <DrawingCanvas ref={canvasHandleRef} />
        </div>
        <div className="flex min-h-0 flex-1 p-2 md:w-1/2 md:flex-none md:p-3">
          <AIPreview livePreviewCanvasRef={livePreviewCanvasRef} />
        </div>
      </div>
    </div>
  );
};

export default React.memo(SplitView);
