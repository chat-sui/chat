// app/chat/[roomId]/ChatPageClient.tsx
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
import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { getProfileCap } from "@/utils/queryer";
import { Paperclip, Image, Gift, Wallet, Smile, X, Plus } from "lucide-react";
import {
  createSealEncryptedSecretAndStore,
  getStoredSecret,
} from "@/utils/sealSecret";
import { sealClient } from "@/utils/sealClient";
import { packageID } from "@/utils/package";
import { update_encryption_key } from "@/utils/tx/update_encryption_key";
import { uploadMessageBlob, MessageBlob } from "@/utils/upload_relay";
import { encryptData } from "@/utils/encryption";
import { publish_message } from "@/utils/tx/publish_message";
import { WalrusMessageUploader } from "@/components/walrus/uploader";


type Author = "me" | "other";

type Message = {
  id: number;
  author: Author;
  name: string;
  content: string;
  createdAt: string;
};

interface AttachmentOption {
  name: string;
  icon: React.ElementType;
  action: () => void;
  colorClass: string;
}



function ChatAttachmentOptions({ onClose }: { onClose: () => void }) {
  const handleAttach = (item: string) => {
  };

  const options: AttachmentOption[] = [
    {
      name: "Image",
      icon: Image,
      action: () => handleAttach("Image"),
      colorClass: "text-blue-400 hover:text-blue-300",
    },
    {
      name: "File",
      icon: Paperclip,
      action: () => handleAttach("File"),
      colorClass: "text-slate-400 hover:text-slate-300",
    },
    {
      name: "SUI Asset",
      icon: Wallet,
      action: () => handleAttach("Asset"),
      colorClass: "text-emerald-400 hover:text-emerald-300",
    },
    {
      name: "Gift (NFT)",
      icon: Gift,
      action: () => handleAttach("Gift"),
      colorClass: "text-pink-400 hover:text-pink-300",
    },
    {
      name: "Emoji",
      icon: Smile,
      action: () => handleAttach("Emoji"),
      colorClass: "text-yellow-400 hover:text-yellow-300",
    },
  ];

  return (
    <div className="w-full bg-slate-900/70 border-t border-slate-800 p-2 shadow-xl">
      <div className="flex items-center gap-3">
        {options.map((option) => (
          <Button
            key={option.name}
            onClick={option.action}
            variant="ghost"
            size="sm"
            className={`
              flex flex-col items-center justify-center p-1 h-auto w-16 text-xs transition-colors duration-200 
              ${option.colorClass} 
              hover:bg-slate-800/70
            `}
          >
            <option.icon className="h-5 w-5 mb-1" />
            <span className="text-slate-400 group-hover:text-slate-200">
              {option.name}
            </span>
          </Button>
        ))}

        <div className="h-8 w-px bg-slate-800/50 mx-1" />

        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="text-slate-500 hover:bg-slate-800 hover:text-slate-300 ml-auto"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}



// ✅ Now a normal client component, receives roomId as string prop
export default function ChatPageClient({ roomId }: { roomId: string }) {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
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
  const [showAttachments, setShowAttachments] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const checkAndCreateKey = async () => {
      if (!currentAccount || !roomId) return;

      try {
        const chatroomObj = await suiClient.getObject({
          id: roomId,
          options: { showContent: true },
        });

        if (chatroomObj.data?.content?.dataType !== "moveObject") return;
        const fields = chatroomObj.data.content.fields as any;

        const encryptionKey = fields.encryption_key;
        const isKeyEmpty = !encryptionKey || encryptionKey.length === 0;
        if (isKeyEmpty) {

          const { encryptedBytes } = await createSealEncryptedSecretAndStore({
            sealClient,
            id: roomId,
            packageId: packageID,
          });

          const profileCapRes = await getProfileCap({
            suiClient,
            address: currentAccount.address,
          });

          if (!profileCapRes || !profileCapRes.data || profileCapRes.data.length === 0) {
            console.error("ProfileCap not found");
            return;
          }
          const profileCapId = profileCapRes.data[0].data.objectId;

          const tx = update_encryption_key(roomId, profileCapId, encryptedBytes);

          signAndExecuteTransaction(
            {
              transaction: tx,
            },
            {
              onSuccess: () => {
                    console.log("Encryption key updated successfully");
              },
              onError: (err) => {
                console.error("Failed to update encryption key", err);
              },
            },
          );
        }
      } catch (e) {
        console.error("Error checking/creating key:", e);
      }
    };

    checkAndCreateKey();
  }, [currentAccount, roomId, suiClient, signAndExecuteTransaction]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    if (!currentAccount) {
      console.error("No account connected");
      return;
    }

    const secret = getStoredSecret(roomId);
    if (!secret) {
      alert("No encryption key found! Please wait for key generation or restore it.");
      return;
    }

    try {
      const msgBlob: MessageBlob = {
        file_type: "text",
        file: trimmed,
        timestamp: new Date().toISOString(),
      };

      const encryptedContent = await encryptData(JSON.stringify(msgBlob), secret);

      const uploadRes = await uploadMessageBlob({
        file_type: "text",
        file: encryptedContent,
        timestamp: new Date().toISOString(),
      });

      console.log("Uploaded to Walrus:", uploadRes);

      const profileCapRes = await getProfileCap({
        suiClient,
        address: currentAccount.address,
      });

      if (!profileCapRes || !profileCapRes.data || profileCapRes.data.length === 0) {
        console.error("ProfileCap not found");
        return;
      }
      const profileCapId = profileCapRes.data[0].data.objectId;

      const tx = publish_message(roomId, profileCapId, uploadRes.blobId);

      signAndExecuteTransaction(
        {
          transaction: tx,
        },
        {
          onSuccess: () => {
            console.log("Message published to chain!");
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
          },
          onError: (err) => {
            console.error("Failed to publish message to chain", err);
          },
        },
      );
    } catch (error) {
      console.error("Send failed", error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="flex h-[600px] w-full max-w-2xl flex-col border-slate-800 bg-slate-900/70 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">General Chat</h1>
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

        {showAttachments && (
          <ChatAttachmentOptions onClose={() => setShowAttachments(false)} />
        )}

        <CardFooter className="p-3">
          <form
            onSubmit={handleSend}
            className="flex w-full items-center gap-2"
          >
            <Button
              type="button"
              onClick={() => setShowAttachments(!showAttachments)}
              variant="ghost"
              size="icon"
              className={`
                shrink-0 text-slate-400 hover:bg-slate-800 hover:text-slate-50 transition-all duration-200
                ${showAttachments ? "rotate-45 text-emerald-400" : ""} 
              `}
            >
              <Plus className="h-5 w-5" />
            </Button>

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
          (isMe ? " items-end text-right" : "")
        }
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
