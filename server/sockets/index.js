import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';

// In-memory map of online users: userId -> Set of socketIds
export const onlineUsers = new Map();

/**
 * Socket.IO Initialization with Auth, Real-Time Messaging, Online Presence, Typing & Read Receipts
 */
export const initSocket = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1] ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id).select(
        '_id name username avatar status isOnline lastSeen privacy'
      );

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      return next();
    } catch (error) {
      console.warn('[Socket Auth Warning]:', error.message);
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`[Socket.IO] User connected: ${socket.user.username} (socket: ${socket.id})`);

    const isFirstConnection = !onlineUsers.has(userId) || onlineUsers.get(userId).size === 0;

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    if (isFirstConnection) {
      // Mark user online in database
      await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
      // Broadcast online status to all connected users
      io.emit('user_status', { userId, isOnline: true });
    }

    // Send the current list of online user IDs to the connected client
    socket.emit('online_users', Array.from(onlineUsers.keys()));

    // Join user's personal notifications room
    socket.join(`user:${userId}`);

    // Join conversation room
    socket.on('join_conversation', (conversationId) => {
      if (conversationId) {
        socket.join(`conversation:${conversationId}`);
        console.log(`[Socket.IO] Socket ${socket.id} joined conversation:${conversationId}`);
      }
    });

    // Leave conversation room
    socket.on('leave_conversation', (conversationId) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
        console.log(`[Socket.IO] Socket ${socket.id} left conversation:${conversationId}`);
      }
    });

    // Typing start indicator
    socket.on('typing_start', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('user_typing', {
          conversationId,
          userId,
          username: socket.user.username,
          name: socket.user.name,
        });
      }
    });

    // Typing stop indicator
    socket.on('typing_stop', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('user_stop_typing', {
          conversationId,
          userId,
        });
      }
    });

    // Mark messages as read / seen
    socket.on('mark_messages_read', async ({ conversationId }) => {
      try {
        if (!conversationId) return;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.isParticipant(userId)) return;

        // Reset unread count for this user in conversation
        await Conversation.updateOne(
          { _id: conversationId, 'unreadCounts.user': userId },
          { $set: { 'unreadCounts.$.count': 0 } }
        );

        const readAt = new Date();

        // Update readBy on all messages where user is not sender and has not yet read
        await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: userId },
            'readBy.user': { $ne: userId },
          },
          {
            $push: { readBy: { user: userId, readAt } },
          }
        );

        // Broadcast to conversation room that messages were read
        io.to(`conversation:${conversationId}`).emit('messages_read', {
          conversationId,
          readerId: userId,
          readAt,
        });
      } catch (err) {
        console.error('[Socket mark_messages_read error]:', err);
      }
    });

    // Real-time Send Message via Socket
    socket.on('send_message', async (data, callback) => {
      try {
        const { conversationId, text, attachments, replyTo, receiverId } = data;

        if (!conversationId) {
          if (callback) callback({ success: false, message: 'Conversation ID required' });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.isParticipant(userId)) {
          if (callback) callback({ success: false, message: 'Not authorized for this conversation' });
          return;
        }

        let targetReceiver = receiverId;
        if (!targetReceiver && !conversation.isGroup) {
          const other = conversation.participants.find((p) => p.toString() !== userId);
          targetReceiver = other || null;
        }

        // Determine if receiver is currently online
        const isReceiverOnline = targetReceiver && onlineUsers.has(targetReceiver.toString());

        // Create message in DB
        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          receiver: targetReceiver,
          text: text ? text.trim() : (data.isEncrypted ? '🔒 Encrypted message' : ''),
          messageType:
            data.messageType ||
            (attachments && attachments.length > 0
              ? attachments[0].type.startsWith('image/')
                ? 'image'
                : attachments[0].type.startsWith('audio/')
                ? 'voice'
                : 'file'
              : 'text'),
          attachments: attachments || [],
          replyTo: replyTo || null,
          readBy: [{ user: userId }],
          isEncrypted: Boolean(data.isEncrypted),
          ciphertext: data.ciphertext || null,
          iv: data.iv || null,
          encryptedKeys: Array.isArray(data.encryptedKeys) ? data.encryptedKeys : [],
        });

        // Update conversation lastMessage & unread counts
        conversation.lastMessage = message._id;
        conversation.updatedAt = new Date();

        conversation.participants.forEach((pId) => {
          if (pId.toString() !== userId) {
            const entry = conversation.unreadCounts.find((u) => u.user.toString() === pId.toString());
            if (entry) {
              entry.count += 1;
            } else {
              conversation.unreadCounts.push({ user: pId, count: 1 });
            }
          }
        });
        await conversation.save();

        // Populate message
        const populated = await Message.findById(message._id)
          .populate('sender', 'name username avatar')
          .populate('receiver', 'name username avatar')
          .populate({
            path: 'replyTo',
            select: 'text sender attachments isDeleted',
            populate: { path: 'sender', select: 'name username avatar' },
          });

        const safeMessage = populated.toSafeJSON();

        // Broadcast to conversation room
        io.to(`conversation:${conversationId}`).emit('new_message', safeMessage);

        // Also broadcast to each participant's personal room for conversation list update and create in-app notification
        for (const pId of conversation.participants) {
          const participantIdStr = pId.toString();
          io.to(`user:${participantIdStr}`).emit('conversation_updated', {
            conversationId,
            lastMessage: safeMessage,
          });

          // Create notification for other participants
          if (participantIdStr !== userId.toString()) {
            try {
              const notif = await Notification.create({
                recipient: pId,
                sender: userId,
                type: 'message',
                conversation: conversationId,
                message: message._id,
                content: safeMessage.text || 'Sent an attachment',
                isRead: false,
              });

              const populatedNotif = await Notification.findById(notif._id)
                .populate('sender', 'name username avatar')
                .populate('conversation', 'name isGroup avatar')
                .lean();

              io.to(`user:${participantIdStr}`).emit('new_notification', populatedNotif);
            } catch (notifErr) {
              console.error('[Socket Notification creation error]:', notifErr);
            }
          }
        }

        if (callback) callback({ success: true, message: safeMessage });
      } catch (err) {
        console.error('[Socket send_message error]:', err);
        if (callback) callback({ success: false, message: err.message });
      }
    });

    // Real-time Message Edit via Socket
    socket.on('edit_message', async ({ messageId, text }, callback) => {
      try {
        const message = await Message.findById(messageId);
        if (!message || message.sender.toString() !== userId) {
          if (callback) callback({ success: false, message: 'Unauthorized or message not found' });
          return;
        }

        message.text = text.trim();
        message.isEdited = true;
        await message.save();

        const populated = await Message.findById(message._id)
          .populate('sender', 'name username avatar')
          .populate('receiver', 'name username avatar')
          .populate({
            path: 'replyTo',
            select: 'text sender attachments isDeleted',
            populate: { path: 'sender', select: 'name username avatar' },
          });

        const safeMessage = populated.toSafeJSON();

        io.to(`conversation:${message.conversation}`).emit('message_edited', safeMessage);

        if (callback) callback({ success: true, message: safeMessage });
      } catch (err) {
        console.error('[Socket edit_message error]:', err);
        if (callback) callback({ success: false, message: err.message });
      }
    });

    // Real-time Message Delete via Socket
    socket.on('delete_message', async ({ messageId }, callback) => {
      try {
        const message = await Message.findById(messageId);
        if (!message || message.sender.toString() !== userId) {
          if (callback) callback({ success: false, message: 'Unauthorized or message not found' });
          return;
        }

        message.isDeleted = true;
        message.text = 'This message was deleted';
        message.attachments = [];
        await message.save();

        const safeMessage = message.toSafeJSON();

        io.to(`conversation:${message.conversation}`).emit('message_deleted', {
          messageId,
          conversationId: message.conversation,
          message: safeMessage,
        });

        if (callback) callback({ success: true });
      } catch (err) {
        console.error('[Socket delete_message error]:', err);
        if (callback) callback({ success: false, message: err.message });
      }
    });

    // Real-time Reaction via Socket
    socket.on('message_reaction', async ({ messageId, emoji }, callback) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) {
          if (callback) callback({ success: false, message: 'Message not found' });
          return;
        }

        const idx = message.reactions.findIndex(
          (r) => r.user.toString() === userId && r.emoji === emoji
        );

        if (idx > -1) {
          message.reactions.splice(idx, 1);
        } else {
          message.reactions = message.reactions.filter(
            (r) => r.user.toString() !== userId
          );
          message.reactions.push({ user: userId, emoji });
        }

        await message.save();

        io.to(`conversation:${message.conversation}`).emit('message_reacted', {
          messageId,
          conversationId: message.conversation,
          reactions: message.reactions,
        });

        if (callback) callback({ success: true, reactions: message.reactions });
      } catch (err) {
        console.error('[Socket reaction error]:', err);
        if (callback) callback({ success: false, message: err.message });
      }
    });

    // Real-time Pin Message via Socket
    socket.on('pin_message', async ({ messageId }, callback) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) {
          if (callback) callback({ success: false, message: 'Message not found' });
          return;
        }

        message.pinned = !message.pinned;
        await message.save();

        io.to(`conversation:${message.conversation}`).emit('message_pinned', {
          messageId,
          conversationId: message.conversation,
          pinned: message.pinned,
        });

        if (callback) callback({ success: true, pinned: message.pinned });
      } catch (err) {
        console.error('[Socket pin error]:', err);
        if (callback) callback({ success: false, message: err.message });
      }
    });

    // Disconnect handling
    socket.on('disconnect', async (reason) => {
      console.log(`[Socket.IO] User disconnected: ${socket.user.username} (${reason})`);
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          const lastSeen = new Date();
          await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
          io.emit('user_status', { userId, isOnline: false, lastSeen });
        }
      }
    });
  });
};
