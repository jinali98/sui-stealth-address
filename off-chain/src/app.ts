import dotenv from "dotenv";
dotenv.config();
import express from "express";
import morgan from "morgan";
import { Request, Response, NextFunction } from "express";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  Secp256k1Keypair,
  Secp256k1PublicKey,
} from "@mysten/sui/keypairs/secp256k1";
import { secp256k1 as curve } from "@noble/curves/secp256k1";

import { fromB64 } from "@mysten/bcs";
import { keccak_256 } from "@noble/hashes/sha3";
import { CURVE, etc, getSharedSecret } from "@noble/secp256k1";
const { bytesToHex, hexToBytes, mod } = etc;
import { decodeSuiPrivateKey, PublicKey } from "@mysten/sui/cryptography";

import stealthRoute from "./routes/stealth.route";

const app = express();

// middlewares
// app.use(cors(config));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// health check
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "Server is running✌️",
  });
});

function toPrivateKey(seed: Uint8Array): Uint8Array {
  // Interpret the 32‑byte seed as a big‑endian integer
  let num = BigInt("0x" + bytesToHex(seed));
  // Reduce it mod the curve order (CURVE.n)
  num = mod(num, CURVE.n);
  // Avoid the zero edge-case
  if (num === 0n) num = 1n;
  // Convert back to a 32‑byte array
  const hex = num.toString(16).padStart(64, "0");
  return hexToBytes(hex);
}

function generateKeyPair() {
  const keypair = new Ed25519Keypair();
  const publicKey = keypair.getPublicKey();
  const secretKey = keypair.getSecretKey();
  const address = keypair.getPublicKey().toSuiAddress();
  return { keypair, publicKey, secretKey, address };
}

function generateEmpKeyPair() {
  const empKeyPair = new Secp256k1Keypair();
  const empPublicKey = empKeyPair.getPublicKey();
  const empPublicAddress = empPublicKey.toSuiAddress();

  return { empKeyPair, empPublicKey, empPublicAddress };
}

async function generateSignMessage(privateKey: string, text: string) {
  const message = new TextEncoder().encode(text);
  const keypair = Ed25519Keypair.fromSecretKey(privateKey);

  const { signature } = await keypair.signPersonalMessage(message);

  return signature;
}

const generateRandS = async (
  signature: string
): Promise<{
  rPart: Uint8Array;
  sPart: Uint8Array;
}> => {
  const raw = fromB64(signature);
  const sig = raw.slice(1, 1 + 64);
  const rPart = sig.slice(0, 32);
  const sPart = sig.slice(32, 64);

  return { rPart, sPart };
};

const generateStealthMetaAddress = async (
  rPart: Uint8Array,
  sPart: Uint8Array
) => {
  const viewKeySeed = keccak_256(rPart);
  const spendKeySeed = keccak_256(sPart);

  const viewPriv = toPrivateKey(viewKeySeed);
  const spendPriv = toPrivateKey(spendKeySeed);

  const secpAddressView = Secp256k1Keypair.fromSecretKey(viewPriv);
  const secpAddressSpend = Secp256k1Keypair.fromSecretKey(spendPriv);

  const viewPublicKey = secpAddressView.getPublicKey();
  const spendPublicKey = secpAddressSpend.getPublicKey();

  const viewPublicAddress = viewPublicKey.toSuiAddress();
  const spendPublicAddress = spendPublicKey.toSuiAddress();

  return {
    viewPublicAddress,
    spendPublicAddress,
    viewPublicKey,
    spendPublicKey,
  };
};

const generateViewPriv = async (signature: string): Promise<Uint8Array> => {
  const { rPart } = await generateRandS(signature);
  const viewKeySeed = keccak_256(rPart);
  const viewPriv = toPrivateKey(viewKeySeed);
  return viewPriv;
};

const generateSpendPriv = async (signature: string): Promise<Uint8Array> => {
  const { sPart } = await generateRandS(signature);
  const spendKeySeed = keccak_256(sPart);
  const spendPriv = toPrivateKey(spendKeySeed);
  return spendPriv;
};

const generatePrivateKeyBitsfromKeyPair = async (
  empKeyPair: Secp256k1Keypair
) => {
  const empPrivateKey = empKeyPair.getSecretKey();
  const { secretKey: empPrivBytes } = decodeSuiPrivateKey(empPrivateKey);
  return empPrivBytes;
};

const senderGenerateSharedSecret = async (
  privKeyBytes: Uint8Array,
  publicKey: PublicKey
) => {
  const sharedSecretViewPubKeyEmpPrivKey = getSharedSecret(
    privKeyBytes,
    publicKey.toRawBytes()
  );

  const hashedSharedSecretViewPubKeyEmpPrivKey = keccak_256(
    sharedSecretViewPubKeyEmpPrivKey.slice(1)
  );

  return hashedSharedSecretViewPubKeyEmpPrivKey;
};

const generateStealthKeyPair = async (
  hashedSharedSecret: Uint8Array,
  publicKey: PublicKey
) => {
  const hashScalarBytes = toPrivateKey(hashedSharedSecret);
  const hashScalar = BigInt("0x" + bytesToHex(hashScalarBytes));
  const spendScalar = BigInt("0x" + bytesToHex(publicKey.toRawBytes()));

  const stealthScalar = mod(spendScalar + hashScalar, CURVE.n);

  const stealthPrivBytes = hexToBytes(
    stealthScalar.toString(16).padStart(64, "0")
  );

  //Create a keypair from the stealth private key
  const stealthKeypair = Secp256k1Keypair.fromSecretKey(stealthPrivBytes);

  return stealthKeypair;
};

function toScalar32(hash32: Uint8Array): bigint {
  let x = BigInt("0x" + bytesToHex(hash32));
  x = mod(x, CURVE.n);
  if (x === 0n) x = 1n;
  return x;
}

function senderComputeStealthPublicKey(
  spendPub: Secp256k1PublicKey,
  hashedShared: Uint8Array
): Secp256k1PublicKey {
  const h = toScalar32(hashedShared);
  const H = curve.ProjectivePoint.BASE.multiply(h); // h·G
  const Pspend = curve.ProjectivePoint.fromHex(spendPub.toRawBytes());
  const Pstealth = Pspend.add(H);
  const stealthPubBytes = Pstealth.toRawBytes(true); // 33B compressed
  return new Secp256k1PublicKey(stealthPubBytes);
}

function receiverComputeStealthKeypair(
  spendPriv: Uint8Array,
  hashedShared: Uint8Array
): Secp256k1Keypair {
  const h = toScalar32(hashedShared);
  const s = BigInt("0x" + bytesToHex(spendPriv));
  const k = mod(s + h, CURVE.n);
  const kBytes = hexToBytes(k.toString(16).padStart(64, "0"));
  return Secp256k1Keypair.fromSecretKey(kBytes);
}

app.get("/new-wallet-address", async (_req: Request, res: Response) => {
  try {
    // receiver side
    const privateKeyReceiver =
      "suiprivkey1qzjl0ws9lrjqanx5yzd4vq44g649kknawatjegtv5k4gwfggesx92qmle4u";
    const walletAddressReceiver =
      "0x20c513f3e1848a7db6567e280f7964ade32a669ddc9d5a322320478bda0adcde";

    const message =
      "please generate a stealth meta address for this wallet address";

    const signature = await generateSignMessage(privateKeyReceiver, message);

    const { rPart, sPart } = await generateRandS(signature);

    const {
      viewPublicAddress,
      spendPublicAddress,
      viewPublicKey,
      spendPublicKey,
    } = await generateStealthMetaAddress(rPart, sPart);

    // sender side

    const { empKeyPair, empPublicKey } = generateEmpKeyPair();

    const empPrivBytes = await generatePrivateKeyBitsfromKeyPair(empKeyPair);

    const hashedSharedSecretViewPubKeyEmpPrivKey =
      await senderGenerateSharedSecret(empPrivBytes, viewPublicKey);

    const stealthPublicKeySenderGenerated = senderComputeStealthPublicKey(
      spendPublicKey as Secp256k1PublicKey,
      hashedSharedSecretViewPubKeyEmpPrivKey
    );

    const stealthAddressSenderGenerated =
      stealthPublicKeySenderGenerated.toSuiAddress();

    // receiver side
    const viewPriv = await generateViewPriv(signature);
    const spendPriv = await generateSpendPriv(signature);

    const hashedSharedSecretEmpPubKeyViewPrivKey =
      await senderGenerateSharedSecret(viewPriv, empPublicKey);

    const stealthKeypairReceiverGenerated = await receiverComputeStealthKeypair(
      spendPriv,
      hashedSharedSecretEmpPubKeyViewPrivKey
    );

    const stealthAddressReceiverGenerated = stealthKeypairReceiverGenerated
      .getPublicKey()
      .toSuiAddress();

    const stealthPrivateKeyReceiverGenerated =
      stealthKeypairReceiverGenerated.getSecretKey();

    res.status(200).json({
      status: "success",
      data: {
        receiverWalletData: {
          walletAddressReceiver,
          privateKeyReceiver,
          signature,
        },
        stealthMetaAddress: {
          viewPublicKey,
          spendPublicKey,
          viewPublicAddress,
          spendPublicAddress,
        },
        stealthAddressReceiverGenerated: {
          stealthAddress: stealthAddressReceiverGenerated,
          stealthPrivateKey: stealthPrivateKeyReceiverGenerated,
        },
        announcement: {
          stealthAddress: stealthAddressSenderGenerated,
          empPublicKey,
          hashedSharedSecretViewPubKeyEmpPrivKey,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.use("/stealth", stealthRoute);

// Handle all routes that are not defined
app.all("*", (req: Request, _res: Response, next: NextFunction) => {
  next(new Error(`Can't find ${req.originalUrl} on this server!`));
});

// global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    status: "error",
    message: err.message,
  });
});

export default app;
