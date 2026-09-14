import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';
import app from '../app.js';
import User from '../models/User.js';

dotenv.config();

const PORT = 5002; // Use distinct port for isolated auth test
let server;

const apiRequest = async (path, method = 'GET', body = null, token = null) => {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`http://localhost:${PORT}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json();
  return { status: res.status, data };
};

async function runAuthTests() {
  try {
    console.log('1. Connecting to DB and starting test server...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aichatbot');
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`✓ Test server running on http://localhost:${PORT}`);

    // Cleanup previous test users
    await User.deleteMany({ email: { $in: ['authtest@example.com', 'authtest2@example.com'] } });

    console.log('2. Testing Registration (POST /api/auth/register)...');
    const regRes = await apiRequest('/api/auth/register', 'POST', {
      name: 'Auth Tester',
      username: 'authtester',
      email: 'authtest@example.com',
      password: 'password123',
      bio: 'Ready for chatting!',
    });

    if (regRes.status !== 201 || !regRes.data.token || !regRes.data.user) {
      throw new Error(`Registration failed: ${JSON.stringify(regRes.data)}`);
    }
    console.log('✓ User registered successfully with JWT token received');
    const authToken = regRes.data.token;

    console.log('3. Testing Duplicate Registration Prevention...');
    const dupRes = await apiRequest('/api/auth/register', 'POST', {
      name: 'Auth Tester 2',
      username: 'authtester',
      email: 'authtest@example.com',
      password: 'password123',
    });
    if (dupRes.status !== 400 || dupRes.data.success !== false) {
      throw new Error(`Duplicate registration was not blocked: ${JSON.stringify(dupRes.data)}`);
    }
    console.log('✓ Duplicate registration correctly rejected with HTTP 400');

    console.log('4. Testing Login with correct credentials (POST /api/auth/login)...');
    const loginRes = await apiRequest('/api/auth/login', 'POST', {
      identifier: 'authtester',
      password: 'password123',
    });
    if (loginRes.status !== 200 || !loginRes.data.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
    }
    console.log('✓ Logged in successfully with username');

    console.log('5. Testing Login with email identifier...');
    const loginEmailRes = await apiRequest('/api/auth/login', 'POST', {
      email: 'authtest@example.com',
      password: 'password123',
    });
    if (loginEmailRes.status !== 200) {
      throw new Error(`Email login failed: ${JSON.stringify(loginEmailRes.data)}`);
    }
    console.log('✓ Logged in successfully with email identifier');

    console.log('6. Testing Login with invalid password...');
    const badLoginRes = await apiRequest('/api/auth/login', 'POST', {
      email: 'authtest@example.com',
      password: 'wrongpassword',
    });
    if (badLoginRes.status !== 401) {
      throw new Error(`Invalid login should return 401, got ${badLoginRes.status}`);
    }
    console.log('✓ Invalid password rejected with HTTP 401');

    console.log('7. Testing Protected /api/auth/me endpoint with valid token...');
    const meRes = await apiRequest('/api/auth/me', 'GET', null, authToken);
    if (meRes.status !== 200 || meRes.data.user.email !== 'authtest@example.com') {
      throw new Error(`getMe failed: ${JSON.stringify(meRes.data)}`);
    }
    console.log('✓ /api/auth/me returned current user successfully');

    console.log('8. Testing Protected /api/auth/me with invalid token...');
    const badTokenRes = await apiRequest('/api/auth/me', 'GET', null, 'invalid.bearer.token');
    if (badTokenRes.status !== 401) {
      throw new Error(`Invalid token should return 401, got ${badTokenRes.status}`);
    }
    console.log('✓ Protected route correctly rejects invalid token with HTTP 401');

    console.log('9. Testing Profile Update (PUT /api/auth/me)...');
    const updateRes = await apiRequest(
      '/api/auth/me',
      'PUT',
      {
        bio: 'Updated bio for chat!',
        status: 'Coding full-stack MERN!',
      },
      authToken
    );
    if (updateRes.status !== 200 || updateRes.data.user.bio !== 'Updated bio for chat!') {
      throw new Error(`Profile update failed: ${JSON.stringify(updateRes.data)}`);
    }
    console.log('✓ Profile updated successfully');

    console.log('10. Testing Logout (POST /api/auth/logout)...');
    const logoutRes = await apiRequest('/api/auth/logout', 'POST', null, authToken);
    if (logoutRes.status !== 200) {
      throw new Error(`Logout failed: ${JSON.stringify(logoutRes.data)}`);
    }
    console.log('✓ Logout endpoint succeeded');

    // Clean up
    await User.deleteMany({ email: 'authtest@example.com' });
    console.log('✓ Cleaned up test data');

    server.close();
    await mongoose.disconnect();
    console.log('ALL AUTH TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('AUTH TEST FAILURE:', err);
    if (server) server.close();
    await mongoose.disconnect();
    process.exit(1);
  }
}

runAuthTests();
