import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../app.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

dotenv.config();

const PORT = 5012;
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

const runAIToolsTests = async () => {
  console.log('=== STARTING AI TOOLS & SMART ACTIONS TEST SUITE ===\n');

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

    // Clean up test user
    await User.deleteMany({ email: 'ai_tools_user@example.com' });

    // 2. Register test user
    console.log('\n2. Registering test user...');
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'AI Tools Tester',
        username: 'ai_tools_tester',
        email: 'ai_tools_user@example.com',
        password: 'Password123!',
      }),
    });
    const { token } = regRes.data;
    if (!token) throw new Error('Registration failed, no token');
    console.log('? Registered test user & received token');

    // 3. Unauthorized access check
    console.log('\n3. Testing Unauthorized Access to AI Tools...');
    const unauthRes = await request('/api/ai/rewrite', {
      method: 'POST',
      body: JSON.stringify({ text: 'Hey please send the file' }),
    });
    if (unauthRes.status === 401) {
      console.log('? 401 returned for unauthorized request');
    } else {
      throw new Error(`Expected 401, got ${unauthRes.status}`);
    }

    // 4. Test AI Rewrite: Professional
    console.log('\n4. Testing AI Rewrite (Professional)...');
    const profRes = await request('/api/ai/rewrite', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        text: 'yo can you give me that report ASAP',
        style: 'professional',
      }),
    });
    if (profRes.status === 200 && profRes.data.success && profRes.data.result) {
      console.log('? Professional rewrite successful:');
      console.log(`  "${profRes.data.result}"`);
    } else {
      throw new Error(`Rewrite professional failed: ${JSON.stringify(profRes.data)}`);
    }

    // 5. Test AI Rewrite: Casual, Concise, Fix Grammar
    console.log('\n5. Testing AI Rewrite (Casual, Concise, Fix Grammar)...');
    for (const style of ['casual', 'concise', 'fix_grammar']) {
      const res = await request('/api/ai/rewrite', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          text: 'i is doing the deployement today and its going good',
          style,
        }),
      });
      if (res.status === 200 && res.data.success && res.data.result) {
        console.log(`? [${style}]: "${res.data.result}"`);
      } else {
        throw new Error(`Rewrite ${style} failed: ${JSON.stringify(res.data)}`);
      }
    }

    // Test rewrite validation (empty text)
    const emptyRewriteRes = await request('/api/ai/rewrite', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: '   ' }),
    });
    if (emptyRewriteRes.status === 400) {
      console.log('? Handled empty text validation error (400)');
    } else {
      throw new Error(`Expected 400 for empty text, got ${emptyRewriteRes.status}`);
    }

    // 6. Test AI Translate
    console.log('\n6. Testing AI Translation (Spanish & French)...');
    const translateEs = await request('/api/ai/translate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        text: 'Good morning everyone, please join our team meeting on time.',
        targetLanguage: 'Spanish',
      }),
    });
    if (translateEs.status === 200 && translateEs.data.success && translateEs.data.translatedText) {
      console.log('? Translated to Spanish:');
      console.log(`  "${translateEs.data.translatedText}"`);
    } else {
      throw new Error(`Translation to Spanish failed: ${JSON.stringify(translateEs.data)}`);
    }

    const translateFr = await request('/api/ai/translate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        text: 'Thank you for your assistance today.',
        targetLanguage: 'French',
      }),
    });
    if (translateFr.status === 200 && translateFr.data.success && translateFr.data.translatedText) {
      console.log('? Translated to French:');
      console.log(`  "${translateFr.data.translatedText}"`);
    } else {
      throw new Error(`Translation to French failed: ${JSON.stringify(translateFr.data)}`);
    }

    // 7. Test AI Summarize Conversation
    console.log('\n7. Testing AI Chat Summarization...');
    const testMessages = [
      { sender: { name: 'Alice' }, text: 'Hi team, let us review the deployment timeline for the release.' },
      { sender: { name: 'Bob' }, text: 'Database migrations are already tested and ready for production.' },
      { sender: { name: 'Alice' }, text: 'Awesome! Let us schedule the deployment for 4 PM UTC today.' },
      { sender: { name: 'Charlie' }, text: 'Agreed, I will prepare the rollback plan just in case.' },
    ];

    const sumRes = await request('/api/ai/summarize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: testMessages }),
    });
    if (sumRes.status === 200 && sumRes.data.success && sumRes.data.summary) {
      console.log('? Conversation summary generated:');
      console.log(sumRes.data.summary.substring(0, 180) + '...\n');
    } else {
      throw new Error(`Summarize failed: ${JSON.stringify(sumRes.data)}`);
    }

    // 8. Test AI Smart Replies
    console.log('8. Testing AI Contextual Smart Replies...');
    const smartRes = await request('/api/ai/smart-replies', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: testMessages }),
    });
    if (smartRes.status === 200 && smartRes.data.success && Array.isArray(smartRes.data.suggestions) && smartRes.data.suggestions.length > 0) {
      console.log('? Generated smart reply suggestions:');
      smartRes.data.suggestions.forEach((s, idx) => console.log(`  ${idx + 1}. "${s}"`));
    } else {
      throw new Error(`Smart replies failed: ${JSON.stringify(smartRes.data)}`);
    }

    console.log('\n======================================================');
    console.log('?? ALL STEP 15 AI TOOLS & SMART ACTIONS TESTS PASSED! ??');
    console.log('======================================================\n');
  } catch (error) {
    console.error('\n? Test suite encountered an error:', error);
    process.exitCode = 1;
  } finally {
    // Cleanup
    try {
      await User.deleteMany({ email: 'ai_tools_user@example.com' });
    } catch (_) {}
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
  }
};

runAIToolsTests();
