import React from 'react';
import { motion } from 'framer-motion';

export const TypingIndicator = ({ typingUsers = [] }) => {
  if (!typingUsers || typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].name || typingUsers[0].username} is typing...`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`;
    }
    return `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing...`;
  };

  return (
    <div className="flex items-center space-x-2 py-1 px-3">
      <div className="flex items-center space-x-1.5 px-3 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-indigo-500"
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-indigo-500"
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: 0.2, ease: 'easeInOut' }}
        />
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-indigo-500"
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: 0.4, ease: 'easeInOut' }}
        />
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 ml-1.5">
          {getTypingText()}
        </span>
      </div>
    </div>
  );
};

export default TypingIndicator;
