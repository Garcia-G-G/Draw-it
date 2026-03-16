import React, { useRef } from 'react';
import { Toolbar, DrawingCanvas } from '../Canvas';
import { AIPreview } from '../Preview';
import { useLivePreview } from '../../hooks';

const SplitView: React.FC = () => {
  const livePreviewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Live preview watches canvasDataUrl from the store — no ref forwarding needed
  useLivePreview(livePreviewCanvasRef);

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <Toolbar />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 flex-1 p-2 md:w-1/2 md:flex-none md:p-3">
          <DrawingCanvas />
        </div>
        <div className="flex min-h-0 flex-1 p-2 md:w-1/2 md:flex-none md:p-3">
          <AIPreview livePreviewCanvasRef={livePreviewCanvasRef} />
        </div>
      </div>
    </div>
  );
};

export default React.memo(SplitView);
