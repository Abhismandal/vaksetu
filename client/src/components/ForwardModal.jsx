import React, { useState } from 'react';
import { 
  X, 
  Forward, 
  Search, 
  Check, 
  MessageSquare, 
  Loader2 
} from 'lucide-react';
import UserAvatar from './UserAvatar';
import { useChat } from '../context/ChatContext';

export const ForwardModal = ({ messageToForward, messagesToForward = [], isOpen, onClose }) => {
  const { conversations, sendMessage, setActiveConversation } = useChat();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [isForwarding, setIsForwarding] = useState(false);
  const [forwardSuccess, setForwardSuccess] = useState(false);

  const forwardList = messagesToForward.length > 0 
    ? messagesToForward 
    : (messageToForward ? [messageToForward] : []);

  // Handle Escape key
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || forwardList.length === 0) return null;

  const filteredConversations = conversations.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleForward = async () => {
    if (!selectedTargetId) return;

    setIsForwarding(true);
    const target = conversations.find((c) => c._id === selectedTargetId);
    if (target) {
      setActiveConversation(target);
      for (const msg of forwardList) {
        if (!msg.isDeleted) {
          await sendMessage(
            msg.text,
            msg.attachments || []
          );
        }
      }
      setIsForwarding(false);
      setForwardSuccess(true);
      setTimeout(() => {
        setForwardSuccess(false);
        onClose();
      }, 800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="forward-modal-title"
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Forward className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 id="forward-modal-title" className="font-bold text-sm text-slate-900 dark:text-white">
              Forward Message
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message preview snippet */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs">
          <span className="font-medium text-slate-500 block mb-0.5">
            {forwardList.length > 1 ? `${forwardList.length} Messages Selected:` : 'Content:'}
          </span>
          <p className="text-slate-800 dark:text-slate-200 italic line-clamp-2">
            {forwardList.length > 1
              ? `Forwarding ${forwardList.length} messages to selected chat`
              : `"${forwardList[0]?.text || 'Attachment'}"`}
          </p>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Conversation Picker */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.map((c) => {
            const isSelected = selectedTargetId === c._id;
            return (
              <div
                key={c._id}
                onClick={() => setSelectedTargetId(c._id)}
                className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <UserAvatar
                    src={c.avatar}
                    name={c.name}
                    size="sm"
                    isOnline={c.isOnline}
                  />
                  <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {c.name}
                  </span>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            disabled={!selectedTargetId || isForwarding}
            onClick={handleForward}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-all"
          >
            {isForwarding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : forwardSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" /> Forwarded!
              </>
            ) : (
              'Forward'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
