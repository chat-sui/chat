import { Transaction } from "@mysten/sui/transactions";
import { packageID } from "../package";

export const createProfile = (username: string, bio: string, avatar: string) => {
    const tx = new Transaction();
    tx.moveCall({
        target: `${packageID}::chat_contract::create_profile`,
        arguments: [
            tx.pure.string(username),
            tx.pure.string(bio),
            tx.pure.string(avatar),
        ],
    });
    return tx;
};