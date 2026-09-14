import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';
import app from '../app.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

dotenv.config();

const PORT = 5008;
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

async function runGroupTests() {
  try {
    console.log('1. Starting test server on port', PORT);
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aichatbot');
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`? Test server running on http://localhost:${PORT}`);

    // Clean up previous test users
    await User.deleteMany({ email: { $in: ['grp_u1@example.com', 'grp_u2@example.com', 'grp_u3@example.com', 'grp_outsider@example.com'] } });

    console.log('2. Registering test users...');
    const u1Res = await apiRequest('/api/auth/register', 'POST', {
      name: 'Group Admin',
      username: 'grp_admin',
      email: 'grp_u1@example.com',
      password: 'password123',
    });
    const token1 = u1Res.data.token;
    const user1 = u1Res.data.user;

    const u2Res = await apiRequest('/api/auth/register', 'POST', {
      name: 'Group Member One',
      username: 'grp_m1',
      email: 'grp_u2@example.com',
      password: 'password123',
    });
    const token2 = u2Res.data.token;
    const user2 = u2Res.data.user;

    const u3Res = await apiRequest('/api/auth/register', 'POST', {
      name: 'Group Member Two',
      username: 'grp_m2',
      email: 'grp_u3@example.com',
      password: 'password123',
    });
    const token3 = u3Res.data.token;
    const user3 = u3Res.data.user;

    const outsiderRes = await apiRequest('/api/auth/register', 'POST', {
      name: 'Group Outsider',
      username: 'grp_outsider',
      email: 'grp_outsider@example.com',
      password: 'password123',
    });
    const tokenOutsider = outsiderRes.data.token;
    console.log('? Created 4 test users');

    // 3. Test Create Group
    console.log('3. Testing Create Group (POST /api/groups)...');
    const createRes = await apiRequest(
      '/api/groups',
      'POST',
      {
        name: 'Nexus Engineering Core',
        description: 'Engineering team discussions & releases',
        members: [user2._id],
      },
      token1
    );

    if (!createRes.data.success || !createRes.data.group?._id) {
      throw new Error(`Create group failed: ${JSON.stringify(createRes.data)}`);
    }

    const group = createRes.data.group;
    const groupId = group._id;
    const convId = createRes.data.conversation._id;
    console.log('? Group created with ID:', groupId, 'and Conversation:', convId);

    // 4. Test Get Group Details
    console.log('4. Testing Get Group Details (GET /api/groups/:id)...');
    const getRes = await apiRequest(`/api/groups/${groupId}`, 'GET', null, token2);
    if (!getRes.data.success || getRes.data.group.members.length !== 2) {
      throw new Error(`Get group failed: ${JSON.stringify(getRes.data)}`);
    }
    console.log('? Member retrieved group details, member count = 2');

    // 5. Test Unauthorized Access by Outsider
    console.log('5. Testing Non-Member Access Rejection...');
    const outsiderAccess = await apiRequest(`/api/groups/${groupId}`, 'GET', null, tokenOutsider);
    if (outsiderAccess.status !== 403) {
      throw new Error(`Expected 403 Forbidden, received ${outsiderAccess.status}`);
    }
    console.log('? Non-member correctly rejected with 403');

    // 6. Test Update Group Info
    console.log('6. Testing Update Group Details (PUT /api/groups/:id)...');
    const updateRes = await apiRequest(
      `/api/groups/${groupId}`,
      'PUT',
      {
        name: 'Nexus Engineering Core v2',
        description: 'Updated team description',
      },
      token1
    );
    if (!updateRes.data.success || updateRes.data.group.name !== 'Nexus Engineering Core v2') {
      throw new Error(`Update group failed: ${JSON.stringify(updateRes.data)}`);
    }
    console.log('? Group details updated and synced');

    // 7. Test Add Member (User 3)
    console.log('7. Testing Add Member (POST /api/groups/:id/members)...');
    const addRes = await apiRequest(
      `/api/groups/${groupId}/members`,
      'POST',
      { memberIds: [user3._id] },
      token1
    );
    if (!addRes.data.success || addRes.data.group.members.length !== 3) {
      throw new Error(`Add member failed: ${JSON.stringify(addRes.data)}`);
    }
    console.log('? User 3 added to group, member count = 3');

    // 8. Test Toggle Admin Status (Promote User 2)
    console.log('8. Testing Toggle Admin Status (PUT /api/groups/:id/admins/:memberId)...');
    const adminRes = await apiRequest(`/api/groups/${groupId}/admins/${user2._id}`, 'PUT', {}, token1);
    if (!adminRes.data.success || !adminRes.data.isAdmin) {
      throw new Error(`Admin toggle failed: ${JSON.stringify(adminRes.data)}`);
    }
    console.log('? User 2 promoted to group admin');

    // 9. Test Member 3 Leaving Group
    console.log('9. Testing Member Self-Leave (DELETE /api/groups/:id/members/:memberId)...');
    const leaveRes = await apiRequest(`/api/groups/${groupId}/members/${user3._id}`, 'DELETE', null, token3);
    if (!leaveRes.data.success || leaveRes.data.group.members.length !== 2) {
      throw new Error(`Leave group failed: ${JSON.stringify(leaveRes.data)}`);
    }
    console.log('? User 3 successfully left the group');

    // Clean up
    await User.deleteMany({ email: { $in: ['grp_u1@example.com', 'grp_u2@example.com', 'grp_u3@example.com', 'grp_outsider@example.com'] } });
    await Group.deleteMany({ _id: groupId });
    await Conversation.deleteMany({ _id: convId });
    await Message.deleteMany({ conversation: convId });
    console.log('? Cleaned up all test data');

    console.log('ALL GROUP CHAT TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('Group test failed:', error);
    process.exit(1);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runGroupTests();
