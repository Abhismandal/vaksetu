import React from 'react';
import { WifiOff, RefreshCw, Clock } from 'lucide-react';
import { useChat } from '../context/ChatContext';

export const OfflineBanner = () => {
  const { isOnline, outboxQueue, syncOutboxQueue } = useChat();

  if (isOnline && (!outboxQueue || outboxQueue.length === 0)) {
    return null;
  }

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2 text-xs flex items-center justify-between transition-all duration-300 backdrop-blur-xs z-30">
      <div className="flex items-center space-x-2">
        <WifiOff className="w-4 h-4 text-amber-500 animate-pulse flex-shrink-0" />
        <span className="font-medium">
          {!isOnline ? 'You are working offline.' : 'Reconnected! Syncing pending messages...'}
        </span>
        <span className="text-amber-700 dark:text-amber-400 hidden sm:inline">
          {!isOnline
            ? 'Messages are saved locally and will send automatically when your connection is restored.'
            : ''}
        </span>
      </div>

      <div className="flex items-center space-x-3">
        {outboxQueue && outboxQueue.length > 0 && (
          <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold text-[11px]">
            <Clock className="w-3 h-3" />
            <span>{outboxQueue.length} queued</span>
          </div>
        )}

        <button
          onClick={() => syncOutboxQueue()}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-amber-500 text-white font-medium hover:bg-amber-600 active:scale-95 transition-all text-[11px] shadow-xs"
          title="Attempt to reconnect and sync messages"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Sync</span>
        </button>
      </div>
    </div>
  );
};

export default OfflineBanner;
