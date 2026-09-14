import React, { useState, useEffect } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Download, 
  Maximize2 
} from 'lucide-react';

export const ImageModal = ({ isOpen, onClose, imageSrc, imageName }) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (isOpen) {
      setScale(1);
    }
  }, [isOpen, imageSrc]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageSrc) return null;

  const handleZoomIn = (e) => {
    e.stopPropagation();
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = (e) => {
    e.stopPropagation();
    setScale(1);
  };

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/85 backdrop-blur-md animate-in fade-in select-none"
      onClick={onClose}
    >
      {/* Top Controls Bar */}
      <div 
        className="w-full px-6 py-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/60 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center space-x-3 text-white truncate max-w-md">
          <Maximize2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <span className="text-sm font-medium truncate">
            {imageName || 'Image Preview'}
          </span>
        </div>

        {/* Toolbar buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-xs font-semibold text-white/80 min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={handleZoomIn}
            disabled={scale >= 3}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            onClick={handleResetZoom}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <a
            href={imageSrc}
            download={imageName || 'image'}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            title="Download Image"
          >
            <Download className="w-4 h-4" />
          </a>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-rose-600 text-white transition-colors ml-2"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Viewer */}
      <div 
        className="flex-1 w-full overflow-auto flex items-center justify-center p-4 cursor-zoom-out"
        onClick={onClose}
      >
        <img
          src={imageSrc}
          alt={imageName || 'Preview'}
          onClick={(e) => e.stopPropagation()}
          style={{ transform: `scale(${scale})` }}
          className="max-h-[80vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl transition-transform duration-150 cursor-default"
        />
      </div>

      {/* Bottom hint */}
      <div className="pb-4 text-xs text-white/60">
        Click outside or press <kbd className="px-1.5 py-0.5 rounded bg-white/20 text-white font-mono text-[10px]">Esc</kbd> to close
      </div>
    </div>
  );
};

export default ImageModal;
