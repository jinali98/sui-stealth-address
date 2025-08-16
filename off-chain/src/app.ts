import express from "express";
// import cors from "cors";
import morgan from "morgan";
import { Request, Response, NextFunction } from "express";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";

import { fromB64 } from "@mysten/bcs";
import { keccak_256 } from "@noble/hashes/sha3";
import { CURVE, etc, getSharedSecret } from "@noble/secp256k1";
const { bytesToHex, hexToBytes, mod, hashToPrivateKey } = etc;
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";

import * as secp from "@noble/secp256k1";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/dist/cjs/client";

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

// const client = new SuiClient({ url: getFullnodeUrl("testnet") });

app.get("/new-wallet-address", async (_req: Request, res: Response) => {
  try {
    // receiver side
    const privateKeyReceiver =
      "suiprivkey1qzjl0ws9lrjqanx5yzd4vq44g649kknawatjegtv5k4gwfggesx92qmle4u";
    const walletAddressReceiver =
      "0x20c513f3e1848a7db6567e280f7964ade32a669ddc9d5a322320478bda0adcde";
    // const keypair = new Ed25519Keypair();
    // const publicKey = keypair.getPublicKey();
    // const secretKey = keypair.getSecretKey();
    // const address = keypair.getPublicKey().toSuiAddress();
    const message = new TextEncoder().encode(
      "please generate a stealth meta address for this wallet address"
    );

    const keypair = Ed25519Keypair.fromSecretKey(privateKeyReceiver);

    const { signature } = await keypair.signPersonalMessage(message);

    const raw = fromB64(signature);
    const flag = raw[0];
    const sig = raw.slice(1, 1 + 64);
    const rPart = sig.slice(0, 32);
    const sPart = sig.slice(32, 64);

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

    // sender side
    const empKeyPair = new Secp256k1Keypair();
    const empPublicKey = empKeyPair.getPublicKey();
    const empPublicAddress = empPublicKey.toSuiAddress();

    const empPrivateKey = empKeyPair.getSecretKey();
    const { secretKey: empPrivBytes } = decodeSuiPrivateKey(empPrivateKey);

    const sharedSecretViewPubKeyEmpPrivKey = getSharedSecret(
      empPrivBytes,
      viewPublicKey.toRawBytes()
    );

    const hashedSharedSecretViewPubKeyEmpPrivKey = keccak_256(
      sharedSecretViewPubKeyEmpPrivKey.slice(1)
    );

    // receiver side
    const sharedSecretEmpPubKeyViewPrivKey = getSharedSecret(
      viewPriv,
      empPublicKey.toRawBytes()
    );

    const hashedSharedSecretEmpPubKeyViewPrivKey = keccak_256(
      sharedSecretEmpPubKeyViewPrivKey.slice(1)
    );

    const hashScalarBytes = toPrivateKey(
      hashedSharedSecretEmpPubKeyViewPrivKey
    );
    const hashScalar = BigInt("0x" + bytesToHex(hashScalarBytes));
    const spendScalar = BigInt("0x" + bytesToHex(spendPublicKey.toRawBytes()));

    const stealthScalar = mod(spendScalar + hashScalar, CURVE.n);

    const stealthPrivBytes = hexToBytes(
      stealthScalar.toString(16).padStart(64, "0")
    );

    //Create a keypair from the stealth private key
    const stealthKeypair = Secp256k1Keypair.fromSecretKey(stealthPrivBytes);
    const stealthAddress = stealthKeypair.getPublicKey().toSuiAddress();
    const stealthPrivateKey = stealthKeypair.getSecretKey();

    res.status(200).json({
      status: "success",
      data: {
        receiverWalletData: {
          walletAddressReceiver,
          privateKeyReceiver,
          signature,
        },
        receiverStealthMetaAddress: {
          viewPublicKey,
          spendPublicKey,
          viewPublicAddress,
          spendPublicAddress,
        },
        stealthAddress: {
          stealthAddress,
          stealthPrivateKey,
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
