import crypto from 'crypto';
import Group from '../models/Group.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

/**
 * @desc    Create a new group
 * @route   POST /api/groups
 * @access  Private
 */
export const createGroup = async (req, res, next) => {
  try {
    const { name, description = '', avatar = '', members = [] } = req.body;
    const creatorId = req.user._id;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Group name must be at least 2 characters long',
      });
    }

    // Ensure unique member IDs including creator
    const memberIdSet = new Set(members.map((id) => id.toString()));
    memberIdSet.add(creatorId.toString());
    const allMemberIds = Array.from(memberIdSet);

    if (allMemberIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'A group must have at least 2 members',
      });
    }

    // Generate unique invite code
    const inviteCode = crypto.randomBytes(4).toString('hex');

    // Default avatar if none provided
    const groupAvatar =
      avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&bold=true`;

    // 1. Create Conversation
    const conversation = await Conversation.create({
      participants: allMemberIds,
      isGroup: true,
      name: name.trim(),
      avatar: groupAvatar,
      unreadCounts: allMemberIds.map((userId) => ({
        user: userId,
        count: userId.toString() === creatorId.toString() ? 0 : 1,
      })),
    });

    // 2. Create Group model document
    const group = await Group.create({
      name: name.trim(),
      description: description.trim(),
      avatar: groupAvatar,
      conversation: conversation._id,
      members: allMemberIds,
      admins: [creatorId],
      createdBy: creatorId,
      inviteCode,
    });

    // Link conversation to group
    conversation.group = group._id;

    // 3. Create initial system announcement message
    const systemMessage = await Message.create({
      conversation: conversation._id,
      sender: creatorId,
      text: `${req.user.name} created group "${name.trim()}"`,
      messageType: 'system',
      status: 'delivered',
    });

    conversation.lastMessage = systemMessage._id;
    await conversation.save();

    // Populate group with user profiles
    const populatedGroup = await Group.findById(group._id)
      .populate('members', 'name username avatar isOnline lastSeen bio status')
      .populate('admins', 'name username avatar isOnline lastSeen bio status')
      .populate('createdBy', 'name username avatar');

    // Broadcast real-time event via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      allMemberIds.forEach((memberId) => {
        io.to(`user:${memberId}`).emit('conversation_created', {
          conversation: {
            _id: conversation._id,
            isGroup: true,
            isAi: false,
            name: group.name,
            avatar: group.avatar,
            status: group.description,
            participants: populatedGroup.members,
            group: populatedGroup,
            lastMessage: systemMessage,
            unreadCount: memberId.toString() === creatorId.toString() ? 0 : 1,
            pinned: false,
            updatedAt: conversation.updatedAt,
            createdAt: conversation.createdAt,
          },
        });
      });
    }

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      group: populatedGroup,
      conversation: {
        _id: conversation._id,
        isGroup: true,
        isAi: false,
        name: group.name,
        avatar: group.avatar,
        status: group.description,
        participants: populatedGroup.members,
        group: populatedGroup,
        lastMessage: systemMessage,
        unreadCount: 0,
        pinned: false,
        updatedAt: conversation.updatedAt,
        createdAt: conversation.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get group details by ID
 * @route   GET /api/groups/:id
 * @access  Private
 */
export const getGroupDetails = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members', 'name username avatar isOnline lastSeen bio status')
      .populate('admins', 'name username avatar isOnline lastSeen bio status')
      .populate('createdBy', 'name username avatar');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    if (!group.isMember(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group',
      });
    }

    res.status(200).json({
      success: true,
      group,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update group details (Admin only)
 * @route   PUT /api/groups/:id
 * @access  Private
 */
export const updateGroup = async (req, res, next) => {
  try {
    const { name, description, avatar } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only group admins can modify group details',
      });
    }

    if (name) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    if (avatar) group.avatar = avatar;

    await group.save();

    // Sync with conversation
    await Conversation.findByIdAndUpdate(group.conversation, {
      name: group.name,
      avatar: group.avatar,
    });

    const populatedGroup = await Group.findById(group._id)
      .populate('members', 'name username avatar isOnline lastSeen bio status')
      .populate('admins', 'name username avatar isOnline lastSeen bio status')
      .populate('createdBy', 'name username avatar');

    // Notify room via socket
    const io = req.app.get('io');
    if (io) {
      io.to(group.conversation.toString()).emit('group_updated', {
        group: populatedGroup,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Group updated successfully',
      group: populatedGroup,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add members to group (Admin only)
 * @route   POST /api/groups/:id/members
 * @access  Private
 */
export const addMembers = async (req, res, next) => {
  try {
    const { memberIds = [] } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only group admins can add new members',
      });
    }

    const currentMemberIds = group.members.map((m) => m.toString());
    const newMembersToAdd = memberIds.filter(
      (id) => !currentMemberIds.includes(id.toString())
    );

    if (newMembersToAdd.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected users are already members of this group',
      });
    }

    group.members.push(...newMembersToAdd);
    await group.save();

    // Update conversation participants
    await Conversation.findByIdAndUpdate(group.conversation, {
      $addToSet: { participants: { $each: newMembersToAdd } },
    });

    // Create system message
    const addedUsers = await User.find({ _id: { $in: newMembersToAdd } }, 'name');
    const addedNames = addedUsers.map((u) => u.name).join(', ');
    const systemMessage = await Message.create({
      conversation: group.conversation,
      sender: req.user._id,
      text: `${req.user.name} added ${addedNames} to the group`,
      messageType: 'system',
      status: 'delivered',
    });

    await Conversation.findByIdAndUpdate(group.conversation, {
      lastMessage: systemMessage._id,
    });

    const populatedGroup = await Group.findById(group._id)
      .populate('members', 'name username avatar isOnline lastSeen bio status')
      .populate('admins', 'name username avatar isOnline lastSeen bio status')
      .populate('createdBy', 'name username avatar');

    const io = req.app.get('io');
    if (io) {
      io.to(group.conversation.toString()).emit('group_members_added', {
        groupId: group._id,
        newMemberIds: newMembersToAdd,
        group: populatedGroup,
        systemMessage,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Members added successfully',
      group: populatedGroup,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove a member from group (Admin or Self-Leave)
 * @route   DELETE /api/groups/:id/members/:memberId
 * @access  Private
 */
export const removeMember = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    const currentUserId = req.user._id;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    const isSelfLeave = currentUserId.toString() === memberId.toString();
    const isAdmin = group.isAdmin(currentUserId);

    if (!isSelfLeave && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can remove other members from the group',
      });
    }

    // Remove from members and admins
    group.members = group.members.filter((m) => m.toString() !== memberId.toString());
    group.admins = group.admins.filter((a) => a.toString() !== memberId.toString());

    // If no admins remain, assign creator or oldest remaining member as admin
    if (group.admins.length === 0 && group.members.length > 0) {
      group.admins.push(group.members[0]);
    }

    await group.save();

    // Remove from conversation participants
    await Conversation.findByIdAndUpdate(group.conversation, {
      $pull: { participants: memberId },
    });

    // Create system message
    const removedUser = await User.findById(memberId, 'name');
    const systemText = isSelfLeave
      ? `${req.user.name} left the group`
      : `${req.user.name} removed ${removedUser?.name || 'a member'} from the group`;

    const systemMessage = await Message.create({
      conversation: group.conversation,
      sender: currentUserId,
      text: systemText,
      messageType: 'system',
      status: 'delivered',
    });

    await Conversation.findByIdAndUpdate(group.conversation, {
      lastMessage: systemMessage._id,
    });

    const populatedGroup = await Group.findById(group._id)
      .populate('members', 'name username avatar isOnline lastSeen bio status')
      .populate('admins', 'name username avatar isOnline lastSeen bio status')
      .populate('createdBy', 'name username avatar');

    const io = req.app.get('io');
    if (io) {
      io.to(group.conversation.toString()).emit('group_member_removed', {
        groupId: group._id,
        memberId,
        group: populatedGroup,
        systemMessage,
      });
    }

    res.status(200).json({
      success: true,
      message: isSelfLeave ? 'You left the group' : 'Member removed successfully',
      group: populatedGroup,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle admin status of a member (Admin only)
 * @route   PUT /api/groups/:id/admins/:memberId
 * @access  Private
 */
export const toggleAdmin = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    const currentUserId = req.user._id;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    if (!group.isAdmin(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can promote or demote members',
      });
    }

    if (!group.isMember(memberId)) {
      return res.status(400).json({
        success: false,
        message: 'User is not a member of this group',
      });
    }

    const isTargetAdmin = group.isAdmin(memberId);

    if (isTargetAdmin) {
      if (group.admins.length <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Group must have at least one admin',
        });
      }
      group.admins = group.admins.filter((a) => a.toString() !== memberId.toString());
    } else {
      group.admins.push(memberId);
    }

    await group.save();

    const populatedGroup = await Group.findById(group._id)
      .populate('members', 'name username avatar isOnline lastSeen bio status')
      .populate('admins', 'name username avatar isOnline lastSeen bio status')
      .populate('createdBy', 'name username avatar');

    const io = req.app.get('io');
    if (io) {
      io.to(group.conversation.toString()).emit('group_admin_toggled', {
        groupId: group._id,
        memberId,
        isAdmin: !isTargetAdmin,
        group: populatedGroup,
      });
    }

    res.status(200).json({
      success: true,
      message: !isTargetAdmin ? 'Promoted to admin' : 'Demoted from admin',
      isAdmin: !isTargetAdmin,
      group: populatedGroup,
    });
  } catch (error) {
    next(error);
  }
};
