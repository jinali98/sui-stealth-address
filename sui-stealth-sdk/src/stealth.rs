use k256::{
    elliptic_curve::{
        ops::Reduce,
        sec1::ToEncodedPoint,
    },
    ProjectivePoint, PublicKey, Scalar, SecretKey, U256,
};

use crate::keys::{generate_ephemeral_key_pair};
use crate::types::{Announcement, StealthKeyPair, StealthMetaAddress, StealthPayload};
use crate::utils::{keccak256, pubkey_to_sui_address, secret_to_bytes, secret_to_compressed_pubkey};


/// Compute ECDH shared secret and hash it
fn compute_hashed_shared_secret(
    private_key_bytes: &[u8],
    public_key_bytes: &[u8],
) -> Result<[u8; 32], String> {
    //Parse the private key
    let secret = SecretKey::from_slice(private_key_bytes)
        .map_err(|e| format!("Invalid private key: {}", e))?;

    //Parse the public key
    let public = PublicKey::from_sec1_bytes(public_key_bytes)
        .map_err(|e| format!("Invalid public key: {}", e))?;

    // Do ECDH (private_key × public_key_point)
    let secret_scalar = *secret.to_nonzero_scalar();
    let public_point = public.to_projective();
    let shared_point = (public_point * secret_scalar).to_affine();

    // Get uncompressed point bytes and skip the 0x04 prefix
    let encoded = shared_point.to_encoded_point(false);
    let shared_bytes = &encoded.as_bytes()[1..]; // skip 0x04 prefix

    // Hash with keccak256
    Ok(keccak256(shared_bytes))
}

/// Extract view tag (first byte of hashed shared secret)
/// Used for fast filtering of announcements
fn extract_view_tag(hashed_shared_secret: &[u8; 32]) -> u8 {
    hashed_shared_secret[0]
}

// Convert a 32 byte hash to a valid scalar (mod curve order, avoid zero)
fn hash_to_scalar(hash: &[u8; 32]) -> Scalar {
    let wide = U256::from_be_slice(hash);
    let scalar = <Scalar as Reduce<U256>>::reduce(wide);
    
    // Avoid zero
    if bool::from(scalar.is_zero()) {
        Scalar::ONE
    } else {
        scalar
    }
}

/// Generate a stealth address for a recipient
pub fn generate_stealth_address(
    meta_address: &StealthMetaAddress,
) -> Result<StealthPayload, String> {
    // Generate ephemeral keypair (random, one-time use)
    let (ephemeral_secret, _ephemeral_public) = generate_ephemeral_key_pair();

    // ECDH = ephemeral_priv × view_pub
    let eph_priv_bytes = secret_to_bytes(&ephemeral_secret);
    let hashed_shared = compute_hashed_shared_secret(
        &eph_priv_bytes,
        &meta_address.view_pub_key,
    )?;

    // Extract view tag (first byte)
    let view_tag = extract_view_tag(&hashed_shared);

    // Compute hash·G (hash times generator point)
    let hash_scalar = hash_to_scalar(&hashed_shared);
    let h_times_g: ProjectivePoint = ProjectivePoint::GENERATOR * hash_scalar;

    // Compute stealth public key = P_spend + hash·G
    let spend_pubkey = PublicKey::from_sec1_bytes(&meta_address.spend_pub_key)
        .map_err(|e| format!("Invalid spend public key: {}", e))?;
    let p_spend: ProjectivePoint = spend_pubkey.to_projective();
    let p_stealth: ProjectivePoint = p_spend + h_times_g;

    // Convert to Sui address
    let stealth_affine = p_stealth.to_affine();
    let stealth_pub_bytes = stealth_affine.to_encoded_point(true); // compressed
    let stealth_address = pubkey_to_sui_address(stealth_pub_bytes.as_bytes());

    // Get ephemeral public key to include in announcement
    let eph_pub_bytes = secret_to_compressed_pubkey(&ephemeral_secret);

    Ok(StealthPayload {
        stealth_address,
        ephemeral_public_key: eph_pub_bytes,
        view_tag,
    })
}

// Create an announcement from a stealth payload
pub fn create_announcement(payload: &StealthPayload, scheme_id: u64) -> Announcement {
    Announcement {
        scheme_id,
        stealth_address: payload.stealth_address.clone(),
        ephemeral_public_key: payload.ephemeral_public_key.clone(),
        metadata: vec![payload.view_tag], // first byte is view tag
    }
}

// Check if an announcement belongs to this receiver
/// Returns Some(hashed_shared_secret) if it matches
pub fn check_stealth_address(
    announcement: &Announcement,
    view_private_key: &[u8],
    spend_public_key: &[u8],
) -> Result<Option<[u8; 32]>, String> {
    // ECDH = view_priv × ephemeral_pub
    let hashed_shared = compute_hashed_shared_secret(
        view_private_key,
        &announcement.ephemeral_public_key,
    )?;

    // Does view tag match?
    let computed_tag = extract_view_tag(&hashed_shared);
    let announcement_tag = announcement.metadata.get(0)
        .ok_or("Announcement metadata is empty")?;

    if computed_tag != *announcement_tag {
        return Ok(None);
    }

    // Full verification = reconstruct stealth address
    let hash_scalar = hash_to_scalar(&hashed_shared);
    let h_times_g: ProjectivePoint = ProjectivePoint::GENERATOR * hash_scalar;

    let spend_pubkey = PublicKey::from_sec1_bytes(spend_public_key)
        .map_err(|e| format!("Invalid spend public key: {}", e))?;
    let p_spend: ProjectivePoint = spend_pubkey.to_projective();
    let p_stealth: ProjectivePoint = p_spend + h_times_g;

    let stealth_affine = p_stealth.to_affine();
    let stealth_pub_bytes = stealth_affine.to_encoded_point(true);
    let reconstructed_address = pubkey_to_sui_address(stealth_pub_bytes.as_bytes());

    // Compare
    if reconstructed_address == announcement.stealth_address {
        Ok(Some(hashed_shared))
    } else {
        Ok(None) // View tag collision (1/256 false positive)
    }
}


/// Derive the stealth private key to spend funds
pub fn compute_stealth_private_key(
    spend_private_key: &[u8],
    hashed_shared_secret: &[u8; 32],
) -> Result<StealthKeyPair, String> {
    // Convert spend private key to scalar
    let spend_scalar = {
        let wide = U256::from_be_slice(spend_private_key);
        <Scalar as Reduce<U256>>::reduce(wide)
    };

    // Convert hashed shared secret to scalar
    let hash_scalar = hash_to_scalar(hashed_shared_secret);

    // Add them (mod curve order)
    let stealth_scalar = spend_scalar + hash_scalar;

    // Convert back to bytes
    let stealth_priv_bytes = stealth_scalar.to_bytes();

    // Create keypair and derive address
    let stealth_secret = SecretKey::from_slice(&stealth_priv_bytes)
        .map_err(|e| format!("Invalid stealth private key: {}", e))?;
    let stealth_public = stealth_secret.public_key();
    let stealth_pub_compressed = stealth_public.to_encoded_point(true);
    let sui_address = pubkey_to_sui_address(stealth_pub_compressed.as_bytes());

    Ok(StealthKeyPair {
        private_key: stealth_priv_bytes.to_vec(),
        public_key: stealth_pub_compressed.as_bytes().to_vec(),
        sui_address,
    })
}