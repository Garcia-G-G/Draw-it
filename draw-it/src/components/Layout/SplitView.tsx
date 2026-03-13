import React from 'react';
import { Toolbar, DrawingCanvas } from '../Canvas';
import { AIPreview } from '../Preview';

const SplitView: React.FC = () => {
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <Toolbar />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 flex-1 p-2 md:w-1/2 md:flex-none md:p-3">
          <DrawingCanvas />
        </div>
        <div className="flex min-h-0 flex-1 p-2 md:w-1/2 md:flex-none md:p-3">
          <AIPreview />
        </div>
      </div>
    </div>
  );
};

export default React.memo(SplitView);
