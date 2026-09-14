import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';
import app from '../app.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

dotenv.config();

const PORT = 5003;
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

async function runChatAPITests() {
  try {
    console.log('1. Starting test server on port', PORT);
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aichatbot');
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`✓ Test server running on http://localhost:${PORT}`);

    // Cleanup previous test users
    await User.deleteMany({ email: { $in: ['chat_api_u1@example.com', 'chat_api_u2@example.com'] } });

    console.log('2. Registering two test users...');
    const u1Res = await apiRequest('/api/auth/register', 'POST', {
      name: 'Chat User One',
      username: 'chat_api_u1',
      email: 'chat_api_u1@example.com',
      password: 'password123',
    });
    const token1 = u1Res.data.token;
    const user1 = u1Res.data.user;

    const u2Res = await apiRequest('/api/auth/register', 'POST', {
      name: 'Chat User Two',
      username: 'chat_api_u2',
      email: 'chat_api_u2@example.com',
      password: 'password123',
    });
    const token2 = u2Res.data.token;
    const user2 = u2Res.data.user;
    console.log('✓ Created User 1 and User 2 with JWT tokens');

    console.log('3. Testing User Search (GET /api/users?search=chat_api_u2)...');
    const searchRes = await apiRequest('/api/users?search=chat_api_u2', 'GET', null, token1);
    if (searchRes.status !== 200 || searchRes.data.users.length === 0) {
      throw new Error(`User search failed: ${JSON.stringify(searchRes.data)}`);
    }
    console.log('✓ Found User 2 via search endpoint');

    console.log('4. Testing Start Conversation (POST /api/conversations)...');
    const convRes = await apiRequest('/api/conversations', 'POST', { recipientId: user2._id }, token1);
    if (convRes.status !== 200 || !convRes.data.conversation?._id) {
      throw new Error(`Create conversation failed: ${JSON.stringify(convRes.data)}`);
    }
    const conversationId = convRes.data.conversation._id;
    console.log('✓ Conversation created with ID:', conversationId);

    console.log('5. Testing Send Message (POST /api/messages)...');
    const sendRes = await apiRequest(
      '/api/messages',
      'POST',
      {
        conversationId,
        text: 'Hello User 2! Welcome to real-time chat.',
      },
      token1
    );
    if (sendRes.status !== 201 || !sendRes.data.message?._id) {
      throw new Error(`Send message failed: ${JSON.stringify(sendRes.data)}`);
    }
    const message1Id = sendRes.data.message._id;
    console.log('✓ Message 1 sent by User 1 with ID:', message1Id);

    console.log('6. Verifying Conversation List for User 2 (GET /api/conversations)...');
    const u2ConvList = await apiRequest('/api/conversations', 'GET', null, token2);
    if (u2ConvList.status !== 200 || u2ConvList.data.conversations.length === 0) {
      throw new Error(`User 2 conversations empty: ${JSON.stringify(u2ConvList.data)}`);
    }
    const targetConvForU2 = u2ConvList.data.conversations.find((c) => c._id === conversationId);
    if (!targetConvForU2 || targetConvForU2.unreadCount !== 1) {
      throw new Error(`Expected unreadCount to be 1, got ${targetConvForU2?.unreadCount}`);
    }
    console.log('✓ User 2 received conversation with unreadCount = 1');

    console.log('7. Testing Get Messages with Pagination (GET /api/conversations/:id/messages)...');
    const getMsgsRes = await apiRequest(`/api/conversations/${conversationId}/messages?page=1&limit=20`, 'GET', null, token2);
    if (getMsgsRes.status !== 200 || getMsgsRes.data.messages.length !== 1) {
      throw new Error(`Get messages failed: ${JSON.stringify(getMsgsRes.data)}`);
    }
    console.log('✓ User 2 fetched message list successfully and reset unread count');

    console.log('8. Testing Reply to Message (POST /api/messages with replyTo)...');
    const replyRes = await apiRequest(
      '/api/messages',
      'POST',
      {
        conversationId,
        text: 'Hello User 1! Reply received.',
        replyTo: message1Id,
      },
      token2
    );
    if (replyRes.status !== 201 || !replyRes.data.message.replyTo) {
      throw new Error(`Reply failed: ${JSON.stringify(replyRes.data)}`);
    }
    console.log('✓ User 2 successfully sent reply message linked to Message 1');

    console.log('9. Testing Edit Message (PUT /api/messages/:id)...');
    const editRes = await apiRequest(
      `/api/messages/${message1Id}`,
      'PUT',
      { text: 'Hello User 2! (Edited version)' },
      token1
    );
    if (editRes.status !== 200 || editRes.data.message.text !== 'Hello User 2! (Edited version)' || !editRes.data.message.isEdited) {
      throw new Error(`Edit message failed: ${JSON.stringify(editRes.data)}`);
    }
    console.log('✓ User 1 edited Message 1 (isEdited = true)');

    console.log('10. Testing React to Message (POST /api/messages/:id/reactions)...');
    const reactRes = await apiRequest(`/api/messages/${message1Id}/reactions`, 'POST', { emoji: '🔥' }, token2);
    if (reactRes.status !== 200 || reactRes.data.reactions.length !== 1) {
      throw new Error(`Reaction failed: ${JSON.stringify(reactRes.data)}`);
    }
    console.log('✓ User 2 added 🔥 reaction to Message 1');

    console.log('11. Testing Toggle Pin Message (PUT /api/messages/:id/pin)...');
    const pinMsgRes = await apiRequest(`/api/messages/${message1Id}/pin`, 'PUT', null, token1);
    if (pinMsgRes.status !== 200 || !pinMsgRes.data.pinned) {
      throw new Error(`Pin message failed: ${JSON.stringify(pinMsgRes.data)}`);
    }
    console.log('✓ Message 1 pinned successfully');

    console.log('12. Testing Soft Delete Message (DELETE /api/messages/:id)...');
    const delMsgRes = await apiRequest(`/api/messages/${message1Id}`, 'DELETE', null, token1);
    if (delMsgRes.status !== 200 || delMsgRes.data.message.text !== 'This message was deleted') {
      throw new Error(`Delete message failed: ${JSON.stringify(delMsgRes.data)}`);
    }
    console.log('✓ Message 1 soft-deleted; displays "This message was deleted"');

    console.log('13. Testing Toggle Pin Conversation (PUT /api/conversations/:id/pin)...');
    const pinConvRes = await apiRequest(`/api/conversations/${conversationId}/pin`, 'PUT', null, token1);
    if (pinConvRes.status !== 200 || !pinConvRes.data.pinned) {
      throw new Error(`Pin conversation failed: ${JSON.stringify(pinConvRes.data)}`);
    }
    console.log('✓ Conversation pinned for User 1');

    // Clean up
    await Message.deleteMany({ conversation: conversationId });
    await Conversation.deleteMany({ _id: conversationId });
    await User.deleteMany({ _id: { $in: [user1._id, user2._id] } });
    console.log('✓ Cleaned up all test records');

    server.close();
    await mongoose.disconnect();
    console.log('ALL CHAT REST API TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('CHAT API TEST FAILURE:', err);
    if (server) server.close();
    await mongoose.disconnect();
    process.exit(1);
  }
}

runChatAPITests();
