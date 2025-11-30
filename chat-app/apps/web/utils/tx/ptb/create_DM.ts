import { Transaction } from "@mysten/sui/transactions";
import { packageID } from "../../package";

export const add_friend = (profileCap: string, profile: string, friendProfile: string) => {
    const tx = new Transaction();
    tx.moveCall({
        target: `${packageID}::chat_contract::add_friend`,
        arguments: [
            tx.object(profileCap),
            tx.object(profile),
            tx.object(friendProfile),
        ],
    });
    return tx;
};