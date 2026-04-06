use sui_stealth_sdk::{
    // Key derivation
    derive_keys_from_signature,
    derive_stealth_meta_address,
    // Stealth protocol
    generate_stealth_address,
    create_announcement,
    check_stealth_address,
    compute_stealth_private_key,
    // Sui key handling
    sui_sign_message,
    // Utils
    bytes_to_hex,
    stealth_key_to_sui_format,
};

fn main() {
    println!("╔════════════════════════════════════════════════════════════╗");
    println!("║      Sui Stealth Address SDK — Real Key Demo               ║");
    println!("╚════════════════════════════════════════════════════════════╝\n");

    // ═══════════════════════════════════════════════════════════════
    //  REAL SUI WALLET
    // ═══════════════════════════════════════════════════════════════
    let private_key_receiver = "suiprivkey1qzjl0ws9lrjqanx5yzd4vq44g649kknawatjegtv5k4gwfggesx92qmle4u";
    let wallet_address_receiver = "0x20c513f3e1848a7db6567e280f7964ade32a669ddc9d5a322320478bda0adcde";
    let message = "please generate a stealth meta address for this wallet address";

    println!("📱 Receiver's Wallet");
    println!("───────────────────────────────────────────────────────────────");
    println!("Address: {}", wallet_address_receiver);
    println!("Message: \"{}\"", message);

    // ═══════════════════════════════════════════════════════════════
    // Sign Message & Derive Keys
    // ═══════════════════════════════════════════════════════════════
    println!("\n📥 Receiver Setup (Sign & Derive)");
    println!("───────────────────────────────────────────────────────────────");

    // Sign the message with the real Sui private key
    let signature = sui_sign_message(private_key_receiver, message)
        .expect("Failed to sign message");

    println!("Signature: {}...", bytes_to_hex(&signature[0..32]));
    println!("           {}...", bytes_to_hex(&signature[32..64]));

    // Derive view and spend keys from signature (r → view, s → spend)
    let receiver_keys = derive_keys_from_signature(&signature)
        .expect("Failed to derive keys");

    println!("\n🔐 Derived Secret Keys:");
    println!("   View private:  {}...", bytes_to_hex(&receiver_keys.view_priv_key[0..16]));
    println!("   Spend private: {}...", bytes_to_hex(&receiver_keys.spend_priv_key[0..16]));

    // Generate the public meta-address
    let meta_address = derive_stealth_meta_address(&receiver_keys)
        .expect("Failed to derive meta-address");

    println!("\n📢 Stealth Meta-Address (PUBLISH THIS):");
    println!("   View Sui address:  {}", meta_address.view_public_address);
    println!("   Spend Sui address: {}", meta_address.spend_public_address);

    // ═══════════════════════════════════════════════════════════════
    // Sender Generates Stealth Address
    // ═══════════════════════════════════════════════════════════════
    println!("\n📤 Sender Generates Stealth Address");
    println!("───────────────────────────────────────────────────────────────");

    let payload = generate_stealth_address(&meta_address)
        .expect("Failed to generate stealth address");

    println!("Ephemeral pubkey: {}...", bytes_to_hex(&payload.ephemeral_public_key[0..16]));
    println!("View tag: 0x{:02x}", payload.view_tag);
    println!("\n🎯 Stealth Address (SEND FUNDS HERE): {}", payload.stealth_address);

    // ═══════════════════════════════════════════════════════════════
    // Announcement
    // ═══════════════════════════════════════════════════════════════
    println!("\n📡 Announcement (Goes On-Chain)");
    println!("───────────────────────────────────────────────────────────────");

    let announcement = create_announcement(&payload, 1);

    println!("{{");
    println!("  scheme_id: {},", announcement.scheme_id);
    println!("  stealth_address: \"{}\",", announcement.stealth_address);
    println!("  ephemeral_pubkey: \"{}...\",", bytes_to_hex(&announcement.ephemeral_public_key[0..16]));
    println!("  view_tag: 0x{}", bytes_to_hex(&announcement.metadata));
    println!("}}");

    // ═══════════════════════════════════════════════════════════════
    // Receiver Scans
    // ═══════════════════════════════════════════════════════════════
    println!("\n🔍 Receiver Scans Announcements");
    println!("───────────────────────────────────────────────────────────────");

    let check_result = check_stealth_address(
        &announcement,
        &receiver_keys.view_priv_key,
        &meta_address.spend_pub_key,
    ).expect("Failed to check announcement");

    match &check_result {
        Some(_) => println!("✅ Found matching announcement!"),
        None => {
            println!("❌ Not our announcement.");
            return;
        }
    }

    let hashed_shared = check_result.unwrap();

    // ═══════════════════════════════════════════════════════════════
    // Derive Spending Key
    // ═══════════════════════════════════════════════════════════════
    println!("\n🔑 Derive Spending Key");
    println!("───────────────────────────────────────────────────────────────");

    let stealth_keypair = compute_stealth_private_key(
        &receiver_keys.spend_priv_key,
        &hashed_shared,
    ).expect("Failed to derive stealth keypair");

        // Convert to Sui format
    let stealth_sui_privkey = stealth_key_to_sui_format(&stealth_keypair.private_key)
        .expect("Failed to encode stealth key");

    println!("Stealth private key (Hex): {}", bytes_to_hex(&stealth_keypair.private_key));
    println!("Stealth private key (Sui): {}", stealth_sui_privkey);

    println!("Stealth Sui address: {}", stealth_keypair.sui_address);

    // ═══════════════════════════════════════════════════════════════
    // VERIFICATION
    // ═══════════════════════════════════════════════════════════════
    println!("\n═══════════════════════════════════════════════════════════════");
    println!("🔐 VERIFICATION");
    println!("═══════════════════════════════════════════════════════════════");

    if payload.stealth_address == stealth_keypair.sui_address {
        println!("✅ SUCCESS!");
        println!();
        println!("Sender computed:   {}", payload.stealth_address);
        println!("Receiver derived:  {}", stealth_keypair.sui_address);
        println!();
        println!("The receiver can now spend funds at this stealth address");
        println!("using the derived private key.");

    } else {
        println!("❌ FAILURE! Addresses don't match.");
        panic!("Something went wrong!");
    }

    println!("\n╔════════════════════════════════════════════════════════════╗");
    println!("║                     Demo Complete!                         ║");
    println!("╚════════════════════════════════════════════════════════════╝");
}