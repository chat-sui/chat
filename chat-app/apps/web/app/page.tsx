"use client";

import { Button } from "@workspace/ui/components/button"
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClientQuery,
  useAutoConnectWallet,
  useSuiClient,
  ConnectButton
} from "@mysten/dapp-kit";
import { useState } from "react";
import TripleInputAction from "@/components/create_chat/create_chat_room_comp"
import { createProfile } from "@/utils/tx/create_profile";
import { useRouter } from "next/navigation"
import { getProfileCap } from "@/utils/queryer";
export default function Page() {
  const router = useRouter()
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();

  const [signedSignature, setSignedSignature] = useState<string | null>(null);
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
  getProfileCap({
    suiClient: suiClient,
    address: currentAccount?.address || "",
  })
  const handleCreateProfile = async (v1: string, v2: string, v3: string) => {
    try {
      const tx = createProfile(v1, v2, v3);
      signAndExecuteTransaction(
        {
          transaction: tx,
          chain: "sui:testnet",
        },
        {
          onSuccess: (result) => {
            console.log("Transaction executed successfully:", result);
            router.push(`/chatlist`)
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
  }
   
  return (
    <div className="flex items-center justify-center min-h-svh">
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Hello World</h1>
        <Button size="sm">Button</Button>
        <ConnectButton />
        <TripleInputAction
          onClick={handleCreateProfile}
          buttonText="Create Profile"
          placeholders={["Room Name", "Description", "Topic"]}
        />
      </div>
    </div>
  )
}
