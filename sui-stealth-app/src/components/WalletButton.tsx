import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';

export function WalletButton() {
  const account = useCurrentAccount();

  return (
    <div className="wallet-section">
      <ConnectButton />
      {account && (
        <p className="wallet-address">
          Connected: {account.address.slice(0, 6)}...{account.address.slice(-4)}
        </p>
      )}
    </div>
  );
}
