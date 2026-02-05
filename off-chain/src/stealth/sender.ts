import { computeSharedSecret } from "../crypto/ecdh";
import { toScalar32 } from "../crypto/scalars";
import { deriveStealthPublicKey } from "../crypto/secp256k1";
import { Secp256k1PublicKey } from "@mysten/sui/keypairs/secp256k1";
import { PublicKey } from "@mysten/sui/cryptography";

export function senderDeriveStealthAddress(
  empPriv: Uint8Array,
  viewPub: PublicKey,
  spendPub: Secp256k1PublicKey
) {
  const shared = computeSharedSecret(empPriv, viewPub);
  const h = toScalar32(shared);
  const stealthPub = deriveStealthPublicKey(spendPub, h);
  return {
    stealthPub,
    stealthAddress: stealthPub.toSuiAddress(),
    shared,
  };
}
