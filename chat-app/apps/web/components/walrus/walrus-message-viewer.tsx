// components/walrus-message-viewer.tsx
'use client';

import * as React from 'react';
import { ChevronDown, ExternalLink, MessageCircle } from 'lucide-react';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { getFullnodeUrl } from '@mysten/sui/client';
import { walrus } from '@mysten/walrus';

import type { MessageBlob } from '@/utils/upload_relay';

type Network = 'testnet' | 'mainnet' | 'devnet';

interface WalrusMessageViewerProps {
  blobId: string;
  network?: Network;
  className?: string;
}

function buildWalruscanUrl(blobId: string, network: Network): string {
  const path = network === 'mainnet' ? 'mainnet' : network;
  return `https://walruscan.com/${path}/blob/${blobId}`;
}

export const WalrusMessageViewer: React.FC<WalrusMessageViewerProps> = ({
  blobId,
  network = 'testnet',
  className = '',
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<MessageBlob | null>(null);
  const [rawText, setRawText] = React.useState<string | null>(null);

  const walrusClient = React.useMemo(
    () =>
      new SuiJsonRpcClient({
        url: getFullnodeUrl(network),
        network,
      }).$extend(
        walrus({
          // extra config if needed
        }),
      ),
    [network],
  );

  React.useEffect(() => {
    if (!isOpen || !blobId) return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const [file] = await walrusClient.walrus.getFiles({ ids: [blobId] });
        if (!file) {
          throw new Error('File not found');
        }
        const text = await file.text();
        if (cancelled) return;

        setRawText(text);

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }

        if (
          parsed &&
          typeof parsed === 'object' &&
          'file_type' in parsed &&
          'file' in parsed &&
          'timestamp' in parsed
        ) {
          const obj = parsed as MessageBlob;
          setMessage(obj);
        } else {
          setMessage(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? String(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [blobId, walrusClient, isOpen]);

  const walruscanUrl = buildWalruscanUrl(blobId, network);
  const timestamp =
    message?.timestamp ? new Date(message.timestamp).toLocaleString() : null;

  return (
    <div className={`rounded-lg border bg-card shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setIsOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Walrus Message Viewer</span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {blobId.slice(0, 10)}...{blobId.slice(-6)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {message && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary capitalize">
              {message.file_type}
            </span>
          )}
          <a
            href={walruscanUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted transition-colors"
          >
            <span>Walruscan</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Body */}
      <div
        className={`transition-[max-height,opacity] duration-200 ease-in-out ${
          isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="border-t px-4 py-3 text-sm">
          {loading && (
            <div className="animate-pulse space-y-2 text-muted-foreground">
              <div className="h-3 w-1/3 rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          )}

          {!loading && error && (
            <div className="text-xs text-red-500">Failed to load blob: {error}</div>
          )}

          {!loading && !error && (
            <>
              {message ? (
                <div className="space-y-3">
                  {timestamp && (
                    <p className="text-[11px] text-muted-foreground">{timestamp}</p>
                  )}

                  {/* text */}
                  {message.file_type === 'text' && (
                    <div className="rounded-md bg-muted/60 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                      {message.file}
                    </div>
                  )}

                  {/* image */}
                  {message.file_type === 'image' && (
                    <div className="rounded-md bg-muted/40 p-2 flex justify-center">
                      <img
                        src={message.file}
                        alt="Walrus image"
                        className="max-h-80 object-contain rounded-md"
                      />
                    </div>
                  )}

                  {/* video */}
                  {message.file_type === 'video' && (
                    <div className="rounded-md bg-muted/40 p-2">
                      <video
                        controls
                        className="w-full rounded-md"
                        src={message.file}
                      />
                    </div>
                  )}

                  {/* audio */}
                  {message.file_type === 'audio' && (
                    <div className="rounded-md bg-muted/40 p-2">
                      <audio controls className="w-full" src={message.file} />
                    </div>
                  )}

                  {/* download for media */}
                  {message.file_type !== 'text' && (
                    <div className="pt-1">
                      <a
                        href={message.file}
                        download
                        className="text-[11px] underline underline-offset-2 text-primary hover:text-primary/80"
                      >
                        Download original file
                      </a>
                    </div>
                  )}

                  {/* raw JSON */}
                  {rawText && (
                    <details className="mt-2 text-[11px] text-muted-foreground">
                      <summary className="cursor-pointer">View raw JSON</summary>
                      <pre className="mt-1 max-h-60 overflow-auto rounded bg-background/80 p-2 text-[11px] whitespace-pre-wrap">
                        {rawText}
                      </pre>
                    </details>
                  )}
                </div>
              ) : (
                rawText && (
                  <div className="space-y-2 text-xs">
                    <p className="text-muted-foreground">
                      Blob is not a valid MessageBlob, showing raw text:
                    </p>
                    <pre className="max-h-72 overflow-auto rounded bg-muted/60 p-2 whitespace-pre-wrap">
                      {rawText}
                    </pre>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
