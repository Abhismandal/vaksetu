import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useChat } from '../context/ChatContext';

export const InChatSearchBar = () => {
  const {
    isInChatSearchOpen,
    setIsInChatSearchOpen,
    inConversationSearch,
    setInConversationSearch,
    activeMessages,
    jumpToMessage,
  } = useChat();

  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef(null);

  // Find all messages that match the query
  const matchingMessageIds = React.useMemo(() => {
    if (!inConversationSearch || !inConversationSearch.trim()) return [];
    const query = inConversationSearch.toLowerCase().trim();
    return activeMessages
      .filter((m) => !m.isDeleted && (m.text || '').toLowerCase().includes(query))
      .map((m) => m._id);
  }, [inConversationSearch, activeMessages]);

  // Focus input when opened
  useEffect(() => {
    if (isInChatSearchOpen) {
      inputRef.current?.focus();
    }
  }, [isInChatSearchOpen]);

  // Reset or adjust current index when matches change
  useEffect(() => {
    if (matchingMessageIds.length > 0) {
      setCurrentIndex(0);
      jumpToMessage(matchingMessageIds[0]);
    } else {
      setCurrentIndex(0);
    }
  }, [matchingMessageIds.length, inConversationSearch]);

  if (!isInChatSearchOpen) return null;

  const totalMatches = matchingMessageIds.length;

  const handleNext = () => {
    if (totalMatches === 0) return;
    const nextIdx = (currentIndex + 1) % totalMatches;
    setCurrentIndex(nextIdx);
    jumpToMessage(matchingMessageIds[nextIdx]);
  };

  const handlePrev = () => {
    if (totalMatches === 0) return;
    const prevIdx = (currentIndex - 1 + totalMatches) % totalMatches;
    setCurrentIndex(prevIdx);
    jumpToMessage(matchingMessageIds[prevIdx]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  const handleClose = () => {
    setInConversationSearch('');
    setIsInChatSearchOpen(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between shadow-xs transition-all animate-in slide-in-from-top-2 z-10">
      <div className="flex items-center space-x-2 flex-1 max-w-md">
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={inConversationSearch}
          onChange={(e) => setInConversationSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search in conversation (press Enter for next)..."
          className="w-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-1.5 rounded-lg border border-transparent focus:border-indigo-500 focus:outline-none placeholder-slate-400"
        />
      </div>

      <div className="flex items-center space-x-2 ml-3">
        {inConversationSearch && (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {totalMatches === 0
              ? 'No matches'
              : `${currentIndex + 1} of ${totalMatches}`}
          </span>
        )}

        <div className="flex items-center space-x-0.5 border-l border-slate-200 dark:border-slate-800 pl-2">
          <button
            onClick={handlePrev}
            disabled={totalMatches === 0}
            className="p-1 rounded-md text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous match (Shift + Enter)"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            disabled={totalMatches === 0}
            className="p-1 rounded-md text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next match (Enter)"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={handleClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1"
            title="Close search (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InChatSearchBar;
