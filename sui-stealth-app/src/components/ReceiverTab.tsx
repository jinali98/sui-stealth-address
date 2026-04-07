import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useWalletSignature } from '../hooks/useWalletSignature';
import { deriveKeys, deriveMetaAddress } from '../lib/stealth';
import { CopyButton } from './CopyButton';
import type { StealthMetaAddress, ReceiverKeys } from '../types/stealth';

export function ReceiverTab() {
  const account = useCurrentAccount();
  const { signForStealth, isPending } = useWalletSignature();

  const [keys, setKeys] = useState<ReceiverKeys | null>(null);
  const [metaAddress, setMetaAddress] = useState<StealthMetaAddress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    try {
      setError(null);

      const signatureHex = await signForStealth();

      const derivedKeys = deriveKeys(signatureHex);
      setKeys(derivedKeys);

      const meta = deriveMetaAddress(
        derivedKeys.viewPrivateKey,
        derivedKeys.spendPrivateKey
      );
      setMetaAddress(meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  if (!account) {
    return <div className="tab-content">Please connect your wallet first.</div>;
  }

  return (
    <div className="tab-content">
      <h2>Generate Stealth Meta-Address</h2>
      <p className="description">
        Generate your stealth meta-address to receive private payments.
        Share this publicly — senders use it to create one-time addresses for you.
      </p>

      <button
        onClick={handleGenerate}
        disabled={isPending}
        className="primary-button"
      >
        {isPending ? 'Signing...' : 'Generate Meta-Address'}
      </button>

      {error && <div className="error">{error}</div>}

      {metaAddress && keys && (
        <div className="result-section">
          <h3>Your Stealth Meta-Address</h3>

          <div className="result-row">
            <label>View Public Key:</label>
            <div className="value-with-copy">
              <code>{metaAddress.viewPublicKey}</code>
              <CopyButton text={metaAddress.viewPublicKey} />
            </div>
          </div>

          <div className="result-row">
            <label>Spend Public Key:</label>
            <div className="value-with-copy">
              <code>{metaAddress.spendPublicKey}</code>
              <CopyButton text={metaAddress.spendPublicKey} />
            </div>
          </div>

          <div className="result-row">
            <label>View Sui Address:</label>
            <div className="value-with-copy">
              <code>{metaAddress.viewSuiAddress}</code>
              <CopyButton text={metaAddress.viewSuiAddress} />
            </div>
          </div>

          <div className="result-row">
            <label>Spend Sui Address:</label>
            <div className="value-with-copy">
              <code>{metaAddress.spendSuiAddress}</code>
              <CopyButton text={metaAddress.spendSuiAddress} />
            </div>
          </div>

          <div className="share-box">
            <h4>Share this with senders:</h4>
            <textarea
              readOnly
              value={JSON.stringify(
                {
                  viewPublicKey: metaAddress.viewPublicKey,
                  spendPublicKey: metaAddress.spendPublicKey
                },
                null,
                2
              )}
            />
            <CopyButton
              text={JSON.stringify({
                viewPublicKey: metaAddress.viewPublicKey,
                spendPublicKey: metaAddress.spendPublicKey
              })}
            />
          </div>

          <div className="warning">
            Keep your wallet safe! You'll need to sign the same message again to claim funds.
          </div>
        </div>
      )}
    </div>
  );
}
