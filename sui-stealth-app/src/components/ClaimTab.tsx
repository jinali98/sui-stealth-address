import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useWalletSignature } from '../hooks/useWalletSignature';
import {
  deriveKeys,
  deriveMetaAddress,
  checkStealth,
  computeStealthKey
} from '../lib/stealth';
import { CopyButton } from './CopyButton';
import type { StealthKeyPair } from '../types/stealth';

export function ClaimTab() {
  const account = useCurrentAccount();
  const { signForStealth, isPending } = useWalletSignature();

  const [announcementJson, setAnnouncementJson] = useState('');
  const [stealthKey, setStealthKey] = useState<StealthKeyPair | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  const handleClaim = async () => {
    try {
      setError(null);
      setStealthKey(null);

      setStatus('Parsing announcement...');
      const announcement = JSON.parse(announcementJson);

      if (
        !announcement.stealthAddress ||
        !announcement.ephemeralPublicKey ||
        announcement.viewTag === undefined
      ) {
        throw new Error('Invalid announcement format');
      }

      setStatus('Please sign the message in your wallet...');
      const signatureHex = await signForStealth();

      setStatus('Deriving keys...');
      const keys = deriveKeys(signatureHex);
      const meta = deriveMetaAddress(keys.viewPrivateKey, keys.spendPrivateKey);

      setStatus('Checking announcement...');
      const checkResult = checkStealth(
        announcement.stealthAddress,
        announcement.ephemeralPublicKey,
        announcement.viewTag,
        keys.viewPrivateKey,
        meta.spendPublicKey
      );

      if (!checkResult.isMatch) {
        throw new Error('This announcement is not for your wallet');
      }

      setStatus('Deriving stealth private key...');
      const result = computeStealthKey(
        keys.spendPrivateKey,
        checkResult.hashedSharedSecret!
      );

      setStealthKey(result);
      setStatus('Success!');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setStatus('');
    }
  };

  if (!account) {
    return <div className="tab-content">Please connect your wallet first.</div>;
  }

  return (
    <div className="tab-content">
      <h2>Claim Stealth Funds</h2>
      <p className="description">
        Paste the announcement data from the sender to derive your spending key.
      </p>

      <div className="input-section">
        <div className="input-group">
          <label>Announcement Data (JSON):</label>
          <textarea
            value={announcementJson}
            onChange={e => setAnnouncementJson(e.target.value)}
            placeholder='{"stealthAddress": "0x...", "ephemeralPublicKey": "...", "viewTag": 123}'
            rows={5}
          />
        </div>

        <button
          onClick={handleClaim}
          disabled={isPending || !announcementJson}
          className="primary-button"
        >
          {isPending ? 'Signing...' : 'Claim Funds'}
        </button>

        {status && <div className="status">{status}</div>}
      </div>

      {error && <div className="error">{error}</div>}

      {stealthKey && (
        <div className="result-section">
          <h3>Stealth Key Derived Successfully!</h3>

          <div className="result-row highlight">
            <label>Stealth Address:</label>
            <div className="value-with-copy">
              <code>{stealthKey.suiAddress}</code>
              <CopyButton text={stealthKey.suiAddress} />
            </div>
          </div>

          <div className="result-row">
            <label>Private Key (Sui format):</label>
            <div className="value-with-copy">
              <code className="private-key">{stealthKey.privateKeySui}</code>
              <CopyButton text={stealthKey.privateKeySui} />
            </div>
          </div>

          <div className="instructions">
            <h4>Next Steps:</h4>
            <ol>
              <li>Copy the private key above (Sui format)</li>
              <li>Open your Sui wallet (Slush, Sui Wallet, etc.)</li>
              <li>Import the private key</li>
              <li>You now have access to the funds!</li>
            </ol>
          </div>

          <div className="warning">Never share your private key with anyone!</div>
        </div>
      )}
    </div>
  );
}
