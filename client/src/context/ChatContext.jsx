import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import chatService from '../services/chatService';
import cryptoService from '../services/cryptoService';
import dbService from '../services/dbService';
import { playNotificationSound } from '../utils/notificationSound';
import { showBrowserNotification, requestNotificationPermission } from '../utils/browserNotification';

const ChatContext = createContext(null);

const DEFAULT_AI_CONVERSATION = {
  _id: 'conv-ai-assistant',
  isGroup: false,
  isAi: true,
  name: 'VakSetu AI',
  username: 'vaksetu_assistant',
  avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
  status: 'Intelligent AI Assistant & Speech Bridge',
  isOnline: true,
  lastMessage: {
    text: "Hello! I am VakSetu AI, your real-time intelligent assistant. Ask me anything, or ask me to draft, translate, or refine messages.",
    sender: { _id: 'ai', name: 'VakSetu AI' },
    createdAt: new Date().toISOString(),
  },
  unreadCount: 0,
  pinned: true,
};

export const ChatProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { socket, isConnected } = useSocket();

  const [conversations, setConversations] = useState([DEFAULT_AI_CONVERSATION]);
  const [activeConversation, setActiveConversation] = useState(DEFAULT_AI_CONVERSATION);
  const [activeMessages, setActiveMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState([]);

  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [replyingTo, setReplyingTo] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [inConversationSearch, setInConversationSearch] = useState('');
  const [isInChatSearchOpen, setIsInChatSearchOpen] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [targetJumpMessageId, setTargetJumpMessageId] = useState(null);
  const [inConversationMatchIndex, setInConversationMatchIndex] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // Step 17: Pinned & Starred messages state
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [starredMessages, setStarredMessages] = useState([]);
  const [loadingStarred, setLoadingStarred] = useState(false);

  // Step 18: E2EE state
  const [isE2EEEnabled, setIsE2EEEnabled] = useState(true);
  const [myPublicKey, setMyPublicKey] = useState(null);
  const [myPrivateKey, setMyPrivateKey] = useState(null);
  const [decryptedCache, setDecryptedCache] = useState({});
  const [isEncryptionModalOpen, setIsEncryptionModalOpen] = useState(false);

  // Step 19: Offline & IndexedDB State
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true
  );
  const [outboxQueue, setOutboxQueue] = useState([]);

  const prevConversationIdRef = useRef(null);

  // Local AI messages until Step 14
  const [aiMessages, setAiMessages] = useState([
    {
      _id: 'msg-ai-intro',
      sender: {
        _id: 'ai',
        name: 'VakSetu AI',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      },
      text: "👋 Welcome to **VakSetu**!\n\nI am your intelligent real-time AI assistant. I can help you with:\n* Answering questions & analyzing complex topics\n* Writing, reviewing, and debugging code\n* Polishing, summarizing, and translating your messages\n\nFeel free to ask me anything!",
      messageType: 'text',
      createdAt: new Date().toISOString(),
      status: 'read',
      isAi: true,
      reactions: [{ emoji: '⚡', count: 1, users: ['me'] }],
    },
  ]);

  // Load initial outbox queue
  useEffect(() => {
    dbService.getOutboxMessages().then((items) => {
      if (Array.isArray(items)) setOutboxQueue(items);
    });
  }, []);

  // Sync pending outbox messages on reconnect
  const syncOutboxQueue = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const pending = await dbService.getOutboxMessages();
    if (!pending || pending.length === 0) {
      setOutboxQueue([]);
      return;
    }

    for (const item of pending) {
      try {
        const res = await chatService.sendMessage(item.payload);
        if (res && res.success && res.message) {
          const sentMsg = res.message;
          if (sentMsg.isEncrypted && item.originalText) {
            setDecryptedCache((prev) => ({ ...prev, [sentMsg._id]: item.originalText }));
          }
          setActiveMessages((prev) =>
            prev.map((m) => (m._id === item.tempId ? sentMsg : m))
          );
          await dbService.saveSingleMessage(sentMsg);
          await dbService.removeOutboxMessage(item.id);
        }
      } catch (err) {
        console.warn('[ChatContext] Failed to sync outbox message:', item.id, err.message);
        break;
      }
    }

    const remaining = await dbService.getOutboxMessages();
    setOutboxQueue(remaining || []);
  }, []);

  // Online / Offline network listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOutboxQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOutboxQueue]);

  // Sync outbox when socket reconnects
  useEffect(() => {
    if (isConnected && isOnline) {
      syncOutboxQueue();
    }
  }, [isConnected, isOnline, syncOutboxQueue]);

  // Load conversations (IndexedDB cache first, then network)
  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) return;

    // 1. Instant offline cache load
    try {
      const cached = await dbService.getConversations();
      if (cached && cached.length > 0) {
        setConversations([DEFAULT_AI_CONVERSATION, ...cached]);
      }
    } catch (e) {
      console.warn('[ChatContext] IndexedDB conversation read failed:', e);
    }

    // 2. Fetch fresh conversations from network
    try {
      const data = await chatService.getConversations();
      if (data.success) {
        const remoteConversations = data.conversations || [];
        setConversations([DEFAULT_AI_CONVERSATION, ...remoteConversations]);
        await dbService.saveConversations(remoteConversations);
      }
    } catch (error) {
      console.warn('[ChatContext] Failed to load conversations from network:', error.message);
    }
  }, [isAuthenticated]);

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await chatService.getNotifications(1, 40);
      if (res.success) {
        setNotifications(res.notifications || []);
        setUnreadNotificationsCount(res.unreadCount || 0);
      }
    } catch (err) {
      console.warn('[ChatContext] Failed to load notifications:', err.message);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadConversations();
    loadNotifications();
    requestNotificationPermission().catch(() => {});
  }, [loadConversations, loadNotifications]);

  // Step 18: Initialize user's E2EE cryptographic key pair
  useEffect(() => {
    if (!user?._id) return;
    let isMounted = true;

    const initE2EE = async () => {
      try {
        const keys = await cryptoService.getOrInitUserKeys(user._id, user.publicKey);
        if (isMounted) {
          setMyPublicKey(keys.publicKey);
          setMyPrivateKey(keys.privateKey);
        }
        if (keys.needsServerSync) {
          await chatService.updatePublicKey(keys.publicKey);
        }
      } catch (err) {
        console.warn('[ChatContext] E2EE initialization error:', err.message);
      }
    };

    initE2EE();
    return () => {
      isMounted = false;
    };
  }, [user?._id, user?.publicKey]);

  // Step 18: Decrypt messages batch and update in-memory decryptedCache
  const decryptMessagesBatch = useCallback(
    async (messagesList, privateKey = myPrivateKey) => {
      if (!privateKey || !Array.isArray(messagesList) || messagesList.length === 0) return;

      const newDecrypted = {};
      for (const msg of messagesList) {
        if (msg?.isEncrypted && msg.ciphertext && !decryptedCache[msg._id]) {
          try {
            const plaintext = await cryptoService.decryptMessage(msg, user?._id, privateKey);
            newDecrypted[msg._id] = plaintext;
          } catch {
            newDecrypted[msg._id] = '🔒 Encrypted message';
          }
        }
      }

      if (Object.keys(newDecrypted).length > 0) {
        setDecryptedCache((prev) => ({ ...prev, ...newDecrypted }));
      }
    },
    [myPrivateKey, user?._id, decryptedCache]
  );

  // Trigger decryption when activeMessages or private key updates
  useEffect(() => {
    if (myPrivateKey && activeMessages.length > 0) {
      decryptMessagesBatch(activeMessages, myPrivateKey);
    }
  }, [activeMessages, myPrivateKey, decryptMessagesBatch]);

  const markNotificationRead = async (notificationId) => {
    try {
      const res = await chatService.markNotificationRead(notificationId);
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
        );
        setUnreadNotificationsCount((prev) => Math.max(prev - 1, 0));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      const res = await chatService.markAllNotificationsRead();
      if (res.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadNotificationsCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const res = await chatService.deleteNotification(notificationId);
      if (res.success) {
        setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
        if (res.unreadCount !== undefined) {
          setUnreadNotificationsCount(res.unreadCount);
        }
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const clearAllNotifications = async () => {
    try {
      const res = await chatService.clearAllNotifications();
      if (res.success) {
        setNotifications([]);
        setUnreadNotificationsCount(0);
      }
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  };

  // Room management & read marking on active conversation switch
  useEffect(() => {
    if (!socket || !isConnected) return;

    const prevId = prevConversationIdRef.current;
    if (prevId && prevId !== 'conv-ai-assistant') {
      socket.emit('leave_conversation', prevId);
    }

    setTypingUsers([]);

    if (activeConversation?._id && !activeConversation.isAi) {
      socket.emit('join_conversation', activeConversation._id);
      socket.emit('mark_messages_read', { conversationId: activeConversation._id });
      prevConversationIdRef.current = activeConversation._id;

      // Optimistically clear unread count for current conversation in sidebar
      setConversations((prev) =>
        prev.map((c) =>
          c._id === activeConversation._id ? { ...c, unreadCount: 0 } : c
        )
      );
    } else {
      prevConversationIdRef.current = null;
    }

    return () => {
      if (activeConversation?._id && !activeConversation.isAi) {
        socket.emit('leave_conversation', activeConversation._id);
      }
    };
  }, [socket, isConnected, activeConversation?._id]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversation) {
      setActiveMessages([]);
      return;
    }

    if (activeConversation.isAi) {
      setActiveMessages(aiMessages);
      return;
    }

    const fetchMessages = async () => {
      setLoadingMessages(true);

      // 1. Instant offline cache load from IndexedDB
      try {
        const cached = await dbService.getMessages(activeConversation._id);
        if (cached && cached.length > 0) {
          setActiveMessages(cached);
        }
      } catch (e) {
        console.warn('[ChatContext] IndexedDB message read error:', e);
      }

      // 2. Fresh network fetch
      try {
        const data = await chatService.getMessages(activeConversation._id, 1, 50);
        if (data.success) {
          const fresh = data.messages || [];
          setActiveMessages(fresh);
          await dbService.saveMessages(activeConversation._id, fresh);
        }
        loadPinnedMessages(activeConversation._id);
      } catch (error) {
        console.error('[ChatContext] Error loading messages from network:', error.message);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [activeConversation?._id, aiMessages]);

  // Jump to specific message with highlight animation
  const jumpToMessage = (messageId) => {
    if (!messageId) return;
    setHighlightedMessageId(messageId);

    const attemptScroll = (retries = 10) => {
      const el = document.getElementById(`message-${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (retries > 0) {
        setTimeout(() => attemptScroll(retries - 1), 100);
      }
    };
    attemptScroll();

    setTimeout(() => {
      setHighlightedMessageId((current) => (current === messageId ? null : current));
    }, 2500);
  };

  const openConversationAndJumpToMessage = async (conv, messageId) => {
    const convId = typeof conv === 'object' ? conv?._id : conv;
    if (activeConversation?._id === convId) {
      jumpToMessage(messageId);
      return;
    }

    setTargetJumpMessageId(messageId);

    const fullConv = typeof conv === 'object' ? conv : conversations.find((c) => c._id === convId);
    if (fullConv) {
      setActiveConversation(fullConv);
    } else {
      try {
        const res = await chatService.getConversationById(convId);
        if (res.success && res.conversation) {
          setActiveConversation(res.conversation);
        }
      } catch (err) {
        console.error('Failed to load conversation for jump:', err);
      }
    }
  };

  // Auto jump to target message once messages are loaded
  useEffect(() => {
    if (targetJumpMessageId && activeMessages.length > 0) {
      jumpToMessage(targetJumpMessageId);
      setTargetJumpMessageId(null);
    }
  }, [activeMessages, targetJumpMessageId]);

  // Real-time Socket.IO Listeners
  useEffect(() => {
    if (!socket) return;

    // Initial online users list from server
    const handleOnlineUsers = (userIds) => {
      setOnlineUserIds(new Set(userIds));
    };

    // User status change (online/offline)
    const handleUserStatus = ({ userId, isOnline, lastSeen }) => {
      setOnlineUserIds((prev) => {
        const updated = new Set(prev);
        if (isOnline) {
          updated.add(userId);
        } else {
          updated.delete(userId);
        }
        return updated;
      });

      // Update in conversations list
      setConversations((prev) =>
        prev.map((c) => {
          if (!c.isGroup && c.participants) {
            const hasUser = c.participants.some((p) => p._id === userId || p === userId);
            if (hasUser) {
              return { ...c, isOnline, lastSeen: lastSeen || c.lastSeen };
            }
          }
          return c;
        })
      );
    };

    // Incoming new message
    const handleNewMessage = (message) => {
      if (message.conversation === activeConversation?._id) {
        if (message.isEncrypted) {
          decryptMessagesBatch([message], myPrivateKey);
        }

        setActiveMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });

        // Cache incoming message in IndexedDB
        dbService.saveSingleMessage(message);

        // Mark as read immediately if current active chat
        if (message.sender._id !== user?._id) {
          socket.emit('mark_messages_read', { conversationId: message.conversation });
        }
      }

      // Update sidebar preview and unread count
      setConversations((prev) =>
        prev.map((c) => {
          if (c._id === message.conversation) {
            const isCurrentChat = activeConversation?._id === message.conversation;
            return {
              ...c,
              lastMessage: message,
              unreadCount: isCurrentChat ? 0 : (c.unreadCount || 0) + 1,
            };
          }
          return c;
        })
      );
    };

    // Message edited
    const handleMessageEdited = (updatedMessage) => {
      setActiveMessages((prev) =>
        prev.map((m) => (m._id === updatedMessage._id ? updatedMessage : m))
      );
    };

    // Message deleted
    const handleMessageDeleted = ({ messageId, message }) => {
      setActiveMessages((prev) =>
        prev.map((m) => (m._id === messageId ? message : m))
      );
    };

    // Message reaction
    const handleMessageReacted = ({ messageId, reactions }) => {
      setActiveMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
      );
    };

    // Message pinned
    const handleMessagePinned = ({ messageId, conversationId, pinned }) => {
      setActiveMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, pinned } : m))
      );
      if (activeConversation?._id) {
        loadPinnedMessages(activeConversation._id);
      }
    };

    // Typing start
    const handleUserTyping = ({ conversationId, userId: typingId, username, name }) => {
      if (conversationId === activeConversation?._id && typingId !== user?._id) {
        setTypingUsers((prev) => {
          if (prev.some((u) => u.userId === typingId)) return prev;
          return [...prev, { userId: typingId, username, name }];
        });
      }
    };

    // Typing stop
    const handleUserStopTyping = ({ conversationId, userId: typingId }) => {
      if (conversationId === activeConversation?._id) {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== typingId));
      }
    };

    // Messages marked read
    const handleMessagesRead = ({ conversationId, readerId, readAt }) => {
      if (conversationId === activeConversation?._id) {
        setActiveMessages((prev) =>
          prev.map((m) => {
            if (m.sender._id === user?._id) {
              const readByList = m.readBy || [];
              if (!readByList.some((r) => r.user === readerId || r.user?._id === readerId)) {
                return {
                  ...m,
                  status: 'read',
                  readBy: [...readByList, { user: readerId, readAt }],
                };
              }
            }
            return m;
          })
        );
      }
    };

    // Messages batch deleted
    const handleMessagesBatchDeleted = ({ messageIds }) => {
      if (Array.isArray(messageIds)) {
        setActiveMessages((prev) =>
          prev.map((m) =>
            messageIds.includes(m._id)
              ? { ...m, isDeleted: true, text: 'This message was deleted', attachments: [] }
              : m
          )
        );
      }
    };

    // Real-time group events
    const handleConversationCreated = ({ conversation }) => {
      setConversations((prev) => {
        if (prev.some((c) => c._id === conversation._id)) return prev;
        return [prev[0], conversation, ...prev.slice(1)];
      });
    };

    const handleGroupUpdated = ({ group }) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.group?._id === group._id || c._id === group.conversation) {
            return {
              ...c,
              name: group.name,
              avatar: group.avatar,
              status: group.description,
              group,
            };
          }
          return c;
        })
      );

      setActiveConversation((prev) => {
        if (prev?.group?._id === group._id || prev?._id === group.conversation) {
          return {
            ...prev,
            name: group.name,
            avatar: group.avatar,
            status: group.description,
            group,
          };
        }
        return prev;
      });
    };

    const handleGroupMembersAdded = ({ groupId, group, systemMessage }) => {
      handleGroupUpdated({ group });
      if (systemMessage && activeConversation?.group?._id === groupId) {
        setActiveMessages((prev) => [...prev, systemMessage]);
      }
    };

    const handleGroupMemberRemoved = ({ groupId, memberId, group, systemMessage }) => {
      if (memberId === user?._id) {
        // User was removed or left
        setConversations((prev) => prev.filter((c) => c.group?._id !== groupId && c._id !== group.conversation));
        if (activeConversation?.group?._id === groupId) {
          setActiveConversation(DEFAULT_AI_CONVERSATION);
        }
        return;
      }

      handleGroupUpdated({ group });
      if (systemMessage && activeConversation?.group?._id === groupId) {
        setActiveMessages((prev) => [...prev, systemMessage]);
      }
    };

    const handleGroupAdminToggled = ({ group }) => {
      handleGroupUpdated({ group });
    };

    socket.on('online_users', handleOnlineUsers);
    socket.on('user_status', handleUserStatus);
    socket.on('new_message', handleNewMessage);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('messages_batch_deleted', handleMessagesBatchDeleted);
    socket.on('message_reacted', handleMessageReacted);
    socket.on('message_pinned', handleMessagePinned);
    const handleNewNotification = (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadNotificationsCount((prev) => prev + 1);

      playNotificationSound();

      showBrowserNotification({
        title: notification.sender?.name || 'VakSetu',
        body: notification.content || 'New message received',
        icon: notification.sender?.avatar || '/favicon.ico',
        onClick: () => {
          if (notification.conversation) {
            const convId = notification.conversation._id || notification.conversation;
            const msgId = notification.message?._id || notification.message;
            openConversationAndJumpToMessage(convId, msgId);
          }
        },
      });
    };

    socket.on('online_users', handleOnlineUsers);
    socket.on('user_status', handleUserStatus);
    socket.on('new_message', handleNewMessage);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('messages_batch_deleted', handleMessagesBatchDeleted);
    socket.on('message_reacted', handleMessageReacted);
    socket.on('message_pinned', handleMessagePinned);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);
    socket.on('messages_read', handleMessagesRead);
    socket.on('conversation_created', handleConversationCreated);
    socket.on('group_updated', handleGroupUpdated);
    socket.on('group_members_added', handleGroupMembersAdded);
    socket.on('group_member_removed', handleGroupMemberRemoved);
    socket.on('group_admin_toggled', handleGroupAdminToggled);
    socket.on('new_notification', handleNewNotification);

    return () => {
      socket.off('online_users', handleOnlineUsers);
      socket.off('user_status', handleUserStatus);
      socket.off('new_message', handleNewMessage);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('messages_batch_deleted', handleMessagesBatchDeleted);
      socket.off('message_reacted', handleMessageReacted);
      socket.off('message_pinned', handleMessagePinned);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
      socket.off('messages_read', handleMessagesRead);
      socket.off('conversation_created', handleConversationCreated);
      socket.off('group_updated', handleGroupUpdated);
      socket.off('group_members_added', handleGroupMembersAdded);
      socket.off('group_member_removed', handleGroupMemberRemoved);
      socket.off('group_admin_toggled', handleGroupAdminToggled);
      socket.off('new_notification', handleNewNotification);
    };
  }, [socket, activeConversation?._id, user?._id]);

  // Typing triggers
  const sendTypingStart = () => {
    if (socket && isConnected && activeConversation?._id && !activeConversation.isAi) {
      socket.emit('typing_start', { conversationId: activeConversation._id });
    }
  };

  const sendTypingStop = () => {
    if (socket && isConnected && activeConversation?._id && !activeConversation.isAi) {
      socket.emit('typing_stop', { conversationId: activeConversation._id });
    }
  };

  // Send message
  const sendMessage = async (text, attachments = [], replyToMessage = null, messageType = 'text') => {
    if (!activeConversation) return;

    sendTypingStop();

    if (activeConversation.isAi) {
      const userMsg = {
        _id: `msg-user-${Date.now()}`,
        sender: {
          _id: user?._id || 'me',
          name: user?.name || 'You',
          avatar: user?.avatar,
        },
        text,
        attachments,
        replyTo: replyToMessage,
        messageType: 'text',
        createdAt: new Date().toISOString(),
        status: 'sent',
      };

      const aiMsgId = `msg-ai-${Date.now()}`;
      const placeholderAiMsg = {
        _id: aiMsgId,
        sender: {
          _id: 'ai',
          name: 'VakSetu AI',
          avatar: DEFAULT_AI_CONVERSATION.avatar,
        },
        text: '',
        messageType: 'ai',
        createdAt: new Date().toISOString(),
        status: 'read',
        isAi: true,
        isStreaming: true,
      };

      setAiMessages((prev) => [...prev, userMsg, placeholderAiMsg]);
      setReplyingTo(null);

      // Stream from backend
      const history = aiMessages.map((m) => ({
        role: m.sender?._id === 'ai' ? 'assistant' : 'user',
        content: m.text,
      }));
      history.push({ role: 'user', content: text });

      let accumulatedAiText = '';

      await chatService.streamAiResponse({
        message: text,
        messages: history,
        conversationId: activeConversation._id === DEFAULT_AI_CONVERSATION._id ? undefined : activeConversation._id,
        onChunk: (chunk) => {
          accumulatedAiText += chunk;
          setAiMessages((prev) =>
            prev.map((m) =>
              m._id === aiMsgId ? { ...m, text: accumulatedAiText, isStreaming: true } : m
            )
          );
        },
        onDone: () => {
          setAiMessages((prev) =>
            prev.map((m) =>
              m._id === aiMsgId ? { ...m, isStreaming: false } : m
            )
          );
        },
        onError: (err) => {
          console.error('[AI Stream Error]:', err);
          setAiMessages((prev) =>
            prev.map((m) =>
              m._id === aiMsgId
                ? {
                    ...m,
                    text: accumulatedAiText || 'Sorry, I encountered an issue generating a response. Please try again.',
                    isStreaming: false,
                  }
                : m
            )
          );
        },
      });

      return;
    }

    const payload = {
      conversationId: activeConversation._id,
      text,
      attachments,
      replyTo: replyToMessage?._id || null,
      messageType: messageType || 'text',
    };

    // Step 18: Client-Side End-to-End Encryption
    if (isE2EEEnabled && text && text.trim()) {
      const recipients = [];

      if (activeConversation.isGroup) {
        const members = activeConversation.participants || [];
        members.forEach((m) => {
          const mId = m._id ? m._id.toString() : m.toString();
          const pubKey = m.publicKey || (mId === user?._id?.toString() ? myPublicKey : null);
          if (pubKey) {
            recipients.push({ userId: mId, publicKey: pubKey });
          }
        });
      } else {
        // Direct conversation
        const otherUser = activeConversation.participants?.find(
          (p) => (p._id ? p._id.toString() : p.toString()) !== user?._id?.toString()
        );
        if (otherUser?.publicKey) {
          recipients.push({ userId: otherUser._id, publicKey: otherUser.publicKey });
        }
        if (myPublicKey && user?._id) {
          recipients.push({ userId: user._id, publicKey: myPublicKey });
        }
      }

      if (recipients.length > 0) {
        try {
          const enc = await cryptoService.encryptMessage(text, recipients);
          payload.isEncrypted = true;
          payload.ciphertext = enc.ciphertext;
          payload.iv = enc.iv;
          payload.encryptedKeys = enc.encryptedKeys;
          payload.text = '🔒 Encrypted message';
        } catch (err) {
          console.warn('[ChatContext] E2EE encryption failed, sending plaintext fallback:', err.message);
        }
      }
    }

    // Helper to queue message offline in IndexedDB outbox
    const queueOfflineMessage = async () => {
      const tempId = `temp-${Date.now()}`;
      const queuedMessage = {
        _id: tempId,
        conversation: activeConversation._id,
        sender: {
          _id: user?._id || 'me',
          name: user?.name || 'You',
          avatar: user?.avatar,
        },
        text: payload.text,
        attachments: payload.attachments || [],
        replyTo: replyToMessage,
        messageType: payload.messageType || 'text',
        createdAt: new Date().toISOString(),
        status: 'queued',
        isEncrypted: payload.isEncrypted || false,
        ciphertext: payload.ciphertext || null,
        iv: payload.iv || null,
        encryptedKeys: payload.encryptedKeys || [],
      };

      if (payload.isEncrypted) {
        setDecryptedCache((prev) => ({ ...prev, [tempId]: text }));
      }

      setActiveMessages((prev) => [...prev, queuedMessage]);
      setReplyingTo(null);

      await dbService.queueOutboxMessage({
        tempId,
        payload,
        conversationId: activeConversation._id,
        originalText: text,
      });

      const updated = await dbService.getOutboxMessages();
      setOutboxQueue(updated || []);
    };

    if (!isOnline) {
      await queueOfflineMessage();
      return;
    }

    if (socket && isConnected) {
      socket.emit('send_message', payload, async (response) => {
        if (response?.success && response?.message) {
          if (response.message.isEncrypted) {
            setDecryptedCache((prev) => ({ ...prev, [response.message._id]: text }));
          }
          setActiveMessages((prev) => {
            if (prev.some((m) => m._id === response.message._id)) return prev;
            return [...prev, response.message];
          });
          await dbService.saveSingleMessage(response.message);
          setReplyingTo(null);
        } else {
          await queueOfflineMessage();
        }
      });
      setReplyingTo(null);
    } else {
      try {
        const data = await chatService.sendMessage(payload);
        if (data.success && data.message) {
          if (data.message.isEncrypted) {
            setDecryptedCache((prev) => ({ ...prev, [data.message._id]: text }));
          }
          setActiveMessages((prev) => [...prev, data.message]);
          await dbService.saveSingleMessage(data.message);
          setReplyingTo(null);
        } else {
          await queueOfflineMessage();
        }
      } catch (error) {
        console.warn('[ChatContext] Send message network failure, queuing offline:', error.message);
        await queueOfflineMessage();
      }
    }
  };

  // Edit message
  const editMessage = async (messageId, newText) => {
    if (activeConversation?.isAi) {
      setAiMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, text: newText, isEdited: true } : m))
      );
      return;
    }

    if (socket && isConnected) {
      socket.emit('edit_message', { messageId, text: newText });
    } else {
      await chatService.editMessage(messageId, newText);
    }
  };

  // Delete message
  const deleteMessage = async (messageId) => {
    if (activeConversation?.isAi) {
      setAiMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? { ...m, isDeleted: true, text: 'This message was deleted', attachments: [] }
            : m
        )
      );
      return;
    }

    if (socket && isConnected) {
      socket.emit('delete_message', { messageId });
    } else {
      await chatService.deleteMessage(messageId);
    }
  };

  // Batch delete messages
  const batchDeleteMessages = async (messageIds) => {
    if (!Array.isArray(messageIds) || messageIds.length === 0) return;

    if (activeConversation?.isAi) {
      setAiMessages((prev) =>
        prev.map((m) =>
          messageIds.includes(m._id)
            ? { ...m, isDeleted: true, text: 'This message was deleted', attachments: [] }
            : m
        )
      );
      return;
    }

    try {
      await chatService.batchDeleteMessages(messageIds);
      // Optimistically update local active messages
      setActiveMessages((prev) =>
        prev.map((m) =>
          messageIds.includes(m._id)
            ? { ...m, isDeleted: true, text: 'This message was deleted', attachments: [] }
            : m
        )
      );
    } catch (error) {
      console.error('[ChatContext] Batch delete error:', error.message);
    }
  };

  // React to message
  const addReaction = async (messageId, emoji) => {
    if (activeConversation?.isAi) {
      setAiMessages((prev) =>
        prev.map((m) => {
          if (m._id !== messageId) return m;
          const current = m.reactions || [];
          const exists = current.find((r) => r.emoji === emoji);
          if (exists) {
            return {
              ...m,
              reactions: current
                .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1 } : r))
                .filter((r) => r.count > 0),
            };
          }
          return { ...m, reactions: [...current, { emoji, count: 1, users: ['me'] }] };
        })
      );
      return;
    }

    if (socket && isConnected) {
      socket.emit('message_reaction', { messageId, emoji });
    } else {
      await chatService.reactToMessage(messageId, emoji);
    }
  };

  // Toggle pin message
  const togglePinMessage = async (messageId) => {
    if (activeConversation?.isAi) {
      setAiMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, pinned: !m.pinned } : m))
      );
      return;
    }

    setActiveMessages((prev) =>
      prev.map((m) => (m._id === messageId ? { ...m, pinned: !m.pinned } : m))
    );

    if (socket && isConnected) {
      socket.emit('pin_message', { messageId });
    } else {
      await chatService.togglePinMessage(messageId);
    }

    if (activeConversation?._id) {
      loadPinnedMessages(activeConversation._id);
    }
  };

  // Load pinned messages for active conversation
  const loadPinnedMessages = async (convId) => {
    if (!convId || convId === DEFAULT_AI_CONVERSATION._id) {
      setPinnedMessages([]);
      return;
    }
    try {
      const res = await chatService.getPinnedMessages(convId);
      if (res.success && Array.isArray(res.messages)) {
        setPinnedMessages(res.messages);
      }
    } catch (err) {
      console.warn('[ChatContext] Load pinned messages warning:', err.message);
    }
  };

  // Toggle star message
  const toggleStarMessage = async (messageId) => {
    try {
      const res = await chatService.toggleStarMessage(messageId);
      if (res.success) {
        setActiveMessages((prev) =>
          prev.map((m) => {
            if (m._id !== messageId) return m;
            const currentStarred = m.starredBy || [];
            const userAlreadyStarred = currentStarred.some(
              (u) => (u?._id || u) === user?._id
            );
            let updatedStarred;
            if (userAlreadyStarred) {
              updatedStarred = currentStarred.filter(
                (u) => (u?._id || u) !== user?._id
              );
            } else {
              updatedStarred = [...currentStarred, user?._id];
            }
            return { ...m, starredBy: updatedStarred };
          })
        );
        loadStarredMessages();
        return res;
      }
    } catch (err) {
      console.error('[ChatContext] Toggle star error:', err.message);
    }
  };

  // Load starred messages for user
  const loadStarredMessages = async (convId = null) => {
    try {
      setLoadingStarred(true);
      const res = await chatService.getStarredMessages(convId);
      if (res.success && Array.isArray(res.messages)) {
        setStarredMessages(res.messages);
      }
    } catch (err) {
      console.warn('[ChatContext] Load starred messages warning:', err.message);
    } finally {
      setLoadingStarred(false);
    }
  };

  // Start new conversation with a user
  const startConversation = async (recipientId) => {
    try {
      const data = await chatService.createOrGetConversation(recipientId);
      if (data.success && data.conversation) {
        await loadConversations();
        setActiveConversation(data.conversation);
        setIsNewChatModalOpen(false);
        return data.conversation;
      }
    } catch (error) {
      console.error('[ChatContext] Start conversation error:', error.message);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        setConversations,
        activeConversation,
        setActiveConversation,
        activeMessages,
        loadingMessages,
        onlineUserIds,
        typingUsers,
        sendTypingStart,
        sendTypingStop,
        loadConversations,
        sendMessage,
        editMessage,
        deleteMessage,
        batchDeleteMessages,
        addReaction,
        togglePinMessage,
        startConversation,
        isRightSidebarOpen,
        setIsRightSidebarOpen,
        searchQuery,
        setSearchQuery,
        activeFilter,
        setActiveFilter,
        replyingTo,
        setReplyingTo,
        isProfileModalOpen,
        setIsProfileModalOpen,
        isNewChatModalOpen,
        setIsNewChatModalOpen,
        isCreateGroupModalOpen,
        setIsCreateGroupModalOpen,
        inConversationSearch,
        setInConversationSearch,
        isInChatSearchOpen,
        setIsInChatSearchOpen,
        highlightedMessageId,
        setHighlightedMessageId,
        jumpToMessage,
        openConversationAndJumpToMessage,
        notifications,
        unreadNotificationsCount,
        loadNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        deleteNotification,
        clearAllNotifications,
        totalUnreadMessagesCount: conversations.reduce(
          (acc, c) => acc + (c.unreadCount || 0),
          0
        ),
        isSocketConnected: isConnected,
        // Step 17 exports
        pinnedMessages,
        loadPinnedMessages,
        starredMessages,
        loadStarredMessages,
        toggleStarMessage,
        loadingStarred,
        // Step 18 exports
        isE2EEEnabled,
        setIsE2EEEnabled,
        myPublicKey,
        decryptedCache,
        isEncryptionModalOpen,
        setIsEncryptionModalOpen,
        // Step 19 exports
        isOnline,
        outboxQueue,
        syncOutboxQueue,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
