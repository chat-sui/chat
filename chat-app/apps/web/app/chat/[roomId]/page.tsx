// app/chat/[roomId]/page.tsx
import ChatPageClient from "./ChatPageClient";

type PageProps = {
  params: Promise<{
    roomId: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { roomId } = await params;
  return <ChatPageClient roomId={roomId} />;
}

