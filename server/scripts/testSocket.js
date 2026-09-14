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

const PORT = 5004;
let server;
let ioServer;

async function runSocketTests() {
  try {
    console.log('1. Connecting to DB and starting Socket.IO test server on port', PORT);
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aichatbot');
    
    server = http.createServer(app);
    ioServer = new Server(server, {
      cors: { origin: '*' },
    });
    initSocket(ioServer);
    app.set('io', ioServer);

    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`✓ Socket test server active on http://localhost:${PORT}`);

    // Cleanup previous test users
    await User.deleteMany({ email: { $in: ['socket_u1@example.com', 'socket_u2@example.com'] } });

    console.log('2. Creating two test users and conversation...');
    const user1 = await User.create({
      name: 'Socket User One',
      username: 'socket_u1',
      email: 'socket_u1@example.com',
      password: 'password123',
    });
    const token1 = generateToken(user1._id);

    const user2 = await User.create({
      name: 'Socket User Two',
      username: 'socket_u2',
      email: 'socket_u2@example.com',
      password: 'password123',
    });
    const token2 = generateToken(user2._id);

    const conversation = await Conversation.create({
      participants: [user1._id, user2._id],
      isGroup: false,
    });
    const convId = conversation._id.toString();
    console.log('✓ Users and conversation ready');

    console.log('3. Connecting User 1 and User 2 via Socket.IO Client...');
    const socket1 = Client(`http://localhost:${PORT}`, {
      auth: { token: token1 },
      transports: ['websocket'],
    });

    const socket2 = Client(`http://localhost:${PORT}`, {
      auth: { token: token2 },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise((resolve) => socket1.on('connect', resolve)),
      new Promise((resolve) => socket2.on('connect', resolve)),
    ]);
    console.log('✓ Both clients connected successfully with JWT auth');

    console.log('4. Joining conversation room...');
    socket1.emit('join_conversation', convId);
    socket2.emit('join_conversation', convId);
    await new Promise((r) => setTimeout(r, 200));

    console.log('5. Testing Real-Time Send & Receive (send_message -> new_message)...');
    let receivedMessageByU2 = null;
    const msgPromise = new Promise((resolve) => {
      socket2.on('new_message', (msg) => {
        receivedMessageByU2 = msg;
        resolve();
      });
    });

    socket1.emit('send_message', {
      conversationId: convId,
      text: 'Real-time WebSocket Hello!',
    });

    await msgPromise;
    if (!receivedMessageByU2 || receivedMessageByU2.text !== 'Real-time WebSocket Hello!') {
      throw new Error('User 2 failed to receive new_message event');
    }
    const messageId = receivedMessageByU2._id;
    console.log('✓ User 2 received new_message event in real-time with ID:', messageId);

    console.log('6. Testing Real-Time Message Editing (edit_message -> message_edited)...');
    let editedMessageReceived = null;
    const editPromise = new Promise((resolve) => {
      socket2.on('message_edited', (msg) => {
        editedMessageReceived = msg;
        resolve();
      });
    });

    socket1.emit('edit_message', {
      messageId,
      text: 'Real-time WebSocket Hello! (Edited)',
    });

    await editPromise;
    if (!editedMessageReceived || editedMessageReceived.text !== 'Real-time WebSocket Hello! (Edited)') {
      throw new Error('User 2 failed to receive message_edited event');
    }
    console.log('✓ User 2 received message_edited event in real-time');

    console.log('7. Testing Real-Time Reactions (message_reaction -> message_reacted)...');
    let reactionReceived = null;
    const reactPromise = new Promise((resolve) => {
      socket1.on('message_reacted', (data) => {
        reactionReceived = data;
        resolve();
      });
    });

    socket2.emit('message_reaction', {
      messageId,
      emoji: '🔥',
    });

    await reactPromise;
    if (!reactionReceived || reactionReceived.reactions[0].emoji !== '🔥') {
      throw new Error('User 1 failed to receive message_reacted event');
    }
    console.log('✓ User 1 received message_reacted event in real-time');

    console.log('8. Testing Real-Time Pinning (pin_message -> message_pinned)...');
    let pinReceived = null;
    const pinPromise = new Promise((resolve) => {
      socket2.on('message_pinned', (data) => {
        pinReceived = data;
        resolve();
      });
    });

    socket1.emit('pin_message', { messageId });
    await pinPromise;
    if (!pinReceived || !pinReceived.pinned) {
      throw new Error('User 2 failed to receive message_pinned event');
    }
    console.log('✓ User 2 received message_pinned event in real-time');

    console.log('9. Testing Real-Time Deletion (delete_message -> message_deleted)...');
    let deleteReceived = null;
    const deletePromise = new Promise((resolve) => {
      socket2.on('message_deleted', (data) => {
        deleteReceived = data;
        resolve();
      });
    });

    socket1.emit('delete_message', { messageId });
    await deletePromise;
    if (!deleteReceived || deleteReceived.message.text !== 'This message was deleted') {
      throw new Error('User 2 failed to receive message_deleted event');
    }
    console.log('✓ User 2 received message_deleted event with masked text');

    // Clean up
    socket1.disconnect();
    socket2.disconnect();
    await Message.deleteMany({ conversation: convId });
    await Conversation.deleteMany({ _id: convId });
    await User.deleteMany({ _id: { $in: [user1._id, user2._id] } });
    console.log('✓ Disconnected sockets and cleaned up test data');

    server.close();
    await mongoose.disconnect();
    console.log('ALL SOCKET.IO REAL-TIME MESSAGING TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('SOCKET TEST FAILURE:', err);
    if (server) server.close();
    await mongoose.disconnect();
    process.exit(1);
  }
}

runSocketTests();
