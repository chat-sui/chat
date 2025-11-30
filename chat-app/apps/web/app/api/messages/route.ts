import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define the path to the JSON file
const dataFilePath = path.join(process.cwd(), 'data', 'messages.json');

// Ensure the data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Helper to read messages
function readMessages() {
  if (!fs.existsSync(dataFilePath)) {
    return {};
  }
  const fileContent = fs.readFileSync(dataFilePath, 'utf-8');
  try {
    return JSON.parse(fileContent);
  } catch (error) {
    return {};
  }
}

// Helper to write messages
function writeMessages(data: any) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');

  if (!roomId) {
    return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
  }

  const allMessages = readMessages();
  const roomMessages = allMessages[roomId] || [];

  return NextResponse.json({ messages: roomMessages });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, blobId, sender, timestamp } = body;

    if (!roomId || !blobId || !sender) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const allMessages = readMessages();
    if (!allMessages[roomId]) {
      allMessages[roomId] = [];
    }

    const newMessage = {
      blobId,
      sender,
      timestamp: timestamp || new Date().toISOString(),
    };

    allMessages[roomId].push(newMessage);
    writeMessages(allMessages);

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
