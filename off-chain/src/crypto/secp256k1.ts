import {
  Secp256k1Keypair,
  Secp256k1PublicKey,
} from "@mysten/sui/keypairs/secp256k1";
import { CURVE, etc } from "@noble/secp256k1";
import { secp256k1 as curve } from "@noble/curves/secp256k1";

const { bytesToHex, hexToBytes, mod } = etc;

export function generateKeypair(): Secp256k1Keypair {
  return new Secp256k1Keypair();
}

export function deriveStealthPublicKey(
  spendPub: Secp256k1PublicKey,
  hashScalar: bigint
): Secp256k1PublicKey {
  const H = curve.ProjectivePoint.BASE.multiply(hashScalar);
  const P = curve.ProjectivePoint.fromHex(spendPub.toRawBytes());
  const Pstealth = P.add(H);
  return new Secp256k1PublicKey(Pstealth.toRawBytes(true));
}

export function deriveStealthPrivateKey(
  spendPriv: Uint8Array,
  hashScalar: bigint
): Secp256k1Keypair {
  const s = BigInt("0x" + bytesToHex(spendPriv));
  const k = mod(s + hashScalar, CURVE.n);
  return Secp256k1Keypair.fromSecretKey(
    hexToBytes(k.toString(16).padStart(64, "0"))
  );
}
