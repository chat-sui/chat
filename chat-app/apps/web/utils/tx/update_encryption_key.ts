import { Transaction } from "@mysten/sui/transactions";
import { packageID } from "../package";

export const update_encryption_key = (chatroom: string, profileCap: string, newKey: Uint8Array) => {
    const tx = new Transaction();
    tx.moveCall({
        target: `${packageID}::chat_contract::update_encryption_key`,
        arguments: [
            tx.object(chatroom),
            tx.object(profileCap),
            tx.pure.vector('u8', newKey),
        ],
    });
    return tx;
};