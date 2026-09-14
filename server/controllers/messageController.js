import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import Notification from '../models/Notification.js';

/**
 * @desc    Send a new message
 * @route   POST /api/messages
 * @access  Private
 */
export const sendMessage = async (req, res) => {
  try {
    const { 
      conversationId, 
      receiverId, 
      text, 
      messageType, 
      attachments, 
      replyTo,
      isEncrypted,
      ciphertext,
      iv,
      encryptedKeys
    } = req.body;
    const senderId = req.user._id;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID is required',
      });
    }

    if (
      (!text || !text.trim()) &&
      (!attachments || attachments.length === 0) &&
      (!isEncrypted || !ciphertext)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty. Please provide text, an attachment, or encrypted payload.',
      });
    }

    // Verify conversation existence & participant authorization
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    if (!conversation.isParticipant(senderId)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages to this conversation',
      });
    }

    // Infer receiver for direct conversations
    let targetReceiver = receiverId;
    if (!targetReceiver && !conversation.isGroup) {
      const otherParticipant = conversation.participants.find(
        (p) => p.toString() !== senderId.toString()
      );
      targetReceiver = otherParticipant || null;
    }

    // Create message
    const message = await Message.create({
      conversation: conversationId,
      sender: senderId,
      receiver: targetReceiver,
      text: text ? text.trim() : (isEncrypted ? '🔒 Encrypted message' : ''),
      messageType:
        messageType ||
        (attachments && attachments.length > 0
          ? attachments[0].type.startsWith('image/')
            ? 'image'
            : attachments[0].type.startsWith('audio/')
            ? 'voice'
            : 'file'
          : 'text'),
      attachments: attachments || [],
      replyTo: replyTo || null,
      readBy: [{ user: senderId }],
      isEncrypted: Boolean(isEncrypted),
      ciphertext: ciphertext || null,
      iv: iv || null,
      encryptedKeys: Array.isArray(encryptedKeys) ? encryptedKeys : [],
    });

    // Update conversation lastMessage & increment unread count for recipients
    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();

    conversation.participants.forEach((pId) => {
      if (pId.toString() !== senderId.toString()) {
        const unreadEntry = conversation.unreadCounts.find(
          (u) => u.user.toString() === pId.toString()
        );
        if (unreadEntry) {
          unreadEntry.count += 1;
        } else {
          conversation.unreadCounts.push({ user: pId, count: 1 });
        }
      }
    });

    await conversation.save();

    // Populate created message
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name username avatar')
      .populate('receiver', 'name username avatar')
      .populate({
        path: 'replyTo',
        select: 'text sender attachments isDeleted',
        populate: { path: 'sender', select: 'name username avatar' },
      });

    // Create in-app notifications for other participants
    const io = req.app.get('io');
    const safeOutput = populatedMessage.toSafeJSON();

    for (const pId of conversation.participants) {
      const pIdStr = pId.toString();
      if (pIdStr !== senderId.toString()) {
        try {
          const notif = await Notification.create({
            recipient: pId,
            sender: senderId,
            type: 'message',
            conversation: conversationId,
            message: message._id,
            content: safeOutput.text || 'Sent an attachment',
            isRead: false,
          });

          if (io) {
            const populatedNotif = await Notification.findById(notif._id)
              .populate('sender', 'name username avatar')
              .populate('conversation', 'name isGroup avatar')
              .lean();
            io.to(`user:${pIdStr}`).emit('new_notification', populatedNotif);
          }
        } catch (notifErr) {
          console.error('[Notification Creation Error]:', notifErr);
        }
      }
    }

    if (io) {
      io.to(`conversation:${conversationId}`).emit('new_message', safeOutput);
      conversation.participants.forEach((pId) => {
        io.to(`user:${pId.toString()}`).emit('conversation_updated', {
          conversationId,
          lastMessage: safeOutput,
        });
      });
    }

    return res.status(201).json({
      success: true,
      message: safeOutput,
    });
  } catch (error) {
    console.error('[sendMessage Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message',
    });
  }
};

/**
 * @desc    Edit an existing message
 * @route   PUT /api/messages/:id
 * @access  Private
 */
export const editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message text cannot be empty',
      });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Only original sender can edit
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own messages',
      });
    }

    if (message.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a deleted message',
      });
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

    const safeOutput = populated.toSafeJSON();
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${message.conversation}`).emit('message_edited', safeOutput);
    }

    return res.status(200).json({
      success: true,
      message: safeOutput,
    });
  } catch (error) {
    console.error('[editMessage Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to edit message',
    });
  }
};

/**
 * @desc    Soft delete a message
 * @route   DELETE /api/messages/:id
 * @access  Private
 */
export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Only original sender can delete
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages',
      });
    }

    message.isDeleted = true;
    message.text = 'This message was deleted';
    message.attachments = [];
    await message.save();

    const safeOutput = message.toSafeJSON();
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${message.conversation}`).emit('message_deleted', {
        messageId: message._id,
        conversationId: message.conversation,
        message: safeOutput,
      });
    }

    return res.status(200).json({
      success: true,
      message: safeOutput,
    });
  } catch (error) {
    console.error('[deleteMessage Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete message',
    });
  }
};

/**
 * @desc    Toggle reaction on a message
 * @route   POST /api/messages/:id/reactions
 * @access  Private
 */
export const reactToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji) {
      return res.status(400).json({
        success: false,
        message: 'Emoji is required',
      });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    const existingReactionIndex = message.reactions.findIndex(
      (r) => r.user.toString() === userId.toString() && r.emoji === emoji
    );

    if (existingReactionIndex > -1) {
      // Toggle off if already reacted with exact emoji
      message.reactions.splice(existingReactionIndex, 1);
    } else {
      // Remove any prior reaction by this user on this message and add new one
      message.reactions = message.reactions.filter(
        (r) => r.user.toString() !== userId.toString()
      );
      message.reactions.push({ user: userId, emoji });
    }

    await message.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${message.conversation}`).emit('message_reacted', {
        messageId: message._id,
        conversationId: message.conversation,
        reactions: message.reactions,
      });
    }

    return res.status(200).json({
      success: true,
      reactions: message.reactions,
    });
  } catch (error) {
    console.error('[reactToMessage Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update reaction',
    });
  }
};

/**
 * @desc    Toggle pin status on a message
 * @route   PUT /api/messages/:id/pin
 * @access  Private
 */
export const togglePinMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    message.pinned = !message.pinned;
    message.pinnedBy = message.pinned ? req.user._id : null;
    message.pinnedAt = message.pinned ? new Date() : null;
    await message.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'name username avatar')
      .populate('pinnedBy', 'name username');

    const safeOutput = populated.toSafeJSON();
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${message.conversation}`).emit('message_pinned', {
        messageId: message._id,
        conversationId: message.conversation,
        pinned: message.pinned,
        pinnedBy: populated.pinnedBy,
        pinnedAt: message.pinnedAt,
        message: safeOutput,
      });
    }

    return res.status(200).json({
      success: true,
      pinned: message.pinned,
      message: safeOutput,
    });
  } catch (error) {
    console.error('[togglePinMessage Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle pin',
    });
  }
};

/**
 * @desc    Delete multiple selected messages
 * @route   POST /api/messages/batch-delete
 * @access  Private
 */
export const deleteSelectedMessages = async (req, res) => {
  try {
    const { messageIds } = req.body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of message IDs',
      });
    }

    const result = await Message.updateMany(
      { _id: { $in: messageIds }, sender: req.user._id },
      { $set: { isDeleted: true, text: 'This message was deleted', attachments: [] } }
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('messages_batch_deleted', { messageIds });
    }

    return res.status(200).json({
      success: true,
      modifiedCount: result.modifiedCount,
      message: `Successfully deleted ${result.modifiedCount} messages`,
    });
  } catch (error) {
    console.error('[deleteSelectedMessages Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete selected messages',
    });
  }
};

/**
 * @desc    Toggle star/bookmark status on a message for the current user
 * @route   POST /api/messages/:id/star
 * @access  Private
 */
export const toggleStarMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    const isStarred = message.starredBy?.some((u) => u.toString() === userId.toString());

    if (isStarred) {
      message.starredBy = message.starredBy.filter((u) => u.toString() !== userId.toString());
    } else {
      if (!message.starredBy) message.starredBy = [];
      message.starredBy.push(userId);
    }

    await message.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'name username avatar');

    const safeOutput = populated.toSafeJSON();

    return res.status(200).json({
      success: true,
      isStarred: !isStarred,
      messageId: message._id,
      message: safeOutput,
    });
  } catch (error) {
    console.error('[toggleStarMessage Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle star status',
    });
  }
};

/**
 * @desc    Get all starred messages for the current user (optionally filtered by conversation)
 * @route   GET /api/messages/starred
 * @access  Private
 */
export const getStarredMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const { conversationId } = req.query;

    const query = {
      starredBy: userId,
      isDeleted: false,
    };

    if (conversationId) {
      query.conversation = conversationId;
    }

    const messages = await Message.find(query)
      .populate('sender', 'name username avatar')
      .populate('conversation', 'name isGroup avatar participants')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (error) {
    console.error('[getStarredMessages Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve starred messages',
    });
  }
};

/**
 * @desc    Get all pinned messages in a conversation
 * @route   GET /api/messages/pinned/:conversationId
 * @access  Private
 */
export const getPinnedMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({
      conversation: conversationId,
      pinned: true,
      isDeleted: false,
    })
      .populate('sender', 'name username avatar')
      .populate('pinnedBy', 'name username')
      .sort({ pinnedAt: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (error) {
    console.error('[getPinnedMessages Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve pinned messages',
    });
  }
};

/**
 * @desc    Get shared media, documents, links, and audio in a conversation
 * @route   GET /api/messages/media/:conversationId
 * @access  Private
 */
export const getConversationMedia = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({
      conversation: conversationId,
      isDeleted: false,
    })
      .populate('sender', 'name username avatar')
      .sort({ createdAt: -1 })
      .lean();

    const mediaList = []; // Images & Videos
    const docsList = [];  // Documents & Archives
    const audioList = []; // Voice & Audio clips
    const linksList = []; // Extracted URLs

    const urlRegex = /(https?:\/\/[^\s]+)/g;

    for (const msg of messages) {
      // Check attachments
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          const item = {
            ...att,
            messageId: msg._id,
            sender: msg.sender,
            createdAt: msg.createdAt,
          };

          if (att.type?.startsWith('image/') || att.type?.startsWith('video/')) {
            mediaList.push(item);
          } else if (att.type?.startsWith('audio/') || msg.messageType === 'voice') {
            audioList.push(item);
          } else {
            docsList.push(item);
          }
        }
      }

      // Check text for links
      if (msg.text) {
        const matches = msg.text.match(urlRegex);
        if (matches) {
          for (const url of matches) {
            linksList.push({
              url,
              messageId: msg._id,
              sender: msg.sender,
              createdAt: msg.createdAt,
              contextText: msg.text,
            });
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      counts: {
        media: mediaList.length,
        docs: docsList.length,
        audio: audioList.length,
        links: linksList.length,
      },
      media: mediaList,
      docs: docsList,
      audio: audioList,
      links: linksList,
    });
  } catch (error) {
    console.error('[getConversationMedia Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversation media',
    });
  }
};
