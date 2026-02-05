import { computeSharedSecret } from "../crypto/ecdh";
import { toScalar32 } from "../crypto/scalars";
import { deriveStealthPrivateKey } from "../crypto/secp256k1";
import { PublicKey } from "@mysten/sui/cryptography";

export function receiverDeriveStealthKeypair(
  viewPriv: Uint8Array,
  spendPriv: Uint8Array,
  empPub: PublicKey
) {
  const shared = computeSharedSecret(viewPriv, empPub);
  const h = toScalar32(shared);
  const kp = deriveStealthPrivateKey(spendPriv, h);
  return {
    stealthKeypair: kp,
    stealthAddress: kp.getPublicKey().toSuiAddress(),
    shared,
  };
}
