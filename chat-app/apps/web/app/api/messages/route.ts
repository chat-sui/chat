import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');

  if (!roomId) {
    return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('timestamp', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, blobId, sender, timestamp } = body;

    if (!roomId || !blobId || !sender) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newMessage = {
      room_id: roomId,
      blob_id: blobId,
      sender,
      timestamp: timestamp || new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from('messages')
      .insert([newMessage])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: data });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
