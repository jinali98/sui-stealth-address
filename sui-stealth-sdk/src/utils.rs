use blake2::{digest::VariableOutput, Blake2bVar};
use k256::{
    elliptic_curve::{ops::Reduce, ScalarPrimitive},
    Scalar, Secp256k1, U256, SecretKey,
};
use sha3::{Digest, Keccak256};

/// Hash data with Keccak-256
pub fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(data);
    let result = hasher.finalize();
    
    let mut output = [0u8; 32];
    output.copy_from_slice(&result);
    output
}

/// Convert a 32-byte seed into a valid private key
/// Reduces mod curve order and avoids zero
pub fn to_private_key(seed: &[u8; 32]) -> [u8; 32] {
    // Try to use seed directly if it's already valid
    if let Ok(scalar_primitive) = ScalarPrimitive::<Secp256k1>::from_slice(seed) {
        // Check if it's zero
        let scalar = Scalar::from(&scalar_primitive);
        if scalar.is_zero().into() {
            // Zero is invalid, return 1
            let mut one = [0u8; 32];
            one[31] = 1;
            return one;
        }
        return *seed;
    }
    
    // Seed is >= curve order, need to reduce
    let wide = U256::from_be_slice(seed);
    let scalar = <Scalar as Reduce<U256>>::reduce(wide);
    
    // Handle zero case
    if scalar.is_zero().into() {
        let mut one = [0u8; 32];
        one[31] = 1;
        return one;
    }
    
    scalar.to_bytes().into()
}

/// Derive a Sui address from a compressed secp256k1 public key
/// Formula: "0x" + hex(Blake2b-256(0x01 || pubkey_bytes))
pub fn pubkey_to_sui_address(compressed_pubkey: &[u8]) -> String {
    // Create Blake2b hasher with 32-byte output
    let mut hasher = Blake2bVar::new(32).expect("Invalid output size");
    
    // Hash: flag_byte || public_key_bytes
    // 0x01 = secp256k1 flag (Ed25519 uses 0x00)
    use blake2::digest::Update;
    hasher.update(&[0x01u8]);
    hasher.update(compressed_pubkey);
    
    // Finalize
    let mut address_bytes = [0u8; 32];
    hasher.finalize_variable(&mut address_bytes).expect("Invalid output size");
    
    // Format as "0x" + hex
    format!("0x{}", hex::encode(address_bytes))
}

pub fn bytes_to_hex(bytes: &[u8]) -> String {
    hex::encode(bytes)
}

pub fn hex_to_bytes(s: &str) -> Result<Vec<u8>, hex::FromHexError> {
    // Remove "0x" prefix if present
    let clean = s.strip_prefix("0x").unwrap_or(s);
    hex::decode(clean)
}

/// Extract compressed public key bytes from a secret key
pub fn secret_to_compressed_pubkey(secret: &SecretKey) -> Vec<u8> {
    use k256::elliptic_curve::sec1::ToEncodedPoint;
    let public = secret.public_key();
    let encoded = public.to_encoded_point(true);
    encoded.as_bytes().to_vec()
}

/// Extract raw bytes from a secret key
pub fn secret_to_bytes(secret: &SecretKey) -> Vec<u8> {
    secret.to_bytes().to_vec()
}