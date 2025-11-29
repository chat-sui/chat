"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@workspace/ui/components/card";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Separator } from "@workspace/ui/components/separator";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { getProfileCap } from "@/utils/queryer";


type Author = "me" | "other";

type Message = {
  id: number;
  author: Author;
  name: string;
  content: string;
  createdAt: string;
};

export default function ChatPage() {

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  console.log("Current Account:", currentAccount);

  getProfileCap({
    suiClient: suiClient,
    address: currentAccount?.address || "",
  })
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      author: "other",
      name: "Bot",
      content: "Hey! This is your brand new chat room UI 👋",
      createdAt: "10:00",
    },
    {
      id: 2,
      author: "me",
      name: "You",
      content: "Nice, UI looks clean.",
      createdAt: "10:01",
    },
  ]);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const now = new Date();
    const time = now.toTimeString().slice(0, 5);

    setMessages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        author: "me",
        name: "You",
        content: trimmed,
        createdAt: time,
      },
    ]);

    setInput("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="flex h-[600px] w-full max-w-2xl flex-col border-slate-800 bg-slate-900/70 backdrop-blur">
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">
              General Chat
            </h1>
            <p className="text-xs text-slate-400">
              A simple chat room built with shadcn/ui
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
            </span>
            <span className="text-xs text-slate-400">Online</span>
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-full">
            <div ref={scrollRef} className="flex h-full flex-col gap-4 p-4">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
            </div>
          </ScrollArea>
        </CardContent>

        <Separator className="bg-slate-800" />

        {/* Input */}
        <CardFooter className="p-3">
          <form
            onSubmit={handleSend}
            className="flex w-full items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="border-slate-700 bg-slate-900 text-slate-50 placeholder:text-slate-500 focus-visible:ring-slate-400"
            />
            <Button
              type="submit"
              className="shrink-0 bg-slate-50 text-slate-900 hover:bg-slate-200"
            >
              Send
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}

function ChatMessage({ message }: { message: Message }) {
  const isMe = message.author === "me";

  return (
    <div
      className={
        "flex w-full items-end gap-2 " +
        (isMe ? "justify-end" : "justify-start")
      }
    >
      {/* Avatar (left for others, right for me) */}
      {!isMe && (
        <Avatar className="h-7 w-7 border border-slate-700">
          <AvatarFallback className="bg-slate-800 text-xs text-slate-200">
            {message.name[0]?.toUpperCase() ?? "U"}
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={
          "flex max-w-[75%] flex-col gap-1" +
          (isMe ? " items-end text-right" : "")}
      >
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span>{message.name}</span>
          <span>·</span>
          <span>{message.createdAt}</span>
        </div>
        <div
          className={
            "rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm" +
            (isMe
              ? " rounded-br-sm bg-slate-50 text-slate-900"
              : " rounded-bl-sm bg-slate-800 text-slate-50")
          }
        >
          {message.content}
        </div>
      </div>

      {isMe && (
        <Avatar className="h-7 w-7 border border-slate-700">
          <AvatarFallback className="bg-slate-800 text-xs text-slate-200">
            Y
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
