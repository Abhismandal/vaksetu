import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  UserPlus, 
  MessageSquare, 
  Loader2, 
  Sparkles,
  AlertCircle 
} from 'lucide-react';
import UserAvatar from './UserAvatar';
import { useChat } from '../context/ChatContext';
import chatService from '../services/chatService';

export const NewChatModal = () => {
  const { isNewChatModalOpen, setIsNewChatModalOpen, startConversation } = useChat();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startingChatWith, setStartingChatWith] = useState(null);

  useEffect(() => {
    if (!isNewChatModalOpen) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await chatService.searchUsers(searchTerm);
        if (data.success) {
          setUsers(data.users || []);
        }
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, isNewChatModalOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isNewChatModalOpen) {
        setIsNewChatModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNewChatModalOpen, setIsNewChatModalOpen]);

  if (!isNewChatModalOpen) return null;

  const handleSelectUser = async (userId) => {
    setStartingChatWith(userId);
    await startConversation(userId);
    setStartingChatWith(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="new-chat-title"
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 id="new-chat-title" className="font-bold text-sm text-slate-900 dark:text-white">
                Start New Chat
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Find people to connect and message in real-time
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsNewChatModalOpen(false)}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or username..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* User Search Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="text-xs">Searching users...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center px-4">
              <MessageSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                No users found
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {searchTerm ? 'No registered user matches that query' : 'Type a name or username to search'}
              </p>
            </div>
          ) : (
            users.map((u) => (
              <div
                key={u._id}
                onClick={() => handleSelectUser(u._id)}
                className="p-3 rounded-2xl flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <UserAvatar
                    src={u.avatar}
                    name={u.name}
                    size="md"
                    isOnline={u.isOnline}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {u.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      @{u.username}
                    </p>
                  </div>
                </div>

                <button
                  disabled={startingChatWith === u._id}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 flex items-center gap-1 shadow-sm transition-all"
                >
                  {startingChatWith === u._id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Chat'
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NewChatModal;
