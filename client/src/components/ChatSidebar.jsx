import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Search, 
  Plus, 
  Settings, 
  LogOut, 
  Sparkles, 
  Pin, 
  Moon, 
  Sun,
  X,
  Users,
  Bot,
  Loader2,
  Star
} from 'lucide-react';
import UserAvatar from './UserAvatar';
import NotificationDropdown from './NotificationDropdown';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useTheme } from '../context/ThemeContext';
import chatService from '../services/chatService';

export const ChatSidebar = ({ onCloseMobile }) => {
  const { user, logout } = useAuth();
  const { 
    conversations, 
    activeConversation, 
    setActiveConversation, 
    searchQuery, 
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    setIsProfileModalOpen,
    setIsNewChatModalOpen,
    setIsCreateGroupModalOpen,
    openConversationAndJumpToMessage,
    startConversation,
    onlineUserIds,
    totalUnreadMessagesCount,
    starredMessages,
    loadingStarred,
    loadStarredMessages,
    toggleStarMessage
  } = useChat();
  const { isDark, toggleTheme } = useTheme();

  const [searchResults, setSearchResults] = useState({
    messages: [],
    conversations: [],
    users: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [searchCategory, setSearchCategory] = useState('all'); // 'all' | 'chats' | 'messages' | 'users'

  // Debounced global search across chats, messages, and people
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ messages: [], conversations: [], users: [] });
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await chatService.searchAll(searchQuery.trim());
        if (res.success && res.results) {
          setSearchResults(res.results);
        }
      } catch (err) {
        console.error('Failed to execute search:', err);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch starred messages whenever the Starred filter tab is opened
  useEffect(() => {
    if (activeFilter === 'starred') {
      loadStarredMessages();
    }
  }, [activeFilter]);

  // Standard conversation list filtering when not searching
  const filteredConversations = conversations.filter((c) => {
    if (activeFilter === 'unread') return (c.unreadCount || 0) > 0;
    if (activeFilter === 'groups') return c.isGroup === true;
    if (activeFilter === 'ai') return c.isAi === true;
    return true;
  });

  const formatTimestamp = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderHighlightedSnippet = (text, query) => {
    if (!query || !query.trim() || !text) return text;
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      part.toLowerCase() === query.trim().toLowerCase() ? (
        <mark
          key={i}
          className="bg-amber-300 dark:bg-amber-400 text-slate-900 rounded-xs px-0.5 font-semibold"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const isSearchActive = searchQuery.trim().length > 0;
  const totalResults =
    (searchResults.conversations?.length || 0) +
    (searchResults.messages?.length || 0) +
    (searchResults.users?.length || 0);

  return (
    <aside className="w-full sm:w-80 md:w-88 lg:w-96 flex-shrink-0 h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 transition-colors select-none">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-300">
              VakSetu
            </h1>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              Real-Time AI Messenger
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <NotificationDropdown />

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="sm:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Current User Card */}
      <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <div 
          onClick={() => setIsProfileModalOpen(true)}
          className="flex items-center space-x-3 min-w-0 cursor-pointer group flex-1"
        >
          <UserAvatar
            src={user?.avatar}
            name={user?.name || 'User'}
            size="sm"
            isOnline={true}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {user?.name || 'Current User'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              @{user?.username || 'user'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsProfileModalOpen(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors ml-2"
          title="Profile Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Search & Actions Bar */}
      <div className="p-3 space-y-2.5">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            {isSearching ? (
              <Loader2 className="w-4 h-4 absolute left-3 top-2.5 text-indigo-500 animate-spin pointer-events-none" />
            ) : (
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats, messages, or people..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-100/90 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all hover:scale-105 active:scale-95"
              title="Start new direct chat"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsCreateGroupModalOpen(true)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/60 dark:border-slate-700 transition-all hover:scale-105 active:scale-95"
              title="Create new group"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter / Category Pills */}
        {isSearchActive ? (
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 scrollbar-none">
            {[
              { id: 'all', label: `All (${totalResults})` },
              { id: 'chats', label: `Chats (${searchResults.conversations?.length || 0})` },
              { id: 'messages', label: `Messages (${searchResults.messages?.length || 0})` },
              { id: 'users', label: `People (${searchResults.users?.length || 0})` },
            ].map((tab) => {
              const isActive = searchCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSearchCategory(tab.id)}
                  className={`px-3 py-1 rounded-full whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 scrollbar-none">
            {[
              { id: 'all', label: 'All Chats' },
              { id: 'unread', label: 'Unread', badge: totalUnreadMessagesCount },
              { id: 'starred', label: 'Starred', icon: Star, badge: starredMessages?.length || 0 },
              { id: 'groups', label: 'Groups' },
              { id: 'ai', label: 'VakSetu AI', icon: Sparkles },
            ].map((tab) => {
              const isActive = activeFilter === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3 py-1 rounded-full whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {Icon && <Icon className="w-3 h-3" />}
                  <span>{tab.label}</span>
                  {tab.badge > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                      isActive ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {isSearchActive ? (
          // Search Results View
          isSearching ? (
            <div className="h-44 flex flex-col items-center justify-center text-center px-4">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Searching chats, messages, and people...
              </p>
            </div>
          ) : totalResults === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center px-4">
              <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                No results found
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-xs">
                We couldn't find any chats, messages, or contacts matching "{searchQuery}"
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {/* Chats Matches */}
              {(searchCategory === 'all' || searchCategory === 'chats') &&
                searchResults.conversations?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">
                      Chats ({searchResults.conversations.length})
                    </p>
                    {searchResults.conversations.map((chat) => (
                      <div
                        key={chat._id}
                        onClick={() => {
                          setActiveConversation(chat);
                          setSearchQuery('');
                          if (onCloseMobile) onCloseMobile();
                        }}
                        className="w-full p-2.5 rounded-2xl flex items-center space-x-3 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-all border border-transparent"
                      >
                        <UserAvatar
                          src={chat.avatar}
                          name={chat.name}
                          size="md"
                          isOnline={chat.isOnline}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {renderHighlightedSnippet(chat.name, searchQuery)}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {chat.lastMessage?.text || 'No messages yet'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              {/* Messages Matches */}
              {(searchCategory === 'all' || searchCategory === 'messages') &&
                searchResults.messages?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">
                      Messages ({searchResults.messages.length})
                    </p>
                    {searchResults.messages.map((msg) => (
                      <div
                        key={msg._id}
                        onClick={() => {
                          openConversationAndJumpToMessage(msg.conversationId, msg._id);
                          if (onCloseMobile) onCloseMobile();
                        }}
                        className="w-full p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200/60 dark:border-slate-800/60 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-1.5 truncate">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                              {msg.conversationName}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">
                            {formatTimestamp(msg.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {msg.sender?.name}:{' '}
                          </span>
                          {renderHighlightedSnippet(msg.text, searchQuery)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

              {/* People Matches */}
              {(searchCategory === 'all' || searchCategory === 'users') &&
                searchResults.users?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">
                      People ({searchResults.users.length})
                    </p>
                    {searchResults.users.map((u) => (
                      <div
                        key={u._id}
                        className="w-full p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 border border-slate-200/60 dark:border-slate-800/60 transition-all flex items-center justify-between space-x-2"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <UserAvatar
                            src={u.avatar}
                            name={u.name}
                            size="sm"
                            isOnline={onlineUserIds.has(u._id) || u.isOnline}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {renderHighlightedSnippet(u.name, searchQuery)}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              @{u.username}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            await startConversation(u._id);
                            setSearchQuery('');
                            if (onCloseMobile) onCloseMobile();
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-1 shadow-xs transition-colors flex-shrink-0"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>Chat</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )
        ) : activeFilter === 'starred' ? (
          // Starred Messages List View
          loadingStarred ? (
            <div className="h-44 flex flex-col items-center justify-center text-center px-4">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Loading starred messages...
              </p>
            </div>
          ) : starredMessages.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center px-4">
              <Star className="w-8 h-8 text-amber-400/40 mb-2" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                No starred messages
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                Star important messages to easily find them here
              </p>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {starredMessages.map((msg) => {
                const conv = typeof msg.conversation === 'object' ? msg.conversation : { _id: msg.conversation };
                const convName = conv.name || (conv.isGroup ? 'Group' : 'Direct Chat');
                const senderName = msg.sender?.name || 'Someone';

                return (
                  <div
                    key={msg._id}
                    onClick={() => {
                      openConversationAndJumpToMessage(conv, msg._id);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className="w-full p-2.5 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 border border-amber-200/50 dark:border-amber-800/40 cursor-pointer transition-all shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2 min-w-0 pr-2">
                        <UserAvatar
                          src={msg.sender?.avatar}
                          name={senderName}
                          size="xs"
                        />
                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {senderName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-medium truncate max-w-[90px]">
                          {convName}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <span className="text-[10px] text-slate-400">
                          {formatTimestamp(msg.createdAt)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStarMessage(msg._id);
                          }}
                          className="p-1 rounded-md text-amber-500 hover:text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                          title="Unstar"
                        >
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 px-0.5">
                      {msg.text || (msg.attachments?.length ? `📎 ${msg.attachments[0].name || 'Attachment'}` : 'Message')}
                    </p>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          // Default Conversation List View
          filteredConversations.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-center px-4">
              <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                No conversations found
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                Start a new chat to begin messaging
              </p>
            </div>
          ) : (
            filteredConversations.map((chat) => {
              const isSelected = activeConversation?._id === chat._id;
              return (
                <div
                  key={chat._id}
                  onClick={() => {
                    setActiveConversation(chat);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full p-3 rounded-2xl flex items-center space-x-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm'
                      : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <div className="relative">
                    <UserAvatar
                      src={chat.avatar}
                      name={chat.name}
                      size="md"
                      isOnline={chat.isOnline}
                    />
                    {chat.isAi && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center text-[9px] shadow-sm">
                        <Sparkles className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-1.5 truncate">
                        <span className={`text-xs font-semibold truncate ${
                          isSelected ? 'text-indigo-950 dark:text-indigo-200' : 'text-slate-900 dark:text-white'
                        }`}>
                          {chat.name}
                        </span>
                        {chat.pinned && (
                          <Pin className="w-3 h-3 text-indigo-500 rotate-45 flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0 ml-1">
                        {formatTimestamp(chat.lastMessage?.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className={`text-xs truncate ${
                        isSelected
                          ? 'text-indigo-700/80 dark:text-indigo-300/80 font-medium'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {chat.lastMessage?.text || 'No messages yet'}
                      </p>

                      {chat.unreadCount > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-600 text-white min-w-[18px] text-center shadow-sm">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Bottom Footer Actions */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
        <button
          onClick={() => setIsProfileModalOpen(true)}
          className="flex items-center space-x-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>

        <button
          onClick={logout}
          className="flex items-center space-x-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          title="Sign out of account"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default ChatSidebar;
