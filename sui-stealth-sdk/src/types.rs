use serde::{Serialize, Deserialize};


#[derive(Debug,Clone)]
pub struct ReceiverSecretKeys {
    pub spend_priv_key: Vec<u8>,
    pub view_priv_key: Vec<u8>,
}

#[derive(Debug,Clone,Serialize,Deserialize)]
pub struct StealthMetaAddress {
    pub spend_pub_key: Vec<u8>,
    pub view_pub_key: Vec<u8>,
    pub view_public_address: String,
    pub spend_public_address: String,
}

/// what the sender computes and needs to announce on-chain
#[derive(Debug,Clone,Serialize,Deserialize)]
pub struct StealthPayload {
    pub stealth_address: String,
    pub ephemeral_public_key: Vec<u8>,
    pub view_tag: u8,
}
/// what goes on chain for the recipient to check
#[derive(Debug,Clone,Serialize,Deserialize)]
pub struct Announcement {
    pub scheme_id: u64,
    pub stealth_address: String,
    pub ephemeral_public_key: Vec<u8>,
    pub metadata: Vec<u8>,
}


/// The final keypair the receiver derives to spend funds
#[derive(Debug, Clone)]
pub struct StealthKeyPair {
    pub private_key: Vec<u8>, 
    pub public_key: Vec<u8>,
    pub sui_address: String,
}