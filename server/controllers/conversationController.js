import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Group from '../models/Group.js';


/**
 * @desc    Get all conversations for the authenticated user
 * @route   GET /api/conversations
 * @access  Private
 */
export const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({ participants: userId })
      .populate('participants', 'name username avatar isOnline lastSeen bio status privacy publicKey')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name username avatar' },
      })
      .populate('group', 'name avatar description members admins createdBy')
      .sort({ updatedAt: -1 });

    // Format conversations with computed properties for current user
    const formatted = conversations.map((conv) => {
      const isPinned = conv.pinnedBy.some((p) => p.toString() === userId.toString());
      const unreadObj = conv.unreadCounts.find((u) => u.user.toString() === userId.toString());
      const unreadCount = unreadObj ? unreadObj.count : 0;

      // Identify the other participant for 1-on-1 chats
      const otherParticipant = conv.isGroup
        ? null
        : conv.participants.find((p) => p._id.toString() !== userId.toString());

      return {
        _id: conv._id,
        isGroup: conv.isGroup,
        isAi: conv.isAi,
        name: conv.isGroup ? (conv.group?.name || conv.name) : (otherParticipant?.name || conv.name || 'Chat'),
        avatar: conv.isGroup ? (conv.group?.avatar || conv.avatar) : (otherParticipant?.avatar || conv.avatar),
        status: otherParticipant?.status || (conv.isGroup ? conv.group?.description : ''),
        isOnline: otherParticipant?.isOnline || false,
        lastSeen: otherParticipant?.lastSeen || null,
        participants: conv.participants,
        group: conv.group,
        lastMessage: conv.lastMessage,
        unreadCount,
        pinned: isPinned,
        updatedAt: conv.updatedAt,
        createdAt: conv.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      conversations: formatted,
    });
  } catch (error) {
    console.error('[getConversations Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversations',
    });
  }
};

/**
 * @desc    Create or get existing 1-to-1 conversation
 * @route   POST /api/conversations
 * @access  Private
 */
export const createOrGetConversation = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const senderId = req.user._id;

    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: 'Recipient ID is required',
      });
    }

    if (recipientId.toString() === senderId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create a 1-to-1 conversation with yourself',
      });
    }

    // Verify recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient user not found',
      });
    }

    // Find existing 1-on-1 conversation
    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [senderId, recipientId], $size: 2 },
    })
      .populate('participants', 'name username avatar isOnline lastSeen bio status privacy publicKey')
      .populate('lastMessage');

    if (!conversation) {
      // Create new conversation
      conversation = await Conversation.create({
        participants: [senderId, recipientId],
        isGroup: false,
        unreadCounts: [
          { user: senderId, count: 0 },
          { user: recipientId, count: 0 },
        ],
      });

      conversation = await Conversation.findById(conversation._id).populate(
        'participants',
        'name username avatar isOnline lastSeen bio status privacy publicKey'
      );
    }

    const otherParticipant = conversation.participants.find(
      (p) => p._id.toString() !== senderId.toString()
    );

    const formatted = {
      _id: conversation._id,
      isGroup: false,
      isAi: false,
      name: otherParticipant?.name || 'Chat',
      avatar: otherParticipant?.avatar || '',
      status: otherParticipant?.status || '',
      isOnline: otherParticipant?.isOnline || false,
      lastSeen: otherParticipant?.lastSeen || null,
      participants: conversation.participants,
      lastMessage: conversation.lastMessage,
      unreadCount: 0,
      pinned: false,
      updatedAt: conversation.updatedAt,
      createdAt: conversation.createdAt,
    };

    return res.status(200).json({
      success: true,
      conversation: formatted,
    });
  } catch (error) {
    console.error('[createOrGetConversation Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate conversation',
    });
  }
};

/**
 * @desc    Get single conversation by ID
 * @route   GET /api/conversations/:id
 * @access  Private
 */
export const getConversationById = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('participants', 'name username avatar isOnline lastSeen bio status privacy publicKey')
      .populate('lastMessage')
      .populate('group');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    if (!conversation.isParticipant(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this conversation',
      });
    }

    return res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error('[getConversationById Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversation',
    });
  }
};

/**
 * @desc    Get messages for a conversation with pagination
 * @route   GET /api/conversations/:id/messages
 * @access  Private
 */
export const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 30;
    const skip = (page - 1) * limit;

    // Verify participant
    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    if (!conversation.isParticipant(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view messages in this conversation',
      });
    }

    // Reset unread count for current user
    await Conversation.updateOne(
      { _id: id, 'unreadCounts.user': req.user._id },
      { $set: { 'unreadCounts.$.count': 0 } }
    );

    const totalMessages = await Message.countDocuments({ conversation: id });

    const rawMessages = await Message.find({ conversation: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'name username avatar')
      .populate('receiver', 'name username avatar')
      .populate({
        path: 'replyTo',
        select: 'text sender attachments isDeleted',
        populate: { path: 'sender', select: 'name username avatar' },
      });

    // Mask deleted messages & reverse to return chronologically ascending (oldest -> newest)
    const messages = rawMessages
      .map((msg) => msg.toSafeJSON())
      .reverse();

    return res.status(200).json({
      success: true,
      messages,
      page,
      limit,
      totalMessages,
      hasMore: skip + rawMessages.length < totalMessages,
    });
  } catch (error) {
    console.error('[getMessages Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages',
    });
  }
};

/**
 * @desc    Toggle pin conversation for current user
 * @route   PUT /api/conversations/:id/pin
 * @access  Private
 */
export const togglePinConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(id);
    if (!conversation || !conversation.isParticipant(userId)) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or not authorized',
      });
    }

    const isPinned = conversation.pinnedBy.some((p) => p.toString() === userId.toString());

    if (isPinned) {
      conversation.pinnedBy = conversation.pinnedBy.filter(
        (p) => p.toString() !== userId.toString()
      );
    } else {
      conversation.pinnedBy.push(userId);
    }

    await conversation.save();

    return res.status(200).json({
      success: true,
      pinned: !isPinned,
      message: !isPinned ? 'Conversation pinned' : 'Conversation unpinned',
    });
  } catch (error) {
    console.error('[togglePinConversation Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to pin/unpin conversation',
    });
  }
};
