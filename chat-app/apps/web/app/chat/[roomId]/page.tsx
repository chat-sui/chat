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
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { getProfileCap } from "@/utils/queryer";
// 引入圖標，用於 ChatAttachmentOptions 和觸發按鈕
import { Paperclip, Image, Gift, Wallet, Smile, X, Plus } from "lucide-react";
import { createSealEncryptedSecretAndStore } from "@/utils/sealSecret";
import { sealClient } from "@/utils/sealClient";
import { packageID } from "@/utils/package";
import { update_encryption_key } from "@/utils/tx/update_encryption_key";

// --- 介面定義 (與您原有的相同) ---
type Author = "me" | "other";

type Message = {
  id: number;
  author: Author;
  name: string;
  content: string;
  createdAt: string;
};

// --- ChatAttachmentOptions 組件 (從上一輪對話複製並整合到此) ---
interface AttachmentOption {
  name: string;
  icon: React.ElementType;
  action: () => void;
  colorClass: string;
}

// 接收一個 prop 來處理關閉動作
function ChatAttachmentOptions({ onClose }: { onClose: () => void }) {

  const handleAttach = (item: string) => {
    console.log(`Action: Adding ${item}`);
    // 這裡可以選擇在點擊後立即關閉列表
    // onClose(); 
  };

  const options: AttachmentOption[] = [
    { name: "Image", icon: Image, action: () => handleAttach("Image"), colorClass: "text-blue-400 hover:text-blue-300" },
    { name: "File", icon: Paperclip, action: () => handleAttach("File"), colorClass: "text-slate-400 hover:text-slate-300" },
    { name: "SUI Asset", icon: Wallet, action: () => handleAttach("Asset"), colorClass: "text-emerald-400 hover:text-emerald-300" },
    { name: "Gift (NFT)", icon: Gift, action: () => handleAttach("Gift"), colorClass: "text-pink-400 hover:text-pink-300" },
    { name: "Emoji", icon: Smile, action: () => handleAttach("Emoji"), colorClass: "text-yellow-400 hover:text-yellow-300" },
  ];

  return (
    // 使用深色背景和邊框，風格類似於 ChatPage 的 CardFooter
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
            <span className="text-slate-400 group-hover:text-slate-200">{option.name}</span>
          </Button>
        ))}

        <div className="h-8 w-px bg-slate-800/50 mx-1" />

        {/* 關閉按鈕，觸發 ChatPage 傳入的 onClose 函式 */}
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

// --- ChatPage 組件 (修改部分) ---
export default function ChatPage({ params }: { params: { roomId: string } }) {
  const { roomId } = params;
  // ... (原有的 Hooks 和靜態資料) ...
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [messages, setMessages] = useState<Message[]>([
    { id: 1, author: "other", name: "Bot", content: "Hey! This is your brand new chat room UI 👋", createdAt: "10:00" },
    { id: 2, author: "me", name: "You", content: "Nice, UI looks clean.", createdAt: "10:01" },
  ]);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 💥 [新增狀態] 控制附件列表顯示
  const [showAttachments, setShowAttachments] = useState(false);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Check and create encryption key
  useEffect(() => {
    const checkAndCreateKey = async () => {
        if (!currentAccount || !roomId) return;

        try {
            // 1. Fetch Chatroom object
            const chatroomObj = await suiClient.getObject({
                id: roomId,
                options: { showContent: true }
            });

            if (chatroomObj.data?.content?.dataType !== "moveObject") return;
            const fields = chatroomObj.data.content.fields as any;
            
            // 2. Check encryption_key
            const encryptionKey = fields.encryption_key;
            // If encryption_key is empty (vector<u8> is empty)
            const isKeyEmpty = !encryptionKey || encryptionKey.length === 0;

            if (isKeyEmpty) {
                console.log("Encryption key missing. Creating new one...");
                
                // 3. Create new key
                const { encryptedBytes } = await createSealEncryptedSecretAndStore({
                    sealClient,
                    id: roomId,
                    packageId: packageID,
                });

                // 4. Get ProfileCap
                const profileCapRes = await getProfileCap({
                    suiClient,
                    address: currentAccount.address
                });
                
                if (!profileCapRes || !profileCapRes.data || profileCapRes.data.length === 0) {
                    console.error("ProfileCap not found");
                    return;
                }
                const profileCapId = profileCapRes.data[0].data.objectId;

                // 5. Update on-chain
                const tx = update_encryption_key(roomId, profileCapId, encryptedBytes);
                
                signAndExecuteTransaction({
                    transaction: tx,
                }, {
                    onSuccess: () => {
                        console.log("Encryption key updated successfully");
                    },
                    onError: (err) => {
                        console.error("Failed to update encryption key", err);
                    }
                });
            }
        } catch (e) {
            console.error("Error checking/creating key:", e);
        }
    };

    checkAndCreateKey();
  }, [currentAccount, roomId, suiClient, signAndExecuteTransaction]);

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
        {/* Header (不變) */}
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">General Chat</h1>
            <p className="text-xs text-slate-400">A simple chat room built with shadcn/ui</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
            </span>
            <span className="text-xs text-slate-400">Online</span>
          </div>
        </CardHeader>

        {/* Messages (不變) */}
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

        {/* 💥 [條件渲染] 在分隔線和 Input 之間插入附件選項列表 */}
        {showAttachments && <ChatAttachmentOptions onClose={() => setShowAttachments(false)} />}

        {/* Input (修改部分) */}
        <CardFooter className="p-3">
          <form
            onSubmit={handleSend}
            className="flex w-full items-center gap-2"
          >
            {/* 💥 [新增按鈕] 切換附件列表的顯示 */}
            <Button
              type="button" // 設置為 button 類型，避免觸發 form submit
              onClick={() => setShowAttachments(!showAttachments)}
              variant="ghost"
              size="icon"
              className={`
                shrink-0 text-slate-400 hover:bg-slate-800 hover:text-slate-50 transition-all duration-200
                ${showAttachments ? 'rotate-45 text-emerald-400' : ''} 
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

// --- ChatMessage 組件 (不變) ---
function ChatMessage({ message }: { message: Message }) {
  const isMe = message.author === "me";
  // ... (原有的 ChatMessage 程式碼) ...
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