/**
 * Client-Side End-to-End Encryption (E2EE) Service
 * Implemented using browser native Web Crypto API (window.crypto.subtle).
 * 
 * Standards:
 * - Asymmetric: RSA-OAEP 2048-bit (SHA-256) for public key exchange & AES key encapsulation
 * - Symmetric: AES-GCM 256-bit with 12-byte (96-bit) IV for authenticated message encryption
 */

const subtle = window.crypto?.subtle;

// Helper: ArrayBuffer to Base64
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper: Base64 to ArrayBuffer
export function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate a new RSA-OAEP 2048-bit key pair
 */
export async function generateKeyPair() {
  if (!subtle) throw new Error('Web Crypto API is not supported in this browser');

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
    publicKeyBase64: arrayBufferToBase64(spki),
    privateKeyBase64: arrayBufferToBase64(pkcs8),
  };
}

/**
 * Import public key from SPKI Base64 string
 */
export async function importPublicKey(spkiBase64) {
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

/**
 * Import private key from PKCS#8 Base64 string
 */
export async function importPrivateKey(pkcs8Base64) {
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

/**
 * Encrypt plaintext using AES-GCM-256 and wrap key for all recipients using RSA-OAEP
 * @param {string} plaintext - Message text to encrypt
 * @param {Array<{userId: string, publicKey: string}>} recipients - Target recipients with public keys
 */
export async function encryptMessage(plaintext, recipients) {
  if (!subtle) throw new Error('Web Crypto API is not supported');
  if (!recipients || recipients.length === 0) {
    throw new Error('No recipients provided for encryption');
  }

  // 1. Generate 256-bit AES-GCM symmetric key
  const aesKey = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // 2. Generate 12-byte initialization vector (IV)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt message plaintext with AES-GCM
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded
  );

  // 4. Export raw AES key
  const rawAesKey = await subtle.exportKey('raw', aesKey);

  // 5. Encrypt AES key for each recipient with their RSA public key
  const encryptedKeys = [];
  for (const r of recipients) {
    if (!r.publicKey) continue;
    try {
      const pubKey = await importPublicKey(r.publicKey);
      const encKeyBuffer = await subtle.encrypt(
        { name: 'RSA-OAEP' },
        pubKey,
        rawAesKey
      );
      encryptedKeys.push({
        recipient: r.userId,
        key: arrayBufferToBase64(encKeyBuffer),
      });
    } catch (err) {
      console.warn(`[cryptoService] Failed to encrypt key for recipient ${r.userId}:`, err.message);
    }
  }

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv),
    encryptedKeys,
  };
}

/**
 * Decrypt an encrypted message payload using current user's private key
 * @param {Object} message - Encrypted message object with ciphertext, iv, encryptedKeys
 * @param {string} myUserId - Current user ID
 * @param {string} myPrivateKeyBase64 - Current user's PKCS#8 private key Base64 string
 */
export async function decryptMessage(message, myUserId, myPrivateKeyBase64) {
  if (!subtle) throw new Error('Web Crypto API is not supported');
  if (!message || !message.isEncrypted || !message.ciphertext || !message.iv) {
    return message?.text || '';
  }

  if (!myPrivateKeyBase64) {
    return '🔒 Encrypted message (Private key not found)';
  }

  // Find recipient's encrypted key entry
  const keyEntry = message.encryptedKeys?.find(
    (k) => (k.recipient?._id || k.recipient || k.recipient?.toString()) === myUserId.toString()
  );

  if (!keyEntry || !keyEntry.key) {
    return '🔒 Encrypted message (Key not provided for your account)';
  }

  try {
    // 1. Decrypt raw AES key using RSA private key
    const privateKey = await importPrivateKey(myPrivateKeyBase64);
    const rawAesKey = await subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      base64ToArrayBuffer(keyEntry.key)
    );

    // 2. Import raw AES key
    const aesKey = await subtle.importKey(
      'raw',
      rawAesKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // 3. Decrypt ciphertext using AES-GCM and IV
    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToArrayBuffer(message.iv) },
      aesKey,
      base64ToArrayBuffer(message.ciphertext)
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error('[cryptoService] Decryption failed:', error.message);
    return '🔒 Decryption failed (Key mismatch or corrupted ciphertext)';
  }
}

/**
 * Storage helpers for persisting private and public keys in localStorage
 */
const STORAGE_PREFIX = 'aichatbot_e2ee_';

export function getStoredKeys(userId) {
  if (!userId) return null;
  const pub = localStorage.getItem(`${STORAGE_PREFIX}pub_${userId}`);
  const priv = localStorage.getItem(`${STORAGE_PREFIX}priv_${userId}`);
  if (pub && priv) {
    return { publicKey: pub, privateKey: priv };
  }
  return null;
}

export function storeKeys(userId, publicKeyBase64, privateKeyBase64) {
  if (!userId) return;
  localStorage.setItem(`${STORAGE_PREFIX}pub_${userId}`, publicKeyBase64);
  localStorage.setItem(`${STORAGE_PREFIX}priv_${userId}`, privateKeyBase64);
}

/**
 * Get or initialize user cryptographic keys.
 * If keys already exist in localStorage, returns them.
 * If not, generates a new RSA-OAEP key pair, stores them locally, and indicates server sync needed.
 */
export async function getOrInitUserKeys(userId, serverPublicKey = null) {
  const existing = getStoredKeys(userId);

  // If local keys exist and match server (or server has none yet)
  if (existing) {
    // If server has no key registered, we can upload existing local public key
    const needsServerSync = !serverPublicKey || serverPublicKey !== existing.publicKey;
    return {
      publicKey: existing.publicKey,
      privateKey: existing.privateKey,
      needsServerSync,
    };
  }

  // Generate new key pair
  const newKeys = await generateKeyPair();
  storeKeys(userId, newKeys.publicKeyBase64, newKeys.privateKeyBase64);

  return {
    publicKey: newKeys.publicKeyBase64,
    privateKey: newKeys.privateKeyBase64,
    needsServerSync: true,
  };
}

/**
 * Generate WhatsApp/Signal style Safety Number (60-digit fingerprint formatted in 12 5-digit blocks)
 * Computed by SHA-256 hashing the sorted concatenation of both users' public keys.
 */
export async function generateSafetyNumber(myPublicKey, otherPublicKey) {
  if (!myPublicKey || !otherPublicKey) return '00000 00000 00000 00000 00000 00000';

  try {
    // Sort keys alphabetically for commutative verification between both users
    const combined = [myPublicKey, otherPublicKey].sort().join(':');
    const hashBuffer = await subtle.digest('SHA-256', new TextEncoder().encode(combined));
    const hashBytes = new Uint8Array(hashBuffer);

    // Derive 12 5-digit number chunks
    const chunks = [];
    for (let i = 0; i < 12; i++) {
      const idx1 = (i * 2) % hashBytes.length;
      const idx2 = (i * 2 + 1) % hashBytes.length;
      const val = ((hashBytes[idx1] << 8) | hashBytes[idx2]) % 100000;
      chunks.push(String(val).padStart(5, '0'));
    }

    return chunks.join(' ');
  } catch (err) {
    console.error('[cryptoService] Failed to generate safety number:', err);
    return '00000 00000 00000 00000 00000 00000';
  }
}

export default {
  generateKeyPair,
  importPublicKey,
  importPrivateKey,
  encryptMessage,
  decryptMessage,
  getStoredKeys,
  storeKeys,
  getOrInitUserKeys,
  generateSafetyNumber,
};
