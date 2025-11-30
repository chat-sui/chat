// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

import { client } from './client';

export interface WalrusUploadResult {
  id: string;    // Quilt ID
  blobId: string; // Blob ID
}

export type MessageFileType = 'text' | 'image' | 'video' | 'audio';

export interface MessageBlob {
  file_type: MessageFileType;
  /**
   * text: raw text
   * image / video / audio: data URL (e.g. "data:image/png;base64,...")
   */
  file: string;
  timestamp: string; // ISO
}

// Create a keypair using environment variable for secure key management
async function getKeypair(): Promise<Ed25519Keypair> {

	try {
		return Ed25519Keypair.fromSecretKey("suiprivkey1qrqp6xtphngqg9nh488v6hyvev229wl6w964nuukl9l95c090pkskvuznyd");
	} catch {
		throw new Error('Invalid WALRUS_SECRET_KEY format. Please ensure it is a valid base64 encoded secret key.');
	}
};

export async function uploadFile(text: string): Promise<WalrusUploadResult> {
  const payload = {
    filename: 'snippet.txt',
    code: text,
    timestamp: new Date().toISOString(),
    type: 'code-snippet',
  };

  return uploadJsonPayload(payload);
}

async function uploadJsonPayload(payload: unknown): Promise<WalrusUploadResult> {
  const keypair = await getKeypair();
  const json = JSON.stringify(payload);
  const file = new TextEncoder().encode(json);

  const { blobId, blobObject } = await client.walrus.writeBlob({
    blob: file,
    deletable: true,
    epochs: 3,
    signer: keypair,
  });

  console.log(blobId, blobObject);

  return {
    id: blobObject.id.id,
    blobId,
  };
}

export async function uploadMessageBlob(message: MessageBlob): Promise<WalrusUploadResult> {
  return uploadJsonPayload(message);
}