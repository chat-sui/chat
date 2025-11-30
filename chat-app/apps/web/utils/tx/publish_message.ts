import { Transaction } from "@mysten/sui/transactions";
import { packageID } from "../package";

export const publish_message = (chatroom: string, profileCap: string, blobId: string) => {
    const tx = new Transaction();
    tx.moveCall({
        target: `${packageID}::chat_contract::publish`,
        arguments: [
            tx.object(chatroom),
            tx.object(profileCap),
            tx.pure.string(blobId),
        ],
    });
    return tx;
};
