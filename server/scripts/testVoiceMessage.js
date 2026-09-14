import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import app from '../app.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

dotenv.config();

const PORT = 5013;
let server;
let baseUrl = `http://localhost:${PORT}`;

const request = async (path, options = {}) => {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
};

const runVoiceMessageTests = async () => {
  console.log('=== STARTING VOICE MESSAGES TEST SUITE ===\n');

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

    // Clean up previous test users
    await User.deleteMany({ email: { $in: ['voice_user1@example.com', 'voice_user2@example.com'] } });

    // 2. Register two test users
    console.log('\n2. Registering test users...');
    const regRes1 = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Voice Sender',
        username: 'voice_sender',
        email: 'voice_user1@example.com',
        password: 'Password123!',
      }),
    });
    const user1 = regRes1.data.user;
    const token1 = regRes1.data.token;

    const regRes2 = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Voice Receiver',
        username: 'voice_receiver',
        email: 'voice_user2@example.com',
        password: 'Password123!',
      }),
    });
    const user2 = regRes2.data.user;

    console.log('? Registered voice users: Sender & Receiver');

    // 3. Create conversation
    console.log('\n3. Creating 1-on-1 conversation...');
    const convRes = await request('/api/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({ recipientId: user2._id }),
    });
    const convId = convRes.data.conversation._id;
    console.log('? Conversation created, ID:', convId);

    // 4. Test uploading simulated voice audio file
    console.log('\n4. Testing Voice Audio File Upload (/api/upload)...');
    const fakeAudioBuffer = Buffer.from('RIFF....WAVEfmt ....data....FAKE_AUDIO_BYTES_TEST');
    const blob = new Blob([fakeAudioBuffer], { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', blob, 'voice-recording-12s.webm');

    const uploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token1}`,
      },
      body: formData,
    });
    const uploadData = await uploadRes.json();
    if (uploadRes.status === 201 && uploadData.success && uploadData.file?.url) {
      console.log('? Audio file uploaded successfully:');
      console.log(`  URL: ${uploadData.file.url}`);
      console.log(`  MIME: ${uploadData.file.type}`);
    } else {
      throw new Error(`Upload failed: ${JSON.stringify(uploadData)}`);
    }

    const audioUrl = uploadData.file.url;
    const audioFilename = uploadData.file.filename;

    // 5. Send Voice Message
    console.log('\n5. Testing Sending Voice Message (messageType: voice)...');
    const msgRes = await request('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        conversationId: convId,
        text: '??? Voice message (0:12)',
        messageType: 'voice',
        attachments: [
          {
            url: audioUrl,
            name: 'voice-recording-12s.webm',
            type: 'audio/webm',
            size: fakeAudioBuffer.length,
            duration: 12, // 12 seconds
          },
        ],
      }),
    });

    if (msgRes.status === 201 && msgRes.data.success && msgRes.data.message) {
      const saved = msgRes.data.message;
      console.log('? Voice message sent and saved to DB:');
      console.log(`  ID: ${saved._id}`);
      console.log(`  Type: ${saved.messageType}`);
      console.log(`  Duration: ${saved.attachments[0]?.duration}s`);
      console.log(`  Audio URL: ${saved.attachments[0]?.url}`);
    } else {
      throw new Error(`Sending voice message failed: ${JSON.stringify(msgRes.data)}`);
    }

    // 6. Retrieve conversation messages
    console.log('\n6. Testing Retrieving Voice Message from Conversation History...');
    const getRes = await request(`/api/conversations/${convId}/messages`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token1}`,
      },
    });

    if (getRes.status === 200 && Array.isArray(getRes.data.messages)) {
      const found = getRes.data.messages.find((m) => m.messageType === 'voice');
      if (found && found.attachments?.[0]?.duration === 12) {
        console.log('? Successfully retrieved voice message with intact duration metadata');
      } else {
        throw new Error('Voice message not found or missing metadata');
      }
    } else {
      throw new Error(`Failed to retrieve messages: ${JSON.stringify(getRes.data)}`);
    }

    // 7. Cleanup uploaded file on disk
    if (audioFilename) {
      const filePath = path.resolve('uploads', audioFilename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('? Cleaned up test audio file from uploads directory');
      }
    }

    console.log('\n=============================================');
    console.log('?? ALL STEP 16 VOICE MESSAGE TESTS PASSED! ??');
    console.log('=============================================\n');
  } catch (error) {
    console.error('\n? Test suite encountered an error:', error);
    process.exitCode = 1;
  } finally {
    try {
      await User.deleteMany({ email: { $in: ['voice_user1@example.com', 'voice_user2@example.com'] } });
      await Message.deleteMany({ text: /Voice message/ });
      await Conversation.deleteMany({ name: 'Voice Receiver' });
    } catch (_) {}
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
  }
};

runVoiceMessageTests();
