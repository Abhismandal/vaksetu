import http from 'http';
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { webcrypto } from 'crypto';

import authRoutes from '../routes/authRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import conversationRoutes from '../routes/conversationRoutes.js';
import messageRoutes from '../routes/messageRoutes.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

dotenv.config();

const subtle = webcrypto.subtle;

// Helper: Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

// Helper: Convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
  return Buffer.from(base64, 'base64');
}

// Crypto Helper: Generate RSA-OAEP key pair
async function generateRSAKeyPair() {
  const keyPair = await subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const spki = await subtle.exportKey('spki', keyPair.publicKey);
  const pkcs8 = await subtle.exportKey('pkcs8', keyPair.privateKey);

  return {
    keyPair,
    publicKeyBase64: arrayBufferToBase64(spki),
    privateKeyBase64: arrayBufferToBase64(pkcs8),
  };
}

// Crypto Helper: Import public key
async function importPublicKey(spkiBase64) {
  return await subtle.importKey(
    'spki',
    base64ToArrayBuffer(spkiBase64),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
}

// Crypto Helper: Import private key
async function importPrivateKey(pkcs8Base64) {
  return await subtle.importKey(
    'pkcs8',
    base64ToArrayBuffer(pkcs8Base64),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );
}

// Crypto Helper: Encrypt plaintext message with AES-GCM + RSA-OAEP key wrapping
async function encryptMessage(plaintext, recipients) {
  // 1. Generate 256-bit AES-GCM symmetric key
  const aesKey = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // 2. Generate 12-byte IV
  const iv = webcrypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt plaintext
  const encodedText = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encodedText
  );

  // 4. Export raw AES key
  const rawAesKey = await subtle.exportKey('raw', aesKey);

  // 5. Encrypt AES key for each recipient with their RSA public key
  const encryptedKeys = [];
  for (const recipient of recipients) {
    const pubKey = await importPublicKey(recipient.publicKey);
    const encryptedKeyBuffer = await subtle.encrypt(
      { name: 'RSA-OAEP' },
      pubKey,
      rawAesKey
    );
    encryptedKeys.push({
      recipient: recipient.userId,
      key: arrayBufferToBase64(encryptedKeyBuffer),
    });
  }

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv),
    encryptedKeys,
  };
}

// Crypto Helper: Decrypt message with recipient's private key
async function decryptMessage(encryptedPayload, myUserId, myPrivateKeyBase64) {
  // 1. Find my encrypted key
  const keyEntry = encryptedPayload.encryptedKeys.find(
    (k) => (k.recipient?._id || k.recipient || k.recipient?.toString()) === myUserId.toString()
  );
  if (!keyEntry) {
    throw new Error('No encrypted key found for this recipient');
  }

  // 2. Decrypt AES key using RSA private key
  const myPrivateKey = await importPrivateKey(myPrivateKeyBase64);
  const rawAesKey = await subtle.decrypt(
    { name: 'RSA-OAEP' },
    myPrivateKey,
    base64ToArrayBuffer(keyEntry.key)
  );

  // 3. Import AES key
  const aesKey = await subtle.importKey(
    'raw',
    rawAesKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // 4. Decrypt ciphertext
  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToArrayBuffer(encryptedPayload.iv) },
    aesKey,
    base64ToArrayBuffer(encryptedPayload.ciphertext)
  );

  return new TextDecoder().decode(decryptedBuffer);
}

async function runStep18Tests() {
  console.log('=== STARTING STEP 18: END-TO-END ENCRYPTION (E2EE) TESTS ===\n');

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/messages', messageRoutes);

  const server = http.createServer(app);
  const PORT = 5015;

  await new Promise((resolve) => {
    server.listen(PORT, async () => {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aichatbot';
      await mongoose.connect(mongoUri);
      console.log(`1. Server running on port ${PORT} and connected to MongoDB`);
      resolve();
    });
  });

  try {
    const API_URL = `http://localhost:${PORT}/api`;
    const rand = Math.floor(Math.random() * 100000);

    // 2. Generate RSA Key Pairs for Alice and Bob
    console.log('\n2. Generating Web Crypto RSA-OAEP 2048-bit key pairs for Alice and Bob...');
    const aliceKeys = await generateRSAKeyPair();
    const bobKeys = await generateRSAKeyPair();
    console.log('✔ Alice & Bob key pairs generated successfully');
    console.log('  Alice Public Key prefix:', aliceKeys.publicKeyBase64.substring(0, 32) + '...');
    console.log('  Bob Public Key prefix:  ', bobKeys.publicKeyBase64.substring(0, 32) + '...');

    // 3. Register Alice and Bob
    console.log('\n3. Registering test users Alice and Bob...');
    const regAlice = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Alice E2EE ${rand}`,
        username: `alice_e2ee_${rand}`,
        email: `alice_${rand}@example.com`,
        password: 'password123',
      }),
    }).then((r) => r.json());

    const regBob = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Bob E2EE ${rand}`,
        username: `bob_e2ee_${rand}`,
        email: `bob_${rand}@example.com`,
        password: 'password123',
      }),
    }).then((r) => r.json());

    const aliceToken = regAlice.token;
    const aliceId = regAlice.user._id;
    const bobToken = regBob.token;
    const bobId = regBob.user._id;

    console.log('✔ Alice registered, ID:', aliceId);
    console.log('✔ Bob registered, ID:', bobId);

    // 4. Update Public Keys via PUT /api/users/public-key
    console.log('\n4. Updating public keys via PUT /api/users/public-key...');
    const updateAliceKey = await fetch(`${API_URL}/users/public-key`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({ publicKey: aliceKeys.publicKeyBase64 }),
    }).then((r) => r.json());

    if (!updateAliceKey.success || updateAliceKey.publicKey !== aliceKeys.publicKeyBase64) {
      throw new Error('Failed to update Alice public key');
    }
    console.log('✔ Alice public key registered in database');

    const updateBobKey = await fetch(`${API_URL}/users/public-key`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`,
      },
      body: JSON.stringify({ publicKey: bobKeys.publicKeyBase64 }),
    }).then((r) => r.json());

    if (!updateBobKey.success || updateBobKey.publicKey !== bobKeys.publicKeyBase64) {
      throw new Error('Failed to update Bob public key');
    }
    console.log('✔ Bob public key registered in database');

    // 5. Test fetching user public key via GET /api/users/:id/public-key
    console.log('\n5. Fetching Bob public key via GET /api/users/:id/public-key...');
    const fetchBobKey = await fetch(`${API_URL}/users/${bobId}/public-key`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    }).then((r) => r.json());

    if (!fetchBobKey.success || fetchBobKey.publicKey !== bobKeys.publicKeyBase64) {
      throw new Error('Fetched Bob public key does not match');
    }
    console.log('✔ Successfully fetched Bob public key from server');

    // 6. Create conversation between Alice and Bob
    console.log('\n6. Creating conversation between Alice and Bob...');
    const convRes = await fetch(`${API_URL}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({ recipientId: bobId }),
    }).then((r) => r.json());

    const conversationId = convRes.conversation._id;
    console.log('✔ Conversation created, ID:', conversationId);

    // Verify participants have public keys populated
    const bobParticipant = convRes.conversation.participants.find((p) => p._id.toString() === bobId.toString());
    if (!bobParticipant?.publicKey) {
      throw new Error('Bob public key not populated in conversation participants');
    }
    console.log('✔ Participants populated with public keys');

    // 7. Alice encrypts secret message for Alice & Bob
    console.log('\n7. Alice encrypts message using AES-GCM 256-bit + RSA-OAEP...');
    const secretText = 'Hello Bob, this is a secret E2EE message encrypted with AES-256-GCM and RSA-OAEP!';
    const encryptedPayload = await encryptMessage(secretText, [
      { userId: aliceId, publicKey: aliceKeys.publicKeyBase64 },
      { userId: bobId, publicKey: bobKeys.publicKeyBase64 },
    ]);

    console.log('✔ Message encrypted:');
    console.log('  Ciphertext (base64):', encryptedPayload.ciphertext.substring(0, 32) + '...');
    console.log('  IV (base64):', encryptedPayload.iv);
    console.log('  Encrypted keys count:', encryptedPayload.encryptedKeys.length);

    // 8. Send Encrypted Message via POST /api/messages
    console.log('\n8. Alice dispatches encrypted message to server...');
    const sendRes = await fetch(`${API_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        conversationId,
        isEncrypted: true,
        ciphertext: encryptedPayload.ciphertext,
        iv: encryptedPayload.iv,
        encryptedKeys: encryptedPayload.encryptedKeys,
      }),
    }).then((r) => r.json());

    if (!sendRes.success || !sendRes.message?.isEncrypted) {
      throw new Error('Failed to send encrypted message: ' + JSON.stringify(sendRes));
    }
    const messageId = sendRes.message._id;
    console.log('✔ Encrypted message stored in DB, messageId:', messageId);

    // 9. Inspect message stored in Database directly
    console.log('\n9. Verifying zero-knowledge server storage in MongoDB...');
    const dbMessage = await Message.findById(messageId).lean();
    if (!dbMessage.isEncrypted || !dbMessage.ciphertext || !dbMessage.iv) {
      throw new Error('Database message missing E2EE fields');
    }
    if (dbMessage.text === secretText) {
      throw new Error('SECURITY BREACH: Plaintext was stored in database!');
    }
    console.log('✔ Zero-knowledge verified: Database stores only ciphertext, not plaintext!');
    console.log('  DB stored text fallback:', dbMessage.text);
    console.log('  DB stored ciphertext:   ', dbMessage.ciphertext.substring(0, 32) + '...');

    // 10. Bob retrieves and decrypts the message
    console.log('\n10. Bob retrieves and decrypts the message with Bob private key...');
    const bobConvMessages = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    }).then((r) => r.json());

    const bobMsg = bobConvMessages.messages.find((m) => m._id.toString() === messageId.toString());
    if (!bobMsg || !bobMsg.isEncrypted) {
      throw new Error('Bob could not retrieve encrypted message');
    }

    const bobDecryptedText = await decryptMessage(bobMsg, bobId, bobKeys.privateKeyBase64);
    if (bobDecryptedText !== secretText) {
      throw new Error(`Bob decrypted text mismatch! Expected "${secretText}", got "${bobDecryptedText}"`);
    }
    console.log('✔ Bob successfully decrypted the message:');
    console.log('  Decrypted:', bobDecryptedText);

    // 11. Alice retrieves and decrypts the message with Alice private key
    console.log('\n11. Alice retrieves and decrypts the message with Alice private key...');
    const aliceDecryptedText = await decryptMessage(bobMsg, aliceId, aliceKeys.privateKeyBase64);
    if (aliceDecryptedText !== secretText) {
      throw new Error(`Alice decrypted text mismatch! Expected "${secretText}", got "${aliceDecryptedText}"`);
    }
    console.log('✔ Alice successfully decrypted the message:');
    console.log('  Decrypted:', aliceDecryptedText);

    // 12. Unauthorized third-party Eve tries to decrypt
    console.log('\n12. Verifying unauthorized third-party Eve cannot decrypt...');
    const eveKeys = await generateRSAKeyPair();
    let eveSuccess = false;
    try {
      await decryptMessage(bobMsg, aliceId, eveKeys.privateKeyBase64);
      eveSuccess = true;
    } catch {
      // Expected failure
    }

    if (eveSuccess) {
      throw new Error('SECURITY BREACH: Eve was able to decrypt the message!');
    }
    console.log('✔ Third-party decryption securely rejected (cryptographic failure as expected)');

    console.log('\n=============================================================');
    console.log('🎉 ALL STEP 18 END-TO-END ENCRYPTION TESTS PASSED! 🎉');
    console.log('=============================================================\n');
  } finally {
    await mongoose.disconnect();
    server.close();
  }
}

runStep18Tests().catch((err) => {
  console.error('\n❌ STEP 18 TEST FAILED:', err);
  process.exit(1);
});
