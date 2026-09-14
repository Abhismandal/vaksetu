import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../app.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';

dotenv.config();

const PORT = 5010;
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

const runNotificationTests = async () => {
  console.log('=== STARTING NOTIFICATIONS & UNREAD COUNTERS TEST SUITE ===\n');

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

    // Cleanup previous test users and notifications
    await User.deleteMany({
      $or: [
        { email: /notif_test_/ },
        { username: { $in: ['notif_alice', 'notif_bob'] } },
      ],
    });
    await Notification.deleteMany({});

    // 2. Register test users (Alice and Bob)
    console.log('2. Registering test users (Alice and Bob)...');
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

    const alice = await registerUser('Alice Notif', 'notif_alice', 'notif_test_alice@example.com');
    const bob = await registerUser('Bob Notif', 'notif_bob', 'notif_test_bob@example.com');
    console.log('? Created Alice and Bob');

    // 3. Unauthorized access check
    console.log('\n3. Testing Unauthorized Access to /api/notifications...');
    const unauthRes = await request('/api/notifications');
    if (unauthRes.status === 401) {
      console.log('? 401 returned for unauthorized request');
    } else {
      throw new Error(`Expected 401, got ${unauthRes.status}`);
    }

    // 4. Initial empty notifications check
    console.log('\n4. Checking Initial Empty Notifications for Bob...');
    const initRes = await request('/api/notifications', {
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    if (initRes.status === 200 && initRes.data.unreadCount === 0 && initRes.data.notifications.length === 0) {
      console.log('? Bob has 0 notifications and 0 unread count');
    } else {
      throw new Error('Initial notifications check failed');
    }

    // 5. Create direct conversation and send message from Alice to Bob
    console.log('\n5. Alice sending message to Bob...');
    const convRes = await request('/api/conversations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alice.token}` },
      body: JSON.stringify({ recipientId: bob.user._id }),
    });
    const convId = convRes.data.conversation._id;

    const msgRes = await request('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alice.token}` },
      body: JSON.stringify({
        conversationId: convId,
        text: 'Hey Bob, check out this urgent notification test!',
      }),
    });
    const msgId = msgRes.data.message._id;
    console.log('? Message sent successfully, ID:', msgId);

    // 6. Verify Bob received an in-app notification
    console.log('\n6. Checking In-App Notifications for Bob...');
    const bobNotifs = await request('/api/notifications', {
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    if (
      bobNotifs.status === 200 &&
      bobNotifs.data.unreadCount === 1 &&
      bobNotifs.data.notifications.length === 1 &&
      bobNotifs.data.notifications[0].sender?.username === 'notif_alice'
    ) {
      console.log('? Notification created: Bob has 1 unread notification from Alice');
    } else {
      throw new Error(`Notification check failed: ${JSON.stringify(bobNotifs.data)}`);
    }
    const notif1Id = bobNotifs.data.notifications[0]._id;

    // 7. Mark single notification as read
    console.log('\n7. Testing Mark Notification as Read (PUT /api/notifications/:id/read)...');
    const readRes = await request(`/api/notifications/${notif1Id}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    if (readRes.status === 200 && readRes.data.notification.isRead === true && readRes.data.unreadCount === 0) {
      console.log('? Notification marked as read, unread count now 0');
    } else {
      throw new Error('Mark notification read failed');
    }

    // 8. Alice sends 2 more messages
    console.log('\n8. Alice sending 2 more messages...');
    await request('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alice.token}` },
      body: JSON.stringify({
        conversationId: convId,
        text: 'Second notification test message',
      }),
    });
    await request('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alice.token}` },
      body: JSON.stringify({
        conversationId: convId,
        text: 'Third notification test message',
      }),
    });

    const bobNotifs2 = await request('/api/notifications', {
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    if (bobNotifs2.data.unreadCount === 2) {
      console.log('? Bob has 2 new unread notifications (total:', bobNotifs2.data.notifications.length, ')');
    } else {
      throw new Error(`Expected 2 unread, got ${bobNotifs2.data.unreadCount}`);
    }

    // 9. Mark all notifications as read
    console.log('\n9. Testing Mark All as Read (PUT /api/notifications/read-all)...');
    const readAllRes = await request('/api/notifications/read-all', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    if (readAllRes.status === 200 && readAllRes.data.unreadCount === 0) {
      console.log('? All notifications marked as read');
    } else {
      throw new Error('Mark all as read failed');
    }

    // 10. Delete a single notification
    console.log('\n10. Testing Delete Single Notification (DELETE /api/notifications/:id)...');
    const delRes = await request(`/api/notifications/${notif1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    if (delRes.status === 200 && delRes.data.success) {
      console.log('? Notification successfully deleted');
    } else {
      throw new Error('Delete notification failed');
    }

    // 11. Clear all notifications
    console.log('\n11. Testing Clear All Notifications (DELETE /api/notifications)...');
    const clearRes = await request('/api/notifications', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    if (clearRes.status === 200 && clearRes.data.unreadCount === 0) {
      console.log('? All notifications cleared successfully');
    } else {
      throw new Error('Clear all notifications failed');
    }

    const finalNotifs = await request('/api/notifications', {
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    if (finalNotifs.data.notifications.length === 0) {
      console.log('? Verified 0 notifications remaining');
    } else {
      throw new Error('Final notification list not empty');
    }

    // Cleanup
    await User.deleteMany({
      $or: [
        { email: /notif_test_/ },
        { username: { $in: ['notif_alice', 'notif_bob'] } },
      ],
    });
    await Conversation.deleteMany({ _id: convId });
    await Message.deleteMany({ conversation: convId });
    await Notification.deleteMany({});
    console.log('? Cleaned up all test data');

    console.log('\n=================================================');
    console.log('ALL NOTIFICATION & UNREAD TESTS PASSED SUCCESFULLY!');
    console.log('=================================================\n');
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

runNotificationTests();
