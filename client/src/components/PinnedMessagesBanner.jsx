import React, { useState } from 'react';
import { Pin, ChevronLeft, ChevronRight, X, ExternalLink } from 'lucide-react';
import { useChat } from '../context/ChatContext';

export const PinnedMessagesBanner = () => {
  const { pinnedMessages, jumpToMessage, togglePinMessage } = useChat();
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!pinnedMessages || pinnedMessages.length === 0) {
    return null;
  }

  // Bound index safely
  const safeIndex = Math.min(currentIndex, pinnedMessages.length - 1);
  const currentPinned = pinnedMessages[safeIndex] || pinnedMessages[0];

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % pinnedMessages.length);
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + pinnedMessages.length) % pinnedMessages.length);
  };

  const handleUnpin = (e) => {
    e.stopPropagation();
    if (currentPinned) {
      togglePinMessage(currentPinned._id);
    }
  };

  const getPreviewText = (msg) => {
    if (msg.text) return msg.text;
    if (msg.attachments && msg.attachments.length > 0) {
      const att = msg.attachments[0];
      if (att.type?.startsWith('image/')) return '?? Photo';
      if (att.type?.startsWith('video/')) return '?? Video';
      if (att.type?.startsWith('audio/') || msg.messageType === 'voice') return '??? Voice Message';
      return `?? ${att.name || 'Attachment'}`;
    }
    return 'Pinned message';
  };

  return (
    <div className="bg-indigo-50/90 dark:bg-indigo-950/50 border-b border-indigo-100 dark:border-indigo-900/60 px-4 py-2 flex items-center justify-between transition-colors z-10 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Clickable Pinned Message Summary */}
      <div
        onClick={() => jumpToMessage(currentPinned._id)}
        className="flex items-center space-x-2.5 min-w-0 flex-1 cursor-pointer group"
        title="Click to jump to message"
      >
        <div className="w-6 h-6 rounded-lg bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
          <Pin className="w-3.5 h-3.5 rotate-45 fill-current" />
        </div>

        <div className="min-w-0 flex-1 text-xs">
          <div className="flex items-center space-x-1.5 font-semibold text-indigo-900 dark:text-indigo-200">
            <span>Pinned Message</span>
            {currentPinned.sender && (
              <>
                <span className="text-slate-400 font-normal">•</span>
                <span className="text-slate-600 dark:text-slate-400 truncate">
                  {currentPinned.sender.name || currentPinned.sender.username}
                </span>
              </>
            )}
          </div>
          <p className="text-slate-600 dark:text-slate-300 truncate text-[11px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {getPreviewText(currentPinned)}
          </p>
        </div>
      </div>

      {/* Navigation and Unpin actions */}
      <div className="flex items-center space-x-1.5 flex-shrink-0 ml-3">
        {pinnedMessages.length > 1 && (
          <div className="flex items-center space-x-1 text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
            <span>{safeIndex + 1}</span>
            <span>/</span>
            <span>{pinnedMessages.length}</span>
            <div className="flex items-center ml-1">
              <button
                onClick={handlePrev}
                className="p-0.5 hover:text-indigo-600 dark:hover:text-indigo-400"
                title="Previous pinned message"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                onClick={handleNext}
                className="p-0.5 hover:text-indigo-600 dark:hover:text-indigo-400"
                title="Next pinned message"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        <button
          onClick={handleUnpin}
          className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors"
          title="Unpin message"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default PinnedMessagesBanner;
