import init, {
  signMessage,
  deriveKeysFromSignature,
  deriveStealthMetaAddress,
  generateStealthAddress,
  checkStealthAddress,
  computeStealthPrivateKey
} from '../wasm/sui_stealth_sdk';

import type {
  ReceiverKeys,
  StealthMetaAddress,
  StealthPayload,
  CheckResult,
  StealthKeyPair
} from '../types/stealth';

let initialized = false;

export async function initSdk(): Promise<void> {
  if (!initialized) {
    await init();
    initialized = true;
  }
}

export function sign(suiPrivateKey: string, message: string): string {
  return signMessage(suiPrivateKey, message);
}

export function deriveKeys(signatureHex: string): ReceiverKeys {
  const json = deriveKeysFromSignature(signatureHex);
  return JSON.parse(json);
}

export function deriveMetaAddress(
  viewPrivateKey: string,
  spendPrivateKey: string
): StealthMetaAddress {
  const json = deriveStealthMetaAddress(viewPrivateKey, spendPrivateKey);
  return JSON.parse(json);
}

export function generateStealth(
  viewPublicKey: string,
  spendPublicKey: string
): StealthPayload {
  const json = generateStealthAddress(viewPublicKey, spendPublicKey);
  return JSON.parse(json);
}

export function checkStealth(
  stealthAddress: string,
  ephemeralPublicKey: string,
  viewTag: number,
  viewPrivateKey: string,
  spendPublicKey: string
): CheckResult {
  const json = checkStealthAddress(
    stealthAddress,
    ephemeralPublicKey,
    viewTag,
    viewPrivateKey,
    spendPublicKey
  );
  return JSON.parse(json);
}

export function computeStealthKey(
  spendPrivateKey: string,
  hashedSharedSecret: string
): StealthKeyPair {
  const json = computeStealthPrivateKey(spendPrivateKey, hashedSharedSecret);
  return JSON.parse(json);
}
