module stealth_address::stealth_address;

/**
 * Generate a stealth address from a recipient’s stealth meta-address.
 *
 * # Parameters
 * - `stealthMetaAddress`: A struct or byte vector containing the recipient’s
 *   spend public key and view public key (the "meta address").
 *
 * # Returns
 * - `stealthAddress`: The computed stealth address (derived from spend pubkey + hashed shared secret).
 * - `ephemeralPublicKey`: The sender’s ephemeral public key used in the ECDH handshake.
 * - `viewTag`: A 1-byte tag derived from the shared secret, used for efficient filtering.
 *
 * # Description
 * The sender uses this to create a unique one-time stealth address for the recipient.
 * The sender must then announce `(ephemeralPublicKey, viewTag, stealthAddress)` on-chain
 * so that the recipient can discover the payment.
 */
public fun generate_stealth_address(stealthMetaAddress: vector<u8>): (address, vector<u8>, u8) {}

/**
 * Check whether a given stealth address belongs to a recipient.
 *
 * # Parameters
 * - `stealthAddress`: The stealth address announced by the sender.
 * - `ephemeralPublicKey`: The ephemeral public key announced by the sender.
 * - `viewingKey`: The recipient’s private view key.
 * - `spendingPubKey`: The recipient’s public spend key.
 *
 * # Returns
 * - `bool`: `true` if the stealth address can be derived by the recipient, `false` otherwise.
 *
 * # Description
 * The recipient uses this to scan announcements and determine whether a stealth address
 * belongs to them without revealing their spending key.
 */
public fun check_stealth_address(
    stealthAddress: address,
    ephemeralPublicKey: vector<u8>,
    viewingKey: vector<u8>,
    spendingPubKey: vector<u8>,
): bool {}

/**
 * Compute the stealth private key for a recipient to spend funds.
 *
 * # Parameters
 * - `stealthAddress`: The stealth address being checked.
 * - `ephemeralPublicKey`: The sender’s ephemeral public key.
 * - `viewingKey`: The recipient’s private view key.
 * - `spendingKey`: The recipient’s private spend key.
 *
 * # Returns
 * - `stealthPrivateKey`: The private key corresponding to the stealth address.
 *
 * # Description
 * Once the recipient identifies a stealth address as theirs, they use their private
 * viewing key and private spending key to derive the full stealth private key.
 * This allows them to spend funds sent to that stealth address.
 */
public fun compute_stealth_key(
    stealthAddress: address,
    ephemeralPublicKey: vector<u8>,
    viewingKey: vector<u8>,
    spendingKey: vector<u8>,
): vector<u8> {}
