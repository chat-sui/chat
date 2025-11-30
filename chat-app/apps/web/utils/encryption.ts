
export async function encryptData(data: string, keyBase64: string): Promise<string> {
  if (typeof window === 'undefined') throw new Error("Browser environment required");

  const keyBytes = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
  const key = await window.crypto.subtle.importKey(
    "raw", keyBytes, "AES-GCM", false, ["encrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(data);

  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encodedData
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(encryptedBase64: string, keyBase64: string): Promise<string> {
  if (typeof window === 'undefined') throw new Error("Browser environment required");

  const keyBytes = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
  const key = await window.crypto.subtle.importKey(
    "raw", keyBytes, "AES-GCM", false, ["decrypt"]
  );

  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  return new TextDecoder().decode(decrypted);
}
