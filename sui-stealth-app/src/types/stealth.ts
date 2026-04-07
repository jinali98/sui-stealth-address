export interface ReceiverKeys {
  viewPrivateKey: string;
  spendPrivateKey: string;
}

export interface StealthMetaAddress {
  viewPublicKey: string;
  spendPublicKey: string;
  viewSuiAddress: string;
  spendSuiAddress: string;
}

export interface StealthPayload {
  stealthAddress: string;
  ephemeralPublicKey: string;
  viewTag: number;
}

export interface CheckResult {
  isMatch: boolean;
  hashedSharedSecret?: string;
}

export interface StealthKeyPair {
  privateKey: string;
  privateKeySui: string;
  publicKey: string;
  suiAddress: string;
}
