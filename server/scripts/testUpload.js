import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../app.js';
import User from '../models/User.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5007;
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

async function runUploadTests() {
  try {
    console.log('1. Starting test server on port', PORT);
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aichatbot');
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`? Test server running on http://localhost:${PORT}`);

    // Clean up previous test users
    await User.deleteMany({ email: 'upload_test_u1@example.com' });

    console.log('2. Registering test user for upload authorization...');
    const u1Res = await apiRequest('/api/auth/register', 'POST', {
      name: 'Upload Test User',
      username: 'upload_user_1',
      email: 'upload_test_u1@example.com',
      password: 'password123',
    });
    const token = u1Res.data.token;
    console.log('? Test user registered, token acquired');

    // 3. Test Unauthorized Upload
    console.log('3. Testing Unauthorized Upload (POST /api/upload/single without token)...');
    const formNoAuth = new FormData();
    formNoAuth.append('file', new Blob(['fake content'], { type: 'text/plain' }), 'test.txt');
    const unauthRes = await fetch(`http://localhost:${PORT}/api/upload/single`, {
      method: 'POST',
      body: formNoAuth,
    });
    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401 Unauthorized, received ${unauthRes.status}`);
    }
    console.log('? Unauthorized upload rejected with 401');

    // 4. Test Single File Upload
    console.log('4. Testing Single File Upload (POST /api/upload/single)...');
    const formSingle = new FormData();
    const fakeImageBuffer = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');
    formSingle.append('file', new Blob([fakeImageBuffer], { type: 'image/gif' }), 'pixel.gif');

    const singleRes = await fetch(`http://localhost:${PORT}/api/upload/single`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formSingle,
    });
    const singleData = await singleRes.json();
    if (!singleData.success || !singleData.file?.url) {
      throw new Error(`Single upload failed: ${JSON.stringify(singleData)}`);
    }
    console.log('? Single file uploaded successfully:', singleData.file.filename);
    const uploadedFilename = singleData.file.filename;

    // 5. Test Static File Serving
    console.log('5. Verifying Static File Serving (GET /uploads/:filename)...');
    const staticRes = await fetch(`http://localhost:${PORT}/uploads/${uploadedFilename}`);
    if (staticRes.status !== 200) {
      throw new Error(`Static file fetch failed with status ${staticRes.status}`);
    }
    console.log('? Static file fetched successfully with status 200');

    // 6. Test Multiple Files Upload
    console.log('6. Testing Multiple Files Upload (POST /api/upload/multiple)...');
    const formMultiple = new FormData();
    formMultiple.append('files', new Blob(['doc 1 content'], { type: 'text/plain' }), 'doc1.txt');
    formMultiple.append('files', new Blob(['doc 2 content'], { type: 'text/plain' }), 'doc2.txt');

    const multiRes = await fetch(`http://localhost:${PORT}/api/upload/multiple`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formMultiple,
    });
    const multiData = await multiRes.json();
    if (!multiData.success || multiData.files?.length !== 2) {
      throw new Error(`Multiple upload failed: ${JSON.stringify(multiData)}`);
    }
    console.log(`? Multiple upload succeeded (${multiData.files.length} files)`);

    // 7. Test Delete Uploaded File
    console.log('7. Testing Delete Uploaded File (DELETE /api/upload/:filename)...');
    const deleteRes = await apiRequest(`/api/upload/${uploadedFilename}`, 'DELETE', null, token);
    if (!deleteRes.data.success) {
      throw new Error(`Delete file failed: ${JSON.stringify(deleteRes.data)}`);
    }
    console.log('? File deleted successfully from server storage');

    // Clean up
    for (const f of multiData.files) {
      await apiRequest(`/api/upload/${f.filename}`, 'DELETE', null, token);
    }
    await User.deleteMany({ email: 'upload_test_u1@example.com' });
    console.log('? Cleaned up test files and users');

    console.log('ALL UPLOAD TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('Upload test failed:', error);
    process.exit(1);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runUploadTests();
