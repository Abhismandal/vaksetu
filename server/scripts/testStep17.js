import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../app.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

dotenv.config();

const PORT = 5014;
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

const runStep17Tests = async () => {
  console.log('=== STARTING STEP 17: PINNING, STARRED & MEDIA GALLERY TESTS ===\n');

  try {
    // 1. Connect DB and start test server
    console.log(`1. Connecting to DB and starting test server on port ${PORT}...`);
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aichatbot');
    await new Promise((resolve) => {
      server = app.listen(PORT, () => {
        console.log(`? Test server running on ${baseUrl}`);
        resolve();
      });
    });

    // Cleanup test users
    await User.deleteMany({ email: { $in: ['step17_user1@example.com', 'step17_user2@example.com'] } });

    // 2. Register test users
    console.log('\n2. Registering test users...');
    const regRes1 = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Step17 User One',
        username: 'step17_user1',
        email: 'step17_user1@example.com',
        password: 'Password123!',
      }),
    });
    const user1 = regRes1.data.user;
    const token1 = regRes1.data.token;

    const regRes2 = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Step17 User Two',
        username: 'step17_user2',
        email: 'step17_user2@example.com',
        password: 'Password123!',
      }),
    });
    const user2 = regRes2.data.user;
    console.log('? Registered test users');

    // 3. Create conversation
    console.log('\n3. Creating conversation...');
    const convRes = await request('/api/conversations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ recipientId: user2._id }),
    });
    const convId = convRes.data.conversation._id;
    console.log('? Conversation created, ID:', convId);

    // 4. Send messages with attachments, links, and text
    console.log('\n4. Sending messages (Media, Docs, Voice, Links)...');
    
    // Message 1: Image attachment
    const msg1Res = await request('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        conversationId: convId,
        text: 'Here is the project mockups image',
        attachments: [
          {
            url: 'http://localhost:5000/uploads/design-mockup.png',
            name: 'design-mockup.png',
            type: 'image/png',
            size: 1048576,
          },
        ],
      }),
    });
    const msg1Id = msg1Res.data.message._id;

    // Message 2: Document attachment
    const msg2Res = await request('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        conversationId: convId,
        text: 'Check the specifications PDF doc',
        attachments: [
          {
            url: 'http://localhost:5000/uploads/specs.pdf',
            name: 'specs.pdf',
            type: 'application/pdf',
            size: 2048576,
          },
        ],
      }),
    });
    const msg2Id = msg2Res.data.message._id;

    // Message 3: Text with link
    const msg3Res = await request('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        conversationId: convId,
        text: 'Refer to our repository docs at https://github.com/project/repo and deployment guide at https://example.com/deploy',
      }),
    });
    const msg3Id = msg3Res.data.message._id;

    // Message 4: Voice message
    const msg4Res = await request('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        conversationId: convId,
        text: '??? Voice message (0:15)',
        messageType: 'voice',
        attachments: [
          {
            url: 'http://localhost:5000/uploads/voice-note.webm',
            name: 'voice-note.webm',
            type: 'audio/webm',
            duration: 15,
          },
        ],
      }),
    });
    const msg4Id = msg4Res.data.message._id;
    console.log('? Sent test messages with diverse attachment types');

    // 5. Test Pinning Message
    console.log('\n5. Testing Message Pinning (PUT /api/messages/:id/pin)...');
    const pinRes = await request(`/api/messages/${msg2Id}/pin`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token1}` },
    });
    if (pinRes.status === 200 && pinRes.data.pinned === true) {
      console.log('? Successfully pinned message', msg2Id);
    } else {
      throw new Error(`Pin failed: ${JSON.stringify(pinRes.data)}`);
    }

    // 6. Test Fetching Pinned Messages
    console.log('\n6. Testing Fetching Pinned Messages (GET /api/messages/pinned/:conversationId)...');
    const getPinnedRes = await request(`/api/messages/pinned/${convId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token1}` },
    });
    if (getPinnedRes.status === 200 && getPinnedRes.data.count === 1 && getPinnedRes.data.messages[0]._id === msg2Id) {
      console.log('? Retrieved pinned message with correct ID');
    } else {
      throw new Error(`Get pinned failed: ${JSON.stringify(getPinnedRes.data)}`);
    }

    // 7. Test Starring Message
    console.log('\n7. Testing Starring Message (POST /api/messages/:id/star)...');
    const starRes1 = await request(`/api/messages/${msg1Id}/star`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
    });
    if (starRes1.status === 200 && starRes1.data.isStarred === true) {
      console.log('? Message 1 starred by user 1');
    } else {
      throw new Error(`Star failed: ${JSON.stringify(starRes1.data)}`);
    }

    const starRes3 = await request(`/api/messages/${msg3Id}/star`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
    });
    if (starRes3.status === 200 && starRes3.data.isStarred === true) {
      console.log('? Message 3 starred by user 1');
    } else {
      throw new Error(`Star 3 failed: ${JSON.stringify(starRes3.data)}`);
    }

    // 8. Test Fetching Starred Messages
    console.log('\n8. Testing Fetching Starred Messages (GET /api/messages/starred)...');
    const getStarredRes = await request('/api/messages/starred', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token1}` },
    });
    if (getStarredRes.status === 200 && getStarredRes.data.count === 2) {
      console.log('? Retrieved 2 starred messages for user 1');
      console.log('  Sender populated:', getStarredRes.data.messages[0].sender?.name);
    } else {
      throw new Error(`Get starred failed: ${JSON.stringify(getStarredRes.data)}`);
    }

    // 9. Test Unstarring Message
    console.log('\n9. Testing Unstarring Message (POST /api/messages/:id/star)...');
    const unstarRes = await request(`/api/messages/${msg1Id}/star`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
    });
    if (unstarRes.status === 200 && unstarRes.data.isStarred === false) {
      console.log('? Message 1 successfully unstarred');
    } else {
      throw new Error(`Unstar failed: ${JSON.stringify(unstarRes.data)}`);
    }

    // 10. Test Shared Media Gallery
    console.log('\n10. Testing Shared Media Gallery (GET /api/messages/media/:conversationId)...');
    const mediaRes = await request(`/api/messages/media/${convId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token1}` },
    });
    if (mediaRes.status === 200 && mediaRes.data.counts) {
      const { counts } = mediaRes.data;
      console.log('? Shared media gallery categorized:');
      console.log(`  - Media (Images/Videos): ${counts.media}`);
      console.log(`  - Documents: ${counts.docs}`);
      console.log(`  - Audio/Voice: ${counts.audio}`);
      console.log(`  - Links: ${counts.links}`);

      if (counts.media >= 1 && counts.docs >= 1 && counts.audio >= 1 && counts.links >= 2) {
        console.log('? All categories verified with expected counts');
      } else {
        throw new Error(`Unexpected category counts: ${JSON.stringify(counts)}`);
      }
    } else {
      throw new Error(`Media gallery failed: ${JSON.stringify(mediaRes.data)}`);
    }

    console.log('\n========================================================');
    console.log('?? ALL STEP 17 PINNING, STARRED & MEDIA TESTS PASSED! ??');
    console.log('========================================================\n');
  } catch (error) {
    console.error('\n? Test suite encountered an error:', error);
    process.exitCode = 1;
  } finally {
    try {
      await User.deleteMany({ email: { $in: ['step17_user1@example.com', 'step17_user2@example.com'] } });
      await Message.deleteMany({ text: { $in: ['Here is the project mockups image', 'Check the specifications PDF doc'] } });
    } catch (_) {}
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
  }
};

runStep17Tests();
