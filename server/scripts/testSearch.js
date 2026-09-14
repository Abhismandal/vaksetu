import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../app.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Group from '../models/Group.js';

dotenv.config();

const PORT = 5009;
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

const runSearchTests = async () => {
  console.log('=== STARTING SEARCH & FILTER TEST SUITE ===\n');

  try {
    // 1. Connect DB and Start Server
    console.log(`1. Connecting to DB and starting test server on port ${PORT}...`);
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aichatbot');
    await new Promise((resolve) => {
      server = app.listen(PORT, () => {
        console.log(`? Test server running on ${baseUrl}`);
        resolve();
      });
    });

    // Clean up any leftovers
    await User.deleteMany({ 
      $or: [
        { email: /search_test_/ },
        { username: { $in: ['alice_search', 'bob_search', 'charlie_search'] } }
      ]
    });

    // 2. Create Test Users
    console.log('2. Creating test users (Alice, Bob, Charlie)...');
    const registerUser = async (name, username, email) => {
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          username,
          email,
          password: 'Password123!',
        }),
      });
      if (!res.data.user || !res.data.token) {
        throw new Error(`Register failed for ${username}: ${JSON.stringify(res.data)}`);
      }
      return { user: res.data.user, token: res.data.token };
    };

    const alice = await registerUser('Alice Walker', 'alice_search', 'search_test_alice@example.com');
    const bob = await registerUser('Bob Builder', 'bob_search', 'search_test_bob@example.com');
    const charlie = await registerUser('Charlie Chaplin', 'charlie_search', 'search_test_charlie@example.com');
    console.log('✓ Created 3 test users');

    // 3. Test Unauthorized Access
    console.log('\n3. Testing Unauthorized Access to /api/search...');
    const unauthRes = await request('/api/search?q=hello');
    if (unauthRes.status === 401) {
      console.log('? 401 Unauthorized returned when no token provided');
    } else {
      throw new Error(`Expected 401, got ${unauthRes.status}`);
    }

    // 4. Test Empty Query
    console.log('\n4. Testing Empty Query Handling...');
    const emptyRes = await request('/api/search?q=', {
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    if (emptyRes.status === 200 && emptyRes.data.results.messages.length === 0) {
      console.log('? Empty query returned successfully with 0 results');
    } else {
      throw new Error('Empty query failed');
    }

    // 5. Create Conversations & Messages
    console.log('\n5. Creating Conversations and Messages...');
    // Alice & Bob direct conversation
    const directRes = await request('/api/conversations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alice.token}` },
      body: JSON.stringify({ recipientId: bob.user._id }),
    });
    if (!directRes.data.conversation?._id) {
      throw new Error(`Direct conversation creation failed: ${JSON.stringify(directRes)}`);
    }
    const directConvId = directRes.data.conversation._id;

    // Send messages in Alice-Bob chat
    const msg1 = await request('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alice.token}` },
      body: JSON.stringify({
        conversationId: directConvId,
        text: 'Hey Bob, let us schedule the project architecture kickoff meeting tomorrow!',
      }),
    });

    const msg2 = await request('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${bob.token}` },
      body: JSON.stringify({
        conversationId: directConvId,
        text: 'Sounds great Alice! I have prepared the database schema diagram.',
      }),
    });

    const secretMsg = await request('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alice.token}` },
      body: JSON.stringify({
        conversationId: directConvId,
        text: 'Here is the private vault key: vault_passcode_999888',
      }),
    });

    // Create Group Chat (Alice, Bob) - Charlie is NOT a member
    const groupRes = await request('/api/groups', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alice.token}` },
      body: JSON.stringify({
        name: 'Quantum Pioneers',
        description: 'Pioneering quantum algorithms and research',
        members: [bob.user._id],
      }),
    });
    const groupConvId = groupRes.data.conversation._id;

    await request('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alice.token}` },
      body: JSON.stringify({
        conversationId: groupConvId,
        text: 'Welcome everyone to the Quantum Pioneers research group!',
      }),
    });
    console.log('? Created 1 direct chat, 1 group chat, and 4 test messages');

    // 6. Test User / Directory Search
    console.log('\n6. Testing User Search (query: "Chaplin")...');
    const userSearchRes = await request('/api/search?q=Chaplin&type=users', {
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    if (
      userSearchRes.status === 200 &&
      userSearchRes.data.results.users.length === 1 &&
      userSearchRes.data.results.users[0].username === 'charlie_search'
    ) {
      console.log('? Found Charlie via user search');
    } else {
      throw new Error(`User search failed: ${JSON.stringify(userSearchRes.data)}`);
    }

    // 7. Test Conversation Search (by group name)
    console.log('\n7. Testing Conversation Search (query: "Quantum")...');
    const convSearchRes = await request('/api/search?q=Quantum&type=conversations', {
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    if (
      convSearchRes.status === 200 &&
      convSearchRes.data.results.conversations.length === 1 &&
      convSearchRes.data.results.conversations[0].name === 'Quantum Pioneers'
    ) {
      console.log('? Found "Quantum Pioneers" group conversation for Bob');
    } else {
      throw new Error(`Conversation search failed: ${JSON.stringify(convSearchRes.data)}`);
    }

    // 8. Test Global Message Search
    console.log('\n8. Testing Global Message Search (query: "architecture")...');
    const msgSearchRes = await request('/api/search?q=architecture', {
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    if (
      msgSearchRes.status === 200 &&
      msgSearchRes.data.results.messages.length === 1 &&
      msgSearchRes.data.results.messages[0].text.includes('architecture')
    ) {
      console.log('? Found matching message by keyword "architecture"');
    } else {
      throw new Error(`Message search failed: ${JSON.stringify(msgSearchRes.data)}`);
    }

    // 9. Privacy Check: Charlie must NOT see Alice & Bob messages
    console.log('\n9. Testing Privacy & Security (Charlie searching for "vault_passcode_999888")...');
    const privacyRes = await request('/api/search?q=vault_passcode_999888', {
      headers: { Authorization: `Bearer ${charlie.token}` },
    });
    if (
      privacyRes.status === 200 &&
      privacyRes.data.results.messages.length === 0 &&
      privacyRes.data.results.conversations.length === 0
    ) {
      console.log('? Privacy verified: Non-participant Charlie cannot see private chat messages');
    } else {
      throw new Error('Privacy violation: Charlie accessed private message!');
    }

    // 10. In-Conversation Scoped Search
    console.log('\n10. Testing Conversation-Scoped Search...');
    const inChatSearchRes = await request(
      `/api/search?q=kickoff&conversationId=${directConvId}`,
      { headers: { Authorization: `Bearer ${alice.token}` } }
    );
    if (
      inChatSearchRes.status === 200 &&
      inChatSearchRes.data.results.messages.length === 1 &&
      inChatSearchRes.data.results.messages[0].text.includes('kickoff')
    ) {
      console.log('? Scoped search successfully found message within specified conversation');
    } else {
      throw new Error('Scoped search failed');
    }

    // 11. Scoped Search Permission Check
    console.log('\n11. Testing Scoped Search Permission Rejection for non-member...');
    const unauthScopeRes = await request(
      `/api/search?q=kickoff&conversationId=${directConvId}`,
      { headers: { Authorization: `Bearer ${charlie.token}` } }
    );
    if (unauthScopeRes.status === 403) {
      console.log('? Correctly rejected non-member with 403 Forbidden');
    } else {
      throw new Error(`Expected 403 for non-member scoped search, got ${unauthScopeRes.status}`);
    }

    // Cleanup
    await User.deleteMany({ email: /search_test_/ });
    await Conversation.deleteMany({ _id: { $in: [directConvId, groupConvId] } });
    await Message.deleteMany({ conversation: { $in: [directConvId, groupConvId] } });
    await Group.deleteMany({ name: 'Quantum Pioneers' });
    console.log('? Cleaned up all test data');

    console.log('\n=============================================');
    console.log('ALL SEARCH & FILTER TESTS PASSED SUCCESSFULLY!');
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

runSearchTests();
