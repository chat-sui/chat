import { Transaction } from "@mysten/sui/transactions";
import { packageID } from "../package";

export const create_chatroom = (profile: string) => {
    const tx = new Transaction();
    tx.moveCall({
        target: `${packageID}::chat_contract::create_chat_room`,
        arguments: [
            tx.object(profile),
        ],
    });
    return tx;
};