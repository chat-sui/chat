/**
 * Vault and OwnerCap utility functions for SeaVault
 */
import { CoinBalance, CoinStruct, DynamicFieldInfo, PaginatedCoins, SuiObjectResponse, SuiClient } from "@mysten/sui/client";
import { packageID } from "./package";
import { Filter } from "lucide-react";
import { get } from "http";


export interface Friendship {
    type: string;
    fields: {
        friend_profile_id: string;
        chat_id: string;
    };
}

export interface ProfileInfo {
    profileId: string;
    name?: string;
    avatarUrl?: string;
    bio?: string;
    friendsList: Friendship[];
}

export interface FriendChat {
    id: string;             // Chatroom 的 ID (用來跳轉)
    friendProfileId: string;// 對方的 Profile ID
    friendName: string;     // 對方的 username
    friendAvatar: string;   // 對方的 avatar_url
    friendBio: string;      // 對方的 bio
    lastMessage?: string;   // 最後一條訊息 (可選)
}

interface FriendshipField {
    fields: {
        friend_profile_id: string;
        chat_id: string;
    };
}

/**
 * Function to get all coins or filter by specific coin type
 * @param {SuiClient} suiClient - Sui client instance  
 * @param {string} address - Owner address
 * @param {Object} params - Parameters object
 * @param {string} [params.type] - Optional coin type to filter by
 * @returns {Promise<CoinStruct[] | undefined>} Array of coins or undefined if pending
 */
export async function getCoin(params: { suiClient: SuiClient, address: string, type?: string }): Promise<CoinStruct[] | undefined> {
    try {
        const result = await params.suiClient.getAllCoins({
            owner: params.address
        });

        if (result && result.data) {
            if (!params.type) {
                return result.data;
            } else {
                return result.data.filter(item => item.coinType === params.type);
            }
        }
    } catch (error) {
        console.error('Error in getCoin:', error);
        throw error;
    }
    return undefined;
}

export async function getProfileCap(params: { suiClient: SuiClient, address: string, type?: string }): Promise<any> {
    try {
        const result = await params.suiClient.getOwnedObjects({
            owner: params.address,
            filter: {
                Package: packageID,
            },
            options: {
                showType: true,
                showContent: true
            }
        },
        );
        return result;
    } catch (error) {
        console.error('Error in getCoin:', error);
        throw error;
    }
}

export async function getProfileInfo(params: { suiClient: SuiClient, address: string }): Promise<ProfileInfo | undefined> {
    try {
        // 取得 ProfileCap
        const profileCap = await getProfileCap({
            suiClient: params.suiClient,
            address: params.address,
        });

        // 安全檢查：確保真的有拿到 Cap
        if (!profileCap || !profileCap.data || profileCap.data.length === 0) {
            return undefined;
        }

        const capObject = profileCap.data[0];
        // 安全轉型
        const capFields = capObject.data?.content?.dataType === "moveObject" 
            ? (capObject.data.content.fields as any) 
            : null;

        if (!capFields) return undefined;

        const profileId = capFields.profile_id;
        console.log('Found Profile ID:', profileId);

        // 取得 Profile 物件
        const profileObject = await params.suiClient.getObject({
            id: profileId,
            options: { showContent: true }
        });

        if (profileObject.data?.content?.dataType !== "moveObject") {
            return undefined;
        }

        const fields = profileObject.data.content.fields as any;

        return {
            profileId: profileId,
            // ⚠️ 修正：Move Struct 是 username，不是 name
            name: fields.username || "Unknown", 
            // Move Struct 是 avatar_url
            avatarUrl: fields.avatar_url || "", 
            bio: fields.bio || "",
            // ⭐️ 直接把原始的 friends 結構傳出去
            friendsList: fields.friends || [], 
        };
    }
    catch (error) {
        console.error('Error in getProfileInfo:', error);
        throw error;
    }
}

export async function getFriendList(
    suiClient: SuiClient,
    myProfileId: string // 注意：這裡傳入的是 Profile 的 Object ID
): Promise<FriendChat[]> {
    try {
        // 1. 先讀取「我自己」的 Profile 物件
        const myProfileObject = await suiClient.getObject({
            id: myProfileId,
            options: { showContent: true }
        });

        // 檢查是否讀取成功
        if (!myProfileObject.data?.content || myProfileObject.data.content.dataType !== "moveObject") {
            return [];
        }

        const myFields = myProfileObject.data.content.fields as any;

        // 2. 取得 friends 陣列 (這是 vector<Friendship>)
        // 在 RPC 回傳的 JSON 中，它通常是一個物件陣列
        const friendships = (myFields.friends || []) as FriendshipField[];

        if (friendships.length === 0) {
            return [];
        }

        // 3. 整理出「所有朋友的 ID」準備批量查詢
        // 同時建立一個 Map: FriendProfileID -> ChatID (為了稍後組裝用)
        const friendProfileIds: string[] = [];
        const chatMap = new Map<string, string>();

        friendships.forEach((item) => {
            // 注意：Sui 的 JSON 結構，Struct 欄位通常在 item.fields 裡面
            const f = item.fields;
            friendProfileIds.push(f.friend_profile_id);
            chatMap.set(f.friend_profile_id, f.chat_id);
        });

        // 4. 【優化】批量讀取所有朋友的 Profile (multiGetObjects)
        // 不要用 for loop 一個一個 await，那樣會很慢
        const friendObjects = await suiClient.multiGetObjects({
            ids: friendProfileIds,
            options: { showContent: true }
        });

        // 5. 組裝最終資料
        const friendChats: FriendChat[] = [];

        friendObjects.forEach((obj) => {
            if (obj.data?.content?.dataType === "moveObject") {
                const fields = obj.data.content.fields as any;
                const profileId = obj.data.objectId;

                // 從剛才的 Map 找回對應的 chat_id
                const chatId = chatMap.get(profileId);

                if (chatId) {
                    friendChats.push({
                        id: chatId, // ✅ 直接使用合約存的 ID，不用自己算
                        friendProfileId: profileId,
                        friendName: fields.username || "Unknown", // 注意合約欄位是 username
                        friendAvatar: fields.avatar_url || "",    // 注意合約欄位是 avatar_url
                        friendBio: fields.bio || "",
                    });
                }
            }
        });

        return friendChats;

    } catch (error) {
        console.error('Error in getFriendList:', error);
        throw error;
    }
}

/**
 * Function to get dynamic fields for a specific object
 * @param {SuiClient} suiClient - Sui client instance
 * @param {Object} params - Parameters object
 * @param {string} params.object - Object ID to get dynamic fields for
 * @returns {Promise<DynamicFieldInfo[] | undefined>} Array of dynamic field info or undefined if pending
 */
export async function getDynamicF(params: { suiClient: SuiClient, object: string }): Promise<DynamicFieldInfo[] | undefined> {
    try {
        const result = await params.suiClient.getDynamicFields({
            parentId: params.object
        });

        if (result && result.data) {
            return result.data;
        }
    } catch (error) {
        console.error('Error in getDynamicF:', error);
        throw error;
    }
    return undefined;
}

/**
 * Function to get vault and ownerCap information
 * @param {SuiClient} suiClient - Sui client instance
 * @param {string} accountAddress - User's account address
 * @param {string} packageName - Package name for filtering OwnerCap objects
 * @returns {Object} Vault and ownerCap data
 */
export async function getVaultAndOwnerCap(params: { suiClient: SuiClient, accountAddress: string, packageName: string }): Promise<{ ownerCapObjects: SuiObjectResponse[] | null, vaultID: string | null, ownerCapId: string | null } | undefined> {
    try {
        const result = await params.suiClient.getOwnedObjects({
            owner: params.accountAddress,
            options: { showType: true, showContent: true }
        });

        if (result && result.data) {
            const ownerCapObjects = result.data.filter((obj) =>
                obj.data?.type?.includes(params.packageName + "::sea_vault::OwnerCap")
            );

            const vaultID = (ownerCapObjects[0]?.data?.content as any)?.fields?.vaultID || null;
            const ownerCapId = ownerCapObjects[0]?.data?.objectId || null;

            return { ownerCapObjects, vaultID, ownerCapId };
        }
    } catch (error) {
        console.error('Error in getVaultAndOwnerCap:', error);
        throw error;
    }
    return undefined;
}
export async function getVaultField(params: { suiClient: SuiClient, vaultID: string }): Promise<any> {
    try {
        const result = await params.suiClient.getObject({
            id: params.vaultID,
            options: { showType: true, showContent: true }
        });

        if (result && result.data) {
            console.log('getVaultField result:', (result.data as any).content?.fields?.cap_percentage);
            return result.data;
        }
    } catch (error) {
        console.error('Error in getVaultField:', error);
        throw error;
    }
    return undefined;
}
/**
 * Function to get vault dynamic fields
 * @param {SuiClient} suiClient - Sui client instance
 * @param {string} vaultID - ID of the vault to query
 * @returns {Object} Vault dynamic fields data
 */
export async function getVaultDynamicFields(params: { suiClient: SuiClient, vaultID: string }): Promise<DynamicFieldInfo[] | undefined> {
    try {
        const result = await params.suiClient.getDynamicFields({
            parentId: params.vaultID
        });

        if (result && result.data) {
            return result.data;
        }
    } catch (error) {
        console.error('Error in getVaultDynamicFields:', error);
        throw error;
    }
    return undefined;
}

/**
 * Function to get objects of a certain type owned by an address
 * @param {SuiClient} suiClient - Sui client instance
 * @param {Object} params - Parameters object
 * @param {string} address - Address to query
 * @param {string} params.type - Object type to filter by (partial match)
 * @returns {Promise<SuiObjectResponse[] | undefined>} Array of objects matching the type or undefined if pending
 */
export async function getCertainType(params: { suiClient: SuiClient, address: string, type: string }): Promise<any[] | undefined> {
    try {
        const result = await params.suiClient.getOwnedObjects({
            owner: params.address,
            options: { showType: true, showContent: true }
        });

        if (result && result.data) {
            return result.data.filter(item => item.data?.type?.includes(params.type));
        }
    } catch (error) {
        console.error('Error in getCertainType:', error);
        throw error;
    }
    return undefined;
}

export async function getCertainField(params: { suiClient: SuiClient, objID: string }): Promise<any> {
    try {
        const result = await params.suiClient.getObject({
            id: params.objID,
            options: { showType: true, showContent: true }
        });

        if (result && result.data) {
            return result.data;
        }
    } catch (error) {
        console.error('Error in getCertainField:', error);
        throw error;
    }
    return undefined;
}

/**
 * Function to get all Receipt objects owned by a user
 * @param {SuiClient} suiClient - Sui client instance
 * @param {string} address - Owner address
 * @param {string} packageName - Package name for filtering Receipt objects
 * @returns {Promise<any[] | undefined>} Array of Receipt objects or undefined if error
 */
export async function getMyReceipts(params: { suiClient: SuiClient, address: string, packageName: string }): Promise<any[] | undefined> {
    try {
        const result = await params.suiClient.getOwnedObjects({
            owner: params.address,
            options: { showType: true, showContent: true }
        });

        if (result && result.data) {
            return result.data.filter(item =>
                item.data?.type?.includes(params.packageName + "::subscription::Receipt")
            );
        }
    } catch (error) {
        console.error('Error in getMyReceipts:', error);
        throw error;
    }
    return undefined;
}