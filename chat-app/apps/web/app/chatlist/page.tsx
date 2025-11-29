"use client";

import { useState } from 'react';
import { Card, CardHeader, CardContent } from "@workspace/ui/components/card";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { ScrollArea } from "@workspace/ui/components/scroll-area";

// 聯絡人介面定義
interface Contact {
    id: string;
    name: string;
    lastMessage: string;
    avatarUrl: string;
}

// 靜態資料 (實際應用中會從 API 取得)
const contacts: Contact[] = [
    { id: '1', name: "Sui Dev Team", lastMessage: "GM! The new Move package is ready.", avatarUrl: "/avatars/sui.png" },
    { id: '2', name: "Alice (Wallet 0x...)", lastMessage: "Sent 5 SUI to your address.", avatarUrl: "/avatars/alice.png" },
    { id: '3', name: "Validator Node 1", lastMessage: "Transaction confirmed: #0xabc...", avatarUrl: "/avatars/node.png" },
    { id: '4', name: "Web3 Frontend", lastMessage: "Check out the new UI component!", avatarUrl: "/avatars/web3.png" },
    { id: '5', name: "Market Data Bot", lastMessage: "SUI Price: $1.15 (+3.2%).", avatarUrl: "/avatars/bot.png" },
    { id: '6', name: "Security Alert", lastMessage: "Suspicious login attempt detected.", avatarUrl: "/avatars/security.png" },
    { id: '7', name: "DeFi Protocol X", lastMessage: "Your staking reward has been claimed.", avatarUrl: "/avatars/protocol.png" },
];

/**
 * ChatList 組件：顯示聊天聯繫人列表，並允許用戶選擇當前聊天。
 */
export default function Page() {
    // 使用 useState 來管理當前選中的聊天 ID，初始值設為第一個聯繫人
    const [activeChatId, setActiveChatId] = useState('1');

    return (<>
        <Card className="h-full w-150 bg-gray-900 border-gray-700 shadow-xl flex flex-col">
            {/* 標題區域 */}
            <CardHeader className="p-4 border-b border-gray-800 flex-shrink-0">
                <h2 className="text-xl font-bold text-teal-400">Conversations</h2>
            </CardHeader>

            {/* 內容區域：包裹 ScrollArea 並使用 flex-1 填滿剩餘空間 */}
            <CardContent className="p-0 flex-1">
                {/* ScrollArea: 使用 h-full 確保它填滿 CardContent 的整個高度。
                  移除硬編碼的 h-[calc(100vh-80px)]，以增加組件的靈活性。
                */}
                <ScrollArea className="h-full p-1">
                    {contacts.map((contact) => (
                        <div
                            key={contact.id}
                            // 點擊時更新選中的聊天 ID
                            onClick={() => setActiveChatId(contact.id)}
                            // 透過條件判斷添加選中狀態的樣式 (未來感高亮)
                            className={`flex items-center p-3 m-1 rounded-lg cursor-pointer transition-all duration-200 
                                ${contact.id === activeChatId
                                    ? 'bg-teal-600/30 ring-2 ring-teal-500' // 選中樣式
                                    : 'hover:bg-gray-800' // 懸停樣式
                                }`
                            }
                        >
                            {/* 聯繫人頭像 */}
                            <Avatar className="h-10 w-10 border-2 border-teal-500 flex-shrink-0">
                                <AvatarImage src={contact.avatarUrl} alt={contact.name} />
                                <AvatarFallback className="bg-teal-700 text-white">{contact.name[0]}</AvatarFallback>
                            </Avatar>

                            {/* 聯繫人資訊 */}
                            <div className="ml-3 overflow-hidden min-w-0">
                                <p className="font-semibold truncate text-white">{contact.name}</p>
                                <p className="text-sm text-gray-400 truncate">{contact.lastMessage}</p>
                            </div>
                        </div>
                    ))}
                </ScrollArea>
            </CardContent>
        </Card>
    </>
    );
}
