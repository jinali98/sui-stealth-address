import { CURVE, etc, getSharedSecret } from "@noble/secp256k1";
const { bytesToHex, hexToBytes, mod, hashToPrivateKey } = etc;

export function toPrivateKey(seed32: Uint8Array): Uint8Array {
  let x = BigInt("0x" + bytesToHex(seed32));
  x = mod(x, CURVE.n);
  if (x === 0n) x = 1n;
  return hexToBytes(x.toString(16).padStart(64, "0"));
}

export function toScalar32(hash32: Uint8Array): bigint {
  let x = BigInt("0x" + bytesToHex(hash32));
  x = mod(x, CURVE.n);
  if (x === 0n) x = 1n;
  return x;
}
