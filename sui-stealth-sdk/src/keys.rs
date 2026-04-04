use k256::{SecretKey, PublicKey};
use rand::rngs::OsRng;

use crate::types::{ReceiverSecretKeys, StealthMetaAddress};
use crate::utils::{keccak256, pubkey_to_sui_address, secret_to_compressed_pubkey, to_private_key};



pub fn generate_ephemeral_key_pair() -> (SecretKey, PublicKey) {

    let secret_key = SecretKey::random(&mut OsRng);
    let public_key = secret_key.public_key();
    (secret_key, public_key)

}

pub fn derive_keys_from_signature(signature_bytes: &[u8]) -> Result<ReceiverSecretKeys, String> {
   
   if signature_bytes.len() < 64 {
    return Err("Signature must be 64 bytes".to_string());
   }

   let r_part = &signature_bytes[0..32];
   let s_part = &signature_bytes[32..64];

   let view_key_seed = keccak256(&r_part);
   let spend_key_seed = keccak256(&s_part);

   let view_priv_key = to_private_key(&view_key_seed);
   let spend_priv_key = to_private_key(&spend_key_seed);

   Ok(ReceiverSecretKeys {
    spend_priv_key: spend_priv_key.to_vec(),
    view_priv_key: view_priv_key.to_vec(),
   })
}

pub fn derive_stealth_meta_address(keys: &ReceiverSecretKeys) -> Result<StealthMetaAddress, String> {
    
    // Create SecretKey from view private bytes
    let view_secret = SecretKey::from_slice(&keys.view_priv_key)
        .map_err(|e| format!("Invalid view private key: {}", e))?;

    // Create SecretKey from spend private bytes
    let spend_secret = SecretKey::from_slice(&keys.spend_priv_key)
        .map_err(|e| format!("Invalid spend private key: {}", e))?;

    // Get public keys
    let view_public = view_secret.public_key();
    let spend_public = spend_secret.public_key();

    // Get compressed bytes (33 bytes each)
    let view_pub_bytes = secret_to_compressed_pubkey(&view_secret);
    let spend_pub_bytes = secret_to_compressed_pubkey(&spend_secret);

    // Derive Sui addresses
    let view_sui_address = pubkey_to_sui_address(&view_pub_bytes);
    let spend_sui_address = pubkey_to_sui_address(&spend_pub_bytes);

    Ok(StealthMetaAddress {
        view_pub_key: view_pub_bytes,
        spend_pub_key: spend_pub_bytes,
        view_public_address: view_sui_address,
        spend_public_address: spend_sui_address,
    })
}




#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_keys_deterministic() {
        // Create a fake 64-byte signature
        let mut sig = vec![0u8; 64];
        sig[0] = 0x42;
        sig[32] = 0x84;

        // Derive keys twice
        let keys1 = derive_keys_from_signature(&sig).unwrap();
        let keys2 = derive_keys_from_signature(&sig).unwrap();

        // Same input should give same output
        assert_eq!(keys1.view_priv_key, keys2.view_priv_key);
        assert_eq!(keys1.spend_priv_key, keys2.spend_priv_key);

        // View and spend should be different from each other
        assert_ne!(keys1.view_priv_key, keys1.spend_priv_key);

        println!("View key: {}", crate::utils::bytes_to_hex(&keys1.view_priv_key));
        println!("Spend key: {}", crate::utils::bytes_to_hex(&keys1.spend_priv_key));
    }

    #[test]
    fn test_meta_address_generation() {
        let mut sig = vec![0u8; 64];
        sig[0] = 0x42;
        sig[32] = 0x84;

        let keys = derive_keys_from_signature(&sig).unwrap();
        let meta = derive_stealth_meta_address(&keys).unwrap();

        // Public keys should be 33 bytes (compressed)
            assert_eq!(meta.view_pub_key.len(), 33);
        assert_eq!(meta.spend_pub_key.len(), 33);

        // Addresses should start with "0x"
        assert!(meta.view_public_address.starts_with("0x"));
        assert!(meta.spend_public_address.starts_with("0x"));

        println!("View address: {}", meta.view_public_address);
        println!("Spend address: {}", meta.spend_public_address);
    }
}