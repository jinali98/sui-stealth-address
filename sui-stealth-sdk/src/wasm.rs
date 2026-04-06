use wasm_bindgen::prelude::*;
use crate::{
    derive_keys_from_signature,
    derive_stealth_meta_address,
    generate_stealth_address,
    check_stealth_address,
    compute_stealth_private_key,
    sui_sign_message,
    stealth_key_to_sui_format,
    bytes_to_hex,
    hex_to_bytes,
};

/// Initialize panic hook for better error messages in browser console
#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

/// Sign a message with a Sui private key
/// Returns hex-encoded 64-byte signature
#[wasm_bindgen(js_name = signMessage)]
pub fn wasm_sign_message(sui_private_key: &str, message: &str) -> Result<String, JsValue> {
    let signature = sui_sign_message(sui_private_key, message)
        .map_err(|e| JsValue::from_str(&e))?;
    Ok(bytes_to_hex(&signature))
}

/// Derive view and spend keys from a signature
/// Returns JSON string: { "viewPrivateKey": "...", "spendPrivateKey": "..." }
#[wasm_bindgen(js_name = deriveKeysFromSignature)]
pub fn wasm_derive_keys_from_signature(signature_hex: &str) -> Result<String, JsValue> {
    let sig_bytes = hex_to_bytes(signature_hex)
        .map_err(|e| JsValue::from_str(&format!("Invalid hex: {}", e)))?;
    
    let keys = derive_keys_from_signature(&sig_bytes)
        .map_err(|e| JsValue::from_str(&e))?;
    
    let result = serde_json::json!({
        "viewPrivateKey": bytes_to_hex(&keys.view_priv_key),
        "spendPrivateKey": bytes_to_hex(&keys.spend_priv_key)
    });
    
    Ok(result.to_string())
}

/// Derive stealth meta-address from private keys
/// Returns JSON string
#[wasm_bindgen(js_name = deriveStealthMetaAddress)]
pub fn wasm_derive_stealth_meta_address(
    view_private_key_hex: &str,
    spend_private_key_hex: &str,
) -> Result<String, JsValue> {
    let view_priv = hex_to_bytes(view_private_key_hex)
        .map_err(|e| JsValue::from_str(&format!("Invalid view key hex: {}", e)))?;
    let spend_priv = hex_to_bytes(spend_private_key_hex)
        .map_err(|e| JsValue::from_str(&format!("Invalid spend key hex: {}", e)))?;
    
    let keys = crate::types::ReceiverSecretKeys {
        view_priv_key: view_priv,
        spend_priv_key: spend_priv,
    };
    
    let meta = derive_stealth_meta_address(&keys)
        .map_err(|e| JsValue::from_str(&e))?;
    
    let result = serde_json::json!({
        "viewPublicKey": bytes_to_hex(&meta.view_pub_key),
        "spendPublicKey": bytes_to_hex(&meta.spend_pub_key),
        "viewSuiAddress": meta.view_public_address,
        "spendSuiAddress": meta.spend_public_address
    });
    
    Ok(result.to_string())
}

/// Generate a stealth address for a recipient (sender side)
/// Returns JSON string
#[wasm_bindgen(js_name = generateStealthAddress)]
pub fn wasm_generate_stealth_address(
    view_public_key_hex: &str,
    spend_public_key_hex: &str,
) -> Result<String, JsValue> {
    let view_pub = hex_to_bytes(view_public_key_hex)
        .map_err(|e| JsValue::from_str(&format!("Invalid view pubkey hex: {}", e)))?;
    let spend_pub = hex_to_bytes(spend_public_key_hex)
        .map_err(|e| JsValue::from_str(&format!("Invalid spend pubkey hex: {}", e)))?;
    
    let meta = crate::types::StealthMetaAddress {
        view_pub_key: view_pub,
        spend_pub_key: spend_pub,
        view_public_address: String::new(),
        spend_public_address: String::new(),
    };
    
    let payload = generate_stealth_address(&meta)
        .map_err(|e| JsValue::from_str(&e))?;
    
    let result = serde_json::json!({
        "stealthAddress": payload.stealth_address,
        "ephemeralPublicKey": bytes_to_hex(&payload.ephemeral_public_key),
        "viewTag": payload.view_tag
    });
    
    Ok(result.to_string())
}

/// Check if an announcement belongs to this receiver
/// Returns JSON string
#[wasm_bindgen(js_name = checkStealthAddress)]
pub fn wasm_check_stealth_address(
    stealth_address: &str,
    ephemeral_public_key_hex: &str,
    view_tag: u8,
    view_private_key_hex: &str,
    spend_public_key_hex: &str,
) -> Result<String, JsValue> {
    let eph_pub = hex_to_bytes(ephemeral_public_key_hex)
        .map_err(|e| JsValue::from_str(&format!("Invalid ephemeral pubkey: {}", e)))?;
    let view_priv = hex_to_bytes(view_private_key_hex)
        .map_err(|e| JsValue::from_str(&format!("Invalid view privkey: {}", e)))?;
    let spend_pub = hex_to_bytes(spend_public_key_hex)
        .map_err(|e| JsValue::from_str(&format!("Invalid spend pubkey: {}", e)))?;
    
    let announcement = crate::types::Announcement {
        scheme_id: 1,
        stealth_address: stealth_address.to_string(),
        ephemeral_public_key: eph_pub,
        metadata: vec![view_tag],
    };
    
    let result = check_stealth_address(&announcement, &view_priv, &spend_pub)
        .map_err(|e| JsValue::from_str(&e))?;
    
    let json_result = match result {
        Some(hashed_shared) => serde_json::json!({
            "isMatch": true,
            "hashedSharedSecret": bytes_to_hex(&hashed_shared)
        }),
        None => serde_json::json!({
            "isMatch": false
        }),
    };
    
    Ok(json_result.to_string())
}

/// Derive the stealth private key (receiver side)
/// Returns JSON string
#[wasm_bindgen(js_name = computeStealthPrivateKey)]
pub fn wasm_compute_stealth_private_key(
    spend_private_key_hex: &str,
    hashed_shared_secret_hex: &str,
) -> Result<String, JsValue> {
    let spend_priv = hex_to_bytes(spend_private_key_hex)
        .map_err(|e| JsValue::from_str(&format!("Invalid spend privkey: {}", e)))?;
    let hashed_shared = hex_to_bytes(hashed_shared_secret_hex)
        .map_err(|e| JsValue::from_str(&format!("Invalid hash: {}", e)))?;
    
    let hash_array: [u8; 32] = hashed_shared.try_into()
        .map_err(|_| JsValue::from_str("Hash must be 32 bytes"))?;
    
    let keypair = compute_stealth_private_key(&spend_priv, &hash_array)
        .map_err(|e| JsValue::from_str(&e))?;
    
    let sui_format = stealth_key_to_sui_format(&keypair.private_key)
        .map_err(|e| JsValue::from_str(&e))?;
    
    let result = serde_json::json!({
        "privateKey": bytes_to_hex(&keypair.private_key),
        "privateKeySui": sui_format,
        "publicKey": bytes_to_hex(&keypair.public_key),
        "suiAddress": keypair.sui_address
    });
    
    Ok(result.to_string())
}