use bech32::{Bech32, Hrp};  // Add Bech32 here
use ed25519_dalek::{Signer, SigningKey};

/// Decode a Sui private key string (suiprivkey1...) into raw bytes
pub fn decode_sui_private_key(sui_privkey: &str) -> Result<(u8, Vec<u8>), String> {
    let (hrp, data) = bech32::decode(sui_privkey)
        .map_err(|e| format!("Failed to decode bech32: {}", e))?;

    if hrp.as_str() != "suiprivkey" {
        return Err(format!("Expected 'suiprivkey' prefix, got '{}'", hrp));
    }

    if data.is_empty() {
        return Err("Empty key data".to_string());
    }

    let scheme = data[0];
    let key_bytes = data[1..].to_vec();

    Ok((scheme, key_bytes))
}

/// Sign a message with an Ed25519 private key
pub fn sign_message_ed25519(private_key_bytes: &[u8], message: &str) -> Result<Vec<u8>, String> {
    let key_array: [u8; 32] = private_key_bytes
        .try_into()
        .map_err(|_| "Private key must be 32 bytes")?;
    
    let signing_key = SigningKey::from_bytes(&key_array);
    let signature = signing_key.sign(message.as_bytes());

    Ok(signature.to_bytes().to_vec())
}

/// Convenience function: decode Sui key and sign message in one step
pub fn sui_sign_message(sui_privkey: &str, message: &str) -> Result<Vec<u8>, String> {
    let (scheme, key_bytes) = decode_sui_private_key(sui_privkey)?;

    if scheme != 0x00 {
        return Err(format!(
            "Expected Ed25519 key (scheme 0x00), got scheme 0x{:02x}",
            scheme
        ));
    }

    sign_message_ed25519(&key_bytes, message)
}

/// Encode a private key to Sui format (suiprivkey1...)
/// scheme: 0x00 = Ed25519, 0x01 = secp256k1
pub fn encode_sui_private_key(private_key_bytes: &[u8], scheme: u8) -> Result<String, String> {
    let mut data = vec![scheme];
    data.extend_from_slice(private_key_bytes);

    let hrp = Hrp::parse("suiprivkey").map_err(|e| format!("Invalid HRP: {}", e))?;
    
    // Use Bech32, NOT Bech32m!
    bech32::encode::<Bech32>(hrp, &data)
        .map_err(|e| format!("Failed to encode bech32: {}", e))
}

/// Encode a secp256k1 stealth private key to Sui format
pub fn stealth_key_to_sui_format(stealth_private_key: &[u8]) -> Result<String, String> {
    // Stealth keys are secp256k1 = scheme 0x01
    encode_sui_private_key(stealth_private_key, 0x01)
}