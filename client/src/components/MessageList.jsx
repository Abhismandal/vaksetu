import React, { useEffect, useRef, useState } from 'react';
import { 
  Check, 
  CheckCheck, 
  Reply, 
  Smile, 
  Pin, 
  Trash2, 
  Copy, 
  Download, 
  FileText, 
  Sparkles,
  Bot,
  CornerDownRight,
  MoreHorizontal,
  Pencil,
  X,
  Forward,
  CheckSquare,
  Square,
  Maximize2,
  Music,
  Film,
  Globe,
  Star,
  Lock,
  Clock
} from 'lucide-react';
import UserAvatar from './UserAvatar';
import TypingIndicator from './TypingIndicator';
import ForwardModal from './ForwardModal';
import ImageModal from './ImageModal';
import MarkdownRenderer from './MarkdownRenderer';
import TranslateModal from './TranslateModal';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import chatService from '../services/chatService';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';

export const MessageList = () => {
  const { user } = useAuth();
  const { 
    activeConversation, 
    activeMessages, 
    sendMessage,
    editMessage,
    deleteMessage, 
    batchDeleteMessages,
    addReaction, 
    togglePinMessage, 
    toggleStarMessage,
    setReplyingTo,
    inConversationSearch,
    highlightedMessageId,
    typingUsers,
    decryptedCache
  } = useChat();

  const messagesEndRef = useRef(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState(null);

  // Inline edit state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState(new Set());

  // Forward modal state
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [messageToForward, setMessageToForward] = useState(null);
  const [messagesToForward, setMessagesToForward] = useState([]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null);

  // Image lightbox modal state
  const [selectedImage, setSelectedImage] = useState(null); // { url, name }

  // Step 15: Translation state
  const [translateModalMessage, setTranslateModalMessage] = useState(null);
  const [translations, setTranslations] = useState({}); // { [msgId]: { translatedText, targetLanguage } }

  const handleTranslateMessage = async (msg, targetLanguage) => {
    try {
      const res = await chatService.translateMessage(msg.text, targetLanguage, msg._id);
      if (res.success && res.translatedText) {
        setTranslations((prev) => ({
          ...prev,
          [msg._id]: {
            translatedText: res.translatedText,
            targetLanguage: res.targetLanguage || targetLanguage,
          },
        }));
      }
    } catch (err) {
      console.error('Failed to translate message:', err);
    }
  };

  const removeTranslation = (msgId) => {
    setTranslations((prev) => {
      const next = { ...prev };
      delete next[msgId];
      return next;
    });
  };

  const quickReactions = ['👍', '❤️', '😂', '🔥', '🎉', '🚀'];

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, [activeConversation?._id]);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [activeMessages.length]);

  // Close popup menus on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuMessageId(null);
      setContextMenu(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const copyToClipboard = (text) => {
    if (text) {
      navigator.clipboard.writeText(text);
    }
    setActiveMenuMessageId(null);
    setContextMenu(null);
  };

  const handleStartEdit = (message) => {
    setEditingMessageId(message._id);
    setEditingText(message.text || '');
    setActiveMenuMessageId(null);
    setContextMenu(null);
  };

  const handleSaveEdit = async () => {
    if (!editingText.trim()) return;
    await editMessage(editingMessageId, editingText.trim());
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleSingleForward = (message) => {
    setMessageToForward(message);
    setMessagesToForward([]);
    setIsForwardModalOpen(true);
    setActiveMenuMessageId(null);
    setContextMenu(null);
  };

  const toggleSelectMessage = (id) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkForward = () => {
    const toFwd = displayedMessages.filter(
      (m) => selectedMessageIds.has(m._id) && !m.isDeleted
    );
    if (toFwd.length === 0) return;
    setMessagesToForward(toFwd);
    setMessageToForward(null);
    setIsForwardModalOpen(true);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedMessageIds);
    if (ids.length === 0) return;
    await batchDeleteMessages(ids);
    setSelectedMessageIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleContextMenu = (e, message) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      message,
    });
  };

  // Helper to highlight matching text in search mode
  const renderHighlightedText = (text, query) => {
    if (!query || !query.trim() || !text) return text;
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      part.toLowerCase() === query.trim().toLowerCase() ? (
        <mark
          key={i}
          className="bg-amber-300 dark:bg-amber-400 text-slate-900 rounded-xs px-0.5 font-medium"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const displayedMessages = activeMessages;

  return (
    <div className="relative flex-1 overflow-y-auto px-4 py-6 space-y-4 bg-slate-50/50 dark:bg-slate-950/50">
      {/* Floating Multi-Select Action Bar */}
      {isMultiSelectMode && (
        <div className="sticky top-2 z-30 mx-auto max-w-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-2xl shadow-xl px-4 py-2.5 flex items-center justify-between text-xs animate-in slide-in-from-top-3">
          <div className="flex items-center space-x-2.5">
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              {selectedMessageIds.size} selected
            </span>
            <button
              onClick={() => {
                if (selectedMessageIds.size === displayedMessages.length) {
                  setSelectedMessageIds(new Set());
                } else {
                  setSelectedMessageIds(new Set(displayedMessages.map((m) => m._id)));
                }
              }}
              className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 font-medium underline cursor-pointer"
            >
              {selectedMessageIds.size === displayedMessages.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              disabled={selectedMessageIds.size === 0}
              onClick={handleBulkForward}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 font-semibold hover:bg-indigo-100 disabled:opacity-40 flex items-center space-x-1.5 transition-colors"
            >
              <Forward className="w-3.5 h-3.5" />
              <span>Forward</span>
            </button>

            <button
              disabled={selectedMessageIds.size === 0}
              onClick={handleBulkDelete}
              className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 font-semibold hover:bg-rose-100 disabled:opacity-40 flex items-center space-x-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <button
              onClick={() => {
                setIsMultiSelectMode(false);
                setSelectedMessageIds(new Set());
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Close selection mode"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Pinned Messages Bar (if any pinned in this chat) */}
      {activeMessages.some((m) => m.pinned) && (
        <div className="sticky top-0 z-10 bg-indigo-50/90 dark:bg-indigo-950/80 backdrop-blur-sm border border-indigo-200/80 dark:border-indigo-800/80 p-2.5 rounded-2xl flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200 shadow-sm">
          <div className="flex items-center space-x-2 truncate">
            <Pin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 rotate-45 flex-shrink-0" />
            <span className="font-semibold flex-shrink-0">Pinned:</span>
            <span className="truncate text-slate-600 dark:text-slate-300">
              {activeMessages.find((m) => m.pinned)?.text}
            </span>
          </div>
        </div>
      )}

      {/* Date Divider */}
      <div className="flex items-center justify-center my-4">
        <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          Today
        </span>
      </div>

      {/* AI Quick Starter Suggestions */}
      {activeConversation?.isAi && displayedMessages.length <= 2 && (
        <div className="py-2 px-2 max-w-xl mx-auto space-y-2 mb-4 animate-in fade-in">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>Try an AI prompt</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { title: '⚛️ React Custom Hook', desc: 'Write a clean useDebounce custom hook with JS' },
              { title: '🔄 Node.js Architecture', desc: 'Explain how Node event loop handles microtasks vs macrotasks' },
              { title: '📝 Draft Message', desc: 'Help me write a polite, professional project update for stakeholders' },
              { title: '⚡ Socket.IO Scaling', desc: 'What are the top best practices for high-scale WebSockets?' },
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(item.desc)}
                className="p-3 text-left rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 shadow-xs hover:shadow-md transition-all group"
              >
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {item.title}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {item.desc}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {displayedMessages.map((message) => {
        const isMe = message.sender._id === user?._id || message.sender._id === 'me';
        const isDeleted = message.isDeleted;
        const isAi = message.isAi || message.sender._id === 'ai';
        const isEditing = editingMessageId === message._id;
        const isSelected = selectedMessageIds.has(message._id);
        const isHighlighted = highlightedMessageId === message._id;
        const isStarred = message.starredBy?.some((u) => (u?._id || u) === user?._id);
        const displayText = (message.isEncrypted && decryptedCache[message._id])
          ? decryptedCache[message._id]
          : message.text;

        return (
          <div
            key={message._id}
            id={`message-${message._id}`}
            onContextMenu={(e) => handleContextMenu(e, message)}
            className={`group relative flex items-start space-x-2.5 transition-all duration-500 rounded-2xl ${
              isMe ? 'flex-row-reverse space-x-reverse' : 'flex-row'
            } ${isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/30 p-1' : ''} ${
              isHighlighted ? 'ring-2 ring-indigo-500 shadow-lg bg-indigo-50/80 dark:bg-indigo-950/70 p-2 scale-[1.01]' : ''
            }`}
          >
            {/* Multi-select checkbox */}
            {isMultiSelectMode && (
              <button
                onClick={() => toggleSelectMessage(message._id)}
                className="mt-2 text-indigo-600 dark:text-indigo-400 focus:outline-none flex-shrink-0"
              >
                {isSelected ? (
                  <CheckSquare className="w-4 h-4 fill-indigo-100 dark:fill-indigo-900" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
              </button>
            )}

            {/* Avatar for other or AI */}
            {!isMe && (
              <div className="flex-shrink-0 mt-1">
                {isAi ? (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                    <Sparkles className="w-4 h-4" />
                  </div>
                ) : (
                  <UserAvatar
                    src={message.sender.avatar}
                    name={message.sender.name}
                    size="sm"
                    showStatus={false}
                  />
                )}
              </div>
            )}

            {/* Message Bubble Container */}
            <div className={`max-w-[85%] sm:max-w-[75%] md:max-w-[65%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {/* Sender Name in group */}
              {!isMe && activeConversation.isGroup && (
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 px-1">
                  {message.sender.name}
                </span>
              )}

              {/* Reply Quote preview if present */}
              {message.replyTo && (
                <div className="mb-1 p-2 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 text-[11px] border-l-2 border-indigo-500 text-slate-600 dark:text-slate-300 max-w-full truncate">
                  <span className="font-semibold block text-indigo-600 dark:text-indigo-400">
                    {message.replyTo.sender?.name || 'Replied message'}
                  </span>
                  <p className="truncate">{message.replyTo.text}</p>
                </div>
              )}

              {/* Bubble Body / Inline Edit View */}
              {isEditing ? (
                <div className="w-full min-w-[260px] max-w-md p-3 rounded-2xl bg-white dark:bg-slate-900 border-2 border-indigo-500 shadow-md animate-in fade-in">
                  <textarea
                    autoFocus
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSaveEdit();
                      } else if (e.key === 'Escape') {
                        handleCancelEdit();
                      }
                    }}
                    rows={2}
                    className="w-full text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400">
                      Press <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">Enter</kbd> to save, <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">Esc</kbd> to cancel
                    </span>
                    <div className="flex space-x-1.5">
                      <button
                        onClick={handleCancelEdit}
                        className="px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-xs"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${
                    isDeleted
                      ? 'italic text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800'
                      : isMe
                      ? 'bg-indigo-600 text-white rounded-tr-sm shadow-indigo-500/10'
                      : isAi
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-tl-sm border border-purple-200/80 dark:border-purple-900/40 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-tl-sm border border-slate-200/70 dark:border-slate-800 shadow-sm'
                  }`}
                >
                  {/* Text Content */}
                  {(!message.text?.startsWith('🎙️ Voice message') ||
                    !message.attachments?.some(
                      (a) => a.type?.startsWith('audio/') || message.messageType === 'voice'
                    )) &&
                    displayText && (
                      <div className="leading-relaxed">
                        {isAi ? (
                          <MarkdownRenderer
                            content={displayText || ''}
                            isStreaming={message.isStreaming}
                          />
                        ) : (
                          <div className="whitespace-pre-wrap break-words">
                            {renderHighlightedText(displayText, inConversationSearch)}
                          </div>
                        )}
                      </div>
                    )}

                  {/* Step 15: Inline AI Translation */}
                  {translations[message._id] && (
                    <div
                      className={`mt-2 pt-2 border-t text-xs leading-relaxed animate-in fade-in transition-all ${
                        isMe
                          ? 'border-indigo-400/40 text-indigo-100'
                          : 'border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-semibold text-indigo-300 dark:text-indigo-400 mb-1">
                        <span className="flex items-center space-x-1">
                          <Globe className="w-3 h-3" />
                          <span>Translated to {translations[message._id].targetLanguage}</span>
                        </span>
                        <button
                          onClick={() => removeTranslation(message._id)}
                          className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                          title="Hide translation"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="whitespace-pre-wrap break-words italic">
                        {translations[message._id].translatedText}
                      </div>
                    </div>
                  )}

                  {/* Attachments preview */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2.5 space-y-2">
                      {message.attachments.map((att, idx) => {
                        const isImg = att.type?.startsWith('image/');
                        const isVid = att.type?.startsWith('video/');
                        const isAud = att.type?.startsWith('audio/');

                        if (isImg) {
                          return (
                            <div
                              key={idx}
                              onClick={() => setSelectedImage({ url: att.url, name: att.name })}
                              className="relative group/img cursor-pointer overflow-hidden rounded-xl border border-black/10 dark:border-white/10 max-w-sm"
                            >
                              <img
                                src={att.url}
                                alt={att.name || 'Attachment'}
                                className="max-h-72 w-auto object-cover rounded-xl transition-transform duration-200 group-hover/img:scale-[1.02]"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <span className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-xs flex items-center space-x-1.5 text-xs font-medium shadow-md">
                                  <Maximize2 className="w-3.5 h-3.5" />
                                  <span>Click to view</span>
                                </span>
                              </div>
                            </div>
                          );
                        }

                        if (isVid) {
                          return (
                            <div key={idx} className="rounded-xl overflow-hidden bg-black/5 dark:bg-black/30 border border-slate-200 dark:border-slate-800 max-w-sm">
                              <video
                                src={att.url}
                                controls
                                preload="metadata"
                                className="max-h-72 w-full rounded-xl"
                              />
                            </div>
                          );
                        }

                        if (isAud || message.messageType === 'voice') {
                          return (
                            <VoiceMessagePlayer
                              key={idx}
                              audioUrl={att.url}
                              duration={att.duration || 0}
                              isMe={isMe}
                              name={att.name}
                            />
                          );
                        }

                        return (
                          <div
                            key={idx}
                            className="flex items-center space-x-2.5 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-slate-700/50 min-w-[200px] max-w-xs"
                          >
                            <FileText className="w-6 h-6 flex-shrink-0 text-indigo-500" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">{att.name}</p>
                              <span className="text-[10px] opacity-70">
                                {att.size ? (att.size > 1024 * 1024 ? `${(att.size / (1024 * 1024)).toFixed(2)} MB` : `${(att.size / 1024).toFixed(1)} KB`) : ''}
                              </span>
                            </div>
                            <a
                              href={att.url}
                              download={att.name || 'file'}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Time & Read Status Footer */}
                  <div
                    className={`mt-1 flex items-center justify-end space-x-1.5 text-[10px] ${
                      isMe ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {message.isEdited && !isDeleted && (
                      <span className="italic opacity-80">(edited)</span>
                    )}

                    {message.isEncrypted && (
                      <span title="End-to-End Encrypted" className="flex items-center">
                        <Lock className={`w-3 h-3 flex-shrink-0 ${isMe ? 'text-emerald-300' : 'text-emerald-500'}`} />
                      </span>
                    )}

                    {isStarred && (
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0" />
                    )}

                    <span>
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    {isMe && !isDeleted && (
                      <span>
                        {message.status === 'queued' || message.status === 'pending' ? (
                          <Clock className="w-3.5 h-3.5 text-amber-300 animate-pulse" title="Queued - sending when reconnected" />
                        ) : message.status === 'read' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                        ) : message.status === 'delivered' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-indigo-200" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-indigo-200" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Reactions Bar */}
              {message.reactions && message.reactions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 px-1">
                  {message.reactions.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => addReaction(message._id, r.emoji)}
                      className="px-2 py-0.5 rounded-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center space-x-1 hover:scale-105 transition-transform"
                    >
                      <span>{r.emoji}</span>
                      <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                        {r.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Hover Action Menu */}
            {!isDeleted && !isEditing && (
              <div
                className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm ${
                  isMe ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* React trigger */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setEmojiPickerMessageId(
                        emojiPickerMessageId === message._id ? null : message._id
                      )
                    }
                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="React"
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>

                  {/* Quick Reaction Popup */}
                  {emojiPickerMessageId === message._id && (
                    <div className="absolute bottom-full mb-1 left-0 z-20 flex items-center space-x-1 p-1.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg animate-in fade-in zoom-in-95">
                      {quickReactions.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            addReaction(message._id, emoji);
                            setEmojiPickerMessageId(null);
                          }}
                          className="p-1 hover:scale-125 transition-transform text-sm"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reply */}
                <button
                  onClick={() => setReplyingTo(message)}
                  className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Reply"
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>

                {/* Forward */}
                <button
                  onClick={() => handleSingleForward(message)}
                  className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Forward"
                >
                  <Forward className="w-3.5 h-3.5" />
                </button>

                {/* Copy */}
                <button
                  onClick={() => copyToClipboard(message.text)}
                  className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Copy text"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>

                {/* Translate */}
                {message.text && (
                  <button
                    onClick={() => setTranslateModalMessage(message)}
                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="Translate message"
                  >
                    <Globe className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Pin */}
                <button
                  onClick={() => togglePinMessage(message._id)}
                  className={`p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 ${
                    message.pinned
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400 hover:text-indigo-600'
                  }`}
                  title={message.pinned ? 'Unpin' : 'Pin message'}
                >
                  <Pin className="w-3.5 h-3.5 rotate-45" />
                </button>

                {/* Star / Bookmark */}
                <button
                  onClick={() => toggleStarMessage(message._id)}
                  className={`p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 ${
                    isStarred
                      ? 'text-amber-500'
                      : 'text-slate-400 hover:text-amber-500'
                  }`}
                  title={isStarred ? 'Unstar message' : 'Star message'}
                >
                  <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-amber-400 text-amber-500' : ''}`} />
                </button>

                {/* Edit (if sender is me) */}
                {isMe && (
                  <button
                    onClick={() => handleStartEdit(message)}
                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="Edit message"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Delete (if sender is me) */}
                {isMe && (
                  <button
                    onClick={() => deleteMessage(message._id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="Delete message"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* More / Multi-select trigger */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuMessageId(
                        activeMenuMessageId === message._id ? null : message._id
                      );
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="More actions"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>

                  {/* Dropdown menu */}
                  {activeMenuMessageId === message._id && (
                    <div className="absolute right-0 bottom-full mb-1 z-20 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 text-xs">
                      <button
                        onClick={() => {
                          setIsMultiSelectMode(true);
                          setSelectedMessageIds(new Set([message._id]));
                          setActiveMenuMessageId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Select message</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Real-time Typing Bubble */}
      <TypingIndicator typingUsers={typingUsers} />

      {/* Custom Right Click Context Menu */}
      {contextMenu && (
        <div
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 260), left: Math.min(contextMenu.x, window.innerWidth - 180) }}
          className="fixed z-50 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-1.5 text-xs animate-in fade-in zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick Reaction row */}
          <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            {quickReactions.slice(0, 5).map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  addReaction(contextMenu.message._id, emoji);
                  setContextMenu(null);
                }}
                className="hover:scale-125 transition-transform text-sm p-0.5"
              >
                {emoji}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setReplyingTo(contextMenu.message);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Reply className="w-3.5 h-3.5 text-slate-400" />
            <span>Reply</span>
          </button>

          <button
            onClick={() => handleSingleForward(contextMenu.message)}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Forward className="w-3.5 h-3.5 text-slate-400" />
            <span>Forward</span>
          </button>

          <button
            onClick={() => copyToClipboard(contextMenu.message.text)}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Copy text</span>
          </button>

          <button
            onClick={() => {
              togglePinMessage(contextMenu.message._id);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Pin className="w-3.5 h-3.5 text-slate-400 rotate-45" />
            <span>{contextMenu.message.pinned ? 'Unpin message' : 'Pin message'}</span>
          </button>

          {(() => {
            const isCtxStarred = contextMenu.message.starredBy?.some((u) => (u?._id || u) === user?._id);
            return (
              <button
                onClick={() => {
                  toggleStarMessage(contextMenu.message._id);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center space-x-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Star className={`w-3.5 h-3.5 ${isCtxStarred ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
                <span>{isCtxStarred ? 'Unstar message' : 'Star message'}</span>
              </button>
            );
          })()}

          {/* Translate in context menu */}
          {contextMenu.message.text && (
            <button
              onClick={() => {
                setTranslateModalMessage(contextMenu.message);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left flex items-center space-x-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              <span>Translate message</span>
            </button>
          )}

          <button
            onClick={() => {
              setIsMultiSelectMode(true);
              setSelectedMessageIds(new Set([contextMenu.message._id]));
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
            <span>Select message</span>
          </button>

          {(contextMenu.message.sender._id === user?._id || contextMenu.message.sender._id === 'me') &&
            !contextMenu.message.isDeleted && (
              <>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <button
                  onClick={() => handleStartEdit(contextMenu.message)}
                  className="w-full px-3 py-1.5 text-left flex items-center space-x-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-400" />
                  <span>Edit message</span>
                </button>
                <button
                  onClick={() => {
                    deleteMessage(contextMenu.message._id);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center space-x-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete message</span>
                </button>
              </>
            )}
        </div>
      )}

      {/* Forward Modal */}
      <ForwardModal
        isOpen={isForwardModalOpen}
        onClose={() => {
          setIsForwardModalOpen(false);
          setMessageToForward(null);
          setMessagesToForward([]);
          if (isMultiSelectMode) {
            setIsMultiSelectMode(false);
            setSelectedMessageIds(new Set());
          }
        }}
        messageToForward={messageToForward}
        messagesToForward={messagesToForward}
      />

      {/* Image Zoom / Lightbox Modal */}
      <ImageModal
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        imageSrc={selectedImage?.url}
        imageName={selectedImage?.name}
      />

      {/* Step 15: Translate Modal */}
      <TranslateModal
        isOpen={!!translateModalMessage}
        message={translateModalMessage}
        onClose={() => setTranslateModalMessage(null)}
        onTranslate={handleTranslateMessage}
      />

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
