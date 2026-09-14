import http from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../app.js';
import { initSocket } from '../sockets/index.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { generateToken } from '../utils/jwt.js';

dotenv.config();

const PORT = 5005;
let server;
let ioServer;

async function runPresenceTypingTests() {
  try {
    console.log('1. Connecting to DB and starting test server on port', PORT);
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aichatbot');

    server = http.createServer(app);
    ioServer = new Server(server, { cors: { origin: '*' } });
    initSocket(ioServer);
    app.set('io', ioServer);

    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`✓ Server listening on http://localhost:${PORT}`);

    // Cleanup previous test users
    await User.deleteMany({ email: { $in: ['pt_user_a@example.com', 'pt_user_b@example.com'] } });

    console.log('2. Creating users User A & User B and conversation...');
    const userA = await User.create({
      name: 'Presence User A',
      username: 'presence_a',
      email: 'pt_user_a@example.com',
      password: 'password123',
    });
    const tokenA = generateToken(userA._id);

    const userB = await User.create({
      name: 'Presence User B',
      username: 'presence_b',
      email: 'pt_user_b@example.com',
      password: 'password123',
    });
    const tokenB = generateToken(userB._id);

    const conversation = await Conversation.create({
      participants: [userA._id, userB._id],
      isGroup: false,
    });
    const convId = conversation._id.toString();
    console.log('✓ Users and conversation created');

    console.log('3. Connecting User A via Socket.IO...');
    let initialOnlineList = null;
    const socketA = Client(`http://localhost:${PORT}`, {
      auth: { token: tokenA },
      transports: ['websocket'],
    });

    await new Promise((resolve) => {
      socketA.on('online_users', (list) => {
        initialOnlineList = list;
        resolve();
      });
    });

    if (!initialOnlineList || !initialOnlineList.includes(userA._id.toString())) {
      throw new Error('User A failed to receive online_users event');
    }
    console.log('✓ User A received online_users list including self');

    console.log('4. Connecting User B and testing Presence Broadcast...');
    let userBStatusBroadcast = null;
    const statusPromise = new Promise((resolve) => {
      socketA.on('user_status', (status) => {
        if (status.userId === userB._id.toString()) {
          userBStatusBroadcast = status;
          resolve();
        }
      });
    });

    const socketB = Client(`http://localhost:${PORT}`, {
      auth: { token: tokenB },
      transports: ['websocket'],
    });

    await statusPromise;
    if (!userBStatusBroadcast || !userBStatusBroadcast.isOnline) {
      throw new Error('User A did not receive User B online broadcast');
    }
    console.log('✓ User A received user_status broadcast: User B is online');

    // Join conversation rooms
    socketA.emit('join_conversation', convId);
    socketB.emit('join_conversation', convId);
    await new Promise((r) => setTimeout(r, 200));

    console.log('5. Testing Typing Start (typing_start -> user_typing)...');
    let typingReceived = null;
    const typingPromise = new Promise((resolve) => {
      socketB.on('user_typing', (data) => {
        typingReceived = data;
        resolve();
      });
    });

    socketA.emit('typing_start', { conversationId: convId });
    await typingPromise;
    if (!typingReceived || typingReceived.userId !== userA._id.toString()) {
      throw new Error('User B failed to receive user_typing');
    }
    console.log('✓ User B received user_typing event from User A');

    console.log('6. Testing Typing Stop (typing_stop -> user_stop_typing)...');
    let stopTypingReceived = null;
    const stopTypingPromise = new Promise((resolve) => {
      socketB.on('user_stop_typing', (data) => {
        stopTypingReceived = data;
        resolve();
      });
    });

    socketA.emit('typing_stop', { conversationId: convId });
    await stopTypingPromise;
    if (!stopTypingReceived || stopTypingReceived.userId !== userA._id.toString()) {
      throw new Error('User B failed to receive user_stop_typing');
    }
    console.log('✓ User B received user_stop_typing event');

    console.log('7. Testing Message Delivery & Read Receipts (mark_messages_read -> messages_read)...');
    let newMsg = null;
    const newMsgPromise = new Promise((resolve) => {
      socketB.on('new_message', (msg) => {
        newMsg = msg;
        resolve();
      });
    });

    socketA.emit('send_message', {
      conversationId: convId,
      text: 'Read receipt test message',
    });

    await newMsgPromise;
    console.log('✓ User B received message, now marking as read...');

    let readReceiptReceived = null;
    const readPromise = new Promise((resolve) => {
      socketA.on('messages_read', (data) => {
        readReceiptReceived = data;
        resolve();
      });
    });

    socketB.emit('mark_messages_read', { conversationId: convId });
    await readPromise;
    if (!readReceiptReceived || readReceiptReceived.readerId !== userB._id.toString()) {
      throw new Error('User A failed to receive messages_read event');
    }
    console.log('✓ User A received messages_read event from User B');

    // Verify DB update
    const dbMsg = await Message.findById(newMsg._id);
    const hasUserBRead = dbMsg.readBy.some((r) => r.user.toString() === userB._id.toString());
    if (!hasUserBRead) {
      throw new Error('Database readBy array does not contain User B');
    }
    console.log('✓ Database readBy array confirmed updated');

    console.log('8. Testing Offline Status Broadcast on Disconnect...');
    let offlineBroadcast = null;
    const offlinePromise = new Promise((resolve) => {
      socketA.on('user_status', (status) => {
        if (status.userId === userB._id.toString() && !status.isOnline) {
          offlineBroadcast = status;
          resolve();
        }
      });
    });

    socketB.disconnect();
    await offlinePromise;
    if (!offlineBroadcast || offlineBroadcast.isOnline !== false) {
      throw new Error('User A failed to receive offline status broadcast');
    }
    console.log('✓ User A received offline status broadcast for User B');

    // Clean up
    socketA.disconnect();
    await Message.deleteMany({ conversation: convId });
    await Conversation.deleteMany({ _id: convId });
    await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
    console.log('✓ Cleaned up all test data');

    server.close();
    await mongoose.disconnect();
    console.log('ALL PRESENCE, TYPING, AND READ RECEIPT TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('TEST FAILURE:', err);
    if (server) server.close();
    await mongoose.disconnect();
    process.exit(1);
  }
}

runPresenceTypingTests();
