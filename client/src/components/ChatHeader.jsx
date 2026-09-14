import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Phone, 
  Video, 
  PanelRight, 
  Sparkles, 
  MoreVertical,
  Users,
  Lock
} from 'lucide-react';
import UserAvatar from './UserAvatar';
import SummaryModal from './SummaryModal';
import { useChat } from '../context/ChatContext';

export const ChatHeader = ({ onBackMobile }) => {
  const { 
    activeConversation, 
    isRightSidebarOpen, 
    setIsRightSidebarOpen,
    isInChatSearchOpen,
    setIsInChatSearchOpen,
    inConversationSearch,
    setInConversationSearch,
    typingUsers,
    onlineUserIds,
    activeMessages,
    isE2EEEnabled,
    setIsEncryptionModalOpen
  } = useChat();

  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  if (!activeConversation) return null;

  // Determine if active contact is online
  const otherParticipant = activeConversation.participants?.find((p) => p._id !== activeConversation._id);
  const isOnline = activeConversation.isAi 
    ? true 
    : (otherParticipant ? onlineUserIds.has(otherParticipant._id) : activeConversation.isOnline);

  const isTyping = typingUsers && typingUsers.length > 0;

  return (
    <header className="h-16 px-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between transition-colors z-10">
      <div className="flex items-center space-x-3 min-w-0">
        {/* Mobile Back button */}
        {onBackMobile && (
          <button
            onClick={onBackMobile}
            className="sm:hidden p-1.5 -ml-1 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="relative">
          <UserAvatar
            src={activeConversation.avatar}
            name={activeConversation.name}
            size="md"
            isOnline={isOnline}
          />
          {activeConversation.isAi && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center text-[9px] shadow-sm">
              <Sparkles className="w-2.5 h-2.5" />
            </span>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {activeConversation.name}
            </h2>
            {activeConversation.isAi && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800">
                GPT-4o Mini
              </span>
            )}
            {activeConversation.isGroup && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                {activeConversation.membersCount || 8} members
              </span>
            )}
            {!activeConversation.isAi && isE2EEEnabled && (
              <button
                onClick={() => setIsEncryptionModalOpen(true)}
                className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold flex items-center space-x-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shadow-2xs cursor-pointer"
                title="End-to-End Encrypted. Click to view safety number."
              >
                <Lock className="w-2.5 h-2.5" />
                <span>Encrypted</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
            {isTyping ? (
              <span className="text-indigo-600 dark:text-indigo-400 font-medium animate-pulse">
                {typingUsers.length === 1
                  ? `${typingUsers[0].name || typingUsers[0].username} is typing...`
                  : `${typingUsers.length} people typing...`}
              </span>
            ) : activeConversation.isAi ? (
              <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3" /> VakSetu AI Active
              </span>
            ) : isOnline ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Active now
              </span>
            ) : (
              <span>Last seen {activeConversation.lastSeen ? new Date(activeConversation.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}</span>
            )}
          </p>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center space-x-1">
        <button
          onClick={() => {
            if (isInChatSearchOpen) {
              setIsInChatSearchOpen(false);
              setInConversationSearch('');
            } else {
              setIsInChatSearchOpen(true);
            }
          }}
          className={`p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
            isInChatSearchOpen ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' : ''
          }`}
          title="Search in conversation"
        >
          <Search className="w-4 h-4" />
        </button>

        {!activeConversation.isAi && (
          <>
            <button
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:inline-flex"
              title="Voice call"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:inline-flex"
              title="Video call"
            >
              <Video className="w-4 h-4" />
            </button>
          </>
        )}

        <button
          onClick={() => setIsSummaryModalOpen(true)}
          className="p-2 rounded-xl text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors flex items-center space-x-1 text-xs font-semibold"
          title="Summarize conversation with AI"
        >
          <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
          <span className="hidden md:inline">Summarize</span>
        </button>

        <button
          onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
          className={`p-2 rounded-xl transition-colors ${
            isRightSidebarOpen
              ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Toggle conversation details"
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </div>

      {/* Step 15: AI Conversation Summary Modal */}
      <SummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        conversationId={activeConversation?._id}
        conversationName={activeConversation?.name}
        messages={activeMessages}
      />
    </header>
  );
};

export default ChatHeader;
