module chat_contract::chat_contract;

use std::string::String;
use sui::object;
use sui::dynamic_field as df;

const EInvalidProfileCap: u64 = 0;
const MARKER: u64 = 1;

public struct Profile has key, store {
    id: UID,
    username: String,
    bio: String,
    avatar_url: String,
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
    };

    let profile_cap = ProfileCap {
        id: object::new(ctx),
        profile_id: object::id(&profile),
    };
    transfer::share_object(profile);
    transfer::transfer(profile_cap, ctx.sender());
}

public fun create_chat_room(
    profile: &Profile,
    ctx: &mut TxContext,
) {
    let chatroom = Chatroom {
        id: object::new(ctx),
        profile: vector::empty<ID>(),
        encryption_key: vector::empty<u8>(),
    };
    transfer::share_object(chatroom);
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
    profile_cap: &ProfileCap,
    chatroom: &Chatroom,
    ctx: &mut TxContext,
) {
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