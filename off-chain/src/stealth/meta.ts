import { keccak_256 } from "@noble/hashes/sha3";
import { toPrivateKey } from "../crypto/scalars";
import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";

export function deriveMetaKeys(r: Uint8Array, s: Uint8Array) {
  /*
  derive the view and spend private keys from the random numbers r and s
  */
  const viewPriv = toPrivateKey(keccak_256(r));
  const spendPriv = toPrivateKey(keccak_256(s));

  /*
  derive the view and spend public keys from the view and spend private keys
  */
  const view = Secp256k1Keypair.fromSecretKey(viewPriv);
  const spend = Secp256k1Keypair.fromSecretKey(spendPriv);

  return {
    viewPriv,
    spendPriv,
    viewPub: view.getPublicKey(),
    spendPub: spend.getPublicKey(),
    /*
    derive the view and spend addresses
    */
    viewAddress: view.getPublicKey().toSuiAddress(),
    spendAddress: spend.getPublicKey().toSuiAddress(),
  };
}
