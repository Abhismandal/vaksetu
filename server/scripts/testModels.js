import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Group from '../models/Group.js';
import Notification from '../models/Notification.js';

dotenv.config();

async function runModelTests() {
  try {
    console.log('1. Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aichatbot');
    console.log('✓ Connected to MongoDB');

    // Clean up any previous test items
    await User.deleteMany({ email: { $in: ['alice_model@example.com', 'bob_model@example.com'] } });

    console.log('2. Creating Test Users...');
    const userA = await User.create({
      name: 'Alice Model',
      username: 'alice_model',
      email: 'alice_model@example.com',
      password: 'password123',
    });

    const userB = await User.create({
      name: 'Bob Model',
      username: 'bob_model',
      email: 'bob_model@example.com',
      password: 'password123',
    });
    console.log('✓ Test users Alice and Bob created');

    console.log('3. Creating 1-to-1 Conversation...');
    const conversation = await Conversation.create({
      participants: [userA._id, userB._id],
      isGroup: false,
    });
    if (!conversation.isParticipant(userA._id) || !conversation.isParticipant(userB._id)) {
      throw new Error('isParticipant failed');
    }
    console.log('✓ Conversation created with ID:', conversation._id);

    console.log('4. Creating Initial Message with Attachments...');
    const message1 = await Message.create({
      conversation: conversation._id,
      sender: userA._id,
      receiver: userB._id,
      text: 'Hey Bob, check out this blueprint diagram!',
      messageType: 'image',
      attachments: [
        {
          url: 'https://example.com/blueprint.png',
          name: 'blueprint.png',
          size: 204800,
          type: 'image/png',
        },
      ],
      reactions: [{ user: userB._id, emoji: '🔥' }],
      readBy: [{ user: userA._id }],
    });
    console.log('✓ Message 1 created with attachment and reaction');

    console.log('5. Creating Reply Message...');
    const message2 = await Message.create({
      conversation: conversation._id,
      sender: userB._id,
      receiver: userA._id,
      text: 'Looks awesome! Let us build it now.',
      messageType: 'text',
      replyTo: message1._id,
      readBy: [{ user: userB._id }],
    });
    console.log('✓ Reply Message created with replyTo link');

    // Update conversation lastMessage
    conversation.lastMessage = message2._id;
    await conversation.save();

    console.log('6. Testing Query Population...');
    const populated = await Message.findById(message2._id)
      .populate('sender', 'name username avatar')
      .populate('replyTo', 'text sender');
    if (!populated.replyTo || populated.replyTo.text !== 'Hey Bob, check out this blueprint diagram!') {
      throw new Error('Population of replyTo failed');
    }
    console.log('✓ Query population succeeded. Replying to:', populated.replyTo.text);

    console.log('7. Testing Message Soft Deletion (toSafeJSON)...');
    message1.isDeleted = true;
    await message1.save();
    const safeObj = message1.toSafeJSON();
    if (safeObj.text !== 'This message was deleted' || safeObj.attachments.length !== 0) {
      throw new Error('toSafeJSON did not mask deleted message');
    }
    console.log('✓ Soft delete masked text correctly:', safeObj.text);

    console.log('8. Testing Group Model...');
    const group = await Group.create({
      name: 'Architecture Core',
      description: 'System architects group',
      conversation: conversation._id,
      members: [userA._id, userB._id],
      admins: [userA._id],
      createdBy: userA._id,
      inviteCode: 'ARCH-101',
    });
    if (!group.isAdmin(userA._id) || group.isAdmin(userB._id)) {
      throw new Error('Group isAdmin check failed');
    }
    console.log('✓ Group model verified. Admin check passed.');

    console.log('9. Testing Notification Model...');
    const notification = await Notification.create({
      recipient: userB._id,
      sender: userA._id,
      type: 'message',
      conversation: conversation._id,
      message: message2._id,
      content: 'Alice sent you a new message',
    });
    if (notification.isRead) throw new Error('New notification should be unread');
    console.log('✓ Notification model verified with ID:', notification._id);

    console.log('10. Testing Compound Index Query...');
    const messagesList = await Message.find({ conversation: conversation._id })
      .sort({ createdAt: -1 })
      .limit(10);
    if (messagesList.length !== 2) {
      throw new Error(`Expected 2 messages, found ${messagesList.length}`);
    }
    console.log(`✓ Compound index chronological query returned ${messagesList.length} messages`);

    // Clean up test records
    await Message.deleteMany({ conversation: conversation._id });
    await Group.deleteMany({ _id: group._id });
    await Notification.deleteMany({ _id: notification._id });
    await Conversation.deleteMany({ _id: conversation._id });
    await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
    console.log('✓ All test data cleaned up');

    await mongoose.disconnect();
    console.log('ALL MODEL TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('MODEL TEST FAILURE:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runModelTests();
