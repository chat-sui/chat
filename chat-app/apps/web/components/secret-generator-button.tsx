// components/secret-generator-button.tsx
'use client';

import { useCallback, useState } from 'react';
import { Button } from '@workspace/ui/components/button';
import { KeyRound, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { sealClient } from '@/utils/sealClient';
import { packageID } from '@/utils/package';
const SECRET_STORAGE_KEY = 'seal_local_secret';

/**
 * Core function:
 * 安全隨機產生一個 secret，並存到 localStorage。
 * 之後如果要改編碼格式 / 長度 / 存放位置，只要改這裡。
 */
export function createAndStoreSecret(byteLength: number = 32): string {
  if (typeof window === 'undefined' || !window.crypto?.getRandomValues) {
    throw new Error('Secure random generator is not available in this environment.');
  }

  // 1. 產生安全隨機位元組
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);

  // 2. 轉成 base64（也可以換成 hex，看你偏好）
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const secret = btoa(binary);

  // 3. 存到 localStorage
  window.localStorage.setItem(SECRET_STORAGE_KEY, secret);

  return secret;
}



export function SecretGeneratorButton() {
  const [loading, setLoading] = useState(false);
  const [lastSecret, setLastSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const secret = createAndStoreSecret(32); // 32 bytes => 256-bit secret
      setLastSecret(secret);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Failed to generate and store secret.';
      setError(msg);
      setLastSecret(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="w-full max-w-md space-y-3">
      <Button
        type="button"
        className="w-full gap-2"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <KeyRound className="h-4 w-4" />
        )}
        <span>Generate & store secret</span>
      </Button>

      {lastSecret && !error && (
        <div className="flex flex-col gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="font-medium text-emerald-500">
              Secret generated & saved to localStorage
            </span>
          </div>
          <p>
            <span className="font-semibold">Storage key:&nbsp;</span>
            <code>{SECRET_STORAGE_KEY}</code>
          </p>
          <p className="break-all">
            <span className="font-semibold">Secret (base64):&nbsp;</span>
            <code>{lastSecret}</code>
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
