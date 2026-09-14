import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../app.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

dotenv.config();

const PORT = 5011;
let server;
let baseUrl = `http://localhost:${PORT}`;

const request = async (path, options = {}) => {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
};

const runAITests = async () => {
  console.log('=== STARTING AI ASSISTANT & STREAMING TEST SUITE ===\n');

  try {
    // 1. Connect DB and start server
    console.log(`1. Connecting to DB and starting test server on port ${PORT}...`);
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aichatbot');
    await new Promise((resolve) => {
      server = app.listen(PORT, () => {
        console.log(`? Test server running on ${baseUrl}`);
        resolve();
      });
    });

    // Clean up test user
    await User.deleteMany({ email: 'ai_test_user@example.com' });
    await Conversation.deleteMany({ isAi: true });

    // 2. Register test user
    console.log('2. Registering test user...');
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'AI Test User',
        username: 'ai_test_user',
        email: 'ai_test_user@example.com',
        password: 'Password123!',
      }),
    });
    const { user, token } = regRes.data;
    console.log('? Registered test user');

    // 3. Unauthorized access check
    console.log('\n3. Testing Unauthorized Access to /api/ai/chat...');
    const unauthRes = await request('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello AI' }),
    });
    if (unauthRes.status === 401) {
      console.log('? 401 returned for unauthorized request');
    } else {
      throw new Error(`Expected 401, got ${unauthRes.status}`);
    }

    // 4. Get or Create AI Conversation
    console.log('\n4. Testing GET /api/ai/conversation...');
    const convRes = await request('/api/ai/conversation', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (convRes.status === 200 && convRes.data.conversation?.isAi) {
      console.log('? Retrieved AI Conversation, ID:', convRes.data.conversation._id);
    } else {
      throw new Error('Failed to get AI conversation');
    }
    const aiConvId = convRes.data.conversation._id;

    // 5. Standard AI Chat (non-streaming)
    console.log('\n5. Testing Standard AI Chat (POST /api/ai/chat)...');
    const chatRes = await request('/api/ai/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        message: 'Write a quick React hook for debouncing input',
        conversationId: aiConvId,
      }),
    });
    if (chatRes.status === 200 && chatRes.data.content && chatRes.data.content.length > 20) {
      console.log('? Received AI response (length:', chatRes.data.content.length, 'chars)');
      console.log('  Model:', chatRes.data.model);
    } else {
      throw new Error(`AI Chat response failed: ${JSON.stringify(chatRes.data)}`);
    }

    // 6. SSE Streaming AI Chat
    console.log('\n6. Testing SSE Streaming AI Chat (POST /api/ai/chat with stream: true)...');
    const streamRes = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: 'Explain how Node.js event loop handles microtasks vs macrotasks',
        conversationId: aiConvId,
        stream: true,
      }),
    });

    if (streamRes.status !== 200) {
      throw new Error(`Stream request failed with status ${streamRes.status}`);
    }

    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    let streamOutput = '';
    let receivedDone = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      streamOutput += text;
      if (text.includes('[DONE]')) {
        receivedDone = true;
      }
    }

    if (receivedDone && streamOutput.includes('data:')) {
      console.log('? SSE Stream received successfully with [DONE] terminator');
    } else {
      throw new Error('SSE stream did not complete properly');
    }

    // 7. Verify Message Persistence
    console.log('\n7. Verifying Message Persistence in Database...');
    const savedMessages = await Message.find({ conversation: aiConvId });
    if (savedMessages.length >= 2) {
      console.log('? Found', savedMessages.length, 'saved messages in AI conversation');
    } else {
      throw new Error(`Expected at least 2 saved messages, found ${savedMessages.length}`);
    }

    // Cleanup
    await User.deleteMany({ email: 'ai_test_user@example.com' });
    await Conversation.deleteMany({ _id: aiConvId });
    await Message.deleteMany({ conversation: aiConvId });
    console.log('? Cleaned up all test data');

    console.log('\n=============================================');
    console.log('ALL AI ASSISTANT & STREAMING TESTS PASSED!');
    console.log('=============================================\n');
  } catch (error) {
    console.error('Test Suite Failed:', error);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    process.exit(process.exitCode || 0);
  }
};

runAITests();
