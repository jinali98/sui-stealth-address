import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromB64 } from "@mysten/bcs";

export async function signMessage(
  privateKey: string,
  message: string
): Promise<string> {
  const kp = Ed25519Keypair.fromSecretKey(privateKey);
  const bytes = new TextEncoder().encode(message);
  const { signature } = await kp.signPersonalMessage(bytes);
  return signature;
}

export function extractRandS(signature: string): {
  r: Uint8Array;
  s: Uint8Array;
} {
  const raw = fromB64(signature);
  const sig = raw.slice(1, 65);
  return {
    r: sig.slice(0, 32),
    s: sig.slice(32, 64),
  };
}
