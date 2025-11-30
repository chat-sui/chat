"use client";

import {
    useCurrentAccount,
    useSignAndExecuteTransaction,
    useSuiClientQuery,
    useAutoConnectWallet,
    useSuiClient,
    ConnectButton
} from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@workspace/ui/components/card";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Button } from "@workspace/ui/components/button";
import { getProfileInfo, getProfileCap } from "@/utils/queryer";
import { add_friend } from "@/utils/tx/add_friend";
export default function FriendListPage() {
    const router = useRouter();
    const suiClient = useSuiClient();
    const currentAccount = useCurrentAccount();
    const [signedSignature, setSignedSignature] = useState<string | null>(null);
    const [friends, setFriends] = useState<FriendChat[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isChecking, setIsChecking] = useState(true);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [newFriendInput, setNewFriendInput] = useState("");
    const [ProfileCap, setProfileCap] = useState("");
    const [ProfileId, setProfileId] = useState("");

    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction({
        execute: async ({ bytes, signature }) => {
            setSignedSignature(signature);
            return await suiClient.executeTransactionBlock({
                transactionBlock: bytes,
                signature,
                options: {
                    showEffects: true,
                    showEvents: true,
                    showObjectChanges: true,
                    showBalanceChanges: true,
                    showRawEffects: true,
                },
            });
        },
    });

    useEffect(() => {
        const checkProfile = async () => {
            if (!currentAccount?.address) {
                setIsChecking(false); // 沒連錢包也要記得關掉 loading
                return;
            }
            try {
                const cap = await getProfileCap({ suiClient, address: currentAccount.address });
                setProfileCap(cap.data[0].data.objectId);
            } catch (e) {
                console.error(e);
            } finally {
                setIsChecking(false);
            }
        };
        checkProfile();
    }, [currentAccount?.address, suiClient]);

    useEffect(() => {
        const checkProfileInfo = async () => {
            if (!currentAccount?.address) {
                setIsChecking(false); // 沒連錢包也要記得關掉 loading
                return;
            }
            try {
                const info = await getProfileInfo({ suiClient, address: currentAccount.address });
                setProfileId(info?.profileId || "");
                console.log("Profile Info:", info);
            } catch (e) {
                console.error(e);
            } finally {
                setIsChecking(false);
            }
        };
        checkProfileInfo();
    }, [currentAccount?.address, suiClient]);

    useEffect(() => {
        const init = async () => {
            if (!currentAccount?.address) return;
            setIsLoading(true);

            try {
                const myProfile = await getProfileInfo({
                    suiClient,
                    address: currentAccount.address,
                });

                if (myProfile) {
                    const myChatRoomIds = await mockGetMyChatRooms(myProfile.profileId);

                    const enrichedFriends = await fetchFriendList(
                        suiClient,
                        myProfile.profileId,
                        myChatRoomIds,
                    );

                    setFriends(enrichedFriends);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, [suiClient, currentAccount]);

    const handleCreateChat = () => {
        try {
            const tx = add_friend(ProfileCap, ProfileId, newFriendInput);
            console.log("Created transaction:", tx);
            signAndExecuteTransaction(
                {
                    transaction: tx,
                    chain: "sui:testnet",
                },
                {
                    onSuccess: (result) => {
                        console.log("Transaction executed successfully:", result);
                    },
                    onError: (error) => {
                        console.error("Transaction execution failed:", error);
                    },
                }
            );
        } catch (error) {
            console.error("Mint error:", error);
            alert("Mint failed");
        }
        // TODO: replace with real create-chat logic
        console.log("Create chat with:", newFriendInput);
        setNewFriendInput("");
        setIsPanelOpen(false);
    };

    return (
        <><ConnectButton />
            <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
                <Card className="relative flex h-[600px] w-full max-w-sm flex-col border-slate-800 bg-slate-900/70 backdrop-blur">
                    <CardHeader className="flex-shrink-0 border-b border-slate-800 py-4 px-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-50">Friends</h2>
                                <p className="text-xs text-slate-400">
                                    {isLoading ? "Loading..." : `${friends.length} chats`}
                                </p>
                            </div>

                            <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 rounded-full border-slate-700 bg-slate-900/80 text-slate-100 hover:bg-slate-800"
                                onClick={() => setIsPanelOpen(true)}
                            >
                                +
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0 flex-1">
                        <ScrollArea className="h-full p-1">
                            {isLoading && (
                                <div className="flex justify-center p-4 text-slate-500">
                                    Syncing friends...
                                </div>
                            )}

                            {!isLoading &&
                                friends.map((friend) => (
                                    <div
                                        key={friend.id}
                                        onClick={() => router.push(`/chat/${friend.id}`)}
                                        className="group m-1 flex cursor-pointer items-center rounded-lg p-3 transition-all duration-200 hover:bg-slate-800/50"
                                    >
                                        <Avatar className="flex-shrink-0 h-10 w-10 border-2 border-slate-700 group-hover:border-slate-600">
                                            <AvatarImage src={friend.friendAvatar} />
                                            <AvatarFallback className="bg-slate-800 text-slate-200">
                                                {friend.friendName.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className="ml-3 min-w-0 overflow-hidden">
                                            <p className="truncate font-semibold text-slate-50">
                                                {friend.friendName}
                                            </p>
                                            <p className="truncate text-sm text-slate-400">
                                                {friend.lastMessage}
                                            </p>
                                        </div>
                                    </div>
                                ))}

                            {!isLoading && friends.length === 0 && (
                                <div className="p-4 text-center text-slate-500">
                                    No friends found. Create a chat!
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>

                    {isPanelOpen && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80">
                            <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-lg">
                                <h3 className="text-sm font-semibold text-slate-50">
                                    Start a new chat
                                </h3>
                                <p className="mt-1 text-xs text-slate-400">
                                    Enter an address / profile / handle to start chatting.
                                </p>

                                <input
                                    className="mt-3 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                    placeholder="friend address or username"
                                    value={newFriendInput}
                                    onChange={(e) => setNewFriendInput(e.target.value)} />

                                <div className="mt-4 flex justify-end gap-2">
                                    <Button
                                        variant="ghost"
                                        className="text-slate-300 hover:bg-slate-800"
                                        onClick={() => {
                                            setIsPanelOpen(false);
                                            setNewFriendInput("");
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="bg-slate-100 text-slate-900 hover:bg-slate-200"
                                        onClick={handleCreateChat}
                                        disabled={!newFriendInput.trim()}
                                    >
                                        Create
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            </div></>
    );
}

// mock function: replace with real logic
async function mockGetMyChatRooms(profileId: string) {
    return [];
}
