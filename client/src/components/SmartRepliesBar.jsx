import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, RotateCcw, X, ArrowUpRight } from 'lucide-react';
import chatService from '../services/chatService';

export const SmartRepliesBar = ({ conversationId, messages = [], onSelectReply }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastAnalyzedMsgIdRef = useRef(null);

  const fetchSuggestions = async () => {
    if (!conversationId && (!messages || messages.length === 0)) return;

    try {
      setIsLoading(true);
      const res = await chatService.getSmartReplies(conversationId, messages);
      if (res.success && Array.isArray(res.suggestions) && res.suggestions.length > 0) {
        setSuggestions(res.suggestions);
        setIsVisible(true);
      }
    } catch (err) {
      console.warn('[Smart Replies Fetch Warning]:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Automatically refresh suggestions when the latest message changes
  useEffect(() => {
    if (!messages || messages.length === 0) {
      setSuggestions([]);
      return;
    }

    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg._id !== lastAnalyzedMsgIdRef.current) {
      lastAnalyzedMsgIdRef.current = lastMsg._id;
      fetchSuggestions();
    }
  }, [conversationId, messages.length]);

  if (!isVisible || (suggestions.length === 0 && !isLoading)) {
    return null;
  }

  return (
    <div className="px-3 py-1.5 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center space-x-1.5 flex-shrink-0 text-slate-400">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
        <span className="text-[11px] font-medium hidden sm:inline text-slate-500 dark:text-slate-400">
          Smart replies:
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-1 overflow-x-auto scrollbar-none py-0.5">
        {isLoading ? (
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : (
          suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSelectReply(suggestion)}
              className="group inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200/90 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all hover:scale-102 shadow-xs whitespace-nowrap"
            >
              <span>{suggestion}</span>
              <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            </button>
          ))
        )}
      </div>

      <div className="flex items-center space-x-1 flex-shrink-0">
        <button
          onClick={fetchSuggestions}
          disabled={isLoading}
          className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Refresh reply suggestions"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={() => setIsVisible(false)}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Hide smart replies"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default SmartRepliesBar;
