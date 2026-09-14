import React, { useState, useEffect } from 'react';
import ChatSidebar from '../components/ChatSidebar';
import ChatHeader from '../components/ChatHeader';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import RightSidebar from '../components/RightSidebar';
import ProfileModal from '../components/ProfileModal';
import NewChatModal from '../components/NewChatModal';
import CreateGroupModal from '../components/CreateGroupModal';
import InChatSearchBar from '../components/InChatSearchBar';
import PinnedMessagesBanner from '../components/PinnedMessagesBanner';
import EncryptionInfoModal from '../components/EncryptionInfoModal';
import OfflineBanner from '../components/OfflineBanner';
import { useChat } from '../context/ChatContext';
import { MessageSquare, Sparkles } from 'lucide-react';

export const ChatPage = () => {
  const { 
    activeConversation, 
    setActiveConversation, 
    isCreateGroupModalOpen, 
    setIsCreateGroupModalOpen,
    isEncryptionModalOpen,
    setIsEncryptionModalOpen
  } = useChat();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // On mobile, if a conversation is selected, we show the chat view; otherwise, sidebar.
  const showSidebarOnMobile = !activeConversation;

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Left Column: Sidebar */}
      <div
        className={`${
          isMobile
            ? showSidebarOnMobile
              ? 'w-full h-full flex flex-col'
              : 'hidden'
            : 'h-full flex flex-col'
        }`}
      >
        <ChatSidebar />
      </div>

      {/* Center Column: Chat Area */}
      <div
        className={`flex-1 h-full flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-950/50 relative ${
          isMobile ? (!showSidebarOnMobile ? 'w-full h-full' : 'hidden') : 'flex'
        }`}
      >
        <OfflineBanner />
        {activeConversation ? (
          <>
            <ChatHeader onBackMobile={isMobile ? () => setActiveConversation(null) : null} />
            <InChatSearchBar />
            <PinnedMessagesBanner />
            <MessageList />
            <MessageInput />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-900">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-inner">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              No conversation selected
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1">
              Select a conversation from the sidebar or click VakSetu AI to begin messaging.
            </p>
          </div>
        )}
      </div>

      {/* Right Column: Chat Info & Profile Drawer */}
      <div
        className={`${
          isMobile
            ? 'fixed inset-y-0 right-0 z-40 max-w-xs w-full shadow-2xl'
            : 'h-full'
        }`}
      >
        <RightSidebar />
      </div>

      {/* Profile & Settings Modal */}
      <ProfileModal />

      {/* New Chat Modal */}
      <NewChatModal />

      {/* Create Group Modal */}
      <CreateGroupModal 
        isOpen={isCreateGroupModalOpen} 
        onClose={() => setIsCreateGroupModalOpen(false)} 
      />

      {/* End-to-End Encryption Info Modal */}
      <EncryptionInfoModal
        isOpen={isEncryptionModalOpen}
        onClose={() => setIsEncryptionModalOpen(false)}
        targetUser={
          activeConversation?.isGroup
            ? null
            : activeConversation?.participants?.find((p) => p._id !== activeConversation._id)
        }
      />
    </div>
  );
};

export default ChatPage;
