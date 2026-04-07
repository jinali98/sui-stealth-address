import { useState } from 'react';
import { generateStealth } from '../lib/stealth';
import { CopyButton } from './CopyButton';
import type { StealthPayload } from '../types/stealth';

export function SenderTab() {
  const [viewPublicKey, setViewPublicKey] = useState('');
  const [spendPublicKey, setSpendPublicKey] = useState('');
  const [payload, setPayload] = useState<StealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePasteMetaAddress = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text);
      if (parsed.viewPublicKey && parsed.spendPublicKey) {
        setViewPublicKey(parsed.viewPublicKey);
        setSpendPublicKey(parsed.spendPublicKey);
        setError(null);
      }
    } catch {
      setError('Invalid meta-address format');
    }
  };

  const handleGenerate = () => {
    try {
      setError(null);

      if (!viewPublicKey || !spendPublicKey) {
        setError('Please enter both public keys');
        return;
      }

      const result = generateStealth(viewPublicKey, spendPublicKey);
      setPayload(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  return (
    <div className="tab-content">
      <h2>Send to Stealth Address</h2>
      <p className="description">
        Generate a one-time stealth address for a recipient. They can claim funds
        using their wallet.
      </p>

      <div className="input-section">
        <div className="input-group">
          <label>Recipient's View Public Key:</label>
          <input
            type="text"
            value={viewPublicKey}
            onChange={e => setViewPublicKey(e.target.value)}
            placeholder="02a1b2c3..."
          />
        </div>

        <div className="input-group">
          <label>Recipient's Spend Public Key:</label>
          <input
            type="text"
            value={spendPublicKey}
            onChange={e => setSpendPublicKey(e.target.value)}
            placeholder="03d4e5f6..."
          />
        </div>

        <button onClick={handlePasteMetaAddress} className="secondary-button">
          Paste Meta-Address from Clipboard
        </button>

        <button onClick={handleGenerate} className="primary-button">
          Generate Stealth Address
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {payload && (
        <div className="result-section">
          <h3>Stealth Address Generated</h3>

          <div className="result-row highlight">
            <label>Send funds to:</label>
            <div className="value-with-copy">
              <code className="address">{payload.stealthAddress}</code>
              <CopyButton text={payload.stealthAddress} />
            </div>
          </div>

          <div className="announcement-box">
            <h4>Announcement Data (share with receiver):</h4>
            <textarea
              readOnly
              value={JSON.stringify(
                {
                  stealthAddress: payload.stealthAddress,
                  ephemeralPublicKey: payload.ephemeralPublicKey,
                  viewTag: payload.viewTag
                },
                null,
                2
              )}
            />
            <CopyButton
              text={JSON.stringify({
                stealthAddress: payload.stealthAddress,
                ephemeralPublicKey: payload.ephemeralPublicKey,
                viewTag: payload.viewTag
              })}
            />
          </div>

          <div className="instructions">
            <h4>Next Steps:</h4>
            <ol>
              <li>Send SUI or tokens to the stealth address above</li>
              <li>Share the announcement data with the recipient</li>
              <li>They will use it to derive the private key and claim funds</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
