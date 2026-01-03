import { keccak_256 } from "@noble/hashes/sha3";
import { getSharedSecret } from "@noble/secp256k1";
import { PublicKey } from "@mysten/sui/cryptography";

export function computeSharedSecret(
  privKey: Uint8Array,
  pubKey: PublicKey
): Uint8Array {
  const secret = getSharedSecret(privKey, pubKey.toRawBytes());
  return keccak_256(secret.slice(1));
}
