import type { SealClient } from '@mysten/seal';

const SECRET_STORAGE_PREFIX = 'seal_encrypted_secret_';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function generateRandomBytes(byteLength: number = 32): Uint8Array {
  if (typeof window === 'undefined' || !window.crypto?.getRandomValues) {
    throw new Error('Secure random generator is not available in this environment.');
  }

  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

function normalizeBackupKey(key: unknown): string {
  // 依實際型別調整：這裡先支援 Uint8Array / string，其他型別就 JSON 序列化
  if (key instanceof Uint8Array) {
    return bytesToBase64(key);
  }
  if (typeof key === 'string') {
    return key;
  }
  return JSON.stringify(key);
}

/**
 * 產生一個隨機 secret，用 Seal 加密後，
 * 以 `${SECRET_STORAGE_PREFIX}${id}` 做 localStorage mapping 存起來。
 */
export async function createSealEncryptedSecretAndStore(params: {
  sealClient: SealClient;
  id: string;
  packageId: string;
  threshold?: number;
  byteLength?: number;
}): Promise<{
  id: string;
  storageKey: string;
  secretBase64: string;
  encryptedBase64: string;
  encryptedBytes: Uint8Array;
  backupKey: string;
}> {
  const { sealClient, id, packageId, threshold = 2, byteLength = 32 } = params;

  if (typeof window === 'undefined') {
    throw new Error('Window is not available in this environment.');
  }

  // 1) 產生隨機 secret bytes
  const secretBytes = generateRandomBytes(byteLength);
  const secretBase64 = bytesToBase64(secretBytes);

  // 2) 用 Seal 加密 secret
  const { encryptedObject: encryptedBytes, key: backupKeyRaw } =
    await sealClient.encrypt({
      threshold,
      packageId,
      id,
      data: secretBytes,
    });

  const encryptedBase64 = bytesToBase64(encryptedBytes);
  const backupKey = normalizeBackupKey(backupKeyRaw);

  // 3) 跟 id 做 mapping 存在 localStorage
  const storageKey = `${SECRET_STORAGE_PREFIX}${id}`;
  const payloadToStore = {
    id,
    encrypted: encryptedBase64,
    backupKey,
    secretBase64, // 儲存明文 secret
    // 如果未來要 rotate / 追蹤，可加上 meta
    createdAt: new Date().toISOString(),
  };

  window.localStorage.setItem(storageKey, JSON.stringify(payloadToStore));

  return {
    id,
    storageKey,
    secretBase64,
    encryptedBase64,
    encryptedBytes,
    backupKey,
  };
}

export function getStoredSecret(id: string): string | null {
  if (typeof window === 'undefined') return null;
  const storageKey = `${SECRET_STORAGE_PREFIX}${id}`;
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    return parsed.secretBase64 || null;
  } catch {
    return null;
  }
}
