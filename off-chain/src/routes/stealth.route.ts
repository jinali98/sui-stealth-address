import { Router } from "express";
import { signMessage, extractRandS } from "../crypto/ed25519";
import { deriveMetaKeys } from "../stealth/meta";
import { generateKeypair } from "../crypto/secp256k1";
import { senderDeriveStealthAddress } from "../stealth/sender";
import { receiverDeriveStealthKeypair } from "../stealth/receiver";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Secp256k1PublicKey } from "@mysten/sui/dist/cjs/keypairs/secp256k1";

const RECEIVER_PRIVATE_KEY = process.env.RECEIVER_PRIVATE_KEY;
const STEALTH_MESSAGE = process.env.STEALTH_MESSAGE;

if (!RECEIVER_PRIVATE_KEY || !STEALTH_MESSAGE) {
  throw new Error("RECEIVER_PRIVATE_KEY or STEALTH_MESSAGE is not set");
}

const router = Router();

router.get("/", async (_req, res) => {
  /*
a random message is signed by the receiver private key and generate a signature
*/
  const receiverPriv = RECEIVER_PRIVATE_KEY;
  const message = STEALTH_MESSAGE;

  const signature = await signMessage(receiverPriv, message);

  //

  const { r, s } = extractRandS(signature);

  const meta = deriveMetaKeys(r, s);

  
  const emp = generateKeypair();

  const { secretKey: empPrivBytes } = decodeSuiPrivateKey(emp.getSecretKey());

  const sender = senderDeriveStealthAddress(
    empPrivBytes,
    meta.viewPub,
    meta.spendPub as Secp256k1PublicKey
  );

  const receiver = receiverDeriveStealthKeypair(
    meta.viewPriv,
    meta.spendPriv,
    emp.getPublicKey()
  );

  res.json({
    stealthMetaKeys: meta,
    senderStealthAddress: sender.stealthAddress,
    receiverStealthAddress: receiver.stealthAddress,
    match: sender.stealthAddress === receiver.stealthAddress,
    receiverSecretKey: receiver.stealthKeypair.getSecretKey(),
  });
});

export default router;
