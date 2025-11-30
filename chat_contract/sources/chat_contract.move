module chat_contract::chat_contract;

use std::string::String;
use sui::object;
use sui::dynamic_field as df;

const EInvalidProfileCap: u64 = 0;
const MARKER: u64 = 1;
const EAlreadyFriends: u64 = 2;

public struct Profile has key, store {
    id: UID,
    username: String,
    bio: String,
    avatar_url: String,
    friends: vector<Friendship>,
}

public struct Friendship has store, drop, copy {
    friend_profile_id: ID,
    chat_id: ID
}

public struct ProfileCap has key {
    id: UID,
    profile_id: ID
}

public struct Chatroom has key {
    id: UID,
    profile: vector<ID>,
    encryption_key: vector<u8>,
}

public fun create_profile(
    username: String,
    bio: String,
    avatar_url: String,
    ctx: &mut TxContext,
) {
    let profile = Profile {
        id: object::new(ctx),
        username: username,
        bio: bio,
        avatar_url: avatar_url,
        friends: vector::empty<Friendship>(),
    };

    let profile_cap = ProfileCap {
        id: object::new(ctx),
        profile_id: object::id(&profile),
    };
    transfer::share_object(profile);
    transfer::transfer(profile_cap, ctx.sender());
}

public fun add_friend(
    profile_cap: &ProfileCap,
    profile: &mut Profile,
    friend_profile: &Profile,
    ctx: &mut TxContext,
) {
    let my_id = object::uid_to_inner(&profile.id);
    let friend_id = object::uid_to_inner(&friend_profile.id);

    assert!(check_is_friend(profile, friend_id), EAlreadyFriends);

    let (found_chat , existing_chat_id) = find_chat_id_in_profile(friend_profile, my_id);

    let final_chat_id: ID;
    
    if(found_chat){
            final_chat_id = existing_chat_id;
    } else {
        let chatroom = Chatroom {
            id: object::new(ctx),
            profile: vector[my_id, friend_id],
            encryption_key: vector::empty<u8>(),
        };
        final_chat_id = object::id(&chatroom);
        transfer::share_object(chatroom);
    };

    let new_friendship = Friendship {
        friend_profile_id: friend_id,
        chat_id: final_chat_id,
    };
    vector::push_back(&mut profile.friends, new_friendship);
}

fun check_is_friend(
    profile: &Profile,
    friend_profile_id: ID,
): bool {
    let len = vector::length(&profile.friends);
    let mut i = 0;
    while (i < len) {
        let friendship = vector::borrow(&profile.friends, i);
        if (friendship.friend_profile_id == friend_profile_id) {
            return false
        };
        i = i + 1;
    };
    true
}

fun find_chat_id_in_profile(
    profile: &Profile,
    target_profile_id: ID,
): (bool, ID) {
    let len = vector::length(&profile.friends);
    let mut i = 0;
    while (i < len) {
        let friendship = vector::borrow(&profile.friends, i);
        if (friendship.friend_profile_id == target_profile_id) {
            return (true, friendship.chat_id)
        };
        i = i + 1;
    };
    (false, object::uid_to_inner(&profile.id)) // return dummy ID
}

public fun update_encryption_key(
    chatroom: &mut Chatroom,
    profile_cap: &ProfileCap,
    new_key: vector<u8>,
    ctx: &mut TxContext,
) {
    assert!(iterate_profiles_in_chatroom(chatroom, profile_cap, ctx), EInvalidProfileCap);
    chatroom.encryption_key = new_key;
}

public fun add_chatroom_profile(
    chatroom: &mut Chatroom,
    profile_cap: &ProfileCap,
    profile: &Profile,
    ctx: &mut TxContext,
) {
    assert!(
        !iterate_profiles_in_chatroom(chatroom, profile_cap, ctx),
        EInvalidProfileCap
    );
    vector::push_back(&mut chatroom.profile, object::id(profile));
}

entry fun profile_seal_approve(
    id: vector<u8>,
    profile_cap: &ProfileCap,
    chatroom: &Chatroom,
    ctx: &mut TxContext,
) {
    assert!(id == object::id_bytes(chatroom), EInvalidProfileCap);
    internal_approve_seal(profile_cap, chatroom, ctx);
}

fun internal_approve_seal(
    profile_cap: &ProfileCap,
    chatroom: &Chatroom,
    ctx: &mut TxContext,
) {
    assert!(iterate_profiles_in_chatroom(chatroom, profile_cap, ctx), EInvalidProfileCap);
}

fun iterate_profiles_in_chatroom(
    chatroom: &Chatroom,
    profile_cap: &ProfileCap,
    ctx: &mut TxContext,
): bool {
    let mut found = false;
    let len = vector::length(&chatroom.profile);
    let mut i = 0;
    while (i < len) {
        let profile_id = *vector::borrow(&chatroom.profile, i);
        if (profile_id == profile_cap.profile_id) {
            found = true;
            break;
        };
        i = i + 1;
    };
    found
}

public fun publish(chatroom: &mut Chatroom, profile_cap: &ProfileCap, blob_id: String, ctx: &mut TxContext) {
    assert!(iterate_profiles_in_chatroom(chatroom, profile_cap, ctx), EInvalidProfileCap);
    df::add(&mut chatroom.id, blob_id, MARKER);
}
