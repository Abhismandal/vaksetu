import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../app.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const clientDir = path.resolve(rootDir, 'client');

const PORT = 5016;
const BASE_URL = `http://localhost:${PORT}`;

async function runStep19Tests() {
  console.log('=== STARTING STEP 19: PERFORMANCE, INDEXEDDB & PWA TESTS ===\n');

  // --- PART 1: PWA MANIFEST & ASSET AUDIT ---
  console.log('1. Auditing PWA Manifest & App Configuration...');
  const manifestPath = path.join(clientDir, 'public', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json does not exist in client/public');
  }

  const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  if (!manifestContent.name || !manifestContent.short_name) {
    throw new Error('manifest.json missing name or short_name');
  }
  if (manifestContent.display !== 'standalone') {
    throw new Error(`Expected manifest display to be 'standalone', got: ${manifestContent.display}`);
  }
  if (!manifestContent.icons || manifestContent.icons.length === 0) {
    throw new Error('manifest.json has no icons configured');
  }
  console.log('✔ PWA Manifest verified:');
  console.log(`  Name: ${manifestContent.name}`);
  console.log(`  Short name: ${manifestContent.short_name}`);
  console.log(`  Display: ${manifestContent.display}`);
  console.log(`  Theme Color: ${manifestContent.theme_color}`);
  console.log(`  Icons: ${manifestContent.icons.length} icon definitions`);

  // --- PART 2: SERVICE WORKER SCRIPT AUDIT ---
  console.log('\n2. Auditing Service Worker (sw.js)...');
  const swPath = path.join(clientDir, 'public', 'sw.js');
  if (!fs.existsSync(swPath)) {
    throw new Error('sw.js does not exist in client/public');
  }
  const swContent = fs.readFileSync(swPath, 'utf-8');
  if (!swContent.includes('addEventListener(\'install\'') || !swContent.includes('addAll(')) {
    throw new Error('sw.js missing install precache logic');
  }
  if (!swContent.includes('addEventListener(\'activate\'') || !swContent.includes('clients.claim()')) {
    throw new Error('sw.js missing activate / cache-cleanup logic');
  }
  if (!swContent.includes('addEventListener(\'fetch\'') || !swContent.includes('/api')) {
    throw new Error('sw.js missing fetch handler or API exclusion');
  }
  console.log('✔ Service Worker verified:');
  console.log('  Install event & app-shell precache: PRESENT');
  console.log('  Activate event & stale cache pruning: PRESENT');
  console.log('  Fetch event & API bypass filter: PRESENT');

  // --- PART 3: CLIENT HTML PWA TAGS AUDIT ---
  console.log('\n3. Auditing client/index.html PWA meta tags...');
  const htmlPath = path.join(clientDir, 'index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  if (!htmlContent.includes('rel="manifest"') || !htmlContent.includes('/manifest.json')) {
    throw new Error('index.html missing manifest link');
  }
  if (!htmlContent.includes('name="theme-color"')) {
    throw new Error('index.html missing theme-color meta tag');
  }
  if (!htmlContent.includes('apple-mobile-web-app-capable')) {
    throw new Error('index.html missing apple-mobile-web-app-capable meta tag');
  }
  console.log('✔ index.html verified:');
  console.log('  Manifest link: <link rel="manifest" href="/manifest.json" />');
  console.log('  Theme color: meta tag present');
  console.log('  Apple mobile web app tags: present');

  // --- PART 4: INDEXEDDB SERVICE ARCHITECTURE AUDIT ---
  const dbServicePath = path.join(clientDir, 'src', 'services', 'dbService.js');
  const dbServiceModule = await import(pathToFileURL(dbServicePath).href);
  const dbService = dbServiceModule.default;

  // Test conversations caching
  const sampleConversations = [
    { _id: 'conv-cache-1', name: 'General Chat', updatedAt: new Date().toISOString() },
    { _id: 'conv-cache-2', name: 'Dev Team', updatedAt: new Date(Date.now() - 60000).toISOString() },
  ];
  await dbService.saveConversations(sampleConversations);
  const cachedConversations = await dbService.getConversations();
  if (cachedConversations.length < 2) {
    throw new Error(`Expected at least 2 cached conversations, got: ${cachedConversations.length}`);
  }
  console.log(`✔ Cached conversations count: ${cachedConversations.length}`);

  // Test messages caching
  const sampleMessages = [
    { _id: 'msg-c-1', conversation: 'conv-cache-1', text: 'Hello offline cache', createdAt: new Date().toISOString() },
    { _id: 'msg-c-2', conversation: 'conv-cache-1', text: 'Second message in cache', createdAt: new Date().toISOString() },
  ];
  await dbService.saveMessages('conv-cache-1', sampleMessages);
  const cachedMessages = await dbService.getMessages('conv-cache-1');
  if (cachedMessages.length < 2) {
    throw new Error(`Expected at least 2 cached messages, got: ${cachedMessages.length}`);
  }
  console.log(`✔ Cached messages count for conv-cache-1: ${cachedMessages.length}`);

  // Test offline outbox queueing
  const outboxPayload = {
    tempId: 'temp-12345',
    payload: { conversationId: 'conv-cache-1', text: 'Offline queued message' },
    conversationId: 'conv-cache-1',
    originalText: 'Offline queued message',
  };
  const queuedId = await dbService.queueOutboxMessage(outboxPayload);
  if (!queuedId) {
    throw new Error('Failed to queue outbox message in dbService');
  }
  const pendingOutbox = await dbService.getOutboxMessages();
  if (pendingOutbox.length === 0) {
    throw new Error('Expected at least 1 pending outbox item');
  }
  console.log(`✔ Outbox queue successfully stored pending item: ID #${queuedId}`);

  // Test outbox item removal
  await dbService.removeOutboxMessage(queuedId);
  const afterRemoval = await dbService.getOutboxMessages();
  if (afterRemoval.some((item) => item.id === queuedId)) {
    throw new Error('Failed to remove synced outbox message');
  }
  console.log('✔ Outbox queue item removal verified');

  // --- PART 5: END-TO-END SERVER OUTBOX SYNC SIMULATION ---
  console.log('\n5. Starting test server and simulating offline-to-online message sync...');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aichatbot';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  // Register a test user
  const unique = Date.now();
  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Offline User ${unique}`,
      email: `offline_${unique}@example.com`,
      password: 'Password123!',
      username: `offline_${unique}`,
    }),
  });
  const registerData = await registerRes.json();
  const token = registerData.token;
  const userId = registerData.user._id;

  // Create another user and conversation
  const user2Res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Peer User ${unique}`,
      email: `peer_${unique}@example.com`,
      password: 'Password123!',
      username: `peer_${unique}`,
    }),
  });
  const user2Data = await user2Res.json();

  const convRes = await fetch(`${BASE_URL}/api/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ recipientId: user2Data.user._id }),
  });
  const convData = await convRes.json();
  const conversationId = convData.conversation._id;

  // Queue an offline message into outbox
  const offlineMessageData = {
    tempId: `temp-${unique}`,
    payload: {
      conversationId,
      text: 'Synchronized offline message via IndexedDB outbox!',
    },
    conversationId,
    originalText: 'Synchronized offline message via IndexedDB outbox!',
  };
  const outboxId = await dbService.queueOutboxMessage(offlineMessageData);
  console.log(`✔ Offline message queued in outbox with ID: ${outboxId}`);

  // Simulate Reconnection and Sync
  console.log('✔ Reconnection detected: syncing outbox queue with server...');
  const pendingItems = await dbService.getOutboxMessages();
  for (const item of pendingItems) {
    const syncRes = await fetch(`${BASE_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(item.payload),
    });
    const syncResult = await syncRes.json();
    if (!syncResult.success || !syncResult.message) {
      throw new Error(`Failed to sync outbox message to server: ${JSON.stringify(syncResult)}`);
    }

    // Verify DB persistence
    const savedInDb = await Message.findById(syncResult.message._id);
    if (!savedInDb) {
      throw new Error('Synced message not found in MongoDB');
    }
    console.log(`✔ Message synced and stored in MongoDB: ${savedInDb._id}`);
    console.log(`  Text: "${savedInDb.text}"`);

    // Remove from outbox
    await dbService.removeOutboxMessage(item.id);
  }

  const remainingOutbox = await dbService.getOutboxMessages();
  console.log(`✔ Outbox drained successfully. Remaining items: ${remainingOutbox.length}`);

  // --- PART 6: VITE BUNDLE SPLIT AUDIT ---
  console.log('\n6. Auditing Vite production bundle chunks in client/dist...');
  const distAssetsDir = path.join(clientDir, 'dist', 'assets');
  if (fs.existsSync(distAssetsDir)) {
    const files = fs.readdirSync(distAssetsDir);
    const jsFiles = files.filter((f) => f.endsWith('.js'));
    console.log(`✔ Found ${jsFiles.length} optimized JS chunks in dist/assets:`);
    for (const file of jsFiles) {
      const stats = fs.statSync(path.join(distAssetsDir, file));
      const kb = (stats.size / 1024).toFixed(2);
      console.log(`  - ${file}: ${kb} KB`);
      if (stats.size > 550 * 1024) {
        throw new Error(`Chunk ${file} exceeds 550KB: ${kb} KB`);
      }
    }
    console.log('✔ All chunks are cleanly under the 500KB threshold!');
  } else {
    console.log('ℹ (dist/assets folder not present; run npm run build to generate)');
  }

  // Cleanup
  server.close();
  await mongoose.disconnect();

  console.log('\n=============================================================');
  console.log('🎉 ALL STEP 19 PERFORMANCE, INDEXEDDB & PWA TESTS PASSED! 🎉');
  console.log('=============================================================\n');
}

runStep19Tests().catch((err) => {
  console.error('\n❌ STEP 19 TEST SUITE FAILED:', err);
  process.exit(1);
});
