module stealth_address::stealth_meta_address_registry;

use sui::table::{Self, Table};

public struct StealthMetaAddressRegistry has key, store {
    id: UID,
    mapping: Table<address, StealthMetaAddress>,
}

public struct StealthMetaAddress has copy, drop, store {
    spend_pub_key: vector<u8>,
    view_pub_key: vector<u8>,
}

public fun register_keys() {}

public fun register_keys_on_behalf() {}

public fun increment_nonce() {}

public fun stealth_meta_address_of() {}

public fun nonce_of() {}
