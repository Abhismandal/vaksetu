import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';
import app from '../app.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

dotenv.config();

const PORT = 5006;
let server;

const apiRequest = async (path, method = 'GET', body = null, token = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`http://localhost:${PORT}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json();
  return { status: res.status, data };
};

async function runStep9Tests() {
  try {
    console.log('1. Starting test server on port', PORT);
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aichatbot');
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`✓ Test server running on http://localhost:${PORT}`);

    // Cleanup previous test users
    await User.deleteMany({ email: { $in: ['step9_u1@example.com', 'step9_u2@example.com', 'step9_u3@example.com'] } });

    console.log('2. Registering test users...');
    const u1Res = await apiRequest('/api/auth/register', 'POST', {
      name: 'Step9 User One',
      username: 'step9_u1',
      email: 'step9_u1@example.com',
      password: 'password123',
    });
    const token1 = u1Res.data.token;
    const user1 = u1Res.data.user;

    const u2Res = await apiRequest('/api/auth/register', 'POST', {
      name: 'Step9 User Two',
      username: 'step9_u2',
      email: 'step9_u2@example.com',
      password: 'password123',
    });
    const token2 = u2Res.data.token;
    const user2 = u2Res.data.user;

    const u3Res = await apiRequest('/api/auth/register', 'POST', {
      name: 'Step9 User Three',
      username: 'step9_u3',
      email: 'step9_u3@example.com',
      password: 'password123',
    });
    const token3 = u3Res.data.token;
    const user3 = u3Res.data.user;
    console.log('✓ Created User 1, User 2, and User 3');

    // Create Conversation between U1 and U2
    const convRes = await apiRequest('/api/conversations', 'POST', { recipientId: user2._id }, token1);
    const convId = convRes.data.conversation._id;
    console.log('✓ Created Conversation 1-2 with ID:', convId);

    // Send 3 messages
    const msg1Res = await apiRequest('/api/messages', 'POST', { conversationId: convId, text: 'Message 1 to be edited' }, token1);
    const msg2Res = await apiRequest('/api/messages', 'POST', { conversationId: convId, text: 'Message 2 to be forwarded' }, token1);
    const msg3Res = await apiRequest('/api/messages', 'POST', { conversationId: convId, text: 'Message 3 to be deleted' }, token1);

    const m1Id = msg1Res.data.message._id;
    const m2Id = msg2Res.data.message._id;
    const m3Id = msg3Res.data.message._id;
    console.log('✓ Sent 3 messages from User 1');

    // Test Edit Message
    console.log('3. Testing Message Edit...');
    const editRes = await apiRequest(`/api/messages/${m1Id}`, 'PUT', { text: 'Message 1 Edited Successfully' }, token1);
    if (!editRes.data.success || !editRes.data.message.isEdited || editRes.data.message.text !== 'Message 1 Edited Successfully') {
      throw new Error('Message edit verification failed');
    }
    console.log('✓ Message 1 edited with isEdited = true');

    // Test Reaction
    console.log('4. Testing Message Reaction...');
    const reactRes = await apiRequest(`/api/messages/${m2Id}/reactions`, 'POST', { emoji: '❤️' }, token2);
    if (!reactRes.data.success || !reactRes.data.reactions.some(r => r.emoji === '❤️')) {
      throw new Error('Reaction failed');
    }
    console.log('✓ Reaction added to Message 2');

    // Test Pin
    console.log('5. Testing Message Pin...');
    const pinRes = await apiRequest(`/api/messages/${m2Id}/pin`, 'PUT', {}, token1);
    if (!pinRes.data.success || !pinRes.data.pinned) {
      throw new Error('Pin failed');
    }
    console.log('✓ Message 2 pinned successfully');

    // Test Batch Delete (m1 and m3)
    console.log('6. Testing Batch Delete (POST /api/messages/batch-delete)...');
    const batchRes = await apiRequest('/api/messages/batch-delete', 'POST', { messageIds: [m1Id, m3Id] }, token1);
    if (!batchRes.data.success || (batchRes.data.modifiedCount !== 2 && batchRes.data.deletedCount !== 2)) {
      throw new Error(`Batch delete failed: ${JSON.stringify(batchRes.data)}`);
    }
    console.log(`✓ Batch deleted ${batchRes.data.modifiedCount || batchRes.data.deletedCount} messages`);

    // Verify Messages as User 2
    const fetchRes = await apiRequest(`/api/conversations/${convId}/messages`, 'GET', null, token2);
    const msgs = fetchRes.data.messages;
    const m1 = msgs.find(m => m._id === m1Id);
    const m2 = msgs.find(m => m._id === m2Id);
    const m3 = msgs.find(m => m._id === m3Id);

    if (!m1.isDeleted || m1.text !== 'This message was deleted') {
      throw new Error('Message 1 soft delete status not reflected');
    }
    if (!m3.isDeleted || m3.text !== 'This message was deleted') {
      throw new Error('Message 3 soft delete status not reflected');
    }
    if (m2.isDeleted || !m2.pinned) {
      throw new Error('Message 2 state unexpected');
    }
    console.log('✓ Messages soft-delete and pin states verified in list');

    // Test Forward Message 2 to Conversation 1-3
    console.log('7. Testing Forward Message 2 to another conversation...');
    const conv13Res = await apiRequest('/api/conversations', 'POST', { recipientId: user3._id }, token1);
    const conv13Id = conv13Res.data.conversation._id;
    const forwardMsgRes = await apiRequest('/api/messages', 'POST', { conversationId: conv13Id, text: m2.text }, token1);
    if (!forwardMsgRes.data.success || forwardMsgRes.data.message.text !== m2.text) {
      throw new Error('Forward message send failed');
    }
    console.log('✓ Message 2 successfully forwarded to User 3 chat');

    // Cleanup
    await User.deleteMany({ email: { $in: ['step9_u1@example.com', 'step9_u2@example.com', 'step9_u3@example.com'] } });
    await Conversation.deleteMany({ _id: { $in: [convId, conv13Id] } });
    await Message.deleteMany({ conversation: { $in: [convId, conv13Id] } });
    console.log('✓ Cleaned up test data');

    console.log('ALL STEP 9 MESSAGE ACTIONS TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runStep9Tests();
