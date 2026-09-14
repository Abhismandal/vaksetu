import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';

/**
 * @desc    Global search across messages, conversations, and users
 * @route   GET /api/search
 * @access  Private
 */
export const searchAll = async (req, res) => {
  try {
    const userId = req.user._id;
    const { q = '', type = 'all', conversationId, limit = 20 } = req.query;

    if (!q || !q.trim()) {
      return res.status(200).json({
        success: true,
        query: '',
        results: {
          messages: [],
          conversations: [],
          users: [],
        },
        counts: {
          messages: 0,
          conversations: 0,
          users: 0,
          total: 0,
        },
      });
    }

    const searchTerm = q.trim();
    // Escape regex characters
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'i');
    const searchLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const results = {
      messages: [],
      conversations: [],
      users: [],
    };

    // Retrieve conversation IDs the user belongs to
    const userConversations = await Conversation.find({
      participants: userId,
    }).select('_id participants isGroup name avatar').lean();

    const userConversationIds = userConversations.map((c) => c._id);

    // 1. Search Messages
    if (type === 'all' || type === 'messages') {
      const messageQuery = {
        isDeleted: false,
        text: { $regex: regex },
      };

      if (conversationId) {
        // Enforce membership
        const isMember = userConversationIds.some(
          (cId) => cId.toString() === conversationId.toString()
        );
        if (!isMember) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You are not a member of this conversation',
          });
        }
        messageQuery.conversation = conversationId;
      } else {
        messageQuery.conversation = { $in: userConversationIds };
      }

      const rawMessages = await Message.find(messageQuery)
        .populate('sender', 'name username avatar')
        .populate({
          path: 'conversation',
          select: 'name isGroup avatar participants',
          populate: {
            path: 'participants',
            select: 'name username avatar isOnline',
          },
        })
        .sort({ createdAt: -1 })
        .limit(searchLimit)
        .lean();

      results.messages = rawMessages.map((m) => {
        let convName = m.conversation?.name;
        let convAvatar = m.conversation?.avatar;
        if (!convName && m.conversation?.participants) {
          const other = m.conversation.participants.find(
            (p) => p._id.toString() !== userId.toString()
          );
          convName = other ? other.name : 'Direct Chat';
          convAvatar = other ? other.avatar : null;
        }

        return {
          _id: m._id,
          text: m.text,
          messageType: m.messageType,
          sender: m.sender,
          conversationId: m.conversation?._id || m.conversation,
          conversationName: convName,
          conversationAvatar: convAvatar,
          isGroup: m.conversation?.isGroup || false,
          createdAt: m.createdAt,
          attachments: m.attachments || [],
        };
      });
    }

    // 2. Search Conversations
    if ((type === 'all' || type === 'conversations') && !conversationId) {
      const matchedConversations = await Conversation.find({
        _id: { $in: userConversationIds },
      })
        .populate('participants', 'name username avatar isOnline status lastSeen')
        .populate('lastMessage')
        .sort({ updatedAt: -1 })
        .lean();

      results.conversations = matchedConversations
        .filter((c) => {
          if (c.isGroup && c.name && regex.test(c.name)) {
            return true;
          }
          return c.participants?.some(
            (p) =>
              p._id.toString() !== userId.toString() &&
              (regex.test(p.name) || regex.test(p.username))
          );
        })
        .slice(0, searchLimit)
        .map((c) => {
          let name = c.name;
          let avatar = c.avatar;
          let isOnline = false;
          if (!c.isGroup && c.participants) {
            const other = c.participants.find(
              (p) => p._id.toString() !== userId.toString()
            );
            if (other) {
              name = other.name;
              avatar = other.avatar;
              isOnline = other.isOnline;
            }
          }
          return {
            _id: c._id,
            name,
            avatar,
            isGroup: c.isGroup,
            isOnline,
            participants: c.participants,
            lastMessage: c.lastMessage,
            updatedAt: c.updatedAt,
          };
        });
    }

    // 3. Search Users (Directory)
    if ((type === 'all' || type === 'users') && !conversationId) {
      const matchedUsers = await User.find({
        _id: { $ne: userId },
        $or: [
          { name: { $regex: regex } },
          { username: { $regex: regex } },
          { email: { $regex: regex } },
        ],
      })
        .select('name username email avatar status isOnline lastSeen')
        .limit(searchLimit)
        .lean();

      results.users = matchedUsers;
    }

    return res.status(200).json({
      success: true,
      query: searchTerm,
      type,
      counts: {
        messages: results.messages.length,
        conversations: results.conversations.length,
        users: results.users.length,
        total:
          results.messages.length +
          results.conversations.length +
          results.users.length,
      },
      results,
    });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to execute search',
      error: error.message,
    });
  }
};
