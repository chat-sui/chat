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
    useSignPersonalMessage,
} from "@mysten/dapp-kit";
import { getProfileCap } from "@/utils/queryer";
import { Paperclip, Image, Gift, Wallet, Smile, X, Plus, Mic, Trash2 } from "lucide-react";
import {
    createSealEncryptedSecretAndStore,
    getStoredSecret,
    storeSecret,
} from "@/utils/sealSecret";
import { sealClient } from "@/utils/sealClient";
import { SessionKey, NoAccessError, EncryptedObject } from '@mysten/seal';
import { packageID } from "@/utils/package";
import { update_encryption_key } from "@/utils/tx/update_encryption_key";
import { uploadMessageBlob, MessageBlob } from "@/utils/upload_relay";
import { encryptData, decryptData } from "@/utils/encryption";
import { WalrusMessageUploader } from "@/components/walrus/uploader";
import { Transaction } from "@mysten/sui/transactions";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { fromHex } from "@mysten/sui/utils";


type Author = "me" | "other";

type MessageType = 'text' | 'image' | 'video' | 'audio';

type Message = {
    id: number | string;
    author: Author;
    name: string;
    content: string;
    type: MessageType;
    createdAt: string;
};

interface AttachmentOption {
    name: string;
    icon: React.ElementType;
    action: () => void;
    colorClass: string;
}

function ChatAttachmentOptions({ onClose, onAttach }: { onClose: () => void, onAttach: (type: string) => void }) {
    const handleAttach = (item: string) => {
        onAttach(item);
        // onClose(); // Optional: close after selection
    };

    const options: AttachmentOption[] = [
        {
            name: "Image",
            icon: Image,
            action: () => handleAttach("image"),
            colorClass: "text-blue-400 hover:text-blue-300",
        },
        {
            name: "File",
            icon: Paperclip,
            action: () => handleAttach("file"), // Treat as generic file or text? Let's stick to media for now or map to text
            colorClass: "text-slate-400 hover:text-slate-300",
        },
        {
            name: "SUI Asset",
            icon: Wallet,
            action: () => handleAttach("asset"),
            colorClass: "text-emerald-400 hover:text-emerald-300",
        },
        {
            name: "Gift (NFT)",
            icon: Gift,
            action: () => handleAttach("gift"),
            colorClass: "text-pink-400 hover:text-pink-300",
        },
        {
            name: "Emoji",
            icon: Smile,
            action: () => handleAttach("emoji"),
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
    const [messages, setMessages] = useState<Message[]>([]);
    const { mutate: signPersonalMessage } = useSignPersonalMessage();
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [showAttachments, setShowAttachments] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [uploadType, setUploadType] = useState<MessageType>('text');

    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const { mutate: signAndExecute } = useSignAndExecuteTransaction({
        execute: async ({ bytes, signature }) =>
            await suiClient.executeTransactionBlock({
                transactionBlock: bytes,
                signature,
                options: {
                    showRawEffects: true,
                    showEffects: true,
                },
            }),
    });
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Fetch messages on load
    useEffect(() => {
        const loadMessages = async () => {
            if (!roomId) return;
            try {
                const res = await fetch(`/api/messages?roomId=${roomId}`);
                const data = await res.json();
                if (!data.messages) return;

                const secret = getStoredSecret(roomId);
                // If no secret, we can't decrypt, maybe show placeholder?
                // For now, just return or skip decryption
                if (!secret) {
                    console.log("No secret found, cannot decrypt messages");
                    return;
                }

                const loadedMessages: Message[] = [];

                for (const msg of data.messages) {
                    try {
                        // Fetch Blob from Aggregator
                        const blobRes = await fetch(`https://aggregator.testnet.walrus.atalma.io/v1/blobs/${msg.blobId}`);
                        if (!blobRes.ok) continue;
                        const encryptedText = await blobRes.text();

                        // Parse the JSON wrapper first
                        let encryptedContent = encryptedText;
                        try {
                            const wrapper = JSON.parse(encryptedText);
                            if (wrapper && wrapper.file) {
                                encryptedContent = wrapper.file;
                            }
                        } catch (e) {
                            // If it's not JSON, assume it's the raw encrypted string (backward compatibility or different upload method)
                            console.log("Blob content is not JSON, assuming raw encrypted string");
                        }

                        // Decrypt
                        const decryptedJson = await decryptData(encryptedContent, secret);
                        const msgBlob: MessageBlob = JSON.parse(decryptedJson);

                        loadedMessages.push({
                            id: msg.blobId,
                            author: msg.sender === currentAccount?.address ? 'me' : 'other',
                            name: msg.sender === currentAccount?.address ? 'You' : 'Friend',
                            content: msgBlob.file,
                            type: (msgBlob.file_type as MessageType) || 'text',
                            createdAt: new Date(msg.timestamp).toTimeString().slice(0, 5)
                        });
                    } catch (e) {
                        console.error("Failed to load message", msg.blobId, e);
                    }
                }
                setMessages(loadedMessages);

            } catch (e) {
                console.error("Error loading messages", e);
            }
        };
        loadMessages();
    }, [roomId, currentAccount]);

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
                const localSecret = getStoredSecret(roomId);

                // Case 1: Key exists on chain, but not locally. Decrypt it.
                if (!localSecret && encryptionKey && encryptionKey.length > 0) {
                    console.log("Found encrypted key on chain, attempting to decrypt...");

                    const profileCapRes = await getProfileCap({
                        suiClient,
                        address: currentAccount.address,
                    });

                    if (!profileCapRes || !profileCapRes.data || profileCapRes.data.length === 0) {
                        console.error("ProfileCap not found");
                        return;
                    }
                    const profileCapId = profileCapRes.data[0].data.objectId;

                    const sessionKey = await SessionKey.create({
                        address: currentAccount.address,
                        packageId: packageID,
                        ttlMin: 10,
                        suiClient: new SuiClient({ url: getFullnodeUrl('testnet') }),
                    });

                    const message = sessionKey.getPersonalMessage();
                    signPersonalMessage(
                        { message },
                        {
                            onSuccess: async (result) => {
                                await sessionKey.setPersonalMessageSignature(result.signature);

                                const tx = new Transaction();
                                tx.moveCall({
                                    target: `${packageID}::chat_contract::profile_seal_approve`,
                                    arguments: [
                                        tx.pure.vector('u8', fromHex(roomId)),
                                        tx.object(profileCapId),
                                        tx.object(roomId)
                                    ],
                                });

                                const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

                                try {
                                    const decryptedBytes = await sealClient.decrypt({
                                        data: new Uint8Array(encryptionKey),
                                        sessionKey,
                                        txBytes,
                                    });

                                    let binary = '';
                                    const len = decryptedBytes.byteLength;
                                    for (let i = 0; i < len; i++) {
                                        binary += String.fromCharCode(decryptedBytes[i]);
                                    }
                                    const secretBase64 = window.btoa(binary);

                                    storeSecret(roomId, secretBase64);
                                    console.log("Secret decrypted and stored!");
                                    window.location.reload();
                                } catch (e) {
                                    console.error("Decryption failed", e);
                                }
                            },
                        }
                    );
                    return;
                }

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
    }, [currentAccount, roomId, suiClient, signAndExecuteTransaction, signPersonalMessage]);

    const handleTransferSuiAsset = async () => {
        const recipient = window.prompt("Enter recipient address for 100 MIST transfer:");
        if (!recipient) return;

        try {
            const tx = new Transaction();
            const [coin] = tx.splitCoins(tx.gas, [100]);
            tx.transferObjects([coin], recipient);
            signAndExecuteTransaction({ transaction: tx }, {
                onSuccess: () => alert("Transfer successful!"),
                onError: (e) => alert("Transfer failed: " + e)
            });
        } catch (e) {
            console.error(e);
        }
    };

    const handleAttachmentSelect = (type: string) => {
        if (type === 'asset') {
            handleTransferSuiAsset();
        } else if (['image', 'video', 'audio'].includes(type)) {
            setUploadType(type as MessageType);
            if (fileInputRef.current) {
                fileInputRef.current.click();
            }
        } else {
            console.log("Attachment type not implemented:", type);
        }
        setShowAttachments(false);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            if (typeof reader.result === 'string') {
                await sendMessage(reader.result, uploadType);
            }
        };
        reader.readAsDataURL(file);
        // Reset input
        e.target.value = '';
    };

    const sendMessage = async (content: string, type: MessageType) => {
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
                file_type: type,
                file: content,
                timestamp: new Date().toISOString(),
            };

            const encryptedContent = await encryptData(JSON.stringify(msgBlob), secret);

            const uploadRes = await uploadMessageBlob({
                file_type: type, // This is metadata for Walrus, but we are encrypting the content anyway. 
                // Ideally we might want to hide this too, but for now let's keep it consistent.
                // Actually, uploadMessageBlob takes MessageBlob which has file_type.
                // We are passing encrypted content as 'file'.
                file: encryptedContent,
                timestamp: new Date().toISOString(),
            });

            console.log("Uploaded to Walrus:", uploadRes);

            // Store in Next.js API
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roomId,
                    blobId: uploadRes.blobId,
                    sender: currentAccount.address,
                    timestamp: new Date().toISOString(),
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save message to API');
            }

            console.log("Message saved to API!");
            const now = new Date();
            const time = now.toTimeString().slice(0, 5);
            setMessages((prev) => [
                ...prev,
                {
                    id: uploadRes.blobId, // Use blobId as ID
                    author: "me",
                    name: "You",
                    content: content,
                    type: type,
                    createdAt: time,
                },
            ]);

        } catch (error) {
            console.error("Send failed", error);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    if (typeof reader.result === 'string') {
                        await sendMessage(reader.result, 'audio');
                    }
                };
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = null; // Remove handler
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
        }
    };

    const handleSend = async (e: FormEvent) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed) return;
        await sendMessage(trimmed, 'text');
        setInput("");
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

                {/* 🔑 中間訊息區：一定要 min-h-0，裡面自己做 scroll 容器 */}
                <CardContent className="flex-1 p-0 min-h-0">
                    <div
                        ref={scrollRef}
                        className="h-full overflow-y-auto"
                    >
                        <div className="flex flex-col gap-4 p-4">
                            {messages.map((msg) => (
                                <ChatMessage key={msg.id} message={msg} />
                            ))}
                        </div>
                    </div>
                </CardContent>

                <Separator className="bg-slate-800" />

                {showAttachments && (
                    <ChatAttachmentOptions
                        onClose={() => setShowAttachments(false)}
                        onAttach={handleAttachmentSelect}
                    />
                )}

                {/* 下方輸入列 */}
                <CardFooter className="p-3">
                    {isRecording ? (
                        <div className="flex w-full items-center gap-2 bg-slate-800/50 p-2 rounded-md">
                            <div className="flex-1 flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-sm text-slate-200">Recording...</span>
                            </div>
                            <Button
                                type="button"
                                onClick={cancelRecording}
                                variant="ghost"
                                size="icon"
                                className="text-slate-400 hover:text-red-400"
                            >
                                <Trash2 className="h-5 w-5" />
                            </Button>
                            <Button
                                type="button"
                                onClick={stopRecording}
                                variant="ghost"
                                size="icon"
                                className="text-emerald-400 hover:text-emerald-300"
                            >
                                <div className="h-4 w-4 border-2 border-current rounded-full flex items-center justify-center">
                                    <div className="h-2 w-2 bg-current rounded-sm" />
                                </div>
                                <span className="sr-only">Send Audio</span>
                            </Button>
                        </div>
                    ) : (
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

                            {input.trim() ? (
                                <Button
                                    type="submit"
                                    className="shrink-0 bg-slate-50 text-slate-900 hover:bg-slate-200"
                                >
                                    Send
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={startRecording}
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 text-slate-400 hover:bg-slate-800 hover:text-slate-50"
                                >
                                    <Mic className="h-5 w-5" />
                                </Button>
                            )}
                        </form>
                    )}
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
                        "rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm overflow-hidden" +
                        (isMe
                            ? " rounded-br-sm bg-slate-50 text-slate-900"
                            : " rounded-bl-sm bg-slate-800 text-slate-50")
                    }
                >
                    {message.type === 'text' && message.content}
                    {message.type === 'image' && (
                        <img src={message.content} alt="Shared image" className="max-w-full rounded-md" />
                    )}
                    {message.type === 'video' && (
                        <video src={message.content} controls className="max-w-full rounded-md" />
                    )}
                    {message.type === 'audio' && (
                        <audio src={message.content} controls className="max-w-full" />
                    )}
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
