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
import { useEffect, useState } from "react";
import TripleInputAction from "@/components/create_chat/create_chat_room_comp"
import { createProfile } from "@/utils/tx/create_profile";
import { useRouter } from "next/navigation"
import { getProfileCap } from "@/utils/queryer";
import { SecretGeneratorButton } from "@/components/secret-generator-button";
import { WalrusMessageViewer } from "@/components/walrus/walrus-message-viewer";


export default function Page() {
  const router = useRouter()
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const [hasProfile, setHasProfile] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

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


  // 2. 在 useEffect 裡做檢查 (避免 Render 時阻塞)
  useEffect(() => {
    const checkProfile = async () => {
      if (!currentAccount?.address) {
        setIsChecking(false); // 沒連錢包也要記得關掉 loading
        return;
      }
      try {
        const cap = await getProfileCap({ suiClient, address: currentAccount.address });
        setHasProfile(!!cap.data[0].data.objectId); 
      } catch (e) {
        console.error(e);
      } finally {
        setIsChecking(false);
      }
    };
    checkProfile();
  }, [currentAccount?.address, suiClient]);
  
  // 3. 建立 Profile 的處理函式
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

  useEffect(() => {
    // 只有當「檢查完畢」且「有 Profile」時才跳轉
    if (hasProfile) {
      router.push('/chatlist');
    }
  }, [hasProfile, isChecking, router]); // 監聽這三個變數

  if (hasProfile) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="flex flex-col items-center gap-2">
           {/* 你可以用 shadcn 的 Spinner 或簡單文字 */}
           <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
           <p>{hasProfile ? "Redirecting..." : "Checking profile..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-svh">
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Hello World</h1>
        <Button size="sm">Button</Button>
        <ConnectButton />
        <WalrusMessageViewer blobId="your-blob-id-here" />
        <TripleInputAction
          onClick={handleCreateProfile}
          buttonText="Create Profile"
          placeholders={["Room Name", "Description", "Topic"]}
        />
      </div>
    </div>
  )
}
